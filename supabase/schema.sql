-- Hazir backend (Supabase free tier). Host accounts use Supabase Auth.
-- Tables are protected by Row Level Security. Guests never read tables directly; they use the functions below.

create extension if not exists pgcrypto;

create table if not exists public.events (
  id text primary key default encode(gen_random_bytes(5),'hex'),
  owner uuid not null references auth.users(id) on delete cascade default auth.uid(),
  title text not null check (char_length(title) between 1 and 80),
  occasion text not null,
  event_date date not null,
  host_name text check (char_length(host_name) <= 40),
  invited int not null check (invited between 1 and 5000),
  deadline date,
  max_party int not null default 4 check (max_party between 1 and 10),
  default_time int not null default 1140 check (default_time between 0 and 1439),
  created_at timestamptz not null default now()
);
create table if not exists public.invitees (
  id uuid primary key default gen_random_uuid(),
  event_id text not null references public.events(id) on delete cascade,
  name text not null check (char_length(name) <= 40),
  token text not null default encode(gen_random_bytes(12),'hex')
);
create table if not exists public.responses (
  id uuid primary key default gen_random_uuid(),
  event_id text not null references public.events(id) on delete cascade,
  invitee_id uuid references public.invitees(id) on delete cascade,
  name text not null check (char_length(name) <= 40),
  attending boolean not null,
  grp text, meal text,
  party int not null default 0 check (party between 0 and 10),
  arrival int check (arrival between 0 and 1439),
  companions jsonb not null default '[]',
  note text check (char_length(note) <= 120),
  checked_in boolean not null default false,
  created_at timestamptz not null default now(),
  unique (invitee_id)
);
create index if not exists responses_event on public.responses(event_id);
create index if not exists invitees_event on public.invitees(event_id);

alter table public.events enable row level security;
alter table public.invitees enable row level security;
alter table public.responses enable row level security;

-- Owners manage their own events and see only their own guests.
drop policy if exists events_owner on public.events;
create policy events_owner on public.events for all to authenticated
  using (owner = auth.uid()) with check (owner = auth.uid());
drop policy if exists invitees_owner on public.invitees;
create policy invitees_owner on public.invitees for all to authenticated
  using (exists (select 1 from public.events e where e.id = event_id and e.owner = auth.uid()))
  with check (exists (select 1 from public.events e where e.id = event_id and e.owner = auth.uid()));
drop policy if exists responses_owner on public.responses;
create policy responses_owner on public.responses for all to authenticated
  using (exists (select 1 from public.events e where e.id = event_id and e.owner = auth.uid()))
  with check (exists (select 1 from public.events e where e.id = event_id and e.owner = auth.uid()));
revoke all on public.events, public.invitees, public.responses from anon;

-- Public invite: title, date and deadline only. Never guest names, meals or answers.
-- A personal token also returns that one guest's own name.
create or replace function public.get_invite(p_event text, p_token text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare e events; inv invitees; done boolean := false;
begin
  select * into e from events where id = p_event;
  if not found then return null; end if;
  if p_token is not null then
    select * into inv from invitees where event_id = e.id and token = p_token;
    if found then select exists(select 1 from responses where invitee_id = inv.id) into done; end if;
  end if;
  return jsonb_build_object('id', e.id, 'title', e.title, 'occasion', e.occasion, 'date', e.event_date,
    'host', e.host_name, 'deadline', e.deadline, 'max', e.max_party, 'time', e.default_time,
    'invitee_name', inv.name, 'answered', done,
    'closed', (e.deadline is not null and e.deadline < current_date));
end $$;

create or replace function public.submit_rsvp(p_event text, p_token text, p_name text, p_attending boolean,
  p_grp text, p_meal text, p_party int, p_arrival int, p_comp jsonb, p_note text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare e events; inv invitees; cnt int;
begin
  select * into e from events where id = p_event;
  if not found then raise exception 'Event not found'; end if;
  if e.deadline is not null and e.deadline < current_date then raise exception 'RSVPs are closed'; end if;
  if p_token is not null and p_token <> '' then
    select * into inv from invitees where event_id = e.id and token = p_token;
    if not found then raise exception 'This invitation link is not valid'; end if;
  end if;
  select count(*) into cnt from responses where event_id = e.id;
  if cnt >= 6000 then raise exception 'This event is full'; end if;
  if inv.id is not null then delete from responses where invitee_id = inv.id; end if;
  insert into responses(event_id, invitee_id, name, attending, grp, meal, party, arrival, companions, note)
  values (e.id, inv.id, left(coalesce(nullif(trim(p_name), ''), inv.name, 'Guest'), 40), p_attending,
    left(p_grp, 20), left(p_meal, 20),
    case when p_attending then least(e.max_party, greatest(1, p_party)) else 0 end,
    case when p_attending then p_arrival else null end,
    case when jsonb_typeof(p_comp) = 'array' then p_comp else '[]'::jsonb end, left(p_note, 120));
  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.get_invite(text, text), public.submit_rsvp(text, text, text, boolean, text, text, int, int, jsonb, text) from public;
grant execute on function public.get_invite(text, text), public.submit_rsvp(text, text, text, boolean, text, text, int, int, jsonb, text) to anon, authenticated;

-- Data API grants (new tables are not auto-exposed). RLS above still decides which rows each host can touch.
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.events, public.invitees, public.responses to authenticated;

-- For projects created before check-in existed:
alter table public.responses add column if not exists checked_in boolean not null default false;

-- Migration 2: exact deadline time with timezone, venue, guest message, manual close
alter table public.events
  add column if not exists deadline_at timestamptz,
  add column if not exists tz text not null default 'Asia/Kolkata',
  add column if not exists venue text check (char_length(venue) <= 120),
  add column if not exists message text check (char_length(message) <= 300),
  add column if not exists rsvp_closed boolean not null default false;

create or replace function public.rsvp_is_closed(e public.events) returns boolean
language sql stable as $$
  select e.rsvp_closed
    or (e.deadline_at is not null and e.deadline_at <= now())
    or (e.deadline_at is null and e.deadline is not null and e.deadline < current_date);
$$;

create or replace function public.get_invite(p_event text, p_token text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare e events; inv invitees; done boolean := false;
begin
  select * into e from events where id = p_event;
  if not found then return null; end if;
  if p_token is not null then
    select * into inv from invitees where event_id = e.id and token = p_token;
    if found then select exists(select 1 from responses where invitee_id = inv.id) into done; end if;
  end if;
  return jsonb_build_object('id', e.id, 'title', e.title, 'occasion', e.occasion, 'date', e.event_date,
    'host', e.host_name, 'deadline', e.deadline, 'deadline_at', e.deadline_at, 'tz', e.tz,
    'venue', e.venue, 'message', e.message, 'max', e.max_party, 'time', e.default_time,
    'invitee_name', inv.name, 'answered', done, 'closed', public.rsvp_is_closed(e));
end $$;

create or replace function public.submit_rsvp(p_event text, p_token text, p_name text, p_attending boolean,
  p_grp text, p_meal text, p_party int, p_arrival int, p_comp jsonb, p_note text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare e events; inv invitees; cnt int;
begin
  select * into e from events where id = p_event;
  if not found then raise exception 'Event not found'; end if;
  if public.rsvp_is_closed(e) then raise exception 'RSVPs are closed'; end if;
  if p_token is not null and p_token <> '' then
    select * into inv from invitees where event_id = e.id and token = p_token;
    if not found then raise exception 'This invitation link is not valid'; end if;
  end if;
  select count(*) into cnt from responses where event_id = e.id;
  if cnt >= 6000 then raise exception 'This event is full'; end if;
  if inv.id is not null then delete from responses where invitee_id = inv.id; end if;
  insert into responses(event_id, invitee_id, name, attending, grp, meal, party, arrival, companions, note)
  values (e.id, inv.id, left(coalesce(nullif(trim(p_name), ''), inv.name, 'Guest'), 40), p_attending,
    left(p_grp, 20), left(p_meal, 20),
    case when p_attending then least(e.max_party, greatest(1, p_party)) else 0 end,
    case when p_attending then p_arrival else null end,
    case when jsonb_typeof(p_comp) = 'array' then p_comp else '[]'::jsonb end, left(p_note, 120));
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.rsvp_is_closed(public.events) from public;
grant execute on function public.rsvp_is_closed(public.events) to anon, authenticated;

-- Migration 3: abuse limits on guest answers (per connection, open link and personal link)
create table if not exists public.rsvp_hits (
  id bigserial primary key,
  event_id text not null,
  ip text not null,
  has_token boolean not null,
  token text,
  at timestamptz not null default now()
);
create index if not exists rsvp_hits_event_at on public.rsvp_hits(event_id, at);
alter table public.rsvp_hits enable row level security;
revoke all on public.rsvp_hits from anon, authenticated;
revoke all on sequence public.rsvp_hits_id_seq from anon, authenticated;

create or replace function public.submit_rsvp(p_event text, p_token text, p_name text, p_attending boolean,
  p_grp text, p_meal text, p_party int, p_arrival int, p_comp jsonb, p_note text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare e events; inv invitees; cnt int; v_ip text; hdr jsonb; n int;
begin
  select * into e from events where id = p_event;
  if not found then raise exception 'Event not found'; end if;
  if public.rsvp_is_closed(e) then raise exception 'RSVPs are closed'; end if;
  if p_token is not null and p_token <> '' then
    select * into inv from invitees where event_id = e.id and token = p_token;
    if not found then raise exception 'This invitation link is not valid'; end if;
  end if;

  -- Abuse limits (best effort, see docs/SECURITY.md): per connection, per open link, per personal link.
  begin hdr := nullif(current_setting('request.headers', true), '')::jsonb; exception when others then hdr := null; end;
  -- Edge-set headers only: cf-connecting-ip (a spoofed copy is rejected by the edge), then sb-forwarded-for, then the LAST x-forwarded-for entry. Never the first entry, which callers can fake.
  v_ip := md5(coalesce(nullif(trim(hdr->>'cf-connecting-ip'), ''), nullif(trim(hdr->>'sb-forwarded-for'), ''), nullif(trim(regexp_replace(coalesce(hdr->>'x-forwarded-for', ''), '^.*,', '')), ''), 'unknown'));
  perform pg_advisory_xact_lock(hashtext('rsvp:' || e.id));
  if random() < 0.05 then delete from rsvp_hits where at < now() - interval '2 hours'; end if;
  select count(*) into n from rsvp_hits where event_id = e.id and ip = v_ip and at > now() - interval '10 minutes';
  if n >= 150 then raise exception 'Too many answers from this connection. Please wait a few minutes and try again.'; end if;
  if inv.id is null then
    select count(*) into n from rsvp_hits where event_id = e.id and not has_token and at > now() - interval '10 minutes';
    if n >= 300 then raise exception 'This event is getting a lot of answers right now. Please try again shortly.'; end if;
  else
    select count(*) into n from rsvp_hits where event_id = e.id and token = inv.token and at > now() - interval '10 minutes';
    if n >= 8 then raise exception 'You have changed this answer many times. Please wait a few minutes.'; end if;
  end if;
  insert into rsvp_hits(event_id, ip, has_token, token) values (e.id, v_ip, inv.id is not null, inv.token);

  select count(*) into cnt from responses where event_id = e.id;
  if cnt >= 6000 then raise exception 'This event is full'; end if;
  if inv.id is not null then delete from responses where invitee_id = inv.id; end if;
  insert into responses(event_id, invitee_id, name, attending, grp, meal, party, arrival, companions, note)
  values (e.id, inv.id, left(coalesce(nullif(trim(p_name), ''), inv.name, 'Guest'), 40), p_attending,
    left(p_grp, 20), left(p_meal, 20),
    case when p_attending then least(e.max_party, greatest(1, p_party)) else 0 end,
    case when p_attending then p_arrival else null end,
    case when jsonb_typeof(p_comp) = 'array' then p_comp else '[]'::jsonb end, left(p_note, 120));
  return jsonb_build_object('ok', true);
end $$;

-- Migration 4: event banners. The original image (banner) shows on the guest page;
-- a watermarked 1200x630 copy (banner_og) is what WhatsApp/Facebook link previews load.
alter table public.events
  add column if not exists banner text check (char_length(banner) <= 500),
  add column if not exists banner_og text check (char_length(banner_og) <= 500);

create or replace function public.get_invite(p_event text, p_token text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare e events; inv invitees; done boolean := false;
begin
  select * into e from events where id = p_event;
  if not found then return null; end if;
  if p_token is not null then
    select * into inv from invitees where event_id = e.id and token = p_token;
    if found then select exists(select 1 from responses where invitee_id = inv.id) into done; end if;
  end if;
  return jsonb_build_object('id', e.id, 'title', e.title, 'occasion', e.occasion, 'date', e.event_date,
    'host', e.host_name, 'deadline', e.deadline, 'deadline_at', e.deadline_at, 'tz', e.tz,
    'venue', e.venue, 'message', e.message, 'max', e.max_party, 'time', e.default_time,
    'banner', e.banner, 'banner_og', e.banner_og,
    'invitee_name', inv.name, 'answered', done, 'closed', public.rsvp_is_closed(e));
end $$;

-- Banner images live in a public storage bucket; a host can only write inside a folder
-- named after an event they own. Reads are public because the bucket is public.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('banners', 'banners', true, 5242880, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists banners_owner_insert on storage.objects;
create policy banners_owner_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'banners' and exists (
    select 1 from public.events ev where ev.id = (storage.foldername(name))[1] and ev.owner = auth.uid()));
drop policy if exists banners_owner_update on storage.objects;
create policy banners_owner_update on storage.objects for update to authenticated
  using (bucket_id = 'banners' and exists (
    select 1 from public.events ev where ev.id = (storage.foldername(name))[1] and ev.owner = auth.uid()));
drop policy if exists banners_owner_delete on storage.objects;
create policy banners_owner_delete on storage.objects for delete to authenticated
  using (bucket_id = 'banners' and exists (
    select 1 from public.events ev where ev.id = (storage.foldername(name))[1] and ev.owner = auth.uid()));

-- Migration 5: adults and kids counted separately. party stays as the total so older
-- dashboards and exports keep working; older rows are backfilled as all-adults.
alter table public.responses
  add column if not exists adults int,
  add column if not exists kids int not null default 0 check (kids between 0 and 10);
update public.responses set adults = case when attending then greatest(1, least(10, party)) else 0 end where adults is null;
alter table public.responses alter column adults set not null;
alter table public.responses alter column adults set default 0;
alter table public.responses drop constraint if exists responses_adults_check;
alter table public.responses add constraint responses_adults_check check (adults between 0 and 10);

-- Migration 6: every answer carries a random edit token, so a guest who used the open
-- link can save a personal link and change their own answer later - and only their own.
alter table public.responses add column if not exists edit_token text not null default encode(gen_random_bytes(12), 'hex');
create unique index if not exists responses_edit_token on public.responses(edit_token);

drop function if exists public.get_invite(text, text);
create or replace function public.get_invite(p_event text, p_token text default null, p_edit text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare e events; inv invitees; done boolean := false; me responses;
begin
  select * into e from events where id = p_event;
  if not found then return null; end if;
  if p_token is not null then
    select * into inv from invitees where event_id = e.id and token = p_token;
    if found then select exists(select 1 from responses where invitee_id = inv.id) into done; end if;
  end if;
  -- A saved edit link returns that guest's own answer, and nothing about anyone else.
  if p_edit is not null and p_edit <> '' then
    select * into me from responses where event_id = e.id and edit_token = p_edit;
    if found then done := true; end if;
  end if;
  return jsonb_build_object('id', e.id, 'title', e.title, 'occasion', e.occasion, 'date', e.event_date,
    'host', e.host_name, 'deadline', e.deadline, 'deadline_at', e.deadline_at, 'tz', e.tz,
    'venue', e.venue, 'message', e.message, 'max', e.max_party, 'time', e.default_time,
    'banner', e.banner, 'banner_og', e.banner_og,
    'invitee_name', coalesce(inv.name, me.name), 'answered', done, 'closed', public.rsvp_is_closed(e),
    'my_attending', me.attending, 'my_party', me.party, 'my_adults', me.adults, 'my_kids', me.kids,
    'my_grp', me.grp, 'my_meal', me.meal, 'my_arrival', me.arrival, 'my_comp', me.companions, 'my_note', me.note);
end $$;

create or replace function public.submit_rsvp(p_event text, p_token text, p_name text, p_attending boolean,
  p_grp text, p_meal text, p_party int, p_arrival int, p_comp jsonb, p_note text, p_adults int, p_kids int, p_edit text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare e events; inv invitees; cnt int; v_ip text; hdr jsonb; n int; v_adults int; v_kids int; me responses; v_edit text;
begin
  select * into e from events where id = p_event;
  if not found then raise exception 'Event not found'; end if;
  if public.rsvp_is_closed(e) then raise exception 'RSVPs are closed'; end if;
  if p_token is not null and p_token <> '' then
    select * into inv from invitees where event_id = e.id and token = p_token;
    if not found then raise exception 'This invitation link is not valid'; end if;
  end if;
  if p_edit is not null and p_edit <> '' then
    select * into me from responses where event_id = e.id and edit_token = p_edit;
    if not found then raise exception 'This invitation link is not valid'; end if;
  end if;

  -- Abuse limits (best effort, see docs/SECURITY.md): per connection, per open link, per personal link.
  begin hdr := nullif(current_setting('request.headers', true), '')::jsonb; exception when others then hdr := null; end;
  -- Edge-set headers only: cf-connecting-ip (a spoofed copy is rejected by the edge), then sb-forwarded-for, then the LAST x-forwarded-for entry. Never the first entry, which callers can fake.
  v_ip := md5(coalesce(nullif(trim(hdr->>'cf-connecting-ip'), ''), nullif(trim(hdr->>'sb-forwarded-for'), ''), nullif(trim(regexp_replace(coalesce(hdr->>'x-forwarded-for', ''), '^.*,', '')), ''), 'unknown'));
  perform pg_advisory_xact_lock(hashtext('rsvp:' || e.id));
  if random() < 0.05 then delete from rsvp_hits where at < now() - interval '2 hours'; end if;
  select count(*) into n from rsvp_hits where event_id = e.id and ip = v_ip and at > now() - interval '10 minutes';
  if n >= 150 then raise exception 'Too many answers from this connection. Please wait a few minutes and try again.'; end if;
  if inv.id is null and me.id is null then
    select count(*) into n from rsvp_hits where event_id = e.id and not has_token and at > now() - interval '10 minutes';
    if n >= 300 then raise exception 'This event is getting a lot of answers right now. Please try again shortly.'; end if;
  else
    select count(*) into n from rsvp_hits where event_id = e.id and token = coalesce(inv.token, p_edit) and at > now() - interval '10 minutes';
    if n >= 8 then raise exception 'You have changed this answer many times. Please wait a few minutes.'; end if;
  end if;
  insert into rsvp_hits(event_id, ip, has_token, token) values (e.id, v_ip, inv.id is not null or me.id is not null, coalesce(inv.token, p_edit));

  select count(*) into cnt from responses where event_id = e.id;
  if cnt >= 6000 then raise exception 'This event is full'; end if;
  -- Adults at least 1 when attending; kids trimmed first if the party passes the host's limit.
  v_adults := case when p_attending then least(e.max_party, 10, greatest(1, coalesce(p_adults, p_party, 1))) else 0 end;
  v_kids := case when p_attending then least(10, greatest(0, coalesce(p_kids, 0))) else 0 end;
  if p_attending and v_adults + v_kids > e.max_party then v_kids := e.max_party - v_adults; end if;
  if inv.id is not null then delete from responses where invitee_id = inv.id; end if;
  if me.id is not null then delete from responses where id = me.id; end if;
  insert into responses(event_id, invitee_id, name, attending, grp, meal, party, adults, kids, arrival, companions, note)
  values (e.id, inv.id, left(coalesce(nullif(trim(p_name), ''), inv.name, me.name, 'Guest'), 40), p_attending,
    left(p_grp, 20), left(p_meal, 20),
    case when p_attending then v_adults + v_kids else 0 end, v_adults, v_kids,
    case when p_attending then p_arrival else null end,
    case when jsonb_typeof(p_comp) = 'array' then p_comp else '[]'::jsonb end, left(p_note, 120))
  returning edit_token into v_edit;
  return jsonb_build_object('ok', true, 'edit', v_edit);
end $$;

-- Older pages (a guest who opened the invite before this update) still call the 10-argument
-- shape; keep it as a wrapper that counts everyone as adults.
create or replace function public.submit_rsvp(p_event text, p_token text, p_name text, p_attending boolean,
  p_grp text, p_meal text, p_party int, p_arrival int, p_comp jsonb, p_note text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  return public.submit_rsvp(p_event, p_token, p_name, p_attending, p_grp, p_meal, p_party, p_arrival, p_comp, p_note, null, null, null);
end $$;

revoke all on function public.get_invite(text, text, text), public.submit_rsvp(text, text, text, boolean, text, text, int, int, jsonb, text, int, int, text) from public;
grant execute on function public.get_invite(text, text, text), public.submit_rsvp(text, text, text, boolean, text, text, int, int, jsonb, text, int, int, text) to anon, authenticated;

-- Migration 7: banner owners must be able to SELECT their storage rows. Supabase storage
-- internally SELECTs the object before UPDATE/DELETE/upsert, so without this policy those
-- operations fail even though INSERT works. Public reads go through the public bucket URL
-- and do not need a policy.
drop policy if exists banners_owner_select on storage.objects;
create policy banners_owner_select on storage.objects for select to authenticated
  using (bucket_id = 'banners' and exists (
    select 1 from public.events ev where ev.id = (storage.foldername(name))[1] and ev.owner = auth.uid()));

-- Migration 8: super-admin dashboard. Exactly one seeded owner role, server-enforced:
-- every admin read goes through a security-definer function that checks the role first
-- and records the call in an audit log. Clients can never query other users' data
-- directly; the frontend only calls these functions. No admin write/delete actions
-- exist yet - the dashboard is read-only plus its audit trail.

create table if not exists public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role = 'admin'),
  created_at timestamptz not null default now()
);
alter table public.user_roles enable row level security;
drop policy if exists user_roles_read_own on public.user_roles;
create policy user_roles_read_own on public.user_roles for select to authenticated
  using (auth.uid() = user_id);

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'admin')
$$;

insert into public.user_roles (user_id, role)
  select id, 'admin' from auth.users where lower(email) = 'anuragroy485@gmail.com'
  on conflict (user_id) do nothing;

create table if not exists public.admin_audit_log (
  id bigint generated always as identity primary key,
  actor uuid not null,
  action text not null,
  detail jsonb not null default '{}',
  created_at timestamptz not null default now()
);
alter table public.admin_audit_log enable row level security;
drop policy if exists admin_audit_read on public.admin_audit_log;
create policy admin_audit_read on public.admin_audit_log for select to authenticated
  using (public.is_admin());

create or replace function public.admin_overview() returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null or not public.is_admin() then raise exception 'not authorized'; end if;
  insert into public.admin_audit_log (actor, action) values (v_uid, 'admin_overview');
  return jsonb_build_object(
    'totals', jsonb_build_object(
      'users', (select count(*) from auth.users),
      'events', (select count(*) from public.events),
      'guests', (select count(*) from public.invitees),
      'answers', (select count(*) from public.responses),
      'banners', (select count(*) from public.events where banner is not null)),
    'users', (select coalesce(jsonb_agg(u order by u.created_at desc), '[]'::jsonb) from (
      select au.id, au.email, au.created_at, au.last_sign_in_at,
        (select count(*) from public.events e where e.owner = au.id) as events
      from auth.users au order by au.created_at desc limit 100) u),
    'events', (select coalesce(jsonb_agg(v order by v.created_at desc), '[]'::jsonb) from (
      select e.id, e.title, e.event_date, e.created_at, e.host_name,
        (select email from auth.users au where au.id = e.owner) as host_email,
        (select count(*) from public.invitees i where i.event_id = e.id) as guests,
        (select count(*) from public.responses r where r.event_id = e.id) as answers,
        (select count(*) from public.responses r where r.event_id = e.id and r.attending) as coming,
        (e.banner is not null) as has_banner
      from public.events e order by e.created_at desc limit 200) v));
end $$;

create or replace function public.admin_audit() returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null or not public.is_admin() then raise exception 'not authorized'; end if;
  return (select coalesce(jsonb_agg(l order by l.created_at desc), '[]'::jsonb) from (
    select actor, action, detail, created_at from public.admin_audit_log order by created_at desc limit 200) l);
end $$;

revoke all on function public.is_admin(), public.admin_overview(), public.admin_audit() from public;
grant execute on function public.is_admin(), public.admin_overview(), public.admin_audit() to authenticated;

-- Migration 9: super-admin CRUD. Every mutation is a security-definer function that
-- checks the admin role, validates input, writes an audit row (with what changed),
-- and only then acts. Guards: an admin cannot delete their own account or another
-- admin; display-name and event edits keep the same limits as the public tables.
-- Passwords are never readable or writable here (Supabase Auth stores hashes only).

create or replace function public.admin_update_user(p_user_id uuid, p_name text) returns void
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_email text;
begin
  if v_uid is null or not public.is_admin() then raise exception 'not authorized'; end if;
  if p_name is null or char_length(trim(p_name)) = 0 or char_length(p_name) > 40 then
    raise exception 'name must be 1-40 characters'; end if;
  update auth.users set raw_user_meta_data = coalesce(raw_user_meta_data,'{}'::jsonb) || jsonb_build_object('name', trim(p_name)),
    updated_at = now() where id = p_user_id returning email into v_email;
  if v_email is null then raise exception 'user not found'; end if;
  insert into public.admin_audit_log (actor, action, detail) values (v_uid, 'admin_update_user', jsonb_build_object('user', v_email, 'name', trim(p_name)));
end $$;

create or replace function public.admin_delete_user(p_user_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_email text;
begin
  if v_uid is null or not public.is_admin() then raise exception 'not authorized'; end if;
  if p_user_id = v_uid then raise exception 'you cannot delete your own account from here'; end if;
  if exists (select 1 from public.user_roles where user_id = p_user_id) then
    raise exception 'cannot delete an admin account'; end if;
  delete from auth.users where id = p_user_id returning email into v_email;
  if v_email is null then raise exception 'user not found'; end if;
  insert into public.admin_audit_log (actor, action, detail) values (v_uid, 'admin_delete_user', jsonb_build_object('user', v_email));
end $$;

create or replace function public.admin_update_event(p_event_id text, p_title text, p_occasion text, p_event_date date, p_host_name text) returns void
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null or not public.is_admin() then raise exception 'not authorized'; end if;
  if p_title is null or char_length(trim(p_title)) = 0 or char_length(p_title) > 80 then
    raise exception 'title must be 1-80 characters'; end if;
  if p_occasion is null or char_length(trim(p_occasion)) = 0 or char_length(p_occasion) > 40 then
    raise exception 'occasion must be 1-40 characters'; end if;
  if p_event_date is null then raise exception 'date is required'; end if;
  if p_host_name is not null and char_length(p_host_name) > 40 then
    raise exception 'host name must be at most 40 characters'; end if;
  update public.events set title = trim(p_title), occasion = trim(p_occasion), event_date = p_event_date,
    host_name = nullif(trim(coalesce(p_host_name,'')),'') where id = p_event_id;
  if not found then raise exception 'event not found'; end if;
  insert into public.admin_audit_log (actor, action, detail) values (v_uid, 'admin_update_event', jsonb_build_object('event', p_event_id, 'title', trim(p_title)));
end $$;

create or replace function public.admin_delete_event(p_event_id text) returns void
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_title text;
begin
  if v_uid is null or not public.is_admin() then raise exception 'not authorized'; end if;
  select title into v_title from public.events where id = p_event_id;
  if v_title is null then raise exception 'event not found'; end if;
  begin
    delete from storage.objects where bucket_id = 'banners' and (storage.foldername(name))[1] = p_event_id;
  exception when others then null; -- storage rows may not be SQL-deletable; orphan bytes are acceptable
  end;
  delete from public.events where id = p_event_id;
  insert into public.admin_audit_log (actor, action, detail) values (v_uid, 'admin_delete_event', jsonb_build_object('event', p_event_id, 'title', v_title));
end $$;

revoke all on function public.admin_update_user(uuid, text), public.admin_delete_user(uuid),
  public.admin_update_event(text, text, text, date, text), public.admin_delete_event(text) from public;
grant execute on function public.admin_update_user(uuid, text), public.admin_delete_user(uuid),
  public.admin_update_event(text, text, text, date, text), public.admin_delete_event(text) to authenticated;

-- Migration 10: readable admin overview and activity. Users carry their display name
-- and a test flag (automated-check accounts use @example.com addresses) so the admin
-- page can separate real hosts from test data without hiding or renaming anything.
-- The audit function also returns the actor's email (left join: a deleted account
-- still shows its recorded action, with no email).
create or replace function public.admin_overview() returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null or not public.is_admin() then raise exception 'not authorized'; end if;
  insert into public.admin_audit_log (actor, action) values (v_uid, 'admin_overview');
  return jsonb_build_object(
    'totals', jsonb_build_object(
      'users', (select count(*) from auth.users),
      'test_users', (select count(*) from auth.users where email ilike '%@example.com'),
      'events', (select count(*) from public.events),
      'guests', (select count(*) from public.invitees),
      'answers', (select count(*) from public.responses),
      'banners', (select count(*) from public.events where banner is not null)),
    'users', (select coalesce(jsonb_agg(u order by u.created_at desc), '[]'::jsonb) from (
      select au.id, au.email, au.raw_user_meta_data->>'name' as name, au.created_at, au.last_sign_in_at,
        (au.email ilike '%@example.com') as is_test,
        (select count(*) from public.events e where e.owner = au.id) as events
      from auth.users au order by au.created_at desc limit 100) u),
    'events', (select coalesce(jsonb_agg(v order by v.created_at desc), '[]'::jsonb) from (
      select e.id, e.title, e.occasion, e.event_date, e.created_at, e.host_name,
        (select email from auth.users au where au.id = e.owner) as host_email,
        (select count(*) from public.invitees i where i.event_id = e.id) as guests,
        (select count(*) from public.responses r where r.event_id = e.id) as answers,
        (select count(*) from public.responses r where r.event_id = e.id and r.attending) as coming,
        (e.banner is not null) as has_banner
      from public.events e order by e.created_at desc limit 200) v));
end $$;

create or replace function public.admin_audit() returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null or not public.is_admin() then raise exception 'not authorized'; end if;
  return (select coalesce(jsonb_agg(l order by l.created_at desc), '[]'::jsonb) from (
    select a.actor, a.action, a.detail, a.created_at, au.email as actor_email
    from public.admin_audit_log a left join auth.users au on au.id = a.actor
    order by a.created_at desc limit 200) l);
end $$;

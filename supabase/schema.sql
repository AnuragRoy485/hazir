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

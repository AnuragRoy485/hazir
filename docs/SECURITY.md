# Security model

## Who can do what

| Actor | Events | Invitees | Responses |
|---|---|---|---|
| Signed-in host | read/write own only | read/write own events only | read/write own events only |
| Anonymous visitor | no table access | no table access | no table access |
| Guest via RSVP link | `get_invite` (title, date, host, deadline) | own name when a valid token is used | `submit_rsvp` (write only) |

Enforced in the database (`supabase/schema.sql`), not in the browser. The browser code is untrusted.

## Checks in `tests/e2e.mjs`

- Another host gets empty results for the owner's events, invitees and responses, and cannot update the event.
- Anonymous requests to the tables are denied.
- `get_invite` returns no guest names or answers.
- A forged personal token is rejected.

## Abuse limits

Checked by `node tests/abuse.mjs` against the real backend: a normal answer works, a personal link is slowed after repeated changes, a faked x-forwarded-for does not dodge the limit, 170 parallel answers from one connection are cut off at exactly 150, and the limit table cannot be read by guests.

## Keys

The publishable key is public. The service role key and database password must never be committed or put in client code.

## Open items

- No CAPTCHA. Guest answers have best-effort limits inside `submit_rsvp`: 150 answers per connection per event per 10 minutes, 300 answers per event per 10 minutes through the open link, and 8 changes per personal link per 10 minutes, plus the 6000-per-event cap. The limits are deliberately loose so a big event on one venue Wi-Fi or one mobile carrier address is not blocked, which also means they only stop floods, not a slow or distributed attacker. The connection address is taken from edge headers (cf-connecting-ip, then sb-forwarded-for, then the last x-forwarded-for entry). A caller-supplied x-forwarded-for entry is ignored and a spoofed cf-connecting-ip is rejected by the edge (checked on 27 Oct 2026), but this is how Supabase's proxy behaves today, not a documented guarantee, so treat the address as unverified. Counting is serialised per event with an advisory lock, so parallel requests cannot overshoot. Hosts can close RSVPs at any time.
- Email verification and password reset are off, because no mail provider is configured.
- Add a Content-Security-Policy once fonts and assets are final.

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

Checked by `node tests/abuse.mjs` against the real backend: a normal answer works, a personal link is slowed after repeated changes, one connection is stopped after about 30 answers, and the limit table cannot be read by guests.

## Keys

The publishable key is public. The service role key and database password must never be committed or put in client code.

## Open items

- No CAPTCHA. Guest answers have best-effort limits inside `submit_rsvp`: about 30 answers per connection per event per 10 minutes, 100 answers per event per 10 minutes through the open link, and 8 changes per personal link per 10 minutes. The connection is read from the proxy's forwarded address, so people behind one shared network share a budget, and a determined attacker with many addresses can still add answers (capped at 6000 per event). Hosts can close RSVPs at any time.
- Email verification and password reset are off, because no mail provider is configured.
- Add a Content-Security-Policy once fonts and assets are final.

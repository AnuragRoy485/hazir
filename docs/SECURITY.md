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

## Keys

The publishable key is public. The service role key and database password must never be committed or put in client code.

## Open items

- No CAPTCHA or per-IP rate limit on guest RSVPs (free tier).
- Email verification and password reset are off, because no mail provider is configured.
- Add a Content-Security-Policy once fonts and assets are final.

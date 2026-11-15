# Contributing to Hazir

Thanks for helping make RSVPs honest. Hazir is a small, dependency-free project on purpose - keep it that way.

## Ground rules

- **No frameworks, no build step beyond `scripts/bump-assets.mjs`.** Plain HTML, CSS and JavaScript modules. Vendor libraries live in `assets/vendor/`.
- **Design is black and white, Georgia, calm motion.** Match it. Nothing bouncy.
- **Guests are anonymous and protected.** Anything a guest can reach goes through a locked `security definer` function in `supabase/schema.sql` - never a direct table read. Keep that boundary.
- **Free tier only.** Everything must run on Supabase and Vercel free plans, with no paid service.

## Set up

1. Fork and clone the repo.
2. Serve the folder statically (`npx serve .` or any static server).
3. The app points at the production Supabase project with a publishable key; guest writes go through rate-limited functions. For deeper work, create your own free Supabase project, run `supabase/schema.sql` in its SQL editor, and update `src/lib/config.js` locally (do not commit your keys).

## Test

- `node --check` every changed `.js` file.
- Run through the guest flow end to end: create event, open invite link, answer yes/no, edit answer, delete answer.
- If you change `supabase/schema.sql`, see `tests/` for the e2e and abuse suites.

## Good first issues

Look for the `good first issue` label on GitHub. Suggested first contributions: new RSVP page languages, more occasion presets, accessibility audits.

## License

MIT + Commons Clause (see LICENSE): you can use, modify and self-host Hazir, but you cannot sell it.

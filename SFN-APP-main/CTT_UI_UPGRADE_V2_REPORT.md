# CTT Sky First UI Upgrade — V2 Implementation Notes

## Changes made
- Refreshed the public homepage hero to a dark navy / electric blue technology style.
- Kept the existing `public/assets/sfn-logo.png` byte-for-byte unchanged; no logo redraw or AI transformation.
- Added a four-card homepage statistics strip.
- Added Admin settings for homepage stats source (D1 or manual), four manual values, animation duration, and animation cycle count (1–100; default 100).
- Saved the stats configuration through the existing `/api/admin/settings` endpoint, preserving existing `settings.manage` permission checks and audit logging.
- Exposed public `home_stats` configuration through `/api/config`; D1 counts are queried only when source is set to `d1`.
- D1 metrics currently count classes + events, active users, issued certificates with `issued_at`, and units not marked dissolved.
- Added responsive styling for hero, statistics cards, orbit/feature labels, and ecosystem unit cards.
- Updated ecosystem display names to:
  1. Trang Thông Tin Điện Tử Sky First
  2. Trung Tâm TNV Sky First
  3. SFEC – Sky First Education Club
  4. Sky First Learning Center
- Changed homepage support mail links/default support email to `ctt@skyfirst.io.vn`.

## Validation performed
- `node scripts/validate.mjs` — passed.
- `node --check` on all `src/*.js`, `public/*.js`, and `scripts/*.mjs` — passed.
- Executed the four D1 count queries against a local SQLite database initialized from `migrations/0001_schema.sql` — all queries executed successfully.
- Confirmed `public/assets/sfn-logo.png` is byte-for-byte unchanged from the input ZIP.

## Important limitations
- No production deployment was performed.
- No live Cloudflare D1/R2 bindings, real user sessions, external email delivery, OAuth, Turnstile, or browser-based end-to-end tests were available in this validation run.
- D1 counts are based on the current schema. Before enabling D1 mode in production, confirm the business definitions for each metric. In particular, the current `members` metric counts active `users`, and `programs` counts rows in `classes` plus `events`; these may not exactly match public-facing business definitions.
- The homepage counter cycles are browser animation only; they do not write to D1. The default source is D1 (to avoid presenting sample values as real by default); the default is 100 cycles and the counter holds at its target after the last cycle. Manual defaults shown in Admin are examples and should be replaced with approved values before selecting manual mode.

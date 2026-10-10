# SFN-APP CTT V3 — Audit Fix Package

## Changes in this package
- Public statistic cards show `Chưa có dữ liệu` rather than a lone dash when the D1 source has no usable value; actual D1 values are still used when returned.
- Adjusted hero/statistics/quick-access spacing to prevent overlap and clipping.
- Added responsive layout rules for tablet/mobile.
- Added distinct cyan, violet, mint and amber accents to modules so the website is not a single flat blue.
- Admin navigation now saves and restores scroll position when switching admin sections, so the page does not jump back to the top automatically.
- Existing backend routes, API contracts, D1/R2 bindings, authentication and RBAC were not intentionally rewritten.

## Verification performed
- Ran `node scripts/validate.mjs`: `SFN Production Master validation: OK`.
- Ran `node --check` on `public/app.js`, `public/digital-portal.js`, `src/public.js`, `src/admin.js`, and `src/index.js`: all passed.
- Parsed all SQL migrations in this ZIP in an in-memory SQLite database.
- Verified the four configured statistic queries against the local migration schema:
  - classes + events
  - active users
  - issued certificates
  - active units

## Not done / not claimed
- No SQL was run against Cloudflare production D1.
- No production deployment was performed.
- No end-to-end browser test against the live site was performed.
- Admin scroll restoration, visual spacing and D1 values still require browser testing against the deployed version and the actual production schema.

## Acceptance checklist
1. Compare live deployment with this source ZIP.
2. Confirm actual D1 counts and the definitions of each statistic.
3. Test Admin navigation preserves scroll position across sections.
4. Test desktop/tablet/mobile layout and check that cards never overlap.
5. Verify the official logo asset is used unchanged in production.
6. Run staging end-to-end and regression tests before deploying to production.

# SFN-APP CTT V4 — UI Consistency & Cache Update

## Updated
- Unified public-facing design tokens and component treatment across the portal: navy technology hero, cyan/blue highlights, violet/mint/amber accents, glass-style surfaces, consistent borders, spacing, hover and focus states.
- Refined the digital utilities section and quick-access cards to align more closely with the supplied visual direction without replacing the official logo asset.
- Added versioned URLs for stylesheets and public modules so deployed browsers request the updated files instead of reusing older cached URLs.
- Updated the service worker cache version and changed navigation plus CSS/JS asset fetching to network-first with offline cache fallback.
- Registered the service worker with `updateViaCache: none` and requested an update automatically. A controller change can trigger a single guarded reload so the newly deployed shell is applied without asking users to press Ctrl+Shift+R.

## Validation
- `node scripts/validate.mjs`: passed (`SFN Production Master validation: OK`).
- `node --check`: passed for `public/app.js`, `public/digital-portal.js`, `public/bootstrap.js`, `public/sw.js`, `src/public.js`, `src/admin.js`, `src/index.js`.

## Important limitations
- This is a source ZIP update only; it has not been deployed to Cloudflare.
- No SQL was run and no production D1/R2 data was changed.
- A live browser test is still needed to verify all routes and the service-worker update behavior on the deployed domain. The browser cannot update until this package is actually deployed.
- If an upstream CDN or Cloudflare cache has a custom rule caching HTML/service-worker files aggressively, verify its cache policy during deployment.

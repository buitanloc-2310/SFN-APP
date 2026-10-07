# STATIC VALIDATION REPORT — 2026-10-07

## PASS trong môi trường làm việc

- `node --check` PASS cho toàn bộ `src/*.js`, `public/*.js`, `scripts/*.mjs`.
- `node scripts/validate.mjs` → `SFN Production Master validation: OK`.
- Chạy tuần tự toàn bộ 6 file migration trên SQLite in-memory: PASS, tạo 47 tables.
- Xác nhận migration mới có các cột/bảng trọng tâm: credential public/legacy/supersede/revoke/snapshot; file sha256/upload_state; submission next_action/result; case_events; upload_sessions; form_revisions; portal_events.
- Public index không còn text/navigation Login/Học viên/Thành viên/TNV.
- Public index không eager-load `app.js`; initial scripts là `digital-portal.js` + `bootstrap.js`.
- Credential registry code path có random 5-digit ID + collision check và legacy lookup.
- Upload session code path + R2 finalize + no-store lookup guards hiện diện.

## Payload tĩnh tham khảo

- `public/bootstrap.js`: ~1.6 KB
- `public/digital-portal.js`: ~32 KB
- `public/digital.css`: ~36 KB
- `public/styles.css`: ~22 KB
- `public/app.js` (lazy-loaded khi Admin/Form cần): ~132 KB

## CHƯA được coi là PASS

Headless Chromium trong sandbox bị timeout, vì vậy **không** đánh dấu browser smoke test là PASS. Cũng chưa có Cloudflare staging bindings thật trong môi trường này, nên chưa xác minh end-to-end D1/R2/email/Turnstile/OAuth, upload qua mạng thật, camera QR, mobile signature, Cache API hit/invalidation, Lighthouse/WCAG automated audit hoặc backup/restore production-like.

Các mục này bắt buộc thực hiện theo `docs/PRODUCTION_CHECKLIST.md` trước khi gọi bản deploy là Production PASS.

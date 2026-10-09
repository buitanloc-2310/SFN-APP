# SFEC V3 — Independent English Club Portal

This build keeps the Cloudflare Workers/D1/R2 backend architecture but rebuilds the public product around SFEC's own English Club ecosystem.

## Public journeys
- Học viên — all SFEC classes, no IELTS.
- Thành viên SFEC — 16+.
- TNV Dạy học — 18+.
- Core Ban Nội dung — 18+.
- Core Ban Truyền thông — 18+.
- Cố vấn SFEC.

## SFEC class catalog
Lớp 9, Lớp 10, Lớp 11, Lớp 12, A1–A2, B1–B2, Tiếng Anh Giao tiếp, Từ vựng.

## Existing deployed database
Run `migrations/0003_sfec_ecosystem.sql` exactly once after deploying V3. Do not rerun 0001/0002 on an existing database.

## Domain
`https://sfec.skyfirst.io.vn`

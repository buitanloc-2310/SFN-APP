# MASTER UPGRADE 2026-10 — SKY FIRST DIGITAL INFORMATION INFRASTRUCTURE

## Kiến trúc đã triển khai trong source

Public portal được chuyển từ tư duy account/dashboard sang **Information × Discovery × Programs × Activities × Services × Forms × Cases × Credentials × Verification × Resources × Support**. `public/index.html` giữ semantic hero/quick actions ngay cả trước khi JS render; `public/digital-portal.js` đảm nhiệm discovery/search/lookup; `public/bootstrap.js` lazy-load `app.js` chỉ khi Admin/Login/Form engine cần.

Backend giữ Cloudflare Worker/D1/R2, không rewrite framework. `migrations/0005_digital_information_infrastructure.sql` bổ sung case events, upload sessions, file hash metadata, immutable credential state, supersede/revoke links, form revisions/drafts và privacy-light portal analytics.

Credential Registry dùng ID mới ngẫu nhiên 5 số `SFN-{GCN|GXN|BK}-#####`, đồng thời lookup `code/public_id/legacy_code`. Issue tạo immutable snapshot; revoke/supersede là state transition, không save đè mã đã phát hành.

Form pipeline dùng `FORM → SUBMISSION → CASE → WORKFLOW → RESULT → CREDENTIAL`. Upload session tách upload object khỏi request submit; chữ ký là R2 asset và không được mô tả là chữ ký số được chứng thực. Minor Mode chỉ kích hoạt guardian section khi DOB cho thấy người tham gia dưới 18 tuổi.

Public content API được cache bằng Cloudflare Cache API; Admin content/settings/forms/modules invalidate route cache liên quan. Credential/case lookup đặt `no-store`.

## Điểm không cố tình thêm

- Không AI chatbot/avatar/human hero.
- Không blockchain.
- Không đổi sang React/WebGL chỉ để “hiện đại”.
- Không thêm Queue/Durable Object khi tác vụ hiện tại chưa bắt buộc; email hậu xử lý dùng `ctx.waitUntil` để không block form submit.
- Không public account registration.

## Trạng thái kiểm thử trong gói này

Đã chạy syntax validation cho Worker/frontend JS, validate script và migration SQLite sequential test trong môi trường làm việc. Chưa tuyên bố Production PASS vì chưa chạy Cloudflare staging có bindings D1/R2 thật, browser/device matrix, email provider và real network upload. Checklist bắt buộc nằm tại `docs/PRODUCTION_CHECKLIST.md`.

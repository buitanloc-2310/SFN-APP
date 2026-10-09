# Release 2.0.0 — Long-term Final

Ngày đóng gói: 2026-09-03.

Các lỗi trọng yếu được xử lý trong release này:
- Đồng bộ API CV thành viên (`/api/me/cv`).
- Đồng bộ API thẻ (`/api/me/cards`) và quá trình công tác (`/api/me/history`).
- Sửa cập nhật hồ sơ thành viên dùng đúng `/api/me`.
- Đưa route chỉnh sửa/ngừng/ẩn/hiện membership ra đúng scope backend, không còn route unreachable.
- Bổ sung lifecycle thật cho goal/task/activity/certificate/achievement/card/document/scope và nút tương ứng ở Admin Member Detail.
- Bổ sung route duyệt/từ chối GCN ngoài hệ thống.
- Ẩn hoạt động/thành tích/tài liệu đã ẩn khỏi giao diện thành viên.
- Bổ sung `account_request_profiles` bằng migration 0008 để lưu học tập/công tác của đơn đăng ký mà không ALTER bảng production cũ.
- Cache-bust app.js/styles.css trong index để giảm khả năng trình duyệt giữ frontend cũ sau deploy.
- Thêm script kiểm tra release và cảnh báo không chạy bootstrap SQL cũ trên production.

Release đã qua:
- `node --check public/app.js`
- `node --check src/index.js`
- áp dụng toàn bộ migrations lên SQLite trống
- compile/EXPLAIN 144 SQL statement tĩnh từ Worker trên schema sau migration
- kiểm tra binding D1/R2/Worker trong `wrangler.jsonc`
- kiểm tra các endpoint CV/history/cards và route lifecycle trọng yếu.

Lưu ý: kiểm tra local/static không thể thay thế smoke test trên Cloudflare production với dữ liệu thật. Sau deploy, dùng checklist trong README để test một hồ sơ thử trước khi vận hành rộng.


## v2 hotfix — Account requests
- Tự tạo bảng phụ `account_request_profiles` nếu production D1 chưa chạy migration 0008.
- Sửa lỗi `REQUEST_FAILED` tại trang Yêu cầu cấp tài khoản.
- Áp dụng self-heal cho gửi yêu cầu công khai, danh sách quản trị và thao tác duyệt/từ chối/yêu cầu bổ sung.


## Long-term final v3 — 2026-09-03
- Thêm tab Đánh giá thành viên, permission + scope, draft/final/hidden và audit.
- Thành viên có mục Đánh giá của tôi cho đánh giá đã chốt và được công khai.
- Thẻ quản trị có ảnh thành viên, nút xác minh và In/Xuất PDF.
- Trang xác minh thẻ hiển thị ảnh, thời hạn và trạng thái; không công khai CCCD/địa chỉ/email/SĐT.
- Thêm SUPER_ADMIN Center với dashboard tài khoản/hệ thống và công cụ kiểm tra ROLE + SCOPE + PERMISSION.
- Migration 0009 chỉ bổ sung bảng/quyền, không tạo lại D1/R2 và không xóa dữ liệu production.


## 2026-10-09 follow-up
- Card export actions download a two-page PDF directly (front/back on separate physical-size pages); user-facing image/SVG downloads removed.
- Card designer supports landscape 86 × 54 mm and portrait 54 × 86 mm.
- Critical evaluation, password-change, rate-limit, card-verification, and service-health fixes are recorded in `AUDIT_WEB_2026-10-08.md`.


## 2026-10-09 PDF/rendering follow-up
- Card face rendering now emits native SVG elements rather than HTML `foreignObject`, with uploaded/local assets embedded before rasterization.
- QR images now use a rate-limited same-origin endpoint that validates opaque tokens before proxying the QR render, avoiding browser-side CORS when generating PDFs.
- Added orientation-specific first-pass layout for both card faces; manual drag/drop remains available after the layout is applied.
- The front photo and QR are protected against deletion and are restored when a legacy card template lacks either element.
- Bulk membership-card issuance now records the Vietnam-local issue date.
- Integration tests confirm a one-time card cannot be looked up by its displayed card number; the opaque verification token is required.
- Existing saved card templates gain a front photo and QR fallback if either is missing; a back-side QR is displayed as a front-side verification note.
- The release verifier now checks PDF dimensions, orientation, password/email protections, public endpoint throttling, token-only card verification, and absence of legacy image-export controls.
- Validation: SVG parsed and rendered for both orientations; a generated sample PDF was inspected as two pages with 86 × 54 mm and 54 × 86 mm media boxes; `npm run build` and `npm test` pass.
- Scope limit: this does not constitute browser E2E testing with live Cloudflare D1/R2 or the deployed host.

## 2026-10-09 — Locked card back and navigation usability
- The back of both landscape and portrait member cards now receives the required Sky First validity/use instructions from the same canonical definition in the frontend and Worker API.
- Locked back-side text cannot be edited or dragged in Card Studio; backend save overwrites submitted versions of those fixed lines and rejects a QR element from being persisted on the back.
- The card footer font is kept consistent across UI/API templates and reduced to fit its print-width line.
- PDF generation encodes canvas output via `toBlob()` and keeps the two physical card faces on separate pages sized to the selected orientation.
- Card images preserve their proportions, and navigation sections can be collapsed independently while sidebar/content scroll positions are restored during a view render.
- Verification: `npm run build` and `npm test` pass, including 29/29 center/API integration checks. Cloudflare D1/R2 production and browser end-to-end behavior have not been verified in this package.

# CTT V5 — LƯU Ý BẢN GIAO GIAO DIỆN (10/10/2026)

> **Bản V5:** xem `CTT_V5_REFERENCE_IMPLEMENTATION_REPORT.md` để biết thay đổi, kiểm thử và giới hạn. V5 bổ sung giao diện theo 5 ảnh tham chiếu, liên kết chi tiết chương trình/sự kiện/tin tức, trang tiện ích và phiên bản cache mới.
>
> **Không phải gói HTML tĩnh để chỉ upload vào `public_html` iNET.** Mã nguồn này tiếp tục dùng Cloudflare Workers + D1 + R2 và các API hiện tại. Chuyển riêng phần frontend sang hosting tĩnh không tự chuyển backend/API/cơ sở dữ liệu.
>
> **V5 không có migration SQL mới.** Không chạy `npm run db:migrate` chỉ để áp dụng bản giao diện V5; giữ nguyên D1 đang dùng. Hãy kiểm tra staging/preview và bindings hiện tại trước khi deploy. Chưa có deploy production trong bản bàn giao này.

---

# CỔNG THÔNG TIN SỐ SKY FIRST — MASTER UPGRADE V2

**SKY FIRST DIGITAL INFORMATION PORTAL**  
Production domain: `https://ctt.skyfirst.io.vn`

Đây là source Cloudflare Worker + D1 + R2 được nâng cấp theo mô hình **Sky First Digital Information Infrastructure**. Public side là Information Hub/Discovery/Digital Services; hệ thống tài khoản công khai Học viên/Thành viên/TNV đã bị tắt. Chỉ **Administrator** được đăng nhập qua route quản trị riêng.

## Kiến trúc chính

- **Public Portal:** Home discovery-first, Mega Menu, Search Center, chương trình, hoạt động, tin tức, tài nguyên.
- **Credential Registry:** GCN/GXN/BK dùng registry chung; mã mới `SFN-GCN|GXN|BK-#####` ngẫu nhiên 5 số; mã legacy giữ nguyên.
- **Digital Case Center:** mã hồ sơ + lớp xác minh bổ sung, timeline, next action, result.
- **Form Center:** form builder, revision, conditional logic, multi-step/guided, upload, signature, minor mode, review trước submit, digital receipt.
- **Storage:** D1 chỉ giữ metadata/relationship/status/audit; R2 giữ file, ảnh, chữ ký, PDF/media.
- **Upload:** upload session → stream vào R2 → finalize metadata vào D1; file quan trọng có SHA-256 reference.
- **Admin:** Command Center, content, programs/activities, forms/cases, credentials, resources/media, support/system.
- **Resilience:** PWA-lite, offline shell, local draft recovery, semantic fallback, dedicated error states.
- **Performance:** public/admin code split; cache public API ở Cloudflare Cache API và invalidation khi CMS cập nhật.

## Route public

`/` · `/tra-cuu` · `/gcn` · `/gcn/{id}` · `/ho-so` · `/bieu-mau`

Admin không xuất hiện trong navigation public. Route quản trị: `/admin` và `/admin/login`.

## Trước khi deploy

1. `npm install`
2. `npm run validate`
3. Kiểm tra bindings `DB` và `FILES` trong `wrangler.jsonc`.
4. Chạy `npm run db:migrate` để áp dụng toàn bộ migration, đặc biệt `0005_digital_information_infrastructure.sql`.
5. Cấu hình secret email/OAuth/Turnstile nếu sử dụng.
6. Deploy staging trước, chạy checklist tại `docs/PRODUCTION_CHECKLIST.md`.
7. Chỉ sau khi staging pass mới đưa custom domain `ctt.skyfirst.io.vn` vào production.

## Lưu ý Administrator

Migration không phát sinh tài khoản public mới. Nếu đang nâng từ D1 hiện hữu, tài khoản quản trị hiện hữu được giữ nguyên. Nếu dựng D1 hoàn toàn mới, hãy thiết lập/reset mật khẩu quản trị bằng quy trình nội bộ an toàn trước khi công bố; **không đặt mật khẩu plaintext trong `public/`, source hoặc ZIP dùng để chia sẻ công khai**.

## Nguyên tắc phát hành

Không gọi bản deploy là **Production PASS** chỉ vì `npm run validate` thành công. Static validation chỉ xác nhận cấu trúc/syntax. D1/R2, upload thật, mobile signature, email, credential issue/revoke/supersede, case privacy, accessibility và performance phải được kiểm thử trên Cloudflare staging.

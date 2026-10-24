# BÁO CÁO KỸ THUẬT TỔNG THỂ — NÂNG CẤP TOÀN DIỆN HỆ THỐNG THÔNG TIN SỐ SKY FIRST (V10)

## 1. Tóm tắt điều hành (Executive Summary)

Báo cáo này ghi nhận kết quả thực thi chương trình nâng cấp toàn diện **Hệ thống Thông tin Số Sky First (`app.skyfirst.io.vn`)** từ bản nguồn `SFN-APP-V9-SKY-FIRST-SUPER-WEBSITE-REMEDIATED.zip` lên phiên bản **V10 Admin-Driven Super Website (`SFN-APP-V10-SKY-FIRST-SUPER-WEBSITE-UPGRADED.zip`)**. Toàn bộ quá trình tuân thủ nghiêm ngặt quy trình: **Kiểm toán toàn diện → Thiết kế tương thích ngược → Sửa mã nguồn & Bổ sung chức năng thực tế → Kiểm thử tự động 134 kịch bản E2E → Đóng gói bàn giao**.

| Chỉ số kỹ thuật & Chất lượng | Trước nâng cấp (V9) | Sau nâng cấp (V10) | Bằng chứng xác minh |
| :--- | :--- | :--- | :--- |
| **Kiểm tra tĩnh (`validate.mjs`)** | Pass (thiếu migration 0011) | **PASS (100%)** | `node scripts/validate.mjs` (Exit code `0`) |
| **Ánh xạ UI chuẩn (`validate-ui-reference.mjs`)** | 17/17 Pass | **17/17 PASS** | `node scripts/validate-ui-reference.mjs` (Exit code `0`) |
| **Tích hợp ký số Xanh (`validate-xanh-integration.mjs`)** | 6/6 Pass | **6/6 PASS** | `node scripts/validate-xanh-integration.mjs` (Exit code `0`) |
| **Kiểm thử tích hợp E2E (`test-all.mjs`)** | 76/76 Pass (138,4 giây) | **134/134 PASS (8,71 giây)** | `node scripts/test-all.mjs` (Exit code `0`) |
| **Dung lượng 4 ảnh thương hiệu (`public/assets/*.png`)** | 5.013.603 bytes (~5,01 MB) | **135.002 bytes (~135 KB, giảm 97,3%)** | Tối ưu hóa lossless bằng Pillow |
| **Quản trị CMS cho trang hệ thống** | 0 trang (hardcode trong JS) | **13/13 trang hệ thống + trang `/trang/...`** | Bảng `cms_pages` (`page_type='system'`) & `/api/config` |
| **Loại khối Visual Page Builder** | 10 khối cơ bản | **21 khối cấu trúc + Khối dùng chung + Mẫu trang** | `BLOCK_CATALOG` (`public/app.js`) & `renderVisualBlock` (`public/digital-portal.js`) |
| **Đa ngôn ngữ (VI / EN)** | Chỉ Tiếng Việt | **Song ngữ VI/EN toàn hệ thống, giữ nguyên dữ liệu form khi đổi ngôn ngữ** | `I18N_DICT` + `blocks_en_json` + `title_en` + `hreflang` |
| **Danh mục đa Website chuẩn** | Chứa `slc`, `tnv` cũ | **Chuẩn hóa đúng 7 cổng (`app`, `main`, `ctt`, `mail`, `member`, `sfec`, `exam`)** | Migration `0011` & `/api/admin/websites` |
| **Chế độ vận hành máy chủ** | 1 cờ `maintenance_mode` đơn lẻ | **6 chế độ vận hành cưỡng chế tại tầng Middleware/API + Pre-reopen Check** | `resolveOperationalState` (`src/index.js`) & `/api/admin/system/state` |

## 2. Kiến trúc hệ thống sau nâng cấp

Hệ thống vận hành trên kiến trúc hợp nhất **Cloudflare Workers + Cloudflare D1 (SQLite) + Cloudflare R2 + Static Assets SPA**:

1. **Tầng điều phối & Bảo mật biên (`src/index.js`)**:
   - Cưỡng chế 6 chế độ vận hành (`normal`, `manual_maintenance`, `scheduled_maintenance`, `emergency_maintenance`, `read_only`, `publishing_paused`) và trạng thái bảo trì riêng của từng website (`WEBSITE_MAINTENANCE`) ngay tại tầng máy chủ trước khi xử lý route.
   - Kiểm tra trạng thái bật/tắt phân hệ (`isModuleEnabled`) phía máy chủ: khi một phân hệ bị tắt trong Admin, các API của phân hệ đó lập tức trả về `403 MODULE_DISABLED`.
   - Kiểm soát quyền tải tài liệu PDF (`allow_download=false` trả về `403 DOWNLOAD_DISABLED` khi gọi `?download=1`, trong khi vẫn cho phép xem trực tuyến qua `Content-Disposition: inline`).
   - Phục vụ tự động `/robots.txt` và `/sitemap.xml` động từ danh sách đường dẫn công khai và các trang CMS đã xuất bản.
2. **Tầng xác thực & Phân quyền RBAC (`src/auth.js`, `src/permissions.js`)**:
   - Băm mật khẩu chuẩn **PBKDF2-HMAC-SHA256** (hỗ trợ tương thích ngược 150.000 vòng lặp và tự động nâng cấp lên 100.000 vòng lặp với salt mới khi đăng nhập thành công).
   - Bảo vệ chống vét cạn mã OTP 2FA (`attempt_count` tối đa 5 lần thử sai trên mỗi challenge token).
   - Cưỡng chế đổi mật khẩu bắt buộc (`must_change_password=1`) tại máy chủ đối với tài khoản quản trị mới được cấp phát.
   - Sửa triệt để lỗi truy vấn bảng `rate_limits` (`WHERE key IN (?, ?)` thay cho tên cột không tồn tại).
3. **Tầng nghiệp vụ Công khai & Tra cứu (`src/public.js`, `public/digital-portal.js`)**:
   - Bảo toàn trọn vẹn quy tắc mã chứng nhận 8 chữ số ngẫu nhiên (`SFN-GCN-########`, `SFN-GXN-########`, `SFN-BK-########`) và mã legacy.
   - Hỗ trợ tra cứu chứng nhận theo mã hoặc theo Email/Số điện thoại tại `/tra-cuu` và `/gcn` mà không làm lộ thông tin liên hệ cá nhân trong phản hồi JSON.
   - Tích hợp vùng hiển thị CMS động (`renderSystemPageCmsZone`) trên toàn bộ 13 trang hệ thống cùng 2 trang mới `/gioi-thieu` và `/ho-tro`.
   - Phân hệ Minh bạch Tài trợ (`/tai-tro`) hiển thị 5 chỉ số tài chính độc lập, 3 khu vực minh bạch và tạo mã **VietQR / EMVCo CRC-16** kèm ảnh QR SVG nội bộ (không gửi dữ liệu cá nhân ra dịch vụ bên ngoài).
4. **Tầng Quản trị Trung tâm (`src/admin.js`, `public/app.js`)**:
   - Khắc phục triệt để lỗi nhảy thanh cuộn menu trái (`.admin-nav`): giữ nguyên DOM của `.admin-sidebar` khi chuyển mục quản trị và lưu trữ `scrollTop`, trạng thái đóng/mở nhóm menu và từ khóa tìm kiếm trong `sessionStorage`.
   - Trình dựng trang trực quan hỗ trợ 21 loại khối, chỉnh sửa song ngữ VI/EN, quản lý Khối dùng chung (`cms_shared_blocks` có cảnh báo số trang bị ảnh hưởng và chặn xóa `409 SHARED_BLOCK_IN_USE`), quản lý Mẫu bố cục (`cms_templates`), hẹn giờ xuất bản (`scheduled_at`) và bộ chuyển đổi hai chiều **Headless WordPress / Gutenberg**.
   - Trang Quản trị Nhận diện & Design System (`/api/admin/design-system`), Quản lý Menu (`/api/admin/menus/:location`), Kiểm toán Thư viện Tài nguyên (`/api/admin/media/audit`), Trung tâm Sự cố (`/api/admin/system/incidents`), Kiểm tra Sức khỏe Sâu (`/api/admin/system/health`), Kiểm tra Trước Mở lại (`/api/admin/system/pre-reopen-check`) và Cổng Kiểm định Phát hành (`/api/admin/system/qa-check`).

## 3. Danh mục tệp đã tạo mới và nâng cấp

- **Migrations mới**:
  - `migrations/0010_forensic_security_and_financial_reconciliation.sql`
  - `migrations/0011_v10_admin_cms_i18n_governance.sql`
- **Mã nguồn Backend Worker**:
  - `src/index.js`, `src/utils.js`, `src/auth.js`, `src/public.js`, `src/admin.js`
- **Mã nguồn Frontend & Tài nguyên**:
  - `public/index.html`, `public/digital-portal.js`, `public/app.js`, `public/assets/sfn-cover.png`, `public/assets/sfn-logo.png`, `public/assets/sfn-logo-tight.png`, `public/assets/sfn-mark.png`
- **Kiểm thử & Tài liệu**:
  - `scripts/validate.mjs`, `scripts/test-all.mjs`, `README.md` và 8 báo cáo bàn giao chuẩn Markdown.

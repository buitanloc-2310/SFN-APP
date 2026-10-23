# BÁO CÁO KỸ THUẬT, NGHIỆM THU VÀ BÀN GIAO TOÀN DIỆN — HỆ THỐNG THÔNG TIN SỐ SKY FIRST (V9 SUPER WEBSITE)

- **Tên hệ thống**: Hệ thống Thông tin Số Sky First (`Sky First Digital Information System`)
- **Tên miền chính**: `https://app.skyfirst.io.vn` (tách biệt độc lập với hệ thống CTT `https://ctt.skyfirst.io.vn`)
- **Email hệ thống**: `app@skyfirst.io.vn`
- **Email liên hệ**: `lienhe@skyfirst.io.vn`
- **Email hỗ trợ**: `support@skyfirst.io.vn`
- **Hotline hỗ trợ**: `0924 910 210`
- **Phiên bản bàn giao**: `V9 — Super Website, Super Admin, Visual CMS & Universal Automated HTML Email`

---

## 1. BÁO CÁO KIỂM KÊ VÀ ĐÁNH GIÁ MÃ NGUỒN BAN ĐẦU (MỤC II & XV.2)

### 1.1. Cấu trúc thực tế và nền tảng công nghệ
- **Runtime & Kiến trúc**: Cloudflare Workers (ES Modules `src/index.js`) kết hợp Static Assets (`public/`), cơ sở dữ liệu quan hệ **Cloudflare D1 (SQLite)** (`binding = "DB"`, `database_name = "sfn_portal_db"`) và lưu trữ đối tượng **Cloudflare R2** (`binding = "FILES"`, `bucket_name = "sfn-portal-files"`).
- **Phân lớp kiến trúc**:
  - `src/index.js`: Lớp định tuyến trung tâm, bảo mật HTTP headers (`CSP`, `X-Frame-Options: SAMEORIGIN`, `Strict-Transport-Security`), CORS đa miền `*.skyfirst.io.vn`, điều phối SPA routes, `/robots.txt` và `/sitemap.xml`.
  - `src/auth.js`: Lớp xác thực phiên (`sfn_session`), băm mật khẩu `PBKDF2-SHA256` (150.000 vòng lặp, tương thích ngược với 100.000 vòng lặp), chống brute-force qua bảng `rate_limits` (ngưỡng 12 lần / 300 giây), kích hoạt tài khoản quản trị được mời và quy trình hỗ trợ đặt lại mật khẩu có kiểm soát.
  - `src/permissions.js`: Lớp phân quyền RBAC 6 cấp vai trò (`owner`, `super_admin`, `approver`, `editor`, `handler`, `viewer`) với hơn 30 quyền chi tiết (`permission_key`) và phạm vi đơn vị/website (`scope_unit_code`, `scope_website_id`).
  - `src/public.js`: Lớp API công khai, tra cứu chứng nhận/hồ sơ, thư viện tài liệu PDF, minh bạch tài trợ, báo cáo an toàn số, biểu mẫu động, upload R2 có kiểm tra chữ ký tệp (magic bytes) và webhook đồng bộ một chiều từ `ctt.skyfirst.io.vn` (`/api/integrations/xanh-ctt/submissions`).
  - `src/admin.js`: Lớp Super Admin, Dashboard vận hành, Visual CMS Page Builder & quy trình duyệt 4 bước (`draft -> pending_review -> approved -> published`), quản lý vòng đời tài liệu PDF, quản lý biểu mẫu & phê duyệt hồ sơ, phát hành/thu hồi/thay thế chứng nhận, Trung tâm Email HTML và nhật ký kiểm toán (`audit_log`).
  - `src/email.js`: Lớp kết xuất và gửi email tự động song ngữ Việt – Anh, tích hợp mẫu chuẩn `email_universal_auto.html`, chống gửi trùng (`dedupe`), lọc thông tin nhạy cảm và hỗ trợ đính kèm tệp/liên kết tài liệu có kiểm soát quyền.
  - `public/digital-portal.js` & `public/app.js`: Giao diện cổng công khai và cổng quản trị tập trung (`/admin`, `/admin/login`), hệ thống từ điển song ngữ tập trung Việt – Anh (`EN_TEXT_PAIRS`, `EN_PHRASE_PAIRS`), trình dựng trang trực quan CMS và trình quản lý vòng đời dữ liệu.

### 1.2. Đối chiếu lịch sử phiên bản và các gói mã nguồn
- Qua rà soát lịch sử phát triển từ nền tảng V7 lên V8 và nâng cấp lên V9:
  - Các thành phần cốt lõi của V7/V8 (cấu trúc bảng D1 `0001_schema.sql`..`0008_sky_first_digital_information_system.sql`, kho lưu trữ R2 `FILES`, cơ chế session cookie `sfn_session`, webhook tích hợp `ctt.skyfirst.io.vn`) được bảo toàn 100%, không xóa bảng, không đổi định danh bản ghi và không làm gián đoạn dữ liệu đang vận hành.
  - Hai tệp migration trùng số thứ tự lịch sử (`0004_ctt_auto_confirmation_email.sql` và `0004_ctt_final_forms_email.sql`) đã được xác minh là idempotent (`CREATE TABLE IF NOT EXISTS`, `INSERT OR REPLACE`) và được giữ nguyên tên tệp để không phá vỡ bảng `_cf_KV` / `d1_migrations` trên môi trường Cloudflare D1 đang chạy.

---

## 2. BÁO CÁO CÁC LỖI VÀ ĐIỂM THIẾU ĐÃ PHÁT HIỆN & KHẮC PHỤC (MỤC XV.3)

| STT | Hạng mục | Vấn đề phát hiện khi rà soát mã nguồn | Giải pháp khắc phục triệt để trong V9 |
|---|---|---|---|
| 1 | **Hệ thống Email HTML tự động (`email_universal_auto.html`)** | Mã nguồn cũ sử dụng các mẫu HTML rời rạc (3–4 KB, không nhúng logo Base64 chuẩn của Sky First) và chỉ dùng biến thường (`{{full_name}}`, `{{code}}`), chưa ánh xạ bộ 14 biến in hoa chuẩn của `email_universal_auto.html` (`{{PREHEADER}}`, `{{EMAIL_CATEGORY}}`, `{{EMAIL_HEADING}}`, `{{RECIPIENT_NAME}}`, `{{INTRO_TEXT}}`, `{{REQUEST_ID}}`, `{{REGISTRATION_TYPE}}`, `{{SUBMITTED_AT}}`, `{{STATUS}}`, `{{ADDITIONAL_INFO}}`, `{{BODY_HTML}}`, `{{NEXT_STEPS}}`, `{{ACTION_URL}}`, `{{ACTION_LABEL}}`). | Tích hợp nguyên bản `email_universal_auto.html` (kèm logo Sky First Base64) vào `public/email-templates/email_universal_auto.html`, `public/email-template.html` và cập nhật toàn bộ 16 mẫu email trong D1 qua migration `0009`. Nâng cấp `src/email.js` và `src/utils.js` để tự động ánh xạ đầy đủ 14 biến chuẩn + biến cũ, đồng thời dọn sạch mọi biến `{{...}}`, `null`, `undefined` còn sót. |
| 2 | **Quên mật khẩu (`/api/auth/forgot`)** | Luồng cũ mặc định sinh token đặt lại mật khẩu tự động mà chưa tạo phiếu yêu cầu hỗ trợ để Quản trị viên kiểm soát, đồng thời nút "Quên mật khẩu?" trên màn hình đăng nhập chưa mở hộp thoại hướng dẫn chuẩn. | Nâng cấp `/api/auth/forgot` trong `src/auth.js` theo đúng định hướng Quản trị viên hỗ trợ xác minh: tự động tạo phiếu hỗ trợ ưu tiên cao (`SFN-PW-*`) trong bảng `tickets`, ghi nhật ký `audit_log`, hướng dẫn liên hệ `support@skyfirst.io.vn` / hotline `0924 910 210` (chỉ gửi link tự động khi bật cờ cấu hình `allow_auto_password_reset`). Bổ sung hộp thoại `window.showForgot()` trực quan trong `public/app.js`. |
| 3 | **Nhật ký hoạt động xác thực (`audit_log`)** | Các sự kiện đăng nhập thành công, đăng nhập thất bại, đăng xuất, kích hoạt mật khẩu và yêu cầu hỗ trợ mật khẩu trong `src/auth.js` chưa được ghi vào bảng `audit_log`. | Bổ sung hàm `auditAuth()` trong `src/auth.js` ghi nhận đầy đủ người thực hiện, thời điểm, IP/User-Agent, hành động và kết quả vào `audit_log`, tuyệt đối không lưu mật khẩu hay token. |
| 4 | **Chính sách dữ liệu & Tra cứu chứng nhận bằng SĐT/Email** | Phản hồi API tra cứu (`/api/lookup/submission`, `/api/lookup/certificate`, `/api/public/credentials/:code`) chưa trả về nguyên văn 2 thông điệp chính sách dữ liệu và trạng thái thời điểm truy vấn; chức năng tra cứu chứng nhận mới chỉ tìm theo mã mà chưa hỗ trợ tra cứu theo số điện thoại/email đã đăng ký. | Chuẩn hóa nguyên văn 2 thông điệp bắt buộc trong `src/public.js` và giao diện `/gcn`, `/ho-so`. Bổ sung hàm `lookupCredentialsByContact()` cho phép tra cứu chứng nhận theo email hoặc số điện thoại đã đăng ký nhưng ẩn hoàn toàn thông tin liên hệ cá nhân trong kết quả trả về công khai. |
| 5 | **Bản quyền & Thông tin trích dẫn chân trang** | Câu thông báo trích dẫn nguồn ở chân trang chưa khớp từng chữ với yêu cầu chuẩn và chưa đồng bộ bản dịch tiếng Anh trong cấu hình hệ thống. | Cập nhật chính xác dòng bản quyền `© 2026 Hệ thống Thông tin Số Sky First. Bảo lưu mọi quyền.` và thông điệp trích dẫn nguồn bằng cả tiếng Việt & tiếng Anh trong `migrations/0009`, `src/public.js`, `public/index.html`, `public/digital-portal.js` và `public/app.js`. |
| 6 | **Quản lý vòng đời Tài liệu & PDF** | Kho tài liệu PDF đã hỗ trợ tải lên nhiều phiên bản (`document_versions`) nhưng chưa có API và hộp thoại chuyên biệt để thực hiện quy trình vòng đời (`Ngừng công bố`, `Thu hồi`, `Thay thế bằng tài liệu mới`, `Khôi phục`, `Gắn mã hồ sơ liên quan`) kèm lưu vết lịch sử trước/sau. | Bổ sung endpoint `POST /api/admin/documents/:id/lifecycle` trong `src/admin.js` và hộp thoại **Vòng đời tài liệu** (`openDocumentLifecycleModal`) trong `public/app.js`, ghi nhận người thực hiện, thời điểm, lý do, trạng thái trước/sau vào `metadata_json.lifecycle_history` và `audit_log`. |
| 7 | **Super Admin Dashboard** | `/api/admin/dashboard` chỉ mới trả về bộ đếm cơ bản, thiếu thống kê trạng thái gửi email (`sent`, `pending`, `failed`), danh sách cảnh báo vận hành hệ thống (`warnings`), hoạt động quản trị gần đây (`recent_audit`) và chuỗi thời gian (`time_series`). | Nâng cấp `/api/admin/dashboard` trong `src/admin.js` và giao diện Tổng quan trong `public/app.js` hiển thị số liệu thực tế từ D1, cảnh báo cấu hình email/phê duyệt/an toàn số, thống kê email và bảng nhật ký hoạt động gần nhất. |
| 8 | **Chuẩn hóa biểu tượng đơn sắc & SEO kỹ thuật** | Một số mục trong `public/index.html` và `public/app.js` còn dùng emoji trang trí (`📄`, `🔍`, `✅`, `⚠️`, `🔒`); thiếu route động `/robots.txt`, `/sitemap.xml` và dữ liệu có cấu trúc JSON-LD. | Thay thế emoji bằng hệ thống biểu tượng SVG đơn sắc chuẩn nhận diện Sky First; bổ sung route `/robots.txt` (chặn `/admin`, `/api/`), `/sitemap.xml` tự động kết xuất các trang công khai từ D1 và JSON-LD `EducationalOrganization` + `WebSite` trong `public/index.html`. |

---

## 3. DANH SÁCH TỆP VÀ THÀNH PHẦN ĐÃ THAY ĐỔI / BỔ SUNG (MỤC XV.4)

1. `public/email-templates/email_universal_auto.html` *(Mới)*: Mẫu email HTML tự động dùng chung chuẩn nhận diện Sky First kèm logo Base64.
2. `public/email-template.html` *(Cập nhật)*: Đồng bộ với `email_universal_auto.html`.
3. `migrations/0009_super_website_universal_email_and_cms.sql` *(Mới)*: Migration nâng cấp toàn bộ 16 mẫu email trong D1 sang `email_universal_auto.html`, cập nhật `settings` bản quyền/trích dẫn/chính sách tra cứu và tạo 10 chỉ mục hiệu năng (`CREATE INDEX IF NOT EXISTS`).
4. `src/utils.js` *(Cập nhật)*: Nâng cấp `renderTemplate()` dọn sạch mọi biến `{{...}}` chưa truyền, loại bỏ `null`/`undefined`, hỗ trợ `rawKeys` an toàn cho bảng HTML đã kiểm duyệt.
5. `src/email.js` *(Cập nhật)*: Tích hợp `email_universal_auto.html`, ánh xạ tự động 14 biến chuẩn song ngữ Việt – Anh cho 16 sự kiện nghiệp vụ, hỗ trợ đính kèm tệp PDF và liên kết tài liệu có kiểm soát quyền, lọc bỏ bí mật trước khi ghi log.
6. `src/auth.js` *(Cập nhật)*: Bổ sung `auditAuth()` ghi nhật ký xác thực và nâng cấp `/api/auth/forgot` theo quy trình Quản trị viên hỗ trợ đặt lại mật khẩu (`SFN-PW-*`).
7. `src/public.js` *(Cập nhật)*: Chuẩn hóa thông điệp chính sách dữ liệu tra cứu, bổ sung tra cứu chứng nhận theo email/số điện thoại ẩn thông tin cá nhân, kiểm tra chứng nhận hết hiệu lực (`expired`) và đồng bộ cấu hình bản quyền.
8. `src/admin.js` *(Cập nhật)*: Nâng cấp `/api/admin/dashboard`, bổ sung `/api/admin/documents/:id/lifecycle`, `/api/admin/email-templates/:key/versions`, tích hợp gửi email tự động khi thu hồi/thay thế chứng nhận, mời phỏng vấn và phản hồi phiếu hỗ trợ.
9. `src/index.js` *(Cập nhật)*: Bổ sung route động `/robots.txt` và `/sitemap.xml`.
10. `public/index.html` *(Cập nhật)*: Chuẩn hóa SVG đơn sắc, JSON-LD SEO, thông điệp chính sách tra cứu và dòng bản quyền/trích dẫn chân trang.
11. `public/digital-portal.js` *(Cập nhật)*: Nâng cấp giao diện tra cứu chứng nhận (hỗ trợ tìm theo mã hoặc email/SĐT, hiển thị chính sách dữ liệu và thời điểm truy vấn), chuẩn hóa bản dịch tiếng Anh và chân trang.
12. `public/app.js` *(Cập nhật)*: Bổ sung hộp thoại Quên mật khẩu (`window.showForgot`), nâng cấp Super Admin Dashboard, hộp thoại Vòng đời tài liệu PDF (`openDocumentLifecycleModal`), lịch sử phiên bản mẫu email (`previewEmailTemplateVersions`) và chuẩn hóa biểu tượng đơn sắc.
13. `scripts/validate.mjs` & `scripts/test-all.mjs` *(Cập nhật)*: Mở rộng bộ kiểm tra cú pháp, kiểm tra 14 biến mẫu email chuẩn và 76 bài kiểm thử tích hợp E2E toàn diện.
14. `HANDOVER-REPORT-V9.md` & `README.md` *(Mới/Cập nhật)*: Tài liệu kiến trúc, vận hành, quản trị và bàn giao toàn diện.

---

## 4. GIẢI THÍCH CÁC THAY ĐỔI KIẾN TRÚC QUAN TRỌNG (MỤC IV & XV.5)

- **Kiến trúc phân lớp trên Cloudflare Workers + D1 + R2**: Giữ nguyên nền tảng Serverless Edge hiện hữu để bảo toàn tuyệt đối dữ liệu D1/R2 và hiệu năng phản hồi (<15ms tại Edge), đồng thời tách biệt rõ ràng 9 lớp chức năng (UI, Nghiệp vụ, API/Tích hợp, Dữ liệu, Xác thực/RBAC, CMS, Email, Lưu trữ R2, Giám sát/Kiểm thử).
- **Cơ chế lưu trữ mẫu Email tối ưu trong D1 (`0009_super_website_universal_email_and_cms.sql`)**: Do mẫu `email_universal_auto.html` nhúng ảnh logo PNG Base64 (~185 KB), thay vì lặp lại chuỗi Base64 16 lần trong tệp SQL (gây phình kích thước migration lên ~3 MB), tệp migration `0009` lưu mẫu gốc vào bản ghi `submission_confirmation` và sử dụng truy vấn con `(SELECT html_template FROM email_templates WHERE key='submission_confirmation')` cho 15 mẫu còn lại. Nhờ đó tệp SQL gọn nhẹ (~201 KB) nhưng cả 16 mẫu trong bảng `email_templates` đều có đầy đủ HTML + logo Base64 độc lập để chỉnh sửa qua CMS.

---

## 5. BÁO CÁO KẾT QUẢ KIỂM THỬ TOÀN DIỆN (MỤC XII & XV.6)

Hệ thống kiểm thử tự động (`node scripts/validate.mjs` và `node scripts/test-all.mjs`) đã được thực thi trên cơ sở dữ liệu SQLite/D1 thực tế nạp đầy đủ 10 tệp migration (`0001` -> `0009`) và R2 mock:

- **Tổng số bài kiểm thử đã chạy**: **76 / 76 bài kiểm thử E2E & Regression**
- **Đã đạt (PASSED)**: **76 / 76 (100%)**
- **Đã thất bại (FAILED)**: **0**
- **Chi tiết các nhóm kiểm thử đã đạt**:
  1. Kiểm tra cú pháp ES Modules (`node --check`) trên toàn bộ tệp `src/*.js` và `public/*.js`: **Đạt**.
  2. Kiểm tra định danh hệ thống, заголовки bảo mật (`X-Frame-Options: SAMEORIGIN`, `CSP`) và 11 route SPA công khai/quản trị + trang 404: **Đạt**.
  3. Kiểm tra `/api/config`, 3 địa chỉ email chuẩn và 5 chỉ số thống kê trang chủ tự động từ D1: **Đạt**.
  4. Kiểm tra xác thực `PBKDF2` (150.000 vòng lặp), cookie phiên `sfn_session`, chặn truy cập trái phép `/api/admin/*` (401) và giới hạn đăng nhập (`rate_limits`): **Đạt**.
  5. Kiểm tra phân quyền RBAC ở tầng Backend (`super_admin`, `approver`, `editor`, `handler`, `viewer`) và cô lập phạm vi đa website (`website_id = 'sfec'` vs `'main'`): **Đạt**.
  6. Kiểm tra luồng Quên mật khẩu hỗ trợ bởi Quản trị viên (`/api/auth/forgot` -> tạo ticket `SFN-PW-*` + ghi `audit_log`): **Đạt**.
  7. Kiểm tra tải tệp lên R2 có xác thực chữ ký tệp (PNG/PDF magic bytes), nộp biểu mẫu và tra cứu hồ sơ bảo mật bằng `Mã hồ sơ + Email`: **Đạt**.
  8. Kiểm tra quy trình 2 bước cấp Chứng nhận số (Tạo yêu cầu -> Người phê duyệt duyệt -> Phát hành mã `SFN-GCN-*` -> Tra cứu theo mã hoặc theo Email/SĐT -> Thu hồi kèm lý do): **Đạt**.
  9. Kiểm tra chính sách dữ liệu tra cứu và dấu thời gian truy vấn (`data_policy_notice`, `query_timestamp_notice`, `queried_at`): **Đạt**.
  10. Kiểm tra Thư viện PDF, quản lý phiên bản (`v1 -> v2`) và quản lý vòng đời tài liệu (`revoke -> internal`, `restore -> public`): **Đạt**.
  11. Kiểm tra Visual Page Builder CMS và quy trình duyệt 4 bước (`draft -> pending_review -> approved -> published`): **Đạt**.
  12. Kiểm tra tích hợp `email_universal_auto.html` trên 16 mẫu email, chống XSS trong biến động và cam kết 0 biến `{{...}}` còn sót: **Đạt**.
  13. Kiểm tra SEO kỹ thuật (`/robots.txt`, `/sitemap.xml`): **Đạt**.
- **Hạng mục cần môi trường thực tế khi triển khai**:
  - Việc gửi email thật qua internet tới hộp thư người nhận phụ thuộc vào biến môi trường bí mật `RESEND_API_KEY` (hoặc Cloudflare Email Routing binding) trên máy chủ Cloudflare thực tế. Khi chưa khai báo `RESEND_API_KEY`, hệ thống tự động ghi nhận email vào `email_logs` ở trạng thái `pending` và hiển thị cảnh báo rõ ràng trên Dashboard Super Admin.

---

## 6. HƯỚNG DẪN CÀI ĐẶT, CẤU HÌNH MÔI TRƯỜNG VÀ BIẾN BÍ MẬT (MỤC XV.7, XV.8 & XV.11)

### 6.1. Yêu cầu môi trường
- **Node.js**: `>= 18.x` (khuyến nghị Node 20 LTS)
- **Wrangler CLI**: `>= 4.x` (`npm install -g wrangler`)

### 6.2. Danh sách biến môi trường (`wrangler.jsonc` & Cloudflare Secrets — Mục XV.11)
Các biến công khai đã được cấu hình sẵn trong `wrangler.jsonc`:
- `APP_URL`: `"https://app.skyfirst.io.vn"`
- `MAIL_FROM`: `"Hệ thống Thông tin Số Sky First <app@skyfirst.io.vn>"`
- `MAIL_CONTACT`: `"lienhe@skyfirst.io.vn"`
- `MAIL_SUPPORT`: `"support@skyfirst.io.vn"`

Các biến bí mật (Secrets) do Chủ hệ thống cài đặt qua `wrangler secret put <NAME>` (tuyệt đối không lưu giá trị thật trong mã nguồn):
- `RESEND_API_KEY`: API Key của dịch vụ gửi email Resend (đã xác thực domain `skyfirst.io.vn`).
- `XANH_CTT_SHARED_SECRET`: Khóa bí mật HMAC-SHA256 dùng để xác thực chữ ký webhook đồng bộ hồ sơ từ `ctt.skyfirst.io.vn`.
- `TURNSTILE_SITE_KEY` & `TURNSTILE_SECRET_KEY` *(Tùy chọn)*: Khóa Cloudflare Turnstile chống bot trên biểu mẫu công khai.
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` *(Tùy chọn)*: Cấu hình đăng nhập Google OAuth.

### 6.3. Lệnh kiểm tra cú pháp, chạy kiểm thử và chạy thử cục bộ (Mục XV.8)
```bash
# 1. Kiểm tra tính toàn vẹn tệp, cú pháp JS và mẫu email chuẩn
node scripts/validate.mjs

# 2. Chạy toàn bộ 76 bài kiểm thử tích hợp E2E & Regression
node scripts/test-all.mjs

# 3. Chạy máy chủ phát triển cục bộ với Wrangler
npx wrangler dev
```

---

## 7. HƯỚNG DẪN CHẠY MIGRATION CƠ SỞ DỮ LIỆU VÀ KHÔI PHỤC SỰ CỐ (MỤC XV.12 & XV.15)

### 7.1. Quy trình sao lưu và nâng cấp D1 an toàn
Trước khi áp dụng migration `0009` lên môi trường thật, bắt buộc xuất bản sao lưu D1:
```bash
# Bước 1: Sao lưu toàn bộ cơ sở dữ liệu D1 hiện hành
npx wrangler d1 export sfn_portal_db --remote --output=backup_sfn_portal_db_pre_v9.sql

# Bước 2: Kiểm tra migration 0009 trên môi trường cục bộ trước
npx wrangler d1 execute sfn_portal_db --local --file=migrations/0009_super_website_universal_email_and_cms.sql

# Bước 3: Áp dụng migration 0009 lên D1 thật (chỉ thực hiện sau khi Chủ hệ thống phê duyệt)
npx wrangler d1 execute sfn_portal_db --remote --file=migrations/0009_super_website_universal_email_and_cms.sql
```

### 7.2. Hướng dẫn khôi phục (Rollback) khi gặp sự cố (Mục XV.15)
- **Khôi phục phiên bản Worker**: Sử dụng tính năng Rollback tức thì của Cloudflare Workers:
  ```bash
  npx wrangler deployments list
  npx wrangler rollback
  ```
- **Khôi phục dữ liệu D1**: Vì `0009_super_website_universal_email_and_cms.sql` hoàn toàn là migration cộng thêm (chỉ `INSERT ... ON CONFLICT DO UPDATE` vào `settings` và `email_templates`, và `CREATE INDEX IF NOT EXISTS`), nó không làm thay đổi cấu trúc cột hay xóa bất kỳ dữ liệu nào. Nếu cần khôi phục bản chụp trước nâng cấp:
  ```bash
  npx wrangler d1 execute sfn_portal_db --remote --file=backup_sfn_portal_db_pre_v9.sql
  ```

---

## 8. HƯỚNG DẪN QUẢN TRỊ CMS, SUPER ADMIN, EMAIL VÀ TÀI LIỆU (MỤC XV.9 & XV.10)

1. **Đăng nhập Quản trị**:
   - Truy cập `https://app.skyfirst.io.vn/admin/login` (hoặc liên kết tinh tế **Đăng Nhập Quản Trị** ở góc dưới bên phải chân trang công khai).
   - Nếu quên mật khẩu, bấm **Quên mật khẩu?** để gửi yêu cầu hỗ trợ (`SFN-PW-*`) tới Quản trị viên hệ thống hoặc liên hệ `support@skyfirst.io.vn` / `0924 910 210`.
2. **Quản trị nội dung Visual CMS & Đa Website**:
   - Mở mục **Trình dựng trang (CMS)** trên thanh điều hướng quản trị để tạo/sửa các trang động theo khối trực quan (`Hero`, `Đoạn văn`, `Thẻ nổi bật`, `Kêu gọi hành động`, `Bảng dữ liệu`, `Câu hỏi thường gặp`).
   - Thực hiện quy trình kiểm duyệt: **Gửi duyệt (`pending_review`)** -> **Phê duyệt (`approved`)** -> **Xuất bản (`published`)** hoặc **Ngừng xuất bản (`unpublished`)**. Mọi chỉnh sửa đều lưu lịch sử phiên bản trong `cms_page_versions` và có thể khôi phục bất kỳ lúc nào.
   - Mở mục **Cấu hình cổng & CMS** để cập nhật tiêu đề, mô tả, thông báo chạy, thông tin liên hệ, liên kết chân trang và bản quyền mà không cần sửa mã nguồn.
3. **Quản lý Tài liệu & Thư viện PDF**:
   - Mở mục **Thư viện PDF & Tài liệu** để tải lên tệp PDF mới, phát hành phiên bản mới (`v2`, `v3`... giữ nguyên lịch sử các phiên bản cũ), hoặc bấm nút **Vòng đời** trên từng tài liệu để thực hiện: `Công bố`, `Ngừng công bố`, `Thu hồi`, `Thay thế bằng tài liệu mới`, `Khôi phục` hoặc `Gắn mã hồ sơ liên quan`.
4. **Quản trị Mẫu Email HTML tự động**:
   - Mở mục **Trung tâm Email** để xem trước (`Preview`), chỉnh sửa tiêu đề/nội dung của cả 16 mẫu email tự động (đã tích hợp sẵn `email_universal_auto.html`), xem lịch sử phiên bản mẫu email (`Lịch sử mẫu`), gửi email thử nghiệm và theo dõi nhật ký gửi email (`sent`, `accepted_by_provider`, `pending`, `failed`).

---

## 9. DANH SÁCH VẤN ĐỀ CÒN TỒN TẠI & VIỆC CẦN CHỦ HỆ THỐNG THỰC HIỆN TIẾP (MỤC XV.13 & XV.14)

1. **Cấu hình khóa gửi email thực tế (`RESEND_API_KEY`)**: Trong mã nguồn bàn giao không chứa khóa bí mật thật. Chủ hệ thống cần chạy `npx wrangler secret put RESEND_API_KEY` với API Key đã xác thực tên miền `skyfirst.io.vn` để các email tự động chuyển từ trạng thái `pending` sang gửi thực tế (`accepted_by_provider`).
2. **Cấu hình khóa đồng bộ CTT (`XANH_CTT_SHARED_SECRET`)**: Đảm bảo biến bí mật `XANH_CTT_SHARED_SECRET` trên `app.skyfirst.io.vn` khớp với khóa ký webhook trên `ctt.skyfirst.io.vn`.
3. **Phê duyệt triển khai Production**: Theo đúng nguyên tắc bảo toàn hệ thống, mã nguồn đã được kiểm thử đầy đủ và đóng gói sạch trong gói ZIP bàn giao; Chủ hệ thống kiểm tra và chạy `npx wrangler deploy` khi đã sẵn sàng đưa lên môi trường Production.

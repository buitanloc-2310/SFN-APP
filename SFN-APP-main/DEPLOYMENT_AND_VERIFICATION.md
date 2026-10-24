# HƯỚNG DẪN TRIỂN KHAI & DANH MỤC KIỂM ĐỊNH SAU TRIỂN KHAI (DEPLOYMENT & VERIFICATION)

## 1. Cấu hình biến môi trường và Bindings (`wrangler.jsonc`)

Đảm bảo tệp `wrangler.jsonc` được cấu hình đúng với tài nguyên Cloudflare của đơn vị:
- **D1 Database Binding**: `DB` → `database_name: "sfn-app-db"`
- **R2 Bucket Binding**: `FILES` → `bucket_name: "sfn-files"`
- **Assets Binding**: `ASSETS` → thư mục `./public`
- **Biến môi trường (`vars`)**:
  - `APP_URL`: `"https://app.skyfirst.io.vn"`
  - `MAIL_FROM`: `"Hệ thống Thông tin Số Sky First <app@skyfirst.io.vn>"`
  - `MAIL_CONTACT`: `"lienhe@skyfirst.io.vn"`
  - `MAIL_SUPPORT`: `"support@skyfirst.io.vn"`
- **Khóa bí mật (`wrangler secret put`)**:
  - `RESEND_API_KEY`: Khóa gửi email tự động qua Resend (tùy chọn nếu dùng Email Routing).
  - `SPONSORSHIP_WEBHOOK_SECRET`: Khóa bí mật (tối thiểu 32 ký tự) để xác thực chữ ký HMAC-SHA256 từ cổng đối soát thanh toán ngân hàng.
  - `XANH_CTT_SHARED_SECRET`: Khóa bí mật (tối thiểu 32 ký tự) để xác thực hồ sơ đồng bộ từ Xanh Sky First.
  - `TURNSTILE_SITE_KEY` & `TURNSTILE_SECRET_KEY`: Khóa bảo vệ biểu mẫu chống bot Cloudflare Turnstile.

## 2. Quy trình triển khai từng bước (Step-by-Step Deployment)

**Lưu ý:** bản ZIP chỉnh sửa này chưa triển khai và chưa chạy migration trên D1 sản xuất. Bắt buộc có phê duyệt triển khai riêng.

```bash
# Bước 1: Chạy toàn bộ bộ kiểm định trước khi triển khai
node scripts/validate.mjs
node scripts/validate-ui-reference.mjs
node scripts/validate-xanh-integration.mjs
node scripts/test-all.mjs

# Bước 2: Sao lưu D1 hiện tại
npx wrangler d1 export sfn-app-db --remote --output=backup_pre_deploy.sql

# Bước 3: Đối chiếu lịch sử migration, chạy thử trên staging và chỉ áp dụng khi có phê duyệt riêng
npx wrangler d1 migrations list sfn-app-db --remote
# Khi được phê duyệt và sau khi sao lưu/kiểm thử staging: npm run db:migrate
# Không dùng wrangler d1 execute --file để chạy migration trong môi trường đã có dữ liệu.

# Bước 4: Triển khai Worker và Assets lên Cloudflare
npx wrangler deploy
```

## 3. Danh mục kiểm tra xác nhận sau triển khai (Post-Deployment Smoke Test Checklist)

1. **Kiểm tra Sức khỏe Hệ thống (`/api/health`)**:
   - Truy cập `GET https://app.skyfirst.io.vn/api/health` → Xác nhận trả về `status: 200`, `ok: true`, `database_operational: true`, `storage_operational: true`, `operational_mode: "normal"`.
2. **Kiểm tra cấu hình công khai & Song ngữ (`/api/config`)**:
   - Truy cập `GET https://app.skyfirst.io.vn/api/config?lang=vi` và `?lang=en` → Xác nhận có đủ 7 website trong `websites`, 13 trang hệ thống trong `system_pages`, `design_system` và `menus`.
3. **Kiểm tra các trang công khai và SEO**:
   - Mở `/`, `/gioi-thieu`, `/chuong-trinh`, `/su-kien`, `/tai-tro`, `/tai-lieu`, `/bieu-mau`, `/ho-so`, `/tra-cuu`, `/gcn`, `/an-toan`, `/ho-tro`, `/robots.txt`, `/sitemap.xml`.
4. **Kiểm tra Trung tâm Quản trị (`/admin/login`)**:
   - Đăng nhập tài khoản quản trị → Mở `#admin/maintenance` → Kiểm tra bảng **Pre-Reopen Check** và **Release QA Gate** hiển thị trạng thái **ĐẠT**.
   - Tạo một bản sao lưu mới tại `#admin/backup` và xác minh mã băm `SHA-256`.

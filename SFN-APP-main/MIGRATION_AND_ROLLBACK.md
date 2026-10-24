# HƯỚNG DẪN DI TRÚ CƠ SỞ DỮ LIỆU D1 & PHƯƠNG ÁN PHỤC HỒI (MIGRATION & ROLLBACK GUIDE)

## 1. Nguyên tắc thiết kế di trú (Zero-Data-Loss & Additive Schema)

Các thay đổi cơ sở dữ liệu cần được áp dụng theo lịch sử migration của dự án; các migration cũ phải được giữ nguyên sau khi đã áp dụng:
1. `migrations/0010_forensic_security_and_financial_reconciliation.sql`: Bổ sung cột đếm số lần thử 2FA (`auth_tokens.attempt_count`), các cột ngân hàng & đối soát trên `sponsorship_campaigns` và `sponsorship_transactions`, bảng `sponsorship_payment_intents`, `sponsorship_audit_trail`, và các cột kiểm định `sha256`, `table_counts_json`, `kind`, `verified_at` trên bảng `backups`.
2. `migrations/0011_v10_admin_cms_i18n_governance.sql`:
   - Mở rộng bảng `websites` với cấu hình bảo trì/theme/SEO/i18n riêng; chuyển toàn bộ tham chiếu khóa ngoại từ các mã cũ (`slc`, `tnv`, `gme`) về `app` trước khi dọn các bản ghi cũ và chuẩn hóa đúng **7 website chính thức** (`app`, `main`, `ctt`, `mail`, `member`, `sfec`, `exam`).
   - Mở rộng bảng `cms_pages` với `page_type`, `route_path`, `locale`, `title_en`, `summary_en`, `blocks_en_json`, `seo_en_json`, `scheduled_at`, `unpublished_at`, `wp_post_id`, `wp_sync_meta_json` và khởi tạo (`INSERT OR IGNORE`) 13 trang hệ thống cùng các mẫu trang và khối dùng chung.
   - Tạo mới bảng `menus` và `system_incidents`, đồng thời khởi tạo cấu hình `design_system`, `maintenance_config` và `wordpress_integration_config` trong bảng `settings`.

Không một bảng hay cột dữ liệu nghiệp vụ hiện có nào (`users`, `submissions`, `certificates`, `issued_document_codes`, `documents`, `files`, `audit_log`) bị xóa hoặc làm mất dữ liệu. Migration `0013_remove_homepage_technical_callout.sql` chỉ loại block callout kỹ thuật cụ thể khỏi `sys_home`, giữ nguyên các block CMS khác.

## 2. Quy trình áp dụng di trú an toàn

### Bước 1: Sao lưu toàn bộ cơ sở dữ liệu D1 trước khi chạy migration

```bash
# 1. Xuất bản sao lưu SQL từ D1
npx wrangler d1 export sfn-app-db --remote --output=backup_pre_v10_$(date +%Y%m%d_%H%M%S).sql

# 2. (Tùy chọn) Tạo thêm một bản sao lưu JSON kèm mã băm SHA-256 trên R2 từ giao diện Admin (#admin/backup)
```

### Bước 2: Kiểm tra trạng thái bảng trước khi di trú

```bash
npx wrangler d1 execute sfn-app-db --remote --command="SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"
```

### Bước 3: Đối chiếu lịch sử và áp dụng migration đúng quy trình

Không chạy các tệp migration bằng `wrangler d1 execute --file` trên môi trường đã có dữ liệu, vì thao tác đó có thể làm lệch lịch sử migration. Trước hết, đối chiếu trạng thái áp dụng và chạy thử trên môi trường staging có cấu trúc tương đương. Chỉ sau khi đã sao lưu, kiểm thử thành công và có phê duyệt triển khai riêng mới áp dụng các migration còn thiếu bằng cơ chế quản lý migration của dự án:

```bash
# Kiểm tra lịch sử migration trong môi trường đích
npx wrangler d1 migrations list sfn-app-db --remote

# Chỉ chạy sau khi được phê duyệt triển khai
npm run db:migrate
```

Migration mới `0013_remove_homepage_technical_callout.sql` chưa được chạy trên D1 sản xuất trong quá trình chỉnh sửa này.

### Bước 4: Kiểm tra xác nhận sau di trú (Post-Migration Verification)

```bash
# Kiểm tra đúng 7 website chuẩn trong hệ sinh thái
npx wrangler d1 execute sfn-app-db --remote --command="SELECT id, code, domain, status FROM websites ORDER BY id;"

# Kiểm tra 13 trang hệ thống đã được khởi tạo trong cms_pages
npx wrangler d1 execute sfn-app-db --remote --command="SELECT id, route_path, title, status FROM cms_pages WHERE page_type='system';"

# Kiểm tra bảng menus và system_incidents
npx wrangler d1 execute sfn-app-db --remote --command="SELECT id, website_id, location FROM menus;"
```

## 3. Phương án Rollback (Khôi phục khi cần thiết)

1. **Khôi phục nhanh dữ liệu nghiệp vụ qua Trung tâm Sao lưu (`#admin/backup`)**:
   - Truy cập `/admin#admin/backup` hoặc gọi `POST /api/admin/backups/:id/restore` với mã bản sao lưu trước khi nâng cấp. Hệ thống sẽ đối chiếu mã băm `SHA-256`, tự động tạo một bản `pre_restore` dự phòng và khôi phục nguyên tử toàn bộ bảng dữ liệu qua `env.DB.batch`.
2. **Khôi phục toàn bộ D1 từ tệp SQL đã xuất**:
   ```bash
   npx wrangler d1 execute sfn-app-db --remote --file=backup_pre_v10_YYYYMMDD_HHMMSS.sql
   ```

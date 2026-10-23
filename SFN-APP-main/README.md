# Hệ thống Thông tin Số Sky First — Phiên bản V9 Super Website (`app.skyfirst.io.vn`)

Nền tảng thông tin, dịch vụ công trực tuyến, quản trị nội dung (Visual CMS), quản lý hồ sơ – biểu mẫu – phê duyệt, xác thực chứng nhận số, thư viện tài liệu PDF đa phiên bản và hệ thống email HTML tự động dùng chung (`email_universal_auto.html`) của **Sky First**.

- **Tên miền hệ thống**: `https://app.skyfirst.io.vn`
- **Email hệ thống**: `app@skyfirst.io.vn`
- **Email liên hệ**: `lienhe@skyfirst.io.vn`
- **Email hỗ trợ**: `support@skyfirst.io.vn`
- **Hotline**: `0924 910 210`
- **Tài liệu bàn giao chi tiết**: Xem toàn văn báo cáo 15 mục tại [`HANDOVER-REPORT-V9.md`](./HANDOVER-REPORT-V9.md).

## Cài đặt & Kiểm thử nhanh

```bash
# 1. Kiểm tra tính toàn vẹn tệp, cú pháp JS và mẫu email chuẩn
node scripts/validate.mjs

# 2. Chạy toàn bộ 76 bài kiểm thử tích hợp E2E & Regression
node scripts/test-all.mjs

# 3. Khởi chạy môi trường phát triển cục bộ
npx wrangler dev
```

## Nâng cấp Cơ sở dữ liệu D1 & Triển khai

```bash
# Sao lưu D1 trước khi nâng cấp
npx wrangler d1 export sfn_portal_db --remote --output=backup_pre_v9.sql

# Chạy migration 0009 (idempotent, bảo toàn 100% dữ liệu hiện hữu)
npx wrangler d1 execute sfn_portal_db --remote --file=migrations/0009_super_website_universal_email_and_cms.sql

# Triển khai Worker sau khi được phê duyệt
npx wrangler deploy
```

© 2026 Hệ thống Thông tin Số Sky First. Bảo lưu mọi quyền.

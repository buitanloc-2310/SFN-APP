# Hệ thống Thông tin Số Sky First — Phiên bản V10 Admin-Driven Super Website (`app.skyfirst.io.vn`)

Nền tảng thông tin số, dịch vụ công trực tuyến, quản trị nội dung toàn trang (Full-Page Visual CMS & Headless WordPress/Gutenberg Adapter), quản lý hồ sơ – biểu mẫu – phê duyệt, xác thực chứng nhận số (`SFN-GCN/GXN/BK-########`), minh bạch tài trợ & VietQR tự động, thư viện tài liệu PDF đa phiên bản và hệ thống email HTML tự động dùng chung (`email_universal_auto.html`) của **Sky First**.

- **Tên miền hệ thống**: `https://app.skyfirst.io.vn`
- **Cơ sở dữ liệu D1 chuẩn**: `sfn-app-db`
- **Bucket R2 chuẩn**: `sfn-files`
- **Email hệ thống**: `app@skyfirst.io.vn`
- **Email liên hệ**: `lienhe@skyfirst.io.vn`
- **Email hỗ trợ**: `support@skyfirst.io.vn`
- **Hotline**: `0924 910 210`

## Danh mục 7 Website Chính thức trong Hệ sinh thái Sky First

1. `app.skyfirst.io.vn` — Hệ thống Thông tin Số Sky First (`app`)
2. `skyfirst.io.vn` — Trang thông tin điện tử Sky First (`main`)
3. `ctt.skyfirst.io.vn` — Cổng Thông tin điện tử (`ctt`)
4. `mail.skyfirst.io.vn` — Hệ thống Thư điện tử (`mail`)
5. `member.skyfirst.io.vn` — Chuyên trang Thành viên (`member`)
6. `sfec.skyfirst.io.vn` — CLB Tiếng Anh The Sky First (`sfec`)
7. `exam.skyfirst.io.vn` — Cổng Khảo thí & Đánh giá năng lực (`exam`)

## Cài đặt & Kiểm thử nhanh

```bash
# 1. Kiểm tra tính toàn vẹn tệp, cú pháp JS và mẫu email chuẩn
node scripts/validate.mjs

# 2. Kiểm tra ánh xạ giao diện và bảo mật tích hợp Xanh
node scripts/validate-ui-reference.mjs
node scripts/validate-xanh-integration.mjs

# 3. Chạy toàn bộ bộ kiểm thử tích hợp E2E & Regression (D1 + R2 giả lập)
node scripts/test-all.mjs

# 4. Khởi chạy môi trường phát triển cục bộ
npx wrangler dev
```

## Nâng cấp Cơ sở dữ liệu D1 & Triển khai

```bash
# Sao lưu D1 trước khi nâng cấp
npx wrangler d1 export sfn-app-db --remote --output=backup_pre_v10.sql

# Áp dụng tuần tự các bản di trú 0010 và 0011 (idempotent, bảo toàn 100% dữ liệu hiện hữu)
npx wrangler d1 execute sfn-app-db --remote --file=migrations/0010_forensic_security_and_financial_reconciliation.sql
npx wrangler d1 execute sfn-app-db --remote --file=migrations/0011_v10_admin_cms_i18n_governance.sql

# Triển khai Worker sau khi được phê duyệt
npx wrangler deploy
```

© 2026 Hệ thống Thông tin Số Sky First. Bảo lưu mọi quyền.

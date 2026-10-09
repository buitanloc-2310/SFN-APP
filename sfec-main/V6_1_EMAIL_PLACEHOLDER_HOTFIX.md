# V6.1 Email Placeholder Hotfix

Sửa lỗi email hồ sơ gửi nguyên placeholder như `{FULL_NAME}` thay vì dữ liệu thật.

- Template D1 đổi về placeholder chuẩn `{{code}}`, `{{full_name}}`, `{{email}}`...
- `renderTemplate()` được làm tương thích ngược với cả `{KEY}` và `{{KEY}}`, không phân biệt hoa/thường.
- Chạy migration `0009_fix_email_placeholders.sql` sau khi deploy.

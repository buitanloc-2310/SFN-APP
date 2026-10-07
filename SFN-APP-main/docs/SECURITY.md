# SECURITY — CỔNG THÔNG TIN SỐ SKY FIRST

- Public account registration bị vô hiệu hóa; chỉ Administrator đã tồn tại được login.
- Password dùng PBKDF2-SHA256/salt; session, reset và role được xử lý phía server.
- Không lưu mật khẩu plaintext hoặc file “first login password” trong public/source.
- State-changing API kiểm Origin; admin route kiểm permission/RBAC.
- Case lookup yêu cầu Case ID + thông tin xác minh bổ sung; không trả lại email trong response.
- Credential public có thể lookup và **không được coi mã 5 số là secret**.
- File private đi qua authorization/token; object R2 không mặc định public.
- Upload kiểm size, MIME và magic bytes; filename/path được sanitize.
- Security headers gồm CSP, HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy và Permissions-Policy.
- Audit tập trung vào `WHO → DID WHAT → ENTITY → WHEN → RESULT/context`, không lưu binary/request body lớn.
- 403/404/500 public không hiển thị stack trace.

Mọi thay đổi production về auth, upload, permission, credential hoặc case privacy phải được smoke-test trên staging trước khi deploy chính thức.

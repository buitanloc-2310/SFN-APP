# TRIỂN KHAI SFN PRODUCTION MASTER LÊN CLOUDFLARE

## A. Chuẩn bị

Mở PowerShell/Terminal tại thư mục `SFN_Production_Master`.

```powershell
npm install
npx wrangler login
```

## B. Tạo D1

```powershell
npx wrangler d1 create sfn-app-db
```

Cloudflare sẽ trả về `database_id`. Mở `wrangler.jsonc` và thay:

```text
REPLACE_WITH_YOUR_D1_DATABASE_ID
```

bằng ID thật.

## C. Tạo R2

```powershell
npx wrangler r2 bucket create sfn-app-files
```

Bucket mặc định là private. File hồ sơ chỉ được tải qua Worker sau khi kiểm tra quyền.

## D. Tạo bảng + dữ liệu khởi tạo

```powershell
npm run db:migrate
```

Migrations gồm:

- `0001_schema.sql`: toàn bộ database.
- `0002_seed.sql`: vai trò, modules, settings, DK-01, DK-02, privacy, 9 form, SFEC, lớp mẫu, email template và Super Admin.

## E. Email

### Cách dễ dùng khi DNS chính không nhất thiết nằm ở Cloudflare: Resend/API provider

1. Xác minh địa chỉ/domain gửi ở provider.
2. Đặt secret:

```powershell
npx wrangler secret put RESEND_API_KEY
```

3. Trong `wrangler.jsonc`, `MAIL_FROM` hiện mặc định:

```text
Sky First Network <noreply@skyfirst.io.vn>
```

Nếu sender đã xác minh là địa chỉ khác, sửa `MAIL_FROM` cho đúng.

### Cloudflare Email Service

Source cũng hỗ trợ `env.EMAIL.send(...)`. Nếu domain đã onboard Cloudflare Email Service, bạn có thể thêm `send_email` binding vào `wrangler.jsonc` theo Dashboard/docs Cloudflare.

## F. Google OAuth — tùy chọn

Nếu muốn nút **Tiếp tục với Google** hoạt động:

- tạo OAuth Client trong Google Cloud;
- Authorized redirect URI:

```text
https://volunteer.skyfirst.io.vn/api/auth/google/callback
```

- điền `GOOGLE_CLIENT_ID` trong `wrangler.jsonc`;
- đặt Client Secret:

```powershell
npx wrangler secret put GOOGLE_CLIENT_SECRET
```

Nếu chưa cấu hình, nút Google tự ẩn; email + mật khẩu vẫn dùng bình thường.

## G. Turnstile — tùy chọn nhưng khuyến nghị

- điền `TURNSTILE_SITE_KEY` trong `wrangler.jsonc`;
- đặt secret:

```powershell
npx wrangler secret put TURNSTILE_SECRET_KEY
```

Nếu không cấu hình, biểu mẫu vẫn hoạt động và backend vẫn có rate limiting cơ bản.

## H. Deploy

```powershell
npm run validate
npm run deploy
```

Sau deploy, kiểm tra:

```text
https://<worker-url>/api/health
```

Kỳ vọng:

```json
{"ok":true,"production":true,"database":true,"storage":true}
```

## I. Gắn domain chính

Domain vận hành hiện tại của app là:

```text
https://volunteer.skyfirst.io.vn
```

Gắn custom domain/route theo cách bạn đang sử dụng trên Cloudflare. Chỉ gắn sau khi Worker URL hoạt động ổn.

## J. Đăng nhập lần đầu

- Email: `skyfirst.ec@gmail.com`
- Mật khẩu tạm: xem `FIRST_LOGIN_SUPER_ADMIN.txt`
- Hệ thống bắt buộc đổi mật khẩu.
- Sau đó vào **Bảo mật tài khoản → Thiết lập 2FA**.

## K. Kiểm thử bắt buộc trước khi công bố

1. Đăng nhập Super Admin.
2. Cấp 01 tài khoản Thành viên thử nghiệm.
3. Gửi 01 hồ sơ Core Team.
4. Gửi 01 hồ sơ TNV dạy học.
5. Gửi 01 đăng ký lớp SFEC.
6. Gửi 01 Support ticket.
7. Kiểm tra hồ sơ xuất hiện trên máy khác.
8. Kiểm tra email về `skyfirst.ec@gmail.com`.
9. Đổi trạng thái hồ sơ và kiểm tra email người nộp.
10. Tạo GCN → phê duyệt → phát hành → tra cứu mã.
11. Upload và mở file bằng tài khoản có quyền; thử mở khi chưa đăng nhập để bảo đảm bị chặn.
12. Tạo backup.

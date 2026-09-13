# CTT Auto Email Upgrade

Đã nâng cấp trực tiếp từ SFN-APP hiện tại.

- Giữ nguyên Cổng Thông tin, D1, R2 và các module đang có.
- Sau khi hồ sơ được lưu thành công, hệ thống tự gửi email xác nhận đến email người đăng ký.
- Sender sử dụng `MAIL_FROM` hiện tại: `Sky First Network <noreply@skyfirst.io.vn>`.
- Gửi qua `RESEND_API_KEY` nếu secret đã được cấu hình.
- HTML email dùng giao diện gradient tím/hồng/cam và phần Hệ sinh thái trực tuyến Sky First.
- Nút `TRA CỨU HỒ SƠ` dẫn tới `https://ctt.skyfirst.io.vn/#lookup`.
- Tự điền: họ tên, email, mã hồ sơ, loại hồ sơ, thời gian tiếp nhận và trạng thái.

## Sau khi thay source
Chạy migration mới:
`npm run db:migrate`

Sau đó deploy:
`npm run deploy`

Không đưa `RESEND_API_KEY` vào GitHub; giữ nó trong Worker Secrets.

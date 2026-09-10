# EMAIL SFN

## Đích nhận form

Mặc định tất cả form gửi thông báo nội bộ về:

`skyfirst.ec@gmail.com`

Đích này được lưu cả trong form và setting; Super Admin có thể chỉnh trong Admin nếu thật sự cần.

## Nội dung email hồ sơ

- tên biểu mẫu;
- mã hồ sơ;
- người gửi/email;
- toàn bộ câu hỏi + câu trả lời;
- file được thể hiện dưới dạng link bảo mật trong hệ thống.

Người nộp nhận email xác nhận mã hồ sơ. Khi Admin đổi trạng thái, hệ thống có template `status_update`.

## Provider

Source ưu tiên `RESEND_API_KEY` nếu có. Nếu không có nhưng Worker có `EMAIL` binding, source dùng Cloudflare Email Service. Nếu chưa có provider, hồ sơ vẫn lưu D1 và `email_logs` ghi pending/failed.

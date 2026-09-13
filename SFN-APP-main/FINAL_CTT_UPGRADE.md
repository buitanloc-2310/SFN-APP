# Sky First Cổng Thông tin — Final Upgrade

Đã nâng cấp trực tiếp từ `SFN-APP-main(3).zip`.

## Chốt chức năng
- 01 mẫu HTML xác nhận duy nhất cho toàn bộ đăng ký CTT.
- Sender: `Sky First · Cổng Thông tin <ctt@skyfirst.io.vn>`.
- Tự điền họ tên, email, mã đăng ký, loại đăng ký, thời gian và trạng thái.
- Ảnh cá nhân được chèn trực tiếp vào email khi đăng ký có ảnh.
- Mọi biểu mẫu mặc định bắt buộc ảnh cá nhân; riêng Lớp học / Học viên mới không bắt buộc.
- Admin Form Builder: tạo, sửa, sao chép, bật/tắt, thêm/xóa/sắp xếp/sửa trường, xem trước, cấu hình quy tắc ảnh.
- Thông báo sau đăng ký: “Thông tin đăng ký của bạn đã được gửi đến địa chỉ email đăng ký.” khi Resend gửi thành công.
- Nút tra cứu trong email: `https://ctt.skyfirst.io.vn/#lookup`.

## Deploy
1. Đảm bảo Worker có secret `RESEND_API_KEY`.
2. Domain `skyfirst.io.vn` phải được xác thực trong Resend để gửi bằng `ctt@skyfirst.io.vn`.
3. Chạy `npm run db:migrate`.
4. Chạy `npm run deploy`.

Không đưa `RESEND_API_KEY` vào GitHub/source.

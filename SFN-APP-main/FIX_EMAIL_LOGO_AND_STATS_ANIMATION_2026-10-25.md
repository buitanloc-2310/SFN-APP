# Bản sửa logo email và hoạt ảnh 5 chỉ số — 25/10/2026

## 1. Lỗi logo email

- Thay logo Sky First dạng `data:image/...;base64` trong mẫu email bằng ảnh HTTPS công khai `https://app.skyfirst.io.vn/assets/sfn-logo-tight.png`.
- Bổ sung chuẩn hóa ở `src/email.js` để các mẫu email cũ còn lưu trong D1 vẫn được sửa logo ngay trước khi gửi.
- Migration `migrations/0015_email_logo_https.sql` cập nhật các mẫu email đang lưu trong D1 để phần xem trước trong trang quản trị cũng dùng URL mới.

## 2. Hoạt ảnh đếm số trên trang chủ

- Bổ sung bộ đếm số dùng `requestAnimationFrame`, easing và độ trễ nhẹ giữa 5 chỉ số: Chương trình & sự kiện, Thành viên cộng đồng, Chứng nhận đã phát hành, Đối tác & đơn vị đồng hành, Tổng tiền tài trợ thực nhận.
- Hoạt ảnh dựa trên số liệu thực tế/thủ công đang chọn; kết thúc chính xác ở giá trị đích.
- Đọc cấu hình thời lượng và số lượt chạy; mặc định giao diện quản trị là một lượt để tránh lặp ngoài ý muốn.
- Tôn trọng `prefers-reduced-motion` và ngừng hoạt ảnh nếu thẻ thống kê đã bị gỡ khỏi DOM.
- Tăng phiên bản cache giao diện/service worker để trình duyệt nhận mã JavaScript mới.

## 3. Kiểm tra

- `npm run validate`: đạt.
- `npm run validate:ui`: 21/21 đạt.
- `npm test`: 186/186 đạt.

## 4. Triển khai

Đây là bản mã nguồn đã sửa, chưa phải xác nhận website production đã được triển khai. Khi triển khai, chạy migration D1 mới (`0015_email_logo_https.sql`) cùng quy trình phát hành hiện có, sau đó kiểm tra một email thử nghiệm trong Gmail và tải lại trang chủ để xác nhận 5 chỉ số đếm động.

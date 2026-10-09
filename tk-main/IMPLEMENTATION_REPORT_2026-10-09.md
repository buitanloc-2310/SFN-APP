# Báo cáo triển khai — Trung Tâm Thành Viên Số Sky First

Ngày cập nhật: 09/10/2026  
Nguồn ban đầu: `tk-main-fixed-20261009-v3(1).zip`

## Đã thay đổi trong gói nguồn

- Thêm migration `0014_independent_verification_qr.sql` cho hồ sơ QR xác minh độc lập, tách biệt với hồ sơ thành viên, tài khoản và thẻ thành viên chính thức.
- Thêm API quản trị để tạo, tìm kiếm, thu hồi QR xác minh; kiểm tra ngày cấp/ngày hết hạn và token duy nhất; không trả private notes hoặc token xác minh qua dữ liệu công khai.
- Thêm API tổng quan cấp phát dựa trên dữ liệu thực, danh sách thẻ thành viên và hiển thị riêng QR độc lập, thẻ sự kiện và thẻ thành viên. QR tương lai hiển thị trạng thái “Chưa đến ngày cấp” và không được xác minh là hợp lệ.
- Thêm trang xác minh công khai cho hồ sơ QR độc lập; trạng thái hiệu lực, chưa đến ngày cấp, hết hạn và thu hồi được phân biệt.
- Thay dịch vụ QR bên thứ ba bằng bộ mã hóa QR chạy cục bộ trong Worker và tạo ảnh PNG tại chỗ. URL/token xác minh không còn được gửi sang dịch vụ tạo QR bên ngoài. Thêm kiểm tra ảnh PNG đầu ra bằng test tích hợp; một mẫu đầu ra còn được kiểm tra giải mã bằng OpenCV trong phiên phát triển.
- Thêm thao tác tạo và lưu mẫu thẻ tái sử dụng qua API, kiểm tra tên mẫu trùng và dữ liệu không hợp lệ.
- Giữ trình thiết kế thẻ hai mặt hiện có và bổ sung cấu hình màu nền, phông chữ được cho phép, căn lề, chữ đậm, vị trí/kích thước thành phần, ảnh tùy chọn; QR bắt buộc ở mặt trước. Không chèn logo mặc định lên thiết kế thẻ khi thiếu ảnh.
- Giữ nội dung chuẩn, khóa ở mặt sau; hỗ trợ thẻ ngang 86 × 54 mm và dọc 54 × 86 mm; giữ luồng tạo PDF hai mặt với kích thước trang thẻ.
- Bổ sung kiểm thử cho tạo QR, tra cứu công khai, chống trùng mã, không rò rỉ ghi chú riêng tư, thu hồi, trạng thái QR tương lai, tạo/lưu mẫu thẻ và định dạng PNG.

## Kiểm tra đã chạy

- `npm run build`: kiểm tra cú pháp Worker và frontend; thành công.
- `npm test`: release checks, migration trên SQLite mới, kiểm tra SQL tĩnh và test tích hợp API giả lập; thành công với **47/47 kiểm tra API/tích hợp** trong lần chạy sau cùng trước bước đóng gói.
- Kiểm tra QR PNG phát sinh: chữ ký PNG hợp lệ, tệp mở được bằng Pillow, OpenCV giải mã được URL xác minh đúng như đầu vào.
- Cần chạy lại `npm test` sau cùng trước khi bàn giao; không xem kết quả trước đó là bằng chứng cho mọi thay đổi tiếp theo.

## Giới hạn cần nói rõ

- Chưa triển khai lên Cloudflare; chưa chạy migration trên D1 production và chưa thử smoke test với R2 production.
- Chưa kiểm thử thao tác giao diện đầy đủ bằng trình duyệt thật/thiết bị di động. Xuất PDF, kéo thả và render hai mặt vẫn cần kiểm thử giao diện thực tế sau khi deploy thử.
- Bộ test API hiện chạy trên SQLite trong bộ kiểm thử, không chứng minh toàn bộ hành vi tương thích với D1 production.
- Source được cung cấp để triển khai và kiểm chứng tiếp; không tuyên bố hệ thống live đã thay đổi.

## Bản sửa lỗi bổ sung — 09/10/2026

- Sửa lỗi `Cannot access 't' before initialization` khi mở phần cấu hình/thiết kế thẻ. Nguyên nhân: template literal dựng giao diện đọc `t.accent` trước khi biến `t` được khai báo; lỗi JavaScript temporal dead zone khiến `mountCardDesignStudio()` throw và khối cấu hình hiển thị “Không thể tải cấu hình”.
- Đã chuyển khởi tạo `type` và `t = templateFor(type)` lên trước khi dựng HTML; giữ nguyên các luồng chức năng còn lại.
- Xác minh: `node --check public/app.js` đạt; `npm run build` đạt; `npm test` đạt, 47/47 kiểm tra tích hợp API.
- Chưa triển khai lên Cloudflare production; cần thay ZIP trên môi trường triển khai và kiểm tra trực tiếp giao diện sau deploy.

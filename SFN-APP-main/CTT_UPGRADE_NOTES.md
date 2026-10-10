# CTT Sky First — gói nâng cấp giao diện

## Đã thay đổi
- Làm mới giao diện `/ho-so` và `/gcn`: hai trang có bố cục riêng, banner công nghệ xanh, khu vực tra cứu nổi, thẻ lợi ích và phần hướng dẫn.
- Làm mới chân trang theo thiết kế Sky First Network xanh đậm, hiệu ứng đường sóng, liên kết và nút lên đầu trang.
- Việt hóa các nhãn giao diện công khai đã xác định: các nhãn xác thực/khám phá/kết nối, trung tâm biểu mẫu, tin tức và liên kết hỗ trợ.
- Bỏ nội dung quảng bá “mã cũ trước khi nâng cấp” khỏi trang xác thực; thay bằng mô tả trung tính về thông tin đối chiếu.
- Tra cứu hồ sơ dùng POST để gửi mã hồ sơ và email trong phần thân yêu cầu thay vì URL; Worker tiếp tục hỗ trợ GET cũ để tương thích ngược.
- Không thêm bảng, không xóa dữ liệu, không đổi xác thực/RBAC hoặc quy tắc tra cứu ở cơ sở dữ liệu.

## Kiểm tra đã thực hiện
- `node scripts/validate.mjs`: PASS.
- `node --check public/digital-portal.js`: PASS.
- `node --check src/public.js`: PASS.
- `D1_CTT_SUPER_SYSTEM_POLISH.sql` chạy thử trên SQLite tạm tạo từ migration `0001_schema.sql`: PASS, cập nhật/đọc lại 8 cài đặt.

## Giới hạn
- Chưa deploy lên Cloudflare, chưa chạy truy vấn trên D1 production, chưa kiểm thử đầu-cuối với mã hồ sơ/GCN thật.
- Hình minh họa là CSS, không tự tạo bản ghi chứng nhận hoặc số liệu.
- SQL kèm theo chỉ cập nhật cài đặt hiển thị; không cần migration schema mới cho các thay đổi giao diện này.

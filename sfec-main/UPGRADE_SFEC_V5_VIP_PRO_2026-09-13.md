# SFEC V5 — VIP PRO UI + Office Email + Student Portrait

- Giao diện public chuyển sang hệ màu đa sắc tím / hồng / cam / cyan / xanh lá theo từng khối, giảm cảm giác trắng-xanh đơn điệu.
- Admin Control Center, KPI, sidebar, quick actions, Website Studio và Media có màu phân khu rõ ràng.
- Sửa liên kết Học sinh/Học viên về biểu mẫu lớp học thực tế (#form/class), tránh route #form/student không tồn tại.
- Biểu mẫu lớp học yêu cầu ảnh chân dung học viên (JPG/PNG/WEBP), có xem trước ảnh trước khi gửi.
- Toàn bộ biểu mẫu gửi bản nội bộ về sfec.vanphong@gmail.com.
- Email xác nhận người đăng ký gửi từ SFEC · The Sky First English Club <sfec@skyfirst.io.vn>.
- Email xác nhận và email nội bộ được đổi sang HTML đa sắc, có mã hồ sơ và nút tra cứu.
- Migration cần chạy: migrations/0007_sfec_vip_pro_brand_email_photo.sql

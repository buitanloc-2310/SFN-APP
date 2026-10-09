# SKY FIRST MEMBER DIGITAL CENTER — V4 · Nâng cấp source thực tế (08/10/2026)

**Trạng thái:** bản mã nguồn để triển khai thử nghiệm, **chưa phải xác nhận production 100%**. Nâng cấp trên source `tk-main` hiện hữu, không xây lại, không xóa bảng hoặc dữ liệu cũ. Giữ Cloudflare Workers/Pages Assets, D1 (`tk`) và R2 (`tksfn`).

## 1. Đã triển khai trong mã nguồn

### Trang công khai và trải nghiệm
- Login: khu vực số liệu hoạt động thật có hiệu ứng đếm số tăng dần, tôn trọng thiết lập giảm chuyển động và tải dữ liệu từ `/api/public/portal-config`.
- Màn hình **Đăng ký thành viên** và **Tra cứu trạng thái** tách khỏi popup, ở `/register`, `/registration-status`, chuyển trong cùng tab SPA. Biểu mẫu đăng ký 4 bước dùng logic gửi hồ sơ hiện tại; các trường bắt buộc vẫn kiểm tra.
- Dòng email liên hệ và link `mailto:` được sửa phân biệt `support@skyfirst.io.vn` (hỗ trợ) và `lienhe@skyfirst.io.vn` (liên hệ chung).
- Đã điều chỉnh bố cục, khối đăng ký, độ tương phản số thống kê, biểu mẫu và các breakpoint cho màn hình nhỏ.

### Quản trị và thành viên
- Thay 14 lệnh reload toàn trang sau thao tác sửa hồ sơ admin bằng cập nhật phần liên quan, giữ tab và ngữ cảnh đang thao tác.
- Quản trị SUPER ADMIN có màn hình **Quản trị giao diện & thống kê**: sửa nhãn, nguồn dữ liệu tự động/thủ công, số liệu, bật/tắt chỉ số, thông điệp; lưu D1 để xuất bản mà không cần deploy lại.
- Thêm **Card Design Studio** trong khu vực quản trị: chỉnh màu nhận diện, phụ đề và tải logo PNG/JPEG/WebP lên R2 cho từng loại thẻ; các bản ghi thẻ thật lấy thiết kế từ `card_types.template_json`.
- Thẻ số có mẫu riêng cho nhóm lãnh đạo, màu/logo theo loại; **QR xác minh riêng** dựa trên `verify_token` (đã có ở cơ chế cấp thẻ). Không cho in/xác minh nếu thẻ thiếu token; trang verify có kiểm tra tình trạng hiệu lực. Không có tùy chọn tắt QR.
- **CV một trang A4** qua trình duyệt In → Lưu thành PDF, mẫu thiết kế 2 cột, giới hạn số mục tiêu biểu để tránh tràn, tùy chọn ẩn/hiện email và điện thoại (ẩn theo mặc định khi người dùng từ chối).
- Quản trị có hành động **cấm tài khoản có thời hạn/vô thời hạn**, ghi lý do, gỡ cấm, tùy chọn gửi email, thu hồi phiên. Tầng API kiểm tra lệnh cấm ngay cả khi còn cookie đăng nhập. Không cho tự cấm tài khoản hoặc cấm SUPER_ADMIN.
- Duyệt hồ sơ có 3 chế độ gửi email: gửi ngay, duyệt trước-gửi sau, không gửi. Có API gửi email phê duyệt sau; **không gửi mật khẩu tạm trong email**.
- Mã thành viên cấp mới dạng `SFN-YY-XXXXXXXX`, random crypto, kiểm tra trùng; mã cũ giữ nguyên.

## 2. Migration D1 mới
- `migrations/0012_member_v4_studio_restrictions.sql`: thêm bảng `account_restrictions`, index và cấu hình thống kê khởi tạo trong `system_settings`.
- **QUAN TRỌNG:** đây là migration bắt buộc phải chạy **trước** khi deploy source mới. Các truy vấn phiên đăng nhập và login của V4 đã tham chiếu `account_restrictions`; nếu deploy Worker trước khi chạy migration thì đăng nhập có thể lỗi 500.
- Migration chỉ thêm cấu trúc mới, không xóa dữ liệu hiện tại. Đừng chạy lại `SETUP_D1_CONSOLE.sql` hoặc xóa D1 production.

## 3. Quy trình triển khai an toàn
1. Sao lưu D1 production và tài nguyên R2. Ghi lại deployment hiện tại để có thể rollback. Kiểm tra tên các binding trong `wrangler.jsonc` có đúng với môi trường thực tế.
2. Cài Wrangler và đăng nhập Cloudflare nếu cần. Đứng trong thư mục `tk-main/tk-main`.
3. Chạy `npm run check` và `npm test`.
4. **Trước deploy**, áp dụng migration: `npm run db:migrate:remote`. Xem trước và xác nhận đúng database/môi trường đích; không thực hiện khi chưa backup.
5. Chạy `npm run deploy` để xuất bản Worker và assets.
6. Kiểm tra đăng ký, tra cứu, login, xét duyệt, email, tài khoản, quản trị, thẻ/QR, CV, mobile ở website thật. Kiểm tra thiết lập dịch vụ gửi email Resend, xác minh địa chỉ người gửi `support@skyfirst.io.vn` và reply-to `lienhe@skyfirst.io.vn`.
7. Nếu có lỗi, khôi phục bản triển khai cũ; với migration dạng thêm bảng này nên tránh tự ý xóa bảng mới khi rollback.

## 4. Kết quả kiểm thử cục bộ
- `npm run check`: PASS (syntax Worker/frontend).
- `npm test`: PASS (kiểm tra release, chuẩn schema D1 và 13/13 kiểm thử tích hợp sẵn trong dự án).
- Áp dụng toàn bộ 11 tệp migration vào SQLite trống: PASS.
- Browser mock smoke: render được màn hình login, bộ số liệu, đăng ký 4 bước, không có JavaScript exception trong các lượt kiểm thử giao diện đã thực hiện.
- **Giới hạn:** browser smoke dùng API giả lập để xem UI, không thay thế kiểm tra Worker, D1/R2 production và kết nối email thật.

## 5. Chưa hoàn tất so với toàn bộ Master V4
- Chưa tạo CMS visual cho *mọi* trang/mọi trường nội dung; Studio mới quản trị số liệu và mẫu thẻ.
- Chưa có quản lý xóa mềm/khôi phục đầy đủ, nhập hàng loạt Excel, quy trình phê duyệt nhiều cấp và bàn giao chức vụ tự động.
- Chưa triển khai hệ thống kích hoạt mật khẩu bằng email token riêng cho tài khoản mới; email phê duyệt không chứa mật khẩu, còn thao tác bàn giao mật khẩu tạm hiện sử dụng cơ chế sẵn có và cần kiểm soát chặt chẽ.
- Chưa xác minh PDF CV thực tế trên tất cả trình duyệt và trường hợp dữ liệu cực dài; hiện xuất qua trình duyệt, không phải trình dựng PDF phía máy chủ.
- Việc cấp QR ở service có sẵn; hiển thị QR đang phụ thuộc dịch vụ ảnh QR bên ngoài, cần cân nhắc thay bằng QR tự render nội bộ để tăng độ ổn định.
- Chưa chạy deploy Cloudflare thực tế hoặc kiểm thử với D1/R2/email production. **Không được gọi đây là bản production hoàn tất 100%.**

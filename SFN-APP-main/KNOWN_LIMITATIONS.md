# BÁO CÁO GIỚI HẠN MÔI TRƯỜNG & GIẢ ĐỊNH KỸ THUẬT MINH BẠCH (KNOWN LIMITATIONS & ASSUMPTIONS)

Tuân thủ nguyên tắc trung thực kỹ thuật trong yêu cầu (không giả vờ đã thực hiện việc phụ thuộc dịch vụ ngoài), tài liệu này liệt kê rõ các giới hạn của môi trường sandbox phát triển và phương án kỹ thuật đã được triển khai để sẵn sàng kết nối khi đưa lên hạ tầng thực tế.

## 1. Giới hạn của môi trường Sandbox thực thi

1. **Không kết nối trực tiếp tới hệ thống Cloudflare Production đang chạy**:
   - Môi trường sandbox không có mạng ra ngoài và không giữ khóa API Cloudflare Production của đơn vị. Do đó, mọi thay đổi được thực hiện và kiểm thử hoàn chỉnh trên bản sao mã nguồn và cơ sở dữ liệu SQLite/D1 tương thích 100% thông qua `scripts/test-all.mjs`. Việc đẩy lên môi trường thật sẽ do Quản trị viên hệ thống thực hiện theo hướng dẫn tại `DEPLOYMENT_AND_VERIFICATION.md`.
2. **Tích hợp WordPress & Trình dựng trực quan (Mục 5.2)**:
   - Cloudflare Workers chạy trên runtime V8 cô lập (Edge JavaScript), không chạy trực tiếp tiến trình PHP/MySQL của một máy chủ WordPress độc lập bên trong cùng Worker.
   - **Giải pháp tương thích đã triển khai thật trong mã nguồn**:
     - Xây dựng **Trình dựng trang trực quan kéo thả 21 loại khối** ngay trong Admin (`#admin/page-builder`) quản trị trực tiếp cả 13 trang hệ thống và các trang `/trang/...` trên D1.
     - Xây dựng bộ chuyển đổi hai chiều **Headless WordPress / Gutenberg Adapter** (`/api/admin/cms/wordpress/config`, `/api/admin/cms/wordpress/import`, `/api/admin/cms/wordpress/export/:id`) cho phép nhập trực tiếp nội dung từ WordPress REST API hoặc mã khối Gutenberg (`<!-- wp:... -->`) thành các khối cấu trúc JSON an toàn trên D1 (tự động loại bỏ mọi thẻ `<script>`/`<style>` nguy hiểm), và xuất bất kỳ trang CMS nào của Sky First ra định dạng Gutenberg Block Markup chuẩn.
3. **Dịch vụ gửi Email bên ngoài (`RESEND_API_KEY` / Cloudflare Email Binding)**:
   - Khi chưa gắn khóa `RESEND_API_KEY` trong môi trường kiểm thử cục bộ, hệ thống vẫn kết xuất đầy đủ nội dung HTML từ mẫu chuẩn `email_universal_auto.html` và lưu vào bảng `email_logs` ở trạng thái `pending` để không làm gián đoạn luồng nộp hồ sơ hay phát hành chứng nhận, đồng thời hiển thị rõ số lượng thư `pending` trên bảng điều khiển Super Admin.
4. **Cổng đối soát thanh toán ngân hàng tự động (`SPONSORSHIP_WEBHOOK_SECRET`)**:
   - Mã QR chuyển khoản trên trang `/tai-tro` được sinh theo đúng chuẩn **EMVCo / VietQR CRC-16** kèm mã tham chiếu định danh `SFN-...`. Khi người ủng hộ tự nhấn *"Tôi đã hoàn tất chuyển khoản"*, giao dịch chỉ được ghi nhận ở trạng thái `transfer_reported` (`pending`) và **tuyệt đối không cộng vào Số tiền thực nhận** cho đến khi nhận được Webhook có chữ ký số HMAC-SHA256 hợp lệ tại `/api/webhooks/sponsorship/payment` hoặc được người duyệt thứ hai xác minh sao kê trong Admin.

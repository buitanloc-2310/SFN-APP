# CẨM NANG VẬN HÀNH DÀNH CHO QUẢN TRỊ VIÊN (ADMIN USER GUIDE — V10)

## 1. Truy cập và điều hướng trong Trung tâm Quản trị

- **Đường dẫn đăng nhập**: `https://app.skyfirst.io.vn/admin/login`
- **Tìm kiếm nhanh chức năng**: Nhấn phím `/` từ bất kỳ màn hình quản trị nào để đưa con trỏ vào ô **Tìm chức năng…** ở thanh bên trái, hoặc nhấn `Esc` để xóa bộ lọc.
- **Giữ vị trí cuộn menu**: Thanh điều hướng bên trái tự động ghi nhớ vị trí cuộn, trạng thái đóng/mở của từng nhóm danh mục và từ khóa tìm kiếm trong suốt phiên làm việc.
- **Chuyển đổi ngôn ngữ cổng công khai**: Nhấn nút `🌐 VI / EN` trên thanh công cụ phía trên để kiểm tra nhanh giao diện công khai ở chế độ Tiếng Việt hoặc Tiếng Anh.

## 2. Quản trị Nội dung Toàn trang & Trình dựng Trực quan (`#admin/page-builder`)

1. **Chỉnh sửa 13 Trang hệ thống và Trang mở rộng (`/trang/...`)**:
   - Dùng bộ lọc **Loại trang** để chọn **Trang hệ thống (System Routes)** (như `/`, `/gioi-thieu`, `/chuong-trinh`, `/su-kien`, `/tai-tro`, `/tai-lieu`, `/bieu-mau`, `/ho-so`, `/tra-cuu`, `/gcn`, `/an-toan`, `/ho-tro`, `/admin/login`) hoặc **Trang mở rộng (`/trang/...`)**.
   - Nhấn **Mở Trình dựng** để thêm, kéo thả sắp xếp, nhân bản hoặc sửa thuộc tính của 21 loại khối nội dung (Hero, Tiêu đề, Đoạn văn, Thông báo, Nhiều cột, Lưới thẻ, Bảng dữ liệu, Số liệu, FAQ, Tabs, Timeline, CTA, Video, Hình ảnh, Nhúng PDF, Nhúng Biểu mẫu, Danh sách động, Hướng dẫn, Khối dùng chung, Nút bấm, Danh sách).
2. **Soạn thảo Song ngữ VI / EN**:
   - Trong Trình dựng trang, nhấn nút **🇻🇳 Khối VI** hoặc **🇬🇧 Khối EN** trên thanh công cụ để chuyển đổi và biên tập bố cục khối riêng cho từng ngôn ngữ, đồng thời điền **Tiêu đề (EN)** và **Mô tả SEO (EN)** ở cột bên trái.
3. **Khối dùng chung (`🧩 Khối dùng chung`) & Mẫu bố cục (`📐 Mẫu bố cục`)**:
   - Khi sửa một khối dùng chung, hệ thống hiển thị rõ danh sách và số lượng trang đang nhúng khối đó để quản trị viên kiểm soát phạm vi ảnh hưởng trước khi lưu. Hệ thống tự động chặn xóa khối dùng chung nếu đang có trang sử dụng.
4. **Quy trình Duyệt & Xuất bản có kiểm soát**:
   - Thực hiện theo đúng thứ tự: **Lưu bản nháp** → **👁 Xem thử** (xem thử an toàn không làm công khai bản nháp) → **1. Gửi duyệt** → **2. Phê duyệt** (yêu cầu người duyệt độc lập với người biên tập) → **3. Xuất bản công khai** hoặc **⏱ Lên lịch xuất bản**.
5. **Đồng bộ WordPress / Gutenberg (`⇄ WordPress / Gutenberg`)**:
   - Nhấn **⇄ WordPress / Gutenberg** để nhập nội dung từ WordPress REST API hoặc mã chú thích khối `<!-- wp:... -->` vào D1 dưới dạng các khối cấu trúc an toàn, hoặc nhấn **⬇ Xuất Gutenberg** trong Trình dựng để lấy mã chuẩn Gutenberg.

## 3. Quản trị Nhận diện, Design System & Menu (`#admin/site`, `#admin/header`, `#admin/footer`)

- **Nhận diện & Design System (`#admin/site`)**: Thay đổi tên hệ thống, khẩu hiệu, tiêu đề/mô tả Hero song ngữ VI/EN và chỉnh sửa trực tiếp bảng màu (`Primary`, `Navy`, `Accent`, `Surface`), font chữ, độ bo góc và độ rộng khung trang.
- **Thanh điều hướng & Menu (`#admin/header`)**: Thêm, sửa nhãn VI/EN, đổi thứ tự (`↑`/`↓`) hoặc bật/tắt từng mục trên thanh menu chính.
- **Chân trang & Hệ sinh thái (`#admin/footer`)**: Quản lý thông tin liên hệ, thông điệp trích dẫn nguồn và liên kết tới đúng **7 website chuẩn** của hệ sinh thái Sky First (`app`, `main`, `ctt`, `mail`, `member`, `sfec`, `exam`).

## 4. Điều khiển 6 Chế độ Vận hành, Kiểm tra Trước Mở lại & Sự cố (`#admin/maintenance`)

- Chọn 1 trong 6 chế độ vận hành máy chủ:
  1. `normal`: Hoạt động bình thường.
  2. `manual_maintenance`: Bật trang bảo trì toàn hệ thống (Quản trị viên đã đăng nhập vẫn xem được trang để kiểm tra).
  3. `scheduled_maintenance`: Tự động hiển thị thông báo trước giờ bảo trì và tự động bật/tắt bảo trì theo khung giờ `scheduled_start` – `scheduled_end`.
  4. `emergency_maintenance`: Ngắt khẩn cấp toàn bộ truy cập công khai.
  5. `read_only`: Cho phép xem và tra cứu bình thường nhưng khóa tạm thời việc gửi biểu mẫu và tạo giao dịch mới.
  6. `publishing_paused`: Khóa thao tác xuất bản trang CMS mới trong khi vẫn giữ các dịch vụ khác hoạt động.
- Trước khi chuyển từ chế độ bảo trì về `normal`, xem bảng **Pre-Reopen Check** và **Release QA Gate** ngay bên phải để đảm bảo kết nối D1, R2, bản sao lưu SHA-256 và dữ liệu SEO đều đạt chuẩn.

## 5. Quản trị Minh bạch Tài trợ & VietQR (`#admin/sponsorship`)

- Cấu hình mã ngân hàng NAPAS (`bank_code`), tên ngân hàng, số tài khoản và tên chủ tài khoản cho từng chiến dịch để cổng công khai tự động sinh mã **VietQR** kèm nội dung chuyển khoản định danh `SFN-...`.
- Đối soát các lệnh chuyển khoản trong bảng **Giao dịch đối soát** và **Lệnh chuyển khoản QR**, hoặc nhấn **⬇ Xuất CSV đối soát** để tải bảng kê phục vụ kiểm toán.

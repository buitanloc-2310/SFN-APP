# Sky First — Báo cáo triển khai 10 giao diện tham chiếu và rà soát thương hiệu

- **Đầu vào:** `SFN-APP-V7-SKY-FIRST-DIGITAL-INFORMATION-SYSTEM (1).zip`
- **Tên sản phẩm hiển thị:** Hệ thống Thông tin Số Sky First
- **Ngày xử lý:** 23/10/2026
- **Phạm vi:** dựng giao diện từ HTML/CSS/JavaScript/SVG hiện có, đồng bộ nhận diện, bổ sung kiểm tra tĩnh riêng cho 10 ảnh.
- **Không thực hiện:** nhúng ảnh chụp giao diện vào HTML/CSS; triển khai production; chạy migration từ xa; sửa schema D1/R2 hoặc thay đổi luồng xác thực/phân quyền hiện hữu.

## 1. Ánh xạ 10 ảnh tham chiếu tới mã nguồn

| STT | Nội dung ảnh | Route/thành phần | Mã nguồn chính | Triển khai ở cấp mã nguồn | Kiểm tra trình duyệt trực tiếp |
|---:|---|---|---|---|---|
| 01 | Sự kiện & hoạt động; danh sách và trạng thái rỗng | `/su-kien` | `public/digital-portal.js`, `public/digital.css` | Đã ánh xạ vào `programsPage(..., 'events')`, tìm kiếm/lọc và empty state dùng dữ liệu công khai hiện hữu | Chưa xác minh — Chromium không khởi chạy ổn định trong container |
| 02 | Đăng nhập khu vực quản trị | `/admin/login` | `public/app.js`, `public/digital.css` | Đã dựng form đăng nhập bằng HTML/CSS với logo/tên sản phẩm, trường email/mật khẩu, hiển thị mật khẩu và giữ luồng API đăng nhập/2FA hiện có | Chưa xác minh trực tiếp trên trình duyệt; luồng API được bao phủ trong bộ kiểm thử hồi quy cô lập |
| 03 | Footer công nghệ, nhóm liên kết, bản quyền và thông báo trích dẫn | Footer dùng chung | `public/index.html`, `public/digital.css` | Đã dựng bằng HTML/CSS; có đoạn quy định nguồn trích dẫn và liên kết “Đăng Nhập Quản Trị” nhỏ ở mép dưới bên phải, trỏ `/admin/login` | Chưa xác minh trực tiếp trên trình duyệt |
| 04 | Trang chủ: hero, ô tìm kiếm, lối tắt, 6 thẻ màu, 5 chỉ số | `/` | `public/index.html`, `public/digital-portal.js`, `public/digital.css` | Đã dựng bằng markup/CSS/SVG; chương trình, sự kiện, tài liệu, thông báo lấy từ API; 5 chỉ số không dùng số giả cố định | Chưa xác minh trực tiếp trên trình duyệt |
| 05 | Thư viện tài liệu, tìm kiếm và trạng thái chưa có tài liệu | `/tai-lieu` | `public/digital-portal.js`, `public/digital.css` | Đã ánh xạ vào `programsPage(..., 'resources')`, giữ route và nguồn dữ liệu tài liệu công khai | Chưa xác minh trực tiếp trên trình duyệt |
| 06 | Ảnh tài liệu trùng/biến thể cùng bố cục | `/tai-lieu` | `public/digital-portal.js`, `public/digital.css` | Dùng chung route và thành phần với ảnh 05 để tránh tạo trang trùng lặp không cần thiết; trạng thái không có dữ liệu thể hiện rõ | Chưa xác minh trực tiếp trên trình duyệt |
| 07 | Tra cứu hồ sơ với mã hồ sơ và email đã đăng ký | `/ho-so` | `public/digital-portal.js`, `public/digital.css` | Đã ánh xạ vào `caseCenter`, giữ endpoint tra cứu và kiểm tra cả mã hồ sơ lẫn email phía máy chủ | Chưa xác minh trực tiếp trên trình duyệt; tra cứu được bao phủ bởi kiểm thử API cô lập |
| 08 | Công khai tài trợ, phân biệt mục tiêu/cam kết/thực nhận/đã chi/còn lại | `/tai-tro` | `public/digital-portal.js`, `public/digital.css` | Đã dựng khu vực minh bạch; dữ liệu hiển thị theo API công khai, thông báo rỗng khi không có dữ liệu đã phê duyệt; không cộng gộp cam kết và thực nhận | Chưa xác minh trực tiếp trên trình duyệt; tích hợp API được kiểm tra trong bộ kiểm thử cô lập |
| 09 | An toàn số, hướng dẫn xử lý sự cố và form báo cáo | `/an-toan` | `public/digital-portal.js`, `public/digital.css` | Đã ánh xạ vào `safetyCenter`, có nội dung hướng dẫn và form báo cáo theo route/API hiện hữu | Chưa xác minh trực tiếp trên trình duyệt; API báo cáo được bao phủ trong kiểm thử cô lập |
| 10 | Biểu mẫu điện tử, điều kiện/hướng dẫn và danh mục biểu mẫu | `/bieu-mau` | `public/digital-portal.js`, `public/digital.css` | Đã ánh xạ vào `formCenter`, giữ cơ chế danh mục biểu mẫu và luồng mở biểu mẫu hiện có | Chưa xác minh trực tiếp trên trình duyệt; chức năng API được bao phủ trong bộ kiểm thử cô lập |

**Phạm vi đối chiếu:** đã nhận diện đủ 10 ảnh. Ảnh 05 và 06 là hai biến thể của cùng trang Tài liệu, do đó dùng cùng một route/thành phần thay vì tạo bản sao giao diện. Trang Chứng nhận `/gcn` vẫn được giữ trong thanh điều hướng và hệ thống route hiện hữu; đây không phải một ảnh độc lập trong bộ 10 ảnh được kiểm kê lần này.

## 2. Các thay đổi chính

- Trang chủ được tổ chức thành các khối có chiều rộng thực, với hero/search, lối tắt, sáu thẻ chức năng mang màu riêng, năm chỉ số, chương trình, sự kiện, thư viện tài liệu, thông báo và phần giới thiệu ngắn.
- Bố cục responsive bổ sung breakpoint cho desktop/tablet/mobile; không dùng screenshot nguyên trang làm nền hoặc làm `<img>` thay giao diện. Biểu tượng trang công khai ưu tiên ký hiệu/CSS đồng nhất, không dùng emoji làm nhận diện giao diện.
- Trang đăng nhập quản trị được dựng bằng HTML/CSS và vẫn sử dụng API đăng nhập hiện hữu.
- Footer dùng chung chứa điều khoản bản quyền/trích dẫn đã được yêu cầu trước đó và liên kết nhỏ `Đăng Nhập Quản Trị` đến `/admin/login`.
- Các trạng thái chưa có dữ liệu trình bày trung thực; không tự chèn thống kê giả hoặc danh sách giả.
- Cache/version frontend và service worker được đồng bộ để tránh tiếp tục dùng bản CSS/JS cũ sau cập nhật.

## 3. Chuẩn hóa thương hiệu hiển thị

Tên sản phẩm được chuẩn hóa hiển thị thành **Sky First** và **Hệ thống Thông tin Số Sky First**. Các chuỗi nội dung động hiển thị được chuẩn hóa qua `normalizeBrandString`/`normalizeVisibleBrand`; metadata và các mẫu email hiện có cũng dùng tên sản phẩm thống nhất trong phạm vi đã chỉnh sửa.

Đã kiểm tra hàm chuẩn hóa với các trường hợp `SKY FIRST NETWORK`, `SkyFirst`, `skyfirst`, `app@skyfirst.io.vn`, `support@skyfirst.io.vn`, `https://app.skyfirst.io.vn/admin/login` và `skyfirst.ec@gmail.com`: tên thương hiệu trong nội dung thường được đổi sang `Sky First`, còn email/URL giữ nguyên chính xác. Logo ảnh gốc được giữ nguyên để không làm biến dạng nhận diện.

Các ngoại lệ được giữ có chủ đích:
- Tên miền, URL, địa chỉ email, khóa và tên biến kỹ thuật, tên bảng/migration, route, mã biểu mẫu/mã đơn vị không đổi chỉ vì có chuỗi `skyfirst` hoặc `SFN`.
- Tên hiển thị của các đơn vị/website khác chỉ được giữ nguyên khi đó là nhãn đơn vị chính thức hoặc mã định danh, không phải tên thương hiệu chính.
- Không chỉnh sửa migration/seed để tránh thay đổi dữ liệu hiện hữu hoặc checksum migration.

## 4. Các tệp thay đổi

### Tệp hiện hữu đã chỉnh sửa (19)

- `package.json`
- `public/app.js`
- `public/bootstrap.js`
- `public/digital-portal.js`
- `public/digital.css`
- `public/email-template.html`
- `public/email-templates/account-notification.html`
- `public/email-templates/application-received.html`
- `public/email-templates/application-result.html`
- `public/email-templates/application-status-updated.html`
- `public/email-templates/certificate-issued.html`
- `public/email-templates/fundraising-update.html`
- `public/email-templates/information-required.html`
- `public/email-templates/registration-confirmation.html`
- `public/email-templates/submission-confirmation.html`
- `public/email-templates/support-ticket-received.html`
- `public/index.html`
- `public/sw.js`
- `src/public.js`

### Tệp mới (2)

- `scripts/validate-ui-reference.mjs` — kiểm tra ánh xạ 10 ảnh, cấu trúc trang chủ, liên kết footer, breakpoint, cache và không nhúng ảnh giao diện.
- `docs/REFERENCE_IMPLEMENTATION_V8.md` — báo cáo triển khai, kiểm thử, ngoại lệ thương hiệu và bảng nghiệm thu.

Không có tệp nào bị xóa. Toàn bộ 9 tệp migration trong ZIP đầu vào được so sánh theo byte và giữ nguyên; schema và cấu hình binding D1/R2 không bị thay đổi trong lượt này.

## 5. Kết quả kiểm tra

| Kiểm tra | Kết quả | Diễn giải |
|---|---|---|
| `npm run validate` | PASS | Validator dự án thành công |
| `npm run validate:ui` | PASS — 17/17 | Ánh xạ 10 ảnh và các điều kiện giao diện tĩnh đạt |
| `node scripts/validate-xanh-integration.mjs` | PASS — 6/6 | Kiểm tra tích hợp Xanh đạt |
| `node --check` cho `public/digital-portal.js`, `public/app.js`, `public/bootstrap.js`, `src/public.js`, `src/index.js`, `scripts/test-all.mjs`, `scripts/validate-ui-reference.mjs` | PASS | Không có lỗi cú pháp JavaScript trong các tệp trên |
| Kiểm tra chuẩn hóa email/URL | PASS — 7/7 case | Xác nhận các email/URL thử nghiệm không bị viết lại |
| Bộ kiểm thử hồi quy cô lập tăng tốc | PASS — 59/59 | Bao phủ auth/RBAC, route/API, tra cứu, chứng nhận, tài trợ, an toàn, email, PDF/CMS và R2 trong môi trường thử nghiệm cô lập |
| `npm test` nguyên bản | TIMEOUT | Harness gốc gọi Python/SQLite riêng cho nhiều truy vấn; không hoàn tất trong thời gian cho phép nên không được tính là PASS |
| Chụp ảnh/kiểm tra giao diện bằng Chromium | BLOCKED | Chromium headless treo ngay cả với trang HTML tối thiểu trong container; không thể xác nhận pixel/hiển thị trực tiếp tại đây |

## 6. Kết luận nghiệm thu

- **Ánh xạ và triển khai cấp mã nguồn:** 10/10 ảnh tham chiếu đã được ánh xạ tới các route/thành phần HTML/CSS/JS/SVG thực tế.
- **Ảnh chụp được nhúng thay giao diện:** không phát hiện; validator tĩnh xác nhận HTML/CSS/JS không tham chiếu tên các ảnh screenshot đã cung cấp hoặc data URI ảnh toàn trang.
- **Kiểm thử mã nguồn/API trong môi trường cô lập:** các kết quả nêu trên đã đạt, gồm 59/59 test bằng harness tăng tốc.
- **Nghiệm thu hiển thị trực tiếp:** **chưa thể đánh dấu Đạt đủ 10/10 theo tiêu chuẩn nghiệm thu nghiêm ngặt**, vì không chạy được Chromium headless trong container. Cần mở ZIP trên staging/trình duyệt thật và xác minh 10 route ở desktop/tablet/mobile trước khi triển khai production.
- Không triển khai lên production, không chạy migration từ xa và không thay đổi backend/schema, xác thực hoặc RBAC trong lượt này.

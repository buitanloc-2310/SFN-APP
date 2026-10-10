# CTT V5 — Báo cáo triển khai giao diện theo ảnh tham chiếu

**Ngày:** 10/10/2026  
**Gói nguồn:** SFN-APP-CTT-UI-Upgrade-V5-REFERENCE-IMPLEMENTED.zip

## 1. Phạm vi đã chỉnh

V5 lấy 5 ảnh tham chiếu và phần nội dung SFEC người dùng gửi làm yêu cầu giao diện/chức năng cho Cổng Thông tin Số Sky First.

- **Trang chủ:** hero công nghệ nền xanh đậm, các điểm nhấn cyan/tím, khu vực tìm kiếm, số liệu, truy cập nhanh, chương trình SFEC, sự kiện, tin mới, tài nguyên, tiện ích và hệ sinh thái. Các số liệu vẫn lấy theo cấu hình hệ thống; không có dữ liệu D1/config hợp lệ thì hiển thị trạng thái thiếu dữ liệu, không thay bằng số liệu minh họa.
- **Tin tức & thông báo:** danh sách có thẻ nổi bật, tìm kiếm, liên kết tới bài viết chi tiết theo slug/ID. Ảnh bìa sử dụng file được lưu trên hệ thống khi có `cover_file_id`; nếu chưa có thì dùng minh họa SVG cục bộ.
- **Tra cứu thông tin:** giữ các lối đi riêng cho tra cứu giấy đã phát hành và tra cứu hồ sơ, có liên kết trực tiếp đến các route chức năng hiện có.
- **Hoạt động & sự kiện:** trang danh sách, tìm kiếm, bộ lọc Tất cả/Sắp diễn ra/Đang diễn ra/Đã kết thúc và trang chi tiết theo ID. Khi chưa có sự kiện công khai, hiển thị empty state thay cho dữ liệu giả.
- **Chương trình:** danh sách và trang chi tiết theo ID. Các thẻ có minh họa riêng theo loại nội dung (chương trình chung, Reading, Listening, Speaking), trạng thái, thông tin tổng quan và nút liên hệ. Thứ tự ưu tiên của các chương trình đã có trong dữ liệu là Tiếng Anh Trung Cấp B1–B2, Reading, Listening, Speaking.
- **Tiện ích số:** có trang riêng với lối đi tới giấy đã phát hành, hồ sơ, biểu mẫu, tìm kiếm toàn Cổng và danh sách tài nguyên công khai từ API.
- **Hệ sinh thái:** giữ đúng tên 4 đơn vị: Trang Thông Tin Điện Tử Sky First; Trung Tâm TNV Sky First; SFEC – Sky First Education Club; Sky First Learning Center. Nếu URL của một đơn vị chưa được cấu hình thì hiển thị thông báo rõ ràng, không gắn liên kết `#` vô tác dụng.
- **Responsive/cache:** bổ sung quy tắc hiển thị cho desktop, tablet và mobile; tăng phiên bản tài nguyên/service worker sang V5 để trình duyệt nhận bộ tài nguyên mới. Đây là cơ chế cập nhật cache trong mã nguồn, chưa được xác minh trên tên miền production.
- **Thời gian:** hiển thị và phân loại thời gian sự kiện theo múi giờ `Asia/Ho_Chi_Minh` (UTC+7).

## 2. Logo chính thức

File logo người dùng gửi có SHA-256 giống hệt `public/assets/sfn-logo.png` vốn đã có trong V4:

`11d1509ae3b0c2b65734757d4a3dcbc57a89c816c1fe18bbdd4d24cbb92f94ce`

Không vẽ lại hay tái tạo logo bằng AI. V5 thêm `public/assets/sfn-logo-tight.png`, là bản cắt phần lề trong suốt của cùng ảnh để hiển thị rõ hơn trong header/hero; nội dung pixel nhìn thấy của logo được giữ nguyên. File logo nguyên gốc vẫn được giữ trong gói.

## 3. Liên kết và nguồn dữ liệu

- Chương trình: `#programs/{id}` → trang chi tiết chương trình.
- Sự kiện: `#events/{id}` → trang chi tiết sự kiện.
- Tin tức: `#news/{slug-or-id}` → trang chi tiết bài viết.
- Tiện ích/tài nguyên: `#utilities` và `#resources` → trang tiện ích/tài nguyên.
- Dữ liệu vẫn đọc từ các endpoint hiện hữu: `/api/public/classes`, `/api/public/events`, `/api/public/news`, `/api/public/units`, `/api/public/resources`, `/api/config`.

Không đưa bản ghi minh họa vào mã nguồn production, không thêm migration, không chạy SQL trên D1 và không thay đổi logic nghiệp vụ backend/API/auth/RBAC. Các chỉnh sửa `src/index.js` và `public/app.js` ngoài phần giao diện chỉ đổi đường dẫn asset logo mặc định và địa chỉ liên hệ mailto sang `ctt@skyfirst.io.vn`; không thay đổi logic xử lý yêu cầu, phân quyền hay dữ liệu.

## 4. Kiểm tra đã chạy

- `node scripts/validate.mjs` — **PASS** (`SFN Production Master validation: OK`).
- `node --check` cho các file JavaScript/MJS/CJS trong `public`, `src` và `scripts` — **PASS**.
- Node smoke test cục bộ với API mock — **PASS**: trang chủ; đủ 4 thẻ SFEC trong fixture; liên kết và route chi tiết chương trình/sự kiện/tin tức; trang tiện ích và các liên kết chính.
- `public/manifest.webmanifest` parse JSON — **PASS**.
- Đối chiếu SHA-256 logo tải lên với logo gốc trong V4 — **PASS**.
- Kiểm tra ZIP đầu ra bằng `unzip -t` — được chạy sau khi đóng gói.

**Giới hạn kiểm thử:** API mock chỉ kiểm tra cách render và điều hướng ở môi trường cục bộ; không chứng minh dữ liệu production có đủ bốn chương trình, bài viết, sự kiện hoặc URL của các đơn vị. Trình duyệt Chromium headless trong môi trường làm việc bị treo ngay cả với trang HTML đơn giản nên không hoàn tất được E2E/screenshot bằng trình duyệt. Chưa deploy lên Cloudflare/iNET, chưa kiểm tra trực tiếp trên `ctt.skyfirst.io.vn`, và chưa xác minh cache trên production.

## 5. Việc cần xác minh khi triển khai

1. Deploy lên môi trường staging hoặc preview trước; không ghi đè production ngay.
2. Xác nhận bốn chương trình SFEC đã tồn tại và được công khai trong Admin/D1. Nếu thiếu, tạo/cập nhật qua quy trình quản trị được phép, không chèn dữ liệu giả vào frontend.
3. Kiểm tra URL ảnh bìa `cover_file_id`, URL các đơn vị hệ sinh thái, quyền truy cập Admin, và các luồng tra cứu bằng dữ liệu thử an toàn.
4. Xác minh trang trên desktop/điện thoại thật và theo dõi lỗi Worker/console sau deploy.

---

**Kết luận:** V5 là gói mã nguồn đã chỉnh theo hướng 5 ảnh tham chiếu, đã qua kiểm tra tĩnh và smoke test cục bộ. Đây chưa phải xác nhận website đã được deploy hoặc kiểm thử end-to-end trên hệ thống production.

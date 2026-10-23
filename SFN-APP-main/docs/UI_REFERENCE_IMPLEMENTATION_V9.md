# Sky First Digital Information System — UI Implementation V9

**Ngày:** 23/10/2026  
**Nguồn:** `SFN-APP-V7-SKY-FIRST-DIGITAL-INFORMATION-SYSTEM.zip` và 10 ảnh giao diện tham chiếu do người dùng cung cấp.

## Nguyên tắc triển khai

- Ảnh tham chiếu chỉ dùng để đối chiếu bố cục, phân cấp thông tin, màu sắc và cách trình bày.
- Không chèn ảnh chụp giao diện vào HTML, CSS hay làm ảnh nền thay cho trang web.
- Dùng HTML, CSS, JavaScript và SVG nội tuyến cho các thành phần mới; giữ logo thương hiệu hiện có.
- Dữ liệu chương trình, sự kiện, tài liệu, tin tức và chỉ số lấy từ endpoint hiện hữu; trạng thái không có dữ liệu được thể hiện tường minh, không tự điền số liệu giả.
- Giữ nguyên worker/API, D1/R2 bindings, schema và migration, đăng nhập, session và RBAC; không triển khai production trong lượt này.

## Thay đổi trang chủ

- Chuẩn hóa `#app.dip-main` để chiếm toàn bộ bề ngang viewport; bỏ các thuộc tính giới hạn chiều rộng, căn lệch hoặc transform có thể làm phần nội dung co cụm về một bên.
- Giữ nguyên cấu trúc bắt buộc trên trang chủ: header/menu, hero và tìm kiếm, lối tắt nghiệp vụ, sáu thẻ màu chức năng, năm chỉ số.
- Bổ sung các khu vực nội dung bên dưới: chương trình đang công khai, sự kiện, tài liệu, thông báo/cập nhật và giới thiệu ngắn về hệ thống.
- Các thẻ chương trình dùng markup và SVG/CSS, không sử dụng ảnh chụp giao diện. Các khu vực chưa có dữ liệu hiển thị trạng thái rỗng và liên kết sang module tương ứng.
- Thêm lưới responsive cho desktop, tablet và điện thoại; giữ nguyên ngôn ngữ VI/EN và trạng thái menu theo route.
- Nâng cache-busting CSS/JS và service worker lên `20261023-v9` để tránh trình duyệt tiếp tục dùng cache phiên bản cũ.
- Bổ sung `public/email-templates/email_universal_auto.html` do danh sách kiểm định hiện hành yêu cầu tệp này nhưng gói đầu vào thiếu.

## Kiểm thử

- `npm run validate`: PASS.
- `node scripts/validate-xanh-integration.mjs`: 6/6 PASS.
- `npm test`: 95/95 PASS, gồm route SPA, auth/RBAC, D1/R2 qua môi trường kiểm thử, tra cứu hồ sơ/chứng nhận, tài trợ/an toàn, CMS và email.
- Chụp ảnh trình duyệt headless trong container không hoàn tất do Chromium treo trong môi trường; vì vậy chưa tuyên bố kiểm thử visual E2E thành công.
- Chưa triển khai production và chưa xác minh trạng thái dữ liệu, DNS, OAuth/cookie hoặc dịch vụ D1/R2 live.

## Những điều chưa thay đổi

- Không chạy migration lên D1 từ xa.
- Không đổi hostname, `APP_URL`, OAuth callback hoặc secrets production.
- Không chỉnh sửa schema, migration, API, cơ chế xác thực hay phân quyền để phục vụ riêng giao diện.

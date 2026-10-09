# SFN Member Portal — V4 Stable Release

Ngày đóng gói: 03/09/2026.

## Các lỗi production đã sửa dứt điểm

- Hồ sơ cá nhân: PATCH giờ merge với dữ liệu hiện có trong D1; không còn bắt người dùng gửi lại toàn bộ trường mỗi lần lưu. Không chọn ảnh mới sẽ giữ nguyên ảnh cũ. Lỗi nhập liệu trả về thông báo cụ thể thay vì chỉ hiện `ALL_PERSONAL_FIELDS_REQUIRED`.
- Đánh giá: tab **Đánh giá** có trong hồ sơ quản trị thành viên; có fallback tạo bảng đánh giá an toàn nếu production chưa áp migration 0009, tránh làm hỏng toàn bộ trang hồ sơ. Thành viên có mục **Đánh giá của tôi** cho các đánh giá đã chốt và được phép công khai.
- Thẻ: thẻ của thành viên hiển thị ảnh hồ sơ, mã thành viên, mã thẻ, đơn vị/chức danh, thời hạn, trạng thái, QR xác minh và nút Xác minh / In - Xuất PDF.
- In/PDF thẻ: layout thẻ riêng 86×54 mm, có ảnh thành viên và QR xác minh.
- Trang xác minh thẻ: tiếp tục hiển thị ảnh thành viên và cảnh báo rõ thẻ không còn hiệu lực.
- Cache: đổi version asset sang `20260903-v4` để trình duyệt không giữ app.js/CSS của bản cũ.

## Giữ nguyên hạ tầng

- Worker: `sfn-member-portal`
- D1: `tk` / binding `DB` / database id `ff630699-cc44-471d-9507-aa94c84468fb`
- R2: `tksfn` / binding `FILES`
- Domain: `member.skyfirst.io.vn`
- PBKDF2: 100000 iterations

Không tạo database mới, không xóa dữ liệu production.

## Kiểm tra release

Chạy `python scripts/verify_release.py`. V4 kiểm tra thêm các regression đã gặp: profile PATCH merge, ảnh hồ sơ không bắt buộc khi sửa, tab/API đánh giá, ảnh + QR + xác minh + In/PDF thẻ, cache busting và trang xác minh.

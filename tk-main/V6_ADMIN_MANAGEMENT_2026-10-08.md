# Member V6 — Nâng cấp quản trị 08/10/2026

## Mục tiêu
Giảm thao tác lặp lại cho quản trị viên và Việt hóa các luồng quản trị chính.

## Đã nâng cấp
- Quản lý thành viên: chọn nhiều, chọn tất cả, khóa/mở khóa hàng loạt, cấm/gỡ cấm hàng loạt, tạo nhiều thẻ cùng lúc, xuất danh sách đã chọn.
- Tạo thẻ hàng loạt: chọn loại thẻ, đơn vị, chức danh chung, ngày hết hạn; QR xác minh vẫn được tạo ở backend.
- Yêu cầu cấp tài khoản: chọn nhiều và phê duyệt/yêu cầu bổ sung/từ chối theo một thao tác xác nhận.
- Lịch Sky First Network: chọn nhiều và xóa nhiều lịch.
- Cơ cấu tổ chức: tìm kiếm, lọc trạng thái, thống kê nhanh, kích hoạt/tạm ngưng nhanh.
- Nhật ký hệ thống: tìm kiếm và xuất nhật ký CSV.
- Giao diện dùng tiếng Việt tự nhiên cho các thao tác mới; giữ các tên kỹ thuật/thương hiệu cần thiết.

## Bảo mật
- Bulk operations kiểm tra quyền backend.
- Không cho tự khóa/cấm chính mình.
- SUPER_ADMIN được bảo vệ khỏi thao tác khóa/cấm hàng loạt.
- Mỗi thao tác hàng loạt ghi audit log với dấu hiệu batch.
- Giới hạn tối đa 100 thành viên mỗi lần.

## Không thay đổi
Không thay đổi schema D1 cho đợt V6 này.

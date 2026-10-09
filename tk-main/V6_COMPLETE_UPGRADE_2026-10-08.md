# Trung Tâm Thành Viên Số Sky First — V6 Complete Upgrade

## Mục tiêu
Nâng bản V5 ổn định thành hệ thống quản trị thành viên đầy đủ hơn, giảm thao tác lặp lại và ưu tiên xử lý hàng loạt.

## Phạm vi V6
- Thành viên: tìm kiếm, lọc, chọn nhiều, xử lý hàng loạt, tạo thẻ hàng loạt, xuất dữ liệu.
- Tài khoản: vòng đời tài khoản, khóa/mở khóa, hạn chế và quản lý phiên theo quyền.
- Yêu cầu cấp tài khoản: duyệt, từ chối, yêu cầu bổ sung và xử lý nhiều hồ sơ.
- Đơn vị và cơ cấu tổ chức: quản lý cấu trúc, phạm vi và trạng thái.
- Chức vụ, vai trò và quyền: tiếp tục dùng RBAC backend hiện có.
- Thẻ thành viên: vòng đời, QR xác minh và thiết kế theo loại thẻ/đơn vị.
- Lịch Sky First Network: quản lý và xử lý nhiều lịch.
- Thông báo, lịch sử thành viên, hồ sơ, tài liệu và CV theo các phân hệ hiện có.
- Nhật ký hệ thống: tìm kiếm và xuất.
- Trung tâm công việc: tổng hợp việc chờ xử lý.
- Báo cáo & thống kê: số liệu trực tiếp từ dữ liệu hệ thống.
- SUPER_ADMIN Center: tổng quan và kiểm tra quyền.
- Cấu hình giao diện & thống kê: cấu hình từ giao diện quản trị.
- Cấu hình hệ thống: bộ lọc đã lưu và tình trạng dịch vụ.

## Bổ sung V6 trong đợt này
- API `work-center` tổng hợp yêu cầu, tài khoản cần chú ý, thẻ sắp hết hạn và hồ sơ thiếu thông tin.
- API báo cáo tổng hợp thành viên, tài khoản, đơn vị, yêu cầu và thẻ.
- API kiểm tra tình trạng cơ sở dữ liệu/lược đồ và việc khai báo R2/email; không tự nhận PASS cho kết nối production chưa kiểm chứng.
- Bộ lọc quản trị có thể lưu/xóa trong `system_settings`, giới hạn 50 bộ lọc/tài khoản.
- Điều hướng quản trị thêm Trung tâm công việc, Báo cáo & thống kê và Cấu hình hệ thống.
- Việt hóa lại tên hiển thị chuẩn thành `Trung Tâm Thành Viên Số Sky First`.

## An toàn
- Không tạo migration mới trong đợt V6.
- Không DROP/reset dữ liệu.
- Các API mới đều kiểm tra quyền backend.
- Cấu hình cấp cao chỉ dành cho SUPER_ADMIN.
- Bộ lọc lưu theo tài khoản, không dùng chung dữ liệu quản trị giữa các tài khoản.

## Kiểm thử
- `npm test`: PASS.
- 19/19 kiểm tra tích hợp center/API PASS.
- 195 câu lệnh SQL tĩnh được kiểm tra.
- Syntax `public/app.js` và `src/index.js`: PASS.
- Migrations từ schema trống: PASS.
- Production Cloudflare/D1/R2/Email chưa được xác minh trong môi trường này.

# Bàn giao chỉnh sửa giao diện trang chủ

## Phạm vi đã chỉnh sửa
- Giữ nguyên phần đầu trang chủ (hero, tìm kiếm, truy cập nhanh, thẻ chức năng và các số liệu hiện có).
- Gỡ toàn bộ các khối được nêu trong ảnh: danh sách chương trình; lịch sự kiện; thư viện tài liệu; tin tức/thông báo; khối giới thiệu "Thông tin số rõ ràng, thuận tiện và có kiểm soát".
- Trang chủ không còn render CMS zone `/`, do đó không hiển thị callout kỹ thuật gắn với route trang chủ.
- Trang chủ không còn gọi các API tin tức/lớp học/sự kiện/tài liệu chỉ để vẽ các khối đã gỡ. API cấu hình vẫn được gọi để giữ hoạt động của hero và số liệu hiện có.
- Đã loại bỏ nhãn kỹ thuật D1/R2 khỏi một số nhãn giao diện quản trị/công khai; các binding, keys, API, mã lưu trữ và thao tác dữ liệu bên dưới không bị đổi.
- Đổi nhãn "Màu chủ đạo" thành "Màu nhận diện" nhưng giữ nguyên trường cấu hình để không làm mất chức năng.
- Thêm migration `0013_remove_homepage_technical_callout.sql`, chỉ lọc block callout được yêu cầu khỏi `sys_home`, giữ lại các block CMS khác. Migration chưa được chạy trên môi trường sản xuất.
- Đã tăng query version và service-worker cache key để trình duyệt không dùng nhầm bundle cũ sau khi triển khai.

## Những thứ được bảo toàn
- Các route, API, hệ thống đăng nhập/phân quyền, bảng và dữ liệu D1, kho tệp R2, tài liệu/chứng nhận, biểu mẫu, email, chức năng Admin.
- Không thay đổi dữ liệu thật hoặc website đang chạy.

## Giới hạn xác minh
- Không thay đổi trực tiếp `app.skyfirst.io.vn`; ZIP này cần được kiểm tra và triển khai riêng sau phê duyệt.
- Migration 0013 cần được rà soát và chạy qua môi trường thử nghiệm trước khi áp dụng cho D1 thật.

## Kết quả kiểm thử thực tế
- E2E/hồi quy: 147/147 đạt, 0 thất bại.
- Kiểm định giao diện: 20/20 đạt, 0 thất bại.
- Kiểm tra cú pháp JavaScript/MJS: đạt.
- Migration 0013: kiểm tra cục bộ thành công; không chạy trên môi trường sản xuất.

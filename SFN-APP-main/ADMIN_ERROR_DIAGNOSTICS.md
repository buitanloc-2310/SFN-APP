# Chẩn đoán lỗi xử lý dữ liệu trong Admin

## Những gì đã được chỉnh

- Khi API trả 500, giao diện Admin hiển thị mã tham chiếu (`request_id`) thay vì chỉ thông báo chung. Máy chủ ghi cùng mã vào nhật ký `REQUEST_ERROR` và trả thêm header `X-SFN-Request-ID`.
- `/api/admin/system/health` kiểm tra các bảng/cột quan trọng, bao gồm audit log, biểu mẫu, chứng nhận, phê duyệt, tệp, tài liệu, CMS, điều khoản, mã chứng nhận và giao dịch tài trợ. Tổng quan Admin hiển thị những bảng/cột còn thiếu.
- Lệnh ghi audit tương thích với một số schema cũ thiếu cột tùy chọn, nhưng không âm thầm bỏ qua việc ghi nhật ký khi bảng hoặc cột `action` không khả dụng.
- Mã QR chứng nhận được sinh dưới dạng SVG cùng miền từ URL xác thực công khai. QR chỉ chứa đường dẫn và mã chứng nhận, không chứa email/SĐT.

## Giới hạn cần biết

Mã nguồn và bộ kiểm thử cục bộ không thể cho biết lỗi cụ thể trong D1 sản xuất nếu chưa có mã tham chiếu và nhật ký tương ứng. Cũng không thể khẳng định migration đã chạy trên D1 sản xuất chỉ vì tệp SQL có trong ZIP.

Sau khi bản ZIP được triển khai theo quy trình đã phê duyệt:

1. Mở Tổng quan Admin và kiểm tra cảnh báo sai lệch schema. Không tự chạy SQL nếu chưa có sao lưu, xác minh migration và phê duyệt.
2. Thực hiện một thao tác thử có thể kiểm soát, ghi lại mã tham chiếu nếu lỗi còn xảy ra, rồi tra nhật ký Worker theo `request_id`.
3. Chỉ kết luận lỗi đã hết sau khi kiểm thử trực tiếp từng nhóm thao tác với dữ liệu được phép và xác nhận dữ liệu thực tế thay đổi đúng một lần.

Không chạy migration trên production và không triển khai website trong quá trình tạo bản ZIP này.

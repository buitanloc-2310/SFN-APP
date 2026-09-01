# SFN UI bilingual refresh

- Loại bỏ ảnh cover khỏi hero trang chính và chuyển hero sang bố cục full-width.
- Làm lại menu điều hướng có dropdown mô tả ngắn, rõ chức năng, chỉ dùng các route hiện có.
- Thêm chuyển đổi Tiếng Việt / English và lưu lựa chọn trên trình duyệt.
- Bổ sung dịch giao diện động cho phần công khai và các nhãn quản trị phổ biến.
- Bỏ emoji giao diện, thay quick access bằng icon nét đơn sắc và admin menu bằng nhãn chữ sạch.
- Làm lại footer 4 cột, thêm liên kết hệ thống và thông tin liên hệ chính thức.
- Bổ sung song ngữ cho trang 404, lỗi hệ thống và bảo trì.
- Cập nhật Service Worker cache version để giao diện mới được nhận sau deploy.

## QA
- JavaScript syntax: OK cho toàn bộ `src/*.js` và `public/*.js`.
- HTML parse: OK cho index, 404, error, maintenance.
- Local asset references: không phát hiện tham chiếu local bị thiếu.
- `npm run validate` của gói gốc không thể chạy hoàn chỉnh vì ZIP nguồn thiếu `FIRST_LOGIN_SUPER_ADMIN.txt`; file này không được tự tạo lại vì có liên quan thông tin đăng nhập.

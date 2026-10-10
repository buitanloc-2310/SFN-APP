# CTT V6 — ADMIN REVIEW & REPAIR (10/10/2026)

> **Bản V6 Admin Review:** xem `CTT_V6_ADMIN_AUDIT_REPORT.md` để biết các hạng mục quản trị được rà soát, kết quả kiểm thử và giới hạn còn lại. V6 bổ sung bảng riêng cho 4 thẻ thống kê trang chủ, CMS tin tức có tải/đổi ảnh đại diện thật, cải thiện điều hướng/menu Admin và thay các hộp thoại native bằng hộp thoại trong giao diện.
>
> **Kiến trúc không thay đổi:** mã nguồn tiếp tục dùng Cloudflare Workers + D1 + R2 và các API hiện tại. Không thể chỉ upload ZIP vào `public_html` iNET rồi mặc định toàn bộ backend/database chạy.
>
> **V6 không thêm migration SQL.** Không chạy SQL/migration chỉ để áp dụng bản sửa Admin. Giữ nguyên D1/R2 hiện tại; xác minh binding `DB` và `FILES` trên staging/preview trước khi deploy. Bản này chưa deploy lên production và chưa test API upload/R2 live.

---

# CỔNG THÔNG TIN SỐ SKY FIRST — MASTER UPGRADE

**SKY FIRST DIGITAL INFORMATION PORTAL**  
Production domain: `https://ctt.skyfirst.io.vn`

## Những điểm cần đọc trước

- Trang quản trị có các mục riêng cho **Thống kê trang chủ** và **Quản lý tin tức**.
- Số liệu công khai ưu tiên D1; nếu nguồn D1 thiếu, giao diện hiển thị **“Chưa có dữ liệu”**, không bịa số mẫu. Số thủ công chỉ áp dụng khi quản trị viên chủ động chọn chế độ thủ công.
- Ảnh đại diện tin tức phải do quản trị viên tải lên/chọn từ tài nguyên thật có quyền sử dụng. Không có chức năng sinh ảnh AI. Nếu chưa có ảnh hoặc ảnh hỏng, giao diện báo rõ và dùng minh họa mặc định đã ghi nhãn.
- Logo `public/assets/sfn-logo.png` được giữ nguyên; SHA-256 trùng với file logo gốc bà cung cấp.
- V6 giữ nguyên backend, API, D1, R2, auth, RBAC và các migration; không tự động thay đổi dữ liệu production.

## Trước khi deploy

1. `npm install`
2. `npm run validate`
3. Kiểm tra bindings `DB` và `FILES` trong `wrangler.jsonc`.
4. **V6 không yêu cầu migration SQL mới.** Nếu đây là môi trường D1 mới hoàn toàn, chỉ làm theo hướng dẫn khởi tạo môi trường trong docs hiện có; không chạy migration trên production chỉ để cập nhật giao diện Admin.
5. Kiểm tra quyền `file.manage` cho upload media; API vẫn phải từ chối người dùng không có quyền.
6. Deploy staging/preview, xác minh save settings, CRUD tin tức, upload R2 thật, xác thực/RBAC và cache trước khi phát hành production.

## Phạm vi xác minh

Đã chạy static validation và các smoke test trình duyệt cục bộ với API được mock, bao gồm 31 route Admin, menu responsive/modal, lưu thống kê và luồng chọn/tải ảnh mô phỏng. Đây **không phải** kiểm thử D1/R2/API live, không phải production E2E, và chưa deploy lên `ctt.skyfirst.io.vn`.

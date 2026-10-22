# HỆ THỐNG THÔNG TIN SỐ SKY FIRST — BẢN BÀN GIAO NÂNG CẤP TOÀN DIỆN (V7)

**Tên sản phẩm chính thức:** Hệ thống Thông tin Số Sky First  
**Tên tiếng Anh:** Sky First Digital Information System  
**Tên miền mục tiêu:** `https://app.skyfirst.io.vn`  
**Địa chỉ email hệ thống:**
- `app@skyfirst.io.vn`: Email hệ thống, thông báo tự động.
- `lienhe@skyfirst.io.vn`: Liên hệ chung.
- `support@skyfirst.io.vn`: Hỗ trợ kỹ thuật & tiếp nhận báo cáo an toàn.

## 1. Tóm tắt các nâng cấp trong gói V7
1. **Bảo toàn dữ liệu & Sửa lỗi nghiêm trọng:**
   - Giữ nguyên toàn bộ bảng dữ liệu, bản ghi, mã chứng nhận, mã hồ sơ, kho tệp R2 và các file migration `0001`–`0007` (bao gồm hai file mang tiền tố `0004_` để không làm lệch bảng `d1_migrations`).
   - Bổ sung migration tương thích ngược `migrations/0008_sky_first_digital_information_system.sql`: thêm 6 vai trò còn thiếu trong bảng `roles` (`owner`, `content_admin`, `certificate_manager`, `reviewer`, `case_manager`, `editor` — khắc phục lỗi mất quyền khi `JOIN roles`), chuẩn hóa tên hệ thống/email/domain và khởi tạo các bảng cho Tài trợ, An toàn, Đa Website, Trình dựng trang CMS, Phiên bản PDF và Lịch sử mẫu Email.
   - Sửa lỗi giới hạn vòng lặp PBKDF2 (`150.000` vs `100.000` trên Cloudflare Workers WebCrypto) tương thích ngược với mật khẩu cũ.
   - Sửa lỗi kích hoạt tài khoản quản trị được mời (`/api/auth/reset`) tự động chuyển `status='active'` và `email_verified=1`.
   - Khắc phục lỗ hổng HTML Injection / XSS trong `renderTemplate` khi kết xuất mẫu email HTML.
   - Bổ sung kiểm soát tách biệt nhiệm vụ (người tạo đề nghị không được tự phê duyệt trong `/api/admin/approvals/:id` và quy trình duyệt trang CMS), phân quyền đúng phạm vi cho `handler` (`submission.manage_assigned`, `ticket.manage_assigned`) và cách ly phạm vi đa website (`canAccessScope`).
2. **Giao diện chuẩn hóa theo Ảnh tham chiếu & Master Directive:**
   - Thanh điều hướng 9 mục (`Trang chủ`, `Chương trình`, `Sự kiện`, `Tài liệu`, `Biểu mẫu`, `Chứng nhận`, `Hồ sơ`, `Tài trợ`, `An toàn`), hỗ trợ chuyển đổi ngôn ngữ `VI | EN`, tìm kiếm trung tâm và nút đăng nhập.
   - Phần Hero sạch, tập trung vào sản phẩm (không dùng tòa nhà giả, không dùng ảnh người AI, không đưa bài giới thiệu tổ chức dài dòng lên trang chủ).
   - 6 thẻ chức năng màu sắc và thanh **5 chỉ số vận hành tự động từ cơ sở dữ liệu** (`Chương trình & sự kiện`, `Thành viên cộng đồng`, `Chứng nhận đã phát hành`, `Đối tác & đơn vị đồng hành`, `Tổng tiền tài trợ thực nhận`).
3. **Hoàn thiện các Module nghiệp vụ mới:**
   - **Minh bạch Tài trợ (`/tai-tro` & `#admin/sponsorship`):** Tách biệt 5 chỉ tiêu (Mục tiêu, Đã cam kết, Thực nhận, Đã chi, Số dư còn lại), đối soát giao dịch và công bố báo cáo/chứng từ.
   - **An toàn & Bảo mật số (`/an-toan` & `#admin/safety`):** Hướng dẫn bảo vệ tài khoản, cảnh báo giả mạo, quyền riêng tư và kênh gửi báo cáo sự cố có mã tham chiếu (`SFN-SAFE-...`).
   - **Trung tâm Email tự động (`#admin/email` & `public/email-templates/`):** 12 mẫu email nghiệp vụ + 9 tệp HTML độc lập, hỗ trợ xem trước trực tiếp, gửi thử và lịch sử phiên bản.
   - **Thư viện PDF & Phiên bản Tài liệu (`/tai-lieu` & `#admin/documents`):** Phân loại, tìm kiếm, xem trước PDF trực tiếp (`X-Frame-Options: SAMEORIGIN`), quản lý phiên bản (`document_versions`) và khôi phục phiên bản.
   - **Trình dựng trang trực quan kéo thả & Quản trị đa Website (`#admin/page-builder` & `#admin/websites`):** Kéo thả khối nội dung, hoàn tác/làm lại, xem trước Desktop/Tablet/Mobile và quy trình duyệt 5 bước (`Bản nháp → Chờ duyệt → Đã duyệt → Đã xuất bản → Lưu trữ`).

## 2. Kiểm tra trước khi triển khai
```bash
npm run validate
npm test
node scripts/validate-xanh-integration.mjs
```

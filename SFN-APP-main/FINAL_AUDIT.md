# SFN PRODUCTION MASTER — FINAL AUDIT

## Mục tiêu
Một source duy nhất cho cổng chính thức:
https://volunteer.skyfirst.io.vn

Không phải bản Preview / Enhanced V2 / Demo.

## Nhận diện chính thức
- Mạng lưới Giáo dục và Phát triển Cộng đồng Sky First
- Sky First Network (SFN)
- Website: https://www.skyfirst.io.vn
- Cổng hệ thống: https://volunteer.skyfirst.io.vn
- Email nhận toàn bộ hồ sơ: skyfirst.ec@gmail.com
- Hotline/Zalo: 0924 910 210
- Logo, wordmark và ảnh bìa SFN thật nằm trong public/assets/.

## Super Admin
- Super Admin gốc: skyfirst.ec@gmail.com
- Mật khẩu tạm thời nằm riêng trong FIRST_LOGIN_SUPER_ADMIN.txt.
- Bắt buộc đổi mật khẩu sau lần đăng nhập đầu.
- Super Admin gốc được bảo vệ khỏi việc khóa/xóa/hạ quyền bởi tài khoản cấp thấp.
- Có 2FA/TOTP, quản lý phiên đăng nhập, quên/đổi mật khẩu.

## Module lớn
1. Tài khoản & xác thực
2. Phân quyền nhiều tầng
3. Tuyển dụng/Core Team
4. Tình nguyện viên
5. TNV Dạy học & phạm vi giảng dạy
6. Hồ sơ nhân sự điện tử
7. Form Builder & 9 form lõi
8. Lớp học & học viên
9. Điểm danh
10. Sự kiện & đăng ký/check-in
11. Trung tâm phê duyệt
12. GCN/GXN
13. Kho văn bản QĐ/TB/KH/QC/BB/BC
14. Đơn vị trực thuộc
15. CMS/Tin tức
16. Ticket hỗ trợ/phản ánh/khiếu nại
17. Notifications
18. Email templates & email log
19. File/R2
20. Search
21. Export CSV
22. Nhiệm vụ & bàn giao
23. Privacy/Data requests
24. Audit Log
25. Backup/Restore
26. Maintenance/404/Error
27. PWA/Mobile/Dark mode
28. Module Manager bật/tắt chức năng

## Quy tắc nghiệp vụ quan trọng
- Quyền Thành viên không tự phát sinh; SFN cấp sau khi duyệt.
- Quyền Quản trị viên không tự đăng ký; quản trị có thẩm quyền cấp.
- Core Team từ đủ 18 tuổi, gắn DK-01/2026/SFN.
- TNV từ đủ 18 tuổi, gắn DK-02/2026/SFN.
- TNV Dạy học không tự động được dạy mọi chương trình; phạm vi phải được phê duyệt.
- GCN/GXN: Ban Nhân sự đề nghị → Văn phòng kiểm tra → Tổng Thư ký phê duyệt → Văn phòng cấp số/phát hành.
- Hồ sơ và file riêng tư không công khai ngoài quyền được cấp.
- Toàn bộ form mặc định gửi về skyfirst.ec@gmail.com.
- Nếu mail provider lỗi/chưa cấu hình, hồ sơ vẫn được lưu D1 và email log ghi trạng thái thay vì mất dữ liệu.

## Hạ tầng production
- Cloudflare Worker
- D1 database
- R2 storage
- Assets static
- Cron cleanup/backup
- Google OAuth hook
- Turnstile hook
- Resend / Cloudflare Email Service hook

## Bắt buộc làm bên ngoài source trước khi public thật
1. Tạo D1 `sfn-app-db`.
2. Tạo R2 `sfn-app-files`.
3. Điền D1 database_id vào wrangler.jsonc.
4. Chạy migrations.
5. Cấu hình secrets email.
6. Nếu dùng Google Login: cấu hình GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET.
7. Nếu dùng Turnstile: cấu hình site key/secret.
8. Deploy Worker.
9. Gắn domain volunteer.skyfirst.io.vn.
10. Đăng nhập Super Admin, đổi mật khẩu tạm ngay và bật 2FA.

## Kiểm tra kỹ thuật đã thực hiện trước khi đóng ZIP
- Tất cả JS trong src/ và public/ qua `node --check`.
- Không có chữ Preview / Enhanced V2 / mô phỏng Dashboard / test password trong public UI.
- SQLite chạy được toàn bộ 0001_schema.sql + 0002_seed.sql.
- Seed tạo đủ 9 form lõi và 24 module.
- Super Admin seed có role `super_admin`.
- Mật khẩu tạm trong FIRST_LOGIN_SUPER_ADMIN.txt khớp PBKDF2 hash trong seed.

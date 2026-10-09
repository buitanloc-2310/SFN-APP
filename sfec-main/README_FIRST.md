# SFEC V3 — DEPLOY FIRST

Đây là bản SFEC độc lập về giao diện và nghiệp vụ, dùng domain `https://sfec.skyfirst.io.vn`.

## Nếu cập nhật hệ thống SFEC đang chạy
1. Upload/commit toàn bộ source V3.
2. Chờ Cloudflare build xanh.
3. D1 `sfec-app-db`: chỉ chạy `migrations/0003_sfec_ecosystem.sql` đúng 1 lần.
4. Không chạy lại 0001/0002 trên database đang có.
5. Kiểm tra Trang chủ, Lớp học, Tham gia SFEC, đăng nhập và dashboard.

## Nghiệp vụ SFEC V3
- Học viên: các lớp 9–12, A1–A2, B1–B2, Giao tiếp, Từ vựng.
- Thành viên: 16+.
- TNV Dạy học: 18+.
- Core Ban Nội dung: 18+.
- Core Ban Truyền thông: 18+.
- Cố vấn SFEC.

Không có TNV chung, form đơn vị trực thuộc, form dự án hay form hợp tác trong luồng tuyển/đăng ký SFEC.

Security: FIRST_LOGIN_SUPER_ADMIN.txt is intentionally excluded from V3. Existing Super Admin credentials are not changed by migration 0003.

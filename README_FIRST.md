# SKY FIRST NETWORK — PRODUCTION MASTER

Đây là **một gói Production Master duy nhất** cho cổng Sky First Network tại `https://volunteer.skyfirst.io.vn`.

## 1) Tài khoản Super Admin gốc

- Email: `skyfirst.ec@gmail.com`
- Mật khẩu tạm thời: xem file **`FIRST_LOGIN_SUPER_ADMIN.txt`** ở thư mục gốc.
- Hệ thống đặt `must_change_password = 1`, vì vậy lần đăng nhập đầu tiên sẽ bắt buộc đổi mật khẩu.
- Không đưa file `FIRST_LOGIN_SUPER_ADMIN.txt` vào thư mục `public/` và không chia sẻ ZIP này công khai.

## 2) Gói này đã có gì

- Đăng nhập tách **Học sinh/Học viên • Thành viên • Quản trị viên**.
- Email + mật khẩu; có sẵn mã nguồn **Google OAuth** để bật khi cấu hình Client ID/Secret.
- Quyền Thành viên và Quản trị viên **không tự phát sinh**; SFN cấp qua Admin.
- Super Admin, System Admin, Tổng Thư ký, Văn phòng, Ban Nhân sự, Ban Truyền thông, Ban Đối ngoại & Sự kiện, Unit Admin, Handler, Thành viên, TNV, Học sinh/Học viên.
- Quản lý tài khoản, cấp/thu hồi role, khóa tài khoản, lịch sử quyền qua Audit Log.
- Đổi mật khẩu, quên mật khẩu, xác minh email, 2FA/TOTP, quản lý phiên đăng nhập.
- 9 biểu mẫu lõi + **Form Builder** chỉnh trực tiếp trong Admin.
- Core Team: 18+, DK-01/2026/SFN, cam kết ≥12 tháng, báo trước 30 ngày.
- TNV: 18+, DK-02/2026/SFN; TNV dạy học tách phạm vi Lớp 9/10/11/12/Cơ bản/Giao tiếp/IELTS.
- D1 lưu tài khoản, hồ sơ, biểu mẫu, nhân sự, lớp, sự kiện, GCN/GXN, ticket, văn bản, thông báo, audit...
- R2 lưu ảnh thẻ, CV, portfolio, minh chứng, tài liệu, backup.
- Hồ sơ nhân sự điện tử + lịch sử.
- Phỏng vấn, đánh giá ứng viên, ghi chú nội bộ.
- Trung tâm phê duyệt.
- Lớp học, danh sách học viên, điểm danh.
- Sự kiện, đăng ký, mã check-in.
- GCN/GXN: đề nghị → Tổng Thư ký phê duyệt → Văn phòng phát hành → tra cứu/thu hồi.
- Kho văn bản QĐ/TB/KH/QC/BB/BC.
- Ticket hỗ trợ/phản ánh/khiếu nại.
- Tin tức/CMS, cài đặt Hero, slogan, hotline, website.
- Thông báo cá nhân, thủ tục nội bộ, Trung tâm Quyền riêng tư.
- Tìm kiếm toàn hệ thống, xuất CSV, Audit Log.
- Modules bật/tắt trong Admin.
- Backup thủ công + backup tự động theo cron, có phục hồi dành cho Super Admin.
- PWA, mobile responsive, Dark Mode, maintenance page, 404, security headers.

## 3) Email

**Toàn bộ hồ sơ đăng ký mặc định gửi về:** `skyfirst.ec@gmail.com`.

Source hỗ trợ 2 cách gửi mail:

1. **Resend API** — chỉ cần đặt secret `RESEND_API_KEY` và xác minh sender/domain bên nhà cung cấp.
2. **Cloudflare Email Service** — source đã hỗ trợ `env.EMAIL` nếu sau này bạn tự thêm `send_email` binding.

Nếu chưa cấu hình provider, hồ sơ vẫn được lưu vào D1 nhưng email log sẽ ghi `pending` thay vì làm mất hồ sơ.

## 4) Triển khai lần đầu

Đọc file: **`docs/DEPLOY_CLOUDFLARE.md`**.

Tóm tắt:

1. Cài Node.js.
2. `npm install`
3. `npx wrangler login`
4. Tạo D1 `sfn-app-db` và R2 `sfn-app-files`.
5. Điền D1 `database_id` vào `wrangler.jsonc`.
6. `npm run db:migrate`
7. Cấu hình secret email/Google/Turnstile nếu dùng.
8. `npm run deploy`
9. Gắn domain `volunteer.skyfirst.io.vn` theo cấu hình Cloudflare hiện tại của bạn.
10. Đăng nhập Super Admin, đổi mật khẩu ngay và bật 2FA.

## 5) Sau khi deploy

Các thay đổi vận hành thông thường phải thực hiện trong **Quản trị SFN**, không sửa source:

- biểu mẫu/câu hỏi;
- điều khoản;
- tài khoản/quyền;
- lớp/sự kiện;
- tin tức;
- đơn vị;
- GCN/GXN;
- văn bản;
- email templates;
- modules;
- settings/hero;
- trạng thái hồ sơ/ticket;
- nhiệm vụ;
- privacy requests.

Source chỉ cần deploy lại khi thay đổi **logic phần mềm**, không phải khi sửa nội dung hằng ngày.

# CỔNG THÀNH VIÊN SKY FIRST NETWORK — FINAL LONG-TERM RELEASE

Bản này được rà lại theo mục tiêu vận hành ổn định lâu dài trên hạ tầng Cloudflare hiện có.

## Hạ tầng giữ nguyên
- Worker: `sfn-member-portal`
- Domain: `https://member.skyfirst.io.vn`
- D1 binding: `DB`
- D1 database: `tk`
- D1 database ID: `ff630699-cc44-471d-9507-aa94c84468fb`
- R2 binding: `FILES`
- R2 bucket: `tksfn`
- PBKDF2: 100000 iterations

Không tạo D1/R2/domain mới và không cần xóa dữ liệu đang có.

## Những phần đã được rà lại
- Frontend `public/app.js` và Worker `src/index.js` đều qua `node --check`.
- Đã đối chiếu các API thành viên thường dùng, bao gồm CV, thẻ và quá trình công tác.
- Đã sửa route vòng đời Đơn vị/vai trò để PATCH/End/Hide/Show nằm ngoài route POST tạo mới.
- Các tab quản trị thành viên có thao tác vòng đời phù hợp: Mục tiêu, Công việc, Hoạt động, GCN, Thành tích, Thẻ, Tài liệu, Phân quyền.
- Quá trình công tác là dữ liệu lịch sử từ `org_memberships`.
- GCN ngoài hệ thống có route duyệt/từ chối xác minh.
- Hồ sơ học tập/công tác được giữ trong `people` và luồng yêu cầu tài khoản.
- Yêu cầu cấp tài khoản hiển thị thời gian dự kiến xử lý **60 phút đến 48 giờ**.
- CCCD/địa chỉ không đưa vào CV mặc định hoặc trang xác minh công khai.
- Mutation quan trọng tiếp tục ghi audit log.

## Migration mới 0008
`0008_account_request_profile.sql` tạo bảng phụ `account_request_profiles` để lưu thông tin học tập/công tác của đơn yêu cầu tài khoản mà không phải ALTER nguy hiểm trên bảng production cũ.

Không chạy lại `0001_initial.sql` bằng D1 Console trên database production.

## Triển khai
Tại thư mục dự án:

```bash
npm install
npx wrangler d1 migrations apply tk --remote
npx wrangler deploy
```

Wrangler chỉ áp dụng migration chưa được ghi nhận. Trước khi deploy production, nên chạy kiểm tra release:

```bash
npm run check
python scripts/verify_release.py
```

## Kiểm tra nhanh sau deploy
1. Đăng nhập tài khoản quản trị hiện tại.
2. Mở Quản trị thành viên → một hồ sơ thành viên.
3. Test Đơn vị/vai trò: Thêm → Chỉnh sửa → Ngừng hiệu lực → Ẩn/Hiện lại.
4. Test Mục tiêu/Công việc: thêm, chỉnh sửa, đổi trạng thái.
5. Test Hoạt động/Thành tích/Tài liệu: chỉnh sửa và Ẩn/Hiện lại.
6. Test GCN: cấp, upload PDF, duyệt GCN ngoài hệ thống, thu hồi/khôi phục.
7. Test Thẻ: cấp, sửa, vô hiệu hóa/kích hoạt lại.
8. Test Phân quyền: cấp scope, ngừng/khôi phục scope quản trị.
9. Đăng nhập thành viên và mở Hồ sơ, Thẻ, Quá trình công tác, CV.
10. Gửi thử một yêu cầu cấp tài khoản mới và duyệt thử.

## Lưu ý vận hành 1–2 năm
- Không sửa trực tiếp migration đã chạy trên production; mọi thay đổi schema mới phải tạo migration số tiếp theo.
- Không dùng chức vụ tổ chức để suy ra quyền admin. Quyền quản trị luôn dựa trên `ROLE + SCOPE + PERMISSION`.
- Không xóa lịch sử đơn vị/vai trò thông thường; dùng ngừng hiệu lực/ẩn.
- Sao lưu D1 định kỳ trước thay đổi lớn.
- Chạy `scripts/verify_release.py` trước mỗi lần deploy thay đổi source.

## Security configuration (2026 final hardening)
Before first-time setup, configure Cloudflare secret `SETUP_TOKEN` (for example with `wrangler secret put SETUP_TOKEN`). Keep `RESEND_API_KEY` as a secret as well. `/api/setup` requires `X-Setup-Token` and locks itself after the first account exists. Login, password reset and public avatar upload are rate-limited. The member Security Center supports session review/revocation and security-event history.

## Bản 4.1 — 05/10/2026
Tên cổng: **Trung tâm thành viên số SKY FIRST**. Chức năng tạo trung tâm nằm tại Quản trị → Cơ cấu tổ chức, chỉ dùng trong phạm vi quyền được cấp. Xem `UPGRADE-2026-10-05.md` để biết các sửa lỗi, cách sử dụng và phạm vi kiểm thử.

Cloudflare build command: `npm run build`. Kiểm thử đầy đủ: `npm test` (Node ≥22.13, Python 3). Thiết lập D1/migration và secret theo hướng dẫn sẵn có trước khi triển khai.

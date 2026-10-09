# DATA SAFETY — member.skyfirst.io.vn

Bản nâng cấp này **không yêu cầu migration mới và không reset D1**.

## Không được chạy lại trên database đang hoạt động
- `SETUP_D1_CONSOLE.sql`
- toàn bộ migration cũ theo cách thủ công nếu chưa kiểm tra bảng `d1_migrations`

Đặc biệt migration `0006_member_portal_upgrade.sql` có thao tác thay bảng `account_requests`; vì hệ thống đang có dữ liệu thật, không được chạy lại tùy tiện.

## Bản này thay đổi
- Giao diện/typography/responsive
- Favicon/logo
- Liên kết hệ sinh thái SFN
- Không thay schema, không xóa users/accounts/sessions/roles.

## Cloudflare
- Build command: để trống
- Deploy command: `npx wrangler deploy`
- Version command: `npx wrangler versions upload`
- Root directory: thư mục chứa `wrangler.jsonc` (nếu repo giữ cấu trúc ZIP này là `tk-main`)

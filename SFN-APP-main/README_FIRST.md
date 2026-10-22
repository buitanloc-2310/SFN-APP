# HỆ THỐNG THÔNG TIN SỐ SKY FIRST (SKY FIRST DIGITAL INFORMATION SYSTEM — V8)

* **Tên hệ thống:** Hệ thống Thông tin Số Sky First (*Sky First Digital Information System*)
* **Tên miền chính thức:** `https://app.skyfirst.io.vn` (tương thích liên thông với `https://ctt.skyfirst.io.vn`)
* **Email hệ thống:** `app@skyfirst.io.vn`
* **Email liên hệ:** `lienhe@skyfirst.io.vn`
* **Email hỗ trợ:** `support@skyfirst.io.vn`
* **Hotline:** `0924 910 210`

---

## 1. Cấu trúc Thư mục Dự án

```text
├── migrations/                     # 9 tệp SQL migration (0001 -> 0008, bảo toàn 100% lịch sử d1_migrations)
├── src/                            # Mã nguồn Backend Cloudflare Workers + D1 + R2
│   ├── index.js                    # Điểm khởi chạy Worker, định tuyến SPA, Redirect 301/302, bảo mật CSP/Headers
│   ├── auth.js                     # Xác thực PBKDF2 (150k/100k), TOTP 2FA, Session, Quên mật khẩu qua Admin
│   ├── permissions.js              # Ma trận RBAC 12 vai trò & cách ly phạm vi đơn vị/website (canAccessScope)
│   ├── public.js                   # API công khai, tra cứu GCN/Hồ sơ, 5 chỉ số D1, Tài trợ, An toàn, CMS
│   ├── admin.js                    # API quản trị toàn diện, Menu/URL/Liên kết/Thư mục, Vòng đời bản ghi, Email
│   ├── email.js                    # Hệ thống Email HTML dùng chung (email_universal_auto.html) & Đính kèm A/B
│   ├── me.js                       # API hồ sơ người dùng đã đăng nhập
│   └── utils.js                    # Tiện ích mã hóa PBKDF2 pure-JS fallback, chống XSS, kiểm tra URL an toàn
├── public/                         # Tài nguyên tĩnh & Frontend ES Modules
│   ├── index.html                  # Khung giao diện chính chuẩn SEO/OpenGraph
│   ├── bootstrap.js                # Khởi tạo cấu hình công khai & điều phối giao diện
│   ├── digital-portal.js           # Giao diện công khai song ngữ VI/EN bám sát 9 ảnh tham chiếu
│   ├── app.js                      # Hệ thống Quản trị (Dashboard, Hồ sơ, GCN, CMS, Menu/URL, Vòng đời, Email)
│   ├── styles.css                  # CSS nền tảng
│   ├── digital.css                 # Hệ thống thiết kế chuẩn ảnh tham chiếu (Desktop/Tablet/Mobile)
│   ├── sw.js                       # Service Worker v8-sky-first-digital-system
│   ├── email-templates/            # Mẫu email_universal_auto.html và 9 mẫu chuyên biệt
│   └── assets/                     # Logo chính thức Sky First (giữ nguyên byte-for-byte)
├── scripts/                        # Bộ công cụ kiểm tra tĩnh và kiểm thử tích hợp E2E (95 bài test)
│   ├── validate.mjs                # Kiểm tra cú pháp, cấu trúc tệp và quy chuẩn định danh
│   ├── validate-xanh-integration.mjs # Kiểm thử liên thông HMAC-SHA256 Xanh Sky First (6/6 PASS)
│   └── test-all.mjs                # Bộ 95 bài kiểm thử tích hợp E2E + 18 kịch bản Email bắt buộc
├── docs/                           # Tài liệu kiến trúc, phân quyền, bảo mật, email và hướng dẫn triển khai
├── package.json                    # Khai báo lệnh chạy dev, validate, test, migrate, deploy
└── wrangler.jsonc                  # Cấu hình Cloudflare Workers, D1, R2 và biến môi trường mẫu an toàn
```

---

## 2. Hướng dẫn Kiểm thử Cục bộ (Local Verification)

Yêu cầu môi trường: Node.js `>= 18` và Python 3 (có sẵn thư viện `sqlite3` để giả lập D1 cục bộ trong bộ test).

```bash
# 1. Kiểm tra cú pháp JS và tính đầy đủ của các tệp bắt buộc
npm run validate

# 2. Chạy kiểm thử tích hợp liên thông Xanh Sky First (6/6 bài test)
node scripts/validate-xanh-integration.mjs

# 3. Chạy toàn bộ 95 bài kiểm thử tích hợp E2E & hồi quy (bao gồm 18 kịch bản Email bắt buộc)
npm test
```

---

## 3. Hướng dẫn Triển khai An toàn lên Cloudflare Production

1. **Sao lưu cơ sở dữ liệu D1 hiện tại:**
   ```bash
   npx wrangler d1 export sfn-app-db --remote --output=backup_pre_upgrade.sql
   ```
2. **Áp dụng migration bổ sung `0008` trên môi trường Local trước, sau đó trên Remote:**
   ```bash
   npm run db:migrate:local
   # Khi đã xác nhận an toàn và được cấp phép:
   npm run db:migrate
   ```
3. **Cấu hình các biến bí mật (Worker Secrets):**
   ```bash
   npx wrangler secret put RESEND_API_KEY
   npx wrangler secret put GOOGLE_CLIENT_SECRET
   npx wrangler secret put TURNSTILE_SECRET_KEY
   npx wrangler secret put XANH_CTT_SHARED_SECRET
   ```
4. **Triển khai ứng dụng:**
   ```bash
   npm run deploy
   ```

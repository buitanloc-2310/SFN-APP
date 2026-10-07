# DEPLOY — CỔNG THÔNG TIN SỐ SKY FIRST

Production target: `https://ctt.skyfirst.io.vn`

## 1. Cài dependencies và kiểm tra source

```bash
npm install
npm run validate
```

## 2. D1 + R2

Bindings mặc định:

- D1: `DB` → `sfn-app-db`
- R2: `FILES` → `sfn-app-files`

Nếu tạo hạ tầng mới:

```bash
npx wrangler d1 create sfn-app-db
npx wrangler r2 bucket create sfn-app-files
```

Điền `database_id` đúng môi trường vào `wrangler.jsonc`.

## 3. Migration

```bash
npm run db:migrate
```

`0005_digital_information_infrastructure.sql` là migration additive cho Digital Information Infrastructure. Migration này giữ nguyên credential legacy, bổ sung case timeline, upload sessions, SHA-256 metadata, credential supersede/revoke snapshot, form revisions/drafts và portal analytics.

Không sửa/convert mã GCN cũ đã phát hành chỉ để khớp format mới.

## 4. Secrets / integrations

Email provider nếu dùng Resend:

```bash
npx wrangler secret put RESEND_API_KEY
```

Google OAuth chỉ dành cho **Administrator đã tồn tại**. Redirect URI:

`https://ctt.skyfirst.io.vn/api/auth/google/callback`

```bash
npx wrangler secret put GOOGLE_CLIENT_SECRET
```

Turnstile nếu bật:

```bash
npx wrangler secret put TURNSTILE_SECRET_KEY
```

Không cấu hình secret trong file public.

## 5. Deploy staging trước

```bash
npm run deploy
```

Kiểm tra `/api/health` phải cho thấy database và storage đã bind. Sau đó chạy toàn bộ `docs/PRODUCTION_CHECKLIST.md` trên Worker/staging URL.

## 6. Custom domain

Chỉ gắn/chuyển production domain sau khi staging pass:

`https://ctt.skyfirst.io.vn`

## 7. Caching

Các API public config/news/classes/events/units/resources dùng Cloudflare Cache API. Khi nội dung tương ứng được sửa trong Admin, source chủ động invalidate cache key liên quan. Lookup credential/case không cache công khai.

## 8. Upload

Public form dùng upload session: browser xin session → Worker stream request body vào R2 → server kiểm MIME/magic bytes/size → form submit finalize metadata trong D1. Đây là streaming gateway, không buffer toàn file trong form submit. Nếu sau này chuyển sang presigned S3-compatible direct-to-R2, vẫn giữ contract upload-session/finalize hiện tại.

## 9. Rollback

Trước thay đổi production lớn, tạo backup nghiệp vụ và giữ bản deploy trước. Migration `0005` là additive; không rollback bằng cách xóa cột trên D1 production. Nếu cần rollback app, deploy source trước đó nhưng giữ database và kiểm tra compatibility.

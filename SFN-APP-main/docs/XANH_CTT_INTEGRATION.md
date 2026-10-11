# Liên thông hồ sơ Xanh Sky First → CTT

## Thiết kế
- Xanh vẫn là nguồn dữ liệu gốc của hồ sơ `XSF-*`.
- CTT nhận bản ghi liên kết qua `POST /api/integrations/xanh/submissions`; dữ liệu lưu riêng trong `xanh_external_submissions`, không giả mạo hồ sơ nội bộ CTT và không tự động cấp giấy chứng nhận.
- API yêu cầu HMAC-SHA256 trên chuỗi `timestamp.nonce.raw_body`, headers `X-SFN-Timestamp`, `X-SFN-Nonce`, `X-SFN-Signature: v1=<hex>`; cửa sổ thời gian 5 phút và nonce dùng một lần.
- Admin được phép `submission.view` có thể đọc `GET /api/admin/xanh-submissions`.

## Cấu hình bí mật
Tạo cùng một secret ngẫu nhiên tối thiểu 32 ký tự cho hai môi trường:
- CTT Worker secret: `XANH_CTT_SHARED_SECRET`
- Xanh Pages secret: `XANH_CTT_SHARED_SECRET`

Đặt bằng Cloudflare secrets (không commit vào wrangler vars/source):
```sh
# chạy trong thư mục CTT
npx wrangler secret put XANH_CTT_SHARED_SECRET
# chạy trong thư mục Xanh
npx wrangler pages secret put XANH_CTT_SHARED_SECRET --project-name=xanh-sky-first
```

Xanh có thể đặt `XANH_CTT_ENDPOINT` thành URL endpoint; mặc định là `https://ctt.skyfirst.io.vn/api/integrations/xanh/submissions`.

## Áp dụng
1. Sao lưu hai D1 database trước khi migrate.
2. CTT: `npm run db:migrate` để áp dụng migration `0007_xanh_external_submissions.sql`.
3. Xanh: áp dụng migration mới bằng `npx wrangler d1 migrations apply xanh --remote` sau khi kiểm tra đúng account/database.
4. Deploy CTT và Xanh sau khi cấu hình secret.
5. Gửi một hồ sơ thử nghiệm và kiểm tra `/api/admin/xanh-submissions` với tài khoản có quyền `submission.view`.

Không đưa dữ liệu hồ sơ đầy đủ/tệp đính kèm sang CTT; chỉ đồng bộ mã, tên, email, tên biểu mẫu, trạng thái và thời gian. CTT chưa tự động phát hành chứng nhận cho hồ sơ được nhận.

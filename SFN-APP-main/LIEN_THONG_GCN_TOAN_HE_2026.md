# ONE SKY FIRST CREDENTIAL REGISTRY — 2026

Nguồn xác thực credential thống nhất nằm tại **Cổng Thông tin Số Sky First**.

## Public verification

- Human page: `https://ctt.skyfirst.io.vn/gcn/{id}`
- API record: `/api/public/credentials/{id}`
- Compatibility lookup: `/api/lookup/certificate?code={id}`

## ID policy

- Mới: `SFN-GCN-#####`, `SFN-GXN-#####`, `SFN-BK-#####` — 5 số ngẫu nhiên, collision-checked.
- Legacy: mã đã phát hành như `001-GCN-SFN/2026` được giữ nguyên và tiếp tục lookup.
- Không dùng mã tăng tuần tự làm verification ID mới.

## State policy

`pending_approval → approved → issued`.

Credential đã `issued` không chỉnh code/core record bằng CRUD thông thường. Sai thông tin phải đi theo `revoke` hoặc `supersede → replacement`, đồng thời giữ history.

QR mới trỏ trực tiếp đến `/gcn/{id}`. Text code luôn còn tồn tại làm accessibility/fallback.

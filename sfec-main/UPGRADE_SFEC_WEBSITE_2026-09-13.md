# SFEC Website Edition — 2026-09-13

Nâng cấp từ tư duy `ctt.sfec.skyfirst.io.vn` thành website riêng của SFEC tại `sfec.skyfirst.io.vn`, vẫn giữ toàn bộ Worker/D1/R2, form, tài khoản, portal, admin và tra cứu hiện hữu.

## Thay đổi chính
- Public branding: Website chính thức SFEC, không còn định vị chỉ là Cổng Thông tin.
- 4 trang nội dung dài: Giới thiệu, Hành trình, Định hướng & Giá trị, Cơ cấu & Hệ sinh thái.
- Mỗi trang được viết ở mức trên 500 từ tiếng Việt.
- Footer và liên kết SFEC chuyển sang `sfec.skyfirst.io.vn`.
- APP_URL + Google callback chuyển sang domain mới.
- Thêm route Điều khoản / Quyền riêng tư để footer không còn link chết.
- Giữ nguyên kiến trúc và nghiệp vụ hiện có.

## Deploy
1. Tạo Custom Domain `sfec.skyfirst.io.vn` cho Worker `sfec`.
2. Nếu dùng Google OAuth, thêm callback `https://sfec.skyfirst.io.vn/api/auth/google/callback` trong Google Cloud Console.
3. Chạy `npm install`, `npm run validate`, `npm run db:migrate`, `npm run deploy`.
4. Có thể giữ `ctt.sfec.skyfirst.io.vn` tạm thời và redirect sang domain mới sau khi kiểm thử.

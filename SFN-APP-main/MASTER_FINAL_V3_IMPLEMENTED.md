# MASTER FINAL V3 — IMPLEMENTED UPGRADE

Bản này tiếp tục trực tiếp từ `SKY-FIRST-DIGITAL-INFORMATION-PORTAL-v2`, đối chiếu source gốc `SFN-APP-main`, không reset D1/R2.

## Đã triển khai trong source
- Trang chủ V3: hero mới, quick actions tiếng Việt, discovery composition, chương trình spotlight, opportunity rails, timeline sự kiện, editorial news, resource mosaic, tiện ích số, ecosystem visual, CTA kết nối.
- `/tra-cuu`: bỏ universal lookup trùng lặp; chỉ còn 2 lối vào lớn: giấy đã phát hành và hồ sơ.
- `/gcn`: Việt hóa public, visual riêng, placeholder `Nhập nội dung tại đây...`, QR, FAQ và 3 lợi ích public.
- Mã giấy mới: 8 chữ số ngẫu nhiên, collision check D1; mã cũ không bị đổi.
- `/ho-so`: Việt hóa thuật ngữ và tách visual/ngữ nghĩa khỏi tra cứu giấy.
- Mega menu/search/footer: giảm tiếng Anh và viết tắt public.
- Admin sidebar: Việt hóa và tổ chức lại theo công việc.
- Danh sách quản trị viên: tài khoản `super_admin` được coi là Chủ sở hữu; không trả về trong danh sách cho admin cấp dưới.
- Tạo quản trị viên: chọn `Gửi email kích hoạt` hoặc `Tự kích hoạt`; email activation dùng token một lần qua cơ chế auth token hiện có.
- Email mời kích hoạt được nâng thành HTML template nhận diện Sky First.
- Giữ nguyên D1/R2/API nghiệp vụ hiện hữu; migration mới là non-destructive.

## Migration mới
`migrations/0006_master_final_v3.sql`

Chạy migrations theo quy trình production hiện có trước khi dùng email kích hoạt mới.

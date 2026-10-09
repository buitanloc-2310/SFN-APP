# SFEC — rà soát & nâng cấp giao diện 2026

Bản này giữ kiến trúc Cloudflare Worker + D1 + R2 hiện có và tập trung hoàn thiện giao diện công khai.

## Đã nâng cấp
- Gia cố typography để tránh lỗi giãn/chẻ chữ tiếng Việt trong hero, form, card và footer.
- Hero lấy `hero_title` và `hero_text` từ D1 thay vì đóng cứng nội dung trong JavaScript.
- Favicon và Apple touch icon dùng logo SFEC.
- Footer "Kết nối hệ thống" mở rộng tới:
  - Cổng chính Sky First Network — https://www.skyfirst.io.vn
  - Cổng Thông tin Sky First — https://ctt.skyfirst.io.vn
  - Cổng Tình nguyện viên — https://tnv.skyfirst.io.vn
  - Cổng SFEC — https://ctt.sfec.skyfirst.io.vn
  - Nhà Hán Ngữ — https://nhahanngu.io.vn
- Tinh chỉnh card, menu, hero, footer, dark mode và mobile để giao diện gọn và hiện đại hơn.
- Sửa validator không còn thất bại vì tệp mật khẩu quản trị đã chủ động loại khỏi bản phát hành.
- Thêm migration `0004_ui_portal_polish.sql` để đồng bộ cấu hình công khai trên D1 hiện có.

## Triển khai
Giữ nguyên cấu hình dự án hiện có. Sau khi deploy source, chạy migration D1 remote:

`npm run db:migrate`

Sau đó tải lại website và kiểm tra footer, favicon, hero, form và giao diện mobile/dark mode.

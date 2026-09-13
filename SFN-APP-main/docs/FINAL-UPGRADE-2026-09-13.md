# SFN final upgrade — 2026-09-13

Bản chốt nâng cấp giao diện và quản trị, giữ nguyên dữ liệu/migration hiện có.

## Hoàn thiện giao diện công khai
- Trang chủ mở rộng: Hero, tra cứu nhanh, nhóm chức năng, giới thiệu dài, hành trình tham gia, FAQ, tin tức, hệ sinh thái và CTA.
- Icon dùng chung một màu xanh nhận diện Sky First.
- Bỏ hoàn toàn chức năng/ngôn ngữ EN khỏi giao diện và JavaScript công khai.
- Không còn liên kết Nhà Hán Ngữ hoặc Cổng Học thuật trong source công khai.
- Các API danh sách công khai (tin tức, lớp học, sự kiện, đơn vị) fail-soft: khi D1 tạm lỗi trả danh sách rỗng + trạng thái degraded thay vì làm trang lỗi 500.

## Hoàn thiện Admin
- Sidebar chia nhóm rõ: Tổng quan; Con người & hồ sơ; Hoạt động & nội dung; Hệ thống & giao diện; Kiểm soát.
- Dashboard mới có trạng thái App/D1/R2, KPI và truy cập nhanh.
- Quản trị website: nhận diện, Hero, Header, Footer.
- 404 & Bảo trì: bật/tắt bảo trì và chỉnh nội dung.
- Media R2: tải ảnh, xem ảnh, sao chép URL, xóa ảnh mà không cần metadata D1.
- Modules, File & Minh chứng, Email, Điều khoản, Quyền riêng tư, Ticket, Audit, Backup giữ nguyên dữ liệu cũ.

## Nguyên tắc dữ liệu
- Không reset D1.
- Không đổi khóa/ID dữ liệu cũ.
- Nội dung nền website có fallback trong source.
- Dữ liệu nghiệp vụ tiếp tục ở D1.
- Ảnh giao diện ưu tiên R2.

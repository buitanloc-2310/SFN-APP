# Hệ thống Thông tin Số Sky First (app.skyfirst.io.vn)

**Đơn vị chủ quản:** Mạng lưới Giáo dục và Phát triển Cộng đồng Sky First (Sky First Network)  
**Tên miền chính thức:** `https://app.skyfirst.io.vn`  
**Kiến trúc:** Cloudflare Workers + Cloudflare D1 (SQLite) + Cloudflare R2 (`FILES`) + Workers Static Assets (`ASSETS`)

## 1. Các phân hệ nghiệp vụ chính
- **Cổng thông tin công khai:** Trang chủ (`/`), Giới thiệu (`/gioi-thieu`), Chương trình (`/chuong-trinh`), Sự kiện (`/su-kien`), Tài liệu (`/tai-lieu`), Biểu mẫu (`/bieu-mau`), Trung tâm Tra cứu (`/tra-cuu`), Chứng nhận (`/gcn`), Hồ sơ (`/ho-so`), Tài trợ (`/tai-tro`), An toàn (`/an-toan`), Hỗ trợ (`/ho-tro`), Tìm kiếm (`/tim-kiem`), Trang nội dung mở rộng (`/trang/:slug`).
- **Trung tâm Quản trị (`/admin` & `/admin/*`):** Quản trị 100% bằng tiếng Việt, hỗ trợ điều hướng trực tiếp qua URL (`/admin/files`, `/admin/forms`, `/admin/terms`, `/admin/sponsorship`, `/admin/page-builder`...), kiểm soát quyền RBAC 18 vai trò và phân tách phạm vi theo đơn vị (`scope_unit_code`).
- **Trình dựng trang trực quan (`#admin/page-builder`):** Hỗ trợ nhấp trực tiếp vào văn bản để sửa tại chỗ (`contenteditable`), điều chỉnh phông chữ, cỡ chữ, màu chữ, màu nền, căn lề, kéo thả khối, hoàn tác/làm lại, lưu bản nháp, gửi duyệt, phê duyệt, hẹn giờ và công bố.
- **Minh bạch Tài trợ & VietQR NAPAS 247 (`/tai-tro` & `#admin/sponsorship`):** Tách biệt 5 chỉ tiêu (Mục tiêu, Cam kết, Thực nhận, Đã chi, Số dư), tích hợp danh mục 18 ngân hàng NAPAS, sinh mã QR chuẩn ISO/IEC 18004 (Reed-Solomon ECC) quét được 100% bằng mọi ứng dụng ngân hàng mà không tự động mặc định ngân hàng khi chưa cấu hình.

## 2. Lệnh kiểm tra & phát triển cục bộ
```bash
npm run validate      # Kiểm tra cấu trúc tệp, cú pháp JS, mẫu email và quy chuẩn hiển thị
npm run validate:ui   # Kiểm tra ánh xạ giao diện tham chiếu và responsive
npm test              # Chạy toàn bộ 147 bài kiểm thử đầu cuối (E2E) và hồi quy trên SQLite + R2 giả lập
```

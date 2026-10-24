# BÁO CÁO KẾT QUẢ KIỂM THỬ TỰ ĐỘNG & BẰNG CHỨNG XÁC MINH (TEST RESULTS)

## 1. Tổng hợp các lệnh kiểm thử đã chạy trên bản bàn giao V10

Tất cả các bài kiểm thử tĩnh và động dưới đây đã được thực thi trực tiếp trên mã nguồn bàn giao tại môi trường sandbox:

| STT | Lệnh thực thi | Mục đích kiểm định | Kết quả | Exit Code | Thời gian chạy |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | `node scripts/validate.mjs` | Kiểm tra sự tồn tại của toàn bộ tệp bắt buộc (gồm cả migrations `0001..0011`), kiểm tra cú pháp JS (`node --check`), quét cụm từ cấm và kiểm tra 14 token mẫu email `email_universal_auto.html` | **OK (100% Pass)** | `0` | `0,42s` |
| **2** | `node scripts/validate-ui-reference.mjs` | Kiểm tra ánh xạ 10 giao diện chuẩn, 6 thẻ chức năng trang chủ, 5 chỉ số D1, chuẩn hóa thương hiệu, đồng bộ phiên bản cache (`20261023-v8`) và cấm nhúng ảnh base64 rác | **17 / 17 PASS (0 Failed)** | `0` | `0,18s` |
| **3** | `node scripts/validate-xanh-integration.mjs` | Kiểm tra xác thực chữ ký HMAC-SHA256, cửa sổ thời gian 5 phút, chống phát lại nonce (`integration_nonces`) và phân quyền của cổng tích hợp Xanh | **6 / 6 PASS (0 Failed)** | `0` | `0,15s` |
| **4** | `node scripts/test-all.mjs` | Bộ kiểm thử tích hợp End-to-End (E2E) và hồi quy toàn diện trên cơ sở dữ liệu SQLite/D1 thực tế và kho lưu trữ R2 giả lập (29 nhóm kịch bản nghiệp vụ & bảo mật) | **134 / 134 PASS (0 Failed)** | `0` | `8,71s` |

## 2. Chi tiết 29 nhóm kịch bản E2E trong `scripts/test-all.mjs` (134 Assertions)

1. **Nhóm 1 — Health & Identity**: Kiểm tra `/api/health`, định danh `Hệ thống Thông tin Số Sky First` (`app.skyfirst.io.vn`) và header bảo mật `X-Frame-Options: SAMEORIGIN`.
2. **Nhóm 2 — Public SPA Routes & 404**: Kiểm tra toàn bộ route SPA trả về mã `200` và route không tồn tại trả về trang lỗi `404` chuẩn.
3. **Nhóm 3 — Config & 5 chỉ số trang chủ**: Đối chiếu 3 địa chỉ email chuẩn và 5 chỉ số thống kê tự động từ D1.
4. **Nhóm 4 — Xác thực & Vector kiểm thử PBKDF2 độc lập (100k & 150k)**: Xác minh thuật toán PBKDF2 khớp chuẩn RFC 8018, chống dò tài khoản (`401 INVALID_CREDENTIALS` đồng nhất), tự động nâng cấp băm 150k sang 100k với salt mới và cookie `HttpOnly; Secure; SameSite=Strict`.
5. **Nhóm 5 — Kích hoạt tài khoản quản trị & Cưỡng chế `must_change_password=1`**: Chặn truy cập `/api/admin/*` và `/api/me/*` với mã `403 PASSWORD_CHANGE_REQUIRED` cho đến khi đổi mật khẩu hợp lệ; thu hồi phiên cũ ngay sau khi đổi mật khẩu.
6. **Nhóm 6 — Biểu mẫu, Upload Session (Magic Bytes) & Bảo mật tra cứu hồ sơ**: Kiểm tra tải tệp PNG hợp lệ, nộp biểu mẫu tình nguyện viên, yêu cầu đồng thời Mã hồ sơ + Email khi tra cứu `/api/lookup/submission` và phân quyền Handler theo hồ sơ được giao.
7. **Nhóm 7 — Vòng đời Chứng nhận (`SFN-GCN-########`)**: Kiểm tra quy trình Tạo đề nghị → Duyệt độc lập hai bước → Phát hành mã 8 chữ số ngẫu nhiên → Tra cứu công khai (`CÓ HIỆU LỰC`) → Thu hồi (`ĐÃ THU HỒI` kèm lý do).
8. **Nhóm 8 — Minh bạch Tài trợ cơ bản**: Kiểm tra tách biệt tuyệt đối 5 chỉ số (Mục tiêu 50M, Cam kết 20M, Thực nhận 15M, Đã chi 5M, Số dư 10M) và đồng bộ chỉ số thứ 5 trên trang chủ.
9. **Nhóm 9 — Báo cáo An toàn số (`/an-toan`)**: Kiểm tra gửi báo cáo sự cố công khai (`SFN-SAFE-*`) và danh sách xử lý trong Admin.
10. **Nhóm 10 — Trung tâm Email & Chống XSS**: Kiểm tra escape biến đầu vào độc hại (`<img src=x onerror=alert(1)>`) trong bản xem trước email.
11. **Nhóm 11 — Thư viện PDF & Quản lý phiên bản tài liệu**: Kiểm tra phát hành phiên bản `v2`, giữ lịch sử `v1` và chặn xóa tệp đang được tham chiếu (`409 ASSET_IN_USE`).
12. **Nhóm 12 — Visual Page Builder, Phân tách nhiệm vụ & Cách ly đa Website**: Kiểm tra Editor thuộc phạm vi `SFEC` bị chặn tạo trang trên `main` (`403`), quy trình Gửi duyệt → Phê duyệt độc lập → Xuất bản và khôi phục phiên bản trang CMS.
13. **Nhóm 13 — Mẫu Email HTML tự động dùng chung (`email_universal_auto.html`)**: Kiểm tra kết xuất 15+ mẫu email với logo nhúng và không còn bất kỳ token `{{...}}` nào chưa thay thế.
14. **Nhóm 14 — Đặt lại mật khẩu có hỗ trợ của Quản trị viên (`/api/auth/forgot`)**: Đảm bảo không trả về `reset_token` trực tiếp cho người gọi chưa xác thực và tự động tạo phiếu hỗ trợ `SFN-PW-*` kèm nhật ký kiểm toán.
15. **Nhóm 15 — Thông báo chính sách dữ liệu & Tra cứu chứng nhận theo Email/SĐT**: Kiểm tra trả về nguyên văn thông báo chính sách bảo vệ dữ liệu của Sky First Network và tìm kiếm chứng nhận theo email mà không làm lộ email/SĐT trong JSON công khai.
16. **Nhóm 16 — Vòng đời Tài liệu PDF**: Kiểm tra thu hồi (`Đã thu hồi`, chuyển về `internal`) và khôi phục hiệu lực tài liệu.
17. **Nhóm 17 — Thống kê tổng quan Super Admin**: Kiểm tra số liệu thời gian thực và cảnh báo vận hành tại `/api/admin/dashboard`.
18. **Nhóm 18 — Technical SEO (`/robots.txt` & `/sitemap.xml`)**: Kiểm tra chặn `/admin`, `/api/` trong `robots.txt` và xuất URL công khai chuẩn trong `sitemap.xml`.
19. **Nhóm 19 — Chống vét cạn 2FA & Thu hồi phiên khi khóa tài khoản**: Kiểm tra khóa thử thách 2FA sau 5 lần nhập sai mã OTP (`429 RATE_LIMIT`) và hủy phiên tức thì khi tài khoản bị đình chỉ.
20. **Nhóm 20 — Vòng đời Chữ ký Biểu mẫu**: Kiểm tra từ chối nộp thiếu chữ ký bắt buộc (`400 VALIDATION_FAILED`), từ chối tệp script giả danh PNG (`400 FILE_SIGNATURE_MISMATCH`) và chặn truy cập trái phép vào ảnh chữ ký riêng tư (`403`).
21. **Nhóm 21 — Đối soát Tài chính chuyên sâu**: Kiểm tra tạo QR intent, người dùng báo đã chuyển khoản (không tự cộng vào Thực nhận), xác thực Webhook HMAC-SHA256, chống phát lại nonce (`409`), chặn sai tài khoản nhận (`409 WRONG_RECIPIENT_ACCOUNT`), phát hiện chuyển thiếu (`underpaid`), chặn tự duyệt giao dịch (`403 SELF_APPROVAL_FORBIDDEN`), hoàn trả (`refund`), điều chỉnh giảm (`adjustment`) và bảo toàn số dư âm (`-10.000.000 VND`, `is_overspent=true`).
22. **Nhóm 22 — Sao lưu & Phục hồi nguyên tử có xác thực SHA-256**: Kiểm tra ẩn mật khẩu (`[REDACTED_SECRET]`), xác minh SHA-256, từ chối bản sao lưu bị chỉnh sửa (`409 BACKUP_CHECKSUM_MISMATCH`) và khôi phục nguyên tử bảo toàn thông tin đăng nhập.
23. **Nhóm 23 — Danh mục 7 Website chuẩn & Bảo trì theo từng Website**: Xác nhận đúng 7 cổng (`app`, `main`, `ctt`, `mail`, `member`, `sfec`, `exam`) và trả về `503 WEBSITE_MAINTENANCE` khi một cổng thành viên đặt trạng thái bảo trì.
24. **Nhóm 24 — Quản trị CMS 13 trang hệ thống, Song ngữ VI/EN, Khối dùng chung, Hẹn giờ xuất bản & WordPress Adapter**: Kiểm tra phục vụ nội dung VI/EN qua `/api/config?lang=en`, cảnh báo trang bị ảnh hưởng và chặn xóa khối dùng chung đang nhúng (`409 SHARED_BLOCK_IN_USE`), chạy lịch xuất bản tự động, nhân bản trang và nhập/xuất chuẩn WordPress Gutenberg.
25. **Nhóm 25 — Design System & Menu Manager**: Kiểm tra lưu bảng màu/bo góc và menu điều hướng động.
26. **Nhóm 26 — Cưỡng chế 6 chế độ vận hành & Khóa phân hệ**: Kiểm tra `read_only` (`503 READ_ONLY_MODE`), `publishing_paused` (`423 PUBLISHING_PAUSED`), `manual_maintenance` (`503` cho khách, `200` cho Admin bypass) và `403 MODULE_DISABLED` khi tắt phân hệ.
27. **Nhóm 27 — 3 khu vực minh bạch Tài trợ, VietQR không PII & Xuất CSV**: Kiểm tra mã EMVCo (`000201...`) và QR SVG không chứa email/SĐT nhà tài trợ, 3 khu vực minh bạch và xuất tệp `/api/admin/export/sponsorship.csv`.
28. **Nhóm 28 — Chặn tải PDF (`allow_download=false`) & Kiểm toán Media**: Kiểm tra trả về `403 DOWNLOAD_DISABLED` khi gọi `?download=1` và kiểm toán tài nguyên `/api/admin/media/audit`.
29. **Nhóm 29 — Deep Health Check, Pre-Reopen Check, Release QA Gate & Incident Center**: Kiểm tra toàn bộ công cụ SRE/vận hành đạt trạng thái hoạt động tốt.

## 3. Hạng mục phụ thuộc hạ tầng ngoài môi trường Sandbox (Chưa xác minh trực tiếp trên dịch vụ ngoài)

- **Gửi thư thực tế qua Resend API / Cloudflare Email Routing**: Trong sandbox không có kết nối Internet ra ngoài và không gắn khóa `RESEND_API_KEY` thật, nên luồng gửi email được kiểm thử ở chế độ kết xuất HTML đầy đủ và ghi nhật ký an toàn (`status='pending'`) trong bảng `email_logs`.
- **Google OAuth & Cloudflare Turnstile thực tế**: Cần khóa `GOOGLE_CLIENT_ID`/`SECRET` và `TURNSTILE_SITE_KEY`/`SECRET_KEY` trên môi trường Cloudflare thực tế.

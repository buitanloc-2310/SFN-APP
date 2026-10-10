# CTT V6 — ADMIN AUDIT & REPAIR REPORT

**Ngày:** 10/10/2026  
**Đầu vào:** `SFN-APP-CTT-UI-Upgrade-V5-REFERENCE-IMPLEMENTED(1).zip`; các ảnh chụp lỗi do người dùng cung cấp.  
**Đích:** gói mã nguồn V6 để triển khai theo quy trình Cloudflare hiện có. **Chưa deploy production.**

## Tóm tắt

V6 sửa và rà soát sâu trang quản trị CTT, tập trung vào ba vấn đề trong ảnh: thiếu màn hình quản lý thống kê trang chủ, thiếu chỗ sửa/tải ảnh đại diện tin tức, và hộp thoại trình duyệt dạng `ctt.skyfirst.io.vn says`. Trong lúc thử form thống kê, phát hiện trình duyệt chặn nút lưu vì giá trị mặc định 1,8 giây không khớp `step=0.25`; đã sửa bước nhập thành `0.05` và kiểm thử lại thao tác lưu thành công.

## Các mục đã thay đổi

### 1. Menu và điều hướng Admin
- Điều hướng Admin chia nhóm; có tìm kiếm mục menu, mục đang chọn, thu gọn nhóm và nút bật/tắt menu mobile.
- Giữ vị trí cuộn khi điều hướng giữa các phần quản trị.
- Bổ sung hỗ trợ phím `/` để vào ô tìm menu và `Escape` để đóng menu mobile/hộp thoại khi phù hợp.
- Hộp thoại trong ứng dụng hỗ trợ `role=dialog`, `aria-modal`, đưa focus vào nội dung, giữ focus bằng Tab, đóng bằng Escape, trả focus về nút trước đó.
- Đã loại bỏ lời gọi native `prompt()`, `confirm()` và `alert()` trong file JS của `public/` và `src/`; thao tác xác nhận/chỉnh sửa dùng UI trong ứng dụng.
- Hiển thị/điều hướng theo permission tại frontend; quyền API vẫn do backend kiểm tra riêng.

### 2. Bảng quản trị “Thống kê trang chủ”
- Có route Admin riêng `home-stats`, quản lý đúng bốn thẻ: Chương trình & sự kiện, Thành viên cộng đồng, Chứng nhận đã phát hành, Đối tác & đơn vị đồng hành.
- Cho phép chọn nguồn D1 hoặc thủ công; đổi nhãn, nhập số thủ công; xem số D1; xem trước; cài thời lượng và chu kỳ đếm.
- Kiểm tra dữ liệu không âm, số nguyên cho số lượng; thời lượng 0,25–30 giây và 1–100 lượt; nút lưu có trạng thái đang lưu và thông báo kết quả/lỗi.
- Sửa lỗi `step` của thời lượng để giá trị mặc định 1,8 giây hợp lệ trong trình duyệt.
- Xóa số mặc định giả trong cấu hình công khai; không có dữ liệu thì hiện “Chưa có dữ liệu”. Số 0 là số hợp lệ khi D1 thật trả về 0.
- Màn hình thống kê chỉ cấu hình qua API settings. Không thêm câu lệnh SQL và không sửa dữ liệu nghiệp vụ D1.

### 3. CMS tin tức và ảnh đại diện
- Route `news` có bảng tìm kiếm/lọc trạng thái, xem trước, tạo, sửa và xóa bài; hiển thị rõ bản ghi đã có ảnh, chưa có ảnh hoặc ảnh lỗi.
- Form tin tức cho chỉnh tiêu đề, slug, nội dung, trạng thái, giờ đăng theo UTC+7, nhãn và ảnh đại diện.
- Tải ảnh từ máy bằng JPG/JPEG, PNG, WEBP hoặc GIF, giới hạn 15 MB; có preview, thay ảnh và bỏ ảnh hiện tại.
- Upload frontend dùng `/api/admin/media`; API kiểm tra permission `file.manage`, MIME, chữ ký byte thực của ảnh, kích thước; file lưu R2 và có audit log. Endpoint xóa media kiểm tra tài nguyên đang được dùng trước khi xóa.
- Không tạo/sinh ảnh AI. Form nêu rõ phải dùng ảnh thật của hoạt động/chương trình hoặc ảnh được phép sử dụng. Khi chưa có ảnh/hình ảnh hỏng, hiển thị tình trạng rõ ràng và minh họa mặc định.
- Đã sửa lỗi scope ở helper xử lý ảnh đại diện hỏng để nhận `root` cụ thể, tránh tham chiếu nhầm biến ngoài phạm vi.

### 4. Những phần Admin khác được rà soát
- Kiểm tra hiển thị/điều hướng 31 route Admin: dashboard, home-stats, approvals, search, site, header, news, footer, media, classes, events, units, people, tasks, tickets, forms, submissions, recruitment, teaching, terms, certificates, documents, files, users, email, privacy, audit, backup, maintenance, modules, settings.
- Menu mobile, route tìm kiếm và luồng mở/đóng modal được kiểm tra bằng Chromium cục bộ.
- Chuẩn hóa hiển thị ngày/giờ Admin theo `Asia/Ho_Chi_Minh` (UTC+7).
- Nâng phiên bản tài nguyên tĩnh/service worker sang `20261010-v6`; bỏ đăng ký service worker trùng không version.
- Asset logo `public/assets/sfn-logo.png` không chỉnh sửa. SHA-256 trùng file logo gốc được gửi trong lượt này.

## Kiểm thử đã chạy

| Kiểm tra | Kết quả | Ghi chú |
|---|---|---|
| `node scripts/validate.mjs` | PASS | `SFN Production Master validation: OK` |
| `node --check` toàn bộ JS/MJS trong `public`, `src`, `scripts` | PASS | Không phát hiện lỗi cú pháp |
| Tìm native `prompt/confirm/alert` trong JS `public/` và `src/` | PASS | Không còn lời gọi trực tiếp khớp mẫu rà soát |
| 31 route Admin smoke sweep | PASS | Chạy trên UI thật, API được mock; không có browser error/console error |
| Menu search, điều hướng tới Tin tức, modal chỉnh tin, Escape, menu mobile | PASS | Chromium headless cục bộ |
| Lưu thống kê thủ công | PASS | Đã xác nhận frontend gửi `PUT /api/admin/settings` với payload cấu hình |
| Luồng tải ảnh đại diện | PASS mô phỏng | PNG kiểm thử đi qua `FormData` tới mock `POST /api/admin/media`, khóa ảnh được gắn vào mock `PUT /api/admin/content/news/{id}` |
| ZIP integrity (`unzip -t`) | PASS | Không có lỗi cấu trúc nén trong gói V6 |

### Giới hạn kiểm thử

- API trong smoke tests được mock; không ghi vào D1/R2 thật.
- Không deploy lên `ctt.skyfirst.io.vn`, không xác minh ảnh upload trên R2 thật, không kiểm tra binding/secret Cloudflare thực tế.
- Do chưa có môi trường staging live, không thể cam kết tuyệt đối “không có một lỗi nào”. Những lỗi được phát hiện qua kiểm thử cục bộ đã được sửa và các bài test đã chạy lại; cần checklist staging trước production.

## Bảo toàn dữ liệu và kiến trúc

- Không thêm migration SQL.
- Không chạy SQL lên production.
- Không reset/xóa D1 hoặc R2.
- Giữ nguyên kiến trúc Workers + D1 + R2, API, Auth/RBAC hiện hữu; bổ sung chỉ ở lớp UI và luồng upload đã có API.
- Không deploy tự động.

## Hướng dẫn phát hành

1. Giải nén và kiểm tra source, cấu hình binding.
2. Chạy `npm install` và `npm run validate`.
3. Deploy vào Cloudflare preview/staging, không đổi production DNS ngay.
4. Kiểm tra quyền admin thật; lưu cấu hình thống kê; tạo/sửa tin, tải ảnh thật lên R2; mở trang public kiểm tra ảnh; thử người dùng không có `file.manage`.
5. Kiểm tra cache/service worker sau deploy và chỉ phát hành production khi tất cả bước staging đạt.

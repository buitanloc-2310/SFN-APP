# HƯỚNG DẪN THIẾT LẬP VÀ QUẢN TRỊ HỆ THỐNG EMAIL HTML & TÀI LIỆU ĐÍNH KÈM (PHỤ LỤC EMAIL-01)

* **Dự án:** Hệ thống Thông tin Số Sky First (*Sky First Digital Information System*)
* **Tên miền:** `https://app.skyfirst.io.vn`
* **Email hệ thống (From):** `Hệ thống Thông tin Số Sky First <app@skyfirst.io.vn>`
* **Email hỗ trợ (Reply-To):** `support@skyfirst.io.vn`
* **Email liên hệ:** `lienhe@skyfirst.io.vn`
* **Hotline:** `0924 910 210`
* **Mẫu HTML dùng chung:** `public/email-templates/email_universal_auto.html` (được tích hợp trực tiếp vào `src/email.js` và bảng `email_templates`).

---

## 1. Kiến trúc Hệ thống Email HTML & Tự động Phân loại Sự kiện

Hệ thống email trong `src/email.js` được thiết kế đáp ứng toàn bộ 16 điều khoản của **PHỤ LỤC EMAIL-01**:
1. **Mẫu dùng chung (`email_universal_auto.html`)**: Sử dụng cấu trúc bảng HTML (`role="presentation"`) kèm CSS inline tương thích Gmail, Outlook, Apple Mail trên cả máy tính và điện thoại, không phụ thuộc JavaScript, luôn sinh kèm bản văn bản thuần (`text/plain`) đầy đủ.
2. **Tự động ẩn trường tùy chọn rỗng & triệt tiêu biến `{{...}}`**: Các hàng tùy chọn (`{{REQUEST_ID}}`, `{{REGISTRATION_TYPE}}`, `{{SUBMITTED_AT}}`, `{{STATUS}}`, `{{ADDITIONAL_INFO}}`, `{{NEXT_STEPS}}`, `{{ACTION_URL}}`) tự động được ẩn nếu sự kiện không có dữ liệu tương ứng; mọi biến `{{...}}` còn sót đều được dọn sạch trước khi gửi.
3. **Chống XSS & Lọc HTML an toàn**: Mọi dữ liệu người dùng nhập (`RECIPIENT_NAME`, `ADDITIONAL_INFO`, v.v.) đều đi qua `escapeHtml`. Trường `BODY_HTML` đi qua bộ lọc `sanitizeControlledHtml` loại bỏ `<script>`, `<iframe>`, `<object>` và các thuộc tính sự kiện `on*`.
4. **Danh mục 16 sự kiện nghiệp vụ tự động (`EMAIL_EVENT_CATALOG`)**:
   - `EV-01` (`submission_received` / `application_received`): Tiếp nhận đăng ký hoặc hồ sơ mới.
   - `EV-02` (`form_confirmation` / `submission_confirmation`): Xác nhận gửi biểu mẫu.
   - `EV-03` (`document_received`): Thông báo nhận được tài liệu.
   - `EV-04` (`supplement_requested` / `information_required`): Yêu cầu bổ sung hoặc chỉnh sửa thông tin.
   - `EV-05` (`submission_processing`): Thông báo hồ sơ đang được xử lý.
   - `EV-06` (`submission_approved` / `application_approved`): Thông báo hồ sơ được phê duyệt.
   - `EV-07` (`submission_rejected` / `application_rejected`): Thông báo hồ sơ chưa được phê duyệt.
   - `EV-08` (`submission_status_updated` / `application_status_updated`): Cập nhật trạng thái hồ sơ.
   - `EV-09` (`processing_result` / `processing_result_issued` / `official_result`): Thông báo kết quả xử lý chính thức.
   - `EV-10` (`certificate_issued`): Thông báo phát hành chứng nhận hoặc tài liệu chính thức.
   - `EV-11` (`record_lifecycle_changed` / `record_revoked_or_replaced`): Thông báo bản ghi bị thu hồi, thay thế hoặc thay đổi hiệu lực.
   - `EV-12` (`schedule_or_deadline_reminder`): Thông báo lịch phỏng vấn, thời hạn hoặc bước tiếp theo.
   - `EV-13` (`admin_new_request_alert` / `submission_internal`): Thông báo cho quản trị viên khi có yêu cầu mới.
   - `EV-14` (`workflow_completed`): Thông báo hoàn tất quy trình nghiệp vụ.
   - `EV-15` (`support_ticket_updated` / `support_ticket_received`): Phản hồi hoặc cập nhật yêu cầu hỗ trợ / báo cáo an toàn.
   - `EV-16` (`system_authorized_notice` / `account_notification` / `fundraising_update`): Thông báo hệ thống được quản trị viên có thẩm quyền gửi.

---

## 2. Hướng dẫn Thiết lập Nhà cung cấp Email (Resend API / Cloudflare Email)

### 2.1. Cấu hình DNS cho tên miền `skyfirst.io.vn`
Trên Cloudflare DNS, cấu hình các bản ghi xác thực miền gửi thư:
- **SPF (`TXT`)**: `v=spf1 include:_spf.resend.com ~all` (hoặc theo hướng dẫn nhà cung cấp SMTP/API).
- **DKIM (`TXT`)**: Thêm khóa công khai DKIM do Resend / Cloudflare Email cung cấp.
- **DMARC (`TXT` tại `_dmarc.skyfirst.io.vn`)**: `v=DMARC1; p=quarantine; rua=mailto:support@skyfirst.io.vn`

### 2.2. Thiết lập biến môi trường & Secret trên Cloudflare Workers
Trong `wrangler.jsonc`, các biến không nhạy cảm đã được khai báo sẵn:
```json
"MAIL_FROM": "Hệ thống Thông tin Số Sky First <app@skyfirst.io.vn>",
"MAIL_CONTACT": "lienhe@skyfirst.io.vn",
"MAIL_SUPPORT": "support@skyfirst.io.vn"
```
Để kích hoạt gửi email thật trên môi trường Production, nạp khóa bí mật qua Wrangler Secret (tuyệt đối không lưu API key trong mã nguồn):
```bash
npx wrangler secret put RESEND_API_KEY
```

---

## 3. Hướng dẫn Thêm hoặc Sửa Mẫu Email & Thêm Loại Sự kiện Mới

### 3.1. Chỉnh sửa mẫu email qua Giao diện Quản trị
1. Đăng nhập trang Quản trị tại `https://app.skyfirst.io.vn/admin/login` bằng tài khoản có quyền `email.manage` hoặc `super_admin`.
2. Mở phân hệ **Trung tâm Email** (`#admin/emails`).
3. Chọn mẫu cần sửa, cập nhật tiêu đề/nội dung tiếng Việt hoặc tiếng Anh, nhấn **Xem trước** để kiểm tra hiển thị, nhấn **Gửi thử** tới email quản trị, và nhấn **Lưu mẫu**. Hệ thống tự động lưu phiên bản vào bảng `email_template_versions` để có thể khôi phục khi cần.

### 3.2. Thêm loại sự kiện nghiệp vụ mới trong Backend
1. Mở tệp `src/email.js`, thêm định nghĩa sự kiện mới vào đối tượng `EMAIL_EVENT_CATALOG` (gồm `code`, `key`, `aliases`, `required_fields`, `allow_attachments`, `vi`, `en`).
2. Ánh xạ trạng thái trong hàm `classifyEmailEvent(domainAction, statusText)`.
3. Khi cần kích hoạt gửi từ luồng nghiệp vụ, gọi:
   ```js
   await sendTemplatedEmail(env, "ma_su_kien_moi", recipientEmail, {
     RECIPIENT_NAME: "Họ và tên",
     REQUEST_ID: "SFN-...",
     REGISTRATION_TYPE: "Loại nghiệp vụ",
     STATUS: "Trạng thái"
   }, { attachments: [...] });
   ```

---

## 4. Hướng dẫn Thay đổi Logo trong Email (Điều 7)

Hệ thống hỗ trợ 3 chế độ hiển thị logo thông qua tùy chọn `logoMode` trong `renderUniversalEmail(vars, { logoMode })`:
- `data_uri` (Mặc định): Sử dụng ảnh PNG Base64 từ `email_universal_auto.html` (`width="205"`, `style="display:block;width:205px;max-width:100%;height:auto;"`, `alt="Sky First — Education & Community Development"`).
- `https`: Sử dụng URL HTTPS ổn định `https://app.skyfirst.io.vn/assets/sfn-logo.png`.
- `cid`: Sử dụng `cid:skyfirst-logo` khi đính kèm inline MIME.

Để thay logo mới: cập nhật tệp `/public/assets/sfn-logo.png` và hằng số `SKYFIRST_LOGO_HTTPS_URL` trong `src/email.js`.

---

## 5. Hướng dẫn Cấu hình Tài liệu Đính kèm (Hình thức A & Hình thức B — Điều 5)

Hàm `validateAndPrepareAttachments(env, rawAttachments, context)` trong `src/email.js` hỗ trợ 2 hình thức:
1. **Hình thức A — Đính kèm trực tiếp (`mode: "direct"`)**:
   - Đọc tệp từ Cloudflare R2 (`env.FILES`), kiểm tra định dạng MIME được phép (`application/pdf`, `image/png`, `image/jpeg`, `.docx`, `.xlsx`), kiểm tra kích thước (`<= 7MB` cho đính kèm trực tiếp), mã hóa Base64 và đính kèm vào trường `attachments` của gói tin MIME.
2. **Hình thức B — Liên kết tải tài liệu được bảo vệ (`mode: "link"`)**:
   - Cấp mã `email_token` ngẫu nhiên 192-bit cho bản ghi trong bảng `files` và tạo liên kết bảo vệ:
     `https://app.skyfirst.io.vn/api/email-files/{file_id}?token={email_token}&download=1`
   - Tự động chuyển sang Hình thức B nếu tệp lớn hơn 7MB.
3. **Quy tắc an toàn bắt buộc đã thực thi**:
   - Chặn gửi tệp có trạng thái `draft`, `pending_approval`, `revoked`, `rejected`.
   - Chặn gửi chéo hồ sơ (`ATTACHMENT_CROSS_RECORD_FORBIDDEN`): Tệp có `submission_code` của Hồ sơ A bị từ chối nếu gửi trong ngữ cảnh Hồ sơ B.

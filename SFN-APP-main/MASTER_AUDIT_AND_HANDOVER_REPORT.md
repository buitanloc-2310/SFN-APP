# BÁO CÁO KIỂM TOÁN, SỬA LỖI VÀ BÀN GIAO HỆ THỐNG THÔNG TIN SỐ SKY FIRST (V11)

- **Tên hệ thống**: Hệ thống Thông tin Số Sky First (`Sky First Digital Information System`)
- **Tên miền mục tiêu**: `https://app.skyfirst.io.vn`
- **Tệp gốc đầu vào (được giữ nguyên trạng)**: `SFN-APP-SKY-FIRST-ADMIN-ERROR-QR-FIX.zip`
- **Tệp đóng gói bàn giao mới**: `SFN-APP-SKY-FIRST-AUDITED-V11-COMPLETE.zip`

---

## 1. BẢNG TỔNG HỢP KIỂM TOÁN TOÀN HỆ THỐNG (GIAI ĐOẠN 1 & 2)

| Mã kiểm toán | Hạng mục / Vị trí | Mức độ | Nguyên nhân đã xác minh (Cục bộ) / Giả thuyết (Production) | Phương án sửa chữa đã thực hiện | Tệp tác động | Phương pháp kiểm thử & Bằng chứng | Trạng thái |
|---|---|---|---|---|---|---|---|
| **AUD-01** | `POST /api/admin/cms/pages/:id/duplicate` (`duplicate`) | Cao | **Cục bộ (Đã xác minh)**: (1) Sinh slug ngẫu nhiên 3 chữ số (`-ban-sao-XXX`) không kiểm tra trùng `UNIQUE(website_id, slug)` trong `cms_pages`; (2) Ghi `user.id` trực tiếp vào `cms_page_revisions.created_by` và `cms_pages.author_id` không kiểm tra khóa ngoại (`FOREIGN KEY`) hoặc bảng phụ; (3) Khi nhân bản trang hệ thống (`sys_*`), cần ép `page_type='custom'` và kiểm tra `website_id` hợp lệ. **Production**: *Chưa xác minh* (không có log/D1 production trực tiếp). | Bổ sung vòng lặp kiểm tra `UNIQUE(website_id, slug)` tối đa 20 lần đảm bảo slug duy nhất; bổ sung `resolveValidUserId(env, user?.id)` tránh lỗi FK; bọc ghi `cms_page_revisions` an toàn; cho phép tra cứu trang gốc theo cả `id` hoặc `slug`. | `src/admin.js` | Kiểm thử nhân bản liên tiếp 2 lần trên `sys_programs`, `sys_forms`, `sys_credentials`; kiểm thử 401/403/404 (`scripts/test-all.mjs` mục 31.1). | **Đã sửa và đã kiểm thử** (Production: **Chưa xác minh**) |
| **AUD-02** | `GET/PUT /api/admin/cms/pages/sys_programs` & `/workflow` (`sys_programs`) | Cao | **Cục bộ (Đã xác minh)**: (1) `PUT /api/admin/cms/pages/:id` không kiểm tra trùng `slug` trước khi `UPDATE`, gây lỗi SQLite `UNIQUE constraint failed` (HTTP 500); (2) `JSON.parse` trực tiếp trên `blocks_json`/`seo_json`/`tags_json` không có `try/catch` (`parseBodyJson`); (3) `workflow` chỉ tìm theo `id=?` mà không hỗ trợ `slug=?`. **Production**: *Chưa xác minh*. | Chuẩn hóa `parseBodyJson` và `normalizeJsonArr`/`normalizeJsonObj`; kiểm tra trùng `slug` trả về `409 SLUG_EXISTS` có kiểm soát; bảo vệ `page_type='system'` cho mọi trang `id LIKE 'sys_%'`. | `src/admin.js` | Kiểm thử `GET`, `PUT`, `POST /workflow` (`publish`), `POST /duplicate` và kiểm thử xung đột `slug` (`409 SLUG_EXISTS`) trong `scripts/test-all.mjs` mục 31.1. | **Đã sửa và đã kiểm thử** (Production: **Chưa xác minh**) |
| **AUD-03** | `GET/PUT /api/admin/cms/pages/sys_forms` & `/api/admin/forms` (`sys_forms`) | Cao | **Cục bộ (Đã xác minh)**: (1) Trang hệ thống `sys_forms` được khởi tạo với `blocks_json = '[]'`. Trong `POST /api/admin/cms/pages/:id/workflow` (`action='publish'`), nếu cột `page_type` bị lệch hoặc thiếu, điều kiện `!blocks.length && curr.page_type !== 'system'` chặn xuất bản; (2) Trong `PUT /api/admin/forms/:id` và `GET /api/admin/settings`, `JSON.parse` thô có nguy cơ ném `SyntaxError` (500) nếu dữ liệu JSON lỗi. **Production**: *Chưa xác minh*. | Nhận diện trang hệ thống qua `curr.page_type === 'system' \|\| String(id).startsWith('sys_')` để cho phép xuất bản `sys_forms` khi `blocks_json = '[]'`; thay toàn bộ `JSON.parse` thô bằng `parseBodyJson`. | `src/admin.js` | Kiểm thử `GET`, `PUT` với `blocks: []`, `POST /workflow` (`publish`) và `POST /duplicate` cho `sys_forms` (`scripts/test-all.mjs` mục 31.1). | **Đã sửa và đã kiểm thử** (Production: **Chưa xác minh**) |
| **AUD-04** | `GET/PUT /api/admin/cms/pages/sys_credentials` & `/api/admin/certificates` (`sys_credentials`) | Cao | **Cục bộ (Đã xác minh)**: (1) Tương tự `sys_forms`, `sys_credentials` có `blocks_json = '[]'` trong `cms_pages`; (2) Bảng `certificates` trước đây chưa có cột `phone` độc lập (chỉ lưu trong `metadata_json`) và chỉ hỗ trợ cứng 3 tiền tố `GCN`/`GXN`/`BK`. **Production**: *Chưa xác minh*. | Bổ sung nhận diện `sys_credentials` là trang hệ thống; bổ sung migration `0014` thêm cột `phone` + chỉ mục `idx_certificates_phone`; mở rộng `credentialKind` hỗ trợ loại tài liệu cấu hình động. | `src/admin.js`, `src/public.js`, `migrations/0014_*.sql` | Kiểm thử `sys_credentials` (`GET`, `PUT`, `publish`, `duplicate`) và toàn bộ vòng đời 8 bước chứng nhận (`scripts/test-all.mjs` mục 31.1 & 31.3). | **Đã sửa và đã kiểm thử** (Production: **Chưa xác minh**) |
| **AUD-05** | Thống kê & Đối soát Tài trợ (`Tổng tiền tài trợ thực nhận`) | Cao | **Cục bộ (Đã xác minh)**: Trước khi sửa, khi xảy ra lỗi truy vấn D1 trên `/api/config` hoặc `/api/public/sponsorship`, hệ thống trả về `d1Stats = null` khiến giao diện hiển thị `"Chưa có dữ liệu"` (không phân biệt được trạng thái `no_data` với `query_error`), và chưa gắn nhãn trạng thái tường minh giữa `has_positive_received` (> 0) và `zero_received` (= 0). | Cập nhật `/api/config` và `/api/public/sponsorship` phân biệt rõ 4 trạng thái: `has_positive_received`, `zero_received`, `no_data`, `query_error` (trả HTTP 503 khi lỗi DB, không bao giờ biến lỗi API thành `0` giả hoặc `"Chưa có dữ liệu"`); áp dụng nguyên văn mục 4.3–4.7. | `src/public.js`, `public/digital-portal.js`, `migrations/0011_*.sql`, `migrations/0014_*.sql` | Kiểm thử cả 4 trạng thái (`has_positive_received`, `zero_received`, `no_data`, `query_error` với giả lập lỗi D1) trong `scripts/test-all.mjs` mục 31.2. | **Đã sửa và đã kiểm thử** |
| **AUD-06** | Hệ thống Chứng nhận & Văn bản (Loại văn bản, Cột `phone`, Vòng đời 8 bước, Mục 5.5–5.6) | Cao | **Cục bộ (Đã xác minh)**: (1) `credentialKind()` giới hạn cứng ở `GCN`, `GXN`, `BK`; (2) Thiếu thao tác `PUT` (chỉnh sửa trước phát hành), `DELETE` (xóa có kiểm soát bản ghi chưa phát hành và chặn xóa bản ghi đã phát hành), và `PATCH action='approve'` trực tiếp trên `/api/admin/certificates/:id`; (3) Tra cứu SĐT chỉ dùng `metadata_json LIKE`; (4) Tiêu đề thẻ lợi ích trên `/gcn` chưa khớp nguyên văn mục 5.5 và 5.6. | Mở rộng `credentialKind(certType, customPrefix)` hỗ trợ mọi loại văn bản (`GCN`, `GXN`, `BK`, `QD`, `CC`, `TK`, `TCO`, `CN` hoặc tiền tố tùy chỉnh); bổ sung cột `phone` vào `certificates` và ưu tiên truy vấn cột `phone`; hoàn thiện đủ 8 bước vòng đời trên API và Admin UI; cập nhật nguyên văn mục 5.5 & 5.6. | `src/admin.js`, `src/public.js`, `public/digital-portal.js`, `public/app.js`, `migrations/0014_*.sql` | Kiểm thử 8 bước vòng đời (Create, Edit, Delete unissued, Block delete issued `409`, Approve, Issue, Lookup by Code/Email/Phone, Supersede, Revoke, History) & mã cũ `015-GCN-SFN/2025` (`scripts/test-all.mjs` mục 31.3). | **Đã sửa và đã kiểm thử** |
| **AUD-07** | Mã QR xác thực chứng nhận (`/api/public/credentials/:code/qr.svg`) | Trung bình | **Cục bộ (Đã xác minh)**: `src/public.js` dòng 1668 truyền nhãn `"SKY FIRST · XÁC THỰC"` vào `buildLocalQrSvgDataUrl(verifyUrl, "SKY FIRST · XÁC THỰC")`, làm xuất hiện dòng chữ này bên dưới hình SVG QR. | Đổi thành `buildLocalQrSvgDataUrl(verifyUrl, "")` để loại bỏ hoàn toàn chữ `"SKY FIRST · XÁC THỰC"` và không thay thế bằng chữ khác; giữ nguyên cấu trúc QR chuẩn dẫn tới `/gcn/:code` không chứa PII. | `src/public.js` | Kiểm thử SVG QR trả về HTTP 200, không chứa `"SKY FIRST · XÁC THỰC"`, không chứa thẻ `<text>`, không chứa email/SĐT (`scripts/test-all.mjs` mục 31.4). | **Đã sửa và đã kiểm thử** |
| **AUD-08** | Thay thế nguyên văn nội dung giao diện (Mục 7.1–7.6) & Xóa thông báo chính sách/timestamp tra cứu (Mục 8.1–8.3) | Cao | **Cục bộ (Đã xác minh)**: Các chuỗi cũ tại `/gioi-thieu` (7.1, 7.2), `/ho-tro` FAQ (7.3, 7.4), `/ho-so` (7.5), chân trang (7.6) và 2 thông báo chính sách/thời điểm tra cứu (8.1, 8.2) còn tồn tại trong `src/public.js`, `public/digital-portal.js`, `public/index.html`, `public/app.js` và migrations. | Thay thế chính xác từng ký tự theo mục 7.1–7.6; xóa hoàn toàn hiển thị và trường trả về của mục 8.1 & 8.2 trong khi giữ nguyên toàn bộ cơ chế bảo mật/chống IDOR/ẩn PII ở tầng máy chủ (8.3). | `src/public.js`, `public/digital-portal.js`, `public/index.html`, `public/app.js`, `migrations/0009_*.sql`, `migrations/0011_*.sql`, `migrations/0014_*.sql` | Kiểm thử đối chiếu nguyên văn và kiểm tra vắng mặt hoàn toàn các chuỗi bị cấm trong `scripts/validate.mjs` và `scripts/test-all.mjs` mục 15 & 31.5. | **Đã sửa và đã kiểm thử** |

---

## 2. BẢNG ĐỐI CHIẾU NỘI DUNG GIAO DIỆN ĐÃ THAY THẾ VÀ ĐÃ XÓA (GIAI ĐOẠN 4, 5, 6, 7, 8)

| Mục | Vị trí hiển thị / Tệp nguồn | Nội dung trước khi sửa | Nội dung sau khi sửa (Nguyên văn) | Trạng thái |
|---|---|---|---|---|
| **4.3** | `/tai-tro` (`public/digital-portal.js`, `sys_sponsorship` trong `0011` & `0014`) | `Nguyên tắc đối soát tài chính độc lập` — `Mọi khoản chuyển khoản qua mã QR tham chiếu chỉ được ghi nhận vào Số tiền thực nhận sau khi xác thực sao kê ngân hàng hoặc Webhook chữ ký số HMAC-SHA256.` | **Tiêu đề**: `Nguyên tắc đối soát tài chính`<br>**Nội dung**: `Mọi khoản chuyển khoản qua mã QR chỉ được ghi nhận vào số tiền thực nhận sau khi xác minh giao dịch thành công.` | **Đã sửa và đã kiểm thử** |
| **4.4** | `/tai-tro` (`public/digital-portal.js`) | `Tách biệt Cam kết & Thực nhận` — `Số tiền cam kết và số tiền thực nhận được theo dõi và hiển thị thành hai chỉ tiêu độc lập, tuyệt đối không cộng gộp.` | **Tiêu đề**: `Tách biệt tiền cam kết và tiền thực nhận`<br>**Nội dung**: `Theo dõi và công bố riêng số tiền cam kết và số tiền thực nhận, không cộng gộp hai khoản.` | **Đã sửa và đã kiểm thử** |
| **4.5** | `/tai-tro` (`public/digital-portal.js`) | `Đối soát trước khi công bố` — `Mọi khoản thu, khoản chi và báo cáo chứng từ phải được quản trị viên có thẩm quyền xác minh trước khi hiển thị công khai.` | **Tiêu đề**: `Đối soát trước khi công bố`<br>**Nội dung**: `Các khoản thu, chi và chứng từ tài chính phải được người có thẩm quyền xác minh trước khi công khai.` | **Đã sửa và đã kiểm thử** |
| **4.6** | `/tai-tro` (`public/digital-portal.js`) | `Bảo vệ dữ liệu nhà tài trợ` — `Không công khai số tài khoản cá nhân, số định danh hoặc thông tin liên hệ riêng tư của nhà tài trợ.` | **Tiêu đề**: `Bảo vệ thông tin nhà tài trợ`<br>**Nội dung**: `Bảo mật số tài khoản, số định danh và thông tin liên hệ riêng tư của nhà tài trợ.` | **Đã sửa và đã kiểm thử** |
| **4.7** | `/tai-tro` khi chưa có dữ liệu công khai (`public/digital-portal.js`) | `Chưa có dữ liệu tài trợ công khai` — `Hiện tại chưa có chương trình vận động tài trợ hoặc báo cáo tài chính nào được phê duyệt công bố. Hệ thống tuân thủ nguyên tắc minh bạch...` | **Tiêu đề**: `Chưa có dữ liệu tài trợ công khai`<br>**Nội dung**: `Hiện chưa có chương trình vận động tài trợ hoặc báo cáo tài chính được phê duyệt công bố. Không hiển thị số liệu giả lập, không gộp tiền cam kết với tiền thực nhận và chỉ công bố số liệu sau khi hoàn tất đối soát.` | **Đã sửa và đã kiểm thử** |
| **5.5** | `/gcn` (`public/digital-portal.js`) | `Trạng thái minh bạch` — `Phân biệt rõ chứng nhận đang có hiệu lực, hết hiệu lực, đã bị thu hồi hoặc đã được thay thế bằng mã mới.` | **Tiêu đề**: `Trạng thái chứng nhận`<br>**Nội dung**: `Phân biệt rõ chứng nhận đang có hiệu lực, hết hiệu lực, đã bị thu hồi hoặc đã được thay thế bằng mã mới.` | **Đã sửa và đã kiểm thử** |
| **5.6** | `/gcn` (`public/digital-portal.js`) | `Tương thích mã cũ & mới` — `Hỗ trợ đồng thời mã định danh ngẫu nhiên 8 số mới và các mã chứng nhận đã phát hành trước đây.` | **Tiêu đề**: `Tương thích mã cũ và mới`<br>**Nội dung**: `Hỗ trợ đồng thời mã định danh ngẫu nhiên gồm 8 chữ số và các mã chứng nhận đã phát hành trước đây.` | **Đã sửa và đã kiểm thử** |
| **6.1** | `/api/public/credentials/:code/qr.svg` (`src/public.js`) | `buildLocalQrSvgDataUrl(verifyUrl, "SKY FIRST · XÁC THỰC")` | `buildLocalQrSvgDataUrl(verifyUrl, "")` *(Xóa hoàn toàn dòng chữ `"SKY FIRST · XÁC THỰC"`, không thay thế bằng chữ khác)* | **Đã sửa và đã kiểm thử** |
| **7.1** | `/gioi-thieu` (`sys_about` trong `0011` & `0014`) | `Quản trị Tập trung (Admin-Driven)` — `Toàn bộ cấu hình, bố cục, đa ngôn ngữ VI/EN, biểu mẫu và quy trình phê duyệt được vận hành thống nhất từ Trung tâm Quản trị.` | **Tiêu đề**: `Quản trị tập trung`<br>**Nội dung**: `Quản lý thống nhất cấu hình, nội dung, ngôn ngữ hiển thị (Tiếng Việt/Tiếng Anh), biểu mẫu và quy trình phê duyệt trên cùng một hệ thống.` | **Đã sửa và đã kiểm thử** |
| **7.2** | `/gioi-thieu` (`sys_about` trong `0011` & `0014`) | `Xác thực Minh bạch` — `Hỗ trợ tra cứu chứng nhận (GCN/GXN/BK), theo dõi tiến trình hồ sơ và đối soát tài chính theo thời gian thực.` | **Tiêu đề**: `Tra cứu và đối soát thông tin`<br>**Nội dung**: `Hỗ trợ tra cứu chứng nhận, theo dõi tiến trình xử lý hồ sơ và công khai thông tin đối soát tài trợ theo dữ liệu đã xác minh.` | **Đã sửa và đã kiểm thử** |
| **7.3** | `/ho-tro` FAQ (`sys_support` trong `0011` & `0014`) | `Truy cập trang Tra cứu Hồ sơ (/ho-so) và nhập đồng thời Mã hồ sơ (ví dụ: SFN-TNV-2026-0001) cùng địa chỉ Email đã đăng ký.` | **Câu hỏi**: `Làm thế nào để tra cứu trạng thái hồ sơ đã nộp?`<br>**Nội dung**: `Truy cập trang Tra cứu Hồ sơ và nhập Mã hồ sơ kèm địa chỉ Email đã đăng ký.` *(Đã xóa `(/ho-so)` và `(ví dụ: SFN-TNV-2026-0001)`)* | **Đã sửa và đã kiểm thử** |
| **7.4** | `/ho-tro` FAQ (`sys_support` trong `0011` & `0014`) | `Truy cập trang Xác thực Chứng nhận (/gcn) và nhập mã SFN-GCN-######## hoặc tra cứu theo Email/Số điện thoại.` | **Câu hỏi**: `Làm sao để kiểm tra tính xác thực của Giấy chứng nhận?`<br>**Nội dung**: `Truy cập trang Xác thực Chứng nhận và nhập mã chứng nhận hoặc tra cứu bằng Email/Số điện thoại.` *(Đã xóa `(/gcn)` và `SFN-GCN-########`)* | **Đã sửa và đã kiểm thử** |
| **7.5** | `/ho-so` (`public/digital-portal.js`, `lookupCenter` & `caseCenter`) | `Theo dõi tiến trình xử lý hồ sơ đã gửi. Để bảo vệ thông tin cá nhân và chống truy cập trái phép (IDOR), hệ thống kiểm tra đồng thời Mã hồ sơ và Email đăng ký ở phía máy chủ.` | `Theo dõi tiến trình xử lý hồ sơ đã gửi và cập nhật trạng thái xử lý theo thông tin hiện có trên hệ thống.` | **Đã sửa và đã kiểm thử** |
| **7.6** | Chân trang (`public/index.html`, `public/digital-portal.js`, `public/app.js`, `src/public.js`, `0009`, `0014`) | `Mọi thông tin trích dẫn phải ghi rõ nguồn và dẫn liên kết đến nội dung gốc khi có thể; không làm sai lệch nội dung và phải tuân thủ quy định về quyền tác giả, sở hữu trí tuệ và bảo vệ dữ liệu cá nhân.` | `Mọi nội dung trích dẫn phải bảo đảm tính chính xác, trung thực và đầy đủ về ngữ cảnh; ghi rõ nguồn tham khảo và đính kèm liên kết đến tài liệu gốc khi có thể. Việc sử dụng, trích dẫn và chia sẻ thông tin phải tuân thủ quy định về bản quyền, quyền sở hữu trí tuệ và bảo vệ dữ liệu cá nhân.` | **Đã sửa và đã kiểm thử** |
| **8.1** | Thông báo chính sách dữ liệu tra cứu (`src/public.js`, `public/digital-portal.js`, `0009`, `0014`) | `Chính sách dữ liệu tra cứu: Hệ thống chỉ cung cấp thông tin được phép hiển thị theo chính sách dữ liệu của Sky First Network...` | **Đã xóa hoàn toàn khỏi giao diện và phản hồi API** *(giữ nguyên cơ chế bảo vệ dữ liệu ở tầng máy chủ theo mục 8.3)* | **Đã sửa và đã kiểm thử** |
| **8.2** | Thông báo thời điểm phản ánh kết quả tra cứu (`src/public.js`, `public/digital-portal.js`, `0009`, `0014`) | `Kết quả tra cứu phản ánh trạng thái của bản ghi trong cơ sở dữ liệu Hệ thống Thông tin Số Sky First tại thời điểm thực hiện truy vấn.` | **Đã xóa hoàn toàn khỏi giao diện và phản hồi API** | **Đã sửa và đã kiểm thử** |

---

## 3. DANH SÁCH TỆP ĐÃ THAY ĐỔI & TỆP MỚI

1. `migrations/0014_audit_remediation_and_content_sync.sql` *(Tạo mới)*: Thêm cột `phone` và chỉ mục `idx_certificates_phone` cho bảng `certificates`, đồng bộ dữ liệu `phone` từ `metadata_json`, cập nhật `footer_citation_notice`, xóa `lookup_data_policy_notice` / `lookup_timestamp_notice`, và đồng bộ các trang hệ thống `sys_about`, `sys_sponsorship`, `sys_credentials`, `sys_support`.
2. `migrations/0009_super_website_universal_email_and_cms.sql` *(Cập nhật)*: Đồng bộ giá trị khởi tạo `footer_citation_notice` theo mục 7.6 và loại bỏ `lookup_data_policy_notice` / `lookup_timestamp_notice`.
3. `migrations/0011_v10_admin_cms_i18n_governance.sql` *(Cập nhật)*: Đồng bộ dữ liệu khởi tạo `sys_about`, `sys_sponsorship`, `sys_credentials`, `sys_support` theo mục 4.3 và 7.1–7.4.
4. `src/admin.js` *(Cập nhật)*:
   - Xử lý triệt để nguy cơ lỗi 500 trên `duplicate`, `sys_programs`, `sys_forms`, `sys_credentials`.
   - Mở rộng `credentialKind` & `generateCredentialCode` hỗ trợ loại tài liệu/văn bản cấu hình động.
   - Hoàn thiện vòng đời 8 bước chứng nhận (`GET`, `POST`, `PUT`, `DELETE` có chặn xóa bản ghi đã phát hành, `PATCH` với `edit`/`update`, `approve`, `issue`, `revoke`, `supersede`, và `GET /:id/history`).
   - Cập nhật `adminSchemaDiagnostics` kiểm tra cột `phone` của bảng `certificates`.
5. `src/public.js` *(Cập nhật)*:
   - Phân biệt rõ 4 trạng thái tài trợ (`has_positive_received`, `zero_received`, `no_data`, `query_error` trả HTTP 503 khi lỗi DB).
   - Loại bỏ nhãn `"SKY FIRST · XÁC THỰC"` khỏi mã QR SVG (`/api/public/credentials/:code/qr.svg`).
   - Ưu tiên tra cứu số điện thoại qua cột `certificates.phone` (tương thích ngược với `metadata_json`), hỗ trợ mã cũ và các loại văn bản cấu hình mở rộng.
   - Loại bỏ `LOOKUP_DATA_POLICY_*` và `LOOKUP_TIMESTAMP_NOTICE_*` khỏi phản hồi API trong khi giữ nguyên kiểm soát bảo mật/IDOR.
6. `public/digital-portal.js` *(Cập nhật)*:
   - Cập nhật hiển thị 4 trạng thái tài trợ trên Trang chủ (`/`) và trang Minh bạch Tài trợ (`/tai-tro`).
   - Áp dụng nguyên văn nội dung các mục 4.3–4.7, 5.5–5.6, 7.5, 7.6 và loại bỏ hiển thị mục 8.1, 8.2.
7. `public/index.html` *(Cập nhật)*: Cập nhật nguyên văn nội dung `#footerCitationNotice` theo mục 7.6.
8. `public/app.js` *(Cập nhật)*: Nâng cấp giao diện quản trị chứng nhận (`adminCertificates`) hỗ trợ đầy đủ 8 bước vòng đời, trường `phone`, loại tài liệu cấu hình động và cập nhật văn bản trích dẫn mục 7.6.
9. `scripts/validate.mjs` & `scripts/test-all.mjs` *(Cập nhật)*: Bổ sung kiểm tra tĩnh và bộ kiểm thử hồi quy tự động mục 31 (tổng cộng **184/184 bài kiểm thử E2E PASS**).

---

## 4. KẾT QUẢ KIỂM THỬ TỰ ĐỘNG & HỒI QUY (GIAI ĐOẠN 11)

- `node scripts/validate.mjs`: **ĐẠT (OK)** — Kiểm tra cấu trúc tệp, cú pháp JS, tính toàn vẹn mẫu email và kiểm tra cấm xuất hiện các chuỗi cũ/lộ đường dẫn nội bộ.
- `node scripts/validate-ui-reference.mjs`: **ĐẠT (20/20 passed, 0 failed)** — Kiểm tra ánh xạ giao diện chuẩn, 5 chỉ số trang chủ, đồng bộ cache version.
- `node scripts/validate-xanh-integration.mjs`: **ĐẠT (6/6 passed)** — Kiểm tra xác thực chữ ký HMAC-SHA256, chống phát lại nonce và phân quyền tích hợp liên thông.
- `node scripts/test-all.mjs`: **ĐẠT (184/184 passed, 0 failed)** — Kiểm thử toàn diện 31 nhóm chức năng, bảo mật, phân quyền, đối soát tài trợ 4 trạng thái, vòng đời 8 bước chứng nhận, mã QR xác thực và đối chiếu nguyên văn nội dung.

---

## 5. HƯỚNG DẪN TRIỂN KHAI, MIGRATION, ROLLBACK & GIỚI HẠN MÔI TRƯỜNG (GIAI ĐOẠN 13–15)

### 5.1. Giới hạn môi trường kiểm toán
- Quá trình kiểm toán và kiểm thử được thực hiện toàn diện trên mã nguồn thực tế và cơ sở dữ liệu SQLite/D1 cục bộ giả lập sát kiến trúc Cloudflare Workers.
- Do không có quyền truy cập trực tiếp vào Cloudflare D1/R2 production hoặc log thời gian thực của `app.skyfirst.io.vn`, nguyên nhân lỗi trên môi trường production đối với 4 tác vụ `duplicate`, `sys_programs`, `sys_forms`, `sys_credentials` được ghi nhận ở trạng thái **Chưa xác minh trên production**, trong khi toàn bộ nguyên nhân gây lỗi 500 trong mã nguồn và schema đã được khắc phục và kiểm thử đạt 100% ở môi trường cục bộ (**Đã sửa và đã kiểm thử**).

### 5.2. Các bước triển khai lên Cloudflare Workers & D1 Production
1. **Sao lưu dữ liệu D1 trước khi chạy migration**:
   ```bash
   npx wrangler d1 export skyfirst-ctt-db --remote --output=backup-pre-v11.sql
   ```
2. **Áp dụng migration mới (`0014_audit_remediation_and_content_sync.sql`)**:
   ```bash
   npx wrangler d1 execute skyfirst-ctt-db --remote --file=migrations/0014_audit_remediation_and_content_sync.sql
   ```
3. **Chạy bộ kiểm tra trước khi deploy**:
   ```bash
   npm test
   ```
4. **Triển khai Worker & Assets**:
   ```bash
   npx wrangler deploy
   ```
5. **Kiểm tra sau triển khai (Smoke Test)**:
   - Kiểm tra `/api/health` và `/api/admin/system/health` (đảm bảo `schema_diagnostics.ok === true`).
   - Kiểm tra `/api/config`, `/tai-tro`, `/gcn`, `/ho-so`, `/gioi-thieu`, `/ho-tro` và ảnh QR tại `/api/public/credentials/<code_thật>/qr.svg`.

### 5.3. Phương án Rollback an toàn
- Migration `0014` là **tương thích ngược (additive)** — chỉ bổ sung cột `phone` (`DEFAULT ''`) và cập nhật nội dung văn bản cấu hình, không xóa bảng hay xóa dữ liệu nghiệp vụ.
- Nếu cần quay lui phiên bản Worker trước đó: sử dụng `npx wrangler rollback` trên Cloudflare và khôi phục bản sao lưu cấu hình từ `backup-pre-v11.sql` hoặc từ Trung tâm Sao lưu D1/R2 (`/api/admin/backups/:id/restore`).

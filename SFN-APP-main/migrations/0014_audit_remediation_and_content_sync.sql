-- ============================================================================
-- Migration 0014: Audit Remediation, Certificate Phone Schema & Content Sync
-- ============================================================================

-- 1. Add structured phone column and index to certificates (backward-compatible)
ALTER TABLE certificates ADD COLUMN phone TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_certificates_phone ON certificates(phone);

-- Backfill phone from metadata_json where available
UPDATE certificates
SET phone = COALESCE(
  json_extract(metadata_json, '$.phone'),
  json_extract(metadata_json, '$.phone_number'),
  ''
)
WHERE (phone IS NULL OR phone = '')
  AND json_valid(COALESCE(metadata_json, '{}')) = 1
  AND (
    json_extract(metadata_json, '$.phone') IS NOT NULL
    OR json_extract(metadata_json, '$.phone_number') IS NOT NULL
  );

-- 2. Update footer_citation_notice (Phase VII.6) and remove lookup policy/timestamp settings (Phase VIII.1 & VIII.2)
INSERT OR REPLACE INTO settings(key, value_json, updated_at) VALUES
  ('footer_citation_notice', '"Mọi nội dung trích dẫn phải bảo đảm tính chính xác, trung thực và đầy đủ về ngữ cảnh; ghi rõ nguồn tham khảo và đính kèm liên kết đến tài liệu gốc khi có thể. Việc sử dụng, trích dẫn và chia sẻ thông tin phải tuân thủ quy định về bản quyền, quyền sở hữu trí tuệ và bảo vệ dữ liệu cá nhân."', CURRENT_TIMESTAMP),
  ('footer_citation_notice_en', '"All cited content must ensure accuracy, truthfulness, and full context; clearly state reference sources and attach links to original documents when possible. Use, citation, and sharing of information must comply with copyright, intellectual property, and personal data protection regulations."', CURRENT_TIMESTAMP);

DELETE FROM settings WHERE key IN ('lookup_data_policy_notice', 'lookup_data_policy_notice_en', 'lookup_timestamp_notice', 'lookup_timestamp_notice_en');

-- 3. Synchronize CMS System Pages Content (Phase IV.3, Phase VII.1, VII.2, VII.3, VII.4)
UPDATE cms_pages
SET blocks_json = '[{"id":"ab_hero","type":"hero","title":"Nền tảng Hạ tầng Thông tin Số Sky First","subtitle":"Kết nối tri thức • Lan tỏa giá trị • Vì cộng đồng bền vững","ctaText":"Khám phá Chương trình","ctaHref":"/chuong-trinh"},{"id":"ab_cols","type":"columns","columns":[{"title":"Quản trị tập trung","body":"Quản lý thống nhất cấu hình, nội dung, ngôn ngữ hiển thị (Tiếng Việt/Tiếng Anh), biểu mẫu và quy trình phê duyệt trên cùng một hệ thống."},{"title":"Tra cứu và đối soát thông tin","body":"Hỗ trợ tra cứu chứng nhận, theo dõi tiến trình xử lý hồ sơ và công khai thông tin đối soát tài trợ theo dữ liệu đã xác minh."}]}]',
    updated_at = CURRENT_TIMESTAMP
WHERE id = 'sys_about';

UPDATE cms_pages
SET blocks_json = '[{"id":"sp_policy","type":"callout","tone":"info","title":"Nguyên tắc đối soát tài chính","text":"Mọi khoản chuyển khoản qua mã QR chỉ được ghi nhận vào số tiền thực nhận sau khi xác minh giao dịch thành công."}]',
    updated_at = CURRENT_TIMESTAMP
WHERE id = 'sys_sponsorship';

UPDATE cms_pages
SET summary = 'Tra cứu hiệu lực pháp lý nội bộ của Giấy chứng nhận, Giấy xác nhận, Bằng khen và các văn bản đã phát hành.',
    summary_en = 'Verify the authenticity and validity status of Certificates, Confirmations, Merit Awards, and issued documents.',
    updated_at = CURRENT_TIMESTAMP
WHERE id = 'sys_credentials';

UPDATE cms_pages
SET blocks_json = '[{"id":"sup_faq","type":"faq","title":"Câu hỏi thường gặp (FAQ)","items":[{"q":"Làm thế nào để tra cứu trạng thái hồ sơ đã nộp?","a":"Truy cập trang Tra cứu Hồ sơ và nhập Mã hồ sơ kèm địa chỉ Email đã đăng ký."},{"q":"Làm sao để kiểm tra tính xác thực của Giấy chứng nhận?","a":"Truy cập trang Xác thực Chứng nhận và nhập mã chứng nhận hoặc tra cứu bằng Email/Số điện thoại."}]}]',
    blocks_en_json = '[{"id":"sup_faq","type":"faq","title":"Frequently Asked Questions (FAQ)","items":[{"q":"How do I check my submitted application status?","a":"Visit Application Lookup and enter your Reference Code along with your registered Email address."},{"q":"How can I verify an issued Certificate?","a":"Visit Credential Verification and enter the credential code or search by registered Email/Phone."}]}]',
    updated_at = CURRENT_TIMESTAMP
WHERE id = 'sys_support';

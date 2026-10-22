-- HỆ THỐNG THÔNG TIN SỐ SKY FIRST (app.skyfirst.io.vn) — chuẩn hóa cấu hình hiển thị
-- Chỉ cập nhật các giá trị cấu hình hiển thị; không tạo/xóa bảng, không sửa hồ sơ, tài khoản hoặc phân quyền.

INSERT INTO settings (key, value_json) VALUES
  ('app_name', '"Hệ thống Thông tin Số Sky First"'),
  ('app_name_en', '"Sky First Digital Information System"'),
  ('app_short_name', '"Sky First"'),
  ('app_url', '"https://app.skyfirst.io.vn"'),
  ('system_email', '"app@skyfirst.io.vn"'),
  ('contact_email', '"lienhe@skyfirst.io.vn"'),
  ('support_email', '"support@skyfirst.io.vn"'),
  ('footer_email', '"lienhe@skyfirst.io.vn"'),
  ('footer_support_email', '"support@skyfirst.io.vn"'),
  ('footer_portal_email', '"app@skyfirst.io.vn"'),
  ('footer_description', '"Hệ thống thông tin và dịch vụ số phục vụ tra cứu, đăng ký chương trình, biểu mẫu, chứng nhận và minh bạch hoạt động."'),
  ('footer_copyright', '"© 2026 Hệ thống Thông tin Số Sky First (app.skyfirst.io.vn)"'),
  ('home_hero_eyebrow', '"HỆ THỐNG THÔNG TIN SỐ SKY FIRST"'),
  ('home_hero_title', '"Hệ thống Thông tin Số SKY FIRST"'),
  ('home_hero_text', '"Khám phá, tra cứu, đăng ký và quản lý các chương trình, hoạt động, tài liệu, biểu mẫu, chứng nhận và dịch vụ hỗ trợ cộng đồng của Sky First."'),
  ('lookup_title', '"TRA CỨU THÔNG TIN"'),
  ('credential_lookup_title', '"TRA CỨU CHỨNG NHẬN"'),
  ('case_lookup_title', '"TRA CỨU HỒ SƠ"')
ON CONFLICT(key) DO UPDATE SET
  value_json = excluded.value_json,
  updated_at = CURRENT_TIMESTAMP;

SELECT key, value_json, updated_at
FROM settings
WHERE key IN (
  'app_name', 'app_name_en', 'app_url', 'system_email', 'contact_email', 'support_email',
  'footer_description', 'footer_copyright', 'home_hero_eyebrow',
  'home_hero_title', 'home_hero_text', 'lookup_title',
  'credential_lookup_title', 'case_lookup_title'
)
ORDER BY key;

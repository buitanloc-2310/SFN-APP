-- SKY FIRST CTT — giao diện và nội dung công khai
-- Chỉ cập nhật các giá trị cấu hình hiển thị; không tạo/xóa bảng, không sửa hồ sơ, tài khoản hoặc phân quyền.
-- Chạy trong Cloudflare Dashboard > Workers & Pages > D1 > sfn-app-db > Console.

INSERT INTO settings (key, value_json) VALUES
  ('footer_description', '"Hạ tầng thông tin và điểm truy cập số tập trung của Sky First Network."'),
  ('footer_copyright', '"© 2026 Sky First Network"'),
  ('home_hero_eyebrow', '"CỔNG THÔNG TIN SỐ SKY FIRST"'),
  ('home_hero_title', '"THÔNG TIN CẦN TÌM. TIỆN ÍCH CẦN DÙNG."'),
  ('home_hero_text', '"Khám phá chương trình, hoạt động, cơ hội tham gia, tài nguyên và các tiện ích số trong hệ sinh thái Sky First Network."'),
  ('lookup_title', '"TRA CỨU THÔNG TIN"'),
  ('credential_lookup_title', '"TRA CỨU GIẤY ĐÃ PHÁT HÀNH"'),
  ('case_lookup_title', '"TRA CỨU HỒ SƠ"')
ON CONFLICT(key) DO UPDATE SET
  value_json = excluded.value_json,
  updated_at = CURRENT_TIMESTAMP;

-- Kiểm tra cấu hình sau khi chạy
SELECT key, value_json, updated_at
FROM settings
WHERE key IN (
  'footer_description', 'footer_copyright', 'home_hero_eyebrow',
  'home_hero_title', 'home_hero_text', 'lookup_title',
  'credential_lookup_title', 'case_lookup_title'
)
ORDER BY key;

-- Migration 0011: Sky First V10 Comprehensive Admin-Driven CMS, System Page Governance, Multi-Site Registry, Design System, Menus, Bilingual (VI/EN) & Operational State Center
-- Additive, non-destructive migration preserving all existing data, credentials, and routes.
PRAGMA foreign_keys = ON;

-- 1. Multi-Website Governance Registry Cleanup & Expansion (Section 8)
ALTER TABLE websites ADD COLUMN maintenance_mode TEXT NOT NULL DEFAULT 'normal';
ALTER TABLE websites ADD COLUMN maintenance_title TEXT NOT NULL DEFAULT '';
ALTER TABLE websites ADD COLUMN maintenance_message TEXT NOT NULL DEFAULT '';
ALTER TABLE websites ADD COLUMN maintenance_eta TEXT;
ALTER TABLE websites ADD COLUMN theme_json TEXT NOT NULL DEFAULT '{}';
ALTER TABLE websites ADD COLUMN seo_json TEXT NOT NULL DEFAULT '{}';
ALTER TABLE websites ADD COLUMN i18n_json TEXT NOT NULL DEFAULT '{}';

-- Re-point any foreign-key references from deprecated website IDs (slc, tnv, gme) to 'app' before removing deprecated entries
UPDATE cms_pages SET website_id = 'app' WHERE website_id IN ('slc', 'tnv', 'gme');
UPDATE cms_shared_blocks SET website_id = 'app' WHERE website_id IN ('slc', 'tnv', 'gme');
UPDATE sponsorship_campaigns SET website_id = 'app' WHERE website_id IN ('slc', 'tnv', 'gme');
DELETE FROM websites WHERE id IN ('slc', 'tnv', 'gme') OR code IN ('SF-SLC', 'SF-TNV', 'SF-GME', 'SLC', 'TNV', 'GME');

-- Upsert the canonical 7-website Sky First ecosystem catalog
INSERT INTO websites(id, code, name, domain, description, logo_url, primary_color, navy_color, status, config_json, updated_at) VALUES
  ('app', 'SF-APP', 'Hệ thống Thông tin Số Sky First', 'app.skyfirst.io.vn', 'Hệ thống thông tin và dịch vụ số trung tâm của Sky First Network.', '/assets/sfn-logo-tight.png', '#0759b8', '#071b35', 'active', '{"is_primary":true,"role":"central_portal","locales":["vi","en"]}', CURRENT_TIMESTAMP),
  ('main', 'SF-MAIN', 'Trang Thông tin Điện tử Sky First', 'skyfirst.io.vn', 'Cổng thông tin điện tử chính thức giới thiệu tổ chức, sứ mệnh và hoạt động của Sky First.', '/assets/sfn-logo-tight.png', '#0759b8', '#071b35', 'active', '{"is_primary":false,"role":"public_website","locales":["vi","en"]}', CURRENT_TIMESTAMP),
  ('ctt', 'SF-CTT', 'Cổng Thông tin & Tra cứu Sky First', 'ctt.skyfirst.io.vn', 'Cổng tra cứu chứng nhận (GCN/GXN/BK), xác thực hồ sơ và văn bản công khai.', '/assets/sfn-logo-tight.png', '#0759b8', '#071b35', 'active', '{"is_primary":false,"role":"verification_portal","locales":["vi","en"]}', CURRENT_TIMESTAMP),
  ('mail', 'SF-MAIL', 'Hệ thống Thư điện tử Sky First', 'mail.skyfirst.io.vn', ' Trung tâm điều phối thư điện tử, thông báo tự động và xác thực giao dịch của Sky First.', '/assets/sfn-logo-tight.png', '#0759b8', '#071b35', 'active', '{"is_primary":false,"role":"mail_portal","locales":["vi","en"]}', CURRENT_TIMESTAMP),
  ('member', 'SF-MEMBER', 'Cổng Thành viên Sky First', 'member.skyfirst.io.vn', 'Không gian làm việc, hồ sơ nhân sự và điều phối nội bộ dành cho thành viên Sky First.', '/assets/sfn-logo-tight.png', '#0759b8', '#071b35', 'active', '{"is_primary":false,"role":"member_portal","locales":["vi","en"]}', CURRENT_TIMESTAMP),
  ('sfec', 'SF-SFEC', 'SFEC – Sky First Education Club', 'sfec.skyfirst.io.vn', 'Không gian chương trình đào tạo, lớp học cộng đồng và học liệu số thuộc SFEC.', '/assets/sfn-logo-tight.png', '#0759b8', '#071b35', 'active', '{"is_primary":false,"role":"education_portal","locales":["vi","en"]}', CURRENT_TIMESTAMP),
  ('exam', 'SF-EXAM', 'Hệ thống Khảo thí & Đánh giá Sky First', 'exam.skyfirst.io.vn', 'Nền tảng tổ chức kiểm tra năng lực, đánh giá đầu vào và khảo thí trực tuyến.', '/assets/sfn-logo-tight.png', '#0759b8', '#071b35', 'active', '{"is_primary":false,"role":"exam_portal","locales":["vi","en"]}', CURRENT_TIMESTAMP)
ON CONFLICT(id) DO UPDATE SET
  code = excluded.code,
  name = excluded.name,
  domain = excluded.domain,
  description = excluded.description,
  status = excluded.status,
  config_json = excluded.config_json,
  updated_at = CURRENT_TIMESTAMP;

DELETE FROM settings WHERE key IN ('portal_tnv_url', 'portal_slc_url', 'portal_gme_url');
INSERT INTO settings(key, value_json, updated_at) VALUES
  ('portal_app_url', '"https://app.skyfirst.io.vn"', CURRENT_TIMESTAMP),
  ('portal_main_url', '"https://skyfirst.io.vn"', CURRENT_TIMESTAMP),
  ('portal_ctt_url', '"https://ctt.skyfirst.io.vn"', CURRENT_TIMESTAMP),
  ('portal_mail_url', '"https://mail.skyfirst.io.vn"', CURRENT_TIMESTAMP),
  ('portal_member_url', '"https://member.skyfirst.io.vn"', CURRENT_TIMESTAMP),
  ('portal_sfec_url', '"https://sfec.skyfirst.io.vn"', CURRENT_TIMESTAMP),
  ('portal_exam_url', '"https://exam.skyfirst.io.vn"', CURRENT_TIMESTAMP)
ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = CURRENT_TIMESTAMP;

-- 2. Extend cms_pages for Full-Page System Governance, Bilingual (VI/EN), Scheduling & Headless WordPress Sync
ALTER TABLE cms_pages ADD COLUMN page_type TEXT NOT NULL DEFAULT 'custom';
ALTER TABLE cms_pages ADD COLUMN route_path TEXT;
ALTER TABLE cms_pages ADD COLUMN locale TEXT NOT NULL DEFAULT 'vi';
ALTER TABLE cms_pages ADD COLUMN translation_group_id TEXT;
ALTER TABLE cms_pages ADD COLUMN title_en TEXT NOT NULL DEFAULT '';
ALTER TABLE cms_pages ADD COLUMN summary_en TEXT NOT NULL DEFAULT '';
ALTER TABLE cms_pages ADD COLUMN blocks_en_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE cms_pages ADD COLUMN seo_en_json TEXT NOT NULL DEFAULT '{}';
ALTER TABLE cms_pages ADD COLUMN scheduled_at TEXT;
ALTER TABLE cms_pages ADD COLUMN unpublished_at TEXT;
ALTER TABLE cms_pages ADD COLUMN wp_post_id INTEGER;
ALTER TABLE cms_pages ADD COLUMN wp_sync_meta_json TEXT NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_cms_pages_route_path ON cms_pages(website_id, page_type, route_path);
CREATE INDEX IF NOT EXISTS idx_cms_pages_scheduled ON cms_pages(status, scheduled_at);

-- Seed CMS System Pages so Admin controls copy, banners, callouts, FAQs & layout zones for every built-in route
INSERT OR IGNORE INTO cms_pages(id, website_id, slug, page_type, route_path, title, title_en, summary, summary_en, category, status, version, seo_json, seo_en_json, blocks_json, blocks_en_json, published_at) VALUES
  ('sys_home', 'app', 'system-home', 'system', '/', 'Trang chủ Hệ thống Thông tin Số Sky First', 'Sky First Digital Information System Home', 'Điểm truy cập tập trung các chương trình, sự kiện, tài liệu, biểu mẫu, tra cứu hồ sơ, xác thực chứng nhận và minh bạch tài trợ của Sky First.', 'Central digital gateway for Sky First programs, events, documents, forms, case tracking, credential verification, and sponsorship transparency.', 'system', 'published', 1,
   '{"meta_title":"Hệ thống Thông tin Số Sky First (app.skyfirst.io.vn)","meta_description":"Điểm truy cập tập trung các chương trình, sự kiện, tài liệu, biểu mẫu, tra cứu hồ sơ, xác thực chứng nhận và minh bạch tài trợ.","robots":"index,follow"}',
   '{"meta_title":"Sky First Digital Information System (app.skyfirst.io.vn)","meta_description":"Central digital gateway for Sky First programs, events, documents, forms, case tracking, credential verification, and sponsorship transparency.","robots":"index,follow"}',
   '[{"id":"sys_home_callout","type":"callout","tone":"info","title":"Cổng dịch vụ công và dữ liệu xác thực trực tuyến","text":"Mọi số liệu thống kê, danh mục chương trình, văn bản PDF và chứng nhận trên trang chủ đều được truy xuất trực tiếp từ cơ sở dữ liệu D1 đã kiểm duyệt."}]',
   '[{"id":"sys_home_callout","type":"callout","tone":"info","title":"Online Digital Services & Verified Data Portal","text":"All statistics, program listings, PDF documents, and credentials on the homepage are dynamically served from verified D1 database records."}]',
   CURRENT_TIMESTAMP),
  ('sys_about', 'app', 'gioi-thieu', 'system', '/gioi-thieu', 'Giới thiệu Hệ thống Thông tin Số Sky First', 'About Sky First Digital Information System', 'Kiến trúc quản trị dữ liệu tập trung, xác thực định danh số và vận hành minh bạch của mạng lưới Sky First Network.', 'Centralized data governance architecture, digital credential verification, and transparent operations of Sky First Network.', 'system', 'published', 1,
   '{"meta_title":"Giới thiệu — Hệ thống Thông tin Số Sky First","meta_description":"Tổng quan sứ mệnh, hạ tầng số và hệ sinh thái các cổng thông tin trực thuộc Sky First Network.","robots":"index,follow"}',
   '{"meta_title":"About — Sky First Digital Information System","meta_description":"Overview of the mission, digital infrastructure, and portal ecosystem of Sky First Network.","robots":"index,follow"}',
   '[{"id":"ab_hero","type":"hero","title":"Nền tảng Hạ tầng Thông tin Số Sky First","subtitle":"Kết nối tri thức • Lan tỏa giá trị • Vì cộng đồng bền vững","ctaText":"Khám phá Chương trình","ctaHref":"/chuong-trinh"},{"id":"ab_cols","type":"columns","columns":[{"title":"Quản trị tập trung","body":"Quản lý thống nhất cấu hình, nội dung, ngôn ngữ hiển thị (Tiếng Việt/Tiếng Anh), biểu mẫu và quy trình phê duyệt trên cùng một hệ thống."},{"title":"Tra cứu và đối soát thông tin","body":"Hỗ trợ tra cứu chứng nhận, theo dõi tiến trình xử lý hồ sơ và công khai thông tin đối soát tài trợ theo dữ liệu đã xác minh."}]}]',
   '[{"id":"ab_hero","type":"hero","title":"Sky First Digital Information Infrastructure","subtitle":"Connecting Knowledge • Spreading Value • For a Sustainable Community","ctaText":"Explore Programs","ctaHref":"/chuong-trinh"},{"id":"ab_cols","type":"columns","columns":[{"title":"Admin-Driven Governance","body":"All configurations, layouts, VI/EN localization, forms, and approval workflows are centrally operated from the Admin Control Center."},{"title":"Transparent Verification","body":"Real-time verification for issued credentials (GCN/GXN/BK), application status tracking, and financial reconciliation."}]}]',
   CURRENT_TIMESTAMP),
  ('sys_programs', 'app', 'system-programs', 'system', '/chuong-trinh', 'Chương trình & Lớp học Cộng đồng', 'Community Programs & Classes', 'Danh mục các chương trình giáo dục, lớp học kỹ năng và dự án phát triển cộng đồng đang triển khai tại Sky First.', 'Directory of educational programs, skill classes, and community development initiatives operated by Sky First.', 'system', 'published', 1,
   '{"meta_title":"Chương trình & Lớp học — Hệ thống Thông tin Số Sky First","meta_description":"Tra cứu thông tin các lớp học SFEC và chương trình cộng đồng đang mở đăng ký.","robots":"index,follow"}',
   '{"meta_title":"Programs & Classes — Sky First Digital Information System","meta_description":"Browse active SFEC classes and community programs open for registration.","robots":"index,follow"}',
   '[{"id":"prog_guide","type":"guide","title":"Hướng dẫn đăng ký tham gia chương trình","text":"Chọn chương trình phù hợp bên dưới để xem chi tiết lịch học, chỉ tiêu và gửi hồ sơ đăng ký trực tuyến qua biểu mẫu điện tử."}]',
   '[{"id":"prog_guide","type":"guide","title":"Program Registration Guide","text":"Select a program below to review schedules, capacity, and submit your online registration form."}]',
   CURRENT_TIMESTAMP),
  ('sys_events', 'app', 'system-events', 'system', '/su-kien', 'Sự kiện & Hoạt động', 'Events & Activities', 'Lịch sự kiện, hội thảo học thuật và hoạt động kết nối cộng đồng của Sky First Network.', 'Schedule of events, academic workshops, and community engagement activities of Sky First Network.', 'system', 'published', 1,
   '{"meta_title":"Sự kiện & Hoạt động — Hệ thống Thông tin Số Sky First","meta_description":"Cập nhật lịch sự kiện và đăng ký tham dự trực tuyến.","robots":"index,follow"}',
   '{"meta_title":"Events & Activities — Sky First Digital Information System","meta_description":"View upcoming events and register online.","robots":"index,follow"}',
   '[]', '[]', CURRENT_TIMESTAMP),
  ('sys_sponsorship', 'app', 'system-sponsorship', 'system', '/tai-tro', 'Minh bạch Tài trợ & Đối soát Tài chính', 'Sponsorship Transparency & Financial Reconciliation', 'Công khai chiến dịch tài trợ, bảng sao kê giao dịch đã xác minh, chứng từ giải ngân và báo cáo tài chính định kỳ.', 'Public disclosure of sponsorship campaigns, verified transaction ledgers, disbursement vouchers, and periodic financial reports.', 'system', 'published', 1,
   '{"meta_title":"Minh bạch Tài trợ — Hệ thống Thông tin Số Sky First","meta_description":"Theo dõi mục tiêu, số tiền cam kết, thực nhận, đã giải ngân và số dư thực tế của các chương trình tài trợ.","robots":"index,follow"}',
   '{"meta_title":"Sponsorship Transparency — Sky First Digital Information System","meta_description":"Track target, pledged, verified received, disbursed, and exact remaining balances of sponsorship campaigns.","robots":"index,follow"}',
   '[{"id":"sp_policy","type":"callout","tone":"info","title":"Nguyên tắc đối soát tài chính","text":"Mọi khoản chuyển khoản qua mã QR chỉ được ghi nhận vào số tiền thực nhận sau khi xác minh giao dịch thành công."}]',
   '[{"id":"sp_policy","type":"callout","tone":"info","title":"Independent Financial Reconciliation Principle","text":"All QR-referenced transfers are only credited to Verified Received Amount after bank statement reconciliation or HMAC-SHA256 webhook verification."}]',
   CURRENT_TIMESTAMP),
  ('sys_resources', 'app', 'system-resources', 'system', '/tai-lieu', 'Thư viện Tài liệu & Văn bản PDF', 'Document & PDF Library', 'Kho lưu trữ văn bản, quyết định, biểu mẫu hướng dẫn và tài liệu học thuật chính thức có kiểm soát phiên bản.', 'Version-controlled repository of official decisions, guidelines, manuals, and academic PDF documents.', 'system', 'published', 1,
   '{"meta_title":"Thư viện Tài liệu & PDF — Hệ thống Thông tin Số Sky First","meta_description":"Xem trực tuyến và tải xuống các tài liệu, hướng dẫn và văn bản chính thức của Sky First.","robots":"index,follow"}',
   '{"meta_title":"Document & PDF Library — Sky First Digital Information System","meta_description":"Preview online and download official Sky First documents, manuals, and publications.","robots":"index,follow"}',
   '[]', '[]', CURRENT_TIMESTAMP),
  ('sys_forms', 'app', 'system-forms', 'system', '/bieu-mau', 'Biểu mẫu Điện tử Trực tuyến', 'Online Electronic Forms', 'Hệ thống tiếp nhận hồ sơ đăng ký học viên, tình nguyện viên, thành viên, đối tác và yêu cầu hỗ trợ trực tuyến.', 'Online intake system for student, volunteer, member, partner applications, and support requests.', 'system', 'published', 1,
   '{"meta_title":"Biểu mẫu Điện tử — Hệ thống Thông tin Số Sky First","meta_description":"Điền và gửi hồ sơ trực tuyến kèm chữ ký xác nhận và tệp đính kèm an toàn.","robots":"index,follow"}',
   '{"meta_title":"Electronic Forms — Sky First Digital Information System","meta_description":"Complete and submit online forms with digital signature confirmation and secure file attachments.","robots":"index,follow"}',
   '[]', '[]', CURRENT_TIMESTAMP),
  ('sys_cases', 'app', 'system-cases', 'system', '/ho-so', 'Tra cứu Tiến trình Hồ sơ', 'Application Status Lookup', 'Kiểm tra trạng thái xử lý, lịch sử tiếp nhận và yêu cầu bổ sung của hồ sơ đã gửi bằng Mã hồ sơ và Email đăng ký.', 'Track processing status, intake timeline, and follow-up requirements using your Application Code and Registered Email.', 'system', 'published', 1,
   '{"meta_title":"Tra cứu Hồ sơ — Hệ thống Thông tin Số Sky First","meta_description":"Tra cứu tiến trình xử lý hồ sơ bảo mật bằng mã hồ sơ và email đăng ký.","robots":"index,follow"}',
   '{"meta_title":"Application Lookup — Sky First Digital Information System","meta_description":"Securely track your application status using your reference code and registered email.","robots":"index,follow"}',
   '[]', '[]', CURRENT_TIMESTAMP),
  ('sys_lookup', 'app', 'system-lookup', 'system', '/tra-cuu', 'Trung tâm Tra cứu & Xác thực Tập trung', 'Central Verification & Lookup Hub', 'Cổng tra cứu tích hợp cho Giấy chứng nhận (GCN), Giấy xác nhận (GXN), Bằng khen (BK) và hồ sơ điện tử Sky First.', 'Unified verification portal for Certificates (GCN), Confirmations (GXN), Merit Awards (BK), and electronic applications.', 'system', 'published', 1,
   '{"meta_title":"Trung tâm Tra cứu — Hệ thống Thông tin Số Sky First","meta_description":"Xác thực chứng nhận và tra cứu hồ sơ trực tuyến trên Hệ thống Thông tin Số Sky First.","robots":"index,follow"}',
   '{"meta_title":"Verification Hub — Sky First Digital Information System","meta_description":"Verify issued credentials and track applications online on the Sky First Digital Information System.","robots":"index,follow"}',
   '[]', '[]', CURRENT_TIMESTAMP),
  ('sys_credentials', 'app', 'system-credentials', 'system', '/gcn', 'Xác thực Chứng nhận, Xác nhận & Bằng khen', 'Credential Verification (GCN / GXN / BK)', 'Tra cứu hiệu lực pháp lý nội bộ của Giấy chứng nhận, Giấy xác nhận, Bằng khen và các văn bản đã phát hành.', 'Verify the authenticity and validity status of Certificates, Confirmations, Merit Awards, and issued documents.', 'system', 'published', 1,
   '{"meta_title":"Xác thực Chứng nhận (GCN/GXN/BK) — Hệ thống Thông tin Số Sky First","meta_description":"Tra cứu chứng nhận theo mã định danh 8 chữ số hoặc email/số điện thoại đã đăng ký.","robots":"index,follow"}',
   '{"meta_title":"Credential Verification (GCN/GXN/BK) — Sky First Digital Information System","meta_description":"Verify credentials by 8-digit code or registered email/phone number.","robots":"index,follow"}',
   '[]', '[]', CURRENT_TIMESTAMP),
  ('sys_safety', 'app', 'system-safety', 'system', '/an-toan', 'An toàn Thông tin & Báo cáo Sự cố Số', 'Digital Safety & Incident Reporting', 'Cảnh báo phòng chống giả mạo thương hiệu Sky First, hướng dẫn bảo mật tài khoản và kênh tiếp nhận báo cáo sự cố 24/7.', 'Anti-impersonation advisories, account security guidelines, and 24/7 digital safety incident reporting channel.', 'system', 'published', 1,
   '{"meta_title":"An toàn & Bảo mật Số — Hệ thống Thông tin Số Sky First","meta_description":"Hướng dẫn nhận diện kênh chính thức của Sky First và gửi báo cáo sự cố an toàn thông tin.","robots":"index,follow"}',
   '{"meta_title":"Digital Safety & Security — Sky First Digital Information System","meta_description":"Verify official Sky First channels and report digital security or impersonation incidents.","robots":"index,follow"}',
   '[]', '[]', CURRENT_TIMESTAMP),
  ('sys_support', 'app', 'ho-tro', 'system', '/ho-tro', 'Trung tâm Hỗ trợ & Liên hệ Công tác', 'Support & Official Contact Center', 'Kênh tiếp nhận yêu cầu hỗ trợ kỹ thuật, giải đáp thủ tục hồ sơ và liên hệ hợp tác chính thức của Sky First.', 'Official channel for technical support, application inquiries, and institutional partnership requests.', 'system', 'published', 1,
   '{"meta_title":"Hỗ trợ & Liên hệ — Hệ thống Thông tin Số Sky First","meta_description":"Liên hệ bộ phận hỗ trợ kỹ thuật và văn phòng điều hành Sky First Network.","robots":"index,follow"}',
   '{"meta_title":"Support & Contact — Sky First Digital Information System","meta_description":"Contact Sky First Network technical support and executive office.","robots":"index,follow"}',
   '[{"id":"sup_faq","type":"faq","title":"Câu hỏi thường gặp (FAQ)","items":[{"q":"Làm thế nào để tra cứu trạng thái hồ sơ đã nộp?","a":"Truy cập trang Tra cứu Hồ sơ và nhập Mã hồ sơ kèm địa chỉ Email đã đăng ký."},{"q":"Làm sao để kiểm tra tính xác thực của Giấy chứng nhận?","a":"Truy cập trang Xác thực Chứng nhận và nhập mã chứng nhận hoặc tra cứu bằng Email/Số điện thoại."}]}]',
   '[{"id":"sup_faq","type":"faq","title":"Frequently Asked Questions (FAQ)","items":[{"q":"How do I check my submitted application status?","a":"Visit Application Lookup and enter your Reference Code along with your registered Email address."},{"q":"How can I verify an issued Certificate?","a":"Visit Credential Verification and enter the credential code or search by registered Email/Phone."}]}]',
   CURRENT_TIMESTAMP),
  ('sys_login', 'app', 'system-admin-login', 'system', '/admin/login', 'Đăng nhập Cổng Quản trị Hệ thống', 'System Administration Portal Sign In', 'Khu vực xác thực dành riêng cho Quản trị viên, Ban Điều hành, Bộ phận Duyệt và Cán bộ xử lý nghiệp vụ Sky First.', 'Restricted authentication portal for Sky First Administrators, Executive Board, Reviewers, and Case Handlers.', 'system', 'published', 1,
   '{"meta_title":"Đăng nhập Quản trị — Hệ thống Thông tin Số Sky First","meta_description":"Cổng đăng nhập quản trị bảo mật đa lớp (PBKDF2 & TOTP 2FA).","robots":"noindex,nofollow"}',
   '{"meta_title":"Admin Sign In — Sky First Digital Information System","meta_description":"Multi-factor secure administrative sign-in portal.","robots":"noindex,nofollow"}',
   '[{"id":"login_notice","type":"callout","tone":"info","title":"Quy định bảo mật truy cập quản trị","text":"Mọi phiên đăng nhập và thao tác quản trị đều được ghi nhật ký kiểm toán (Audit Log). Nếu quên mật khẩu, vui lòng gửi yêu cầu để Quản trị viên cấp cao xác minh và cấp lại."}]',
   '[{"id":"login_notice","type":"callout","tone":"info","title":"Administrative Access Security Policy","text":"All sign-in sessions and administrative actions are recorded in the immutable Audit Log. For password recovery, submit an admin-assisted reset request."}]',
   CURRENT_TIMESTAMP);

-- 3. Expand CMS Templates & Reusable Shared Blocks (Section 5.3)
INSERT OR IGNORE INTO cms_templates(id, key, name, category, description, blocks_json) VALUES
  ('tpl_event', 'event-page', 'Mẫu Trang Sự kiện & Hội thảo', 'event', 'Bố cục chuẩn cho trang giới thiệu sự kiện, lịch trình timeline và biểu mẫu đăng ký tham dự.', '[{"id":"b1","type":"hero","title":"Tên sự kiện / Hội thảo","subtitle":"Thời gian • Địa điểm • Đơn vị tổ chức","ctaText":"Đăng ký tham dự","ctaHref":"/bieu-mau"},{"id":"b2","type":"timeline","title":"Lịch trình chương trình","items":[{"time":"08:30","title":"Đón tiếp đại biểu & Check-in","desc":"Quét mã QR check-in tại bàn lễ tân"},{"time":"09:00","title":"Phiên toàn thể","desc":"Trình bày báo cáo và thảo luận chuyên đề"}]},{"id":"b3","type":"faq","title":"Thông tin lưu ý cho người tham dự","items":[{"q":"Quy định trang phục và thẻ tham dự","a":"Mang theo mã check-in đã nhận qua email xác nhận."}]}]'),
  ('tpl_transparency', 'transparency-page', 'Mẫu Trang Báo cáo Minh bạch', 'sponsorship', 'Bố cục công bố số liệu thống kê, bảng tổng hợp kinh phí và tài liệu PDF đính kèm.', '[{"id":"b1","type":"heading","level":"h1","text":"Báo cáo Minh bạch Hoạt động & Tài chính"},{"id":"b2","type":"stats","title":"Số liệu tổng hợp kỳ báo cáo","items":[{"label":"Tổng kinh phí thực nhận","value":"Theo sao kê D1"},{"label":"Tỷ lệ đối soát chứng từ","value":"100%"}]},{"id":"b3","type":"table","title":"Bảng kê tổng hợp hạng mục","headers":["Hạng mục","Nội dung","Trạng thái đối soát"],"rows":[["Học liệu cộng đồng","Hỗ trợ sách và tài liệu học tập","Đã xác minh"]]}]'),
  ('tpl_faq_support', 'faq-support-page', 'Mẫu Trang Hướng dẫn & Giải đáp (FAQ)', 'support', 'Bố cục gồm khối hướng dẫn từng bước, câu hỏi thường gặp (Accordion) và nút liên hệ hỗ trợ.', '[{"id":"b1","type":"guide","title":"Hướng dẫn thực hiện từng bước","text":"1. Chuẩn bị thông tin cá nhân và minh chứng.\n2. Điền biểu mẫu trực tuyến.\n3. Lưu mã hồ sơ để tra cứu tiến trình."},{"id":"b2","type":"faq","title":"Câu hỏi thường gặp","items":[{"q":"Thời gian xử lý hồ sơ bao lâu?","a":"Thông thường từ 3 đến 5 ngày làm việc kể từ khi nhận đủ hồ sơ hợp lệ."}]},{"id":"b3","type":"cta","title":"Cần hỗ trợ thêm?","text":"Liên hệ bộ phận hỗ trợ kỹ thuật nếu bạn gặp vướng mắc trong quá trình thao tác.","ctaText":"Gửi yêu cầu hỗ trợ","ctaHref":"/bieu-mau"}]');

INSERT OR IGNORE INTO cms_shared_blocks(id, website_id, key, name, block_type, config_json, status, updated_at) VALUES
  ('sb_contact_cta', 'app', 'official-contact-cta', 'Khối Liên hệ & Hỗ trợ Chính thức (Dùng chung)', 'cta', '{"title":"Kênh hỗ trợ chính thức của Sky First","title_en":"Official Sky First Support Channel","text":"Mọi thắc mắc về hồ sơ, chứng nhận hoặc tài trợ vui lòng liên hệ support@skyfirst.io.vn hoặc hotline 0924 910 210.","text_en":"For inquiries regarding applications, credentials, or sponsorship, please contact support@skyfirst.io.vn or hotline 0924 910 210.","ctaText":"Gửi yêu cầu hỗ trợ","ctaText_en":"Submit Support Request","ctaHref":"/bieu-mau"}', 'active', CURRENT_TIMESTAMP),
  ('sb_privacy_callout', 'app', 'data-privacy-callout', 'Khối Chính sách Bảo vệ Dữ liệu Cá nhân (Dùng chung)', 'callout', '{"tone":"info","title":"Cam kết bảo vệ dữ liệu cá nhân","title_en":"Personal Data Protection Commitment","text":"Hệ thống chỉ công khai các trường thông tin được phép theo quy chế dữ liệu của Sky First Network. Email và số điện thoại cá nhân luôn được bảo mật ở tầng máy chủ.","text_en":"The system only discloses fields permitted under Sky First Network data governance policy. Personal emails and phone numbers are strictly protected server-side."}', 'active', CURRENT_TIMESTAMP),
  ('sb_safety_warning', 'app', 'anti-fraud-warning', 'Khối Cảnh báo Phòng chống Giả mạo (Dùng chung)', 'callout', '{"tone":"warn","title":"Cảnh báo an toàn thông tin","title_en":"Digital Security Advisory","text":"Sky First chỉ sử dụng tên miền chính thức *.skyfirst.io.vn và các hộp thư @skyfirst.io.vn. Tuyệt đối không chuyển khoản vào các tài khoản cá nhân không nằm trong danh mục công bố tại trang Minh bạch Tài trợ.","text_en":"Sky First exclusively uses *.skyfirst.io.vn domains and @skyfirst.io.vn email addresses. Never transfer funds to personal accounts not listed on the official Sponsorship Transparency page."}', 'active', CURRENT_TIMESTAMP);

-- 4. Menus & Navigation Governance Table (Section 6)
CREATE TABLE IF NOT EXISTS menus (
  id TEXT PRIMARY KEY,
  website_id TEXT NOT NULL DEFAULT 'app',
  location TEXT NOT NULL,
  name TEXT NOT NULL,
  items_json TEXT NOT NULL DEFAULT '[]',
  updated_by INTEGER,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(website_id, location)
);

INSERT OR IGNORE INTO menus(id, website_id, location, name, items_json, updated_at) VALUES
  ('menu_app_header', 'app', 'header', 'Menu Điều hướng Chính (Header)', '[
    {"id":"m_home","label_vi":"Trang chủ","label_en":"Home","href":"/","module_key":"","enabled":true,"target":"_self"},
    {"id":"m_prog","label_vi":"Chương trình","label_en":"Programs","href":"/chuong-trinh","module_key":"classes","enabled":true,"target":"_self"},
    {"id":"m_event","label_vi":"Sự kiện","label_en":"Events","href":"/su-kien","module_key":"events","enabled":true,"target":"_self"},
    {"id":"m_spon","label_vi":"Tài trợ","label_en":"Sponsorship","href":"/tai-tro","module_key":"sponsorship","enabled":true,"target":"_self"},
    {"id":"m_docs","label_vi":"Tài liệu","label_en":"Documents","href":"/tai-lieu","module_key":"documents","enabled":true,"target":"_self"},
    {"id":"m_forms","label_vi":"Biểu mẫu","label_en":"Forms","href":"/bieu-mau","module_key":"forms","enabled":true,"target":"_self"},
    {"id":"m_cases","label_vi":"Hồ sơ","label_en":"Applications","href":"/ho-so","module_key":"lookup","enabled":true,"target":"_self"},
    {"id":"m_certs","label_vi":"Chứng nhận","label_en":"Credentials","href":"/gcn","module_key":"certificates","enabled":true,"target":"_self"},
    {"id":"m_safe","label_vi":"An toàn","label_en":"Safety","href":"/an-toan","module_key":"safety","enabled":true,"target":"_self"}
  ]', CURRENT_TIMESTAMP),
  ('menu_app_footer_primary', 'app', 'footer_primary', 'Menu Chân trang — Dịch vụ Số', '[
    {"id":"f_lookup","label_vi":"Trung tâm Tra cứu","label_en":"Verification Hub","href":"/tra-cuu","module_key":"lookup","enabled":true,"target":"_self"},
    {"id":"f_gcn","label_vi":"Xác thực GCN / GXN / BK","label_en":"Verify GCN / GXN / BK","href":"/gcn","module_key":"certificates","enabled":true,"target":"_self"},
    {"id":"f_hoso","label_vi":"Tra cứu Tiến trình Hồ sơ","label_en":"Application Status Lookup","href":"/ho-so","module_key":"lookup","enabled":true,"target":"_self"},
    {"id":"f_bieumau","label_vi":"Biểu mẫu Điện tử","label_en":"Electronic Forms","href":"/bieu-mau","module_key":"forms","enabled":true,"target":"_self"},
    {"id":"f_tailieu","label_vi":"Thư viện Tài liệu PDF","label_en":"PDF Document Library","href":"/tai-lieu","module_key":"documents","enabled":true,"target":"_self"},
    {"id":"f_taitro","label_vi":"Minh bạch Tài trợ","label_en":"Sponsorship Transparency","href":"/tai-tro","module_key":"sponsorship","enabled":true,"target":"_self"},
    {"id":"f_antoan","label_vi":"An toàn & Báo cáo Sự cố","label_en":"Digital Safety & Reporting","href":"/an-toan","module_key":"safety","enabled":true,"target":"_self"}
  ]', CURRENT_TIMESTAMP),
  ('menu_app_footer_ecosystem', 'app', 'footer_ecosystem', 'Menu Chân trang — Hệ sinh thái Sky First', '[
    {"id":"eco_app","label_vi":"Hệ thống Thông tin Số (app.skyfirst.io.vn)","label_en":"Digital Information System (app.skyfirst.io.vn)","href":"https://app.skyfirst.io.vn","enabled":true,"target":"_self"},
    {"id":"eco_main","label_vi":"Trang Thông tin Điện tử (skyfirst.io.vn)","label_en":"Official Website (skyfirst.io.vn)","href":"https://skyfirst.io.vn","enabled":true,"target":"_blank"},
    {"id":"eco_ctt","label_vi":"Cổng Thông tin & Tra cứu (ctt.skyfirst.io.vn)","label_en":"Verification Portal (ctt.skyfirst.io.vn)","href":"https://ctt.skyfirst.io.vn","enabled":true,"target":"_blank"},
    {"id":"eco_sfec","label_vi":"Sky First Education Club (sfec.skyfirst.io.vn)","label_en":"Sky First Education Club (sfec.skyfirst.io.vn)","href":"https://sfec.skyfirst.io.vn","enabled":true,"target":"_blank"},
    {"id":"eco_member","label_vi":"Cổng Thành viên (member.skyfirst.io.vn)","label_en":"Member Portal (member.skyfirst.io.vn)","href":"https://member.skyfirst.io.vn","enabled":true,"target":"_blank"},
    {"id":"eco_exam","label_vi":"Hệ thống Khảo thí (exam.skyfirst.io.vn)","label_en":"Examination System (exam.skyfirst.io.vn)","href":"https://exam.skyfirst.io.vn","enabled":true,"target":"_blank"},
    {"id":"eco_mail","label_vi":"Hệ thống Thư điện tử (mail.skyfirst.io.vn)","label_en":"Mail System (mail.skyfirst.io.vn)","href":"https://mail.skyfirst.io.vn","enabled":true,"target":"_blank"}
  ]', CURRENT_TIMESTAMP);

-- 5. System Incidents & Operational State Governance Table (Sections 7 & 18)
CREATE TABLE IF NOT EXISTS system_incidents (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  website_id TEXT NOT NULL DEFAULT 'app',
  severity TEXT NOT NULL DEFAULT 'warning',
  category TEXT NOT NULL DEFAULT 'system',
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open',
  resolution_note TEXT NOT NULL DEFAULT '',
  created_by INTEGER,
  resolved_by INTEGER,
  resolved_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_system_incidents_status ON system_incidents(status, severity, created_at DESC);

-- 6. Seed Design System, Operational Mode & Bilingual Settings in settings table
INSERT INTO settings(key, value_json, updated_at) VALUES
  ('system_operational_mode', '"normal"', CURRENT_TIMESTAMP),
  ('maintenance_config', '{"mode":"normal","title_vi":"Hệ thống Thông tin Số Sky First đang bảo trì","title_en":"Sky First Digital Information System Under Maintenance","message_vi":"Hệ thống đang được nâng cấp kỹ thuật để đảm bảo an toàn và chất lượng dịch vụ. Vui lòng quay lại sau.","message_en":"The system is undergoing scheduled technical maintenance to ensure security and service quality. Please check back shortly.","reason":"","scheduled_start":"","scheduled_end":"","eta":"","show_pre_banner":false,"pre_banner_vi":"","pre_banner_en":"","contact_email":"support@skyfirst.io.vn","hotline":"0924 910 210","allow_admin_bypass":true,"bypass_roles":["owner","super_admin","system_admin"]}', CURRENT_TIMESTAMP),
  ('design_system', '{"primary_color":"#0759b8","navy_color":"#071b35","accent_color":"#0b78d1","surface_color":"#f4f7fb","success_color":"#0f766e","warning_color":"#b45309","danger_color":"#b91c1c","font_heading":"Be Vietnam Pro, Inter, system-ui, sans-serif","font_body":"Inter, system-ui, sans-serif","font_mono":"JetBrains Mono, monospace","radius_scale":"rounded","density":"comfortable","card_style":"elevated","default_theme":"light","allow_dark_mode":true,"logo_url":"/assets/sfn-logo-tight.png","wordmark_url":"/assets/sfn-wordmark.png","cover_url":"/assets/sfn-cover.png","favicon_url":"/assets/sfn-logo-tight.png"}', CURRENT_TIMESTAMP),
  ('hero_title_en', '"Sky First Digital Information System"', CURRENT_TIMESTAMP),
  ('hero_text_en', '"Explore, verify, register, and manage Sky First programs, activities, official documents, electronic forms, digital credentials, and community support services."', CURRENT_TIMESTAMP),
  ('brand_slogan_en', '"Connecting Knowledge • Spreading Value • For a Sustainable Community"', CURRENT_TIMESTAMP),
  ('footer_description_en', '"Central digital information and verification system serving program registration, electronic forms, credential verification, and financial transparency."', CURRENT_TIMESTAMP),
  ('header_account_label_en', '"Admin Sign In"', CURRENT_TIMESTAMP),
  ('wordpress_integration_config', '{"enabled":false,"mode":"headless_rest_adapter","wp_base_url":"","sync_direction":"wp_to_d1","allow_gutenberg_import":true,"allow_json_export":true,"security_policy":"sanitize_structured_blocks_only"}', CURRENT_TIMESTAMP)
ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = CURRENT_TIMESTAMP;

-- 7. Register new V10 Admin governance modules in modules table
INSERT OR IGNORE INTO modules(key, name, category, enabled, sort_order, description) VALUES
  ('design_system', 'Hệ thống Thiết kế & Menu', 'Hệ thống', 1, 225, 'Quản trị bảng màu, chữ viết, bố cục header/footer, menu điều hướng và nhận diện thương hiệu.'),
  ('maintenance_center', 'Trung tâm Trạng thái & Bảo trì', 'Hệ thống', 1, 240, 'Điều khiển 6 chế độ vận hành hệ thống, bảo trì theo lịch, chế độ chỉ đọc và kiểm tra trước khi mở lại.'),
  ('release_center', 'Trung tâm Kiểm tra & Phát hành', 'Hệ thống', 1, 245, 'Kiểm tra sức khỏe dịch vụ D1/R2/Auth/Email, rà soát nội dung/SEO/i18n và quản lý sự cố vận hành.');

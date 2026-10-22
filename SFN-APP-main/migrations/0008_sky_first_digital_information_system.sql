-- Migration 0008: Sky First Digital Information System (app.skyfirst.io.vn)
-- Additive, backward-compatible upgrade: preserves all existing D1 tables, records, credentials, and R2 keys.
PRAGMA foreign_keys = ON;

-- 1. Normalize Product Identity, Target Domain & System Emails in settings
INSERT INTO settings(key, value_json, updated_at) VALUES
  ('app_name', '"Hệ thống Thông tin Số Sky First"', CURRENT_TIMESTAMP),
  ('app_name_en', '"Sky First Digital Information System"', CURRENT_TIMESTAMP),
  ('app_short_name', '"Sky First"', CURRENT_TIMESTAMP),
  ('app_url', '"https://app.skyfirst.io.vn"', CURRENT_TIMESTAMP),
  ('system_email', '"app@skyfirst.io.vn"', CURRENT_TIMESTAMP),
  ('contact_email', '"lienhe@skyfirst.io.vn"', CURRENT_TIMESTAMP),
  ('support_email', '"support@skyfirst.io.vn"', CURRENT_TIMESTAMP),
  ('receiver_email', '"app@skyfirst.io.vn"', CURRENT_TIMESTAMP),
  ('footer_email', '"lienhe@skyfirst.io.vn"', CURRENT_TIMESTAMP),
  ('footer_support_email', '"support@skyfirst.io.vn"', CURRENT_TIMESTAMP),
  ('footer_portal_email', '"app@skyfirst.io.vn"', CURRENT_TIMESTAMP),
  ('hero_title', '"Hệ thống Thông tin Số Sky First"', CURRENT_TIMESTAMP),
  ('hero_text', '"Khám phá, tra cứu, đăng ký và quản lý các chương trình, hoạt động, tài liệu, biểu mẫu, chứng nhận và dịch vụ hỗ trợ cộng đồng của Sky First."', CURRENT_TIMESTAMP),
  ('home_hero_eyebrow', '"HỆ THỐNG THÔNG TIN SỐ SKY FIRST"', CURRENT_TIMESTAMP),
  ('home_hero_title', '"Hệ thống Thông tin Số SKY FIRST"', CURRENT_TIMESTAMP),
  ('home_hero_text', '"Khám phá, tra cứu, đăng ký và quản lý các chương trình, hoạt động, tài liệu, biểu mẫu, chứng nhận và dịch vụ hỗ trợ cộng đồng của Sky First."', CURRENT_TIMESTAMP),
  ('footer_description', '"Hệ thống thông tin và dịch vụ số phục vụ tra cứu, đăng ký chương trình, biểu mẫu, chứng nhận và minh bạch hoạt động."', CURRENT_TIMESTAMP),
  ('footer_copyright', '"© 2026 Hệ thống Thông tin Số Sky First (app.skyfirst.io.vn)"', CURRENT_TIMESTAMP),
  ('brand_slogan', '"Kết nối tri thức • Lan tỏa giá trị • Vì cộng đồng bền vững"', CURRENT_TIMESTAMP)
ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = CURRENT_TIMESTAMP;


-- 1b. Seed missing roles referenced by src/permissions.js and public/app.js (fixes JOIN roles bug)
INSERT OR IGNORE INTO roles(id,name,level,description) VALUES
  ('owner','Chủ sở hữu hệ thống',1000,'Chủ sở hữu tối cao toàn hệ thống.'),
  ('content_admin','Quản trị nội dung',75,'Quản trị CMS, trình dựng trang, biểu mẫu, tài liệu và nội dung.'),
  ('certificate_manager','Quản lý chứng nhận',70,'Đề nghị, quản lý và phát hành chứng nhận.'),
  ('reviewer','Người duyệt nghiệp vụ',65,'Kiểm tra, phê duyệt hồ sơ, chứng nhận và nội dung xuất bản.'),
  ('case_manager','Quản lý hồ sơ',65,'Quản lý, phân công và xử lý hồ sơ đăng ký.'),
  ('editor','Biên tập viên',55,'Biên tập tin tức, trang CMS và tài liệu trong phạm vi được giao.');

-- 2. Register new functional modules
INSERT OR IGNORE INTO modules(key,name,category,enabled,sort_order,description) VALUES
  ('sponsorship','Minh bạch Tài trợ','Nghiệp vụ',1,95,'Quản lý chiến dịch tài trợ, cam kết, thực nhận, giải ngân và báo cáo công khai.'),
  ('safety','An toàn & Bảo mật số','Hệ thống',1,205,'Hướng dẫn an toàn số, cảnh báo giả mạo và kênh tiếp nhận báo cáo sự cố.'),
  ('page_builder','Trình dựng trang & CMS','Truyền thông',1,125,'Quản trị trang trực quan bằng khối kéo thả và quy trình duyệt xuất bản.'),
  ('websites','Quản trị đa Website','Hệ thống',1,235,'Quản lý cấu hình, phạm vi dữ liệu và phân quyền theo từng website.'),
  ('email_center','Trung tâm Email tự động','Hệ thống',1,145,'Quản lý thư viện mẫu HTML email, lịch sử phiên bản, gửi thử và nhật ký.');

-- 3. Sponsorship & Financial Transparency Module (/tai-tro)
CREATE TABLE IF NOT EXISTS sponsorship_campaigns (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  website_id TEXT NOT NULL DEFAULT 'app',
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  purpose TEXT NOT NULL DEFAULT '',
  target_amount INTEGER NOT NULL DEFAULT 0,
  pledged_amount INTEGER NOT NULL DEFAULT 0,
  received_amount INTEGER NOT NULL DEFAULT 0,
  disbursed_amount INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'VND',
  start_at TEXT,
  end_at TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  visibility TEXT NOT NULL DEFAULT 'draft',
  approved_by INTEGER,
  approved_at TEXT,
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(approved_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_sponsorship_campaigns_vis ON sponsorship_campaigns(visibility, status);

CREATE TABLE IF NOT EXISTS sponsorship_transactions (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  tx_code TEXT NOT NULL UNIQUE,
  tx_type TEXT NOT NULL,
  amount INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'VND',
  public_party_label TEXT NOT NULL DEFAULT '',
  purpose TEXT NOT NULL DEFAULT '',
  voucher_file_id TEXT,
  occurred_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  verification_status TEXT NOT NULL DEFAULT 'pending',
  is_public INTEGER NOT NULL DEFAULT 0,
  verified_by INTEGER,
  verified_at TEXT,
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(campaign_id) REFERENCES sponsorship_campaigns(id) ON DELETE CASCADE,
  FOREIGN KEY(verified_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_sponsorship_tx_campaign ON sponsorship_transactions(campaign_id, verification_status, is_public);

CREATE TABLE IF NOT EXISTS sponsorship_reports (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  title TEXT NOT NULL,
  report_period TEXT NOT NULL DEFAULT '',
  file_id TEXT,
  summary TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft',
  approved_by INTEGER,
  published_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(campaign_id) REFERENCES sponsorship_campaigns(id) ON DELETE CASCADE,
  FOREIGN KEY(approved_by) REFERENCES users(id) ON DELETE SET NULL
);

-- 4. Digital Safety & Incident Reporting Module (/an-toan)
CREATE TABLE IF NOT EXISTS safety_reports (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'Trung bình',
  reporter_name TEXT NOT NULL DEFAULT '',
  reporter_email TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  affected_url TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Đã tiếp nhận',
  assigned_to INTEGER,
  resolution_note TEXT NOT NULL DEFAULT '',
  ip_hash TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(assigned_to) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_safety_reports_status ON safety_reports(status, created_at DESC);

-- 5. Multi-Website Governance Registry (Appendix VII)
CREATE TABLE IF NOT EXISTS websites (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  domain TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  logo_url TEXT NOT NULL DEFAULT '/assets/sfn-logo-tight.png',
  primary_color TEXT NOT NULL DEFAULT '#0759b8',
  navy_color TEXT NOT NULL DEFAULT '#071b35',
  status TEXT NOT NULL DEFAULT 'active',
  config_json TEXT NOT NULL DEFAULT '{}',
  updated_by INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT OR IGNORE INTO websites(id,code,name,domain,description,status,config_json) VALUES
  ('app','SF-APP','Hệ thống Thông tin Số Sky First','app.skyfirst.io.vn','Hệ thống thông tin và dịch vụ số trung tâm của Sky First.','active','{"is_primary":true}'),
  ('main','SF-MAIN','Trang Thông tin Điện tử Sky First','skyfirst.io.vn','Trang thông tin điện tử công khai của Sky First.','active','{"is_primary":false}'),
  ('tnv','SF-TNV','Trung tâm Tình nguyện viên Sky First','tnv.skyfirst.io.vn','Cổng thông tin và điều phối hoạt động tình nguyện viên.','active','{"is_primary":false}'),
  ('sfec','SF-SFEC','SFEC – Sky First Education Club','sfec.skyfirst.io.vn','Không gian chương trình và lớp học tiếng Anh SFEC.','active','{"is_primary":false}'),
  ('slc','SF-SLC','Sky First Learning Center','slc.skyfirst.io.vn','Trung tâm học tập và học liệu số Sky First.','active','{"is_primary":false}'),
  ('member','SF-MEMBER','Cổng Thành viên Sky First','member.skyfirst.io.vn','Không gian phối hợp nội bộ dành cho thành viên.','active','{"is_primary":false}');

-- 6. Visual CMS, Block Page Builder & Approval Lifecycle (Appendix VII)
CREATE TABLE IF NOT EXISTS cms_pages (
  id TEXT PRIMARY KEY,
  website_id TEXT NOT NULL DEFAULT 'app',
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  cover_file_id TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  tags_json TEXT NOT NULL DEFAULT '[]',
  seo_json TEXT NOT NULL DEFAULT '{}',
  blocks_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'draft',
  version INTEGER NOT NULL DEFAULT 1,
  author_id INTEGER,
  submitted_by INTEGER,
  submitted_at TEXT,
  reviewed_by INTEGER,
  reviewed_at TEXT,
  review_note TEXT NOT NULL DEFAULT '',
  published_by INTEGER,
  published_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(website_id, slug),
  FOREIGN KEY(website_id) REFERENCES websites(id) ON DELETE CASCADE,
  FOREIGN KEY(author_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_cms_pages_site_status ON cms_pages(website_id, status);

CREATE TABLE IF NOT EXISTS cms_page_revisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  page_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  title TEXT NOT NULL,
  blocks_json TEXT NOT NULL DEFAULT '[]',
  seo_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft',
  note TEXT NOT NULL DEFAULT '',
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(page_id) REFERENCES cms_pages(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS cms_shared_blocks (
  id TEXT PRIMARY KEY,
  website_id TEXT NOT NULL DEFAULT 'app',
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  block_type TEXT NOT NULL,
  config_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active',
  updated_by INTEGER,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cms_templates (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  description TEXT NOT NULL DEFAULT '',
  blocks_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT OR IGNORE INTO cms_templates(id,key,name,category,description,blocks_json) VALUES
  ('tpl_program','program-page','Mẫu Trang Chương trình','program','Bố cục chuẩn cho trang giới thiệu chương trình đào tạo hoặc cộng đồng.','[{"id":"b1","type":"hero","title":"Tên chương trình","subtitle":"Mô tả ngắn gọn mục tiêu sử dụng của chương trình","ctaText":"Đăng ký tham gia","ctaHref":"/bieu-mau"},{"id":"b2","type":"columns","columns":[{"title":"Đối tượng tham gia","body":"Thông tin đối tượng phù hợp."},{"title":"Lộ trình thực hiện","body":"Các giai đoạn triển khai thực tế."}]},{"id":"b3","type":"form_embed","formId":"class","title":"Biểu mẫu đăng ký trực tuyến"}]'),
  ('tpl_doc','document-page','Mẫu Trang Tài liệu & Hướng dẫn','document','Bố cục chuẩn cho trang công bố tài liệu PDF và hướng dẫn sử dụng.','[{"id":"b1","type":"heading","level":"h1","text":"Tài liệu hướng dẫn"},{"id":"b2","type":"paragraph","text":"Tóm tắt nội dung và phạm vi áp dụng của tài liệu."},{"id":"b3","type":"pdf_embed","documentId":"","title":"Xem trước tài liệu PDF"}]'),
  ('tpl_notice','announcement-page','Mẫu Trang Thông báo Chính thức','announcement','Bố cục chuẩn cho thông báo vận hành hoặc kết quả chương trình.','[{"id":"b1","type":"callout","tone":"info","title":"Thông báo chính thức","text":"Nội dung thông báo ngắn gọn, rõ ràng."},{"id":"b2","type":"paragraph","text":"Chi tiết hướng dẫn các bước thực hiện tiếp theo."}]');

-- 7. PDF & Digital Document Versioning (Appendix VII)
CREATE TABLE IF NOT EXISTS document_versions (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  version_number INTEGER NOT NULL DEFAULT 1,
  file_id TEXT NOT NULL,
  filename TEXT NOT NULL DEFAULT '',
  mime TEXT NOT NULL DEFAULT 'application/pdf',
  size INTEGER NOT NULL DEFAULT 0,
  sha256 TEXT,
  change_note TEXT NOT NULL DEFAULT '',
  is_current INTEGER NOT NULL DEFAULT 1,
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(document_id) REFERENCES documents(id) ON DELETE CASCADE,
  FOREIGN KEY(file_id) REFERENCES files(id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_doc_versions_doc ON document_versions(document_id, version_number DESC);

-- 8. Email Template Versioning & Standardized HTML Templates (Appendix III)
CREATE TABLE IF NOT EXISTS email_template_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  template_key TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  subject_template TEXT NOT NULL,
  html_template TEXT NOT NULL,
  text_template TEXT,
  updated_by INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO email_templates(key, subject_template, html_template, text_template, enabled, updated_at)
VALUES ('submission_confirmation', 'Hệ thống Thông tin Số Sky First | Xác nhận tiếp nhận hồ sơ {{code}}', '<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Xác nhận tiếp nhận hồ sơ — Hệ thống Thông tin Số Sky First</title>
</head>
<body style="margin:0;padding:0;background:#f4f7fb;font-family:Inter,Arial,Helvetica,sans-serif;color:#102238;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f4f7fb;padding:28px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:660px;background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #dce6f2;box-shadow:0 12px 32px rgba(7,27,53,.08);">
  <tr>
    <td style="padding:32px 36px;background:linear-gradient(125deg,#071b35 0%,#0759b8 65%,#0b78d1 100%);color:#ffffff;">
      <div style="font-size:11px;font-weight:800;letter-spacing:1.6px;text-transform:uppercase;color:#9dd9ff;">HỆ THỐNG THÔNG TIN SỐ SKY FIRST</div>
      <h1 style="margin:8px 0 6px;font-size:24px;line-height:1.25;color:#ffffff;">Xác nhận tiếp nhận hồ sơ</h1>
      <p style="margin:0;font-size:14px;line-height:1.6;color:#e2f0ff;">Hồ sơ của bạn đã được ghi nhận trên Hệ thống Thông tin Số Sky First.</p>
    </td>
  </tr>
  <tr>
    <td style="padding:30px 36px 16px;font-size:15px;line-height:1.7;color:#1e334c;">
      <p style="margin:0 0 14px;">Xin chào <strong>{{full_name}}</strong>,</p>
<p style="margin:0 0 18px;">Hệ thống Thông tin Số Sky First xác nhận đã tiếp nhận hồ sơ của bạn. Vui lòng lưu lại mã hồ sơ dưới đây để tra cứu trạng thái xử lý:</p>
<div style="padding:18px;border-radius:14px;background:#f4f8fd;border:1px solid #d5e4f5;text-align:center;margin-bottom:18px;">
  <div style="font-size:11px;font-weight:800;color:#546e8a;letter-spacing:1.2px;text-transform:uppercase;">MÃ HỒ SƠ TRA CỨU</div>
  <div style="margin-top:6px;font-size:24px;font-weight:800;color:#0759b8;">{{code}}</div>
</div>
{{PROFILE_IMAGE_BLOCK}}
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border:1px solid #e1e9f2;border-radius:14px;padding:12px 16px;margin-top:14px;">
  <tr><td style="padding:6px 0;color:#5c728a;font-size:13px;">Người gửi</td><td align="right" style="padding:6px 0;font-size:13px;font-weight:700;">{{full_name}}</td></tr>
  <tr><td style="padding:6px 0;color:#5c728a;font-size:13px;">Email đăng ký</td><td align="right" style="padding:6px 0;font-size:13px;font-weight:700;">{{email}}</td></tr>
  <tr><td style="padding:6px 0;color:#5c728a;font-size:13px;">Biểu mẫu / Nội dung</td><td align="right" style="padding:6px 0;font-size:13px;font-weight:700;">{{form_name}}</td></tr>
  <tr><td style="padding:6px 0;color:#5c728a;font-size:13px;">Thời điểm tiếp nhận</td><td align="right" style="padding:6px 0;font-size:13px;font-weight:700;">{{submitted_at}}</td></tr>
  <tr><td style="padding:6px 0;color:#5c728a;font-size:13px;">Trạng thái</td><td align="right" style="padding:6px 0;font-size:13px;font-weight:700;color:#0759b8;">{{status}}</td></tr>
</table>
      <div style="text-align:center;padding:24px 0 12px;">
        <a href="https://app.skyfirst.io.vn/ho-so" style="display:inline-block;padding:13px 26px;border-radius:12px;background:#0759b8;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;">TRA CỨU HỒ SƠ</a>
      </div>
    </td>
  </tr>
  <tr>
    <td style="padding:16px 36px 24px;">
      <div style="padding:14px 16px;border-radius:12px;background:#f0f6ff;border-left:4px solid #0759b8;font-size:12px;line-height:1.6;color:#47607a;">
        <strong>Thông tin hỗ trợ:</strong> Đây là email tự động từ <b>Hệ thống Thông tin Số Sky First</b> (<code>app@skyfirst.io.vn</code>). Nếu cần hỗ trợ kỹ thuật, vui lòng liên hệ <a href="mailto:support@skyfirst.io.vn" style="color:#0759b8;">support@skyfirst.io.vn</a> hoặc liên hệ chung tại <a href="mailto:lienhe@skyfirst.io.vn" style="color:#0759b8;">lienhe@skyfirst.io.vn</a>.
      </div>
    </td>
  </tr>
  <tr>
    <td style="padding:20px 32px;text-align:center;background:#071b35;color:#a9c3de;font-size:12px;line-height:1.6;">
      <div style="font-weight:700;color:#ffffff;">Hệ thống Thông tin Số Sky First · Sky First Digital Information System</div>
      <div style="margin-top:4px;"><a href="https://app.skyfirst.io.vn" style="color:#7cc7ff;text-decoration:none;">app.skyfirst.io.vn</a></div>
    </td>
  </tr>
</table>
</td></tr>
</table>
</body>
</html>', 'Xin chào {{full_name}},
Hệ thống Thông tin Số Sky First đã tiếp nhận hồ sơ {{code}} ({{form_name}}) lúc {{submitted_at}}.
Trạng thái hiện tại: {{status}}.
Tra cứu hồ sơ tại: https://app.skyfirst.io.vn/ho-so
Hỗ trợ kỹ thuật: support@skyfirst.io.vn', 1, CURRENT_TIMESTAMP)
ON CONFLICT(key) DO UPDATE SET
  subject_template = excluded.subject_template,
  html_template = excluded.html_template,
  text_template = excluded.text_template,
  updated_at = CURRENT_TIMESTAMP;


INSERT INTO email_templates(key, subject_template, html_template, text_template, enabled, updated_at)
VALUES ('registration_confirmation', 'Hệ thống Thông tin Số Sky First | Xác nhận đăng ký chương trình / sự kiện {{code}}', '<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Xác nhận đăng ký tham gia — Hệ thống Thông tin Số Sky First</title>
</head>
<body style="margin:0;padding:0;background:#f4f7fb;font-family:Inter,Arial,Helvetica,sans-serif;color:#102238;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f4f7fb;padding:28px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:660px;background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #dce6f2;box-shadow:0 12px 32px rgba(7,27,53,.08);">
  <tr>
    <td style="padding:32px 36px;background:linear-gradient(125deg,#071b35 0%,#0759b8 65%,#0b78d1 100%);color:#ffffff;">
      <div style="font-size:11px;font-weight:800;letter-spacing:1.6px;text-transform:uppercase;color:#9dd9ff;">HỆ THỐNG THÔNG TIN SỐ SKY FIRST</div>
      <h1 style="margin:8px 0 6px;font-size:24px;line-height:1.25;color:#ffffff;">Xác nhận đăng ký tham gia</h1>
      <p style="margin:0;font-size:14px;line-height:1.6;color:#e2f0ff;">Thông tin đăng ký chương trình / sự kiện của bạn đã được hệ thống ghi nhận.</p>
    </td>
  </tr>
  <tr>
    <td style="padding:30px 36px 16px;font-size:15px;line-height:1.7;color:#1e334c;">
      <p style="margin:0 0 14px;">Xin chào <strong>{{full_name}}</strong>,</p>
<p style="margin:0 0 16px;">Cảm ơn bạn đã đăng ký tham gia <strong>{{program_name}}</strong> trên Hệ thống Thông tin Số Sky First.</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border:1px solid #e1e9f2;border-radius:14px;padding:12px 16px;">
  <tr><td style="padding:6px 0;color:#5c728a;font-size:13px;">Mã đăng ký</td><td align="right" style="padding:6px 0;font-size:13px;font-weight:700;color:#0759b8;">{{code}}</td></tr>
  <tr><td style="padding:6px 0;color:#5c728a;font-size:13px;">Chương trình / Sự kiện</td><td align="right" style="padding:6px 0;font-size:13px;font-weight:700;">{{program_name}}</td></tr>
  <tr><td style="padding:6px 0;color:#5c728a;font-size:13px;">Thời gian ghi nhận</td><td align="right" style="padding:6px 0;font-size:13px;font-weight:700;">{{submitted_at}}</td></tr>
  <tr><td style="padding:6px 0;color:#5c728a;font-size:13px;">Trạng thái</td><td align="right" style="padding:6px 0;font-size:13px;font-weight:700;">{{status}}</td></tr>
</table>
      <div style="text-align:center;padding:24px 0 12px;">
        <a href="https://app.skyfirst.io.vn/ho-so" style="display:inline-block;padding:13px 26px;border-radius:12px;background:#0759b8;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;">THEO DÕI TRẠNG THÁI</a>
      </div>
    </td>
  </tr>
  <tr>
    <td style="padding:16px 36px 24px;">
      <div style="padding:14px 16px;border-radius:12px;background:#f0f6ff;border-left:4px solid #0759b8;font-size:12px;line-height:1.6;color:#47607a;">
        <strong>Thông tin hỗ trợ:</strong> Đây là email tự động từ <b>Hệ thống Thông tin Số Sky First</b> (<code>app@skyfirst.io.vn</code>). Nếu cần hỗ trợ kỹ thuật, vui lòng liên hệ <a href="mailto:support@skyfirst.io.vn" style="color:#0759b8;">support@skyfirst.io.vn</a> hoặc liên hệ chung tại <a href="mailto:lienhe@skyfirst.io.vn" style="color:#0759b8;">lienhe@skyfirst.io.vn</a>.
      </div>
    </td>
  </tr>
  <tr>
    <td style="padding:20px 32px;text-align:center;background:#071b35;color:#a9c3de;font-size:12px;line-height:1.6;">
      <div style="font-weight:700;color:#ffffff;">Hệ thống Thông tin Số Sky First · Sky First Digital Information System</div>
      <div style="margin-top:4px;"><a href="https://app.skyfirst.io.vn" style="color:#7cc7ff;text-decoration:none;">app.skyfirst.io.vn</a></div>
    </td>
  </tr>
</table>
</td></tr>
</table>
</body>
</html>', 'Xin chào {{full_name}},
Xác nhận đăng ký {{program_name}} (Mã: {{code}}).
Trạng thái: {{status}}.
Theo dõi tại: https://app.skyfirst.io.vn/ho-so', 1, CURRENT_TIMESTAMP)
ON CONFLICT(key) DO UPDATE SET
  subject_template = excluded.subject_template,
  html_template = excluded.html_template,
  text_template = excluded.text_template,
  updated_at = CURRENT_TIMESTAMP;


INSERT INTO email_templates(key, subject_template, html_template, text_template, enabled, updated_at)
VALUES ('certificate_issued', 'Hệ thống Thông tin Số Sky First | Thông báo phát hành chứng nhận {{certificate_code}}', '<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Chứng nhận đã được phát hành — Hệ thống Thông tin Số Sky First</title>
</head>
<body style="margin:0;padding:0;background:#f4f7fb;font-family:Inter,Arial,Helvetica,sans-serif;color:#102238;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f4f7fb;padding:28px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:660px;background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #dce6f2;box-shadow:0 12px 32px rgba(7,27,53,.08);">
  <tr>
    <td style="padding:32px 36px;background:linear-gradient(125deg,#071b35 0%,#0759b8 65%,#0b78d1 100%);color:#ffffff;">
      <div style="font-size:11px;font-weight:800;letter-spacing:1.6px;text-transform:uppercase;color:#9dd9ff;">HỆ THỐNG THÔNG TIN SỐ SKY FIRST</div>
      <h1 style="margin:8px 0 6px;font-size:24px;line-height:1.25;color:#ffffff;">Chứng nhận đã được phát hành</h1>
      <p style="margin:0;font-size:14px;line-height:1.6;color:#e2f0ff;">Bản ghi chứng nhận của bạn đã được phê duyệt và phát hành chính thức.</p>
    </td>
  </tr>
  <tr>
    <td style="padding:30px 36px 16px;font-size:15px;line-height:1.7;color:#1e334c;">
      <p style="margin:0 0 14px;">Xin chào <strong>{{recipient_name}}</strong>,</p>
<p style="margin:0 0 16px;">Hệ thống Thông tin Số Sky First thông báo <strong>{{cert_type}}</strong> của bạn đã được phát hành và có thể tra cứu trực tuyến bằng mã chứng nhận:</p>
<div style="padding:18px;border-radius:14px;background:#f4f8fd;border:1px solid #d5e4f5;text-align:center;margin-bottom:18px;">
  <div style="font-size:11px;font-weight:800;color:#546e8a;letter-spacing:1.2px;text-transform:uppercase;">MÃ TRA CỨU CHỨNG NHẬN</div>
  <div style="margin-top:6px;font-size:24px;font-weight:800;color:#0759b8;">{{certificate_code}}</div>
</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border:1px solid #e1e9f2;border-radius:14px;padding:12px 16px;">
  <tr><td style="padding:6px 0;color:#5c728a;font-size:13px;">Người được ghi nhận</td><td align="right" style="padding:6px 0;font-size:13px;font-weight:700;">{{recipient_name}}</td></tr>
  <tr><td style="padding:6px 0;color:#5c728a;font-size:13px;">Loại chứng nhận</td><td align="right" style="padding:6px 0;font-size:13px;font-weight:700;">{{cert_type}}</td></tr>
  <tr><td style="padding:6px 0;color:#5c728a;font-size:13px;">Nội dung</td><td align="right" style="padding:6px 0;font-size:13px;font-weight:700;">{{content}}</td></tr>
</table>
      <div style="text-align:center;padding:24px 0 12px;">
        <a href="{{certificate_url}}" style="display:inline-block;padding:13px 26px;border-radius:12px;background:#0759b8;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;">XÁC THỰC CHỨNG NHẬN</a>
      </div>
    </td>
  </tr>
  <tr>
    <td style="padding:16px 36px 24px;">
      <div style="padding:14px 16px;border-radius:12px;background:#f0f6ff;border-left:4px solid #0759b8;font-size:12px;line-height:1.6;color:#47607a;">
        <strong>Thông tin hỗ trợ:</strong> Đây là email tự động từ <b>Hệ thống Thông tin Số Sky First</b> (<code>app@skyfirst.io.vn</code>). Nếu cần hỗ trợ kỹ thuật, vui lòng liên hệ <a href="mailto:support@skyfirst.io.vn" style="color:#0759b8;">support@skyfirst.io.vn</a> hoặc liên hệ chung tại <a href="mailto:lienhe@skyfirst.io.vn" style="color:#0759b8;">lienhe@skyfirst.io.vn</a>.
      </div>
    </td>
  </tr>
  <tr>
    <td style="padding:20px 32px;text-align:center;background:#071b35;color:#a9c3de;font-size:12px;line-height:1.6;">
      <div style="font-weight:700;color:#ffffff;">Hệ thống Thông tin Số Sky First · Sky First Digital Information System</div>
      <div style="margin-top:4px;"><a href="https://app.skyfirst.io.vn" style="color:#7cc7ff;text-decoration:none;">app.skyfirst.io.vn</a></div>
    </td>
  </tr>
</table>
</td></tr>
</table>
</body>
</html>', 'Xin chào {{recipient_name}},
Chứng nhận {{certificate_code}} ({{cert_type}}) đã được phát hành.
Tra cứu và xác thực tại: {{certificate_url}}', 1, CURRENT_TIMESTAMP)
ON CONFLICT(key) DO UPDATE SET
  subject_template = excluded.subject_template,
  html_template = excluded.html_template,
  text_template = excluded.text_template,
  updated_at = CURRENT_TIMESTAMP;


INSERT INTO email_templates(key, subject_template, html_template, text_template, enabled, updated_at)
VALUES ('status_update', 'Hệ thống Thông tin Số Sky First | Cập nhật trạng thái hồ sơ {{code}}', '<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Cập nhật trạng thái hồ sơ — Hệ thống Thông tin Số Sky First</title>
</head>
<body style="margin:0;padding:0;background:#f4f7fb;font-family:Inter,Arial,Helvetica,sans-serif;color:#102238;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f4f7fb;padding:28px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:660px;background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #dce6f2;box-shadow:0 12px 32px rgba(7,27,53,.08);">
  <tr>
    <td style="padding:32px 36px;background:linear-gradient(125deg,#071b35 0%,#0759b8 65%,#0b78d1 100%);color:#ffffff;">
      <div style="font-size:11px;font-weight:800;letter-spacing:1.6px;text-transform:uppercase;color:#9dd9ff;">HỆ THỐNG THÔNG TIN SỐ SKY FIRST</div>
      <h1 style="margin:8px 0 6px;font-size:24px;line-height:1.25;color:#ffffff;">Cập nhật trạng thái hồ sơ</h1>
      <p style="margin:0;font-size:14px;line-height:1.6;color:#e2f0ff;">Hồ sơ của bạn vừa được cập nhật trạng thái xử lý mới.</p>
    </td>
  </tr>
  <tr>
    <td style="padding:30px 36px 16px;font-size:15px;line-height:1.7;color:#1e334c;">
      <p style="margin:0 0 14px;">Xin chào <strong>{{full_name}}</strong>,</p>
<p style="margin:0 0 16px;">Hồ sơ mã <strong>{{code}}</strong> của bạn đã được chuyển sang trạng thái: <strong style="color:#0759b8;">{{status}}</strong>.</p>
{{note_block}}
<p style="margin:14px 0 0;font-size:14px;color:#47607a;">Bạn có thể dùng mã hồ sơ và địa chỉ email đã đăng ký để xem chi tiết tiến trình xử lý trên hệ thống.</p>
      <div style="text-align:center;padding:24px 0 12px;">
        <a href="https://app.skyfirst.io.vn/ho-so" style="display:inline-block;padding:13px 26px;border-radius:12px;background:#0759b8;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;">XEM TIẾN TRÌNH HỒ SƠ</a>
      </div>
    </td>
  </tr>
  <tr>
    <td style="padding:16px 36px 24px;">
      <div style="padding:14px 16px;border-radius:12px;background:#f0f6ff;border-left:4px solid #0759b8;font-size:12px;line-height:1.6;color:#47607a;">
        <strong>Thông tin hỗ trợ:</strong> Đây là email tự động từ <b>Hệ thống Thông tin Số Sky First</b> (<code>app@skyfirst.io.vn</code>). Nếu cần hỗ trợ kỹ thuật, vui lòng liên hệ <a href="mailto:support@skyfirst.io.vn" style="color:#0759b8;">support@skyfirst.io.vn</a> hoặc liên hệ chung tại <a href="mailto:lienhe@skyfirst.io.vn" style="color:#0759b8;">lienhe@skyfirst.io.vn</a>.
      </div>
    </td>
  </tr>
  <tr>
    <td style="padding:20px 32px;text-align:center;background:#071b35;color:#a9c3de;font-size:12px;line-height:1.6;">
      <div style="font-weight:700;color:#ffffff;">Hệ thống Thông tin Số Sky First · Sky First Digital Information System</div>
      <div style="margin-top:4px;"><a href="https://app.skyfirst.io.vn" style="color:#7cc7ff;text-decoration:none;">app.skyfirst.io.vn</a></div>
    </td>
  </tr>
</table>
</td></tr>
</table>
</body>
</html>', 'Xin chào {{full_name}},
Hồ sơ {{code}} đã được cập nhật trạng thái: {{status}}.
Tra cứu tại: https://app.skyfirst.io.vn/ho-so', 1, CURRENT_TIMESTAMP)
ON CONFLICT(key) DO UPDATE SET
  subject_template = excluded.subject_template,
  html_template = excluded.html_template,
  text_template = excluded.text_template,
  updated_at = CURRENT_TIMESTAMP;


INSERT INTO email_templates(key, subject_template, html_template, text_template, enabled, updated_at)
VALUES ('information_required', 'Hệ thống Thông tin Số Sky First | Yêu cầu bổ sung thông tin hồ sơ {{code}}', '<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Yêu cầu bổ sung thông tin hồ sơ — Hệ thống Thông tin Số Sky First</title>
</head>
<body style="margin:0;padding:0;background:#f4f7fb;font-family:Inter,Arial,Helvetica,sans-serif;color:#102238;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f4f7fb;padding:28px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:660px;background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #dce6f2;box-shadow:0 12px 32px rgba(7,27,53,.08);">
  <tr>
    <td style="padding:32px 36px;background:linear-gradient(125deg,#071b35 0%,#0759b8 65%,#0b78d1 100%);color:#ffffff;">
      <div style="font-size:11px;font-weight:800;letter-spacing:1.6px;text-transform:uppercase;color:#9dd9ff;">HỆ THỐNG THÔNG TIN SỐ SKY FIRST</div>
      <h1 style="margin:8px 0 6px;font-size:24px;line-height:1.25;color:#ffffff;">Yêu cầu bổ sung thông tin hồ sơ</h1>
      <p style="margin:0;font-size:14px;line-height:1.6;color:#e2f0ff;">Hồ sơ của bạn cần được bổ sung hoặc làm rõ thêm thông tin để tiếp tục xử lý.</p>
    </td>
  </tr>
  <tr>
    <td style="padding:30px 36px 16px;font-size:15px;line-height:1.7;color:#1e334c;">
      <p style="margin:0 0 14px;">Xin chào <strong>{{full_name}}</strong>,</p>
<p style="margin:0 0 16px;">Bộ phận xử lý đã rà soát hồ sơ <strong>{{code}}</strong> và đề nghị bạn bổ sung thông tin sau:</p>
<div style="padding:16px;border-radius:12px;background:#fff8eb;border:1px solid #f0d8a8;color:#6e4700;margin-bottom:16px;">
  {{requirement_note}}
</div>
<p style="margin:0;font-size:14px;color:#47607a;">Lưu ý an toàn: Hệ thống không bao giờ yêu cầu bạn cung cấp mật khẩu hoặc mã xác thực cá nhân qua email.</p>
      <div style="text-align:center;padding:24px 0 12px;">
        <a href="https://app.skyfirst.io.vn/ho-so" style="display:inline-block;padding:13px 26px;border-radius:12px;background:#0759b8;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;">KIỂM TRA & BỔ SUNG HỒ SƠ</a>
      </div>
    </td>
  </tr>
  <tr>
    <td style="padding:16px 36px 24px;">
      <div style="padding:14px 16px;border-radius:12px;background:#f0f6ff;border-left:4px solid #0759b8;font-size:12px;line-height:1.6;color:#47607a;">
        <strong>Thông tin hỗ trợ:</strong> Đây là email tự động từ <b>Hệ thống Thông tin Số Sky First</b> (<code>app@skyfirst.io.vn</code>). Nếu cần hỗ trợ kỹ thuật, vui lòng liên hệ <a href="mailto:support@skyfirst.io.vn" style="color:#0759b8;">support@skyfirst.io.vn</a> hoặc liên hệ chung tại <a href="mailto:lienhe@skyfirst.io.vn" style="color:#0759b8;">lienhe@skyfirst.io.vn</a>.
      </div>
    </td>
  </tr>
  <tr>
    <td style="padding:20px 32px;text-align:center;background:#071b35;color:#a9c3de;font-size:12px;line-height:1.6;">
      <div style="font-weight:700;color:#ffffff;">Hệ thống Thông tin Số Sky First · Sky First Digital Information System</div>
      <div style="margin-top:4px;"><a href="https://app.skyfirst.io.vn" style="color:#7cc7ff;text-decoration:none;">app.skyfirst.io.vn</a></div>
    </td>
  </tr>
</table>
</td></tr>
</table>
</body>
</html>', 'Xin chào {{full_name}},
Hồ sơ {{code}} cần bổ sung thông tin: {{requirement_note}}.
Kiểm tra tại: https://app.skyfirst.io.vn/ho-so', 1, CURRENT_TIMESTAMP)
ON CONFLICT(key) DO UPDATE SET
  subject_template = excluded.subject_template,
  html_template = excluded.html_template,
  text_template = excluded.text_template,
  updated_at = CURRENT_TIMESTAMP;


INSERT INTO email_templates(key, subject_template, html_template, text_template, enabled, updated_at)
VALUES ('application_result', 'Hệ thống Thông tin Số Sky First | Thông báo kết quả xử lý hồ sơ {{code}}', '<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Kết quả xử lý hồ sơ — Hệ thống Thông tin Số Sky First</title>
</head>
<body style="margin:0;padding:0;background:#f4f7fb;font-family:Inter,Arial,Helvetica,sans-serif;color:#102238;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f4f7fb;padding:28px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:660px;background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #dce6f2;box-shadow:0 12px 32px rgba(7,27,53,.08);">
  <tr>
    <td style="padding:32px 36px;background:linear-gradient(125deg,#071b35 0%,#0759b8 65%,#0b78d1 100%);color:#ffffff;">
      <div style="font-size:11px;font-weight:800;letter-spacing:1.6px;text-transform:uppercase;color:#9dd9ff;">HỆ THỐNG THÔNG TIN SỐ SKY FIRST</div>
      <h1 style="margin:8px 0 6px;font-size:24px;line-height:1.25;color:#ffffff;">Kết quả xử lý hồ sơ</h1>
      <p style="margin:0;font-size:14px;line-height:1.6;color:#e2f0ff;">Quy trình xử lý hồ sơ của bạn đã có kết quả chính thức.</p>
    </td>
  </tr>
  <tr>
    <td style="padding:30px 36px 16px;font-size:15px;line-height:1.7;color:#1e334c;">
      <p style="margin:0 0 14px;">Xin chào <strong>{{full_name}}</strong>,</p>
<p style="margin:0 0 16px;">Hệ thống Thông tin Số Sky First thông báo kết quả xử lý đối với hồ sơ <strong>{{code}}</strong>:</p>
<div style="padding:16px;border-radius:12px;background:#eef8f3;border:1px solid #c5e7d5;color:#145937;margin-bottom:16px;">
  <strong>Trạng thái kết quả:</strong> {{status}}<br>
  <span style="display:block;margin-top:6px;">{{result_summary}}</span>
</div>
      <div style="text-align:center;padding:24px 0 12px;">
        <a href="https://app.skyfirst.io.vn/ho-so" style="display:inline-block;padding:13px 26px;border-radius:12px;background:#0759b8;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;">TRA CỨU KẾT QUẢ</a>
      </div>
    </td>
  </tr>
  <tr>
    <td style="padding:16px 36px 24px;">
      <div style="padding:14px 16px;border-radius:12px;background:#f0f6ff;border-left:4px solid #0759b8;font-size:12px;line-height:1.6;color:#47607a;">
        <strong>Thông tin hỗ trợ:</strong> Đây là email tự động từ <b>Hệ thống Thông tin Số Sky First</b> (<code>app@skyfirst.io.vn</code>). Nếu cần hỗ trợ kỹ thuật, vui lòng liên hệ <a href="mailto:support@skyfirst.io.vn" style="color:#0759b8;">support@skyfirst.io.vn</a> hoặc liên hệ chung tại <a href="mailto:lienhe@skyfirst.io.vn" style="color:#0759b8;">lienhe@skyfirst.io.vn</a>.
      </div>
    </td>
  </tr>
  <tr>
    <td style="padding:20px 32px;text-align:center;background:#071b35;color:#a9c3de;font-size:12px;line-height:1.6;">
      <div style="font-weight:700;color:#ffffff;">Hệ thống Thông tin Số Sky First · Sky First Digital Information System</div>
      <div style="margin-top:4px;"><a href="https://app.skyfirst.io.vn" style="color:#7cc7ff;text-decoration:none;">app.skyfirst.io.vn</a></div>
    </td>
  </tr>
</table>
</td></tr>
</table>
</body>
</html>', 'Xin chào {{full_name}},
Kết quả xử lý hồ sơ {{code}}: {{status}}.
Chi tiết: {{result_summary}}
Tra cứu tại: https://app.skyfirst.io.vn/ho-so', 1, CURRENT_TIMESTAMP)
ON CONFLICT(key) DO UPDATE SET
  subject_template = excluded.subject_template,
  html_template = excluded.html_template,
  text_template = excluded.text_template,
  updated_at = CURRENT_TIMESTAMP;


INSERT INTO email_templates(key, subject_template, html_template, text_template, enabled, updated_at)
VALUES ('account_invite', 'Hệ thống Thông tin Số Sky First | Kích hoạt tài khoản quản trị', '<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Thông báo tài khoản quản trị — Hệ thống Thông tin Số Sky First</title>
</head>
<body style="margin:0;padding:0;background:#f4f7fb;font-family:Inter,Arial,Helvetica,sans-serif;color:#102238;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f4f7fb;padding:28px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:660px;background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #dce6f2;box-shadow:0 12px 32px rgba(7,27,53,.08);">
  <tr>
    <td style="padding:32px 36px;background:linear-gradient(125deg,#071b35 0%,#0759b8 65%,#0b78d1 100%);color:#ffffff;">
      <div style="font-size:11px;font-weight:800;letter-spacing:1.6px;text-transform:uppercase;color:#9dd9ff;">HỆ THỐNG THÔNG TIN SỐ SKY FIRST</div>
      <h1 style="margin:8px 0 6px;font-size:24px;line-height:1.25;color:#ffffff;">Thông báo tài khoản quản trị</h1>
      <p style="margin:0;font-size:14px;line-height:1.6;color:#e2f0ff;">Tài khoản quản trị của bạn trên Hệ thống Thông tin Số Sky First đã được khởi tạo.</p>
    </td>
  </tr>
  <tr>
    <td style="padding:30px 36px 16px;font-size:15px;line-height:1.7;color:#1e334c;">
      <p style="margin:0 0 14px;">Xin chào <strong>{{full_name}}</strong>,</p>
<p style="margin:0 0 16px;">Một tài khoản quản trị trên <strong>Hệ thống Thông tin Số Sky First</strong> đã được cấp cho địa chỉ <strong>{{email}}</strong>.</p>
<p style="margin:0 0 16px;">Vui lòng nhấn vào nút bên dưới để kích hoạt tài khoản và thiết lập mật khẩu mới. Liên kết chỉ có hiệu lực một lần và có thời hạn bảo mật.</p>
      <div style="text-align:center;padding:24px 0 12px;">
        <a href="{{activation_link}}" style="display:inline-block;padding:13px 26px;border-radius:12px;background:#0759b8;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;">KÍCH HOẠT TÀI KHOẢN</a>
      </div>
    </td>
  </tr>
  <tr>
    <td style="padding:16px 36px 24px;">
      <div style="padding:14px 16px;border-radius:12px;background:#f0f6ff;border-left:4px solid #0759b8;font-size:12px;line-height:1.6;color:#47607a;">
        <strong>Thông tin hỗ trợ:</strong> Đây là email tự động từ <b>Hệ thống Thông tin Số Sky First</b> (<code>app@skyfirst.io.vn</code>). Nếu cần hỗ trợ kỹ thuật, vui lòng liên hệ <a href="mailto:support@skyfirst.io.vn" style="color:#0759b8;">support@skyfirst.io.vn</a> hoặc liên hệ chung tại <a href="mailto:lienhe@skyfirst.io.vn" style="color:#0759b8;">lienhe@skyfirst.io.vn</a>.
      </div>
    </td>
  </tr>
  <tr>
    <td style="padding:20px 32px;text-align:center;background:#071b35;color:#a9c3de;font-size:12px;line-height:1.6;">
      <div style="font-weight:700;color:#ffffff;">Hệ thống Thông tin Số Sky First · Sky First Digital Information System</div>
      <div style="margin-top:4px;"><a href="https://app.skyfirst.io.vn" style="color:#7cc7ff;text-decoration:none;">app.skyfirst.io.vn</a></div>
    </td>
  </tr>
</table>
</td></tr>
</table>
</body>
</html>', 'Xin chào {{full_name}},
Kích hoạt tài khoản quản trị Hệ thống Thông tin Số Sky First ({{email}}) tại: {{activation_link}}', 1, CURRENT_TIMESTAMP)
ON CONFLICT(key) DO UPDATE SET
  subject_template = excluded.subject_template,
  html_template = excluded.html_template,
  text_template = excluded.text_template,
  updated_at = CURRENT_TIMESTAMP;


INSERT INTO email_templates(key, subject_template, html_template, text_template, enabled, updated_at)
VALUES ('support_ticket_received', 'Hệ thống Thông tin Số Sky First | Xác nhận yêu cầu hỗ trợ {{ticket_code}}', '<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Đã tiếp nhận yêu cầu hỗ trợ — Hệ thống Thông tin Số Sky First</title>
</head>
<body style="margin:0;padding:0;background:#f4f7fb;font-family:Inter,Arial,Helvetica,sans-serif;color:#102238;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f4f7fb;padding:28px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:660px;background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #dce6f2;box-shadow:0 12px 32px rgba(7,27,53,.08);">
  <tr>
    <td style="padding:32px 36px;background:linear-gradient(125deg,#071b35 0%,#0759b8 65%,#0b78d1 100%);color:#ffffff;">
      <div style="font-size:11px;font-weight:800;letter-spacing:1.6px;text-transform:uppercase;color:#9dd9ff;">HỆ THỐNG THÔNG TIN SỐ SKY FIRST</div>
      <h1 style="margin:8px 0 6px;font-size:24px;line-height:1.25;color:#ffffff;">Đã tiếp nhận yêu cầu hỗ trợ</h1>
      <p style="margin:0;font-size:14px;line-height:1.6;color:#e2f0ff;">Yêu cầu hỗ trợ hoặc báo cáo của bạn đã được hệ thống ghi nhận.</p>
    </td>
  </tr>
  <tr>
    <td style="padding:30px 36px 16px;font-size:15px;line-height:1.7;color:#1e334c;">
      <p style="margin:0 0 14px;">Xin chào <strong>{{full_name}}</strong>,</p>
<p style="margin:0 0 16px;">Hệ thống Thông tin Số Sky First đã ghi nhận yêu cầu hỗ trợ của bạn với mã tham chiếu <strong>{{ticket_code}}</strong>.</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border:1px solid #e1e9f2;border-radius:14px;padding:12px 16px;">
  <tr><td style="padding:6px 0;color:#5c728a;font-size:13px;">Mã yêu cầu</td><td align="right" style="padding:6px 0;font-size:13px;font-weight:700;color:#0759b8;">{{ticket_code}}</td></tr>
  <tr><td style="padding:6px 0;color:#5c728a;font-size:13px;">Chủ đề</td><td align="right" style="padding:6px 0;font-size:13px;font-weight:700;">{{subject}}</td></tr>
  <tr><td style="padding:6px 0;color:#5c728a;font-size:13px;">Trạng thái</td><td align="right" style="padding:6px 0;font-size:13px;font-weight:700;">{{status}}</td></tr>
</table>
      <div style="text-align:center;padding:24px 0 12px;">
        <a href="https://app.skyfirst.io.vn/an-toan" style="display:inline-block;padding:13px 26px;border-radius:12px;background:#0759b8;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;">TRUNG TÂM AN TOÀN & HỖ TRỢ</a>
      </div>
    </td>
  </tr>
  <tr>
    <td style="padding:16px 36px 24px;">
      <div style="padding:14px 16px;border-radius:12px;background:#f0f6ff;border-left:4px solid #0759b8;font-size:12px;line-height:1.6;color:#47607a;">
        <strong>Thông tin hỗ trợ:</strong> Đây là email tự động từ <b>Hệ thống Thông tin Số Sky First</b> (<code>app@skyfirst.io.vn</code>). Nếu cần hỗ trợ kỹ thuật, vui lòng liên hệ <a href="mailto:support@skyfirst.io.vn" style="color:#0759b8;">support@skyfirst.io.vn</a> hoặc liên hệ chung tại <a href="mailto:lienhe@skyfirst.io.vn" style="color:#0759b8;">lienhe@skyfirst.io.vn</a>.
      </div>
    </td>
  </tr>
  <tr>
    <td style="padding:20px 32px;text-align:center;background:#071b35;color:#a9c3de;font-size:12px;line-height:1.6;">
      <div style="font-weight:700;color:#ffffff;">Hệ thống Thông tin Số Sky First · Sky First Digital Information System</div>
      <div style="margin-top:4px;"><a href="https://app.skyfirst.io.vn" style="color:#7cc7ff;text-decoration:none;">app.skyfirst.io.vn</a></div>
    </td>
  </tr>
</table>
</td></tr>
</table>
</body>
</html>', 'Xin chào {{full_name}},
Đã tiếp nhận yêu cầu hỗ trợ {{ticket_code}} ({{subject}}).
Liên hệ hỗ trợ kỹ thuật: support@skyfirst.io.vn', 1, CURRENT_TIMESTAMP)
ON CONFLICT(key) DO UPDATE SET
  subject_template = excluded.subject_template,
  html_template = excluded.html_template,
  text_template = excluded.text_template,
  updated_at = CURRENT_TIMESTAMP;


INSERT INTO email_templates(key, subject_template, html_template, text_template, enabled, updated_at)
VALUES ('fundraising_update', 'Hệ thống Thông tin Số Sky First | Cập nhật minh bạch tài trợ {{campaign_code}}', '<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Thông báo cập nhật chương trình tài trợ — Hệ thống Thông tin Số Sky First</title>
</head>
<body style="margin:0;padding:0;background:#f4f7fb;font-family:Inter,Arial,Helvetica,sans-serif;color:#102238;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f4f7fb;padding:28px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:660px;background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #dce6f2;box-shadow:0 12px 32px rgba(7,27,53,.08);">
  <tr>
    <td style="padding:32px 36px;background:linear-gradient(125deg,#071b35 0%,#0759b8 65%,#0b78d1 100%);color:#ffffff;">
      <div style="font-size:11px;font-weight:800;letter-spacing:1.6px;text-transform:uppercase;color:#9dd9ff;">HỆ THỐNG THÔNG TIN SỐ SKY FIRST</div>
      <h1 style="margin:8px 0 6px;font-size:24px;line-height:1.25;color:#ffffff;">Thông báo cập nhật chương trình tài trợ</h1>
      <p style="margin:0;font-size:14px;line-height:1.6;color:#e2f0ff;">Báo cáo và số liệu đối soát của chương trình tài trợ đã được cập nhật công khai.</p>
    </td>
  </tr>
  <tr>
    <td style="padding:30px 36px 16px;font-size:15px;line-height:1.7;color:#1e334c;">
      <p style="margin:0 0 14px;">Xin chào <strong>{{recipient_name}}</strong>,</p>
<p style="margin:0 0 16px;">Chương trình tài trợ <strong>{{campaign_title}}</strong> (Mã: <strong>{{campaign_code}}</strong>) vừa được cập nhật thông tin minh bạch tài chính trên Hệ thống Thông tin Số Sky First.</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border:1px solid #e1e9f2;border-radius:14px;padding:12px 16px;">
  <tr><td style="padding:6px 0;color:#5c728a;font-size:13px;">Mục tiêu tài chính</td><td align="right" style="padding:6px 0;font-size:13px;font-weight:700;">{{target_amount}}</td></tr>
  <tr><td style="padding:6px 0;color:#5c728a;font-size:13px;">Số tiền cam kết</td><td align="right" style="padding:6px 0;font-size:13px;font-weight:700;">{{pledged_amount}}</td></tr>
  <tr><td style="padding:6px 0;color:#5c728a;font-size:13px;">Số tiền thực nhận</td><td align="right" style="padding:6px 0;font-size:13px;font-weight:700;color:#0a8b57;">{{received_amount}}</td></tr>
  <tr><td style="padding:6px 0;color:#5c728a;font-size:13px;">Trạng thái</td><td align="right" style="padding:6px 0;font-size:13px;font-weight:700;">{{status}}</td></tr>
</table>
      <div style="text-align:center;padding:24px 0 12px;">
        <a href="https://app.skyfirst.io.vn/tai-tro" style="display:inline-block;padding:13px 26px;border-radius:12px;background:#0759b8;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;">XEM TRANG MINH BẠCH TÀI TRỢ</a>
      </div>
    </td>
  </tr>
  <tr>
    <td style="padding:16px 36px 24px;">
      <div style="padding:14px 16px;border-radius:12px;background:#f0f6ff;border-left:4px solid #0759b8;font-size:12px;line-height:1.6;color:#47607a;">
        <strong>Thông tin hỗ trợ:</strong> Đây là email tự động từ <b>Hệ thống Thông tin Số Sky First</b> (<code>app@skyfirst.io.vn</code>). Nếu cần hỗ trợ kỹ thuật, vui lòng liên hệ <a href="mailto:support@skyfirst.io.vn" style="color:#0759b8;">support@skyfirst.io.vn</a> hoặc liên hệ chung tại <a href="mailto:lienhe@skyfirst.io.vn" style="color:#0759b8;">lienhe@skyfirst.io.vn</a>.
      </div>
    </td>
  </tr>
  <tr>
    <td style="padding:20px 32px;text-align:center;background:#071b35;color:#a9c3de;font-size:12px;line-height:1.6;">
      <div style="font-weight:700;color:#ffffff;">Hệ thống Thông tin Số Sky First · Sky First Digital Information System</div>
      <div style="margin-top:4px;"><a href="https://app.skyfirst.io.vn" style="color:#7cc7ff;text-decoration:none;">app.skyfirst.io.vn</a></div>
    </td>
  </tr>
</table>
</td></tr>
</table>
</body>
</html>', 'Xin chào {{recipient_name}},
Cập nhật chương trình tài trợ {{campaign_title}} ({{campaign_code}}).
Cam kết: {{pledged_amount}} | Thực nhận: {{received_amount}}.
Xem chi tiết tại: https://app.skyfirst.io.vn/tai-tro', 1, CURRENT_TIMESTAMP)
ON CONFLICT(key) DO UPDATE SET
  subject_template = excluded.subject_template,
  html_template = excluded.html_template,
  text_template = excluded.text_template,
  updated_at = CURRENT_TIMESTAMP;

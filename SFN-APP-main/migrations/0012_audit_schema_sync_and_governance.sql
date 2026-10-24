-- Migration 0012: Sky First Digital Information System — Comprehensive Audit Schema Sync, Governance & Performance Optimization
-- Safe, idempotent migration: creates missing tables (issued_document_codes, term_revisions), indexes, and synchronizes clean labels & lightweight email templates.
PRAGMA foreign_keys = ON;

-- 1. Central Credential Registry Table (referenced by src/admin.js & src/public.js)
CREATE TABLE IF NOT EXISTS issued_document_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id TEXT NOT NULL,
  document_type TEXT NOT NULL DEFAULT 'GCN',
  lookup_code TEXT NOT NULL UNIQUE,
  random_digits TEXT,
  code_version TEXT NOT NULL DEFAULT 'v3',
  is_primary INTEGER NOT NULL DEFAULT 1,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_issued_doc_codes_lookup ON issued_document_codes(lookup_code, random_digits);
CREATE INDEX IF NOT EXISTS idx_issued_doc_codes_doc ON issued_document_codes(document_id, is_active);

-- 2. Terms & Policies Version History Table (Requirement V.2)
CREATE TABLE IF NOT EXISTS term_revisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  term_code TEXT NOT NULL,
  name TEXT NOT NULL,
  version TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'published',
  change_note TEXT NOT NULL DEFAULT '',
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_term_revisions_code ON term_revisions(term_code, created_at DESC);

-- Seed initial revisions from existing terms if not yet recorded
INSERT INTO term_revisions(term_code, name, version, scope, body, status, change_note, created_by, created_at)
SELECT t.code, t.name, t.version, COALESCE(t.scope, ''), t.body, COALESCE(t.status, 'published'), 'Khởi tạo lịch sử phiên bản gốc', t.updated_by, COALESCE(t.updated_at, CURRENT_TIMESTAMP)
FROM terms t
WHERE NOT EXISTS (SELECT 1 FROM term_revisions r WHERE r.term_code = t.code AND r.version = t.version);

-- 3. Additional Performance Indexes for Admin Files, Forms & Lookups (Requirement III.1 & XIX.10)
CREATE INDEX IF NOT EXISTS idx_files_deleted_created ON files(deleted_at, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_forms_enabled_updated ON forms(enabled, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_form_revisions_form_ver ON form_revisions(form_id, version DESC);

-- 4. Disable deprecated volunteer_teaching module in modules catalog while preserving teaching_scopes table (Requirement V.4)
UPDATE modules SET enabled = 0 WHERE key = 'volunteer_teaching';

-- 5. Clean slug suffixes from footer_lookup menu items in menus table (Requirement IX)
UPDATE menus
SET items_json = REPLACE(REPLACE(items_json, 'Trung tâm Tra cứu (/tra-cuu)', 'Trung tâm Tra cứu'), 'Verification Hub (/tra-cuu)', 'Verification Hub'),
    updated_at = CURRENT_TIMESTAMP
WHERE location = 'footer_lookup';

-- 6. Update design_system setting to use 1:1 square favicon/PWA icons while keeping horizontal logo for header
UPDATE settings
SET value_json = REPLACE(value_json, '"favicon_url":"/assets/sfn-logo-tight.png"', '"favicon_url":"/assets/favicon-32.png"'),
    updated_at = CURRENT_TIMESTAMP
WHERE key = 'design_system';

-- 7. Synchronize lightweight universal HTML email template (<10 KB) across all 16 email_templates
UPDATE email_templates
SET html_template = '<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Thông báo từ Hệ thống Thông tin Số Sky First</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">{{PREHEADER}}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f1f5f9;">
<tr><td align="center" style="padding:24px 10px;">
<table role="presentation" width="620" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:620px;background:#ffffff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;">
<tr><td style="padding:22px 26px;border-bottom:1px solid #e8eef5;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td align="left" valign="middle" style="width:58%;">
<img src="data:image/png;base64,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" width="205" alt="Sky First — Education & Community Development" style="display:block;width:205px;max-width:100%;height:auto;border:0;outline:none;text-decoration:none;">
</td>
<td align="right" valign="middle" style="font-size:11px;line-height:1.6;color:#64748b;">HỆ THỐNG THÔNG TIN SỐ<br><strong style="color:#0b3a78;font-size:12px;">SKY FIRST</strong></td>
</tr></table></td></tr>
<tr><td style="padding:28px 26px 10px;">
<div style="font-size:11px;letter-spacing:1.1px;text-transform:uppercase;color:#0877e8;font-weight:bold;margin-bottom:10px;">{{EMAIL_CATEGORY}}</div>
<h1 style="font-size:24px;line-height:1.3;color:#102b50;margin:0 0 14px;">{{EMAIL_HEADING}}</h1>
<p style="font-size:15px;line-height:1.75;color:#475569;margin:0;">Xin chào {{RECIPIENT_NAME}},</p>
<p style="font-size:15px;line-height:1.75;color:#475569;margin:8px 0 0;">{{INTRO_TEXT}}</p>
</td></tr>
<tr><td style="padding:14px 26px 8px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #dbeafe;border-radius:9px;background:#f8fbff;">
<tr><td colspan="2" style="padding:13px 15px 6px;font-size:13px;font-weight:bold;color:#12325b;">Thông tin hồ sơ / đăng ký</td></tr>
<tr><td style="width:38%;padding:8px 15px;color:#64748b;font-size:13px;border-bottom:1px solid #e5eef9;">Mã hồ sơ</td><td style="padding:8px 15px;color:#12325b;font-size:13px;font-weight:bold;border-bottom:1px solid #e5eef9;">{{REQUEST_ID}}</td></tr>
<tr><td style="padding:8px 15px;color:#64748b;font-size:13px;border-bottom:1px solid #e5eef9;">Nội dung đăng ký</td><td style="padding:8px 15px;color:#334155;font-size:13px;border-bottom:1px solid #e5eef9;">{{REGISTRATION_TYPE}}</td></tr>
<tr><td style="padding:8px 15px;color:#64748b;font-size:13px;border-bottom:1px solid #e5eef9;">Thời điểm gửi</td><td style="padding:8px 15px;color:#334155;font-size:13px;border-bottom:1px solid #e5eef9;">{{SUBMITTED_AT}}</td></tr>
<tr><td style="padding:8px 15px;color:#64748b;font-size:13px;border-bottom:1px solid #e5eef9;">Trạng thái</td><td style="padding:8px 15px;color:#0877e8;font-size:13px;font-weight:bold;border-bottom:1px solid #e5eef9;">{{STATUS}}</td></tr>
<tr><td style="padding:8px 15px;color:#64748b;font-size:13px;">Thông tin bổ sung</td><td style="padding:8px 15px;color:#334155;font-size:13px;">{{ADDITIONAL_INFO}}</td></tr>
</table>
</td></tr>
<tr><td style="padding:12px 26px 10px;font-size:14px;line-height:1.8;color:#374151;">
<div>{{BODY_HTML}}</div>
<p style="margin:12px 0 0;">{{NEXT_STEPS}}</p>
</td></tr>
<tr><td align="center" style="padding:18px 26px 12px;">
<a href="{{ACTION_URL}}" style="display:inline-block;background:#0877e8;color:#ffffff;text-decoration:none;font-weight:bold;padding:13px 22px;border-radius:8px;font-size:14px;">{{ACTION_LABEL}}</a>
</td></tr>
<tr><td style="padding:10px 26px 26px;font-size:14px;line-height:1.8;color:#374151;">Trân trọng,<br><strong style="color:#12325b;">Hệ thống Thông tin Số Sky First</strong></td></tr>
<tr><td style="padding:20px 26px;background:#f8fafc;border-top:1px solid #e5edf5;">
<p style="margin:0 0 8px;font-size:12px;line-height:1.7;color:#64748b;">Đây là email được gửi tự động từ hệ thống. Vui lòng không trả lời trực tiếp email này.</p>
<p style="margin:0;font-size:12px;line-height:1.8;color:#64748b;">Cần hỗ trợ? Liên hệ <a href="mailto:support@skyfirst.io.vn" style="color:#0877e8;text-decoration:none;">support@skyfirst.io.vn</a> hoặc gọi <a href="tel:0924910210" style="color:#0877e8;text-decoration:none;">0924 910 210</a>.</p>
<p style="margin:12px 0 0;font-size:11px;color:#94a3b8;">© 2026 Hệ thống Thông tin Số Sky First. Bảo lưu mọi quyền.</p>
</td></tr>
</table></td></tr></table>
</body></html>',
    updated_at = CURRENT_TIMESTAMP;

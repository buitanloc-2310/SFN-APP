-- Migration 0009: Super Website Upgrade, Universal HTML Email Template (email_universal_auto.html), Copyright/Citation & Performance Indexes
PRAGMA foreign_keys = ON;

INSERT INTO settings(key, value_json, updated_at) VALUES
  ('footer_copyright', '"© 2026 Hệ thống Thông tin Số Sky First. Bảo lưu mọi quyền."', CURRENT_TIMESTAMP),
  ('footer_copyright_en', '"© 2026 Sky First Digital Information System. All rights reserved."', CURRENT_TIMESTAMP),
  ('footer_citation_notice', '"Mọi nội dung trích dẫn phải bảo đảm tính chính xác, trung thực và đầy đủ về ngữ cảnh; ghi rõ nguồn tham khảo và đính kèm liên kết đến tài liệu gốc khi có thể. Việc sử dụng, trích dẫn và chia sẻ thông tin phải tuân thủ quy định về bản quyền, quyền sở hữu trí tuệ và bảo vệ dữ liệu cá nhân."', CURRENT_TIMESTAMP),
  ('footer_citation_notice_en', '"All cited content must ensure accuracy, truthfulness, and full context; clearly state reference sources and attach links to original documents when possible. Use, citation, and sharing of information must comply with copyright, intellectual property, and personal data protection regulations."', CURRENT_TIMESTAMP),
  ('hotline', '"0924 910 210"', CURRENT_TIMESTAMP),
  ('allow_auto_password_reset', 'false', CURRENT_TIMESTAMP)
ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_submissions_status_created ON submissions(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_submissions_form_created ON submissions(form_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_submissions_lookup ON submissions(code, email);
CREATE INDEX IF NOT EXISTS idx_certificates_status_issued ON certificates(status, issued_at DESC);
CREATE INDEX IF NOT EXISTS idx_certificates_email ON certificates(email);
CREATE INDEX IF NOT EXISTS idx_documents_vis_status ON documents(visibility, status);
CREATE INDEX IF NOT EXISTS idx_email_logs_status_created ON email_logs(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_logs_dedupe ON email_logs(to_email, template_key, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id);

INSERT INTO email_templates(key, subject_template, html_template, text_template, enabled, updated_at)
VALUES ('submission_confirmation', 'Hệ thống Thông tin Số Sky First | Xác nhận tiếp nhận hồ sơ {{REQUEST_ID}}', '<!doctype html>
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
</body></html>', 'Xin chào {{RECIPIENT_NAME}},\nHệ thống Thông tin Số Sky First xác nhận đã tiếp nhận hồ sơ {{REQUEST_ID}} ({{REGISTRATION_TYPE}}) lúc {{SUBMITTED_AT}}.\nTrạng thái: {{STATUS}}\nTra cứu tại: {{ACTION_URL}}', 1, CURRENT_TIMESTAMP)
ON CONFLICT(key) DO UPDATE SET
  subject_template = excluded.subject_template,
  html_template = excluded.html_template,
  text_template = excluded.text_template,
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO email_templates(key, subject_template, html_template, text_template, enabled, updated_at)
VALUES ('registration_confirmation', 'Hệ thống Thông tin Số Sky First | Xác nhận đăng ký chương trình {{REQUEST_ID}}', (SELECT html_template FROM email_templates WHERE key='submission_confirmation'), 'Xin chào {{RECIPIENT_NAME}},\nĐăng ký tham gia {{REGISTRATION_TYPE}} (Mã: {{REQUEST_ID}}) đã được ghi nhận lúc {{SUBMITTED_AT}}.\nTrạng thái: {{STATUS}}\nXem chi tiết tại: {{ACTION_URL}}', 1, CURRENT_TIMESTAMP)
ON CONFLICT(key) DO UPDATE SET
  subject_template = excluded.subject_template,
  html_template = excluded.html_template,
  text_template = excluded.text_template,
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO email_templates(key, subject_template, html_template, text_template, enabled, updated_at)
VALUES ('information_required', 'Hệ thống Thông tin Số Sky First | Yêu cầu bổ sung thông tin hồ sơ {{REQUEST_ID}}', (SELECT html_template FROM email_templates WHERE key='submission_confirmation'), 'Xin chào {{RECIPIENT_NAME}},\nHồ sơ {{REQUEST_ID}} ({{REGISTRATION_TYPE}}) cần bổ sung thông tin: {{ADDITIONAL_INFO}}.\nCập nhật tại: {{ACTION_URL}}', 1, CURRENT_TIMESTAMP)
ON CONFLICT(key) DO UPDATE SET
  subject_template = excluded.subject_template,
  html_template = excluded.html_template,
  text_template = excluded.text_template,
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO email_templates(key, subject_template, html_template, text_template, enabled, updated_at)
VALUES ('status_update', 'Hệ thống Thông tin Số Sky First | Cập nhật trạng thái hồ sơ {{REQUEST_ID}} — {{STATUS}}', (SELECT html_template FROM email_templates WHERE key='submission_confirmation'), 'Xin chào {{RECIPIENT_NAME}},\nHồ sơ {{REQUEST_ID}} ({{REGISTRATION_TYPE}}) đã chuyển sang trạng thái: {{STATUS}}.\nGhi chú: {{ADDITIONAL_INFO}}\nTra cứu tại: {{ACTION_URL}}', 1, CURRENT_TIMESTAMP)
ON CONFLICT(key) DO UPDATE SET
  subject_template = excluded.subject_template,
  html_template = excluded.html_template,
  text_template = excluded.text_template,
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO email_templates(key, subject_template, html_template, text_template, enabled, updated_at)
VALUES ('application_result', 'Hệ thống Thông tin Số Sky First | Thông báo kết quả thẩm định hồ sơ {{REQUEST_ID}}', (SELECT html_template FROM email_templates WHERE key='submission_confirmation'), 'Xin chào {{RECIPIENT_NAME}},\nKết quả thẩm định hồ sơ {{REQUEST_ID}} ({{REGISTRATION_TYPE}}): {{STATUS}}.\nGhi chú: {{ADDITIONAL_INFO}}\nXem tại: {{ACTION_URL}}', 1, CURRENT_TIMESTAMP)
ON CONFLICT(key) DO UPDATE SET
  subject_template = excluded.subject_template,
  html_template = excluded.html_template,
  text_template = excluded.text_template,
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO email_templates(key, subject_template, html_template, text_template, enabled, updated_at)
VALUES ('certificate_issued', 'Hệ thống Thông tin Số Sky First | Phát hành Chứng nhận số {{REQUEST_ID}}', (SELECT html_template FROM email_templates WHERE key='submission_confirmation'), 'Xin chào {{RECIPIENT_NAME}},\nChứng nhận số {{REQUEST_ID}} ({{REGISTRATION_TYPE}}) đã được phát hành chính thức.\nXác thực và tải PDF tại: {{ACTION_URL}}', 1, CURRENT_TIMESTAMP)
ON CONFLICT(key) DO UPDATE SET
  subject_template = excluded.subject_template,
  html_template = excluded.html_template,
  text_template = excluded.text_template,
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO email_templates(key, subject_template, html_template, text_template, enabled, updated_at)
VALUES ('certificate_revoked', 'Hệ thống Thông tin Số Sky First | Thông báo thu hồi / thay thế bản ghi {{REQUEST_ID}}', (SELECT html_template FROM email_templates WHERE key='submission_confirmation'), 'Xin chào {{RECIPIENT_NAME}},\nBản ghi {{REQUEST_ID}} ({{REGISTRATION_TYPE}}) đã được cập nhật trạng thái: {{STATUS}}.\nLý do: {{ADDITIONAL_INFO}}\nKiểm tra tại: {{ACTION_URL}}', 1, CURRENT_TIMESTAMP)
ON CONFLICT(key) DO UPDATE SET
  subject_template = excluded.subject_template,
  html_template = excluded.html_template,
  text_template = excluded.text_template,
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO email_templates(key, subject_template, html_template, text_template, enabled, updated_at)
VALUES ('document_published', 'Hệ thống Thông tin Số Sky First | Phát hành tài liệu số {{REQUEST_ID}}', (SELECT html_template FROM email_templates WHERE key='submission_confirmation'), 'Xin chào {{RECIPIENT_NAME}},\nTài liệu {{REGISTRATION_TYPE}} (Mã: {{REQUEST_ID}}) đã được phát hành.\nTải tài liệu tại: {{ACTION_URL}}', 1, CURRENT_TIMESTAMP)
ON CONFLICT(key) DO UPDATE SET
  subject_template = excluded.subject_template,
  html_template = excluded.html_template,
  text_template = excluded.text_template,
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO email_templates(key, subject_template, html_template, text_template, enabled, updated_at)
VALUES ('interview_scheduled', 'Hệ thống Thông tin Số Sky First | Thông báo lịch làm việc / thời hạn {{REQUEST_ID}}', (SELECT html_template FROM email_templates WHERE key='submission_confirmation'), 'Xin chào {{RECIPIENT_NAME}},\nThông báo lịch trình cho hồ sơ {{REQUEST_ID}} ({{REGISTRATION_TYPE}}): {{ADDITIONAL_INFO}}.\nXem chi tiết tại: {{ACTION_URL}}', 1, CURRENT_TIMESTAMP)
ON CONFLICT(key) DO UPDATE SET
  subject_template = excluded.subject_template,
  html_template = excluded.html_template,
  text_template = excluded.text_template,
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO email_templates(key, subject_template, html_template, text_template, enabled, updated_at)
VALUES ('support_ticket_received', 'Hệ thống Thông tin Số Sky First | Tiếp nhận yêu cầu hỗ trợ {{REQUEST_ID}}', (SELECT html_template FROM email_templates WHERE key='submission_confirmation'), 'Xin chào {{RECIPIENT_NAME}},\nYêu cầu hỗ trợ {{REQUEST_ID}} ({{REGISTRATION_TYPE}}) đã được ghi nhận.\nTrạng thái: {{STATUS}}', 1, CURRENT_TIMESTAMP)
ON CONFLICT(key) DO UPDATE SET
  subject_template = excluded.subject_template,
  html_template = excluded.html_template,
  text_template = excluded.text_template,
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO email_templates(key, subject_template, html_template, text_template, enabled, updated_at)
VALUES ('support_ticket_reply', 'Hệ thống Thông tin Số Sky First | Phản hồi yêu cầu hỗ trợ {{REQUEST_ID}}', (SELECT html_template FROM email_templates WHERE key='submission_confirmation'), 'Xin chào {{RECIPIENT_NAME}},\nBộ phận Hỗ trợ đã phản hồi yêu cầu {{REQUEST_ID}}: {{ADDITIONAL_INFO}}.\nXem tại: {{ACTION_URL}}', 1, CURRENT_TIMESTAMP)
ON CONFLICT(key) DO UPDATE SET
  subject_template = excluded.subject_template,
  html_template = excluded.html_template,
  text_template = excluded.text_template,
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO email_templates(key, subject_template, html_template, text_template, enabled, updated_at)
VALUES ('account_invite', 'Hệ thống Thông tin Số Sky First | Thông báo cấp quyền tài khoản {{REQUEST_ID}}', (SELECT html_template FROM email_templates WHERE key='submission_confirmation'), 'Xin chào {{RECIPIENT_NAME}},\nTài khoản của bạn trên Hệ thống Thông tin Số Sky First đã được khởi tạo ({{REGISTRATION_TYPE}}).\nKích hoạt tại: {{ACTION_URL}}', 1, CURRENT_TIMESTAMP)
ON CONFLICT(key) DO UPDATE SET
  subject_template = excluded.subject_template,
  html_template = excluded.html_template,
  text_template = excluded.text_template,
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO email_templates(key, subject_template, html_template, text_template, enabled, updated_at)
VALUES ('password_reset', 'Hệ thống Thông tin Số Sky First | Hướng dẫn hỗ trợ đặt lại mật khẩu', (SELECT html_template FROM email_templates WHERE key='submission_confirmation'), 'Xin chào {{RECIPIENT_NAME}},\nHệ thống đã ghi nhận yêu cầu hỗ trợ đặt lại mật khẩu ({{REQUEST_ID}}).\nLiên hệ support@skyfirst.io.vn hoặc hotline 0924 910 210.', 1, CURRENT_TIMESTAMP)
ON CONFLICT(key) DO UPDATE SET
  subject_template = excluded.subject_template,
  html_template = excluded.html_template,
  text_template = excluded.text_template,
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO email_templates(key, subject_template, html_template, text_template, enabled, updated_at)
VALUES ('verify_email', 'Hệ thống Thông tin Số Sky First | Xác minh địa chỉ email', (SELECT html_template FROM email_templates WHERE key='submission_confirmation'), 'Xin chào {{RECIPIENT_NAME}},\nVui lòng xác minh địa chỉ email tại: {{ACTION_URL}}', 1, CURRENT_TIMESTAMP)
ON CONFLICT(key) DO UPDATE SET
  subject_template = excluded.subject_template,
  html_template = excluded.html_template,
  text_template = excluded.text_template,
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO email_templates(key, subject_template, html_template, text_template, enabled, updated_at)
VALUES ('submission_internal', '[Sky First Admin] Hồ sơ mới {{REQUEST_ID}} — {{REGISTRATION_TYPE}}', (SELECT html_template FROM email_templates WHERE key='submission_confirmation'), 'Hồ sơ mới {{REQUEST_ID}} ({{REGISTRATION_TYPE}})\nNgười gửi: {{RECIPIENT_NAME}} ({{ADDITIONAL_INFO}})\nThời điểm: {{SUBMITTED_AT}}\nTrạng thái: {{STATUS}}\n{{answers_text}}', 1, CURRENT_TIMESTAMP)
ON CONFLICT(key) DO UPDATE SET
  subject_template = excluded.subject_template,
  html_template = excluded.html_template,
  text_template = excluded.text_template,
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO email_templates(key, subject_template, html_template, text_template, enabled, updated_at)
VALUES ('fundraising_update', 'Hệ thống Thông tin Số Sky First | Cập nhật minh bạch tài trợ {{REQUEST_ID}}', (SELECT html_template FROM email_templates WHERE key='submission_confirmation'), 'Xin chào {{RECIPIENT_NAME}},\nCập nhật chương trình tài trợ {{REGISTRATION_TYPE}} ({{REQUEST_ID}}).\n{{ADDITIONAL_INFO}}\nXem chi tiết tại: {{ACTION_URL}}', 1, CURRENT_TIMESTAMP)
ON CONFLICT(key) DO UPDATE SET
  subject_template = excluded.subject_template,
  html_template = excluded.html_template,
  text_template = excluded.text_template,
  updated_at = CURRENT_TIMESTAMP;

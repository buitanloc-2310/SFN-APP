-- SFEC Email Automation Center: additive-only migration.
-- Stores retry payloads only for non-sensitive messages; account-invite payloads are intentionally excluded.
ALTER TABLE email_logs ADD COLUMN retry_payload_json TEXT;

INSERT OR IGNORE INTO email_templates(key,subject_template,html_template,text_template,enabled) VALUES
('class_enrollment','[SFEC] Xác nhận đăng ký lớp {{class_title}}','<h2>Xác nhận đăng ký lớp học</h2><p>Xin chào {{full_name}},</p><p>Hệ thống đã ghi nhận đăng ký của bạn cho lớp <b>{{class_title}}</b>.</p><p>Trạng thái: {{status}}</p><p>Mạng lưới Giáo dục &amp; Phát triển Cộng đồng Sky First</p>','Xin chào {{full_name}}, hệ thống đã ghi nhận đăng ký lớp {{class_title}}. Trạng thái: {{status}}.',1),
('event_registration','[SFEC] Xác nhận đăng ký hoạt động {{event_title}}','<h2>Xác nhận đăng ký hoạt động</h2><p>Xin chào {{full_name}},</p><p>Đã ghi nhận đăng ký tham gia <b>{{event_title}}</b>.</p><p>Thời gian: {{event_time}}</p><p>Trạng thái: {{status}}</p>','Đã ghi nhận đăng ký {{event_title}}. Thời gian: {{event_time}}. Trạng thái: {{status}}.',1),
('ticket_update','[SFEC] Cập nhật yêu cầu hỗ trợ {{ticket_code}}','<h2>Cập nhật yêu cầu hỗ trợ</h2><p>Xin chào {{full_name}},</p><p>Yêu cầu <b>{{ticket_code}}</b> đã được cập nhật.</p><p>Trạng thái: {{status}}</p><p>{{message}}</p>','Yêu cầu {{ticket_code}} đã được cập nhật. Trạng thái: {{status}}. {{message}}',1),
('interview_schedule','[SFEC] Lịch hẹn {{submission_code}}','<h2>Thông tin lịch hẹn</h2><p>Xin chào {{full_name}},</p><p>Lịch hẹn: {{scheduled_at}}</p><p>Hình thức/đường dẫn: {{meeting_url}}</p><p>Ghi chú: {{notes}}</p>','Lịch hẹn {{submission_code}}: {{scheduled_at}}. {{meeting_url}}. {{notes}}',1),
('system_alert','[SFEC] Cảnh báo vận hành: {{alert_title}}','<h2>Cảnh báo vận hành SFEC</h2><p>{{alert_title}}</p><p>Mã tham chiếu: {{reference}}</p><p>Thời gian: {{occurred_at}}</p><p>Vui lòng kiểm tra trang quản trị và nhật ký hệ thống.</p>','Cảnh báo SFEC: {{alert_title}}. Mã: {{reference}}. Thời gian: {{occurred_at}}.',1);

INSERT OR IGNORE INTO settings(key,value_json) VALUES
('email_sender_name','"Câu lạc bộ Giáo dục Sky First (SFEC)"'),
('email_reply_to','"sfec@skyfirst.io.vn"'),
('email_internal_alert_recipient','"sfec@skyfirst.io.vn"');

-- SFEC FINAL EMAIL AUTOMATION INSTALL
-- Run exactly once on the intended D1 database after migrations 0001-0009.
-- If migration 0010 is already recorded/applied, DO NOT run this combined file again;
-- apply migrations/0011_email_all_module_events.sql only via the migration workflow.
-- This SQL updates D1 data/schema only. Worker source must also be deployed separately.

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


-- SFEC email automation coverage expansion. Additive only; apply after migrations 0001-0010.
INSERT OR IGNORE INTO email_templates(key,subject_template,html_template,text_template,enabled) VALUES
('account_status','[SFEC] Cập nhật trạng thái tài khoản','<h2>Cập nhật tài khoản</h2><p>Xin chào {{full_name}},</p><p>Trạng thái tài khoản của bạn đã được cập nhật: <b>{{status}}</b>.</p><p>Nếu cần hỗ trợ, liên hệ sfec@skyfirst.io.vn.</p><p>Mạng lưới Giáo dục &amp; Phát triển Cộng đồng Sky First</p>','Xin chào {{full_name}}, trạng thái tài khoản: {{status}}. Hỗ trợ: sfec@skyfirst.io.vn.',1),
('role_updated','[SFEC] Cập nhật quyền tài khoản','<h2>Thông tin phân quyền</h2><p>Xin chào {{full_name}},</p><p>Quyền truy cập của tài khoản đã được quản trị viên cập nhật.</p><p>Vui lòng đăng nhập để xem quyền hiện tại. Nếu có thắc mắc, liên hệ sfec@skyfirst.io.vn.</p>','Quyền truy cập tài khoản đã được cập nhật. Liên hệ sfec@skyfirst.io.vn nếu cần hỗ trợ.',1),
('certificate_requested','[SFEC] Đã tiếp nhận đề nghị GCN/GXN {{reference}}','<h2>Đã tiếp nhận đề nghị</h2><p>Xin chào {{full_name}},</p><p>Đề nghị của bạn đã được tiếp nhận và đang chờ xử lý.</p><p>Mã tham chiếu: {{reference}}</p><p>Lưu ý: thông báo này không đồng nghĩa GCN/GXN đã được cấp.</p>','Đề nghị GCN/GXN đã được tiếp nhận, mã {{reference}}. Đây không phải xác nhận đã cấp.',1),
('certificate_status','[SFEC] Cập nhật trạng thái đề nghị GCN/GXN {{reference}}','<h2>Cập nhật trạng thái đề nghị</h2><p>Xin chào {{full_name}},</p><p>Mã tham chiếu: {{reference}}</p><p>Trạng thái: <b>{{status}}</b></p><p>Ghi chú: {{note}}</p><p>Thông tin cấp phát chính thức phải được xác nhận từ đơn vị có thẩm quyền.</p>','Mã {{reference}}. Trạng thái: {{status}}. Ghi chú: {{note}}. Thông báo không thay thế xác minh chính thức.',1),
('approval_status','[SFEC] Cập nhật quyết định phê duyệt {{reference}}','<h2>Cập nhật quyết định</h2><p>Xin chào {{full_name}},</p><p>Yêu cầu: {{action}}</p><p>Trạng thái: <b>{{status}}</b></p><p>Ghi chú: {{note}}</p>','Yêu cầu {{action}} có trạng thái {{status}}. Ghi chú: {{note}}.',1),
('privacy_request_status','[SFEC] Cập nhật yêu cầu quyền riêng tư {{reference}}','<h2>Cập nhật yêu cầu quyền riêng tư</h2><p>Xin chào {{full_name}},</p><p>Mã yêu cầu: {{reference}}</p><p>Trạng thái: {{status}}</p><p>Ghi chú: {{note}}</p>','Yêu cầu {{reference}}: {{status}}. {{note}}',1),
('person_added','[SFEC] Hồ sơ thành viên đã được tiếp nhận','<h2>Hồ sơ thành viên</h2><p>Xin chào {{full_name}},</p><p>Hệ thống đã liên kết hồ sơ của bạn với hồ sơ thành viên SFEC.</p><p>Thông tin được xử lý theo quyền truy cập và chính sách dữ liệu của hệ thống.</p>','Hồ sơ của bạn đã được liên kết với hồ sơ thành viên SFEC.',1);

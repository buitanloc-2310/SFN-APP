-- MASTER FINAL SPECIFICATION V3
-- Non-destructive migration: public defaults, account activation email, portal content settings.
PRAGMA foreign_keys = ON;

UPDATE email_templates
SET subject_template='Kích hoạt tài khoản quản trị Cổng Thông tin Số Sky First',
    html_template='<div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;color:#10233f"><div style="padding:28px;border-radius:20px;background:linear-gradient(135deg,#eaf7ff,#eef0ff)"><h2 style="margin:0 0 12px;color:#0759b8">Kích hoạt tài khoản quản trị</h2><p>Xin chào {{full_name}},</p><p>Một tài khoản quản trị Cổng Thông tin Số Sky First đã được tạo cho địa chỉ <b>{{email}}</b>.</p><p style="margin:28px 0"><a href="{{activation_link}}" style="display:inline-block;padding:13px 20px;border-radius:12px;background:#0759b8;color:#fff;text-decoration:none;font-weight:700">Kích hoạt tài khoản</a></p><p>Liên kết chỉ sử dụng một lần và có thời hạn. Bạn sẽ tự đặt mật khẩu khi kích hoạt.</p><p style="font-size:13px;color:#60708a">Nếu bạn không mong đợi lời mời này, hãy bỏ qua email.</p></div></div>',
    text_template='Xin chào {{full_name}}. Kích hoạt tài khoản quản trị Sky First tại: {{activation_link}}',
    enabled=1
WHERE key='account_invite';

INSERT INTO settings(key,value_json) VALUES
('portal_v3_enabled','true'),
('home_hero_eyebrow','"CỔNG THÔNG TIN SỐ"'),
('home_hero_title','"THÔNG TIN CẦN TÌM. TIỆN ÍCH CẦN DÙNG."'),
('home_hero_text','"Khám phá chương trình, hoạt động, cơ hội tham gia, tài nguyên và các tiện ích số trong hệ sinh thái Sky First Network."'),
('lookup_title','"TRA CỨU THÔNG TIN"'),
('credential_lookup_title','"TRA CỨU GIẤY ĐÃ PHÁT HÀNH"'),
('case_lookup_title','"TRA CỨU HỒ SƠ"')
ON CONFLICT(key) DO NOTHING;

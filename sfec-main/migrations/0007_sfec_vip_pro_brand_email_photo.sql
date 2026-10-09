-- SFEC V5: office receiver + official sender-facing content + student photo requirement

INSERT INTO settings(key,value_json,updated_at)
VALUES('receiver_email','"sfec.vanphong@gmail.com"',CURRENT_TIMESTAMP)
ON CONFLICT(key) DO UPDATE SET value_json='"sfec.vanphong@gmail.com"',updated_at=CURRENT_TIMESTAMP;

UPDATE forms
SET recipient_email='sfec.vanphong@gmail.com';

-- Require a portrait photo for class/student registrations without duplicating the field on reruns.
UPDATE forms
SET config_json = CASE
  WHEN instr(config_json,'"key":"profile_photo"') > 0 THEN config_json
  ELSE json_insert(
    config_json,
    '$.sections[0].fields[#]',
    json_object(
      'key','profile_photo',
      'label','Ảnh chân dung học viên',
      'type','file',
      'required',json('true'),
      'accept',json('["image/jpeg","image/png","image/webp"]')
    )
  )
END,
version=version+1
WHERE id='class';

UPDATE email_templates
SET subject_template='[SFEC] Đã tiếp nhận hồ sơ {{code}}',
    html_template='<!doctype html><html><body style="margin:0;background:#f4f6ff;font-family:Arial,sans-serif;color:#17223b"><div style="max-width:680px;margin:0 auto;padding:28px 14px"><div style="background:linear-gradient(135deg,#3925a8,#744cff 48%,#e84b91 75%,#ff963e);border-radius:28px 28px 0 0;padding:34px 30px;color:#fff"><div style="font-size:12px;font-weight:800;letter-spacing:1.4px;opacity:.9">THE SKY FIRST ENGLISH CLUB</div><h1 style="margin:10px 0 8px;font-size:30px">SFEC đã nhận hồ sơ của bạn ✨</h1><p style="margin:0;line-height:1.65;opacity:.92">Xin chào <b>{{full_name}}</b>, cảm ơn bạn đã gửi đăng ký đến SFEC.</p></div><div style="background:#fff;padding:28px 30px;border-radius:0 0 28px 28px;box-shadow:0 18px 45px rgba(60,70,120,.12)"><div style="display:inline-block;background:#eeeaff;color:#5e44df;font-size:12px;font-weight:800;padding:7px 11px;border-radius:999px">MÃ HỒ SƠ</div><div style="font-size:28px;font-weight:900;margin:10px 0 20px;color:#25365e">{{code}}</div><table style="width:100%;border-collapse:collapse;font-size:14px"><tr><td style="padding:11px;border-bottom:1px solid #edf0f7;color:#71809a">Biểu mẫu</td><td style="padding:11px;border-bottom:1px solid #edf0f7;font-weight:700">{{form_name}}</td></tr><tr><td style="padding:11px;border-bottom:1px solid #edf0f7;color:#71809a">Email</td><td style="padding:11px;border-bottom:1px solid #edf0f7;font-weight:700">{{email}}</td></tr><tr><td style="padding:11px;border-bottom:1px solid #edf0f7;color:#71809a">Thời gian gửi</td><td style="padding:11px;border-bottom:1px solid #edf0f7;font-weight:700">{{submitted_at}}</td></tr></table><p style="margin:20px 0 0;line-height:1.7;color:#53627c">{{photo_note}}</p><a href="{{lookup_url}}" style="display:inline-block;margin-top:22px;background:linear-gradient(135deg,#6d4aff,#3878ff);color:#fff;text-decoration:none;font-weight:800;padding:13px 19px;border-radius:12px">Tra cứu hồ sơ</a><p style="font-size:12px;color:#7f8ca2;line-height:1.6;margin-top:24px">Email này được gửi tự động từ <b>sfec@skyfirst.io.vn</b>. Hồ sơ được Văn phòng SFEC tiếp nhận tại sfec.vanphong@gmail.com.</p></div></div></body></html>',
    text_template='SFEC đã tiếp nhận hồ sơ {{code}} của {{full_name}}. Biểu mẫu: {{form_name}}. Tra cứu: {{lookup_url}}'
WHERE key='submission_confirmation';

UPDATE email_templates
SET subject_template='[SFEC · Văn phòng] Hồ sơ mới {{code}} — {{form_name}}',
    html_template='<!doctype html><html><body style="margin:0;background:#f5f7fc;font-family:Arial,sans-serif;color:#17223b"><div style="max-width:760px;margin:0 auto;padding:26px 14px"><div style="background:linear-gradient(135deg,#1e1a64,#6d4aff,#e44c8f);color:#fff;padding:28px;border-radius:24px 24px 0 0"><div style="font-size:12px;font-weight:800;letter-spacing:1.2px">SFEC · VĂN PHÒNG</div><h2 style="margin:9px 0 5px;font-size:26px">Có hồ sơ mới cần tiếp nhận</h2><div style="font-size:18px;font-weight:800">{{code}} · {{form_name}}</div></div><div style="background:#fff;padding:26px;border-radius:0 0 24px 24px;box-shadow:0 16px 40px rgba(50,65,110,.10)"><p><b>Người gửi:</b> {{full_name}} — {{email}}</p><p style="color:#697993">{{photo_note}}</p>{{answers_table}}<p style="font-size:12px;color:#7c899d;margin-top:18px">Tệp đính kèm được lưu trong hệ thống SFEC và chỉ hiển thị cho tài khoản có quyền phù hợp.</p></div></div></body></html>',
    text_template='Hồ sơ mới {{code}} — {{form_name}}\nNgười gửi: {{full_name}} — {{email}}\n{{answers_text}}'
WHERE key='submission_internal';

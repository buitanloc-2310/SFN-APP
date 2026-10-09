-- SFEC V6: install approved applicant confirmation email template
UPDATE email_templates
SET subject_template='[SFEC] Xác nhận tiếp nhận hồ sơ {{code}}',
    html_template='<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>SFEC - Xác nhận tiếp nhận hồ sơ</title>
</head>
<body style="margin:0;padding:0;background:#eef5ff;font-family:Arial,Helvetica,sans-serif;color:#173463;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:linear-gradient(180deg,#dfefff 0%,#f7fbff 42%,#edf4ff 100%);padding:26px 10px;">
<tr><td align="center">

<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:760px;background:#ffffff;border-radius:28px;overflow:hidden;box-shadow:0 22px 60px rgba(32,73,145,.16);">

<!-- TOP BRAND -->
<tr>
<td style="padding:0;background:linear-gradient(135deg,#0a58ca 0%,#1598ff 46%,#7b4dff 100%);">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
    <tr>
      <td style="padding:26px 30px 22px;vertical-align:middle;">
        <img src="https://sfec.skyfirst.io.vn/assets/logo-sfec-email.png" alt="SFEC - The Sky First English Club" style="display:block;max-width:300px;width:100%;height:auto;">
      </td>
      <td align="right" style="padding:26px 30px 22px;vertical-align:middle;color:#fff;">
        <div style="font-size:13px;letter-spacing:1.4px;font-weight:800;opacity:.92;">THE SKY FIRST ENGLISH CLUB</div>
        <div style="margin-top:10px;font-size:15px;line-height:1.6;font-weight:700;">Learn • Connect • Grow • Create Impact</div>
      </td>
    </tr>
  </table>
</td>
</tr>

<!-- INTRO -->
<tr>
<td style="padding:34px 34px 12px;">
  <div style="display:inline-block;background:#e8f2ff;color:#0b63ce;border-radius:999px;padding:9px 15px;font-size:13px;font-weight:800;">✉ THƯ XÁC NHẬN HỒ SƠ</div>
  <h1 style="margin:18px 0 10px;font-size:34px;line-height:1.18;color:#173b7a;">SFEC ĐÃ TIẾP NHẬN<br><span style="color:#6847e8;">HỒ SƠ CỦA BẠN</span></h1>
  <p style="margin:0;font-size:16px;line-height:1.75;color:#51698f;">
    Xin chào <b>{FULL_NAME}</b>, cảm ơn bạn đã gửi thông tin đến SFEC. Hệ thống đã ghi nhận hồ sơ thành công và chuyển đến bộ phận phụ trách để xem xét.
  </p>
</td>
</tr>

<!-- APPLICATION -->
<tr>
<td style="padding:16px 34px 8px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:linear-gradient(135deg,#f5f9ff 0%,#eef3ff 100%);border:1px solid #dce8ff;border-radius:22px;">
<tr><td style="padding:24px;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
    <tr>
      <td style="font-size:18px;font-weight:800;color:#174d9d;">📄 THÔNG TIN HỒ SƠ</td>
      <td align="right"><span style="display:inline-block;background:#dcf8e6;color:#169447;border-radius:999px;padding:9px 14px;font-size:12px;font-weight:800;">✓ ĐÃ TIẾP NHẬN</span></td>
    </tr>
  </table>

  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:18px;">
  <tr>
    <td style="vertical-align:top;padding-right:18px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="font-size:14px;line-height:1.7;">
        <tr><td style="padding:7px 0;color:#6681aa;width:38%;">Mã hồ sơ</td><td style="padding:7px 0;font-weight:800;color:#183c79;">{APPLICATION_ID}</td></tr>
        <tr><td style="padding:7px 0;color:#6681aa;">Loại đăng ký</td><td style="padding:7px 0;font-weight:800;color:#183c79;">{APPLICATION_TYPE}</td></tr>
        <tr><td style="padding:7px 0;color:#6681aa;">Họ và tên</td><td style="padding:7px 0;font-weight:800;color:#183c79;">{FULL_NAME}</td></tr>
        <tr><td style="padding:7px 0;color:#6681aa;">Email</td><td style="padding:7px 0;font-weight:800;color:#183c79;">{EMAIL}</td></tr>
        <tr><td style="padding:7px 0;color:#6681aa;">Số điện thoại</td><td style="padding:7px 0;font-weight:800;color:#183c79;">{PHONE}</td></tr>
        <tr><td style="padding:7px 0;color:#6681aa;">Thời gian gửi</td><td style="padding:7px 0;font-weight:800;color:#183c79;">{SUBMITTED_AT}</td></tr>
        <tr><td style="padding:7px 0;color:#6681aa;">Trạng thái</td><td style="padding:7px 0;"><span style="display:inline-block;background:#fff0c5;color:#a36a00;border-radius:999px;padding:8px 12px;font-weight:800;">{STATUS}</span></td></tr>
      </table>
    </td>
    <td style="width:190px;vertical-align:top;">
      <div style="background:#ffffff;border-radius:18px;padding:12px;border:1px solid #dce8ff;text-align:center;box-shadow:0 8px 20px rgba(52,97,170,.08);">
        <div style="font-size:12px;font-weight:800;color:#173b7a;margin-bottom:10px;">ẢNH CHÂN DUNG</div>
        <div style="border-radius:14px;overflow:hidden;background:#edf4ff;min-height:210px;">
          {PROFILE_IMAGE_BLOCK}
        </div>
      </div>
    </td>
  </tr>
  </table>
</td></tr>
</table>
</td>
</tr>

<!-- NEXT STEPS -->
<tr>
<td style="padding:18px 34px 8px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:linear-gradient(135deg,#f5f1ff,#fff4fb);border:1px solid #eadfff;border-radius:22px;">
<tr><td style="padding:24px;">
  <div style="font-size:18px;font-weight:800;color:#5439c7;margin-bottom:18px;">✨ BẠN CÓ THỂ LÀM GÌ TIẾP THEO?</div>

  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
    <tr>
      <td width="25%" style="padding:6px;text-align:center;">
        <div style="background:#fff;border-radius:17px;padding:17px 8px;box-shadow:0 8px 18px rgba(97,71,180,.08);">
          <div style="font-size:27px;">🔎</div>
          <div style="font-size:13px;font-weight:800;margin-top:7px;">Tra cứu hồ sơ</div>
        </div>
      </td>
      <td width="25%" style="padding:6px;text-align:center;">
        <div style="background:#fff;border-radius:17px;padding:17px 8px;box-shadow:0 8px 18px rgba(97,71,180,.08);">
          <div style="font-size:27px;">✉</div>
          <div style="font-size:13px;font-weight:800;margin-top:7px;">Kiểm tra email</div>
        </div>
      </td>
      <td width="25%" style="padding:6px;text-align:center;">
        <div style="background:#fff;border-radius:17px;padding:17px 8px;box-shadow:0 8px 18px rgba(97,71,180,.08);">
          <div style="font-size:27px;">📅</div>
          <div style="font-size:13px;font-weight:800;margin-top:7px;">Theo dõi cập nhật</div>
        </div>
      </td>
      <td width="25%" style="padding:6px;text-align:center;">
        <div style="background:#fff;border-radius:17px;padding:17px 8px;box-shadow:0 8px 18px rgba(97,71,180,.08);">
          <div style="font-size:27px;">💬</div>
          <div style="font-size:13px;font-weight:800;margin-top:7px;">Liên hệ hỗ trợ</div>
        </div>
      </td>
    </tr>
  </table>

  <div style="text-align:center;margin-top:22px;">
    <a href="https://sfec.skyfirst.io.vn/#lookup"
       style="display:inline-block;text-decoration:none;color:#fff;font-weight:800;font-size:16px;background:linear-gradient(90deg,#654bff 0%,#df4898 62%,#ff8b35 100%);padding:15px 30px;border-radius:999px;">
       TRA CỨU HỒ SƠ NGAY →
    </a>
  </div>
</td></tr>
</table>
</td>
</tr>

<!-- IMPORTANT NOTE -->
<tr>
<td style="padding:18px 34px 28px;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#eff8ff;border-left:5px solid #1996ff;border-radius:18px;">
    <tr><td style="padding:20px 22px;">
      <div style="font-size:17px;font-weight:800;color:#174b9b;margin-bottom:10px;">💙 LƯU Ý</div>
      <div style="font-size:14px;line-height:1.75;color:#4f668b;">
        • Vui lòng kiểm tra email thường xuyên, bao gồm mục Spam/Junk.<br>
        • SFEC có thể liên hệ bằng email hoặc số điện thoại bạn đã cung cấp.<br>
        • Hãy giữ lại mã hồ sơ để thuận tiện khi tra cứu hoặc cần hỗ trợ.
      </div>
    </td></tr>
  </table>
</td>
</tr>

<!-- CONTACT -->
<tr>
<td style="padding:0 34px 30px;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#ffffff;border:1px solid #dce8ff;border-radius:20px;">
    <tr><td style="padding:22px;">
      <div style="font-size:17px;font-weight:800;color:#173b7a;margin-bottom:13px;">📬 KÊNH LIÊN HỆ SFEC</div>
      <div style="font-size:14px;line-height:1.9;color:#50698f;">
        <b>Email liên hệ chính:</b> <a href="mailto:sfec.englishclub@gmail.com" style="color:#0b63ce;text-decoration:none;">sfec.englishclub@gmail.com</a><br>
        <b>Văn phòng & hồ sơ:</b> <a href="mailto:sfec.vanphong@gmail.com" style="color:#0b63ce;text-decoration:none;">sfec.vanphong@gmail.com</a><br>
        <b>Facebook:</b> <a href="https://www.facebook.com/skyfirst.sfec" style="color:#0b63ce;text-decoration:none;">facebook.com/skyfirst.sfec</a><br>
        <b>Website:</b> <a href="https://sfec.skyfirst.io.vn" style="color:#0b63ce;text-decoration:none;">sfec.skyfirst.io.vn</a>
      </div>
    </td></tr>
  </table>
</td>
</tr>

<!-- FOOTER -->
<tr>
<td style="padding:28px 34px;background:linear-gradient(135deg,#05275b,#0b4da8 56%,#252f89);color:#fff;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0">
<tr>
  <td style="width:34%;vertical-align:middle;">
    <img src="https://sfec.skyfirst.io.vn/assets/logo-sfec-email.png" alt="SFEC" style="display:block;max-width:220px;width:100%;height:auto;">
  </td>
  <td style="vertical-align:middle;padding-left:22px;">
    <div style="font-size:18px;font-weight:800;">The Sky First English Club</div>
    <div style="font-size:13px;line-height:1.7;color:#d8e7ff;margin-top:7px;">Learn • Connect • Grow • Create Impact</div>
    <div style="font-size:13px;line-height:1.75;color:#d8e7ff;margin-top:11px;">
      Email tự động: sfec@skyfirst.io.vn<br>
      Liên hệ chính: sfec.englishclub@gmail.com<br>
      Văn phòng & hồ sơ: sfec.vanphong@gmail.com
    </div>
  </td>
</tr>
</table>

<div style="text-align:center;margin-top:22px;padding-top:18px;border-top:1px solid rgba(255,255,255,.18);font-size:12px;line-height:1.7;color:#d8e7ff;">
  Đây là email được gửi tự động từ <b>sfec@skyfirst.io.vn</b>. Vui lòng không phản hồi trực tiếp email này.<br>
  <a href="https://www.facebook.com/skyfirst.sfec" style="color:#ffffff;text-decoration:none;font-weight:700;">Facebook SFEC</a>
  &nbsp; • &nbsp;
  <a href="https://sfec.skyfirst.io.vn" style="color:#ffffff;text-decoration:none;font-weight:700;">Website SFEC</a><br>
  © 2026 Sky First Network · SFEC
</div>
</td>
</tr>

</table>
</td></tr>
</table>
</body>
</html>
',
    text_template='SFEC đã tiếp nhận hồ sơ {{code}} của {{full_name}}. Loại đăng ký: {{form_name}}. Trạng thái: {{status}}. Tra cứu: {{lookup_url}}. Liên hệ: sfec.englishclub@gmail.com | Văn phòng & hồ sơ: sfec.vanphong@gmail.com',
    enabled=1
WHERE key='submission_confirmation';

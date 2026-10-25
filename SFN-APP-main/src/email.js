import {renderTemplate, escapeHtml, extractTemplateVariables} from "./utils.js";

const EMAIL_BRAND_LOGO_URL = "https://app.skyfirst.io.vn/assets/sfn-logo-tight.png";

// Some email clients (including Gmail) reject data: images in HTML email.
// Replace only the embedded Sky First brand mark; keep other user-provided images untouched.
function normalizeEmailBrandLogo(html = "") {
  return String(html || "").replace(
    /(<img\b(?=[^>]*\balt=["']Sky First[^"']*["'])[^>]*?\bsrc=["'])data:image\/[^;]+;base64,[^"']*(["'])/gi,
    `$1${EMAIL_BRAND_LOGO_URL}$2`
  );
}

const ALLOWED_ATTACHMENT_MIMES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
]);

async function logEmail(env, to, templateKey, subject, status, messageId = "", error = "") {
  try {
    await env.DB.prepare(
      "INSERT INTO email_logs(to_email,template_key,subject,status,provider_message_id,error) VALUES(?,?,?,?,?,?)"
    )
      .bind(
        to,
        templateKey || "",
        subject || "",
        status,
        messageId || "",
        String(error || "").slice(0, 1500)
      )
      .run();
  } catch {}
}

async function isDuplicateRecentEmail(env, to, templateKey, subject) {
  if (!to || !templateKey || !env?.DB) return false;
  try {
    const row = await env.DB.prepare(
      "SELECT id FROM email_logs WHERE lower(to_email)=lower(?) AND template_key=? AND subject=? AND status IN ('sent','accepted_by_provider','pending') AND created_at > datetime('now','-60 seconds') LIMIT 1"
    )
      .bind(to, templateKey, subject || "")
      .first();
    return !!row;
  } catch {
    return false;
  }
}

export function sanitizeEmailAttachments(attachments = []) {
  if (!Array.isArray(attachments)) return [];
  const valid = [];
  for (const att of attachments) {
    if (!att || typeof att !== "object") continue;
    const filename = String(att.filename || "").trim();
    const content = att.content;
    const mime = String(att.content_type || att.mime || "application/pdf").trim().toLowerCase();
    if (!filename || !content) continue;
    if (!ALLOWED_ATTACHMENT_MIMES.has(mime)) continue;
    if (att.approved === false) continue;
    valid.push({
      filename,
      content: String(content),
      content_type: mime
    });
  }
  return valid;
}

export function buildDocumentLinksBlock(documents = [], lang = "vi") {
  if (!Array.isArray(documents) || !documents.length) {
    return {html: "", text: ""};
  }
  const itemsHtml = [];
  const itemsText = [];
  for (const doc of documents) {
    if (!doc || typeof doc !== "object") continue;
    const title = String(doc.title || doc.filename || "Tài liệu đính kèm").trim();
    const url = String(doc.url || doc.download_url || doc.preview_url || "").trim();
    if (!url || (!url.startsWith("https://") && !url.startsWith("http://") && !url.startsWith("/"))) continue;
    const fullUrl = url.startsWith("/") ? `https://app.skyfirst.io.vn${url}` : url;
    const codeLabel = doc.code ? ` (${escapeHtml(doc.code)})` : "";
    itemsHtml.push(
      `<li style="margin:4px 0;"><a href="${escapeHtml(fullUrl)}" style="color:#0877e8;text-decoration:none;font-weight:bold;">${escapeHtml(title)}</a>${codeLabel}</li>`
    );
    itemsText.push(`- ${title}${doc.code ? ` (${doc.code})` : ""}: ${fullUrl}`);
  }
  if (!itemsHtml.length) return {html: "", text: ""};
  const heading = lang === "en" ? "Related Documents (Access-Controlled):" : "Tài liệu liên quan (Kiểm soát quyền truy cập):";
  return {
    html: `<div style="margin-top:14px;padding:12px 15px;border:1px solid #dbeafe;border-radius:8px;background:#f8fbff;"><div style="font-size:13px;font-weight:bold;color:#12325b;margin-bottom:6px;">${heading}</div><ul style="margin:0;padding-left:18px;font-size:13px;color:#334155;">${itemsHtml.join("")}</ul></div>`,
    text: `\n${heading}\n${itemsText.join("\n")}`
  };
}

export async function sendEmail(
  env,
  {to, subject, html, text, templateKey = "", skipDedupe = false, attachments = []}
) {
  if (!to || !String(to).includes("@")) {
    return {ok: false, error: "MISSING_OR_INVALID_RECIPIENT"};
  }
  if (!skipDedupe && (await isDuplicateRecentEmail(env, to, templateKey, subject))) {
    return {ok: true, deduped: true, delivery_state: "deduped"};
  }
  const fromAddr = env.MAIL_FROM || "Hệ thống Thông tin Số Sky First <app@skyfirst.io.vn>";
  const replyTo = env.MAIL_SUPPORT || "support@skyfirst.io.vn";
  const safeAttachments = sanitizeEmailAttachments(attachments);

  try {
    // 1) Resend API
    if (env.RESEND_API_KEY) {
      const payload = {
        from: fromAddr,
        reply_to: replyTo,
        to: [to],
        subject,
        html,
        text
      };
      if (safeAttachments.length) {
        payload.attachments = safeAttachments.map((a) => ({
          filename: a.filename,
          content: a.content,
          content_type: a.content_type
        }));
      }
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${env.RESEND_API_KEY}`
        },
        body: JSON.stringify(payload)
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.message || `Resend HTTP ${r.status}`);
      await logEmail(env, to, templateKey, subject, "sent", data?.id || "", "");
      return {
        ok: true,
        id: data?.id || "",
        status: "sent",
        delivery_state: "accepted_by_provider"
      };
    }

    // 2) Cloudflare Email Service binding
    if (env.EMAIL?.send) {
      const result = await env.EMAIL.send({
        to,
        from: fromAddr,
        subject,
        html,
        text,
        attachments: safeAttachments.length ? safeAttachments : undefined
      });
      await logEmail(env, to, templateKey, subject, "sent", result?.messageId || "", "");
      return {
        ok: true,
        id: result?.messageId || "",
        status: "sent",
        delivery_state: "accepted_by_provider"
      };
    }

    await logEmail(
      env,
      to,
      templateKey,
      subject,
      "pending",
      "",
      "Email provider chưa được cấu hình (cần RESEND_API_KEY hoặc EMAIL binding)."
    );
    return {
      ok: false,
      pending: true,
      status: "pending",
      delivery_state: "pending_provider_config",
      error: "EMAIL_PROVIDER_NOT_CONFIGURED"
    };
  } catch (err) {
    await logEmail(env, to, templateKey, subject, "failed", "", err?.message || String(err));
    return {
      ok: false,
      status: "failed",
      delivery_state: "failed",
      error: err?.message || String(err)
    };
  }
}

function getUniversalDefaultsForKey(key = "", vars = {}, lang = "vi") {
  const isEn = lang === "en";
  const nowStr = new Intl.DateTimeFormat(isEn ? "en-GB" : "vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(new Date());

  const code =
    vars.REQUEST_ID ||
    vars.code ||
    vars.application_code ||
    vars.APPLICATION_ID ||
    vars.certificate_code ||
    vars.ticket_code ||
    vars.campaign_code ||
    "SFN-REF";
  const regType =
    vars.REGISTRATION_TYPE ||
    vars.form_name ||
    vars.program_name ||
    vars.APPLICATION_TYPE ||
    vars.cert_type ||
    vars.subject ||
    vars.campaign_title ||
    (isEn ? "Sky First Digital Service" : "Dịch vụ Số Sky First");
  const submittedAt = vars.SUBMITTED_AT || vars.submitted_at || vars.issued_at || nowStr;
  const status = vars.STATUS || vars.status || (isEn ? "Received" : "Đã tiếp nhận");
  const appUrl = "https://app.skyfirst.io.vn";

  const defaultsByKey = {
    submission_confirmation: {
      EMAIL_CATEGORY: isEn ? "SUBMISSION CONFIRMATION" : "XÁC NHẬN GỬI BIỂU MẪU",
      EMAIL_HEADING: isEn ? "Application Received Successfully" : "Xác nhận tiếp nhận hồ sơ",
      INTRO_TEXT: isEn
        ? "Sky First Digital Information System has received your submission. Please keep your reference ID below to track processing status."
        : "Hệ thống Thông tin Số Sky First xác nhận đã tiếp nhận hồ sơ của bạn. Vui lòng lưu lại mã hồ sơ dưới đây để tra cứu tiến trình xử lý.",
      ADDITIONAL_INFO: vars.email || (isEn ? "Recorded on Sky First D1" : "Đã ghi nhận trên Hệ thống Thông tin Số Sky First"),
      BODY_HTML:
        vars.BODY_HTML ||
        `${vars.PROFILE_IMAGE_BLOCK || ""}${
          isEn
            ? "<p style=\"margin:0;\">Your submission is now in the review queue. We will notify you automatically when its status is updated.</p>"
            : "<p style=\"margin:0;\">Hồ sơ của bạn đã được đưa vào quy trình rà soát. Hệ thống sẽ tự động gửi thông báo khi có cập nhật trạng thái mới.</p>"
        }`,
      NEXT_STEPS:
        vars.NEXT_STEPS ||
        (isEn
          ? "Next step: Use your Application ID and registered email to look up status online."
          : "Bước tiếp theo: Sử dụng mã hồ sơ và email đã đăng ký để tra cứu tiến trình trực tuyến."),
      ACTION_URL: `${appUrl}/ho-so?code=${encodeURIComponent(code)}`,
      ACTION_LABEL: isEn ? "TRACK APPLICATION" : "TRA CỨU HỒ SƠ"
    },
    registration_confirmation: {
      EMAIL_CATEGORY: isEn ? "PROGRAM & EVENT REGISTRATION" : "TIẾP NHẬN ĐĂNG KÝ CHƯƠNG TRÌNH / SỰ KIỆN",
      EMAIL_HEADING: isEn ? "Registration Confirmed" : "Xác nhận đăng ký tham gia",
      INTRO_TEXT: isEn
        ? `Thank you for registering for ${regType} on the Sky First Digital Information System.`
        : `Cảm ơn bạn đã đăng ký tham gia ${regType} trên Hệ thống Thông tin Số Sky First.`,
      ADDITIONAL_INFO: vars.email || (isEn ? "Program / Event Registration" : "Đăng ký chương trình / sự kiện"),
      BODY_HTML:
        vars.BODY_HTML ||
        `${vars.PROFILE_IMAGE_BLOCK || ""}${
          isEn
            ? "<p style=\"margin:0;\">Our organizing team will review your registration and send schedule updates via email.</p>"
            : "<p style=\"margin:0;\">Ban Tổ chức sẽ rà soát thông tin đăng ký và gửi thông báo lịch trình chi tiết qua email.</p>"
        }`,
      NEXT_STEPS:
        vars.NEXT_STEPS ||
        (isEn
          ? "Next step: Monitor your email and check your registration status on the portal."
          : "Bước tiếp theo: Theo dõi hộp thư điện tử và tra cứu trạng thái hồ sơ trên hệ thống."),
      ACTION_URL: `${appUrl}/ho-so?code=${encodeURIComponent(code)}`,
      ACTION_LABEL: isEn ? "VIEW REGISTRATION STATUS" : "THEO DÕI TRẠNG THÁI"
    },
    information_required: {
      EMAIL_CATEGORY: isEn ? "ADDITIONAL INFORMATION REQUIRED" : "YÊU CẦU BỔ SUNG THÔNG TIN",
      EMAIL_HEADING: isEn ? "Action Required: Additional Information Needed" : "Yêu cầu bổ sung thông tin hồ sơ",
      INTRO_TEXT: isEn
        ? `Our review team has checked application ${code} and requests additional clarification or documents.`
        : `Bộ phận xử lý đã rà soát hồ sơ ${code} và đề nghị bạn bổ sung hoặc làm rõ thêm thông tin.`,
      ADDITIONAL_INFO: vars.requirement_note || (isEn ? "Please check the note below" : "Vui lòng xem nội dung yêu cầu chi tiết bên dưới"),
      BODY_HTML:
        vars.BODY_HTML ||
        `<div style="padding:14px 16px;border-radius:8px;background:#fff8eb;border:1px solid #f0d8a8;color:#6e4700;"><strong>${
          isEn ? "Requirement Note:" : "Nội dung cần bổ sung:"
        }</strong><br>${escapeHtml(vars.requirement_note || "Vui lòng kiểm tra thông tin hồ sơ trên hệ thống.")}</div>`,
      NEXT_STEPS:
        vars.NEXT_STEPS ||
        (isEn
          ? "Security Notice: Sky First never asks for your password or OTP via email."
          : "Lưu ý an toàn: Hệ thống không bao giờ yêu cầu cung cấp mật khẩu hoặc mã xác thực cá nhân qua email."),
      ACTION_URL: `${appUrl}/ho-so?code=${encodeURIComponent(code)}`,
      ACTION_LABEL: isEn ? "UPDATE APPLICATION" : "KIỂM TRA & BỔ SUNG HỒ SƠ"
    },
    status_update: {
      EMAIL_CATEGORY: isEn ? "STATUS UPDATE" : "CẬP NHẬT TRẠNG THÁI HỒ SƠ",
      EMAIL_HEADING: isEn ? "Application Status Updated" : "Cập nhật trạng thái xử lý hồ sơ",
      INTRO_TEXT: isEn
        ? `Your application ${code} has been updated to status: ${status}.`
        : `Hồ sơ mã ${code} của bạn vừa được cập nhật sang trạng thái: ${status}.`,
      ADDITIONAL_INFO: vars.note || vars.result_summary || (isEn ? "In-progress update" : "Cập nhật tiến trình xử lý"),
      BODY_HTML:
        vars.BODY_HTML ||
        `${vars.note_block || (vars.note ? `<p style="margin:0;">${escapeHtml(vars.note)}</p>` : "")}`,
      NEXT_STEPS:
        vars.NEXT_STEPS ||
        (isEn
          ? "You can view the full processing timeline using your Application ID and email."
          : "Bạn có thể dùng mã hồ sơ và địa chỉ email đã đăng ký để xem chi tiết tiến trình xử lý trên hệ thống."),
      ACTION_URL: `${appUrl}/ho-so?code=${encodeURIComponent(code)}`,
      ACTION_LABEL: isEn ? "VIEW TIMELINE" : "XEM TIẾN TRÌNH HỒ SƠ"
    },
    application_result: {
      EMAIL_CATEGORY: isEn ? "APPROVAL / PROCESSING RESULT" : "THÔNG BÁO PHÊ DUYỆT / KẾT QUẢ XỬ LÝ",
      EMAIL_HEADING: isEn ? "Official Application Result" : "Kết quả xử lý hồ sơ chính thức",
      INTRO_TEXT: isEn
        ? `Sky First Digital Information System announces the official processing result for application ${code}.`
        : `Hệ thống Thông tin Số Sky First thông báo kết quả xử lý chính thức đối với hồ sơ ${code}.`,
      ADDITIONAL_INFO: vars.result_summary || status,
      BODY_HTML:
        vars.BODY_HTML ||
        `<div style="padding:14px 16px;border-radius:8px;background:#eef8f3;border:1px solid #c5e7d5;color:#145937;"><strong>${
          isEn ? "Result Summary:" : "Tóm tắt kết quả:"
        }</strong> ${escapeHtml(vars.result_summary || status)}</div>`,
      NEXT_STEPS:
        vars.NEXT_STEPS ||
        (isEn
          ? "Please visit the lookup portal for detailed instructions on next steps."
          : "Vui lòng truy cập trang tra cứu hồ sơ để xem hướng dẫn chi tiết các bước tiếp theo."),
      ACTION_URL: `${appUrl}/ho-so?code=${encodeURIComponent(code)}`,
      ACTION_LABEL: isEn ? "VIEW RESULT" : "TRA CỨU KẾT QUẢ"
    },
    certificate_issued: {
      EMAIL_CATEGORY: isEn ? "CREDENTIAL & DOCUMENT ISSUANCE" : "PHÁT HÀNH CHỨNG NHẬN / TÀI LIỆU",
      EMAIL_HEADING: isEn ? "Official Credential Issued" : "Chứng nhận đã được phát hành chính thức",
      INTRO_TEXT: isEn
        ? `Your ${vars.cert_type || "Certificate"} (${code}) has been approved and officially issued on Sky First Digital Information System.`
        : `${vars.cert_type || "Chứng nhận"} của bạn (Mã: ${code}) đã được phê duyệt và phát hành chính thức trên Hệ thống Thông tin Số Sky First.`,
      ADDITIONAL_INFO: vars.content || (isEn ? "Publicly verifiable credential" : "Bản ghi có hiệu lực xác thực trực tuyến"),
      BODY_HTML:
        vars.BODY_HTML ||
        `<p style="margin:0;"><strong>${isEn ? "Content:" : "Nội dung ghi nhận:"}</strong> ${escapeHtml(
          vars.content || "Hoàn thành chương trình / hoạt động tại Sky First."
        )}</p>`,
      NEXT_STEPS:
        vars.NEXT_STEPS ||
        (isEn
          ? "Anyone can verify the validity of this credential online using the lookup code below."
          : "Bạn hoặc đơn vị đối chiếu có thể xác thực trực tuyến tính hợp lệ của chứng nhận thông qua nút bên dưới."),
      ACTION_URL: vars.certificate_url || `${appUrl}/gcn/${encodeURIComponent(code)}`,
      ACTION_LABEL: isEn ? "VERIFY CREDENTIAL" : "XÁC THỰC CHỨNG NHẬN"
    },
    certificate_revoked: {
      EMAIL_CATEGORY: isEn ? "CREDENTIAL REVOCATION / REPLACEMENT" : "THÔNG BÁO THU HỒI / THAY THẾ BẢN GHI",
      EMAIL_HEADING: isEn ? "Credential Status Change Notice" : "Thông báo cập nhật trạng thái hiệu lực chứng nhận",
      INTRO_TEXT: isEn
        ? `The status of credential ${code} has been updated in the Sky First Digital Information System registry.`
        : `Bản ghi chứng nhận mã ${code} đã được cập nhật trạng thái hiệu lực trong cơ sở dữ liệu Hệ thống Thông tin Số Sky First.`,
      ADDITIONAL_INFO: vars.revocation_reason || vars.note || (isEn ? "Status updated by authorized administrator" : "Cập nhật bởi quản trị viên có thẩm quyền"),
      BODY_HTML:
        vars.BODY_HTML ||
        `<div style="padding:14px 16px;border-radius:8px;background:#fef2f2;border:1px solid #fecaca;color:#991b1b;"><strong>${
          isEn ? "Reason / Note:" : "Lý do / Ghi chú:"
        }</strong> ${escapeHtml(vars.revocation_reason || vars.note || "Thu hồi / thay thế theo quyết định quản trị.")}${
          vars.replacement_code ? `<br><strong>Mã bản ghi thay thế:</strong> ${escapeHtml(vars.replacement_code)}` : ""
        }</div>`,
      NEXT_STEPS:
        vars.NEXT_STEPS ||
        (isEn
          ? "If you have questions regarding this record update, please contact support@skyfirst.io.vn."
          : "Nếu cần đối soát hoặc giải đáp về trạng thái bản ghi, vui lòng liên hệ support@skyfirst.io.vn."),
      ACTION_URL: vars.certificate_url || `${appUrl}/gcn/${encodeURIComponent(code)}`,
      ACTION_LABEL: isEn ? "CHECK RECORD STATUS" : "KIỂM TRA TRẠNG THÁI BẢN GHI"
    },
    interview_scheduled: {
      EMAIL_CATEGORY: isEn ? "SCHEDULE & DEADLINE NOTICE" : "THÔNG BÁO LỊCH & THỜI HẠN",
      EMAIL_HEADING: isEn ? "Interview / Activity Schedule Notice" : "Thông báo lịch phỏng vấn / làm việc",
      INTRO_TEXT: isEn
        ? `An interview or working session has been scheduled for your application ${code}.`
        : `Hệ thống Thông tin Số Sky First thông báo lịch phỏng vấn / trao đổi đối với hồ sơ ${code}.`,
      ADDITIONAL_INFO: vars.scheduled_at || submittedAt,
      BODY_HTML:
        vars.BODY_HTML ||
        `<p style="margin:0;"><strong>${isEn ? "Time:" : "Thời gian dự kiến:"}</strong> ${escapeHtml(
          vars.scheduled_at || submittedAt
        )}<br><strong>${isEn ? "Note:" : "Ghi chú:"}</strong> ${escapeHtml(vars.notes || "Vui lòng tham dự đúng giờ.")}</p>`,
      NEXT_STEPS:
        vars.NEXT_STEPS ||
        (isEn
          ? "Please confirm your attendance or contact support if you need to reschedule."
          : "Vui lòng chuẩn bị đầy đủ thông tin và truy cập đường dẫn họp trực tuyến đúng thời gian quy định."),
      ACTION_URL: vars.meeting_url || `${appUrl}/ho-so?code=${encodeURIComponent(code)}`,
      ACTION_LABEL: isEn ? "JOIN / VIEW SCHEDULE" : "XEM CHI TIẾT LỊCH HẸN"
    },
    support_ticket_received: {
      EMAIL_CATEGORY: isEn ? "SUPPORT & SAFETY CENTER" : "TIẾP NHẬN YÊU CẦU HỖ TRỢ",
      EMAIL_HEADING: isEn ? "Support Request Received" : "Đã tiếp nhận yêu cầu hỗ trợ",
      INTRO_TEXT: isEn
        ? `Your support or safety report (${code}) has been logged by the Sky First Digital Information System.`
        : `Hệ thống Thông tin Số Sky First đã ghi nhận yêu cầu hỗ trợ / báo cáo của bạn với mã tham chiếu ${code}.`,
      ADDITIONAL_INFO: vars.subject || regType,
      BODY_HTML:
        vars.BODY_HTML ||
        `<p style="margin:0;">${
          isEn
            ? "Our support team will review and respond via email as soon as possible."
            : "Đội ngũ hỗ trợ sẽ kiểm tra thông tin và phản hồi qua địa chỉ email này trong thời gian sớm nhất."
        }</p>`,
      NEXT_STEPS:
        vars.NEXT_STEPS ||
        (isEn
          ? "Please keep your Reference ID for future correspondence."
          : "Vui lòng lưu mã tham chiếu để đối soát khi liên hệ bộ phận hỗ trợ."),
      ACTION_URL: `${appUrl}/an-toan`,
      ACTION_LABEL: isEn ? "SAFETY & SUPPORT CENTER" : "TRUNG TÂM AN TOÀN & HỖ TRỢ"
    },
    support_ticket_reply: {
      EMAIL_CATEGORY: isEn ? "SUPPORT RESPONSE" : "PHẢN HỒI YÊU CẦU HỖ TRỢ",
      EMAIL_HEADING: isEn ? "Update on Your Support Request" : "Phản hồi yêu cầu hỗ trợ từ Sky First",
      INTRO_TEXT: isEn
        ? `Our team has responded to your support request ${code}.`
        : `Bộ phận Hỗ trợ Hệ thống Thông tin Số Sky First vừa cập nhật phản hồi cho yêu cầu ${code}.`,
      ADDITIONAL_INFO: vars.subject || status,
      BODY_HTML:
        vars.BODY_HTML ||
        `<div style="padding:14px 16px;border-radius:8px;background:#f8fbff;border:1px solid #dbeafe;color:#1e3a8a;"><strong>${
          isEn ? "Support Reply:" : "Nội dung phản hồi:"
        }</strong><br>${escapeHtml(vars.reply_message || vars.note || "Yêu cầu của bạn đã được xử lý.")}</div>`,
      NEXT_STEPS:
        vars.NEXT_STEPS ||
        (isEn
          ? "If you need further assistance, please contact support@skyfirst.io.vn or call 0924 910 210."
          : "Nếu cần hỗ trợ thêm, vui lòng liên hệ support@skyfirst.io.vn hoặc gọi hotline 0924 910 210."),
      ACTION_URL: `${appUrl}/an-toan`,
      ACTION_LABEL: isEn ? "SUPPORT CENTER" : "TRUY CẬP TRUNG TÂM HỖ TRỢ"
    },
    account_invite: {
      EMAIL_CATEGORY: isEn ? "ADMINISTRATOR ACCOUNT" : "THÔNG BÁO QUẢN TRỊ VIÊN",
      EMAIL_HEADING: isEn ? "Administrator Account Notification" : "Thông báo kích hoạt tài khoản quản trị",
      INTRO_TEXT: isEn
        ? `An administrator account has been provisioned or updated for ${vars.email || "your email"} on Sky First Digital Information System.`
        : `Tài khoản quản trị gắn với địa chỉ ${vars.email || "của bạn"} trên Hệ thống Thông tin Số Sky First đã được khởi tạo hoặc cập nhật.`,
      ADDITIONAL_INFO: vars.email || "app.skyfirst.io.vn",
      BODY_HTML:
        vars.BODY_HTML ||
        `<p style="margin:0;">${
          isEn
            ? "For security reasons, passwords are never sent in plain text via email. Please use the secure activation link below or contact the Super Admin to receive your temporary credentials."
            : "Vì lý do bảo mật, hệ thống không gửi mật khẩu trực tiếp qua email. Vui lòng nhấn vào nút kích hoạt bảo mật bên dưới hoặc liên hệ Quản trị viên cấp cao để nhận thông tin đăng nhập lần đầu."
        }</p>`,
      NEXT_STEPS:
        vars.NEXT_STEPS ||
        (isEn
          ? "You will be required to set a strong personal password upon first login."
          : "Liên kết kích hoạt chỉ sử dụng một lần và có thời hạn bảo mật."),
      ACTION_URL: vars.activation_link || `${appUrl}/admin/login`,
      ACTION_LABEL: isEn ? "ACTIVATE / SIGN IN" : "KÍCH HOẠT TÀI KHOẢN"
    },
    password_reset: {
      EMAIL_CATEGORY: isEn ? "ACCOUNT SECURITY" : "AN TOÀN TÀI KHOẢN QUẢN TRỊ",
      EMAIL_HEADING: isEn ? "Password Reset Assistance" : "Hướng dẫn đặt lại mật khẩu quản trị",
      INTRO_TEXT: isEn
        ? "We received a password reset request for your account on Sky First Digital Information System."
        : "Hệ thống ghi nhận yêu cầu hỗ trợ đặt lại mật khẩu cho tài khoản của bạn trên Hệ thống Thông tin Số Sky First.",
      ADDITIONAL_INFO: vars.email || "support@skyfirst.io.vn",
      BODY_HTML:
        vars.BODY_HTML ||
        `<p style="margin:0;">${
          isEn
            ? "If an administrator issued a reset link for you, click the button below within 30 minutes. Otherwise, please contact the System Administrator via support@skyfirst.io.vn or hotline 0924 910 210 for verified password reset assistance."
            : "Nếu bạn nhận được liên kết đặt lại mật khẩu có thời hạn (30 phút), vui lòng nhấn vào nút bên dưới để thiết lập mật khẩu mới. Trường hợp cần Quản trị viên hỗ trợ trực tiếp, vui lòng liên hệ support@skyfirst.io.vn hoặc hotline 0924 910 210."
        }</p>`,
      NEXT_STEPS:
        vars.NEXT_STEPS ||
        (isEn
          ? "If you did not request this action, please ignore this email."
          : "Nếu không phải bạn thực hiện yêu cầu này, vui lòng bỏ qua email và thông báo cho bộ phận an toàn số."),
      ACTION_URL: vars.link || `${appUrl}/admin/login`,
      ACTION_LABEL: isEn ? "RESET PASSWORD" : "ĐẶT LẠI MẬT KHẨU"
    },
    verify_email: {
      EMAIL_CATEGORY: isEn ? "EMAIL VERIFICATION" : "XÁC MINH ĐỊA CHỈ EMAIL",
      EMAIL_HEADING: isEn ? "Verify Your Email Address" : "Xác minh địa chỉ email tài khoản",
      INTRO_TEXT: isEn
        ? "Please verify your email address on Sky First Digital Information System."
        : "Vui lòng xác minh địa chỉ email của bạn trên Hệ thống Thông tin Số Sky First.",
      ADDITIONAL_INFO: vars.email || "",
      BODY_HTML:
        vars.BODY_HTML ||
        `<p style="margin:0;">${
          isEn
            ? "Click the button below within 24 hours to complete email verification."
            : "Nhấn vào nút bên dưới trong vòng 24 giờ để hoàn tất xác minh địa chỉ email."
        }</p>`,
      NEXT_STEPS:
        vars.NEXT_STEPS ||
        (isEn ? "Verification links are single-use." : "Liên kết xác minh chỉ có hiệu lực một lần."),
      ACTION_URL: vars.link || appUrl,
      ACTION_LABEL: isEn ? "VERIFY EMAIL" : "XÁC MINH EMAIL"
    },
    submission_internal: {
      EMAIL_CATEGORY: isEn ? "ADMIN NOTIFICATION" : "THÔNG BÁO QUẢN TRỊ VIÊN",
      EMAIL_HEADING: isEn ? `New Submission: ${code}` : `Hồ sơ mới tiếp nhận: ${code}`,
      INTRO_TEXT: isEn
        ? `A new submission (${regType}) was submitted by ${vars.full_name || "Applicant"} (${vars.email || "N/A"}).`
        : `Hệ thống vừa tiếp nhận hồ sơ mới (${regType}) từ ${vars.full_name || "Người gửi"} (${vars.email || "Không có email"}).`,
      ADDITIONAL_INFO: `${vars.full_name || ""} · ${vars.email || ""}`,
      BODY_HTML:
        vars.BODY_HTML ||
        `${vars.PROFILE_IMAGE_BLOCK || ""}<div style="margin-top:10px;">${vars.answers_table || ""}</div>`,
      NEXT_STEPS:
        vars.NEXT_STEPS ||
        (isEn
          ? "Sign in to Super Admin to review, assign, and process this submission."
          : "Đăng nhập Hệ thống Quản trị Tập trung (Super Admin) để phân công và xử lý hồ sơ."),
      ACTION_URL: `${appUrl}/admin`,
      ACTION_LABEL: isEn ? "OPEN SUPER ADMIN" : "MỞ HỆ THỐNG QUẢN TRỊ"
    },
    document_published: {
      EMAIL_CATEGORY: isEn ? "DOCUMENT & LIBRARY RELEASE" : "PHÁT HÀNH TÀI LIỆU SỐ",
      EMAIL_HEADING: isEn ? "Official Document Published" : "Thông báo phát hành tài liệu mới",
      INTRO_TEXT: isEn
        ? `Document "${vars.title || regType}" (${code}) has been published on the Sky First Digital Information System.`
        : `Tài liệu "${vars.title || regType}" (Mã: ${code}) đã được phê duyệt và công bố trên Hệ thống Thông tin Số Sky First.`,
      ADDITIONAL_INFO: vars.category || vars.doc_type || (isEn ? "Official Digital Resource" : "Tài liệu chính thức"),
      BODY_HTML:
        vars.BODY_HTML ||
        `<p style="margin:0;"><strong>${isEn ? "Document:" : "Tên tài liệu:"}</strong> ${escapeHtml(
          vars.title || regType
        )}<br><strong>${isEn ? "Code:" : "Mã tài liệu:"}</strong> ${escapeHtml(code)}</p>`,
      NEXT_STEPS:
        vars.NEXT_STEPS ||
        (isEn
          ? "You can preview or download this document online via the Digital Library."
          : "Bạn có thể xem trực tuyến hoặc tải xuống tài liệu tại Thư viện Tài liệu số."),
      ACTION_URL: vars.document_url || `${appUrl}/tai-lieu`,
      ACTION_LABEL: isEn ? "OPEN DIGITAL LIBRARY" : "MỞ THƯ VIỆN TÀI LIỆU"
    },
    fundraising_update: {
      EMAIL_CATEGORY: isEn ? "SPONSORSHIP TRANSPARENCY" : "CẬP NHẬT MINH BẠCH TÀI TRỢ",
      EMAIL_HEADING: isEn ? "Sponsorship Campaign Update" : "Thông báo cập nhật chương trình tài trợ",
      INTRO_TEXT: isEn
        ? `Campaign ${vars.campaign_title || regType} (${code}) has been updated with verified financial reconciliation data.`
        : `Chương trình tài trợ ${vars.campaign_title || regType} (Mã: ${code}) vừa được cập nhật số liệu đối soát công khai.`,
      ADDITIONAL_INFO: `Cam kết: ${vars.pledged_amount || "0"} · Thực nhận: ${vars.received_amount || "0"}`,
      BODY_HTML:
        vars.BODY_HTML ||
        `<p style="margin:0;"><strong>Mục tiêu:</strong> ${escapeHtml(vars.target_amount || "0")} | <strong>Cam kết:</strong> ${escapeHtml(
          vars.pledged_amount || "0"
        )} | <strong>Thực nhận:</strong> ${escapeHtml(vars.received_amount || "0")}</p>`,
      NEXT_STEPS:
        vars.NEXT_STEPS ||
        (isEn
          ? "View verified transactions and financial reports on the Sponsorship Transparency page."
          : "Xem chi tiết giao dịch đối soát và báo cáo PDF tại chuyên trang Minh bạch Tài trợ."),
      ACTION_URL: `${appUrl}/tai-tro`,
      ACTION_LABEL: isEn ? "VIEW SPONSORSHIP PAGE" : "XEM TRANG MINH BẠCH TÀI TRỢ"
    }
  };

  const chosen = defaultsByKey[key] || {
    EMAIL_CATEGORY: vars.EMAIL_CATEGORY || (isEn ? "SYSTEM NOTIFICATION" : "THÔNG BÁO HỆ THỐNG"),
    EMAIL_HEADING: vars.EMAIL_HEADING || regType,
    INTRO_TEXT:
      vars.INTRO_TEXT ||
      (isEn
        ? "You have a new notification from Sky First Digital Information System."
        : "Bạn có thông báo mới từ Hệ thống Thông tin Số Sky First."),
    ADDITIONAL_INFO: vars.ADDITIONAL_INFO || vars.content || vars.subject || "Sky First",
    BODY_HTML: vars.BODY_HTML || vars.note_block || "",
    NEXT_STEPS:
      vars.NEXT_STEPS ||
      (isEn
        ? "Visit https://app.skyfirst.io.vn for details."
        : "Truy cập https://app.skyfirst.io.vn để xem chi tiết."),
    ACTION_URL: vars.ACTION_URL || appUrl,
    ACTION_LABEL: vars.ACTION_LABEL || (isEn ? "OPEN PORTAL" : "TRUY CẬP HỆ THỐNG")
  };

  return {
    PREHEADER: vars.PREHEADER || `${chosen.EMAIL_CATEGORY} — ${chosen.EMAIL_HEADING} (${code})`,
    EMAIL_CATEGORY: chosen.EMAIL_CATEGORY,
    EMAIL_HEADING: chosen.EMAIL_HEADING,
    RECIPIENT_NAME: vars.RECIPIENT_NAME || vars.recipient_name || vars.full_name || vars.FULL_NAME || (isEn ? "Valued User" : "Quý khách"),
    INTRO_TEXT: chosen.INTRO_TEXT,
    REQUEST_ID: code,
    REGISTRATION_TYPE: regType,
    SUBMITTED_AT: submittedAt,
    STATUS: status,
    ADDITIONAL_INFO: chosen.ADDITIONAL_INFO,
    BODY_HTML: chosen.BODY_HTML,
    NEXT_STEPS: chosen.NEXT_STEPS,
    ACTION_URL: chosen.ACTION_URL,
    ACTION_LABEL: chosen.ACTION_LABEL
  };
}

export function renderEmailContent(row, vars = {}) {
  const lang = String(vars.lang || row?.lang || "vi").toLowerCase() === "en" ? "en" : "vi";
  // Tuyệt đối không đưa mật khẩu thuần hoặc bí mật xác thực vào biến email
  const cleanVars = {...vars};
  delete cleanVars.password;
  delete cleanVars.password_hash;
  delete cleanVars.password_salt;
  delete cleanVars.totp_secret;
  if ("temp_password" in cleanVars) {
    cleanVars.temp_password = "[Được cấp qua kênh xác thực quản trị an toàn]";
  }

  const docLinks = buildDocumentLinksBlock(cleanVars.documents || cleanVars.attachment_links || [], lang);
  const universalDefaults = getUniversalDefaultsForKey(row?.key || cleanVars.template_key || "", cleanVars, lang);

  const combinedBodyHtml = [
    cleanVars.BODY_HTML ?? universalDefaults.BODY_HTML,
    docLinks.html
  ]
    .filter(Boolean)
    .join("");

  const safeVars = {
    support_email: "support@skyfirst.io.vn",
    contact_email: "lienhe@skyfirst.io.vn",
    system_email: "app@skyfirst.io.vn",
    hotline: "0924 910 210",
    ...universalDefaults,
    ...cleanVars,
    BODY_HTML: combinedBodyHtml,
    ATTACHMENT_LINKS_HTML: docLinks.html,
    attachment_links_html: docLinks.html,
    attachment_links_text: docLinks.text
  };

  const rawKeys = new Set([
    "BODY_HTML",
    "body_html",
    "PROFILE_IMAGE_BLOCK",
    "answers_table",
    "note_block",
    "ATTACHMENT_LINKS_HTML",
    "attachment_links_html"
  ]);

  const subject = renderTemplate(row?.subject_template || "Thông báo từ Hệ thống Thông tin Số Sky First", safeVars, {
    htmlEscape: false
  });
  const html = normalizeEmailBrandLogo(renderTemplate(row?.html_template || "", safeVars, {
    htmlEscape: true,
    rawKeys
  }));

  let textOut = renderTemplate(row?.text_template || "", safeVars, {htmlEscape: false});
  if (!textOut.trim()) {
    textOut = [
      `${safeVars.EMAIL_CATEGORY} — ${safeVars.EMAIL_HEADING}`,
      `Xin chào ${safeVars.RECIPIENT_NAME},`,
      safeVars.INTRO_TEXT,
      `Mã hồ sơ / tham chiếu: ${safeVars.REQUEST_ID}`,
      `Nội dung: ${safeVars.REGISTRATION_TYPE}`,
      `Thời điểm: ${safeVars.SUBMITTED_AT}`,
      `Trạng thái: ${safeVars.STATUS}`,
      `Thông tin bổ sung: ${safeVars.ADDITIONAL_INFO}`,
      safeVars.NEXT_STEPS,
      `Liên kết: ${safeVars.ACTION_URL}`,
      docLinks.text,
      `Hỗ trợ: support@skyfirst.io.vn | Hotline: 0924 910 210`,
      `© 2026 Hệ thống Thông tin Số Sky First. Bảo lưu mọi quyền.`
    ]
      .filter(Boolean)
      .join("\n");
  } else if (docLinks.text && !textOut.includes(docLinks.text)) {
    textOut += "\n" + docLinks.text;
  }

  return {
    subject,
    html,
    text: textOut,
    variables_used: extractTemplateVariables(row?.html_template || "")
  };
}

export async function sendTemplatedEmail(env, key, to, vars = {}, options = {}) {
  const row = await env.DB.prepare("SELECT * FROM email_templates WHERE key=? AND enabled=1").bind(key).first();
  if (!row) return {ok: false, error: "TEMPLATE_NOT_FOUND"};
  const rendered = renderEmailContent(row, {...vars, template_key: key});
  return sendEmail(env, {
    to,
    templateKey: key,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    skipDedupe: !!options.skipDedupe,
    attachments: options.attachments || vars.attachments || []
  });
}

export function answersToEmail(answers = {}) {
  const rows = [],
    text = [];
  for (const [k, v] of Object.entries(answers)) {
    const value = Array.isArray(v)
      ? v.join(", ")
      : typeof v === "object"
        ? JSON.stringify(v)
        : String(v ?? "");
    rows.push(
      `<tr><td style="padding:7px;border:1px solid #d8e1ec"><b>${escapeHtml(k)}</b></td><td style="padding:7px;border:1px solid #d8e1ec">${escapeHtml(value)}</td></tr>`
    );
    text.push(`${k}: ${value}`);
  }
  return {
    answers_table: `<table style="border-collapse:collapse;width:100%">${rows.join("")}</table>`,
    answers_text: text.join("\n")
  };
}

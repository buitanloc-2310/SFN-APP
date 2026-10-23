import {renderTemplate, escapeHtml} from "./utils.js";

async function logEmail(env,to,templateKey,subject,status,messageId="",error=""){
  try{
    await env.DB.prepare("INSERT INTO email_logs(to_email,template_key,subject,status,provider_message_id,error) VALUES(?,?,?,?,?,?)")
      .bind(to,templateKey||"",subject||"",status,messageId||"",String(error||"").slice(0,1500)).run();
  }catch{}
}

async function isDuplicateRecentEmail(env,to,templateKey,subject){
  if(!to||!templateKey||!env?.DB) return false;
  try{
    const row=await env.DB.prepare(
      "SELECT id FROM email_logs WHERE lower(to_email)=lower(?) AND template_key=? AND subject=? AND status IN ('sent','pending') AND created_at > datetime('now','-60 seconds') LIMIT 1"
    ).bind(to,templateKey,subject||"").first();
    return !!row;
  }catch{
    return false;
  }
}

export async function sendEmail(env,{to,subject,html,text,templateKey="",skipDedupe=false}){
  if(!to || !String(to).includes("@")) return {ok:false,error:"MISSING_OR_INVALID_RECIPIENT"};
  if(!skipDedupe && await isDuplicateRecentEmail(env,to,templateKey,subject)){
    return {ok:true,deduped:true};
  }
  const fromAddr = env.MAIL_FROM || "Hệ thống Thông tin Số Sky First <app@skyfirst.io.vn>";
  const replyTo = env.MAIL_SUPPORT || "support@skyfirst.io.vn";
  try{
    // 1) Resend API
    if(env.RESEND_API_KEY){
      const r=await fetch("https://api.resend.com/emails",{
        method:"POST",
        headers:{"content-type":"application/json","authorization":`Bearer ${env.RESEND_API_KEY}`},
        body:JSON.stringify({
          from:fromAddr,
          reply_to:replyTo,
          to:[to],subject,html,text
        })
      });
      const data=await r.json().catch(()=>({}));
      if(!r.ok) throw new Error(data?.message||`Resend HTTP ${r.status}`);
      await logEmail(env,to,templateKey,subject,"sent",data?.id||"","");
      return {ok:true,id:data?.id||""};
    }

    // 2) Cloudflare Email Service binding
    if(env.EMAIL?.send){
      const result=await env.EMAIL.send({
        to,
        from:fromAddr,
        subject,html,text
      });
      await logEmail(env,to,templateKey,subject,"sent",result?.messageId||"","");
      return {ok:true,id:result?.messageId||""};
    }

    await logEmail(env,to,templateKey,subject,"pending","","Email provider chưa được cấu hình (cần RESEND_API_KEY hoặc EMAIL binding).");
    return {ok:false,pending:true,error:"EMAIL_PROVIDER_NOT_CONFIGURED"};
  }catch(err){
    await logEmail(env,to,templateKey,subject,"failed","",err?.message||String(err));
    return {ok:false,error:err?.message||String(err)};
  }
}

export function renderEmailContent(row, vars={}){
  const safeVars = {
    support_email: "support@skyfirst.io.vn",
    contact_email: "lienhe@skyfirst.io.vn",
    system_email: "app@skyfirst.io.vn",
    ...vars
  };
  const rawKeys = new Set(["PROFILE_IMAGE_BLOCK","answers_table","note_block"]);
  return {
    subject: renderTemplate(row.subject_template, safeVars, {htmlEscape:false}),
    html: renderTemplate(row.html_template, safeVars, {htmlEscape:true, rawKeys}),
    text: renderTemplate(row.text_template||"", safeVars, {htmlEscape:false})
  };
}

export async function sendTemplatedEmail(env,key,to,vars={},options={}){
  const row=await env.DB.prepare("SELECT * FROM email_templates WHERE key=? AND enabled=1").bind(key).first();
  if(!row) return {ok:false,error:"TEMPLATE_NOT_FOUND"};
  const rendered = renderEmailContent(row, vars);
  return sendEmail(env,{
    to,
    templateKey:key,
    subject:rendered.subject,
    html:rendered.html,
    text:rendered.text,
    skipDedupe:!!options.skipDedupe
  });
}

export function answersToEmail(answers={}){
  const rows=[],text=[];
  for(const [k,v] of Object.entries(answers)){
    const value=Array.isArray(v)?v.join(", "):typeof v==="object"?JSON.stringify(v):String(v??"");
    rows.push(`<tr><td style="padding:7px;border:1px solid #d8e1ec"><b>${escapeHtml(k)}</b></td><td style="padding:7px;border:1px solid #d8e1ec">${escapeHtml(value)}</td></tr>`);
    text.push(`${k}: ${value}`);
  }
  return {
    answers_table:`<table style="border-collapse:collapse;width:100%">${rows.join("")}</table>`,
    answers_text:text.join("\n")
  };
}

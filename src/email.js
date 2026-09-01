
import {renderTemplate, escapeHtml} from "./utils.js";

async function logEmail(env,to,templateKey,subject,status,messageId="",error=""){
  try{
    await env.DB.prepare("INSERT INTO email_logs(to_email,template_key,subject,status,provider_message_id,error) VALUES(?,?,?,?,?,?)")
      .bind(to,templateKey||"",subject||"",status,messageId||"",String(error||"").slice(0,1500)).run();
  }catch{}
}

export async function sendEmail(env,{to,subject,html,text,templateKey=""}){
  if(!to) return {ok:false,error:"MISSING_RECIPIENT"};
  try{
    // 1) Resend API — phù hợp khi DNS chính không nằm tại Cloudflare.
    if(env.RESEND_API_KEY){
      const r=await fetch("https://api.resend.com/emails",{
        method:"POST",
        headers:{"content-type":"application/json","authorization":`Bearer ${env.RESEND_API_KEY}`},
        body:JSON.stringify({
          from:env.MAIL_FROM||"Sky First Network <noreply@skyfirst.io.vn>",
          to:[to],subject,html,text
        })
      });
      const data=await r.json().catch(()=>({}));
      if(!r.ok) throw new Error(data?.message||`Resend HTTP ${r.status}`);
      await logEmail(env,to,templateKey,subject,"sent",data?.id||"","");
      return {ok:true,id:data?.id||""};
    }

    // 2) Cloudflare Email Service binding — chỉ dùng nếu binding EMAIL đã được cấu hình.
    if(env.EMAIL?.send){
      const result=await env.EMAIL.send({
        to,
        from:env.MAIL_FROM||"noreply@skyfirst.io.vn",
        subject,html,text
      });
      await logEmail(env,to,templateKey,subject,"sent",result?.messageId||"","");
      return {ok:true,id:result?.messageId||""};
    }

    await logEmail(env,to,templateKey,subject,"pending","","Email provider chưa được cấu hình.");
    return {ok:false,pending:true,error:"EMAIL_PROVIDER_NOT_CONFIGURED"};
  }catch(err){
    await logEmail(env,to,templateKey,subject,"failed","",err?.message||String(err));
    return {ok:false,error:err?.message||String(err)};
  }
}

export async function sendTemplatedEmail(env,key,to,vars={}){
  const row=await env.DB.prepare("SELECT * FROM email_templates WHERE key=? AND enabled=1").bind(key).first();
  if(!row) return {ok:false,error:"TEMPLATE_NOT_FOUND"};
  return sendEmail(env,{
    to,
    templateKey:key,
    subject:renderTemplate(row.subject_template,vars),
    html:renderTemplate(row.html_template,vars),
    text:renderTemplate(row.text_template||"",vars)
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

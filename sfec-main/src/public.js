
import {
  json, readJson, uid, randomToken, sha256, ageFromDob, flattenFields, sanitizeFilename,
  requestIp, ipHash, rateLimit, escapeHtml
} from "./utils.js";
import {getAuthUser} from "./auth.js";
import {sendTemplatedEmail, answersToEmail} from "./email.js";

async function getSetting(env,key,fallback=null){
  const r=await env.DB.prepare("SELECT value_json FROM settings WHERE key=?").bind(key).first();
  if(!r) return fallback;
  try{return JSON.parse(r.value_json)}catch{return r.value_json}
}
async function audit(env,request,user,action,entityType="",entityId="",details={}){
  try{
    await env.DB.prepare("INSERT INTO audit_log(actor_user_id,actor_email,action,entity_type,entity_id,details_json,ip_hash) VALUES(?,?,?,?,?,?,?)")
      .bind(user?.id||null,user?.email||"",action,entityType,entityId,JSON.stringify(details),await ipHash(request)).run();
  }catch{}
}
async function nextCode(env,prefix){
  const year=new Date().getFullYear(),key=`code:${prefix}:${year}`;
  await env.DB.prepare("INSERT OR IGNORE INTO counters(key,value) VALUES(?,0)").bind(key).run();
  const row=await env.DB.prepare("UPDATE counters SET value=value+1 WHERE key=? RETURNING value").bind(key).first();
  return `${prefix}-${year}-${String(row?.value||1).padStart(4,"0")}`;
}
function validateForm(config,answers,fileKeys=new Set()){
  const errors=[];
  if(config.min_age){
    const a=ageFromDob(answers.dob);
    if(a<config.min_age) errors.push(`Yêu cầu từ đủ ${config.min_age} tuổi.`);
  }
  for(const f of flattenFields(config,answers)){
    const v=answers[f.key];
    const missing=f.type==="file"?!fileKeys.has(f.key):(v===undefined||v===null||v===""||v===false);
    if(f.required && missing) errors.push(`Thiếu: ${f.label}`);
    if(f.type==="email"&&v&&!String(v).includes("@")) errors.push(`Email không hợp lệ: ${f.label}`);
  }
  return errors;
}
async function storeFile(env,file,{ownerUserId=null,submissionCode=null,fieldKey=""}={}){
  const maxMb=Number(await getSetting(env,"max_upload_mb",10));
  const max=maxMb*1024*1024;
  if(file.size>max) throw new Error(`FILE_TOO_LARGE:${maxMb}MB`);
  const allowed=new Set([
    "image/jpeg","image/png","image/webp","application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  ]);
  if(file.type && !allowed.has(file.type)) throw new Error("FILE_TYPE_NOT_ALLOWED");
  const id=uid("file"),name=sanitizeFilename(file.name),key=`private/${new Date().getUTCFullYear()}/${id}/${name}`;
  await env.FILES.put(key,file.stream(),{httpMetadata:{contentType:file.type||"application/octet-stream"}});
  await env.DB.prepare("INSERT INTO files(id,owner_user_id,submission_code,field_key,r2_key,filename,mime,size,visibility) VALUES(?,?,?,?,?,?,?,?, 'private')")
    .bind(id,ownerUserId,submissionCode,fieldKey,key,name,file.type||"",file.size||0).run();
  return id;
}
async function termsSnapshot(env,codes=[]){
  const out=[];
  for(const code of codes){
    const t=await env.DB.prepare("SELECT code,name,version,status FROM terms WHERE code=?").bind(code).first();
    if(t) out.push(t);
  }
  return out;
}
async function createSupportTicket(env,submission){
  const answers=JSON.parse(submission.answers_json||"{}"),code=await nextCode(env,"SFEC-TICKET"),id=uid("ticket");
  await env.DB.prepare("INSERT INTO tickets(id,code,submitter_user_id,submitter_name,email,ticket_type,priority,status,subject) VALUES(?,?,?,?,?,?,?,'Mới',?)")
    .bind(id,code,submission.user_id||null,submission.full_name||"",submission.email||"",answers.request_type||"Hỗ trợ","Bình thường",answers.related||answers.content?.slice(0,120)||"Yêu cầu hỗ trợ").run();
  await env.DB.prepare("INSERT INTO ticket_messages(ticket_id,sender_user_id,sender_type,body) VALUES(?,?,'public',?)")
    .bind(id,submission.user_id||null,answers.content||"").run();
}

export async function publicRoute(request,env,url){
  const p=url.pathname;

  if(p==="/api/config"&&request.method==="GET"){
    const mods=await env.DB.prepare("SELECT key,name,category,enabled,sort_order,description FROM modules ORDER BY sort_order").all();
    const forms=await env.DB.prepare("SELECT id,name,prefix,description,audience,min_age,version FROM forms WHERE enabled=1 ORDER BY rowid").all();
    return json({
      app_name:await getSetting(env,"app_name","The Sky First English Club"),
      app_short_name:await getSetting(env,"app_short_name","The Sky First English Club"),
      app_url:env.APP_URL||await getSetting(env,"app_url",""),
      website:await getSetting(env,"website","https://www.skyfirst.io.vn"),
      hotline:await getSetting(env,"hotline","0924 910 210"),
      receiver_email:await getSetting(env,"receiver_email","sfec@skyfirst.io.vn"),
      slogan:await getSetting(env,"brand_slogan",""),
      hero_title:await getSetting(env,"hero_title","Kết nối giáo dục. Phát triển cộng đồng."),
      hero_text:await getSetting(env,"hero_text","Một cổng chung cho Thành viên, Core Team, Tình nguyện viên, Học sinh/Học viên, lớp học, hoạt động, hồ sơ, GCN/GXN và quản trị The Sky First English Club."),
      hero_cover_url:await getSetting(env,"hero_cover_url","/assets/sfec-cover.png"),
      maintenance_mode:await getSetting(env,"maintenance_mode",false),
      modules:mods.results||[],
      forms:forms.results||[],
      google_oauth:!!(env.GOOGLE_CLIENT_ID&&env.GOOGLE_REDIRECT_URI),
      turnstile_site_key:env.TURNSTILE_SITE_KEY||""
    });
  }

  const pageMatch=p.match(/^\/api\/public\/pages\/([^/]+)$/);
  if(pageMatch&&request.method==="GET"){
    const slug=decodeURIComponent(pageMatch[1]);
    const row=await env.DB.prepare("SELECT slug,title,kicker,body_html,status,seo_title,seo_description,cover_file_id,updated_at FROM site_pages WHERE slug=? AND status='published' AND length(trim(body_html))>0").bind(slug).first();
    if(!row)return json({error:"PAGE_NOT_CUSTOMIZED"},404);
    if(row.cover_file_id) row.cover_url=`/api/files/${encodeURIComponent(row.cover_file_id)}`;
    return json({item:row});
  }

  if(p==="/api/public/news"&&request.method==="GET"){
    const rs=await env.DB.prepare("SELECT id,title,slug,body,published_at,tags_json,cover_file_id FROM news WHERE status='published' ORDER BY COALESCE(published_at,created_at) DESC LIMIT 100").all();
    return json({items:rs.results||[]});
  }
  if(p==="/api/public/classes"&&request.method==="GET"){
    const rs=await env.DB.prepare("SELECT id,unit_code,title,level,status,schedule_json,capacity,data_json FROM classes ORDER BY created_at DESC").all();
    return json({items:rs.results||[]});
  }
  if(p==="/api/public/events"&&request.method==="GET"){
    const rs=await env.DB.prepare("SELECT id,unit_code,title,start_at,end_at,status,capacity,data_json FROM events ORDER BY COALESCE(start_at,created_at) DESC").all();
    return json({items:rs.results||[]});
  }
  if(p==="/api/public/units"&&request.method==="GET"){
    const rs=await env.DB.prepare("SELECT code,name,unit_type,manager_name,email,status,data_json FROM units WHERE status!='Đã giải thể' ORDER BY name").all();
    return json({items:rs.results||[]});
  }

  const formMatch=p.match(/^\/api\/forms\/([^/]+)$/);
  if(formMatch&&request.method==="GET"){
    const idForm=decodeURIComponent(formMatch[1]);
    const row=await env.DB.prepare("SELECT id,name,prefix,description,audience,min_age,version,config_json FROM forms WHERE id=? AND enabled=1").bind(idForm).first();
    if(!row) return json({error:"FORM_NOT_FOUND"},404);
    const config=JSON.parse(row.config_json);
    const terms=[];
    for(const code of config.term_codes||[]){
      const t=await env.DB.prepare("SELECT code,name,version,body,status FROM terms WHERE code=? AND status='published'").bind(code).first();
      if(t) terms.push(t);
    }
    return json({form:{...row,config_json:undefined,config},terms});
  }

  const submitMatch=p.match(/^\/api\/forms\/([^/]+)\/submit$/);
  if(submitMatch&&request.method==="POST"){
    const idForm=decodeURIComponent(submitMatch[1]);
    const ip=await ipHash(request);
    const rl=await rateLimit(env,`submit:${idForm}:${ip}`,8,300);
    if(!rl.ok) return json({error:"RATE_LIMIT"},429);

    const row=await env.DB.prepare("SELECT * FROM forms WHERE id=? AND enabled=1").bind(idForm).first();
    if(!row) return json({error:"FORM_NOT_FOUND"},404);
    const config=JSON.parse(row.config_json);

    let payload={},formData=null;
    const ct=request.headers.get("content-type")||"";
    if(ct.includes("multipart/form-data")){
      formData=await request.formData();
      try{payload=JSON.parse(String(formData.get("payload")||"{}"))}catch{return json({error:"INVALID_PAYLOAD"},400)}
    }else{
      payload=await readJson(request)||{};
    }
    const answers=payload.answers||{};
    const fileKeys=new Set();
    if(formData){ for(const f of flattenFields(config,answers)){ const x=formData.get(`file:${f.key}`); if(x&&typeof x==="object"&&"size" in x&&x.size>0) fileKeys.add(f.key); } }
    const errors=validateForm(config,answers,fileKeys);
    if(errors.length) return json({error:"VALIDATION_FAILED",errors},400);

    if(env.TURNSTILE_SECRET_KEY){
      const token=payload.turnstile_token||"";
      const verify=await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify",{
        method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},
        body:new URLSearchParams({secret:env.TURNSTILE_SECRET_KEY,response:token,remoteip:requestIp(request)})
      }).then(r=>r.json()).catch(()=>({success:false}));
      if(!verify.success) return json({error:"TURNSTILE_FAILED"},400);
    }

    const user=await getAuthUser(request,env);
    const code=await nextCode(env,row.prefix);
    const snap=await termsSnapshot(env,config.term_codes||[]);
    const fullName=String(answers.full_name||answers.org_name||answers.unit_name||"").trim();
    const email=String(answers.email||"").trim().toLowerCase();

    await env.DB.prepare("INSERT INTO submissions(code,form_id,form_version,form_snapshot_json,user_id,full_name,email,answers_json,terms_snapshot_json,status) VALUES(?,?,?,?,?,?,?,?,?,'Đã tiếp nhận')")
      .bind(code,idForm,row.version,JSON.stringify(config),user?.id||null,fullName,email,JSON.stringify(answers),JSON.stringify(snap)).run();

    const fileIds={};
    if(formData){
      for(const f of flattenFields(config,answers)){
        if(f.type!=="file") continue;
        const file=formData.get(`file:${f.key}`);
        if(file && typeof file==="object" && "size" in file && file.size>0){
          try{
            const fid=await storeFile(env,file,{ownerUserId:user?.id||null,submissionCode:code,fieldKey:f.key});
            fileIds[f.key]=fid;
          }catch(err){
            await env.DB.prepare("DELETE FROM submissions WHERE code=?").bind(code).run();
            // Notify operations about a genuine server-side file persistence failure.
            // Do not include applicant answers or file contents in the alert.
            const alertRecipient=await getSetting(env,"email_internal_alert_recipient",await getSetting(env,"receiver_email","sfec@skyfirst.io.vn"));
            if(alertRecipient) await sendTemplatedEmail(env,"system_alert",alertRecipient,{alert_title:"Không lưu được tệp hồ sơ",reference:code,occurred_at:new Date().toLocaleString("vi-VN",{timeZone:"Asia/Ho_Chi_Minh"}),message:String(err.message||err).slice(0,300)});
            return json({error:String(err.message||err)},400);
          }
        }
      }
      if(Object.keys(fileIds).length){
        const merged={...answers,...Object.fromEntries(Object.entries(fileIds).map(([k,v])=>[k,{file_id:v}]))};
        await env.DB.prepare("UPDATE submissions SET answers_json=? WHERE code=?").bind(JSON.stringify(merged),code).run();
      }
    }

    const submission=await env.DB.prepare("SELECT * FROM submissions WHERE code=?").bind(code).first();
    if(idForm==="support") await createSupportTicket(env,submission);
    if(idForm==="class"){
      const course=String(answers.course||"");
      const cls=await env.DB.prepare("SELECT id,title FROM classes WHERE title=? OR level=? ORDER BY created_at DESC LIMIT 1").bind(course,course).first();
      if(cls){
        await env.DB.prepare("INSERT INTO class_enrollments(class_id,user_id,submission_code,full_name,email,status) VALUES(?,?,?,?,?,'Chờ duyệt')")
          .bind(cls.id,user?.id||null,code,fullName,email).run();
        if(email) await sendTemplatedEmail(env,"class_enrollment",email,{full_name:fullName,class_title:cls.title||course,status:"Chờ duyệt",code});
      }
    }
    if(idForm==="event"){
      const eventName=String(answers.event_name||"");
      const ev=await env.DB.prepare("SELECT id,title,start_at FROM events WHERE title=? ORDER BY created_at DESC LIMIT 1").bind(eventName).first();
      if(ev){
        const checkin=`CHK-${randomToken(8)}`;
        await env.DB.prepare("INSERT INTO event_registrations(event_id,user_id,full_name,email,status,checkin_code) VALUES(?,?,?,?, 'Đã đăng ký', ?)")
          .bind(ev.id,user?.id||null,fullName,email,checkin).run();
        if(email) await sendTemplatedEmail(env,"event_registration",email,{full_name:fullName,event_title:ev.title||eventName,event_time:ev.start_at||"Sẽ cập nhật sau",status:"Đã đăng ký",code});
      }
    }

    const labeledAnswers={};
    for(const f of flattenFields(config,answers)){
      if(f.type==="file"){ if(fileIds[f.key]) labeledAnswers[f.label]=`${env.APP_URL}/api/files/${fileIds[f.key]}`; }
      else labeledAnswers[f.label]=answers[f.key]??"";
    }
    const emailParts=answersToEmail(labeledAnswers);
    const vars={
      code,form_name:row.name,full_name:fullName,email,
      submitted_at:new Date().toLocaleString("vi-VN",{timeZone:"Asia/Ho_Chi_Minh"}),
      lookup_url:`${env.APP_URL||"https://sfec.skyfirst.io.vn"}/#lookup`,
      photo_note:fileIds.profile_photo?"Ảnh chân dung đã được tiếp nhận và lưu cùng hồ sơ.":"",
      phone:String(answers.phone||answers.phone_number||answers.mobile||""),
      status:"Đã tiếp nhận",
      profile_image_block:fileIds.profile_photo?`<div style="padding:22px 12px;text-align:center;color:#51698f;font-size:13px;line-height:1.6">✓ Ảnh chân dung đã được tải lên và lưu an toàn cùng hồ sơ SFEC.</div>`:`<div style="padding:22px 12px;text-align:center;color:#8a98ad;font-size:13px">Không có ảnh chân dung trong hồ sơ này.</div>`,
      ...emailParts
    };
    const receiver=row.recipient_email||await getSetting(env,"receiver_email","sfec@skyfirst.io.vn");
    const internalMail=await sendTemplatedEmail(env,"submission_internal",receiver,vars);
    const applicantMail=email?await sendTemplatedEmail(env,"submission_confirmation",email,vars):null;

    await audit(env,request,user,"Tiếp nhận hồ sơ","submission",code,{form_id:idForm,internal_email_ok:!!internalMail?.ok,applicant_email_ok:!!applicantMail?.ok});
    return json({ok:true,code,status:"Đã tiếp nhận",email_sent:!!applicantMail?.ok});
  }

  if(p==="/api/lookup/submission"&&request.method==="GET"){
    const code=String(url.searchParams.get("code")||"").trim(),email=String(url.searchParams.get("email")||"").trim().toLowerCase();
    if(!code||!email) return json({error:"MISSING_FIELDS"},400);
    const row=await env.DB.prepare("SELECT code,form_id,status,created_at,updated_at FROM submissions WHERE code=? AND lower(email)=lower(?)").bind(code,email).first();
    return row?json({item:row}):json({error:"NOT_FOUND"},404);
  }

  if(p==="/api/lookup/certificate"&&request.method==="GET"){
    const code=String(url.searchParams.get("code")||"").trim();
    const row=await env.DB.prepare("SELECT code,cert_type,full_name,content,status,issued_at,metadata_json FROM certificates WHERE code=? AND status IN ('issued','revoked','reissued')").bind(code).first();
    return row?json({item:row},200,{'Access-Control-Allow-Origin':'*','Vary':'Origin','Cache-Control':'no-store'}):json({error:"NOT_FOUND"},404,{'Access-Control-Allow-Origin':'*','Vary':'Origin','Cache-Control':'no-store'});
  }

  return null;
}

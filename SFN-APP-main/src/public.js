
import {
  json, readJson, uid, randomToken, sha256, ageFromDob, flattenFields, sanitizeFilename,
  requestIp, ipHash, rateLimit, escapeHtml, safeEq
} from "./utils.js";
import {getAuthUser} from "./auth.js";
import {sendTemplatedEmail, answersToEmail} from "./email.js";

async function getSetting(env,key,fallback=null){
  try{
    if(!env.DB) return fallback;
    const r=await env.DB.prepare("SELECT value_json FROM settings WHERE key=?").bind(key).first();
    if(!r) return fallback;
    try{return JSON.parse(r.value_json)}catch{return r.value_json}
  }catch{return fallback}
}

async function safePublicList(env,sql){
  try{
    if(!env.DB) return {items:[],degraded:true};
    const rs=await env.DB.prepare(sql).all();
    return {items:rs.results||[],degraded:false};
  }catch(err){
    console.error("PUBLIC_LIST_DB_FALLBACK",err);
    return {items:[],degraded:true};
  }
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
function isClassStudentForm(idForm,row,config={}){
  const kind=String(config.form_type||"").toLowerCase();
  const name=String(row?.name||config.name||"").toLowerCase();
  return kind==="class" || kind==="student" || idForm==="class" || /lớp học|học viên/.test(name);
}
function normalizeFormConfig(idForm,row,rawConfig){
  const config=JSON.parse(JSON.stringify(rawConfig||{}));
  config.form_type=config.form_type||((idForm==="class")?"class":"general");
  const photoRequired=config.profile_photo_required===true && !isClassStudentForm(idForm,row,config);
  config.profile_photo_required=photoRequired;
  config.sections=Array.isArray(config.sections)?config.sections:[];
  let photoField=null;
  for(const section of config.sections){
    for(const f of section.fields||[]){
      if(f.key==="profile_photo" || f.key==="photo") photoField=f;
    }
  }
  if(photoRequired){
    if(photoField){
      photoField.required=true;
      photoField.type="file";
      photoField.accept=["image/jpeg","image/png"];
      photoField.is_profile_photo=true;
    }else{
      if(!config.sections.length) config.sections.push({title:"Thông tin cá nhân",fields:[]});
      config.sections[0].fields=config.sections[0].fields||[];
      config.sections[0].fields.unshift({
        key:"profile_photo",label:"Ảnh cá nhân",type:"file",required:true,
        accept:["image/jpeg","image/png"],is_profile_photo:true
      });
    }
  }else if(photoField){
    photoField.required=false;
    photoField.is_profile_photo=true;
  }
  if(config.minor_mode){
    const hasDob=config.sections.some(s=>(s.fields||[]).some(f=>f.key==="dob"));
    if(!hasDob){
      if(!config.sections.length) config.sections.push({title:"Thông tin người tham gia",fields:[]});
      config.sections[0].fields=config.sections[0].fields||[];
      config.sections[0].fields.push({key:"dob",label:"Ngày sinh",type:"date",required:true});
    }
    const hasGuardian=config.sections.some(s=>(s.fields||[]).some(f=>String(f.key||"").startsWith("guardian_")));
    if(!hasGuardian){
      config.sections.push({
        title:"Thông tin người giám hộ",minor_only:true,
        description:"Chỉ hiển thị khi người tham gia dưới 18 tuổi.",
        fields:[
          {key:"guardian_name",label:"Họ và tên người giám hộ",type:"text",required:true},
          {key:"guardian_contact",label:"Email hoặc số điện thoại người giám hộ",type:"text",required:true},
          {key:"guardian_consent",label:"Tôi xác nhận người giám hộ đã đọc và đồng ý với nội dung tham gia",type:"checkbox",required:true}
        ]
      });
    }
  }
  return config;
}
function formConditionOk(cond,answers){
  if(!cond)return true;
  if("equals" in cond)return answers[cond.key]===cond.equals;
  if("not_equals" in cond)return answers[cond.key]!==cond.not_equals;
  return true;
}
function activeFields(config,answers){
  const out=[];
  const age=answers.dob?ageFromDob(answers.dob):null;
  for(const section of config.sections||[]){
    if(section.minor_only && !(Number.isFinite(age)&&age<18)) continue;
    if(!formConditionOk(section.condition,answers)) continue;
    for(const f of section.fields||[]){if(formConditionOk(f.condition,answers)) out.push(f)}
  }
  return out;
}
function validateForm(config,answers,fileKeys=new Set()){
  const errors=[];
  if(config.min_age){
    const a=ageFromDob(answers.dob);
    if(a<config.min_age) errors.push(`Yêu cầu từ đủ ${config.min_age} tuổi.`);
  }
  for(const f of activeFields(config,answers)){
    const v=answers[f.key];
    const fileLike=f.type==="file"||f.type==="signature";
    const missing=fileLike?!fileKeys.has(f.key):(v===undefined||v===null||v===""||v===false);
    if(f.required && missing) errors.push(`Thiếu: ${f.label}`);
    if(f.type==="email"&&v&&!String(v).includes("@")) errors.push(`Email không hợp lệ: ${f.label}`);
  }
  return errors;
}
function magicBytesOk(mime,bytes){
  const b=new Uint8Array(bytes),ascii=(a,n)=>String.fromCharCode(...a.slice(0,n));
  if(mime==="image/jpeg")return b[0]===0xff&&b[1]===0xd8&&b[2]===0xff;
  if(mime==="image/png")return b[0]===0x89&&ascii(b.slice(1),3)==="PNG";
  if(mime==="image/webp")return ascii(b,4)==="RIFF"&&String.fromCharCode(...b.slice(8,12))==="WEBP";
  if(mime==="application/pdf")return ascii(b,4)==="%PDF";
  if(mime.includes("officedocument"))return b[0]===0x50&&b[1]===0x4b;
  return true;
}

async function storeFile(env,file,{ownerUserId=null,submissionCode=null,fieldKey="",emailVisible=false}={}){
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
  const bytes=await file.arrayBuffer();
  if(!magicBytesOk(file.type||"",bytes.slice(0,16))) throw new Error("FILE_SIGNATURE_MISMATCH");
  const hash=await sha256(bytes);
  await env.FILES.put(key,bytes,{httpMetadata:{contentType:file.type||"application/octet-stream"},customMetadata:{sha256:hash}});
  const emailToken=emailVisible?randomToken(32):null;
  await env.DB.prepare("INSERT INTO files(id,owner_user_id,submission_code,field_key,r2_key,filename,mime,size,visibility,email_token,sha256) VALUES(?,?,?,?,?,?,?,?, 'private',?,?)")
    .bind(id,ownerUserId,submissionCode,fieldKey,key,name,file.type||"",file.size||0,emailToken,hash).run();
  return {id,email_token:emailToken,sha256:hash};
}
async function createUploadSession(request,env,body){
  if(!env.FILES) return {error:"STORAGE_UNAVAILABLE",status:503};
  const ip=await ipHash(request),rl=await rateLimit(env,`upload-session:${ip}`,30,300);
  if(!rl.ok) return {error:"RATE_LIMIT",status:429};
  const filename=sanitizeFilename(body.filename||"file"),mime=String(body.mime||"application/octet-stream").slice(0,120),size=Number(body.size||0);
  const maxMb=Number(await getSetting(env,"max_upload_mb",10)),max=maxMb*1024*1024;
  const allowed=new Set(["image/jpeg","image/png","image/webp","application/pdf","application/vnd.openxmlformats-officedocument.wordprocessingml.document","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"]);
  if(!Number.isFinite(size)||size<=0||size>max) return {error:"FILE_TOO_LARGE",status:400};
  if(mime&&!allowed.has(mime)) return {error:"FILE_TYPE_NOT_ALLOWED",status:400};
  const id=uid("upload"),token=randomToken(32),tokenHash=await sha256(token),key=`temp/uploads/${new Date().toISOString().slice(0,10)}/${id}/${filename}`;
  await env.DB.prepare("INSERT INTO upload_sessions(id,token_hash,field_key,filename,mime,size,client_sha256,r2_key,state,expires_at) VALUES(?,?,?,?,?,?,?,?,'created',datetime('now','+2 hours'))")
    .bind(id,tokenHash,String(body.field_key||"").slice(0,80),filename,mime,size,String(body.sha256||"").slice(0,160),key).run();
  return {id,token,upload_url:`/api/uploads/${encodeURIComponent(id)}?token=${encodeURIComponent(token)}`,expires_in:7200};
}

async function putUploadSession(request,env,id,url){
  const token=String(url.searchParams.get("token")||request.headers.get("x-upload-token")||"");
  if(!token) return json({error:"UPLOAD_TOKEN_REQUIRED"},403);
  const row=await env.DB.prepare("SELECT * FROM upload_sessions WHERE id=?").bind(id).first();
  if(!row||row.state!=="created"||new Date(row.expires_at).getTime()<=Date.now()) return json({error:"UPLOAD_SESSION_EXPIRED"},410);
  if(!safeEq(await sha256(token),row.token_hash)) return json({error:"FORBIDDEN"},403);
  const length=Number(request.headers.get("content-length")||row.size);if(length>Number(row.size)||length<=0) return json({error:"SIZE_MISMATCH"},400);
  await env.FILES.put(row.r2_key,request.body,{httpMetadata:{contentType:row.mime||"application/octet-stream"},customMetadata:{clientSha256:row.client_sha256||""}});
  const head=await env.FILES.head(row.r2_key);
  if(!head||Number(head.size)!==Number(row.size)){await env.FILES.delete(row.r2_key);return json({error:"UPLOAD_INTEGRITY_SIZE_MISMATCH"},400);}
  const sample=await env.FILES.get(row.r2_key,{range:{offset:0,length:16}});
  if(sample){const bytes=await sample.arrayBuffer();if(!magicBytesOk(row.mime||"",bytes)){await env.FILES.delete(row.r2_key);await env.DB.prepare("UPDATE upload_sessions SET state='rejected' WHERE id=?").bind(id).run();return json({error:"FILE_SIGNATURE_MISMATCH"},400);}}
  await env.DB.prepare("UPDATE upload_sessions SET state='uploaded' WHERE id=?").bind(id).run();
  return json({ok:true,id,size:head.size});
}

async function finalizeUploadSession(env,info,{submissionCode,fieldKey,ownerUserId=null,emailVisible=false}={}){
  const id=String(info?.id||""),token=String(info?.token||"");if(!id||!token) throw new Error("UPLOAD_SESSION_INVALID");
  const row=await env.DB.prepare("SELECT * FROM upload_sessions WHERE id=?").bind(id).first();
  if(!row||row.state!=="uploaded"||new Date(row.expires_at).getTime()<=Date.now()) throw new Error("UPLOAD_SESSION_EXPIRED");
  if(!safeEq(await sha256(token),row.token_hash)) throw new Error("UPLOAD_SESSION_FORBIDDEN");
  const fileId=uid("file"),emailToken=emailVisible?randomToken(32):null;
  await env.DB.prepare("INSERT INTO files(id,owner_user_id,submission_code,field_key,r2_key,filename,mime,size,visibility,email_token,sha256,upload_state) VALUES(?,?,?,?,?,?,?,?, 'private',?,?,'ready')")
    .bind(fileId,ownerUserId,submissionCode,fieldKey,row.r2_key,row.filename,row.mime||"",row.size||0,emailToken,row.client_sha256||null).run();
  await env.DB.prepare("UPDATE upload_sessions SET state='finalized',submission_code=?,field_key=?,finalized_at=CURRENT_TIMESTAMP WHERE id=?").bind(submissionCode,fieldKey,id).run();
  return {id:fileId,sha256:row.client_sha256||null,email_token:emailToken};
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
  const answers=JSON.parse(submission.answers_json||"{}"),code=await nextCode(env,"SFN-TICKET"),id=uid("ticket");
  await env.DB.prepare("INSERT INTO tickets(id,code,submitter_user_id,submitter_name,email,ticket_type,priority,status,subject) VALUES(?,?,?,?,?,?,?,'Mới',?)")
    .bind(id,code,submission.user_id||null,submission.full_name||"",submission.email||"",answers.request_type||"Hỗ trợ","Bình thường",answers.related||answers.content?.slice(0,120)||"Yêu cầu hỗ trợ").run();
  await env.DB.prepare("INSERT INTO ticket_messages(ticket_id,sender_user_id,sender_type,body) VALUES(?,?,'public',?)")
    .bind(id,submission.user_id||null,answers.content||"").run();
}

function publicCacheHeaders(seconds=300){
  return {"Cache-Control":`public, max-age=${Math.min(seconds,60)}, s-maxage=${seconds}, stale-while-revalidate=${Math.max(60,seconds)}`};
}

function normalizeCredentialCode(v){
  return String(v||"").trim().toUpperCase().replace(/\s+/g,"");
}

const schemaCache=new Map();
async function tableColumns(env,table){
  const key=`cols:${table}`;
  if(schemaCache.has(key)) return schemaCache.get(key);
  try{
    const rs=await env.DB.prepare(`PRAGMA table_info(${table})`).all();
    const cols=new Set((rs.results||[]).map(x=>String(x.name||"")));
    schemaCache.set(key,cols);return cols;
  }catch{return new Set()}
}
async function tableExists(env,table){
  const key=`table:${table}`;
  if(schemaCache.has(key)) return schemaCache.get(key);
  try{
    const row=await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").bind(table).first();
    const ok=!!row;schemaCache.set(key,ok);return ok;
  }catch{return false}
}
function normalizeCredentialStatus(value){
  const raw=String(value||"").trim();
  const s=raw.toLowerCase();
  if(!s) return {status:"issued",text:"CÓ HIỆU LỰC",public:true};
  if(s.includes("supersed")||s.includes("thay thế")||s.includes("thay the")) return {status:"superseded",text:"ĐÃ ĐƯỢC THAY THẾ",public:true};
  if(s.includes("revoke")||s.includes("thu hồi")||s.includes("thu hoi")||s.includes("hủy")||s.includes("huy")) return {status:"revoked",text:"ĐÃ THU HỒI",public:true};
  if(["issued","active","valid","có hiệu lực","co hieu luc","đã cấp","da cap","đã phát hành","da phat hanh","còn hiệu lực","con hieu luc"].includes(s)) return {status:"issued",text:"CÓ HIỆU LỰC",public:true};
  if(s.includes("pending")||s.includes("draft")||s.includes("approved")||s.includes("chờ")||s.includes("cho ")||s.includes("nháp")||s.includes("nhap")) return {status:s,text:raw||"CHƯA PHÁT HÀNH",public:false};
  return {status:raw||"issued",text:raw||"CÓ HIỆU LỰC",public:true};
}

async function lookupCredential(env,rawCode){
  const code=normalizeCredentialCode(rawCode);
  if(!code||!env.DB) return null;

  let registry=null;
  if(await tableExists(env,"issued_document_codes")){
    try{
      registry=await env.DB.prepare("SELECT * FROM issued_document_codes WHERE upper(replace(lookup_code,' ',''))=? OR random_digits=? ORDER BY is_primary DESC, created_at DESC LIMIT 1").bind(code,/^\d{8}$/.test(code)?code:"__NO_DIGITS__").first();
    }catch(err){console.error("CREDENTIAL_REGISTRY_LOOKUP",err)}
  }

  let row=null;
  if(await tableExists(env,"certificates")){
    const cols=await tableColumns(env,"certificates");
    const ids=["code","public_id","legacy_code"].filter(x=>cols.has(x));
    if(ids.length){
      const where=ids.map(x=>`upper(replace(${x},' ',''))=?`).join(" OR ");
      try{row=await env.DB.prepare(`SELECT * FROM certificates WHERE ${where} LIMIT 1`).bind(...ids.map(()=>code)).first()}
      catch(err){console.error("CREDENTIAL_DIRECT_LOOKUP",err)}
    }
    if(!row&&registry?.document_id&&cols.has("id")){
      try{row=await env.DB.prepare("SELECT * FROM certificates WHERE id=? LIMIT 1").bind(registry.document_id).first()}
      catch(err){console.error("CREDENTIAL_REGISTRY_RESOLVE",err)}
    }
  }

  if(!row&&registry){
    const active=Number(registry.is_active??1)!==0;
    return {
      code:registry.lookup_code||code,
      legacy_code:"",
      type:registry.document_type||"Giấy đã phát hành",
      full_name:"",
      content:"Mã giấy đã được ghi nhận trong hệ thống Sky First.",
      issued_at:registry.created_at||"",
      status:active?"issued":"revoked",
      status_text:active?"CÓ HIỆU LỰC":"ĐÃ THU HỒI",
      revoked_at:"",revocation_reason:"",unit_name:"Sky First Network",role:"",program:"",file_url:"",replacement_code:""
    };
  }
  if(!row) return null;

  const normalized=normalizeCredentialStatus(row.status);
  if(!normalized.public) return null;
  let metadata={}; try{metadata=JSON.parse(row.metadata_json||"{}")}catch{}
  let replacement=null;
  if(row.superseded_by_id){
    try{replacement=await env.DB.prepare("SELECT * FROM certificates WHERE id=? LIMIT 1").bind(row.superseded_by_id).first()}catch{}
  }
  return {
    code:row.public_id||row.code||row.legacy_code||registry?.lookup_code||code,
    legacy_code:row.legacy_code||(/^\d{3}-|\/(GCN|GXN|BK)-SFN\//i.test(row.code||"")?row.code:null),
    type:row.cert_type||registry?.document_type||"Giấy đã phát hành",
    full_name:row.full_name||"",content:row.content||"",issued_at:row.issued_at||row.created_at||"",
    status:normalized.status,status_text:normalized.text,revoked_at:row.revoked_at||"",revocation_reason:row.revocation_reason||"",
    unit_name:metadata.unit_name||metadata.issuer||"Sky First Network",
    role:metadata.role||metadata.position||"",program:metadata.program||metadata.activity||metadata.event||"",
    file_url:metadata.file_url||metadata.url||"",replacement_code:replacement?.public_id||replacement?.code||replacement?.legacy_code||""
  };
}

export async function publicRoute(request,env,url,ctx){
  const p=url.pathname;

  if(p==="/api/config"&&request.method==="GET"){
    let mods={results:[]},forms={results:[]};
    try{
      if(env.DB){
        mods=await env.DB.prepare("SELECT key,name,category,enabled,sort_order,description FROM modules ORDER BY sort_order").all();
        forms=await env.DB.prepare("SELECT id,name,prefix,description,audience,min_age,version FROM forms WHERE enabled=1 ORDER BY rowid").all();
      }
    }catch(err){ console.error("PUBLIC_CONFIG_DB_FALLBACK",err); }
    return json({
      app_name:await getSetting(env,"app_name","Cổng Thông tin Số Sky First"),
      app_short_name:await getSetting(env,"app_short_name","Sky First Network"),
      app_url:env.APP_URL||await getSetting(env,"app_url",""),
      website:await getSetting(env,"website","https://skyfirst.io.vn"),
      hotline:await getSetting(env,"hotline","0924 910 210"),
      receiver_email:await getSetting(env,"receiver_email","skyfirst.ec@gmail.com"),
      slogan:await getSetting(env,"brand_slogan",""),
      hero_title:await getSetting(env,"hero_title","Kết nối giáo dục. Phát triển cộng đồng."),
      hero_text:await getSetting(env,"hero_text","Khám phá thông tin, chương trình, hoạt động, tài nguyên và các tiện ích số trong hệ sinh thái Sky First Network."),
      hero_cover_url:await getSetting(env,"hero_cover_url","/assets/sfn-cover.png"),
      maintenance_mode:await getSetting(env,"maintenance_mode",false),
      header_show_brand:await getSetting(env,"header_show_brand",true),
      header_show_theme:await getSetting(env,"header_show_theme",true),
      header_show_account:false,
      header_account_label:await getSetting(env,"header_account_label","Đăng nhập"),
      footer_description:await getSetting(env,"footer_description","Kết nối giáo dục, tri thức và phát triển cộng đồng trên một hệ thống thống nhất."),
      footer_email:await getSetting(env,"footer_email","skyfirst.ec@gmail.com"),
      footer_support_email:await getSetting(env,"footer_support_email","support@skyfirst.io.vn"),
      footer_portal_email:await getSetting(env,"footer_portal_email","ctt@skyfirst.io.vn"),
      portal_main_label:await getSetting(env,"portal_main_label","Trang thông tin điện tử Sky First Network"),
      portal_main_url:await getSetting(env,"portal_main_url","https://skyfirst.io.vn"),
      portal_tnv_url:await getSetting(env,"portal_tnv_url","https://tnv.skyfirst.io.vn"),
      portal_sfec_url:await getSetting(env,"portal_sfec_url","https://sfec.skyfirst.io.vn"),
      portal_slc_url:await getSetting(env,"portal_slc_url","https://slc.skyfirst.io.vn"),
      portal_member_url:await getSetting(env,"portal_member_url","https://member.skyfirst.io.vn"),
      footer_copyright:await getSetting(env,"footer_copyright","© 2026 Sky First Network (SFN)"),
      modules:mods.results||[],
      forms:forms.results||[],
      google_oauth:!!(env.GOOGLE_CLIENT_ID&&env.GOOGLE_REDIRECT_URI),
      turnstile_site_key:env.TURNSTILE_SITE_KEY||""
    });
  }

  if(p==="/api/public/search"&&request.method==="GET"){
    const q=String(url.searchParams.get("q")||"").trim().slice(0,120);
    if(q.length<2) return json({items:[],query:q},200,publicCacheHeaders(30));
    const like=`%${q}%`;
    const [news,events,units,forms,docs,programs]=await env.DB.batch([
      env.DB.prepare("SELECT 'news' type,title,slug ref,substr(body,1,180) description,published_at date FROM news WHERE status='published' AND (title LIKE ? OR body LIKE ?) ORDER BY COALESCE(published_at,created_at) DESC LIMIT 12").bind(like,like),
      env.DB.prepare("SELECT 'event' type,title,id ref,COALESCE(status,'') description,start_at date FROM events WHERE title LIKE ? OR COALESCE(data_json,'') LIKE ? ORDER BY COALESCE(start_at,created_at) DESC LIMIT 12").bind(like,like),
      env.DB.prepare("SELECT 'unit' type,name title,code ref,COALESCE(unit_type,'') description,NULL date FROM units WHERE status!='Đã giải thể' AND (name LIKE ? OR code LIKE ?) ORDER BY name LIMIT 12").bind(like,like),
      env.DB.prepare("SELECT 'form' type,name title,id ref,COALESCE(description,'') description,NULL date FROM forms WHERE enabled=1 AND (name LIKE ? OR COALESCE(description,'') LIKE ?) ORDER BY rowid LIMIT 12").bind(like,like),
      env.DB.prepare("SELECT 'resource' type,title,id ref,COALESCE(doc_type,'') description,issued_at date FROM documents WHERE visibility='public' AND status='Có hiệu lực' AND (title LIKE ? OR code LIKE ?) ORDER BY COALESCE(issued_at,created_at) DESC LIMIT 12").bind(like,like),
      env.DB.prepare("SELECT 'program' type,title,id ref,trim(COALESCE(level,'') || ' ' || COALESCE(status,'')) description,NULL date FROM classes WHERE title LIKE ? OR COALESCE(level,'') LIKE ? OR COALESCE(unit_code,'') LIKE ? ORDER BY created_at DESC LIMIT 12").bind(like,like,like)
    ]);
    const pages=[
      {type:"page",title:"Cổng Thông tin Số",ref:"/",description:"Thông tin và tiện ích số Sky First"},
      {type:"page",title:"Tra cứu giấy đã phát hành",ref:"/gcn",description:"Giấy chứng nhận, Giấy xác nhận, Bảng khen và QR"},
      {type:"page",title:"Tra cứu hồ sơ",ref:"/ho-so",description:"Theo dõi tình trạng xử lý hồ sơ"},
      {type:"page",title:"Biểu mẫu trực tuyến",ref:"/bieu-mau",description:"Gửi thông tin và hồ sơ trực tuyến"},
      {type:"page",title:"Tra cứu thông tin",ref:"/tra-cuu",description:"Tra cứu giấy đã phát hành và hồ sơ"}
    ].filter(x=>(x.title+' '+x.description).toLowerCase().includes(q.toLowerCase()));
    const items=[...pages,...(news.results||[]),...(events.results||[]),...(programs.results||[]),...(units.results||[]),...(forms.results||[]),...(docs.results||[])].slice(0,40);
    if(/^(SFN-(GCN|GXN|BK)-\d{5,8}|\d{8}|\d{3}-(GCN|GXN|BK)-SFN\/\d{4})$/i.test(q)){
      const c=await lookupCredential(env,q); if(c) items.unshift({type:"credential",title:c.code,ref:c.code,description:`${c.type} · ${c.status_text}`,date:c.issued_at});
    }
    return json({items,query:q},200,publicCacheHeaders(60));
  }

  if(p==="/api/public/resources"&&request.method==="GET"){
    const rs=await env.DB.prepare("SELECT id,code,doc_type,title,file_id,issued_at,metadata_json FROM documents WHERE visibility='public' AND status='Có hiệu lực' ORDER BY COALESCE(issued_at,created_at) DESC LIMIT 200").all();
    return json({items:rs.results||[]},200,publicCacheHeaders(300));
  }

  if(p==="/api/public/news"&&request.method==="GET"){
    return json(await safePublicList(env,"SELECT id,title,slug,body,published_at,tags_json,cover_file_id FROM news WHERE status='published' ORDER BY COALESCE(published_at,created_at) DESC LIMIT 100"),200,publicCacheHeaders(180));
  }
  if(p==="/api/public/classes"&&request.method==="GET"){
    return json(await safePublicList(env,"SELECT id,unit_code,title,level,status,schedule_json,capacity,data_json FROM classes ORDER BY created_at DESC"),200,publicCacheHeaders(180));
  }
  if(p==="/api/public/events"&&request.method==="GET"){
    return json(await safePublicList(env,"SELECT id,unit_code,title,start_at,end_at,status,capacity,data_json FROM events ORDER BY COALESCE(start_at,created_at) DESC"),200,publicCacheHeaders(180));
  }
  if(p==="/api/public/units"&&request.method==="GET"){
    return json(await safePublicList(env,"SELECT code,name,unit_type,manager_name,email,status,data_json FROM units WHERE status!='Đã giải thể' ORDER BY name"),200,publicCacheHeaders(300));
  }

  if(p==="/api/uploads/session"&&request.method==="POST"){
    const body=await readJson(request)||{},created=await createUploadSession(request,env,body);
    if(created.error)return json({error:created.error},created.status||400);
    return json(created,201,{"Cache-Control":"no-store"});
  }
  const uploadMatch=p.match(/^\/api\/uploads\/([^/]+)$/);
  if(uploadMatch&&request.method==="PUT") return putUploadSession(request,env,decodeURIComponent(uploadMatch[1]),url);

  const formMatch=p.match(/^\/api\/forms\/([^/]+)$/);
  if(formMatch&&request.method==="GET"){
    const idForm=decodeURIComponent(formMatch[1]);
    const row=await env.DB.prepare("SELECT id,name,prefix,description,audience,min_age,version,config_json FROM forms WHERE id=? AND enabled=1").bind(idForm).first();
    if(!row) return json({error:"FORM_NOT_FOUND"},404);
    const config=normalizeFormConfig(idForm,row,JSON.parse(row.config_json));
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
    const config=normalizeFormConfig(idForm,row,JSON.parse(row.config_json));

    let payload={},formData=null;
    const ct=request.headers.get("content-type")||"";
    if(ct.includes("multipart/form-data")){
      formData=await request.formData();
      try{payload=JSON.parse(String(formData.get("payload")||"{}"))}catch{return json({error:"INVALID_PAYLOAD"},400)}
    }else{
      payload=await readJson(request)||{};
    }
    const answers=payload.answers||{},uploadedSessions=payload.uploads&&typeof payload.uploads==="object"?payload.uploads:{};
    const fileKeys=new Set(Object.keys(uploadedSessions));
    if(formData){ for(const f of activeFields(config,answers)){ const x=formData.get(`file:${f.key}`); if(x&&typeof x==="object"&&"size" in x&&x.size>0) fileKeys.add(f.key); } }
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

    const submissionCols=await tableColumns(env,"submissions");
    if(submissionCols.has("next_action")){
      await env.DB.prepare("INSERT INTO submissions(code,form_id,form_version,form_snapshot_json,user_id,full_name,email,answers_json,terms_snapshot_json,status,next_action) VALUES(?,?,?,?,?,?,?,?,?,'Đã tiếp nhận','Theo dõi trạng thái hồ sơ và bổ sung thông tin khi được yêu cầu')")
        .bind(code,idForm,row.version,JSON.stringify(config),user?.id||null,fullName,email,JSON.stringify(answers),JSON.stringify(snap)).run();
    }else{
      await env.DB.prepare("INSERT INTO submissions(code,form_id,form_version,form_snapshot_json,user_id,full_name,email,answers_json,terms_snapshot_json,status) VALUES(?,?,?,?,?,?,?,?,?,'Đã tiếp nhận')")
        .bind(code,idForm,row.version,JSON.stringify(config),user?.id||null,fullName,email,JSON.stringify(answers),JSON.stringify(snap)).run();
    }
    try{
      await env.DB.prepare("INSERT INTO case_events(submission_code,event_type,public_label,public_note,status) VALUES(?,'received','TIẾP NHẬN','Hồ sơ đã được hệ thống ghi nhận.','Đã tiếp nhận')").bind(code).run();
    }catch{}

    const fileIds={};
    if(formData){
      for(const f of activeFields(config,answers)){
        if(!["file","signature"].includes(f.type)) continue;
        const file=formData.get(`file:${f.key}`);
        if(file && typeof file==="object" && "size" in file && file.size>0){
          try{
            const stored=await storeFile(env,file,{ownerUserId:user?.id||null,submissionCode:code,fieldKey:f.key,emailVisible:!!f.is_profile_photo});
            fileIds[f.key]=stored;
          }catch(err){
            await env.DB.prepare("DELETE FROM submissions WHERE code=?").bind(code).run();
            return json({error:String(err.message||err)},400);
          }
        }
      }
    }
    for(const f of activeFields(config,answers)){
      if(!["file","signature"].includes(f.type)||!uploadedSessions[f.key])continue;
      try{fileIds[f.key]=await finalizeUploadSession(env,uploadedSessions[f.key],{ownerUserId:user?.id||null,submissionCode:code,fieldKey:f.key,emailVisible:!!f.is_profile_photo});}
      catch(err){await env.DB.prepare("DELETE FROM submissions WHERE code=?").bind(code).run();return json({error:String(err.message||err)},400);}
    }
    if(Object.keys(fileIds).length){
      const merged={...answers,...Object.fromEntries(Object.entries(fileIds).map(([k,v])=>[k,{file_id:v.id,sha256:v.sha256||null}]))};
      await env.DB.prepare("UPDATE submissions SET answers_json=? WHERE code=?").bind(JSON.stringify(merged),code).run();
    }

    const submission=await env.DB.prepare("SELECT * FROM submissions WHERE code=?").bind(code).first();
    if(idForm==="support") await createSupportTicket(env,submission);
    if(idForm==="class"){
      const course=String(answers.course||"");
      const cls=await env.DB.prepare("SELECT id FROM classes WHERE title=? OR level=? ORDER BY created_at DESC LIMIT 1").bind(course,course).first();
      if(cls){
        await env.DB.prepare("INSERT INTO class_enrollments(class_id,user_id,submission_code,full_name,email,status) VALUES(?,?,?,?,?,'Chờ duyệt')")
          .bind(cls.id,user?.id||null,code,fullName,email).run();
      }
    }
    if(idForm==="event"){
      const eventName=String(answers.event_name||"");
      const ev=await env.DB.prepare("SELECT id FROM events WHERE title=? ORDER BY created_at DESC LIMIT 1").bind(eventName).first();
      if(ev){
        const checkin=`CHK-${randomToken(8)}`;
        await env.DB.prepare("INSERT INTO event_registrations(event_id,user_id,full_name,email,status,checkin_code) VALUES(?,?,?,?, 'Đã đăng ký', ?)")
          .bind(ev.id,user?.id||null,fullName,email,checkin).run();
      }
    }

    const labeledAnswers={};
    for(const f of activeFields(config,answers)){
      if(f.type==="file"||f.type==="signature"){ if(fileIds[f.key]) labeledAnswers[f.label]=`${env.APP_URL}/api/files/${fileIds[f.key].id}`; }
      else labeledAnswers[f.label]=answers[f.key]??"";
    }
    const emailParts=answersToEmail(labeledAnswers);
    const submittedAt=new Intl.DateTimeFormat("vi-VN",{
      timeZone:"Asia/Ho_Chi_Minh",hour:"2-digit",minute:"2-digit",day:"2-digit",month:"2-digit",year:"numeric"
    }).format(new Date());
    const profileKey=Object.keys(fileIds).find(k=>{
      const f=activeFields(config,answers).find(x=>x.key===k);
      return f?.is_profile_photo || k==="profile_photo" || k==="photo";
    });
    const profile=profileKey?fileIds[profileKey]:null;
    const profileImageUrl=profile?.email_token?`${env.APP_URL}/api/email-files/${encodeURIComponent(profile.id)}?token=${encodeURIComponent(profile.email_token)}`:"";
    const profileImageBlock=profileImageUrl?`<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:20px;background:linear-gradient(120deg,#faf4ff,#fff7f2);border:1px solid #eadcf0;border-radius:18px;"><tr><td align="center" style="padding:20px"><div style="font-size:12px;font-weight:800;letter-spacing:1.1px;color:#765d7c;text-transform:uppercase;margin-bottom:12px">ẢNH CÁ NHÂN</div><img src="${escapeHtml(profileImageUrl)}" alt="Ảnh cá nhân" width="132" style="display:block;width:132px;height:164px;object-fit:cover;border-radius:14px;border:4px solid #fff;box-shadow:0 8px 22px rgba(89,40,101,.16)"></td></tr></table>`:"";
    const vars={
      code,form_name:row.name,full_name:fullName,email,...emailParts,
      FULL_NAME:escapeHtml(fullName),EMAIL:escapeHtml(email),APPLICATION_ID:escapeHtml(code),
      APPLICATION_TYPE:escapeHtml(row.name),SUBMITTED_AT:escapeHtml(submittedAt),STATUS:"ĐÃ TIẾP NHẬN",
      PROFILE_IMAGE_BLOCK:profileImageBlock
    };
    const receiver=row.recipient_email||await getSetting(env,"receiver_email","skyfirst.ec@gmail.com");
    let confirmation={ok:false},emailQueued=false;
    const sendSubmissionEmails=async()=>{
      await sendTemplatedEmail(env,"submission_internal",receiver,vars);
      if(email) confirmation=await sendTemplatedEmail(env,"submission_confirmation",email,vars);
    };
    if(ctx?.waitUntil){ctx.waitUntil(sendSubmissionEmails());emailQueued=!!email;} else await sendSubmissionEmails();

    await audit(env,request,user,"Tiếp nhận hồ sơ","submission",code,{form_id:idForm,email_queued:emailQueued,email_sent:!!confirmation.ok});
    return json({ok:true,code,status:"Đã tiếp nhận",received_at:new Date().toISOString(),form_name:row.name,next_action:"Theo dõi trạng thái hồ sơ và bổ sung thông tin khi được yêu cầu",tracking_url:`/ho-so?code=${encodeURIComponent(code)}`,email_queued:emailQueued,email_sent:!!confirmation.ok});
  }
  if(p==="/api/lookup/submission"&&request.method==="GET"){
    const rl=await rateLimit(env,`case-lookup:${await ipHash(request)}`,12,300);if(!rl.ok)return json({error:"RATE_LIMIT",message:"Bạn đang tra cứu quá nhanh. Vui lòng thử lại sau."},429,{"Cache-Control":"no-store"});
    const code=String(url.searchParams.get("code")||"").trim();
    const email=String(url.searchParams.get("email")||"").trim().toLowerCase();

    if(!code||!email){
      return json({
        error:"MISSING_FIELDS",
        message:"Vui lòng nhập đầy đủ mã hồ sơ và email đã đăng ký."
      },400);
    }

    const subCols=await tableColumns(env,"submissions");
    const nextActionExpr=subCols.has("next_action")?"s.next_action":"'' AS next_action";
    const resultExpr=subCols.has("result_summary")?"s.result_summary":"'' AS result_summary";
    const row=await env.DB.prepare(`
      SELECT
        s.code,s.form_id,s.full_name,s.email,s.status,s.created_at,s.updated_at,
        ${nextActionExpr},${resultExpr},f.name AS form_name,f.audience
      FROM submissions s
      LEFT JOIN forms f ON f.id=s.form_id
      WHERE s.code=? AND lower(s.email)=lower(?)
      LIMIT 1
    `).bind(code,email).first();

    if(!row){
      return json({
        error:"NOT_FOUND",
        message:"Không tìm thấy hồ sơ phù hợp với mã và email đã nhập."
      },404);
    }

    let timeline=[];
    try{
      const ev=await env.DB.prepare("SELECT public_label label,public_note note,status,created_at FROM case_events WHERE submission_code=? ORDER BY created_at ASC,id ASC").bind(row.code).all();
      timeline=ev.results||[];
    }catch{}
    if(!timeline.length) timeline=[{label:"TIẾP NHẬN",note:"Hồ sơ đã được hệ thống ghi nhận.",status:"Đã tiếp nhận",created_at:row.created_at}];
    return json({
      item:{
        code:row.code,full_name:row.full_name||"",form_id:row.form_id||"",form_name:row.form_name||"",audience:row.audience||"",
        status:row.status||"",submitted_at:row.created_at||"",updated_at:row.updated_at||"",
        next_action:row.next_action||"Theo dõi cập nhật từ Sky First.",result:row.result_summary||"",timeline
      }
    },200,{"Cache-Control":"private, no-store"});
  }

  const credentialPath=p.match(/^\/api\/public\/credentials\/(.+)$/);
  if((p==="/api/lookup/certificate"||credentialPath)&&request.method==="GET"){
    const rl=await rateLimit(env,`credential-lookup:${await ipHash(request)}`,90,60);if(!rl.ok)return json({error:"RATE_LIMIT",message:"Quá nhiều yêu cầu xác thực. Vui lòng thử lại sau."},429,{"Cache-Control":"no-store"});
    const code=credentialPath?decodeURIComponent(credentialPath[1]):String(url.searchParams.get("code")||"").trim();
    if(!code) return json({error:"MISSING_FIELDS",message:"Vui lòng nhập mã GCN/GXN/BK cần xác thực."},400,{"Cache-Control":"no-store"});
    const item=await lookupCredential(env,code);
    if(!item) return json({error:"NOT_FOUND",message:"Không tìm thấy thông tin xác thực phù hợp với mã đã nhập."},404,{"Cache-Control":"no-store"});
    return json({item,verified:item.status==="issued"},200,{"Cache-Control":"no-store"});
  }

  if(p==="/api/public/analytics"&&request.method==="POST"){
    const body=await readJson(request)||{};
    const allowed=new Set(["search_success","search_zero_result","form_start","form_complete","form_abandon","verification_success","verification_not_found","upload_failure","route_view"]);
    if(!allowed.has(body.event)) return json({ok:false},202);
    const device=String(body.device_class||"").slice(0,20);
    const route=String(body.route||"").slice(0,120);
    const outcome=String(body.outcome||"").slice(0,80);
    try{await env.DB.prepare("INSERT INTO portal_events(event_name,category,route,outcome,device_class,meta_json) VALUES(?,?,?,?,?,?)")
      .bind(body.event,String(body.category||"").slice(0,60),route,outcome,device,JSON.stringify({count:Number(body.count||0)||undefined})).run();}catch{}
    return json({ok:true},202);
  }

  return null;
}

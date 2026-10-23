
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
      revoked_at:"",revocation_reason:"",unit_name:"Sky First",role:"",program:"",file_url:"",replacement_code:""
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
    unit_name:metadata.unit_name||metadata.issuer||"Sky First",
    role:metadata.role||metadata.position||"",program:metadata.program||metadata.activity||metadata.event||"",
    file_url:metadata.file_url||metadata.url||"",replacement_code:replacement?.public_id||replacement?.code||replacement?.legacy_code||""
  };
}

export async function publicRoute(request,env,url,ctx){
  const p=url.pathname;

  // Authenticated server-to-server intake from Xanh Sky First. No browser/session auth is accepted.
  if(p==="/api/integrations/xanh/submissions"){
    if(request.method!=="POST") return json({error:"METHOD_NOT_ALLOWED"},405,{"Allow":"POST","Cache-Control":"no-store"});
    const secret=String(env.XANH_CTT_SHARED_SECRET||"");
    if(secret.length<32) return json({error:"INTEGRATION_NOT_CONFIGURED"},503,{"Cache-Control":"no-store"});
    const ts=String(request.headers.get("x-sfn-timestamp")||""),nonce=String(request.headers.get("x-sfn-nonce")||""),sig=String(request.headers.get("x-sfn-signature")||"");
    if(!/^\d{10,13}$/.test(ts)||!/^[A-Za-z0-9_-]{20,100}$/.test(nonce)||!/^v1=[a-f0-9]{64}$/.test(sig)) return json({error:"INVALID_SIGNATURE_HEADERS"},401,{"Cache-Control":"no-store"});
    const tsNum=Number(ts.length===13?Math.floor(Number(ts)/1000):Number(ts));
    if(!Number.isFinite(tsNum)||Math.abs(Math.floor(Date.now()/1000)-tsNum)>300) return json({error:"SIGNATURE_EXPIRED"},401,{"Cache-Control":"no-store"});
    const raw=await request.text();
    if(raw.length>32768) return json({error:"PAYLOAD_TOO_LARGE"},413,{"Cache-Control":"no-store"});
    const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
    const signed=new TextEncoder().encode(`${ts}.${nonce}.${raw}`);
    const digest=Array.from(new Uint8Array(await crypto.subtle.sign("HMAC",key,signed))).map(b=>b.toString(16).padStart(2,"0")).join("");
    const expected=`v1=${digest}`;
    if(sig.length!==expected.length||[...sig].reduce((acc,ch,i)=>acc|(ch.charCodeAt(0)^expected.charCodeAt(i)),0)!==0) return json({error:"INVALID_SIGNATURE"},401,{"Cache-Control":"no-store"});
    // The signature covers the raw body; reserve nonce only after successful authentication.
    const hashBytes=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(raw));
    const payloadHash=Array.from(new Uint8Array(hashBytes)).map(b=>b.toString(16).padStart(2,"0")).join("");
    let body; try{body=JSON.parse(raw)}catch{return json({error:"INVALID_JSON"},400,{"Cache-Control":"no-store"});}
    const source=String(body.source||"");
    const code=String(body.code||"").trim();
    const fullName=String(body.full_name||"").trim().slice(0,200);
    const email=String(body.email||"").trim().toLowerCase().slice(0,254);
    const formName=String(body.form_name||"").trim().slice(0,200);
    const status=String(body.status||"Đã tiếp nhận").trim().slice(0,80);
    const submittedAt=String(body.submitted_at||"").slice(0,40);
    const tracking=String(body.tracking_url||"").slice(0,500);
    if(source!=="xanh-sky-first"||!/^XSF-[A-Z0-9-]{5,100}$/i.test(code)||!fullName||!/^\S+@\S+\.\S+$/.test(email)) return json({error:"INVALID_SUBMISSION"},400,{"Cache-Control":"no-store"});
    try{
      await env.DB.prepare("INSERT INTO integration_nonces(nonce,source,created_at) VALUES(?,?,?)").bind(nonce,source,tsNum).run();
    }catch{return json({error:"REPLAY_DETECTED"},409,{"Cache-Control":"no-store"});}
    try{
      await env.DB.prepare(`INSERT INTO xanh_external_submissions(source,external_code,full_name,email,form_name,external_status,source_submitted_at,source_tracking_url,payload_hash,received_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
        ON CONFLICT(source,external_code) DO UPDATE SET full_name=excluded.full_name,email=excluded.email,form_name=excluded.form_name,external_status=excluded.external_status,source_submitted_at=excluded.source_submitted_at,source_tracking_url=excluded.source_tracking_url,payload_hash=excluded.payload_hash,updated_at=CURRENT_TIMESTAMP`).bind(source,code,fullName,email,formName,status,submittedAt,tracking,payloadHash).run();
      await env.DB.prepare("DELETE FROM integration_nonces WHERE created_at < ?").bind(Math.floor(Date.now()/1000)-86400).run();
      return json({ok:true,source,external_code:code,received:true,duplicate_safe:true,received_at:new Date().toISOString()},200,{"Cache-Control":"no-store"});
    }catch(err){console.error("XANH_INTEGRATION_STORE_FAILED",String(err?.message||err));return json({error:"STORE_FAILED"},500,{"Cache-Control":"no-store"});}
  }

  if(p==="/api/config"&&request.method==="GET"){
    let mods={results:[]},forms={results:[]};
    try{
      if(env.DB){
        mods=await env.DB.prepare("SELECT key,name,category,enabled,sort_order,description FROM modules ORDER BY sort_order").all();
        forms=await env.DB.prepare("SELECT id,name,prefix,description,audience,min_age,version FROM forms WHERE enabled=1 ORDER BY rowid").all();
      }
    }catch(err){ console.error("PUBLIC_CONFIG_DB_FALLBACK",err); }
    const homeStatsDefaults={
      source:"d1",
      values:{programs:null,members:null,certificates:null,partners:null,sponsorship:null},
      labels:{
        programs:"Chương trình & sự kiện",
        members:"Thành viên cộng đồng",
        certificates:"Chứng nhận đã phát hành",
        partners:"Đối tác & đơn vị đồng hành",
        sponsorship:"Tổng tiền tài trợ (thực nhận)"
      },
      sponsorship_basis:"received",
      sponsorship_unit:"VND",
      duration_ms:1200,
      cycles:1
    };
    const storedHomeStats=await getSetting(env,"home_stats",homeStatsDefaults);
    const homeStats={
      ...homeStatsDefaults,
      ...(storedHomeStats&&typeof storedHomeStats==="object"?storedHomeStats:{}),
      values:{...homeStatsDefaults.values,...(storedHomeStats?.values||{})},
      labels:{...homeStatsDefaults.labels,...(storedHomeStats?.labels||{})}
    };
    let d1Stats=null;
    try{
      if(env.DB){
        const hasSponsorship=await tableExists(env,"sponsorship_campaigns");
        const queries=[
          env.DB.prepare("SELECT (SELECT COUNT(*) FROM classes WHERE COALESCE(status,'') NOT IN ('Nháp','draft','private','ẩn','Đã hủy'))+(SELECT COUNT(*) FROM events WHERE COALESCE(status,'') NOT IN ('Nháp','draft','private','ẩn','Đã hủy')) AS n"),
          env.DB.prepare("SELECT CASE WHEN (SELECT COUNT(*) FROM people WHERE status='Đang hoạt động') > 0 THEN (SELECT COUNT(*) FROM people WHERE status='Đang hoạt động') ELSE (SELECT COUNT(*) FROM users WHERE status='active' AND email_verified=1) END AS n"),
          env.DB.prepare("SELECT COUNT(*) AS n FROM certificates WHERE lower(status)='issued' AND issued_at IS NOT NULL"),
          env.DB.prepare("SELECT COUNT(*) AS n FROM units WHERE status='Đang hoạt động'")
        ];
        if(hasSponsorship){
          queries.push(env.DB.prepare("SELECT COUNT(*) AS c, COALESCE(SUM(pledged_amount),0) AS pledged, COALESCE(SUM(received_amount),0) AS received, COALESCE(SUM(disbursed_amount),0) AS disbursed FROM sponsorship_campaigns WHERE visibility='public' AND status IN ('active','completed')"));
        }
        const counts=await env.DB.batch(queries);
        const spRow=hasSponsorship?(counts[4]?.results?.[0]||{}):{c:0,pledged:0,received:0,disbursed:0};
        const spCampaignCount=Number(spRow.c||0);
        d1Stats={
          programs:Number(counts[0]?.results?.[0]?.n||0),
          members:Number(counts[1]?.results?.[0]?.n||0),
          certificates:Number(counts[2]?.results?.[0]?.n||0),
          partners:Number(counts[3]?.results?.[0]?.n||0),
          sponsorship:spCampaignCount>0?Number(spRow.received||0):null,
          sponsorship_pledged:spCampaignCount>0?Number(spRow.pledged||0):null,
          sponsorship_disbursed:spCampaignCount>0?Number(spRow.disbursed||0):null,
          sponsorship_campaigns:spCampaignCount,
          updated_at:new Date().toISOString()
        };
      }
    }catch(err){console.error("HOME_STATS_D1_FALLBACK",err)}
    return json({
      home_stats:{...homeStats,d1_values:d1Stats},
      app_name:await getSetting(env,"app_name","Hệ thống Thông tin Số Sky First"),
      app_name_en:await getSetting(env,"app_name_en","Sky First Digital Information System"),
      app_short_name:await getSetting(env,"app_short_name","Sky First"),
      app_url:env.APP_URL||await getSetting(env,"app_url","https://app.skyfirst.io.vn"),
      website:await getSetting(env,"website","https://skyfirst.io.vn"),
      hotline:await getSetting(env,"hotline","0924 910 210"),
      system_email:await getSetting(env,"system_email","app@skyfirst.io.vn"),
      contact_email:await getSetting(env,"contact_email","lienhe@skyfirst.io.vn"),
      support_email:await getSetting(env,"support_email","support@skyfirst.io.vn"),
      receiver_email:await getSetting(env,"receiver_email","app@skyfirst.io.vn"),
      slogan:await getSetting(env,"brand_slogan","Kết nối tri thức • Lan tỏa giá trị • Vì cộng đồng bền vững"),
      hero_title:await getSetting(env,"hero_title","Hệ thống Thông tin Số Sky First"),
      hero_text:await getSetting(env,"hero_text","Khám phá, tra cứu, đăng ký và quản lý các chương trình, hoạt động, tài liệu, biểu mẫu, chứng nhận và dịch vụ hỗ trợ cộng đồng của Sky First."),
      hero_cover_url:await getSetting(env,"hero_cover_url",""),
      maintenance_mode:await getSetting(env,"maintenance_mode",false),
      header_show_brand:await getSetting(env,"header_show_brand",true),
      header_show_theme:await getSetting(env,"header_show_theme",true),
      header_show_account:await getSetting(env,"header_show_account",true),
      header_account_label:await getSetting(env,"header_account_label","Đăng nhập"),
      footer_description:await getSetting(env,"footer_description","Hệ thống thông tin và dịch vụ số phục vụ tra cứu, đăng ký chương trình, biểu mẫu, chứng nhận và minh bạch hoạt động."),
      footer_email:await getSetting(env,"footer_email","lienhe@skyfirst.io.vn"),
      footer_support_email:await getSetting(env,"footer_support_email","support@skyfirst.io.vn"),
      footer_portal_email:await getSetting(env,"footer_portal_email","app@skyfirst.io.vn"),
      portal_main_label:await getSetting(env,"portal_main_label","Trang Thông tin Điện tử Sky First"),
      portal_main_url:await getSetting(env,"portal_main_url","https://skyfirst.io.vn"),
      portal_tnv_url:await getSetting(env,"portal_tnv_url","https://tnv.skyfirst.io.vn"),
      portal_sfec_url:await getSetting(env,"portal_sfec_url","https://sfec.skyfirst.io.vn"),
      portal_slc_url:await getSetting(env,"portal_slc_url","https://slc.skyfirst.io.vn"),
      portal_member_url:await getSetting(env,"portal_member_url","https://member.skyfirst.io.vn"),
      footer_copyright:await getSetting(env,"footer_copyright","© 2026 Hệ thống Thông tin Số Sky First (app.skyfirst.io.vn)"),
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
    const batchQueries=[
      env.DB.prepare("SELECT 'news' type,title,slug ref,substr(body,1,180) description,published_at date FROM news WHERE status='published' AND (title LIKE ? OR body LIKE ?) ORDER BY COALESCE(published_at,created_at) DESC LIMIT 12").bind(like,like),
      env.DB.prepare("SELECT 'event' type,title,id ref,COALESCE(status,'') description,start_at date FROM events WHERE COALESCE(status,'') NOT IN ('Nháp','draft','private','ẩn') AND (title LIKE ? OR COALESCE(data_json,'') LIKE ?) ORDER BY COALESCE(start_at,created_at) DESC LIMIT 12").bind(like,like),
      env.DB.prepare("SELECT 'unit' type,name title,code ref,COALESCE(unit_type,'') description,NULL date FROM units WHERE status!='Đã giải thể' AND (name LIKE ? OR code LIKE ?) ORDER BY name LIMIT 12").bind(like,like),
      env.DB.prepare("SELECT 'form' type,name title,id ref,COALESCE(description,'') description,NULL date FROM forms WHERE enabled=1 AND (name LIKE ? OR COALESCE(description,'') LIKE ?) ORDER BY rowid LIMIT 12").bind(like,like),
      env.DB.prepare("SELECT 'resource' type,title,id ref,COALESCE(doc_type,'') description,issued_at date FROM documents WHERE visibility='public' AND status='Có hiệu lực' AND (title LIKE ? OR code LIKE ? OR COALESCE(metadata_json,'') LIKE ?) ORDER BY COALESCE(issued_at,created_at) DESC LIMIT 12").bind(like,like,like),
      env.DB.prepare("SELECT 'program' type,title,id ref,trim(COALESCE(level,'') || ' ' || COALESCE(status,'')) description,NULL date FROM classes WHERE COALESCE(status,'') NOT IN ('Nháp','draft','private','ẩn') AND (title LIKE ? OR COALESCE(level,'') LIKE ? OR COALESCE(unit_code,'') LIKE ?) ORDER BY created_at DESC LIMIT 12").bind(like,like,like)
    ];
    const hasSp=await tableExists(env,"sponsorship_campaigns");
    const hasCms=await tableExists(env,"cms_pages");
    if(hasSp) batchQueries.push(env.DB.prepare("SELECT 'sponsorship' type,title,code ref,substr(summary,1,180) description,updated_at date FROM sponsorship_campaigns WHERE visibility='public' AND (title LIKE ? OR code LIKE ? OR summary LIKE ?) ORDER BY updated_at DESC LIMIT 8").bind(like,like,like));
    if(hasCms) batchQueries.push(env.DB.prepare("SELECT 'cms_page' type,title,slug ref,substr(summary,1,180) description,published_at date FROM cms_pages WHERE status='published' AND website_id='app' AND (title LIKE ? OR summary LIKE ?) ORDER BY published_at DESC LIMIT 8").bind(like,like));
    const batchRes=await env.DB.batch(batchQueries);
    const [news,events,units,forms,docs,programs]=batchRes;
    const spRes=hasSp?(batchRes[6]?.results||[]):[];
    const cmsRes=hasCms?(batchRes[hasSp?7:6]?.results||[]):[];
    const pages=[
      {type:"page",title:"Hệ thống Thông tin Số Sky First",ref:"/",description:"Điểm truy cập tập trung các chức năng và dịch vụ số Sky First"},
      {type:"page",title:"Chương trình đào tạo & cộng đồng",ref:"/chuong-trinh",description:"Danh mục chương trình và lớp học thực tế"},
      {type:"page",title:"Sự kiện & Hoạt động",ref:"/su-kien",description:"Lịch sự kiện và hoạt động công khai"},
      {type:"page",title:"Thư viện Tài liệu & PDF",ref:"/tai-lieu",description:"Tài liệu, văn bản và hướng dẫn được phân loại"},
      {type:"page",title:"Biểu mẫu điện tử",ref:"/bieu-mau",description:"Gửi thông tin và hồ sơ trực tuyến"},
      {type:"page",title:"Tra cứu Chứng nhận",ref:"/gcn",description:"Tra cứu Giấy chứng nhận, Giấy xác nhận, Bằng khen bằng mã"},
      {type:"page",title:"Tra cứu Hồ sơ",ref:"/ho-so",description:"Theo dõi tiến trình xử lý hồ sơ đã gửi"},
      {type:"page",title:"Minh bạch Tài trợ",ref:"/tai-tro",description:"Công khai mục tiêu, số tiền cam kết, thực nhận, giải ngân và chứng từ"},
      {type:"page",title:"An toàn & Bảo mật số",ref:"/an-toan",description:"Hướng dẫn bảo vệ tài khoản, cảnh báo giả mạo và báo cáo sự cố"}
    ].filter(x=>(x.title+' '+x.description).toLowerCase().includes(q.toLowerCase()));
    const items=[...pages,...spRes,...cmsRes,...(news.results||[]),...(events.results||[]),...(programs.results||[]),...(units.results||[]),...(forms.results||[]),...(docs.results||[])].slice(0,40);
    if(/^(SFN-(GCN|GXN|BK)-\d{5,8}|\d{8}|\d{3}-(GCN|GXN|BK)-SFN\/\d{4})$/i.test(q)){
      const c=await lookupCredential(env,q); if(c) items.unshift({type:"credential",title:c.code,ref:c.code,description:`${c.type} · ${c.status_text}`,date:c.issued_at});
    }
    return json({items,query:q},200,publicCacheHeaders(60));
  }

  if(p==="/api/public/resources"&&request.method==="GET"){
    const rs=await env.DB.prepare("SELECT id,code,doc_type,title,file_id,issued_at,metadata_json,updated_at FROM documents WHERE visibility='public' AND status='Có hiệu lực' ORDER BY COALESCE(issued_at,created_at) DESC LIMIT 200").all();
    const docs=rs.results||[];
    let versionsMap={};
    if(docs.length && await tableExists(env,"document_versions")){
      try{
        const vrs=await env.DB.prepare("SELECT document_id,version_number,file_id,filename,mime,size,created_at FROM document_versions WHERE is_current=1").all();
        for(const v of vrs.results||[]) versionsMap[v.document_id]=v;
      }catch{}
    }
    const items=docs.map(d=>{
      let meta={}; try{meta=JSON.parse(d.metadata_json||"{}")}catch{}
      const ver=versionsMap[d.id]||null;
      const fid=ver?.file_id||d.file_id||"";
      return {
        ...d,
        file_id:fid,
        category:meta.category||d.doc_type||"Tài liệu",
        description:meta.description||"",
        keywords:meta.keywords||"",
        website_id:meta.website_id||"app",
        allow_download:meta.allow_download!==false,
        current_version:ver?.version_number||Number(meta.version||1),
        mime:ver?.mime||meta.mime||(fid?"application/pdf":""),
        size:ver?.size||meta.size||0,
        preview_url:fid?`/api/files/${encodeURIComponent(fid)}`:"",
        download_url:(fid&&meta.allow_download!==false)?`/api/files/${encodeURIComponent(fid)}?download=1`:""
      };
    });
    return json({items},200,publicCacheHeaders(180));
  }

  if(p==="/api/public/sponsorship"&&request.method==="GET"){
    if(!(await tableExists(env,"sponsorship_campaigns"))){
      return json({summary:{campaigns_count:0,target_amount:0,pledged_amount:0,received_amount:0,disbursed_amount:0,remaining_amount:0,currency:"VND",has_data:false,updated_at:null},campaigns:[],reports:[]},200,publicCacheHeaders(120));
    }
    const [campRs,repRs]=await env.DB.batch([
      env.DB.prepare("SELECT id,code,website_id,title,summary,purpose,target_amount,pledged_amount,received_amount,disbursed_amount,currency,start_at,end_at,status,updated_at FROM sponsorship_campaigns WHERE visibility='public' AND status IN ('active','completed','paused','closed') ORDER BY COALESCE(start_at,created_at) DESC LIMIT 100"),
      env.DB.prepare("SELECT r.id,r.campaign_id,r.title,r.report_period,r.file_id,r.summary,r.published_at,c.code AS campaign_code,c.title AS campaign_title FROM sponsorship_reports r JOIN sponsorship_campaigns c ON c.id=r.campaign_id WHERE r.status='published' AND c.visibility='public' ORDER BY COALESCE(r.published_at,r.created_at) DESC LIMIT 100")
    ]);
    const campaigns=(campRs.results||[]).map(c=>({
      ...c,
      target_amount:Number(c.target_amount||0),
      pledged_amount:Number(c.pledged_amount||0),
      received_amount:Number(c.received_amount||0),
      disbursed_amount:Number(c.disbursed_amount||0),
      remaining_amount:Math.max(0,Number(c.received_amount||0)-Number(c.disbursed_amount||0))
    }));
    const activeForSum=campaigns.filter(c=>["active","completed"].includes(c.status));
    const target_amount=activeForSum.reduce((s,c)=>s+c.target_amount,0);
    const pledged_amount=activeForSum.reduce((s,c)=>s+c.pledged_amount,0);
    const received_amount=activeForSum.reduce((s,c)=>s+c.received_amount,0);
    const disbursed_amount=activeForSum.reduce((s,c)=>s+c.disbursed_amount,0);
    const remaining_amount=Math.max(0,received_amount-disbursed_amount);
    const latestUpdate=campaigns.reduce((m,c)=>(!m||String(c.updated_at)>m)?String(c.updated_at):m,null);
    return json({
      summary:{
        campaigns_count:campaigns.length,
        target_amount,
        pledged_amount,
        received_amount,
        disbursed_amount,
        remaining_amount,
        currency:"VND",
        has_data:campaigns.length>0,
        updated_at:latestUpdate
      },
      campaigns,
      reports:repRs.results||[]
    },200,publicCacheHeaders(120));
  }

  const spDetailMatch=p.match(/^\/api\/public\/sponsorship\/([^/]+)$/);
  if(spDetailMatch&&request.method==="GET"){
    if(!(await tableExists(env,"sponsorship_campaigns"))) return json({error:"NOT_FOUND",message:"Chưa có dữ liệu chương trình tài trợ."},404);
    const codeOrId=decodeURIComponent(spDetailMatch[1]);
    const camp=await env.DB.prepare("SELECT id,code,website_id,title,summary,purpose,target_amount,pledged_amount,received_amount,disbursed_amount,currency,start_at,end_at,status,updated_at FROM sponsorship_campaigns WHERE visibility='public' AND (code=? OR id=?) LIMIT 1").bind(codeOrId,codeOrId).first();
    if(!camp) return json({error:"NOT_FOUND",message:"Không tìm thấy chương trình tài trợ công khai phù hợp."},404);
    const [txRs,repRs]=await env.DB.batch([
      env.DB.prepare("SELECT tx_code,tx_type,amount,currency,public_party_label,purpose,voucher_file_id,occurred_at,verified_at FROM sponsorship_transactions WHERE campaign_id=? AND verification_status='verified' AND is_public=1 ORDER BY occurred_at DESC LIMIT 300").bind(camp.id),
      env.DB.prepare("SELECT id,title,report_period,file_id,summary,published_at FROM sponsorship_reports WHERE campaign_id=? AND status='published' ORDER BY COALESCE(published_at,created_at) DESC LIMIT 50").bind(camp.id)
    ]);
    return json({
      campaign:{
        ...camp,
        target_amount:Number(camp.target_amount||0),
        pledged_amount:Number(camp.pledged_amount||0),
        received_amount:Number(camp.received_amount||0),
        disbursed_amount:Number(camp.disbursed_amount||0),
        remaining_amount:Math.max(0,Number(camp.received_amount||0)-Number(camp.disbursed_amount||0))
      },
      transactions:txRs.results||[],
      reports:repRs.results||[]
    },200,publicCacheHeaders(60));
  }

  if(p==="/api/public/safety-reports"&&request.method==="POST"){
    const ip=await ipHash(request);
    const rl=await rateLimit(env,`safety-report:${ip}`,5,300);
    if(!rl.ok) return json({error:"RATE_LIMIT",message:"Bạn đã gửi quá nhiều báo cáo trong thời gian ngắn. Vui lòng thử lại sau."},429,{"Cache-Control":"no-store"});
    const body=await readJson(request)||{};
    const category=String(body.category||"Báo cáo an toàn").trim().slice(0,80);
    const severity=["Thấp","Trung bình","Cao","Khẩn cấp"].includes(body.severity)?body.severity:"Trung bình";
    const title=String(body.title||"").trim().slice(0,200);
    const description=String(body.description||"").trim().slice(0,4000);
    const reporterName=String(body.reporter_name||"").trim().slice(0,120);
    const reporterEmail=String(body.reporter_email||"").trim().toLowerCase().slice(0,200);
    const affectedUrl=String(body.affected_url||"").trim().slice(0,400);
    if(title.length<5 || description.length<10){
      return json({error:"INVALID_INPUT",message:"Vui lòng nhập tiêu đề (tối thiểu 5 ký tự) và mô tả chi tiết sự cố (tối thiểu 10 ký tự)."},400);
    }
    if(reporterEmail && !/^\S+@\S+\.\S+$/.test(reporterEmail)){
      return json({error:"INVALID_EMAIL",message:"Địa chỉ email liên hệ không hợp lệ."},400);
    }
    const code=await nextCode(env,"SFN-SAFE");
    const id=uid("safe");
    if(await tableExists(env,"safety_reports")){
      await env.DB.prepare("INSERT INTO safety_reports(id,code,category,severity,reporter_name,reporter_email,title,description,affected_url,status,ip_hash) VALUES(?,?,?,?,?,?,?,?,?,'Đã tiếp nhận',?)")
        .bind(id,code,category,severity,reporterName,reporterEmail,title,description,affectedUrl,ip).run();
    }
    const ticketId=uid("ticket");
    await env.DB.prepare("INSERT INTO tickets(id,code,submitter_name,email,ticket_type,priority,status,subject) VALUES(?,?,?,?,?,?, 'Mới', ?)")
      .bind(ticketId,code,reporterName||"Người báo cáo ẩn danh",reporterEmail||"",`An toàn · ${category}`,severity==="Khẩn cấp"?"Khẩn":severity,title).run();
    await env.DB.prepare("INSERT INTO ticket_messages(ticket_id,sender_type,body) VALUES(?,'public',?)")
      .bind(ticketId,`${description}${affectedUrl?`\nURL liên quan: ${affectedUrl}`:""}`).run();
    if(reporterEmail){
      const sendTask=sendTemplatedEmail(env,"support_ticket_received",reporterEmail,{
        full_name:reporterName||reporterEmail,
        ticket_code:code,
        subject:title,
        status:"Đã tiếp nhận"
      });
      if(ctx?.waitUntil) ctx.waitUntil(sendTask); else await sendTask;
    }
    await audit(env,request,null,"Gửi báo cáo an toàn số","safety_report",code,{category,severity});
    return json({ok:true,code,status:"Đã tiếp nhận",message:"Báo cáo an toàn đã được hệ thống ghi nhận. Vui lòng lưu mã tham chiếu để đối soát."},201,{"Cache-Control":"no-store"});
  }

  if(p==="/api/public/pages"&&request.method==="GET"){
    if(!(await tableExists(env,"cms_pages"))) return json({items:[]},200,publicCacheHeaders(120));
    const site=String(url.searchParams.get("website_id")||"app").trim();
    const rs=await env.DB.prepare("SELECT id,website_id,slug,title,summary,cover_file_id,category,tags_json,published_at,updated_at FROM cms_pages WHERE status='published' AND website_id=? ORDER BY COALESCE(published_at,updated_at) DESC LIMIT 100").bind(site).all();
    return json({items:rs.results||[]},200,publicCacheHeaders(120));
  }

  const pageDetailMatch=p.match(/^\/api\/public\/pages\/([^/]+)$/);
  if(pageDetailMatch&&request.method==="GET"){
    if(!(await tableExists(env,"cms_pages"))) return json({error:"NOT_FOUND",message:"Không tìm thấy trang nội dung."},404);
    const slugOrId=decodeURIComponent(pageDetailMatch[1]);
    const site=String(url.searchParams.get("website_id")||"app").trim();
    const row=await env.DB.prepare("SELECT id,website_id,slug,title,summary,cover_file_id,category,tags_json,seo_json,blocks_json,published_at,updated_at FROM cms_pages WHERE status='published' AND website_id=? AND (slug=? OR id=?) LIMIT 1").bind(site,slugOrId,slugOrId).first();
    if(!row) return json({error:"NOT_FOUND",message:"Trang nội dung không tồn tại hoặc chưa được xuất bản."},404);
    let blocks=[],seo={},tags=[];
    try{blocks=JSON.parse(row.blocks_json||"[]")}catch{}
    try{seo=JSON.parse(row.seo_json||"{}")}catch{}
    try{tags=JSON.parse(row.tags_json||"[]")}catch{}
    return json({item:{...row,blocks,seo,tags,blocks_json:undefined,seo_json:undefined,tags_json:undefined}},200,publicCacheHeaders(120));
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
    const receiver=row.recipient_email||await getSetting(env,"receiver_email","app@skyfirst.io.vn");
    const programName=String(answers.course||answers.event_name||row.name||"");
    const enrichVars={...vars,submitted_at:submittedAt,status:"Đã tiếp nhận",program_name:programName,ticket_code:code,subject:answers.request_type||row.name};
    let confirmation={ok:false},emailQueued=false;
    const sendSubmissionEmails=async()=>{
      await sendTemplatedEmail(env,"submission_internal",receiver,enrichVars);
      if(email){
        const tplKey=(idForm==="class"||idForm==="event")?"registration_confirmation":(idForm==="support"?"support_ticket_received":"submission_confirmation");
        confirmation=await sendTemplatedEmail(env,tplKey,email,enrichVars);
        if(!confirmation.ok && tplKey!=="submission_confirmation"){
          confirmation=await sendTemplatedEmail(env,"submission_confirmation",email,enrichVars);
        }
      }
    };
    if(ctx?.waitUntil){ctx.waitUntil(sendSubmissionEmails());emailQueued=!!email;} else await sendSubmissionEmails();

    await audit(env,request,user,"Tiếp nhận hồ sơ","submission",code,{form_id:idForm,email_queued:emailQueued,email_sent:!!confirmation.ok});
    return json({ok:true,code,status:"Đã tiếp nhận",received_at:new Date().toISOString(),form_name:row.name,next_action:"Theo dõi trạng thái hồ sơ và bổ sung thông tin khi được yêu cầu",tracking_url:`/ho-so?code=${encodeURIComponent(code)}`,email_queued:emailQueued,email_sent:!!confirmation.ok});
  }
  if(p==="/api/lookup/submission"&&(request.method==="GET"||request.method==="POST")){
    const rl=await rateLimit(env,`case-lookup:${await ipHash(request)}`,12,300);if(!rl.ok)return json({error:"RATE_LIMIT",message:"Bạn đang tra cứu quá nhanh. Vui lòng thử lại sau."},429,{"Cache-Control":"no-store"});
    const body=request.method==="POST"?(await readJson(request)||{}):{};
    const code=String(body.code??url.searchParams.get("code")??"").trim().slice(0,160);
    const email=String(body.email??url.searchParams.get("email")??"").trim().toLowerCase().slice(0,254);

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

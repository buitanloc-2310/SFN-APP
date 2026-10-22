
import {json, readJson, uid, sha256, ipHash, escapeHtml, pbkdf2, newSalt, isSafeSkyFirstUrl} from "./utils.js";
import {getAuthUser, requirePermission, createInvitedAccount} from "./auth.js";
import {hasPermission, hasAnyPermission, highestRoleLevel, roleLevel, canAccessScope} from "./permissions.js";
import {sendTemplatedEmail, renderEmailContent, EMAIL_EVENT_CATALOG, classifyEmailEvent, renderUniversalEmail, validateAndPrepareAttachments} from "./email.js";

async function audit(env,request,user,action,entityType="",entityId="",details={}){
  await env.DB.prepare("INSERT INTO audit_log(actor_user_id,actor_email,action,entity_type,entity_id,details_json,ip_hash) VALUES(?,?,?,?,?,?,?)")
    .bind(user?.id||null,user?.email||"",action,entityType,entityId,JSON.stringify(details),await ipHash(request)).run();
}
async function setting(env,key,fallback=null){
  const r=await env.DB.prepare("SELECT value_json FROM settings WHERE key=?").bind(key).first();
  if(!r) return fallback; try{return JSON.parse(r.value_json)}catch{return r.value_json}
}
const adminSchemaCache=new Map();
async function adminTableColumns(env,table){
  const key=`cols:${table}`;if(adminSchemaCache.has(key))return adminSchemaCache.get(key);
  try{const rs=await env.DB.prepare(`PRAGMA table_info(${table})`).all();const cols=new Set((rs.results||[]).map(x=>String(x.name||"")));adminSchemaCache.set(key,cols);return cols}catch{return new Set()}
}
async function adminTableExists(env,table){
  const key=`table:${table}`;if(adminSchemaCache.has(key))return adminSchemaCache.get(key);
  try{const row=await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").bind(table).first();const ok=!!row;adminSchemaCache.set(key,ok);return ok}catch{return false}
}
function isOwnerUser(user){return (user?.roles||[]).some(r=>r.role_id==="owner")}
async function nextCounter(env,key){
  await env.DB.prepare("INSERT OR IGNORE INTO counters(key,value) VALUES(?,0)").bind(key).run();
  const r=await env.DB.prepare("UPDATE counters SET value=value+1 WHERE key=? RETURNING value").bind(key).first();
  return Number(r?.value||1);
}

function credentialKind(certType=""){
  const t=String(certType||"").toLowerCase();
  if(t.includes("bằng khen")||t.includes("bang khen")||t==="bk") return "BK";
  if(t.includes("xác nhận")||t.includes("xac nhan")||t==="gxn") return "GXN";
  return "GCN";
}

async function generateCredentialCode(env,certType){
  const kind=credentialKind(certType),cols=await adminTableColumns(env,"certificates");
  const identifiers=["code","public_id","legacy_code"].filter(x=>cols.has(x));
  const hasRegistry=await adminTableExists(env,"issued_document_codes");
  for(let attempt=0;attempt<64;attempt++){
    const bytes=new Uint32Array(1); crypto.getRandomValues(bytes);
    const n=10000000+(bytes[0]%90000000),code=`SFN-${kind}-${n}`;
    let exists=null;
    if(identifiers.length){
      const where=identifiers.map(x=>`${x}=?`).join(" OR ");
      exists=await env.DB.prepare(`SELECT id FROM certificates WHERE ${where} LIMIT 1`).bind(...identifiers.map(()=>code)).first();
    }
    if(!exists&&hasRegistry){exists=await env.DB.prepare("SELECT document_id id FROM issued_document_codes WHERE lookup_code=? LIMIT 1").bind(code).first()}
    if(!exists) return code;
  }
  throw new Error("CREDENTIAL_ID_COLLISION_RETRY_EXHAUSTED");
}
function parseBodyJson(row,key){
  try{return JSON.parse(row?.[key]||"{}")}catch{return {}}
}
async function notifyUser(env,userId,title,body,type="",link=""){
  if(!userId) return;
  await env.DB.prepare("INSERT INTO notifications(id,user_id,title,body,notif_type,link) VALUES(?,?,?,?,?,?)")
    .bind(uid("notif"),userId,title,body,type,link).run();
}
async function userByEmail(env,email){
  return env.DB.prepare("SELECT id,email,full_name FROM users WHERE email=? COLLATE NOCASE").bind(email).first();
}
async function ensureRoleGrantAllowed(actor,roleId){
  if(roleId==="owner") return false;
  if(isOwnerUser(actor)) return true;
  if((actor.roles||[]).some(r=>r.role_id==="super_admin")) return roleId!=="owner";
  return roleLevel(roleId)<highestRoleLevel(actor) && !["owner","super_admin"].includes(roleId);
}
async function listUserRoles(env,userId){
  const rs=await env.DB.prepare("SELECT role_id,scope_unit_code,granted_at,expires_at FROM user_roles WHERE user_id=?").bind(userId).all();
  return rs.results||[];
}

const PUBLIC_CACHE_PATH={news:"/api/public/news",classes:"/api/public/classes",events:"/api/public/events",units:"/api/public/units",documents:"/api/public/resources",sponsorship:"/api/public/sponsorship",pages:"/api/public/pages"};
function invalidatePublicCache(url,paths,ctx){
  if(typeof caches==="undefined") return;
  const unique=[...new Set((paths||[]).filter(Boolean))];if(!unique.length)return;
  const work=Promise.all(unique.map(path=>caches.default.delete(new Request(new URL(path,url.origin),{method:"GET"}))));
  if(ctx?.waitUntil)ctx.waitUntil(work);else return work;
}

const GENERIC = {
  news:{
    permission:"news.manage",table:"news",id:"id",
    fields:["title","slug","body","status","published_at","tags_json","cover_file_id"],
    defaults:{status:"published",tags_json:"[]"}
  },
  classes:{
    permission:"class.manage",table:"classes",id:"id",
    fields:["unit_code","title","level","status","schedule_json","capacity","data_json"],
    defaults:{unit_code:"SFEC",status:"Đang mở đăng ký",schedule_json:"{}",data_json:"{}"}
  },
  events:{
    permission:"event.manage",table:"events",id:"id",
    fields:["unit_code","title","start_at","end_at","status","capacity","data_json"],
    defaults:{unit_code:"SFN",status:"Sắp diễn ra",data_json:"{}"}
  },
  units:{
    permission:"unit.manage",table:"units",id:"code",
    fields:["name","unit_type","manager_name","email","status","data_json"],
    defaults:{status:"Đang hoạt động",data_json:"{}"}
  },
  documents:{
    permission:"document.manage",table:"documents",id:"id",
    fields:["code","doc_type","title","visibility","status","file_id","issued_at","metadata_json"],
    defaults:{visibility:"internal",status:"Có hiệu lực",metadata_json:"{}"}
  },
  tasks:{
    permission:"task.manage",table:"tasks",id:"id",
    fields:["title","description","assigned_to","unit_code","status","priority","due_at"],
    defaults:{status:"Cần làm",priority:"Bình thường"}
  }
};

function makeInsert(table,idField,idValue,fields,data){
  const cols=[idField],vals=[idValue],qs=["?"];
  for(const f of fields){cols.push(f);vals.push(data[f]??null);qs.push("?");}
  return {sql:`INSERT INTO ${table}(${cols.join(",")}) VALUES(${qs.join(",")})`,vals};
}
function makeUpdate(table,idField,idValue,fields,data){
  const sets=[],vals=[];
  for(const f of fields) if(f in data){sets.push(`${f}=?`);vals.push(data[f]);}
  if(!sets.length) return null;
  vals.push(idValue);
  return {sql:`UPDATE ${table} SET ${sets.join(",")}${["news","classes","events","units","documents","tasks"].includes(table)?",updated_at=CURRENT_TIMESTAMP":""} WHERE ${idField}=?`,vals};
}

export async function adminRoute(request,env,url,ctx){
  if(!url.pathname.startsWith("/api/admin/")) return null;
  const user=await getAuthUser(request,env);
  if(!user) return json({error:"AUTH_REQUIRED"},401);
  const p=url.pathname;

  if(p==="/api/admin/dashboard"&&request.method==="GET"){
    const deny=requirePermission(user,"dashboard.view");if(deny)return deny;
    const [subs,pending,people,certs,tickets,approvals,tasks]=await env.DB.batch([
      env.DB.prepare("SELECT COUNT(*) c FROM submissions"),
      env.DB.prepare("SELECT COUNT(*) c FROM submissions WHERE status IN ('Đã tiếp nhận','Cần bổ sung','Mời phỏng vấn','Đang đánh giá')"),
      env.DB.prepare("SELECT COUNT(*) c FROM people WHERE status='Đang hoạt động'"),
      env.DB.prepare("SELECT COUNT(*) c FROM certificates WHERE status='issued'"),
      env.DB.prepare("SELECT COUNT(*) c FROM tickets WHERE status NOT IN ('Đã đóng','Đã giải quyết')"),
      env.DB.prepare("SELECT COUNT(*) c FROM approvals WHERE status='pending'"),
      env.DB.prepare("SELECT COUNT(*) c FROM tasks WHERE status NOT IN ('Hoàn thành','Đã hủy')")
    ]);
    return json({counts:{
      submissions:subs.results?.[0]?.c||0,pending:pending.results?.[0]?.c||0,people:people.results?.[0]?.c||0,
      certificates:certs.results?.[0]?.c||0,tickets:tickets.results?.[0]?.c||0,approvals:approvals.results?.[0]?.c||0,tasks:tasks.results?.[0]?.c||0
    }});
  }

  if(p==="/api/admin/xanh-submissions"&&request.method==="GET"){
    const deny=requirePermission(user,"submission.view");if(deny)return deny;
    const q=String(url.searchParams.get("q")||"").trim().slice(0,120);
    let sql="SELECT id,source,external_code,full_name,email,form_name,external_status,source_submitted_at,source_tracking_url,received_at,updated_at FROM xanh_external_submissions WHERE 1=1",vals=[];
    if(q){sql+=" AND (external_code LIKE ? OR full_name LIKE ? OR email LIKE ?)";vals.push(`%${q}%`,`%${q}%`,`%${q}%`)}
    sql+=" ORDER BY received_at DESC LIMIT 500";
    const rs=await env.DB.prepare(sql).bind(...vals).all();return json({items:rs.results||[], history:rs.results||[]});
  }

  if(p==="/api/admin/submissions"&&request.method==="GET"){
    const deny=requirePermission(user,"submission.view");if(deny)return deny;
    const status=url.searchParams.get("status"),form=url.searchParams.get("form"),q=url.searchParams.get("q");
    let sql="SELECT code,form_id,full_name,email,status,assigned_to,score,internal_note,created_at,updated_at FROM submissions WHERE 1=1",vals=[];
    if(!hasPermission(user,"submission.manage")&&!hasPermission(user,"approval.decide")&&hasPermission(user,"submission.manage_assigned")){
      sql+=" AND assigned_to=?";vals.push(user.id);
    }
    if(status){sql+=" AND status=?";vals.push(status)}
    if(form){sql+=" AND form_id=?";vals.push(form)}
    if(q){sql+=" AND (code LIKE ? OR full_name LIKE ? OR email LIKE ?)";vals.push(`%${q}%`,`%${q}%`,`%${q}%`)}
    sql+=" ORDER BY id DESC LIMIT 1000";
    const rs=await env.DB.prepare(sql).bind(...vals).all();
    return json({items:rs.results||[]});
  }

  const subMatch=p.match(/^\/api\/admin\/submissions\/([^/]+)$/);
  if(subMatch&&request.method==="GET"){
    const deny=requirePermission(user,"submission.view");if(deny)return deny;
    const row=await env.DB.prepare("SELECT * FROM submissions WHERE code=?").bind(decodeURIComponent(subMatch[1])).first();
    if(!row)return json({error:"NOT_FOUND"},404);
    if(!hasPermission(user,"submission.manage")&&!hasPermission(user,"approval.decide")&&hasPermission(user,"submission.manage_assigned")&&Number(row.assigned_to)!==Number(user.id)){
      return json({error:"FORBIDDEN",message:"Bạn chỉ được xem hồ sơ được phân công xử lý."},403);
    }
    const files=await env.DB.prepare("SELECT id,field_key,filename,mime,size,created_at FROM files WHERE submission_code=?").bind(row.code).all();
    return json({item:{...row,answers:parseBodyJson(row,"answers_json"),terms:JSON.parse(row.terms_snapshot_json||"[]")},files:files.results||[]});
  }

  if(subMatch&&request.method==="PATCH"){
    const code=decodeURIComponent(subMatch[1]),body=await readJson(request)||{};
    const current=await env.DB.prepare("SELECT * FROM submissions WHERE code=?").bind(code).first();
    if(!current)return json({error:"NOT_FOUND"},404);
    const canManageAll=hasPermission(user,"submission.manage");
    const canManageAssigned=hasPermission(user,"submission.manage_assigned")&&Number(current.assigned_to)===Number(user.id);
    if(!canManageAll&&!canManageAssigned) return json({error:"FORBIDDEN",permission:"submission.manage"},403);
    const allowed=canManageAll?["status","assigned_to","score","internal_note","next_action","result_summary"]:["status","score","internal_note","next_action","result_summary"];
    const sets=[],vals=[];
    for(const k of allowed) if(k in body){sets.push(`${k}=?`);vals.push(body[k])}
    if(sets.length){
      vals.push(code); await env.DB.prepare(`UPDATE submissions SET ${sets.join(",")},updated_at=CURRENT_TIMESTAMP WHERE code=?`).bind(...vals).run();
    }
    if(body.status&&body.status!==current.status){
      const publicLabel={
        "Đã tiếp nhận":"TIẾP NHẬN","Đang xem xét":"KIỂM TRA","Đang kiểm tra":"KIỂM TRA","Đang xử lý":"XỬ LÝ",
        "Cần bổ sung":"CẦN BỔ SUNG","Mời phỏng vấn":"XỬ LÝ","Đang đánh giá":"XỬ LÝ","Đã duyệt":"HOÀN TẤT","Hoàn tất":"HOÀN TẤT","Đã hoàn tất":"HOÀN TẤT"
      }[body.status]||String(body.status).toUpperCase();
      await env.DB.prepare("INSERT INTO case_events(submission_code,event_type,public_label,public_note,status,created_by) VALUES(?,?,?,?,?,?)")
        .bind(code,"status",publicLabel,String(body.note||body.next_action||""),body.status,user.id).run();
    }
    await audit(env,request,user,"Cập nhật hồ sơ","submission",code,{status:body.status,assigned_to:body.assigned_to,score:body.score,next_action:body.next_action,result_summary:body.result_summary});
    if(body.status&&current.email&&body.status!==current.status){
      const emailVars={
        code,
        full_name:current.full_name||current.email,
        status:body.status,
        requirement_note:body.note||body.next_action||"Vui lòng kiểm tra thông tin hồ sơ trên hệ thống.",
        result_summary:body.result_summary||body.note||`Hồ sơ đã chuyển sang trạng thái: ${body.status}.`,
        note_block:body.note?`<p>${escapeHtml(body.note)}</p>`:""
      };
      const autoEventKey = classifyEmailEvent("submission_status", body.status);
      await sendTemplatedEmail(env, autoEventKey, current.email, {
        ...emailVars,
        request_id: code,
        recipient_name: current.full_name || current.email,
        registration_type: current.form_id || "Hồ sơ đăng ký",
        additional_info: body.note || body.result_summary || "",
        next_steps: body.next_action || emailVars.requirement_note,
        language: body.language || "vi"
      }, {
        attachments: Array.isArray(body.attachments) ? body.attachments : [],
        actorUserId: user.id
      });
      if(current.user_id) await notifyUser(env,current.user_id,`Hồ sơ ${code}: ${body.status}`,body.note||"","submission",`/ho-so?code=${encodeURIComponent(code)}`);
    }
    return json({ok:true});
  }

  const convertMatch=p.match(/^\/api\/admin\/submissions\/([^/]+)\/convert-person$/);
  if(convertMatch&&request.method==="POST"){
    const deny=requirePermission(user,"people.manage");if(deny)return deny;
    const code=decodeURIComponent(convertMatch[1]);
    const s=await env.DB.prepare("SELECT * FROM submissions WHERE code=?").bind(code).first();
    if(!s)return json({error:"NOT_FOUND"},404);
    const exists=await env.DB.prepare("SELECT id FROM people WHERE source_submission_code=?").bind(code).first();
    if(exists)return json({error:"ALREADY_CONVERTED"},409);
    const a=parseBodyJson(s,"answers_json");
    let linked=await userByEmail(env,s.email||"");
    const res=await env.DB.prepare("INSERT INTO people(user_id,source_submission_code,full_name,email,phone,unit_code,position,status,joined_at,profile_json) VALUES(?,?,?,?,?,?,?,'Đang hoạt động',date('now'),?)")
      .bind(linked?.id||null,code,s.full_name||"",s.email||"",a.phone||"",a.area||a.volunteer_type||"SFN",a.position||s.form_id,JSON.stringify({teaching_scope:a.teaching_scope||null})).run();
    const pid=res.meta.last_row_id;
    await env.DB.prepare("INSERT INTO people_history(person_id,event_type,details_json,created_by) VALUES(?,'Tiếp nhận',?,?)")
      .bind(pid,JSON.stringify({source_submission_code:code}),user.id).run();
    await audit(env,request,user,"Tiếp nhận thành hồ sơ nhân sự","person",String(pid),{source:code});
    return json({ok:true,person_id:pid});
  }

  if(p==="/api/admin/users"&&request.method==="GET"){
    const deny=requirePermission(user,"user.view");if(deny)return deny;
    const rs=await env.DB.prepare("SELECT id,email,full_name,status,email_verified,must_change_password,totp_enabled,created_at FROM users ORDER BY id DESC LIMIT 1000").all();
    const actorIsOwner=isOwnerUser(user);
    const items=[];
    for(const u of rs.results||[]){
      const roles=await listUserRoles(env,u.id);
      const isOwner=roles.some(r=>r.role_id==="owner");
      if(isOwner&&!actorIsOwner) continue;
      items.push({...u,roles,is_owner:isOwner});
    }
    return json({items});
  }

  if(p==="/api/admin/users"&&request.method==="POST"){
    return createInvitedAccount(request,env,user,await readJson(request));
  }

  const rolesMatch=p.match(/^\/api\/admin\/users\/(\d+)\/roles$/);
  if(rolesMatch&&request.method==="PUT"){
    const deny=requirePermission(user,"user.manage");if(deny)return deny;
    const targetId=Number(rolesMatch[1]),body=await readJson(request)||{},roles=Array.isArray(body.roles)?body.roles:[];
    const target=await env.DB.prepare("SELECT id,email FROM users WHERE id=?").bind(targetId).first();
    if(!target)return json({error:"NOT_FOUND"},404);
    const targetRoles=await listUserRoles(env,targetId);
    if(targetRoles.some(r=>r.role_id==="owner")&&!isOwnerUser(user)) return json({error:"OWNER_PROTECTED"},403);
    if(roles.some(r=>(r.role_id||r)==="owner")) return json({error:"OWNER_ROLE_NOT_ASSIGNABLE_HERE"},403);
    if(target.email.toLowerCase()==="skyfirst.ec@gmail.com" && !(user.roles||[]).some(r=>r.role_id==="super_admin"))
      return json({error:"PROTECTED_SUPER_ADMIN"},403);
    for(const r of roles) if(!(await ensureRoleGrantAllowed(user,r.role_id||r))) return json({error:"ROLE_TOO_HIGH",role:r.role_id||r},403);
    const existing=await listUserRoles(env,targetId);
    for(const old of existing){
      if(old.role_id==="super_admin"&&target.email.toLowerCase()==="skyfirst.ec@gmail.com"&&!roles.some(r=>(r.role_id||r)==="super_admin"))
        return json({error:"ROOT_SUPER_ADMIN_CANNOT_BE_REMOVED"},403);
    }
    if(target.email.toLowerCase()==="skyfirst.ec@gmail.com") await env.DB.prepare("DELETE FROM user_roles WHERE user_id=? AND role_id!='super_admin'").bind(targetId).run(); else await env.DB.prepare("DELETE FROM user_roles WHERE user_id=?").bind(targetId).run();
    for(const r0 of roles){
      const role=typeof r0==="string"?r0:r0.role_id,scope=typeof r0==="string"?"":(r0.scope_unit_code||""),expires=typeof r0==="string"?null:(r0.expires_at||null);
      if(role==="super_admin"&&target.email.toLowerCase()!=="skyfirst.ec@gmail.com"&&!(user.roles||[]).some(r=>r.role_id==="super_admin")) continue;
      await env.DB.prepare("INSERT OR REPLACE INTO user_roles(user_id,role_id,scope_unit_code,granted_by,expires_at) VALUES(?,?,?,?,?)")
        .bind(targetId,role,scope,user.id,expires).run();
    }
    await audit(env,request,user,"Cập nhật quyền tài khoản","user",String(targetId),{roles});
    return json({ok:true,roles:await listUserRoles(env,targetId)});
  }


  const userResetMatch=p.match(/^\/api\/admin\/users\/(\d+)\/reset-password$/);
  if(userResetMatch&&request.method==="POST"){
    const deny=requirePermission(user,"user.manage");if(deny)return deny;
    const targetId=Number(userResetMatch[1]),target=await env.DB.prepare("SELECT id,email,full_name FROM users WHERE id=?").bind(targetId).first();
    if(!target)return json({error:"NOT_FOUND"},404);
    const targetRoles=await listUserRoles(env,targetId);
    if(targetRoles.some(r=>r.role_id==="owner")&&!isOwnerUser(user)) return json({error:"OWNER_PROTECTED"},403);
    if(target.email.toLowerCase()==="skyfirst.ec@gmail.com")return json({error:"ROOT_SUPER_ADMIN_PROTECTED"},403);
    const chars="ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#%",rnd=new Uint8Array(16);crypto.getRandomValues(rnd);
    let temp="SFN!";for(const b of rnd)temp+=chars[b%chars.length];
    const salt=newSalt(),hash=await pbkdf2(temp,salt,100000);
    await env.DB.batch([
      env.DB.prepare("UPDATE users SET password_salt=?,password_hash=?,password_iterations=100000,must_change_password=1,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(salt,hash,targetId),
      env.DB.prepare("DELETE FROM sessions WHERE user_id=?").bind(targetId)
    ]);
    await sendTemplatedEmail(env,"account_invite",target.email,{full_name:target.full_name||target.email,email:target.email,temp_password:temp});
    await audit(env,request,user,"Đặt lại mật khẩu tạm thời","user",String(targetId),{});
    return json({ok:true,temp_password:temp});
  }

  const userStatusMatch=p.match(/^\/api\/admin\/users\/(\d+)\/status$/);
  if(userStatusMatch&&request.method==="PATCH"){
    const deny=requirePermission(user,"user.manage");if(deny)return deny;
    const targetId=Number(userStatusMatch[1]),body=await readJson(request)||{},status=String(body.status||"active");
    const target=await env.DB.prepare("SELECT email FROM users WHERE id=?").bind(targetId).first();
    if(!target)return json({error:"NOT_FOUND"},404);
    const targetRoles=await listUserRoles(env,targetId);
    if(targetRoles.some(r=>r.role_id==="owner")){
      if(!isOwnerUser(user)) return json({error:"OWNER_PROTECTED"},403);
      if(status!=="active") return json({error:"OWNER_CANNOT_BE_DISABLED"},409);
    }
    if(target.email.toLowerCase()==="skyfirst.ec@gmail.com"&&status!=="active") return json({error:"ROOT_SUPER_ADMIN_PROTECTED"},403);
    await env.DB.batch([
      env.DB.prepare("UPDATE users SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(status,targetId),
      env.DB.prepare("DELETE FROM sessions WHERE user_id=?").bind(targetId)
    ]);
    await audit(env,request,user,"Đổi trạng thái tài khoản","user",String(targetId),{status});
    return json({ok:true});
  }

  if(p==="/api/admin/people"&&request.method==="GET"){
    const deny=requirePermission(user,"people.view");if(deny)return deny;
    const rs=await env.DB.prepare("SELECT * FROM people ORDER BY id DESC LIMIT 1500").all();
    return json({items:rs.results||[]});
  }

  if(p==="/api/admin/modules"&&request.method==="GET"){
    const deny=requirePermission(user,"dashboard.view");if(deny)return deny;
    const rs=await env.DB.prepare("SELECT * FROM modules ORDER BY sort_order").all();return json({items:rs.results||[]});
  }
  if(p==="/api/admin/modules"&&request.method==="PUT"){
    const deny=requirePermission(user,"module.manage");if(deny)return deny;
    const body=await readJson(request)||{},items=Array.isArray(body.items)?body.items:[];
    for(const x of items) await env.DB.prepare("UPDATE modules SET enabled=? WHERE key=?").bind(x.enabled?1:0,x.key).run();
    await audit(env,request,user,"Cập nhật trạng thái Modules","module","*",{count:items.length});
    invalidatePublicCache(url,["/api/config"],ctx);
    return json({ok:true});
  }

  if(p==="/api/admin/media"&&request.method==="GET"){
    const deny=requirePermission(user,"file.manage");if(deny)return deny;
    if(!env.FILES)return json({error:"STORAGE_UNAVAILABLE"},503);
    const list=await env.FILES.list({prefix:"public-media/",limit:500});
    return json({items:(list.objects||[]).map(o=>({
      key:o.key.slice("public-media/".length),size:o.size,uploaded:o.uploaded,etag:o.etag,
      url:`/media/${encodeURIComponent(o.key.slice("public-media/".length)).replaceAll("%2F","/")}`
    }))});
  }
  if(p==="/api/admin/media"&&request.method==="POST"){
    const deny=requirePermission(user,"file.manage");if(deny)return deny;
    if(!env.FILES)return json({error:"STORAGE_UNAVAILABLE"},503);
    const fd=await request.formData(),file=fd.get("file");
    if(!file||typeof file!=="object"||!("size" in file)||!file.size)return json({error:"FILE_REQUIRED"},400);
    if(file.size>15*1024*1024)return json({error:"FILE_TOO_LARGE",max_mb:15},400);
    const allowed=new Set(["image/jpeg","image/png","image/webp","image/gif"]);
    if(!allowed.has(file.type))return json({error:"IMAGE_TYPE_NOT_ALLOWED",message:"Chỉ hỗ trợ JPG, PNG, WEBP hoặc GIF."},400);
    const bytes=await file.arrayBuffer(),head=new Uint8Array(bytes.slice(0,16));
    const ascii=(start,end)=>String.fromCharCode(...head.slice(start,end));
    const signatureOk=file.type==="image/jpeg"?(head[0]===0xff&&head[1]===0xd8&&head[2]===0xff)
      :file.type==="image/png"?(head[0]===0x89&&ascii(1,4)==="PNG")
      :file.type==="image/webp"?(ascii(0,4)==="RIFF"&&ascii(8,12)==="WEBP")
      :file.type==="image/gif"?(ascii(0,4)==="GIF8"):false;
    if(!signatureOk)return json({error:"IMAGE_SIGNATURE_MISMATCH",message:"Nội dung file không khớp định dạng ảnh đã chọn."},400);
    const safe=String(file.name||"image").normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g,"-").replace(/^-+|-+$/g,"").slice(0,120)||"image";
    const key=`${new Date().toISOString().slice(0,10)}/${crypto.randomUUID()}-${safe}`;
    await env.FILES.put(`public-media/${key}`,bytes,{httpMetadata:{contentType:file.type}});
    await audit(env,request,user,"Upload ảnh giao diện","media",key,{size:file.size,mime:file.type});
    return json({ok:true,key,url:`/media/${key}`},201);
  }
  const mediaMatch=p.match(/^\/api\/admin\/media\/(.+)$/);
  if(mediaMatch&&request.method==="DELETE"){
    const deny=requirePermission(user,"file.manage");if(deny)return deny;
    if(!env.FILES)return json({error:"STORAGE_UNAVAILABLE"},503);
    const key=decodeURIComponent(mediaMatch[1]);
    if(!key||key.includes(".."))return json({error:"INVALID_PATH"},400);
    const mediaUrl=`/media/${key}`;
    const [settingsUse,newsUse]=await env.DB.batch([
      env.DB.prepare("SELECT COUNT(*) c FROM settings WHERE value_json LIKE ?").bind(`%${mediaUrl}%`),
      env.DB.prepare("SELECT COUNT(*) c FROM news WHERE cover_file_id=?").bind(key)
    ]);
    const refs=Number(settingsUse.results?.[0]?.c||0)+Number(newsUse.results?.[0]?.c||0);
    if(refs>0)return json({error:"ASSET_IN_USE",message:"Ảnh đang được dùng trong cấu hình hoặc làm ảnh đại diện bài viết. Hãy thay ảnh trong nội dung trước khi xóa.",references:refs},409);
    await env.FILES.delete(`public-media/${key}`);
    await audit(env,request,user,"Xóa ảnh giao diện","media",key,{});
    return json({ok:true});
  }

  if(p==="/api/admin/settings"&&request.method==="GET"){
    const deny=requirePermission(user,"settings.manage");if(deny)return deny;
    const rs=await env.DB.prepare("SELECT key,value_json,updated_at FROM settings ORDER BY key").all();
    return json({items:(rs.results||[]).map(x=>({...x,value:JSON.parse(x.value_json)}))});
  }
  if(p==="/api/admin/settings"&&request.method==="PUT"){
    const deny=requirePermission(user,"settings.manage");if(deny)return deny;
    const body=await readJson(request)||{},items=body.items||{};
    for(const [k,v] of Object.entries(items)){
      await env.DB.prepare("INSERT INTO settings(key,value_json,updated_by) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json,updated_at=CURRENT_TIMESTAMP,updated_by=excluded.updated_by")
        .bind(k,JSON.stringify(v),user.id).run();
    }
    await audit(env,request,user,"Cập nhật cài đặt hệ thống","settings","*",{keys:Object.keys(items)});
    invalidatePublicCache(url,["/api/config"],ctx);
    return json({ok:true});
  }

  if(p==="/api/admin/forms"&&request.method==="GET"){
    const deny=requirePermission(user,"form.view");if(deny)return deny;
    const rs=await env.DB.prepare("SELECT id,name,prefix,description,audience,min_age,enabled,recipient_email,version,config_json,updated_at FROM forms ORDER BY rowid").all();
    return json({items:(rs.results||[]).map(x=>({...x,config:JSON.parse(x.config_json),config_json:undefined}))});
  }
  if(p==="/api/admin/forms"&&request.method==="POST"){
    const deny=requirePermission(user,"form.manage");if(deny)return deny;
    const body=await readJson(request)||{},idForm=String(body.id||uid("form")).replace(/[^a-zA-Z0-9_-]/g,"");
    if(!body.name||!body.prefix||!body.config) return json({error:"INVALID_INPUT"},400);
    const cfg={...body.config};
    cfg.form_type=cfg.form_type||body.form_type||"general";
    if(typeof cfg.profile_photo_required!=="boolean") cfg.profile_photo_required=false;
    const cfgJson=JSON.stringify(cfg);
    await env.DB.prepare("INSERT INTO forms(id,name,prefix,description,audience,min_age,enabled,recipient_email,version,config_json,updated_by) VALUES(?,?,?,?,?,?,1,?,1,?,?)")
      .bind(idForm,body.name,body.prefix,body.description||"",body.audience||"public",body.min_age??null,body.recipient_email||"app@skyfirst.io.vn",cfgJson,user.id).run();
    try{await env.DB.prepare("INSERT INTO form_revisions(form_id,version,config_json,status,created_by) VALUES(?,1,?,'published',?)").bind(idForm,cfgJson,user.id).run();}catch{}
    await audit(env,request,user,"Tạo biểu mẫu","form",idForm,{name:body.name,version:1});invalidatePublicCache(url,["/api/config"],ctx);return json({ok:true,id:idForm});
  }
  const formMatch=p.match(/^\/api\/admin\/forms\/([^/]+)$/);
  if(formMatch&&request.method==="PUT"){
    const deny=requirePermission(user,"form.manage");if(deny)return deny;
    const fid=decodeURIComponent(formMatch[1]),body=await readJson(request)||{};
    const current=await env.DB.prepare("SELECT * FROM forms WHERE id=?").bind(fid).first();if(!current)return json({error:"NOT_FOUND"},404);
    const nextVersion=Number(current.version)+1,nextConfig=JSON.stringify(body.config||JSON.parse(current.config_json));
    await env.DB.prepare("UPDATE forms SET name=?,prefix=?,description=?,audience=?,min_age=?,enabled=?,recipient_email=?,version=?,config_json=?,updated_at=CURRENT_TIMESTAMP,updated_by=? WHERE id=?")
      .bind(body.name||current.name,body.prefix||current.prefix,body.description??current.description,body.audience||current.audience,body.min_age??current.min_age,body.enabled===false?0:1,body.recipient_email||current.recipient_email,nextVersion,nextConfig,user.id,fid).run();
    try{await env.DB.prepare("INSERT INTO form_revisions(form_id,version,config_json,status,created_by) VALUES(?,?,?,'published',?)").bind(fid,nextVersion,nextConfig,user.id).run();}catch{}
    await audit(env,request,user,"Cập nhật biểu mẫu","form",fid,{version:nextVersion});invalidatePublicCache(url,["/api/config"],ctx);return json({ok:true,version:nextVersion});
  }

  if(p==="/api/admin/terms"&&request.method==="GET"){
    const deny=requirePermission(user,"form.view");if(deny)return deny;
    const rs=await env.DB.prepare("SELECT * FROM terms ORDER BY code").all();return json({items:rs.results||[]});
  }
  const termMatch=p.match(/^\/api\/admin\/terms\/(.+)$/);
  if(termMatch&&request.method==="PUT"){
    const deny=requirePermission(user,"form.manage");if(deny)return deny;
    const code=decodeURIComponent(termMatch[1]),body=await readJson(request)||{};
    await env.DB.prepare("UPDATE terms SET name=?,version=?,scope=?,body=?,status=?,updated_at=CURRENT_TIMESTAMP,updated_by=? WHERE code=?")
      .bind(body.name,body.version,body.scope||"",body.body||"",body.status||"published",user.id,code).run();
    await audit(env,request,user,"Cập nhật điều khoản","term",code,{version:body.version});return json({ok:true});
  }

  const genericList=p.match(/^\/api\/admin\/content\/(news|classes|events|units|documents|tasks)$/);
  if(genericList&&request.method==="GET"){
    const type=genericList[1],g=GENERIC[type];
    const canView=hasPermission(user,g.permission)||(type==="documents"&&hasPermission(user,"document.view"))||(type==="units"&&hasPermission(user,"unit.view"));
    if(!canView) return json({error:"FORBIDDEN",permission:g.permission},403);
    const rs=await env.DB.prepare(`SELECT * FROM ${g.table} ORDER BY rowid DESC LIMIT 1500`).all();return json({items:rs.results||[]});
  }
  if(genericList&&request.method==="POST"){
    const type=genericList[1],g=GENERIC[type],deny=requirePermission(user,g.permission);if(deny)return deny;
    const body=await readJson(request)||{},data={...g.defaults,...body};
    const idValue=body[g.id]|| (g.id==="code"?String(body.code||"").trim():uid(type.slice(0,3)));
    if(!idValue) return json({error:"MISSING_ID"},400);
    const ins=makeInsert(g.table,g.id,idValue,g.fields,data);
    await env.DB.prepare(ins.sql).bind(...ins.vals).run();
    if(type==="documents" && data.file_id && await adminTableExists(env,"document_versions")){
      try{
        const fMeta=await env.DB.prepare("SELECT filename,mime,size,sha256 FROM files WHERE id=?").bind(data.file_id).first();
        await env.DB.prepare("INSERT INTO document_versions(id,document_id,version_number,file_id,filename,mime,size,sha256,change_note,is_current,created_by) VALUES(?,?,1,?,?,?,?,?,'Phiên bản khởi tạo',1,?)")
          .bind(uid("docver"),String(idValue),data.file_id,fMeta?.filename||"",fMeta?.mime||"application/pdf",fMeta?.size||0,fMeta?.sha256||null,user.id).run();
      }catch{}
    }
    await audit(env,request,user,`Tạo ${type}`,type,String(idValue),data);invalidatePublicCache(url,[PUBLIC_CACHE_PATH[type]],ctx);return json({ok:true,id:idValue});
  }
  const genericOne=p.match(/^\/api\/admin\/content\/(news|classes|events|units|documents|tasks)\/([^/]+)$/);
  if(genericOne&&request.method==="PUT"){
    const [_,type,idRaw]=genericOne,g=GENERIC[type],deny=requirePermission(user,g.permission);if(deny)return deny;
    const idValue=decodeURIComponent(idRaw),body=await readJson(request)||{},upd=makeUpdate(g.table,g.id,idValue,g.fields,body);
    if(upd) await env.DB.prepare(upd.sql).bind(...upd.vals).run();
    await audit(env,request,user,`Cập nhật ${type}`,type,idValue,body);invalidatePublicCache(url,[PUBLIC_CACHE_PATH[type]],ctx);return json({ok:true});
  }
  if(genericOne&&request.method==="DELETE"){
    const [_,type,idRaw]=genericOne,g=GENERIC[type],deny=requirePermission(user,g.permission);if(deny)return deny;
    const idValue=decodeURIComponent(idRaw);
    if(type==="documents" && await adminTableExists(env,"cms_pages")){
      const pageRef=await env.DB.prepare("SELECT COUNT(*) c FROM cms_pages WHERE blocks_json LIKE ?").bind(`%${idValue}%`).first();
      if(Number(pageRef?.c||0)>0) return json({error:"DOCUMENT_IN_USE",message:"Tài liệu đang được nhúng trên trang nội dung CMS. Vui lòng gỡ khỏi trang trước khi xóa.",references:Number(pageRef.c)},409);
    }
    await env.DB.prepare(`DELETE FROM ${g.table} WHERE ${g.id}=?`).bind(idValue).run();
    await audit(env,request,user,`Xóa ${type}`,type,idValue,{});invalidatePublicCache(url,[PUBLIC_CACHE_PATH[type]],ctx);return json({ok:true});
  }


  if(p==="/api/admin/teaching-scopes"&&request.method==="GET"){
    const deny=requirePermission(user,"people.view");if(deny)return deny;
    const rs=await env.DB.prepare(`SELECT ts.*,p.full_name,p.email FROM teaching_scopes ts JOIN people p ON p.id=ts.person_id ORDER BY ts.created_at DESC LIMIT 1000`).all();
    return json({items:rs.results||[]});
  }
  if(p==="/api/admin/teaching-scopes"&&request.method==="POST"){
    const deny=requirePermission(user,"people.manage");if(deny)return deny;
    const body=await readJson(request)||{};
    if(!body.person_id||!body.scope)return json({error:"INVALID_INPUT"},400);
    const idT=uid("teach");
    await env.DB.prepare("INSERT INTO teaching_scopes(id,person_id,scope,status,assessment_note,approved_by,approved_at) VALUES(?,?,?,?,?,?,CASE WHEN ?='Đã duyệt' THEN CURRENT_TIMESTAMP ELSE NULL END)")
      .bind(idT,body.person_id,body.scope,body.status||"Đang đánh giá",body.assessment_note||"",body.status==="Đã duyệt"?user.id:null,body.status||"Đang đánh giá").run();
    await audit(env,request,user,"Tạo phạm vi giảng dạy","teaching_scope",idT,body);return json({ok:true,id:idT});
  }
  const teachMatch=p.match(/^\/api\/admin\/teaching-scopes\/([^/]+)$/);
  if(teachMatch&&request.method==="PATCH"){
    const deny=requirePermission(user,"people.manage");if(deny)return deny;
    const idT=decodeURIComponent(teachMatch[1]),body=await readJson(request)||{};
    await env.DB.prepare("UPDATE teaching_scopes SET status=?,assessment_note=?,approved_by=CASE WHEN ?='Đã duyệt' THEN ? ELSE approved_by END,approved_at=CASE WHEN ?='Đã duyệt' THEN CURRENT_TIMESTAMP ELSE approved_at END,updated_at=CURRENT_TIMESTAMP WHERE id=?")
      .bind(body.status||"Đang đánh giá",body.assessment_note||"",body.status||"",user.id,body.status||"",idT).run();
    await audit(env,request,user,"Cập nhật phạm vi giảng dạy","teaching_scope",idT,body);return json({ok:true});
  }

  if(p==="/api/admin/data-requests"&&request.method==="GET"){
    const deny=requirePermission(user,"privacy.manage");if(deny)return deny;
    const rs=await env.DB.prepare("SELECT * FROM data_requests ORDER BY created_at DESC LIMIT 1000").all();return json({items:rs.results||[]});
  }
  const dataReqMatch=p.match(/^\/api\/admin\/data-requests\/([^/]+)$/);
  if(dataReqMatch&&request.method==="PATCH"){
    const deny=requirePermission(user,"privacy.manage");if(deny)return deny;
    const idR=decodeURIComponent(dataReqMatch[1]),body=await readJson(request)||{};
    await env.DB.prepare("UPDATE data_requests SET status=?,note=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(body.status||"Đang xử lý",body.note||"",idR).run();
    await audit(env,request,user,"Xử lý yêu cầu quyền riêng tư","data_request",idR,body);return json({ok:true});
  }

  if(p==="/api/admin/approvals"&&request.method==="POST"){
    const can=hasPermission(user,"approval.request")||hasPermission(user,"submission.manage")||hasPermission(user,"approval.manage");
    if(!can)return json({error:"FORBIDDEN"},403);
    const body=await readJson(request)||{};if(!body.entity_type||!body.entity_id||!body.action)return json({error:"INVALID_INPUT"},400);
    const idA=uid("approval");
    await env.DB.prepare("INSERT INTO approvals(id,entity_type,entity_id,action,requested_by,assigned_role,status,due_at,note) VALUES(?,?,?,?,?,?,'pending',?,?)")
      .bind(idA,body.entity_type,body.entity_id,body.action,user.id,body.assigned_role||"network_secretary",body.due_at||null,body.note||"").run();
    await audit(env,request,user,"Gửi yêu cầu phê duyệt","approval",idA,body);return json({ok:true,id:idA});
  }

  if(p==="/api/admin/approvals"&&request.method==="GET"){
    const deny=requirePermission(user,"approval.view");if(deny)return deny;
    const rs=await env.DB.prepare("SELECT a.*,u.full_name requester,d.full_name decider FROM approvals a LEFT JOIN users u ON u.id=a.requested_by LEFT JOIN users d ON d.id=a.decided_by ORDER BY a.created_at DESC LIMIT 1000").all();
    return json({items:rs.results||[]});
  }
  const approvalMatch=p.match(/^\/api\/admin\/approvals\/([^/]+)$/);
  if(approvalMatch&&request.method==="PATCH"){
    const deny=requirePermission(user,"approval.decide");if(deny)return deny;
    const idA=decodeURIComponent(approvalMatch[1]),body=await readJson(request)||{},status=body.status;
    if(!["approved","rejected","needs_more_info"].includes(status))return json({error:"INVALID_STATUS"},400);
    const a=await env.DB.prepare("SELECT * FROM approvals WHERE id=?").bind(idA).first();if(!a)return json({error:"NOT_FOUND"},404);
    const isRoot=(user.roles||[]).some(r=>["owner","super_admin"].includes(r.role_id));
    if(status==="approved" && a.requested_by && Number(a.requested_by)===Number(user.id) && !isRoot){
      return json({error:"SELF_APPROVAL_FORBIDDEN",message:"Nguyên tắc kiểm soát hai bước: Người tạo đề nghị không được tự phê duyệt yêu cầu do chính mình gửi."},403);
    }
    await env.DB.prepare("UPDATE approvals SET status=?,note=?,decided_by=?,decided_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?")
      .bind(status,body.note||"",user.id,idA).run();
    if(a.entity_type==="certificate"&&status==="approved"){
      await env.DB.prepare("UPDATE certificates SET status='approved',approved_by=?,approved_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(user.id,a.entity_id).run();
    }
    await audit(env,request,user,"Quyết định phê duyệt","approval",idA,{status,note:body.note||""});return json({ok:true});
  }

  if(p==="/api/admin/certificates"&&request.method==="GET"){
    const deny=requirePermission(user,"certificate.view");if(deny)return deny;
    const rs=await env.DB.prepare("SELECT * FROM certificates ORDER BY created_at DESC LIMIT 1000").all();return json({items:rs.results||[]});
  }
  if(p==="/api/admin/certificates"&&request.method==="POST"){
    const deny=requirePermission(user,"certificate.request");if(deny)return deny;
    const body=await readJson(request)||{};
    if(!body.full_name||!body.content||!body.cert_type)return json({error:"INVALID_INPUT"},400);
    const idC=uid("cert"),token=uid("verify");
    await env.DB.prepare("INSERT INTO certificates(id,cert_type,full_name,email,content,status,requested_by,verification_token,metadata_json) VALUES(?,?,?,?,?,'pending_approval',?,?,?)")
      .bind(idC,body.cert_type,body.full_name,body.email||"",body.content,user.id,token,JSON.stringify({...(body.metadata||{}), ...(body.expires_at?{expires_at:body.expires_at}:{}), ...(body.phone?{phone:body.phone}:{})})).run();
    const idA=uid("approval");
    await env.DB.prepare("INSERT INTO approvals(id,entity_type,entity_id,action,requested_by,assigned_role,status,due_at) VALUES(?,'certificate',?,'Phê duyệt cấp GCN/GXN',?,'network_secretary','pending',datetime('now','+7 days'))")
      .bind(idA,idC,user.id).run();
    await audit(env,request,user,"Đề nghị cấp GCN/GXN","certificate",idC,{approval:idA});return json({ok:true,id:idC,approval_id:idA});
  }
  const certHistoryMatch=p.match(/^\/api\/admin\/certificates\/([^/]+)\/history$/);
  if(certHistoryMatch&&request.method==="GET"){
    const deny=requirePermission(user,"certificate.view");if(deny)return deny;
    const idC=decodeURIComponent(certHistoryMatch[1]);
    const [cert,history]=await env.DB.batch([
      env.DB.prepare("SELECT * FROM certificates WHERE id=?").bind(idC),
      env.DB.prepare("SELECT action,note,actor_id,created_at FROM certificate_history WHERE certificate_id=? ORDER BY created_at DESC,id DESC").bind(idC)
    ]);
    const item=cert.results?.[0];if(!item)return json({error:"NOT_FOUND"},404);
    return json({item,history:history.results||[]});
  }

  const certMatch=p.match(/^\/api\/admin\/certificates\/([^/]+)$/);
  if(certMatch&&request.method==="PATCH"){
    const idC=decodeURIComponent(certMatch[1]),body=await readJson(request)||{};
    const current=await env.DB.prepare("SELECT * FROM certificates WHERE id=?").bind(idC).first();if(!current)return json({error:"NOT_FOUND"},404);
    if(body.action==="issue"){
      const deny=requirePermission(user,"certificate.issue");if(deny)return deny;
      if(current.status!=="approved")return json({error:"NOT_APPROVED"},409);
      if(current.code||current.issued_at)return json({error:"ALREADY_ISSUED"},409);
      const code=await generateCredentialCode(env,current.cert_type);
      const immutableSnapshot={
        code,cert_type:current.cert_type,full_name:current.full_name,email:current.email||"",
        content:current.content,metadata:parseBodyJson(current,"metadata_json")
      };
      const certCols=await adminTableColumns(env,"certificates"),sets=["code=?","status='issued'","issued_by=?","issued_at=CURRENT_TIMESTAMP","updated_at=CURRENT_TIMESTAMP"],vals=[code,user.id];
      if(certCols.has("public_id")){sets.splice(1,0,"public_id=?");vals.splice(1,0,code)}
      if(certCols.has("immutable_snapshot_json")){sets.push("immutable_snapshot_json=?");vals.push(JSON.stringify(immutableSnapshot))}
      vals.push(idC);
      await env.DB.prepare(`UPDATE certificates SET ${sets.join(",")} WHERE id=?`).bind(...vals).run();
      if(await adminTableExists(env,"issued_document_codes")){
        try{await env.DB.prepare("INSERT OR IGNORE INTO issued_document_codes(document_id,document_type,lookup_code,random_digits,code_version,is_primary,is_active) VALUES(?,?,?,?, 'v3',1,1)")
          .bind(idC,credentialKind(current.cert_type),code,code.split("-").pop()).run()}catch(err){console.error("CREDENTIAL_REGISTRY_SYNC",err)}
      }
      await env.DB.prepare("INSERT INTO certificate_history(certificate_id,action,note,actor_id) VALUES(?,'Phát hành',?,?)").bind(idC,body.note||"",user.id).run();
      if(current.supersedes_id){
        await env.DB.prepare("UPDATE certificates SET status='superseded',superseded_by_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status IN ('issued','revoked')")
          .bind(idC,current.supersedes_id).run();
        await env.DB.prepare("INSERT INTO certificate_history(certificate_id,action,note,actor_id) VALUES(?,'Được thay thế',?,?)")
          .bind(current.supersedes_id,`Thay thế bởi ${code}`,user.id).run();
      }
      if(current.email){
        const certUrl=`${env.APP_URL||"https://app.skyfirst.io.vn"}/gcn/${encodeURIComponent(code)}`;
        const mailTask=sendTemplatedEmail(env,"certificate_issued",current.email,{
          recipient_name:current.full_name,
          full_name:current.full_name,
          certificate_code:code,
          code,
          cert_type:current.cert_type,
          content:current.content,
          certificate_url:certUrl
        });
        if(ctx?.waitUntil) ctx.waitUntil(mailTask); else await mailTask;
      }
      await audit(env,request,user,"Phát hành Credential","certificate",idC,{code,registry:"ONE_SKY_FIRST"});return json({ok:true,code});
    }
    if(body.action==="revoke"){
      const deny=requirePermission(user,"certificate.issue");if(deny)return deny;
      if(!["issued","superseded"].includes(current.status))return json({error:"NOT_ISSUED"},409);
      const reason=String(body.note||body.reason||"").trim();
      const certCols=await adminTableColumns(env,"certificates"),sets=["status='revoked'","updated_at=CURRENT_TIMESTAMP"],vals=[];
      if(certCols.has("revoked_at")) sets.push("revoked_at=CURRENT_TIMESTAMP");
      if(certCols.has("revocation_reason")){sets.push("revocation_reason=?");vals.push(reason)}
      vals.push(idC);await env.DB.prepare(`UPDATE certificates SET ${sets.join(",")} WHERE id=?`).bind(...vals).run();
      if(await adminTableExists(env,"issued_document_codes")){try{await env.DB.prepare("UPDATE issued_document_codes SET is_active=0 WHERE document_id=?").bind(idC).run()}catch{}}
      await env.DB.prepare("INSERT INTO certificate_history(certificate_id,action,note,actor_id) VALUES(?,'Thu hồi',?,?)").bind(idC,reason,user.id).run();
      await audit(env,request,user,"Thu hồi Credential","certificate",idC,{reason});return json({ok:true});
    }
    if(body.action==="supersede"){
      const deny=requirePermission(user,"certificate.issue");if(deny)return deny;
      if(current.status!=="issued")return json({error:"ONLY_ISSUED_CAN_BE_SUPERSEDED"},409);
      const certCols=await adminTableColumns(env,"certificates");
      if(!certCols.has("supersedes_id")) return json({error:"FEATURE_TEMPORARILY_UNAVAILABLE",message:"Chức năng thay thế giấy chưa tương thích với cấu trúc dữ liệu hiện tại."},503);
      const replacementId=uid("cert"),token=uid("verify");
      const meta={...parseBodyJson(current,"metadata_json"),replacement_reason:String(body.note||"").trim()};
      await env.DB.prepare("INSERT INTO certificates(id,cert_type,full_name,email,content,status,requested_by,verification_token,metadata_json,supersedes_id) VALUES(?,?,?,?,?,'pending_approval',?,?,?,?)")
        .bind(replacementId,current.cert_type,current.full_name,current.email||"",current.content,user.id,token,JSON.stringify(meta),idC).run();
      const idA=uid("approval");
      await env.DB.prepare("INSERT INTO approvals(id,entity_type,entity_id,action,requested_by,assigned_role,status,due_at) VALUES(?,'certificate',?,'Phê duyệt credential thay thế',?,'network_secretary','pending',datetime('now','+7 days'))")
        .bind(idA,replacementId,user.id).run();
      await env.DB.prepare("INSERT INTO certificate_history(certificate_id,action,note,actor_id) VALUES(?,'Khởi tạo thay thế',?,?)").bind(idC,body.note||"",user.id).run();
      await audit(env,request,user,"Khởi tạo Credential thay thế","certificate",idC,{replacement_id:replacementId,approval:idA});
      return json({ok:true,replacement_id:replacementId,approval_id:idA});
    }
    return json({error:"INVALID_ACTION"},400);
  }

  if(p==="/api/admin/interviews"&&request.method==="POST"){
    const deny=requirePermission(user,"interview.manage");if(deny)return deny;
    const body=await readJson(request)||{},idI=uid("interview");
    await env.DB.prepare("INSERT INTO interviews(id,submission_code,scheduled_at,meeting_url,status,notes,created_by) VALUES(?,?,?,?,?,?,?)")
      .bind(idI,body.submission_code,body.scheduled_at||null,body.meeting_url||"",body.status||"scheduled",body.notes||"",user.id).run();
    await audit(env,request,user,"Tạo lịch phỏng vấn","interview",idI,body);return json({ok:true,id:idI});
  }
  if(p==="/api/admin/evaluations"&&request.method==="POST"){
    const deny=requirePermission(user,"evaluation.manage");if(deny)return deny;
    const body=await readJson(request)||{},idE=uid("eval");
    await env.DB.prepare("INSERT INTO evaluations(id,submission_code,evaluator_id,score_json,recommendation,note) VALUES(?,?,?,?,?,?)")
      .bind(idE,body.submission_code,user.id,JSON.stringify(body.score||{}),body.recommendation||"",body.note||"").run();
    await audit(env,request,user,"Đánh giá ứng viên","evaluation",idE,body);return json({ok:true,id:idE});
  }

  if(p==="/api/admin/tickets"&&request.method==="GET"){
    if(!hasAnyPermission(user,["ticket.manage","ticket.manage_assigned"])) return json({error:"FORBIDDEN",permission:"ticket.manage"},403);
    const onlyAssigned=!hasPermission(user,"ticket.manage")&&hasPermission(user,"ticket.manage_assigned");
    const rs=onlyAssigned
      ? await env.DB.prepare("SELECT * FROM tickets WHERE assigned_to=? ORDER BY created_at DESC LIMIT 1000").bind(user.id).all()
      : await env.DB.prepare("SELECT * FROM tickets ORDER BY created_at DESC LIMIT 1000").all();
    return json({items:rs.results||[]});
  }
  const ticketMatch=p.match(/^\/api\/admin\/tickets\/([^/]+)$/);
  if(ticketMatch&&request.method==="PATCH"){
    const idT=decodeURIComponent(ticketMatch[1]),body=await readJson(request)||{},sets=[],vals=[];
    const current=await env.DB.prepare("SELECT * FROM tickets WHERE id=?").bind(idT).first();
    if(!current) return json({error:"NOT_FOUND"},404);
    const canAll=hasPermission(user,"ticket.manage");
    const canAssigned=hasPermission(user,"ticket.manage_assigned")&&Number(current.assigned_to)===Number(user.id);
    if(!canAll&&!canAssigned) return json({error:"FORBIDDEN",permission:"ticket.manage"},403);
    for(const k of (canAll?["priority","status","assigned_to","subject"]:["priority","status"])) if(k in body){sets.push(`${k}=?`);vals.push(body[k])}
    if(sets.length){vals.push(idT);await env.DB.prepare(`UPDATE tickets SET ${sets.join(",")},updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(...vals).run()}
    if(body.message) await env.DB.prepare("INSERT INTO ticket_messages(ticket_id,sender_user_id,sender_type,body) VALUES(?,?,'staff',?)").bind(idT,user.id,body.message).run();
    await audit(env,request,user,"Cập nhật ticket","ticket",idT,body);return json({ok:true});
  }

  if(p==="/api/admin/email-templates"&&request.method==="GET"){
    if(!hasAnyPermission(user,["email.view","email.manage"])) return json({error:"FORBIDDEN",permission:"email.view"},403);
    const rs=await env.DB.prepare("SELECT * FROM email_templates ORDER BY key").all();return json({items:rs.results||[]});
  }
  const emailTpl=p.match(/^\/api\/admin\/email-templates\/([^/]+)$/);
  if(emailTpl&&request.method==="PUT"){
    const deny=requirePermission(user,"email.manage");if(deny)return deny;
    const key=decodeURIComponent(emailTpl[1]),body=await readJson(request)||{};
    if(!body.subject_template || !body.html_template) return json({error:"INVALID_INPUT",message:"Tiêu đề và nội dung HTML của mẫu email là bắt buộc."},400);
    await env.DB.prepare("INSERT INTO email_templates(key,subject_template,html_template,text_template,enabled,updated_at) VALUES(?,?,?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET subject_template=excluded.subject_template,html_template=excluded.html_template,text_template=excluded.text_template,enabled=excluded.enabled,updated_at=CURRENT_TIMESTAMP")
      .bind(key,body.subject_template,body.html_template,body.text_template||"",body.enabled===false?0:1).run();
    if(await adminTableExists(env,"email_template_versions")){
      try{
        const vRow=await env.DB.prepare("SELECT COALESCE(MAX(version),0)+1 AS v FROM email_template_versions WHERE template_key=?").bind(key).first();
        await env.DB.prepare("INSERT INTO email_template_versions(template_key,version,subject_template,html_template,text_template,updated_by) VALUES(?,?,?,?,?,?)")
          .bind(key,Number(vRow?.v||1),body.subject_template,body.html_template,body.text_template||"",user.id).run();
      }catch{}
    }
    await audit(env,request,user,"Cập nhật mẫu email","email_template",key,{enabled:body.enabled!==false});return json({ok:true});
  }
  const emailPreviewMatch=p.match(/^\/api\/admin\/email-templates\/([^/]+)\/preview$/);
  if(emailPreviewMatch&&request.method==="POST"){
    if(!hasAnyPermission(user,["email.view","email.manage"])) return json({error:"FORBIDDEN",permission:"email.view"},403);
    const key=decodeURIComponent(emailPreviewMatch[1]),body=await readJson(request)||{};
    const row=await env.DB.prepare("SELECT * FROM email_templates WHERE key=?").bind(key).first();
    if(!row) return json({error:"NOT_FOUND"},404);
    const sampleVars={
      full_name:"Nguyễn Văn A",
      recipient_name:"Nguyễn Văn A",
      email:"nguyenvana@example.com",
      code:"SFN-TV-2026-0001",
      application_code:"SFN-TV-2026-0001",
      form_name:"Đăng ký Thành viên Sky First",
      program_name:"Tiếng Anh Cộng đồng SFEC",
      submitted_at:"22/10/2026 14:30",
      status:"Đã tiếp nhận",
      certificate_code:"SFN-GCN-12345678",
      cert_type:"Giấy chứng nhận",
      content:"Hoàn thành xuất sắc chương trình hoạt động cộng đồng.",
      certificate_url:"https://app.skyfirst.io.vn/gcn/SFN-GCN-12345678",
      requirement_note:"Vui lòng bổ sung minh chứng học tập hoặc kinh nghiệm liên quan.",
      result_summary:"Hồ sơ đạt yêu cầu tuyển chọn vòng 1.",
      activation_link:"https://app.skyfirst.io.vn/?reset=sample-token",
      ticket_code:"SFN-SAFE-2026-0001",
      subject:"Hỗ trợ tra cứu thông tin",
      campaign_code:"SFN-TT-2026-01",
      campaign_title:"Học bổng & Học liệu Cộng đồng 2026",
      target_amount:"100.000.000 đồng",
      pledged_amount:"60.000.000 đồng",
      received_amount:"45.000.000 đồng",
      ...(body.vars||{})
    };
    const rendered=renderEmailContent({
      subject_template:body.subject_template??row.subject_template,
      html_template:body.html_template??row.html_template,
      text_template:body.text_template??row.text_template
    },sampleVars);
    return json({ok:true,preview:rendered});
  }
  const emailTestMatch=p.match(/^\/api\/admin\/email-templates\/([^/]+)\/test$/);
  if(emailTestMatch&&request.method==="POST"){
    if(!hasAnyPermission(user,["email.send_test","email.manage"])) return json({error:"FORBIDDEN",permission:"email.send_test"},403);
    const key=decodeURIComponent(emailTestMatch[1]),body=await readJson(request)||{};
    const to=String(body.to_email||user.email||"").trim().toLowerCase();
    if(!to||!to.includes("@")) return json({error:"INVALID_EMAIL",message:"Địa chỉ email nhận thử không hợp lệ."},400);
    const res=await sendTemplatedEmail(env,key,to,{
      full_name:user.full_name||"Quản trị viên",
      recipient_name:user.full_name||"Quản trị viên",
      email:to,
      code:"SFN-TEST-0001",
      form_name:"Kiểm thử mẫu email hệ thống",
      program_name:"Chương trình kiểm thử",
      submitted_at:new Date().toLocaleString("vi-VN",{timeZone:"Asia/Ho_Chi_Minh"}),
      status:"Kiểm thử mẫu email",
      certificate_code:"SFN-GCN-00000000",
      cert_type:"Giấy chứng nhận (Thử nghiệm)",
      content:"Nội dung kiểm thử hiển thị mẫu email.",
      certificate_url:"https://app.skyfirst.io.vn/gcn",
      requirement_note:"Nội dung kiểm thử yêu cầu bổ sung thông tin.",
      result_summary:"Nội dung kiểm thử thông báo kết quả xử lý.",
      activation_link:"https://app.skyfirst.io.vn/admin/login",
      ticket_code:"SFN-TICKET-TEST",
      subject:"Kiểm thử gửi email",
      campaign_code:"SFN-TT-TEST",
      campaign_title:"Chiến dịch kiểm thử",
      target_amount:"0 đồng",
      pledged_amount:"0 đồng",
      received_amount:"0 đồng",
      ...(body.vars||{})
    },{skipDedupe:true});
    await audit(env,request,user,"Gửi thử mẫu email","email_template",key,{to,ok:res.ok,pending:!!res.pending,error:res.error||""});
    return json({ok:res.ok,pending:!!res.pending,error:res.error||null,message:res.ok?"Đã gửi email thử tới nhà cung cấp.":res.pending?"Đã ghi nhận vào nhật ký (chưa cấu hình RESEND_API_KEY / EMAIL binding).":res.error});
  }
  if(p==="/api/admin/email-logs"&&request.method==="GET"){
    if(!hasAnyPermission(user,["email.view","email.manage"])) return json({error:"FORBIDDEN",permission:"email.view"},403);
    const rs=await env.DB.prepare("SELECT * FROM email_logs ORDER BY id DESC LIMIT 1000").all();return json({items:rs.results||[]});
  }

  if(p==="/api/admin/audit"&&request.method==="GET"){
    const deny=requirePermission(user,"audit.view");if(deny)return deny;
    const rs=await env.DB.prepare("SELECT * FROM audit_log ORDER BY id DESC LIMIT 2000").all();return json({items:rs.results||[]});
  }

  if(p==="/api/admin/search"&&request.method==="GET"){
    const deny=requirePermission(user,"search.use");if(deny)return deny;
    const q=String(url.searchParams.get("q")||"").trim();if(q.length<2)return json({items:[]});
    const like=`%${q}%`;
    const [s,pe,c,d,t]=await env.DB.batch([
      env.DB.prepare("SELECT 'submission' kind,code ref,full_name title,status detail FROM submissions WHERE code LIKE ? OR full_name LIKE ? OR email LIKE ? LIMIT 30").bind(like,like,like),
      env.DB.prepare("SELECT 'person' kind,CAST(id AS TEXT) ref,full_name title,COALESCE(position,'') detail FROM people WHERE full_name LIKE ? OR email LIKE ? LIMIT 30").bind(like,like),
      env.DB.prepare("SELECT 'certificate' kind,COALESCE(code,id) ref,full_name title,content detail FROM certificates WHERE code LIKE ? OR full_name LIKE ? LIMIT 30").bind(like,like),
      env.DB.prepare("SELECT 'document' kind,code ref,title,doc_type detail FROM documents WHERE code LIKE ? OR title LIKE ? LIMIT 30").bind(like,like),
      env.DB.prepare("SELECT 'ticket' kind,code ref,COALESCE(subject,submitter_name) title,status detail FROM tickets WHERE code LIKE ? OR subject LIKE ? OR submitter_name LIKE ? LIMIT 30").bind(like,like,like)
    ]);
    return json({items:[...(s.results||[]),...(pe.results||[]),...(c.results||[]),...(d.results||[]),...(t.results||[])]});
  }

  if(p==="/api/admin/backup"&&request.method==="POST"){
    const deny=requirePermission(user,"backup.create");if(deny)return deny;
    const tables=["settings","modules","terms","forms","form_revisions","units","submissions","case_events","people","people_history","teaching_scopes","internal_requests","unit_members","classes","class_enrollments","attendance","events","event_registrations","news","documents","certificates","certificate_history","approvals","interviews","evaluations","tickets","ticket_messages","notifications","email_templates","tasks","data_requests"];
    const snapshot={created_at:new Date().toISOString(),tables:{}};
    for(const t of tables){
      if(!(await adminTableExists(env,t))) continue;
      const rs=await env.DB.prepare(`SELECT * FROM ${t}`).all();snapshot.tables[t]=rs.results||[];
    }
    const raw=JSON.stringify(snapshot),idB=uid("backup"),key=`backups/${new Date().toISOString().slice(0,10)}/${idB}.json`;
    await env.FILES.put(key,raw,{httpMetadata:{contentType:"application/json"}});
    await env.DB.prepare("INSERT INTO backups(id,r2_key,size,created_by) VALUES(?,?,?,?)").bind(idB,key,new TextEncoder().encode(raw).length,user.id).run();
    await audit(env,request,user,"Tạo bản sao dữ liệu","backup",idB,{key});return json({ok:true,id:idB});
  }
  if(p==="/api/admin/backups"&&request.method==="GET"){
    const deny=requirePermission(user,"backup.create");if(deny)return deny;
    const rs=await env.DB.prepare("SELECT * FROM backups ORDER BY created_at DESC LIMIT 100").all();return json({items:rs.results||[]});
  }

  if(p==="/api/admin/export/submissions.csv"&&request.method==="GET"){
    const deny=requirePermission(user,"export.use");if(deny)return deny;
    const rs=await env.DB.prepare("SELECT code,form_id,full_name,email,status,score,created_at,updated_at FROM submissions ORDER BY id DESC").all();
    const rows=["code,form_id,full_name,email,status,score,created_at,updated_at"];
    const esc=v=>{const s=String(v??"");return /[",\n]/.test(s)?`"${s.replaceAll('"','""')}"`:s};
    for(const x of rs.results||[])rows.push([x.code,x.form_id,x.full_name,x.email,x.status,x.score,x.created_at,x.updated_at].map(esc).join(","));
    return new Response("\ufeff"+rows.join("\n"),{headers:{"content-type":"text/csv; charset=utf-8","content-disposition":"attachment; filename=SFN_submissions.csv"}});
  }


  if(p==="/api/admin/upload"&&request.method==="POST"){
    const deny=requirePermission(user,"file.manage");if(deny)return deny;
    const fd=await request.formData(),file=fd.get("file");
    if(!file||typeof file!=="object"||!("size" in file))return json({error:"FILE_REQUIRED"},400);
    const maxMb=Number(await setting(env,"max_upload_mb",10));if(file.size>maxMb*1024*1024)return json({error:"FILE_TOO_LARGE"},400);
    const allowed=new Set(["image/jpeg","image/png","application/pdf","application/vnd.openxmlformats-officedocument.wordprocessingml.document","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"]);
    if(file.type&&!allowed.has(file.type))return json({error:"FILE_TYPE_NOT_ALLOWED"},400);
    const idF=uid("file"),safe=String(file.name||"file").replace(/[^\p{L}\p{N}._-]+/gu,"_").slice(0,120),key=`private/admin/${new Date().getUTCFullYear()}/${idF}/${safe}`;
    const bytes=await file.arrayBuffer(),hash=await sha256(bytes);
    await env.FILES.put(key,bytes,{httpMetadata:{contentType:file.type||"application/octet-stream"},customMetadata:{sha256:hash}});
    const fileCols=await adminTableColumns(env,"files");
    if(fileCols.has("sha256")){
      await env.DB.prepare("INSERT INTO files(id,owner_user_id,r2_key,filename,mime,size,visibility,sha256) VALUES(?,?,?,?,?,?,?,?)")
        .bind(idF,user.id,key,safe,file.type||"",file.size||0,fd.get("visibility")==="public"?"public":"private",hash).run();
    }else{
      await env.DB.prepare("INSERT INTO files(id,owner_user_id,r2_key,filename,mime,size,visibility) VALUES(?,?,?,?,?,?,?)")
        .bind(idF,user.id,key,safe,file.type||"",file.size||0,fd.get("visibility")==="public"?"public":"private").run();
    }
    await audit(env,request,user,"Upload file","file",idF,{filename:safe,size:file.size});
    return json({ok:true,id:idF,filename:safe});
  }

  if(p==="/api/admin/files"&&request.method==="GET"){
    const deny=requirePermission(user,"file.manage");if(deny)return deny;
    const rs=await env.DB.prepare("SELECT id,submission_code,field_key,filename,mime,size,visibility,created_at FROM files ORDER BY created_at DESC LIMIT 1000").all();
    return json({items:rs.results||[]});
  }

  const fileMatch=p.match(/^\/api\/admin\/files\/([^/]+)$/);
  if(fileMatch&&request.method==="DELETE"){
    const deny=requirePermission(user,"file.manage");if(deny)return deny;
    const idF=decodeURIComponent(fileMatch[1]),f=await env.DB.prepare("SELECT r2_key FROM files WHERE id=?").bind(idF).first();
    if(!f)return json({error:"NOT_FOUND"},404);
    const [docUse,certUse,subUse]=await env.DB.batch([
      env.DB.prepare("SELECT COUNT(*) c FROM documents WHERE file_id=?").bind(idF),
      env.DB.prepare("SELECT COUNT(*) c FROM certificates WHERE file_id=?").bind(idF),
      env.DB.prepare("SELECT COUNT(*) c FROM submissions WHERE answers_json LIKE ?").bind(`%${idF}%`)
    ]);
    const refs=Number(docUse.results?.[0]?.c||0)+Number(certUse.results?.[0]?.c||0)+Number(subUse.results?.[0]?.c||0);
    if(refs>0)return json({error:"ASSET_IN_USE",message:"File đang được dùng bởi hồ sơ, tài liệu hoặc credential. Không thể xóa an toàn.",references:refs},409);
    await env.FILES.delete(f.r2_key);await env.DB.prepare("DELETE FROM files WHERE id=?").bind(idF).run();
    await audit(env,request,user,"Xóa file","file",idF,{});return json({ok:true});
  }

  if(p==="/api/admin/class-enrollments"&&request.method==="GET"){
    const deny=requirePermission(user,"class.manage");if(deny)return deny;
    const classId=url.searchParams.get("class_id");
    const rs=classId
      ? await env.DB.prepare("SELECT * FROM class_enrollments WHERE class_id=? ORDER BY id DESC").bind(classId).all()
      : await env.DB.prepare("SELECT * FROM class_enrollments ORDER BY id DESC LIMIT 1500").all();
    return json({items:rs.results||[]});
  }

  if(p==="/api/admin/attendance"&&request.method==="POST"){
    const deny=requirePermission(user,"class.manage");if(deny)return deny;
    const body=await readJson(request)||{};
    if(!body.class_id||!body.enrollment_id||!body.session_date||!body.status)return json({error:"INVALID_INPUT"},400);
    await env.DB.prepare("INSERT INTO attendance(class_id,enrollment_id,session_date,status,note,marked_by) VALUES(?,?,?,?,?,?) ON CONFLICT(class_id,enrollment_id,session_date) DO UPDATE SET status=excluded.status,note=excluded.note,marked_by=excluded.marked_by")
      .bind(body.class_id,body.enrollment_id,body.session_date,body.status,body.note||"",user.id).run();
    await audit(env,request,user,"Điểm danh lớp","attendance",String(body.enrollment_id),body);return json({ok:true});
  }

  if(p==="/api/admin/event-registrations"&&request.method==="GET"){
    const deny=requirePermission(user,"event.manage");if(deny)return deny;
    const eventId=url.searchParams.get("event_id");
    const rs=eventId
      ? await env.DB.prepare("SELECT * FROM event_registrations WHERE event_id=? ORDER BY id DESC").bind(eventId).all()
      : await env.DB.prepare("SELECT * FROM event_registrations ORDER BY id DESC LIMIT 1500").all();
    return json({items:rs.results||[]});
  }

  if(p==="/api/admin/event-checkin"&&request.method==="POST"){
    const deny=requirePermission(user,"event.manage");if(deny)return deny;
    const body=await readJson(request)||{},code=String(body.checkin_code||"");
    const r=await env.DB.prepare("SELECT id FROM event_registrations WHERE checkin_code=?").bind(code).first();
    if(!r)return json({error:"CHECKIN_NOT_FOUND"},404);
    await env.DB.prepare("UPDATE event_registrations SET checked_in_at=CURRENT_TIMESTAMP,status='Đã check-in' WHERE id=?").bind(r.id).run();
    await audit(env,request,user,"Check-in sự kiện","event_registration",String(r.id),{});return json({ok:true});
  }


  const restoreMatch=p.match(/^\/api\/admin\/backups\/([^/]+)\/restore$/);
  if(restoreMatch&&request.method==="POST"){
    if(!(user.roles||[]).some(r=>["owner","super_admin"].includes(r.role_id)))return json({error:"SUPER_ADMIN_REQUIRED"},403);
    const idB=decodeURIComponent(restoreMatch[1]);
    const b=await env.DB.prepare("SELECT * FROM backups WHERE id=?").bind(idB).first();if(!b)return json({error:"NOT_FOUND"},404);
    const obj=await env.FILES.get(b.r2_key);if(!obj)return json({error:"BACKUP_OBJECT_NOT_FOUND"},404);
    const snap=JSON.parse(await obj.text());
    const insertOrder=[
      "settings","modules","terms","forms","form_revisions","units","submissions","case_events","people","people_history","teaching_scopes","internal_requests","unit_members",
      "classes","class_enrollments","attendance","events","event_registrations","news","documents","certificates","certificate_history",
      "approvals","interviews","evaluations","tickets","ticket_messages","notifications","email_templates","tasks","data_requests"
    ];
    const allowed=new Set(insertOrder);
    // Xóa bảng con trước bảng cha để không vướng FOREIGN KEY.
    for(const table of [...insertOrder].reverse()){
      if(!(table in (snap.tables||{}))||!(await adminTableExists(env,table)))continue;
      await env.DB.prepare(`DELETE FROM ${table}`).run();
    }
    // Khôi phục bảng cha trước bảng con.
    for(const table of insertOrder){
      if(!allowed.has(table)||!(table in (snap.tables||{}))||!(await adminTableExists(env,table)))continue;
      const liveCols=await adminTableColumns(env,table);
      for(const row of snap.tables[table]||[]){
        const cols=Object.keys(row).filter(c=>liveCols.has(c)); if(!cols.length)continue;
        const sql=`INSERT INTO ${table}(${cols.join(",")}) VALUES(${cols.map(()=>"?").join(",")})`;
        await env.DB.prepare(sql).bind(...cols.map(c=>row[c])).run();
      }
    }
    await audit(env,request,user,"Phục hồi dữ liệu từ backup","backup",idB,{tables:Object.keys(snap.tables||{})});return json({ok:true});
  }


  // ================= MODULE TÀI TRỢ & MINH BẠCH TÀI CHÍNH (/api/admin/sponsorship) =================
  if(p==="/api/admin/sponsorship"&&request.method==="GET"){
    if(!hasAnyPermission(user,["sponsorship.view","sponsorship.manage","sponsorship.approve"])) return json({error:"FORBIDDEN",permission:"sponsorship.view"},403);
    if(!(await adminTableExists(env,"sponsorship_campaigns"))) return json({campaigns:[],transactions:[],reports:[]});
    const [camps,txs,reps]=await env.DB.batch([
      env.DB.prepare("SELECT * FROM sponsorship_campaigns ORDER BY created_at DESC LIMIT 200"),
      env.DB.prepare("SELECT t.*,c.code AS campaign_code,c.title AS campaign_title FROM sponsorship_transactions t JOIN sponsorship_campaigns c ON c.id=t.campaign_id ORDER BY t.occurred_at DESC,t.created_at DESC LIMIT 500"),
      env.DB.prepare("SELECT r.*,c.code AS campaign_code,c.title AS campaign_title FROM sponsorship_reports r JOIN sponsorship_campaigns c ON c.id=r.campaign_id ORDER BY r.created_at DESC LIMIT 200")
    ]);
    return json({campaigns:camps.results||[],transactions:txs.results||[],reports:reps.results||[]});
  }

  async function recalculateCampaignTotals(env,campaignId){
    const rows=await env.DB.prepare("SELECT tx_type, COALESCE(SUM(amount),0) AS total FROM sponsorship_transactions WHERE campaign_id=? AND verification_status='verified' GROUP BY tx_type").bind(campaignId).all();
    let pledged=0,received=0,disbursed=0;
    for(const r of rows.results||[]){
      const amt=Number(r.total||0);
      if(r.tx_type==="pledge") pledged+=amt;
      else if(r.tx_type==="receipt") received+=amt;
      else if(r.tx_type==="disbursement") disbursed+=amt;
      else if(r.tx_type==="refund") received=Math.max(0,received-amt);
      else if(r.tx_type==="adjustment") received=Math.max(0,received+amt);
    }
    await env.DB.prepare("UPDATE sponsorship_campaigns SET pledged_amount=?,received_amount=?,disbursed_amount=?,updated_at=CURRENT_TIMESTAMP WHERE id=?")
      .bind(pledged,received,disbursed,campaignId).run();
    return {pledged,received,disbursed};
  }

  if(p==="/api/admin/sponsorship/campaigns"&&request.method==="POST"){
    const deny=requirePermission(user,"sponsorship.manage");if(deny)return deny;
    const body=await readJson(request)||{};
    const title=String(body.title||"").trim(),code=String(body.code||"").trim().toUpperCase();
    if(!title||!code) return json({error:"INVALID_INPUT",message:"Mã và tên chương trình tài trợ là bắt buộc."},400);
    const target=Math.max(0,Math.round(Number(body.target_amount||0)));
    const wantPublic=body.visibility==="public";
    if(wantPublic && !hasPermission(user,"sponsorship.approve")) return json({error:"FORBIDDEN",message:"Cần quyền phê duyệt tài trợ (sponsorship.approve) để công khai chương trình."},403);
    const id=uid("spcamp");
    await env.DB.prepare("INSERT INTO sponsorship_campaigns(id,code,website_id,title,summary,purpose,target_amount,pledged_amount,received_amount,disbursed_amount,currency,start_at,end_at,status,visibility,approved_by,approved_at,created_by) VALUES(?,?,?,?,?,?,?,0,0,0,'VND',?,?,?,?,?,?,?)")
      .bind(id,code,String(body.website_id||"app"),title,String(body.summary||""),String(body.purpose||""),target,body.start_at||null,body.end_at||null,body.status||"active",wantPublic?"public":"draft",wantPublic?user.id:null,wantPublic?new Date().toISOString():null,user.id).run();
    await audit(env,request,user,"Tạo chương trình tài trợ","sponsorship_campaign",id,{code,title,target_amount:target,visibility:wantPublic?"public":"draft"});
    invalidatePublicCache(url,["/api/public/sponsorship","/api/config"],ctx);
    return json({ok:true,id,code},201);
  }

  const spCampMatch=p.match(/^\/api\/admin\/sponsorship\/campaigns\/([^/]+)$/);
  if(spCampMatch&&request.method==="PUT"){
    if(!hasAnyPermission(user,["sponsorship.manage","sponsorship.approve"])) return json({error:"FORBIDDEN",permission:"sponsorship.manage"},403);
    const id=decodeURIComponent(spCampMatch[1]),body=await readJson(request)||{};
    const current=await env.DB.prepare("SELECT * FROM sponsorship_campaigns WHERE id=?").bind(id).first();
    if(!current) return json({error:"NOT_FOUND"},404);
    const nextVis=body.visibility??current.visibility;
    if(nextVis==="public" && current.visibility!=="public" && !hasPermission(user,"sponsorship.approve")){
      return json({error:"FORBIDDEN",message:"Chỉ người có quyền phê duyệt tài trợ mới được công khai chương trình."},403);
    }
    const target=body.target_amount!==undefined?Math.max(0,Math.round(Number(body.target_amount||0))):current.target_amount;
    await env.DB.prepare("UPDATE sponsorship_campaigns SET title=?,summary=?,purpose=?,target_amount=?,start_at=?,end_at=?,status=?,visibility=?,approved_by=CASE WHEN ?='public' THEN ? ELSE approved_by END,approved_at=CASE WHEN ?='public' THEN CURRENT_TIMESTAMP ELSE approved_at END,updated_at=CURRENT_TIMESTAMP WHERE id=?")
      .bind(body.title||current.title,body.summary??current.summary,body.purpose??current.purpose,target,body.start_at??current.start_at,body.end_at??current.end_at,body.status||current.status,nextVis,nextVis,user.id,nextVis,id).run();
    await audit(env,request,user,"Cập nhật chương trình tài trợ","sponsorship_campaign",id,{status:body.status||current.status,visibility:nextVis,target_amount:target});
    invalidatePublicCache(url,["/api/public/sponsorship","/api/config"],ctx);
    return json({ok:true});
  }

  if(p==="/api/admin/sponsorship/transactions"&&request.method==="POST"){
    const deny=requirePermission(user,"sponsorship.manage");if(deny)return deny;
    const body=await readJson(request)||{};
    const campaignId=String(body.campaign_id||"").trim();
    const txType=String(body.tx_type||"receipt").trim();
    const amount=Math.round(Number(body.amount||0));
    if(!campaignId||!["pledge","receipt","disbursement","adjustment","refund"].includes(txType)||!Number.isFinite(amount)||amount<=0){
      return json({error:"INVALID_INPUT",message:"Vui lòng chọn chương trình, loại giao dịch hợp lệ và số tiền lớn hơn 0."},400);
    }
    const camp=await env.DB.prepare("SELECT id,code FROM sponsorship_campaigns WHERE id=?").bind(campaignId).first();
    if(!camp) return json({error:"CAMPAIGN_NOT_FOUND"},404);
    const id=uid("sptx"),txCode=body.tx_code?String(body.tx_code).trim().toUpperCase():`TX-${camp.code}-${await nextCounter(env,`sptx:${camp.code}`)}`;
    const autoVerify=body.verification_status==="verified"&&hasPermission(user,"sponsorship.approve");
    await env.DB.prepare("INSERT INTO sponsorship_transactions(id,campaign_id,tx_code,tx_type,amount,currency,public_party_label,purpose,voucher_file_id,occurred_at,verification_status,is_public,verified_by,verified_at,created_by) VALUES(?,?,?,?,?,'VND',?,?,?,?,?,?,?,?,?)")
      .bind(id,campaignId,txCode,txType,amount,String(body.public_party_label||"Nhà tài trợ / Đơn vị thụ hưởng").slice(0,160),String(body.purpose||"").slice(0,500),body.voucher_file_id||null,body.occurred_at||new Date().toISOString(),autoVerify?"verified":"pending",body.is_public?1:0,autoVerify?user.id:null,autoVerify?new Date().toISOString():null,user.id).run();
    const totals=await recalculateCampaignTotals(env,campaignId);
    await audit(env,request,user,"Ghi nhận giao dịch tài trợ","sponsorship_transaction",id,{tx_code:txCode,tx_type:txType,amount,verified:autoVerify,totals});
    invalidatePublicCache(url,["/api/public/sponsorship","/api/config"],ctx);
    return json({ok:true,id,tx_code:txCode,totals},201);
  }

  const spTxMatch=p.match(/^\/api\/admin\/sponsorship\/transactions\/([^/]+)$/);
  if(spTxMatch&&request.method==="PATCH"){
    const deny=requirePermission(user,"sponsorship.approve");if(deny)return deny;
    const id=decodeURIComponent(spTxMatch[1]),body=await readJson(request)||{};
    const tx=await env.DB.prepare("SELECT * FROM sponsorship_transactions WHERE id=?").bind(id).first();
    if(!tx) return json({error:"NOT_FOUND"},404);
    const vStatus=["pending","verified","rejected"].includes(body.verification_status)?body.verification_status:tx.verification_status;
    const isPub=body.is_public!==undefined?(body.is_public?1:0):tx.is_public;
    await env.DB.prepare("UPDATE sponsorship_transactions SET verification_status=?,is_public=?,verified_by=?,verified_at=CURRENT_TIMESTAMP WHERE id=?")
      .bind(vStatus,isPub,user.id,id).run();
    const totals=await recalculateCampaignTotals(env,tx.campaign_id);
    await audit(env,request,user,"Xác nhận đối soát giao dịch tài trợ","sponsorship_transaction",id,{verification_status:vStatus,is_public:isPub,totals});
    invalidatePublicCache(url,["/api/public/sponsorship","/api/config"],ctx);
    return json({ok:true,totals});
  }

  if(p==="/api/admin/sponsorship/reports"&&request.method==="POST"){
    const deny=requirePermission(user,"sponsorship.manage");if(deny)return deny;
    const body=await readJson(request)||{};
    if(!body.campaign_id||!body.title) return json({error:"INVALID_INPUT",message:"Chương trình và tiêu đề báo cáo là bắt buộc."},400);
    const publish=body.status==="published"&&hasPermission(user,"sponsorship.approve");
    const id=uid("sprep");
    await env.DB.prepare("INSERT INTO sponsorship_reports(id,campaign_id,title,report_period,file_id,summary,status,approved_by,published_at) VALUES(?,?,?,?,?,?,?,?,?)")
      .bind(id,body.campaign_id,String(body.title).trim(),String(body.report_period||""),body.file_id||null,String(body.summary||""),publish?"published":"draft",publish?user.id:null,publish?new Date().toISOString():null).run();
    await audit(env,request,user,"Tạo báo cáo minh bạch tài trợ","sponsorship_report",id,{title:body.title,status:publish?"published":"draft"});
    invalidatePublicCache(url,["/api/public/sponsorship"],ctx);
    return json({ok:true,id},201);
  }

  // ================= MODULE AN TOÀN & BÁO CÁO SỰ CỐ (/api/admin/safety-reports) =================
  if(p==="/api/admin/safety-reports"&&request.method==="GET"){
    if(!hasAnyPermission(user,["safety.view","safety.manage","ticket.manage"])) return json({error:"FORBIDDEN",permission:"safety.view"},403);
    if(!(await adminTableExists(env,"safety_reports"))) return json({items:[]});
    const rs=await env.DB.prepare("SELECT * FROM safety_reports ORDER BY created_at DESC LIMIT 500").all();
    return json({items:rs.results||[]});
  }
  const safeMatch=p.match(/^\/api\/admin\/safety-reports\/([^/]+)$/);
  if(safeMatch&&request.method==="PATCH"){
    if(!hasAnyPermission(user,["safety.manage","ticket.manage"])) return json({error:"FORBIDDEN",permission:"safety.manage"},403);
    const id=decodeURIComponent(safeMatch[1]),body=await readJson(request)||{};
    await env.DB.prepare("UPDATE safety_reports SET status=?,severity=COALESCE(?,severity),resolution_note=?,assigned_to=?,updated_at=CURRENT_TIMESTAMP WHERE id=? OR code=?")
      .bind(body.status||"Đang xác minh",body.severity||null,String(body.resolution_note||""),body.assigned_to||user.id,id,id).run();
    await audit(env,request,user,"Xử lý báo cáo sự cố an toàn","safety_report",id,body);
    return json({ok:true});
  }

  // ================= THƯ VIỆN PDF & PHIÊN BẢN TÀI LIỆU (/api/admin/documents/:id/versions) =================
  const docVerMatch=p.match(/^\/api\/admin\/documents\/([^/]+)\/versions$/);
  if(docVerMatch&&request.method==="GET"){
    if(!hasAnyPermission(user,["document.view","document.manage"])) return json({error:"FORBIDDEN",permission:"document.view"},403);
    const docId=decodeURIComponent(docVerMatch[1]);
    const doc=await env.DB.prepare("SELECT * FROM documents WHERE id=? OR code=?").bind(docId,docId).first();
    if(!doc) return json({error:"NOT_FOUND"},404);
    const rs=await env.DB.prepare("SELECT * FROM document_versions WHERE document_id=? ORDER BY version_number DESC").bind(doc.id).all();
    return json({document:doc,versions:rs.results||[]});
  }
  if(docVerMatch&&request.method==="POST"){
    if(!hasAnyPermission(user,["document.manage","document.version_manage"])) return json({error:"FORBIDDEN",permission:"document.version_manage"},403);
    const docId=decodeURIComponent(docVerMatch[1]),body=await readJson(request)||{};
    const doc=await env.DB.prepare("SELECT * FROM documents WHERE id=? OR code=?").bind(docId,docId).first();
    if(!doc) return json({error:"NOT_FOUND"},404);
    const fileId=String(body.file_id||"").trim();
    if(!fileId) return json({error:"FILE_REQUIRED"},400);
    const fMeta=await env.DB.prepare("SELECT * FROM files WHERE id=?").bind(fileId).first();
    if(!fMeta) return json({error:"FILE_NOT_FOUND"},404);
    const maxRow=await env.DB.prepare("SELECT COALESCE(MAX(version_number),0)+1 AS next_v FROM document_versions WHERE document_id=?").bind(doc.id).first();
    const nextV=Number(maxRow?.next_v||1),verId=uid("docver");
    await env.DB.batch([
      env.DB.prepare("UPDATE document_versions SET is_current=0 WHERE document_id=?").bind(doc.id),
      env.DB.prepare("INSERT INTO document_versions(id,document_id,version_number,file_id,filename,mime,size,sha256,change_note,is_current,created_by) VALUES(?,?,?,?,?,?,?,?,?,1,?)")
        .bind(verId,doc.id,nextV,fileId,fMeta.filename||"",fMeta.mime||"application/pdf",fMeta.size||0,fMeta.sha256||null,String(body.change_note||`Cập nhật phiên bản v${nextV}`),user.id),
      env.DB.prepare("UPDATE documents SET file_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(fileId,doc.id)
    ]);
    await audit(env,request,user,"Cập nhật phiên bản tài liệu PDF","document",doc.id,{version:nextV,file_id:fileId,change_note:body.change_note||""});
    invalidatePublicCache(url,["/api/public/resources"],ctx);
    return json({ok:true,version_id:verId,version_number:nextV},201);
  }
  const docVerRestoreMatch=p.match(/^\/api\/admin\/documents\/([^/]+)\/versions\/([^/]+)\/restore$/);
  if(docVerRestoreMatch&&request.method==="POST"){
    if(!hasAnyPermission(user,["document.manage","document.version_manage"])) return json({error:"FORBIDDEN",permission:"document.version_manage"},403);
    const docId=decodeURIComponent(docVerRestoreMatch[1]),verId=decodeURIComponent(docVerRestoreMatch[2]);
    const ver=await env.DB.prepare("SELECT * FROM document_versions WHERE id=? AND document_id=?").bind(verId,docId).first();
    if(!ver) return json({error:"VERSION_NOT_FOUND"},404);
    await env.DB.batch([
      env.DB.prepare("UPDATE document_versions SET is_current=0 WHERE document_id=?").bind(docId),
      env.DB.prepare("UPDATE document_versions SET is_current=1 WHERE id=?").bind(verId),
      env.DB.prepare("UPDATE documents SET file_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(ver.file_id,docId)
    ]);
    await audit(env,request,user,"Khôi phục phiên bản tài liệu","document",docId,{restored_version:ver.version_number,file_id:ver.file_id});
    invalidatePublicCache(url,["/api/public/resources"],ctx);
    return json({ok:true,version_number:ver.version_number});
  }

  // ================= QUẢN LÝ ĐA WEBSITE (/api/admin/websites) =================
  if(p==="/api/admin/websites"&&request.method==="GET"){
    if(!hasAnyPermission(user,["website.view","website.manage","cms.view","settings.manage"])) return json({error:"FORBIDDEN",permission:"website.view"},403);
    if(!(await adminTableExists(env,"websites"))) return json({items:[]});
    const rs=await env.DB.prepare("SELECT * FROM websites ORDER BY CASE WHEN id='app' THEN 0 ELSE 1 END, id ASC").all();
    const items=(rs.results||[]).filter(w=>canAccessScope(user,w.id)||canAccessScope(user,w.code));
    return json({items});
  }
  if(p==="/api/admin/websites"&&request.method==="POST"){
    const deny=requirePermission(user,"website.manage");if(deny)return deny;
    const body=await readJson(request)||{};
    const id=String(body.id||"").trim().toLowerCase().replace(/[^a-z0-9_-]/g,"");
    const code=String(body.code||id.toUpperCase()).trim().toUpperCase();
    const name=String(body.name||"").trim(),domain=String(body.domain||"").trim().toLowerCase();
    if(!id||!name||!domain) return json({error:"INVALID_INPUT",message:"Mã định danh, tên hiển thị và tên miền là bắt buộc."},400);
    await env.DB.prepare("INSERT INTO websites(id,code,name,domain,description,logo_url,primary_color,navy_color,status,config_json,updated_by) VALUES(?,?,?,?,?,?,?,?,?,?,?)")
      .bind(id,code,name,domain,String(body.description||""),body.logo_url||"/assets/sfn-logo-tight.png",body.primary_color||"#0759b8",body.navy_color||"#071b35",body.status||"active",JSON.stringify(body.config||{}),user.id).run();
    await audit(env,request,user,"Thêm website vào hệ thống quản trị","website",id,{code,name,domain});
    return json({ok:true,id},201);
  }
  const siteMatch=p.match(/^\/api\/admin\/websites\/([^/]+)$/);
  if(siteMatch&&request.method==="PUT"){
    const deny=requirePermission(user,"website.manage");if(deny)return deny;
    const id=decodeURIComponent(siteMatch[1]),body=await readJson(request)||{};
    if(!canAccessScope(user,id)) return json({error:"FORBIDDEN",message:"Tài khoản không có quyền quản trị phạm vi website này."},403);
    const curr=await env.DB.prepare("SELECT * FROM websites WHERE id=?").bind(id).first();
    if(!curr) return json({error:"NOT_FOUND"},404);
    await env.DB.prepare("UPDATE websites SET name=?,domain=?,description=?,logo_url=?,primary_color=?,navy_color=?,status=?,config_json=?,updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=?")
      .bind(body.name||curr.name,body.domain||curr.domain,body.description??curr.description,body.logo_url||curr.logo_url,body.primary_color||curr.primary_color,body.navy_color||curr.navy_color,body.status||curr.status,body.config?JSON.stringify(body.config):curr.config_json,user.id,id).run();
    await audit(env,request,user,"Cập nhật cấu hình website","website",id,{status:body.status||curr.status,domain:body.domain||curr.domain});
    return json({ok:true});
  }

  // ================= CMS & TRÌNH DỰNG TRANG TRỰC QUAN KÉO THẢ (/api/admin/cms/*) =================
  if(p==="/api/admin/cms/pages"&&request.method==="GET"){
    if(!hasAnyPermission(user,["cms.view","cms.edit","cms.approve","cms.publish","news.manage"])) return json({error:"FORBIDDEN",permission:"cms.view"},403);
    if(!(await adminTableExists(env,"cms_pages"))) return json({items:[],templates:[],shared_blocks:[]});
    const site=String(url.searchParams.get("website_id")||"").trim();
    if(site && !canAccessScope(user,site)) return json({error:"FORBIDDEN",message:"Bạn không có quyền truy cập phạm vi website này."},403);
    const [pagesRs,tplRs,sbRs]=await env.DB.batch([
      site
        ? env.DB.prepare("SELECT * FROM cms_pages WHERE website_id=? ORDER BY updated_at DESC LIMIT 300").bind(site)
        : env.DB.prepare("SELECT * FROM cms_pages ORDER BY updated_at DESC LIMIT 300"),
      env.DB.prepare("SELECT * FROM cms_templates ORDER BY name"),
      env.DB.prepare("SELECT * FROM cms_shared_blocks ORDER BY name")
    ]);
    const pages=(pagesRs.results||[]).filter(pg=>canAccessScope(user,pg.website_id));
    return json({items:pages,templates:tplRs.results||[],shared_blocks:sbRs.results||[]});
  }

  if(p==="/api/admin/cms/pages"&&request.method==="POST"){
    if(!hasAnyPermission(user,["cms.edit","news.manage"])) return json({error:"FORBIDDEN",permission:"cms.edit"},403);
    const body=await readJson(request)||{};
    const websiteId=String(body.website_id||"app").trim();
    if(!canAccessScope(user,websiteId)) return json({error:"FORBIDDEN",message:"Không có quyền tạo trang trên website này."},403);
    const title=String(body.title||"").trim();
    const slug=String(body.slug||"").trim().toLowerCase().replace(/[^a-z0-9-]+/g,"-").replace(/^-+|-+$/g,"");
    if(!title||!slug) return json({error:"INVALID_INPUT",message:"Tiêu đề và đường dẫn (slug) là bắt buộc."},400);
    const dup=await env.DB.prepare("SELECT id FROM cms_pages WHERE website_id=? AND slug=?").bind(websiteId,slug).first();
    if(dup) return json({error:"SLUG_EXISTS",message:"Đường dẫn trang đã tồn tại trên website này."},409);
    const id=uid("page");
    const blocksJson=JSON.stringify(Array.isArray(body.blocks)?body.blocks:[]);
    const seoJson=JSON.stringify(body.seo||{});
    const tagsJson=JSON.stringify(Array.isArray(body.tags)?body.tags:[]);
    await env.DB.batch([
      env.DB.prepare("INSERT INTO cms_pages(id,website_id,slug,title,summary,cover_file_id,category,tags_json,seo_json,blocks_json,status,version,author_id) VALUES(?,?,?,?,?,?,?,?,?,?,'draft',1,?)")
        .bind(id,websiteId,slug,title,String(body.summary||""),body.cover_file_id||null,String(body.category||"general"),tagsJson,seoJson,blocksJson,user.id),
      env.DB.prepare("INSERT INTO cms_page_revisions(page_id,version,title,blocks_json,seo_json,status,note,created_by) VALUES(?,1,?,?,?,'draft','Khởi tạo trang',?)")
        .bind(id,title,blocksJson,seoJson,user.id)
    ]);
    await audit(env,request,user,"Tạo trang CMS","cms_page",id,{website_id:websiteId,slug,title});
    return json({ok:true,id,slug},201);
  }

  const cmsPageMatch=p.match(/^\/api\/admin\/cms\/pages\/([^/]+)$/);
  if(cmsPageMatch&&request.method==="GET"){
    if(!hasAnyPermission(user,["cms.view","cms.edit","cms.approve","cms.publish","news.manage"])) return json({error:"FORBIDDEN",permission:"cms.view"},403);
    const id=decodeURIComponent(cmsPageMatch[1]);
    const page=await env.DB.prepare("SELECT * FROM cms_pages WHERE id=?").bind(id).first();
    if(!page) return json({error:"NOT_FOUND"},404);
    if(!canAccessScope(user,page.website_id)) return json({error:"FORBIDDEN"},403);
    const revs=await env.DB.prepare("SELECT id,version,title,status,note,created_by,created_at FROM cms_page_revisions WHERE page_id=? ORDER BY version DESC LIMIT 50").bind(id).all();
    return json({
      item:{
        ...page,
        blocks:JSON.parse(page.blocks_json||"[]"),
        seo:JSON.parse(page.seo_json||"{}"),
        tags:JSON.parse(page.tags_json||"[]")
      },
      revisions:revs.results||[]
    });
  }

  if(cmsPageMatch&&request.method==="PUT"){
    if(!hasAnyPermission(user,["cms.edit","news.manage"])) return json({error:"FORBIDDEN",permission:"cms.edit"},403);
    const id=decodeURIComponent(cmsPageMatch[1]),body=await readJson(request)||{};
    const curr=await env.DB.prepare("SELECT * FROM cms_pages WHERE id=?").bind(id).first();
    if(!curr) return json({error:"NOT_FOUND"},404);
    if(!canAccessScope(user,curr.website_id)) return json({error:"FORBIDDEN"},403);
    const nextVersion=Number(curr.version||1)+1;
    const title=String(body.title||curr.title).trim();
    const slug=body.slug?String(body.slug).trim().toLowerCase().replace(/[^a-z0-9-]+/g,"-").replace(/^-+|-+$/g,""):curr.slug;
    const blocksJson=body.blocks!==undefined?JSON.stringify(body.blocks):curr.blocks_json;
    const seoJson=body.seo!==undefined?JSON.stringify(body.seo):curr.seo_json;
    const tagsJson=body.tags!==undefined?JSON.stringify(body.tags):curr.tags_json;
    // If content was already approved/published and edited by regular editor, require re-approval unless user has cms.publish
    const nextStatus=(["approved","published"].includes(curr.status)&&!hasPermission(user,"cms.publish"))?"draft":curr.status;
    if (slug && curr.slug && slug !== curr.slug && await adminTableExists(env, "url_redirects")) {
      try {
        await env.DB.prepare(
          "INSERT INTO url_redirects(id,source_path,target_path,http_code,enabled,notes,created_by) VALUES(?,?,?,301,1,?,?) ON CONFLICT(source_path) DO UPDATE SET target_path=excluded.target_path, enabled=1, updated_at=CURRENT_TIMESTAMP"
        ).bind(uid("red"), "/trang/" + curr.slug, "/trang/" + slug, "Tự động chuyển hướng khi đổi slug trang " + id, user.id).run();
      } catch {}
    }
    await env.DB.batch([
      env.DB.prepare("UPDATE cms_pages SET slug=?,title=?,summary=?,cover_file_id=?,category=?,tags_json=?,seo_json=?,blocks_json=?,status=?,version=?,updated_at=CURRENT_TIMESTAMP WHERE id=?")
        .bind(slug,title,body.summary??curr.summary,body.cover_file_id??curr.cover_file_id,body.category||curr.category,tagsJson,seoJson,blocksJson,nextStatus,nextVersion,id),
      env.DB.prepare("INSERT INTO cms_page_revisions(page_id,version,title,blocks_json,seo_json,status,note,created_by) VALUES(?,?,?,?,?,?,?,?)")
        .bind(id,nextVersion,title,blocksJson,seoJson,nextStatus,String(body.note||`Lưu phiên bản v${nextVersion}`),user.id)
    ]);
    await audit(env,request,user,"Cập nhật trang CMS","cms_page",id,{version:nextVersion,status:nextStatus});
    if(nextStatus==="published") invalidatePublicCache(url,["/api/public/pages"],ctx);
    return json({ok:true,version:nextVersion,status:nextStatus});
  }

  const cmsWorkflowMatch=p.match(/^\/api\/admin\/cms\/pages\/([^/]+)\/workflow$/);
  if(cmsWorkflowMatch&&request.method==="POST"){
    const id=decodeURIComponent(cmsWorkflowMatch[1]),body=await readJson(request)||{};
    const action=String(body.action||"").trim();
    const curr=await env.DB.prepare("SELECT * FROM cms_pages WHERE id=?").bind(id).first();
    if(!curr) return json({error:"NOT_FOUND"},404);
    if(!canAccessScope(user,curr.website_id)) return json({error:"FORBIDDEN"},403);
    const isRoot=(user.roles||[]).some(r=>["owner","super_admin"].includes(r.role_id));

    if(action==="submit_review"){
      if(!hasAnyPermission(user,["cms.submit_review","cms.edit","news.manage"])) return json({error:"FORBIDDEN"},403);
      await env.DB.prepare("UPDATE cms_pages SET status='pending_review',submitted_by=?,submitted_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(user.id,id).run();
      await audit(env,request,user,"Gửi duyệt trang CMS","cms_page",id,{website_id:curr.website_id});
      return json({ok:true,status:"pending_review"});
    }
    if(action==="approve"){
      if(!hasPermission(user,"cms.approve")) return json({error:"FORBIDDEN",permission:"cms.approve"},403);
      const creatorId=curr.submitted_by||curr.author_id;
      if(creatorId && Number(creatorId)===Number(user.id) && !isRoot){
        return json({error:"SELF_APPROVAL_FORBIDDEN",message:"Người biên tập không mặc nhiên được tự duyệt trang do chính mình gửi."},403);
      }
      await env.DB.prepare("UPDATE cms_pages SET status='approved',reviewed_by=?,reviewed_at=CURRENT_TIMESTAMP,review_note=?,updated_at=CURRENT_TIMESTAMP WHERE id=?")
        .bind(user.id,String(body.note||"Đã phê duyệt nội dung"),id).run();
      await audit(env,request,user,"Phê duyệt trang CMS","cms_page",id,{website_id:curr.website_id,note:body.note||""});
      return json({ok:true,status:"approved"});
    }
    if(action==="reject"){
      if(!hasPermission(user,"cms.approve")) return json({error:"FORBIDDEN",permission:"cms.approve"},403);
      await env.DB.prepare("UPDATE cms_pages SET status='draft',reviewed_by=?,reviewed_at=CURRENT_TIMESTAMP,review_note=?,updated_at=CURRENT_TIMESTAMP WHERE id=?")
        .bind(user.id,String(body.note||"Yêu cầu chỉnh sửa lại"),id).run();
      await audit(env,request,user,"Từ chối duyệt trang CMS","cms_page",id,{website_id:curr.website_id,note:body.note||""});
      return json({ok:true,status:"draft"});
    }
    if(action==="publish"){
      if(!hasPermission(user,"cms.publish")) return json({error:"FORBIDDEN",permission:"cms.publish"},403);
      if(curr.status!=="approved" && !isRoot){
        return json({error:"MUST_BE_APPROVED_FIRST",message:"Trang phải được phê duyệt trước khi xuất bản ra công khai."},409);
      }
      let blocks=[]; try{blocks=JSON.parse(curr.blocks_json||"[]")}catch{}
      if(!curr.title || !Array.isArray(blocks) || !blocks.length){
        return json({error:"PUBLISH_VALIDATION_FAILED",message:"Không thể xuất bản trang thiếu tiêu đề hoặc chưa có khối nội dung nào."},400);
      }
      await env.DB.prepare("UPDATE cms_pages SET status='published',published_by=?,published_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?")
        .bind(user.id,id).run();
      await audit(env,request,user,"Xuất bản trang CMS","cms_page",id,{website_id:curr.website_id,slug:curr.slug});
      invalidatePublicCache(url,["/api/public/pages"],ctx);
      return json({ok:true,status:"published"});
    }
    if(action==="unpublish"){
      if(!hasPermission(user,"cms.publish")) return json({error:"FORBIDDEN",permission:"cms.publish"},403);
      await env.DB.prepare("UPDATE cms_pages SET status='archived',updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(id).run();
      await audit(env,request,user,"Gỡ xuất bản trang CMS","cms_page",id,{website_id:curr.website_id,slug:curr.slug});
      invalidatePublicCache(url,["/api/public/pages"],ctx);
      return json({ok:true,status:"archived"});
    }
    return json({error:"INVALID_WORKFLOW_ACTION"},400);
  }

  const cmsRestoreMatch=p.match(/^\/api\/admin\/cms\/pages\/([^/]+)\/restore-version$/);
  if(cmsRestoreMatch&&request.method==="POST"){
    if(!hasAnyPermission(user,["cms.edit","cms.publish"])) return json({error:"FORBIDDEN",permission:"cms.edit"},403);
    const id=decodeURIComponent(cmsRestoreMatch[1]),body=await readJson(request)||{};
    const curr=await env.DB.prepare("SELECT * FROM cms_pages WHERE id=?").bind(id).first();
    if(!curr) return json({error:"NOT_FOUND"},404);
    if(!canAccessScope(user,curr.website_id)) return json({error:"FORBIDDEN"},403);
    const rev=await env.DB.prepare("SELECT * FROM cms_page_revisions WHERE page_id=? AND version=?").bind(id,Number(body.version||0)).first();
    if(!rev) return json({error:"REVISION_NOT_FOUND"},404);
    const nextVer=Number(curr.version||1)+1;
    await env.DB.batch([
      env.DB.prepare("UPDATE cms_pages SET title=?,blocks_json=?,seo_json=?,status='draft',version=?,updated_at=CURRENT_TIMESTAMP WHERE id=?")
        .bind(rev.title,rev.blocks_json,rev.seo_json,nextVer,id),
      env.DB.prepare("INSERT INTO cms_page_revisions(page_id,version,title,blocks_json,seo_json,status,note,created_by) VALUES(?,?,?,?,'draft',?,?)")
        .bind(id,nextVer,rev.title,rev.blocks_json,rev.seo_json,`Khôi phục từ phiên bản v${rev.version}`,user.id)
    ]);
    await audit(env,request,user,"Khôi phục phiên bản trang CMS","cms_page",id,{from_version:rev.version,new_version:nextVer});
    return json({ok:true,version:nextVer});
  }


  // === V8 ADMIN ROUTES: NAVIGATION, REDIRECTS, SYSTEM LINKS, FOLDERS, LIFECYCLE & UNIVERSAL EMAIL ===

  // 1) PHỤ LỤC EMAIL-01: Danh mục 16 sự kiện nghiệp vụ & Gửi email từ giao diện quản trị (Điều 3, Điều 6, Điều 9, Điều 10, Điều 11)
  if(p==="/api/admin/email-events"&&request.method==="GET"){
    if(!hasAnyPermission(user,["email.view","email.manage","email.send_manual"])) return json({error:"FORBIDDEN"},403);
    return json({items:Object.values(EMAIL_EVENT_CATALOG)});
  }

  if(p==="/api/admin/email/send"&&request.method==="POST"){
    if(!hasAnyPermission(user,["email.send_manual","email.manage"])) return json({error:"FORBIDDEN",permission:"email.send_manual"},403);
    const body=await readJson(request)||{};
    const eventKey=String(body.event_key||body.template_key||"system_authorized_notice").trim();
    const lang=String(body.language||"vi").toLowerCase()==="en"?"en":"vi";
    const recipientsRaw=Array.isArray(body.recipients)?body.recipients:(body.to_email?String(body.to_email).split(/[,;\s]+/):[]);
    const recipients=[...new Set(recipientsRaw.map(x=>String(x||"").trim().toLowerCase()).filter(Boolean))];
    if(!recipients.length) return json({error:"MISSING_RECIPIENT",message:"Vui lòng nhập ít nhất một địa chỉ email người nhận."},400);
    if(recipients.length>50) return json({error:"TOO_MANY_RECIPIENTS",message:"Giới hạn tối đa 50 người nhận mỗi lần gửi thủ công để bảo vệ an toàn hệ thống."},400);
    for(const r of recipients){
      if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r)){
        return json({error:"INVALID_EMAIL",message:`Địa chỉ email không hợp lệ: ${r}`},400);
      }
    }
    const vars={
      recipient_name:body.recipient_name||"Quý vị",
      request_id:body.request_id||body.code||"",
      registration_type:body.registration_type||"",
      submitted_at:body.submitted_at||new Date().toLocaleString("vi-VN",{timeZone:"Asia/Ho_Chi_Minh"}),
      status:body.status||"",
      additional_info:body.additional_info||"",
      email_category:body.email_category||"",
      email_heading:body.email_heading||"",
      intro_text:body.intro_text||"",
      body_html:body.body_html||"",
      next_steps:body.next_steps||"",
      action_url:body.action_url||"",
      action_label:body.action_label||"",
      subject_override:body.subject||"",
      language:lang,
      ...(body.vars||{})
    };
    const attachments=Array.isArray(body.attachments)?body.attachments:[];
    const prep=await validateAndPrepareAttachments(env,attachments,{requestId:vars.request_id,recipientEmail:recipients.length===1?recipients[0]:""});
    if(!prep.ok){
      return json({error:prep.error,message:prep.message},400);
    }
    if(body.dry_run===true || body.preview===true){
      const preview=renderUniversalEmail(vars,{eventKey,language:lang,linkItems:prep.linkItems});
      return json({ok:true,preview,recipients_count:recipients.length,attachments:prep.summaryMeta});
    }
    // Gửi riêng biệt từng người nhận để bảo vệ danh sách địa chỉ email (ĐIỀU 9: Không để lộ danh sách email của nhiều người nhận cho nhau)
    const results=[];
    for(const rcpt of recipients){
      const res=await sendTemplatedEmail(env,eventKey,rcpt,vars,{
        attachments,
        strictRequired:!!body.strict_required,
        actorUserId:user.id,
        useUniversal:true
      });
      results.push({to:rcpt,ok:res.ok,pending:!!res.pending,deduped:!!res.deduped,delivery_state:res.delivery_state||"",error:res.error||null});
    }
    await audit(env,request,user,"Gửi email quản trị","email_dispatch",eventKey,{recipients_count:recipients.length,language:lang,attachments_count:prep.summaryMeta.length});
    return json({ok:results.every(x=>x.ok||x.pending),results});
  }

  const emailRetryMatch=p.match(/^\/api\/admin\/email-logs\/(\d+)\/retry$/);
  if(emailRetryMatch&&request.method==="POST"){
    if(!hasAnyPermission(user,["email.manage","email.send_manual"])) return json({error:"FORBIDDEN"},403);
    const logId=Number(emailRetryMatch[1]);
    const row=await env.DB.prepare("SELECT * FROM email_logs WHERE id=?").bind(logId).first();
    if(!row) return json({error:"NOT_FOUND"},404);
    if(Number(row.retry_count||0)>=3) return json({error:"MAX_RETRIES_EXCEEDED",message:"Bản ghi email này đã vượt quá giới hạn thử lại (tối đa 3 lần)."},409);
    const res=await sendTemplatedEmail(env,row.template_key||"system_authorized_notice",row.to_email,{
      request_id:row.reference_code||"",
      subject_override:row.subject||"",
      language:row.language||"vi"
    },{skipDedupe:true,actorUserId:user.id});
    try{
      await env.DB.prepare("UPDATE email_logs SET retry_count=COALESCE(retry_count,0)+1 WHERE id=?").bind(logId).run();
    }catch{}
    await audit(env,request,user,"Thử gửi lại email","email_log",String(logId),{to:row.to_email,ok:res.ok});
    return json({ok:res.ok,pending:!!res.pending,delivery_state:res.delivery_state||"",error:res.error||null});
  }

  // 2) MỤC V.1: Quản trị Menu & Điều hướng (Header, Menu con, Truy cập nhanh, Footer, CTA)
  if(p==="/api/admin/navigation"&&request.method==="GET"){
    if(!hasAnyPermission(user,["navigation.view","navigation.manage","settings.manage"])) return json({error:"FORBIDDEN"},403);
    const rs=await env.DB.prepare("SELECT * FROM navigation_items ORDER BY location ASC, sort_order ASC, id ASC").all();
    return json({items:rs.results||[]});
  }

  if(p==="/api/admin/navigation"&&request.method==="POST"){
    if(!hasAnyPermission(user,["navigation.manage","settings.manage"])) return json({error:"FORBIDDEN"},403);
    const body=await readJson(request)||{};
    const labelVi=String(body.label_vi||"").trim();
    const labelEn=String(body.label_en||labelVi).trim();
    const targetUrl=String(body.url||"").trim();
    const location=String(body.location||"header").trim();
    if(!labelVi||!targetUrl) return json({error:"INVALID_INPUT",message:"Nhãn hiển thị và đường dẫn URL là bắt buộc."},400);
    if(!targetUrl.startsWith("mailto:") && !targetUrl.startsWith("tel:") && !isSafeSkyFirstUrl(targetUrl, env.APP_URL||"https://app.skyfirst.io.vn")){
      return json({error:"UNSAFE_URL",message:"Không cho phép cấu hình URL dẫn tới tên miền không tin cậy hoặc nguy hiểm."},400);
    }
    const id=body.id?String(body.id).trim():uid("nav");
    const target=body.target==="_blank"?"_blank":"_self";
    const sortOrder=Number(body.sort_order||50);
    const visible=body.visible===false||body.visible===0?0:1;
    const status=body.status==="draft"?"draft":"published";
    await env.DB.prepare(
      "INSERT INTO navigation_items(id,location,parent_id,label_vi,label_en,url,target,icon,sort_order,visible,status,updated_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET location=excluded.location,parent_id=excluded.parent_id,label_vi=excluded.label_vi,label_en=excluded.label_en,url=excluded.url,target=excluded.target,icon=excluded.icon,sort_order=excluded.sort_order,visible=excluded.visible,status=excluded.status,updated_by=excluded.updated_by,updated_at=CURRENT_TIMESTAMP"
    ).bind(id,location,body.parent_id||null,labelVi,labelEn,targetUrl,target,String(body.icon||""),sortOrder,visible,status,user.id).run();
    await audit(env,request,user,"Cập nhật mục điều hướng","navigation_item",id,{location,label_vi:labelVi,url:targetUrl,status});
    invalidatePublicCache(url,["/api/config"],ctx);
    return json({ok:true,id},201);
  }

  const navItemMatch=p.match(/^\/api\/admin\/navigation\/([^/]+)$/);
  if(navItemMatch&&request.method==="PATCH"){
    if(!hasAnyPermission(user,["navigation.manage","settings.manage"])) return json({error:"FORBIDDEN"},403);
    const id=decodeURIComponent(navItemMatch[1]),body=await readJson(request)||{};
    const curr=await env.DB.prepare("SELECT * FROM navigation_items WHERE id=?").bind(id).first();
    if(!curr) return json({error:"NOT_FOUND"},404);
    const nextUrl=body.url!==undefined?String(body.url).trim():curr.url;
    if(!nextUrl.startsWith("mailto:") && !nextUrl.startsWith("tel:") && !isSafeSkyFirstUrl(nextUrl, env.APP_URL||"https://app.skyfirst.io.vn")){
      return json({error:"UNSAFE_URL",message:"URL đích không hợp lệ hoặc không thuộc tên miền an toàn."},400);
    }
    await env.DB.prepare(
      "UPDATE navigation_items SET location=?,parent_id=?,label_vi=?,label_en=?,url=?,target=?,icon=?,sort_order=?,visible=?,status=?,updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=?"
    ).bind(
      body.location||curr.location,
      body.parent_id!==undefined?body.parent_id:curr.parent_id,
      body.label_vi||curr.label_vi,
      body.label_en??curr.label_en,
      nextUrl,
      body.target==="_blank"?"_blank":(body.target==="_self"?"_self":curr.target),
      body.icon??curr.icon,
      body.sort_order!==undefined?Number(body.sort_order):curr.sort_order,
      body.visible!==undefined?(body.visible?1:0):curr.visible,
      body.status||curr.status,
      user.id,
      id
    ).run();
    await audit(env,request,user,"Chỉnh sửa mục điều hướng","navigation_item",id,body);
    invalidatePublicCache(url,["/api/config"],ctx);
    return json({ok:true});
  }

  if(navItemMatch&&request.method==="DELETE"){
    if(!hasAnyPermission(user,["navigation.manage","settings.manage"])) return json({error:"FORBIDDEN"},403);
    const id=decodeURIComponent(navItemMatch[1]);
    await env.DB.prepare("DELETE FROM navigation_items WHERE id=? OR parent_id=?").bind(id,id).run();
    await audit(env,request,user,"Xóa mục điều hướng","navigation_item",id,{});
    invalidatePublicCache(url,["/api/config"],ctx);
    return json({ok:true});
  }

  // 3) MỤC V.2: Quản lý URL, đường dẫn trang và chuyển hướng an toàn (chống Open Redirect & vòng lặp)
  if(p==="/api/admin/redirects"&&request.method==="GET"){
    if(!hasAnyPermission(user,["redirect.manage","navigation.view","settings.manage"])) return json({error:"FORBIDDEN"},403);
    const rs=await env.DB.prepare("SELECT * FROM url_redirects ORDER BY created_at DESC").all();
    return json({items:rs.results||[]});
  }

  if(p==="/api/admin/redirects"&&request.method==="POST"){
    if(!hasAnyPermission(user,["redirect.manage","navigation.manage","settings.manage"])) return json({error:"FORBIDDEN"},403);
    const body=await readJson(request)||{};
    const sourcePath=String(body.source_path||"").trim();
    const targetPath=String(body.target_path||body.target_url||"").trim();
    if(!sourcePath.startsWith("/") || sourcePath.startsWith("//") || !targetPath){
      return json({error:"INVALID_PATH",message:"Đường dẫn nguồn phải bắt đầu bằng '/' và có đích hợp lệ."},400);
    }
    if(sourcePath===targetPath){
      return json({error:"REDIRECT_LOOP",message:"Đường dẫn nguồn và đường dẫn đích không được trùng nhau (gây vòng lặp)."},400);
    }
    if(!isSafeSkyFirstUrl(targetPath, env.APP_URL||"https://app.skyfirst.io.vn")){
      return json({error:"UNSAFE_REDIRECT_TARGET",message:"Chặn cấu hình chuyển hướng mở (Open Redirect) tới tên miền ngoài hệ sinh thái Sky First."},400);
    }
    // Kiểm tra vòng lặp chuyển hướng bậc 2
    const reverse=await env.DB.prepare("SELECT id FROM url_redirects WHERE source_path=? AND target_path=? AND enabled=1").bind(targetPath,sourcePath).first();
    if(reverse){
      return json({error:"REDIRECT_CHAIN_LOOP",message:"Phát hiện vòng lặp chuyển hướng qua lại giữa hai đường dẫn."},400);
    }
    const id=body.id?String(body.id).trim():uid("red");
    const code=Number(body.http_code)===302?302:301;
    await env.DB.prepare(
      "INSERT INTO url_redirects(id,source_path,target_path,http_code,enabled,notes,created_by) VALUES(?,?,?,?,?,?,?) ON CONFLICT(source_path) DO UPDATE SET target_path=excluded.target_path,http_code=excluded.http_code,enabled=excluded.enabled,notes=excluded.notes,updated_at=CURRENT_TIMESTAMP"
    ).bind(id,sourcePath,targetPath,code,body.enabled===false?0:1,String(body.notes||""),user.id).run();
    await audit(env,request,user,"Cấu hình chuyển hướng URL","url_redirect",id,{source_path:sourcePath,target_path:targetPath,http_code:code});
    return json({ok:true,id},201);
  }

  const redirectMatch=p.match(/^\/api\/admin\/redirects\/([^/]+)$/);
  if(redirectMatch&&request.method==="DELETE"){
    if(!hasAnyPermission(user,["redirect.manage","navigation.manage","settings.manage"])) return json({error:"FORBIDDEN"},403);
    const id=decodeURIComponent(redirectMatch[1]);
    await env.DB.prepare("DELETE FROM url_redirects WHERE id=?").bind(id).run();
    await audit(env,request,user,"Xóa chuyển hướng URL","url_redirect",id,{});
    return json({ok:true});
  }

  // 4) MỤC V.3 & MỤC 16: Quản trị Liên kết toàn hệ thống & Rà soát tên miền (app.skyfirst.io.vn vs ctt.skyfirst.io.vn)
  if(p==="/api/admin/system-links"&&request.method==="GET"){
    if(!hasAnyPermission(user,["navigation.view","navigation.manage","settings.manage"])) return json({error:"FORBIDDEN"},403);
    const rs=await env.DB.prepare("SELECT * FROM system_links ORDER BY usage_location ASC, link_key ASC").all();
    return json({items:rs.results||[]});
  }

  if(p==="/api/admin/system-links"&&request.method==="POST"){
    if(!hasAnyPermission(user,["navigation.manage","settings.manage"])) return json({error:"FORBIDDEN"},403);
    const body=await readJson(request)||{};
    const linkKey=String(body.link_key||"").trim();
    const labelVi=String(body.label_vi||"").trim();
    const targetUrl=String(body.target_url||"").trim();
    if(!linkKey||!labelVi||!targetUrl) return json({error:"INVALID_INPUT"},400);
    if(!targetUrl.startsWith("mailto:") && !targetUrl.startsWith("tel:") && !isSafeSkyFirstUrl(targetUrl, env.APP_URL||"https://app.skyfirst.io.vn")){
      return json({error:"UNSAFE_URL",message:"Liên kết hệ thống phải trỏ tới đường dẫn nội bộ hoặc tên miền được phép trong hệ sinh thái Sky First."},400);
    }
    const id=body.id?String(body.id).trim():uid("lnk");
    await env.DB.prepare(
      "INSERT INTO system_links(id,link_key,label_vi,label_en,usage_location,target_url,domain_role,status,is_external,notes,updated_by) VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(link_key) DO UPDATE SET label_vi=excluded.label_vi,label_en=excluded.label_en,usage_location=excluded.usage_location,target_url=excluded.target_url,domain_role=excluded.domain_role,status=excluded.status,notes=excluded.notes,updated_by=excluded.updated_by,updated_at=CURRENT_TIMESTAMP"
    ).bind(id,linkKey,labelVi,String(body.label_en||labelVi),String(body.usage_location||"global"),targetUrl,String(body.domain_role||"app.skyfirst.io.vn"),String(body.status||"active"),targetUrl.startsWith("http")?1:0,String(body.notes||""),user.id).run();
    await audit(env,request,user,"Cập nhật liên kết toàn hệ thống","system_link",linkKey,{target_url:targetUrl});
    invalidatePublicCache(url,["/api/config"],ctx);
    return json({ok:true,id},201);
  }

  if(p==="/api/admin/system-links/audit"&&(request.method==="GET"||request.method==="POST")){
    if(!hasAnyPermission(user,["navigation.view","navigation.manage","settings.manage"])) return json({error:"FORBIDDEN"},403);
    const validInternalRoutes=new Set(["/","/chuong-trinh","/su-kien","/tai-lieu","/bieu-mau","/gcn","/ho-so","/tai-tro","/an-toan","/tra-cuu","/tim-kiem","/admin","/admin/login"]);
    const [navRs,lnkRs,pageRs,redRs]=await env.DB.batch([
      env.DB.prepare("SELECT id,label_vi,url,location FROM navigation_items"),
      env.DB.prepare("SELECT id,link_key,target_url,domain_role FROM system_links"),
      env.DB.prepare("SELECT slug FROM cms_pages WHERE status='published'"),
      env.DB.prepare("SELECT source_path FROM url_redirects WHERE enabled=1")
    ]);
    for(const pg of pageRs.results||[]) validInternalRoutes.add("/trang/"+pg.slug);
    for(const rd of redRs.results||[]) validInternalRoutes.add(rd.source_path);
    const issues=[];
    const urlCounter=new Map();
    for(const n of navRs.results||[]){
      const u=String(n.url||"");
      urlCounter.set(n.location+":"+u,(urlCounter.get(n.location+":"+u)||0)+1);
      if(u.startsWith("/") && !validInternalRoutes.has(u) && !u.startsWith("/trang/")){
        issues.push({type:"broken_internal_path",source:"navigation_items",id:n.id,url:u,message:`Đường dẫn nội bộ '${u}' chưa có trang đích hoặc chuyển hướng.`});
      }
    }
    for(const [k,cnt] of urlCounter.entries()){
      if(cnt>1) issues.push({type:"duplicate_link_in_location",source:"navigation_items",key:k,count:cnt,message:`Phát hiện ${cnt} liên kết trùng nhau trong cùng vị trí (${k}).`});
    }
    return json({
      ok:true,
      summary:{
        navigation_count:(navRs.results||[]).length,
        system_links_count:(lnkRs.results||[]).length,
        published_pages_count:(pageRs.results||[]).length,
        active_redirects_count:(redRs.results||[]).length,
        issues_count:issues.length
      },
      domain_separation:{
        "app.skyfirst.io.vn":"Hệ thống Thông tin Số Sky First (Cổng trung tâm)",
        "ctt.skyfirst.io.vn":"Hệ thống CTT riêng biệt trong hệ sinh thái (tương thích liên kết tích hợp)",
        "skyfirst.io.vn":"Trang Thông tin Điện tử Sky First"
      },
      issues
    });
  }

  // 5) MỤC V.4: Quản lý Thư mục, Danh mục nội dung & Kiểm tra tham chiếu trước khi xóa/di chuyển
  if(p==="/api/admin/folders"&&request.method==="GET"){
    if(!hasAnyPermission(user,["folder.manage","document.view","document.manage","cms.view"])) return json({error:"FORBIDDEN"},403);
    const [fldRs,docRs,cmsRs]=await env.DB.batch([
      env.DB.prepare("SELECT * FROM content_folders ORDER BY module_scope ASC, sort_order ASC"),
      env.DB.prepare("SELECT id,metadata_json,doc_type FROM documents"),
      env.DB.prepare("SELECT id,category FROM cms_pages")
    ]);
    const docs=docRs.results||[], pages=cmsRs.results||[];
    const items=(fldRs.results||[]).map(f=>{
      const docCount=docs.filter(d=>{
        try{const m=JSON.parse(d.metadata_json||"{}");return m.folder_id===f.id||m.category===f.slug||d.doc_type===f.name_vi;}catch{return false}
      }).length;
      const pageCount=pages.filter(pg=>pg.category===f.slug||pg.category===f.id).length;
      return {...f, reference_count:docCount+pageCount, documents_count:docCount, pages_count:pageCount};
    });
    return json({items});
  }

  if(p==="/api/admin/folders"&&request.method==="POST"){
    if(!hasAnyPermission(user,["folder.manage","document.manage","settings.manage"])) return json({error:"FORBIDDEN"},403);
    const body=await readJson(request)||{};
    const nameVi=String(body.name_vi||"").trim();
    const slug=String(body.slug||nameVi).trim().toLowerCase().replace(/[^a-z0-9-]+/g,"-").replace(/^-+|-+$/g,"");
    if(!nameVi||!slug) return json({error:"INVALID_INPUT",message:"Tên thư mục và mã đường dẫn (slug) là bắt buộc."},400);
    const id=body.id?String(body.id).trim():uid("fld");
    await env.DB.prepare(
      "INSERT INTO content_folders(id,parent_id,name_vi,name_en,slug,module_scope,description,sort_order,status,created_by) VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET parent_id=excluded.parent_id,name_vi=excluded.name_vi,name_en=excluded.name_en,slug=excluded.slug,module_scope=excluded.module_scope,description=excluded.description,sort_order=excluded.sort_order,status=excluded.status,updated_at=CURRENT_TIMESTAMP"
    ).bind(id,body.parent_id||null,nameVi,String(body.name_en||nameVi),slug,String(body.module_scope||"documents"),String(body.description||""),Number(body.sort_order||10),String(body.status||"active"),user.id).run();
    await audit(env,request,user,"Tạo/Cập nhật thư mục nội dung","content_folder",id,{name_vi:nameVi,slug});
    invalidatePublicCache(url,["/api/config","/api/public/resources"],ctx);
    return json({ok:true,id,slug},201);
  }

  const folderMatch=p.match(/^\/api\/admin\/folders\/([^/]+)$/);
  if(folderMatch&&request.method==="DELETE"){
    if(!hasAnyPermission(user,["folder.manage","document.manage","settings.manage"])) return json({error:"FORBIDDEN"},403);
    const id=decodeURIComponent(folderMatch[1]);
    const folder=await env.DB.prepare("SELECT * FROM content_folders WHERE id=?").bind(id).first();
    if(!folder) return json({error:"NOT_FOUND"},404);
    const child=await env.DB.prepare("SELECT COUNT(*) AS c FROM content_folders WHERE parent_id=?").bind(id).first();
    const docRefs=await env.DB.prepare("SELECT COUNT(*) AS c FROM documents WHERE COALESCE(metadata_json,'') LIKE ? OR doc_type=?").bind(`%${id}%`,folder.name_vi).first();
    const totalRefs=Number(child?.c||0)+Number(docRefs?.c||0);
    if(totalRefs>0 && url.searchParams.get("force")!=="1"){
      return json({
        error:"FOLDER_HAS_REFERENCES",
        reference_count:totalRefs,
        message:`Thư mục "${folder.name_vi}" đang được tham chiếu bởi ${totalRefs} tài nguyên/thư mục con. Vui lòng chuyển tài nguyên sang thư mục khác trước khi xóa để không làm hỏng liên kết.`
      },409);
    }
    await env.DB.prepare("DELETE FROM content_folders WHERE id=?").bind(id).run();
    await audit(env,request,user,"Xóa thư mục nội dung","content_folder",id,{name_vi:folder.name_vi});
    invalidatePublicCache(url,["/api/config","/api/public/resources"],ctx);
    return json({ok:true});
  }

  // 6) MỤC 10: Quản lý vòng đời dữ liệu và bản ghi sau khi công bố trên toàn hệ thống
  const lifecycleHistoryMatch=p.match(/^\/api\/admin\/lifecycle\/([a-z_]+)\/([^/]+)(?:\/history)?$/);
  if(lifecycleHistoryMatch&&request.method==="GET"){
    if(!hasAnyPermission(user,["lifecycle.manage","audit.view","certificate.view","document.view","submission.view"])) return json({error:"FORBIDDEN"},403);
    const entityType=lifecycleHistoryMatch[1];
    const entityId=decodeURIComponent(lifecycleHistoryMatch[2]);
    const rs=await env.DB.prepare("SELECT * FROM entity_lifecycle_history WHERE entity_type=? AND entity_id=? ORDER BY created_at DESC, rowid DESC").bind(entityType,entityId).all();
    return json({items:rs.results||[]});
  }

  const lifecycleActionMatch=p.match(/^\/api\/admin\/lifecycle\/([a-z_]+)\/([^/]+)$/);
  if(lifecycleActionMatch&&request.method==="POST"){
    const entityType=lifecycleActionMatch[1];
    const entityId=decodeURIComponent(lifecycleActionMatch[2]);
    const body=await readJson(request)||{};
    const action=String(body.action||"").trim().toLowerCase();
    const reason=String(body.reason||"").trim();

    const entityConfig={
      certificates:{table:"certificates",pk:"id",perm:"certificate.approve",statusCol:"status"},
      documents:{table:"documents",pk:"id",perm:"document.manage",statusCol:"status"},
      submissions:{table:"submissions",pk:"code",perm:"submission.manage",statusCol:"status"},
      classes:{table:"classes",pk:"id",perm:"class.manage",statusCol:"status"},
      events:{table:"events",pk:"id",perm:"event.manage",statusCol:"status"},
      news:{table:"news",pk:"id",perm:"news.manage",statusCol:"status"},
      forms:{table:"forms",pk:"id",perm:"form.manage",statusCol:"enabled"},
      sponsorship_campaigns:{table:"sponsorship_campaigns",pk:"id",perm:"sponsorship.approve",statusCol:"status"},
      cms_pages:{table:"cms_pages",pk:"id",perm:"cms.publish",statusCol:"status"}
    }[entityType];

    if(!entityConfig) return json({error:"UNSUPPORTED_ENTITY_TYPE"},400);
    if(!hasAnyPermission(user,[entityConfig.perm,"lifecycle.manage"])) return json({error:"FORBIDDEN",permission:entityConfig.perm},403);
    if(["revoke","replace","reissue","restore"].includes(action) && reason.length<3){
      return json({error:"REASON_REQUIRED",message:"Thao tác thu hồi, thay thế, cấp lại hoặc khôi phục bắt buộc phải ghi rõ lý do kiểm toán."},400);
    }

    const row=await env.DB.prepare(`SELECT * FROM ${entityConfig.table} WHERE ${entityConfig.pk}=?`).bind(entityId).first();
    if(!row) return json({error:"NOT_FOUND",message:"Không tìm thấy bản ghi cần thao tác vòng đời."},404);

    const prevStatus=String(row[entityConfig.statusCol]??"");
    const isRevoked=/revoked|thu hồi|đã thu hồi|vô hiệu/i.test(prevStatus);

    // Mục 10: Việc khôi phục không được làm sống lại dữ liệu đã bị thu hồi nếu không có quy trình phê duyệt cho phép
    if(action==="restore" && isRevoked){
      const canReapprove=hasPermission(user,"approval.decide") || (user.roles||[]).some(r=>["owner","super_admin"].includes(r.role_id));
      if(!canReapprove || body.approved_reinstatement!==true){
        return json({
          error:"REVOKED_RESTORE_FORBIDDEN",
          message:"Bản ghi đã bị thu hồi chính thức không được tự ý khôi phục nếu chưa qua quy trình phê duyệt cấp lại (approved_reinstatement)."
        },409);
      }
    }

    let nextStatus=prevStatus;
    let replacementId=String(body.replacement_id||"").trim();

    if(entityType==="certificates"){
      if(action==="hide") nextStatus="hidden";
      else if(action==="revoke"){
        nextStatus="revoked";
        await env.DB.prepare("UPDATE certificates SET status='revoked',revoked_by=?,revoked_at=CURRENT_TIMESTAMP,revocation_reason=? WHERE id=?").bind(user.id,reason,entityId).run();
        await env.DB.prepare("UPDATE issued_document_codes SET is_active=0 WHERE document_id=?").bind(entityId).run().catch(()=>{});
      }else if(action==="replace"){
        nextStatus="superseded";
        await env.DB.prepare("UPDATE certificates SET status='superseded',superseded_by_id=?,revocation_reason=? WHERE id=?").bind(replacementId||null,reason,entityId).run();
      }else if(action==="reissue" || action==="restore"){
        nextStatus="issued";
        await env.DB.prepare("UPDATE certificates SET status='issued',issued_at=COALESCE(issued_at,CURRENT_TIMESTAMP),revoked_at=NULL WHERE id=?").bind(entityId).run();
        await env.DB.prepare("UPDATE issued_document_codes SET is_active=1 WHERE document_id=?").bind(entityId).run().catch(()=>{});
      }
    }else if(entityType==="documents"){
      if(action==="hide"){
        nextStatus="Ngừng công bố";
        await env.DB.prepare("UPDATE documents SET visibility='private',status='Ngừng công bố',updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(entityId).run();
      }else if(action==="revoke"){
        nextStatus="Đã thu hồi";
        await env.DB.prepare("UPDATE documents SET visibility='private',status='Đã thu hồi',updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(entityId).run();
      }else if(action==="replace"){
        nextStatus="Đã thay thế";
        let meta={}; try{meta=JSON.parse(row.metadata_json||"{}")}catch{}
        meta.superseded_by_id=replacementId; meta.lifecycle_reason=reason;
        await env.DB.prepare("UPDATE documents SET status='Đã thay thế',metadata_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(JSON.stringify(meta),entityId).run();
      }else if(action==="restore" || action==="reissue"){
        nextStatus="Có hiệu lực";
        await env.DB.prepare("UPDATE documents SET visibility='public',status='Có hiệu lực',updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(entityId).run();
      }
    }else if(entityType==="forms"){
      const en=(action==="hide"||action==="revoke")?0:1;
      nextStatus=String(en);
      await env.DB.prepare("UPDATE forms SET enabled=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(en,entityId).run();
    }else{
      const statusMap={
        hide: entityType==="cms_pages"?"archived":"ẩn",
        revoke: "Đã thu hồi",
        replace: "Đã thay thế",
        reissue: entityType==="cms_pages"?"published":(entityType==="news"?"published":"Đang mở"),
        restore: entityType==="cms_pages"?"published":(entityType==="news"?"published":"Đang hoạt động"),
        edit: body.new_status||prevStatus
      };
      nextStatus=statusMap[action]||body.new_status||prevStatus;
      await env.DB.prepare(`UPDATE ${entityConfig.table} SET ${entityConfig.statusCol}=? WHERE ${entityConfig.pk}=?`).bind(nextStatus,entityId).run();
    }

    const histId=uid("lfh");
    await env.DB.prepare(
      "INSERT INTO entity_lifecycle_history(id,entity_type,entity_id,action,previous_status,new_status,replacement_id,reason,actor_user_id,actor_email,snapshot_json) VALUES(?,?,?,?,?,?,?,?,?,?,?)"
    ).bind(histId,entityType,entityId,action,prevStatus,nextStatus,replacementId,reason,user.id,user.email||"",JSON.stringify(row)).run();

    await audit(env,request,user,`Vòng đời bản ghi: ${action}`,entityType,entityId,{previous_status:prevStatus,new_status:nextStatus,replacement_id:replacementId,reason});
    invalidatePublicCache(url,["/api/config","/api/public/resources","/api/public/classes","/api/public/events","/api/public/news","/api/public/sponsorship","/api/public/pages"],ctx);

    if(body.notify_email){
      await sendTemplatedEmail(env,"record_lifecycle_changed",String(body.notify_email),{
        recipient_name:row.full_name||row.title||"Quý vị",
        request_id:row.code||entityId,
        registration_type:entityType,
        status:nextStatus,
        additional_info:reason
      },{actorUserId:user.id});
    }

    return json({ok:true,id:histId,entity_type:entityType,entity_id:entityId,action,previous_status:prevStatus,new_status:nextStatus,replacement_id:replacementId});
  }

  return json({error:"ADMIN_ROUTE_NOT_FOUND"},404);
}

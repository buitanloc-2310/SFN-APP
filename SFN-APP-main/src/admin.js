
import {json, readJson, uid, sha256, ipHash, escapeHtml, pbkdf2, newSalt} from "./utils.js";
import {getAuthUser, requirePermission, createInvitedAccount} from "./auth.js";
import {hasPermission, highestRoleLevel, roleLevel} from "./permissions.js";
import {sendTemplatedEmail} from "./email.js";

async function audit(env,request,user,action,entityType="",entityId="",details={}){
  await env.DB.prepare("INSERT INTO audit_log(actor_user_id,actor_email,action,entity_type,entity_id,details_json,ip_hash) VALUES(?,?,?,?,?,?,?)")
    .bind(user?.id||null,user?.email||"",action,entityType,entityId,JSON.stringify(details),await ipHash(request)).run();
}
async function setting(env,key,fallback=null){
  const r=await env.DB.prepare("SELECT value_json FROM settings WHERE key=?").bind(key).first();
  if(!r) return fallback; try{return JSON.parse(r.value_json)}catch{return r.value_json}
}
async function nextCounter(env,key){
  await env.DB.prepare("INSERT OR IGNORE INTO counters(key,value) VALUES(?,0)").bind(key).run();
  const r=await env.DB.prepare("UPDATE counters SET value=value+1 WHERE key=? RETURNING value").bind(key).first();
  return Number(r?.value||1);
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
  if((actor.roles||[]).some(r=>r.role_id==="super_admin")) return true;
  return roleLevel(roleId)<highestRoleLevel(actor) && roleId!=="super_admin";
}
async function listUserRoles(env,userId){
  const rs=await env.DB.prepare("SELECT role_id,scope_unit_code,granted_at,expires_at FROM user_roles WHERE user_id=?").bind(userId).all();
  return rs.results||[];
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

export async function adminRoute(request,env,url){
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

  if(p==="/api/admin/submissions"&&request.method==="GET"){
    const deny=requirePermission(user,"submission.view");if(deny)return deny;
    const status=url.searchParams.get("status"),form=url.searchParams.get("form"),q=url.searchParams.get("q");
    let sql="SELECT code,form_id,full_name,email,status,assigned_to,score,internal_note,created_at,updated_at FROM submissions WHERE 1=1",vals=[];
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
    const files=await env.DB.prepare("SELECT id,field_key,filename,mime,size,created_at FROM files WHERE submission_code=?").bind(row.code).all();
    return json({item:{...row,answers:parseBodyJson(row,"answers_json"),terms:JSON.parse(row.terms_snapshot_json||"[]")},files:files.results||[]});
  }

  if(subMatch&&request.method==="PATCH"){
    const deny=requirePermission(user,"submission.manage");if(deny)return deny;
    const code=decodeURIComponent(subMatch[1]),body=await readJson(request)||{};
    const current=await env.DB.prepare("SELECT * FROM submissions WHERE code=?").bind(code).first();
    if(!current)return json({error:"NOT_FOUND"},404);
    const allowed=["status","assigned_to","score","internal_note"],sets=[],vals=[];
    for(const k of allowed) if(k in body){sets.push(`${k}=?`);vals.push(body[k])}
    if(sets.length){
      vals.push(code); await env.DB.prepare(`UPDATE submissions SET ${sets.join(",")},updated_at=CURRENT_TIMESTAMP WHERE code=?`).bind(...vals).run();
    }
    await audit(env,request,user,"Cập nhật hồ sơ","submission",code,body);
    if(body.status&&current.email&&body.status!==current.status){
      await sendTemplatedEmail(env,"status_update",current.email,{code,status:body.status,note_block:body.note?`<p>${escapeHtml(body.note)}</p>`:""});
      if(current.user_id) await notifyUser(env,current.user_id,`Hồ sơ ${code}: ${body.status}`,body.note||"","submission",`/?record=${encodeURIComponent(code)}`);
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
    const items=[];
    for(const u of rs.results||[]) items.push({...u,roles:await listUserRoles(env,u.id)});
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
    if(target.email.toLowerCase()==="skyfirst.ec@gmail.com")return json({error:"ROOT_SUPER_ADMIN_PROTECTED"},403);
    const chars="ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#%",rnd=new Uint8Array(16);crypto.getRandomValues(rnd);
    let temp="SFN!";for(const b of rnd)temp+=chars[b%chars.length];
    const salt=newSalt(),hash=await pbkdf2(temp,salt,150000);
    await env.DB.batch([
      env.DB.prepare("UPDATE users SET password_salt=?,password_hash=?,password_iterations=150000,must_change_password=1,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(salt,hash,targetId),
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
    await env.DB.prepare("INSERT INTO forms(id,name,prefix,description,audience,min_age,enabled,recipient_email,version,config_json,updated_by) VALUES(?,?,?,?,?,?,1,?,1,?,?)")
      .bind(idForm,body.name,body.prefix,body.description||"",body.audience||"public",body.min_age??null,body.recipient_email||"skyfirst.ec@gmail.com",JSON.stringify(body.config),user.id).run();
    await audit(env,request,user,"Tạo biểu mẫu","form",idForm,{name:body.name});return json({ok:true,id:idForm});
  }
  const formMatch=p.match(/^\/api\/admin\/forms\/([^/]+)$/);
  if(formMatch&&request.method==="PUT"){
    const deny=requirePermission(user,"form.manage");if(deny)return deny;
    const fid=decodeURIComponent(formMatch[1]),body=await readJson(request)||{};
    const current=await env.DB.prepare("SELECT * FROM forms WHERE id=?").bind(fid).first();if(!current)return json({error:"NOT_FOUND"},404);
    await env.DB.prepare("UPDATE forms SET name=?,prefix=?,description=?,audience=?,min_age=?,enabled=?,recipient_email=?,version=version+1,config_json=?,updated_at=CURRENT_TIMESTAMP,updated_by=? WHERE id=?")
      .bind(body.name||current.name,body.prefix||current.prefix,body.description??current.description,body.audience||current.audience,body.min_age??current.min_age,body.enabled===false?0:1,body.recipient_email||current.recipient_email,JSON.stringify(body.config||JSON.parse(current.config_json)),user.id,fid).run();
    await audit(env,request,user,"Cập nhật biểu mẫu","form",fid,{version:Number(current.version)+1});return json({ok:true});
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
    const type=genericList[1],g=GENERIC[type],deny=requirePermission(user,g.permission);if(deny)return deny;
    const rs=await env.DB.prepare(`SELECT * FROM ${g.table} ORDER BY rowid DESC LIMIT 1500`).all();return json({items:rs.results||[]});
  }
  if(genericList&&request.method==="POST"){
    const type=genericList[1],g=GENERIC[type],deny=requirePermission(user,g.permission);if(deny)return deny;
    const body=await readJson(request)||{},data={...g.defaults,...body};
    const idValue=body[g.id]|| (g.id==="code"?String(body.code||"").trim():uid(type.slice(0,3)));
    if(!idValue) return json({error:"MISSING_ID"},400);
    const ins=makeInsert(g.table,g.id,idValue,g.fields,data);
    await env.DB.prepare(ins.sql).bind(...ins.vals).run();
    await audit(env,request,user,`Tạo ${type}`,type,String(idValue),data);return json({ok:true,id:idValue});
  }
  const genericOne=p.match(/^\/api\/admin\/content\/(news|classes|events|units|documents|tasks)\/([^/]+)$/);
  if(genericOne&&request.method==="PUT"){
    const [_,type,idRaw]=genericOne,g=GENERIC[type],deny=requirePermission(user,g.permission);if(deny)return deny;
    const idValue=decodeURIComponent(idRaw),body=await readJson(request)||{},upd=makeUpdate(g.table,g.id,idValue,g.fields,body);
    if(upd) await env.DB.prepare(upd.sql).bind(...upd.vals).run();
    await audit(env,request,user,`Cập nhật ${type}`,type,idValue,body);return json({ok:true});
  }
  if(genericOne&&request.method==="DELETE"){
    const [_,type,idRaw]=genericOne,g=GENERIC[type],deny=requirePermission(user,g.permission);if(deny)return deny;
    const idValue=decodeURIComponent(idRaw);await env.DB.prepare(`DELETE FROM ${g.table} WHERE ${g.id}=?`).bind(idValue).run();
    await audit(env,request,user,`Xóa ${type}`,type,idValue,{});return json({ok:true});
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
      .bind(idC,body.cert_type,body.full_name,body.email||"",body.content,user.id,token,JSON.stringify(body.metadata||{})).run();
    const idA=uid("approval");
    await env.DB.prepare("INSERT INTO approvals(id,entity_type,entity_id,action,requested_by,assigned_role,status,due_at) VALUES(?,'certificate',?,'Phê duyệt cấp GCN/GXN',?,'network_secretary','pending',datetime('now','+7 days'))")
      .bind(idA,idC,user.id).run();
    await audit(env,request,user,"Đề nghị cấp GCN/GXN","certificate",idC,{approval:idA});return json({ok:true,id:idC,approval_id:idA});
  }
  const certMatch=p.match(/^\/api\/admin\/certificates\/([^/]+)$/);
  if(certMatch&&request.method==="PATCH"){
    const idC=decodeURIComponent(certMatch[1]),body=await readJson(request)||{};
    const current=await env.DB.prepare("SELECT * FROM certificates WHERE id=?").bind(idC).first();if(!current)return json({error:"NOT_FOUND"},404);
    if(body.action==="issue"){
      const deny=requirePermission(user,"certificate.issue");if(deny)return deny;
      if(current.status!=="approved")return json({error:"NOT_APPROVED"},409);
      const year=new Date().getFullYear(),kind=current.cert_type.toLowerCase().includes("xác nhận")?"GXN":"GCN";
      const n=await nextCounter(env,`certificate:${kind}:${year}`),code=`${String(n).padStart(3,"0")}/${kind}-SFN/${year}`;
      await env.DB.prepare("UPDATE certificates SET code=?,status='issued',issued_by=?,issued_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?")
        .bind(code,user.id,idC).run();
      await env.DB.prepare("INSERT INTO certificate_history(certificate_id,action,note,actor_id) VALUES(?,'Phát hành',?,?)").bind(idC,body.note||"",user.id).run();
      await audit(env,request,user,"Phát hành GCN/GXN","certificate",idC,{code});return json({ok:true,code});
    }
    if(body.action==="revoke"){
      const deny=requirePermission(user,"certificate.issue");if(deny)return deny;
      await env.DB.prepare("UPDATE certificates SET status='revoked',updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(idC).run();
      await env.DB.prepare("INSERT INTO certificate_history(certificate_id,action,note,actor_id) VALUES(?,'Thu hồi',?,?)").bind(idC,body.note||"",user.id).run();
      await audit(env,request,user,"Thu hồi GCN/GXN","certificate",idC,{note:body.note||""});return json({ok:true});
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
    const deny=requirePermission(user,"ticket.manage");if(deny)return deny;
    const rs=await env.DB.prepare("SELECT * FROM tickets ORDER BY created_at DESC LIMIT 1000").all();return json({items:rs.results||[]});
  }
  const ticketMatch=p.match(/^\/api\/admin\/tickets\/([^/]+)$/);
  if(ticketMatch&&request.method==="PATCH"){
    const deny=requirePermission(user,"ticket.manage");if(deny)return deny;
    const idT=decodeURIComponent(ticketMatch[1]),body=await readJson(request)||{},sets=[],vals=[];
    for(const k of ["priority","status","assigned_to","subject"]) if(k in body){sets.push(`${k}=?`);vals.push(body[k])}
    if(sets.length){vals.push(idT);await env.DB.prepare(`UPDATE tickets SET ${sets.join(",")},updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(...vals).run()}
    if(body.message) await env.DB.prepare("INSERT INTO ticket_messages(ticket_id,sender_user_id,sender_type,body) VALUES(?,?,'staff',?)").bind(idT,user.id,body.message).run();
    await audit(env,request,user,"Cập nhật ticket","ticket",idT,body);return json({ok:true});
  }

  if(p==="/api/admin/email-templates"&&request.method==="GET"){
    const deny=requirePermission(user,"email.manage");if(deny)return deny;
    const rs=await env.DB.prepare("SELECT * FROM email_templates ORDER BY key").all();return json({items:rs.results||[]});
  }
  const emailTpl=p.match(/^\/api\/admin\/email-templates\/([^/]+)$/);
  if(emailTpl&&request.method==="PUT"){
    const deny=requirePermission(user,"email.manage");if(deny)return deny;
    const key=decodeURIComponent(emailTpl[1]),body=await readJson(request)||{};
    await env.DB.prepare("UPDATE email_templates SET subject_template=?,html_template=?,text_template=?,enabled=?,updated_at=CURRENT_TIMESTAMP WHERE key=?")
      .bind(body.subject_template||"",body.html_template||"",body.text_template||"",body.enabled===false?0:1,key).run();
    await audit(env,request,user,"Cập nhật mẫu email","email_template",key,{});return json({ok:true});
  }
  if(p==="/api/admin/email-logs"&&request.method==="GET"){
    const deny=requirePermission(user,"email.manage");if(deny)return deny;
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
    const tables=["settings","modules","terms","forms","units","submissions","people","people_history","teaching_scopes","internal_requests","unit_members","classes","class_enrollments","attendance","events","event_registrations","news","documents","certificates","certificate_history","approvals","interviews","evaluations","tickets","ticket_messages","notifications","email_templates","tasks","data_requests"];
    const snapshot={created_at:new Date().toISOString(),tables:{}};
    for(const t of tables){
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
    await env.FILES.put(key,file.stream(),{httpMetadata:{contentType:file.type||"application/octet-stream"}});
    await env.DB.prepare("INSERT INTO files(id,owner_user_id,r2_key,filename,mime,size,visibility) VALUES(?,?,?,?,?,?,?)")
      .bind(idF,user.id,key,safe,file.type||"",file.size||0,fd.get("visibility")==="public"?"public":"private").run();
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
    if(!(user.roles||[]).some(r=>r.role_id==="super_admin"))return json({error:"SUPER_ADMIN_REQUIRED"},403);
    const idB=decodeURIComponent(restoreMatch[1]);
    const b=await env.DB.prepare("SELECT * FROM backups WHERE id=?").bind(idB).first();if(!b)return json({error:"NOT_FOUND"},404);
    const obj=await env.FILES.get(b.r2_key);if(!obj)return json({error:"BACKUP_OBJECT_NOT_FOUND"},404);
    const snap=JSON.parse(await obj.text());
    const insertOrder=[
      "settings","modules","terms","forms","units","submissions","people","people_history","teaching_scopes","internal_requests","unit_members",
      "classes","class_enrollments","attendance","events","event_registrations","news","documents","certificates","certificate_history",
      "approvals","interviews","evaluations","tickets","ticket_messages","notifications","email_templates","tasks","data_requests"
    ];
    const allowed=new Set(insertOrder);
    // Xóa bảng con trước bảng cha để không vướng FOREIGN KEY.
    for(const table of [...insertOrder].reverse()){
      if(!(table in (snap.tables||{})))continue;
      await env.DB.prepare(`DELETE FROM ${table}`).run();
    }
    // Khôi phục bảng cha trước bảng con.
    for(const table of insertOrder){
      if(!allowed.has(table)||!(table in (snap.tables||{})))continue;
      for(const row of snap.tables[table]||[]){
        const cols=Object.keys(row); if(!cols.length)continue;
        const sql=`INSERT INTO ${table}(${cols.join(",")}) VALUES(${cols.map(()=>"?").join(",")})`;
        await env.DB.prepare(sql).bind(...cols.map(c=>row[c])).run();
      }
    }
    await audit(env,request,user,"Phục hồi dữ liệu từ backup","backup",idB,{tables:Object.keys(snap.tables||{})});return json({ok:true});
  }

  return json({error:"ADMIN_ROUTE_NOT_FOUND"},404);
}


import {json, readJson, uid, ipHash} from "./utils.js";
import {getAuthUser} from "./auth.js";
import {hasPermission} from "./permissions.js";

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

export async function meRoute(request,env,url){
  if(!url.pathname.startsWith("/api/me/")) return null;
  const user=await getAuthUser(request,env);
  if(!user) return json({error:"AUTH_REQUIRED"},401);
  const p=url.pathname;

  if(p==="/api/me/portal"&&request.method==="GET"){
    const [records,notifs,certs,person,classes,events,requests]=await env.DB.batch([
      env.DB.prepare("SELECT code,form_id,status,created_at,updated_at FROM submissions WHERE user_id=? OR lower(email)=lower(?) ORDER BY id DESC LIMIT 100").bind(user.id,user.email),
      env.DB.prepare("SELECT id,title,body,notif_type,link,read_at,created_at FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 100").bind(user.id),
      env.DB.prepare("SELECT id,code,cert_type,content,status,issued_at FROM certificates WHERE lower(email)=lower(?) ORDER BY created_at DESC").bind(user.email),
      env.DB.prepare("SELECT * FROM people WHERE user_id=? OR lower(email)=lower(?) ORDER BY id DESC LIMIT 1").bind(user.id,user.email),
      env.DB.prepare("SELECT ce.id,ce.status,c.id class_id,c.title,c.level,c.status class_status,c.schedule_json FROM class_enrollments ce JOIN classes c ON c.id=ce.class_id WHERE ce.user_id=? OR lower(ce.email)=lower(?) ORDER BY ce.id DESC").bind(user.id,user.email),
      env.DB.prepare("SELECT er.id,er.status,e.id event_id,e.title,e.start_at,e.status event_status,er.checked_in_at FROM event_registrations er JOIN events e ON e.id=er.event_id WHERE er.user_id=? OR lower(er.email)=lower(?) ORDER BY er.id DESC").bind(user.id,user.email),
      env.DB.prepare("SELECT code,request_type,status,created_at,updated_at FROM internal_requests WHERE user_id=? ORDER BY id DESC").bind(user.id)
    ]);
    return json({
      user,
      records:records.results||[],
      notifications:notifs.results||[],
      certificates:certs.results||[],
      person:person.results?.[0]||null,
      classes:classes.results||[],
      events:events.results||[],
      internal_requests:requests.results||[]
    });
  }

  if(p==="/api/me/internal-requests"&&request.method==="POST"){
    if(!hasPermission(user,"request.internal")) return json({error:"FORBIDDEN"},403);
    const body=await readJson(request)||{};
    const allowed=["Cập nhật thông tin nhân sự","Điều chuyển vị trí/đơn vị","Tạm ngừng hoạt động","Thôi nhiệm vụ/rút khỏi SFEC","Đề nghị xác nhận quá trình tham gia","Đề nghị GCN/GXN","Bàn giao nhiệm vụ","Khác"];
    if(!allowed.includes(body.request_type)||String(body.content||"").trim().length<3) return json({error:"INVALID_INPUT"},400);
    const code=await nextCode(env,"SFEC-YC");
    await env.DB.prepare("INSERT INTO internal_requests(code,user_id,request_type,content,status) VALUES(?,?,?,?,'Đã tiếp nhận')")
      .bind(code,user.id,body.request_type,String(body.content).trim()).run();
    await audit(env,request,user,"Gửi yêu cầu nội bộ","internal_request",code,{type:body.request_type});
    return json({ok:true,code});
  }

  if(p==="/api/me/notifications/read"&&request.method==="POST"){
    const body=await readJson(request)||{};
    if(body.id) await env.DB.prepare("UPDATE notifications SET read_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?").bind(body.id,user.id).run();
    else await env.DB.prepare("UPDATE notifications SET read_at=CURRENT_TIMESTAMP WHERE user_id=? AND read_at IS NULL").bind(user.id).run();
    return json({ok:true});
  }

  if(p==="/api/me/data-requests"&&request.method==="POST"){
    const body=await readJson(request)||{},type=String(body.request_type||"");
    if(!["Cập nhật dữ liệu","Đính chính dữ liệu","Yêu cầu xuất dữ liệu cá nhân","Yêu cầu xem xét xóa dữ liệu"].includes(type))
      return json({error:"INVALID_TYPE"},400);
    const id=uid("privacy");
    await env.DB.prepare("INSERT INTO data_requests(id,user_id,email,request_type,note) VALUES(?,?,?,?,?)")
      .bind(id,user.id,user.email,type,String(body.note||"")).run();
    await audit(env,request,user,"Gửi yêu cầu quyền riêng tư","data_request",id,{type});
    return json({ok:true,id});
  }

  return json({error:"ME_ROUTE_NOT_FOUND"},404);
}

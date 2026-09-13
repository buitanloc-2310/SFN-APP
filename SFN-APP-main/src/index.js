import {json, sameOrigin, isStateChanging} from "./utils.js";
import {authRoute, getAuthUser} from "./auth.js";
import {publicRoute} from "./public.js";
import {meRoute} from "./me.js";
import {adminRoute} from "./admin.js";
import {hasPermission} from "./permissions.js";

async function getSetting(env,key,fallback=null){
  try{
    const r=await env.DB.prepare("SELECT value_json FROM settings WHERE key=?").bind(key).first();
    if(!r) return fallback;
    return JSON.parse(r.value_json);
  }catch{return fallback}
}


async function notFoundPage(env){
  const title=await getSetting(env,"not_found_title","Không tìm thấy nội dung");
  const text=await getSetting(env,"not_found_text","Trang bạn đang tìm có thể đã được di chuyển, ẩn hoặc không còn tồn tại.");
  const image=await getSetting(env,"not_found_image","/assets/sfn-logo.png");
  const esc=x=>String(x||"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c]));
  return new Response(`<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>404 — Sky First</title><link rel="stylesheet" href="/styles.css"></head><body><main class="container"><div class="form-wrap"><div class="card" style="margin-top:10vh;text-align:center"><img src="${esc(image)}" style="width:90px;max-height:120px;object-fit:contain"><span class="pill">404</span><h1>${esc(title)}</h1><p class="muted">${esc(text)}</p><a class="primary" href="/#home">Về Trang chủ</a></div></div></main></body></html>`,{status:404,headers:{"content-type":"text/html; charset=utf-8"}});
}

function secure(resp){
  const h=new Headers(resp.headers);
  h.set("x-content-type-options","nosniff");
  h.set("x-frame-options","DENY");
  h.set("referrer-policy","strict-origin-when-cross-origin");
  h.set("permissions-policy","camera=(), microphone=(), geolocation=(), payment=(), usb=()");
  h.set("strict-transport-security","max-age=31536000; includeSubDomains");
  h.set("content-security-policy",[
    "default-src 'self'",
    "script-src 'self' https://challenges.cloudflare.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https://quickchart.io",
    "font-src 'self' data:",
    "connect-src 'self' https://challenges.cloudflare.com",
    "frame-src https://challenges.cloudflare.com",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'"
  ].join("; "));
  return new Response(resp.body,{status:resp.status,statusText:resp.statusText,headers:h});
}


async function servePublicMedia(request,env,url){
  if(request.method!=="GET" || !url.pathname.startsWith("/media/")) return null;
  if(!env.FILES) return json({error:"STORAGE_UNAVAILABLE"},503);
  const key=decodeURIComponent(url.pathname.slice("/media/".length));
  if(!key || key.includes("..")) return json({error:"INVALID_PATH"},400);
  const obj=await env.FILES.get(`public-media/${key}`);
  if(!obj) return json({error:"MEDIA_NOT_FOUND"},404);
  const h=new Headers();
  h.set("content-type",obj.httpMetadata?.contentType||"application/octet-stream");
  h.set("cache-control","public, max-age=86400");
  return new Response(obj.body,{headers:h});
}

async function serveEmailFile(request,env,url){
  const m=url.pathname.match(/^\/api\/email-files\/([^/]+)$/);
  if(!m||request.method!=="GET") return null;
  if(!env.FILES) return json({error:"STORAGE_UNAVAILABLE"},503);
  const id=decodeURIComponent(m[1]);
  const token=String(url.searchParams.get("token")||"");
  if(!token) return json({error:"FORBIDDEN"},403);
  const meta=await env.DB.prepare("SELECT * FROM files WHERE id=? AND email_token=?").bind(id,token).first();
  if(!meta) return json({error:"FILE_NOT_FOUND"},404);
  const obj=await env.FILES.get(meta.r2_key);
  if(!obj) return json({error:"OBJECT_NOT_FOUND"},404);
  const headers=new Headers();
  headers.set("content-type",meta.mime||obj.httpMetadata?.contentType||"image/jpeg");
  headers.set("cache-control","private, max-age=604800");
  headers.set("x-content-type-options","nosniff");
  return new Response(obj.body,{headers});
}

async function serveFile(request,env,url){
  const m=url.pathname.match(/^\/api\/files\/([^/]+)$/);
  if(!m||request.method!=="GET") return null;
  const id=decodeURIComponent(m[1]),meta=await env.DB.prepare("SELECT * FROM files WHERE id=?").bind(id).first();
  if(!meta) return json({error:"FILE_NOT_FOUND"},404);
  const user=await getAuthUser(request,env);
  const own=user && meta.owner_user_id && Number(meta.owner_user_id)===Number(user.id);
  const admin=user && hasPermission(user,"file.manage");
  if(meta.visibility!=="public"&&!own&&!admin) return json({error:"FORBIDDEN"},403);
  const obj=await env.FILES.get(meta.r2_key);
  if(!obj) return json({error:"OBJECT_NOT_FOUND"},404);
  const headers=new Headers();
  headers.set("content-type",meta.mime||obj.httpMetadata?.contentType||"application/octet-stream");
  headers.set("content-disposition",`inline; filename*=UTF-8''${encodeURIComponent(meta.filename)}`);
  headers.set("cache-control",meta.visibility==="public"?"public, max-age=3600":"private, no-store");
  return new Response(obj.body,{headers});
}

async function cleanup(env){
  await env.DB.batch([
    env.DB.prepare("DELETE FROM sessions WHERE expires_at<=CURRENT_TIMESTAMP"),
    env.DB.prepare("DELETE FROM auth_tokens WHERE expires_at<=CURRENT_TIMESTAMP OR used_at IS NOT NULL"),
    env.DB.prepare("DELETE FROM rate_limits WHERE window_start < strftime('%s','now')-86400")
  ]);
  const retention=Number(await getSetting(env,"rejected_application_retention_days",365));
  if(Number.isFinite(retention)&&retention>0){
    await env.DB.prepare("UPDATE submissions SET status='Đã lưu trữ',updated_at=CURRENT_TIMESTAMP WHERE status='Không phù hợp' AND created_at < datetime('now', ?) ")
      .bind(`-${retention} days`).run();
  }
}

async function scheduledBackup(env){
  const tables=["settings","modules","forms","terms","people","units","classes","events","news","documents","certificates","approvals","tasks"];
  const snapshot={created_at:new Date().toISOString(),kind:"automatic",tables:{}};
  for(const t of tables){
    const rs=await env.DB.prepare(`SELECT * FROM ${t}`).all();snapshot.tables[t]=rs.results||[];
  }
  const raw=JSON.stringify(snapshot),id=`backup_auto_${crypto.randomUUID().replaceAll("-","")}`;
  const key=`backups/automatic/${new Date().toISOString().slice(0,10)}/${id}.json`;
  await env.FILES.put(key,raw,{httpMetadata:{contentType:"application/json"}});
  await env.DB.prepare("INSERT INTO backups(id,r2_key,size,created_by) VALUES(?,?,?,NULL)")
    .bind(id,key,new TextEncoder().encode(raw).length).run();
}

async function handle(request,env,ctx){
  const url=new URL(request.url);

  if(isStateChanging(request) && url.pathname.startsWith("/api/")){
    const appUrl=env.APP_URL||url.origin;
    if(!sameOrigin(request,appUrl)) return json({error:"BAD_ORIGIN"},403);
  }

  if(url.pathname==="/api/health") return json({
    ok:true,app:"Sky First Network",production:true,time:new Date().toISOString(),
    database:!!env.DB,storage:!!env.FILES
  });

  const mediaResp=await servePublicMedia(request,env,url); if(mediaResp) return mediaResp;
  const emailFileResp=await serveEmailFile(request,env,url); if(emailFileResp) return emailFileResp;
  const fileResp=await serveFile(request,env,url); if(fileResp) return fileResp;
  const auth=await authRoute(request,env,url); if(auth) return auth;
  const pub=await publicRoute(request,env,url); if(pub) return pub;
  const me=await meRoute(request,env,url); if(me) return me;
  const adm=await adminRoute(request,env,url); if(adm) return adm;

  if(request.method==="GET" && (url.pathname==="/"||url.pathname==="/index.html")){
    const maintenance=await getSetting(env,"maintenance_mode",false);
    if(maintenance){
      const title=await getSetting(env,"maintenance_title","Sky First đang được cập nhật");
      const text=await getSetting(env,"maintenance_text","Hệ thống đang được nâng cấp để phục vụ bạn tốt hơn. Vui lòng quay lại sau.");
      const esc=x=>String(x||"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c]));
      return new Response(`<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><link rel="stylesheet" href="/styles.css"></head><body><main class="container"><div class="form-wrap"><div class="card" style="margin-top:10vh;text-align:center"><img src="/assets/sfn-logo.png" style="width:92px"><span class="pill">ĐANG NÂNG CẤP</span><h1>${esc(title)}</h1><p class="muted">${esc(text)}</p></div></div></main></body></html>`,{status:503,headers:{"content-type":"text/html; charset=utf-8","retry-after":"600"}});
    }
  }

  const asset=await env.ASSETS.fetch(request);
  if(asset.status!==404) return asset;
  if(request.method==="GET" && !url.pathname.startsWith("/api/")) return notFoundPage(env);
  return json({error:"NOT_FOUND"},404);
}

export default {
  async fetch(request,env,ctx){
    try{return secure(await handle(request,env,ctx));}
    catch(err){
      console.error(err);
      return secure(json({error:"INTERNAL_ERROR",message:"Hệ thống gặp lỗi. Vui lòng thử lại sau."},500));
    }
  },

  async scheduled(controller,env,ctx){
    ctx.waitUntil((async()=>{
      await cleanup(env);
      const day=new Date(controller.scheduledTime).getUTCDay();
      if(day===0) await scheduledBackup(env);
    })());
  }
};

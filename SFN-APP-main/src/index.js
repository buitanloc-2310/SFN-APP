import {json, sameOrigin, isStateChanging} from "./utils.js";
import {authRoute, getAuthUser} from "./auth.js";
import {publicRoute} from "./public.js";
import {meRoute} from "./me.js";
import {adminRoute, buildBackupSnapshot, runScheduledCmsPublishing} from "./admin.js";
import {hasPermission} from "./permissions.js";

export async function getSettingsMap(env){
  const map = {};
  try{
    if(!env?.DB) return map;
    const rs = await env.DB.prepare("SELECT key, value_json FROM settings").all();
    for(const row of rs.results || []){
      try{ map[row.key] = JSON.parse(row.value_json); }
      catch{ map[row.key] = row.value_json; }
    }
  }catch{}
  return map;
}

async function getSetting(env,key,fallback=null,preloadedMap=null){
  if(preloadedMap && key in preloadedMap) return preloadedMap[key];
  try{
    if(!env.DB) return fallback;
    const r=await env.DB.prepare("SELECT value_json FROM settings WHERE key=?").bind(key).first();
    if(!r) return fallback;
    return JSON.parse(r.value_json);
  }catch{return fallback}
}

const escHtml = (x) =>
  String(x || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c]));

async function notFoundPage(env, lang = "vi"){
  const isEn = lang === "en";
  const title = await getSetting(env, isEn ? "not_found_title_en" : "not_found_title", isEn ? "Content Not Found" : "Không tìm thấy nội dung");
  const text = await getSetting(env, isEn ? "not_found_text_en" : "not_found_text", isEn ? "The page you requested may have been moved, hidden, or no longer exists." : "Trang bạn đang tìm có thể đã được di chuyển, ẩn hoặc không còn tồn tại.");
  return new Response(`<!doctype html><html lang="${isEn ? "en" : "vi"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>404 — Hệ thống Thông tin Số Sky First</title><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/digital.css"></head><body class="public-digital"><main class="system-state-shell"><section class="system-state"><img src="/assets/sfn-logo-tight.png" alt="Logo Sky First"><span class="state-code">404 · ${isEn ? "PAGE NOT FOUND" : "KHÔNG TÌM THẤY TRANG"}</span><h1>${escHtml(title)}</h1><p>${escHtml(text)}</p><div class="actions"><a class="portal-button" href="/">${isEn ? "Back to Home →" : "Về Trang chủ →"}</a><a class="secondary" href="/tra-cuu">${isEn ? "Open Verification Hub" : "Mở Tra cứu"}</a></div></section></main></body></html>`,{status:404,headers:{"content-type":"text/html; charset=utf-8","cache-control":"no-store","x-robots-tag":"noindex"}});
}

function renderMaintenanceHtml(stateInfo, lang = "vi") {
  const isEn = lang === "en";
  const title = isEn ? (stateInfo.title_en || stateInfo.title || "Sky First Digital Information System Under Maintenance") : (stateInfo.title_vi || stateInfo.title || "Hệ thống Thông tin Số Sky First đang bảo trì");
  const message = isEn ? (stateInfo.message_en || stateInfo.message || "The system is undergoing technical maintenance to ensure security and service quality. Please check back shortly.") : (stateInfo.message_vi || stateInfo.message || "Hệ thống đang được nâng cấp định kỳ để phục vụ bạn tốt hơn. Vui lòng quay lại sau.");
  const reason = stateInfo.reason ? `<p class="muted" style="margin-top:8px"><strong>${isEn ? "Reason:" : "Lý do:"}</strong> ${escHtml(stateInfo.reason)}</p>` : "";
  const eta = (stateInfo.eta || stateInfo.scheduled_end) ? `<p class="muted" style="margin-top:4px"><strong>${isEn ? "Estimated completion:" : "Dự kiến mở lại:"}</strong> ${escHtml(stateInfo.eta || stateInfo.scheduled_end)}</p>` : "";
  const contactEmail = stateInfo.contact_email || "support@skyfirst.io.vn";
  const hotline = stateInfo.hotline || "0924 910 210";
  const badge = stateInfo.mode === "emergency_maintenance"
    ? (isEn ? "EMERGENCY MAINTENANCE" : "BẢO TRÌ KHẨN CẤP")
    : stateInfo.mode === "scheduled_maintenance"
      ? (isEn ? "SCHEDULED MAINTENANCE" : "BẢO TRÌ THEO LỊCH")
      : (isEn ? "SYSTEM MAINTENANCE" : "BẢO TRÌ HỆ THỐNG");
  return new Response(
    `<!doctype html><html lang="${isEn ? "en" : "vi"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${escHtml(title)}</title><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/digital.css"></head><body class="public-digital"><main class="system-state-shell"><section class="system-state"><img src="/assets/sfn-logo-tight.png" alt="Logo Sky First"><span class="state-code">503 · ${escHtml(badge)}</span><h1>${escHtml(title)}</h1><p>${escHtml(message)}</p>${reason}${eta}<div class="actions"><a class="secondary" href="mailto:${escHtml(contactEmail)}">${isEn ? "Contact Technical Support" : "Liên hệ hỗ trợ kỹ thuật"} (${escHtml(contactEmail)})</a><a class="secondary" href="tel:${escHtml(hotline.replace(/\s+/g, ""))}">Hotline: ${escHtml(hotline)}</a></div></section></main></body></html>`,
    {
      status: 503,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "retry-after": String(stateInfo.retry_after || 600),
        "cache-control": "no-store",
        "x-robots-tag": "noindex"
      }
    }
  );
}

export async function resolveOperationalState(env, websiteId = "app", preloadedSettings = null) {
  const smap = preloadedSettings || (await getSettingsMap(env));
  const legacyMaint = smap.maintenance_mode ?? false;
  const opModeSetting = smap.system_operational_mode ?? "normal";
  const rawCfg = (smap.maintenance_config && typeof smap.maintenance_config === "object" ? {...smap.maintenance_config} : {}) || {};
  const titleVi = smap.maintenance_title ?? (rawCfg.title_vi || "Hệ thống Thông tin Số Sky First đang bảo trì");
  const textVi = smap.maintenance_text ?? (rawCfg.message_vi || "Hệ thống đang được nâng cấp định kỳ để phục vụ bạn tốt hơn. Vui lòng quay lại sau.");
  const contactEmail = smap.support_email ?? (rawCfg.contact_email || "support@skyfirst.io.vn");
  const hotline = smap.hotline ?? (rawCfg.hotline || "0924 910 210");

  let mode = rawCfg.mode || opModeSetting || "normal";
  if (legacyMaint === true && mode === "normal") {
    mode = "manual_maintenance";
  }

  let preBannerActive = Boolean(rawCfg.show_pre_banner);
  const nowMs = Date.now();
  if (mode === "scheduled_maintenance" && (rawCfg.scheduled_start || rawCfg.scheduled_end)) {
    const startMs = rawCfg.scheduled_start ? new Date(rawCfg.scheduled_start).getTime() : 0;
    const endMs = rawCfg.scheduled_end ? new Date(rawCfg.scheduled_end).getTime() : Infinity;
    if (Number.isFinite(startMs) && nowMs < startMs) {
      // Pre-maintenance notice window before scheduled start
      mode = "normal";
      preBannerActive = true;
    } else if (Number.isFinite(endMs) && nowMs > endMs) {
      mode = "normal";
      preBannerActive = false;
    }
  }

  // Also check per-website status if websiteId is specified
  let websiteStatus = "active";
  try {
    if (env.DB && websiteId) {
      const wRow = await env.DB.prepare("SELECT status, maintenance_mode, maintenance_title, maintenance_message, maintenance_eta FROM websites WHERE id=? OR code=? LIMIT 1").bind(websiteId, websiteId).first();
      if (wRow) {
        websiteStatus = wRow.status || "active";
        if (wRow.status === "maintenance" || wRow.status === "paused" || (wRow.maintenance_mode && wRow.maintenance_mode !== "normal")) {
          if (mode === "normal") {
            mode = wRow.maintenance_mode && wRow.maintenance_mode !== "normal" ? wRow.maintenance_mode : "manual_maintenance";
          }
          if (wRow.maintenance_title) rawCfg.title_vi = wRow.maintenance_title;
          if (wRow.maintenance_message) rawCfg.message_vi = wRow.maintenance_message;
          if (wRow.maintenance_eta) rawCfg.eta = wRow.maintenance_eta;
        }
      }
    }
  } catch {}

  const isBlockingMaintenance = ["manual_maintenance", "scheduled_maintenance", "emergency_maintenance"].includes(mode);
  return {
    mode,
    is_maintenance: isBlockingMaintenance,
    is_read_only: mode === "read_only",
    is_publishing_paused: mode === "publishing_paused",
    website_status: websiteStatus,
    title: rawCfg.title_vi || titleVi,
    title_vi: rawCfg.title_vi || titleVi,
    title_en: rawCfg.title_en || "Sky First Digital Information System Under Maintenance",
    message: rawCfg.message_vi || textVi,
    message_vi: rawCfg.message_vi || textVi,
    message_en: rawCfg.message_en || "The system is undergoing technical maintenance to ensure security and service quality. Please check back shortly.",
    reason: rawCfg.reason || "",
    scheduled_start: rawCfg.scheduled_start || "",
    scheduled_end: rawCfg.scheduled_end || "",
    eta: rawCfg.eta || rawCfg.scheduled_end || "",
    show_pre_banner: preBannerActive,
    pre_banner_vi: rawCfg.pre_banner_vi || (rawCfg.scheduled_start ? `Hệ thống dự kiến bảo trì định kỳ từ ${rawCfg.scheduled_start}.` : ""),
    pre_banner_en: rawCfg.pre_banner_en || (rawCfg.scheduled_start ? `Scheduled system maintenance starts at ${rawCfg.scheduled_start}.` : ""),
    contact_email: contactEmail,
    hotline,
    allow_lookup: rawCfg.allow_lookup !== false,
    allow_admin_bypass: rawCfg.allow_admin_bypass !== false,
    bypass_roles: Array.isArray(rawCfg.bypass_roles) && rawCfg.bypass_roles.length ? rawCfg.bypass_roles : ["owner", "super_admin", "system_admin"],
    retry_after: mode === "emergency_maintenance" ? 300 : 600
  };
}

function mapPathToModuleKey(pathname) {
  if (pathname === "/tai-tro" || pathname.startsWith("/tai-tro/") || pathname.startsWith("/api/public/sponsorship")) return "sponsorship";
  if (pathname === "/an-toan" || pathname.startsWith("/api/public/safety-reports")) return "safety";
  if (pathname === "/tai-lieu" || pathname.startsWith("/tai-lieu/") || pathname === "/api/public/resources") return "documents";
  if (pathname === "/bieu-mau" || pathname.startsWith("/api/forms/")) return "forms";
  if (pathname === "/gcn" || pathname.startsWith("/gcn/") || pathname.startsWith("/api/public/credentials/") || pathname === "/api/lookup/certificate") return "certificates";
  if (pathname === "/chuong-trinh" || pathname.startsWith("/chuong-trinh/") || pathname === "/api/public/classes") return "classes";
  if (pathname === "/su-kien" || pathname.startsWith("/su-kien/") || pathname === "/api/public/events") return "events";
  if (pathname.startsWith("/trang/") || pathname.startsWith("/api/public/pages")) return "page_builder";
  return null;
}

async function isModuleEnabled(env, modKey) {
  if (!modKey || !env.DB) return true;
  const aliases = {
    sponsorship: ["sponsorship", "sponsorship_transparency"],
    safety: ["safety", "digital_safety"],
    documents: ["documents", "pdf_library"],
    page_builder: ["page_builder", "cms"]
  }[modKey] || [modKey];
  try {
    const placeholders = aliases.map(() => "?").join(",");
    const rs = await env.DB.prepare(`SELECT enabled FROM modules WHERE key IN (${placeholders})`).bind(...aliases).all();
    const rows = rs.results || [];
    if (!rows.length) return true;
    return rows.every(r => Number(r.enabled) !== 0);
  } catch {
    return true;
  }
}

function secure(resp){
  const h=new Headers(resp.headers);
  h.set("x-content-type-options","nosniff");
  h.set("x-frame-options","SAMEORIGIN");
  h.set("referrer-policy","strict-origin-when-cross-origin");
  h.set("permissions-policy","camera=(self), microphone=(), geolocation=(), payment=(), usb=()");
  h.set("strict-transport-security","max-age=31536000; includeSubDomains");
  h.set("content-security-policy",[
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com https://static.cloudflareinsights.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://quickchart.io https://img.vietqr.io",
    "font-src 'self' data:",
    "connect-src 'self' https://challenges.cloudflare.com https://cloudflareinsights.com https://static.cloudflareinsights.com",
    "frame-src 'self' https://challenges.cloudflare.com",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'self'"
  ].join("; "));
  return new Response(resp.body,{status:resp.status,statusText:resp.statusText,headers:h});
}

async function serveSeoRoutes(request, env, url) {
  if (request.method !== "GET") return null;
  const baseUrl = (env.APP_URL || "https://app.skyfirst.io.vn").replace(/\/+$/, "");

  if (url.pathname === "/robots.txt") {
    const body = [
      "User-agent: *",
      "Allow: /",
      "Disallow: /admin",
      "Disallow: /admin/",
      "Disallow: /api/",
      `Sitemap: ${baseUrl}/sitemap.xml`
    ].join("\n");
    return new Response(body, {
      status: 200,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "public, max-age=3600"
      }
    });
  }

  if (url.pathname === "/sitemap.xml") {
    const publicPaths = [
      "/",
      "/gioi-thieu",
      "/chuong-trinh",
      "/su-kien",
      "/tai-lieu",
      "/bieu-mau",
      "/tra-cuu",
      "/gcn",
      "/ho-so",
      "/tai-tro",
      "/an-toan",
      "/ho-tro"
    ];
    let cmsSlugs = [];
    try {
      if (env.DB) {
        const rs = await env.DB.prepare(
          "SELECT slug, page_type, updated_at FROM cms_pages WHERE status='published' AND website_id='app' ORDER BY updated_at DESC LIMIT 200"
        ).all();
        cmsSlugs = (rs.results || []).filter(pg => pg.page_type !== "system");
      }
    } catch {}
    const nowIso = new Date().toISOString().slice(0, 10);
    const urlsXml = [
      ...publicPaths.map(
        (p) =>
          `  <url><loc>${baseUrl}${p}</loc><lastmod>${nowIso}</lastmod><changefreq>${p === "/" ? "daily" : "weekly"}</changefreq><priority>${p === "/" ? "1.0" : "0.8"}</priority></url>`
      ),
      ...cmsSlugs.map(
        (pg) =>
          `  <url><loc>${baseUrl}/trang/${encodeURIComponent(pg.slug)}</loc><lastmod>${String(pg.updated_at || nowIso).slice(0, 10)}</lastmod><changefreq>weekly</changefreq><priority>0.7</priority></url>`
      )
    ].join("\n");
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urlsXml}\n</urlset>`;
    return new Response(xml, {
      status: 200,
      headers: {
        "content-type": "application/xml; charset=utf-8",
        "cache-control": "public, max-age=3600"
      }
    });
  }

  return null;
}

async function servePublicMedia(request,env,url){
  if(request.method!=="GET" || !url.pathname.startsWith("/media/")) return null;
  if(!env.FILES) return json({error:"STORAGE_UNAVAILABLE",message:"Dịch vụ lưu trữ tệp hiện tạm thời chưa khả dụng."},503);
  const key=decodeURIComponent(url.pathname.slice("/media/".length));
  if(!key || key.includes("..") || key.startsWith("/") || key.includes("\\")) return json({error:"INVALID_PATH",message:"Đường dẫn tài nguyên không hợp lệ."},400);
  const obj=await env.FILES.get(`public-media/${key}`);
  if(!obj) return json({error:"MEDIA_NOT_FOUND",message:"Không tìm thấy hình ảnh yêu cầu."},404);
  const h=new Headers();
  const ct=obj.httpMetadata?.contentType||"application/octet-stream";
  h.set("content-type",ct);
  h.set("cache-control","public, max-age=86400");
  h.set("x-content-type-options","nosniff");
  return new Response(obj.body,{headers:h});
}

async function serveEmailFile(request,env,url){
  const m=url.pathname.match(/^\/api\/email-files\/([^/]+)$/);
  if(!m||request.method!=="GET") return null;
  if(!env.FILES) return json({error:"STORAGE_UNAVAILABLE",message:"Dịch vụ lưu trữ tệp hiện tạm thời chưa khả dụng."},503);
  const id=decodeURIComponent(m[1]);
  const token=String(url.searchParams.get("token")||"");
  if(!token) return json({error:"FORBIDDEN",message:"Bạn không có quyền truy cập tệp này."},403);
  const meta=await env.DB.prepare("SELECT * FROM files WHERE id=? AND email_token=? AND deleted_at IS NULL").bind(id,token).first();
  if(!meta) return json({error:"FILE_NOT_FOUND",message:"Không tìm thấy tệp hoặc liên kết đã hết hạn."},404);
  const obj=await env.FILES.get(meta.r2_key);
  if(!obj) return json({error:"OBJECT_NOT_FOUND",message:"Không tìm thấy nội dung tệp."},404);
  const headers=new Headers();
  headers.set("content-type",meta.mime||obj.httpMetadata?.contentType||"image/jpeg");
  headers.set("cache-control","private, max-age=604800");
  headers.set("x-content-type-options","nosniff");
  return new Response(obj.body,{headers});
}

async function serveFile(request,env,url){
  const m=url.pathname.match(/^\/api\/files\/([^/]+)$/);
  if(!m||request.method!=="GET") return null;
  const id=decodeURIComponent(m[1]),meta=await env.DB.prepare("SELECT * FROM files WHERE id=? AND deleted_at IS NULL").bind(id).first();
  if(!meta) return json({error:"FILE_NOT_FOUND",message:"Không tìm thấy tài liệu hoặc tệp yêu cầu."},404);
  const user=await getAuthUser(request,env);
  const validUser=user && Number(user.must_change_password||0)===0;
  const own=validUser && meta.owner_user_id && Number(meta.owner_user_id)===Number(user.id);
  const admin=validUser && (hasPermission(user,"file.manage") || hasPermission(user,"document.view") || hasPermission(user,"document.manage"));
  const download=url.searchParams.get("download")==="1";
  let isPublicDoc=false;
  let allowDownload=true;
  try{
    const docsRs=await env.DB.prepare("SELECT id,visibility,status,metadata_json FROM documents WHERE file_id=? ORDER BY rowid DESC").bind(id).all();
    let docsList=docsRs.results||[];
    if(!docsList.length){
      const dvRs=await env.DB.prepare("SELECT d.id,d.visibility,d.status,d.metadata_json FROM document_versions v JOIN documents d ON d.id=v.document_id WHERE v.file_id=? AND v.is_current=1").bind(id).all();
      docsList=dvRs.results||[];
    }
    for(const doc of docsList){
      if(doc && doc.visibility==="public" && doc.status==="Có hiệu lực"){
        isPublicDoc=true;
        try{
          const dMeta=JSON.parse(doc.metadata_json||"{}");
          if(dMeta.allow_download===false) allowDownload=false;
        }catch{}
      }
    }
    if(!isPublicDoc && meta.visibility!=="public" && !own && !admin){
      const spRep=await env.DB.prepare("SELECT r.id FROM sponsorship_reports r JOIN sponsorship_campaigns c ON c.id=r.campaign_id WHERE r.file_id=? AND r.status='published' AND c.visibility='public' LIMIT 1").bind(id).first();
      if(spRep) isPublicDoc=true;
      if(!isPublicDoc){
        const spTx=await env.DB.prepare("SELECT t.id FROM sponsorship_transactions t JOIN sponsorship_campaigns c ON c.id=t.campaign_id WHERE t.voucher_file_id=? AND t.verification_status='verified' AND t.is_public=1 AND c.visibility='public' LIMIT 1").bind(id).first();
        if(spTx) isPublicDoc=true;
      }
    }
  }catch{}
  if(meta.visibility!=="public"&&!isPublicDoc&&!own&&!admin) return json({error:"FORBIDDEN",message:"Bạn không có quyền truy cập tài liệu này."},403);
  if(download && !allowDownload && !own && !admin){
    return json({error:"DOWNLOAD_DISABLED",message:"Tài liệu này chỉ được phép xem trực tuyến (Preview), không cho phép tải xuống."},403);
  }
  const obj=await env.FILES.get(meta.r2_key);
  if(!obj) return json({error:"OBJECT_NOT_FOUND",message:"Không tìm thấy nội dung tệp lưu trữ."},404);
  const headers=new Headers();
  headers.set("content-type",meta.mime||obj.httpMetadata?.contentType||"application/octet-stream");
  headers.set("content-disposition",`${download?"attachment":"inline"}; filename*=UTF-8''${encodeURIComponent(meta.filename)}`);
  headers.set("cache-control",(meta.visibility==="public"||isPublicDoc)?"public, max-age=3600":"private, no-store");
  headers.set("x-content-type-options","nosniff");
  return new Response(obj.body,{headers});
}

async function cleanup(env){
  try{
    const expired=await env.DB.prepare("SELECT r2_key FROM upload_sessions WHERE expires_at<=CURRENT_TIMESTAMP AND state IN ('created','uploaded','rejected') LIMIT 500").all();
    if(env.FILES) for(const row of expired.results||[]){if(row.r2_key) await env.FILES.delete(row.r2_key)}
  }catch(err){console.error("UPLOAD_RETENTION_CLEANUP",err)}
  const cleanupStatements=[
    "DELETE FROM sessions WHERE expires_at<=CURRENT_TIMESTAMP",
    "DELETE FROM auth_tokens WHERE expires_at<=CURRENT_TIMESTAMP OR used_at IS NOT NULL",
    "DELETE FROM rate_limits WHERE window_start < strftime('%s','now')-86400",
    "DELETE FROM form_drafts WHERE expires_at<=CURRENT_TIMESTAMP",
    "DELETE FROM upload_sessions WHERE expires_at<=CURRENT_TIMESTAMP",
    "DELETE FROM portal_events WHERE created_at < datetime('now','-180 days')"
  ];
  for(const sql of cleanupStatements){try{await env.DB.prepare(sql).run()}catch(err){console.warn("CLEANUP_SKIP",sql.split(" ")[2],String(err?.message||err))}}
  const retention=Number(await getSetting(env,"rejected_application_retention_days",365));
  if(Number.isFinite(retention)&&retention>0){
    await env.DB.prepare("UPDATE submissions SET status='Đã lưu trữ',updated_at=CURRENT_TIMESTAMP WHERE status='Không phù hợp' AND created_at < datetime('now', ?) ")
      .bind(`-${retention} days`).run();
  }
  try{await runScheduledCmsPublishing(env);}catch{}
}

async function scheduledBackup(env){
  await buildBackupSnapshot(env,"cron",null);
}

const PORTAL_PATH_PREFIXES = [
  "/tra-cuu","/gcn","/ho-so","/bieu-mau","/chuong-trinh","/su-kien",
  "/tai-lieu","/tai-tro","/an-toan","/gioi-thieu","/ho-tro","/tim-kiem","/trang","/admin","/admin/login"
];

function isSpaRoute(pathname){
  if(PORTAL_PATH_PREFIXES.includes(pathname)) return true;
  return ["/admin/","/gcn/","/chuong-trinh/","/su-kien/","/tai-lieu/","/tai-tro/","/trang/"].some(prefix=>pathname.startsWith(prefix));
}

function isPublicPortalPageRoute(pathname) {
  if (pathname === "/" || pathname === "/index.html") return true;
  if (pathname === "/admin" || pathname === "/admin/login" || pathname.startsWith("/admin/")) return false;
  return isSpaRoute(pathname);
}

function isReadOnlyBlockedMutation(pathname, method) {
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return false;
  if (pathname.startsWith("/api/lookup/") || pathname.startsWith("/api/public/credentials/")) return false;
  if (pathname.startsWith("/api/auth/") || pathname.startsWith("/api/admin/")) return false;
  if (pathname.startsWith("/api/webhooks/") || pathname.startsWith("/api/integrations/")) return false;
  return (
    pathname.startsWith("/api/forms/") ||
    pathname.startsWith("/api/uploads") ||
    pathname.startsWith("/api/public/sponsorship/") ||
    pathname === "/api/public/safety-reports"
  );
}

async function handle(request,env,ctx){
  const url=new URL(request.url);
  const langParam = (url.searchParams.get("lang") || "").toLowerCase() === "en" ? "en" : "vi";

  if(isStateChanging(request) && url.pathname.startsWith("/api/") && url.pathname!=="/api/integrations/xanh/submissions" && url.pathname!=="/api/webhooks/sponsorship/payment"){
    const appUrl=env.APP_URL||url.origin;
    if(!sameOrigin(request,appUrl)) return json({error:"BAD_ORIGIN",message:"Yêu cầu không hợp lệ từ nguồn bên ngoài."},403);
  }

  if(url.pathname==="/api/health"){
    let d1Operational = false;
    let r2Operational = false;
    try {
      if (env.DB) {
        const probe = await env.DB.prepare("SELECT 1 AS ok").first();
        d1Operational = Number(probe?.ok) === 1;
      }
    } catch {}
    try {
      if (env.FILES) {
        await env.FILES.list({ limit: 1 });
        r2Operational = true;
      }
    } catch {}
    const opState = await resolveOperationalState(env, "app");
    return json({
      ok: d1Operational,
      app:"Hệ thống Thông tin Số Sky First",
      app_en:"Sky First Digital Information System",
      domain:"app.skyfirst.io.vn",
      production:true,
      operational_mode: opState.mode,
      maintenance_mode: opState.is_maintenance,
      time:new Date().toISOString(),
      database:!!env.DB,
      database_operational: d1Operational,
      storage:!!env.FILES,
      storage_operational: r2Operational
    });
  }

  // Fast-path for immutable/versioned static assets (.css, .js, .png, .ico, .webmanifest, .svg, .woff2)
  // Avoids running 8 D1 queries on every static asset request while preserving full security headers
  if (
    (request.method === "GET" || request.method === "HEAD") &&
    !url.pathname.startsWith("/api/") &&
    (url.pathname.startsWith("/assets/") || /\.(?:css|js|png|jpg|jpeg|webp|svg|ico|webmanifest|woff2?)$/i.test(url.pathname))
  ) {
    if (env.ASSETS) {
      const staticAsset = await env.ASSETS.fetch(request);
      if (staticAsset.status !== 404) return staticAsset;
    }
  }

  // Server-side Operational State (6 modes) & Per-Website Maintenance Guard
  const targetWebsite = url.searchParams.get("website_id") || "app";
  const opState = await resolveOperationalState(env, targetWebsite);
  let hasAdminBypass = false;
  if ((opState.is_maintenance || opState.is_read_only) && opState.allow_admin_bypass) {
    try {
      const u = await getAuthUser(request, env);
      if (u && (u.roles || []).some((r) => opState.bypass_roles.includes(r.role_id))) {
        hasAdminBypass = true;
      }
    } catch {}
  }

  const isCredLookupPath = url.pathname === "/api/lookup/certificate" || url.pathname.startsWith("/api/public/credentials/");
  if (opState.is_maintenance && !hasAdminBypass && !(isCredLookupPath && opState.allow_lookup !== false)) {
    const isPublicApi =
      url.pathname.startsWith("/api/public/") ||
      url.pathname.startsWith("/api/forms/") ||
      url.pathname.startsWith("/api/lookup/") ||
      url.pathname.startsWith("/api/uploads");
    if (isPublicApi) {
      return json(
        {
          error: (targetWebsite !== "app" && opState.website_status !== "active") ? "WEBSITE_MAINTENANCE" : "MAINTENANCE_MODE",
          mode: opState.mode,
          title: langParam === "en" ? opState.title_en : opState.title_vi,
          message: langParam === "en" ? opState.message_en : opState.message_vi,
          reason: opState.reason,
          eta: opState.eta,
          contact_email: opState.contact_email,
          hotline: opState.hotline
        },
        503,
        {
          "Retry-After": String(opState.retry_after || 600),
          "Cache-Control": "no-store",
          "X-Robots-Tag": "noindex"
        }
      );
    }
    if (request.method === "GET" && isPublicPortalPageRoute(url.pathname)) {
      return renderMaintenanceHtml(opState, langParam);
    }
  }

  if (opState.is_read_only && !hasAdminBypass && isReadOnlyBlockedMutation(url.pathname, request.method)) {
    return json(
      {
        error: "READ_ONLY_MODE",
        mode: "read_only",
        message:
          langParam === "en"
            ? "The system is currently in Read-Only mode for data verification. Lookups and browsing remain active, while new submissions and transactions are temporarily paused."
            : "Hệ thống đang ở chế độ Chỉ đọc (Read-only) để rà soát dữ liệu. Chức năng xem và tra cứu vẫn hoạt động bình thường; việc gửi biểu mẫu và tạo giao dịch mới tạm thời khóa."
      },
      503,
      {
        "Retry-After": "300",
        "Cache-Control": "no-store"
      }
    );
  }

  // Server-side Disabled Module Guard (Rule 9)
  const mappedModule = mapPathToModuleKey(url.pathname);
  if (mappedModule && !hasAdminBypass) {
    const modEnabled = await isModuleEnabled(env, mappedModule);
    if (!modEnabled) {
      if (url.pathname.startsWith("/api/")) {
        return json(
          {
            error: "MODULE_DISABLED",
            module: mappedModule,
            message:
              langParam === "en"
                ? `The "${mappedModule}" module is currently disabled by the system administrator.`
                : `Phân hệ "${mappedModule}" hiện đang được tạm tắt bởi Quản trị viên hệ thống.`
          },
          403,
          { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" }
        );
      }
      if (request.method === "GET") {
        return renderMaintenanceHtml(
          {
            mode: "module_disabled",
            title_vi: "Phân hệ đang tạm ngừng phục vụ",
            title_en: "Module Temporarily Unavailable",
            message_vi: "Chức năng này hiện đang được Quản trị viên tạm khóa để cập nhật cấu hình. Vui lòng quay lại trang chủ hoặc sử dụng các dịch vụ khác.",
            message_en: "This module is currently disabled by the administrator for configuration updates. Please return to the home page.",
            contact_email: opState.contact_email,
            hotline: opState.hotline,
            retry_after: 300
          },
          langParam
        );
      }
    }
  }

  const seoResp=await serveSeoRoutes(request,env,url); if(seoResp) return seoResp;
  const mediaResp=await servePublicMedia(request,env,url); if(mediaResp) return mediaResp;
  const emailFileResp=await serveEmailFile(request,env,url); if(emailFileResp) return emailFileResp;
  const fileResp=await serveFile(request,env,url); if(fileResp) return fileResp;
  const auth=await authRoute(request,env,url); if(auth) return auth;
  const edgeCacheable=request.method==="GET"&&!opState.is_maintenance&&new Set(["/api/config","/api/public/news","/api/public/classes","/api/public/events","/api/public/units","/api/public/resources","/api/public/sponsorship","/api/public/pages"]).has(url.pathname);
  const edgeKey=edgeCacheable?new Request(url.origin+url.pathname+url.search,{method:"GET"}):null;
  if(edgeCacheable&&typeof caches!=="undefined"){const hit=await caches.default.match(edgeKey);if(hit)return hit}
  const pub=await publicRoute(request,env,url,ctx);
  if(pub){
    if(edgeCacheable&&pub.ok&&typeof caches!=="undefined"){const store=caches.default.put(edgeKey,pub.clone());if(ctx?.waitUntil)ctx.waitUntil(store);else await store}
    return pub;
  }
  const me=await meRoute(request,env,url); if(me) return me;
  const adm=await adminRoute(request,env,url,ctx); if(adm) return adm;

  const asset=await env.ASSETS.fetch(request);
  if(asset.status!==404) {
    if (hasAdminBypass && opState.is_maintenance) {
      const h = new Headers(asset.headers);
      h.set("X-SFN-Maintenance-Bypass", "1");
      return new Response(asset.body, { status: asset.status, headers: h });
    }
    return asset;
  }
  if(request.method==="GET" && isSpaRoute(url.pathname)){
    const indexUrl=new URL("/index.html",url.origin);
    const shell=await env.ASSETS.fetch(new Request(indexUrl,{headers:request.headers}));
    if(shell.status!==404) {
      if (hasAdminBypass && opState.is_maintenance) {
        const h = new Headers(shell.headers);
        h.set("X-SFN-Maintenance-Bypass", "1");
        return new Response(shell.body, { status: shell.status, headers: h });
      }
      return shell;
    }
  }
  if(request.method==="GET" && !url.pathname.startsWith("/api/")) return notFoundPage(env, langParam);
  return json({error:"NOT_FOUND",message:"Không tìm thấy tài nguyên yêu cầu."},404);
}

export default {
  async fetch(request,env,ctx){
    try{return secure(await handle(request,env,ctx));}
    catch(err){
      const requestId=crypto.randomUUID();
      const url=new URL(request.url),accept=request.headers.get("accept")||"";
      const rawErrMsg=String(err?.message||err||"UNKNOWN_ERROR").slice(0,300);
      console.error("REQUEST_ERROR",{request_id:requestId,method:request.method,path:url.pathname,message:rawErrMsg,stack:String(err?.stack||"").slice(0,4000)});
      if(env?.DB){
        try{
          await env.DB.prepare("INSERT INTO audit_log(action,entity_type,entity_id,details_json) VALUES('LỖI HỆ THỐNG 500','request_error',?,?)")
            .bind(requestId,JSON.stringify({method:request.method,path:url.pathname,error:rawErrMsg})).run();
        }catch{}
      }
      if(request.method==="GET"&&!url.pathname.startsWith("/api/")&&accept.includes("text/html")){
        try{
          const page=await env.ASSETS.fetch(new Request(new URL("/error.html",url.origin),{headers:request.headers}));
          if(page.ok)return secure(new Response(page.body,{status:500,headers:{"content-type":"text/html; charset=utf-8","cache-control":"no-store"}}));
        }catch{}
      }
      const isAdminPath=url.pathname.startsWith("/api/admin/");
      const safeDiagnostic=isAdminPath?rawErrMsg.replace(/Bearer\s+[^\s]+/gi,"[REDACTED]"):undefined;
      return secure(json({
        error:"INTERNAL_ERROR",
        message:"Hệ thống đang gặp sự cố khi xử lý yêu cầu. Vui lòng thử lại sau hoặc liên hệ bộ phận hỗ trợ.",
        request_id:requestId,
        ...(safeDiagnostic?{diagnostic_hint:safeDiagnostic,failed_path:url.pathname}:{})
      },500,{"Cache-Control":"no-store","X-SFN-Request-ID":requestId}));
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

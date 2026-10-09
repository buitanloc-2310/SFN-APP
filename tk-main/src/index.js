import { generateQrPng } from './local-qr.js';
const enc=new TextEncoder();
const clean=(v,m=1000)=>String(v??'').trim().slice(0,m);
const LOCKED_CARD_BACK_IDS=new Set(['backtitle','validheading','valid','usageheading','use1','use2','use3','noteheading','note','footer']);
function lockedCardBackElements(orientation='landscape'){
  const portrait=orientation==='portrait';
  const positions=portrait?{
    backtitle:[6,3,88,8],validheading:[6,12,88,4],valid:[6,17,88,7],usageheading:[6,25,88,4],
    use1:[6,30,88,10],use2:[6,41,88,10],use3:[6,52,88,10],noteheading:[6,63,88,4],note:[6,68,88,20],footer:[6,90,88,9]
  }:{
    backtitle:[6,4,88,9],validheading:[6,14,88,5],valid:[6,19,88,9],usageheading:[6,28,88,5],
    use1:[6,33,88,10],use2:[6,43,88,10],use3:[6,53,88,10],noteheading:[6,64,88,5],note:[6,69,88,20],footer:[6,90,88,9]
  };
  const rows=[
    ['backtitle','HIỆU LỰC & HƯỚNG DẪN SỬ DỤNG',10,true,'#0b2b49'],
    ['validheading','THỜI HẠN SỬ DỤNG',8,true,'#173e5d'],
    ['valid','Có giá trị trong thời hạn ghi trên thẻ và theo trạng thái xác minh của hệ thống.',8,false,'#173e5d'],
    ['usageheading','HƯỚNG DẪN SỬ DỤNG',8,true,'#173e5d'],
    ['use1','• Xuất trình thẻ khi cần xác nhận tư cách thành viên hoặc người tham gia chương trình.',8,false,'#314e68'],
    ['use2','• Sử dụng mã QR ở mặt trước để kiểm tra thông tin và trạng thái thẻ.',8,false,'#314e68'],
    ['use3','• Không cho mượn, chuyển nhượng hoặc sử dụng thẻ thay cho người khác.',8,false,'#314e68'],
    ['noteheading','LƯU Ý',8,true,'#173e5d'],
    ['note','Thẻ chỉ có giá trị xác minh thông qua mã QR ở mặt trước. Thẻ không còn giá trị sử dụng khi hệ thống xác minh thông báo thẻ đã bị hủy.',8,false,'#314e68'],
    ['footer','Sky First Network · Mạng lưới Giáo dục & Phát triển Cộng đồng Sky First',6,true,'#315f80']
  ];
  return rows.map(([id,text,size,bold,color])=>({id,kind:'text',text,x:positions[id][0],y:positions[id][1],w:positions[id][2],h:positions[id][3],color,size,bold,align:'left',radius:0,opacity:1}));
}
const dateInVietnam=()=>{const p=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const v=Object.fromEntries(p.map(x=>[x.type,x.value]));return `${v.year}-${v.month}-${v.day}`};
const uid=(p='id')=>`${p}_${crypto.randomUUID()}`;
const json=(d,s=200,h={})=>new Response(JSON.stringify(d),{status:s,headers:{'content-type':'application/json; charset=utf-8',...h}});
const bodyJson=async r=>{try{return await r.json()}catch{return {}}};
const hex=b=>[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('');
const sha256=async s=>hex(await crypto.subtle.digest('SHA-256',enc.encode(s)));
const b64=b=>btoa(String.fromCharCode(...new Uint8Array(b)));

function token(){
  const a=new Uint8Array(32);
  crypto.getRandomValues(a);
  return b64(a).replace(/[+/=]/g,'');
}

async function pbkdf2(password,salt,iterations=100000){
  const key=await crypto.subtle.importKey(
    'raw',
    enc.encode(String(password)),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const bits=await crypto.subtle.deriveBits(
    {
      name:'PBKDF2',
      hash:'SHA-256',
      salt:enc.encode(String(salt)),
      iterations:Number(iterations||100000)
    },
    key,
    256
  );

  return b64(bits);
}

async function verifyPassword(password,salt,iterations,storedHash){
  const raw=String(password??'');

  const candidates=[
    raw,
    raw.normalize('NFC'),
    raw.normalize('NFKC')
  ];

  if(raw!==raw.trim()){
    candidates.push(raw.trim());
  }

  for(const value of [...new Set(candidates)]){
    const calculated=await pbkdf2(
      value,
      String(salt??''),
      Number(iterations||100000)
    );

    if(calculated===String(storedHash??'')){
      return true;
    }
  }

  return false;
}

const cookie=(n,v,d=7)=>
  `${n}=${v}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${d*86400}`;

const clearCookie=n=>
  `${n}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;

const clientHint=req=>clean(req.headers.get('cf-connecting-ip')||req.headers.get('x-forwarded-for')||'unknown',80);
const safeEq=(a,b)=>{a=String(a||'');b=String(b||'');if(a.length!==b.length)return false;let d=0;for(let i=0;i<a.length;i++)d|=a.charCodeAt(i)^b.charCodeAt(i);return d===0};
function sameOrigin(req){
  if(['GET','HEAD','OPTIONS'].includes(req.method))return true;
  const expected=new URL(req.url).origin;
  const origin=req.headers.get('origin');
  if(origin){try{return new URL(origin).origin===expected}catch{return false}}
  const referer=req.headers.get('referer');
  if(referer){try{return new URL(referer).origin===expected}catch{return false}}
  return false;
}
async function ensureSecurityTables(env){
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS auth_rate_limits(rate_key TEXT PRIMARY KEY,window_start TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,attempts INTEGER NOT NULL DEFAULT 0,blocked_until TEXT,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`).run();
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS password_reset_tokens(id TEXT PRIMARY KEY,account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,token_hash TEXT NOT NULL UNIQUE,expires_at TEXT NOT NULL,used_at TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`).run();
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS security_events(id TEXT PRIMARY KEY,account_id TEXT REFERENCES accounts(id) ON DELETE CASCADE,event_type TEXT NOT NULL,ip_hint TEXT,user_agent TEXT,details_json TEXT NOT NULL DEFAULT '{}',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`).run();
}
async function rateState(env,key,limit=8,minutes=15){
  await ensureSecurityTables(env);
  const r=await env.DB.prepare(`SELECT attempts,window_start,blocked_until,CASE WHEN blocked_until>CURRENT_TIMESTAMP THEN 1 ELSE 0 END blocked,CASE WHEN window_start<=datetime('now',?) THEN 1 ELSE 0 END expired FROM auth_rate_limits WHERE rate_key=?`).bind(`-${minutes} minutes`,key).first();
  if(r?.blocked)return {blocked:true};
  if(!r||r.expired){await env.DB.prepare(`INSERT INTO auth_rate_limits(rate_key,window_start,attempts,blocked_until,updated_at) VALUES(?,CURRENT_TIMESTAMP,0,NULL,CURRENT_TIMESTAMP) ON CONFLICT(rate_key) DO UPDATE SET window_start=CURRENT_TIMESTAMP,attempts=0,blocked_until=NULL,updated_at=CURRENT_TIMESTAMP`).bind(key).run();return {blocked:false,attempts:0}}
  return {blocked:false,attempts:Number(r.attempts||0),limit};
}
async function rateFail(env,key,limit=8,blockMinutes=15){
  await env.DB.prepare(`UPDATE auth_rate_limits SET attempts=attempts+1,blocked_until=CASE WHEN attempts+1>=? THEN datetime('now',?) ELSE blocked_until END,updated_at=CURRENT_TIMESTAMP WHERE rate_key=?`).bind(limit,`+${blockMinutes} minutes`,key).run();
}
async function rateClear(env,key){await env.DB.prepare(`DELETE FROM auth_rate_limits WHERE rate_key=?`).bind(key).run()}
async function securityEvent(env,aid,type,req,details={}){await ensureSecurityTables(env);await env.DB.prepare(`INSERT INTO security_events(id,account_id,event_type,ip_hint,user_agent,details_json) VALUES(?,?,?,?,?,?)`).bind(uid('sec'),aid||null,type,clientHint(req),clean(req.headers.get('user-agent'),500),JSON.stringify(details)).run()}
async function safeRateState(env,key,limit=8,minutes=15){try{return await rateState(env,key,limit,minutes)}catch(err){console.error('RATE_LIMIT_STORAGE_ERROR',err);return {blocked:true,degraded:true}}}
async function safeRateFail(env,key,limit=8,blockMinutes=15){try{await rateFail(env,key,limit,blockMinutes)}catch(err){console.error('RATE_LIMIT_WRITE_ERROR',err)}}
async function safeRateClear(env,key){try{await rateClear(env,key)}catch(err){console.error('RATE_LIMIT_CLEAR_ERROR',err)}}
async function safeSecurityEvent(env,aid,type,req,details={}){try{await securityEvent(env,aid,type,req,details)}catch(err){console.error('SECURITY_EVENT_ERROR',err)}}
async function safeAudit(env,...args){try{await audit(env,...args)}catch(err){console.error('AUDIT_EVENT_ERROR',err)}}
async function createLoginSession(env,sid,aid,h,req){
  const ua=clean(req.headers.get('user-agent'),500),ip=clientHint(req);
  try{
    await env.DB.prepare(`INSERT INTO sessions(id,account_id,token_hash,expires_at,user_agent,ip_hint) VALUES(?,?,?,datetime('now','+7 days'),?,?)`).bind(sid,aid,h,ua,ip).run();
  }catch(err){
    // Compatibility with an older production sessions schema. The security migration can be applied later without blocking login.
    console.error('SESSION_METADATA_COMPAT_FALLBACK',err);
    await env.DB.prepare(`INSERT INTO sessions(id,account_id,token_hash,expires_at) VALUES(?,?,?,datetime('now','+7 days'))`).bind(sid,aid,h).run();
  }
}


async function ensureAccountRequestProfiles(env){
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS account_request_profiles(
      request_id TEXT PRIMARY KEY REFERENCES account_requests(id) ON DELETE CASCADE,
      education_or_work_type TEXT NOT NULL,
      school_or_workplace TEXT NOT NULL,
      class_or_major TEXT,
      education_status TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
}


async function ensureAccountRequestExtended(env){
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS account_request_extended(
    request_id TEXT PRIMARY KEY REFERENCES account_requests(id) ON DELETE CASCADE,
    school_name TEXT NOT NULL,class_or_major TEXT NOT NULL,employment_status TEXT NOT NULL,
    workplace_name TEXT NOT NULL,work_department TEXT NOT NULL,job_title TEXT NOT NULL,
    guardian_date_of_birth TEXT,guardian_id_number TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).run();
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS account_request_orgs(
    request_id TEXT NOT NULL REFERENCES account_requests(id) ON DELETE CASCADE,
    org_node_id TEXT NOT NULL REFERENCES org_nodes(id) ON DELETE CASCADE,
    is_primary INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(request_id,org_node_id)
  )`).run();
}

async function ensureEvaluations(env){
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS member_evaluations(
      id TEXT PRIMARY KEY,
      person_id TEXT NOT NULL REFERENCES people(id),
      org_node_id TEXT REFERENCES org_nodes(id),
      evaluator_account_id TEXT NOT NULL REFERENCES accounts(id),
      period_type TEXT NOT NULL,
      period_label TEXT NOT NULL,
      criteria_json TEXT,
      total_score REAL,
      rating TEXT,
      comments TEXT,
      visibility TEXT NOT NULL DEFAULT 'member' CHECK(visibility IN ('member','admin')),
      status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','final','hidden')),
      finalized_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
  await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_member_evaluations_person ON member_evaluations(person_id,created_at DESC)`).run();
  await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_member_evaluations_org ON member_evaluations(org_node_id,created_at DESC)`).run();
}

async function setupDone(env){
  const r=await env.DB.prepare('SELECT COUNT(*) c FROM accounts').first();
  return Number(r?.c||0)>0;
}

async function getSession(req,env){
  const raw=(req.headers.get('cookie')||'')
    .split(';')
    .map(x=>x.trim())
    .find(x=>x.startsWith('sfn_session='));

  if(!raw)return null;

  let t;try{t=decodeURIComponent(raw.slice('sfn_session='.length))}catch{return null}
  const h=await sha256(t);

  return env.DB.prepare(`
    SELECT
      s.id session_id,
      s.account_id,
      a.person_id,
      a.username,
      a.force_password_change,
      p.full_name,
      p.member_code,
      p.avatar_url,
      p.status
    FROM sessions s
    JOIN accounts a ON a.id=s.account_id
    LEFT JOIN people p ON p.id=a.person_id
    WHERE s.token_hash=?
      AND s.expires_at>CURRENT_TIMESTAMP
      AND a.is_locked=0
      AND NOT EXISTS (SELECT 1 FROM account_restrictions br WHERE br.account_id=a.id AND br.restriction_type='ban' AND (br.ends_at IS NULL OR date(br.ends_at)>=date('now','+7 hours')))
    LIMIT 1
  `).bind(h).first();
}

async function isSuper(env,aid){
  return !!(await env.DB.prepare(`
    SELECT 1
    FROM account_scopes s
    JOIN roles r ON r.id=s.role_id
    WHERE s.account_id=?
      AND s.active=1
      AND r.code='SUPER_ADMIN'
    LIMIT 1
  `).bind(aid).first());
}

async function isNetworkAdmin(env,aid){
  return !!(await env.DB.prepare(`
    SELECT 1
    FROM account_scopes s
    JOIN roles r ON r.id=s.role_id
    WHERE s.account_id=?
      AND s.active=1
      AND r.code IN ('SUPER_ADMIN','NETWORK_ADMIN')
    LIMIT 1
  `).bind(aid).first());
}

async function canAccessOrg(env,aid,orgId){
  if(!orgId)return false;
  if(await isNetworkAdmin(env,aid))return true;

  return !!(await env.DB.prepare(`
    WITH RECURSIVE allowed(id) AS (
      SELECT s.org_node_id
      FROM account_scopes s
      JOIN roles r ON r.id=s.role_id
      WHERE s.account_id=?
        AND s.active=1
        AND r.code IN ('SCOPE_ADMIN','UNIT_ADMIN','DEPARTMENT_ADMIN')
        AND s.org_node_id IS NOT NULL

      UNION

      SELECT o.id
      FROM org_nodes o
      JOIN allowed a ON o.parent_id=a.id
    )
    SELECT 1
    FROM allowed
    WHERE id=?
    LIMIT 1
  `).bind(aid,orgId).first());
}

async function canAccessPerson(env,aid,pid){
  if(await isNetworkAdmin(env,aid))return true;
  const self=await env.DB.prepare(`SELECT person_id FROM accounts WHERE id=?`).bind(aid).first();
  if(self?.person_id===pid)return true;
  const sameUnit=await env.DB.prepare(`
    SELECT 1 FROM org_memberships mine
    JOIN org_memberships theirs ON theirs.org_node_id=mine.org_node_id
    WHERE mine.person_id=? AND theirs.person_id=?
      AND mine.status='active' AND theirs.status='active' LIMIT 1
  `).bind(self?.person_id||'',pid).first();
  if(sameUnit)return true;

  return !!(await env.DB.prepare(`
    WITH RECURSIVE allowed(id) AS (
      SELECT s.org_node_id
      FROM account_scopes s
      JOIN roles r ON r.id=s.role_id
      WHERE s.account_id=?
        AND s.active=1
        AND r.code IN ('SCOPE_ADMIN','UNIT_ADMIN','DEPARTMENT_ADMIN')
        AND s.org_node_id IS NOT NULL

      UNION

      SELECT o.id
      FROM org_nodes o
      JOIN allowed a ON o.parent_id=a.id
    )
    SELECT 1
    FROM org_memberships m
    JOIN allowed a ON a.id=m.org_node_id
    WHERE m.person_id=?
    LIMIT 1
  `).bind(aid,pid).first());
}

async function visibleOrgs(env,aid){
  if(await isNetworkAdmin(env,aid)){
    const r=await env.DB.prepare(`
      SELECT id,code,name,short_name,node_type,parent_id,status
      FROM org_nodes
      WHERE deleted_at IS NULL
      ORDER BY sort_order,name
    `).all();

    return r.results||[];
  }

  const r=await env.DB.prepare(`
    WITH RECURSIVE allowed(id) AS (
      SELECT s.org_node_id
      FROM account_scopes s
      JOIN roles rr ON rr.id=s.role_id
      WHERE s.account_id=?
        AND s.active=1
        AND rr.code IN ('SCOPE_ADMIN','UNIT_ADMIN','DEPARTMENT_ADMIN')
        AND s.org_node_id IS NOT NULL

      UNION
      SELECT m.org_node_id FROM accounts aa JOIN org_memberships m ON m.person_id=aa.person_id WHERE aa.id=? AND m.status='active'

      UNION

      SELECT o.id
      FROM org_nodes o
      JOIN allowed a ON o.parent_id=a.id
    )
    SELECT
      o.id,
      o.code,
      o.name,
      o.short_name,
      o.node_type,
      o.parent_id,
      o.status
    FROM org_nodes o
    JOIN allowed a ON a.id=o.id
    ORDER BY o.sort_order,o.name
  `).bind(aid,aid).all();

  return r.results||[];
}

async function hasPerm(env,aid,code,scope=null){
  if(await isSuper(env,aid))return true;

  let q=`
    SELECT 1
    FROM account_scopes s
    JOIN role_permissions rp ON rp.role_id=s.role_id
    JOIN permissions p ON p.id=rp.permission_id
    WHERE s.account_id=?
      AND s.active=1
      AND p.code=?
  `;

  const b=[aid,code];

  if(scope){
    q+=` AND (s.org_node_id=? OR s.org_node_id IS NULL)`;
    b.push(scope);
  }

  q+=' LIMIT 1';

  return !!(await env.DB.prepare(q).bind(...b).first());
}

async function audit(env,aid,action,type,id,scope=null,details={}){
  await env.DB.prepare(`
    INSERT INTO audit_log(
      actor_account_id,
      action,
      entity_type,
      entity_id,
      org_node_id,
      details_json
    )
    VALUES(?,?,?,?,?,?)
  `).bind(
    aid||null,
    action,
    type,
    id||null,
    scope||null,
    JSON.stringify(details)
  ).run();
}

async function memberCode(env){
  const yy=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Ho_Chi_Minh',year:'2-digit'}).format(new Date());
  const alphabet='23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  for(let attempt=0;attempt<16;attempt++){
    const bytes=crypto.getRandomValues(new Uint8Array(8));
    const suffix=[...bytes].map(n=>alphabet[n%alphabet.length]).join('');
    const code=`SFN-${yy}-${suffix}`;
    if(!(await env.DB.prepare('SELECT 1 FROM people WHERE member_code=?').bind(code).first()))return code;
  }
  throw new Error('MEMBER_ID_GENERATION_FAILED');
}

function verifyCode(prefix='SFN'){
  return `${prefix}-${crypto.randomUUID()
    .replaceAll('-','')
    .slice(0,12)
    .toUpperCase()}`;
}
function withSecurityHeaders(response){
  const headers=new Headers(response.headers);
  headers.set('x-content-type-options','nosniff');
  headers.set('x-frame-options','DENY');
  headers.set('referrer-policy','strict-origin-when-cross-origin');
  headers.set('permissions-policy','camera=(), microphone=(), geolocation=()');
  headers.set('content-security-policy',"default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; connect-src 'self'; img-src 'self' blob: data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; font-src 'self' data:");
  return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
}
const DEFAULT_PORTAL_LINKS=[
  {name:'Trang Thông Tin Điện Tử Sky First',url:'https://www.skyfirst.io.vn/',description:'Thông tin chính thức của Sky First'},
  {name:'Cổng Thông Tin Số Sky First',url:'https://ctt.skyfirst.io.vn/',description:'Thông tin, chương trình và tiện ích số'},
  {name:'Trung Tâm Tình Nguyện Viên Sky First',url:'https://tnv.skyfirst.io.vn/',description:'Hoạt động tình nguyện và cộng đồng'},
  {name:'Trung Tâm Học Tập Số Sky First',url:'https://slc.skyfirst.io.vn/',description:'Học tập và lớp học trực tuyến'},
  {name:'Trung Tâm Thư Điện Tử Sky First',url:'https://mail.skyfirst.io.vn/',description:'Dịch vụ thư điện tử'}
];
const DEFAULT_PORTAL_BRAND={siteName:'Trung Tâm Thành Viên Số Sky First',logoUrl:'/sfn-logo.png',primaryColor:'#2563eb',accentColor:'#38bdf8',navColor:'#0b1220',fontFamily:'system',baseFontSize:16,cornerRadius:18,contentMaxWidth:1500};
function safeSkyFirstUrl(value){try{const u=new URL(String(value||''));return u.protocol==='https:'&&!u.username&&!u.password&&(u.hostname==='skyfirst.io.vn'||u.hostname.endsWith('.skyfirst.io.vn'))?u.toString():null}catch{return null}}
function portalLinksFromSettings(candidates){
  if(!Array.isArray(candidates)||candidates.length!==DEFAULT_PORTAL_LINKS.length)return DEFAULT_PORTAL_LINKS.map(x=>({...x}));
  const oldNames=new Set(['cổng chính sky first network','cổng thông tin','cổng sfn','cổng sfec','lớp học trực tuyến','cổng tình nguyện viên','cổng thư điện tử']);
  return DEFAULT_PORTAL_LINKS.map(fallback=>{
    const item=candidates.find(x=>{const u=safeSkyFirstUrl(x?.url);if(!u)return false;try{return new URL(u).hostname===new URL(fallback.url).hostname}catch{return false}});
    if(!item)return {...fallback};
    const rawName=clean(item.name,100),name=rawName&&!oldNames.has(rawName.toLocaleLowerCase('vi-VN'))?rawName:fallback.name;
    return {name,url:safeSkyFirstUrl(item.url)||fallback.url,description:clean(item.description,140)||fallback.description};
  });
}
function localImagePath(value,fallback='/sfn-logo.png'){const p=clean(value,1200);if(p==='/sfn-logo.png')return p;if(/^\/files\/[A-Za-z0-9._/-]+\.(?:png|jpe?g|webp)$/i.test(p)&&!p.includes('..')&&!p.includes('\\')&&!p.includes('//'))return p;return fallback}
function localBrandImagePath(value,fallback='/sfn-logo.png'){const p=clean(value,1200);if(p==='/sfn-logo.png')return p;return /^\/files\/site-assets\/[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}\.(?:png|jpg|webp)$/i.test(p)?p:fallback}

function validUploadedImage(bytes,contentType){
  if(contentType==='image/png'){
    if(bytes.length<33||![137,80,78,71,13,10,26,10].every((n,i)=>bytes[i]===n))return false;
    if(String.fromCharCode(...bytes.slice(12,16))!=='IHDR')return false;
    const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
    const width=view.getUint32(16),height=view.getUint32(20);
    return width>0&&height>0&&width<=8192&&height<=8192&&width*height<=32000000;
  }
  if(contentType==='image/jpeg')return bytes.length>=20&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255&&bytes[bytes.length-2]===255&&bytes[bytes.length-1]===217;
  if(contentType==='image/webp')return bytes.length>=30&&String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP'&&['VP8 ','VP8L','VP8X'].includes(String.fromCharCode(...bytes.slice(12,16)))&&new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength).getUint32(4,true)<=bytes.length-8;
  return false;
}



async function api(req,env,url){

  // =========================================================
  // SETUP
  // =========================================================


  if(url.pathname==='/api/public/portal-config'&&req.method==='GET'){
    const cfg=await env.DB.prepare("SELECT value_json,updated_at FROM system_settings WHERE key='member_portal_v4'").first();
    let settings={};try{settings=JSON.parse(cfg?.value_json||'{}')}catch{}
    const defaults=[
      {key:'members',label:'Thành viên đang hoạt động',mode:'auto',enabled:true},
      {key:'activities',label:'Hoạt động đã tổ chức',mode:'auto',enabled:true},
      {key:'units',label:'Đơn vị trực thuộc',mode:'auto',enabled:true},
      {key:'programs',label:'Chương trình và dự án',mode:'manual',value:null,enabled:false}
    ];
    const allowed=new Set(defaults.map(x=>x.key));
    const published=Array.isArray(settings.stats)?settings.stats:defaults;
    const stats=published.filter(x=>x&&allowed.has(x.key)&&x.enabled!==false).slice(0,8);
    const countQueries={members:"SELECT COUNT(*) n FROM people WHERE status='active'",activities:"SELECT COUNT(*) n FROM activities WHERE status='completed'",units:"SELECT COUNT(*) n FROM org_nodes WHERE status='active'"};
    const results=[];
    for(const row of stats){
      let value=null;
      if(row.mode==='manual')value=Number.isSafeInteger(row.value)&&row.value>=0?row.value:null;
      else if(countQueries[row.key]){try{value=Number((await env.DB.prepare(countQueries[row.key]).first())?.n||0)}catch{value=null}}
      if(value!==null)results.push({key:row.key,label:clean(row.label,75),value,mode:row.mode==='manual'?'manual':'auto'});
    }
    const savedBrand=settings.brand&&typeof settings.brand==='object'?settings.brand:{};
    const brand={
      ...DEFAULT_PORTAL_BRAND,
      siteName:clean(savedBrand.siteName||settings.siteName||DEFAULT_PORTAL_BRAND.siteName,100)||DEFAULT_PORTAL_BRAND.siteName,
      logoUrl:localBrandImagePath(savedBrand.logoUrl||settings.logoUrl||DEFAULT_PORTAL_BRAND.logoUrl),
      primaryColor:/^#[a-f0-9]{6}$/i.test(savedBrand.primaryColor||'')?savedBrand.primaryColor:DEFAULT_PORTAL_BRAND.primaryColor,
      accentColor:/^#[a-f0-9]{6}$/i.test(savedBrand.accentColor||'')?savedBrand.accentColor:DEFAULT_PORTAL_BRAND.accentColor,
      navColor:/^#[a-f0-9]{6}$/i.test(savedBrand.navColor||'')?savedBrand.navColor:DEFAULT_PORTAL_BRAND.navColor,
      fontFamily:['Arial','Verdana','Georgia','Tahoma','system'].includes(savedBrand.fontFamily)?savedBrand.fontFamily:DEFAULT_PORTAL_BRAND.fontFamily,
      baseFontSize:Number.isInteger(Number(savedBrand.baseFontSize))&&Number(savedBrand.baseFontSize)>=14&&Number(savedBrand.baseFontSize)<=20?Number(savedBrand.baseFontSize):16,
      cornerRadius:Number.isInteger(Number(savedBrand.cornerRadius))&&Number(savedBrand.cornerRadius)>=8&&Number(savedBrand.cornerRadius)<=24?Number(savedBrand.cornerRadius):18,
      contentMaxWidth:Number.isInteger(Number(savedBrand.contentMaxWidth))&&Number(savedBrand.contentMaxWidth)>=1080&&Number(savedBrand.contentMaxWidth)<=1680?Number(savedBrand.contentMaxWidth):1500
    };
    const links=portalLinksFromSettings(settings.links);
    return json({stats:results,tagline:clean(settings.tagline||'Mỗi thành viên là một hành trình. Mỗi đóng góp tạo nên một Sky First lớn mạnh hơn.',190),brand,links,updated_at:cfg?.updated_at||null});
  }

  if(url.pathname==='/api/setup/status'&&req.method==='GET'){
    return json({
      setup_required:!(await setupDone(env))
    });
  }

  if(url.pathname==='/api/setup'&&req.method==='POST'){
    if(await setupDone(env)) return json({error:'SETUP_ALREADY_COMPLETED'},409);
    const supplied=clean(req.headers.get('x-setup-token'),512);
    if(!env.SETUP_TOKEN||!safeEq(supplied,env.SETUP_TOKEN)) return json({error:'SETUP_FORBIDDEN'},403);
    const b=await bodyJson(req);

    const name=clean(b.full_name,160);
    const user=clean(b.username,80).toLowerCase();
    const email=clean(b.email,200).toLowerCase();
    const pw=String(b.password||'');

    if(!name||!user||pw.length<10){
      return json({error:'INVALID_SETUP_DATA'},400);
    }

    const pid=uid('person');
    const aid=uid('account');
    const salt=token();
    const it=100000;
    const hash=await pbkdf2(pw,salt,it);

    await env.DB.batch([
      env.DB.prepare(`
        INSERT INTO people(
          id,
          member_code,
          full_name,
          email,
          status
        )
        VALUES(?,?,?,?, 'active')
      `).bind(
        pid,
        'SYS-ADMIN-0001',
        name,
        email||null
      ),

      env.DB.prepare(`
        INSERT INTO accounts(
          id,
          person_id,
          username,
          email,
          password_hash,
          password_salt,
          password_iterations,
          force_password_change
        )
        VALUES(?,?,?,?,?,?,?,0)
      `).bind(
        aid,
        pid,
        user,
        email||null,
        hash,
        salt,
        it
      ),

      env.DB.prepare(`
        INSERT INTO account_scopes(
          id,
          account_id,
          role_id,
          org_node_id,
          active
        )
        VALUES(?,?,?,?,1)
      `).bind(
        uid('scope'),
        aid,
        'role_super_admin',
        'org_sfn'
      ),

      env.DB.prepare(`
        UPDATE system_settings
        SET
          value_json='{"completed":true}',
          updated_at=CURRENT_TIMESTAMP
        WHERE key='setup'
      `)
    ]);

    await audit(
      env,
      aid,
      'system_setup',
      'system',
      'setup',
      'org_sfn',
      {username:user}
    );

    return json({ok:true});
  }

  // =========================================================
  // LOGIN
  // =========================================================

  if(url.pathname==='/api/auth/login'&&req.method==='POST'){
    try{
      const b=await bodyJson(req);

      const login=clean(b.login,200).toLowerCase();
      const password=String(b.password||'');

      if(!login||!password) return json({error:'INVALID_LOGIN'},401);
      const rateKey=`login:${await sha256(clientHint(req)+'|'+login)}`;
      const rs=await safeRateState(env,rateKey,8,15);
      if(rs.blocked) return json({error:'TOO_MANY_LOGIN_ATTEMPTS'},429,{'retry-after':'900'});

      const a=await env.DB.prepare(`
        SELECT
          a.id,
          a.person_id,
          a.username,
          a.email,
          a.password_hash,
          a.password_salt,
          a.password_iterations,
          a.force_password_change,
          a.is_locked,
          p.status AS person_status
        FROM accounts a
        LEFT JOIN people p ON p.id=a.person_id
        WHERE
          LOWER(TRIM(a.username))=?
          OR LOWER(TRIM(COALESCE(a.email,'')))=?
        LIMIT 1
      `).bind(login,login).first();

      if(!a){await safeRateFail(env,rateKey,8,15);return json({error:'INVALID_LOGIN'},401);}

      const restricted=await env.DB.prepare("SELECT 1 FROM account_restrictions WHERE account_id=? AND restriction_type='ban' AND (ends_at IS NULL OR date(ends_at)>=date('now','+7 hours'))").bind(a.id).first();
      if(restricted)return json({error:'ACCOUNT_BANNED'},423);

      if(Number(a.is_locked||0)===1){
        return json({error:'ACCOUNT_LOCKED'},423);
      }

      if(a.person_status==='suspended'){
        return json({error:'ACCOUNT_SUSPENDED'},403);
      }

      const passwordOK=await verifyPassword(
        password,
        a.password_salt,
        a.password_iterations,
        a.password_hash
      );

      if(!passwordOK){await safeRateFail(env,rateKey,8,15);await safeSecurityEvent(env,a.id,'login_failed',req);return json({error:'INVALID_LOGIN'},401);}
      await safeRateClear(env,rateKey);

      await env.DB.prepare(`
        DELETE FROM sessions
        WHERE account_id=?
          AND expires_at<=CURRENT_TIMESTAMP
      `).bind(a.id).run();

      const t=token();
      const h=await sha256(t);
      const sid=uid('session');

      await createLoginSession(env,sid,a.id,h,req);

      await env.DB.prepare(`
        UPDATE accounts
        SET
          last_login_at=CURRENT_TIMESTAMP,
          updated_at=CURRENT_TIMESTAMP
        WHERE id=?
      `).bind(a.id).run();

      await safeAudit(env,a.id,'account_login','account',a.id,null,{username:a.username});
      await safeSecurityEvent(env,a.id,'login_success',req);

      return json(
        {
          ok:true,
          force_password_change:
            Number(a.force_password_change||0)===1
        },
        200,
        {
          'set-cookie':cookie('sfn_session',t,7)
        }
      );

    }catch(err){
      console.error('LOGIN_ERROR',err);

      return json(
        {
          error:'LOGIN_SYSTEM_ERROR'
        },
        500
      );
    }
  }

  // =========================================================
  // LOGOUT
  // =========================================================

  if(url.pathname==='/api/auth/logout'&&req.method==='POST'){
    const s=await getSession(req,env);

    if(s){
      await env.DB.prepare(
        'DELETE FROM sessions WHERE id=?'
      ).bind(s.session_id).run();
    }

    return json(
      {ok:true},
      200,
      {'set-cookie':clearCookie('sfn_session')}
    );
  }

  // =========================================================
  // PUBLIC CARD QR IMAGE (same-origin wrapper avoids browser CORS/canvas taint)
  // =========================================================

  if(url.pathname==='/api/public/card-qr'&&req.method==='GET'){
    const qrRateKey=`public-card-qr:${await sha256(clientHint(req))}`;
    const qrRate=await safeRateState(env,qrRateKey,120,15);
    if(qrRate.blocked)return json({error:'TOO_MANY_QR_REQUESTS'},429,{'retry-after':'900'});
    await safeRateFail(env,qrRateKey,120,15);
    const code=clean(url.searchParams.get('code'),120);
    if(!code)return json({error:'CODE_REQUIRED'},400);
    if(!/^[A-Za-z0-9_-]{3,120}$/.test(code))return json({error:'INVALID_CODE'},400);
    if(code!=='PREVIEW'){
      // A stale production D1 schema may not have one_time_credentials yet.
      // Keep the legacy existence check when possible, but don't let a missing
      // table turn PDF/QR export into an HTTP 500. The verify endpoint remains authoritative.
      try{
        const exists=await env.DB.prepare(`SELECT 1 AS ok FROM member_cards WHERE verify_token=? UNION ALL SELECT 1 AS ok FROM one_time_credentials WHERE verify_token=? UNION ALL SELECT 1 AS ok FROM verification_qr_records WHERE verify_token=? LIMIT 1`).bind(code,code,code).first();
        if(!exists)return json({error:'NOT_FOUND'},404);
      }catch(err){console.error('CARD_QR_EXISTENCE_CHECK_FAILED',String(err?.message||err));return json({error:'QR_VERIFICATION_STORE_UNAVAILABLE',detail:'Không xác minh được hồ sơ QR. Hãy kiểm tra migration dữ liệu trước khi tải QR.'},503)}
    }
    const requestedSize=Number(url.searchParams.get('size'));
    const size=[120,170,180,600].includes(requestedSize)?requestedSize:180;
    const verificationUrl=new URL('/verify',url.origin);verificationUrl.searchParams.set('code',code);
    try{
      // QR is generated inside the Worker. Verification tokens are never sent to a third-party QR service.
      const image=await generateQrPng(verificationUrl.toString(),size);
      if(!image?.byteLength||image.byteLength>512*1024)return json({error:'QR_IMAGE_INVALID'},502);
      return new Response(image,{status:200,headers:{'content-type':'image/png','cache-control':'public, max-age=86400','x-content-type-options':'nosniff'}});
    }catch(err){console.error('LOCAL_QR_GENERATION_ERROR',String(err?.message||err));return json({error:'QR_GENERATION_FAILED',detail:'Không tạo được ảnh QR cục bộ.'},502)}
  }

  // =========================================================
  // PUBLIC VERIFY
  // =========================================================

  if(url.pathname==='/api/public/verify'&&req.method==='GET'){
    const verifyRateKey=`public-verify:${await sha256(clientHint(req))}`;
    const verifyRate=await safeRateState(env,verifyRateKey,30,15);
    if(verifyRate.blocked)return json({error:'TOO_MANY_VERIFY_ATTEMPTS'},429,{'retry-after':'900'});
    await safeRateFail(env,verifyRateKey,30,15);
    const code=clean(url.searchParams.get('code'),120);

    if(!code){
      return json({error:'CODE_REQUIRED'},400);
    }

    const card=await env.DB.prepare(`
      SELECT
        c.card_number,
        c.status,
        c.issued_at,
        c.expires_at,
        c.title_on_card,
        p.full_name,
        p.member_code,
        p.avatar_url,
        t.name card_type_name,
        o.name org_name
      FROM member_cards c
      JOIN people p ON p.id=c.person_id
      JOIN card_types t ON t.id=c.card_type_id
      LEFT JOIN org_nodes o ON o.id=c.org_node_id
      WHERE c.verify_token=?
      LIMIT 1
    `).bind(code).first();

    if(card){
      return json({
        type:'card',
        valid:
          card.status==='active'&&
          (!card.expires_at||
            card.expires_at>=dateInVietnam()),
        record:{...card,avatar_url:localImagePath(card.avatar_url)}
      });
    }

    const oneTime=await env.DB.prepare(`
      SELECT
        o.card_number,
        o.status,
        o.issued_at,
        o.expires_at,
        o.event_name,
        o.full_name,
        o.role_label,
        t.name card_type_name
      FROM one_time_credentials o
      LEFT JOIN card_types t ON t.id=o.card_type_id
      WHERE o.verify_token=?
      LIMIT 1
    `).bind(code).first();
    if(oneTime){
      const today=dateInVietnam();
      return json({
        type:'one_time',
        valid:oneTime.status==='active' && (!oneTime.expires_at || oneTime.expires_at>=today),
        record:oneTime
      });
    }

    const independentQr=await env.DB.prepare(`
      SELECT credential_title,full_name,role_label,organization_label,reference_number,issued_at,expires_at,status,public_note
      FROM verification_qr_records
      WHERE verify_token=?
      LIMIT 1
    `).bind(code).first();
    if(independentQr){
      const today=dateInVietnam();
      const effectiveStatus=independentQr.status==='active'&&independentQr.issued_at&&independentQr.issued_at>today?'pending':independentQr.status==='active'&&independentQr.expires_at&&independentQr.expires_at<today?'expired':independentQr.status;
      return json({
        type:'verification_qr',
        valid:effectiveStatus==='active',
        record:{...independentQr,status:effectiveStatus}
      });
    }

    const cert=await env.DB.prepare(`
      SELECT
        c.certificate_no,
        c.title,
        c.issuer,
        c.issued_at,
        c.verification_status,
        p.full_name,
        p.member_code
      FROM certificates c
      JOIN people p ON p.id=c.person_id
      WHERE c.verify_code=?
         OR c.certificate_no=?
      LIMIT 1
    `).bind(code,code).first();

    if(cert){
      return json({
        type:'certificate',
        valid:cert.verification_status==='verified',
        record:cert
      });
    }

    return json({error:'NOT_FOUND'},404);
  }

  // =========================================================
  // PUBLIC ACCOUNT REQUEST
  // =========================================================

  if(url.pathname==='/api/public/request-avatar'&&req.method==='POST'){
    const uploadKey=`avatar-upload:${await sha256(clientHint(req))}`;const uploadRate=await safeRateState(env,uploadKey,12,60);if(uploadRate.blocked)return json({error:'UPLOAD_RATE_LIMITED'},429,{'retry-after':'3600'});await safeRateFail(env,uploadKey,12,60);
    const ct=(req.headers.get('content-type')||'').toLowerCase();

    if(!['image/jpeg','image/png','image/webp'].includes(ct)){
      return json({error:'IMAGE_TYPE_NOT_ALLOWED'},415);
    }

    const data=await req.arrayBuffer();

    if(!data.byteLength||data.byteLength>900000){
      return json({error:'IMAGE_TOO_LARGE'},413);
    }

    const ext=
      ct==='image/png'
        ?'png'
        :ct==='image/webp'
          ?'webp'
          :'jpg';

    const key=
      `requests/avatars/`+
      `${new Date().toISOString().slice(0,10)}/`+
      `${crypto.randomUUID()}.${ext}`;

    await env.FILES.put(
      key,
      data,
      {
        httpMetadata:{
          contentType:ct,
          cacheControl:
            'public, max-age=31536000, immutable'
        }
      }
    );

    return json({
      ok:true,
      url:`/files/${key}`
    });
  }

  if(url.pathname==='/api/public/org-options'&&req.method==='GET'){
    const r=await env.DB.prepare(`SELECT id,name,parent_id,node_type FROM org_nodes WHERE status='active' AND deleted_at IS NULL ORDER BY sort_order,name`).all();
    return json({items:r.results||[]});
  }


function memberEmailHtml({title,name,intro,code,status,processing='60 phút đến 48 giờ',body,ctaUrl,ctaLabel='Mở Trung Tâm Thành Viên Số Sky First'}){
  const e=v=>String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  return `<!doctype html><html lang="vi"><body style="margin:0;background:#eef6fc;font-family:Arial,sans-serif;color:#13243a"><table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr><td align="center" style="padding:28px 12px"><table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:680px;background:#fff;border:1px solid #dbeaf6;border-radius:22px;overflow:hidden"><tr><td style="height:7px;background:#65b9ed"></td></tr><tr><td style="padding:28px 34px"><div style="font-size:12px;font-weight:700;letter-spacing:1.2px;color:#6597b9">TRUNG TÂM THÀNH VIÊN SỐ SKY FIRST</div><div style="font-size:22px;font-weight:800;margin-top:5px">Sky First Network</div></td></tr><tr><td style="padding:0 34px"><div style="height:1px;background:#e6eff6"></div></td></tr><tr><td style="padding:28px 34px 12px"><div style="display:inline-block;background:#eaf7ff;color:#267eae;border-radius:999px;padding:7px 12px;font-size:12px;font-weight:700">${e(status)}</div><h1 style="font-size:27px;line-height:35px;margin:15px 0 10px">${e(title)}</h1><p style="font-size:16px;line-height:26px;color:#41566b">Xin chào <b>${e(name)}</b>,</p><p style="font-size:16px;line-height:26px;color:#41566b">${e(intro)}</p></td></tr>${code?`<tr><td style="padding:10px 34px 18px"><div style="background:#f4f9fd;border:1px solid #dbeaf6;border-radius:16px;padding:20px 22px"><div style="font-size:12px;color:#6b8aa1;font-weight:700">MÃ YÊU CẦU</div><div style="font-size:19px;font-weight:800;margin-top:5px;word-break:break-word">${e(code)}</div><div style="font-size:14px;color:#52697c;margin-top:12px">Trạng thái: <b>${e(status)}</b>${processing?` · Thời gian dự kiến: <b>${e(processing)}</b>`:''}</div></div></td></tr>`:''}<tr><td style="padding:0 34px 18px;font-size:15px;line-height:25px;color:#41566b">${e(body)}</td></tr><tr><td align="center" style="padding:6px 34px 30px"><a href="${e(ctaUrl)}" style="display:inline-block;background:#10243d;color:#fff;text-decoration:none;font-weight:700;padding:14px 22px;border-radius:12px">${e(ctaLabel)}</a></td></tr><tr><td style="background:#10243d;padding:24px 34px;color:#fff"><b>Trung Tâm Thành Viên Số Sky First · Sky First Network</b><div style="font-size:13px;color:#b9c9d8;margin-top:6px">support@skyfirst.io.vn · lienhe@skyfirst.io.vn · member.skyfirst.io.vn</div></td></tr></table></td></tr></table></body></html>`;
}
async function sendMemberEmail(env,{to,subject,html}){
  if(!env.RESEND_API_KEY||!to)return {sent:false,reason:'EMAIL_NOT_CONFIGURED'};
  try{
    const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{'authorization':`Bearer ${env.RESEND_API_KEY}`,'content-type':'application/json'},body:JSON.stringify({from:'Trung Tâm Thành Viên Số Sky First <support@skyfirst.io.vn>',to:[to],reply_to:'lienhe@skyfirst.io.vn',subject,html})});
    const data=await r.json().catch(()=>({}));
    return {sent:r.ok,id:data.id||null,error:r.ok?null:(data.message||`HTTP_${r.status}`)};
  }catch(e){return {sent:false,error:String(e?.message||e)}}
}

if(url.pathname==='/api/public/account-request'&&req.method==='POST'){
  const requestRateKey=`account-request:${await sha256(clientHint(req))}`;
  const requestRate=await safeRateState(env,requestRateKey,5,60);
  if(requestRate.blocked)return json({error:'REQUEST_RATE_LIMITED',message:'Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau một giờ.'},429,{'retry-after':'3600'});
  await safeRateFail(env,requestRateKey,5,60);
  const b=await bodyJson(req);

  const fields=[
    'full_name',
    'display_name',
    'date_of_birth',
    'gender',
    'nationality',
    'id_number',
    'id_issue_date',
    'id_issue_place',
    'email',
    'phone',
    'permanent_address',
    'temporary_address',
    'avatar_url',
    'target_org_node_id',
    'education_or_work_type',
    'school_or_workplace',
    'education_status'
  ];

  for(const k of fields){
    if(!clean(b[k],k.includes('address')?500:240)){
      return json({
        error:'ALL_PERSONAL_FIELDS_REQUIRED',
        field:k
      },400);
    }
  }

  const email=clean(b.email,200).toLowerCase();
  const idno=clean(b.id_number,20);

  if(!/^\S+@\S+\.\S+$/.test(email)){
    return json({error:'EMAIL_INVALID'},400);
  }

  if(!/^\d{12}$/.test(idno)){
    return json({
      error:'ID_NUMBER_MUST_BE_12_DIGITS'
    },400);
  }

  if(String(b.privacy_consent)!=='1'){
    return json({
      error:'PRIVACY_CONSENT_REQUIRED'
    },400);
  }

  const educationType=
    clean(b.education_or_work_type,50);

  const allowedEducationTypes=[
    'Học sinh',
    'Sinh viên',
    'Đang đi làm',
    'Khác',
    'Học tập & Công việc'
  ];

  if(!allowedEducationTypes.includes(educationType)){
    return json({
      error:'EDUCATION_OR_WORK_TYPE_INVALID'
    },400);
  }

  const educationStatus=
    clean(b.education_status,80);

  const allowedEducationStatuses=[
    'Đang học',
    'Đã tốt nghiệp',
    'Đang công tác',
    'Không còn theo học',
    'Đã tốt nghiệp',
    'Khác'
  ];

  if(!allowedEducationStatuses.includes(educationStatus)){
    return json({
      error:'EDUCATION_STATUS_INVALID'
    },400);
  }

  const dob=
    new Date(
      clean(b.date_of_birth,20)+'T00:00:00Z'
    );

  if(Number.isNaN(dob.getTime())){
    return json({
      error:'DATE_OF_BIRTH_INVALID'
    },400);
  }

  const now=new Date();

  let age=
    now.getUTCFullYear()-
    dob.getUTCFullYear();

  if(
    now.getUTCMonth()<dob.getUTCMonth()||
    (
      now.getUTCMonth()===dob.getUTCMonth()&&
      now.getUTCDate()<dob.getUTCDate()
    )
  ){
    age--;
  }

  if(age<0){
    return json({
      error:'DATE_OF_BIRTH_INVALID'
    },400);
  }

  if(age<18){
    for(const k of [
      'guardian_full_name',
      'guardian_relationship',
      'guardian_phone',
      'guardian_email',
      'guardian_date_of_birth',
      'guardian_id_number'
    ]){
      if(!clean(b[k],240)){
        return json({
          error:'GUARDIAN_INFORMATION_REQUIRED',
          field:k
        },400);
      }
    }

    if(
      String(b.guardian_lives_together)!=='1'&&
      !clean(b.guardian_address,500)
    ){
      return json({
        error:'GUARDIAN_ADDRESS_REQUIRED'
      },400);
    }
  }

  for(const k of ['school_name','class_or_major','employment_status','workplace_name','work_department','job_title']){
    if(!clean(b[k],240))return json({error:'ALL_EDUCATION_WORK_FIELDS_REQUIRED',field:k},400);
  }
  const requestedOrgIds=[...new Set((Array.isArray(b.requested_org_ids)?b.requested_org_ids:[]).map(x=>clean(x,100)).filter(Boolean))];
  const primaryOrgId=clean(b.target_org_node_id,100);
  if(primaryOrgId&&!requestedOrgIds.includes(primaryOrgId))requestedOrgIds.unshift(primaryOrgId);
  if(!requestedOrgIds.length)return json({error:'AT_LEAST_ONE_ORG_REQUIRED'},400);

  const org=await env.DB.prepare(`
    SELECT id
    FROM org_nodes
    WHERE id=?
      AND status='active'
      AND deleted_at IS NULL
  `).bind(
    clean(b.target_org_node_id,100)
  ).first();

  if(!org){
    return json({
      error:'ORG_INVALID'
    },400);
  }
  for(const oid of requestedOrgIds){
    const ok=await env.DB.prepare(`SELECT 1 FROM org_nodes WHERE id=? AND status='active' AND deleted_at IS NULL`).bind(oid).first();
    if(!ok)return json({error:'ORG_INVALID'},400);
  }

  const existingAccount=
    await env.DB.prepare(`
      SELECT 1
      FROM accounts
      WHERE lower(email)=?
      LIMIT 1
    `).bind(email).first();

  if(existingAccount){
    return json({
      error:'ACCOUNT_ALREADY_EXISTS'
    },409);
  }

  const pending=
    await env.DB.prepare(`
      SELECT 1
      FROM account_requests
      WHERE status IN ('pending','supplement')
        AND (
          lower(email)=?
          OR id_number=?
        )
      LIMIT 1
    `).bind(
      email,
      idno
    ).first();

  if(pending){
    return json({
      error:'REQUEST_ALREADY_PENDING'
    },409);
  }

  const id=uid('request');

  const code=
    `SFN-MEMBER-REQ-`+
    `${String(Date.now()).slice(-8)}-`+
    `${crypto.randomUUID()
      .slice(0,4)
      .toUpperCase()}`;

  await ensureAccountRequestProfiles(env);
  await ensureAccountRequestExtended(env);

  await env.DB.batch([
    env.DB.prepare(`
      INSERT INTO account_requests(
        id,request_code,full_name,display_name,date_of_birth,gender,nationality,
        id_number,id_issue_date,id_issue_place,email,phone,permanent_address,temporary_address,
        avatar_url,target_org_node_id,guardian_full_name,guardian_relationship,guardian_phone,
        guardian_email,guardian_lives_together,guardian_address,privacy_consent,status
      )
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,'pending')
    `).bind(
      id,code,clean(b.full_name,160),clean(b.display_name,160),clean(b.date_of_birth,20),
      clean(b.gender,50),clean(b.nationality,80),idno,clean(b.id_issue_date,20),
      clean(b.id_issue_place,200),email,clean(b.phone,50),clean(b.permanent_address,500),
      clean(b.temporary_address,500),clean(b.avatar_url,1200),clean(b.target_org_node_id,100),
      age<18?clean(b.guardian_full_name,160):null,
      age<18?clean(b.guardian_relationship,80):null,
      age<18?clean(b.guardian_phone,50):null,
      age<18?clean(b.guardian_email,200).toLowerCase():null,
      age<18&&String(b.guardian_lives_together)==='1'?1:0,
      age<18&&String(b.guardian_lives_together)!=='1'?clean(b.guardian_address,500):null
    ),
    env.DB.prepare(`
      INSERT INTO account_request_profiles(
        request_id,education_or_work_type,school_or_workplace,class_or_major,education_status
      ) VALUES(?,?,?,?,?)
    `).bind(
      id,educationType,clean(b.school_or_workplace,240),clean(b.class_or_major,240)||null,educationStatus
    )
  ]);
  await env.DB.prepare(`INSERT INTO account_request_extended(request_id,school_name,class_or_major,employment_status,workplace_name,work_department,job_title,guardian_date_of_birth,guardian_id_number) VALUES(?,?,?,?,?,?,?,?,?)`).bind(
    id,clean(b.school_name,240),clean(b.class_or_major,240),clean(b.employment_status,80),clean(b.workplace_name,240),clean(b.work_department,180),clean(b.job_title,180),age<18?clean(b.guardian_date_of_birth,20):null,age<18?clean(b.guardian_id_number,30):null
  ).run();
  await env.DB.batch(requestedOrgIds.map(oid=>env.DB.prepare(`INSERT OR IGNORE INTO account_request_orgs(request_id,org_node_id,is_primary) VALUES(?,?,?)`).bind(id,oid,oid===primaryOrgId?1:0)));

  const trackingUrl=`${env.APP_URL||'https://member.skyfirst.io.vn'}/registration-status?request=${encodeURIComponent(code)}&email=${encodeURIComponent(email)}`;
  const mail=await sendMemberEmail(env,{to:email,subject:`[Sky First Network] Đã tiếp nhận yêu cầu đăng ký thành viên – ${code}`,html:memberEmailHtml({title:'Đã tiếp nhận yêu cầu đăng ký thành viên',name:clean(b.full_name,160),intro:'Yêu cầu đăng ký của bạn đã được Trung Tâm Thành Viên Số Sky First tiếp nhận.',code,status:'Đã tiếp nhận',body:'Vui lòng lưu mã yêu cầu để tra cứu. Sky First Network sẽ gửi email tiếp theo khi hồ sơ được cập nhật trạng thái.',ctaUrl:trackingUrl,ctaLabel:'Tra cứu trạng thái hồ sơ'})});

  return json({
    ok:true,
    email_sent:mail.sent===true,
    request_code:code,
    message:
      'Đăng ký đã được tiếp nhận. '+
      'Sky First Network dự kiến xử lý trong 60 phút đến 48 giờ, '+
      'có thể thay đổi tùy số lượng yêu cầu và quá trình xác minh. '+
      'Vui lòng thường xuyên kiểm tra email và lưu mã yêu cầu '+
      'để tra cứu trạng thái.'
  });
}

  if(
    url.pathname==='/api/public/account-request/status'&&
    req.method==='GET'
  ){
    const code=
      clean(url.searchParams.get('code'),100);

    const email=
      clean(
        url.searchParams.get('email'),
        200
      ).toLowerCase();

    if(!code||!email){
      return json({
        error:'CODE_AND_EMAIL_REQUIRED'
      },400);
    }

    const r=await env.DB.prepare(`
      SELECT
        request_code,
        full_name,
        status,
        admin_note,
        reviewed_at,
        created_at
      FROM account_requests
      WHERE request_code=?
        AND lower(email)=?
      LIMIT 1
    `).bind(code,email).first();

    return r
      ?json({request:r})
      :json({error:'NOT_FOUND'},404);
  }

  if(url.pathname==='/api/public/password/forgot'&&req.method==='POST'){
    await ensureSecurityTables(env);const b=await bodyJson(req);const login=clean(b.login,200).toLowerCase();
    const key=`forgot:${await sha256(clientHint(req)+'|'+login)}`;const rs=await safeRateState(env,key,4,60);if(rs.blocked)return json({ok:true});
    await safeRateFail(env,key,4,60);
    const a=login?await env.DB.prepare(`SELECT id,email,username FROM accounts WHERE lower(username)=? OR lower(COALESCE(email,''))=? LIMIT 1`).bind(login,login).first():null;
    if(a?.email){const raw=token();const hash=await sha256(raw);await env.DB.prepare(`DELETE FROM password_reset_tokens WHERE account_id=? OR expires_at<=CURRENT_TIMESTAMP`).bind(a.id).run();await env.DB.prepare(`INSERT INTO password_reset_tokens(id,account_id,token_hash,expires_at) VALUES(?,?,?,datetime('now','+30 minutes'))`).bind(uid('reset'),a.id,hash).run();const app=env.APP_URL||new URL(req.url).origin;await sendMemberEmail(env,{to:a.email,subject:'Đặt lại mật khẩu Sky First',html:memberEmailHtml({title:'Đặt lại mật khẩu',name:a.username,intro:'Chúng tôi nhận được yêu cầu đặt lại mật khẩu.',status:'BẢO MẬT TÀI KHOẢN',body:'Liên kết này chỉ sử dụng một lần và hết hạn sau 30 phút. Nếu bạn không yêu cầu, hãy bỏ qua email này.',ctaUrl:`${app}/?reset_token=${encodeURIComponent(raw)}`,ctaLabel:'Đặt lại mật khẩu'})});await safeSecurityEvent(env,a.id,'password_reset_requested',req)}
    return json({ok:true});
  }
  if(url.pathname==='/api/public/password/reset'&&req.method==='POST'){
    await ensureSecurityTables(env);const b=await bodyJson(req);const raw=clean(b.token,512);const pw=String(b.password||'');if(!raw||pw.length<10)return json({error:'INVALID_RESET_DATA'},400);const h=await sha256(raw);const r=await env.DB.prepare(`SELECT pr.id,pr.account_id FROM password_reset_tokens pr WHERE pr.token_hash=? AND pr.used_at IS NULL AND pr.expires_at>CURRENT_TIMESTAMP LIMIT 1`).bind(h).first();if(!r)return json({error:'RESET_TOKEN_INVALID'},400);const salt=token(),it=100000,hash=await pbkdf2(pw,salt,it);await env.DB.batch([env.DB.prepare(`UPDATE accounts SET password_hash=?,password_salt=?,password_iterations=?,force_password_change=0,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(hash,salt,it,r.account_id),env.DB.prepare(`UPDATE password_reset_tokens SET used_at=CURRENT_TIMESTAMP WHERE id=?`).bind(r.id),env.DB.prepare(`DELETE FROM sessions WHERE account_id=?`).bind(r.account_id)]);await safeSecurityEvent(env,r.account_id,'password_reset_completed',req);return json({ok:true});
  }

  // =========================================================
  // AUTHENTICATED
  // =========================================================

  const s=await getSession(req,env);

  if(!s){
    return json({error:'UNAUTHORIZED'},401);
  }

  if(Number(s.force_password_change||0)===1 && !(url.pathname==='/api/me'&&req.method==='GET') && !(url.pathname==='/api/me/password'&&req.method==='POST') && !(url.pathname==='/api/auth/logout'&&req.method==='POST')){
    return json({error:'PASSWORD_CHANGE_REQUIRED',message:'Bạn cần đổi mật khẩu trước khi tiếp tục.'},403);
  }

  if(!sameOrigin(req)) return json({error:'ORIGIN_FORBIDDEN'},403);


  // Independent QR issuance for externally designed cards. It is deliberately
  // separate from member_cards and one_time_credentials.
  if(url.pathname==='/api/admin/issuance-overview'&&req.method==='GET'){
    if(!(await hasPerm(env,s.account_id,'card.manage')))return json({error:'FORBIDDEN'},403);
    const today=dateInVietnam();
    const future=new Date(Date.now()+30*86400000);
    const dateParts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(future).map(x=>[x.type,x.value]));
    const expiryLimit=`${dateParts.year}-${dateParts.month}-${dateParts.day}`;
    const [qr,totalOt,activeOt,memberTotal,memberActive,expiring]=await Promise.all([
      env.DB.prepare(`SELECT COUNT(*) total,SUM(CASE WHEN status='active' AND issued_at<=? AND (expires_at IS NULL OR expires_at>=?) THEN 1 ELSE 0 END) active,SUM(CASE WHEN status='revoked' THEN 1 ELSE 0 END) revoked,SUM(CASE WHEN status='active' AND expires_at IS NOT NULL AND expires_at<? THEN 1 ELSE 0 END) expired,SUM(CASE WHEN status='active' AND issued_at>? THEN 1 ELSE 0 END) pending FROM verification_qr_records`).bind(today,today,today,today).first(),
      env.DB.prepare('SELECT COUNT(*) n FROM one_time_credentials').first(),
      env.DB.prepare(`SELECT COUNT(*) n FROM one_time_credentials WHERE status='active' AND (expires_at IS NULL OR expires_at>=?)`).bind(today).first(),
      env.DB.prepare('SELECT COUNT(*) n FROM member_cards').first(),
      env.DB.prepare(`SELECT COUNT(*) n FROM member_cards WHERE status='active' AND (expires_at IS NULL OR expires_at>=?)`).bind(today).first(),
      env.DB.prepare(`SELECT COUNT(*) n FROM member_cards WHERE status='active' AND expires_at IS NOT NULL AND expires_at>=? AND expires_at<=?`).bind(today,expiryLimit).first()
    ]);
    return json({today,verification_qr:{total:Number(qr?.total||0),active:Number(qr?.active||0),expired:Number(qr?.expired||0),revoked:Number(qr?.revoked||0),pending:Number(qr?.pending||0)},one_time:{total:Number(totalOt?.n||0),active:Number(activeOt?.n||0)},member_cards:{total:Number(memberTotal?.n||0),active:Number(memberActive?.n||0),expiring_30_days:Number(expiring?.n||0)}});
  }

  if(url.pathname==='/api/admin/member-cards'&&req.method==='GET'){
    if(!(await hasPerm(env,s.account_id,'card.manage')))return json({error:'FORBIDDEN'},403);
    const q=clean(url.searchParams.get('q'),100);
    const status=clean(url.searchParams.get('status'),20);
    const limit=Math.min(250,Math.max(10,Number(url.searchParams.get('limit')||100)));
    const today=dateInVietnam();
    const r=await env.DB.prepare(`
      SELECT c.id,c.person_id,c.card_type_id,c.org_node_id,c.card_number,c.title_on_card,c.issued_at,c.expires_at,
        CASE WHEN c.status='active' AND c.expires_at IS NOT NULL AND c.expires_at<? THEN 'expired' ELSE c.status END status,
        c.verify_token,p.full_name,p.member_code,p.avatar_url,t.name card_type_name,t.template_json card_template_json,o.name org_name
      FROM member_cards c JOIN people p ON p.id=c.person_id
      LEFT JOIN card_types t ON t.id=c.card_type_id LEFT JOIN org_nodes o ON o.id=c.org_node_id
      WHERE (?='' OR p.full_name LIKE ? OR p.member_code LIKE ? OR c.card_number LIKE ?)
        AND (?='' OR c.status=?)
      ORDER BY c.created_at DESC LIMIT ?
    `).bind(today,q,`%${q}%`,`%${q}%`,`%${q}%`,status,status,limit).all();
    return json({items:r.results||[],today});
  }

  if(url.pathname==='/api/admin/verification-qr'&&['GET','POST'].includes(req.method)){
    if(!(await hasPerm(env,s.account_id,'card.manage')))return json({error:'FORBIDDEN'},403);
    if(req.method==='GET'){
      const today=dateInVietnam();
      const q=clean(url.searchParams.get('q'),100);
      const r=await env.DB.prepare(`
        SELECT id,credential_title,full_name,role_label,organization_label,reference_number,issued_at,expires_at,
          CASE WHEN status='active' AND issued_at>? THEN 'pending' WHEN status='active' AND expires_at IS NOT NULL AND expires_at<? THEN 'expired' ELSE status END effective_status,
          verify_token,public_note,created_at,updated_at
        FROM verification_qr_records
        WHERE (?='' OR full_name LIKE ? OR credential_title LIKE ? OR reference_number LIKE ? OR organization_label LIKE ?)
        ORDER BY created_at DESC LIMIT 250
      `).bind(today,today,q,`%${q}%`,`%${q}%`,`%${q}%`,`%${q}%`).all();
      return json({items:r.results||[],today});
    }
    const b=await bodyJson(req);
    const credentialTitle=clean(b.credential_title,160);
    const fullName=clean(b.full_name,160);
    const roleLabel=clean(b.role_label,160)||null;
    const organization=clean(b.organization_label,200)||null;
    const issuedAt=clean(b.issued_at,10)||dateInVietnam();
    const expiresAt=clean(b.expires_at,10)||null;
    const publicNote=clean(b.public_note,500)||null;
    const privateNotes=clean(b.private_notes,1000)||null;
    const validDate=v=>!v||(/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v+'T00:00:00Z'))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v);
    if(!credentialTitle||!fullName)return json({error:'CREDENTIAL_TITLE_AND_NAME_REQUIRED',message:'Cần nhập tên thẻ/giấy xác nhận và họ tên.'},400);
    if(!validDate(issuedAt)||!validDate(expiresAt))return json({error:'INVALID_DATE',message:'Ngày cấp hoặc ngày hết hiệu lực không hợp lệ.'},400);
    if(expiresAt&&expiresAt<issuedAt)return json({error:'EXPIRY_BEFORE_ISSUE',message:'Ngày hết hiệu lực không được trước ngày cấp.'},400);
    const id=uid('vqr');
    let referenceNumber=clean(b.reference_number,80);
    if(referenceNumber&&!/^[A-Za-z0-9_-]{3,80}$/.test(referenceNumber))return json({error:'INVALID_REFERENCE_NUMBER',message:'Mã hồ sơ chỉ được chứa chữ, số, gạch ngang hoặc gạch dưới.'},400);
    if(!referenceNumber){
      for(let attempt=0;attempt<12;attempt++){
        const digits=new Uint32Array(1);crypto.getRandomValues(digits);
        const candidate=`SFN-QR-${String(digits[0]%100000000).padStart(8,'0')}`;
        const exists=await env.DB.prepare('SELECT 1 FROM verification_qr_records WHERE reference_number=? LIMIT 1').bind(candidate).first();
        if(!exists){referenceNumber=candidate;break}
      }
      if(!referenceNumber)return json({error:'REFERENCE_GENERATION_FAILED',message:'Không tạo được mã hồ sơ duy nhất. Vui lòng thử lại.'},503);
    }
    const verify=verifyCode('QRV');
    try{
      await env.DB.prepare(`INSERT INTO verification_qr_records(id,credential_title,full_name,role_label,organization_label,reference_number,issued_at,expires_at,status,verify_token,public_note,private_notes,created_by_account_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`)
        .bind(id,credentialTitle,fullName,roleLabel,organization,referenceNumber,issuedAt,expiresAt,'active',verify,publicNote,privateNotes,s.account_id).run();
    }catch(e){
      const msg=String(e?.message||e);
      if(msg.includes('UNIQUE'))return json({error:'REFERENCE_NUMBER_ALREADY_USED',message:'Mã hồ sơ đã tồn tại. Hãy dùng mã khác.'},409);
      console.error('INDEPENDENT_QR_CREATE_FAILED',msg);
      return json({error:'CREATE_FAILED',message:'Chưa tạo được hồ sơ QR. Dữ liệu chưa được lưu.'},500);
    }
    await safeAudit(env,s.account_id,'verification_qr_created','verification_qr_record',id,null,{reference_number:referenceNumber,credential_title:credentialTitle});
    return json({ok:true,id,reference_number:referenceNumber,verify_token:verify,verification_url:new URL('/verify?code='+encodeURIComponent(verify),url.origin).toString()},201);
  }
  const verificationQrAction=url.pathname.match(/^\/api\/admin\/verification-qr\/([^/]+)\/(revoke)$/);
  if(verificationQrAction&&req.method==='POST'){
    if(!(await hasPerm(env,s.account_id,'card.manage')))return json({error:'FORBIDDEN'},403);
    const id=decodeURIComponent(verificationQrAction[1]);
    const row=await env.DB.prepare('SELECT id,status,reference_number FROM verification_qr_records WHERE id=?').bind(id).first();
    if(!row)return json({error:'NOT_FOUND'},404);
    if(row.status!=='revoked'){
      await env.DB.prepare(`UPDATE verification_qr_records SET status='revoked',updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(id).run();
      await safeAudit(env,s.account_id,'verification_qr_revoked','verification_qr_record',id,null,{reference_number:row.reference_number});
    }
    return json({ok:true,status:'revoked'});
  }

  if(url.pathname==='/api/admin/one-time-credentials'&&['GET','POST'].includes(req.method)){
    if(!(await hasPerm(env,s.account_id,'card.manage')))return json({error:'FORBIDDEN'},403);
    if(req.method==='GET'){
      const r=await env.DB.prepare(`SELECT o.id,o.credential_type,o.event_name,o.full_name,o.role_label,o.card_number,o.issued_at,o.expires_at,o.status,o.verify_token,o.card_type_id,o.notes,o.created_by_account_id,o.created_at,o.updated_at,t.name card_type_name,t.template_json card_template_json FROM one_time_credentials o LEFT JOIN card_types t ON t.id=o.card_type_id ORDER BY o.created_at DESC LIMIT 250`).all();
      return json({items:r.results||[]});
    }
    const b=await bodyJson(req);
    const fullName=clean(b.full_name,160);
    const eventName=clean(b.event_name,200);
    if(!fullName||!eventName)return json({error:'FULL_NAME_AND_EVENT_REQUIRED'},400);
    const id=uid('otc');
    const verify=verifyCode('EVT');
    let cardNumber=clean(b.card_number,120);
    if(!cardNumber){
      for(let attempt=0;attempt<8;attempt++){
        const digits=new Uint32Array(1);crypto.getRandomValues(digits);
        const candidate=`SFN-EVT-${String(digits[0]%100000000).padStart(8,'0')}`;
        const exists=await env.DB.prepare('SELECT 1 FROM one_time_credentials WHERE card_number=? LIMIT 1').bind(candidate).first();
        if(!exists){cardNumber=candidate;break}
      }
      if(!cardNumber)return json({error:'CARD_NUMBER_GENERATION_FAILED'},503);
    }
    const status=['active','used','expired','revoked'].includes(b.status)?b.status:'active';
    try{
      await env.DB.prepare(`INSERT INTO one_time_credentials(id,credential_type,event_name,full_name,role_label,photo_url,card_number,issued_at,expires_at,status,verify_token,card_type_id,notes,created_by_account_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id,'event_card',eventName,fullName,clean(b.role_label,160)||null,null,cardNumber,clean(b.issued_at,20)||dateInVietnam(),clean(b.expires_at,20)||null,status,verify,null,clean(b.notes,1000)||null,s.account_id).run();
    }catch(e){return json({error:String(e).includes('UNIQUE')?'CARD_NUMBER_ALREADY_USED':'CREATE_FAILED'},400)}
    await safeAudit(env,s.account_id,'one_time_credential_issued','one_time_credential',id,null,{event_name:eventName,card_number:cardNumber});
    return json({ok:true,id,verify_token:verify,card_number:cardNumber});
  }
  const oneTimeAction=url.pathname.match(/^\/api\/admin\/one-time-credentials\/([^/]+)\/(revoke|use)$/);
  if(oneTimeAction&&req.method==='POST'){
    if(!(await hasPerm(env,s.account_id,'card.manage')))return json({error:'FORBIDDEN'},403);
    const id=decodeURIComponent(oneTimeAction[1]);
    const action=oneTimeAction[2];
    const row=await env.DB.prepare('SELECT id,status FROM one_time_credentials WHERE id=?').bind(id).first();
    if(!row)return json({error:'NOT_FOUND'},404);
    const next=action==='revoke'?'revoked':'used';
    await env.DB.prepare('UPDATE one_time_credentials SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(next,id).run();
    await safeAudit(env,s.account_id,action==='revoke'?'one_time_credential_revoked':'one_time_credential_used','one_time_credential',id,null,{});
    return json({ok:true,status:next});
  }

  if(url.pathname==='/api/admin/card-designs'||url.pathname.startsWith('/api/admin/card-designs/')){
    return json({error:'FEATURE_REMOVED',message:'Chức năng thiết kế và quản lý mẫu thẻ đã được gỡ bỏ. Nghiệp vụ cấp phát, tải tài liệu và xác minh vẫn được giữ.'},410);
  }

  if(url.pathname==='/api/admin/site-assets'&&req.method==='POST'){
    if(!(await isSuper(env,s.account_id)))return json({error:'FORBIDDEN'},403);
    const ct=(req.headers.get('content-type')||'').toLowerCase().split(';')[0].trim();
    if(!['image/jpeg','image/png','image/webp'].includes(ct))return json({error:'IMAGE_TYPE_NOT_ALLOWED',message:'Chỉ nhận ảnh JPG, PNG hoặc WebP.'},415);
    const bytes=new Uint8Array(await req.arrayBuffer());
    if(!bytes.length||bytes.length>2*1024*1024)return json({error:'IMAGE_TOO_LARGE',message:'Ảnh phải nhỏ hơn hoặc bằng 2 MB.'},413);
    const valid=validUploadedImage(bytes,ct);
    if(!valid)return json({error:'INVALID_IMAGE_FILE',message:'Nội dung tệp không khớp với định dạng ảnh đã chọn.'},400);
    if(!env.FILES)return json({error:'FILE_STORAGE_UNAVAILABLE',message:'Kho lưu trữ tệp chưa được cấu hình.'},503);
    const ext=ct==='image/png'?'png':ct==='image/webp'?'webp':'jpg';
    const key=`site-assets/${crypto.randomUUID()}.${ext}`;
    await env.FILES.put(key,bytes,{httpMetadata:{contentType:ct,cacheControl:'public, max-age=31536000, immutable'}});
    await audit(env,s.account_id,'site_asset_uploaded','site_asset',key,null,{content_type:ct,size:bytes.length});
    return json({ok:true,url:`/files/${key}`,message:'Đã tải ảnh lên kho lưu trữ.'},201);
  }

  if(url.pathname==='/api/admin/portal-config'&&['GET','PUT'].includes(req.method)){
    if(!(await isSuper(env,s.account_id)))return json({error:'FORBIDDEN'},403);
    if(req.method==='GET'){
      const r=await env.DB.prepare("SELECT value_json,updated_at FROM system_settings WHERE key='member_portal_v4'").first();
      let data={};try{data=JSON.parse(r?.value_json||'{}')}catch{}
      const savedBrand=data.brand&&typeof data.brand==='object'?data.brand:{};
      const brand={...DEFAULT_PORTAL_BRAND,siteName:clean(savedBrand.siteName||data.siteName||DEFAULT_PORTAL_BRAND.siteName,100)||DEFAULT_PORTAL_BRAND.siteName,logoUrl:localBrandImagePath(savedBrand.logoUrl||data.logoUrl||DEFAULT_PORTAL_BRAND.logoUrl),primaryColor:/^#[a-f0-9]{6}$/i.test(savedBrand.primaryColor||'')?savedBrand.primaryColor:DEFAULT_PORTAL_BRAND.primaryColor,accentColor:/^#[a-f0-9]{6}$/i.test(savedBrand.accentColor||'')?savedBrand.accentColor:DEFAULT_PORTAL_BRAND.accentColor,navColor:/^#[a-f0-9]{6}$/i.test(savedBrand.navColor||'')?savedBrand.navColor:DEFAULT_PORTAL_BRAND.navColor,fontFamily:['Arial','Verdana','Georgia','Tahoma','system'].includes(savedBrand.fontFamily)?savedBrand.fontFamily:DEFAULT_PORTAL_BRAND.fontFamily,baseFontSize:Number.isInteger(Number(savedBrand.baseFontSize))&&Number(savedBrand.baseFontSize)>=14&&Number(savedBrand.baseFontSize)<=20?Number(savedBrand.baseFontSize):16,cornerRadius:Number.isInteger(Number(savedBrand.cornerRadius))&&Number(savedBrand.cornerRadius)>=8&&Number(savedBrand.cornerRadius)<=24?Number(savedBrand.cornerRadius):18,contentMaxWidth:Number.isInteger(Number(savedBrand.contentMaxWidth))&&Number(savedBrand.contentMaxWidth)>=1080&&Number(savedBrand.contentMaxWidth)<=1680?Number(savedBrand.contentMaxWidth):1500};
      const links=portalLinksFromSettings(data.links);
      return json({settings:{...data,brand,links},updated_at:r?.updated_at||null});
    }
    const b=await bodyJson(req),valid=new Set(['members','activities','units','programs']);
    const stored=await env.DB.prepare("SELECT value_json FROM system_settings WHERE key='member_portal_v4'").first();let previous={};try{previous=JSON.parse(stored?.value_json||'{}')}catch{}
    let stats=Array.isArray(previous.stats)?previous.stats:[];
    if(b.stats!==undefined){
      if(!Array.isArray(b.stats)||b.stats.length>8)return json({error:'INVALID_STATS',message:'Danh sách thống kê không hợp lệ.'},400);
      const seen=new Set();stats=[];
      for(const x of b.stats){
        if(!x||!valid.has(x.key)||seen.has(x.key))return json({error:'INVALID_STAT_KEY',message:'Có chỉ số thống kê không hợp lệ hoặc bị trùng.'},400);
        seen.add(x.key);const mode=x.mode==='manual'?'manual':'auto';
        if(x.key==='programs'&&mode==='auto')return json({error:'PROGRAM_COUNT_REQUIRES_MANUAL_VALUE',message:'Số chương trình phải được nhập sau khi kiểm chứng.'},400);
        const value=x.value===null||x.value===''?null:Number(x.value);
        if(mode==='manual'&&value!==null&&(!Number.isSafeInteger(value)||value<0||value>1000000000))return json({error:'INVALID_STAT_VALUE',message:'Giá trị thống kê không hợp lệ.'},400);
        stats.push({key:x.key,label:clean(x.label,75)||x.key,mode,value:mode==='manual'?value:null,enabled:x.enabled!==false});
      }
    }
    const oldBrand=previous.brand&&typeof previous.brand==='object'?previous.brand:{};
    const rawBrand=b.brand&&typeof b.brand==='object'?b.brand:{};
    const brand={
      siteName:clean(rawBrand.siteName??oldBrand.siteName??previous.siteName??DEFAULT_PORTAL_BRAND.siteName,100)||DEFAULT_PORTAL_BRAND.siteName,
      logoUrl:localBrandImagePath(rawBrand.logoUrl??oldBrand.logoUrl??previous.logoUrl??DEFAULT_PORTAL_BRAND.logoUrl),
      primaryColor:clean(rawBrand.primaryColor??oldBrand.primaryColor??DEFAULT_PORTAL_BRAND.primaryColor,7),
      accentColor:clean(rawBrand.accentColor??oldBrand.accentColor??DEFAULT_PORTAL_BRAND.accentColor,7),
      navColor:clean(rawBrand.navColor??oldBrand.navColor??DEFAULT_PORTAL_BRAND.navColor,7),
      fontFamily:clean(rawBrand.fontFamily??oldBrand.fontFamily??DEFAULT_PORTAL_BRAND.fontFamily,20),
      baseFontSize:Number(rawBrand.baseFontSize??oldBrand.baseFontSize??DEFAULT_PORTAL_BRAND.baseFontSize),
      cornerRadius:Number(rawBrand.cornerRadius??oldBrand.cornerRadius??DEFAULT_PORTAL_BRAND.cornerRadius??18),
      contentMaxWidth:Number(rawBrand.contentMaxWidth??oldBrand.contentMaxWidth??DEFAULT_PORTAL_BRAND.contentMaxWidth??1500)
    };
    for(const k of ['primaryColor','accentColor','navColor'])if(!/^#[a-f0-9]{6}$/i.test(brand[k]))return json({error:'INVALID_BRAND_COLOR',message:'Màu sắc phải có dạng mã màu hợp lệ.'},400);
    if(!['Arial','Verdana','Georgia','Tahoma','system'].includes(brand.fontFamily))return json({error:'INVALID_FONT',message:'Kiểu chữ chưa được hỗ trợ.'},400);
    if(!Number.isInteger(brand.baseFontSize)||brand.baseFontSize<14||brand.baseFontSize>20)return json({error:'INVALID_FONT_SIZE',message:'Cỡ chữ phải từ 14 đến 20.'},400);
    if(!Number.isInteger(brand.cornerRadius)||brand.cornerRadius<8||brand.cornerRadius>24)return json({error:'INVALID_CORNER_RADIUS',message:'Độ bo góc phải từ 8 đến 24.'},400);
    if(!Number.isInteger(brand.contentMaxWidth)||brand.contentMaxWidth<1080||brand.contentMaxWidth>1680)return json({error:'INVALID_CONTENT_WIDTH',message:'Chiều rộng nội dung phải từ 1080 đến 1680.'},400);
    if(rawBrand.logoUrl!==undefined&&String(rawBrand.logoUrl)!=='/sfn-logo.png'&&!/^\/files\/site-assets\/[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}\.(?:png|jpg|webp)$/i.test(String(rawBrand.logoUrl)))return json({error:'INVALID_LOGO_PATH',message:'Logo phải là ảnh đã tải lên hệ thống.'},400);
    let links=Array.isArray(previous.links)?previous.links:DEFAULT_PORTAL_LINKS;
    if(b.links!==undefined){
      if(!Array.isArray(b.links)||b.links.length!==5)return json({error:'INVALID_PORTAL_LINKS',message:'Cần khai báo đủ 5 nền tảng Sky First.'},400);
      links=[];
      for(const [i,x] of b.links.entries()){
        const u=safeSkyFirstUrl(x?.url),name=clean(x?.name,100),description=clean(x?.description,140);
        let samePortal=false;try{samePortal=!!u&&new URL(u).hostname===new URL(DEFAULT_PORTAL_LINKS[i].url).hostname}catch{}
        if(!u||!name||!samePortal)return json({error:'INVALID_PORTAL_LINK',message:`Nền tảng thứ ${i+1} cần có tên và địa chỉ đúng website đã quy định.`},400);
        links.push({name,url:u,description});
      }
    }
    const settings={...previous,stats,tagline:clean(b.tagline??previous.tagline??'Mỗi thành viên là một hành trình. Mỗi đóng góp tạo nên một Sky First lớn mạnh hơn.',190),brand,links};
    await env.DB.prepare("INSERT INTO system_settings(key,value_json,updated_at) VALUES('member_portal_v4',?,CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json,updated_at=CURRENT_TIMESTAMP").bind(JSON.stringify(settings)).run();
    await audit(env,s.account_id,'portal_config_updated','system_settings','member_portal_v4',null,{keys:stats.map(x=>x.key),brand_updated:true,links_updated:true});
    return json({ok:true,settings});
  }
  const restrictionRoute=url.pathname.match(/^\/api\/admin\/members\/([^/]+)\/restriction$/);
  if(restrictionRoute){
    if(!(await hasPerm(env,s.account_id,'account.manage')))return json({error:'FORBIDDEN'},403);
    const pid=decodeURIComponent(restrictionRoute[1]);
    if(!(await canAccessPerson(env,s.account_id,pid)))return json({error:'SCOPE_FORBIDDEN'},403);
    const target=await env.DB.prepare('SELECT a.id,a.email,p.full_name FROM accounts a JOIN people p ON p.id=a.person_id WHERE a.person_id=?').bind(pid).first();
    if(!target)return json({error:'ACCOUNT_NOT_FOUND'},404);
    if(req.method==='GET'){
      const row=await env.DB.prepare('SELECT restriction_type,reason,ends_at,created_at,updated_at FROM account_restrictions WHERE account_id=?').bind(target.id).first();
      return json({restriction:row||null});
    }
    if(req.method==='POST'){
      if(target.id===s.account_id)return json({error:'CANNOT_RESTRICT_SELF'},409);
      if(await isSuper(env,target.id))return json({error:'SUPER_ADMIN_PROTECTED'},403);
      const b=await bodyJson(req),type=clean(b.type,20),reason=clean(b.reason,500);
      if(!['ban','unban'].includes(type))return json({error:'INVALID_RESTRICTION'},400);
      if(type==='ban'){
        const end=clean(b.ends_at,35)||null;
        if(!reason)return json({error:'REASON_REQUIRED'},400);
        if(end){
          const localToday=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
          if(!/^\d{4}-\d{2}-\d{2}$/.test(end)||Number.isNaN(Date.parse(end+'T00:00:00Z'))||new Date(end+'T00:00:00Z').toISOString().slice(0,10)!==end||end<localToday)return json({error:'INVALID_END_DATE'},400);
        }
        await env.DB.prepare("INSERT INTO account_restrictions(account_id,restriction_type,reason,ends_at,actor_account_id,updated_at) VALUES(?,'ban',?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(account_id) DO UPDATE SET restriction_type='ban',reason=excluded.reason,ends_at=excluded.ends_at,actor_account_id=excluded.actor_account_id,updated_at=CURRENT_TIMESTAMP").bind(target.id,reason,end,s.account_id).run();
        await env.DB.prepare('DELETE FROM sessions WHERE account_id=?').bind(target.id).run();
      }else{
        await env.DB.prepare('DELETE FROM account_restrictions WHERE account_id=?').bind(target.id).run();
      }
      await audit(env,s.account_id,type==='ban'?'account_banned':'account_unbanned','account',target.id,null,{reason,ends_at:clean(b.ends_at,35)||null});
      let mail={sent:false,reason:'NOT_REQUESTED'};
      if(b.notify===true&&target.email){
        mail=await sendMemberEmail(env,{to:target.email,subject:type==='ban'?'[Sky First] Thông báo giới hạn tài khoản':'[Sky First] Tài khoản đã được mở lại',html:memberEmailHtml({title:type==='ban'?'Thông báo giới hạn tài khoản':'Tài khoản được khôi phục',name:target.full_name,intro:type==='ban'?'Tài khoản hiện không thể đăng nhập theo quyết định quản trị.':'Quyền truy cập đã được khôi phục.',status:type==='ban'?'TẠM NGƯNG TRUY CẬP':'ĐƯỢC KHÔI PHỤC',body:type==='ban'?`Lý do: ${reason}. ${clean(b.ends_at,35)?'Thời hạn đến hết ngày '+clean(b.ends_at,35):'Không xác định thời hạn'}. Có thể liên hệ support@skyfirst.io.vn để yêu cầu xem xét.`:'Bạn có thể tiếp tục đăng nhập vào hệ thống.',ctaUrl:env.APP_URL||'https://member.skyfirst.io.vn',ctaLabel:'Trung tâm thành viên số'})});
      }
      return json({ok:true,type,email_sent:mail.sent===true});
    }
  }

  if(url.pathname==='/api/me/security/sessions'&&req.method==='GET'){
    const r=await env.DB.prepare(`SELECT id,created_at,last_seen_at,user_agent,ip_hint,expires_at,CASE WHEN id=? THEN 1 ELSE 0 END current FROM sessions WHERE account_id=? AND expires_at>CURRENT_TIMESTAMP ORDER BY last_seen_at DESC`).bind(s.session_id,s.account_id).all();
    return json({items:r.results||[]});
  }
  if(url.pathname==='/api/me/security/events'&&req.method==='GET'){
    await ensureSecurityTables(env);const r=await env.DB.prepare(`SELECT event_type,ip_hint,user_agent,created_at FROM security_events WHERE account_id=? ORDER BY created_at DESC LIMIT 100`).bind(s.account_id).all();return json({items:r.results||[]});
  }
  const revokeMatch=url.pathname.match(/^\/api\/me\/security\/sessions\/([^/]+)$/);
  if(revokeMatch&&req.method==='DELETE'){
    const sid=decodeURIComponent(revokeMatch[1]);await env.DB.prepare(`DELETE FROM sessions WHERE id=? AND account_id=?`).bind(sid,s.account_id).run();await safeSecurityEvent(env,s.account_id,'session_revoked',req,{session_id:sid});return json({ok:true,current:sid===s.session_id});
  }
  if(url.pathname==='/api/me/security/revoke-others'&&req.method==='POST'){
    await env.DB.prepare(`DELETE FROM sessions WHERE account_id=? AND id<>?`).bind(s.account_id,s.session_id).run();await safeSecurityEvent(env,s.account_id,'other_sessions_revoked',req);return json({ok:true});
  }

  // Directory is isolated by ACTIVE shared unit membership. Network admins may see all.
  if(url.pathname==='/api/directory'&&req.method==='GET'){
    const q=clean(url.searchParams.get('q'),100);
    const limit=Math.min(100,Math.max(10,Number(url.searchParams.get('limit')||50)));
    if(await isNetworkAdmin(env,s.account_id)){
      const r=await env.DB.prepare(`SELECT DISTINCT p.id,p.member_code,p.display_name,p.full_name,p.avatar_url,p.status FROM people p WHERE p.status='active' AND (?='' OR p.full_name LIKE ? OR p.display_name LIKE ? OR p.member_code LIKE ?) ORDER BY p.full_name LIMIT ?`).bind(q,`%${q}%`,`%${q}%`,`%${q}%`,limit).all();
      return json({items:r.results||[],scope:'network'});
    }
    const r=await env.DB.prepare(`
      SELECT DISTINCT p.id,p.member_code,p.display_name,p.full_name,p.avatar_url,p.status,
        GROUP_CONCAT(DISTINCT o.name) shared_units
      FROM accounts me
      JOIN org_memberships mine ON mine.person_id=me.person_id AND mine.status='active'
      JOIN org_memberships theirs ON theirs.org_node_id=mine.org_node_id AND theirs.status='active'
      JOIN people p ON p.id=theirs.person_id AND p.status='active'
      JOIN org_nodes o ON o.id=mine.org_node_id
      WHERE me.id=? AND (?='' OR p.full_name LIKE ? OR p.display_name LIKE ? OR p.member_code LIKE ?)
      GROUP BY p.id
      ORDER BY p.full_name LIMIT ?
    `).bind(s.account_id,q,`%${q}%`,`%${q}%`,`%${q}%`,limit).all();
    return json({items:r.results||[],scope:'shared_unit'});
  }

  // =========================================================
  // MY PROFILE
  // =========================================================

  if(url.pathname==='/api/me'&&req.method==='GET'){
    const person=await env.DB.prepare(
      'SELECT * FROM people WHERE id=?'
    ).bind(s.person_id).first();

    const memberships=await env.DB.prepare(`
      SELECT
        m.*,
        o.name org_name,
        o.short_name,
        o.node_type
      FROM org_memberships m
      JOIN org_nodes o
        ON o.id=m.org_node_id
      WHERE m.person_id=?
        AND COALESCE(m.status,'active') NOT IN ('hidden','suspended')
      ORDER BY
        m.is_primary DESC,
        m.started_at DESC
    `).bind(s.person_id).all();

    const cards=await env.DB.prepare(`
      SELECT
        c.*,
        t.name card_type_name,
        t.code card_type_code,
        o.name org_name
      FROM member_cards c
      JOIN card_types t
        ON t.id=c.card_type_id
      LEFT JOIN org_nodes o
        ON o.id=c.org_node_id
      WHERE c.person_id=?
      ORDER BY
        c.status='active' DESC,
        c.issued_at DESC
    `).bind(s.person_id).all();

    const perms=await env.DB.prepare(`
      SELECT DISTINCT p.code
      FROM account_scopes s
      JOIN role_permissions rp
        ON rp.role_id=s.role_id
      JOIN permissions p
        ON p.id=rp.permission_id
      WHERE s.account_id=?
        AND s.active=1
    `).bind(s.account_id).all();

    const scopes=await env.DB.prepare(`
      SELECT
        s.id,
        r.code role_code,
        r.name role_name,
        s.org_node_id,
        o.name org_name
      FROM account_scopes s
      JOIN roles r
        ON r.id=s.role_id
      LEFT JOIN org_nodes o
        ON o.id=s.org_node_id
      WHERE s.account_id=?
        AND s.active=1
    `).bind(s.account_id).all();

    const scopeRows=scopes.results||[];

    const is_member=
      scopeRows.some(x=>x.role_code==='MEMBER');

    return json({
      person,
      memberships:memberships.results||[],
      cards:cards.results||[],
      permissions:
        (perms.results||[]).map(x=>x.code),
      scopes:scopeRows,
      is_member,
      is_super:
        await isSuper(env,s.account_id),
      force_password_change:
        !!s.force_password_change
    });
  }

  if(url.pathname==='/api/me'&&req.method==='PATCH'){
    const b=await bodyJson(req);
    const current=await env.DB.prepare('SELECT * FROM people WHERE id=?').bind(s.person_id).first();
    if(!current)return json({error:'PROFILE_NOT_FOUND'},404);

    const take=(key,max,lower=false)=>{
      if(!Object.prototype.hasOwnProperty.call(b,key))return current[key]??'';
      const v=clean(b[key],max);
      return lower?v.toLowerCase():v;
    };

    const next={
      full_name:take('full_name',160),
      display_name:take('display_name',160),
      date_of_birth:take('date_of_birth',20),
      gender:take('gender',50),
      nationality:take('nationality',80),
      id_number:take('id_number',80),
      id_issue_date:take('id_issue_date',20),
      id_issue_place:take('id_issue_place',200),
      email:take('email',200,true),
      phone:take('phone',50),
      permanent_address:take('permanent_address',500),
      temporary_address:take('temporary_address',500),
      education_or_work_type:take('education_or_work_type',50),
      school_or_workplace:take('school_or_workplace',240),
      class_or_major:take('class_or_major',240),
      education_status:take('education_status',80),
      // Không chọn ảnh mới = giữ nguyên ảnh cũ.
      avatar_url:Object.prototype.hasOwnProperty.call(b,'avatar_url')
        ?(clean(b.avatar_url,1200)||current.avatar_url||'')
        :(current.avatar_url||'')
    };

    const required=[
      ['full_name','Họ và tên'],
      ['date_of_birth','Ngày sinh'],
      ['email','Email']
    ];
    for(const [key,label] of required){
      if(!next[key])return json({error:'PERSONAL_FIELD_REQUIRED',field:key,message:`Vui lòng nhập ${label}.`},400);
    }
    if(next.email&&!/^\S+@\S+\.\S+$/.test(next.email))return json({error:'EMAIL_INVALID',field:'email',message:'Email không hợp lệ.'},400);
    if(next.email!==String(current.email||''))return json({error:'EMAIL_CHANGE_REQUIRES_VERIFICATION',field:'email',message:'Email đăng nhập chỉ được thay đổi sau khi xác minh email mới. Vui lòng liên hệ support@skyfirst.io.vn để cập nhật an toàn.'},409);
    if(next.id_number&& !/^\d{12}$/.test(next.id_number))return json({error:'ID_NUMBER_MUST_BE_12_DIGITS',field:'id_number',message:'CCCD phải gồm đúng 12 chữ số.'},400);

    try{
      await env.DB.batch([
        env.DB.prepare(`
          UPDATE people SET
            full_name=?,display_name=?,date_of_birth=?,gender=?,nationality=?,id_number=?,id_issue_date=?,id_issue_place=?,
            email=?,phone=?,permanent_address=?,temporary_address=?,education_or_work_type=?,school_or_workplace=?,class_or_major=?,
            education_status=?,avatar_url=?,updated_at=CURRENT_TIMESTAMP
          WHERE id=?
        `).bind(
          next.full_name,next.display_name||null,next.date_of_birth||null,next.gender||null,next.nationality||null,next.id_number||null,
          next.id_issue_date||null,next.id_issue_place||null,next.email||null,next.phone||null,next.permanent_address||null,
          next.temporary_address||null,next.education_or_work_type||null,next.school_or_workplace||null,next.class_or_major||null,
          next.education_status||null,next.avatar_url||null,s.person_id
        ),
        env.DB.prepare(`UPDATE accounts SET email=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(next.email||null,s.account_id)
      ]);
      await audit(env,s.account_id,'profile_updated','person',s.person_id,null,{fields:Object.keys(b||{})});
      return json({ok:true,person:next});
    }catch(err){
      const msg=String(err?.message||err);
      if(/unique/i.test(msg)&&/email/i.test(msg))return json({error:'EMAIL_ALREADY_USED',message:'Email này đã được sử dụng.'},409);
      return json({error:'PROFILE_UPDATE_FAILED',detail:msg},500);
    }
  }

  if(url.pathname==='/api/me/password'&&req.method==='POST'){
    const b=await bodyJson(req);

    const old=String(b.current_password||'');
    const pw=String(b.new_password||'');

    if(pw.length<10){
      return json({
        error:'PASSWORD_TOO_SHORT'
      },400);
    }

    const a=await env.DB.prepare(`
      SELECT *
      FROM accounts
      WHERE id=?
    `).bind(s.account_id).first();

    const forcedChange=Number(s.force_password_change||0)===1;
    const currentOK=forcedChange || await verifyPassword(
      old,
      a.password_salt,
      a.password_iterations,
      a.password_hash
    );

    if(!currentOK){
      return json({
        error:'CURRENT_PASSWORD_INVALID'
      },401);
    }

    const salt=token();
    const it=100000;
    const hash=await pbkdf2(pw,salt,it);

    await env.DB.batch([
      env.DB.prepare(`
        UPDATE accounts
        SET
          password_hash=?,
          password_salt=?,
          password_iterations=?,
          force_password_change=0,
          updated_at=CURRENT_TIMESTAMP
        WHERE id=?
      `).bind(
        hash,
        salt,
        it,
        s.account_id
      ),

      env.DB.prepare(`
        DELETE FROM sessions
        WHERE account_id=?
          AND id!=?
      `).bind(
        s.account_id,
        s.session_id
      )
    ]);

    await audit(
      env,
      s.account_id,
      'password_changed',
      'account',
      s.account_id
    );

    return json({ok:true});
  }

  // =========================================================
  // AVATAR
  // =========================================================

  if(url.pathname==='/api/me/avatar'&&req.method==='POST'){
    const ct=
      (req.headers.get('content-type')||'')
        .toLowerCase();

    if(![
      'image/jpeg',
      'image/png',
      'image/webp'
    ].includes(ct)){
      return json({
        error:'IMAGE_TYPE_NOT_ALLOWED'
      },415);
    }

    const data=await req.arrayBuffer();

    if(
      !data.byteLength||
      data.byteLength>900000
    ){
      return json({
        error:'IMAGE_TOO_LARGE'
      },413);
    }

    const ext=
      ct==='image/png'
        ?'png'
        :ct==='image/webp'
          ?'webp'
          :'jpg';

    const key=
      `avatars/${s.person_id}/`+
      `${Date.now()}.${ext}`;

    await env.FILES.put(
      key,
      data,
      {
        httpMetadata:{
          contentType:ct,
          cacheControl:
            'public, max-age=31536000, immutable'
        }
      }
    );

    const fileUrl=`/files/${key}`;

    await env.DB.prepare(`
      UPDATE people
      SET
        avatar_url=?,
        updated_at=CURRENT_TIMESTAMP
      WHERE id=?
    `).bind(
      fileUrl,
      s.person_id
    ).run();

    await audit(
      env,
      s.account_id,
      'avatar_uploaded',
      'person',
      s.person_id
    );

    return json({
      ok:true,
      url:fileUrl
    });
  }

  // =========================================================
  // DASHBOARD
  // =========================================================

  if(url.pathname==='/api/dashboard'&&req.method==='GET'){
    const [g,t,a,c,h,n]=await Promise.all([
      env.DB.prepare(`
        SELECT
          period_type,
          ROUND(AVG(progress)) progress
        FROM goals
        WHERE person_id=?
          AND status='active'
        GROUP BY period_type
      `).bind(s.person_id).all(),

      env.DB.prepare(`
        SELECT COUNT(*) total
        FROM tasks
        WHERE person_id=?
          AND status!='cancelled'
      `).bind(s.person_id).first(),

      env.DB.prepare(`
        SELECT COUNT(*) total
        FROM activity_participants
        WHERE person_id=?
      `).bind(s.person_id).first(),

      env.DB.prepare(`
        SELECT COUNT(*) total
        FROM certificates
        WHERE person_id=?
          AND verification_status='verified'
      `).bind(s.person_id).first(),

      env.DB.prepare(`
        SELECT COUNT(*) total
        FROM achievements
        WHERE person_id=?
          AND verification_status='verified'
      `).bind(s.person_id).first(),

      env.DB.prepare(`
        SELECT COUNT(*) total
        FROM notifications
        WHERE person_id=?
          AND read_at IS NULL
      `).bind(s.person_id).first()
    ]);

    return json({
      goals:g.results||[],
      tasks:t?.total||0,
      activities:a?.total||0,
      certificates:c?.total||0,
      achievements:h?.total||0,
      unread:n?.total||0
    });
  }

  const selfLists={
    '/api/me/goals':`
      SELECT *
      FROM goals
      WHERE person_id=?
      ORDER BY created_at DESC
      LIMIT 200
    `,

    '/api/me/tasks':`
      SELECT *
      FROM tasks
      WHERE person_id=?
      ORDER BY created_at DESC
      LIMIT 200
    `,

    '/api/me/certificates':`
      SELECT *
      FROM certificates
      WHERE person_id=?
      ORDER BY
        COALESCE(issued_at,created_at) DESC
      LIMIT 300
    `,

    '/api/me/achievements':`
      SELECT *
      FROM achievements
      WHERE person_id=?
        AND COALESCE(verification_status,'verified')!='hidden'
      ORDER BY
        COALESCE(achieved_at,created_at) DESC
      LIMIT 300
    `,

    '/api/me/documents':`
      SELECT *
      FROM member_documents
      WHERE person_id=?
        AND COALESCE(visibility,'private')!='hidden'
      ORDER BY created_at DESC
      LIMIT 300
    `,

    '/api/me/notifications':`
      SELECT *
      FROM notifications
      WHERE person_id=?
      ORDER BY created_at DESC
      LIMIT 300
    `
  };

  if(
    selfLists[url.pathname]&&
    req.method==='GET'
  ){
    const r=await env.DB.prepare(
      selfLists[url.pathname]
    ).bind(s.person_id).all();

    return json({
      items:r.results||[]
    });
  }

  if(
    url.pathname==='/api/me/activities'&&
    req.method==='GET'
  ){
    const r=await env.DB.prepare(`
      SELECT
        a.*,
        ap.role_label,
        ap.result,
        ap.verification_status,
        o.name org_name
      FROM activity_participants ap
      JOIN activities a
        ON a.id=ap.activity_id
      LEFT JOIN org_nodes o
        ON o.id=a.org_node_id
      WHERE ap.person_id=?
        AND COALESCE(ap.verification_status,'confirmed')!='hidden'
      ORDER BY
        COALESCE(
          a.starts_at,
          a.created_at
        ) DESC
      LIMIT 300
    `).bind(s.person_id).all();

    return json({
      items:r.results||[]
    });
  }

  if(url.pathname==='/api/me/evaluations'&&req.method==='GET'){
    await ensureEvaluations(env);
    const r=await env.DB.prepare(`
      SELECT e.id,e.period_type,e.period_label,e.criteria_json,e.total_score,e.rating,e.comments,e.status,e.finalized_at,e.created_at,
             o.name org_name,a.username evaluator_username
      FROM member_evaluations e
      LEFT JOIN org_nodes o ON o.id=e.org_node_id
      LEFT JOIN accounts a ON a.id=e.evaluator_account_id
      WHERE e.person_id=? AND e.status='final' AND e.visibility='member'
      ORDER BY COALESCE(e.finalized_at,e.created_at) DESC
    `).bind(s.person_id).all();
    return json({items:r.results||[]});
  }

  // =========================================================
  // SELF COMPATIBILITY / AGGREGATED VIEWS
  // =========================================================

  if(url.pathname==='/api/me/cards'&&req.method==='GET'){
    const r=await env.DB.prepare(`
      SELECT c.*,t.name card_type_name,t.code card_type_code,t.template_json card_template_json,o.name org_name
      FROM member_cards c
      JOIN card_types t ON t.id=c.card_type_id
      LEFT JOIN org_nodes o ON o.id=c.org_node_id
      WHERE c.person_id=?
      ORDER BY c.status='active' DESC,c.issued_at DESC,c.created_at DESC
    `).bind(s.person_id).all();
    return json({items:r.results||[]});
  }

  if(url.pathname==='/api/me/history'&&req.method==='GET'){
    const r=await env.DB.prepare(`
      SELECT m.*,o.name org_name,o.short_name,o.node_type
      FROM org_memberships m
      JOIN org_nodes o ON o.id=m.org_node_id
      WHERE m.person_id=? AND COALESCE(m.status,'active')!='suspended'
      ORDER BY COALESCE(m.started_at,m.created_at) DESC
    `).bind(s.person_id).all();
    return json({items:r.results||[]});
  }

  if(url.pathname==='/api/me/cv'&&req.method==='GET'){
    const [person,memberships,activities,certificates,achievements]=await Promise.all([
      env.DB.prepare('SELECT * FROM people WHERE id=?').bind(s.person_id).first(),
      env.DB.prepare(`
        SELECT m.*,o.name org_name,o.short_name,o.node_type
        FROM org_memberships m JOIN org_nodes o ON o.id=m.org_node_id
        WHERE m.person_id=? AND COALESCE(m.status,'active')!='suspended'
        ORDER BY COALESCE(m.started_at,m.created_at) DESC
      `).bind(s.person_id).all(),
      env.DB.prepare(`
        SELECT a.*,ap.role_label,ap.result,ap.verification_status,o.name org_name
        FROM activity_participants ap JOIN activities a ON a.id=ap.activity_id
        LEFT JOIN org_nodes o ON o.id=a.org_node_id
        WHERE ap.person_id=? AND COALESCE(ap.verification_status,'confirmed')!='hidden'
        ORDER BY COALESCE(a.starts_at,a.created_at) DESC
      `).bind(s.person_id).all(),
      env.DB.prepare(`
        SELECT * FROM certificates WHERE person_id=?
        ORDER BY COALESCE(issued_at,created_at) DESC
      `).bind(s.person_id).all(),
      env.DB.prepare(`
        SELECT * FROM achievements WHERE person_id=?
          AND COALESCE(verification_status,'verified')!='hidden'
        ORDER BY COALESCE(achieved_at,created_at) DESC
      `).bind(s.person_id).all()
    ]);
    return json({
      person,
      memberships:memberships.results||[],
      activities:activities.results||[],
      certificates:certificates.results||[],
      achievements:achievements.results||[]
    });
  }

  if(url.pathname==='/api/me/journey'&&req.method==='GET'){
    if(!s.person_id)return json({items:[]});
    const [m,a,c,h]=await Promise.all([
      env.DB.prepare(`SELECT 'membership' kind,COALESCE(m.started_at,m.created_at) event_at,COALESCE(m.role_label,'Thành viên') title,o.name subtitle,m.status status FROM org_memberships m JOIN org_nodes o ON o.id=m.org_node_id WHERE m.person_id=?`).bind(s.person_id).all(),
      env.DB.prepare(`SELECT 'activity' kind,COALESCE(a.starts_at,a.created_at) event_at,a.name title,COALESCE(ap.role_label,o.name,'Hoạt động') subtitle,ap.verification_status status FROM activity_participants ap JOIN activities a ON a.id=ap.activity_id LEFT JOIN org_nodes o ON o.id=a.org_node_id WHERE ap.person_id=?`).bind(s.person_id).all(),
      env.DB.prepare(`SELECT 'certificate' kind,COALESCE(issued_at,created_at) event_at,title,issuer subtitle,verification_status status FROM certificates WHERE person_id=?`).bind(s.person_id).all(),
      env.DB.prepare(`SELECT 'achievement' kind,COALESCE(achieved_at,created_at) event_at,title,COALESCE(issuer,'Sky First Network') subtitle,verification_status status FROM achievements WHERE person_id=?`).bind(s.person_id).all()
    ]);
    const items=[...(m.results||[]),...(a.results||[]),...(c.results||[]),...(h.results||[])].filter(x=>x.event_at).sort((x,y)=>String(y.event_at).localeCompare(String(x.event_at))).slice(0,300);
    return json({items});
  }

  // =========================================================
  // PERSONAL GOALS
  // =========================================================

  if(url.pathname==='/api/me/goals'&&req.method==='POST'){
    const b=await bodyJson(req);

    const period=clean(b.period_type,20);
    const title=clean(b.title,240);

    if(
      !['week','month','quarter','year'].includes(period)||
      !title
    ){
      return json({
        error:'INVALID_DATA'
      },400);
    }

    const id=uid('goal');

    await env.DB.prepare(`
      INSERT INTO goals(
        id,
        person_id,
        org_node_id,
        period_type,
        title,
        description,
        priority,
        progress,
        status,
        starts_at,
        due_at,
        created_by_account_id
      )
      VALUES(
        ?,?,
        NULL,
        ?,?,?,?,?,?,?,?,?
      )
    `).bind(
      id,
      s.person_id,
      period,
      title,
      clean(b.description,2000)||null,
      clean(b.priority,30)||'normal',
      Math.max(
        0,
        Math.min(100,Number(b.progress||0))
      ),
      clean(b.status,30)||'active',
      clean(b.starts_at,20)||null,
      clean(b.due_at,20)||null,
      s.account_id
    ).run();

    await audit(
      env,
      s.account_id,
      'goal_created',
      'goal',
      id,
      null,
      {personal:true}
    );

    return json({ok:true,id});
  }

  const myGoal=
    url.pathname.match(
      /^\/api\/me\/goals\/([^/]+)$/
    );

  if(myGoal&&req.method==='PATCH'){
    const id=
      decodeURIComponent(myGoal[1]);

    const g=await env.DB.prepare(`
      SELECT *
      FROM goals
      WHERE id=?
        AND person_id=?
    `).bind(
      id,
      s.person_id
    ).first();

    if(!g){
      return json({error:'NOT_FOUND'},404);
    }

    const b=await bodyJson(req);

    const progress=
      Object.prototype.hasOwnProperty.call(
        b,
        'progress'
      )
        ?Math.max(
            0,
            Math.min(100,Number(b.progress))
          )
        :g.progress;

    const status=
      Object.prototype.hasOwnProperty.call(
        b,
        'status'
      )
        ?clean(b.status,30)
        :g.status;

    if(![
      'active',
      'completed',
      'cancelled'
    ].includes(status)){
      return json({
        error:'INVALID_STATUS'
      },400);
    }

    await env.DB.prepare(`
      UPDATE goals
      SET
        progress=?,
        status=?,
        updated_at=CURRENT_TIMESTAMP
      WHERE id=?
        AND person_id=?
    `).bind(
      progress,
      status,
      id,
      s.person_id
    ).run();

    return json({ok:true});
  }

  // =========================================================
  // PERSONAL TASKS
  // =========================================================

  if(url.pathname==='/api/me/tasks'&&req.method==='POST'){
    const b=await bodyJson(req);
    const title=clean(b.title,240);

    if(!title){
      return json({
        error:'INVALID_DATA'
      },400);
    }

    const id=uid('task');

    await env.DB.prepare(`
      INSERT INTO tasks(
        id,
        person_id,
        org_node_id,
        goal_id,
        title,
        description,
        priority,
        progress,
        status,
        due_at,
        assigned_by_account_id
      )
      VALUES(
        ?,?,
        NULL,
        ?,?,?,?,?,?,?,
        NULL
      )
    `).bind(
      id,
      s.person_id,
      clean(b.goal_id,120)||null,
      title,
      clean(b.description,2000)||null,
      clean(b.priority,30)||'normal',
      Math.max(
        0,
        Math.min(100,Number(b.progress||0))
      ),
      clean(b.status,30)||'todo',
      clean(b.due_at,20)||null
    ).run();

    await audit(
      env,
      s.account_id,
      'task_created',
      'task',
      id,
      null,
      {personal:true}
    );

    return json({ok:true,id});
  }

  const myTask=
    url.pathname.match(
      /^\/api\/me\/tasks\/([^/]+)$/
    );

  if(myTask&&req.method==='PATCH'){
    const id=
      decodeURIComponent(myTask[1]);

    const t=await env.DB.prepare(`
      SELECT *
      FROM tasks
      WHERE id=?
        AND person_id=?
    `).bind(
      id,
      s.person_id
    ).first();

    if(!t){
      return json({
        error:'NOT_FOUND'
      },404);
    }

    const b=await bodyJson(req);

    const progress=
      Object.prototype.hasOwnProperty.call(
        b,
        'progress'
      )
        ?Math.max(
            0,
            Math.min(100,Number(b.progress))
          )
        :t.progress;

    const status=
      Object.prototype.hasOwnProperty.call(
        b,
        'status'
      )
        ?clean(b.status,30)
        :t.status;

    if(![
      'todo',
      'doing',
      'done',
      'cancelled'
    ].includes(status)){
      return json({
        error:'INVALID_STATUS'
      },400);
    }

    await env.DB.prepare(`
      UPDATE tasks
      SET
        progress=?,
        status=?,
        updated_at=CURRENT_TIMESTAMP
      WHERE id=?
        AND person_id=?
    `).bind(
      progress,
      status,
      id,
      s.person_id
    ).run();

    return json({ok:true});
  }

  // =========================================================
  // EXTERNAL CERTIFICATE
  // =========================================================

  if(
    url.pathname==='/api/me/certificate-file'&&
    req.method==='POST'
  ){
    const ct=
      (req.headers.get('content-type')||'')
        .toLowerCase();

    if(ct!=='application/pdf'){
      return json({error:'PDF_ONLY'},415);
    }

    const data=await req.arrayBuffer();

    if(
      !data.byteLength||
      data.byteLength>10*1024*1024
    ){
      return json({
        error:'PDF_TOO_LARGE'
      },413);
    }

    const key=
      `certificates/external/`+
      `${s.person_id}/`+
      `${new Date().toISOString().slice(0,10)}/`+
      `${crypto.randomUUID()}.pdf`;

    await env.FILES.put(
      key,
      data,
      {
        httpMetadata:{
          contentType:'application/pdf',
          contentDisposition:'inline'
        }
      }
    );

    return json({
      ok:true,
      url:`/files/${key}`
    });
  }

  if(
    url.pathname==='/api/me/certificates/external'&&
    req.method==='POST'
  ){
    const b=await bodyJson(req);

    const title=clean(b.title,240);
    const issuer=clean(b.issuer,240);

    if(!title||!issuer){
      return json({
        error:'INVALID_DATA'
      },400);
    }

    const id=uid('certificate');

    await env.DB.prepare(`
      INSERT INTO certificates(
        id,
        person_id,
        org_node_id,
        certificate_no,
        title,
        issuer,
        issued_at,
        source_type,
        verification_status,
        file_url,
        verify_code,
        metadata_json
      )
      VALUES(
        ?,?,
        NULL,
        ?,?,?,?,
        'external',
        'pending',
        ?,
        NULL,
        ?
      )
    `).bind(
      id,
      s.person_id,
      clean(b.certificate_no,160)||null,
      title,
      issuer,
      clean(b.issued_at,20)||null,
      clean(b.file_url,1200)||null,
      JSON.stringify({
        notes:clean(b.notes,2000)
      })
    ).run();

    await audit(
      env,
      s.account_id,
      'external_certificate_submitted',
      'certificate',
      id
    );

    return json({ok:true,id});
  }

  const readNotif=
    url.pathname.match(
      /^\/api\/me\/notifications\/([^/]+)\/read$/
    );

  if(readNotif&&req.method==='POST'){
    await env.DB.prepare(`
      UPDATE notifications
      SET
        read_at=
          COALESCE(
            read_at,
            CURRENT_TIMESTAMP
          )
      WHERE id=?
        AND person_id=?
    `).bind(
      decodeURIComponent(readNotif[1]),
      s.person_id
    ).run();

    return json({ok:true});
  }

  // =========================================================
  // SUPPORT
  // =========================================================

  if(url.pathname==='/api/me/support'&&req.method==='POST'){
    const b=await bodyJson(req);

    const id=uid('ticket');

    const code=
      `SP-${new Date().getUTCFullYear()}-`+
      `${String(Date.now()).slice(-6)}`;

    if(
      !clean(b.subject,200)||
      !clean(b.body,3000)
    ){
      return json({
        error:'INVALID_DATA'
      },400);
    }

    await env.DB.prepare(`
      INSERT INTO support_tickets(
        id,
        ticket_code,
        person_id,
        category,
        subject,
        body,
        status
      )
      VALUES(
        ?,?,?,?,?,?,
        'received'
      )
    `).bind(
      id,
      code,
      s.person_id,
      clean(b.category,80)||'other',
      clean(b.subject,200),
      clean(b.body,3000)
    ).run();

    return json({
      ok:true,
      ticket_code:code
    });
  }

  // =========================================================
  // ADMIN ORG
  // =========================================================

  if(url.pathname==='/api/admin/org'&&req.method==='GET'){
    if(!(await hasPerm(
      env,
      s.account_id,
      'org.manage'
    ))){
      return json({error:'FORBIDDEN'},403);
    }

    const r=await env.DB.prepare(`
      SELECT *
      FROM org_nodes
      ORDER BY
        COALESCE(parent_id,''),
        sort_order,
        name
    `).all();

    const items=[];
    for(const o of r.results||[])if(!o.deleted_at&&await canAccessOrg(env,s.account_id,o.id))items.push(o);
    return json({items});
  }

  if(url.pathname==='/api/admin/org'&&req.method==='POST'){
    if(!(await hasPerm(
      env,
      s.account_id,
      'org.manage'
    ))){
      return json({error:'FORBIDDEN'},403);
    }

    const b=await bodyJson(req);

    const id=uid('org');
    const parent=clean(b.parent_id,100)||'org_sfn';
    if(b.node_type==='digital_member_center')b.name='Trung Tâm Thành Viên Số Sky First';
    if(!Number.isFinite(Number(b.sort_order||0)))return json({error:'INVALID_SORT_ORDER'},400);

    if(
      !clean(b.code,80)||
      !clean(b.name,200)
    ){
      return json({
        error:'INVALID_DATA'
      },400);
    }

    if(!(await canAccessOrg(
      env,
      s.account_id,
      parent
    ))){
      return json({
        error:'SCOPE_FORBIDDEN'
      },403);
    }

    const parentNode=await env.DB.prepare(`SELECT id FROM org_nodes WHERE id=? AND deleted_at IS NULL AND status='active'`).bind(parent).first();
    if(!parentNode)return json({error:'INVALID_PARENT'},400);
    const duplicate=await env.DB.prepare(`SELECT id FROM org_nodes WHERE code=? COLLATE NOCASE`).bind(clean(b.code,80)).first();
    if(duplicate)return json({error:'ORG_CODE_ALREADY_EXISTS'},409);
    await env.DB.prepare(`
      INSERT INTO org_nodes(
        id,
        parent_id,
        code,
        name,
        short_name,
        node_type,
        status,
        sort_order
      )
      VALUES(?,?,?,?,?,?,?,?)
    `).bind(
      id,
      parent,
      clean(b.code,80),
      clean(b.name,200),
      clean(b.short_name,80)||null,
      clean(b.node_type,80)||'unit',
      'active',
      Number(b.sort_order||0)
    ).run();

    await audit(
      env,
      s.account_id,
      'org_created',
      'org_node',
      id,
      parent,
      {
        code:b.code,
        name:b.name
      }
    );

    return json({ok:true,id});
  }

  const orgItem=url.pathname.match(/^\/api\/admin\/org\/([^/]+)$/);
  if(orgItem&&req.method==='PATCH'){
    if(!(await hasPerm(env,s.account_id,'org.manage')))return json({error:'FORBIDDEN'},403);const id=decodeURIComponent(orgItem[1]);if(!(await canAccessOrg(env,s.account_id,id)))return json({error:'SCOPE_FORBIDDEN'},403);const b=await bodyJson(req),cur=await env.DB.prepare(`SELECT * FROM org_nodes WHERE id=?`).bind(id).first();if(!cur)return json({error:'NOT_FOUND'},404);const parent=clean(b.parent_id,100)||cur.parent_id;if(cur.deleted_at)return json({error:'NOT_FOUND'},404);if(id==='org_sfn'&&parent)return json({error:'ROOT_PARENT_FORBIDDEN'},409);if(parent){const p=await env.DB.prepare(`SELECT id FROM org_nodes WHERE id=? AND deleted_at IS NULL`).bind(parent).first();if(!p)return json({error:'INVALID_PARENT'},400);const cycle=await env.DB.prepare(`WITH RECURSIVE descendants(id) AS (SELECT id FROM org_nodes WHERE id=? UNION SELECT o.id FROM org_nodes o JOIN descendants d ON o.parent_id=d.id) SELECT 1 FROM descendants WHERE id=?`).bind(id,parent).first();if(cycle)return json({error:'ORG_CYCLE_FORBIDDEN'},409)}if(b.node_type==='digital_member_center'||cur.node_type==='digital_member_center'){b.name='Trung Tâm Thành Viên Số Sky First';b.node_type='digital_member_center'}if(parent&&parent!==cur.parent_id&&!(await canAccessOrg(env,s.account_id,parent)))return json({error:'SCOPE_FORBIDDEN'},403);await env.DB.prepare(`UPDATE org_nodes SET parent_id=?,name=?,short_name=?,node_type=?,status=?,description=?,founded_at=?,term_label=?,responsible_person_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(parent,clean(b.name,200)||cur.name,clean(b.short_name,80)||null,clean(b.node_type,80)||cur.node_type,clean(b.status,30)||cur.status,clean(b.description,2000)||null,clean(b.founded_at,20)||null,clean(b.term_label,100)||null,clean(b.responsible_person_id,100)||null,id).run();await audit(env,s.account_id,'org_updated','org_node',id,parent,{before:{name:cur.name,parent_id:cur.parent_id,status:cur.status}});return json({ok:true})
  }
  if(orgItem&&req.method==='DELETE'){
    if(!(await hasPerm(env,s.account_id,'org.delete')))return json({error:'FORBIDDEN'},403);const id=decodeURIComponent(orgItem[1]);if(id==='org_sfn')return json({error:'ROOT_CANNOT_BE_DELETED'},409);if(!(await canAccessOrg(env,s.account_id,id)))return json({error:'SCOPE_FORBIDDEN'},403);const cur=await env.DB.prepare(`SELECT parent_id FROM org_nodes WHERE id=?`).bind(id).first();if(!cur)return json({error:'NOT_FOUND'},404);const children=await env.DB.prepare(`SELECT COUNT(*) n FROM org_nodes WHERE parent_id=? AND deleted_at IS NULL`).bind(id).first();if(children?.n)return json({error:'ORG_HAS_CHILDREN'},409);await env.DB.prepare(`UPDATE org_nodes SET status='archived',deleted_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(id).run();await audit(env,s.account_id,'org_deleted','org_node',id,cur.parent_id);return json({ok:true})
  }

  // =========================================================
  // ADMIN BULK OPERATIONS
  // =========================================================
  if(url.pathname==='/api/admin/members/bulk'&&req.method==='POST'){
    const b=await bodyJson(req);
    const ids=Array.isArray(b.ids)?[...new Set(b.ids.map(x=>clean(x,100)).filter(Boolean))].slice(0,100):[];
    const action=clean(b.action,40);
    if(!ids.length)return json({error:'NO_MEMBERS_SELECTED'},400);
    if(ids.some(x=>!x))return json({error:'INVALID_MEMBER_ID'},400);

    const placeholders=ids.map(()=>'?').join(',');
    const rows=await env.DB.prepare(`SELECT p.id,p.full_name,p.member_code,a.id account_id,a.email,a.is_locked FROM people p LEFT JOIN accounts a ON a.person_id=p.id WHERE p.id IN (${placeholders})`).bind(...ids).all();
    const members=rows.results||[];
    if(!members.length)return json({error:'MEMBERS_NOT_FOUND'},404);
    for(const m of members)if(!(await canAccessPerson(env,s.account_id,m.id)))return json({error:'SCOPE_FORBIDDEN',member_id:m.id},403);

    const results=[];
    if(['lock','unlock'].includes(action)){
      if(!(await hasPerm(env,s.account_id,'account.manage')))return json({error:'FORBIDDEN'},403);
      const locked=action==='lock'?1:0;
      for(const m of members){
        if(m.account_id===s.account_id){results.push({id:m.id,ok:false,error:'CANNOT_LOCK_SELF'});continue;}
        if(await isSuper(env,m.account_id||'')){results.push({id:m.id,ok:false,error:'SUPER_ADMIN_PROTECTED'});continue;}
        await env.DB.prepare('UPDATE accounts SET is_locked=?,updated_at=CURRENT_TIMESTAMP WHERE person_id=?').bind(locked,m.id).run();
        if(locked&&m.account_id)await env.DB.prepare('DELETE FROM sessions WHERE account_id=?').bind(m.account_id).run();
        await audit(env,s.account_id,locked?'account_locked_bulk':'account_unlocked_bulk','account',m.account_id,null,{person_id:m.id,batch:true});
        results.push({id:m.id,ok:true});
      }
    } else if(['ban','unban'].includes(action)){
      if(!(await hasPerm(env,s.account_id,'account.manage')))return json({error:'FORBIDDEN'},403);
      if(action==='ban'&&!clean(b.reason,500))return json({error:'REASON_REQUIRED'},400);
      for(const m of members){
        if(m.account_id===s.account_id){results.push({id:m.id,ok:false,error:'CANNOT_RESTRICT_SELF'});continue;}
        if(await isSuper(env,m.account_id||'')){results.push({id:m.id,ok:false,error:'SUPER_ADMIN_PROTECTED'});continue;}
        if(action==='ban'){
          const end=clean(b.ends_at,35)||null;
          await env.DB.prepare("INSERT INTO account_restrictions(account_id,restriction_type,reason,ends_at,actor_account_id,updated_at) VALUES(?,'ban',?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(account_id) DO UPDATE SET restriction_type='ban',reason=excluded.reason,ends_at=excluded.ends_at,actor_account_id=excluded.actor_account_id,updated_at=CURRENT_TIMESTAMP").bind(m.account_id,clean(b.reason,500),end,s.account_id).run();
          if(m.account_id)await env.DB.prepare('DELETE FROM sessions WHERE account_id=?').bind(m.account_id).run();
        }else{
          await env.DB.prepare('DELETE FROM account_restrictions WHERE account_id=?').bind(m.account_id).run();
        }
        await audit(env,s.account_id,action==='ban'?'account_banned_bulk':'account_unbanned_bulk','account',m.account_id,null,{person_id:m.id,batch:true,reason:clean(b.reason,500)||null});
        results.push({id:m.id,ok:true});
      }
    } else if(action==='issue_card'){
      if(!(await hasPerm(env,s.account_id,'card.manage')))return json({error:'FORBIDDEN'},403);
      const cardType=clean(b.card_type_id,100)||'card_member';
      const org=clean(b.org_node_id,100)||'org_sfn';
      if(!(await canAccessOrg(env,s.account_id,org)))return json({error:'SCOPE_FORBIDDEN'},403);
      for(const m of members){
        const existing=await env.DB.prepare("SELECT id FROM member_cards WHERE person_id=? AND status='active' LIMIT 1").bind(m.id).first();
        if(existing){results.push({id:m.id,ok:false,error:'ACTIVE_CARD_EXISTS'});continue;}
        let cardNumber='';
        let unique=false;
        for(let i=0;i<5&&!unique;i++){
          cardNumber=`SFN-CARD-${crypto.randomUUID().replaceAll('-','').slice(0,10).toUpperCase()}`;
          unique=!(await env.DB.prepare('SELECT id FROM member_cards WHERE card_number=?').bind(cardNumber).first());
        }
        if(!unique){results.push({id:m.id,ok:false,error:'CARD_NUMBER_GENERATION_FAILED'});continue;}
        const cardId=uid('card'),verify=verifyCode('CARD');
        await env.DB.prepare(`INSERT INTO member_cards(id,person_id,card_type_id,org_node_id,card_number,title_on_card,issued_at,expires_at,status,verify_token) VALUES(?,?,?,?,?,?,?,?, 'active',?)`).bind(cardId,m.id,cardType,org,cardNumber,clean(b.title_on_card,180)||null,dateInVietnam(),clean(b.expires_at,20)||null,verify).run();
        await audit(env,s.account_id,'card_issued_bulk','member_card',cardId,org,{person_id:m.id,batch:true,verify_token:verify});
        results.push({id:m.id,ok:true,card_id:cardId,card_number:cardNumber});
      }
    } else {
      return json({error:'INVALID_BULK_ACTION'},400);
    }
    return json({ok:true,action,processed:members.length,success:results.filter(x=>x.ok).length,failed:results.filter(x=>!x.ok).length,results});
  }

  // =========================================================
  // ADMIN MEMBER LIST
  // =========================================================

  if(
    url.pathname==='/api/admin/members'&&
    req.method==='GET'
  ){
    if(!(await hasPerm(
      env,
      s.account_id,
      'member.view'
    ))){
      return json({error:'FORBIDDEN'},403);
    }

    const page=Math.max(
      1,
      Number(
        url.searchParams.get('page')||1
      )
    );

    const limit=Math.min(
      100,
      Math.max(
        10,
        Number(
          url.searchParams.get('limit')||50
        )
      )
    );

    const q=clean(
      url.searchParams.get('q'),
      100
    );

    const status=clean(
      url.searchParams.get('status'),
      30
    );

    const w=[
      `EXISTS (
        SELECT 1
        FROM accounts am
        JOIN account_scopes sm
          ON sm.account_id=am.id
         AND sm.active=1
        JOIN roles rm
          ON rm.id=sm.role_id
        WHERE am.person_id=p.id
          AND rm.code='MEMBER'
      )`
    ];

    const b=[];

    if(!(await isNetworkAdmin(
      env,
      s.account_id
    ))){
      w.push(`
        EXISTS (
          WITH RECURSIVE allowed(id) AS (
            SELECT sc.org_node_id
            FROM account_scopes sc
            JOIN roles rr
              ON rr.id=sc.role_id
            WHERE sc.account_id=?
              AND sc.active=1
              AND rr.code IN ('SCOPE_ADMIN','UNIT_ADMIN','DEPARTMENT_ADMIN')
              AND sc.org_node_id IS NOT NULL

            UNION

            SELECT o.id
            FROM org_nodes o
            JOIN allowed a
              ON o.parent_id=a.id
          )
          SELECT 1
          FROM org_memberships om
          JOIN allowed al
            ON al.id=om.org_node_id
          WHERE om.person_id=p.id
        )
      `);

      b.push(s.account_id);
    }

    if(q){
      w.push(`
        (
          p.full_name LIKE ?
          OR p.member_code LIKE ?
          OR p.email LIKE ?
          OR p.phone LIKE ?
        )
      `);

      b.push(
        `%${q}%`,
        `%${q}%`,
        `%${q}%`,
        `%${q}%`
      );
    }

    if(status){
      w.push('p.status=?');
      b.push(status);
    }

    const org=clean(url.searchParams.get('org'),100);
    if(org){w.push(`EXISTS (SELECT 1 FROM org_memberships omf WHERE omf.person_id=p.id AND omf.org_node_id=? AND omf.status='active')`);b.push(org)}

    const where=
      w.length
        ?`WHERE ${w.join(' AND ')}`
        :'';

    const totalRow=
      await env.DB.prepare(`
        SELECT COUNT(*) total
        FROM people p
        ${where}
      `).bind(...b).first();

    const total=totalRow?.total||0;

    const r=await env.DB.prepare(`
      SELECT
        p.id,
        p.member_code,
        p.full_name,
        p.email,
        p.phone,
        p.avatar_url,
        p.status,
        p.joined_at,
        a.username,
        a.is_locked,
        (SELECT o.name FROM org_memberships om JOIN org_nodes o ON o.id=om.org_node_id WHERE om.person_id=p.id AND om.status='active' ORDER BY om.is_primary DESC,om.created_at DESC LIMIT 1) org_name,
        (SELECT COALESCE(om.title,om.role_label) FROM org_memberships om WHERE om.person_id=p.id AND om.status='active' ORDER BY om.is_primary DESC,om.created_at DESC LIMIT 1) org_title
      FROM people p
      LEFT JOIN accounts a
        ON a.person_id=p.id
      ${where}
      ORDER BY p.created_at DESC
      LIMIT ?
      OFFSET ?
    `).bind(
      ...b,
      limit,
      (page-1)*limit
    ).all();

    return json({
      items:r.results||[],
      page,
      limit,
      total
    });
  }

  // =========================================================
  // ADMIN CREATE MEMBER
  // =========================================================

  if(
    url.pathname==='/api/admin/members'&&
    req.method==='POST'
  ){
    if(!(await hasPerm(
      env,
      s.account_id,
      'member.edit'
    ))){
      return json({error:'FORBIDDEN'},403);
    }

    const b=await bodyJson(req);
    const pw=String(b.password||'');

    const required=[
      'full_name',
      'display_name',
      'date_of_birth',
      'gender',
      'nationality',
      'id_number',
      'id_issue_date',
      'id_issue_place',
      'email',
      'phone',
      'permanent_address',
      'temporary_address',
      'education_or_work_type',
      'school_or_workplace',
      'education_status',
      'avatar_url',
      'username'
    ];

    for(const k of required){
      if(!clean(b[k],500)){
        return json({
          error:'ALL_PERSONAL_FIELDS_REQUIRED',
          field:k
        },400);
      }
    }

    if(pw.length<10){
      return json({
        error:'INVALID_DATA'
      },400);
    }

    if(
      !(await isNetworkAdmin(
        env,
        s.account_id
      ))&&
      (
        !b.org_node_id||
        !(await canAccessOrg(
          env,
          s.account_id,
          b.org_node_id
        ))
      )
    ){
      return json({
        error:'SCOPE_FORBIDDEN'
      },403);
    }

    const uname=
      clean(b.username,80).toLowerCase();

    const mail=
      clean(b.email,200).toLowerCase();

    const idno=
      clean(b.id_number,80);

    if(await env.DB.prepare(`
      SELECT 1
      FROM accounts
      WHERE lower(username)=?
         OR lower(email)=?
      LIMIT 1
    `).bind(
      uname,
      mail
    ).first()){
      return json({
        error:'ACCOUNT_ALREADY_EXISTS'
      },409);
    }

    if(await env.DB.prepare(`
      SELECT 1
      FROM people
      WHERE id_number=?
      LIMIT 1
    `).bind(idno).first()){
      return json({
        error:'IDENTITY_ALREADY_EXISTS'
      },409);
    }

    const code=await memberCode(env);
    const pid=uid('person');
    const aid=uid('account');
    const salt=token();
    const it=100000;
    const hash=await pbkdf2(
      pw,
      salt,
      it
    );

    await env.DB.batch([
      env.DB.prepare(`
        INSERT INTO people(
          id,
          member_code,
          full_name,
          display_name,
          date_of_birth,
          gender,
          nationality,
          id_number,
          id_issue_date,
          id_issue_place,
          email,
          phone,
          permanent_address,
          temporary_address,
          education_or_work_type,
          school_or_workplace,
          class_or_major,
          education_status,
          avatar_url,
          joined_at,
          status
        )
        VALUES(
          ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?
        )
      `).bind(
        pid,
        code,
        clean(b.full_name,160),
        clean(b.display_name,160)||null,
        clean(b.date_of_birth,20)||null,
        clean(b.gender,50)||null,
        clean(b.nationality,80)||null,
        clean(b.id_number,80)||null,
        clean(b.id_issue_date,20)||null,
        clean(b.id_issue_place,200)||null,
        clean(b.email,200)||null,
        clean(b.phone,50)||null,
        clean(b.permanent_address,500)||null,
        clean(b.temporary_address,500)||null,
        clean(b.education_or_work_type,50)||null,
        clean(b.school_or_workplace,240)||null,
        clean(b.class_or_major,240)||null,
        clean(b.education_status,80)||null,
        clean(b.avatar_url,1200)||null,
        b.joined_at||
          new Date()
            .toISOString()
            .slice(0,10),
        'active'
      ),

      env.DB.prepare(`
        INSERT INTO accounts(
          id,
          person_id,
          username,
          email,
          password_hash,
          password_salt,
          password_iterations,
          force_password_change
        )
        VALUES(?,?,?,?,?,?,?,1)
      `).bind(
        aid,
        pid,
        uname,
        mail||null,
        hash,
        salt,
        it
      ),

      env.DB.prepare(`
        INSERT INTO account_scopes(
          id,
          account_id,
          role_id,
          org_node_id,
          active
        )
        VALUES(?,?,?,?,1)
      `).bind(
        uid('scope'),
        aid,
        'role_member',
        null
      )
    ]);

    if(b.org_node_id){
      await env.DB.prepare(`
        INSERT INTO org_memberships(
          id,
          person_id,
          org_node_id,
          title,
          role_label,
          started_at,
          status,
          is_primary
        )
        VALUES(
          ?,?,?,?,?,?,
          'active',
          1
        )
      `).bind(
        uid('membership'),
        pid,
        b.org_node_id,
        clean(b.title,160)||null,
        clean(b.role_label,160)||null,
        b.joined_at||
          new Date()
            .toISOString()
            .slice(0,10)
      ).run();
    }

    await audit(
      env,
      s.account_id,
      'member_created',
      'person',
      pid,
      b.org_node_id||null,
      {member_code:code}
    );

    return json({
      ok:true,
      id:pid,
      member_code:code
    });
  }

  // =========================================================
  // ADMIN MEMBER DETAIL
  // =========================================================

  const detailMatch=
    url.pathname.match(
      /^\/api\/admin\/members\/([^/]+)$/
    );

  if(detailMatch&&req.method==='GET'){
    await ensureEvaluations(env);
    if(!(await hasPerm(
      env,
      s.account_id,
      'member.view'
    ))){
      return json({
        error:'FORBIDDEN'
      },403);
    }

    const pid=
      decodeURIComponent(
        detailMatch[1]
      );

    if(!(await canAccessPerson(
      env,
      s.account_id,
      pid
    ))){
      return json({
        error:'SCOPE_FORBIDDEN'
      },403);
    }

    const person=await env.DB.prepare(`
      SELECT
        p.*,
        a.id account_id,
        a.username,
        a.email account_email,
        a.is_locked,
        a.force_password_change,
        a.last_login_at
      FROM people p
      LEFT JOIN accounts a
        ON a.person_id=p.id
      WHERE p.id=?
    `).bind(pid).first();

    if(!person){
      return json({
        error:'NOT_FOUND'
      },404);
    }

    const [
      memberships,
      certificates,
      achievements,
      cards,
      documents,
      scopes,
      goals,
      tasks,
      activities,
      evaluations,
      auditRows
    ]=await Promise.all([
      env.DB.prepare(`
        SELECT
          m.*,
          o.name org_name,
          o.code org_code
        FROM org_memberships m
        JOIN org_nodes o
          ON o.id=m.org_node_id
        WHERE m.person_id=?
        ORDER BY m.started_at DESC
      `).bind(pid).all(),

      env.DB.prepare(`
        SELECT *
        FROM certificates
        WHERE person_id=?
        ORDER BY
          COALESCE(
            issued_at,
            created_at
          ) DESC
      `).bind(pid).all(),

      env.DB.prepare(`
        SELECT *
        FROM achievements
        WHERE person_id=?
        ORDER BY
          COALESCE(
            achieved_at,
            created_at
          ) DESC
      `).bind(pid).all(),

      env.DB.prepare(`
        SELECT
          c.*,
          t.name card_type_name,
          t.template_json card_template_json,
          o.name org_name
        FROM member_cards c
        JOIN card_types t
          ON t.id=c.card_type_id
        LEFT JOIN org_nodes o
          ON o.id=c.org_node_id
        WHERE c.person_id=?
        ORDER BY c.created_at DESC
      `).bind(pid).all(),

      env.DB.prepare(`
        SELECT *
        FROM member_documents
        WHERE person_id=?
        ORDER BY created_at DESC
      `).bind(pid).all(),

      env.DB.prepare(`
        SELECT
          s.*,
          r.code role_code,
          r.name role_name,
          o.name org_name
        FROM account_scopes s
        JOIN roles r
          ON r.id=s.role_id
        LEFT JOIN org_nodes o
          ON o.id=s.org_node_id
        WHERE s.account_id=?
      `).bind(
        person.account_id||''
      ).all(),

      env.DB.prepare(`
        SELECT *
        FROM goals
        WHERE person_id=?
        ORDER BY created_at DESC
      `).bind(pid).all(),

      env.DB.prepare(`
        SELECT *
        FROM tasks
        WHERE person_id=?
        ORDER BY created_at DESC
      `).bind(pid).all(),

      env.DB.prepare(`
        SELECT
          a.*,
          ap.role_label,
          ap.result,
          ap.verification_status,
          o.name org_name
        FROM activity_participants ap
        JOIN activities a
          ON a.id=ap.activity_id
        LEFT JOIN org_nodes o
          ON o.id=a.org_node_id
        WHERE ap.person_id=?
        ORDER BY
          COALESCE(
            a.starts_at,
            a.created_at
          ) DESC
      `).bind(pid).all(),

      env.DB.prepare(`
        SELECT e.*,o.name org_name,a.username evaluator_username
        FROM member_evaluations e
        LEFT JOIN org_nodes o ON o.id=e.org_node_id
        LEFT JOIN accounts a ON a.id=e.evaluator_account_id
        WHERE e.person_id=?
        ORDER BY e.created_at DESC
      `).bind(pid).all(),

      env.DB.prepare(`
        SELECT
          l.*,
          aa.username
        FROM audit_log l
        LEFT JOIN accounts aa
          ON aa.id=l.actor_account_id
        WHERE l.entity_id=?
           OR json_extract(
                l.details_json,
                '$.person_id'
              )=?
        ORDER BY l.id DESC
        LIMIT 200
      `).bind(pid,pid).all()
    ]);

    return json({
      person,
      memberships:
        memberships.results||[],
      certificates:
        certificates.results||[],
      achievements:
        achievements.results||[],
      cards:
        cards.results||[],
      documents:
        documents.results||[],
      scopes:
        scopes.results||[],
      goals:
        goals.results||[],
      tasks:
        tasks.results||[],
      activities:
        activities.results||[],
      evaluations:
        evaluations.results||[],
      audit:
        auditRows.results||[]
    });
  }

  if(detailMatch&&req.method==='PATCH'){
    if(!(await hasPerm(
      env,
      s.account_id,
      'member.edit'
    ))){
      return json({
        error:'FORBIDDEN'
      },403);
    }

    const pid=
      decodeURIComponent(
        detailMatch[1]
      );

    if(!(await canAccessPerson(
      env,
      s.account_id,
      pid
    ))){
      return json({
        error:'SCOPE_FORBIDDEN'
      },403);
    }

    const b=await bodyJson(req);

    const p=await env.DB.prepare(`
      SELECT *
      FROM people
      WHERE id=?
    `).bind(pid).first();

    if(!p){
      return json({
        error:'NOT_FOUND'
      },404);
    }

    const v=(k,m=1000)=>
      Object.prototype
        .hasOwnProperty.call(b,k)
          ?clean(b[k],m)
          :(p[k]??'');

    await env.DB.prepare(`
      UPDATE people
      SET
        full_name=?,
        display_name=?,
        date_of_birth=?,
        gender=?,
        nationality=?,
        id_number=?,
        id_issue_date=?,
        id_issue_place=?,
        email=?,
        phone=?,
        permanent_address=?,
        temporary_address=?,
        education_or_work_type=?,
        school_or_workplace=?,
        class_or_major=?,
        education_status=?,
        avatar_url=?,
        joined_at=?,
        ended_at=?,
        status=?,
        updated_at=CURRENT_TIMESTAMP
      WHERE id=?
    `).bind(
      v('full_name',160),
      v('display_name',160)||null,
      v('date_of_birth',20)||null,
      v('gender',50)||null,
      v('nationality',80)||null,
      v('id_number',80)||null,
      v('id_issue_date',20)||null,
      v('id_issue_place',200)||null,
      v('email',200)||null,
      v('phone',50)||null,
      v('permanent_address',500)||null,
      v('temporary_address',500)||null,
      v('education_or_work_type',50)||null,
      v('school_or_workplace',240)||null,
      v('class_or_major',240)||null,
      v('education_status',80)||null,
      v('avatar_url',1200)||null,
      v('joined_at',20)||null,
      v('ended_at',20)||null,
      v('status',30)||'active',
      pid
    ).run();

    await audit(
      env,
      s.account_id,
      'member_updated',
      'person',
      pid,
      null,
      {}
    );

    return json({ok:true});
  }

  // =========================================================
  // ADMIN CERTIFICATE PDF UPLOAD
  // =========================================================

  const certFileMatch=
    url.pathname.match(
      /^\/api\/admin\/members\/([^/]+)\/certificate-file$/
    );

  if(
    certFileMatch&&
    req.method==='POST'
  ){
    if(!(await hasPerm(
      env,
      s.account_id,
      'certificate.manage'
    ))){
      return json({
        error:'FORBIDDEN'
      },403);
    }

    const pid=
      decodeURIComponent(
        certFileMatch[1]
      );

    if(!(await canAccessPerson(
      env,
      s.account_id,
      pid
    ))){
      return json({
        error:'SCOPE_FORBIDDEN'
      },403);
    }

    if(!(await env.DB.prepare(`
      SELECT 1
      FROM people
      WHERE id=?
    `).bind(pid).first())){
      return json({
        error:'NOT_FOUND'
      },404);
    }

    const ct=
      (req.headers.get('content-type')||'')
        .toLowerCase();

    if(ct!=='application/pdf'){
      return json({
        error:'PDF_ONLY'
      },415);
    }

    const data=await req.arrayBuffer();

    if(
      !data.byteLength||
      data.byteLength>10*1024*1024
    ){
      return json({
        error:'PDF_TOO_LARGE'
      },413);
    }

    const key=
      `certificates/${pid}/`+
      `${new Date().toISOString().slice(0,10)}/`+
      `${crypto.randomUUID()}.pdf`;

    await env.FILES.put(
      key,
      data,
      {
        httpMetadata:{
          contentType:'application/pdf',
          contentDisposition:'inline'
        }
      }
    );

    return json({
      ok:true,
      url:`/files/${key}`
    });
  }

  // =========================================================
  // ADMIN MEMBER SUB ACTIONS
  // =========================================================

  const subMatch=
    url.pathname.match(
      /^\/api\/admin\/members\/([^/]+)\/(certificate|achievement|membership|card|document|goal|task|activity|reset-password|lock|scope)$/
    );

  if(subMatch&&req.method==='POST'){
    const pid=
      decodeURIComponent(
        subMatch[1]
      );

    const op=subMatch[2];
    const b=await bodyJson(req);

    if(!(await canAccessPerson(
      env,
      s.account_id,
      pid
    ))){
      return json({
        error:'SCOPE_FORBIDDEN'
      },403);
    }

    const person=await env.DB.prepare(`
      SELECT
        p.*,
        a.id account_id
      FROM people p
      LEFT JOIN accounts a
        ON a.person_id=p.id
      WHERE p.id=?
    `).bind(pid).first();

    if(!person){
      return json({
        error:'NOT_FOUND'
      },404);
    }

    if(op==='goal'){
      if(!(await hasPerm(
        env,
        s.account_id,
        'goal.manage'
      ))){
        return json({
          error:'FORBIDDEN'
        },403);
      }

      if(
        b.org_node_id&&
        !(await canAccessOrg(
          env,
          s.account_id,
          b.org_node_id
        ))
      ){
        return json({
          error:'SCOPE_FORBIDDEN'
        },403);
      }

      const period=
        clean(b.period_type,20);

      const title=
        clean(b.title,240);

      if(
        ![
          'week',
          'month',
          'quarter',
          'year'
        ].includes(period)||
        !title
      ){
        return json({
          error:'INVALID_DATA'
        },400);
      }

      const id=uid('goal');

      await env.DB.prepare(`
        INSERT INTO goals(
          id,
          person_id,
          org_node_id,
          period_type,
          title,
          description,
          priority,
          progress,
          status,
          starts_at,
          due_at,
          created_by_account_id
        )
        VALUES(
          ?,?,?,?,?,?,?,?,?,?,?,?
        )
      `).bind(
        id,
        pid,
        b.org_node_id||null,
        period,
        title,
        clean(b.description,2000)||null,
        clean(b.priority,30)||'normal',
        Math.max(
          0,
          Math.min(
            100,
            Number(b.progress||0)
          )
        ),
        clean(b.status,30)||'active',
        clean(b.starts_at,20)||null,
        clean(b.due_at,20)||null,
        s.account_id
      ).run();

      await env.DB.prepare(`
        INSERT INTO notifications(
          id,
          person_id,
          org_node_id,
          type,
          title,
          body
        )
        VALUES(
          ?,?,?,
          'goal',
          'Mục tiêu mới',
          ?
        )
      `).bind(
        uid('notification'),
        pid,
        b.org_node_id||null,
        title
      ).run();

      await audit(
        env,
        s.account_id,
        'goal_assigned',
        'goal',
        id,
        b.org_node_id||null,
        {person_id:pid}
      );

      return json({ok:true,id});
    }

    if(op==='task'){
      if(!(await hasPerm(
        env,
        s.account_id,
        'task.manage'
      ))){
        return json({
          error:'FORBIDDEN'
        },403);
      }

      if(
        b.org_node_id&&
        !(await canAccessOrg(
          env,
          s.account_id,
          b.org_node_id
        ))
      ){
        return json({
          error:'SCOPE_FORBIDDEN'
        },403);
      }

      const title=
        clean(b.title,240);

      if(!title){
        return json({
          error:'INVALID_DATA'
        },400);
      }

      const id=uid('task');

      await env.DB.prepare(`
        INSERT INTO tasks(
          id,
          person_id,
          org_node_id,
          goal_id,
          title,
          description,
          priority,
          progress,
          status,
          due_at,
          assigned_by_account_id
        )
        VALUES(
          ?,?,?,?,?,?,?,?,?,?,?
        )
      `).bind(
        id,
        pid,
        b.org_node_id||null,
        clean(b.goal_id,120)||null,
        title,
        clean(b.description,2000)||null,
        clean(b.priority,30)||'normal',
        Math.max(
          0,
          Math.min(
            100,
            Number(b.progress||0)
          )
        ),
        clean(b.status,30)||'todo',
        clean(b.due_at,20)||null,
        s.account_id
      ).run();

      await env.DB.prepare(`
        INSERT INTO notifications(
          id,
          person_id,
          org_node_id,
          type,
          title,
          body
        )
        VALUES(
          ?,?,?,
          'task',
          'Công việc mới',
          ?
        )
      `).bind(
        uid('notification'),
        pid,
        b.org_node_id||null,
        title
      ).run();

      await audit(
        env,
        s.account_id,
        'task_assigned',
        'task',
        id,
        b.org_node_id||null,
        {person_id:pid}
      );

      return json({ok:true,id});
    }

    if(op==='activity'){
      if(!(await hasPerm(
        env,
        s.account_id,
        'activity.manage'
      ))){
        return json({
          error:'FORBIDDEN'
        },403);
      }

      if(
        b.org_node_id&&
        !(await canAccessOrg(
          env,
          s.account_id,
          b.org_node_id
        ))
      ){
        return json({
          error:'SCOPE_FORBIDDEN'
        },403);
      }

      const name=
        clean(b.name,240);

      if(!name){
        return json({
          error:'INVALID_DATA'
        },400);
      }

      const id=uid('activity');

      await env.DB.batch([
        env.DB.prepare(`
          INSERT INTO activities(
            id,
            code,
            name,
            org_node_id,
            starts_at,
            ends_at,
            status,
            description
          )
          VALUES(
            ?,?,?,?,?,?,?,?
          )
        `).bind(
          id,
          clean(b.code,120)||null,
          name,
          b.org_node_id||null,
          clean(b.starts_at,20)||null,
          clean(b.ends_at,20)||null,
          clean(b.status,30)||'completed',
          clean(b.description,2000)||null
        ),

        env.DB.prepare(`
          INSERT INTO activity_participants(
            activity_id,
            person_id,
            role_label,
            result,
            verification_status
          )
          VALUES(?,?,?,?,?)
        `).bind(
          id,
          pid,
          clean(b.role_label,160)||
            'Thành viên',
          clean(b.result,1000)||null,
          'confirmed'
        )
      ]);

      await audit(
        env,
        s.account_id,
        'activity_recorded',
        'activity',
        id,
        b.org_node_id||null,
        {person_id:pid}
      );

      return json({ok:true,id});
    }

    if(op==='certificate'){
      if(!(await hasPerm(
        env,
        s.account_id,
        'certificate.manage'
      ))){
        return json({
          error:'FORBIDDEN'
        },403);
      }

      if(
        b.org_node_id&&
        !(await canAccessOrg(
          env,
          s.account_id,
          b.org_node_id
        ))
      ){
        return json({
          error:'SCOPE_FORBIDDEN'
        },403);
      }

      const id=uid('cert');

      const verify=
        clean(b.verify_code,100)||
        verifyCode('GCN');

      const meta={
        recognition:
          clean(b.recognition,2000),
        notes:
          clean(b.notes,1500)
      };

      if(
        !clean(b.title,240)||
        !clean(b.issuer,240)
      ){
        return json({
          error:'INVALID_DATA'
        },400);
      }

      await env.DB.batch([
        env.DB.prepare(`
          INSERT INTO certificates(
            id,
            person_id,
            org_node_id,
            certificate_no,
            title,
            issuer,
            issued_at,
            source_type,
            verification_status,
            file_url,
            verify_code,
            metadata_json
          )
          VALUES(
            ?,?,?,?,?,?,?,
            'internal',
            'verified',
            ?,?,?
          )
        `).bind(
          id,
          pid,
          b.org_node_id||null,
          clean(b.certificate_no,120)||
            verify,
          clean(b.title,240),
          clean(b.issuer,240),
          clean(b.issued_at,20)||
            new Date()
              .toISOString()
              .slice(0,10),
          clean(b.file_url,1200)||null,
          verify,
          JSON.stringify(meta)
        ),

        env.DB.prepare(`
          INSERT INTO notifications(
            id,
            person_id,
            org_node_id,
            type,
            title,
            body
          )
          VALUES(
            ?,?,?,
            'certificate',
            'Bạn có chứng nhận mới',
            ?
          )
        `).bind(
          uid('notice'),
          pid,
          b.org_node_id||null,
          `Chứng nhận "${clean(
            b.title,
            240
          )}" đã được cấp trên Cổng Thành viên Sky First Network.`
        )
      ]);

      await audit(
        env,
        s.account_id,
        'certificate_issued',
        'certificate',
        id,
        b.org_node_id||null,
        {
          person_id:pid,
          verify_code:verify
        }
      );

      return json({
        ok:true,
        id,
        verify_code:verify
      });
    }

    if(op==='achievement'){
      if(!(await hasPerm(
        env,
        s.account_id,
        'achievement.manage'
      ))){
        return json({
          error:'FORBIDDEN'
        },403);
      }

      const id=uid('achievement');

      if(!clean(b.title,240)){
        return json({
          error:'INVALID_DATA'
        },400);
      }

      await env.DB.prepare(`
        INSERT INTO achievements(
          id,
          person_id,
          org_node_id,
          title,
          achievement_type,
          issuer,
          achieved_at,
          verification_status,
          source_type,
          description
        )
        VALUES(
          ?,?,?,?,?,?,?,
          'verified',
          'internal',
          ?
        )
      `).bind(
        id,
        pid,
        b.org_node_id||null,
        clean(b.title,240),
        clean(b.achievement_type,120)||null,
        clean(b.issuer,240)||'Sky First Network',
        clean(b.achieved_at,20)||null,
        clean(b.description,2000)||null
      ).run();

      await audit(
        env,
        s.account_id,
        'achievement_added',
        'achievement',
        id,
        b.org_node_id||null,
        {person_id:pid}
      );

      return json({ok:true,id});
    }

    if(op==='membership'){
      if(!(await hasPerm(
        env,
        s.account_id,
        'member.edit'
      ))){
        return json({
          error:'FORBIDDEN'
        },403);
      }

      if(!b.org_node_id){
        return json({
          error:'ORG_REQUIRED'
        },400);
      }

      if(!(await canAccessOrg(
        env,
        s.account_id,
        b.org_node_id
      ))){
        return json({
          error:'SCOPE_FORBIDDEN'
        },403);
      }

      const id=uid('membership');

      await env.DB.prepare(`
        INSERT INTO org_memberships(
          id,
          person_id,
          org_node_id,
          title,
          role_label,
          started_at,
          ended_at,
          status,
          is_primary,
          decision_ref
        )
        VALUES(
          ?,?,?,?,?,?,?,?,?,?
        )
      `).bind(
        id,
        pid,
        b.org_node_id,
        clean(b.title,160)||null,
        clean(b.role_label,160)||null,
        clean(b.started_at,20)||null,
        clean(b.ended_at,20)||null,
        clean(b.status,30)||'active',
        b.is_primary?1:0,
        clean(b.decision_ref,240)||null
      ).run();

      await audit(
        env,
        s.account_id,
        'membership_added',
        'membership',
        id,
        b.org_node_id,
        {person_id:pid}
      );

      return json({ok:true,id});
    }
    if(op==='card'){
      if(!(await hasPerm(
        env,
        s.account_id,
        'card.manage'
      ))){
        return json({
          error:'FORBIDDEN'
        },403);
      }

      if(
        b.org_node_id&&
        !(await canAccessOrg(
          env,
          s.account_id,
          b.org_node_id
        ))
      ){
        return json({
          error:'SCOPE_FORBIDDEN'
        },403);
      }

      const id=uid('card');

      const verify=
        verifyCode('CARD');

      const number=
        clean(b.card_number,120)||
        `SFN-CARD-${String(
          Date.now()
        ).slice(-8)}`;

      await env.DB.prepare(`
        INSERT INTO member_cards(
          id,
          person_id,
          card_type_id,
          org_node_id,
          card_number,
          title_on_card,
          issued_at,
          expires_at,
          status,
          verify_token
        )
        VALUES(
          ?,?,?,?,?,?,?,?,?,?
        )
      `).bind(
        id,
        pid,
        b.card_type_id||'card_member',
        b.org_node_id||'org_sfn',
        number,
        clean(b.title_on_card,180)||null,
        clean(b.issued_at,20)||
          new Date()
            .toISOString()
            .slice(0,10),
        clean(b.expires_at,20)||null,
        clean(b.status,30)||'active',
        verify
      ).run();

      await audit(
        env,
        s.account_id,
        'card_issued',
        'member_card',
        id,
        b.org_node_id||'org_sfn',
        {
          person_id:pid,
          verify_token:verify
        }
      );

      return json({
        ok:true,
        id,
        verify_token:verify
      });
    }

    if(op==='document'){
      if(!(await hasPerm(
        env,
        s.account_id,
        'member.edit'
      ))){
        return json({
          error:'FORBIDDEN'
        },403);
      }

      const id=uid('doc');

      await env.DB.prepare(`
        INSERT INTO member_documents(
          id,
          person_id,
          org_node_id,
          document_type,
          title,
          file_url,
          issued_at,
          visibility
        )
        VALUES(
          ?,?,?,?,?,?,?,
          'private'
        )
      `).bind(
        id,
        pid,
        b.org_node_id||null,
        clean(b.document_type,100)||'other',
        clean(b.title,240),
        clean(b.file_url,1200)||null,
        clean(b.issued_at,20)||null
      ).run();

      await audit(env,s.account_id,'document_added','member_document',id,b.org_node_id||null,{person_id:pid});
      return json({ok:true,id});
    }

    if(op==='reset-password'){
      if(!(await hasPerm(
        env,
        s.account_id,
        'account.manage'
      ))){
        return json({
          error:'FORBIDDEN'
        },403);
      }

      const pw=
        String(b.password||'');

      if(pw.length<10){
        return json({
          error:'PASSWORD_TOO_SHORT'
        },400);
      }

      const salt=token();
      const it=100000;
      const hash=await pbkdf2(
        pw,
        salt,
        it
      );

      await env.DB.batch([
        env.DB.prepare(`
          UPDATE accounts
          SET
            password_hash=?,
            password_salt=?,
            password_iterations=?,
            force_password_change=1,
            updated_at=CURRENT_TIMESTAMP
          WHERE person_id=?
        `).bind(
          hash,
          salt,
          it,
          pid
        ),

        env.DB.prepare(`
          DELETE FROM sessions
          WHERE account_id=?
        `).bind(
          person.account_id||''
        )
      ]);

      await audit(
        env,
        s.account_id,
        'password_reset',
        'account',
        person.account_id
      );

      return json({ok:true});
    }

    if(op==='lock'){
      if(!(await hasPerm(
        env,
        s.account_id,
        'account.manage'
      ))){
        return json({
          error:'FORBIDDEN'
        },403);
      }

      const locked=
        b.locked?1:0;

      await env.DB.prepare(`
        UPDATE accounts
        SET
          is_locked=?,
          updated_at=CURRENT_TIMESTAMP
        WHERE person_id=?
      `).bind(
        locked,
        pid
      ).run();

      if(
        locked&&
        person.account_id
      ){
        await env.DB.prepare(`
          DELETE FROM sessions
          WHERE account_id=?
        `).bind(
          person.account_id
        ).run();
      }

      await audit(
        env,
        s.account_id,
        locked
          ?'account_locked'
          :'account_unlocked',
        'account',
        person.account_id
      );

      return json({
        ok:true,
        is_locked:locked
      });
    }

    if(op==='scope'){
      if(!(await hasPerm(
        env,
        s.account_id,
        'role.manage'
      ))){
        return json({
          error:'FORBIDDEN'
        },403);
      }

      if(
        !person.account_id||
        !b.role_id
      ){
        return json({
          error:'INVALID_DATA'
        },400);
      }

      const id=uid('scope');

      await env.DB.prepare(`
        INSERT INTO account_scopes(
          id,
          account_id,
          role_id,
          org_node_id,
          active
        )
        VALUES(?,?,?,?,1)
      `).bind(
        id,
        person.account_id,
        b.role_id,
        b.org_node_id||null
      ).run();

      await audit(
        env,
        s.account_id,
        'scope_granted',
        'account_scope',
        id,
        b.org_node_id||null,
        {
          person_id:pid,
          role_id:b.role_id
        }
      );

      return json({ok:true,id});
    }
  }

  // =========================================================
  // ADMIN MEMBER RECORD LIFECYCLE
  // =========================================================

  const membershipActionMatch=url.pathname.match(
    /^\/api\/admin\/members\/([^/]+)\/membership\/([^/]+)(?:\/(end|hide|show))?$/
  );

  if(membershipActionMatch){
    const pid=decodeURIComponent(membershipActionMatch[1]);
    const membershipId=decodeURIComponent(membershipActionMatch[2]);
    const action=membershipActionMatch[3]||null;
    if(!(await hasPerm(env,s.account_id,'member.edit')))return json({error:'FORBIDDEN'},403);
    if(!(await canAccessPerson(env,s.account_id,pid)))return json({error:'SCOPE_FORBIDDEN'},403);
    const membership=await env.DB.prepare('SELECT * FROM org_memberships WHERE id=? AND person_id=? LIMIT 1').bind(membershipId,pid).first();
    if(!membership)return json({error:'MEMBERSHIP_NOT_FOUND'},404);
    if(!(await canAccessOrg(env,s.account_id,membership.org_node_id)))return json({error:'SCOPE_FORBIDDEN'},403);

    if(req.method==='PATCH'&&!action){
      const b=await bodyJson(req);
      const orgNodeId=clean(b.org_node_id,100)||membership.org_node_id;
      if(!(await canAccessOrg(env,s.account_id,orgNodeId)))return json({error:'SCOPE_FORBIDDEN'},403);
      await env.DB.prepare(`UPDATE org_memberships SET org_node_id=?,title=?,role_label=?,started_at=?,ended_at=?,decision_ref=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND person_id=?`)
        .bind(orgNodeId,clean(b.title,160)||null,clean(b.role_label,160)||null,clean(b.started_at,20)||null,clean(b.ended_at,20)||null,clean(b.decision_ref,240)||null,membershipId,pid).run();
      await audit(env,s.account_id,'membership_updated','membership',membershipId,orgNodeId,{person_id:pid});
      return json({ok:true,status:'updated'});
    }
    if(req.method==='POST'&&action==='end'){
      await env.DB.prepare(`UPDATE org_memberships SET status='ended',ended_at=COALESCE(ended_at,DATE('now')),updated_at=CURRENT_TIMESTAMP WHERE id=? AND person_id=?`).bind(membershipId,pid).run();
      await audit(env,s.account_id,'membership_ended','membership',membershipId,membership.org_node_id,{person_id:pid});
      return json({ok:true,status:'ended'});
    }
    if(req.method==='POST'&&action==='hide'){
      await env.DB.prepare(`UPDATE org_memberships SET status='suspended',updated_at=CURRENT_TIMESTAMP WHERE id=? AND person_id=?`).bind(membershipId,pid).run();
      await audit(env,s.account_id,'membership_hidden','membership',membershipId,membership.org_node_id,{person_id:pid});
      return json({ok:true,status:'hidden'});
    }
    if(req.method==='POST'&&action==='show'){
      const newStatus=membership.ended_at?'ended':'active';
      await env.DB.prepare(`UPDATE org_memberships SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND person_id=?`).bind(newStatus,membershipId,pid).run();
      await audit(env,s.account_id,'membership_restored','membership',membershipId,membership.org_node_id,{person_id:pid,status:newStatus});
      return json({ok:true,status:newStatus});
    }
    return json({error:'METHOD_NOT_ALLOWED'},405);
  }

  const recordActionMatch=url.pathname.match(
    /^\/api\/admin\/members\/([^/]+)\/(goal|task|activity|certificate|achievement|card|document|scope)\/([^/]+)(?:\/(complete|cancel|restore|hide|show|revoke|activate|deactivate|doing|todo))?$/
  );

  if(recordActionMatch){
    const pid=decodeURIComponent(recordActionMatch[1]);
    const kind=recordActionMatch[2];
    const id=decodeURIComponent(recordActionMatch[3]);
    const action=recordActionMatch[4]||null;
    const permByKind={goal:'goal.manage',task:'task.manage',activity:'activity.manage',certificate:'certificate.manage',achievement:'achievement.manage',card:'card.manage',document:'member.edit',scope:'role.manage'};
    if(!(await hasPerm(env,s.account_id,permByKind[kind])))return json({error:'FORBIDDEN'},403);
    if(!(await canAccessPerson(env,s.account_id,pid)))return json({error:'SCOPE_FORBIDDEN'},403);

    const tableInfo={
      goal:['goals','person_id'],task:['tasks','person_id'],certificate:['certificates','person_id'],achievement:['achievements','person_id'],card:['member_cards','person_id'],document:['member_documents','person_id']
    };
    let row=null;
    if(kind==='activity'){
      row=await env.DB.prepare(`SELECT a.*,ap.role_label,ap.result,ap.verification_status FROM activities a JOIN activity_participants ap ON ap.activity_id=a.id WHERE a.id=? AND ap.person_id=?`).bind(id,pid).first();
    }else if(kind==='scope'){
      row=await env.DB.prepare(`SELECT s.*,a.person_id FROM account_scopes s JOIN accounts a ON a.id=s.account_id WHERE s.id=? AND a.person_id=?`).bind(id,pid).first();
    }else{
      const [table,col]=tableInfo[kind];
      row=await env.DB.prepare(`SELECT * FROM ${table} WHERE id=? AND ${col}=?`).bind(id,pid).first();
    }
    if(!row)return json({error:'RECORD_NOT_FOUND'},404);
    if(row.org_node_id&&!(await canAccessOrg(env,s.account_id,row.org_node_id)))return json({error:'SCOPE_FORBIDDEN'},403);

    const b=(req.method==='PATCH')?await bodyJson(req):{};
    const changedOrg=(Object.prototype.hasOwnProperty.call(b,'org_node_id'))?(clean(b.org_node_id,100)||null):row.org_node_id;
    if(changedOrg&&!(await canAccessOrg(env,s.account_id,changedOrg)))return json({error:'SCOPE_FORBIDDEN'},403);

    if(req.method==='PATCH'&&!action){
      if(kind==='goal'){
        const period=clean(b.period_type,20)||row.period_type;
        const status=clean(b.status,30)||row.status;
        if(!['week','month','quarter','year'].includes(period)||!['active','completed','cancelled'].includes(status))return json({error:'INVALID_DATA'},400);
        await env.DB.prepare(`UPDATE goals SET org_node_id=?,period_type=?,title=?,description=?,priority=?,progress=?,status=?,starts_at=?,due_at=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND person_id=?`).bind(changedOrg,period,clean(b.title,240)||row.title,clean(b.description,2000)||null,clean(b.priority,30)||row.priority,Math.max(0,Math.min(100,Number(b.progress??row.progress))),status,clean(b.starts_at,20)||null,clean(b.due_at,20)||null,id,pid).run();
      }else if(kind==='task'){
        const status=clean(b.status,30)||row.status;
        if(!['todo','doing','done','cancelled'].includes(status))return json({error:'INVALID_DATA'},400);
        await env.DB.prepare(`UPDATE tasks SET org_node_id=?,goal_id=?,title=?,description=?,priority=?,progress=?,status=?,due_at=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND person_id=?`).bind(changedOrg,clean(b.goal_id,120)||null,clean(b.title,240)||row.title,clean(b.description,2000)||null,clean(b.priority,30)||row.priority,Math.max(0,Math.min(100,Number(b.progress??row.progress))),status,clean(b.due_at,20)||null,id,pid).run();
      }else if(kind==='activity'){
        await env.DB.batch([
          env.DB.prepare(`UPDATE activities SET code=?,name=?,org_node_id=?,starts_at=?,ends_at=?,status=?,description=? WHERE id=?`).bind(clean(b.code,120)||row.code,clean(b.name,240)||row.name,changedOrg,clean(b.starts_at,30)||null,clean(b.ends_at,30)||null,clean(b.status,30)||row.status,clean(b.description,2000)||null,id),
          env.DB.prepare(`UPDATE activity_participants SET role_label=?,result=? WHERE activity_id=? AND person_id=?`).bind(clean(b.role_label,160)||row.role_label,clean(b.result,1000)||null,id,pid)
        ]);
      }else if(kind==='certificate'){
        const vs=clean(b.verification_status,30)||row.verification_status;
        if(!['provided','pending','verified','rejected'].includes(vs))return json({error:'INVALID_DATA'},400);
        await env.DB.prepare(`UPDATE certificates SET org_node_id=?,certificate_no=?,title=?,issuer=?,issued_at=?,verification_status=?,file_url=? WHERE id=? AND person_id=?`).bind(changedOrg,clean(b.certificate_no,160)||null,clean(b.title,240)||row.title,clean(b.issuer,240)||row.issuer,clean(b.issued_at,20)||null,vs,clean(b.file_url,1200)||null,id,pid).run();
      }else if(kind==='achievement'){
        await env.DB.prepare(`UPDATE achievements SET org_node_id=?,title=?,achievement_type=?,issuer=?,achieved_at=?,verification_status=?,source_type=?,description=? WHERE id=? AND person_id=?`).bind(changedOrg,clean(b.title,240)||row.title,clean(b.achievement_type,100)||null,clean(b.issuer,240)||null,clean(b.achieved_at,20)||null,clean(b.verification_status,30)||row.verification_status,clean(b.source_type,30)||row.source_type,clean(b.description,2000)||null,id,pid).run();
      }else if(kind==='card'){
        const status=clean(b.status,30)||row.status;
        if(!['active','expired','revoked'].includes(status))return json({error:'INVALID_DATA'},400);
        await env.DB.prepare(`UPDATE member_cards SET org_node_id=?,card_number=?,title_on_card=?,issued_at=?,expires_at=?,status=? WHERE id=? AND person_id=?`).bind(changedOrg,clean(b.card_number,160)||row.card_number,clean(b.title_on_card,180)||null,clean(b.issued_at,20)||row.issued_at,clean(b.expires_at,20)||null,status,id,pid).run();
      }else if(kind==='document'){
        await env.DB.prepare(`UPDATE member_documents SET org_node_id=?,document_type=?,title=?,file_url=?,issued_at=?,visibility=? WHERE id=? AND person_id=?`).bind(changedOrg,clean(b.document_type,100)||row.document_type,clean(b.title,240)||row.title,clean(b.file_url,1200)||null,clean(b.issued_at,20)||null,clean(b.visibility,30)||row.visibility,id,pid).run();
      }else return json({error:'METHOD_NOT_ALLOWED'},405);
      await audit(env,s.account_id,`${kind}_updated`,kind,id,changedOrg,{person_id:pid});
      return json({ok:true,status:'updated'});
    }

    if(req.method==='POST'&&action){
      if(kind==='goal'){
        const st=action==='complete'?'completed':action==='cancel'?'cancelled':action==='restore'?'active':null;
        if(!st)return json({error:'INVALID_ACTION'},400);
        await env.DB.prepare(`UPDATE goals SET status=?,progress=CASE WHEN ?='completed' THEN 100 ELSE progress END,updated_at=CURRENT_TIMESTAMP WHERE id=? AND person_id=?`).bind(st,st,id,pid).run();
      }else if(kind==='task'){
        const st=action==='complete'?'done':action==='cancel'?'cancelled':action==='restore'||action==='todo'?'todo':action==='doing'?'doing':null;
        if(!st)return json({error:'INVALID_ACTION'},400);
        await env.DB.prepare(`UPDATE tasks SET status=?,progress=CASE WHEN ?='done' THEN 100 ELSE progress END,updated_at=CURRENT_TIMESTAMP WHERE id=? AND person_id=?`).bind(st,st,id,pid).run();
      }else if(kind==='activity'){
        const st=action==='hide'?'hidden':action==='show'?'confirmed':null;
        if(!st)return json({error:'INVALID_ACTION'},400);
        await env.DB.prepare(`UPDATE activity_participants SET verification_status=? WHERE activity_id=? AND person_id=?`).bind(st,id,pid).run();
      }else if(kind==='certificate'){
        const st=action==='revoke'?'rejected':action==='restore'?'verified':null;
        if(!st)return json({error:'INVALID_ACTION'},400);
        await env.DB.prepare(`UPDATE certificates SET verification_status=? WHERE id=? AND person_id=?`).bind(st,id,pid).run();
      }else if(kind==='achievement'){
        const st=action==='hide'?'hidden':action==='show'||action==='restore'?'verified':action==='revoke'?'rejected':null;
        if(!st)return json({error:'INVALID_ACTION'},400);
        await env.DB.prepare(`UPDATE achievements SET verification_status=? WHERE id=? AND person_id=?`).bind(st,id,pid).run();
      }else if(kind==='card'){
        const st=action==='revoke'||action==='deactivate'?'revoked':action==='restore'||action==='activate'?'active':null;
        if(!st)return json({error:'INVALID_ACTION'},400);
        await env.DB.prepare(`UPDATE member_cards SET status=? WHERE id=? AND person_id=?`).bind(st,id,pid).run();
      }else if(kind==='document'){
        const st=action==='hide'?'hidden':action==='show'||action==='restore'?'private':null;
        if(!st)return json({error:'INVALID_ACTION'},400);
        await env.DB.prepare(`UPDATE member_documents SET visibility=? WHERE id=? AND person_id=?`).bind(st,id,pid).run();
      }else if(kind==='scope'){
        const active=action==='activate'||action==='restore'?1:action==='deactivate'?0:null;
        if(active===null)return json({error:'INVALID_ACTION'},400);
        if(row.role_id==='role_member'&&active===0)return json({error:'MEMBER_SCOPE_REQUIRED'},409);
        await env.DB.prepare(`UPDATE account_scopes SET active=? WHERE id=?`).bind(active,id).run();
      }
      await audit(env,s.account_id,`${kind}_${action}`,kind,id,row.org_node_id||null,{person_id:pid});
      return json({ok:true,action});
    }
    return json({error:'METHOD_NOT_ALLOWED'},405);
  }

  // =========================================================
  // ADMIN EXTERNAL CERTIFICATE REVIEW
  // =========================================================
  const certReviewMatch=url.pathname.match(/^\/api\/admin\/certificates\/([^/]+)\/review$/);
  if(certReviewMatch&&req.method==='POST'){
    if(!(await hasPerm(env,s.account_id,'certificate.manage')))return json({error:'FORBIDDEN'},403);
    const id=decodeURIComponent(certReviewMatch[1]);
    const cert=await env.DB.prepare(`SELECT * FROM certificates WHERE id=?`).bind(id).first();
    if(!cert)return json({error:'NOT_FOUND'},404);
    if(!(await canAccessPerson(env,s.account_id,cert.person_id)))return json({error:'SCOPE_FORBIDDEN'},403);
    if(cert.org_node_id&&!(await canAccessOrg(env,s.account_id,cert.org_node_id)))return json({error:'SCOPE_FORBIDDEN'},403);
    const b=await bodyJson(req);
    const status=clean(b.status,30);
    if(!['verified','rejected'].includes(status))return json({error:'INVALID_STATUS'},400);
    await env.DB.prepare(`UPDATE certificates SET verification_status=? WHERE id=?`).bind(status,id).run();
    await audit(env,s.account_id,status==='verified'?'certificate_verified':'certificate_rejected','certificate',id,cert.org_node_id,{person_id:cert.person_id});
    return json({ok:true,status});
  }

  // =========================================================
  // ACCOUNT REQUEST ADMIN
  // =========================================================
  if(url.pathname==='/api/admin/account-requests'&&req.method==='GET'){
    if(!(await hasPerm(env,s.account_id,'request.manage')))return json({error:'FORBIDDEN'},403);
    await ensureAccountRequestProfiles(env);
    const status=clean(url.searchParams.get('status'),30)||'pending',params=[],where=[];
    if(status!=='all'){where.push('ar.status=?');params.push(status)}
    if(!(await isNetworkAdmin(env,s.account_id))){where.push(`ar.target_org_node_id IN (WITH RECURSIVE allowed(id) AS (SELECT sc.org_node_id FROM account_scopes sc JOIN roles rr ON rr.id=sc.role_id WHERE sc.account_id=? AND sc.active=1 AND rr.code IN ('SCOPE_ADMIN','UNIT_ADMIN','DEPARTMENT_ADMIN') AND sc.org_node_id IS NOT NULL UNION SELECT o.id FROM org_nodes o JOIN allowed a ON o.parent_id=a.id) SELECT id FROM allowed)`);params.push(s.account_id)}
    const r=await env.DB.prepare(`SELECT ar.*,arp.education_or_work_type,arp.school_or_workplace,arp.class_or_major,arp.education_status,o.name org_name,a.username reviewer_username,CAST((julianday('now')-julianday(ar.date_of_birth))/365.2425 AS INTEGER) age FROM account_requests ar LEFT JOIN account_request_profiles arp ON arp.request_id=ar.id LEFT JOIN org_nodes o ON o.id=ar.target_org_node_id LEFT JOIN accounts a ON a.id=ar.reviewed_by_account_id ${where.length?'WHERE '+where.join(' AND '):''} ORDER BY ar.created_at DESC LIMIT 500`).bind(...params).all();return json({items:r.results||[]});
  }
  const approvalResend=url.pathname.match(/^\/api\/admin\/account-requests\/([^/]+)\/send-approval$/);
  if(approvalResend&&req.method==='POST'){
    if(!(await hasPerm(env,s.account_id,'request.manage')))return json({error:'FORBIDDEN'},403);
    const rid=decodeURIComponent(approvalResend[1]);
    const r=await env.DB.prepare(`SELECT ar.id,ar.email,ar.full_name,ar.target_org_node_id,p.member_code,a.username FROM account_requests ar JOIN people p ON p.id=ar.approved_person_id JOIN accounts a ON a.person_id=p.id WHERE ar.id=? AND ar.status='approved'`).bind(rid).first();
    if(!r)return json({error:'APPROVED_REQUEST_NOT_FOUND'},404);
    if(!(await canAccessOrg(env,s.account_id,r.target_org_node_id)))return json({error:'SCOPE_FORBIDDEN'},403);
    const mail=await sendMemberEmail(env,{to:r.email,subject:`[Sky First Network] Thông tin tài khoản thành viên – ${r.member_code}`,html:memberEmailHtml({title:'Tài khoản đã được phê duyệt',name:r.full_name,intro:'Hồ sơ thành viên của bạn đã được phê duyệt tại Sky First Network.',status:'ĐÃ PHÊ DUYỆT',processing:'',body:`Mã thành viên: ${r.member_code}. Tên đăng nhập: ${r.username}. Nếu chưa có mật khẩu, hãy liên hệ bộ phận hỗ trợ để được hướng dẫn kích hoạt bảo mật.`,ctaUrl:env.APP_URL||'https://member.skyfirst.io.vn',ctaLabel:'Đến Trung tâm Thành viên Số'})});
    await safeAudit(env,s.account_id,'approval_email_manual','account_request',rid,r.target_org_node_id,{sent:mail.sent===true});
    return json({ok:true,email_sent:mail.sent===true,email_error:mail.error||mail.reason||null});
  }
  const reqReview=url.pathname.match(/^\/api\/admin\/account-requests\/([^/]+)\/(approve|reject|supplement)$/);
  if(reqReview&&req.method==='POST'){
    if(!(await hasPerm(env,s.account_id,'request.manage')))return json({error:'FORBIDDEN'},403);
    await ensureAccountRequestProfiles(env);
    const rid=decodeURIComponent(reqReview[1]),op=reqReview[2],b=await bodyJson(req),r=await env.DB.prepare(`SELECT ar.*,arp.education_or_work_type,arp.school_or_workplace,arp.class_or_major,arp.education_status FROM account_requests ar LEFT JOIN account_request_profiles arp ON arp.request_id=ar.id WHERE ar.id=? AND ar.status IN ('pending','supplement')`).bind(rid).first();
    if(!r)return json({error:'REQUEST_NOT_PENDING'},409);if(!(await canAccessOrg(env,s.account_id,r.target_org_node_id)))return json({error:'SCOPE_FORBIDDEN'},403);
    if(op==='reject'||op==='supplement'){const note=clean(b.admin_note,1000);if(!note)return json({error:'ADMIN_NOTE_REQUIRED'},400);const next=op==='reject'?'rejected':'supplement';await env.DB.prepare(`UPDATE account_requests SET status=?,admin_note=?,reviewed_by_account_id=?,reviewed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(next,note,s.account_id,rid).run();await audit(env,s.account_id,op==='reject'?'account_request_rejected':'account_request_supplement_requested','account_request',rid,r.target_org_node_id,{note});const label=op==='reject'?'Chưa được phê duyệt':'Cần bổ sung hồ sơ';await sendMemberEmail(env,{to:r.email,subject:`[Sky First Network] ${label} – ${r.request_code}`,html:memberEmailHtml({title:label,name:r.full_name,intro:op==='reject'?'Sky First Network đã hoàn tất xem xét yêu cầu đăng ký của bạn.':'Hồ sơ đăng ký của bạn cần bổ sung thêm thông tin trước khi tiếp tục xử lý.',code:r.request_code,status:label,processing:'',body:note,ctaUrl:env.APP_URL||'https://member.skyfirst.io.vn',ctaLabel:'Mở Trung Tâm Thành Viên Số Sky First'})});return json({ok:true,status:next})}
    if(await env.DB.prepare(`SELECT 1 FROM accounts WHERE lower(email)=? LIMIT 1`).bind(r.email).first())return json({error:'ACCOUNT_ALREADY_EXISTS'},409);
    const code=await memberCode(env),pid=uid('person'),aid=uid('account'),username=code.toLowerCase(),temporaryPassword=`SFN-${crypto.randomUUID().replaceAll('-','').slice(0,14)}`,salt=token(),it=100000,hash=await pbkdf2(temporaryPassword,salt,it);
    await env.DB.batch([
env.DB.prepare(`
  INSERT INTO people(
    id,
    member_code,
    full_name,
    display_name,
    date_of_birth,
    gender,
    nationality,
    id_number,
    id_issue_date,
    id_issue_place,
    email,
    phone,
    permanent_address,
    temporary_address,
    education_or_work_type,
    school_or_workplace,
    class_or_major,
    education_status,
    avatar_url,
    joined_at,
    status
  )
  VALUES(
    ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,
    DATE('now'),
    'active'
  )
`).bind(
  pid,
  code,
  r.full_name,
  r.display_name,
  r.date_of_birth,
  r.gender,
  r.nationality,
  r.id_number,
  r.id_issue_date,
  r.id_issue_place,
  r.email,
  r.phone,
  r.permanent_address,
  r.temporary_address,
  r.education_or_work_type||null,
  r.school_or_workplace||null,
  r.class_or_major||null,
  r.education_status||null,
  r.avatar_url
),
      env.DB.prepare(`INSERT INTO accounts(id,person_id,username,email,password_hash,password_salt,password_iterations,force_password_change) VALUES(?,?,?,?,?,?,?,1)`).bind(aid,pid,username,r.email,hash,salt,it),
      env.DB.prepare(`INSERT INTO account_scopes(id,account_id,role_id,org_node_id,active) VALUES(?,?,?,?,1)`).bind(uid('scope'),aid,'role_member',null),
      env.DB.prepare(`INSERT INTO org_memberships(id,person_id,org_node_id,role_label,started_at,status,is_primary) VALUES(?,?,?,?,DATE('now'),'active',1)`).bind(uid('membership'),pid,r.target_org_node_id,'Thành viên'),
      env.DB.prepare(`UPDATE account_requests SET status='approved',admin_note=?,reviewed_by_account_id=?,reviewed_at=CURRENT_TIMESTAMP,approved_person_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(clean(b.admin_note,1000)||'Đã phê duyệt',s.account_id,pid,rid)
    ]);await audit(env,s.account_id,'account_request_approved','account_request',rid,r.target_org_node_id,{person_id:pid,member_code:code});const mail=b.send_email!==false?await sendMemberEmail(env,{to:r.email,subject:`[Sky First Network] Tài khoản thành viên đã được phê duyệt – ${code}`,html:memberEmailHtml({title:'Tài khoản thành viên đã được phê duyệt',name:r.full_name,intro:'Hồ sơ của bạn đã được phê duyệt và tài khoản tại Trung Tâm Thành Viên Số Sky First đã được tạo.',code:r.request_code,status:'Đã phê duyệt',processing:'',body:`Mã thành viên: ${code}. Tên đăng nhập: ${username}. Vui lòng liên hệ bộ phận quản trị qua kênh hỗ trợ chính thức để nhận hướng dẫn kích hoạt tài khoản và thiết lập mật khẩu an toàn.`,ctaUrl:env.APP_URL||'https://member.skyfirst.io.vn',ctaLabel:'Đăng nhập Trung Tâm Thành Viên Số Sky First'})}):{sent:false,reason:'NOT_REQUESTED'};await safeAudit(env,s.account_id,'approval_email_status','account_request',rid,r.target_org_node_id,{requested:b.send_email!==false,sent:mail.sent===true});return json({ok:true,email_sent:mail.sent===true,member_code:code,username,temporary_password:temporaryPassword,note:'Tài khoản đã được tạo; mật khẩu tạm chỉ được trả về trong lần phê duyệt này và phải đổi khi đăng nhập lần đầu.'});
  }

  // =========================================================
  // CALENDAR
  // =========================================================
  if(url.pathname==='/api/me/calendar'&&req.method==='GET'){
    if(!s.person_id)return json({items:[]});const r=await env.DB.prepare(`SELECT e.*,o.name org_name FROM calendar_events e LEFT JOIN org_nodes o ON o.id=e.org_node_id WHERE e.status='active' AND (e.target_person_id=? OR (e.target_person_id IS NULL AND e.org_node_id IS NULL) OR e.org_node_id IN (SELECT org_node_id FROM org_memberships WHERE person_id=? AND status='active')) ORDER BY e.starts_at`).bind(s.person_id,s.person_id).all();return json({items:r.results||[]});
  }
  if(url.pathname==='/api/admin/calendar'&&req.method==='GET'){
    if(!(await hasPerm(env,s.account_id,'calendar.view'))&&!(await hasPerm(env,s.account_id,'calendar.manage')))return json({error:'FORBIDDEN'},403);const orgs=await visibleOrgs(env,s.account_id),ids=orgs.map(x=>x.id);let r;if(await isNetworkAdmin(env,s.account_id))r=await env.DB.prepare(`SELECT e.*,o.name org_name FROM calendar_events e LEFT JOIN org_nodes o ON o.id=e.org_node_id ORDER BY e.starts_at DESC LIMIT 500`).all();else if(ids.length)r=await env.DB.prepare(`SELECT e.*,o.name org_name FROM calendar_events e LEFT JOIN org_nodes o ON o.id=e.org_node_id WHERE e.org_node_id IN (${ids.map(()=>'?').join(',')}) ORDER BY e.starts_at DESC LIMIT 500`).bind(...ids).all();else return json({items:[]});return json({items:r.results||[]});
  }
  if(url.pathname==='/api/admin/calendar'&&req.method==='POST'){
    if(!(await hasPerm(env,s.account_id,'calendar.manage')))return json({error:'FORBIDDEN'},403);const b=await bodyJson(req),org=clean(b.org_node_id,100)||null;if(org&&!(await canAccessOrg(env,s.account_id,org)))return json({error:'SCOPE_FORBIDDEN'},403);if(!clean(b.title,200)||!clean(b.starts_at,40))return json({error:'INVALID_DATA'},400);const id=uid('calendar');await env.DB.prepare(`INSERT INTO calendar_events(id,title,event_type,description,starts_at,ends_at,org_node_id,target_person_id,created_by_account_id) VALUES(?,?,?,?,?,?,?,?,?)`).bind(id,clean(b.title,200),clean(b.event_type,50)||'other',clean(b.description,2000)||null,clean(b.starts_at,40),clean(b.ends_at,40)||null,org,clean(b.target_person_id,100)||null,s.account_id).run();await audit(env,s.account_id,'calendar_created','calendar_event',id,org);return json({ok:true,id});
  }
  const calDel=url.pathname.match(/^\/api\/admin\/calendar\/([^/]+)$/);if(calDel&&req.method==='DELETE'){if(!(await hasPerm(env,s.account_id,'calendar.manage')))return json({error:'FORBIDDEN'},403);const id=decodeURIComponent(calDel[1]),e=await env.DB.prepare(`SELECT org_node_id FROM calendar_events WHERE id=?`).bind(id).first();if(!e)return json({error:'NOT_FOUND'},404);if(e.org_node_id&&!(await canAccessOrg(env,s.account_id,e.org_node_id)))return json({error:'SCOPE_FORBIDDEN'},403);await env.DB.prepare(`DELETE FROM calendar_events WHERE id=?`).bind(id).run();await audit(env,s.account_id,'calendar_deleted','calendar_event',id,e.org_node_id);return json({ok:true})}

  // =========================================================
  // ADMIN OPERATIONS CENTER
  // =========================================================
  if(url.pathname==='/api/admin/work-center'&&req.method==='GET'){
    if(!(await hasPerm(env,s.account_id,'member.view')))return json({error:'FORBIDDEN'},403);
    const [pending,attention,expiring,incomplete]=await Promise.all([
      env.DB.prepare("SELECT COUNT(*) n FROM account_requests WHERE status IN ('pending','supplement')").first(),
      env.DB.prepare("SELECT COUNT(*) n FROM accounts a LEFT JOIN account_restrictions r ON r.account_id=a.id WHERE a.is_locked=1 OR (r.account_id IS NOT NULL AND (r.ends_at IS NULL OR r.ends_at>datetime('now')))").first(),
      env.DB.prepare("SELECT COUNT(*) n FROM member_cards WHERE status='active' AND expires_at IS NOT NULL AND expires_at<=datetime('now','+30 day')").first(),
      env.DB.prepare("SELECT COUNT(*) n FROM people WHERE status='active' AND (email IS NULL OR trim(email)='' OR avatar_url IS NULL OR trim(avatar_url)='')").first()
    ]);
    const items=[];
    if(Number(pending?.n||0)) items.push({kind_label:'Yêu cầu',title:'Yêu cầu cấp tài khoản đang chờ',detail:`${pending.n} yêu cầu cần xem xét`,target:String(pending.n),target_view:'admin-requests',created_at:new Date().toISOString()});
    if(Number(attention?.n||0)) items.push({kind_label:'Tài khoản',title:'Tài khoản cần chú ý',detail:`${attention.n} tài khoản đang khóa hoặc bị hạn chế`,target:String(attention.n),target_view:'admin-members',created_at:new Date().toISOString()});
    if(Number(expiring?.n||0)) items.push({kind_label:'Thẻ',title:'Thẻ sắp hết hạn',detail:`${expiring.n} thẻ còn trong 30 ngày`,target:String(expiring.n),target_view:'admin-members',created_at:new Date().toISOString()});
    if(Number(incomplete?.n||0)) items.push({kind_label:'Hồ sơ',title:'Hồ sơ còn thiếu thông tin',detail:`${incomplete.n} thành viên cần bổ sung`,target:String(incomplete.n),target_view:'admin-members',created_at:new Date().toISOString()});
    return json({counts:{pending_requests:Number(pending?.n||0),account_attention:Number(attention?.n||0),expiring_cards:Number(expiring?.n||0),incomplete_profiles:Number(incomplete?.n||0)},items});
  }

  if(url.pathname==='/api/admin/reports'&&req.method==='GET'){
    if(!(await hasPerm(env,s.account_id,'member.view')))return json({error:'FORBIDDEN'},403);
    const [people,active,accounts,cards,units,requests]=await Promise.all([
      env.DB.prepare('SELECT COUNT(*) n FROM people').first(),env.DB.prepare("SELECT COUNT(*) n FROM people WHERE status='active'").first(),env.DB.prepare('SELECT COUNT(*) n FROM accounts').first(),env.DB.prepare('SELECT COUNT(*) n FROM member_cards').first(),env.DB.prepare("SELECT COUNT(*) n FROM org_nodes WHERE status='active' AND deleted_at IS NULL").first(),env.DB.prepare("SELECT COUNT(*) n FROM account_requests WHERE status IN ('pending','supplement')").first()
    ]);
    const ms=await env.DB.prepare("SELECT status,COUNT(*) n FROM people GROUP BY status ORDER BY n DESC").all();
    const orgs=await env.DB.prepare("SELECT o.name,COUNT(DISTINCT m.person_id) n FROM org_nodes o LEFT JOIN org_memberships m ON m.org_node_id=o.id AND m.status='active' WHERE o.deleted_at IS NULL GROUP BY o.id,o.name ORDER BY n DESC,o.name LIMIT 100").all();
    const cs=await env.DB.prepare("SELECT status,COUNT(*) n FROM member_cards GROUP BY status ORDER BY n DESC").all();
    const labels={active:'Đang hoạt động',inactive:'Ngừng hoạt động',suspended:'Tạm ngưng',banned:'Bị cấm',pending:'Chờ xử lý'};
    return json({summary:{people:{label:'Tổng thành viên',value:Number(people.n||0)},active:{label:'Đang hoạt động',value:Number(active.n||0)},accounts:{label:'Tài khoản',value:Number(accounts.n||0)},cards:{label:'Thẻ đã cấp',value:Number(cards.n||0)},units:{label:'Đơn vị hoạt động',value:Number(units.n||0)},requests:{label:'Yêu cầu chờ',value:Number(requests.n||0)}},member_status:(ms.results||[]).map(x=>({label:labels[x.status]||x.status,n:Number(x.n||0)})),orgs:orgs.results||[],cards:(cs.results||[]).map(x=>({label:x.status==='active'?'Đang hiệu lực':x.status==='revoked'?'Đã thu hồi':x.status==='expired'?'Hết hạn':x.status,n:Number(x.n||0)}))});
  }

  if(url.pathname==='/api/admin/system-health'&&req.method==='GET'){
    if(!(await isSuper(env,s.account_id)))return json({error:'FORBIDDEN'},403);
    let database='error',schema_version=null;try{await env.DB.prepare('SELECT 1 n').first();database='ok';schema_version=(await env.DB.prepare('SELECT MAX(version) v FROM schema_version').first())?.v||null}catch{}
    return json({database,schema_version,r2_binding:!!env.FILES,email_binding:!!env.RESEND_API_KEY});
  }

  if(url.pathname==='/api/admin/saved-filters'&&req.method==='GET'){
    if(!(await isSuper(env,s.account_id)))return json({error:'FORBIDDEN'},403);
    const row=await env.DB.prepare('SELECT value_json FROM system_settings WHERE key=?').bind(`admin_saved_filters_${s.account_id}`).first();let items=[];try{items=JSON.parse(row?.value_json||'[]')}catch{}return json({items:Array.isArray(items)?items:[]});
  }
  if(url.pathname==='/api/admin/saved-filters'&&req.method==='POST'){
    if(!(await isSuper(env,s.account_id)))return json({error:'FORBIDDEN'},403);const b=await bodyJson(req);const name=clean(b.name,100),view=clean(b.view,80),query=clean(b.query,500);if(!name||!view)return json({error:'INVALID_DATA'},400);const key=`admin_saved_filters_${s.account_id}`;const row=await env.DB.prepare('SELECT value_json FROM system_settings WHERE key=?').bind(key).first();let items=[];try{items=JSON.parse(row?.value_json||'[]')}catch{};if(!Array.isArray(items))items=[];items=[...items.filter(x=>x?.name!==name),{id:uid('filter'),name,view,query}].slice(-50);await env.DB.prepare(`INSERT INTO system_settings(key,value_json,updated_at) VALUES(?,?,CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json,updated_at=CURRENT_TIMESTAMP`).bind(key,JSON.stringify(items)).run();await audit(env,s.account_id,'saved_filter_created','system_setting',key,null,{name,view});return json({ok:true});
  }
  const savedFilterDel=url.pathname.match(/^\/api\/admin\/saved-filters\/([^/]+)$/);
  if(savedFilterDel&&req.method==='DELETE'){
    if(!(await isSuper(env,s.account_id)))return json({error:'FORBIDDEN'},403);const id=decodeURIComponent(savedFilterDel[1]),key=`admin_saved_filters_${s.account_id}`,row=await env.DB.prepare('SELECT value_json FROM system_settings WHERE key=?').bind(key).first();let items=[];try{items=JSON.parse(row?.value_json||'[]')}catch{};items=(Array.isArray(items)?items:[]).filter(x=>x?.id!==id);await env.DB.prepare(`INSERT INTO system_settings(key,value_json,updated_at) VALUES(?,?,CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json,updated_at=CURRENT_TIMESTAMP`).bind(key,JSON.stringify(items)).run();await audit(env,s.account_id,'saved_filter_deleted','system_setting',key,null,{id});return json({ok:true});
  }

  // =========================================================
  // ADMIN META
  // =========================================================

  const evaluationMatch=url.pathname.match(/^\/api\/admin\/members\/([^/]+)\/evaluation(?:\/([^/]+)(?:\/(finalize|hide|show))?)?$/);
  if(evaluationMatch){
    await ensureEvaluations(env);
    const pid=decodeURIComponent(evaluationMatch[1]);
    const eid=evaluationMatch[2]||null;
    const action=evaluationMatch[3]||null;
    if(!(await hasPerm(env,s.account_id,'evaluation.manage')) && !(await isSuper(env,s.account_id))) return json({error:'FORBIDDEN'},403);
    if(!(await canAccessPerson(env,s.account_id,pid))) return json({error:'SCOPE_FORBIDDEN'},403);
    const b=['POST','PATCH'].includes(req.method)?await bodyJson(req):{};
    if(req.method==='POST'&&!eid){
      if(b.org_node_id&&!(await canAccessOrg(env,s.account_id,b.org_node_id))) return json({error:'SCOPE_FORBIDDEN'},403);
      const id=uid('eval');
      await env.DB.prepare(`INSERT INTO member_evaluations(id,person_id,org_node_id,evaluator_account_id,period_type,period_label,criteria_json,total_score,rating,comments,visibility,status) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`)
        .bind(id,pid,b.org_node_id||null,s.account_id,clean(b.period_type,30)||'quarter',clean(b.period_label,120)||null,JSON.stringify(b.criteria||{}),b.total_score===''||b.total_score==null?null:Number(b.total_score),clean(b.rating,100)||null,clean(b.comments,3000)||null,clean(b.visibility,20)||'member','draft').run();
      await audit(env,s.account_id,'evaluation_created','member_evaluation',id,b.org_node_id||null,{person_id:pid});
      return json({ok:true,id});
    }
    if(!eid) return json({error:'NOT_FOUND'},404);
    const row=await env.DB.prepare('SELECT * FROM member_evaluations WHERE id=? AND person_id=?').bind(eid,pid).first();
    if(!row)return json({error:'NOT_FOUND'},404);
    if(req.method==='PATCH'&&!action){
      if(row.status==='final') return json({error:'EVALUATION_FINAL_LOCKED'},409);
      await env.DB.prepare(`UPDATE member_evaluations SET org_node_id=?,period_type=?,period_label=?,criteria_json=?,total_score=?,rating=?,comments=?,visibility=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND person_id=?`)
        .bind(b.org_node_id||row.org_node_id,clean(b.period_type,30)||row.period_type,clean(b.period_label,120)||row.period_label,JSON.stringify(b.criteria||JSON.parse(row.criteria_json||'{}')),b.total_score===''||b.total_score==null?row.total_score:Number(b.total_score),clean(b.rating,100)||row.rating,clean(b.comments,3000)||row.comments,clean(b.visibility,20)||row.visibility,eid,pid).run();
      await audit(env,s.account_id,'evaluation_updated','member_evaluation',eid,row.org_node_id,{person_id:pid});return json({ok:true});
    }
    if(req.method==='POST'&&action){
      const next=action==='finalize'?'final':action==='hide'?'hidden':action==='show'?'draft':null;
      if(!next)return json({error:'NOT_FOUND'},404);
      await env.DB.prepare(`UPDATE member_evaluations SET status=?,finalized_at=CASE WHEN ?='final' THEN CURRENT_TIMESTAMP ELSE finalized_at END,updated_at=CURRENT_TIMESTAMP WHERE id=? AND person_id=?`).bind(next,next,eid,pid).run();
      await audit(env,s.account_id,'evaluation_'+action,'member_evaluation',eid,row.org_node_id,{person_id:pid});return json({ok:true,status:next});
    }
    return json({error:'METHOD_NOT_ALLOWED'},405);
  }

  if(url.pathname==='/api/admin/super/overview'&&req.method==='GET'){
    if(!(await isSuper(env,s.account_id)))return json({error:'FORBIDDEN'},403);
    const [people,accounts,orgs,pending,cards,certs]=await Promise.all([
      env.DB.prepare('SELECT COUNT(*) n FROM people').first(),env.DB.prepare('SELECT COUNT(*) n FROM accounts').first(),env.DB.prepare('SELECT COUNT(*) n FROM org_nodes').first(),env.DB.prepare("SELECT COUNT(*) n FROM account_requests WHERE status IN ('pending','supplement')").first(),env.DB.prepare("SELECT COUNT(*) n FROM member_cards WHERE status='active'").first(),env.DB.prepare("SELECT COUNT(*) n FROM certificates WHERE verification_status='verified'").first()
    ]);
    const ac=await env.DB.prepare(`SELECT a.id,a.username,a.email,a.is_locked,a.last_login_at,p.full_name,p.member_code FROM accounts a LEFT JOIN people p ON p.id=a.person_id ORDER BY a.created_at DESC LIMIT 100`).all();
    return json({stats:{people:people.n,accounts:accounts.n,orgs:orgs.n,pending_requests:pending.n,active_cards:cards.n,verified_certificates:certs.n},accounts:ac.results||[]});
  }

  const inspectMatch=url.pathname.match(/^\/api\/admin\/super\/inspect-account\/([^/]+)$/);
  if(inspectMatch&&req.method==='GET'){
    if(!(await isSuper(env,s.account_id)))return json({error:'FORBIDDEN'},403);
    const aid=decodeURIComponent(inspectMatch[1]);
    const scopes=await env.DB.prepare(`SELECT s.id,s.active,r.code role_code,r.name role_name,o.name org_name,s.org_node_id FROM account_scopes s JOIN roles r ON r.id=s.role_id LEFT JOIN org_nodes o ON o.id=s.org_node_id WHERE s.account_id=?`).bind(aid).all();
    const perms=await env.DB.prepare(`SELECT DISTINCT p.code,p.name,r.code role_code FROM account_scopes s JOIN roles r ON r.id=s.role_id JOIN role_permissions rp ON rp.role_id=r.id JOIN permissions p ON p.id=rp.permission_id WHERE s.account_id=? AND s.active=1 ORDER BY p.code`).bind(aid).all();
    return json({scopes:scopes.results||[],permissions:perms.results||[]});
  }

  if(
    url.pathname==='/api/admin/meta'&&
    req.method==='GET'
  ){
    if(!(await hasPerm(
      env,
      s.account_id,
      'member.view'
    ))){
      return json({
        error:'FORBIDDEN'
      },403);
    }

    const [
      orgs,
      cards,
      roles
    ]=await Promise.all([
      visibleOrgs(
        env,
        s.account_id
      ),

      env.DB.prepare(`
        SELECT id,code,name
        FROM card_types
        WHERE active=1
        ORDER BY name
      `).all(),

      env.DB.prepare(`
        SELECT id,code,name
        FROM roles
        ORDER BY name
      `).all()
    ]);

    return json({
      orgs,
      card_types:
        cards.results||[],
      roles:
        roles.results||[]
    });
  }

  if(
    url.pathname==='/api/admin/audit'&&
    req.method==='GET'
  ){
    if(!(await hasPerm(
      env,
      s.account_id,
      'audit.view'
    ))){
      return json({
        error:'FORBIDDEN'
      },403);
    }

    const r=await env.DB.prepare(`
      SELECT
        l.*,
        a.username
      FROM audit_log l
      LEFT JOIN accounts a
        ON a.id=l.actor_account_id
      ORDER BY l.id DESC
      LIMIT 500
    `).all();

    return json({
      items:r.results||[]
    });
  }

  return json({
    error:'NOT_FOUND'
  },404);
}

// =========================================================
// WORKER
// =========================================================

export default{
  async fetch(request,env){
    const url=new URL(request.url);

    if(url.pathname.startsWith('/files/')){
      let key='';try{key=decodeURIComponent(url.pathname.slice(7))}catch{return withSecurityHeaders(new Response('Bad request',{status:400}))}
      if(!key||key.includes('..')||key.startsWith('/')||key.includes('\\')) return withSecurityHeaders(new Response('Bad request',{status:400}));
      const isPrivate=/^(members|documents|certificates)\//.test(key);
      if(isPrivate){
        const fs=await getSession(request,env);
        if(!fs)return withSecurityHeaders(new Response('Unauthorized',{status:401}));
        const ownerMatch=key.match(/^certificates\/(?:external\/)?([^/]+)\//);
        if(ownerMatch&&ownerMatch[1]!==fs.person_id){
          const elevated=await isNetworkAdmin(env,fs.account_id);
          if(!elevated)return withSecurityHeaders(new Response('Forbidden',{status:403}));
        }else if(!ownerMatch&&/^(members|documents)\//.test(key)){
          const ownerKey=key.match(/^(?:members|documents)\/([^/]+)\//)?.[1]||'';
          if(ownerKey!==fs.person_id&&!await isNetworkAdmin(env,fs.account_id))return withSecurityHeaders(new Response('Forbidden',{status:403}));
        }
      }
      const o=await env.FILES.get(key);

      if(!o){
        return withSecurityHeaders(new Response(
          'Not found',
          {status:404}
        ));
      }

      const h=new Headers();

      o.writeHttpMetadata(h);

      h.set(
        'etag',
        o.httpEtag
      );

      h.set(
        'x-content-type-options',
        'nosniff'
      );

      return withSecurityHeaders(new Response(
        o.body,
        {headers:h}
      ));
    }

    if(url.pathname.startsWith('/api/')){
      return withSecurityHeaders(await api(
        request,
        env,
        url
      ));
    }

    if(url.pathname==='/setup'){
      if(await setupDone(env)){
        return withSecurityHeaders(Response.redirect(
          new URL('/',url),
          302
        ));
      }

      const u=
        new URL(request.url);

      u.pathname='/setup.html';

      return withSecurityHeaders(await env.ASSETS.fetch(
        new Request(
          u.toString(),
          {
            method:'GET',
            headers:request.headers
          }
        )
      ));
    }

    if(url.pathname==='/verify'){
      const u=
        new URL(request.url);

      u.pathname='/verify.html';

      return withSecurityHeaders(await env.ASSETS.fetch(
        new Request(
          u.toString(),
          {
            method:'GET',
            headers:request.headers
          }
        )
      ));
    }

    if(!(await setupDone(env))){
      return withSecurityHeaders(Response.redirect(
        new URL('/setup',url),
        302
      ));
    }

    return withSecurityHeaders(await env.ASSETS.fetch(request));
  }
};

export {api};

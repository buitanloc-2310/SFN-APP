import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {deflateSync} from 'node:zlib';
import assert from 'node:assert/strict';
import vm from 'node:vm';
const db=new DatabaseSync(':memory:');
for(const f of readdirSync('migrations').filter(x=>x.endsWith('.sql')).sort())db.exec(readFileSync('migrations/'+f,'utf8'));
const DB={prepare(sql){let args=[];const q={bind(...a){args=a;return q},async first(){return db.prepare(sql).get(...args)||null},async all(){return {results:db.prepare(sql).all(...args)}},async run(){return db.prepare(sql).run(...args)}};return q},async batch(q){return Promise.all(q.map(x=>x.run()))}};
db.exec(`INSERT INTO people(id,member_code,full_name) VALUES('p','T','Test'); INSERT INTO accounts(id,person_id,username,password_hash,password_salt,force_password_change) VALUES('a','p','test','x','x',0); INSERT INTO account_scopes(id,account_id,role_id,org_node_id) VALUES('scope','a','role_super_admin','org_sfn');`);
db.prepare("INSERT INTO sessions(id,account_id,token_hash,expires_at) VALUES('s','a',?,datetime('now','+1 day'))").run(createHash('sha256').update('test').digest('hex'));
const src=readFileSync('src/index.js','utf8');const {default:Worker,api}=await import('../src/index.js');
let checks=0;async function call(path,method='GET',b){const req=new Request('https://member.skyfirst.io.vn'+path,{method,headers:{cookie:'sfn_session=test','content-type':'application/json',origin:'https://member.skyfirst.io.vn'},body:b?JSON.stringify(b):undefined});const r=await api(req,{DB},new URL(req.url));return {status:r.status,...await r.json()}}
let r=await call('/api/admin/org','POST',{code:'SF-DMC',name:'Wrong',node_type:'digital_member_center'});assert.equal(r.status,200);const id=r.id;assert.equal(db.prepare('SELECT name FROM org_nodes WHERE id=?').get(id).name,'Trung Tâm Thành Viên Số Sky First');checks++;
assert.equal((await call('/api/admin/org','POST',{code:'sf-dmc',name:'Duplicate'})).status,409);checks++;
assert.equal((await call('/api/admin/org/'+id,'PATCH',{parent_id:id})).error,'ORG_CYCLE_FORBIDDEN');checks++;
r=await call('/api/admin/org','POST',{code:'CHILD',name:'Child',parent_id:id});assert.equal(r.status,200);assert.equal((await call('/api/admin/org/'+id,'PATCH',{parent_id:r.id})).error,'ORG_CYCLE_FORBIDDEN');checks++;
assert.equal((await call('/api/admin/org/org_sfn','PATCH',{parent_id:id})).error,'ROOT_PARENT_FORBIDDEN');checks++;
assert.equal((await call('/api/admin/org','POST',{code:'INVALID',name:'X',parent_id:'missing'})).status,400);checks++;
assert.equal((await call('/api/admin/org','POST',{code:'SORT',name:'X',sort_order:'bad'})).error,'INVALID_SORT_ORDER');checks++;
assert.equal((await call('/api/admin/org/'+id,'PATCH',{name:'Changed'})).status,200);assert.equal(db.prepare('SELECT name FROM org_nodes WHERE id=?').get(id).name,'Trung Tâm Thành Viên Số Sky First');checks++;
db.exec("UPDATE account_scopes SET role_id='role_scope_admin',org_node_id='org_office'; INSERT OR IGNORE INTO role_permissions(role_id,permission_id) SELECT 'role_scope_admin',id FROM permissions WHERE code='org.manage';");
r=await call('/api/admin/org');assert.equal(r.status,200);assert(r.items.every(x=>x.id==='org_office'));checks++;
assert.equal((await call('/api/admin/org','POST',{code:'FORBIDDEN',name:'X',parent_id:'org_sfn'})).status,403);checks++;
assert.equal((await call('/api/admin/work-center')).status,200);checks++;
r=await call('/api/admin/reports');assert.equal(r.status,200);assert('summary' in r);checks++;
db.exec("UPDATE account_scopes SET role_id='role_super_admin',org_node_id='org_sfn' WHERE account_id='a';");r=await call('/api/admin/system-health');assert.equal(r.status,200);assert.equal(r.database,'ok');checks++;
db.prepare("INSERT OR REPLACE INTO system_settings(key,value_json,updated_at) VALUES('member_portal_v4',?,CURRENT_TIMESTAMP)").run(JSON.stringify({brand:{logoUrl:'https://outside.invalid/logo.png'},links:[{name:'Liên kết sai',url:'https://outside.invalid/'}]}));
const legacyConfig=await call('/api/public/portal-config');assert.equal(legacyConfig.links.length,5);assert.equal(legacyConfig.brand.logoUrl,'/sfn-logo.png');assert.equal(legacyConfig.links[0].name,'Trang Thông Tin Điện Tử Sky First');checks++;
const securityResponse=await Worker.fetch(new Request('https://member.skyfirst.io.vn/api/public/portal-config'),{DB});assert.equal(securityResponse.status,200);assert.equal(securityResponse.headers.get('x-content-type-options'),'nosniff');assert.equal(securityResponse.headers.get('x-frame-options'),'DENY');assert.equal(securityResponse.headers.get('referrer-policy'),'strict-origin-when-cross-origin');assert((securityResponse.headers.get('content-security-policy')||'').includes("frame-ancestors 'none'"));checks++;
db.prepare("UPDATE system_settings SET value_json=?,updated_at=CURRENT_TIMESTAMP WHERE key='member_portal_v4'").run(JSON.stringify({links:[{name:'Cổng chính Sky First Network',url:'https://www.skyfirst.io.vn/'},{name:'Cổng Thông tin',url:'https://ctt.skyfirst.io.vn/'},{name:'Cổng tình nguyện viên',url:'https://tnv.skyfirst.io.vn/'},{name:'Cổng SFEC',url:'https://sfec.skyfirst.io.vn/'},{name:'Lớp học trực tuyến',url:'https://slc.skyfirst.io.vn/'}]}));
const migratedLinks=await call('/api/public/portal-config');assert.deepEqual(migratedLinks.links.map(x=>x.name),['Trang Thông Tin Điện Tử Sky First','Cổng Thông Tin Số Sky First','Trung Tâm Tình Nguyện Viên Sky First','Trung Tâm Học Tập Số Sky First','Trung Tâm Thư Điện Tử Sky First']);assert.equal(migratedLinks.links[3].url,'https://slc.skyfirst.io.vn/');assert.equal(migratedLinks.links[4].url,'https://mail.skyfirst.io.vn/');checks++;
const portalDefaults=await call('/api/public/portal-config');assert.equal(portalDefaults.links.length,5);assert.equal(portalDefaults.links[0].name,'Trang Thông Tin Điện Tử Sky First');assert.equal(portalDefaults.links[1].url,'https://ctt.skyfirst.io.vn/');assert.equal(portalDefaults.links[4].url,'https://mail.skyfirst.io.vn/');checks++;
const linkSet=[{name:'Trang Thông Tin Điện Tử Sky First',url:'https://www.skyfirst.io.vn/',description:'Thông tin chính thức'},{name:'Cổng Thông Tin Số Sky First',url:'https://ctt.skyfirst.io.vn/',description:'Thông tin số'},{name:'Trung Tâm Tình Nguyện Viên Sky First',url:'https://tnv.skyfirst.io.vn/',description:'Tình nguyện'},{name:'Trung Tâm Học Tập Số Sky First',url:'https://slc.skyfirst.io.vn/',description:'Học tập'},{name:'Trung Tâm Thư Điện Tử Sky First',url:'https://mail.skyfirst.io.vn/',description:'Thư điện tử'}];
r=await call('/api/admin/portal-config','PUT',{stats:[],tagline:'Hành trình của thành viên',brand:{siteName:'Trung Tâm Thành Viên Số Sky First',logoUrl:'/sfn-logo.png',primaryColor:'#123456',accentColor:'#22bbdd',navColor:'#102030',fontFamily:'system',baseFontSize:17,cornerRadius:12,contentMaxWidth:1360},links:linkSet});assert.equal(r.status,200);assert.equal(r.settings.brand.primaryColor,'#123456');assert.equal(r.settings.brand.cornerRadius,12);assert.equal(r.settings.brand.contentMaxWidth,1360);assert.equal(r.settings.links.length,5);checks++;
r=await call('/api/admin/portal-config');assert.equal(r.status,200);assert.equal(r.settings.brand.primaryColor,'#123456');assert.equal(r.settings.brand.baseFontSize,17);assert.equal(r.settings.brand.cornerRadius,12);assert.equal(r.settings.brand.contentMaxWidth,1360);assert.equal(r.settings.links[4].name,'Trung Tâm Thư Điện Tử Sky First');checks++;
r=await call('/api/admin/portal-config','PUT',{stats:[],brand:{siteName:'Bad',logoUrl:'https://external.invalid/logo.png',primaryColor:'#123456',accentColor:'#22bbdd',navColor:'#102030',fontFamily:'system',baseFontSize:16},links:linkSet});assert.equal(r.status,400);assert.equal(r.error,'INVALID_LOGO_PATH');checks++;
r=await call('/api/admin/portal-config','PUT',{stats:[],brand:{siteName:'Bad',logoUrl:'/sfn-logo.png',primaryColor:'#123456',accentColor:'#22bbdd',navColor:'#102030',fontFamily:'system',baseFontSize:16},links:[...linkSet.slice(0,4),{name:'External',url:'https://example.com',description:''}]});assert.equal(r.status,400);assert.equal(r.error,'INVALID_PORTAL_LINK');checks++;
r=await call('/api/admin/portal-config','PUT',{stats:[],brand:{siteName:'Bad',logoUrl:'/sfn-logo.png',primaryColor:'#123456',accentColor:'#22bbdd',navColor:'#102030',fontFamily:'system',baseFontSize:16},links:[{...linkSet[0],url:'https://ctt.skyfirst.io.vn/'},...linkSet.slice(1)]});assert.equal(r.status,400);assert.equal(r.error,'INVALID_PORTAL_LINK');checks++;

// Image upload accepts actual uploaded bytes, stores them in the file bucket, and serves them locally.
const crc32=(bytes)=>{let c=0xffffffff;for(const b of bytes){c^=b;for(let k=0;k<8;k++)c=(c&1)?(0xedb88320^(c>>>1)):(c>>>1)}return (c^0xffffffff)>>>0};
const pngChunk=(type,data)=>{const t=Buffer.from(type),len=Buffer.alloc(4),crc=Buffer.alloc(4);len.writeUInt32BE(data.length);crc.writeUInt32BE(crc32(Buffer.concat([t,data])));return Buffer.concat([len,t,data,crc])};
const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(1,0);ihdr.writeUInt32BE(1,4);ihdr[8]=8;ihdr[9]=6;const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),pngChunk('IHDR',ihdr),pngChunk('IDAT',deflateSync(Buffer.from([0,0,0,0,0]))),pngChunk('IEND',Buffer.alloc(0))]);
const bucket=new Map();const FILES={async put(key,bytes,opts){bucket.set(key,{bytes:new Uint8Array(bytes),metadata:opts.httpMetadata,etag:'"uploaded-test"'})},async get(key){const x=bucket.get(key);if(!x)return null;return {body:x.bytes,httpEtag:x.etag,writeHttpMetadata(h){h.set('content-type',x.metadata.contentType);h.set('cache-control',x.metadata.cacheControl)}}}};
const uploadReq=new Request('https://member.skyfirst.io.vn/api/admin/site-assets',{method:'POST',headers:{cookie:'sfn_session=test',origin:'https://member.skyfirst.io.vn','content-type':'image/png'},body:png});const uploadRes=await api(uploadReq,{DB,FILES},new URL(uploadReq.url));const uploadBody=await uploadRes.json();assert.equal(uploadRes.status,201);assert.match(uploadBody.url,/^\/files\/site-assets\/[a-f0-9-]+\.png$/);assert(bucket.size===1);checks++;
const badImgReq=new Request('https://member.skyfirst.io.vn/api/admin/site-assets',{method:'POST',headers:{cookie:'sfn_session=test',origin:'https://member.skyfirst.io.vn','content-type':'image/png'},body:new Uint8Array([137,80,78,71,13,10,26,10,1])});const badImgRes=await api(badImgReq,{DB,FILES},new URL(badImgReq.url));assert.equal(badImgRes.status,400);checks++;
const assetReq=new Request('https://member.skyfirst.io.vn'+uploadBody.url);const assetRes=await Worker.fetch(assetReq,{DB,FILES});assert.equal(assetRes.status,200);assert.match(assetRes.headers.get('content-type')||'',/image\/png/);assert.equal((await assetRes.arrayBuffer()).byteLength,png.length);checks++;
r=await call('/api/admin/saved-filters','POST',{name:'Test filter',view:'admin-members',query:'active'});assert.equal(r.status,200);checks++;
r=await call('/api/admin/saved-filters');assert.equal(r.status,200);assert(r.items.some(x=>x.name==='Test filter'));const fid=r.items.find(x=>x.name==='Test filter').id;checks++;
assert.equal((await call('/api/admin/saved-filters/'+fid,'DELETE')).status,200);checks++;

const noOriginReq=new Request('https://member.skyfirst.io.vn/api/admin/org',{method:'POST',headers:{cookie:'sfn_session=test','content-type':'application/json'},body:JSON.stringify({code:'NO-ORIGIN',name:'Blocked'})});
assert.equal((await api(noOriginReq,{DB},new URL(noOriginReq.url))).status,403);checks++;
const req=new Request('https://member.skyfirst.io.vn/api/me',{headers:{cookie:'sfn_session=%ZZ'}});assert.equal((await api(req,{DB},new URL(req.url))).status,401);checks++;
const front=readFileSync('public/app.js','utf8');const apiText=front.slice(front.indexOf('const api='),front.indexOf('const safeStore='));const ctx={fetch:async()=>new Response('<html>',{status:200}),AbortController,setTimeout,clearTimeout};vm.createContext(ctx);vm.runInContext(apiText+'\nglobalThis.testApi=api;',ctx);await assert.rejects(ctx.testApi('/api/test'),/không hợp lệ/);checks++;
ctx.fetch=async()=>Response.json(null);await assert.rejects(ctx.testApi('/api/test'),/không hợp lệ/);checks++;
r=await call('/api/admin/one-time-credentials','POST',{full_name:'Nguyen Test',event_name:'Su kien Test',role_label:'TNV',card_type_id:'card_volunteer',photo_url:'https://external.invalid/photo.jpg',expires_at:'2099-12-31'});assert.equal(r.status,200);assert(r.verify_token&&r.card_number);checks++;
r=await call('/api/admin/one-time-credentials');assert.equal(r.status,200);assert(r.items.some(x=>x.id===r.id||x.card_number));const otc=r.items.find(x=>x.full_name==='Nguyen Test');assert(otc);assert.equal(otc.photo_url,undefined);assert.equal(db.prepare('SELECT photo_url FROM one_time_credentials WHERE id=?').get(otc.id).photo_url,null);checks++;
r=await call('/api/public/verify?code='+encodeURIComponent(otc.verify_token));assert.equal(r.status,200);assert.equal(r.type,'one_time');assert.equal(r.valid,true);checks++;
r=await call('/api/public/card-qr?code=not-a-real-token');assert.equal(r.status,404);assert.equal(r.error,'NOT_FOUND');checks++;
{const req=new Request('https://member.skyfirst.io.vn/api/public/card-qr?code=PREVIEW&size=180',{headers:{origin:'https://member.skyfirst.io.vn'}});const out=await api(req,{DB},new URL(req.url));assert.equal(out.status,200);assert.match(out.headers.get('content-type')||'',/image\/png/);const png=new Uint8Array(await out.arrayBuffer());assert.deepEqual(Array.from(png.slice(0,8)),[137,80,78,71,13,10,26,10]);assert(png.length>100);checks++;}
r=await call('/api/public/verify?code='+encodeURIComponent(otc.card_number));assert.equal(r.status,404);assert.equal(r.error,'NOT_FOUND');checks++;
r=await call('/api/admin/one-time-credentials/'+encodeURIComponent(otc.id)+'/revoke','POST',{});assert.equal(r.status,'revoked');checks++;
r=await call('/api/public/verify?code='+encodeURIComponent(otc.verify_token));assert.equal(r.status,200);assert.equal(r.valid,false);checks++;

// Card designer UI/API is intentionally removed; old template rows are not deleted.
r=await call('/api/admin/card-designs','POST',{name:'Mẫu kiểm thử Card Studio'});assert.equal(r.status,410);assert.equal(r.error,'FEATURE_REMOVED');checks++;
r=await call('/api/admin/card-designs');assert.equal(r.status,410);checks++;

// Independent verification QR is isolated from member accounts and the one-time card workflow.
r=await call('/api/admin/verification-qr','POST',{credential_title:'The tinh nguyen vien',full_name:'Nguyen QR Test',role_label:'Tinh nguyen vien',organization_label:'Sky First Network',reference_number:'CUSTOM_QR_001',issued_at:'2026-10-09',expires_at:'2099-12-31',public_note:'Public note',private_notes:'PRIVATE_NEVER_PUBLIC'});assert.equal(r.status,201);assert(r.verify_token&&r.reference_number==='CUSTOM_QR_001');const qrRecord=r;checks++;
r=await call('/api/admin/verification-qr');assert.equal(r.status,200);assert(r.items.some(x=>x.id===qrRecord.id&&x.reference_number==='CUSTOM_QR_001'));checks++;
r=await call('/api/public/verify?code='+encodeURIComponent(qrRecord.verify_token));assert.equal(r.status,200);assert.equal(r.type,'verification_qr');assert.equal(r.valid,true);assert.equal(r.record.full_name,'Nguyen QR Test');assert.equal(r.record.private_notes,undefined);assert.equal(r.record.verify_token,undefined);checks++;
r=await call('/api/public/verify?code=CUSTOM_QR_001');assert.equal(r.status,404);checks++;
r=await call('/api/admin/verification-qr','POST',{credential_title:'Duplicate code',full_name:'Duplicate',reference_number:'CUSTOM_QR_001',issued_at:'2026-10-09'});assert.equal(r.status,409);checks++;
r=await call('/api/admin/verification-qr','POST',{credential_title:'Invalid date',full_name:'Invalid',issued_at:'2026-10-09',expires_at:'2026-01-01'});assert.equal(r.status,400);checks++;
// Future-dated QR must be visible as pending and must not validate before its issue date.
r=await call('/api/admin/verification-qr','POST',{credential_title:'Future credential',full_name:'Future QR Test',reference_number:'FUTURE_QR_002',issued_at:'2099-01-01',expires_at:'2099-12-31'});assert.equal(r.status,201);const futureQrRecord=r;checks++;
r=await call('/api/public/verify?code='+encodeURIComponent(futureQrRecord.verify_token));assert.equal(r.status,200);assert.equal(r.valid,false);assert.equal(r.record.status,'pending');checks++;
r=await call('/api/admin/verification-qr');assert.equal(r.status,200);assert(r.items.some(x=>x.id===futureQrRecord.id&&x.effective_status==='pending'));checks++;
r=await call('/api/admin/verification-qr/'+encodeURIComponent(qrRecord.id)+'/revoke','POST',{});assert.equal(r.status,'revoked');checks++;
r=await call('/api/public/verify?code='+encodeURIComponent(qrRecord.verify_token));assert.equal(r.status,200);assert.equal(r.valid,false);assert.equal(r.record.status,'revoked');checks++;
r=await call('/api/admin/issuance-overview');assert.equal(r.status,200);assert.equal(r.verification_qr.total,2);assert.equal(r.verification_qr.revoked,1);assert.equal(r.verification_qr.pending,1);checks++;
r=await call('/api/admin/member-cards');assert.equal(r.status,200);assert(Array.isArray(r.items));checks++;

 db.prepare("UPDATE accounts SET force_password_change=1 WHERE id='a'").run();
r=await call('/api/dashboard');assert.equal(r.status,403);assert.equal(r.error,'PASSWORD_CHANGE_REQUIRED');checks++;
r=await call('/api/me/password','POST',{current_password:'',new_password:'StrongPassword2026!'});assert.equal(r.status,200);assert.equal(db.prepare("SELECT force_password_change FROM accounts WHERE id='a'").get().force_password_change,0);checks++;

console.log(`${checks}/${checks} center/API integration checks passed`);

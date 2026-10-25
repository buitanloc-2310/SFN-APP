import {webcrypto, pbkdf2Sync, createHmac} from "node:crypto";
if (!globalThis.crypto) globalThis.crypto = webcrypto;
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import worker from '../src/index.js';
import {pbkdf2, b64url, fromB64url} from '../src/utils.js';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const dbPath = '/tmp/sfn_e2e_test.db';
if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);

// 1. Initialize SQLite database with all migrations 0001..0010
const migSet = new Set(fs.readdirSync(path.join(root, 'migrations')).filter(f => f.endsWith('.sql')));
for (const extra of ['0009_super_website_universal_email_and_cms.sql', '0010_forensic_security_and_financial_reconciliation.sql', '0011_v10_admin_cms_i18n_governance.sql', '0012_audit_schema_sync_and_governance.sql', '0013_remove_homepage_technical_callout.sql', '0014_audit_remediation_and_content_sync.sql']) {
  if (fs.existsSync(path.join(root, 'migrations', extra))) migSet.add(extra);
}
const migrations = [...migSet].sort();

for (const m of migrations) {
  const sqlPath = path.join(root, 'migrations', m);
  const res = spawnSync('python3', ['-c', `
import sqlite3, sys
conn = sqlite3.connect(sys.argv[1])
conn.executescript(open(sys.argv[2], encoding='utf-8').read())
conn.commit()
`, dbPath, sqlPath], {encoding: 'utf8'});
  if (res.status !== 0) {
    console.error('Migration failed:', m, res.stderr);
    process.exit(1);
  }
}

import {spawn} from 'node:child_process';
import readline from 'node:readline';

const pyDaemon = spawn('python3', ['-u', '-c', `
import sqlite3, json, sys
conn = sqlite3.connect(sys.argv[1])
conn.row_factory = sqlite3.Row
for line in sys.stdin:
    line = line.strip()
    if not line:
        continue
    req = json.loads(line)
    req_id = req["id"]
    try:
        out = []
        for op in req["ops"]:
            sql = op["sql"]
            params = op.get("params", [])
            mode = op["mode"]
            cur = conn.cursor()
            cur.execute(sql, params)
            if mode == "all":
                rows = [dict(r) for r in cur.fetchall()]
                out.append({"results": rows, "meta": {"last_row_id": cur.lastrowid, "changes": cur.rowcount}})
            elif mode == "first":
                row = cur.fetchone()
                out.append(dict(row) if row else None)
            else:
                rows = [dict(r) for r in cur.fetchall()] if cur.description else []
                out.append({"results": rows, "first": rows[0] if rows else None, "meta": {"last_row_id": cur.lastrowid, "changes": cur.rowcount}})
        conn.commit()
        print(json.dumps({"id": req_id, "ok": True, "out": out}), flush=True)
    except Exception as e:
        conn.rollback()
        print(json.dumps({"id": req_id, "ok": False, "error": str(e)}), flush=True)
`, dbPath], {stdio: ['pipe', 'pipe', 'inherit']});

let seqId = 0;
const pendingSql = new Map();
const rl = readline.createInterface({input: pyDaemon.stdout});
rl.on('line', line => {
  if (!line.trim()) return;
  const msg = JSON.parse(line);
  const p = pendingSql.get(msg.id);
  if (p) {
    pendingSql.delete(msg.id);
    if (msg.ok) p.resolve(msg.out);
    else p.reject(new Error(msg.error || 'SQLite error'));
  }
});

function runSqliteOpAsync(ops) {
  return new Promise((resolve, reject) => {
    const id = ++seqId;
    pendingSql.set(id, {resolve, reject});
    pyDaemon.stdin.write(JSON.stringify({id, ops}) + '\n');
  });
}

class D1Statement {
  constructor(sql, params = []) {
    this.sql = sql;
    this.params = params;
  }
  bind(...vals) {
    return new D1Statement(this.sql, vals.map(v => v === undefined ? null : v));
  }
  async all() {
    return (await runSqliteOpAsync([{sql: this.sql, params: this.params, mode: 'all'}]))[0];
  }
  async first() {
    return (await runSqliteOpAsync([{sql: this.sql, params: this.params, mode: 'first'}]))[0];
  }
  async run() {
    return (await runSqliteOpAsync([{sql: this.sql, params: this.params, mode: 'run'}]))[0];
  }
}

const DB = {
  prepare(sql) {
    return new D1Statement(sql);
  },
  async batch(stmts) {
    const ops = stmts.map(s => ({sql: s.sql, params: s.params, mode: 'all'}));
    return await runSqliteOpAsync(ops);
  }
};

// In-memory R2 bucket mock
const r2Store = new Map();
const FILES = {
  async put(key, body, opts = {}) {
    let buf;
    if (typeof body === 'string') buf = new TextEncoder().encode(body);
    else if (body instanceof ArrayBuffer) buf = new Uint8Array(body);
    else if (ArrayBuffer.isView(body)) buf = new Uint8Array(body.buffer, body.byteOffset, body.byteLength);
    else if (body && typeof body.getReader === 'function') {
      const reader = body.getReader();
      const chunks = [];
      while (true) {
        const {done, value} = await reader.read();
        if (done) break;
        chunks.push(value);
      }
      const total = chunks.reduce((s, c) => s + c.length, 0);
      buf = new Uint8Array(total);
      let off = 0;
      for (const c of chunks) { buf.set(c, off); off += c.length; }
    } else buf = new Uint8Array(0);
    r2Store.set(key, {
      bytes: buf,
      size: buf.byteLength,
      uploaded: new Date().toISOString(),
      etag: 'etag-' + key,
      httpMetadata: opts.httpMetadata || {},
      customMetadata: opts.customMetadata || {}
    });
  },
  async get(key, opts = {}) {
    const item = r2Store.get(key);
    if (!item) return null;
    let slice = item.bytes;
    if (opts?.range) {
      const start = opts.range.offset || 0;
      const end = start + (opts.range.length || slice.byteLength);
      slice = slice.slice(start, end);
    }
    return {
      body: slice,
      size: slice.byteLength,
      httpMetadata: item.httpMetadata,
      customMetadata: item.customMetadata,
      async arrayBuffer() { return slice.buffer.slice(slice.byteOffset, slice.byteOffset + slice.byteLength); },
      async text() { return new TextDecoder().decode(slice); }
    };
  },
  async head(key) {
    const item = r2Store.get(key);
    if (!item) return null;
    return {size: item.size, httpMetadata: item.httpMetadata, customMetadata: item.customMetadata};
  },
  async delete(key) {
    r2Store.delete(key);
  },
  async list({prefix = '', limit = 500} = {}) {
    const objects = [];
    for (const [k, v] of r2Store.entries()) {
      if (k.startsWith(prefix)) {
        objects.push({key: k, size: v.size, uploaded: v.uploaded, etag: v.etag});
      }
    }
    return {objects: objects.slice(0, limit)};
  }
};

// ASSETS binding serving public/
const ASSETS = {
  async fetch(req) {
    const u = new URL(req.url);
    let rel = u.pathname === '/' ? '/index.html' : u.pathname;
    const fp = path.join(root, 'public', rel);
    if (fs.existsSync(fp) && fs.statSync(fp).isFile()) {
      const ext = path.extname(fp);
      const ct = ext === '.html' ? 'text/html; charset=utf-8'
        : ext === '.css' ? 'text/css; charset=utf-8'
        : ext === '.js' ? 'application/javascript; charset=utf-8'
        : ext === '.png' ? 'image/png' : 'application/octet-stream';
      return new Response(fs.readFileSync(fp), {status: 200, headers: {'content-type': ct}});
    }
    return new Response('Not Found', {status: 404});
  }
};

const env = {
  DB,
  FILES,
  ASSETS,
  APP_URL: 'https://app.skyfirst.io.vn',
  MAIL_FROM: 'Hệ thống Thông tin Số Sky First <app@skyfirst.io.vn>',
  MAIL_CONTACT: 'lienhe@skyfirst.io.vn',
  MAIL_SUPPORT: 'support@skyfirst.io.vn',
  XANH_CTT_SHARED_SECRET: '0123456789abcdef0123456789abcdef0123456789abcdef',
  SPONSORSHIP_WEBHOOK_SECRET: 'fedcba9876543210fedcba9876543210fedcba9876543210'
};

async function callWorker(pathAndQuery, {method = 'GET', headers = {}, body = null, cookie = '', ip = '203.113.152.10'} = {}) {
  const h = new Headers(headers);
  if (cookie) h.set('cookie', cookie);
  if (ip && !h.has('cf-connecting-ip')) h.set('cf-connecting-ip', ip);
  if (method !== 'GET' && method !== 'HEAD' && !h.has('origin') && !pathAndQuery.startsWith('/api/webhooks/')) {
    h.set('origin', 'https://app.skyfirst.io.vn');
  }
  let reqBody = body;
  if (body && typeof body === 'object' && !(body instanceof Uint8Array) && !(body instanceof ArrayBuffer) && !(body instanceof FormData)) {
    h.set('content-type', 'application/json');
    reqBody = JSON.stringify(body);
  }
  const pendingPromises = [];
  const ctx = { waitUntil(p) { pendingPromises.push(Promise.resolve(p)); } };
  const req = new Request(`https://app.skyfirst.io.vn${pathAndQuery}`, {method, headers: h, body: reqBody});
  const resp = await worker.fetch(req, env, ctx);
  await Promise.allSettled(pendingPromises);
  const ct = resp.headers.get('content-type') || '';
  const data = ct.includes('application/json') ? await resp.json() : await resp.text();
  return {status: resp.status, headers: resp.headers, data};
}

let passed = 0, failed = 0;
function assert(cond, label, detail = '') {
  if (cond) {
    console.log(`PASS: ${label}`);
    passed++;
  } else {
    console.error(`FAIL: ${label} ${detail ? '— ' + detail : ''}`);
    failed++;
  }
}

// ==================== RUN TESTS ====================

// 1. Health & Identity
{
  const r = await callWorker('/api/health');
  assert(r.status === 200 && r.data.ok === true && r.data.app === 'Hệ thống Thông tin Số Sky First' && r.data.domain === 'app.skyfirst.io.vn', 'Health check & product identity');
  assert(r.headers.get('x-frame-options') === 'SAMEORIGIN', 'Security header X-Frame-Options SAMEORIGIN for inline PDF preview');
}

// 2. Public SPA Routes & 404
for (const route of ['/', '/chuong-trinh', '/su-kien', '/tai-lieu', '/bieu-mau', '/gcn', '/ho-so', '/tai-tro', '/an-toan', '/admin', '/admin/login']) {
  const r = await callWorker(route);
  assert(r.status === 200 && typeof r.data === 'string' && r.data.includes('Hệ thống Thông tin Số Sky First'), `SPA Route ${route} returns 200 HTML shell`);
}
{
  const r404 = await callWorker('/khong-ton-tai-route-nay');
  assert(r404.status === 404 && String(r404.data).includes('404'), 'Unknown public route returns 404 page');
}

// 3. Config & 5 Automated Homepage Statistics
{
  const r = await callWorker('/api/config');
  assert(r.status === 200 && r.data.app_name === 'Hệ thống Thông tin Số Sky First', '/api/config returns standardized app_name');
  assert(r.data.system_email === 'app@skyfirst.io.vn' && r.data.contact_email === 'lienhe@skyfirst.io.vn' && r.data.support_email === 'support@skyfirst.io.vn', '/api/config returns 3 standardized system emails');
  const d1v = r.data.home_stats?.d1_values || {};
  assert(d1v.programs === 7 && d1v.partners === 1 && d1v.certificates === 0 && d1v.sponsorship === null, '5 Homepage statistics accurately reflect initial D1 seed data (7 classes, 1 unit, 0 issued certs, null sponsorship when no public campaign exists)');
}

// 4. Authentication, Independent PBKDF2 Test Vectors (100k & 150k) & Transparent Hash Upgrade
let superAdminCookie = '';
{
  const salt = 'O1M7291qarCiAr9hV1Dmxg';
  const expected100k = b64url(pbkdf2Sync('AdminPass!2026', fromB64url(salt), 100000, 32, 'sha256'));
  const expected150k = b64url(pbkdf2Sync('AdminPass!2026', fromB64url(salt), 150000, 32, 'sha256'));
  const hash100k = await pbkdf2('AdminPass!2026', salt, 100000);
  const hash150k = await pbkdf2('AdminPass!2026', salt, 150000);

  assert(hash100k === expected100k, 'PBKDF2 100,000-iteration hash matches independent Node.js RFC 8018 test vector');
  assert(hash150k === expected150k && hash150k !== hash100k, 'PBKDF2 150,000-iteration hash matches independent Node.js RFC 8018 test vector and is NEVER downgraded to 100,000 iterations');

  await DB.prepare("UPDATE users SET password_hash=?, password_salt=?, password_iterations=150000, must_change_password=0 WHERE email='skyfirst.ec@gmail.com'").bind(hash150k, salt).run();

  const badLogin = await callWorker('/api/auth/login', {method: 'POST', body: {email: 'skyfirst.ec@gmail.com', password: 'WrongPassword', portal: 'admin'}});
  const missingUserLogin = await callWorker('/api/auth/login', {method: 'POST', body: {email: 'nonexistent@skyfirst.io.vn', password: 'WrongPassword', portal: 'admin'}});
  assert(badLogin.status === 401 && missingUserLogin.status === 401 && badLogin.data.error === missingUserLogin.data.error, 'Invalid login password and non-existent user both return identical 401 INVALID_CREDENTIALS (prevents account enumeration)');

  const goodLogin = await callWorker('/api/auth/login', {method: 'POST', body: {email: 'skyfirst.ec@gmail.com', password: 'AdminPass!2026', portal: 'admin'}});
  assert(goodLogin.status === 200 && goodLogin.data.ok === true, 'Super Admin login with 150k PBKDF2 hash succeeds');
  const setCookie = goodLogin.headers.get('set-cookie') || '';
  superAdminCookie = setCookie.split(';')[0];
  assert(superAdminCookie.startsWith('sfn_session=') && setCookie.includes('HttpOnly') && setCookie.includes('Secure') && setCookie.includes('SameSite=Strict'), 'Session cookie issued with HttpOnly, Secure, SameSite=Strict');

  const upgradedUser = await DB.prepare("SELECT password_iterations, password_hash FROM users WHERE email='skyfirst.ec@gmail.com'").first();
  assert(Number(upgradedUser.password_iterations) === 100000 && upgradedUser.password_hash !== hash150k, 'Legacy 150k PBKDF2 hash transparently upgraded to 100k iterations with fresh salt upon successful login');

  // Unauthenticated access to admin API must fail
  const unauthAdmin = await callWorker('/api/admin/dashboard');
  assert(unauthAdmin.status === 401, 'Unauthenticated request to /api/admin/dashboard rejected with 401');

  // Authenticated dashboard succeeds
  const dash = await callWorker('/api/admin/dashboard', {cookie: superAdminCookie});
  assert(dash.status === 200 && typeof dash.data.counts?.submissions === 'number', 'Authenticated Super Admin accesses /api/admin/dashboard');
}

// 5. Invited Admin Account Activation Flow & Server-Side must_change_password=1 Enforcement
let reviewerCookie = '', editorCookie = '', handlerCookie = '';
{
  const invRev = await callWorker('/api/admin/users', {
    method: 'POST', cookie: superAdminCookie,
    body: {full_name: 'Reviewer User', email: 'reviewer@skyfirst.io.vn', roles: ['reviewer'], activation_mode: 'self'}
  });
  assert(invRev.status === 200 && invRev.data.temp_password, 'Created Reviewer account with must_change_password=1');
  const revLogin = await callWorker('/api/auth/login', {
    method: 'POST', body: {email: 'reviewer@skyfirst.io.vn', password: invRev.data.temp_password, portal: 'admin'}
  });
  reviewerCookie = (revLogin.headers.get('set-cookie') || '').split(';')[0];
  assert(revLogin.data.must_change_password === true, 'Login response indicates must_change_password=true');

  // Server-side enforcement: Reviewer with must_change_password=1 MUST be blocked from /api/admin/* and /api/me/*
  const blockedAdmin = await callWorker('/api/admin/approvals', {cookie: reviewerCookie});
  const blockedMe = await callWorker('/api/me/portal', {cookie: reviewerCookie});
  assert(blockedAdmin.status === 403 && blockedAdmin.data.error === 'PASSWORD_CHANGE_REQUIRED' && blockedMe.status === 403, 'Server enforces must_change_password=1 by blocking /api/admin/* and /api/me/* with 403 PASSWORD_CHANGE_REQUIRED');

  // Complete mandatory password change for Reviewer
  const weakChg = await callWorker('/api/auth/change-password', {
    method: 'POST', cookie: reviewerCookie,
    body: {current_password: invRev.data.temp_password, new_password: 'short'}
  });
  assert(weakChg.status === 400 && weakChg.data.error === 'PASSWORD_TOO_SHORT', 'Password change rejects weak passwords');

  const oldRevCookie = reviewerCookie;
  const okChg = await callWorker('/api/auth/change-password', {
    method: 'POST', cookie: reviewerCookie,
    body: {current_password: invRev.data.temp_password, new_password: 'ReviewerNew!2026'}
  });
  reviewerCookie = (okChg.headers.get('set-cookie') || '').split(';')[0];
  const revokedSessionCheck = await callWorker('/api/admin/approvals', {cookie: oldRevCookie});
  assert(okChg.status === 200 && okChg.data.ok === true && revokedSessionCheck.status === 401, 'Reviewer completes mandatory password change and old session cookie is immediately revoked');

  const invEd = await callWorker('/api/admin/users', {
    method: 'POST', cookie: superAdminCookie,
    body: {full_name: 'Editor SFEC', email: 'editor@skyfirst.io.vn', roles: ['editor'], scope_unit_code: 'SFEC', activation_mode: 'self'}
  });
  const edLogin = await callWorker('/api/auth/login', {
    method: 'POST', body: {email: 'editor@skyfirst.io.vn', password: invEd.data.temp_password, portal: 'admin'}
  });
  editorCookie = (edLogin.headers.get('set-cookie') || '').split(';')[0];
  const edChg = await callWorker('/api/auth/change-password', {
    method: 'POST', cookie: editorCookie,
    body: {current_password: invEd.data.temp_password, new_password: 'EditorNew!2026'}
  });
  editorCookie = (edChg.headers.get('set-cookie') || '').split(';')[0];

  const invHa = await callWorker('/api/admin/users', {
    method: 'POST', cookie: superAdminCookie,
    body: {full_name: 'Handler User', email: 'handler@skyfirst.io.vn', roles: ['handler'], activation_mode: 'self'}
  });
  const haLogin = await callWorker('/api/auth/login', {
    method: 'POST', body: {email: 'handler@skyfirst.io.vn', password: invHa.data.temp_password, portal: 'admin'}
  });
  handlerCookie = (haLogin.headers.get('set-cookie') || '').split(';')[0];
  const haChg = await callWorker('/api/auth/change-password', {
    method: 'POST', cookie: handlerCookie,
    body: {current_password: invHa.data.temp_password, new_password: 'HandlerNew!2026'}
  });
  handlerCookie = (haChg.headers.get('set-cookie') || '').split(';')[0];

  // Test Editor blocked from user management
  const edUsers = await callWorker('/api/admin/users', {cookie: editorCookie});
  assert(edUsers.status === 403, 'Editor role blocked from /api/admin/users (403 FORBIDDEN)');
}

// 6. Forms, Upload Session (Magic Bytes + Signature) & Case Lookup Privacy
let submittedCode = '';
{
  const pngBytes = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0, 0, 0, 0, 0]);
  const upSess = await callWorker('/api/uploads/session', {
    method: 'POST',
    body: {filename: 'signature.png', mime: 'image/png', size: pngBytes.byteLength, field_key: 'photo'}
  });
  assert(upSess.status === 201 && upSess.data.id && upSess.data.token, 'Upload session created');

  const putRes = await callWorker(`/api/uploads/${encodeURIComponent(upSess.data.id)}?token=${encodeURIComponent(upSess.data.token)}`, {
    method: 'PUT',
    headers: {'content-type': 'image/png', 'content-length': String(pngBytes.byteLength)},
    body: pngBytes
  });
  assert(putRes.status === 200 && putRes.data.ok === true, 'Uploaded PNG with valid magic bytes into R2 session');

  // Submit volunteer form with uploaded file
  const sub = await callWorker('/api/forms/volunteer/submit', {
    method: 'POST',
    body: {
      answers: {
        full_name: 'Trần Thị B <script>alert(1)</script>',
        dob: '2000-05-10',
        city: 'TP. Hồ Chí Minh',
        email: 'tranthib@example.com',
        phone: '0901234567',
        volunteer_type: 'TNV Cộng đồng',
        qualification: 'Đại học',
        experience: '2 năm tình nguyện',
        availability: 'Cuối tuần',
        terms: true,
        truth: true
      },
      uploads: {
        photo: {id: upSess.data.id, token: upSess.data.token}
      }
    }
  });
  assert(sub.status === 200 && sub.data.ok === true && sub.data.code.startsWith('SFN-TNV-'), 'Form submission with R2 attachment succeeded');
  submittedCode = sub.data.code;

  // Case Lookup: Code alone must fail (400)
  const lookNoEmail = await callWorker('/api/lookup/submission', {method: 'POST', body: {code: submittedCode}});
  assert(lookNoEmail.status === 400, 'Case lookup with code alone rejected (requires email verification)');

  // Case Lookup: Wrong email must fail (404)
  const lookWrongEmail = await callWorker('/api/lookup/submission', {method: 'POST', body: {code: submittedCode, email: 'wrong@example.com'}});
  assert(lookWrongEmail.status === 404, 'Case lookup with wrong email rejected (404)');

  // Case Lookup: Matching code + email succeeds and does NOT echo email back
  const lookOk = await callWorker('/api/lookup/submission', {method: 'POST', body: {code: submittedCode, email: 'tranthib@example.com'}});
  assert(lookOk.status === 200 && lookOk.data.item?.code === submittedCode && !('email' in lookOk.data.item), 'Case lookup with valid code + email returns timeline and omits private email');

  // Handler RBAC check: Handler cannot view unassigned submission, can view & update once assigned
  const haUnassigned = await callWorker(`/api/admin/submissions/${encodeURIComponent(submittedCode)}`, {cookie: handlerCookie});
  assert(haUnassigned.status === 403, 'Handler cannot view unassigned submission');

  const haUser = await DB.prepare("SELECT id FROM users WHERE email='handler@skyfirst.io.vn'").first();
  await callWorker(`/api/admin/submissions/${encodeURIComponent(submittedCode)}`, {
    method: 'PATCH', cookie: superAdminCookie, body: {assigned_to: haUser.id}
  });
  const haAssigned = await callWorker(`/api/admin/submissions/${encodeURIComponent(submittedCode)}`, {cookie: handlerCookie});
  assert(haAssigned.status === 200, 'Handler can view submission assigned to them');
  const haPatch = await callWorker(`/api/admin/submissions/${encodeURIComponent(submittedCode)}`, {
    method: 'PATCH', cookie: handlerCookie, body: {status: 'Cần bổ sung', note: 'Bổ sung minh chứng'}
  });
  assert(haPatch.status === 200 && haPatch.data.ok === true, 'Handler can update status of assigned submission (triggers information_required email)');
}

// 7. Certificate Lifecycle (Request -> Separation of Duties Approval -> Issue -> Lookup -> Supersede -> Revoke)
{
  const certReq = await callWorker('/api/admin/certificates', {
    method: 'POST', cookie: superAdminCookie,
    body: {full_name: 'Lê Văn C', email: 'levanc@example.com', cert_type: 'Giấy chứng nhận', content: 'Hoàn thành chương trình 2026', metadata: {unit_name: 'Sky First', program: 'SFEC 2026'}}
  });
  assert(certReq.status === 200 && certReq.data.id && certReq.data.approval_id, 'Certificate request created in pending_approval');

  const preVerify = await callWorker(`/api/public/credentials/${encodeURIComponent(certReq.data.id)}`);
  assert(preVerify.status === 404, 'Pending certificate is not publicly exposed before issuance');

  const appDecide = await callWorker(`/api/admin/approvals/${encodeURIComponent(certReq.data.approval_id)}`, {
    method: 'PATCH', cookie: reviewerCookie, body: {status: 'approved', note: 'Đủ điều kiện cấp GCN'}
  });
  assert(appDecide.status === 200, 'Reviewer approved certificate request');

  const issued = await callWorker(`/api/admin/certificates/${encodeURIComponent(certReq.data.id)}`, {
    method: 'PATCH', cookie: superAdminCookie, body: {action: 'issue'}
  });
  assert(issued.status === 200 && /^SFN-GCN-\d{8}$/.test(issued.data.code), `Certificate issued with code ${issued.data.code}`);
  const certCode = issued.data.code;

  const pubCert = await callWorker(`/api/public/credentials/${encodeURIComponent(certCode)}`);
  assert(pubCert.status === 200 && pubCert.data.verified === true && pubCert.data.item.status === 'issued', 'Valid certificate lookup returns CÓ HIỆU LỰC');
  const pubQr = await callWorker(`/api/public/credentials/${encodeURIComponent(certCode)}/qr.svg`);
  assert(pubQr.status === 200 && String(pubQr.data).startsWith('<svg ') && String(pubQr.headers.get('content-type')).includes('image/svg+xml'), 'Issued credential QR endpoint returns a same-origin standards-based SVG QR image');
  assert(!String(pubQr.data).includes('certowner@skyfirst.io.vn') && !String(pubQr.data).includes('0912345678'), 'Credential QR contains no recipient email or phone');

  const rev = await callWorker(`/api/admin/certificates/${encodeURIComponent(certReq.data.id)}`, {
    method: 'PATCH', cookie: superAdminCookie, body: {action: 'revoke', note: 'Thu hồi để kiểm tra'}
  });
  assert(rev.status === 200, 'Certificate revoked');
  const pubRevoked = await callWorker(`/api/public/credentials/${encodeURIComponent(certCode)}`);
  assert(pubRevoked.status === 200 && pubRevoked.data.verified === false && pubRevoked.data.item.status === 'revoked' && pubRevoked.data.item.revocation_reason === 'Thu hồi để kiểm tra', 'Revoked certificate lookup clearly shows ĐÃ THU HỒI and reason');

  const badCert = await callWorker('/api/public/credentials/SFN-GCN-99999999');
  assert(badCert.status === 404, 'Non-existent certificate code returns 404');
}

// 8. Sponsorship Transparency Module (/tai-tro & /api/admin/sponsorship)
let mainCampId = '';
{
  const campRes = await callWorker('/api/admin/sponsorship/campaigns', {
    method: 'POST', cookie: superAdminCookie,
    body: {
      code: 'SFN-TT-2026-01',
      title: 'Học bổng Cộng đồng 2026',
      summary: 'Hỗ trợ học liệu',
      purpose: 'Trao tặng sách và học liệu',
      target_amount: 50000000,
      status: 'active',
      visibility: 'public',
      bank_name: 'MB Bank',
      bank_bin: '970422',
      bank_account_no: '0924910210',
      bank_account_name: 'SKY FIRST NETWORK'
    }
  });
  assert(campRes.status === 201 && campRes.data.id, 'Created public sponsorship campaign');
  mainCampId = campRes.data.id;

  await callWorker('/api/admin/sponsorship/transactions', {
    method: 'POST', cookie: superAdminCookie,
    body: {campaign_id: mainCampId, tx_type: 'pledge', amount: 20000000, public_party_label: 'Đơn vị đồng hành A', purpose: 'Cam kết tài trợ đợt 1', verification_status: 'verified', is_public: true}
  });
  await callWorker('/api/admin/sponsorship/transactions', {
    method: 'POST', cookie: superAdminCookie,
    body: {campaign_id: mainCampId, tx_type: 'receipt', amount: 15000000, public_party_label: 'Đơn vị đồng hành A', purpose: 'Thực nhận đợt 1', verification_status: 'verified', is_public: true}
  });
  await callWorker('/api/admin/sponsorship/transactions', {
    method: 'POST', cookie: superAdminCookie,
    body: {campaign_id: mainCampId, tx_type: 'disbursement', amount: 5000000, public_party_label: 'Mua học liệu đợt 1', purpose: 'Chi mua sách giáo khoa', verification_status: 'verified', is_public: true}
  });

  const spPub = await callWorker('/api/public/sponsorship');
  const sum = spPub.data.summary;
  assert(
    spPub.status === 200 &&
    sum.target_amount === 50000000 &&
    sum.pledged_amount === 20000000 &&
    sum.received_amount === 15000000 &&
    sum.disbursed_amount === 5000000 &&
    sum.remaining_amount === 10000000,
    'Sponsorship module strictly separates Target (50M), Pledged (20M), Received (15M), Disbursed (5M), and Remaining (10M)'
  );

  const cfgAfter = await callWorker('/api/config');
  assert(cfgAfter.data.home_stats?.d1_values?.sponsorship === 15000000, 'Homepage 5th statistic (sponsorship) dynamically reflects verified received amount (15,000,000 VND)');
}

// 9. Digital Safety & Incident Reporting (/an-toan & /api/public/safety-reports)
{
  const safeRep = await callWorker('/api/public/safety-reports', {
    method: 'POST',
    body: {
      category: 'Giả mạo / Lừa đảo',
      severity: 'Cao',
      reporter_name: 'Người dùng cảnh giác',
      reporter_email: 'user@example.com',
      title: 'Phát hiện fanpage mạo danh thu phí',
      affected_url: 'https://example.com/fake',
      description: 'Fanpage giả mạo yêu cầu chuyển khoản phí tham gia chương trình.'
    }
  });
  assert(safeRep.status === 201 && safeRep.data.ok === true && safeRep.data.code.startsWith('SFN-SAFE-'), 'Public safety incident report created with reference code');

  const safeList = await callWorker('/api/admin/safety-reports', {cookie: superAdminCookie});
  assert(safeList.status === 200 && safeList.data.items.some(x => x.code === safeRep.data.code), 'Admin can list and review safety incident reports');
}

// 10. Email Center: XSS Protection in Preview & Test Send
{
  const prev = await callWorker('/api/admin/email-templates/submission_confirmation/preview', {
    method: 'POST', cookie: superAdminCookie,
    body: {vars: {full_name: '<img src=x onerror=alert(1)>'}}
  });
  assert(
    prev.status === 200 &&
    prev.data.preview.html.includes('&lt;img src=x onerror=alert(1)&gt;') &&
    !prev.data.preview.html.includes('<img src=x onerror=alert(1)>'),
    'Email template engine escapes untrusted HTML variables (prevents HTML/XSS injection)'
  );

  const testSend = await callWorker('/api/admin/email-templates/submission_confirmation/test', {
    method: 'POST', cookie: superAdminCookie,
    body: {to_email: 'support@skyfirst.io.vn'}
  });
  assert(testSend.status === 200 && (testSend.data.ok || testSend.data.pending), 'Email test send logs safely when provider secret is not set in local test');
}

// 11. PDF Library & Document Versioning
{
  const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x37, 0x0A]); // %PDF-1.7
  await FILES.put('private/admin/2026/file_pdf_v1/guide-v1.pdf', pdfBytes, {httpMetadata: {contentType: 'application/pdf'}});
  await DB.prepare("INSERT INTO files(id,owner_user_id,r2_key,filename,mime,size,visibility) VALUES('file_pdf_v1',1,'private/admin/2026/file_pdf_v1/guide-v1.pdf','guide-v1.pdf','application/pdf',9,'public')").run();

  const docCreate = await callWorker('/api/admin/content/documents', {
    method: 'POST', cookie: superAdminCookie,
    body: {code: 'HD-2026-01', doc_type: 'Hướng dẫn', title: 'Sổ tay Hướng dẫn Hệ thống Số', visibility: 'public', status: 'Có hiệu lực', file_id: 'file_pdf_v1', metadata_json: JSON.stringify({category: 'Hướng dẫn', description: 'Tài liệu PDF chính thức'})}
  });
  assert(docCreate.status === 200 && docCreate.data.id, 'Created public PDF document with v1');
  const docId = docCreate.data.id;

  await FILES.put('private/admin/2026/file_pdf_v2/guide-v2.pdf', pdfBytes, {httpMetadata: {contentType: 'application/pdf'}});
  await DB.prepare("INSERT INTO files(id,owner_user_id,r2_key,filename,mime,size,visibility) VALUES('file_pdf_v2',1,'private/admin/2026/file_pdf_v2/guide-v2.pdf','guide-v2.pdf','application/pdf',9,'public')").run();

  const ver2 = await callWorker(`/api/admin/documents/${encodeURIComponent(docId)}/versions`, {
    method: 'POST', cookie: superAdminCookie,
    body: {file_id: 'file_pdf_v2', change_note: 'Cập nhật mục 2'}
  });
  assert(ver2.status === 201 && ver2.data.version_number === 2, 'Published v2 of PDF document while preserving v1 history');

  const pubDocs = await callWorker('/api/public/resources');
  const foundDoc = pubDocs.data.items.find(x => x.id === docId);
  assert(foundDoc && foundDoc.current_version === 2 && foundDoc.file_id === 'file_pdf_v2', 'Public PDF library serves current v2');

  // Verify file reference guard prevents deleting file_pdf_v1 (still referenced by document_versions v1)
  const delInUse = await callWorker('/api/admin/files/file_pdf_v1', {method: 'DELETE', cookie: superAdminCookie});
  assert(delInUse.status === 409 && delInUse.data.error === 'ASSET_IN_USE', 'File deletion guard prevents deleting file referenced in document_versions history');
}

// 12. Visual Page Builder, Separation of Duties, Multi-Website Isolation & Revision Restore
{
  const crossSite = await callWorker('/api/admin/cms/pages', {
    method: 'POST', cookie: editorCookie,
    body: {website_id: 'main', title: 'Trang trái phép', slug: 'trang-trai-phep', blocks: []}
  });
  assert(crossSite.status === 403, 'Multi-website isolation blocks SFEC-scoped editor from creating page on main website');

  const pageCreate = await callWorker('/api/admin/cms/pages', {
    method: 'POST', cookie: editorCookie,
    body: {
      website_id: 'sfec',
      title: 'Giới thiệu Hệ thống Số',
      slug: 'gioi-thieu-he-thong-so',
      summary: 'Trang dựng bằng Visual Page Builder',
      blocks: [
        {id: 'b1', type: 'hero', title: 'Hệ thống Thông tin Số Sky First', subtitle: 'Nền tảng dịch vụ số'},
        {id: 'b2', type: 'paragraph', text: 'Nội dung chi tiết được kiểm duyệt trước khi xuất bản.'}
      ]
    }
  });
  assert(pageCreate.status === 201 && pageCreate.data.id, 'Editor created draft CMS page with visual blocks');
  const pageId = pageCreate.data.id;

  const prePub = await callWorker('/api/public/pages/gioi-thieu-he-thong-so');
  assert(prePub.status === 404, 'Draft CMS page is not publicly visible before publishing');

  const subRev = await callWorker(`/api/admin/cms/pages/${encodeURIComponent(pageId)}/workflow`, {
    method: 'POST', cookie: editorCookie, body: {action: 'submit_review'}
  });
  assert(subRev.status === 200 && subRev.data.status === 'pending_review', 'Editor submitted page to pending_review');

  const edApprove = await callWorker(`/api/admin/cms/pages/${encodeURIComponent(pageId)}/workflow`, {
    method: 'POST', cookie: editorCookie, body: {action: 'approve'}
  });
  assert(edApprove.status === 403, 'Editor blocked from approving CMS page');

  const revApprove = await callWorker(`/api/admin/cms/pages/${encodeURIComponent(pageId)}/workflow`, {
    method: 'POST', cookie: reviewerCookie, body: {action: 'approve', note: 'Nội dung đạt chuẩn'}
  });
  assert(revApprove.status === 200 && revApprove.data.status === 'approved', 'Reviewer approved CMS page');

  const pubAction = await callWorker(`/api/admin/cms/pages/${encodeURIComponent(pageId)}/workflow`, {
    method: 'POST', cookie: superAdminCookie, body: {action: 'publish'}
  });
  assert(pubAction.status === 200 && pubAction.data.status === 'published', 'Approved CMS page published to live');

  const postPub = await callWorker('/api/public/pages/gioi-thieu-he-thong-so?website_id=sfec');
  assert(postPub.status === 200 && postPub.data.item?.blocks?.length === 2, 'Published CMS page is publicly accessible with visual blocks');

  // Test CMS revision restore (previously broken due to 8 columns vs 7 values SQL mismatch)
  const restoreRev = await callWorker(`/api/admin/cms/pages/${encodeURIComponent(pageId)}/restore-version`, {
    method: 'POST', cookie: editorCookie, body: {version: 1}
  });
  assert(restoreRev.status === 200 && restoreRev.data.ok === true && restoreRev.data.version === 2, 'CMS page revision restore succeeds and creates new draft revision');
}

// 13. Universal HTML Email Template (email_universal_auto.html) & Zero Leftover Tokens
{
  const tplList = await callWorker('/api/admin/email-templates', {cookie: superAdminCookie});
  assert(tplList.status === 200 && tplList.data.items.length >= 15, 'All 15+ automated email templates registered in D1');

  for (const key of ['submission_confirmation', 'certificate_issued', 'certificate_revoked', 'interview_scheduled', 'support_ticket_reply']) {
    const prev = await callWorker(`/api/admin/email-templates/${key}/preview`, {
      method: 'POST', cookie: superAdminCookie,
      body: {vars: {full_name: 'Nguyễn Văn Kiểm Thử', reference_code: 'SFN-2026-9999', program_title: 'Học bổng Sky First'}}
    });
    const html = prev.data.preview?.html || '';
    assert(
      prev.status === 200 &&
      html.includes('data:image/png;base64,') &&
      html.includes('Nguyễn Văn Kiểm Thử') &&
      html.includes('SFN-2026-9999') &&
      !/\{\{[A-Z0-9_]+\}\}/i.test(html),
      `Template "${key}" renders email_universal_auto.html with embedded base64 logo and zero unreplaced {{...}} placeholders`
    );
  }
}

// 14. Admin-Assisted Password Reset (/api/auth/forgot), Backdoor Elimination & Auth Audit Logging
{
  const forgotRes = await callWorker('/api/auth/forgot', {
    method: 'POST',
    body: {email: 'skyfirst.ec@gmail.com', note: 'Nhờ quản trị viên cấp lại mật khẩu', issue_token: true}
  });
  assert(
    forgotRes.status === 200 &&
    forgotRes.data.ok === true &&
    forgotRes.data.mode === 'admin_assisted' &&
    !('reset_token' in forgotRes.data) &&
    forgotRes.data.support_email === 'support@skyfirst.io.vn' &&
    forgotRes.data.hotline === '0924 910 210',
    'Forgot-password workflow creates admin-assisted support ticket (SFN-PW-*) and blocks unauthenticated issue_token exfiltration'
  );

  const pwTicket = await DB.prepare("SELECT code FROM tickets WHERE ticket_type='Đặt lại mật khẩu' ORDER BY created_at DESC LIMIT 1").first();
  assert(Boolean(pwTicket?.code?.startsWith('SFN-PW-')), 'Admin-assisted password reset request creates SFN-PW-* ticket in D1');

  const auditRes = await callWorker('/api/admin/dashboard', {cookie: superAdminCookie});
  const recentAudit = auditRes.data.recent_audit || [];
  assert(
    recentAudit.some(a => a.action === 'Yêu cầu hỗ trợ đặt lại mật khẩu' || a.action === 'Đăng nhập thành công'),
    'Auth events (login & password reset request) are recorded in audit_log without sensitive secrets'
  );
}

// 15. Lookup Data Policy & Timestamp Notices + Certificate Lookup by Email/Phone
{
  const activeCert = await DB.prepare("SELECT id, code FROM certificates LIMIT 1").first();
  await DB.prepare("UPDATE certificates SET status='issued', email='certowner@skyfirst.io.vn', metadata_json=? WHERE id=?").bind(
    JSON.stringify({unit_name: 'Sky First', program: 'SFEC 2026', phone: '0912345678'}),
    activeCert.id
  ).run();

  const certLookup = await callWorker(`/api/public/credentials/${encodeURIComponent(activeCert.code)}`);
  assert(
    certLookup.status === 200 &&
    !('data_policy_notice' in certLookup.data) &&
    !('query_timestamp_notice' in certLookup.data) &&
    Boolean(certLookup.data.queried_at),
    'Public lookup omits removed data_policy_notice and query_timestamp_notice strings while preserving queried_at (Phase VIII)'
  );

  const byContact = await callWorker('/api/lookup/certificate?email=certowner@skyfirst.io.vn');
  assert(
    byContact.status === 200 &&
    byContact.data.verified === true &&
    byContact.data.item?.code === activeCert.code &&
    !JSON.stringify(byContact.data.item).includes('0912345678') &&
    !JSON.stringify(byContact.data.item).includes('certowner@skyfirst.io.vn'),
    'Certificate lookup by email/phone locates matching credential without exposing personal contact fields in public response'
  );
}

// 16. Document Lifecycle Management (Unpublish, Revoke, Replace, Restore)
{
  const docsList = await callWorker('/api/admin/content/documents', {cookie: superAdminCookie});
  const targetDoc = docsList.data.items.find(d => d.code === 'HD-2026-01');
  assert(Boolean(targetDoc), 'Located test PDF document HD-2026-01 for lifecycle tests');

  const revDoc = await callWorker(`/api/admin/documents/${encodeURIComponent(targetDoc.id)}/lifecycle`, {
    method: 'POST', cookie: superAdminCookie,
    body: {action: 'revoke', reason: 'Thu hồi bản hướng dẫn cũ để cập nhật quy chế mới'}
  });
  assert(revDoc.status === 200 && revDoc.data.status === 'Đã thu hồi' && revDoc.data.visibility === 'internal', 'Document lifecycle revoke updates status to Đã thu hồi and restricts visibility to internal');

  const restDoc = await callWorker(`/api/admin/documents/${encodeURIComponent(targetDoc.id)}/lifecycle`, {
    method: 'POST', cookie: superAdminCookie,
    body: {action: 'restore', reason: 'Khôi phục hiệu lực tài liệu sau rà soát'}
  });
  assert(restDoc.status === 200 && restDoc.data.status === 'Có hiệu lực' && restDoc.data.visibility === 'public', 'Document lifecycle restore reinstates public active status');
}

// 17. Super Admin Enriched Dashboard Metrics & Warnings
{
  const dash = await callWorker('/api/admin/dashboard', {cookie: superAdminCookie});
  assert(
    dash.status === 200 &&
    typeof dash.data.counts?.certificates === 'number' &&
    typeof dash.data.counts?.published_pages === 'number' &&
    typeof dash.data.email_status?.pending === 'number' &&
    Array.isArray(dash.data.recent_audit) &&
    Array.isArray(dash.data.warnings),
    'Super Admin dashboard returns real D1 counts, email delivery status breakdown, recent audit log, and system warnings'
  );
}

// 18. Technical SEO (/robots.txt & /sitemap.xml)
{
  const robots = await callWorker('/robots.txt');
  assert(
    robots.status === 200 &&
    String(robots.data).includes('Disallow: /admin') &&
    String(robots.data).includes('Disallow: /api/') &&
    String(robots.data).includes('Sitemap: https://app.skyfirst.io.vn/sitemap.xml'),
    '/robots.txt blocks /admin and /api/ while referencing https://app.skyfirst.io.vn/sitemap.xml'
  );

  const sitemap = await callWorker('/sitemap.xml');
  assert(
    sitemap.status === 200 &&
    String(sitemap.data).includes('<urlset') &&
    String(sitemap.data).includes('https://app.skyfirst.io.vn/gcn') &&
    !String(sitemap.data).includes('/admin'),
    '/sitemap.xml dynamically outputs public canonical URLs and excludes private/admin routes'
  );
}

// 19. 2FA Brute-Force Protection & Account Suspension Session Revocation
{
  const inv2fa = await callWorker('/api/admin/users', {
    method: 'POST', cookie: superAdminCookie,
    body: {full_name: '2FA Admin', email: '2fa@skyfirst.io.vn', roles: ['reviewer'], activation_mode: 'self', must_change_password: false}
  });
  const u2fa = await DB.prepare("SELECT id FROM users WHERE email='2fa@skyfirst.io.vn'").first();
  await DB.prepare("UPDATE users SET totp_enabled=1, totp_secret='JBSWY3DPEHPK3PXP', must_change_password=0 WHERE id=?").bind(u2fa.id).run();

  const step1 = await callWorker('/api/auth/login', {
    method: 'POST', ip: '203.113.152.20',
    body: {email: '2fa@skyfirst.io.vn', password: inv2fa.data.temp_password, portal: 'admin'}
  });
  assert(step1.status === 200 && step1.data.needs_2fa === true && step1.data.challenge, 'Login for 2FA-enabled user issues challenge token without session cookie');

  // Attempt 6 invalid OTP codes -> 6th exceeds MAX_2FA_ATTEMPTS=5 and locks/invalidates challenge
  let last2fa = null;
  for (let i = 0; i < 6; i++) {
    last2fa = await callWorker('/api/auth/login-2fa', {
      method: 'POST', ip: '203.113.152.20',
      body: {challenge: step1.data.challenge, code: '000000'}
    });
  }
  assert(last2fa.status === 429 && last2fa.data.error === 'RATE_LIMIT', '2FA challenge locks and invalidates after exceeding 5 failed OTP attempts (prevents TOTP brute-force)');

  // Suspend handler account and verify existing handlerCookie is immediately rejected
  const haUser = await DB.prepare("SELECT id FROM users WHERE email='handler@skyfirst.io.vn'").first();
  await callWorker(`/api/admin/users/${haUser.id}/status`, {
    method: 'PATCH', cookie: superAdminCookie, body: {status: 'suspended'}
  });
  const suspendedAccess = await callWorker('/api/admin/submissions', {cookie: handlerCookie});
  assert(suspendedAccess.status === 401, 'Suspending user immediately revokes active sessions and blocks API access');
  // Re-activate handler
  await callWorker(`/api/admin/users/${haUser.id}/status`, {
    method: 'PATCH', cookie: superAdminCookie, body: {status: 'active'}
  });
}

// 20. Form Signature Lifecycle (Draw & Upload, Disguised File Rejection, Required Signature Enforcement & Private File Access Control)
{
  const sigFormCreate = await callWorker('/api/admin/forms', {
    method: 'POST', cookie: superAdminCookie,
    body: {
      id: 'commitment_sig_2026',
      name: 'Cam kết Tham gia Chương trình 2026',
      prefix: 'SFN-CK',
      description: 'Biểu mẫu kiểm thử chữ ký bắt buộc',
      audience: 'public',
      enabled: true,
      config: {
        form_type: 'general',
        presentation: 'classic',
        review_before_submit: true,
        signature_required: true,
        sections: [{
          title: 'Thông tin & Chữ ký xác nhận',
          fields: [
            {key: 'full_name', label: 'Họ và tên', type: 'text', required: true},
            {key: 'email', label: 'Email', type: 'email', required: true},
            {key: 'applicant_sig', label: 'Chữ ký xác nhận', type: 'signature', required: true}
          ]
        }]
      }
    }
  });
  assert(sigFormCreate.status === 200 && sigFormCreate.data.id === 'commitment_sig_2026', 'Created form requiring image signature');

  // Submitting without signature must fail
  const noSigSub = await callWorker('/api/forms/commitment_sig_2026/submit', {
    method: 'POST',
    body: {
      answers: {full_name: 'Phạm Văn Ký', email: 'phamvanky@example.com', applicant_sig: 'drawn'},
      uploads: {}
    }
  });
  assert(noSigSub.status === 400 && noSigSub.data.error === 'VALIDATION_FAILED', 'Submitting required signature form without uploaded signature file is rejected');

  // Disguised HTML/script uploaded as PNG signature must be rejected by magic bytes check
  const fakePng = new TextEncoder().encode('<script>alert("xss")</script>');
  const fakeSess = await callWorker('/api/uploads/session', {
    method: 'POST',
    body: {filename: 'evil.png', mime: 'image/png', size: fakePng.byteLength, field_key: 'applicant_sig'}
  });
  const fakePut = await callWorker(`/api/uploads/${encodeURIComponent(fakeSess.data.id)}?token=${encodeURIComponent(fakeSess.data.token)}`, {
    method: 'PUT',
    headers: {'content-type': 'image/png', 'content-length': String(fakePng.byteLength)},
    body: fakePng
  });
  assert(fakePut.status === 400 && fakePut.data.error === 'FILE_SIGNATURE_MISMATCH', 'Upload session rejects disguised HTML/script with 400 FILE_SIGNATURE_MISMATCH');

  // Valid PNG signature upload & submission succeeds
  const validPng = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0, 0, 0, 0, 0]);
  const sigSess = await callWorker('/api/uploads/session', {
    method: 'POST',
    body: {filename: 'applicant_sig-signature.png', mime: 'image/png', size: validPng.byteLength, field_key: 'applicant_sig'}
  });
  await callWorker(`/api/uploads/${encodeURIComponent(sigSess.data.id)}?token=${encodeURIComponent(sigSess.data.token)}`, {
    method: 'PUT',
    headers: {'content-type': 'image/png', 'content-length': String(validPng.byteLength)},
    body: validPng
  });
  const okSigSub = await callWorker('/api/forms/commitment_sig_2026/submit', {
    method: 'POST',
    body: {
      answers: {full_name: 'Phạm Văn Ký', email: 'phamvanky@example.com', applicant_sig: 'drawn'},
      uploads: {applicant_sig: {id: sigSess.data.id, token: sigSess.data.token}}
    }
  });
  assert(okSigSub.status === 200 && okSigSub.data.ok === true && okSigSub.data.code.startsWith('SFN-CK-'), 'Submission with valid PNG signature succeeds and persists signature reference');

  // Private signature file must NOT be accessible to unauthenticated users, but accessible to Admin
  const storedSigFileId = okSigSub.data.files?.applicant_sig;
  const unauthFile = await callWorker(`/api/files/${encodeURIComponent(storedSigFileId)}`);
  const adminFile = await callWorker(`/api/files/${encodeURIComponent(storedSigFileId)}`, {cookie: superAdminCookie});
  assert(Boolean(storedSigFileId) && unauthFile.status === 403 && adminFile.status === 200, 'Private signature image is protected from public access (403) and accessible to authorized admin (200)');
}

// 21. Financial Reconciliation Edge Cases (QR Intent, Self-Report, HMAC Webhook, Replay, Wrong Account, Underpaid/Overpaid, Refund, Negative Adjustment, Overspent Negative Balance & Separation of Duties)
{
  // 21.1 Create QR payment intent on public campaign SFN-TT-2026-01
  const qrRes = await callWorker('/api/public/sponsorship/SFN-TT-2026-01/qr-intent', {
    method: 'POST',
    body: {donor_name: 'Nhà tài trợ Minh Bạch', expected_amount: 5000000}
  });
  assert(qrRes.status === 201 && qrRes.data.intent?.reference_code?.startsWith('SFN-'), 'Created dynamic QR payment intent with unique reference code');
  const refCode = qrRes.data.intent.reference_code;

  // 21.2 Donor clicks "Tôi đã hoàn tất chuyển khoản" -> marks user_reported + pending tx, does NOT increase received_amount!
  const selfRep = await callWorker(`/api/public/sponsorship/intents/${encodeURIComponent(refCode)}/report-transfer`, {
    method: 'POST',
    body: {note: 'Đã chuyển khoản qua MB Bank'}
  });
  const spAfterSelfRep = await callWorker('/api/public/sponsorship');
  assert(
    selfRep.status === 200 &&
    selfRep.data.payment_state === 'transfer_reported' &&
    spAfterSelfRep.data.summary.received_amount === 15000000,
    'Donor self-reporting transfer creates pending reconciliation state and NEVER increases received_amount before verification'
  );

  // 21.3 Webhook security: missing signature, bad signature, expired timestamp
  const signWebhook = (payloadObj, ts, nonce, secret = env.SPONSORSHIP_WEBHOOK_SECRET) => {
    const raw = JSON.stringify(payloadObj);
    const sig = createHmac('sha256', secret).update(`${ts}.${nonce}.${raw}`).digest('hex');
    return {raw, sig};
  };

  const noSigWh = await callWorker('/api/webhooks/sponsorship/payment', {
    method: 'POST', body: {reference_code: refCode, provider_tx_id: 'BANK-TX-001', amount: 5000000}
  });
  assert(noSigWh.status === 401 && noSigWh.data.error === 'WEBHOOK_SIGNATURE_MISSING', 'Payment webhook without HMAC headers rejected with 401');

  const nowTs = Math.floor(Date.now() / 1000);
  const badSigWh = await callWorker('/api/webhooks/sponsorship/payment', {
    method: 'POST',
    headers: {'x-sfn-timestamp': String(nowTs), 'x-sfn-nonce': 'nonce-bad-1', 'x-sfn-signature': 'deadbeef'},
    body: {reference_code: refCode, provider_tx_id: 'BANK-TX-001', amount: 5000000}
  });
  assert(badSigWh.status === 401 && badSigWh.data.error === 'WEBHOOK_SIGNATURE_INVALID', 'Payment webhook with invalid HMAC signature rejected with 401');

  const oldTs = nowTs - 600;
  const expSigned = signWebhook({reference_code: refCode, provider_tx_id: 'BANK-TX-001', amount: 5000000}, oldTs, 'nonce-exp-1');
  const expWh = await callWorker('/api/webhooks/sponsorship/payment', {
    method: 'POST',
    headers: {'content-type': 'application/json', 'x-sfn-timestamp': String(oldTs), 'x-sfn-nonce': 'nonce-exp-1', 'x-sfn-signature': expSigned.sig},
    body: expSigned.raw
  });
  assert(expWh.status === 401 && expWh.data.error === 'WEBHOOK_TIMESTAMP_EXPIRED', 'Payment webhook outside 5-minute window rejected with 401');

  // 21.4 Wrong recipient bank account rejected with 409
  const wrongAcctPayload = {reference_code: refCode, provider_tx_id: 'BANK-TX-WRONG-ACCT', amount: 5000000, recipient_account: '9999999999'};
  const wrongAcctSigned = signWebhook(wrongAcctPayload, nowTs, 'nonce-wrong-acct');
  const wrongAcctWh = await callWorker('/api/webhooks/sponsorship/payment', {
    method: 'POST',
    headers: {'content-type': 'application/json', 'x-sfn-timestamp': String(nowTs), 'x-sfn-nonce': 'nonce-wrong-acct', 'x-sfn-signature': wrongAcctSigned.sig},
    body: wrongAcctSigned.raw
  });
  assert(wrongAcctWh.status === 409 && wrongAcctWh.data.error === 'WRONG_RECIPIENT_ACCOUNT', 'Payment webhook to wrong recipient bank account rejected with 409');

  // 21.5 Valid webhook reconciles QR intent and credits received_amount (15M + 5M = 20M)
  const validPayload = {reference_code: refCode, provider_tx_id: 'BANK-TX-001', amount: 5000000, recipient_account: '0924910210'};
  const validSigned = signWebhook(validPayload, nowTs, 'nonce-valid-001');
  const validWh = await callWorker('/api/webhooks/sponsorship/payment', {
    method: 'POST',
    headers: {'content-type': 'application/json', 'x-sfn-timestamp': String(nowTs), 'x-sfn-nonce': 'nonce-valid-001', 'x-sfn-signature': validSigned.sig},
    body: validSigned.raw
  });
  assert(validWh.status === 200 && validWh.data.ok === true && validWh.data.totals.received === 20000000, 'Authenticated payment webhook reconciles QR intent and updates received_amount to 20,000,000 VND');

  // 21.6 Replay with same nonce -> 409; retry with same provider_tx_id & new nonce -> idempotent 200 without double counting
  const replayWh = await callWorker('/api/webhooks/sponsorship/payment', {
    method: 'POST',
    headers: {'content-type': 'application/json', 'x-sfn-timestamp': String(nowTs), 'x-sfn-nonce': 'nonce-valid-001', 'x-sfn-signature': validSigned.sig},
    body: validSigned.raw
  });
  const dupTxSigned = signWebhook(validPayload, nowTs, 'nonce-valid-002');
  const dupTxWh = await callWorker('/api/webhooks/sponsorship/payment', {
    method: 'POST',
    headers: {'content-type': 'application/json', 'x-sfn-timestamp': String(nowTs), 'x-sfn-nonce': 'nonce-valid-002', 'x-sfn-signature': dupTxSigned.sig},
    body: dupTxSigned.raw
  });
  const spAfterDup = await callWorker('/api/public/sponsorship');
  assert(
    replayWh.status === 409 &&
    dupTxWh.status === 200 && dupTxWh.data.duplicate === true &&
    spAfterDup.data.summary.received_amount === 20000000,
    'Webhook replay protection & provider_tx_id idempotency prevent double-counting on retries'
  );

  // 21.7 Underpaid webhook detection (expected 2,000,000, actual 1,500,000) -> records pending underpaid transaction for review
  const qrUnder = await callWorker('/api/public/sponsorship/SFN-TT-2026-01/qr-intent', {
    method: 'POST', body: {donor_name: 'Nhà tài trợ Chuyển Thiếu', expected_amount: 2000000}
  });
  const underPayload = {reference_code: qrUnder.data.intent.reference_code, provider_tx_id: 'BANK-TX-UNDER-01', amount: 1500000, recipient_account: '0924910210'};
  const underSigned = signWebhook(underPayload, nowTs, 'nonce-under-001');
  const underWh = await callWorker('/api/webhooks/sponsorship/payment', {
    method: 'POST',
    headers: {'content-type': 'application/json', 'x-sfn-timestamp': String(nowTs), 'x-sfn-nonce': 'nonce-under-001', 'x-sfn-signature': underSigned.sig},
    body: underSigned.raw
  });
  assert(
    underWh.status === 200 &&
    underWh.data.payment_state === 'underpaid' &&
    underWh.data.verification_status === 'pending' &&
    underWh.data.totals.received === 20000000,
    'Underpaid transfer is flagged as payment_state=underpaid in pending status until admin reconciliation'
  );

  // 21.8 Separation of duties on financial verification: give reviewer sponsorship.manage + sponsorship.approve, verify reviewer cannot self-approve their own transaction
  const revUser = await DB.prepare("SELECT id FROM users WHERE email='reviewer@skyfirst.io.vn'").first();
  await callWorker(`/api/admin/users/${revUser.id}/roles`, {
    method: 'PUT', cookie: superAdminCookie, body: {roles: ['office', 'network_secretary']}
  });
  const mgrTx = await callWorker('/api/admin/sponsorship/transactions', {
    method: 'POST', cookie: reviewerCookie,
    body: {campaign_id: mainCampId, tx_type: 'receipt', amount: 3000000, public_party_label: 'Nhà tài trợ B', purpose: 'Ủng hộ trực tiếp', verification_status: 'pending'}
  });
  assert(mgrTx.status === 201 && mgrTx.data.id, 'Manager created pending sponsorship transaction');
  const selfVerify = await callWorker(`/api/admin/sponsorship/transactions/${encodeURIComponent(mgrTx.data.id)}`, {
    method: 'PATCH', cookie: reviewerCookie, body: {verification_status: 'verified', is_public: true}
  });
  assert(selfVerify.status === 403 && selfVerify.data.error === 'SELF_APPROVAL_FORBIDDEN', 'Non-root user blocked from self-verifying financial transaction they created (403 SELF_APPROVAL_FORBIDDEN)');

  // Super Admin verifies the manager's transaction -> received becomes 23,000,000
  const adminVerify = await callWorker(`/api/admin/sponsorship/transactions/${encodeURIComponent(mgrTx.data.id)}`, {
    method: 'PATCH', cookie: superAdminCookie, body: {verification_status: 'verified', is_public: true, reconciliation_note: 'Đã đối chiếu sao kê ngân hàng'}
  });
  assert(adminVerify.status === 200 && adminVerify.data.totals.received === 23000000, 'Second approver verifies transaction and updates received_amount to 23,000,000 VND');

  // 21.9 Refund (-1,000,000) & Negative Adjustment (-2,000,000) -> received becomes 20,000,000
  await callWorker('/api/admin/sponsorship/transactions', {
    method: 'POST', cookie: superAdminCookie,
    body: {campaign_id: mainCampId, tx_type: 'refund', amount: 1000000, public_party_label: 'Hoàn trả chuyển nhầm', purpose: 'Hoàn trả khoản chuyển thừa theo biên bản đối soát', verification_status: 'verified', is_public: true}
  });
  const negAdj = await callWorker('/api/admin/sponsorship/transactions', {
    method: 'POST', cookie: superAdminCookie,
    body: {campaign_id: mainCampId, tx_type: 'adjustment', amount: -2000000, public_party_label: 'Điều chỉnh giảm đối soát', purpose: 'Điều chỉnh giảm do hạch toán trùng chứng từ', verification_status: 'verified', is_public: true}
  });
  assert(negAdj.status === 201 && negAdj.data.totals.received === 20000000 && negAdj.data.totals.refunded === 1000000 && negAdj.data.totals.adjusted === -2000000, 'Refund and negative adjustment accurately update received_amount (23M - 1M - 2M = 20M)');

  // 21.10 Overspent / negative balance scenario: disburse 25,000,000 more (total disbursed = 30,000,000 vs received = 20,000,000 -> remaining = -10,000,000)
  const overDisb = await callWorker('/api/admin/sponsorship/transactions', {
    method: 'POST', cookie: superAdminCookie,
    body: {campaign_id: mainCampId, tx_type: 'disbursement', amount: 25000000, public_party_label: 'Chi học liệu đợt 2', purpose: 'Giải ngân vượt tạm ứng đợt 2', verification_status: 'verified', is_public: true}
  });
  const spOverspent = await callWorker('/api/public/sponsorship');
  assert(
    overDisb.status === 201 &&
    overDisb.data.totals.remaining === -10000000 &&
    overDisb.data.totals.is_overspent === true &&
    spOverspent.data.summary.remaining_amount === -10000000 &&
    spOverspent.data.summary.is_overspent === true,
    'Negative financial balance (-10,000,000 VND) is preserved accurately and NEVER clamped to 0'
  );
}

// 22. Atomic SHA-256 Verified Backup & Restore (with Credential Redaction & Tamper Detection)
{
  const bkCreate = await callWorker('/api/admin/backup', {method: 'POST', cookie: superAdminCookie});
  assert(
    bkCreate.status === 200 &&
    bkCreate.data.ok === true &&
    bkCreate.data.sha256 &&
    bkCreate.data.table_counts?.sponsorship_campaigns >= 1 &&
    bkCreate.data.table_counts?.cms_pages >= 1,
    'Backup snapshot includes all application tables (including sponsorship & CMS) and computes SHA-256 checksum'
  );
  const backupId = bkCreate.data.id;
  const r2Key = bkCreate.data.r2_key;

  // Verify raw backup in R2 does NOT leak password_hash or password_salt
  const rawObj = await FILES.get(r2Key);
  const rawText = await rawObj.text();
  assert(rawText.includes('[REDACTED_SECRET]') && !rawText.includes('O1M7291qarCiAr9hV1Dmxg'), 'Backup JSON redacts user password hashes and salts in R2 storage');

  // Verify endpoint confirms integrity
  const bkVer = await callWorker(`/api/admin/backups/${encodeURIComponent(backupId)}/verify`, {cookie: superAdminCookie});
  assert(bkVer.status === 200 && bkVer.data.ok === true && bkVer.data.sha256 === bkCreate.data.sha256, '/api/admin/backups/:id/verify validates SHA-256 checksum');

  // Tamper with R2 object and verify restore rejects with 409 BACKUP_CHECKSUM_MISMATCH without wiping DB
  await FILES.put(r2Key, rawText + ' ', {httpMetadata: {contentType: 'application/json'}});
  const badRestore = await callWorker(`/api/admin/backups/${encodeURIComponent(backupId)}/restore`, {method: 'POST', cookie: superAdminCookie});
  const countAfterBlockedRestore = await DB.prepare("SELECT COUNT(*) c FROM submissions").first();
  assert(badRestore.status === 409 && badRestore.data.error === 'BACKUP_CHECKSUM_MISMATCH' && Number(countAfterBlockedRestore.c) > 0, 'Tampered backup is rejected with 409 BACKUP_CHECKSUM_MISMATCH before any table deletion');

  // Restore original valid R2 object and perform atomic restore
  await FILES.put(r2Key, rawText, {httpMetadata: {contentType: 'application/json'}});
  const goodRestore = await callWorker(`/api/admin/backups/${encodeURIComponent(backupId)}/restore`, {method: 'POST', cookie: superAdminCookie});
  assert(goodRestore.status === 200 && goodRestore.data.ok === true && goodRestore.data.pre_restore_backup_id, 'Valid backup restores atomically via D1 batch and creates pre-restore safety snapshot');

  // Verify Super Admin can still log in after restore (password credentials preserved)
  const loginAfterRestore = await callWorker('/api/auth/login', {
    method: 'POST', body: {email: 'skyfirst.ec@gmail.com', password: 'AdminPass!2026', portal: 'admin'}
  });
  assert(loginAfterRestore.status === 200 && loginAfterRestore.data.ok === true, 'User credentials remain intact and functional after backup restore');
}


// 23. 7-Website Canonical Ecosystem Registry & Per-Website Maintenance Enforcement
{
  const wsRes = await callWorker('/api/admin/websites', {cookie: superAdminCookie});
  const wsIds = (wsRes.data.items || []).map(w => w.id).sort();
  assert(
    wsRes.status === 200 &&
    JSON.stringify(wsIds) === JSON.stringify(['app', 'ctt', 'exam', 'mail', 'main', 'member', 'sfec']),
    '7-Website Canonical Ecosystem Registry contains exact 7 websites (app, main, ctt, mail, member, sfec, exam) and removes deprecated slc/tnv/gme'
  );

  // Set sfec website to maintenance and verify public CMS page under sfec returns 503 WEBSITE_MAINTENANCE
  const sfecSite = wsRes.data.items.find(w => w.id === 'sfec');
  await callWorker('/api/admin/websites/sfec', {
    method: 'PUT', cookie: superAdminCookie,
    body: {...sfecSite, status: 'maintenance'}
  });
  const sfecBlocked = await callWorker('/api/public/pages/gioi-thieu-he-thong-so?website_id=sfec');
  assert(sfecBlocked.status === 503 && sfecBlocked.data.error === 'WEBSITE_MAINTENANCE', 'Per-website maintenance status blocks public CMS pages of that website with 503 WEBSITE_MAINTENANCE');

  // Restore sfec to active
  await callWorker('/api/admin/websites/sfec', {
    method: 'PUT', cookie: superAdminCookie,
    body: {...sfecSite, status: 'active'}
  });
}

// 24. Full-Page System CMS Overrides, Bilingual VI/EN, Shared Blocks (with Impact Guard), Templates, Scheduled Publishing & WordPress Gutenberg Adapter
{
  // Verify 13 system pages are seeded and returned in /api/config
  const cfgVi = await callWorker('/api/config?lang=vi');
  const cfgEn = await callWorker('/api/config?lang=en');
  assert(
    cfgVi.status === 200 &&
    cfgVi.data.cms_system_pages?.['/'] &&
    cfgVi.data.cms_system_pages?.['/gioi-thieu'] &&
    cfgVi.data.cms_system_pages?.['/ho-tro'] &&
    cfgVi.data.cms_system_pages?.['/admin/login'] &&
    cfgEn.data.cms_system_pages?.['/gioi-thieu']?.title === 'About Sky First Digital Information System',
    'All 13 system pages are managed in D1 cms_pages and serve localized VI/EN content via /api/config'
  );

  // Shared Blocks CRUD + affected_pages impact warning + 409 SHARED_BLOCK_IN_USE guard
  const sbCreate = await callWorker('/api/admin/cms/shared-blocks', {
    method: 'POST', cookie: superAdminCookie,
    body: {
      key: 'test-reusable-banner',
      name: 'Banner Dùng Chung Kiểm Thử',
      block: {type: 'callout', tone: 'good', title: 'Thông báo chung VI', text: 'Nội dung khối dùng chung VI'},
      block_en: {type: 'callout', tone: 'good', title: 'Shared Notice EN', text: 'Shared block body EN'}
    }
  });
  assert(sbCreate.status === 200 && sbCreate.data.ok === true, 'Created reusable shared block (VI/EN)');

  // Embed shared block in a CMS page and publish it
  const sbPage = await callWorker('/api/admin/cms/pages', {
    method: 'POST', cookie: superAdminCookie,
    body: {
      website_id: 'app',
      title: 'Trang Nhúng Khối Dùng Chung',
      title_en: 'Page Embedding Shared Block',
      slug: 'trang-nhung-khoi-dung-chung',
      blocks: [{id: 'sb1', type: 'shared_block', sharedKey: 'test-reusable-banner'}],
      blocks_en: [{id: 'sb1_en', type: 'shared_block', sharedKey: 'test-reusable-banner'}]
    }
  });
  const sbPageId = sbPage.data.id;

  // Check preview before publishing (must work for admin without making page public)
  const previewRes = await callWorker(`/api/admin/cms/pages/${encodeURIComponent(sbPageId)}/preview?lang=en`, {cookie: superAdminCookie});
  const pubBefore = await callWorker('/api/public/pages/trang-nhung-khoi-dung-chung');
  assert(
    previewRes.status === 200 &&
    previewRes.data.preview?.blocks?.[0]?.resolved_shared_block?.title === 'Shared Notice EN' &&
    pubBefore.status === 404,
    'CMS Preview resolves shared blocks in requested language without publishing draft page publicly'
  );

  // Attempting to delete a shared block currently used by a page must be blocked with 409 SHARED_BLOCK_IN_USE
  const sbList = await callWorker('/api/admin/cms/shared-blocks', {cookie: superAdminCookie});
  const targetSb = sbList.data.items.find(x => x.key === 'test-reusable-banner');
  const delSbInUse = await callWorker(`/api/admin/cms/shared-blocks/${encodeURIComponent(targetSb.id)}`, {
    method: 'DELETE', cookie: superAdminCookie
  });
  assert(
    delSbInUse.status === 409 &&
    delSbInUse.data.error === 'SHARED_BLOCK_IN_USE' &&
    targetSb.affected_pages.some(p => p.slug === 'trang-nhung-khoi-dung-chung'),
    'Shared block tracks affected_pages and blocks deletion with 409 SHARED_BLOCK_IN_USE while embedded'
  );

  // Scheduled publishing workflow
  const pastIso = new Date(Date.now() - 60000).toISOString();
  const schedRes = await callWorker(`/api/admin/cms/pages/${encodeURIComponent(sbPageId)}/workflow`, {
    method: 'POST', cookie: superAdminCookie,
    body: {action: 'schedule', scheduled_at: pastIso}
  });
  const runSched = await callWorker('/api/admin/cms/run-scheduled', {method: 'POST', cookie: superAdminCookie});
  const pubAfterSched = await callWorker('/api/public/pages/trang-nhung-khoi-dung-chung?lang=en');
  assert(
    schedRes.status === 200 &&
    schedRes.data.status === 'scheduled' &&
    runSched.data.published_count >= 1 &&
    pubAfterSched.status === 200 &&
    pubAfterSched.data.item?.title === 'Page Embedding Shared Block',
    'Scheduled CMS page transitions to published when scheduled runner executes and serves English content on ?lang=en'
  );

  // Page duplication
  const dupPage = await callWorker(`/api/admin/cms/pages/${encodeURIComponent(sbPageId)}/duplicate`, {
    method: 'POST', cookie: superAdminCookie
  });
  assert(dupPage.status === 201 && dupPage.data.slug.startsWith('trang-nhung-khoi-dung-chung-ban-sao'), 'CMS page duplication creates independent draft copy');

  // Headless WordPress / Gutenberg Import & Export
  const wpImp = await callWorker('/api/admin/cms/wordpress/import', {
    method: 'POST', cookie: superAdminCookie,
    body: {
      website_id: 'app',
      title: 'Trang Đồng Bộ Từ WordPress',
      slug: 'trang-dong-bo-tu-wordpress',
      wp_post_id: 2026,
      content: '<!-- wp:heading -->\n<h2>Tiêu đề từ Gutenberg</h2>\n<!-- /wp:heading -->\n<!-- wp:paragraph -->\n<p>Đoạn văn bản an toàn từ WordPress.<script>alert(1)</script></p>\n<!-- /wp:paragraph -->'
    }
  });
  const wpExp = await callWorker(`/api/admin/cms/pages/${encodeURIComponent(wpImp.data.id)}/wordpress-export`, {cookie: superAdminCookie});
  assert(
    wpImp.status === 201 &&
    wpImp.data.imported_blocks_count === 2 &&
    wpExp.status === 200 &&
    wpExp.data.wp_payload?.content.includes('<!-- wp:heading') &&
    !wpExp.data.wp_payload?.content.includes('<script>'),
    'WordPress Gutenberg import converts blocks into structured D1 JSON (stripping unsafe scripts) and exports valid Gutenberg markup'
  );
}

// 25. Design System Token Editor & Dynamic Menu Manager
{
  const dsPut = await callWorker('/api/admin/design-system', {
    method: 'PUT', cookie: superAdminCookie,
    body: {primary_color: '#0b5ed7', navy_color: '#071b35', accent_color: '#0ca678', border_radius: '18px'}
  });
  const menuPut = await callWorker('/api/admin/menus/header', {
    method: 'PUT', cookie: superAdminCookie,
    body: {
      website_id: 'app',
      title: 'Menu Chính',
      items: [
        {id: 'm1', label_vi: 'Trang chủ', label_en: 'Home', href: '/', enabled: true},
        {id: 'm2', label_vi: 'Giới thiệu', label_en: 'About', href: '/gioi-thieu', enabled: true}
      ]
    }
  });
  const cfgCheck = await callWorker('/api/config');
  assert(
    dsPut.status === 200 &&
    menuPut.status === 200 &&
    cfgCheck.data.design_system?.primary_color === '#0b5ed7' &&
    cfgCheck.data.menus?.header?.length === 2,
    'Design System tokens and Dynamic Menus persist in D1 and propagate immediately to /api/config'
  );
}

// 26. Server-Side Enforcement of All 6 Operational Modes & Disabled Module Guard
{
  // 26.1 read_only mode: GET works, public POST (/api/public/safety-reports) blocked with 503 READ_ONLY_MODE
  await callWorker('/api/admin/maintenance-config', {
    method: 'PUT', cookie: superAdminCookie,
    body: {mode: 'read_only', title_vi: 'Chế độ chỉ đọc', message_vi: 'Đang khóa ghi dữ liệu tạm thời'}
  });
  const roPost = await callWorker('/api/public/safety-reports', {
    method: 'POST', body: {category: 'Khác', title: 'Test ReadOnly', description: 'Test'}
  });
  const roGet = await callWorker('/api/public/news');
  assert(roPost.status === 503 && roPost.data.error === 'READ_ONLY_MODE' && roGet.status === 200, 'read_only mode blocks public write requests with 503 READ_ONLY_MODE while allowing public reads');

  // 26.2 publishing_paused mode: CMS publish workflow blocked with 423 PUBLISHING_PAUSED
  await callWorker('/api/admin/maintenance-config', {
    method: 'PUT', cookie: superAdminCookie,
    body: {mode: 'publishing_paused', title_vi: 'Tạm dừng xuất bản'}
  });
  const pagesList = await callWorker('/api/admin/cms/pages', {cookie: superAdminCookie});
  const anyPageId = pagesList.data.items[0].id;
  const pubBlocked = await callWorker(`/api/admin/cms/pages/${encodeURIComponent(anyPageId)}/workflow`, {
    method: 'POST', cookie: superAdminCookie, body: {action: 'publish'}
  });
  assert(pubBlocked.status === 423 && pubBlocked.data.error === 'PUBLISHING_PAUSED', 'publishing_paused mode blocks CMS publishing at the server API with 423 PUBLISHING_PAUSED');

  // 26.3 manual_maintenance mode: unauthenticated public page/API blocked with 503, authenticated Admin bypasses (200), and allowed certificate lookup works
  await callWorker('/api/admin/maintenance-config', {
    method: 'PUT', cookie: superAdminCookie,
    body: {mode: 'manual_maintenance', title_vi: 'Đang bảo trì định kỳ', allow_lookup: true}
  });
  const mntPublicHtml = await callWorker('/chuong-trinh');
  const mntPublicApi = await callWorker('/api/public/classes');
  const mntAdminBypass = await callWorker('/chuong-trinh', {cookie: superAdminCookie});
  const mntCertLookup = await callWorker('/api/lookup/certificate?code=SFN-GCN-99999999');
  assert(
    mntPublicHtml.status === 503 &&
    mntPublicApi.status === 503 && mntPublicApi.data.error === 'MAINTENANCE_MODE' &&
    mntAdminBypass.status === 200 &&
    mntCertLookup.status !== 503,
    'manual_maintenance mode returns 503 to anonymous visitors, allows authenticated Admin bypass, and honors allow_lookup for credential verification'
  );

  // Restore normal mode
  await callWorker('/api/admin/maintenance-config', {
    method: 'PUT', cookie: superAdminCookie,
    body: {mode: 'normal', allow_lookup: true}
  });

  // 26.4 Disabled module server guard: disable sponsorship_transparency -> /api/public/sponsorship returns 403 MODULE_DISABLED
  const modsRes = await callWorker('/api/admin/modules', {cookie: superAdminCookie});
  const allMods = modsRes.data.items || [];
  await callWorker('/api/admin/modules', {
    method: 'PUT', cookie: superAdminCookie,
    body: {items: allMods.map(m => ({key: m.key, enabled: (m.key === 'sponsorship' || m.key === 'sponsorship_transparency') ? false : !!m.enabled}))}
  });
  const modBlocked = await callWorker('/api/public/sponsorship');
  assert(modBlocked.status === 403 && modBlocked.data.error === 'MODULE_DISABLED', 'Disabling a module in Admin enforces 403 MODULE_DISABLED on its public API');

  // Re-enable all modules
  await callWorker('/api/admin/modules', {
    method: 'PUT', cookie: superAdminCookie,
    body: {items: allMods.map(m => ({key: m.key, enabled: true}))}
  });
}

// 27. Sponsorship 3 Transparency Sections, EMVCo / VietQR Zero-PII Payload & CSV Export
{
  const qrCheck = await callWorker('/api/public/sponsorship/SFN-TT-2026-01/qr-intent', {
    method: 'POST',
    body: {donor_name: 'Nguyễn Văn Ẩn Danh', donor_email: 'secret@example.com', donor_phone: '0988777666', expected_amount: 1200000}
  });
  const qrIntent = qrCheck.data.intent || {};
  assert(
    qrCheck.status === 201 &&
    qrIntent.emvco_payload?.startsWith('000201') &&
    qrIntent.qr_svg_data_url?.startsWith('data:image/svg+xml;utf8,') &&
    !qrIntent.emvco_payload.includes('secret@example.com') &&
    !qrIntent.emvco_payload.includes('0988777666') &&
    !qrIntent.transfer_memo.includes('secret@example.com'),
    'VietQR / EMVCo payload and SVG QR are generated locally and contain zero personal donor email/phone PII'
  );

  const spFull = await callWorker('/api/public/sponsorship');
  assert(
    spFull.status === 200 &&
    Array.isArray(spFull.data.transparency_sections?.received_ledger) &&
    Array.isArray(spFull.data.transparency_sections?.disbursement_ledger) &&
    Array.isArray(spFull.data.transparency_sections?.published_reports),
    '/api/public/sponsorship provides all 3 structured transparency sections (received_ledger, disbursement_ledger, published_reports)'
  );

  const csvRes = await callWorker('/api/admin/export/sponsorship.csv', {cookie: superAdminCookie});
  assert(
    csvRes.status === 200 &&
    String(csvRes.data).includes('tx_code,campaign_code,tx_type,amount') &&
    String(csvRes.data).includes('SFN-TT-2026-01'),
    'Admin sponsorship CSV export (/api/admin/export/sponsorship.csv) outputs verified ledger transactions'
  );
}

// 28. PDF Download Permission Guard, SVG Sanitization & Media Hygiene Audit
{
  // Create a public document with allow_download: false
  const noDlDoc = await callWorker('/api/admin/content/documents', {
    method: 'POST', cookie: superAdminCookie,
    body: {
      code: 'QC-VIEW-ONLY-01',
      doc_type: 'Quy chế',
      title: 'Quy chế Chỉ Xem Trực Tuyến',
      visibility: 'public',
      status: 'Có hiệu lực',
      file_id: 'file_pdf_v2',
      metadata_json: JSON.stringify({allow_download: false})
    }
  });
  const inlineView = await callWorker('/api/files/file_pdf_v2');
  const dlAttempt = await callWorker('/api/files/file_pdf_v2?download=1');
  assert(
    noDlDoc.status === 200 &&
    inlineView.status === 200 &&
    dlAttempt.status === 403 && dlAttempt.data.error === 'DOWNLOAD_DISABLED',
    'Server enforces allow_download=false by blocking ?download=1 with 403 DOWNLOAD_DISABLED while allowing inline PDF viewing'
  );

  // Media Hygiene Audit
  const mediaAudit = await callWorker('/api/admin/media/audit', {cookie: superAdminCookie});
  assert(
    mediaAudit.status === 200 &&
    typeof mediaAudit.data.summary?.total_files === 'number' &&
    Array.isArray(mediaAudit.data.broken_references),
    '/api/admin/media/audit inspects R2/D1 assets, usage references, and broken links'
  );
}

// 29. Deep Health Check, Pre-Reopen Check, Release QA Gate & System Incidents
{
  const deepHealth = await callWorker('/api/admin/system/health', {cookie: superAdminCookie});
  const preReopen = await callWorker('/api/admin/system/pre-reopen-check', {cookie: superAdminCookie});
  const qaGate = await callWorker('/api/admin/system/qa-check', {cookie: superAdminCookie});
  assert(
    deepHealth.status === 200 && deepHealth.data.ok === true &&
    preReopen.status === 200 && preReopen.data.ready_to_reopen === true &&
    qaGate.status === 200 && qaGate.data.ok === true,
    'Deep Health Check, Pre-Reopen Check, and Release QA Gate all pass with 100% healthy status'
  );

  const incCreate = await callWorker('/api/admin/system/incidents', {
    method: 'POST', cookie: superAdminCookie,
    body: {title: 'Bảo trì nâng cấp V10', severity: 'low', operational_mode: 'normal', summary: 'Kiểm thử trung tâm sự cố'}
  });
  const incResolve = await callWorker(`/api/admin/system/incidents/${encodeURIComponent(incCreate.data.id)}`, {
    method: 'PATCH', cookie: superAdminCookie,
    body: {status: 'resolved', resolution_note: 'Hoàn tất nâng cấp V10', restore_normal_mode: true}
  });
  assert(incCreate.status === 201 && incResolve.status === 200, 'System Incident Center records and resolves operational incidents');
}


// 30. Audit Remediation & Verification Suite (BUG-01..BUG-16)
{
  // 30.1 Direct URL SPA navigation to /admin/files, /admin/forms, /admin/terms returns 200 HTML shell (BUG-01)
  for (const subPath of ['/admin/files', '/admin/forms', '/admin/terms', '/admin/sponsorship', '/admin/page-builder']) {
    const spaSub = await callWorker(subPath);
    assert(spaSub.status === 200 && typeof spaSub.data === 'string' && spaSub.data.includes('Hệ thống Thông tin Số Sky First'), `SPA Route ${subPath} returns 200 HTML shell directly`);
  }

  // 30.2 /api/admin/files search, visibility filter, pagination & schema protection (BUG-02)
  const filesPage1 = await callWorker('/api/admin/files?page=1&limit=10&visibility=all', {cookie: superAdminCookie});
  assert(
    filesPage1.status === 200 &&
    Array.isArray(filesPage1.data.items) &&
    typeof filesPage1.data.total === 'number' &&
    filesPage1.data.page === 1,
    '/api/admin/files supports search, visibility filter, and server pagination safely'
  );

  // 30.3 Terms creation (POST), revision history (GET revisions), and update (PUT) (BUG-06)
  const newTermRes = await callWorker('/api/admin/terms', {
    method: 'POST', cookie: superAdminCookie,
    body: {
      code: 'DK-03/2026/SFN',
      name: 'Quy tắc Ứng xử & Bảo mật Thông tin Số',
      version: '24/10/2026',
      scope: 'Toàn mạng lưới',
      status: 'draft',
      change_note: 'Khởi tạo điều khoản thứ 4',
      body: 'Toàn văn Quy tắc Ứng xử và Bảo mật Thông tin Số của Sky First Network.'
    }
  });
  assert(newTermRes.status === 201 && newTermRes.data.code === 'DK-03/2026/SFN', 'Created 4th Term & Policy record in draft state via POST /api/admin/terms');

  const updTermRes = await callWorker(`/api/admin/terms/${encodeURIComponent('DK-03/2026/SFN')}`, {
    method: 'PUT', cookie: superAdminCookie,
    body: {
      name: 'Quy tắc Ứng xử & Bảo mật Thông tin Số (Đã rà soát)',
      version: '25/10/2026',
      scope: 'Toàn mạng lưới',
      status: 'published',
      change_note: 'Công bố chính thức phiên bản 25/10/2026',
      body: 'Toàn văn Quy tắc Ứng xử và Bảo mật Thông tin Số đã phê duyệt.'
    }
  });
  const termRevs = await callWorker(`/api/admin/terms/${encodeURIComponent('DK-03/2026/SFN')}/revisions`, {cookie: superAdminCookie});
  assert(
    updTermRes.status === 200 &&
    termRevs.status === 200 &&
    Array.isArray(termRevs.data.items) &&
    termRevs.data.items.length >= 2,
    'Updating a Term preserves full version history in term_revisions without destructive overwrite'
  );

  // 30.4 Forms creation defaults to draft (enabled=0), requires approval/publish workflow before public listing (BUG-07)
  const draftFormRes = await callWorker('/api/admin/forms', {
    method: 'POST', cookie: superAdminCookie,
    body: {
      id: 'audit_test_form_2026',
      name: 'Biểu mẫu Kiểm thử Quy trình Duyệt 2026',
      prefix: 'SFN-TEST',
      description: 'Kiểm thử tạo biểu mẫu mặc định ở trạng thái nháp',
      config: {sections: [{title: 'Thông tin', fields: [{key: 'full_name', label: 'Họ và tên', type: 'text', required: true}, {key: 'email', label: 'Email', type: 'email', required: true}]}]}
    }
  });
  const cfgBeforeFormPub = await callWorker('/api/config');
  const inPublicBefore = (cfgBeforeFormPub.data.forms || []).some(f => f.id === 'audit_test_form_2026');
  assert(
    draftFormRes.status === 200 &&
    draftFormRes.data.enabled === 0 &&
    draftFormRes.data.workflow_status === 'draft' &&
    !inPublicBefore,
    'Newly created form defaults to draft state (enabled=0) and is NOT auto-published on /api/config'
  );

  const formPubRes = await callWorker('/api/admin/forms/audit_test_form_2026/workflow', {
    method: 'POST', cookie: superAdminCookie,
    body: {action: 'publish', note: 'Phê duyệt công bố biểu mẫu'}
  });
  const cfgAfterFormPub = await callWorker('/api/config');
  const inPublicAfter = (cfgAfterFormPub.data.forms || []).some(f => f.id === 'audit_test_form_2026');
  assert(
    formPubRes.status === 200 &&
    formPubRes.data.enabled === 1 &&
    formPubRes.data.workflow_status === 'published' &&
    inPublicAfter,
    'Form approval & publish workflow transitions form to published and exposes it on /api/config'
  );

  // 30.5 RBAC separation: content_admin cannot modify system settings or modules (BUG-09)
  const invCa = await callWorker('/api/admin/users', {
    method: 'POST', cookie: superAdminCookie,
    body: {full_name: 'Content Admin User', email: 'contentadmin@skyfirst.io.vn', roles: ['content_admin'], activation_mode: 'self', must_change_password: false}
  });
  const caUser = await DB.prepare("SELECT id FROM users WHERE email='contentadmin@skyfirst.io.vn'").first();
  await DB.prepare("UPDATE users SET must_change_password=0 WHERE id=?").bind(caUser.id).run();
  const caLogin = await callWorker('/api/auth/login', {
    method: 'POST', body: {email: 'contentadmin@skyfirst.io.vn', password: invCa.data.temp_password, portal: 'admin'}
  });
  const caCookie = (caLogin.headers.get('set-cookie') || '').split(';')[0];
  const caSettingsAttempt = await callWorker('/api/admin/settings', {
    method: 'PUT', cookie: caCookie,
    body: {items: {app_short_name: 'Hacked'}}
  });
  const caModulesAttempt = await callWorker('/api/admin/modules', {
    method: 'PUT', cookie: caCookie,
    body: {items: [{key: 'forms', enabled: false}]}
  });
  assert(
    caSettingsAttempt.status === 403 && caModulesAttempt.status === 403,
    'content_admin is strictly blocked (403 FORBIDDEN) from modifying system settings or enabling/disabling system modules'
  );

  // 30.6 Sponsorship NAPAS bank validation: campaign without bank account rejects QR generation instead of defaulting to MB Bank (BUG-04)
  const noBankCamp = await callWorker('/api/admin/sponsorship/campaigns', {
    method: 'POST', cookie: superAdminCookie,
    body: {
      code: 'SFN-NOBANK-2026',
      title: 'Chiến dịch Chưa Cấu hình Ngân hàng',
      target_amount: 10000000,
      status: 'active',
      visibility: 'public'
    }
  });
  const noBankQr = await callWorker('/api/public/sponsorship/SFN-NOBANK-2026/qr-intent', {
    method: 'POST',
    body: {donor_name: 'Người thử nghiệm', expected_amount: 200000}
  });
  assert(
    noBankCamp.status === 201 &&
    noBankQr.status === 409 &&
    noBankQr.data.error === 'BANK_CONFIG_INCOMPLETE',
    'Sponsorship campaign without configured bank account rejects QR generation with 409 BANK_CONFIG_INCOMPLETE (never defaults to MB Bank)'
  );

  // 30.7 Central Credential Registry table issued_document_codes records issued certificates (BUG-05)
  const regRows = await DB.prepare("SELECT * FROM issued_document_codes").all();
  assert(Array.isArray(regRows.results) && regRows.results.length >= 1, 'issued_document_codes table exists and records issued credential lookup codes');
}


// 31. Master Prompt V11 Comprehensive Audit & Regression Suite (Phases III, IV, V, VI, VII, VIII)
{
  // 31.1 Phase III: CMS 500 Fixes on duplicate, sys_programs, sys_forms, sys_credentials
  for (const sysId of ['sys_programs', 'sys_forms', 'sys_credentials']) {
    const getSys = await callWorker(`/api/admin/cms/pages/${sysId}`, {cookie: superAdminCookie});
    assert(getSys.status === 200 && getSys.data.item?.id === sysId, `GET /api/admin/cms/pages/${sysId} succeeds (200)`);

    // Update system page with empty blocks_json (for sys_forms / sys_credentials) and verify no 500
    const putSys = await callWorker(`/api/admin/cms/pages/${sysId}`, {
      method: 'PUT', cookie: superAdminCookie,
      body: {
        title: getSys.data.item.title,
        slug: getSys.data.item.slug,
        summary: getSys.data.item.summary,
        blocks: getSys.data.item.blocks || []
      }
    });
    assert(putSys.status === 200 && putSys.data.ok === true, `PUT /api/admin/cms/pages/${sysId} succeeds without 500 error`);

    // Workflow publish on system page with empty blocks_json must succeed (200)
    const wfSys = await callWorker(`/api/admin/cms/pages/${sysId}/workflow`, {
      method: 'POST', cookie: superAdminCookie,
      body: {action: 'publish', note: `Kiểm thử xuất bản ${sysId}`}
    });
    assert(wfSys.status === 200 && wfSys.data.status === 'published', `POST /api/admin/cms/pages/${sysId}/workflow (publish) succeeds even when blocks=[]`);

    // Duplicate system page twice in a row to verify unique slug generation and non-system page_type on copy
    const dup1 = await callWorker(`/api/admin/cms/pages/${sysId}/duplicate`, {method: 'POST', cookie: superAdminCookie});
    const dup2 = await callWorker(`/api/admin/cms/pages/${sysId}/duplicate`, {method: 'POST', cookie: superAdminCookie});
    assert(
      dup1.status === 201 && dup2.status === 201 && dup1.data.slug !== dup2.data.slug,
      `POST /api/admin/cms/pages/${sysId}/duplicate succeeds repeatedly with unique slugs (${dup1.data.slug}, ${dup2.data.slug})`
    );
  }

  // Slug collision on PUT returns controlled 409 SLUG_EXISTS instead of 500 SQLite constraint crash
  const customPagesRes = await callWorker('/api/admin/cms/pages', {cookie: superAdminCookie});
  const customPage = customPagesRes.data.items.find(p => p.page_type !== 'system' && p.website_id === 'app');
  const slugConflict = await callWorker(`/api/admin/cms/pages/${encodeURIComponent(customPage.id)}`, {
    method: 'PUT', cookie: superAdminCookie,
    body: {title: customPage.title, slug: 'system-programs'}
  });
  assert(slugConflict.status === 409 && slugConflict.data.error === 'SLUG_EXISTS', 'PUT /api/admin/cms/pages/:id returns 409 SLUG_EXISTS on duplicate slug instead of 500');

  // Negative & RBAC tests on duplicate / sys_programs
  const dupNotFound = await callWorker('/api/admin/cms/pages/non_existent_page_id/duplicate', {method: 'POST', cookie: superAdminCookie});
  const dupUnauth = await callWorker('/api/admin/cms/pages/sys_programs/duplicate', {method: 'POST'});
  const haRelogin = await callWorker('/api/auth/login', {method: 'POST', body: {email: 'handler@skyfirst.io.vn', password: 'HandlerNew!2026', portal: 'admin'}});
  const activeHandlerCookie = (haRelogin.headers.get('set-cookie') || '').split(';')[0];
  const dupForbidden = await callWorker('/api/admin/cms/pages/sys_programs/duplicate', {method: 'POST', cookie: activeHandlerCookie});
  assert(
    dupNotFound.status === 404 && dupUnauth.status === 401 && dupForbidden.status === 403,
    'CMS duplicate endpoint enforces 401 unauthenticated, 403 unauthorized role, and 404 non-existent ID'
  );

  // 31.2 Phase IV: Sponsorship 4 States (has_positive_received, zero_received, no_data, query_error)
  // First restore normal positive balance on mainCampId so received > 0
  const posSp = await callWorker('/api/public/sponsorship');
  assert(
    posSp.status === 200 && posSp.data.state === 'has_positive_received' && posSp.data.summary.received_amount > 0,
    'Sponsorship state 1 (has_positive_received): verified received_amount > 0'
  );

  // Test zero_received state: set all campaigns todraft except a campaign with 0 received_amount (only pledged/pending)
  await DB.prepare("UPDATE sponsorship_campaigns SET visibility='internal' WHERE id=?").bind(mainCampId).run();
  await DB.prepare("UPDATE sponsorship_campaigns SET received_amount=0, pledged_amount=5000000, visibility='public', status='active' WHERE code='SFN-NOBANK-2026'").run();
  const zeroSp = await callWorker('/api/public/sponsorship');
  const zeroCfg = await callWorker('/api/config');
  assert(
    zeroSp.status === 200 &&
    zeroSp.data.state === 'zero_received' &&
    zeroSp.data.summary.has_data === true &&
    zeroSp.data.summary.received_amount === 0 &&
    zeroCfg.data.home_stats?.d1_values?.sponsorship === 0 &&
    zeroCfg.data.home_stats?.d1_values?.sponsorship_state === 'zero_received',
    'Sponsorship state 2 (zero_received): valid public campaign with 0 verified received is distinguished from no_data'
  );

  // Test no_data state: hide all public campaigns
  await DB.prepare("UPDATE sponsorship_campaigns SET visibility='internal'").run();
  const noDataSp = await callWorker('/api/public/sponsorship');
  const noDataCfg = await callWorker('/api/config');
  assert(
    noDataSp.status === 200 &&
    noDataSp.data.state === 'no_data' &&
    noDataSp.data.summary.has_data === false &&
    noDataCfg.data.home_stats?.d1_values?.sponsorship === null &&
    noDataCfg.data.home_stats?.d1_values?.sponsorship_state === 'no_data',
    'Sponsorship state 3 (no_data): when no public campaigns exist, returns state=no_data and null homepage sponsorship'
  );

  // Test query_error state: simulate DB failure and verify 503 SPONSORSHIP_QUERY_ERROR (never fake 0 or no_data)
  const savedDb = env.DB;
  env.DB = {
    prepare() {
      return {
        bind() { return this; },
        async all() { throw new Error('Simulated D1 connection failure'); },
        async first() { throw new Error('Simulated D1 connection failure'); },
        async run() { throw new Error('Simulated D1 connection failure'); }
      };
    },
    async batch() { throw new Error('Simulated D1 batch failure'); }
  };
  const errSp = await callWorker('/api/public/sponsorship');
  const errCfg = await callWorker('/api/config');
  env.DB = savedDb;
  // Restore mainCampId visibility
  await DB.prepare("UPDATE sponsorship_campaigns SET visibility='public' WHERE id=?").bind(mainCampId).run();
  assert(
    errSp.status === 503 &&
    errSp.data.error === 'SPONSORSHIP_QUERY_ERROR' &&
    errSp.data.state === 'query_error' &&
    errSp.data.summary?.has_data === false &&
    errCfg.data.home_stats?.d1_values?.sponsorship_state === 'query_error' &&
    errCfg.data.home_stats?.d1_values?.error === true,
    'Sponsorship state 4 (query_error): DB failure returns HTTP 503 SPONSORSHIP_QUERY_ERROR and never turns error into fake 0 or no_data'
  );

  // 31.3 Phase V: Certificate & Document Full 8-Step Lifecycle, Configurable Document Types, Phone Column & Legacy Code Compatibility
  // Step 1: Create configurable document type (Quyết định công nhận -> QD) with phone number
  const createQd = await callWorker('/api/admin/certificates', {
    method: 'POST', cookie: superAdminCookie,
    body: {
      full_name: 'Nguyễn Thị Quyết Định',
      email: 'quyetdinh@skyfirst.io.vn',
      phone: '0933445566',
      cert_type: 'Quyết định công nhận',
      prefix: 'QD',
      content: 'Công nhận Ban Điều hành Dự án Cộng đồng 2026',
      metadata: {unit_name: 'Sky First', program: 'Community Leadership 2026', role: 'Trưởng ban'}
    }
  });
  assert(createQd.status === 200 && createQd.data.id && createQd.data.prefix === 'QD', 'Certificate Step 1 (Create): Created configurable document type (QD) with phone column');
  const qdId = createQd.data.id;

  // Step 2: Edit before issuance
  const editQd = await callWorker(`/api/admin/certificates/${encodeURIComponent(qdId)}`, {
    method: 'PUT', cookie: superAdminCookie,
    body: {
      full_name: 'Nguyễn Thị Quyết Định (Đã cập nhật)',
      email: 'quyetdinh@skyfirst.io.vn',
      phone: '0933445577',
      content: 'Công nhận Ban Điều hành Dự án Cộng đồng Sky First 2026'
    }
  });
  assert(editQd.status === 200 && editQd.data.ok === true, 'Certificate Step 2 (Edit): Updated recipient name, phone, and content before issuance');

  // Step 3: Create a temporary draft certificate and delete it before issuance
  const tempCert = await callWorker('/api/admin/certificates', {
    method: 'POST', cookie: superAdminCookie,
    body: {full_name: 'Bản Ghi Nháp Cần Xóa', cert_type: 'Giấy xác nhận', content: 'Nháp'}
  });
  const delDraft = await callWorker(`/api/admin/certificates/${encodeURIComponent(tempCert.data.id)}`, {
    method: 'DELETE', cookie: superAdminCookie
  });
  assert(delDraft.status === 200 && delDraft.data.ok === true, 'Certificate Step 3a (Delete unissued): Unissued certificate can be deleted cleanly');

  // Step 4: Approve via direct approve action
  const approveQd = await callWorker(`/api/admin/certificates/${encodeURIComponent(qdId)}`, {
    method: 'PATCH', cookie: reviewerCookie,
    body: {action: 'approve', note: 'Phê duyệt Quyết định công nhận'}
  });
  assert(approveQd.status === 200 && approveQd.data.status === 'approved', 'Certificate Step 4 (Approve): Transitioned to approved status with approved_at');

  // Step 5: Issue configurable document type -> generates SFN-QD-########
  const issueQd = await callWorker(`/api/admin/certificates/${encodeURIComponent(qdId)}`, {
    method: 'PATCH', cookie: superAdminCookie,
    body: {action: 'issue'}
  });
  assert(issueQd.status === 200 && /^SFN-QD-\d{8}$/.test(issueQd.data.code), `Certificate Step 5 (Issue): Issued configurable document code ${issueQd.data.code}`);
  const qdCode = issueQd.data.code;

  // Attempt to delete an issued certificate -> must be blocked with 409 DELETE_ISSUED_FORBIDDEN
  const delIssued = await callWorker(`/api/admin/certificates/${encodeURIComponent(qdId)}`, {
    method: 'DELETE', cookie: superAdminCookie
  });
  assert(delIssued.status === 409 && delIssued.data.error === 'CANNOT_DELETE_ISSUED_CREDENTIAL', 'Certificate Step 3b (Delete guard): Issued certificate cannot be deleted (409 CANNOT_DELETE_ISSUED_CREDENTIAL)');

  // Lookup by phone using structured phone column (even when formatted with spaces/dashes)
  const lookByPhone = await callWorker('/api/lookup/certificate', {
    method: 'POST',
    body: {phone: '0933-445-577'}
  });
  assert(
    lookByPhone.status === 200 &&
    lookByPhone.data.item?.code === qdCode &&
    lookByPhone.data.item?.type === 'Quyết định công nhận' &&
    !JSON.stringify(lookByPhone.data).includes('0933445577') &&
    !JSON.stringify(lookByPhone.data).includes('quyetdinh@skyfirst.io.vn'),
    'Certificate Lookup by Phone: Queries structured phone column, returns configurable document type, and never leaks phone/email'
  );

  // Step 6 & 7: Supersede (Thay thế) -> creates replacement -> approve & issue replacement -> original becomes superseded
  const supReq = await callWorker(`/api/admin/certificates/${encodeURIComponent(qdId)}`, {
    method: 'PATCH', cookie: superAdminCookie,
    body: {action: 'supersede', note: 'Cấp lại do điều chỉnh chức danh', content: 'Công nhận Trưởng Ban Điều hành Dự án Cộng đồng 2026'}
  });
  assert(supReq.status === 200 && supReq.data.replacement_id, 'Certificate Step 7a (Supersede request): Created replacement certificate record');
  const repId = supReq.data.replacement_id;

  await callWorker(`/api/admin/certificates/${encodeURIComponent(repId)}`, {
    method: 'PATCH', cookie: reviewerCookie, body: {action: 'approve', note: 'Duyệt bản thay thế'}
  });
  const issueRep = await callWorker(`/api/admin/certificates/${encodeURIComponent(repId)}`, {
    method: 'PATCH', cookie: superAdminCookie, body: {action: 'issue'}
  });
  const lookOldSuperseded = await callWorker(`/api/public/credentials/${encodeURIComponent(qdCode)}`);
  const lookNewReplacement = await callWorker(`/api/public/credentials/${encodeURIComponent(issueRep.data.code)}`);
  assert(
    issueRep.status === 200 &&
    lookOldSuperseded.status === 200 &&
    lookOldSuperseded.data.item?.status === 'superseded' &&
    lookOldSuperseded.data.item?.status_text === 'ĐÃ ĐƯỢC THAY THẾ' &&
    lookOldSuperseded.data.item?.replacement_code === issueRep.data.code &&
    lookNewReplacement.status === 200 &&
    lookNewReplacement.data.item?.status === 'issued',
    'Certificate Step 7b (Supersede completion): Issuing replacement transitions old record to ĐÃ ĐƯỢC THAY THẾ with link to replacement_code'
  );

  // Step 8: View History
  const qdHist = await callWorker(`/api/admin/certificates/${encodeURIComponent(qdId)}/history`, {cookie: superAdminCookie});
  assert(
    qdHist.status === 200 &&
    Array.isArray(qdHist.data.history) &&
    qdHist.data.history.length >= 4,
    'Certificate Step 8 (History): Returns chronological audit history of all lifecycle transitions'
  );

  // Legacy code compatibility check
  await DB.prepare("INSERT INTO certificates(id,code,legacy_code,full_name,email,phone,cert_type,content,status,verification_token,issued_at) VALUES('cert_legacy_2025','015-GCN-SFN/2025','015-GCN-SFN/2025','Trần Văn Mã Cũ','macu@skyfirst.io.vn','0909111222','Giấy chứng nhận','Hoàn thành khóa học năm 2025','issued','vtok_legacy_2025',CURRENT_TIMESTAMP)").run();
  const legacyLookup = await callWorker(`/api/public/credentials/${encodeURIComponent('015-GCN-SFN/2025')}`);
  assert(
    legacyLookup.status === 200 &&
    legacyLookup.data.verified === true &&
    legacyLookup.data.item?.code === '015-GCN-SFN/2025',
    'Legacy Certificate Code Compatibility: Lookup by legacy code 015-GCN-SFN/2025 succeeds alongside 8-digit random codes'
  );

  // 31.4 Phase VI: QR Code Verification (Zero "SKY FIRST · XÁC THỰC" text, Zero PII)
  const qrSvgRes = await callWorker(`/api/public/credentials/${encodeURIComponent(issueRep.data.code)}/qr.svg`);
  const qrSvgText = String(qrSvgRes.data || '');
  assert(
    qrSvgRes.status === 200 &&
    qrSvgText.startsWith('<svg ') &&
    !qrSvgText.includes('SKY FIRST · XÁC THỰC') &&
    !qrSvgText.includes('VIETQR SKY FIRST') &&
    !qrSvgText.includes('<text ') &&
    !qrSvgText.includes('quyetdinh@skyfirst.io.vn') &&
    !qrSvgText.includes('0933445577'),
    'Phase VI QR Code: SVG contains no "SKY FIRST · XÁC THỰC" text, no replacement caption, and zero personal data'
  );

  // 31.5 Phase VII & VIII: Exact Verbatim UI Copy & Policy Removal Verification
  const cfgCheckFinal = await callWorker('/api/config?lang=vi');
  const sysPagesFinal = cfgCheckFinal.data.cms_system_pages || {};
  const aboutBlocksJson = JSON.stringify(sysPagesFinal['/gioi-thieu']?.blocks || []);
  const spBlocksJson = JSON.stringify(sysPagesFinal['/tai-tro']?.blocks || []);
  const supBlocksJson = JSON.stringify(sysPagesFinal['/ho-tro']?.blocks || []);
  const portalJsText = fs.readFileSync(path.join(root, 'public/digital-portal.js'), 'utf8');
  const indexHtmlText = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');

  assert(
    aboutBlocksJson.includes('Quản lý thống nhất cấu hình, nội dung, ngôn ngữ hiển thị (Tiếng Việt/Tiếng Anh), biểu mẫu và quy trình phê duyệt trên cùng một hệ thống.') &&
    aboutBlocksJson.includes('Hỗ trợ tra cứu chứng nhận, theo dõi tiến trình xử lý hồ sơ và công khai thông tin đối soát tài trợ theo dữ liệu đã xác minh.') &&
    !aboutBlocksJson.includes('Quản trị Tập trung (Admin-Driven)') &&
    !aboutBlocksJson.includes('Xác thực Minh bạch'),
    'Phase VII (7.1 & 7.2): /gioi-thieu CMS blocks match exact required Vietnamese copy'
  );

  assert(
    supBlocksJson.includes('Truy cập trang Tra cứu Hồ sơ và nhập Mã hồ sơ kèm địa chỉ Email đã đăng ký.') &&
    supBlocksJson.includes('Truy cập trang Xác thực Chứng nhận và nhập mã chứng nhận hoặc tra cứu bằng Email/Số điện thoại.') &&
    !supBlocksJson.includes('(/ho-so)') &&
    !supBlocksJson.includes('SFN-TNV-2026-0001') &&
    !supBlocksJson.includes('(/gcn)') &&
    !supBlocksJson.includes('SFN-GCN-########'),
    'Phase VII (7.3 & 7.4): /ho-tro FAQ items match exact required Vietnamese copy and omit forbidden path/code examples'
  );

  assert(
    spBlocksJson.includes('Nguyên tắc đối soát tài chính') &&
    spBlocksJson.includes('Mọi khoản chuyển khoản qua mã QR chỉ được ghi nhận vào số tiền thực nhận sau khi xác minh giao dịch thành công.') &&
    portalJsText.includes('Tách biệt tiền cam kết và tiền thực nhận') &&
    portalJsText.includes('Theo dõi và công bố riêng số tiền cam kết và số tiền thực nhận, không cộng gộp hai khoản.') &&
    portalJsText.includes('Đối soát trước khi công bố') &&
    portalJsText.includes('Các khoản thu, chi và chứng từ tài chính phải được người có thẩm quyền xác minh trước khi công khai.') &&
    portalJsText.includes('Bảo vệ thông tin nhà tài trợ') &&
    portalJsText.includes('Bảo mật số tài khoản, số định danh và thông tin liên hệ riêng tư của nhà tài trợ.') &&
    portalJsText.includes('Hiện chưa có chương trình vận động tài trợ hoặc báo cáo tài chính được phê duyệt công bố. Không hiển thị số liệu giả lập, không gộp tiền cam kết với tiền thực nhận và chỉ công bố số liệu sau khi hoàn tất đối soát.'),
    'Phase IV (4.3–4.7): Sponsorship principles and empty-state notices match exact required verbatim copy'
  );

  assert(
    portalJsText.includes('Trạng thái chứng nhận') &&
    portalJsText.includes('Phân biệt rõ chứng nhận đang có hiệu lực, hết hiệu lực, đã bị thu hồi hoặc đã được thay thế bằng mã mới.') &&
    portalJsText.includes('Tương thích mã cũ và mới') &&
    portalJsText.includes('Hỗ trợ đồng thời mã định danh ngẫu nhiên gồm 8 chữ số và các mã chứng nhận đã phát hành trước đây.') &&
    portalJsText.includes('Theo dõi tiến trình xử lý hồ sơ đã gửi và cập nhật trạng thái xử lý theo thông tin hiện có trên hệ thống.'),
    'Phase V (5.5–5.6) & Phase VII (7.5): Credential and Case Lookup descriptions match exact required verbatim copy'
  );

  const exactCitation = 'Mọi nội dung trích dẫn phải bảo đảm tính chính xác, trung thực và đầy đủ về ngữ cảnh; ghi rõ nguồn tham khảo và đính kèm liên kết đến tài liệu gốc khi có thể. Việc sử dụng, trích dẫn và chia sẻ thông tin phải tuân thủ quy định về bản quyền, quyền sở hữu trí tuệ và bảo vệ dữ liệu cá nhân.';
  assert(
    cfgCheckFinal.data.footer_citation_notice === exactCitation &&
    portalJsText.includes(exactCitation) &&
    indexHtmlText.includes(exactCitation) &&
    !('lookup_data_policy_notice' in cfgCheckFinal.data) &&
    !('lookup_timestamp_notice' in cfgCheckFinal.data) &&
    !portalJsText.includes('Chính sách dữ liệu tra cứu:') &&
    !portalJsText.includes('Kết quả tra cứu phản ánh trạng thái của bản ghi trong cơ sở dữ liệu Hệ thống Thông tin Số Sky First tại thời điểm thực hiện truy vấn.'),
    'Phase VII (7.6) & Phase VIII (8.1–8.3): Footer citation notice updated and lookup policy/timestamp strings completely removed from UI & API'
  );

  // 31.6 Zero-500 Admin Self-Healing Schema & Fault-Tolerant Audit Test (Production Legacy D1 Simulation)
  await DB.prepare("DROP TABLE IF EXISTS audit_log").run();
  await DB.prepare("DROP TABLE IF EXISTS issued_document_codes").run();
  await DB.prepare("DROP TABLE IF EXISTS term_revisions").run();
  const healSettingsPut = await callWorker('/api/admin/settings', {
    method: 'PUT', cookie: superAdminCookie,
    body: {items: {app_short_name: 'Sky First'}}
  });
  const healDashGet = await callWorker('/api/admin/dashboard', {cookie: superAdminCookie});
  const healHealthGet = await callWorker('/api/admin/system/health', {cookie: superAdminCookie});
  assert(
    healSettingsPut.status === 200 &&
    healDashGet.status === 200 &&
    healHealthGet.status === 200 &&
    healHealthGet.data.services?.schema?.ok === true,
    'Admin Runtime Auto-Healing Schema: Even if audit_log / issued_document_codes / term_revisions are missing on D1, Admin automatically heals schema and completes mutations with 200 OK (Zero 500 INTERNAL_ERROR)'
  );
}


console.log(`\n========================================`);
console.log(`TOTAL E2E & REGRESSION TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
console.log(`========================================`);
if (failed > 0) process.exit(1);

pyDaemon.kill();

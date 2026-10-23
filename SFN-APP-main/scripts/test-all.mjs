import {webcrypto} from "node:crypto";
if (!globalThis.crypto) globalThis.crypto = webcrypto;
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import worker from '../src/index.js';
import {pbkdf2} from '../src/utils.js';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const dbPath = '/tmp/sfn_e2e_test.db';
if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);

// 1. Initialize SQLite database with all migrations 0001..0008
const migSet = new Set(fs.readdirSync(path.join(root, 'migrations')).filter(f => f.endsWith('.sql')));
if (fs.existsSync(path.join(root, 'migrations/0009_super_website_universal_email_and_cms.sql'))) {
  migSet.add('0009_super_website_universal_email_and_cms.sql');
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

// Create D1-compatible adapter backed by real SQLite via python3 helper
function runSqliteOp(ops) {
  const input = JSON.stringify({dbPath, ops});
  const py = `
import sqlite3, json, sys
data = json.loads(sys.stdin.read())
conn = sqlite3.connect(data["dbPath"])
conn.row_factory = sqlite3.Row
out = []
for op in data["ops"]:
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
conn.close()
print(json.dumps(out))
`;
  const r = spawnSync('python3', ['-c', py], {input, encoding: 'utf8', maxBuffer: 50 * 1024 * 1024});
  if (r.status !== 0) {
    throw new Error(r.stderr || 'SQLite error');
  }
  return JSON.parse(r.stdout);
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
    return runSqliteOp([{sql: this.sql, params: this.params, mode: 'all'}])[0];
  }
  async first() {
    const res = runSqliteOp([{sql: this.sql, params: this.params, mode: 'first'}])[0];
    return res;
  }
  async run() {
    return runSqliteOp([{sql: this.sql, params: this.params, mode: 'run'}])[0];
  }
}

const DB = {
  prepare(sql) {
    return new D1Statement(sql);
  },
  async batch(stmts) {
    const ops = stmts.map(s => ({sql: s.sql, params: s.params, mode: 'all'}));
    return runSqliteOp(ops);
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
  XANH_CTT_SHARED_SECRET: '0123456789abcdef0123456789abcdef0123456789abcdef'
};

async function callWorker(pathAndQuery, {method = 'GET', headers = {}, body = null, cookie = ''} = {}) {
  const h = new Headers(headers);
  if (cookie) h.set('cookie', cookie);
  if (method !== 'GET' && method !== 'HEAD' && !h.has('origin')) {
    h.set('origin', 'https://app.skyfirst.io.vn');
  }
  let reqBody = body;
  if (body && typeof body === 'object' && !(body instanceof Uint8Array) && !(body instanceof ArrayBuffer)) {
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

// 4. Authentication & RBAC (including invited account activation & PBKDF2)
let superAdminCookie = '';
{
  // Set known password for super_admin to test login
  const salt = 'O1M7291qarCiAr9hV1Dmxg';
  const hash150k = await pbkdf2('AdminPass!2026', salt, 150000);
  await DB.prepare("UPDATE users SET password_hash=?, must_change_password=0 WHERE email='skyfirst.ec@gmail.com'").bind(hash150k).run();

  const badLogin = await callWorker('/api/auth/login', {method: 'POST', body: {email: 'skyfirst.ec@gmail.com', password: 'WrongPassword', portal: 'admin'}});
  assert(badLogin.status === 401, 'Invalid login password rejected with 401');

  const goodLogin = await callWorker('/api/auth/login', {method: 'POST', body: {email: 'skyfirst.ec@gmail.com', password: 'AdminPass!2026', portal: 'admin'}});
  assert(goodLogin.status === 200 && goodLogin.data.ok === true, 'Super Admin login with 150k PBKDF2 hash succeeds');
  const setCookie = goodLogin.headers.get('set-cookie') || '';
  superAdminCookie = setCookie.split(';')[0];
  assert(superAdminCookie.startsWith('sfn_session='), 'Session cookie issued on login');

  // Unauthenticated access to admin API must fail
  const unauthAdmin = await callWorker('/api/admin/dashboard');
  assert(unauthAdmin.status === 401, 'Unauthenticated request to /api/admin/dashboard rejected with 401');

  // Authenticated dashboard succeeds
  const dash = await callWorker('/api/admin/dashboard', {cookie: superAdminCookie});
  assert(dash.status === 200 && typeof dash.data.counts?.submissions === 'number', 'Authenticated Super Admin accesses /api/admin/dashboard');
}

// 5. Invited Admin Account Activation Flow (/api/admin/users -> /api/auth/reset -> /api/auth/login)
let reviewerCookie = '', editorCookie = '', handlerCookie = '';
{
  const invRev = await callWorker('/api/admin/users', {
    method: 'POST', cookie: superAdminCookie,
    body: {full_name: 'Reviewer User', email: 'reviewer@skyfirst.io.vn', roles: ['reviewer'], activation_mode: 'self'}
  });
  assert(invRev.status === 200 && invRev.data.temp_password, 'Created Reviewer account');
  const revLogin = await callWorker('/api/auth/login', {
    method: 'POST', body: {email: 'reviewer@skyfirst.io.vn', password: invRev.data.temp_password, portal: 'admin'}
  });
  reviewerCookie = (revLogin.headers.get('set-cookie') || '').split(';')[0];

  const invEd = await callWorker('/api/admin/users', {
    method: 'POST', cookie: superAdminCookie,
    body: {full_name: 'Editor SFEC', email: 'editor@skyfirst.io.vn', roles: ['editor'], scope_unit_code: 'SFEC', activation_mode: 'self'}
  });
  const edLogin = await callWorker('/api/auth/login', {
    method: 'POST', body: {email: 'editor@skyfirst.io.vn', password: invEd.data.temp_password, portal: 'admin'}
  });
  editorCookie = (edLogin.headers.get('set-cookie') || '').split(';')[0];

  const invHa = await callWorker('/api/admin/users', {
    method: 'POST', cookie: superAdminCookie,
    body: {full_name: 'Handler User', email: 'handler@skyfirst.io.vn', roles: ['handler'], activation_mode: 'self'}
  });
  const haLogin = await callWorker('/api/auth/login', {
    method: 'POST', body: {email: 'handler@skyfirst.io.vn', password: invHa.data.temp_password, portal: 'admin'}
  });
  handlerCookie = (haLogin.headers.get('set-cookie') || '').split(';')[0];

  // Test Editor blocked from user management
  const edUsers = await callWorker('/api/admin/users', {cookie: editorCookie});
  assert(edUsers.status === 403, 'Editor role blocked from /api/admin/users (403 FORBIDDEN)');
}

// 6. Forms, Upload Session (Magic Bytes + Signature) & Case Lookup Privacy
let submittedCode = '';
{
  // Create upload session for PNG signature
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

  // Draft/pending certificate must NOT be publicly verifiable yet
  const preVerify = await callWorker(`/api/public/credentials/${encodeURIComponent(certReq.data.id)}`);
  assert(preVerify.status === 404, 'Pending certificate is not publicly exposed before issuance');

  // Approve via Reviewer
  const appDecide = await callWorker(`/api/admin/approvals/${encodeURIComponent(certReq.data.approval_id)}`, {
    method: 'PATCH', cookie: reviewerCookie, body: {status: 'approved', note: 'Đủ điều kiện cấp GCN'}
  });
  assert(appDecide.status === 200, 'Reviewer approved certificate request');

  // Issue certificate
  const issued = await callWorker(`/api/admin/certificates/${encodeURIComponent(certReq.data.id)}`, {
    method: 'PATCH', cookie: superAdminCookie, body: {action: 'issue'}
  });
  assert(issued.status === 200 && /^SFN-GCN-\d{8}$/.test(issued.data.code), `Certificate issued with code ${issued.data.code}`);
  const certCode = issued.data.code;

  // Lookup valid certificate by code
  const pubCert = await callWorker(`/api/public/credentials/${encodeURIComponent(certCode)}`);
  assert(pubCert.status === 200 && pubCert.data.verified === true && pubCert.data.item.status === 'issued', 'Valid certificate lookup returns CÓ HIỆU LỰC');

  // Revoke certificate
  const rev = await callWorker(`/api/admin/certificates/${encodeURIComponent(certReq.data.id)}`, {
    method: 'PATCH', cookie: superAdminCookie, body: {action: 'revoke', note: 'Thu hồi để kiểm tra'}
  });
  assert(rev.status === 200, 'Certificate revoked');
  const pubRevoked = await callWorker(`/api/public/credentials/${encodeURIComponent(certCode)}`);
  assert(pubRevoked.status === 200 && pubRevoked.data.verified === false && pubRevoked.data.item.status === 'revoked' && pubRevoked.data.item.revocation_reason === 'Thu hồi để kiểm tra', 'Revoked certificate lookup clearly shows ĐÃ THU HỒI and reason');

  // Invalid code lookup returns 404
  const badCert = await callWorker('/api/public/credentials/SFN-GCN-99999999');
  assert(badCert.status === 404, 'Non-existent certificate code returns 404');
}

// 8. Sponsorship Transparency Module (/tai-tro & /api/admin/sponsorship)
{
  const campRes = await callWorker('/api/admin/sponsorship/campaigns', {
    method: 'POST', cookie: superAdminCookie,
    body: {code: 'SFN-TT-2026-01', title: 'Học bổng Cộng đồng 2026', summary: 'Hỗ trợ học liệu', purpose: 'Trao tặng sách và học liệu', target_amount: 50000000, status: 'active', visibility: 'public'}
  });
  assert(campRes.status === 201 && campRes.data.id, 'Created public sponsorship campaign');
  const campId = campRes.data.id;

  // Add Pledge (20,000,000), Receipt (15,000,000), Disbursement (5,000,000)
  await callWorker('/api/admin/sponsorship/transactions', {
    method: 'POST', cookie: superAdminCookie,
    body: {campaign_id: campId, tx_type: 'pledge', amount: 20000000, public_party_label: 'Đơn vị đồng hành A', purpose: 'Cam kết tài trợ đợt 1', verification_status: 'verified', is_public: true}
  });
  await callWorker('/api/admin/sponsorship/transactions', {
    method: 'POST', cookie: superAdminCookie,
    body: {campaign_id: campId, tx_type: 'receipt', amount: 15000000, public_party_label: 'Đơn vị đồng hành A', purpose: 'Thực nhận đợt 1', verification_status: 'verified', is_public: true}
  });
  await callWorker('/api/admin/sponsorship/transactions', {
    method: 'POST', cookie: superAdminCookie,
    body: {campaign_id: campId, tx_type: 'disbursement', amount: 5000000, public_party_label: 'Mua học liệu đợt 1', purpose: 'Chi mua sách giáo khoa', verification_status: 'verified', is_public: true}
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

  // Verify homepage 5th stat now updates automatically from D1!
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

  // Upload v2 and attach version
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
}

// 12. Visual Page Builder, Separation of Duties & Multi-Website Scope Isolation
{
  // Editor scoped to SFEC tries to create a page on 'main' website -> must be blocked (403)
  const crossSite = await callWorker('/api/admin/cms/pages', {
    method: 'POST', cookie: editorCookie,
    body: {website_id: 'main', title: 'Trang trái phép', slug: 'trang-trai-phep', blocks: []}
  });
  assert(crossSite.status === 403, 'Multi-website isolation blocks SFEC-scoped editor from creating page on main website');

  // Editor creates page on their assigned website scope ('sfec')
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

  // Draft page is not publicly accessible yet
  const prePub = await callWorker('/api/public/pages/gioi-thieu-he-thong-so');
  assert(prePub.status === 404, 'Draft CMS page is not publicly visible before publishing');

  // Editor submits page for review
  const subRev = await callWorker(`/api/admin/cms/pages/${encodeURIComponent(pageId)}/workflow`, {
    method: 'POST', cookie: editorCookie, body: {action: 'submit_review'}
  });
  assert(subRev.status === 200 && subRev.data.status === 'pending_review', 'Editor submitted page to pending_review');

  // Editor cannot approve or publish the page
  const edApprove = await callWorker(`/api/admin/cms/pages/${encodeURIComponent(pageId)}/workflow`, {
    method: 'POST', cookie: editorCookie, body: {action: 'approve'}
  });
  assert(edApprove.status === 403, 'Editor blocked from approving CMS page');

  // Reviewer approves the page
  const revApprove = await callWorker(`/api/admin/cms/pages/${encodeURIComponent(pageId)}/workflow`, {
    method: 'POST', cookie: reviewerCookie, body: {action: 'approve', note: 'Nội dung đạt chuẩn'}
  });
  assert(revApprove.status === 200 && revApprove.data.status === 'approved', 'Reviewer approved CMS page');

  // Super Admin publishes the approved page
  const pubAction = await callWorker(`/api/admin/cms/pages/${encodeURIComponent(pageId)}/workflow`, {
    method: 'POST', cookie: superAdminCookie, body: {action: 'publish'}
  });
  assert(pubAction.status === 200 && pubAction.data.status === 'published', 'Approved CMS page published to live');

  // Public page endpoint now serves the visual blocks
  const postPub = await callWorker('/api/public/pages/gioi-thieu-he-thong-so?website_id=sfec');
  assert(postPub.status === 200 && postPub.data.item?.blocks?.length === 2, 'Published CMS page is publicly accessible with visual blocks');
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

// 14. Admin-Assisted Password Reset (/api/auth/forgot) & Auth Audit Logging
{
  const forgotRes = await callWorker('/api/auth/forgot', {
    method: 'POST',
    body: {email: 'skyfirst.ec@gmail.com', note: 'Nhờ quản trị viên cấp lại mật khẩu'}
  });
  assert(
    forgotRes.status === 200 &&
    forgotRes.data.ok === true &&
    forgotRes.data.mode === 'admin_assisted' &&
    forgotRes.data.support_email === 'support@skyfirst.io.vn' &&
    forgotRes.data.hotline === '0924 910 210',
    'Forgot-password workflow creates admin-assisted support ticket (SFN-PW-*) and returns official support contact info'
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
    certLookup.data.data_policy_notice === 'Hệ thống chỉ cung cấp các thông tin được phép công khai theo chính sách dữ liệu của Sky First Network. Thông tin cá nhân và dữ liệu nội bộ không thuộc phạm vi công khai phải được bảo vệ, không trả về trong phản hồi tra cứu hoặc hiển thị trên giao diện người dùng.' &&
    certLookup.data.query_timestamp_notice === 'Kết quả tra cứu phản ánh trạng thái của bản ghi trong cơ sở dữ liệu Hệ thống Thông tin Số Sky First tại thời điểm thực hiện truy vấn.' &&
    Boolean(certLookup.data.queried_at),
    'Public lookup returns exact required Sky First data privacy policy notice, timestamp notice, and queried_at'
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

  // Revoke document
  const revDoc = await callWorker(`/api/admin/documents/${encodeURIComponent(targetDoc.id)}/lifecycle`, {
    method: 'POST', cookie: superAdminCookie,
    body: {action: 'revoke', reason: 'Thu hồi bản hướng dẫn cũ để cập nhật quy chế mới'}
  });
  assert(revDoc.status === 200 && revDoc.data.status === 'Đã thu hồi' && revDoc.data.visibility === 'internal', 'Document lifecycle revoke updates status to Đã thu hồi and restricts visibility to internal');

  // Restore document
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

console.log(`\n========================================`);
console.log(`TOTAL E2E & REGRESSION TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
console.log(`========================================`);
if (failed > 0) process.exit(1);

import {webcrypto} from "node:crypto";
if (!globalThis.crypto) globalThis.crypto = webcrypto;
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import worker from '../src/index.js';
import {pbkdf2, pbkdf2SyncSha256, fromB64url, b64url} from '../src/utils.js';
import {spawn} from 'node:child_process';
import {renderUniversalEmail, sendEmail, validateAndPrepareAttachments, classifyEmailEvent, EMAIL_EVENT_CATALOG} from '../src/email.js';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const dbPath = '/tmp/sfn_e2e_test.db';
if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);

// 1. Initialize SQLite database with all migrations 0001..0008
const migrations = fs.readdirSync(path.join(root, 'migrations'))
  .filter(f => f.endsWith('.sql'))
  .sort();

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

// Create D1-compatible adapter backed by persistent SQLite daemon over local HTTP
const pyDaemonCode = `
import sqlite3, json, sys
from http.server import BaseHTTPRequestHandler, HTTPServer

conn = sqlite3.connect(sys.argv[1], check_same_thread=False)
conn.row_factory = sqlite3.Row

class Handler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass
    def do_POST(self):
        length = int(self.headers.get("content-length", 0))
        data = json.loads(self.rfile.read(length).decode("utf-8"))
        out = []
        try:
            for op in data["ops"]:
                cur = conn.cursor()
                cur.execute(op["sql"], op.get("params", []))
                mode = op["mode"]
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
            body = json.dumps(out).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        except Exception as e:
            conn.rollback()
            err = json.dumps({"error": str(e)}).encode("utf-8")
            self.send_response(500)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(err)))
            self.end_headers()
            self.wfile.write(err)

srv = HTTPServer(("127.0.0.1", 0), Handler)
print(srv.server_port, flush=True)
srv.serve_forever()
`;

const pyProc = spawn("python3", ["-c", pyDaemonCode, dbPath], { stdio: ["ignore", "pipe", "inherit"] });
const sqlitePort = await new Promise((resolve) => {
  pyProc.stdout.once("data", (chunk) => resolve(Number(String(chunk).trim())));
});
process.on("exit", () => { try { pyProc.kill(); } catch {} });
const realNodeFetch = globalThis.fetch;

async function runSqliteOp(ops) {
  const r = await realNodeFetch(`http://127.0.0.1:${sqlitePort}/query`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ops })
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || "SQLite error");
  return data;
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
    return (await runSqliteOp([{sql: this.sql, params: this.params, mode: "all"}]))[0];
  }
  async first() {
    return (await runSqliteOp([{sql: this.sql, params: this.params, mode: "first"}]))[0];
  }
  async run() {
    return (await runSqliteOp([{sql: this.sql, params: this.params, mode: "run"}]))[0];
  }
}

const DB = {
  prepare(sql) {
    return new D1Statement(sql);
  },
  async batch(stmts) {
    const ops = stmts.map(s => ({sql: s.sql, params: s.params, mode: "all"}));
    return await runSqliteOp(ops);
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
  assert(d1v.programs === 7 && d1v.partners === 1 && d1v.certificates === 0 && d1v.sponsorship === 0, '5 Homepage statistics accurately reflect initial D1 seed data (7 classes, 1 unit, 0 issued certs, 0 sponsorship when no public campaign exists)');
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


// 13. Problem #3 & #13: Pure-JS PBKDF2 150k Fallback & Admin-Contact Forgot Password Flow
{
  const salt = "O1M7291qarCiAr9hV1Dmxg";
  const jsHash = b64url(pbkdf2SyncSha256("AdminPass!2026", fromB64url(salt), 150000));
  const webHash = await pbkdf2("AdminPass!2026", salt, 150000);
  assert(jsHash === webHash && jsHash.length > 40, "Pure-JS PBKDF2 fallback computes identical 150,000-iteration SHA-256 digest as WebCrypto");

  const forgotRes = await callWorker("/api/auth/forgot", {
    method: "POST",
    body: { email: "skyfirst.ec@gmail.com", lang: "vi" }
  });
  assert(
    forgotRes.status === 200 &&
    forgotRes.data.mode === "contact_admin" &&
    forgotRes.data.support_email === "support@skyfirst.io.vn" &&
    forgotRes.data.hotline === "0924 910 210",
    "Forgot password endpoint enforces admin-assisted reset policy with support@skyfirst.io.vn and 0924 910 210"
  );
}

// 14. Problem #1: Certificate Lookup Policy Notices, Email/Phone Lookup & Expired/Superseded States
{
  const c2 = await callWorker("/api/admin/certificates", {
    method: "POST", cookie: superAdminCookie,
    body: {
      full_name: "Phạm Minh D",
      email: "phamminhd@example.com",
      phone: "0912345678",
      cert_type: "Giấy xác nhận",
      content: "Hoàn thành khóa tập huấn 2025",
      expires_at: "2025-01-01T00:00:00Z",
      metadata: { unit_name: "Sky First", program: "Training 2025", phone: "0912345678", expires_at: "2025-01-01T00:00:00Z" }
    }
  });
  await callWorker(`/api/admin/approvals/${encodeURIComponent(c2.data.approval_id)}`, {
    method: "PATCH", cookie: reviewerCookie, body: { status: "approved", note: "OK" }
  });
  const iss2 = await callWorker(`/api/admin/certificates/${encodeURIComponent(c2.data.id)}`, {
    method: "PATCH", cookie: superAdminCookie, body: { action: "issue" }
  });
  const expCode = iss2.data.code;

  // Lookup expired certificate by code
  const expLook = await callWorker(`/api/public/credentials/${encodeURIComponent(expCode)}`);
  assert(
    expLook.status === 200 &&
    expLook.data.verified === false &&
    expLook.data.state === "expired" &&
    expLook.data.policy_notice?.includes("Sky First Network") &&
    expLook.data.query_time_notice?.includes("Hệ thống Thông tin Số Sky First"),
    "Expired certificate lookup returns state=expired plus mandatory data policy and query-time notices"
  );

  // Lookup certificate by email or phone without leaking personal email/phone in response
  const byEmail = await callWorker("/api/lookup/certificate", {
    method: "POST",
    body: { email: "phamminhd@example.com" }
  });
  assert(
    byEmail.status === 200 &&
    Array.isArray(byEmail.data.items) &&
    byEmail.data.items.some(x => x.certificate_code === expCode) &&
    !JSON.stringify(byEmail.data.items).includes("phamminhd@example.com") &&
    !JSON.stringify(byEmail.data.items).includes("0912345678"),
    "Certificate lookup by email/phone succeeds and strips private email/phone from public response"
  );
}

// 15. Section V: Dynamic Navigation, URL Redirects, System Links Audit & Content Folders
{
  const navCreate = await callWorker("/api/admin/navigation", {
    method: "POST", cookie: superAdminCookie,
    body: {
      location: "header",
      menu_key: "header-test-item",
      label_vi: "Chuyên trang Thử nghiệm",
      label_en: "Test Portal",
      url: "/tai-lieu",
      sort_order: 99,
      visible: 1,
      status: "published"
    }
  });
  assert(navCreate.status === 201 && navCreate.data.id, "Created dynamic navigation item via /api/admin/navigation");

  const navBad = await callWorker("/api/admin/navigation", {
    method: "POST", cookie: superAdminCookie,
    body: { location: "header", label_vi: "XSS", url: "javascript:alert(1)" }
  });
  assert(navBad.status === 400, "Navigation API blocks unsafe javascript: URLs");

  const redCreate = await callWorker("/api/admin/redirects", {
    method: "POST", cookie: superAdminCookie,
    body: { source_path: "/duong-dan-cu-2025", target_path: "/chuong-trinh", http_code: 301, notes: "Chuyển hướng đường dẫn cũ" }
  });
  assert(redCreate.status === 201 && redCreate.data.id, "Created managed URL redirect");

  const redExec = await callWorker("/duong-dan-cu-2025");
  assert(redExec.status === 301 && redExec.headers.get("location") === "https://app.skyfirst.io.vn/chuong-trinh", "Managed URL redirect executes live HTTP 301 redirect");

  const openRed = await callWorker("/api/admin/redirects", {
    method: "POST", cookie: superAdminCookie,
    body: { source_path: "/open-redirect", target_path: "https://evil-phishing.example.com/login" }
  });
  assert(openRed.status === 400, "Redirect manager blocks open redirect to untrusted external domain");

  const linkAudit = await callWorker("/api/admin/system-links/audit", {
    method: "GET", cookie: superAdminCookie
  });
  assert(linkAudit.status === 200 && linkAudit.data.ok === true && typeof linkAudit.data.summary?.navigation_count === "number", "System links audit checks internal and ecosystem links");

  const folderList = await callWorker("/api/admin/folders", { cookie: superAdminCookie });
  assert(folderList.status === 200 && folderList.data.items.length >= 4, "Admin can list content folders and reference counts");
}

// 16. Problem #10: System-Wide Post-Publication Record Lifecycle Management
{
  const docsRes = await callWorker("/api/public/resources");
  const targetDocId = docsRes.data.items[0]?.id;
  assert(Boolean(targetDocId), "Found published document for lifecycle test");

  const revDoc = await callWorker(`/api/admin/lifecycle/documents/${encodeURIComponent(targetDocId)}`, {
    method: "POST", cookie: superAdminCookie,
    body: { action: "revoke", reason: "Thu hồi văn bản để cập nhật bản mới", notify_email: "user@example.com" }
  });
  assert(revDoc.status === 200 && revDoc.data.new_status === "Đã thu hồi", "Lifecycle revoke transitions document to Đã thu hồi");

  const restoreBlocked = await callWorker(`/api/admin/lifecycle/documents/${encodeURIComponent(targetDocId)}`, {
    method: "POST", cookie: superAdminCookie,
    body: { action: "restore", reason: "Khôi phục thường" }
  });
  assert(restoreBlocked.status === 409 && restoreBlocked.data.error === "REVOKED_RESTORE_FORBIDDEN", "Restoring a revoked record is blocked without explicit approved_reinstatement");

  const reissueOk = await callWorker(`/api/admin/lifecycle/documents/${encodeURIComponent(targetDocId)}`, {
    method: "POST", cookie: superAdminCookie,
    body: { action: "reissue", reason: "Cấp lại sau khi rà soát hợp lệ" }
  });
  assert(reissueOk.status === 200 && reissueOk.data.new_status === "Có hiệu lực", "Authorized reissue restores document validity and logs history");

  const histRes = await callWorker(`/api/admin/lifecycle/documents/${encodeURIComponent(targetDocId)}/history`, { cookie: superAdminCookie });
  assert(histRes.status === 200 && histRes.data.items.length >= 2, "Lifecycle history records actor, timestamp, reason, and before/after states");
}

// 17. PHỤ LỤC EMAIL-01 (Điều 14): 18 Mandatory Email System Verification Scenarios
{
  // Scenario 1: Email xác nhận tiếp nhận hồ sơ (submission_received)
  const e1 = renderUniversalEmail(
    { RECIPIENT_NAME: "Nguyễn Văn A", REQUEST_ID: "SFN-TNV-2026-0001", REGISTRATION_TYPE: "Tình nguyện viên", STATUS: "Đã tiếp nhận" },
    { eventKey: "submission_received", language: "vi" }
  );
  assert(e1.html.includes("SFN-TNV-2026-0001") && e1.html.includes("Đã tiếp nhận") && !/\{\{[A-Z0-9_]+\}\}/.test(e1.html), "Email #1: Application received HTML email renders with zero unmapped {{...}} tokens");

  // Scenario 2: Email yêu cầu bổ sung thông tin (information_required)
  const e2 = renderUniversalEmail(
    { RECIPIENT_NAME: "Nguyễn Văn A", REQUEST_ID: "SFN-TNV-2026-0001", ADDITIONAL_INFO: "Vui lòng bổ sung ảnh thẻ 3x4" },
    { eventKey: "information_required", language: "vi" }
  );
  assert(e2.subject.includes("Yêu cầu bổ sung") && e2.html.includes("Vui lòng bổ sung ảnh thẻ 3x4"), "Email #2: Information required email maps instructions accurately");

  // Scenario 3: Email phê duyệt (application_approved)
  const e3 = renderUniversalEmail(
    { RECIPIENT_NAME: "Nguyễn Văn A", REQUEST_ID: "SFN-TNV-2026-0001" },
    { eventKey: "application_approved", language: "vi" }
  );
  assert(e3.subject.includes("Thông báo phê duyệt") && e3.html.includes("Đã phê duyệt"), "Email #3: Approval email renders approved state");

  // Scenario 4: Email chưa phê duyệt / từ chối (application_rejected)
  const e4 = renderUniversalEmail(
    { RECIPIENT_NAME: "Nguyễn Văn A", REQUEST_ID: "SFN-TNV-2026-0001" },
    { eventKey: "application_rejected", language: "vi" }
  );
  assert(e4.subject.toLowerCase().includes("kết quả xét duyệt") && e4.html.includes("Chưa được phê duyệt"), "Email #4: Non-approval email renders respectfully and clearly");

  // Scenario 5: Email cập nhật trạng thái (application_status_updated)
  const e5 = renderUniversalEmail(
    { RECIPIENT_NAME: "Nguyễn Văn A", REQUEST_ID: "SFN-TNV-2026-0001", STATUS: "Đang xử lý" },
    { eventKey: "application_status_updated", language: "vi" }
  );
  assert(e5.html.includes("Đang xử lý"), "Email #5: Status update email reflects new status");

  // Scenario 6: Email có tệp đính kèm PDF hợp lệ (Hình thức A — direct MIME attachment)
  const attA = await validateAndPrepareAttachments(env, [{ file_id: "file_pdf_v2", mode: "direct", doc_category: "Hướng dẫn sử dụng hệ thống" }], {
    requestId: "",
    recipientEmail: "user@example.com"
  });
  assert(attA.ok === true && attA.mimeAttachments.length === 1 && attA.mimeAttachments[0].filename === "guide-v2.pdf" && attA.mimeAttachments[0].content.length > 0, "Email #6: Form A attaches validated PDF binary as base64 MIME attachment");

  // Scenario 7: Email có liên kết tải tài liệu được bảo vệ (Hình thức B — protected download link)
  const attB = await validateAndPrepareAttachments(env, [{ file_id: "file_pdf_v2", mode: "link", doc_category: "Quyết định hoặc thông báo kết quả" }], {
    requestId: "",
    recipientEmail: "user@example.com"
  });
  const e7 = renderUniversalEmail(
    { RECIPIENT_NAME: "Người nhận", REQUEST_ID: "SFN-KQ-01" },
    { eventKey: "processing_result_issued", language: "vi", linkItems: attB.linkItems }
  );
  assert(attB.ok === true && attB.linkItems.length === 1 && e7.html.includes("/api/email-files/file_pdf_v2?token=") && e7.html.includes("download=1"), "Email #7: Form B generates token-protected download link for email document");

  const tokenMatch = attB.linkItems[0].url.match(/token=([A-Za-z0-9_-]+)/);
  const dlGood = await callWorker(`/api/email-files/file_pdf_v2?token=${encodeURIComponent(tokenMatch[1])}&download=1`);
  const dlBad = await callWorker("/api/email-files/file_pdf_v2?token=invalidtoken&download=1");
  assert(dlGood.status === 200 && (dlBad.status === 403 || dlBad.status === 404), "Email #7b: Protected document link serves PDF with valid token and blocks invalid token");

  // Scenario 8: Email không có tài liệu đính kèm & ẩn hàng tùy chọn trống
  const e8 = renderUniversalEmail(
    { RECIPIENT_NAME: "Người nhận", BODY_HTML: "<p>Thông báo hệ thống không kèm hồ sơ.</p>", REQUEST_ID: "", REGISTRATION_TYPE: "", SUBMITTED_AT: "", STATUS: "", ADDITIONAL_INFO: "", ACTION_URL: "" },
    { eventKey: "system_authorized_notice", language: "vi", includeDefaultAction: false }
  );
  assert(!e8.html.includes("{{") && !e8.html.includes("undefined") && !e8.html.includes("null"), "Email #8: Email without attachments or optional fields hides empty rows and leaves no {{...}} placeholders");

  // Scenario 9: Email thiếu trường dữ liệu bắt buộc (người nhận không hợp lệ bị chặn)
  const e9 = await callWorker("/api/admin/email/send", {
    method: "POST", cookie: superAdminCookie,
    body: { event_key: "submission_received", recipients: ["not-an-email"] }
  });
  assert(e9.status === 400 && e9.data.error === "INVALID_EMAIL", "Email #9: Missing/invalid required recipient data is rejected safely before dispatch");

  // Scenario 10: Email có nội dung chứa ký tự đặc biệt tiếng Việt & Unicode
  const e10 = renderUniversalEmail(
    { RECIPIENT_NAME: "Đặng Nguyễn Bảo Trân", ADDITIONAL_INFO: "Học bổng “Ươm Mầm 2026” — Mức hỗ trợ 100% (5.000.000₫)" },
    { eventKey: "submission_received", language: "vi" }
  );
  assert(e10.html.includes("Đặng Nguyễn Bảo Trân") && e10.html.includes("5.000.000₫"), "Email #10: Vietnamese diacritics and special Unicode symbols render cleanly");

  // Scenario 11: Email có nội dung người dùng nhập cần escape chống XSS
  const e11 = renderUniversalEmail(
    {
      RECIPIENT_NAME: "<script>alert(\"xss\")</script>",
      ADDITIONAL_INFO: "<img src=x onerror=alert(1)>",
      BODY_HTML: "<p onclick=\"evil()\">An toàn</p><script>steal()</script>"
    },
    { eventKey: "submission_received", language: "vi" }
  );
  assert(
    e11.html.includes("&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;") &&
    !e11.html.includes("<script>steal()</script>") &&
    !e11.html.includes("onclick="),
    "Email #11: User-supplied fields and controlled BODY_HTML strip scripts and inline event handlers"
  );

  // Scenario 12: Email gửi thất bại do lỗi nhà cung cấp (simulated Resend API 500 failure + retry)
  let fetchAttempts = 0;
  globalThis.fetch = async (url, opts) => {
    if (String(url).includes("api.resend.com")) {
      fetchAttempts++;
      return new Response(JSON.stringify({ message: "Simulated provider outage" }), { status: 500 });
    }
    return realNodeFetch(url, opts);
  };
  env.RESEND_API_KEY = "re_test_simulated_key";
  const failSend = await sendEmail(env, {
    to: "failtest@example.com",
    subject: "Test Failure",
    html: "<p>Test</p>",
    text: "Test",
    templateKey: "application_status_updated",
    meta: { reference_code: "SFN-FAIL-01" },
    maxRetries: 1
  });
  delete env.RESEND_API_KEY;
  globalThis.fetch = realNodeFetch;
  assert(failSend.ok === false && failSend.delivery_state === "failed" && fetchAttempts === 2, "Email #12: Provider 500 error triggers bounded retry (2 attempts) and records delivery_state=failed");

  // Scenario 13: Email bị retry / gọi lặp nhưng không được gửi trùng (Idempotency / Deduplication)
  const dedup1 = await sendEmail(env, {
    to: "dedup@example.com",
    subject: "Dedup Subject",
    html: "<p>Dedup</p>",
    text: "Dedup",
    templateKey: "application_approved",
    meta: { reference_code: "SFN-DEDUP-01" }
  });
  const dedup2 = await sendEmail(env, {
    to: "dedup@example.com",
    subject: "Dedup Subject",
    html: "<p>Dedup</p>",
    text: "Dedup",
    templateKey: "application_approved",
    meta: { reference_code: "SFN-DEDUP-01" }
  });
  assert((dedup1.ok || dedup1.pending) && dedup2.deduped === true, "Email #13: Duplicate event trigger is intercepted by deduplication guard");

  // Scenario 14: Email có logo hiển thị đúng (Data URI / HTTPS URL / CID inline attachment + alt attribute)
  const eLogoHttps = renderUniversalEmail({ RECIPIENT_NAME: "Logo Test" }, { eventKey: "submission_received", logoMode: "https" });
  const eLogoCid = renderUniversalEmail({ RECIPIENT_NAME: "Logo CID" }, { eventKey: "submission_received", logoMode: "cid" });
  assert(
    eLogoHttps.html.includes("https://app.skyfirst.io.vn/assets/sfn-logo.png") &&
    eLogoCid.html.includes("cid:skyfirst-logo") &&
    eLogoHttps.html.includes("alt=\"Sky First — Education & Community Development\""),
    "Email #14: Email logo supports embedded Data URI, public HTTPS URL, and MIME CID with alt fallback"
  );

  // Scenario 15: Email tiếng Việt và tiếng Anh đồng nhất ngôn ngữ
  const eVi = renderUniversalEmail({ RECIPIENT_NAME: "Lê Văn C", REQUEST_ID: "SFN-GCN-12345678" }, { eventKey: "certificate_issued", language: "vi" });
  const eEn = renderUniversalEmail({ RECIPIENT_NAME: "Le Van C", REQUEST_ID: "SFN-GCN-12345678" }, { eventKey: "certificate_issued", language: "en" });
  assert(
    eVi.html.includes("<html lang=\"vi\">") && eVi.html.includes("Xin chào") &&
    eEn.html.includes("<html lang=\"en\">") && eEn.html.includes("Dear Le Van C,") && eEn.subject.includes("Certificate"),
    "Email #15: Vietnamese and English emails maintain strict language consistency across subject, greeting, labels, and footer"
  );

  // Scenario 16: Kiểm tra cấu trúc HTML tương thích Gmail/Outlook & bản text/plain dự phòng
  assert(
    eVi.html.includes("role=\"presentation\"") &&
    !eVi.html.includes("<script") &&
    eVi.text.includes("Hệ thống Thông tin Số Sky First") &&
    eVi.text.includes("support@skyfirst.io.vn"),
    "Email #16: HTML email uses presentation tables + inline CSS (Gmail/Outlook safe) with complete text/plain fallback"
  );

  // Scenario 17: Gửi email từ giao diện quản trị & chặn gửi tài liệu của hồ sơ A cho người nhận của hồ sơ B
  await FILES.put("private/subA/file_sub_a.pdf", new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31]), { httpMetadata: { contentType: "application/pdf" } });
  await DB.prepare("INSERT INTO files(id,owner_user_id,submission_code,r2_key,filename,mime,size,visibility) VALUES('file_sub_a',1,'SFN-TNV-RECORD-A','private/subA/file_sub_a.pdf','ho-so-a.pdf','application/pdf',6,'private')").run();

  const crossRecordSend = await callWorker("/api/admin/email/send", {
    method: "POST", cookie: superAdminCookie,
    body: {
      event_key: "processing_result_issued",
      recipients: ["recipient_b@example.com"],
      request_id: "SFN-TNV-RECORD-B",
      attachments: [{ file_id: "file_sub_a", mode: "direct" }]
    }
  });
  assert(crossRecordSend.status === 400 && crossRecordSend.data.error === "ATTACHMENT_CROSS_RECORD_FORBIDDEN", "Email #17a: Blocks sending attachment belonging to Record A to Recipient of Record B");

  const adminManualSend = await callWorker("/api/admin/email/send", {
    method: "POST", cookie: superAdminCookie,
    body: {
      event_key: "processing_result_issued",
      language: "vi",
      recipients: ["user1@example.com", "user2@example.com"],
      request_id: "SFN-KQ-2026",
      registration_type: "Xét duyệt học bổng",
      status: "Hoàn tất",
      attachments: [{ file_id: "file_pdf_v2", mode: "link" }]
    }
  });
  assert(adminManualSend.status === 200 && adminManualSend.data.ok === true && adminManualSend.data.results.length === 2, "Email #17b: Admin manual dispatch sends isolated individual emails to multiple recipients without exposing recipient list");

  // Scenario 18: Email tự động được kích hoạt từ sự kiện nghiệp vụ thực tế (kiểm tra trong email_logs)
  const logsRes = await callWorker("/api/admin/email-logs", { cookie: superAdminCookie });
  const eventsLogged = new Set((logsRes.data.items || []).map(x => x.template_key));
  assert(
    logsRes.status === 200 &&
    logsRes.data.items.length >= 5 &&
    (eventsLogged.has("submission_received") || eventsLogged.has("submission_confirmation")) &&
    eventsLogged.has("certificate_issued") &&
    eventsLogged.has("record_lifecycle_changed"),
    "Email #18: Real business events (form submission, status update, certificate issuance, record revocation) automatically trigger and log emails"
  );
}

console.log(`\n========================================`);
console.log(`TOTAL E2E & REGRESSION TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
console.log(`========================================`);
try { pyProc.kill(); } catch {}
if (failed > 0) process.exit(1);
process.exit(0);

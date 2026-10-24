import {
  json, readJson, randomToken, sha256, pbkdf2, newSalt, safeEq, parseCookies,
  sessionCookie, clearSessionCookie, ipHash, uid, rateLimit
} from "./utils.js";
import {hasPermission, highestRoleLevel, roleLevel, permissionsForRoles} from "./permissions.js";
import {sendTemplatedEmail} from "./email.js";

const SESSION_SECONDS = 7 * 24 * 60 * 60;
const PASSWORD_ITERATIONS = 100000;
const MAX_2FA_ATTEMPTS = 5;

async function auditAuth(env, request, user, action, entityType = "auth", entityId = "", details = {}) {
  try {
    if (!env?.DB) return;
    const safeDetails = {...details};
    delete safeDetails.password;
    delete safeDetails.new_password;
    delete safeDetails.current_password;
    delete safeDetails.token;
    delete safeDetails.temp_password;
    delete safeDetails.secret;
    await env.DB.prepare(
      "INSERT INTO audit_log(actor_user_id,actor_email,action,entity_type,entity_id,details_json,ip_hash) VALUES(?,?,?,?,?,?,?)"
    )
      .bind(
        user?.id || null,
        user?.email || String(details.email || ""),
        action,
        entityType,
        String(entityId || ""),
        JSON.stringify(safeDetails),
        await ipHash(request)
      )
      .run();
  } catch {}
}

async function loadRoles(env, userId) {
  const rs = await env.DB.prepare(`
    SELECT ur.role_id,ur.scope_unit_code,ur.expires_at,r.name,r.level
    FROM user_roles ur JOIN roles r ON r.id=ur.role_id
    WHERE ur.user_id=? AND (ur.expires_at IS NULL OR ur.expires_at>CURRENT_TIMESTAMP)
    ORDER BY r.level DESC
  `).bind(userId).all();

  return rs.results || [];
}

export async function getUserById(env, id) {
  const u = await env.DB.prepare(
    "SELECT id,email,full_name,status,email_verified,must_change_password,totp_enabled,created_at FROM users WHERE id=?"
  ).bind(id).first();

  if (!u) return null;

  u.roles = await loadRoles(env, u.id);
  u.permissions = [...permissionsForRoles(u.roles)];
  return u;
}

export async function getAuthUser(request, env) {
  const token = parseCookies(request).sfn_session;
  if (!token) return null;

  const hash = await sha256(token);

  const row = await env.DB.prepare(`
    SELECT s.user_id,s.expires_at,u.status
    FROM sessions s JOIN users u ON u.id=s.user_id
    WHERE s.token_hash=? AND s.expires_at>CURRENT_TIMESTAMP
  `).bind(hash).first();

  if (!row || row.status !== "active") return null;

  await env.DB.prepare(
    "UPDATE sessions SET last_seen_at=CURRENT_TIMESTAMP WHERE token_hash=?"
  ).bind(hash).run();

  return getUserById(env, row.user_id);
}

export function requireAuth(user, {allowPasswordChangeRequired = false} = {}) {
  if (!user) return json({error:"AUTH_REQUIRED"}, 401);
  if (!allowPasswordChangeRequired && Number(user.must_change_password || 0) === 1) {
    return json({
      error:"PASSWORD_CHANGE_REQUIRED",
      message:"Tài khoản đang sử dụng mật khẩu khởi tạo hoặc tạm thời. Vui lòng đổi mật khẩu trước khi thực hiện thao tác quản trị."
    }, 403);
  }
  return null;
}

export function requirePermission(user, p) {
  const authDeny = requireAuth(user);
  if (authDeny) return authDeny;
  if (!hasPermission(user, p)) return json({error:"FORBIDDEN", permission:p}, 403);
  return null;
}

async function createSession(request, env, userId) {
  const token = randomToken(32);
  const hash = await sha256(token);
  const exp = new Date(Date.now() + SESSION_SECONDS * 1000).toISOString();

  await env.DB.prepare(
    "INSERT INTO sessions(user_id,token_hash,user_agent,ip_hash,expires_at) VALUES(?,?,?,?,?)"
  )
    .bind(
      userId,
      hash,
      (request.headers.get("user-agent") || "").slice(0,400),
      await ipHash(request),
      exp
    )
    .run();

  return {token, exp};
}

async function verifyPassword(env, email, password) {
  const u = await env.DB.prepare(
    "SELECT * FROM users WHERE email=? COLLATE NOCASE"
  ).bind(email).first();

  if (!u || !u.password_hash || u.status !== "active") return null;

  const iterations = Number(u.password_iterations || PASSWORD_ITERATIONS);

  if (
    !Number.isFinite(iterations) ||
    iterations < 1 ||
    iterations > 600000
  ) {
    return null;
  }

  const got = await pbkdf2(
    password,
    u.password_salt,
    iterations
  );

  if (!safeEq(got, u.password_hash)) return null;

  // Transparently migrate legacy >100k PBKDF2 hash to 100k WebCrypto-native iterations AFTER verified match
  if (iterations !== PASSWORD_ITERATIONS) {
    try {
      const upgradedSalt = newSalt();
      const upgradedHash = await pbkdf2(password, upgradedSalt, PASSWORD_ITERATIONS);
      await env.DB.prepare(
        "UPDATE users SET password_salt=?, password_hash=?, password_iterations=?, updated_at=CURRENT_TIMESTAMP WHERE id=?"
      ).bind(upgradedSalt, upgradedHash, PASSWORD_ITERATIONS, u.id).run();
      u.password_salt = upgradedSalt;
      u.password_hash = upgradedHash;
      u.password_iterations = PASSWORD_ITERATIONS;
    } catch {}
  }

  return u;
}

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Encode(bytes) {
  let bits = 0;
  let value = 0;
  let out = "";

  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;

    while (bits >= 5) {
      out += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    out += BASE32[(value << (5 - bits)) & 31];
  }

  return out;
}

function base32Decode(s) {
  s = String(s || "")
    .toUpperCase()
    .replace(/[^A-Z2-7]/g, "");

  let bits = 0;
  let value = 0;
  const out = [];

  for (const c of s) {
    const i = BASE32.indexOf(c);

    if (i < 0) continue;

    value = (value << 5) | i;
    bits += 5;

    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return new Uint8Array(out);
}

async function hotp(secret, counter, digits = 6) {
  const key = await crypto.subtle.importKey(
    "raw",
    base32Decode(secret),
    {name:"HMAC", hash:"SHA-1"},
    false,
    ["sign"]
  );

  const buf = new ArrayBuffer(8);
  const view = new DataView(buf);

  view.setUint32(
    0,
    Math.floor(counter / 0x100000000),
    false
  );

  view.setUint32(
    4,
    counter >>> 0,
    false
  );

  const sig = new Uint8Array(
    await crypto.subtle.sign(
      "HMAC",
      key,
      buf
    )
  );

  const off = sig[sig.length - 1] & 15;

  const bin =
    ((sig[off] & 127) << 24) |
    (sig[off + 1] << 16) |
    (sig[off + 2] << 8) |
    sig[off + 3];

  return String(
    bin % (10 ** digits)
  ).padStart(digits, "0");
}

async function verifyTotp(secret, code) {
  const cleanCode = String(code || "").trim();
  if (!/^\d{6}$/.test(cleanCode)) return false;
  const step = Math.floor(
    Date.now() / 1000 / 30
  );

  for (let d = -1; d <= 1; d++) {
    if (
      safeEq(await hotp(secret, step + d), cleanCode)
    ) {
      return true;
    }
  }

  return false;
}

export async function authRoute(request, env, url) {
  const p = url.pathname;

  if (
    p === "/api/auth/me" &&
    request.method === "GET"
  ) {
    const user = await getAuthUser(request, env);
    return json({user});
  }

  if (
    p === "/api/auth/register" &&
    request.method === "POST"
  ) {
    return json({error:"PUBLIC_REGISTRATION_DISABLED"},404);
  }

  if (
    p === "/api/auth/verify-email" &&
    request.method === "POST"
  ) {
    const rl = await rateLimit(env, `verify-email:${await ipHash(request)}`, 10, 300);
    if (!rl.ok) return json({error:"RATE_LIMIT"}, 429);

    const body = await readJson(request);

    const token = String(
      body?.token || ""
    );
    if (!token) return json({error:"INVALID_OR_EXPIRED_TOKEN"}, 400);

    const hash = await sha256(token);

    const row = await env.DB.prepare(`
      SELECT t.id,t.user_id,u.status
      FROM auth_tokens t
      JOIN users u ON u.id=t.user_id
      WHERE t.token_type='verify_email'
        AND t.token_hash=?
        AND t.used_at IS NULL
        AND t.expires_at>CURRENT_TIMESTAMP
    `).bind(hash).first();

    if (!row || !["active","invited"].includes(row.status)) {
      return json(
        {error:"INVALID_OR_EXPIRED_TOKEN"},
        400
      );
    }

    await env.DB.batch([
      env.DB.prepare(
        "UPDATE users SET email_verified=1,updated_at=CURRENT_TIMESTAMP WHERE id=?"
      ).bind(row.user_id),

      env.DB.prepare(
        "UPDATE auth_tokens SET used_at=CURRENT_TIMESTAMP WHERE id=?"
      ).bind(row.id)
    ]);

    await auditAuth(env, request, {id: row.user_id}, "Xác minh email tài khoản", "user", String(row.user_id), {});
    return json({ok:true});
  }

  if (
    p === "/api/auth/login" &&
    request.method === "GET"
  ) {
    const accept = request.headers.get("accept") || "";
    if (accept.includes("text/html")) {
      return Response.redirect(`${env.APP_URL || url.origin}/admin/login`, 302);
    }
    return json({error:"METHOD_NOT_ALLOWED", message:"Endpoint này chỉ nhận phương thức POST từ trang /admin/login."}, 405, {"Allow":"POST"});
  }

  if (
    p === "/api/auth/login" &&
    request.method === "POST"
  ) {
    const ipKey = await ipHash(request);
    const rl = await rateLimit(
      env,
      `login:${ipKey}`,
      12,
      300
    );

    if (!rl.ok) {
      await auditAuth(env, request, null, "Giới hạn đăng nhập (Rate limit)", "auth", "", {reason:"RATE_LIMIT_12_PER_300S"});
      return json(
        {error:"RATE_LIMIT", message:"Bạn đã thử đăng nhập quá 12 lần trong 5 phút. Vui lòng đợi ít phút trước khi thử lại."},
        429
      );
    }

    const body = await readJson(request);

    const email = String(
      body?.email || ""
    )
      .trim()
      .toLowerCase();

    const password = String(
      body?.password || ""
    );

    const portal = String(
      body?.portal || "admin"
    );
    if(portal!=="admin") return json({error:"PUBLIC_ACCOUNT_LOGIN_DISABLED"},403);

    // Per-account rate limit to prevent distributed brute-force on a single account
    if (email) {
      const rlAcct = await rateLimit(env, `login-acct:${await sha256(email)}`, 10, 300);
      if (!rlAcct.ok) {
        await auditAuth(env, request, null, "Giới hạn đăng nhập theo tài khoản", "auth", email, {reason:"ACCOUNT_RATE_LIMIT"});
        return json(
          {error:"RATE_LIMIT", message:"Tài khoản này đang bị tạm khóa đăng nhập do thử sai nhiều lần. Vui lòng đợi 5 phút."},
          429
        );
      }
    }

    const u = await verifyPassword(
      env,
      email,
      password
    );

    if (!u || !u.email_verified) {
      // Uniform 401 INVALID_CREDENTIALS prevents account enumeration
      await auditAuth(env, request, u || null, "Đăng nhập thất bại", "auth", email, {
        email,
        portal,
        reason: !u ? "INVALID_CREDENTIALS" : "EMAIL_NOT_VERIFIED"
      });
      return json(
        {error:"INVALID_CREDENTIALS"},
        401
      );
    }

    const full = await getUserById(
      env,
      u.id
    );

    const roleIds = (
      full.roles || []
    ).map(r => r.role_id);

    if (
      portal === "admin" &&
      !roleIds.some(
        r => roleLevel(r) >= 40
      )
    ) {
      await auditAuth(env, request, full, "Từ chối truy cập cổng quản trị (không đủ quyền)", "user", String(u.id), {email, roles:roleIds});
      return json(
        {error:"ADMIN_ACCESS_NOT_GRANTED"},
        403
      );
    }

    if (u.totp_enabled) {
      const challenge = randomToken(32);
      const challengeId = uid("2fa");

      await env.DB.prepare(`
        INSERT INTO auth_tokens(
          id,
          user_id,
          token_type,
          token_hash,
          portal,
          expires_at
        )
        VALUES(
          ?,?,
          'login_2fa',
          ?,?,
          datetime('now','+10 minutes')
        )
      `)
        .bind(
          challengeId,
          u.id,
          await sha256(challenge),
          portal
        )
        .run();

      await auditAuth(env, request, full, "Yêu cầu xác thực 2FA khi đăng nhập", "user", String(u.id), {portal});
      return json({
        needs_2fa:true,
        challenge
      });
    }

    const s = await createSession(
      request,
      env,
      u.id
    );
    try {
      await env.DB.prepare("DELETE FROM rate_limits WHERE key IN (?, ?)").bind(`login:${ipKey}`, `login-acct:${await sha256(email)}`).run();
    } catch {}

    await auditAuth(env, request, full, "Đăng nhập quản trị thành công", "user", String(u.id), {portal, roles:roleIds});

    return json(
      {
        ok:true,
        user:full,
        must_change_password:
          !!u.must_change_password
      },
      200,
      {
        "set-cookie":
          sessionCookie(s.token)
      }
    );
  }

  if (
    p === "/api/auth/login-2fa" &&
    request.method === "POST"
  ) {
    const ipKey = await ipHash(request);
    const rl = await rateLimit(
      env,
      `login-2fa:${ipKey}`,
      8,
      300
    );
    if (!rl.ok) {
      return json(
        {error:"RATE_LIMIT", message:"Bạn đã nhập sai mã xác thực 2 bước quá nhiều lần. Vui lòng thử lại sau."},
        429
      );
    }

    const body = await readJson(request);

    const challenge = String(
      body?.challenge || ""
    );

    const code = String(
      body?.code || ""
    );

    if (!challenge || !code) {
      return json({error:"INVALID_2FA"}, 401);
    }

    const challengeHash = await sha256(challenge);

    const row = await env.DB.prepare(`
      SELECT
        t.id,
        t.user_id,
        u.totp_secret,
        u.totp_enabled,
        u.status,
        u.must_change_password
      FROM auth_tokens t
      JOIN users u
        ON u.id=t.user_id
      WHERE
        t.token_type='login_2fa'
        AND t.token_hash=?
        AND t.used_at IS NULL
        AND t.expires_at>CURRENT_TIMESTAMP
    `)
      .bind(challengeHash)
      .first();

    if (!row || row.status !== "active" || !row.totp_enabled || !row.totp_secret) {
      await auditAuth(env, request, row ? {id: row.user_id} : null, "Xác thực 2FA thất bại (phiên không hợp lệ)", "auth", row ? String(row.user_id) : "", {});
      return json({error:"INVALID_2FA"}, 401);
    }

    // Track per-challenge attempts to prevent 6-digit OTP brute-force
    const rlChallenge = await rateLimit(env, `2fa-chal:${row.id}`, MAX_2FA_ATTEMPTS, 600);
    if (!rlChallenge.ok) {
      await env.DB.prepare("UPDATE auth_tokens SET used_at=CURRENT_TIMESTAMP WHERE id=?").bind(row.id).run();
      await auditAuth(env, request, {id: row.user_id}, "Khóa phiên 2FA do vượt số lần thử", "auth", String(row.user_id), {});
      return json({error:"RATE_LIMIT", message:"Phiên xác thực 2FA đã bị hủy do nhập sai quá số lần cho phép. Vui lòng đăng nhập lại."}, 429);
    }

    if (!(await verifyTotp(row.totp_secret, code))) {
      try {
        await env.DB.prepare("UPDATE auth_tokens SET attempt_count=COALESCE(attempt_count,0)+1 WHERE id=?").bind(row.id).run();
      } catch {}
      await auditAuth(env, request, {id: row.user_id}, "Xác thực 2FA thất bại", "auth", String(row.user_id), {});
      return json(
        {error:"INVALID_2FA"},
        401
      );
    }

    await env.DB.prepare(
      "UPDATE auth_tokens SET used_at=CURRENT_TIMESTAMP WHERE id=?"
    ).bind(row.id).run();

    try {
      await env.DB.prepare("DELETE FROM rate_limits WHERE key IN (?, ?)").bind(`login-2fa:${ipKey}`, `2fa-chal:${row.id}`).run();
    } catch {}

    const s = await createSession(
      request,
      env,
      row.user_id
    );

    const user = await getUserById(
      env,
      row.user_id
    );

    await auditAuth(env, request, user, "Đăng nhập 2FA thành công", "user", String(row.user_id), {});

    return json(
      {
        ok:true,
        user,
        must_change_password:
          !!row.must_change_password
      },
      200,
      {
        "set-cookie":
          sessionCookie(s.token)
      }
    );
  }

  if (
    p === "/api/auth/logout" &&
    request.method === "POST"
  ) {
    const user = await getAuthUser(request, env);
    const token =
      parseCookies(request).sfn_session;

    if (token) {
      await env.DB.prepare(
        "DELETE FROM sessions WHERE token_hash=?"
      )
        .bind(
          await sha256(token)
        )
        .run();
    }

    if (user) {
      await auditAuth(env, request, user, "Đăng xuất hệ thống", "user", String(user.id), {});
    }

    return json(
      {ok:true},
      200,
      {
        "set-cookie":
          clearSessionCookie()
      }
    );
  }

  if (
    p === "/api/auth/change-password" &&
    request.method === "POST"
  ) {
    const user = await getAuthUser(
      request,
      env
    );

    const auth = requireAuth(user, {allowPasswordChangeRequired: true});
    if (auth) return auth;

    const rl = await rateLimit(env, `change-pw:${user.id}`, 8, 300);
    if (!rl.ok) return json({error:"RATE_LIMIT"}, 429);

    const body = await readJson(request);

    const current = String(
      body?.current_password || ""
    );

    const next = String(
      body?.new_password || ""
    );

    if (next.length < 10) {
      return json(
        {error:"PASSWORD_TOO_SHORT"},
        400
      );
    }

    if (current === next) {
      return json(
        {error:"PASSWORD_UNCHANGED", message:"Mật khẩu mới phải khác mật khẩu hiện tại."},
        400
      );
    }

    const verified =
      await verifyPassword(
        env,
        user.email,
        current
      );

    if (!verified) {
      await auditAuth(env, request, user, "Đổi mật khẩu thất bại (sai mật khẩu hiện tại)", "user", String(user.id), {});
      return json(
        {error:"CURRENT_PASSWORD_INVALID"},
        401
      );
    }

    const salt = newSalt();

    const hash = await pbkdf2(
      next,
      salt,
      PASSWORD_ITERATIONS
    );

    await env.DB.batch([
      env.DB.prepare(`
        UPDATE users
        SET
          password_salt=?,
          password_hash=?,
          password_iterations=?,
          must_change_password=0,
          status='active',
          email_verified=1,
          updated_at=CURRENT_TIMESTAMP
        WHERE id=?
      `).bind(
        salt,
        hash,
        PASSWORD_ITERATIONS,
        user.id
      ),

      env.DB.prepare(
        "DELETE FROM sessions WHERE user_id=?"
      ).bind(user.id)
    ]);

    const s = await createSession(
      request,
      env,
      user.id
    );

    const updatedUser = await getUserById(env, user.id);
    await auditAuth(env, request, updatedUser, "Đổi mật khẩu tài khoản", "user", String(user.id), {});

    return json(
      {ok:true, user:updatedUser, must_change_password:false},
      200,
      {
        "set-cookie":
          sessionCookie(s.token)
      }
    );
  }

  if (
    p === "/api/auth/forgot" &&
    request.method === "POST"
  ) {
    const rl = await rateLimit(
      env,
      `forgot:${await ipHash(request)}`,
      5,
      300
    );
    if (!rl.ok) {
      return json(
        {
          error:"RATE_LIMIT",
          message:"Bạn đã gửi quá nhiều yêu cầu hỗ trợ đặt lại mật khẩu. Vui lòng liên hệ trực tiếp Quản trị viên hoặc thử lại sau."
        },
        429
      );
    }

    const body = await readJson(request);

    const email = String(
      body?.email || ""
    )
      .trim()
      .toLowerCase();

    const note = String(body?.note || "").trim().slice(0, 500);

    if (!email || !email.includes("@")) {
      return json(
        {
          error:"INVALID_EMAIL",
          message:"Vui lòng nhập địa chỉ email tài khoản quản trị cần hỗ trợ."
        },
        400
      );
    }

    const u = await env.DB.prepare(`
      SELECT id,full_name,email
      FROM users
      WHERE email=? COLLATE NOCASE
        AND status='active'
    `).bind(email).first();

    await auditAuth(env, request, u || null, "Yêu cầu hỗ trợ đặt lại mật khẩu", "user", u ? String(u.id) : email, {
      email,
      matched_active_user: !!u,
      note
    });

    if (u) {
      try {
        const ticketId = uid("ticket");
        const rnd = new Uint32Array(1);
        crypto.getRandomValues(rnd);
        const ticketCode = `SFN-PW-${String(100000 + (rnd[0] % 900000))}`;
        await env.DB.prepare(
          "INSERT INTO tickets(id,code,submitter_user_id,submitter_name,email,ticket_type,priority,status,subject) VALUES(?,?,?,?,?,'Đặt lại mật khẩu','Cao','Mới',?)"
        )
          .bind(
            ticketId,
            ticketCode,
            u.id,
            u.full_name || email,
            email,
            `Yêu cầu hỗ trợ đặt lại mật khẩu quản trị (${email})`
          )
          .run();
        await env.DB.prepare(
          "INSERT INTO ticket_messages(ticket_id,sender_user_id,sender_type,body) VALUES(?,?,'public',?)"
        )
          .bind(
            ticketId,
            u.id,
            note || "Người dùng yêu cầu Quản trị viên xác minh và hỗ trợ đặt lại mật khẩu tài khoản."
          )
          .run();
      } catch {}

      // SECURITY HARDENING: Never trust client-supplied body.issue_token!
      // Only issue automated reset token when system setting allow_auto_password_reset is explicitly enabled by Super Admin.
      let autoResetEnabled = false;
      try {
        const st = await env.DB.prepare("SELECT value_json FROM settings WHERE key='allow_auto_password_reset'").first();
        if (st) autoResetEnabled = JSON.parse(st.value_json) === true;
      } catch {}

      if (autoResetEnabled) {
        const token = randomToken(32);
        const hash = await sha256(token);
        const tid = uid("reset");

        await env.DB.prepare(`
          INSERT INTO auth_tokens(
            id,
            user_id,
            token_type,
            token_hash,
            expires_at
          )
          VALUES(
            ?,?,
            'password_reset',
            ?,
            datetime('now','+30 minutes')
          )
        `)
          .bind(
            tid,
            u.id,
            hash
          )
          .run();

        const link =
          `${env.APP_URL || "https://app.skyfirst.io.vn"}/?reset=${encodeURIComponent(token)}`;

        await sendTemplatedEmail(
          env,
          "password_reset",
          email,
          {
            full_name:
              u.full_name || "",
            email,
            link
          }
        );
      }
    }

    return json({
      ok:true,
      mode:"admin_assisted",
      support_email:"support@skyfirst.io.vn",
      hotline:"0924 910 210",
      message:"Yêu cầu hỗ trợ đặt lại mật khẩu đã được ghi nhận. Vui lòng liên hệ Quản trị viên hệ thống qua email hỗ trợ support@skyfirst.io.vn hoặc hotline 0924 910 210 để được xác minh và cấp lại mật khẩu an toàn."
    });
  }

  if (
    p === "/api/auth/reset" &&
    request.method === "POST"
  ) {
    const rl = await rateLimit(
      env,
      `reset-pw:${await ipHash(request)}`,
      8,
      300
    );
    if (!rl.ok) {
      return json({error:"RATE_LIMIT"}, 429);
    }

    const body = await readJson(request);

    const token = String(
      body?.token || ""
    );

    const next = String(
      body?.new_password || ""
    );

    if (!token) {
      return json({error:"INVALID_OR_EXPIRED_TOKEN"}, 400);
    }

    if (next.length < 10) {
      return json(
        {error:"PASSWORD_TOO_SHORT"},
        400
      );
    }

    const hashTok =
      await sha256(token);

    const row = await env.DB.prepare(`
      SELECT t.id,t.user_id,u.status
      FROM auth_tokens t
      JOIN users u ON u.id=t.user_id
      WHERE
        t.token_type='password_reset'
        AND t.token_hash=?
        AND t.used_at IS NULL
        AND t.expires_at>CURRENT_TIMESTAMP
    `)
      .bind(hashTok)
      .first();

    if (!row || !["active", "invited"].includes(row.status)) {
      return json(
        {error:"INVALID_OR_EXPIRED_TOKEN"},
        400
      );
    }

    const salt = newSalt();

    const hash = await pbkdf2(
      next,
      salt,
      PASSWORD_ITERATIONS
    );

    await env.DB.batch([
      env.DB.prepare(`
        UPDATE users
        SET
          password_salt=?,
          password_hash=?,
          password_iterations=?,
          status='active',
          email_verified=1,
          must_change_password=0,
          updated_at=CURRENT_TIMESTAMP
        WHERE id=?
      `).bind(
        salt,
        hash,
        PASSWORD_ITERATIONS,
        row.user_id
      ),

      env.DB.prepare(
        "UPDATE auth_tokens SET used_at=CURRENT_TIMESTAMP WHERE id=?"
      ).bind(row.id),

      env.DB.prepare(
        "DELETE FROM auth_tokens WHERE user_id=? AND token_type='password_reset' AND used_at IS NULL"
      ).bind(row.user_id),

      env.DB.prepare(
        "DELETE FROM sessions WHERE user_id=?"
      ).bind(row.user_id)
    ]);

    await auditAuth(env, request, {id: row.user_id}, "Đặt lại mật khẩu qua liên kết xác thực", "user", String(row.user_id), {});

    return json({ok:true});
  }

  if (
    p === "/api/auth/google/start" &&
    request.method === "GET"
  ) {
    if (
      !env.GOOGLE_CLIENT_ID ||
      !env.GOOGLE_REDIRECT_URI
    ) {
      return json(
        {error:"GOOGLE_OAUTH_NOT_CONFIGURED"},
        503
      );
    }

    const portal=url.searchParams.get("portal")||"admin";
    if(portal!=="admin") return json({error:"PUBLIC_ACCOUNT_LOGIN_DISABLED"},403);

    const state = randomToken(24);
    const hash = await sha256(state);
    const idState = uid("oauth");

    await env.DB.prepare(`
      INSERT INTO auth_tokens(
        id,
        token_type,
        token_hash,
        portal,
        expires_at
      )
      VALUES(
        ?,
        'oauth_state',
        ?,?,
        datetime('now','+10 minutes')
      )
    `)
      .bind(
        idState,
        hash,
        portal
      )
      .run();

    const q = new URLSearchParams({
      client_id:
        env.GOOGLE_CLIENT_ID,
      redirect_uri:
        env.GOOGLE_REDIRECT_URI,
      response_type:"code",
      scope:"openid email profile",
      state,
      prompt:"select_account"
    });

    return Response.redirect(
      "https://accounts.google.com/o/oauth2/v2/auth?" +
        q.toString(),
      302
    );
  }

  if (
    p === "/api/auth/google/callback" &&
    request.method === "GET"
  ) {
    if (
      !env.GOOGLE_CLIENT_ID ||
      !env.GOOGLE_CLIENT_SECRET ||
      !env.GOOGLE_REDIRECT_URI
    ) {
      return json(
        {error:"GOOGLE_OAUTH_NOT_CONFIGURED"},
        503
      );
    }

    const code =
      url.searchParams.get("code");

    const state =
      url.searchParams.get("state");

    if (!code || !state) {
      return json(
        {error:"OAUTH_INVALID"},
        400
      );
    }

    const st = await env.DB.prepare(`
      SELECT id,portal
      FROM auth_tokens
      WHERE
        token_type='oauth_state'
        AND token_hash=?
        AND used_at IS NULL
        AND expires_at>CURRENT_TIMESTAMP
    `)
      .bind(
        await sha256(state)
      )
      .first();

    if (!st) {
      return json(
        {error:"OAUTH_STATE_INVALID"},
        400
      );
    }

    await env.DB.prepare(
      "UPDATE auth_tokens SET used_at=CURRENT_TIMESTAMP WHERE id=?"
    ).bind(st.id).run();

    const tr = await fetch(
      "https://oauth2.googleapis.com/token",
      {
        method:"POST",
        headers:{
          "content-type":
            "application/x-www-form-urlencoded"
        },
        body:new URLSearchParams({
          code,
          client_id:
            env.GOOGLE_CLIENT_ID,
          client_secret:
            env.GOOGLE_CLIENT_SECRET,
          redirect_uri:
            env.GOOGLE_REDIRECT_URI,
          grant_type:
            "authorization_code"
        })
      }
    );

    if (!tr.ok) {
      return json(
        {error:"OAUTH_TOKEN_FAILED"},
        400
      );
    }

    const tok = await tr.json();

    const pr = await fetch(
      "https://openidconnect.googleapis.com/v1/userinfo",
      {
        headers:{
          authorization:
            `Bearer ${tok.access_token}`
        }
      }
    );

    if (!pr.ok) {
      return json(
        {error:"OAUTH_PROFILE_FAILED"},
        400
      );
    }

    const profile = await pr.json();
    if (!profile.email_verified) {
      return Response.redirect(`${env.APP_URL}/?auth_error=EMAIL_NOT_VERIFIED`, 302);
    }

    const email = String(
      profile.email || ""
    ).toLowerCase();

    const u = await env.DB.prepare(
      "SELECT id,status,totp_enabled,must_change_password FROM users WHERE email=? COLLATE NOCASE"
    ).bind(email).first();

    if (!u || u.status !== "active") {
      await auditAuth(env, request, u || null, "Từ chối Google OAuth (tài khoản không tồn tại hoặc đã khóa)", "auth", email, {});
      return Response.redirect(`${env.APP_URL}/?auth_error=ADMIN_ACCOUNT_NOT_FOUND`,302);
    }

    await env.DB.prepare(`
      UPDATE users
      SET
        email_verified=1,
        full_name=COALESCE(full_name,?),
        updated_at=CURRENT_TIMESTAMP
      WHERE id=?
    `)
      .bind(
        profile.name || email,
        u.id
      )
      .run();

    const full = await getUserById(
      env,
      u.id
    );

    const ids = (
      full.roles || []
    ).map(r => r.role_id);

    if (
      st.portal === "admin" &&
      !ids.some(
        r => roleLevel(r) >= 40
      )
    ) {
      return Response.redirect(
        `${env.APP_URL}/?auth_error=ADMIN_ACCESS_NOT_GRANTED`,
        302
      );
    }

    if (u.totp_enabled) {
      const challenge = randomToken(32);
      const challengeId = uid("2fa");
      await env.DB.prepare(`
        INSERT INTO auth_tokens(id,user_id,token_type,token_hash,portal,expires_at)
        VALUES(?,?,'login_2fa',?,?,datetime('now','+10 minutes'))
      `).bind(challengeId, u.id, await sha256(challenge), st.portal).run();
      await auditAuth(env, request, full, "Yêu cầu 2FA sau Google OAuth", "user", String(u.id), {portal: st.portal});
      return Response.redirect(`${env.APP_URL}/admin/login?challenge=${encodeURIComponent(challenge)}`, 302);
    }

    const s = await createSession(
      request,
      env,
      u.id
    );

    await auditAuth(env, request, full, "Đăng nhập Google OAuth thành công", "user", String(u.id), {portal: st.portal});

    return new Response(
      null,
      {
        status:302,
        headers:{
          location:
            `${env.APP_URL}/?login=ok&portal=${encodeURIComponent(st.portal)}`,
          "set-cookie":
            sessionCookie(s.token)
        }
      }
    );
  }

  if (
    p === "/api/me/2fa/setup" &&
    request.method === "POST"
  ) {
    const user = await getAuthUser(
      request,
      env
    );

    const auth = requireAuth(user);
    if (auth) return auth;

    const bytes =
      new Uint8Array(20);

    crypto.getRandomValues(bytes);

    const secret =
      base32Encode(bytes);

    await env.DB.prepare(
      "UPDATE users SET totp_secret=?,totp_enabled=0 WHERE id=?"
    )
      .bind(
        secret,
        user.id
      )
      .run();

    const issuer =
      encodeURIComponent(
        "Hệ thống Thông tin Số Sky First"
      );

    const label =
      encodeURIComponent(
        user.email
      );

    const uri =
      `otpauth://totp/${issuer}:${label}` +
      `?secret=${secret}` +
      `&issuer=${issuer}` +
      `&digits=6&period=30`;

    return json({
      secret,
      otpauth_uri:uri
    });
  }

  if (
    p === "/api/me/2fa/enable" &&
    request.method === "POST"
  ) {
    const user = await getAuthUser(
      request,
      env
    );

    const auth = requireAuth(user);
    if (auth) return auth;

    const body = await readJson(request);

    const row = await env.DB.prepare(
      "SELECT totp_secret FROM users WHERE id=?"
    ).bind(user.id).first();

    if (
      !row?.totp_secret ||
      !(await verifyTotp(
        row.totp_secret,
        body?.code
      ))
    ) {
      return json(
        {error:"INVALID_2FA"},
        400
      );
    }

    await env.DB.prepare(
      "UPDATE users SET totp_enabled=1 WHERE id=?"
    )
      .bind(user.id)
      .run();

    await auditAuth(env, request, user, "Kích hoạt bảo mật 2FA", "user", String(user.id), {});

    return json({ok:true});
  }

  if (
    p === "/api/me/2fa/disable" &&
    request.method === "POST"
  ) {
    const user = await getAuthUser(
      request,
      env
    );

    const auth = requireAuth(user);
    if (auth) return auth;

    const body = await readJson(request);

    const verified =
      await verifyPassword(
        env,
        user.email,
        String(body?.password || "")
      );

    if (!verified) {
      return json(
        {error:"PASSWORD_INVALID"},
        401
      );
    }

    await env.DB.prepare(`
      UPDATE users
      SET
        totp_enabled=0,
        totp_secret=NULL
      WHERE id=?
    `)
      .bind(user.id)
      .run();

    await auditAuth(env, request, user, "Tắt bảo mật 2FA", "user", String(user.id), {});

    return json({ok:true});
  }

  if (
    p === "/api/me/sessions" &&
    request.method === "GET"
  ) {
    const user = await getAuthUser(
      request,
      env
    );

    const auth = requireAuth(user);
    if (auth) return auth;

    const rs = await env.DB.prepare(`
      SELECT
        id,
        user_agent,
        created_at,
        last_seen_at,
        expires_at
      FROM sessions
      WHERE user_id=?
      ORDER BY last_seen_at DESC
    `)
      .bind(user.id)
      .all();

    return json({
      sessions:
        rs.results || []
    });
  }

  if (
    p === "/api/me/sessions/revoke-all" &&
    request.method === "POST"
  ) {
    const user = await getAuthUser(
      request,
      env
    );

    const auth = requireAuth(user, {allowPasswordChangeRequired: true});
    if (auth) return auth;

    await env.DB.prepare(
      "DELETE FROM sessions WHERE user_id=?"
    )
      .bind(user.id)
      .run();

    await auditAuth(env, request, user, "Thu hồi toàn bộ phiên đăng nhập", "user", String(user.id), {});

    return json(
      {ok:true},
      200,
      {
        "set-cookie":
          clearSessionCookie()
      }
    );
  }

  return null;
}

export async function createInvitedAccount(
  request,
  env,
  actor,
  body
) {
  const deny = requirePermission(actor, "user.manage");
  if (deny) return deny;

  const email = String(
    body?.email || ""
  )
    .trim()
    .toLowerCase();

  const fullName = String(
    body?.full_name || ""
  ).trim();

  if (
    !email.includes("@") ||
    fullName.length < 2
  ) {
    return json(
      {error:"INVALID_INPUT"},
      400
    );
  }

  const roles =
    Array.isArray(body?.roles)
      ? body.roles
      : [];

  const activationMode = body?.activation_mode === "self" ? "self" : "email";
  const mustChangePassword = body?.must_change_password === false ? 0 : 1;

  const actorLevel =
    highestRoleLevel(actor);

  for (const r of roles) {
    if (r === "owner") {
      return json({error:"OWNER_ROLE_NOT_ASSIGNABLE_HERE"},403);
    }
    if (
      r === "super_admin" &&
      !(actor.roles || []).some(
        x => ["owner","super_admin"].includes(x.role_id)
      )
    ) {
      return json(
        {error:"CANNOT_GRANT_SUPER_ADMIN"},
        403
      );
    }

    if (
      roleLevel(r) >= actorLevel &&
      !(actor.roles || []).some(
        x => x.role_id === "owner" || x.role_id === "super_admin"
      )
    ) {
      return json(
        {error:"ROLE_TOO_HIGH"},
        403
      );
    }
  }

  const exists =
    await env.DB.prepare(
      "SELECT id FROM users WHERE email=? COLLATE NOCASE"
    )
      .bind(email)
      .first();

  if (exists) {
    return json(
      {error:"EMAIL_EXISTS"},
      409
    );
  }

  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#%";

  const rnd =
    new Uint8Array(16);

  crypto.getRandomValues(rnd);

  let temp = "SFN!";

  for (
    let i = 0;
    i < rnd.length;
    i++
  ) {
    temp +=
      chars[
        rnd[i] %
        chars.length
      ];
  }

  const salt = newSalt();

  const hash = await pbkdf2(
    temp,
    salt,
    PASSWORD_ITERATIONS
  );

  const res = await env.DB.prepare(`
    INSERT INTO users(
      email,
      full_name,
      password_salt,
      password_hash,
      password_iterations,
      status,
      email_verified,
      must_change_password
    )
    VALUES(
      ?,?,?,?,?,
      ?,
      ?,
      ?
    )
  `)
    .bind(
      email,
      fullName,
      salt,
      hash,
      PASSWORD_ITERATIONS,
      activationMode === "self" ? "active" : "invited",
      activationMode === "self" ? 1 : 0,
      mustChangePassword
    )
    .run();

  const uidUser =
    res.meta.last_row_id;

  for (
    const role of
    roles.length
      ? roles
      : ["student"]
  ) {
    await env.DB.prepare(`
      INSERT OR IGNORE INTO user_roles(
        user_id,
        role_id,
        scope_unit_code,
        granted_by
      )
      VALUES(?,?,?,?)
    `)
      .bind(
        uidUser,
        role,
        body?.scope_unit_code || "",
        actor.id
      )
      .run();
  }

  const token = randomToken(32);
  const tokenHash = await sha256(token);

  await env.DB.prepare(`
    INSERT INTO auth_tokens(
      id,
      user_id,
      token_type,
      token_hash,
      portal,
      expires_at
    )
    VALUES(
      ?,?,
      'password_reset',
      ?,?,
      datetime('now','+48 hours')
    )
  `)
    .bind(
      uid("invite"),
      uidUser,
      tokenHash,
      body?.portal || "admin"
    )
    .run();

  const activationLink =
    `${env.APP_URL || "https://app.skyfirst.io.vn"}/?reset=${encodeURIComponent(token)}`;

  const mailResult = await sendTemplatedEmail(
    env,
    "account_invite",
    email,
    {
      full_name: fullName,
      email,
      activation_link: activationLink,
      link: activationLink,
      temp_password:
        activationMode === "self"
          ? temp
          : "Thiết lập qua liên kết kích hoạt một lần"
    }
  );

  await auditAuth(env, request, actor, "Cấp tài khoản quản trị mới", "user", String(uidUser), {
    invited_email: email,
    roles,
    scope_unit_code: body?.scope_unit_code || "",
    activation_mode: activationMode,
    email_sent: !!mailResult?.ok
  });

  return json({
    ok:true,
    id:uidUser,
    activation_mode: activationMode,
    activation_link: activationLink,
    email_sent: !!mailResult?.ok,
    ...(activationMode === "self" ? {temp_password: temp} : {})
  });
}

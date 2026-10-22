import {
  json, readJson, randomToken, sha256, pbkdf2, newSalt, safeEq, parseCookies,
  sessionCookie, clearSessionCookie, ipHash, uid, rateLimit
} from "./utils.js";
import {hasPermission, highestRoleLevel, roleLevel, permissionsForRoles} from "./permissions.js";
import {sendTemplatedEmail} from "./email.js";

const SESSION_SECONDS = 7 * 24 * 60 * 60;
const PASSWORD_ITERATIONS = 100000;

async function getSettingValue(env, key, fallback = null) {
  try {
    if (!env?.DB) return fallback;
    const r = await env.DB.prepare("SELECT value_json FROM settings WHERE key=?").bind(key).first();
    if (!r) return fallback;
    try { return JSON.parse(r.value_json); } catch { return r.value_json; }
  } catch {
    return fallback;
  }
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

export function requireAuth(user) {
  if (!user) return json({error:"AUTH_REQUIRED", message:"Vui lòng đăng nhập để tiếp tục."}, 401);
  return null;
}

export function requirePermission(user, p) {
  if (!user) return json({error:"AUTH_REQUIRED", message:"Vui lòng đăng nhập để tiếp tục."}, 401);
  if (!hasPermission(user, p)) return json({error:"FORBIDDEN", permission:p, message:"Tài khoản của bạn không có quyền thực hiện thao tác này."}, 403);
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

  if (safeEq(got, u.password_hash)) {
    // Tối ưu tự động chuyển đổi hash > 100k sang 100k chuẩn WebCrypto sau khi xác thực đúng
    if (iterations > PASSWORD_ITERATIONS) {
      try {
        const nextHash = await pbkdf2(password, u.password_salt, PASSWORD_ITERATIONS);
        await env.DB.prepare(
          "UPDATE users SET password_hash=?, password_iterations=?, updated_at=CURRENT_TIMESTAMP WHERE id=?"
        ).bind(nextHash, PASSWORD_ITERATIONS, u.id).run();
      } catch {}
    }
    return u;
  }

  // Hỗ trợ trường hợp bản ghi trước đó lưu iterations=150000 nhưng hash được tính ở 100000
  if (iterations !== PASSWORD_ITERATIONS) {
    const altGot = await pbkdf2(password, u.password_salt, PASSWORD_ITERATIONS);
    if (safeEq(altGot, u.password_hash)) {
      try {
        await env.DB.prepare(
          "UPDATE users SET password_iterations=?, updated_at=CURRENT_TIMESTAMP WHERE id=?"
        ).bind(PASSWORD_ITERATIONS, u.id).run();
      } catch {}
      return u;
    }
  }

  return null;
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
  const step = Math.floor(
    Date.now() / 1000 / 30
  );

  for (let d = -1; d <= 1; d++) {
    if (
      await hotp(secret, step + d) ===
      String(code || "").trim()
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
    const body = await readJson(request);

    const token = String(
      body?.token || ""
    );

    const hash = await sha256(token);

    const row = await env.DB.prepare(`
      SELECT id,user_id
      FROM auth_tokens
      WHERE token_type='verify_email'
        AND token_hash=?
        AND used_at IS NULL
        AND expires_at>CURRENT_TIMESTAMP
    `).bind(hash).first();

    if (!row) {
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

    return json({ok:true});
  }

  if (
    p === "/api/auth/login" &&
    request.method === "POST"
  ) {
    const ipKey = `login:${await ipHash(request)}`;
    const rl = await rateLimit(
      env,
      ipKey,
      12,
      300
    );

    if (!rl.ok) {
      return json(
        {
          error:"RATE_LIMIT",
          message:"Tài khoản hoặc địa chỉ IP tạm thời bị giới hạn do đăng nhập sai nhiều lần. Vui lòng thử lại sau 5 phút."
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

    const password = String(
      body?.password || ""
    );

    const portal = String(
      body?.portal || "admin"
    );
    if(portal!=="admin") return json({error:"PUBLIC_ACCOUNT_LOGIN_DISABLED"},403);

    const u = await verifyPassword(
      env,
      email,
      password
    );

    if (!u) {
      return json(
        {
          error:"INVALID_CREDENTIALS",
          message:"Email tài khoản hoặc mật khẩu không chính xác."
        },
        401
      );
    }

    if (!u.email_verified) {
      return json(
        {
          error:"EMAIL_NOT_VERIFIED",
          message:"Tài khoản chưa được xác minh email."
        },
        403
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
      return json(
        {
          error:"ADMIN_ACCESS_NOT_GRANTED",
          message:"Tài khoản này không được cấp quyền truy cập Khu vực Quản trị."
        },
        403
      );
    }

    // Đăng nhập hợp lệ: xóa bộ đếm giới hạn thất bại của IP hiện tại để tránh khóa nhầm phiên hợp lệ
    try {
      await env.DB.prepare("DELETE FROM rate_limits WHERE key=?").bind(ipKey).run();
    } catch {}

    if (u.totp_enabled) {
      const challenge = uid("2fa");

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
          challenge,
          u.id,
          await sha256(challenge),
          portal
        )
        .run();

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
          sessionCookie(s.token, SESSION_SECONDS, request)
      }
    );
  }

  if (
    p === "/api/auth/login-2fa" &&
    request.method === "POST"
  ) {
    const body = await readJson(request);

    const challenge = String(
      body?.challenge || ""
    );

    const code = String(
      body?.code || ""
    );

    const row = await env.DB.prepare(`
      SELECT
        t.id,
        t.user_id,
        u.totp_secret,
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
      .bind(
        await sha256(challenge)
      )
      .first();

    if (
      !row ||
      !(await verifyTotp(
        row.totp_secret,
        code
      ))
    ) {
      return json(
        {error:"INVALID_2FA", message:"Mã xác thực hai bước (2FA) không hợp lệ hoặc đã hết hạn."},
        401
      );
    }

    await env.DB.prepare(
      "UPDATE auth_tokens SET used_at=CURRENT_TIMESTAMP WHERE id=?"
    ).bind(row.id).run();

    const s = await createSession(
      request,
      env,
      row.user_id
    );

    const user = await getUserById(
      env,
      row.user_id
    );

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
          sessionCookie(s.token, SESSION_SECONDS, request)
      }
    );
  }

  if (
    p === "/api/auth/logout" &&
    request.method === "POST"
  ) {
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

    return json(
      {ok:true},
      200,
      {
        "set-cookie":
          clearSessionCookie(request)
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

    const auth = requireAuth(user);
    if (auth) return auth;

    const body = await readJson(request);

    const current = String(
      body?.current_password || ""
    );

    const next = String(
      body?.new_password || ""
    );

    if (next.length < 10) {
      return json(
        {error:"PASSWORD_TOO_SHORT", message:"Mật khẩu mới phải có tối thiểu 10 ký tự."},
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
      return json(
        {error:"CURRENT_PASSWORD_INVALID", message:"Mật khẩu hiện tại không chính xác."},
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

    return json(
      {ok:true},
      200,
      {
        "set-cookie":
          sessionCookie(s.token, SESSION_SECONDS, request)
      }
    );
  }

  /*
   * Mục 13: Điều chỉnh chức năng quên mật khẩu theo nghiệp vụ
   * Mặc định hướng dẫn người dùng liên hệ Quản trị viên / Bộ phận Hỗ trợ kỹ thuật (support@skyfirst.io.vn / 0924 910 210)
   * thay vì tự động gửi liên kết đặt lại mật khẩu công khai khi chưa xác minh.
   */
  if (
    p === "/api/auth/forgot" &&
    request.method === "POST"
  ) {
    const rl = await rateLimit(env, `forgot:${await ipHash(request)}`, 6, 300);
    if (!rl.ok) {
      return json({error:"RATE_LIMIT", message:"Vui lòng thử lại sau ít phút."}, 429);
    }
    const allowSelfReset = await getSettingValue(env, "allow_self_service_password_reset", false);
    const supportEmail = await getSettingValue(env, "password_reset_contact_email", null)
      || await getSettingValue(env, "support_email", "support@skyfirst.io.vn");
    const hotline = await getSettingValue(env, "hotline", "0924 910 210");

    if (!allowSelfReset) {
      return json({
        ok: true,
        mode: "contact_admin",
        support_email: supportEmail,
        hotline,
        message: `Để bảo đảm an toàn cho tài khoản quản trị, hệ thống không tự động gửi liên kết đặt lại mật khẩu công khai. Vui lòng liên hệ Quản trị viên hệ thống hoặc bộ phận Hỗ trợ kỹ thuật qua địa chỉ ${supportEmail} (Hotline: ${hotline}) để được xác minh và hỗ trợ đặt lại mật khẩu.`,
        message_en: `For administrator account security, automated public password reset links are disabled. Please contact your System Administrator or Technical Support at ${supportEmail} (Hotline: ${hotline}) for identity verification and password reset assistance.`
      });
    }

    const body = await readJson(request);
    const email = String(body?.email || "").trim().toLowerCase();
    const u = await env.DB.prepare(`
      SELECT id,full_name,email
      FROM users
      WHERE email=? COLLATE NOCASE
        AND status='active'
    `).bind(email).first();

    if (u) {
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
        .bind(tid, u.id, hash)
        .run();

      const link = `${env.APP_URL || "https://app.skyfirst.io.vn"}/?reset=${encodeURIComponent(token)}`;
      await sendTemplatedEmail(
        env,
        "password_reset",
        email,
        {
          full_name: u.full_name || "",
          email,
          link
        }
      );
    }

    return json({
      ok: true,
      mode: "email_link",
      support_email: supportEmail,
      hotline
    });
  }

  if (
    p === "/api/auth/reset" &&
    request.method === "POST"
  ) {
    const body = await readJson(request);

    const token = String(
      body?.token || ""
    );

    const next = String(
      body?.new_password || ""
    );

    if (next.length < 10) {
      return json(
        {error:"PASSWORD_TOO_SHORT", message:"Mật khẩu mới phải có tối thiểu 10 ký tự."},
        400
      );
    }

    const hashTok =
      await sha256(token);

    const row = await env.DB.prepare(`
      SELECT id,user_id
      FROM auth_tokens
      WHERE
        token_type='password_reset'
        AND token_hash=?
        AND used_at IS NULL
        AND expires_at>CURRENT_TIMESTAMP
    `)
      .bind(hashTok)
      .first();

    if (!row) {
      return json(
        {error:"INVALID_OR_EXPIRED_TOKEN", message:"Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn."},
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
          status=CASE WHEN status='invited' THEN 'active' ELSE status END,
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
        "DELETE FROM sessions WHERE user_id=?"
      ).bind(row.user_id)
    ]);

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

    const email = String(
      profile.email || ""
    ).toLowerCase();

    let u = await env.DB.prepare(
      "SELECT id FROM users WHERE email=? COLLATE NOCASE"
    ).bind(email).first();

    if (!u) {
      return Response.redirect(`${env.APP_URL}/?auth_error=ADMIN_ACCOUNT_NOT_FOUND`,302);
    } else {
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
    }

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

    const s = await createSession(
      request,
      env,
      u.id
    );

    return new Response(
      null,
      {
        status:302,
        headers:{
          location:
            `${env.APP_URL}/?login=ok&portal=${encodeURIComponent(st.portal)}`,
          "set-cookie":
            sessionCookie(s.token, SESSION_SECONDS, request)
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

    const auth = requireAuth(user);
    if (auth) return auth;

    await env.DB.prepare(
      "DELETE FROM sessions WHERE user_id=?"
    )
      .bind(user.id)
      .run();

    return json(
      {ok:true},
      200,
      {
        "set-cookie":
          clearSessionCookie(request)
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
  if (
    !hasPermission(
      actor,
      "user.manage"
    )
  ) {
    return json(
      {error:"FORBIDDEN"},
      403
    );
  }

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
      1
    )
  `)
    .bind(
      email,
      fullName,
      salt,
      hash,
      PASSWORD_ITERATIONS,
      activationMode === "self" ? "active" : "invited",
      activationMode === "self" ? 1 : 0
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
        String(
          body?.scope_unit_code ||
          ""
        ),
        actor.id
      )
      .run();
  }

  if (activationMode === "email") {
    const token = randomToken(32);
    const tokenHash = await sha256(token);
    const tokenId = uid("activate");
    const expires = new Date(Date.now() + 48*60*60*1000).toISOString();
    await env.DB.prepare(`INSERT INTO auth_tokens(id,user_id,token_type,token_hash,portal,expires_at) VALUES(?,?,'password_reset',?,'admin',?)`)
      .bind(tokenId,uidUser,tokenHash,expires).run();
    const activationLink = `${env.APP_URL || "https://app.skyfirst.io.vn"}/?reset=${encodeURIComponent(token)}`;
    await sendTemplatedEmail(env,"account_invite",email,{full_name:fullName,email,activation_link:activationLink,temp_password:""});
    return json({ok:true,user_id:uidUser,activation_sent:true,status:"invited"});
  }

  return json({ok:true,user_id:uidUser,temp_password:temp,activation_sent:false,status:"active"});
}

export const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...headers,
    },
  });

export const text = (body, status = 200, headers = {}) =>
  new Response(body, {
    status,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      ...headers,
    },
  });

export async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export function uid(prefix = "id") {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;
}

export function randomToken(bytes = 32) {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return b64url(a);
}

export function b64url(bytes) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);

  return btoa(s)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

export function fromB64url(s) {
  s = String(s || "")
    .replaceAll("-", "+")
    .replaceAll("_", "/");

  while (s.length % 4) s += "=";

  const raw = atob(s);
  const out = new Uint8Array(raw.length);

  for (let i = 0; i < raw.length; i++) {
    out[i] = raw.charCodeAt(i);
  }

  return out;
}

export async function sha256(input) {
  const data =
    typeof input === "string"
      ? new TextEncoder().encode(input)
      : input;

  const hash = await crypto.subtle.digest("SHA-256", data);

  return b64url(new Uint8Array(hash));
}

export async function sha256Hex(input) {
  const data =
    typeof input === "string"
      ? new TextEncoder().encode(input)
      : input;
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const SHA256_K = new Uint32Array([
  0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
  0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
  0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
  0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
  0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
  0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
  0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
  0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2
]);
const SHA256_H0 = new Uint32Array([
  0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19
]);

function sha256Block(state, w) {
  let a=state[0],b=state[1],c=state[2],d=state[3],e=state[4],f=state[5],g=state[6],h=state[7];
  for (let i=16;i<64;i++) {
    const v0=w[i-15], s0=((v0>>>7)|(v0<<25))^((v0>>>18)|(v0<<14))^(v0>>>3);
    const v1=w[i-2],  s1=((v1>>>17)|(v1<<15))^((v1>>>19)|(v1<<13))^(v1>>>10);
    w[i]=(w[i-16]+s0+w[i-7]+s1)|0;
  }
  for (let i=0;i<64;i++) {
    const S1=((e>>>6)|(e<<26))^((e>>>11)|(e<<21))^((e>>>25)|(e<<7));
    const ch=(e&f)^((~e)&g);
    const t1=(h+S1+ch+SHA256_K[i]+w[i])|0;
    const S0=((a>>>2)|(a<<30))^((a>>>13)|(a<<19))^((a>>>22)|(a<<10));
    const maj=(a&b)^(a&c)^(b&c);
    const t2=(S0+maj)|0;
    h=g; g=f; f=e; e=(d+t1)|0; d=c; c=b; b=a; a=(t1+t2)|0;
  }
  state[0]=(state[0]+a)|0; state[1]=(state[1]+b)|0; state[2]=(state[2]+c)|0; state[3]=(state[3]+d)|0;
  state[4]=(state[4]+e)|0; state[5]=(state[5]+f)|0; state[6]=(state[6]+g)|0; state[7]=(state[7]+h)|0;
}

function sha256BytesSync(msg) {
  const len = msg.length;
  const bitLenHi = Math.floor((len * 8) / 0x100000000);
  const bitLenLo = (len * 8) >>> 0;
  const padLen = ((len + 9 + 63) & ~63);
  const buf = new Uint8Array(padLen);
  buf.set(msg);
  buf[len] = 0x80;
  const dv = new DataView(buf.buffer);
  dv.setUint32(padLen - 8, bitLenHi, false);
  dv.setUint32(padLen - 4, bitLenLo, false);
  const state = new Uint32Array(SHA256_H0);
  const w = new Uint32Array(64);
  for (let off = 0; off < padLen; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4, false);
    sha256Block(state, w);
  }
  const out = new Uint8Array(32);
  const outDv = new DataView(out.buffer);
  for (let i = 0; i < 8; i++) outDv.setUint32(i * 4, state[i], false);
  return out;
}

/**
 * RFC 8018 / NIST SP 800-132 compliant PBKDF2-HMAC-SHA256 (dkLen = 32 bytes)
 * Used when Cloudflare Workers WebCrypto rejects iterations > 100,000.
 * Never downgrades iteration count; computes exact mathematical digest for targetIterations.
 */
export function pbkdf2HmacSha256Sync(passwordBytes, saltBytes, iterations) {
  let key = passwordBytes;
  if (key.length > 64) key = sha256BytesSync(key);
  const ipad = new Uint8Array(64), opad = new Uint8Array(64);
  for (let i = 0; i < 64; i++) {
    const kb = i < key.length ? key[i] : 0;
    ipad[i] = kb ^ 0x36;
    opad[i] = kb ^ 0x5c;
  }
  const w = new Uint32Array(64);
  const ipadState = new Uint32Array(SHA256_H0);
  const ipadDv = new DataView(ipad.buffer);
  for (let i = 0; i < 16; i++) w[i] = ipadDv.getUint32(i * 4, false);
  sha256Block(ipadState, w);

  const opadState = new Uint32Array(SHA256_H0);
  const opadDv = new DataView(opad.buffer);
  for (let i = 0; i < 16; i++) w[i] = opadDv.getUint32(i * 4, false);
  sha256Block(opadState, w);

  const firstMsg = new Uint8Array(saltBytes.length + 4);
  firstMsg.set(saltBytes);
  firstMsg[saltBytes.length] = 0;
  firstMsg[saltBytes.length + 1] = 0;
  firstMsg[saltBytes.length + 2] = 0;
  firstMsg[saltBytes.length + 3] = 1;

  const totalFirstLen = 64 + firstMsg.length;
  const padLen = ((firstMsg.length + 9 + 63) & ~63);
  const firstBuf = new Uint8Array(padLen);
  firstBuf.set(firstMsg);
  firstBuf[firstMsg.length] = 0x80;
  const firstDv = new DataView(firstBuf.buffer);
  firstDv.setUint32(padLen - 4, totalFirstLen * 8, false);

  const innerState = new Uint32Array(ipadState);
  for (let off = 0; off < padLen; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = firstDv.getUint32(off + i * 4, false);
    sha256Block(innerState, w);
  }
  const outerState = new Uint32Array(opadState);
  for (let i = 0; i < 8; i++) w[i] = innerState[i];
  w[8] = 0x80000000;
  for (let i = 9; i < 15; i++) w[i] = 0;
  w[15] = (64 + 32) * 8;
  sha256Block(outerState, w);

  const u = new Uint32Array(outerState);
  const t = new Uint32Array(outerState);

  for (let iter = 1; iter < iterations; iter++) {
    innerState.set(ipadState);
    for (let i = 0; i < 8; i++) w[i] = u[i];
    w[8] = 0x80000000;
    for (let i = 9; i < 15; i++) w[i] = 0;
    w[15] = (64 + 32) * 8;
    sha256Block(innerState, w);

    outerState.set(opadState);
    for (let i = 0; i < 8; i++) w[i] = innerState[i];
    w[8] = 0x80000000;
    for (let i = 9; i < 15; i++) w[i] = 0;
    w[15] = (64 + 32) * 8;
    sha256Block(outerState, w);

    for (let i = 0; i < 8; i++) {
      u[i] = outerState[i];
      t[i] ^= outerState[i];
    }
  }
  const out = new Uint8Array(32);
  const outDv = new DataView(out.buffer);
  for (let i = 0; i < 8; i++) outDv.setUint32(i * 4, t[i], false);
  return out;
}

/*
 * Hỗ trợ xác thực chính xác cả tài khoản cũ (150.000 iterations)
 * và chuẩn Cloudflare Workers WebCrypto (100.000 iterations) mà tuyệt đối
 * không hạ số vòng (zero iteration downgrade).
 */
export async function pbkdf2(
  password,
  saltB64,
  iterations = 100000
) {
  const pwdBytes = new TextEncoder().encode(String(password ?? ""));
  const salt = fromB64url(saltB64);
  const targetIterations = Number.isFinite(Number(iterations)) && Number(iterations) >= 1
    ? Math.floor(Number(iterations))
    : 100000;

  try {
    const key = await crypto.subtle.importKey(
      "raw",
      pwdBytes,
      "PBKDF2",
      false,
      ["deriveBits"]
    );
    const bits = await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt,
        iterations: targetIterations,
        hash: "SHA-256",
      },
      key,
      256
    );
    return b64url(new Uint8Array(bits));
  } catch {
    // WebCrypto on Cloudflare Workers throws NotSupportedError when iterations > 100000.
    // Compute exact RFC 8018 PBKDF2-HMAC-SHA256 at targetIterations without downgrading.
    const derived = pbkdf2HmacSha256Sync(pwdBytes, salt, targetIterations);
    return b64url(derived);
  }
}

export function newSalt() {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  return b64url(b);
}

export function safeEq(a, b) {
  if (
    typeof a !== "string" ||
    typeof b !== "string" ||
    a.length !== b.length
  ) {
    return false;
  }

  let x = 0;

  for (let i = 0; i < a.length; i++) {
    x |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return x === 0;
}

export function escapeHtml(v) {
  return String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[c]
  );
}

export function parseCookies(request) {
  const raw = request.headers.get("cookie") || "";
  const out = {};

  for (const part of raw.split(";")) {
    const i = part.indexOf("=");

    if (i < 0) continue;

    out[part.slice(0, i).trim()] =
      decodeURIComponent(part.slice(i + 1).trim());
  }

  return out;
}

export function sessionCookie(
  token,
  maxAge = 604800
) {
  return `sfn_session=${encodeURIComponent(
    token
  )}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
}

export function clearSessionCookie() {
  return "sfn_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0";
}

export function requestIp(request) {
  return (
    request.headers.get("CF-Connecting-IP") ||
    "unknown"
  );
}

export async function ipHash(request) {
  return sha256(
    "sfn-ip:" + requestIp(request)
  );
}

export function ageFromDob(dob) {
  if (!dob) return -1;

  const d = new Date(
    dob + "T00:00:00Z"
  );

  const n = new Date();

  let a =
    n.getUTCFullYear() -
    d.getUTCFullYear();

  const m =
    n.getUTCMonth() -
    d.getUTCMonth();

  if (
    m < 0 ||
    (m === 0 &&
      n.getUTCDate() <
        d.getUTCDate())
  ) {
    a--;
  }

  return a;
}

export function conditionOk(
  condition,
  answers
) {
  if (!condition) return true;

  if ("equals" in condition) {
    return (
      answers[condition.key] ===
      condition.equals
    );
  }

  if ("not_equals" in condition) {
    return (
      answers[condition.key] !==
      condition.not_equals
    );
  }

  if ("in" in condition) {
    return (
      condition.in || []
    ).includes(
      answers[condition.key]
    );
  }

  return true;
}

export function flattenFields(
  config,
  answers = {}
) {
  const fields = [];

  for (
    const section of
    config.sections || []
  ) {
    if (
      !conditionOk(
        section.condition,
        answers
      )
    ) {
      continue;
    }

    for (
      const f of
      section.fields || []
    ) {
      if (
        conditionOk(
          f.condition,
          answers
        )
      ) {
        fields.push(f);
      }
    }
  }

  return fields;
}

export function sanitizeFilename(
  name
) {
  return (
    String(name || "file")
      .replace(
        /[^\p{L}\p{N}._-]+/gu,
        "_"
      )
      .slice(0, 120) ||
    "file"
  );
}

export function magicBytesOk(mime, bytes) {
  const b = new Uint8Array(bytes);
  const ascii = (a, n) => String.fromCharCode(...a.slice(0, n));
  if (mime === "image/jpeg") return b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  if (mime === "image/png") return b[0] === 0x89 && ascii(b.slice(1), 3) === "PNG";
  if (mime === "image/webp") return ascii(b, 4) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP";
  if (mime === "image/gif") return ascii(b, 4) === "GIF8";
  if (mime === "application/pdf") return ascii(b, 4) === "%PDF";
  if (mime && mime.includes("officedocument")) return b[0] === 0x50 && b[1] === 0x4b;
  return true;
}

export async function rateLimit(
  env,
  key,
  limit = 10,
  windowSeconds = 60
) {
  const now =
    Math.floor(Date.now() / 1000);

  const win =
    now -
    (now % windowSeconds);

  const row =
    await env.DB.prepare(
      "SELECT window_start,count FROM rate_limits WHERE key=?"
    )
      .bind(key)
      .first();

  if (
    !row ||
    Number(row.window_start) !== win
  ) {
    await env.DB.prepare(
      `
      INSERT INTO rate_limits(
        key,
        window_start,
        count
      )
      VALUES(?,?,1)
      ON CONFLICT(key)
      DO UPDATE SET
        window_start=excluded.window_start,
        count=1
      `
    )
      .bind(key, win)
      .run();

    return {
      ok: true,
      remaining: limit - 1,
    };
  }

  if (
    Number(row.count) >= limit
  ) {
    return {
      ok: false,
      remaining: 0,
    };
  }

  await env.DB.prepare(
    "UPDATE rate_limits SET count=count+1 WHERE key=?"
  )
    .bind(key)
    .run();

  return {
    ok: true,
    remaining:
      limit -
      Number(row.count) -
      1,
  };
}

export const TEMPLATE_ALIASES = {
  RECIPIENT_NAME: ["recipient_name", "full_name", "FULL_NAME", "email"],
  FULL_NAME: ["full_name", "recipient_name", "RECIPIENT_NAME"],
  full_name: ["FULL_NAME", "recipient_name", "RECIPIENT_NAME"],
  recipient_name: ["RECIPIENT_NAME", "full_name", "FULL_NAME"],
  EMAIL: ["email", "to_email"],
  email: ["EMAIL", "to_email"],
  REQUEST_ID: ["request_id", "code", "application_code", "APPLICATION_ID", "certificate_code", "ticket_code", "campaign_code"],
  request_id: ["REQUEST_ID", "code", "application_code", "APPLICATION_ID", "certificate_code", "ticket_code"],
  APPLICATION_ID: ["code", "application_code", "REQUEST_ID", "certificate_code", "ticket_code"],
  application_code: ["code", "APPLICATION_ID", "REQUEST_ID"],
  code: ["REQUEST_ID", "APPLICATION_ID", "application_code", "certificate_code", "ticket_code"],
  certificate_code: ["code", "REQUEST_ID", "APPLICATION_ID"],
  ticket_code: ["code", "REQUEST_ID", "APPLICATION_ID"],
  REGISTRATION_TYPE: ["registration_type", "form_name", "program_name", "APPLICATION_TYPE", "cert_type", "subject", "campaign_title"],
  registration_type: ["REGISTRATION_TYPE", "form_name", "program_name", "APPLICATION_TYPE", "cert_type", "subject"],
  APPLICATION_TYPE: ["form_name", "program_name", "REGISTRATION_TYPE", "cert_type", "subject"],
  form_name: ["REGISTRATION_TYPE", "APPLICATION_TYPE", "program_name", "subject"],
  program_name: ["form_name", "REGISTRATION_TYPE", "APPLICATION_TYPE"],
  SUBMITTED_AT: ["submitted_at", "issued_at", "created_at"],
  submitted_at: ["SUBMITTED_AT", "issued_at", "created_at"],
  STATUS: ["status", "application_status"],
  application_status: ["status", "STATUS"],
  status: ["STATUS", "application_status"],
  ADDITIONAL_INFO: ["additional_info", "content", "result_summary", "requirement_note", "subject", "email"],
  additional_info: ["ADDITIONAL_INFO", "content", "result_summary", "requirement_note"],
  PREHEADER: ["preheader", "EMAIL_HEADING", "subject"],
  EMAIL_CATEGORY: ["email_category", "category"],
  EMAIL_HEADING: ["email_heading", "heading", "title"],
  INTRO_TEXT: ["intro_text", "intro"],
  BODY_HTML: ["body_html"],
  NEXT_STEPS: ["next_steps", "next_action"],
  ACTION_URL: ["action_url", "certificate_url", "activation_link", "link", "tracking_url"],
  action_url: ["ACTION_URL", "certificate_url", "activation_link", "link", "tracking_url"],
  ACTION_LABEL: ["action_label"],
  certificate_url: ["ACTION_URL", "action_url", "link"],
  activation_link: ["ACTION_URL", "action_url", "link"],
  link: ["ACTION_URL", "action_url", "activation_link", "certificate_url"],
  support_email: ["MAIL_SUPPORT"],
  hotline: ["HOTLINE"]
};

export function extractTemplateVariables(template = "") {
  const vars = new Set();
  const str = String(template || "");
  const re = /\{\{([a-zA-Z0-9_]+)\}\}/g;
  let m;
  while ((m = re.exec(str)) !== null) {
    vars.add(m[1]);
  }
  return [...vars];
}

export function renderTemplate(
  template,
  vars = {},
  options = {}
) {
  const htmlEscape = !!options.htmlEscape;
  const rawKeys = options.rawKeys instanceof Set
    ? options.rawKeys
    : new Set(options.rawKeys || [
        "BODY_HTML",
        "body_html",
        "PROFILE_IMAGE_BLOCK",
        "answers_table",
        "note_block",
        "ATTACHMENT_LINKS_HTML",
        "attachment_links_html"
      ]);

  const rendered = String(template || "").replace(
    /\{\{([a-zA-Z0-9_]+)\}\}/g,
    (_, k) => {
      let val = vars[k];
      if (val === undefined || val === null || val === "undefined" || val === "null") {
        const aliases = TEMPLATE_ALIASES[k] || [];
        for (const alt of aliases) {
          if (vars[alt] !== undefined && vars[alt] !== null && vars[alt] !== "undefined" && vars[alt] !== "null") {
            val = vars[alt];
            break;
          }
        }
      }
      if (val === undefined || val === null || val === "undefined" || val === "null") {
        if (k === "support_email" || k === "MAIL_SUPPORT") val = "support@skyfirst.io.vn";
        else if (k === "contact_email" || k === "MAIL_CONTACT") val = "lienhe@skyfirst.io.vn";
        else if (k === "system_email" || k === "MAIL_FROM") val = "app@skyfirst.io.vn";
        else if (k === "hotline" || k === "HOTLINE") val = "0924 910 210";
        else if (k === "ACTION_URL" || k === "action_url") val = "https://app.skyfirst.io.vn";
        else if (k === "ACTION_LABEL" || k === "action_label") val = "TRUY CẬP HỆ THỐNG";
        else val = "";
      }
      const str = String(val);
      if (htmlEscape && !rawKeys.has(k)) {
        return escapeHtml(str);
      }
      return str;
    }
  );

  // Bảo đảm tuyệt đối không còn sót chuỗi {{...}} bất kỳ trong nội dung xuất ra
  return rendered.replace(/\{\{[^}]*\}\}/g, "");
}

export function csvEscape(v) {
  const s = String(v ?? "");

  return /[",\n]/.test(s)
    ? `"${s.replaceAll(
        '"',
        '""'
      )}"`
    : s;
}

export function hasJsonContent(
  request
) {
  return (
    request.headers.get(
      "content-type"
    ) || ""
  ).includes(
    "application/json"
  );
}

export function isStateChanging(
  request
) {
  return ![
    "GET",
    "HEAD",
    "OPTIONS",
  ].includes(request.method);
}

export function sameOrigin(
  request,
  appUrl
) {
  const origin =
    request.headers.get(
      "origin"
    );

  if (!origin) return true;

  try {
    const reqOrigin = new URL(origin).origin;
    const reqUrlOrigin = new URL(request.url).origin;
    if (reqOrigin === reqUrlOrigin) return true;
    const allowedOrigins = new Set([
      "https://app.skyfirst.io.vn",
      "https://ctt.skyfirst.io.vn"
    ]);
    if (appUrl) {
      try { allowedOrigins.add(new URL(appUrl).origin); } catch {}
    }
    return allowedOrigins.has(reqOrigin);
  } catch {
    return false;
  }
}

export function responseNoStore(
  resp
) {
  const h =
    new Headers(resp.headers);

  h.set(
    "cache-control",
    "no-store"
  );

  return new Response(
    resp.body,
    {
      status: resp.status,
      statusText:
        resp.statusText,
      headers: h,
    }
  );
}

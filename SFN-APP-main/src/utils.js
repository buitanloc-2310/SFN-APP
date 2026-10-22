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

export function toBase64(bytes) {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (let i = 0; i < arr.length; i++) s += String.fromCharCode(arr[i]);
  return btoa(s);
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

/*
 * Pure-JS SHA-256 & PBKDF2-HMAC-SHA256 fallback for runtimes (such as Cloudflare Workers)
 * where WebCrypto deriveBits throws NotSupportedError for iterations > 100,000 (e.g., 150,000 in 0002_seed.sql).
 * Ensures 100% mathematical fidelity for 150,000-iteration password hashes on every runtime.
 */
const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
]);

function sha256Compress(state, blockWords) {
  const W = sha256Compress.W || (sha256Compress.W = new Uint32Array(64));
  for (let i = 0; i < 16; i++) W[i] = blockWords[i];
  for (let i = 16; i < 64; i++) {
    const v0 = W[i - 15];
    const s0 = ((v0 >>> 7) | (v0 << 25)) ^ ((v0 >>> 18) | (v0 << 14)) ^ (v0 >>> 3);
    const v1 = W[i - 2];
    const s1 = ((v1 >>> 17) | (v1 << 15)) ^ ((v1 >>> 19) | (v1 << 13)) ^ (v1 >>> 10);
    W[i] = (W[i - 16] + s0 + W[i - 7] + s1) >>> 0;
  }
  let a = state[0], b = state[1], c = state[2], d = state[3];
  let e = state[4], f = state[5], g = state[6], h = state[7];
  for (let i = 0; i < 64; i++) {
    const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
    const ch = (e & f) ^ (~e & g);
    const temp1 = (h + S1 + ch + SHA256_K[i] + W[i]) >>> 0;
    const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
    const maj = (a & b) ^ (a & c) ^ (b & c);
    const temp2 = (S0 + maj) >>> 0;
    h = g; g = f; f = e; e = (d + temp1) >>> 0;
    d = c; c = b; b = a; a = (temp1 + temp2) >>> 0;
  }
  state[0] = (state[0] + a) >>> 0;
  state[1] = (state[1] + b) >>> 0;
  state[2] = (state[2] + c) >>> 0;
  state[3] = (state[3] + d) >>> 0;
  state[4] = (state[4] + e) >>> 0;
  state[5] = (state[5] + f) >>> 0;
  state[6] = (state[6] + g) >>> 0;
  state[7] = (state[7] + h) >>> 0;
}

function sha256Bytes(bytes) {
  const len = bytes.length;
  const bitLenHi = Math.floor((len * 8) / 0x100000000);
  const bitLenLo = (len * 8) >>> 0;
  const totalBlocks = Math.ceil((len + 9) / 64);
  const padded = new Uint8Array(totalBlocks * 64);
  padded.set(bytes);
  padded[len] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 8, bitLenHi, false);
  view.setUint32(padded.length - 4, bitLenLo, false);
  const state = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
  ]);
  const blockWords = new Uint32Array(16);
  for (let off = 0; off < padded.length; off += 64) {
    for (let i = 0; i < 16; i++) blockWords[i] = view.getUint32(off + i * 4, false);
    sha256Compress(state, blockWords);
  }
  const out = new Uint8Array(32);
  const outView = new DataView(out.buffer);
  for (let i = 0; i < 8; i++) outView.setUint32(i * 4, state[i], false);
  return out;
}

export function pbkdf2SyncSha256(passwordStr, saltBytes, iterations) {
  let keyBytes = new TextEncoder().encode(passwordStr);
  if (keyBytes.length > 64) keyBytes = sha256Bytes(keyBytes);
  const ipadBlock = new Uint8Array(64);
  const opadBlock = new Uint8Array(64);
  for (let i = 0; i < 64; i++) {
    const k = i < keyBytes.length ? keyBytes[i] : 0;
    ipadBlock[i] = k ^ 0x36;
    opadBlock[i] = k ^ 0x5c;
  }
  const INIT = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
  ]);
  const ipadState = new Uint32Array(INIT);
  const opadState = new Uint32Array(INIT);
  const tempWords = new Uint32Array(16);
  const ipadView = new DataView(ipadBlock.buffer);
  const opadView = new DataView(opadBlock.buffer);
  for (let i = 0; i < 16; i++) tempWords[i] = ipadView.getUint32(i * 4, false);
  sha256Compress(ipadState, tempWords);
  for (let i = 0; i < 16; i++) tempWords[i] = opadView.getUint32(i * 4, false);
  sha256Compress(opadState, tempWords);

  // First HMAC: salt || INT(1)
  const firstInput = new Uint8Array(64 + saltBytes.length + 4);
  firstInput.set(ipadBlock, 0);
  firstInput.set(saltBytes, 64);
  firstInput[64 + saltBytes.length + 3] = 1;
  const firstInner = sha256Bytes(firstInput);
  const firstOuterInput = new Uint8Array(64 + 32);
  firstOuterInput.set(opadBlock, 0);
  firstOuterInput.set(firstInner, 64);
  const uBytes = sha256Bytes(firstOuterInput);

  const uWords = new Uint32Array(8);
  const tWords = new Uint32Array(8);
  const uView = new DataView(uBytes.buffer);
  for (let i = 0; i < 8; i++) {
    uWords[i] = uView.getUint32(i * 4, false);
    tWords[i] = uWords[i];
  }

  // Pre-build 16-word padded block template for 32-byte message (total 64 + 32 = 96 bytes = 768 bits)
  const msgBlock = new Uint32Array(16);
  msgBlock[8] = 0x80000000;
  msgBlock[15] = 768;
  const workState = new Uint32Array(8);

  for (let iter = 1; iter < iterations; iter++) {
    for (let i = 0; i < 8; i++) {
      msgBlock[i] = uWords[i];
      workState[i] = ipadState[i];
    }
    sha256Compress(workState, msgBlock);
    for (let i = 0; i < 8; i++) {
      msgBlock[i] = workState[i];
      workState[i] = opadState[i];
    }
    sha256Compress(workState, msgBlock);
    for (let i = 0; i < 8; i++) {
      uWords[i] = workState[i];
      tWords[i] = (tWords[i] ^ uWords[i]) >>> 0;
    }
  }

  const out = new Uint8Array(32);
  const outView = new DataView(out.buffer);
  for (let i = 0; i < 8; i++) outView.setUint32(i * 4, tWords[i], false);
  return out;
}

export async function pbkdf2(
  password,
  saltB64,
  iterations = 100000
) {
  const salt = fromB64url(saltB64);
  const targetIterations = Number.isFinite(Number(iterations)) && Number(iterations) > 0
    ? Number(iterations)
    : 100000;

  try {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(password),
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
    // Exact PBKDF2-HMAC-SHA256 calculation when WebCrypto caps iterations at 100,000
    const derived = pbkdf2SyncSha256(String(password ?? ""), salt, targetIterations);
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

export function sanitizeControlledHtml(html) {
  let s = String(html ?? "");
  // Remove dangerous tags completely
  s = s.replace(/<\s*(script|iframe|object|embed|form|meta|link|style|base|svg|math)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "");
  s = s.replace(/<\s*(script|iframe|object|embed|form|meta|link|style|base|input|button|textarea)[^>]*\/?>/gi, "");
  // Strip inline event handlers like onerror=, onload=, onclick=
  s = s.replace(/\s+on[a-z0-9_-]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  // Neutralize javascript: or data:text/html URIs in href/src
  s = s.replace(/(href|src)\s*=\s*(["'])\s*(?:javascript:|vbscript:|data:text\/html)[^"']*\2/gi, '$1="#"');
  return s;
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
  maxAge = 604800,
  request = null
) {
  let isLocalHttp = false;
  if (request?.url) {
    try {
      const u = new URL(request.url);
      if (u.protocol === "http:" && (u.hostname === "localhost" || u.hostname === "127.0.0.1")) {
        isLocalHttp = true;
      }
    } catch {}
  }
  const securePart = isLocalHttp ? "" : " Secure;";
  return `sfn_session=${encodeURIComponent(
    token
  )}; Path=/; HttpOnly;${securePart} SameSite=Lax; Max-Age=${maxAge}`;
}

export function clearSessionCookie(request = null) {
  let isLocalHttp = false;
  if (request?.url) {
    try {
      const u = new URL(request.url);
      if (u.protocol === "http:" && (u.hostname === "localhost" || u.hostname === "127.0.0.1")) {
        isLocalHttp = true;
      }
    } catch {}
  }
  const securePart = isLocalHttp ? "" : " Secure;";
  return `sfn_session=; Path=/; HttpOnly;${securePart} SameSite=Lax; Max-Age=0`;
}

export function requestIp(request) {
  const cf = request.headers.get("CF-Connecting-IP");
  if (cf && cf.trim()) return cf.trim();
  const xff = request.headers.get("X-Forwarded-For");
  if (xff && xff.trim()) return xff.split(",")[0].trim();
  const realIp = request.headers.get("X-Real-IP");
  if (realIp && realIp.trim()) return realIp.trim();
  return "unknown";
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

const TEMPLATE_ALIASES = {
  RECIPIENT_NAME: ["recipient_name", "full_name", "FULL_NAME"],
  recipient_name: ["RECIPIENT_NAME", "full_name", "FULL_NAME"],
  FULL_NAME: ["full_name", "recipient_name", "RECIPIENT_NAME"],
  full_name: ["FULL_NAME", "recipient_name", "RECIPIENT_NAME"],
  EMAIL: ["email"],
  email: ["EMAIL"],
  REQUEST_ID: ["request_id", "code", "application_code", "APPLICATION_ID", "ticket_code", "campaign_code"],
  request_id: ["REQUEST_ID", "code", "application_code", "APPLICATION_ID", "ticket_code"],
  APPLICATION_ID: ["code", "application_code", "request_id", "REQUEST_ID"],
  application_code: ["code", "APPLICATION_ID", "REQUEST_ID", "request_id"],
  code: ["APPLICATION_ID", "application_code", "REQUEST_ID", "request_id"],
  REGISTRATION_TYPE: ["registration_type", "form_name", "program_name", "APPLICATION_TYPE", "subject"],
  registration_type: ["REGISTRATION_TYPE", "form_name", "program_name", "APPLICATION_TYPE"],
  APPLICATION_TYPE: ["form_name", "program_name", "REGISTRATION_TYPE", "registration_type"],
  form_name: ["APPLICATION_TYPE", "program_name", "REGISTRATION_TYPE", "registration_type"],
  program_name: ["form_name", "APPLICATION_TYPE", "REGISTRATION_TYPE", "registration_type"],
  SUBMITTED_AT: ["submitted_at"],
  submitted_at: ["SUBMITTED_AT"],
  STATUS: ["status", "application_status"],
  application_status: ["status", "STATUS"],
  status: ["STATUS", "application_status"],
  ADDITIONAL_INFO: ["additional_info", "note", "public_note", "reason"],
  additional_info: ["ADDITIONAL_INFO", "note", "public_note", "reason"],
  EMAIL_CATEGORY: ["email_category", "category"],
  email_category: ["EMAIL_CATEGORY", "category"],
  EMAIL_HEADING: ["email_heading", "heading", "title"],
  email_heading: ["EMAIL_HEADING", "heading", "title"],
  INTRO_TEXT: ["intro_text", "summary"],
  intro_text: ["INTRO_TEXT", "summary"],
  BODY_HTML: ["body_html", "note_block", "answers_table"],
  body_html: ["BODY_HTML", "note_block", "answers_table"],
  NEXT_STEPS: ["next_steps", "next_action"],
  next_steps: ["NEXT_STEPS", "next_action"],
  ACTION_URL: ["action_url", "link", "activation_link", "tracking_url"],
  action_url: ["ACTION_URL", "link", "activation_link", "tracking_url"],
  ACTION_LABEL: ["action_label"],
  action_label: ["ACTION_LABEL"],
  PREHEADER: ["preheader", "EMAIL_HEADING", "email_heading"],
  preheader: ["PREHEADER", "EMAIL_HEADING", "email_heading"],
  certificate_code: ["code", "REQUEST_ID", "request_id"],
  support_email: ["MAIL_SUPPORT"]
};

export function resolveTemplateVar(vars, k) {
  let val = vars[k];
  if (val === undefined || val === null || val === "") {
    const aliases = TEMPLATE_ALIASES[k] || [];
    for (const alt of aliases) {
      if (vars[alt] !== undefined && vars[alt] !== null && vars[alt] !== "") {
        val = vars[alt];
        break;
      }
    }
  }
  return val;
}

export function renderTemplate(
  template,
  vars = {},
  options = {}
) {
  const htmlEscape = !!options.htmlEscape;
  const rawKeys = options.rawKeys instanceof Set
    ? options.rawKeys
    : new Set(options.rawKeys || ["PROFILE_IMAGE_BLOCK", "answers_table", "note_block", "BODY_HTML", "body_html", "ATTACHMENTS_BLOCK"]);

  return String(template || "").replace(
    /\{\{([a-zA-Z0-9_]+)\}\}/g,
    (_, k) => {
      let val = resolveTemplateVar(vars, k);
      if (val === undefined || val === null) {
        if (k === "support_email") val = "support@skyfirst.io.vn";
        else val = "";
      }
      const str = String(val);
      if (rawKeys.has(k)) {
        return sanitizeControlledHtml(str);
      }
      if (htmlEscape) {
        return escapeHtml(str);
      }
      return str;
    }
  );
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

export const TRUSTED_SKYFIRST_ORIGINS = new Set([
  "https://app.skyfirst.io.vn",
  "https://ctt.skyfirst.io.vn",
  "https://skyfirst.io.vn",
  "https://tnv.skyfirst.io.vn",
  "https://sfec.skyfirst.io.vn",
  "https://slc.skyfirst.io.vn",
  "https://member.skyfirst.io.vn"
]);

export function isSafeSkyFirstUrl(rawUrl, baseOrigin = "https://app.skyfirst.io.vn") {
  const s = String(rawUrl || "").trim();
  if (!s) return false;
  if (s.startsWith("/") && !s.startsWith("//") && !s.includes("\\")) return true;
  try {
    const u = new URL(s, baseOrigin);
    if (u.protocol !== "https:" && !(u.protocol === "http:" && (u.hostname === "localhost" || u.hostname === "127.0.0.1"))) {
      return false;
    }
    if (u.hostname === "localhost" || u.hostname === "127.0.0.1") return true;
    return TRUSTED_SKYFIRST_ORIGINS.has(u.origin);
  } catch {
    return false;
  }
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

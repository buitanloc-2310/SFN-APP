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

/*
 * Cloudflare Workers hiện hỗ trợ PBKDF2 tối đa 100000 iterations
 * trong runtime đang sử dụng cho ứng dụng SFN.
 */
export async function pbkdf2(
  password,
  saltB64,
  iterations = 100000
) {
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
      salt: fromB64url(saltB64),
      iterations,
      hash: "SHA-256",
    },
    key,
    256
  );

  return b64url(new Uint8Array(bits));
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

export function renderTemplate(
  template,
  vars
) {
  return String(
    template || ""
  ).replace(
    /\{\{([a-zA-Z0-9_]+)\}\}/g,
    (_, k) =>
      String(vars[k] ?? "")
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
    return (
      new URL(origin).origin ===
      new URL(appUrl).origin
    );
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

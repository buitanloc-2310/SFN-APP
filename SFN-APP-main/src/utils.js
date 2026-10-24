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

export function isSafeSvgText(svgText) {
  const s = String(svgText || "").trim();
  if (!s.includes("<svg") || !s.includes("</svg>")) return false;
  const lower = s.toLowerCase();
  const forbidden = [
    "<script",
    "javascript:",
    "vbscript:",
    "data:text/html",
    "<foreignobject",
    "<iframe",
    "<embed",
    "<object",
    "onload=",
    "onerror=",
    "onclick=",
    "onmouseover=",
    "onfocus="
  ];
  return !forbidden.some((tok) => lower.includes(tok));
}

export function magicBytesOk(mime, bytes) {
  const b = new Uint8Array(bytes);
  const ascii = (a, n) => String.fromCharCode(...a.slice(0, n));
  if (mime === "image/jpeg") return b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  if (mime === "image/png") return b[0] === 0x89 && ascii(b.slice(1), 3) === "PNG";
  if (mime === "image/webp") return ascii(b, 4) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP";
  if (mime === "image/gif") return ascii(b, 4) === "GIF8";
  if (mime === "application/pdf") return ascii(b, 4) === "%PDF";
  if (mime === "image/svg+xml") {
    const textSample = new TextDecoder().decode(b).trimStart();
    return textSample.startsWith("<svg") || textSample.startsWith("<?xml") || textSample.includes("<svg");
  }
  if (mime && mime.includes("officedocument")) return b[0] === 0x50 && b[1] === 0x4b;
  return true;
}

function crc16CcittFalse(str) {
  let crc = 0xffff;
  for (let i = 0; i < str.length; i++) {
    crc ^= (str.charCodeAt(i) & 0xff) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) crc = ((crc << 1) ^ 0x1021) & 0xffff;
      else crc = (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function tlv(id, val) {
  const s = String(val ?? "");
  return `${id}${String(s.length).padStart(2, "0")}${s}`;
}

export const NAPAS_BANKS = [
  { bin: "970436", code: "VCB", short_name: "Vietcombank", name: "Ngân hàng TMCP Ngoại thương Việt Nam (Vietcombank)" },
  { bin: "970415", code: "ICB", short_name: "VietinBank", name: "Ngân hàng TMCP Công thương Việt Nam (VietinBank)" },
  { bin: "970418", code: "BIDV", short_name: "BIDV", name: "Ngân hàng TMCP Đầu tư và Phát triển Việt Nam (BIDV)" },
  { bin: "970405", code: "VBA", short_name: "Agribank", name: "Ngân hàng Nông nghiệp và Phát triển Nông thôn Việt Nam (Agribank)" },
  { bin: "970422", code: "MB", short_name: "MBBank", name: "Ngân hàng TMCP Quân đội (MB Bank)" },
  { bin: "970407", code: "TCB", short_name: "Techcombank", name: "Ngân hàng TMCP Kỹ thương Việt Nam (Techcombank)" },
  { bin: "970416", code: "ACB", short_name: "ACB", name: "Ngân hàng TMCP Á Châu (ACB)" },
  { bin: "970432", code: "VPB", short_name: "VPBank", name: "Ngân hàng TMCP Việt Nam Thịnh Vượng (VPBank)" },
  { bin: "970423", code: "TPB", short_name: "TPBank", name: "Ngân hàng TMCP Tiên Phong (TPBank)" },
  { bin: "970403", code: "STB", short_name: "Sacombank", name: "Ngân hàng TMCP Sài Gòn Thương Tín (Sacombank)" },
  { bin: "970437", code: "HDB", short_name: "HDBank", name: "Ngân hàng TMCP Phát triển TP. Hồ Chí Minh (HDBank)" },
  { bin: "970441", code: "VIB", short_name: "VIB", name: "Ngân hàng TMCP Quốc tế Việt Nam (VIB)" },
  { bin: "970443", code: "SHB", short_name: "SHB", name: "Ngân hàng TMCP Sài Gòn - Hà Nội (SHB)" },
  { bin: "970431", code: "EIB", short_name: "Eximbank", name: "Ngân hàng TMCP Xuất Nhập khẩu Việt Nam (Eximbank)" },
  { bin: "970426", code: "MSB", short_name: "MSB", name: "Ngân hàng TMCP Hàng Hải Việt Nam (MSB)" },
  { bin: "970448", code: "OCB", short_name: "OCB", name: "Ngân hàng TMCP Phương Đông (OCB)" },
  { bin: "970440", code: "SEAB", short_name: "SeABank", name: "Ngân hàng TMCP Đông Nam Á (SeABank)" },
  { bin: "970449", code: "LPB", short_name: "LPBank", name: "Ngân hàng TMCP Lộc Phát Việt Nam (LPBank)" }
];

export function resolveNapasBank({ bank_bin = "", bank_code = "", bank_name = "" } = {}) {
  const rawBin = String(bank_bin || "").replace(/\D/g, "").trim();
  const rawCode = String(bank_code || "").trim().toUpperCase();
  const rawName = String(bank_name || "").trim().toLowerCase();
  if (rawBin) {
    const byBin = NAPAS_BANKS.find(b => b.bin === rawBin);
    if (byBin) return byBin;
    if (/^9704\d{2}$/.test(rawBin)) {
      return { bin: rawBin, code: rawCode || "BANK", short_name: bank_name || rawCode || rawBin, name: bank_name || `Ngân hàng NAPAS (${rawBin})` };
    }
  }
  if (rawCode) {
    const byCode = NAPAS_BANKS.find(b => b.code === rawCode || b.short_name.toUpperCase() === rawCode);
    if (byCode) return byCode;
  }
  if (rawName) {
    const byName = NAPAS_BANKS.find(
      b =>
        b.short_name.toLowerCase() === rawName ||
        b.code.toLowerCase() === rawName ||
        b.name.toLowerCase().includes(rawName) ||
        rawName.includes(b.short_name.toLowerCase())
    );
    if (byName) return byName;
  }
  return null;
}

/**
 * Generates an EMVCo / NAPAS 247 VietQR compliant payload string without any donor PII.
 * Does NOT silently default to an arbitrary bank if bankBin or accountNo is missing.
 */
export function buildVietQrPayload({ bankBin = "", accountNo = "", amount = 0, referenceCode = "" }) {
  const cleanBin = String(bankBin || "").replace(/\D/g, "").slice(0, 6);
  const cleanAcc = String(accountNo || "").replace(/[^A-Za-z0-9]/g, "").slice(0, 24);
  const cleanRef = String(referenceCode || "").replace(/[^A-Za-z0-9 -]/g, "").slice(0, 50);
  const cleanAmt = Math.max(0, Math.round(Number(amount || 0)));
  if (!cleanBin || cleanBin.length !== 6 || !cleanAcc) {
    return "";
  }
  const beneficiary = tlv("00", cleanBin) + tlv("01", cleanAcc);
  const merchantAccountInfo = tlv("00", "A000000727") + tlv("01", beneficiary) + tlv("02", "QRIBFTTA");
  const additionalData = tlv("08", cleanRef);
  const bodyWithoutCrc =
    tlv("00", "01") +
    tlv("01", cleanAmt > 0 ? "12" : "11") +
    tlv("38", merchantAccountInfo) +
    tlv("53", "704") +
    (cleanAmt > 0 ? tlv("54", String(cleanAmt)) : "") +
    tlv("58", "VN") +
    tlv("62", additionalData) +
    "6304";
  return bodyWithoutCrc + crc16CcittFalse(bodyWithoutCrc);
}

// ISO/IEC 18004 Standard QR Code Matrix Generator (Byte mode, ECC Level L, Versions 1..10)
const QR_CAP_L = [0, 17, 32, 53, 78, 106, 134, 154, 192, 230, 271];
const QR_TOTAL_CW = [0, 26, 44, 70, 100, 134, 172, 196, 242, 292, 346];
const QR_EC_PER_BLK_L = [0, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18];
const QR_NUM_BLKS_L = [0, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4];
const QR_ALIGN_POS = [
  [], [], [6, 18], [6, 22], [6, 26], [6, 30],
  [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]
];

const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255];
})();

function gfMul(a, b) {
  return (a === 0 || b === 0) ? 0 : GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

function rsGeneratorDivisor(degree) {
  const result = new Uint8Array(degree);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) {
      result[j] = gfMul(result[j], root);
      if (j + 1 < degree) result[j] ^= result[j + 1];
    }
    root = gfMul(root, 0x02);
  }
  return result;
}

function rsComputeEcc(data, degree) {
  const divisor = rsGeneratorDivisor(degree);
  const result = new Uint8Array(degree);
  for (const b of data) {
    const factor = b ^ result[0];
    result.copyWithin(0, 1);
    result[degree - 1] = 0;
    for (let i = 0; i < degree; i++) {
      result[i] ^= gfMul(divisor[i], factor);
    }
  }
  return result;
}

export function encodeQrMatrix(text) {
  const bytes = new TextEncoder().encode(String(text || ""));
  let ver = 1;
  while (ver <= 10 && bytes.length > QR_CAP_L[ver]) ver++;
  if (ver > 10) ver = 10;
  const maxCap = QR_CAP_L[ver];
  const payload = bytes.length > maxCap ? bytes.slice(0, maxCap) : bytes;

  const totalCw = QR_TOTAL_CW[ver];
  const ecPerBlk = QR_EC_PER_BLK_L[ver];
  const numBlks = QR_NUM_BLKS_L[ver];
  const totalDataCw = totalCw - ecPerBlk * numBlks;

  const bits = [];
  const pushBits = (val, len) => {
    for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1);
  };
  pushBits(0b0100, 4);
  pushBits(payload.length, ver <= 9 ? 8 : 16);
  for (const b of payload) pushBits(b, 8);
  const maxBits = totalDataCw * 8;
  for (let i = 0; i < 4 && bits.length < maxBits; i++) bits.push(0);
  while (bits.length % 8 !== 0) bits.push(0);
  const dataCw = new Uint8Array(totalDataCw);
  for (let i = 0; i < bits.length / 8; i++) {
    let b = 0;
    for (let j = 0; j < 8; j++) b = (b << 1) | bits[i * 8 + j];
    dataCw[i] = b;
  }
  let padIdx = bits.length / 8;
  let toggle = true;
  while (padIdx < totalDataCw) {
    dataCw[padIdx++] = toggle ? 0xec : 0x11;
    toggle = !toggle;
  }

  const dataBlocks = [];
  const eccBlocks = [];
  const baseBlkLen = Math.floor(totalDataCw / numBlks);
  const extraBlks = totalDataCw % numBlks;
  let offset = 0;
  for (let b = 0; b < numBlks; b++) {
    const len = baseBlkLen + (b >= numBlks - extraBlks ? 1 : 0);
    const blk = dataCw.slice(offset, offset + len);
    offset += len;
    dataBlocks.push(blk);
    eccBlocks.push(rsComputeEcc(blk, ecPerBlk));
  }

  const finalCw = [];
  const maxDataLen = baseBlkLen + (extraBlks > 0 ? 1 : 0);
  for (let i = 0; i < maxDataLen; i++) {
    for (let b = 0; b < numBlks; b++) {
      if (i < dataBlocks[b].length) finalCw.push(dataBlocks[b][i]);
    }
  }
  for (let i = 0; i < ecPerBlk; i++) {
    for (let b = 0; b < numBlks; b++) {
      finalCw.push(eccBlocks[b][i]);
    }
  }

  const size = ver * 4 + 17;
  const grid = Array.from({ length: size }, () => new Uint8Array(size));
  const isFunc = Array.from({ length: size }, () => new Uint8Array(size));

  const setFunctionModule = (r, c, dark) => {
    if (r < 0 || r >= size || c < 0 || c >= size) return;
    grid[r][c] = dark ? 1 : 0;
    isFunc[r][c] = 1;
  };

  for (let i = 0; i < size; i++) {
    setFunctionModule(6, i, i % 2 === 0);
    setFunctionModule(i, 6, i % 2 === 0);
  }

  const drawFinder = (r0, c0) => {
    for (let dr = -1; dr <= 7; dr++) {
      for (let dc = -1; dc <= 7; dc++) {
        const r = r0 + dr, c = c0 + dc;
        if (r < 0 || r >= size || c < 0 || c >= size) continue;
        const inOuter = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6 && (dr === 0 || dr === 6 || dc === 0 || dc === 6);
        const inInner = dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4;
        setFunctionModule(r, c, inOuter || inInner);
      }
    }
  };
  drawFinder(0, 0);
  drawFinder(0, size - 7);
  drawFinder(size - 7, 0);

  const alignCoords = QR_ALIGN_POS[ver];
  for (let i = 0; i < alignCoords.length; i++) {
    for (let j = 0; j < alignCoords.length; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === alignCoords.length - 1) || (i === alignCoords.length - 1 && j === 0)) continue;
      const rc = alignCoords[i], cc = alignCoords[j];
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const dark = Math.max(Math.abs(dr), Math.abs(dc)) !== 1;
          setFunctionModule(rc + dr, cc + dc, dark);
        }
      }
    }
  }

  setFunctionModule(size - 8, 8, true);
  for (let i = 0; i <= 8; i++) {
    if (!isFunc[8][i]) setFunctionModule(8, i, false);
    if (!isFunc[i][8]) setFunctionModule(i, 8, false);
  }
  for (let i = 0; i < 8; i++) {
    if (!isFunc[8][size - 1 - i]) setFunctionModule(8, size - 1 - i, false);
    if (!isFunc[size - 1 - i][8]) setFunctionModule(size - 1 - i, 8, false);
  }
  if (ver >= 7) {
    let rem = ver;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const vBits = (ver << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const bit = ((vBits >>> i) & 1) !== 0;
      const a = size - 11 + (i % 3), b = Math.floor(i / 3);
      setFunctionModule(a, b, bit);
      setFunctionModule(b, a, bit);
    }
  }

  const maskFns = [
    (r, c) => (r + c) % 2 === 0,
    (r, c) => r % 2 === 0,
    (r, c) => c % 3 === 0,
    (r, c) => (r + c) % 3 === 0,
    (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
    (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
    (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
    (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0
  ];

  const rawGrid = grid.map(row => new Uint8Array(row));
  let bitIdx = 0;
  const totalBits = finalCw.length * 8;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const c = right - j;
        const upward = ((right + 1) & 2) === 0;
        const r = upward ? size - 1 - vert : vert;
        if (!isFunc[r][c]) {
          let dark = false;
          if (bitIdx < totalBits) {
            dark = ((finalCw[bitIdx >>> 3] >>> (7 - (bitIdx & 7))) & 1) !== 0;
            bitIdx++;
          }
          rawGrid[r][c] = dark ? 1 : 0;
        }
      }
    }
  }

  const writeFormatBits = (targetGrid, maskIdx) => {
    const fmtData = (0b01 << 3) | maskIdx;
    let fmtRem = fmtData;
    for (let i = 0; i < 10; i++) fmtRem = (fmtRem << 1) ^ ((fmtRem >>> 9) * 0x537);
    const fmtBits = ((fmtData << 10) | fmtRem) ^ 0x5412;
    const put = (r, c, dark) => { targetGrid[r][c] = dark ? 1 : 0; };
    for (let i = 0; i <= 5; i++) put(i, 8, ((fmtBits >>> i) & 1) !== 0);
    put(7, 8, ((fmtBits >>> 6) & 1) !== 0);
    put(8, 8, ((fmtBits >>> 7) & 1) !== 0);
    put(8, 7, ((fmtBits >>> 8) & 1) !== 0);
    for (let i = 9; i < 15; i++) put(8, 14 - i, ((fmtBits >>> i) & 1) !== 0);
    for (let i = 0; i < 8; i++) put(8, size - 1 - i, ((fmtBits >>> i) & 1) !== 0);
    for (let i = 8; i < 15; i++) put(size - 15 + i, 8, ((fmtBits >>> i) & 1) !== 0);
    put(size - 8, 8, true);
  };

  const penaltyScore = (g) => {
    let score = 0;
    for (let r = 0; r < size; r++) {
      let runColor = g[r][0], runLen = 1;
      for (let c = 1; c < size; c++) {
        if (g[r][c] === runColor) {
          runLen++;
          if (runLen === 5) score += 3;
          else if (runLen > 5) score += 1;
        } else { runColor = g[r][c]; runLen = 1; }
      }
    }
    for (let c = 0; c < size; c++) {
      let runColor = g[0][c], runLen = 1;
      for (let r = 1; r < size; r++) {
        if (g[r][c] === runColor) {
          runLen++;
          if (runLen === 5) score += 3;
          else if (runLen > 5) score += 1;
        } else { runColor = g[r][c]; runLen = 1; }
      }
    }
    for (let r = 0; r < size - 1; r++) {
      for (let c = 0; c < size - 1; c++) {
        const v = g[r][c];
        if (v === g[r][c + 1] && v === g[r + 1][c] && v === g[r + 1][c + 1]) score += 3;
      }
    }
    return score;
  };

  let bestScore = Infinity, bestGrid = null;
  for (let m = 1; m < 8; m++) {
    const cand = rawGrid.map(row => new Uint8Array(row));
    const fn = maskFns[m];
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (!isFunc[r][c] && fn(r, c)) cand[r][c] ^= 1;
      }
    }
    writeFormatBits(cand, m);
    const sc = penaltyScore(cand);
    if (sc < bestScore) { bestScore = sc; bestGrid = cand; }
  }

  return { size, grid: bestGrid };
}

/**
 * Generates a real, ISO/IEC 18004 standard scannable SVG QR code data URI locally
 * (zero external PII leak, works 100% offline, decodable by any banking app or QR scanner).
 */
export function buildLocalQrSvgDataUrl(payloadText, label = "VIETQR SKY FIRST") {
  const seedStr = String(payloadText || "").trim();
  if (!seedStr) return "";
  const { size, grid } = encodeQrMatrix(seedStr);
  const cell = 8;
  const pad = 32;
  const totalW = size * cell + pad * 2;
  const totalH = totalW + (label ? 28 : 0);
  let pathData = "";
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (grid[r][c]) {
        const x = pad + c * cell;
        const y = pad + r * cell;
        pathData += `M${x},${y}h${cell}v${cell}h-${cell}z`;
      }
    }
  }
  const safeLabel = escapeHtml(String(label || "").slice(0, 42));
  const labelSvg = safeLabel
    ? `<text x="${totalW / 2}" y="${totalH - 12}" text-anchor="middle" font-family="Inter,Arial,sans-serif" font-size="11" font-weight="700" fill="#0759b8">${safeLabel}</text>`
    : "";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalW} ${totalH}" width="320" height="${Math.round(320 * (totalH / totalW))}" shape-rendering="crispEdges"><rect width="100%" height="100%" rx="12" fill="#ffffff" stroke="#dbe6f3" stroke-width="2"/><path d="${pathData}" fill="#000000"/>${labelSvg}</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
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
      "https://ctt.skyfirst.io.vn",
      "https://skyfirst.io.vn",
      "https://member.skyfirst.io.vn",
      "https://sfec.skyfirst.io.vn",
      "https://exam.skyfirst.io.vn",
      "https://mail.skyfirst.io.vn"
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

// Xác minh JWT của Cloudflare Access (header Cf-Access-Jwt-Assertion): chữ ký RS256 theo khóa công khai ở
// https://<team>.cloudflareaccess.com/cdn-cgi/access/certs, aud của ứng dụng admin, iss, hạn dùng. Chỉ dùng WebCrypto,
// không thư viện ngoài, nên chạy được cả trong Worker lẫn Node (test/jwt.test.ts).

export interface AccessClaims {
  email: string;
  aud: string[];
  iss: string;
  exp: number;
  iat?: number;
  nbf?: number;
  sub?: string;
}

export type VerifyResult = { ok: true; claims: AccessClaims } | { ok: false; reason: string };

export interface VerifyOptions {
  /** Team domain, ví dụ "thienhoangky.cloudflareaccess.com" (không có https://). */
  teamDomain: string;
  /** AUD tag của ứng dụng Access. */
  aud: string;
  /** Lấy bộ khóa JWKS; mặc định fetch theo teamDomain. Test truyền hàm riêng. */
  loadKeys?: (force: boolean) => Promise<JsonWebKey[]>;
  /** Giây hiện tại; test truyền vào. */
  now?: number;
}

/** Lệch giờ chấp nhận giữa edge Access và Worker. */
const SKEW_S = 60;

function b64urlToBytes(s: string): Uint8Array<ArrayBuffer> {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function decodeJson(part: string): unknown {
  return JSON.parse(new TextDecoder().decode(b64urlToBytes(part)));
}

// Bộ nhớ khóa theo team domain, sống theo isolate. Hết 10 phút hoặc gặp kid lạ thì tải lại một lần.
const KEY_TTL_MS = 10 * 60 * 1000;
const keyCache = new Map<string, { at: number; keys: JsonWebKey[] }>();

export function certsUrl(teamDomain: string): string {
  return `https://${teamDomain}/cdn-cgi/access/certs`;
}

async function fetchKeys(url: string, force: boolean): Promise<JsonWebKey[]> {
  const hit = keyCache.get(url);
  if (!force && hit && Date.now() - hit.at < KEY_TTL_MS) return hit.keys;
  const res = await fetch(url, { cf: { cacheTtl: 300 } } as RequestInit);
  if (!res.ok) throw new Error(`certs ${res.status}`);
  const body = (await res.json()) as { keys?: JsonWebKey[] };
  const keys = Array.isArray(body.keys) ? body.keys : [];
  keyCache.set(url, { at: Date.now(), keys });
  return keys;
}

export function defaultKeyLoader(url: string): (force: boolean) => Promise<JsonWebKey[]> {
  return (force) => fetchKeys(url, force);
}

export async function verifyAccessJwt(token: string, opt: VerifyOptions): Promise<VerifyResult> {
  if (!opt.teamDomain || !opt.aud) return { ok: false, reason: "chưa cấu hình ACCESS_TEAM_DOMAIN hoặc ACCESS_AUD" };
  const parts = token.split(".");
  if (parts.length !== 3) return { ok: false, reason: "JWT sai dạng" };
  let header: { alg?: string; kid?: string };
  let payload: Record<string, unknown>;
  try {
    header = decodeJson(parts[0]) as typeof header;
    payload = decodeJson(parts[1]) as Record<string, unknown>;
  } catch {
    return { ok: false, reason: "JWT không đọc được" };
  }
  if (header.alg !== "RS256") return { ok: false, reason: "alg không phải RS256" };

  const load = opt.loadKeys ?? defaultKeyLoader(certsUrl(opt.teamDomain));
  let keys: JsonWebKey[];
  try {
    keys = await load(false);
    if (!keys.some((k) => (k as { kid?: string }).kid === header.kid)) keys = await load(true);
  } catch {
    return { ok: false, reason: "không tải được khóa Access" };
  }
  const jwk = keys.find((k) => (k as { kid?: string }).kid === header.kid);
  if (!jwk) return { ok: false, reason: "kid lạ" };

  let valid = false;
  try {
    const key = await crypto.subtle.importKey("jwk", { ...jwk, alg: "RS256", ext: true }, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
    const data = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
    valid = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, b64urlToBytes(parts[2]), data);
  } catch {
    valid = false;
  }
  if (!valid) return { ok: false, reason: "chữ ký sai" };

  const now = opt.now ?? Math.floor(Date.now() / 1000);
  const aud = Array.isArray(payload.aud) ? (payload.aud as unknown[]).map(String) : typeof payload.aud === "string" ? [payload.aud] : [];
  if (!aud.includes(opt.aud)) return { ok: false, reason: "aud không khớp ứng dụng admin" };
  if (payload.iss !== `https://${opt.teamDomain}`) return { ok: false, reason: "iss không khớp team" };
  if (typeof payload.exp !== "number" || payload.exp + SKEW_S < now) return { ok: false, reason: "JWT hết hạn" };
  if (typeof payload.nbf === "number" && payload.nbf - SKEW_S > now) return { ok: false, reason: "JWT chưa tới hạn dùng" };
  if (typeof payload.iat === "number" && payload.iat - SKEW_S > now) return { ok: false, reason: "JWT phát hành ở tương lai" };
  // Service token của Access không có email: không phải người, không vào được admin.
  if (typeof payload.email !== "string" || !payload.email.includes("@")) return { ok: false, reason: "JWT không có email" };

  return {
    ok: true,
    claims: {
      email: normalizeEmail(payload.email),
      aud,
      iss: payload.iss,
      exp: payload.exp,
      iat: typeof payload.iat === "number" ? payload.iat : undefined,
      nbf: typeof payload.nbf === "number" ? payload.nbf : undefined,
      sub: typeof payload.sub === "string" ? payload.sub : undefined,
    },
  };
}

export function normalizeEmail(e: string): string {
  return e.trim().toLowerCase();
}

/** Email hợp lệ đủ dùng cho danh sách mời và phân quyền (không cố bắt mọi trường hợp RFC 5322). */
export function isEmail(e: string): boolean {
  return /^[^\s@,;<>"]+@[^\s@,;<>"]+\.[^\s@,;<>"]+$/.test(e) && e.length <= 254;
}

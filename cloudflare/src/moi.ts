// Cổng link mời của bản chơi thử: https://thienhoangky.fun/moi/<ma> cấp cookie `thk_moi` (thẻ ngẫu nhiên 256 bit).
// D1 chỉ giữ SHA-256 của thẻ, nên lộ bảng cũng không giả được cookie. Các hàm ở đây thuần (chỉ WebCrypto), test bằng node --test.

export const COOKIE = "thk_moi";
/** 180 ngày. Tiến độ game nằm trong trình duyệt, nên cookie sống lâu như tiến độ. */
export const COOKIE_GIAY = 180 * 24 * 3600;
export const MA_MOI = /^[a-z0-9-]{6,40}$/;

const B32 = "abcdefghjkmnpqrstuvwxyz23456789"; // bỏ i, l, o, 0, 1 để đọc không nhầm

function ngauNhien(n: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(n));
}

function base64url(b: Uint8Array): string {
  let s = "";
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Chuỗi ngẫu nhiên đọc được (cho id người chơi và mã link). */
export function maDoc(dai: number): string {
  let s = "";
  for (const x of ngauNhien(dai)) s += B32[x % B32.length];
  return s;
}

/** Thẻ cookie: 32 byte ngẫu nhiên. */
export function taoThe(): string {
  return base64url(ngauNhien(32));
}

export async function bamThe(the: string): Promise<string> {
  const h = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(the)));
  return [...h].map((x) => x.toString(16).padStart(2, "0")).join("");
}

/** Lấy thẻ từ header Cookie; sai dạng thì null. */
export function docThe(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    if (part.slice(0, i).trim() !== COOKIE) continue;
    const v = part.slice(i + 1).trim();
    return /^[A-Za-z0-9_-]{43}$/.test(v) ? v : null;
  }
  return null;
}

export function datCookie(the: string): string {
  return `${COOKIE}=${the}; Path=/; Max-Age=${COOKIE_GIAY}; HttpOnly; Secure; SameSite=Lax`;
}

export function chuanMa(raw: string): string | null {
  let m: string;
  try {
    m = decodeURIComponent(raw).trim().toLowerCase();
  } catch {
    return null;
  }
  return MA_MOI.test(m) ? m : null;
}

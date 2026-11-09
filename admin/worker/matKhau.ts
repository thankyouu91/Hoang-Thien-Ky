// Băm và kiểm mật khẩu bằng PBKDF2-SHA256 (WebCrypto), chạy được cả trong Worker lẫn Node (scripts/tao-tai-khoan.ts, test).
// Dạng lưu: "pbkdf2_sha256$<số vòng>$<muối base64url>$<băm base64url>". Số vòng nằm trong chuỗi, nên đổi VONG về sau
// không làm hỏng mật khẩu cũ; lần đăng nhập đúng kế tiếp sẽ băm lại theo VONG mới.

/** Gói Workers Free cho 10 ms CPU mỗi yêu cầu; 30.000 vòng tốn khoảng 5 ms. Lên gói trả phí thì nâng tới 100.000 (trần của workerd). */
export const VONG = 30_000;
const DAI_BAM = 32;

function b64u(b: Uint8Array): string {
  let s = "";
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function tuB64u(s: string): Uint8Array<ArrayBuffer> {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function pbkdf2(matKhau: string, muoi: Uint8Array<ArrayBuffer>, vong: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(matKhau), "PBKDF2", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: muoi, iterations: vong }, key, DAI_BAM * 8));
}

export async function bamMatKhau(matKhau: string, vong = VONG): Promise<string> {
  const muoi = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2_sha256$${vong}$${b64u(muoi)}$${b64u(await pbkdf2(matKhau, muoi, vong))}`;
}

/** So khớp thời gian không đổi. Chuỗi lưu hỏng thì trả false. */
export async function kiemMatKhau(matKhau: string, luu: string): Promise<boolean> {
  const p = luu.split("$");
  if (p.length !== 4 || p[0] !== "pbkdf2_sha256") return false;
  const vong = Number(p[1]);
  if (!Number.isInteger(vong) || vong < 1000 || vong > 100_000) return false;
  const can = tuB64u(p[3]);
  const co = await pbkdf2(matKhau, tuB64u(p[2]), vong);
  if (co.length !== can.length) return false;
  let khac = 0;
  for (let i = 0; i < co.length; i++) khac |= co[i] ^ can[i];
  return khac === 0;
}

export function vongCua(luu: string): number {
  return Number(luu.split("$")[1]) || 0;
}

/** Băm mẫu để kiểm tốn đúng chừng ấy CPU khi tên đăng nhập không có (không lộ tên nào tồn tại qua thời gian trả lời). */
export const BAM_GIA = "pbkdf2_sha256$30000$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

/** Mật khẩu tạm ngẫu nhiên, bỏ các chữ dễ nhầm (l, I, O, 0, 1). */
export function matKhauNgauNhien(dai = 16): string {
  const chu = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const b = crypto.getRandomValues(new Uint8Array(dai * 2));
  let s = "";
  // Bỏ byte ≥ 228 (= 4 × 57) để mỗi chữ có cùng xác suất.
  for (const x of b) if (x < 228 && s.length < dai) s += chu[x % chu.length];
  return s.length === dai ? s : matKhauNgauNhien(dai);
}

/** Luật mật khẩu người dùng tự đặt. Trả lỗi tiếng Việt hoặc null. */
export function loiMatKhauMoi(ten: string, moi: string, cu?: string): string | null {
  if (moi.length < 12) return "Mật khẩu mới dài ít nhất 12 ký tự.";
  if (moi.length > 200) return "Mật khẩu mới dài tối đa 200 ký tự.";
  if (moi.toLowerCase().includes(ten.toLowerCase())) return "Mật khẩu mới không được chứa tên đăng nhập.";
  if (cu !== undefined && moi === cu) return "Mật khẩu mới phải khác mật khẩu cũ.";
  if (new Set(moi).size < 5) return "Mật khẩu mới quá đơn điệu.";
  return null;
}

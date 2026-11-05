// Đăng nhập admin bằng tên + mật khẩu (người dùng chốt 2026-11-05, thay cho Access theo email).
//   - Mật khẩu: PBKDF2-SHA256 có muối (matKhau.ts). Không lưu, không log mật khẩu thô.
//   - Phiên: mã ngẫu nhiên 32 byte trong cookie __Host-qt (HttpOnly, Secure, SameSite=Strict, Path=/); D1 chỉ giữ SHA-256 của mã.
//     Hết hạn sau 12 giờ, đăng xuất hoặc đổi mật khẩu thì xóa.
//   - Chống dò mật khẩu: sai 5 lần liền thì tạm khóa tài khoản 15 phút; mỗi IP sai quá 20 lần trong 15 phút thì trả 429.
//   - Lần đầu (hoặc sau khi Admin đặt lại): phai_doi = 1, server chỉ cho đổi mật khẩu, xem mình và đăng xuất.

import type { VaiTro } from "../shared/hopDong.ts";
import { BAM_GIA, VONG, bamMatKhau, kiemMatKhau, vongCua } from "./matKhau.ts";

export const COOKIE = "__Host-qt";
export const PHIEN_MS = 12 * 3600 * 1000;
const SAI_TOI_DA = 5;
const TAM_KHOA_MS = 15 * 60 * 1000;
const IP_SAI_TOI_DA = 20;
const IP_CUA_SO_MS = 15 * 60 * 1000;

export interface Phien {
  ten: string;
  vaiTro: VaiTro;
  phaiDoi: boolean;
  hetHan: number;
  maBam: string;
  email: string | null;
}

export async function sha256hex(s: string): Promise<string> {
  const h = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
  return [...h].map((x) => x.toString(16).padStart(2, "0")).join("");
}

export function b64u(b: Uint8Array): string {
  let s = "";
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function docCookie(req: Request): string | null {
  const c = req.headers.get("Cookie") ?? "";
  for (const phan of c.split(";")) {
    const [k, ...v] = phan.trim().split("=");
    if (k === COOKIE) {
      const ma = v.join("=");
      return /^[A-Za-z0-9_-]{43}$/.test(ma) ? ma : null;
    }
  }
  return null;
}

export function cookieDat(ma: string): string {
  return `${COOKIE}=${ma}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${PHIEN_MS / 1000}`;
}
export function cookieXoa(): string {
  return `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

/** Tìm phiên còn hạn của tài khoản chưa bị khóa. Phiên hết hạn thì xóa luôn. */
export async function layPhien(db: D1Database, req: Request): Promise<Phien | null> {
  const ma = docCookie(req);
  if (!ma) return null;
  const maBam = await sha256hex(ma);
  const r = await db
    .prepare("SELECT p.ten, p.het_han, t.vai_tro, t.phai_doi, t.khoa, t.email FROM qt_phien p JOIN qt_tai_khoan t ON t.ten = p.ten WHERE p.ma_bam = ?")
    .bind(maBam)
    .first<{ ten: string; het_han: number; vai_tro: VaiTro; phai_doi: number; khoa: number; email: string | null }>();
  if (!r) return null;
  if (r.het_han <= Date.now() || r.khoa === 1) {
    await db.prepare("DELETE FROM qt_phien WHERE ma_bam = ?").bind(maBam).run();
    return null;
  }
  return { ten: r.ten, vaiTro: r.vai_tro, phaiDoi: r.phai_doi === 1, hetHan: r.het_han, maBam, email: r.email ?? null };
}

export async function taoPhien(db: D1Database, ten: string, thietBi: string | null): Promise<{ ma: string; hetHan: number }> {
  const ma = b64u(crypto.getRandomValues(new Uint8Array(32)));
  const now = Date.now();
  const hetHan = now + PHIEN_MS;
  await db.batch([
    // Dọn phiên đã hết hạn của mọi tài khoản (bảng nhỏ, chạy mỗi lần đăng nhập là đủ).
    db.prepare("DELETE FROM qt_phien WHERE het_han <= ?").bind(now),
    db.prepare("INSERT INTO qt_phien (ma_bam, ten, tao_luc, het_han, thiet_bi) VALUES (?, ?, ?, ?, ?)").bind(await sha256hex(ma), ten, now, hetHan, thietBi),
  ]);
  return { ma, hetHan };
}

// ---- Chặn theo IP (dùng chung cho đăng nhập, quên mật khẩu, đặt lại) ----------------------------------------------

/** IP đã sai quá IP_SAI_TOI_DA lần trong IP_CUA_SO_MS thì chặn (429). IP chỉ lưu dạng băm. */
export async function ipBiChan(db: D1Database, ip: string, now = Date.now()): Promise<boolean> {
  const r = await db.prepare("SELECT so_lan, tu_luc FROM qt_dang_nhap_sai WHERE ip_bam = ?").bind(await sha256hex(`qt-ip|${ip}`)).first<{ so_lan: number; tu_luc: number }>();
  return Boolean(r && now - r.tu_luc < IP_CUA_SO_MS && r.so_lan >= IP_SAI_TOI_DA);
}

/** Cộng một lần sai cho IP (cửa sổ 15 phút tính từ lần sai đầu). */
export async function ghiIpSai(db: D1Database, ip: string, now = Date.now()): Promise<D1PreparedStatement> {
  const ipBam = await sha256hex(`qt-ip|${ip}`);
  return db
    .prepare(
      "INSERT INTO qt_dang_nhap_sai (ip_bam, so_lan, tu_luc) VALUES (?, 1, ?) ON CONFLICT(ip_bam) DO UPDATE SET so_lan = CASE WHEN ? - qt_dang_nhap_sai.tu_luc < ? THEN qt_dang_nhap_sai.so_lan + 1 ELSE 1 END, tu_luc = CASE WHEN ? - qt_dang_nhap_sai.tu_luc < ? THEN qt_dang_nhap_sai.tu_luc ELSE excluded.tu_luc END",
    )
    .bind(ipBam, now, now, IP_CUA_SO_MS, now, IP_CUA_SO_MS);
}

export const LOI_IP = "Sai quá nhiều lần từ máy này. Thử lại sau 15 phút.";

export type KetQuaDangNhap =
  | { ok: true; ten: string }
  | { ok: false; status: 401 | 403 | 429; loi: string };

/** Kiểm tên + mật khẩu, đếm sai theo tài khoản và theo IP. Mọi nhánh sai trả cùng một câu, trừ khi bị tạm khóa. */
export async function dangNhap(db: D1Database, tenVao: string, matKhau: string, ip: string): Promise<KetQuaDangNhap> {
  const now = Date.now();
  const ten = tenVao.trim().toLowerCase();
  const sai = { ok: false as const, status: 401 as const, loi: "Sai tên đăng nhập hoặc mật khẩu." };

  if (await ipBiChan(db, ip, now)) return { ok: false, status: 429, loi: LOI_IP };

  const tk = await db
    .prepare("SELECT ten, mat_khau, khoa, sai_lien_tiep, tam_khoa_den FROM qt_tai_khoan WHERE ten = ?")
    .bind(ten)
    .first<{ ten: string; mat_khau: string; khoa: number; sai_lien_tiep: number; tam_khoa_den: number | null }>();

  if (tk?.tam_khoa_den && tk.tam_khoa_den > now) {
    const phut = Math.ceil((tk.tam_khoa_den - now) / 60000);
    return { ok: false, status: 429, loi: `Tài khoản tạm khóa vì sai mật khẩu nhiều lần. Thử lại sau ${phut} phút.` };
  }

  // Tên không có thì vẫn băm một lần, để thời gian trả lời như khi có tên.
  const dung = tk ? await kiemMatKhau(matKhau, tk.mat_khau) : (await kiemMatKhau(matKhau, BAM_GIA), false);

  if (!dung) {
    const stmts = [await ghiIpSai(db, ip, now)];
    if (tk) {
      const lan = tk.sai_lien_tiep + 1;
      stmts.push(
        lan >= SAI_TOI_DA
          ? db.prepare("UPDATE qt_tai_khoan SET sai_lien_tiep = 0, tam_khoa_den = ? WHERE ten = ?").bind(now + TAM_KHOA_MS, tk.ten)
          : db.prepare("UPDATE qt_tai_khoan SET sai_lien_tiep = ? WHERE ten = ?").bind(lan, tk.ten),
      );
    }
    await db.batch(stmts);
    return sai;
  }

  // Đúng mật khẩu (tk chắc chắn có).
  const t = tk!;
  if (t.khoa === 1) return { ok: false, status: 403, loi: "Tài khoản này đã bị Admin khóa." };
  const stmts = [db.prepare("UPDATE qt_tai_khoan SET sai_lien_tiep = 0, tam_khoa_den = NULL, dang_nhap_cuoi = ? WHERE ten = ?").bind(now, t.ten)];
  // Băm lại khi số vòng đã nâng (VONG trong matKhau.ts).
  if (vongCua(t.mat_khau) < VONG) stmts.push(db.prepare("UPDATE qt_tai_khoan SET mat_khau = ? WHERE ten = ?").bind(await bamMatKhau(matKhau), t.ten));
  await db.batch(stmts);
  return { ok: true, ten: t.ten };
}

/** User-Agent rút gọn để Admin nhận ra phiên (không lưu IP). */
export function thietBi(req: Request): string | null {
  const ua = req.headers.get("User-Agent") ?? "";
  if (!ua) return null;
  const tb = /iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows" : /Mac OS/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "Khác";
  const tr = /Edg\//.test(ua) ? "Edge" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "trình duyệt khác";
  return `${tb} · ${tr}`;
}

/** Tên đăng nhập hợp lệ: 3–32 ký tự a-z, 0-9, dấu chấm, gạch dưới, gạch ngang; viết thường. */
export function tenHopLe(ten: string): boolean {
  return /^[a-z0-9._-]{3,32}$/.test(ten);
}

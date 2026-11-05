// Worker thienhoangky-admin: phục vụ giao diện admin (Static Assets) và API /api/* ở admin.thienhoangky.fun.
// Đăng nhập bằng tên + mật khẩu (taiKhoan.ts); vai trò Admin / Vận hành lưu ở qt_tai_khoan; quyền chặn ở đây,
// giao diện chỉ ẩn nút cho gọn. Lớp Cloudflare Access bên ngoài là tùy chọn (đặt ACCESS_TEAM_DOMAIN + ACCESS_AUD).
// Không log mật khẩu, mã phiên hay thân yêu cầu. Người chơi thử không có email: nhận diện bằng mã nguoi_choi_thu.id.

import type { LichSuCauHinh, MatKhauTam, MucThongBao, NhatKy, TaiKhoan, ThamSo, ThongBao, Toi, TrangThaiPhanHoi, VaiTro } from "../shared/hopDong.ts";
import { THAM_SO, kiemGiaTri } from "./cauHinh.ts";
import type { Env } from "./env.ts";
import { linkGoc, teamDomain } from "./env.ts";
import { defaultKeyLoader, certsUrl, verifyAccessJwt } from "./jwt.ts";
import { bamMatKhau, kiemMatKhau, loiMatKhauMoi, matKhauNgauNhien } from "./matKhau.ts";
import { coPhanHoi, dsNguoiChoi, dsPhanHoi, dsSuKien, thieuBang, tongQuan } from "./nguonGame.ts";
import { cookieDat, cookieXoa, dangNhap, ghiIpSai, ipBiChan, layPhien, LOI_IP, taoPhien, tenHopLe, thietBi } from "./taiKhoan.ts";
import { CAU_QUEN, datLaiBangToken, guiLinkDatLai } from "./datLai.ts";
import type { Phien } from "./taiKhoan.ts";

interface Nguoi {
  ten: string;
  vaiTro: VaiTro;
  vaiTroThat: VaiTro;
  phien: Phien;
}

class Loi extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// ---- Phản hồi HTTP ----------------------------------------------------------------------------------------------

const BAO_MAT: Record<string, string> = {
  "Content-Security-Policy":
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Strict-Transport-Security": "max-age=31536000",
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...BAO_MAT },
  });
}

function loi(status: number, message: string): Response {
  return json({ loi: message }, status);
}

function voiBaoMat(res: Response): Response {
  const r = new Response(res.body, res);
  for (const [k, v] of Object.entries(BAO_MAT)) r.headers.set(k, v);
  return r;
}

// ---- Lớp Access tùy chọn, quyền, nhật ký ---------------------------------------------------------------------

/** Có đặt ACCESS_TEAM_DOMAIN và ACCESS_AUD thì mọi yêu cầu phải mang JWT Access hợp lệ; không đặt thì bỏ qua lớp này. */
async function quaAccess(req: Request, env: Env): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
  const team = teamDomain(env);
  if (!team && !env.ACCESS_AUD) return { ok: true };
  if (!team || !env.ACCESS_AUD) return { ok: false, status: 503, message: "Cấu hình Access thiếu: cần cả ACCESS_TEAM_DOMAIN và ACCESS_AUD, hoặc bỏ cả hai." };
  const token = req.headers.get("Cf-Access-Jwt-Assertion");
  if (!token) return { ok: false, status: 401, message: "Chưa đăng nhập qua Cloudflare Access." };
  const v = await verifyAccessJwt(token, { teamDomain: team, aud: env.ACCESS_AUD, loadKeys: defaultKeyLoader(env.ACCESS_CERTS_URL || certsUrl(team)) });
  if (!v.ok) {
    console.warn(`access: từ chối JWT (${v.reason})`);
    return { ok: false, status: 401, message: "Phiên Access không hợp lệ hoặc đã hết hạn. Tải lại trang để đăng nhập lại." };
  }
  return { ok: true };
}

function canAdmin(n: Nguoi): void {
  if (n.vaiTro !== "admin") throw new Loi(403, "Chỉ Admin được làm việc này.");
}

async function ghiNhatKy(env: Env, n: { ten: string; vaiTroThat: VaiTro }, hanhDong: string, doiTuong: string | null, chiTiet?: Record<string, unknown>): Promise<void> {
  await env.DB.prepare("INSERT INTO qt_nhat_ky (luc, nguoi, vai_tro, hanh_dong, doi_tuong, chi_tiet) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(Date.now(), n.ten, n.vaiTroThat, hanhDong, doiTuong, chiTiet ? JSON.stringify(chiTiet) : null)
    .run();
}

function toiTu(n: Nguoi): Toi {
  return { ten: n.ten, vai_tro: n.vaiTro, vai_tro_that: n.vaiTroThat, phai_doi_mat_khau: n.phien.phaiDoi, het_han: n.phien.hetHan, email: n.phien.email };
}

// ---- Đọc thân yêu cầu -----------------------------------------------------------------------------------------

async function than(req: Request): Promise<Record<string, unknown>> {
  try {
    const b = await req.json();
    if (b && typeof b === "object" && !Array.isArray(b)) return b as Record<string, unknown>;
  } catch {
    // rơi xuống lỗi chung
  }
  throw new Loi(400, "Thân yêu cầu phải là JSON object.");
}

function chuoi(v: unknown, ten: string, max: number, batBuoc = true): string | null {
  if (v === undefined || v === null || v === "") {
    if (batBuoc) throw new Loi(400, `Thiếu ${ten}.`);
    return null;
  }
  if (typeof v !== "string") throw new Loi(400, `${ten} phải là chữ.`);
  const s = v.trim();
  if (batBuoc && !s) throw new Loi(400, `Thiếu ${ten}.`);
  if (s.length > max) throw new Loi(400, `${ten} dài tối đa ${max} ký tự.`);
  return s || null;
}

function tenTu(v: unknown): string {
  const t = (chuoi(v, "tên đăng nhập", 32) ?? "").toLowerCase();
  if (!tenHopLe(t)) throw new Loi(400, "Tên đăng nhập 3–32 ký tự: chữ thường không dấu, số, dấu chấm, gạch dưới, gạch ngang.");
  return t;
}

/** Mã link mời: 6–40 ký tự [a-z0-9-] (CHECK của loi_moi). */
function maTu(v: unknown): string {
  const m = chuoi(v, "mã link", 40) ?? "";
  if (!/^[a-z0-9-]{6,40}$/.test(m)) throw new Loi(400, "Mã link không hợp lệ.");
  return m;
}

/** Mã người chơi thử (nguoi_choi_thu.id). */
function idTu(v: unknown): string {
  const id = chuoi(v, "mã người chơi", 40) ?? "";
  if (!/^[A-Za-z0-9_-]{4,40}$/.test(id)) throw new Loi(400, "Mã người chơi không hợp lệ.");
  return id;
}

function maNgauNhien(n: number): string {
  const chu = "abcdefghijkmnpqrstuvwxyz23456789"; // bỏ l, o, 0, 1 cho dễ đọc khi đọc qua điện thoại
  const b = crypto.getRandomValues(new Uint8Array(n));
  return [...b].map((x) => chu[x % chu.length]).join("");
}

function docLink(b: Record<string, unknown>): { ten: string; toi_da: number | null; het_han: number | null } {
  const ten = chuoi(b.ten, "tên link", 80)!;
  const toi_da = b.toi_da === null || b.toi_da === undefined || b.toi_da === "" ? null : soNguyen(b.toi_da, "số người tối đa");
  if (toi_da !== null && (toi_da < 1 || toi_da > 10000)) throw new Loi(400, "Số người tối đa từ 1 tới 10.000.");
  const het_han = b.het_han === null || b.het_han === undefined || b.het_han === "" ? null : soNguyen(b.het_han, "hết hạn");
  return { ten, toi_da, het_han };
}

/** Ghi vào bảng của Worker game; bảng chưa có (migration game chưa chạy) thì báo 503 thay vì lỗi lạ. */
async function ghiBangGame<T>(f: () => Promise<T>): Promise<T> {
  try {
    return await f();
  } catch (e) {
    if (thieuBang(e)) throw new Loi(503, "Bảng game (loi_moi, nguoi_choi_thu) chưa có trong D1: chờ migration 0002 của Worker game.");
    throw e;
  }
}

function soNguyen(v: unknown, ten: string): number {
  const n = typeof v === "string" ? Number(v) : v;
  if (typeof n !== "number" || !Number.isInteger(n)) throw new Loi(400, `${ten} phải là số nguyên.`);
  return n;
}

// ---- Định tuyến -------------------------------------------------------------------------------------------------

type Handler = (ctx: { req: Request; env: Env; n: Nguoi; url: URL; exec: ExecutionContext }) => Promise<Response>;

const routes: Record<string, Handler> = {
  "GET /api/toi": async ({ n }) => json(toiTu(n)),
  "POST /api/dang-xuat": async ({ env, n }) => {
    await env.DB.prepare("DELETE FROM qt_phien WHERE ma_bam = ?").bind(n.phien.maBam).run();
    await ghiNhatKy(env, n, "phien.dang_xuat", null);
    return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "Set-Cookie": cookieXoa(), ...BAO_MAT } });
  },
  // Email nhận link đặt lại mật khẩu của chính mình. Phải nhập mật khẩu hiện tại: ai cầm được phiên cũng không đổi được.
  "POST /api/email-cua-toi": async ({ req, env, n }) => {
    const b = await than(req);
    const mk = typeof b.mat_khau === "string" ? b.mat_khau.trim() : "";
    const tk = await env.DB.prepare("SELECT mat_khau FROM qt_tai_khoan WHERE ten = ?").bind(n.ten).first<{ mat_khau: string }>();
    if (!tk || !(await kiemMatKhau(mk, tk.mat_khau))) throw new Loi(400, "Mật khẩu hiện tại không đúng.");
    const email = emailTuyChon(b.email);
    await env.DB.prepare("UPDATE qt_tai_khoan SET email = ?, sua_boi = ?, sua_luc = ? WHERE ten = ?").bind(email, n.ten, Date.now(), n.ten).run();
    await ghiNhatKy(env, n, "tai_khoan.email", n.ten, { co_email: email !== null });
    return json({ ok: true, email });
  },
  "POST /api/doi-mat-khau": async ({ req, env, n }) => {
    const b = await than(req);
    const cu = typeof b.cu === "string" ? b.cu.trim() : "";
    const moi = typeof b.moi === "string" ? b.moi.trim() : "";
    const tk = await env.DB.prepare("SELECT mat_khau FROM qt_tai_khoan WHERE ten = ?").bind(n.ten).first<{ mat_khau: string }>();
    if (!tk || !(await kiemMatKhau(cu, tk.mat_khau))) throw new Loi(400, "Mật khẩu hiện tại không đúng.");
    const l = loiMatKhauMoi(n.ten, moi, cu);
    if (l) throw new Loi(400, l);
    const now = Date.now();
    await env.DB.batch([
      env.DB.prepare("UPDATE qt_tai_khoan SET mat_khau = ?, phai_doi = 0, doi_mat_khau_luc = ? WHERE ten = ?").bind(await bamMatKhau(moi), now, n.ten),
      // Đăng xuất các phiên khác của tài khoản này; giữ phiên đang dùng.
      env.DB.prepare("DELETE FROM qt_phien WHERE ten = ? AND ma_bam != ?").bind(n.ten, n.phien.maBam),
    ]);
    await ghiNhatKy(env, n, "phien.doi_mat_khau", n.ten);
    return json({ ok: true });
  },

  // -- Tổng quan và sự kiện (cả hai vai trò) --
  "GET /api/tong-quan": async ({ env, url }) => {
    const soNgay = Math.min(60, Math.max(7, Number(url.searchParams.get("ngay")) || 14));
    return json(await tongQuan(env.DB, soNgay));
  },
  "GET /api/su-kien": async ({ env, url }) => {
    const loai = url.searchParams.get("loai") || undefined;
    if (loai && !/^[a-z0-9_]{1,40}$/.test(loai)) throw new Loi(400, "Loại sự kiện không hợp lệ.");
    const truoc = url.searchParams.get("truoc") || undefined;
    if (truoc && !/^\d{1,18}$/.test(truoc)) throw new Loi(400, "truoc không hợp lệ.");
    return json(await dsSuKien(env.DB, { loai, truoc, gioiHan: 100 }));
  },

  // -- Người chơi thử và link mời --
  // Xem: cả hai vai trò. Tạo, sửa, tắt link và khóa người chơi: chỉ Admin (đổi ai được vào game). Ghi chú: cả hai.
  "GET /api/nguoi-choi": async ({ env }) => json({ ...(await dsNguoiChoi(env.DB)), link_goc: linkGoc(env) }),
  "POST /api/loi-moi": async ({ req, env, n }) => {
    canAdmin(n);
    const b = await than(req);
    const l = docLink(b);
    const now = Date.now();
    // Mã ngẫu nhiên 12 ký tự [a-z0-9] (~62 bit), theo CHECK 6–40 ký tự của loi_moi.
    const ma = maNgauNhien(12);
    await ghiBangGame(() =>
      env.DB.prepare("INSERT INTO loi_moi (ma, ten, toi_da, da_dung, het_han, tat, tao_boi, tao_luc) VALUES (?, ?, ?, 0, ?, 0, ?, ?)")
        .bind(ma, l.ten, l.toi_da, l.het_han, n.ten, now)
        .run(),
    );
    await ghiNhatKy(env, n, "loi_moi.tao", ma, { ten: l.ten, toi_da: l.toi_da, het_han: l.het_han });
    return json({ ma, link: linkGoc(env) + ma });
  },
  "POST /api/loi-moi/sua": async ({ req, env, n }) => {
    canAdmin(n);
    const b = await than(req);
    const ma = maTu(b.ma);
    const l = docLink(b);
    const r = await ghiBangGame(() =>
      env.DB.prepare("UPDATE loi_moi SET ten = ?, toi_da = ?, het_han = ?, sua_boi = ?, sua_luc = ? WHERE ma = ?").bind(l.ten, l.toi_da, l.het_han, n.ten, Date.now(), ma).run(),
    );
    if (!r.meta.changes) throw new Loi(404, "Không có link mời này.");
    await ghiNhatKy(env, n, "loi_moi.sua", ma, { ten: l.ten, toi_da: l.toi_da, het_han: l.het_han });
    return json({ ok: true });
  },
  "POST /api/loi-moi/tat": async ({ req, env, n }) => {
    canAdmin(n);
    const b = await than(req);
    const ma = maTu(b.ma);
    if (typeof b.tat !== "boolean") throw new Loi(400, "tat phải là true hoặc false.");
    const r = await ghiBangGame(() =>
      env.DB.prepare("UPDATE loi_moi SET tat = ?, sua_boi = ?, sua_luc = ? WHERE ma = ?").bind(b.tat ? 1 : 0, n.ten, Date.now(), ma).run(),
    );
    if (!r.meta.changes) throw new Loi(404, "Không có link mời này.");
    await ghiNhatKy(env, n, b.tat ? "loi_moi.tat" : "loi_moi.mo", ma);
    return json({ ok: true });
  },
  "POST /api/nguoi-choi/khoa": async ({ req, env, n }) => {
    canAdmin(n);
    const b = await than(req);
    const id = idTu(b.id);
    if (typeof b.khoa !== "boolean") throw new Loi(400, "khoa phải là true hoặc false.");
    const lyDo = b.khoa ? chuoi(b.ly_do, "lý do khóa", 300, false) : null;
    // Worker game đọc cột khoa mỗi yêu cầu: khóa có hiệu lực ngay ở yêu cầu kế tiếp (cả HTML lẫn API).
    const r = await ghiBangGame(() =>
      env.DB.prepare("UPDATE nguoi_choi_thu SET khoa = ?, ly_do_khoa = ?, sua_boi = ?, sua_luc = ? WHERE id = ?").bind(b.khoa ? 1 : 0, lyDo, n.ten, Date.now(), id).run(),
    );
    if (!r.meta.changes) throw new Loi(404, "Không có người chơi này.");
    await ghiNhatKy(env, n, b.khoa ? "nguoi_choi.khoa" : "nguoi_choi.mo_khoa", id, lyDo ? { ly_do: lyDo } : undefined);
    return json({ ok: true });
  },
  "POST /api/nguoi-choi/ghi-chu": async ({ req, env, n }) => {
    const b = await than(req);
    const id = idTu(b.id);
    const ghiChu = chuoi(b.ghi_chu, "ghi chú", 1000, false);
    if (ghiChu) {
      await env.DB.prepare(
        "INSERT INTO qt_ghi_chu_nguoi_choi (nguoi_choi_id, ghi_chu, sua_boi, sua_luc) VALUES (?, ?, ?, ?) ON CONFLICT(nguoi_choi_id) DO UPDATE SET ghi_chu = excluded.ghi_chu, sua_boi = excluded.sua_boi, sua_luc = excluded.sua_luc",
      )
        .bind(id, ghiChu, n.ten, Date.now())
        .run();
    } else {
      await env.DB.prepare("DELETE FROM qt_ghi_chu_nguoi_choi WHERE nguoi_choi_id = ?").bind(id).run();
    }
    await ghiNhatKy(env, n, "nguoi_choi.ghi_chu", id, { ghi_chu: ghiChu });
    return json({ ok: true });
  },
  // -- Phản hồi (cả hai vai trò) --
  "GET /api/phan-hoi": async ({ env, url }) => {
    const tt = url.searchParams.get("trang_thai");
    const trangThai = tt === "moi" || tt === "dang_xem" || tt === "da_xu_ly" ? tt : undefined;
    return json(await dsPhanHoi(env.DB, { trangThai }));
  },
  "POST /api/phan-hoi/trang-thai": async ({ req, env, n }) => {
    const b = await than(req);
    const id = chuoi(b.id, "id", 64)!;
    const tt = b.trang_thai as TrangThaiPhanHoi;
    if (tt !== "moi" && tt !== "dang_xem" && tt !== "da_xu_ly") throw new Loi(400, "Trạng thái là moi, dang_xem hoặc da_xu_ly.");
    if (!(await coPhanHoi(env.DB, id))) throw new Loi(404, "Không có phản hồi này.");
    await env.DB.prepare(
      "INSERT INTO qt_phan_hoi_xu_ly (phan_hoi_id, trang_thai, sua_boi, sua_luc) VALUES (?, ?, ?, ?) ON CONFLICT(phan_hoi_id) DO UPDATE SET trang_thai = excluded.trang_thai, sua_boi = excluded.sua_boi, sua_luc = excluded.sua_luc",
    )
      .bind(id, tt, n.ten, Date.now())
      .run();
    await ghiNhatKy(env, n, "phan_hoi.trang_thai", id, { trang_thai: tt });
    return json({ ok: true });
  },
  "POST /api/phan-hoi/ghi-chu": async ({ req, env, n }) => {
    const b = await than(req);
    const id = chuoi(b.id, "id", 64)!;
    const nd = chuoi(b.noi_dung, "ghi chú", 2000)!;
    if (!(await coPhanHoi(env.DB, id))) throw new Loi(404, "Không có phản hồi này.");
    await env.DB.prepare("INSERT INTO qt_phan_hoi_ghi_chu (phan_hoi_id, nguoi, noi_dung, luc) VALUES (?, ?, ?, ?)").bind(id, n.ten, nd, Date.now()).run();
    await ghiNhatKy(env, n, "phan_hoi.ghi_chu", id);
    return json({ ok: true });
  },

  // -- Thông báo (cả hai vai trò) --
  "GET /api/thong-bao": async ({ env }) => {
    const r = await env.DB.prepare("SELECT * FROM qt_thong_bao ORDER BY CASE trang_thai WHEN 'go' THEN 1 ELSE 0 END, bat_dau DESC LIMIT 200").all<Record<string, unknown>>();
    const now = Date.now();
    return json({ dong: r.results.map((x) => thongBaoTu(x, now)) });
  },
  "POST /api/thong-bao": async ({ req, env, n }) => {
    const b = await than(req);
    const tb = docThongBao(b);
    const now = Date.now();
    const r = await env.DB.prepare(
      "INSERT INTO qt_thong_bao (tieu_de, noi_dung, muc, bat_dau, ket_thuc, trang_thai, tao_boi, tao_luc) VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id",
    )
      .bind(tb.tieu_de, tb.noi_dung, tb.muc, tb.bat_dau ?? now, tb.ket_thuc, tb.dang ? "dang" : "nhap", n.ten, now)
      .first<{ id: number }>();
    await ghiNhatKy(env, n, "thong_bao.tao", `#${r?.id}`, { tieu_de: tb.tieu_de, dang: tb.dang, bat_dau: tb.bat_dau, ket_thuc: tb.ket_thuc });
    return json({ id: r?.id });
  },
  "POST /api/thong-bao/sua": async ({ req, env, n }) => {
    const b = await than(req);
    const id = soNguyen(b.id, "id");
    const tb = docThongBao(b);
    const now = Date.now();
    // Bỏ trống giờ bắt đầu khi sửa: thông báo đã tới giờ giữ giờ cũ, còn hẹn ở tương lai thì thành "ngay bây giờ".
    const r = await env.DB.prepare(
      "UPDATE qt_thong_bao SET tieu_de = ?, noi_dung = ?, muc = ?, bat_dau = CASE WHEN ? IS NOT NULL THEN ? WHEN bat_dau <= ? THEN bat_dau ELSE ? END, ket_thuc = ?, trang_thai = ?, sua_boi = ?, sua_luc = ? WHERE id = ? AND trang_thai != 'go'",
    )
      .bind(tb.tieu_de, tb.noi_dung, tb.muc, tb.bat_dau, tb.bat_dau, now, now, tb.ket_thuc, tb.dang ? "dang" : "nhap", n.ten, now, id)
      .run();
    if (!r.meta.changes) throw new Loi(404, "Không có thông báo này, hoặc đã gỡ.");
    await ghiNhatKy(env, n, "thong_bao.sua", `#${id}`, { tieu_de: tb.tieu_de, dang: tb.dang, bat_dau: tb.bat_dau, ket_thuc: tb.ket_thuc });
    return json({ ok: true });
  },
  "POST /api/thong-bao/go": async ({ req, env, n }) => {
    const b = await than(req);
    const id = soNguyen(b.id, "id");
    const r = await env.DB.prepare("UPDATE qt_thong_bao SET trang_thai = 'go', go_boi = ?, go_luc = ? WHERE id = ? AND trang_thai != 'go'").bind(n.ten, Date.now(), id).run();
    if (!r.meta.changes) throw new Loi(404, "Không có thông báo này, hoặc đã gỡ.");
    await ghiNhatKy(env, n, "thong_bao.go", `#${id}`);
    return json({ ok: true });
  },

  // -- Cấu hình sống (chỉ Admin, cả đọc) --
  "GET /api/cau-hinh": async ({ env, n }) => {
    canAdmin(n);
    const [cur, ls] = await env.DB.batch([
      env.DB.prepare("SELECT khoa, gia_tri, sua_boi, sua_luc FROM qt_cau_hinh"),
      env.DB.prepare("SELECT * FROM qt_cau_hinh_lich_su ORDER BY luc DESC LIMIT 200"),
    ]);
    const map = new Map((cur.results as { khoa: string; gia_tri: string; sua_boi: string; sua_luc: number }[]).map((r) => [r.khoa, r]));
    const tham_so: ThamSo[] = THAM_SO.map((d) => {
      const r = map.get(d.khoa);
      return { ...d, gia_tri: r ? (JSON.parse(r.gia_tri) as ThamSo["gia_tri"]) : d.mac_dinh, sua_boi: r?.sua_boi ?? null, sua_luc: r?.sua_luc ?? null };
    });
    const lich_su: LichSuCauHinh[] = (ls.results as Record<string, unknown>[]).map((r) => ({
      id: Number(r.id),
      khoa: String(r.khoa),
      cu: r.cu === null ? null : JSON.parse(String(r.cu)),
      moi: JSON.parse(String(r.moi)),
      ly_do: (r.ly_do as string | null) ?? null,
      boi: String(r.boi),
      luc: Number(r.luc),
    }));
    return json({ tham_so, lich_su });
  },
  "POST /api/cau-hinh": async ({ req, env, n }) => {
    canAdmin(n);
    const b = await than(req);
    const d = THAM_SO.find((x) => x.khoa === b.khoa);
    if (!d) throw new Loi(400, "Không có tham số này.");
    const k = kiemGiaTri(d, b.gia_tri);
    if (!k.ok) throw new Loi(400, k.loi);
    const lyDo = chuoi(b.ly_do, "lý do", 300, false);
    const cu = await env.DB.prepare("SELECT gia_tri FROM qt_cau_hinh WHERE khoa = ?").bind(d.khoa).first<{ gia_tri: string }>();
    const moi = JSON.stringify(k.v);
    const cuJson = cu?.gia_tri ?? JSON.stringify(d.mac_dinh);
    if (cuJson === moi) return json({ ok: true, khong_doi: true });
    const now = Date.now();
    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO qt_cau_hinh (khoa, gia_tri, sua_boi, sua_luc) VALUES (?, ?, ?, ?) ON CONFLICT(khoa) DO UPDATE SET gia_tri = excluded.gia_tri, sua_boi = excluded.sua_boi, sua_luc = excluded.sua_luc",
      ).bind(d.khoa, moi, n.ten, now),
      env.DB.prepare("INSERT INTO qt_cau_hinh_lich_su (khoa, cu, moi, ly_do, boi, luc) VALUES (?, ?, ?, ?, ?, ?)").bind(d.khoa, cuJson, moi, lyDo, n.ten, now),
    ]);
    await ghiNhatKy(env, n, "cau_hinh.doi", d.khoa, { cu: JSON.parse(cuJson), moi: k.v, ly_do: lyDo });
    return json({ ok: true });
  },

  // -- Tài khoản quản trị (chỉ Admin, cả đọc) --
  "GET /api/tai-khoan": async ({ env, n }) => {
    canAdmin(n);
    const now = Date.now();
    const r = await env.DB.prepare(
      "SELECT t.ten, t.vai_tro, t.khoa, t.phai_doi, t.ghi_chu, t.email, t.dang_nhap_cuoi, t.doi_mat_khau_luc, t.tam_khoa_den, t.tao_boi, t.tao_luc, (SELECT COUNT(*) FROM qt_phien p WHERE p.ten = t.ten AND p.het_han > ?) AS so_phien FROM qt_tai_khoan t ORDER BY t.vai_tro, t.ten",
    )
      .bind(now)
      .all<Record<string, unknown>>();
    const dong: TaiKhoan[] = r.results.map((x) => ({
      ten: String(x.ten),
      vai_tro: x.vai_tro as VaiTro,
      khoa: x.khoa === 1,
      phai_doi: x.phai_doi === 1,
      ghi_chu: (x.ghi_chu as string | null) ?? null,
      email: (x.email as string | null) ?? null,
      dang_nhap_cuoi: (x.dang_nhap_cuoi as number | null) ?? null,
      doi_mat_khau_luc: (x.doi_mat_khau_luc as number | null) ?? null,
      tam_khoa_den: typeof x.tam_khoa_den === "number" && x.tam_khoa_den > now ? x.tam_khoa_den : null,
      so_phien: Number(x.so_phien ?? 0),
      tao_boi: String(x.tao_boi),
      tao_luc: Number(x.tao_luc),
    }));
    return json({ dong });
  },
  "POST /api/tai-khoan": async ({ req, env, n }) => {
    canAdmin(n);
    const b = await than(req);
    const ten = tenTu(b.ten);
    const vt = vaiTroTu(b.vai_tro);
    const ghiChu = chuoi(b.ghi_chu, "ghi chú", 200, false);
    const tam = matKhauNgauNhien();
    const r = await env.DB.prepare(
      "INSERT INTO qt_tai_khoan (ten, vai_tro, mat_khau, phai_doi, ghi_chu, tao_boi, tao_luc) VALUES (?, ?, ?, 1, ?, ?, ?) ON CONFLICT(ten) DO NOTHING",
    )
      .bind(ten, vt, await bamMatKhau(tam), ghiChu, n.ten, Date.now())
      .run();
    if (!r.meta.changes) throw new Loi(409, "Tên đăng nhập này đã có.");
    await ghiNhatKy(env, n, "tai_khoan.tao", ten, { vai_tro: vt });
    const out: MatKhauTam = { ten, mat_khau_tam: tam };
    return json(out);
  },
  "POST /api/tai-khoan/sua": async ({ req, env, n }) => {
    canAdmin(n);
    const b = await than(req);
    const ten = tenTu(b.ten);
    const vt = vaiTroTu(b.vai_tro);
    const ghiChu = chuoi(b.ghi_chu, "ghi chú", 200, false);
    const cu = await taiKhoanKhac(env, n, ten);
    if (cu.vai_tro === "admin" && vt !== "admin") await conAdminKhac(env, ten);
    // email: không gửi thì giữ nguyên; chuỗi rỗng thì bỏ email.
    const doiEmail = b.email !== undefined;
    const email = doiEmail ? emailTuyChon(b.email) : null;
    await env.DB.prepare(
      `UPDATE qt_tai_khoan SET vai_tro = ?, ghi_chu = ?${doiEmail ? ", email = ?" : ""}, sua_boi = ?, sua_luc = ? WHERE ten = ?`,
    )
      .bind(...[vt, ghiChu, ...(doiEmail ? [email] : []), n.ten, Date.now(), ten])
      .run();
    await ghiNhatKy(env, n, "tai_khoan.sua", ten, { cu: cu.vai_tro, moi: vt, ...(doiEmail ? { co_email: email !== null } : {}) });
    return json({ ok: true });
  },
  "POST /api/tai-khoan/dat-lai": async ({ req, env, n }) => {
    canAdmin(n);
    const b = await than(req);
    const ten = tenTu(b.ten);
    await taiKhoanKhac(env, n, ten);
    const tam = matKhauNgauNhien();
    await env.DB.batch([
      env.DB.prepare("UPDATE qt_tai_khoan SET mat_khau = ?, phai_doi = 1, sai_lien_tiep = 0, tam_khoa_den = NULL, sua_boi = ?, sua_luc = ? WHERE ten = ?").bind(await bamMatKhau(tam), n.ten, Date.now(), ten),
      env.DB.prepare("DELETE FROM qt_phien WHERE ten = ?").bind(ten),
    ]);
    await ghiNhatKy(env, n, "tai_khoan.dat_lai", ten);
    const out: MatKhauTam = { ten, mat_khau_tam: tam };
    return json(out);
  },
  "POST /api/tai-khoan/khoa": async ({ req, env, n }) => {
    canAdmin(n);
    const b = await than(req);
    const ten = tenTu(b.ten);
    if (typeof b.khoa !== "boolean") throw new Loi(400, "khoa phải là true hoặc false.");
    const cu = await taiKhoanKhac(env, n, ten);
    if (b.khoa && cu.vai_tro === "admin") await conAdminKhac(env, ten);
    await env.DB.batch([
      env.DB.prepare("UPDATE qt_tai_khoan SET khoa = ?, sua_boi = ?, sua_luc = ? WHERE ten = ?").bind(b.khoa ? 1 : 0, n.ten, Date.now(), ten),
      ...(b.khoa ? [env.DB.prepare("DELETE FROM qt_phien WHERE ten = ?").bind(ten)] : []),
    ]);
    await ghiNhatKy(env, n, b.khoa ? "tai_khoan.khoa" : "tai_khoan.mo_khoa", ten);
    return json({ ok: true });
  },
  "POST /api/tai-khoan/xoa": async ({ req, env, n }) => {
    canAdmin(n);
    const b = await than(req);
    const ten = tenTu(b.ten);
    const cu = await taiKhoanKhac(env, n, ten);
    if (cu.vai_tro === "admin") await conAdminKhac(env, ten);
    await env.DB.batch([env.DB.prepare("DELETE FROM qt_phien WHERE ten = ?").bind(ten), env.DB.prepare("DELETE FROM qt_tai_khoan WHERE ten = ?").bind(ten)]);
    await ghiNhatKy(env, n, "tai_khoan.xoa", ten, { vai_tro: cu.vai_tro });
    return json({ ok: true });
  },

  // -- Nhật ký (cả hai vai trò) --
  "GET /api/nhat-ky": async ({ env, url }) => {
    const truoc = Number(url.searchParams.get("truoc")) || Number.MAX_SAFE_INTEGER;
    const hd = url.searchParams.get("hanh_dong");
    const loc = hd && /^[a-z_.]{1,40}$/.test(hd) ? hd : null;
    const stmt = loc
      ? env.DB.prepare("SELECT * FROM qt_nhat_ky WHERE id < ? AND (hanh_dong = ? OR hanh_dong LIKE ?) ORDER BY id DESC LIMIT 101").bind(truoc, loc, `${loc}.%`)
      : env.DB.prepare("SELECT * FROM qt_nhat_ky WHERE id < ? ORDER BY id DESC LIMIT 101").bind(truoc);
    const r = await stmt.all<Record<string, unknown>>();
    const dong: NhatKy[] = r.results.slice(0, 100).map((x) => ({
      id: Number(x.id),
      luc: Number(x.luc),
      nguoi: String(x.nguoi),
      vai_tro: x.vai_tro as VaiTro,
      hanh_dong: String(x.hanh_dong),
      doi_tuong: (x.doi_tuong as string | null) ?? null,
      chi_tiet: x.chi_tiet ? (JSON.parse(String(x.chi_tiet)) as Record<string, unknown>) : null,
    }));
    return json({ dong, con: r.results.length > 100 });
  },
};

function thongBaoTu(x: Record<string, unknown>, now: number): ThongBao {
  const tt = x.trang_thai as ThongBao["trang_thai"];
  const batDau = Number(x.bat_dau);
  const ketThuc = x.ket_thuc === null ? null : Number(x.ket_thuc);
  const hien: ThongBao["hien"] =
    tt === "go" ? "da_go" : tt === "nhap" ? "nhap" : batDau > now ? "hen" : ketThuc !== null && ketThuc <= now ? "het_han" : "dang_hien";
  return {
    id: Number(x.id),
    tieu_de: String(x.tieu_de),
    noi_dung: String(x.noi_dung),
    muc: x.muc as MucThongBao,
    bat_dau: batDau,
    ket_thuc: ketThuc,
    trang_thai: tt,
    hien,
    tao_boi: String(x.tao_boi),
    tao_luc: Number(x.tao_luc),
    sua_boi: (x.sua_boi as string | null) ?? null,
    sua_luc: (x.sua_luc as number | null) ?? null,
    go_boi: (x.go_boi as string | null) ?? null,
    go_luc: (x.go_luc as number | null) ?? null,
  };
}

function docThongBao(b: Record<string, unknown>) {
  const tieu_de = chuoi(b.tieu_de, "tiêu đề", 80)!;
  const noi_dung = chuoi(b.noi_dung, "nội dung", 1000)!;
  const muc: MucThongBao = b.muc === "quan_trong" ? "quan_trong" : "thuong";
  const bat_dau = b.bat_dau === null || b.bat_dau === undefined || b.bat_dau === "" ? null : soNguyen(b.bat_dau, "giờ bắt đầu");
  const ket_thuc = b.ket_thuc === null || b.ket_thuc === undefined || b.ket_thuc === "" ? null : soNguyen(b.ket_thuc, "giờ kết thúc");
  if (bat_dau !== null && ket_thuc !== null && ket_thuc <= bat_dau) throw new Loi(400, "Giờ kết thúc phải sau giờ bắt đầu.");
  return { tieu_de, noi_dung, muc, bat_dau, ket_thuc, dang: b.dang === true };
}

/** Email nhận link đặt lại: chuỗi rỗng hoặc null là bỏ email. */
function emailTuyChon(v: unknown): string | null {
  if (v === null || v === undefined || (typeof v === "string" && v.trim() === "")) return null;
  if (typeof v !== "string") throw new Loi(400, "Email phải là chữ.");
  const e = v.trim().toLowerCase();
  if (!/^[^\s@,;<>"]+@[^\s@,;<>"]+\.[^\s@,;<>"]+$/.test(e) || e.length > 254) throw new Loi(400, "Email không hợp lệ.");
  return e;
}

function vaiTroTu(v: unknown): VaiTro {
  if (v !== "admin" && v !== "van_hanh") throw new Loi(400, "Vai trò là admin hoặc van_hanh.");
  return v;
}

/** Tài khoản khác chính mình (không tự khóa, tự hạ quyền, tự xóa, tự đặt lại qua màn quản trị). */
async function taiKhoanKhac(env: Env, n: Nguoi, ten: string): Promise<{ vai_tro: VaiTro }> {
  if (ten === n.ten) throw new Loi(409, "Không tự làm việc này với tài khoản của mình; dùng Đổi mật khẩu, hoặc nhờ Admin khác.");
  const r = await env.DB.prepare("SELECT vai_tro FROM qt_tai_khoan WHERE ten = ?").bind(ten).first<{ vai_tro: VaiTro }>();
  if (!r) throw new Loi(404, "Không có tài khoản này.");
  return r;
}

/** Luôn còn ít nhất một Admin chưa khóa ngoài tài khoản sắp bị hạ, khóa hoặc xóa. */
async function conAdminKhac(env: Env, tru: string): Promise<void> {
  const r = await env.DB.prepare("SELECT COUNT(*) AS so FROM qt_tai_khoan WHERE vai_tro = 'admin' AND khoa = 0 AND ten != ?").bind(tru).first<{ so: number }>();
  if (!r || r.so < 1) throw new Loi(409, "Phải còn ít nhất một Admin đang hoạt động.");
}

// ---- Điểm vào -----------------------------------------------------------------------------------------------------

export default {
  async fetch(req: Request, env: Env, exec: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);
    const laApi = url.pathname.startsWith("/api/");

    const ac = await quaAccess(req, env);
    if (!ac.ok) {
      if (laApi) return loi(ac.status, ac.message);
      return voiBaoMat(new Response(trangChan(ac.message), { status: ac.status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } }));
    }

    // Giao diện tĩnh không chứa dữ liệu: ai cũng tải được để thấy màn đăng nhập. Dữ liệu chỉ qua /api/* có phiên.
    if (!laApi) return voiBaoMat(await env.ASSETS.fetch(req));

    try {
      if (req.method !== "GET") {
        // Chống CSRF: chỉ nhận POST cùng nguồn, thân JSON (trình duyệt lạ phải preflight và bị chặn vì không có CORS).
        if (req.headers.get("Origin") !== url.origin) return loi(403, "Yêu cầu khác nguồn.");
        if (!(req.headers.get("Content-Type") ?? "").startsWith("application/json")) return loi(415, "Cần Content-Type: application/json.");
      }

      if (req.method === "POST" && url.pathname === "/api/dang-nhap") {
        const b = await than(req);
        const ten = typeof b.ten === "string" ? b.ten.slice(0, 254) : "";
        // Bỏ khoảng trắng hai đầu (hay dính khi dán mật khẩu tạm); đặt mật khẩu mới cũng bỏ như vậy nên luôn khớp.
        const mk = typeof b.mat_khau === "string" ? b.mat_khau.trim().slice(0, 200) : "";
        if (!ten || !mk) return loi(400, "Nhập tên đăng nhập và mật khẩu.");
        const kq = await dangNhap(env.DB, ten, mk, req.headers.get("CF-Connecting-IP") ?? "khong-ro");
        if (!kq.ok) return loi(kq.status, kq.loi);
        const p = await taoPhien(env.DB, kq.ten, thietBi(req));
        const phien = await layPhienTuMa(env, p.ma);
        const n: Nguoi = { ten: kq.ten, vaiTro: phien.vaiTro, vaiTroThat: phien.vaiTro, phien };
        await ghiNhatKy(env, n, "phien.dang_nhap", null, { thiet_bi: thietBi(req) });
        return new Response(JSON.stringify(toiTu(n)), {
          headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "Set-Cookie": cookieDat(p.ma), ...BAO_MAT },
        });
      }

      const ip = req.headers.get("CF-Connecting-IP") ?? "khong-ro";
      if (req.method === "POST" && url.pathname === "/api/quen-mat-khau") {
        const b = await than(req);
        if (await ipBiChan(env.DB, ip)) return loi(429, LOI_IP);
        // Mỗi yêu cầu cũng tính một lần vào bộ đếm IP, để không dùng đường này dò tên hay gửi thư dồn dập.
        await (await ghiIpSai(env.DB, ip)).run();
        const ten = typeof b.ten === "string" ? b.ten.slice(0, 254) : "";
        // Tra tài khoản và gửi thư sau khi đã trả lời: mọi tên đều nhận cùng câu, cùng thời gian.
        exec.waitUntil(guiLinkDatLai(env, ten, url.origin).catch((e) => console.error(`quen-mat-khau: ${(e as Error)?.message ?? e}`)));
        return json({ ok: true, thong_diep: CAU_QUEN });
      }
      if (req.method === "POST" && url.pathname === "/api/dat-lai") {
        const b = await than(req);
        if (await ipBiChan(env.DB, ip)) return loi(429, LOI_IP);
        const token = typeof b.ma === "string" ? b.ma.trim() : "";
        const moi = typeof b.moi === "string" ? b.moi.trim() : "";
        const kq = await datLaiBangToken(env, token, moi);
        if (!kq.ok) {
          if (kq.status === 400 && kq.loi.startsWith("Link")) await (await ghiIpSai(env.DB, ip)).run();
          return loi(kq.status, kq.loi);
        }
        await ghiNhatKy(env, { ten: kq.ten, vaiTroThat: kq.vai_tro as VaiTro }, "phien.dat_lai", kq.ten);
        return json({ ok: true });
      }

      const phien = await layPhien(env.DB, req);
      if (!phien) return loi(401, "Chưa đăng nhập hoặc phiên đã hết hạn.");
      // "Xem như Vận hành": Admin tự hạ quyền cho yêu cầu này (chỉ hạ, không bao giờ nâng).
      const xemNhu = req.headers.get("X-Xem-Nhu");
      const n: Nguoi = { ten: phien.ten, vaiTroThat: phien.vaiTro, vaiTro: xemNhu === "van_hanh" ? "van_hanh" : phien.vaiTro, phien };

      const khoaRoute = `${req.method} ${url.pathname}`;
      // Lần đầu hoặc sau khi được đặt lại: chỉ được xem mình, đổi mật khẩu, đăng xuất.
      if (phien.phaiDoi && !["GET /api/toi", "POST /api/doi-mat-khau", "POST /api/dang-xuat"].includes(khoaRoute)) return loi(403, "Cần đổi mật khẩu trước.");
      const h = routes[khoaRoute];
      if (!h) return loi(404, "Không có API này.");
      return await h({ req, env, n, url, exec });
    } catch (e) {
      if (e instanceof Loi) return loi(e.status, e.message);
      console.error(`api lỗi ${req.method} ${url.pathname}: ${(e as Error)?.message ?? e}`);
      return loi(500, "Lỗi máy chủ admin.");
    }
  },
} satisfies ExportedHandler<Env>;

/** Đọc lại phiên vừa tạo (để trả vai trò và hạn ngay trong lần đăng nhập). */
async function layPhienTuMa(env: Env, ma: string): Promise<Phien> {
  const p = await layPhien(env.DB, new Request("https://x/", { headers: { Cookie: `__Host-qt=${ma}` } }));
  if (!p) throw new Loi(500, "Không tạo được phiên.");
  return p;
}

function trangChan(msg: string): string {
  const esc = msg.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
  return `<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Thiên Hoang Ký · Quản trị</title>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#efe6d3;color:#2a2018;font-family:Cambria,'Times New Roman',serif">
<main style="max-width:420px;margin:16px;padding:24px;background:#fffaf0;box-shadow:inset 0 0 0 1px rgba(138,31,22,.55)">
<h1 style="margin:0 0 8px;color:#8a1f16;font-size:22px">Thiên Hoang Ký · Quản trị</h1><p style="margin:0">${esc}</p></main></body></html>`;
}

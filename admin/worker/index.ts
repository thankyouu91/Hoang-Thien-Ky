// Worker thienhoangky-admin: phục vụ giao diện admin (Static Assets) và API /api/* ở admin.thienhoangky.fun.
// Mọi yêu cầu, kể cả file tĩnh, qua Worker trước (run_worker_first) và phải mang JWT Access hợp lệ của ứng dụng admin.
// Vai trò tra trong D1 (qt_vai_tro) hoặc ADMIN_GOC; quyền chặn ở đây, giao diện chỉ ẩn nút cho gọn.
// Email (của admin, vận hành) là dữ liệu cá nhân: không console.log email, không để email trong URL (thao tác theo email gửi qua thân POST).
// Người chơi thử không có email: họ vào bằng link mời, nhận diện bằng mã nguoi_choi_thu.id.

import type { DongVaiTro, LichSuCauHinh, MucThongBao, NhatKy, ThamSo, ThongBao, Toi, TrangThaiPhanHoi, VaiTro } from "../shared/hopDong.ts";
import { LINK_MOI_GOC } from "../shared/hopDong.ts";
import { THAM_SO, kiemGiaTri } from "./cauHinh.ts";
import { dongBo, emailQuanTri, trangThai } from "./dongBoAccess.ts";
import type { Env } from "./env.ts";
import { dsAdminGoc, teamDomain } from "./env.ts";
import { defaultKeyLoader, certsUrl, isEmail, normalizeEmail, verifyAccessJwt } from "./jwt.ts";
import { coPhanHoi, dsNguoiChoi, dsPhanHoi, dsSuKien, thieuBang, tongQuan } from "./nguonGame.ts";

interface Nguoi {
  email: string;
  vaiTro: VaiTro;
  vaiTroThat: VaiTro;
  goc: boolean;
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

// ---- Xác thực và vai trò ---------------------------------------------------------------------------------------

async function xacThuc(req: Request, env: Env): Promise<{ ok: true; email: string } | { ok: false; status: number; message: string }> {
  const team = teamDomain(env);
  if (!team || !env.ACCESS_AUD) return { ok: false, status: 503, message: "Admin chưa cấu hình Access (ACCESS_TEAM_DOMAIN, ACCESS_AUD)." };
  const token = req.headers.get("Cf-Access-Jwt-Assertion");
  if (!token) return { ok: false, status: 401, message: "Chưa đăng nhập qua Cloudflare Access." };
  const v = await verifyAccessJwt(token, {
    teamDomain: team,
    aud: env.ACCESS_AUD,
    loadKeys: defaultKeyLoader(env.ACCESS_CERTS_URL || certsUrl(team)),
  });
  if (!v.ok) {
    // Ghi lý do (không có email) để dò cấu hình Access.
    console.warn(`access: từ chối JWT (${v.reason})`);
    return { ok: false, status: 401, message: "Phiên Access không hợp lệ hoặc đã hết hạn. Tải lại trang để đăng nhập lại." };
  }
  return { ok: true, email: v.claims.email };
}

async function vaiTroCua(env: Env, email: string): Promise<{ vaiTro: VaiTro; goc: boolean } | null> {
  if (dsAdminGoc(env).includes(email)) return { vaiTro: "admin", goc: true };
  const r = await env.DB.prepare("SELECT vai_tro FROM qt_vai_tro WHERE email = ?").bind(email).first<{ vai_tro: VaiTro }>();
  return r ? { vaiTro: r.vai_tro, goc: false } : null;
}

function canAdmin(n: Nguoi): void {
  if (n.vaiTro !== "admin") throw new Loi(403, "Chỉ Admin được làm việc này.");
}

async function ghiNhatKy(env: Env, n: Nguoi, hanhDong: string, doiTuong: string | null, chiTiet?: Record<string, unknown>): Promise<void> {
  await env.DB.prepare("INSERT INTO qt_nhat_ky (luc, email, vai_tro, hanh_dong, doi_tuong, chi_tiet) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(Date.now(), n.email, n.vaiTroThat, hanhDong, doiTuong, chiTiet ? JSON.stringify(chiTiet) : null)
    .run();
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

function emailTu(v: unknown): string {
  const e = normalizeEmail(chuoi(v, "email", 254) ?? "");
  if (!isEmail(e)) throw new Loi(400, "Email không hợp lệ.");
  return e;
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
  "GET /api/toi": async ({ env, n }) => {
    const toi: Toi = {
      email: n.email,
      vai_tro: n.vaiTro,
      vai_tro_that: n.vaiTroThat,
      admin_goc: n.goc,
      access: { team: teamDomain(env), dong_bo_quan_tri: (await trangThai(env)).da_noi },
    };
    return json(toi);
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
  "GET /api/nguoi-choi": async ({ env }) => json(await dsNguoiChoi(env.DB)),
  "POST /api/loi-moi": async ({ req, env, n }) => {
    canAdmin(n);
    const b = await than(req);
    const l = docLink(b);
    const now = Date.now();
    // Mã ngẫu nhiên 12 ký tự [a-z0-9] (~62 bit), theo CHECK 6–40 ký tự của loi_moi.
    const ma = maNgauNhien(12);
    await ghiBangGame(() =>
      env.DB.prepare("INSERT INTO loi_moi (ma, ten, toi_da, da_dung, het_han, tat, tao_boi, tao_luc) VALUES (?, ?, ?, 0, ?, 0, ?, ?)")
        .bind(ma, l.ten, l.toi_da, l.het_han, n.email, now)
        .run(),
    );
    await ghiNhatKy(env, n, "loi_moi.tao", ma, { ten: l.ten, toi_da: l.toi_da, het_han: l.het_han });
    return json({ ma, link: LINK_MOI_GOC + ma });
  },
  "POST /api/loi-moi/sua": async ({ req, env, n }) => {
    canAdmin(n);
    const b = await than(req);
    const ma = maTu(b.ma);
    const l = docLink(b);
    const r = await ghiBangGame(() =>
      env.DB.prepare("UPDATE loi_moi SET ten = ?, toi_da = ?, het_han = ?, sua_boi = ?, sua_luc = ? WHERE ma = ?").bind(l.ten, l.toi_da, l.het_han, n.email, Date.now(), ma).run(),
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
      env.DB.prepare("UPDATE loi_moi SET tat = ?, sua_boi = ?, sua_luc = ? WHERE ma = ?").bind(b.tat ? 1 : 0, n.email, Date.now(), ma).run(),
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
      env.DB.prepare("UPDATE nguoi_choi_thu SET khoa = ?, ly_do_khoa = ?, sua_boi = ?, sua_luc = ? WHERE id = ?").bind(b.khoa ? 1 : 0, lyDo, n.email, Date.now(), id).run(),
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
        .bind(id, ghiChu, n.email, Date.now())
        .run();
    } else {
      await env.DB.prepare("DELETE FROM qt_ghi_chu_nguoi_choi WHERE nguoi_choi_id = ?").bind(id).run();
    }
    await ghiNhatKy(env, n, "nguoi_choi.ghi_chu", id, { ghi_chu: ghiChu });
    return json({ ok: true });
  },
  "POST /api/access/dong-bo": async ({ env, n }) => {
    canAdmin(n);
    const kq = await dongBo(env);
    await ghiNhatKy(env, n, "access.dong_bo", "quan_tri", { ok: kq.ok, so_email: kq.so_email, loi: kq.loi });
    return json(kq);
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
      .bind(id, tt, n.email, Date.now())
      .run();
    await ghiNhatKy(env, n, "phan_hoi.trang_thai", id, { trang_thai: tt });
    return json({ ok: true });
  },
  "POST /api/phan-hoi/ghi-chu": async ({ req, env, n }) => {
    const b = await than(req);
    const id = chuoi(b.id, "id", 64)!;
    const nd = chuoi(b.noi_dung, "ghi chú", 2000)!;
    if (!(await coPhanHoi(env.DB, id))) throw new Loi(404, "Không có phản hồi này.");
    await env.DB.prepare("INSERT INTO qt_phan_hoi_ghi_chu (phan_hoi_id, email, noi_dung, luc) VALUES (?, ?, ?, ?)").bind(id, n.email, nd, Date.now()).run();
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
      .bind(tb.tieu_de, tb.noi_dung, tb.muc, tb.bat_dau ?? now, tb.ket_thuc, tb.dang ? "dang" : "nhap", n.email, now)
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
      .bind(tb.tieu_de, tb.noi_dung, tb.muc, tb.bat_dau, tb.bat_dau, now, now, tb.ket_thuc, tb.dang ? "dang" : "nhap", n.email, now, id)
      .run();
    if (!r.meta.changes) throw new Loi(404, "Không có thông báo này, hoặc đã gỡ.");
    await ghiNhatKy(env, n, "thong_bao.sua", `#${id}`, { tieu_de: tb.tieu_de, dang: tb.dang, bat_dau: tb.bat_dau, ket_thuc: tb.ket_thuc });
    return json({ ok: true });
  },
  "POST /api/thong-bao/go": async ({ req, env, n }) => {
    const b = await than(req);
    const id = soNguyen(b.id, "id");
    const r = await env.DB.prepare("UPDATE qt_thong_bao SET trang_thai = 'go', go_boi = ?, go_luc = ? WHERE id = ? AND trang_thai != 'go'").bind(n.email, Date.now(), id).run();
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
      ).bind(d.khoa, moi, n.email, now),
      env.DB.prepare("INSERT INTO qt_cau_hinh_lich_su (khoa, cu, moi, ly_do, boi, luc) VALUES (?, ?, ?, ?, ?, ?)").bind(d.khoa, cuJson, moi, lyDo, n.email, now),
    ]);
    await ghiNhatKy(env, n, "cau_hinh.doi", d.khoa, { cu: JSON.parse(cuJson), moi: k.v, ly_do: lyDo });
    return json({ ok: true });
  },

  // -- Phân quyền (chỉ Admin, cả đọc) --
  "GET /api/vai-tro": async ({ env, n }) => {
    canAdmin(n);
    const r = await env.DB.prepare("SELECT * FROM qt_vai_tro ORDER BY vai_tro, email").all<Record<string, unknown>>();
    const goc = dsAdminGoc(env);
    const dong: DongVaiTro[] = [
      ...goc.map((email): DongVaiTro => ({ email, vai_tro: "admin", ghi_chu: "Admin gốc (biến ADMIN_GOC)", goc: true, them_boi: null, them_luc: null })),
      ...r.results
        .filter((x) => !goc.includes(String(x.email)))
        .map(
          (x): DongVaiTro => ({
            email: String(x.email),
            vai_tro: x.vai_tro as VaiTro,
            ghi_chu: (x.ghi_chu as string | null) ?? null,
            goc: false,
            them_boi: (x.them_boi as string | null) ?? null,
            them_luc: (x.them_luc as number | null) ?? null,
          }),
        ),
    ];
    return json({ dong, dong_bo: await trangThai(env), danh_sach_access: await emailQuanTri(env) });
  },
  "POST /api/vai-tro": async ({ req, env, n }) => {
    canAdmin(n);
    const b = await than(req);
    const email = emailTu(b.email);
    const vt = b.vai_tro;
    if (vt !== "admin" && vt !== "van_hanh") throw new Loi(400, "Vai trò là admin hoặc van_hanh.");
    if (dsAdminGoc(env).includes(email)) throw new Loi(409, "Email này là Admin gốc (ADMIN_GOC), đổi trong wrangler.jsonc.");
    if (email === n.email) throw new Loi(409, "Không tự đổi vai trò của mình; nhờ Admin khác.");
    const ghiChu = chuoi(b.ghi_chu, "ghi chú", 200, false);
    const now = Date.now();
    const cu = await env.DB.prepare("SELECT vai_tro FROM qt_vai_tro WHERE email = ?").bind(email).first<{ vai_tro: VaiTro }>();
    await env.DB.prepare(
      "INSERT INTO qt_vai_tro (email, vai_tro, ghi_chu, them_boi, them_luc) VALUES (?, ?, ?, ?, ?) ON CONFLICT(email) DO UPDATE SET vai_tro = excluded.vai_tro, ghi_chu = excluded.ghi_chu, sua_boi = ?, sua_luc = ?",
    )
      .bind(email, vt, ghiChu, n.email, now, n.email, now)
      .run();
    await ghiNhatKy(env, n, "vai_tro.dat", email, { cu: cu?.vai_tro ?? null, moi: vt });
    return json({ ok: true, dong_bo: await dongBo(env) });
  },
  "POST /api/vai-tro/xoa": async ({ req, env, n }) => {
    canAdmin(n);
    const b = await than(req);
    const email = emailTu(b.email);
    if (dsAdminGoc(env).includes(email)) throw new Loi(409, "Email này là Admin gốc (ADMIN_GOC), đổi trong wrangler.jsonc.");
    if (email === n.email) throw new Loi(409, "Không tự thu quyền của mình; nhờ Admin khác.");
    const cu = await env.DB.prepare("SELECT vai_tro FROM qt_vai_tro WHERE email = ?").bind(email).first<{ vai_tro: VaiTro }>();
    if (!cu) throw new Loi(404, "Email này chưa có quyền.");
    await env.DB.prepare("DELETE FROM qt_vai_tro WHERE email = ?").bind(email).run();
    await ghiNhatKy(env, n, "vai_tro.xoa", email, { cu: cu.vai_tro });
    return json({ ok: true, dong_bo: await dongBo(env) });
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
      email: String(x.email),
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

// ---- Điểm vào -----------------------------------------------------------------------------------------------------

export default {
  async fetch(req: Request, env: Env, exec: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);
    const laApi = url.pathname.startsWith("/api/");

    const xt = await xacThuc(req, env);
    if (!xt.ok) {
      if (laApi) return loi(xt.status, xt.message);
      return voiBaoMat(new Response(trangChan(xt.message), { status: xt.status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } }));
    }

    if (!laApi) return voiBaoMat(await env.ASSETS.fetch(req));

    try {
      const vt = await vaiTroCua(env, xt.email);
      if (!vt) return loi(403, "Email này đã qua Access nhưng chưa được phân quyền trong admin. Nhờ Admin thêm ở màn Phân quyền.");
      // "Xem như Vận hành": Admin tự hạ quyền cho yêu cầu này (chỉ hạ, không bao giờ nâng).
      const xemNhu = req.headers.get("X-Xem-Nhu");
      const n: Nguoi = { email: xt.email, vaiTroThat: vt.vaiTro, vaiTro: xemNhu === "van_hanh" ? "van_hanh" : vt.vaiTro, goc: vt.goc };

      if (req.method !== "GET") {
        // Chống CSRF: chỉ nhận POST cùng nguồn, thân JSON (trình duyệt lạ phải preflight và bị chặn vì không có CORS).
        if (req.headers.get("Origin") !== url.origin) return loi(403, "Yêu cầu khác nguồn.");
        if (!(req.headers.get("Content-Type") ?? "").startsWith("application/json")) return loi(415, "Cần Content-Type: application/json.");
      }
      const h = routes[`${req.method} ${url.pathname}`];
      if (!h) return loi(404, "Không có API này.");
      return await h({ req, env, n, url, exec });
    } catch (e) {
      if (e instanceof Loi) return loi(e.status, e.message);
      console.error(`api lỗi ${req.method} ${url.pathname}: ${(e as Error)?.message ?? e}`);
      return loi(500, "Lỗi máy chủ admin.");
    }
  },
} satisfies ExportedHandler<Env>;

function trangChan(msg: string): string {
  const esc = msg.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
  return `<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Thiên Hoang Ký · Quản trị</title>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#efe6d3;color:#2a2018;font-family:Cambria,'Times New Roman',serif">
<main style="max-width:420px;margin:16px;padding:24px;background:#fffaf0;box-shadow:inset 0 0 0 1px rgba(138,31,22,.55)">
<h1 style="margin:0 0 8px;color:#8a1f16;font-size:22px">Thiên Hoang Ký · Quản trị</h1><p style="margin:0">${esc}</p></main></body></html>`;
}

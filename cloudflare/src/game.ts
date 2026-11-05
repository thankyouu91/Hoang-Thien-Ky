// Worker `thienhoangky` ở thienhoangky.fun: phục vụ bản build proto/dist (static assets, SPA) và API cho người chơi thử.
// Cả hostname nằm sau ứng dụng Access "Thiên Hoang Ký – chơi thử"; asset do Cloudflare phục vụ thẳng sau Access,
// chỉ /api/* chạy qua Worker (run_worker_first) và mọi request API đều xác minh lại JWT của Access.
// Hợp đồng: docs/api.md. Bảng game: migrations/0001_khoi_tao.sql. Bảng qt_* (thông báo, cấu hình, khóa) của Admin Dashboard.
import { THAM_SO } from "../../admin/worker/cauHinh.ts";
import { xacMinh, type CauHinhAccess } from "./access.ts";
import { docJson, json, kiemGhi, loi, LoiApi, traLoi } from "./http.ts";
import { GIOI_HAN, kiemLoSuKien, kiemPhanHoi, rutGonUA } from "./kiem.ts";

export interface EnvGame extends CauHinhAccess {
  DB: D1Database;
  ASSETS: Fetcher;
}

/** Bảng qt_* chưa tạo (Admin Dashboard chưa chạy migration): dùng mặc định thay vì lỗi. */
function thieuBang(e: unknown): boolean {
  return /no such table/i.test(String((e as Error)?.message ?? e));
}

async function biKhoa(db: D1Database, email: string): Promise<boolean> {
  try {
    const r = await db.prepare("SELECT khoa FROM qt_nguoi_choi WHERE email = ?1").bind(email).first<{ khoa: number }>();
    return r?.khoa === 1;
  } catch (e) {
    if (thieuBang(e)) return false;
    throw e;
  }
}

async function ghiNguoiChoi(db: D1Database, email: string, now: number, phienMoi = 0): Promise<void> {
  await db
    .prepare(
      `INSERT INTO nguoi_choi_thu (email, lan_dau, lan_cuoi, so_phien) VALUES (?1, ?2, ?2, ?3)
       ON CONFLICT(email) DO UPDATE SET lan_cuoi = excluded.lan_cuoi, so_phien = nguoi_choi_thu.so_phien + excluded.so_phien`,
    )
    .bind(email, now, phienMoi)
    .run();
}

async function thongBao(db: D1Database, now: number): Promise<unknown[]> {
  try {
    const { results } = await db
      .prepare(
        `SELECT id, tieu_de, noi_dung, muc, bat_dau, ket_thuc FROM qt_thong_bao
         WHERE trang_thai = 'dang' AND bat_dau <= ?1 AND (ket_thuc IS NULL OR ket_thuc > ?1)
         ORDER BY CASE muc WHEN 'quan_trong' THEN 0 ELSE 1 END, bat_dau DESC LIMIT 20`,
      )
      .bind(now)
      .all();
    return results;
  } catch (e) {
    if (thieuBang(e)) return [];
    throw e;
  }
}

async function cauHinh(db: D1Database): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {};
  for (const t of THAM_SO) out[t.khoa] = t.mac_dinh;
  try {
    const { results } = await db.prepare("SELECT khoa, gia_tri FROM qt_cau_hinh").all<{ khoa: string; gia_tri: string }>();
    for (const r of results) {
      // Chỉ trả khoá có trong định nghĩa; dòng hỏng thì giữ mặc định.
      if (!(r.khoa in out)) continue;
      try {
        out[r.khoa] = JSON.parse(r.gia_tri);
      } catch {
        // giữ mặc định
      }
    }
  } catch (e) {
    if (!thieuBang(e)) throw e;
  }
  return out;
}

const DUONG = ["/api/toi", "/api/su-kien", "/api/phan-hoi", "/api/thong-bao", "/api/cau-hinh"];

async function api(req: Request, env: EnvGame, ctx: ExecutionContext, path: string): Promise<Response> {
  const auth = await xacMinh(req, env);
  if (!auth.ok) return loi(auth.ma === "chua_cau_hinh" ? 503 : 401, auth.ma);
  const email = auth.nguoi.email;
  if (await biKhoa(env.DB, email)) return loi(403, "bi_khoa", "Tài khoản chơi thử này đang bị khóa.");
  const now = Date.now();
  const m = req.method;

  if (path === "/api/toi" && m === "GET") {
    ctx.waitUntil(ghiNguoiChoi(env.DB, email, now));
    return json({ email });
  }

  if (path === "/api/su-kien" && m === "POST") {
    kiemGhi(req);
    const lo = kiemLoSuKien(await docJson(req, GIOI_HAN.bodySuKien), now);
    const stmt = env.DB.prepare("INSERT INTO su_kien (loai, an_danh, phien, luc, nhan_luc, du_lieu, phien_ban) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)");
    const batch = lo.su_kien.map((e) => stmt.bind(e.loai, lo.an_danh, lo.phien, e.luc, now, e.du_lieu, lo.phien_ban));
    if (batch.length) await env.DB.batch(batch);
    // nguoi_choi_thu chỉ giữ email, lần đầu, lần cuối, số phiên; không nối email với mã ẩn danh.
    const phienMoi = lo.su_kien.filter((e) => e.loai === "mo_phien").length;
    ctx.waitUntil(ghiNguoiChoi(env.DB, email, now, phienMoi));
    return json({ nhan: batch.length, bo: lo.bo }, 202);
  }

  if (path === "/api/phan-hoi" && m === "POST") {
    kiemGhi(req);
    const ph = kiemPhanHoi(await docJson(req, GIOI_HAN.bodyPhanHoi));
    const dem = await env.DB.prepare("SELECT COUNT(*) AS n FROM phan_hoi WHERE email = ?1 AND luc > ?2").bind(email, now - 24 * 3600 * 1000).first<{ n: number }>();
    if ((dem?.n ?? 0) >= GIOI_HAN.phanHoiMoiNgay) throw new LoiApi(429, "qua_nhieu", `Tối đa ${GIOI_HAN.phanHoiMoiNgay} phản hồi mỗi 24 giờ.`);
    const r = await env.DB.prepare("INSERT INTO phan_hoi (email, loai, noi_dung, man, thiet_bi, phien_ban, luc) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7) RETURNING id")
      .bind(email, ph.loai, ph.noi_dung, ph.man, rutGonUA(req.headers.get("User-Agent")), ph.phien_ban, now)
      .first<{ id: number }>();
    ctx.waitUntil(ghiNguoiChoi(env.DB, email, now));
    return json({ id: r?.id ?? null }, 201);
  }

  if (path === "/api/thong-bao" && m === "GET") return json({ thong_bao: await thongBao(env.DB, now), luc: now });

  if (path === "/api/cau-hinh" && m === "GET") return json({ cau_hinh: await cauHinh(env.DB), luc: now });

  return DUONG.includes(path) ? loi(405, "sai_phuong_thuc") : loi(404, "khong_co");
}

export default {
  async fetch(req: Request, env: EnvGame, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
      try {
        return await api(req, env, ctx, url.pathname.replace(/\/+$/, ""));
      } catch (e) {
        return traLoi(e);
      }
    }
    // Phần còn lại là asset (thường Cloudflare phục vụ thẳng, không vào Worker).
    return env.ASSETS.fetch(req);
  },
} satisfies ExportedHandler<EnvGame>;

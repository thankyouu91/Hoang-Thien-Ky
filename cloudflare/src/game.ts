// Worker `thienhoangky` ở play.thienhoangky.fun: bản chơi thử mở bằng link mời (không qua Cloudflare Access).
// Cookie thk_moi gắn Domain=thienhoangky.fun, nên website (tên gốc) và wiki dùng chung cổng: chỉ cần tra the_hash.
//   /moi/<ma>  — kiểm link mời (bảng loi_moi), tạo người chơi thử, cấp cookie thk_moi rồi chuyển về /.
//   HTML, /api/* — chỉ cho trình duyệt có cookie thk_moi hợp lệ và chưa bị khóa.
//   /assets/*, /pixellab/*, /icon_ve/* — Cloudflare phục vụ thẳng, không qua Worker (khỏi tốn lượt request của gói free);
//     tên file JS có mã băm và chỉ biết được qua HTML đã chặn.
// Hợp đồng: docs/api.md. Bảng game: migrations/. Bảng qt_* (thông báo, cấu hình) của Admin Dashboard.
import { THAM_SO } from "../../admin/worker/cauHinh.ts";
import { docJson, json, kiemGhi, loi, LoiApi, traLoi } from "./http.ts";
import { GIOI_HAN, kiemLoSuKien, kiemPhanHoi, rutGonUA } from "./kiem.ts";
import { bamThe, chuanMa, datCookie, docThe, maDoc, taoThe } from "./moi.ts";
import { ROBOTS, trangBiKhoa, trangCanLinkMoi, trangLinkHong } from "./trang.ts";

export interface EnvGame {
  DB: D1Database;
  ASSETS: Fetcher;
}

interface NguoiChoi {
  id: string;
  khoa: number;
}

/** Bảng qt_* chưa tạo (Admin Dashboard chưa chạy migration): dùng mặc định thay vì lỗi. */
function thieuBang(e: unknown): boolean {
  return /no such table/i.test(String((e as Error)?.message ?? e));
}

async function nguoiCuaCookie(req: Request, db: D1Database): Promise<NguoiChoi | null> {
  const the = docThe(req.headers.get("Cookie"));
  if (!the) return null;
  return db.prepare("SELECT id, khoa FROM nguoi_choi_thu WHERE the_hash = ?1").bind(await bamThe(the)).first<NguoiChoi>();
}

/** /moi/<ma>: dùng một lượt của link và cấp cookie. Trình duyệt đã có cookie hợp lệ thì không tốn lượt. */
async function nhanLoiMoi(req: Request, env: EnvGame, raw: string): Promise<Response> {
  const daCo = await nguoiCuaCookie(req, env.DB);
  // Người bị khóa mở lại link mời thì vẫn báo khóa, không cấp danh tính mới.
  if (daCo) return daCo.khoa === 1 ? trangBiKhoa() : Response.redirect(new URL("/", req.url).toString(), 302);
  const ma = chuanMa(raw);
  if (!ma) return trangLinkHong();
  const now = Date.now();
  const dung = await env.DB.prepare(
    `UPDATE loi_moi SET da_dung = da_dung + 1
     WHERE ma = ?1 AND tat = 0 AND (het_han IS NULL OR het_han > ?2) AND (toi_da IS NULL OR da_dung < toi_da)
     RETURNING ma`,
  )
    .bind(ma, now)
    .first<{ ma: string }>();
  if (!dung) return trangLinkHong();
  const the = taoThe();
  await env.DB.prepare("INSERT INTO nguoi_choi_thu (id, the_hash, ma_moi, lan_dau, lan_cuoi) VALUES (?1, ?2, ?3, ?4, ?4)")
    .bind(maDoc(10), await bamThe(the), ma, now)
    .run();
  return new Response(null, { status: 302, headers: { Location: "/", "Set-Cookie": datCookie(the, new URL(req.url).hostname), "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
}

async function ghiLanCuoi(db: D1Database, id: string, now: number, phienMoi = 0): Promise<void> {
  await db.prepare("UPDATE nguoi_choi_thu SET lan_cuoi = ?2, so_phien = so_phien + ?3 WHERE id = ?1").bind(id, now, phienMoi).run();
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

/** Mặc định ở admin/worker/cauHinh.ts, đè bằng mọi dòng trong qt_cau_hinh (cả khoá mới admin thêm sau). */
async function cauHinh(db: D1Database): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {};
  for (const t of THAM_SO) out[t.khoa] = t.mac_dinh;
  try {
    const { results } = await db.prepare("SELECT khoa, gia_tri FROM qt_cau_hinh").all<{ khoa: string; gia_tri: string }>();
    for (const r of results) {
      try {
        out[r.khoa] = JSON.parse(r.gia_tri);
      } catch {
        // dòng hỏng: giữ mặc định
      }
    }
  } catch (e) {
    if (!thieuBang(e)) throw e;
  }
  return out;
}

const DUONG = ["/api/toi", "/api/su-kien", "/api/phan-hoi", "/api/thong-bao", "/api/cau-hinh"];

async function api(req: Request, env: EnvGame, ctx: ExecutionContext, path: string, nguoi: NguoiChoi): Promise<Response> {
  const now = Date.now();
  const m = req.method;

  if (path === "/api/toi" && m === "GET") {
    ctx.waitUntil(ghiLanCuoi(env.DB, nguoi.id, now));
    return json({ nguoi_choi: nguoi.id });
  }

  if (path === "/api/su-kien" && m === "POST") {
    kiemGhi(req);
    const lo = kiemLoSuKien(await docJson(req, GIOI_HAN.bodySuKien), now);
    const stmt = env.DB.prepare("INSERT INTO su_kien (loai, an_danh, phien, luc, nhan_luc, du_lieu, phien_ban) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)");
    const batch = lo.su_kien.map((e) => stmt.bind(e.loai, lo.an_danh, lo.phien, e.luc, now, e.du_lieu, lo.phien_ban));
    if (batch.length) await env.DB.batch(batch);
    // Sự kiện không mang id người chơi; nguoi_choi_thu chỉ giữ lần cuối và số phiên.
    ctx.waitUntil(ghiLanCuoi(env.DB, nguoi.id, now, lo.su_kien.filter((e) => e.loai === "mo_phien").length));
    return json({ nhan: batch.length, bo: lo.bo }, 202);
  }

  if (path === "/api/phan-hoi" && m === "POST") {
    kiemGhi(req);
    const ph = kiemPhanHoi(await docJson(req, GIOI_HAN.bodyPhanHoi));
    const dem = await env.DB.prepare("SELECT COUNT(*) AS n FROM phan_hoi WHERE nguoi_choi = ?1 AND luc > ?2").bind(nguoi.id, now - 24 * 3600 * 1000).first<{ n: number }>();
    if ((dem?.n ?? 0) >= GIOI_HAN.phanHoiMoiNgay) throw new LoiApi(429, "qua_nhieu", `Tối đa ${GIOI_HAN.phanHoiMoiNgay} phản hồi mỗi 24 giờ.`);
    const r = await env.DB.prepare(
      "INSERT INTO phan_hoi (nguoi_choi, loai, noi_dung, man, lien_he, thiet_bi, phien_ban, luc) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8) RETURNING id",
    )
      .bind(nguoi.id, ph.loai, ph.noi_dung, ph.man, ph.lien_he, rutGonUA(req.headers.get("User-Agent")), ph.phien_ban, now)
      .first<{ id: number }>();
    return json({ id: r?.id ?? null }, 201);
  }

  if (path === "/api/thong-bao" && m === "GET") return json({ thong_bao: await thongBao(env.DB, now), luc: now });

  if (path === "/api/cau-hinh" && m === "GET") return json({ cau_hinh: await cauHinh(env.DB), luc: now });

  return DUONG.includes(path) ? loi(405, "sai_phuong_thuc") : loi(404, "khong_co");
}

/** Trang HTML của game: không để trình duyệt hay proxy giữ bản đã qua cổng. */
async function phucVuTrang(req: Request, env: EnvGame): Promise<Response> {
  const r = await env.ASSETS.fetch(req);
  if (!(r.headers.get("Content-Type") ?? "").includes("text/html")) return r;
  const out = new Response(r.body, r);
  out.headers.set("Cache-Control", "private, no-cache");
  out.headers.set("Referrer-Policy", "no-referrer");
  return out;
}

export default {
  async fetch(req: Request, env: EnvGame, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;
    const laApi = path === "/api" || path.startsWith("/api/");
    try {
      if (path === "/robots.txt") return new Response(ROBOTS, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
      if (path.startsWith("/moi/")) return await nhanLoiMoi(req, env, path.slice(5).replace(/\/+$/, ""));

      const nguoi = await nguoiCuaCookie(req, env.DB);
      if (!nguoi) return laApi ? loi(401, "chua_co_loi_moi", "Cần mở link mời trước.") : trangCanLinkMoi();
      if (nguoi.khoa === 1) return laApi ? loi(403, "bi_khoa", "Tài khoản chơi thử này đang bị khóa.") : trangBiKhoa();
      if (laApi) return await api(req, env, ctx, path.replace(/\/+$/, ""), nguoi);
      return await phucVuTrang(req, env);
    } catch (e) {
      if (laApi) return traLoi(e);
      console.error("loi_trang", e instanceof Error ? e.message : String(e));
      return new Response("Lỗi máy chủ, thử lại sau ít phút.", { status: 500, headers: { "Content-Type": "text/plain; charset=utf-8" } });
    }
  },
} satisfies ExportedHandler<EnvGame>;

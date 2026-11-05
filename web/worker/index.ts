// Worker `thienhoangky-web` ở https://thienhoangky.fun: website của game (trang tĩnh trong dist/).
// Website kín như game, vì chưa có giấy phép G1 thì chưa được quảng cáo game (Nghị định 147): chỉ trình duyệt đã mở link mời
// của bản chơi thử (cookie thk_moi, cấp ở choi.thienhoangky.fun/moi/<ma> với Domain=thienhoangky.fun) mới xem được.
// Cùng một bảng nguoi_choi_thu với Worker game, nên khóa người chơi ở Admin thì cũng khóa website.
//
//   HTML, /api/gop-y  — kiểm cookie thk_moi trong D1 (chỉ đọc nguoi_choi_thu; /api/gop-y ghi phan_hoi như API game).
//   /assets/*, /hinh/* — Cloudflare phục vụ thẳng, không chạy Worker (JS có mã băm, hình đã có trong repo public).
//   /moi/*            — chuyển sang game, nơi cấp cookie.
//
// Mở công khai sau khi có G1: đặt CONG_KHAI = "1" trong wrangler.jsonc rồi deploy (bỏ cả thẻ robots trong src/manh/mo.html).
// Hợp đồng bảng D1 ở docs/api.md; hàm cookie, kiểm dữ liệu và JSON dùng chung với Worker game (cloudflare/src).
import { docJson, json, kiemGhi, loi, LoiApi, traLoi } from "../../cloudflare/src/http.ts";
import { GIOI_HAN, kiemPhanHoi, rutGonUA } from "../../cloudflare/src/kiem.ts";
import { bamThe, docThe } from "../../cloudflare/src/moi.ts";
import { trangBiKhoa, trangCanLinkMoi } from "./trang.ts";

export interface EnvWeb {
  ASSETS: Fetcher;
  DB: D1Database;
  /** "1": mở công khai, không kiểm cookie với trang HTML (góp ý vẫn cần cookie). */
  CONG_KHAI?: string;
  /** Gốc của game, mặc định https://choi.thienhoangky.fun. */
  CHOI_URL?: string;
}

interface NguoiChoi {
  id: string;
  khoa: number;
}

async function nguoiCuaCookie(req: Request, db: D1Database): Promise<NguoiChoi | null> {
  const the = docThe(req.headers.get("Cookie"));
  if (!the) return null;
  return db.prepare("SELECT id, khoa FROM nguoi_choi_thu WHERE the_hash = ?1").bind(await bamThe(the)).first<NguoiChoi>();
}

/** POST /api/gop-y: như POST /api/phan-hoi của game, ghi vào phan_hoi với man bắt đầu bằng "website". Không có ô liên hệ. */
async function gopY(req: Request, env: EnvWeb, nguoi: NguoiChoi): Promise<Response> {
  if (req.method !== "POST") return loi(405, "sai_phuong_thuc");
  kiemGhi(req);
  const ph = kiemPhanHoi(await docJson(req, GIOI_HAN.bodyPhanHoi));
  const now = Date.now();
  const dem = await env.DB.prepare("SELECT COUNT(*) AS n FROM phan_hoi WHERE nguoi_choi = ?1 AND luc > ?2").bind(nguoi.id, now - 24 * 3600 * 1000).first<{ n: number }>();
  if ((dem?.n ?? 0) >= GIOI_HAN.phanHoiMoiNgay) throw new LoiApi(429, "qua_nhieu", `Tối đa ${GIOI_HAN.phanHoiMoiNgay} phản hồi mỗi 24 giờ.`);
  const man = ("website" + (ph.man?.startsWith("website") ? ph.man.slice(7) : "")).slice(0, 60);
  const r = await env.DB.prepare(
    "INSERT INTO phan_hoi (nguoi_choi, loai, noi_dung, man, lien_he, thiet_bi, phien_ban, luc) VALUES (?1, ?2, ?3, ?4, NULL, ?5, ?6, ?7) RETURNING id",
  )
    .bind(nguoi.id, ph.loai, ph.noi_dung, man, rutGonUA(req.headers.get("User-Agent")), "web", now)
    .first<{ id: number }>();
  return json({ id: r?.id ?? null }, 201);
}

/** Header cho trang đã qua cổng: không để bộ đệm dùng chung giữ trang kín; chưa công khai thì không lập chỉ mục. */
function ganHeader(res: Response, congKhai: boolean): Response {
  const out = new Response(res.body, res);
  const html = (out.headers.get("Content-Type") ?? "").includes("text/html");
  if (html) out.headers.set("Cache-Control", congKhai ? "public, max-age=0, must-revalidate" : "private, no-cache");
  if (!congKhai) out.headers.set("X-Robots-Tag", "noindex, nofollow");
  return out;
}

export default {
  async fetch(req: Request, env: EnvWeb): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;
    const choi = (env.CHOI_URL ?? "https://choi.thienhoangky.fun").replace(/\/+$/, "");
    const congKhai = env.CONG_KHAI === "1";
    const api = path.startsWith("/api/");
    try {
      // Link mời gõ nhầm sang tên gốc: chuyển sang game, nơi cấp cookie.
      if (path.startsWith("/moi/")) return Response.redirect(`${choi}${path}${url.search}`, 302);
      if (path === "/robots.txt") {
        return new Response(congKhai ? "User-agent: *\nAllow: /\n" : "User-agent: *\nDisallow: /\n", {
          headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" },
        });
      }
      if (!congKhai || api) {
        const nguoi = await nguoiCuaCookie(req, env.DB);
        if (!nguoi) return api ? loi(401, "chua_co_loi_moi", "Trình duyệt này chưa mở link mời chơi thử.") : trangCanLinkMoi(choi);
        if (nguoi.khoa === 1) return api ? loi(403, "bi_khoa") : trangBiKhoa();
        if (path === "/api/gop-y") return await gopY(req, env, nguoi);
        if (api) return loi(404, "khong_co");
      }
      return ganHeader(await env.ASSETS.fetch(req), congKhai);
    } catch (e) {
      if (api || e instanceof LoiApi) return traLoi(e);
      console.error("loi_web", e instanceof Error ? (e.stack ?? e.message) : String(e));
      return new Response("Máy chủ lỗi, thử lại sau.", { status: 500, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
    }
  },
} satisfies ExportedHandler<EnvWeb>;

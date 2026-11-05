// Worker `thienhoangky-wiki` ở wiki.thienhoangky.fun: phục vụ bản build VitePress (docs/.vitepress/dist) sau cổng vào.
// Wiki kín như game: chỉ người chơi được mời mới xem được (docs/api.md mục "Link mời và cookie", điểm 7).
// CONG chọn cách kiểm (wrangler.jsonc, biến CONG):
//   "loi_moi" — dùng chung cookie link mời thk_moi của game (cloudflare/src/moi.ts). Cần cookie đặt Domain=thienhoangky.fun
//               để trình duyệt gửi sang wiki.*; Worker tra the_hash trong nguoi_choi_thu (D1 thienhoangky), chỉ đọc.
//   "access"  — Cloudflare Access đứng trước hostname; Worker kiểm thêm JWT (admin/worker/jwt.ts), sai cấu hình cũng không lộ.
//   "mo"      — không chặn, chỉ để chạy thử ở máy (wrangler dev). Trên mạng mà để "mo" thì Worker từ chối phục vụ.
// /assets/* (JS, CSS, font có mã băm, kể cả chỉ mục tìm kiếm) và /hinh/* (icon) được phục vụ thẳng, không qua Worker
// (run_worker_first), giống game: tên file có mã băm chỉ biết được qua HTML đã chặn.
import { certsUrl, defaultKeyLoader, verifyAccessJwt } from "../../admin/worker/jwt.ts";
import { bamThe, docThe } from "../../cloudflare/src/moi.ts";

export interface EnvWiki {
  ASSETS: Fetcher;
  DB?: D1Database;
  CONG?: string;
  LINK_GAME?: string;
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;
}

const HEADER_CHUNG: Record<string, string> = {
  "X-Robots-Tag": "noindex, nofollow",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "same-origin",
  "X-Frame-Options": "DENY",
};

const ROBOTS = "User-agent: *\nDisallow: /\n";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Trang báo ngắn cùng phong cách giấy kem của wiki. */
export function trangBao(status: number, tieuDe: string, loi: string, linkGame: string): Response {
  const html = `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>${esc(tieuDe)} · Wiki Thiên Hoang Ký</title>
<style>
body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f6efdf;color:#2a2018;font:16px/1.6 Cambria,"Times New Roman",serif}
main{box-sizing:border-box;width:min(440px,calc(100% - 32px));padding:28px 24px;background:#fffaf0;box-shadow:inset 0 0 0 1px rgba(138,31,22,.55),0 0 0 4px #fffaf0,0 0 0 5px rgba(138,31,22,.18)}
h1{margin:0 0 10px;color:#8a1f16;font-size:26px;line-height:1.2}p{margin:0 0 14px}
a.nut{display:inline-block;padding:10px 18px;border-radius:3px;background:#b3261e;color:#fff8ef;text-decoration:none;font-weight:600}
.an{display:inline-grid;place-items:center;width:44px;height:44px;margin-bottom:12px;border-radius:4px;background:#b3261e;color:#fff8ef;font-weight:700;transform:rotate(-4deg)}
</style></head><body><main><div class="an" aria-hidden="true">記</div><h1>${esc(tieuDe)}</h1><p>${loi}</p>
<p><a class="nut" href="${esc(linkGame)}">Vào game</a></p></main></body></html>`;
  return new Response(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", ...HEADER_CHUNG },
  });
}

type KetQua = { ok: true } | { ok: false; res: Response };

async function kiemLoiMoi(req: Request, env: EnvWiki, linkGame: string): Promise<KetQua> {
  const the = docThe(req.headers.get("Cookie"));
  const can = trangBao(
    403,
    "Wiki dành cho người chơi thử",
    "Mở link mời của game trên trình duyệt này trước, rồi quay lại trang wiki. Wiki dùng chung lời mời với game.",
    linkGame,
  );
  if (!the || !env.DB) return { ok: false, res: can };
  const r = await env.DB.prepare("SELECT khoa FROM nguoi_choi_thu WHERE the_hash = ?1").bind(await bamThe(the)).first<{ khoa: number }>();
  if (!r) return { ok: false, res: can };
  if (r.khoa === 1) return { ok: false, res: trangBao(403, "Tài khoản chơi thử đã bị khóa", "Trình duyệt này không còn quyền vào bản chơi thử và wiki.", linkGame) };
  return { ok: true };
}

async function kiemAccess(req: Request, env: EnvWiki, linkGame: string): Promise<KetQua> {
  const token = req.headers.get("Cf-Access-Jwt-Assertion");
  const tu = trangBao(403, "Chưa đăng nhập", "Wiki chỉ mở cho người được mời. Đăng nhập lại qua trang Cloudflare Access.", linkGame);
  if (!token) return { ok: false, res: tu };
  const team = env.ACCESS_TEAM_DOMAIN ?? "";
  const v = await verifyAccessJwt(token, { teamDomain: team, aud: env.ACCESS_AUD ?? "", loadKeys: defaultKeyLoader(certsUrl(team)) });
  return v.ok ? { ok: true } : { ok: false, res: tu };
}

function laMayCucBo(url: URL): boolean {
  return url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]";
}

export async function xuLy(req: Request, env: EnvWiki): Promise<Response> {
  const url = new URL(req.url);
  const linkGame = env.LINK_GAME || "https://play.thienhoangky.fun";
  if (req.method !== "GET" && req.method !== "HEAD") {
    return new Response("Chỉ đọc", { status: 405, headers: { Allow: "GET, HEAD", ...HEADER_CHUNG } });
  }
  if (url.pathname === "/robots.txt") {
    return new Response(ROBOTS, { headers: { "Content-Type": "text/plain; charset=utf-8", ...HEADER_CHUNG } });
  }

  const cong = env.CONG ?? "loi_moi";
  let kq: KetQua;
  if (cong === "loi_moi") kq = await kiemLoiMoi(req, env, linkGame);
  else if (cong === "access") kq = await kiemAccess(req, env, linkGame);
  else if (cong === "mo" && laMayCucBo(url)) kq = { ok: true };
  else kq = { ok: false, res: trangBao(503, "Wiki chưa mở", "Cổng vào wiki chưa cấu hình xong.", linkGame) };
  if (!kq.ok) return kq.res;

  const res = await env.ASSETS.fetch(req);
  const out = new Response(res.body, res);
  for (const [k, v] of Object.entries(HEADER_CHUNG)) out.headers.set(k, v);
  // Trang và dữ liệu sau cổng: không cho bộ nhớ đệm dùng chung giữ lại.
  out.headers.set("Cache-Control", "private, no-cache");
  return out;
}

export default { fetch: xuLy } satisfies ExportedHandler<EnvWiki>;

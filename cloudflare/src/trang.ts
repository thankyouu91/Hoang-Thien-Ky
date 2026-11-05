// Trang báo ngắn của Worker game (chưa có link mời, link hết hạn, bị khóa), tông giấy kem như màn đăng nhập.

const DAU = `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><meta name="theme-color" content="#f6efdf"><title>Thiên Hoang Ký</title>
<style>
:root{color-scheme:light}
body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;box-sizing:border-box;background:#f6efdf;color:#2b2420;
font:16px/1.55 "Be Vietnam Pro","Segoe UI",system-ui,sans-serif}
main{max-width:400px;padding:28px 24px;background:#fffaf0;box-shadow:inset 0 0 0 1px #8a1f16,0 0 0 4px #fffaf0,0 0 0 5px rgba(138,31,22,.18),0 10px 30px rgba(60,40,20,.12);text-align:center}
.an{display:inline-grid;place-items:center;width:52px;height:52px;margin-bottom:14px;border-radius:6px;background:#b3261e;color:#fff6ee;
font:600 18px/1 "Noto Serif SC","SimSun",serif;transform:rotate(-3deg)}
h1{margin:0 0 6px;font:700 26px/1.2 "Lora","Cormorant Garamond",Georgia,serif}
h2{margin:0 0 12px;color:#8a1f16;font-size:17px}
p{margin:0 0 10px;color:#5a4d44}
small{color:#8a7b70}
</style></head><body><main><span class="an" aria-hidden="true">天</span><h1>Thiên Hoang Ký</h1>`;

function trang(status: number, tieuDe: string, doan: string[], extra: Record<string, string> = {}): Response {
  const body = `${DAU}<h2>${tieuDe}</h2>${doan.map((d) => `<p>${d}</p>`).join("")}<small>Bản chơi thử, chưa phát hành.</small></main></body></html>`;
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "no-referrer",
      "X-Robots-Tag": "noindex",
      ...extra,
    },
  });
}

export const trangCanLinkMoi = () =>
  trang(403, "Bản chơi thử cần link mời", ["Thiên Hoang Ký đang mở chơi thử cho người có link mời.", "Nếu bạn đã nhận link, hãy mở đúng link đó trên trình duyệt bạn định chơi."]);

export const trangLinkHong = () =>
  trang(410, "Link mời không dùng được", ["Link này đã hết lượt, hết hạn, đã tắt hoặc gõ chưa đúng.", "Hãy xin link mới từ người đã mời bạn."]);

export const trangBiKhoa = () => trang(403, "Tài khoản chơi thử đã bị khóa", ["Nếu bạn nghĩ đây là nhầm lẫn, hãy liên hệ người đã mời bạn."]);

export const ROBOTS = "User-agent: *\nDisallow: /\n";

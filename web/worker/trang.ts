// Trang báo ngắn của website khi chưa qua cổng: chưa mở link mời, hoặc bị khóa. Cùng tông giấy kem với website.
// Không dùng file của dist/ vì trang này phải hiện được cả khi chưa qua cổng (không lộ nội dung khác).

const DAU = `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><meta name="theme-color" content="#f6efdf"><title>Thiên Hoang Ký</title>
<link rel="icon" href="/hinh/brand/favicon-32.png" sizes="32x32" type="image/png"><link rel="icon" href="/hinh/brand/favicon.ico" sizes="any">
<style>
:root{color-scheme:light}
body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;box-sizing:border-box;background:#f6efdf;color:#2a2018;
font:16px/1.6 "Lora","Cambria","Times New Roman",serif}
main{max-width:420px;padding:30px 24px 26px;background:#fffaf0;box-shadow:inset 0 0 0 1px rgba(138,31,22,.55),0 0 0 4px #fffaf0,0 0 0 5px rgba(138,31,22,.18),0 10px 30px rgba(60,40,20,.12);text-align:center}
.an{display:block;width:112px;height:112px;margin:0 auto 12px}
h1{margin:0 0 6px;font:700 30px/1.15 "Cormorant Garamond","Lora",Georgia,serif}
h2{margin:0 0 14px;color:#8a1f16;font-size:17px}
p{margin:0 0 10px;color:#5a4a3b}
small{display:block;margin-top:14px;color:#76634f}
a{color:#8a1f16}
</style></head><body><main><img class="an" src="/hinh/brand/dau_an_256.webp" width="112" height="112" alt=""><h1>Thiên Hoang Ký</h1>`;

function trang(status: number, tieuDe: string, doan: string[]): Response {
  const body = `${DAU}<h2>${tieuDe}</h2>${doan.map((d) => `<p>${d}</p>`).join("")}<small>Game đang trong thời gian phát triển và open test.</small></main></body></html>`;
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "no-referrer",
      "X-Robots-Tag": "noindex",
    },
  });
}

export const trangCanLinkMoi = (choi: string) =>
  trang(403, "Trang này dành cho người được mời", [
    "Thiên Hoang Ký đang thử nghiệm kín. Website và bản chơi thử chỉ mở cho người có link mời.",
    `Nếu bạn đã nhận link (dạng <b>${choi.replace(/^https:\/\//, "")}/moi/…</b>), hãy mở link đó trên trình duyệt này một lần, rồi quay lại đây.`,
  ]);

export const trangBiKhoa = () => trang(403, "Tài khoản chơi thử đã bị khóa", ["Nếu bạn nghĩ đây là nhầm lẫn, hãy liên hệ người đã mời bạn."]);

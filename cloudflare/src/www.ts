// Worker `thienhoangky-www`: chuyển hẳn (301) các tên miền cũ hoặc phụ về tên chính, giữ đường dẫn và query.
//   www.thienhoangky.fun  → https://thienhoangky.fun   (website)
//   choi.thienhoangky.fun → https://play.thienhoangky.fun (game dời sang play ngày 2026-11-05; giữ để link mời đã phát vẫn chạy)
// Không phục vụ nội dung gì; trang đích có cổng link mời riêng.
const DICH: Record<string, string> = {
  "www.thienhoangky.fun": "https://thienhoangky.fun",
  "choi.thienhoangky.fun": "https://play.thienhoangky.fun",
};

export function dichDen(url: URL): string {
  return `${DICH[url.hostname] ?? "https://thienhoangky.fun"}${url.pathname}${url.search}`;
}

export default {
  async fetch(req: Request): Promise<Response> {
    return Response.redirect(dichDen(new URL(req.url)), 301);
  },
} satisfies ExportedHandler;

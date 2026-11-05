// Worker `thienhoangky-www`: www.thienhoangky.fun chuyển hẳn (301) về https://thienhoangky.fun, giữ đường dẫn và query.
// Không phục vụ nội dung gì, nên không cần Access; trang đích vẫn nằm sau Access.
export default {
  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    return Response.redirect(`https://thienhoangky.fun${url.pathname}${url.search}`, 301);
  },
} satisfies ExportedHandler;

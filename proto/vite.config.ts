import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const page = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  // Đường dẫn tương đối để bản build tĩnh chạy được ở mọi thư mục con của host.
  base: "./",
  // Hình PixelLab phục vụ thẳng từ assets/ của repo: /pixellab/manifest.json, /pixellab/<nhóm>/<tên>.png
  publicDir: "../assets",
  server: { host: true, port: 5173 },
  preview: { host: true, port: 4173 },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    // Trang dev đi kèm bản build (thienhoangky.fun/three.html, /src/hieu_ung/xem_thu/), vì cả site nằm sau Cloudflare Access.
    rolldownOptions: {
      input: { main: page("./index.html"), choi: page("./choi.html"), three: page("./three.html"), xem_thu: page("./src/hieu_ung/xem_thu/index.html") },
    },
  },
});

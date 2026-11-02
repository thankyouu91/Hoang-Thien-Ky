import { defineConfig } from "vite";

export default defineConfig({
  // Đường dẫn tương đối để bản build tĩnh chạy được ở mọi thư mục con của host.
  base: "./",
  // Hình PixelLab phục vụ thẳng từ assets/ của repo: /pixellab/manifest.json, /pixellab/<nhóm>/<tên>.png
  publicDir: "../assets",
  server: { host: true, port: 5173 },
  preview: { host: true, port: 4173 },
  build: { outDir: "dist", emptyOutDir: true },
});

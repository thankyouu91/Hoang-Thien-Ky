import { mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";

const page = (p: string) => fileURLToPath(new URL(p, import.meta.url));

/**
 * App sửa map (sua_map.html) ghi assets/map_khu/<tên>.json qua dev server (POST /__map/<tên>) và cập nhật index.json,
 * danh sách map để game nạp. Đọc thì lấy file tĩnh /map_khu/<tên>.json (assets/ là publicDir). Chỉ có khi chạy dev. Tên chỉ gồm chữ thường, số, gạch dưới (không ra khỏi thư mục); POST phải kèm header riêng,
 * để trang web lạ mở trên cùng máy không ghi file được.
 */
const mapKhu: Plugin = {
  name: "htk-map-khu",
  configureServer(server) {
    const dir = page("../assets/map_khu");
    server.middlewares.use("/__map", (req, res) => {
      const id = (req.url ?? "").slice(1).split("?")[0];
      const end = (code: number, body = "") => {
        res.statusCode = code;
        res.end(body);
      };
      if (!/^[a-z0-9_]+$/.test(id) || id === "index") return end(400);
      const file = join(dir, id + ".json");
      if (req.method !== "POST" || req.headers["x-htk-map"] !== "1") return end(405);
      let body = "";
      req.on("data", (c) => {
        body += c;
        if (body.length > 2e6) req.destroy();
      });
      req.on("end", () => {
        try {
          const json = JSON.stringify(JSON.parse(body), null, 1) + "\n";
          mkdirSync(dir, { recursive: true });
          writeFileSync(file, json);
          const ids = readdirSync(dir).filter((f) => f.endsWith(".json") && f !== "index.json").map((f) => f.slice(0, -5)).sort();
          writeFileSync(join(dir, "index.json"), JSON.stringify(ids, null, 1) + "\n");
          end(200, "ok");
        } catch {
          end(400);
        }
      });
    });
  },
};

export default defineConfig({
  plugins: [mapKhu],
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
      input: { main: page("./index.html"), dong_phu: page("./dong_phu.html"), sua_map: page("./sua_map.html"), three: page("./three.html"), xem_thu: page("./src/hieu_ung/xem_thu/index.html") },
    },
  },
});

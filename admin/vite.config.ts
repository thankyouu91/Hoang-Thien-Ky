import { defineConfig } from "vite";

// Chạy thử cục bộ: `npm run dev:api` (wrangler dev, cổng 8788) rồi `npm run dev`. Vite chuyển /api sang wrangler và
// gắn JWT thử từ biến THK_DEV_JWT (test/dev.ts in ra), vì Worker luôn đòi JWT Access, không có lối tắt nào.
const jwt = process.env.THK_DEV_JWT;

export default defineConfig({
  server: {
    port: 5180,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8788",
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on("proxyReq", (req) => {
            if (jwt) req.setHeader("Cf-Access-Jwt-Assertion", jwt);
            // Worker so Origin với chính nó (chống CSRF); qua proxy thì đổi cho khớp.
            if (req.getHeader("origin")) req.setHeader("origin", "http://127.0.0.1:8788");
          });
        },
      },
    },
  },
  build: { outDir: "dist", emptyOutDir: true, assetsInlineLimit: 0 },
});

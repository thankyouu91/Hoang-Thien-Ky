import { defineConfig } from "vite";

// Chạy thử cục bộ: `npm run dev` (test/dev.ts) chạy wrangler dev ở cổng 8788 và Vite ở 5180; Vite chuyển /api sang wrangler.
// Cookie phiên __Host-qt đi qua proxy như thường; Worker so Origin với chính nó (chống CSRF) nên qua proxy phải đổi Origin.
export default defineConfig({
  server: {
    port: 5180,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8788",
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on("proxyReq", (req) => {
            if (req.getHeader("origin")) req.setHeader("origin", "http://127.0.0.1:8788");
          });
        },
      },
    },
  },
  build: { outDir: "dist", emptyOutDir: true, assetsInlineLimit: 0 },
});

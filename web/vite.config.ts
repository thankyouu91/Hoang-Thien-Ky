// Website thienhoangky.fun: trang tĩnh nhiều trang bằng Vite (cùng bản 8.3.5 với proto/ và admin/).
// Chọn Vite thay cho Astro: 8 trang HTML tĩnh, không cần framework; dùng thẳng lớp Three.js dùng chung ở proto/src/three
// (file .ts) mà không cần adapter; không thêm một bộ công cụ và một bản Vite khác vào repo.
// Phần dùng chung (đầu trang, chân trang, thư viện hình) chèn lúc build bằng plugin `manh` bên dưới, nên trang ra HTML đầy đủ,
// đọc được khi tắt JavaScript.
import { readFileSync } from "node:fs";
import { relative } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";

const goc = (p: string) => fileURLToPath(new URL(p, import.meta.url));

/** Các trang; khoá là tên trong rollup, giá trị là file HTML. Thêm trang thì thêm ở đây và trong src/manh/dau.html. */
const TRANG = {
  index: "index.html",
  the_gioi: "the-gioi/index.html",
  diem_rieng: "diem-rieng/index.html",
  thu_vien: "thu-vien/index.html",
  lo_trinh: "lo-trinh/index.html",
  nhat_ky: "nhat-ky/index.html",
  gop_y: "gop-y/index.html",
  khong_co: "404.html",
};

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

interface Anh {
  file: string;
  ten: string;
  phu: string;
  kieu: "pix" | "ve" | "dao";
  w: number;
  h: number;
  bam: string;
}
interface Nhom {
  id: string;
  ten: string;
  mo_ta: string;
  nguon: string;
  anh: Anh[];
}

/** Cỡ hiển thị: hình pixel phóng nguyên lần (2× với hình nhỏ), tranh vẽ giữ cỡ đã thu. */
function coHien(a: Anh): [number, number] {
  if (a.kieu !== "pix") return [a.w, a.h];
  const k = a.w <= 96 ? 2 : 1;
  return [a.w * k, a.h * k];
}

function hinhHtml(a: Anh, lop = ""): string {
  const [w, h] = coHien(a);
  const src = `/hinh/${a.file}?v=${a.bam.slice(0, 8)}`;
  const alt = a.phu ? `${a.ten}, ${a.phu}` : a.ten;
  return `<figure class="anh anh-${a.kieu}${lop ? " " + lop : ""}"><button type="button" class="phong" data-src="${src}" data-ten="${esc(alt)}" aria-label="Xem lớn: ${esc(alt)}"><img src="${src}" width="${w}" height="${h}" alt="${esc(alt)}" loading="lazy" decoding="async"></button><figcaption>${esc(a.ten)}${a.phu ? `<small>${esc(a.phu)}</small>` : ""}</figcaption></figure>`;
}

/** Đọc lại src/hinh.json mỗi lần dựng trang (scripts/hinh.mjs sinh ra). */
function docHinh(): Nhom[] {
  return JSON.parse(readFileSync(goc("./src/hinh.json"), "utf8")).nhom as Nhom[];
}

/** `<!--#hinh:nhom/file-->`: một hình lẻ; `<!--#nhom:id-->`: cả nhóm của thư viện; `<!--#dai:id:n-->`: n hình đầu, không chú thích dài. */
function chenHinh(html: string): string {
  const nhom = docHinh();
  const tim = (file: string) => nhom.flatMap((g) => g.anh).find((a) => a.file === file);
  return html
    .replace(/<!--#hinh:([^:>]+?)(?::([a-z-]+))?-->/g, (_, file: string, lop?: string) => {
      const a = tim(file);
      if (!a) throw new Error(`Không có hình ${file} trong src/hinh.json`);
      return hinhHtml(a, lop);
    })
    .replace(/<!--#nhom:([a-z_]+)-->/g, (_, id: string) => {
      const g = nhom.find((x) => x.id === id);
      if (!g) throw new Error(`Không có nhóm ${id} trong src/hinh.json`);
      return `<section class="nhom" id="${g.id}" aria-labelledby="h-${g.id}"><header class="nhom-dau"><h2 id="h-${g.id}">${esc(g.ten)}</h2><p>${esc(g.mo_ta)} <span class="nguon">Hình: ${esc(g.nguon)}.</span></p></header><div class="luoi luoi-${g.id}">${g.anh.map((a) => hinhHtml(a)).join("")}</div></section>`;
    });
}

/** Chèn mảnh dùng chung và đánh dấu mục đang mở trên thanh điều hướng. */
function manh(): Plugin {
  const doc = (ten: string) => readFileSync(goc(`./src/manh/${ten}.html`), "utf8");
  return {
    name: "thk-manh",
    transformIndexHtml: {
      order: "pre",
      handler(html, ctx) {
        // Đường dẫn trang: "/" , "/the-gioi/" ...; 404.html thì không mục nào sáng.
        const file = relative(goc("./"), ctx.filename).replace(/\\/g, "/");
        const duong = "/" + file.replace(/index\.html$/, "").replace(/\.html$/, "");
        let dau = doc("dau");
        dau = dau.replace(/<a href="([^"]+)" data-muc>/g, (m, href: string) => (href === duong ? `<a href="${href}" data-muc aria-current="page">` : m));
        return chenHinh(html.replace("<!--#dau-->", dau).replace("<!--#chan-->", doc("chan")).replace("<!--#mo-->", doc("mo")));
      },
    },
    handleHotUpdate({ file, server }) {
      if (file.includes("/src/manh/") || file.endsWith("hinh.json") || file.endsWith(".html")) server.ws.send({ type: "full-reload" });
    },
  };
}

export default defineConfig({
  base: "/",
  publicDir: "public",
  plugins: [manh()],
  server: { host: true, port: 5190, strictPort: true },
  preview: { host: true, port: 4190, strictPort: true },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    assetsInlineLimit: 2048,
    // Chunk three + cảnh (~176 kB gzip) chỉ tải ở trang chủ khi máy có WebGL2, bằng import() động.
    chunkSizeWarningLimit: 700,
    rolldownOptions: { input: Object.fromEntries(Object.entries(TRANG).map(([k, v]) => [k, goc(`./${v}`)])) },
  },
});

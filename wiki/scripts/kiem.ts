// Kiểm bản build wiki (docs/.vitepress/dist) trước khi deploy; `npm run build` tự chạy sau vitepress build.
//   1. Không lọt chữ nội bộ lên trang người chơi: GDD, đề xuất, chốt, prototype, tên công cụ, kế hoạch kinh doanh, pháp lý.
//   2. Mọi trang trong thanh bên và trang tra cứu đều có.
//   3. Giới hạn static assets của Cloudflare: tối đa 20.000 file, mỗi file tối đa 25 MiB.
//   4. Có _headers và robots.txt.
// Có lỗi thì in ra và thoát mã 1.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { TRANG_TRA_CUU } from "../docs/.vitepress/traCuu.ts";

const WIKI = join(import.meta.dirname, "..");
const DIST = join(WIKI, "docs/.vitepress/dist");

/** Chữ không được hiện ra cho người chơi (so trên chữ đã bỏ thẻ HTML, script, style, chú thích). */
export const CAM: [RegExp, string][] = [
  [/\bGDD\b/, "nhắc tới GDD"],
  [/\(mục \d+/, "trỏ vào mục GDD"],
  [/đề xuất/i, "chữ 'đề xuất' (dùng <ThuNghiem />)"],
  [/\b(?:đã chốt|người dùng chốt|chờ (?:bạn )?duyệt)\b/i, "ghi chú duyệt nội bộ"],
  [/\b(?:prototype|MVP|sprint|Nakama|Cocos|PixelLab|Canva|packages\/sim|tools\/balance)\b/i, "tên công cụ hay giai đoạn nội bộ"],
  [/\bCửa 1\b/, "mốc nội bộ Cửa 1"],
  [/\bbi_mat\b|Bí mật của dev/i, "luật bí mật"],
  [/\b(?:G1|giấy phép)\b/, "pháp lý"],
  [/tiên ngọc|Sàn Linh Ngọc|battle pass|thẻ tháng|gói nạp|doanh thu/i, "kiếm tiền"],
  [/\b(?:TODO|FIXME)\b|\[ \]/, "việc còn dở"],
  [/\b[a-z]+_[a-z_]+\b/, "mã thô có dấu gạch dưới (tên trường JSON, mã nguồn)"],
];

function cacFile(dir: string, out: string[] = []): string[] {
  for (const ten of readdirSync(dir)) {
    const p = join(dir, ten);
    if (statSync(p).isDirectory()) cacFile(p, out);
    else out.push(p);
  }
  return out;
}

export function chuHienRa(html: string): string {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");
}

function chay(): number {
  if (!existsSync(DIST)) {
    console.error("kiem: chưa có docs/.vitepress/dist, chạy vitepress build trước");
    return 1;
  }
  const loi: string[] = [];
  const files = cacFile(DIST);

  // 1. chữ nội bộ
  for (const f of files.filter((x) => x.endsWith(".html"))) {
    const chu = chuHienRa(readFileSync(f, "utf8"));
    for (const [re, ly_do] of CAM) {
      const m = re.exec(chu);
      if (m) {
        const i = Math.max(0, m.index - 50);
        loi.push(`${relative(DIST, f)}: ${ly_do}: "…${chu.slice(i, m.index + m[0].length + 50).trim()}…"`);
      }
    }
  }

  // 2. trang có đủ
  const config = readFileSync(join(WIKI, "docs/.vitepress/config.mts"), "utf8");
  const duong = new Set<string>([...config.matchAll(/link: "(\/[^"]*)"/g)].map((m) => m[1]));
  for (const x of TRANG_TRA_CUU) duong.add(`/tra-cuu/${x.duong}`);
  for (const d of duong) {
    const coFile = d.endsWith("/") ? join(DIST, d, "index.html") : join(DIST, `${d}.html`);
    if (!existsSync(coFile)) loi.push(`thiếu trang ${d}`);
  }

  // 3. giới hạn static assets
  if (files.length > 20000) loi.push(`quá 20.000 file (${files.length})`);
  let tong = 0;
  for (const f of files) {
    const s = statSync(f).size;
    tong += s;
    if (s > 25 * 1024 * 1024) loi.push(`file quá 25 MiB: ${relative(DIST, f)}`);
  }

  // 4. file đặc biệt
  for (const f of ["_headers", "robots.txt", "404.html"]) if (!existsSync(join(DIST, f))) loi.push(`thiếu ${f}`);

  console.log(`kiem: ${files.length} file, ${(tong / 1024 / 1024).toFixed(1)} MB, ${duong.size} trang trong thanh bên`);
  for (const l of loi) console.error(`  lỗi: ${l}`);
  return loi.length ? 1 : 0;
}

if (process.argv[1] && import.meta.filename === process.argv[1]) process.exitCode = chay();

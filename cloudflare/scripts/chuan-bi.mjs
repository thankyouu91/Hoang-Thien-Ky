// Chạy trước `wrangler deploy` (mục build trong wrangler.jsonc): build proto/dist từ mã hiện tại, chép _headers vào,
// rồi kiểm số file và dung lượng theo giới hạn static assets của Workers (gói miễn phí: 20.000 file, 25 MiB mỗi file).
// Đặt THK_BO_BUILD=1 để chỉ chép _headers và kiểm (khi đã build sẵn).
//
// Giữ chunk của các bản trước (lỗi D-CHUNK): người đang mở game lúc deploy vẫn xin file JS/CSS có mã băm của bản cũ.
// Trước khi build, chép proto/dist/assets hiện có (bản vừa deploy) vào kho cloudflare/.assets-cu (không commit); build
// xong, ghép các file trong kho chưa quá GIU_NGAY ngày vào lại dist/assets. File quá hạn bị xóa khỏi kho. File đã mất
// hẳn thì Worker trả 404 thật và trình duyệt tự tải lại trang.
import { execSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, utimesSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const dist = join(root, "proto", "dist");
const distAssets = join(dist, "assets");
const KHO = join(here, "..", ".assets-cu");
const GIU_NGAY = 7;

/** Tên các file (không tính thư mục con) trong một thư mục; thư mục chưa có thì rỗng. */
const tenFile = (dir) => (existsSync(dir) ? readdirSync(dir, { withFileTypes: true }).filter((e) => e.isFile()).map((e) => e.name) : []);

if (process.env.THK_BO_BUILD !== "1") {
  // Cất bộ assets của lần build trước vào kho; mtime = lúc vào kho, để tính hạn GIU_NGAY.
  mkdirSync(KHO, { recursive: true });
  const now = new Date();
  let cat = 0;
  for (const f of tenFile(distAssets)) {
    const dich = join(KHO, f);
    if (existsSync(dich)) continue;
    copyFileSync(join(distAssets, f), dich);
    utimesSync(dich, now, now);
    cat++;
  }
  if (cat) console.log(`Kho chunk cũ: cất thêm ${cat} file của bản trước.`);

  // Phiên bản bản build = mã commit (thêm "+sua" nếu còn file chưa commit), game gửi kèm sự kiện và phản hồi.
  const sha = execSync("git rev-parse --short HEAD", { cwd: root }).toString().trim();
  const sua = execSync("git status --porcelain -- proto packages assets", { cwd: root }).toString().trim() ? "+sua" : "";
  execSync("npm run build:proto", { cwd: root, stdio: "inherit", shell: true, env: { ...process.env, VITE_PHIEN_BAN: sha + sua } });
}

// Ghép chunk cũ còn hạn vào bản mới; xóa file quá hạn khỏi kho.
{
  const han = Date.now() - GIU_NGAY * 24 * 3600 * 1000;
  const coSan = new Set(tenFile(distAssets));
  let ghep = 0;
  let xoa = 0;
  for (const f of tenFile(KHO)) {
    const p = join(KHO, f);
    if (statSync(p).mtimeMs < han) {
      rmSync(p);
      xoa++;
    } else if (!coSan.has(f)) {
      copyFileSync(p, join(distAssets, f));
      ghep++;
    }
  }
  if (ghep || xoa) console.log(`Kho chunk cũ: ghép ${ghep} file của bản trước vào dist/assets, xóa ${xoa} file quá ${GIU_NGAY} ngày.`);
}
copyFileSync(join(here, "..", "_headers"), join(dist, "_headers"));

const TOI_DA_FILE = 20_000;
const TOI_DA_MOT_FILE = 25 * 1024 * 1024;
let soFile = 0;
let tong = 0;
let lonNhat = { path: "", size: 0 };
const walk = (dir) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else {
      const s = statSync(p).size;
      soFile++;
      tong += s;
      if (s > lonNhat.size) lonNhat = { path: relative(dist, p), size: s };
      if (s > TOI_DA_MOT_FILE) throw new Error(`${relative(dist, p)} nặng ${(s / 1048576).toFixed(1)} MiB, vượt 25 MiB.`);
    }
  }
};
walk(dist);
if (soFile > TOI_DA_FILE) throw new Error(`proto/dist có ${soFile} file, vượt ${TOI_DA_FILE}.`);
console.log(`proto/dist: ${soFile} file, ${(tong / 1048576).toFixed(1)} MiB; lớn nhất ${lonNhat.path} ${(lonNhat.size / 1024).toFixed(0)} KiB. Trong giới hạn.`);

// Chạy trước `wrangler deploy` (mục build trong wrangler.jsonc): build proto/dist từ mã hiện tại, chép _headers vào,
// rồi kiểm số file và dung lượng theo giới hạn static assets của Workers (gói miễn phí: 20.000 file, 25 MiB mỗi file).
// Đặt THK_BO_BUILD=1 để chỉ chép _headers và kiểm (khi đã build sẵn).
import { execSync } from "node:child_process";
import { copyFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const dist = join(root, "proto", "dist");

if (process.env.THK_BO_BUILD !== "1") {
  // Phiên bản bản build = mã commit (thêm "+sua" nếu còn file chưa commit), game gửi kèm sự kiện và phản hồi.
  const sha = execSync("git rev-parse --short HEAD", { cwd: root }).toString().trim();
  const sua = execSync("git status --porcelain -- proto packages assets", { cwd: root }).toString().trim() ? "+sua" : "";
  execSync("npm run build:proto", { cwd: root, stdio: "inherit", shell: true, env: { ...process.env, VITE_PHIEN_BAN: sha + sua } });
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

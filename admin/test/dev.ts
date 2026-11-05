// Chạy thử admin trên máy, không cần Cloudflare: wrangler dev (Worker thật, D1 cục bộ) + Vite (giao diện, chuyển /api
// sang wrangler). Lần đầu tạo hai tài khoản thử CHỈ có trong D1 cục bộ (.wrangler/state), không liên quan bản deploy:
//   admin   / mat-khau-thu-cuc-bo   (Admin)
//   vanhanh / mat-khau-thu-cuc-bo   (Vận hành)
//   node test/dev.ts               → số liệu game là dữ liệu mẫu
//   node test/dev.ts --bang-game   → chạy thêm migration game (../cloudflare/migrations) để thử tạo link mời, khóa thật
// Mở http://127.0.0.1:5180

import { spawn, spawnSync } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { bamMatKhau } from "../worker/matKhau.ts";

process.chdir(fileURLToPath(new URL("..", import.meta.url)));
const WIN = process.platform === "win32";
const bin = (n: string) => (WIN ? `node_modules\\.bin\\${n}.cmd` : `node_modules/.bin/${n}`);
const ENV = { ...process.env, CI: "1", WRANGLER_SEND_METRICS: "false" };
const bangGame = process.argv.includes("--bang-game");
const MAT_KHAU_THU = "mat-khau-thu-cuc-bo";

const con: ChildProcess[] = [];
function chay(cmd: string, args: string[]): ChildProcess {
  const p = spawn(cmd, args, { shell: true, stdio: "inherit", env: ENV });
  con.push(p);
  return p;
}
function dung(): void {
  for (const p of con) if (p.pid) (WIN ? spawnSync("taskkill", ["/pid", String(p.pid), "/T", "/F"]) : p.kill());
  process.exit(0);
}
process.on("SIGINT", dung);
process.on("SIGTERM", dung);

const d1 = (args: string[]) => spawnSync(bin("wrangler"), ["d1", ...args], { shell: true, stdio: "inherit", env: ENV });
d1(["migrations", "apply", "thienhoangky", "--local"]);
if (bangGame) {
  // Migration game không ghi vào bảng theo dõi của admin: chạy lại file đã chạy thì báo "already exists", bỏ qua được.
  for (const f of readdirSync("../cloudflare/migrations").filter((x) => x.endsWith(".sql")).sort()) d1(["execute", "thienhoangky", "--local", "--file", `../cloudflare/migrations/${f}`]);
}

// Tài khoản thử (chỉ thêm khi chưa có), không phải đổi mật khẩu.
const now = Date.now();
const sql = [
  `INSERT OR IGNORE INTO qt_tai_khoan (ten, vai_tro, mat_khau, phai_doi, ghi_chu, tao_boi, tao_luc) VALUES ('admin', 'admin', '${await bamMatKhau(MAT_KHAU_THU)}', 0, 'tài khoản thử cục bộ', 'dev', ${now});`,
  `INSERT OR IGNORE INTO qt_tai_khoan (ten, vai_tro, mat_khau, phai_doi, ghi_chu, tao_boi, tao_luc) VALUES ('vanhanh', 'van_hanh', '${await bamMatKhau(MAT_KHAU_THU)}', 0, 'tài khoản thử cục bộ', 'dev', ${now});`,
].join("\n");
mkdirSync(".wrangler", { recursive: true });
writeFileSync(".wrangler/tai-khoan-thu.sql", sql);
d1(["execute", "thienhoangky", "--local", "--file", ".wrangler/tai-khoan-thu.sql"]);

// Cục bộ không có Cloudflare Access: ghi đè hai biến Access của wrangler.jsonc thành rỗng (chỉ dùng mật khẩu).
chay(bin("wrangler"), ["dev", "--port", "8788", "--ip", "127.0.0.1", "--var", "ACCESS_TEAM_DOMAIN:", "--var", "ACCESS_AUD:"]);
for (let i = 0; i < 120; i++) {
  await new Promise((r) => setTimeout(r, 500));
  if (await fetch("http://127.0.0.1:8788/api/toi").then(() => true, () => false)) break;
}
chay(bin("vite"), ["--port", "5180", "--strictPort", "--host", "127.0.0.1"]);
console.log(`\nAdmin thử: http://127.0.0.1:5180 · đăng nhập admin hoặc vanhanh, mật khẩu ${MAT_KHAU_THU}\n`);

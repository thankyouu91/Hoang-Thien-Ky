// Chạy thử admin trên máy, không cần Cloudflare: máy chủ khóa giả (JWKS) + wrangler dev (Worker thật, D1 cục bộ)
// + Vite (giao diện, chuyển /api sang wrangler kèm JWT ký bằng khóa giả). Worker không có lối tắt bỏ qua JWT;
// ở đây JWT là thật về chữ ký, chỉ có khóa là của máy chủ giả.
//   node test/dev.ts               → vào với quyền Admin gốc (admin@example.com)
//   node test/dev.ts --van-hanh    → vào với quyền Vận hành (vanhanh@example.com)
//   node test/dev.ts --bang-game   → chạy thêm migration game (../cloudflare/migrations) để thử tạo link mời, khóa thật;
//                                    không có cờ này thì phần số liệu game là dữ liệu mẫu
// Mở http://127.0.0.1:5180

import { spawn, spawnSync } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { AUD, TEAM, kyJwt, phucVuKhoa, taoKhoa } from "./khoaGia.ts";

process.chdir(fileURLToPath(new URL("..", import.meta.url)));
const WIN = process.platform === "win32";
const bin = (n: string) => (WIN ? `node_modules\\.bin\\${n}.cmd` : `node_modules/.bin/${n}`);
const API = "http://127.0.0.1:8788";
const ADMIN = "admin@example.com";
const VAN = "vanhanh@example.com";
const laVanHanh = process.argv.includes("--van-hanh");
const bangGame = process.argv.includes("--bang-game");

const k = await taoKhoa("k-dev");
const { url: certs } = await phucVuKhoa([k.jwk], 8799);
const lau = Math.floor(Date.now() / 1000) + 12 * 3600;
const jwtAdmin = await kyJwt(k, { email: ADMIN, exp: lau });
const jwtVan = await kyJwt(k, { email: VAN, exp: lau });

const con: ChildProcess[] = [];
function chay(cmd: string, args: string[], env: Record<string, string> = {}): ChildProcess {
  const p = spawn(cmd, args, { shell: true, stdio: "inherit", env: { ...process.env, CI: "1", WRANGLER_SEND_METRICS: "false", ...env } });
  con.push(p);
  return p;
}
function dung(): void {
  for (const p of con) if (p.pid) (WIN ? spawnSync("taskkill", ["/pid", String(p.pid), "/T", "/F"]) : p.kill());
  process.exit(0);
}
process.on("SIGINT", dung);
process.on("SIGTERM", dung);

spawnSync(bin("wrangler"), ["d1", "migrations", "apply", "thienhoangky", "--local"], { shell: true, stdio: "inherit", env: { ...process.env, CI: "1" } });
if (bangGame) {
  // Migration game không ghi vào bảng theo dõi của admin: chạy lại file đã chạy thì báo "already exists", bỏ qua được.
  for (const f of readdirSync("../cloudflare/migrations").filter((x) => x.endsWith(".sql")).sort())
    spawnSync(bin("wrangler"), ["d1", "execute", "thienhoangky", "--local", "--file", `../cloudflare/migrations/${f}`], { shell: true, stdio: "inherit", env: { ...process.env, CI: "1" } });
}
const vars = { ACCESS_TEAM_DOMAIN: TEAM, ACCESS_AUD: AUD, ADMIN_GOC: ADMIN, ACCESS_CERTS_URL: certs };
chay(bin("wrangler"), ["dev", "--port", "8788", "--ip", "127.0.0.1", ...Object.entries(vars).flatMap(([a, b]) => ["--var", `${a}:${b}`])]);

for (let i = 0; i < 120; i++) {
  await new Promise((r) => setTimeout(r, 500));
  if (await fetch(`${API}/api/toi`).then(() => true, () => false)) break;
}

// Dữ liệu thử lần đầu: một Vận hành, một thông báo, và một link mời khi có bảng game.
const post = (path: string, body: unknown) =>
  fetch(API + path, { method: "POST", headers: { "Cf-Access-Jwt-Assertion": jwtAdmin, "Content-Type": "application/json", Origin: API }, body: JSON.stringify(body) });
const vt = (await fetch(`${API}/api/vai-tro`, { headers: { "Cf-Access-Jwt-Assertion": jwtAdmin } }).then((r) => r.json())) as { dong: unknown[] };
if (vt.dong.length <= 1) {
  await post("/api/vai-tro", { email: VAN, vai_tro: "van_hanh", ghi_chu: "trực phản hồi" });
  await post("/api/thong-bao", { tieu_de: "Chào mừng đạo hữu", noi_dung: "Bản chơi thử kín đợt 1. Gặp lỗi thì bấm Phản hồi ở Động phủ.", dang: true });
  if (bangGame) await post("/api/loi-moi", { ten: "Discord đợt 1", toi_da: 30 });
}

chay(bin("vite"), ["--port", "5180", "--strictPort", "--host", "127.0.0.1"], { THK_DEV_JWT: laVanHanh ? jwtVan : jwtAdmin });
console.log(`\nAdmin thử: http://127.0.0.1:5180 (vai ${laVanHanh ? "Vận hành" : "Admin gốc"})\n`);

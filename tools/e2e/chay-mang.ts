// Chạy bài kiểm trên play.thienhoangky.fun: node chay-mang.ts <mã link mời> [tham số playwright...]
// Mã chỉ đi qua biến môi trường E2E_MOI của tiến trình này, không ghi ra file nào trong repo.
// Đã có cookie còn hạn ở .auth/moi.json thì bỏ trống mã cũng được.
import { spawnSync } from "node:child_process";

const [dau, ...con] = process.argv.slice(2);
const coMa = dau !== undefined && !dau.startsWith("-");
const env = { ...process.env, E2E_URL: process.env.E2E_URL ?? "https://play.thienhoangky.fun", ...(coMa ? { E2E_MOI: dau } : {}) };
const args = ["playwright", "test", ...(coMa ? con : process.argv.slice(2))];
const r = spawnSync(process.platform === "win32" ? "npx.cmd" : "npx", args, { stdio: "inherit", env, shell: process.platform === "win32" });
process.exit(r.status ?? 1);

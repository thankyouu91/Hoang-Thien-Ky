// Chạy trên mạng: lấy cookie link mời một lần cho cả lượt kiểm (docs/api.md, "Link mời và cookie").
// Cookie còn dùng được (GET /api/toi trả 200) thì giữ, không tốn thêm lượt mời. Cookie chỉ nằm ở .auth/ (không vào git).
import { chromium, type FullConfig } from "@playwright/test";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";

const FILE = ".auth/moi.json";

export default async function moCong(config: FullConfig): Promise<void> {
  const base = config.projects[0].use.baseURL!;
  const ma = process.env.E2E_MOI?.trim();
  mkdirSync(".auth", { recursive: true });
  const browser = await chromium.launch();
  try {
    if (existsSync(FILE)) {
      const ctx = await browser.newContext({ storageState: FILE });
      const r = await ctx.request.get(`${base}/api/toi`);
      await ctx.close();
      if (r.ok()) return;
    }
    if (!ma) throw new Error("Chạy trên mạng cần E2E_MOI=<mã link mời> (nhờ người dùng tạo trong Admin Dashboard), hoặc cookie còn hạn trong .auth/moi.json.");
    if (!/^[a-z0-9-]{6,40}$/i.test(ma)) throw new Error("E2E_MOI không đúng dạng mã link mời (6–40 ký tự a-z, 0-9, -).");
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const r = await page.goto(`${base}/moi/${ma}`);
    if (!r || r.status() >= 400) throw new Error(`Link mời bị từ chối: HTTP ${r?.status()} (sai mã, hết lượt, hết hạn hoặc đã tắt).`);
    const toi = await ctx.request.get(`${base}/api/toi`);
    if (!toi.ok()) throw new Error(`Đã mở link mời nhưng /api/toi trả ${toi.status()}: cookie thk_moi không được cấp.`);
    // Chỉ giữ cookie: localStorage để trống, để mỗi bài kiểm là một người chơi mới.
    const state = await ctx.storageState();
    writeFileSync(FILE, JSON.stringify({ cookies: state.cookies, origins: [] }, null, 2));
    await ctx.close();
  } finally {
    await browser.close();
  }
}

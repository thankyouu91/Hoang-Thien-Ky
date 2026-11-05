// Chụp ảnh màn hình prototype (proto/) ở khung điện thoại cho thư viện hình của website, lưu web/anh-chup/<tên>.webp.
// Cần dev server proto đang chạy (npm.cmd run dev:proto ở gốc repo, cổng 5173) và Chrome hoặc Edge trên máy.
//   node scripts/chup.mjs [http://localhost:5173]
// Dùng Chrome headless qua DevTools Protocol (WebSocket sẵn trong Node 22+), không cần Playwright.
// Phiên đăng nhập thử đặt thẳng vào localStorage (MockAuth của proto), nên không phải qua màn OTP.
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const WEB = fileURLToPath(new URL("..", import.meta.url));
const OUT = join(WEB, "anh-chup");
const URL_PROTO = process.argv[2] ?? "http://localhost:5173/";
const W = 390;
const H = 844;
const DPR = 2;

const TRINH_DUYET = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/usr/bin/google-chrome",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].find((p) => existsSync(p));
if (!TRINH_DUYET) throw new Error("Không tìm thấy Chrome hoặc Edge.");

const ngu = (ms) => new Promise((r) => setTimeout(r, ms));

/** Mở Chrome headless, trả WebSocket của tab đầu. */
async function moChrome() {
  const hoSo = mkdtempSync(join(tmpdir(), "thk-chup-"));
  const port = 9300 + Math.floor(Math.random() * 500);
  const p = spawn(TRINH_DUYET, [
    "--headless=new",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${hoSo}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--hide-scrollbars",
    "--use-angle=d3d11",
    "--enable-unsafe-swiftshader",
    `--window-size=${W},${H}`,
    "about:blank",
  ], { stdio: "ignore" });
  let tabs = null;
  for (let i = 0; i < 50 && !tabs; i++) {
    await ngu(200);
    tabs = await fetch(`http://127.0.0.1:${port}/json/list`).then((r) => r.json()).catch(() => null);
  }
  const tab = tabs?.find((t) => t.type === "page");
  if (!tab) throw new Error("Chrome không mở được cổng gỡ lỗi.");
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((r, j) => ((ws.onopen = r), (ws.onerror = j)));
  let id = 0;
  const cho = new Map();
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && cho.has(m.id)) {
      const { ok, loi } = cho.get(m.id);
      cho.delete(m.id);
      m.error ? loi(new Error(m.error.message)) : ok(m.result);
    }
  };
  const goi = (method, params = {}) =>
    new Promise((ok, loi) => {
      const i = ++id;
      cho.set(i, { ok, loi });
      ws.send(JSON.stringify({ id: i, method, params }));
    });
  const dong = () => {
    ws.close();
    p.kill();
    setTimeout(() => rmSync(hoSo, { recursive: true, force: true }), 800);
  };
  return { goi, dong };
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const { goi, dong } = await moChrome();
  const chay = async (js) => {
    const r = await goi("Runtime.evaluate", { expression: js, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(`${js}\n→ ${r.exceptionDetails.exception?.description ?? r.exceptionDetails.text}`);
    return r.result.value;
  };
  const chup = async (ten, cho = 1500) => {
    await ngu(cho);
    const { data } = await goi("Page.captureScreenshot", { format: "png" });
    const dich = join(OUT, `${ten}.webp`);
    await sharp(Buffer.from(data, "base64")).resize({ width: 900 }).webp({ quality: 86, effort: 6 }).toFile(dich);
    console.log("đã chụp", dich);
  };
  try {
    await goi("Page.enable");
    await goi("Runtime.enable");
    await goi("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: DPR, mobile: true });
    await goi("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
    await goi("Page.navigate", { url: URL_PROTO });
    await ngu(2500);
    // Màn đăng nhập trước khi có phiên.
    await chup("dang_nhap", 2500);
    // Phiên thử (MockAuth): người lớn, để không bị chặn giờ chơi của người dưới 18.
    await chay(`localStorage.setItem("ktlp.session", JSON.stringify({ phoneMasked: "09•• ••• 123", birthDate: "1995-05-05", since: Date.now(), account: "web-chup" })); true`);
    await goi("Page.reload");
    await ngu(4000);
    // Đóng điều khoản, lời nhắc nếu có.
    await chay(`for (const b of document.querySelectorAll("dialog[open] button, .modal button")) { if (/đồng ý|tiếp tục|đóng|bắt đầu/i.test(b.textContent)) b.click(); } true`);
    await chup("dong_phu", 2000);
    const tab = async (id) => chay(`(() => { const b = [...document.querySelectorAll("#tabbar button")].find((x) => (x.dataset.id || x.dataset.tab || x.getAttribute("aria-controls") || x.textContent).toLowerCase().includes(${JSON.stringify(id)})); if (!b) return false; b.click(); return true; })()`);
    if (await tab("bản đồ")) await chup("ban_do", 4500);
    if (await tab("tông môn")) await chup("tong_mon", 2500);
    // Màn Nhân vật mở từ chân dung trên thanh trên.
    const coNv = await chay(`(() => { const b = document.querySelector("#topbar .portrait"); if (!b) return false; b.click(); return true; })()`);
    if (coNv) await chup("nhan_vat", 4500);
    // Trận: nút "Xem trận" trong chiến báo ở Động phủ.
    await tab("động phủ");
    await ngu(1500);
    const coTran = await chay(`(() => { const b = [...document.querySelectorAll("button")].find((x) => /xem trận/i.test(x.textContent)); if (!b) return false; b.click(); return true; })()`);
    if (coTran) await chup("tran", 6500);
  } finally {
    dong();
  }
}

await main();

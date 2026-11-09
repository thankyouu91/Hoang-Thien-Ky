// Chụp ảnh màn hình prototype (proto/) cho website, lưu web/anh-chup/<tên>.webp.
// Cần dev server proto đang chạy (npm.cmd run dev:proto ở gốc repo, cổng 5173) và Chrome hoặc Edge trên máy.
//   node scripts/chup.mjs                                   # 7 màn ở khung điện thoại 390 × 844
//   node scripts/chup.mjs --chi=dai_luc --w=1440 --h=900     # chỉ chụp toàn cảnh đại lục ở khung máy tính
// Chạy thế giới mẫu cấp 42 (?demo=1, chỉ có trên máy dev); người mới thật bắt đầu cấp 1 với hướng dẫn Nhập Thế.
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
const THAM = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")).map(([k, v]) => [k, v ?? "1"]));
const URL_PROTO = THAM.url ?? "http://localhost:5173/?demo=1";
const W = Number(THAM.w ?? 390);
const H = Number(THAM.h ?? 844);
const DPR = 2;
const MAY_TINH = W >= 900;
/** Chỉ ghi các ảnh này (vẫn đi qua các màn trước đó để tới nơi). */
const CHI = THAM.chi ? new Set(THAM.chi.split(",")) : null;

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
  /** clip: vùng px CSS cần cắt (mặc định cả khung). */
  const chup = async (ten, cho = 1500, clip) => {
    if (CHI && !CHI.has(ten)) return;
    await ngu(cho);
    const { data } = await goi("Page.captureScreenshot", { format: "png", ...(clip ? { clip: { ...clip, scale: 1 } } : {}) });
    const dich = join(OUT, `${ten}.webp`);
    let img = sharp(Buffer.from(data, "base64"));
    // Bản đồ nhỏ hơn canvas: bỏ viền nền tối quanh tấm giấy.
    if (clip) img = sharp(await img.trim({ background: "#151110", threshold: 40 }).toBuffer());
    await img.resize({ width: MAY_TINH ? 1600 : 900, withoutEnlargement: true }).webp({ quality: 86, effort: 6 }).toFile(dich);
    console.log("đã chụp", dich);
  };
  try {
    await goi("Page.enable");
    await goi("Runtime.enable");
    await goi("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: DPR, mobile: !MAY_TINH });
    if (!MAY_TINH) await goi("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
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
    if (await tab("bản đồ")) {
      await chup("ban_do", 4500);
      // Toàn cảnh: cả Hạ vị (nút data-nav="world"), ảnh đại lục ở trang chủ.
      // Ẩn lớp giao diện bản đồ (.map-ui) rồi cắt đúng khung canvas, bỏ dòng fps gỡ lỗi ở góc trên.
      if (await chay(`(() => { const b = document.querySelector('[data-nav="world"]'); if (!b) return false; b.click(); return true; })()`)) {
        await ngu(3500);
        const r = await chay(`(() => { const st = document.createElement("style"); st.textContent = ".map-ui{display:none!important}"; document.head.append(st); const c = [...document.querySelectorAll("canvas")].filter((x) => x.offsetWidth > 300).sort((a, b) => b.offsetWidth * b.offsetHeight - a.offsetWidth * a.offsetHeight)[0]; const q = c.getBoundingClientRect(); return { x: q.x, y: q.y + 26, width: q.width, height: q.height - 26 }; })()`);
        await chup("dai_luc", 800, r);
      }
    }
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

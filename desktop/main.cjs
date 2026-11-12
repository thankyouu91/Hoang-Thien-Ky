// Vỏ ứng dụng máy tính của Thiên Hoang Ký (Electron): mở bản game đã build (proto/dist) trong một cửa sổ riêng, không cần trình duyệt
// hay mạng. Game là trang tĩnh, tiến độ vẫn lưu ở localStorage, nằm trong thư mục dữ liệu của ứng dụng (%APPDATA%).
// Chạy thử: npm start (cần build proto trước). Đóng gói bộ cài: npm run dist. Xem README.md.
const { app, BrowserWindow, Menu, net, protocol, shell } = require("electron");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

// Bản đóng gói mang game trong resources/game; chạy từ mã nguồn thì lấy thẳng proto/dist.
const ROOT = app.isPackaged ? path.join(process.resourcesPath, "game") : path.join(__dirname, "..", "proto", "dist");

// Giao thức riêng app://game/ thay cho file://: trang dùng ES module và fetch (map, bộ ô đất), hai thứ đó không chạy trên file://.
protocol.registerSchemesAsPrivileged([{ scheme: "app", privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }]);

if (!app.requestSingleInstanceLock()) app.quit();

app.whenReady().then(() => {
  protocol.handle("app", async (req) => {
    const rel = decodeURIComponent(new URL(req.url).pathname).replace(/^\/+/, "") || "index.html";
    const file = path.normalize(path.join(ROOT, rel));
    // Không cho đường dẫn thoát ra ngoài thư mục game.
    if (!file.startsWith(ROOT + path.sep)) return new Response("", { status: 403 });
    try {
      return await net.fetch(pathToFileURL(file).toString());
    } catch {
      return new Response("", { status: 404 });
    }
  });
  Menu.setApplicationMenu(null);
  const win = new BrowserWindow({
    width: 1366, height: 800, minWidth: 960, minHeight: 600, title: "Thiên Hoang Ký", backgroundColor: "#120e0a",
    icon: path.join(__dirname, "icon.png"),
    webPreferences: { contextIsolation: true, sandbox: true },
  });
  win.loadURL("app://game/index.html");
  // F11 bật tắt toàn màn hình; game không mở cửa sổ con, liên kết ra ngoài thì mở bằng trình duyệt của máy.
  win.webContents.on("before-input-event", (_e, input) => {
    if (input.type === "keyDown" && input.key === "F11") win.setFullScreen(!win.isFullScreen());
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//.test(url)) void shell.openExternal(url);
    return { action: "deny" };
  });
  app.on("second-instance", () => {
    if (win.isMinimized()) win.restore();
    win.focus();
  });
});

app.on("window-all-closed", () => app.quit());

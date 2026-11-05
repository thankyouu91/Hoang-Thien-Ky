// Bài kiểm đầu-cuối: một người chơi mới đi hết phần nhập môn (GDD mục 14, FTUE 8 bước; chuỗi chinh.0.* ở
// data/nhiem_vu/ha_nhiem_vu.json). Kịch bản từng bước nằm ở KICH_BAN.md.
//
// Hai chế độ:
// - Ở máy (mặc định): build proto vào tools/e2e/.ban-build (không đụng proto/dist mà tab deploy dùng) rồi chạy
//   vite preview ở cổng 4183, khác cổng 4173 của ktlp-proto-build trong launch.json để chạy song song được.
//   E2E_BO_BUILD=1 thì dùng bản build sẵn có trong .ban-build.
// - Trên mạng: E2E_URL=https://play.thienhoangky.fun và E2E_MOI=<mã link mời>. mo-cong.ts mở /moi/<mã> một lần,
//   giữ cookie trong .auth/ (không vào git), các bài sau dùng lại cookie đó nên cả lượt chạy chỉ tốn một lượt mời.
//   Mã link mời không ghi vào repo (repo public): chỉ truyền qua biến môi trường, xem chay-mang.ts.
import { defineConfig, devices } from "@playwright/test";

const URL_NGOAI = process.env.E2E_URL?.replace(/\/$/, "");
// E2E_URL trỏ vào máy này (ví dụ máy chủ xem trước đang chạy sẵn) thì không cần link mời và không tự build.
const URL_MANG = URL_NGOAI && !/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(URL_NGOAI) ? URL_NGOAI : undefined;
const CONG = 4183;
const BASE = URL_NGOAI ?? `http://127.0.0.1:${CONG}`;
const THU_MUC_BUILD = "../tools/e2e/.ban-build";
const VITE = "node ../node_modules/vite/bin/vite.js";

const chung = {
  baseURL: BASE,
  locale: "vi-VN",
  timezoneId: "Asia/Ho_Chi_Minh",
  // Ảnh mỗi bước do bài kiểm tự chụp (nguoi-choi.ts); ảnh cuối, trace, video giữ khi trượt để gửi kèm báo lỗi.
  screenshot: "only-on-failure",
  trace: "retain-on-failure",
  video: "retain-on-failure",
  storageState: URL_MANG ? ".auth/moi.json" : undefined,
} as const;

export default defineConfig({
  testDir: "./kiem",
  outputDir: "ket-qua/tep",
  // Một người chơi đi hết FTUE có cả trận đầu và chiếm mỏ: để rộng, kẹt thật thì từng bước tự báo sớm hơn.
  timeout: 240_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: URL_MANG ? 1 : 2,
  retries: 0,
  reporter: [
    ["list"],
    ["html", { outputFolder: "ket-qua/bao-cao", open: "never" }],
    ["json", { outputFile: "ket-qua/ket-qua.json" }],
  ],
  globalSetup: URL_MANG ? "./mo-cong.ts" : undefined,
  webServer: URL_NGOAI
    ? undefined
    : {
        command:
          process.env.E2E_BO_BUILD === "1"
            ? `${VITE} preview --outDir ${THU_MUC_BUILD} --port ${CONG} --strictPort --host 127.0.0.1`
            : `${VITE} build --outDir ${THU_MUC_BUILD} --emptyOutDir --logLevel warn && ${VITE} preview --outDir ${THU_MUC_BUILD} --port ${CONG} --strictPort --host 127.0.0.1`,
        cwd: "../../proto",
        url: `${BASE}/index.html`,
        timeout: 300_000,
        reuseExistingServer: false,
        stdout: "pipe",
        stderr: "pipe",
      },
  projects: [
    {
      name: "dien-thoai",
      // Khung GDD mục 14 (375 × 812), cảm ứng, giao diện điện thoại.
      use: { ...devices["Pixel 5"], ...chung, viewport: { width: 375, height: 812 }, deviceScaleFactor: 2 },
    },
    {
      name: "may-tinh",
      use: { ...devices["Desktop Chrome"], ...chung, viewport: { width: 1280, height: 800 } },
    },
  ],
});

import { App } from "./app/app.ts";
import { Sprites } from "./assets/sprites.ts";
import { createDashboard } from "./dashboard/index.ts";
import { mockReplaySource } from "./mock/mockReplay.ts";
import { sampleBattle } from "./mock/sampleBattle.ts";
import { simReplaySource } from "./replay/simSource.ts";
import { BattleScene } from "./scenes/battle/battleScene.ts";

// Hình nạp nền; scene vẽ khối màu cho tới khi ảnh có mặt.
const sprites = new Sprites();
void sprites.load();

const canvas = document.getElementById("view") as HTMLCanvasElement;
// Trận không có tab riêng (GDD mục 14): mở từ chiến báo trên Động phủ; vẫn vào thẳng được bằng #tran để thử trận.
// Ô chọn nguồn giữ trận thật của @ktlp/sim với vài seed của đội hình mẫu, và trận giả để so.
const battle = new BattleScene(
  [...[11, 2, 3].map((seed) => simReplaySource(`Sim · seed ${seed}`, () => sampleBattle(seed))), mockReplaySource],
  sprites,
);
const dashboard = createDashboard(sprites, canvas, battle);

const app = new App(
  canvas,
  document.getElementById("hud")!,
  document.getElementById("tabbar")!,
  // Thứ tự trên thanh dưới; scene đầu (Động phủ) là màn mở mặc định.
  dashboard.tabs,
  { offTab: [...dashboard.offTab, battle], onShow: (s) => dashboard.onShow(s) },
);
dashboard.attach(app);
app.start();
// Gỡ lỗi từ console khi chạy dev: ktlp.fps, ktlp.view, sprites.size, ...
if (import.meta.env.DEV) Object.assign(window, { ktlp: app, sprites });

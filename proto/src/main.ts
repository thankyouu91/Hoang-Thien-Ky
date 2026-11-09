import { App } from "./app/app.ts";
import { Sprites } from "./assets/sprites.ts";
import { createDashboard } from "./dashboard/index.ts";
import { mockReplaySource } from "./mock/mockReplay.ts";
import { sampleBattle } from "./mock/sampleBattle.ts";
import { simReplaySource } from "./replay/simSource.ts";
import { BattleScene } from "./scenes/battle/battleScene.ts";
import { BaiScene } from "./scenes/bai/baiScene.ts";

// Hình PixelLab (cả manifest, ~190 ảnh) chỉ nạp khi cần: lúc mở Trận hoặc Nhân vật, hoặc lúc rảnh sau khi vào game,
// để không tranh đường tải với Động phủ và bản đồ. Scene vẽ khối màu cho tới khi ảnh có mặt.
const sprites = new Sprites();
let spritesLoad: Promise<void> | undefined;
const loadSprites = () => (spritesLoad ??= sprites.load());
setTimeout(() => ("requestIdleCallback" in window ? requestIdleCallback(() => void loadSprites()) : void loadSprites()), 5000);

const canvas = document.getElementById("view") as HTMLCanvasElement;
// Trận không có tab riêng (GDD mục 14): mở từ chiến báo trên Động phủ; vẫn vào thẳng được bằng #tran để thử trận.
// Ô chọn nguồn giữ trận thật của @ktlp/sim với vài seed của đội hình mẫu, và trận giả để so.
const battle = new BattleScene(
  [
    ...([[11], [2, "cao_nguyen"], [3, "mo_linh_thach"]] as const).map(([seed, arena]) => simReplaySource(`Sim · seed ${seed}`, () => sampleBattle(seed), arena)),
    mockReplaySource,
  ],
  sprites,
);
const dashboard = createDashboard(sprites, canvas, battle);
// Bãi quái mẫu đánh tay thời gian thực (#bai), vào từ thẻ hang dị thú trên bản đồ (người dùng chốt 2026-11-09).
const bai = new BaiScene(sprites);

const app = new App(
  canvas,
  document.getElementById("hud")!,
  document.getElementById("tabbar")!,
  // Thứ tự trên thanh dưới; scene đầu (Động phủ) là màn mở mặc định.
  dashboard.tabs,
  {
    offTab: [...dashboard.offTab, battle, bai],
    onShow: (s) => {
      if (s === battle || s === bai || s.id === "nhan-vat") void loadSprites();
      dashboard.onShow(s);
    },
  },
);
dashboard.attach(app);
app.start();
// Gỡ lỗi từ console khi chạy dev: ktlp.fps, ktlp.view, sprites.size, ...
if (import.meta.env.DEV) Object.assign(window, { ktlp: app, sprites });

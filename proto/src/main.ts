import { App } from "./app/app.ts";
import { Sprites } from "./assets/sprites.ts";
import { mockReplaySource } from "./mock/mockReplay.ts";
import { sampleBattle } from "./mock/sampleBattle.ts";
import { simReplaySource } from "./replay/simSource.ts";
import { BattleScene } from "./scenes/battle/battleScene.ts";
import { PlaceholderScene } from "./scenes/placeholder.ts";

// Hình nạp nền; scene vẽ khối màu cho tới khi ảnh có mặt.
const sprites = new Sprites();
void sprites.load();

const app = new App(
  document.getElementById("view") as HTMLCanvasElement,
  document.getElementById("hud")!,
  document.getElementById("tabbar")!,
  // Thứ tự trên thanh dưới; scene cuối là màn mở mặc định.
  [
    new PlaceholderScene("ban-do", "Bản đồ", "Sprint 4"),
    new PlaceholderScene("son-mon", "Sơn môn", "Sprint 5"),
    // Trận thật của @ktlp/sim với vài seed của đội hình mẫu, và trận giả để so.
    new BattleScene(
      [
        ...[11, 2, 3].map((seed) => simReplaySource(`Sim · seed ${seed}`, () => sampleBattle(seed))),
        mockReplaySource,
      ],
      sprites,
    ),
  ],
);
app.start();
// Gỡ lỗi từ console khi chạy dev: ktlp.fps, ktlp.view, sprites.size, ...
if (import.meta.env.DEV) Object.assign(window, { ktlp: app, sprites });

// Điểm vào của bản MMORPG chơi được (index.html, trang chính của play.thienhoangky.fun; bản dashboard cũ ở dong_phu.html): một màn thế giới duy nhất, không có dashboard.
import { App } from "./app/app.ts";
import { Sprites } from "./assets/sprites.ts";
import "./dashboard/fonts.css";
import "./theme/hud_toi_vang.css";
import "./scenes/mmo/mmo.css";
import { MmoScene } from "./scenes/mmo/mmoScene.ts";

const sprites = new Sprites();
void sprites.load();
const app = new App(document.getElementById("view") as HTMLCanvasElement, document.getElementById("hud")!, document.getElementById("tabbar")!, [new MmoScene(sprites)]);
app.start();
if (import.meta.env.DEV) Object.assign(window, { htk: app, sprites });

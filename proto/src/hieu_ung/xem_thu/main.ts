// Trang xem thử hiệu ứng chiêu (dev: /src/hieu_ung/xem_thu/index.html). Chọn một công pháp có thật trong danh mục
// 300 công pháp mẫu (data/he_thong/json/cong_phap_mau.json), xem đủ 4 pha trên màn Trận thật (nhân vật, nền sân, thanh
// điều khiển), rồi đổi phẩm, biến thể, hệ phụ, chiêu cuối để so. "2D cũ" tắt lớp Three.js để so với bản trước.
// Tham số trên URL (để chụp ảnh): #no=17&pham=5&bt=bao&phu=quang&ult=1&t=2.1 (t: dừng ở giây thứ t của trận mẫu).
import { App } from "../../app/app.ts";
import { Sprites } from "../../assets/sprites.ts";
import type { ReplayPlayer } from "../../replay/player.ts";
import type { ReplayIndex } from "../../replay/timeline.ts";
import { ELEMENT_IDS, type ElementId, type Replay, type ReplaySource } from "../../replay/types.ts";
import { BattleScene } from "../../scenes/battle/battleScene.ts";
import { ELEMENT_STYLE, SKILL_NAME } from "../../theme/elements.ts";
import { GRADE_NAMES, scrollKind, VARIANT_NAMES } from "@htk/rules";
import MAU from "../../../../data/he_thong/json/cong_phap_mau.json" with { type: "json" };
import { castTimeline, type CastTimeline } from "../chieu.ts";
import { holdOf, NO_CONTACT } from "../chung.ts";
import { FPS, IMPACT_FRAMES } from "../nhip.ts";
import type { SkillFx } from "../index.ts";
import { DANG, DANG_FOR, DANG_NAME, type Dang } from "../dang_chon.ts";
import { recipe, recipeOf, VARIANTS, type FxStyle, type Variant } from "../recipe.ts";
import { sampleReplay } from "./mau.ts";

interface Mau {
  no: number;
  name: string;
  group: string;
  main: string;
  grade: number;
  subs: string[];
}
const LIST = MAU as Mau[];

interface Pick {
  no: number;
  grade: number | null;
  variant: Variant | null;
  sub: ElementId | "none" | null;
  /** Dáng chiêu: null tự chọn theo dữ liệu, "goc" hình gốc của loại chiêu */
  dang: Dang | "goc" | null;
  ult: boolean;
  old: boolean;
  loop: boolean;
  t: number | null;
}

/** Mười hai chiêu tiêu biểu, mỗi hệ một chiêu, phủ đủ 10 loại chiêu (gửi ảnh cho người dùng). */
const SHOWCASE: [ElementId, string][] = [
  ["kim", "tam_xa"], ["moc", "khong_che"], ["thuy", "dien_rong"], ["hoa", "can_quet"], ["tho", "ho_the"], ["loi", "can_don"],
  ["phong", "bua_chu"], ["quang", "hoi_phuc"], ["am_lanh", "than_phap"], ["cuc_duong", "tran_phap"], ["cuc_am", "can_quet"], ["cuc_han", "tam_xa"],
];

function showcaseNo(el: ElementId, type: string): number {
  const of = LIST.filter((m) => scrollKind(m.main).element === el && scrollKind(m.main).type === type);
  const mixed = of.find((m) => m.subs.some((s) => scrollKind(s).element !== el));
  return (mixed ?? of[0] ?? LIST[0]).no;
}

function readHash(): Pick {
  const q = new URLSearchParams(location.hash.slice(1));
  const num = (k: string) => (q.has(k) ? Number(q.get(k)) : null);
  return {
    no: num("no") ?? showcaseNo("loi", "can_don"),
    grade: num("pham"),
    variant: (q.get("bt") as Variant | null) ?? null,
    sub: (q.get("phu") as Pick["sub"]) ?? null,
    dang: (q.get("dang") as Pick["dang"]) ?? null,
    ult: q.get("ult") === "1",
    old: q.get("cu") === "1",
    loop: q.get("lap") !== "0",
    t: num("t"),
  };
}

function writeHash(p: Pick): void {
  const q = new URLSearchParams();
  q.set("no", String(p.no));
  if (p.grade !== null) q.set("pham", String(p.grade));
  if (p.variant) q.set("bt", p.variant);
  if (p.sub) q.set("phu", p.sub);
  if (p.dang) q.set("dang", p.dang);
  if (p.ult) q.set("ult", "1");
  if (p.old) q.set("cu", "1");
  if (!p.loop) q.set("lap", "0");
  history.replaceState(null, "", "#" + q.toString());
}

/** Công thức hiệu ứng của lựa chọn hiện tại: từ công pháp mẫu, ghi đè phẩm, biến thể, hệ phụ nếu người xem đổi. */
function styleOf(p: Pick): { style: FxStyle; mau: Mau } {
  const mau = LIST.find((m) => m.no === p.no) ?? LIST[0];
  const main = scrollKind(mau.main);
  const subs = p.sub === "none" ? [] : p.sub ? [p.sub] : mau.subs.map((s) => scrollKind(s).element);
  const dang = p.dang === null ? undefined : p.dang === "goc" ? null : p.dang;
  return { mau, style: { skill: main.type, element: main.element, subs, variant: p.variant ?? main.variant, grade: p.grade ?? mau.grade, dang } };
}

// ---- màn Trận với replay mẫu ------------------------------------------------------------------------------------

let pick = readHash();
let current: Replay = sampleReplay(styleOf(pick).style, { ult: pick.ult });
const source: ReplaySource = { label: "Trận mẫu", load: async () => current };
const sprites = new Sprites();
const battle = new BattleScene([source], sprites);
const canvas = document.getElementById("view") as HTMLCanvasElement;
const app = new App(canvas, document.getElementById("hud")!, document.getElementById("tabbar")!, [battle]);
app.start();
const spritesReady = sprites.load();

/** Phần riêng của BattleScene mà trang thử cần đọc (không đổi màn Trận vì trang thử). */
const inner = battle as unknown as { player: ReplayPlayer | null; index: ReplayIndex | null; fx3d: SkillFx | null; place(pos: number, lat: number): { x: number; y: number }; lat(id: number): number; vertical: boolean | null; arenaBackdrop(): { ready(vertical: boolean): Promise<boolean> } | null };

// ---- bảng chọn ----------------------------------------------------------------------------------------------------

document.head.insertAdjacentHTML(
  "beforeend",
  `<style>
  #xt { position: fixed; left: 0; right: 0; top: 0; z-index: 20; padding: 6px 8px 8px; display: grid; gap: 5px;
    background: linear-gradient(rgba(20,17,15,0.94), rgba(20,17,15,0.82)); border-bottom: 1px solid #3a322a; font-size: 13px; }
  #xt .row { display: flex; gap: 5px; align-items: center; flex-wrap: wrap; }
  #xt select, #xt button { font: inherit; color: #efe6d6; background: #241f1a; border: 1px solid #3a322a; border-radius: 6px; height: 28px; padding: 0 6px; min-width: 0; }
  #xt select.wide { flex: 1; }
  #xt label { display: inline-flex; gap: 3px; align-items: center; color: #d8ccb6; }
  #xt .info { color: #a89c88; font-size: 12px; }
  #xt .phase { display: flex; gap: 3px; }
  #xt .phase span { flex: 1; text-align: center; font-size: 11px; padding: 2px 0; border-radius: 4px; background: #241f1a; color: #8a7e6a; }
  #xt .phase span.on { background: #b3261e; color: #fff; }
  </style>`,
);
const panel = document.createElement("div");
panel.id = "xt";
const groups = new Map<ElementId, Mau[]>();
for (const m of LIST) {
  const el = scrollKind(m.main).element;
  if (!groups.has(el)) groups.set(el, []);
  groups.get(el)!.push(m);
}
const elOptions = (sel: string | null) =>
  ELEMENT_IDS.map((e) => `<option value="${e}" ${sel === e ? "selected" : ""}>${ELEMENT_STYLE[e].name}</option>`).join("");
panel.innerHTML = `
  <div class="row">
    <button id="xt-prev" aria-label="Chiêu tiêu biểu trước">◀</button>
    <select id="xt-mau" class="wide">${[...groups].map(([el, ms]) => `<optgroup label="${ELEMENT_STYLE[el].name}">${ms.map((m) => `<option value="${m.no}">${m.no}. ${m.name}</option>`).join("")}</optgroup>`).join("")}</select>
    <button id="xt-next" aria-label="Chiêu tiêu biểu sau">▶</button>
  </div>
  <div class="row">
    <select id="xt-pham" aria-label="Phẩm"><option value="">Phẩm gốc</option>${GRADE_NAMES.map((g, i) => `<option value="${i + 1}">${i + 1} · ${g}</option>`).join("")}</select>
    <select id="xt-bt" aria-label="Biến thể"><option value="">Biến thể gốc</option>${VARIANTS.map((v) => `<option value="${v}">${VARIANT_NAMES[v]}</option>`).join("")}</select>
    <select id="xt-phu" aria-label="Hệ phụ"><option value="">Hệ phụ gốc</option><option value="none">Không hệ phụ</option>${elOptions(null)}</select>
  </div>
  <div class="row">
    <select id="xt-dang" class="wide" aria-label="Dáng chiêu"><option value="">Dáng tự chọn theo dữ liệu</option><option value="goc">Hình gốc của loại chiêu</option>${DANG.map((d) => `<option value="${d}">${DANG_NAME[d]}</option>`).join("")}</select>
  </div>
  <div class="row">
    <label><input type="checkbox" id="xt-ult"> Chiêu cuối</label>
    <label><input type="checkbox" id="xt-cu"> 2D cũ</label>
    <label><input type="checkbox" id="xt-lap"> Lặp</label>
    <button id="xt-film">Ảnh nhịp</button>
    <button id="xt-soi">Soi từng khung</button>
    <span class="info" id="xt-info"></span>
  </div>
  <div class="phase" id="xt-phase"><span>1 Khởi chiêu</span><span>2 Đường bay</span><span>3 Chạm trúng</span><span>4 Trạng thái</span></div>`;
document.body.append(panel);
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const selMau = $<HTMLSelectElement>("xt-mau");
const selPham = $<HTMLSelectElement>("xt-pham");
const selBt = $<HTMLSelectElement>("xt-bt");
const selPhu = $<HTMLSelectElement>("xt-phu");
const selDang = $<HTMLSelectElement>("xt-dang");
const chkUlt = $<HTMLInputElement>("xt-ult");
const chkCu = $<HTMLInputElement>("xt-cu");
const chkLap = $<HTMLInputElement>("xt-lap");
const info = $<HTMLSpanElement>("xt-info");
const phases = [...$<HTMLDivElement>("xt-phase").children] as HTMLElement[];

function syncPanel(): void {
  selMau.value = String(pick.no);
  selPham.value = pick.grade === null ? "" : String(pick.grade);
  selBt.value = pick.variant ?? "";
  selPhu.value = pick.sub ?? "";
  selDang.value = pick.dang ?? "";
  chkUlt.checked = pick.ult;
  chkCu.checked = pick.old;
  chkLap.checked = pick.loop;
  const { style } = styleOf(pick);
  // Dáng không hợp loại chiêu đang chọn thì làm mờ.
  for (const o of selDang.options) if (o.value && o.value !== "goc") o.disabled = !DANG_FOR[o.value as Dang].includes(style.skill);
  const shown = recipe(style).dang;
  const subs = style.subs?.length ? " + " + style.subs.map((e) => ELEMENT_STYLE[e].name).join(", ") : "";
  info.textContent = `${SKILL_NAME[style.skill]} · ${ELEMENT_STYLE[style.element].name}${subs} · ${VARIANT_NAMES[style.variant!]} · ${GRADE_NAMES[(style.grade ?? 1) - 1]}${shown ? " · " + DANG_NAME[shown] : ""}`;
}

let framed = false;
function reload(): void {
  writeHash(pick);
  syncPanel();
  current = sampleReplay(styleOf(pick).style, { ult: pick.ult });
  framed = false;
  battle.open(source);
}

selMau.onchange = () => {
  pick = { ...pick, no: Number(selMau.value), grade: null, variant: null, sub: null, dang: null };
  reload();
};
selPham.onchange = () => ((pick = { ...pick, grade: selPham.value ? Number(selPham.value) : null }), reload());
selBt.onchange = () => ((pick = { ...pick, variant: (selBt.value || null) as Variant | null }), reload());
selPhu.onchange = () => ((pick = { ...pick, sub: (selPhu.value || null) as Pick["sub"] }), reload());
selDang.onchange = () => ((pick = { ...pick, dang: (selDang.value || null) as Pick["dang"] }), reload());
chkUlt.onchange = () => ((pick = { ...pick, ult: chkUlt.checked }), reload());
chkLap.onchange = () => ((pick = { ...pick, loop: chkLap.checked }), writeHash(pick));
chkCu.onchange = () => {
  pick = { ...pick, old: chkCu.checked };
  writeHash(pick);
  inner.fx3d?.show(!pick.old);
};
const showcase = SHOWCASE.map(([el, type]) => showcaseNo(el, type));
const step = (d: number) => {
  const i = showcase.indexOf(pick.no);
  const next = showcase[(i < 0 ? 0 : i + d + showcase.length) % showcase.length];
  pick = { ...pick, no: next, grade: null, variant: null, sub: null, dang: null };
  reload();
};
$("xt-prev").onclick = () => step(-1);
$("xt-next").onclick = () => step(1);
syncPanel();

// Mỗi khung: khung camera quanh trận mẫu lần đầu, lặp trận, dừng ở t trên URL, sáng pha đang chạy.
function tick(): void {
  const player = inner.player;
  if (player) {
    if (!framed) {
      framed = true;
      frameCamera();
      inner.fx3d?.show(!pick.old);
      if (pick.t !== null) {
        player.seek(pick.t * player.tps);
        player.playing = false;
      }
    }
    if (pick.loop && player.playing && player.t >= player.end - 1) player.seek(0);
    const tl = timeline();
    const t = player.t;
    const phase = !tl ? -1 : t < tl.windup ? -1 : t < tl.travel ? 0 : t < tl.hit ? 1 : t < tl.settle ? 2 : 3;
    phases.forEach((el, i) => el.classList.toggle("on", i === phase));
  }
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

/** Camera ôm người ra chiêu và các mục tiêu, chừa chỗ cho bảng chọn ở trên. */
function frameCamera(): void {
  const v = app.view;
  const pts = current.units.map((u) => inner.place(u.pos, 0));
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const pad = 90;
  const r = { x: Math.min(...xs) - pad, y: Math.min(...ys) - pad - 40, w: Math.max(...xs) - Math.min(...xs) + 2 * pad, h: Math.max(...ys) - Math.min(...ys) + 2 * pad + 40 };
  // Vừa khoảng giữa bảng chọn và thanh điều khiển: tâm vùng nhìn của camera nằm giữa màn chừa đáy, nên dời xuống nửa bảng.
  const top = panel.getBoundingClientRect().bottom;
  const cam = battle.camera;
  cam.zoom = Math.min((v.w - 16) / r.w, (v.h - v.bottom - top - 16) / r.h);
  cam.x = r.x + r.w / 2;
  cam.y = r.y + r.h / 2 - top / (2 * cam.zoom);
}

/** Mốc bốn pha của chiêu trong trận mẫu, theo tốc độ đang phát. */
function timeline(): CastTimeline | null {
  const player = inner.player;
  const index = inner.index;
  const c = index?.casts[0];
  if (!player || !index || !c) return null;
  const tps = player.tps;
  return castTimeline({ index, life: (s) => Math.min(2 * tps, s * tps * player.speed) }, c, recipeOf(c));
}

/** Nhịp của lần ra chiêu trong trận mẫu (DONG_TAC.md): tick mỗi khung 30 khung/giây, số khung khựng, có phải đòn chạm. */
function beats(): { F: number; hold: number; contact: boolean; tl: CastTimeline } | null {
  const player = inner.player;
  const c = inner.index?.casts[0];
  const tl = timeline();
  if (!player || !c || !tl) return null;
  const tps = player.tps;
  return { F: Math.min(2 * tps, (1 / FPS) * tps * player.speed), hold: holdOf(c, recipeOf(c)), contact: !NO_CONTACT.has(c.skill), tl };
}

/** Tên nhịp ở thời điểm tt (tick). */
function beatAt(tt: number): string {
  const b = beats();
  if (!b) return "";
  const { F, hold, contact, tl } = b;
  if (tt < tl.windup) return "chờ";
  if (tt < tl.travel) return "tụ lực";
  if (tt < tl.hit) return tt < tl.travel + 4 * F ? "vụt" : "bay";
  const n = (tt - tl.hit) / F;
  if (contact && n < IMPACT_FRAMES) return "va chạm";
  if (contact && n < IMPACT_FRAMES + hold) return "khựng";
  if (tt < tl.settle - 0.35 * (tl.settle - tl.hit - (contact ? (IMPACT_FRAMES + hold) * F : 0))) return "bung";
  return tt < tl.settle ? "lắng" : "trạng thái";
}

/**
 * Vùng cắt ảnh (px CSS): ôm mọi người trong trận mẫu (hay chỉ người ra chiêu và mục tiêu khi `tight`), chừa chỗ cho hiệu
 * ứng bay cao.
 */
function cropRect(tight = false): { sx: number; sy: number; sw: number; sh: number } {
  const v = app.view;
  const c = inner.index?.casts[0];
  const ids = tight && c ? [c.unit, ...c.targets] : current.units.map((u) => u.id);
  const pts = current.units.filter((u) => ids.includes(u.id)).map((u) => {
    const p = inner.place(u.pos, inner.lat(u.id));
    return battle.camera.toScreen(p.x, p.y, v);
  });
  const top = panel.getBoundingClientRect().bottom;
  // Cắt sát nhưng không nhỏ hơn khoảng 4 × 5 ô người (cận chiến hai người đứng sát nhau).
  const minW = tight ? 190 : 0;
  const minH = tight ? 230 : 0;
  let x0 = Math.min(...pts.map((p) => p.x)) - (tight ? 46 : 70);
  let x1 = Math.max(...pts.map((p) => p.x)) + (tight ? 46 : 70);
  let y0 = Math.min(...pts.map((p) => p.y)) - (tight ? 80 : 110);
  let y1 = Math.max(...pts.map((p) => p.y)) + (tight ? 40 : 60);
  if (x1 - x0 < minW) [x0, x1] = [(x0 + x1 - minW) / 2, (x0 + x1 + minW) / 2];
  if (y1 - y0 < minH) [y0, y1] = [(y0 + y1 - minH) / 2, (y0 + y1 + minH) / 2];
  const sx = Math.max(0, x0);
  const sy = Math.max(top, y0);
  const sw = Math.min(v.w, x1) - sx;
  const sh = Math.min(v.h - v.bottom, y1) - sy;
  return { sx, sy, sw, sh };
}

/** Vẽ đồng bộ màn Trận ở tick tt rồi dán vùng cắt vào ô (dx, dy, cw, ch) của tấm ảnh. */
function shoot(o: CanvasRenderingContext2D, tt: number, row: "old" | "new", rc: ReturnType<typeof cropRect>, dx: number, dy: number, cw: number, ch: number): void {
  const player = inner.player!;
  const v = app.view;
  const gl = document.querySelector<HTMLCanvasElement>(".htk-hieu-ung canvas");
  player.seek(tt);
  for (let pass = 0; pass < 2; pass++) {
    const ctx = v.ctx;
    ctx.setTransform(v.dpr, 0, 0, v.dpr, 0, 0);
    ctx.fillStyle = "#14110f";
    ctx.fillRect(0, 0, v.w, v.h);
    battle.draw(v);
  }
  o.drawImage(canvas, rc.sx * v.dpr, rc.sy * v.dpr, rc.sw * v.dpr, rc.sh * v.dpr, dx, dy, cw, ch);
  if (row === "new" && gl && inner.fx3d?.active) {
    const s = gl.width / v.w;
    o.drawImage(gl, rc.sx * s, rc.sy * s, rc.sw * s, rc.sh * s, dx, dy, cw, ch);
  }
}

/** Chuẩn bị chụp: pane ẩn thì rAF thưa, tự vẽ một khung để màn Trận chọn chiều sân, rồi khung camera nếu chưa. */
function readyToShoot(): void {
  battle.draw(app.view);
  if (!framed) {
    framed = true;
    frameCamera();
  }
}

/**
 * Tấm ảnh các nhịp (mỗi nhịp một ảnh, DONG_TAC.md): mỗi hàng một bản (2D cũ, Three.js), mỗi cột một mốc: tụ lực, bay,
 * khung va chạm, khựng, bung, trạng thái. Vẽ đồng bộ từng khung bằng chính màn Trận, cắt vùng dưới bảng chọn.
 */
function film(rows: ("old" | "new")[] = ["old", "new"], only?: number[], title?: string): HTMLCanvasElement | null {
  const player = inner.player;
  const b = beats();
  if (!player || !b) return null;
  const { tl, F, hold, contact } = b;
  const v = app.view;
  readyToShoot();
  // Một bản (chỉ Three.js) thì cắt sát người ra chiêu và mục tiêu.
  const { sx, sy, sw, sh } = cropRect(rows.length === 1);
  // Pha 4 chụp ở khoảng 60% thời hạn trạng thái dài nhất của trận mẫu (sau pha chạm trúng nếu trạng thái ngắn).
  const untils = (current.events as unknown as { kind: string; until?: number }[]).filter((e) => e.kind === "status").map((e) => e.until ?? 0);
  const linger = untils.length ? Math.max(tl.settle + 2, tl.hit + 0.6 * (Math.max(...untils) - tl.hit)) : tl.settle + 8;
  const stop = contact ? (IMPACT_FRAMES + hold) * F : 0;
  const times = [
    tl.windup + 0.7 * (tl.travel - tl.windup),
    tl.travel + 0.55 * (tl.hit - tl.travel),
    tl.hit + 0.5 * F,
    tl.hit + (IMPACT_FRAMES + hold / 2) * F,
    tl.hit + stop + 0.3 * (tl.settle - tl.hit - stop),
    Math.min(linger, current.ticks - 2),
  ];
  const allLabels = ["1 Tụ lực", "2 Đường bay", "3 Khung va chạm", "3 Khựng", "3 Bung", "4 Trạng thái"];
  const pickIdx = only ?? [0, 1, 2, 3, 4, 5];
  const labels = pickIdx.map((i) => allLabels[i]);
  const allTimes = times.slice();
  times.length = 0;
  for (const i of pickIdx) times.push(allTimes[i]);
  // Hai bản thì mỗi hàng một mốc (2D cũ | Three.js); một bản thì xếp hai mốc mỗi hàng; chọn ít mốc thì cả hàng một chiêu.
  // Tấm nhóm (`only`): mỗi bản một hàng (2D cũ, rồi Three.js), mỗi cột một mốc.
  const cols = only ? only.length : rows.length === 1 ? 2 : rows.length;
  const cw = Math.round((v.w * 2) / cols) - 4;
  const ch = Math.round((sh * cw) / sw);
  const out = document.createElement("canvas");
  const head = 28;
  const cap = title ? 34 : 0;
  const cells = times.length * rows.length;
  out.width = (cw + 4) * cols;
  out.height = (ch + head) * Math.ceil(cells / cols) + cap;
  const o = out.getContext("2d")!;
  o.fillStyle = "#14110f";
  o.fillRect(0, 0, out.width, out.height);
  if (title) {
    o.fillStyle = "#ffd34d";
    o.font = "bold 24px system-ui, sans-serif";
    o.textBaseline = "top";
    o.fillText(title, 8, 4);
  }
  const was = { t: player.t, playing: player.playing };
  player.playing = false;
  rows.forEach((row, ri) => {
    inner.fx3d?.show(row === "new");
    times.forEach((tt, ci) => {
      const cell = only ? ri * only.length + ci : rows.length === 1 ? ci : ci * rows.length + ri;
      const dx = (cell % cols) * (cw + 4);
      const top0 = Math.floor(cell / cols) * (ch + head) + cap;
      const dy = top0 + head;
      shoot(o, tt, row, { sx, sy, sw, sh }, dx, dy, cw, ch);
      o.fillStyle = "#efe6d6";
      o.font = "bold 22px system-ui, sans-serif";
      o.textBaseline = "top";
      o.fillText(`${row === "new" ? "Three.js" : "2D cũ"} · ${labels[ci]}`, dx + 6, top0 + 2);
    });
  });
  inner.fx3d?.show(!pick.old);
  player.seek(was.t);
  player.playing = was.playing;
  return out;
}

/**
 * Soi từng khung (DONG_TAC.md: soi mọi khung rồi mới dựng): mọi khung 30 khung/giây của bản Three.js, từ `from` khung
 * trước lúc chạm (mặc định đầu khởi chiêu, tối đa 18 khung) tới hết pha chạm trúng; mỗi ô ghi số khung tính từ lúc chạm và
 * nhịp (tụ lực, vụt, bay, va chạm, khựng, bung, lắng).
 */
function probe(opt: { from?: number; to?: number; cols?: number; tight?: boolean } = {}): HTMLCanvasElement | null {
  const player = inner.player;
  const b = beats();
  if (!player || !b) return null;
  const { tl, F } = b;
  const v = app.view;
  readyToShoot();
  const rc = cropRect(opt.tight ?? true);
  const n0 = opt.from ?? Math.max(-18, Math.floor((tl.windup - tl.hit) / F));
  const n1 = opt.to ?? Math.ceil((tl.settle - tl.hit) / F);
  const cols = opt.cols ?? 6;
  const cw = Math.round((v.w * 2) / cols) - 4;
  const ch = Math.round((rc.sh * cw) / rc.sw);
  const head = 20;
  const n = n1 - n0 + 1;
  const out = document.createElement("canvas");
  out.width = (cw + 4) * cols;
  out.height = (ch + head) * Math.ceil(n / cols);
  const o = out.getContext("2d")!;
  o.fillStyle = "#14110f";
  o.fillRect(0, 0, out.width, out.height);
  const was = { t: player.t, playing: player.playing };
  player.playing = false;
  inner.fx3d?.show(true);
  for (let i = 0; i < n; i++) {
    const k = n0 + i;
    const tt = tl.hit + k * F + 0.01;
    const dx = (i % cols) * (cw + 4);
    const top0 = Math.floor(i / cols) * (ch + head);
    shoot(o, tt, "new", rc, dx, top0 + head, cw, ch);
    const beat = beatAt(tt);
    o.fillStyle = beat === "va chạm" ? "#ff5a4f" : beat === "khựng" ? "#ffd34d" : "#efe6d6";
    o.font = "bold 15px system-ui, sans-serif";
    o.textBaseline = "top";
    o.fillText(`${k > 0 ? "+" : ""}${k} · ${beat}`, dx + 4, top0 + 2);
  }
  inner.fx3d?.show(!pick.old);
  player.seek(was.t);
  player.playing = was.playing;
  return out;
}

/**
 * Tấm so sánh một nhóm chiêu: mỗi chiêu một dải (tên công pháp, rồi các mốc `only` ở bản 2D cũ và Three.js), xếp dọc.
 * Dùng để gửi ảnh trước/sau cho người dùng.
 */
async function sheet(items: Partial<Pick>[], only: number[] = [1, 2], rows: ("old" | "new")[] = ["old", "new"]): Promise<HTMLCanvasElement | null> {
  await spritesReady;
  const parts: HTMLCanvasElement[] = [];
  for (const it of items) {
    await go(it);
    battle.draw(app.view);
    await inner.arenaBackdrop()?.ready(!!inner.vertical);
    const { mau, style } = styleOf(pick);
    const subs = style.subs?.length ? " + " + style.subs.map((e) => ELEMENT_STYLE[e].name).join(", ") : "";
    const title = `${mau.name}${pick.ult ? " · Chiêu cuối" : ""} — ${SKILL_NAME[style.skill]} · ${ELEMENT_STYLE[style.element].name}${subs} · ${VARIANT_NAMES[style.variant!]} · ${GRADE_NAMES[(style.grade ?? 1) - 1]}`;
    const c = film(rows, only, title);
    if (c) parts.push(c);
  }
  if (!parts.length) return null;
  const out = document.createElement("canvas");
  out.width = Math.max(...parts.map((p) => p.width));
  out.height = parts.reduce((h, p) => h + p.height + 6, 0);
  const o = out.getContext("2d")!;
  o.fillStyle = "#0c0a08";
  o.fillRect(0, 0, out.width, out.height);
  let y = 0;
  for (const p of parts) {
    o.drawImage(p, 0, y);
    y += p.height + 6;
  }
  return out;
}

/** Hiện tấm ảnh các pha phủ lên trang (bấm để đóng). */
function showFilm(rows?: ("old" | "new")[], canvasIn?: HTMLCanvasElement | null): void {
  const c = canvasIn ?? film(rows);
  if (!c) return;
  document.getElementById("xt-film")?.remove();
  const wrap = document.createElement("div");
  wrap.id = "xt-film";
  Object.assign(wrap.style, { position: "fixed", inset: "0", zIndex: "30", background: "#14110f", overflow: "auto", display: "grid", placeItems: "start center" });
  const img = new Image();
  img.src = c.toDataURL("image/png");
  img.style.width = "100%";
  img.style.imageRendering = "auto";
  wrap.append(img);
  wrap.onclick = () => wrap.remove();
  document.body.append(wrap);
}
$("xt-film").onclick = () => showFilm();
$("xt-soi").onclick = () => showFilm(undefined, probe());

/** Đổi lựa chọn rồi chờ trận mẫu mới nạp xong (dùng từ console khi chụp ảnh). */
async function go(p: Partial<Pick>): Promise<void> {
  pick = { ...pick, grade: null, variant: null, sub: null, dang: null, ult: false, ...p };
  reload();
  while (!inner.player) await new Promise((r) => setTimeout(r, 20));
}

window.addEventListener("hashchange", () => {
  const next = readHash();
  if (JSON.stringify(next) === JSON.stringify(pick)) return;
  pick = next;
  reload();
});
Object.assign(window, { xemThu: { battle, app, inner, sampleReplay, film, probe, beatAt, showFilm, timeline, showcase, go, sheet, styleOf: () => styleOf(pick) } });

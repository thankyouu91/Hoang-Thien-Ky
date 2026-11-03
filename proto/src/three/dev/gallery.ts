// Trang thử mọi cảnh của lớp Three.js: /three.html khi chạy dev.
//   #dong/<cảnh>         cảnh động phủ cả màn (đo khung/giây), có thẻ chữ mẫu để xem độ dễ đọc
//   #nuong/<cảnh>        cùng cảnh ở chế độ nướng (ảnh tĩnh, nướng lại khi đổi cỡ)
//   #nen/<hệ>            renderBackground: 11 công trình, 10 điểm, nền vùng của một hệ
//   #san                 renderArena: 3 sân, ngang và đứng, có chấm người mẫu giữa hai lớp
//   #tran/<sân>          createArenaBackdrop như màn Trận: camera kéo, zoom chậm, vẽ nền, chấm người, lớp trước mỗi khung
//   #do                  đo thời gian vẽ một khung của mọi cảnh động ở 375 × 812, dpr 1,5 (mức tối đa của chế độ động)
import { ELEMENT_IDS } from "../../replay/types.ts";
import { ELEMENT_STYLE } from "../../theme/elements.ts";
import { benchScene, createArenaBackdrop, hasWebGL, type ArenaBackdrop, mountBakedScene, mountScene, prefersReducedMotion, renderArena, renderBackground, threeStats, type ArenaKind, type SceneHandle, type SceneName, type Tone } from "../index.ts";

const LOCATIONS = ["chinh_dien", "tang_kinh_cac", "ho_son_dai_tran", "dien_vo_truong", "luyen_dan_phong", "luyen_khi_cac", "linh_duoc_vien", "bao_kho", "truyen_tong_tran", "thuong_hoi", "phi_thang_dai"];
const POINTS = ["thanh_chu", "son_mon", "ben_do", "deo", "hang_di_thu", "linh_tuyen", "mo_duoc", "mo_linh_thach", "mo_quang", "cua_bi_canh"];
const ARENAS: ArenaKind[] = ["vo_truong", "mo_linh_thach", "cao_nguyen"];
const SCENES: { id: SceneName; name: string }[] = [
  { id: "son_thuy", name: "Sơn thủy" },
  ...ELEMENT_IDS.map((e) => ({ id: e as SceneName, name: ELEMENT_STYLE[e].name })),
  { id: "linh_khi", name: "Linh khí (lớp phủ)" },
];

document.head.insertAdjacentHTML(
  "beforeend",
  `<style>
  html, body { margin: 0; height: 100%; background: #120d09; color: #ede5d8; font: 14px/1.4 system-ui, sans-serif; }
  #stage { position: fixed; inset: 0; overflow: hidden; }
  #bar { position: fixed; left: 0; right: 0; top: 0; z-index: 10; display: flex; flex-wrap: wrap; gap: 6px; padding: 8px;
    background: linear-gradient(#120d09ee, #120d0900); align-items: center; }
  #bar select, #bar button, #bar label { font: inherit; color: inherit; background: #2a241dcc; border: 1px solid #ffffff22; border-radius: 8px; padding: 5px 8px; }
  #bar button[aria-pressed=true] { background: #8a6a2e; }
  #stat { position: fixed; right: 8px; bottom: 8px; z-index: 10; font: 12px ui-monospace, monospace; background: #000a; padding: 4px 8px; border-radius: 6px; }
  #card { position: absolute; left: 16px; right: 16px; bottom: 90px; z-index: 2; padding: 16px 18px; border-radius: 12px;
    background: rgba(241, 228, 195, 0.92); color: #2a1d14; box-shadow: 0 10px 30px #0008; }
  #card h1 { margin: 0 0 4px; font-size: 22px; } #card p { margin: 0; color: #5a3d27; }
  #title { position: absolute; left: 0; right: 0; top: 18%; z-index: 2; text-align: center; font-size: 30px; letter-spacing: 2px; text-shadow: 0 2px 12px #000; }
  #grid { position: fixed; inset: 0; top: 0; overflow: auto; padding: 64px 12px 40px; box-sizing: border-box; }
  #grid h2 { font-size: 15px; margin: 18px 0 8px; color: #d9b45a; }
  .tiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 8px; }
  .tile { position: relative; border-radius: 8px; overflow: hidden; background: #1f1b16; aspect-ratio: 5 / 3; }
  .tile img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .tile span { position: absolute; left: 6px; bottom: 4px; font-size: 12px; text-shadow: 0 1px 3px #000; }
  .arena { display: flex; gap: 10px; flex-wrap: wrap; align-items: flex-start; }
  .arena canvas { border-radius: 8px; display: block; }
</style>`,
);

document.body.innerHTML = `
  <div id="stage"><div id="title">Khai Tông Lập Phái</div><div id="card"><h1>Động phủ</h1><p>Chữ trên thẻ giấy phải đọc được trên mọi cảnh nền.</p></div></div>
  <div id="grid" hidden></div>
  <div id="bar">
    <button data-mode="dong">Động</button><button data-mode="nuong">Nướng</button><button data-mode="nen">Ảnh nền</button><button data-mode="san">Sân đấu</button><button data-mode="tran">Trận</button><button data-mode="do">Đo</button>
    <select id="scene">${SCENES.map((s) => `<option value="${s.id}">${s.name}</option>`).join("")}</select>
    <select id="tone"><option value="giay">Giấy (kem)</option><option value="chang_vang">Chạng vạng</option></select>
    <label><input type="checkbox" id="lk"> linh khí</label>
    <label><input type="checkbox" id="nodisc"> không mặt trời</label>
    <label><input type="checkbox" id="nosky"> không trời</label>
    <input id="seed" type="number" value="1" min="1" style="width:56px">
  </div>
  <div id="stat"></div>`;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const stage = $<HTMLDivElement>("stage");
const grid = $<HTMLDivElement>("grid");
const sceneSel = $<HTMLSelectElement>("scene");
const toneSel = $<HTMLSelectElement>("tone");
const lk = $<HTMLInputElement>("lk");
const seedIn = $<HTMLInputElement>("seed");
const noDisc = $<HTMLInputElement>("nodisc");
const noSky = $<HTMLInputElement>("nosky");
const stat = $<HTMLDivElement>("stat");

let handle: SceneHandle | null = null;
let backdrop: ArenaBackdrop | null = null;
let overlay: SceneHandle | null = null;

function state(): { mode: string; scene: string } {
  const [mode = "dong", scene = "son_thuy"] = location.hash.slice(1).split("/");
  return { mode, scene };
}

function go(mode: string, scene = sceneSel.value): void {
  location.hash = `${mode}/${scene}`;
}

function clear(): void {
  handle?.dispose();
  overlay?.dispose();
  handle = overlay = null;
  backdrop?.dispose();
  backdrop = null;
  grid.innerHTML = "";
}

function params() {
  return { seed: Number(seedIn.value) || 1, tone: toneSel.value as Tone, linhKhi: lk.checked, disc: !noDisc.checked, sky: !noSky.checked };
}

async function render(): Promise<void> {
  const { mode, scene } = state();
  clear();
  for (const b of document.querySelectorAll<HTMLButtonElement>("#bar button")) b.setAttribute("aria-pressed", String(b.dataset.mode === mode));
  sceneSel.value = scene;
  const live = mode === "dong" || mode === "nuong";
  stage.hidden = !live;
  grid.hidden = live;
  // nền trang như dashboard: kem khi tông giấy
  grid.style.background = mode === "nen" && toneSel.value === "giay" ? "#f6efdf" : "";
  grid.style.color = mode === "nen" && toneSel.value === "giay" ? "#2a2018" : "";
  if (!hasWebGL()) stat.textContent = "Không có WebGL2: các API trả null, màn giữ nền 2D";
  if (mode === "dong") {
    if (scene === "linh_khi") {
      stage.style.background = "#120d09";
      handle = mountScene(stage, "linh_khi", { seed: params().seed });
    } else {
      // không trời: nền trong suốt, xem trên nền kem của dashboard
      stage.style.background = noSky.checked ? "#f6efdf" : "";
      handle = mountScene(stage, scene as SceneName, params());
    }
  } else if (mode === "nuong") {
    stage.style.backgroundColor = noSky.checked ? "#f6efdf" : "";
    handle = mountBakedScene(stage, scene as SceneName, params());
    if (lk.checked) overlay = mountScene(stage, "linh_khi", { seed: params().seed });
  } else if (mode === "nen") {
    const el = (ELEMENT_IDS as readonly string[]).includes(scene) ? (scene as (typeof ELEMENT_IDS)[number]) : "loi";
    const seed = params().seed;
    const section = (title: string, items: { label: string; url: Promise<string | null> }[]) => {
      grid.insertAdjacentHTML("beforeend", `<h2>${title}</h2>`);
      const tiles = document.createElement("div");
      tiles.className = "tiles";
      grid.append(tiles);
      for (const it of items) {
        const t = document.createElement("div");
        t.className = "tile";
        t.innerHTML = `<span>${it.label}</span>`;
        tiles.append(t);
        void it.url.then((u) => u && t.insertAdjacentHTML("afterbegin", `<img src="${u}" alt="">`));
      }
    };
    const t0 = performance.now();
    section(`Công trình · ${ELEMENT_STYLE[el].name}`, LOCATIONS.map((v) => ({ label: v, url: renderBackground("cong_trinh", el, seed, { variant: v, tone: params().tone }) })));
    section(`Điểm bản đồ · ${ELEMENT_STYLE[el].name}`, POINTS.map((v) => ({ label: v, url: renderBackground("diem", el, seed, { variant: v, tone: params().tone }) })));
    section("Nền vùng · 12 hệ", ELEMENT_IDS.map((e) => ({ label: ELEMENT_STYLE[e].name, url: renderBackground("vung", e, seed, { tone: params().tone }) })));
    void renderBackground("vung", "am_lanh", seed, { tone: params().tone }).then(() => (stat.textContent = `33 ảnh 320×192 nướng xong sau ${Math.round(performance.now() - t0)} ms`));
  } else if (mode === "do") {
    grid.insertAdjacentHTML("beforeend", `<h2>Thời gian vẽ một khung, 375 × 812 px, dpr 1,5 (CPU + GPU máy này)</h2><pre id="bench"></pre>`);
    const out = grid.querySelector("#bench")!;
    for (const sc of SCENES) {
      for (const lkOn of sc.id === "linh_khi" ? [false] : [false, true]) {
        const r = await benchScene(sc.id, { seed: 1, linhKhi: lkOn }, 375, 812, 1.5);
        if (state().mode !== "do") return;
        out.textContent += `${(sc.name + (lkOn ? " + linh khí" : "")).padEnd(24)} ${r ? `${r.avg.toFixed(2)} ms (JS ${r.cpu.toFixed(2)})` : "không có WebGL"}
`;
      }
    }
  } else if (mode === "tran") {
    const kind: ArenaKind = (ARENAS as string[]).includes(scene) ? (scene as ArenaKind) : "vo_truong";
    grid.insertAdjacentHTML("beforeend", `<h2>${ARENAS.map((k) => (k === kind ? `<b>${k}</b>` : `<a style="color:#d9b45a" href="#tran/${k}">${k}</a>`)).join(" · ")}</h2>`);
    const cv = document.createElement("canvas");
    grid.append(cv);
    const W = Math.min(innerWidth - 24, 640);
    const H = Math.max(240, innerHeight - 150);
    const dpr = Math.min(devicePixelRatio, 2);
    cv.style.width = `${W}px`;
    cv.style.height = `${H}px`;
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
    const vertical = H > W;
    const bd = createArenaBackdrop(kind, { seed: params().seed });
    backdrop = bd;
    const field = vertical ? { x: -210, y: 0, w: 420, h: 768 } : { x: 0, y: -210, w: 768, h: 420 };
    const zoom0 = Math.min((W - 16) / field.w, (H - 16) / field.h);
    const ctx = cv.getContext("2d", { alpha: false })!;
    let spent = 0;
    let frames = 0;
    const loop = (now: number) => {
      if (backdrop !== bd) return;
      const t = now / 1000;
      const zoom = zoom0 * (1 + 0.18 * Math.sin(t * 0.3));
      const camX = field.x + field.w / 2 + Math.sin(t * 0.21) * 50;
      const camY = field.y + field.h / 2 + Math.cos(t * 0.17) * 50;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = "#14110f";
      ctx.fillRect(0, 0, cv.width, cv.height);
      const sc = dpr * zoom;
      ctx.setTransform(sc, 0, 0, sc, dpr * (W / 2 - camX * zoom), dpr * (H / 2 - camY * zoom));
      const t0 = performance.now();
      const ok = bd.draw(ctx, t, vertical);
      spent += performance.now() - t0;
      // người mẫu: 5 mỗi đội dọc trục, lệch nửa làn như màn Trận
      for (let i = 0; i < 10; i++) {
        const along = (i < 5 ? 1 + i * 0.9 : 7.4 + (i - 5) * 0.9) * 64;
        const lat = i % 2 ? 30 : -30;
        const x = vertical ? lat : along;
        const y = vertical ? 768 - along : lat;
        ctx.fillStyle = i < 5 ? "#5aa9e6" : "#ec5b4f";
        ctx.beginPath();
        ctx.arc(x, y, 16, 0, Math.PI * 2);
        ctx.fill();
      }
      const t1 = performance.now();
      bd.drawFront(ctx, t, vertical);
      spent += performance.now() - t1;
      frames++;
      if (frames % 60 === 0) {
        stat.textContent = ok ? `nền Trận: ${(spent / frames).toFixed(2)} ms JS mỗi khung (draw + drawFront)` : "đang nướng nền...";
        spent = frames = 0;
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  } else if (mode === "san") {
    const box = document.createElement("div");
    box.className = "arena";
    grid.append(box);
    const t0 = performance.now();
    for (const kind of ARENAS) {
      for (const vertical of [false, true]) {
        const w = vertical ? 200 : 344;
        const h = vertical ? 344 : 192;
        const cv = document.createElement("canvas");
        cv.width = w * 2;
        cv.height = h * 2;
        cv.style.width = `${w}px`;
        cv.style.height = `${h}px`;
        cv.title = `${kind}${vertical ? " (đứng)" : ""}`;
        box.append(cv);
        void renderArena(kind, w, h, { vertical, seed: params().seed, dpr: 2 }).then((l) => {
          if (!l) return;
          const ctx = cv.getContext("2d")!;
          ctx.drawImage(l.back, 0, 0, cv.width, cv.height);
          // người mẫu giữa hai lớp: 5 chấm mỗi đội dọc trục sân
          for (let i = 0; i < 10; i++) {
            const t = (i < 5 ? 0.12 + i * 0.07 : 0.6 + (i - 5) * 0.07) * (vertical ? cv.height : cv.width);
            const x = vertical ? cv.width / 2 + (i % 2 ? 14 : -14) : t;
            const y = vertical ? cv.height - t : cv.height / 2 + (i % 2 ? 12 : -12);
            ctx.fillStyle = i < 5 ? "#5aa9e6" : "#ec5b4f";
            ctx.beginPath();
            ctx.arc(x, y, 10, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.drawImage(l.front, 0, 0, cv.width, cv.height);
          stat.textContent = `sân đấu: ${Math.round(performance.now() - t0)} ms cho 6 cặp lớp`;
        });
      }
    }
  }
}

for (const b of document.querySelectorAll<HTMLButtonElement>("#bar button")) b.addEventListener("click", () => go(b.dataset.mode!));
sceneSel.addEventListener("change", () => go(state().mode, sceneSel.value));
for (const el of [toneSel, lk, seedIn, noDisc, noSky]) el.addEventListener("change", () => void render());
window.addEventListener("hashchange", () => void render());
void render();

// Đo khung/giây độc lập với host: trung bình và khung tệ nhất trong 1 giây.
let last = 0;
let n = 0;
let acc = 0;
let worst = 0;
const tick = (now: number) => {
  if (last) {
    const dt = now - last;
    acc += dt;
    n++;
    worst = Math.max(worst, dt);
    if (acc >= 1000) {
      const { mode } = state();
      const fps = (n * 1000) / acc;
      const bad = worst;
      if (mode === "dong" || mode === "nuong")
        void threeStats().then((s) => {
          stat.textContent = `${fps.toFixed(1)} fps · tệ nhất ${bad.toFixed(0)} ms · độ phân giải ×${(s?.scale ?? 1).toFixed(2)} · dpr ${devicePixelRatio}${prefersReducedMotion() ? " · giảm chuyển động" : ""}`;
        });
      acc = n = worst = 0;
    }
  }
  last = now;
  requestAnimationFrame(tick);
};
requestAnimationFrame(tick);

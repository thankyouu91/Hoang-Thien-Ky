// App sửa map rời (sua_map.html), liên kết với game qua assets/map_khu/<vùng>__<khu>.json (định dạng ở scenes/mmo/mapKhu.ts):
// chọn khu, đặt nền và vật cảnh từ hình có sẵn trong assets/pixellab/, đặt tổ bầy quái, vẽ vùng cấm, Lưu rồi Chơi thử.
// Lớp ô đất (scenes/mmo/oDat.ts): chọn loại đất rồi tô lên lưới, mép tự ghép; nước tự thành vùng cấm trong game.
// Lưu ghi thẳng vào repo qua dev server (vite.config.ts, /__map); không có dev server thì tải file JSON về.
import { ACT_LABEL, bayTuDong, bossTuDong, macDinh, mapId, type Hinh, type MapKhu, type Rect } from "../scenes/mmo/mapKhu.ts";
import { doO, lopMoi, O_DIR, toO, veLop, type BoODat } from "../scenes/mmo/oDat.ts";
import { zone, ZONE_COUNT } from "../scenes/mmo/tienTrinh.ts";

type Layer = "nen" | "vat" | "bay" | "boss" | "cam";
type Tool = "chon" | "bay" | "boss" | "cam" | "o" | { file: string; layer: "nen" | "vat" };
/** Nhóm hình trong bảng chọn: tiền tố trong manifest, tên, lớp đặt vào. */
const GROUPS: [string, string, "nen" | "vat"][] = [
  ["vat_canh/", "Cây cối, vật cảnh", "vat"],
  ["freepixel/cay/", "FreePixel · cây", "vat"],
  ["freepixel/da/", "FreePixel · đá", "vat"],
  ["freepixel/co/", "FreePixel · cỏ, hoa", "vat"],
  ["freepixel/nuoc/", "FreePixel · nước", "vat"],
  ["freepixel/cong_trinh/", "FreePixel · công trình", "vat"],
  ["chien_truong/", "Nền chiến trường", "nen"],
  ["map_con/", "Nền map con", "nen"],
  ["san_dau/", "Nền sân đấu", "nen"],
  ["cong_trinh/", "Công trình", "vat"],
  ["tong_mon/", "Tông môn", "vat"],
  ["diem/", "Điểm (đảo, mỏ, hang)", "vat"],
  ["thu/", "Thú", "vat"],
];
const BASE = import.meta.env.BASE_URL;
const src = (file: string) => `${BASE}${file.startsWith("freepixel/") ? "" : "pixellab/"}${file}.png`;
const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;

let idx = Math.max(0, Math.min(ZONE_COUNT - 1, Number(new URLSearchParams(location.search).get("khu")) || 0));
let map: MapKhu = macDinh(zone(idx));
let tool: Tool = "chon";
let sel: { layer: Layer; i: number } | null = null;
let dirty = false;
let files: string[] = [];
/** Lớp ô đất: bộ ô, loại đất đang cầm, cỡ cọ, chế độ đổ, tấm đã vẽ (null = cần vẽ lại), các bước hoàn tác. */
let bo: BoODat | null = null;
let datChon = "";
let coCo = 1;
let doMau = false;
let tamO: HTMLCanvasElement | null = null;
const lui: string[][] = [];
const cam = { x: 0, y: 0, zoom: 0.3 };
const imgs = new Map<string, HTMLImageElement>();
const canvas = $<HTMLCanvasElement>("#view");
const ctx = canvas.getContext("2d")!;

function img(file: string): HTMLImageElement {
  let i = imgs.get(file);
  if (!i) {
    i = new Image();
    i.onload = draw;
    i.src = src(file);
    imgs.set(file, i);
  }
  return i;
}

// ---------- Bảng bên ----------

const side = $("#side");
side.innerHTML = `
  <h1>Sửa map khu</h1>
  <div><h2>Khu</h2><div class="row"><select id="khu"></select></div>
    <div class="num" style="margin-top:4px"><label>Rộng<input id="mw" type="number" step="10" /></label><label>Cao<input id="mh" type="number" step="10" /></label></div></div>
  <div><h2>Công cụ</h2><div class="row" id="tools">
    <button data-t="chon" title="Chọn, kéo để dời; kéo chỗ trống để lia">Chọn / dời</button>
    <button data-t="bay" title="Bấm lên map để đặt tổ một bầy quái">+ Bầy quái</button>
    <button data-t="boss" title="Bấm lên map để đặt một boss (mạnh gấp 10, hồi sinh 90 giây)">+ Boss</button>
    <button data-t="cam" title="Kéo một khung chữ nhật không đi vào được">+ Vùng cấm</button></div>
    <small>Lăn chuột: phóng. Chuột phải hoặc kéo chỗ trống: lia. Del: xóa. F: lật. D: nhân đôi. [ ]: thứ tự vẽ.</small></div>
  <div><h2>Ô đất</h2><div id="odat"></div>
    <div class="row" style="margin-top:4px"><select id="coco" title="Cỡ cọ">${[1, 2, 3, 5, 9].map((n) => `<option value="${n}">Cọ ${n}×${n}</option>`).join("")}</select>
    <button id="do" title="Đổ loại đất vào cả vùng liền nhau">Đổ</button><button id="lui" title="Ctrl+Z">Hoàn tác</button><button id="xoao">Bỏ lớp ô</button></div>
    <small>Chọn loại đất rồi kéo trên map để tô. Mép tự ghép. Nước không đi vào được.</small></div>
  <div><h2>Hình có sẵn</h2><div class="row"><select id="grp"></select></div><div class="row" style="margin:4px 0"><input id="loc" placeholder="Lọc theo tên…" style="flex:1" /></div><div id="pal"></div></div>
  <div><h2>Đang chọn</h2><div id="props"><small>Chưa chọn gì.</small></div></div>
  <div class="row"><button id="luu" class="go">Lưu</button><button id="choi">Chơi thử</button><button id="tai">Tải JSON</button><button id="macdinh">Về mặc định</button></div>
  <div id="msg"></div>`;

const khu = $<HTMLSelectElement>("#khu");
khu.innerHTML = Array.from({ length: ZONE_COUNT }, (_, i) => `<option value="${i}">${i} · ${zone(i).name}</option>`).join("");
khu.onchange = () => {
  if (dirty && !confirm("Map đang sửa chưa lưu. Bỏ thay đổi?")) {
    khu.value = String(idx);
    return;
  }
  void open(Number(khu.value));
};
const grp = $<HTMLSelectElement>("#grp");
grp.innerHTML = GROUPS.map(([, name], i) => `<option value="${i}">${name}</option>`).join("");
grp.onchange = palette;
$<HTMLInputElement>("#loc").oninput = palette;
for (const [id, key] of [["mw", "w"], ["mh", "h"]] as const) {
  $<HTMLInputElement>("#" + id).onchange = (e) => {
    map[key] = Math.max(200, Number((e.target as HTMLInputElement).value) || map[key]);
    touch();
  };
}
$("#tools").onclick = (e) => {
  const t = (e.target as HTMLElement).closest<HTMLButtonElement>("button")?.dataset.t;
  if (t) setTool(t as "chon" | "bay" | "boss" | "cam");
};
$<HTMLSelectElement>("#coco").onchange = (e) => (coCo = Number((e.target as HTMLSelectElement).value));
$("#do").onclick = () => {
  doMau = !doMau;
  $("#do").classList.toggle("on", doMau);
};
$("#lui").onclick = undo;
$("#xoao").onclick = () => {
  if (!map.o || !confirm("Bỏ cả lớp ô đất của khu này?")) return;
  delete map.o;
  lui.length = 0;
  setTool("chon");
  touch();
};
$("#odat").onclick = (e) => {
  const k = (e.target as HTMLElement).closest<HTMLButtonElement>("button")?.dataset.k;
  if (!k || !bo) return;
  datChon = k;
  if (!map.o) {
    // Lớp ô phủ kín map; map nới ra cho tròn số ô.
    map.o = lopMoi(bo, map.w, map.h);
    map.w = map.o.cot * map.o.co;
    map.h = map.o.hang * map.o.co;
    touch();
  }
  setTool("o");
};
$("#luu").onclick = () => void save();
$("#tai").onclick = download;
$("#choi").onclick = () => {
  if (dirty) say("Lưu trước rồi mới chơi thử được bản mới.", true);
  window.open(`${BASE}?khu=${idx}`, "_blank");
};
$("#macdinh").onclick = () => {
  if (!confirm("Bỏ bố cục đang sửa, lấy lại map mặc định của khu này?")) return;
  map = macDinh(zone(idx));
  sel = null;
  touch();
};

function say(text: string, bad = false): void {
  const m = $("#msg");
  m.textContent = text;
  m.style.color = bad ? "#f0a090" : "#9fd49a";
}

function setTool(t: Tool): void {
  tool = t;
  for (const b of side.querySelectorAll<HTMLButtonElement>("#tools button")) b.classList.toggle("on", b.dataset.t === t);
  for (const b of side.querySelectorAll<HTMLButtonElement>("#odat button")) b.classList.toggle("on", t === "o" && b.dataset.k === datChon);
  draw();
  for (const b of side.querySelectorAll<HTMLButtonElement>("#pal button")) b.classList.toggle("on", typeof t === "object" && b.dataset.f === t.file);
}

function palette(): void {
  const [prefix, , layer] = GROUPS[Number(grp.value)];
  const q = $<HTMLInputElement>("#loc").value.trim().toLowerCase();
  const list = files.filter((f) => f.startsWith(prefix) && f.includes(q)).slice(0, 150);
  const pal = $("#pal");
  pal.innerHTML = list.map((f) => `<button data-f="${f}" title="${f}"><img loading="lazy" src="${src(f)}" alt="${f}" /></button>`).join("") || "<small>Không có hình nào.</small>";
  pal.onclick = (e) => {
    const f = (e.target as HTMLElement).closest<HTMLButtonElement>("button")?.dataset.f;
    if (f) {
      setTool({ file: f, layer });
      say("Bấm lên map để đặt hình.");
    }
  };
}

function props(): void {
  const p = $("#props");
  const o = sel && lop(sel.layer)[sel.i];
  if (!sel || !o) {
    p.innerHTML = "<small>Chưa chọn gì.</small>";
    return;
  }
  const keys = sel.layer === "bay" || sel.layer === "boss" ? ["x", "y"] : ["x", "y", "w", "h"];
  const h = o as Hinh;
  const bs = o as { ten?: string };
  p.innerHTML = `<small>${sel.layer === "bay" ? "Tổ bầy quái" : sel.layer === "boss" ? "Boss" : sel.layer === "cam" ? "Vùng cấm" : h.file}</small>
    ${sel.layer === "boss" ? `<div class="row" style="margin:4px 0"><input id="ten" placeholder="Tên boss (bỏ trống: Thủ lĩnh)" value="${bs.ten ?? ""}" style="flex:1" /></div>` : ""}
    <div class="num">${keys.map((k) => `<label>${k}<input data-k="${k}" type="number" value="${Math.round((o as unknown as Record<string, number>)[k])}" /></label>`).join("")}</div>
    ${sel.layer === "vat" ? `<div class="row" style="margin-top:4px"><select id="act"><option value="">Chỉ để trang trí</option>${Object.entries(ACT_LABEL).map(([k, v]) => `<option value="${k}" ${h.act === k ? "selected" : ""}>Chạm mở: ${v}</option>`).join("")}</select></div>` : ""}`;
  p.onchange = (e) => {
    const t = e.target as HTMLInputElement;
    if (t.dataset.k) (o as unknown as Record<string, number>)[t.dataset.k] = Number(t.value) || 0;
    else if (t.id === "act") h.act = (t.value as Hinh["act"]) || undefined;
    else if (t.id === "ten") bs.ten = t.value.trim() || undefined;
    touch(false);
  };
}

/** Bảng loại đất: mỗi nút là ô nguyên của loại đó, cắt từ tấm của bộ đầu tiên có nó. */
function bangDat(): void {
  if (!bo) return;
  const b = bo;
  $("#odat").innerHTML = b.dat.map((d) => {
    const s = b.bo.find((x) => x.lo === d.k || x.up === d.k)!;
    const [x, y] = s.o[s.lo === d.k ? 0 : 15];
    return `<button data-k="${d.k}" title="${d.ten}${d.cam ? " (không đi được)" : ""}" style="background:url(${src(O_DIR + s.f)}) -${x * 32}px -${y * 32}px / 128px 128px"></button>`;
  }).join("");
}

function undo(): void {
  const cu = lui.pop();
  if (!cu || !map.o) return;
  map.o.dat = cu;
  touch(false);
}

/** Tô hoặc đổ tại điểm thế giới p. */
function toTai(p: { x: number; y: number }): void {
  const l = map.o;
  if (!l) return;
  const c = Math.floor(p.x / l.co);
  const r = Math.floor(p.y / l.co);
  if (doMau ? doO(l, c, r, datChon) : toO(l, c, r, datChon, coCo)) touch(false);
}

function touch(refreshProps = true): void {
  dirty = true;
  tamO = null;
  $<HTMLInputElement>("#mw").value = String(Math.round(map.w));
  $<HTMLInputElement>("#mh").value = String(Math.round(map.h));
  if (refreshProps) props();
  draw();
}

// ---------- Mở, lưu ----------

async function open(i: number): Promise<void> {
  idx = i;
  khu.value = String(i);
  const z = zone(i);
  map = macDinh(z);
  let from = "mặc định (chưa có file)";
  try {
    const r = await fetch(`${BASE}map_khu/${mapId(z.bg)}.json`, { cache: "no-store" });
    if (r.ok && r.headers.get("content-type")?.includes("json")) {
      map = { ...map, ...((await r.json()) as MapKhu) };
      from = `assets/map_khu/${mapId(z.bg)}.json`;
    }
  } catch {
    // Không có dev server: sửa từ mặc định, lưu bằng Tải JSON.
  }
  sel = null;
  lui.length = 0;
  if (tool === "o") setTool("chon");
  touch();
  dirty = false;
  fit();
  history.replaceState(null, "", `?khu=${i}`);
  say(`Đang sửa: ${z.name} · nguồn: ${from}`);
}

function json(): string {
  const r = (o: Rect) => ({ x: Math.round(o.x), y: Math.round(o.y), w: Math.round(o.w), h: Math.round(o.h) });
  const hinh = (h: Hinh) => ({ file: h.file, ...r(h), ...(h.lat ? { lat: true } : {}), ...(h.act ? { act: h.act } : {}) });
  const out: MapKhu = {
    w: Math.round(map.w), h: Math.round(map.h), nen: map.nen.map(hinh), vat: map.vat.map(hinh),
    bay: map.bay.map((p) => ({ x: Math.round(p.x), y: Math.round(p.y) })), cam: map.cam.map(r),
    ...(map.boss ? { boss: map.boss.map((b) => ({ x: Math.round(b.x), y: Math.round(b.y), ...(b.ten ? { ten: b.ten } : {}) })) } : {}),
    ...(map.o ? { o: map.o } : {}),
  };
  return JSON.stringify(out, null, 1);
}

async function save(): Promise<void> {
  const id = mapId(zone(idx).bg);
  try {
    const r = await fetch(`/__map/${id}`, { method: "POST", headers: { "x-htk-map": "1" }, body: json() });
    if (!r.ok) throw new Error(String(r.status));
    dirty = false;
    say(`Đã lưu assets/map_khu/${id}.json`);
  } catch {
    download();
    say(`Không ghi được vào repo (không chạy dev server). Đã tải ${id}.json về: chép vào assets/map_khu/ và thêm tên vào index.json.`, true);
  }
}

function download(): void {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([json() + "\n"], { type: "application/json" }));
  a.download = mapId(zone(idx).bg) + ".json";
  a.click();
  URL.revokeObjectURL(a.href);
}

// ---------- Vẽ ----------

function fit(): void {
  cam.zoom = Math.min(canvas.clientWidth / map.w, canvas.clientHeight / map.h) * 0.94;
  cam.x = map.w / 2;
  cam.y = map.h / 2;
  draw();
}

const toWorld = (sx: number, sy: number) => ({ x: (sx - canvas.clientWidth / 2) / cam.zoom + cam.x, y: (sy - canvas.clientHeight / 2) / cam.zoom + cam.y });

function draw(): void {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = "#14110f";
  ctx.fillRect(0, 0, w, h);
  const s = dpr * cam.zoom;
  ctx.setTransform(s, 0, 0, s, dpr * (w / 2 - cam.x * cam.zoom), dpr * (h / 2 - cam.y * cam.zoom));
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "#39422c";
  ctx.fillRect(0, 0, map.w, map.h);
  const px = 1 / cam.zoom; // một px màn hình theo đơn vị thế giới
  const hinh = (o: Hinh) => {
    const im = img(o.file);
    if (!im.complete || !im.naturalWidth) return;
    if (o.lat) {
      ctx.save();
      ctx.translate(o.x + o.w, o.y);
      ctx.scale(-1, 1);
      ctx.drawImage(im, 0, 0, o.w, o.h);
      ctx.restore();
    } else ctx.drawImage(im, o.x, o.y, o.w, o.h);
  };
  map.nen.forEach(hinh);
  if (map.o && bo) {
    tamO ??= veLop(map.o, bo, (f) => {
      const im = img(O_DIR + f);
      return im.complete && im.naturalWidth ? im : null;
    });
    if (tamO) ctx.drawImage(tamO, 0, 0, map.o.cot * map.o.co, map.o.hang * map.o.co);
    if (tool === "o" && cam.zoom > 0.25) {
      // Lưới mờ khi đang tô và đã phóng đủ gần.
      ctx.strokeStyle = "rgba(255,255,255,0.12)";
      ctx.lineWidth = px;
      ctx.beginPath();
      for (let c = 1; c < map.o.cot; c++) ctx.rect(c * map.o.co, 0, 0, map.h);
      for (let r = 1; r < map.o.hang; r++) ctx.rect(0, r * map.o.co, map.w, 0);
      ctx.stroke();
    }
  }
  map.vat.forEach(hinh);
  for (const r of map.cam) {
    ctx.fillStyle = "rgba(214, 55, 42, 0.3)";
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = "#d6372a";
    ctx.lineWidth = 2 * px;
    ctx.strokeRect(r.x, r.y, r.w, r.h);
  }
  // Tổ bầy: vòng là tầm quái đi loanh quanh. Chưa đặt bầy nào thì vẽ mờ chỗ game sẽ tự rải.
  const auto = map.bay.length === 0 && !zone(idx).safe && !zone(idx).boss;
  ctx.font = `bold ${14 * px}px system-ui`;
  ctx.textAlign = "center";
  (auto ? bayTuDong(map) : map.bay).forEach((p, i) => {
    ctx.globalAlpha = auto ? 0.4 : 1;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 110, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 211, 77, 0.18)";
    ctx.fill();
    ctx.strokeStyle = "#ffd34d";
    ctx.lineWidth = 2 * px;
    ctx.stroke();
    ctx.fillStyle = "#ffd34d";
    ctx.fillText(auto ? "tự rải" : `bầy ${i + 1}`, p.x, p.y + 5 * px);
  });
  // Boss: chưa đặt thì vẽ mờ chỗ game tự đặt.
  const bossAuto = !map.boss && !zone(idx).safe && !zone(idx).boss;
  bossTuDong(map).forEach((b, i) => {
    ctx.globalAlpha = bossAuto ? 0.4 : 1;
    ctx.beginPath();
    ctx.arc(b.x, b.y, 80, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(214, 55, 42, 0.25)";
    ctx.fill();
    ctx.strokeStyle = "#ff6a5a";
    ctx.lineWidth = 3 * px;
    ctx.stroke();
    ctx.fillStyle = "#ff6a5a";
    ctx.fillText(bossAuto ? "boss tự đặt" : b.ten || `boss ${i + 1}`, b.x, b.y + 5 * px);
  });
  ctx.globalAlpha = 1;
  ctx.strokeStyle = "#ffe9a8";
  ctx.lineWidth = 2 * px;
  ctx.strokeRect(0, 0, map.w, map.h);
  // Người mẫu cho dễ ước lượng tỉ lệ (cao 56 đơn vị), đứng ở cửa trái.
  ctx.fillStyle = "#7bc96f";
  ctx.fillRect(70 - 10, map.h / 2 - 56, 20, 56);
  const b = selBox();
  if (b) {
    ctx.strokeStyle = "#5fd0ff";
    ctx.lineWidth = 2 * px;
    ctx.setLineDash([6 * px, 4 * px]);
    ctx.strokeRect(b.x, b.y, b.w, b.h);
    ctx.setLineDash([]);
    if (sel!.layer !== "bay") {
      ctx.fillStyle = "#5fd0ff";
      ctx.fillRect(b.x + b.w - 7 * px, b.y + b.h - 7 * px, 14 * px, 14 * px);
    }
  }
}

/** Danh sách của một lớp (boss có thể chưa có). */
const lop = (layer: Layer): Rect[] => (layer === "boss" ? ((map.boss ??= []) as unknown as Rect[]) : (map[layer] as unknown as Rect[]));

function box(layer: Layer, i: number): Rect {
  if (layer === "bay" || layer === "boss") {
    const p = lop(layer)[i];
    const r = layer === "bay" ? 110 : 80;
    return { x: p.x - r, y: p.y - r, w: 2 * r, h: 2 * r };
  }
  return lop(layer)[i];
}

function selBox(): Rect | null {
  return sel && lop(sel.layer)[sel.i] ? box(sel.layer, sel.i) : null;
}

// ---------- Chuột, phím ----------

let drag: { kind: "pan" | "move" | "size" | "rect" | "o"; sx: number; sy: number; ox: number; oy: number; ow: number; oh: number } | null = null;

function pick(x: number, y: number): { layer: Layer; i: number } | null {
  // Lớp trên cùng trước: bầy, vùng cấm, vật, nền; trong một lớp thì hình vẽ sau nằm trên.
  for (const layer of ["boss", "bay", "cam", "vat", "nen"] as Layer[]) {
    for (let i = lop(layer).length - 1; i >= 0; i--) {
      const b = box(layer, i);
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return { layer, i };
    }
  }
  return null;
}

canvas.addEventListener("contextmenu", (e) => e.preventDefault());
canvas.addEventListener("pointerdown", (e) => {
  canvas.setPointerCapture(e.pointerId);
  const p = toWorld(e.offsetX, e.offsetY);
  const start = (kind: NonNullable<typeof drag>["kind"], o: Partial<Rect> = {}) =>
    (drag = { kind, sx: e.offsetX, sy: e.offsetY, ox: o.x ?? 0, oy: o.y ?? 0, ow: o.w ?? 0, oh: o.h ?? 0 });
  if (e.button !== 0) {
    start("pan", cam);
    return;
  }
  if (tool === "o") {
    if (!map.o) return;
    lui.push([...map.o.dat]);
    if (lui.length > 50) lui.shift();
    toTai(p);
    start("o");
    return;
  }
  if (typeof tool === "object") {
    const im = img(tool.file);
    // Cỡ mặc định: nền gấp 5 lần điểm ảnh (như map mặc định), vật gấp đôi; hình FreePixel 200px vẽ nguyên cỡ.
    const k = tool.layer === "nen" ? 5 : tool.file.startsWith("freepixel/") ? 1 : 2;
    const w = (im.naturalWidth || 128) * k;
    const h = (im.naturalHeight || 128) * k;
    map[tool.layer].push({ file: tool.file, x: p.x - w / 2, y: p.y - h / 2, w, h });
    sel = { layer: tool.layer, i: map[tool.layer].length - 1 };
    setTool("chon");
    touch();
  } else if (tool === "bay") {
    map.bay.push({ x: p.x, y: p.y });
    sel = { layer: "bay", i: map.bay.length - 1 };
    touch();
  } else if (tool === "boss") {
    (map.boss ??= []).push({ x: p.x, y: p.y });
    sel = { layer: "boss", i: map.boss.length - 1 };
    touch();
  } else if (tool === "cam") {
    map.cam.push({ x: p.x, y: p.y, w: 0, h: 0 });
    sel = { layer: "cam", i: map.cam.length - 1 };
    start("rect", p);
    return;
  } else {
    const b = selBox();
    const px = 1 / cam.zoom;
    if (b && sel!.layer !== "bay" && Math.abs(p.x - (b.x + b.w)) < 12 * px && Math.abs(p.y - (b.y + b.h)) < 12 * px) {
      start("size", b);
      return;
    }
    sel = pick(p.x, p.y);
    props();
    draw();
    if (!sel) {
      start("pan", cam);
      return;
    }
  }
  const o = lop(sel!.layer)[sel!.i];
  start("move", o);
});

canvas.addEventListener("pointermove", (e) => {
  if (!drag) return;
  const dx = (e.offsetX - drag.sx) / cam.zoom;
  const dy = (e.offsetY - drag.sy) / cam.zoom;
  if (drag.kind === "pan") {
    cam.x = drag.ox - dx;
    cam.y = drag.oy - dy;
    draw();
    return;
  }
  if (drag.kind === "o") {
    if (!doMau) toTai(toWorld(e.offsetX, e.offsetY));
    return;
  }
  const o = sel && lop(sel.layer)[sel.i];
  if (!o) return;
  if (drag.kind === "move") {
    o.x = drag.ox + dx;
    o.y = drag.oy + dy;
  } else if (drag.kind === "rect") {
    o.x = Math.min(drag.ox, drag.ox + dx);
    o.y = Math.min(drag.oy, drag.oy + dy);
    o.w = Math.abs(dx);
    o.h = Math.abs(dy);
  } else if (sel!.layer === "cam" || e.shiftKey) {
    o.w = Math.max(10, drag.ow + dx);
    o.h = Math.max(10, drag.oh + dy);
  } else {
    // Hình giữ tỉ lệ khi kéo góc; giữ Shift để kéo tự do.
    o.w = Math.max(10, drag.ow + dx);
    o.h = (o.w * drag.oh) / drag.ow;
  }
  touch();
});

canvas.addEventListener("pointerup", () => {
  if (drag?.kind === "rect") {
    const r = map.cam[map.cam.length - 1];
    if (r.w < 8 || r.h < 8) {
      map.cam.pop();
      sel = null;
    }
    setTool("chon");
    touch();
  }
  drag = null;
});

canvas.addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();
    const before = toWorld(e.offsetX, e.offsetY);
    cam.zoom = Math.max(0.05, Math.min(4, cam.zoom * Math.exp(-e.deltaY * 0.0015)));
    const after = toWorld(e.offsetX, e.offsetY);
    cam.x += before.x - after.x;
    cam.y += before.y - after.y;
    draw();
  },
  { passive: false },
);

window.addEventListener("keydown", (e) => {
  if (["INPUT", "SELECT"].includes((e.target as HTMLElement).tagName)) return;
  const k = e.key.toLowerCase();
  if ((e.ctrlKey || e.metaKey) && k === "s") {
    e.preventDefault();
    void save();
    return;
  }
  if ((e.ctrlKey || e.metaKey) && k === "z") {
    e.preventDefault();
    undo();
    return;
  }
  if (k === "escape") setTool("chon");
  if (!sel) return;
  const list = lop(sel.layer) as unknown[];
  if (k === "delete" || k === "backspace") {
    list.splice(sel.i, 1);
    // Xóa hết boss đã đặt thì bỏ hẳn lớp để game lại tự đặt.
    if (sel.layer === "boss" && list.length === 0) delete map.boss;
    sel = null;
  } else if (k === "d") {
    const copy = { ...(list[sel.i] as Rect) };
    copy.x += 40;
    copy.y += 40;
    list.push(copy);
    sel = { layer: sel.layer, i: list.length - 1 };
  } else if (k === "f" && (sel.layer === "nen" || sel.layer === "vat")) {
    const h = map[sel.layer][sel.i];
    h.lat = !h.lat;
  } else if ((k === "[" && sel.i > 0) || (k === "]" && sel.i < list.length - 1)) {
    const j = sel.i + (k === "[" ? -1 : 1);
    [list[sel.i], list[j]] = [list[j], list[sel.i]];
    sel.i = j;
  } else return;
  touch();
});

window.addEventListener("resize", draw);
window.addEventListener("beforeunload", (e) => dirty && e.preventDefault());

// Hai nguồn hình: PixelLab (assets/pixellab) và FreePixel (assets/freepixel, đường dẫn thêm tiền tố freepixel/).
void Promise.all(
  [["pixellab", ""], ["freepixel", "freepixel/"]].map(([dir, pre]) =>
    fetch(`${BASE}${dir}/manifest.json`)
      .then((r) => r.json())
      .then((m: { assets: { file: string }[] }) => m.assets.map((a) => pre + a.file.replace(/\.png$/, "")))
      .catch(() => {
        say(`Không đọc được danh sách hình (${dir}/manifest.json).`, true);
        return [] as string[];
      }),
  ),
).then((lists) => {
  files = lists.flat().filter((f) => GROUPS.some(([p]) => f.startsWith(p)));
  palette();
});
void fetch(`${BASE}pixellab/${O_DIR}bo.json`)
  .then((r) => r.json())
  .then((b: BoODat) => {
    bo = b;
    bangDat();
    draw();
  })
  .catch(() => ($("#odat").innerHTML = "<small>Chưa có bộ ô đất (chạy node tools/o_dat/dong_goi.mjs).</small>"));
setTool("chon");
void open(idx);

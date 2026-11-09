// Bản đồ tranh cả vị diện (GDD mục 14). Mở ra là phóng tới vùng người chơi đang đứng (tâm ở vị trí của mình); thu nhỏ hết
// cỡ thấy đủ 12 vùng. Điểm là ô nút vuông (nodes.ts): khung màu theo loại, trong ô là ký hiệu hệ của vùng; rê chuột hiện
// tên, chạm mở thẻ điểm. Thu nhỏ chỉ còn thành chủ, phóng to hiện dần điểm có chủ và cửa bí cảnh, đèo, bến đò, linh tuyền,
// rồi mỏ, hang và vị trí sơn môn. Góc dưới có bật tắt tên địa danh, ranh giới, sương mù và nút về toàn cảnh, về vị trí.
// Nền, đường, ranh giới, sương: layers.ts. File điểm vùng khác chỉ tải khi tắt sương và nhìn tới vùng đó.
import { Camera, type Rect } from "../../app/camera.ts";
import type { Scene } from "../../app/scene.ts";
import type { View } from "../../app/view.ts";
import { MiniMap, OWNER_COLOR } from "../../dashboard/minimap.ts";
import type { DashCtx } from "../../dashboard/shell.ts";
import type { BanDoView, Go, PointOwner, PointType } from "../../dashboard/source.ts";
import { loadLocationArt, pointArt } from "../../dashboard/art/sectScene.ts";
import { cd, closeSheet, esc, fmt, openSheet, toast } from "../../dashboard/ui.ts";
import { WorldLayers } from "./layers.ts";
import { NODE, NODE_BIG, NodeSprites, Placer } from "./nodes.ts";
import { HOLDABLE, loadRegion, loadWorld, POINT_NAMES, type RegionMap, type RegionPoint, type WorldMap, type WorldRegion } from "./region.ts";
import { currentSpot, spotStatus, startJourney } from "../world/journey.ts";

const TAP_SLOP = 8;
/** Độ phóng (px CSS mỗi đơn vị bản đồ) từ đó hiện thêm từng bậc điểm: 1 điểm có chủ, cửa bí cảnh; 2 đèo, bến đò, linh tuyền; 3 còn lại. */
const PRIO_ZOOM = [0, 0.5, 0.9, 1.6];
const ROAD_ZOOM = 1.2;
const LABEL_ZOOM = 1.4;
/** Tên vùng hiện khi thu nhỏ dưới mức này. */
const REGION_LABEL_ZOOM = 1.3;
const FONT = '"Be Vietnam Pro", system-ui, sans-serif';
const INK = "#2a1d14";
const HALO = "rgba(243, 231, 201, 0.92)";
const TYPE_ORDER: PointType[] = ["thanh_chu", "son_mon", "cua_bi_canh", "deo", "ben_do", "linh_tuyen", "mo_linh_thach", "mo_quang", "mo_duoc", "hang_di_thu"];

type Layer = "names" | "borders" | "fog";
const LAYER_NAMES: Record<Layer, string> = { names: "Tên địa danh", borders: "Ranh giới", fog: "Sương mù" };
const PREFS_KEY = "htk.banDo.lop";

/** Một ô nút có thể vẽ: điểm của vùng đã tải, hoặc thành chủ lấy từ mục lục khi file điểm vùng chưa về. */
interface Cand {
  region: WorldRegion;
  p?: RegionPoint;
  type: PointType;
  name: string;
  x: number;
  y: number;
  prio: number;
  order: number;
  color: string;
  big: boolean;
  own?: PointOwner;
  gate: boolean;
}

export class MapScene implements Scene {
  readonly id = "ban-do";
  readonly label = "Bản đồ";
  readonly camera = new Camera();
  readonly hud: HTMLElement;
  private ctx: DashCtx;
  private world?: WorldMap;
  private layers?: WorldLayers;
  private regions = new Map<string, RegionMap>();
  private loadingRegions = new Set<string>();
  private data?: BanDoView;
  private cands: Cand[] = [];
  private placed: { c: Cand; x: number; y: number; size: number }[] = [];
  private sprites = new NodeSprites();
  private placer = new Placer();
  private prefs: Record<Layer, boolean> = { names: true, borders: true, fog: true };
  private loading: HTMLElement;
  private tip: HTMLElement;
  private canvas: HTMLCanvasElement;
  /** Đã vẽ khung đầu (mốc đo thời gian tới khi thấy bản đồ). */
  private drawn = false;
  private v?: View;
  private active = false;
  private fitted = false;
  private layersShown = false;
  private pending?: Extract<Go, { screen: "ban-do" }>;
  private tween?: { x0: number; y0: number; z0: number; x1: number; y1: number; z1: number; t: number };
  private mini: MiniMap;
  private miniTimer = 0;
  private t = 0;

  constructor(ctx: DashCtx, canvas: HTMLCanvasElement) {
    this.ctx = ctx;
    this.canvas = canvas;
    this.camera.maxZoom = 5;
    try {
      Object.assign(this.prefs, JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}"));
    } catch {
      // Không đọc được thì dùng mặc định.
    }
    this.mini = new MiniMap((x, y) => this.flyTo(x, y, Math.max(this.camera.zoom, 1.4)));
    this.hud = document.createElement("div");
    this.hud.className = "map-hud";
    this.hud.innerHTML = `<details class="map-layers">
        <summary>Lớp bản đồ</summary>
        ${(Object.keys(LAYER_NAMES) as Layer[]).map((k) => `<label><input type="checkbox" data-layer="${k}"${this.prefs[k] ? " checked" : ""}> ${LAYER_NAMES[k]}</label>`).join("")}
      </details>
      <div class="map-nav"><button type="button" data-nav="world">Toàn cảnh</button><button type="button" data-nav="home">Vị trí</button></div>`;
    this.hud.addEventListener("change", (e) => {
      const el = e.target as HTMLInputElement;
      const k = el.dataset.layer as Layer | undefined;
      if (!k) return;
      this.prefs[k] = el.checked;
      try {
        localStorage.setItem(PREFS_KEY, JSON.stringify(this.prefs));
      } catch {
        // Không lưu được thì lần sau về mặc định.
      }
      this.rebuild();
    });
    this.hud.addEventListener("click", (e) => {
      const nav = (e.target as HTMLElement).closest<HTMLElement>("[data-nav]")?.dataset.nav;
      if (nav === "world") this.showWorld();
      if (nav === "home") this.showHome();
    });
    this.hud.append(this.mini.el);
    this.loading = document.createElement("div");
    this.loading.className = "map-loading";
    this.loading.hidden = true;
    this.loading.innerHTML = `<span>Đang tải bản đồ</span><div class="bar"><i></i></div>`;
    this.hud.append(this.loading);
    this.tip = document.createElement("div");
    this.tip.className = "map-tip";
    this.tip.hidden = true;
    document.body.append(this.tip);

    // Chạm (không kéo) vào một ô thì mở thẻ điểm; rê chuột thì hiện tên.
    let down: { x: number; y: number; id: number } | null = null;
    canvas.addEventListener("pointerdown", (e) => {
      if (!this.active) return;
      down = { x: e.offsetX, y: e.offsetY, id: e.pointerId };
      this.tween = undefined;
      this.tip.hidden = true;
    });
    canvas.addEventListener("pointerup", (e) => {
      if (!this.active || !down || down.id !== e.pointerId) return;
      const moved = Math.hypot(e.offsetX - down.x, e.offsetY - down.y);
      down = null;
      if (moved <= TAP_SLOP) this.tap(e.offsetX, e.offsetY);
    });
    canvas.addEventListener("pointermove", (e) => {
      if (!this.active || e.pointerType !== "mouse" || e.buttons) return;
      this.hover(e.offsetX, e.offsetY, e.clientX, e.clientY);
    });
    canvas.addEventListener("pointerleave", () => {
      this.tip.hidden = true;
      canvas.style.cursor = "";
    });
    canvas.addEventListener("wheel", () => (this.tween = undefined), { passive: true });
  }

  /** Tải trước mục lục, ảnh nền cần trước và file điểm của vùng (gọi lúc rảnh từ dashboard). */
  prefetch(code: string): void {
    void this.ensureWorld().then((l) => l.prefetch(code));
    void this.ensureRegion(code);
  }

  /** Mở bản đồ tại một điểm của vùng mình (kèm thẻ điểm) hoặc một toạ độ bản đồ; gọi trước khi chuyển sang scene. */
  focus(g: Extract<Go, { screen: "ban-do" }>): void {
    this.pending = g;
    if (this.active) this.applyPending();
  }

  enter(v: View): void {
    this.v = v;
    this.active = true;
    // Lần đầu mở: điện thoại gập bảng lớp lại cho đỡ che bản đồ, màn rộng mở sẵn; sau đó giữ như người chơi để.
    if (!this.layersShown) {
      this.layersShown = true;
      this.hud.querySelector("details")!.open = innerWidth >= 768;
    }
    void this.reload();
    clearInterval(this.miniTimer);
    this.miniTimer = window.setInterval(() => this.syncMini(), 500);
    this.mini.start();
  }

  leave(): void {
    this.active = false;
    clearInterval(this.miniTimer);
    this.mini.stop();
    this.tip.hidden = true;
    this.canvas.style.cursor = "";
    closeSheet();
  }

  private ensureWorld(): Promise<WorldLayers> {
    return loadWorld().then((w) => {
      if (!this.layers) {
        this.world = w;
        this.layers = new WorldLayers(w);
        this.layers.onChange = () => this.showProgress();
        this.camera.bounds = { x: 0, y: 0, w: w.map.width, h: w.map.height };
      }
      return this.layers;
    });
  }

  private ensureRegion(code: string): Promise<RegionMap> {
    const got = this.regions.get(code);
    if (got) return Promise.resolve(got);
    this.loadingRegions.add(code);
    return loadRegion(code).then(async (m) => {
      const l = await this.ensureWorld();
      this.regions.set(code, m);
      this.loadingRegions.delete(code);
      l.addRegion(m);
      this.rebuild();
      return m;
    });
  }

  private async reload(): Promise<void> {
    const [d, layers] = await Promise.all([this.ctx.source.banDo(), this.ensureWorld(), loadLocationArt()]);
    this.ctx.clock.sync(d.serverNow);
    this.ctx.topbar.set(d.top);
    this.data = d;
    layers.prefetch(d.map.region);
    const home = await this.ensureRegion(d.map.region);
    layers.setRevealed(d.map.revealed.map((id) => home.points[id]));
    this.rebuild();
    this.showProgress();
    if (!this.fitted && this.v) {
      this.fitted = true;
      this.showHome(false);
    }
    this.applyPending();
    this.syncMini();
  }

  /** Dựng lại danh sách ô nút, xếp theo độ quan trọng (đổi dữ liệu, tải thêm vùng, bật tắt sương). */
  private rebuild(): void {
    const w = this.world;
    const d = this.data;
    if (!w || !d) return;
    const revealed = new Set(d.map.revealed);
    const gates = new Set(d.map.openGates);
    const out: Cand[] = [];
    for (const r of w.regions) {
      const m = this.regions.get(r.code);
      const home = r.code === d.map.region;
      if (!m || (!home && this.prefs.fog)) {
        const p = m?.points[r.capital.id];
        out.push(this.cand(w, r, p, "thanh_chu", r.capital.name, r.capital.x, r.capital.y));
        continue;
      }
      for (const p of m.points) {
        if (home && this.prefs.fog && !revealed.has(p.id) && p.type !== "thanh_chu") continue;
        const own = home ? d.owners[p.id] : undefined;
        const name = p.type === "son_mon" && own ? own.name : (p.name ?? POINT_NAMES[p.type]);
        out.push(this.cand(w, r, p, p.type, name, p.x, p.y, own, home && gates.has(p.id), home && p.id === d.map.sonMon));
      }
    }
    out.sort((a, b) => a.prio - b.prio || a.order - b.order);
    this.cands = out;
  }

  private cand(w: WorldMap, r: WorldRegion, p: RegionPoint | undefined, type: PointType, name: string, x: number, y: number, own?: PointOwner, gate = false, mine = false): Cand {
    const prio =
      type === "thanh_chu" || mine ? 0 : own || gate || type === "cua_bi_canh" ? 1 : type === "deo" || type === "ben_do" || type === "linh_tuyen" ? 2 : 3;
    const color = type === "cua_bi_canh" && p?.tier ? w.tiers[p.tier].color : w.types[type].color;
    const order = (own?.attacked ? 0 : 1) * 1e7 + TYPE_ORDER.indexOf(type) * 1e5 + (p?.id ?? 0);
    return { region: r, p, type, name, x, y, prio, order, color, big: type === "thanh_chu" || mine, own, gate };
  }

  private applyPending(): void {
    const g = this.pending;
    const m = this.data && this.regions.get(this.data.map.region);
    if (!g || !m || !this.data) return;
    this.pending = undefined;
    if (g.pointId !== undefined) {
      const p = m.points[g.pointId];
      this.flyTo(p.x, p.y, Math.max(this.camera.zoom, PRIO_ZOOM[3] + 0.4));
      const c = this.cands.find((k) => k.region.code === m.region.code && k.p?.id === p.id);
      if (c) this.openPoint(c);
      else {
        const r = this.world!.regions.find((k) => k.code === m.region.code)!;
        this.openPoint(this.cand(this.world!, r, p, p.type, p.name ?? POINT_NAMES[p.type], p.x, p.y, this.data.owners[p.id]));
      }
    } else if (g.at) this.flyTo(g.at.x, g.at.y, Math.max(this.camera.zoom, 1.4));
  }

  /** Thu cả vị diện vào màn hình. */
  private showWorld(): void {
    const v = this.v;
    const w = this.world;
    if (!v || !w) return;
    const z = this.fitZoom({ x: 0, y: 0, w: w.map.width, h: w.map.height }, v);
    this.flyTo(w.map.width / 2, w.map.height / 2, z);
  }

  /** Phóng tới vùng của mình: thấy cả vùng, vị trí của mình nằm trong khung. */
  private showHome(animate = true): void {
    const v = this.v;
    const w = this.world;
    const d = this.data;
    if (!v || !w || !d) return;
    const r = w.regions.find((k) => k.code === d.map.region)!;
    const [x0, y0, x1, y1] = r.bbox;
    const z = this.fitZoom({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 }, v);
    const x = (x0 + x1) / 2;
    const y = (y0 + y1) / 2;
    if (animate) this.flyTo(x, y, z);
    else {
      this.camera.zoom = z;
      this.camera.x = x;
      this.camera.y = y;
    }
  }

  private fitZoom(r: Rect, v: View, pad = 8): number {
    return Math.min((v.w - 2 * pad) / r.w, (v.h - v.bottom - 2 * pad) / r.h);
  }

  private flyTo(x: number, y: number, zoom: number): void {
    const c = this.camera;
    const z1 = Math.min(c.maxZoom, Math.max(c.minZoom, zoom));
    this.tween = { x0: c.x, y0: c.y, z0: c.zoom, x1: x, y1: y, z1, t: 0 };
  }

  private selfAt(m: RegionMap, d: BanDoView): { x: number; y: number } {
    const a = m.points[d.map.self.from];
    const b = m.points[d.map.self.to];
    return { x: a.x + (b.x - a.x) * d.map.self.progress, y: a.y + (b.y - a.y) * d.map.self.progress };
  }

  /** Thanh tiến độ khi ảnh nền chưa về; bản đồ vẫn dùng được trên nền giấy. */
  private showProgress(): void {
    const l = this.layers;
    this.loading.hidden = !l || l.ready;
    if (l && !l.ready) this.loading.querySelector("i")!.style.width = `${Math.round(l.progress * 100)}%`;
  }

  private syncMini(): void {
    if (!this.data || !this.v) return;
    void this.mini.set(this.data.map, this.camera.visible(this.v));
  }

  update(dt: number): void {
    this.t += dt;
    const tw = this.tween;
    if (!tw) return;
    tw.t = Math.min(1, tw.t + dt / 0.35);
    const e = 1 - (1 - tw.t) ** 3;
    // Phóng theo thang log cho đều mắt.
    this.camera.zoom = Math.exp(Math.log(tw.z0) + (Math.log(tw.z1) - Math.log(tw.z0)) * e);
    this.camera.x = tw.x0 + (tw.x1 - tw.x0) * e;
    this.camera.y = tw.y0 + (tw.y1 - tw.y0) * e;
    if (tw.t >= 1) this.tween = undefined;
  }

  draw(v: View): void {
    this.v = v;
    const w = this.world;
    const L = this.layers;
    const d = this.data;
    const ctx = v.ctx;
    const cam = this.camera;
    if (!w || !L || !d) return;
    cam.minZoom = this.fitZoom({ x: 0, y: 0, w: w.map.width, h: w.map.height }, v) * 0.9;
    cam.apply(v);
    const view = cam.visible(v);
    const z = cam.zoom;
    if (!this.drawn) {
      this.drawn = true;
      performance.mark("ban-do:khung-dau");
    }
    L.drawBackground(ctx, view, z * v.dpr);
    const inView = (r: WorldRegion) => r.bbox[0] < view.x + view.w && r.bbox[2] > view.x && r.bbox[1] < view.y + view.h && r.bbox[3] > view.y;
    const shown = w.regions.filter((r) => inView(r) && (!this.prefs.fog || r.code === d.map.region));
    if (!this.prefs.fog && z >= PRIO_ZOOM[1])
      for (const r of shown) if (!this.regions.has(r.code) && !this.loadingRegions.has(r.code)) void this.ensureRegion(r.code);
    if (z >= ROAD_ZOOM) L.drawRoads(ctx, z, shown.map((r) => r.code));
    if (this.prefs.fog) L.drawFog(ctx, view);
    if (this.prefs.borders) L.drawBorders(ctx, z);

    // Từ đây vẽ theo px CSS: ô nút và chữ giữ cỡ cố định khi phóng. Xếp chỗ theo thứ tự: thành chủ (kèm tên), các ô khác,
    // tên vùng, rồi tên các ô; cái nào chồng lên cái đã xếp thì bỏ.
    ctx.setTransform(v.dpr, 0, 0, v.dpr, 0, 0);
    const placer = this.placer;
    placer.clear();
    const maxPrio = PRIO_ZOOM.filter((k) => z >= k).length - 1;
    const pad = NODE_BIG;
    const placed: typeof this.placed = [];
    const labels: { text: string; x: number; y: number; big: boolean }[] = [];
    const label = (c: Cand, x: number, y: number, size: number) => {
      ctx.font = c.big ? `700 12px ${FONT}` : `600 11px ${FONT}`;
      const tw = ctx.measureText(c.name).width;
      // Ô đã giữ chỗ rộng hơn cạnh ô GAP/2 mỗi phía (nodes.ts), tên bắt đầu ngay dưới phần đó.
      const top = y + size / 2 + 4;
      if (placer.take(x - tw / 2 - 2, top, x + tw / 2 + 2, top + 14)) labels.push({ text: c.name, x, y: top, big: c.big });
    };
    for (const pass of [0, 1])
      for (const c of this.cands) {
        if (c.prio > maxPrio || (pass === 0) !== c.big) continue;
        const s = cam.toScreen(c.x, c.y, v);
        if (s.x < -pad || s.y < -pad || s.x > v.w + pad || s.y > v.h + pad) continue;
        const size = c.big ? NODE_BIG : NODE;
        if (!placer.node(s.x, s.y, size)) continue;
        placed.push({ c, x: s.x, y: s.y, size });
        if (pass === 0 && this.prefs.names) label(c, s.x, s.y, size);
      }
    this.placed = placed;

    // Tên vùng kiểu bản đồ cổ khi thu nhỏ; mờ dần khi phóng tới.
    if (this.prefs.names && z < REGION_LABEL_ZOOM) {
      const alpha = Math.min(1, (REGION_LABEL_ZOOM - z) / 0.4);
      const px = Math.round(Math.min(20, 13 + z * 10));
      ctx.font = `italic 700 ${px}px "Noto Serif", "Times New Roman", serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineJoin = "round";
      ctx.globalAlpha = alpha;
      for (const r of w.regions) {
        const s = cam.toScreen((r.bbox[0] + r.bbox[2]) / 2, (r.bbox[1] + r.bbox[3]) / 2, v);
        const tw = ctx.measureText(r.name).width;
        for (const dy of [0, px * 1.4, -px * 1.4])
          if (placer.take(s.x - tw / 2, s.y + dy - px / 2, s.x + tw / 2, s.y + dy + px / 2)) {
            ctx.lineWidth = 3;
            ctx.strokeStyle = HALO;
            ctx.strokeText(r.name, s.x, s.y + dy);
            ctx.fillStyle = "#5a2a17";
            ctx.fillText(r.name, s.x, s.y + dy);
            break;
          }
      }
      ctx.globalAlpha = 1;
    }
    // Tên các ô khác chỉ khi phóng đủ to.
    if (this.prefs.names && z >= LABEL_ZOOM) for (const k of placed) if (!k.c.big) label(k.c, k.x, k.y, k.size);

    // Ô nút, dấu chủ điểm, điểm đang bị đánh, cửa bí cảnh đang mở.
    const blink = Math.floor(this.t * 2) % 2 === 0;
    for (const { c, x, y, size } of placed) {
      const img = this.sprites.get(c.color, c.region.element, size, v.dpr);
      ctx.drawImage(img, x - size / 2, y - size / 2, img.width / v.dpr, img.height / v.dpr);
      if (c.gate || c.own?.attacked) {
        ctx.lineWidth = 2;
        ctx.strokeStyle = c.own?.attacked ? (blink ? "#ff5a4f" : "rgba(255, 90, 79, 0.35)") : `rgba(134, 220, 200, ${0.55 + 0.45 * Math.sin(this.t * 4)})`;
        ctx.strokeRect(x - size / 2 - 3, y - size / 2 - 3, size + 6, size + 6);
      }
      if (c.own) {
        ctx.beginPath();
        ctx.arc(x + size / 2 - 1, y - size / 2 + 1, 4, 0, Math.PI * 2);
        ctx.fillStyle = OWNER_COLOR[c.own.owner];
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = INK;
        ctx.stroke();
      }
    }

    // Tên địa danh dưới ô.
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.lineJoin = "round";
    for (const l of labels) {
      ctx.font = l.big ? `700 12px ${FONT}` : `600 11px ${FONT}`;
      ctx.lineWidth = 3;
      ctx.strokeStyle = HALO;
      ctx.strokeText(l.text, l.x, l.y);
      ctx.fillStyle = l.big ? "#6b1d12" : INK;
      ctx.fillText(l.text, l.x, l.y);
    }

    // Vị trí của mình hoặc đoàn đang đi: ghim trắng phía trên chỗ đứng.
    const home = this.regions.get(d.map.region);
    if (home) {
      const s = cam.toScreen(this.selfAt(home, d).x, this.selfAt(home, d).y, v);
      const tip = s.y - NODE_BIG / 2 - 2;
      ctx.beginPath();
      ctx.moveTo(s.x, tip);
      ctx.lineTo(s.x + 7, tip - 11);
      ctx.lineTo(s.x - 7, tip - 11);
      ctx.closePath();
      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2;
      ctx.fill();
      ctx.stroke();
    }
  }

  /** Ô đang hiện dưới toạ độ màn hình (px CSS trong canvas). */
  private hit(sx: number, sy: number): Cand | undefined {
    let best: Cand | undefined;
    let bestD = Infinity;
    for (const k of this.placed) {
      const reach = Math.max(k.size / 2 + 4, 14);
      const dd = Math.max(Math.abs(k.x - sx), Math.abs(k.y - sy));
      if (dd <= reach && dd < bestD) {
        bestD = dd;
        best = k.c;
      }
    }
    return best;
  }

  private hover(sx: number, sy: number, cx: number, cy: number): void {
    const c = this.hit(sx, sy);
    this.canvas.style.cursor = c ? "pointer" : "";
    if (!c) {
      this.tip.hidden = true;
      return;
    }
    const w = this.world!;
    const kind = c.type === "cua_bi_canh" && c.p?.tier ? w.tiers[c.p.tier].label : w.types[c.type].label;
    this.tip.innerHTML = `<b>${esc(c.name)}</b><span>${kind} · ${esc(c.region.name)}</span>${c.p ? `<span>Cấp nguy hiểm ${c.p.danger}</span>` : ""}${c.own && c.type !== "son_mon" ? `<span>Chủ: ${esc(c.own.name)}</span>` : ""}`;
    this.tip.hidden = false;
    const r = this.tip.getBoundingClientRect();
    this.tip.style.left = `${Math.min(cx + 14, window.innerWidth - r.width - 8)}px`;
    this.tip.style.top = `${Math.min(cy + 14, window.innerHeight - r.height - 8)}px`;
  }

  private tap(sx: number, sy: number): void {
    const c = this.hit(sx, sy);
    if (!c) {
      closeSheet();
      return;
    }
    if (c.p) this.openPoint(c);
    else
      void this.ensureRegion(c.region.code).then((m) => {
        const p = m.points[c.region.capital.id];
        this.openPoint({ ...c, p });
      });
  }

  /** Thẻ điểm (GDD mục 14): chủ, sản lượng, cấp nguy hiểm, nút Đi tới, Chiếm, Tuyên chiến theo chức vị. */
  private openPoint(c: Cand): void {
    const d = this.data!;
    const w = this.world!;
    const p = c.p!;
    const home = c.region.code === d.map.region;
    const own = home ? d.owners[p.id] : undefined;
    const lit = !home || d.map.revealed.includes(p.id);
    const rows: [string, string][] = [];
    rows.push(["Loại", w.types[p.type].label]);
    rows.push(["Vùng", esc(c.region.name)]);
    if (home) rows.push(["Chủ", own ? esc(own.name) : p.type === "hang_di_thu" ? "Dị thú" : HOLDABLE.includes(p.type) ? "Chưa ai giữ" : "—"]);
    rows.push(["Cấp nguy hiểm", String(p.danger)]);
    rows.push(["Tới thành chủ", `${p.stages} chặng · ${p.distance} ô`]);
    if (own?.level) rows.push(["Cấp mỏ", `${own.level} · ${fmt(own.perHour ?? 0)}/giờ`]);
    if (p.tier) rows.push(["Bậc cửa", w.tiers[p.tier].label]);
    if (p.terrain) rows.push(["Địa thế", w.terrains[p.terrain] ?? p.terrain]);
    if (own?.attacked) rows.push(["Đang bị đánh", `${esc(own.attacked.by)}, còn ${cd(own.attacked.endsAt)}`]);
    if (!lit) rows.push(["Sương mù", "Chưa mở, chỉ thấy vị trí"]);
    const inRange = home && d.inRange.includes(p.id);
    const canTake = home && d.can.chiem && HOLDABLE.includes(p.type) && own?.owner !== "minh" && own?.owner !== "dong_minh";
    const canWar = home && d.can.tuyenChien && own?.owner === "dich";
    // Map lớn chỉ chạm-là-tới (GDD mục 3, tầng 1): Đi tới bắt đầu hành trình có thời gian; đang ở điểm thì Vào khu vực (tầng 2).
    const spot = home ? spotStatus(p.id) : { kind: "xa" as const };
    const goBtn =
      spot.kind === "o_day"
        ? `<button type="button" class="seal" data-a="vao">Vào khu vực</button>`
        : spot.kind === "dang_di"
          ? `<button type="button" disabled>Đang đi… còn ${spot.remainSec} s</button>`
          : home
            ? `<button type="button" class="seal" data-a="di">Đi tới</button>`
            : "";
    const art = pointArt(c.region.code, p.type);
    const body = openSheet(
      c.name,
      `${art ? `<div class="loc-hero pix" style="background-image:url('${art}')" role="img" aria-label="${POINT_NAMES[p.type]}"></div>` : ""}
       <dl class="kv">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("")}</dl>
       <div class="actions">
         ${goBtn}
         ${canTake ? `<button type="button" data-a="chiem" ${inRange && d.held < d.maxHeld ? "" : "disabled"}>Chiếm</button>` : ""}
         ${canWar ? `<button type="button" data-a="chien">Tuyên chiến</button>` : ""}
       </div>
       ${canTake && !inRange ? `<p class="muted">Ngoài tầm Truyền Tống Trận, chưa chiếm được.</p>` : ""}
       ${canTake && inRange && d.held >= d.maxHeld ? `<p class="muted">Đã giữ đủ ${d.maxHeld} điểm theo cấp tông môn.</p>` : ""}`,
    );
    body.addEventListener("click", (e) => {
      const a = (e.target as HTMLElement).closest<HTMLElement>("[data-a]")?.dataset.a;
      if (a === "vao") this.ctx.nav.go({ screen: "the-gioi", pointId: p.id });
      if (a === "di") {
        const homeMap = this.regions.get(d.map.region);
        const from = homeMap?.points[currentSpot()];
        if (!from) return;
        const sec = startJourney(p.id, from, p);
        closeSheet();
        toast(`Đang đi tới ${p.name ?? POINT_NAMES[p.type]}, khoảng ${sec} giây…`);
      }
      if (a === "chiem") toast("Chiếm điểm bằng trận tranh điểm có ở Sprint 6.");
      if (a === "chien") toast("Tuyên chiến có ở khối M5.");
    });
  }
}

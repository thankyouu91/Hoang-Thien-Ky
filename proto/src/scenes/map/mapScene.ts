// Bản đồ tranh cả vị diện (GDD mục 14), kiểu bản đồ cổ "thông minh": ít điểm, điểm nào hiện cũng kèm tên, có tên vùng,
// sông, rừng, núi. Mở ra là phóng tới vùng người chơi đang đứng; thu nhỏ hết cỡ thấy đủ 12 vùng.
//  - Sàng lọc tính sẵn (data/maps/ha_nhan.json): mỗi điểm có độ phóng bắt đầu hiện hình (z) và hiện tên (t), đã kiểm không
//    chồng nhau; mỗi khung chỉ so độ phóng. Điểm động (của mình, có chủ, đang bị đánh, cửa đang mở, chỗ mình đứng) hiện
//    bất kể z. Khi người chơi bỏ bớt loại ở Chú giải thì số tính sẵn quá chặt, chuyển sang xếp lại theo bậc quan trọng.
//  - Ô nút vuông có ký hiệu hệ (nodes.ts), ba loại mỏ là chấm nhỏ; rê chuột hiện tên, chạm mở thẻ điểm.
//  - Tên sông và địa hình: labels.ts. Nền, đường, ranh giới, sương: layers.ts.
//  - HUD: Lớp bản đồ, Toàn cảnh / Vị trí, bản đồ mini (góc phải); Chú giải lọc theo loại và thanh "Đang ở … [Vào]" (góc trái).
import "./map.css";
import { Camera, type Rect } from "../../app/camera.ts";
import type { Scene } from "../../app/scene.ts";
import type { View } from "../../app/view.ts";
import { MiniMap, OWNER_COLOR } from "../../dashboard/minimap.ts";
import type { DashCtx } from "../../dashboard/shell.ts";
import type { BanDoView, Go, PointOwner, PointType } from "../../dashboard/source.ts";
import { loadLocationArt, pointArt } from "../../dashboard/art/sectScene.ts";
import { cd, closeSheet, esc, fmt, openSheet, toast } from "../../dashboard/ui.ts";
import { drawFeatureNames, drawRiverNames } from "./labels.ts";
import { WorldLayers } from "./layers.ts";
import { NODE, NODE_BIG, NodeSprites, Placer } from "./nodes.ts";
import {
  HOLDABLE, loadLabels, loadRegion, loadWorld, POINT_NAMES,
  type MapLabels, type PointForm, type RegionMap, type RegionPoint, type Tier, type WorldMap, type WorldRegion,
} from "./region.ts";

const TAP_SLOP = 8;
/**
 * Chỉ dùng khi đã lọc bớt loại ở Chú giải (số tính sẵn quá chặt): độ phóng (px CSS mỗi đơn vị bản đồ) từ đó hiện thêm
 * từng bậc điểm: 1 điểm có chủ, cửa bí cảnh; 2 đèo, bến đò, linh tuyền; 3 còn lại.
 */
const PRIO_ZOOM = [0, 0.5, 0.9, 1.6];
const ROAD_ZOOM = 1.2;
/** Tên vùng hiện khi thu nhỏ dưới mức này. */
const REGION_LABEL_ZOOM = 1.3;
// Tên địa danh dùng cùng chữ có chân với dashboard (mẫu tranh giấy, 2026-11-03).
const FONT = '"Noto Serif", Cambria, "Times New Roman", serif';
const INK = "#2a1d14";
const HALO = "rgba(243, 231, 201, 0.92)";
const TYPE_ORDER: PointType[] = ["thanh_chu", "son_mon", "cua_bi_canh", "deo", "ben_do", "linh_tuyen", "mo_linh_thach", "mo_quang", "mo_duoc", "hang_di_thu"];

type Layer = "names" | "terrain" | "borders" | "fog";
const LAYER_NAMES: Record<Layer, string> = { names: "Tên địa danh", terrain: "Tên sông và địa hình", borders: "Ranh giới vùng", fog: "Sương mù" };
const PREFS_KEY = "ktlp.banDo.lop";
/** Loại điểm người chơi bỏ khỏi bản đồ ở Chú giải: mã loại, hoặc "cua_bi_canh:<bậc>". */
const HIDDEN_KEY = "ktlp.banDo.an";
const TIERS: Tier[] = ["thap", "vua", "cao"];

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
  form: PointForm;
  /** Độ phóng bắt đầu hiện hình và tên (tính sẵn); Infinity là không tự hiện. */
  z: number;
  t: number;
  /** Điểm động: hiện bất kể z. */
  dyn: boolean;
  /** Điểm của sự kiện đang diễn ra (chiến tranh, Yêu Triều): nhấp nháy đỏ. */
  alert?: { title: string; endsAt: number };
}

export class MapScene implements Scene {
  readonly id = "ban-do";
  readonly label = "Bản đồ";
  readonly camera = new Camera();
  readonly hud: HTMLElement;
  private ctx: DashCtx;
  private world?: WorldMap;
  private labels?: MapLabels;
  private layers?: WorldLayers;
  private regions = new Map<string, RegionMap>();
  private loadingRegions = new Set<string>();
  private data?: BanDoView;
  private cands: Cand[] = [];
  private placed: { c: Cand; x: number; y: number; size: number }[] = [];
  private sprites = new NodeSprites();
  private placer = new Placer();
  private prefs: Record<Layer, boolean> = { names: true, terrain: true, borders: true, fog: true };
  private hidden = new Set<string>();
  private legend: HTMLDetailsElement;
  private here: HTMLElement;
  /** Điểm người chơi đang đứng (hay đang đi tới), cho thanh "Đang ở". */
  private herePoint?: Cand;
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
      this.hidden = new Set(JSON.parse(localStorage.getItem(HIDDEN_KEY) ?? "[]") as string[]);
    } catch {
      // Không đọc được thì dùng mặc định.
    }
    this.mini = new MiniMap((x, y) => this.flyTo(x, y, Math.max(this.camera.zoom, 1.4)));
    // Lớp bọc cả vùng HUD: hộp góc phải (.map-hud) giữ nguyên, góc trái có Chú giải và thanh "Đang ở".
    this.hud = document.createElement("div");
    this.hud.className = "map-ui";
    this.hud.innerHTML = `<div class="map-left">
        <details class="map-legend"><summary>Chú giải</summary><div class="map-legend-panel"></div></details>
        <div class="map-here" hidden></div>
      </div>
      <div class="map-hud">
        <details class="map-layers">
          <summary>Lớp bản đồ</summary>
          ${(Object.keys(LAYER_NAMES) as Layer[]).map((k) => `<label><input type="checkbox" data-layer="${k}"${this.prefs[k] ? " checked" : ""}> ${LAYER_NAMES[k]}</label>`).join("")}
        </details>
        <div class="map-nav"><button type="button" data-nav="world">Toàn cảnh</button><button type="button" data-nav="home">Vị trí</button></div>
      </div>`;
    this.legend = this.hud.querySelector(".map-legend")!;
    this.here = this.hud.querySelector(".map-here")!;
    this.hud.addEventListener("change", (e) => {
      const el = e.target as HTMLInputElement;
      const k = el.dataset.layer as Layer | undefined;
      const show = el.dataset.show;
      if (k) this.prefs[k] = el.checked;
      else if (show) {
        if (el.checked) this.hidden.delete(show);
        else this.hidden.add(show);
      } else return;
      try {
        localStorage.setItem(PREFS_KEY, JSON.stringify(this.prefs));
        localStorage.setItem(HIDDEN_KEY, JSON.stringify([...this.hidden]));
      } catch {
        // Không lưu được thì lần sau về mặc định.
      }
      this.rebuild();
    });
    this.hud.addEventListener("click", (e) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>("[data-nav], [data-here], [data-show-all]");
      if (el?.dataset.nav === "world") this.showWorld();
      if (el?.dataset.nav === "home") this.showHome();
      if (el?.dataset.here !== undefined) this.enterHere();
      if (el?.dataset.showAll !== undefined) {
        this.hidden.clear();
        try {
          localStorage.setItem(HIDDEN_KEY, "[]");
        } catch {
          // Không lưu được thì lần sau về mặc định.
        }
        this.renderLegend();
        this.rebuild();
      }
    });
    this.hud.querySelector(".map-hud")!.append(this.mini.el);
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

  /** Tải trước mục lục, lớp ô lót của ảnh nền và file điểm của vùng (gọi lúc rảnh từ dashboard). */
  prefetch(code: string): void {
    void this.ensureWorld().then((l) => l.prefetch());
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
      this.hud.querySelector<HTMLDetailsElement>(".map-layers")!.open = innerWidth >= 768;
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
    return Promise.all([loadWorld(), loadLabels()]).then(([w, labels]) => {
      if (!this.layers) {
        this.world = w;
        this.labels = labels;
        this.layers = new WorldLayers(w);
        this.layers.onChange = () => this.showProgress();
        this.camera.bounds = { x: 0, y: 0, w: w.map.width, h: w.map.height };
        this.renderLegend();
      }
      return this.layers;
    });
  }

  /** Bảng Chú giải: mỗi loại điểm theo thứ tự quan trọng, hình như trên bản đồ, ô chọn để lọc; cửa bí cảnh tách theo bậc. */
  private renderLegend(): void {
    const w = this.world;
    const L = this.labels;
    if (!w || !L) return;
    const row = (key: string, label: string, color: string, form: PointForm, sub = false) =>
      `<label${sub ? ` class="sub"` : ""}><i class="sw${form === "cham" ? " dot" : ""}" style="--sw:${color}"></i>${esc(label)}<input type="checkbox" data-show="${key}"${this.hidden.has(key) ? "" : " checked"}></label>`;
    this.legend.querySelector(".map-legend-panel")!.innerHTML = `<h3>Chú giải</h3>
      ${L.order
        .map((t) =>
          t === "cua_bi_canh"
            ? `${row(t, w.types[t].label, w.types[t].color, L.forms[t])}${TIERS.map((k) => row(`${t}:${k}`, w.tiers[k].label, w.tiers[k].color, L.forms[t], true)).join("")}`
            : row(t, w.types[t].label, w.types[t].color, L.forms[t]),
        )
        .join("")}
      <button type="button" class="reset" data-show-all>Hiện tất cả</button>`;
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
    layers.prefetch();
    const home = await this.ensureRegion(d.map.region);
    layers.setRevealed(d.map.revealed.map((id) => home.points[id]));
    this.rebuild();
    this.updateHere();
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
    const L = this.labels;
    if (!w || !d || !L) return;
    const revealed = new Set(d.map.revealed);
    const gates = new Set(d.map.openGates);
    const hereId = this.hereId(d);
    const alerts = new Map(d.map.alerts.flatMap((a) => a.points.map((id) => [id, { title: a.title, endsAt: a.endsAt }] as const)));
    const hidden = (p: RegionPoint) => this.hidden.has(p.type) || (p.type === "cua_bi_canh" && !!p.tier && this.hidden.has(`cua_bi_canh:${p.tier}`));
    const out: Cand[] = [];
    for (const r of w.regions) {
      const m = this.regions.get(r.code);
      const home = r.code === d.map.region;
      const zt = L.points[r.code];
      if (!m || (!home && this.prefs.fog)) {
        if (this.hidden.has("thanh_chu")) continue;
        const p = m?.points[r.capital.id];
        out.push(this.cand(w, r, p, "thanh_chu", r.capital.name, r.capital.x, r.capital.y, { z: zt?.z[r.capital.id], t: zt?.t[r.capital.id] }));
        continue;
      }
      for (const p of m.points) {
        // Điểm của sự kiện đang diễn ra hiện cả trong sương (sự kiện được báo cho cả vùng).
        const alert = home ? alerts.get(p.id) : undefined;
        if (home && this.prefs.fog && !revealed.has(p.id) && p.type !== "thanh_chu" && !alert) continue;
        const own = home ? d.owners[p.id] : undefined;
        const mine = home && p.id === d.map.sonMon;
        // Sơn môn của mình, điểm đang bị đánh, điểm của sự kiện và chỗ mình đứng không bị lọc mất.
        if (hidden(p) && !mine && !own?.attacked && !alert && !(home && p.id === hereId)) continue;
        const name = p.type === "son_mon" && own ? own.name : (p.name ?? POINT_NAMES[p.type]);
        out.push(this.cand(w, r, p, p.type, name, p.x, p.y, { own, gate: home && gates.has(p.id), mine, here: home && p.id === hereId, alert, z: zt?.z[p.id], t: zt?.t[p.id] }));
      }
    }
    out.sort((a, b) => a.prio - b.prio || a.order - b.order);
    this.cands = out;
  }

  private cand(
    w: WorldMap, r: WorldRegion, p: RegionPoint | undefined, type: PointType, name: string, x: number, y: number,
    o: { own?: PointOwner; gate?: boolean; mine?: boolean; here?: boolean; alert?: Cand["alert"]; z?: number | null; t?: number | null } = {},
  ): Cand {
    const { own, gate = false, mine = false } = o;
    const prio =
      type === "thanh_chu" || mine ? 0 : own || gate || o.alert || type === "cua_bi_canh" ? 1 : type === "deo" || type === "ben_do" || type === "linh_tuyen" ? 2 : 3;
    const color = type === "cua_bi_canh" && p?.tier ? w.tiers[p.tier].color : w.types[type].color;
    const order = (own?.attacked || o.alert ? 0 : 1) * 1e7 + TYPE_ORDER.indexOf(type) * 1e5 + (p?.id ?? 0);
    const dyn = mine || !!own || gate || !!o.here || !!o.alert;
    // Mỏ của mình hay đang bị đánh vẽ thành ô nút cho dễ thấy, mỏ khác là chấm.
    const form = dyn ? "nut" : (this.labels?.forms[type] ?? "nut");
    const z = o.z ?? Infinity;
    return { region: r, p, type, name, x, y, prio, order, color, big: type === "thanh_chu" || mine, own, gate, form, z, t: o.t ?? z, dyn, alert: o.alert };
  }

  /** Điểm mình đứng; đang trên đường thì điểm đang đi tới. */
  private hereId(d: BanDoView): number {
    const s = d.map.self;
    return s.progress > 0 && s.progress < 1 ? s.to : s.from;
  }

  /** Thanh "Đang ở": tên và loại điểm mình đứng (hay đang đi tới), nút Vào mở màn của điểm đó. */
  private updateHere(): void {
    const d = this.data;
    const w = this.world;
    const m = d && this.regions.get(d.map.region);
    if (!d || !w || !m) return;
    const s = d.map.self;
    const moving = s.progress > 0 && s.progress < 1;
    const p = m.points[this.hereId(d)];
    const r = w.regions.find((k) => k.code === m.region.code)!;
    const own = d.owners[p.id];
    const name = p.type === "son_mon" && own ? own.name : (p.name ?? POINT_NAMES[p.type]);
    this.herePoint = this.cand(w, r, p, p.type, name, p.x, p.y, { own, mine: p.id === d.map.sonMon });
    this.here.hidden = false;
    this.here.innerHTML = `<span class="txt"><small>${moving ? "Đang đi tới" : "Đang ở"} · ${esc(w.types[p.type].label)}</small><b>${esc(name)}</b></span>
      <button type="button" class="seal small" data-here>${moving ? "Xem" : "Vào"}</button>`;
  }

  /** Vào điểm đang đứng: thành chủ, sơn môn của mình có màn riêng; điểm khác mở thẻ điểm. Đang đi thì bay tới chỗ đó. */
  private enterHere(): void {
    const c = this.herePoint;
    const d = this.data;
    if (!c?.p || !d) return;
    const s = d.map.self;
    if (s.progress > 0 && s.progress < 1) this.flyTo(c.x, c.y, Math.max(this.camera.zoom, 2));
    else if (c.type === "thanh_chu") this.ctx.nav.go({ screen: "thanh-chu" });
    else if (c.p.id === d.map.sonMon) this.ctx.nav.go({ screen: "tong-mon" });
    else this.openPoint(c);
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
        this.openPoint(this.cand(this.world!, r, p, p.type, p.name ?? POINT_NAMES[p.type], p.x, p.y, { own: this.data.owners[p.id] }));
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

    // Từ đây vẽ theo px CSS: ô nút, chấm và chữ giữ cỡ cố định khi phóng. Xếp chỗ theo thứ tự: dấu của mình, thành chủ và
    // điểm động (kèm tên), các điểm khác (tới độ phóng z tính sẵn), tên vùng, tên địa hình, tên sông; cái nào chồng thì bỏ.
    ctx.setTransform(v.dpr, 0, 0, v.dpr, 0, 0);
    const B = this.labels!.boxes;
    const placer = this.placer;
    placer.clear();
    // Đã bỏ bớt loại ở Chú giải thì z/t tính sẵn quá chặt: xếp lại theo bậc quan trọng và độ phóng như trước.
    const filtered = this.hidden.size > 0;
    const maxPrio = PRIO_ZOOM.filter((k) => z >= k).length - 1;
    const pad = NODE_BIG;
    const placed: typeof this.placed = [];
    const labels: { text: string; x: number; y: number; big: boolean; px: number }[] = [];
    /** Hộp tên dưới ô (điểm động và thành chủ thử thêm phía trên nếu dưới đã kín); take = false thì chỉ thử. */
    const label = (c: Cand, x: number, y: number, size: number, take = true) => {
      const px = c.form === "cham" ? B.dotFont : c.big ? 12 : B.font;
      ctx.font = `${c.big ? 700 : 600} ${px}px ${FONT}`;
      const tw = ctx.measureText(c.name).width;
      const tops = [y + size / 2 + B.below];
      if (c.dyn || c.big) tops.push(y - size / 2 - B.below - B.line);
      for (const top of tops) {
        const box = [x - tw / 2 - 2, top, x + tw / 2 + 2, top + B.line] as const;
        if (!take) {
          if (placer.fits(...box)) return true;
          continue;
        }
        if (!placer.take(...box)) continue;
        labels.push({ text: c.name, x, y: top, big: c.big, px });
        return true;
      }
      return false;
    };
    // Bậc xếp chỗ: 0 thành chủ và sơn môn mình, 1 điểm động, 2 điểm khác (theo z/t tính sẵn). Dấu của mình (ghim và tên
    // phía trên) giữ chỗ ngay sau bậc 0, nên điểm động và điểm khác né tên mình, còn thành chủ không bị ghim che mất.
    const home = this.regions.get(d.map.region);
    const me = home && cam.toScreen(this.selfAt(home, d).x, this.selfAt(home, d).y, v);
    const meTip = me ? me.y - NODE_BIG / 2 - 2 : 0;
    ctx.font = `700 12px ${FONT}`;
    const meHalf = Math.max(8, ctx.measureText(d.top.name).width / 2 + 3);
    const tier = (c: Cand) => (c.big ? 0 : c.dyn ? 1 : 2);
    for (const pass of [0, 1, 2]) {
      if (pass === 1 && me) placer.reserve(me.x - meHalf, meTip - 28, me.x + meHalf, meTip);
      for (const c of this.cands) {
        if (tier(c) !== pass) continue;
        if (pass === 2 && (filtered ? c.prio > maxPrio : z < c.z)) continue;
        const s = cam.toScreen(c.x, c.y, v);
        if (s.x < -pad || s.y < -pad || s.x > v.w + pad || s.y > v.h + pad) continue;
        const dot = c.form === "cham";
        const size = dot ? B.dot : c.big ? NODE_BIG : NODE;
        // Điểm khác: ô nút chỉ hiện khi tên cũng có chỗ (va chạm chỉ xảy ra quanh điểm động, hay khi đã lọc thì xếp lại
        // tại chỗ); chấm mỏ thì chỉ bỏ tên.
        const needName = pass === 2 && !dot && this.prefs.names && (filtered || z >= c.t);
        if (needName && !label(c, s.x, s.y, size, false)) continue;
        if (!placer.node(s.x, s.y, size, dot ? B.dotGap : B.gap)) continue;
        placed.push({ c, x: s.x, y: s.y, size });
        if (this.prefs.names && (pass < 2 || needName || (!filtered && z >= c.t))) label(c, s.x, s.y, size);
      }
    }
    this.placed = placed;

    // Tên vùng kiểu bản đồ cổ ở chỗ rộng nhất của vùng khi thu nhỏ; mờ dần khi phóng tới.
    if (this.prefs.names && z < REGION_LABEL_ZOOM) {
      const alpha = Math.min(1, (REGION_LABEL_ZOOM - z) / 0.4);
      const px = Math.round(Math.min(20, 13 + z * 10));
      ctx.font = `italic 700 ${px}px ${FONT}`;
      ctx.letterSpacing = "2px";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineJoin = "round";
      ctx.globalAlpha = alpha;
      for (const r of this.labels!.regions) {
        const s = cam.toScreen(r.x, r.y, v);
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
      ctx.letterSpacing = "0px";
    }
    if (this.prefs.terrain) {
      // Bật sương mù thì chỉ hiện tên sông và địa hình của vùng mình, như cách lọc điểm.
      const seen = (x: { region: string }) => !this.prefs.fog || x.region === d.map.region;
      drawFeatureNames(ctx, this.labels!.features.filter(seen), cam, v, z, placer);
      drawRiverNames(ctx, this.labels!.rivers.filter(seen), cam, v, z, placer);
    }

    // Ô nút, chấm mỏ, dấu chủ điểm, điểm đang bị đánh, cửa bí cảnh đang mở.
    const blink = Math.floor(this.t * 2) % 2 === 0;
    for (const { c, x, y, size } of placed) {
      if (c.form === "cham") {
        ctx.beginPath();
        ctx.arc(x, y, size / 2, 0, Math.PI * 2);
        ctx.fillStyle = c.color;
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = INK;
        ctx.stroke();
        continue;
      }
      const img = this.sprites.get(c.color, c.region.element, size, v.dpr);
      ctx.drawImage(img, x - size / 2, y - size / 2, img.width / v.dpr, img.height / v.dpr);
      if (c.gate || c.own?.attacked || c.alert) {
        ctx.lineWidth = 2;
        ctx.strokeStyle = c.own?.attacked || c.alert ? (blink ? "#ff5a4f" : "rgba(255, 90, 79, 0.35)") : `rgba(134, 220, 200, ${0.55 + 0.45 * Math.sin(this.t * 4)})`;
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
      ctx.font = `${l.big ? 700 : 600} ${l.px}px ${FONT}`;
      ctx.lineWidth = 3;
      ctx.strokeStyle = HALO;
      ctx.strokeText(l.text, l.x, l.y);
      ctx.fillStyle = l.big ? "#6b1d12" : INK;
      ctx.fillText(l.text, l.x, l.y);
    }

    // Vị trí của mình hoặc đoàn đang đi: ghim trắng phía trên chỗ đứng, tên nhân vật trên ghim.
    if (me) {
      ctx.beginPath();
      ctx.moveTo(me.x, meTip);
      ctx.lineTo(me.x + 7, meTip - 11);
      ctx.lineTo(me.x - 7, meTip - 11);
      ctx.closePath();
      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2;
      ctx.fill();
      ctx.stroke();
      ctx.font = `700 12px ${FONT}`;
      ctx.textBaseline = "bottom";
      ctx.lineWidth = 3;
      ctx.strokeStyle = HALO;
      ctx.strokeText(d.top.name, me.x, meTip - 13);
      ctx.fillStyle = "#8a1f16";
      ctx.fillText(d.top.name, me.x, meTip - 13);
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
    this.tip.innerHTML = `<b>${esc(c.name)}</b><span>${kind} · ${esc(c.region.name)}</span>${c.p ? `<span>Cấp nguy hiểm ${c.p.danger}</span>` : ""}${c.own && c.type !== "son_mon" ? `<span>Chủ: ${esc(c.own.name)}</span>` : ""}${c.alert ? `<span class="bad">${esc(c.alert.title)}</span>` : ""}`;
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
    if (c.alert) rows.push(["Sự kiện", `${esc(c.alert.title)}, còn ${cd(c.alert.endsAt)}`]);
    if (!lit) rows.push(["Sương mù", "Chưa mở, chỉ thấy vị trí"]);
    const inRange = home && d.inRange.includes(p.id);
    const canTake = home && d.can.chiem && HOLDABLE.includes(p.type) && own?.owner !== "minh" && own?.owner !== "dong_minh";
    const canWar = home && d.can.tuyenChien && own?.owner === "dich";
    const art = pointArt(c.region.code, p.type);
    const body = openSheet(
      c.name,
      `${art ? `<div class="loc-hero pix" style="background-image:url('${art}')" role="img" aria-label="${POINT_NAMES[p.type]}"></div>` : ""}
       <dl class="kv">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("")}</dl>
       <div class="actions">
         <button type="button" class="seal" data-a="di">Đi tới</button>
         ${canTake ? `<button type="button" data-a="chiem" ${inRange && d.held < d.maxHeld ? "" : "disabled"}>Chiếm</button>` : ""}
         ${canWar ? `<button type="button" data-a="chien">Tuyên chiến</button>` : ""}
       </div>
       ${canTake && !inRange ? `<p class="muted">Ngoài tầm Truyền Tống Trận, chưa chiếm được.</p>` : ""}
       ${canTake && inRange && d.held >= d.maxHeld ? `<p class="muted">Đã giữ đủ ${d.maxHeld} điểm theo cấp tông môn.</p>` : ""}`,
    );
    body.addEventListener("click", (e) => {
      const a = (e.target as HTMLElement).closest<HTMLElement>("[data-a]")?.dataset.a;
      if (a === "di") toast("Hành trình theo chặng có ở khối M3; prototype chưa đi được.");
      if (a === "chiem") toast("Chiếm điểm bằng trận tranh điểm có ở Sprint 6.");
      if (a === "chien") toast("Tuyên chiến có ở khối M5.");
    });
  }
}

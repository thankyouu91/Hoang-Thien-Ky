// Bản đồ tranh của vùng đang đứng (GDD mục 14), bản tối thiểu để bản đồ mini và các thẻ dashboard nhảy tới đúng chỗ:
// ảnh nền Azgaar, chặng đường, điểm là chấm khi thu nhỏ và đảo nổi PixelLab khi phóng to, sương mù, thẻ điểm khi chạm.
// Kéo, zoom, lớp lọc và hình cả vị diện thuộc việc bản đồ của Sprint 4. Tải và vẽ nhanh: xem layers.ts.
import { Camera } from "../../app/camera.ts";
import type { Scene } from "../../app/scene.ts";
import type { View } from "../../app/view.ts";
import { MiniMap, OWNER_COLOR } from "../../dashboard/minimap.ts";
import type { DashCtx } from "../../dashboard/shell.ts";
import type { BanDoView, Go } from "../../dashboard/source.ts";
import { cd, closeSheet, esc, fmt, openSheet, toast } from "../../dashboard/ui.ts";
import { IslandImages, regionLayers, type RegionLayers } from "./layers.ts";
import { BG_SCALE, HOLDABLE, POINT_NAMES, toImage, type RegionMap, type RegionPoint } from "./region.ts";

/** Hình đảo dùng chung giữa màn bản đồ và prefetch của Động phủ. */
export const islandImages = new IslandImages();

/** Khoá hình đảo của một điểm; sơn môn của tông mình dùng đảo tông môn. */
export function islandKey(p: RegionPoint, sonMon: number, sectIsland: string): string {
  if (p.type === "son_mon" && p.id === sonMon) return sectIsland;
  if (p.type === "cua_bi_canh") return `diem/cua_bi_canh_${p.tier ?? "vua"}`;
  if (["mo_linh_thach", "mo_quang", "mo_duoc", "hang_di_thu"].includes(p.type)) {
    const k = p.id % 3;
    return `diem/${p.type}${k ? `_${k + 1}` : ""}`;
  }
  return `diem/${p.type}`;
}

/** Cạnh đảo nổi trên ảnh nền (px ảnh). */
const ISLAND = 44;
/** Đảo hiện khi cạnh trên màn hình từ chừng này px trở lên; nhỏ hơn thì vẽ chấm. */
const ISLAND_MIN_PX = 22;
const TAP_SLOP = 8;
const TERRAIN: Record<string, string> = {
  son_hiem: "Sơn hiểm", thuy_trach: "Thủy trạch", thuong_lo: "Thương lộ", co_tich: "Cổ tích", linh_mach: "Linh mạch", hoa_mach: "Hỏa mạch",
};
const TIER: Record<string, string> = { thap: "thấp", vua: "vừa", cao: "cao" };

export class MapScene implements Scene {
  readonly id = "ban-do";
  readonly label = "Bản đồ";
  readonly camera = new Camera();
  readonly hud: HTMLElement;
  private ctx: DashCtx;
  private region?: RegionMap;
  private layers?: RegionLayers;
  private data?: BanDoView;
  private loading: HTMLElement;
  /** Đã vẽ khung đầu (mốc đo thời gian tới khi thấy bản đồ). */
  private drawn = false;
  private v?: View;
  private active = false;
  private fitted = false;
  private pending?: Extract<Go, { screen: "ban-do" }>;
  private mini: MiniMap;
  private miniTimer = 0;
  private t = 0;

  constructor(ctx: DashCtx, canvas: HTMLCanvasElement) {
    this.ctx = ctx;
    this.camera.maxZoom = 2.5;
    this.mini = new MiniMap((x, y) => this.focusRegion(x, y));
    this.hud = document.createElement("div");
    this.hud.className = "map-hud";
    this.hud.append(this.mini.el);
    this.loading = document.createElement("div");
    this.loading.className = "map-loading";
    this.loading.hidden = true;
    this.loading.innerHTML = `<span>Đang tải bản đồ</span><div class="bar"><i></i></div>`;
    this.hud.append(this.loading);

    // Chạm (không kéo) vào một điểm thì mở thẻ điểm.
    let down: { x: number; y: number; id: number } | null = null;
    canvas.addEventListener("pointerdown", (e) => {
      if (this.active) down = { x: e.offsetX, y: e.offsetY, id: e.pointerId };
    });
    canvas.addEventListener("pointerup", (e) => {
      if (!this.active || !down || down.id !== e.pointerId) return;
      const moved = Math.hypot(e.offsetX - down.x, e.offsetY - down.y);
      down = null;
      if (moved <= TAP_SLOP) this.tap(e.offsetX, e.offsetY);
    });
  }

  /** Tải trước lớp nền và hình đảo của vùng (gọi lúc rảnh từ dashboard). */
  prefetch(code: string): void {
    void regionLayers(code).then((l) => {
      void l.loadBackground();
      islandImages.preload(new Set(l.region.points.map((p) => islandKey(p, -1, ""))));
    });
  }

  /** Mở bản đồ tại một điểm (kèm thẻ điểm) hoặc một toạ độ của vùng; gọi trước khi chuyển sang scene. */
  focus(g: Extract<Go, { screen: "ban-do" }>): void {
    this.pending = g;
    if (this.active) this.applyPending();
  }

  enter(v: View): void {
    this.v = v;
    this.active = true;
    void this.reload();
    clearInterval(this.miniTimer);
    this.miniTimer = window.setInterval(() => this.syncMini(), 500);
    this.mini.start();
  }

  leave(): void {
    this.active = false;
    clearInterval(this.miniTimer);
    this.mini.stop();
    closeSheet();
  }

  private async reload(): Promise<void> {
    const d = await this.ctx.source.banDo();
    this.ctx.clock.sync(d.serverNow);
    this.ctx.topbar.set(d.top);
    this.data = d;
    if (this.region?.region.code !== d.map.region) {
      const layers = await regionLayers(d.map.region);
      this.camera.bounds = { x: 0, y: 0, w: layers.w, h: layers.h };
      this.region = layers.region;
      this.layers = layers;
      this.fitted = false;
      layers.onChange = () => this.showProgress();
      void layers.loadBackground();
    }
    this.layers!.setRevealed(d.map.revealed);
    this.showProgress();
    if (!this.fitted && this.v) {
      this.camera.fit(this.camera.bounds!, this.v, 8);
      this.camera.minZoom = this.camera.zoom * 0.8;
      this.fitted = true;
    }
    this.applyPending();
    this.syncMini();
  }

  private applyPending(): void {
    const g = this.pending;
    const m = this.region;
    if (!g || !m || !this.data) return;
    this.pending = undefined;
    if (g.pointId !== undefined) {
      const p = toImage(m, m.points[g.pointId].x, m.points[g.pointId].y);
      this.centerOn(p.x, p.y);
      this.openPoint(m.points[g.pointId]);
    } else if (g.at) this.focusRegion(g.at.x, g.at.y);
  }

  private focusRegion(x: number, y: number): void {
    if (!this.region) return;
    const p = toImage(this.region, x, y);
    this.centerOn(p.x, p.y);
  }

  private centerOn(x: number, y: number): void {
    this.camera.zoom = Math.max(this.camera.zoom, 1);
    this.camera.x = x;
    this.camera.y = y;
  }

  /** Thanh tiến độ khi ảnh nền chưa về; bản đồ vẫn dùng được trên tấm tạm. */
  private showProgress(): void {
    const l = this.layers;
    this.loading.hidden = !l || l.ready;
    if (l && !l.ready) this.loading.querySelector("i")!.style.width = `${Math.round(l.progress * 100)}%`;
  }

  private syncMini(): void {
    const m = this.region;
    if (!m || !this.data || !this.v) return;
    const r = this.camera.visible(this.v);
    const [x0, y0] = m.map.frame;
    void this.mini.set(this.data.map, { x: r.x / BG_SCALE + x0, y: r.y / BG_SCALE + y0, w: r.w / BG_SCALE, h: r.h / BG_SCALE });
  }

  update(dt: number): void {
    this.t += dt;
  }

  draw(v: View): void {
    this.v = v;
    const m = this.region;
    const d = this.data;
    const ctx = v.ctx;
    const cam = this.camera;
    if (!m || !d || !cam.bounds) return;
    cam.apply(v);
    const view = cam.visible(v);
    // Nền + đường + sương: chỉ phần đang thấy, từ tấm nướng sẵn khi thu nhỏ (xem layers.ts).
    const b = cam.bounds;
    if (this.layers && !this.drawn) {
      this.drawn = true;
      performance.mark("ban-do:khung-dau");
    }
    this.layers?.draw(ctx, Math.max(0, view.x), Math.max(0, view.y), Math.min(b.w, view.x + view.w), Math.min(b.h, view.y + view.h), cam.zoom * v.dpr, cam.zoom);
    const P = (p: { x: number; y: number }) => toImage(m, p.x, p.y);
    const revealed = new Set(d.map.revealed);

    const islands = ISLAND * cam.zoom >= ISLAND_MIN_PX;
    const blink = Math.floor(this.t * 2) % 2 === 0;
    const pad = ISLAND;
    const inView = (q: { x: number; y: number }) => q.x > view.x - pad && q.x < view.x + view.w + pad && q.y > view.y - pad && q.y < view.y + view.h + pad;
    // Vòng màu chủ điểm và chấm điểm gom theo màu: mỗi màu một lần fill.
    const rings = new Map<string, Path2D>();
    const dotsLit = new Path2D();
    const dotsDim = new Path2D();
    const dotR = 1 / Math.min(1, cam.zoom);
    for (const p of m.points) {
      const q = P(p);
      if (!inView(q)) continue;
      const own = d.owners[p.id];
      if (own) {
        const color = own.attacked && blink ? "#ff5a4f" : OWNER_COLOR[own.owner];
        let path = rings.get(color);
        if (!path) rings.set(color, (path = new Path2D()));
        const rx = islands ? ISLAND * 0.55 : 7 / cam.zoom;
        const ry = islands ? ISLAND * 0.22 : 7 / cam.zoom;
        const cy = q.y + (islands ? ISLAND * 0.3 : 0);
        path.moveTo(q.x + rx, cy);
        path.ellipse(q.x, cy, rx, ry, 0, 0, Math.PI * 2);
      }
    }
    ctx.globalAlpha = 0.85;
    for (const [color, path] of rings) {
      ctx.fillStyle = color;
      ctx.fill(path);
    }
    ctx.globalAlpha = 1;
    for (const p of m.points) {
      const q = P(p);
      if (!inView(q)) continue;
      const lit = revealed.has(p.id);
      const img = islands && lit ? islandImages.get(islandKey(p, d.map.sonMon, d.sectIsland)) : undefined;
      if (img) ctx.drawImage(img, q.x - ISLAND / 2, q.y - ISLAND / 2 - 4, ISLAND, ISLAND);
      else {
        const r = (lit ? 3.2 : 2) * dotR;
        const path = lit ? dotsLit : dotsDim;
        path.moveTo(q.x + r, q.y);
        path.arc(q.x, q.y, r, 0, Math.PI * 2);
      }
    }
    ctx.fillStyle = "#2a1f14";
    ctx.fill(dotsLit);
    ctx.fillStyle = "rgba(42, 31, 20, 0.45)";
    ctx.fill(dotsDim);
    // Vị trí của mình hoặc đoàn đang đi
    const a = P(m.points[d.map.self.from]);
    const z = P(m.points[d.map.self.to]);
    const sx = a.x + (z.x - a.x) * d.map.self.progress;
    const sy = a.y + (z.y - a.y) * d.map.self.progress;
    const s = 9 / Math.min(1, cam.zoom);
    ctx.beginPath();
    ctx.moveTo(sx, sy - s * 1.4);
    ctx.lineTo(sx + s, sy + s * 0.6);
    ctx.lineTo(sx - s, sy + s * 0.6);
    ctx.closePath();
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#14110f";
    ctx.lineWidth = 2 / cam.zoom;
    ctx.fill();
    ctx.stroke();

    // Tên điểm khi phóng to
    if (cam.zoom >= 0.9) {
      ctx.font = `600 ${12 / cam.zoom}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      for (const p of m.points) {
        if (!revealed.has(p.id)) continue;
        const q = P(p);
        if (q.x < view.x || q.x > view.x + view.w || q.y < view.y || q.y > view.y + view.h) continue;
        const own = d.owners[p.id];
        const label = own ? own.name : `${POINT_NAMES[p.type]} · ${p.danger}`;
        ctx.lineWidth = 3 / cam.zoom;
        ctx.strokeStyle = "rgba(20, 17, 15, 0.8)";
        ctx.strokeText(label, q.x, q.y + ISLAND / 2);
        ctx.fillStyle = own ? OWNER_COLOR[own.owner] : "#efe6d6";
        ctx.fillText(label, q.x, q.y + ISLAND / 2);
      }
    }
  }

  private tap(sx: number, sy: number): void {
    const m = this.region;
    const v = this.v;
    if (!m || !v) return;
    const w = this.camera.toWorld(sx, sy, v);
    const reach = Math.max(ISLAND / 2, 18 / this.camera.zoom);
    let best: RegionPoint | undefined;
    let bestD = reach;
    for (const p of m.points) {
      const q = toImage(m, p.x, p.y);
      const dd = Math.hypot(q.x - w.x, q.y - w.y);
      if (dd < bestD) {
        bestD = dd;
        best = p;
      }
    }
    if (best) this.openPoint(best);
    else closeSheet();
  }

  /** Thẻ điểm (GDD mục 14): chủ, sản lượng, cấp nguy hiểm, nút Đi tới, Chiếm, Tuyên chiến theo chức vị. */
  private openPoint(p: RegionPoint): void {
    const d = this.data!;
    const own = d.owners[p.id];
    const lit = d.map.revealed.includes(p.id);
    const rows: [string, string][] = [];
    rows.push(["Chủ", own ? esc(own.name) : p.type === "hang_di_thu" ? "Dị thú" : HOLDABLE.includes(p.type) ? "Chưa ai giữ" : "—"]);
    rows.push(["Cấp nguy hiểm", String(p.danger)]);
    rows.push(["Tới thành chủ", `${p.stages} chặng · ${p.distance} ô`]);
    if (own?.level) rows.push(["Cấp mỏ", `${own.level} · ${fmt(own.perHour ?? 0)}/giờ`]);
    if (p.tier) rows.push(["Bậc cửa", TIER[p.tier]]);
    if (p.terrain) rows.push(["Địa thế", TERRAIN[p.terrain] ?? p.terrain]);
    if (own?.attacked) rows.push(["Đang bị đánh", `${esc(own.attacked.by)}, còn ${cd(own.attacked.endsAt)}`]);
    if (!lit) rows.push(["Sương mù", "Chưa mở, chỉ thấy vị trí"]);
    const inRange = d.inRange.includes(p.id);
    const canTake = d.can.chiem && HOLDABLE.includes(p.type) && own?.owner !== "minh" && own?.owner !== "dong_minh";
    const canWar = d.can.tuyenChien && own?.owner === "dich";
    const body = openSheet(
      `${POINT_NAMES[p.type]} #${p.id}`,
      `<dl class="kv">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("")}</dl>
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

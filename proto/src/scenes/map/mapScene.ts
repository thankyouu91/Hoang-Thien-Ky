// Bản đồ tranh của vùng đang đứng (GDD mục 14), bản tối thiểu để bản đồ mini và các thẻ dashboard nhảy tới đúng chỗ:
// ảnh nền Azgaar, chặng đường, điểm là chấm khi thu nhỏ và đảo nổi PixelLab khi phóng to, sương mù, thẻ điểm khi chạm.
// Kéo, zoom, lớp lọc và hình cả vị diện thuộc việc bản đồ của Sprint 4.
import type { Sprites } from "../../assets/sprites.ts";
import { Camera } from "../../app/camera.ts";
import type { Scene } from "../../app/scene.ts";
import type { View } from "../../app/view.ts";
import { MiniMap, OWNER_COLOR } from "../../dashboard/minimap.ts";
import type { DashCtx } from "../../dashboard/shell.ts";
import type { BanDoView, Go } from "../../dashboard/source.ts";
import { cd, closeSheet, esc, fmt, openSheet, toast } from "../../dashboard/ui.ts";
import { BG_SCALE, HOLDABLE, loadRegion, POINT_NAMES, regionBackground, toImage, type RegionMap, type RegionPoint } from "./region.ts";

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
  private sprites: Sprites;
  private region?: RegionMap;
  private bg?: HTMLImageElement;
  private fog?: HTMLCanvasElement;
  private data?: BanDoView;
  private v?: View;
  private active = false;
  private fitted = false;
  private pending?: Extract<Go, { screen: "ban-do" }>;
  private mini: MiniMap;
  private miniTimer = 0;
  private t = 0;

  constructor(ctx: DashCtx, sprites: Sprites, canvas: HTMLCanvasElement) {
    this.ctx = ctx;
    this.sprites = sprites;
    this.camera.maxZoom = 2.5;
    this.mini = new MiniMap((x, y) => this.focusRegion(x, y));
    this.hud = document.createElement("div");
    this.hud.className = "map-hud";
    this.hud.append(this.mini.el);

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
      this.region = await loadRegion(d.map.region);
      const url = await regionBackground(d.map.region);
      if (url) {
        const img = new Image();
        img.src = url;
        img.decode().then(() => (this.bg = img), () => console.warn("Không nạp được ảnh nền", url));
      }
      const [x0, y0, x1, y1] = this.region.map.frame;
      this.camera.bounds = { x: 0, y: 0, w: (x1 - x0) * BG_SCALE, h: (y1 - y0) * BG_SCALE };
      this.fitted = false;
    }
    this.buildFog();
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

  /** Sương mù vẽ một lần ở độ phân giải thấp rồi phóng lên: khoét quanh các điểm đã mở. */
  private buildFog(): void {
    const m = this.region;
    const d = this.data;
    if (!m || !d) return;
    const b = this.camera.bounds!;
    const k = 4;
    const c = document.createElement("canvas");
    c.width = Math.ceil(b.w / k);
    c.height = Math.ceil(b.h / k);
    const f = c.getContext("2d")!;
    f.fillStyle = "rgba(16, 13, 11, 0.62)";
    f.fillRect(0, 0, c.width, c.height);
    f.globalCompositeOperation = "destination-out";
    const r = 70 / k;
    for (const id of d.map.revealed) {
      const p = toImage(m, m.points[id].x, m.points[id].y);
      const g = f.createRadialGradient(p.x / k, p.y / k, r * 0.35, p.x / k, p.y / k, r);
      g.addColorStop(0, "rgba(0,0,0,1)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      f.fillStyle = g;
      f.fillRect(p.x / k - r, p.y / k - r, r * 2, r * 2);
    }
    this.fog = c;
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
    if (!m || !d) return;
    const cam = this.camera;
    cam.apply(v);
    const b = cam.bounds!;
    if (this.bg) ctx.drawImage(this.bg, 0, 0, b.w, b.h);
    else {
      ctx.fillStyle = "#3b3226";
      ctx.fillRect(0, 0, b.w, b.h);
    }
    const P = (p: { x: number; y: number }) => toImage(m, p.x, p.y);
    const revealed = new Set(d.map.revealed);

    // Chặng đường: quan đạo đậm, tiểu đạo vừa, lối mòn đứt nét.
    for (const kind of ["loi_mon", "tieu_dao", "quan_dao"] as const) {
      ctx.beginPath();
      for (const e of m.edges) {
        if (e.kind !== kind) continue;
        e.path.forEach(([x, y], i) => {
          const q = P({ x, y });
          if (i) ctx.lineTo(q.x, q.y);
          else ctx.moveTo(q.x, q.y);
        });
      }
      ctx.lineWidth = (kind === "quan_dao" ? 3 : kind === "tieu_dao" ? 2 : 1.5) / Math.min(1, cam.zoom);
      ctx.strokeStyle = kind === "loi_mon" ? "rgba(70, 48, 28, 0.35)" : "rgba(70, 48, 28, 0.55)";
      ctx.setLineDash(kind === "loi_mon" ? [6, 6] : []);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    if (this.fog) ctx.drawImage(this.fog, 0, 0, b.w, b.h);

    const islands = ISLAND * cam.zoom >= ISLAND_MIN_PX;
    const view = cam.visible(v);
    const blink = Math.floor(this.t * 2) % 2 === 0;
    for (const p of m.points) {
      const q = P(p);
      if (q.x < view.x - ISLAND || q.x > view.x + view.w + ISLAND || q.y < view.y - ISLAND || q.y > view.y + view.h + ISLAND) continue;
      const own = d.owners[p.id];
      const lit = revealed.has(p.id);
      if (own) {
        ctx.beginPath();
        ctx.ellipse(q.x, q.y + (islands ? ISLAND * 0.3 : 0), islands ? ISLAND * 0.55 : 7 / cam.zoom, islands ? ISLAND * 0.22 : 7 / cam.zoom, 0, 0, Math.PI * 2);
        ctx.fillStyle = own.attacked && blink ? "#ff5a4f" : OWNER_COLOR[own.owner];
        ctx.globalAlpha = 0.85;
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      const img = islands && lit ? this.sprites.get(this.spriteKey(p)) : undefined;
      if (img) {
        ctx.drawImage(img, q.x - ISLAND / 2, q.y - ISLAND / 2 - 4, ISLAND, ISLAND);
      } else {
        ctx.beginPath();
        ctx.arc(q.x, q.y, (lit ? 3.2 : 2) / Math.min(1, cam.zoom), 0, Math.PI * 2);
        ctx.fillStyle = lit ? "#2a1f14" : "rgba(42, 31, 20, 0.45)";
        ctx.fill();
      }
    }
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

  private spriteKey(p: RegionPoint): string {
    const d = this.data!;
    if (p.type === "son_mon" && p.id === d.map.sonMon) return "tong_mon/loi_loi_tri_phong";
    if (p.type === "cua_bi_canh") return `diem/cua_bi_canh_${p.tier ?? "vua"}`;
    if (["mo_linh_thach", "mo_quang", "mo_duoc", "hang_di_thu"].includes(p.type)) {
      const k = p.id % 3;
      return `diem/${p.type}${k ? `_${k + 1}` : ""}`;
    }
    return `diem/${p.type}`;
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

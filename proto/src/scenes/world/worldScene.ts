// Bản đồ mở thời gian thực của một vùng (GDD mục 3, 8, 14; KE_HOACH mục 9 Sprint R1).
// Nhân vật chạy tự do: joystick ảo (HUD trái) hoặc chạm điểm đến để auto chạy (A* trên lưới đi bộ);
// camera bám theo; địa hình chặn đường (núi, sông) theo lưới do tools/mapgen/di_bo.ts sinh.
// Điểm tranh là khu vực tròn — vào khu vực hiện thẻ điểm; sương mù mở theo bán kính đi qua và lưu theo người chơi.
// Bãi dị thú (hang) có quái lang thang; chạm quái báo trận ở Sprint R2.
import { Camera } from "../../app/camera.ts";
import type { Scene } from "../../app/scene.ts";
import type { View } from "../../app/view.ts";
import type { DashCtx } from "../../dashboard/shell.ts";
import type { PointType } from "../../dashboard/source.ts";
import { esc, fmt, openSheet, toast } from "../../dashboard/ui.ts";
import { ELEMENT_STYLE } from "../../theme/elements.ts";
import { WorldLayers } from "../map/layers.ts";
import { HOLDABLE, loadRegion, loadWorld, POINT_NAMES, type RegionMap, type RegionPoint, type WorldMap } from "../map/region.ts";
import { FogMap } from "./fogMap.ts";
import { loadWalkGrid, type WalkGrid } from "./walkGrid.ts";

const TAP_SLOP = 8;
/** Tốc độ chạy chuẩn, đơn vị bản đồ mỗi giây (đề xuất; thú cưỡi nhân sau này). */
const SPEED = 8;
/** Bán kính khu vực theo loại điểm, đơn vị bản đồ (đề xuất, tham số). */
const AREA_R: Record<PointType, number> = {
  thanh_chu: 7,
  son_mon: 4,
  cua_bi_canh: 4.5,
  hang_di_thu: 6,
  linh_tuyen: 3.5,
  mo_linh_thach: 3.5,
  mo_quang: 3.5,
  mo_duoc: 3.5,
  deo: 3,
  ben_do: 3,
};
/** Quái lang thang quanh mỗi hang trong tầm này của người chơi. */
const MOB_NEAR = 40;
const MOB_PER_DEN = 3;
/** Chạm quái gần hơn mức này thì vào trận (R2). */
const MOB_TOUCH = 1.4;
const FONT = '"Be Vietnam Pro", system-ui, sans-serif';
const INK = "#2a1d14";
const HALO = "rgba(243, 231, 201, 0.92)";
const POS_KEY = "ktlp.theGioi.viTri";

interface Mob {
  x: number;
  y: number;
  den: number;
  phase: number;
}

export class WorldScene implements Scene {
  readonly id = "the-gioi";
  readonly label = "Thế giới";
  readonly camera = new Camera();
  readonly hud: HTMLElement;
  private world?: WorldMap;
  private layers?: WorldLayers;
  private region?: RegionMap;
  private grid?: WalkGrid;
  private fog?: FogMap;
  private regionCode = "loi_dinh_coc";
  private player = { x: 0, y: 0, dir: 0 };
  private path: { x: number; y: number }[] = [];
  private joy = { on: false, id: -1, dx: 0, dy: 0 };
  private follow = true;
  private followPause = 0;
  private mobs: Mob[] = [];
  private mobT = 0;
  private mobTouchCd = 0;
  private areaOf = -1;
  private revealAcc = 0;
  private active = false;
  private ready = false;
  private v?: View;
  private t = 0;
  private joyBase: HTMLElement;
  private joyKnob: HTMLElement;

  constructor(_ctx: DashCtx, canvas: HTMLCanvasElement) {
    this.camera.minZoom = 1.2;
    this.camera.maxZoom = 8;

    this.hud = document.createElement("div");
    this.hud.className = "world-hud";
    this.hud.innerHTML = `
      <div class="world-joy"><i></i></div>
      <div class="world-actions">
        <button type="button" data-a="home">Về thành chủ</button>
        <button type="button" data-a="stop">Dừng</button>
      </div>`;
    this.joyBase = this.hud.querySelector(".world-joy")!;
    this.joyKnob = this.hud.querySelector(".world-joy i")!;

    this.joyBase.addEventListener("pointerdown", (e) => {
      this.joy.on = true;
      this.joy.id = e.pointerId;
      this.joyBase.setPointerCapture(e.pointerId);
      this.joyMove(e);
      this.path = [];
      e.stopPropagation();
    });
    this.joyBase.addEventListener("pointermove", (e) => {
      if (this.joy.on && e.pointerId === this.joy.id) this.joyMove(e);
    });
    const joyEnd = (e: PointerEvent) => {
      if (e.pointerId !== this.joy.id) return;
      this.joy.on = false;
      this.joy.dx = 0;
      this.joy.dy = 0;
      this.joyKnob.style.transform = "";
    };
    this.joyBase.addEventListener("pointerup", joyEnd);
    this.joyBase.addEventListener("pointercancel", joyEnd);
    this.hud.addEventListener("click", (e) => {
      const a = (e.target as HTMLElement).closest<HTMLElement>("[data-a]")?.dataset.a;
      if (a === "home") this.goHome();
      if (a === "stop") {
        this.path = [];
        toast("Đứng lại");
      }
    });

    // Chạm (không kéo) trên map để auto chạy tới điểm đó.
    let down: { x: number; y: number; id: number } | null = null;
    canvas.addEventListener("pointerdown", (e) => {
      if (!this.active) return;
      down = { x: e.offsetX, y: e.offsetY, id: e.pointerId };
      this.followPause = 2.5; // người chơi kéo camera thì tạm ngừng bám
    });
    canvas.addEventListener("pointerup", (e) => {
      if (!this.active || !down || down.id !== e.pointerId) return;
      const moved = Math.hypot(e.offsetX - down.x, e.offsetY - down.y);
      down = null;
      if (moved > TAP_SLOP || !this.v) return;
      const w = this.camera.toWorld(e.offsetX, e.offsetY, this.v);
      this.moveTo(w.x, w.y);
      this.follow = true;
    });
    canvas.addEventListener("wheel", () => (this.followPause = 2.5), { passive: true });
  }

  /** Tự chạy tới một điểm (từ thẻ điểm ở màn Bản đồ), gọi trước khi mở scene. */
  focus(g: { pointId?: number; at?: { x: number; y: number } }): void {
    const r = this.region;
    if (!r) return;
    if (g.pointId !== undefined) {
      const p = r.points[g.pointId];
      if (p) this.moveTo(p.x, p.y);
    } else if (g.at) this.moveTo(g.at.x, g.at.y);
  }

  enter(v: View): void {
    this.v = v;
    this.active = true;
    void this.load();
  }

  leave(): void {
    this.active = false;
    this.fog?.flush();
    try {
      localStorage.setItem(POS_KEY, JSON.stringify({ region: this.regionCode, x: this.player.x, y: this.player.y }));
    } catch {
      // Không lưu được thì lần sau về thành chủ.
    }
  }

  private async load(): Promise<void> {
    const [world, region, grid] = await Promise.all([loadWorld(), loadRegion(this.regionCode), loadWalkGrid(this.regionCode)]);
    this.world = world;
    this.region = region;
    this.grid = grid;
    if (!this.layers) {
      this.layers = new WorldLayers(world);
      this.layers.prefetch(this.regionCode);
      this.layers.addRegion(region);
    }
    const [x0, y0, x1, y1] = region.map.bbox;
    this.camera.bounds = { x: x0 - 10, y: y0 - 10, w: x1 - x0 + 20, h: y1 - y0 + 20 };
    if (!this.fog) this.fog = new FogMap(this.regionCode, grid.origin, grid.w, grid.h);
    if (!this.ready) {
      this.ready = true;
      const home = region.points.find((p) => p.type === "thanh_chu")!;
      let spawn = { x: home.x, y: home.y };
      try {
        const saved = JSON.parse(localStorage.getItem(POS_KEY) ?? "null") as { region: string; x: number; y: number } | null;
        if (saved && saved.region === this.regionCode && grid.walkable(saved.x, saved.y)) spawn = saved;
      } catch {
        // Bỏ qua, về thành chủ.
      }
      this.player.x = spawn.x;
      this.player.y = spawn.y;
      this.fog.reveal(spawn.x, spawn.y, 16);
      if (this.v) {
        this.camera.x = spawn.x;
        this.camera.y = spawn.y;
        this.camera.zoom = 4;
      }
    }
  }

  private joyMove(e: PointerEvent): void {
    const r = this.joyBase.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    let dx = e.clientX - cx;
    let dy = e.clientY - cy;
    const len = Math.hypot(dx, dy);
    const max = r.width / 2 - 8;
    if (len > max) {
      dx = (dx / len) * max;
      dy = (dy / len) * max;
    }
    this.joyKnob.style.transform = `translate(${dx}px, ${dy}px)`;
    this.joy.dx = len > 4 ? dx / max : 0;
    this.joy.dy = len > 4 ? dy / max : 0;
  }

  /** Auto chạy tới (x, y) theo đường trên lưới đi bộ. */
  private moveTo(x: number, y: number): void {
    const g = this.grid;
    if (!g) return;
    const p = g.findPath(this.player.x, this.player.y, x, y);
    if (!p) {
      toast("Không đi tới được chỗ này", true);
      return;
    }
    this.path = p;
  }

  private goHome(): void {
    const home = this.region?.points.find((p) => p.type === "thanh_chu");
    if (!home) return;
    this.moveTo(home.x, home.y);
    this.follow = true;
    toast("Đang về thành chủ…");
  }

  /** Bước đi có va chạm lưới: chặn thì trượt theo từng trục. */
  private step(dx: number, dy: number): void {
    const g = this.grid;
    if (!g) return;
    const p = this.player;
    const nx = p.x + dx;
    const ny = p.y + dy;
    if (g.walkable(nx, ny)) {
      p.x = nx;
      p.y = ny;
    } else if (g.walkable(nx, p.y)) p.x = nx;
    else if (g.walkable(p.x, ny)) p.y = ny;
    else this.path = []; // kẹt hẳn thì dừng auto
  }

  update(dt: number): void {
    this.t += dt;
    if (!this.ready) return;
    const p = this.player;
    let moving = false;
    if (this.joy.on && (this.joy.dx || this.joy.dy)) {
      const len = Math.hypot(this.joy.dx, this.joy.dy) || 1;
      this.step((this.joy.dx / len) * SPEED * dt, (this.joy.dy / len) * SPEED * dt);
      p.dir = Math.atan2(this.joy.dy, this.joy.dx);
      moving = true;
    } else if (this.path.length) {
      const next = this.path[0];
      const dx = next.x - p.x;
      const dy = next.y - p.y;
      const d = Math.hypot(dx, dy);
      const stepLen = SPEED * dt;
      if (d <= stepLen) {
        this.step(dx, dy);
        this.path.shift();
      } else {
        this.step((dx / d) * stepLen, (dy / d) * stepLen);
        p.dir = Math.atan2(dy, dx);
      }
      moving = true;
      if (!this.path.length) toast("Đã tới");
    }
    if (moving) {
      this.revealAcc += dt;
      if (this.revealAcc >= 0.25) {
        this.revealAcc = 0;
        this.fog?.reveal(p.x, p.y);
      }
    }
    // Camera bám theo nhân vật, mượt; người chơi kéo map thì tạm ngừng.
    this.followPause = Math.max(0, this.followPause - dt);
    if (this.followPause <= 0) this.follow = true;
    if (this.follow && this.v) {
      const k = 1 - Math.exp(-dt * 6);
      this.camera.x += (p.x - this.camera.x) * k;
      this.camera.y += (p.y - this.camera.y) * k;
    }
    this.updateMobs(dt);
    this.checkArea();
    this.mobTouchCd = Math.max(0, this.mobTouchCd - dt);
  }

  /** Quái lang thang quanh các hang gần người chơi: trôi qua lại quanh hang, mỗi con một pha. */
  private updateMobs(dt: number): void {
    const r = this.region;
    const f = this.fog;
    if (!r || !f) return;
    const p = this.player;
    this.mobT += dt;
    const dens = r.points.filter((pt) => pt.type === "hang_di_thu" && Math.hypot(pt.x - p.x, pt.y - p.y) < MOB_NEAR && f.lit(pt.x, pt.y));
    const want = new Set(dens.map((d) => d.id));
    this.mobs = this.mobs.filter((m) => want.has(m.den));
    for (const d of dens) {
      const have = this.mobs.filter((m) => m.den === d.id).length;
      for (let i = have; i < MOB_PER_DEN; i++) {
        const a = Math.random() * Math.PI * 2;
        this.mobs.push({ x: d.x + Math.cos(a) * 3, y: d.y + Math.sin(a) * 3, den: d.id, phase: Math.random() * 10 });
      }
    }
    for (const m of this.mobs) {
      const d = r.points[m.den];
      m.phase += dt;
      const a = m.phase * 0.35;
      const rr = 2.5 + Math.sin(m.phase * 0.7) * 1.2;
      m.x = d.x + Math.cos(a) * rr;
      m.y = d.y + Math.sin(a) * rr * 0.7;
      if (this.mobTouchCd <= 0 && Math.hypot(m.x - p.x, m.y - p.y) < MOB_TOUCH) {
        this.mobTouchCd = 3;
        toast(`Gặp dị thú ở ${esc(d.name ?? "hang")} (cấp ${d.danger})! Trận thời gian thực có ở Sprint R2.`);
      }
    }
  }

  /** Vào khu vực của một điểm thì mở thẻ điểm; ra khỏi thì thôi. */
  private checkArea(): void {
    const r = this.region;
    if (!r) return;
    const p = this.player;
    let inside = -1;
    for (const pt of r.points) {
      const rr = AREA_R[pt.type] ?? 3;
      if ((pt.x - p.x) ** 2 + (pt.y - p.y) ** 2 <= rr * rr) {
        inside = pt.id;
        break;
      }
    }
    if (inside === this.areaOf) return;
    this.areaOf = inside;
    if (inside >= 0) this.openPoint(r.points[inside]);
  }

  /** Thẻ điểm khi bước vào khu vực (GDD mục 14; các hành động chiến có ở sprint sau). */
  private openPoint(p: RegionPoint): void {
    const w = this.world;
    if (!w) return;
    const type = w.types[p.type];
    const rows: [string, string][] = [
      ["Loại", p.tier ? w.tiers[p.tier].label : type.label],
      ["Vùng", esc(r0(this.region!).name)],
      ["Cấp nguy hiểm", String(p.danger)],
    ];
    if (p.terrain) rows.push(["Địa thế", w.terrains[p.terrain] ?? p.terrain]);
    const holdable = HOLDABLE.includes(p.type);
    const body = openSheet(
      p.name ?? POINT_NAMES[p.type],
      `<dl class="kv">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("")}</dl>
       <div class="actions">
         ${p.type === "hang_di_thu" ? `<button type="button" data-a="farm">Luyện bãi (R2)</button>` : ""}
         ${holdable ? `<button type="button" data-a="chiem">Chiếm (sprint sau)</button>` : ""}
       </div>
       <p class="muted">Bản đồ mở thời gian thực — Sprint R1.</p>`,
    );
    body.addEventListener("click", () => toast("Trận và chiếm điểm real-time có ở Sprint R2–R3."));
  }

  draw(v: View): void {
    this.v = v;
    const ctx = v.ctx;
    const world = this.world;
    const layers = this.layers;
    const r = this.region;
    if (!world || !layers || !r) {
      ctx.fillStyle = "#efe6d6";
      ctx.font = `600 13px ${FONT}`;
      ctx.textAlign = "center";
      ctx.fillText("Đang tải bản đồ mở…", v.w / 2, (v.h - v.bottom) / 2);
      return;
    }
    const cam = this.camera;
    cam.apply(v);
    const view = cam.visible(v);
    layers.drawBackground(ctx, view, cam.zoom * v.dpr);
    if (cam.zoom >= 2) layers.drawRoads(ctx, cam.zoom, [r.region.code]);

    // Khu vực điểm: vòng tròn màu loại điểm; chưa mở sương thì mờ.
    const f = this.fog;
    for (const p of r.points) {
      if (p.x < view.x - 8 || p.y < view.y - 8 || p.x > view.x + view.w + 8 || p.y > view.y + view.h + 8) continue;
      const lit = f ? f.lit(p.x, p.y) : true;
      const rr = AREA_R[p.type] ?? 3;
      ctx.beginPath();
      ctx.arc(p.x, p.y, rr, 0, Math.PI * 2);
      ctx.fillStyle = hexA(world.types[p.type].color, lit ? 0.16 : 0.06);
      ctx.fill();
      ctx.lineWidth = 0.35;
      ctx.strokeStyle = hexA(world.types[p.type].color, lit ? 0.85 : 0.3);
      ctx.stroke();
    }
    // Đường auto đang chạy.
    if (this.path.length) {
      ctx.beginPath();
      ctx.moveTo(this.player.x, this.player.y);
      for (const wp of this.path) ctx.lineTo(wp.x, wp.y);
      ctx.lineWidth = 0.5;
      ctx.setLineDash([1.2, 1.2]);
      ctx.strokeStyle = "rgba(38, 24, 12, 0.85)";
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // Quái lang thang (chấm màu hệ của vùng, có bóng).
    const el = ELEMENT_STYLE[r.region.element as keyof typeof ELEMENT_STYLE];
    for (const m of this.mobs) {
      ctx.beginPath();
      ctx.ellipse(m.x, m.y + 0.7, 0.9, 0.4, 0, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(30, 20, 12, 0.3)";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(m.x, m.y, 0.9, 0, Math.PI * 2);
      ctx.fillStyle = el?.color ?? "#7b241c";
      ctx.fill();
      ctx.lineWidth = 0.25;
      ctx.strokeStyle = INK;
      ctx.stroke();
    }
    // Nhân vật: thân tròn màu giấy viền mực, tia chỉ hướng đi.
    const p = this.player;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 0.9, 1.1, 0.45, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(30, 20, 12, 0.35)";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(p.x, p.y, 1.1, 0, Math.PI * 2);
    ctx.fillStyle = "#fbf6ec";
    ctx.fill();
    ctx.lineWidth = 0.35;
    ctx.strokeStyle = INK;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + Math.cos(p.dir) * 1.9, p.y + Math.sin(p.dir) * 1.9);
    ctx.stroke();
    // Sương mù phủ trên cùng.
    f?.draw(ctx);

    // Tên điểm trong tầm nhìn, theo px màn hình cho dễ đọc.
    ctx.setTransform(v.dpr, 0, 0, v.dpr, 0, 0);
    if (cam.zoom >= 2.4) {
      ctx.font = `600 11px ${FONT}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.lineJoin = "round";
      for (const p2 of r.points) {
        if (p2.x < view.x || p2.y < view.y || p2.x > view.x + view.w || p2.y > view.y + view.h) continue;
        if (f && !f.lit(p2.x, p2.y)) continue;
        const s = cam.toScreen(p2.x, p2.y, v);
        const name = p2.name ?? POINT_NAMES[p2.type];
        ctx.lineWidth = 3;
        ctx.strokeStyle = HALO;
        ctx.strokeText(name, s.x, s.y - (AREA_R[p2.type] ?? 3) * cam.zoom - 4);
        ctx.fillStyle = p2.type === "thanh_chu" ? "#6b1d12" : INK;
        ctx.fillText(name, s.x, s.y - (AREA_R[p2.type] ?? 3) * cam.zoom - 4);
      }
    }
    // Chỉ số gỡ lỗi: tốc độ, vị trí, số quái.
    if (import.meta.env.DEV) {
      ctx.font = `11px ${FONT}`;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillStyle = "rgba(43, 29, 20, 0.75)";
      ctx.fillText(`(${fmt(p.x)}; ${fmt(p.y)}) · quái ${this.mobs.length} · ${this.path.length ? "đang chạy" : "đứng"}`, 8, 22);
    }
  }
}

function r0(r: RegionMap) {
  return r.region;
}

/** Màu hex #rrggbb thành rgba có alpha. */
function hexA(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

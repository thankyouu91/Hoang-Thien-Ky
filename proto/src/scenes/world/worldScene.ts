// Map nhỏ của một khu vực (GDD mục 3, tầng 2; KE_HOACH mục 9): vào từ map lớn khi đã đi tới điểm (journey.ts).
// Di chuyển tự do thời gian thực: joystick ảo hoặc chạm để auto chạy (A* trên lưới đi bộ); camera bám.
// Khu vực hang dị thú có các bãi farm với dải cấp và hồ sơ rơi đồ riêng, hầm ngục (từ cấp 60, quái đông và mạnh,
// khuyến khích party), và người chơi khác đang farm/treo auto (prototype: người giả). Chạm quái báo trận ở Sprint R2.
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
import { currentSpot } from "./journey.ts";
import { loadWalkGrid, type WalkGrid } from "./walkGrid.ts";

const TAP_SLOP = 8;
/** Tốc độ chạy trong khu vực, đơn vị bản đồ mỗi giây (đề xuất; thú cưỡi nhân sau này). */
const SPEED = 8;
/** Nửa cạnh map nhỏ quanh điểm trung tâm, đơn vị bản đồ (đề xuất). */
const SCOPE_R = 34;
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
/** Bãi farm quanh hang: số bãi, bán kính bãi, khoảng cách từ hang. */
const BAI_COUNT = 3;
const BAI_R = 4.5;
/** Hầm ngục: chỉ hang từ cấp nguy hiểm này mới có (GDD mục 3). */
const DUNGEON_MIN_DANGER = 60;
/** Chạm quái gần hơn mức này thì vào trận (R2). */
const MOB_TOUCH = 1.4;
/** Hồ sơ rơi đồ của bãi: mỗi bãi nghiêng một loại (GDD mục 3). */
const DROP_PROFILES = ["Ngọc", "Dược liệu", "Quặng", "Tàn quyển", "Linh thạch"];
const MOCK_NAMES = ["Minh Nguyệt", "Tử Sâm", "Hàn Liên", "Vô Song", "Kiếm Khách 09"];
const FONT = '"Be Vietnam Pro", system-ui, sans-serif';
const INK = "#2a1d14";
const HALO = "rgba(243, 231, 201, 0.92)";
const POS_KEY = "ktlp.theGioi.viTri";

interface Bai {
  x: number;
  y: number;
  lvLo: number;
  lvHi: number;
  profile: string;
}
interface Mob {
  x: number;
  y: number;
  bx: number; // tâm lang thang (bãi hoặc hầm)
  by: number;
  r: number;
  phase: number;
  big: boolean; // quái hầm ngục
}
interface MockPlayer {
  x: number;
  y: number;
  bai: number;
  name: string;
  auto: boolean;
  phase: number;
}

/** PRNG xác định theo hạt (bãi và người giả giữ cố định giữa các lần vào). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
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
  /** Điểm trung tâm của khu vực đang mở. */
  private center?: RegionPoint;
  private bai: Bai[] = [];
  private dungeon?: { x: number; y: number };
  private mockPlayers: MockPlayer[] = [];
  private pendingScope?: number;
  private player = { x: 0, y: 0, dir: 0 };
  private path: { x: number; y: number }[] = [];
  private joy = { on: false, id: -1, dx: 0, dy: 0 };
  private follow = true;
  private followPause = 0;
  private mobs: Mob[] = [];
  private mobT = 0;
  private mobTouchCd = 0;
  private areaKey = "";
  private revealAcc = 0;
  private active = false;
  private ready = false;
  private v?: View;
  private t = 0;
  private joyBase: HTMLElement;
  private joyKnob: HTMLElement;

  constructor(_ctx: DashCtx, canvas: HTMLCanvasElement) {
    this.camera.minZoom = 1.5;
    this.camera.maxZoom = 10;

    this.hud = document.createElement("div");
    this.hud.className = "world-hud";
    this.hud.innerHTML = `
      <div class="world-joy"><i></i></div>
      <div class="world-actions">
        <button type="button" data-a="map">Ra map lớn</button>
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
      if (a === "map") _ctx.nav.go({ screen: "ban-do", at: this.center ? { x: this.center.x, y: this.center.y } : undefined });
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

  /** Mở khu vực của một điểm (từ nút Vào khu vực ở map lớn), gọi trước khi chuyển scene. */
  focus(g: { pointId?: number; at?: { x: number; y: number } }): void {
    this.pendingScope = g.pointId;
    if (this.ready) this.applyScope();
  }

  enter(v: View): void {
    this.v = v;
    this.active = true;
    // Deep-link thử nghiệm khi dev: #the-gioi/<id điểm> mở thẳng khu vực của điểm (bỏ qua hành trình).
    if (import.meta.env.DEV && location.hash.startsWith("#the-gioi/")) {
      const id = Number(location.hash.slice("#the-gioi/".length));
      if (Number.isFinite(id)) this.pendingScope = id;
    }
    void this.load();
  }

  leave(): void {
    this.active = false;
    this.fog?.flush();
    try {
      localStorage.setItem(POS_KEY, JSON.stringify({ region: this.regionCode, x: this.player.x, y: this.player.y }));
    } catch {
      // Không lưu được thì lần sau đứng ở điểm trung tâm.
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
    if (!this.fog) this.fog = new FogMap(this.regionCode, grid.origin, grid.w, grid.h);
    this.applyScope();
    this.ready = true;
  }

  /** Chốt điểm trung tâm của khu vực và dựng bãi farm, hầm ngục, người giả quanh đó. */
  private applyScope(): void {
    const r = this.region;
    const g = this.grid;
    if (!r || !g) return;
    const id = this.pendingScope ?? currentSpot();
    this.pendingScope = undefined;
    const c = r.points[id] ?? r.points.find((p) => p.type === "thanh_chu")!;
    this.center = c;
    this.camera.bounds = { x: c.x - SCOPE_R, y: c.y - SCOPE_R, w: SCOPE_R * 2, h: SCOPE_R * 2 };
    this.areaKey = "";
    this.path = [];

    // Bãi farm quanh hang (GDD mục 3): BAI_COUNT bãi, dải cấp theo bậc 10 quanh cấp nguy hiểm, hồ sơ rơi riêng.
    const rnd = mulberry32(c.id * 1009 + 7);
    this.bai = [];
    this.dungeon = undefined;
    this.mockPlayers = [];
    if (c.type === "hang_di_thu") {
      for (let i = 0; i < BAI_COUNT; i++) {
        const a = i * 2.399 + rnd() * 0.6;
        const d = 9 + rnd() * 6;
        const pos = g.nearestWalkable(c.x + Math.cos(a) * d, c.y + Math.sin(a) * d);
        if (!pos) continue;
        const lo = Math.max(1, c.danger - 10 + i * 10);
        this.bai.push({ x: pos.x, y: pos.y, lvLo: lo, lvHi: lo + 10, profile: DROP_PROFILES[(c.id + i) % DROP_PROFILES.length] });
      }
      if (c.danger >= DUNGEON_MIN_DANGER) {
        const a = rnd() * Math.PI * 2;
        const pos = g.nearestWalkable(c.x + Math.cos(a) * 20, c.y + Math.sin(a) * 20);
        if (pos) this.dungeon = pos;
      }
      // Người chơi khác đang farm/treo auto (prototype: giả, đứng ở bãi; bản thật là người thật trong AOI, mục 16).
      for (let i = 0; i < MOCK_NAMES.length && this.bai.length; i++) {
        const b = this.bai[i % this.bai.length];
        const pos = g.nearestWalkable(b.x + rnd() * 4 - 2, b.y + rnd() * 4 - 2);
        if (!pos) continue;
        this.mockPlayers.push({ x: pos.x, y: pos.y, bai: i % this.bai.length, name: MOCK_NAMES[i], auto: i % 3 !== 0, phase: rnd() * 10 });
      }
    }

    // Quái: mỗi bãi 2 con lang thang; hầm ngục 6 con lớn hơn.
    this.mobs = [];
    for (const b of this.bai)
      for (let i = 0; i < 2; i++) this.mobs.push({ x: b.x, y: b.y, bx: b.x, by: b.y, r: BAI_R - 1, phase: Math.random() * 10, big: false });
    if (this.dungeon)
      for (let i = 0; i < 6; i++) this.mobs.push({ x: this.dungeon.x, y: this.dungeon.y, bx: this.dungeon.x, by: this.dungeon.y, r: 4, phase: Math.random() * 10, big: true });

    // Vị trí người chơi: khôi phục nếu còn trong khu vực, không thì đứng ở điểm trung tâm.
    let spawn = { x: c.x, y: c.y };
    try {
      const saved = JSON.parse(localStorage.getItem(POS_KEY) ?? "null") as { region: string; x: number; y: number } | null;
      if (saved && saved.region === this.regionCode && g.walkable(saved.x, saved.y) && Math.hypot(saved.x - c.x, saved.y - c.y) < SCOPE_R) spawn = saved;
    } catch {
      // Bỏ qua.
    }
    this.player.x = spawn.x;
    this.player.y = spawn.y;
    this.fog?.reveal(spawn.x, spawn.y, 16);
    if (this.v) {
      this.camera.x = spawn.x;
      this.camera.y = spawn.y;
      this.camera.zoom = 6;
      this.follow = true;
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

  /** Quái lang thang quanh tâm bãi/hầm; người giả khẽ động tại bãi. */
  private updateMobs(dt: number): void {
    this.mobT += dt;
    const p = this.player;
    for (const m of this.mobs) {
      m.phase += dt;
      const a = m.phase * 0.35;
      const rr = m.r * (0.6 + Math.sin(m.phase * 0.7) * 0.25);
      m.x = m.bx + Math.cos(a) * rr;
      m.y = m.by + Math.sin(a) * rr * 0.7;
      if (this.mobTouchCd <= 0 && Math.hypot(m.x - p.x, m.y - p.y) < MOB_TOUCH) {
        this.mobTouchCd = 3;
        toast(m.big ? "Quái hầm ngục mạnh và đông — nên đi cùng party! (Sprint R2)" : "Gặp dị thú! Trận thời gian thực có ở Sprint R2.");
      }
    }
    for (const mp of this.mockPlayers) {
      if (!mp.auto) {
        // Người chơi thật điều khiển tay: đi vòng quanh bãi.
        mp.phase += dt * 0.5;
        const b = this.bai[mp.bai];
        mp.x = b.x + Math.cos(mp.phase) * 3;
        mp.y = b.y + Math.sin(mp.phase) * 2;
      }
    }
  }

  /** Vào khu vực của bãi/hầm/điểm trung tâm thì mở thẻ tương ứng; ra khỏi thì thôi. */
  private checkArea(): void {
    const r = this.region;
    const c = this.center;
    if (!r || !c) return;
    const p = this.player;
    let key = "";
    if (this.dungeon && Math.hypot(this.dungeon.x - p.x, this.dungeon.y - p.y) <= 5) key = "ham-nguc";
    else {
      for (let i = 0; i < this.bai.length; i++)
        if (Math.hypot(this.bai[i].x - p.x, this.bai[i].y - p.y) <= BAI_R) {
          key = `bai-${i}`;
          break;
        }
      if (!key) {
        const rr = AREA_R[c.type] ?? 3;
        if (Math.hypot(c.x - p.x, c.y - p.y) <= rr) key = "diem";
      }
    }
    if (key === this.areaKey) return;
    this.areaKey = key;
    if (key === "ham-nguc") this.openDungeon();
    else if (key.startsWith("bai-")) this.openBai(this.bai[Number(key.slice(4))]);
    else if (key === "diem") this.openPoint(c);
  }

  private openBai(b: Bai): void {
    const c = this.center!;
    const body = openSheet(
      `Bãi ${c.name ?? "dã ngoại"}`,
      `<dl class="kv">
        <dt>Cấp quái</dt><dd>${b.lvLo}–${b.lvHi}</dd>
        <dt>Nghiêng rơi</dt><dd>${esc(b.profile)}</dd>
        <dt>Người đang farm</dt><dd>${this.mockPlayers.length} người trong khu vực</dd>
      </dl>
      <div class="actions"><button type="button" data-a="farm">Luyện bãi (R2)</button></div>
      <p class="muted">Mỗi bãi một hồ sơ rơi đồ và dải cấp — GDD mục 3.</p>`,
    );
    body.addEventListener("click", () => toast("Luyện bãi real-time có ở Sprint R2."));
  }

  private openDungeon(): void {
    const c = this.center!;
    const body = openSheet(
      `Hầm ngục · ${c.name ?? ""}`,
      `<dl class="kv">
        <dt>Tầng</dt><dd>1/3 (mở dần)</dd>
        <dt>Quái</dt><dd>Đông gấp đôi, chỉ số +30%</dd>
        <dt>Rơi</dt><dd>Ấn bộ tím trở lên, ngọc cấp cao, tàn quyết; thần vật ×2</dd>
      </dl>
      <div class="actions"><button type="button" data-a="vao">Vào hầm (R2)</button></div>
      <p class="muted">Một mình rất khó: mất buff party theo tài năng. Nên đi cùng team — GDD mục 3.</p>`,
    );
    body.addEventListener("click", () => toast("Hầm ngục là instance riêng, có ở Sprint R2–R4."));
  }

  /** Thẻ điểm trung tâm của khu vực. */
  private openPoint(p: RegionPoint): void {
    const w = this.world;
    if (!w) return;
    const type = w.types[p.type];
    const rows: [string, string][] = [
      ["Loại", p.tier ? w.tiers[p.tier].label : type.label],
      ["Vùng", esc(this.region!.region.name)],
      ["Cấp nguy hiểm", String(p.danger)],
    ];
    if (p.terrain) rows.push(["Địa thế", w.terrains[p.terrain] ?? p.terrain]);
    const holdable = HOLDABLE.includes(p.type);
    const body = openSheet(
      p.name ?? POINT_NAMES[p.type],
      `<dl class="kv">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("")}</dl>
       <div class="actions">
         ${holdable ? `<button type="button" data-a="chiem">Chiếm (sprint sau)</button>` : ""}
       </div>
       <p class="muted">Map nhỏ của khu vực — GDD mục 3 tầng 2.</p>`,
    );
    body.addEventListener("click", () => toast("Chiếm điểm real-time có ở sprint sau."));
  }

  draw(v: View): void {
    this.v = v;
    const ctx = v.ctx;
    const world = this.world;
    const layers = this.layers;
    const r = this.region;
    if (!world || !layers || !r || !this.center) {
      ctx.fillStyle = "#efe6d6";
      ctx.font = `600 13px ${FONT}`;
      ctx.textAlign = "center";
      ctx.fillText("Đang tải khu vực…", v.w / 2, (v.h - v.bottom) / 2);
      return;
    }
    const cam = this.camera;
    cam.apply(v);
    const view = cam.visible(v);
    layers.drawBackground(ctx, view, cam.zoom * v.dpr);
    if (cam.zoom >= 2) layers.drawRoads(ctx, cam.zoom, [r.region.code]);

    const f = this.fog;
    // Khu vực điểm của vùng trong phạm vi map nhỏ: vòng tròn màu loại điểm.
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
    // Bãi farm: vòng nét đứt màu hệ, tâm đậm.
    const el = ELEMENT_STYLE[r.region.element as keyof typeof ELEMENT_STYLE];
    for (const b of this.bai) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, BAI_R, 0, Math.PI * 2);
      ctx.fillStyle = hexA(el?.color ?? "#7b241c", 0.1);
      ctx.fill();
      ctx.lineWidth = 0.4;
      ctx.setLineDash([1, 1]);
      ctx.strokeStyle = hexA(el?.color ?? "#7b241c", 0.9);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // Hầm ngục: vòng tối.
    if (this.dungeon) {
      ctx.beginPath();
      ctx.arc(this.dungeon.x, this.dungeon.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(24, 16, 30, 0.35)";
      ctx.fill();
      ctx.lineWidth = 0.5;
      ctx.strokeStyle = "#4a3370";
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
    // Quái lang thang.
    for (const m of this.mobs) {
      const s = m.big ? 1.3 : 0.9;
      ctx.beginPath();
      ctx.ellipse(m.x, m.y + 0.7 * s, 0.9 * s, 0.4 * s, 0, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(30, 20, 12, 0.3)";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(m.x, m.y, 0.9 * s, 0, Math.PI * 2);
      ctx.fillStyle = m.big ? "#4a3370" : (el?.color ?? "#7b241c");
      ctx.fill();
      ctx.lineWidth = 0.25;
      ctx.strokeStyle = INK;
      ctx.stroke();
    }
    // Người chơi khác (giả): chấm xám xanh, cờ auto.
    for (const mp of this.mockPlayers) {
      ctx.beginPath();
      ctx.ellipse(mp.x, mp.y + 0.9, 1, 0.4, 0, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(30, 20, 12, 0.3)";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(mp.x, mp.y, 1, 0, Math.PI * 2);
      ctx.fillStyle = "#5d8aa8";
      ctx.fill();
      ctx.lineWidth = 0.25;
      ctx.strokeStyle = INK;
      ctx.stroke();
    }
    // Nhân vật của mình.
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

    // Chữ theo px màn hình: tên bãi (cấp + hồ sơ rơi), hầm ngục, người chơi, tên điểm.
    ctx.setTransform(v.dpr, 0, 0, v.dpr, 0, 0);
    ctx.textAlign = "center";
    ctx.lineJoin = "round";
    for (const b of this.bai) {
      const s = cam.toScreen(b.x, b.y, v);
      const label = `Bãi ${b.lvLo}–${b.lvHi} · ${b.profile}`;
      ctx.font = `600 11px ${FONT}`;
      ctx.textBaseline = "bottom";
      ctx.lineWidth = 3;
      ctx.strokeStyle = HALO;
      ctx.strokeText(label, s.x, s.y - BAI_R * cam.zoom - 3);
      ctx.fillStyle = INK;
      ctx.fillText(label, s.x, s.y - BAI_R * cam.zoom - 3);
    }
    if (this.dungeon) {
      const s = cam.toScreen(this.dungeon.x, this.dungeon.y, v);
      ctx.font = `700 11px ${FONT}`;
      ctx.textBaseline = "bottom";
      ctx.lineWidth = 3;
      ctx.strokeStyle = HALO;
      ctx.strokeText("Hầm ngục", s.x, s.y - 5 * cam.zoom - 3);
      ctx.fillStyle = "#4a3370";
      ctx.fillText("Hầm ngục", s.x, s.y - 5 * cam.zoom - 3);
    }
    ctx.font = `600 10px ${FONT}`;
    ctx.textBaseline = "top";
    for (const mp of this.mockPlayers) {
      const s = cam.toScreen(mp.x, mp.y, v);
      const label = mp.auto ? `${mp.name} · auto` : mp.name;
      ctx.lineWidth = 3;
      ctx.strokeStyle = HALO;
      ctx.strokeText(label, s.x, s.y + 1.4 * cam.zoom);
      ctx.fillStyle = "#33526b";
      ctx.fillText(label, s.x, s.y + 1.4 * cam.zoom);
    }
    const c = this.center;
    const s0 = cam.toScreen(c.x, c.y, v);
    ctx.font = `700 12px ${FONT}`;
    ctx.textBaseline = "bottom";
    ctx.lineWidth = 3;
    ctx.strokeStyle = HALO;
    const cname = c.name ?? POINT_NAMES[c.type];
    ctx.strokeText(cname, s0.x, s0.y - (AREA_R[c.type] ?? 3) * cam.zoom - 4);
    ctx.fillStyle = c.type === "thanh_chu" ? "#6b1d12" : INK;
    ctx.fillText(cname, s0.x, s0.y - (AREA_R[c.type] ?? 3) * cam.zoom - 4);
    // Chỉ số gỡ lỗi.
    if (import.meta.env.DEV) {
      ctx.font = `11px ${FONT}`;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillStyle = "rgba(43, 29, 20, 0.75)";
      ctx.fillText(`(${fmt(p.x)}; ${fmt(p.y)}) · quái ${this.mobs.length} · ${this.path.length ? "đang chạy" : "đứng"}`, 8, 22);
    }
  }
}

/** Màu hex #rrggbb thành rgba có alpha. */
function hexA(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

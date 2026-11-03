import type { Sprites } from "../../assets/sprites.ts";
import { renderArena, type ArenaKind, type ArenaLayers } from "../../three/index.ts";
import { Camera, type Rect } from "../../app/camera.ts";
import type { Scene } from "../../app/scene.ts";
import type { View } from "../../app/view.ts";
import { ReplayPlayer } from "../../replay/player.ts";
import { between, ReplayIndex, type UnitTimeline } from "../../replay/timeline.ts";
import type { Look, ReplaySource } from "../../replay/types.ts";
import { ELEMENT_STYLE } from "../../theme/elements.ts";
import { animInfo, assignLooks, drawCharacter, resolveLook, type Anim } from "./character.ts";
import { ReplayControls } from "./controls.ts";
import { FxLayer, type Point } from "./fx.ts";
import { drawMotif } from "./motifs.ts";
import { VfxLib } from "./vfx.ts";

const CELL = 64; // đơn vị thế giới mỗi ô sân
const LANE = 60; // khoảng cách ngang giữa hai người cùng hàng
const SIZE = 40; // cạnh khối nhân vật
const TEAM_RING = ["#e6d8b8", "#b3261e"]; // đội A giấy dó, đội B ấn son
const HP = "#7bc96f";
const MANA = "#5aa9e6";
const NUMBER_LIFE = 0.9; // giây thực một con số sát thương bay lên
const HEAVY_HIT = 0.05; // đòn từ 5% máu tối đa trở lên mới diễn hoạt ảnh trúng đòn
const BADGE = 12; // cạnh dấu hệ đặt trước thanh máu, đơn vị thế giới
const DEFAULT_ARENA = "vo_truong"; // nền sân khi replay không nói trận đánh ở đâu
const ARENA_MAX = 1600; // cạnh dài tối đa của nền sân Three.js khi nướng, px CSS (màn rộng không nướng ảnh quá lớn)

/** Số tick từ mốc gần nhất không sau t trong `marks` (xếp tăng dần) tới t; undefined nếu chưa có mốc nào. */
function since(marks: number[] | undefined, t: number): number | undefined {
  if (!marks || marks.length === 0 || marks[0] > t) return undefined;
  let lo = 0;
  let hi = marks.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (marks[mid] <= t) lo = mid;
    else hi = mid - 1;
  }
  return t - marks[lo];
}

/** Màn xem trận: phát replay, vẽ nhân vật bằng hình PixelLab ghép (thiếu hình thì khối màu theo hệ). */
export class BattleScene implements Scene {
  readonly id = "tran";
  readonly label = "Trận";
  readonly camera = new Camera();
  readonly hud: HTMLElement;
  private controls: ReplayControls;
  private sources: ReplaySource[];
  private source: ReplaySource;
  private sprites: Sprites;
  private vfx: VfxLib;
  private fx = new FxLayer();
  private index: ReplayIndex | null = null;
  private player: ReplayPlayer | null = null;
  private error = "";
  /** Số lần đã nạp; kết quả của lần nạp cũ về muộn thì bỏ. */
  private loads = 0;
  /** Toạ độ ngang của từng người, theo id */
  private lateral = new Map<number, number>();
  /** Mốc ra chiêu và trúng đòn nặng theo id, xếp tăng dần */
  private marks = new Map<number, { casts: number[]; hits: number[] }>();
  /** Ngoại hình ghép theo id (tạm theo đội và hàng khi replay chưa có) */
  private looks = new Map<number, Look>();
  /** Trục sân dọc khi màn hình đứng, ngang khi màn hình nằm */
  private vertical: boolean | null = null;
  /** Vùng nhìn và camera lúc căn sân lần cuối */
  private fitted: { w: number; h: number; x: number; y: number; zoom: number } | null = null;
  /** Nền sân Three.js đã nướng gần nhất (back dưới người, front trên hiệu ứng), kèm loại sân và chiều trục lúc nướng */
  private arena: { kind: string; vertical: boolean; layers: ArenaLayers } | null = null;
  /** Bộ tham số nền sân đang cần; mỗi lúc chỉ nướng một bộ, đổi cỡ liên tục thì nướng bộ mới nhất khi bộ trước xong */
  private arenaWant: { key: string; kind: string; vertical: boolean; w: number; h: number } | null = null;
  private arenaBusy = false;

  /** sources[0] mở mặc định; người xem đổi nguồn ở ô chọn trên thanh điều khiển. */
  constructor(sources: ReplaySource[], sprites: Sprites) {
    this.sources = [...sources];
    this.source = this.sources[0];
    this.sprites = sprites;
    this.vfx = new VfxLib(sprites);
    this.controls = new ReplayControls(this.sources.map((s) => s.label), (i) => this.load(this.sources[i]));
    this.hud = this.controls.el;
  }

  /**
   * Mở một trận cụ thể, ví dụ khi bấm vào chiến báo (GDD mục 14); nguồn chưa có trong ô chọn thì thêm lên đầu.
   * Gọi trước hay sau khi scene được mở đều được; chuyển sang màn Trận là việc của nơi gọi.
   */
  open(source: ReplaySource): void {
    if (!this.sources.includes(source)) this.sources.unshift(source);
    this.controls.setSources(this.sources.map((s) => s.label), this.sources.indexOf(source));
    this.load(source);
  }

  enter(v: View): void {
    if (this.loads === 0) this.load(this.source);
    this.fitIfRotated(v);
  }

  private load(source: ReplaySource): void {
    const n = ++this.loads;
    const speed = this.player?.speed ?? 1;
    this.source = source;
    this.index = null;
    this.player = null;
    this.error = "";
    this.controls.loading();
    source.load().then(
      (replay) => {
        if (n !== this.loads) return;
        this.index = new ReplayIndex(replay);
        // Chừa 1 giây sau đòn cuối để số sát thương bay hết.
        this.player = new ReplayPlayer(replay.tps, replay.ticks + replay.tps);
        this.player.speed = speed;
        this.controls.bind(this.player);
        this.layoutLanes();
        this.buildMarks();
        this.looks = assignLooks(replay.units);
        this.vertical = null;
      },
      (e: unknown) => {
        if (n === this.loads) this.error = String(e);
      },
    );
  }

  update(dt: number): void {
    this.player?.update(dt);
    this.controls.sync();
  }

  draw(v: View): void {
    const ctx = v.ctx;
    const index = this.index;
    const player = this.player;
    if (!index || !player) {
      ctx.fillStyle = "#a89c88";
      ctx.font = "15px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(this.error || `Đang tải ${this.source.label}…`, v.w / 2, (v.h - v.bottom) / 2);
      return;
    }
    this.fitIfRotated(v);
    const t = player.t;
    const tps = index.replay.tps;

    const life = (s: number) => Math.min(2 * tps, s * tps * player.speed);
    const cam = this.camera;
    this.fx.prepare({
      ctx, index, t, life, size: SIZE, zoom: cam.zoom, dpr: v.dpr,
      at: (id, time = t) => {
        const ut = index.byId.get(id);
        return ut ? this.place(ut.pos.moving(time), this.lat(id)) : null;
      },
      zone: (center, radius) => {
        const p = this.place(center, 0);
        const along = (radius / 1000) * CELL;
        const half = 3.5 * LANE;
        return this.vertical ? { ...p, rx: half, ry: along } : { ...p, rx: along, ry: half };
      },
      toScreen: (p) => cam.toScreen(p.x, p.y, v),
      image: (key) => this.sprites.get(key),
      vfx: this.vfx,
    });

    cam.apply(v);
    // Rung màn hình khi có đòn lớn: dời cả sân theo px màn hình.
    const shake = this.fx.shake();
    if (shake.x || shake.y) ctx.translate(shake.x / cam.zoom, shake.y / cam.zoom);
    this.drawField(ctx, index.replay.fieldLength);
    this.fx.ground();

    // Ai vừa trúng đòn trong 3 tick gần nhất thì nháy trắng.
    const flashed = new Set(between(index.hits, t - 3, t).filter((h) => h.kind === "hit").map((h) => h.unit));
    const lunges = this.fx.lunges();
    for (const ut of index.units) this.drawUnit(ctx, ut, t, flashed.has(ut.unit.id), lunges.get(ut.unit.id));

    this.fx.air();
    // Lớp trước của sân Three.js (sương, cành, nhũ đá, viền tối mép khung) phủ lên người và hiệu ứng, dưới số sát thương.
    const arena = this.arenaLayers();
    if (arena) {
      const r = this.fieldRect();
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(arena.front, r.x, r.y, r.w, r.h);
    }
    this.drawNumbers(ctx, index, t, life(NUMBER_LIFE));
    this.fx.callouts();
    this.drawScore(v, index, t, player);
  }

  // ---- hoạt ảnh ----

  /** Mốc ra chiêu (lúc bắt đầu vận công nếu có) và mốc trúng đòn nặng của từng người, để chọn hoạt ảnh. */
  private buildMarks(): void {
    const index = this.index!;
    this.marks.clear();
    const of = (id: number) => {
      let m = this.marks.get(id);
      if (!m) this.marks.set(id, (m = { casts: [], hits: [] }));
      return m;
    };
    for (const c of index.casts) of(c.unit).casts.push(c.start ?? c.tick);
    for (const e of index.hits) {
      const ut = index.byId.get(e.unit);
      // Đòn nhỏ chỉ nháy trắng; từ 5% máu trở lên mới diễn trúng đòn, để người không giật liên tục.
      if (e.kind === "hit" && ut && e.amount >= ut.unit.hpMax * HEAVY_HIT) of(e.unit).hits.push(e.tick);
    }
    for (const m of this.marks.values()) m.casts.sort((a, b) => a - b);
  }

  /** Hoạt ảnh và khung của một người tại t, ưu tiên: ngã, ra chiêu, trúng đòn nặng, đứng. null nếu chưa có hình. */
  private pose(ut: UnitTimeline, t: number, look: Look): { anim: Anim; frame: number } | null {
    const idle = animInfo(this.sprites, look, "dung");
    if (!idle) return null;
    const tps = this.index!.replay.tps;
    const play = (anim: Anim, since: number | undefined) => {
      const info = since === undefined ? undefined : animInfo(this.sprites, look, anim);
      if (!info || since === undefined) return null;
      return { anim, frame: Math.floor((since / tps) * info.fps), frames: info.frames };
    };
    if (t >= ut.death) {
      const p = play("nga", t - ut.death);
      if (p) return { anim: "nga", frame: Math.min(p.frame, p.frames - 1) };
    } else {
      const m = this.marks.get(ut.unit.id);
      const cast = play("ra_chieu", since(m?.casts, t));
      if (cast && cast.frame < cast.frames) return cast;
      const hit = play("trung_don", since(m?.hits, t));
      if (hit && hit.frame < hit.frames) return hit;
    }
    // Đứng thở lệch nhịp theo id để cả đội không nhấp nhô cùng lúc.
    return { anim: "dung", frame: (Math.floor((t / tps) * idle.fps) + ut.unit.id) % idle.frames };
  }

  // ---- bố cục ----

  /** Mỗi hàng của mỗi đội dàn ngang quanh trục; hàng sau lệch nửa làn để không che hàng trước. */
  private layoutLanes(): void {
    const index = this.index!;
    this.lateral.clear();
    for (const team of [0, 1]) {
      for (const row of [0, 1]) {
        const us = index.units.filter((u) => u.unit.team === team && u.unit.row === row).sort((a, b) => a.unit.id - b.unit.id);
        us.forEach((u, i) => this.lateral.set(u.unit.id, (i - (us.length - 1) / 2) * LANE + (row === 1 ? LANE / 2 : 0)));
      }
    }
  }

  /**
   * Toạ độ ngang của một người. Hình tu sĩ nhìn hướng đông nam và đội B lật ngang, nên khi sân dọc
   * đội A dời sang trái, đội B dời sang phải nửa làn để hai đội nhìn chéo vào nhau thay vì cùng nhìn xuống.
   */
  private lat(id: number): number {
    const base = this.lateral.get(id) ?? 0;
    if (!this.vertical) return base;
    return base + (this.index?.byId.get(id)?.unit.team === 1 ? LANE / 2 : -LANE / 2);
  }

  /** Vị trí trên trục (milli-ô) và toạ độ ngang ra toạ độ thế giới; đội A luôn ở dưới hoặc bên trái. */
  private place(pos: number, lateral: number): { x: number; y: number } {
    const along = (pos / 1000) * CELL;
    if (this.vertical) return { x: lateral, y: (this.index!.replay.fieldLength / 1000) * CELL - along };
    return { x: along, y: lateral };
  }

  private fieldRect(): Rect {
    const len = (this.index!.replay.fieldLength / 1000) * CELL;
    const half = 3.5 * LANE;
    return this.vertical ? { x: -half, y: 0, w: 2 * half, h: len } : { x: 0, y: -half, w: len, h: 2 * half };
  }

  /**
   * Căn sân vừa màn hình khi xoay màn hình, hoặc khi vùng nhìn đổi cỡ mà người xem chưa kéo hay zoom
   * (pane hiện ra, thanh bên của khung mới bật tắt). Bỏ qua lúc canvas chưa có kích thước.
   */
  private fitIfRotated(v: View): void {
    const h = v.h - v.bottom;
    if (!this.index || v.w <= 0 || h <= 0) return;
    const vertical = h >= v.w;
    const cam = this.camera;
    const f = this.fitted;
    const untouched = !!f && cam.zoom === f.zoom && cam.x === f.x && cam.y === f.y;
    const resized = !!f && (f.w !== v.w || f.h !== h);
    if (vertical === this.vertical && !(resized && untouched)) return;
    this.vertical = vertical;
    const r = this.fieldRect();
    cam.fit(r, v, 8);
    cam.bounds = r;
    this.fitted = { w: v.w, h, x: cam.x, y: cam.y, zoom: cam.zoom };
  }

  /**
   * Hai lớp nền sân Three.js khớp loại sân và chiều trục hiện tại, null khi chưa nướng xong hoặc máy không có WebGL2
   * (khi đó vẽ nền PixelLab). Nướng ở cỡ sân trên màn lúc căn (fieldRect × zoom), nướng lại khi đổi trận, xoay màn
   * hay đổi cỡ vùng nhìn; trong lúc chờ, bộ cũ cùng chiều trục vẫn dùng được vì fieldRect giữ nguyên tỉ lệ.
   */
  private arenaLayers(): ArenaLayers | null {
    if (!this.index || this.vertical === null) return null;
    const kind = this.index.replay.arena ?? DEFAULT_ARENA;
    const r = this.fieldRect();
    const zoom = Math.min(this.fitted?.zoom ?? 1, ARENA_MAX / Math.max(r.w, r.h));
    const w = Math.round(r.w * zoom);
    const h = Math.round(r.h * zoom);
    const key = [kind, this.vertical, w, h].join("|");
    if (this.arenaWant?.key !== key) {
      this.arenaWant = { key, kind, vertical: this.vertical, w, h };
      if (!this.arenaBusy) this.bakeArena();
    }
    const a = this.arena;
    return a && a.kind === kind && a.vertical === this.vertical ? a.layers : null;
  }

  private bakeArena(): void {
    const want = this.arenaWant;
    if (!want) return;
    this.arenaBusy = true;
    // Loại sân ngoài ArenaKind thì lớp Three.js trả null, màn giữ nền PixelLab.
    void renderArena(want.kind as ArenaKind, want.w, want.h, { vertical: want.vertical }).then((layers) => {
      this.arenaBusy = false;
      if (layers) this.arena = { kind: want.kind, vertical: want.vertical, layers };
      if (this.arenaWant !== want) this.bakeArena();
    });
  }

  // ---- vẽ ----

  private drawField(ctx: CanvasRenderingContext2D, fieldLength: number): void {
    const r = this.fieldRect();
    const cells = fieldLength / 1000;
    // Nền sân Three.js nếu đã nướng (đúng chiều sẵn, không cần phủ tối); không thì nền PixelLab (san_dau/<tên>,
    // vẽ ngang theo chiều trục sân, màn đứng xoay 90 độ); chưa có hình nào thì nền tối.
    const layers = this.arenaLayers();
    const bg = layers ? undefined : this.sprites.get("san_dau/" + (this.index?.replay.arena ?? DEFAULT_ARENA));
    if (layers) {
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(layers.back, r.x, r.y, r.w, r.h);
    } else if (bg) {
      ctx.imageSmoothingEnabled = false;
      if (this.vertical) {
        ctx.save();
        ctx.translate(r.x + r.w / 2, r.y + r.h / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.drawImage(bg, -r.h / 2, -r.w / 2, r.h, r.w);
        ctx.restore();
      } else {
        ctx.drawImage(bg, r.x, r.y, r.w, r.h);
      }
      // Phủ tối nhẹ để người và hiệu ứng nổi trên nền.
      ctx.fillStyle = "rgba(20, 17, 15, 0.25)";
      ctx.fillRect(r.x, r.y, r.w, r.h);
    } else {
      ctx.fillStyle = "#1f1a15";
      ctx.fillRect(r.x, r.y, r.w, r.h);
    }
    // Nền đã có ô hay vân để ước khoảng cách: chỉ kẻ ô khi chưa có nền, vạch giữa sân thì luôn giữ (mờ hơn khi có nền).
    const plain = !layers && !bg;
    ctx.globalAlpha = plain ? 1 : 0.5;
    ctx.beginPath();
    for (let i = 0; i <= (plain ? cells : -1); i++) {
      const a = this.place(i * 1000, 0);
      if (this.vertical) {
        ctx.moveTo(r.x, a.y);
        ctx.lineTo(r.x + r.w, a.y);
      } else {
        ctx.moveTo(a.x, r.y);
        ctx.lineTo(a.x, r.y + r.h);
      }
    }
    ctx.strokeStyle = "#2f2820";
    ctx.lineWidth = 1 / this.camera.zoom;
    ctx.stroke();

    const mid = this.place(fieldLength / 2, 0);
    ctx.beginPath();
    if (this.vertical) {
      ctx.moveTo(r.x, mid.y);
      ctx.lineTo(r.x + r.w, mid.y);
    } else {
      ctx.moveTo(mid.x, r.y);
      ctx.lineTo(mid.x, r.y + r.h);
    }
    ctx.strokeStyle = "#5a4a38";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  private drawUnit(ctx: CanvasRenderingContext2D, ut: UnitTimeline, t: number, flash: boolean, lunge?: Point): void {
    const u = ut.unit;
    const p = this.place(ut.pos.moving(t), this.lat(u.id));
    const x = p.x + (lunge?.x ?? 0);
    const y = p.y + (lunge?.y ?? 0);
    const dead = t >= ut.death;
    const style = ELEMENT_STYLE[u.element];
    const h = SIZE / 2;
    const wanted = this.looks.get(u.id);
    const look = wanted && resolveLook(this.sprites, wanted);
    const pose = look ? this.pose(ut, t, look) : null;
    const sprite = pose ? undefined : this.sprites.get(u.sprite);
    const icon = this.sprites.get("he/" + u.element);

    ctx.globalAlpha = dead ? 0.25 : 1;
    ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
    ctx.beginPath();
    ctx.ellipse(x, y + h, h, h * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.imageSmoothingEnabled = false; // giữ nét pixel art khi phóng to

    const figure = !!(pose || sprite);
    if (figure) {
      // Có hình PixelLab: vòng đội dưới chân, người đứng trên vòng; dấu hệ đặt trước thanh máu (vẽ ở dưới).
      ctx.lineWidth = 3;
      ctx.strokeStyle = TEAM_RING[u.team];
      ctx.stroke();
      const s = SIZE * 1.4;
      if (pose && look) {
        // Nhân vật ghép có hoạt ảnh: ngã xong thì mờ dần; trúng đòn nháy nhẹ.
        const tps = this.index!.replay.tps;
        ctx.globalAlpha = dead ? Math.max(0.35, 1 - (t - ut.death) / (1.5 * tps)) : flash ? 0.7 : 1;
        drawCharacter(ctx, this.sprites, look, pose.anim, pose.frame, x, y + h, s / 64, u.team === 1);
      } else if (u.team === 1) {
        if (flash && !dead) ctx.globalAlpha = 0.5;
        // Hình PixelLab nhìn hướng đông nam; đội B lật ngang để hai đội quay mặt vào nhau.
        ctx.save();
        ctx.translate(x, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(sprite!, -s / 2, y + h - s, s, s);
        ctx.restore();
      } else {
        if (flash && !dead) ctx.globalAlpha = 0.5;
        ctx.drawImage(sprite!, x - s / 2, y + h - s, s, s);
      }
    } else {
      ctx.beginPath();
      ctx.roundRect(x - h, y - h, SIZE, SIZE, 8);
      ctx.fillStyle = style.color;
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = TEAM_RING[u.team];
      ctx.stroke();
      if (flash && !dead) {
        ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
        ctx.fill();
      }
      if (icon) {
        ctx.drawImage(icon, x - 12, y - 12, 24, 24);
      } else {
        ctx.fillStyle = style.ink;
        ctx.font = "bold 12px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(style.short, x, y + 1);
      }
    }
    ctx.globalAlpha = 1;
    if (dead) return;

    // Thanh máu và mana phía trên đầu; có hình người thì dấu hệ đứng ngay trước hai thanh, cả cụm canh giữa.
    const bw = SIZE + 4;
    const badge = figure ? BADGE + 2 : 0;
    const bx = x - (bw + badge) / 2 + badge;
    const by = (figure ? y + h - SIZE * 1.4 : y - h) - 12;
    if (figure) {
      const cx = bx - 2 - BADGE / 2;
      const cy = by + 3.5;
      if (icon) {
        ctx.drawImage(icon, cx - BADGE / 2, cy - BADGE / 2, BADGE, BADGE);
      } else {
        // Chưa có icon hệ của PixelLab: họa tiết hệ trên nền tròn tối.
        ctx.fillStyle = "rgba(20, 17, 15, 0.8)";
        ctx.beginPath();
        ctx.arc(cx, cy, BADGE / 2 + 1, 0, Math.PI * 2);
        ctx.fill();
        drawMotif(ctx, u.element, cx, cy, BADGE / 2, 0, 1);
      }
    }
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.fillRect(bx - 1, by - 1, bw + 2, 9);
    ctx.fillStyle = HP;
    ctx.fillRect(bx, by, (bw * ut.hp.step(t)) / u.hpMax, 4);
    ctx.fillStyle = MANA;
    ctx.fillRect(bx, by + 5, (bw * ut.mana.rising(t)) / u.manaMax, 2);
  }

  /** Số sát thương và hồi máu bay lên rồi mờ đi. */
  private drawNumbers(ctx: CanvasRenderingContext2D, index: ReplayIndex, t: number, life: number): void {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(0, 0, 0, 0.75)";
    for (const e of between(index.hits, t - life, t)) {
      const ut = index.byId.get(e.unit);
      if (!ut) continue;
      const age = (t - e.tick) / life;
      const p = this.place(ut.pos.step(e.tick), this.lat(e.unit));
      // Nhiều đòn cùng lúc vào một người thì lệch ngang theo người đánh để khỏi đè nhau.
      const x = p.x + (((e.src * 37) % 25) - 12);
      const y = p.y - SIZE / 2 - 18 - age * 34;
      let text = String(e.amount);
      let color = "#fbf6ec";
      let size = 13;
      if (e.kind === "heal") {
        text = "+" + e.amount;
        color = HP;
      } else if (e.crit) {
        text = e.amount + "!";
        color = "#ffd34d";
        size = 17;
      }
      ctx.globalAlpha = 1 - age * age;
      ctx.font = `bold ${size}px system-ui, sans-serif`;
      ctx.strokeText(text, x, y);
      ctx.fillStyle = color;
      ctx.fillText(text, x, y);
    }
    ctx.globalAlpha = 1;
  }

  /** Số người còn đứng mỗi đội, và kết quả khi hết trận. Vẽ theo toạ độ màn hình. */
  private drawScore(v: View, index: ReplayIndex, t: number, player: ReplayPlayer): void {
    const ctx = v.ctx;
    ctx.setTransform(v.dpr, 0, 0, v.dpr, 0, 0);
    ctx.textBaseline = "top";
    ctx.textAlign = "center";
    ctx.font = "bold 14px system-ui, sans-serif";
    ctx.fillStyle = "#efe6d6";
    ctx.fillText(`Đội A ${index.alive(0, t)}  ·  ${index.alive(1, t)} Đội B`, v.w / 2, 8);
    if (t < index.replay.ticks || player.playing) return;
    const w = index.replay.winner;
    const text = w === "draw" ? "Hoà" : `Đội ${w} thắng`;
    ctx.font = "bold 28px system-ui, sans-serif";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 6;
    ctx.strokeStyle = "rgba(0, 0, 0, 0.7)";
    ctx.strokeText(text, v.w / 2, (v.h - v.bottom) / 2);
    ctx.fillStyle = "#ffd34d";
    ctx.fillText(text, v.w / 2, (v.h - v.bottom) / 2);
  }
}

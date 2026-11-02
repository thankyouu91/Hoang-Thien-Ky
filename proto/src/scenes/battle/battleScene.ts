import type { Sprites } from "../../assets/sprites.ts";
import { Camera, type Rect } from "../../app/camera.ts";
import type { Scene } from "../../app/scene.ts";
import type { View } from "../../app/view.ts";
import { ReplayPlayer } from "../../replay/player.ts";
import { between, ReplayIndex, type UnitTimeline } from "../../replay/timeline.ts";
import type { ReplaySource } from "../../replay/types.ts";
import { ELEMENT_STYLE } from "../../theme/elements.ts";
import { ReplayControls } from "./controls.ts";
import { FxLayer, type Point } from "./fx.ts";

const CELL = 64; // đơn vị thế giới mỗi ô sân
const LANE = 60; // khoảng cách ngang giữa hai người cùng hàng
const SIZE = 40; // cạnh khối nhân vật
const TEAM_RING = ["#e6d8b8", "#b3261e"]; // đội A giấy dó, đội B ấn son
const HP = "#7bc96f";
const MANA = "#5aa9e6";
const NUMBER_LIFE = 0.9; // giây thực một con số sát thương bay lên

/** Màn xem trận: phát replay, vẽ nhân vật bằng khối màu theo hệ. */
export class BattleScene implements Scene {
  readonly id = "tran";
  readonly label = "Trận";
  readonly camera = new Camera();
  readonly hud: HTMLElement;
  private controls: ReplayControls;
  private source: ReplaySource;
  private sprites: Sprites;
  private fx = new FxLayer();
  private index: ReplayIndex | null = null;
  private player: ReplayPlayer | null = null;
  private error = "";
  /** Số lần đã nạp; kết quả của lần nạp cũ về muộn thì bỏ. */
  private loads = 0;
  /** Toạ độ ngang của từng người, theo id */
  private lateral = new Map<number, number>();
  /** Trục sân dọc khi màn hình đứng, ngang khi màn hình nằm */
  private vertical: boolean | null = null;

  /** sources[0] mở mặc định; người xem đổi nguồn ở ô chọn trên thanh điều khiển. */
  constructor(sources: ReplaySource[], sprites: Sprites) {
    this.source = sources[0];
    this.sprites = sprites;
    this.controls = new ReplayControls(sources.map((s) => s.label), (i) => this.load(sources[i]));
    this.hud = this.controls.el;
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

    this.camera.apply(v);
    this.drawField(ctx, index.replay.fieldLength);

    const life = (s: number) => Math.min(2 * tps, s * tps * player.speed);
    this.fx.prepare({
      ctx, index, t, life, size: SIZE,
      at: (id, time = t) => {
        const ut = index.byId.get(id);
        return ut ? this.place(ut.pos.moving(time), this.lateral.get(id) ?? 0) : null;
      },
      zone: (center, radius) => {
        const p = this.place(center, 0);
        const along = (radius / 1000) * CELL;
        const half = 3.5 * LANE;
        return this.vertical ? { ...p, rx: half, ry: along } : { ...p, rx: along, ry: half };
      },
    });
    this.fx.ground();

    // Ai vừa trúng đòn trong 3 tick gần nhất thì nháy trắng.
    const flashed = new Set(between(index.hits, t - 3, t).filter((h) => h.kind === "hit").map((h) => h.unit));
    const lunges = this.fx.lunges();
    for (const ut of index.units) this.drawUnit(ctx, ut, t, flashed.has(ut.unit.id), lunges.get(ut.unit.id));

    this.fx.air();
    this.drawNumbers(ctx, index, t, life(NUMBER_LIFE));
    this.drawScore(v, index, t, player);
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

  private fitIfRotated(v: View): void {
    if (!this.index) return;
    const vertical = v.h - v.bottom >= v.w;
    if (vertical === this.vertical) return;
    this.vertical = vertical;
    const r = this.fieldRect();
    this.camera.fit(r, v, 8);
    this.camera.bounds = r;
  }

  // ---- vẽ ----

  private drawField(ctx: CanvasRenderingContext2D, fieldLength: number): void {
    const r = this.fieldRect();
    const cells = fieldLength / 1000;
    ctx.fillStyle = "#1f1a15";
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.beginPath();
    for (let i = 0; i <= cells; i++) {
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
  }

  private drawUnit(ctx: CanvasRenderingContext2D, ut: UnitTimeline, t: number, flash: boolean, lunge?: Point): void {
    const u = ut.unit;
    const p = this.place(ut.pos.moving(t), this.lateral.get(u.id) ?? 0);
    const x = p.x + (lunge?.x ?? 0);
    const y = p.y + (lunge?.y ?? 0);
    const dead = t >= ut.death;
    const style = ELEMENT_STYLE[u.element];
    const h = SIZE / 2;
    const sprite = this.sprites.get(u.sprite);
    const icon = this.sprites.get("he/" + u.element);

    ctx.globalAlpha = dead ? 0.25 : 1;
    ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
    ctx.beginPath();
    ctx.ellipse(x, y + h, h, h * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.imageSmoothingEnabled = false; // giữ nét pixel art khi phóng to

    if (sprite) {
      // Có hình tu sĩ: vòng đội dưới chân, hình đứng trên vòng, icon hệ ở góc.
      ctx.lineWidth = 3;
      ctx.strokeStyle = TEAM_RING[u.team];
      ctx.stroke();
      if (flash && !dead) ctx.globalAlpha = 0.5;
      const s = SIZE * 1.4;
      ctx.drawImage(sprite, x - s / 2, y + h - s, s, s);
      ctx.globalAlpha = dead ? 0.25 : 1;
      if (icon) ctx.drawImage(icon, x - h - 4, y - h - 4, 16, 16);
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

    // Thanh máu và mana phía trên đầu.
    const bw = SIZE + 4;
    const bx = x - bw / 2;
    const by = (sprite ? y + h - SIZE * 1.4 : y - h) - 12;
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
      const p = this.place(ut.pos.step(e.tick), this.lateral.get(e.unit) ?? 0);
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

// Hiệu ứng ra chiêu thay cho đường thẳng: mỗi loại chiêu một hình dạng (GDD mục 8), hạt mang họa tiết của hệ (mục 15).
// Mọi hiệu ứng là hàm của thời điểm phát t: tua tới lui vẫn thấy y hệt. Hạt sinh theo seed của từng sự kiện.
import { SKILL_RULES } from "@ktlp/sim";
import { between, type ReplayIndex } from "../../replay/timeline.ts";
import type { ReplayEvent, SkillId } from "../../replay/types.ts";
import { ELEMENT_STYLE } from "../../theme/elements.ts";
import { burst, drawMotif, next, particle, seed, unit01 } from "./motifs.ts";

type Cast = Extract<ReplayEvent, { kind: "cast" }>;
export interface Point {
  x: number;
  y: number;
}
type Zone = Point & { rx: number; ry: number };

/** Những gì hiệu ứng cần từ scene trong khung hình này. */
export interface FxFrame {
  ctx: CanvasRenderingContext2D;
  index: ReplayIndex;
  /** Thời điểm phát, tick có phần lẻ */
  t: number;
  /** Cạnh khối nhân vật, đơn vị thế giới */
  size: number;
  /** Giây thực ra số tick theo tốc độ phát */
  life: (seconds: number) => number;
  /** Vị trí thế giới của một người ở thời điểm `time` (mặc định t) */
  at: (unit: number, time?: number) => Point | null;
  /** Vùng đánh trên sân thành hình elip theo toạ độ thế giới */
  zone: (center: number, radius: number) => Zone;
}

const MELEE = new Set<SkillId>(["can_don", "can_quet", "than_phap"]);
const PROJECTILE = new Set<SkillId>(["tam_xa", "bua_chu", "khong_che"]);
/** Chiêu bày lâu nhất (trận pháp 5 s) cộng dư, tick */
const MAX_LEAD = 120;
/** Đạn bay lâu nhất (bùa chú), tick */
const MAX_FLIGHT = 12;
// Thời lượng trạng thái lấy theo luật của sim; khi sim ghi trạng thái theo thời gian thì đọc từ replay.
const STUN = SKILL_RULES.stunTicks;
const EXPOSED = SKILL_RULES.exposedTicks;
const STATE_WINDOW = Math.max(STUN, EXPOSED);
const PAPER = "#efe0b0";
const SEAL = "#b3261e";
const STAR = "#ffd34d";

export class FxLayer {
  private f!: FxFrame;
  private recent: Cast[] = [];
  private upcoming: Cast[] = [];
  private states: Cast[] = [];

  /** Gọi đầu mỗi khung hình, trước lunges/ground/air. */
  prepare(f: FxFrame): void {
    this.f = f;
    this.recent = between(f.index.casts, f.t - f.life(1), f.t);
    this.upcoming = between(f.index.casts, f.t, f.t + MAX_LEAD);
    this.states = between(f.index.casts, f.t - STATE_WINDOW, f.t).filter((c) => c.skill === "khong_che" || c.skill === "than_phap");
  }

  /** Người đánh cận chiến nhích về phía mục tiêu rồi lùi lại. */
  lunges(): Map<number, Point> {
    const { t, life, at } = this.f;
    const out = new Map<number, Point>();
    for (const c of this.recent) {
      if (c.skill !== "can_don" && c.skill !== "can_quet") continue;
      const a = (t - c.tick) / life(0.2);
      const src = at(c.unit);
      const dst = aim(c, at);
      if (a >= 1 || !src || !dst) continue;
      const d = dirOf(src, dst);
      const k = 7 * Math.sin(Math.PI * a);
      out.set(c.unit, { x: d.x * k, y: d.y * k });
    }
    return out;
  }

  /** Lớp dưới chân: vòng báo trước, nền sáng lúc nổ, vòng đỏ của người đang lộ vị trí. */
  ground(): void {
    const { ctx, t, life, at, zone, size } = this.f;
    for (const c of this.upcoming) {
      if (c.start === undefined || c.center === undefined || !c.radius || c.start > t) continue;
      const z = zone(c.center, c.radius);
      const color = ELEMENT_STYLE[c.element].color;
      const p = Math.min(1, (t - c.start) / Math.max(1, c.tick - c.start));
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.05;
      ellipse(ctx, z, 1);
      ctx.fill();
      ctx.globalAlpha = 0.1;
      ellipse(ctx, z, p);
      ctx.fill();
      ctx.globalAlpha = 0.6;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      if (c.skill === "tran_phap") {
        formation(ctx, z, t * 0.03);
      } else {
        ctx.setLineDash([8, 6]);
        ctx.lineDashOffset = -t * 2;
        ellipse(ctx, z, 1);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      // Người ra chiêu tụ lực: hạt của hệ xoáy dần vào người.
      const src = at(c.unit);
      if (!src) continue;
      glowAt(ctx, color, src.x, src.y, 14 + 18 * p, 0.3 + 0.5 * p);
      for (let k = 0; k < 4; k++) {
        const ang = t * 0.15 + (k * Math.PI) / 2;
        const r = 34 * (1 - ((t - c.start) / 10 + k / 4) % 1);
        drawMotif(ctx, c.element, src.x + Math.cos(ang) * r, src.y + Math.sin(ang) * r, 5, ang, 0.8);
      }
    }
    for (const c of this.recent) {
      if (c.center === undefined || !c.radius) continue;
      const a = (t - c.tick) / life(c.skill === "tran_phap" ? 0.7 : 0.45);
      if (a < 0 || a >= 1) continue;
      const z = zone(c.center, c.radius);
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = ELEMENT_STYLE[c.element].color;
      ctx.globalAlpha = 0.35 * (1 - a) * (1 - a);
      ellipse(ctx, z, 1);
      ctx.fill();
      if (c.skill === "tran_phap") {
        ctx.fillStyle = "#ffffff";
        ctx.globalAlpha = 0.4 * (1 - a) ** 3;
        ellipse(ctx, z, 1);
        ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";
    }
    // Thân pháp: lộ vị trí, địch ưu tiên đánh.
    for (const c of this.states) {
      if (c.skill !== "than_phap" || t - c.tick >= EXPOSED || !alive(this.f, c.unit)) continue;
      const p = at(c.unit);
      if (!p) continue;
      ctx.globalAlpha = 0.55 + 0.3 * Math.sin(t * 0.6);
      ctx.strokeStyle = "#ff5a4f";
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 4]);
      ctx.lineDashOffset = t;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y + size / 2, size * 0.7, size * 0.25, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.globalAlpha = 1;
  }

  /** Lớp trên đầu: đạn, vệt chém, chạm trúng, vòng nổ, hào quang đồng đội, sao choáng. */
  air(): void {
    const { ctx } = this.f;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const c of this.upcoming) if (PROJECTILE.has(c.skill) && c.tick - this.f.t <= MAX_FLIGHT) this.flight(c);
    for (const c of this.recent) this.after(c);
    for (const c of this.states) if (c.skill === "khong_che") this.stun(c);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
  }

  /** Đạn đang bay, chạm đúng tick trúng đòn. */
  private flight(c: Cast): void {
    const { ctx, t, at, index } = this.f;
    const src = at(c.unit);
    const from = index.byId.get(c.unit);
    if (!src || !from) return;
    const color = ELEMENT_STYLE[c.element].color;
    for (const id of c.targets) {
      const dst = at(id);
      const to = index.byId.get(id);
      if (!dst || !to) continue;
      const cells = Math.abs(from.pos.moving(t) - to.pos.moving(t)) / 1000;
      const talisman = c.skill === "bua_chu";
      const flight = talisman ? clamp(Math.round(cells * 2.2), 4, MAX_FLIGHT) : clamp(Math.round(cells * 1.5), 2, 8);
      const p = 1 - (c.tick - t) / flight;
      if (p < 0) continue;
      const n = normalOf(src, dst);
      const arc = talisman ? 22 : c.skill === "khong_che" ? 6 : 10;
      const point = (q: number): Point => {
        const bump = Math.sin(Math.PI * q) * arc;
        return { x: src.x + (dst.x - src.x) * q + n.x * bump, y: src.y + (dst.y - src.y) * q + n.y * bump };
      };
      const head = point(p);

      if (talisman) {
        // Lá bùa xoay tròn, bóng mờ phía sau.
        glowAt(ctx, color, head.x, head.y, 14, 0.6);
        for (let k = 2; k >= 0; k--) {
          const q = p - k * 0.08;
          if (q < 0) continue;
          const tp = point(q);
          paper(ctx, tp.x, tp.y, q * Math.PI * 4, k === 0 ? 1 : 0.25);
        }
        continue;
      }
      if (c.element === "loi") {
        // Lôi: tia sét gấp khúc kéo theo sau đầu đạn, nhảy hình mỗi tick.
        const tail = point(Math.max(0, p - 0.35));
        bolt(ctx, color, tail, head, seed(Math.floor(t), c.unit, id));
      } else {
        for (let k = 3; k >= 1; k--) {
          const q = p - k * 0.07;
          if (q < 0) continue;
          const tp = point(q);
          glowAt(ctx, color, tp.x, tp.y, 6 - k, 0.45 - k * 0.1);
        }
        const mq = p - 0.14;
        if (mq > 0) {
          const mp = point(mq);
          drawMotif(ctx, c.element, mp.x, mp.y, 4.5, mq * 8, 0.75);
        }
      }
      glowAt(ctx, color, head.x, head.y, 10, 1);
      if (c.skill === "khong_che") {
        // Khống chế: hai vòng xích nhỏ quay quanh đầu đạn.
        ctx.globalAlpha = 0.9;
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.5;
        for (let k = 0; k < 2; k++) {
          const ang = t * 0.9 + k * Math.PI;
          ctx.beginPath();
          ctx.ellipse(head.x + Math.cos(ang) * 7, head.y + Math.sin(ang) * 7, 3.5, 2, ang, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    }
  }

  /** Hiệu ứng sau tick ra chiêu của từng loại chiêu. */
  private after(c: Cast): void {
    const { ctx, t, life, at, zone, size } = this.f;
    const color = ELEMENT_STYLE[c.element].color;
    const src = at(c.unit);
    if (!src) return;

    switch (c.skill) {
      case "can_quet": {
        // Cung quét trước mặt, phủ các mục tiêu.
        const a = (t - c.tick) / life(0.25);
        const dst = aim(c, at);
        if (a < 1 && dst) swoosh(ctx, color, src.x, src.y, 50, Math.atan2(dst.y - src.y, dst.x - src.x), 1.2, a, 10);
        break;
      }
      case "can_don": {
        // Vệt chém lưỡi liềm ngang qua mục tiêu.
        const a = (t - c.tick) / life(0.25);
        const dst = at(c.targets[0]);
        if (a < 1 && dst) {
          const dir = Math.atan2(dst.y - src.y, dst.x - src.x);
          swoosh(ctx, color, dst.x - Math.cos(dir) * 12, dst.y - Math.sin(dir) * 12, 26, dir, 1.1, a, 7);
        }
        break;
      }
      case "than_phap": {
        // Lướt tới: bóng mờ dọc đường lướt, rồi một nhát chém.
        const a = (t - c.tick) / life(0.45);
        const from = at(c.unit, c.tick - 1);
        if (a < 1 && from) {
          for (let k = 1; k <= 4; k++) {
            const q = k / 5;
            const gx = from.x + (src.x - from.x) * q;
            const gy = from.y + (src.y - from.y) * q;
            ctx.globalAlpha = (1 - a) * (0.1 + 0.1 * k);
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.roundRect(gx - size / 2, gy - size / 2, size, size, 8);
            ctx.fill();
          }
        }
        const b = (t - c.tick) / life(0.25);
        const dst = at(c.targets[0]);
        if (b < 1 && dst) {
          const dir = Math.atan2(dst.y - src.y, dst.x - src.x);
          swoosh(ctx, color, dst.x - Math.cos(dir) * 12, dst.y - Math.sin(dir) * 12, 28, dir + 0.6, 1.3, b, 8);
        }
        break;
      }
      case "hoi_phuc": {
        // Cột sáng và dấu cộng bay lên trên từng đồng đội được hồi.
        const a = (t - c.tick) / life(0.8);
        if (a >= 1) break;
        for (const id of c.targets) {
          const d = at(id);
          if (!d) continue;
          pillarAt(ctx, color, d.x, d.y, size, (1 - a) * 0.8);
          let s = seed(c.tick, c.unit, id);
          for (let k = 0; k < 3; k++) {
            s = next(s);
            const dx = (unit01(s) - 0.5) * size;
            cross(ctx, color, d.x + dx, d.y + 6 - a * (30 + k * 8), 3.5, 1 - a);
          }
        }
        break;
      }
      case "ho_the": {
        // Bong bóng khiên lục giác bao người được che, ánh sáng chạy quanh viền.
        const a = (t - c.tick) / life(1);
        if (a >= 1) break;
        for (const id of c.targets) {
          const d = at(id);
          if (!d) continue;
          hexagon(ctx, d.x, d.y, size * 0.78);
          ctx.globalAlpha = 0.14 * (1 - a);
          ctx.fillStyle = color;
          ctx.fill();
          ctx.globalAlpha = 1 - a;
          ctx.strokeStyle = color;
          ctx.lineWidth = 2.5;
          ctx.stroke();
          const ang = t * 0.25;
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(d.x, d.y, size * 0.7, ang, ang + 0.8);
          ctx.stroke();
          burst(ctx, c.element, d.x, d.y, a, seed(c.tick, c.unit, id), 3, size * 0.8, 4);
        }
        break;
      }
      case "dien_rong":
      case "tran_phap": {
        // Vòng nổ lan ra từ vùng đánh, hạt của hệ rải khắp vùng.
        if (c.center === undefined || !c.radius) break;
        const a = (t - c.tick) / life(c.skill === "tran_phap" ? 0.7 : 0.45);
        if (a < 0 || a >= 1) break;
        const z = zone(c.center, c.radius);
        ctx.globalAlpha = 1 - a;
        ctx.strokeStyle = color;
        ctx.lineWidth = 6 * (1 - a) + 1;
        ellipse(ctx, z, 0.5 + 0.7 * a);
        ctx.stroke();
        let s = seed(c.tick, c.unit, 0);
        for (let k = 0; k < 10; k++) {
          s = next(s);
          const ang = unit01(s) * Math.PI * 2;
          s = next(s);
          const r = 0.2 + 0.7 * unit01(s);
          particle(ctx, c.element, z.x + Math.cos(ang) * z.rx * r, z.y + Math.sin(ang) * z.ry * r, a, ang, 7, k);
        }
        break;
      }
    }

    if (MELEE.has(c.skill) || PROJECTILE.has(c.skill)) {
      // Chạm trúng: vòng nhỏ loé ra và chùm hạt của hệ; bùa chú nổ thêm mảnh giấy.
      const a = (t - c.tick) / life(0.35);
      if (a >= 1) return;
      for (const id of c.targets) {
        const d = at(id);
        if (!d) continue;
        ctx.globalAlpha = 1 - a;
        ctx.strokeStyle = color;
        ctx.lineWidth = 3 * (1 - a) + 0.5;
        ctx.beginPath();
        ctx.arc(d.x, d.y, 6 + 18 * a, 0, Math.PI * 2);
        ctx.stroke();
        const s = seed(c.tick, c.unit, id);
        burst(ctx, c.element, d.x, d.y, a, s, c.skill === "bua_chu" ? 7 : 5, 28, 5);
        if (c.skill === "bua_chu") {
          glowAt(ctx, SEAL, d.x, d.y, 26 * (0.6 + a), 0.7 * (1 - a));
          let p = next(s);
          for (let k = 0; k < 5; k++) {
            p = next(p);
            const ang = unit01(p) * Math.PI * 2;
            const r = 34 * (1 - (1 - a) ** 2);
            paper(ctx, d.x + Math.cos(ang) * r, d.y + Math.sin(ang) * r + 12 * a * a, ang + a * 6, (1 - a) * 0.9, 0.55);
          }
        }
      }
    }
  }

  /** Sao choáng quay trên đầu người bị khống chế. */
  private stun(c: Cast): void {
    const { ctx, t, at, size } = this.f;
    if (t - c.tick >= STUN) return;
    for (const id of c.targets) {
      if (!alive(this.f, id)) continue;
      const d = at(id);
      if (!d) continue;
      // Quay quanh mép trên của khối, dưới thanh máu, để không lẫn với số sát thương bay lên.
      for (let k = 0; k < 3; k++) {
        const ang = t * 0.35 + (k * Math.PI * 2) / 3;
        star(ctx, d.x + Math.cos(ang) * 16, d.y - size / 2 + 4 + Math.sin(ang) * 5, 6, 1);
      }
    }
  }
}

function alive(f: FxFrame, id: number): boolean {
  const ut = f.index.byId.get(id);
  return !!ut && ut.death > f.t;
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

/** Điểm nhắm: giữa các mục tiêu. */
function aim(c: Cast, at: (id: number) => Point | null): Point | null {
  let x = 0;
  let y = 0;
  let n = 0;
  for (const id of c.targets) {
    const p = at(id);
    if (!p) continue;
    x += p.x;
    y += p.y;
    n++;
  }
  return n ? { x: x / n, y: y / n } : null;
}

function dirOf(a: Point, b: Point): Point {
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  return { x: (b.x - a.x) / len, y: (b.y - a.y) / len };
}

function normalOf(a: Point, b: Point): Point {
  const d = dirOf(a, b);
  return { x: -d.y, y: d.x };
}

function ellipse(ctx: CanvasRenderingContext2D, z: Zone, scale: number): void {
  ctx.beginPath();
  ctx.ellipse(z.x, z.y, Math.max(0.1, z.rx * scale), Math.max(0.1, z.ry * scale), 0, 0, Math.PI * 2);
}

/** Trận đồ: bát giác xoay nội tiếp vùng, vòng trong và 8 vạch quẻ. */
function formation(ctx: CanvasRenderingContext2D, z: Zone, rot: number): void {
  const pt = (ang: number, s: number): Point => ({ x: z.x + Math.cos(ang) * z.rx * s, y: z.y + Math.sin(ang) * z.ry * s });
  ctx.beginPath();
  for (let k = 0; k <= 8; k++) {
    const p = pt(rot + (k * Math.PI) / 4, 1);
    if (k === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  }
  ellipse(ctx, z, 0.55);
  for (let k = 0; k < 8; k++) {
    const ang = rot + (k * Math.PI) / 4 + Math.PI / 8;
    const a = pt(ang, 0.62);
    const b = pt(ang, 0.85);
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
  }
  ctx.stroke();
}

/** Vệt chém hình cung quanh (x, y), quét dần theo a từ 0 tới 1, mỏng dần rồi tắt. */
function swoosh(
  ctx: CanvasRenderingContext2D, color: string,
  x: number, y: number, r: number, dir: number, half: number, a: number, width: number,
): void {
  const from = dir - half;
  const to = from + 2 * half * Math.min(1, a * 2.5);
  ctx.globalAlpha = 1 - a;
  ctx.strokeStyle = color;
  ctx.lineWidth = width * (1 - a) + 1;
  ctx.beginPath();
  ctx.arc(x, y, r, from, to);
  ctx.stroke();
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = (width * (1 - a)) / 3 + 0.5;
  ctx.stroke();
}

/** Tia sét gấp khúc từ a tới b, khúc gấp theo seed. */
function bolt(ctx: CanvasRenderingContext2D, color: string, a: Point, b: Point, s: number): void {
  const n = normalOf(a, b);
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  for (let k = 1; k < 5; k++) {
    s = next(s);
    const q = k / 5;
    const j = (unit01(s) - 0.5) * 12;
    ctx.lineTo(a.x + (b.x - a.x) * q + n.x * j, a.y + (b.y - a.y) * q + n.y * j);
  }
  ctx.lineTo(b.x, b.y);
  const prev = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = 0.9;
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.globalCompositeOperation = prev;
}

/** Lá bùa giấy vàng có vạch son, xoay theo rot. */
function paper(ctx: CanvasRenderingContext2D, x: number, y: number, rot: number, alpha: number, scale = 1): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(scale, scale);
  ctx.fillStyle = PAPER;
  ctx.fillRect(-6, -10, 12, 20);
  ctx.fillStyle = SEAL;
  ctx.fillRect(-1.5, -7, 3, 14);
  ctx.fillRect(-4.5, -8.5, 9, 3);
  ctx.restore();
}

function hexagon(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.beginPath();
  for (let k = 0; k < 6; k++) {
    const ang = (k * Math.PI) / 3 + Math.PI / 6;
    if (k === 0) ctx.moveTo(x + Math.cos(ang) * r, y + Math.sin(ang) * r);
    else ctx.lineTo(x + Math.cos(ang) * r, y + Math.sin(ang) * r);
  }
  ctx.closePath();
}

function cross(ctx: CanvasRenderingContext2D, color: string, x: number, y: number, r: number, alpha: number): void {
  ctx.globalAlpha = Math.max(0, alpha);
  ctx.fillStyle = color;
  ctx.fillRect(x - r, y - r / 3, 2 * r, (2 * r) / 3);
  ctx.fillRect(x - r / 3, y - r, (2 * r) / 3, 2 * r);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(x - r / 2, y - r / 8, r, r / 4);
  ctx.fillRect(x - r / 8, y - r / 2, r / 4, r);
}

/** Sao bốn cánh màu vàng. */
function star(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, alpha: number): void {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = STAR;
  ctx.beginPath();
  for (let k = 0; k < 8; k++) {
    const ang = (k * Math.PI) / 4 - Math.PI / 2;
    const rr = k % 2 ? r * 0.38 : r;
    if (k === 0) ctx.moveTo(x + Math.cos(ang) * rr, y + Math.sin(ang) * rr);
    else ctx.lineTo(x + Math.cos(ang) * rr, y + Math.sin(ang) * rr);
  }
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(0, 0, 0, 0.6)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

// Hào quang và cột sáng vẽ sẵn một lần cho mỗi màu rồi dùng lại; vẽ chồng bằng "lighter" cho sáng lên.
const glowCache = new Map<string, HTMLCanvasElement>();
function glowAt(ctx: CanvasRenderingContext2D, color: string, x: number, y: number, r: number, alpha: number): void {
  if (alpha <= 0 || r <= 0) return;
  let g = glowCache.get(color);
  if (!g) {
    g = document.createElement("canvas");
    g.width = g.height = 64;
    const c = g.getContext("2d")!;
    const grad = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, "rgba(255, 255, 255, 1)");
    grad.addColorStop(0.25, color);
    grad.addColorStop(1, "rgba(0, 0, 0, 0)");
    c.fillStyle = grad;
    c.fillRect(0, 0, 64, 64);
    glowCache.set(color, g);
  }
  const prev = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = Math.min(1, alpha);
  ctx.drawImage(g, x - r, y - r, 2 * r, 2 * r);
  ctx.globalCompositeOperation = prev;
}

const pillarCache = new Map<string, HTMLCanvasElement>();
function pillarAt(ctx: CanvasRenderingContext2D, color: string, x: number, y: number, size: number, alpha: number): void {
  if (alpha <= 0) return;
  let g = pillarCache.get(color);
  if (!g) {
    g = document.createElement("canvas");
    g.width = 32;
    g.height = 128;
    const c = g.getContext("2d")!;
    const v = c.createLinearGradient(0, 0, 0, 128);
    v.addColorStop(0, "rgba(0, 0, 0, 0)");
    v.addColorStop(0.6, color);
    v.addColorStop(0.85, "rgba(255, 255, 255, 1)");
    v.addColorStop(1, "rgba(0, 0, 0, 0)");
    c.fillStyle = v;
    c.fillRect(0, 0, 32, 128);
    // Mờ hai mép để thành cột sáng mềm.
    c.globalCompositeOperation = "destination-in";
    const h = c.createLinearGradient(0, 0, 32, 0);
    h.addColorStop(0, "rgba(0, 0, 0, 0)");
    h.addColorStop(0.5, "rgba(0, 0, 0, 1)");
    h.addColorStop(1, "rgba(0, 0, 0, 0)");
    c.fillStyle = h;
    c.fillRect(0, 0, 32, 128);
    pillarCache.set(color, g);
  }
  const prev = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = Math.min(1, alpha);
  ctx.drawImage(g, x - size * 0.4, y - size * 2, size * 0.8, size * 2.5);
  ctx.globalCompositeOperation = prev;
}

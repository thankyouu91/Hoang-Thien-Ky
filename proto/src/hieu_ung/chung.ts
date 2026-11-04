// Phần dùng chung của hiệu ứng theo loại chiêu (chieu.ts) và dáng chiêu đặc trưng (dang.ts): khung một lần ra chiêu,
// tụ lực (pha 1), chạm trúng kèm nét hệ (pha 3), vệt kéo, thời gian bay.
import { aim, BODY_Z, palette, type Ctx } from "./ctx.ts";
import { CELL, COLORS, L, WHITE } from "./emit.ts";
import { hitSignature } from "./he.ts";
import { count, type Recipe } from "./recipe.ts";
import type { Cast, Point, Zone } from "./types.ts";
import { beam, clamp01, easeOut, glow, motif, pulse, ramp, rays, ring, rnd, rune, sprite } from "./ve.ts";

const TAU = Math.PI * 2;

export interface Shot {
  c: Cast;
  r: Recipe;
  seed: number;
  /** Chân người ra chiêu (hiện tại) và hướng mặt về phía mục tiêu */
  src: Point;
  face: Point;
  /** giây thực × nhịp biến thể → tick */
  S: (s: number) => number;
}

export function dir(a: Point, b: Point): Point {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: dx / len, y: dy / len };
}

/** Pha 1 chung: quầng tụ lực ở tay và hạt hệ xoáy vào; chiêu đặc biệt thêm vòng phù văn dưới chân. */
export function windup(x: Ctx, s: Shot, from: number, to: number, strength = 1): void {
  const { t, e } = x;
  if (t < from || t >= to) return;
  const q = (t - from) / Math.max(1, to - from);
  const { r, src, face } = s;
  const hx = src.x + face.x * 10;
  const hy = src.y + face.y * 10;
  const k = r.bright * strength;
  glow(e, L.AIR, hx, hy, BODY_Z + 4, (8 + 14 * q) * (0.8 + 0.2 * r.impact), r.main.glow, (0.25 + 0.6 * q) * k, 1, 0.5 * q);
  const n = count(r, r.special ? 5 : 3);
  for (let i = 0; i < n; i++) {
    const ph = (q * 1.4 + i / n) % 1;
    const ang = rnd(s.seed, 300 + i) * TAU + t * 0.12;
    const rr = 30 * (1 - ph);
    const el = i % 3 === 2 && r.subs[0] ? r.subs[0] : r.el;
    motif(e, L.AIR, el, hx + Math.cos(ang) * rr, hy + Math.sin(ang) * rr * 0.5, BODY_Z + 4 + Math.sin(ang) * rr * 0.4, 3.5 + 2 * ph, ang, COLORS[el].glow, k * ph, 0.5);
  }
  if (r.special) {
    const rad = 18 + 4 * r.tier;
    rune(e, L.GROUND, src.x, src.y, rad, rad * 0.38, r.main.glow, 0.75 * k * ramp(q, 0, 0.3), t * 0.04, 1, 3, 1, 0.7);
  }
}

/** Pha 3 chung trên một mục tiêu: chớp, tia lửa, vòng nhỏ, nét hệ chủ và các hệ phụ. */
export function impact(x: Ctx, s: Shot, id: number, a: number, scale = 1, sigK = 1): void {
  if (a < 0 || a >= 1) return;
  const { e } = x;
  const { r, c } = s;
  const p = x.foot(id, c.tick);
  if (!p) return;
  const k = r.bright;
  const seed = s.seed ^ (id * 2654435761);
  const big = r.impact * scale;
  // Chớp ngắn và trong để vẫn thấy người, thanh máu, số sát thương bên dưới.
  glow(e, L.AIR, p.x, p.y, BODY_Z, 13 * big * (0.6 + 0.5 * easeOut(a)), r.main.glow, 0.6 * k * pulse(a, 0.06), 1, 0.25);
  ring(e, L.AIR, p.x, p.y, 8 + 22 * easeOut(a) * big, 8 + 22 * easeOut(a) * big, r.main.glow, 0.7 * k * (1 - a), { width: 2.2 * big * (1 - a) + 0.6, z: BODY_Z, add: 0.9 });
  const n = count(r, 4 + (r.variant === "bao" ? 3 : 0));
  for (let i = 0; i < n; i++) {
    const ang = rnd(seed, 400 + i) * TAU;
    const dist = (10 + 26 * rnd(seed, 410 + i)) * easeOut(a) * big;
    const col = i % 3 === 2 ? r.trail.glow : r.main.glow;
    sprite(e, L.AIR, CELL.spark, p.x + Math.cos(ang) * dist, p.y + Math.sin(ang) * dist, BODY_Z + Math.sin(ang) * dist * 0.3, 7 * (1 - a) + 2, 2, ang, col, k * (1 - a), 1, 0.8);
  }
  if (r.tier >= 1) {
    for (let i = 0; i < r.tier + 1; i++) {
      const ang = rnd(seed, 420 + i) * TAU;
      sprite(e, L.AIR, CELL.star, p.x + Math.cos(ang) * 16 * big, p.y + Math.sin(ang) * 8, BODY_Z + 12 * rnd(seed, 430 + i), 5, 5, a * 3, WHITE, k * pulse(a, 0.3), 1, 0.5);
    }
  }
  if (r.tier >= 2) rays(e, L.AIR, p.x, p.y, BODY_Z, 30 * big, r.main.glow, 0.7 * k * pulse(a, 0.1), 6 + 2 * r.tier, rnd(seed, 440) * TAU, 10, 0.4);
  const src = x.foot(c.unit, c.tick);
  const pal = palette(c);
  hitSignature(x, pal[0], r, r.sig * sigK, a, p, src, seed, id);
  for (let i = 1; i < pal.length; i++) hitSignature(x, pal[i], r, 0.5 * r.sig * sigK, clamp01(a * 1.15 - 0.08 * i), p, src, seed ^ (i * 977), id);
}

/** Vệt kéo của đạn: các đoạn dải sáng phía sau đầu đạn, màu hệ phụ ở ngoài, hệ chủ ở lõi. */
export function trail(x: Ctx, s: Shot, pt: (q: number) => [number, number, number], q: number, len: number, w: number, k: number): void {
  const { r } = s;
  const segs = 5;
  for (let j = 0; j < segs; j++) {
    const q0 = q - (len * (j + 1)) / segs;
    const q1 = q - (len * j) / segs;
    if (q1 <= 0) break;
    const [x0, y0, z0] = pt(Math.max(0, q0));
    const [x1, y1, z1] = pt(q1);
    const fade = 1 - j / segs;
    beam(x.e, L.AIR, x0, y0, z0, x1, y1, z1, w * (0.5 + 0.5 * fade) * 1.8, r.trail.glow, k * fade * 0.45, k * (fade + 0.2) * 0.45, 1, 0, 0, 1);
    beam(x.e, L.AIR, x0, y0, z0, x1, y1, z1, w * (0.4 + 0.6 * fade), r.main.glow, k * fade * 0.8, k * Math.min(1, fade + 0.2), 1, 0.5, 0.3, 0.5);
  }
}

/** Thời gian bay (giây thực) theo khoảng cách ô. */
export function flightSeconds(skill: Cast["skill"], cells: number): number {
  if (skill === "bua_chu") return Math.min(0.6, Math.max(0.25, 0.22 + 0.04 * cells));
  const base = Math.min(0.42, Math.max(0.1, 0.08 + 0.035 * cells));
  return skill === "khong_che" ? base * 1.15 : base;
}


// ---- dùng cho dáng chiêu (dang.ts, dang_he.ts) -----------------------------------------------------------------

/** Vùng đánh (chân người, toạ độ đất) của chiêu có vùng; không có thì vòng nhỏ quanh giữa các mục tiêu. */
export function areaOf(x: Ctx, s: Shot): Zone {
  const { c } = s;
  if (c.center !== undefined && c.radius) {
    const z = x.f.zone(c.center, c.radius);
    return { x: z.x, y: z.y + x.f.size / 2, rx: z.rx, ry: z.ry };
  }
  const p = aim(x, c, c.tick) ?? s.src;
  return { x: p.x, y: p.y, rx: 46, ry: 30 };
}

/** Điểm ngẫu nhiên thứ i trong elip vùng (phân bố đều theo diện tích). */
export function inZone(z: Zone, seed: number, i: number): Point {
  const ang = rnd(seed, 2 * i) * TAU;
  const rr = Math.sqrt(rnd(seed, 2 * i + 1)) * 0.9;
  return { x: z.x + Math.cos(ang) * z.rx * rr, y: z.y + Math.sin(ang) * z.ry * rr };
}

/** Pha 3 chung cho mọi mục tiêu. */
export function hits(x: Ctx, s: Shot, dur: number, scale = 1, sigK = 1): void {
  for (const id of s.c.targets) impact(x, s, id, (x.t - s.c.tick) / s.S(dur), scale, sigK);
}

/** Vòng báo trước của chiêu vận công (diện rộng) trong lúc vận. */
export function warning(x: Ctx, s: Shot, z: Zone, from: number): void {
  const { t, e } = x;
  const { c, r } = s;
  if (c.start === undefined || t < from || t >= c.tick) return;
  const q = (t - from) / Math.max(1, c.tick - from);
  const k = r.bright * x.zoneK;
  ring(e, L.GROUND, z.x, z.y, z.rx, z.ry, r.main.glow, (0.45 + 0.3 * Math.sin(t * (0.4 + q))) * k, { width: 2.5, dashes: 28, phase: -t * 0.01, duty: 0.65, fill: 0.12 * q });
  ring(e, L.GROUND, z.x, z.y, z.rx * q, z.ry * q, r.main.glow, 0.45 * k, { width: 1.5, add: 0.8 });
}


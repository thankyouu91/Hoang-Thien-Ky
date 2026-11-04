// Hiệu ứng theo loại chiêu (GDD mục 8), mỗi chiêu bốn pha:
//   1. khởi chiêu: tụ lực ở người ra chiêu (chiêu vận công, bày trận: suốt lúc vận);
//   2. đường bay: đạn, kiếm khí, lá bùa, xích bay; vệt chém, cung quét; lướt; luồng sáng tới đồng đội;
//   3. chạm trúng: đúng tick sim tính đòn, kèm nét hệ chủ và hệ phụ (he.ts);
//   4. trạng thái kéo dài: vẽ ở he.ts statusFx theo thời hạn trạng thái.
// Pha 1–2 nằm trước tick ra chiêu (replay biết trước), pha 3 bắt đầu đúng tick đó. Thời lượng tính bằng giây thực đổi ra
// tick theo tốc độ phát (FxInput.life), nên ×1, ×2, ×4 đều đọc được; mọi hạt là hàm của (seed, t).
import { BODY_Z, castSeed, HEAD_Z, palette, aim, type Ctx } from "./ctx.ts";
import { CELL, COLORS, DANGER, GOLD, GOLD_DEEP, L, mix, SEAL, WHITE, type RGB } from "./emit.ts";
import { hitSignature } from "./he.ts";
import { count, type Recipe } from "./recipe.ts";
import type { Cast, FxInput, Point } from "./types.ts";
import {
  arc, beam, bolt, clamp01, dome, easeBack, easeIn, easeOut, glow, groundGlow, motif, pulse, ramp, rays, ring, rnd,
  rune, shade, sprite, sym,
} from "./ve.ts";

const TAU = Math.PI * 2;

/** Số tick nhìn trước (bày trận 5 s cùng khởi chiêu) và nhìn lại (pha 3 dài nhất 2 s trận) khi lấy sự kiện ra chiêu. */
export const LOOK_AHEAD = 170;
export const LOOK_BACK = 50;

interface Shot {
  c: Cast;
  r: Recipe;
  seed: number;
  /** Chân người ra chiêu (hiện tại) và hướng mặt về phía mục tiêu */
  src: Point;
  face: Point;
  /** giây thực × nhịp biến thể → tick */
  S: (s: number) => number;
}

function dir(a: Point, b: Point): Point {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: dx / len, y: dy / len };
}

/** Vẽ đủ bốn pha (trừ trạng thái) của một lần ra chiêu ở thời điểm x.t. */
export function drawCast(x: Ctx, c: Cast, r: Recipe): void {
  const src = x.foot(c.unit);
  if (!src) return;
  const target = aim(x, c, c.tick) ?? { x: src.x + 1, y: src.y };
  const face = dir(src, target);
  const s: Shot = { c, r, seed: castSeed(c) ^ r.seed, src, face, S: (sec) => x.f.life(sec * r.pace) };
  switch (c.skill) {
    case "can_don":
      melee(x, s);
      break;
    case "can_quet":
      sweep(x, s);
      break;
    case "tam_xa":
    case "khong_che":
    case "bua_chu":
      projectile(x, s);
      break;
    case "dien_rong":
      area(x, s);
      break;
    case "tran_phap":
      formation(x, s);
      break;
    case "ho_the":
      guard(x, s);
      break;
    case "hoi_phuc":
      heal(x, s);
      break;
    case "than_phap":
      dash(x, s);
      break;
  }
  if (c.ult) ultimate(x, s);
}

/** Mốc bốn pha của một lần ra chiêu (tick): bắt đầu khởi chiêu, bắt đầu đường bay, chạm trúng, hết pha chạm trúng. */
export interface CastTimeline {
  windup: number;
  travel: number;
  hit: number;
  settle: number;
}

export function castTimeline(f: Pick<FxInput, "index" | "life">, c: Cast, r: Recipe): CastTimeline {
  const S = (sec: number) => f.life(sec * r.pace);
  const hit = c.tick;
  let tl: CastTimeline;
  switch (c.skill) {
    case "can_don":
      tl = { windup: hit - S(0.22), travel: hit - S(0.05), hit, settle: hit + S(0.35) };
      break;
    case "can_quet":
      tl = { windup: hit - S(0.3), travel: hit - S(0.04), hit, settle: hit + S(0.32) };
      break;
    case "tam_xa":
    case "khong_che":
    case "bua_chu": {
      const from = f.index.byId.get(c.unit);
      const to = f.index.byId.get(c.targets[0]);
      const cells = from && to ? Math.abs(from.pos.moving(hit) - to.pos.moving(hit)) / 1000 : 3;
      const launch = hit - Math.max(1, S(flightSeconds(c.skill, cells)));
      const w = S(c.skill === "bua_chu" ? 0.35 : c.skill === "khong_che" ? 0.25 : 0.18);
      tl = { windup: launch - w, travel: launch, hit, settle: hit + S(c.skill === "bua_chu" ? 0.55 : 0.35) };
      break;
    }
    case "dien_rong":
      tl = { windup: c.start ?? hit - S(1), travel: hit - S(0.3), hit, settle: hit + S(0.6) };
      break;
    case "tran_phap":
      tl = { windup: c.start ?? hit - 100, travel: hit - S(0.4), hit, settle: hit + S(0.9) };
      break;
    case "ho_the":
      tl = { windup: hit - S(0.32), travel: hit - S(0.22), hit, settle: hit + S(0.5) };
      break;
    case "hoi_phuc":
      tl = { windup: hit - S(0.36), travel: hit - S(0.26), hit, settle: hit + S(0.9) };
      break;
    case "than_phap":
      tl = { windup: hit - S(0.2), travel: hit - 1, hit, settle: hit + S(0.5) };
      break;
  }
  if (c.ult) {
    tl.windup = Math.min(tl.windup, hit - f.life(0.9));
    tl.settle = Math.max(tl.settle, hit + f.life(1.4));
  }
  return tl;
}

// ---- dùng chung ----------------------------------------------------------------------------------------------------

/** Pha 1 chung: quầng tụ lực ở tay và hạt hệ xoáy vào; chiêu đặc biệt thêm vòng phù văn dưới chân. */
function windup(x: Ctx, s: Shot, from: number, to: number, strength = 1): void {
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
function impact(x: Ctx, s: Shot, id: number, a: number, scale = 1, sigK = 1): void {
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
function trail(x: Ctx, s: Shot, pt: (q: number) => [number, number, number], q: number, len: number, w: number, k: number): void {
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

// ---- cận chiến đơn: vệt chém -------------------------------------------------------------------------------------

function melee(x: Ctx, s: Shot): void {
  const { t, e } = x;
  const { c, r } = s;
  windup(x, s, c.tick - s.S(0.22), c.tick, 0.8);
  const t0 = c.tick - s.S(0.05);
  const dur = s.S(0.26);
  const id = c.targets[0];
  const p = id !== undefined ? x.foot(id, c.tick) : null;
  if (p && t >= t0 && t < t0 + dur) {
    const q = (t - t0) / dur;
    const d = dir(s.src, p);
    const flip = rnd(s.seed, 1) < 0.5 ? 1 : -1;
    const ang = Math.atan2(d.y, d.x) + flip * (0.5 + 0.3 * rnd(s.seed, 2));
    const head = easeOut(q * 1.8);
    const tail = easeIn(q);
    const R = 22 * r.impact;
    for (let i = 0; i < r.streaks; i++) {
      const dq = i * 0.12;
      const hh = clamp01(easeOut((q - dq) * 1.8));
      if (hh <= 0) continue;
      arc(e, L.AIR, p.x - d.x * 10, p.y - d.y * 10, BODY_Z + 2, R + i * 5, ang - flip * 1.25, flip * 2.5, hh, clamp01(easeIn(q - dq)), (i ? 3 : 7) * r.impact, r.main.glow, r.bright, 0.7, 0.9);
    }
    if (r.subs.length) arc(e, L.AIR, p.x - d.x * 10, p.y - d.y * 10, BODY_Z + 2, R - 5, ang - flip * 1.25, flip * 2.5, head, tail, 2.5, r.trail.glow, 0.9 * r.bright, 1, 0.3);
  }
  for (const tid of c.targets) impact(x, s, tid, (t - c.tick) / s.S(0.35));
}

// ---- cận chiến quét: cung chém rộng ------------------------------------------------------------------------------

function sweep(x: Ctx, s: Shot): void {
  const { t, e } = x;
  const { c, r, src, face } = s;
  // Pha 1: lốc vệt mảnh xoay quanh người.
  const w0 = c.tick - s.S(0.3);
  if (t >= w0 && t < c.tick) {
    const q = (t - w0) / (c.tick - w0);
    for (let i = 0; i < 3 + r.streaks; i++) {
      const ang = t * 0.35 + (i * TAU) / (3 + r.streaks);
      sprite(e, L.AIR, CELL.streak, src.x + Math.cos(ang) * 20, src.y + Math.sin(ang) * 7, BODY_Z, 12, 3, ang + Math.PI / 2, i % 2 ? r.trail.glow : r.main.glow, q * r.bright, 1, 0.5);
    }
    groundGlow(e, L.GROUND, src.x, src.y, 24 + 10 * q, 9 + 4 * q, r.main.glow, 0.5 * q * r.bright);
  }
  windup(x, s, w0, c.tick, 0.6);
  // Pha 2: cung chém lan ra trước mặt, dẹt theo mặt đất.
  const t0 = c.tick - s.S(0.04);
  const dur = s.S(0.34);
  if (t >= t0 && t < t0 + dur) {
    const q = (t - t0) / dur;
    const ang = Math.atan2(face.y, face.x);
    // Bán kính theo khoảng cách tới giữa các mục tiêu, để cung quét chạm tới người đứng trước mặt.
    const aimP = aim(x, c, c.tick);
    const reach = aimP ? Math.min(90, Math.max(42, 0.85 * Math.hypot(aimP.x - src.x, aimP.y - src.y))) : 50;
    const R = reach * (0.75 + 0.35 * easeOut(q)) * r.impact;
    for (let i = 0; i <= r.streaks; i++) {
      const dq = i * 0.1;
      const head = clamp01(easeOut((q - dq) * 2));
      if (head <= 0) continue;
      const col = i ? r.trail.glow : r.main.glow;
      arc(e, L.AIR, src.x, src.y, BODY_Z - 4, R - i * 8, ang - 1.3, 2.6, head, clamp01(easeIn(q - dq) * 1.1), (i ? 4 : 12) * r.impact, col, Math.min(1, r.bright * 1.25) * (i ? 0.7 : 1), 0.6, 0.8, 0.7);
    }
  }
  for (const id of c.targets) impact(x, s, id, (t - c.tick) / s.S(0.32), 0.8, 0.8);
}

// ---- tầm xa, khống chế, bùa chú: đạn bay ------------------------------------------------------------------------

/** Thời gian bay (giây thực) theo khoảng cách ô. */
function flightSeconds(skill: Cast["skill"], cells: number): number {
  if (skill === "bua_chu") return Math.min(0.6, Math.max(0.25, 0.22 + 0.04 * cells));
  const base = Math.min(0.42, Math.max(0.1, 0.08 + 0.035 * cells));
  return skill === "khong_che" ? base * 1.15 : base;
}

function projectile(x: Ctx, s: Shot): void {
  const { t, e } = x;
  const { c, r } = s;
  const from = x.f.index.byId.get(c.unit);
  let firstLaunch = Infinity;
  for (let ti = 0; ti < c.targets.length; ti++) {
    const id = c.targets[ti];
    const to = x.f.index.byId.get(id);
    const dst = x.foot(id, c.tick);
    if (!from || !to || !dst) continue;
    const cells = Math.abs(from.pos.moving(c.tick) - to.pos.moving(c.tick)) / 1000;
    const flight = Math.max(1, s.S(flightSeconds(c.skill, cells)));
    const launch = c.tick - flight;
    firstLaunch = Math.min(firstLaunch, launch);
    if (t < launch || t >= c.tick + s.S(0.5)) continue;
    const src0 = x.foot(c.unit, launch) ?? s.src;
    const d = dir(src0, dst);
    const sx = src0.x + d.x * 10;
    const sy = src0.y + d.y * 10;
    const bump = c.skill === "bua_chu" ? 30 : c.skill === "khong_che" ? 8 : 12;
    const pt = (q: number): [number, number, number] => [sx + (dst.x - sx) * q, sy + (dst.y - sy) * q, BODY_Z + 4 - 4 * q + Math.sin(Math.PI * q) * bump];
    if (t < c.tick) {
      const q = (t - launch) / flight;
      const [hx, hy, hz] = pt(q);
      const [px, py, pz] = pt(Math.max(0, q - 0.03));
      const vang = Math.atan2(hy - hz - (py - pz), hx - px);
      if (c.skill === "bua_chu") {
        // Lá bùa xoay, bóng mờ phía sau, tàn lửa hệ.
        for (let k = 2; k >= 0; k--) {
          const qq = q - k * 0.07;
          if (qq < 0) continue;
          const [ax, ay, az] = pt(qq);
          sprite(e, L.AIR, CELL.talisman, ax, ay, az, 7, 12, qq * TAU * 2, WHITE, k ? 0.3 : 1, 0, 0);
        }
        glow(e, L.AIR, hx, hy, hz, 16, r.main.glow, 0.7 * r.bright, 1, 0.3);
        for (let k = 0; k < count(r, 4); k++) {
          const qq = q - 0.05 - k * 0.05;
          if (qq < 0) continue;
          const [ax, ay, az] = pt(qq);
          sprite(e, L.AIR, CELL.dot, ax + sym(s.seed, 500 + k) * 4, ay, az + sym(s.seed, 510 + k) * 4 - k, 2, 2, 0, k % 2 ? r.trail.glow : r.main.glow, r.bright * (1 - k * 0.15), 1, 0.6);
        }
        continue;
      }
      if (c.skill === "khong_che") {
        // Xích bay: các mắt xích nối từ tay tới đầu xích.
        const [x0, y0, z0] = pt(0);
        const len = Math.hypot(hx - x0, hy - hz - (y0 - z0));
        const links = Math.min(18, Math.floor(len / 9));
        for (let k = 1; k <= links; k++) {
          const [lx, ly, lz] = pt((q * k) / (links + 1));
          sprite(e, L.AIR, CELL.link, lx, ly, lz, 4.5, 4.5, vang + (k % 2 ? 0 : Math.PI / 2), mix(r.main.glow, WHITE, 0.5), r.bright, 0.2, 0.2);
        }
        sprite(e, L.AIR, CELL.spark, hx, hy, hz, 10, 4, vang, r.main.glow, r.bright, 1, 1);
        glow(e, L.AIR, hx, hy, hz, 12, r.main.glow, 0.8 * r.bright, 1, 0.5);
        continue;
      }
      // Tầm xa: kiếm khí (Kim là phi kiếm), Lôi là tia sét; Tốc bắn ba vệt mảnh, Bền là cầu khí to bay chậm.
      const lanes = r.streaks;
      for (let ln = 0; ln < lanes; ln++) {
        const off = lanes > 1 ? (ln - (lanes - 1) / 2) * 7 : 0;
        const dq = ln ? 0.05 * ln : 0;
        const qq = q - dq;
        if (qq <= 0) continue;
        const ox = -d.y * off * Math.sin(Math.PI * qq);
        const oy = d.x * off * Math.sin(Math.PI * qq);
        const P = (u: number): [number, number, number] => {
          const [a1, b1, c1] = pt(u);
          return [a1 + ox, b1 + oy, c1];
        };
        const [ax, ay, az] = P(qq);
        if (r.el === "loi") {
          const [tx, ty, tz] = P(Math.max(0, qq - 0.4));
          bolt(e, L.AIR, tx, ty, tz, ax, ay, az, s.seed ^ (Math.floor(t) * 131) ^ ln, r.main.glow, r.bright, lanes > 1 ? 1.4 : 2, 9, 5);
        } else {
          trail(x, s, P, qq, r.smooth ? 0.45 : 0.32, lanes > 1 ? 2.2 : 3.4 * r.impact, r.bright);
        }
        if (r.el === "kim") sprite(e, L.AIR, CELL.sword, ax, ay, az, 13 * r.impact, 13 * r.impact, vang, WHITE, r.bright, 0.4, 0.4);
        else if (r.smooth) glow(e, L.AIR, ax, ay, az, 13, r.main.glow, r.bright, 0.7, 0.8, 0.4);
        else sprite(e, L.AIR, CELL.spark, ax, ay, az, (lanes > 1 ? 10 : 15) * r.impact, (lanes > 1 ? 3 : 5) * r.impact, vang, r.main.glow, r.bright, 1, 1);
        glow(e, L.AIR, ax, ay, az, 10, r.main.glow, 0.7 * r.bright, 1, 0.6);
      }
      // hạt hệ phụ rơi khỏi đuôi
      for (let k = 0; k < count(r, 2); k++) {
        const qq = q - 0.12 - k * 0.1;
        if (qq <= 0) continue;
        const [ax, ay, az] = pt(qq);
        const el = r.subs[k % Math.max(1, r.subs.length)] ?? r.el;
        motif(e, L.AIR, el, ax, ay, az - (q - qq) * 20, 4, qq * 8, COLORS[el].glow, r.bright * (1 - (q - qq) * 2), 0.5);
      }
    }
    // Pha 3
    const a = (t - c.tick) / s.S(c.skill === "bua_chu" ? 0.55 : 0.35);
    if (a >= 0 && a < 1) {
      if (c.skill === "bua_chu") seal(x, s, dst, a);
      if (c.skill === "khong_che") ring(e, L.BODY, dst.x, dst.y, 30 * (1 - easeOut(a)) + 14, (30 * (1 - easeOut(a)) + 14) * 0.5, mix(r.main.glow, WHITE, 0.4), r.bright * (1 - a), { width: 3, z: BODY_Z, dashes: 12, duty: 0.7, add: 0.5 });
      impact(x, s, id, a, c.skill === "bua_chu" ? 1.3 : 1);
    }
  }
  if (Number.isFinite(firstLaunch)) {
    const w = s.S(c.skill === "bua_chu" ? 0.35 : c.skill === "khong_che" ? 0.25 : 0.18);
    windup(x, s, firstLaunch - w, firstLaunch, c.skill === "tam_xa" ? 0.7 : 1);
    if (c.skill === "bua_chu" && t >= firstLaunch - w && t < firstLaunch) {
      // lá bùa hiện ra trong tay
      const q = (t - (firstLaunch - w)) / w;
      sprite(e, L.AIR, CELL.talisman, s.src.x + s.face.x * 12, s.src.y + s.face.y * 12, BODY_Z + 10 + 6 * q, 7 * easeBack(q), 12 * easeBack(q), Math.sin(t * 0.4) * 0.2, WHITE, 1, 0, 0);
      glow(e, L.AIR, s.src.x + s.face.x * 12, s.src.y + s.face.y * 12, BODY_Z + 12, 14, SEAL, 0.6 * q, 1);
    }
  }
}

/** Bùa chú trúng: ấn son đóng xuống mục tiêu rồi nổ thành mảnh giấy. */
function seal(x: Ctx, s: Shot, p: Point, a: number): void {
  const { e } = x;
  const { r } = s;
  const stamp = easeOut(a / 0.18);
  const sc = 2.2 - 1.2 * stamp;
  sprite(e, L.AIR, CELL.seal, p.x, p.y, BODY_Z + 6, 12 * sc, 12 * sc, 0, WHITE, a < 0.55 ? 1 : 1 - (a - 0.55) / 0.45, 0, 0);
  rune(e, L.GROUND, p.x, p.y, 26 * r.impact, 26 * r.impact * 0.4, SEAL, 0.9 * (1 - a), 0.785, 1, 2, 1, 0.2);
  if (a > 0.3) {
    const b = (a - 0.3) / 0.7;
    glow(e, L.AIR, p.x, p.y, BODY_Z, 30 * r.impact, mix(SEAL, r.main.glow, 0.5), (1 - b) * r.bright, 1, 0.5);
    for (let i = 0; i < count(r, 6); i++) {
      const ang = rnd(s.seed, 520 + i) * TAU;
      const dist = 36 * easeOut(b) * r.impact;
      sprite(e, L.AIR, CELL.talisman, p.x + Math.cos(ang) * dist, p.y + Math.sin(ang) * dist * 0.6, BODY_Z + 10 * b - 20 * b * b + 10, 3.5, 6, ang + b * 8, WHITE, 1 - b, 0, 0);
    }
  }
}

// ---- diện rộng: vòng báo trước, vận công, nổ ------------------------------------------------------------------------

function area(x: Ctx, s: Shot): void {
  const { t, e } = x;
  const { c, r, src } = s;
  if (c.center === undefined || !c.radius) {
    for (const id of c.targets) impact(x, s, id, (t - c.tick) / s.S(0.45));
    return;
  }
  const z = x.f.zone(c.center, c.radius);
  const zy = z.y + x.f.size / 2;
  const start = c.start ?? c.tick - s.S(1);
  // Pha 1: vòng báo trước trên đất, phủ dần theo tiến độ vận công; người ra chiêu tụ lực.
  if (t >= start && t < c.tick) {
    const q = (t - start) / Math.max(1, c.tick - start);
    const beat = 0.6 + 0.4 * Math.sin(t * (0.4 + 1.2 * q));
    ring(e, L.GROUND, z.x, zy, z.rx, z.ry, r.main.glow, (0.55 + 0.35 * beat) * r.bright, { width: 3, dashes: 28, phase: -t * 0.01, duty: 0.65, fill: 0.16 * q, halo: 0.25 });
    rune(e, L.GROUND, z.x, zy, z.rx * 0.82, z.ry * 0.82, r.trail.glow, 0.6 * r.bright * ramp(q, 0, 0.25), -t * 0.015, q, 3, 1, 0.8);
    ring(e, L.GROUND, z.x, zy, z.rx * q, z.ry * q, r.main.glow, 0.5 * r.bright, { width: 2, add: 0.8 });
    windup(x, s, start, c.tick, 1.2);
    glow(e, L.AIR, src.x, src.y, HEAD_Z + 6, 10 + 14 * q, r.main.glow, (0.3 + 0.6 * q) * r.bright, 1, 0.6);
  }
  // Pha 2: cầu khí bay vòng từ người ra chiêu xuống tâm vùng.
  const fl = s.S(0.3);
  if (t >= c.tick - fl && t < c.tick) {
    const q = (t - (c.tick - fl)) / fl;
    const h = HEAD_Z + 6 + 90 * Math.sin(Math.PI * q) * (1 - q * 0.4);
    const px = src.x + (z.x - src.x) * q;
    const py = src.y + (zy - src.y) * q;
    const pz = h * (1 - q) + 0 * q;
    glow(e, L.AIR, px, py, pz, 18 * r.impact, r.main.glow, r.bright, 1, 1);
    for (let k = 1; k <= 4; k++) {
      const qq = Math.max(0, q - k * 0.06);
      const hh = HEAD_Z + 6 + 90 * Math.sin(Math.PI * qq) * (1 - qq * 0.4);
      glow(e, L.AIR, src.x + (z.x - src.x) * qq, src.y + (zy - src.y) * qq, hh * (1 - qq), 12 - k * 2, k % 2 ? r.trail.glow : r.main.glow, (0.6 - k * 0.12) * r.bright, 1, 0.3);
    }
  }
  // Pha 3: chớp, sóng xung kích, mảnh hệ văng lên khắp vùng.
  const a = (t - c.tick) / s.S(0.6);
  if (a >= 0 && a < 1) {
    groundGlow(e, L.GROUND, z.x, zy, z.rx * 1.1, z.ry * 1.1, r.main.glow, r.bright * pulse(a, 0.06), 1);
    ring(e, L.GROUND, z.x, zy, z.rx * (0.3 + 0.85 * easeOut(a)) * r.impact, z.ry * (0.3 + 0.85 * easeOut(a)) * r.impact, r.main.glow, r.bright * (1 - a), { width: 8 * (1 - a) + 1, halo: 0.6, add: 0.85 });
    if (r.subs.length) ring(e, L.GROUND, z.x, zy, z.rx * (0.2 + 0.7 * easeOut(a)), z.ry * (0.2 + 0.7 * easeOut(a)), r.trail.glow, 0.8 * r.bright * (1 - a), { width: 4 * (1 - a) + 1, add: 0.9 });
    const n = count(r, 14);
    for (let i = 0; i < n; i++) {
      const ang = rnd(s.seed, 600 + i) * TAU;
      const rr = Math.sqrt(rnd(s.seed, 610 + i)) * 0.9;
      const px = z.x + Math.cos(ang) * z.rx * rr;
      const py = zy + Math.sin(ang) * z.ry * rr;
      const up = 50 * (0.5 + rnd(s.seed, 620 + i));
      const h = up * a * (1.2 - a);
      const el = i % 4 === 3 && r.subs[0] ? r.subs[0] : r.el;
      motif(e, L.AIR, el, px, py, h + 2, 5 + 3 * rnd(s.seed, 630 + i), a * 6 + ang, COLORS[el].glow, r.bright * (1 - a), 0.6);
    }
    if (r.tier >= 2) rays(e, L.GROUND, z.x, zy, 0, Math.max(z.rx, z.ry), r.main.glow, 0.5 * r.bright * pulse(a, 0.1), 12, a, 12, 0.3, z.ry / Math.max(z.rx, z.ry));
  }
  for (const id of c.targets) impact(x, s, id, (t - c.tick) / s.S(0.45), 0.8, 0.7);
}

// ---- trận pháp: trận đồ xoay trên đất, cột sáng khi kích, tuyệt sát -----------------------------------------------

function formation(x: Ctx, s: Shot): void {
  const { t, e } = x;
  const { c, r, src } = s;
  if (c.center === undefined || !c.radius) {
    for (const id of c.targets) impact(x, s, id, (t - c.tick) / s.S(0.5));
    return;
  }
  const z = x.f.zone(c.center, c.radius);
  const zy = z.y + x.f.size / 2;
  const start = c.start ?? c.tick - 100;
  const nodes = 8;
  const node = (i: number, rot: number) => {
    const ang = rot + (i * TAU) / nodes - Math.PI / 2;
    return { x: z.x + Math.cos(ang) * z.rx * 0.97, y: zy + Math.sin(ang) * z.ry * 0.97, ang };
  };
  // Pha 1: bày trận, trận đồ sáng dần theo vòng; tám trận nhãn bật cột sáng nhỏ khi phần sáng đi qua.
  if (t >= start && t < c.tick + s.S(0.9)) {
    const q = clamp01((t - start) / Math.max(1, c.tick - start));
    const after = clamp01((t - c.tick) / s.S(0.9));
    const rot = t * 0.012;
    const flare = after > 0 ? pulse(after, 0.08) : 0;
    // Lúc bày trận giữ trong để vẫn thấy người đứng trên trận đồ; lúc kích bùng sáng ngắn.
    const alpha = (after > 0 ? (1 - after) * 0.8 + flare * 0.5 : 0.32 + 0.28 * ramp(q, 0, 0.15) + 0.15 * q) * r.bright;
    rune(e, L.GROUND, z.x, zy, z.rx, z.ry, r.main.glow, alpha, rot, after > 0 ? 1 : q, 0, 1 + flare, 0.75);
    if (r.subs.length) rune(e, L.GROUND, z.x, zy, z.rx * 0.5, z.ry * 0.5, r.trail.glow, alpha * 0.7, -rot * 2, after > 0 ? 1 : q, 3, 1, 0.8);
    groundGlow(e, L.GROUND, z.x, zy, z.rx, z.ry, r.main.glow, 0.12 * q * r.bright + 0.4 * flare);
    if (after <= 0) {
      for (let i = 0; i < nodes; i++) {
        const on = ramp(q, i / nodes, i / nodes + 0.05);
        if (on <= 0) continue;
        const n = node(i, 0);
        beam(e, L.BODY, n.x, n.y, 0, n.x, n.y, 18 + 10 * on, 3, r.main.glow, 0.9 * on * r.bright, 0, 1, 0.6, 0.2, 0.6);
        glow(e, L.GROUND, n.x, n.y, 0, 8, r.main.glow, 0.7 * on * r.bright, 1, 0.5);
      }
      // phù văn bay lên từ trận đồ
      const nr = count(r, 6);
      for (let i = 0; i < nr; i++) {
        const ph = ((t - start) / 40 + i / nr) % 1;
        const ang = rnd(s.seed, 700 + i) * TAU;
        const rr = 0.3 + 0.6 * rnd(s.seed, 710 + i);
        sprite(e, L.AIR, CELL.rune0 + (i % 4), z.x + Math.cos(ang) * z.rx * rr, zy + Math.sin(ang) * z.ry * rr, 4 + 40 * ph, 5, 5, 0, r.main.glow, q * (1 - ph) * r.bright, 0.8, 0.3);
      }
      // sợi linh lực từ người bày trận tới tâm trận
      beam(e, L.GROUND, src.x, src.y, BODY_Z, z.x, zy, 2, 1.6, r.main.glow, 0.5 * r.bright, 0.2 * r.bright * (0.6 + 0.4 * Math.sin(t * 0.7)), 1, 0.3, 0, 0.8);
      windup(x, s, start, c.tick, 1);
    }
  }
  // Pha 2: tám trận nhãn bắn linh lực về tâm.
  const fl = s.S(0.4);
  if (t >= c.tick - fl && t < c.tick) {
    const q = (t - (c.tick - fl)) / fl;
    for (let i = 0; i < nodes; i++) {
      const n = node(i, 0);
      const hx = n.x + (z.x - n.x) * easeIn(q);
      const hy = n.y + (zy - n.y) * easeIn(q);
      beam(e, L.GROUND, n.x + (z.x - n.x) * Math.max(0, easeIn(q) - 0.25), n.y + (zy - n.y) * Math.max(0, easeIn(q) - 0.25), 2, hx, hy, 2, 2.5, r.main.glow, 0.2, r.bright, 1, 0.6, 0.4, 0.5);
    }
    glow(e, L.GROUND, z.x, zy, 0, 20 + 30 * q, r.main.glow, q * r.bright, 1, 0.6);
  }
  // Pha 3: cột sáng lớn giữa trận, cột sáng trên từng mục tiêu, chữ Trận; tuyệt sát trên ai bị hạ đúng lúc kích.
  const a = (t - c.tick) / s.S(0.9);
  if (a >= 0 && a < 1) {
    const grow = easeOut(a / 0.2);
    const fade = 1 - ramp(a, 0.4, 1);
    beam(e, L.AIR, z.x, zy, 0, z.x, zy, 260 * grow, 16 * r.impact, r.main.glow, fade * r.bright, 0, 1, 0.7, 0.3, 0.6);
    glow(e, L.AIR, z.x, zy, 30, 70 * r.impact, r.main.glow, pulse(a, 0.06) * r.bright, 1, 0.8);
    sprite(e, L.AIR, CELL.glyphPhong, z.x, zy, 90 + 20 * a, 20, 20, 0, mix(r.main.glow, WHITE, 0.5), pulse(a, 0.15) * r.bright, 0.4, 0.2);
    for (const id of c.targets) {
      const p = x.foot(id, c.tick);
      if (!p) continue;
      beam(e, L.AIR, p.x, p.y, 0, p.x, p.y, 150 * grow, 8 * r.impact, r.trail.glow, fade * r.bright, 0, 1, 0.8, 0.4, 0.6);
      const ut = x.f.index.byId.get(id);
      if (ut && ut.death === c.tick) execution(x, s, p, a);
    }
  }
  for (const id of c.targets) impact(x, s, id, (t - c.tick) / s.S(0.5), 1.1, 0.8);
}

/** Tuyệt sát: chém chéo đỏ thẫm, chữ Tuyệt đè lên mục tiêu. */
function execution(x: Ctx, s: Shot, p: Point, a: number): void {
  const { e } = x;
  const k = pulse(a, 0.1);
  const cut = easeOut(a / 0.15);
  beam(e, L.AIR, p.x - 26, p.y, BODY_Z + 30, p.x - 26 + 52 * cut, p.y, BODY_Z + 30 - 52 * cut, 3, DANGER, k, k, 0.4, 0.7, 0.3, 0.3);
  beam(e, L.AIR, p.x + 26, p.y, BODY_Z + 30, p.x + 26 - 52 * cut, p.y, BODY_Z + 30 - 52 * cut, 3, DANGER, k, k, 0.4, 0.7, 0.3, 0.3);
  glow(e, L.BODY, p.x, p.y, BODY_Z, 34, [0.25, 0.02, 0.05], 0.8 * k, 0);
  sprite(e, L.AIR, CELL.glyphTuyet, p.x, p.y, HEAD_Z + 26 - 10 * cut, 16, 16, 0, SEAL, k, 0, 0.1);
  void s;
}

// ---- hộ thể: khiên bán cầu ------------------------------------------------------------------------------------------

function guard(x: Ctx, s: Shot): void {
  const { t, e } = x;
  const { c, r, src } = s;
  const w0 = c.tick - s.S(0.32);
  if (t >= w0 && t < c.tick) {
    const q = (t - w0) / (c.tick - w0);
    ring(e, L.GROUND, src.x, src.y, 18 + 6 * q, (18 + 6 * q) * 0.4, r.main.glow, q * r.bright, { width: 2, dashes: 6, duty: 0.8, phase: t * 0.02, halo: 0.3 });
  }
  windup(x, s, w0, c.tick, 0.8);
  const fl = s.S(0.22);
  for (const id of c.targets) {
    const p = x.foot(id, c.tick);
    if (!p) continue;
    if (t >= c.tick - fl && t < c.tick && id !== c.unit) {
      const q = (t - (c.tick - fl)) / fl;
      const hx = src.x + (p.x - src.x) * easeOut(q);
      const hy = src.y + (p.y - src.y) * easeOut(q);
      beam(e, L.AIR, src.x, src.y, BODY_Z, hx, hy, BODY_Z + 20 * Math.sin(Math.PI * q), 2, r.main.glow, 0.1, r.bright, 1, 0.6, 0.6, 0.5);
    }
    const a = (t - c.tick) / s.S(0.5);
    if (a >= 0 && a < 1) {
      const pop = easeBack(a / 0.35);
      dome(e, L.BODY, p.x, p.y + 2, 27 * pop * r.impact, r.main.glow, (1 - 0.5 * a) * r.bright, a * 1.5, 1, 1.15);
      ring(e, L.GROUND, p.x, p.y + 2, 30 * pop, 30 * pop * 0.36, r.trail.glow, (1 - a) * r.bright, { width: 3, halo: 0.6 });
      for (let i = 0; i < count(r, 5); i++) {
        const ang = rnd(s.seed ^ id, 800 + i) * TAU;
        const rr = 34 * (1 - easeOut(a));
        sprite(e, L.AIR, CELL.star, p.x + Math.cos(ang) * rr, p.y + Math.sin(ang) * rr * 0.4, BODY_Z + Math.sin(ang) * rr * 0.5, 4, 4, a * 4, r.main.glow, (1 - a) * r.bright, 1, 0.6);
      }
    }
  }
}

// ---- hồi phục: hạt sáng bay lên ------------------------------------------------------------------------------------

function heal(x: Ctx, s: Shot): void {
  const { t, e } = x;
  const { c, r, src } = s;
  const w0 = c.tick - s.S(0.36);
  if (t >= w0 && t < c.tick) {
    const q = (t - w0) / (c.tick - w0);
    for (let i = 0; i < count(r, 5); i++) {
      const ph = (q + i / 5) % 1;
      const ang = rnd(s.seed, 900 + i) * TAU;
      sprite(e, L.AIR, CELL.star, src.x + Math.cos(ang) * 14, src.y + Math.sin(ang) * 5, 6 + ph * 50, 3.5, 3.5, 0, r.main.glow, q * (1 - ph) * r.bright, 1, 0.6);
    }
    sprite(e, L.AIR, CELL.cross, src.x, src.y, HEAD_Z + 16 + 4 * q, 7 * q, 7 * q, 0, mix(r.main.glow, WHITE, 0.3), q * r.bright, 0.6, 0.3);
  }
  windup(x, s, w0, c.tick, 0.8);
  const fl = s.S(0.26);
  for (const id of c.targets) {
    const p = x.foot(id, c.tick);
    if (!p) continue;
    if (t >= c.tick - fl && t < c.tick && id !== c.unit) {
      const q = (t - (c.tick - fl)) / fl;
      for (let k = 0; k < 3; k++) {
        const qq = clamp01(q - k * 0.12);
        const bend = sym(s.seed ^ id, 950 + k) * 24;
        const d = dir(src, p);
        const mx = (src.x + p.x) / 2 - d.y * bend;
        const my = (src.y + p.y) / 2 + d.x * bend;
        const bx = (1 - qq) * (1 - qq) * src.x + 2 * (1 - qq) * qq * mx + qq * qq * p.x;
        const by = (1 - qq) * (1 - qq) * src.y + 2 * (1 - qq) * qq * my + qq * qq * p.y;
        sprite(e, L.AIR, CELL.star, bx, by, BODY_Z + 24 * Math.sin(Math.PI * qq), 5, 5, qq * 4, r.main.glow, r.bright, 1, 0.7);
      }
    }
    const a = (t - c.tick) / s.S(0.9);
    if (a < 0 || a >= 1) continue;
    const bloom = easeOut(a / 0.3);
    ring(e, L.GROUND, p.x, p.y, 10 + 18 * bloom, (10 + 18 * bloom) * 0.36, r.main.glow, (1 - a) * r.bright, { width: 2.5, fill: 0.25, halo: 0.5 });
    beam(e, L.BODY, p.x, p.y, 0, p.x, p.y, 70 * bloom, 11, r.main.glow, 0.45 * (1 - a) * r.bright, 0, 1, 0.2, 0, 1);
    const n = count(r, 8);
    for (let i = 0; i < n; i++) {
      const ph = clamp01(a * 1.3 - (i / n) * 0.3);
      const ang = rnd(s.seed ^ id, 960 + i) * TAU + ph * 3;
      const el = i % 3 === 2 && r.subs[0] ? r.subs[0] : r.el;
      sprite(e, L.AIR, i % 4 === 0 ? CELL.cross : CELL.star, p.x + Math.cos(ang) * 14, p.y + Math.sin(ang) * 5, 4 + ph * 58, i % 4 === 0 ? 4 : 3.5, i % 4 === 0 ? 4 : 3.5, 0, COLORS[el].glow, (1 - ph) * r.bright, 1, 0.6);
    }
  }
}

// ---- thân pháp: lướt kèm bóng mờ ---------------------------------------------------------------------------------

function dash(x: Ctx, s: Shot): void {
  const { t, e } = x;
  const { c, r } = s;
  const before = x.foot(c.unit, c.tick - 1);
  const after = x.foot(c.unit, c.tick);
  if (!before || !after) return;
  const d = dir(before, after);
  // Pha 1: hạ thấp người, tụ lực dưới chân.
  const w0 = c.tick - s.S(0.2);
  if (t >= w0 && t < c.tick - 1) {
    const q = (t - w0) / Math.max(1, c.tick - 1 - w0);
    groundGlow(e, L.GROUND, before.x, before.y, 22, 8, r.main.glow, 0.7 * q * r.bright);
    for (let i = 0; i < 3; i++) sprite(e, L.AIR, CELL.streak, before.x - d.x * (14 + i * 8), before.y - d.y * (14 + i * 8) + (i - 1) * 6, BODY_Z, 10, 2, Math.atan2(d.y, d.x), r.trail.glow, q * r.bright, 1, 0.4);
  }
  // Pha 2: bóng mờ dọc đường lướt (Tốc nhiều bóng hơn), vệt tốc độ.
  const a = (t - (c.tick - 1)) / s.S(0.5);
  if (a >= 0 && a < 1) {
    const ghosts = 3 + 2 * r.streaks;
    for (let i = 0; i < ghosts; i++) {
      const q = (i + 0.5) / ghosts;
      const show = clamp01((t - (c.tick - 1)) / Math.max(0.01, q)) ;
      const gx = before.x + (after.x - before.x) * q;
      const gy = before.y + (after.y - before.y) * q;
      const col = i % 2 ? r.trail.glow : r.main.glow;
      sprite(e, L.BODY, CELL.ghost, gx, gy, 28, 13, 28, 0, col, show * (1 - a) * (0.15 + 0.5 * q) * r.bright, 0.55, 0.2);
    }
    const ang = Math.atan2(after.y - before.y, after.x - before.x);
    for (let i = 0; i < 2 + r.streaks; i++) {
      const off = sym(s.seed, 1000 + i) * 14;
      beam(e, L.AIR, before.x - d.y * off, before.y + d.x * off, BODY_Z + off * 0.5, after.x - d.x * 10 - d.y * off, after.y - d.y * 10 + d.x * off, BODY_Z + off * 0.5, 1.4, r.main.glow, 0, (1 - a) * r.bright, 1, 0.6, 0.5, 0.5);
    }
    sprite(e, L.GROUND, CELL.smoke, before.x, before.y, 4, 16 + 10 * a, 9 + 4 * a, ang, WHITE, 0.4 * (1 - a), 0);
  }
  // Pha 3: chém chữ thập ở mục tiêu.
  const id = c.targets[0];
  const p = id !== undefined ? x.foot(id, c.tick) : null;
  const b = (t - c.tick) / s.S(0.3);
  if (p && b >= 0 && b < 1) {
    const ang = Math.atan2(p.y - after.y, p.x - after.x);
    for (const sgn of [1, -1]) {
      const tq = clamp01(b * 1.4 - (sgn < 0 ? 0.25 : 0));
      if (tq <= 0) continue;
      arc(e, L.AIR, p.x, p.y, BODY_Z, 22 * r.impact, ang + sgn * 0.8 - 1.2, 2.4, easeOut(tq * 1.6), easeIn(tq), 6 * r.impact, sgn > 0 ? r.main.glow : r.trail.glow, r.bright, 0.7, 0.9);
    }
  }
  if (id !== undefined) impact(x, s, id, b, 1.1);
}

// ---- chiêu cuối tông chủ -------------------------------------------------------------------------------------------

function ultimate(x: Ctx, s: Shot): void {
  const { t, e } = x;
  const { c, r, src } = s;
  const lead = x.f.life(0.9);
  const dur = x.f.life(1.4);
  if (t < c.tick - lead || t >= c.tick + dur) return;
  const gold = mix(GOLD, r.main.glow, 0.25);
  if (t < c.tick) {
    // Tụ lực: tối màn trừ quanh tông chủ, phù trận vàng nở dưới chân, linh khí khắp sân xoáy về.
    const q = (t - (c.tick - lead)) / lead;
    shade(e, L.GROUND, src.x, src.y, 0, 2000, 0.42 * easeOut(q), 60, 220);
    const rad = 30 + 60 * easeOut(q);
    rune(e, L.GROUND, src.x, src.y, rad, rad * 0.4, gold, 0.95 * easeOut(q), t * 0.05, 1, 1, 1.4, 0.8);
    glow(e, L.AIR, src.x, src.y, BODY_Z, 20 + 30 * q, gold, 0.4 + 0.5 * q, 1, 0.7);
    beam(e, L.AIR, src.x, src.y, 0, src.x, src.y, 160 * q, 6 + 6 * q, gold, 0.5 * q, 0, 1, 0.5, 0.3, 0.8);
    const n = count(r, 22);
    for (let i = 0; i < n; i++) {
      const ph = (q * 1.6 + i / n) % 1;
      const ang = rnd(s.seed, 1100 + i) * TAU + q * 2;
      const rr = 180 * (1 - ph);
      sprite(e, L.AIR, CELL.spark, src.x + Math.cos(ang) * rr, src.y + Math.sin(ang) * rr * 0.6, BODY_Z + 30 * (1 - ph), 9, 2.5, ang, gold, ph * q, 1, 0.8);
    }
    return;
  }
  // Bùng: chớp vàng, tia toả, sóng xung kích quét sân, cột sáng trời; kiếm quang giáng xuống từng mục tiêu.
  const a = (t - c.tick) / dur;
  shade(e, L.GROUND, src.x, src.y, 0, 2000, 0.42 * (1 - easeOut(a / 0.5)), 60 + 300 * a, 220 + 400 * a);
  // Chớp vàng ngắn (tắt hẳn sau khoảng 0,3 s) để không trắng xoá cả sân.
  glow(e, L.AIR, src.x, src.y, BODY_Z, 150, mix(gold, WHITE, 0.15), pulse(a, 0.03) ** 2.5 * 0.7, 1, 0.15);
  rays(e, L.AIR, src.x, src.y, BODY_Z, 300, gold, 0.6 * (1 - a) ** 1.5, 14, a * 0.8, 14, 0.5);
  const wave = easeOut(a);
  ring(e, L.GROUND, src.x, src.y, 40 + 420 * wave, (40 + 420 * wave) * 0.45, gold, 1 - a, { width: 10 * (1 - a) + 2, halo: 0.8, add: 0.9 });
  ring(e, L.GROUND, src.x, src.y, 30 + 300 * wave, (30 + 300 * wave) * 0.45, r.main.glow, 0.8 * (1 - a), { width: 5 * (1 - a) + 1, add: 0.9 });
  beam(e, L.AIR, src.x, src.y, 0, src.x, src.y, 520, 26 * (1 - 0.6 * a), gold, 1 - a, 0, 1, 0.7, 0.3, 0.6);
  rune(e, L.GROUND, src.x, src.y, 90, 36, gold, 1 - a, t * 0.05, 1, 1, 2, 0.8);
  for (const id of c.targets) {
    const p = x.foot(id, c.tick);
    if (!p) continue;
    const fall = easeIn(a / 0.22);
    if (a < 0.22) beam(e, L.AIR, p.x, p.y, 300, p.x, p.y, 300 - 300 * fall, 7, gold, 0.3, 1, 1, 0.9, 0.3, 0.4);
    const hit = clamp01((a - 0.2) / 0.5);
    if (hit > 0 && hit < 1) {
      glow(e, L.AIR, p.x, p.y, BODY_Z, 36 * easeOut(hit) + 10, mix(gold, WHITE, 0.25), 0.7 * pulse(hit, 0.06), 1, 0.4);
      ring(e, L.GROUND, p.x, p.y, 10 + 50 * easeOut(hit), (10 + 50 * easeOut(hit)) * 0.4, gold, 1 - hit, { width: 4 * (1 - hit) + 1, halo: 0.5 });
      sprite(e, L.AIR, CELL.sword, p.x, p.y, BODY_Z + 30 - 26 * easeOut(hit / 0.2), 22, 22, -Math.PI / 2, mix(gold, WHITE, 0.5), 1 - hit, 0.5, 0.6);
    }
  }
  const n = count(r, 24);
  for (let i = 0; i < n; i++) {
    const ang = rnd(s.seed, 1200 + i) * TAU;
    const rr = 40 + 260 * rnd(s.seed, 1210 + i) * wave;
    sprite(e, L.AIR, CELL.dot, src.x + Math.cos(ang) * rr, src.y + Math.sin(ang) * rr * 0.55, 10 + 80 * a * rnd(s.seed, 1220 + i), 2.2, 2.2, 0, i % 3 ? gold : GOLD_DEEP, 1 - a, 1, 0.8);
  }
}

export type { RGB };

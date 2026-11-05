// Dáng chiêu theo hệ (đợt 2026-11-04, người dùng chọn "Đợt theo hệ"): mỗi hệ một dáng cho chiêu vùng và vài loại chiêu
// hợp tính hệ (bảng BY_ELEMENT ở dang_chon.ts). Như dang.ts: pha 1–2 trước tick ra chiêu, chạm đúng tick sim tính đòn,
// nét hệ và trạng thái kéo dài vẫn giữ; mọi hạt là hàm của (seed, t).
import { aim, BODY_Z, type Ctx } from "./ctx.ts";
import type { CastTimeline } from "./chieu.ts";
import { areaOf, dir, flightSeconds, hits, inZone, warning, windup, type Shot } from "./chung.ts";
import type { Dang } from "./dang_chon.ts";
import { BLACK, CELL, COLORS, GOLD, L, mix, WHITE, type RGB } from "./emit.ts";
import { count } from "./recipe.ts";
import type { Cast, Point } from "./types.ts";
import {
  arc, beam, clamp01, easeBack, easeIn, easeOut, glow, groundGlow, motif, pulse, ramp, rays, ring, rnd, sprite, sym,
} from "./ve.ts";

const TAU = Math.PI * 2;
const HEAL_PINK: RGB = [1, 0.72, 0.82];
const VOID: RGB = [0.07, 0.03, 0.1];

export type HeDang =
  | "hoa_long" | "luu_tinh" | "thuy_long" | "song_than" | "re_cay" | "hoa_no" | "phat_thu" | "thanh_quang" | "liet_nhat"
  | "nguyet_thuc" | "quy_thu" | "bao_tuyet" | "kim_cuong_xu";

/** Lúc bắt đầu vận công (chiêu vùng) hoặc mốc thay thế cho chiêu không vận. */
function channel(s: Shot, fallback: number): number {
  return s.c.start ?? s.c.tick - s.S(fallback);
}

/** Tụ lực của đạn gốc theo loại chiêu (khớp castTimeline của chieu.ts). */
function shotWindup(s: Shot): number {
  return s.S(s.c.skill === "bua_chu" ? 0.35 : s.c.skill === "khong_che" ? 0.25 : 0.18);
}

/** Mốc pha các dáng theo hệ; tl là mốc gốc của loại chiêu. */
export function heTimeline(d: HeDang, c: Cast, S: (s: number) => number, tl: CastTimeline): CastTimeline {
  const hit = c.tick;
  const ch = (f: number) => c.start ?? hit - S(f);
  switch (d) {
    case "hoa_long":
      return { ...tl, settle: hit + S(0.45) };
    case "luu_tinh":
      return { windup: ch(0.45), travel: hit - S(0.35), hit, settle: hit + S(0.7) };
    case "thuy_long":
      return { windup: ch(0.45), travel: hit - S(0.4), hit, settle: hit + S(0.7) };
    case "song_than":
      return { windup: hit - S(0.4), travel: hit - S(0.16), hit, settle: hit + S(0.4) };
    case "re_cay":
      return { windup: ch(0.4), travel: hit - S(0.2), hit, settle: hit + S(0.6) };
    case "hoa_no":
    case "thanh_quang":
      return { windup: hit - S(0.36), travel: hit - S(0.26), hit, settle: hit + S(0.9) };
    case "phat_thu":
      return { windup: ch(0.7), travel: hit - S(0.15), hit, settle: hit + S(0.8) };
    case "liet_nhat":
      return { windup: ch(0.7), travel: hit - S(0.3), hit, settle: hit + S(0.8) };
    case "nguyet_thuc":
      return { windup: ch(0.45), travel: hit - S(0.3), hit, settle: hit + S(0.7) };
    case "quy_thu":
      return { windup: ch(0.35), travel: hit - S(0.25), hit, settle: hit + S(0.7) };
    case "bao_tuyet":
      return { windup: ch(0.45), travel: hit - S(0.3), hit, settle: hit + S(0.7) };
    case "kim_cuong_xu":
      return { windup: hit - S(0.7), travel: hit - S(0.12), hit, settle: hit + S(0.8) };
  }
}

export function drawHeDang(x: Ctx, s: Shot, d: HeDang): boolean {
  switch (d) {
    case "hoa_long":
      return hoaLong(x, s);
    case "luu_tinh":
      return luuTinh(x, s);
    case "thuy_long":
      return thuyLong(x, s);
    case "song_than":
      return songThan(x, s);
    case "re_cay":
      return reCay(x, s);
    case "hoa_no":
      return hoaNo(x, s);
    case "phat_thu":
      return phatThu(x, s);
    case "thanh_quang":
      return thanhQuang(x, s);
    case "liet_nhat":
      return lietNhat(x, s);
    case "nguyet_thuc":
      return nguyetThuc(x, s);
    case "quy_thu":
      return quyThu(x, s);
    case "bao_tuyet":
      return baoTuyet(x, s);
    case "kim_cuong_xu":
      return kimCuongXu(x, s);
  }
}

export function isHeDang(d: Dang): d is HeDang {
  return HE_DANG.has(d);
}
const HE_DANG: ReadonlySet<string> = new Set<HeDang>([
  "hoa_long", "luu_tinh", "thuy_long", "song_than", "re_cay", "hoa_no", "phat_thu", "thanh_quang", "liet_nhat",
  "nguyet_thuc", "quy_thu", "bao_tuyet", "kim_cuong_xu",
]);

/** Điểm đánh chính: mục tiêu đầu (chiêu đơn) hoặc tâm vùng. */
function focus(x: Ctx, s: Shot): Point {
  const id = s.c.targets[0];
  if (s.c.center === undefined && id !== undefined) return x.foot(id, s.c.tick) ?? areaOf(x, s);
  return areaOf(x, s);
}

// ---- Hỏa: hỏa long cuộn tới ------------------------------------------------------------------------------------

function hoaLong(x: Ctx, s: Shot): boolean {
  const { t, e } = x;
  const { c, r } = s;
  const fire = COLORS.hoa.glow;
  const from = x.f.index.byId.get(c.unit);
  let first = Infinity;
  for (let ti = 0; ti < c.targets.length; ti++) {
    const id = c.targets[ti];
    const to = x.f.index.byId.get(id);
    const dst = x.foot(id, c.tick);
    if (!from || !to || !dst) continue;
    const cells = Math.abs(from.pos.moving(c.tick) - to.pos.moving(c.tick)) / 1000;
    const flight = Math.max(2, s.S(flightSeconds(c.skill, cells)));
    const launch = c.tick - flight;
    first = Math.min(first, launch);
    const src0 = x.foot(c.unit, launch) ?? s.src;
    const d = dir(src0, dst);
    const at = (q: number): [number, number, number] => {
      const wave = Math.sin(q * Math.PI * 2.5 + ti) * 11 * Math.sin(Math.PI * Math.min(1, q * 1.2));
      return [src0.x + (dst.x - src0.x) * q - d.y * wave, src0.y + (dst.y - src0.y) * q + d.x * wave, BODY_Z + 8 + 4 * q * (1 - q) * 20];
    };
    if (t >= launch && t < c.tick) {
      const q = (t - launch) / (c.tick - launch);
      const segs = count(r, 11);
      for (let k = segs; k >= 1; k--) {
        const qq = q - k * 0.032;
        if (qq < 0) continue;
        const [px, py, pz] = at(qq);
        const col = mix(fire, GOLD, k / (segs + 2));
        glow(e, L.AIR, px, py, pz, 8 - (k / segs) * 5, col, (0.95 - (k / segs) * 0.5) * r.bright, 0.7, 0.4);
        if (k % 3 === 0) motif(e, L.AIR, "hoa", px, py, pz + 4, 4, 0, col, 0.8 * r.bright, 0.5);
        if (k % 4 === 1) sprite(e, L.AIR, CELL.dot, px + sym(s.seed, k + 30 * ti) * 4, py, pz - 6 - (q - qq) * 60, 1.6, 1.6, 0, GOLD, 0.8 * r.bright, 1, 0.6);
      }
      const [hx, hy, hz] = at(q);
      const [px, py, pz] = at(Math.max(0, q - 0.02));
      const ang = Math.atan2(hy - hz - (py - pz), hx - px);
      glow(e, L.AIR, hx, hy, hz, 15, fire, r.bright, 0.8, 0.8);
      motif(e, L.AIR, "hoa", hx, hy, hz + 3, 9, ang + Math.PI / 2, mix(fire, WHITE, 0.2), r.bright, 0.5);
      for (const side of [-1, 1]) sprite(e, L.AIR, CELL.dot, hx - Math.sin(ang) * 3 * side, hy + Math.cos(ang) * 3 * side, hz + 4, 1.6, 1.6, 0, WHITE, r.bright, 1, 1);
    }
    const a = (t - c.tick) / s.S(0.45);
    if (a >= 0 && a < 1) {
      glow(e, L.AIR, dst.x, dst.y, BODY_Z, 26 * easeOut(a) + 8, fire, 0.7 * (1 - a) * r.bright, 0.8, 0.3);
      ring(e, L.GROUND, dst.x, dst.y, 8 + 30 * easeOut(a), (8 + 30 * easeOut(a)) * 0.4, fire, (1 - a) * r.bright, { width: 3, add: 0.7 });
    }
  }
  if (Number.isFinite(first)) {
    const w = shotWindup(s);
    windup(x, s, first - w, first, 0.7);
    if (t >= first - w && t < first) {
      const q = (t - (first - w)) / w;
      for (let k = 0; k < 6; k++) {
        const ang = t * 0.3 + k * 0.6;
        glow(e, L.AIR, s.src.x + Math.cos(ang) * 16, s.src.y + Math.sin(ang) * 6, BODY_Z + k * 5 * q, 6 - k * 0.6, mix(fire, GOLD, k / 6), q * r.bright, 0.8, 0.4);
      }
    }
  }
  hits(x, s, 0.45, 1);
  return true;
}

// ---- Hỏa: thiên hỏa lưu tinh -------------------------------------------------------------------------------------

function luuTinh(x: Ctx, s: Shot): boolean {
  const { t, e } = x;
  const { c, r } = s;
  const z = areaOf(x, s);
  const start = channel(s, 0.45);
  warning(x, s, z, start);
  windup(x, s, start, c.tick, 0.9);
  const fire = COLORS.hoa.glow;
  if (t >= start && t < c.tick + s.S(0.3)) {
    const q = ramp(t, start, c.tick);
    glow(e, L.AIR, z.x - 40, z.y, 160, 40 + 20 * q, mix(fire, BLACK, 0.3), 0.35 * q * (1 - ramp(t, c.tick, c.tick + s.S(0.3))) * x.zoneK, 0.6, 0);
  }
  const D = Math.max(2, s.S(0.35));
  const n = count(r, 5) + c.targets.length;
  for (let j = 0; j < n; j++) {
    const id = j < c.targets.length ? c.targets[j] : undefined;
    const p = id !== undefined ? x.foot(id, c.tick) : inZone(z, s.seed, 700 + j);
    if (!p) continue;
    const tf = id !== undefined ? c.tick : c.tick - s.S(0.15) + rnd(s.seed, 720 + j) * s.S(0.35);
    const sx = p.x - 60;
    if (t >= tf - D && t < tf) {
      const q = easeIn((t - (tf - D)) / D);
      const hx = sx + (p.x - sx) * q;
      const hz = 160 * (1 - q);
      beam(e, L.AIR, sx + (p.x - sx) * Math.max(0, q - 0.3), p.y, 160 * (1 - Math.max(0, q - 0.3)), hx, p.y, hz, 4, fire, 0, 0.8 * r.bright, 0.8, 0.4, 0.7, 0.6);
      glow(e, L.AIR, hx, p.y, hz, 14, fire, r.bright, 0.8, 0.8);
      sprite(e, L.AIR, CELL.rock, hx, p.y, hz, 6, 6, t * 0.3, mix(COLORS.tho.base, fire, 0.5), r.bright, 0.2, 0.2);
    }
    const a = (t - tf) / s.S(0.6);
    if (a >= 0 && a < 1) {
      ring(e, L.GROUND, p.x, p.y, 6 + 28 * easeOut(a), (6 + 28 * easeOut(a)) * 0.4, fire, (1 - a) * r.bright, { width: 3, halo: 0.4, add: 0.7 });
      glow(e, L.AIR, p.x, p.y, 8, 22, fire, pulse(a, 0.08) * r.bright, 0.8, 0.4);
      groundGlow(e, L.GROUND, p.x, p.y, 16, 6, mix(fire, BLACK, 0.6), 0.6 * (1 - a), 0);
      for (let k = 0; k < 3; k++) sprite(e, L.AIR, CELL.smoke, p.x + sym(s.seed, 760 + j * 3 + k) * 10, p.y, 6 + 26 * a, 10 + 6 * a, 8, 0, [0.3, 0.27, 0.25], 0.45 * (1 - a), 0);
    }
  }
  hits(x, s, 0.45, 0.8, 0.7);
  return true;
}

// ---- Thủy: thủy long quyển ---------------------------------------------------------------------------------------

function thuyLong(x: Ctx, s: Shot): boolean {
  const { t, e } = x;
  const { c, r } = s;
  const z = areaOf(x, s);
  const p = c.center !== undefined ? z : focus(x, s);
  const start = channel(s, 0.45);
  warning(x, s, z, start);
  windup(x, s, start, c.tick, 0.8);
  const water = COLORS.thuy.glow;
  const t0 = c.tick - s.S(0.4);
  if (t >= start && t < t0) {
    const q = ramp(t, start, t0);
    for (let w = 0; w < 2; w++) {
      const ph = ((t / 14 + w * 0.5) % 1 + 1) % 1;
      ring(e, L.GROUND, p.x, p.y, 8 + 24 * ph, (8 + 24 * ph) * 0.38, water, q * (1 - ph) * r.bright, { width: 2, add: 0.6 });
    }
  }
  const end = c.tick + s.S(0.7);
  if (t >= t0 && t < end) {
    const rise = easeOut(ramp(t, t0, c.tick));
    const fall = ramp(t, c.tick + s.S(0.15), end);
    const H = 120 * rise * (1 - fall * 0.7);
    const k = (1 - fall) * r.bright * x.zoneK;
    for (let i = 0; i < 8; i++) {
      const zz = (i / 7) * H;
      const rad = 12 + 9 * Math.sin((i / 7) * Math.PI) + 4 * (i / 7);
      ring(e, L.AIR, p.x + Math.sin(t * 0.25 + i) * 2, p.y, rad, rad * 0.35, i % 2 ? mix(water, WHITE, 0.4) : water, k * 0.8, { width: 2.6, dashes: 6, duty: 0.6, phase: -t * 0.07 - i * 0.2, z: zz, add: 0.5 });
    }
    for (let i = 0; i < count(r, 10); i++) {
      const h = (rnd(s.seed, 800 + i) + t / 30) % 1;
      const ang = t * 0.4 + i * 1.7;
      motif(e, L.AIR, "thuy", p.x + Math.cos(ang) * 16, p.y + Math.sin(ang) * 6, h * H, 3, 0, water, k, 0.4);
    }
  }
  const a = (t - c.tick) / s.S(0.6);
  if (a >= 0 && a < 1) {
    for (let w = 0; w < 2; w++) {
      const b = clamp01(a * 1.4 - w * 0.25);
      ring(e, L.GROUND, p.x, p.y, 10 + 60 * easeOut(b), (10 + 60 * easeOut(b)) * 0.38, water, (1 - b) * r.bright, { width: 3, add: 0.6 });
    }
    for (let i = 0; i < count(r, 8); i++) {
      const ang = rnd(s.seed, 840 + i) * TAU;
      const dist = 50 * a * (0.5 + rnd(s.seed, 850 + i));
      motif(e, L.AIR, "thuy", p.x + Math.cos(ang) * dist, p.y + Math.sin(ang) * dist * 0.4, Math.max(0, 70 * a - 110 * a * a), 3.5, 0, water, (1 - a) * r.bright, 0.4);
    }
  }
  hits(x, s, 0.45, 0.8, 0.8);
  return true;
}

// ---- Thủy: sóng thần quét ngang ----------------------------------------------------------------------------------

function songThan(x: Ctx, s: Shot): boolean {
  const { t, e } = x;
  const { c, r, src, face } = s;
  const water = COLORS.thuy.glow;
  const ang = Math.atan2(face.y, face.x);
  const w0 = c.tick - s.S(0.4);
  const t0 = c.tick - s.S(0.16);
  if (t >= w0 && t < t0) {
    const q = (t - w0) / (t0 - w0);
    ring(e, L.GROUND, src.x, src.y, 14 + 10 * q, (14 + 10 * q) * 0.38, water, q * r.bright, { width: 2, add: 0.6 });
    for (let i = 0; i < 6; i++) {
      const ph = (q * 1.5 + i / 6) % 1;
      const a2 = i * 1.05 + t * 0.1;
      motif(e, L.AIR, "thuy", src.x + Math.cos(a2) * 30 * (1 - ph), src.y + Math.sin(a2) * 12 * (1 - ph), BODY_Z * ph, 3, 0, water, q * ph * r.bright, 0.4);
    }
  }
  windup(x, s, w0, t0, 0.5);
  const z = c.center !== undefined && c.radius ? areaOf(x, s) : null;
  const goal = aim(x, c, c.tick) ?? { x: src.x + face.x * 80, y: src.y + face.y * 80 };
  const reach = Math.max(30, Math.hypot(goal.x - src.x, goal.y - src.y));
  const far = reach + (z ? Math.min(z.rx, z.ry) * 0.8 : 50);
  const half = z ? Math.min(160, Math.max(z.rx, z.ry) * 0.7) : 75;
  const R = half / Math.sin(0.7);
  const T = s.S(0.4);
  const v = far / T;
  const ts = c.tick - reach / v;
  const te = ts + T;
  if (t >= ts && t < te) {
    const fade = 1 - ramp(t, te - s.S(0.1), te);
    const dd = (t - ts) * v;
    const cx = src.x + face.x * (dd - R);
    const cy = src.y + face.y * (dd - R);
    arc(e, L.AIR, cx, cy, BODY_Z - 12, R - 8, ang - 0.72, 1.44, 1, 0, 14 * r.impact, water, 0.85 * fade * r.bright, 0.35, 0.3, 0.55);
    arc(e, L.AIR, cx, cy, BODY_Z - 4, R, ang - 0.7, 1.4, 1, 0, 3, WHITE, fade * r.bright, 0.4, 0.8, 0.55);
    for (let i = 0; i < count(r, 9); i++) {
      const off = (rnd(s.seed, 900 + i) - 0.5) * 2 * half;
      const up = ((t / 6 + rnd(s.seed, 910 + i)) % 1);
      motif(e, L.AIR, "thuy", src.x + face.x * dd - face.y * off, src.y + face.y * dd + face.x * off, BODY_Z + up * 26, 3, 0, mix(water, WHITE, 0.4), fade * (1 - up) * r.bright, 0.5);
    }
  }
  hits(x, s, 0.4, 1, 0.9);
  return true;
}

// ---- Mộc: rễ cây trói --------------------------------------------------------------------------------------------

/** Một rễ cây cong trồi từ đất tại p, cao h, xoắn theo seed. */
function root(x: Ctx, p: Point, h: number, seed: number, c: RGB, a: number, w = 2.8): void {
  const t0 = rnd(seed, 0) * TAU;
  let px = p.x;
  let py = p.y;
  let pz = 0;
  for (let k = 1; k <= 5; k++) {
    const q = k / 5;
    const ang = t0 + q * 3.6;
    const rr = 10 * (1 - q * 0.6);
    const nx = p.x + Math.cos(ang) * rr;
    const ny = p.y + Math.sin(ang) * rr * 0.4;
    const nz = q * h;
    beam(x.e, L.BODY, px, py, pz, nx, ny, nz, w * (1 - q * 0.5), c, a, a, 0.1, 0.1, 0, 0.5);
    px = nx;
    py = ny;
    pz = nz;
  }
  if (h > 10) sprite(x.e, L.AIR, CELL.vine, px, py, pz, 5, 5, t0, mix(c, WHITE, 0.2), a, 0, 0.1);
}

function reCay(x: Ctx, s: Shot): boolean {
  const { t, e } = x;
  const { c, r, src } = s;
  const z = areaOf(x, s);
  const start = channel(s, 0.4);
  const green = COLORS.moc.base;
  warning(x, s, z, start);
  windup(x, s, start, c.tick - s.S(0.2), 0.7);
  const t0 = c.tick - s.S(0.2);
  if (t >= start && t < c.tick) {
    // vết nứt xanh chạy dưới đất từ người ra chiêu tới vùng
    const q = ramp(t, start, c.tick);
    beam(e, L.GROUND, src.x, src.y, 0, src.x + (z.x - src.x) * q, src.y + (z.y - src.y) * q, 0, 1.6, COLORS.moc.glow, 0.2, 0.8 * r.bright, 0.4, 0.2, 0.2, 0.5);
  }
  const end = c.tick + s.S(0.6);
  if (t >= t0 && t < end) {
    const grow = easeOut(ramp(t, t0, c.tick + s.S(0.05)));
    const fade = 1 - ramp(t, c.tick + s.S(0.4), end);
    for (const id of c.targets) {
      const p = x.foot(id, c.tick);
      if (!p) continue;
      for (let v = 0; v < 3; v++) root(x, p, 34 * grow, s.seed ^ (id * 31 + v), green, fade * r.bright);
    }
    if (c.center !== undefined) {
      for (let j = 0; j < count(r, 7); j++) {
        const p = inZone(z, s.seed, 950 + j);
        root(x, p, 22 * easeOut(ramp(t, t0 + rnd(s.seed, 970 + j) * s.S(0.15), c.tick + s.S(0.1))), s.seed + j, green, fade * 0.85 * r.bright, 2.2);
      }
    }
  }
  hits(x, s, 0.45, 0.8, 0.8);
  return true;
}

// ---- Mộc: hoa nở (hồi phục, hộ thể) ------------------------------------------------------------------------------

function hoaNo(x: Ctx, s: Shot): boolean {
  const { t, e } = x;
  const { c, r, src } = s;
  const petalCol = mix(HEAL_PINK, COLORS[r.trailEl].glow, 0.2);
  const w0 = c.tick - s.S(0.36);
  const t0 = c.tick - s.S(0.26);
  if (t >= w0 && t < c.tick) {
    const q = (t - w0) / (c.tick - w0);
    for (let k = 0; k < 5; k++) {
      const ang = t * 0.2 + (k * TAU) / 5;
      sprite(e, L.AIR, CELL.petal, src.x + Math.cos(ang) * 14, src.y + Math.sin(ang) * 5, BODY_Z + 10, 3.5, 4.5, ang + Math.PI / 2, petalCol, q * r.bright, 0.2, 0.2);
    }
  }
  windup(x, s, w0, t0, 0.5);
  for (const id of c.targets) {
    const p = x.foot(id, c.tick);
    if (!p) continue;
    if (t >= t0 && t < c.tick && id !== c.unit) {
      const q = (t - t0) / (c.tick - t0);
      for (let k = 0; k < 3; k++) {
        const qq = clamp01(q - k * 0.12);
        const px = src.x + (p.x - src.x) * qq;
        const py = src.y + (p.y - src.y) * qq;
        sprite(e, L.AIR, CELL.petal, px + sym(s.seed ^ id, k) * 6, py, BODY_Z + 22 * Math.sin(Math.PI * qq), 3, 4, qq * 6 + k, petalCol, r.bright, 0.2, 0.2);
      }
    }
    const a = (t - c.tick) / s.S(0.9);
    if (a < 0 || a >= 1) continue;
    const open = easeBack(clamp01(a / 0.25));
    const n = 6 + r.tier;
    for (let k = 0; k < n; k++) {
      const ang = (k / n) * TAU + rnd(s.seed ^ id, 40) * 0.5;
      const lift = ramp(a, 0.45, 1);
      const rr = 7 * open + 20 * lift;
      sprite(e, L.BODY, CELL.petal, p.x + Math.cos(ang) * rr, p.y + Math.sin(ang) * rr * 0.4, 3 + lift * 50 + Math.sin(ang) * 2, 4 * open, 6 * open, ang + Math.PI / 2, petalCol, (1 - lift) * r.bright, 0.15, 0.2);
    }
    groundGlow(e, L.GROUND, p.x, p.y, 22 * open, 8 * open, COLORS.moc.glow, 0.5 * (1 - a) * r.bright, 0.7);
    sprite(e, L.AIR, CELL.star, p.x, p.y, 6 + 30 * a, 4, 4, a * 4, WHITE, pulse(a, 0.3) * r.bright, 1, 0.5);
  }
  return true;
}

// ---- Quang: Phật thủ ấn ------------------------------------------------------------------------------------------

function phatThu(x: Ctx, s: Shot): boolean {
  const { t, e } = x;
  const { c, r } = s;
  const p = focus(x, s);
  const zone = c.center !== undefined;
  const gold = mix(GOLD, COLORS.quang.glow, 0.4);
  const size = zone ? 46 : 30;
  const w0 = channel(s, 0.7);
  const t0 = c.tick - s.S(0.15);
  if (zone) warning(x, s, areaOf(x, s), w0);
  windup(x, s, w0, t0, 0.8);
  if (t >= w0 && t < t0) {
    const q = (t - w0) / (t0 - w0);
    const k = easeOut(q / 0.5);
    sprite(e, L.AIR, CELL.palm, p.x, p.y, 110 + size, size * k, size * k, 0, gold, k * r.bright, 0.5, 0.5);
    glow(e, L.AIR, p.x, p.y, 110 + size * 0.6, size, gold, 0.4 * q * r.bright, 1, 0.4);
    rays(e, L.AIR, p.x, p.y, 110 + size * 0.6, size * 1.8, gold, 0.4 * q * r.bright, 10, t * 0.02, 10, 0.2);
  } else if (t >= t0 && t < c.tick) {
    const q = easeIn((t - t0) / Math.max(1, c.tick - t0));
    const pz = 110 * (1 - q) + 6 * q;
    sprite(e, L.AIR, CELL.palm, p.x, p.y, pz + size, size, size, 0, gold, r.bright, 0.5, 0.6);
    for (let i = 0; i < 3; i++) beam(e, L.AIR, p.x + (i - 1) * size * 0.4, p.y, pz + size * 2 + 50, p.x + (i - 1) * size * 0.4, p.y, pz + size * 1.6, 1.2, gold, 0, 0.6 * r.bright, 1, 0.4, 0.6, 0.6);
  }
  const a = (t - c.tick) / s.S(0.9);
  if (a >= 0 && a < 1) {
    // dấu tay in xuống đất
    sprite(e, L.GROUND, CELL.palm, p.x, p.y, 0, size * 1.1, size * 0.45, 0, gold, (1 - a) * r.bright, 0.4, 0.4);
    for (let k = 0; k < 2; k++) {
      const b = clamp01(a * 1.6 - k * 0.2);
      if (b <= 0 || b >= 1) continue;
      ring(e, L.GROUND, p.x, p.y, size * (0.5 + 1.8 * easeOut(b)), size * (0.5 + 1.8 * easeOut(b)) * 0.4, gold, (1 - b) * r.bright, { width: 4 * (1 - b) + 1, halo: 0.6, add: 0.8 });
    }
    rays(e, L.AIR, p.x, p.y, BODY_Z, size * 2.2, gold, 0.6 * pulse(a, 0.08) * r.bright, 12, a, 12, 0.3);
  }
  hits(x, s, 0.5, 1.2);
  return true;
}

// ---- Quang: thánh quang thập tự ----------------------------------------------------------------------------------

function thanhQuang(x: Ctx, s: Shot): boolean {
  const { t, e } = x;
  const { c, r, src } = s;
  const light = mix(COLORS.quang.glow, WHITE, 0.3);
  const w0 = c.tick - s.S(0.36);
  const t0 = c.tick - s.S(0.26);
  if (t >= w0 && t < t0) {
    const q = (t - w0) / (t0 - w0);
    beam(e, L.AIR, src.x, src.y, BODY_Z + 30, src.x, src.y, BODY_Z + 50, 1.6, light, q * r.bright, q * r.bright, 1, 0.6, 0, 0.5);
    beam(e, L.AIR, src.x - 7, src.y, BODY_Z + 44, src.x + 7, src.y, BODY_Z + 44, 1.6, light, q * r.bright, q * r.bright, 1, 0.6, 0, 0.5);
  }
  windup(x, s, w0, t0, 0.6);
  for (const id of c.targets) {
    const p = x.foot(id, c.tick);
    if (!p) continue;
    if (t >= t0 && t < c.tick) {
      const q = (t - t0) / (c.tick - t0);
      beam(e, L.AIR, p.x, p.y, 220, p.x, p.y, 220 - 200 * easeIn(q), 3, light, 0.1, r.bright, 1, 0.7, 0.4, 0.5);
    }
    const a = (t - c.tick) / s.S(0.9);
    if (a < 0 || a >= 1) continue;
    const k = (1 - ramp(a, 0.5, 1)) * r.bright;
    const grow = easeBack(clamp01(a / 0.2));
    beam(e, L.AIR, p.x, p.y, 0, p.x, p.y, 74 * grow, 3, light, k, k * 0.6, 1, 0.8, 0, 0.5);
    beam(e, L.AIR, p.x - 18 * grow, p.y, 52, p.x + 18 * grow, p.y, 52, 3, light, k, k, 1, 0.8, 0, 0.5);
    beam(e, L.BODY, p.x, p.y, 0, p.x, p.y, 80, 12, COLORS.quang.glow, 0.35 * k, 0, 1, 0.1, 0, 1);
    for (let i = 0; i < count(r, 6); i++) {
      const fallq = ((a * 1.5 + rnd(s.seed ^ id, 60 + i)) % 1);
      sprite(e, L.AIR, CELL.star, p.x + sym(s.seed ^ id, 70 + i) * 16, p.y, 70 * (1 - fallq), 3, 3, fallq * 4, light, k * (1 - fallq * 0.5), 1, 0.6);
    }
  }
  return true;
}

// ---- Cực dương: liệt nhật ----------------------------------------------------------------------------------------

function lietNhat(x: Ctx, s: Shot): boolean {
  const { t, e } = x;
  const { c, r } = s;
  const p = focus(x, s);
  const sun = COLORS.cuc_duong.glow;
  const w0 = channel(s, 0.7);
  const t0 = c.tick - s.S(0.3);
  if (c.center !== undefined) warning(x, s, areaOf(x, s), w0);
  windup(x, s, w0, t0, 0.9);
  const big = c.center !== undefined ? 30 : 20;
  if (t >= w0 && t < c.tick) {
    const grow = easeOut(ramp(t, w0, t0));
    const fallq = easeIn(ramp(t, t0, c.tick));
    const pz = 95 * (1 - fallq) + 12 * fallq;
    const rad = big * (0.3 + 0.7 * grow);
    glow(e, L.AIR, p.x, p.y, pz, rad * 1.8, sun, 0.6 * r.bright, 1, 0.2);
    glow(e, L.AIR, p.x, p.y, pz, rad, mix(sun, WHITE, 0.5), r.bright, 0.6, 1, 0.6);
    rays(e, L.AIR, p.x, p.y, pz, rad * 2.6, sun, 0.7 * grow * r.bright, 12, t * 0.03, 8, 0.4);
    if (fallq > 0) beam(e, L.AIR, p.x, p.y, pz + 80 * fallq, p.x, p.y, pz, rad * 0.5, sun, 0, 0.7 * r.bright, 1, 0.5, 0.6, 0.6);
  }
  const a = (t - c.tick) / s.S(0.8);
  if (a >= 0 && a < 1) {
    glow(e, L.AIR, p.x, p.y, 12, big * 3 * easeOut(a) + 10, mix(sun, WHITE, 0.3), 0.8 * pulse(a, 0.05) * r.bright, 1, 0.3);
    rays(e, L.AIR, p.x, p.y, 12, big * 4, sun, 0.7 * (1 - a) ** 1.5 * r.bright, 16, a * 0.6, 12, 0.5);
    ring(e, L.GROUND, p.x, p.y, big * (0.5 + 3 * easeOut(a)), big * (0.5 + 3 * easeOut(a)) * 0.4, sun, (1 - a) ** 2 * r.bright, { width: 5 * (1 - a) + 1, halo: 0.6, add: 0.8 });
    groundGlow(e, L.GROUND, p.x, p.y, big * 1.6, big * 0.6, mix(sun, BLACK, 0.7), 0.6 * (1 - a), 0);
    for (let i = 0; i < count(r, 10); i++) {
      const ang = rnd(s.seed, 1000 + i) * TAU;
      const dist = big * 2.5 * easeOut(a) * (0.5 + rnd(s.seed, 1010 + i));
      sprite(e, L.AIR, CELL.dot, p.x + Math.cos(ang) * dist, p.y + Math.sin(ang) * dist * 0.4, 6 + 30 * a, 1.8, 1.8, 0, GOLD, (1 - a) * r.bright, 1, 0.7);
    }
  }
  hits(x, s, 0.5, 1.1);
  return true;
}

// ---- Cực âm: nguyệt thực -----------------------------------------------------------------------------------------

function nguyetThuc(x: Ctx, s: Shot): boolean {
  const { t, e } = x;
  const { c, r } = s;
  const z = areaOf(x, s);
  const p = c.center !== undefined ? z : focus(x, s);
  const moon = COLORS.cuc_am.glow;
  const start = channel(s, 0.45);
  const t0 = c.tick - s.S(0.3);
  windup(x, s, start, t0, 0.8);
  const R = Math.min(z.rx, z.ry) * 0.75;
  if (t >= start && t < c.tick) {
    const grow = easeOut(ramp(t, start, t0));
    const shrink = easeIn(ramp(t, t0, c.tick));
    const rad = R * grow * (1 - 0.85 * shrink);
    groundGlow(e, L.GROUND, p.x, p.y, rad * 1.2, rad * 0.5, VOID, 0.75 * x.zoneK, 0);
    ring(e, L.GROUND, p.x, p.y, rad, rad * 0.42, moon, (0.6 + 0.4 * shrink) * r.bright, { width: 2 + 3 * shrink, halo: 0.5, add: 0.6 });
    motif(e, L.AIR, "cuc_am", p.x, p.y, 50 + 10 * grow, 10 + 8 * grow, t * 0.04, moon, 0.85 * grow * r.bright, 0.4);
    // hạt bị hút vào tâm
    for (let i = 0; i < count(r, 12); i++) {
      const ph = ((t / 20 + rnd(s.seed, 1100 + i)) % 1);
      const ang = rnd(s.seed, 1110 + i) * TAU + ph * 2;
      const rr = R * 1.3 * (1 - ph);
      sprite(e, L.AIR, CELL.dot, p.x + Math.cos(ang) * rr, p.y + Math.sin(ang) * rr * 0.42, 6 + 20 * (1 - ph), 1.6, 1.6, 0, moon, grow * ph * r.bright, 0.6, 0.4);
    }
  }
  const a = (t - c.tick) / s.S(0.7);
  if (a >= 0 && a < 1) {
    ring(e, L.GROUND, p.x, p.y, R * 0.2 + R * 1.4 * easeOut(a), (R * 0.2 + R * 1.4 * easeOut(a)) * 0.42, moon, (1 - a) ** 2 * r.bright, { width: 6 * (1 - a) + 1, halo: 0.7, add: 0.7 });
    glow(e, L.AIR, p.x, p.y, 20, R * 0.8, moon, pulse(a, 0.06) * r.bright, 0.8, 0.2);
    groundGlow(e, L.GROUND, p.x, p.y, R * (1 - a), R * 0.4 * (1 - a), VOID, 0.6 * (1 - a), 0);
  }
  hits(x, s, 0.45, 0.8, 0.8);
  return true;
}

// ---- Âm lãnh: quỷ thủ --------------------------------------------------------------------------------------------

function quyThu(x: Ctx, s: Shot): boolean {
  const { t, e } = x;
  const { c, r, src } = s;
  const ghost = mix(COLORS.am_lanh.glow, WHITE, 0.25);
  const start = channel(s, 0.35);
  const t0 = c.tick - s.S(0.25);
  if (c.center !== undefined) warning(x, s, areaOf(x, s), start);
  windup(x, s, start, t0, 0.7);
  if (t >= start && t < t0) groundGlow(e, L.GROUND, src.x, src.y, 22, 8, VOID, 0.6 * ramp(t, start, t0), 0);
  const spots: { p: Point; id?: number }[] = [];
  for (const id of c.targets) {
    const p = x.foot(id, c.tick);
    if (p) spots.push({ p, id });
  }
  if (c.center !== undefined) for (let j = 0; j < count(r, 4); j++) spots.push({ p: inZone(areaOf(x, s), s.seed, 1200 + j) });
  for (let j = 0; j < spots.length; j++) {
    const { p, id } = spots[j];
    if (t >= t0 && t < c.tick && id !== undefined) {
      // vệt tối bò dưới đất từ người ra chiêu tới chân mục tiêu
      const q = (t - t0) / (c.tick - t0);
      for (let k = 0; k < 4; k++) {
        const qq = clamp01(q - k * 0.1);
        sprite(e, L.GROUND, CELL.smoke, src.x + (p.x - src.x) * qq, src.y + (p.y - src.y) * qq, 2, 10, 5, 0, VOID, 0.6 * (1 - k * 0.2), 0);
      }
    }
    const a = (t - c.tick) / s.S(0.7);
    if (a < 0 || a >= 1) continue;
    const up = easeBack(clamp01(a / 0.25));
    const down = ramp(a, 0.7, 1);
    groundGlow(e, L.GROUND, p.x, p.y, 20, 7, VOID, 0.7 * (1 - down), 0);
    const hands = id !== undefined ? 3 : 1;
    for (let k = 0; k < hands; k++) {
      const ang = (k / hands) * TAU + rnd(s.seed, 1300 + j) * 2;
      const hx = p.x + Math.cos(ang) * (id !== undefined ? 11 : 0);
      const hy = p.y + Math.sin(ang) * 4;
      const wig = Math.sin(t * 0.6 + k * 2) * 0.12;
      const h = 14 * up * (1 - down);
      if (h > 0.5) sprite(e, L.BODY, CELL.palm, hx, hy, h, 7, 9 * Math.min(1, up), wig + (Math.cos(ang) * 0.3), ghost, (1 - down) * r.bright, 0.25, 0.2);
    }
    motif(e, L.AIR, "am_lanh", p.x, p.y, 10 + 30 * a, 4, 0, ghost, (1 - a) * r.bright, 0.5);
  }
  hits(x, s, 0.45, 0.9);
  return true;
}

// ---- Cực hàn: bão tuyết ------------------------------------------------------------------------------------------

function baoTuyet(x: Ctx, s: Shot): boolean {
  const { t, e } = x;
  const { c, r } = s;
  const z = areaOf(x, s);
  const ice = mix(COLORS.cuc_han.glow, WHITE, 0.35);
  const start = channel(s, 0.45);
  warning(x, s, z, start);
  windup(x, s, start, c.tick, 0.8);
  const end = c.tick + s.S(0.7);
  if (t >= start && t < end) {
    const k = ramp(t, start, c.tick - s.S(0.2)) * (1 - ramp(t, c.tick + s.S(0.4), end)) * x.zoneK;
    groundGlow(e, L.GROUND, z.x, z.y, z.rx, z.ry, ice, 0.25 * k, 0.5);
    const n = count(r, 34);
    const wx = 0.9;
    const wy = 0.35;
    for (let i = 0; i < n; i++) {
      // gió thổi chéo: mỗi bông tuyết quay vòng trong vùng theo t (mod), nên tua lại vẫn đúng chỗ
      const sp = 3 + 3 * rnd(s.seed, 1400 + i);
      const u = ((rnd(s.seed, 1410 + i) + (t * sp * wx) / (2 * z.rx)) % 1 + 1) % 1;
      const v = ((rnd(s.seed, 1420 + i) + (t * sp * wy) / (2 * z.ry)) % 1 + 1) % 1;
      const px = z.x - z.rx + u * 2 * z.rx;
      const py = z.y - z.ry + v * 2 * z.ry;
      const inside = (px - z.x) ** 2 / z.rx ** 2 + (py - z.y) ** 2 / z.ry ** 2 < 1;
      if (!inside) continue;
      const pz = 8 + 50 * rnd(s.seed, 1430 + i);
      if (i % 3 === 0) motif(e, L.AIR, "cuc_han", px, py, pz, 4.2, t * 0.2 + i, WHITE, k * r.bright, 0.4);
      else sprite(e, L.AIR, CELL.streak, px, py, pz, 10, 1.7, Math.atan2(wy, wx), ice, k * r.bright, 0.6, 0.4);
    }
  }
  hits(x, s, 0.45, 0.8, 0.9);
  return true;
}

// ---- Kim: kim cương xử -------------------------------------------------------------------------------------------

function kimCuongXu(x: Ctx, s: Shot): boolean {
  const { t, e } = x;
  const { c, r } = s;
  const p = focus(x, s);
  const gold = mix(GOLD, COLORS.kim.glow, 0.25);
  const size = 24 * Math.min(1.4, r.impact);
  const w0 = c.tick - s.S(0.7);
  const t0 = c.tick - s.S(0.12);
  windup(x, s, w0, t0, 0.8);
  if (t >= w0 && t < t0) {
    const q = (t - w0) / (t0 - w0);
    const k = easeOut(q / 0.4);
    sprite(e, L.AIR, CELL.vajra, p.x, p.y, 115 - 10 * q, size * k, size * k, t * 0.06, gold, k * r.bright, 0.5, 0.5);
    glow(e, L.AIR, p.x, p.y, 115 - 10 * q, size, gold, 0.5 * q * r.bright, 1, 0.4);
    rays(e, L.AIR, p.x, p.y, 115 - 10 * q, size * 2, gold, 0.4 * q * r.bright, 8, t * 0.04, 10, 0.2);
  } else if (t >= t0 && t < c.tick) {
    const q = easeIn((t - t0) / Math.max(1, c.tick - t0));
    const pz = 105 * (1 - q) + 22 * q;
    sprite(e, L.AIR, CELL.vajra, p.x, p.y, pz + size * 0.9, size, size, Math.PI / 2, gold, r.bright, 0.5, 0.6);
    for (let i = 0; i < 2; i++) beam(e, L.AIR, p.x + (i ? 6 : -6), p.y, pz + size + 60, p.x + (i ? 6 : -6), p.y, pz + size, 1.2, gold, 0, 0.6 * r.bright, 1, 0.5, 0.6, 0.6);
  }
  const a = (t - c.tick) / s.S(0.8);
  if (a >= 0 && a < 1) {
    sprite(e, L.BODY, CELL.vajra, p.x, p.y, 22 + size * 0.8, size, size, Math.PI / 2, gold, (1 - ramp(a, 0.55, 1)) * r.bright, 0.4, 0.5);
    for (let k = 0; k < 2; k++) {
      const b = clamp01(a * 2 - k * 0.25);
      if (b <= 0 || b >= 1) continue;
      ring(e, L.GROUND, p.x, p.y, 10 + 60 * easeOut(b), (10 + 60 * easeOut(b)) * 0.4, gold, (1 - b) * r.bright, { width: 4 * (1 - b) + 1, halo: 0.6, add: 0.8 });
    }
    for (let i = 0; i < count(r, 8); i++) {
      const ang = rnd(s.seed, 1500 + i) * TAU;
      const dist = 40 * easeOut(a) * (0.5 + rnd(s.seed, 1510 + i));
      sprite(e, L.AIR, CELL.shard, p.x + Math.cos(ang) * dist, p.y + Math.sin(ang) * dist * 0.4, BODY_Z * (1 - a) + 6, 4, 4, ang + a * 6, gold, (1 - a) * r.bright, 0.5, 0.4);
    }
    glow(e, L.AIR, p.x, p.y, BODY_Z, 30, gold, 0.55 * pulse(a, 0.05) * r.bright, 1, 0.1);
  }
  hits(x, s, 0.5, 1.2);
  return true;
}

export type { Dang };

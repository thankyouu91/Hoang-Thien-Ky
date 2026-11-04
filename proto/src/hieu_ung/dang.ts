// Vẽ dáng chiêu đặc trưng (chọn ở dang_chon.ts). Mỗi dáng thay pha 1–3 của loại chiêu; nét hệ khi trúng (impact) và
// trạng thái kéo dài (he.ts) vẫn giữ. Như chieu.ts: pha 1–2 trước tick ra chiêu, đòn chạm đúng tick sim tính sát thương,
// mọi hạt là hàm của (seed, t).
import { aim, BODY_Z, type Ctx } from "./ctx.ts";
import type { CastTimeline } from "./chieu.ts";
import { dir, flightSeconds, impact, windup, type Shot } from "./chung.ts";
import type { Dang } from "./dang_chon.ts";
import { CELL, COLORS, L, mix, WHITE, type RGB } from "./emit.ts";
import { count } from "./recipe.ts";
import type { Cast, Point, Zone } from "./types.ts";
import {
  arc, beam, bolt, clamp01, easeBack, easeIn, easeOut, glow, motif, pulse, ramp, ring, rnd, rune, sprite, sym,
} from "./ve.ts";

const TAU = Math.PI * 2;
const BLOOD: RGB = [0.42, 0.02, 0.06];
const BLOOD_HOT: RGB = [1, 0.18, 0.2];
const DARK: RGB = [0.16, 0.14, 0.18];

/** Mốc pha của dáng (thay mốc của loại chiêu), để trang xem thử báo pha và chụp đúng lúc. */
export function dangTimeline(d: Dang, c: Cast, S: (s: number) => number, tl: CastTimeline): CastTimeline {
  const hit = c.tick;
  const channel = c.start ?? hit - S(0.45);
  switch (d) {
    case "dao_khi":
      return { windup: hit - S(0.4), travel: hit - S(0.16), hit, settle: hit + S(0.35) };
    case "kiem_tran":
      return { windup: hit - S(0.6), travel: hit - S(0.14), hit, settle: hit + S(0.35) };
    case "mua_kiem":
      return { windup: channel, travel: hit - S(0.3), hit, settle: hit + S(0.7) };
    case "cu_kiem":
      return { windup: hit - S(0.7), travel: hit - S(0.12), hit, settle: hit + S(0.8) };
    case "huyet_tuyen":
      return { windup: hit - S(0.18), travel: hit - 1, hit, settle: hit + S(0.45) };
    case "thien_loi":
      return { windup: channel, travel: hit - S(0.2), hit, settle: hit + S(0.5) };
    case "gai_troi":
      return { windup: channel, travel: hit - S(0.1), hit, settle: hit + S(0.7) };
    case "loc_xoay":
      return { windup: channel, travel: hit - S(0.45), hit, settle: hit + S(0.8) };
    case "dau_lau":
    case "tien_dong":
      return { ...tl, settle: hit + S(0.45) };
  }
}

/** Vẽ dáng `d` của lần ra chiêu; false nếu dáng không dùng được (thiếu mục tiêu), để chieu.ts vẽ hình gốc. */
export function drawDang(x: Ctx, s: Shot, d: Dang): boolean {
  if (!s.c.targets.length && s.c.center === undefined) return false;
  switch (d) {
    case "dao_khi":
      return daoKhi(x, s);
    case "kiem_tran":
      return kiemTran(x, s);
    case "mua_kiem":
      return muaKiem(x, s);
    case "cu_kiem":
      return cuKiem(x, s);
    case "dau_lau":
      return dauLau(x, s);
    case "huyet_tuyen":
      return huyetTuyen(x, s);
    case "thien_loi":
      return thienLoi(x, s);
    case "gai_troi":
      return gaiTroi(x, s);
    case "loc_xoay":
      return locXoay(x, s);
    case "tien_dong":
      return tienDong(x, s);
  }
}

// ---- dùng chung -------------------------------------------------------------------------------------------------

/** Vùng đánh (chân người, toạ độ đất) của chiêu có vùng; không có thì vòng nhỏ quanh giữa các mục tiêu. */
function areaOf(x: Ctx, s: Shot): Zone {
  const { c } = s;
  if (c.center !== undefined && c.radius) {
    const z = x.f.zone(c.center, c.radius);
    return { x: z.x, y: z.y + x.f.size / 2, rx: z.rx, ry: z.ry };
  }
  const p = aim(x, c, c.tick) ?? s.src;
  return { x: p.x, y: p.y, rx: 46, ry: 30 };
}

/** Điểm ngẫu nhiên thứ i trong elip vùng (phân bố đều theo diện tích). */
function inZone(z: Zone, seed: number, i: number): Point {
  const ang = rnd(seed, 2 * i) * TAU;
  const rr = Math.sqrt(rnd(seed, 2 * i + 1)) * 0.9;
  return { x: z.x + Math.cos(ang) * z.rx * rr, y: z.y + Math.sin(ang) * z.ry * rr };
}

/** Pha 3 chung cho mọi mục tiêu. */
function hits(x: Ctx, s: Shot, dur: number, scale = 1, sigK = 1): void {
  for (const id of s.c.targets) impact(x, s, id, (x.t - s.c.tick) / s.S(dur), scale, sigK);
}

/** Vòng báo trước của chiêu vận công (diện rộng) trong lúc vận. */
function warning(x: Ctx, s: Shot, z: Zone, from: number): void {
  const { t, e } = x;
  const { c, r } = s;
  if (c.start === undefined || t < from || t >= c.tick) return;
  const q = (t - from) / Math.max(1, c.tick - from);
  const k = r.bright * x.zoneK;
  ring(e, L.GROUND, z.x, z.y, z.rx, z.ry, r.main.glow, (0.45 + 0.3 * Math.sin(t * (0.4 + q))) * k, { width: 2.5, dashes: 28, phase: -t * 0.01, duty: 0.65, fill: 0.12 * q });
  ring(e, L.GROUND, z.x, z.y, z.rx * q, z.ry * q, r.main.glow, 0.45 * k, { width: 1.5, add: 0.8 });
}

/** Thanh kiếm trỏ theo góc `rot` (màn hình), cỡ `size`. */
function sword(x: Ctx, layer: 0 | 1 | 2, px: number, py: number, pz: number, size: number, rot: number, c: RGB, a: number): void {
  sprite(x.e, layer, CELL.sword, px, py, pz, size, size, rot, c, a, 0.35, 0.5);
}

// ---- đao khí chém ngang ----------------------------------------------------------------------------------------

/** Đao: tụ đao khí trước mặt rồi một luồng lưỡi liềm khổng lồ lướt ngang qua cả vùng, chạm mục tiêu đúng tick đánh. */
function daoKhi(x: Ctx, s: Shot): boolean {
  const { t, e } = x;
  const { c, r, src, face } = s;
  const ang = Math.atan2(face.y, face.x);
  const w0 = c.tick - s.S(0.4);
  const t0 = c.tick - s.S(0.16);
  if (t >= w0 && t < t0) {
    const q = (t - w0) / (t0 - w0);
    for (let i = 0; i < 5; i++) {
      const ph = (q * 1.6 + i / 5) % 1;
      const side = (i % 2 ? 1 : -1) * 34 * (1 - ph);
      sprite(e, L.AIR, CELL.streak, src.x + face.x * 14 - face.y * side, src.y + face.y * 14 + face.x * side, BODY_Z, 11, 2.2, ang + Math.PI / 2, i % 2 ? r.trail.glow : r.main.glow, q * (1 - ph) * r.bright, 1, 0.6);
    }
    glow(e, L.AIR, src.x + face.x * 14, src.y + face.y * 14, BODY_Z, 9 + 12 * q, r.main.glow, (0.3 + 0.5 * q) * r.bright, 1, 0.6);
  }
  windup(x, s, w0, t0, 0.5);
  const z = c.center !== undefined && c.radius ? areaOf(x, s) : null;
  const goal = aim(x, c, c.tick) ?? { x: src.x + face.x * 80, y: src.y + face.y * 80 };
  const reach = Math.max(30, Math.hypot(goal.x - src.x, goal.y - src.y));
  const far = reach + (z ? Math.min(z.rx, z.ry) * 0.8 : 50);
  const half = z ? Math.min(160, Math.max(z.rx, z.ry) * 0.7) : 70;
  const R = half / Math.sin(0.7);
  const T = s.S(0.34);
  const v = far / T;
  const ts = c.tick - reach / v;
  const te = ts + T;
  if (t >= ts && t < te) {
    const fade = 1 - ramp(t, te - s.S(0.08), te);
    for (let k = 0; k <= r.streaks; k++) {
      const dd = (t - ts) * v - k * 16;
      if (dd < 0) continue;
      const cx = src.x + face.x * (dd - R);
      const cy = src.y + face.y * (dd - R);
      const col = k ? r.trail.glow : r.main.glow;
      arc(e, L.AIR, cx, cy, BODY_Z - 10, R, ang - 0.7, 1.4, 1, 0, (k ? 3 : 8) * r.impact, col, fade * r.bright * (k ? 0.55 : 1), 0.55, 0.9, 0.55);
    }
    const dd = (t - ts) * v;
    for (let i = 0; i < 5; i++) {
      const off = (i / 4 - 0.5) * 2 * half;
      const px = src.x + face.x * (dd - 6) - face.y * off;
      const py = src.y + face.y * (dd - 6) + face.x * off;
      sprite(e, L.GROUND, CELL.smoke, px, py, 3, 9, 6, 0, WHITE, 0.3 * fade, 0);
    }
  }
  hits(x, s, 0.35, 1, 0.9);
  return true;
}

// ---- kiếm trận xoay rồi đâm ------------------------------------------------------------------------------------

/** Kiếm: các thanh kiếm hiện dần, xoay quanh người ra chiêu, rồi lần lượt phóng thẳng vào mục tiêu. */
function kiemTran(x: Ctx, s: Shot): boolean {
  const { t, e } = x;
  const { c, r, src } = s;
  const n = Math.min(7, 3 + r.tier + (r.streaks > 1 ? 1 : 0));
  const w0 = c.tick - s.S(0.6);
  const t0 = c.tick - s.S(0.14);
  const col = mix(r.main.glow, WHITE, 0.45);
  const orbit = (i: number, time: number): [number, number, number, number] => {
    const a = (i / n) * TAU + (time - w0) * 0.22;
    return [src.x + Math.cos(a) * 24, src.y + Math.sin(a) * 9, BODY_Z + 8 + Math.sin(a) * 6, a + Math.PI / 2];
  };
  if (t >= w0 && t < t0) {
    const q = (t - w0) / (t0 - w0);
    for (let i = 0; i < n; i++) {
      const k = ramp(q, (i / n) * 0.55, (i / n) * 0.55 + 0.15);
      if (k <= 0) continue;
      const [px, py, pz, rot] = orbit(i, t);
      const front = Math.sin(rot - Math.PI / 2) > 0;
      sword(x, front ? L.AIR : L.BODY, px, py, pz, 9, rot, col, k * r.bright);
      glow(e, L.AIR, px, py, pz, 6, r.main.glow, 0.4 * k * r.bright, 1);
    }
    ring(e, L.GROUND, src.x, src.y + 2, 24, 9, r.trail.glow, 0.5 * q * r.bright, { width: 1.5, dashes: n * 2, phase: t * 0.04, duty: 0.5 });
  }
  if (t >= t0 && t < c.tick) {
    const q = easeIn((t - t0) / Math.max(1, c.tick - t0));
    for (let i = 0; i < n; i++) {
      const id = c.targets[i % c.targets.length];
      const p = id !== undefined ? x.foot(id, c.tick) : null;
      if (!p) continue;
      const [ox, oy, oz] = orbit(i, t0);
      const qi = clamp01(q * 1.15 - (i / n) * 0.15);
      const px = ox + (p.x - ox) * qi;
      const py = oy + (p.y - oy) * qi;
      const pz = oz + (BODY_Z - oz) * qi;
      const rot = Math.atan2(p.y - BODY_Z - (oy - oz), p.x - ox);
      const tq = Math.max(0, qi - 0.3);
      beam(e, L.AIR, ox + (p.x - ox) * tq, oy + (p.y - oy) * tq, oz + (BODY_Z - oz) * tq, px, py, pz, 1.8, r.trail.glow, 0, r.bright, 1, 0.6, 0.6, 0.5);
      sword(x, L.AIR, px, py, pz, 10, rot, col, r.bright);
    }
  }
  windup(x, s, w0, t0, 0.4);
  hits(x, s, 0.35);
  return true;
}

// ---- mưa kiếm ----------------------------------------------------------------------------------------------------

/** Kiếm hiện dày trên không phía trên vùng rồi cắm xuống rất nhanh; kiếm nhắm mục tiêu cắm đúng tick đánh. */
function muaKiem(x: Ctx, s: Shot): boolean {
  const { t, e } = x;
  const { c, r } = s;
  const z = areaOf(x, s);
  const start = c.start ?? c.tick - s.S(0.45);
  warning(x, s, z, start);
  windup(x, s, start, c.tick, 0.9);
  const n = count(r, 16) + c.targets.length;
  const col = mix(r.main.glow, WHITE, 0.5);
  const fall = Math.max(1, s.S(0.07));
  const show = start + (c.tick - start) * 0.45;
  for (let j = 0; j < n; j++) {
    const id = j < c.targets.length ? c.targets[j] : undefined;
    const p = id !== undefined ? x.foot(id, c.tick) : inZone(z, s.seed, 50 + j);
    if (!p) continue;
    const tf = id !== undefined ? c.tick : c.tick - s.S(0.22) + rnd(s.seed, 90 + j) * s.S(0.34);
    const hover = 230 + 20 * rnd(s.seed, 120 + j);
    if (t < show || t >= tf + s.S(0.9)) continue;
    if (t < tf - fall) {
      const k = ramp(t, show + (j / n) * (tf - fall - show) * 0.5, show + (j / n) * (tf - fall - show) * 0.5 + s.S(0.15));
      sword(x, L.AIR, p.x, p.y, hover + Math.sin(t * 0.3 + j) * 3, 12, Math.PI / 2, col, 0.85 * k * x.zoneK * r.bright);
    } else if (t < tf) {
      const q = easeIn((t - (tf - fall)) / fall);
      const pz = hover * (1 - q);
      beam(e, L.AIR, p.x, p.y, pz + 60, p.x, p.y, pz, 2, r.main.glow, 0, r.bright, 1, 0.7, 0.6, 0.5);
      sword(x, L.AIR, p.x, p.y, pz + 12, 12, Math.PI / 2, col, r.bright);
    } else {
      const a = (t - tf) / s.S(0.9);
      sword(x, L.BODY, p.x, p.y, 9, 12, Math.PI / 2 + sym(s.seed, 150 + j) * 0.12, col, (1 - a * a) * r.bright);
      if (a < 0.2) {
        const b = a / 0.2;
        ring(e, L.GROUND, p.x, p.y, 4 + 14 * b, (4 + 14 * b) * 0.4, r.main.glow, (1 - b) * r.bright, { width: 2, add: 0.8 });
        sprite(e, L.GROUND, CELL.smoke, p.x, p.y, 3, 8 + 6 * b, 5 + 3 * b, 0, WHITE, 0.4 * (1 - b), 0);
      }
    }
  }
  hits(x, s, 0.45, 0.8, 0.7);
  return true;
}

// ---- cự kiếm giáng -----------------------------------------------------------------------------------------------

/** Một thanh kiếm khổng lồ hiện trên đầu mục tiêu, cắm thẳng xuống, nứt đất, cắm lại một lúc rồi tan. */
function cuKiem(x: Ctx, s: Shot): boolean {
  const { t, e } = x;
  const { c, r } = s;
  const id = c.targets[0];
  const p = (id !== undefined ? x.foot(id, c.tick) : null) ?? areaOf(x, s);
  const w0 = c.tick - s.S(0.7);
  const t0 = c.tick - s.S(0.12);
  const col = mix(r.main.glow, WHITE, 0.55);
  const big = 42 * Math.min(1.4, r.impact);
  windup(x, s, w0, t0, 0.8);
  if (t >= w0 && t < t0) {
    const q = (t - w0) / (t0 - w0);
    sword(x, L.AIR, p.x, p.y, 230 - 30 * q + big, big, Math.PI / 2, col, easeOut(q / 0.4) * r.bright);
    glow(e, L.AIR, p.x, p.y, 230 - 30 * q + big * 0.4, 30, r.main.glow, 0.5 * q * r.bright, 1, 0.4);
    rune(e, L.GROUND, p.x, p.y, 34 * easeOut(q), 13 * easeOut(q), r.main.glow, 0.8 * q * r.bright, t * 0.05, q, 1, 1.2, 0.6);
  } else if (t >= t0 && t < c.tick) {
    const q = easeIn((t - t0) / Math.max(1, c.tick - t0));
    const pz = 200 * (1 - q) + 26 * q;
    for (let i = 0; i < 3; i++) beam(e, L.AIR, p.x + (i - 1) * 9, p.y, pz + big + 70, p.x + (i - 1) * 9, p.y, pz + big, 1.2, r.main.glow, 0, 0.7 * r.bright, 1, 0.5, 0.6, 0.6);
    sword(x, L.AIR, p.x, p.y, pz + big, big, Math.PI / 2, col, r.bright);
  }
  const a = (t - c.tick) / s.S(0.9);
  if (a >= 0 && a < 1) {
    sword(x, L.BODY, p.x, p.y, 26 + big - 8, big, Math.PI / 2, col, (1 - ramp(a, 0.6, 1)) * r.bright);
    for (let k = 0; k < 2; k++) {
      const b = clamp01(a * 2 - k * 0.25);
      if (b <= 0 || b >= 1) continue;
      ring(e, L.GROUND, p.x, p.y, 12 + 70 * easeOut(b), (12 + 70 * easeOut(b)) * 0.4, k ? r.trail.glow : r.main.glow, (1 - b) * r.bright, { width: 4 * (1 - b) + 1, halo: 0.5, add: 0.7 });
    }
    // nứt đất toả ra
    for (let i = 0; i < 7; i++) {
      const ang = (i / 7) * TAU + sym(s.seed, 300 + i) * 0.3;
      const len = (30 + 26 * rnd(s.seed, 310 + i)) * easeOut(a * 3);
      beam(e, L.GROUND, p.x, p.y, 0, p.x + Math.cos(ang) * len, p.y + Math.sin(ang) * len * 0.4, 0, 1.2, DARK, 0.8 * (1 - a), 0.2 * (1 - a), 0, 0, 0.6, 0.4);
    }
    glow(e, L.AIR, p.x, p.y, BODY_Z, 40, r.main.glow, pulse(a, 0.04) * r.bright, 1, 0.4);
  }
  hits(x, s, 0.5, 1.3);
  return true;
}

// ---- đầu lâu (âm tà) ---------------------------------------------------------------------------------------------

/** Âm tà: đầu lâu bốc lửa ma bay lượn tới mục tiêu, há miệng cắn rồi tan thành khói đen và hồn ma bay lên. */
function dauLau(x: Ctx, s: Shot): boolean {
  const { t, e } = x;
  const { c, r } = s;
  const from = x.f.index.byId.get(c.unit);
  const skullCol = mix(r.main.glow, WHITE, 0.55);
  const big = c.skill === "bua_chu" ? 13 : 8.5;
  let first = Infinity;
  for (let ti = 0; ti < c.targets.length; ti++) {
    const id = c.targets[ti];
    const to = x.f.index.byId.get(id);
    const dst = x.foot(id, c.tick);
    if (!from || !to || !dst) continue;
    const cells = Math.abs(from.pos.moving(c.tick) - to.pos.moving(c.tick)) / 1000;
    const flight = Math.max(2, s.S(flightSeconds(c.skill === "dien_rong" ? "tam_xa" : c.skill, cells)));
    const launch = c.tick - flight - (c.skill === "dien_rong" ? s.S(0.04) * ti : 0);
    first = Math.min(first, launch);
    const src0 = x.foot(c.unit, launch) ?? s.src;
    const d = dir(src0, dst);
    if (t >= launch && t < c.tick) {
      const q = (t - launch) / (c.tick - launch);
      const wob = Math.sin(q * Math.PI * 3 + ti) * 7 * Math.sin(Math.PI * q);
      const px = src0.x + (dst.x - src0.x) * q - d.y * wob;
      const py = src0.y + (dst.y - src0.y) * q + d.x * wob;
      const pz = BODY_Z + 6 + Math.sin(Math.PI * q) * 14;
      for (let k = 1; k <= 3; k++) {
        const qq = Math.max(0, q - k * 0.07);
        const w2 = Math.sin(qq * Math.PI * 3 + ti) * 7 * Math.sin(Math.PI * qq);
        motif(e, L.AIR, "am_lanh", src0.x + (dst.x - src0.x) * qq - d.y * w2, src0.y + (dst.y - src0.y) * qq + d.x * w2, BODY_Z + 6 + Math.sin(Math.PI * qq) * 14, 6 - k, 0, r.main.glow, (0.8 - k * 0.18) * r.bright, 0.5);
        sprite(e, L.AIR, CELL.smoke, src0.x + (dst.x - src0.x) * qq, src0.y + (dst.y - src0.y) * qq, BODY_Z + 4, 8 + k * 2, 6 + k, 0, r.main.deep, 0.35 * r.bright, 0);
      }
      sprite(e, L.AIR, CELL.skull, px, py, pz, big, big, Math.sin(t * 0.5 + ti) * 0.25, skullCol, r.bright, 0.15, 0.2);
      glow(e, L.AIR, px - 2, py, pz + 1, big * 0.8, r.main.glow, 0.55 * r.bright, 1, 0.6);
    }
    const a = (t - c.tick) / s.S(0.45);
    if (a >= 0 && a < 1) {
      const bite = a < 0.25 ? 1 + 0.5 * easeOut(a / 0.25) : 0;
      if (bite) sprite(e, L.AIR, CELL.skull, dst.x, dst.y, BODY_Z + 4, big * bite, big * bite, 0, skullCol, (1 - a / 0.25) * r.bright, 0.2, 0.3);
      for (let k = 0; k < 4; k++) {
        const ang = rnd(s.seed ^ id, k) * TAU;
        sprite(e, L.AIR, CELL.smoke, dst.x + Math.cos(ang) * 16 * a, dst.y + Math.sin(ang) * 6 * a, BODY_Z + 20 * a, 10 + 8 * a, 8 + 4 * a, ang, r.main.deep, 0.55 * (1 - a), 0);
        motif(e, L.AIR, "am_lanh", dst.x + Math.cos(ang) * 10, dst.y, BODY_Z + 10 + 40 * a, 4, 0, r.main.glow, (1 - a) * r.bright, 0.5);
      }
    }
  }
  if (c.skill === "dien_rong") {
    const start = c.start ?? c.tick - s.S(0.45);
    warning(x, s, areaOf(x, s), start);
    windup(x, s, start, first, 0.8);
  }
  if (Number.isFinite(first)) {
    // Tụ lực như đạn gốc của loại chiêu (mốc pha của castTimeline), đầu lâu hiện dần trong tay.
    const w = s.S(c.skill === "bua_chu" ? 0.35 : c.skill === "khong_che" ? 0.25 : 0.18);
    windup(x, s, first - w, first, 0.7);
    if (t >= first - w && t < first) {
      const q = (t - (first - w)) / w;
      const hx = s.src.x + s.face.x * 12;
      const hy = s.src.y + s.face.y * 12;
      sprite(e, L.AIR, CELL.smoke, hx, hy, BODY_Z + 6, 12, 9, t * 0.1, r.main.deep, 0.5 * q, 0);
      sprite(e, L.AIR, CELL.skull, hx, hy, BODY_Z + 8, big * easeBack(q), big * easeBack(q), 0, skullCol, q * r.bright, 0.15, 0.2);
    }
  }
  hits(x, s, 0.45, 0.9);
  return true;
}

// ---- huyết tuyến (sát thủ) ---------------------------------------------------------------------------------------

/** Sát thủ: những sợi chỉ máu mảnh, thẳng, cắt ngang qua mục tiêu gần như cùng lúc, máu bắn rồi rơi. */
function huyetTuyen(x: Ctx, s: Shot): boolean {
  const { t, e } = x;
  const { c, r, src } = s;
  const w0 = c.tick - s.S(0.18);
  if (t >= w0 && t < c.tick) {
    const q = (t - w0) / (c.tick - w0);
    sprite(e, L.AIR, CELL.star, src.x + s.face.x * 12, src.y + s.face.y * 12, BODY_Z + 10, 5 * q, 5 * q, q * 3, BLOOD_HOT, q, 0.6, 0.6);
  }
  const reveal = Math.max(1, s.S(0.05));
  const hold = s.S(0.3);
  const fadeT = s.S(0.2);
  const m = 3 + r.streaks;
  for (const id of c.targets) {
    const p = x.foot(id, c.tick);
    if (!p) continue;
    const seed = s.seed ^ (id * 2654435761);
    for (let k = 0; k < m; k++) {
      const t0 = c.tick - 1 + k * s.S(0.03);
      if (t < t0 || t >= t0 + reveal + hold + fadeT) continue;
      const th = sym(seed, k) * 0.6 + (k % 3 === 2 ? Math.PI / 2.6 : 0);
      const len = 90 + 40 * rnd(seed, 10 + k);
      const zc = BODY_Z + sym(seed, 20 + k) * 12;
      const shown = clamp01((t - t0) / reveal);
      const fade = 1 - clamp01((t - t0 - reveal - hold) / fadeT);
      const ax = p.x - Math.cos(th) * len / 2;
      const ay = p.y - Math.sin(th) * len * 0.25;
      const bx = ax + Math.cos(th) * len * shown;
      const by = ay + Math.sin(th) * len * 0.5 * shown;
      beam(e, L.AIR, ax, ay, zc, bx, by, zc, 1.3, BLOOD, 0.2 * fade, 0.95 * fade, 0, 0, 0.5, 0.4);
      beam(e, L.AIR, ax, ay, zc, bx, by, zc, 0.5, BLOOD_HOT, 0.3 * fade, fade, 0.6, 0.3, 0.5, 0.4);
    }
    const a = (t - c.tick) / s.S(0.6);
    if (a >= 0 && a < 1) {
      for (let k = 0; k < count(r, 7); k++) {
        const ang = rnd(seed, 40 + k) * TAU;
        const sp = 18 + 24 * rnd(seed, 50 + k);
        const pz = Math.max(0, BODY_Z + 30 * a - 70 * a * a);
        sprite(e, L.AIR, CELL.drop, p.x + Math.cos(ang) * sp * a, p.y + Math.sin(ang) * sp * a * 0.5, pz, 2.2, 3, ang + Math.PI / 2, BLOOD, (1 - a) * 0.9, 0, 0);
      }
    }
  }
  // Thân pháp: hai sợi chỉ máu vạch theo đường lướt.
  if (c.skill === "than_phap") {
    const before = x.foot(c.unit, c.tick - 1);
    const after = x.foot(c.unit, c.tick);
    if (before && after && t >= c.tick - 1 && t < c.tick - 1 + hold + fadeT) {
      const fade = 1 - clamp01((t - (c.tick - 1) - hold) / fadeT);
      const d = dir(before, after);
      for (const off of [-7, 7]) {
        beam(e, L.AIR, before.x - d.y * off, before.y + d.x * off, BODY_Z, after.x - d.y * off, after.y + d.x * off, BODY_Z, 1, BLOOD, 0, 0.9 * fade, 0, 0, 0.5, 0.4);
        beam(e, L.AIR, before.x - d.y * off, before.y + d.x * off, BODY_Z, after.x - d.y * off, after.y + d.x * off, BODY_Z, 0.4, BLOOD_HOT, 0, fade, 0.6, 0.3, 0.5, 0.4);
      }
    }
  }
  hits(x, s, 0.4, 0.7);
  return true;
}

// ---- thiên lôi giáng ---------------------------------------------------------------------------------------------

/** Lôi: mây đen tụ trên vùng lúc vận công, rồi sét giáng thẳng xuống từng mục tiêu và rải rác quanh vùng. */
function thienLoi(x: Ctx, s: Shot): boolean {
  const { t, e } = x;
  const { c, r } = s;
  const z = areaOf(x, s);
  const start = c.start ?? c.tick - s.S(0.45);
  warning(x, s, z, start);
  windup(x, s, start, c.tick, 0.8);
  const cloudEnd = c.tick + s.S(0.5);
  if (t >= start && t < cloudEnd) {
    const q = ramp(t, start, c.tick);
    const out = 1 - ramp(t, c.tick + s.S(0.25), cloudEnd);
    for (let i = 0; i < 9; i++) {
      const p = inZone({ ...z, rx: z.rx * 0.8, ry: z.ry * 0.8 }, s.seed, 200 + i);
      sprite(e, L.AIR, CELL.smoke, p.x + Math.sin(t * 0.05 + i) * 6, p.y, 200 + 14 * rnd(s.seed, 220 + i), 30, 18, 0, DARK, 0.55 * q * out * x.zoneK, 0);
    }
    if (q > 0.4 && Math.floor(t / 3) % 3 === 0) {
      const a = inZone(z, s.seed ^ Math.floor(t / 3), 1);
      const b = inZone(z, s.seed ^ Math.floor(t / 3), 2);
      bolt(e, L.AIR, a.x, a.y, 205, b.x, b.y, 200, s.seed ^ Math.floor(t), r.main.glow, 0.6 * q * out, 1.2, 8, 4);
    }
  }
  const pts: { p: Point; at: number }[] = [];
  for (const id of c.targets) {
    const p = x.foot(id, c.tick);
    if (p) pts.push({ p, at: c.tick - 1 });
  }
  for (let j = 0; j < count(r, 4); j++) pts.push({ p: inZone(z, s.seed, 300 + j), at: c.tick - s.S(0.1) + rnd(s.seed, 330 + j) * s.S(0.3) });
  const vis = Math.max(2, s.S(0.14));
  for (let j = 0; j < pts.length; j++) {
    const { p, at } = pts[j];
    if (t < at || t >= at + vis + s.S(0.2)) continue;
    const k = 1 - clamp01((t - at) / vis);
    if (k > 0) bolt(e, L.AIR, p.x + sym(s.seed, 400 + j) * 18, p.y, 210, p.x, p.y, 0, s.seed ^ Math.floor(t) ^ (j * 97), r.main.glow, k * r.bright, 2.4, 16, 7);
    const b = clamp01((t - at) / (vis + s.S(0.2)));
    ring(e, L.GROUND, p.x, p.y, 6 + 20 * b, (6 + 20 * b) * 0.4, r.main.glow, (1 - b) * r.bright, { width: 2, add: 0.9 });
    glow(e, L.GROUND, p.x, p.y, 0, 16, r.main.glow, (1 - b) * 0.8 * r.bright, 1, 0.5);
  }
  hits(x, s, 0.45, 0.8, 0.8);
  return true;
}

// ---- gai trồi (đá, băng) -----------------------------------------------------------------------------------------

/** Thổ, Cực hàn: gai đá hay gai băng trồi lên khắp vùng thành sóng từ tâm ra ngoài, đứng một lúc rồi lún xuống. */
function gaiTroi(x: Ctx, s: Shot): boolean {
  const { t, e } = x;
  const { c, r } = s;
  const z = areaOf(x, s);
  const start = c.start ?? c.tick - s.S(0.45);
  warning(x, s, z, start);
  windup(x, s, start, c.tick, 0.8);
  const ice = r.el === "cuc_han" || (r.subs.includes("cuc_han") && r.el !== "tho");
  const col = ice ? mix(COLORS.cuc_han.glow, WHITE, 0.35) : mix(COLORS.tho.base, WHITE, 0.15);
  const n = count(r, 18) + c.targets.length;
  for (let j = 0; j < n; j++) {
    const id = j < c.targets.length ? c.targets[j] : undefined;
    const p = id !== undefined ? x.foot(id, c.tick) : inZone(z, s.seed, 500 + j);
    if (!p) continue;
    const rho = Math.min(1, Math.hypot((p.x - z.x) / z.rx, (p.y - z.y) / z.ry));
    const t0 = id !== undefined ? c.tick - 1 : c.tick - s.S(0.06) + rho * s.S(0.22);
    const life = s.S(0.75);
    if (t < t0 || t >= t0 + life) continue;
    const a = (t - t0) / life;
    const rise = easeBack(clamp01((t - t0) / Math.max(1, s.S(0.07))));
    const sink = 1 - ramp(a, 0.7, 1);
    const h = (16 + 12 * rnd(s.seed, 540 + j)) * rise * sink * (id !== undefined ? 1.25 : 1);
    if (h > 0.5) sprite(e, L.BODY, CELL.ice, p.x + (id !== undefined ? 8 : 0), p.y + 1, h * 0.95, 4.5 + 1.5 * rnd(s.seed, 560 + j), h, sym(s.seed, 580 + j) * 0.25, col, 0.95 * sink * r.bright, ice ? 0.3 : 0, 0.15);
    if (a < 0.25) sprite(e, L.GROUND, CELL.smoke, p.x, p.y, 2, 9 + 6 * a, 5, 0, ice ? WHITE : col, 0.4 * (1 - a / 0.25), 0);
  }
  hits(x, s, 0.45, 0.8, 0.8);
  return true;
}

// ---- lốc xoáy ----------------------------------------------------------------------------------------------------

/** Phong: lốc xoáy thành hình ở người ra chiêu, lướt tới vùng đánh, xoáy tại chỗ cuốn bụi lá rồi tan. */
function locXoay(x: Ctx, s: Shot): boolean {
  const { t, e } = x;
  const { c, r, src } = s;
  const z = areaOf(x, s);
  const start = c.start ?? c.tick - s.S(0.45);
  warning(x, s, z, start);
  windup(x, s, start, c.tick, 0.6);
  const t0 = c.tick - s.S(0.45);
  const t1 = c.tick + s.S(0.8);
  if (t < t0 || t >= t1) {
    hits(x, s, 0.45, 0.8, 0.8);
    return true;
  }
  const q = clamp01((t - t0) / (c.tick - t0));
  const px = src.x + (z.x - src.x) * easeOut(q);
  const py = src.y + (z.y - src.y) * easeOut(q);
  const grow = easeOut(q / 0.5);
  const fade = 1 - ramp(t, c.tick + s.S(0.5), t1);
  const k = grow * fade * r.bright;
  const scale = 0.6 + 0.6 * ramp(t, c.tick - s.S(0.1), c.tick + s.S(0.1)) * Math.min(1.6, z.rx / 60);
  for (let i = 0; i < 7; i++) {
    const rad = (9 + i * 5) * scale;
    const sway = Math.sin(t * 0.3 + i * 0.7) * 4 * (i / 6);
    ring(e, L.AIR, px + sway, py, rad, rad * 0.35, i % 2 ? r.trail.glow : r.main.glow, k * (0.4 + 0.08 * i), { width: 2.2, dashes: 5, duty: 0.55, phase: -t * 0.08 - i * 0.13, z: i * 15 * scale, add: 0.5 });
  }
  for (let i = 0; i < count(r, 8); i++) {
    const h = rnd(s.seed, 600 + i);
    const ang = t * (0.35 + 0.2 * h) + i * 1.3;
    const rad = (12 + h * 30) * scale;
    const leaf = i % 3 === 0;
    if (leaf) motif(e, L.AIR, r.subs[0] ?? "moc", px + Math.cos(ang) * rad, py + Math.sin(ang) * rad * 0.35, h * 90 * scale, 3.5, ang, COLORS[r.subs[0] ?? "moc"].glow, k, 0.3);
    else sprite(e, L.AIR, CELL.streak, px + Math.cos(ang) * rad, py + Math.sin(ang) * rad * 0.35, h * 90 * scale, 8, 1.6, ang + Math.PI / 2, r.main.glow, k, 0.8, 0.4);
  }
  sprite(e, L.GROUND, CELL.smoke, px, py, 2, 24 * scale, 9 * scale, t * 0.05, WHITE, 0.35 * k, 0);
  hits(x, s, 0.45, 0.8, 0.8);
  return true;
}

// ---- đồng tiền bay -----------------------------------------------------------------------------------------------

/** Tu kim tiền: chuỗi đồng tiền vàng lật bay tới mục tiêu, chạm thì tung toé tiền và ánh vàng. */
function tienDong(x: Ctx, s: Shot): boolean {
  const { t, e } = x;
  const { c, r } = s;
  const from = x.f.index.byId.get(c.unit);
  let first = Infinity;
  for (let ti = 0; ti < c.targets.length; ti++) {
    const id = c.targets[ti];
    const to = x.f.index.byId.get(id);
    const dst = x.foot(id, c.tick);
    if (!from || !to || !dst) continue;
    const cells = Math.abs(from.pos.moving(c.tick) - to.pos.moving(c.tick)) / 1000;
    const flight = Math.max(1, s.S(flightSeconds(c.skill, cells)));
    const launch = c.tick - flight;
    first = Math.min(first, launch);
    const src0 = x.foot(c.unit, launch) ?? s.src;
    if (t >= launch && t < c.tick) {
      const q = (t - launch) / (c.tick - launch);
      for (let k = 0; k < 5; k++) {
        const qq = q - k * 0.07;
        if (qq < 0) continue;
        const flip = Math.abs(Math.cos(t * 0.9 + k * 1.3 + ti));
        const px = src0.x + (dst.x - src0.x) * qq;
        const py = src0.y + (dst.y - src0.y) * qq;
        const pz = BODY_Z + 4 + Math.sin(Math.PI * qq) * 16 + Math.sin(qq * 20 + k) * 2;
        sprite(e, L.AIR, CELL.coin, px, py, pz, 5 * flip + 0.8, 5, 0, WHITE, r.bright, 0.1, 0.3);
      }
    }
    const a = (t - c.tick) / s.S(0.45);
    if (a >= 0 && a < 1) {
      for (let k = 0; k < count(r, 7); k++) {
        const ang = rnd(s.seed ^ id, 700 + k) * TAU;
        const sp = 16 + 22 * rnd(s.seed ^ id, 710 + k);
        const pz = Math.max(2, BODY_Z + 30 * a - 60 * a * a);
        sprite(e, L.AIR, CELL.coin, dst.x + Math.cos(ang) * sp * a, dst.y + Math.sin(ang) * sp * a * 0.5, pz, 4 * Math.abs(Math.cos(t + k)) + 0.8, 4, 0, WHITE, (1 - a) * r.bright, 0.1, 0.3);
        if (k < 3) sprite(e, L.AIR, CELL.star, dst.x + Math.cos(ang) * 10, dst.y, BODY_Z + 12 * k, 4, 4, a * 4, COLORS.quang.glow, pulse(a, 0.2), 1, 0.6);
      }
    }
  }
  if (Number.isFinite(first)) {
    const w = s.S(c.skill === "bua_chu" ? 0.35 : 0.18);
    windup(x, s, first - w, first, 0.7);
    if (t >= first - w && t < first) {
      const q = (t - (first - w)) / w;
      for (let k = 0; k < 3; k++) sprite(e, L.AIR, CELL.coin, s.src.x + s.face.x * 12, s.src.y + s.face.y * 12, BODY_Z + 6 + k * 3 * q, 4 * q + 0.5, 4 * q + 0.5, 0, WHITE, q * r.bright, 0.1, 0.3);
    }
  }
  hits(x, s, 0.4);
  return true;
}

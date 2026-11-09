// Phần dùng chung của hiệu ứng theo loại chiêu (chieu.ts) và dáng chiêu đặc trưng (dang.ts): khung một lần ra chiêu,
// tụ lực (pha 1), chạm trúng kèm nét hệ (pha 3), vệt kéo, thời gian bay; nhịp chạm theo luật DONG_TAC.md: khung va
// chạm, khựng, rồi bung theo cung trọng lực.
import { aim, BODY_Z, palette, type Ctx } from "./ctx.ts";
import { BLACK, CELL, COLORS, L, mix, WHITE, type Layer, type RGB } from "./emit.ts";
import { hitSignature } from "./he.ts";
import { ease, FPS, gravityArc, hitStop, IMPACT_FRAMES, smear } from "./nhip.ts";
import { count, type Recipe } from "./recipe.ts";
import type { Cast, Point, Zone } from "./types.ts";
import { beam, blob, burst, clamp01, motif, ramp, rays, ring, rnd, rune, sprite } from "./ve.ts";

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
  /** Số khung khựng khi chạm (công thức; chiêu cuối khựng lâu hơn) */
  hold: number;
  /** Đòn chạm (gây sát thương, khống chế): có khung va chạm và khựng; hộ thể, hồi phục thì không */
  contact: boolean;
}

/** Chiêu không phải đòn chạm: không khung va chạm, không khựng (hình nở mềm). */
export const NO_CONTACT: ReadonlySet<Cast["skill"]> = new Set<Cast["skill"]>(["ho_the", "hoi_phuc"]);

/** Khung khựng của một lần ra chiêu theo luật: chiêu cuối khựng lâu nhất, chiêu không chạm thì không khựng. */
export function holdOf(c: Cast, r: Recipe): number {
  return c.ult ? Math.max(r.hold, ULT_HOLD) : r.hold;
}

/** Khựng của chiêu cuối tông chủ (khung). */
export const ULT_HOLD = 9;
/** Khựng dài nhất có thể (khung), để cửa sổ nhìn lại của canh.ts đủ dài. */
export const MAX_STOP = IMPACT_FRAMES + ULT_HOLD;

export function dir(a: Point, b: Point): Point {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: dx / len, y: dy / len };
}

// ---- nhịp chạm: khung va chạm, khựng ------------------------------------------------------------------------------

/** Tick của một khung chuẩn (1/30 giây thực theo tốc độ phát): khung va chạm và khựng đếm theo giây thực, không theo nhịp biến thể. */
export function frameTick(x: Ctx): number {
  return x.f.life(1 / FPS);
}

/** Số tick từ lúc chạm tới hết khựng (khung va chạm cộng khung khựng). */
export function stopTicks(x: Ctx, s: Shot): number {
  return s.contact ? frameTick(x) * (IMPACT_FRAMES + s.hold) : 0;
}

/** Thời điểm đã khựng: trước lúc chạm như thường; từ lúc chạm đứng yên `stopTicks` rồi chạy tiếp, trễ đúng phần đó. */
export function stopped(x: Ctx, s: Shot): number {
  const age = x.t - s.c.tick;
  return age <= 0 ? x.t : s.c.tick + hitStop(age, stopTicks(x, s));
}

/** Ngữ cảnh đã khựng cho cả lần ra chiêu: mọi hình sau lúc chạm đứng yên trong lúc khựng; thời điểm thật giữ ở raw. */
export function stoppedCtx(x: Ctx, s: Shot): Ctx {
  if (x.t <= s.c.tick) return x;
  return { ...x, t: stopped(x, s), raw: x.raw ?? x.t };
}

/** Khung va chạm đang hiện (0 hay 1), -1 khi không phải lúc đó. */
export function impactFrameAt(x: Ctx, s: Shot): number {
  const age = (x.raw ?? x.t) - s.c.tick;
  if (age < 0 || !s.contact) return -1;
  const fr = Math.floor(age / frameTick(x));
  return fr < IMPACT_FRAMES ? fr : -1;
}

/** Màu mực của khung va chạm thứ hai: bản đậm của hệ pha đen (hệ sáng như Kim, Quang vẫn ra mực tối trên nền sân sáng). */
export function ink(r: Recipe): RGB {
  return mix(r.main.deep, BLACK, 0.7);
}

/**
 * Khung va chạm (thay cho chớp mờ dần): khung 0 sao gai màu hệ, lõi trắng; khung 1 đảo sang vành gai mực đậm quanh lõi
 * trắng. Hai khung đổi hẳn, không nội suy; bè ngang (squash) theo phối cảnh. ry: nửa trục dọc (mặc định 0,75 R).
 */
export function impactFrame(
  x: Ctx, s: Shot, px: number, py: number, z: number, R: number, frame: number, seed: number, layer: Layer = L.AIR, ry = R * 0.75,
  col: RGB = s.r.main.glow, ringOnly = false,
): void {
  const { e } = x;
  const { r } = s;
  const rot = rnd(seed, 450) * TAU;
  const k = ry / R;
  // ringOnly (nổ vùng, kích trận): chỉ vành gai quanh tâm, khoét giữa để người đứng trong vùng vẫn thấy rõ.
  const spikes = ringOnly ? 16 : 9;
  if (frame === 0) {
    burst(e, layer, px, py, z, R * 1.15, R * 1.15 * k, rot, col, ringOnly ? 0.8 : 1, { spikes, jag: 0.45, seed, valley: 0.42, rim: 0.6, hole: ringOnly ? 0.66 : 0 });
    if (!ringOnly) burst(e, layer, px, py, z, R * 0.55, R * 0.55 * k, rot + 0.3, WHITE, 1, { spikes: 7, jag: 0.3, seed: seed + 1, valley: 0.6 });
  } else {
    burst(e, layer, px, py, z, R * 1.3, R * 1.3 * k, rot + 0.35, ink(r), ringOnly ? 0.75 : 0.92, { spikes: spikes + 2, jag: 0.5, seed: seed + 2, hole: ringOnly ? 0.76 : 0.5, valley: 0.5 });
    if (!ringOnly) burst(e, layer, px, py, z, R * 0.42, R * 0.42 * k, rot, WHITE, 1, { spikes: 6, jag: 0.2, seed: seed + 3, valley: 0.8 });
  }
}

// ---- pha 1, pha 3 chung -----------------------------------------------------------------------------------------

/**
 * Pha 1 chung: quầng tụ lực ở tay và hạt hệ xoáy vào; chiêu đặc biệt thêm vòng phù văn dưới chân. Theo luật: lùi đà
 * (anticipation) về sau lưng và phình dần, bị nén dẹt ngay trước khi phóng, rồi vụt tới (whip) kéo dài theo hướng đánh.
 */
export function windup(x: Ctx, s: Shot, from: number, to: number, strength = 1): void {
  const { t, e } = x;
  if (t < from || t >= to) return;
  const q = (t - from) / Math.max(1, to - from);
  const { r, src, face } = s;
  const back = ease.inOut(Math.min(1, q / 0.8));
  const snap = ease.whip(Math.max(0, (q - 0.8) / 0.2));
  const off = 10 - 6 * back + 12 * snap;
  const hx = src.x + face.x * off;
  const hy = src.y + face.y * off;
  const k = r.bright * strength;
  const R = (8 + 14 * ease.inOut(q)) * (0.8 + 0.2 * r.impact);
  // nén dọc hướng đánh (q 0,55–0,8) rồi kéo dài khi vụt
  const sq = ease.inOut(ramp(q, 0.55, 0.8)) * (1 - snap);
  const along = 1 - 0.28 * sq + 0.7 * snap;
  const across = 1 + 0.22 * sq - 0.3 * snap;
  blob(e, L.AIR, hx, hy, BODY_Z + 4, R * along, R * across, Math.atan2(face.y, face.x), r.main.glow, (0.25 + 0.6 * q) * k, 1, 0.5 * q);
  const n = count(r, r.special ? 5 : 3);
  for (let i = 0; i < n; i++) {
    const ph = (q * 1.4 + i / n) % 1;
    const ang = rnd(s.seed, 300 + i) * TAU + t * 0.12;
    // xoáy vào nhanh dần (vào tay theo đường cong, không đều tuyến tính)
    const rr = 30 * (1 - ease.inOut(ph));
    const el = i % 3 === 2 && r.subs[0] ? r.subs[0] : r.el;
    motif(e, L.AIR, el, hx + Math.cos(ang) * rr, hy + Math.sin(ang) * rr * 0.5, BODY_Z + 4 + Math.sin(ang) * rr * 0.4, 3.5 + 2 * ph, ang, COLORS[el].glow, k * ph, 0.5);
  }
  if (r.special) {
    const rad = 18 + 4 * r.tier;
    rune(e, L.GROUND, src.x, src.y, rad, rad * 0.38, r.main.glow, 0.75 * k * ramp(q, 0, 0.3), t * 0.04, 1, 3, 1, 0.7);
  }
}

/**
 * Pha 3 chung trên một mục tiêu, `dur` giây (theo nhịp biến thể) sau khi hết khựng. Nhịp theo luật DONG_TAC.md:
 * - khung 0–1: khung va chạm (impactFrame), không vẽ gì khác;
 * - khựng (`s.hold` khung): lõi trắng bè ngang, vòng và tia lửa đứng yên ở thế chạm;
 * - bung: vòng nở theo whip, tia lửa bay theo cung trọng lực, kéo dài theo tốc độ; lõi thu nhỏ về 0 thay vì mờ;
 *   nét hệ chủ chạy, hệ phụ trễ vài phần (overlap).
 */
export function impact(x: Ctx, s: Shot, id: number, dur: number, scale = 1, sigK = 1): void {
  const { e } = x;
  const { r, c } = s;
  const age = (x.raw ?? x.t) - c.tick;
  if (age < 0) return;
  const p = x.foot(id, c.tick);
  if (!p) return;
  const seed = s.seed ^ (id * 2654435761);
  const big = r.impact * scale;
  const k = r.bright;
  const F = frameTick(x);
  if (s.contact && age < F * IMPACT_FRAMES) {
    impactFrame(x, s, p.x, p.y, BODY_Z, 15 * big, Math.floor(age / F), seed);
    return;
  }
  const T = s.S(dur);
  const a = (age - stopTicks(x, s)) / T;
  if (a >= 1) return;
  const u = Math.max(0, a);
  // Tan ở cuối pha (đã xa lúc chạm), không mờ ngay lúc chạm.
  const out = u < 0.65 ? 1 : 1 - (u - 0.65) / 0.35;
  // Lõi trắng sắc cạnh: bè ngang suốt lúc khựng, khi bung thu nhỏ về 0 và tròn lại.
  const shrink = 1 - ease.inOut(u / 0.3);
  if (shrink > 0) {
    const R0 = 8 * big * shrink;
    burst(e, L.AIR, p.x, p.y, BODY_Z, R0 * (1 + 0.35 * shrink), R0 * (1 - 0.25 * shrink), rnd(seed, 451) * TAU, WHITE, 0.95, { spikes: 7, jag: 0.2, seed, valley: 0.72 });
  }
  const R = (10 + 24 * ease.whip(u)) * big;
  ring(e, L.AIR, p.x, p.y, R, R, r.main.glow, 0.85 * k * out, { width: 2.4 * big * (1 - u) ** 1.5 + 0.5, z: BODY_Z, add: 0.35 });
  // Tia lửa: cung trọng lực (lên rồi rơi xuống dưới chỗ chạm), ra xa theo whip, dài theo tốc độ, thu nhỏ dần.
  const n = count(r, 4 + (r.variant === "bao" ? 3 : 0));
  for (let i = 0; i < n; i++) {
    const ang = rnd(seed, 400 + i) * TAU;
    const D = (12 + 26 * rnd(seed, 410 + i)) * big;
    const vz = (10 + 18 * rnd(seed, 415 + i)) * big;
    const at = (w: number): [number, number, number] => {
      const d = 9 * big + D * ease.whip(w);
      return [p.x + Math.cos(ang) * d, p.y + Math.sin(ang) * d * 0.5, BODY_Z + vz * w - 1.3 * vz * w * w];
    };
    const [ax, ay, az] = at(u);
    const [bx, by, bz] = at(u + 0.04);
    const vx = bx - ax;
    const vy = by - bz - (ay - az);
    const st = smear((Math.hypot(vx, vy) / (0.04 * T)) * F);
    const sz = (1 - u) ** 0.6;
    const col = i % 3 === 2 ? r.trail.glow : r.main.glow;
    sprite(e, L.AIR, CELL.spark, ax, ay, az, 3.5 * st.len * sz + 1, 1.8 * st.wid * sz + 0.4, Math.atan2(vy, vx), col, k * out, 0.6, 0.8);
  }
  if (r.tier >= 1) {
    for (let i = 0; i < r.tier + 1; i++) {
      const ang = rnd(seed, 420 + i) * TAU;
      const pop = 5 * ease.settle(u / 0.25) * (1 - u);
      sprite(e, L.AIR, CELL.star, p.x + Math.cos(ang) * 16 * big, p.y + Math.sin(ang) * 8, BODY_Z + 12 * rnd(seed, 430 + i), pop, pop, u * 3, WHITE, k, 1, 0.5);
    }
  }
  if (r.tier >= 2) {
    const rr = 30 * big * (1 - ease.inOut(u / 0.5));
    rays(e, L.AIR, p.x, p.y, BODY_Z, rr, r.main.glow, 0.7 * k, 6 + 2 * r.tier, rnd(seed, 440) * TAU, 10, 0.4);
  }
  // Nét hệ bung ra sau khựng (lúc khựng chỉ giữ thế chạm: lõi, vòng, tia lửa).
  if (a < 0) return;
  const src = x.foot(c.unit, c.tick);
  const pal = palette(c);
  hitSignature(x, pal[0], r, r.sig * sigK, u, p, src, seed, id);
  for (let i = 1; i < pal.length; i++) hitSignature(x, pal[i], r, 0.5 * r.sig * sigK, clamp01(u * 1.15 - 0.08 * i), p, src, seed ^ (i * 977), id);
}

/**
 * Đường bay của đạn: cung trọng lực từ tay (sx, sy, sz) tới mục tiêu (ex, ey, ez), đỉnh cung cao `apex`; đi ngang đều theo
 * thời gian, độ cao theo parabol (không đường thẳng, không cung sin).
 */
export function flightPath(sx: number, sy: number, sz: number, ex: number, ey: number, ez: number, apex: number): (q: number) => [number, number, number] {
  return (q) => gravityArc(sx, sy, sz, ex, ey, ez, q, apex);
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
  for (const id of s.c.targets) impact(x, s, id, dur, scale, sigK);
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


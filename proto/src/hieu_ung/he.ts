// Nét riêng của 12 hệ (GDD mục 9): pha 3 (chạm trúng) vẽ nét hệ ngắn trên mục tiêu; pha 4 (trạng thái kéo dài) vẽ
// choáng, đóng băng, tê liệt, trói, chậm, thiêu, giảm hồi máu, khiên, lộ vị trí theo đúng thời hạn trạng thái.
import { BODY_Z, HEAD_Z, TOP_Z, type Ctx } from "./ctx.ts";
import { CELL, COLORS, DANGER, GOLD, L, mix, SEAL, WHITE, type RGB } from "./emit.ts";
import type { Recipe } from "./recipe.ts";
import type { Point, StatusKind } from "./types.ts";
import type { ElementId } from "../replay/types.ts";
import {
  arc, beam, bolt, clamp01, dome, easeOut, glow, groundGlow, motif, pulse, ramp, ring, rnd, rays, sprite, sym,
} from "./ve.ts";

const TAU = Math.PI * 2;

function dirOf(a: Point | null, b: Point): Point {
  if (!a) return { x: 1, y: 0 };
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: dx / len, y: dy / len };
}

/**
 * Pha 3, nét hệ khi trúng: `a` tiến độ 0..1, `k` độ đậm (hệ chủ 1, hệ phụ 0,5; Linh nhân thêm), `p` chân mục tiêu,
 * `src` chân người đánh (hướng đòn, đích hút máu). `seed` riêng cho cặp sự kiện và mục tiêu.
 */
export function hitSignature(x: Ctx, el: ElementId, r: Recipe, k: number, a: number, p: Point, src: Point | null, seed: number, target: number): void {
  if (a < 0 || a >= 1 || k <= 0) return;
  const { e } = x;
  const col = COLORS[el];
  const fade = 1 - a;
  const n = (m: number) => Math.max(1, Math.round(m * r.density * Math.min(1.6, k)));
  const d = dirOf(src, p);
  const big = r.impact * (0.75 + 0.25 * k);
  switch (el) {
    case "kim": {
      // Xuyên giáp: tia bạc đâm xuyên qua thân, ra phía sau; mảnh giáp văng ra sau lưng.
      const reach = 14 + 50 * easeOut(a * 1.4) * big;
      for (let i = 0; i < 2 + r.streaks; i++) {
        const off = sym(seed, i) * 7;
        const ox = -d.y * off;
        const oy = d.x * off;
        beam(e, L.AIR, p.x - d.x * 16 + ox, p.y - d.y * 16 + oy, BODY_Z + off * 0.3, p.x + d.x * reach + ox, p.y + d.y * reach + oy, BODY_Z, 2.2, col.glow, 0.1 * k, k * fade, 1, 0.8, 0.7);
      }
      for (let i = 0; i < n(4); i++) {
        const ang = Math.atan2(d.y, d.x) + sym(seed, 10 + i) * 0.7;
        const dist = (18 + 34 * rnd(seed, 20 + i)) * easeOut(a);
        sprite(e, L.AIR, CELL.shard, p.x + Math.cos(ang) * dist, p.y + Math.sin(ang) * dist, BODY_Z + 10 * Math.sin(Math.PI * a), 5, 5, ang + a * 6, col.base, k * fade, 0.3, 0.4);
      }
      ring(e, L.BODY, p.x, p.y, 16 + 10 * a, 7 + 4 * a, col.glow, 0.8 * k * fade, { width: 2, dashes: 7, duty: 0.55, phase: rnd(seed, 3), z: BODY_Z - 6, add: 0.8 });
      break;
    }
    case "moc": {
      // Dây trói: dây leo mọc từ đất quấn lên chân, lá văng.
      const grow = easeOut(a / 0.35);
      for (let v = 0; v < 3; v++) {
        const t0 = rnd(seed, v) * TAU;
        let px = p.x + Math.cos(t0) * 14;
        let py = p.y + Math.sin(t0) * 5;
        let pz = 0;
        for (let s = 1; s <= 5; s++) {
          const q = (s / 5) * grow;
          const ang = t0 + q * 4.2;
          const rr = 14 - q * 4;
          const nx = p.x + Math.cos(ang) * rr;
          const ny = p.y + Math.sin(ang) * rr * 0.4;
          const nz = q * 30;
          beam(e, L.BODY, px, py, pz, nx, ny, nz, 2.2 - s * 0.2, col.base, k * fade, k * fade, 0.25, 0.2, 0, 0.5);
          px = nx;
          py = ny;
          pz = nz;
        }
      }
      for (let i = 0; i < n(4); i++) {
        const ang = rnd(seed, 30 + i) * TAU;
        const dist = 10 + 28 * easeOut(a);
        motif(e, L.AIR, "moc", p.x + Math.cos(ang) * dist, p.y + Math.sin(ang) * dist * 0.5, 8 + 26 * Math.sin(Math.PI * a), 5, ang + a * 4, col.base, k * fade, 0.1);
      }
      break;
    }
    case "thuy": {
      // Làm chậm: gợn nước loang dưới chân, giọt nước bắn lên rồi rơi.
      for (let w = 0; w < 2; w++) {
        const q = clamp01(a * 1.3 - w * 0.25);
        if (q <= 0) continue;
        ring(e, L.GROUND, p.x, p.y, 8 + 30 * easeOut(q) * big, (8 + 30 * easeOut(q) * big) * 0.36, col.glow, k * (1 - q), { width: 2.5, add: 0.7 });
      }
      for (let i = 0; i < n(6); i++) {
        const ang = rnd(seed, 40 + i) * TAU;
        const dist = (8 + 24 * rnd(seed, 50 + i)) * a;
        const z = 10 + 34 * Math.sin(Math.PI * a) * (0.6 + 0.4 * rnd(seed, 60 + i));
        motif(e, L.AIR, "thuy", p.x + Math.cos(ang) * dist, p.y + Math.sin(ang) * dist * 0.5, z, 4, 0, col.glow, k * fade, 0.4);
      }
      break;
    }
    case "hoa": {
      // Thiêu: lửa bùng lên từ thân, tàn lửa bay.
      glow(e, L.AIR, p.x, p.y, BODY_Z, 16 * big, col.glow, 0.4 * Math.min(1, k) * fade, 1, 0);
      for (let i = 0; i < n(6); i++) {
        const ang = rnd(seed, 70 + i) * TAU;
        const dist = 6 + 16 * rnd(seed, 80 + i) * easeOut(a);
        const z = BODY_Z - 8 + 40 * a * (0.5 + rnd(seed, 90 + i));
        const s = (4 + 3 * rnd(seed, 95 + i)) * (1 - a * 0.6) * big;
        motif(e, L.AIR, "hoa", p.x + Math.cos(ang) * dist, p.y + Math.sin(ang) * dist * 0.4, z, s, sym(seed, 99 + i) * 0.3, mix(col.glow, GOLD, rnd(seed, 98 + i) * 0.5), Math.min(1, k) * fade, 0.3);
      }
      break;
    }
    case "tho": {
      // Đá vụn văng ra, bụi dưới chân (khiên đá của người đánh là trạng thái, xem statusFx).
      for (let i = 0; i < n(5); i++) {
        const ang = rnd(seed, 110 + i) * TAU;
        const dist = (10 + 26 * rnd(seed, 120 + i)) * easeOut(a);
        const z = Math.max(0, 28 * Math.sin(Math.PI * Math.min(1, a * 1.4)) * rnd(seed, 130 + i));
        sprite(e, L.AIR, CELL.rock, p.x + Math.cos(ang) * dist, p.y + Math.sin(ang) * dist * 0.5, z + 2, 5 * big, 5 * big, ang + a * 5, col.base, Math.min(1, k) * fade, 0, 0.1);
      }
      for (let i = 0; i < 3; i++) {
        const ang = rnd(seed, 140 + i) * TAU;
        sprite(e, L.GROUND, CELL.smoke, p.x + Math.cos(ang) * 14 * a, p.y + Math.sin(ang) * 5 * a, 4, 10 + 8 * a, 7 + 5 * a, ang, col.base, 0.4 * Math.min(1, k) * fade, 0);
      }
      break;
    }
    case "loi": {
      // Sét chuỗi: tia sét nhảy sang tối đa hai địch gần mục tiêu; điện xẹt quanh thân.
      const flick = Math.floor(x.t);
      if (a < 0.65) {
        const ut = x.f.index.byId.get(target);
        let jumps = 0;
        if (ut) {
          let from = p;
          const near = nearest(x, target, ut.unit.team, p, 170, 2);
          for (const id of near) {
            const q = x.foot(id);
            if (!q) continue;
            const s = seed ^ (flick * 7919) ^ id;
            bolt(e, L.AIR, from.x, from.y, BODY_Z, q.x, q.y, BODY_Z, s, col.glow, k * (1 - a / 0.65), 1.8, 12, 6);
            glow(e, L.AIR, q.x, q.y, BODY_Z, 10, col.glow, 0.5 * Math.min(1, k), 1, 0.3);
            from = q;
            jumps++;
          }
        }
        if (!jumps) glow(e, L.AIR, p.x, p.y, BODY_Z, 12, col.glow, 0.5 * Math.min(1, k) * fade, 1, 0.3);
      }
      crackle(x, p, col.glow, k * fade, seed ^ (flick * 131), 4);
      break;
    }
    case "phong": {
      // Đẩy lùi: luồng gió vòng cung lướt qua theo hướng đòn, bụi bay ngược.
      const ang = Math.atan2(d.y, d.x);
      for (let i = 0; i < 2 + r.streaks; i++) {
        const off = (i - 1) * 9;
        const cx = p.x + d.x * (a * 40 - 10) - d.y * off;
        const cy = p.y + d.y * (a * 40 - 10) + d.x * off;
        arc(e, L.AIR, cx, cy, BODY_Z + off * 0.5, 16 + 4 * i, ang - 1.2, 2.4, 1, 0.3, 2.2, col.glow, k * fade, 0.8, 0.6, 0.6);
      }
      motif(e, L.AIR, "phong", p.x + d.x * 18 * a, p.y + d.y * 18 * a, BODY_Z, 7 * big, x.t * 0.5, col.glow, k * fade, 0.6);
      for (let i = 0; i < 3; i++) {
        sprite(e, L.GROUND, CELL.smoke, p.x - d.x * (6 + 20 * a) + sym(seed, 150 + i) * 8, p.y - d.y * (6 + 20 * a) + sym(seed, 160 + i) * 4, 3, 10 + 8 * a, 7 + 4 * a, 0, WHITE, 0.35 * k * fade, 0);
      }
      break;
    }
    case "quang": {
      // Hồi máu: hạt sáng bay từ mục tiêu về người đánh.
      if (!src) break;
      for (let i = 0; i < n(5); i++) {
        const q = clamp01(a * 1.3 - i * 0.06);
        if (q <= 0 || q >= 1) continue;
        const bend = sym(seed, 170 + i) * 30;
        const mx = (p.x + src.x) / 2 - d.y * bend;
        const my = (p.y + src.y) / 2 + d.x * bend;
        const bx = (1 - q) * (1 - q) * p.x + 2 * (1 - q) * q * mx + q * q * src.x;
        const by = (1 - q) * (1 - q) * p.y + 2 * (1 - q) * q * my + q * q * src.y;
        sprite(e, L.AIR, CELL.star, bx, by, BODY_Z + 18 * Math.sin(Math.PI * q), 4.5, 4.5, q * 3, col.glow, k * (1 - q * 0.4), 1, 0.6);
      }
      glow(e, L.AIR, src.x, src.y, BODY_Z, 16, col.glow, 0.45 * Math.min(1, k) * pulse(ramp(a, 0.5, 1)), 1, 0.2);
      break;
    }
    case "am_lanh": {
      // Hút máu: lửa ma đỏ thẫm chảy từ mục tiêu về người đánh.
      if (!src) break;
      const drain = mix(col.glow, SEAL, 0.45);
      for (let i = 0; i < n(5); i++) {
        const q = clamp01(a * 1.25 - i * 0.07);
        if (q <= 0 || q >= 1) continue;
        const bend = sym(seed, 180 + i) * 26 + Math.sin(q * 9 + i) * 6;
        const mx = (p.x + src.x) / 2 - d.y * bend;
        const my = (p.y + src.y) / 2 + d.x * bend;
        const bx = (1 - q) * (1 - q) * p.x + 2 * (1 - q) * q * mx + q * q * src.x;
        const by = (1 - q) * (1 - q) * p.y + 2 * (1 - q) * q * my + q * q * src.y;
        motif(e, L.AIR, "am_lanh", bx, by, BODY_Z + 10 * Math.sin(Math.PI * q), 4.5, 0, drain, k * (1 - q * 0.3), 0.5);
      }
      glow(e, L.AIR, src.x, src.y, BODY_Z, 14, drain, 0.45 * Math.min(1, k) * pulse(ramp(a, 0.5, 1)), 0.8, 0.1);
      break;
    }
    case "cuc_duong": {
      // Xuyên kháng: tia mặt trời toả, vòng kháng vỡ thành mảnh.
      rays(e, L.AIR, p.x, p.y, BODY_Z, 26 * big, col.glow, 0.7 * Math.min(1, k) * fade, 8, a * 1.2, 8, 0.3);
      if (a < 0.22) ring(e, L.AIR, p.x, p.y, 18, 18, col.glow, k, { width: 2.5, z: BODY_Z, halo: 0.4, add: 0.8 });
      else {
        for (let i = 0; i < n(8); i++) {
          const ang = (i / 8) * TAU + sym(seed, 190 + i) * 0.2;
          const dist = 18 + 26 * easeOut((a - 0.22) / 0.78);
          sprite(e, L.AIR, CELL.shard, p.x + Math.cos(ang) * dist, p.y + Math.sin(ang) * dist, BODY_Z, 5, 5, ang, col.glow, k * fade, 0.7, 0.4);
        }
      }
      break;
    }
    case "cuc_am": {
      // Giảm hồi máu: trăng khuyết đen đè xuống đầu, sương tối, dấu cộng bị gạch.
      const drop = easeOut(a / 0.4);
      motif(e, L.AIR, "cuc_am", p.x, p.y, TOP_Z + 18 - 12 * drop, 10 * big, -0.3, col.base, Math.min(1, k) * fade, 0);
      glow(e, L.AIR, p.x, p.y, TOP_Z + 6, 18, col.glow, 0.5 * k * fade, 0.6);
      for (let i = 0; i < 3; i++) {
        const ang = rnd(seed, 200 + i) * TAU;
        sprite(e, L.BODY, CELL.smoke, p.x + Math.cos(ang) * 14 * a, p.y + Math.sin(ang) * 6 * a, BODY_Z - 6, 14, 10, ang, col.deep, 0.55 * k * fade, 0);
      }
      if (a > 0.2) {
        sprite(e, L.AIR, CELL.cross, p.x + 18, p.y, HEAD_Z, 7, 7, 0, mix(col.glow, WHITE, 0.3), 0.8 * k * fade, 0.3);
        beam(e, L.AIR, p.x + 11, p.y, HEAD_Z - 7, p.x + 25, p.y, HEAD_Z + 7, 1.6, DANGER, k * fade, k * fade, 0.2, 0.3, 0, 0.3);
      }
      break;
    }
    case "cuc_han": {
      // Đóng băng: bông tuyết và mảnh băng bắn ra, mặt đất đóng sương.
      groundGlow(e, L.GROUND, p.x, p.y, 24 * big, 9 * big, col.glow, 0.4 * Math.min(1, k) * fade, 0.5);
      for (let i = 0; i < n(5); i++) {
        const ang = rnd(seed, 210 + i) * TAU;
        const dist = (10 + 26 * rnd(seed, 220 + i)) * easeOut(a);
        sprite(e, L.AIR, CELL.ice, p.x + Math.cos(ang) * dist, p.y + Math.sin(ang) * dist * 0.6, BODY_Z + 10 * Math.sin(Math.PI * a), 4, 8, ang + Math.PI / 2, col.glow, k * fade, 0.3, 0.3);
      }
      for (let i = 0; i < n(4); i++) {
        const ang = rnd(seed, 230 + i) * TAU;
        const dist = (6 + 22 * rnd(seed, 240 + i)) * a;
        motif(e, L.AIR, "cuc_han", p.x + Math.cos(ang) * dist, p.y + Math.sin(ang) * dist * 0.6, BODY_Z + 20 * a, 5, a * 2, WHITE, k * fade, 0.5);
      }
      break;
    }
  }
}

/** Tối đa `max` người còn sống cùng đội `team`, gần p nhất trong bán kính `reach`, trừ `self`; xếp theo id khi bằng nhau. */
function nearest(x: Ctx, self: number, team: number, p: Point, reach: number, max: number): number[] {
  const list: { id: number; d: number }[] = [];
  for (const ut of x.f.index.units) {
    const id = ut.unit.id;
    if (id === self || ut.unit.team !== team || !x.alive(id)) continue;
    const q = x.foot(id);
    if (!q) continue;
    const dd = Math.hypot(q.x - p.x, q.y - p.y);
    if (dd <= reach) list.push({ id, d: dd });
  }
  list.sort((a, b) => a.d - b.d || a.id - b.id);
  return list.slice(0, max).map((v) => v.id);
}

/** Điện xẹt quanh thân: vài tia ngắn đổi hình mỗi tick. */
function crackle(x: Ctx, p: Point, c: RGB, k: number, seed: number, n: number): void {
  for (let i = 0; i < n; i++) {
    const a0 = rnd(seed, i) * TAU;
    const z0 = 8 + 40 * rnd(seed, 10 + i);
    const r0 = 10 + 6 * rnd(seed, 20 + i);
    const a1 = a0 + sym(seed, 30 + i) * 1.4;
    bolt(x.e, L.AIR, p.x + Math.cos(a0) * r0, p.y + Math.sin(a0) * r0 * 0.4, z0, p.x + Math.cos(a1) * r0, p.y + Math.sin(a1) * r0 * 0.4, z0 + sym(seed, 40 + i) * 14, seed + i * 17, c, k, 1.1, 5, 3);
  }
}

// ---- pha 4: trạng thái kéo dài ------------------------------------------------------------------------------------

/** Kiểu hình của một trạng thái, chọn theo chiêu gây ra nó. */
export type StatusLook =
  | "chain" // khống chế: xích quấn và sao choáng
  | "ice" // Cực hàn: khối băng
  | "shock" // Lôi: tê liệt
  | "stars" // choáng khác
  | "vines" // Mộc: trói
  | "ripple" // Thủy: chậm
  | "flames" // Hỏa: thiêu
  | "curse" // Cực âm: giảm hồi máu
  | "dome" // hộ thể, khiên hồi tràn
  | "stone" // Thổ: khiên đá
  | "exposed" // thân pháp: lộ vị trí
  | "stealth";

export interface ActiveStatus {
  unit: number;
  status: StatusKind;
  from: number;
  until: number;
  look: StatusLook;
  el: ElementId;
  /** Công thức của chiêu gây ra (để lấy phẩm, biến thể); null khi không tìm được */
  r: Recipe | null;
}

/**
 * Vẽ một trạng thái tại thời điểm t. Hiện dần lúc áp, tắt dần lúc hết; khối băng vỡ ra lúc hết.
 * `fadeIn`, `fadeOut`: tick (đã đổi từ giây thực theo tốc độ).
 */
export function statusFx(x: Ctx, s: ActiveStatus, fadeIn: number, fadeOut: number): void {
  const { e, t } = x;
  const p = x.foot(s.unit);
  if (!p) return;
  const dead = !x.alive(s.unit);
  if (dead && s.look !== "ice") return;
  const into = clamp01((t - s.from) / Math.max(1, fadeIn));
  const left = (s.until - t) / Math.max(1, fadeOut);
  const k = into * clamp01(left);
  const col = COLORS[s.el];
  const bright = s.r ? s.r.bright : 1;
  const seed = (s.unit * 7919) ^ (s.from * 104729);
  switch (s.look) {
    case "chain": {
      // Hai vòng xích chéo quanh thân, siết lại lúc áp; sao choáng quay trên đầu.
      const tight = 1 - 0.35 * easeOut(into);
      for (let ring2 = 0; ring2 < 2; ring2++) {
        const tilt = ring2 ? 0.45 : -0.45;
        const links = 9;
        for (let i = 0; i < links; i++) {
          const ang = (i / links) * TAU + t * 0.04 * (ring2 ? 1 : -1);
          const rx = 22 * tight;
          const lx = Math.cos(ang) * rx;
          const lz = BODY_Z + Math.sin(ang) * rx * tilt + Math.sin(ang) * 2;
          const ly = Math.sin(ang) * rx * 0.3;
          sprite(e, L.BODY, CELL.link, p.x + lx, p.y + ly, lz, 5.5, 5.5, ang + Math.PI / 2 + (i % 2) * 0.8, mix(col.glow, WHITE, 0.4), k * bright, 0.15, 0.2);
        }
      }
      stars(x, p, k, 3);
      break;
    }
    case "stars":
      stars(x, p, k, 3);
      break;
    case "shock": {
      crackle(x, p, col.glow, k * bright, seed ^ (Math.floor(t) * 977), 3);
      glow(e, L.BODY, p.x, p.y, BODY_Z, 22, col.glow, 0.35 * k * (0.6 + 0.4 * Math.sin(t * 2.3)), 1);
      break;
    }
    case "ice": {
      // Khối băng bọc thân; hết hạn thì vỡ thành mảnh văng ra.
      const shatter = clamp01(-left);
      const breakAt = shatter > 0;
      if (!breakAt && !dead) {
        groundGlow(e, L.GROUND, p.x, p.y, 24, 9, col.glow, 0.5 * k, 0.4);
        glow(e, L.BODY, p.x, p.y, BODY_Z, 26, col.glow, 0.3 * k, 0.5);
        for (let i = 0; i < 6; i++) {
          const ang = (i / 6) * TAU + rnd(seed, i) * 0.5;
          const rr = 12 + 4 * rnd(seed, 10 + i);
          const h = 14 + 10 * rnd(seed, 20 + i);
          sprite(e, L.BODY, CELL.ice, p.x + Math.cos(ang) * rr, p.y + Math.sin(ang) * rr * 0.35 + 1, h * 0.9, 7 + 2 * rnd(seed, 30 + i), h, sym(seed, 40 + i) * 0.35, mix(col.glow, WHITE, 0.25), 0.85 * k, 0.15, 0.2);
        }
      } else if (shatter < 1) {
        for (let i = 0; i < 8; i++) {
          const ang = rnd(seed, 50 + i) * TAU;
          const dist = 14 + 30 * easeOut(shatter);
          sprite(e, L.AIR, CELL.ice, p.x + Math.cos(ang) * dist, p.y + Math.sin(ang) * dist * 0.5, BODY_Z + 16 * Math.sin(Math.PI * shatter), 4, 7, ang + shatter * 6, col.glow, 1 - shatter, 0.4, 0.3);
        }
      }
      break;
    }
    case "vines": {
      for (let v = 0; v < 3; v++) {
        const t0 = rnd(seed, v) * TAU;
        let px = p.x + Math.cos(t0) * 13;
        let py = p.y + Math.sin(t0) * 5;
        let pz = 0;
        for (let st = 1; st <= 5; st++) {
          const q = (st / 5) * into;
          const ang = t0 + q * 4.4 + Math.sin(t * 0.2 + v) * 0.08;
          const nx = p.x + Math.cos(ang) * (13 - q * 3);
          const ny = p.y + Math.sin(ang) * (13 - q * 3) * 0.4;
          const nz = q * 26;
          beam(e, L.BODY, px, py, pz, nx, ny, nz, 2.4 - st * 0.25, col.base, k, k, 0.15, 0.15, 0, 0.5);
          px = nx;
          py = ny;
          pz = nz;
        }
        sprite(e, L.BODY, CELL.vine, p.x + Math.cos(t0 + 1) * 12, p.y + 2, 8 + v * 5, 7, 7, t0, col.base, 0.9 * k, 0, 0.1);
      }
      break;
    }
    case "ripple": {
      for (let w = 0; w < 2; w++) {
        const q = ((t / 18 + w * 0.5) % 1 + 1) % 1;
        ring(e, L.GROUND, p.x, p.y, 10 + 18 * q, (10 + 18 * q) * 0.36, col.glow, 0.7 * k * (1 - q), { width: 2, add: 0.7 });
      }
      const drip = ((t / 10) % 1 + 1) % 1;
      motif(e, L.AIR, "thuy", p.x + sym(seed, Math.floor(t / 10)) * 10, p.y, BODY_Z + 10 - drip * 30, 3.5, 0, col.glow, k * (1 - drip), 0.4);
      break;
    }
    case "flames": {
      for (let i = 0; i < 3; i++) {
        const fl = 0.75 + 0.25 * Math.sin(t * 1.7 + i * 2.1) + 0.1 * sym(seed ^ Math.floor(t / 2), i);
        const ox = (i - 1) * 8;
        motif(e, L.AIR, "hoa", p.x + ox, p.y + 1, BODY_Z - 10 + i * 6, 7 * fl, 0, mix(col.glow, GOLD, 0.25), 0.85 * k, 0.6);
      }
      const ember = ((t / 12) % 1 + 1) % 1;
      sprite(e, L.AIR, CELL.dot, p.x + sym(seed, Math.floor(t / 12)) * 10, p.y, BODY_Z + ember * 36, 2, 2, 0, GOLD, k * (1 - ember), 1, 0.8);
      break;
    }
    case "curse": {
      const ang = t * 0.06;
      motif(e, L.AIR, "cuc_am", p.x + Math.cos(ang) * 10, p.y + Math.sin(ang) * 3, TOP_Z + 6, 6, ang, col.glow, 0.85 * k, 0.3);
      const fall = ((t / 14) % 1 + 1) % 1;
      sprite(e, L.BODY, CELL.smoke, p.x + sym(seed, Math.floor(t / 14)) * 8, p.y, HEAD_Z - fall * 34, 9, 9, 0, col.deep, 0.5 * k * (1 - fall), 0);
      break;
    }
    case "dome": {
      const pop = s.r ? 1 : 1;
      dome(e, L.BODY, p.x, p.y + 2, 27 * pop, col.glow, Math.min(1, 0.85 * k * bright), t / 40, 1, 1.15);
      break;
    }
    case "stone": {
      // Khiên đá: sáu phiến đá quay quanh người.
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * TAU + t * 0.05;
        const lx = Math.cos(ang) * 22;
        const ly = Math.sin(ang) * 8;
        const front = Math.sin(ang) > 0;
        sprite(e, front ? L.AIR : L.BODY, CELL.rock, p.x + lx, p.y + ly, 14 + 4 * Math.sin(t * 0.1 + i), 7, 7, ang, col.base, 0.9 * k, 0, 0.15);
      }
      groundGlow(e, L.GROUND, p.x, p.y, 24, 9, col.glow, 0.35 * k, 0.5);
      break;
    }
    case "exposed": {
      ring(e, L.GROUND, p.x, p.y, 22, 8, DANGER, 0.85 * k, { width: 2, dashes: 10, phase: -t * 0.02, duty: 0.6, add: 0.4 });
      const bob = Math.sin(t * 0.5) * 2;
      sprite(e, L.AIR, CELL.star, p.x, p.y, TOP_Z + 12 + bob, 4, 4, Math.PI / 4, DANGER, 0.8 * k, 0.3);
      break;
    }
    case "stealth":
      break;
  }
}

/** Sao choáng quay quanh đầu. */
function stars(x: Ctx, p: Point, k: number, n: number): void {
  for (let i = 0; i < n; i++) {
    const ang = x.t * 0.35 + (i * TAU) / n;
    sprite(x.e, L.AIR, CELL.star, p.x + Math.cos(ang) * 14, p.y + Math.sin(ang) * 4, HEAD_Z + 4, 5, 5, ang, GOLD, k, 0.3, 0.4);
  }
}

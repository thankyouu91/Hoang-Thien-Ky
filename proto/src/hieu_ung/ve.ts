// Nét vẽ cơ bản ghép từ tấm của emit.ts, và ngẫu nhiên theo seed (truy cập ngẫu nhiên, không giữ trạng thái), để mỗi
// hạt là hàm của (seed sự kiện, số thứ tự hạt, thời điểm): tua tới lui hay đổi tốc độ vẫn ra đúng hình.
import { CELL, Emitter, K, motifCell, type Layer, type RGB } from "./emit.ts";
import type { ElementId } from "../replay/types.ts";

// ---- ngẫu nhiên theo seed ----------------------------------------------------------------------------------------

/** Băm vài số nguyên thành một seed 32 bit. */
export function hash(a: number, b = 0, c = 0, d = 0): number {
  let h = 0x9e3779b9 ^ Math.imul(a | 0, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 15), 0xc2b2ae35) ^ Math.imul(b | 0, 0x27d4eb2f);
  h = Math.imul(h ^ (h >>> 13), 0x165667b1) ^ Math.imul(c | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) ^ Math.imul(d | 0, 0xc2b2ae35);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  return h >>> 0;
}

/** Số 0..1 thứ i của seed. */
export function rnd(seed: number, i: number): number {
  return hash(seed, i, 0x51ed) / 4294967296;
}

/** Số -1..1 thứ i của seed. */
export function sym(seed: number, i: number): number {
  return rnd(seed, i) * 2 - 1;
}

// ---- đường cong thời gian ----------------------------------------------------------------------------------------

export function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

export function easeOut(x: number): number {
  const k = 1 - clamp01(x);
  return 1 - k * k * k;
}

export function easeIn(x: number): number {
  const k = clamp01(x);
  return k * k;
}

/** Bật lên quá đà rồi về 1 (khiên nảy ra). */
export function easeBack(x: number): number {
  const k = clamp01(x) - 1;
  return 1 + 2.7 * k * k * k + 1.7 * k * k;
}

/** 0 → 1 trong đoạn [a, b]. */
export function ramp(x: number, a: number, b: number): number {
  return clamp01((x - a) / (b - a));
}

/** Hiện nhanh rồi tắt dần: 0 ở 0, 1 ở `peak`, về 0 ở 1. */
export function pulse(x: number, peak = 0.12): number {
  if (x <= 0 || x >= 1) return 0;
  return x < peak ? x / peak : 1 - ((x - peak) / (1 - peak)) ** 1.6;
}

// ---- nét vẽ ------------------------------------------------------------------------------------------------------

export function glow(e: Emitter, layer: Layer, x: number, y: number, z: number, r: number, c: RGB, a: number, add = 1, core = 0, hard = 0): void {
  const o = e.quad(layer, K.GLOW, x, y, z, r, r, 0, c, a, add);
  e.p(layer, o, hard, core);
}

/** Quầng elip nằm trên đất (dẹt theo phối cảnh). */
export function groundGlow(e: Emitter, layer: Layer, x: number, y: number, rx: number, ry: number, c: RGB, a: number, add = 1): void {
  const o = e.quad(layer, K.GLOW, x, y, 0, rx, ry, 0, c, a, add);
  e.p(layer, o, 0, 0);
}

export function sprite(
  e: Emitter, layer: Layer, cell: number, x: number, y: number, z: number,
  sx: number, sy: number, rot: number, c: RGB, a: number, add = 0.5, core = 0,
): void {
  const o = e.quad(layer, K.SPRITE, x, y, z, sx, sy, rot, c, a, add);
  e.p(layer, o, cell, core);
}

export function motif(e: Emitter, layer: Layer, el: ElementId, x: number, y: number, z: number, r: number, rot: number, c: RGB, a: number, add = 0.35): void {
  sprite(e, layer, motifCell(el), x, y, z, r, r, rot, c, a, add, 0.25);
}

/**
 * Dải sáng (đầu tròn) từ (x0, y0, z0) tới (x1, y1, z1), nửa bề dày w. a0, a1: độ đậm hai đầu; core: phần lõi trắng 0..1;
 * taper: đầu đầu thon lại (0 không thon, 1 nhọn hẳn).
 */
export function beam(
  e: Emitter, layer: Layer, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number,
  w: number, c: RGB, a0: number, a1: number, add = 1, core = 0.4, taper = 0, soft = 0.6,
): void {
  const sx0 = x0;
  const sy0 = y0 - z0;
  const dx = x1 - sx0;
  const dy = y1 - z1 - sy0;
  const len = Math.hypot(dx, dy);
  const o = e.quad(layer, K.BEAM, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, len / 2 + w, w, Math.atan2(dy, dx), c, Math.max(a0, a1), add);
  const m = Math.max(a0, a1, 1e-4);
  e.p(layer, o, a0 / m, a1 / m, core, soft);
  e.q(layer, o, taper);
}

/** Vòng elip trên đất. width: bề dày nét (đơn vị thế giới); dashes > 0: nét đứt. */
export function ring(
  e: Emitter, layer: Layer, x: number, y: number, rx: number, ry: number, c: RGB, a: number,
  opt: { width?: number; fill?: number; soft?: number; dashes?: number; phase?: number; duty?: number; halo?: number; add?: number; z?: number } = {},
): void {
  // Tấm to hơn vòng một chút để chỗ cho quầng và nét dày.
  const pad = 1 + Math.max(0.12, ((opt.width ?? 2) + 6 * (opt.halo ?? 0)) / Math.min(rx, ry));
  const o = e.quad(layer, K.RING, x, y, opt.z ?? 0, rx * pad, ry * pad, 0, c, a, opt.add ?? 0.6);
  e.p(layer, o, 1 / pad, opt.width ?? 2, opt.fill ?? 0, opt.soft ?? 1);
  e.q(layer, o, opt.dashes ?? 0, opt.phase ?? 0, opt.duty ?? 0.6, opt.halo ?? 0);
}

/**
 * Vệt chém lưỡi liềm tâm (x, y, z), bán kính r, từ góc `from` quét `sweep` (rad, có dấu). head/tail 0..1: phần vệt đang
 * thấy trên cung (đầu vệt chạy theo thời gian, đuôi đuổi theo). thick: nửa bề dày lớn nhất (đơn vị thế giới).
 * squash: dẹt theo phương dọc màn hình (cung nằm trên đất thì < 1).
 */
export function arc(
  e: Emitter, layer: Layer, x: number, y: number, z: number, r: number, from: number, sweep: number,
  head: number, tail: number, thick: number, c: RGB, a: number, add = 0.7, core = 0.8, squash = 1,
): void {
  const R = r + thick + 2;
  const o = e.quad(layer, K.ARC, x, y, z, R, R * squash, 0, c, a, add);
  e.p(layer, o, r / R, thick / R, 0.25, core);
  e.q(layer, o, from, sweep, head, tail);
}

export function dome(e: Emitter, layer: Layer, x: number, y: number, r: number, c: RGB, a: number, phase: number, hex = 1, height = 1.05): void {
  const o = e.quad(layer, K.DOME, x, y, 0, r, r * Math.max(1, height), 0, c, a, 0.55);
  e.p(layer, o, height, 1, hex);
  e.q(layer, o, phase);
}

/** Trận đồ hay ấn trên đất. style: 0 bát quái, 1 phù trận chiêu cuối, 2 ấn vuông, 3 vòng phù văn đơn. */
export function rune(e: Emitter, layer: Layer, x: number, y: number, rx: number, ry: number, c: RGB, a: number, rot: number, lit: number, style: number, bright = 1, add = 0.7): void {
  const o = e.quad(layer, K.RUNE, x, y, 0, rx, ry, 0, c, a, add);
  e.p(layer, o, rot, lit, style);
  e.q(layer, o, bright);
}

export function rays(e: Emitter, layer: Layer, x: number, y: number, z: number, r: number, c: RGB, a: number, n: number, phase: number, sharp = 6, core = 0.6, squash = 1): void {
  const o = e.quad(layer, K.RAYS, x, y, z, r, r * squash, 0, c, a, 1);
  e.p(layer, o, n, phase, sharp, core);
}

/**
 * Khung va chạm (impact frame): sao gai sắc cạnh, nửa trục rx, ry (bè ngang khi bẹt). spikes: số gai; jag: độ lệch dài
 * ngắn giữa các gai 0..1; hole > 0 khoét giữa thành vành gai; valley: chân gai (0 gai nhọn sâu, 1 thành đĩa); rim: viền
 * trắng mép trong. Mặc định hòa màu thường để tương phản rõ trên nền sân sáng.
 */
export function burst(
  e: Emitter, layer: Layer, x: number, y: number, z: number, rx: number, ry: number, rot: number, c: RGB, a: number,
  opt: { spikes?: number; phase?: number; hole?: number; jag?: number; seed?: number; rim?: number; valley?: number; add?: number } = {},
): void {
  const o = e.quad(layer, K.BURST, x, y, z, rx, ry, rot, c, a, opt.add ?? 0);
  e.p(layer, o, opt.spikes ?? 9, opt.phase ?? 0, opt.hole ?? 0, opt.jag ?? 0.35);
  e.q(layer, o, (opt.seed ?? 0) % 997, opt.rim ?? 0, opt.valley ?? 0.4);
}

/** Quầng elip xoay được (co giãn theo hướng bay: dài theo hướng, dẹt bề ngang). */
export function blob(e: Emitter, layer: Layer, x: number, y: number, z: number, rx: number, ry: number, rot: number, c: RGB, a: number, add = 1, core = 0, hard = 0): void {
  const o = e.quad(layer, K.GLOW, x, y, z, rx, ry, rot, c, a, add);
  e.p(layer, o, hard, core);
}

/** Phủ tối cả vùng nhìn trừ quanh (x, y); size: nửa cạnh tấm phủ (đủ trùm màn hình). */
export function shade(e: Emitter, layer: Layer, x: number, y: number, z: number, size: number, a: number, inner: number, outer: number): void {
  const o = e.quad(layer, K.SHADE, x, y, z, size, size, 0, [0.02, 0.01, 0.03], a, 0);
  e.p(layer, o, inner, outer);
}

/** Tia sét gấp khúc từ A tới B; khúc gấp đổi theo `seed` (nơi gọi đổi seed theo tick để sét nhảy hình). */
export function bolt(
  e: Emitter, layer: Layer, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number,
  seed: number, c: RGB, a: number, w = 2.2, jag = 10, segs = 6,
): void {
  const dx = x1 - x0;
  const dy = y1 - z1 - (y0 - z0);
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  let px = x0;
  let py = y0;
  let pz = z0;
  for (let k = 1; k <= segs; k++) {
    const q = k / segs;
    const j = k === segs ? 0 : sym(seed, k) * jag * Math.sin(Math.PI * q);
    const qx = x0 + (x1 - x0) * q + nx * j;
    const qy = y0 + (y1 - y0) * q + ny * j;
    const qz = z0 + (z1 - z0) * q;
    beam(e, layer, px, py, pz, qx, qy, qz, w * 2.2, c, a * 0.5, a * 0.5, 1, 0, 0, 1);
    beam(e, layer, px, py, pz, qx, qy, qz, w, c, a, a, 1, 0.9, 0, 0.4);
    // nhánh rẽ ngắn
    if (k < segs && rnd(seed, 40 + k) < 0.35) {
      const bl = len * 0.12 * (0.5 + rnd(seed, 60 + k));
      const ang = Math.atan2(dy, dx) + sym(seed, 80 + k) * 1.1;
      beam(e, layer, qx, qy, qz, qx + Math.cos(ang) * bl, qy + Math.sin(ang) * bl, qz, w * 0.6, c, a * 0.8, 0, 1, 0.6, 0.8, 0.5);
    }
    px = qx;
    py = qy;
    pz = qz;
  }
}

export const CELLS = CELL;

// Họa tiết hạt của 12 hệ, theo ký hiệu ở GDD mục 15, để nhận ra hệ cả khi không phân biệt được màu.
// Mỗi họa tiết vẽ một lần vào canvas nhỏ rồi dùng lại; chuyển động của hạt (rơi, bay lên, xoay) cũng theo hệ.
import type { ElementId } from "../../replay/types.ts";
import { ELEMENT_STYLE } from "../../theme/elements.ts";

interface Motion {
  /** Rơi xuống (dương) hay bay lên (âm) khi hạt tàn, đơn vị thế giới */
  fall: number;
  /** Xoay thêm khi tàn, radian */
  turn: number;
  /** Giữ thẳng đứng (lửa, lửa ma) thay vì quay theo hướng văng */
  upright?: boolean;
  /** Lượn sóng ngang (lửa ma) */
  wave?: boolean;
}

const MOTION: Record<ElementId, Motion> = {
  kim: { fall: 0, turn: 0 }, // hình tròn: vòng kim loại văng thẳng
  moc: { fall: 10, turn: 4 }, // chiếc lá: chao xuống
  thuy: { fall: 20, turn: 0, upright: true }, // gợn sóng: giọt nước rơi
  hoa: { fall: -18, turn: 0, upright: true }, // ngọn lửa: bốc lên
  tho: { fall: 24, turn: 5 }, // hình vuông: đá vụn lăn rơi
  loi: { fall: 0, turn: 0 }, // tia sét: văng theo hướng
  phong: { fall: -4, turn: 9 }, // vòng xoáy: xoay nhanh
  quang: { fall: 0, turn: 1 }, // tia sáng
  am_lanh: { fall: -14, turn: 0, upright: true, wave: true }, // ngọn lửa ma: lượn lên
  cuc_duong: { fall: -6, turn: 1.5 }, // mặt trời
  cuc_am: { fall: 0, turn: 6 }, // trăng khuyết: xoay
  cuc_han: { fall: 8, turn: 2 }, // bông tuyết: rơi chậm
};

const S = 32; // cạnh canvas họa tiết; hình vẽ quanh tâm, bán kính khoảng 12
const sprites = new Map<ElementId, HTMLCanvasElement>();

function sprite(el: ElementId): HTMLCanvasElement {
  const cached = sprites.get(el);
  if (cached) return cached;
  const cv = document.createElement("canvas");
  cv.width = cv.height = S;
  const c = cv.getContext("2d")!;
  c.translate(S / 2, S / 2);
  c.lineCap = "round";
  c.lineJoin = "round";
  const color = ELEMENT_STYLE[el].color;
  const white = "rgba(255, 255, 255, 0.9)";
  c.fillStyle = color;
  c.strokeStyle = color;
  const flame = (w: number) => {
    c.beginPath();
    c.moveTo(0, -12);
    c.bezierCurveTo(w * 0.6, -4, w, 3, 0, 11);
    c.bezierCurveTo(-w, 3, -w * 0.6, -4, 0, -12);
  };
  switch (el) {
    case "kim":
      c.lineWidth = 3.5;
      c.beginPath();
      c.arc(0, 0, 8, 0, Math.PI * 2);
      c.stroke();
      c.strokeStyle = white;
      c.lineWidth = 1.2;
      c.stroke();
      break;
    case "moc":
      c.beginPath();
      c.moveTo(0, -12);
      c.quadraticCurveTo(10, 0, 0, 12);
      c.quadraticCurveTo(-10, 0, 0, -12);
      c.fill();
      c.strokeStyle = white;
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(0, -9);
      c.lineTo(0, 10);
      c.stroke();
      break;
    case "thuy":
      c.beginPath();
      c.moveTo(0, -12);
      c.bezierCurveTo(4, -5, 8, 0, 8, 4);
      c.arc(0, 4, 8, 0, Math.PI);
      c.bezierCurveTo(-8, 0, -4, -5, 0, -12);
      c.fill();
      c.fillStyle = white;
      c.beginPath();
      c.arc(-3, 3, 2, 0, Math.PI * 2);
      c.fill();
      break;
    case "hoa":
      flame(9);
      c.fill();
      c.fillStyle = "#ffd34d";
      c.save();
      c.translate(0, 4);
      c.scale(0.5, 0.55);
      flame(9);
      c.fill();
      c.restore();
      break;
    case "tho":
      c.fillRect(-7, -7, 14, 14);
      c.strokeStyle = "rgba(0, 0, 0, 0.45)";
      c.lineWidth = 2;
      c.strokeRect(-7, -7, 14, 14);
      break;
    case "loi":
      c.beginPath();
      c.moveTo(-3, -13);
      c.lineTo(4, -3);
      c.lineTo(-2, -1);
      c.lineTo(4, 13);
      c.lineWidth = 3.5;
      c.stroke();
      c.strokeStyle = white;
      c.lineWidth = 1.2;
      c.stroke();
      break;
    case "phong":
      c.lineWidth = 2.5;
      c.beginPath();
      for (let k = 0; k <= 40; k++) {
        const a = (k / 40) * Math.PI * 3.2;
        const r = 1.5 + (k / 40) * 10;
        if (k === 0) c.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      c.stroke();
      break;
    case "quang":
      c.lineWidth = 2.5;
      c.beginPath();
      for (let k = 0; k < 8; k++) {
        const a = (k * Math.PI) / 4;
        const r = k % 2 ? 9 : 13;
        c.moveTo(Math.cos(a) * 3, Math.sin(a) * 3);
        c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      c.stroke();
      c.fillStyle = white;
      c.beginPath();
      c.arc(0, 0, 3, 0, Math.PI * 2);
      c.fill();
      break;
    case "am_lanh":
      c.globalAlpha = 0.85;
      c.beginPath();
      c.moveTo(0, -12);
      c.bezierCurveTo(7, -6, 2, -1, 8, 4);
      c.bezierCurveTo(10, 10, -10, 12, -8, 3);
      c.bezierCurveTo(-6, -3, -2, -5, 0, -12);
      c.fill();
      c.globalAlpha = 1;
      c.fillStyle = "rgba(220, 235, 255, 0.85)";
      c.beginPath();
      c.arc(-1, 5, 3, 0, Math.PI * 2);
      c.fill();
      break;
    case "cuc_duong":
      c.beginPath();
      c.arc(0, 0, 6, 0, Math.PI * 2);
      c.fill();
      c.lineWidth = 2;
      c.beginPath();
      for (let k = 0; k < 8; k++) {
        const a = (k * Math.PI) / 4;
        c.moveTo(Math.cos(a) * 8.5, Math.sin(a) * 8.5);
        c.lineTo(Math.cos(a) * 12.5, Math.sin(a) * 12.5);
      }
      c.stroke();
      break;
    case "cuc_am":
      c.beginPath();
      c.arc(0, 0, 11, 0, Math.PI * 2);
      c.fill();
      c.globalCompositeOperation = "destination-out";
      c.beginPath();
      c.arc(5, -3, 9, 0, Math.PI * 2);
      c.fill();
      c.globalCompositeOperation = "source-atop";
      c.strokeStyle = "#b9a6e0"; // viền sáng để màu tím than nổi trên nền tối
      c.lineWidth = 2;
      c.beginPath();
      c.arc(0, 0, 10.5, 0, Math.PI * 2);
      c.stroke();
      c.globalCompositeOperation = "source-over";
      break;
    case "cuc_han":
      c.lineWidth = 2;
      c.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = (k * Math.PI) / 3;
        const ex = Math.cos(a), ey = Math.sin(a);
        c.moveTo(0, 0);
        c.lineTo(ex * 12, ey * 12);
        // Nhánh nhỏ của bông tuyết
        const bx = ex * 7, by = ey * 7;
        c.moveTo(bx, by);
        c.lineTo(bx + Math.cos(a + 0.7) * 4, by + Math.sin(a + 0.7) * 4);
        c.moveTo(bx, by);
        c.lineTo(bx + Math.cos(a - 0.7) * 4, by + Math.sin(a - 0.7) * 4);
      }
      c.stroke();
      break;
  }
  sprites.set(el, cv);
  return cv;
}

/** Một hạt họa tiết của hệ tại (x, y), cạnh khoảng 2 × size đơn vị thế giới. */
export function drawMotif(
  ctx: CanvasRenderingContext2D, el: ElementId, x: number, y: number, size: number, rot: number, alpha: number,
): void {
  if (alpha <= 0 || size <= 0) return;
  ctx.save();
  ctx.globalAlpha = Math.min(1, alpha);
  ctx.translate(x, y);
  if (rot) ctx.rotate(rot);
  ctx.drawImage(sprite(el), -size, -size, 2 * size, 2 * size);
  ctx.restore();
}

/** Một hạt đang tàn theo a (0 → 1): rơi hoặc bay lên, xoay, lượn theo hệ. `ang` là hướng văng. */
export function particle(
  ctx: CanvasRenderingContext2D, el: ElementId, x: number, y: number, a: number, ang: number, size: number, k: number,
): void {
  const m = MOTION[el];
  const px = x + (m.wave ? Math.sin(a * 9 + k) * 4 : 0);
  const py = y + m.fall * a * a;
  const rot = (m.upright ? 0 : ang + Math.PI / 2) + m.turn * a;
  drawMotif(ctx, el, px, py, size * (1 - 0.4 * a), rot, 1 - a * a);
}

/**
 * Chùm hạt họa tiết văng ra từ (x, y) khi tàn dần theo a (0 → 1).
 * `s` là seed của sự kiện nên tua lại vẫn y hệt; `reach` là tầm văng, `size` cỡ hạt lúc đầu.
 */
export function burst(
  ctx: CanvasRenderingContext2D, el: ElementId, x: number, y: number, a: number,
  s: number, count: number, reach: number, size: number,
): void {
  if (a < 0 || a >= 1) return;
  const e = 1 - (1 - a) * (1 - a);
  for (let k = 0; k < count; k++) {
    s = next(s);
    const ang = (s / 4294967296) * Math.PI * 2;
    s = next(s);
    const r = reach * (0.55 + 0.45 * (s / 4294967296)) * e;
    particle(ctx, el, x + Math.cos(ang) * r, y + Math.sin(ang) * r, a, ang, size, k);
  }
}

/** Số ngẫu nhiên trong [0, 1) lấy từ seed. */
export function unit01(s: number): number {
  return s / 4294967296;
}

/** Seed của một sự kiện, để hạt văng giống nhau mỗi lần tua lại. */
export function seed(a: number, b: number, c: number): number {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35) ^ Math.imul(c + 1, 0x27d4eb2f);
  h ^= h >>> 15;
  return h >>> 0;
}

export function next(s: number): number {
  s = (s + 0x6d2b79f5) >>> 0;
  let x = Math.imul(s ^ (s >>> 15), s | 1);
  x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
  return (x ^ (x >>> 14)) >>> 0;
}

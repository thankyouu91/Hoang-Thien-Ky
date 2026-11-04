// Bộ đệm hình của lớp hiệu ứng: mỗi khung, các hàm hiệu ứng ghi từng tấm (quad) vào mảng Float32, rồi GPU vẽ cả mảng
// bằng instancing (mỗi lớp một lần vẽ). Không cần three, nên test bằng Node được.
//
// Toạ độ: (x, y) là điểm trên mặt đất theo toạ độ thế giới màn Trận (y hướng xuống), z là độ cao; lên cao z đơn vị thì
// lên màn hình z đơn vị (như hình người vẽ đứng). Mỗi tấm có tâm, nửa rộng hx, nửa cao hy, góc xoay trên mặt màn hình.
import { ELEMENT_STYLE } from "../theme/elements.ts";
import type { ElementId } from "../replay/types.ts";

/** Loại tấm; shader vẽ mỗi loại một hình. */
export const K = {
  SPRITE: 0, // ô trong atlas hạt; p = (ô, lõi trắng, 0, 0)
  GLOW: 1, // quầng tròn mềm; p = (độ cứng, lõi trắng, 0, 0)
  RING: 2, // vòng elip; p = (bán kính 0..1, dày, phủ trong, mềm), q = (số đoạn đứt, pha, tỉ lệ nét, quầng)
  ARC: 3, // vệt chém lưỡi liềm; p = (bán kính 0..1, nửa dày, mềm, lõi), q = (góc đầu, góc quét, đầu vệt 0..1, đuôi vệt 0..1)
  BEAM: 4, // dải sáng từ đầu này tới đầu kia; p = (alpha đầu, alpha cuối, lõi, mềm), q = (thon, 0, 0, 0)
  DOME: 5, // khiên bán cầu; p = (cao/rộng, độ đậm, lưới lục giác, 0), q = (pha vệt sáng, 0, 0, 0)
  RUNE: 6, // trận đồ, ấn; p = (góc xoay, phần đã sáng 0..1, kiểu, 0), q = (độ sáng, 0, 0, 0)
  RAYS: 7, // tia toả; p = (số tia, pha, độ nhọn, lõi)
  SHADE: 8, // phủ tối cả màn trừ quanh tâm; p = (bán kính sáng, bán kính tối hẳn, 0, 0)
} as const;
export type Kind = (typeof K)[keyof typeof K];

/** Lớp vẽ: dưới đất (trận đồ, vòng), quanh thân (khiên, xích), trên không (hạt, chớp). */
export const L = { GROUND: 0, BODY: 1, AIR: 2 } as const;
export type Layer = (typeof L)[keyof typeof L];
export const LAYERS = 3;

/** Số float mỗi tấm: (x, y, z, xoay) (hx, hy, cộng sáng, loại) (r, g, b, a) p q */
export const STRIDE = 20;

export type RGB = readonly [number, number, number];

export class Emitter {
  readonly data: Float32Array[];
  readonly count: number[];
  readonly cap: number;
  /** Số tấm bị bỏ vì đầy bộ đệm ở khung này */
  dropped = 0;

  constructor(cap = 6144) {
    this.cap = cap;
    this.data = Array.from({ length: LAYERS }, () => new Float32Array(cap * STRIDE));
    this.count = new Array(LAYERS).fill(0);
  }

  reset(): void {
    this.count.fill(0);
    this.dropped = 0;
  }

  get total(): number {
    return this.count.reduce((a, b) => a + b, 0);
  }

  /**
   * Thêm một tấm, trả về vị trí float đầu của nó (để ghi p, q) hoặc -1 khi đầy. `add`: 0 hòa màu thường, 1 cộng sáng
   * hoàn toàn; giữa là pha (alpha nhân trước nên một lần vẽ làm được cả hai).
   */
  quad(layer: Layer, kind: Kind, x: number, y: number, z: number, hx: number, hy: number, rot: number, c: RGB, a: number, add: number): number {
    if (a <= 0.003 || hx <= 0 || hy <= 0) return -1;
    const n = this.count[layer];
    if (n >= this.cap) {
      this.dropped++;
      return -1;
    }
    this.count[layer] = n + 1;
    const d = this.data[layer];
    const o = n * STRIDE;
    d[o] = x;
    d[o + 1] = y;
    d[o + 2] = z;
    d[o + 3] = rot;
    d[o + 4] = hx;
    d[o + 5] = hy;
    d[o + 6] = add;
    d[o + 7] = kind;
    d[o + 8] = c[0];
    d[o + 9] = c[1];
    d[o + 10] = c[2];
    d[o + 11] = a > 1 ? 1 : a;
    d.fill(0, o + 12, o + 20);
    return o;
  }

  /** Ghi p (4 số) cho tấm vừa thêm ở lớp `layer`. */
  p(layer: Layer, o: number, a: number, b = 0, c = 0, d = 0): void {
    if (o < 0) return;
    const x = this.data[layer];
    x[o + 12] = a;
    x[o + 13] = b;
    x[o + 14] = c;
    x[o + 15] = d;
  }

  q(layer: Layer, o: number, a: number, b = 0, c = 0, d = 0): void {
    if (o < 0) return;
    const x = this.data[layer];
    x[o + 16] = a;
    x[o + 17] = b;
    x[o + 18] = c;
    x[o + 19] = d;
  }
}

// ---- màu ----------------------------------------------------------------------------------------------------------

function hex(h: string): RGB {
  const v = parseInt(h.slice(1), 16);
  return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
}

export function mix(a: RGB, b: RGB, k: number): RGB {
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
}

export const WHITE: RGB = [1, 1, 1];
export const BLACK: RGB = [0, 0, 0];
export const GOLD: RGB = hex("#ffd34d");
export const GOLD_DEEP: RGB = hex("#e09a1e");
export const SEAL: RGB = hex("#b3261e");
export const PAPER: RGB = hex("#efe0b0");
export const HEAL: RGB = hex("#7bc96f");
export const DANGER: RGB = hex("#ff5a4f");

export interface ElementColors {
  /** Màu hệ đúng bảng GDD mục 15 (theme/elements.ts) */
  base: RGB;
  /** Bản sáng cho phần cộng sáng: hệ tối (Thủy, Cực âm, Âm lãnh) vẫn thấy được */
  glow: RGB;
  /** Bản đậm cho viền hòa màu thường */
  deep: RGB;
}

/** Màu của 12 hệ, lấy từ theme/elements.ts. */
export const COLORS = Object.fromEntries(
  (Object.keys(ELEMENT_STYLE) as ElementId[]).map((el) => {
    const base = hex(ELEMENT_STYLE[el].color);
    const m = Math.max(base[0], base[1], base[2], 0.05);
    const lifted: RGB = [base[0] / m, base[1] / m, base[2] / m];
    return [el, { base, glow: mix(lifted, WHITE, 0.25), deep: mix(base, BLACK, 0.35) }];
  }),
) as Record<ElementId, ElementColors>;

// ---- ô trong atlas hạt (atlas.ts vẽ đúng thứ tự này) ------------------------------------------------------------

export const CELL = {
  spark: 0,
  star: 1,
  ring: 2,
  dot: 3,
  talisman: 4,
  seal: 5,
  link: 6,
  ice: 7,
  rock: 8,
  shard: 9,
  ghost: 10,
  cross: 11,
  smoke: 12,
  streak: 13,
  glyphTuyet: 14,
  glyphPhong: 15,
  rune0: 16, // 16..19: bốn nét phù văn
  vine: 20,
  feather: 21,
  sword: 22,
  motif: 32, // 32..43: họa tiết 12 hệ theo thứ tự MOTIF_ORDER
} as const;

/** Thứ tự họa tiết hệ trong atlas (ô CELL.motif + i). */
export const MOTIF_ORDER: readonly ElementId[] = [
  "kim", "moc", "thuy", "hoa", "tho", "loi", "phong", "cuc_duong", "cuc_am", "cuc_han", "quang", "am_lanh",
];

export function motifCell(el: ElementId): number {
  return CELL.motif + MOTIF_ORDER.indexOf(el);
}

// Nhiễu dựng sẵn trên CPU một lần: ảnh 256 × 256, lặp liền mép, bốn kênh bốn tầng tần số.
// Shader chỉ đọc texture thay vì tính nhiễu từng điểm ảnh, nên cảnh động rẻ trên máy Android tầm trung.
// Hàm `sample` đọc đúng như LinearFilter + RepeatWrapping của GPU, để đặt cây, công trình lên sống núi bằng CPU.

export const NOISE_SIZE = 256;

/** Kênh: 0 = R hình lớn (4–64 ô), 1 = G vừa (8–64), 2 = B mịn (32–128), 3 = A vừa, seed khác. */
const CHANNELS: { base: number; octaves: number }[] = [
  { base: 4, octaves: 5 },
  { base: 8, octaves: 4 },
  { base: 32, octaves: 3 },
  { base: 16, octaves: 3 },
];

export interface NoiseField {
  readonly size: number;
  /** RGBA 8 bit, hàng 0 ở v = 0. */
  readonly data: Uint8Array;
  /** Giá trị 0..1 tại (u, v) như texture lặp, lọc song tuyến. */
  sample(u: number, v: number, channel: number): number;
}

function hash3(x: number, y: number, s: number): number {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(s, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function smooth(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

/** Nhiễu giá trị lặp theo chu kỳ `period` ô trên cả ảnh. */
function valueNoise(u: number, v: number, period: number, seed: number): number {
  const x = u * period;
  const y = v * period;
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = smooth(x - xi);
  const fy = smooth(y - yi);
  const x0 = ((xi % period) + period) % period;
  const y0 = ((yi % period) + period) % period;
  const x1 = (x0 + 1) % period;
  const y1 = (y0 + 1) % period;
  const a = hash3(x0, y0, seed);
  const b = hash3(x1, y0, seed);
  const c = hash3(x0, y1, seed);
  const d = hash3(x1, y1, seed);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

export function makeNoise(seed = 1): NoiseField {
  const n = NOISE_SIZE;
  const data = new Uint8Array(n * n * 4);
  const raw = new Float32Array(n * n);
  for (let ch = 0; ch < 4; ch++) {
    const { base, octaves } = CHANNELS[ch];
    let min = Infinity;
    let max = -Infinity;
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const u = (i + 0.5) / n;
        const v = (j + 0.5) / n;
        let sum = 0;
        let amp = 1;
        let norm = 0;
        for (let o = 0; o < octaves; o++) {
          sum += amp * valueNoise(u, v, base << o, seed * 31 + ch * 7 + o);
          norm += amp;
          amp *= 0.5;
        }
        const val = sum / norm;
        raw[j * n + i] = val;
        if (val < min) min = val;
        if (val > max) max = val;
      }
    }
    // Kéo giãn về đủ 0..1 để mọi kênh cùng thang khi chỉnh ngưỡng trong shader.
    const k = 255 / Math.max(1e-6, max - min);
    for (let p = 0; p < n * n; p++) data[p * 4 + ch] = Math.round((raw[p] - min) * k);
  }
  return {
    size: n,
    data,
    sample(u: number, v: number, channel: number): number {
      const x = u * n - 0.5;
      const y = v * n - 0.5;
      const xi = Math.floor(x);
      const yi = Math.floor(y);
      const fx = x - xi;
      const fy = y - yi;
      const x0 = ((xi % n) + n) % n;
      const y0 = ((yi % n) + n) % n;
      const x1 = (x0 + 1) % n;
      const y1 = (y0 + 1) % n;
      const at = (xx: number, yy: number) => data[(yy * n + xx) * 4 + channel] / 255;
      const a = at(x0, y0);
      const b = at(x1, y0);
      const c = at(x0, y1);
      const d = at(x1, y1);
      return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
    },
  };
}

/** Ngẫu nhiên có seed (mulberry32) cho bố cục cảnh; không dùng cho sim. */
export function rng(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Băm chuỗi thành seed (FNV-1a), để cùng mô hình + công trình luôn ra cùng hình. */
export function hashSeed(...parts: (string | number)[]): number {
  let h = 2166136261;
  const s = parts.join("|");
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

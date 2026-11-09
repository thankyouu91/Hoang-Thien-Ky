// Đổi màu áo theo hệ (gói 3, 2026-11-05): theo bảng assets/pixellab/nhan_vat/mau_he.json. Điểm ảnh của áo (hue trong
// dải của bộ áo, đủ bão hoà) thay bằng màu nội suy giữa ba tông đậm, giữa, nhạt của hệ theo độ sáng của chính điểm đó
// (chuẩn hoá trên dải đứng của bộ áo), nên nếp áo, bóng và viền sáng vẫn giữ. Da, tóc, viền đen, đồ da nâu, viền vàng
// không nằm trong dải hue nên không đổi.
// Mỗi (thân, áo, động tác, hệ) tính một lần khi trình duyệt rảnh rồi đệm; hàm recolor() thuần để test không cần trình duyệt.
import type { Sprites } from "../../assets/sprites.ts";
import type { Look } from "../../replay/types.ts";
import MAU from "../../../../assets/pixellab/nhan_vat/mau_he.json" with { type: "json" };

export type Rgb = [number, number, number];

/** Dải màu của một bộ áo: hue (độ, có thể vắt qua 0 khi đầu > cuối), độ bão hoà tối thiểu, độ trải tông. */
export interface AoSpec {
  hue: [number, number];
  sat: number;
  reach: number;
}

const AO = MAU.ao as unknown as Record<string, AoSpec>;
const HE = MAU.he as unknown as Record<string, [Rgb, Rgb, Rgb]>;

/** Bộ áo theo tài năng (tu thể võ phục, tu pháp đạo bào, sáu tài năng kia áo riêng). */
export const AO_THEO_TAI_NANG = MAU.tai_nang as Record<string, string>;

/** Hue (độ), độ bão hoà và độ sáng (0–1) kiểu HSL. */
export function hsl(r: number, g: number, b: number): [number, number, number] {
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  const l = (max + min) / 2;
  const d = max - min;
  if (d < 1e-6) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  const rr = r / 255, gg = g / 255, bb = b / 255;
  if (max === rr) h = ((gg - bb) / d) % 6;
  else if (max === gg) h = (bb - rr) / d + 2;
  else h = (rr - gg) / d + 4;
  h *= 60;
  return [h < 0 ? h + 360 : h, s, l];
}

const inHue = (h: number, [a, b]: [number, number]) => (a <= b ? h >= a && h <= b : h >= a || h <= b);

/** Điểm (r, g, b, a) có thuộc phần áo đổi màu không. */
export function isCloth(r: number, g: number, b: number, a: number, spec: AoSpec): boolean {
  if (a < 8) return false;
  const [h, s] = hsl(r, g, b);
  return s >= spec.sat && inHue(h, spec.hue);
}

/** Độ sáng nhỏ nhất và lớn nhất của phần áo trên một ảnh RGBA; null nếu không có điểm nào. */
export function lightRange(data: ArrayLike<number>, spec: AoSpec): [number, number] | null {
  let lo = 1;
  let hi = 0;
  for (let o = 0; o < data.length; o += 4) {
    if (!isCloth(data[o], data[o + 1], data[o + 2], data[o + 3], spec)) continue;
    const l = hsl(data[o], data[o + 1], data[o + 2])[2];
    if (l < lo) lo = l;
    if (l > hi) hi = l;
  }
  return hi >= lo ? [lo, hi] : null;
}

/** Màu nội suy giữa ba tông theo k (0 đậm, 0,5 giữa, 1 nhạt). */
export function toneAt(tones: [Rgb, Rgb, Rgb], k: number): Rgb {
  const t = Math.max(0, Math.min(1, k));
  const [a, b, u] = t < 0.5 ? [tones[0], tones[1], t / 0.5] : [tones[1], tones[2], (t - 0.5) / 0.5];
  return [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * u)) as Rgb;
}

/** Đổi màu phần áo trên mảng RGBA tại chỗ; trả số điểm đã đổi. `range` là độ sáng nhỏ nhất, lớn nhất của áo ở ảnh nghỉ. */
export function recolor(data: Uint8ClampedArray, spec: AoSpec, tones: [Rgb, Rgb, Rgb], range: [number, number]): number {
  const [lo, hi] = range;
  const span = Math.max(1e-6, hi - lo);
  let n = 0;
  for (let o = 0; o < data.length; o += 4) {
    if (!isCloth(data[o], data[o + 1], data[o + 2], data[o + 3], spec)) continue;
    const l = hsl(data[o], data[o + 1], data[o + 2])[2];
    const c = toneAt(tones, ((l - lo) / span) * spec.reach);
    data[o] = c[0];
    data[o + 1] = c[1];
    data[o + 2] = c[2];
    n++;
  }
  return n;
}

// ---- trong trình duyệt ----
// Không đổi màu ngay lúc vẽ (getImageData giữa trận làm giật hình): tintedStrip() chỉ trả dải đã có sẵn, chưa có thì
// xếp hàng và nơi vẽ dùng dải gốc. Hàng đợi chạy khi trình duyệt rảnh (requestIdleCallback, thiếu thì setTimeout), dải
// đứng xếp trước. Dải đổi màu cắt theo khung bao của nhân vật trên mọi khung (khoảng 0,8 MB mỗi bộ thân, áo, hệ với 10
// dải, thay vì 2,6 MB đủ khung 96 px); tổng giữ dưới TRAN_BO_NHO, quá thì bỏ dải lâu không dùng.

/** Dải đã đổi màu, cắt theo khung bao [x0, y0, w, h] trong khung gốc; khung f nằm ở (f·w, 0). */
export interface TintedStrip {
  img: HTMLCanvasElement;
  x0: number;
  y0: number;
  w: number;
  h: number;
}

/** Trần bộ nhớ của các dải đã đổi màu (byte RGBA). */
const TRAN_BO_NHO = 24 * 1024 * 1024;
/** Quỹ thời gian (ms) mỗi lần chạy hàng đợi khi trang không có lúc rảnh. */
const NGAN_SACH = 6;

const cache = new Map<string, { strip: TintedStrip; bytes: number }>(); // thứ tự chèn = dùng gần nhất ở cuối
let cacheBytes = 0;
const ranges = new Map<string, [number, number] | null>();
const queue: { key: string; sprites: Sprites; look: Look; anim: string }[] = [];
const queued = new Set<string>();
let scheduled = false;

const keyOf = (look: Look, anim: string) => `${look.body}/${look.outfit}/${anim}/${look.tint}`;

function pixels(img: CanvasImageSource, w: number, h: number): { ctx: CanvasRenderingContext2D; data: ImageData } | null {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0);
    return { ctx, data: ctx.getImageData(0, 0, w, h) };
  } catch {
    return null;
  }
}

/** Độ sáng của áo trên dải đứng của (thân, áo), làm thang chung cho mọi động tác của bộ áo đó. */
function rangeOf(sprites: Sprites, look: Look, spec: AoSpec): [number, number] | null | undefined {
  const key = `${look.body}/${look.outfit}`;
  if (ranges.has(key)) return ranges.get(key)!;
  const idle = sprites.asset(`nhan_vat/${look.body}/${look.outfit}/dung`);
  if (!idle?.img.complete || !idle.img.naturalWidth) return undefined; // chưa nạp xong: thử lại sau
  const px = pixels(idle.img, idle.img.naturalWidth, idle.img.naturalHeight);
  const r = px ? lightRange(px.data.data, spec) : null;
  ranges.set(key, r);
  return r;
}

/** Đổi màu một dải; false nếu hình chưa nạp xong (để thử lại), true khi đã xong hoặc không cần đổi. */
function build(job: { key: string; sprites: Sprites; look: Look; anim: string }): boolean {
  const { sprites, look, anim } = job;
  const spec = AO[look.outfit];
  const tones = look.tint && HE[look.tint];
  const asset = sprites.asset(`nhan_vat/${look.body}/${look.outfit}/${anim}`);
  if (!spec || !tones || !asset) return true;
  if (!asset.img.complete || !asset.img.naturalWidth) return false;
  const range = rangeOf(sprites, look, spec);
  if (range === undefined) return false;
  if (range === null) return true;
  const fw = asset.meta.frame_w ?? 96;
  const fh = asset.meta.frame_h ?? 96;
  const frames = asset.meta.frames ?? 1;
  const px = pixels(asset.img, fw * frames, fh);
  if (!px) return true;
  const d = px.data.data;
  recolor(d, spec, tones, range);
  // Khung bao chung của mọi khung, theo toạ độ trong khung.
  let x0 = fw, y0 = fh, x1 = 0, y1 = 0;
  for (let y = 0; y < fh; y++) {
    for (let x = 0; x < fw * frames; x++) {
      if (d[(y * fw * frames + x) * 4 + 3] < 8) continue;
      const fx = x % fw;
      if (fx < x0) x0 = fx;
      if (fx + 1 > x1) x1 = fx + 1;
      if (y < y0) y0 = y;
      if (y + 1 > y1) y1 = y + 1;
    }
  }
  if (x1 <= x0 || y1 <= y0) return true;
  const w = x1 - x0;
  const h = y1 - y0;
  px.ctx.putImageData(px.data, 0, 0);
  const out = document.createElement("canvas");
  out.width = w * frames;
  out.height = h;
  const octx = out.getContext("2d");
  if (!octx) return true;
  for (let f = 0; f < frames; f++) octx.drawImage(px.ctx.canvas, f * fw + x0, y0, w, h, f * w, 0, w, h);
  const bytes = w * h * frames * 4;
  cache.set(job.key, { strip: { img: out, x0, y0, w, h }, bytes });
  cacheBytes += bytes;
  // Quá trần: bỏ dải dùng lâu nhất (đầu Map).
  for (const [k, v] of cache) {
    if (cacheBytes <= TRAN_BO_NHO || k === job.key) break;
    cache.delete(k);
    cacheBytes -= v.bytes;
  }
  return true;
}

function schedule(): void {
  if (scheduled || !queue.length || typeof window === "undefined") return;
  scheduled = true;
  const run = (deadline?: IdleDeadline) => {
    scheduled = false;
    const start = performance.now();
    // Có lúc rảnh thì dùng hết phần rảnh; trang không bao giờ rảnh (vẽ liên tục, pane ẩn) thì idle callback chỉ chạy khi
    // hết hạn chờ với timeRemaining() bằng 0: khi đó tự cho một quỹ NGAN_SACH ms, và luôn làm ít nhất một dải.
    const budget = deadline && !deadline.didTimeout ? deadline.timeRemaining() - 1 : NGAN_SACH;
    let retry = 0;
    let done = 0;
    while (queue.length) {
      if (done > 0 && performance.now() - start >= budget) break;
      done++;
      const job = queue.shift()!;
      if (build(job)) queued.delete(job.key);
      else {
        queue.push(job); // hình chưa nạp: để cuối hàng
        if (++retry >= queue.length) break;
      }
    }
    if (queue.length) {
      // Còn việc mà toàn dải chưa nạp: đợi một chút rồi thử lại.
      if (retry && retry >= queue.length) setTimeout(schedule, 250);
      else schedule();
    }
  };
  if ("requestIdleCallback" in window) window.requestIdleCallback(run, { timeout: 200 });
  else setTimeout(() => run(), 32);
}

/** Xếp hàng đổi màu các dải `anims` của ngoại hình (bỏ qua nếu không đặt hệ, đã có hay đã xếp). Rẻ, gọi mỗi khung được. */
const pretinted = new Set<string>();

export function pretint(sprites: Sprites, look: Look, anims: readonly string[]): void {
  if (!look.tint || !AO[look.outfit]) return;
  // drawDang gọi mỗi khung với cả danh sách: cùng ngoại hình thì chỉ xếp một lần. Lời gọi một dải (tintedStrip, kể cả
  // dải đã bị bỏ vì trần bộ nhớ) thì luôn xét lại.
  if (anims.length > 1) {
    const once = `${look.body}/${look.outfit}/${look.tint}/${anims[0]}`;
    if (pretinted.has(once)) return;
    pretinted.add(once);
  }
  anims.forEach((anim, i) => {
    const key = keyOf(look, anim);
    if (cache.has(key) || queued.has(key)) return;
    queued.add(key);
    const job = { key, sprites, look: { body: look.body, outfit: look.outfit, tint: look.tint }, anim };
    // Dải đầu (dải đứng, hay dải đang cần vẽ) lên đầu hàng, để người mới vào trận đổi màu dáng đứng trước hết.
    if (i === 0) queue.unshift(job);
    else queue.push(job);
  });
  schedule();
}

/**
 * Dải `anim` đã đổi màu áo theo hệ `look.tint`, hay undefined (không đặt hệ, bộ áo không có trong bảng, chưa đổi xong).
 * Không tính ngay: chưa có thì xếp hàng; nơi vẽ dùng dải gốc khi undefined.
 */
export function tintedStrip(sprites: Sprites, look: Look, anim: string): TintedStrip | undefined {
  if (!look.tint || !AO[look.outfit]) return undefined;
  const key = keyOf(look, anim);
  const hit = cache.get(key);
  if (hit) {
    cache.delete(key); // dùng gần nhất: chuyển về cuối
    cache.set(key, hit);
    return hit.strip;
  }
  pretint(sprites, look, [anim]);
  return undefined;
}

/** Bộ nhớ đang dùng của các dải đổi màu (byte), để đo. */
export function tintedBytes(): number {
  return cacheBytes;
}

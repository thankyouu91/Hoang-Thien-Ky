// Hiệu ứng pixel làm bằng PixelLab vfx_workbench (assets/pixellab/vfx/): lưới khung, điểm gốc, fps trong manifest.
// Bản xám được tô theo màu hệ lúc chạy (một bộ khung dùng cho cả 12 hệ); khung trống ở cuối tự bỏ.
import type { Asset, Sprites } from "../assets/sprites.ts";
import type { ElementId } from "../replay/types.ts";
import { ELEMENT_STYLE } from "../theme/elements.ts";

export interface VfxInfo {
  /** Số khung có hình (đã bỏ khung trống ở cuối) */
  frames: number;
  fps: number;
  w: number;
  h: number;
  anchor: [number, number];
  loop: boolean;
}

interface Sheet extends VfxInfo {
  asset: Asset;
  cols: number;
  tint: boolean;
}

export class VfxLib {
  private sprites: Sprites;
  private sheets = new Map<string, Sheet | null>();
  private tinted = new Map<string, HTMLCanvasElement>();

  constructor(sprites: Sprites) {
    this.sprites = sprites;
  }

  /** Thông tin hiệu ứng `vfx/<name>`; undefined nếu hình chưa nạp. */
  info(name: string): VfxInfo | undefined {
    return this.sheet(name);
  }

  /**
   * Vẽ khung `frame` của hiệu ứng, điểm gốc đặt tại (x, y), co giãn sx, sy (đơn vị thế giới mỗi px ảnh).
   * `el` = hệ để tô (bỏ qua với hiệu ứng giữ màu). Trả về false nếu chưa có hình để nơi gọi vẽ bằng code.
   */
  draw(
    ctx: CanvasRenderingContext2D, name: string, el: ElementId | null, frame: number,
    x: number, y: number, sx: number, sy: number, alpha: number,
  ): boolean {
    const s = this.sheet(name);
    if (!s) return false;
    if (frame < 0 || frame >= s.frames || alpha <= 0) return true;
    const src = s.tint && el ? this.tintedSheet(name, s, el) : s.asset.img;
    const cx = (frame % s.cols) * s.w;
    const cy = Math.floor(frame / s.cols) * s.h;
    ctx.save();
    ctx.globalAlpha = Math.min(1, alpha);
    ctx.imageSmoothingEnabled = false;
    ctx.translate(x, y);
    ctx.scale(sx, sy);
    ctx.drawImage(src, cx, cy, s.w, s.h, -s.anchor[0], -s.anchor[1], s.w, s.h);
    ctx.restore();
    return true;
  }

  private sheet(name: string): Sheet | undefined {
    const cached = this.sheets.get(name);
    if (cached !== undefined) return cached ?? undefined;
    const asset = this.sprites.asset("vfx/" + name);
    const m = asset?.meta;
    if (!asset || !m?.frames || !m.frame_w || !m.frame_h) return undefined; // chưa nạp: thử lại khung sau
    const cols = m.cols ?? m.frames;
    const s: Sheet = {
      asset, cols, w: m.frame_w, h: m.frame_h, fps: m.fps ?? 12,
      anchor: m.anchor ?? [m.frame_w / 2, m.frame_h / 2],
      loop: m.loop ?? false, tint: m.tint ?? false,
      frames: m.loop ? m.frames : lastDrawnFrame(asset.img, m.frames, cols, m.frame_w, m.frame_h) + 1,
    };
    this.sheets.set(name, s);
    return s;
  }

  /** Cả lưới khung tô theo hệ: xám tối thành màu hệ đậm, xám giữa thành màu hệ, sáng thì ngả trắng. Làm một lần mỗi hệ. */
  private tintedSheet(name: string, s: Sheet, el: ElementId): HTMLCanvasElement {
    const key = name + "|" + el;
    const hit = this.tinted.get(key);
    if (hit) return hit;
    const img = s.asset.img;
    const cv = document.createElement("canvas");
    cv.width = img.naturalWidth;
    cv.height = img.naturalHeight;
    const c = cv.getContext("2d", { willReadFrequently: true })!;
    c.drawImage(img, 0, 0);
    const data = c.getImageData(0, 0, cv.width, cv.height);
    const [r, g, b] = hex(ELEMENT_STYLE[el].color);
    const px = data.data;
    for (let i = 0; i < px.length; i += 4) {
      if (px[i + 3] === 0) continue;
      const v = (px[i] + px[i + 1] + px[i + 2]) / 765;
      const k = v < 0.5 ? v * 2 : 1;
      const w = v < 0.5 ? 0 : (v - 0.5) * 2 * 0.85;
      px[i] = r * k + (255 - r * k) * w;
      px[i + 1] = g * k + (255 - g * k) * w;
      px[i + 2] = b * k + (255 - b * k) * w;
    }
    c.putImageData(data, 0, 0);
    this.tinted.set(key, cv);
    return cv;
  }
}

/** Chỉ số khung cuối cùng còn điểm ảnh (hiệu ứng một lần thường để trống vài khung cuối). */
function lastDrawnFrame(img: HTMLImageElement, frames: number, cols: number, w: number, h: number): number {
  const cv = document.createElement("canvas");
  cv.width = img.naturalWidth;
  cv.height = img.naturalHeight;
  const c = cv.getContext("2d", { willReadFrequently: true })!;
  c.drawImage(img, 0, 0);
  for (let f = frames - 1; f > 0; f--) {
    const d = c.getImageData((f % cols) * w, Math.floor(f / cols) * h, w, h).data;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 0) return f;
  }
  return 0;
}

function hex(color: string): [number, number, number] {
  const n = parseInt(color.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

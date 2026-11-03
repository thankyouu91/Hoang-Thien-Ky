// Ô nút của điểm trên bản đồ: ô vuông khung màu theo loại điểm (cửa bí cảnh theo bậc), trong ô là ký hiệu hệ của vùng
// (assets/pixellab/he/<mã hệ>.png). Mỗi kiểu ô vẽ sẵn một lần vào canvas nhỏ, mỗi khung chỉ còn một drawImage mỗi ô.
// Ô nào chồng lên ô quan trọng hơn thì bỏ, nên thu nhỏ chỉ còn thành chủ và các điểm chính, phóng to mới hiện hết.

const INK = "#2a1d14";
const FILL = "#f3e7c9";

/** Cạnh ô nút, px CSS. */
export const NODE = 20;
export const NODE_BIG = 26;
/** Khoảng trống tối thiểu giữa hai ô, px CSS. */
const GAP = 6;

export class NodeSprites {
  private icons = new Map<string, HTMLImageElement | null>();
  private cache = new Map<string, HTMLCanvasElement>();

  /** Ký hiệu hệ; chưa về thì undefined (ô vẽ trống, khung sau vẽ lại khi có). */
  private icon(element: string): HTMLImageElement | undefined {
    const got = this.icons.get(element);
    if (got !== undefined) return got ?? undefined;
    this.icons.set(element, null);
    const img = new Image();
    img.decoding = "async";
    img.src = `${import.meta.env.BASE_URL}pixellab/he/${element}.png`;
    img.decode().then(
      () => {
        this.icons.set(element, img);
        for (const k of [...this.cache.keys()]) if (k.includes(`|${element}|`)) this.cache.delete(k);
      },
      () => console.warn("Không nạp được ký hiệu hệ", element),
    );
    return undefined;
  }

  /** Ô nút cạnh `size` px CSS ở mật độ `dpr`. */
  get(color: string, element: string, size: number, dpr: number): HTMLCanvasElement {
    const key = `${color}|${element}|${size}|${dpr}`;
    let c = this.cache.get(key);
    if (c) return c;
    const icon = this.icon(element);
    const px = Math.round(size * dpr);
    const pad = Math.ceil(2 * dpr);
    c = document.createElement("canvas");
    c.width = c.height = px + pad;
    const g = c.getContext("2d")!;
    const big = size >= NODE_BIG;
    const line = Math.max(1, Math.round(dpr));
    const frame = Math.round((big ? 2.5 : 2) * dpr);
    // Bóng đổ nhẹ, viền mực, khung màu, lòng giấy, ký hiệu hệ.
    g.fillStyle = "rgba(42, 29, 20, 0.35)";
    g.fillRect(pad, pad, px, px);
    g.fillStyle = INK;
    g.fillRect(0, 0, px, px);
    g.fillStyle = color;
    g.fillRect(line, line, px - 2 * line, px - 2 * line);
    g.fillStyle = FILL;
    g.fillRect(line + frame, line + frame, px - 2 * (line + frame), px - 2 * (line + frame));
    if (big) {
      g.strokeStyle = color;
      g.lineWidth = line;
      const o = line + frame + line * 1.5;
      g.strokeRect(o, o, px - 2 * o, px - 2 * o);
    }
    if (icon) {
      const inset = line + frame + Math.round((big ? 2.5 : 1) * dpr);
      const s = px - 2 * inset;
      g.imageSmoothingEnabled = s < icon.width;
      g.drawImage(icon, inset, inset, s, s);
    }
    this.cache.set(key, c);
    return c;
  }
}

export interface Placed<T> {
  item: T;
  x: number;
  y: number;
  size: number;
}

/**
 * Xếp ô theo thứ tự quan trọng (đầu danh sách trước), bỏ ô chồng lên ô đã xếp. Lưới băm ô 32 px nên chỉ so với vài ô gần.
 */
export class Placer {
  private grid = new Map<number, { x0: number; y0: number; x1: number; y1: number }[]>();
  private readonly cell = 32;

  clear(): void {
    this.grid.clear();
  }

  /** Hình chữ nhật có còn trống không (không giữ chỗ). */
  fits(x0: number, y0: number, x1: number, y1: number): boolean {
    const c = this.cell;
    for (let cx = Math.floor(x0 / c); cx <= Math.floor(x1 / c); cx++)
      for (let cy = Math.floor(y0 / c); cy <= Math.floor(y1 / c); cy++)
        for (const r of this.grid.get(cx * 4096 + cy) ?? []) if (x0 < r.x1 && r.x0 < x1 && y0 < r.y1 && r.y0 < y1) return false;
    return true;
  }

  /** Thử đặt hình chữ nhật; trống thì giữ chỗ và trả true. */
  take(x0: number, y0: number, x1: number, y1: number): boolean {
    if (!this.fits(x0, y0, x1, y1)) return false;
    const c = this.cell;
    const cx0 = Math.floor(x0 / c);
    const cx1 = Math.floor(x1 / c);
    const cy0 = Math.floor(y0 / c);
    const cy1 = Math.floor(y1 / c);
    const r = { x0, y0, x1, y1 };
    for (let cx = cx0; cx <= cx1; cx++)
      for (let cy = cy0; cy <= cy1; cy++) {
        const k = cx * 4096 + cy;
        const list = this.grid.get(k);
        if (list) list.push(r);
        else this.grid.set(k, [r]);
      }
    return true;
  }

  /** Giữ chỗ cho ô nút (hay chấm) tâm (x, y), chừa khoảng trống `gap` quanh ô. */
  node(x: number, y: number, size: number, gap = GAP): boolean {
    const h = size / 2 + gap / 2;
    return this.take(x - h, y - h, x + h, y + h);
  }
}

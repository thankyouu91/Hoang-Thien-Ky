// Tải và vẽ bản đồ tranh cho nhanh trên điện thoại.
//  - Ảnh nền tải bằng fetch có tiến độ (thanh "Đang tải bản đồ"), giải mã bằng createImageBitmap, không chặn luồng chính.
//  - Trong lúc chờ đã có tấm tạm (màu giấy + đường + sương mù) nên bản đồ hiện ngay, chạm và kéo được.
//  - Khi thu nhỏ (mỗi px ảnh ≤ 0,5 px thiết bị), nền + đường + sương được nướng sẵn ở 1/4 và 1/2: mỗi khung một lần
//    drawImage từ tấm nhỏ, không phóng ảnh 1926 × 1842 và không dựng lại 360 chặng đường. Khi phóng to thì vẽ thẳng
//    ảnh nền, đường (Path2D dựng một lần) và sương; không nướng cả cỡ để khỏi tốn thêm ~14 MB.
//  - Hình đảo chỉ nạp ~20 hình cần cho bản đồ thay vì chờ cả manifest PixelLab (186 hình).
//  - MapScene.prefetch() được dashboard gọi lúc rảnh để mở tab Bản đồ là có ngay.
import { BG_SCALE, loadRegion, regionBackground, toImage, type RegionMap } from "./region.ts";

const PAPER = "#3b3226";
const FOG = "rgba(16, 13, 11, 0.62)";
/** Các mức nướng sẵn; trên mức lớn nhất thì vẽ thẳng. */
const LEVELS = [0.25, 0.5];
const FOG_DIV = 4;

interface Baked {
  scale: number;
  canvas: HTMLCanvasElement;
}

/** Lớp nền của một vùng: tải một lần, dùng chung cho mọi lần mở bản đồ. */
export class RegionLayers {
  readonly region: RegionMap;
  readonly w: number;
  readonly h: number;
  /** 0–1 trong lúc tải ảnh nền; 1 khi xong. */
  progress = 0;
  /** Gọi khi tiến độ tải đổi hoặc ảnh nền vừa về. */
  onChange?: () => void;
  private roads: { kind: string; path: Path2D }[] = [];
  private bg?: ImageBitmap | HTMLImageElement;
  private bgPromise?: Promise<void>;
  private fogKey = "";
  private revealed: number[] = [];
  private fog?: HTMLCanvasElement;
  private baked: Baked[] = [];

  constructor(region: RegionMap) {
    this.region = region;
    const [x0, y0, x1, y1] = region.map.frame;
    this.w = (x1 - x0) * BG_SCALE;
    this.h = (y1 - y0) * BG_SCALE;
    // Đường đi dựng một lần thành Path2D theo toạ độ ảnh, gom theo loại để mỗi loại một nét.
    for (const kind of ["loi_mon", "tieu_dao", "quan_dao"]) {
      const p = new Path2D();
      for (const e of region.edges) {
        if (e.kind !== kind) continue;
        e.path.forEach(([x, y], i) => {
          const q = toImage(region, x, y);
          if (i) p.lineTo(q.x, q.y);
          else p.moveTo(q.x, q.y);
        });
      }
      this.roads.push({ kind, path: p });
    }
  }

  get ready(): boolean {
    return this.progress >= 1;
  }

  /** Bắt đầu tải ảnh nền (một lần); `progress` tăng dần, xong thì nướng lại. */
  loadBackground(): Promise<void> {
    return (this.bgPromise ??= (async () => {
      const url = await regionBackground(this.region.region.code);
      if (url) {
        try {
          const res = await fetch(url);
          const total = Number(res.headers.get("content-length")) || 0;
          let blob: Blob;
          if (res.body && total) {
            const reader = res.body.getReader();
            const chunks: BlobPart[] = [];
            let got = 0;
            for (;;) {
              const { done, value } = await reader.read();
              if (done) break;
              chunks.push(value);
              got += value.length;
              this.progress = Math.min(0.95, got / total);
              this.onChange?.();
            }
            blob = new Blob(chunks, { type: res.headers.get("content-type") ?? "image/webp" });
          } else blob = await res.blob();
          this.bg = typeof createImageBitmap === "function" ? await createImageBitmap(blob) : await decodeImage(URL.createObjectURL(blob));
        } catch (e) {
          console.warn("Không nạp được ảnh nền bản đồ", url, e);
        }
      }
      this.progress = 1;
      this.baked = [];
      performance.mark("ban-do:anh-nen");
      this.onChange?.();
    })());
  }

  /** Đặt tập điểm đã mở sương; đổi thì dựng lại sương và các tấm nướng. */
  setRevealed(ids: number[]): void {
    const key = `${ids.length}:${ids.join(",")}`;
    if (key === this.fogKey) return;
    this.fogKey = key;
    this.revealed = ids;
    this.fog = undefined;
    this.baked = [];
  }

  /**
   * Vẽ phần ảnh [x0, x1] × [y0, y1] (toạ độ ảnh) vào ctx đã đặt biến đổi camera.
   * `devicePx` là số px thiết bị trên mỗi px ảnh ở độ phóng hiện tại.
   */
  draw(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, devicePx: number, zoom: number): void {
    if (x1 <= x0 || y1 <= y0) return;
    if (!this.baked.length) this.bake();
    const lvl = this.baked.find((b) => b.scale >= devicePx);
    if (lvl || !this.bg) {
      const b = lvl ?? this.baked[this.baked.length - 1];
      const k = b.scale;
      ctx.drawImage(b.canvas, x0 * k, y0 * k, (x1 - x0) * k, (y1 - y0) * k, x0, y0, x1 - x0, y1 - y0);
      return;
    }
    // Phóng to: vẽ thẳng phần đang thấy của ảnh nền, đường và sương.
    ctx.drawImage(this.bg, x0, y0, x1 - x0, y1 - y0, x0, y0, x1 - x0, y1 - y0);
    this.strokeRoads(ctx, Math.max(1, 1 / zoom));
    const f = this.fogCanvas();
    ctx.drawImage(f, x0 / FOG_DIV, y0 / FOG_DIV, (x1 - x0) / FOG_DIV, (y1 - y0) / FOG_DIV, x0, y0, x1 - x0, y1 - y0);
  }

  private strokeRoads(g: CanvasRenderingContext2D, widthMul: number): void {
    for (const r of this.roads) {
      g.lineWidth = (r.kind === "quan_dao" ? 3 : r.kind === "tieu_dao" ? 2 : 1.5) * widthMul;
      g.strokeStyle = r.kind === "loi_mon" ? "rgba(70, 48, 28, 0.35)" : "rgba(70, 48, 28, 0.55)";
      g.setLineDash(r.kind === "loi_mon" ? [6, 6] : []);
      g.stroke(r.path);
    }
    g.setLineDash([]);
  }

  /** Nướng nền + đường + sương ở các mức nhỏ. Chưa có ảnh nền thì chỉ một tấm tạm 1/4 trên màu giấy. */
  private bake(): void {
    const fog = this.fogCanvas();
    this.baked = (this.bg ? LEVELS : [LEVELS[0]]).map((scale) => {
      const c = document.createElement("canvas");
      c.width = Math.ceil(this.w * scale);
      c.height = Math.ceil(this.h * scale);
      const g = c.getContext("2d", { alpha: false })!;
      g.scale(scale, scale);
      if (this.bg) g.drawImage(this.bg, 0, 0, this.w, this.h);
      else {
        g.fillStyle = PAPER;
        g.fillRect(0, 0, this.w, this.h);
      }
      // Nét đường giữ độ dày ít nhất 1 px thiết bị ở mức nhỏ.
      this.strokeRoads(g, Math.max(1, 0.5 / scale));
      g.drawImage(fog, 0, 0, this.w, this.h);
      return { scale, canvas: c };
    });
  }

  /** Sương mù ở 1/4 độ phân giải: phủ tối rồi khoét quanh các điểm đã mở. */
  private fogCanvas(): HTMLCanvasElement {
    if (this.fog) return this.fog;
    const c = document.createElement("canvas");
    c.width = Math.ceil(this.w / FOG_DIV);
    c.height = Math.ceil(this.h / FOG_DIV);
    const f = c.getContext("2d")!;
    f.fillStyle = FOG;
    f.fillRect(0, 0, c.width, c.height);
    f.globalCompositeOperation = "destination-out";
    const r = 70 / FOG_DIV;
    for (const id of this.revealed) {
      const p = toImage(this.region, this.region.points[id].x, this.region.points[id].y);
      const g = f.createRadialGradient(p.x / FOG_DIV, p.y / FOG_DIV, r * 0.35, p.x / FOG_DIV, p.y / FOG_DIV, r);
      g.addColorStop(0, "rgba(0,0,0,1)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      f.fillStyle = g;
      f.fillRect(p.x / FOG_DIV - r, p.y / FOG_DIV - r, r * 2, r * 2);
    }
    return (this.fog = c);
  }
}

function decodeImage(src: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.src = src;
  return img.decode().then(() => img);
}

const layers = new Map<string, Promise<RegionLayers>>();

/** Lớp nền của vùng, dùng chung giữa prefetch và màn bản đồ. */
export function regionLayers(code: string): Promise<RegionLayers> {
  let p = layers.get(code);
  if (!p) {
    p = loadRegion(code).then((m) => new RegionLayers(m));
    layers.set(code, p);
  }
  return p;
}

/** Hình đảo nổi cho điểm bản đồ: chỉ nạp các khoá cần, không chờ cả manifest PixelLab. */
export class IslandImages {
  private images = new Map<string, HTMLImageElement>();
  private loading = new Set<string>();

  get(key: string): HTMLImageElement | undefined {
    const img = this.images.get(key);
    if (img) return img;
    if (!this.loading.has(key)) {
      this.loading.add(key);
      const el = new Image();
      el.decoding = "async";
      el.src = `${import.meta.env.BASE_URL}pixellab/${key}.png`;
      el.decode().then(
        () => void this.images.set(key, el),
        () => console.warn("Không nạp được hình đảo", key),
      );
    }
    return undefined;
  }

  /** Nạp trước một loạt khoá (lúc rảnh). */
  preload(keys: Iterable<string>): void {
    for (const k of keys) this.get(k);
  }
}

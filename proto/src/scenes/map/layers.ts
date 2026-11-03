// Nền bản đồ cả vị diện, tải và vẽ cho nhanh trên điện thoại. Toạ độ thế giới là toạ độ bản đồ 1536 × 1024.
//  - Ảnh nền chia ô (data/maps/ha_nen/x{mức}/{cột}_{hàng}.webp, mục lục ha_vi_dien.json): chọn mức theo số px thiết bị
//    trên mỗi đơn vị bản đồ, chỉ tải các ô giao với khung nhìn; mức nhỏ nhất (2 ô) luôn tải làm lớp lót khi ô mức cao chưa về.
//  - Chưa có ô thì dùng ảnh nền từng vùng (ha_nen_<mã>.webp, khung frame, ×6). Mỗi vùng giữ một tấm nhỏ 1,5 px/đơn vị để
//    vẽ khi thu nhỏ và tối đa 3 ảnh đầy đủ cho các vùng đang xem khi phóng to. Các ảnh là phần cắt của cùng một bản vẽ nên
//    chồng lên nhau không lộ mép.
//  - Tải tối đa 2 ảnh một lúc theo thứ tự cần: vùng của người chơi trước, rồi gần tâm khung nhìn trước. Ảnh tải bằng fetch
//    có tiến độ, giải mã bằng createImageBitmap, không chặn luồng chính.
//  - Đường đi (Path2D dựng một lần mỗi vùng), ranh giới vùng và sương mù vẽ chồng lên nền.
import { REGION_BG_SCALE, regionBackground, tileUrl, type RegionMap, type WorldMap } from "./region.ts";

/** Màu giấy ở mép ảnh nền Azgaar, lót dưới phần chưa có ảnh. */
export const PAPER = "#b9a080";
/** Sương mù là lớp giấy nhạt phủ lên phần chưa mở, không phủ đen. */
const FOG = "rgba(238, 226, 198, 0.74)";
const FOG_DIV = 2;
const FOG_R = 14;
/** Px trên mỗi đơn vị bản đồ của tấm nhỏ mỗi vùng. */
const SMALL = 1.5;
const MAX_FULL = 3;
const MAX_TILES = 20;
const PARALLEL = 2;

type Bitmap = ImageBitmap | HTMLImageElement;

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Một ảnh nền: một ô ở một mức, hoặc ảnh của một vùng. */
interface Piece extends Rect {
  url: () => Promise<string>;
  /** Px ảnh trên mỗi đơn vị bản đồ. */
  scale: number;
  state: "idle" | "loading" | "ready" | "error";
  /** Ảnh vùng: giữ file nén để giải mã lại khi cần phóng to. */
  blob?: Blob;
  small?: HTMLCanvasElement;
  full?: Bitmap;
  decoding?: boolean;
  /** Tỉ lệ đã tải (ảnh cần trước, cho thanh tải). */
  got?: number;
  /** Khung gần nhất có vẽ ảnh đầy đủ (dọn ảnh ít dùng). */
  used: number;
}

const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

export class WorldLayers {
  readonly world: WorldMap;
  readonly w: number;
  readonly h: number;
  /** Mức ảnh nền chia ô có trong repo, tăng dần; rỗng thì dùng ảnh từng vùng. */
  private levels: number[];
  private tiles = new Map<string, Piece>();
  private regions = new Map<string, Piece>();
  /** Ảnh phải về trước khi tắt thanh tải (vùng của người chơi, hoặc lớp ô lót). */
  private primary: Piece[] = [];
  private queue: Piece[] = [];
  private active = 0;
  private frameNo = 0;
  private roads = new Map<string, { kind: string; path: Path2D }[]>();
  private borders: { outer: Path2D; inner: Path2D };
  /** Phần ngoài đất liền (quanh vị diện và lòng giữa), tô một màu giấy để ảnh từng vùng không lộ mép ở đó. */
  private outside: Path2D;
  private fog?: HTMLCanvasElement;
  private fogKey = "";
  private revealed: { x: number; y: number }[] = [];
  /** 0–1 trong lúc tải ảnh đầu tiên cần; 1 khi xong. */
  progress = 0;
  /** Gọi khi tiến độ tải đổi hoặc ảnh vừa về. */
  onChange?: () => void;

  constructor(world: WorldMap) {
    this.world = world;
    this.w = world.map.width;
    this.h = world.map.height;
    const bg = world.background;
    this.levels = bg.levels.filter((l) => tileUrl(bg.path, l.level, 0, 0)).map((l) => l.level).sort((a, b) => a - b);
    for (const l of bg.levels) {
      if (!this.levels.includes(l.level)) continue;
      const size = bg.tile / l.level;
      for (let c = 0; c < l.cols; c++)
        for (let r = 0; r < l.rows; r++) {
          const url = tileUrl(bg.path, l.level, c, r);
          const x = c * size;
          const y = r * size;
          if (url) this.tiles.set(`${l.level}/${c}/${r}`, { url, x, y, w: Math.min(size, this.w - x), h: Math.min(size, this.h - y), scale: l.level, state: "idle", used: 0 });
        }
    }
    if (!this.levels.length)
      for (const r of world.regions) {
        const url = regionBackground(r.code);
        const [x0, y0, x1, y1] = r.frame;
        if (url) this.regions.set(r.code, { url, x: x0, y: y0, w: x1 - x0, h: y1 - y0, scale: REGION_BG_SCALE, state: "idle", used: 0 });
      }
    // Ranh giới dựng một lần: mép ngoài nét liền, giữa hai vùng nét đứt.
    const outer = new Path2D();
    const inner = new Path2D();
    for (const b of world.borders) {
      const p = b.between[1] ? inner : outer;
      b.path.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y)));
    }
    this.borders = { outer, inner };
    this.outside = new Path2D();
    this.outside.rect(0, 0, this.w, this.h);
    for (const ring of rings(world.borders.filter((b) => !b.between[1]).map((b) => b.path)))
      ring.forEach(([x, y], i) => (i ? this.outside.lineTo(x, y) : this.outside.moveTo(x, y)));
  }

  get ready(): boolean {
    return this.progress >= 1;
  }

  /** Bắt đầu tải phần nền cần trước: lớp ô lót, hoặc ảnh vùng của người chơi. */
  prefetch(regionCode: string): void {
    if (this.levels.length) this.primary = [...this.tiles.values()].filter((t) => t.scale === this.levels[0]);
    else this.primary = [this.regions.get(regionCode)].filter((p): p is Piece => !!p);
    if (!this.primary.length) {
      this.progress = 1;
      return;
    }
    for (const p of this.primary) this.load(p);
  }

  /** Đường đi của một vùng (dựng một lần khi file điểm về). */
  addRegion(m: RegionMap): void {
    if (this.roads.has(m.region.code)) return;
    const list: { kind: string; path: Path2D }[] = [];
    for (const kind of ["loi_mon", "tieu_dao", "quan_dao"]) {
      const p = new Path2D();
      for (const e of m.edges) if (e.kind === kind) e.path.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y)));
      list.push({ kind, path: p });
    }
    this.roads.set(m.region.code, list);
  }

  /** Đặt các điểm đã mở sương; đổi thì dựng lại sương. */
  setRevealed(points: { x: number; y: number }[]): void {
    const key = points.map((p) => `${p.x},${p.y}`).join(";");
    if (key === this.fogKey) return;
    this.fogKey = key;
    this.revealed = points;
    this.fog = undefined;
  }

  /**
   * Vẽ nền phần `view` (toạ độ bản đồ) vào ctx đã đặt biến đổi camera. `devicePx` là số px thiết bị trên mỗi đơn vị bản đồ,
   * `zoom` là số px CSS trên mỗi đơn vị.
   */
  drawBackground(ctx: CanvasRenderingContext2D, view: Rect, devicePx: number): void {
    this.frameNo++;
    const v = { x: Math.max(0, view.x), y: Math.max(0, view.y), w: Math.min(this.w, view.x + view.w) - Math.max(0, view.x), h: Math.min(this.h, view.y + view.h) - Math.max(0, view.y) };
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, this.w, this.h);
    if (v.w <= 0 || v.h <= 0) return;
    const cx = v.x + v.w / 2;
    const cy = v.y + v.h / 2;
    const near = (a: Piece, b: Piece) => Math.hypot(a.x + a.w / 2 - cx, a.y + a.h / 2 - cy) - Math.hypot(b.x + b.w / 2 - cx, b.y + b.h / 2 - cy);
    const want: Piece[] = [];
    if (this.levels.length) {
      const base = this.levels[0];
      const top = this.levels.find((l) => l >= devicePx) ?? this.levels[this.levels.length - 1];
      for (const lvl of base === top ? [base] : [base, top]) {
        const inView = [...this.tiles.values()].filter((t) => t.scale === lvl && overlaps(t, v)).sort(near);
        want.push(...inView);
        for (const t of inView) if (t.full) this.blit(ctx, t, t.full, v);
      }
      this.evict([...this.tiles.values()].filter((t) => t.full), MAX_TILES, (t) => {
        if (t.full && "close" in t.full) t.full.close();
        t.full = undefined;
        t.state = "idle";
      });
    } else {
      const inView = [...this.regions.values()].filter((r) => overlaps(r, v)).sort(near);
      want.push(...inView);
      for (const r of inView) if (r.small) this.blit(ctx, r, r.small, v);
      if (devicePx > SMALL * 1.1)
        for (const r of inView) {
          if (r.full) this.blit(ctx, r, r.full, v);
          else void this.decodeFull(r);
        }
      this.evict([...this.regions.values()].filter((r) => r.full), MAX_FULL, (r) => {
        if (r.full && "close" in r.full) r.full.close();
        r.full = undefined;
      });
      ctx.fillStyle = PAPER;
      ctx.fill(this.outside, "evenodd");
    }
    this.queue = [...this.primary, ...want];
    this.pump();
  }

  /** Đường đi của các vùng đã có file điểm, chỉ phần đang thấy. */
  drawRoads(ctx: CanvasRenderingContext2D, zoom: number, codes: Iterable<string>): void {
    for (const code of codes)
      for (const r of this.roads.get(code) ?? []) {
        ctx.lineWidth = (r.kind === "quan_dao" ? 2 : r.kind === "tieu_dao" ? 1.4 : 1) / zoom;
        ctx.strokeStyle = r.kind === "loi_mon" ? "rgba(70, 48, 28, 0.35)" : "rgba(70, 48, 28, 0.55)";
        ctx.setLineDash(r.kind === "loi_mon" ? [4 / zoom, 4 / zoom] : []);
        ctx.stroke(r.path);
      }
    ctx.setLineDash([]);
  }

  drawBorders(ctx: CanvasRenderingContext2D, zoom: number): void {
    ctx.strokeStyle = "rgba(92, 40, 24, 0.75)";
    ctx.lineWidth = 1.6 / zoom;
    ctx.setLineDash([6 / zoom, 4 / zoom]);
    ctx.stroke(this.borders.inner);
    ctx.setLineDash([]);
    ctx.lineWidth = 2.2 / zoom;
    ctx.stroke(this.borders.outer);
  }

  drawFog(ctx: CanvasRenderingContext2D, view: Rect): void {
    const f = this.fogCanvas();
    const x0 = Math.max(0, view.x);
    const y0 = Math.max(0, view.y);
    const x1 = Math.min(this.w, view.x + view.w);
    const y1 = Math.min(this.h, view.y + view.h);
    if (x1 > x0 && y1 > y0) ctx.drawImage(f, x0 / FOG_DIV, y0 / FOG_DIV, (x1 - x0) / FOG_DIV, (y1 - y0) / FOG_DIV, x0, y0, x1 - x0, y1 - y0);
  }

  /** Vẽ phần giao của ảnh với khung nhìn. */
  private blit(ctx: CanvasRenderingContext2D, p: Piece, img: Bitmap | HTMLCanvasElement, v: Rect): void {
    if (img === p.full) p.used = this.frameNo;
    const x0 = Math.max(p.x, v.x);
    const y0 = Math.max(p.y, v.y);
    const x1 = Math.min(p.x + p.w, v.x + v.w);
    const y1 = Math.min(p.y + p.h, v.y + v.h);
    if (x1 <= x0 || y1 <= y0) return;
    const k = img.width / p.w;
    ctx.drawImage(img, (x0 - p.x) * k, (y0 - p.y) * k, (x1 - x0) * k, (y1 - y0) * k, x0, y0, x1 - x0, y1 - y0);
  }

  /** Bỏ bớt ảnh đã giải mã lâu không vẽ, giữ tối đa `max` ảnh. */
  private evict(list: Piece[], max: number, drop: (p: Piece) => void): void {
    if (list.length <= max) return;
    list.sort((a, b) => a.used - b.used);
    for (const p of list.slice(0, list.length - max)) if (p.used < this.frameNo) drop(p);
  }

  private pump(): void {
    while (this.active < PARALLEL) {
      const next = this.queue.find((p) => p.state === "idle");
      if (!next) return;
      this.load(next);
    }
  }

  private load(p: Piece): void {
    if (p.state !== "idle") return;
    p.state = "loading";
    this.active++;
    void (async () => {
      try {
        const res = await fetch(await p.url());
        const blob = await this.readBlob(res, this.primary.includes(p) ? p : undefined);
        const img = await decode(blob);
        if (p.scale === REGION_BG_SCALE && !this.levels.length) {
          // Ảnh vùng: giữ tấm nhỏ, ảnh đầy đủ chỉ giữ khi đang phóng to ở đó (drawBackground tự dọn).
          const c = document.createElement("canvas");
          c.width = Math.ceil(p.w * SMALL);
          c.height = Math.ceil(p.h * SMALL);
          const g = c.getContext("2d", { alpha: false })!;
          g.imageSmoothingQuality = "high";
          g.drawImage(img, 0, 0, c.width, c.height);
          p.small = c;
          p.blob = blob;
        }
        p.full = img;
        p.used = this.frameNo;
        p.state = "ready";
      } catch (e) {
        console.warn("Không nạp được ảnh nền bản đồ", e);
        p.state = "error";
      }
      this.active--;
      this.updateProgress();
      this.pump();
    })();
  }

  /** Đọc thân trả về, báo tiến độ nếu là ảnh cần trước. */
  private async readBlob(res: Response, tracked?: Piece): Promise<Blob> {
    const total = Number(res.headers.get("content-length")) || 0;
    if (!tracked || !res.body || !total) return res.blob();
    const reader = res.body.getReader();
    const chunks: BlobPart[] = [];
    let got = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      got += value.length;
      tracked.got = got / total;
      this.updateProgress();
    }
    return new Blob(chunks, { type: res.headers.get("content-type") ?? "image/webp" });
  }

  private updateProgress(): void {
    if (!this.primary.length) return;
    const done = this.primary.reduce((s, p) => s + (p.state === "ready" || p.state === "error" ? 1 : Math.min(0.95, p.got ?? 0)), 0);
    const was = this.progress;
    this.progress = done / this.primary.length;
    if (this.progress >= 1 && was < 1) performance.mark("ban-do:anh-nen");
    this.onChange?.();
  }

  private async decodeFull(p: Piece): Promise<void> {
    if (p.decoding || !p.blob) return;
    p.decoding = true;
    try {
      p.full = await decode(p.blob);
      p.used = this.frameNo;
    } finally {
      p.decoding = false;
    }
  }

  /** Sương mù ở 1/2 độ phân giải: phủ giấy nhạt rồi khoét quanh các điểm đã mở. */
  private fogCanvas(): HTMLCanvasElement {
    if (this.fog) return this.fog;
    const c = document.createElement("canvas");
    c.width = Math.ceil(this.w / FOG_DIV);
    c.height = Math.ceil(this.h / FOG_DIV);
    const f = c.getContext("2d")!;
    f.fillStyle = FOG;
    f.fillRect(0, 0, c.width, c.height);
    f.globalCompositeOperation = "destination-out";
    const r = FOG_R / FOG_DIV;
    for (const p of this.revealed) {
      const x = p.x / FOG_DIV;
      const y = p.y / FOG_DIV;
      const g = f.createRadialGradient(x, y, r * 0.35, x, y, r);
      g.addColorStop(0, "rgba(0,0,0,1)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      f.fillStyle = g;
      f.fillRect(x - r, y - r, r * 2, r * 2);
    }
    return (this.fog = c);
  }
}

/** Nối các đoạn mép ngoài (đầu đoạn này trùng cuối đoạn kia) thành vòng khép kín. */
function rings(parts: [number, number][][]): [number, number][][] {
  const key = (p: [number, number]) => `${p[0]},${p[1]}`;
  const left = new Set(parts.map((_, i) => i));
  const out: [number, number][][] = [];
  while (left.size) {
    const first = left.values().next().value!;
    left.delete(first);
    const ring = [...parts[first]];
    for (;;) {
      const end = key(ring[ring.length - 1]);
      let next = -1;
      let flip = false;
      for (const i of left) {
        if (key(parts[i][0]) === end) next = i;
        else if (key(parts[i][parts[i].length - 1]) === end) (next = i), (flip = true);
        if (next >= 0) break;
      }
      if (next < 0) break;
      left.delete(next);
      ring.push(...(flip ? [...parts[next]].reverse() : parts[next]).slice(1));
    }
    out.push(ring);
  }
  return out;
}

async function decode(blob: Blob): Promise<Bitmap> {
  if (typeof createImageBitmap === "function") return createImageBitmap(blob);
  const img = new Image();
  img.src = URL.createObjectURL(blob);
  await img.decode();
  return img;
}

// Nền bản đồ cả vị diện, tải và vẽ cho nhanh trên điện thoại. Toạ độ thế giới là toạ độ bản đồ 1536 × 1024.
//  - Ảnh nền chia ô (data/maps/ha_nen/x{mức}/{cột}_{hàng}.webp, mục lục ha_vi_dien.json): mức nhỏ nhất (2 ô, ~310 KB) luôn
//    tải trước làm lớp lót; trên đó vẽ mức nhỏ nhất đủ nét cho số px thiết bị trên mỗi đơn vị bản đồ, chỉ các ô giao với
//    khung nhìn. Ô mức chi tiết chỉ tải khi khung nhìn đứng yên một chút, nên lúc phóng hay bay không tải ô của các mức đi qua.
//  - Tải tối đa 2 ô một lúc, ô gần tâm khung nhìn trước; giữ tối đa 20 ô đã giải mã. Ảnh tải bằng fetch có tiến độ, giải mã
//    bằng createImageBitmap, không chặn luồng chính.
//  - Đường đi (Path2D dựng một lần mỗi vùng), ranh giới vùng và sương mù vẽ chồng lên nền.
import { tileUrl, type RegionMap, type WorldMap } from "./region.ts";

/** Màu giấy ở mép ảnh nền Azgaar, lót dưới phần chưa có ảnh. */
export const PAPER = "#b9a080";
/** Sương mù là lớp giấy nhạt phủ lên phần chưa mở, không phủ đen. */
const FOG = "rgba(238, 226, 198, 0.74)";
const FOG_DIV = 2;
const FOG_R = 14;
const MAX_TILES = 20;
const PARALLEL = 2;
/** Ô chi tiết chỉ tải khi tập ô cần đứng yên chừng này ms. */
const SETTLE_MS = 150;

type Bitmap = ImageBitmap | HTMLImageElement;

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Một ô ảnh nền ở một mức. */
interface Tile extends Rect {
  url: () => Promise<string>;
  /** Mức = px ảnh trên mỗi đơn vị bản đồ. */
  level: number;
  state: "idle" | "loading" | "ready" | "error";
  img?: Bitmap;
  /** Tỉ lệ đã tải (ô lót, cho thanh tải). */
  got?: number;
  /** Khung gần nhất có vẽ ô này (dọn ô ít dùng). */
  used: number;
}

const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

export class WorldLayers {
  readonly world: WorldMap;
  readonly w: number;
  readonly h: number;
  /** Mức ảnh nền có trong repo, tăng dần. */
  private levels: number[];
  private tiles: Tile[] = [];
  /** Ô lót: phải về hết mới tắt thanh tải. */
  private base: Tile[] = [];
  private queue: Tile[] = [];
  /** Tập ô mức chi tiết đang cần và lúc nó đổi lần cuối. */
  private detailKey = "";
  private detailSince = 0;
  private active = 0;
  private frameNo = 0;
  private roads = new Map<string, { kind: string; path: Path2D }[]>();
  private borders: { outer: Path2D; inner: Path2D };
  /** Khu đặc biệt (Linh Hải Cấm Khu): hình khu nối từ các đoạn ranh giới giáp khu, tô màu cảnh báo, viền đỏ. */
  private zones: Path2D[] = [];
  private fog?: HTMLCanvasElement;
  private fogKey = "";
  private revealed: { x: number; y: number }[] = [];
  /** 0–1 trong lúc tải ô lót; 1 khi xong. */
  progress = 0;
  /** Gọi khi tiến độ tải đổi hoặc ô vừa về. */
  onChange?: () => void;

  constructor(world: WorldMap) {
    this.world = world;
    this.w = world.map.width;
    this.h = world.map.height;
    const bg = world.background;
    for (const l of bg.levels) {
      const size = bg.tile / l.level;
      for (let c = 0; c < l.cols; c++)
        for (let r = 0; r < l.rows; r++) {
          const url = tileUrl(bg.path, l.level, c, r);
          const x = c * size;
          const y = r * size;
          if (url) this.tiles.push({ url, x, y, w: Math.min(size, this.w - x), h: Math.min(size, this.h - y), level: l.level, state: "idle", used: 0 });
        }
    }
    this.levels = [...new Set(this.tiles.map((t) => t.level))].sort((a, b) => a - b);
    this.base = this.tiles.filter((t) => t.level === this.levels[0]);
    // Ranh giới dựng một lần: mép ngoài nét liền, giữa hai vùng nét đứt; ranh giáp khu đặc biệt vẽ riêng (drawZones).
    const zoneCodes = new Set((world.zones ?? []).map((z) => z.code));
    const outer = new Path2D();
    const inner = new Path2D();
    for (const b of world.borders) {
      if (b.between.some((c) => c && zoneCodes.has(c))) continue;
      const p = b.between[1] ? inner : outer;
      b.path.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y)));
    }
    this.borders = { outer, inner };
    for (const code of zoneCodes) {
      const p = new Path2D();
      for (const ring of rings(world.borders.filter((b) => b.between.includes(code)).map((b) => b.path)))
        ring.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y)));
      p.closePath();
      this.zones.push(p);
    }
  }

  get ready(): boolean {
    return this.progress >= 1;
  }

  /** Bắt đầu tải lớp ô lót (gọi sớm, lúc rảnh). */
  prefetch(): void {
    if (!this.base.length) this.progress = 1;
    for (const t of this.base) this.load(t);
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

  /** Vẽ nền phần `view` (toạ độ bản đồ) vào ctx đã đặt biến đổi camera; `devicePx` là số px thiết bị trên mỗi đơn vị bản đồ. */
  drawBackground(ctx: CanvasRenderingContext2D, view: Rect, devicePx: number): void {
    this.frameNo++;
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, this.w, this.h);
    const x0 = Math.max(0, view.x);
    const y0 = Math.max(0, view.y);
    const v = { x: x0, y: y0, w: Math.min(this.w, view.x + view.w) - x0, h: Math.min(this.h, view.y + view.h) - y0 };
    if (v.w <= 0 || v.h <= 0 || !this.levels.length) return;
    const cx = v.x + v.w / 2;
    const cy = v.y + v.h / 2;
    const dist = (t: Tile) => Math.hypot(t.x + t.w / 2 - cx, t.y + t.h / 2 - cy);
    const want: Tile[] = [...this.base];
    const top = this.levels.find((l) => l >= devicePx) ?? this.levels[this.levels.length - 1];
    for (const t of this.base) if (t.img) this.blit(ctx, t, v);
    if (top !== this.levels[0]) {
      const inView = this.tiles.filter((t) => t.level === top && overlaps(t, v)).sort((a, b) => dist(a) - dist(b));
      for (const t of inView) if (t.img) this.blit(ctx, t, v);
      const key = `${top}:${inView.map((t) => `${t.x},${t.y}`).join(";")}`;
      const now = performance.now();
      if (key !== this.detailKey) (this.detailKey = key), (this.detailSince = now);
      if (now - this.detailSince >= SETTLE_MS) want.push(...inView);
    }
    this.evict();
    this.queue = want;
    this.pump();
  }

  /** Đường đi của các vùng đã có file điểm. */
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

  /** Khu đặc biệt: phủ đỏ sẫm mờ và viền đỏ liền, khác ranh giới vùng thường. */
  drawZones(ctx: CanvasRenderingContext2D, zoom: number): void {
    for (const p of this.zones) {
      ctx.fillStyle = "rgba(96, 14, 22, 0.16)";
      ctx.fill(p);
      ctx.strokeStyle = "rgba(176, 30, 30, 0.85)";
      ctx.lineWidth = 2.4 / zoom;
      ctx.stroke(p);
    }
  }

  drawFog(ctx: CanvasRenderingContext2D, view: Rect): void {
    const f = this.fogCanvas();
    const x0 = Math.max(0, view.x);
    const y0 = Math.max(0, view.y);
    const x1 = Math.min(this.w, view.x + view.w);
    const y1 = Math.min(this.h, view.y + view.h);
    if (x1 > x0 && y1 > y0) ctx.drawImage(f, x0 / FOG_DIV, y0 / FOG_DIV, (x1 - x0) / FOG_DIV, (y1 - y0) / FOG_DIV, x0, y0, x1 - x0, y1 - y0);
  }

  /** Vẽ phần giao của ô với khung nhìn. */
  private blit(ctx: CanvasRenderingContext2D, t: Tile, v: Rect): void {
    const img = t.img!;
    t.used = this.frameNo;
    const x0 = Math.max(t.x, v.x);
    const y0 = Math.max(t.y, v.y);
    const x1 = Math.min(t.x + t.w, v.x + v.w);
    const y1 = Math.min(t.y + t.h, v.y + v.h);
    if (x1 <= x0 || y1 <= y0) return;
    const k = img.width / t.w;
    ctx.drawImage(img, (x0 - t.x) * k, (y0 - t.y) * k, (x1 - x0) * k, (y1 - y0) * k, x0, y0, x1 - x0, y1 - y0);
  }

  /** Bỏ bớt ô đã giải mã lâu không vẽ (trừ ô lót), giữ tối đa MAX_TILES ô. */
  private evict(): void {
    const loaded = this.tiles.filter((t) => t.img);
    if (loaded.length <= MAX_TILES) return;
    const old = loaded.filter((t) => t.used < this.frameNo && !this.base.includes(t)).sort((a, b) => a.used - b.used);
    for (const t of old.slice(0, loaded.length - MAX_TILES)) {
      const img = t.img!;
      if ("close" in img) img.close();
      t.img = undefined;
      t.state = "idle";
    }
  }

  private pump(): void {
    while (this.active < PARALLEL) {
      const next = this.queue.find((t) => t.state === "idle");
      if (!next) return;
      this.load(next);
    }
  }

  private load(t: Tile): void {
    if (t.state !== "idle") return;
    t.state = "loading";
    this.active++;
    void (async () => {
      try {
        const res = await fetch(await t.url());
        t.img = await decode(await this.readBlob(res, this.base.includes(t) ? t : undefined));
        t.used = this.frameNo;
        t.state = "ready";
      } catch (e) {
        console.warn("Không nạp được ô ảnh nền bản đồ", e);
        t.state = "error";
      }
      this.active--;
      this.updateProgress();
      this.pump();
    })();
  }

  /** Đọc thân trả về, báo tiến độ nếu là ô lót. */
  private async readBlob(res: Response, tracked?: Tile): Promise<Blob> {
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
    if (!this.base.length) return;
    const done = this.base.reduce((s, t) => s + (t.state === "ready" || t.state === "error" ? 1 : Math.min(0.95, t.got ?? 0)), 0);
    const was = this.progress;
    this.progress = done / this.base.length;
    if (this.progress >= 1 && was < 1) performance.mark("ban-do:anh-nen");
    this.onChange?.();
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

/** Nối các đoạn ranh giới (đầu đoạn này trùng cuối đoạn kia, có thể ngược chiều) thành vòng khép kín. */
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

// Lưới đi bộ của một vùng cho bản đồ mở thời gian thực (GDD mục 3, KE_HOACH mục 9 Sprint R1).
// File data/maps/ha_di_bo_<mã vùng>.json do tools/mapgen/di_bo.ts sinh: 1 ô = 1 đơn vị bản đồ, 1 bit mỗi ô.
// Có A* trên lưới để auto chạy tới điểm chạm; đường và điểm đã được ép mở lúc sinh nên A* luôn tới được điểm.

export interface WalkGridFile {
  version: number;
  region: string;
  origin: [number, number];
  width: number;
  height: number;
  walk: number;
  data: string; // base64, 1 bit mỗi ô theo hàng
}

const FILES = import.meta.glob<WalkGridFile>("../../../../data/maps/ha_di_bo_*.json", { import: "default" });

export class WalkGrid {
  readonly origin: [number, number];
  readonly w: number;
  readonly h: number;
  private bits: Uint8Array;

  constructor(f: WalkGridFile) {
    this.origin = f.origin;
    this.w = f.width;
    this.h = f.height;
    // atob chạy trong trình duyệt; file do tool sinh ra nên tin được.
    const bin = atob(f.data);
    this.bits = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) this.bits[i] = bin.charCodeAt(i);
  }

  /** Ô (toạ độ bản đồ) đi được không. */
  walkable(x: number, y: number): boolean {
    const gx = Math.floor(x - this.origin[0]);
    const gy = Math.floor(y - this.origin[1]);
    if (gx < 0 || gy < 0 || gx >= this.w || gy >= this.h) return false;
    const i = gy * this.w + gx;
    return (this.bits[i >> 3] & (1 << (i & 7))) !== 0;
  }

  /** Bước tới gần nhất đi được quanh (x, y), tìm xoắn ốc tới bán kính 6 ô; không có thì undefined. */
  nearestWalkable(x: number, y: number): { x: number; y: number } | undefined {
    if (this.walkable(x, y)) return { x, y };
    for (let r = 1; r <= 6; r++)
      for (let dx = -r; dx <= r; dx++)
        for (let dy = -r; dy <= r; dy++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (this.walkable(nx, ny)) return { x: nx, y: ny };
        }
    return undefined;
  }

  /**
   * A* trên lưới (8 hướng, chéo cấm cắt góc ô chặn). Trả về các điểm quẹo (đã rút gọn bằng đường thẳng có thị tuyến),
   * toạ độ bản đồ; không tới được thì undefined.
   */
  findPath(fx: number, fy: number, tx: number, ty: number): { x: number; y: number }[] | undefined {
    const a = this.nearestWalkable(fx, fy);
    const b = this.nearestWalkable(tx, ty);
    if (!a || !b) return undefined;
    const [ox, oy] = this.origin;
    const w = this.w;
    const h = this.h;
    const s = Math.floor(a.x - ox) + Math.floor(a.y - oy) * w;
    const t = Math.floor(b.x - ox) + Math.floor(b.y - oy) * w;
    if (s === t) return [{ x: tx, y: ty }];
    const txg = t % w;
    const tyg = (t / w) | 0;
    const open = new MinHeap();
    const gScore = new Map<number, number>([[s, 0]]);
    const came = new Map<number, number>();
    const hCost = (i: number) => {
      const dx = Math.abs((i % w) - txg);
      const dy = Math.abs(((i / w) | 0) - tyg);
      return Math.max(dx, dy) + 0.42 * Math.min(dx, dy);
    };
    open.push(s, hCost(s));
    const DIRS = [1, -1, w, -w, w + 1, w - 1, -w + 1, -w - 1];
    let found = false;
    let guard = w * h;
    while (open.size && guard-- > 0) {
      const cur = open.pop()!;
      if (cur === t) {
        found = true;
        break;
      }
      const cx = cur % w;
      const cy = (cur / w) | 0;
      const g = gScore.get(cur)!;
      for (const d of DIRS) {
        // Hướng đi từ mã d: 1/-1 là ngang, w/-w là dọc, còn lại là chéo.
        let mx = 0;
        let my = 0;
        if (d === 1) mx = 1;
        else if (d === -1) mx = -1;
        else if (d === w) my = 1;
        else if (d === -w) my = -1;
        else if (d === w + 1) (mx = 1), (my = 1);
        else if (d === w - 1) (mx = -1), (my = 1);
        else if (d === -w + 1) (mx = 1), (my = -1);
        else (mx = -1), (my = -1);
        const ax = cx + mx;
        const ay = cy + my;
        if (ax < 0 || ay < 0 || ax >= w || ay >= h) continue;
        if (mx && my && !(this.cellWalk(cx + mx, cy) && this.cellWalk(cx, cy + my))) continue; // cấm cắt góc
        if (!this.cellWalk(ax, ay)) continue;
        const ni = ax + ay * w;
        const ng = g + (mx && my ? 1.42 : 1);
        if (ng < (gScore.get(ni) ?? Infinity)) {
          gScore.set(ni, ng);
          came.set(ni, cur);
          open.push(ni, ng + hCost(ni));
        }
      }
    }
    if (!found) return undefined;
    const cells: number[] = [];
    for (let i = t; i !== s; i = came.get(i)!) cells.push(i);
    cells.reverse();
    // Rút gọn: bỏ điểm giữa khi đi thẳng được (thị tuyến trên lưới).
    const pts = cells.map((i) => ({ x: ox + (i % w) + 0.5, y: oy + ((i / w) | 0) + 0.5 }));
    const out: { x: number; y: number }[] = [];
    let anchor = { x: fx, y: fy };
    let i = 0;
    while (i < pts.length) {
      let j = pts.length - 1;
      while (j > i + 1 && !this.lineWalkable(anchor.x, anchor.y, pts[j].x, pts[j].y)) j--;
      out.push(pts[j]);
      anchor = pts[j];
      i = j + 1;
    }
    out[out.length - 1] = { x: tx, y: ty };
    return out;
  }

  private cellWalk(gx: number, gy: number): boolean {
    if (gx < 0 || gy < 0 || gx >= this.w || gy >= this.h) return false;
    const i = gy * this.w + gx;
    return (this.bits[i >> 3] & (1 << (i & 7))) !== 0;
  }

  /** Đoạn thẳng có đi qua toàn ô đi được không (bước nửa ô). */
  lineWalkable(x0: number, y0: number, x1: number, y1: number): boolean {
    const len = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.ceil(len * 2);
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      if (!this.walkable(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)) return false;
    }
    return true;
  }
}

class MinHeap {
  private items: number[] = [];
  private prio: number[] = [];
  get size(): number {
    return this.items.length;
  }
  push(v: number, p: number): void {
    this.items.push(v);
    this.prio.push(p);
    let i = this.items.length - 1;
    while (i > 0) {
      const up = (i - 1) >> 1;
      if (this.prio[up] <= this.prio[i]) break;
      this.swap(i, up);
      i = up;
    }
  }
  pop(): number | undefined {
    if (!this.items.length) return undefined;
    const top = this.items[0];
    const lv = this.items.pop()!;
    const lp = this.prio.pop()!;
    if (this.items.length) {
      this.items[0] = lv;
      this.prio[0] = lp;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < this.prio.length && this.prio[l] < this.prio[m]) m = l;
        if (r < this.prio.length && this.prio[r] < this.prio[m]) m = r;
        if (m === i) break;
        this.swap(i, m);
        i = m;
      }
    }
    return top;
  }
  private swap(a: number, b: number): void {
    [this.items[a], this.items[b]] = [this.items[b], this.items[a]];
    [this.prio[a], this.prio[b]] = [this.prio[b], this.prio[a]];
  }
}

const cache = new Map<string, Promise<WalkGrid>>();

/** Lưới đi bộ của vùng; vùng chưa sinh lưới thì reject. */
export function loadWalkGrid(code: string): Promise<WalkGrid> {
  let p = cache.get(code);
  if (!p) {
    const load = FILES[`../../../../data/maps/ha_di_bo_${code}.json`];
    if (!load) return Promise.reject(new Error(`Không có lưới đi bộ của vùng ${code} (chạy tools/mapgen/di_bo.ts)`));
    p = load().then((f) => new WalkGrid(f));
    cache.set(code, p);
  }
  return p;
}

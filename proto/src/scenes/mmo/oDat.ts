// Lớp ô đất của map khu: lưới loại đất, vẽ bằng ô Wang tự ghép mép (assets/pixellab/o_dat/, đóng gói bằng tools/o_dat/dong_goi.mjs).
// Lưới đôi: mỗi ký tự trong `dat` là loại đất của một ô lưới; ô hình được vẽ lệch nửa ô, bốn góc của nó là bốn ô lưới kề nhau,
// nên tô một ô lưới thì mép tự bo sang bốn phía. Dùng chung cho game (mmoScene.ts) và app sửa map (sua_map).

/** Bộ ô đã đóng gói (bo.json). */
export interface BoODat {
  /** Cạnh ô hình, px */
  co: number;
  /** Loại đất; loại đầu là nền mặc định. cam: không đi vào được (nước). */
  dat: { k: string; ten: string; cam?: boolean }[];
  /** Mỗi bộ nối hai loại đất. o[NW*8 + NE*4 + SW*2 + SE] = [cột, hàng] trong tấm 4×4; bit bật là đất `up`. */
  bo: { f: string; lo: string; up: string; o: [number, number][] }[];
}

/** Lớp ô đất trong file map. */
export interface LopO {
  /** Cạnh một ô lưới theo đơn vị thế giới (48 = ô 16px vẽ gấp ba) */
  co: number;
  cot: number;
  hang: number;
  /** `hang` dòng, mỗi dòng `cot` ký tự loại đất */
  dat: string[];
}

export const O_DIR = "o_dat/";

export function lopMoi(bo: BoODat, w: number, h: number, co = 48): LopO {
  const cot = Math.max(1, Math.ceil(w / co));
  const hang = Math.max(1, Math.ceil(h / co));
  return { co, cot, hang, dat: Array.from({ length: hang }, () => bo.dat[0].k.repeat(cot)) };
}

/** Loại đất ở ô lưới (cột, hàng); ra ngoài mép thì lấy ô sát mép. */
export function datO(l: LopO, c: number, r: number): string {
  return l.dat[Math.max(0, Math.min(l.hang - 1, r))][Math.max(0, Math.min(l.cot - 1, c))];
}

const cache = new WeakMap<BoODat, Map<string, [number, number]>>();

/**
 * Chọn ô hình cho bốn góc `g` (4 ký tự NW, NE, SW, SE): trả [chỉ số bộ, chỉ số ô trong bộ].
 * shortcut: tổ hợp không bộ nào nối được (ba loại đất, hay hai loại chưa có bộ) thì lấy bộ khớp nhiều góc nhất,
 * góc lạc coi như nền mặc định của bộ đó, mép sẽ hơi gãy; khi cần đẹp thì vẽ thêm bộ nối hai loại ấy.
 */
export function chonO(bo: BoODat, g: string): [number, number] {
  let m = cache.get(bo);
  if (!m) cache.set(bo, (m = new Map()));
  let hit = m.get(g);
  if (hit) return hit;
  const nen = bo.dat[0].k;
  let best = -1;
  let bestN = -1;
  bo.bo.forEach((b, i) => {
    let n = 0;
    for (const ch of g) if (ch === b.lo || ch === b.up) n++;
    if (n > bestN) {
      bestN = n;
      best = i;
    }
  });
  const b = bo.bo[best];
  const thay = b.lo === nen || b.up === nen ? nen : b.lo;
  let mask = 0;
  for (const ch of g) mask = mask * 2 + ((ch === b.lo || ch === b.up ? ch : thay) === b.up ? 1 : 0);
  hit = [best, mask];
  m.set(g, hit);
  return hit;
}

/** Vẽ cả lớp ô ra một tấm ở cỡ gốc (cot×co px); game và app phóng tấm này lên, nên không hở mép giữa các ô. Thiếu ảnh thì trả null. */
export function veLop(l: LopO, bo: BoODat, anh: (f: string) => CanvasImageSource | null, cv = document.createElement("canvas")): HTMLCanvasElement | null {
  const tam = bo.bo.map((b) => anh(b.f));
  if (tam.some((t) => !t)) return null;
  const s = bo.co;
  cv.width = l.cot * s;
  cv.height = l.hang * s;
  const ctx = cv.getContext("2d")!;
  for (let r = 0; r <= l.hang; r++) {
    for (let c = 0; c <= l.cot; c++) {
      const [i, k] = chonO(bo, datO(l, c - 1, r - 1) + datO(l, c, r - 1) + datO(l, c - 1, r) + datO(l, c, r));
      const [tx, ty] = bo.bo[i].o[k];
      ctx.drawImage(tam[i]!, tx * s, ty * s, s, s, c * s - s / 2, r * s - s / 2, s, s);
    }
  }
  return cv;
}

/** Vùng cấm sinh từ đất không đi được (nước): mỗi dải ô liền nhau trên một hàng là một khung. */
export function camLop(l: LopO, bo: BoODat): { x: number; y: number; w: number; h: number }[] {
  const cam = new Set(bo.dat.filter((d) => d.cam).map((d) => d.k));
  const out: { x: number; y: number; w: number; h: number }[] = [];
  l.dat.forEach((row, r) => {
    for (let c = 0; c < l.cot; c++) {
      if (!cam.has(row[c])) continue;
      let e = c;
      while (e + 1 < l.cot && cam.has(row[e + 1])) e++;
      out.push({ x: c * l.co, y: r * l.co, w: (e - c + 1) * l.co, h: l.co });
      c = e;
    }
  });
  return out;
}

/** Tô một ô vuông cạnh `co` ô lưới quanh (c, r). Trả true nếu có ô đổi. */
export function toO(l: LopO, c: number, r: number, k: string, co = 1): boolean {
  let doi = false;
  const a = Math.floor((co - 1) / 2);
  for (let y = r - a; y < r - a + co; y++) {
    if (y < 0 || y >= l.hang) continue;
    const row = [...l.dat[y]];
    for (let x = Math.max(0, c - a); x < Math.min(l.cot, c - a + co); x++) {
      if (row[x] !== k) {
        row[x] = k;
        doi = true;
      }
    }
    l.dat[y] = row.join("");
  }
  return doi;
}

/** Đổ loại đất `k` vào vùng liền nhau cùng loại chứa (c, r). */
export function doO(l: LopO, c: number, r: number, k: string): boolean {
  if (c < 0 || r < 0 || c >= l.cot || r >= l.hang) return false;
  const cu = l.dat[r][c];
  if (cu === k) return false;
  const g = l.dat.map((row) => [...row]);
  const q = [[c, r]];
  g[r][c] = k;
  while (q.length) {
    const [x, y] = q.pop()!;
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
      if (nx >= 0 && ny >= 0 && nx < l.cot && ny < l.hang && g[ny][nx] === cu) {
        g[ny][nx] = k;
        q.push([nx, ny]);
      }
    }
  }
  l.dat = g.map((row) => row.join(""));
  return true;
}

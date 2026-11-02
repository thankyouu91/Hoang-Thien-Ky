// Đặt điểm cho một vùng từ bản đồ Azgaar (GDD mục 3 và 12), mỗi điểm một ô: thành chủ, đèo, bến đò, cửa bí cảnh,
// linh tuyền, hang dị thú, mỏ quặng, mỏ dược, vị trí sơn môn, mỏ linh thạch. Rồi nối đường theo đường của Azgaar (thiếu thì
// nối điểm gần nhất), tính số chặng tới thành chủ và cấp nguy hiểm. Cùng dữ liệu và cùng SEED thì ra cùng kết quả.
//
// Chạy: node --experimental-strip-types tools/mapgen/diem.ts [vị diện] [mã vùng]   (mặc định: ha loi_dinh_coc)
// Ra: data/maps/<vị diện>_diem_<mã vùng>.json
import { writeFileSync } from "node:fs";
import { loadPlaneMap, type AzgaarMap } from "./azgaar.ts";
import { assignCells, loadRegions, slug } from "./vung.ts";

const VERSION = 1; // tăng khi đổi định dạng file
const SEED = 20261102;

/** Số điểm của một vùng Hạ vị có diện tích trung bình: tổng khoảng 450 (GDD mục 3), số mỏ và linh tuyền theo mục 12. Đèo và
 * bến đò tuỳ địa hình, vị trí sơn môn lấy phần còn lại cho đủ tổng. Hang dị thú và số bến đò tối đa là đề xuất */
const MEAN_COUNTS = { total: 450, mo_linh_thach: 120, mo_quang: 80, mo_duoc: 80, linh_tuyen: 10, cua_bi_canh: 6, hang_di_thu: 30 };
const MAX_BEN_DO = 12;

/** Số điểm theo diện tích (người dùng chọn ngày 2026-11-02): mọi loại nhân với số ô của vùng chia số ô trung bình của các
 * vùng, nên mật độ điểm và số mỏ trên mỗi vị trí sơn môn như nhau ở mọi vùng */
export function regionCounts(region: Int8Array, k: number) {
  const sizes = new Map<number, number>();
  for (const r of region) if (r >= 0) sizes.set(r, (sizes.get(r) ?? 0) + 1);
  const scale = sizes.get(k)! / ([...sizes.values()].reduce((a, b) => a + b, 0) / sizes.size);
  const of = (n: number) => Math.max(1, Math.round(n * scale));
  const counts = Object.fromEntries(Object.entries(MEAN_COUNTS).map(([type, n]) => [type, of(n)])) as typeof MEAN_COUNTS;
  return { scale, maxBenDo: of(MAX_BEN_DO), ...counts };
}
const BEN_DO_GAP = 3; // hai bến đò cách nhau ít nhất 3 ô
export const MAX_DEO = 2; // đèo tối đa sang mỗi vùng kề
const DEO_GAP = 8; // hai đèo sang cùng một vùng cách nhau ít nhất 8 ô
export const MIN_BORDER = 6; // hai vùng chung ít hơn 6 ô biên giới thì chỉ chạm góc, không tính là kề
export const DANGER_MAX = 250; // cấp nguy hiểm của điểm xa thành chủ nhất = cấp nhân vật tối đa Hạ vị (đề xuất)

const FOREST = new Set(["Tropical seasonal forest", "Temperate deciduous forest", "Tropical rainforest", "Temperate rainforest", "Taiga"]);
/** Điểm đánh dấu của Azgaar gợi ý từng loại điểm */
const RELIC_MARKERS = new Set(["ruins", "necropolises", "dungeons", "statues", "battlefields", "libraries"]);
const BEAST_MARKERS = new Set(["caves", "hill-monsters", "encounters", "brigands", "migration"]);

type PointType =
  | "thanh_chu" | "deo" | "ben_do" | "cua_bi_canh" | "linh_tuyen" | "hang_di_thu"
  | "mo_quang" | "mo_duoc" | "son_mon" | "mo_linh_thach";
/** Địa thế sơn môn (GDD mục 3), loại hiếm trước */
const TERRAINS = ["hoa_mach", "co_tich", "son_hiem", "linh_mach", "thuy_trach", "thuong_lo"] as const;
type Terrain = (typeof TERRAINS)[number];
type EdgeKind = "quan_dao" | "tieu_dao" | "loi_mon"; // đường lớn, đường mòn của Azgaar; lối nối thêm tới điểm gần nhất

interface Point {
  id: number;
  type: PointType;
  cell: number;
  x: number;
  y: number;
  h: number;
  biome: string;
  stages: number; // số chặng tới thành chủ
  danger: number;
  terrain?: Terrain;
  neighbour?: string; // đèo: mã vùng bên kia
  azgaarName?: string; // thành chủ: tên thị trấn Azgaar, chỉ để tra
}
interface Edge {
  a: number;
  b: number;
  kind: EdgeKind;
  cells: number; // số ô dọc đường, để tính thời gian đi
  danger: number;
  path: [number, number][];
}

export function placePoints(map: AzgaarMap, region: Int8Array, k: number, regionCodes: string[], element: string) {
  const { cells } = map;
  const N = cells.length;
  const counts = regionCounts(region, k);
  const inRegion = (c: number) => region[c] === k;
  const own = cells.filter((c) => inRegion(c.i)).map((c) => c.i);
  const rnd = mulberry32(SEED + k);
  const jitter = new Float64Array(N);
  for (const c of own) jitter[c] = rnd(); // phá thế hoà, cố định theo SEED

  const markers = new Map<number, string[]>();
  for (const m of map.markers) if (inRegion(m.cell)) markers.set(m.cell, [...(markers.get(m.cell) ?? []), m.type]);
  const near = (c: number, test: (n: number) => boolean) => test(c) || cells[c].c.some(test);
  const hasMarker = (c: number, kinds: Set<string>) => (markers.get(c) ?? []).some((t) => kinds.has(t));
  const isForest = (c: number) => FOREST.has(map.biomes[cells[c].biome]);
  const isWet = (c: number) => cells[c].r > 0 || map.biomes[cells[c].biome] === "Wetland";
  const heightRank = new Float64Array(N); // 0 thấp nhất, 1 cao nhất trong vùng
  [...own].sort((a, b) => cells[a].h - cells[b].h || a - b).forEach((c, i) => (heightRank[c] = i / Math.max(1, own.length - 1)));
  const isHigh = (c: number) => heightRank[c] >= 0.8; // 20% ô cao nhất của vùng là "núi cao"

  // Đường của Azgaar trong vùng, theo ô
  const road = new Map<number, Map<number, string>>();
  const link = (a: number, b: number, group: string) => {
    if (a === b) return;
    const m = road.get(a) ?? road.set(a, new Map()).get(a)!;
    if (m.get(b) !== "roads") m.set(b, group);
  };
  for (const r of map.routes)
    for (let i = 0; i + 1 < r.points.length; i++) {
      const a = r.points[i][2], b = r.points[i + 1][2];
      if (inRegion(a) && inRegion(b)) link(a, b, r.group), link(b, a, r.group);
    }
  const onMainRoad = (c: number) => [...(road.get(c)?.values() ?? [])].includes("roads");

  const points: Point[] = [];
  const taken = new Map<number, number>(); // ô → id điểm
  const free = (c: number) => inRegion(c) && !taken.has(c);
  const add = (type: PointType, cell: number, extra: Partial<Point> = {}) => {
    const [x, y] = cells[cell].p;
    const point: Point = { id: points.length, type, cell, x, y, h: cells[cell].h, biome: map.biomes[cells[cell].biome], stages: -1, danger: 0, ...extra };
    points.push(point);
    taken.set(cell, point.id);
    return point;
  };

  /** Hạ khoảng cách (số ô, trong vùng) tới nguồn mới; -1 là chưa tới được */
  const relax = (dist: Int32Array, from: number) => {
    dist[from] = 0;
    const queue = [from];
    for (let q = 0; q < queue.length; q++)
      for (const n of cells[queue[q]].c)
        if (inRegion(n) && (dist[n] < 0 || dist[n] > dist[queue[q]] + 1)) (dist[n] = dist[queue[q]] + 1), queue.push(n);
  };
  const distanceFrom = (sources: number[]) => {
    const dist = new Int32Array(N).fill(-1);
    for (const s of sources) relax(dist, s);
    return dist;
  };

  /** Chọn n ô trải đều: mỗi lần lấy ô xa mọi điểm đã đặt nhất (số ô), cộng điểm thưởng */
  const spread = (type: PointType, n: number, bonus: (c: number) => number = () => 0, extra: (c: number) => Partial<Point> = () => ({})) => {
    const dist = distanceFrom(points.map((p) => p.cell));
    for (let j = 0; j < n; j++) {
      let best = -1, bestScore = -Infinity;
      for (const c of own) {
        if (!free(c)) continue;
        const score = (dist[c] < 0 ? 1000 : dist[c]) + bonus(c) + jitter[c];
        if (score > bestScore) (bestScore = score), (best = c);
      }
      if (best < 0) return;
      add(type, best, extra(best));
      relax(dist, best);
    }
  };

  /** Chọn n ô điểm cao nhất, tránh ô kề một điểm cùng loại; thiếu thì bỏ điều kiện đó. Có `tier` thì dùng hết ô của bậc
   * trên (kể cả ô kề nhau) rồi mới xuống bậc dưới */
  const rank = (type: PointType, n: number, score: (c: number) => number, tier: (c: number) => number = () => 0) => {
    const order = own.filter(free).sort((a, b) => score(b) + jitter[b] * 0.01 - (score(a) + jitter[a] * 0.01));
    const touchesSame = (c: number) => cells[c].c.some((x) => points[taken.get(x) ?? -1]?.type === type);
    let placed = 0;
    for (const level of [...new Set(order.map(tier))].sort((a, b) => b - a))
      for (const strict of [true, false])
        for (const c of order) {
          if (placed === n) return;
          if (tier(c) !== level || !free(c) || (strict && touchesSame(c))) continue;
          add(type, c), placed++;
        }
  };

  // 1. Thành chủ ở thị trấn lớn nhất của vùng
  const capital = map.burgs.filter((b) => inRegion(b.cell)).sort((a, b) => b.population - a.population || a.i - b.i)[0];
  if (!capital) throw new Error(`Vùng ${regionCodes[k]} không có thị trấn nào để làm thành chủ`);
  add("thanh_chu", capital.cell, { azgaarName: capital.name });

  // 2. Đèo: chỗ đường Azgaar vượt biên giới sang vùng kề; vùng kề không có đường sang thì lấy khe thấp nhất trên dãy biên giới
  const border = new Map<number, number[]>();
  for (const c of own)
    for (const n of cells[c].c) if (region[n] >= 0 && region[n] !== k) border.set(region[n], [...(border.get(region[n]) ?? []), c]);
  const crossings = new Map<number, number[]>();
  for (const r of map.routes)
    for (let i = 0; i + 1 < r.points.length; i++)
      for (const [a, b] of [[r.points[i][2], r.points[i + 1][2]], [r.points[i + 1][2], r.points[i][2]]])
        if (inRegion(a) && region[b] >= 0 && region[b] !== k) crossings.set(region[b], [...(crossings.get(region[b]) ?? []), a]);
  for (const j of [...border.keys()].sort((a, b) => a - b)) {
    if (new Set(border.get(j)).size < MIN_BORDER) continue;
    const candidates = [...new Set(crossings.get(j) ?? [])].sort((a, b) => cells[a].h - cells[b].h || a - b);
    if (!candidates.length) candidates.push([...border.get(j)!].sort((a, b) => cells[a].h - cells[b].h || a - b)[0]);
    const dist = new Int32Array(N).fill(-1);
    let passes = 0;
    for (const c of candidates) {
      if (passes === MAX_DEO || !free(c) || (dist[c] >= 0 && dist[c] < DEO_GAP)) continue;
      add("deo", c, { neighbour: regionCodes[j] });
      relax(dist, c), passes++;
    }
  }

  // 3. Bến đò: chỗ đường cắt sông, sông lớn trước
  const fords = own.filter((c) => cells[c].r && road.has(c) && free(c)).sort((a, b) => cells[b].fl - cells[a].fl || a - b);
  const fordDist = new Int32Array(N).fill(-1);
  let ferries = 0;
  for (const c of fords) {
    if (ferries === counts.maxBenDo || (fordDist[c] >= 0 && fordDist[c] < BEN_DO_GAP)) continue;
    add("ben_do", c), relax(fordDist, c), ferries++;
  }

  // 4–5. Trải đều cửa bí cảnh và linh tuyền; ưu tiên chỗ có điểm đánh dấu hoặc địa hình hợp
  const springs = new Set(map.rivers.map((r) => r.cells[0]));
  spread("cua_bi_canh", counts.cua_bi_canh, (c) => (hasMarker(c, RELIC_MARKERS) ? 5 : 0));
  spread("linh_tuyen", counts.linh_tuyen, (c) => (springs.has(c) ? 4 : 0) + (map.biomes[cells[c].biome] === "Wetland" ? 1 : 0));

  // 6. Vị trí sơn môn trải đều, đặt trước các mỏ để còn chỗ núi cao. Mỗi ô có điểm 0–1 cho từng địa thế; khi trải đều thì
  // ưu tiên ô đạt (điểm 1) một địa thế chưa đủ phần, để các địa thế có trong vùng chia gần đều nhau
  const springDist = distanceFrom(points.filter((p) => p.type === "linh_tuyen").map((p) => p.cell));
  const fiery = element === "hoa" || element === "cuc_duong"; // bản đồ ít núi lửa, nên núi cao vùng lửa cũng là Hỏa mạch
  const twoSteps = (c: number) => [...new Set([c, ...cells[c].c, ...cells[c].c.flatMap((n) => cells[n].c)])];
  const scoreTerrain = (c: number): Record<Terrain, number> => {
    const around = twoSteps(c);
    return {
      hoa_mach: around.some((n) => (markers.get(n) ?? []).includes("volcanoes")) || (fiery && heightRank[c] >= 0.6) ? 1 : 0,
      co_tich: around.some((n) => hasMarker(n, RELIC_MARKERS)) ? 1 : 0,
      son_hiem: isHigh(c) ? 1 : heightRank[c] >= 0.65 ? 0.5 : 0,
      linh_mach: springDist[c] >= 0 && springDist[c] <= 2 ? 1 : springDist[c] === 3 ? 0.5 : 0,
      thuy_trach: near(c, isWet) ? 1 : around.some(isWet) ? 0.5 : 0,
      thuong_lo: near(c, onMainRoad) ? 1 : near(c, (n) => road.has(n)) ? 0.5 : 0,
    };
  };
  const terrainScore = new Map(own.map((c) => [c, scoreTerrain(c)]));
  const present = TERRAINS.filter((t) => own.some((c) => free(c) && terrainScore.get(c)![t] === 1));
  const pool = present.length ? present : [...TERRAINS];
  const later = counts.hang_di_thu + counts.mo_quang + counts.mo_duoc + counts.mo_linh_thach;
  const sects = counts.total - points.length - later; // vị trí sơn môn lấy phần còn lại cho đủ tổng
  const quota = Math.ceil(sects / pool.length);
  const used = Object.fromEntries(TERRAINS.map((t) => [t, 0])) as Record<Terrain, number>;
  const open = (c: number) => pool.filter((t) => terrainScore.get(c)![t] === 1 && used[t] < quota);
  const pickTerrain = (c: number): Terrain => {
    const s = terrainScore.get(c)!;
    const choices = open(c).length ? open(c) : pool;
    return [...choices].sort((a, b) => s[b] - s[a] || used[a] - used[b])[0];
  };
  spread("son_mon", sects, (c) => (open(c).length ? 3 : 0), (c) => {
    const terrain = pickTerrain(c);
    used[terrain]++;
    return { terrain };
  });

  // 7. Hang dị thú trải đều, ưu tiên điểm đánh dấu quái, rừng, núi
  spread("hang_di_thu", counts.hang_di_thu, (c) => (hasMarker(c, BEAST_MARKERS) ? 4 : 0) + (isForest(c) ? 1 : 0) + (isHigh(c) ? 1 : 0));

  // 8–9. Mỏ quặng nơi cao, mỏ dược trong rừng (gần nước tốt hơn)
  rank("mo_quang", counts.mo_quang, (c) => cells[c].h);
  // Vùng khô hoặc thảo nguyên có ít ô rừng hơn số mỏ dược: dùng hết rừng rồi mới tới đầm lầy, ven sông
  const herbScore = (c: number) => (map.biomes[cells[c].biome] === "Wetland" ? 4 : 0) + (near(c, (n) => cells[n].r > 0) ? 2 : 0);
  rank("mo_duoc", counts.mo_duoc, herbScore, (c) => (isForest(c) ? 1 : 0));

  // 10. Mỏ linh thạch lấp đều phần còn trống
  spread("mo_linh_thach", counts.mo_linh_thach);

  return { points, edges: connect(map, region, k, points, taken, road), capital, counts };
}

/** Nối điểm theo đường Azgaar; điểm không nằm trên đường thì nối tới điểm gần nhất; cuối cùng nối các mảng rời vào mảng có thành chủ */
function connect(map: AzgaarMap, region: Int8Array, k: number, points: Point[], taken: Map<number, number>, road: Map<number, Map<number, string>>) {
  const { cells } = map;
  const inRegion = (c: number) => region[c] === k;
  const edges = new Map<string, Edge>();
  const addEdge = (a: number, b: number, kind: EdgeKind, path: number[]) => {
    const key = a < b ? `${a}-${b}` : `${b}-${a}`;
    const old = edges.get(key);
    if (old && old.cells <= path.length) return;
    edges.set(key, { a: Math.min(a, b), b: Math.max(a, b), kind, cells: path.length - 1, danger: 0, path: path.map((c) => cells[c].p) });
  };
  /** Tìm theo chiều rộng từ một ô, không đi xuyên qua ô có điểm khác; trả mọi điểm gặp đầu tiên kèm đường đi */
  const search = (start: number, next: (c: number) => Iterable<number>, firstOnly: boolean) => {
    const prev = new Map<number, number>([[start, -1]]);
    const queue = [start];
    const found: [number, number[]][] = [];
    for (let q = 0; q < queue.length; q++) {
      const c = queue[q];
      if (c !== start && taken.has(c)) {
        const path = [c];
        for (let p = prev.get(c)!; p >= 0; p = prev.get(p)!) path.push(p);
        found.push([taken.get(c)!, path.reverse()]);
        if (firstOnly) return found;
        continue;
      }
      for (const n of next(c)) if (!prev.has(n)) prev.set(n, c), queue.push(n);
    }
    return found;
  };

  for (const p of points) {
    if (road.has(p.cell)) {
      for (const [id, path] of search(p.cell, (c) => road.get(c)?.keys() ?? [], false)) {
        const trail = path.some((c, i) => i > 0 && road.get(path[i - 1])?.get(c) !== "roads");
        addEdge(p.id, id, trail ? "tieu_dao" : "quan_dao", path);
      }
    } else {
      const [hit] = search(p.cell, (c) => cells[c].c.filter(inRegion), true);
      if (hit) addEdge(p.id, hit[0], "loi_mon", hit[1]);
    }
  }

  // Nối các mảng rời: lặp tìm điểm ngoài mảng thành chủ gần mảng đó nhất
  const capital = points.find((p) => p.type === "thanh_chu")!;
  for (;;) {
    const reach = stagesFrom(capital.id, points.length, [...edges.values()]);
    const outside = points.filter((p) => reach[p.id] < 0);
    if (!outside.length) break;
    let best: [number, number, number] = [-1, -1, Infinity];
    for (const p of outside)
      for (const q of points)
        if (reach[q.id] >= 0) {
          const d = (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
          if (d < best[2]) best = [p.id, q.id, d];
        }
    addEdge(best[0], best[1], "loi_mon", [points[best[0]].cell, points[best[1]].cell]);
  }
  return [...edges.values()].sort((a, b) => a.a - b.a || a.b - b.b);
}

/** Số chặng từ một điểm tới mọi điểm, -1 là không tới được */
export function stagesFrom(start: number, n: number, edges: { a: number; b: number }[]): Int32Array {
  const adj: number[][] = Array.from({ length: n }, () => []);
  for (const e of edges) adj[e.a].push(e.b), adj[e.b].push(e.a);
  const dist = new Int32Array(n).fill(-1);
  dist[start] = 0;
  const queue = [start];
  for (let q = 0; q < queue.length; q++) for (const x of adj[queue[q]]) if (dist[x] < 0) (dist[x] = dist[queue[q]] + 1), queue.push(x);
  return dist;
}

function mulberry32(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), s | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

if (import.meta.main) {
  const plane = process.argv[2] ?? "ha";
  const code = process.argv[3] ?? "loi_dinh_coc";
  const dataDir = new URL("../../data/maps/", import.meta.url);
  const map = loadPlaneMap(plane);
  const regions = loadRegions(plane);
  const codes = regions.names.map(slug);
  const k = codes.indexOf(code);
  if (k < 0) throw new Error(`Không có vùng ${code}; các mã: ${codes.join(", ")}`);
  const region = assignCells(map, regions);
  const { points, edges, counts: targets } = placePoints(map, region, k, codes, slug(regions.elements[k]));

  const capital = points.find((p) => p.type === "thanh_chu")!;
  const stages = stagesFrom(capital.id, points.length, edges);
  const maxStages = Math.max(...stages);
  for (const p of points) {
    p.stages = stages[p.id];
    p.danger = 1 + Math.round((p.stages / maxStages) * (DANGER_MAX - 1));
  }
  for (const e of edges) e.danger = Math.max(points[e.a].danger, points[e.b].danger);

  const round = (v: number) => Math.round(v * 10) / 10;
  const xs = points.map((p) => p.x), ys = points.map((p) => p.y);
  const counts: Record<string, number> = {};
  for (const p of points) counts[p.type] = (counts[p.type] ?? 0) + 1;
  const terrains: Record<string, number> = {};
  for (const p of points) if (p.terrain) terrains[p.terrain] = (terrains[p.terrain] ?? 0) + 1;
  const out = {
    version: VERSION,
    plane,
    region: { code, name: regions.names[k], element: slug(regions.elements[k]) },
    source: { azgaar: `${plane}_azgaar.map`, azgaarSeed: map.seed, seed: SEED },
    map: { width: map.width, height: map.height, bbox: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)].map(round) },
    targets: { ...targets, scale: Math.round(targets.scale * 1000) / 1000 }, // số cần đặt theo diện tích
    counts,
    terrains,
    points: points.map((p) => ({ ...p, x: round(p.x), y: round(p.y) })),
    edges: edges.map((e) => ({ ...e, path: e.path.map(([x, y]) => [round(x), round(y)]) })),
  };
  const file = new URL(`${plane}_diem_${code}.json`, dataDir);
  writeFileSync(file, JSON.stringify(out));
  const kinds: Record<string, number> = {};
  for (const e of edges) kinds[e.kind] = (kinds[e.kind] ?? 0) + 1;
  console.log(`${regions.names[k]}: ${points.length} điểm, ${edges.length} chặng (${JSON.stringify(kinds)}), xa nhất ${maxStages} chặng`);
  console.log(`  loại: ${JSON.stringify(counts)}`);
  console.log(`  địa thế sơn môn: ${JSON.stringify(terrains)}`);
  console.log(`  thành chủ: ${capital.azgaarName}; đèo sang: ${points.filter((p) => p.neighbour).map((p) => p.neighbour).join(", ")}`);
  console.log(`  ghi ${file.pathname}`);
}

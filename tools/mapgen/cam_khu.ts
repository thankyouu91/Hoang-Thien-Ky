// Linh Hải Cấm Khu: khu riêng ở lòng giữa Hạ vị (người dùng 2026-11-03). Tài nguyên như các vùng quanh (mỏ, linh tuyền, cửa bí
// cảnh, hang dị thú), thú cấp cao hơn, 12 hang Thú Hoàng (boss) rải quanh khu, mỗi vùng giáp ranh có cửa ải dẫn vào. Người chơi
// chỉ thấy cảnh báo CẤM KHU; luật rơi đồ, chết khi vào non tay, săn theo nhóm, xây sơn môn ở trong… là bí mật của dev, nằm ở
// data/bi_mat/ (không bao giờ đưa vào bản build cho người chơi).
//
// Hai bước:
//   1. node --experimental-strip-types tools/mapgen/cam_khu.ts [vị diện] --biome
//      → data/maps/<vị diện>_cam_khu_biome.json: biome cho từng ô lòng giữa (loadPlaneMap áp lên bộ đệm). Trong trang Azgaar,
//        azgaar-cam-khu.ts tô biome đó, vẽ lại biểu tượng địa hình riêng các ô ấy rồi gửi .map về data/maps.
//   2. node --experimental-strip-types tools/mapgen/cam_khu.ts [vị diện]   (sau khi bộ đệm đã có biome mới)
//      → data/maps/<vị diện>_diem_cam_khu.json, cùng định dạng file điểm của vùng (diem.ts), thêm links nối cửa ải với điểm
//        gần nhất của vùng bên kia; có phép kiểm sai thì thoát mã 1
import { readFileSync, writeFileSync } from "node:fs";
import { loadPlaneMap, type AzgaarMap } from "./azgaar.ts";
import { assignCells, centreCells, FOREST, loadRegions, ringPosition, slug } from "./vung.ts";
import { MEAN_COUNTS, mulberry32 } from "./diem.ts";
import { namePoints } from "./ten.ts";

const VERSION = 1;
const SEED = 20261104;
export const ZONE = { code: "cam_khu", name: "Linh Hải Cấm Khu", element: "hon_don" };
/** Người chơi chỉ thấy lời cảnh báo này; con số rơi đồ và mọi luật khác nằm ở data/bi_mat/ */
const WARNING = "CẤM KHU — cực kỳ nguy hiểm. Đồn rằng bảo vật và vật phẩm ở đây rơi ra nhiều hơn bên ngoài.";
/** Biome của Linh Hải (đề xuất): rừng cổ rậm xen trảng cỏ; ô có sông thành đầm lầy. Mỗi mảng khoảng PATCH ô */
const BIOME_MIX: [string, number][] = [
  ["Tropical rainforest", 0.3], ["Temperate rainforest", 0.24], ["Temperate deciduous forest", 0.14], ["Grassland", 0.2], ["Taiga", 0.05], ["Wetland", 0.07],
];
const PATCH = 90;
/** Cấp nguy hiểm: từ cửa ải tới chỗ sâu nhất 200 → 250 (cấp tối đa Hạ vị); hang Thú Hoàng 280, vượt trần nên phải đi nhóm */
const DANGER = { from: 200, to: 250, boss: 280 };
const BOSSES = 12;
const BOSS_DEPTH: [number, number] = [12, 40]; // khoảng cách tới biên khu (đơn vị bản đồ) của chỗ đặt hang Thú Hoàng
const SON_MON = 20; // vị trí sơn môn ít: chỉ dựng được sau khi trảm Thú Hoàng (luật bí mật)
const GATE_EVERY = 40; // mỗi vùng giáp ranh 1 cửa ải, thêm 1 cho mỗi 40 ô biên chung
const MAX_BEN_DO = 2;
const LINKS = 3; // mỗi điểm nối tới 3 điểm gần nhất theo đường đi qua ô
const HIGH_GATE = 225; // cửa bí cảnh từ cấp này là bậc cao, dưới là bậc vừa

type Point = {
  id: number; type: string; cell: number; x: number; y: number; h: number; biome: string;
  stages: number; distance: number; danger: number; tier?: string; neighbour?: string; name?: string; ring?: number;
};
type Edge = { a: number; b: number; kind: "loi_mon"; cells: number; danger: number; path: [number, number][] };

function shuffle<T>(list: T[], rnd: () => number): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Biome cho từng ô lòng giữa: hạt mảng chọn biome theo BIOME_MIX, mỗi ô theo hạt gần nhất (loang theo ô kề) */
function zoneBiomes(map: AzgaarMap, zone: number[], rnd: () => number): Map<number, number> {
  const inZone = new Set(zone);
  const id = (name: string) => map.biomes.indexOf(name);
  const pick = () => {
    let r = rnd();
    for (const [name, w] of BIOME_MIX) if ((r -= w) < 0) return id(name);
    return id(BIOME_MIX[0][0]);
  };
  const owner = new Map<number, number>();
  const queue = shuffle(zone, rnd).slice(0, Math.max(1, Math.round(zone.length / PATCH)));
  for (const c of queue) owner.set(c, pick());
  for (let q = 0; q < queue.length; q++)
    for (const n of map.cells[queue[q]].c) if (inZone.has(n) && !owner.has(n)) owner.set(n, owner.get(queue[q])!), queue.push(n);
  for (const c of zone) if (map.cells[c].r) owner.set(c, id("Wetland"));
  return owner;
}

/** Khoảng cách (đơn vị bản đồ, đi theo ô kề) từ mỗi ô của tập tới biên tập */
function depth(map: AzgaarMap, inside: Set<number>): Map<number, number> {
  const d = new Map<number, number>();
  const queue: number[] = [];
  for (const c of inside) if (map.cells[c].c.some((n) => !inside.has(n))) d.set(c, 0), queue.push(c);
  for (let q = 0; q < queue.length; q++) {
    const c = queue[q];
    for (const n of map.cells[c].c) {
      if (!inside.has(n)) continue;
      const nd = d.get(c)! + Math.hypot(map.cells[n].p[0] - map.cells[c].p[0], map.cells[n].p[1] - map.cells[c].p[1]);
      if (nd < (d.get(n) ?? Infinity)) d.set(n, nd), queue.push(n);
    }
  }
  return d;
}

function build(plane: string, dataDir: URL) {
  const map = loadPlaneMap(plane);
  const regions = loadRegions(plane);
  const region = assignCells(map, regions);
  const codes = regions.names.map(slug);
  const cells = map.cells;
  const zone = centreCells(map, region);
  const inZone = new Set(zone);
  const deep = depth(map, inZone);
  const at = (c: number) => cells[c].p;
  const gap = (a: number, b: number) => Math.hypot(at(a)[0] - at(b)[0], at(a)[1] - at(b)[1]);

  // Số điểm theo diện tích như các vùng (diem.ts), trừ thành chủ, sơn môn, cửa ải, hang Thú Hoàng
  const avgCells = codes.reduce((s, _, k) => s + cells.filter((c) => region[c.i] === k).length, 0) / codes.length;
  const scale = zone.length / avgCells;
  const border = new Map<number, number[]>(); // vùng giáp ranh → ô biên khu sát vùng đó
  for (const c of zone) for (const n of cells[c].c) if (region[n] >= 0 && !border.get(region[n])?.includes(c)) border.set(region[n], [...(border.get(region[n]) ?? []), c]);
  const targets: Record<string, number> = {
    deo: [...border.values()].reduce((s, list) => s + 1 + Math.floor(list.length / GATE_EVERY), 0),
    hang_thu_hoang: BOSSES,
    cua_bi_canh: Math.round(MEAN_COUNTS.cua_bi_canh * scale),
    linh_tuyen: Math.round(MEAN_COUNTS.linh_tuyen * scale),
    son_mon: SON_MON,
    hang_di_thu: Math.round(MEAN_COUNTS.hang_di_thu * scale),
    mo_quang: Math.round(MEAN_COUNTS.mo_quang * scale),
    mo_duoc: Math.round(MEAN_COUNTS.mo_duoc * scale),
    mo_linh_thach: Math.round(MEAN_COUNTS.mo_linh_thach * scale),
  };

  const points: Point[] = [];
  const taken = new Set<number>(); // ô có điểm
  const near = new Set<number>(); // ô có điểm hoặc sát điểm
  const add = (type: string, cell: number, extra: Partial<Point> = {}) => {
    const [x, y] = at(cell);
    points.push({ id: points.length, type, cell, x, y, h: cells[cell].h, biome: map.biomes[cells[cell].biome], stages: -1, distance: -1, danger: 0, ...extra });
    taken.add(cell);
    near.add(cell);
    for (const n of cells[cell].c) near.add(n);
  };
  /** Đặt `n` điểm loại `type` lên `cands`, lần lượt chọn ô xa nhất các điểm cùng loại (và các ô `away`); ô sát điểm khác
   * chỉ dùng khi hết ô trống. Điểm đầu tiên lấy ô có `first` lớn nhất */
  const place = (type: string, n: number, cands: number[], away: number[] = [], first: (c: number) => number = () => 0) => {
    const mine = () => [...away, ...points.filter((p) => p.type === type).map((p) => p.cell)];
    for (let k = 0; k < n; k++) {
      let pool = cands.filter((c) => !near.has(c));
      if (!pool.length) pool = cands.filter((c) => !taken.has(c));
      if (!pool.length) return;
      const others = mine();
      let best = pool[0], bestScore = -Infinity;
      for (const c of pool) {
        const score = others.length ? Math.min(...others.map((o) => gap(c, o))) : first(c);
        if (score > bestScore) (best = c), (bestScore = score);
      }
      add(type, best);
    }
  };

  // Cửa ải: trên biên chung với từng vùng, cái đầu ở giữa đoạn biên
  for (const [k, list] of [...border].sort((a, b) => a[0] - b[0])) {
    const mx = list.reduce((s, c) => s + at(c)[0], 0) / list.length, my = list.reduce((s, c) => s + at(c)[1], 0) / list.length;
    const before = points.length;
    place("deo", 1 + Math.floor(list.length / GATE_EVERY), list, [], (c) => -Math.hypot(at(c)[0] - mx, at(c)[1] - my));
    for (const p of points.slice(before)) p.neighbour = codes[k];
  }
  const gates = points.map((p) => p.cell);
  const byDepth = [...zone].sort((a, b) => deep.get(a)! - deep.get(b)!);
  const pct = (q: number) => deep.get(byDepth[Math.floor(q * (byDepth.length - 1))])!;
  const riverSide = zone.filter((c) => cells[c].r || cells[c].c.some((n) => cells[n].r) || map.biomes[cells[c].biome] === "Wetland");
  const highest = [...zone].sort((a, b) => cells[b].h - cells[a].h).slice(0, Math.ceil(zone.length / 2));
  const forest = zone.filter((c) => FOREST.has(map.biomes[cells[c].biome]));

  place("hang_thu_hoang", BOSSES, zone.filter((c) => deep.get(c)! >= BOSS_DEPTH[0] && deep.get(c)! <= BOSS_DEPTH[1]), gates);
  place("cua_bi_canh", targets.cua_bi_canh, zone.filter((c) => deep.get(c)! >= pct(0.5)), [], (c) => deep.get(c)!);
  place("linh_tuyen", targets.linh_tuyen, riverSide.length >= targets.linh_tuyen ? riverSide : zone);
  place("son_mon", SON_MON, zone.filter((c) => deep.get(c)! >= pct(0.25) && deep.get(c)! <= pct(0.75)));
  place("ben_do", Math.min(MAX_BEN_DO, Math.floor(zone.filter((c) => cells[c].r).length / 8)), zone.filter((c) => cells[c].r));
  place("hang_di_thu", targets.hang_di_thu, zone);
  place("mo_quang", targets.mo_quang, highest);
  place("mo_duoc", targets.mo_duoc, forest.length ? forest : zone);
  place("mo_linh_thach", targets.mo_linh_thach, zone, [], (c) => deep.get(c)!);

  // Đường: mỗi điểm nối tới LINKS điểm gần nhất đi theo ô kề trong khu, không đi xuyên qua ô của điểm khác
  const pointAt = new Map(points.map((p) => [p.cell, p.id]));
  const edges = new Map<string, Edge>();
  const search = (starts: number[], stopAt: (id: number) => boolean, limit: number) => {
    const prev = new Map<number, number>(starts.map((c) => [c, -1]));
    const queue = [...starts];
    const found: [number, number[]][] = [];
    for (let q = 0; q < queue.length && found.length < limit; q++) {
      const c = queue[q];
      for (const n of cells[c].c) {
        if (!inZone.has(n) || prev.has(n)) continue;
        prev.set(n, c);
        const id = pointAt.get(n);
        if (id !== undefined && stopAt(id)) {
          const path = [n];
          for (let x = c; x >= 0; x = prev.get(x)!) path.push(x);
          found.push([id, path.reverse()]);
          if (found.length >= limit) break;
          continue; // điểm là đích, không đi xuyên
        }
        if (id === undefined) queue.push(n);
      }
    }
    return found;
  };
  const addEdge = (from: number, to: number, path: number[]) => {
    const [a, b] = from < to ? [from, to] : [to, from];
    const key = `${a}|${b}`;
    if (edges.has(key)) return;
    const ordered = from === a ? path : [...path].reverse();
    edges.set(key, { a, b, kind: "loi_mon", cells: path.length - 1, danger: 0, path: ordered.map((c) => at(c)) });
  };
  for (const p of points) for (const [id, path] of search([p.cell], (id) => id !== p.id, LINKS)) addEdge(p.id, id, path);
  // Nối các cụm rời với nhau tới khi liền một khối
  const groupOf = () => {
    const group = points.map((p) => p.id);
    const root = (i: number): number => (group[i] === i ? i : (group[i] = root(group[i])));
    for (const e of edges.values()) group[root(e.a)] = root(e.b);
    return points.map((p) => root(p.id));
  };
  for (let g = groupOf(); new Set(g).size > 1; g = groupOf()) {
    const home = points.filter((p) => g[p.id] === g[0]);
    const [[id, path]] = search(home.map((p) => p.cell), (id) => g[id] !== g[0], 1);
    addEdge(pointAt.get(path[0])!, id, path);
  }
  const edgeList = [...edges.values()];

  // Cấp nguy hiểm theo quãng đường từ cửa ải gần nhất (Dijkstra theo số ô dọc đường), số chặng theo đường đi
  const gateIds = points.filter((p) => p.type === "deo").map((p) => p.id);
  const adj = new Map<number, [number, number][]>();
  for (const e of edgeList) adj.set(e.a, [...(adj.get(e.a) ?? []), [e.b, e.cells]]), adj.set(e.b, [...(adj.get(e.b) ?? []), [e.a, e.cells]]);
  const dist = new Map<number, number>(gateIds.map((id) => [id, 0]));
  const stages = new Map<number, number>(gateIds.map((id) => [id, 0]));
  const open = [...gateIds];
  while (open.length) {
    open.sort((a, b) => dist.get(a)! - dist.get(b)!);
    const u = open.shift()!;
    for (const [v, w] of adj.get(u) ?? []) {
      if (dist.get(u)! + w < (dist.get(v) ?? Infinity)) {
        dist.set(v, dist.get(u)! + w);
        stages.set(v, stages.get(u)! + 1);
        open.push(v);
      }
    }
  }
  const maxDist = Math.max(...points.map((p) => dist.get(p.id) ?? 0));
  const ring = ringPosition(map, region);
  const round = (x: number) => Math.round(x * 10) / 10;
  for (const p of points) {
    p.distance = dist.get(p.id) ?? -1;
    p.stages = stages.get(p.id) ?? -1;
    p.danger = p.type === "hang_thu_hoang" ? DANGER.boss : DANGER.from + Math.round((p.distance / maxDist) * (DANGER.to - DANGER.from));
    if (p.type === "cua_bi_canh") p.tier = p.danger >= HIGH_GATE ? "cao" : "vua";
    p.ring = Math.round(ring(p.x, p.y) * 100) / 100;
  }
  for (const e of edgeList) e.danger = Math.max(points[e.a].danger, points[e.b].danger);
  namePoints(points, ZONE.element, mulberry32(SEED + 1000));

  // Cửa ải nối ra điểm gần nhất của vùng bên kia (đường qua ô của khu và vùng đó); proto chưa đi liên vùng, để sẵn
  const links = points
    .filter((p) => p.type === "deo")
    .map((p) => {
      const k = codes.indexOf(p.neighbour!);
      const other = (JSON.parse(readFileSync(new URL(`${plane}_diem_${p.neighbour}.json`, dataDir), "utf8")) as { points: { id: number; cell: number; x: number; y: number }[] }).points;
      const target = other.reduce((a, b) => (Math.hypot(b.x - p.x, b.y - p.y) < Math.hypot(a.x - p.x, a.y - p.y) ? b : a));
      const prev = new Map<number, number>([[p.cell, -1]]);
      const queue = [p.cell];
      for (let q = 0; q < queue.length && !prev.has(target.cell); q++)
        for (const n of cells[queue[q]].c) if (!prev.has(n) && (inZone.has(n) || region[n] === k)) prev.set(n, queue[q]), queue.push(n);
      const path: number[] = [];
      for (let x = target.cell; x >= 0; x = prev.get(x) ?? -1) path.unshift(x);
      return { a: p.id, region: p.neighbour!, b: target.id, cells: path.length - 1, path: path.map((c) => at(c).map(round) as [number, number]) };
    });

  // Khung ảnh nền của khu như regionFrame của vùng
  const vs = zone.flatMap((c) => cells[c].v.map((v) => map.vertices[v]));
  const frame = [
    Math.max(0, Math.floor(Math.min(...vs.map((v) => v[0])) - 8)), Math.max(0, Math.floor(Math.min(...vs.map((v) => v[1])) - 8)),
    Math.min(map.width, Math.ceil(Math.max(...vs.map((v) => v[0])) + 8)), Math.min(map.height, Math.ceil(Math.max(...vs.map((v) => v[1])) + 8)),
  ];
  const counts: Record<string, number> = {};
  for (const p of points) counts[p.type] = (counts[p.type] ?? 0) + 1;
  const out = {
    version: VERSION,
    plane,
    region: { ...ZONE, special: "cam_khu" },
    warning: WARNING,
    source: { azgaar: `${plane}_azgaar.map`, azgaarSeed: map.seed, seed: SEED },
    map: { width: map.width, height: map.height, frame, bbox: [Math.min(...points.map((p) => p.x)), Math.min(...points.map((p) => p.y)), Math.max(...points.map((p) => p.x)), Math.max(...points.map((p) => p.y))].map(round) },
    targets: { ...targets, scale: Math.round(scale * 1000) / 1000 },
    counts,
    terrains: {},
    points: points.map((p) => ({ ...p, x: round(p.x), y: round(p.y) })),
    edges: edgeList.map((e) => ({ ...e, path: e.path.map(([x, y]) => [round(x), round(y)]) })),
    links,
  };
  return { out, zone, inZone, border, targets, points, edgeList, maxDist };
}

/** Phép kiểm: [tên, đạt, chi tiết] */
function check(r: ReturnType<typeof build>): [string, boolean, string][] {
  const { out, inZone, border, targets, points, edgeList } = r;
  const res: [string, boolean, string][] = [];
  for (const [type, n] of Object.entries(targets)) res.push([`số ${type}`, (out.counts[type] ?? 0) === n, `${out.counts[type] ?? 0} / ${n}`]);
  res.push(["mỗi điểm một ô, nằm trong khu", new Set(points.map((p) => p.cell)).size === points.length && points.every((p) => inZone.has(p.cell)), `${points.length} điểm`]);
  const gateTo = new Set(points.filter((p) => p.type === "deo").map((p) => p.neighbour));
  res.push(["mỗi vùng giáp ranh có cửa ải", [...border.keys()].length === gateTo.size, `${gateTo.size} vùng`]);
  res.push(["mọi điểm tới được cửa ải", points.every((p) => p.distance >= 0), `xa nhất ${r.maxDist} ô`]);
  const normal = points.filter((p) => p.type !== "hang_thu_hoang");
  res.push(["cấp nguy hiểm 200–250, Thú Hoàng 280", normal.every((p) => p.danger >= DANGER.from && p.danger <= DANGER.to) && points.filter((p) => p.type === "hang_thu_hoang").every((p) => p.danger === DANGER.boss), `${Math.min(...normal.map((p) => p.danger))}–${Math.max(...normal.map((p) => p.danger))}`]);
  const bosses = points.filter((p) => p.type === "hang_thu_hoang");
  const bossGap = Math.min(...bosses.flatMap((a) => bosses.filter((b) => b !== a).map((b) => Math.hypot(a.x - b.x, a.y - b.y))));
  res.push(["hang Thú Hoàng rải quanh khu", bossGap > 40, `cách nhau ít nhất ${Math.round(bossGap)} đơn vị`]);
  const ends = edgeList.every((e) => Math.hypot(e.path[0][0] - points[e.a].x, e.path[0][1] - points[e.a].y) < 0.01 && Math.hypot(e.path.at(-1)![0] - points[e.b].x, e.path.at(-1)![1] - points[e.b].y) < 0.01);
  res.push(["đường đi từ a tới b", ends, `${edgeList.length} đường, ${out.links.length} lối ra vùng bên`]);
  res.push(["tên không trùng", new Set(points.map((p) => p.name)).size === points.length, `${points.length} tên`]);
  return res;
}

if (import.meta.main) {
  const plane = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : "ha";
  const dataDir = new URL("../../data/maps/", import.meta.url);
  if (process.argv.includes("--biome")) {
    const map = loadPlaneMap(plane);
    const region = assignCells(map, loadRegions(plane));
    const zone = centreCells(map, region);
    const biomes = zoneBiomes(map, zone, mulberry32(SEED));
    const file = new URL(`${plane}_cam_khu_biome.json`, dataDir);
    writeFileSync(file, JSON.stringify({ plane, cells: [...biomes] }));
    const share = new Map<number, number>();
    for (const b of biomes.values()) share.set(b, (share.get(b) ?? 0) + 1);
    console.log(`ghi ${file.pathname}: ${zone.length} ô lòng giữa; ${[...share].map(([b, n]) => `${map.biomes[b]} ${Math.round((n / zone.length) * 100)}%`).join(", ")}`);
  } else {
    const r = build(plane, dataDir);
    const results = check(r);
    for (const [name, pass, detail] of results) console.log(`${pass ? "✓" : "✗"} ${name}${detail ? `: ${detail}` : ""}`);
    const file = new URL(`${plane}_diem_${ZONE.code}.json`, dataDir);
    writeFileSync(file, JSON.stringify(r.out));
    console.log(`ghi ${file.pathname}: ${r.points.length} điểm, ${r.edgeList.length} đường`);
    if (results.some((x) => !x[1])) process.exitCode = 1;
  }
}

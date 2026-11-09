// Sinh lưới đi bộ (walkable grid) cho bản đồ mở thời gian thực (GDD mục 3, KE_HOACH mục 9 Sprint R1).
// Một ô lưới = 1 đơn vị bản đồ; ô đi được khi ô Azgaar chứa nó là đất (h >= 20, đỉnh núi >= H_BLOCK thì chặn)
// và không có sông (r = 0), trừ khi ô nằm trên đường (chặng trong file điểm) thì luôn đi được.
// Ô Azgaar là voronoi nên ô chứa một điểm là ô có tâm gần nhất. Ra data/maps/ha_di_bo_<mã vùng>.json:
// { version, region, origin: [x0, y0], width, height, data: base64, 1 bit mỗi ô theo hàng }.
import { readFileSync, writeFileSync } from "node:fs";
import { loadPlaneMap, type AzgaarMap } from "./azgaar.ts";

/** Độ cao chặn đường (đề xuất): núi cao từ mức này không đi qua được; đèo và đường ép mở ở bước sau. */
const H_BLOCK = 60;
/** Nửa cạnh vùng quét quanh tâm ô lưới khi tìm ô Azgaar gần nhất (đơn vị bản đồ). */
const NEAR = 8;

interface PointFile {
  region: { code: string };
  map: { frame: [number, number, number, number]; bbox: [number, number, number, number] };
  edges: { path: [number, number][] }[];
  points: { x: number; y: number }[];
}

/** Tâm ô Azgaar xếp vào thùng lưới NEAR đơn vị để tra gần nhất cho nhanh. */
function bucketIndex(m: AzgaarMap) {
  const b = new Map<string, number[]>();
  for (const c of m.cells) {
    const k = `${Math.floor(c.p[0] / NEAR)},${Math.floor(c.p[1] / NEAR)}`;
    let a = b.get(k);
    if (!a) b.set(k, (a = []));
    a.push(c.i);
  }
  return b;
}

/** Ô Azgaar chứa điểm (x, y), theo tính chất voronoi: ô có tâm gần nhất. */
function cellAt(m: AzgaarMap, buckets: Map<string, number[]>, x: number, y: number): number | undefined {
  const bx = Math.floor(x / NEAR);
  const by = Math.floor(y / NEAR);
  let best: number | undefined;
  let bd = Infinity;
  for (let dx = -1; dx <= 1; dx++)
    for (let dy = -1; dy <= 1; dy++)
      for (const i of buckets.get(`${bx + dx},${by + dy}`) ?? []) {
        const c = m.cells[i];
        const d = (c.p[0] - x) ** 2 + (c.p[1] - y) ** 2;
        if (d < bd) {
          bd = d;
          best = i;
        }
      }
  return best;
}

export function buildWalkGrid(m: AzgaarMap, pf: PointFile) {
  const [x0, y0, x1, y1] = pf.map.bbox;
  const ox = Math.floor(x0) - 1;
  const oy = Math.floor(y0) - 1;
  const w = Math.ceil(x1) - ox + 1;
  const h = Math.ceil(y1) - oy + 1;
  const buckets = bucketIndex(m);
  const bits = new Uint8Array(Math.ceil((w * h) / 8));
  const set = (x: number, y: number) => {
    const i = y * w + x;
    bits[i >> 3] |= 1 << (i & 7);
  };
  let walk = 0;
  for (let gy = 0; gy < h; gy++)
    for (let gx = 0; gx < w; gx++) {
      const c = cellAt(m, buckets, ox + gx + 0.5, oy + gy + 0.5);
      if (c === undefined) continue;
      const cell = m.cells[c];
      if (cell.h >= 20 && cell.h < H_BLOCK && cell.r === 0) {
        set(gx, gy);
        walk++;
      }
    }
  // Đường và điểm luôn đi được: ép mở dải rộng 1 ô dọc mọi chặng và quanh mọi điểm.
  const force = (x: number, y: number) => {
    const gx = Math.round(x - ox);
    const gy = Math.round(y - oy);
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++) {
        const ax = gx + dx;
        const ay = gy + dy;
        if (ax >= 0 && ay >= 0 && ax < w && ay < h) {
          const i = ay * w + ax;
          if (!(bits[i >> 3] & (1 << (i & 7)))) {
            bits[i >> 3] |= 1 << (i & 7);
            walk++;
          }
        }
      }
  };
  for (const e of pf.edges) for (const [x, y] of e.path) force(x, y);
  for (const p of pf.points) force(p.x, p.y);
  // base64 của bitfield, theo hàng.
  const data = Buffer.from(bits).toString("base64");
  return { version: 1, region: pf.region.code, origin: [ox, oy] as [number, number], width: w, height: h, walk, data };
}

// Chạy trực tiếp: node --experimental-strip-types tools/mapgen/di_bo.ts [mã vùng...] (mặc định cả 12 vùng Hạ vị).
if (process.argv[1] && process.argv[1].endsWith("di_bo.ts")) {
  const m = loadPlaneMap("ha");
  const dir = new URL("../../data/maps/", import.meta.url);
  let codes = process.argv.slice(2);
  if (!codes.length) {
    const world = JSON.parse(readFileSync(new URL("ha_vi_dien.json", dir), "utf8")) as { regions: { code: string }[] };
    codes = world.regions.map((r) => r.code);
  }
  for (const code of codes) {
    const pf = JSON.parse(readFileSync(new URL(`ha_diem_${code}.json`, dir), "utf8")) as PointFile;
    const g = buildWalkGrid(m, pf);
    writeFileSync(new URL(`ha_di_bo_${code}.json`, dir), JSON.stringify(g));
    console.log(`${code}: ${g.width} × ${g.height}, đi được ${(g.walk / 1000).toFixed(1)} nghìn ô (${Math.round((g.walk / (g.width * g.height)) * 100)}%), file ${(g.data.length / 1024).toFixed(1)} KB`);
  }
}

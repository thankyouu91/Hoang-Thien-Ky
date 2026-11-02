// Gán mỗi ô Azgaar vào một vùng theo ảnh chỉ số vùng <vị diện>_vung.png mà heightmap.ts sinh từ khung (độ sáng
// (k + 1) × 16 là vùng k, 0 là ngoài vùng). Cùng ảnh và cùng cách tra với azgaar-patch.ts, nên vùng ở đây khớp biome.
// Không dùng quốc gia của Azgaar.
//
// Chạy: node --experimental-strip-types tools/mapgen/vung.ts [ha] → in thống kê từng vùng
import { readFileSync } from "node:fs";
import { decodePng } from "./png.ts";
import { loadPlaneMap, type AzgaarMap } from "./azgaar.ts";

const dataDir = new URL("../../data/maps/", import.meta.url);

export interface Regions {
  width: number;
  height: number;
  index: Int8Array; // -1 ngoài vùng
  names: string[]; // "Lôi Đình Cốc"
  elements: string[]; // "Lôi"
}

export function loadRegions(plane: string): Regions {
  const png = decodePng(readFileSync(new URL(`${plane}_vung.png`, dataDir)));
  const meta = JSON.parse(readFileSync(new URL(`${plane}_toa_do.json`, dataDir), "utf8")) as { centres: { name: string }[] };
  const index = new Int8Array(png.width * png.height);
  for (let i = 0; i < index.length; i++) index[i] = Math.round(png.data[i * 4] / 16) - 1;
  return {
    width: png.width,
    height: png.height,
    index,
    names: meta.centres.map((c) => c.name.replace(/\s*\(.*\)$/, "")),
    elements: meta.centres.map((c) => /\(([^)]+)\)/.exec(c.name)?.[1] ?? ""),
  };
}

/** Mã không dấu như ELEMENTS của packages/sim: "Lôi Đình Cốc" → "loi_dinh_coc", "Âm lãnh" → "am_lanh" */
export const slug = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[đĐ]/g, "d").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

/** Vùng của từng ô, -1 là ngoài vùng. Nét viền tối của khung (vd 72,64,63) gần màu Cửu U Uyên và vài vùng tối khác, nên
 * vài ô dọc biên giới bị đọc thành mảnh lẻ của vùng đó. Mỗi vùng chỉ giữ mảng liền lớn nhất; mảnh lẻ theo vùng kề nó nhiều
 * nhất. (Sửa ở heightmap.ts thì heightmap đổi và phải sinh lại bản đồ Azgaar, nên sửa ở đây; biome của mảnh lẻ vẫn theo
 * vùng đọc nhầm.) */
export function assignCells(map: AzgaarMap, regions: Regions): Int8Array {
  const region = Int8Array.from(map.cells, ({ p: [x, y] }) => {
    const rx = Math.min(regions.width - 1, Math.floor((x * regions.width) / map.width));
    const ry = Math.min(regions.height - 1, Math.floor((y * regions.height) / map.height));
    return regions.index[ry * regions.width + rx];
  });
  const pieces: number[][] = [];
  const seen = new Uint8Array(region.length);
  for (const { i } of map.cells) {
    if (seen[i] || region[i] < 0) continue;
    const piece = [i];
    seen[i] = 1;
    for (let q = 0; q < piece.length; q++)
      for (const n of map.cells[piece[q]].c) if (!seen[n] && region[n] === region[i]) (seen[n] = 1), piece.push(n);
    pieces.push(piece);
  }
  const largest = new Map<number, number>();
  for (const piece of pieces) largest.set(region[piece[0]], Math.max(largest.get(region[piece[0]]) ?? 0, piece.length));
  for (const piece of pieces.sort((a, b) => a.length - b.length || a[0] - b[0])) {
    const k = region[piece[0]];
    if (piece.length === largest.get(k)) continue;
    const votes = new Map<number, number>();
    for (const c of piece) for (const n of map.cells[c].c) if (region[n] !== k) votes.set(region[n], (votes.get(region[n]) ?? 0) + 1);
    const [winner] = [...votes].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0] ?? [-1];
    for (const c of piece) region[c] = winner;
  }
  return region;
}

const FOREST = new Set(["Tropical seasonal forest", "Temperate deciduous forest", "Tropical rainforest", "Temperate rainforest", "Taiga"]);
const HIGH = 62; // như azgaar-patch.ts

if (import.meta.main) {
  const plane = process.argv[2] ?? "ha";
  const map = loadPlaneMap(plane);
  const regions = loadRegions(plane);
  const region = assignCells(map, regions);
  const voidBiome = map.biomes.indexOf("Hư Không");
  const mismatch = map.cells.filter((c) => (region[c.i] < 0) !== (c.biome === voidBiome)).length;
  const routeCells = new Set(map.routes.flatMap((r) => r.points.map((p) => p[2])));
  console.log(`${plane}: seed ${map.seed}, ${map.width}×${map.height}, ${map.cells.length} ô, ${map.burgs.length} thị trấn, ${map.routes.length} đường, ${map.rivers.length} sông, ${map.markers.length} điểm đánh dấu`);
  console.log(`ô lệch giữa vùng và biome Hư Không: ${mismatch}`);
  console.log("vùng | ô | km² | thị trấn | thị trấn lớn nhất | ô có đường | ô có sông | đường cắt sông | ô rừng | ô núi | điểm đánh dấu");
  const kmPerPx = 2; // distanceScale trong ha_azgaar_tuy_chon.json
  [...regions.names.keys(), -1].forEach((k) => {
    const cells = map.cells.filter((c) => region[c.i] === k);
    const ids = new Set(cells.map((c) => c.i));
    const burgs = map.burgs.filter((b) => ids.has(b.cell)).sort((a, b) => b.population - a.population);
    const markers = new Map<string, number>();
    map.markers.filter((m) => ids.has(m.cell)).forEach((m) => markers.set(m.type, (markers.get(m.type) ?? 0) + 1));
    const area = cells.reduce((s, c) => s + c.area, 0) * kmPerPx ** 2;
    const top = burgs[0] ? `${burgs[0].name} (${burgs[0].population.toFixed(1)})` : "-";
    console.log(
      [
        k < 0 ? "ngoài vùng" : `${regions.names[k]} (${regions.elements[k]})`,
        cells.length,
        Math.round(area),
        burgs.length,
        top,
        cells.filter((c) => routeCells.has(c.i)).length,
        cells.filter((c) => c.r).length,
        cells.filter((c) => c.r && routeCells.has(c.i)).length,
        cells.filter((c) => FOREST.has(map.biomes[c.biome])).length,
        cells.filter((c) => c.h >= HIGH).length,
        [...markers].map(([t, n]) => `${t} ${n}`).join(", ") || "-",
      ].join(" | "),
    );
  });
}

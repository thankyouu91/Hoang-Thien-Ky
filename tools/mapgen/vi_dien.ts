// Mục lục bản đồ cả vị diện cho proto: bản đồ lớn hiện đủ cả vị diện, người chơi ở vùng nào thì phóng vào vùng đó, và chỉ
// tải những ô ảnh nền đang nhìn thấy (người dùng chọn ngày 2026-11-03). Gồm 12 vùng (file điểm, khung, thành chủ), ranh
// giới vùng, nhãn loại điểm, và các mức ảnh nền chia ô do azgaar-nen.ts renderTiles vẽ.
//
// Chạy: node --experimental-strip-types tools/mapgen/vi_dien.ts [vị diện]   (sau diem.ts cho mọi vùng)
// Ra: data/maps/<vị diện>_vi_dien.json; in sẵn lệnh vẽ ảnh nền chia ô để dán vào console Azgaar
import { readFileSync, writeFileSync } from "node:fs";
import { loadPlaneMap } from "./azgaar.ts";
import { assignCells, loadRegions, slug } from "./vung.ts";

const VERSION = 1;
/** Ảnh nền chia ô: mỗi mức là số điểm ảnh ảnh nền trên một điểm ảnh bản đồ; ô vuông TILE điểm ảnh. Mức 6 khớp ảnh từng vùng cũ */
const LEVELS = [1, 2, 4, 6];
const TILE = 1024;

/** Nhãn hiện khi rê chuột, và màu khung ô nút gợi ý theo loại điểm (đề xuất; trong ô là ký hiệu hệ của vùng) */
const TYPES: Record<string, { label: string; color: string }> = {
  thanh_chu: { label: "Thành chủ", color: "#b03a2e" },
  son_mon: { label: "Vị trí sơn môn", color: "#6c3483" },
  cua_bi_canh: { label: "Cửa bí cảnh", color: "#1f618d" },
  hang_di_thu: { label: "Hang dị thú", color: "#7b241c" },
  linh_tuyen: { label: "Linh tuyền", color: "#2e86c1" },
  mo_linh_thach: { label: "Mỏ linh thạch", color: "#17a589" },
  mo_quang: { label: "Mỏ quặng", color: "#626567" },
  mo_duoc: { label: "Mỏ dược", color: "#1e8449" },
  deo: { label: "Đèo", color: "#4d5656" },
  ben_do: { label: "Bến đò", color: "#1a5276" },
};
/** Bậc cửa bí cảnh: người dùng chọn thấp xanh, vừa vàng, cao đỏ (2026-11-02) */
const TIERS = { thap: { label: "Bí cảnh thấp", color: "#2e86c1" }, vua: { label: "Bí cảnh vừa", color: "#d4ac0d" }, cao: { label: "Bí cảnh cao", color: "#c0392b" } };
const TERRAINS = { hoa_mach: "Hỏa mạch", co_tich: "Cổ tích", son_hiem: "Sơn hiểm", linh_mach: "Linh mạch", thuy_trach: "Thủy trạch", thuong_lo: "Thương lộ" };

type Point = { id: number; type: string; x: number; y: number; name: string; stages: number; distance: number; danger: number };

/** Ranh giới giữa hai vùng (hoặc vùng với ngoài vùng) thành các đường nối liền, theo cạnh chung của ô Azgaar */
function borders(plane: string, codes: string[]) {
  const map = loadPlaneMap(plane);
  const region = assignCells(map, loadRegions(plane));
  const segments = new Map<string, [number, number][]>(); // "a|b" → cạnh (cặp đỉnh)
  for (const c of map.cells) {
    const r = region[c.i];
    if (r < 0) continue;
    for (const n of c.c) {
      const s = region[n];
      if (s === r || (s >= 0 && s < r)) continue; // mỗi cạnh lấy một lần
      const shared = c.v.filter((v) => map.cells[n].v.includes(v));
      if (shared.length !== 2) continue;
      const key = `${r}|${s}`;
      segments.set(key, [...(segments.get(key) ?? []), [shared[0], shared[1]]]);
    }
  }
  const out: { between: [string, string | null]; path: [number, number][] }[] = [];
  for (const [key, list] of segments) {
    const [r, s] = key.split("|").map(Number);
    const at = new Map<number, number[]>(); // đỉnh → chỉ số cạnh
    list.forEach(([a, b], i) => (at.set(a, [...(at.get(a) ?? []), i]), at.set(b, [...(at.get(b) ?? []), i])));
    const used = new Uint8Array(list.length);
    const walk = (from: number, edge: number) => {
      const line = [from];
      for (let v = from, e = edge; e >= 0; ) {
        used[e] = 1;
        v = list[e][0] === v ? list[e][1] : list[e][0];
        line.push(v);
        e = (at.get(v) ?? []).find((x) => !used[x]) ?? -1;
      }
      return line;
    };
    // bắt đầu từ đầu mút (đỉnh chỉ có một cạnh) trước, rồi tới các vòng kín
    const order = [...at.keys()].sort((a, b) => (at.get(a)!.length === 1 ? 0 : 1) - (at.get(b)!.length === 1 ? 0 : 1) || a - b);
    for (const v of order)
      for (const e of at.get(v)!) {
        if (used[e]) continue;
        const round = (x: number) => Math.round(x * 10) / 10;
        out.push({ between: [codes[r], s >= 0 ? codes[s] : null], path: walk(v, e).map((p) => map.vertices[p].map(round) as [number, number]) });
      }
  }
  return out;
}

if (import.meta.main) {
  const plane = process.argv[2] ?? "ha";
  const dataDir = new URL("../../data/maps/", import.meta.url);
  const regions = loadRegions(plane);
  const codes = regions.names.map(slug);
  const meta = JSON.parse(readFileSync(new URL(`${plane}_toa_do.json`, dataDir), "utf8")) as { title: string };
  let width = 0, height = 0;
  const list = codes.map((code) => {
    const file = `${plane}_diem_${code}.json`;
    const d = JSON.parse(readFileSync(new URL(file, dataDir), "utf8"));
    (width = d.map.width), (height = d.map.height);
    const points = d.points as Point[];
    const capital = points.find((p) => p.type === "thanh_chu")!;
    return {
      code,
      name: d.region.name,
      element: d.region.element,
      file,
      frame: d.map.frame,
      bbox: d.map.bbox,
      capital: { id: capital.id, name: capital.name, x: capital.x, y: capital.y },
      points: points.length,
      maxStages: Math.max(...points.map((p) => p.stages)),
      maxDistance: Math.max(...points.map((p) => p.distance)),
    };
  });
  const tiles = LEVELS.map((level) => ({ level, cols: Math.ceil((width * level) / TILE), rows: Math.ceil((height * level) / TILE) }));
  const out = {
    version: VERSION,
    plane,
    title: meta.title,
    map: { width, height },
    // ô (col, row) ở mức `level` phủ khung bản đồ [col, row, col + 1, row + 1] × tile / level
    background: { tile: TILE, path: `${plane}_nen/x{level}/{col}_{row}.webp`, levels: tiles },
    types: TYPES,
    tiers: TIERS,
    terrains: TERRAINS,
    regions: list,
    borders: borders(plane, codes),
  };
  const file = new URL(`${plane}_vi_dien.json`, dataDir);
  writeFileSync(file, JSON.stringify(out));
  console.log(`${meta.title}: ${list.length} vùng, ${list.reduce((s, r) => s + r.points, 0)} điểm, ${out.borders.length} đoạn ranh giới`);
  console.log(`  ô ảnh nền: ${tiles.map((t) => `x${t.level} ${t.cols}×${t.rows}`).join(", ")} (${tiles.reduce((s, t) => s + t.cols * t.rows, 0)} ô)`);
  console.log(`  ghi ${file.pathname}`);
  console.log(`  vẽ ảnh nền trong console Azgaar: await (await import("/htk/nen.js")).renderTiles("${plane}_nen", ${JSON.stringify(LEVELS)}, ${TILE})`);
}

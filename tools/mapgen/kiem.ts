// Kiểm file điểm của một vùng (diem.ts) và vẽ ảnh SVG xem trước để duyệt bằng mắt.
// Kiểm: đủ số từng loại, mỗi điểm một ô và nằm trong vùng, mọi điểm đi tới được thành chủ, số chặng và cấp nguy hiểm khớp.
//
// Chạy: node --experimental-strip-types tools/mapgen/kiem.ts [vị diện] [mã vùng]   (mặc định: ha loi_dinh_coc)
// Ra: data/maps/<vị diện>_diem_<mã vùng>.svg; có phép kiểm sai thì thoát mã 1
import { readFileSync, writeFileSync } from "node:fs";
import { loadPlaneMap, type AzgaarMap } from "./azgaar.ts";
import { assignCells, loadRegions, slug } from "./vung.ts";
import { DANGER_MAX, MAX_DEO, MIN_BORDER, regionCounts, stagesFrom } from "./diem.ts";

interface FilePoint {
  id: number;
  type: string;
  cell: number;
  x: number;
  y: number;
  stages: number;
  danger: number;
  biome: string;
  terrain?: string;
  neighbour?: string;
}
interface FileEdge {
  a: number;
  b: number;
  kind: string;
  danger: number;
  path: [number, number][];
}
interface PointFile {
  version: number;
  region: { code: string; name: string; element: string };
  map: { bbox: [number, number, number, number] };
  counts: Record<string, number>;
  terrains: Record<string, number>;
  points: FilePoint[];
  edges: FileEdge[];
}

const FOREST = ["Tropical seasonal forest", "Temperate deciduous forest", "Tropical rainforest", "Temperate rainforest", "Taiga"];

function check(file: PointFile, map: AzgaarMap, region: Int8Array, k: number, codes: string[]) {
  const results: [string, boolean, string][] = [];
  const ok = (name: string, pass: boolean, detail: string) => results.push([name, pass, detail]);
  const { points, edges } = file;
  const count = (type: string) => points.filter((p) => p.type === type).length;
  const { scale, maxBenDo, total, ...perType } = regionCounts(region, k);

  ok("có số phiên bản", typeof file.version === "number", `version ${file.version}`);
  ok("tổng số điểm theo diện tích", points.length === total, `${points.length} / ${total} (×${scale.toFixed(3)} vùng trung bình)`);
  ok("một thành chủ", count("thanh_chu") === 1, `${count("thanh_chu")}`);
  for (const [type, n] of Object.entries(perType)) ok(`số ${type}`, count(type) === n, `${count(type)} / ${n}`);
  ok("có vị trí sơn môn", count("son_mon") > 0, `${count("son_mon")}`);
  ok("bến đò không quá mức", count("ben_do") <= maxBenDo, `${count("ben_do")} / tối đa ${maxBenDo}`);
  ok("id liên tục", points.every((p, i) => p.id === i), "");
  ok("mỗi điểm một ô", new Set(points.map((p) => p.cell)).size === points.length, "");
  const outside = points.filter((p) => region[p.cell] !== k);
  ok("điểm nằm trong vùng", !outside.length, outside.length ? `${outside.length} điểm ngoài vùng` : "");

  // Đèo: mỗi vùng kề thật (chung từ MIN_BORDER ô biên giới) có 1 tới MAX_DEO đèo, không có đèo sang vùng không kề
  const border = new Map<string, Set<number>>();
  for (const c of map.cells)
    if (region[c.i] === k)
      for (const n of c.c) if (region[n] >= 0 && region[n] !== k) border.set(codes[region[n]], (border.get(codes[region[n]]) ?? new Set()).add(c.i));
  const neighbours = [...border].filter(([, s]) => s.size >= MIN_BORDER).map(([code]) => code);
  const passes = (code: string) => points.filter((p) => p.type === "deo" && p.neighbour === code).length;
  ok("đèo sang mỗi vùng kề", neighbours.every((c) => passes(c) >= 1 && passes(c) <= MAX_DEO) && points.every((p) => p.type !== "deo" || neighbours.includes(p.neighbour!)),
    neighbours.map((c) => `${c} ${passes(c)}`).join(", "));
  ok("sơn môn có địa thế", points.every((p) => p.type !== "son_mon" || p.terrain), JSON.stringify(file.terrains));

  const keys = edges.map((e) => `${e.a}-${e.b}`);
  ok("chặng hợp lệ", edges.every((e) => e.a < e.b && e.b < points.length) && new Set(keys).size === keys.length, `${edges.length} chặng`);
  const capital = points.find((p) => p.type === "thanh_chu")!;
  const stages = stagesFrom(capital.id, points.length, edges);
  const lost = points.filter((p) => stages[p.id] < 0);
  ok("mọi điểm tới được thành chủ", !lost.length, lost.length ? `${lost.length} điểm không tới được` : `xa nhất ${Math.max(...stages)} chặng`);
  ok("số chặng khớp", points.every((p) => p.stages === stages[p.id]), "");
  const sorted = [...points].sort((a, b) => a.stages - b.stages);
  ok("cấp nguy hiểm tăng theo chặng", sorted.every((p, i) => p.danger >= 1 && p.danger <= DANGER_MAX && (i === 0 || p.danger >= sorted[i - 1].danger)),
    `${sorted[0].danger} → ${sorted.at(-1)!.danger}`);
  ok("cấp nguy hiểm của chặng", edges.every((e) => e.danger === Math.max(points[e.a].danger, points[e.b].danger)), "");
  // Vùng ít rừng thì mỏ dược được ra ngoài rừng, nhưng chỉ khi không còn ô rừng nào trống
  const herbs = points.filter((p) => p.type === "mo_duoc");
  const used = new Set(points.map((p) => p.cell));
  const freeForest = map.cells.filter((c) => region[c.i] === k && !used.has(c.i) && FOREST.includes(map.biomes[c.biome])).length;
  const inForest = herbs.filter((p) => FOREST.includes(p.biome)).length;
  ok("mỏ dược dùng hết rừng trước", inForest === herbs.length || freeForest === 0, `${inForest} / ${herbs.length} trong rừng, ${freeForest} ô rừng còn trống`);
  return results;
}

const POINT_STYLE: Record<string, { label: string; shape: string; r: number; fill: string }> = {
  mo_linh_thach: { label: "Mỏ linh thạch", shape: "circle", r: 1.4, fill: "#2bb5a0" },
  mo_quang: { label: "Mỏ quặng", shape: "circle", r: 1.4, fill: "#5f6a6a" },
  mo_duoc: { label: "Mỏ dược", shape: "circle", r: 1.4, fill: "#1e8449" },
  hang_di_thu: { label: "Hang dị thú", shape: "triangle", r: 2.4, fill: "#7b241c" },
  linh_tuyen: { label: "Linh tuyền", shape: "circle", r: 2.3, fill: "#5dade2" },
  ben_do: { label: "Bến đò", shape: "diamond", r: 2.8, fill: "#1a5276" },
  cua_bi_canh: { label: "Cửa bí cảnh", shape: "diamond", r: 3.2, fill: "#8e44ad" },
  son_mon: { label: "Vị trí sơn môn (màu theo địa thế)", shape: "square", r: 1.9, fill: "#999" },
  deo: { label: "Đèo", shape: "triangle", r: 3.4, fill: "#111" },
  thanh_chu: { label: "Thành chủ", shape: "star", r: 5.5, fill: "#c0392b" },
};
const TERRAIN_STYLE: Record<string, [string, string]> = {
  son_hiem: ["Sơn hiểm", "#6e2c00"],
  thuy_trach: ["Thủy trạch", "#1f618d"],
  thuong_lo: ["Thương lộ", "#d4ac0d"],
  co_tich: ["Cổ tích", "#7d3c98"],
  linh_mach: ["Linh mạch", "#17a589"],
  hoa_mach: ["Hỏa mạch", "#e74c3c"],
};
const EDGE_STYLE: Record<string, [string, number, string]> = {
  quan_dao: ["Quan đạo (đường lớn Azgaar)", 1.2, ""],
  tieu_dao: ["Tiểu đạo (đường mòn Azgaar)", 0.8, ""],
  loi_mon: ["Lối mòn nối tới điểm gần nhất", 0.5, "1.4 1"],
};

const n1 = (v: number) => Math.round(v * 10) / 10;
function shape(kind: string, x: number, y: number, r: number, fill: string, stroke = "#fff", width = 0.4): string {
  const attrs = `fill="${fill}" stroke="${stroke}" stroke-width="${width}"`;
  const poly = (pts: [number, number][]) => `<polygon points="${pts.map(([a, b]) => `${n1(a)},${n1(b)}`).join(" ")}" ${attrs}/>`;
  if (kind === "circle") return `<circle cx="${n1(x)}" cy="${n1(y)}" r="${r}" ${attrs}/>`;
  if (kind === "square") return `<rect x="${n1(x - r)}" y="${n1(y - r)}" width="${2 * r}" height="${2 * r}" ${attrs}/>`;
  if (kind === "diamond") return poly([[x, y - r], [x + r, y], [x, y + r], [x - r, y]]);
  if (kind === "triangle") return poly([[x, y - r], [x + 0.87 * r, y + 0.5 * r], [x - 0.87 * r, y + 0.5 * r]]);
  return poly(Array.from({ length: 10 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r;
    return [x + rr * Math.cos(a), y + rr * Math.sin(a)] as [number, number];
  }));
}
/** Xanh lá (an toàn) → vàng → đỏ (nguy hiểm nhất) */
function dangerColor(danger: number): string {
  const t = (danger - 1) / (DANGER_MAX - 1);
  const mix = (a: number[], b: number[], u: number) => a.map((v, i) => Math.round(v + (b[i] - v) * u));
  const [r, g, b] = t < 0.5 ? mix([46, 158, 68], [230, 190, 40], t * 2) : mix([230, 190, 40], [192, 57, 43], (t - 0.5) * 2);
  return `rgb(${r},${g},${b})`;
}

function preview(file: PointFile, map: AzgaarMap, region: Int8Array, k: number, results: [string, boolean, string][]): string {
  const PAD = 14, MAP_W = 1100, LEGEND_W = 340;
  const [x0, y0, x1, y1] = file.map.bbox;
  const vx = x0 - PAD, vy = y0 - PAD, vw = x1 - x0 + 2 * PAD, vh = y1 - y0 + 2 * PAD;
  const scale = MAP_W / vw;
  const height = Math.max(Math.round(vh * scale), 760);
  const inView = ([x, y]: [number, number]) => x > vx - 10 && x < vx + vw + 10 && y > vy - 10 && y < vy + vh + 10;
  const out: string[] = [];

  // Nền: ô Azgaar theo biome, đất cao tối dần, ô ngoài vùng mờ đi; viền vùng
  for (const c of map.cells) {
    if (!inView(c.p)) continue;
    const poly = c.v.map((v) => map.vertices[v].map(n1).join(",")).join(" ");
    const color = map.biomeColors[c.biome];
    out.push(`<polygon points="${poly}" fill="${color}" stroke="${color}" stroke-width="0.5"/>`);
    const shade = Math.max(0, (c.h - 35) / 160);
    if (shade > 0) out.push(`<polygon points="${poly}" fill="#000" fill-opacity="${n1(shade * 10) / 10}"/>`);
    if (region[c.i] !== k) out.push(`<polygon points="${poly}" fill="#f4f1ea" fill-opacity="0.6" stroke="#f4f1ea" stroke-opacity="0.6" stroke-width="0.5"/>`);
  }
  for (const c of map.cells) {
    if (region[c.i] !== k) continue;
    for (const n of c.c) {
      if (region[n] === k) continue;
      const shared = c.v.filter((v) => map.cells[n].v.includes(v));
      if (shared.length === 2) {
        const [[ax, ay], [bx, by]] = shared.map((v) => map.vertices[v]);
        out.push(`<line x1="${n1(ax)}" y1="${n1(ay)}" x2="${n1(bx)}" y2="${n1(by)}" stroke="#2c2c2c" stroke-width="0.9"/>`);
      }
    }
  }
  for (const r of map.rivers) {
    // ô -1 là chỗ sông chảy ra khỏi mép bản đồ
    const pts = r.cells.filter((c) => map.cells[c] && inView(map.cells[c].p)).map((c) => map.cells[c].p.map(n1).join(","));
    if (pts.length > 1) out.push(`<polyline points="${pts.join(" ")}" fill="none" stroke="#3b7dd8" stroke-width="${n1(0.5 + Math.min(1.5, r.discharge / 400))}" stroke-linecap="round"/>`);
  }

  // Chặng theo màu cấp nguy hiểm, nét theo loại đường
  for (const e of file.edges) {
    const [, w, dash] = EDGE_STYLE[e.kind];
    out.push(`<polyline points="${e.path.map((p) => p.join(",")).join(" ")}" fill="none" stroke="${dangerColor(e.danger)}" stroke-width="${w}" stroke-linecap="round"${dash ? ` stroke-dasharray="${dash}"` : ""}/>`);
  }
  // Điểm: mỏ trước, thành chủ sau cùng
  const order = Object.keys(POINT_STYLE);
  for (const p of [...file.points].sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type) || a.id - b.id)) {
    const s = POINT_STYLE[p.type];
    out.push(shape(s.shape, p.x, p.y, s.r, p.terrain ? TERRAIN_STYLE[p.terrain][1] : s.fill));
  }

  // Chú giải
  const legend: string[] = [];
  let y = 34;
  const text = (t: string, x: number, size = 13, weight = "normal") => legend.push(`<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}">${t}</text>`);
  text(`${file.region.name} (${file.region.element}) · bản ${file.version}`, 16, 17, "bold"), (y += 22);
  const passed = results.filter((r) => r[1]).length;
  text(`Kiểm: ${passed}/${results.length} đạt`, 16, 13, "bold"), (y += 26);
  for (const type of [...order].reverse()) {
    const s = POINT_STYLE[type];
    legend.push(shape(s.shape, 26, y - 4, s.r * 2, s.fill, "#fff", 0.8));
    text(`${s.label}: ${file.counts[type] ?? 0}`, 44), (y += 20);
  }
  y += 6;
  for (const [code, [label, color]] of Object.entries(TERRAIN_STYLE)) {
    legend.push(shape("square", 26, y - 4, 4, color, "#fff", 0.8));
    text(`${label}: ${file.terrains[code] ?? 0}`, 44), (y += 18);
  }
  y += 8;
  for (const [label, w, dash] of Object.values(EDGE_STYLE)) {
    legend.push(`<line x1="14" y1="${y - 4}" x2="38" y2="${y - 4}" stroke="#555" stroke-width="${w * 2.5}"${dash ? ` stroke-dasharray="${dash.split(" ").map((d) => +d * 2.5).join(" ")}"` : ""}/>`);
    text(label, 44), (y += 20);
  }
  y += 6;
  const maxStages = Math.max(...file.points.map((p) => p.stages));
  for (let i = 0; i <= 20; i++)
    legend.push(`<rect x="${14 + i * 14}" y="${y - 12}" width="14" height="10" fill="${dangerColor(1 + ((DANGER_MAX - 1) * i) / 20)}"/>`);
  y += 14;
  text(`Cấp nguy hiểm 1 (thành chủ) → ${DANGER_MAX} (${maxStages} chặng)`, 14, 12), (y += 26);
  text("Sông xanh dương; vùng khác và nền mờ đi", 14, 12), (y += 26);
  for (const [name, pass, detail] of results) text(`${pass ? "✓" : "✗"} ${name}${detail ? `: ${detail}` : ""}`.slice(0, 54), 14, 10.5), (y += 14);

  const totalH = Math.max(height, y + 10);
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${MAP_W + LEGEND_W}" height="${totalH}" viewBox="0 0 ${MAP_W + LEGEND_W} ${totalH}" font-family="Segoe UI, Arial, sans-serif">`,
    `<rect width="100%" height="100%" fill="#f4f1ea"/>`,
    `<g transform="scale(${n1(scale * 1000) / 1000}) translate(${n1(-vx)} ${n1(-vy)})">`,
    ...out,
    `</g>`,
    `<g transform="translate(${MAP_W} 0)"><rect width="${LEGEND_W}" height="${totalH}" fill="#fff" fill-opacity="0.85"/>`,
    ...legend,
    `</g></svg>`,
  ].join("\n");
}

if (import.meta.main) {
  const plane = process.argv[2] ?? "ha";
  const code = process.argv[3] ?? "loi_dinh_coc";
  const dataDir = new URL("../../data/maps/", import.meta.url);
  const file = JSON.parse(readFileSync(new URL(`${plane}_diem_${code}.json`, dataDir), "utf8")) as PointFile;
  const map = loadPlaneMap(plane);
  const regions = loadRegions(plane);
  const codes = regions.names.map(slug);
  const k = codes.indexOf(code);
  const region = assignCells(map, regions);
  const results = check(file, map, region, k, codes);
  for (const [name, pass, detail] of results) console.log(`${pass ? "✓" : "✗"} ${name}${detail ? `: ${detail}` : ""}`);
  const svg = new URL(`${plane}_diem_${code}.svg`, dataDir);
  writeFileSync(svg, preview(file, map, region, k, results));
  console.log(`ghi ${svg.pathname}`);
  if (results.some((r) => !r[1])) process.exit(1);
}

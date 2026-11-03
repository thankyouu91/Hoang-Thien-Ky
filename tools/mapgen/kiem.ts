// Kiểm file điểm của một vùng (diem.ts) và vẽ ảnh SVG xem trước để duyệt bằng mắt.
// Kiểm: đủ số từng loại, mỗi điểm một ô và nằm trong vùng, mọi điểm đi tới được thành chủ, số chặng và cấp nguy hiểm khớp.
//
// Chạy: node --experimental-strip-types tools/mapgen/kiem.ts [vị diện] [mã vùng]   (mặc định: ha loi_dinh_coc)
// Ra: data/maps/<vị diện>_diem_<mã vùng>.svg (có ảnh nền chia ô theo <vị diện>_vi_dien.json thì lồng các ô mức chi tiết nhất
// phủ khung nhìn); có phép kiểm sai thì thoát mã 1
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { loadPlaneMap, type AzgaarMap } from "./azgaar.ts";
import { assignCells, loadRegions, slug } from "./vung.ts";
import { DANGER_MAX, GATE_LOW, GATE_TIERS, LAIR_NEAR, LAIR_PER_BAND, MAX_DEO, MIN_BORDER, dangerOf, distancesFrom, lairBands, regionCounts, stagesFrom } from "./diem.ts";

interface FilePoint {
  id: number;
  type: string;
  cell: number;
  x: number;
  y: number;
  stages: number;
  distance: number;
  danger: number;
  ring: number;
  biome: string;
  terrain?: string;
  tier?: string;
  neighbour?: string;
  name?: string;
}
interface FileEdge {
  a: number;
  b: number;
  kind: string;
  cells: number;
  danger: number;
  path: [number, number][];
}
interface PointFile {
  version: number;
  region: { code: string; name: string; element: string };
  map: { bbox: [number, number, number, number]; frame?: [number, number, number, number] };
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
  const distances = distancesFrom(capital.id, points.length, edges);
  const maxDistance = Math.max(...distances);
  ok("quãng đường khớp", points.every((p) => p.distance === distances[p.id]), `xa nhất ${maxDistance} ô`);
  ok("cấp nguy hiểm theo quãng đường", points.every((p) => p.danger === dangerOf(p.distance, maxDistance) && p.danger >= 1 && p.danger <= DANGER_MAX),
    `${Math.min(...points.map((p) => p.danger))} → ${Math.max(...points.map((p) => p.danger))}, ${new Set(points.map((p) => p.danger)).size} mức khác nhau`);
  ok("cấp nguy hiểm của chặng", edges.every((e) => e.danger === Math.max(points[e.a].danger, points[e.b].danger)), "");
  // Vùng ít rừng thì mỏ dược được ra ngoài rừng, nhưng chỉ khi không còn ô rừng nào trống
  const herbs = points.filter((p) => p.type === "mo_duoc");
  const used = new Set(points.map((p) => p.cell));
  const freeForest = map.cells.filter((c) => region[c.i] === k && !used.has(c.i) && FOREST.includes(map.biomes[c.biome])).length;
  const inForest = herbs.filter((p) => FOREST.includes(p.biome)).length;
  ok("mỏ dược dùng hết rừng trước", inForest === herbs.length || freeForest === 0, `${inForest} / ${herbs.length} trong rừng, ${freeForest} ô rừng còn trống`);

  // Bãi quái: bậc cấp nào có điểm thì phải có hang. diem.ts cố đặt đủ LAIR_PER_BAND mỗi bậc, nhưng ở mũi vùng điểm cần nối
  // có thể bị các điểm khác bao kín, không còn ô trống nào tới được mà không cắt qua đảo khác: khi đó bậc chỉ có 1 hang và
  // được ghi ra ở đây (bậc không có điểm nào thì không đặt được)
  const lairs = points.filter((p) => p.type === "hang_di_thu");
  const lairsIn = (b: { from: number; to: number }) => lairs.filter((p) => p.danger >= b.from && p.danger < b.to).length;
  const bands = lairBands().filter((b) => points.some((p) => p.danger >= b.from && p.danger < b.to));
  const empty = bands.filter((b) => lairsIn(b) === 0);
  const thin = bands.filter((b) => lairsIn(b) > 0 && lairsIn(b) < b.min);
  ok("có hang ở mỗi bậc cấp", !empty.length,
    (empty.length ? `không có hang ở ${empty.map((b) => `${b.from}–${b.to - 1}`).join(", ")}; ` : `${lairs.length} hang, cấp ${Math.min(...lairs.map((p) => p.danger))}–${Math.max(...lairs.map((p) => p.danger))}; `) +
      (thin.length ? `chỉ 1 hang ở ${thin.map((b) => `${b.from}–${b.to - 1}`).join(", ")}` : `mỗi bậc đủ ${LAIR_PER_BAND}`));
  const nearLairs = lairs.filter((p) => p.stages <= LAIR_NEAR.stages);
  ok("hang gần thành chủ", nearLairs.length >= LAIR_NEAR.min, `${nearLairs.length} hang trong ${LAIR_NEAR.stages} chặng (cấp ${nearLairs.map((p) => p.danger).join(", ")})`);
  ok("có vị trí rìa ngoài ↔ lòng giữa", points.every((p) => p.ring >= 0 && p.ring <= 1), `ring ${Math.min(...points.map((p) => p.ring))}–${Math.max(...points.map((p) => p.ring))}`);

  // Bậc cửa bí cảnh: cửa nào cũng có bậc, đủ ba bậc khi có từ 3 cửa, bậc không giảm khi xa thành chủ hơn
  const gates = points.filter((p) => p.type === "cua_bi_canh").sort((a, b) => a.danger - b.danger);
  const level = (p: FilePoint) => (GATE_TIERS as readonly string[]).indexOf(p.tier ?? "");
  ok("bậc cửa bí cảnh", gates.every((p) => level(p) >= 0) && (gates.length < 3 || new Set(gates.map(level)).size === 3) && gates.every((p, i) => i === 0 || level(p) >= level(gates[i - 1])),
    gates.map((p) => `${p.tier} ${p.danger}`).join(", "));
  ok("có cửa bí cảnh cấp thấp", gates.length > 0 && gates[0].danger < GATE_LOW.below, `cửa thấp nhất cấp ${gates[0]?.danger}, cần dưới ${GATE_LOW.below}`);
  const names = points.map((p) => p.name ?? "");
  ok("điểm nào cũng có tên, không trùng", names.every((n) => n.length > 0) && new Set(names).size === names.length, `${new Set(names).size} tên`);
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

type Rect = [number, number, number, number];
type Tile = { href: string; x: number; y: number; w: number; h: number };
type PlaneIndex = { map: { width: number; height: number }; background: { tile: number; path: string; levels: { level: number; cols: number; rows: number }[] } };

/** Ô ảnh nền (data URI, toạ độ bản đồ) ở mức chi tiết nhất phủ khung nhìn, theo mục background của <vị diện>_vi_dien.json */
function backgroundTiles({ map, background }: PlaneIndex, dataDir: URL) {
  const { level, cols, rows } = background.levels.reduce((a, b) => (b.level > a.level ? b : a));
  const span = background.tile / level;
  return ([x0, y0, x1, y1]: Rect): Tile[] => {
    const tiles: Tile[] = [];
    for (let row = Math.max(0, Math.floor(y0 / span)); row < Math.min(rows, Math.ceil(y1 / span)); row++)
      for (let col = Math.max(0, Math.floor(x0 / span)); col < Math.min(cols, Math.ceil(x1 / span)); col++) {
        const path = background.path.replace("{level}", String(level)).replace("{col}", String(col)).replace("{row}", String(row));
        const file = new URL(path, dataDir);
        if (!existsSync(file)) continue;
        // ô ở mép bản đồ đã cắt gọn theo bản đồ
        const x = col * span, y = row * span, w = Math.min(map.width, x + span) - x, h = Math.min(map.height, y + span) - y;
        tiles.push({ href: `data:image/webp;base64,${readFileSync(file).toString("base64")}`, x, y, w, h });
      }
    return tiles;
  };
}

/** `background(khung nhìn)`: các ô ảnh nền bản đồ tranh phủ khung nhìn, có thì phủ lên nền ô và bỏ nét sông vẽ lại */
function preview(file: PointFile, map: AzgaarMap, region: Int8Array, k: number, results: [string, boolean, string][], background?: (view: Rect) => Tile[]): string {
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
  }
  const tiles = background?.([vx, vy, vx + vw, vy + vh]) ?? [];
  const n3 = (x: number) => Math.round(x * 1000) / 1000; // ô ×6 dài 170,667: làm tròn thô sẽ hở khe giữa hai ô
  for (const t of tiles) out.push(`<image href="${t.href}" x="${n3(t.x)}" y="${n3(t.y)}" width="${n3(t.w)}" height="${n3(t.h)}" preserveAspectRatio="none"/>`);
  // ô ngoài vùng mờ đi, phủ lên cả ảnh nền; gộp một đường để chỗ hai ô chồng nhau không đậm thành lưới
  const outside = map.cells.filter((c) => inView(c.p) && region[c.i] !== k);
  const fade = outside.map((c) => `M${c.v.map((v) => map.vertices[v].map(n1).join(",")).join("L")}Z`).join("");
  out.push(`<path d="${fade}" fill="#f4f1ea" fill-opacity="0.6"/>`);
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
  for (const r of tiles.length ? [] : map.rivers) {
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
  const index = new URL(`${plane}_vi_dien.json`, dataDir); // mục lục vi_dien.ts, ô ảnh nền từ azgaar-nen.ts renderTiles
  const background = existsSync(index) ? backgroundTiles(JSON.parse(readFileSync(index, "utf8")), dataDir) : undefined;
  writeFileSync(svg, preview(file, map, region, k, results, background));
  console.log(`ghi ${svg.pathname}`);
  if (results.some((r) => !r[1])) process.exit(1);
}

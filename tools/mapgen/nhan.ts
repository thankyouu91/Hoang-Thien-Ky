// Lớp nhãn cho bản đồ lớn kiểu bản đồ cổ (người dùng muốn bản đồ "thông minh", sàng lọc vị trí, 2026-11-03). Mỗi điểm có hình
// hiện (ô nút hay chấm nhỏ), độ phóng nhỏ nhất để hiện hình và để hiện tên mà không chồng lên điểm quan trọng hơn. Thêm tên
// vùng, sông và các mảng núi, rừng, đồng cỏ, sa mạc, đầm lầy, băng nguyên, đặt ở chỗ rộng nhất của mảng.
//
// Độ phóng là px CSS trên một đơn vị bản đồ, như camera.zoom của proto. Hộp giữ chỗ tính bằng px CSS theo cỡ ô nút, chấm và
// chữ của proto/src/scenes/map, nên khi phóng to hộp giữ nguyên cỡ còn các điểm giãn ra: hai hộp hết chồng nhau từ một độ
// phóng tính được. Xếp theo bậc quan trọng; mỗi điểm hiện từ độ phóng mà nó không còn chồng lên điểm nào xếp trước đang hiện,
// tên điểm xếp sau mọi hình. Chỉ so các điểm cùng vùng (có sương mù thì chỉ thấy vùng mình). Kết quả cố định, nên lia bản đồ
// không làm điểm nhấp nháy và proto không phải xếp lại mỗi khung.
//
// Chạy: node --experimental-strip-types tools/mapgen/nhan.ts [vị diện] [--xem]   (sau vi_dien.ts)
// Ra: data/maps/<vị diện>_nhan.json; --xem vẽ thêm ảnh SVG xem trước ở vài độ phóng: data/maps/<vị diện>_nhan_xem_<độ phóng>.svg
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { loadPlaneMap, type AzgaarMap } from "./azgaar.ts";
import { assignCells, FOREST, HIGH, loadRegions } from "./vung.ts";
import { mulberry32 } from "./diem.ts";
import { backgroundTiles } from "./kiem.ts";
import { nameFeatures } from "./ten.ts";

const VERSION = 1;
const SEED = 20261103;
const MAX_ZOOM = 5; // camera.maxZoom của proto
/** Cỡ hộp giữ chỗ, px CSS: ô nút 20 (thành chủ 26) cách nhau 6 như proto; chấm 7 cách nhau 4; tên cao 14, cách hình 4 */
const BOX = { node: 20, big: 26, gap: 6, dot: 7, dotGap: 4, font: 11, dotFont: 10, charW: 0.56, line: 14, below: 4 };
/** Thứ tự quan trọng của loại điểm, đầu danh sách xếp trước */
const ORDER = ["thanh_chu", "cua_bi_canh", "son_mon", "deo", "ben_do", "linh_tuyen", "hang_di_thu", "mo_linh_thach", "mo_duoc", "mo_quang"];
/** Hình hiện: mỏ nhiều và ít cần nhìn từ xa nên là chấm nhỏ (như làng nhỏ trên bản đồ cổ), còn lại là ô nút. Ô nút chỉ hiện
 * khi tên cũng có chỗ (như bản đồ mẫu, ô nào cũng kèm tên); chấm hiện trước, tên hiện khi đủ chỗ */
const FORM: Record<string, "nut" | "cham"> = { mo_linh_thach: "cham", mo_duoc: "cham", mo_quang: "cham" };
/** Độ phóng sàn theo loại: thu nhỏ chỉ còn thành chủ, cửa bí cảnh, sơn môn; phóng dần mới hiện đường đi, hang, mỏ */
const FLOOR: Record<string, number> = { son_mon: 0.7, deo: 1.1, ben_do: 1.1, linh_tuyen: 1.1, hang_di_thu: 1.8, mo_linh_thach: 2.4, mo_duoc: 2.4, mo_quang: 2.4 };
/** Địa hình đặt tên: núi theo độ cao, còn lại theo biome Azgaar; mảng ít ô hơn MIN_PATCH thì không đặt tên */
const BIOME_KIND: Record<string, string> = {
  Grassland: "dong_co", Savanna: "dong_co", "Cold desert": "sa_mac", "Hot desert": "sa_mac", Wetland: "dam_lay", Tundra: "bang_nguyen", Glacier: "bang_nguyen",
};
const MIN_PATCH = 30;
/** Tên địa hình chữ nghiêng có giãn chữ, cỡ 12: bề ngang mỗi chữ cái khoảng 0,62 cỡ chữ */
const FEATURE_FONT = 12, FEATURE_CHAR_W = 0.62;
/** Sông theo lưu lượng: 15% lớn nhất là giang, 35% kế là hà/thủy, còn lại là khê */
const RIVER_KINDS: [number, string][] = [[0.15, "giang"], [0.5, "song"], [1, "khe"]];

type Box = [number, number, number, number]; // x0, y0, x1, y1 px quanh tâm
type Point = { id: number; type: string; x: number; y: number; name: string; tier?: string };
type Item = { k: number; p: Point; form: "nut" | "cham"; box: Box; label: Box; z: number; t: number };

/** Khoảng độ phóng [lo, hi) mà hộp `a` quanh (ax, ay) chồng hộp `b` quanh (bx, by); trên mỗi trục hai hộp chồng khi
 * a0 − b1 < d·s < a1 − b0, với d là khoảng cách hai tâm theo đơn vị bản đồ và s là độ phóng */
function clash(ax: number, ay: number, a: Box, bx: number, by: number, b: Box): [number, number] {
  const axis = (d: number, a0: number, a1: number, b0: number, b1: number): [number, number] => {
    const lo = a0 - b1, hi = a1 - b0;
    if (d === 0) return lo < 0 && hi > 0 ? [0, Infinity] : [Infinity, 0];
    const s0 = lo / d, s1 = hi / d;
    return d > 0 ? [Math.max(0, s0), Math.max(0, s1)] : [Math.max(0, s1), Math.max(0, s0)];
  };
  const [x0, x1] = axis(bx - ax, a[0], a[2], b[0], b[2]);
  const [y0, y1] = axis(by - ay, a[1], a[3], b[1], b[3]);
  return [Math.max(x0, y0), Math.min(x1, y1)];
}

/** Độ phóng nhỏ nhất để hộp `box` quanh (x, y) không chồng hộp nào đã xếp từ đó trở lên (others: tâm, hộp, độ phóng bắt
 * đầu hiện). Hộp khác chồng trong [lo, hi) mà đang hiện ở đó thì phải phóng tới hi */
function clearFrom(x: number, y: number, box: Box, from: number, others: Iterable<{ x: number; y: number; box: Box; z: number }>): number {
  let z = from;
  for (const o of others) {
    const [lo, hi] = clash(x, y, box, o.x, o.y, o.box);
    if (lo < hi && Math.max(lo, o.z) < hi) z = Math.max(z, hi);
  }
  return z;
}

const textW = (s: string, font: number, charW: number) => s.length * font * charW;
const up2 = (z: number) => (z > MAX_ZOOM ? null : Math.ceil(z * 100) / 100);

/** Xếp lần lượt điểm xa nhất các điểm đã chọn, bắt đầu từ `seeds`: điểm cùng loại hiện ra rải đều khi thu nhỏ */
function spread<T extends { x: number; y: number }>(list: T[], seeds: { x: number; y: number }[]): T[] {
  const left = [...list];
  const near = left.map((p) => Math.min(Infinity, ...seeds.map((s) => Math.hypot(p.x - s.x, p.y - s.y))));
  const out: T[] = [];
  while (left.length) {
    let best = 0;
    for (let i = 1; i < left.length; i++) if (near[i] > near[best]) best = i;
    const [p] = left.splice(best, 1);
    near.splice(best, 1);
    out.push(p);
    left.forEach((q, i) => (near[i] = Math.min(near[i], Math.hypot(q.x - p.x, q.y - p.y))));
  }
  return out;
}

type Taken = { x: number; y: number; box: Box; z: number };
/** Tên địa hình xếp chen giữa các loại điểm: `floor` là độ phóng chữ lọt trong mảng, `z` là kết quả */
type Extra = { x: number; y: number; box: Box; floor: number; z: number };
/** Tên địa hình xếp ngay sau loại điểm này: thu nhỏ vẫn thấy tên rừng núi như bản đồ mẫu, đèo, bến đò, mỏ nhường chỗ */
const TERRAIN_AFTER = "son_mon";

/** Độ phóng hiện hình và tên cho mọi điểm cả vị diện (pointsOf theo vùng) và cho tên địa hình `extras`. Xếp chung mọi vùng
 * để tắt sương mù cũng không chồng ở chỗ giáp vùng; có sương mù thì điểm sát biên chỉ hiện muộn hơn một chút */
function placeAll(pointsOf: Point[][], extras: Extra[]): Item[][] {
  const all = pointsOf.flatMap((points, k) => points.map((p) => ({ k, p, x: p.x, y: p.y })));
  const capitals = all.filter((a) => a.p.type === "thanh_chu");
  const items: Item[] = [];
  // Mỗi điểm giữ chỗ cả hình lẫn tên trước khi xét điểm kém quan trọng hơn, nên điểm sau không che tên điểm trước
  const taken: Taken[] = [];
  for (const type of ORDER) {
    const form = FORM[type] ?? "nut";
    const big = type === "thanh_chu";
    const size = form === "cham" ? BOX.dot : big ? BOX.big : BOX.node;
    const h = size / 2 + (form === "cham" ? BOX.dotGap : BOX.gap) / 2;
    const top = size / 2 + BOX.below;
    for (const { k, p } of spread(all.filter((a) => a.p.type === type), capitals)) {
      const w = textW(p.name, form === "cham" ? BOX.dotFont : big ? BOX.font + 1 : BOX.font, BOX.charW) / 2 + 2;
      const it: Item = { k, p, form, box: [-h, -h, h, h], label: [-w, top, w, top + BOX.line], z: 0, t: 0 };
      const floor = FLOOR[type] ?? 0;
      // ô nút và tên cùng hiện: từ độ phóng ô trống, tìm tiếp độ phóng tên cũng trống (ô vẫn trống vì mọi độ phóng trên đó đều trống)
      if (form === "nut") it.z = it.t = clearFrom(p.x, p.y, it.label, clearFrom(p.x, p.y, it.box, floor, taken), taken);
      else {
        it.z = clearFrom(p.x, p.y, it.box, floor, taken);
        it.t = clearFrom(p.x, p.y, it.label, it.z, taken);
      }
      taken.push({ x: p.x, y: p.y, box: it.box, z: it.z }, { x: p.x, y: p.y, box: it.label, z: it.t });
      items.push(it);
    }
    if (type === TERRAIN_AFTER)
      for (const e of extras) {
        e.z = clearFrom(e.x, e.y, e.box, e.floor, taken);
        taken.push(e);
      }
  }
  return pointsOf.map((_, k) => items.filter((it) => it.k === k));
}

/** Ô xa biên nhất của một tập ô (đi theo ô kề, tính bằng khoảng cách tâm ô) và khoảng cách đó: chỗ đặt tên rộng nhất */
function widest(map: AzgaarMap, cells: number[]): { cell: number; r: number } {
  const inside = new Set(cells);
  const dist = new Map<number, number>();
  const queue: number[] = [];
  for (const c of cells) if (map.cells[c].c.some((n) => !inside.has(n))) dist.set(c, 0), queue.push(c);
  // ít ô nên Dijkstra đơn giản: lặp tới khi không còn rút ngắn được
  for (let q = 0; q < queue.length; q++) {
    const c = queue[q], d = dist.get(c)!;
    for (const n of map.cells[c].c) {
      if (!inside.has(n)) continue;
      const nd = d + Math.hypot(map.cells[n].p[0] - map.cells[c].p[0], map.cells[n].p[1] - map.cells[c].p[1]);
      if (nd < (dist.get(n) ?? Infinity)) dist.set(n, nd), queue.push(n);
    }
  }
  let best = cells[0];
  for (const c of cells) if ((dist.get(c) ?? 0) > (dist.get(best) ?? 0)) best = c;
  return { cell: best, r: dist.get(best) ?? 0 };
}

/** Mảng ô liền nhau cùng vùng và cùng loại địa hình */
function patches(map: AzgaarMap, region: Int8Array, kindOf: (c: number) => string | undefined) {
  const seen = new Uint8Array(map.cells.length);
  const out: { region: number; kind: string; cells: number[] }[] = [];
  for (const c of map.cells) {
    const kind = kindOf(c.i);
    if (seen[c.i] || region[c.i] < 0 || !kind) continue;
    const cells = [c.i];
    seen[c.i] = 1;
    for (let q = 0; q < cells.length; q++)
      for (const n of map.cells[cells[q]].c)
        if (!seen[n] && region[n] === region[c.i] && kindOf(n) === kind) (seen[n] = 1), cells.push(n);
    out.push({ region: region[c.i], kind, cells });
  }
  return out;
}

/** Làm mềm đường gấp khúc (Chaikin), giữ hai đầu */
function smooth(path: [number, number][], rounds = 2): [number, number][] {
  let p = path;
  for (let k = 0; k < rounds && p.length > 2; k++) {
    const q: [number, number][] = [p[0]];
    for (let i = 0; i < p.length - 1; i++) {
      const [ax, ay] = p[i], [bx, by] = p[i + 1];
      q.push([ax * 0.75 + bx * 0.25, ay * 0.75 + by * 0.25], [ax * 0.25 + bx * 0.75, ay * 0.25 + by * 0.75]);
    }
    q.push(p.at(-1)!);
    p = q;
  }
  return p;
}

const length = (path: [number, number][]) => path.slice(1).reduce((s, [x, y], i) => s + Math.hypot(x - path[i][0], y - path[i][1]), 0);
const r1 = (x: number) => Math.round(x * 10) / 10;

type World = {
  map: { width: number; height: number };
  background: { tile: number; path: string; levels: { level: number; cols: number; rows: number }[] };
  types: Record<string, { label: string; color: string }>;
  tiers: Record<string, { label: string; color: string }>;
  regions: { code: string; name: string; element: string; file: string }[];
  borders: { between: [string, string | null]; path: [number, number][] }[];
};

function build(plane: string, dataDir: URL) {
  const world = JSON.parse(readFileSync(new URL(`${plane}_vi_dien.json`, dataDir), "utf8")) as World;
  const map = loadPlaneMap(plane);
  const regions = loadRegions(plane);
  const region = assignCells(map, regions);
  const pointsOf = world.regions.map((r) => (JSON.parse(readFileSync(new URL(r.file, dataDir), "utf8")) as { points: Point[] }).points);

  // Tên vùng ở chỗ rộng nhất của vùng
  const regionLabels = world.regions.map((r, k) => {
    const { cell, r: radius } = widest(map, map.cells.filter((c) => region[c.i] === k).map((c) => c.i));
    return { code: r.code, name: r.name, x: r1(map.cells[cell].p[0]), y: r1(map.cells[cell].p[1]), r: r1(radius) };
  });

  // Mảng địa hình: núi trước (theo độ cao), rồi biome của phần không phải núi
  const voidBiome = map.biomes.indexOf("Hư Không");
  const kindOf = (c: number) => {
    const cell = map.cells[c];
    if (cell.biome === voidBiome) return undefined;
    if (cell.h >= HIGH) return "nui";
    const biome = map.biomes[cell.biome];
    return FOREST.has(biome) ? "rung" : BIOME_KIND[biome];
  };
  const features = patches(map, region, kindOf)
    .filter((f) => f.cells.length >= MIN_PATCH)
    .map((f) => ({ ...f, ...widest(map, f.cells) }))
    .sort((a, b) => b.cells.length - a.cells.length);

  // Sông: đường qua tâm các ô sông, làm mềm, đặt chiều trái sang phải cho chữ; vùng là vùng có nhiều ô sông nhất
  const ranked = [...map.rivers].sort((a, b) => b.discharge - a.discharge);
  const rivers = ranked
    .map((river, i) => {
      // đoạn dài nhất nằm trong vùng: phần chảy ra Hư Không không ghi tên
      let cells: number[] = [];
      for (let run: number[] = [], j = 0; j <= river.cells.length; j++) {
        const c = river.cells[j];
        if (j < river.cells.length && map.cells[c] && region[c] >= 0) run.push(c);
        else (run.length > cells.length && (cells = run)), (run = []);
      }
      const votes = new Map<number, number>();
      for (const c of cells) votes.set(region[c], (votes.get(region[c]) ?? 0) + 1);
      const k = [...votes].sort((a, b) => b[1] - a[1])[0]?.[0];
      let path = smooth(cells.map((c) => map.cells[c].p));
      if (path.length && path[0][0] > path.at(-1)![0]) path = path.reverse();
      const kind = RIVER_KINDS.find(([share]) => i < share * ranked.length)![1];
      return { k, kind, path, cells: cells.length };
    })
    .filter((r) => r.k !== undefined && r.cells >= 3) as { k: number; kind: string; path: [number, number][]; cells: number }[];

  // Đặt tên theo hệ của vùng, không trùng tên điểm trong vùng
  world.regions.forEach((r, k) => {
    const used = new Set(pointsOf[k].map((p) => p.name));
    nameFeatures([...features.filter((f) => f.region === k), ...rivers.filter((v) => v.k === k)] as { kind: string; name?: string }[], r.element, mulberry32(SEED + k), used);
  });

  // Tên địa hình hiện từ độ phóng mà chữ lọt trong mảng, xếp chen giữa các loại điểm (placeAll)
  const extras: Extra[] = (features as (typeof features[number] & { name: string })[]).map((f) => {
    const [x, y] = map.cells[f.cell].p;
    const w = textW(f.name, FEATURE_FONT, FEATURE_CHAR_W) / 2 + 4;
    return { x, y, box: [-w, -FEATURE_FONT, w, FEATURE_FONT], floor: w / (f.r + 3), z: 0 }; // nửa bề ngang chữ lọt trong bán kính chỗ rộng nhất (cộng nửa ô)
  });
  // Điểm
  const placed = placeAll(pointsOf, extras);
  const points = Object.fromEntries(
    world.regions.map((r, k) => {
      const z: (number | null)[] = [], t: (number | null)[] = [];
      for (const it of placed[k]) (z[it.p.id] = up2(it.z)), (t[it.p.id] = up2(it.t));
      return [r.code, { z, t }];
    }),
  );

  const featureLabels = (features as (typeof features[number] & { name: string })[]).map((f, i) => ({
    region: world.regions[f.region].code, kind: f.kind, name: f.name, x: r1(extras[i].x), y: r1(extras[i].y), r: r1(f.r), cells: f.cells.length, z: up2(extras[i].z),
  }));
  const riverLabels = (rivers as (typeof rivers[number] & { name: string })[]).map((v) => ({
    region: world.regions[v.k].code,
    kind: v.kind,
    name: v.name,
    // chữ chạy dọc đường sông khi đường dài hơn chữ cộng hai đầu chừa 12 px
    z: up2((textW(v.name, FEATURE_FONT, FEATURE_CHAR_W) + 24) / length(v.path)),
    path: v.path.map(([x, y]) => [r1(x), r1(y)]),
  }));

  const out = {
    version: VERSION,
    plane,
    // độ phóng = px CSS trên một đơn vị bản đồ (camera.zoom của proto); null là không tự hiện tới độ phóng tối đa
    zoom: { max: MAX_ZOOM },
    boxes: BOX,
    order: ORDER,
    forms: Object.fromEntries(ORDER.map((t) => [t, FORM[t] ?? "nut"])),
    // theo vùng, chỉ số mảng là id điểm: z = độ phóng hiện hình, t = độ phóng hiện tên
    points,
    regions: regionLabels,
    features: featureLabels,
    rivers: riverLabels,
  };
  return { out, world, placed, pointsOf, extras };
}

/** Ảnh SVG xem trước khung nhìn W × H px tâm (cx, cy) ở độ phóng z, vẽ như proto sẽ vẽ từ file nhãn */
function preview(plane: string, dataDir: URL, data: ReturnType<typeof build>, z: number, cx: number, cy: number, W = 1440, H = 900): string {
  const { out, world, placed } = data;
  const sx = (x: number) => r1((x - cx) * z + W / 2), sy = (y: number) => r1((y - cy) * z + H / 2);
  const view: [number, number, number, number] = [cx - W / 2 / z, cy - H / 2 / z, cx + W / 2 / z, cy + H / 2 / z];
  const inView = (x: number, y: number) => x > view[0] - 20 && x < view[2] + 20 && y > view[1] - 20 && y < view[3] + 20;
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const svg: string[] = [];
  for (const t of backgroundTiles(world as never, dataDir, z)(view))
    svg.push(`<image href="${t.href}" x="${(t.x - cx) * z + W / 2}" y="${(t.y - cy) * z + H / 2}" width="${t.w * z}" height="${t.h * z}" preserveAspectRatio="none"/>`);
  for (const b of world.borders)
    svg.push(`<polyline points="${b.path.map(([x, y]) => `${sx(x)},${sy(y)}`).join(" ")}" fill="none" stroke="#5a2a17" stroke-opacity="0.7" stroke-width="${b.between[1] ? 1.2 : 2}" stroke-dasharray="${b.between[1] ? "5 4" : ""}"/>`);
  const halo = `paint-order="stroke" stroke="#f3e7c9" stroke-width="3" stroke-linejoin="round"`;
  // sông và địa hình
  out.rivers.forEach((v, i) => {
    if (v.z === null || z < v.z) return;
    svg.push(`<path id="song${i}" d="M${v.path.map(([x, y]) => `${sx(x)},${sy(y)}`).join("L")}" fill="none"/>`);
    svg.push(`<text font-family="Georgia, serif" font-style="italic" font-size="${FEATURE_FONT}" fill="#2f5d7c" letter-spacing="1" ${halo}><textPath href="#song${i}" startOffset="50%" text-anchor="middle">${esc(v.name)}</textPath></text>`);
  });
  for (const f of out.features)
    if (f.z !== null && z >= f.z && inView(f.x, f.y))
      svg.push(`<text x="${sx(f.x)}" y="${sy(f.y)}" font-family="Georgia, serif" font-style="italic" font-size="${FEATURE_FONT}" fill="#6b4a2b" letter-spacing="1" text-anchor="middle" dominant-baseline="middle" ${halo}>${esc(f.name)}</text>`);
  if (z < 1.3)
    for (const r of out.regions)
      svg.push(`<text x="${sx(r.x)}" y="${sy(r.y)}" font-family="Georgia, serif" font-style="italic" font-weight="700" font-size="18" fill="#5a2a17" letter-spacing="4" text-anchor="middle" dominant-baseline="middle" ${halo}>${esc(r.name)}</text>`);
  // điểm: hình rồi tên
  const icons: string[] = [], names: string[] = [];
  world.regions.forEach((r, k) => {
    const he = new URL(`../../assets/pixellab/he/${r.element}.png`, import.meta.url);
    const icon = existsSync(he) ? `data:image/png;base64,${readFileSync(he).toString("base64")}` : "";
    for (const it of placed[k]) {
      if (z < it.z || !inView(it.p.x, it.p.y)) continue;
      const x = sx(it.p.x), y = sy(it.p.y);
      const color = it.p.type === "cua_bi_canh" && it.p.tier ? world.tiers[it.p.tier].color : world.types[it.p.type].color;
      if (it.form === "cham") icons.push(`<circle cx="${x}" cy="${y}" r="${BOX.dot / 2}" fill="${color}" stroke="#2a1d14" stroke-width="1.2"/>`);
      else {
        const s = it.p.type === "thanh_chu" ? BOX.big : BOX.node;
        icons.push(`<rect x="${x - s / 2}" y="${y - s / 2}" width="${s}" height="${s}" fill="#f3e7c9" stroke="${color}" stroke-width="3"/><rect x="${x - s / 2 - 1}" y="${y - s / 2 - 1}" width="${s + 2}" height="${s + 2}" fill="none" stroke="#2a1d14" stroke-width="1"/>`);
        if (icon) icons.push(`<image href="${icon}" x="${x - s / 2 + 3}" y="${y - s / 2 + 3}" width="${s - 6}" height="${s - 6}"/>`);
      }
      if (z >= it.t) {
        const font = it.form === "cham" ? BOX.dotFont : BOX.font;
        names.push(`<text x="${x}" y="${r1(y + it.label[1] + font)}" font-family="Segoe UI, sans-serif" font-weight="600" font-size="${font}" fill="#2a1d14" text-anchor="middle" ${halo}>${esc(it.p.name)}</text>`);
      }
    }
  });
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`,
    `<rect width="100%" height="100%" fill="#b9a080"/>`,
    ...svg,
    ...icons,
    ...names,
    `<rect x="8" y="8" width="210" height="26" fill="#f3e7c9" fill-opacity="0.9"/><text x="16" y="26" font-family="Segoe UI, sans-serif" font-size="13" fill="#2a1d14">Độ phóng ${z} · ${icons.length > 0 ? "" : "không điểm"}</text>`,
    `</svg>`,
  ].join("\n");
}

if (import.meta.main) {
  const plane = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : "ha";
  const dataDir = new URL("../../data/maps/", import.meta.url);
  const data = build(plane, dataDir);
  const { out, placed, extras } = data;
  const file = new URL(`${plane}_nhan.json`, dataDir);
  writeFileSync(file, JSON.stringify(out));
  console.log(`ghi ${file.pathname} (${Math.round(JSON.stringify(out).length / 1024)} KB)`);
  console.log(`  tên vùng ${out.regions.length}, địa hình ${out.features.length}, sông ${out.rivers.length}`);
  const at = (zs: number[]) => zs.map((s) => `${s}: ${placed.flat().filter((it) => it.z <= s).length}/${placed.flat().filter((it) => it.t <= s).length}`).join(", ");
  console.log(`  số điểm hiện hình/tên theo độ phóng (cả vị diện): ${at([0.5, 1, 1.5, 2, 3, 5])}`);
  const never = placed.flat().filter((it) => it.z > MAX_ZOOM).length;
  console.log(`  điểm không tự hiện tới độ phóng ${MAX_ZOOM}: ${never}; tên không tự hiện: ${placed.flat().filter((it) => it.t > MAX_ZOOM).length}`);
  // Kiểm vét cạn: ở mỗi độ phóng, không hai hộp đang hiện nào (hình, tên điểm, tên địa hình) chồng nhau
  const boxes = [
    ...placed.flat().flatMap((it) => [{ x: it.p.x, y: it.p.y, box: it.box, z: it.z }, { x: it.p.x, y: it.p.y, box: it.label, z: it.t }]),
    ...extras,
  ];
  let clashes = 0;
  for (const s of [0.4, 0.6, 0.85, 1, 1.3, 1.6, 2, 2.5, 3, 4, 5]) {
    const shown = boxes
      .filter((b) => b.z <= s)
      .map((b) => [b.x * s + b.box[0], b.y * s + b.box[1], b.x * s + b.box[2], b.y * s + b.box[3]])
      .sort((a, b) => a[0] - b[0]);
    for (let i = 0; i < shown.length; i++)
      for (let j = i + 1; j < shown.length && shown[j][0] < shown[i][2] - 1e-6; j++)
        if (shown[j][1] < shown[i][3] - 1e-6 && shown[i][1] < shown[j][3] - 1e-6) clashes++;
  }
  console.log(`  kiểm chồng nhau ở 11 độ phóng 0,4–5: ${clashes} cặp`);
  if (clashes) process.exitCode = 1;
  if (process.argv.includes("--xem")) {
    const lo = data.world.regions.findIndex((r) => r.code === "loi_dinh_coc");
    const capital = placed[lo].find((it) => it.p.type === "thanh_chu")!.p;
    for (const [z, x, y] of [[0.85, 768, 512], [1.8, capital.x + 60, capital.y - 40], [3.5, capital.x, capital.y]]) {
      const svg = new URL(`${plane}_nhan_xem_${z}.svg`, dataDir);
      writeFileSync(svg, preview(plane, dataDir, data, z, x, y));
      console.log(`  ghi ${svg.pathname}`);
    }
  }
}

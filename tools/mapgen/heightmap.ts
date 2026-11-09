// Đổi khung vùng của một vị diện (ảnh màu các vùng trên một màu nền) thành heightmap xám cho Azgaar Fantasy Map Generator.
// Biên giới giữa hai vùng thành dãy núi có khe (đèo); mỗi hệ một dáng địa hình. Cùng seed cho cùng ảnh.
// Không có biển (2026-11-02: điểm trên bản đồ là đảo nổi vẽ bằng PixelLab): nền ngoài vùng thành đất, lòng giữa là
// cao nguyên, đất dốc dần ra mép ảnh để sông chảy ra ngoài. Trong Azgaar phải đặt lakeElevationLimit = 80, không thì
// mọi chỗ trũng không thông ra nước đều thành hồ.
//
// Chạy: node --experimental-strip-types tools/mapgen/heightmap.ts [ha|trung|than|thanh] [thư mục Azgaar]
// Ra: data/maps/<vị diện>_heightmap.png và <vị diện>_vung.png (chỉ số vùng cùng lưới: độ sáng (k + 1) × 16 là vùng k,
// 0 là ngoài vùng). Có thư mục Azgaar thì chép heightmap vào public/heightmaps/htk-<vị diện>.png, còn ảnh vùng, toạ độ
// vùng, bản đồ đã chốt (.map) và azgaar-patch.ts, azgaar-nen.ts, azgaar-cam-khu.ts (đã bỏ kiểu, thành patch.js, nen.js,
// cam_khu.js) vào public/htk/, cùng việc tô biome lòng giữa <vị diện>_cam_khu_biome.json nếu đã có (cam_khu.ts --biome).
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { join } from "node:path";
import { decodePng, encodeGrayPng } from "./png.ts";

const plane = process.argv[2] ?? "ha";
const azgaarDir = process.argv[3];
const SEED = 20261102;
const OUT_W = 600; // Azgaar co ảnh về số ô của lưới, nên 600 × 400 là dư
// Dãy núi biên giới: nửa bề rộng (ô ảnh) và độ cao đỉnh. Một ô Azgaar ở 40K điểm bằng khoảng 2,5 ô ảnh,
// nên dãy hẹp hơn khoảng 15 ô sẽ bị lưới của Azgaar làm mờ mất.
const RIDGE_HALF_WIDTH = 18;
const RIDGE_HEIGHT = 34;
const RISE = 20; // đất cao dần từ rìa ngoài vào lòng giữa
const CENTRE_DOME = 12; // lòng giữa vồng lên thành cao nguyên, để không thành chảo đọng nước giữa vành các vùng

/** Dáng địa hình theo hệ chủ đạo của vùng: [độ cao nền, độ gồ ghề], đơn vị độ cao Azgaar (0–100, biển dưới 20). Đề xuất, chỉnh theo mắt. */
const PROFILE: Record<string, [number, number]> = {
  "Kim": [10, 22], // kiếm phong nhọn
  "Mộc": [6, 12], // đồi rừng
  "Thủy": [-4, 6], // thấp, nhiều hồ
  "Hỏa": [18, 24], // núi lửa
  "Thổ": [8, 5], // cao nguyên phẳng
  "Lôi": [4, 16], // thung lũng giữa núi
  "Phong": [2, 5], // thảo nguyên
  "Quang": [14, 6], // đài cao
  "Âm lãnh": [-6, 4], // đầm lầy
  "Cực dương": [3, 7], // sa mạc
  "Cực âm": [0, 18], // vực sâu
  "Cực hàn": [16, 10], // băng nguyên cao
};
const DEFAULT_PROFILE: [number, number] = [6, 10];
const OUTSIDE_PROFILE: [number, number] = [0, 3]; // đất ngoài các vùng: bằng phẳng

const dataDir = new URL("../../data/maps/", import.meta.url);
const frame = decodePng(readFileSync(new URL(`${plane}_khung.png`, dataDir)));
const meta = JSON.parse(readFileSync(new URL(`${plane}_toa_do.json`, dataDir), "utf8")) as {
  centres: { name: string; x: number; y: number }[];
};

const S = Math.round(frame.width / OUT_W);
const W = Math.floor(frame.width / S), H = Math.floor(frame.height / S), N = W * H;

const rgbAt = (x: number, y: number) => {
  const i = (y * frame.width + x) * 4;
  return [frame.data[i], frame.data[i + 1], frame.data[i + 2]];
};
const dist2 = (p: number[], q: number[]) => (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2;

const background = rgbAt(0, 0);
const regionColors = meta.centres.map((c) => rgbAt(c.x, c.y));
const profiles = meta.centres.map((c) => PROFILE[/\(([^)]+)\)/.exec(c.name)?.[1] ?? ""] ?? DEFAULT_PROFILE);

/** -1 nền ngoài vùng, -2 nét viền (không giống màu nào), còn lại là chỉ số vùng */
function classify(x: number, y: number): number {
  const p = rgbAt(x, y);
  if (dist2(p, background) < 300) return -1;
  let best = -2, bestD = 1200;
  regionColors.forEach((c, i) => {
    const d = dist2(p, c);
    if (d < bestD) (bestD = d), (best = i);
  });
  return best;
}

// Thu nhỏ khung theo khối S × S, mỗi ô lấy loại chiếm đa số, bỏ qua nét viền.
const region = new Int8Array(N);
for (let y = 0; y < H; y++)
  for (let x = 0; x < W; x++) {
    const votes = new Map<number, number>();
    for (let dy = 0; dy < S; dy++)
      for (let dx = 0; dx < S; dx++) {
        const k = classify(x * S + dx, y * S + dy);
        if (k !== -2) votes.set(k, (votes.get(k) ?? 0) + 1);
      }
    let best = -1, n = 0;
    for (const [k, v] of votes) if (v > n || (v === n && k > best)) (best = k), (n = v);
    region[y * W + x] = best;
  }
const isRegion = (i: number) => region[i] >= 0;

// Nền ngoài vùng: mảng chạm mép ảnh là rìa ngoài, các mảng còn lại là lòng giữa.
const rim = new Uint8Array(N);
const stack: number[] = [];
for (let x = 0; x < W; x++) stack.push(x, (H - 1) * W + x);
for (let y = 0; y < H; y++) stack.push(y * W, y * W + W - 1);
while (stack.length) {
  const i = stack.pop()!;
  if (rim[i] || isRegion(i)) continue;
  rim[i] = 1;
  const x = i % W;
  if (x > 0) stack.push(i - 1);
  if (x < W - 1) stack.push(i + 1);
  if (i >= W) stack.push(i - W);
  if (i < N - W) stack.push(i + W);
}
const isCentre = (i: number) => !isRegion(i) && !rim[i];

/** Khoảng cách (ô) tới ô đặc trưng gần nhất, chamfer 3-4 hai lượt */
function distanceTo(feature: (i: number) => boolean): Float32Array {
  const d = new Float32Array(N);
  for (let i = 0; i < N; i++) d[i] = feature(i) ? 0 : 1e9;
  const relax = (i: number, x: number, y: number, cost: number) => {
    if (x >= 0 && x < W && y >= 0 && y < H) d[i] = Math.min(d[i], d[y * W + x] + cost);
  };
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      relax(i, x - 1, y, 3), relax(i, x, y - 1, 3), relax(i, x - 1, y - 1, 4), relax(i, x + 1, y - 1, 4);
    }
  for (let y = H - 1; y >= 0; y--)
    for (let x = W - 1; x >= 0; x--) {
      const i = y * W + x;
      relax(i, x + 1, y, 3), relax(i, x, y + 1, 3), relax(i, x + 1, y + 1, 4), relax(i, x - 1, y + 1, 4);
    }
  for (let i = 0; i < N; i++) d[i] /= 3;
  return d;
}

const isBorder = (i: number) => {
  if (!isRegion(i)) return false;
  const x = i % W, y = (i - x) / W;
  for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
    if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
    const j = ny * W + nx;
    if (isRegion(j) && region[j] !== region[i]) return true;
  }
  return false;
};
const toOutside = distanceTo((i) => !isRegion(i));
const toRegion = distanceTo(isRegion);
const toRim = distanceTo((i) => rim[i] === 1);
const toCentre = distanceTo(isCentre);
const toBorder = distanceTo(isBorder);

/** Làm mềm dáng địa hình qua biên giới bằng box blur hai chiều; ở mép ảnh chỉ tính các ô có thật */
function blur(values: Float32Array, r: number): Float32Array {
  const pass = (src: Float32Array, horizontal: boolean) => {
    const out = new Float32Array(N);
    const [lines, len] = horizontal ? [H, W] : [W, H];
    const at = (a: number, b: number) => (horizontal ? a * W + b : b * W + a);
    for (let a = 0; a < lines; a++)
      for (let b = 0; b < len; b++) {
        let s = 0, n = 0;
        for (let c = Math.max(0, b - r); c <= Math.min(len - 1, b + r); c++) (s += src[at(a, c)]), n++;
        out[at(a, b)] = s / n;
      }
    return out;
  };
  return pass(pass(values, true), false);
}
const profileAt = (i: number) => (isRegion(i) ? profiles[region[i]] : OUTSIDE_PROFILE);
const base = blur(new Float32Array(N).map((_, i) => profileAt(i)[0]), 12);
const rough = blur(new Float32Array(N).map((_, i) => profileAt(i)[1]), 12);

function mulberry32(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), s | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** Value noise trong [-1, 1], ô lưới `cell` điểm ảnh */
function valueNoise(seed: number, cell: number) {
  const gw = Math.ceil(W / cell) + 2, gh = Math.ceil(H / cell) + 2;
  const rnd = mulberry32(seed);
  const g = Float32Array.from({ length: gw * gh }, () => rnd() * 2 - 1);
  const smooth = (t: number) => t * t * (3 - 2 * t);
  return (x: number, y: number) => {
    const fx = x / cell, fy = y / cell, x0 = Math.floor(fx), y0 = Math.floor(fy);
    const tx = smooth(fx - x0), ty = smooth(fy - y0);
    const at = (ix: number, iy: number) => g[iy * gw + ix];
    const top = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * tx;
    const bottom = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * tx;
    return top + (bottom - top) * ty;
  };
}
const octaves = [valueNoise(SEED, 48), valueNoise(SEED + 1, 20), valueNoise(SEED + 2, 8)];
const fbm = (x: number, y: number) => 0.55 * octaves[0](x, y) + 0.28 * octaves[1](x, y) + 0.17 * octaves[2](x, y);
const passNoise = valueNoise(SEED + 3, 30);

/** Độ cao Azgaar (0–100) sang độ sáng ảnh, nghịch đảo công thức getHeightsFromImageData của Azgaar */
function toByte(h: number): number {
  const v = h / 100;
  const l = v < 0.2 ? v : 0.2 + Math.pow(v - 0.2, 1 / 0.8);
  return Math.round(Math.min(1, l) * 255);
}

const gray = new Uint8Array(N);
let hMin = 100, hMax = 0;
for (let y = 0; y < H; y++)
  for (let x = 0; x < W; x++) {
    const i = y * W + x;
    const inland = isRegion(i) ? Math.min(toOutside[i], 25) / 25 : 0;
    const slope = toRim[i] / (toRim[i] + toCentre[i]); // 0 ở rìa ngoài, 1 ở lòng giữa
    const dome = isCentre(i) ? CENTRE_DOME * Math.min(1, toRegion[i] / 30) : 0;
    const gate = Math.min(1, Math.max(0, (passNoise(x, y) + 0.55) / 0.2)); // khe hiếm trên sống núi = đèo
    const peaks = 0.8 + 0.4 * octaves[1](x, y); // đỉnh cao thấp không đều dọc sống núi
    const ridge = RIDGE_HEIGHT * peaks * Math.max(0, 1 - toBorder[i] / RIDGE_HALF_WIDTH) ** 1.2 * gate;
    let h = 21 + RISE * slope + dome + base[i] + rough[i] * fbm(x, y) * (0.4 + 0.6 * inland) + ridge * inland;
    h = Math.min(98, Math.max(21, h));
    (hMin = Math.min(hMin, h)), (hMax = Math.max(hMax, h));
    gray[i] = toByte(h);
  }

const png = encodeGrayPng(W, H, gray);
writeFileSync(new URL(`${plane}_heightmap.png`, dataDir), png);
const regionPng = encodeGrayPng(W, H, Uint8Array.from(region, (k) => (k >= 0 ? (k + 1) * 16 : 0)));
writeFileSync(new URL(`${plane}_vung.png`, dataDir), regionPng);
const count = (f: (i: number) => boolean) => region.reduce((n, _, i) => n + (f(i) ? 1 : 0), 0);
console.log(`${plane}: ${W}×${H} ô, độ cao ${hMin.toFixed(0)}–${hMax.toFixed(0)}, nền màu ${background.join(",")}; rìa ngoài ${count((i) => rim[i] === 1)} ô, lòng giữa ${count(isCentre)} ô`);
meta.centres.forEach((c, i) => console.log(`  ${c.name}: màu ${regionColors[i].join(",")}, ${region.filter((r) => r === i).length} ô`));

if (azgaarDir) {
  const target = join(azgaarDir, "public", "heightmaps", `htk-${plane}.png`);
  if (!existsSync(join(azgaarDir, "public", "heightmaps"))) throw new Error(`Không thấy thư mục heightmaps của Azgaar ở ${azgaarDir}`);
  writeFileSync(target, png);
  const ktlpDir = join(azgaarDir, "public", "ktlp");
  mkdirSync(ktlpDir, { recursive: true });
  writeFileSync(join(ktlpDir, `${plane}_vung.png`), regionPng);
  writeFileSync(join(ktlpDir, `${plane}_toa_do.json`), readFileSync(new URL(`${plane}_toa_do.json`, dataDir)));
  for (const [source, script] of [["azgaar-patch.ts", "patch.js"], ["azgaar-nen.ts", "nen.js"], ["azgaar-cam-khu.ts", "cam_khu.js"]])
    writeFileSync(join(ktlpDir, script), stripTypeScriptTypes(readFileSync(new URL(source, import.meta.url), "utf8")));
  for (const file of [`${plane}_azgaar.map`, `${plane}_cam_khu_biome.json`]) {
    const saved = new URL(file, dataDir); // bản đồ đã chốt để vẽ ảnh nền; biome lòng giữa để tô
    if (existsSync(saved)) writeFileSync(join(ktlpDir, file), readFileSync(saved));
  }
  console.log(`Đã chép sang ${target} và ${ktlpDir}`);
}

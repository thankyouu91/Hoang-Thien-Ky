// Chạy trong trang Azgaar, không chạy bằng Node: gán mưa và biome theo hệ của từng vùng thay cho khí hậu. Bản đồ không có
// biển thì Azgaar gần như không có mưa trên đất cao: cả bản đồ thành sa mạc và mọi con sông chỉ chảy ngoài 12 vùng. Gán theo
// hệ thì mỗi vùng có thảm thực vật riêng, và có sông nhiều ít theo độ ẩm của hệ.
//
// heightmap.ts chép file này (đã bỏ kiểu) thành public/ktlp/patch.js của Azgaar. Trong console, trước khi sinh bản đồ:
//   (await import("/ktlp/patch.js")).install("ha")
// install thay Precipitation.generate và Biomes.define của trang đang mở, nên sông, dân số, thị trấn, đường và điểm đánh
// dấu đều tính theo mưa và biome mới.

// Lớp biome của Azgaar vẽ theo thứ tự mã, và mảng bao quanh lục địa (nền ngoài vùng) không có biên ngoài nên bị tô ngược
// vào trong lục địa. Vì vậy nền phải mang mã nhỏ nhất để bị các biome vẽ sau phủ lên: mã 1 thành "Hư Không" (không ai ở,
// không icon, rất khó đi), sa mạc nóng dời sang mã 13.
const VOID = 1;
const HOT_DESERT = 13;

/** Mã biome mặc định của Azgaar, trừ sa mạc nóng */
const B = {
  hotDesert: HOT_DESERT,
  coldDesert: 2,
  savanna: 3,
  grassland: 4,
  tropicalForest: 5,
  deciduousForest: 6,
  temperateRainforest: 8,
  taiga: 9,
  tundra: 10,
  glacier: 11,
  wetland: 12,
};

type Theme = { mix: [number, number][]; high: number; wet: number };
/** Theo hệ: tỷ lệ % các biome ở đất thấp, biome của núi cao, và độ ẩm 0–1. Đề xuất, chỉnh theo mắt */
const THEMES: Record<string, Theme> = {
  "Kim": { mix: [[B.grassland, 40], [B.coldDesert, 35], [B.taiga, 25]], high: B.tundra, wet: 0.5 }, // đồng đá, kiếm phong
  "Mộc": { mix: [[B.deciduousForest, 45], [B.temperateRainforest, 40], [B.grassland, 15]], high: B.taiga, wet: 0.9 },
  "Thủy": { mix: [[B.wetland, 40], [B.temperateRainforest, 35], [B.grassland, 25]], high: B.taiga, wet: 1 },
  "Hỏa": { mix: [[B.savanna, 45], [B.hotDesert, 35], [B.tropicalForest, 20]], high: B.coldDesert, wet: 0.45 }, // núi lửa trơ đá
  "Thổ": { mix: [[B.grassland, 55], [B.coldDesert, 25], [B.deciduousForest, 20]], high: B.tundra, wet: 0.6 },
  "Lôi": { mix: [[B.temperateRainforest, 45], [B.taiga, 30], [B.grassland, 25]], high: B.tundra, wet: 0.8 }, // mưa giông
  "Phong": { mix: [[B.grassland, 70], [B.savanna, 20], [B.deciduousForest, 10]], high: B.tundra, wet: 0.5 },
  "Quang": { mix: [[B.grassland, 50], [B.savanna, 30], [B.deciduousForest, 20]], high: B.tundra, wet: 0.5 },
  "Âm lãnh": { mix: [[B.wetland, 50], [B.taiga, 30], [B.temperateRainforest, 20]], high: B.taiga, wet: 0.9 },
  "Cực dương": { mix: [[B.hotDesert, 70], [B.savanna, 20], [B.tropicalForest, 10]], high: B.hotDesert, wet: 0.4 }, // rừng là ốc đảo
  "Cực âm": { mix: [[B.taiga, 40], [B.coldDesert, 35], [B.wetland, 25]], high: B.tundra, wet: 0.6 },
  "Cực hàn": { mix: [[B.tundra, 65], [B.taiga, 35]], high: B.glacier, wet: 0.45 }, // băng chỉ trên núi, để không lẫn với nền
};
/** Nền ngoài vùng: không ai ở và không mưa, nên Azgaar không đặt thị trấn, đường hay nguồn sông ở đó */
const OUTSIDE: Theme = { mix: [[VOID, 100]], high: VOID, wet: 0 };
/** Lượng mưa trung bình của vùng = RAIN × độ ẩm, theo đơn vị grid.cells.prec của Azgaar. Thử 2026-11-02: 2,5 cho mỗi vùng
 * 1–14 sông, tổng 79; 2 thì 5 vùng khô không còn sông nào */
const RAIN = 2.5;
const HIGH = 62; // độ cao Azgaar (đất 20–100) từ đó coi là núi
const PATCH = 40; // cỡ mảng biome, tính bằng điểm ảnh bản đồ
const SEED = 20261102;

type Biome = { i: number; name: string; color: string; habitability: number; iconsDensity: number; icons: object; cost: number };
type Fmg = {
  grid: { points: [number, number][]; cells: { i: ArrayLike<number>; prec: Uint8Array } };
  pack: {
    cells: { i: ArrayLike<number>; p: [number, number][]; h: ArrayLike<number>; biome: Uint8Array };
    biomes: Biome[];
  };
  options: { map: { graph: { width: number; height: number } } };
  Precipitation: { generate(): void; generateOriginal?: () => void };
  Biomes: { define(): void; defineOriginal?: () => void; getDefault(): Biome[] };
};
type IndexMap = { width: number; height: number; at(x: number, y: number): number };

export async function install(plane: string): Promise<void> {
  const fmg = (window as unknown as { FMG: Fmg }).FMG;
  const meta = (await (await fetch(`/ktlp/${plane}_toa_do.json`)).json()) as { centres: { name: string }[] };
  const regions = await loadIndexMap(`/ktlp/${plane}_vung.png`);
  const themes = meta.centres.map((c) => THEMES[/\(([^)]+)\)/.exec(c.name)?.[1] ?? ""] ?? OUTSIDE);
  const themeAt = ([x, y]: [number, number]) => {
    const { width, height } = fmg.options.map.graph;
    const rx = Math.min(regions.width - 1, Math.floor((x * regions.width) / width));
    const ry = Math.min(regions.height - 1, Math.floor((y * regions.height) / height));
    return themes[regions.at(rx, ry)] ?? OUTSIDE;
  };
  const { Precipitation, Biomes } = fmg;
  const generatePrecipitation = (Precipitation.generateOriginal ??= Precipitation.generate.bind(Precipitation));
  Precipitation.generate = () => {
    generatePrecipitation();
    rain(fmg, themeAt);
  };
  const defineBiomes = (Biomes.defineOriginal ??= Biomes.define.bind(Biomes));
  Biomes.define = () => {
    defineBiomes();
    paint(fmg, themeAt);
  };
}

/** Phần lẻ của lượng mưa chia đều ra các ô theo dãy tỷ lệ vàng, vì lượng mưa của Azgaar là số nguyên */
function rain(fmg: Fmg, themeAt: (p: [number, number]) => Theme): void {
  const { points, cells } = fmg.grid;
  for (const i of Array.from(cells.i)) cells.prec[i] = Math.floor(RAIN * themeAt(points[i]).wet + ((i * 0.6180339887) % 1));
}

/** Ảnh chỉ số vùng của heightmap.ts: độ sáng (k + 1) × 16 là vùng k, 0 là ngoài vùng */
async function loadIndexMap(url: string): Promise<IndexMap> {
  // createImageBitmap thay cho Image.decode, vì decode không xong khi khung trình duyệt đang ẩn
  const image = await createImageBitmap(await (await fetch(url)).blob());
  const context = new OffscreenCanvas(image.width, image.height).getContext("2d")!;
  context.drawImage(image, 0, 0);
  const { data } = context.getImageData(0, 0, image.width, image.height);
  return { width: image.width, height: image.height, at: (x, y) => Math.round(data[(y * image.width + x) * 4] / 16) - 1 };
}

function paint(fmg: Fmg, themeAt: (p: [number, number]) => Theme): void {
  const { cells, biomes } = fmg.pack;
  const desert = fmg.Biomes.getDefault()[1];
  biomes[HOT_DESERT] = { ...desert, i: HOT_DESERT };
  biomes[VOID] = { ...desert, i: VOID, name: "Hư Không", color: "#eef3f5", habitability: 0, iconsDensity: 0, icons: {}, cost: 5000 };
  const noise = valueNoise(SEED, PATCH);
  const lowland = new Map<Theme, number[]>(); // mỗi vùng một Theme → ô đất thấp
  for (const i of Array.from(cells.i)) {
    if (cells.h[i] < 20) continue;
    const theme = themeAt(cells.p[i]);
    if (cells.h[i] >= HIGH) cells.biome[i] = theme.high;
    else if (lowland.has(theme)) lowland.get(theme)!.push(i);
    else lowland.set(theme, [i]);
  }
  // Xếp ô theo nhiễu rồi chia theo tỷ lệ, để mỗi vùng ra đúng tỷ lệ mà biome vẫn thành từng mảng
  for (const [{ mix }, list] of lowland) {
    const value = new Map(list.map((i) => [i, noise(cells.p[i][0], cells.p[i][1])]));
    list.sort((a, b) => value.get(a)! - value.get(b)! || a - b);
    const total = mix.reduce((s, [, w]) => s + w, 0);
    let start = 0, acc = 0;
    for (const [biome, weight] of mix) {
      acc += weight;
      const end = Math.round((list.length * acc) / total);
      for (let j = start; j < end; j++) cells.biome[list[j]] = biome;
      start = end;
    }
  }
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

/** Value noise trong [0, 1), ô lưới `cell` điểm ảnh, đủ rộng cho bản đồ tới 4096 × 4096 */
function valueNoise(seed: number, cell: number) {
  const size = Math.ceil(4096 / cell) + 2;
  const rnd = mulberry32(seed);
  const g = Float32Array.from({ length: size * size }, () => rnd());
  const smooth = (t: number) => t * t * (3 - 2 * t);
  return (x: number, y: number) => {
    const fx = x / cell, fy = y / cell, x0 = Math.floor(fx), y0 = Math.floor(fy);
    const tx = smooth(fx - x0), ty = smooth(fy - y0);
    const at = (ix: number, iy: number) => g[iy * size + ix];
    const top = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * tx;
    const bottom = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * tx;
    return top + (bottom - top) * ty;
  };
}

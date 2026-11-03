// Mục lục cả vị diện (data/maps/ha_vi_dien.json), file điểm của vùng (data/maps/ha_diem_<mã vùng>.json, định dạng bản 1
// do tools/mapgen/diem.ts sinh) và ảnh nền. Toạ độ điểm là toạ độ bản đồ 1536 × 1024 chung cho cả vị diện, cũng là toạ độ
// thế giới của màn bản đồ. Mỗi vùng là một chunk riêng, chỉ tải khi cần; ô ảnh nền là URL do Vite chép vào bản build.
import type { PointType } from "../../dashboard/source.ts";

export interface RegionPoint {
  id: number;
  type: PointType;
  /** Tên Hán Việt, không trùng trong vùng. */
  name?: string;
  x: number;
  y: number;
  stages: number; // số chặng tới thành chủ
  distance: number; // quãng đường tới thành chủ, số ô
  danger: number; // cấp nguy hiểm
  ring: number; // 0 sát Hư Không Hải, 1 sát Linh Hải
  tier?: "thap" | "vua" | "cao"; // bậc cửa bí cảnh
  terrain?: string; // địa thế vị trí sơn môn
  neighbour?: string; // vùng kề của đèo
}

export interface RegionEdge {
  a: number;
  b: number;
  kind: "quan_dao" | "tieu_dao" | "loi_mon";
  cells: number;
  danger: number;
  path: [number, number][];
}

export interface RegionMap {
  version: number;
  region: { code: string; name: string; element: string };
  map: { width: number; height: number; frame: [number, number, number, number]; bbox: [number, number, number, number] };
  points: RegionPoint[];
  edges: RegionEdge[];
}

export type Tier = "thap" | "vua" | "cao";

export interface WorldRegion {
  code: string;
  name: string;
  element: string;
  frame: [number, number, number, number];
  bbox: [number, number, number, number];
  capital: { id: number; name: string; x: number; y: number };
  points: number;
}

export interface WorldMap {
  version: number;
  title: string;
  map: { width: number; height: number };
  /** Ảnh nền chia ô: ô (col, row) ở mức L phủ [col, row, col + 1, row + 1] × tile / L đơn vị bản đồ. */
  background: { tile: number; path: string; levels: { level: number; cols: number; rows: number }[] };
  types: Record<PointType, { label: string; color: string }>;
  tiers: Record<Tier, { label: string; color: string }>;
  terrains: Record<string, string>;
  regions: WorldRegion[];
  /** Ranh giới giữa hai vùng; vế thứ hai null là mép ngoài vị diện. */
  borders: { between: [string, string | null]; path: [number, number][] }[];
}

const WORLD_FILE = import.meta.glob<WorldMap>("../../../../data/maps/ha_vi_dien.json", { import: "default" });
const POINT_FILES = import.meta.glob<RegionMap>("../../../../data/maps/ha_diem_*.json", { import: "default" });
const TILE_FILES = import.meta.glob<string>("../../../../data/maps/ha_nen/x*/*.webp", { query: "?url", import: "default" });

let world: Promise<WorldMap> | undefined;

export function loadWorld(): Promise<WorldMap> {
  return (world ??= WORLD_FILE["../../../../data/maps/ha_vi_dien.json"]());
}

const cache = new Map<string, Promise<RegionMap>>();

export function loadRegion(code: string): Promise<RegionMap> {
  let p = cache.get(code);
  if (!p) {
    const load = POINT_FILES[`../../../../data/maps/ha_diem_${code}.json`];
    if (!load) return Promise.reject(new Error(`Không có file điểm của vùng ${code}`));
    p = load();
    cache.set(code, p);
  }
  return p;
}

/** URL một ô ảnh nền theo `background.path` của mục lục; ô chưa có trong repo thì undefined. */
export function tileUrl(path: string, level: number, col: number, row: number): (() => Promise<string>) | undefined {
  const rel = path.replace("{level}", String(level)).replace("{col}", String(col)).replace("{row}", String(row));
  return TILE_FILES[`../../../../data/maps/${rel}`];
}

/** Số chặng từ một điểm tới mọi điểm khác (tìm theo chiều rộng trên các chặng). */
export function stagesFrom(m: RegionMap, start: number): Map<number, number> {
  const next = new Map<number, number[]>();
  for (const e of m.edges) {
    if (!next.has(e.a)) next.set(e.a, []);
    if (!next.has(e.b)) next.set(e.b, []);
    next.get(e.a)!.push(e.b);
    next.get(e.b)!.push(e.a);
  }
  const dist = new Map<number, number>([[start, 0]]);
  const queue = [start];
  for (let i = 0; i < queue.length; i++) {
    const d = dist.get(queue[i])!;
    for (const n of next.get(queue[i]) ?? []) {
      if (dist.has(n)) continue;
      dist.set(n, d + 1);
      queue.push(n);
    }
  }
  return dist;
}

/** Tên loại điểm (mã như tools/mapgen). */
export const POINT_NAMES: Record<PointType, string> = {
  thanh_chu: "Thành chủ",
  deo: "Đèo",
  ben_do: "Bến đò",
  cua_bi_canh: "Cửa bí cảnh",
  mo_linh_thach: "Mỏ linh thạch",
  linh_tuyen: "Linh tuyền",
  son_mon: "Vị trí sơn môn",
  mo_quang: "Mỏ quặng",
  mo_duoc: "Mỏ dược",
  hang_di_thu: "Hang dị thú",
};

/** Điểm tông môn giữ được (GDD mục 5): mỏ, linh tuyền, cửa bí cảnh, đèo, bến đò. */
export const HOLDABLE: PointType[] = ["mo_linh_thach", "mo_quang", "mo_duoc", "linh_tuyen", "cua_bi_canh", "deo", "ben_do"];

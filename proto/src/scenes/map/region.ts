// File điểm của vùng (data/maps/ha_diem_<mã vùng>.json, định dạng bản 1 do tools/mapgen/diem.ts sinh) và ảnh nền tranh.
// Mỗi vùng là một chunk riêng, chỉ tải khi cần; ảnh nền là URL do Vite chép vào bản build.
import type { PointType } from "../../dashboard/source.ts";

export interface RegionPoint {
  id: number;
  type: PointType;
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

/** Ảnh nền vẽ ở tỉ lệ ×6 theo khung `map.frame` (tools/mapgen/azgaar-nen.ts). */
export const BG_SCALE = 6;

const POINT_FILES = import.meta.glob<RegionMap>("../../../../data/maps/ha_diem_*.json", { import: "default" });
const BG_FILES = import.meta.glob<string>("../../../../data/maps/ha_nen_*.webp", { query: "?url", import: "default" });

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

export async function regionBackground(code: string): Promise<string | undefined> {
  const load = BG_FILES[`../../../../data/maps/ha_nen_${code}.webp`];
  return load ? load() : undefined;
}

/** Toạ độ điểm trên ảnh nền (px ảnh), cũng là toạ độ thế giới của bản đồ tranh. */
export function toImage(m: RegionMap, x: number, y: number): { x: number; y: number } {
  return { x: (x - m.map.frame[0]) * BG_SCALE, y: (y - m.map.frame[1]) * BG_SCALE };
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

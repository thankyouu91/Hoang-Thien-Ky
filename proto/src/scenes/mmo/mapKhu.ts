// Định dạng map của một khu (assets/map_khu/<vùng>__<khu>.json, danh sách ở index.json), dùng chung cho game (mmoScene.ts) và app sửa map
// (sua_map.html). Người hay AI agent sửa thẳng file JSON đều được; khu chưa có file thì dùng macDinh().
// Toạ độ theo đơn vị thế giới, gốc ở góc trên trái. Người cao chừng 56 đơn vị.
import type { LopO } from "./oDat.ts";
import { NPCS, type Zone } from "./tienTrinh.ts";

/** Nền 688×384 vẽ ở cỡ 3440×1920 khi theo mặc định: người bằng 40% so với lúc nền vẽ gấp đôi (người dùng chốt 2026-11-10). */
export const SCALE = 2.5;
export const W = 1376 * SCALE;
export const H = 768 * SCALE;
/** Số bầy quái khi map không tự đặt chỗ bầy. */
export const FIELD_PACKS = 24;
const TOP_PCT = 0.37;
const SPOT = 1.5;
/** Công trình đứng sau lưng từng NPC ở khu an toàn (hình trong cong_trinh/chung/), và việc khi chạm vào công trình. */
const NHA: Record<string, [string, ("shop" | "map")?]> = {
  su_gia: ["tang_kinh_cac"], tho_ren: ["luyen_khi_cac"], thuong_hoi: ["thuong_hoi", "shop"], duoc_su: ["luyen_dan_phong"],
  trong_tai: ["dien_vo_truong"], xa_phu: ["truyen_tong_tran", "map"], mat_tham: ["bao_kho"],
};

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Một hình đặt lên map. file: đường dẫn trong assets/pixellab/, không đuôi. */
export interface Hinh extends Rect {
  file: string;
  /** Lật ngang */
  lat?: boolean;
  /** Chạm vào thì mở tiệm hay truyền tống */
  act?: "shop" | "map";
}

export interface MapKhu {
  w: number;
  h: number;
  /** Nền: vẽ trước, theo thứ tự trong mảng */
  nen: Hinh[];
  /** Vật cảnh, công trình: vẽ sau nền, dưới chân người */
  vat: Hinh[];
  /** Tổ của từng bầy quái (6 con một bầy); bỏ trống thì game tự rải */
  bay: { x: number; y: number }[];
  /** Boss của khu, mỗi chỗ một con; bỏ trống thì khu có quái tự đặt một con ở góc xa cửa vào */
  boss?: { x: number; y: number; ten?: string }[];
  /** Vùng không đi vào được */
  cam: Rect[];
  /** Lớp ô đất (oDat.ts): vẽ sau nền, trước vật cảnh; nước tự thành vùng cấm. Không có thì chỉ có ảnh nền. */
  o?: LopO;
}

export const ACT_LABEL = { shop: "Thương hội", map: "Truyền tống trận" };

/** Tên file map của khu: "van_moc_lam/dong_hoang" → "van_moc_lam__dong_hoang". */
export const mapId = (bg: string) => bg.replace("/", "__");

/** Map khi khu chưa có file: một tấm nền phủ kín, cấm dải trên (tường, gốc cây), khu an toàn có tiệm và trận truyền tống. */
export function macDinh(z: Zone): MapKhu {
  const top = H * TOP_PCT;
  const spot = (file: string, act: "shop" | "map" | undefined, cx: number): Hinh => ({
    file: `cong_trinh/chung/${file}`, act, x: cx - 110 * SPOT, y: top + 30 - 118 * SPOT, w: 220 * SPOT, h: 132 * SPOT,
  });
  return {
    w: W, h: H,
    nen: [{ file: `chien_truong/${z.bg}`, x: 0, y: 0, w: W, h: H }],
    vat: z.safe ? NPCS.filter((n) => NHA[n.id]).map((n) => spot(NHA[n.id][0], NHA[n.id][1], W * n.fx)) : [],
    bay: [],
    cam: [{ x: 0, y: 0, w: W, h: top }],
  };
}

/** Boss của map: tự đặt một con ở phần phải, cách xa cửa trái, khi map không ghi. */
export function bossTuDong(m: MapKhu): { x: number; y: number; ten?: string }[] {
  if (m.boss) return m.boss;
  for (const f of [0.82, 0.7, 0.9]) {
    const p = choVao(m, m.w * f);
    if (!trongCam(m, p.x, p.y)) return [p];
  }
  return [];
}

export const trongCam = (m: MapKhu, x: number, y: number) => m.cam.some((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);

/** Rải n tổ bầy đều khắp phần đi được của map. */
export function bayTuDong(m: MapKhu, n = FIELD_PACKS): { x: number; y: number }[] {
  const all: { x: number; y: number }[] = [];
  for (let r = 0; r < 5; r++) for (let c = 0; c < 8; c++) all.push({ x: ((c + 0.5) / 8) * m.w, y: ((r + 0.5) / 5) * m.h });
  const ok = all.filter((p) => !trongCam(m, p.x, p.y));
  return ok.length <= n ? ok : Array.from({ length: n }, (_, i) => ok[Math.floor((i * ok.length) / n)]);
}

/** Chỗ đứng khi vào khu ở hoành độ x: điểm đi được đầu tiên dò theo chiều dọc. */
export function choVao(m: MapKhu, x: number): { x: number; y: number } {
  for (const f of [0.5, 0.68, 0.85, 0.3, 0.15]) if (!trongCam(m, x, m.h * f)) return { x, y: m.h * f };
  return { x, y: m.h / 2 };
}

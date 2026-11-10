// Tiến trình của bản MMORPG chơi được (choi.html): 13 vùng × 9 khu nối thành một dải thế giới, cấp, tu vi, linh thạch,
// bình máu, cường hóa vũ khí, nhiệm vụ diệt quái nối tiếp. Không chạm DOM để test bằng node. Mọi số là đề xuất.
import type { ElementId } from "../../replay/types.ts";
import { BAI } from "../bai/thamSo.ts";

/** Vùng theo thứ tự đi: thư mục nền chien_truong/, tên, hệ của dị thú. */
export const REGIONS: [string, string, ElementId][] = [
  ["van_moc_lam", "Vạn Mộc Lâm", "moc"],
  ["hau_tho_nguyen", "Hậu Thổ Nguyên", "tho"],
  ["bich_ba_hai", "Bích Ba Hải", "thuy"],
  ["thien_kiem_nguyen", "Thiên Kiếm Nguyên", "kim"],
  ["xich_viem_son", "Xích Viêm Sơn", "hoa"],
  ["cuong_phong_nguyen", "Cuồng Phong Nguyên", "phong"],
  ["loi_dinh_coc", "Lôi Đình Cốc", "loi"],
  ["dieu_quang_dai", "Diệu Quang Đài", "quang"],
  ["liet_duong_mac", "Liệt Dương Mạc", "cuc_duong"],
  ["u_minh_dam", "U Minh Đầm", "am_lanh"],
  ["van_nien_bang_nguyen", "Vạn Niên Băng Nguyên", "cuc_han"],
  ["cuu_u_uyen", "Cửu U Uyên", "cuc_am"],
  ["cam_khu", "Cấm Khu", "cuc_am"],
];

/** Khu trong một vùng, từ trái sang phải: file nền, tên, loại. */
const KINDS: [string, string, "town" | "field" | "boss"][] = [
  ["son_mon", "Sơn môn", "town"],
  ["dong_hoang", "Đồng hoang", "field"],
  ["mo_duoc", "Mỏ dược", "field"],
  ["hang_di_thu", "Hang dị thú", "field"],
  ["mo_quang", "Mỏ quặng", "field"],
  ["mo_linh_thach", "Mỏ linh thạch", "field"],
  ["deo", "Đèo", "field"],
  ["cua_bi_canh", "Cửa bí cảnh", "boss"],
  ["ben_do", "Bến đò", "town"],
];
const PER = KINDS.length;
export const ZONE_COUNT = REGIONS.length * PER;
/** Mỗi vùng quái cao hơn vùng trước chừng này cấp. */
const LEVELS_PER_REGION = 12;
export const QUEST_N = 8;

export interface Zone {
  idx: number;
  region: number;
  /** Đường dẫn nền trong chien_truong/, không đuôi */
  bg: string;
  name: string;
  element: ElementId;
  safe: boolean;
  boss: boolean;
  /** Cấp quái (0 ở khu an toàn) */
  level: number;
}

export function zone(idx: number): Zone {
  const region = Math.floor(idx / PER);
  const k = idx % PER;
  const [slug, rName, element] = REGIONS[region];
  const [type, kName, kind] = KINDS[k];
  return {
    idx, region, bg: `${slug}/${type}`, name: `${rName} · ${kName}`, element, safe: kind === "town", boss: kind === "boss",
    level: kind === "town" ? 0 : 1 + region * LEVELS_PER_REGION + Math.round((k - 1) * 1.7),
  };
}

/** Sơn môn (khu đầu) của vùng r. */
export const townOf = (r: number) => r * PER;

/** Khu có quái đầu tiên kể từ idx. */
export function nextCombat(idx: number): number {
  let i = Math.min(idx, ZONE_COUNT - 1);
  while (i < ZONE_COUNT - 1 && zone(i).safe) i++;
  return zone(i).safe ? i - 1 : i;
}

export interface Save {
  v: 1;
  name: string;
  element: ElementId;
  lv: number;
  xp: number;
  gold: number;
  pots: number;
  /** Bậc cường hóa vũ khí */
  wpn: number;
  zone: number;
  maxZone: number;
  quest: { zone: number; n: number };
}

export function newSave(name: string, element: ElementId): Save {
  return { v: 1, name: name.trim().slice(0, 16) || "Vô Danh", element, lv: 1, xp: 0, gold: 0, pots: 3, wpn: 0, zone: 0, maxZone: 0, quest: { zone: 1, n: 0 } };
}

export const hpOf = (lv: number) => 2000 + 220 * (lv - 1);
export const atkOf = (lv: number, wpn: number) => Math.round((100 + 12 * (lv - 1)) * (1 + 0.08 * wpn));
/** Tu vi cần để lên cấp kế: càng cao càng phải farm nhiều (người dùng chốt 2026-11-09). */
export const xpNeed = (lv: number) => Math.round(40 * lv ** 1.3);
export const potPrice = (z: Zone) => 15 + 10 * z.region;
export const wpnPrice = (s: Save) => Math.round(100 * (s.wpn + 1) ** 1.5);
/** Bình máu hồi chừng này phần máu tối đa. */
export const POT_HEAL = 0.4;

/** Cộng tu vi; trả về số cấp vừa lên. */
export function gainXp(s: Save, xp: number): number {
  let up = 0;
  s.xp += xp;
  while (s.xp >= xpNeed(s.lv)) {
    s.xp -= xpNeed(s.lv);
    s.lv++;
    up++;
  }
  return up;
}

export interface KillResult {
  xp: number;
  gold: number;
  pot: boolean;
  /** Thưởng nhiệm vụ nếu con này làm xong nhiệm vụ */
  quest: { xp: number; gold: number } | null;
  levels: number;
}

/** Giết một con ở khu z: tu vi, linh thạch, có thể rơi bình máu (roll trong [0, 1)), tính tiến độ nhiệm vụ. */
export function kill(s: Save, z: Zone, roll: number): KillResult {
  const k = z.boss ? 20 : 1;
  const r: KillResult = { xp: BAI.tuVi(z.level) * k, gold: (2 + z.level) * k, pot: z.boss || roll < 0.1, quest: null, levels: 0 };
  if (r.pot) s.pots++;
  s.gold += r.gold;
  let xp = r.xp;
  if (z.idx === s.quest.zone && ++s.quest.n >= (z.boss ? 1 : QUEST_N)) {
    r.quest = { xp: Math.round(xpNeed(s.lv) * 0.3), gold: 20 * z.level };
    xp += r.quest.xp;
    s.gold += r.quest.gold;
    s.quest = { zone: nextCombat(z.idx + 1), n: 0 };
  }
  r.levels = gainXp(s, xp);
  return r;
}

export function questText(s: Save): string {
  const z = zone(s.quest.zone);
  return z.boss ? `Hạ thủ lĩnh ở ${z.name}` : `Diệt ${s.quest.n}/${QUEST_N} dị thú ở ${z.name}`;
}

export function buyPot(s: Save, z: Zone): boolean {
  if (s.gold < potPrice(z)) return false;
  s.gold -= potPrice(z);
  s.pots++;
  return true;
}

export function upgrade(s: Save): boolean {
  const c = wpnPrice(s);
  if (s.gold < c) return false;
  s.gold -= c;
  s.wpn++;
  return true;
}

// Tiến trình của bản MMORPG chơi được (index.html): 13 vùng × 9 khu nối thành một dải thế giới, cấp, tu vi, linh thạch,
// bình máu, cường hóa vũ khí, nhiệm vụ diệt quái nối tiếp. Không chạm DOM để test bằng node. Mọi số là đề xuất.
import type { ElementId } from "../../replay/types.ts";
import { ATTRIBUTES, attributeBonuses, layerCost, TAY_DIEM, TECHNIQUE_LAYERS, trainingPoints, unspentPoints, type Member } from "@htk/rules";
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
  /** Điểm tiềm năng đã cộng theo thuộc tính (ATTRIBUTES của @htk/rules) */
  diem?: Record<string, number>;
  /** Tầng của từng chiêu, 1 khi chưa ghi */
  tang?: Record<string, number>;
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

// ---------- Xây nhân vật: điểm tiềm năng và tầng chiêu ----------
// Luật và số lấy nguyên của bản cũ: @htk/rules tiem_nang.ts (mỗi cấp 1 điểm vào 6 thuộc tính, tẩy điểm miễn phí dưới cấp 50)
// và layers.ts (mỗi cấp 20 điểm luyện, chiêu 10 tầng). Chiêu ở đây tính như công pháp phẩm Phàm; bỏ phần cống hiến vì chưa có tông môn.

export const layerOf = (s: Save, skill: string) => s.tang?.[skill] ?? 1;
/** Nhân vật dưới dạng Member của @htk/rules, chỉ đủ các trường mà luật điểm đọc. */
const member = (s: Save) =>
  ({ level: s.lv, diemTiemNang: s.diem ?? {}, learned: BAI.skills.map((k) => ({ layer: layerOf(s, k), grade: 1 })) }) as unknown as Member;

export const statPoints = (s: Save) => unspentPoints(member(s));
export const skillPoints = (s: Save) => trainingPoints(member(s));

export function addStat(s: Save, id: string): boolean {
  if (statPoints(s) < 1 || !ATTRIBUTES.some((a) => a.id === id)) return false;
  s.diem = { ...s.diem, [id]: (s.diem?.[id] ?? 0) + 1 };
  return true;
}

export const statResetCost = (s: Save) => (s.lv < TAY_DIEM.mienPhiDuoiCap ? 0 : TAY_DIEM.linhThach);

export function resetStats(s: Save): boolean {
  const cost = statResetCost(s);
  if (s.gold < cost) return false;
  s.gold -= cost;
  s.diem = {};
  return true;
}

/** Điểm luyện để lên tầng kế của một chiêu; null khi đã tối đa. */
export const layerPrice = (s: Save, skill: string) => (layerOf(s, skill) >= TECHNIQUE_LAYERS ? null : layerCost(layerOf(s, skill) + 1, 1).diemLuyen);

export function upSkill(s: Save, skill: string): boolean {
  const cost = layerPrice(s, skill);
  if (cost === null || cost > skillPoints(s) || !BAI.skills.includes(skill as never)) return false;
  s.tang = { ...s.tang, [skill]: layerOf(s, skill) + 1 };
  return true;
}

export function resetSkills(s: Save): void {
  s.tang = {};
}

/** Chỉ số sau khi cộng điểm tiềm năng. hp, atk là số cuối; các khóa còn lại là phần nghìn. */
export function stats(s: Save) {
  const b = attributeBonuses(member(s));
  const up = (base: number, k = 0) => Math.round((base * (1000 + k)) / 1000);
  return {
    hp: up(hpOf(s.lv), b.hp), atk: up(atkOf(s.lv, s.wpn), b.atk), manaMul: 1000 + (b.manaMax ?? 0),
    def: b.def ?? 0, crit: b.critBonus ?? 0, critDmg: b.critDamage ?? 0, manaCut: b.manaCostCut ?? 0, speed: b.attackSpeed ?? 0, cd: b.cooldownCut ?? 0,
  };
}

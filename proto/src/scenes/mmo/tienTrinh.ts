// Tiến trình của bản MMORPG chơi được (index.html): 13 vùng × 9 khu nối thành một dải thế giới, cấp, tu vi, linh thạch,
// bình máu, cường hóa vũ khí, nhiệm vụ diệt quái nối tiếp. Không chạm DOM để test bằng node. Mọi số là đề xuất.
import type { ElementId } from "../../replay/types.ts";
import { ATTRIBUTES, attributeBonuses, layerCost, TAY_DIEM, TECHNIQUE_LAYERS, trainingPoints, unspentPoints, type Member } from "@htk/rules";
import type { SkillType } from "@htk/sim";
import { BAI } from "../bai/thamSo.ts";
import { ELEMENT_STYLE } from "../../theme/elements.ts";
import TRANG_BI from "../../../../data/he_thong/json/trang_bi.json" with { type: "json" };

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
  /** Chiêu xếp vào sáu ô ra chiêu (Q W E R T Y), null là ô trống; chưa ghi thì năm chiêu khởi đầu */
  slots?: (SkillType | null)[];
  /** Tông môn đang ở: cống hiến, ngày điểm danh gần nhất, nhiệm vụ diệt dị thú của ngày taskDay */
  sect?: { id: string; cong: number; checkIn: string; taskDay: string; kills: number; taskDone: boolean };
  /** Mã các thư đã nhận quà */
  mail?: string[];
  /** Túi đồ, tối đa BAG_MAX ô; bình máu và linh thạch không nằm ở đây (pots, gold) */
  bag: ItemInstance[];
  /** Đồ đang mặc theo ô (EquipSlot) */
  equips: Record<string, ItemInstance | null>;
}

export function newSave(name: string, element: ElementId): Save {
  return { v: 1, name: name.trim().slice(0, 16) || "Vô Danh", element, lv: 1, xp: 0, gold: 0, pots: 3, wpn: 0, zone: 0, maxZone: 0, quest: { zone: 1, n: 0 }, bag: [], equips: {} };
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
  /** Thưởng nhiệm vụ nếu con này làm xong nhiệm vụ */
  quest: { xp: number; gold: number } | null;
  levels: number;
}

/** Giết một con ở khu z: tu vi và tiến độ nhiệm vụ. Linh thạch và đồ thì rơi ra đất (rollDrop), nhặt mới có. */
export function kill(s: Save, z: Zone): KillResult {
  const r: KillResult = { xp: BAI.tuVi(z.level) * (z.boss ? 20 : 1), quest: null, levels: 0 };
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
  ({ level: s.lv, diemTiemNang: s.diem ?? {}, learned: SKILL_UNLOCK.map(([k]) => ({ layer: layerOf(s, k), grade: 1 })) }) as unknown as Member;

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
  if (cost === null || cost > skillPoints(s) || !learned(s).includes(skill as SkillType)) return false;
  s.tang = { ...s.tang, [skill]: layerOf(s, skill) + 1 };
  return true;
}

export function resetSkills(s: Save): void {
  s.tang = {};
}

/** Chỉ số sau khi cộng điểm tiềm năng. hp, atk là số cuối; các khóa còn lại là phần nghìn. */
export function stats(s: Save) {
  const b = attributeBonuses(member(s));
  const g = gearBonus(s);
  const up = (base: number, k = 0) => Math.round((base * (1000 + k)) / 1000);
  return {
    hp: up(hpOf(s.lv) + g.hp, b.hp), atk: up(up(atkOf(s.lv, s.wpn) + g.atk, b.atk), rankOf(s)?.[2]), manaMul: 1000 + (b.manaMax ?? 0),
    // shortcut: trận chỉ có một loại sát thương nên thủ ngoại và thủ nội của đồ gộp trung bình vào một chỉ số thủ; tách khi có sát thương nội/ngoại.
    def: (b.def ?? 0) + Math.round((g.defExt + g.defInt) / 2), defExt: g.defExt, defInt: g.defInt, crit: (b.critBonus ?? 0) + g.crit, critDmg: b.critDamage ?? 0, manaCut: b.manaCostCut ?? 0, speed: b.attackSpeed ?? 0, cd: b.cooldownCut ?? 0,
  };
}

// ---------- Chiêu đã học và ô ra chiêu ----------

/** Cấp học từng chiêu: năm chiêu khởi đầu có sẵn, năm chiêu còn lại của sim mở dần. Mốc cấp là đề xuất, chưa có trong GDD. */
export const SKILL_UNLOCK: [SkillType, number][] = [
  ...BAI.skills.map((k): [SkillType, number] => [k, 1]),
  ["can_don", 5], ["khong_che", 10], ["than_phap", 15], ["bua_chu", 20], ["tran_phap", 30],
];
export const SLOT_COUNT = 6;

export const learned = (s: Save) => SKILL_UNLOCK.filter(([, lv]) => s.lv >= lv).map(([k]) => k);

export function slotsOf(s: Save): (SkillType | null)[] {
  return Array.from({ length: SLOT_COUNT }, (_, i) => (s.slots ? (s.slots[i] ?? null) : (BAI.skills[i] ?? null)));
}

/** Xếp một chiêu đã học vào ô i; chiêu đang ở ô khác thì hai ô đổi chỗ. */
export function setSlot(s: Save, i: number, skill: string): boolean {
  if (i !== Math.floor(i) || i < 0 || i >= SLOT_COUNT || !learned(s).includes(skill as SkillType)) return false;
  const slots = slotsOf(s);
  const j = slots.indexOf(skill as SkillType);
  if (j >= 0) slots[j] = slots[i];
  slots[i] = skill as SkillType;
  s.slots = slots;
  return true;
}

export function clearSlot(s: Save, i: number): void {
  const slots = slotsOf(s);
  slots[i] = null;
  s.slots = slots;
}

// ---------- Cảnh giới, tọa thiền, tông môn, thư ----------
// Tên cảnh giới theo data/he_thong/json/vi_dien.json (mỗi đại cảnh giới 50 cấp). Số của tọa thiền, tông môn và thư là đề xuất
// cho bản chơi một mình, chưa có trong GDD; tọa thiền chỉ hồi máu và mana, không cho tu vi (giữ nhịp lên cấp, chốt 2026-11-09).

const REALMS = ["Luyện Khí", "Trúc Cơ", "Kết Đan", "Nguyên Anh", "Hóa Thần"];
export function realm(lv: number): string {
  const k = (lv - 1) % 50;
  return `${REALMS[Math.min(REALMS.length - 1, Math.floor((lv - 1) / 50))]} · ${k < 17 ? "Sơ kỳ" : k < 34 ? "Trung kỳ" : "Hậu kỳ"}`;
}

/** Tọa thiền: phần máu và mana tối đa hồi mỗi giây. */
export const SIT = { hp: 0.05, mana: 0.1 };

/** Tông môn NPC để gia nhập (tên tạm). */
export const SECTS: [string, string, string][] = [
  ["thanh_van", "Thanh Vân Tông", "Kiếm tu chính đạo, sơn môn trên mây"],
  ["huyen_thien", "Huyền Thiên Tông", "Trận pháp và bùa chú"],
  ["van_thu", "Vạn Thú Cốc", "Ngự thú, sống giữa rừng sâu"],
];
export const SECT = { level: 10, checkIn: 50, donate: 100, donateCong: 10, taskKills: 30, taskCong: 100 };
/** Cấp bậc: cống hiến cần, tên, công cộng thêm (phần nghìn). */
export const RANKS: [number, string, number][] = [[0, "Ngoại môn đệ tử", 20], [300, "Nội môn đệ tử", 40], [1000, "Chân truyền đệ tử", 60], [3000, "Trưởng lão", 80]];

export const rankOf = (s: Save) => (s.sect ? [...RANKS].reverse().find(([n]) => s.sect!.cong >= n)! : null);

export function joinSect(s: Save, id: string): boolean {
  if (s.sect || s.lv < SECT.level || !SECTS.some(([k]) => k === id)) return false;
  s.sect = { id, cong: 0, checkIn: "", taskDay: "", kills: 0, taskDone: false };
  return true;
}

export function leaveSect(s: Save): void {
  delete s.sect;
}

/** Điểm danh mỗi ngày một lần. today: ngày theo máy người chơi, dạng YYYY-MM-DD. */
export function checkIn(s: Save, today: string): boolean {
  const t = s.sect;
  if (!t || t.checkIn === today) return false;
  t.checkIn = today;
  t.cong += SECT.checkIn;
  s.gold += 20 * s.lv;
  return true;
}

export function donate(s: Save): boolean {
  const t = s.sect;
  if (!t || s.gold < SECT.donate) return false;
  s.gold -= SECT.donate;
  t.cong += SECT.donateCong;
  return true;
}

/** Số dị thú đã diệt cho nhiệm vụ tông môn hôm nay. */
export const sectKills = (s: Save, today: string) => (s.sect?.taskDay === today ? s.sect.kills : 0);

/** Gọi mỗi lần diệt dị thú; true khi vừa xong nhiệm vụ tông môn của ngày. */
export function sectKill(s: Save, today: string): boolean {
  const t = s.sect;
  if (!t) return false;
  if (t.taskDay !== today) Object.assign(t, { taskDay: today, kills: 0, taskDone: false });
  if (t.taskDone || ++t.kills < SECT.taskKills) return false;
  t.taskDone = true;
  t.cong += SECT.taskCong;
  return true;
}

const MAILS = [
  { id: "chao", lv: 1, ten: "Quà nhập thế", gold: 50, pots: 3 },
  { id: "lv5", lv: 5, ten: "Mừng đạt cấp 5", gold: 200, pots: 3 },
  { id: "lv10", lv: 10, ten: "Mừng đạt cấp 10", gold: 500, pots: 5 },
  { id: "lv20", lv: 20, ten: "Mừng đạt cấp 20", gold: 1500, pots: 8 },
  { id: "lv30", lv: 30, ten: "Mừng đạt cấp 30", gold: 3000, pots: 10 },
  { id: "lv50", lv: 50, ten: "Mừng đạt cấp 50", gold: 8000, pots: 15 },
];

/** Thư đã tới (theo cấp), mới nhất trước. */
export const mails = (s: Save) => MAILS.filter((m) => s.lv >= m.lv).map((m) => ({ ...m, claimed: !!s.mail?.includes(m.id) })).reverse();

export function claimMail(s: Save, id: string): boolean {
  const m = mails(s).find((x) => x.id === id);
  if (!m || m.claimed) return false;
  s.mail = [...(s.mail ?? []), id];
  s.gold += m.gold;
  s.pots += m.pots;
  return true;
}

// ---------- Vật phẩm: rơi, nhặt, túi, trang bị ----------
// Kiểu trang bị (tên, ô, độ hiếm, số hình) và hệ số độ hiếm lấy từ data/he_thong/json/trang_bi.json. Tỷ lệ rơi theo
// docs/CHI_THI_CLAUDE_LOOT_VA_UIUX.md; chỉ số của món, giá bán và công dụng đan là đề xuất, chưa có trong GDD.

export type ItemRarity = "luc" | "lam" | "tim" | "vang" | "do";
export type ItemType = "trang_bi" | "dan_duoc" | "khoang_thach" | "tan_quyen" | "linh_thach";
export type EquipSlot = "vu_khi" | "mu" | "ao" | "dai" | "bao_tay" | "giay" | "ngoc_boi";
export type ItemStats = { atk?: number; hp?: number; defExt?: number; defInt?: number; crit?: number };

export interface ItemInstance {
  id: string;
  /** Mã loại; món xếp chồng thì cùng mã vào một ô */
  code: string;
  name: string;
  type: ItemType;
  rarity: ItemRarity;
  slot?: EquipSlot;
  /** Đường dẫn trong icon_ve/, không đuôi */
  icon: string;
  count: number;
  /** Cấp của món: cấp quái rơi ra nó */
  lv?: number;
  /** atk, hp là số cộng thẳng; defExt, defInt, crit là phần nghìn */
  stats?: ItemStats;
  desc?: string;
}

export const BAG_MAX = 30;
/** Tên và màu cột sáng của từng phẩm. */
export const RARITY: Record<ItemRarity, [string, string]> = { luc: ["Lục", "#22c55e"], lam: ["Lam", "#38bdf8"], tim: ["Tím", "#c084fc"], vang: ["Vàng", "#facc15"], do: ["Đỏ", "#f43f5e"] };
const RARITY_IDS = Object.keys(RARITY) as ItemRarity[];
/** Hồi Linh Đan hồi chừng này phần mana tối đa. */
export const MANA_HEAL = 0.5;

const KIEU = TRANG_BI.kieu as { ma_vp: string; o: EquipSlot; so: number; ten: string; do_hiem: ItemRarity }[];
const HE_SO = Object.fromEntries((TRANG_BI.do_hiem as { id: string; he_so: number }[]).map((r) => [r.id, r.he_so]));
const ART: Record<EquipSlot, string> = { vu_khi: "kiem", mu: "mu", ao: "ao", dai: "dai", bao_tay: "bao_tay", giay: "giay", ngoc_boi: "ngoc_boi" };
/** Chỉ số của món theo ô: atk, hp là phần của công, máu chuẩn cùng cấp; còn lại là phần nghìn. Nhân hệ số độ hiếm. */
const GEAR_STAT: Record<EquipSlot, ItemStats> = {
  vu_khi: { atk: 0.1 }, bao_tay: { atk: 0.04, crit: 15 }, ngoc_boi: { hp: 0.03, crit: 15 },
  mu: { hp: 0.05, defInt: 20 }, ao: { hp: 0.08, defExt: 20 }, dai: { hp: 0.05 }, giay: { defExt: 10, defInt: 10 },
};
const ORES = [["thiet_tinh", "Thiết Tinh"], ["tinh_kim", "Tinh Kim"], ["huyen_thiet", "Huyền Thiết"], ["than_kim", "Thần Kim"]];
const HERBS = [["linh_thao", "Linh Thảo"], ["huyen_chi", "Huyền Chi"], ["ngoc_sam", "Ngọc Sâm"], ["than_lien", "Thần Liên"]];

const uid = (rnd: () => number) => Math.floor(rnd() * 2 ** 40).toString(36);
const stack = (rnd: () => number, code: string, name: string, type: ItemType, rarity: ItemRarity, icon: string, lv: number, desc: string, count = 1): ItemInstance =>
  ({ id: uid(rnd), code, name, type, rarity, icon, count, lv, desc });

/** Bình máu dưới dạng một món, để hiện trong túi và rơi ra đất; số lượng thật nằm ở save.pots. */
export const potItem = (count: number, rnd: () => number = Math.random): ItemInstance =>
  stack(rnd, "binh_mau", "Bình máu", "dan_duoc", "luc", "dan/dan_duoc_hoi_mau", 1, `Hồi ${POT_HEAL * 100}% máu (phím 1)`, count);

function gear(lv: number, rarity: ItemRarity, rnd: () => number): ItemInstance {
  const pool = KIEU.filter((k) => k.do_hiem === rarity);
  const k = pool[Math.floor(rnd() * pool.length)];
  const stats: ItemStats = {};
  for (const [key, w] of Object.entries(GEAR_STAT[k.o]) as [keyof ItemStats, number][]) {
    stats[key] = Math.round(((key === "atk" ? atkOf(lv, 0) : key === "hp" ? hpOf(lv) : 1) * w * HE_SO[rarity]) / 1000);
  }
  return { id: uid(rnd), code: k.ma_vp, name: k.ten, type: "trang_bi", rarity, slot: k.o, icon: `trang_bi/${ART[k.o]}/${String(k.so).padStart(2, "0")}`, count: 1, lv, stats };
}

/** Đồ rơi khi giết một con ở khu z. isBoss: thủ lĩnh (cửa bí cảnh hay thủ lĩnh trong bãi). */
export function rollDrop(z: Zone, isBoss: boolean, rnd: () => number = Math.random): ItemInstance[] {
  const lv = Math.max(1, z.level);
  const tier = Math.min(3, Math.floor(z.region / 4));
  const scroll = () => stack(rnd, `tan_quyen_${z.element}`, `Tàn quyển hệ ${ELEMENT_STYLE[z.element].name}`, "tan_quyen", "tim", `tan_quyen/${z.element}`, lv, "Mảnh công pháp, gom đủ để ghép ở Tàng Kinh Các");
  // Linh thạch giữ mức cũ (2 + cấp, thủ lĩnh cửa bí cảnh ×20), dao động ±25%.
  const out = [stack(rnd, "linh_thach", "Linh thạch", "linh_thach", "luc", "linh_thach/ha", lv, "", Math.max(1, Math.round((2 + z.level) * (z.boss ? 20 : 1) * (0.75 + 0.5 * rnd()))))];
  if (isBoss) {
    out.push(gear(lv, rnd() < 0.5 ? "lam" : "tim", rnd), potItem(1, rnd));
    if (rnd() < 0.4) out.push(scroll());
    if (rnd() < 0.15) out.push(gear(lv, "vang", rnd));
    // Phẩm Đỏ: chỉ thủ lĩnh vùng cuối (Cấm Khu), thay cho "Tứ Tượng Thần Vực" của chỉ thị vì thế giới chưa có vùng đó.
    if (z.region === REGIONS.length - 1 && rnd() < 0.05) out.push(gear(lv, "do", rnd));
    return out;
  }
  if (rnd() < 0.3) out.push(rnd() < 0.5 ? potItem(1, rnd) : stack(rnd, "hoi_linh_dan", "Hồi Linh Đan", "dan_duoc", "luc", "dan/dan_duoc_hoi_mana", 1, `Hồi ${MANA_HEAL * 100}% mana`));
  if (rnd() < 0.25) {
    const [list, dir] = rnd() < 0.5 ? [ORES, "quang"] : [HERBS, "duoc"];
    out.push(stack(rnd, list[tier][0], list[tier][1], "khoang_thach", RARITY_IDS[tier], `${dir}/${list[tier][0]}`, lv, "Nguyên liệu rèn và luyện đan"));
  }
  if (rnd() < 0.1) out.push(gear(lv, rnd() < 0.7 ? "luc" : "lam", rnd));
  if (rnd() < 0.02) out.push(scroll());
  return out;
}

/** Nhặt một món: linh thạch và bình máu vào bộ đếm, món xếp chồng vào ô cùng mã, còn lại chiếm một ô. false khi túi đầy. */
export function pickUp(s: Save, it: ItemInstance): boolean {
  if (it.type === "linh_thach") s.gold += it.count;
  else if (it.code === "binh_mau") s.pots += it.count;
  else {
    const same = it.type === "trang_bi" ? undefined : s.bag.find((x) => x.code === it.code);
    if (same) same.count += it.count;
    else if (s.bag.length >= BAG_MAX) return false;
    else s.bag.push(it);
  }
  return true;
}

/** Mặc món trang bị trong túi; món đang ở ô đó về túi (đổi chỗ nên không cần ô trống). */
export function equip(s: Save, id: string): boolean {
  const i = s.bag.findIndex((x) => x.id === id);
  const it = s.bag[i];
  if (!it?.slot) return false;
  const old = s.equips[it.slot];
  if (old) s.bag[i] = old;
  else s.bag.splice(i, 1);
  s.equips[it.slot] = it;
  return true;
}

export function unequip(s: Save, slot: string): boolean {
  const it = s.equips[slot];
  if (!it || s.bag.length >= BAG_MAX) return false;
  s.bag.push(it);
  s.equips[slot] = null;
  return true;
}

/** Tổng chỉ số của đồ đang mặc. */
export function gearBonus(s: Save): Required<ItemStats> {
  const g = { atk: 0, hp: 0, defExt: 0, defInt: 0, crit: 0 };
  for (const it of Object.values(s.equips)) for (const [k, v] of Object.entries(it?.stats ?? {})) g[k as keyof ItemStats] += v;
  return g;
}

/** Giá bán cả ô. */
export const sellPrice = (it: ItemInstance) =>
  Math.max(1, Math.round((it.lv ?? 1) * (it.type === "trang_bi" ? 3 * (RARITY_IDS.indexOf(it.rarity) + 1) : 0.5))) * it.count;

export function sell(s: Save, id: string): boolean {
  const i = s.bag.findIndex((x) => x.id === id);
  if (i < 0) return false;
  s.gold += sellPrice(s.bag[i]);
  s.bag.splice(i, 1);
  return true;
}

/** Dùng một cái của món đan dược trong túi; trả về món (để màn chơi áp công dụng) hoặc null khi không có. */
export function consume(s: Save, id: string): ItemInstance | null {
  const i = s.bag.findIndex((x) => x.id === id);
  const it = s.bag[i];
  if (!it || it.type !== "dan_duoc") return null;
  if (--it.count <= 0) s.bag.splice(i, 1);
  return it;
}

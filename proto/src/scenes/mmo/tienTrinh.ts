// Tiến trình của bản MMORPG chơi được (index.html): 13 vùng × 9 khu nối thành một dải thế giới, cấp, tu vi, linh thạch,
// bình máu, cường hóa vũ khí, nhiệm vụ diệt quái nối tiếp. Không chạm DOM để test bằng node. Mọi số là đề xuất.
import type { ElementId } from "../../replay/types.ts";
import { ATTRIBUTES, attributeBonuses, layerCost, TAY_DIEM, TECHNIQUE_LAYERS, trainingPoints, unspentPoints, type Member } from "@htk/rules";
import type { SkillType } from "@htk/sim";
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
  /** Chiêu xếp vào sáu ô ra chiêu (Q W E R T U), null là ô trống; chưa ghi thì năm chiêu khởi đầu */
  slots?: (SkillType | null)[];
  /** Tông môn đang ở: cống hiến, ngày điểm danh gần nhất, nhiệm vụ diệt dị thú của ngày taskDay */
  sect?: { id: string; cong: number; checkIn: string; taskDay: string; kills: number; taskDone: boolean };
  /** Mã các thư đã nhận quà */
  mail?: string[];
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
  const up = (base: number, k = 0) => Math.round((base * (1000 + k)) / 1000);
  return {
    hp: up(hpOf(s.lv), b.hp), atk: up(up(atkOf(s.lv, s.wpn), b.atk), rankOf(s)?.[2]), manaMul: 1000 + (b.manaMax ?? 0),
    def: b.def ?? 0, crit: b.critBonus ?? 0, critDmg: b.critDamage ?? 0, manaCut: b.manaCostCut ?? 0, speed: b.attackSpeed ?? 0, cd: b.cooldownCut ?? 0,
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

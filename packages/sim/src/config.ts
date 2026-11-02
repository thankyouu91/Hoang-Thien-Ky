// Tham số trận đấu. Số lấy thẳng từ GDD ghi kèm mục; số GDD ghi "đề xuất" hoặc chưa có thì ghi "đề xuất".
// Đơn vị: tỷ lệ theo phần nghìn (1000 = 100%), thời gian theo tick (20 tick = 1 giây), khoảng cách theo milli-ô (1000 = 1 ô).
import { mul, ONE } from "./fixed.ts";
import type { Element } from "./elements.ts";

const SEC = 20; // tick mỗi giây, khớp TICKS_PER_SECOND ở battle.ts

/**
 * Khắc một chiều cho hai thiên địa dị hệ (đề xuất 2026-11-02, GDD mục 8 chỉ có đối cực hai chiều Quang ↔ Âm lãnh, nên đội
 * Quang hay Âm lãnh không có hệ nào khắc một chiều). [A, B]: A đánh B ×1,5, B đánh A ×0,7 như Ngũ Hành; hệ biến dị thừa hưởng
 * theo hệ gốc (Lôi như Kim, Cực dương như Hỏa). Chỉ áp trong trận; ghép công pháp vẫn theo quan hệ tổ hợp của GDD mục 9
 * (ví dụ Lôi + Âm lãnh vẫn là trung tính). Vòng bốn cạnh để mỗi dị hệ có một hệ khắc và một mục tiêu.
 */
export const DI_HE_COUNTERS: [Element, Element][] = [
  ["hoa", "am_lanh"], // lửa xua âm khí
  ["am_lanh", "kim"], // hàn âm làm kim khí giòn gãy
  ["kim", "quang"], // gương kim khí phản quang
  ["quang", "hoa"], // thánh quang tịnh hóa lửa
];

/** 10 loại chiêu (GDD mục 8) */
export const SKILL_TYPES = [
  "can_don", "can_quet", "tam_xa", "dien_rong", "ho_the",
  "bua_chu", "tran_phap", "hoi_phuc", "khong_che", "than_phap",
] as const;
export type SkillType = (typeof SKILL_TYPES)[number];

export interface SkillSpec {
  k: number; // hệ số sát thương (hồi phục: hệ số hồi máu)
  targets: number;
  cooldownTicks: number;
  critPerMille: number; // chí mạng cộng thêm của loại chiêu
  mana: number; // đề xuất
  range: number; // tầm, milli-ô; đề xuất
  radius: number; // bán kính vùng ảnh hưởng, milli-ô; đề xuất (0 = không có vùng)
}

/**
 * k, số mục tiêu, hồi chiêu, chí mạng: GDD mục 8. Mana, tầm, bán kính: đề xuất.
 * Mana duyệt 2026-11-02: dò bằng tools/balance để không loại chiêu nào ở vị trí ưu tiên đầu thắng quá 65% trước đội ngẫu nhiên.
 * Chiêu ra nhanh và gây nhiều sát thương tốn mana nhiều hơn mức hồi. Hồi phục "tốn mana gấp 3" (GDD): 3 × mức gốc 60.
 */
export const SKILL_SPECS: Record<SkillType, SkillSpec> = {
  can_don: { k: 1300, targets: 1, cooldownTicks: 1 * SEC, critPerMille: 0, mana: 120, range: 1000, radius: 0 },
  can_quet: { k: 1000, targets: 5, cooldownTicks: 2 * SEC, critPerMille: 0, mana: 140, range: 1000, radius: 0 },
  tam_xa: { k: 950, targets: 2, cooldownTicks: 1 * SEC, critPerMille: 40, mana: 140, range: 4000, radius: 0 },
  dien_rong: { k: 600, targets: 10, cooldownTicks: 4 * SEC, critPerMille: 0, mana: 35, range: 4000, radius: 2000 },
  ho_the: { k: 200, targets: 3, cooldownTicks: 8 * SEC, critPerMille: 0, mana: 25, range: 4000, radius: 0 },
  bua_chu: { k: 3000, targets: 1, cooldownTicks: 6 * SEC, critPerMille: 0, mana: 160, range: 4000, radius: 0 },
  tran_phap: { k: 5000, targets: 6, cooldownTicks: 20 * SEC, critPerMille: 0, mana: 240, range: 4000, radius: 2000 },
  hoi_phuc: { k: 900, targets: 3, cooldownTicks: 6 * SEC, critPerMille: 0, mana: 180, range: 4000, radius: 0 },
  khong_che: { k: 500, targets: 1, cooldownTicks: 6 * SEC, critPerMille: 0, mana: 10, range: 3000, radius: 0 },
  than_phap: { k: 1600, targets: 1, cooldownTicks: 8 * SEC, critPerMille: 0, mana: 25, range: 6000, radius: 0 },
};

/** Chiêu nhắm đồng minh thay vì địch. */
export const ALLY_SKILLS: SkillType[] = ["hoi_phuc", "ho_the"];

/** Luật đánh đổi riêng của từng loại chiêu (GDD mục 8). */
export const SKILL_RULES = {
  aoeCastTicks: 1 * SEC, // diện rộng vận công 1 s; bị khống chế là mất chiêu
  shieldOfBase: 1200, // hộ thể: khiên bằng 120% sát thương gốc (tính với k = 1)
  shieldTicks: 6 * SEC, // khiên hết hạn sau 6 s; đề xuất
  shieldHitRange: 1000, // hộ thể đánh ×0,2 vào địch gần nhất nếu trong 1 ô; đề xuất
  talismanUses: 3, // bùa chú 3 lần mỗi trận
  formationCastTicks: 5 * SEC, // trận pháp bày 5 s
  formationInterruptible: false, // trận pháp có bị khống chế cắt ngang không; đề xuất
  executeChance: 150, // trận pháp: 15% tuyệt sát, trừ boss và đối thủ cảnh giới cao hơn
  realmLevels: 50, // mỗi đại cảnh giới Hạ vị 50 cấp (GDD mục 7)
  healerRegenPenalty: 200, // mang công pháp hồi phục thì hồi mana −20% (hiểu "đang vận" là đang mang)
  stunTicks: 3 * SEC / 2, // khống chế: choáng 1,5 s
  controlDrWindow: 5 * SEC, // bị khống chế lại trong 5 s kể từ lúc hết choáng thì thời gian còn một nửa; đề xuất
  dashCritBonus: 100, // thân pháp: đòn đầu +10% chí mạng
  dashStandOff: 500, // sau khi lướt đứng cách mục tiêu nửa ô; đề xuất
  exposedTicks: 3 * SEC, // thân pháp: lộ vị trí 3 s, địch ưu tiên đánh
  selfShieldCooldownTicks: 6 * SEC, // Thổ: khiên bản thân tối đa một lần mỗi 6 s, không phải mỗi lần ra chiêu; đề xuất
  meleeKnockback: false, // Phong: chiêu cận chiến không đẩy lùi, để không đẩy địch ra khỏi tầm của chính mình; đề xuất
};

/** Sân đấu và nhịp trận (Q4 trong docs/KE_HOACH.md): tất cả là đề xuất. */
export const BATTLE = {
  fieldLength: 12000, // trục 12 ô; đội A ở nửa 0–6000, đội B ở nửa 6000–12000
  frontPos: 4500, // hàng trước của đội A; đội B đối xứng qua giữa sân
  backPos: 2500, // hàng sau của đội A
  moveSpeed: 100, // milli-ô mỗi tick: đi 1 ô mỗi 10 tick
  supportStandoff: 4000, // khoảng cách tới địch gần nhất mà người chỉ có chiêu hỗ trợ đứng lại
  manaMax: 300, // nhỏ để mức hồi mana là giới hạn thật trong trận 30 giây (duyệt 2026-11-02)
  manaRegenPerSec: 50,
  initialCooldown: 500, // đầu trận mọi công pháp đã hồi 50%
  ultMultiplier: 2500, // chiêu cuối tông chủ ×2,5
  betrayalDamage: 500, // công pháp của tông đã phản bội đánh người tông đó còn 50% (GDD mục 6, đã chốt)
  // Chống hòa (đề xuất, chọn 2026-11-02): trận quá 45 s thì mọi sát thương +20% mỗi 5 s, cộng dồn; hồi máu không tăng.
  rampStartTicks: 45 * SEC,
  rampStepTicks: 5 * SEC,
  rampPerStep: 200,
  critDamage: 1500, // sát thương chí mạng ×1,5
  defScale: 1000, // phòng thủ giảm def / (def + 1000)
  defCap: 800, // giảm tối đa 80%
};

/**
 * Chỉ số chuẩn của nhân vật theo cấp (Hạ vị 1–250), chưa tính đồ, tài năng và buff; đề xuất.
 * Đã chốt 2026-11-02: trận 10 đấu 10 trung bình khoảng 30 giây. `hpBase` và `hpPerLevel` được dò bằng đội mẫu
 * (mỗi người 4 công pháp, chỉ số ±20%); dò lại sau khi đổi bảng mana.
 */
export const UNIT_CURVE = {
  hpBase: 2550, // máu ở cấp 0
  hpPerLevel: 18, // máu tăng 1,8% của hpBase mỗi cấp
  atkBase: 100, // công lực ở cấp 0
  atkPerLevel: 4,
  defPerLevel: 5, // cấp 100: phòng thủ 500, giảm 33% sát thương
};
export function baseStats(level: number): { hp: number; atk: number; def: number } {
  return {
    hp: mul(UNIT_CURVE.hpBase, ONE + UNIT_CURVE.hpPerLevel * level),
    atk: UNIT_CURVE.atkBase + UNIT_CURVE.atkPerLevel * level,
    def: UNIT_CURVE.defPerLevel * level,
  };
}
/** Phẩm công pháp cao nhất học được theo cấp ở Hạ vị (GDD mục 6, đề xuất): Phàm từ 1, Hoàng từ 50, Huyền từ 100, Địa từ 150. */
export function maxGradeAtLevel(level: number): number {
  return level >= 150 ? 4 : level >= 100 ? 3 : level >= 50 ? 2 : 1;
}

/** Kháng hệ (từ ngọc) giảm tối đa 80% sát thương của hệ đó; đề xuất. */
export const RESIST_CAP = 800;

/** Chỉ số nhân vật mà buff linh căn và tài năng cộng vào, theo phần nghìn. */
export type BuffStat =
  | "hp" | "def" | "manaMax" | "damage" | "critBonus" | "critDamage" | "attackSpeed" | "cooldownCut"
  | "healPower" | "healTaken" | "lifesteal" | "resistPen" | "dot" | "controlTime";

/**
 * Buff khi luyện đúng hệ (GDD mục 9), áp cho cả nhân vật, mỗi hệ một lần. Trùng hệ chủ quyển nhận đủ, trùng hệ phụ quyển nhận một nửa.
 * Xuyên kháng cộng thẳng vào mọi đòn của nhân vật (giả định). Hút máu +8% là tăng 8% hiệu quả hút máu của công pháp
 * (3% thành 3,24%), như buff của Cực âm, Cực hàn tăng hiệu ứng của chính chúng (đề xuất, đổi 2026-11-02 theo tools/balance).
 */
export const ROOT_BUFFS: Record<Element, { stat: BuffStat; value: number }> = {
  kim: { stat: "critDamage", value: 120 }, // sát thương chí mạng +12%
  moc: { stat: "healTaken", value: 100 }, // hồi máu nhận được +10%
  thuy: { stat: "manaMax", value: 150 }, // mana tối đa +15%
  hoa: { stat: "damage", value: 100 }, // sát thương +10%
  tho: { stat: "hp", value: 120 }, // máu tối đa +12%
  loi: { stat: "attackSpeed", value: 120 }, // tốc độ đánh +12%
  phong: { stat: "cooldownCut", value: 100 }, // giảm hồi chiêu 10%
  quang: { stat: "healPower", value: 150 }, // hiệu quả hồi máu và khiên +15%
  am_lanh: { stat: "lifesteal", value: 80 }, // hút máu +8%
  cuc_duong: { stat: "resistPen", value: 100 }, // xuyên kháng +10%
  cuc_am: { stat: "dot", value: 120 }, // sát thương theo thời gian +12%
  cuc_han: { stat: "controlTime", value: 150 }, // thời gian khống chế +15%
};

/** 8 tài năng (GDD mục 6). Tu đan, Tu rèn, Tu kim tiền không có tác dụng trong trận. */
export const TALENTS = ["tu_the", "tu_phap", "tu_tran", "tu_dan", "sat_thu", "tu_ren", "tu_duoc", "tu_kim_tien"] as const;
export type Talent = (typeof TALENTS)[number];

/** Phần chiến đấu của tài năng (GDD mục 6). */
export const TALENT_RULES = {
  tuTheHp: 150, // Tu thể: +15% máu
  tuTheDef: 100, // +10% phòng thủ
  tuTheMelee: 100, // cận chiến và hộ thể +10% (sát thương và khiên)
  tuPhapRanged: 150, // Tu pháp: +15% sát thương tầm xa và diện rộng
  tuPhapMana: 100, // +10% mana
  tuPhapTalismans: 1, // bùa chú thêm 1 lần mỗi trận
  tuTranCastCut: 300, // Tu trận: bày trận nhanh hơn 30%
  tuTranExecute: 50, // tuyệt sát +5%
  satThuCrit: 100, // Sát thủ: +10% chí mạng
  satThuCritDamage: 200, // +20% sát thương chí mạng
  satThuStealthTicks: 3 * SEC, // ẩn thân 3 s đầu trận
  satThuDashCooldownCut: 200, // thân pháp hồi chiêu −20%
  tuDuocHealTaken: 100, // Tu dược: hồi máu nhận +10%
};

/** Chỉ số một tàn quyển góp vào công pháp. */
export interface ScrollStats {
  dmg: number; // % sát thương, phần nghìn
  crit: number; // chí mạng, phần nghìn
  cd: number; // % hồi chiêu, phần nghìn (âm = nhanh hơn)
  mana: number; // % mana, phần nghìn (âm = rẻ hơn)
  range: number; // tầm cộng thêm, milli-ô
}
const NONE: ScrollStats = { dmg: 0, crit: 0, cd: 0, mana: 0, range: 0 };

/** 4 biến thể tàn quyển (GDD mục 9). Linh không đổi chỉ số mà nhân hiệu ứng, xem LINH_EFFECT_POWER. */
export const VARIANTS = ["bao", "toc", "linh", "ben"] as const;
export type Variant = (typeof VARIANTS)[number];
export const VARIANT_STATS: Record<Variant, ScrollStats> = {
  bao: { ...NONE, dmg: 100 },
  toc: { ...NONE, cd: -100, crit: 20 },
  linh: NONE,
  ben: { ...NONE, mana: -250 },
};
/** Linh: hiệu ứng đặc trưng +50% */
export const LINH_EFFECT_POWER = 1500;

/** Tầm cộng thêm của một công pháp tối đa 1 ô, kể cả khi chủ và phụ quyển đều là Âm lãnh (đề xuất, 2026-11-02 theo tools/balance). */
export const MAX_RANGE_BONUS = 1000;

/** Chỉ số kèm theo hệ (GDD mục 9). Âm lãnh "tầm +1 ô": phụ quyển góp 50% như các chỉ số khác (đề xuất, đổi 2026-11-02 theo tools/balance). */
export const ELEMENT_STATS: Record<Element, ScrollStats> = {
  kim: { ...NONE, crit: 20 },
  moc: NONE,
  thuy: { ...NONE, mana: -100 },
  hoa: { ...NONE, dmg: 50, mana: 50 },
  tho: { ...NONE, dmg: -50 },
  loi: { ...NONE, crit: 30 },
  phong: { ...NONE, cd: -50 },
  quang: NONE,
  am_lanh: { ...NONE, range: 1000 },
  cuc_duong: { ...NONE, dmg: 50, mana: 50 },
  cuc_am: NONE,
  cuc_han: NONE,
};

/** Chí mạng gốc 5% (GDD mục 9) */
export const BASE_CRIT_PER_MILLE = 50;

/** 1,25^(phẩm − 1), phần nghìn, làm tròn; phẩm 10 (Thánh pháp) ≈ 7,45 lần Phàm pháp (GDD mục 9) */
export const GRADE_POW = [1000, 1250, 1563, 1953, 2441, 3052, 3815, 4768, 5960, 7451];

/**
 * Hệ số tổ hợp chủ quyển với phụ quyển (GDD mục 9). Đã chốt 2026-11-02, thu hẹp từ ×1,15 / 1,10 / 0,85 / 1,25 vì đội dồn một
 * tổ hợp thuần hoặc tương sinh thắng tới 74% (tools/balance). Cặp nào thuộc quan hệ nào: quy tắc tạm cho tới khi có ma trận
 * trong file Excel, xem comboRelation ở technique.ts.
 */
export const COMBO = {
  pure: 1080, // cùng hệ
  harmony: 1050, // tương sinh hoặc tương hợp
  neutral: 1000,
  clash: 920, // tương khắc
  polar: 1120, // đối cực hợp nhất
  polarManaMul: 1500, // GDD mục 9, giữ nguyên
};
/** Cặp tương hợp lấy từ ví dụ trong GDD (Lôi + Quang), ngoài các quy tắc chung. */
export const HARMONY_PAIRS: [Element, Element][] = [["loi", "quang"]];

/**
 * Hiệu ứng đặc trưng của mỗi hệ (GDD mục 9). `value` được nhân theo sức hiệu ứng (Linh ×1,5); `ticks` là thời gian kèm theo.
 * Thời gian của Thủy và Cực âm chưa có trong GDD: đề xuất.
 */
export const ELEMENT_EFFECTS: Record<Element, { value: number; ticks?: number }> = {
  kim: { value: 100 }, // xuyên giáp 10%
  moc: { value: 1 * SEC }, // trói chân 1 s
  thuy: { value: 200, ticks: 2 * SEC }, // làm chậm di chuyển 20% (không chậm hồi chiêu), đề xuất 2 s
  hoa: { value: 100, ticks: 3 * SEC }, // thiêu đốt 10% sát thương mỗi giây trong 3 s
  tho: { value: 50 }, // khiên bản thân 5% máu tối đa
  loi: { value: SEC / 2 }, // tê liệt 0,5 s khi chí mạng
  phong: { value: 1000 }, // đẩy lùi 1 ô
  quang: { value: 20 }, // hồi máu 2% sát thương gây ra
  am_lanh: { value: 30 }, // hút máu 3%
  cuc_duong: { value: 100 }, // xuyên kháng 10%
  cuc_am: { value: 300, ticks: 3 * SEC }, // giảm 30% hồi máu của mục tiêu, đề xuất 3 s
  cuc_han: { value: 80, ticks: 1 * SEC }, // 8% đóng băng 1 s
};

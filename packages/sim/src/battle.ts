// Vòng trận 20 tick/giây trên trục 12 ô (GDD mục 8). Đơn vị: phần nghìn, tick, milli-ô (xem config.ts).
import { mul, clamp, ONE } from "./fixed.ts";
import { Rng } from "./rng.ts";
import { Hasher } from "./hash.ts";
import { ELEMENTS, elementMultiplier, type Element } from "./elements.ts";
import {
  BATTLE, SKILL_SPECS, ALLY_SKILLS, SKILL_RULES as R, CAST_FLOOR, ARTIFACT_RULES as A, RESIST_CAP, COUNTER_FLOOR, MAX_RANGE_BONUS,
  DAMAGE_KIND, DAMAGE_CUT_CAP, HIDDEN_RULES, type SkillType, type Talent, type BuffStat,
} from "./config.ts";
import { techniqueFx, type Technique, type TechniqueFx } from "./technique.ts";
import { unitBonuses, type UnitBonuses } from "./stats.ts";

export const TICKS_PER_SECOND = 20;
export const MAX_TICKS = 90 * TICKS_PER_SECOND; // trận tối đa 90 giây
const MANA_REGEN_PER_TICK = (BATTLE.manaRegenPerSec * ONE) / TICKS_PER_SECOND; // mana tính theo phần nghìn
const NEVER = -1_000_000; // mốc tick "chưa từng xảy ra"
const MELEE: SkillType[] = ["can_don", "can_quet", "ho_the"]; // Tu thể +10%
const CLOSE_RANGE: SkillType[] = ["can_don", "can_quet", "ho_the", "than_phap"]; // đánh sát người: không đẩy lùi
const RANGED: SkillType[] = ["tam_xa", "dien_rong"]; // Tu pháp +15%

/** Cách chọn mục tiêu thay cho mặc định của loại chiêu. "Máu thấp nhất" là % máu, hòa thì máu còn ít hơn, rồi id. */
export type TargetPick = "most_targeted" | "lowest_hp" | "channeling" | "back_row_lowest_hp";

/** Ý châu: đổi hành vi một loại chiêu, áp cho mọi công pháp loại đó người cầm mang (tab Trang bị, phần 5). */
export interface SkillMod {
  shieldPierce?: number; // phần nghìn sát thương đi thẳng vào máu, bỏ qua khiên
  extraTargets?: number; // thêm mục tiêu; các mục tiêu thêm nhận `extraTargetDamage`
  extraTargetDamage?: number; // phần nghìn
  rangeBonus?: number; // milli-ô, chung trần MAX_RANGE_BONUS với tầm của hệ
  castTicks?: number; // cộng tick vận công hoặc bày trận (âm là nhanh hơn), sau phần cắt % của tài năng, không dưới CAST_FLOOR
  manaCost?: number; // phần nghìn mana của chiêu
  pick?: TargetPick;
  pickUses?: number; // số lần ra chiêu đầu mỗi trận dùng `pick`; không ghi là mọi lần
  overhealShield?: number; // hồi phục: phần nghìn phần hồi tràn quá máu tối đa thành khiên
  overhealShieldTicks?: number; // khiên đó giữ bao lâu; mặc định như khiên hộ thể
  // Hiệu ứng set gắn với một loại chiêu (tab Trang bị, phần 7):
  firstTargetBonus?: number; // phần nghìn sát thương thêm cho mục tiêu đầu (Thiết Kỵ, cận chiến quét)
  lowHpBelow?: number; // mục tiêu dưới ngưỡng máu này (phần nghìn) nhận thêm `lowHpBonus` (Vạn Kiếm, cận chiến đơn)
  lowHpBonus?: number;
  qiCycleTicks?: number; // mỗi chừng này tick, đòn kế tiếp trúng thêm kẻ đứng sau mục tiêu với `qiDamage` (Vạn Kiếm)
  qiDamage?: number;
  lastUseFree?: boolean; // lần dùng cuối mỗi trận không tốn mana (Độ Kiếp, bùa chú)
  exposedTicks?: number; // thân pháp lộ vị trí bao lâu thay mặc định (Huyết Ảnh)
  densest?: boolean; // trận pháp đặt vào chỗ đông địch nhất (Chu Thiên)
  // Danh văn của danh khí (tab Trang bị, phần 13):
  critCooldownCut?: number; // cận chiến đơn chí mạng thì chiêu đó hồi chiêu nhanh chừng này tick (Thiên Vấn Kiếm)
  sweepShield?: number; // mỗi mục tiêu quét trúng từ thứ sweepShieldFrom cho người cầm khiên chừng này phần nghìn máu tối đa (Đoạn Nhạc Đao)
  sweepShieldFrom?: number; // mục tiêu thứ mấy bắt đầu cho khiên (mặc định 3)
  channelTargetBonus?: number; // đòn vào kẻ đang vận công thêm chừng này sát thương (Lạc Tinh Cung)
  bigAoeHaste?: number; // diện rộng trúng từ chừng này mục tiêu thì lần vận công kế tiếp nhanh gấp đôi (Phong Lôi Phiến)
  shieldBlocksControl?: boolean; // khiên hộ thể đỡ thêm 1 lần khống chế cho người được che (Bất Động Côn)
  extraUses?: number; // thêm lần dùng mỗi trận (Tạo Hóa Bút)
  useDamage?: number; // phần nghìn sát thương mỗi lần (Tạo Hóa Bút: 850)
  allyDefBuff?: number; // trận pháp phát thì đồng đội trong trận thêm phòng thủ chừng này (Tinh La Kỳ)
  allyDefTicks?: number;
  cleanseBurn?: boolean; // hồi phục giải luôn thiêu đốt (Vọng Nguyệt Cầm)
  breakChannel?: boolean; // khống chế trúng kẻ đang vận công thì chiêu đó mất, kể cả trận pháp, không hoàn hồi chiêu (Ngọc Lâu Tiêu)
  dashPierceNext?: number; // lướt tới xong, đòn kế tiếp xuyên chừng này phần nghìn khiên (Phá Thiên Thương)
}

/**
 * Hiệu ứng hành vi và khắc chế của set theo người mặc (tab Trang bị, phần 7; rules đổi từ set.json). Mọi số theo phần nghìn
 * trừ trường ghi tick hoặc số lần; "mỗi trận" tính lại từ đầu mỗi trận. Không ghi trường nào thì không đổi gì.
 */
export interface SetFx {
  cleanseHealCut?: number; // Bách Thảo: số lần tẩy giảm hồi máu cho mình hoặc đồng đội kề bên
  guardSelfShield?: number; // Bàn Thạch: hộ thể che thêm chính mình với khiên bằng chừng này
  petrifyBelow?: number; // Bàn Thạch: lần đầu máu dưới ngưỡng thì hóa đá `petrifyTicks` (miễn sát thương, không ra chiêu)
  petrifyTicks?: number;
  frontAoeCut?: number; // Thiết Kỵ: hàng trước, hàng sau còn từ 2 đồng đội, nhận ít hơn sát thương diện rộng
  channelRefund?: number; // Văn Uyên: diện rộng bị cắt thì hoàn chừng này hồi chiêu
  instantFirstAoe?: boolean; // Văn Uyên: diện rộng đầu tiên mỗi trận không cần vận công
  resistTopEnemy?: number; // Ngọc Tủy: đầu trận cộng kháng hệ chủ xuất hiện nhiều nhất trong công pháp của đội địch
  healerRegenPenalty?: number; // Linh Tuyền: cộng vào phạt hồi mana khi mang hồi phục (âm là nhẹ hơn)
  resetHealOnFall?: number; // Linh Tuyền: số lần đồng đội ngã thì hồi phục hồi chiêu ngay
  controlDr?: number; // Băng Phách: khống chế lặp cùng mục tiêu còn chừng này thay 500
  chilledBonus?: number; // Băng Phách: sát thương thêm lên kẻ đang bị đóng băng hoặc làm chậm
  bounceCrit?: number; // Lôi Trì: đòn chí mạng thứ mấy mỗi trận nảy sang kẻ địch khác với `bounceDamage`
  bounceDamage?: number;
  stealthOnDashKill?: number; // Huyết Ảnh: hạ gục bằng thân pháp thì ẩn thân chừng này tick (1 lần mỗi trận)
  counterCap?: number; // Hỗn Độn: hệ số khắc hệ lên người mặc không quá chừng này
  decoyTicks?: number; // Hỗn Độn: bao nhiêu tick đầu trận bị đánh tính theo `UnitSpec.decoyElement`
  artifactCooldownCut?: number; // Cổ Tông: hồi chiêu pháp bảo giảm chừng này
  artifactMana?: number; // Cổ Tông: mỗi lần pháp bảo của người mặc kích hoạt thì hồi chừng này mana tối đa
  controlChannelTicks?: number; // Băng Phách: khống chế trúng kẻ đang vận công hoặc đang bày trận thì dài thêm chừng này tick
  artifactExtraUses?: number; // Cổ Tông: pháp bảo thêm lần mỗi trận, không quá `artifactMaxUses`
  artifactMaxUses?: number;
  // Khí văn (luyện khí, tab Trang bị phần 13); rules đã nhân theo số lần tính (tối đa 2):
  shieldBreakBonus?: number; // đòn đầu lên mỗi tấm khiên của mục tiêu thêm sát thương (Phá Thuẫn)
  lowHpAllBelow?: number; // mục tiêu dưới ngưỡng máu này nhận thêm `lowHpAllBonus` (Truy Mệnh)
  lowHpAllBonus?: number;
  openerBonus?: number; // chiêu đầu tiên mỗi trận thêm sát thương (Tiên Phát)
  comboThirdBonus?: number; // đánh cùng mục tiêu 3 lần liên tiếp thì lần thứ 3 thêm sát thương (Liên Kích)
  counterBoost?: number; // đánh hệ mình khắc: cộng vào hệ số khắc (Khắc Hệ)
  killMana?: number; // hạ gục thì hồi chừng này phần nghìn mana tối đa (Tụ Linh)
  lastStandBelow?: number; // lần đầu máu dưới ngưỡng thì khiên `lastStandShield` phần nghìn máu tối đa (Hộ Mệnh)
  lastStandShield?: number;
  meleeReflect?: number; // phản chừng này sát thương cận chiến nhận được (Phản Chấn)
  frontDef?: number; // đứng hàng trước thì phòng thủ thêm (Thiết Bích)
  backMana?: number; // đứng hàng sau thì mana tối đa thêm (Tĩnh Tâm)
  regenPulse?: number; // mỗi `regenPulseTicks` hồi chừng này phần nghìn máu tối đa (Hồi Xuân)
  regenPulseTicks?: number;
  knockbackResist?: number; // bị đẩy lùi ngắn hơn chừng này phần nghìn (Định Thân)
}

export interface UnitSpec {
  id: number; // duy nhất trong trận, quyết định thứ tự cập nhật
  level: number;
  element: Element; // linh căn chính, là hệ bị đánh trúng
  element2?: Element; // linh căn thứ hai
  talents?: Talent[]; // 1–2 tài năng
  hp: number;
  atk: number; // công lực: sát thương = D × atk / 100
  def: number;
  resist?: Partial<Record<Element, number>>; // kháng theo hệ, phần nghìn (ngọc, set); trận chặn ở RESIST_CAP
  row: 0 | 1; // 0 hàng trước, 1 hàng sau
  techniques: Technique[]; // 1–4 công pháp, theo thứ tự ưu tiên
  manaMax?: number; // mặc định BATTLE.manaMax
  boss?: boolean; // miễn tuyệt sát
  monster?: boolean; // dị thú hoặc boss PvE, nhận sát thương cộng thêm của set Liệp Thú; NPC, trận nhãn, hộ trận trong chiến tranh không đặt cờ này dù là boss
  sectId?: string; // tông môn, để xét công pháp của kẻ phản bội
  /** Cộng thêm vào chỉ số trận từ trang bị và set (phần nghìn; hp, atk, def, manaMax là % của chỉ số gốc). */
  bonuses?: Partial<Record<BuffStat, number>>;
  /** Sát thương cộng thêm cho công pháp có hệ chủ là hệ đó (ngọc ở ô công), phần nghìn. */
  elementDamage?: Partial<Record<Element, number>>;
  /** Đổi hành vi theo loại chiêu (Ý châu trên vũ khí). */
  skillMods?: Partial<Record<SkillType, SkillMod>>;
  /** Pháp bảo đang mang, theo thứ tự ô. */
  artifacts?: ArtifactSpec[];
  /** Hiệu ứng hành vi và khắc chế của set đang mặc. */
  setFx?: SetFx;
  /** Hệ ngụy linh căn người chơi chọn trước trận (set Hỗn Độn); không chọn thì không có tác dụng. */
  decoyElement?: Element;
  /**
   * Dòng ẩn của trang sức (ngọc bội, đai): điều kiện tĩnh rules đã xét thành "always", hệ số nhóm và song ẩn đã nhân sẵn.
   * Thứ tự là thứ tự ưu tiên: lúc nào cũng chỉ HIDDEN_RULES.maxActive dòng đầu tiên đang đúng điều kiện có hiệu lực.
   */
  hidden?: HiddenLine[];
}

/**
 * Điều kiện dòng ẩn sim xét trong trận (tab Trang bị, phần 14.3.5): always (rules đã xét đúng trước trận), pve (đội địch có dị thú
 * hoặc boss PvE), war (trận chiến tranh địa bàn), lowHp (máu dưới HIDDEN_RULES.lowHpBelow), opening (HIDDEN_RULES.openingTicks
 * đầu trận), late (từ HIDDEN_RULES.lateTicks), front, back (hàng đứng), countered (đội địch có linh căn khắc linh căn mình).
 */
export type HiddenCond = "always" | "pve" | "war" | "lowHp" | "opening" | "late" | "front" | "back" | "countered";
/** Hiệu ứng dòng ẩn: một chỉ số trận (phần nghìn); counterResist là kháng các hệ khắc linh căn mình. */
export type HiddenStat =
  | "atk" | "defOuter" | "defInner" | "critBonus" | "lifestealFlat" | "manaCostCut" | "hpRegen" | "reflect" | "damageTakenCut"
  | "attackSpeed" | "cooldownCut" | "counterResist";
export interface HiddenLine { cond: HiddenCond; stat: HiddenStat; value: number }
interface HiddenState { line: HiddenLine; ok: boolean; on: boolean; first: number }

/** 10 loại pháp bảo, mỗi loại khắc một loại chiêu của địch (tab Trang bị, phần 9). */
export type ArtifactKind = "thuan" | "luan" | "chau" | "thap" | "ho_lo" | "kinh" | "phien_co" | "dinh" | "chuong" | "an";
/** Một pháp bảo trong trận: tự kích hoạt khi gặp điều kiện, kể cả khi chủ nhân đang bị khống chế. */
export interface ArtifactSpec {
  kind: ArtifactKind;
  power: number; // chỉ số chính: phần nghìn; Luân là milli-ô đẩy lùi; Chuông, Ấn là tick
  uses: number; // số lần kích hoạt tối đa trận này, đã tính linh lực còn lại
  cooldownTicks: number;
  energy?: number; // linh lực còn lại; lần thêm của set Cổ Tông không vượt số này
  minCooldownTicks?: number; // hồi chiêu sau mọi nguồn (Cổ Tông, tế luyện tầng) không dưới số này
}
interface ArtifactState extends ArtifactSpec {
  readyTick: number;
  used: number;
  charges: number; // Châu: số đòn tầm xa còn được giảm
}
export interface BattleInput {
  seed: number;
  teamA: UnitSpec[];
  teamB: UnitSpec[];
  /** Nhật ký lệnh: tại tick nào, đơn vị nào tung chiêu cuối tông chủ */
  commands?: { tick: number; unitId: number }[];
  /** Trận chiến tranh địa bàn (điều kiện dòng ẩn "war"). */
  war?: boolean;
}
export interface BattleResult {
  winner: "A" | "B" | "draw";
  ticks: number;
  hash: number;
  survivorsA: number;
  survivorsB: number;
  /** Số lần mỗi pháp bảo đã kích hoạt, theo đơn vị và thứ tự ô; chỉ có khi trận có pháp bảo. Rules trừ linh lực theo số này. */
  artifactUses?: { unitId: number; uses: number[] }[];
  /** Dòng ẩn lần đầu kích phát: đơn vị, vị trí dòng trong UnitSpec.hidden, tick; chỉ có khi trận có dòng ẩn. Rules lộ "???" theo số này. */
  hiddenFirst?: { unitId: number; line: number; tick: number }[];
}
/** Một lần ra chiêu; dùng cho test và trình xem trận. Chiêu vận công ghi lúc phát, `startTick` là lúc bắt đầu. */
export interface CastEvent {
  tick: number;
  startTick: number;
  unitId: number;
  slot: number; // vị trí công pháp trong danh sách ưu tiên
  targets: number[];
  /** Hợp trận (từ 2 người): id người bày đầu nhóm và số người; mỗi người một sự kiện, cùng tick, cùng mục tiêu. */
  groupLead?: number;
  groupSize?: number;
}

interface Slot {
  tech: Technique;
  fx: TechniqueFx;
  range: number;
  radius: number;
  cost: number; // mana phần nghìn
  baseCost: number; // mana trước giảm mana thi triển (manaCostCut)
  cooldown: number; // hồi chiêu sau buff, tick
  cd: number; // hồi chiêu còn lại, phần nghìn tick; <= 0 là sẵn sàng
  bonus: number; // sát thương cộng thêm của công pháp này (Hỏa, Tu thể, Tu pháp)
  ally: boolean;
  uses: number; // số lần còn dùng trong trận, -1 = không giới hạn
  maxTargets: number; // số mục tiêu của loại chiêu cộng mục tiêu thêm của Ý châu
  mod: SkillMod;
  pickLeft: number; // số lần còn dùng `mod.pick`, -1 = mọi lần
}
/** Chiêu đang vận công (diện rộng) hoặc đang bày (trận pháp). */
interface Channel {
  slot: number;
  startTick: number;
  resolveTick: number;
  center: number; // tâm vùng, chốt lúc bắt đầu
  ult: boolean;
  interruptible: boolean;
  guarded: number[]; // Tháp: id đồng đội của chủ pháp bảo nhận ít sát thương hơn từ chiêu này
  guardCut: number;
  group: number; // trận pháp: id người bày đầu của trận chung (hợp trận); bày một mình là id của chính mình
}
export interface Unit {
  id: number;
  team: 0 | 1;
  level: number;
  element: Element;
  hp: number; // máu tối đa sau buff
  atk: number;
  def: number; // sau buff
  defOuter: number; // thủ ngoại: phòng thủ trước đòn ngoại (DAMAGE_KIND)
  defInner: number; // thủ nội
  baseAtk: number; // công lực, phòng thủ gốc trước buff, để dòng ẩn bật tắt
  baseDef: number;
  resist: Partial<Record<Element, number>>;
  boss: boolean;
  monster: boolean;
  row: 0 | 1;
  sectId: string | null;
  b: UnitBonuses;
  curHp: number;
  pos: number;
  mana: number;
  manaMax: number;
  regen: number; // mana hồi mỗi tick, phần nghìn
  slots: Slot[];
  preferredRange: number; // dừng tiến khi địch gần nhất trong khoảng này
  ultReady: boolean;
  shield: number;
  shieldUntil: number;
  stunUntil: number; // bị khống chế tới tick này
  rootUntil: number; // bị trói chân, không đi được
  slow: number;
  slowUntil: number;
  burn: number; // sát thương thiêu đốt mỗi giây
  burnNext: number;
  burnUntil: number;
  healCut: number;
  healCutUntil: number;
  exposedUntil: number; // lộ vị trí tới tick này, địch ưu tiên đánh
  stealthUntil: number; // ẩn thân, địch không chọn được
  selfShieldNext: number; // Thổ: tick sớm nhất được khiên bản thân lại
  channel: Channel | null;
  artifacts: ArtifactState[];
  controlImmuneUntil: number; // Chuông: miễn khống chế tới tick này
  fx: SetFx;
  stoneUntil: number; // Bàn Thạch: hóa đá tới tick này
  frozenUntil: number; // đang bị đóng băng tới tick này (cho Băng Phách)
  decoy: Element | null;
  decoyUntil: number;
  qiReadyTick: number; // Vạn Kiếm: tick sớm nhất có kiếm khí
  critCount: number; // số đòn chí mạng đã ra trong trận (Lôi Trì)
  once: { petrify: number; cleanse: number; instantAoe: number; resetHeal: number; stealthKill: number; bounce: number; lastStand: number }; // số lần còn lại mỗi trận
  shieldHit: Record<number, number>; // Phá Thuẫn: id mục tiêu → hạn tấm khiên đã ăn đòn đầu
  opened: boolean; // đã ra chiêu đánh đầu tiên (Tiên Phát)
  comboTarget: number; // Liên Kích: mục tiêu đang đánh liên tiếp và số lần
  comboCount: number;
  nextPierce: number; // Phá Thiên Thương: đòn kế tiếp xuyên khiên
  hasteAoe: boolean; // Phong Lôi Phiến: lần vận công diện rộng kế tiếp nhanh gấp đôi
  controlBlocks: number; // Bất Động Côn: số lần khống chế được đỡ, tới `controlBlockUntil`
  controlBlockUntil: number;
  defBuff: number; // Tinh La Kỳ: phòng thủ thêm tới `defBuffUntil`
  defBuffUntil: number;
  regenNext: number; // Hồi Xuân: tick hồi máu kế tiếp
  hidden: HiddenState[];
  hidDyn: boolean; // có dòng ẩn theo máu hoặc thời gian, xét mỗi tick
}

/** Hệ số chênh lệch cấp (GDD mục 8): bên thấp còn tối thiểu 55%, bên cao cộng tối đa 30%. */
export function levelGapMultiplier(atkLevel: number, defLevel: number): number {
  const gap = atkLevel - defLevel;
  if (gap < 0) return Math.max(550, ONE - 15 * -gap);
  return ONE + Math.min(300, 10 * gap);
}

/**
 * Điều chỉnh cho một đòn: sát thương cộng thêm, sát thương chí mạng cộng thêm, xuyên giáp, xuyên kháng (phần nghìn);
 * hệ bị đánh thay cho linh căn (ngụy linh căn) và trần hệ số khắc của bên bị đánh (set Hỗn Độn).
 */
export interface HitMods {
  damage?: number;
  critDamage?: number;
  armorPen?: number;
  resistPen?: number;
  defElement?: Element;
  counterCap?: number;
  counterBoost?: number; // Khắc Hệ Văn của bên đánh: cộng vào hệ số khắc
  defBonus?: number; // phòng thủ thêm của bên bị đánh (Tinh La Kỳ), phần nghìn
}

/** Hệ số khi đánh hệ bị khắc hoặc đối cực (elements.ts). */
const COUNTER = 1500;

/** Sát thương một đòn lên một mục tiêu. */
export function hitDamage(
  a: { atk: number; level: number },
  tech: Technique,
  d: { element: Element; level: number; def: number; defOuter?: number; defInner?: number; resist?: Partial<Record<Element, number>> },
  crit: boolean,
  ult: boolean,
  mods: HitMods = {},
): number {
  let dmg = Math.trunc((tech.damage * a.atk) / (100 * ONE));
  if (mods.damage) dmg = mul(dmg, ONE + mods.damage);
  const resist = d.resist?.[tech.element] ?? 0;
  const r = resist > 0 ? clamp(mul(resist, ONE - (mods.resistPen ?? 0)), 0, RESIST_CAP) : 0;
  let em = elementMultiplier(tech.element, mods.defElement ?? d.element);
  if (em >= COUNTER) {
    if (mods.counterBoost) em += mods.counterBoost;
    if (mods.counterCap && em > mods.counterCap) em = mods.counterCap;
    // Sau mọi nguồn (trần khắc của bên bị đánh, kháng), khắc hệ vẫn còn ít nhất COUNTER_FLOOR (tab Trang bị, phần 13).
    const floor = Math.ceil((COUNTER_FLOOR * ONE) / (ONE - r));
    if (em < floor) em = floor;
  }
  dmg = mul(dmg, em);
  dmg = mul(dmg, levelGapMultiplier(a.level, d.level));
  if (ult) dmg = mul(dmg, BATTLE.ultMultiplier);
  if (crit) dmg = mul(dmg, BATTLE.critDamage + (mods.critDamage ?? 0));
  // Phòng thủ giảm sát thương theo tỷ lệ def / (def + 1000), không về 0; xuyên giáp bỏ qua một phần phòng thủ.
  // Đòn ngoại dùng thủ ngoại, đòn nội dùng thủ nội (DAMAGE_KIND); xuyên giáp áp vào đúng loại đó.
  const kind = DAMAGE_KIND[tech.type];
  const d0 = kind === "noi" ? d.defInner ?? d.def : kind === "ngoai" ? d.defOuter ?? d.def : d.def;
  const def = mul(mods.defBonus ? mul(d0, ONE + mods.defBonus) : d0, ONE - (mods.armorPen ?? 0));
  const reduce = Math.trunc((def * ONE) / (def + BATTLE.defScale));
  dmg = mul(dmg, ONE - clamp(reduce, 0, BATTLE.defCap));
  if (r > 0) dmg = mul(dmg, ONE - r);
  return Math.max(1, dmg);
}

/** Khiên hộ thể: 120% sát thương gốc (bỏ hệ số k của loại chiêu) nhân công lực. */
export function shieldAmount(atk: number, tech: Technique): number {
  const base = Math.trunc((tech.damage * ONE) / SKILL_SPECS[tech.type].k);
  return mul(Math.trunc((base * atk) / (100 * ONE)), R.shieldOfBase);
}

const realm = (level: number) => Math.trunc((level - 1) / R.realmLevels);

/** Hồi chiêu sau giảm hồi chiêu (thân pháp cộng thêm phần của Sát thủ), không dưới 1 tick. */
function slotCooldown(tech: Technique, b: UnitBonuses): number {
  const cut = b.cooldownCut + (tech.type === "than_phap" ? b.dashCooldownCut : 0);
  return Math.max(1, mul(tech.cooldownTicks, ONE - cut));
}

function makeUnit(spec: UnitSpec, team: 0 | 1): Unit {
  if (spec.techniques.length < 1 || spec.techniques.length > 4) throw new Error(`Đơn vị ${spec.id} cần 1–4 công pháp`);
  const talents = spec.talents ?? [];
  if (talents.length > 2) throw new Error(`Đơn vị ${spec.id} có tối đa 2 tài năng`);
  const roots = spec.element2 && spec.element2 !== spec.element ? [spec.element, spec.element2] : [spec.element];
  const b = unitBonuses(roots, talents, spec.techniques);
  if (spec.bonuses) for (const k of Object.keys(spec.bonuses) as BuffStat[]) b[k] += spec.bonuses[k] ?? 0;
  const sfx = spec.setFx ?? {};
  // Thiết Bích Văn: hàng trước phòng thủ thêm; Tĩnh Tâm Văn: hàng sau mana tối đa thêm.
  if (sfx.frontDef && spec.row === 0) b.def += sfx.frontDef;
  if (sfx.backMana && spec.row === 1) b.manaMax += sfx.backMana;
  const slots: Slot[] = spec.techniques.map((tech) => {
    const s = SKILL_SPECS[tech.type];
    const cooldown = slotCooldown(tech, b);
    // Tê liệt khi chí mạng chỉ có ở Lôi nên set chỉ cộng vào công pháp Lôi.
    const fx = techniqueFx(tech);
    if (fx.paralyze) fx.paralyze += b.paralyzeTicks;
    fx.armorPen += b.armorPen; // set đồ 2.0: xuyên giáp là chỉ số chung, cộng cả vào xuyên giáp sẵn có của Kim
    const mod = spec.skillMods?.[tech.type] ?? {};
    // Không công pháp nào tốn hơn mana tối đa chuẩn, để ghép đối cực (mana ×1,5) không tạo chiêu không bao giờ ra được (đề xuất).
    const baseCost = mul(Math.min(tech.manaCost, BATTLE.manaMax), mod.manaCost ?? ONE) * ONE;
    return {
      tech,
      fx,
      // Cung Ý không cộng dồn với tầm của hệ: mỗi công pháp tối đa +1 ô.
      range: s.range + Math.min(MAX_RANGE_BONUS, tech.rangeBonus + (mod.rangeBonus ?? 0)),
      radius: s.radius,
      cost: b.manaCostCut ? mul(baseCost, Math.max(0, ONE - b.manaCostCut)) : baseCost,
      baseCost,
      cooldown,
      cd: mul(cooldown * ONE, BATTLE.initialCooldown),
      bonus: b.damage + (MELEE.includes(tech.type) ? b.melee : 0) + (RANGED.includes(tech.type) ? b.ranged : 0) +
        (spec.elementDamage?.[tech.element] ?? 0) + (DAMAGE_KIND[tech.type] === "noi" ? b.innerDamage : 0),
      ally: ALLY_SKILLS.includes(tech.type),
      uses: tech.type === "bua_chu" ? R.talismanUses + b.extraTalismans + (mod.extraUses ?? 0) : -1,
      maxTargets: tech.targets + (mod.extraTargets ?? 0),
      mod,
      pickLeft: mod.pick ? mod.pickUses ?? -1 : 0,
    };
  });
  const firstAttack = slots.find((s) => !s.ally);
  const healer = slots.some((s) => s.tech.type === "hoi_phuc");
  const startA = spec.row === 0 ? BATTLE.frontPos : BATTLE.backPos;
  const hp = mul(spec.hp, ONE + b.hp);
  const manaMax = mul(spec.manaMax ?? BATTLE.manaMax, ONE + b.manaMax) * ONE;
  const decoy = sfx.decoyTicks && spec.decoyElement ? spec.decoyElement : null;
  const qi = slots.find((s) => s.mod.qiCycleTicks);
  // Cổ Tông: hồi chiêu pháp bảo ngắn hơn (không dưới sàn của tế luyện tầng); thêm lần mỗi trận, không quá trần của set và linh lực.
  const artifacts = (spec.artifacts ?? []).map((a) => {
    let cooldownTicks = sfx.artifactCooldownCut ? mul(a.cooldownTicks, ONE - sfx.artifactCooldownCut) : a.cooldownTicks;
    if (a.minCooldownTicks !== undefined) cooldownTicks = Math.max(a.minCooldownTicks, cooldownTicks);
    let uses = a.uses;
    if (sfx.artifactExtraUses) uses = Math.min(Math.max(a.uses, Math.min(a.uses + sfx.artifactExtraUses, sfx.artifactMaxUses ?? a.uses + sfx.artifactExtraUses)), a.energy ?? a.uses + sfx.artifactExtraUses);
    return { ...a, cooldownTicks, uses, readyTick: 0, used: 0, charges: 0 };
  });
  return {
    id: spec.id, team, level: spec.level, element: spec.element,
    hp, atk: mul(spec.atk, ONE + b.atk), def: mul(spec.def, ONE + b.def), resist: spec.resist ?? {}, boss: spec.boss ?? false,
    defOuter: mul(spec.def, ONE + b.def + b.defOuter), defInner: mul(spec.def, ONE + b.def + b.defInner), baseAtk: spec.atk, baseDef: spec.def,
    monster: spec.monster ?? false, row: spec.row, sectId: spec.sectId ?? null, b,
    curHp: hp,
    pos: team === 0 ? startA : BATTLE.fieldLength - startA,
    mana: manaMax,
    manaMax,
    regen: healer ? mul(MANA_REGEN_PER_TICK, ONE - R.healerRegenPenalty - (sfx.healerRegenPenalty ?? 0)) : MANA_REGEN_PER_TICK,
    slots,
    preferredRange: firstAttack ? firstAttack.range : BATTLE.supportStandoff,
    ultReady: false,
    shield: 0, shieldUntil: NEVER,
    stunUntil: NEVER, rootUntil: NEVER,
    slow: 0, slowUntil: NEVER,
    burn: 0, burnNext: NEVER, burnUntil: NEVER,
    healCut: 0, healCutUntil: NEVER,
    exposedUntil: NEVER,
    stealthUntil: b.stealthTicks > 0 ? b.stealthTicks : NEVER,
    selfShieldNext: NEVER,
    channel: null,
    artifacts,
    controlImmuneUntil: NEVER,
    fx: sfx,
    stoneUntil: NEVER,
    frozenUntil: NEVER,
    decoy,
    decoyUntil: decoy ? sfx.decoyTicks! : NEVER,
    qiReadyTick: qi ? qi.mod.qiCycleTicks! : NEVER,
    critCount: 0,
    once: {
      petrify: sfx.petrifyBelow ? 1 : 0, cleanse: sfx.cleanseHealCut ?? 0, instantAoe: sfx.instantFirstAoe ? 1 : 0,
      resetHeal: sfx.resetHealOnFall ?? 0, stealthKill: sfx.stealthOnDashKill ? 1 : 0, bounce: sfx.bounceCrit ? 1 : 0,
      lastStand: sfx.lastStandShield ? 1 : 0,
    },
    shieldHit: {},
    opened: false,
    comboTarget: -1,
    comboCount: 0,
    nextPierce: 0,
    hasteAoe: false,
    controlBlocks: 0,
    controlBlockUntil: NEVER,
    defBuff: 0,
    defBuffUntil: NEVER,
    regenNext: sfx.regenPulse ? sfx.regenPulseTicks ?? NEVER : NEVER,
    hidden: (spec.hidden ?? []).map((line) => ({ line, ok: false, on: false, first: NEVER })),
    hidDyn: false,
  };
}

/** Trận chạy từng tick; `simulate` chạy hết một lượt. */
export class Battle {
  readonly units: Unit[];
  readonly events: CastEvent[] = [];
  tick = 0;
  private readonly rng: Rng;
  private readonly hasher = new Hasher();
  private readonly cmds: { tick: number; unitId: number }[];
  private ci = 0;
  private readonly alive: [number, number];
  private readonly teams: [Unit[], Unit[]]; // theo id; tìm địch chỉ duyệt đội bên kia
  private readonly hasArtifacts: [boolean, boolean]; // đội không có pháp bảo thì bỏ qua mọi kiểm tra pháp bảo
  private readonly record: boolean;

  /** `record` = ghi lại từng lần ra chiêu vào `events`. */
  constructor(input: BattleInput, record = false) {
    this.record = record;
    this.rng = new Rng(input.seed);
    this.units = [...input.teamA.map((u) => makeUnit(u, 0)), ...input.teamB.map((u) => makeUnit(u, 1))].sort((x, y) => x.id - y.id);
    this.teams = [this.units.filter((u) => u.team === 0), this.units.filter((u) => u.team === 1)];
    this.hasArtifacts = [this.teams[0].some((u) => u.artifacts.length > 0), this.teams[1].some((u) => u.artifacts.length > 0)];
    this.cmds = [...(input.commands ?? [])].sort((x, y) => x.tick - y.tick || x.unitId - y.unitId);
    this.alive = [input.teamA.length, input.teamB.length];
    for (const u of this.units) if (u.fx.resistTopEnemy) this.attuneResist(u);
    for (const u of this.units) if (u.hidden.length > 0) this.initHidden(u, input.war ?? false);
  }

  /** Dòng ẩn: bật các điều kiện xét được từ đầu trận; điều kiện theo máu, thời gian thì xét mỗi tick (updateHidden). */
  private initHidden(u: Unit, war: boolean): void {
    const foes = this.teams[1 - u.team];
    const pve = foes.some((e) => e.monster);
    const countered = foes.some((e) => elementMultiplier(e.element, u.element) >= COUNTER);
    for (const h of u.hidden) {
      const c = h.line.cond;
      if (c === "always") h.ok = true;
      else if (c === "pve") h.ok = pve;
      else if (c === "war") h.ok = war;
      else if (c === "front") h.ok = u.row === 0;
      else if (c === "back") h.ok = u.row === 1;
      else if (c === "countered") h.ok = countered;
      else {
        u.hidDyn = true;
        h.ok = c === "opening" && HIDDEN_RULES.openingTicks > 0;
      }
    }
    this.pickHidden(u, true);
  }

  /** Bật các dòng đầu tiên (theo thứ tự ưu tiên) đang đúng điều kiện, tối đa HIDDEN_RULES.maxActive; tắt các dòng còn lại. */
  private pickHidden(u: Unit, atStart: boolean): void {
    let n = 0;
    for (const h of u.hidden) {
      const want = h.ok && n < HIDDEN_RULES.maxActive;
      if (want) n++;
      if (want !== h.on) this.setHidden(u, h, want, atStart);
    }
  }

  private updateHidden(u: Unit): void {
    const tick = this.tick;
    let changed = false;
    for (const h of u.hidden) {
      const c = h.line.cond;
      let on: boolean;
      if (c === "lowHp") on = u.curHp * ONE < u.hp * HIDDEN_RULES.lowHpBelow;
      else if (c === "opening") on = tick < HIDDEN_RULES.openingTicks;
      else if (c === "late") on = tick >= HIDDEN_RULES.lateTicks;
      else continue;
      if (on !== h.ok) {
        h.ok = on;
        changed = true;
      }
    }
    if (changed) this.pickHidden(u, false);
  }

  /** Bật hoặc tắt một dòng ẩn: cộng, trừ chỉ số rồi tính lại phần suy ra từ nó. `atStart` = đầu trận, hồi chiêu ban đầu tính lại. */
  private setHidden(u: Unit, h: HiddenState, on: boolean, atStart: boolean): void {
    h.on = on;
    if (on && h.first === NEVER) h.first = this.tick;
    const v = on ? h.line.value : -h.line.value;
    const b = u.b;
    switch (h.line.stat) {
      case "atk": b.atk += v; u.atk = mul(u.baseAtk, ONE + b.atk); break;
      case "defOuter": b.defOuter += v; u.defOuter = mul(u.baseDef, ONE + b.def + b.defOuter); break;
      case "defInner": b.defInner += v; u.defInner = mul(u.baseDef, ONE + b.def + b.defInner); break;
      case "manaCostCut":
        b.manaCostCut += v;
        for (const s of u.slots) s.cost = mul(s.baseCost, Math.max(0, ONE - b.manaCostCut));
        break;
      case "cooldownCut":
        b.cooldownCut += v;
        for (const s of u.slots) {
          s.cooldown = slotCooldown(s.tech, b);
          if (atStart) s.cd = mul(s.cooldown * ONE, BATTLE.initialCooldown);
        }
        break;
      case "counterResist": {
        const r = { ...u.resist };
        for (const e of ELEMENTS) if (elementMultiplier(e, u.element) >= COUNTER) r[e] = (r[e] ?? 0) + v;
        u.resist = r;
        break;
      }
      default: b[h.line.stat] += v; // chí mạng, hút máu, hồi máu mỗi giây, phản đòn, giảm sát thương nhận, tốc đánh
    }
  }

  /** Ngọc Tủy: đầu trận cộng kháng hệ chủ xuất hiện nhiều nhất trong công pháp của đội địch (hòa thì hệ đứng trước trong bảng 12 hệ). */
  private attuneResist(u: Unit): void {
    const n: Partial<Record<Element, number>> = {};
    for (const e of this.teams[1 - u.team]) for (const s of e.slots) n[s.tech.element] = (n[s.tech.element] ?? 0) + 1;
    let best: Element | null = null;
    for (const el of ELEMENTS) if ((n[el] ?? 0) > (best ? n[best] ?? 0 : 0)) best = el;
    if (best) u.resist = { ...u.resist, [best]: (u.resist[best] ?? 0) + u.fx.resistTopEnemy! };
  }

  get finished(): boolean {
    return this.alive[0] === 0 || this.alive[1] === 0 || this.tick >= MAX_TICKS;
  }

  step(): void {
    const tick = this.tick;
    while (this.ci < this.cmds.length && this.cmds[this.ci].tick <= tick) {
      const c = this.cmds[this.ci++];
      const u = this.units.find((x) => x.id === c.unitId);
      if (u && u.curHp > 0) u.ultReady = true;
    }
    if (this.hasArtifacts[0]) this.ringBell(0);
    if (this.hasArtifacts[1]) this.ringBell(1);
    for (const u of this.units) {
      if (u.curHp <= 0) continue;
      if (u.burn > 0 && tick >= u.burnNext) {
        this.hurt(u, u.burn);
        u.burnNext += TICKS_PER_SECOND;
        if (u.burnNext > u.burnUntil) u.burn = 0;
        if (u.curHp <= 0) {
          if (this.alive[0] === 0 || this.alive[1] === 0) break;
          continue;
        }
      }
      if (u.hidDyn) this.updateHidden(u);
      u.mana = Math.min(u.manaMax, u.mana + u.regen);
      // Hồi máu mỗi giây (set Bàn Thạch, Bách Thảo, dòng ẩn): theo máu tối đa, qua hồi máu nhận và giảm hồi như mọi nguồn hồi.
      if (u.b.hpRegen > 0 && tick > 0 && tick % TICKS_PER_SECOND === 0) this.restore(u, u, mul(u.hp, u.b.hpRegen));
      if (tick >= u.regenNext) {
        u.regenNext += u.fx.regenPulseTicks ?? 0; // Hồi Xuân Văn: hồi một phần máu tối đa theo nhịp
        this.restore(u, u, mul(u.hp, u.fx.regenPulse ?? 0));
      }
      const slowed = tick < u.slowUntil ? u.slow : 0; // chỉ chậm di chuyển
      const recover = ONE + u.b.attackSpeed;
      for (const s of u.slots) if (s.cd > 0) s.cd -= recover;
      if (u.shield > 0 && tick >= u.shieldUntil) u.shield = 0;
      if (u.channel) {
        // Chiêu vận công vẫn phát khi tới giờ; chiêu không bị cắt ngang thì phát cả khi đang choáng.
        if (tick >= u.channel.resolveTick) this.resolve(u);
      } else if (tick >= u.stunUntil && tick >= u.stoneUntil) {
        this.act(u, slowed);
      }
      if (this.alive[0] === 0 || this.alive[1] === 0) break;
    }
    for (const u of this.units) {
      this.hasher.add(u.curHp > 0 ? u.curHp : 0);
      this.hasher.add(u.pos);
      this.hasher.add(u.mana);
      this.hasher.add(u.shield);
    }
    this.hasher.add(tick);
    this.tick++;
  }

  result(): BattleResult {
    const [a, b] = this.alive;
    const r: BattleResult = { winner: a > 0 && b === 0 ? "A" : b > 0 && a === 0 ? "B" : "draw", ticks: this.tick, hash: this.hasher.value(), survivorsA: a, survivorsB: b };
    if (this.hasArtifacts[0] || this.hasArtifacts[1]) {
      r.artifactUses = this.units.filter((u) => u.artifacts.length > 0).map((u) => ({ unitId: u.id, uses: u.artifacts.map((x) => x.used) }));
    }
    if (this.units.some((u) => u.hidden.length > 0)) {
      const first: { unitId: number; line: number; tick: number }[] = [];
      for (const u of this.units) u.hidden.forEach((h, line) => { if (h.first !== NEVER) first.push({ unitId: u.id, line, tick: h.first }); });
      r.hiddenFirst = first;
    }
    return r;
  }

  /**
   * Khống chế `t` trong `ticks`; bị khống chế lại trong cửa sổ thì còn một nửa (Băng Phách của người khống chế `src`: còn 75%).
   * Cắt chiêu vận công (Văn Uyên: hoàn một phần hồi chiêu). Chuông cho miễn khống chế.
   */
  control(t: Unit, ticks: number, src?: Unit): void {
    if (t.curHp <= 0 || this.tick < t.controlImmuneUntil) return;
    if (t.controlBlocks > 0 && this.tick < t.controlBlockUntil) {
      t.controlBlocks--; // Bất Động Côn: khiên hộ thể đỡ một lần khống chế
      return;
    }
    if (src?.fx.controlChannelTicks && t.channel) ticks += src.fx.controlChannelTicks; // Băng Phách: trúng kẻ đang vận công, bày trận
    const dur = this.tick < t.stunUntil + R.controlDrWindow ? mul(ticks, src?.fx.controlDr ?? ONE / 2) : ticks;
    t.stunUntil = Math.max(t.stunUntil, this.tick + dur);
    if (t.channel && t.channel.interruptible) {
      if (t.fx.channelRefund) {
        const s = t.slots[t.channel.slot];
        s.cd = Math.max(0, s.cd - mul(s.cooldown * ONE, t.fx.channelRefund));
      }
      t.channel = null;
    }
  }

  /** Dùng công pháp đầu tiên sẵn sàng, đủ mana và có mục tiêu; không có thì tiến về địch gần nhất. */
  private act(u: Unit, slowed: number): void {
    const foe = this.nearestEnemy(u);
    if (!foe) return;
    const dist = Math.abs(foe.pos - u.pos);
    for (let i = 0; i < u.slots.length; i++) {
      const s = u.slots[i];
      const cost = s.mod.lastUseFree && s.uses === 1 ? 0 : s.cost; // Độ Kiếp: lần bùa chú cuối không tốn mana
      if (s.cd > 0 || u.mana < cost || s.uses === 0) continue;
      if (!s.ally && dist > s.range) continue;
      const type = s.tech.type;
      let targets: Unit[] = [];
      const pick = s.pickLeft !== 0 ? s.mod.pick : undefined;
      // Hồi phục luôn chọn đồng minh % máu thấp nhất; `pick` không áp cho hồi phục.
      if (type === "hoi_phuc") targets = this.pickAllies(u, s);
      else if (type === "ho_the") targets = this.pickGuarded(u, s, foe, pick);
      else if (s.radius === 0) targets = this.pickEnemies(u, s, u.pos, s.range, pick);
      if (targets.length === 0 && s.radius === 0) continue;

      u.mana -= cost;
      s.cd = s.cooldown * ONE;
      if (s.uses > 0) s.uses--;
      if (pick && s.pickLeft > 0) s.pickLeft--;
      if (s.fx.selfShield && this.tick >= u.selfShieldNext) {
        this.addShield(u, u, mul(u.hp, s.fx.selfShield));
        u.selfShieldNext = this.tick + R.selfShieldCooldownTicks;
      }
      if (s.radius > 0) {
        // Diện rộng vận công, trận pháp bày trận: phát sau, tâm chốt ở địch gần nhất lúc bắt đầu.
        const formation = type === "tran_phap";
        const center = formation && s.mod.densest ? this.densestSpot(u, s, foe) : foe.pos;
        const resolveTick = this.tick + (formation
          ? Math.max(CAST_FLOOR.formationTicks, mul(R.formationCastTicks, ONE - u.b.formationCut) + u.b.formationTicks + (s.mod.castTicks ?? 0))
          : Math.max(CAST_FLOOR.channelTicks, this.aoeCastTicks(u, s)));
        const join = formation ? this.formationToJoin(u, center, resolveTick) : null;
        u.channel = {
          slot: i,
          startTick: this.tick,
          resolveTick,
          center,
          ult: this.takeUlt(u),
          interruptible: !formation || R.formationInterruptible,
          guarded: [],
          guardCut: 0,
          group: join ? join.group : u.id,
        };
        if (!formation) u.hasteAoe = false;
        if (!formation && this.hasArtifacts[1 - u.team]) this.raiseTower(u.channel, 1 - u.team);
        // Văn Uyên: diện rộng đầu tiên mỗi trận phát ngay, không vận công.
        if (!formation && u.once.instantAoe > 0) {
          u.once.instantAoe--;
          this.resolve(u);
        }
        return;
      }
      if (type === "hoi_phuc") this.heal(u, s, targets);
      else if (type === "ho_the") this.guard(u, s, targets, foe);
      else if (type === "than_phap") this.dash(u, s, targets[0]);
      else if (type === "can_quet" && this.hasArtifacts[1 - u.team] && this.spinWheel(targets)) {
        targets = []; // Luân cắt chiêu quét: tốn mana và hồi chiêu, không trúng ai
      } else {
        this.strike(u, s, targets, this.takeUlt(u), 0, false);
        if (type === "khong_che") {
          for (const t of targets) {
            if (s.mod.breakChannel && t.channel) t.channel = null; // Ngọc Lâu Tiêu: chiêu vận công mất hẳn, không hoàn hồi chiêu
            this.control(t, this.controlTicks(u, R.stunTicks), u);
          }
        }
      }
      this.log(u, i, this.tick, targets);
      return;
    }
    if (dist > u.preferredRange && this.tick >= u.rootUntil) {
      const speed = slowed ? mul(BATTLE.moveSpeed, ONE - slowed) : BATTLE.moveSpeed;
      const move = Math.min(speed, dist - u.preferredRange);
      u.pos = clamp(u.pos + (foe.pos > u.pos ? move : -move), 0, BATTLE.fieldLength);
    }
  }

  private resolve(u: Unit): void {
    const ch = u.channel!;
    const s = u.slots[ch.slot];
    const formation = s.tech.type === "tran_phap";
    if (formation) {
      const members = this.formationMembers(u.team, ch.group);
      if (members.length > 1) {
        // Hợp trận: ai bày xong trước thì đứng chờ; người cuối bày xong thì cả trận kích một lần.
        if (members.some((m) => m.channel!.resolveTick > this.tick)) return;
        this.resolveFormation(members);
        return;
      }
    }
    u.channel = null;
    const targets = this.pickEnemies(u, s, ch.center, s.radius);
    const opts: StrikeOpts = { guarded: ch.guarded, guardCut: ch.guardCut };
    // Phiên: trận của địch bày xong thì yếu đi (sim không có trận kéo dài, nên "ngắn lại" là giảm sát thương), mục tiêu đầu không bị tuyệt sát.
    const flag = formation && targets.length > 0 && this.hasArtifacts[1 - u.team] ? this.readyArtifact(1 - u.team, "phien_co") : null;
    if (flag) {
      this.fire(flag);
      opts.guarded = targets.map((t) => t.id);
      opts.guardCut = flag.a.power;
      opts.noExecute = targets[0].id;
    }
    this.strike(u, s, targets, ch.ult, 0, formation, opts);
    if (formation) this.formationWard(u, s, ch.center);
    this.log(u, ch.slot, ch.startTick, targets);
  }

  /**
   * Hợp trận: trận chung của đồng đội đang bày trận pháp (còn sống, chưa kích), tâm cách tâm mới không quá formationJoinRange.
   * Có nhiều trận thì chọn trận bắt đầu bày sớm nhất, rồi id người bày đầu nhỏ hơn. Người mới bày xong (`resolveTick`) muộn
   * hơn người xong sớm nhất của trận đó quá formationJoinWait thì không nhập, bày trận riêng.
   */
  private formationToJoin(u: Unit, center: number, resolveTick: number): Channel | null {
    let best: Channel | null = null;
    for (const a of this.teams[u.team]) {
      const ch = a.channel;
      if (a === u || a.curHp <= 0 || !ch || a.slots[ch.slot].tech.type !== "tran_phap") continue;
      if (Math.abs(ch.center - center) > R.formationJoinRange) continue;
      if (!best || ch.startTick < best.startTick || (ch.startTick === best.startTick && ch.group < best.group)) best = ch;
    }
    if (!best) return null;
    let first = best.resolveTick;
    for (const m of this.formationMembers(u.team, best.group)) first = Math.min(first, m.channel!.resolveTick);
    return resolveTick > first + R.formationJoinWait ? null : best;
  }

  /** Người còn sống đang bày trận pháp trong trận chung `group`, theo id. Ai chết hay bị cắt ngang thì đã rời nhóm. */
  private formationMembers(team: number, group: number): Unit[] {
    const out: Unit[] = [];
    for (const a of this.teams[team]) {
      if (a.curHp > 0 && a.channel && a.channel.group === group && a.slots[a.channel.slot].tech.type === "tran_phap") out.push(a);
    }
    return out;
  }

  /** Hệ số hợp trận theo số người lúc kích: 2 người Lưỡng Nghi, 3–4 người Tam Tài, từ 5 người Ngũ Hành (GDD mục 8). */
  private formationBond(n: number): number {
    return n >= 5 ? R.formationBond5 : n >= 3 ? R.formationBond3 : n === 2 ? R.formationBond2 : ONE;
  }

  /**
   * Kích trận chung: mục tiêu theo tâm và công pháp của người bày đầu (bắt đầu sớm nhất, rồi id nhỏ). Tuyệt sát tung một lần
   * mỗi mục tiêu cho cả trận (15% cộng phần tuyệt sát cao nhất nhóm, xét cảnh giới theo cấp cao nhất nhóm); rồi từng người
   * đánh theo thứ tự id, sát thương nhân hệ số hợp trận. Phiên (pháp bảo) xét một lần cho trận chung.
   */
  private resolveFormation(members: Unit[]): void {
    let lead = members[0];
    for (const m of members) {
      const a = m.channel!, b = lead.channel!;
      if (a.startTick < b.startTick || (a.startTick === b.startTick && m.id < lead.id)) lead = m;
    }
    const lc = lead.channel!;
    const ls = lead.slots[lc.slot];
    // Trận chung đánh thêm mục tiêu theo số người, có trần.
    const limit = Math.min(R.formationMaxTargets, ls.maxTargets + R.formationExtraTargets * (members.length - 1));
    const targets = this.pickEnemies(lead, ls, lc.center, ls.radius, undefined, limit);
    const chans = members.map((m) => m.channel!);
    for (const m of members) m.channel = null;
    const opts: StrikeOpts = { scale: this.formationBond(members.length), guarded: lc.guarded, guardCut: lc.guardCut };
    const flag = targets.length > 0 && this.hasArtifacts[1 - lead.team] ? this.readyArtifact(1 - lead.team, "phien_co") : null;
    if (flag) {
      this.fire(flag);
      opts.guarded = targets.map((t) => t.id);
      opts.guardCut = flag.a.power;
      opts.noExecute = targets[0].id;
    }
    let bonus = 0;
    let level = 0;
    for (const m of members) {
      bonus = Math.max(bonus, m.b.executeBonus);
      level = Math.max(level, m.level);
    }
    for (const t of targets) {
      if (t.curHp <= 0 || t.boss || t.id === opts.noExecute || this.tick < t.stoneUntil || realm(t.level) > realm(level)) continue;
      if (this.rng.chance(R.executeChance + bonus)) this.hurt(t, t.curHp + t.shield);
    }
    members.forEach((m, i) => {
      const ch = chans[i];
      this.strike(m, m.slots[ch.slot], targets, ch.ult, 0, false, opts);
      this.formationWard(m, m.slots[ch.slot], lc.center);
      this.log(m, ch.slot, ch.startTick, targets, { groupLead: lead.id, groupSize: members.length });
    });
  }

  /** Chu Thiên: tâm trận đặt ở kẻ địch trong tầm có nhiều kẻ địch nhất trong bán kính; hòa thì gần người bày hơn, rồi id. */
  private densestSpot(u: Unit, s: Slot, foe: Unit): number {
    const tick = this.tick;
    const seen = this.teams[1 - u.team].filter((e) => e.curHp > 0 && tick >= e.stealthUntil);
    let best = foe;
    let bestN = -1;
    for (const c of seen) {
      const d = Math.abs(c.pos - u.pos);
      if (d > s.range) continue;
      let n = 0;
      for (const e of seen) if (Math.abs(e.pos - c.pos) <= s.radius) n++;
      const bd = Math.abs(best.pos - u.pos);
      if (n > bestN || (n === bestN && (d < bd || (d === bd && c.id < best.id)))) {
        best = c;
        bestN = n;
      }
    }
    return best.pos;
  }

  /** Tick vận công diện rộng trước sàn: gốc, set, Ý châu; Phong Lôi Phiến làm lần kế tiếp nhanh gấp đôi. */
  private aoeCastTicks(u: Unit, s: Slot): number {
    const ticks = R.aoeCastTicks + u.b.channelTicks + (s.mod.castTicks ?? 0);
    return u.hasteAoe ? Math.trunc(ticks / 2) : ticks;
  }

  /** Tinh La Kỳ: trận pháp phát thì đồng đội đứng trong trận (bán kính quanh tâm) thêm phòng thủ một lúc. */
  private formationWard(u: Unit, s: Slot, center: number): void {
    if (!s.mod.allyDefBuff) return;
    for (const a of this.teams[u.team]) {
      if (a.curHp <= 0 || Math.abs(a.pos - center) > s.radius) continue;
      a.defBuff = Math.max(a.defBuff, s.mod.allyDefBuff);
      a.defBuffUntil = this.tick + (s.mod.allyDefTicks ?? 0);
    }
  }

  /** Chiêu cuối tông chủ áp vào lần đánh kế tiếp rồi hết. */
  private takeUlt(u: Unit): boolean {
    const ult = u.ultReady;
    u.ultReady = false;
    return ult;
  }

  private log(u: Unit, slot: number, startTick: number, targets: Unit[], group?: { groupLead: number; groupSize: number }): void {
    if (this.record) this.events.push({ tick: this.tick, startTick, unitId: u.id, slot, targets: targets.map((t) => t.id), ...group });
  }

  /** Địch nhìn thấy được (không ẩn thân), gần nhất → máu thấp hơn → id nhỏ hơn. */
  private nearestEnemy(u: Unit): Unit | undefined {
    let best: Unit | undefined;
    let bestDist = 0;
    for (const e of this.teams[1 - u.team]) {
      if (e.curHp <= 0 || this.tick < e.stealthUntil) continue;
      const d = Math.abs(e.pos - u.pos);
      if (!best || d < bestDist || (d === bestDist && (e.curHp < best.curHp || (e.curHp === best.curHp && e.id < best.id)))) {
        best = e;
        bestDist = d;
      }
    }
    return best;
  }

  /**
   * Địch trong khoảng `reach` quanh `center`: chiêu đơn ưu tiên kẻ đang lộ vị trí, rồi gần nhất → máu thấp → id.
   * `pick` của Ý châu thay thứ tự: % máu thấp nhất, kẻ đang vận công trước, hoặc hàng sau % máu thấp nhất (không có ai hàng sau thì như mặc định).
   */
  private pickEnemies(u: Unit, s: Slot, center: number, reach: number, pick?: TargetPick, limit = s.maxTargets): Unit[] {
    const tick = this.tick;
    let list: Unit[] = [];
    for (const e of this.teams[1 - u.team]) {
      if (e.curHp > 0 && tick >= e.stealthUntil && Math.abs(e.pos - center) <= reach) list.push(e);
    }
    let byHp = pick === "lowest_hp";
    if (pick === "back_row_lowest_hp") {
      const back = list.filter((e) => e.row === 1);
      if (back.length > 0) {
        list = back;
        byHp = true;
      }
    }
    const exposedFirst = s.radius === 0;
    const order = (a: Unit, b: Unit) =>
      (exposedFirst ? (b.exposedUntil > tick ? 1 : 0) - (a.exposedUntil > tick ? 1 : 0) : 0) ||
      Math.abs(a.pos - center) - Math.abs(b.pos - center) || a.curHp - b.curHp || a.id - b.id;
    if (byHp) list.sort((a, b) => a.curHp * b.hp - b.curHp * a.hp || a.curHp - b.curHp || a.id - b.id);
    else if (pick === "channeling") list.sort((a, b) => (b.channel ? 1 : 0) - (a.channel ? 1 : 0) || order(a, b));
    else list.sort(order);
    if (list.length > limit) list.length = limit;
    return list;
  }

  /** Đồng minh (kể cả bản thân) đang mất máu, trong tầm, % máu thấp nhất trước. */
  private pickAllies(u: Unit, s: Slot): Unit[] {
    const list: Unit[] = [];
    for (const a of this.teams[u.team]) {
      if (a.curHp > 0 && a.curHp < a.hp && Math.abs(a.pos - u.pos) <= s.range) list.push(a);
    }
    list.sort((a, b) => a.curHp * b.hp - b.curHp * a.hp || a.id - b.id);
    if (list.length > s.tech.targets) list.length = s.tech.targets;
    return list;
  }

  /**
   * Hộ thể che các đồng minh (kể cả bản thân) đứng gần địch nhất, rồi % máu thấp nhất.
   * Côn Ý (`most_targeted`): trước hết là đồng minh bị nhiều địch nhắm nhất, tính là địch gần nhất của từng kẻ địch.
   */
  private pickGuarded(u: Unit, s: Slot, foe: Unit, pick?: TargetPick): Unit[] {
    const list: Unit[] = [];
    for (const a of this.teams[u.team]) {
      if (a.curHp > 0 && Math.abs(a.pos - u.pos) <= s.range) list.push(a);
    }
    const order = (a: Unit, b: Unit) =>
      Math.abs(a.pos - foe.pos) - Math.abs(b.pos - foe.pos) || a.curHp * b.hp - b.curHp * a.hp || a.id - b.id;
    if (pick === "most_targeted") {
      const aimed: Record<number, number> = {};
      for (const e of this.teams[1 - u.team]) {
        if (e.curHp <= 0) continue;
        const t = this.nearestEnemy(e);
        if (t) aimed[t.id] = (aimed[t.id] ?? 0) + 1;
      }
      list.sort((a, b) => (aimed[b.id] ?? 0) - (aimed[a.id] ?? 0) || order(a, b));
    } else list.sort(order);
    if (list.length > s.maxTargets) list.length = s.maxTargets;
    return list;
  }

  /** Đánh từng mục tiêu và áp hiệu ứng hệ; `execute` = trận pháp, mỗi mục tiêu có thể bị tuyệt sát. `opts` là phần pháp bảo của bên bị đánh. */
  private strike(u: Unit, s: Slot, targets: Unit[], ult: boolean, critBonus: number, execute: boolean, opts: StrikeOpts = {}): void {
    const fx = s.fx;
    const ramp = this.rampMultiplier();
    const type = s.tech.type;
    const foeArtifacts = this.hasArtifacts[1 - u.team];
    const tick = this.tick;
    const uf = u.fx;
    // Phá Thiên Thương: lướt tới xong thì đòn kế tiếp xuyên khiên; dùng một lần.
    const pierce = Math.max(s.mod.shieldPierce ?? 0, u.nextPierce);
    u.nextPierce = 0;
    const opener = !u.opened && uf.openerBonus ? uf.openerBonus : 0; // Tiên Phát Văn
    u.opened = true;
    let swept = 0;
    for (let i = 0; i < targets.length; i++) {
      const t = targets[i];
      if (t.curHp <= 0 || tick < t.stoneUntil) continue; // Bàn Thạch: đang hóa đá thì miễn sát thương
      if (execute && !t.boss && t.id !== opts.noExecute && realm(t.level) <= realm(u.level) && this.rng.chance(R.executeChance + u.b.executeBonus)) {
        this.hurt(t, t.curHp + t.shield);
        continue;
      }
      const crit = this.rng.chance(s.tech.critPerMille + u.b.critBonus + critBonus);
      // Sát thương cộng thêm: dị thú (Liệp Thú), mục tiêu đầu (Thiết Kỵ), mục tiêu ít máu (Vạn Kiếm), mục tiêu bị đóng băng hoặc làm chậm (Băng Phách).
      let extra = (t.monster ? u.b.monsterDamage : 0) + opener;
      if (i === 0 && s.mod.firstTargetBonus) extra += s.mod.firstTargetBonus;
      if (s.mod.lowHpBonus && t.curHp * ONE < t.hp * (s.mod.lowHpBelow ?? 0)) extra += s.mod.lowHpBonus;
      if (uf.chilledBonus && (tick < t.slowUntil || tick < t.frozenUntil)) extra += uf.chilledBonus;
      if (s.mod.channelTargetBonus && t.channel) extra += s.mod.channelTargetBonus; // Lạc Tinh Cung
      if (uf.lowHpAllBonus && t.curHp * ONE < t.hp * (uf.lowHpAllBelow ?? 0)) extra += uf.lowHpAllBonus; // Truy Mệnh Văn
      if (uf.shieldBreakBonus && t.shield > 0 && u.shieldHit[t.id] !== t.shieldUntil) {
        u.shieldHit[t.id] = t.shieldUntil; // Phá Thuẫn Văn: đòn đầu lên mỗi tấm khiên
        extra += uf.shieldBreakBonus;
      }
      if (uf.comboThirdBonus && i === 0) {
        u.comboCount = u.comboTarget === t.id ? u.comboCount + 1 : 1; // Liên Kích Văn: tính theo mục tiêu chính của mỗi chiêu
        u.comboTarget = t.id;
        if (u.comboCount % 3 === 0) extra += uf.comboThirdBonus;
      }
      let dmg = hitDamage(u, s.tech, t, crit, ult, {
        damage: s.bonus + extra, critDamage: u.b.critDamage, armorPen: fx.armorPen, resistPen: fx.resistPen + u.b.resistPen,
        defElement: t.decoy !== null && tick < t.decoyUntil ? t.decoy : undefined, counterCap: t.fx.counterCap,
        counterBoost: uf.counterBoost, defBonus: tick < t.defBuffUntil ? t.defBuff : undefined,
      });
      if (s.mod.useDamage) dmg = Math.max(1, mul(dmg, s.mod.useDamage)); // Tạo Hóa Bút: thêm lần, mỗi lần yếu hơn
      // Mục tiêu thêm của Đao Ý (sau số mục tiêu của loại chiêu) nhận ít sát thương hơn.
      if (i >= s.tech.targets) dmg = Math.max(1, mul(dmg, s.mod.extraTargetDamage ?? ONE));
      if (s.tech.forsakenSect !== undefined && s.tech.forsakenSect === t.sectId) dmg = Math.max(1, mul(dmg, BATTLE.betrayalDamage));
      if (ramp !== ONE) dmg = mul(dmg, ramp);
      if (opts.scale !== undefined) dmg = Math.max(1, mul(dmg, opts.scale));
      if (opts.guarded && opts.guardCut && opts.guarded.indexOf(t.id) >= 0) dmg = Math.max(1, dmg - mul(dmg, opts.guardCut));
      // Giảm sát thương nhận, sau phòng thủ: chung cộng theo loại đòn, mỗi loại đòn không quá DAMAGE_CUT_CAP.
      const dk = DAMAGE_KIND[type];
      const cut = t.b.damageTakenCut + (dk === "ngoai" ? t.b.damageTakenCutOuter : dk === "noi" ? t.b.damageTakenCutInner : 0);
      if (cut > 0) dmg = Math.max(1, dmg - mul(dmg, Math.min(DAMAGE_CUT_CAP, cut)));
      if (foeArtifacts) dmg = this.blockHit(type, t, dmg, crit);
      // Thiết Kỵ: hàng trước, sau lưng còn từ 2 đồng đội hàng sau, nhận ít sát thương diện rộng hơn.
      if (type === "dien_rong" && t.fx.frontAoeCut && t.row === 0 && this.backRowAlive(t.team) >= 2) dmg = Math.max(1, dmg - mul(dmg, t.fx.frontAoeCut));
      this.hurt(t, dmg, pierce);
      swept++;
      if (foeArtifacts && type === "bua_chu") this.reflectTalisman(u, t, dmg);
      // Phản đòn cận chiến: Phản Chấn Văn và chỉ số phản đòn (set Thiết Kỵ, dòng ẩn).
      const refl = (t.fx.meleeReflect ?? 0) + t.b.reflect;
      if (refl > 0 && MELEE.includes(type) && u.curHp > 0) this.hurt(u, Math.max(1, mul(dmg, refl)));
      if (u.b.manaDrain > 0 && t.mana > 0) {
        const m = Math.min(t.mana, mul(t.manaMax, u.b.manaDrain)); // hút mana: rút theo mana tối đa của mục tiêu
        t.mana -= m;
        u.mana = Math.min(u.manaMax, u.mana + m);
      }
      if (t.curHp <= 0 && uf.killMana) u.mana = Math.min(u.manaMax, u.mana + mul(u.manaMax, uf.killMana)); // Tụ Linh Văn
      if (crit && s.mod.critCooldownCut && type === "can_don") s.cd -= s.mod.critCooldownCut * ONE; // Thiên Vấn Kiếm
      if (crit && u.once.bounce > 0 && ++u.critCount === u.fx.bounceCrit) {
        u.once.bounce = 0;
        this.splash(u, t, mul(dmg, u.fx.bounceDamage ?? 0), false); // Lôi Trì: đòn chí mạng thứ 3 nảy sang kẻ khác
      }
      if (type === "can_don" && s.mod.qiCycleTicks && tick >= u.qiReadyTick) {
        u.qiReadyTick = tick + s.mod.qiCycleTicks;
        this.splash(u, t, mul(dmg, s.mod.qiDamage ?? 0), true); // Vạn Kiếm: kiếm khí trúng kẻ đứng sau mục tiêu
      }
      const drain = fx.healOfDamage + mul(fx.lifesteal, ONE + u.b.lifesteal) + u.b.lifestealFlat;
      if (drain > 0) this.restore(u, u, mul(dmg, drain));
      if (t.curHp <= 0) continue;
      this.applyEffects(u, s, t, dmg, crit);
    }
    // Đoạn Nhạc Đao: mỗi mục tiêu quét trúng từ thứ sweepShieldFrom (mặc định 3) cho người cầm khiên.
    const from = s.mod.sweepShieldFrom ?? 3;
    if (s.mod.sweepShield && swept >= from) this.addShield(u, u, mul(u.hp, s.mod.sweepShield * (swept - from + 1)));
    // Phong Lôi Phiến: diện rộng trúng đủ nhiều thì lần vận công kế tiếp nhanh gấp đôi.
    if (s.mod.bigAoeHaste && swept >= s.mod.bigAoeHaste) u.hasteAoe = true;
  }

  /** Số đồng đội hàng sau còn sống của đội `team`. */
  private backRowAlive(team: number): number {
    let n = 0;
    for (const x of this.teams[team]) if (x.curHp > 0 && x.row === 1) n++;
    return n;
  }

  /**
   * Đánh lan `dmg` sang một kẻ địch khác `t`: gần `t` nhất (hòa thì id nhỏ). `behind` = chỉ kẻ đứng sau `t` (xa người đánh hơn),
   * trong 1 ô. Đòn lan không chí mạng, không hiệu ứng hệ.
   */
  private splash(u: Unit, t: Unit, dmg: number, behind: boolean): void {
    const tick = this.tick;
    const dir = t.pos > u.pos ? 1 : t.pos < u.pos ? -1 : t.team === 1 ? 1 : -1;
    let best: Unit | null = null;
    for (const e of this.teams[t.team]) {
      if (e === t || e.curHp <= 0 || tick < e.stealthUntil) continue;
      const off = (e.pos - t.pos) * dir;
      if (behind && (off < 0 || off > A.adjacentRange)) continue;
      if (!best || Math.abs(e.pos - t.pos) < Math.abs(best.pos - t.pos)) best = e;
    }
    if (best) this.hurt(best, Math.max(1, dmg));
  }

  /** Hiệu ứng hệ lên mục tiêu còn sống sau đòn đánh (GDD mục 9). */
  private applyEffects(u: Unit, s: Slot, t: Unit, dmg: number, crit: boolean): void {
    const fx = s.fx;
    const tick = this.tick;
    if (fx.root && tick >= t.controlImmuneUntil) t.rootUntil = Math.max(t.rootUntil, tick + this.controlTicks(u, fx.root));
    if (fx.slow) {
      t.slow = tick < t.slowUntil ? Math.max(t.slow, fx.slow) : fx.slow;
      t.slowUntil = Math.max(t.slowUntil, tick + fx.slowTicks);
    }
    if (fx.burn) {
      // Thiêu đốt không cộng dồn: đòn mới mạnh hơn thì thay, yếu hơn thì bỏ.
      const perSec = mul(mul(dmg, fx.burn), ONE + u.b.dot);
      if (t.burn === 0 || perSec >= t.burn) {
        t.burn = perSec;
        t.burnNext = tick + TICKS_PER_SECOND;
        t.burnUntil = tick + fx.burnTicks;
      }
    }
    if (fx.healCut) {
      t.healCut = tick < t.healCutUntil ? Math.max(t.healCut, fx.healCut) : fx.healCut;
      t.healCutUntil = Math.max(t.healCutUntil, tick + fx.healCutTicks);
      // Bách Thảo: lần đầu mỗi trận chủ nhân hoặc đồng đội kề bên bị giảm hồi máu thì tẩy ngay.
      for (const o of this.teams[t.team]) {
        if (o.once.cleanse <= 0 || o.curHp <= 0 || (o !== t && Math.abs(o.pos - t.pos) > A.adjacentRange)) continue;
        o.once.cleanse--;
        t.healCut = 0;
        t.healCutUntil = tick;
        break;
      }
    }
    if (fx.knockback && (R.meleeKnockback || !CLOSE_RANGE.includes(s.tech.type))) {
      const kb = t.fx.knockbackResist ? mul(fx.knockback, ONE - t.fx.knockbackResist) : fx.knockback; // Định Thân Văn
      t.pos = clamp(t.pos + (t.pos >= u.pos ? kb : -kb), 0, BATTLE.fieldLength);
    }
    if (fx.paralyze && crit) this.control(t, this.controlTicks(u, fx.paralyze), u);
    if (fx.freezeChance && this.rng.chance(fx.freezeChance)) {
      this.control(t, this.controlTicks(u, fx.freezeTicks), u);
      t.frozenUntil = Math.max(t.frozenUntil, t.stunUntil);
    }
  }

  /** Trận quá `rampStartTicks` thì sát thương tăng dần theo từng nấc để trận phân thắng bại (chống hòa). */
  private rampMultiplier(): number {
    if (this.tick < BATTLE.rampStartTicks) return ONE;
    return ONE + BATTLE.rampPerStep * (1 + Math.trunc((this.tick - BATTLE.rampStartTicks) / BATTLE.rampStepTicks));
  }

  /** Thời gian khống chế sau buff Cực hàn. */
  private controlTicks(u: Unit, ticks: number): number {
    return mul(ticks, ONE + u.b.controlTime);
  }

  /**
   * Trừ khiên trước, rồi trừ máu; phần `pierce` (phần nghìn) của sát thương đi thẳng vào máu. Đang hóa đá thì miễn.
   * Bàn Thạch: lần đầu máu xuống dưới ngưỡng thì hóa đá. Linh Tuyền: đồng đội ngã thì hồi phục của người mặc hồi chiêu ngay.
   */
  private hurt(t: Unit, dmg: number, pierce = 0): void {
    if (this.tick < t.stoneUntil) return;
    if (t.shield > 0) {
      const absorbed = Math.min(t.shield, dmg - (pierce > 0 ? mul(dmg, pierce) : 0));
      t.shield -= absorbed;
      dmg -= absorbed;
    }
    if (dmg <= 0) return;
    t.curHp -= dmg;
    if (t.curHp <= 0) {
      this.alive[t.team]--;
      t.channel = null;
      for (const a of this.teams[t.team]) {
        if (a.curHp <= 0 || a.once.resetHeal <= 0) continue;
        const heal = a.slots.filter((s) => s.tech.type === "hoi_phuc");
        if (heal.length === 0) continue;
        a.once.resetHeal--;
        for (const s of heal) s.cd = 0;
      }
    } else {
      if (t.once.petrify > 0 && t.curHp * ONE < t.hp * (t.fx.petrifyBelow ?? 0)) {
        t.once.petrify = 0;
        t.stoneUntil = this.tick + (t.fx.petrifyTicks ?? 0);
      }
      // Hộ Mệnh Văn: lần đầu máu xuống dưới ngưỡng thì nhận khiên theo máu tối đa.
      if (t.once.lastStand > 0 && t.curHp * ONE < t.hp * (t.fx.lastStandBelow ?? 0)) {
        t.once.lastStand = 0;
        const shield = mul(t.hp, t.fx.lastStandShield ?? 0);
        if (shield > t.shield) {
          t.shield = shield;
          t.shieldUntil = this.tick + R.shieldTicks;
        }
      }
    }
  }

  /**
   * Hồi máu: nhân hiệu quả hồi máu của người hồi, hồi máu nhận của người nhận, trừ phần bị Cực âm giảm. Trả về phần tràn quá máu tối đa.
   * `skill` = từ chiêu hồi phục: Đỉnh của đối phương luyện hóa một phần nếu lượng hồi từ 15% máu tối đa.
   */
  private restore(src: Unit, t: Unit, amount: number, skill = false): number {
    let a = mul(amount, ONE + src.b.healPower);
    a = mul(a, ONE + t.b.healTaken);
    if (this.tick < t.healCutUntil) a = mul(a, ONE - t.healCut);
    if (skill && this.hasArtifacts[1 - src.team] && a * ONE >= t.hp * A.dinhHealOfMax) {
      const r = this.readyArtifact(1 - src.team, "dinh");
      if (r) {
        this.fire(r);
        a -= mul(a, r.a.power);
      }
    }
    const over = Math.max(0, t.curHp + a - t.hp);
    t.curHp += a - over;
    return over;
  }

  /** Khiên không cộng dồn, giữ khiên lớn hơn; nhân hiệu quả khiên của người tạo và khiên nhận được của người nhận. */
  private addShield(src: Unit, t: Unit, amount: number): void {
    t.shield = Math.max(t.shield, mul(mul(amount, ONE + src.b.healPower), ONE + t.b.shieldTaken));
    t.shieldUntil = this.tick + R.shieldTicks;
  }

  /** Hồi phục; Cầm Ý đổi một phần hồi tràn thành khiên (không cộng dồn, giữ khiên lớn hơn, nhân khiên nhận được của người nhận). */
  private heal(u: Unit, s: Slot, targets: Unit[]): void {
    const amount = Math.trunc((s.tech.damage * u.atk) / (100 * ONE));
    for (const t of targets) {
      if (s.mod.cleanseBurn) t.burn = 0; // Vọng Nguyệt Cầm: giải luôn thiêu đốt
      const over = this.restore(u, t, amount, true);
      if (over <= 0 || !s.mod.overhealShield) continue;
      const shield = mul(mul(over, s.mod.overhealShield), ONE + t.b.shieldTaken);
      if (shield > t.shield) {
        t.shield = shield;
        t.shieldUntil = this.tick + (s.mod.overhealShieldTicks ?? R.shieldTicks);
      }
    }
  }

  /** Hộ thể: khiên cho đồng minh, kèm đòn ×0,2 nếu địch đứng sát. Tu thể cộng 10% khiên. */
  private guard(u: Unit, s: Slot, targets: Unit[], foe: Unit): void {
    const amount = mul(shieldAmount(u.atk, s.tech), ONE + u.b.melee);
    for (const t of targets) {
      this.addShield(u, t, amount);
      if (s.mod.shieldBlocksControl) {
        t.controlBlocks = 1; // Bất Động Côn: khiên còn thì đỡ một lần khống chế
        t.controlBlockUntil = t.shieldUntil;
      }
    }
    // Bàn Thạch: che thêm chính mình nếu chưa nằm trong số được che, khiên phần thêm nhỏ hơn.
    if (u.fx.guardSelfShield && targets.indexOf(u) < 0) this.addShield(u, u, mul(amount, u.fx.guardSelfShield));
    if (this.hasArtifacts[1 - u.team]) this.siphonShield(targets);
    if (Math.abs(foe.pos - u.pos) <= R.shieldHitRange) this.strike(u, s, [foe], this.takeUlt(u), 0, false);
  }

  /** Thân pháp: lướt tới sát mục tiêu, đòn đầu cộng chí mạng, rồi lộ vị trí. Lướt vào hàng sau có Ấn thì đòn lướt còn 50% và bị choáng. */
  private dash(u: Unit, s: Slot, t: Unit): void {
    u.pos = clamp(t.pos + (u.pos < t.pos ? -R.dashStandOff : R.dashStandOff), 0, BATTLE.fieldLength);
    const seal = t.row === 1 && this.hasArtifacts[t.team] ? this.readyArtifact(t.team, "an") : null;
    if (seal) this.fire(seal);
    this.strike(u, s, [t], this.takeUlt(u), R.dashCritBonus, false, seal ? { scale: A.anDashDamage } : {});
    u.exposedUntil = this.tick + (s.mod.exposedTicks ?? R.exposedTicks); // Huyết Ảnh: lộ vị trí ngắn hơn
    if (s.mod.dashPierceNext) u.nextPierce = s.mod.dashPierceNext; // Phá Thiên Thương: đòn kế tiếp xuyên khiên
    // Huyết Ảnh: hạ gục bằng thân pháp thì ẩn thân (1 lần mỗi trận).
    if (t.curHp <= 0 && u.once.stealthKill > 0) {
      u.once.stealthKill = 0;
      u.stealthUntil = this.tick + (u.fx.stealthOnDashKill ?? 0);
    }
    if (seal) this.control(u, seal.a.power);
  }

  // Pháp bảo (tab Trang bị, phần 9). Chỉ gọi khi đội có pháp bảo, nên trận không có pháp bảo chạy y như cũ.

  /** Pháp bảo loại `kind` đầu tiên sẵn sàng của đội `team` (chủ còn sống, còn lần, hết hồi chiêu), theo id chủ rồi thứ tự ô. */
  private readyArtifact(team: number, kind: ArtifactKind, near?: (o: Unit) => boolean): { o: Unit; a: ArtifactState } | null {
    for (const o of this.teams[team]) {
      if (o.curHp <= 0 || o.artifacts.length === 0 || (near && !near(o))) continue;
      for (const a of o.artifacts) if (a.kind === kind && a.used < a.uses && this.tick >= a.readyTick) return { o, a };
    }
    return null;
  }

  private fire(r: { o: Unit; a: ArtifactState }): void {
    r.a.used++;
    r.a.readyTick = this.tick + r.a.cooldownTicks;
    const o = r.o;
    if (o.fx.artifactMana) o.mana = Math.min(o.manaMax, o.mana + mul(o.manaMax, o.fx.artifactMana)); // Cổ Tông mốc 4
  }

  /** Chuông: từ 2 đồng đội đang bị choáng thì giải khống chế cả đội (choáng, trói chân) và cho miễn khống chế. */
  private ringBell(team: 0 | 1): void {
    let held = 0;
    for (const x of this.teams[team]) if (x.curHp > 0 && this.tick < x.stunUntil) held++;
    if (held < A.chuongMinControlled) return;
    const r = this.readyArtifact(team, "chuong");
    if (!r) return;
    this.fire(r);
    for (const x of this.teams[team]) {
      if (x.curHp <= 0) continue;
      x.stunUntil = Math.min(x.stunUntil, this.tick);
      x.rootUntil = Math.min(x.rootUntil, this.tick);
      x.controlImmuneUntil = this.tick + r.a.power;
    }
  }

  /** Tháp: địch bắt đầu vận công diện rộng thì 3 đồng đội gần tâm chiêu nhất (kể cả chủ) nhận ít sát thương hơn từ chiêu đó. */
  private raiseTower(ch: Channel, team: number): void {
    const r = this.readyArtifact(team, "thap");
    if (!r) return;
    this.fire(r);
    const list = this.teams[team].filter((x) => x.curHp > 0);
    list.sort((a, b) => Math.abs(a.pos - ch.center) - Math.abs(b.pos - ch.center) || a.id - b.id);
    ch.guarded = list.slice(0, A.thapAllies).map((x) => x.id);
    ch.guardCut = r.a.power;
  }

  /** Luân: chiêu quét sắp trúng chủ nhân mà từ 3 kẻ địch cận chiến đứng sát chủ nhân thì cắt chiêu và đẩy lùi các kẻ đó. */
  private spinWheel(targets: Unit[]): boolean {
    for (const t of targets) {
      if (t.artifacts.length === 0) continue;
      const near = this.teams[1 - t.team].filter((e) => e.curHp > 0 && e.preferredRange <= A.adjacentRange && Math.abs(e.pos - t.pos) <= A.adjacentRange);
      if (near.length < A.luanMinEnemies) continue;
      const r = this.readyArtifact(t.team, "luan", (o) => o === t);
      if (!r) continue;
      this.fire(r);
      for (const e of near) {
        const dir = e.pos > t.pos ? 1 : e.pos < t.pos ? -1 : e.team === 1 ? 1 : -1;
        e.pos = clamp(e.pos + dir * r.a.power, 0, BATTLE.fieldLength);
      }
      return true;
    }
    return false;
  }

  /** Thuẫn chặn đòn cận chiến đơn chí mạng vào hàng trước; Châu: sau đòn tầm xa đầu vào hàng sau, 2 đòn tầm xa kế tiếp vào hàng sau giảm. */
  private blockHit(type: SkillType, t: Unit, dmg: number, crit: boolean): number {
    if (type === "can_don" && crit && t.row === 0) {
      const r = this.readyArtifact(t.team, "thuan");
      if (r) {
        this.fire(r);
        return Math.max(1, dmg - mul(dmg, r.a.power));
      }
    } else if (type === "tam_xa" && t.row === 1) {
      for (const o of this.teams[t.team]) {
        for (const a of o.artifacts) {
          if (a.kind === "chau" && a.charges > 0) {
            a.charges--;
            return Math.max(1, dmg - mul(dmg, a.power));
          }
        }
      }
      const r = this.readyArtifact(t.team, "chau");
      if (r) {
        this.fire(r);
        r.a.charges = A.chauHits;
      }
    }
    return dmg;
  }

  /** Kính: chủ nhân hoặc đồng đội kề bên trúng bùa chú thì phản một phần sát thương về người thi triển. */
  private reflectTalisman(u: Unit, t: Unit, dmg: number): void {
    if (u.curHp <= 0) return;
    const r = this.readyArtifact(t.team, "kinh", (o) => o === t || Math.abs(o.pos - t.pos) <= A.adjacentRange);
    if (!r) return;
    this.fire(r);
    this.hurt(u, Math.max(1, mul(dmg, r.a.power)));
  }

  /** Hồ lô: kẻ địch trong tầm vừa nhận khiên hộ thể thì thu một phần khiên đó về chủ nhân; mỗi lần hộ thể chỉ thu một mục tiêu. */
  private siphonShield(targets: Unit[]): void {
    for (const t of targets) {
      if (t.shield <= 0) continue;
      const r = this.readyArtifact(1 - t.team, "ho_lo", (o) => Math.abs(o.pos - t.pos) <= A.nearRange);
      if (!r) continue;
      this.fire(r);
      const taken = mul(t.shield, r.a.power);
      t.shield -= taken;
      const got = mul(taken, ONE + r.o.b.shieldTaken);
      if (got > r.o.shield) {
        r.o.shield = got;
        r.o.shieldUntil = this.tick + R.shieldTicks;
      }
      return;
    }
  }
}

/** Phần pháp bảo của bên bị đánh trong một lần ra chiêu. */
interface StrikeOpts {
  scale?: number; // nhân sát thương mọi mục tiêu (Ấn: đòn lướt còn 50%)
  guarded?: number[]; // id mục tiêu nhận ít hơn `guardCut` phần nghìn (Tháp, Phiên)
  guardCut?: number;
  noExecute?: number; // id mục tiêu không bị tuyệt sát (Phiên)
}

export function simulate(input: BattleInput): BattleResult {
  const b = new Battle(input);
  while (!b.finished) b.step();
  return b.result();
}

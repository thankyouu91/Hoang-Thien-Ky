// Ghép tàn quyển thành công pháp (GDD mục 9). Kết quả là chỉ số công pháp mà trận đấu dùng.
import { mul, ONE } from "./fixed.ts";
import { baseElement, parentOf, isOpposite, generatesEither, beatsEither, type Element } from "./elements.ts";
import {
  SKILL_SPECS, VARIANT_STATS, ELEMENT_STATS, ELEMENT_EFFECTS, GRADE_POW, COMBO, HARMONY_PAIRS,
  BASE_CRIT_PER_MILLE, LINH_EFFECT_POWER, type SkillType, type Variant, type ScrollStats,
} from "./config.ts";

/** Tàn quyển: 1 hệ, 1 loại chiêu, 1 biến thể, phẩm 1–10 */
export interface Scroll {
  element: Element;
  type: SkillType;
  variant: Variant;
  grade: number;
}

/** Hiệu ứng đặc trưng mang theo công pháp; `power` theo phần nghìn (1500 = Linh). */
export interface TechniqueEffect {
  element: Element;
  power: number;
}

export interface Technique {
  type: SkillType;
  element: Element; // hệ chủ quyển
  subElements: Element[];
  grade: number;
  damage: number; // sát thương D theo phần nghìn: 110000 = 110
  targets: number;
  critPerMille: number;
  cooldownTicks: number;
  manaCost: number;
  rangeBonus: number; // milli-ô
  combo: number; // hệ số tổ hợp t, phần nghìn
  effects: TechniqueEffect[];
  /** Tông người dùng đã phản bội (rules gắn vào); đánh người của tông đó chỉ gây 50% sát thương (GDD mục 6). */
  forsakenSect?: string;
}

/**
 * Hệ số tổ hợp giữa hệ chủ và một hệ phụ. Quy tắc tạm, thay bằng ma trận Excel khi có:
 * cùng hệ → đối cực → cặp tương hợp trong GDD → biến dị với hệ gốc → sinh/khắc Ngũ Hành sau khi quy về hệ gốc → trung tính.
 */
export function comboRelation(main: Element, sub: Element): { t: number; manaMul: number } {
  if (main === sub) return { t: COMBO.pure, manaMul: ONE };
  if (isOpposite(main, sub)) return { t: COMBO.polar, manaMul: COMBO.polarManaMul };
  for (const [a, b] of HARMONY_PAIRS) {
    if ((a === main && b === sub) || (a === sub && b === main)) return { t: COMBO.harmony, manaMul: ONE };
  }
  if (parentOf(main) === sub || parentOf(sub) === main) return { t: COMBO.harmony, manaMul: ONE };
  const a = baseElement(main), b = baseElement(sub);
  if (generatesEither(a, b)) return { t: COMBO.harmony, manaMul: ONE };
  if (beatsEither(a, b)) return { t: COMBO.clash, manaMul: ONE };
  return { t: COMBO.neutral, manaMul: ONE };
}

function scrollStats(s: Scroll): ScrollStats {
  const e = ELEMENT_STATS[s.element], v = VARIANT_STATS[s.variant];
  return { dmg: e.dmg + v.dmg, crit: e.crit + v.crit, cd: e.cd + v.cd, mana: e.mana + v.mana, range: e.range + v.range };
}

/** Ghép 1 chủ quyển với 1–2 phụ quyển. */
export function composeTechnique(main: Scroll, subs: Scroll[]): Technique {
  if (subs.length < 1 || subs.length > 2) throw new Error("Công pháp cần 1 chủ quyển và 1–2 phụ quyển");
  const all = [main, ...subs];
  for (const s of all) {
    if (!Number.isInteger(s.grade) || s.grade < 1 || s.grade > GRADE_POW.length) throw new Error(`Phẩm không hợp lệ: ${s.grade}`);
  }
  const spec = SKILL_SPECS[main.type];
  const grade = Math.min(...all.map((s) => s.grade)); // phẩm theo quyển thấp nhất
  const m = scrollStats(main);
  const sub = { dmg: 0, crit: 0, cd: 0, mana: 0, range: 0 };
  for (const s of subs) {
    const st = scrollStats(s);
    sub.dmg += st.dmg; sub.crit += st.crit; sub.cd += st.cd; sub.mana += st.mana; sub.range += st.range;
  }

  // Hai phụ quyển: lấy trung bình hệ số tổ hợp của hai quan hệ (giả định, GDD chỉ có một t).
  const rel = subs.map((s) => comboRelation(main.element, s.element));
  const t = Math.trunc(rel.reduce((acc, r) => acc + r.t, 0) / rel.length);
  const polar = rel.some((r) => r.manaMul !== ONE);

  // Phụ quyển góp 50% chỉ số (sát thương, chí mạng, hồi chiêu, mana).
  let damage = mul(100 * ONE, spec.k);
  damage = mul(damage, GRADE_POW[grade - 1]);
  damage = mul(damage, ONE + m.dmg + Math.trunc(sub.dmg / 2));
  damage = mul(damage, t);
  const critPerMille = BASE_CRIT_PER_MILLE + spec.critPerMille + m.crit + Math.trunc(sub.crit / 2);
  const cooldownTicks = Math.max(1, mul(spec.cooldownTicks, ONE + m.cd + Math.trunc(sub.cd / 2)));
  let manaCost = mul(spec.mana, ONE + m.mana + Math.trunc(sub.mana / 2));
  if (polar) manaCost = mul(manaCost, COMBO.polarManaMul);

  // Hiệu ứng: chủ quyển và mỗi phụ quyển góp 100%; trùng hệ thì giữ mức mạnh nhất.
  const effects: TechniqueEffect[] = [];
  for (const s of all) {
    const power = s.variant === "linh" ? LINH_EFFECT_POWER : ONE;
    const found = effects.find((e) => e.element === s.element);
    if (!found) effects.push({ element: s.element, power });
    else if (power > found.power) found.power = power;
  }

  return {
    type: main.type,
    element: main.element,
    subElements: subs.map((s) => s.element),
    grade,
    damage,
    targets: spec.targets,
    critPerMille,
    cooldownTicks,
    manaCost,
    rangeBonus: m.range + sub.range,
    combo: t,
    effects,
  };
}

/** Giá trị thực của một hiệu ứng sau khi nhân sức hiệu ứng. */
export function effectValue(e: TechniqueEffect): { value: number; ticks?: number } {
  const base = ELEMENT_EFFECTS[e.element];
  return { value: mul(base.value, e.power), ticks: base.ticks };
}

/** Hiệu ứng của một công pháp gom theo loại, 0 = không có. Tỷ lệ theo phần nghìn, thời gian theo tick, khoảng cách theo milli-ô. */
export interface TechniqueFx {
  armorPen: number; // Kim: xuyên giáp
  root: number; // Mộc: trói chân, tick
  slow: number; // Thủy: làm chậm
  slowTicks: number;
  burn: number; // Hỏa: thiêu đốt, phần nghìn sát thương đòn đánh mỗi giây
  burnTicks: number;
  selfShield: number; // Thổ: khiên bản thân, phần nghìn máu tối đa, mỗi lần ra chiêu
  paralyze: number; // Lôi: tê liệt khi chí mạng, tick
  knockback: number; // Phong: đẩy lùi
  healOfDamage: number; // Quang: hồi máu theo sát thương gây ra
  lifesteal: number; // Âm lãnh: hút máu
  resistPen: number; // Cực dương: xuyên kháng
  healCut: number; // Cực âm: giảm hồi máu của mục tiêu
  healCutTicks: number;
  freezeChance: number; // Cực hàn: tỷ lệ đóng băng
  freezeTicks: number;
}

export function techniqueFx(tech: Technique): TechniqueFx {
  const fx: TechniqueFx = {
    armorPen: 0, root: 0, slow: 0, slowTicks: 0, burn: 0, burnTicks: 0, selfShield: 0, paralyze: 0, knockback: 0,
    healOfDamage: 0, lifesteal: 0, resistPen: 0, healCut: 0, healCutTicks: 0, freezeChance: 0, freezeTicks: 0,
  };
  for (const e of tech.effects) {
    const { value, ticks = 0 } = effectValue(e);
    switch (e.element) {
      case "kim": fx.armorPen = value; break;
      case "moc": fx.root = value; break;
      case "thuy": fx.slow = value; fx.slowTicks = ticks; break;
      case "hoa": fx.burn = value; fx.burnTicks = ticks; break;
      case "tho": fx.selfShield = value; break;
      case "loi": fx.paralyze = value; break;
      case "phong": fx.knockback = value; break;
      case "quang": fx.healOfDamage = value; break;
      case "am_lanh": fx.lifesteal = value; break;
      case "cuc_duong": fx.resistPen = value; break;
      case "cuc_am": fx.healCut = value; fx.healCutTicks = ticks; break;
      case "cuc_han": fx.freezeChance = value; fx.freezeTicks = ticks; break;
    }
  }
  return fx;
}

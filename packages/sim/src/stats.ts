// Chỉ số cộng thêm của nhân vật trong trận: buff luyện đúng hệ (GDD mục 9) và tài năng (GDD mục 6).
import { mul, ONE } from "./fixed.ts";
import { ELEMENTS, type Element } from "./elements.ts";
import { ROOT_BUFFS, TALENT_RULES as T, type BuffStat, type Talent } from "./config.ts";
import type { Technique } from "./technique.ts";

/** Mọi số theo phần nghìn, trừ các trường ghi rõ đơn vị. */
export interface UnitBonuses extends Record<BuffStat, number> {
  melee: number; // cộng sát thương cận chiến và khiên hộ thể
  ranged: number; // cộng sát thương tầm xa và diện rộng
  extraTalismans: number; // số lần bùa chú thêm
  formationCut: number; // bày trận nhanh hơn
  executeBonus: number; // tuyệt sát cộng thêm
  stealthTicks: number; // ẩn thân đầu trận, tick
  dashCooldownCut: number; // thân pháp hồi chiêu nhanh hơn
}

/** Mức buff mỗi hệ: 1000 nếu linh căn trùng hệ chủ quyển của một công pháp đang mang, 500 nếu chỉ trùng hệ phụ; lấy mức cao nhất. */
export function rootBuffLevels(roots: Element[], techniques: Technique[]): Partial<Record<Element, number>> {
  const levels: Partial<Record<Element, number>> = {};
  for (const t of techniques) {
    for (const e of roots) {
      const lv = t.element === e ? ONE : t.subElements.includes(e) ? ONE / 2 : 0;
      if (lv > (levels[e] ?? 0)) levels[e] = lv;
    }
  }
  return levels;
}

export function unitBonuses(roots: Element[], talents: Talent[], techniques: Technique[]): UnitBonuses {
  const b: UnitBonuses = {
    hp: 0, atk: 0, def: 0, manaMax: 0, damage: 0, critBonus: 0, critDamage: 0, attackSpeed: 0, cooldownCut: 0,
    healPower: 0, healTaken: 0, lifesteal: 0, resistPen: 0, dot: 0, controlTime: 0,
    shieldTaken: 0, monsterDamage: 0, armorPen: 0, paralyzeTicks: 0, formationTicks: 0, channelTicks: 0,
    melee: 0, ranged: 0, extraTalismans: 0, formationCut: 0, executeBonus: 0, stealthTicks: 0, dashCooldownCut: 0,
  };
  const levels = rootBuffLevels(roots, techniques);
  for (const e of ELEMENTS) {
    const lv = levels[e];
    if (lv) b[ROOT_BUFFS[e].stat] += mul(ROOT_BUFFS[e].value, lv);
  }
  for (const t of new Set(talents)) {
    switch (t) {
      case "tu_the": b.hp += T.tuTheHp; b.def += T.tuTheDef; b.melee += T.tuTheMelee; break;
      case "tu_phap": b.ranged += T.tuPhapRanged; b.manaMax += T.tuPhapMana; b.extraTalismans += T.tuPhapTalismans; break;
      case "tu_tran": b.formationCut += T.tuTranCastCut; b.executeBonus += T.tuTranExecute; break;
      case "sat_thu":
        b.critBonus += T.satThuCrit; b.critDamage += T.satThuCritDamage;
        b.stealthTicks = T.satThuStealthTicks; b.dashCooldownCut += T.satThuDashCooldownCut;
        break;
      case "tu_duoc": b.healTaken += T.tuDuocHealTaken; break;
      // Tu đan, Tu rèn, Tu kim tiền: không có tác dụng trong trận.
    }
  }
  return b;
}

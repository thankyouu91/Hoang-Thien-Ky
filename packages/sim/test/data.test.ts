// Số trong config.ts phải khớp file số liệu data/he_thong (Excel xuất ra json/ bằng tools/data/xuat.ts).
// Lệch thì sửa một bên cho khớp: sửa Excel rồi xuất lại, hoặc sửa config.ts.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  ELEMENTS, SKILL_TYPES, VARIANTS, SKILL_SPECS, ALLY_SKILLS, VARIANT_STATS, LINH_EFFECT_POWER, ELEMENT_STATS, ELEMENT_EFFECTS,
  ROOT_BUFFS, SKILL_RULES, CAST_FLOOR, ARTIFACT_RULES, BATTLE, UNIT_CURVE, TALENT_RULES, GRADE_POW, BASE_CRIT_PER_MILLE, RESIST_CAP, COUNTER_FLOOR, COMBO,
  elementMultiplier, comboRelation,
} from "../src/index.ts";

const data = (file: string): any => JSON.parse(readFileSync(new URL(`../../../data/he_thong/json/${file}`, import.meta.url), "utf8"));

test("loại chiêu khớp loai_chieu.json", () => {
  const rows = data("loai_chieu.json");
  for (const t of SKILL_TYPES) {
    const s = SKILL_SPECS[t], r = rows[t];
    for (const key of ["k", "targets", "cooldownTicks", "critPerMille", "mana", "range", "radius"] as const) assert.equal(s[key], r[key], `${t}.${key}`);
    assert.equal(ALLY_SKILLS.includes(t), r.ally, `${t}.ally`);
  }
});

test("biến thể khớp bien_the.json", () => {
  const rows = data("bien_the.json");
  for (const v of VARIANTS) {
    for (const key of ["dmg", "cd", "crit", "mana"] as const) assert.equal(VARIANT_STATS[v][key], rows[v][key], `${v}.${key}`);
    assert.equal(v === "linh" ? LINH_EFFECT_POWER : 1000, rows[v].effectPower, `${v}.effectPower`);
  }
});

test("hệ: chỉ số kèm, hiệu ứng, buff luyện đúng hệ khớp he.json", () => {
  const rows = data("he.json");
  for (const e of ELEMENTS) {
    const r = rows[e];
    for (const key of ["dmg", "crit", "cd", "mana", "range"] as const) assert.equal(ELEMENT_STATS[e][key], r.stats[key], `${e}.stats.${key}`);
    assert.equal(ELEMENT_EFFECTS[e].value, r.effect.value, `${e}.effect.value`);
    assert.equal(ELEMENT_EFFECTS[e].ticks, r.effect.ticks, `${e}.effect.ticks`);
    assert.deepEqual({ stat: ROOT_BUFFS[e].stat, value: ROOT_BUFFS[e].value }, { stat: r.rootBuff.stat, value: r.rootBuff.value }, `${e}.rootBuff`);
  }
});

test("khắc chế 12 × 12 khớp khac_che.json", () => {
  const rows = data("khac_che.json");
  for (const a of ELEMENTS) for (const d of ELEMENTS) assert.equal(elementMultiplier(a, d), rows[a][d], `${a} đánh ${d}`);
});

test("tham số trận đấu khớp tham_so.json", () => {
  const p = data("tham_so.json");
  const groups: [string, Record<string, unknown>][] = [["SKILL_RULES", SKILL_RULES], ["CAST_FLOOR", CAST_FLOOR], ["ARTIFACT_RULES", ARTIFACT_RULES], ["BATTLE", BATTLE], ["UNIT_CURVE", UNIT_CURVE], ["TALENT_RULES", TALENT_RULES]];
  for (const [name, values] of groups) {
    assert.deepEqual(Object.keys(p[name]).sort(), Object.keys(values).sort(), `${name}: tên khóa`);
    for (const key of Object.keys(values)) assert.equal(values[key], p[name][key], `${name}.${key}`);
  }
  assert.equal(BASE_CRIT_PER_MILLE, p.cong_phap.baseCrit);
  assert.equal(RESIST_CAP, p.cong_phap.resistCap);
  assert.equal(COUNTER_FLOOR, p.cong_phap.counterFloor);
});

test("phẩm: hệ số 1,25^(phẩm − 1) khớp pham.json", () => {
  const rows = data("pham.json");
  assert.deepEqual(GRADE_POW, rows.map((r: { power: number }) => r.power));
});

test("hệ số tổ hợp khớp quan_he_to_hop.json; quan hệ 12 × 12 khớp to_hop.json", () => {
  const rel = data("quan_he_to_hop.json");
  assert.equal(COMBO.pure, rel.thuan.t);
  assert.equal(COMBO.harmony, rel.tuong_sinh.t);
  assert.equal(COMBO.harmony, rel.tuong_hop.t);
  assert.equal(COMBO.neutral, rel.trung_tinh.t);
  assert.equal(COMBO.clash, rel.tuong_khac.t);
  assert.equal(COMBO.polar, rel.doi_cuc.t);
  assert.equal(COMBO.polarManaMul, rel.doi_cuc.manaMul);
  const combos = data("to_hop.json").combo;
  for (const a of ELEMENTS) for (const b of ELEMENTS) assert.deepEqual(comboRelation(a, b), combos[a][b], `${a} + ${b}`);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { Battle, baseStats, composeTechnique, type UnitSpec } from "@ktlp/sim";
import { gearStats, withGear, kieuInfo, maxInlayLines, type EquipItem, type InlayLine } from "../src/index.ts";

const item = (kieu: string, extra: Partial<EquipItem> = {}): EquipItem => ({ kieu, nac: 0, doBen: 100, biCanh: 0, kham: [], ...extra });
const gem = (he: "kim" | "hoa" | "loi", cap: number): InlayLine => ({ loai: "ngoc", he, cap });
const LV = 100; // chỉ số chuẩn cấp 100: máu 7.140, công lực 500, phòng thủ 500

test("kiểu trang bị cho ô và độ hiếm", () => {
  assert.deepEqual([kieuInfo("TB-KI-001").o, kieuInfo("TB-KI-001").doHiem], ["vu_khi", "luc"]);
  assert.deepEqual([kieuInfo("TB-AO-058").o, kieuInfo("TB-AO-058").doHiem], ["ao", "do"]);
  assert.throws(() => kieuInfo("TB-XX-999"));
});

test("vũ khí lục +0: công lực 8% chỉ số chuẩn, sát thương chí mạng +4%", () => {
  const g = gearStats([item("TB-KI-001")], LV, []);
  assert.equal(g.atk, 40);
  assert.equal(g.bonuses.critDamage, 40);
});

test("vũ khí đỏ +30 rơi bí cảnh (+8%): × 1,55 × 1,9 × 1,08", () => {
  const g = gearStats([item("TB-KI-058", { nac: 30, biCanh: 80 })], LV, []);
  assert.equal(g.atk, 127); // 500 × 8% × 3,18
  assert.equal(g.bonuses.critDamage, 127);
});

test("mũ: máu theo chỉ số chuẩn, mana theo mana tối đa chuẩn", () => {
  const g = gearStats([item("TB-MU-001")], LV, []);
  assert.equal(g.hp, 285); // 7.140 × 4%
  assert.equal(g.manaMax, 12); // 300 × 4%
});

test("độ bền 0 thì món không cộng gì, kể cả ngọc", () => {
  const g = gearStats([item("TB-KI-001", { doBen: 0, kham: [gem("kim", 5)] })], LV, []);
  assert.deepEqual(g, { hp: 0, atk: 0, def: 0, manaMax: 0, bonuses: {}, resist: {}, elementDamage: {} });
});

test("ngọc: ô công cộng sát thương hệ, ô thủ cộng kháng hệ, trùng linh căn ×1,2", () => {
  const weapon = item("TB-KI-001", { kham: [gem("kim", 5)] });
  assert.equal(gearStats([weapon], LV, []).elementDamage.kim, 75);
  assert.equal(gearStats([weapon], LV, ["kim"]).elementDamage.kim, 90);
  const armor = item("TB-AO-001", { kham: [gem("hoa", 3)] });
  assert.deepEqual(gearStats([armor], LV, []).resist, { hoa: 30 });
});

test("dòng khảm theo độ hiếm, đồ bí cảnh thêm 2, tối đa 5", () => {
  assert.equal(maxInlayLines(item("TB-KI-001")), 1);
  assert.equal(maxInlayLines(item("TB-KI-001", { biCanh: 50 })), 3);
  assert.equal(maxInlayLines(item("TB-KI-058", { biCanh: 50 })), 5);
  assert.throws(() => gearStats([item("TB-KI-001", { kham: [gem("kim", 1), gem("kim", 1)] })], LV, []));
});

test("món sai thì báo lỗi: trùng ô, nấc, thưởng bí cảnh, cấp ngọc", () => {
  assert.throws(() => gearStats([item("TB-KI-001"), item("TB-KI-025")], LV, []));
  assert.throws(() => gearStats([item("TB-KI-001", { nac: 51 })], LV, []));
  assert.throws(() => gearStats([item("TB-KI-001", { biCanh: 30 })], LV, []));
  assert.throws(() => gearStats([item("TB-KI-001", { kham: [gem("kim", 11)] })], LV, []));
});

test("bộ đỏ +30 rơi bí cảnh đủ 7 ô: công lực, máu, phòng thủ mỗi thứ cộng khoảng 35–40%", () => {
  const full = ["TB-KI-058", "TB-MU-058", "TB-AO-058", "TB-DA-058", "TB-BT-058", "TB-GI-058", "TB-NB-058"].map((k) => item(k, { nac: 30, biCanh: 80 }));
  const g = gearStats(full, LV, []);
  const s = baseStats(LV);
  for (const [name, add, base] of [["công lực", g.atk, s.atk], ["máu", g.hp, s.hp], ["phòng thủ", g.def, s.def]] as const) {
    const pct = Math.round((add * 1000) / base);
    assert.ok(pct >= 350 && pct <= 400, `${name} +${pct / 10}%`);
  }
});

test("áp bộ đồ vào đơn vị trong trận", () => {
  const tech = composeTechnique({ element: "kim", type: "can_don", variant: "bao", grade: 1 }, [{ element: "kim", type: "can_don", variant: "ben", grade: 1 }]);
  const spec: UnitSpec = { id: 1, level: LV, element: "kim", row: 0, ...baseStats(LV), techniques: [tech] };
  const geared = withGear(spec, [item("TB-KI-001", { kham: [gem("kim", 5)] }), item("TB-MU-001")]);
  assert.equal(geared.atk, 540);
  assert.equal(geared.hp, baseStats(LV).hp + 285);
  assert.equal(geared.manaMax, 312);
  const b = new Battle({ seed: 1, teamA: [geared], teamB: [{ ...spec, id: 101 }] });
  const u = b.units.find((x) => x.id === 1)!;
  assert.equal(u.slots[0].bonus, 90); // ngọc Kim cấp 5 trùng linh căn Kim
  assert.equal(u.b.critDamage, 120 + 40); // buff Kim (luyện đúng hệ) + sát thương chí mạng của vũ khí
});

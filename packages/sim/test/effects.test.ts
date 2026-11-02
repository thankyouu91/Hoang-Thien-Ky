import { test } from "node:test";
import assert from "node:assert/strict";
import {
  Battle, BATTLE, composeTechnique, hitDamage, mul, techniqueFx, unitBonuses,
  type Element, type SkillType, type Technique, type UnitSpec, type Unit, type BattleInput,
} from "../src/index.ts";

const tech = (type: SkillType, element: Element, sub: Element = element): Technique =>
  composeTechnique({ element, type, variant: "bao", grade: 1 }, [{ element: sub, type, variant: "ben", grade: 1 }]);
const unit = (id: number, row: 0 | 1, techniques: Technique[], extra: Partial<UnitSpec> = {}): UnitSpec => ({
  id, level: 50, element: "moc", hp: 20000, atk: 1000, def: 0, row, techniques, ...extra,
});
/** Bia đỡ: không đủ mana nên không ra chiêu, chỉ đi tới cận chiến; máu rất nhiều. */
const inert = (id: number, extra: Partial<UnitSpec> = {}): UnitSpec => unit(id, 0, [tech("can_don", "kim")], { hp: 1_000_000, manaMax: 0, ...extra });
const get = (b: Battle, id: number): Unit => b.units.find((u) => u.id === id)!;
/** Chạy tới lần ra chiêu đầu tiên của đơn vị 1, trả về trận và tick lúc đó. */
const firstHit = (input: BattleInput) => {
  const b = new Battle(input, true);
  while (!b.events.some((e) => e.unitId === 1)) b.step();
  return { b, tick: b.events.find((e) => e.unitId === 1)!.tick };
};
const steps = (b: Battle, n: number) => {
  for (let i = 0; i < n; i++) b.step();
};

// Hiệu ứng đặc trưng 12 hệ (GDD mục 9)

test("Kim xuyên giáp 10%, Cực dương xuyên kháng 10%", () => {
  const t = tech("can_don", "kim");
  assert.equal(techniqueFx(t).armorPen, 100);
  assert.equal(techniqueFx(tech("can_don", "cuc_duong")).resistPen, 100);
  const a = { atk: 1000, level: 50 };
  const d = { element: "moc" as Element, level: 50, def: 1000 };
  assert.ok(hitDamage(a, t, d, false, false, { armorPen: 100 }) > hitDamage(a, t, d, false, false));
  const bare = { ...d, def: 0 };
  const x = hitDamage(a, t, bare, false, false);
  assert.equal(hitDamage(a, t, bare, false, false, { armorPen: 100 }), x); // không có giáp thì không đổi
  assert.equal(hitDamage(a, t, { ...bare, resist: { kim: 200 } }, false, false), mul(x, 800)); // kháng 20%
  assert.equal(hitDamage(a, t, { ...bare, resist: { kim: 200 } }, false, false, { resistPen: 500 }), mul(x, 900));
  assert.equal(hitDamage(a, t, { ...bare, resist: { thuy: 200 } }, false, false), x); // kháng hệ khác không tính
});

test("Mộc trói chân 1 s: không đi được", () => {
  const { b, tick } = firstHit({ seed: 1, teamA: [unit(1, 1, [tech("tam_xa", "moc")])], teamB: [inert(101)] });
  const t = get(b, 101);
  assert.equal(t.rootUntil, tick + 20);
  const pos = t.pos;
  steps(b, 19);
  assert.equal(t.pos, pos);
});

test("Thủy làm chậm 20% trong 2 s", () => {
  const { b, tick } = firstHit({ seed: 1, teamA: [unit(1, 1, [tech("tam_xa", "thuy")])], teamB: [inert(101)] });
  const t = get(b, 101);
  assert.equal(t.slow, 200);
  assert.equal(t.slowUntil, tick + 40);
  const pos = t.pos;
  b.step();
  assert.equal(pos - t.pos, 80); // đi 80 thay vì 100 milli-ô mỗi tick
});

test("Hỏa thiêu đốt 10% sát thương mỗi giây trong 3 s", () => {
  const { b } = firstHit({ seed: 1, teamA: [unit(1, 1, [tech("bua_chu", "hoa")])], teamB: [inert(101)] });
  const t = get(b, 101);
  const dmg = t.hp - t.curHp;
  const burn = mul(dmg, 100);
  assert.equal(t.burn, burn);
  const after = t.curHp;
  steps(b, 60);
  assert.equal(t.curHp, after - 3 * burn);
  steps(b, 20);
  assert.equal(t.curHp, after - 3 * burn); // hết 3 s thì thôi cháy
});

test("Thổ: mỗi lần ra chiêu được khiên 5% máu tối đa", () => {
  const { b } = firstHit({ seed: 1, teamA: [unit(1, 0, [tech("can_don", "tho")])], teamB: [inert(101)] });
  assert.equal(get(b, 1).shield, 1000); // 5% của 20.000
});

test("Lôi tê liệt 0,5 s khi chí mạng", () => {
  let stunned = 0;
  for (let seed = 1; seed <= 200; seed++) {
    const { b, tick } = firstHit({ seed, teamA: [unit(1, 0, [tech("can_don", "loi")])], teamB: [inert(101)] });
    const t = get(b, 101);
    if (t.stunUntil > tick) {
      stunned++;
      assert.equal(t.stunUntil, tick + 10);
    }
  }
  assert.ok(stunned > 0 && stunned < 60, `tê liệt ${stunned}/200`); // chí mạng 9,5%
});

test("Phong đẩy lùi 1 ô với chiêu đánh xa; chiêu cận chiến không đẩy", () => {
  const posAfterFirstHit = (type: SkillType, row: 0 | 1) => {
    const b = new Battle({ seed: 1, teamA: [unit(1, row, [tech(type, "phong")])], teamB: [inert(101)] }, true);
    let pos = 0;
    while (!b.events.some((e) => e.unitId === 1)) {
      pos = get(b, 101).pos;
      b.step();
    }
    return get(b, 101).pos - pos;
  };
  assert.equal(posAfterFirstHit("tam_xa", 1), 1000 - 100); // bị đẩy 1 ô, rồi tự đi lại 1/10 ô trong lượt của mình
  assert.ok(posAfterFirstHit("can_don", 0) <= 0); // không bị đẩy ra khỏi tầm cận chiến
});

test("Quang hồi máu 2%, Âm lãnh hút máu 3% sát thương gây ra", () => {
  for (const [element, rate] of [["quang", 20], ["am_lanh", 30]] as const) {
    const b = new Battle({ seed: 1, teamA: [unit(1, 0, [tech("can_don", element)])], teamB: [inert(101)] }, true);
    get(b, 1).curHp = 10000;
    while (!b.events.some((e) => e.unitId === 1)) b.step();
    const t = get(b, 101);
    assert.equal(get(b, 1).curHp, 10000 + mul(t.hp - t.curHp, rate), element);
  }
});

test("Cực âm giảm 30% hồi máu của mục tiêu trong 3 s", () => {
  const { b, tick } = firstHit({ seed: 1, teamA: [unit(1, 0, [tech("can_don", "cuc_am")])], teamB: [inert(101)] });
  assert.equal(get(b, 101).healCut, 300);
  assert.equal(get(b, 101).healCutUntil, tick + 60);
});

test("Cực hàn 8% đóng băng 1 s", () => {
  let frozen = 0;
  for (let seed = 1; seed <= 300; seed++) {
    const { b, tick } = firstHit({ seed, teamA: [unit(1, 0, [tech("can_don", "cuc_han")])], teamB: [inert(101)] });
    const t = get(b, 101);
    if (t.stunUntil > tick) {
      frozen++;
      assert.equal(t.stunUntil, tick + 20);
    }
  }
  assert.ok(frozen >= 8 && frozen <= 45, `đóng băng ${frozen}/300`);
});

// Buff luyện đúng hệ (GDD mục 9)

test("buff linh căn: trùng hệ chủ quyển đủ, trùng hệ phụ một nửa, mỗi hệ một lần", () => {
  assert.equal(unitBonuses(["tho"], [], [tech("can_don", "tho")]).hp, 120);
  assert.equal(unitBonuses(["tho"], [], [tech("can_don", "kim", "tho")]).hp, 60);
  assert.equal(unitBonuses(["tho"], [], [tech("can_don", "tho"), tech("tam_xa", "tho")]).hp, 120);
  assert.equal(unitBonuses(["kim"], [], [tech("can_don", "tho")]).hp, 0);
  const two = unitBonuses(["loi", "tho"], [], [tech("can_don", "loi", "tho")]);
  assert.equal(two.attackSpeed, 80);
  assert.equal(two.hp, 60);
});

test("buff linh căn trong trận: Thổ máu +12%, Phong hồi chiêu −10%, Lôi đánh nhanh 8%", () => {
  const tho = new Battle({ seed: 1, teamA: [unit(1, 0, [tech("can_don", "tho")], { element: "tho" })], teamB: [inert(101)] });
  assert.equal(get(tho, 1).hp, 22400);
  const pt = tech("can_don", "phong");
  assert.equal(pt.cooldownTicks, 18); // chỉ số kèm của Phong: 20 × (1 − 0,05 − 0,025)
  const phong = new Battle({ seed: 1, teamA: [unit(1, 0, [pt], { element: "phong" })], teamB: [inert(101)] });
  assert.equal(get(phong, 1).slots[0].cooldown, 16); // buff linh căn −10%
  const loi = new Battle({ seed: 1, teamA: [unit(1, 0, [tech("can_don", "loi")], { element: "loi" })], teamB: [inert(101)] }, true);
  while (loi.events.filter((e) => e.unitId === 1).length < 3) loi.step();
  const [e1, e2, e3] = loi.events.filter((e) => e.unitId === 1);
  assert.equal(e2.tick - e1.tick, 19); // 20 tick hồi chiêu ÷ 1,08, làm tròn lên
  assert.equal(e3.tick - e2.tick, 19);
});

// Tài năng (GDD mục 6)

test("Tu thể: máu +15%, phòng thủ +10%, cộng dồn với buff Thổ", () => {
  const b = new Battle({ seed: 1, teamA: [unit(1, 0, [tech("can_don", "tho")], { element: "tho", talents: ["tu_the"], def: 1000 })], teamB: [inert(101)] });
  assert.equal(get(b, 1).hp, 25400); // 20.000 × 1,27
  assert.equal(get(b, 1).def, 1100);
});

test("Tu pháp: bùa chú 4 lần, mana +10%", () => {
  const b = new Battle({ seed: 1, teamA: [unit(1, 1, [tech("bua_chu", "kim")], { talents: ["tu_phap"] })], teamB: [inert(101)] }, true);
  assert.equal(get(b, 1).manaMax, mul(BATTLE.manaMax, 1100) * 1000);
  while (!b.finished) b.step();
  assert.equal(b.events.filter((e) => e.unitId === 1).length, 4);
});

test("Tu trận: bày trận 3,5 s, tuyệt sát +5%", () => {
  const { b } = firstHit({ seed: 1, teamA: [unit(1, 0, [tech("tran_phap", "kim")], { talents: ["tu_tran"] })], teamB: [inert(101)] });
  const e = b.events.find((e) => e.unitId === 1)!;
  assert.equal(e.tick - e.startTick, 70);
  assert.equal(get(b, 1).b.executeBonus, 50);
});

test("Sát thủ: ẩn thân 3 s đầu trận, chí mạng +10%, thân pháp hồi chiêu −20%", () => {
  const b = new Battle(
    { seed: 1, teamA: [unit(1, 0, [tech("than_phap", "kim"), tech("can_don", "kim")], { talents: ["sat_thu"] })], teamB: [unit(101, 1, [tech("tam_xa", "kim")])] },
    true,
  );
  const a = get(b, 1);
  assert.equal(a.b.critBonus, 100);
  assert.equal(a.b.critDamage, 200);
  assert.equal(a.slots[0].cooldown, 128); // 160 × 0,8
  while (!b.events.some((e) => e.unitId === 101)) b.step();
  assert.ok(b.events.find((e) => e.unitId === 101)!.tick >= 60);
});

test("Tu dược hồi máu nhận +10%; Tu đan, Tu rèn, Tu kim tiền không đổi chỉ số trận", () => {
  assert.equal(unitBonuses(["kim"], ["tu_duoc"], []).healTaken, 100);
  const none = unitBonuses(["kim"], [], []);
  for (const t of ["tu_dan", "tu_ren", "tu_kim_tien"] as const) assert.deepEqual(unitBonuses(["kim"], [t], []), none);
});

test("tối đa 2 tài năng", () => {
  assert.throws(() => new Battle({ seed: 1, teamA: [unit(1, 0, [tech("can_don", "kim")], { talents: ["tu_the", "tu_phap", "tu_tran"] })], teamB: [inert(101)] }));
});

// Phản bội tông môn (GDD mục 6)

test("công pháp của tông đã phản bội đánh người tông đó chỉ còn 50% sát thương", () => {
  const loss = (forsakenSect: string | undefined, targetSect: string) => {
    const t = { ...tech("can_don", "kim"), forsakenSect };
    const { b } = firstHit({ seed: 1, teamA: [unit(1, 0, [t])], teamB: [inert(101, { sectId: targetSect })] });
    const target = get(b, 101);
    return target.hp - target.curHp;
  };
  const normal = loss(undefined, "t");
  assert.equal(loss("t", "x"), normal); // người tông khác: đủ sát thương
  assert.equal(loss("t", "t"), mul(normal, 500));
});

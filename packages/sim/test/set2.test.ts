import { test } from "node:test";
import assert from "node:assert/strict";
import {
  Battle, composeTechnique, hitDamage, mul, simulate, HIDDEN_RULES, DAMAGE_CUT_CAP,
  type BattleInput, type Element, type SkillType, type Technique, type Unit, type UnitSpec,
} from "../src/index.ts";

// Set đồ 2.0 (tab Trang bị, phần 14): thủ ngoại, thủ nội; 9 chỉ số mới; dòng ẩn của trang sức.

const tech = (type: SkillType, element: Element = "kim"): Technique =>
  composeTechnique({ element, type, variant: "bao", grade: 1 }, [{ element, type, variant: "ben", grade: 1 }]);
const unit = (id: number, row: 0 | 1, techniques: Technique[], extra: Partial<UnitSpec> = {}): UnitSpec => ({
  id, level: 50, element: "moc", hp: 20000, atk: 1000, def: 0, row, techniques, ...extra,
});
const inert = (id: number, row: 0 | 1 = 0, extra: Partial<UnitSpec> = {}): UnitSpec =>
  unit(id, row, [tech("can_don")], { hp: 1_000_000, manaMax: 0, ...extra });
const get = (b: Battle, id: number): Unit => b.units.find((u) => u.id === id)!;
const place = (b: Battle, pos: Record<number, number>) => {
  for (const id of Object.keys(pos)) {
    const u = b.units.find((x) => x.id === Number(id));
    if (u) u.pos = pos[Number(id)];
  }
};
const loss = (b: Battle, id: number) => get(b, id).hp - get(b, id).curHp;
const noCrit = { critBonus: -2000 };
const castNow = (input: BattleInput, setup: (b: Battle) => void = () => {}): Battle => {
  const b = new Battle(input, true);
  setup(b);
  const u = get(b, 1);
  u.slots[0].cd = 0;
  u.mana = u.manaMax;
  b.step();
  return b;
};
const hit = (a: Partial<UnitSpec> = {}, t: Partial<UnitSpec> = {}, type: SkillType = "can_don") =>
  castNow({ seed: 1, teamA: [unit(1, 0, [tech(type)], { bonuses: noCrit, ...a })], teamB: [inert(101, 0, t)] },
    (x) => place(x, { 1: 5000, 101: 5500 }));

test("thủ ngoại chặn đòn ngoại, thủ nội chặn đòn nội; không có thì dùng phòng thủ chung", () => {
  const a = { atk: 1000, level: 50 };
  const d = { element: "moc" as Element, level: 50, def: 1000 };
  const split = { ...d, defOuter: 3000, defInner: 0 };
  const melee = tech("can_don");
  const aoe = tech("dien_rong");
  assert.equal(hitDamage(a, melee, { ...d, defOuter: 1000, defInner: 1000 }, false, false), hitDamage(a, melee, d, false, false));
  assert.ok(hitDamage(a, melee, split, false, false) < hitDamage(a, melee, d, false, false));
  assert.ok(hitDamage(a, aoe, split, false, false) > hitDamage(a, aoe, d, false, false));
  assert.equal(hitDamage(a, aoe, split, false, false), hitDamage(a, aoe, { ...d, def: 0 }, false, false));
  // Xuyên giáp áp vào đúng loại phòng thủ của đòn.
  assert.equal(hitDamage(a, melee, split, false, false, { armorPen: 500 }), hitDamage(a, melee, { ...d, def: 1500 }, false, false));
});

test("không đồ: thủ ngoại = thủ nội = phòng thủ; đồ cộng thủ ngoại, thủ nội riêng trên phòng thủ gốc", () => {
  const b = new Battle({ seed: 1, teamA: [inert(1, 0, { def: 800 })], teamB: [inert(101, 0, { def: 800, bonuses: { def: 100, defOuter: 250, defInner: 50 } })] });
  assert.deepEqual([get(b, 1).def, get(b, 1).defOuter, get(b, 1).defInner], [800, 800, 800]);
  assert.deepEqual([get(b, 101).def, get(b, 101).defOuter, get(b, 101).defInner], [880, 1080, 920]);
});

test("giảm mana thi triển, sát thương chiêu nội", () => {
  const b = new Battle({
    seed: 1,
    teamA: [unit(1, 0, [tech("can_don"), tech("dien_rong")], { bonuses: { manaCostCut: 200, innerDamage: 40 } })],
    teamB: [unit(101, 0, [tech("can_don"), tech("dien_rong")])],
  });
  const [m0, a0] = get(b, 101).slots;
  const [m1, a1] = get(b, 1).slots;
  assert.deepEqual([m1.cost, a1.cost], [mul(m0.cost, 800), mul(a0.cost, 800)]);
  assert.deepEqual([m1.bonus - m0.bonus, a1.bonus - a0.bonus], [0, 40]);
});

test("giảm sát thương nhận sau phòng thủ; phản đòn chỉ cận chiến", () => {
  const base = hit();
  const cut = hit({}, { bonuses: { damageTakenCut: 200 } });
  assert.equal(loss(cut, 101), loss(base, 101) - mul(loss(base, 101), 200));
  const refl = hit({}, { bonuses: { reflect: 100 } });
  assert.equal(loss(refl, 1), mul(loss(refl, 101), 100));
  const far = castNow({ seed: 1, teamA: [unit(1, 0, [tech("tam_xa")], { bonuses: noCrit })], teamB: [inert(101, 0, { bonuses: { reflect: 100 } })] },
    (x) => place(x, { 1: 3000, 101: 6000 }));
  assert.ok(loss(far, 101) > 0);
  assert.equal(loss(far, 1), 0);
});

test("hút mana theo mana tối đa của mục tiêu; hút máu theo sát thương gây ra", () => {
  const b = hit({ bonuses: { ...noCrit, manaDrain: 10 } }, { manaMax: 1000 });
  const t = get(b, 101);
  const u = get(b, 1);
  const drained = mul(t.manaMax, 10);
  assert.equal(t.manaMax - t.mana, drained - t.regen); // mục tiêu hồi mana sau người đánh trong cùng tick
  assert.equal(u.mana, u.manaMax - u.slots[0].cost + drained);
  const ls = castNow({ seed: 1, teamA: [unit(1, 0, [tech("can_don")], { bonuses: { ...noCrit, lifestealFlat: 100 } })], teamB: [inert(101)] },
    (x) => {
      place(x, { 1: 5000, 101: 5500 });
      get(x, 1).curHp = 10000;
    });
  assert.equal(get(ls, 1).curHp - 10000, mul(loss(ls, 101), 100));
});

test("hồi máu mỗi giây theo máu tối đa", () => {
  const b = new Battle({ seed: 1, teamA: [inert(1, 0, { hp: 10000, bonuses: { hpRegen: 5 } })], teamB: [inert(101, 0)] });
  place(b, { 1: 1000, 101: 11000 });
  get(b, 1).curHp = 5000;
  for (let i = 0; i <= 20; i++) b.step();
  assert.equal(get(b, 1).curHp, 5050);
});

test("dòng ẩn: luôn bật, 10 giây đầu, máu dưới 50%, hàng đứng, đội địch khắc mình; ghi lần đầu kích phát", () => {
  const atk = (cond: "always" | "opening" | "late" | "lowHp" | "front" | "back" | "countered") =>
    new Battle({ seed: 1, teamA: [inert(1, 0, { hidden: [{ cond, stat: "atk", value: 30 }] })], teamB: [inert(101, 0, { element: "kim" })] });
  assert.equal(get(atk("always"), 1).atk, 1030);
  assert.equal(get(atk("front"), 1).atk, 1030);
  assert.equal(get(atk("back"), 1).atk, 1000);
  assert.equal(get(atk("countered"), 1).atk, 1030); // Kim khắc Mộc
  const open = atk("opening");
  assert.equal(get(open, 1).atk, 1030);
  place(open, { 1: 1000, 101: 11000 });
  while (open.tick <= HIDDEN_RULES.openingTicks) open.step();
  assert.equal(get(open, 1).atk, 1000);
  const low = atk("lowHp");
  place(low, { 1: 1000, 101: 11000 });
  low.step();
  assert.equal(get(low, 1).atk, 1000);
  get(low, 1).curHp = 400_000;
  low.step();
  assert.equal(get(low, 1).atk, 1030);
  get(low, 1).curHp = 900_000;
  low.step();
  assert.equal(get(low, 1).atk, 1000);
  const r = simulate({ seed: 1, teamA: [unit(1, 0, [tech("can_don")], { hidden: [{ cond: "back", stat: "atk", value: 30 }, { cond: "always", stat: "critBonus", value: 20 }] })], teamB: [unit(101, 0, [tech("can_don")])] });
  assert.deepEqual(r.hiddenFirst, [{ unitId: 1, line: 1, tick: 0 }]);
});

test("dòng ẩn: giảm hồi chiêu, giảm mana, thủ, kháng hệ khắc mình bật tắt đúng chỗ", () => {
  const b = new Battle({
    seed: 1,
    teamA: [unit(1, 0, [tech("can_don")], {
      hidden: [
        { cond: "lowHp", stat: "cooldownCut", value: 100 }, { cond: "lowHp", stat: "manaCostCut", value: 100 },
        { cond: "lowHp", stat: "defOuter", value: 40 }, { cond: "lowHp", stat: "counterResist", value: 30 },
      ],
      def: 1000,
    })],
    teamB: [inert(101, 0)],
  });
  const u = get(b, 1);
  const [cd0, cost0] = [u.slots[0].cooldown, u.slots[0].cost];
  place(b, { 1: 1000, 101: 11000 });
  u.curHp = 1000;
  b.step();
  assert.deepEqual([u.slots[0].cooldown, u.slots[0].cost, u.defOuter, u.defInner], [mul(cd0, 900), mul(cost0, 900), 1040, 1000]);
  assert.equal(u.resist.kim, undefined); // dòng thứ 4: quá HIDDEN_RULES.maxActive
  u.curHp = u.hp;
  b.step();
  assert.deepEqual([u.slots[0].cooldown, u.slots[0].cost, u.defOuter], [cd0, cost0, 1000]);
  const kr = new Battle({ seed: 1, teamA: [inert(1, 0, { hidden: [{ cond: "always", stat: "counterResist", value: 30 }] })], teamB: [inert(101)] });
  assert.equal(get(kr, 1).resist.kim, 30); // Kim khắc Mộc
});

test("dòng ẩn: tối đa 3 dòng hiệu lực, theo thứ tự ưu tiên; dòng trước đúng điều kiện thì đẩy dòng sau ra", () => {
  const lines = [
    { cond: "lowHp" as const, stat: "atk" as const, value: 100 },
    { cond: "always" as const, stat: "atk" as const, value: 30 },
    { cond: "always" as const, stat: "atk" as const, value: 20 },
    { cond: "always" as const, stat: "atk" as const, value: 10 },
  ];
  const b = new Battle({ seed: 1, teamA: [inert(1, 0, { hidden: lines })], teamB: [inert(101)] });
  place(b, { 1: 1000, 101: 11000 });
  const u = get(b, 1);
  assert.equal(u.atk, 1060);
  u.curHp = 400_000;
  b.step();
  assert.equal(u.atk, 1150); // 100 + 30 + 20; dòng 10 tắt
  u.curHp = u.hp;
  b.step();
  assert.equal(u.atk, 1060);
});

test("giảm sát thương nhận theo loại đòn: chỉ đúng loại, cộng với phần chung, trần DAMAGE_CUT_CAP", () => {
  const base = hit();
  const outer = hit({}, { bonuses: { damageTakenCutOuter: 100 } });
  const inner = hit({}, { bonuses: { damageTakenCutInner: 100 } });
  assert.equal(loss(outer, 101), loss(base, 101) - mul(loss(base, 101), 100));
  assert.equal(loss(inner, 101), loss(base, 101)); // cận chiến là đòn ngoại
  const capped = hit({}, { bonuses: { damageTakenCut: 200, damageTakenCutOuter: 200 } });
  assert.equal(loss(capped, 101), loss(base, 101) - mul(loss(base, 101), DAMAGE_CUT_CAP));
});

test("Băng Phách: khống chế trúng kẻ đang vận công thì dài thêm", () => {
  const b = new Battle({ seed: 1, teamA: [inert(1, 0, { setFx: { controlChannelTicks: 10 } })], teamB: [inert(101)] });
  const t = get(b, 101);
  b.control(t, 20, get(b, 1));
  const plain = t.stunUntil;
  t.stunUntil = -1_000_000;
  t.channel = { slot: 0, startTick: 0, resolveTick: 100, center: 0, ult: false, interruptible: false, guarded: [], guardCut: 0, group: 101 };
  b.control(t, 20, get(b, 1));
  assert.equal(t.stunUntil, plain + 10);
});

test("trận có war: dòng ẩn chiến tranh chỉ bật khi cờ war", () => {
  const spec = inert(1, 0, { hidden: [{ cond: "war", stat: "atk", value: 30 }] });
  assert.equal(get(new Battle({ seed: 1, teamA: [spec], teamB: [inert(101)] }), 1).atk, 1000);
  assert.equal(get(new Battle({ seed: 1, teamA: [spec], teamB: [inert(101)], war: true }), 1).atk, 1030);
  const pve = inert(1, 0, { hidden: [{ cond: "pve", stat: "atk", value: 30 }] });
  assert.equal(get(new Battle({ seed: 1, teamA: [pve], teamB: [inert(101, 0, { monster: true })] }), 1).atk, 1030);
});

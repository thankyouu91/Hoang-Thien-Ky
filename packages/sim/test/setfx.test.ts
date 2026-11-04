import { test } from "node:test";
import assert from "node:assert/strict";
import {
  Battle, BATTLE, composeTechnique, mul,
  type BattleInput, type Element, type SkillType, type Technique, type Unit, type UnitSpec,
} from "../src/index.ts";

// Hiệu ứng hành vi và khắc chế của set (UnitSpec.setFx, SkillMod), tab Trang bị phần 7.

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
/** Công pháp đầu của đơn vị 1 sẵn sàng ngay, đủ mana; chỉnh trận rồi chạy 1 tick. */
const castNow = (input: BattleInput, setup: (b: Battle) => void = () => {}): Battle => {
  const b = new Battle(input, true);
  setup(b);
  return again(b);
};
const again = (b: Battle): Battle => {
  const u = get(b, 1);
  u.slots[0].cd = 0;
  u.mana = u.manaMax;
  b.step();
  return b;
};
const untilCast = (b: Battle): Battle => {
  while (!b.events.some((e) => e.unitId === 1)) b.step();
  return b;
};

test("Bách Thảo: lần đầu bị giảm hồi máu (Cực âm) thì tẩy ngay, lần sau thì không", () => {
  const b = castNow(
    { seed: 1, teamA: [unit(1, 0, [tech("can_don", "cuc_am")], { bonuses: noCrit })], teamB: [inert(101, 0, { setFx: { cleanseHealCut: 1 } })] },
    (x) => place(x, { 1: 5000, 101: 5500 }),
  );
  assert.ok(get(b, 101).healCutUntil <= b.tick);
  again(b);
  assert.ok(get(b, 101).healCutUntil > b.tick);
});

test("Bàn Thạch mốc 4: hộ thể che thêm chính mình với khiên 50%", () => {
  const ally = (id: number) => unit(id, 0, [tech("can_don")], { manaMax: 0 });
  const run = (setFx = {}) =>
    castNow({ seed: 1, teamA: [unit(1, 0, [tech("ho_the")], { setFx }), ally(2), ally(3), ally(4)], teamB: [inert(101)] },
      (b) => place(b, { 1: 3000, 2: 5000, 3: 4900, 4: 4800, 101: 6000 }));
  assert.equal(get(run(), 1).shield, 0);
  const b = run({ guardSelfShield: 500 });
  assert.equal(get(b, 1).shield, mul(get(b, 2).shield, 500));
});

test("Bàn Thạch mốc 7: lần đầu máu dưới 30% thì hóa đá 1,5 s: miễn sát thương, không ra chiêu", () => {
  const b = castNow(
    { seed: 1, teamA: [unit(1, 0, [tech("can_don")], { bonuses: noCrit })], teamB: [inert(101, 0, { setFx: { petrifyBelow: 300, petrifyTicks: 30 } })] },
    (x) => {
      place(x, { 1: 5000, 101: 5500 });
      get(x, 101).curHp = 300_500;
    },
  );
  const t = get(b, 101);
  assert.ok(t.curHp < 300_000);
  assert.equal(t.stoneUntil, 30);
  const hp = t.curHp;
  again(b);
  assert.equal(get(b, 101).curHp, hp);
});

test("Thiết Kỵ: cận chiến quét +20% vào mục tiêu đầu; mốc 7 hàng trước nhận ít hơn 12% diện rộng khi hàng sau còn 2 người", () => {
  const b = castNow(
    { seed: 1, teamA: [unit(1, 0, [tech("can_quet")], { bonuses: noCrit, skillMods: { can_quet: { firstTargetBonus: 200 } } })], teamB: [inert(101), inert(102)] },
    (x) => place(x, { 1: 5000, 101: 5500, 102: 5500 }),
  );
  assert.ok(Math.abs(loss(b, 101) - mul(loss(b, 102), 1200)) <= 2, `${loss(b, 101)} / ${loss(b, 102)}`);
  const aoe = (setFx = {}) =>
    untilCast(new Battle({ seed: 1, teamA: [unit(1, 0, [tech("dien_rong")], { bonuses: noCrit })], teamB: [inert(101, 0, { setFx }), inert(102, 1), inert(103, 1)] }, true));
  const d = loss(aoe(), 101);
  assert.equal(loss(aoe({ frontAoeCut: 120 }), 101), d - mul(d, 120));
});

test("Văn Uyên: diện rộng bị cắt thì hoàn 50% hồi chiêu; mốc 7 diện rộng đầu tiên không cần vận công", () => {
  const b = new Battle({ seed: 1, teamA: [unit(1, 0, [tech("dien_rong")], { setFx: { channelRefund: 500 } })], teamB: [inert(101)] }, true);
  while (!get(b, 1).channel) b.step();
  const s = get(b, 1).slots[0];
  const before = s.cd;
  b.control(get(b, 1), 10);
  assert.equal(get(b, 1).channel, null);
  assert.equal(s.cd, before - mul(s.cooldown * 1000, 500));
  const fast = untilCast(new Battle({ seed: 1, teamA: [unit(1, 0, [tech("dien_rong")], { setFx: { instantFirstAoe: true } })], teamB: [inert(101)] }, true));
  const e = fast.events.find((x) => x.unitId === 1)!;
  assert.equal(e.tick, e.startTick);
});

test("Ngọc Tủy mốc 7: đầu trận kháng +8% hệ chủ xuất hiện nhiều nhất trong công pháp đội địch", () => {
  const b = new Battle({
    seed: 1, teamA: [inert(1, 0, { setFx: { resistTopEnemy: 80 }, resist: { hoa: 50 } })],
    teamB: [unit(101, 0, [tech("can_don", "loi"), tech("tam_xa", "loi")]), unit(102, 0, [tech("can_don", "kim")])],
  });
  assert.deepEqual(get(b, 1).resist, { hoa: 50, loi: 80 });
});

test("Linh Tuyền: mang hồi phục chỉ hồi mana chậm 10%; mốc 7 đồng đội ngã thì hồi phục hồi chiêu ngay (1 lần)", () => {
  const regen = (setFx = {}) => get(new Battle({ seed: 1, teamA: [unit(1, 1, [tech("hoi_phuc", "moc")], { setFx })], teamB: [inert(101)] }), 1).regen;
  assert.equal(regen({ healerRegenPenalty: -100 }), mul((BATTLE.manaRegenPerSec * 1000) / 20, 900));
  assert.equal(regen(), mul((BATTLE.manaRegenPerSec * 1000) / 20, 800));
  const b = castNow(
    { seed: 1, teamA: [unit(1, 0, [tech("can_don")], { bonuses: noCrit })], teamB: [inert(101), unit(102, 1, [tech("hoi_phuc", "moc")], { setFx: { resetHealOnFall: 1 } })] },
    (x) => {
      place(x, { 1: 5000, 101: 5500, 102: 9000 });
      get(x, 101).curHp = 1;
      get(x, 102).slots[0].cd = 99_000;
    },
  );
  assert.ok(get(b, 101).curHp <= 0);
  assert.equal(get(b, 102).slots[0].cd, 0);
});

test("Băng Phách: khống chế lặp còn 75%; mốc 7 kẻ đang bị làm chậm nhận thêm 8%", () => {
  const b = new Battle({ seed: 1, teamA: [unit(1, 0, [tech("khong_che")], { setFx: { controlDr: 750 } })], teamB: [inert(101)] });
  const t = get(b, 101);
  b.control(t, 40, get(b, 1));
  t.stunUntil = 0; // vừa hết choáng, còn trong cửa sổ giảm dần
  b.control(t, 40, get(b, 1));
  assert.equal(t.stunUntil, 30);
  const hit = (setFx = {}) =>
    loss(castNow({ seed: 1, teamA: [unit(1, 0, [tech("can_don")], { bonuses: noCrit, setFx })], teamB: [inert(101)] }, (x) => {
      place(x, { 1: 5000, 101: 5500 });
      get(x, 101).slowUntil = 100;
    }), 101);
  assert.ok(Math.abs(hit({ chilledBonus: 80 }) - mul(hit(), 1080)) <= 2);
});

test("Lôi Trì mốc 7: đòn chí mạng thứ 3 nảy sang kẻ địch gần nhất với 50% sát thương", () => {
  const b = castNow(
    { seed: 1, teamA: [unit(1, 0, [tech("can_don")], { bonuses: { critBonus: 2000 }, setFx: { bounceCrit: 3, bounceDamage: 500 } })], teamB: [inert(101), inert(102)] },
    (x) => place(x, { 1: 5000, 101: 5500, 102: 6000 }),
  );
  again(b);
  assert.equal(loss(b, 102), 0);
  const before = loss(b, 101);
  again(b);
  assert.ok(loss(b, 102) > 0);
  assert.ok(Math.abs(loss(b, 102) - mul(loss(b, 101) - before, 500)) <= 1);
});

test("Huyết Ảnh: thân pháp lộ vị trí 2 s; mốc 7 hạ gục bằng thân pháp thì ẩn thân 1,5 s", () => {
  const b = castNow(
    { seed: 1, teamA: [unit(1, 0, [tech("than_phap")], { skillMods: { than_phap: { exposedTicks: 40 } }, setFx: { stealthOnDashKill: 30 } })], teamB: [inert(101), inert(102)] },
    (x) => {
      place(x, { 1: 3000, 101: 6000, 102: 9000 });
      get(x, 101).curHp = 1;
    },
  );
  assert.equal(get(b, 1).exposedUntil, 40);
  assert.equal(get(b, 1).stealthUntil, 30);
});

test("Độ Kiếp: lần bùa chú cuối mỗi trận không tốn mana", () => {
  const b = new Battle({ seed: 1, teamA: [unit(1, 1, [tech("bua_chu")], { skillMods: { bua_chu: { lastUseFree: true } } })], teamB: [inert(101)] }, true);
  place(b, { 1: 4000, 101: 6000 });
  const spent: number[] = [];
  for (let i = 0; i < 3; i++) {
    const u = get(b, 1);
    u.slots[0].cd = 0;
    u.mana = u.manaMax;
    b.step();
    spent.push(u.manaMax - u.mana);
  }
  assert.ok(spent[0] > 0 && spent[1] > 0);
  assert.ok(spent[2] <= 0, `lần cuối tốn ${spent[2]}`);
});

test("Vạn Kiếm: cận chiến đơn +15% lên mục tiêu dưới 30% máu; mốc 7 mỗi 5 s kiếm khí trúng kẻ đứng sau 30%", () => {
  const hit = (curHp: number, mods = {}) =>
    loss(castNow({ seed: 1, teamA: [unit(1, 0, [tech("can_don")], { bonuses: noCrit, skillMods: { can_don: mods } })], teamB: [inert(101)] }, (x) => {
      place(x, { 1: 5000, 101: 5500 });
      get(x, 101).curHp = curHp;
    }), 101) - (1_000_000 - curHp);
  const low = { lowHpBelow: 300, lowHpBonus: 150 };
  assert.equal(hit(1_000_000, low), hit(1_000_000));
  assert.ok(Math.abs(hit(200_000, low) - mul(hit(200_000), 1150)) <= 2);
  const qi = { qiCycleTicks: 100, qiDamage: 300 };
  const b = new Battle({ seed: 1, teamA: [unit(1, 0, [tech("can_don")], { bonuses: noCrit, skillMods: { can_don: qi } })], teamB: [inert(101), inert(102), inert(103)] }, true);
  place(b, { 1: 5000, 101: 5500, 102: 6200, 103: 8000 });
  again(b);
  assert.equal(loss(b, 102), 0); // chưa đủ 5 s
  b.tick = 100;
  const before = loss(b, 101);
  again(b);
  assert.ok(Math.abs(loss(b, 102) - mul(loss(b, 101) - before, 300)) <= 1);
  assert.equal(loss(b, 103), 0); // xa hơn 1 ô sau mục tiêu
});

test("Chu Thiên: trận pháp đặt vào chỗ đông kẻ địch nhất thay vì quanh kẻ gần nhất", () => {
  // Một kẻ đứng gần, ba kẻ đứng xa thành cụm ngoài bán kính 2 ô của kẻ gần; mọi kẻ địch đứng yên để đo đúng chỗ đặt trận.
  const spread = (densest: boolean) => {
    const b = new Battle({
      seed: 1, teamA: [unit(1, 0, [tech("tran_phap")], { skillMods: densest ? { tran_phap: { densest } } : {} })],
      teamB: [inert(101), inert(102, 1), inert(103, 1), inert(104, 1)],
    }, true);
    for (const id of [101, 102, 103, 104]) get(b, id).rootUntil = 1_000_000;
    place(b, { 1: 4000, 101: 5000, 102: 8000, 103: 8000, 104: 8000 });
    return untilCast(b).events.find((e) => e.unitId === 1)!.targets;
  };
  assert.deepEqual(spread(false), [101]);
  assert.deepEqual(spread(true), [102, 103, 104]);
});

test("Hỗn Độn: hệ khắc mình ×1,5 còn ×1,4; mốc 7 ngụy linh căn trong 8 s đầu", () => {
  const hit = (target: Partial<UnitSpec>) =>
    loss(castNow({ seed: 1, teamA: [unit(1, 0, [tech("can_don", "kim")], { bonuses: noCrit })], teamB: [inert(101, 0, target)] }, (x) => place(x, { 1: 5000, 101: 5500 })), 101);
  const plain = hit({ element: "moc" }); // Kim khắc Mộc ×1,5
  assert.ok(Math.abs(hit({ element: "moc", setFx: { counterCap: 1400 } }) - Math.trunc((plain * 1400) / 1500)) <= 2);
  const neutral = hit({ element: "quang" });
  assert.equal(hit({ element: "moc", setFx: { decoyTicks: 160 }, decoyElement: "quang" }), neutral);
  assert.equal(hit({ element: "moc", decoyElement: "quang" }), plain); // không có set thì không có tác dụng
});

test("Cổ Tông: hồi chiêu pháp bảo −15%; thêm 1 lần mỗi trận, không quá 3 và không quá linh lực", () => {
  const art = (uses: number, energy?: number) => ({ kind: "thuan" as const, power: 500, uses, cooldownTicks: 160, energy });
  const a = (spec: Partial<UnitSpec>) => get(new Battle({ seed: 1, teamA: [inert(1, 0, spec)], teamB: [inert(101)] }), 1).artifacts[0];
  const setFx = { artifactCooldownCut: 150, artifactExtraUses: 1, artifactMaxUses: 3 };
  assert.deepEqual([a({ artifacts: [art(2, 20)], setFx }).uses, a({ artifacts: [art(2, 20)], setFx }).cooldownTicks], [3, 136]);
  assert.equal(a({ artifacts: [art(3, 20)], setFx }).uses, 3);
  assert.equal(a({ artifacts: [art(2, 2)], setFx }).uses, 2);
  assert.equal(a({ artifacts: [art(2, 20)] }).uses, 2);
});

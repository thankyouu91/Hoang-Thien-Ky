import { test } from "node:test";
import assert from "node:assert/strict";
import {
  Battle, MAX_TICKS, composeTechnique, hitDamage, shieldAmount,
  type Element, type SkillType, type UnitSpec, type BattleInput, type Unit,
} from "../src/index.ts";

const tech = (type: SkillType, element: Element = "kim") =>
  composeTechnique({ element, type, variant: "bao", grade: 1 }, [{ element, type, variant: "ben", grade: 1 }]);
const unit = (id: number, row: 0 | 1, types: SkillType[], extra: Partial<UnitSpec> = {}): UnitSpec => ({
  id, level: 50, element: "moc", hp: 20000, atk: 1000, def: 0, row, techniques: types.map((t) => tech(t)), ...extra,
});
/** Đối thủ chỉ biết hồi máu: không đánh, đứng cách địch gần nhất 4 ô. */
const dummy = (id: number, row: 0 | 1 = 0) => unit(id, row, ["hoi_phuc"], { hp: 1_000_000 });
const run = (input: BattleInput, until: (b: Battle) => boolean) => {
  const b = new Battle(input, true);
  while (!b.finished && !until(b)) b.step();
  return b;
};
const posOf = (b: Battle, id: number) => b.units.find((u) => u.id === id)!.pos;
const get = (b: Battle, id: number): Unit => b.units.find((u) => u.id === id)!;
const steps = (b: Battle, n: number) => {
  for (let i = 0; i < n; i++) b.step();
};

test("sát thương một đòn: D × công lực, khắc hệ, chí mạng, chiêu cuối, phòng thủ", () => {
  const t = composeTechnique({ element: "loi", type: "can_quet", variant: "linh", grade: 1 }, [{ element: "quang", type: "can_quet", variant: "ben", grade: 1 }]);
  const a = { atk: 1000, level: 50 };
  const d = { element: "kim" as Element, level: 50, def: 0 };
  assert.equal(hitDamage(a, t, d, false, false), 1260); // 105 × 10 × 1,2 (Lôi biến dị đánh Kim gốc)
  assert.equal(hitDamage(a, t, d, true, false), 1890); // chí mạng ×1,5
  assert.equal(hitDamage(a, t, d, false, true), 3150); // chiêu cuối ×2,5
  assert.equal(hitDamage(a, t, { ...d, def: 1000 }, false, false), 630); // phòng thủ 1000 giảm 50%
});

test("cận chiến tiến lại gần rồi mới ra chiêu", () => {
  const b = run({ seed: 1, teamA: [unit(1, 0, ["can_don"])], teamB: [unit(101, 0, ["can_don"])] }, (b) => b.events.length > 0);
  assert.equal(Math.abs(posOf(b, 1) - posOf(b, 101)) <= 1000, true);
  assert.equal(b.units.every((u) => u.curHp === u.hp), false);
});

test("tầm xa dừng lại ở tầm 4 ô", () => {
  const b = run({ seed: 1, teamA: [unit(1, 1, ["tam_xa"])], teamB: [unit(101, 1, ["tam_xa"])] }, (b) => b.tick >= 30);
  assert.equal(posOf(b, 101) - posOf(b, 1), 4000);
});

test("ưu tiên theo thứ tự: chiêu đầu quyết định khoảng đứng, chiêu sau dùng khi chiêu đầu không với tới", () => {
  // Tầm xa đứng đầu: đứng ở 4 ô, cận chiến không bao giờ với tới.
  const ranged = run({ seed: 1, teamA: [unit(1, 0, ["tam_xa", "can_don"])], teamB: [dummy(101)] }, (b) => b.tick >= 200);
  const a1 = ranged.events.filter((e) => e.unitId === 1);
  assert.ok(a1.length > 0);
  assert.ok(a1.every((e) => e.slot === 0));
  // Cận chiến đứng đầu: vừa tiến vừa bắn tầm xa, vào sát rồi chém.
  const melee = run({ seed: 1, teamA: [unit(1, 0, ["can_don", "tam_xa"])], teamB: [dummy(101)] }, (b) => b.tick >= 200);
  const a2 = melee.events.filter((e) => e.unitId === 1);
  assert.equal(a2[0].slot, 1);
  assert.ok(a2.some((e) => e.slot === 0));
  assert.ok(Math.abs(posOf(melee, 1) - posOf(melee, 101)) <= 1000);
});

test("không đủ mana thì không ra chiêu", () => {
  // Bùa chú tốn 120 mana nhưng mana tối đa chỉ 100.
  const b = run({ seed: 1, teamA: [unit(1, 0, ["bua_chu"], { manaMax: 100 })], teamB: [dummy(101)] }, () => false);
  assert.equal(b.events.filter((e) => e.unitId === 1).length, 0);
  assert.equal(b.result().winner, "draw");
  assert.equal(b.result().ticks, MAX_TICKS);
});

test("diện rộng đánh các địch quanh mục tiêu gần nhất, gần tâm trước", () => {
  const b = run(
    { seed: 1, teamA: [unit(1, 0, ["dien_rong"])], teamB: [dummy(101), dummy(102), dummy(103, 1)] },
    (b) => b.events.some((e) => e.unitId === 1),
  );
  const e = b.events.find((e) => e.unitId === 1)!;
  assert.deepEqual(e.targets.slice(0, 2).sort(), [101, 102]);
  assert.equal(e.targets.length, 3);
});

test("hồi phục chọn đồng minh có % máu thấp nhất", () => {
  const b = new Battle(
    { seed: 1, teamA: [unit(1, 1, ["hoi_phuc"]), unit(2, 0, ["can_don"]), unit(3, 0, ["can_don"])], teamB: [dummy(101)] },
    true,
  );
  b.units.find((u) => u.id === 2)!.curHp = 15000;
  b.units.find((u) => u.id === 3)!.curHp = 5000;
  while (!b.events.some((e) => e.unitId === 1)) b.step();
  assert.deepEqual(b.events.find((e) => e.unitId === 1)!.targets, [3, 2]);
});

test("đơn vị phải có 1–4 công pháp", () => {
  assert.throws(() => new Battle({ seed: 1, teamA: [unit(1, 0, [])], teamB: [dummy(101)] }));
  assert.throws(() => new Battle({ seed: 1, teamA: [unit(1, 0, ["can_don", "can_don", "can_don", "can_don", "can_don"])], teamB: [dummy(101)] }));
});

// Luật đánh đổi riêng của từng loại chiêu (GDD mục 8)

test("diện rộng vận công 1 s rồi mới trúng", () => {
  const b = run({ seed: 1, teamA: [unit(1, 0, ["dien_rong"])], teamB: [dummy(101)] }, (b) => get(b, 1).channel !== null);
  const hp = get(b, 101).curHp;
  steps(b, 19);
  assert.equal(get(b, 101).curHp, hp);
  steps(b, 1);
  assert.ok(get(b, 101).curHp < hp);
  const e = b.events.find((e) => e.unitId === 1)!;
  assert.equal(e.tick - e.startTick, 20);
});

test("diện rộng bị khống chế là mất chiêu; trận pháp thì không", () => {
  const aoe = run({ seed: 1, teamA: [unit(1, 0, ["dien_rong"])], teamB: [dummy(101)] }, (b) => get(b, 1).channel !== null);
  aoe.control(get(aoe, 1), 30);
  assert.equal(get(aoe, 1).channel, null);
  steps(aoe, 40);
  assert.equal(get(aoe, 101).curHp, get(aoe, 101).hp);
  const formation = run({ seed: 1, teamA: [unit(1, 0, ["tran_phap"])], teamB: [dummy(101)] }, (b) => get(b, 1).channel !== null);
  formation.control(get(formation, 1), 30);
  assert.notEqual(get(formation, 1).channel, null);
});

test("hộ thể: khiên 120% sát thương gốc cho 3 đồng minh gần địch nhất, hết hạn sau 6 s", () => {
  const b = run(
    { seed: 1, teamA: [unit(1, 1, ["ho_the"]), unit(2, 0, ["hoi_phuc"]), unit(3, 0, ["hoi_phuc"]), unit(4, 1, ["hoi_phuc"])], teamB: [dummy(101)] },
    (b) => b.events.some((e) => e.unitId === 1),
  );
  const e = b.events.find((e) => e.unitId === 1)!;
  assert.deepEqual(e.targets, [2, 3, 1]); // hàng trước gần địch hơn, rồi id nhỏ hơn
  const amount = shieldAmount(1000, tech("ho_the"));
  assert.equal(amount, 1425); // 118,8 × 10 × 1,2
  for (const id of [2, 3, 1]) assert.equal(get(b, id).shield, amount);
  assert.equal(get(b, 4).shield, 0);
  steps(b, 119);
  assert.equal(get(b, 2).shield, amount);
  steps(b, 1);
  assert.equal(get(b, 2).shield, 0);
});

test("khiên đỡ sát thương trước máu", () => {
  const b = new Battle({ seed: 1, teamA: [dummy(1)], teamB: [unit(101, 0, ["can_don"])] }, true);
  const a = get(b, 1);
  a.shield = 1_000_000;
  a.shieldUntil = MAX_TICKS;
  while (!b.events.some((e) => e.unitId === 101)) b.step();
  assert.equal(a.curHp, a.hp);
  assert.ok(a.shield < 1_000_000);
});

test("bùa chú chỉ dùng 3 lần mỗi trận", () => {
  const b = run({ seed: 1, teamA: [unit(1, 0, ["bua_chu"])], teamB: [dummy(101)] }, () => false);
  assert.equal(b.events.filter((e) => e.unitId === 1).length, 3);
});

test("trận pháp bày 5 s; tuyệt sát khoảng 15%, trừ boss và đối thủ cảnh giới cao hơn", () => {
  const kills = (extra: Partial<UnitSpec>) => {
    let n = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const b = run({ seed, teamA: [unit(1, 0, ["tran_phap"])], teamB: [{ ...dummy(101), ...extra }] }, (b) => b.events.some((e) => e.unitId === 1));
      const e = b.events.find((e) => e.unitId === 1)!;
      assert.equal(e.tick - e.startTick, 100);
      if (get(b, 101).curHp <= 0) n++;
    }
    return n;
  };
  const normal = kills({});
  assert.ok(normal >= 25 && normal <= 70, `tuyệt sát ${normal}/300`);
  assert.equal(kills({ boss: true }), 0);
  assert.equal(kills({ level: 51 }), 0); // Trúc Cơ, cao hơn Luyện Khí của người bày trận
  assert.ok(kills({ level: 1 }) > 0); // cùng cảnh giới dù thấp cấp hơn
});

test("mang công pháp hồi phục thì hồi mana chậm 20%", () => {
  const b = new Battle({ seed: 1, teamA: [unit(1, 0, ["hoi_phuc", "can_don"]), unit(2, 0, ["can_don"])], teamB: [dummy(101)] });
  assert.equal(get(b, 1).regen, 2000);
  assert.equal(get(b, 2).regen, 2500);
});

test("khống chế: choáng 1,5 s, không hành động; bị khống chế lại trong 5 s thì còn một nửa", () => {
  const b = run({ seed: 1, teamA: [unit(1, 0, ["khong_che"])], teamB: [unit(101, 0, ["can_don"])] }, (b) => b.events.some((e) => e.unitId === 1));
  const e = b.events.find((e) => e.unitId === 1)!;
  const t = get(b, 101);
  assert.equal(t.stunUntil, e.tick + 30);
  const before = b.events.length;
  while (b.tick < t.stunUntil) b.step();
  assert.equal(b.events.slice(before).filter((x) => x.unitId === 101).length, 0);
  steps(b, 10); // hết choáng 10 tick, vẫn trong cửa sổ 5 s
  b.control(t, 30);
  assert.equal(t.stunUntil, b.tick + 15);
  while (b.tick < t.stunUntil + 100) b.step();
  b.control(t, 30);
  assert.equal(t.stunUntil, b.tick + 30);
});

test("thân pháp lướt tới sát mục tiêu rồi lộ vị trí 3 s", () => {
  const b = run({ seed: 1, teamA: [unit(1, 1, ["than_phap"])], teamB: [dummy(101)] }, (b) => b.events.some((e) => e.unitId === 1));
  const e = b.events.find((e) => e.unitId === 1)!;
  assert.equal(posOf(b, 1), posOf(b, 101) - 500);
  assert.equal(get(b, 1).exposedUntil, e.tick + 60);
});

test("địch ưu tiên đánh kẻ đang lộ vị trí", () => {
  const setup = (exposed: boolean) => {
    const b = new Battle({ seed: 1, teamA: [dummy(1), dummy(2)], teamB: [unit(101, 0, ["bua_chu"])] }, true);
    get(b, 1).pos = 6000;
    get(b, 2).pos = 5000;
    if (exposed) get(b, 2).exposedUntil = 1000;
    const atk = get(b, 101);
    atk.pos = 8000;
    atk.slots[0].cd = 0;
    b.step();
    return b.events.find((e) => e.unitId === 101)!.targets;
  };
  assert.deepEqual(setup(false), [1]);
  assert.deepEqual(setup(true), [2]);
});

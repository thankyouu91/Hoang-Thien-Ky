import { test } from "node:test";
import assert from "node:assert/strict";
import {
  Battle, composeTechnique, mul, simulate,
  type ArtifactKind, type ArtifactSpec, type BattleInput, type Element, type SkillType, type Technique, type Unit, type UnitSpec,
} from "../src/index.ts";

// Pháp bảo (tab Trang bị, phần 9): mỗi loại tự kích hoạt để khắc một loại chiêu của địch.

const tech = (type: SkillType, element: Element = "kim"): Technique =>
  composeTechnique({ element, type, variant: "bao", grade: 1 }, [{ element, type, variant: "ben", grade: 1 }]);
const unit = (id: number, row: 0 | 1, techniques: Technique[], extra: Partial<UnitSpec> = {}): UnitSpec => ({
  id, level: 50, element: "moc", hp: 20000, atk: 1000, def: 0, row, techniques, ...extra,
});
/** Bia đỡ: không đủ mana nên không ra chiêu; máu rất nhiều. */
const inert = (id: number, row: 0 | 1 = 0, extra: Partial<UnitSpec> = {}): UnitSpec =>
  unit(id, row, [tech("can_don")], { hp: 1_000_000, manaMax: 0, ...extra });
const art = (kind: ArtifactKind, power: number, extra: Partial<ArtifactSpec> = {}): ArtifactSpec => ({ kind, power, uses: 2, cooldownTicks: 160, ...extra });
const get = (b: Battle, id: number): Unit => b.units.find((u) => u.id === id)!;
const place = (b: Battle, pos: Record<number, number>) => {
  for (const id of Object.keys(pos)) {
    const u = b.units.find((x) => x.id === Number(id));
    if (u) u.pos = pos[Number(id)];
  }
};
const loss = (b: Battle, id: number) => get(b, id).hp - get(b, id).curHp;
const used = (b: Battle, id: number) => get(b, id).artifacts.map((a) => a.used);
const noCrit = { critBonus: -2000 };
const allCrit = { critBonus: 2000 };

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
/** Chạy tới khi đơn vị 1 có lần ra chiêu được ghi (chiêu vận công ghi lúc phát). */
const untilCast = (b: Battle): Battle => {
  while (!b.events.some((e) => e.unitId === 1)) b.step();
  return b;
};

test("Thuẫn: chặn 50% đòn cận chiến đơn chí mạng vào đồng đội hàng trước; đòn thường hoặc hàng sau thì không", () => {
  const run = (crit: boolean, row: 0 | 1, withShield = true) =>
    castNow(
      { seed: 1, teamA: [unit(1, 0, [tech("can_don")], { bonuses: crit ? allCrit : noCrit })], teamB: [inert(101, row), inert(102, 1, { artifacts: withShield ? [art("thuan", 500)] : [] })] },
      (b) => place(b, { 1: 5000, 101: 5500, 102: 9000 }),
    );
  const plain = loss(run(true, 0, false), 101);
  const b = run(true, 0);
  assert.equal(loss(b, 101), plain - mul(plain, 500));
  assert.deepEqual(used(b, 102), [1]);
  assert.deepEqual(used(run(false, 0), 102), [0]);
  assert.deepEqual(used(run(true, 1), 102), [0]);
});

test("Luân: từ 3 kẻ địch cận chiến đứng sát chủ nhân thì cắt chiêu quét và đẩy lùi 1 ô", () => {
  const run = (melee: number) => {
    const allies = [2, 3].slice(0, melee - 1).map((id) => unit(id, 0, [tech("can_don")], { manaMax: 0 }));
    return castNow(
      { seed: 1, teamA: [unit(1, 0, [tech("can_quet")], { bonuses: noCrit }), ...allies], teamB: [inert(101, 0, { artifacts: [art("luan", 1000)] })] },
      (b) => {
        place(b, { 1: 5500, 2: 5600, 3: 5400, 101: 6000 });
        for (const id of [2, 3]) if (melee > id - 1) get(b, id).rootUntil = 1_000_000; // đứng yên để đo đúng phần bị đẩy
      },
    );
  };
  const b = run(3);
  assert.equal(loss(b, 101), 0);
  assert.deepEqual([get(b, 1).pos, get(b, 2).pos, get(b, 3).pos], [4500, 4600, 4400]);
  assert.equal(b.events.find((e) => e.unitId === 1)!.targets.length, 0);
  assert.ok(loss(run(2), 101) > 0);
});

test("Châu: sau đòn tầm xa đầu vào hàng sau, 2 đòn tầm xa kế tiếp vào hàng sau giảm 50%", () => {
  const b = castNow(
    { seed: 1, teamA: [unit(1, 1, [tech("tam_xa")], { bonuses: noCrit })], teamB: [inert(101, 1), inert(102, 1, { artifacts: [art("chau", 500, { cooldownTicks: 10_000 })] })] },
    (x) => place(x, { 1: 3000, 101: 6000, 102: 9000 }),
  );
  const hits = [loss(b, 101)];
  for (let i = 0; i < 3; i++) {
    const before = loss(b, 101);
    again(b);
    hits.push(loss(b, 101) - before);
  }
  const d = hits[0];
  assert.deepEqual(hits, [d, d - mul(d, 500), d - mul(d, 500), d]);
  assert.deepEqual(used(b, 102), [1]);
});

test("Tháp: địch bắt đầu vận công diện rộng thì 3 đồng đội gần tâm chiêu nhất nhận ít hơn 50%", () => {
  const b = untilCast(
    new Battle({
      seed: 1, teamA: [unit(1, 0, [tech("dien_rong")], { bonuses: noCrit })],
      teamB: [inert(101), inert(102), inert(103), inert(104, 0, { artifacts: [art("thap", 500)] })],
    }, true),
  );
  const d = loss(b, 104); // chủ đứng cùng chỗ, id lớn nhất nên không nằm trong 3 người được che
  assert.ok(d > 0);
  for (const id of [101, 102, 103]) assert.equal(loss(b, id), d - mul(d, 500));
  assert.deepEqual(used(b, 104), [1]);
});

test("Hồ lô: kẻ địch trong tầm vừa nhận khiên hộ thể thì thu 50% khiên đó về chủ nhân", () => {
  const run = (far: boolean) =>
    castNow(
      { seed: 1, teamA: [unit(1, 0, [tech("ho_the")]), unit(2, 0, [tech("can_don")], { manaMax: 0 })], teamB: [inert(101, 0, { artifacts: [art("ho_lo", 500)] })] },
      (b) => place(b, { 1: 4000, 2: 4500, 101: far ? 9000 : 5500 }),
    );
  const b = run(false);
  const full = get(b, 1).shield; // người thứ hai nhận đủ khiên
  assert.ok(full > 0);
  assert.equal(get(b, 2).shield, full - mul(full, 500)); // người đầu (gần địch nhất) bị thu
  assert.equal(get(b, 101).shield, mul(full, 500));
  assert.deepEqual(used(run(true), 101), [0]); // ngoài 4 ô
});

test("Kính: chủ nhân hoặc đồng đội kề bên trúng bùa chú thì phản 30% sát thương về người thi triển", () => {
  const run = (ownerPos: number) =>
    castNow(
      { seed: 1, teamA: [unit(1, 1, [tech("bua_chu")], { bonuses: noCrit })], teamB: [inert(101), inert(102, 0, { artifacts: [art("kinh", 300)] })] },
      (b) => place(b, { 1: 4000, 101: 6000, 102: ownerPos }),
    );
  const b = run(6500);
  assert.equal(loss(b, 1), mul(loss(b, 101), 300));
  assert.equal(loss(run(8500), 1), 0);
});

test("Phiên: trận pháp của địch bày xong thì yếu đi 40%, mục tiêu đầu không bị tuyệt sát", () => {
  const run = (target: Partial<UnitSpec>, artifacts: ArtifactSpec[]) =>
    untilCast(new Battle({
      seed: 3, teamA: [unit(1, 0, [tech("tran_phap")], { bonuses: noCrit })],
      teamB: [inert(101, 0, target), inert(102, 1, { artifacts })],
    }, true));
  const d = loss(run({ boss: true }, []), 101); // boss không bị tuyệt sát: sát thương gốc của trận
  const b = run({}, [art("phien_co", 400)]);
  assert.equal(loss(b, 101), d - mul(d, 400));
  assert.deepEqual(used(b, 102), [1]);
});

test("Đỉnh: kẻ địch hồi từ 15% máu tối đa thì luyện hóa 40% lượng hồi; hồi ít hơn thì không", () => {
  const run = (hp: number, artifacts: ArtifactSpec[]) =>
    castNow(
      { seed: 1, teamA: [unit(1, 1, [tech("hoi_phuc", "moc")]), unit(2, 0, [tech("can_don")], { manaMax: 0, hp })], teamB: [inert(101, 0, { artifacts })] },
      (b) => {
        place(b, { 1: 3000, 2: 4000, 101: 9000 });
        get(b, 2).curHp = 1;
      },
    );
  const healed = (b: Battle) => get(b, 2).curHp - 1;
  const h = healed(run(5000, []));
  assert.ok(h * 1000 >= get(run(5000, []), 2).hp * 150 && h < 5000, `lượng hồi ${h}`);
  const b = run(5000, [art("dinh", 400)]);
  assert.equal(healed(b), h - mul(h, 400));
  assert.deepEqual(used(run(1_000_000, [art("dinh", 400)]), 101), [0]);
});

test("Chuông: từ 2 đồng đội đang bị choáng thì giải khống chế cả đội và miễn khống chế 1,5 s", () => {
  const run = (stunned: number[]) =>
    castNow(
      { seed: 1, teamA: [inert(1, 0, { artifacts: [art("chuong", 30)] }), inert(2), inert(3)], teamB: [inert(101)] },
      (b) => {
        for (const id of stunned) get(b, id).stunUntil = 200;
      },
    );
  const b = run([2, 3]);
  assert.deepEqual(used(b, 1), [1]);
  assert.ok(get(b, 2).stunUntil <= b.tick && get(b, 3).stunUntil <= b.tick);
  b.control(get(b, 2), 40);
  assert.ok(get(b, 2).stunUntil <= b.tick); // đang miễn khống chế
  assert.deepEqual(used(run([2]), 1), [0]);
});

test("Ấn: kẻ địch lướt vào hàng sau thì đòn lướt còn 50% và kẻ đó bị choáng 1 s", () => {
  const run = (row: 0 | 1, artifacts: ArtifactSpec[]) =>
    castNow(
      { seed: 1, teamA: [unit(1, 0, [tech("than_phap")], { bonuses: noCrit })], teamB: [inert(101, row), inert(102, 1, { artifacts })] },
      (b) => place(b, { 1: 4000, 101: 6000, 102: 9500 }),
    );
  const d = loss(run(1, []), 101);
  const b = run(1, [art("an", 20)]);
  assert.equal(loss(b, 101), mul(d, 500));
  assert.equal(get(b, 1).stunUntil, 20);
  assert.deepEqual(used(run(0, [art("an", 20)]), 102), [0]);
});

test("số lần mỗi trận và hồi chiêu; kết quả trận báo số lần đã dùng để trừ linh lực", () => {
  const input = (uses: number, cooldownTicks: number): BattleInput => ({
    seed: 1, teamA: [unit(1, 0, [tech("can_don")], { bonuses: allCrit })], teamB: [inert(101, 0, { artifacts: [art("thuan", 500, { uses, cooldownTicks })] })],
  });
  const hitTwice = (i: BattleInput) => {
    const b = castNow(i, (x) => place(x, { 1: 5000, 101: 5500 }));
    return used(again(b), 101);
  };
  assert.deepEqual(hitTwice(input(2, 0)), [2]);
  assert.deepEqual(hitTwice(input(1, 0)), [1]); // hết lần
  assert.deepEqual(hitTwice(input(2, 160)), [1]); // đang hồi chiêu
  assert.deepEqual(simulate(input(2, 160)).artifactUses?.[0].unitId, 101);
  assert.equal(simulate({ ...input(2, 160), teamB: [inert(101)] }).artifactUses, undefined);
});

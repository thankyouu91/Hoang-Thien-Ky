import { test } from "node:test";
import assert from "node:assert/strict";
import {
  Battle, BATTLE, composeTechnique, hitDamage, mul, techniqueFx, unitBonuses,
  type Element, type SkillType, type SkillMod, type Technique, type UnitSpec, type Unit, type BattleInput,
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

// Chỉ số trận từ trang bị và set (UnitSpec.bonuses)

test("khiên nhận được: khiên Thổ 5% máu × 1,06", () => {
  const { b } = firstHit({ seed: 1, teamA: [unit(1, 0, [tech("can_don", "tho")], { bonuses: { shieldTaken: 60 } })], teamB: [inert(101)] });
  assert.equal(get(b, 1).shield, 1060);
});

test("set chỉ làm mạnh hiệu ứng hệ đã có: tê liệt Lôi +5 tick, xuyên giáp Kim +3%", () => {
  const bonuses = { paralyzeTicks: 5, armorPen: 30 };
  const b = new Battle({ seed: 1, teamA: [unit(1, 0, [tech("can_don", "loi"), tech("can_don", "kim")], { bonuses })], teamB: [inert(101)] });
  const [loi, kim] = get(b, 1).slots;
  assert.deepEqual([loi.fx.paralyze, loi.fx.armorPen], [15, 0]);
  assert.deepEqual([kim.fx.paralyze, kim.fx.armorPen], [0, 130]);
});

test("bày trận, vận công nhanh hơn theo tick, trừ sau Tu trận; sàn 1 s và 0,5 s", () => {
  const cast = (type: "tran_phap" | "dien_rong", extra: Partial<UnitSpec>) => {
    const { b } = firstHit({ seed: 1, teamA: [unit(1, 0, [tech(type, "kim")], extra)], teamB: [inert(101)] });
    const e = b.events.find((e) => e.unitId === 1)!;
    return e.tick - e.startTick;
  };
  assert.equal(cast("tran_phap", { bonuses: { formationTicks: -10 } }), 90);
  assert.equal(cast("tran_phap", { talents: ["tu_tran"], bonuses: { formationTicks: -10 } }), 60);
  assert.equal(cast("tran_phap", { talents: ["tu_tran"], bonuses: { formationTicks: -60 } }), 20);
  assert.equal(cast("dien_rong", { bonuses: { channelTicks: -6 } }), 14);
  assert.equal(cast("dien_rong", { bonuses: { channelTicks: -15 } }), 10);
});

test("sát thương lên dị thú chỉ tính khi mục tiêu có cờ dị thú; boss chiến tranh không có cờ thì không tính", () => {
  const loss = (target: Partial<UnitSpec>, monsterDamage: number) => {
    const { b } = firstHit({ seed: 1, teamA: [unit(1, 0, [tech("can_don", "kim")], { bonuses: { monsterDamage } })], teamB: [inert(101, target)] });
    const t = get(b, 101);
    return t.hp - t.curHp;
  };
  const normal = loss({}, 0);
  assert.equal(loss({}, 50), normal);
  assert.ok(loss({ monster: true }, 50) > normal);
  assert.equal(loss({ boss: true }, 50), normal);
  assert.equal(loss({ boss: true, monster: true }, 50), loss({ monster: true }, 50));
});

// Ý châu (UnitSpec.skillMods): đổi hành vi một loại chiêu (tab Trang bị, phần 5)

/** Cho công pháp đầu của đơn vị 1 sẵn sàng ngay, chỉnh trận trước tick đầu, chạy 1 tick; trả về mục tiêu lần ra chiêu đó. */
const castNow = (input: BattleInput, setup: (b: Battle) => void = () => {}) => {
  const b = new Battle(input, true);
  get(b, 1).slots[0].cd = 0;
  setup(b);
  b.step();
  return { b, targets: b.events.find((e) => e.unitId === 1)?.targets ?? [] };
};
const place = (b: Battle, pos: Record<number, number>) => {
  for (const id of Object.keys(pos)) get(b, Number(id)).pos = pos[Number(id)];
};
const noCrit = { critBonus: -2000 };

test("Kiếm Ý: 15% sát thương cận chiến đơn đi thẳng vào máu dù có khiên", () => {
  const run = (shieldPierce: number) => {
    const { b } = castNow(
      { seed: 1, teamA: [unit(1, 0, [tech("can_don", "kim")], { skillMods: { can_don: { shieldPierce } } })], teamB: [inert(101)] },
      (x) => {
        place(x, { 1: 5000, 101: 5500 });
        get(x, 101).shield = 1_000_000;
        get(x, 101).shieldUntil = 1_000_000;
      },
    );
    const t = get(b, 101);
    return { hpLoss: t.hp - t.curHp, total: t.hp - t.curHp + 1_000_000 - t.shield };
  };
  assert.equal(run(0).hpLoss, 0);
  const r = run(150);
  assert.ok(r.hpLoss > 0);
  assert.equal(r.hpLoss, mul(r.total, 150));
});

test("Đao Ý: cận chiến quét trúng 6 mục tiêu, mục tiêu thứ 6 nhận 50%", () => {
  const foes = [101, 102, 103, 104, 105, 106].map((id) => inert(id));
  const { b, targets } = castNow(
    { seed: 1, teamA: [unit(1, 0, [tech("can_quet", "kim")], { bonuses: noCrit, skillMods: { can_quet: { extraTargets: 1, extraTargetDamage: 500 } } })], teamB: foes },
    (x) => place(x, { 1: 5000, 101: 5500, 102: 5500, 103: 5500, 104: 5500, 105: 5500, 106: 5500 }),
  );
  assert.deepEqual(targets, [101, 102, 103, 104, 105, 106]);
  const loss = (id: number) => get(b, id).hp - get(b, id).curHp;
  assert.equal(loss(105), loss(101));
  assert.equal(loss(106), mul(loss(101), 500));
});

test("Cung Ý: tầm xa +1 ô, không cộng dồn với tầm +1 ô của Âm lãnh", () => {
  const range = (t: Technique) => {
    const b = new Battle({ seed: 1, teamA: [unit(1, 1, [t], { skillMods: { tam_xa: { rangeBonus: 1000 } } })], teamB: [inert(101)] });
    return get(b, 1).slots[0].range;
  };
  assert.equal(range(tech("tam_xa", "kim")), 5000);
  assert.equal(range(tech("tam_xa", "am_lanh")), 5000);
});

test("Phiến Ý, Kỳ Ý: vận công, bày trận nhanh hơn, cộng với set, không dưới sàn", () => {
  const cast = (type: "tran_phap" | "dien_rong", extra: Partial<UnitSpec>) => {
    const { b } = firstHit({ seed: 1, teamA: [unit(1, 0, [tech(type, "kim")], extra)], teamB: [inert(101)] });
    const e = b.events.find((e) => e.unitId === 1)!;
    return e.tick - e.startTick;
  };
  assert.equal(cast("dien_rong", { skillMods: { dien_rong: { castTicks: -6 } } }), 14);
  assert.equal(cast("dien_rong", { bonuses: { channelTicks: -6 }, skillMods: { dien_rong: { castTicks: -6 } } }), 10);
  assert.equal(cast("tran_phap", { skillMods: { tran_phap: { castTicks: -10 } } }), 90);
  assert.equal(cast("tran_phap", { talents: ["tu_tran"], bonuses: { formationTicks: -10 }, skillMods: { tran_phap: { castTicks: -10 } } }), 50);
});

test("Cầm Ý: hồi phục tốn 90% mana (×2,7 thay ×3)", () => {
  const t = tech("hoi_phuc", "moc");
  const b = new Battle({ seed: 1, teamA: [unit(1, 1, [t], { skillMods: { hoi_phuc: { manaCost: 900, pick: "lowest_hp" } } })], teamB: [inert(101)] });
  assert.equal(get(b, 1).slots[0].cost, mul(t.manaCost, 900) * 1000);
});

test("Bút Ý: lần bùa chú đầu nhắm địch % máu thấp nhất trong tầm, lần sau như mặc định", () => {
  const input = {
    seed: 1, teamA: [unit(1, 1, [tech("bua_chu", "kim")], { skillMods: { bua_chu: { pick: "lowest_hp" as const, pickUses: 1 } } })],
    teamB: [inert(101), inert(102)],
  };
  const { b, targets } = castNow(input, (x) => {
    place(x, { 1: 4000, 101: 6000, 102: 7000 });
    get(x, 102).curHp = get(x, 102).hp / 2;
  });
  assert.deepEqual(targets, [102]);
  get(b, 1).slots[0].cd = 0;
  get(b, 1).mana = get(b, 1).manaMax;
  b.step();
  assert.deepEqual(b.events.filter((e) => e.unitId === 1).map((e) => e.targets[0]), [102, 101]);
});

test("Tiêu Ý: khống chế ưu tiên địch đang vận công", () => {
  const run = (pick?: "channeling") =>
    castNow({ seed: 1, teamA: [unit(1, 1, [tech("khong_che", "kim")], { skillMods: pick ? { khong_che: { pick } } : {} })], teamB: [inert(101), inert(102)] }, (x) => {
      place(x, { 1: 4000, 101: 5000, 102: 6000 });
      get(x, 102).channel = { slot: 0, startTick: 0, resolveTick: 1_000_000, center: 4000, ult: false, interruptible: true };
    }).targets;
  assert.deepEqual(run(), [101]);
  assert.deepEqual(run("channeling"), [102]);
});

test("Thương Ý: thân pháp lướt tới địch hàng sau % máu thấp nhất; không có ai hàng sau thì như mặc định", () => {
  const run = (back: boolean) =>
    castNow(
      {
        seed: 1, teamA: [unit(1, 0, [tech("than_phap", "kim")], { skillMods: { than_phap: { pick: "back_row_lowest_hp" } } })],
        teamB: [inert(101), inert(102, { row: back ? 1 : 0 }), inert(103, { row: back ? 1 : 0 })],
      },
      (x) => {
        place(x, { 1: 4000, 101: 5000, 102: 8000, 103: 9000 });
        get(x, 103).curHp = get(x, 103).hp / 2;
      },
    ).targets;
  assert.deepEqual(run(true), [103]);
  assert.deepEqual(run(false), [101]);
});

test("Côn Ý: hộ thể che trước đồng minh bị nhiều địch nhắm nhất", () => {
  const ally = (id: number) => unit(id, 0, [tech("can_don", "kim")], { manaMax: 0 });
  const run = (pick?: "most_targeted") => {
    const { b } = castNow(
      {
        seed: 1, teamA: [unit(1, 0, [tech("ho_the", "kim")], { skillMods: pick ? { ho_the: { pick } } : {} }), ally(2), ally(3), ally(4), ally(5)],
        teamB: [inert(101), inert(102), inert(103), inert(104)],
      },
      // Địch 101 đứng gần nhóm 2–4; ba địch còn lại vòng ra sau, ai cũng gần đơn vị 5 nhất.
      (x) => place(x, { 1: 4000, 2: 5000, 3: 4800, 4: 4600, 5: 2600, 101: 5500, 102: 2000, 103: 2000, 104: 2000 }),
    );
    return [1, 2, 3, 4, 5].filter((id) => get(b, id).shield > 0);
  };
  assert.deepEqual(run(), [2, 3, 4]);
  assert.deepEqual(run("most_targeted"), [2, 3, 5]);
});

test("Cầm Ý: 50% phần hồi tràn quá máu tối đa thành khiên giữ 3 s; khiên nhận được của người nhận vẫn tính", () => {
  const run = (missing: number, mod: SkillMod, ally: Partial<UnitSpec> = {}) => {
    const { b } = castNow(
      { seed: 1, teamA: [unit(1, 1, [tech("hoi_phuc", "moc")], { skillMods: { hoi_phuc: mod } }), unit(2, 0, [tech("can_don", "kim")], { manaMax: 0, ...ally })], teamB: [inert(101)] },
      (x) => {
        place(x, { 1: 3000, 2: 4000, 101: 9000 });
        get(x, 2).curHp = get(x, 2).hp - missing;
      },
    );
    return get(b, 2);
  };
  const healed = 10_000 - run(10_000, {}).hp + run(10_000, {}).curHp; // lượng hồi khi không tràn
  const mod = { overhealShield: 500, overhealShieldTicks: 60 };
  assert.equal(run(10, {}).shield, 0);
  const t = run(10, mod);
  assert.equal(t.curHp, t.hp);
  assert.equal(t.shield, mul(healed - 10, 500));
  assert.equal(t.shieldUntil, 60);
  assert.equal(run(10, mod, { bonuses: { shieldTaken: 60 } }).shield, mul(mul(healed - 10, 500), 1060));
  assert.equal(run(10_000, mod).shield, 0); // không tràn thì không có khiên
});

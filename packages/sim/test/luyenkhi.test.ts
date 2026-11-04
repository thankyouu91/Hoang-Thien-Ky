import { test } from "node:test";
import assert from "node:assert/strict";
import {
  Battle, composeTechnique, hitDamage, mul,
  type BattleInput, type Element, type SkillType, type Technique, type Unit, type UnitSpec,
} from "../src/index.ts";

// Luyện khí sau cấp tối đa (tab Trang bị, phần 13): khí văn (UnitSpec.setFx), danh văn (SkillMod), sàn khắc hệ.

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
const again = (b: Battle): Battle => {
  const u = get(b, 1);
  u.slots[0].cd = 0;
  u.mana = u.manaMax;
  b.step();
  return b;
};
const castNow = (input: BattleInput, setup: (b: Battle) => void = () => {}): Battle => {
  const b = new Battle(input, true);
  setup(b);
  return again(b);
};
const melee = (setFx = {}, target: Partial<UnitSpec> = {}, mods = {}) =>
  castNow({ seed: 1, teamA: [unit(1, 0, [tech("can_don")], { bonuses: noCrit, setFx, skillMods: { can_don: mods } })], teamB: [inert(101, 0, target)] },
    (x) => place(x, { 1: 5000, 101: 5500 }));
const near = (a: number, b: number) => Math.abs(a - b) <= 2;

test("sàn khắc hệ: sau trần khắc của bên bị đánh và kháng, khắc ×1,5 vẫn còn ít nhất ×1,2; Khắc Hệ Văn ×1,53", () => {
  const a = { atk: 1000, level: 50 };
  const t = tech("can_don", "kim");
  const d = { element: "moc" as Element, level: 50, def: 0 };
  const full = hitDamage(a, t, { ...d, resist: { kim: 200 } }, false, false);
  assert.equal(hitDamage(a, t, { ...d, resist: { kim: 200 } }, false, false, { counterCap: 1400 }), full); // kháng đủ 20%: trần ×1,4 không ăn
  assert.ok(hitDamage(a, t, d, false, false, { counterCap: 1400 }) < hitDamage(a, t, d, false, false));
  assert.ok(near(hitDamage(a, t, d, false, false, { counterBoost: 30 }), mul(hitDamage(a, t, d, false, false), 1020)));
  assert.equal(hitDamage(a, t, { ...d, element: "thuy" }, false, false, { counterBoost: 30 }), hitDamage(a, t, { ...d, element: "thuy" }, false, false)); // Kim sinh Thủy: không khắc
});

test("Truy Mệnh, Tiên Phát, Liên Kích: sát thương thêm đúng lúc", () => {
  const plain = loss(melee(), 101);
  assert.equal(loss(melee({ lowHpAllBelow: 200, lowHpAllBonus: 50 }), 101), plain); // mục tiêu còn đầy máu
  const weak = (setFx = {}) => loss(castNow({ seed: 1, teamA: [unit(1, 0, [tech("can_don")], { bonuses: noCrit, setFx })], teamB: [inert(101)] }, (x) => {
    place(x, { 1: 5000, 101: 5500 });
    get(x, 101).curHp = 100_000;
  }), 101) - 900_000;
  assert.ok(near(weak({ lowHpAllBelow: 200, lowHpAllBonus: 50 }), mul(weak(), 1050)));
  const opener = melee({ openerBonus: 150 });
  assert.ok(near(loss(opener, 101), mul(plain, 1150)));
  const before = loss(opener, 101);
  again(opener);
  assert.equal(loss(opener, 101) - before, plain); // chiêu thứ hai không còn
  const c = melee({ comboThirdBonus: 80 });
  const first = loss(c, 101);
  const h2 = (() => { const s = loss(c, 101); again(c); return loss(c, 101) - s; })();
  const h3 = (() => { const s = loss(c, 101); again(c); return loss(c, 101) - s; })();
  assert.equal(h2, first);
  assert.ok(near(h3, mul(first, 1080)), `${h3} / ${first}`);
});

test("Phá Thuẫn: đòn đầu lên mỗi tấm khiên +10%", () => {
  const run = (setFx = {}) => {
    const b = new Battle({ seed: 1, teamA: [unit(1, 0, [tech("can_don")], { bonuses: noCrit, setFx })], teamB: [inert(101)] }, true);
    place(b, { 1: 5000, 101: 5500 });
    const t = get(b, 101);
    t.shield = 1_000_000;
    t.shieldUntil = 1000;
    const hit = () => { const s = t.shield; again(b); return s - t.shield; };
    return [hit(), hit()];
  };
  const [p1, p2] = run();
  const [b1, b2] = run({ shieldBreakBonus: 100 });
  assert.equal(p1, p2);
  assert.ok(near(b1, mul(p1, 1100)));
  assert.equal(b2, p2);
});

test("Tụ Linh: hạ gục thì hồi 3% mana; Phản Chấn: phản 3% sát thương cận chiến", () => {
  const kill = (setFx = {}) => get(castNow({ seed: 1, teamA: [unit(1, 0, [tech("can_don")], { bonuses: noCrit, setFx })], teamB: [inert(101), inert(102)] }, (x) => {
    place(x, { 1: 5000, 101: 5500, 102: 9000 });
    get(x, 101).curHp = 1;
  }), 1);
  const u = kill({ killMana: 30 });
  assert.equal(u.mana - kill().mana, mul(u.manaMax, 30));
  const r = melee({}, { setFx: { meleeReflect: 30 } });
  assert.equal(loss(r, 1), mul(loss(r, 101), 30));
});

test("Hộ Mệnh: lần đầu máu dưới 25% thì khiên 8% máu tối đa", () => {
  const c = castNow({ seed: 1, teamA: [unit(1, 0, [tech("can_don")], { bonuses: noCrit })], teamB: [inert(101, 0, { setFx: { lastStandBelow: 250, lastStandShield: 80 } })] }, (x) => {
    place(x, { 1: 5000, 101: 5500 });
    get(x, 101).curHp = 250_500;
  });
  assert.equal(get(c, 101).shield, 80_000);
});

test("Thiết Bích, Tĩnh Tâm theo hàng; Hồi Xuân hồi 1% mỗi 5 s; Định Thân bị đẩy lùi nửa ô", () => {
  const b = new Battle({ seed: 1, teamA: [inert(1, 0, { def: 1000, setFx: { frontDef: 30, backMana: 30 } }), inert(2, 1, { manaMax: 300, setFx: { frontDef: 30, backMana: 30 } })], teamB: [inert(101)] });
  assert.equal(get(b, 1).def, 1030);
  assert.equal(get(b, 2).manaMax, 309_000);
  const h = new Battle({ seed: 1, teamA: [inert(1, 0, { setFx: { regenPulse: 10, regenPulseTicks: 100 } })], teamB: [inert(101, 0)] });
  get(h, 1).curHp = 500_000;
  get(h, 1).stunUntil = 1_000_000;
  for (let i = 0; i <= 100; i++) h.step();
  assert.equal(get(h, 1).curHp, 510_000);
  const push = (setFx = {}) => {
    const p = castNow({ seed: 1, teamA: [unit(1, 1, [tech("tam_xa", "phong")], { bonuses: noCrit })], teamB: [inert(101, 0, { setFx })] }, (x) => {
      place(x, { 1: 3000, 101: 6000 });
      get(x, 101).rootUntil = 1_000_000;
    });
    return get(p, 101).pos - 6000;
  };
  assert.equal(push({ knockbackResist: 500 }), push() / 2);
});

test("danh văn: Thiên Vấn Kiếm, Lạc Tinh Cung, Tạo Hóa Bút, Phá Thiên Thương", () => {
  const k = castNow({ seed: 1, teamA: [unit(1, 0, [tech("can_don")], { bonuses: { critBonus: 2000 }, skillMods: { can_don: { critCooldownCut: 10 } } })], teamB: [inert(101)] },
    (x) => place(x, { 1: 5000, 101: 5500 }));
  const s = get(k, 1).slots[0];
  assert.equal(s.cd, s.cooldown * 1000 - 10_000);
  const bow = (mods = {}) => loss(castNow({ seed: 1, teamA: [unit(1, 1, [tech("tam_xa")], { bonuses: noCrit, skillMods: { tam_xa: mods } })], teamB: [inert(101)] }, (x) => {
    place(x, { 1: 3000, 101: 6000 });
    get(x, 101).channel = { slot: 0, startTick: 0, resolveTick: 1_000_000, center: 3000, ult: false, interruptible: true, guarded: [], guardCut: 0, group: 101 };
  }), 101);
  assert.ok(near(bow({ channelTargetBonus: 200 }), mul(bow(), 1200)));
  const pen = new Battle({ seed: 1, teamA: [unit(1, 1, [tech("bua_chu")], { skillMods: { bua_chu: { extraUses: 1, useDamage: 850 } } })], teamB: [inert(101)] });
  assert.equal(get(pen, 1).slots[0].uses, 4);
  const dash = castNow({ seed: 1, teamA: [unit(1, 0, [tech("than_phap"), tech("can_don")], { bonuses: noCrit, skillMods: { than_phap: { dashPierceNext: 200 } } })], teamB: [inert(101)] },
    (x) => place(x, { 1: 3000, 101: 6000 }));
  assert.equal(get(dash, 1).nextPierce, 200);
});

test("danh văn: Đoạn Nhạc Đao, Phong Lôi Phiến, Bất Động Côn, Tinh La Kỳ, Vọng Nguyệt Cầm, Ngọc Lâu Tiêu", () => {
  const foes = [101, 102, 103, 104, 105, 106].map((id) => inert(id));
  const pos = { 1: 5000, 101: 5500, 102: 5500, 103: 5500, 104: 5500, 105: 5500, 106: 5500 };
  const sweep = castNow({ seed: 1, teamA: [unit(1, 0, [tech("can_quet")], { bonuses: noCrit, skillMods: { can_quet: { sweepShield: 10 } } })], teamB: foes.slice(0, 4) }, (x) => place(x, pos));
  assert.equal(get(sweep, 1).shield, mul(get(sweep, 1).hp, 20)); // 4 mục tiêu: 2 từ thứ 3
  const sweep2 = castNow({ seed: 1, teamA: [unit(1, 0, [tech("can_quet")], { bonuses: noCrit, skillMods: { can_quet: { sweepShield: 10, sweepShieldFrom: 2 } } })], teamB: foes.slice(0, 4) }, (x) => place(x, pos));
  assert.equal(get(sweep2, 1).shield, mul(get(sweep2, 1).hp, 30)); // từ thứ 2: 3 mục tiêu
  const fan = new Battle({ seed: 1, teamA: [unit(1, 0, [tech("dien_rong")], { skillMods: { dien_rong: { bigAoeHaste: 6 } } })], teamB: foes }, true);
  place(fan, pos);
  while (!fan.events.some((e) => e.unitId === 1)) fan.step();
  assert.equal(get(fan, 1).hasteAoe, true);
  const guard = castNow({ seed: 1, teamA: [unit(1, 0, [tech("ho_the")], { skillMods: { ho_the: { shieldBlocksControl: true } } })], teamB: [inert(101)] }, (x) => place(x, { 1: 4000, 101: 9000 }));
  guard.control(get(guard, 1), 30);
  assert.ok(get(guard, 1).stunUntil <= guard.tick);
  const ward = new Battle({ seed: 1, teamA: [unit(1, 0, [tech("tran_phap")], { skillMods: { tran_phap: { allyDefBuff: 50, allyDefTicks: 100 } } }), inert(2)], teamB: [inert(101)] }, true);
  for (const id of [2, 101]) get(ward, id).rootUntil = 1_000_000;
  place(ward, { 1: 4000, 2: 6500, 101: 7000 });
  while (!ward.events.some((e) => e.unitId === 1)) ward.step();
  assert.deepEqual([get(ward, 2).defBuff, get(ward, 2).defBuffUntil], [50, ward.tick - 1 + 100]);
  const heal = castNow({ seed: 1, teamA: [unit(1, 1, [tech("hoi_phuc", "moc")], { skillMods: { hoi_phuc: { cleanseBurn: true } } }), inert(2)], teamB: [inert(101)] }, (x) => {
    place(x, { 1: 3000, 2: 4000, 101: 9000 });
    get(x, 2).curHp -= 1000;
    get(x, 2).burn = 500;
  });
  assert.equal(get(heal, 2).burn, 0);
  const flute = castNow({ seed: 1, teamA: [unit(1, 1, [tech("khong_che")], { skillMods: { khong_che: { breakChannel: true } } })], teamB: [inert(101)] }, (x) => {
    place(x, { 1: 4000, 101: 6000 });
    get(x, 101).channel = { slot: 0, startTick: 0, resolveTick: 1_000_000, center: 4000, ult: false, interruptible: false, guarded: [], guardCut: 0, group: 101 };
  });
  assert.equal(get(flute, 101).channel, null); // trận pháp không cắt ngang được vẫn mất
});

test("tế luyện tầng: hồi chiêu pháp bảo sau Cổ Tông không dưới sàn", () => {
  const b = new Battle({ seed: 1, teamA: [inert(1, 0, { setFx: { artifactCooldownCut: 500 }, artifacts: [{ kind: "thuan", power: 500, uses: 2, cooldownTicks: 160, minCooldownTicks: 96 }] })], teamB: [inert(101)] });
  assert.equal(get(b, 1).artifacts[0].cooldownTicks, 96);
});

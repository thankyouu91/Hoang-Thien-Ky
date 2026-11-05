import { test } from "node:test";
import assert from "node:assert/strict";
import { baseStats, composeTechnique, type Element, type SkillType, type UnitSpec } from "@ktlp/sim";
import { gearStats, isKnownSetBehavior, withGear, withArtifacts, type EquipItem, type InlayLine } from "../src/index.ts";
import SET from "../../../data/he_thong/json/set.json" with { type: "json" };

// Hiệu ứng hành vi và khắc chế của set đổi sang sim (setfx.ts). Ấn: 006 Văn Uyên, 007 Ngọc Tủy, 008 Linh Tuyền,
// 004 Liệp Thú, 009 Băng Phách, 010 Lôi Trì, 012 Cổ Tông, 017 Vạn Kiếm, 003 Bàn Thạch.

const SLOT_KIEU = ["TB-KI-058", "TB-MU-001", "TB-AO-001", "TB-DA-001", "TB-BT-001", "TB-GI-001", "TB-NB-001"];
/** Mặc lần lượt các ô, mỗi món mang một ấn; vũ khí đỏ bí cảnh để còn dòng cho Ý châu. */
const sealed = (seals: string[], weaponExtra: InlayLine[] = []): EquipItem[] =>
  seals.map((ma, i) => ({
    kieu: SLOT_KIEU[i], nac: 0, doBen: 100, biCanh: i === 0 ? 80 : 0, dongThem: i === 0 ? 2 : 0,
    kham: [{ loai: "an", ma } as InlayLine, ...(i === 0 ? weaponExtra : [])],
  }));
const tech = (type: SkillType, element: Element) =>
  composeTechnique({ element, type, variant: "bao", grade: 1 }, [{ element, type, variant: "ben", grade: 1 }]);
const spec = (element: Element, techniques = [tech("can_don", element)]): UnitSpec =>
  ({ id: 1, level: 100, element, row: 0, ...baseStats(100), techniques });
const LV = 100;

test("mọi hiệu ứng hành vi và khắc chế trong set.json đều có cách đổi sang sim", () => {
  for (const b of SET.bo) {
    for (const m of b.moc) if (m.loai === "hanh_vi" || m.loai === "khac_che") assert.ok(isKnownSetBehavior(b.id, m.so), `${b.id} mốc ${m.so}`);
  }
});

test("Văn Uyên 7 món: mốc 4 giảm mana thi triển, sát thương chiêu nội; mốc 7 diện rộng đầu không vận công; cống hiến để ngoài trận", () => {
  const g = gearStats(sealed(Array(7).fill("NG-AN-006")), LV, []);
  const m4 = SET.bo.find((b) => b.id === "van_uyen")!.moc[1].tham_so as Record<string, number>;
  assert.deepEqual(g.setFx, { instantFirstAoe: true });
  assert.deepEqual([g.bonuses.manaCostCut, g.bonuses.innerDamage], [m4.manaCostCut, m4.innerDamage]);
  assert.equal(g.outside.congHienNopQuyen, 50);
});

test("Vạn Kiếm 7 món vào cận chiến đơn; Liệp Thú gộp với Cung Ý ở tầm xa", () => {
  assert.deepEqual(gearStats(sealed(Array(7).fill("NG-AN-017")), LV, []).skillMods.can_don, { lowHpBelow: 300, lowHpBonus: 150, qiCycleTicks: 100, qiDamage: 300 });
  const g = gearStats(sealed(Array(4).fill("NG-AN-004"), [{ loai: "y_chau", ma: "NG-YC-003" }]), LV, []);
  assert.deepEqual(g.skillMods.tam_xa, { rangeBonus: 1000 }); // Liệp Thú mốc 4 (set đồ 2.0) là chỉ số, không đổi cách chọn mục tiêu
  assert.equal(g.bonuses.monsterDamage, (SET.bo.find((b) => b.id === "liep_thu")!.moc[1].tham_so as Record<string, number>).satThuongPvE);
});

test("Ngọc Tủy mốc 4: mana, giảm mana thi triển, công lực giảm; mốc 7 kháng hệ địch nhiều nhất (sim tính đầu trận)", () => {
  const g = gearStats(sealed(Array(7).fill("NG-AN-007")), LV, ["moc"]);
  const m4 = SET.bo.find((b) => b.id === "ngoc_tuy")!.moc[1].tham_so as Record<string, number>;
  assert.equal(g.bonuses.manaCostCut, m4.manaCostCut);
  assert.ok(m4.atk < 0);
  assert.equal(g.resist.kim, undefined);
  assert.equal(g.setFx.resistTopEnemy, 80);
});

test("ràng buộc mốc 7: Lôi Trì cần công pháp hệ chủ Lôi hoặc Kim; Băng Phách không còn ràng buộc hệ (set đồ 2.0)", () => {
  const items = sealed(Array(7).fill("NG-AN-010"));
  const withLoi = withGear(spec("loi"), items);
  assert.deepEqual([withLoi.setFx?.bounceCrit, withLoi.setFx?.bounceDamage], [3, 500]);
  const g = gearStats(items, LV, ["moc"], undefined, ["moc"]);
  assert.equal(g.setFx.bounceCrit, undefined);
  assert.deepEqual(g.sets[0].thieuDieuKien, [7]);
  assert.equal(g.bonuses.critBonus, gearStats(items, LV, ["moc"]).bonuses.critBonus); // mốc 2, 4 vẫn có tác dụng
  assert.equal(withGear(spec("moc", [tech("can_don", "thuy")]), sealed(Array(7).fill("NG-AN-009"))).setFx?.chilledBonus, 80);
  assert.equal(withGear(spec("moc"), sealed(Array(7).fill("NG-AN-009"))).setFx?.chilledBonus, 80);
});

test("Linh Tuyền, Bàn Thạch vào setFx; phần bế quan, khai khoáng để ngoài trận", () => {
  const lt = gearStats(sealed(Array(7).fill("NG-AN-008")), LV, []);
  assert.deepEqual([lt.setFx.healerRegenPenalty, lt.setFx.resetHealOnFall, lt.outside.beQuan], [-100, 1, 50]);
  const bt = gearStats(sealed(Array(7).fill("NG-AN-003")), LV, []);
  const m7 = SET.bo.find((b) => b.id === "ban_thach")!.moc.find((m) => m.so === 7)!.tham_so as Record<string, number>;
  const m4 = SET.bo.find((b) => b.id === "ban_thach")!.moc[1].tham_so as Record<string, number>;
  const bare = gearStats(sealed(Array(7).fill("NG-AN-003")).map((it) => ({ ...it, kham: [] })), LV, []);
  // Mốc 4 là chỉ số (đồ cũng có thủ ngoại nên so với đồ không ấn).
  const b4 = bt.bonuses as Record<string, number>, r4 = bare.bonuses as Record<string, number>;
  for (const k of Object.keys(m4)) assert.equal((b4[k] ?? 0) - (r4[k] ?? 0), m4[k], k);
  if (m7.khienMau !== undefined) {
    assert.deepEqual([bt.setFx.lowHpShieldBelow, bt.setFx.lowHpShield, bt.setFx.lowHpShieldTicks, bt.setFx.petrifyBelow], [m7.nguongMau, m7.khienMau, m7.khienTicks, undefined]);
  } else {
    assert.deepEqual([bt.setFx.petrifyBelow, bt.setFx.petrifyTicks], [m7.nguongMau, m7.hoaDaTicks]);
  }
  assert.equal(bt.outside.khaiKhoang, m7.khaiKhoang);
});

test("Cổ Tông 7 món: pháp bảo thêm 1 lần (tối đa 3, không quá linh lực), hồi chiêu −15% trong trận", async () => {
  const { Battle } = await import("@ktlp/sim");
  const geared = withGear(spec("am_lanh"), sealed(Array(7).fill("NG-AN-012")));
  const armed = withArtifacts(geared, [{ ma: "PB-TH-001", linhLuc: 20, teLuyen: true, tuRen: false }], false);
  const a = new Battle({ seed: 1, teamA: [armed], teamB: [{ ...spec("kim"), id: 101 }] }).units.find((u) => u.id === 1)!.artifacts[0];
  assert.deepEqual([a.uses, a.cooldownTicks], [3, 136]);
});

test("Băng Phách mốc 4: khống chế trúng kẻ đang vận công thì dài thêm (setFx.controlChannelTicks)", () => {
  const m4 = SET.bo.find((b) => b.id === "bang_phach")!.moc[1].tham_so as Record<string, number>;
  assert.equal(gearStats(sealed(Array(4).fill("NG-AN-009")), LV, []).setFx.controlChannelTicks, m4.khongCheDangVanCongTicks);
});

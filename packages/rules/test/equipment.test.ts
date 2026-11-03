import { test } from "node:test";
import assert from "node:assert/strict";
import { Battle, baseStats, composeTechnique, type UnitSpec } from "@ktlp/sim";
import { gearStats, withGear, kieuInfo, maxInlayLines, setTier, isKnownSetStat, yChauMod, toSkillMod, type EquipItem, type InlayLine } from "../src/index.ts";
import SET from "../../../data/he_thong/json/set.json" with { type: "json" };
import NGOC from "../../../data/he_thong/json/ngoc.json" with { type: "json" };

const item = (kieu: string, extra: Partial<EquipItem> = {}): EquipItem => ({ kieu, nac: 0, doBen: 100, biCanh: 0, dongThem: 0, kham: [], ...extra });
const gem = (he: "kim" | "hoa" | "loi", cap: number): InlayLine => ({ loai: "ngoc", he, cap });
const seal = (ma: string): InlayLine => ({ loai: "an", ma });
const SLOT_KIEU = ["TB-KI-001", "TB-MU-001", "TB-AO-001", "TB-DA-001", "TB-BT-001", "TB-GI-001", "TB-NB-001"];
/** Mặc lần lượt các ô, mỗi món mang một ấn theo danh sách. */
const sealed = (...seals: string[]): EquipItem[] => seals.map((ma, i) => item(SLOT_KIEU[i], { kham: [seal(ma)] }));
/** Phần chỉ số do set cộng (số cộng thẳng hp, atk, def, manaMax và bonuses): so với chính các món đó khi gỡ hết ấn. */
const setBonuses = (items: EquipItem[], level = LV): Record<string, number> => {
  const flat = (it: EquipItem[]): Record<string, number> => {
    const g = gearStats(it, level, []);
    return { hp: g.hp, atk: g.atk, def: g.def, manaMax: g.manaMax, ...g.bonuses };
  };
  const all = flat(items);
  const bare = flat(items.map((it) => ({ ...it, kham: it.kham.filter((l) => !l || l.loai !== "an") })));
  const out: Record<string, number> = {};
  for (const k of Object.keys(all)) if (all[k] !== (bare[k] ?? 0)) out[k] = all[k] - (bare[k] ?? 0);
  return out;
};
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
  const g = gearStats([item("TB-KI-058", { nac: 30, biCanh: 80, dongThem: 2 })], LV, []);
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
  assert.deepEqual(g, { hp: 0, atk: 0, def: 0, manaMax: 0, bonuses: {}, resist: {}, elementDamage: {}, sets: [], outside: {}, skillMods: {} });
});

test("ngọc: ô công cộng sát thương hệ, ô thủ cộng kháng hệ, trùng linh căn ×1,2", () => {
  const weapon = item("TB-KI-001", { kham: [gem("kim", 5)] });
  assert.equal(gearStats([weapon], LV, []).elementDamage.kim, 75);
  assert.equal(gearStats([weapon], LV, ["kim"]).elementDamage.kim, 90);
  const armor = item("TB-AO-001", { kham: [gem("hoa", 3)] });
  assert.deepEqual(gearStats([armor], LV, []).resist, { hoa: 30 });
});

test("dòng khảm theo độ hiếm, đồ bí cảnh thêm 1 hoặc 2 dòng theo từng món, tối đa 5", () => {
  assert.equal(maxInlayLines(item("TB-KI-001")), 1);
  assert.equal(maxInlayLines(item("TB-KI-001", { biCanh: 50, dongThem: 1 })), 2);
  assert.equal(maxInlayLines(item("TB-KI-001", { biCanh: 50, dongThem: 2 })), 3);
  assert.equal(maxInlayLines(item("TB-KI-058", { biCanh: 50, dongThem: 2 })), 5);
  assert.throws(() => gearStats([item("TB-KI-001", { kham: [gem("kim", 1), gem("kim", 1)] })], LV, []));
  assert.throws(() => gearStats([item("TB-KI-001", { biCanh: 50, dongThem: 3 })], LV, []));
  assert.throws(() => gearStats([item("TB-KI-001", { biCanh: 50 })], LV, [])); // đồ bí cảnh phải có dòng thêm
  assert.throws(() => gearStats([item("TB-KI-001", { dongThem: 1 })], LV, [])); // đồ thường không có dòng thêm
});

test("món sai thì báo lỗi: trùng ô, nấc, thưởng bí cảnh, cấp ngọc", () => {
  assert.throws(() => gearStats([item("TB-KI-001"), item("TB-KI-025")], LV, []));
  assert.throws(() => gearStats([item("TB-KI-001", { nac: 51 })], LV, []));
  assert.throws(() => gearStats([item("TB-KI-001", { biCanh: 30 })], LV, []));
  assert.throws(() => gearStats([item("TB-KI-001", { kham: [gem("kim", 11)] })], LV, []));
});

test("bộ đỏ +30 rơi bí cảnh đủ 7 ô: công lực, máu, phòng thủ mỗi thứ cộng khoảng 35–40%", () => {
  const full = ["TB-KI-058", "TB-MU-058", "TB-AO-058", "TB-DA-058", "TB-BT-058", "TB-GI-058", "TB-NB-058"].map((k) => item(k, { nac: 30, biCanh: 80, dongThem: 2 }));
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

// Set đồ: ấn bộ trên dòng khảm, mốc 2/4/7 (set.json; mọi số là đề xuất)

test("mốc set theo số món: 3 món tính mốc 2, 5–6 món tính mốc 4", () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 7].map(setTier), [0, 0, 2, 2, 4, 4, 4, 7]);
});

test("dữ liệu set: mỗi bộ một ấn khớp ngoc.json, mọi khóa chỉ số đều có chỗ áp", () => {
  for (const b of SET.bo) {
    const an = NGOC.an_bo.find((a) => a.ma_vp === b.an);
    assert.equal(an?.bo, b.id, b.id);
    for (const m of b.moc) if (m.loai === "chi_so") for (const k of Object.keys(m.tham_so)) assert.ok(isKnownSetStat(k), `${b.id}: ${k}`);
  }
});

test("Vạn Kiếm 2 món: công lực +2% chỉ số chuẩn theo cấp, không tăng theo đồ; 1 món hoặc món hết độ bền thì không mở", () => {
  assert.deepEqual(setBonuses(sealed("NG-AN-017", "NG-AN-017")), { atk: 10 }); // 2% của 500
  assert.deepEqual(setBonuses(sealed("NG-AN-017", "NG-AN-017"), 1), { atk: 2 }); // 2% của 104
  const red = ["TB-KI-058", "TB-MU-058"].map((k) => item(k, { nac: 30, biCanh: 80, dongThem: 2, kham: [seal("NG-AN-017")] }));
  assert.deepEqual(setBonuses(red), { atk: 10 });
  assert.deepEqual(gearStats(sealed("NG-AN-017"), LV, []).sets, []);
  const broken = sealed("NG-AN-017", "NG-AN-017");
  broken[1].doBen = 0;
  assert.deepEqual(setBonuses(broken), {});
});

test("Lôi Trì 5 món là mốc 4: chí mạng +2%, tê liệt +5 tick, xuyên giáp +3%", () => {
  const items = sealed(...Array(5).fill("NG-AN-010"));
  assert.deepEqual(gearStats(items, LV, []).sets.map((s) => [s.bo, s.mon, s.moc, s.hieuUng.length]), [["loi_tri", 5, 4, 2]]);
  assert.deepEqual(setBonuses(items), { critBonus: 20, paralyzeTicks: 5, armorPen: 30 });
});

test("kháng từ set cộng với kháng từ ngọc; Hỗn Độn kháng mọi hệ", () => {
  const items = sealed("NG-AN-016", "NG-AN-016", "NG-AN-020", "NG-AN-020");
  items[2].kham = [gem("loi", 3)]; // áo: ô thủ, ngọc Lôi cấp 3 = 30, thay ấn Hỗn Độn
  items.push(item("TB-GI-001", { kham: [seal("NG-AN-020")] }));
  const g = gearStats(items, LV, []);
  assert.equal(g.resist.loi, 40 + 30 + 20);
  assert.equal(g.resist.kim, 20);
  assert.equal(g.resist.cuc_han, 20);
});

test("chỉ số ngoài trận để riêng; bộ chỉ có hiệu ứng kinh tế vẫn được liệt kê", () => {
  const items = sealed("NG-AN-011", "NG-AN-011", "NG-AN-011", "NG-AN-011", "NG-AN-001", "NG-AN-001");
  const g = gearStats(items, LV, []);
  assert.deepEqual(g.outside, { hoiChieuKichPhat: -50, kichPhat: 100 });
  assert.deepEqual(setBonuses(items), {});
  assert.deepEqual(g.sets.map((s) => [s.bo, s.moc]), [["ngu_thu", 4], ["tu_bao", 2]]);
});

test("ba bộ cùng mở 2+2+3; mỗi món tối đa 1 ấn, ấn phải có trong danh mục", () => {
  const items = sealed("NG-AN-017", "NG-AN-017", "NG-AN-005", "NG-AN-005", "NG-AN-008", "NG-AN-008", "NG-AN-008");
  assert.deepEqual(gearStats(items, LV, []).sets.map((s) => [s.bo, s.moc]), [["linh_tuyen", 2], ["thiet_ky", 2], ["van_kiem", 2]]);
  assert.deepEqual(setBonuses(items), { atk: 10, def: 15, healPower: 40 });
  const twoSeals = item("TB-KI-058", { kham: [seal("NG-AN-017"), seal("NG-AN-005")] });
  assert.throws(() => gearStats([twoSeals], LV, []));
  assert.throws(() => gearStats([item("TB-KI-001", { kham: [seal("NG-AN-999")] })], LV, []));
});

test("set vào trận: Lôi Trì mốc 4 làm tê liệt của công pháp Lôi dài thêm 5 tick", () => {
  const loi = composeTechnique({ element: "loi", type: "can_don", variant: "bao", grade: 1 }, [{ element: "loi", type: "can_don", variant: "ben", grade: 1 }]);
  const spec: UnitSpec = { id: 1, level: LV, element: "loi", row: 0, ...baseStats(LV), techniques: [loi] };
  const geared = withGear(spec, sealed(...Array(4).fill("NG-AN-010")));
  const b = new Battle({ seed: 1, teamA: [geared], teamB: [{ ...spec, id: 101 }] });
  const plain = new Battle({ seed: 1, teamA: [spec], teamB: [{ ...spec, id: 101 }] });
  const fx = (x: Battle) => x.units.find((u) => u.id === 1)!.slots[0].fx.paralyze;
  assert.equal(fx(b), fx(plain) + 5);
});

// Ý châu: chỉ khảm vũ khí, mỗi vũ khí 1 viên (tab Trang bị, phần 5)

const yc = (ma: string): InlayLine => ({ loai: "y_chau", ma });

test("mọi Ý châu trong ngoc.json đổi được sang cách chỉnh loại chiêu của sim", () => {
  for (const y of NGOC.y_chau) assert.equal(yChauMod(y.ma_vp).loai, y.loai_chieu, y.ma_vp);
  assert.deepEqual(yChauMod("NG-YC-001").mod, { shieldPierce: 150 });
  assert.deepEqual(yChauMod("NG-YC-002").mod, { extraTargets: 1, extraTargetDamage: 500 });
  assert.deepEqual(yChauMod("NG-YC-004").mod, { castTicks: -6 });
  assert.deepEqual(yChauMod("NG-YC-006").mod, { pick: "lowest_hp", pickUses: 1 });
  assert.equal(yChauMod("NG-YC-008").mod.manaCost, 900); // ×2,7 thay ×3; phần còn lại của Cầm Ý đang đổi, xem test riêng
  assert.deepEqual(yChauMod("NG-YC-010").mod, { pick: "back_row_lowest_hp" });
});

test("Ý châu chỉ vào vũ khí, mỗi vũ khí 1 viên; món hết độ bền thì không tính", () => {
  assert.deepEqual(gearStats([item("TB-KI-001", { kham: [yc("NG-YC-002")] })], LV, []).skillMods, { can_quet: { extraTargets: 1, extraTargetDamage: 500 } });
  assert.throws(() => gearStats([item("TB-AO-001", { kham: [yc("NG-YC-002")] })], LV, []));
  assert.throws(() => gearStats([item("TB-KI-025", { kham: [yc("NG-YC-002"), yc("NG-YC-003")] })], LV, []));
  assert.throws(() => gearStats([item("TB-KI-001", { kham: [yc("NG-YC-999")] })], LV, []));
  assert.deepEqual(gearStats([item("TB-KI-001", { doBen: 0, kham: [yc("NG-YC-002")] })], LV, []).skillMods, {});
});

test("Ý châu vào trận: Cung Ý cho tầm xa thêm 1 ô", () => {
  const bow = composeTechnique({ element: "kim", type: "tam_xa", variant: "bao", grade: 1 }, [{ element: "kim", type: "tam_xa", variant: "ben", grade: 1 }]);
  const spec: UnitSpec = { id: 1, level: LV, element: "kim", row: 1, ...baseStats(LV), techniques: [bow] };
  const range = (s: UnitSpec) => new Battle({ seed: 1, teamA: [s], teamB: [{ ...spec, id: 101 }] }).units.find((u) => u.id === 1)!.slots[0].range;
  assert.equal(range(withGear(spec, [item("TB-KI-001", { kham: [yc("NG-YC-003")] })])), range(spec) + 1000);
});

test("Cầm Ý mới (đề xuất của phiên set đồ): hồi tràn thành khiên 50% giữ 3 s, mana ×2,7", () => {
  assert.deepEqual(toSkillMod("hoi_phuc", { tranThanhKhien: 500, khienTicks: 60, heSoMana: 2700 }, "NG-YC-008"), {
    overhealShield: 500, overhealShieldTicks: 60, manaCost: 900,
  });
  assert.throws(() => toSkillMod("can_don", { heSoMana: 2700 }, "x"));
  assert.throws(() => toSkillMod("can_don", { khoaLa: 1 }, "x"));
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { HIDDEN_RULES, baseStats, composeTechnique, type UnitSpec } from "@ktlp/sim";
import {
  diemTrangBi, dongAnNguong, gearStats, ghepAn, isKnownSetStat, phuRow, withGear,
  type Bac, type EquipItem, type InlayLine,
} from "../src/index.ts";
import SET from "../../../data/he_thong/json/set.json" with { type: "json" };

// Set đồ 2.0 (tab Trang bị, phần 14): bậc ấn, hợp bộ, binh bộ, dòng rèn, dòng ẩn, điểm trang bị.

const SLOT_KIEU = ["TB-KI-001", "TB-MU-001", "TB-AO-001", "TB-DA-001", "TB-BT-001", "TB-GI-001", "TB-NB-001"];
const item = (kieu: string, extra: Partial<EquipItem> = {}): EquipItem => ({ kieu, nac: 0, doBen: 100, biCanh: 0, dongThem: 0, kham: [], ...extra });
const red = (kieu: string, extra: Partial<EquipItem> = {}) => item(kieu, { nac: 30, biCanh: 80, dongThem: 2, ...extra });
const seal = (ma: string, bac?: Bac): InlayLine => (bac ? { loai: "an", ma, bac } : { loai: "an", ma });
/** Mặc lần lượt các ô, mỗi món một ấn; `bacs` là bậc từng viên (không ghi là tím). */
const sealed = (ma: string, bacs: (Bac | undefined)[]): EquipItem[] => bacs.map((b, i) => item(SLOT_KIEU[i], { kham: [seal(ma, b)] }));
const LV = 100; // công lực chuẩn 500
const atkOf = (items: EquipItem[]) => gearStats(items, LV, []).atk - gearStats(items.map((x) => ({ ...x, kham: [] })), LV, []).atk;

test("bậc ấn: hệ số mốc 2, 4 theo ấn bậc thấp nhất; mốc 7 cần cả 7 ấn từ tím", () => {
  assert.equal(atkOf(sealed("NG-AN-017", [undefined, undefined])), 10); // Vạn Kiếm công lực +2% của 500
  assert.equal(atkOf(sealed("NG-AN-017", ["luc", "luc"])), 6); // ×0,6
  assert.equal(atkOf(sealed("NG-AN-017", ["do", "do"])), 12); // ×1,2
  assert.equal(atkOf(sealed("NG-AN-017", ["do", "luc"])), 6);
  const s7 = gearStats(sealed("NG-AN-017", ["tim", "tim", "tim", "tim", "tim", "tim", "lam"]), LV, []).sets[0];
  assert.deepEqual([s7.moc, s7.moc7ThieuBac, s7.bac, s7.heSo2, s7.heSo4], [4, true, "lam", 800, 800]);
  assert.equal(gearStats(sealed("NG-AN-017", Array(7).fill("vang")), LV, []).sets[0].moc, 7);
});

test("ấn bộ thần chỉ có từ tím; ghép 3 ấn cùng bậc lên bậc trên, chỉ lục lên lam, lam lên tím", () => {
  assert.throws(() => gearStats(sealed("NG-AN-018", ["lam", "lam"]), LV, [])); // Chu Thiên
  assert.equal(gearStats(sealed("NG-AN-018", ["tim", "tim"]), LV, []).sets.length, 1);
  assert.deepEqual([ghepAn("luc", 3), ghepAn("lam", 3)], ["lam", "tim"]);
  assert.throws(() => ghepAn("tim", 3));
  assert.throws(() => ghepAn("luc", 2));
});

test("hợp bộ: hai bộ tương sinh mốc 2 ×1,2; bộ bị bộ đang kích khắc ×0,8", () => {
  // Vạn Kiếm (Kim) và Linh Tuyền (Thủy) tương sinh.
  const sinh = gearStats([...sealed("NG-AN-017", [undefined, undefined]), item("TB-AO-001", { kham: [seal("NG-AN-008")] }), item("TB-DA-001", { kham: [seal("NG-AN-008")] })], LV, []);
  assert.deepEqual(sinh.sets.map((s) => [s.bo, s.heSo2, s.hopBo.nguon]), [["linh_tuyen", 1200, "tuong_sinh"], ["van_kiem", 1200, "tuong_sinh"]]);
  // Tụ Bảo (Kim) khắc Ngự Thú (Mộc).
  const khac = gearStats([...sealed("NG-AN-001", [undefined, undefined]), item("TB-AO-001", { kham: [seal("NG-AN-011")] }), item("TB-DA-001", { kham: [seal("NG-AN-011")] })], LV, []);
  assert.deepEqual(khac.sets.map((s) => [s.bo, s.heSo2, s.hopBo.biKhac]), [["ngu_thu", 800, "tu_bao"], ["tu_bao", 1000, null]]);
});

test("binh bộ: binh ấn chỉ ở 3 ô công; mốc 2, mốc 3; đồng lộ với ấn bộ đang kích thì mốc 3 ×1,2", () => {
  const ba = (o: string, bac?: Bac): EquipItem => red(`TB-${o}-058`, { kham: [bac ? { loai: "binh_an", ma: "NG-BA-001", bac } : { loai: "binh_an", ma: "NG-BA-001" }] });
  const bare = gearStats(["KI", "BT", "NB"].map((o) => red(`TB-${o}-058`)), LV, []).bonuses;
  const three = gearStats(["KI", "BT", "NB"].map((o) => ba(o)), LV, []);
  assert.deepEqual(three.binhBo, { bo: "bao_kich", mon: 3, moc: 3, bac: "tim", dongLo: false });
  assert.deepEqual([three.bonuses.critBonus! - (bare.critBonus ?? 0), three.bonuses.critDamage! - (bare.critDamage ?? 0)], [20, 80]);
  const two = gearStats([ba("KI"), ba("BT")], LV, []);
  assert.equal(two.binhBo?.moc, 2);
  // Vạn Kiếm (Ngoại Công) đang kích: Bạo Kích cùng lộ.
  const vk = (o: string) => item(`TB-${o}-001`, { kham: [seal("NG-AN-017")] });
  const dong = gearStats([ba("KI"), ba("BT"), ba("NB"), vk("MU"), vk("AO")], LV, []);
  const bareDong = gearStats([red("TB-KI-058"), red("TB-BT-058"), red("TB-NB-058"), vk("MU"), vk("AO")], LV, []);
  assert.equal(dong.binhBo?.dongLo, true);
  assert.equal(dong.bonuses.critDamage! - (bareDong.bonuses.critDamage ?? 0), 96);
  assert.throws(() => gearStats([red("TB-AO-058", { kham: [{ loai: "binh_an", ma: "NG-BA-001" }] })], LV, []));
  assert.throws(() => gearStats([red("TB-KI-058", { kham: [{ loai: "binh_an", ma: "NG-BA-001" }, { loai: "binh_an", ma: "NG-BA-002" }] })], LV, []));
});

test("dòng rèn: mỗi mốc +10 mở một dòng, nửa giá trị loại phụ đã chọn; tụt nấc dưới mốc thì dòng tắt", () => {
  const stat = (n: number) => phuRow("vu_khi", n).stat as "critDamage";
  const at = (nac: number, ren?: number[]) => gearStats([item("TB-KI-058", { nac, ren })], LV, []).bonuses;
  const full = at(30, [2, 2, 2]);
  const none = at(30);
  const one = at(15, [2, 2, 2]);
  const phu2 = gearStats([item("TB-KI-058", { nac: 30, phu: 2 })], LV, []).bonuses[stat(2)]!;
  const line = full[stat(2)]! - (none[stat(2)] ?? 0);
  assert.ok(Math.abs(line - 3 * Math.trunc(phu2 / 2)) <= 3, `${line} / ${phu2}`);
  assert.ok((one[stat(2)] ?? 0) > 0 && (one[stat(2)] ?? 0) < line);
  assert.throws(() => gearStats([item("TB-KI-058", { nac: 30, ren: [1, 1, 1, 1, 1, 1] })], LV, []));
  assert.throws(() => gearStats([item("TB-KI-058", { nac: 30, ren: [9] })], LV, []));
});

test("dòng ẩn: chỉ ngọc bội và đai, số dòng theo độ hiếm; điều kiện tĩnh xét trước trận; song ẩn ×1,5", () => {
  const nb = (dongAn: EquipItem["dongAn"], extra: Partial<EquipItem> = {}) => red("TB-NB-058", { dongAn, ...extra });
  const front = { dk: "DN-DK-009", hu: "DN-HU-001" };
  assert.deepEqual(gearStats([nb([front])], LV, []).hidden, [{ cond: "front", stat: "atk", value: 30 }]);
  const song = gearStats([nb([front]), red("TB-DA-058", { dongAn: [{ dk: "DN-DK-009", hu: "DN-HU-004" }] })], LV, []);
  assert.deepEqual(song.hidden, [{ cond: "front", stat: "atk", value: 45 }, { cond: "front", stat: "critBonus", value: 30 }]);
  assert.deepEqual(song.hiddenSource, [{ kieu: "TB-NB-058", dong: 0 }, { kieu: "TB-DA-058", dong: 0 }]);
  // Khí linh dưới cấp 3: dòng không vào trận. Linh căn trùng hệ ngọc trên món: luôn bật.
  assert.deepEqual(gearStats([nb([{ dk: "DN-DK-011", hu: "DN-HU-001" }])], LV, []).hidden, []);
  const gemLine = nb([{ dk: "DN-DK-003", hu: "DN-HU-012" }], { kham: [{ loai: "ngoc", he: "kim", cap: 3 }] });
  assert.deepEqual(gearStats([gemLine], LV, ["kim"]).hidden, [{ cond: "always", stat: "counterResist", value: 30 }]);
  assert.deepEqual(gearStats([gemLine], LV, ["moc"]).hidden, []);
  assert.throws(() => gearStats([red("TB-KI-058", { dongAn: [front] })], LV, []));
  assert.throws(() => gearStats([item("TB-NB-001", { dongAn: [front] })], LV, [])); // lục không có dòng ẩn
  assert.throws(() => gearStats([nb([front, front, front, front])], LV, []));
  // Vào trận: withGear nối dòng ẩn vào UnitSpec.hidden.
  const tech = composeTechnique({ element: "kim", type: "can_don", variant: "bao", grade: 1 }, [{ element: "kim", type: "can_don", variant: "ben", grade: 1 }]);
  const spec: UnitSpec = { id: 1, level: LV, element: "kim", row: 0, ...baseStats(LV), techniques: [tech] };
  assert.deepEqual(withGear(spec, [nb([front])]).hidden, [{ cond: "front", stat: "atk", value: 30 }]);
  assert.equal(withGear(spec, [red("TB-NB-058")]).hidden, undefined);
});

test("điểm trang bị: chỉ số theo % nhân điểm; hồi máu mỗi giây tính mỗi 0,1%; đồ tốt hơn điểm cao hơn", () => {
  const empty = { hp: 0, atk: 0, def: 0, manaMax: 0, bonuses: {}, resist: {}, elementDamage: {} };
  assert.equal(diemTrangBi(empty, LV), 0);
  assert.equal(diemTrangBi({ ...empty, bonuses: { critBonus: 10 } }, LV), 12);
  assert.equal(diemTrangBi({ ...empty, bonuses: { hpRegen: 2 } }, LV), 20);
  assert.equal(diemTrangBi({ ...empty, atk: baseStats(LV).atk / 100 }, LV), 10); // công lực +1%
  const lucSet = ["KI", "MU", "AO", "DA", "BT", "GI", "NB"].map((o) => item(`TB-${o}-001`));
  const redSet = ["KI", "MU", "AO", "DA", "BT", "GI", "NB"].map((o) => red(`TB-${o}-058`));
  assert.ok(diemTrangBi(gearStats(redSet, LV, []), LV) > 3 * diemTrangBi(gearStats(lucSet, LV, []), LV));
});

test("dữ liệu set đồ 2.0: khóa chỉ số của binh bộ có chỗ áp; ngưỡng dòng ẩn khớp sim", () => {
  const binh = (SET as unknown as { binh_bo: { moc_2: { tham_so: object }; moc_3: { tham_so: object } }[] }).binh_bo;
  for (const b of binh) for (const k of [...Object.keys(b.moc_2.tham_so), ...Object.keys(b.moc_3.tham_so)]) assert.ok(isKnownSetStat(k), k);
  const n = dongAnNguong();
  assert.deepEqual([n.mauDuoi, n.truocTicks, n.sauTicks], [HIDDEN_RULES.lowHpBelow, HIDDEN_RULES.openingTicks, HIDDEN_RULES.lateTicks]);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { HIDDEN_RULES, baseStats, composeTechnique, type UnitSpec } from "@ktlp/sim";
import {
  DONG_REN, SONG_AN, diemChiSo, diemTrangBi, dongAnHeSo, dongAnNguong, gearStats, ghepAn, isKnownSetStat, phuRow, withGear,
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
/** Số ở mốc `so` của bộ `bo` trong set.json. */
const MOC = (bo: string, so: number) => (SET.bo.find((b) => b.id === bo)!.moc.find((m) => m.so === so)!.tham_so as Record<string, number>);
/** Công lực cộng thẳng của set: phần nghìn `giaTri` (đã nhân hệ số `heSo`) của công lực chuẩn `chuan`. */
const atkSet = (giaTri: number, heSo = 1000, chuan = 500) => Math.trunc((chuan * Math.trunc((giaTri * heSo) / 1000)) / 1000);

const atkOf = (items: EquipItem[]) => gearStats(items, LV, []).atk - gearStats(items.map((x) => ({ ...x, kham: [] })), LV, []).atk;

test("bậc ấn: hệ số mốc 2, 4 theo ấn bậc thấp nhất; mốc 7 cần cả 7 ấn từ tím", () => {
  const vk = MOC("van_kiem", 2).atk; // Vạn Kiếm công lực mốc 2
  assert.equal(atkOf(sealed("NG-AN-017", [undefined, undefined])), atkSet(vk));
  assert.equal(atkOf(sealed("NG-AN-017", ["luc", "luc"])), atkSet(vk, 600));
  assert.equal(atkOf(sealed("NG-AN-017", ["do", "do"])), atkSet(vk, 1200));
  assert.equal(atkOf(sealed("NG-AN-017", ["do", "luc"])), atkSet(vk, 600));
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
  const bk = (SET as unknown as { binh_bo: { id: string; moc_2: { tham_so: Record<string, number> }; moc_3: { tham_so: Record<string, number> } }[] }).binh_bo.find((b) => b.id === "bao_kich")!;
  assert.deepEqual([three.bonuses.critBonus! - (bare.critBonus ?? 0), three.bonuses.critDamage! - (bare.critDamage ?? 0)], [bk.moc_2.tham_so.critBonus, bk.moc_3.tham_so.critDamage]);
  const two = gearStats([ba("KI"), ba("BT")], LV, []);
  assert.equal(two.binhBo?.moc, 2);
  // Vạn Kiếm (Ngoại Công) đang kích: Bạo Kích cùng lộ.
  const vk = (o: string) => item(`TB-${o}-001`, { kham: [seal("NG-AN-017")] });
  const dong = gearStats([ba("KI"), ba("BT"), ba("NB"), vk("MU"), vk("AO")], LV, []);
  const bareDong = gearStats([red("TB-KI-058"), red("TB-BT-058"), red("TB-NB-058"), vk("MU"), vk("AO")], LV, []);
  assert.equal(dong.binhBo?.dongLo, true);
  assert.equal(dong.bonuses.critDamage! - (bareDong.bonuses.critDamage ?? 0), Math.trunc((bk.moc_3.tham_so.critDamage * 1200) / 1000));
  assert.throws(() => gearStats([red("TB-AO-058", { kham: [{ loai: "binh_an", ma: "NG-BA-001" }] })], LV, []));
  assert.throws(() => gearStats([red("TB-KI-058", { kham: [{ loai: "binh_an", ma: "NG-BA-001" }, { loai: "binh_an", ma: "NG-BA-002" }] })], LV, []));
});

test("dòng rèn: mỗi mốc +10 mở một dòng, DONG_REN.tyLe giá trị loại phụ đã chọn; tụt nấc dưới mốc thì dòng tắt", () => {
  const stat = (n: number) => phuRow("vu_khi", n).stat as "critDamage";
  const at = (nac: number, ren?: number[]) => gearStats([item("TB-KI-058", { nac, ren })], LV, []).bonuses;
  const full = at(30, [2, 2, 2]);
  const none = at(30);
  const one = at(15, [2, 2, 2]);
  const phu2 = gearStats([item("TB-KI-058", { nac: 30, phu: 2 })], LV, []).bonuses[stat(2)]!;
  const line = full[stat(2)]! - (none[stat(2)] ?? 0);
  assert.ok(Math.abs(line - (3 * phu2 * DONG_REN.tyLe) / 1000) <= 3, `${line} / ${phu2}`);
  assert.ok((one[stat(2)] ?? 0) > 0 && (one[stat(2)] ?? 0) < line);
  assert.throws(() => gearStats([item("TB-KI-058", { nac: 30, ren: [1, 1, 1, 1, 1, 1] })], LV, []));
  assert.throws(() => gearStats([item("TB-KI-058", { nac: 30, ren: [9] })], LV, []));
});

test("dòng ẩn: chỉ ngọc bội và đai, số dòng theo độ hiếm; điều kiện tĩnh xét trước trận; hệ số nhóm; song ẩn", () => {
  const nb = (dongAn: EquipItem["dongAn"], extra: Partial<EquipItem> = {}) => red("TB-NB-058", { dongAn, ...extra });
  const front = { dk: "DN-DK-009", hu: "DN-HU-001" }; // đứng hàng trước (nhóm tĩnh), công lực +3%
  const v = (giaTri: number, dk: string, song = false) => {
    const x = Math.trunc((giaTri * dongAnHeSo(dk)) / 1000);
    return song ? Math.trunc((x * SONG_AN) / 1000) : x;
  };
  assert.deepEqual(gearStats([nb([front])], LV, []).hidden, [{ cond: "front", stat: "atk", value: v(30, "DN-DK-009") }]);
  // Nhóm tĩnh thấp nhất, rồi theo loại trận, trong trận cao nhất (số ở trang_bi.json dong_an[].he_so).
  assert.ok(dongAnHeSo("DN-DK-009") <= dongAnHeSo("DN-DK-004") && dongAnHeSo("DN-DK-004") <= dongAnHeSo("DN-DK-006"));
  const song = gearStats([nb([front]), red("TB-DA-058", { dongAn: [{ dk: "DN-DK-009", hu: "DN-HU-004" }] })], LV, []);
  const byStat = (h: { stat: string }[]) => h.slice().sort((a, b) => a.stat.localeCompare(b.stat));
  assert.deepEqual(byStat(song.hidden), [{ cond: "front", stat: "atk", value: v(30, "DN-DK-009", true) }, { cond: "front", stat: "critBonus", value: v(20, "DN-DK-009", true) }]);
  // Khí linh dưới cấp 3: dòng không vào trận. Linh căn trùng hệ ngọc trên món: luôn bật.
  assert.deepEqual(gearStats([nb([{ dk: "DN-DK-011", hu: "DN-HU-001" }])], LV, []).hidden, []);
  const gemLine = nb([{ dk: "DN-DK-003", hu: "DN-HU-012" }], { kham: [{ loai: "ngoc", he: "kim", cap: 3 }] });
  assert.deepEqual(gearStats([gemLine], LV, ["kim"]).hidden, [{ cond: "always", stat: "counterResist", value: v(30, "DN-DK-003") }]);
  assert.deepEqual(gearStats([gemLine], LV, ["moc"]).hidden, []);
  assert.throws(() => gearStats([red("TB-KI-058", { dongAn: [front] })], LV, []));
  assert.throws(() => gearStats([item("TB-NB-001", { dongAn: [front] })], LV, [])); // lục không có dòng ẩn
  assert.throws(() => gearStats([nb([front, front, front, front])], LV, []));
  // Vào trận: withGear nối dòng ẩn vào UnitSpec.hidden.
  const tech = composeTechnique({ element: "kim", type: "can_don", variant: "bao", grade: 1 }, [{ element: "kim", type: "can_don", variant: "ben", grade: 1 }]);
  const spec: UnitSpec = { id: 1, level: LV, element: "kim", row: 0, ...baseStats(LV), techniques: [tech] };
  assert.deepEqual(withGear(spec, [nb([front])]).hidden, [{ cond: "front", stat: "atk", value: v(30, "DN-DK-009") }]);
  assert.equal(withGear(spec, [red("TB-NB-058")]).hidden, undefined);
});

test("dòng ẩn xếp theo điểm sau hệ số (cao trước), hòa thì ngọc bội trước đai rồi theo thứ tự dòng", () => {
  const lines = [{ dk: "DN-DK-009", hu: "DN-HU-001" }, { dk: "DN-DK-006", hu: "DN-HU-001" }, { dk: "DN-DK-004", hu: "DN-HU-004" }];
  const g = gearStats([red("TB-NB-058", { dongAn: lines }), red("TB-DA-058", { dongAn: [{ dk: "DN-DK-006", hu: "DN-HU-002" }] })], LV, []);
  const d = g.hidden.map((h) => diemChiSo(h.stat, h.value));
  for (let i = 1; i < d.length; i++) assert.ok(d[i - 1] >= d[i], `${d}`);
  assert.equal(g.hidden[0].cond, "lowHp"); // trong trận ×1,0 đứng đầu
  assert.equal(g.hidden.length, 4); // rules giữ cả; sim bật tối đa HIDDEN_RULES.maxActive dòng đang đúng
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

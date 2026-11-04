import { test } from "node:test";
import assert from "node:assert/strict";
import {
  artifactSpecs, danhKhiOf, gearStats, khiLinhLevel, khiTinhPhanGiai, khiVanSlots, phapBaoLinhLucToiDa, scaleSkillMod, tayLuyen,
  type EquipItem, type InlayLine, type PhapBaoItem,
} from "../src/index.ts";
import LK from "../../../data/he_thong/json/luyen_khi.json" with { type: "json" };
import SET from "../../../data/he_thong/json/set.json" with { type: "json" };

// Luyện khí sau cấp tối đa (luyen_khi.ts; tab Trang bị, phần 13).

const item = (kieu: string, extra: Partial<EquipItem> = {}): EquipItem => ({ kieu, nac: 0, doBen: 100, biCanh: 0, dongThem: 0, kham: [], ...extra });
const red = (kieu: string, extra: Partial<EquipItem> = {}) => item(kieu, { nac: 30, biCanh: 80, dongThem: 2, ...extra });
const gem = (he: "kim" | "moc" | "thuy", cap: number): InlayLine => ({ loai: "ngoc", he, cap });
const MAX_KN = 4500;
const LV = 100;
const KICH = (LK.luat as { khiVanKichToiDa?: number }).khiVanKichToiDa ?? 3;
const kvGia = (ma: string) => LK.khi_van.find((k) => k.ma === ma)!.gia_tri;

test("khí linh: cấp theo kinh nghiệm, +0,5% mỗi cấp cộng cùng chỗ với cường hóa; chỉ đồ từ tím", () => {
  assert.deepEqual([0, 99, 100, 300, 4499, MAX_KN].map(khiLinhLevel), [0, 0, 1, 2, 8, 9]);
  const base = gearStats([item("TB-KI-025")], LV, []).atk; // lam: không có khí linh
  assert.throws(() => gearStats([item("TB-KI-025", { khiLinhKn: 100 })], LV, []));
  const tim = gearStats([item("TB-KI-041")], LV, []).atk;
  const tim9 = gearStats([item("TB-KI-041", { khiLinhKn: MAX_KN })], LV, []).atk;
  assert.ok(base > 0 && tim9 > tim);
  assert.ok(Math.abs(tim9 - Math.trunc((tim * 1045) / 1000)) <= 1, `${tim9} / ${tim}`);
});

test("ô khí văn: mở ở cấp 3, 6, 9, tối đa theo độ hiếm; đúng nhóm ô", () => {
  assert.deepEqual([khiVanSlots(600, "tim"), khiVanSlots(MAX_KN, "tim"), khiVanSlots(2100, "do"), khiVanSlots(MAX_KN, "do")], [1, 1, 2, 3]);
  assert.throws(() => gearStats([red("TB-KI-058", { khiLinhKn: 600, khiVan: ["KV-CO-001", "KV-CO-002"] })], LV, []));
  assert.throws(() => gearStats([red("TB-KI-058", { khiLinhKn: 600, khiVan: ["KV-TH-001"] })], LV, [])); // vũ khí là ô công
  assert.deepEqual(gearStats([red("TB-KI-058", { khiLinhKn: 600, khiVan: ["KV-CO-003"] })], LV, []).setFx, { openerBonus: 150 });
});

test("khí văn trên nhiều món tính 1 lần; Ngự Khắc Văn với Hỗn Độn lấy trần khắc thấp hơn", () => {
  const kv = (o: string, ma: string) => red(`TB-${o}-058`, { khiLinhKn: MAX_KN, khiVan: [ma] });
  const g = gearStats([kv("KI", "KV-CO-005"), kv("BT", "KV-CO-005"), kv("NB", "KV-CO-005")], LV, []);
  assert.deepEqual([g.khiVan["KV-CO-005"], g.setFx.counterBoost], [1, kvGia("KV-CO-005") - 1500]);
  const t = gearStats([kv("MU", "KV-TH-002"), kv("AO", "KV-TH-002")], LV, []);
  assert.equal(t.setFx.counterCap, kvGia("KV-TH-002"));
  const hd = SET.bo.find((b) => b.id === "hon_don")!.an;
  const both = [{ ...kv("MU", "KV-TH-002"), kham: [{ loai: "an", ma: hd } as InlayLine] }, ...["AO", "DA", "GI"].map((o) => red(`TB-${o}-058`, { kham: [{ loai: "an", ma: hd }] }))];
  assert.equal(gearStats(both, LV, []).setFx.counterCap, 1400); // Hỗn Độn mốc 4 ×1,4 thấp hơn 1470
  const lieu = gearStats([kv("KI", "KV-CO-008")], LV, []);
  assert.equal(lieu.bonuses.monsterDamage, kvGia("KV-CO-008"));
  assert.equal(gearStats([kv("MU", "KV-TH-007")], LV, []).setFx.knockbackResist, kvGia("KV-TH-007")); // Định Thân: đẩy ngắn đi
  const kvSo = (ma: string) => LK.khi_van.find((k) => k.ma === ma)!.tham_so as Record<string, number>;
  const hm = gearStats([kv("MU", "KV-TH-001")], LV, []).setFx;
  assert.deepEqual([hm.lastStandBelow, hm.lastStandShield], [kvSo("KV-TH-001").nguongMau, kvGia("KV-TH-001")]);
  assert.equal(gearStats([kv("MU", "KV-TH-006")], LV, []).setFx.regenPulseTicks, kvSo("KV-TH-006").chuKyTicks);
  assert.equal(gearStats([kv("KI", "KV-CO-002")], LV, []).setFx.lowHpAllBelow, kvSo("KV-CO-002").nguongMau);
});

test("khí văn kích: tối đa luat.khiVanKichToiDa khí văn khác nhau có trên đồ; không chọn thì lấy theo thứ tự món", () => {
  const items = [
    red("TB-KI-058", { khiLinhKn: MAX_KN, khiVan: ["KV-CO-001", "KV-CO-002", "KV-CO-003"] }),
    red("TB-BT-058", { khiLinhKn: MAX_KN, khiVan: ["KV-CO-004"] }),
  ];
  const all = ["KV-CO-001", "KV-CO-002", "KV-CO-003", "KV-CO-004"];
  const d = gearStats(items, LV, []);
  assert.deepEqual(Object.keys(d.khiVan), all);
  assert.deepEqual(d.khiVanKich, all.slice(0, KICH));
  if (KICH < 4) assert.equal(d.setFx.comboThirdBonus, undefined); // khí văn thứ 4 chỉ để sưu tầm
  const c = gearStats(items, LV, [], undefined, undefined, ["KV-CO-004", "KV-CO-003"]);
  assert.deepEqual([c.setFx.comboThirdBonus, c.setFx.openerBonus, c.setFx.shieldBreakBonus], [kvGia("KV-CO-004"), kvGia("KV-CO-003"), undefined]);
  assert.deepEqual(gearStats(items, LV, [], undefined, undefined, []).setFx, {});
  assert.throws(() => gearStats(items, LV, [], undefined, undefined, all.concat(["KV-CO-005"]).slice(0, KICH + 1)));
  assert.throws(() => gearStats(items, LV, [], undefined, undefined, ["KV-TH-001"])); // không có trên đồ
  assert.throws(() => gearStats(items, LV, [], undefined, undefined, ["KV-CO-003", "KV-CO-003"]));
});

test("tẩy luyện: đổi loại chỉ số phụ trong 4 loại của ô; Tu rèn chọn thẳng", () => {
  assert.equal(tayLuyen(1, 0), 2);
  assert.equal(tayLuyen(1, 5), 4);
  assert.equal(tayLuyen(3, 1, 1), 1);
  assert.throws(() => tayLuyen(2, 0, 2));
  const g = gearStats([item("TB-KI-001", { phu: 2 })], LV, []);
  assert.deepEqual([g.bonuses.critDamage, g.bonuses.armorPen], [undefined, 10]);
  assert.throws(() => gearStats([item("TB-KI-001", { phu: 5 })], LV, []));
});

test("phân giải: Khí Tinh theo độ hiếm cộng 1 mỗi cấp khí linh; đồ lục không phân giải", () => {
  assert.equal(khiTinhPhanGiai("do", MAX_KN), 25 + 9);
  assert.equal(khiTinhPhanGiai("lam", 0), 1);
  assert.throws(() => khiTinhPhanGiai("luc", 0));
});

test("ngọc song hệ: mỗi hệ 60%, cần hai hệ tương sinh hoặc tương hợp; Phách nâng trần mềm hệ đó lên 28%", () => {
  const sh = gearStats([red("TB-KI-058", { kham: [{ loai: "song_he", he: ["kim", "thuy"], cap: 10 }] })], LV, []);
  assert.deepEqual(sh.elementDamage, { kim: 66, thuy: 66 }); // 110 × 60%
  assert.throws(() => gearStats([red("TB-KI-058", { kham: [{ loai: "song_he", he: ["kim", "moc"], cap: 10 }] })], LV, []));
  const five = Array(5).fill(gem("kim", 10));
  assert.equal(gearStats([red("TB-KI-058", { kham: five })], LV, []).elementDamage.kim, 250);
  const withPhach = [...five.slice(0, 4), { loai: "phach", ma: "NG-PH-001" } as InlayLine];
  assert.equal(gearStats([red("TB-KI-058", { kham: withPhach })], LV, []).elementDamage.kim, 280);
  assert.throws(() => gearStats([red("TB-AO-058", { kham: [{ loai: "phach", ma: "NG-PH-001" }] })], LV, [])); // ô thủ
});

test("danh khí: Ý của khí hình nhân luat.danhKhiYHeSo, không chiếm dòng khảm, cộng danh văn; không khảm thêm Ý châu", () => {
  assert.deepEqual(danhKhiOf("TB-KI-061"), { khiHinh: "kiem", yChau: "NG-YC-001" });
  assert.equal(danhKhiOf("TB-KI-058"), null);
  const yOf = (kieu: string, loai: "can_don" | "hoi_phuc") => {
    const ma = danhKhiOf(kieu)!.yChau;
    const base = gearStats([red("TB-KI-058", { kham: [{ loai: "y_chau", ma }] })], LV, []).skillMods[loai]!;
    return scaleSkillMod(base, LK.luat.danhKhiYHeSo);
  };
  const kiem = yOf("TB-KI-061", "can_don");
  const dv = (ma: string) => LK.danh_khi.find((d) => d.ma_vp === ma)!.tham_so as Record<string, number>;
  assert.deepEqual(gearStats([red("TB-KI-061")], LV, []).skillMods, { can_don: { ...kiem, critCooldownCut: dv("TB-KI-061").hoiChieuNhanhTicks } });
  const dao = gearStats([red("TB-KI-062")], LV, []).skillMods.can_quet!;
  assert.deepEqual([dao.sweepShield, dao.sweepShieldFrom], [dv("TB-KI-062").khienMoiMucTieu, dv("TB-KI-062").tuMucTieuThu]);
  const ky = gearStats([red("TB-KI-067")], LV, []).skillMods.tran_phap!;
  assert.deepEqual([ky.allyDefBuff, ky.allyDefTicks], [dv("TB-KI-067").phongThuThem, dv("TB-KI-067").thoiGianTicks]);
  if (LK.luat.danhKhiYHeSo === 1500) assert.equal(kiem.shieldPierce, 225);
  const cam = gearStats([red("TB-KI-068")], LV, []).skillMods.hoi_phuc!;
  const camY = yOf("TB-KI-068", "hoi_phuc");
  assert.deepEqual([cam.manaCost, cam.overhealShield, cam.cleanseBurn], [camY.manaCost, camY.overhealShield, true]);
  if (LK.luat.danhKhiYHeSo === 1500) assert.deepEqual([cam.manaCost, cam.overhealShield], [850, 750]); // mana ×0,9 → ×0,85
  assert.throws(() => gearStats([red("TB-KI-061", { kham: [{ loai: "y_chau", ma: "NG-YC-001" }] })], LV, []));
  assert.equal(LK.danh_khi.length, 10);
  for (const d of LK.danh_khi) assert.ok(gearStats([red(d.ma_vp)], LV, []).skillMods, d.ma_vp);
});

test("tế luyện tầng: linh lực tối đa +10% mỗi tầng, hồi chiêu −2% mỗi tầng; chỉ từ Trung vị; sàn 60%", () => {
  const pb = (tang: number, linhLuc = 20): PhapBaoItem => ({ ma: "PB-TH-001", linhLuc, teLuyen: true, tuRen: false, tang });
  assert.equal(phapBaoLinhLucToiDa(pb(3)), 26);
  const [a] = artifactSpecs([pb(3, 26)], true);
  assert.deepEqual([a.cooldownTicks, a.minCooldownTicks, a.energy], [150, 96, 26]);
  assert.throws(() => artifactSpecs([pb(1)], false));
  assert.throws(() => artifactSpecs([pb(0, 21)], true));
});

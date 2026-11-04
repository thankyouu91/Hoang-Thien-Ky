import { test } from "node:test";
import assert from "node:assert/strict";
import {
  artifactSpecs, danhKhiOf, gearStats, khiLinhLevel, khiTinhPhanGiai, khiVanSlots, phapBaoLinhLucToiDa, tayLuyen,
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

test("khí văn trên nhiều món tính tối đa 2 lần; Ngự Khắc Văn với Hỗn Độn lấy trần khắc thấp hơn", () => {
  const kv = (o: string, ma: string) => red(`TB-${o}-058`, { khiLinhKn: MAX_KN, khiVan: [ma] });
  const g = gearStats([kv("KI", "KV-CO-005"), kv("BT", "KV-CO-005"), kv("NB", "KV-CO-005")], LV, []);
  assert.deepEqual([g.khiVan["KV-CO-005"], g.setFx.counterBoost], [2, 60]);
  const t = gearStats([kv("MU", "KV-TH-002"), kv("AO", "KV-TH-002")], LV, []);
  assert.equal(t.setFx.counterCap, 1440); // 1500 − 30 × 2
  const hd = SET.bo.find((b) => b.id === "hon_don")!.an;
  const both = [{ ...kv("MU", "KV-TH-002"), kham: [{ loai: "an", ma: hd } as InlayLine] }, ...["AO", "DA", "GI"].map((o) => red(`TB-${o}-058`, { kham: [{ loai: "an", ma: hd }] }))];
  assert.equal(gearStats(both, LV, []).setFx.counterCap, 1400); // Hỗn Độn mốc 4 ×1,4 thấp hơn 1470
  const lieu = gearStats([kv("KI", "KV-CO-008")], LV, []);
  assert.equal(lieu.bonuses.monsterDamage, 40);
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

test("danh khí: Ý của khí hình ×1,5 không chiếm dòng khảm, cộng danh văn; không khảm thêm Ý châu", () => {
  assert.deepEqual(danhKhiOf("TB-KI-061"), { khiHinh: "kiem", yChau: "NG-YC-001" });
  assert.equal(danhKhiOf("TB-KI-058"), null);
  assert.deepEqual(gearStats([red("TB-KI-061")], LV, []).skillMods, { can_don: { shieldPierce: 225, critCooldownCut: 10 } });
  const cam = gearStats([red("TB-KI-068")], LV, []).skillMods.hoi_phuc!;
  assert.deepEqual([cam.manaCost, cam.overhealShield, cam.cleanseBurn], [850, 750, true]); // mana ×0,9 → ×0,85
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

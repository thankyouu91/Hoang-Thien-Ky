import { test } from "node:test";
import assert from "node:assert/strict";
import { composeTechnique, comboRelation, effectValue, mul, SKILL_SPECS, COMBO, type Scroll } from "../src/index.ts";

const scroll = (s: Partial<Scroll> & Pick<Scroll, "element">): Scroll => ({ type: "can_don", variant: "bao", grade: 1, ...s });

test("ví dụ GDD mục 9: Lôi Quang Liên Hoàn Quyết", () => {
  // Tử Điện Liên Hoàn (Lôi, cận chiến quét, Linh) + Phá Hiểu Cố Bản (Quang, Bền)
  const t = composeTechnique(
    scroll({ element: "loi", type: "can_quet", variant: "linh" }),
    [scroll({ element: "quang", variant: "ben" })],
  );
  assert.equal(t.damage, 105000); // 105 (GDD cũ ghi 110 với tương hợp ×1,10; chốt ×1,05)
  assert.equal(t.targets, 5);
  assert.equal(t.critPerMille, 80); // 8%
  assert.equal(t.cooldownTicks, 40); // 2 s
  assert.equal(t.combo, COMBO.harmony);
  assert.deepEqual(t.effects, [{ element: "loi", power: 1500 }, { element: "quang", power: 1000 }]);
  assert.equal(effectValue(t.effects[0]).value, 15); // tê liệt 0,75 s khi chí mạng
  assert.equal(effectValue(t.effects[1]).value, 20); // hồi máu 2% sát thương
});

test("ví dụ GDD mục 9: Lôi Âm Châm Quyết", () => {
  // Tử Điện Châm (Lôi, tầm xa, Linh) + Âm Sát Xạ (Âm lãnh, Bền)
  const t = composeTechnique(
    scroll({ element: "loi", type: "tam_xa", variant: "linh" }),
    [scroll({ element: "am_lanh", variant: "ben" })],
  );
  assert.equal(t.damage, 95000); // 95
  assert.equal(t.targets, 2);
  assert.equal(t.critPerMille, 120); // 12%
  assert.equal(t.cooldownTicks, 20); // 1 s
  assert.equal(t.rangeBonus, 500); // Âm lãnh tầm +1 ô, ở phụ quyển góp một nửa
  assert.equal(effectValue(t.effects[0]).value, 15); // tê liệt 0,75 s
  assert.equal(effectValue(t.effects[1]).value, 30); // hút máu 3%
});

test("tầm cộng thêm tối đa 1 ô dù chủ và phụ quyển đều là Âm lãnh", () => {
  const t = composeTechnique(scroll({ element: "am_lanh", type: "tam_xa" }), [scroll({ element: "am_lanh" })]);
  assert.equal(t.rangeBonus, 1000);
});

test("hệ số tổ hợp giữa hệ chủ và hệ phụ", () => {
  assert.equal(comboRelation("loi", "loi").t, COMBO.pure); // thuần
  assert.equal(comboRelation("kim", "moc").t, COMBO.clash); // tương khắc
  assert.equal(comboRelation("moc", "kim").t, COMBO.clash);
  assert.equal(comboRelation("phong", "kim").t, COMBO.clash); // Phong quy về Mộc
  assert.equal(comboRelation("moc", "hoa").t, COMBO.harmony); // tương sinh
  assert.equal(comboRelation("loi", "tho").t, COMBO.harmony); // Thổ sinh Kim, Lôi quy về Kim
  assert.equal(comboRelation("loi", "kim").t, COMBO.harmony); // biến dị với hệ gốc
  assert.equal(comboRelation("loi", "quang").t, COMBO.harmony); // ví dụ GDD
  assert.equal(comboRelation("quang", "loi").t, COMBO.harmony);
  assert.equal(comboRelation("loi", "am_lanh").t, COMBO.neutral); // trung tính, ví dụ GDD
  assert.deepEqual(comboRelation("cuc_duong", "cuc_am"), { t: COMBO.polar, manaMul: 1500 });
  assert.deepEqual(comboRelation("quang", "am_lanh"), { t: COMBO.polar, manaMul: 1500 });
});

test("đối cực hợp nhất: sát thương ×1,12, mana ×1,5", () => {
  const t = composeTechnique(
    scroll({ element: "cuc_duong", type: "dien_rong" }),
    [scroll({ element: "cuc_am" })],
  );
  assert.equal(t.combo, 1120);
  // 100 × k của diện rộng × (1 + 0,15 + 0,05) × 1,12
  assert.equal(t.damage, Math.trunc((Math.trunc((100 * SKILL_SPECS.dien_rong.k * 1200) / 1000) * 1120) / 1000));
  assert.equal(t.manaCost, mul(mul(SKILL_SPECS.dien_rong.mana, 1050), 1500)); // mana gốc × 1,05 (Cực dương) × 1,5
});

test("phẩm công pháp bằng phẩm thấp nhất", () => {
  const t = composeTechnique(scroll({ element: "moc", grade: 3 }), [scroll({ element: "moc", variant: "ben", grade: 2 })]);
  assert.equal(t.grade, 2);
  assert.equal(t.damage, 193050); // 100 × 1,3 × 1,25 × 1,1 × 1,08
});

test("Tốc giảm hồi chiêu 10%", () => {
  const fast = composeTechnique(scroll({ element: "kim", variant: "toc" }), [scroll({ element: "kim" })]);
  const normal = composeTechnique(scroll({ element: "kim" }), [scroll({ element: "kim" })]);
  assert.equal(normal.cooldownTicks, 20);
  assert.equal(fast.cooldownTicks, 18);
});

test("hai phụ quyển: hệ số tổ hợp là trung bình hai quan hệ", () => {
  const t = composeTechnique(scroll({ element: "loi" }), [scroll({ element: "quang" }), scroll({ element: "moc" })]);
  assert.equal(t.combo, 985); // (1050 + 920) / 2
  assert.deepEqual(t.subElements, ["quang", "moc"]);
});

test("trùng hệ thì hiệu ứng giữ mức mạnh nhất, không cộng dồn", () => {
  const t = composeTechnique(scroll({ element: "loi", variant: "ben" }), [scroll({ element: "loi", variant: "linh" })]);
  assert.deepEqual(t.effects, [{ element: "loi", power: 1500 }]);
});

test("ghép sai thì báo lỗi", () => {
  assert.throws(() => composeTechnique(scroll({ element: "kim" }), []));
  assert.throws(() => composeTechnique(scroll({ element: "kim" }), [scroll({ element: "kim" }), scroll({ element: "kim" }), scroll({ element: "kim" })]));
  assert.throws(() => composeTechnique(scroll({ element: "kim", grade: 0 }), [scroll({ element: "kim" })]));
  assert.throws(() => composeTechnique(scroll({ element: "kim", grade: 11 }), [scroll({ element: "kim" })]));
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { mul } from "@ktlp/sim";
import {
  apply, emptyState, addMember, applyLayer, layerBonus, layerCost, loadoutTechniques, techniqueOf, trainingPoints,
  DIEM_LUYEN_MOI_CAP, TECHNIQUE_LAYERS, type GameState, type Result,
} from "../src/index.ts";

// Tầng công pháp (layers.ts; đề xuất 2026-11-05 của phiên Bảng Điểm): điểm luyện theo cấp, giá theo phẩm, chỉ số trận theo tầng.

const NOW = 1_800_000_000_000;
const ok = (r: Result) => {
  assert.equal(r.ok, true, r.ok ? "" : r.error);
  return r.ok ? r.events : [];
};
const err = (r: Result) => (r.ok ? "ok" : r.error);

/** Người "a" cấp `level` đã ghép công pháp tân thủ phẩm 1 và mang vào trận; trả về mã công pháp. */
function world(level: number): { s: GameState; id: number } {
  const s = emptyState();
  addMember(s, "a", null, null, level);
  const uids = ["kim.can_don.bao", "loi.can_quet.linh"].map((kind) => {
    const [e] = ok(apply(s, { type: "nhat_tan_quyen", actor: "system", memberId: "a", kind, grade: 1 }, NOW));
    return e.type === "nhat_tan_quyen" ? e.scroll.uid : -1;
  });
  const [e] = ok(apply(s, { type: "ghep_tan_thu", actor: "a", main: uids[0], subs: [uids[1]] }, NOW));
  const id = e.type === "ghep_tan_thu" ? e.technique.techniqueId : -1;
  ok(apply(s, { type: "mang_vao_tran", actor: "a", techniqueIds: [id] }, NOW));
  return { s, id };
}

test("bảng tầng: tầng 1 không cộng gì, tầng 10 cộng nhiều nhất; giá theo phẩm", () => {
  assert.equal(TECHNIQUE_LAYERS, 10);
  assert.deepEqual(layerBonus(1), { uyLuc: 0, hoiChieu: 0, mana: 0 });
  const top = layerBonus(TECHNIQUE_LAYERS);
  assert.ok(top.uyLuc > 0 && top.hoiChieu >= 0 && top.mana > 0);
  for (let k = 2; k <= TECHNIQUE_LAYERS; k++) assert.ok(layerBonus(k).uyLuc >= layerBonus(k - 1).uyLuc, `tầng ${k}`);
  const p = layerCost(4, 1), h = layerCost(4, 2);
  assert.ok(h.diemLuyen > p.diemLuyen && h.congHien === 2 * p.congHien); // Hoàng: điểm × 1,25, cống hiến × 2
  assert.throws(() => layerCost(1, 1));
  assert.throws(() => layerCost(TECHNIQUE_LAYERS + 1, 1));
});

test("điểm luyện: (cấp − 1) × điểm mỗi cấp, trừ giá các tầng đã lên", () => {
  const { s, id } = world(5);
  const m = s.members.a;
  assert.equal(trainingPoints(m), 4 * DIEM_LUYEN_MOI_CAP);
  const [e] = ok(apply(s, { type: "len_tang_cong_phap", actor: "a", techniqueId: id }, NOW));
  assert.deepEqual(e, { type: "len_tang_cong_phap", memberId: "a", techniqueId: id, layer: 2, ...layerCost(2, 1) });
  assert.equal(trainingPoints(m), 4 * DIEM_LUYEN_MOI_CAP - layerCost(2, 1).diemLuyen);
  m.level = 6; // lên cấp thì có thêm điểm
  assert.equal(trainingPoints(m), 5 * DIEM_LUYEN_MOI_CAP - layerCost(2, 1).diemLuyen);
});

test("lên tầng: trừ cống hiến; lỗi thiếu điểm, thiếu cống hiến, dừng tầng, đã tối đa, chưa học", () => {
  const { s, id } = world(1);
  const m = s.members.a;
  assert.equal(err(apply(s, { type: "len_tang_cong_phap", actor: "a", techniqueId: id }, NOW)), "thieu_diem_luyen");
  assert.equal(err(apply(s, { type: "len_tang_cong_phap", actor: "a", techniqueId: 9999 }, NOW)), "chua_hoc");
  assert.equal(err(apply(s, { type: "len_tang_cong_phap", actor: "ai", techniqueId: id }, NOW)), "khong_co_thanh_vien");
  m.level = 500;
  // Lên tới tầng có giá cống hiến đầu tiên thì cần cống hiến.
  let k = 2;
  while (layerCost(k, 1).congHien === 0) {
    ok(apply(s, { type: "len_tang_cong_phap", actor: "a", techniqueId: id }, NOW));
    k++;
  }
  assert.equal(err(apply(s, { type: "len_tang_cong_phap", actor: "a", techniqueId: id }, NOW)), "thieu_cong_hien");
  m.contribution = layerCost(k, 1).congHien + 7;
  ok(apply(s, { type: "len_tang_cong_phap", actor: "a", techniqueId: id }, NOW));
  assert.deepEqual([m.learned[0].layer, m.contribution], [k, 7]);
  m.contribution = 1_000_000;
  while (m.learned[0].layer < TECHNIQUE_LAYERS) ok(apply(s, { type: "len_tang_cong_phap", actor: "a", techniqueId: id }, NOW));
  assert.equal(err(apply(s, { type: "len_tang_cong_phap", actor: "a", techniqueId: id }, NOW)), "da_toi_tang");
  m.learned[0].frozen = true;
  m.learned[0].layer = 5;
  assert.equal(err(apply(s, { type: "len_tang_cong_phap", actor: "a", techniqueId: id }, NOW)), "cong_phap_dung_tang");
});

test("vào trận: công pháp mang theo áp tầng (sát thương, hồi chiêu, mana); tầng 1 giữ nguyên", () => {
  const { s } = world(1);
  const l = s.members.a.learned[0];
  const base = techniqueOf(l);
  assert.deepEqual(loadoutTechniques(s, "a")[0], base);
  assert.equal(applyLayer(base, 1), base);
  l.layer = TECHNIQUE_LAYERS;
  const b = layerBonus(TECHNIQUE_LAYERS);
  const t = loadoutTechniques(s, "a")[0];
  assert.deepEqual([t.damage, t.cooldownTicks, t.manaCost], [
    mul(base.damage, 1000 + b.uyLuc), Math.max(1, mul(base.cooldownTicks, 1000 - b.hoiChieu)), mul(base.manaCost, 1000 - b.mana),
  ]);
});

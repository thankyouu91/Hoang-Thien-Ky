import { test } from "node:test";
import assert from "node:assert/strict";
import { Battle, baseStats, composeTechnique, unitBonuses, type UnitSpec } from "@ktlp/sim";
import {
  apply, emptyState, addMember, attributeBonuses, unspentPoints, withAttributes, ATTRIBUTES, DIEM_MOI_CAP,
  type GameState, type Result,
} from "../src/index.ts";

// Điểm tiềm năng (tiem_nang.ts): điểm theo cấp, cộng vào thuộc tính, mốc mềm, tẩy điểm, gộp vào trận.

const NOW = 1_800_000_000_000;
const ok = (r: Result) => {
  assert.equal(r.ok, true, r.ok ? "" : r.error);
  return r.ok ? r.events : [];
};
const err = (r: Result) => (r.ok ? "ok" : r.error);
function world(level: number): GameState {
  const s = emptyState();
  addMember(s, "a", null, null, level);
  return s;
}

test("điểm chưa cộng = (cấp − 1) × điểm mỗi cấp trừ đã cộng; cộng sai thì báo lỗi, không đổi trạng thái", () => {
  const s = world(11);
  const m = s.members.a;
  assert.equal(unspentPoints(m), 10 * DIEM_MOI_CAP);
  assert.deepEqual(ok(apply(s, { type: "cong_diem", actor: "a", thuocTinh: "khi_luc", diem: 4 }, NOW)), [{ type: "cong_diem", memberId: "a", thuocTinh: "khi_luc", diem: 4 }]);
  ok(apply(s, { type: "cong_diem", actor: "a", thuocTinh: "khi_luc", diem: 1 }, NOW));
  assert.deepEqual([m.diemTiemNang, unspentPoints(m)], [{ khi_luc: 5 }, 10 * DIEM_MOI_CAP - 5]);
  assert.equal(err(apply(s, { type: "cong_diem", actor: "a", thuocTinh: "khong_co", diem: 1 }, NOW)), "thuoc_tinh_sai");
  assert.equal(err(apply(s, { type: "cong_diem", actor: "a", thuocTinh: "khi_luc", diem: 0 }, NOW)), "diem_khong_hop_le");
  assert.equal(err(apply(s, { type: "cong_diem", actor: "a", thuocTinh: "khi_luc", diem: 1.5 }, NOW)), "diem_khong_hop_le");
  assert.equal(err(apply(s, { type: "cong_diem", actor: "a", thuocTinh: "khi_luc", diem: 10 * DIEM_MOI_CAP }, NOW)), "thieu_diem_tiem_nang");
  assert.equal(err(apply(s, { type: "cong_diem", actor: "ai", thuocTinh: "khi_luc", diem: 1 }, NOW)), "khong_co_thanh_vien");
  assert.deepEqual(m.diemTiemNang, { khi_luc: 5 });
  // Tẩy điểm trả lại hết.
  assert.deepEqual(ok(apply(s, { type: "tay_diem", actor: "a" }, NOW)), [{ type: "tay_diem", memberId: "a", diem: 5 }]);
  assert.deepEqual([m.diemTiemNang, unspentPoints(m)], [{}, 10 * DIEM_MOI_CAP]);
});

test("chỉ số: moiDiem mỗi điểm; từ điểm 121 mỗi điểm còn nửa; gộp nhiều thuộc tính", () => {
  const s = world(500);
  const m = s.members.a;
  assert.deepEqual(attributeBonuses(m), {});
  m.diemTiemNang = { the_phach: 100 };
  assert.deepEqual(attributeBonuses(m), { hp: 100 });
  m.diemTiemNang = { the_phach: 140 }; // 120 + 20 × 0,5
  assert.deepEqual(attributeBonuses(m), { hp: 130 });
  m.diemTiemNang = { khi_luc: 10, linh_luc: 10, than_phap: 10 };
  assert.deepEqual(attributeBonuses(m), { atk: 8, manaMax: 25, manaCostCut: 4, attackSpeed: 15, cooldownCut: 10 });
  assert.equal(ATTRIBUTES.length, 6);
});

test("vào trận: withAttributes cộng vào UnitSpec.bonuses; không cộng điểm thì giữ nguyên đơn vị", () => {
  const s = world(200);
  const m = s.members.a;
  const tech = composeTechnique({ element: "kim", type: "can_don", variant: "bao", grade: 1 }, [{ element: "kim", type: "can_don", variant: "ben", grade: 1 }]);
  const spec: UnitSpec = { id: 1, level: 200, element: "kim", row: 0, ...baseStats(200), techniques: [tech], bonuses: { atk: 50 } };
  assert.equal(withAttributes(spec, m), spec);
  m.diemTiemNang = { khi_luc: 50, can_cot: 10 };
  const geared = withAttributes(spec, m);
  assert.deepEqual(geared.bonuses, { atk: 50 + 40, def: 20 });
  const u = new Battle({ seed: 1, teamA: [geared], teamB: [{ ...spec, id: 101 }] }).units.find((x) => x.id === 1)!;
  assert.equal(u.atk, Math.trunc((spec.atk * (1000 + 90)) / 1000));
});

test("dữ liệu diem_tiem_nang.json: khóa moiDiem là chỉ số trận của sim, id không trùng", () => {
  const stats = Object.keys(unitBonuses([], [], []));
  for (const a of ATTRIBUTES) for (const k of Object.keys(a.moiDiem)) assert.ok(stats.indexOf(k) >= 0, `${a.id}: ${k}`);
  assert.equal(new Set(ATTRIBUTES.map((a) => a.id)).size, ATTRIBUTES.length);
});

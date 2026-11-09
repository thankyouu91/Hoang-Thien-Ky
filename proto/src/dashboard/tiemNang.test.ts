// node --test: phần hiển thị điểm tiềm năng (tiemNang.ts) khớp dữ liệu và luật của @htk/rules.
import assert from "node:assert/strict";
import { test } from "node:test";
import { addMember, addSect, apply, attributeBonuses, emptyState, unspentPoints } from "@htk/rules";
import { diemHieuQua, TN } from "./tiemNang.ts";

test("mốc mềm: tới mocGiam nguyên vẹn, phần vượt còn giamConLai", () => {
  assert.equal(diemHieuQua(TN.mocGiam), TN.mocGiam);
  assert.equal(diemHieuQua(250), 120 + 65);
  assert.equal(diemHieuQua(0), 0);
});

test("dữ liệu: 6 thuộc tính id không trùng, khóa moiDiem dương", () => {
  assert.equal(TN.thuocTinh.length, 6);
  assert.equal(new Set(TN.thuocTinh.map((t) => t.id)).size, 6);
  for (const t of TN.thuocTinh) for (const v of Object.values(t.moiDiem)) assert.ok(v > 0, t.id);
});

test("khớp rules: cong_diem rồi attributeBonuses ra đúng phần nghìn", () => {
  const s = emptyState();
  addSect(s, "t", 1);
  addMember(s, "a", "t", "tong_chu", 42);
  const m = s.members.a;
  assert.equal(unspentPoints(m), 41 * TN.diemMoiCap);
  assert.ok(apply(s, { type: "cong_diem", actor: "a", thuocTinh: "khi_luc", diem: 10 }, 0).ok);
  assert.equal(unspentPoints(m), 31);
  assert.equal(attributeBonuses(m).atk, 8); // 10 × 0,8‰
});

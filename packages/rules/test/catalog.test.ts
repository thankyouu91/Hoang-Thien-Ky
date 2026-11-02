import { test } from "node:test";
import assert from "node:assert/strict";
import { ELEMENTS, SKILL_TYPES, VARIANTS, composeTechnique } from "@ktlp/sim";
import { SCROLL_KINDS, scrollKind, scrollLabel, toScroll, GRADE_NAMES } from "../src/index.ts";

test("480 tàn quyển: 12 hệ × 10 loại chiêu × 4 biến thể, mỗi hệ 40 quyển", () => {
  assert.equal(SCROLL_KINDS.length, 480);
  assert.equal(new Set(SCROLL_KINDS.map((k) => k.id)).size, 480);
  for (const e of ELEMENTS) assert.equal(SCROLL_KINDS.filter((k) => k.element === e).length, 40);
  for (const t of SKILL_TYPES) assert.equal(SCROLL_KINDS.filter((k) => k.type === t).length, 48);
  for (const v of VARIANTS) assert.equal(SCROLL_KINDS.filter((k) => k.variant === v).length, 120);
});

test("tên tạm: 120 tên khác nhau, 480 tên kèm biến thể khác nhau, đều đánh dấu chờ Excel", () => {
  assert.equal(new Set(SCROLL_KINDS.map((k) => k.name)).size, 120);
  assert.equal(new Set(SCROLL_KINDS.map(scrollLabel)).size, 480);
  assert.ok(SCROLL_KINDS.every((k) => k.provisional));
});

test("khớp tên ví dụ trong GDD mục 9", () => {
  assert.equal(scrollKind("loi.can_quet.linh").name, "Tử Điện Liên Hoàn");
  assert.equal(scrollKind("loi.tam_xa.linh").name, "Tử Điện Châm");
  assert.equal(scrollKind("quang.ho_the.ben").name, "Phá Hiểu Cố Bản");
  assert.equal(scrollLabel(scrollKind("loi.can_quet.linh")), "Tử Điện Liên Hoàn · Linh");
  assert.equal(GRADE_NAMES[0], "Phàm");
  assert.equal(GRADE_NAMES[9], "Thánh");
});

test("tra tàn quyển không có thì báo lỗi", () => {
  assert.throws(() => scrollKind("loi.can_quet.manh"));
});

test("quyển lấy từ danh mục ghép được bằng thư viện mô phỏng", () => {
  // Lôi Quang Liên Hoàn Quyết, ví dụ GDD mục 9: sát thương 110
  const t = composeTechnique(toScroll("loi.can_quet.linh", 1), [toScroll("quang.ho_the.ben", 1)]);
  assert.equal(t.damage, 110000);
  assert.equal(t.targets, 5);
});

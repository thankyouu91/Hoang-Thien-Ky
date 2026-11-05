// Soát bộ tra dịch (chạy: node --test src/dashboard/i18nTra.test.ts).
import { test } from "node:test";
import assert from "node:assert/strict";
import EN_JSON from "./i18n/en.json" with { type: "json" };
import { BoTra } from "./i18nTra.ts";

const EN = EN_JSON as Record<string, string>;

test("bảng en.json: mọi mẫu có cùng số chỗ biến hai bên", () => {
  for (const [k, v] of Object.entries(EN)) {
    const nk = (k.match(/\{\}/g) ?? []).length;
    const nv = (v.match(/\{\d*\}/g) ?? []).length;
    assert.equal(nv, nk, `${k} → ${v}`);
  }
});

test("chữ cố định, giữ khoảng trắng đầu cuối", () => {
  const b = new BoTra({ "Đăng xuất": "Sign out" });
  assert.equal(b.tr(" Đăng xuất "), " Sign out ");
  assert.equal(b.tr("Đăng   xuất"), "Sign out");
});

test("mẫu có biến: số giữ nguyên, tên có trong bảng thì dịch, đổi thứ tự bằng {1}{2}", () => {
  const b = new BoTra({ "Cấp {}": "Level {}", "{}, đang cưỡi": "{}, riding", "Thiểm Điện Báo": "Lightning Leopard", "{} của {}": "{2}'s {1}" });
  assert.equal(b.tr("Cấp 51"), "Level 51");
  assert.equal(b.tr("Thiểm Điện Báo, đang cưỡi"), "Lightning Leopard, riding");
  assert.equal(b.tr("Lăng Vân, đang cưỡi"), "Lăng Vân, riding");
  assert.equal(b.tr("Kiếm của Lăng Vân"), "Lăng Vân's Kiếm");
});

test("mẫu chỉ có ký hiệu chỉ nhận khi dịch được một phần; không thì vẫn ghi thiếu", () => {
  const b = new BoTra({ "{}: {}": "{}: {}", "Máu": "HP" });
  assert.equal(b.tr("Máu: 9,703"), "HP: 9,703");
  assert.equal(b.tr("Chưa dịch: ở đây"), "Chưa dịch: ở đây");
  assert.ok(b.thieu.has("Chưa dịch: ở đây"));
});

test("chuỗi nối bằng · dịch từng phần, cả khi bắt đầu bằng ·", () => {
  const b = new BoTra({ "10 đấu 10": "10 vs 10", "Thắng": "Victory" });
  assert.equal(b.tr("· 10 đấu 10 · 2h ago"), "· 10 vs 10 · 2h ago");
  assert.equal(b.tr("Thắng · Lăng Vân"), "Victory · Lăng Vân");
});

test("mẫu nhiều chữ cố định thắng mẫu chung", () => {
  const b = new BoTra({ "{} phá trận, còn": "{} broke the formation, ends in", "{}, còn": "{}, ends in" });
  assert.equal(b.tr("Huyết Sát Môn phá trận, còn"), "Huyết Sát Môn broke the formation, ends in");
});

test("bảng thật: vài nhãn chính", () => {
  const b = new BoTra(EN);
  assert.equal(b.tr("Đăng xuất"), "Sign out");
  assert.equal(b.tr("Ô 3"), "Slot 3");
  assert.equal(b.tr("Lôi + Hỏa"), "Lightning + Fire");
});

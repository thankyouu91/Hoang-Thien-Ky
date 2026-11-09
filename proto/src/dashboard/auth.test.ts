// node --test src/dashboard/auth.test.ts — kiểm số điện thoại và tuổi của màn đăng nhập thử.
import assert from "node:assert/strict";
import { test } from "node:test";
import { ageOn, maskPhone, normalizePhone } from "./auth.ts";

test("số hợp lệ ở mọi cách gõ thường gặp", () => {
  for (const s of ["0912345678", "091 234 5678", "0912.345.678", "+84912345678", "84912345678", "+84 0912 345 678", "912345678", "(091) 234-5678"]) {
    assert.equal(normalizePhone(s), "0912345678", s);
  }
  // Ô nhập in sẵn +84: gõ 9 số đầu 8 (084, 085...) không được nuốt mất "84".
  assert.equal(normalizePhone("841234567"), "0841234567");
  assert.equal(normalizePhone("0841234567"), "0841234567");
  assert.equal(normalizePhone("327654321"), "0327654321");
});

test("số không hợp lệ bị chặn", () => {
  for (const s of ["", "091234567", "09123456789", "0212345678", "0112345678", "12345678", "abc0912345678", "+1 912345678", "0912 34x 678"]) {
    assert.equal(normalizePhone(s), null, s);
  }
});

test("che số", () => {
  assert.equal(maskPhone("0912345678"), "09•• ••• 678");
});

test("tuổi tính theo ngày sinh nhật", () => {
  const now = new Date(2026, 10, 5);
  assert.equal(ageOn("2010-11-05", now), 16);
  assert.equal(ageOn("2010-11-06", now), 15);
  assert.equal(ageOn("2008-11-06", now), 17);
});

import assert from "node:assert/strict";
import { test } from "node:test";
import { bamThe, chuanMa, COOKIE, datCookie, docThe, maDoc, taoThe } from "../src/moi.ts";

test("thẻ cookie: 43 ký tự base64url, mỗi lần khác", () => {
  const a = taoThe();
  const b = taoThe();
  assert.match(a, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(a, b);
});

test("băm thẻ: SHA-256 hex, ổn định", async () => {
  assert.equal(await bamThe("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
});

test("đọc cookie", () => {
  const the = taoThe();
  assert.equal(docThe(`a=1; ${COOKIE}=${the}; b=2`), the);
  assert.equal(docThe(`${COOKIE}=ngan`), null);
  assert.equal(docThe(`x${COOKIE}=${the}`), null);
  assert.equal(docThe(null), null);
});

test("Set-Cookie an toàn", () => {
  const c = datCookie("t");
  for (const p of ["HttpOnly", "Secure", "SameSite=Lax", "Path=/", "Max-Age=15552000"]) assert.ok(c.includes(p), p);
});

test("mã link mời", () => {
  assert.equal(chuanMa("Beta-FB-2026"), "beta-fb-2026");
  assert.equal(chuanMa("abc"), null);
  assert.equal(chuanMa("co dau"), null);
  assert.equal(chuanMa("%E0%A4"), null);
  assert.equal(chuanMa("x".repeat(41)), null);
  assert.match(maDoc(12), /^[a-hj-km-np-z2-9]{12}$/);
});

test("cookie dùng chung tên miền con, trừ khi chạy local", () => {
  assert.ok(datCookie("t", "play.thienhoangky.fun").includes("; Domain=thienhoangky.fun;"));
  assert.ok(datCookie("t", "thienhoangky.fun").includes("; Domain=thienhoangky.fun;"));
  assert.ok(!datCookie("t", "127.0.0.1").includes("Domain="));
  assert.ok(!datCookie("t", "evilthienhoangky.fun").includes("Domain="));
});

// Test xác minh JWT Access (worker/jwt.ts) bằng khóa giả: node --test test/jwt.test.ts

import assert from "node:assert/strict";
import { test } from "node:test";
import { verifyAccessJwt } from "../worker/jwt.ts";
import { AUD, TEAM, kyJwt, taoKhoa } from "./khoaGia.ts";

const k = await taoKhoa("k1");
const khac = await taoKhoa("k1"); // cùng kid, khác khóa: giả chữ ký
const opt = (keys: JsonWebKey[] = [k.jwk]) => ({ teamDomain: TEAM, aud: AUD, loadKeys: async () => keys });

test("JWT đúng: lấy email viết thường", async () => {
  const t = await kyJwt(k, { email: "Admin@Example.com" });
  const v = await verifyAccessJwt(t, opt());
  assert.equal(v.ok, true);
  if (v.ok) assert.equal(v.claims.email, "admin@example.com");
});

test("aud dạng chuỗi cũng nhận", async () => {
  const v = await verifyAccessJwt(await kyJwt(k, { email: "a@example.com", aud: AUD }), opt());
  assert.equal(v.ok, true);
});

const hong: [string, Record<string, unknown>, RegExp][] = [
  ["aud của ứng dụng khác", { email: "a@example.com", aud: ["aud-ung-dung-game"] }, /aud/],
  ["iss của team khác", { email: "a@example.com", iss: "https://khac.cloudflareaccess.com" }, /iss/],
  ["hết hạn", { email: "a@example.com", exp: Math.floor(Date.now() / 1000) - 3600 }, /hết hạn/],
  ["chưa tới hạn", { email: "a@example.com", nbf: Math.floor(Date.now() / 1000) + 3600 }, /chưa tới/],
  ["service token (không email)", { email: undefined, common_name: "svc" }, /email/],
];
for (const [ten, claims, re] of hong) {
  test(`từ chối: ${ten}`, async () => {
    const v = await verifyAccessJwt(await kyJwt(k, claims), opt());
    assert.equal(v.ok, false);
    if (!v.ok) assert.match(v.reason, re);
  });
}

test("từ chối chữ ký bằng khóa khác", async () => {
  const v = await verifyAccessJwt(await kyJwt(khac, { email: "a@example.com" }), opt());
  assert.deepEqual(v, { ok: false, reason: "chữ ký sai" });
});

test("từ chối alg none và JWT sửa payload", async () => {
  const t = await kyJwt(k, { email: "van@example.com" });
  const [h, , s] = t.split(".");
  const p2 = btoa(JSON.stringify({ email: "admin@example.com", aud: [AUD], iss: `https://${TEAM}`, exp: 9999999999 })).replace(/=+$/, "");
  assert.equal((await verifyAccessJwt(`${h}.${p2}.${s}`, opt())).ok, false);
  const none = btoa(JSON.stringify({ alg: "none", kid: "k1" })).replace(/=+$/, "");
  assert.equal((await verifyAccessJwt(`${none}.${p2}.`, opt())).ok, false);
});

test("kid lạ thì tải lại khóa một lần", async () => {
  const k2 = await taoKhoa("k2");
  let lan = 0;
  const v = await verifyAccessJwt(await kyJwt(k2, { email: "a@example.com" }), {
    teamDomain: TEAM,
    aud: AUD,
    loadKeys: async (force) => (lan++, force ? [k.jwk, k2.jwk] : [k.jwk]),
  });
  assert.equal(v.ok, true);
  assert.equal(lan, 2);
});

test("thiếu cấu hình thì từ chối, không bỏ qua", async () => {
  const t = await kyJwt(k, { email: "a@example.com" });
  assert.equal((await verifyAccessJwt(t, { ...opt(), aud: "" })).ok, false);
  assert.equal((await verifyAccessJwt(t, { ...opt(), teamDomain: "" })).ok, false);
});

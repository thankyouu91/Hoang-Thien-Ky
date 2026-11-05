// Kiểm xác minh JWT của Access bằng bộ khoá tự sinh (không gọi mạng).
import assert from "node:assert/strict";
import { test } from "node:test";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import { chuanTeam, xacMinh } from "../src/access.ts";

const TEAM = "https://thienhoangky.cloudflareaccess.com";
const AUD = "aud-choi-thu";

const { publicKey, privateKey } = await generateKeyPair("RS256");
const jwk = { ...(await exportJWK(publicKey)), kid: "k1", alg: "RS256" };
const khoa = createLocalJWKSet({ keys: [jwk] });
const khoaLa = await generateKeyPair("RS256");

async function token(p: { aud?: string; iss?: string; email?: string | null; exp?: number; key?: CryptoKey; kid?: string } = {}): Promise<string> {
  const claims: Record<string, unknown> = { sub: "u1" };
  if (p.email !== null) claims.email = p.email ?? "Nguoi.Choi@Example.com";
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "RS256", kid: p.kid ?? "k1" })
    .setIssuer(p.iss ?? TEAM)
    .setAudience(p.aud ?? AUD)
    .setIssuedAt()
    .setExpirationTime(p.exp ?? Math.floor(Date.now() / 1000) + 600)
    .sign(p.key ?? privateKey);
}

function req(t?: string, host = "thienhoangky.fun"): Request {
  return new Request(`https://${host}/api/toi`, { headers: t ? { "Cf-Access-Jwt-Assertion": t } : {} });
}

const env = { ACCESS_TEAM_DOMAIN: TEAM, ACCESS_AUD: AUD };

test("token đúng: trả email viết thường", async () => {
  const r = await xacMinh(req(await token()), env, khoa);
  assert.deepEqual(r, { ok: true, nguoi: { email: "nguoi.choi@example.com", sub: "u1" } });
});

test("không có header thì từ chối", async () => {
  assert.deepEqual(await xacMinh(req(), env, khoa), { ok: false, ma: "thieu_token" });
});

test("aud của ứng dụng khác (admin) thì từ chối", async () => {
  assert.deepEqual(await xacMinh(req(await token({ aud: "aud-admin" })), env, khoa), { ok: false, ma: "token_sai" });
});

test("iss của team khác thì từ chối", async () => {
  assert.deepEqual(await xacMinh(req(await token({ iss: "https://khac.cloudflareaccess.com" })), env, khoa), { ok: false, ma: "token_sai" });
});

test("chữ ký bằng khoá lạ thì từ chối", async () => {
  assert.deepEqual(await xacMinh(req(await token({ key: khoaLa.privateKey })), env, khoa), { ok: false, ma: "token_sai" });
});

test("token hết hạn thì từ chối", async () => {
  assert.deepEqual(await xacMinh(req(await token({ exp: Math.floor(Date.now() / 1000) - 120 })), env, khoa), { ok: false, ma: "token_sai" });
});

test("token không có email (service token) thì từ chối", async () => {
  assert.deepEqual(await xacMinh(req(await token({ email: null })), env, khoa), { ok: false, ma: "token_sai" });
});

test("token sửa payload thì từ chối", async () => {
  const [h, , s] = (await token()).split(".");
  const p = Buffer.from(JSON.stringify({ sub: "u1", email: "ke.gia@x.com", iss: TEAM, aud: AUD, exp: 9999999999 })).toString("base64url");
  assert.deepEqual(await xacMinh(req(`${h}.${p}.${s}`), env, khoa), { ok: false, ma: "token_sai" });
});

test("chưa cấu hình team hoặc aud thì đóng (không cho qua)", async () => {
  const t = await token();
  assert.deepEqual(await xacMinh(req(t), { ACCESS_TEAM_DOMAIN: TEAM, ACCESS_AUD: "" }, khoa), { ok: false, ma: "chua_cau_hinh" });
  assert.deepEqual(await xacMinh(req(t), { ACCESS_AUD: AUD }, khoa), { ok: false, ma: "chua_cau_hinh" });
});

test("nhiều aud ngăn bằng phẩy", async () => {
  const r = await xacMinh(req(await token({ aud: "b" })), { ACCESS_TEAM_DOMAIN: TEAM, ACCESS_AUD: "a, b" }, khoa);
  assert.equal(r.ok, true);
});

test("DEV_EMAIL chỉ có tác dụng trên localhost", async () => {
  const dev = { ...env, DEV_EMAIL: "Dev@Local" };
  assert.deepEqual(await xacMinh(req(undefined, "localhost:8787"), dev, khoa), { ok: true, nguoi: { email: "dev@local", sub: "dev" } });
  assert.deepEqual(await xacMinh(req(undefined, "thienhoangky.fun"), dev, khoa), { ok: false, ma: "thieu_token" });
});

test("chuẩn hoá team domain", () => {
  assert.equal(chuanTeam("thienhoangky.cloudflareaccess.com/"), TEAM);
  assert.equal(chuanTeam(` ${TEAM}// `), TEAM);
});

// Test cổng vào của Worker wiki (worker/index.ts): link mời, Access, chế độ mở chỉ ở máy, robots, chỉ đọc.
// Chạy: npm.cmd test (node --test, Node 24 chạy thẳng .ts).
import { test } from "node:test";
import assert from "node:assert/strict";
import { xuLy, type EnvWiki } from "../worker/index.ts";
import { bamThe } from "../../cloudflare/src/moi.ts";

const THE = "A".repeat(43); // đúng dạng thẻ cookie thk_moi: 43 ký tự base64url

function gia(ketQua: { khoa: number } | null) {
  const goi: { sql: string; args: unknown[] }[] = [];
  const db = {
    prepare(sql: string) {
      const q = { sql, args: [] as unknown[] };
      goi.push(q);
      return {
        bind(...a: unknown[]) {
          q.args = a;
          return this;
        },
        async first() {
          return ketQua;
        },
      };
    },
  };
  let daGoiAssets = 0;
  const assets = {
    async fetch() {
      daGoiAssets++;
      return new Response("<html>wiki</html>", { status: 200, headers: { "Content-Type": "text/html", "Cache-Control": "public, max-age=0" } });
    },
  };
  return { db, assets, goi, demAssets: () => daGoiAssets };
}

function env(g: ReturnType<typeof gia>, them: Partial<EnvWiki> = {}): EnvWiki {
  return { ASSETS: g.assets as unknown as Fetcher, DB: g.db as unknown as D1Database, CONG: "loi_moi", LINK_GAME: "https://play.thienhoangky.fun", ...them };
}

const yc = (duong: string, init: RequestInit = {}, host = "wiki.thienhoangky.fun") => new Request(`https://${host}${duong}`, init);

test("link mời: không cookie thì 403 kèm lời dẫn mở link mời, không chạm asset", async () => {
  const g = gia({ khoa: 0 });
  const r = await xuLy(yc("/he/"), env(g));
  assert.equal(r.status, 403);
  assert.match(await r.text(), /link mời/);
  assert.equal(g.demAssets(), 0);
  assert.equal(r.headers.get("Cache-Control"), "no-store");
});

test("link mời: cookie hợp lệ thì phục vụ trang, tra D1 bằng SHA-256 của thẻ", async () => {
  const g = gia({ khoa: 0 });
  const r = await xuLy(yc("/he/", { headers: { Cookie: `x=1; thk_moi=${THE}` } }), env(g));
  assert.equal(r.status, 200);
  assert.equal(g.demAssets(), 1);
  assert.equal(g.goi.length, 1);
  assert.match(g.goi[0].sql, /^SELECT khoa FROM nguoi_choi_thu WHERE the_hash = \?1$/);
  assert.deepEqual(g.goi[0].args, [await bamThe(THE)]);
  assert.equal(r.headers.get("X-Robots-Tag"), "noindex, nofollow");
  assert.equal(r.headers.get("Cache-Control"), "private, no-cache");
});

test("link mời: thẻ không có trong D1 thì 403", async () => {
  const g = gia(null);
  const r = await xuLy(yc("/", { headers: { Cookie: `thk_moi=${THE}` } }), env(g));
  assert.equal(r.status, 403);
  assert.equal(g.demAssets(), 0);
});

test("link mời: người chơi bị khóa thì 403 báo khóa", async () => {
  const g = gia({ khoa: 1 });
  const r = await xuLy(yc("/", { headers: { Cookie: `thk_moi=${THE}` } }), env(g));
  assert.equal(r.status, 403);
  assert.match(await r.text(), /bị khóa/);
});

test("link mời: cookie sai dạng thì không tra D1", async () => {
  const g = gia({ khoa: 0 });
  const r = await xuLy(yc("/", { headers: { Cookie: "thk_moi=ngan" } }), env(g));
  assert.equal(r.status, 403);
  assert.equal(g.goi.length, 0);
});

test("robots.txt không qua cổng và chặn mọi bot", async () => {
  const g = gia(null);
  const r = await xuLy(yc("/robots.txt"), env(g));
  assert.equal(r.status, 200);
  assert.equal(await r.text(), "User-agent: *\nDisallow: /\n");
});

test("chỉ đọc: POST trả 405", async () => {
  const g = gia({ khoa: 0 });
  const r = await xuLy(yc("/", { method: "POST", headers: { Cookie: `thk_moi=${THE}` } }), env(g));
  assert.equal(r.status, 405);
  assert.equal(g.demAssets(), 0);
});

test("chế độ mo chỉ mở ở máy; trên tên miền thật thì 503", async () => {
  const g = gia(null);
  assert.equal((await xuLy(yc("/", {}, "wiki.thienhoangky.fun"), env(g, { CONG: "mo" }))).status, 503);
  assert.equal((await xuLy(yc("/", {}, "127.0.0.1:8797"), env(g, { CONG: "mo" }))).status, 200);
});

test("CONG lạ thì đóng (503), không mở", async () => {
  const g = gia({ khoa: 0 });
  const r = await xuLy(yc("/", { headers: { Cookie: `thk_moi=${THE}` } }), env(g, { CONG: "mo-het" }));
  assert.equal(r.status, 503);
  assert.equal(g.demAssets(), 0);
});

test("Access: thiếu JWT hoặc chưa cấu hình AUD thì 403", async () => {
  const g = gia(null);
  const e = env(g, { CONG: "access", ACCESS_TEAM_DOMAIN: "jolly-water-a8bd.cloudflareaccess.com", ACCESS_AUD: "" });
  assert.equal((await xuLy(yc("/"), e)).status, 403);
  assert.equal((await xuLy(yc("/", { headers: { "Cf-Access-Jwt-Assertion": "a.b.c" } }), e)).status, 403);
  assert.equal(g.demAssets(), 0);
});

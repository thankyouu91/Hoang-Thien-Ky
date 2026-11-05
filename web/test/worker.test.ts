// Test Worker thienhoangky-web bằng D1 và ASSETS giả: cổng link mời, chế độ công khai, góp ý, chuyển /moi/.
import assert from "node:assert/strict";
import { test } from "node:test";
import { bamThe, COOKIE } from "../../cloudflare/src/moi.ts";
import worker, { type EnvWeb } from "../worker/index.ts";

const THE_TOT = "A".repeat(43);
const THE_KHOA = "B".repeat(43);

interface PhanHoi {
  nguoi_choi: string;
  loai: string;
  noi_dung: string;
  man: string | null;
  lien_he: string | null;
}

/** D1 giả đủ cho ba câu lệnh Worker dùng. */
async function taoDb() {
  const nguoi = new Map([
    [await bamThe(THE_TOT), { id: "nguoitot01", khoa: 0 }],
    [await bamThe(THE_KHOA), { id: "nguoikhoa1", khoa: 1 }],
  ]);
  const phanHoi: PhanHoi[] = [];
  const db = {
    prepare(sql: string) {
      let args: unknown[] = [];
      const stmt = {
        bind(...a: unknown[]) {
          args = a;
          return stmt;
        },
        async first<T>(): Promise<T | null> {
          if (sql.includes("FROM nguoi_choi_thu")) return (nguoi.get(args[0] as string) ?? null) as T | null;
          if (sql.includes("COUNT(*)")) return { n: phanHoi.filter((p) => p.nguoi_choi === args[0]).length } as T;
          if (sql.startsWith("INSERT INTO phan_hoi")) {
            phanHoi.push({ nguoi_choi: args[0] as string, loai: args[1] as string, noi_dung: args[2] as string, man: args[3] as string, lien_he: null });
            return { id: phanHoi.length } as T;
          }
          throw new Error("SQL lạ: " + sql);
        },
      };
      return stmt;
    },
  };
  return { db: db as unknown as D1Database, phanHoi };
}

const assets = {
  async fetch(req: Request) {
    const p = new URL(req.url).pathname;
    if (p === "/" || p === "/the-gioi/") return new Response("<!doctype html><title>trang</title>", { headers: { "Content-Type": "text/html; charset=utf-8" } });
    return new Response("không có", { status: 404, headers: { "Content-Type": "text/html; charset=utf-8" } });
  },
} as unknown as Fetcher;

async function env(extra: Partial<EnvWeb> = {}) {
  const { db, phanHoi } = await taoDb();
  return { e: { ASSETS: assets, DB: db, CONG_KHAI: "0", CHOI_URL: "https://choi.thienhoangky.fun", ...extra } as EnvWeb, phanHoi };
}

const goi = (e: EnvWeb, path: string, init: RequestInit & { the?: string } = {}) => {
  const headers = new Headers(init.headers);
  if (init.the) headers.set("Cookie", `khac=1; ${COOKIE}=${init.the}`);
  return worker.fetch(new Request(`https://thienhoangky.fun${path}`, { ...init, headers }), e);
};

test("chưa có cookie: trang HTML trả 403 trang cần link mời, không lộ nội dung", async () => {
  const { e } = await env();
  const r = await goi(e, "/the-gioi/");
  assert.equal(r.status, 403);
  const t = await r.text();
  assert.match(t, /người được mời/);
  assert.match(t, /choi\.thienhoangky\.fun\/moi\//);
  assert.doesNotMatch(t, /<title>trang<\/title>/);
  assert.equal(r.headers.get("Cache-Control"), "no-store");
});

test("cookie sai dạng hoặc không có trong D1 thì vẫn chặn", async () => {
  const { e } = await env();
  assert.equal((await goi(e, "/", { the: "ngan" })).status, 403);
  assert.equal((await goi(e, "/", { the: "C".repeat(43) })).status, 403);
});

test("cookie hợp lệ: trả trang tĩnh, header riêng tư và noindex", async () => {
  const { e } = await env();
  const r = await goi(e, "/the-gioi/", { the: THE_TOT });
  assert.equal(r.status, 200);
  assert.match(await r.text(), /<title>trang<\/title>/);
  assert.equal(r.headers.get("Cache-Control"), "private, no-cache");
  assert.equal(r.headers.get("X-Robots-Tag"), "noindex, nofollow");
});

test("người bị khóa thấy trang khóa", async () => {
  const { e } = await env();
  const r = await goi(e, "/", { the: THE_KHOA });
  assert.equal(r.status, 403);
  assert.match(await r.text(), /bị khóa/);
});

test("công khai (CONG_KHAI=1): trang mở cho mọi người, không còn noindex", async () => {
  const { e } = await env({ CONG_KHAI: "1" });
  const r = await goi(e, "/");
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("X-Robots-Tag"), null);
  assert.match(await (await goi(e, "/robots.txt")).text(), /Allow: \//);
});

test("robots.txt khi kín chặn mọi máy tìm kiếm, kể cả chưa có cookie", async () => {
  const { e } = await env();
  const r = await goi(e, "/robots.txt");
  assert.equal(r.status, 200);
  assert.match(await r.text(), /Disallow: \//);
});

test("/moi/<ma> trên tên gốc chuyển sang game, giữ đường dẫn", async () => {
  const { e } = await env();
  const r = await goi(e, "/moi/dot-1-abc?x=1");
  assert.equal(r.status, 302);
  assert.equal(r.headers.get("Location"), "https://choi.thienhoangky.fun/moi/dot-1-abc?x=1");
});

test("góp ý: ghi phan_hoi với man website, không có liên hệ", async () => {
  const { e, phanHoi } = await env();
  const r = await goi(e, "/api/gop-y", {
    method: "POST",
    the: THE_TOT,
    headers: { "Content-Type": "application/json", Origin: "https://thienhoangky.fun" },
    body: JSON.stringify({ loai: "loi", noi_dung: "  Nút bị che  ", man: "website:/the-gioi/", lien_he: "0909 không được lưu" }),
  });
  assert.equal(r.status, 201);
  assert.deepEqual(await r.json(), { id: 1 });
  assert.equal(phanHoi.length, 1);
  assert.deepEqual(phanHoi[0], { nguoi_choi: "nguoitot01", loai: "loi", noi_dung: "Nút bị che", man: "website:/the-gioi/", lien_he: null });
});

test("góp ý: chặn khi thiếu cookie, khác nguồn, không phải JSON, quá 30 lần mỗi ngày", async () => {
  const { e } = await env();
  const body = JSON.stringify({ noi_dung: "hay lắm" });
  const json = { "Content-Type": "application/json" };
  assert.equal((await goi(e, "/api/gop-y", { method: "POST", headers: json, body })).status, 401);
  assert.equal((await goi(e, "/api/gop-y", { method: "POST", the: THE_KHOA, headers: json, body })).status, 403);
  assert.equal((await goi(e, "/api/gop-y", { method: "POST", the: THE_TOT, headers: { ...json, Origin: "https://ke-gian.example" }, body })).status, 403);
  assert.equal((await goi(e, "/api/gop-y", { method: "POST", the: THE_TOT, headers: { "Content-Type": "text/plain" }, body })).status, 415);
  assert.equal((await goi(e, "/api/gop-y", { method: "GET", the: THE_TOT })).status, 405);
  for (let i = 0; i < 30; i++) assert.equal((await goi(e, "/api/gop-y", { method: "POST", the: THE_TOT, headers: json, body })).status, 201);
  const r = await goi(e, "/api/gop-y", { method: "POST", the: THE_TOT, headers: json, body });
  assert.equal(r.status, 429);
  assert.equal(((await r.json()) as { loi: string }).loi, "qua_nhieu");
});

test("API lạ trả 404 JSON; công khai thì góp ý vẫn cần cookie", async () => {
  const { e } = await env();
  const r = await goi(e, "/api/khac", { the: THE_TOT });
  assert.equal(r.status, 404);
  const { e: mo } = await env({ CONG_KHAI: "1" });
  assert.equal((await goi(mo, "/api/gop-y", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })).status, 401);
});

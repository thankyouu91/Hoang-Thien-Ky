// Kiểm đầu-cuối Worker admin chạy thật trong wrangler dev (workerd + D1 cục bộ).
// Đăng nhập bằng tên + mật khẩu: tài khoản đầu tạo bằng scripts/tao-tai-khoan.ts, bắt đổi mật khẩu lần đầu, cookie phiên,
// sai nhiều lần thì tạm khóa, chặn theo IP, Vận hành bị 403 ở Cấu hình, Tài khoản, link mời và khóa người chơi khi gọi
// thẳng API, "Xem như Vận hành" chỉ hạ quyền, chống CSRF, đăng xuất, hết hạn phiên, nhật ký, bảng game thật,
// và lớp Access tùy chọn (chạy riêng một Worker có ACCESS_AUD).
// Chạy: npm run build && node test/e2e.ts

import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { readdirSync, rmSync } from "node:fs";
import { AUD, TEAM, kyJwt, phucVuKhoa, taoKhoa } from "./khoaGia.ts";

const PORT = 8791;
const BASE = `http://127.0.0.1:${PORT}`;
const STATE = "test/.tmp/state";
const WR = process.platform === "win32" ? "node_modules\\.bin\\wrangler.cmd" : "node_modules/.bin/wrangler";
const ENV = { ...process.env, CI: "1", WRANGLER_SEND_METRICS: "false" };

function d1(args: string[]) {
  return spawnSync(WR, ["d1", "execute", "thienhoangky", "--local", "--persist-to", STATE, ...args], { shell: true, encoding: "utf8", env: ENV });
}
function sql(cau: string): Record<string, unknown>[] {
  const r = d1(["--json", "--command", JSON.stringify(cau)]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  return JSON.parse(r.stdout.slice(r.stdout.indexOf("[")))[0].results;
}

rmSync("test/.tmp", { recursive: true, force: true });
const mig = spawnSync(WR, ["d1", "migrations", "apply", "thienhoangky", "--local", "--persist-to", STATE], { shell: true, encoding: "utf8", env: ENV });
assert.equal(mig.status, 0, mig.stdout + mig.stderr);

// Tài khoản đầu tiên tạo đúng như hướng dẫn deploy: script sinh SQL, chạy SQL lên D1.
const tao = spawnSync(process.execPath, ["scripts/tao-tai-khoan.ts", "kiemthu", "admin"], { encoding: "utf8" });
assert.equal(tao.status, 0, tao.stderr);
const TAM_DAU = /Mật khẩu tạm: (\S+)/.exec(tao.stdout)![1];
const ap = d1(["--file", ".tmp/tai-khoan-kiemthu.sql"]);
assert.equal(ap.status, 0, ap.stdout + ap.stderr);
rmSync(".tmp/tai-khoan-kiemthu.sql");

let log = "";
function chayWorker(port: number, vars: Record<string, string>): ChildProcess {
  const p = spawn(WR, ["dev", "--port", String(port), "--ip", "127.0.0.1", "--persist-to", STATE, ...Object.entries(vars).flatMap(([a, b]) => ["--var", `${a}:${b}`])], {
    shell: true,
    env: ENV,
  });
  p.stdout!.on("data", (d) => (log += d));
  p.stderr!.on("data", (d) => (log += d));
  return p;
}
async function doiLen(base: string): Promise<void> {
  for (let i = 0; i < 120; i++) {
    await new Promise((r) => setTimeout(r, 500));
    if (await fetch(base + "/api/toi").then(() => true, () => false)) return;
  }
  throw new Error(`wrangler dev không lên:\n${log}`);
}
function dung(p: ChildProcess): void {
  if (process.platform === "win32" && p.pid) spawnSync("taskkill", ["/pid", String(p.pid), "/T", "/F"]);
  else p.kill();
}

let dat = 0;
let truot = 0;
async function kiem(ten: string, f: () => Promise<void>): Promise<void> {
  try {
    await f();
    dat++;
    console.log(`  ✔ ${ten}`);
  } catch (e) {
    truot++;
    console.log(`  ✘ ${ten}\n    ${(e as Error).message.split("\n").join("\n    ")}`);
  }
}

interface Goi {
  cookie?: string;
  body?: unknown;
  headers?: Record<string, string>;
  base?: string;
}
async function goi(method: string, path: string, opt: Goi = {}) {
  const base = opt.base ?? BASE;
  const headers: Record<string, string> = { ...(opt.headers ?? {}) };
  if (opt.cookie) headers.Cookie = opt.cookie;
  if (opt.body !== undefined) {
    headers["Content-Type"] ??= "application/json";
    headers.Origin ??= base;
  }
  const res = await fetch(base + path, { method, headers, body: opt.body === undefined ? undefined : typeof opt.body === "string" ? opt.body : JSON.stringify(opt.body) });
  const text = await res.text();
  let data: any = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: res.status, data, headers: res.headers };
}
/** Đăng nhập, trả chuỗi Cookie để gửi kèm (và kiểm thuộc tính cookie). */
async function vao(ten: string, matKhau: string, base = BASE, headers: Record<string, string> = {}): Promise<string> {
  const r = await goi("POST", "/api/dang-nhap", { body: { ten, mat_khau: matKhau }, base, headers });
  assert.equal(r.status, 200, `đăng nhập ${ten}: ${JSON.stringify(r.data)}`);
  const sc = r.headers.get("set-cookie") ?? "";
  const m = /__Host-qt=([A-Za-z0-9_-]{43})/.exec(sc);
  assert.ok(m, `không có cookie phiên: ${sc}`);
  return `__Host-qt=${m[1]}`;
}

const MK_ADMIN = "đường lên Thiên Hoang còn xa 2026";
const MK_VAN = "mây trắng ngang núi Thanh Vân";
const MATKHAU_DA_THAY: string[] = [TAM_DAU, MK_ADMIN, MK_VAN];

const w = chayWorker(PORT, { GAME_ORIGIN: "https://choi.thienhoangky.fun/" });
try {
  await doiLen(BASE);

  console.log("Chưa đăng nhập");
  await kiem("trang / trả giao diện (màn đăng nhập), có CSP", async () => {
    const r = await goi("GET", "/");
    assert.equal(r.status, 200);
    assert.match(String(r.data), /Thiên Hoang Ký · Quản trị/);
    assert.match(r.headers.get("content-security-policy") ?? "", /frame-ancestors 'none'/);
  });
  await kiem("API không có phiên → 401", async () => {
    assert.equal((await goi("GET", "/api/toi")).status, 401);
    assert.equal((await goi("GET", "/api/tong-quan")).status, 401);
    assert.equal((await goi("GET", "/api/toi", { cookie: "__Host-qt=" + "A".repeat(43) })).status, 401);
  });
  await kiem("sai mật khẩu và tên không có: cùng một câu trả lời", async () => {
    const a = await goi("POST", "/api/dang-nhap", { body: { ten: "kiemthu", mat_khau: "sai-roi" } });
    const b = await goi("POST", "/api/dang-nhap", { body: { ten: "khongco", mat_khau: "sai-roi" } });
    assert.equal(a.status, 401);
    assert.deepEqual(a.data, b.data);
    assert.equal(a.headers.get("set-cookie"), null);
  });
  await kiem("đăng nhập từ trang khác (Origin lạ) → 403", async () =>
    assert.equal((await goi("POST", "/api/dang-nhap", { body: { ten: "kiemthu", mat_khau: TAM_DAU }, headers: { Origin: "https://evil.example" } })).status, 403),
  );

  console.log("Lần đăng nhập đầu: bắt đổi mật khẩu");
  let ckAdmin = "";
  await kiem("mật khẩu tạm từ scripts/tao-tai-khoan.ts vào được; cookie HttpOnly, Secure, SameSite=Strict, Path=/", async () => {
    const r = await goi("POST", "/api/dang-nhap", { body: { ten: "KiemThu", mat_khau: TAM_DAU } });
    assert.equal(r.status, 200);
    assert.equal(r.data.ten, "kiemthu");
    assert.equal(r.data.phai_doi_mat_khau, true);
    const sc = r.headers.get("set-cookie") ?? "";
    for (const t of ["HttpOnly", "Secure", "SameSite=Strict", "Path=/"]) assert.ok(sc.includes(t), `thiếu ${t}: ${sc}`);
    ckAdmin = `__Host-qt=${/__Host-qt=([^;]+)/.exec(sc)![1]}`;
  });
  await kiem("chưa đổi mật khẩu: chỉ được /api/toi, đổi mật khẩu, đăng xuất", async () => {
    assert.equal((await goi("GET", "/api/toi", { cookie: ckAdmin })).status, 200);
    const r = await goi("GET", "/api/tong-quan", { cookie: ckAdmin });
    assert.equal(r.status, 403);
    assert.match(r.data.loi, /đổi mật khẩu/);
  });
  await kiem("đổi mật khẩu: sai mật khẩu cũ, quá ngắn, chứa tên → 400", async () => {
    assert.equal((await goi("POST", "/api/doi-mat-khau", { cookie: ckAdmin, body: { cu: "sai", moi: MK_ADMIN } })).status, 400);
    assert.equal((await goi("POST", "/api/doi-mat-khau", { cookie: ckAdmin, body: { cu: TAM_DAU, moi: "ngan" } })).status, 400);
    assert.equal((await goi("POST", "/api/doi-mat-khau", { cookie: ckAdmin, body: { cu: TAM_DAU, moi: "kiemthu-1234567890" } })).status, 400);
  });
  await kiem("đổi mật khẩu đúng → dùng được mọi màn; mật khẩu tạm hết dùng", async () => {
    assert.equal((await goi("POST", "/api/doi-mat-khau", { cookie: ckAdmin, body: { cu: TAM_DAU, moi: MK_ADMIN } })).status, 200);
    assert.equal((await goi("GET", "/api/tong-quan", { cookie: ckAdmin })).status, 200);
    assert.equal((await goi("GET", "/api/toi", { cookie: ckAdmin })).data.phai_doi_mat_khau, false);
    assert.equal((await goi("POST", "/api/dang-nhap", { body: { ten: "kiemthu", mat_khau: TAM_DAU } })).status, 401);
    ckAdmin = await vao("kiemthu", MK_ADMIN);
  });
  await kiem("D1 chỉ giữ mật khẩu băm và SHA-256 của mã phiên", async () => {
    const [t] = sql("SELECT mat_khau FROM qt_tai_khoan WHERE ten = 'kiemthu'");
    assert.match(String(t.mat_khau), /^pbkdf2_sha256\$30000\$/);
    const phien = sql("SELECT ma_bam FROM qt_phien WHERE ten = 'kiemthu'");
    assert.ok(phien.length >= 1 && phien.every((p) => /^[0-9a-f]{64}$/.test(String(p.ma_bam))));
    assert.ok(!phien.some((p) => ckAdmin.includes(String(p.ma_bam))));
  });

  console.log("Tài khoản do Admin tạo");
  let tamVan = "";
  let ckVan = "";
  await kiem("Admin tạo tài khoản Vận hành, nhận mật khẩu tạm một lần", async () => {
    const r = await goi("POST", "/api/tai-khoan", { cookie: ckAdmin, body: { ten: "van", vai_tro: "van_hanh", ghi_chu: "trực tối" } });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    tamVan = r.data.mat_khau_tam;
    MATKHAU_DA_THAY.push(tamVan);
    assert.equal(tamVan.length, 16);
    assert.equal((await goi("POST", "/api/tai-khoan", { cookie: ckAdmin, body: { ten: "van", vai_tro: "admin" } })).status, 409);
    assert.equal((await goi("POST", "/api/tai-khoan", { cookie: ckAdmin, body: { ten: "Có Dấu", vai_tro: "admin" } })).status, 400);
    const ds = (await goi("GET", "/api/tai-khoan", { cookie: ckAdmin })).data.dong;
    assert.ok(!JSON.stringify(ds).includes("pbkdf2"), "danh sách tài khoản lộ mật khẩu băm");
  });
  await kiem("Vận hành đăng nhập lần đầu, đổi mật khẩu", async () => {
    ckVan = await vao("van", tamVan);
    assert.equal((await goi("POST", "/api/doi-mat-khau", { cookie: ckVan, body: { cu: tamVan, moi: MK_VAN } })).status, 200);
    assert.equal((await goi("GET", "/api/toi", { cookie: ckVan })).data.vai_tro, "van_hanh");
  });
  await kiem("Admin không tự khóa, tự hạ quyền, tự xóa, tự đặt lại", async () => {
    for (const [p, b] of [
      ["/api/tai-khoan/khoa", { ten: "kiemthu", khoa: true }],
      ["/api/tai-khoan/sua", { ten: "kiemthu", vai_tro: "van_hanh" }],
      ["/api/tai-khoan/xoa", { ten: "kiemthu" }],
      ["/api/tai-khoan/dat-lai", { ten: "kiemthu" }],
    ] as const)
      assert.equal((await goi("POST", p, { cookie: ckAdmin, body: b })).status, 409, p);
  });
  await kiem("Xem như Vận hành: Admin tự hạ quyền → 403 ở Cấu hình", async () => {
    assert.equal((await goi("GET", "/api/cau-hinh", { cookie: ckAdmin, headers: { "X-Xem-Nhu": "van_hanh" } })).status, 403);
    assert.equal((await goi("GET", "/api/toi", { cookie: ckAdmin, headers: { "X-Xem-Nhu": "van_hanh" } })).data.vai_tro, "van_hanh");
  });
  await kiem("đổi cấu hình: ngoài khoảng → 400, đúng → ghi lịch sử", async () => {
    assert.equal((await goi("POST", "/api/cau-hinh", { cookie: ckAdmin, body: { khoa: "toc_do_kinh_te", gia_tri: 50 } })).status, 400);
    assert.equal((await goi("POST", "/api/cau-hinh", { cookie: ckAdmin, body: { khoa: "toc_do_kinh_te", gia_tri: 2, ly_do: "thử tua" } })).status, 200);
    const r = await goi("GET", "/api/cau-hinh", { cookie: ckAdmin });
    assert.equal(r.data.lich_su[0].boi, "kiemthu");
    assert.equal(r.data.lich_su[0].moi, 2);
  });
  await kiem("chống CSRF ở API: Origin lạ → 403, thân không phải JSON → 415", async () => {
    assert.equal((await goi("POST", "/api/cau-hinh", { cookie: ckAdmin, body: { khoa: "he_so_tua", gia_tri: 2 }, headers: { Origin: "https://evil.example" } })).status, 403);
    assert.equal((await goi("POST", "/api/cau-hinh", { cookie: ckAdmin, body: "khoa=he_so_tua", headers: { "Content-Type": "text/plain" } })).status, 415);
  });

  console.log("Vận hành bị chặn ở server");
  const cam: [string, string, unknown?][] = [
    ["GET", "/api/cau-hinh"],
    ["POST", "/api/cau-hinh", { khoa: "he_so_tua", gia_tri: 4 }],
    ["GET", "/api/tai-khoan"],
    ["POST", "/api/tai-khoan", { ten: "lau", vai_tro: "admin" }],
    ["POST", "/api/tai-khoan/sua", { ten: "kiemthu", vai_tro: "van_hanh" }],
    ["POST", "/api/tai-khoan/dat-lai", { ten: "kiemthu" }],
    ["POST", "/api/tai-khoan/khoa", { ten: "kiemthu", khoa: true }],
    ["POST", "/api/tai-khoan/xoa", { ten: "kiemthu" }],
    ["POST", "/api/loi-moi", { ten: "link lậu" }],
    ["POST", "/api/loi-moi/sua", { ma: "maumoi-discord1", ten: "x" }],
    ["POST", "/api/loi-moi/tat", { ma: "maumoi-discord1", tat: true }],
    ["POST", "/api/nguoi-choi/khoa", { id: "abcdefghij", khoa: true }],
  ];
  for (const [m, p, b] of cam) {
    await kiem(`${m} ${p} → 403`, async () => {
      const r = await goi(m, p, { cookie: ckVan, body: b });
      assert.equal(r.status, 403, JSON.stringify(r.data));
      assert.match(r.data.loi, /Chỉ Admin/);
    });
  }
  await kiem("Vận hành gửi X-Xem-Nhu khác không nâng được quyền", async () =>
    assert.equal((await goi("GET", "/api/cau-hinh", { cookie: ckVan, headers: { "X-Xem-Nhu": "admin" } })).status, 403),
  );
  const duoc: [string, string, unknown?][] = [
    ["GET", "/api/tong-quan"],
    ["GET", "/api/su-kien"],
    ["GET", "/api/nguoi-choi"],
    ["POST", "/api/nguoi-choi/ghi-chu", { id: "abcdefghij", ghi_chu: "chơi buổi tối" }],
    ["GET", "/api/phan-hoi"],
    ["POST", "/api/phan-hoi/trang-thai", { id: "mau-1", trang_thai: "dang_xem" }],
    ["POST", "/api/phan-hoi/ghi-chu", { id: "mau-1", noi_dung: "đã tái hiện được" }],
    ["GET", "/api/thong-bao"],
    ["POST", "/api/thong-bao", { tieu_de: "Bảo trì tối nay", noi_dung: "22:00–22:30", dang: true, bat_dau: Date.now() + 3600_000 }],
    ["GET", "/api/nhat-ky"],
  ];
  for (const [m, p, b] of duoc) await kiem(`${m} ${p} → 200`, async () => assert.equal((await goi(m, p, { cookie: ckVan, body: b })).status, 200));
  await kiem("bảng game chưa có: số liệu mẫu, tạo link báo 503", async () => {
    assert.equal((await goi("GET", "/api/tong-quan?ngay=7", { cookie: ckVan })).data.nguon, "mau");
    assert.equal((await goi("GET", "/api/nguoi-choi", { cookie: ckVan })).data.nguon, "mau");
    assert.equal((await goi("POST", "/api/loi-moi", { cookie: ckAdmin, body: { ten: "thử" } })).status, 503);
  });
  await kiem("thông báo hẹn giờ hiện là 'hen', gỡ được; ghi tên người soạn", async () => {
    const tb = (await goi("GET", "/api/thong-bao", { cookie: ckVan })).data.dong[0];
    assert.equal(tb.hien, "hen");
    assert.equal(tb.tao_boi, "van");
    assert.equal((await goi("POST", "/api/thong-bao/go", { cookie: ckVan, body: { id: tb.id } })).status, 200);
  });

  console.log("Bảng game thật (cloudflare/migrations)");
  const NGAY = 86400000;
  const now = Date.now();
  const files = readdirSync("../cloudflare/migrations").filter((f) => f.endsWith(".sql")).sort();
  await kiem(`chạy migration game: ${files.join(", ")}`, async () => {
    for (const f of files) {
      const r = d1(["--file", `../cloudflare/migrations/${f}`]);
      assert.equal(r.status, 0, r.stdout + r.stderr);
    }
  });
  let ma = "";
  await kiem("Admin tạo link mời: mã 12 ký tự, link ghép từ GAME_ORIGIN", async () => {
    const r = await goi("POST", "/api/loi-moi", { cookie: ckAdmin, body: { ten: "Discord đợt 1", toi_da: 2, het_han: now + 7 * NGAY } });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    ma = r.data.ma;
    assert.match(ma, /^[a-z2-9]{12}$/);
    assert.equal(r.data.link, `https://choi.thienhoangky.fun/moi/${ma}`);
  });
  await kiem("người chơi thử theo mã, không lộ the_hash; Admin khóa → nguoi_choi_thu.khoa = 1", async () => {
    sql(
      `INSERT INTO nguoi_choi_thu (id, the_hash, ma_moi, lan_dau, lan_cuoi, so_phien) VALUES ('nc00000001', 'h1', '${ma}', ${now - 2 * NGAY}, ${now}, 3), ('nc00000002', 'h2', '${ma}', ${now - NGAY}, ${now - NGAY}, 1); UPDATE loi_moi SET da_dung = 2 WHERE ma = '${ma}'`,
    );
    const r = await goi("GET", "/api/nguoi-choi", { cookie: ckVan });
    assert.equal(r.data.nguon, "that");
    assert.equal(r.data.link_goc, "https://choi.thienhoangky.fun/moi/");
    assert.ok(!JSON.stringify(r.data).includes("the_hash"));
    assert.equal(r.data.link[0].trang_thai, "het_luot");
    assert.equal((await goi("POST", "/api/nguoi-choi/khoa", { cookie: ckAdmin, body: { id: "nc00000002", khoa: true, ly_do: "thử" } })).status, 200);
    assert.deepEqual(sql("SELECT khoa, sua_boi FROM nguoi_choi_thu WHERE id = 'nc00000002'"), [{ khoa: 1, sua_boi: "kiemthu" }]);
  });
  await kiem("tổng quan thật: người chơi, khóa, hôm nay, link đang mở, FTUE, D1", async () => {
    sql(
      "INSERT INTO su_kien (loai, an_danh, phien, luc, nhan_luc, du_lieu) VALUES " +
        [
          ["mo_phien", "may1", "p1", now - 2 * NGAY, "{}"],
          ["ftue_buoc", "may1", "p1", now - 2 * NGAY, '{"buoc":1}'],
          ["mo_phien", "may1", "p2", now - NGAY, "{}"],
          ["mo_phien", "may2", "p3", now - NGAY, "{}"],
          ["ftue_buoc", "may2", "p3", now - NGAY, '{"buoc":1}'],
          ["ftue_buoc", "may2", "p3", now - NGAY, '{"buoc":2}'],
          ["mo_phien", "may3", "p4", now, "{}"],
        ]
          .map(([l, a, p, t, d]) => `('${l}', '${a}', '${p}', ${t}, ${t}, '${d}')`)
          .join(", "),
    );
    const r = await goi("GET", "/api/tong-quan?ngay=7", { cookie: ckAdmin });
    assert.equal(r.data.nguon, "that");
    assert.deepEqual(r.data.nguoi_choi, { tong: 2, khoa: 1, hom_nay: 1, link_mo: 0 });
    assert.deepEqual(r.data.ftue.slice(0, 3), [2, 1, 0]);
    assert.deepEqual(r.data.giu_chan.d1, { tu: 1, mau: 2 });
  });
  await kiem("phản hồi thật: mã người chơi, liên hệ, ghi chú nội bộ có tên người ghi", async () => {
    sql(`INSERT INTO phan_hoi (nguoi_choi, loai, noi_dung, man, lien_he, thiet_bi, phien_ban, luc) VALUES ('nc00000001', 'loi', 'Nút bị che', 'dang-nhap', 'zalo 0900000000', 'Android Chrome', 'abc1234', ${now})`);
    const p = (await goi("GET", "/api/phan-hoi", { cookie: ckVan })).data.dong[0];
    assert.equal(p.nguoi_choi, "nc00000001");
    assert.equal((await goi("POST", "/api/phan-hoi/ghi-chu", { cookie: ckVan, body: { id: p.id, noi_dung: "đã hỏi lại" } })).status, 200);
    assert.equal((await goi("GET", "/api/phan-hoi", { cookie: ckVan })).data.dong[0].ghi_chu[0].nguoi, "van");
  });
  await kiem("Worker game đọc được thông báo và cấu hình bằng câu SQL trong docs/api.md", async () => {
    await goi("POST", "/api/thong-bao", { cookie: ckAdmin, body: { tieu_de: "Đang hiện", noi_dung: "x", dang: true } });
    const t = Date.now();
    const [row] = sql(
      `SELECT (SELECT COUNT(*) FROM qt_thong_bao WHERE trang_thai = 'dang' AND bat_dau <= ${t} AND (ket_thuc IS NULL OR ket_thuc > ${t})) AS tb, (SELECT gia_tri FROM qt_cau_hinh WHERE khoa = 'toc_do_kinh_te') AS kt`,
    );
    assert.deepEqual(row, { tb: 1, kt: "2" });
  });

  console.log("Đặt lại, khóa, đăng xuất, hết hạn");
  await kiem("Admin đặt lại mật khẩu Vận hành → phiên cũ mất, mật khẩu cũ hết dùng, lần sau phải đổi", async () => {
    const r = await goi("POST", "/api/tai-khoan/dat-lai", { cookie: ckAdmin, body: { ten: "van" } });
    assert.equal(r.status, 200);
    MATKHAU_DA_THAY.push(r.data.mat_khau_tam);
    assert.equal((await goi("GET", "/api/toi", { cookie: ckVan })).status, 401);
    assert.equal((await goi("POST", "/api/dang-nhap", { body: { ten: "van", mat_khau: MK_VAN } })).status, 401);
    const ck = await vao("van", r.data.mat_khau_tam);
    assert.equal((await goi("GET", "/api/toi", { cookie: ck })).data.phai_doi_mat_khau, true);
    assert.equal((await goi("POST", "/api/doi-mat-khau", { cookie: ck, body: { cu: r.data.mat_khau_tam, moi: MK_VAN } })).status, 200);
    ckVan = ck;
  });
  await kiem("Admin khóa tài khoản → phiên đang mở mất ngay, đăng nhập bị từ chối; mở khóa thì vào lại", async () => {
    assert.equal((await goi("POST", "/api/tai-khoan/khoa", { cookie: ckAdmin, body: { ten: "van", khoa: true } })).status, 200);
    assert.equal((await goi("GET", "/api/toi", { cookie: ckVan })).status, 401);
    assert.equal((await goi("POST", "/api/dang-nhap", { body: { ten: "van", mat_khau: MK_VAN } })).status, 403);
    assert.equal((await goi("POST", "/api/tai-khoan/khoa", { cookie: ckAdmin, body: { ten: "van", khoa: false } })).status, 200);
    ckVan = await vao("van", MK_VAN);
  });
  await kiem("đăng xuất → xóa phiên, cookie Max-Age=0, dùng lại cookie cũ → 401", async () => {
    const r = await goi("POST", "/api/dang-xuat", { cookie: ckVan, body: {} });
    assert.equal(r.status, 200);
    assert.match(r.headers.get("set-cookie") ?? "", /Max-Age=0/);
    assert.equal((await goi("GET", "/api/toi", { cookie: ckVan })).status, 401);
  });
  await kiem("phiên hết hạn → 401 và bị xóa khỏi D1", async () => {
    const ck = await vao("van", MK_VAN);
    sql("UPDATE qt_phien SET het_han = 1 WHERE ten = 'van'");
    assert.equal((await goi("GET", "/api/toi", { cookie: ck })).status, 401);
    assert.deepEqual(sql("SELECT COUNT(*) AS so FROM qt_phien WHERE ten = 'van'"), [{ so: 0 }]);
  });
  await kiem("sai 5 lần liền → tạm khóa 15 phút, kể cả mật khẩu đúng (429)", async () => {
    for (let i = 0; i < 5; i++) assert.equal((await goi("POST", "/api/dang-nhap", { body: { ten: "van", mat_khau: `sai-${i}` } })).status, 401);
    const r = await goi("POST", "/api/dang-nhap", { body: { ten: "van", mat_khau: MK_VAN } });
    assert.equal(r.status, 429);
    assert.match(r.data.loi, /tạm khóa/);
    const tk = (await goi("GET", "/api/tai-khoan", { cookie: ckAdmin })).data.dong.find((x: any) => x.ten === "van");
    assert.ok(tk.tam_khoa_den > Date.now());
    // Đặt lại mật khẩu gỡ tạm khóa.
    assert.equal((await goi("POST", "/api/tai-khoan/dat-lai", { cookie: ckAdmin, body: { ten: "van" } })).status, 200);
  });
  await kiem("Admin xóa tài khoản", async () => {
    assert.equal((await goi("POST", "/api/tai-khoan/xoa", { cookie: ckAdmin, body: { ten: "van" } })).status, 200);
    assert.equal((await goi("GET", "/api/tai-khoan", { cookie: ckAdmin })).data.dong.length, 1);
  });
  await kiem("nhật ký ghi đủ việc, đúng người", async () => {
    const viec = (await goi("GET", "/api/nhat-ky", { cookie: ckAdmin })).data.dong.map((x: any) => `${x.nguoi} ${x.hanh_dong}`);
    for (const v of [
      "kiemthu phien.dang_nhap",
      "kiemthu phien.doi_mat_khau",
      "kiemthu tai_khoan.tao",
      "van phien.doi_mat_khau",
      "kiemthu cau_hinh.doi",
      "kiemthu loi_moi.tao",
      "kiemthu nguoi_choi.khoa",
      "van phan_hoi.ghi_chu",
      "van thong_bao.tao",
      "kiemthu tai_khoan.dat_lai",
      "kiemthu tai_khoan.khoa",
      "kiemthu tai_khoan.mo_khoa",
      "van phien.dang_xuat",
      "kiemthu tai_khoan.xoa",
    ])
      assert.ok(viec.includes(v), `thiếu "${v}"`);
    assert.ok(!viec.some((v: string) => v.startsWith("van cau_hinh") || v.startsWith("van loi_moi") || v.startsWith("van tai_khoan")));
  });
  await kiem("chặn theo IP: sai quá 20 lần trong 15 phút → 429 cả với tên khác", async () => {
    let cuoi = 0;
    for (let i = 0; i < 22; i++) cuoi = (await goi("POST", "/api/dang-nhap", { body: { ten: `do${i}`, mat_khau: "x" } })).status;
    assert.equal(cuoi, 429);
    assert.equal((await goi("POST", "/api/dang-nhap", { body: { ten: "kiemthu", mat_khau: MK_ADMIN } })).status, 429);
    sql("DELETE FROM qt_dang_nhap_sai");
  });
  await kiem("log của Worker không có mật khẩu", async () => {
    for (const mk of MATKHAU_DA_THAY) assert.ok(!log.includes(mk), "log lộ mật khẩu");
  });
} finally {
  dung(w);
}

console.log("Lớp Access tùy chọn (ACCESS_TEAM_DOMAIN + ACCESS_AUD)");
const k = await taoKhoa("k-thu");
const { server, url: certs } = await phucVuKhoa([k.jwk]);
const PORT2 = 8792;
const BASE2 = `http://127.0.0.1:${PORT2}`;
const w2 = chayWorker(PORT2, { ACCESS_TEAM_DOMAIN: `https://${TEAM}/`, ACCESS_AUD: AUD, ACCESS_CERTS_URL: certs });
try {
  await doiLen(BASE2);
  const jwt = await kyJwt(k, { email: "ai@example.com" });
  await kiem("bật Access: không JWT thì cả trang đăng nhập cũng bị chặn (401)", async () => {
    assert.equal((await goi("GET", "/", { base: BASE2 })).status, 401);
    assert.equal((await goi("POST", "/api/dang-nhap", { base: BASE2, body: { ten: "kiemthu", mat_khau: MK_ADMIN } })).status, 401);
  });
  await kiem("bật Access: JWT sai aud → 401; JWT đúng vẫn phải đăng nhập mật khẩu", async () => {
    assert.equal((await goi("GET", "/", { base: BASE2, headers: { "Cf-Access-Jwt-Assertion": await kyJwt(k, { email: "ai@example.com", aud: ["khac"] }) } })).status, 401);
    const h = { "Cf-Access-Jwt-Assertion": jwt };
    assert.equal((await goi("GET", "/", { base: BASE2, headers: h })).status, 200);
    assert.equal((await goi("GET", "/api/toi", { base: BASE2, headers: h })).status, 401);
    const ck = await vao("kiemthu", MK_ADMIN, BASE2, h);
    assert.equal((await goi("GET", "/api/toi", { base: BASE2, headers: h, cookie: ck })).status, 200);
  });
} finally {
  dung(w2);
  server.close();
}

console.log(`\n${dat} đạt, ${truot} trượt`);
if (truot) {
  console.log(log.slice(-3000));
  process.exitCode = 1;
}

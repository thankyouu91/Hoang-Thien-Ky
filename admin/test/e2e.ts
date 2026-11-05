// Kiểm đầu-cuối Worker admin chạy thật trong wrangler dev (workerd + D1 cục bộ), JWT ký bằng khóa giả,
// JWKS phục vụ từ máy chủ giả. Kiểm: chặn khi không có hoặc sai JWT, vai trò tra D1, Vận hành bị 403 ở Cấu hình và
// Phân quyền khi gọi thẳng API, "Xem như Vận hành" chỉ hạ quyền, chống CSRF, nhật ký ghi đủ.
// Chạy: npm run build && node test/e2e.ts

import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
import { AUD, TEAM, kyJwt, phucVuKhoa, taoKhoa } from "./khoaGia.ts";

const PORT = 8791;
const BASE = `http://127.0.0.1:${PORT}`;
const STATE = "test/.tmp/state";
const WR = process.platform === "win32" ? "node_modules\\.bin\\wrangler.cmd" : "node_modules/.bin/wrangler";

const k = await taoKhoa("k-thu");
const gia = await taoKhoa("k-thu"); // cùng kid, khóa khác
const { server, url: certs } = await phucVuKhoa([k.jwk]);

rmSync("test/.tmp", { recursive: true, force: true });
const mig = spawnSync(WR, ["d1", "migrations", "apply", "thienhoangky", "--local", "--persist-to", STATE], { shell: true, encoding: "utf8", env: { ...process.env, CI: "1" } });
assert.equal(mig.status, 0, mig.stdout + mig.stderr);

const vars = { ACCESS_TEAM_DOMAIN: TEAM, ACCESS_AUD: AUD, ADMIN_GOC: "goc@example.com", ACCESS_CERTS_URL: certs };
const dev = spawn(WR, ["dev", "--port", String(PORT), "--ip", "127.0.0.1", "--persist-to", STATE, ...Object.entries(vars).flatMap(([a, b]) => ["--var", `${a}:${b}`])], {
  shell: true,
  env: { ...process.env, CI: "1", WRANGLER_SEND_METRICS: "false" },
});
let log = "";
dev.stdout.on("data", (d) => (log += d));
dev.stderr.on("data", (d) => (log += d));

function dung(): void {
  server.close();
  if (process.platform === "win32" && dev.pid) spawnSync("taskkill", ["/pid", String(dev.pid), "/T", "/F"]);
  else dev.kill();
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

const jwt = (email: string, extra: Record<string, unknown> = {}) => kyJwt(k, { email, ...extra });
async function goi(method: string, path: string, opt: { jwt?: string; body?: unknown; headers?: Record<string, string> } = {}) {
  const headers: Record<string, string> = { ...(opt.headers ?? {}) };
  if (opt.jwt) headers["Cf-Access-Jwt-Assertion"] = opt.jwt;
  if (opt.body !== undefined) {
    headers["Content-Type"] ??= "application/json";
    headers.Origin ??= BASE;
  }
  const res = await fetch(BASE + path, { method, headers, body: opt.body === undefined ? undefined : typeof opt.body === "string" ? opt.body : JSON.stringify(opt.body) });
  const text = await res.text();
  let data: any = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: res.status, data, headers: res.headers };
}

try {
  // Đợi wrangler dev sẵn sàng.
  let san = false;
  for (let i = 0; i < 120 && !san; i++) {
    await new Promise((r) => setTimeout(r, 500));
    san = await fetch(BASE + "/api/toi").then(() => true, () => false);
  }
  assert.ok(san, `wrangler dev không lên:\n${log}`);

  const GOC = await jwt("Goc@Example.com");
  const VAN = await jwt("van@example.com");
  const LA = await jwt("la@example.com");

  console.log("Chặn khi chưa qua Access");
  await kiem("trang / không JWT → 401, không trả giao diện", async () => {
    const r = await goi("GET", "/");
    assert.equal(r.status, 401);
    assert.match(String(r.data), /Chưa đăng nhập qua Cloudflare Access/);
    assert.doesNotMatch(String(r.data), /src=|\/assets\//);
  });
  await kiem("file tĩnh không JWT → 401", async () => assert.equal((await goi("GET", "/favicon.svg")).status, 401));
  await kiem("API không JWT → 401", async () => assert.equal((await goi("GET", "/api/toi")).status, 401));
  await kiem("JWT aud của ứng dụng khác → 401", async () => assert.equal((await goi("GET", "/api/toi", { jwt: await jwt("goc@example.com", { aud: ["aud-game"] }) })).status, 401));
  await kiem("JWT ký bằng khóa giả → 401", async () => assert.equal((await goi("GET", "/api/toi", { jwt: await kyJwt(gia, { email: "goc@example.com" }) })).status, 401));
  await kiem("JWT hết hạn → 401", async () => assert.equal((await goi("GET", "/api/toi", { jwt: await jwt("goc@example.com", { exp: 1000 }) })).status, 401));
  await kiem("email qua Access nhưng chưa phân quyền → 403 ở API", async () => assert.equal((await goi("GET", "/api/tong-quan", { jwt: LA })).status, 403));

  console.log("Admin gốc");
  await kiem("GET /api/toi: Admin gốc, email viết thường", async () => {
    const r = await goi("GET", "/api/toi", { jwt: GOC });
    assert.equal(r.status, 200);
    assert.equal(r.data.email, "goc@example.com");
    assert.equal(r.data.vai_tro, "admin");
    assert.equal(r.data.admin_goc, true);
    assert.match(r.headers.get("content-security-policy") ?? "", /frame-ancestors 'none'/);
    assert.equal(r.headers.get("cache-control"), "no-store");
  });
  await kiem("trang / có JWT → giao diện", async () => {
    const r = await goi("GET", "/", { jwt: GOC });
    assert.equal(r.status, 200);
    assert.match(String(r.data), /Thiên Hoang Ký · Quản trị/);
    assert.ok(r.headers.get("content-security-policy"));
  });
  await kiem("đặt van@example.com là Vận hành", async () => assert.equal((await goi("POST", "/api/vai-tro", { jwt: GOC, body: { email: "VAN@example.com", vai_tro: "van_hanh" } })).status, 200));
  await kiem("không tự đổi vai trò của mình, không sửa Admin gốc", async () => {
    assert.equal((await goi("POST", "/api/vai-tro", { jwt: GOC, body: { email: "goc@example.com", vai_tro: "van_hanh" } })).status, 409);
  });
  await kiem("mời người chơi: email sai bị từ chối cả lô", async () => assert.equal((await goi("POST", "/api/nguoi-choi/moi", { jwt: GOC, body: { emails: "a@example.com, khong-phai-email" } })).status, 400));
  await kiem("mời 2 người chơi (một trùng thì bỏ qua)", async () => {
    const r = await goi("POST", "/api/nguoi-choi/moi", { jwt: GOC, body: { emails: "A@example.com\nb@example.com, a@example.com" } });
    assert.equal(r.status, 200);
    assert.equal(r.data.moi, 2);
    assert.equal(r.data.dong_bo.da_noi, false);
  });
  await kiem("khóa b@example.com, danh sách Access bỏ email khóa", async () => {
    assert.equal((await goi("POST", "/api/nguoi-choi/khoa", { jwt: GOC, body: { email: "b@example.com", khoa: true, ly_do: "thử" } })).status, 200);
    const r = await goi("GET", "/api/nguoi-choi", { jwt: GOC });
    assert.equal(r.data.dong.find((x: any) => x.email === "b@example.com").khoa, true);
    assert.deepEqual(r.data.danh_sach_access, ["a@example.com"]);
  });
  await kiem("đổi cấu hình: ngoài khoảng → 400, đúng → ghi lịch sử", async () => {
    assert.equal((await goi("POST", "/api/cau-hinh", { jwt: GOC, body: { khoa: "toc_do_kinh_te", gia_tri: 50 } })).status, 400);
    assert.equal((await goi("POST", "/api/cau-hinh", { jwt: GOC, body: { khoa: "toc_do_kinh_te", gia_tri: 2, ly_do: "thử tua" } })).status, 200);
    const r = await goi("GET", "/api/cau-hinh", { jwt: GOC });
    assert.equal(r.data.tham_so.find((t: any) => t.khoa === "toc_do_kinh_te").gia_tri, 2);
    assert.equal(r.data.lich_su[0].cu, 1);
    assert.equal(r.data.lich_su[0].moi, 2);
  });
  await kiem("chống CSRF: Origin lạ → 403, thân không phải JSON → 415", async () => {
    assert.equal((await goi("POST", "/api/cau-hinh", { jwt: GOC, body: { khoa: "he_so_tua", gia_tri: 2 }, headers: { Origin: "https://evil.example" } })).status, 403);
    assert.equal((await goi("POST", "/api/cau-hinh", { jwt: GOC, body: "khoa=he_so_tua", headers: { "Content-Type": "text/plain" } })).status, 415);
  });
  await kiem("Xem như Vận hành: Admin tự hạ quyền → 403 ở Cấu hình", async () => {
    const r = await goi("GET", "/api/cau-hinh", { jwt: GOC, headers: { "X-Xem-Nhu": "van_hanh" } });
    assert.equal(r.status, 403);
    assert.equal((await goi("GET", "/api/toi", { jwt: GOC, headers: { "X-Xem-Nhu": "van_hanh" } })).data.vai_tro, "van_hanh");
  });

  console.log("Vận hành bị chặn ở server");
  await kiem("GET /api/toi: Vận hành", async () => assert.equal((await goi("GET", "/api/toi", { jwt: VAN })).data.vai_tro, "van_hanh"));
  const cam: [string, string, unknown?][] = [
    ["GET", "/api/cau-hinh"],
    ["POST", "/api/cau-hinh", { khoa: "he_so_tua", gia_tri: 4 }],
    ["GET", "/api/vai-tro"],
    ["POST", "/api/vai-tro", { email: "van@example.com", vai_tro: "admin" }],
    ["POST", "/api/vai-tro/xoa", { email: "goc@example.com" }],
    ["POST", "/api/nguoi-choi/moi", { emails: "c@example.com" }],
    ["POST", "/api/nguoi-choi/khoa", { email: "a@example.com", khoa: true }],
    ["POST", "/api/nguoi-choi/bo", { email: "a@example.com" }],
    ["POST", "/api/access/dong-bo", { nhom: "quan_tri" }],
  ];
  for (const [m, p, b] of cam) {
    await kiem(`${m} ${p} → 403`, async () => {
      const r = await goi(m, p, { jwt: VAN, body: b });
      assert.equal(r.status, 403, JSON.stringify(r.data));
      assert.match(r.data.loi, /Chỉ Admin/);
    });
  }
  await kiem("Vận hành gửi X-Xem-Nhu khác không nâng được quyền", async () => assert.equal((await goi("GET", "/api/cau-hinh", { jwt: VAN, headers: { "X-Xem-Nhu": "admin" } })).status, 403));
  const duoc: [string, string, unknown?][] = [
    ["GET", "/api/tong-quan"],
    ["GET", "/api/su-kien"],
    ["GET", "/api/nguoi-choi"],
    ["POST", "/api/nguoi-choi/sua", { email: "a@example.com", ghi_chu: "chơi buổi tối" }],
    ["GET", "/api/phan-hoi"],
    ["POST", "/api/phan-hoi/trang-thai", { id: "mau-1", trang_thai: "dang_xem" }],
    ["POST", "/api/phan-hoi/ghi-chu", { id: "mau-1", noi_dung: "đã tái hiện được" }],
    ["GET", "/api/thong-bao"],
    ["POST", "/api/thong-bao", { tieu_de: "Bảo trì tối nay", noi_dung: "22:00–22:30", dang: true, bat_dau: Date.now() + 3600_000 }],
    ["GET", "/api/nhat-ky"],
  ];
  for (const [m, p, b] of duoc) await kiem(`${m} ${p} → 200`, async () => assert.equal((await goi(m, p, { jwt: VAN, body: b })).status, 200));
  await kiem("tổng quan báo dữ liệu mẫu khi chưa có bảng game, số mời là thật", async () => {
    const r = await goi("GET", "/api/tong-quan?ngay=7", { jwt: VAN });
    assert.equal(r.data.nguon, "mau");
    assert.equal(r.data.theo_ngay.length, 7);
    assert.equal(r.data.ftue.length, 8);
    assert.equal(r.data.nguoi_choi.moi, 2);
  });
  await kiem("phản hồi lạ → 404", async () => assert.equal((await goi("POST", "/api/phan-hoi/trang-thai", { jwt: VAN, body: { id: "khong-co", trang_thai: "moi" } })).status, 404));
  await kiem("thông báo hẹn giờ hiện là 'hen', gỡ được", async () => {
    const r = await goi("GET", "/api/thong-bao", { jwt: VAN });
    const tb = r.data.dong[0];
    assert.equal(tb.hien, "hen");
    assert.equal((await goi("POST", "/api/thong-bao/go", { jwt: VAN, body: { id: tb.id } })).status, 200);
    assert.equal((await goi("GET", "/api/thong-bao", { jwt: VAN })).data.dong[0].hien, "da_go");
  });

  console.log("Thu quyền và nhật ký");
  await kiem("thu quyền Vận hành → yêu cầu kế tiếp bị 403", async () => {
    assert.equal((await goi("POST", "/api/vai-tro/xoa", { jwt: GOC, body: { email: "van@example.com" } })).status, 200);
    assert.equal((await goi("GET", "/api/tong-quan", { jwt: VAN })).status, 403);
  });
  await kiem("nhật ký ghi đủ việc, đúng người", async () => {
    const r = await goi("GET", "/api/nhat-ky", { jwt: GOC });
    const viec = r.data.dong.map((x: any) => `${x.email} ${x.hanh_dong}`);
    for (const v of [
      "goc@example.com vai_tro.dat",
      "goc@example.com nguoi_choi.moi",
      "goc@example.com nguoi_choi.khoa",
      "goc@example.com cau_hinh.doi",
      "van@example.com nguoi_choi.sua",
      "van@example.com phan_hoi.trang_thai",
      "van@example.com phan_hoi.ghi_chu",
      "van@example.com thong_bao.tao",
      "van@example.com thong_bao.go",
      "goc@example.com vai_tro.xoa",
    ])
      assert.ok(viec.includes(v), `thiếu "${v}" trong ${JSON.stringify(viec)}`);
    // Lần bị từ chối không ghi gì.
    assert.ok(!viec.some((v: string) => v.startsWith("van@example.com cau_hinh")));
  });
  console.log("Số liệu thật từ bảng game (cloudflare/migrations)");
  const NGAY = 86400000;
  const now = Date.now();
  const sql = [
    `INSERT INTO nguoi_choi_thu (email, lan_dau, lan_cuoi, so_phien) VALUES ('a@example.com', ${now - 2 * NGAY}, ${now}, 3), ('ngoai@example.com', ${now - NGAY}, ${now - NGAY}, 1)`,
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
    `INSERT INTO phan_hoi (email, loai, noi_dung, man, thiet_bi, phien_ban, luc) VALUES ('a@example.com', 'loi', 'Nút Nhận mã bị che', 'dang-nhap', 'Android Chrome', 'abc1234', ${now})`,
  ].join("; ");
  const mg = spawnSync(WR, ["d1", "execute", "thienhoangky", "--local", "--persist-to", STATE, "--file", "../cloudflare/migrations/0001_khoi_tao.sql"], { shell: true, encoding: "utf8", env: { ...process.env, CI: "1" } });
  const ins = spawnSync(WR, ["d1", "execute", "thienhoangky", "--local", "--persist-to", STATE, "--command", JSON.stringify(sql)], { shell: true, encoding: "utf8", env: { ...process.env, CI: "1" } });
  await kiem("tạo bảng game và dữ liệu thử", async () => {
    assert.equal(mg.status, 0, mg.stdout + mg.stderr);
    assert.equal(ins.status, 0, ins.stdout + ins.stderr);
  });
  await kiem("tổng quan đọc bảng thật: người, phiên, FTUE, D1", async () => {
    const r = await goi("GET", "/api/tong-quan?ngay=7", { jwt: GOC });
    assert.equal(r.data.nguon, "that");
    assert.equal(r.data.nguoi_choi.da_choi, 2);
    assert.equal(r.data.nguoi_choi.hom_nay, 1);
    assert.deepEqual(r.data.ftue.slice(0, 3), [2, 1, 0]);
    assert.deepEqual(r.data.giu_chan.d1, { tu: 1, mau: 2 });
    assert.deepEqual(r.data.giu_chan.d7, { tu: 0, mau: 0 });
    const cuoi = r.data.theo_ngay.slice(-3);
    assert.deepEqual(cuoi.map((x: any) => [x.phien, x.nguoi]), [[1, 1], [2, 2], [1, 1]]);
  });
  await kiem("sự kiện thật: ẩn danh, không có email, lọc theo loại", async () => {
    const r = await goi("GET", "/api/su-kien?loai=ftue_buoc", { jwt: GOC });
    assert.equal(r.data.nguon, "that");
    assert.equal(r.data.dong.length, 3);
    assert.ok(r.data.dong.every((x: any) => !("email" in x) && x.an_danh));
  });
  await kiem("người chơi: gộp lần chơi từ nguoi_choi_thu, hiện email ngoài danh sách mời", async () => {
    const r = await goi("GET", "/api/nguoi-choi", { jwt: GOC });
    const a = r.data.dong.find((x: any) => x.email === "a@example.com");
    assert.equal(a.so_phien, 3);
    assert.equal(a.da_moi, true);
    const ngoai = r.data.dong.find((x: any) => x.email === "ngoai@example.com");
    assert.equal(ngoai.da_moi, false);
  });
  await kiem("phản hồi thật: gắn trạng thái theo id số, id mẫu bị từ chối", async () => {
    const r = await goi("GET", "/api/phan-hoi", { jwt: GOC });
    assert.equal(r.data.nguon, "that");
    const id = r.data.dong[0].id;
    assert.equal(r.data.dong[0].thiet_bi, "Android Chrome");
    assert.equal((await goi("POST", "/api/phan-hoi/trang-thai", { jwt: GOC, body: { id, trang_thai: "da_xu_ly" } })).status, 200);
    assert.equal((await goi("GET", "/api/phan-hoi?trang_thai=da_xu_ly", { jwt: GOC })).data.dong.length, 1);
    assert.equal((await goi("POST", "/api/phan-hoi/trang-thai", { jwt: GOC, body: { id: "mau-1", trang_thai: "moi" } })).status, 404);
  });
  await kiem("Worker game đọc được thông báo và cấu hình bằng câu SQL trong docs/api.md", async () => {
    await goi("POST", "/api/thong-bao", { jwt: GOC, body: { tieu_de: "Đang hiện", noi_dung: "x", dang: true } });
    const q = spawnSync(WR, ["d1", "execute", "thienhoangky", "--local", "--persist-to", STATE, "--json", "--command",
      JSON.stringify(`SELECT (SELECT COUNT(*) FROM qt_thong_bao WHERE trang_thai = 'dang' AND bat_dau <= ${Date.now()} AND (ket_thuc IS NULL OR ket_thuc > ${Date.now()})) AS tb, (SELECT gia_tri FROM qt_cau_hinh WHERE khoa = 'toc_do_kinh_te') AS kt, (SELECT khoa FROM qt_nguoi_choi WHERE email = 'b@example.com') AS khoa`)],
      { shell: true, encoding: "utf8", env: { ...process.env, CI: "1" } });
    assert.equal(q.status, 0, q.stderr);
    const row = JSON.parse(q.stdout.slice(q.stdout.indexOf("[")))[0].results[0];
    assert.deepEqual(row, { tb: 1, kt: "2", khoa: 1 });
  });
  await kiem("log của Worker không chứa email", async () => {
    assert.doesNotMatch(log, /@example\.com/i);
  });
} finally {
  dung();
}

console.log(`\n${dat} đạt, ${truot} trượt`);
if (truot) {
  console.log(log.slice(-3000));
  process.exitCode = 1;
}

// Kiểm đầu-cuối Worker admin chạy thật trong wrangler dev (workerd + D1 cục bộ), JWT ký bằng khóa giả,
// JWKS phục vụ từ máy chủ giả. Kiểm: chặn khi không có hoặc sai JWT, vai trò tra D1, Vận hành bị 403 ở Cấu hình,
// Phân quyền, link mời và khóa người chơi khi gọi thẳng API; "Xem như Vận hành" chỉ hạ quyền; chống CSRF; nhật ký ghi đủ;
// đọc và ghi đúng bảng game của cloudflare/migrations (link mời, người chơi thử theo mã, phản hồi).
// Chạy: npm run build && node test/e2e.ts

import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { readdirSync, rmSync } from "node:fs";
import { AUD, TEAM, kyJwt, phucVuKhoa, taoKhoa } from "./khoaGia.ts";

const PORT = 8791;
const BASE = `http://127.0.0.1:${PORT}`;
const STATE = "test/.tmp/state";
const WR = process.platform === "win32" ? "node_modules\\.bin\\wrangler.cmd" : "node_modules/.bin/wrangler";
const ENV = { ...process.env, CI: "1", WRANGLER_SEND_METRICS: "false" };

const k = await taoKhoa("k-thu");
const gia = await taoKhoa("k-thu"); // cùng kid, khóa khác
const { server, url: certs } = await phucVuKhoa([k.jwk]);

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

// Team domain ghi kèm https:// như trên dashboard Zero Trust: Worker phải tự bỏ scheme.
const vars = { ACCESS_TEAM_DOMAIN: `https://${TEAM}/`, ACCESS_AUD: AUD, ADMIN_GOC: "goc@example.com", ACCESS_CERTS_URL: certs, GAME_ORIGIN: "https://choi.thienhoangky.fun/" };
const dev = spawn(WR, ["dev", "--port", String(PORT), "--ip", "127.0.0.1", "--persist-to", STATE, ...Object.entries(vars).flatMap(([a, b]) => ["--var", `${a}:${b}`])], {
  shell: true,
  env: ENV,
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
  await kiem("GET /api/toi: Admin gốc, email viết thường, team không có https://", async () => {
    const r = await goi("GET", "/api/toi", { jwt: GOC });
    assert.equal(r.status, 200);
    assert.equal(r.data.email, "goc@example.com");
    assert.equal(r.data.vai_tro, "admin");
    assert.equal(r.data.admin_goc, true);
    assert.equal(r.data.access.team, TEAM);
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
  await kiem("bảng game chưa có: người chơi trả mẫu, tạo link báo 503", async () => {
    const r = await goi("GET", "/api/nguoi-choi", { jwt: GOC });
    assert.equal(r.data.nguon, "mau");
    assert.ok(r.data.link.length > 0);
    assert.equal((await goi("POST", "/api/loi-moi", { jwt: GOC, body: { ten: "thử" } })).status, 503);
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
    assert.equal((await goi("GET", "/api/cau-hinh", { jwt: GOC, headers: { "X-Xem-Nhu": "van_hanh" } })).status, 403);
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
    ["POST", "/api/loi-moi", { ten: "link lậu" }],
    ["POST", "/api/loi-moi/sua", { ma: "maumoi-discord1", ten: "x" }],
    ["POST", "/api/loi-moi/tat", { ma: "maumoi-discord1", tat: true }],
    ["POST", "/api/nguoi-choi/khoa", { id: "abcdefghij", khoa: true }],
    ["POST", "/api/access/dong-bo", {}],
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
    ["POST", "/api/nguoi-choi/ghi-chu", { id: "abcdefghij", ghi_chu: "chơi buổi tối" }],
    ["GET", "/api/phan-hoi"],
    ["POST", "/api/phan-hoi/trang-thai", { id: "mau-1", trang_thai: "dang_xem" }],
    ["POST", "/api/phan-hoi/ghi-chu", { id: "mau-1", noi_dung: "đã tái hiện được" }],
    ["GET", "/api/thong-bao"],
    ["POST", "/api/thong-bao", { tieu_de: "Bảo trì tối nay", noi_dung: "22:00–22:30", dang: true, bat_dau: Date.now() + 3600_000 }],
    ["GET", "/api/nhat-ky"],
  ];
  for (const [m, p, b] of duoc) await kiem(`${m} ${p} → 200`, async () => assert.equal((await goi(m, p, { jwt: VAN, body: b })).status, 200));
  await kiem("tổng quan báo dữ liệu mẫu khi chưa có bảng game", async () => {
    const r = await goi("GET", "/api/tong-quan?ngay=7", { jwt: VAN });
    assert.equal(r.data.nguon, "mau");
    assert.equal(r.data.theo_ngay.length, 7);
    assert.equal(r.data.ftue.length, 8);
  });
  await kiem("phản hồi lạ → 404", async () => assert.equal((await goi("POST", "/api/phan-hoi/trang-thai", { jwt: VAN, body: { id: "khong-co", trang_thai: "moi" } })).status, 404));
  await kiem("thông báo hẹn giờ hiện là 'hen', gỡ được", async () => {
    const tb = (await goi("GET", "/api/thong-bao", { jwt: VAN })).data.dong[0];
    assert.equal(tb.hien, "hen");
    assert.equal((await goi("POST", "/api/thong-bao/go", { jwt: VAN, body: { id: tb.id } })).status, 200);
    assert.equal((await goi("GET", "/api/thong-bao", { jwt: VAN })).data.dong[0].hien, "da_go");
  });

  console.log("Bảng game thật (cloudflare/migrations)");
  const NGAY = 86400000;
  const now = Date.now();
  const files = readdirSync("../cloudflare/migrations").filter((f) => f.endsWith(".sql")).sort();
  await kiem(`chạy migration game: ${files.join(", ")}`, async () => {
    assert.ok(files.some((f) => /link_moi/.test(f)), "chưa có migration link mời của Worker game");
    for (const f of files) {
      const r = d1(["--file", `../cloudflare/migrations/${f}`]);
      assert.equal(r.status, 0, r.stdout + r.stderr);
    }
  });
  let ma = "";
  await kiem("Admin tạo link mời: mã ngẫu nhiên 12 ký tự, link ghép từ GAME_ORIGIN", async () => {
    const r = await goi("POST", "/api/loi-moi", { jwt: GOC, body: { ten: "Discord đợt 1", toi_da: 2, het_han: now + 7 * NGAY } });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    ma = r.data.ma;
    assert.match(ma, /^[a-z2-9]{12}$/);
    assert.equal(r.data.link, `https://choi.thienhoangky.fun/moi/${ma}`);
    assert.equal((await goi("GET", "/api/nguoi-choi", { jwt: GOC })).data.link_goc, "https://choi.thienhoangky.fun/moi/");
  });
  await kiem("người chơi thử vào bằng link (giả Worker game ghi) → danh sách thật, không lộ the_hash", async () => {
    sql(
      `INSERT INTO nguoi_choi_thu (id, the_hash, ma_moi, lan_dau, lan_cuoi, so_phien) VALUES ('nc00000001', 'h1', '${ma}', ${now - 2 * NGAY}, ${now}, 3), ('nc00000002', 'h2', '${ma}', ${now - NGAY}, ${now - NGAY}, 1); UPDATE loi_moi SET da_dung = 2 WHERE ma = '${ma}'`,
    );
    const r = await goi("GET", "/api/nguoi-choi", { jwt: VAN });
    assert.equal(r.data.nguon, "that");
    assert.equal(r.data.dong.length, 2);
    assert.ok(!JSON.stringify(r.data).includes("the_hash") && !JSON.stringify(r.data).includes('"h1"'));
    assert.equal(r.data.link[0].trang_thai, "het_luot");
    assert.equal(r.data.dong.find((x: any) => x.id === "nc00000001").so_phien, 3);
  });
  await kiem("Admin khóa người chơi → nguoi_choi_thu.khoa = 1 (Worker game đọc cột này)", async () => {
    assert.equal((await goi("POST", "/api/nguoi-choi/khoa", { jwt: GOC, body: { id: "nc00000002", khoa: true, ly_do: "thử" } })).status, 200);
    assert.deepEqual(sql("SELECT khoa, ly_do_khoa, sua_boi FROM nguoi_choi_thu WHERE id = 'nc00000002'"), [{ khoa: 1, ly_do_khoa: "thử", sua_boi: "goc@example.com" }]);
    assert.equal((await goi("POST", "/api/nguoi-choi/khoa", { jwt: GOC, body: { id: "khongco000", khoa: true } })).status, 404);
  });
  await kiem("Admin sửa và tắt link; ghi chú người chơi lưu ở qt_ghi_chu_nguoi_choi", async () => {
    assert.equal((await goi("POST", "/api/loi-moi/sua", { jwt: GOC, body: { ma, ten: "Discord đợt 1", toi_da: 5, het_han: null } })).status, 200);
    assert.equal((await goi("GET", "/api/nguoi-choi", { jwt: GOC })).data.link[0].trang_thai, "mo");
    assert.equal((await goi("POST", "/api/loi-moi/tat", { jwt: GOC, body: { ma, tat: true } })).status, 200);
    assert.deepEqual(sql(`SELECT tat, toi_da, het_han FROM loi_moi WHERE ma = '${ma}'`), [{ tat: 1, toi_da: 5, het_han: null }]);
    assert.equal((await goi("POST", "/api/nguoi-choi/ghi-chu", { jwt: VAN, body: { id: "nc00000001", ghi_chu: "bạn của Minh" } })).status, 200);
    assert.equal((await goi("GET", "/api/nguoi-choi", { jwt: GOC })).data.dong.find((x: any) => x.id === "nc00000001").ghi_chu, "bạn của Minh");
  });
  await kiem("tổng quan thật: người chơi thử, khóa, hôm nay, link đang mở, FTUE, D1", async () => {
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
    const r = await goi("GET", "/api/tong-quan?ngay=7", { jwt: GOC });
    assert.equal(r.data.nguon, "that");
    assert.deepEqual(r.data.nguoi_choi, { tong: 2, khoa: 1, hom_nay: 1, link_mo: 0 });
    assert.deepEqual(r.data.ftue.slice(0, 3), [2, 1, 0]);
    assert.deepEqual(r.data.giu_chan.d1, { tu: 1, mau: 2 });
    assert.deepEqual(r.data.theo_ngay.slice(-3).map((x: any) => [x.phien, x.nguoi]), [[1, 1], [2, 2], [1, 1]]);
  });
  await kiem("sự kiện thật: ẩn danh, lọc theo loại", async () => {
    const r = await goi("GET", "/api/su-kien?loai=ftue_buoc", { jwt: GOC });
    assert.equal(r.data.nguon, "that");
    assert.equal(r.data.dong.length, 3);
    assert.ok(r.data.dong.every((x: any) => x.an_danh && !("email" in x)));
  });
  await kiem("phản hồi thật: mã người chơi, liên hệ; gắn trạng thái theo id số; id mẫu bị từ chối", async () => {
    sql(`INSERT INTO phan_hoi (nguoi_choi, loai, noi_dung, man, lien_he, thiet_bi, phien_ban, luc) VALUES ('nc00000001', 'loi', 'Nút Nhận mã bị che', 'dang-nhap', 'zalo 0900000000', 'Android Chrome', 'abc1234', ${now})`);
    const r = await goi("GET", "/api/phan-hoi", { jwt: GOC });
    assert.equal(r.data.nguon, "that");
    const p = r.data.dong[0];
    assert.equal(p.nguoi_choi, "nc00000001");
    assert.equal(p.lien_he, "zalo 0900000000");
    assert.equal((await goi("POST", "/api/phan-hoi/trang-thai", { jwt: GOC, body: { id: p.id, trang_thai: "da_xu_ly" } })).status, 200);
    assert.equal((await goi("GET", "/api/phan-hoi?trang_thai=da_xu_ly", { jwt: GOC })).data.dong.length, 1);
    assert.equal((await goi("POST", "/api/phan-hoi/trang-thai", { jwt: GOC, body: { id: "mau-1", trang_thai: "moi" } })).status, 404);
    assert.equal((await goi("GET", "/api/nguoi-choi", { jwt: GOC })).data.dong.find((x: any) => x.id === "nc00000001").so_phan_hoi, 1);
  });
  await kiem("Worker game đọc được thông báo và cấu hình bằng câu SQL trong docs/api.md", async () => {
    await goi("POST", "/api/thong-bao", { jwt: GOC, body: { tieu_de: "Đang hiện", noi_dung: "x", dang: true } });
    const t = Date.now();
    const [row] = sql(
      `SELECT (SELECT COUNT(*) FROM qt_thong_bao WHERE trang_thai = 'dang' AND bat_dau <= ${t} AND (ket_thuc IS NULL OR ket_thuc > ${t})) AS tb, (SELECT gia_tri FROM qt_cau_hinh WHERE khoa = 'toc_do_kinh_te') AS kt`,
    );
    assert.deepEqual(row, { tb: 1, kt: "2" });
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
      "goc@example.com cau_hinh.doi",
      "goc@example.com loi_moi.tao",
      "goc@example.com loi_moi.sua",
      "goc@example.com loi_moi.tat",
      "goc@example.com nguoi_choi.khoa",
      "van@example.com nguoi_choi.ghi_chu",
      "van@example.com phan_hoi.trang_thai",
      "van@example.com phan_hoi.ghi_chu",
      "van@example.com thong_bao.tao",
      "van@example.com thong_bao.go",
      "goc@example.com vai_tro.xoa",
    ])
      assert.ok(viec.includes(v), `thiếu "${v}" trong ${JSON.stringify(viec)}`);
    assert.ok(!viec.some((v: string) => v.startsWith("van@example.com cau_hinh") || v.startsWith("van@example.com loi_moi")));
  });
  await kiem("log của Worker không chứa email", async () => assert.doesNotMatch(log, /@example\.com/i));
} finally {
  dung();
}

console.log(`\n${dat} đạt, ${truot} trượt`);
if (truot) {
  console.log(log.slice(-3000));
  process.exitCode = 1;
}

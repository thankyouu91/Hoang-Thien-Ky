import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import {
  apply, emptyState, addSect, addMember, techniqueName, techniqueOf,
  type GameState, type Role, type Result,
} from "../src/index.ts";

const NOW = 1_800_000_000_000;

/** Tông "t" ở cấp `level`, có tông chủ "chu", trưởng lão "lao", nội môn "de". */
function world(level = 50): GameState {
  const s = emptyState();
  addSect(s, "t", level);
  const roles: [string, Role][] = [["chu", "tong_chu"], ["lao", "truong_lao"], ["de", "noi_mon"]];
  for (const [id, role] of roles) addMember(s, id, "t", role);
  addMember(s, "le", null, null); // tán tu, chưa vào tông
  return s;
}
const ok = (r: Result) => {
  assert.equal(r.ok, true, r.ok ? "" : r.error);
  return r.ok ? r.events : [];
};
/** Nhặt rồi nộp một quyển, trả về uid. */
function deposit(s: GameState, memberId: string, kind: string, grade: number): number {
  const [e] = ok(apply(s, { type: "nhat_tan_quyen", actor: "system", memberId, kind, grade }, NOW));
  const uid = e.type === "nhat_tan_quyen" ? e.scroll.uid : -1;
  ok(apply(s, { type: "nop_tan_quyen", actor: memberId, scrollUid: uid }, NOW));
  return uid;
}

test("chỉ hệ thống trao được tàn quyển; quyển phải có trong danh mục, phẩm 1–10", () => {
  const s = world();
  assert.deepEqual(apply(s, { type: "nhat_tan_quyen", actor: "de" as "system", memberId: "de", kind: "kim.can_don.bao", grade: 1 }, NOW), { ok: false, error: "chi_he_thong" });
  assert.deepEqual(apply(s, { type: "nhat_tan_quyen", actor: "system", memberId: "de", kind: "kim.can_don.manh", grade: 1 }, NOW), { ok: false, error: "khong_co_tan_quyen" });
  assert.deepEqual(apply(s, { type: "nhat_tan_quyen", actor: "system", memberId: "de", kind: "kim.can_don.bao", grade: 11 }, NOW), { ok: false, error: "pham_khong_hop_le" });
  ok(apply(s, { type: "nhat_tan_quyen", actor: "system", memberId: "de", kind: "kim.can_don.bao", grade: 2 }, NOW));
  assert.deepEqual(s.members.de.bag, [{ uid: 1, kind: "kim.can_don.bao", grade: 2 }]);
});

test("nộp tàn quyển vào Tàng Kinh Các: cống hiến 10 × 2^(phẩm − 1)", () => {
  const s = world();
  deposit(s, "de", "kim.can_don.bao", 1);
  deposit(s, "de", "kim.can_don.bao", 4);
  assert.equal(s.members.de.contribution, 10 + 80);
  assert.equal(s.members.de.bag.length, 0);
  assert.equal(s.sects.t.library.length, 2);
});

test("chỉ nộp được quyển trong túi mình, và phải đã vào tông", () => {
  const s = world();
  ok(apply(s, { type: "nhat_tan_quyen", actor: "system", memberId: "de", kind: "kim.can_don.bao", grade: 1 }, NOW));
  assert.deepEqual(apply(s, { type: "nop_tan_quyen", actor: "lao", scrollUid: 1 }, NOW), { ok: false, error: "khong_co_tan_quyen" });
  ok(apply(s, { type: "nhat_tan_quyen", actor: "system", memberId: "le", kind: "kim.can_don.bao", grade: 1 }, NOW));
  assert.deepEqual(apply(s, { type: "nop_tan_quyen", actor: "le", scrollUid: 2 }, NOW), { ok: false, error: "chua_vao_tong" });
});

test("ghép công pháp theo ví dụ GDD: tên, phẩm, chỉ số, tàn quyển bị tiêu hao", () => {
  const s = world();
  const main = deposit(s, "de", "loi.can_quet.linh", 1);
  const sub = deposit(s, "de", "quang.ho_the.ben", 2);
  const [e] = ok(apply(s, { type: "ghep_cong_phap", actor: "lao", main, subs: [sub] }, NOW));
  assert.equal(e.type, "ghep_cong_phap");
  const t = s.sects.t.techniques[0];
  assert.equal(t.name, "Lôi Quang Liên Hoàn Quyết");
  assert.equal(t.grade, 1); // phẩm thấp nhất
  assert.equal(t.createdBy, "lao");
  assert.equal(t.createdAt, NOW);
  assert.equal(techniqueOf(t).damage, 105000);
  assert.equal(s.sects.t.library.length, 0);
});

test("tên công pháp: ví dụ GDD, thuần hệ, hai phụ quyển", () => {
  assert.equal(techniqueName("loi.tam_xa.linh", ["am_lanh.tam_xa.ben"]), "Lôi Âm Châm Quyết");
  assert.equal(techniqueName("hoa.can_don.bao", ["hoa.dien_rong.ben"]), "Thuần Hỏa Trảm Quyết");
  assert.equal(techniqueName("loi.can_don.bao", ["loi.can_don.ben", "quang.ho_the.ben"]), "Lôi Quang Trảm Quyết");
  assert.equal(techniqueName("cuc_han.khong_che.linh", ["thuy.tam_xa.bao", "moc.hoi_phuc.toc"]), "Hàn Thủy Mộc Tỏa Quyết");
});

test("chỉ trưởng lão trở lên được ghép", () => {
  const s = world();
  const main = deposit(s, "de", "kim.can_don.bao", 1);
  const sub = deposit(s, "de", "kim.can_don.ben", 1);
  assert.deepEqual(apply(s, { type: "ghep_cong_phap", actor: "de", main, subs: [sub] }, NOW), { ok: false, error: "khong_du_quyen" });
  ok(apply(s, { type: "ghep_cong_phap", actor: "chu", main, subs: [sub] }, NOW));
});

test("phụ quyển thứ hai mở từ cấp tông môn 100", () => {
  const ids = (s: GameState) => ["kim.can_don.bao", "kim.can_don.ben", "quang.ho_the.ben"].map((k) => deposit(s, "de", k, 1));
  const low = world(99);
  const [m1, a1, b1] = ids(low);
  assert.deepEqual(apply(low, { type: "ghep_cong_phap", actor: "lao", main: m1, subs: [a1, b1] }, NOW), { ok: false, error: "can_cap_tong_100" });
  const high = world(100);
  const [m2, a2, b2] = ids(high);
  ok(apply(high, { type: "ghep_cong_phap", actor: "lao", main: m2, subs: [a2, b2] }, NOW));
  assert.equal(high.sects.t.techniques[0].subs.length, 2);
});

test("ghép sai thì báo lỗi và không đổi trạng thái", () => {
  const s = world(100);
  const main = deposit(s, "de", "kim.can_don.bao", 1);
  const sub = deposit(s, "de", "kim.can_don.ben", 1);
  const before = JSON.stringify(s);
  const bad: [number[], string][] = [
    [[], "sai_so_phu_quyen"],
    [[sub, sub], "tan_quyen_trung"],
    [[main], "tan_quyen_trung"],
    [[999], "khong_co_tan_quyen"],
    [[sub, 998, 997], "sai_so_phu_quyen"],
  ];
  for (const [subs, error] of bad) {
    assert.deepEqual(apply(s, { type: "ghep_cong_phap", actor: "lao", main, subs }, NOW), { ok: false, error });
  }
  assert.deepEqual(apply(s, { type: "ghep_cong_phap", actor: "le", main, subs: [sub] }, NOW), { ok: false, error: "chua_vao_tong" });
  assert.deepEqual(apply(s, { type: "ghep_cong_phap", actor: "ai_do", main, subs: [sub] }, NOW), { ok: false, error: "khong_co_thanh_vien" });
  assert.equal(JSON.stringify(s), before);
});

test("cùng chuỗi lệnh cho cùng trạng thái; trạng thái qua được JSON", () => {
  const run = () => {
    const s = world();
    const main = deposit(s, "de", "loi.can_quet.linh", 1);
    const sub = deposit(s, "lao", "quang.ho_the.ben", 1);
    ok(apply(s, { type: "ghep_cong_phap", actor: "lao", main, subs: [sub] }, NOW));
    return JSON.stringify(s);
  };
  assert.equal(run(), run());
  assert.deepEqual(JSON.parse(run()), JSON.parse(run()));
});

test("mã nguồn rules giữ ràng buộc để mang vào Nakama", () => {
  const dir = new URL("../src/", import.meta.url);
  const banned = [/\bnew (Map|Set)\b/, /\bDate\b/, /Math\.random/, /\basync\b/, /\bawait\b/, /\.includes\(/, /\bclass\b/];
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".ts"))) {
    const code = readFileSync(new URL(f, dir), "utf8").replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
    for (const re of banned) assert.ok(!re.test(code), `${f} dùng ${re}`);
  }
});

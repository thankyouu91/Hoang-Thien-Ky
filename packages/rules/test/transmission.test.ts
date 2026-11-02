import { test } from "node:test";
import assert from "node:assert/strict";
import { Battle, baseStats, type UnitSpec } from "@ktlp/sim";
import {
  apply, emptyState, addSect, addMember, transmissionSlots, loadoutTechniques,
  type GameState, type Role, type Result,
} from "../src/index.ts";

const NOW = 1_800_000_000_000;

/** Tông "t" có tông chủ, phó tông chủ, trưởng lão, nội môn "de" (cấp `deLevel`), ngoại môn "ngoai" (cấp 100). */
function world(sectLevel = 50, deLevel = 1): GameState {
  const s = emptyState();
  addSect(s, "t", sectLevel);
  const people: [string, Role, number][] = [
    ["chu", "tong_chu", 100], ["pho", "pho_tong_chu", 100], ["lao", "truong_lao", 100], ["de", "noi_mon", deLevel], ["ngoai", "ngoai_mon", 100],
  ];
  for (const [id, role, level] of people) addMember(s, id, "t", role, level);
  return s;
}
const ok = (r: Result) => {
  assert.equal(r.ok, true, r.ok ? "" : r.error);
  return r.ok ? r.events : [];
};
const err = (r: Result) => (r.ok ? "ok" : r.error);
/** Nhặt, nộp và ghép một công pháp từ các loại tàn quyển (chủ trước), trả về id công pháp. */
function forge(s: GameState, kinds: string[], grade = 1): number {
  const uids = kinds.map((kind) => {
    const [e] = ok(apply(s, { type: "nhat_tan_quyen", actor: "system", memberId: "lao", kind, grade }, NOW));
    const uid = e.type === "nhat_tan_quyen" ? e.scroll.uid : -1;
    ok(apply(s, { type: "nop_tan_quyen", actor: "lao", scrollUid: uid }, NOW));
    return uid;
  });
  const [e] = ok(apply(s, { type: "ghep_cong_phap", actor: "lao", main: uids[0], subs: uids.slice(1) }, NOW));
  return e.type === "ghep_cong_phap" ? e.technique.id : -1;
}
const set = (s: GameState, actor: string, techniqueIds: number[]) => apply(s, { type: "dat_bo_truyen_thu", actor, techniqueIds }, NOW);
const learn = (s: GameState, actor: string, techniqueId: number) => apply(s, { type: "hoc_cong_phap", actor, techniqueId }, NOW);
const carry = (s: GameState, actor: string, techniqueIds: number[]) => apply(s, { type: "mang_vao_tran", actor, techniqueIds }, NOW);

test("bộ truyền thụ: 12 suất, thêm 1 mỗi 25 cấp tông môn, tối đa 20", () => {
  const cases: [number, number][] = [[1, 12], [24, 12], [25, 13], [100, 16], [199, 19], [200, 20], [250, 20]];
  for (const [level, slots] of cases) assert.equal(transmissionSlots(level), slots, `cấp ${level}`);
});

test("tông chủ và phó tông chủ chọn bộ truyền thụ; trưởng lão thì không", () => {
  const s = world();
  const a = forge(s, ["kim.can_don.bao", "kim.can_don.ben"]);
  const b = forge(s, ["loi.can_quet.linh", "quang.ho_the.ben"]);
  ok(set(s, "chu", [a]));
  ok(set(s, "pho", [a, b]));
  assert.deepEqual(s.sects.t.transmission, [a, b]);
  assert.equal(err(set(s, "lao", [a])), "khong_du_quyen");
  assert.equal(err(set(s, "chu", [a, a])), "cong_phap_trung");
  assert.equal(err(set(s, "chu", [a, 999])), "khong_co_cong_phap");
  assert.deepEqual(s.sects.t.transmission, [a, b]); // lệnh hỏng không đổi bộ
});

test("bộ truyền thụ không vượt số suất", () => {
  const s = world(1);
  const ids = Array.from({ length: 13 }, () => forge(s, ["kim.can_don.bao", "kim.can_don.ben"]));
  assert.equal(err(set(s, "chu", ids)), "vuot_so_suat");
  ok(set(s, "chu", ids.slice(0, 12)));
});

test("học công pháp: chỉ trong bộ truyền thụ, mỗi công pháp một lần, phẩm theo cấp nhân vật", () => {
  const s = world(50, 1);
  const pham = forge(s, ["kim.can_don.bao", "kim.can_don.ben"], 1);
  const hoang = forge(s, ["moc.can_don.bao", "moc.can_don.ben"], 2);
  assert.equal(err(learn(s, "de", pham)), "khong_trong_bo_truyen_thu");
  ok(set(s, "chu", [pham, hoang]));
  ok(learn(s, "de", pham));
  assert.equal(err(learn(s, "de", pham)), "da_hoc");
  assert.equal(err(learn(s, "de", hoang)), "chua_du_cap"); // cấp 1 chỉ học Phàm
  s.members.de.level = 50;
  ok(learn(s, "de", hoang));
  const l = s.members.de.learned[0];
  assert.equal(l.layer, 1);
  assert.equal(l.frozen, false);
  assert.equal(l.sectId, "t");
});

test("ngoại môn học tối đa 2 công pháp phẩm Phàm hoặc Hoàng", () => {
  const s = world(50);
  const ids = [1, 1, 1].map(() => forge(s, ["kim.can_don.bao", "kim.can_don.ben"], 1));
  const huyen = forge(s, ["thuy.tam_xa.bao", "thuy.tam_xa.ben"], 3);
  ok(set(s, "chu", [...ids, huyen]));
  assert.equal(err(learn(s, "ngoai", huyen)), "ngoai_mon_gioi_han");
  ok(learn(s, "ngoai", ids[0]));
  ok(learn(s, "ngoai", ids[1]));
  assert.equal(err(learn(s, "ngoai", ids[2])), "ngoai_mon_gioi_han");
  ok(learn(s, "lao", huyen)); // nội môn trở lên không bị giới hạn này
});

test("mang tối đa 4 công pháp đã học vào trận, theo thứ tự ưu tiên", () => {
  const s = world(50, 100);
  const ids = [
    forge(s, ["loi.can_quet.linh", "quang.ho_the.ben"]),
    forge(s, ["loi.tam_xa.linh", "am_lanh.tam_xa.ben"]),
    forge(s, ["kim.can_don.bao", "kim.can_don.ben"]),
    forge(s, ["moc.hoi_phuc.bao", "moc.hoi_phuc.ben"]),
    forge(s, ["tho.ho_the.bao", "tho.ho_the.ben"]),
  ];
  ok(set(s, "chu", ids));
  for (const id of ids.slice(0, 4)) ok(learn(s, "de", id));
  assert.equal(err(carry(s, "de", ids)), "vuot_so_cong_phap");
  assert.equal(err(carry(s, "de", [ids[4]])), "chua_hoc");
  assert.equal(err(carry(s, "de", [ids[0], ids[0]])), "cong_phap_trung");
  ok(carry(s, "de", [ids[1], ids[0]]));
  const techs = loadoutTechniques(s, "de");
  assert.deepEqual(techs.map((t) => t.damage), [95000, 110000]); // hai ví dụ GDD, đúng thứ tự đã chọn
});

test("bỏ công pháp khỏi bộ truyền thụ thì người đã học vẫn dùng được", () => {
  const s = world(50, 100);
  const a = forge(s, ["kim.can_don.bao", "kim.can_don.ben"]);
  ok(set(s, "chu", [a]));
  ok(learn(s, "de", a));
  ok(carry(s, "de", [a]));
  ok(set(s, "chu", []));
  assert.equal(loadoutTechniques(s, "de").length, 1);
  ok(carry(s, "de", [a]));
});

test("công pháp mang theo đưa thẳng vào trận đấu", () => {
  const s = world(50, 100);
  const ids = [forge(s, ["loi.can_quet.linh", "quang.ho_the.ben"]), forge(s, ["kim.can_don.bao", "kim.can_don.ben"])];
  ok(set(s, "chu", ids));
  for (const id of ids) ok(learn(s, "de", id));
  ok(carry(s, "de", ids));
  const unit = (id: number, row: 0 | 1): UnitSpec => ({ id, level: 100, element: "loi", row, ...baseStats(100), techniques: loadoutTechniques(s, "de") });
  const b = new Battle({ seed: 1, teamA: [unit(1, 0)], teamB: [unit(101, 0)] }, true);
  while (!b.finished) b.step();
  assert.ok(b.events.some((e) => e.unitId === 1));
  assert.notEqual(b.result().ticks, 0);
});

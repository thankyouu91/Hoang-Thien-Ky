import { test } from "node:test";
import assert from "node:assert/strict";
import { Battle, baseStats, mul, type UnitSpec, type Technique } from "@htk/sim";
import {
  apply, emptyState, addSect, addMember, loadoutTechniques,
  type GameState, type Role, type Result,
} from "../src/index.ts";

const NOW = 1_800_000_000_000;

/** Tông "t" (tông chủ, phó, trưởng lão, nội môn "de" đã học và mang một công pháp) và tông "k" (tông chủ "chu_k", nội môn "kh"). */
function world(): GameState {
  const s = emptyState();
  addSect(s, "t", 50);
  addSect(s, "k", 50);
  const people: [string, string, Role][] = [
    ["chu", "t", "tong_chu"], ["pho", "t", "pho_tong_chu"], ["lao", "t", "truong_lao"], ["de", "t", "noi_mon"],
    ["chu_k", "k", "tong_chu"], ["kh", "k", "noi_mon"],
  ];
  for (const [id, sect, role] of people) addMember(s, id, sect, role, 100);
  const id = forge(s, "t", ["kim.can_don.bao", "kim.can_don.ben"]);
  ok(apply(s, { type: "dat_bo_truyen_thu", actor: "chu", techniqueIds: [id] }, NOW));
  ok(apply(s, { type: "hoc_cong_phap", actor: "de", techniqueId: id }, NOW));
  ok(apply(s, { type: "mang_vao_tran", actor: "de", techniqueIds: [id] }, NOW));
  return s;
}
const ok = (r: Result) => {
  assert.equal(r.ok, true, r.ok ? "" : r.error);
  return r.ok ? r.events : [];
};
const err = (r: Result) => (r.ok ? "ok" : r.error);
/** Ghép một công pháp trong tông `sectId` bằng một trưởng lão tạm. */
function forge(s: GameState, sectId: string, kinds: string[]): number {
  const smith = `ren_${sectId}`;
  if (!s.members[smith]) addMember(s, smith, sectId, "truong_lao", 100);
  const uids = kinds.map((kind) => {
    const [e] = ok(apply(s, { type: "nhat_tan_quyen", actor: "system", memberId: smith, kind, grade: 1 }, NOW));
    const uid = e.type === "nhat_tan_quyen" ? e.scroll.uid : -1;
    ok(apply(s, { type: "nop_tan_quyen", actor: smith, scrollUid: uid }, NOW));
    return uid;
  });
  const [e] = ok(apply(s, { type: "ghep_cong_phap", actor: smith, main: uids[0], subs: uids.slice(1) }, NOW));
  return e.type === "ghep_cong_phap" ? e.technique.id : -1;
}
const release = (s: GameState, actor: string, memberId: string) => apply(s, { type: "cho_xuat_su", actor, memberId }, NOW);
const leave = (s: GameState, actor: string) => apply(s, { type: "roi_tong", actor }, NOW);

test("xuất sư hợp lệ: dừng tầng công pháp tông cũ, vẫn mang được, không bị giảm sát thương", () => {
  const s = world();
  const [e] = ok(release(s, "chu", "de"));
  assert.deepEqual(e, { type: "roi_tong", memberId: "de", sectId: "t", betrayed: false });
  const de = s.members.de;
  assert.equal(de.sectId, null);
  assert.equal(de.role, null);
  assert.equal(de.learned[0].frozen, true);
  assert.equal(de.learned[0].betrayed, false);
  assert.equal(loadoutTechniques(s, "de").length, 1);
  assert.equal(loadoutTechniques(s, "de")[0].forsakenSect, undefined);
});

test("chỉ tông chủ, phó tông chủ cho xuất sư được, và chỉ người cùng tông", () => {
  const s = world();
  assert.equal(err(release(s, "lao", "de")), "khong_du_quyen");
  assert.equal(err(release(s, "chu", "kh")), "khong_cung_tong");
  assert.equal(err(release(s, "chu", "chu")), "tong_chu_khong_roi_duoc");
  assert.equal(err(release(s, "ai_do", "de")), "khong_co_thanh_vien");
  ok(release(s, "pho", "de"));
  assert.equal(err(release(s, "de", "lao")), "chua_vao_tong"); // đã rời tông thì hết quyền
});

test("tự rời tông là phản bội: dừng tầng và đánh dấu công pháp của tông cũ", () => {
  const s = world();
  const before = JSON.stringify(s);
  assert.equal(err(leave(s, "chu")), "tong_chu_khong_roi_duoc");
  assert.equal(JSON.stringify(s), before);
  const [e] = ok(leave(s, "de"));
  assert.deepEqual(e, { type: "roi_tong", memberId: "de", sectId: "t", betrayed: true });
  assert.equal(s.members.de.learned[0].frozen, true);
  assert.equal(s.members.de.learned[0].betrayed, true);
  assert.equal(loadoutTechniques(s, "de")[0].forsakenSect, "t");
  assert.equal(err(leave(s, "de")), "chua_vao_tong");
});

test("phản bội tông sau chỉ đánh dấu công pháp của tông đó", () => {
  const s = world();
  ok(release(s, "chu", "de")); // rời "t" hợp lệ
  const de = s.members.de;
  de.sectId = "k"; // tạm thay lệnh gia nhập của Sprint 5
  de.role = "noi_mon";
  const id = forge(s, "k", ["moc.can_don.bao", "moc.can_don.ben"]);
  ok(apply(s, { type: "dat_bo_truyen_thu", actor: "chu_k", techniqueIds: [id] }, NOW));
  ok(apply(s, { type: "hoc_cong_phap", actor: "de", techniqueId: id }, NOW));
  ok(leave(s, "de"));
  const [fromT, fromK] = de.learned;
  assert.deepEqual([fromT.sectId, fromT.frozen, fromT.betrayed], ["t", true, false]);
  assert.deepEqual([fromK.sectId, fromK.frozen, fromK.betrayed], ["k", true, true]);
});

test("trong trận, kẻ phản bội đánh người tông cũ chỉ còn 50% sát thương", () => {
  const s = world();
  ok(leave(s, "de"));
  const techs = loadoutTechniques(s, "de");
  const firstLoss = (targetSect: string) => {
    const unit = (id: number, techniques: Technique[], extra: Partial<UnitSpec> = {}): UnitSpec =>
      ({ id, level: 100, element: "moc", row: 0, ...baseStats(100), techniques, ...extra });
    const b = new Battle({ seed: 1, teamA: [unit(1, techs)], teamB: [unit(101, techs, { manaMax: 0, sectId: targetSect })] }, true);
    while (!b.events.some((e) => e.unitId === 1)) b.step();
    const t = b.units.find((u) => u.id === 101)!;
    return t.hp - t.curHp;
  };
  const full = firstLoss("k");
  assert.ok(full > 0);
  assert.equal(firstLoss("t"), Math.max(1, mul(full, 500)));
});

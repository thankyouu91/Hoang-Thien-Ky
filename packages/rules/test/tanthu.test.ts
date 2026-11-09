import { test } from "node:test";
import assert from "node:assert/strict";
import {
  apply, emptyState, addSect, addMember, loadoutTechniques, techniqueName, TAN_THU_SECT,
  type GameState, type Result,
} from "../src/index.ts";

// Chương 0 của người mới (tab Nhiệm vụ): gia nhập tông NPC làm ngoại môn; nhiệm vụ 0.4 ghép công pháp tân thủ từ tàn quyển trong túi.

const NOW = 1_800_000_000_000;
const ok = (r: Result) => {
  assert.equal(r.ok, true, r.ok ? "" : r.error);
  return r.ok ? r.events : [];
};
const err = (r: Result) => (r.ok ? "ok" : r.error);

/** Người mới "moi" cấp 1 chưa có tông, túi có 2 tàn quyển phẩm 1; tông NPC "npc". */
function world(): { s: GameState; main: number; sub: number } {
  const s = emptyState();
  addSect(s, "npc", 1);
  addMember(s, "moi", null, null, 1);
  const pick = (kind: string, grade = 1) => {
    const [e] = ok(apply(s, { type: "nhat_tan_quyen", actor: "system", memberId: "moi", kind, grade }, NOW));
    return e.type === "nhat_tan_quyen" ? e.scroll.uid : -1;
  };
  return { s, main: pick("kim.can_don.bao"), sub: pick("loi.can_quet.linh") };
}

test("gia nhập tông: người chưa có tông vào làm ngoại môn; đã có tông hoặc tông không có thì báo lỗi", () => {
  const { s } = world();
  assert.equal(err(apply(s, { type: "gia_nhap_tong", actor: "moi", sectId: "khong_co" }, NOW)), "khong_co_tong");
  assert.equal(err(apply(s, { type: "gia_nhap_tong", actor: "ai_do", sectId: "npc" }, NOW)), "khong_co_thanh_vien");
  assert.deepEqual(ok(apply(s, { type: "gia_nhap_tong", actor: "moi", sectId: "npc" }, NOW)), [{ type: "gia_nhap_tong", memberId: "moi", sectId: "npc" }]);
  assert.deepEqual([s.members.moi.sectId, s.members.moi.role], ["npc", "ngoai_mon"]);
  assert.equal(err(apply(s, { type: "gia_nhap_tong", actor: "moi", sectId: "npc" }, NOW)), "da_co_tong");
  // Rời tông rồi gia nhập lại được.
  ok(apply(s, { type: "roi_tong", actor: "moi" }, NOW));
  ok(apply(s, { type: "gia_nhap_tong", actor: "moi", sectId: "npc" }, NOW));
});

test("ghép tân thủ: 2 tàn quyển trong túi thành công pháp học thẳng tầng 1, không cần tông; tàn quyển bị tiêu; một lần", () => {
  const { s, main, sub } = world();
  const [e] = ok(apply(s, { type: "ghep_tan_thu", actor: "moi", main, subs: [sub] }, NOW));
  const m = s.members.moi;
  assert.equal(e.type, "ghep_tan_thu");
  const t = e.type === "ghep_tan_thu" ? e.technique : null!;
  assert.deepEqual(m.learned, [t]);
  assert.deepEqual([t.sectId, t.layer, t.grade, t.frozen, t.name], [TAN_THU_SECT, 1, 1, false, techniqueName("kim.can_don.bao", ["loi.can_quet.linh"])]);
  assert.deepEqual(m.bag, []);
  assert.deepEqual(s.sects.npc.techniques, []);
  // Mang vào trận như công pháp đã học.
  ok(apply(s, { type: "mang_vao_tran", actor: "moi", techniqueIds: [t.techniqueId] }, NOW));
  assert.equal(loadoutTechniques(s, "moi")[0].type, "can_don");
  // Mỗi người một lần.
  const [e2] = ok(apply(s, { type: "nhat_tan_quyen", actor: "system", memberId: "moi", kind: "moc.can_don.bao", grade: 1 }, NOW));
  const [e3] = ok(apply(s, { type: "nhat_tan_quyen", actor: "system", memberId: "moi", kind: "hoa.can_don.bao", grade: 1 }, NOW));
  const u2 = e2.type === "nhat_tan_quyen" ? e2.scroll.uid : -1, u3 = e3.type === "nhat_tan_quyen" ? e3.scroll.uid : -1;
  assert.equal(err(apply(s, { type: "ghep_tan_thu", actor: "moi", main: u2, subs: [u3] }, NOW)), "da_ghep_tan_thu");
});

test("ghép tân thủ: lỗi số phụ quyển, trùng quyển, quyển không trong túi, phẩm quá cấp", () => {
  const { s, main, sub } = world();
  assert.equal(err(apply(s, { type: "ghep_tan_thu", actor: "moi", main, subs: [] }, NOW)), "sai_so_phu_quyen");
  assert.equal(err(apply(s, { type: "ghep_tan_thu", actor: "moi", main, subs: [sub, sub] }, NOW)), "sai_so_phu_quyen");
  assert.equal(err(apply(s, { type: "ghep_tan_thu", actor: "moi", main, subs: [main] }, NOW)), "tan_quyen_trung");
  assert.equal(err(apply(s, { type: "ghep_tan_thu", actor: "moi", main, subs: [9999] }, NOW)), "khong_co_tan_quyen");
  // Phẩm công pháp là phẩm thấp nhất của hai quyển; cả hai phẩm 5 thì người cấp 1 chưa học được.
  const high = ["thuy.can_don.bao", "hoa.can_don.bao"].map((kind) => {
    const [e] = ok(apply(s, { type: "nhat_tan_quyen", actor: "system", memberId: "moi", kind, grade: 5 }, NOW));
    return e.type === "nhat_tan_quyen" ? e.scroll.uid : -1;
  });
  assert.equal(err(apply(s, { type: "ghep_tan_thu", actor: "moi", main: high[0], subs: [high[1]] }, NOW)), "chua_du_cap");
  assert.equal(s.members.moi.bag.length, 4); // lệnh hỏng không đổi trạng thái
  assert.deepEqual(s.members.moi.learned, []);
});

test("công pháp tân thủ không đóng băng khi rời tông, không tính vào giới hạn học của ngoại môn; không tông nào dùng mã tân thủ", () => {
  const { s, main, sub } = world();
  ok(apply(s, { type: "gia_nhap_tong", actor: "moi", sectId: "npc" }, NOW));
  ok(apply(s, { type: "ghep_tan_thu", actor: "moi", main, subs: [sub] }, NOW));
  ok(apply(s, { type: "roi_tong", actor: "moi" }, NOW));
  assert.deepEqual([s.members.moi.learned[0].frozen, s.members.moi.learned[0].betrayed], [false, false]);
  assert.throws(() => addSect(s, TAN_THU_SECT, 1));
  assert.equal(err(apply(s, { type: "gia_nhap_tong", actor: "moi", sectId: TAN_THU_SECT }, NOW)), "khong_co_tong");
});

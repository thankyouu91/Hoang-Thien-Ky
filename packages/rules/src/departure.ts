// Rời tông môn: xuất sư hợp lệ hoặc phản bội (GDD mục 6).
// Cả hai đều dừng tầng mọi công pháp của tông cũ (vẫn dùng được); phản bội thêm giảm 50% sát thương lên người tông cũ.
import { RULES } from "./config.ts";
import type { GameState, Member } from "./state.ts";
import type { Result } from "./apply.ts";

/** Tông chủ hoặc phó tông chủ cho một thành viên xuất sư. */
export function releaseMember(state: GameState, actorId: string, memberId: string): Result {
  const actor = state.members[actorId];
  const member = state.members[memberId];
  if (!actor || !member) return { ok: false, error: "khong_co_thanh_vien" };
  if (!actor.sectId || !actor.role) return { ok: false, error: "chua_vao_tong" };
  if (RULES.releaseRoles.indexOf(actor.role) < 0) return { ok: false, error: "khong_du_quyen" };
  if (member.sectId !== actor.sectId) return { ok: false, error: "khong_cung_tong" };
  if (member.role === "tong_chu") return { ok: false, error: "tong_chu_khong_roi_duoc" };
  return depart(member, false);
}

/** Tự rời tông khi chưa được cho xuất sư là phản bội. */
export function leaveSect(state: GameState, memberId: string): Result {
  const member = state.members[memberId];
  if (!member) return { ok: false, error: "khong_co_thanh_vien" };
  if (!member.sectId) return { ok: false, error: "chua_vao_tong" };
  if (member.role === "tong_chu") return { ok: false, error: "tong_chu_khong_roi_duoc" };
  return depart(member, true);
}

function depart(member: Member, betrayed: boolean): Result {
  const sectId = member.sectId!;
  for (const l of member.learned) {
    if (l.sectId !== sectId) continue;
    l.frozen = true;
    if (betrayed) l.betrayed = true;
  }
  member.sectId = null;
  member.role = null;
  return { ok: true, events: [{ type: "roi_tong", memberId: member.id, sectId, betrayed }] };
}

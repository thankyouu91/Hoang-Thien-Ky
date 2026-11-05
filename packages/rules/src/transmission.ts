// Bộ công pháp truyền thụ, học công pháp và chọn công pháp mang vào trận (GDD mục 6 và 9).
import { maxGradeAtLevel, type Technique } from "@ktlp/sim";
import { RULES } from "./config.ts";
import { techniqueOf } from "./library.ts";
import { applyLayer } from "./layers.ts";
import type { GameState, LearnedTechnique } from "./state.ts";
import type { Result } from "./apply.ts";

/** Số suất của bộ truyền thụ theo cấp tông môn: 12, thêm 1 mỗi 25 cấp, tối đa 20. */
export function transmissionSlots(sectLevel: number): number {
  return Math.min(RULES.transmissionMax, RULES.transmissionBase + Math.floor(sectLevel / RULES.transmissionPerLevels));
}

/** Tông chủ hoặc phó tông chủ thay cả bộ truyền thụ. Công pháp đã học không bị ảnh hưởng. */
export function setTransmission(state: GameState, memberId: string, techniqueIds: number[]): Result {
  const member = state.members[memberId];
  if (!member) return { ok: false, error: "khong_co_thanh_vien" };
  if (!member.sectId || !member.role) return { ok: false, error: "chua_vao_tong" };
  if (RULES.transmissionRoles.indexOf(member.role) < 0) return { ok: false, error: "khong_du_quyen" };
  const sect = state.sects[member.sectId];
  if (techniqueIds.length > transmissionSlots(sect.level)) return { ok: false, error: "vuot_so_suat" };
  for (let i = 0; i < techniqueIds.length; i++) {
    if (techniqueIds.indexOf(techniqueIds[i]) !== i) return { ok: false, error: "cong_phap_trung" };
    if (!sect.techniques.some((t) => t.id === techniqueIds[i])) return { ok: false, error: "khong_co_cong_phap" };
  }
  sect.transmission = techniqueIds.slice();
  return { ok: true, events: [{ type: "dat_bo_truyen_thu", sectId: sect.id, techniqueIds: sect.transmission.slice() }] };
}

/**
 * Học một công pháp trong bộ truyền thụ của tông mình, bắt đầu ở tầng 1.
 * Phẩm học được theo cấp nhân vật; ngoại môn chỉ học tối đa 2 công pháp phẩm Phàm hoặc Hoàng.
 */
export function learnTechnique(state: GameState, memberId: string, techniqueId: number): Result {
  const member = state.members[memberId];
  if (!member) return { ok: false, error: "khong_co_thanh_vien" };
  if (!member.sectId || !member.role) return { ok: false, error: "chua_vao_tong" };
  const sect = state.sects[member.sectId];
  if (sect.transmission.indexOf(techniqueId) < 0) return { ok: false, error: "khong_trong_bo_truyen_thu" };
  if (findLearned(member.learned, techniqueId)) return { ok: false, error: "da_hoc" };
  const t = sect.techniques.filter((x) => x.id === techniqueId)[0];
  if (member.role === "ngoai_mon") {
    const fromSect = member.learned.filter((l) => l.sectId === sect.id).length;
    if (t.grade > RULES.outerMaxGrade || fromSect >= RULES.outerMaxLearned) return { ok: false, error: "ngoai_mon_gioi_han" };
  }
  if (t.grade > maxGradeAtLevel(member.level)) return { ok: false, error: "chua_du_cap" };
  const learned: LearnedTechnique = {
    techniqueId, sectId: sect.id, name: t.name,
    main: { kind: t.main.kind, grade: t.main.grade },
    subs: t.subs.map((s) => ({ kind: s.kind, grade: s.grade })),
    grade: t.grade, layer: 1, frozen: false, betrayed: false,
  };
  member.learned.push(learned);
  return { ok: true, events: [{ type: "hoc_cong_phap", memberId, techniqueId }] };
}

/** Chọn tối đa 4 công pháp đã học mang vào trận, theo thứ tự ưu tiên. */
export function setLoadout(state: GameState, memberId: string, techniqueIds: number[]): Result {
  const member = state.members[memberId];
  if (!member) return { ok: false, error: "khong_co_thanh_vien" };
  if (techniqueIds.length > RULES.loadoutSize) return { ok: false, error: "vuot_so_cong_phap" };
  for (let i = 0; i < techniqueIds.length; i++) {
    if (techniqueIds.indexOf(techniqueIds[i]) !== i) return { ok: false, error: "cong_phap_trung" };
    if (!findLearned(member.learned, techniqueIds[i])) return { ok: false, error: "chua_hoc" };
  }
  member.loadout = techniqueIds.slice();
  return { ok: true, events: [{ type: "mang_vao_tran", memberId, techniqueIds: member.loadout.slice() }] };
}

/**
 * Chỉ số trận của các công pháp đang mang, theo thứ tự ưu tiên; dùng làm `techniques` của đơn vị trong trận
 * (đơn vị cần thêm `sectId` của tông hiện tại), đã áp tầng (layers.ts). Công pháp của tông đã phản bội được đánh dấu để trận giảm
 * 50% lên người tông đó.
 */
export function loadoutTechniques(state: GameState, memberId: string): Technique[] {
  const member = state.members[memberId];
  return member.loadout.map((id) => {
    const l = findLearned(member.learned, id)!;
    const t = applyLayer(techniqueOf(l), l.layer);
    if (l.betrayed) t.forsakenSect = l.sectId;
    return t;
  });
}

function findLearned(list: LearnedTechnique[], techniqueId: number): LearnedTechnique | undefined {
  for (const l of list) if (l.techniqueId === techniqueId) return l;
  return undefined;
}

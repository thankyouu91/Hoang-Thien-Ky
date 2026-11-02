// Tàng Kinh Các: nhặt và nộp tàn quyển, ghép công pháp (GDD mục 6 và 9).
import { composeTechnique, type Element, type Technique } from "@ktlp/sim";
import { findScrollKind, scrollKind, toScroll, TYPE_SUFFIX } from "./catalog.ts";
import { RULES } from "./config.ts";
import type { GameState, OwnedScroll, SectTechnique } from "./state.ts";
import type { Result } from "./apply.ts";

/** Chữ đại diện cho hệ trong tên công pháp; Âm lãnh là "Âm" như ví dụ "Lôi Âm Châm Quyết" trong GDD. */
const ELEMENT_WORD: Record<Element, string> = {
  kim: "Kim", moc: "Mộc", thuy: "Thủy", hoa: "Hỏa", tho: "Thổ",
  loi: "Lôi", phong: "Phong", cuc_duong: "Dương", cuc_am: "U", cuc_han: "Hàn",
  quang: "Quang", am_lanh: "Âm",
};

/**
 * Tên tạm của công pháp: các hệ theo thứ tự chủ rồi phụ (bỏ trùng), hậu tố loại chiêu của chủ quyển, rồi "Quyết".
 * Chỉ một hệ thì thêm "Thuần". Ví dụ GDD: "Lôi Quang Liên Hoàn Quyết", "Lôi Âm Châm Quyết".
 */
export function techniqueName(mainKind: string, subKinds: string[]): string {
  const main = scrollKind(mainKind);
  const elements: Element[] = [main.element];
  for (const id of subKinds) {
    const e = scrollKind(id).element;
    if (elements.indexOf(e) < 0) elements.push(e);
  }
  const words = elements.map((e) => ELEMENT_WORD[e]).join(" ");
  return `${elements.length === 1 ? "Thuần " : ""}${words} ${TYPE_SUFFIX[main.type]} Quyết`;
}

/** Chỉ số trận của một công pháp đã ghép hoặc đã học. */
export function techniqueOf(t: Pick<SectTechnique, "main" | "subs">): Technique {
  return composeTechnique(toScroll(t.main.kind, t.main.grade), t.subs.map((s) => toScroll(s.kind, s.grade)));
}

/** Hệ thống trao một tàn quyển vào túi người chơi (rơi trong bí cảnh, thưởng nhiệm vụ). */
export function pickUpScroll(state: GameState, memberId: string, kind: string, grade: number): Result {
  const member = state.members[memberId];
  if (!member) return { ok: false, error: "khong_co_thanh_vien" };
  if (!findScrollKind(kind)) return { ok: false, error: "khong_co_tan_quyen" };
  if (grade !== Math.floor(grade) || grade < 1 || grade > RULES.contributionPerScroll.length) return { ok: false, error: "pham_khong_hop_le" };
  const scroll: OwnedScroll = { uid: state.nextId++, kind, grade };
  member.bag.push(scroll);
  return { ok: true, events: [{ type: "nhat_tan_quyen", memberId, scroll }] };
}

/** Nộp một tàn quyển từ túi vào Tàng Kinh Các của tông mình, đổi lấy cống hiến. */
export function depositScroll(state: GameState, memberId: string, uid: number): Result {
  const member = state.members[memberId];
  if (!member) return { ok: false, error: "khong_co_thanh_vien" };
  if (!member.sectId) return { ok: false, error: "chua_vao_tong" };
  const i = indexOfUid(member.bag, uid);
  if (i < 0) return { ok: false, error: "khong_co_tan_quyen" };
  const scroll = member.bag.splice(i, 1)[0];
  state.sects[member.sectId].library.push(scroll);
  const contribution = RULES.contributionPerScroll[scroll.grade - 1];
  member.contribution += contribution;
  return { ok: true, events: [{ type: "nop_tan_quyen", memberId, sectId: member.sectId, scroll, contribution }] };
}

/** Ghép 1 chủ quyển với 1–2 phụ quyển trong Tàng Kinh Các; trưởng lão trở lên mới được ghép. */
export function composeInLibrary(state: GameState, memberId: string, mainUid: number, subUids: number[], now: number): Result {
  const member = state.members[memberId];
  if (!member) return { ok: false, error: "khong_co_thanh_vien" };
  if (!member.sectId || !member.role) return { ok: false, error: "chua_vao_tong" };
  if (RULES.composeRoles.indexOf(member.role) < 0) return { ok: false, error: "khong_du_quyen" };
  const sect = state.sects[member.sectId];
  if (subUids.length < 1 || subUids.length > 2) return { ok: false, error: "sai_so_phu_quyen" };
  if (subUids.length === 2 && sect.level < RULES.secondSubLevel) return { ok: false, error: "can_cap_tong_100" };
  const uids = [mainUid, ...subUids];
  for (let i = 0; i < uids.length; i++) {
    if (uids.indexOf(uids[i]) !== i) return { ok: false, error: "tan_quyen_trung" };
    if (indexOfUid(sect.library, uids[i]) < 0) return { ok: false, error: "khong_co_tan_quyen" };
  }
  const scrolls = uids.map((uid) => sect.library[indexOfUid(sect.library, uid)]);
  const [main, ...subs] = scrolls;
  const technique: SectTechnique = {
    id: state.nextId++,
    name: techniqueName(main.kind, subs.map((s) => s.kind)),
    main: { kind: main.kind, grade: main.grade },
    subs: subs.map((s) => ({ kind: s.kind, grade: s.grade })),
    grade: Math.min(...scrolls.map((s) => s.grade)),
    createdBy: memberId,
    createdAt: now,
  };
  if (RULES.consumeScrollsOnCompose) sect.library = sect.library.filter((s) => uids.indexOf(s.uid) < 0);
  sect.techniques.push(technique);
  return { ok: true, events: [{ type: "ghep_cong_phap", sectId: sect.id, technique }] };
}

function indexOfUid(list: OwnedScroll[], uid: number): number {
  for (let i = 0; i < list.length; i++) if (list[i].uid === uid) return i;
  return -1;
}

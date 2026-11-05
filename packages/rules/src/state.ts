// Trạng thái luật game. Đối tượng thuần (không class, không Map/Set) để lưu được vào storage của Nakama và IndexedDB.

/** Chức vị trong tông môn (GDD mục 6). */
export type Role = "tong_chu" | "pho_tong_chu" | "truong_lao" | "noi_mon" | "ngoai_mon";

/** Một quyển cụ thể: loại trong danh mục + phẩm quay lúc rơi. */
export interface OwnedScroll {
  uid: number;
  kind: string; // mã trong SCROLL_KINDS, ví dụ "loi.can_quet.linh"
  grade: number;
}

/** Công thức một công pháp đã ghép; chỉ số trận tính lại bằng `techniqueOf` khi cần. */
export interface SectTechnique {
  id: number;
  name: string;
  main: { kind: string; grade: number };
  subs: { kind: string; grade: number }[];
  grade: number; // phẩm thấp nhất trong các quyển đem ghép
  createdBy: string;
  createdAt: number;
}

/**
 * Mã tông giả của công pháp tân thủ (nhiệm vụ 0.4 "Hai mảnh một quyển"): người chơi tự ghép từ tàn quyển trong túi, không thuộc
 * tông nào, nên không bị đóng băng khi rời tông và không tính vào giới hạn học của ngoại môn. Không tông thật nào được dùng mã này.
 */
export const TAN_THU_SECT = "tan_thu";

/** Công pháp một người đã học; giữ bản sao công thức nên vẫn dùng được sau khi rời tông. */
export interface LearnedTechnique {
  techniqueId: number;
  sectId: string; // tông đã truyền thụ; TAN_THU_SECT nếu là công pháp tân thủ tự ghép
  name: string;
  main: { kind: string; grade: number };
  subs: { kind: string; grade: number }[];
  grade: number;
  layer: number; // tầng 1–10, tăng bằng tu luyện và cống hiến (GDD mục 6)
  frozen: boolean; // dừng tầng khi rời tông, dù xuất sư hay phản bội
  betrayed: boolean; // rời tông khi chưa được cho xuất sư: đánh người tông cũ chỉ còn 50%
}

export interface Member {
  id: string;
  level: number; // cấp nhân vật
  sectId: string | null;
  role: Role | null;
  contribution: number; // cống hiến cá nhân
  bag: OwnedScroll[]; // tàn quyển nhặt được thuộc về người nhặt (GDD mục 6)
  learned: LearnedTechnique[];
  loadout: number[]; // techniqueId mang vào trận, tối đa 4, theo thứ tự ưu tiên
}

export interface Sect {
  id: string;
  level: number;
  library: OwnedScroll[]; // Tàng Kinh Các
  techniques: SectTechnique[];
  transmission: number[]; // bộ công pháp truyền thụ (techniqueId)
}

export interface GameState {
  nextId: number; // cấp uid cho tàn quyển và công pháp
  members: Record<string, Member>;
  sects: Record<string, Sect>;
}

export function emptyState(): GameState {
  return { nextId: 1, members: {}, sects: {} };
}

/** Tạm cho test và prototype; Sprint 5 thay bằng lệnh lập tông và gia nhập. */
export function addSect(state: GameState, id: string, level: number): Sect {
  if (id === TAN_THU_SECT) throw new Error(`Mã tông ${TAN_THU_SECT} dành cho công pháp tân thủ`);
  const sect: Sect = { id, level, library: [], techniques: [], transmission: [] };
  state.sects[id] = sect;
  return sect;
}

/** Tạm cho test và prototype; Sprint 5 thay bằng lệnh lập tông và gia nhập. */
export function addMember(state: GameState, id: string, sectId: string | null, role: Role | null, level = 1): Member {
  const member: Member = { id, level, sectId, role, contribution: 0, bag: [], learned: [], loadout: [] };
  state.members[id] = member;
  return member;
}

// Cửa vào duy nhất của luật game: mọi lệnh đi qua `apply(state, command, now)` (docs/KE_HOACH.md mục 2).
// Lệnh hỏng thì trả lỗi và không đổi trạng thái; lệnh hợp lệ sửa `state` tại chỗ và trả về các sự kiện.
// `now` là giờ server (ms) do bên gọi đưa vào; luật không tự đọc đồng hồ.
import type { GameState, LearnedTechnique, OwnedScroll, SectTechnique } from "./state.ts";
import { pickUpScroll, depositScroll, composeInLibrary, composeStarter } from "./library.ts";
import { setTransmission, learnTechnique, setLoadout } from "./transmission.ts";
import { joinSect, releaseMember, leaveSect } from "./departure.ts";

export type Command =
  /** Chỉ hệ thống gửi: tàn quyển rơi trong bí cảnh, thưởng nhiệm vụ. */
  | { type: "nhat_tan_quyen"; actor: "system"; memberId: string; kind: string; grade: number }
  | { type: "nop_tan_quyen"; actor: string; scrollUid: number }
  | { type: "ghep_cong_phap"; actor: string; main: number; subs: number[] }
  | { type: "dat_bo_truyen_thu"; actor: string; techniqueIds: number[] }
  | { type: "hoc_cong_phap"; actor: string; techniqueId: number }
  | { type: "mang_vao_tran"; actor: string; techniqueIds: number[] }
  | { type: "cho_xuat_su"; actor: string; memberId: string }
  | { type: "roi_tong"; actor: string }
  /** Người chưa có tông vào làm ngoại môn (GDD mục 6; bản chơi một mình: tông NPC nhận ngay, chưa xét đơn, lời mời, vị diện). */
  | { type: "gia_nhap_tong"; actor: string; sectId: string }
  /** Nhiệm vụ 0.4: ghép 1 chủ quyển với 1 phụ quyển trong túi thành công pháp tân thủ riêng; mỗi người một lần. */
  | { type: "ghep_tan_thu"; actor: string; main: number; subs: number[] };

export type RuleEvent =
  | { type: "nhat_tan_quyen"; memberId: string; scroll: OwnedScroll }
  | { type: "nop_tan_quyen"; memberId: string; sectId: string; scroll: OwnedScroll; contribution: number }
  | { type: "ghep_cong_phap"; sectId: string; technique: SectTechnique }
  | { type: "dat_bo_truyen_thu"; sectId: string; techniqueIds: number[] }
  | { type: "hoc_cong_phap"; memberId: string; techniqueId: number }
  | { type: "mang_vao_tran"; memberId: string; techniqueIds: number[] }
  | { type: "roi_tong"; memberId: string; sectId: string; betrayed: boolean }
  | { type: "gia_nhap_tong"; memberId: string; sectId: string }
  | { type: "ghep_tan_thu"; memberId: string; technique: LearnedTechnique };

export type RuleError =
  | "lenh_khong_hop_le"
  | "chi_he_thong"
  | "khong_co_thanh_vien"
  | "chua_vao_tong"
  | "khong_co_tan_quyen"
  | "pham_khong_hop_le"
  | "khong_du_quyen"
  | "sai_so_phu_quyen"
  | "can_cap_tong_100"
  | "tan_quyen_trung"
  | "vuot_so_suat"
  | "khong_co_cong_phap"
  | "cong_phap_trung"
  | "khong_trong_bo_truyen_thu"
  | "da_hoc"
  | "ngoai_mon_gioi_han"
  | "chua_du_cap"
  | "vuot_so_cong_phap"
  | "chua_hoc"
  | "khong_cung_tong"
  | "tong_chu_khong_roi_duoc"
  | "da_co_tong"
  | "khong_co_tong"
  | "da_ghep_tan_thu";

export type Result = { ok: true; events: RuleEvent[] } | { ok: false; error: RuleError };

export function apply(state: GameState, cmd: Command, now: number): Result {
  switch (cmd.type) {
    case "nhat_tan_quyen":
      if (cmd.actor !== "system") return { ok: false, error: "chi_he_thong" };
      return pickUpScroll(state, cmd.memberId, cmd.kind, cmd.grade);
    case "nop_tan_quyen":
      return depositScroll(state, cmd.actor, cmd.scrollUid);
    case "ghep_cong_phap":
      return composeInLibrary(state, cmd.actor, cmd.main, cmd.subs, now);
    case "dat_bo_truyen_thu":
      return setTransmission(state, cmd.actor, cmd.techniqueIds);
    case "hoc_cong_phap":
      return learnTechnique(state, cmd.actor, cmd.techniqueId);
    case "mang_vao_tran":
      return setLoadout(state, cmd.actor, cmd.techniqueIds);
    case "cho_xuat_su":
      return releaseMember(state, cmd.actor, cmd.memberId);
    case "roi_tong":
      return leaveSect(state, cmd.actor);
    case "gia_nhap_tong":
      return joinSect(state, cmd.actor, cmd.sectId);
    case "ghep_tan_thu":
      return composeStarter(state, cmd.actor, cmd.main, cmd.subs);
    default:
      return { ok: false, error: "lenh_khong_hop_le" };
  }
}

// Tham số luật tông môn. Số lấy từ GDD ghi kèm mục; số GDD chưa có ghi "đề xuất" kèm ngày duyệt.
import type { Role } from "./state.ts";

export const RULES = {
  /** Ghép xong thì các tàn quyển đem ghép bị tiêu hao (đề xuất, duyệt 2026-11-02). */
  consumeScrollsOnCompose: true,
  /** Cống hiến khi nộp một tàn quyển vào Tàng Kinh Các, theo phẩm 1–10: 10 × 2^(phẩm − 1) (đề xuất, duyệt 2026-11-02). */
  contributionPerScroll: [10, 20, 40, 80, 160, 320, 640, 1280, 2560, 5120],
  /** Từ cấp tông môn này được thêm phụ quyển thứ hai (GDD mục 9). */
  secondSubLevel: 100,
  /** Chức vị được ghép công pháp ở Tàng Kinh Các (GDD mục 6: trưởng lão trở lên). */
  composeRoles: ["tong_chu", "pho_tong_chu", "truong_lao"] as Role[],
  /** Chức vị được chọn bộ truyền thụ (GDD mục 6: tông chủ; phó tông chủ có quyền như tông chủ). */
  transmissionRoles: ["tong_chu", "pho_tong_chu"] as Role[],
  /** Chức vị được cho xuất sư (GDD mục 6: tông chủ; phó tông chủ có quyền như tông chủ). */
  releaseRoles: ["tong_chu", "pho_tong_chu"] as Role[],
  /** Bộ truyền thụ: 12 suất, thêm 1 suất mỗi 25 cấp tông môn, tối đa 20 (GDD mục 9). */
  transmissionBase: 12,
  transmissionPerLevels: 25,
  transmissionMax: 20,
  /** Mang tối đa 4 công pháp vào trận (GDD mục 6). */
  loadoutSize: 4,
  /** Ngoại môn đệ tử học tối đa 2 công pháp phẩm Phàm hoặc Hoàng (GDD mục 6). */
  outerMaxLearned: 2,
  outerMaxGrade: 2,
};

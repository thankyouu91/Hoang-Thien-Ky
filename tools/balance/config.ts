// Tham số công cụ cân bằng (Sprint 2). Đổi số ở đây rồi chạy lại `npm.cmd run balance`; cùng tham số thì ra cùng số.
// Ngưỡng hai tiêu chí lấy từ docs/KE_HOACH.md Sprint 2 (đề xuất, đã duyệt cùng kế hoạch); các số khác là đề xuất của công cụ.
// Đơn vị như packages/sim: tỷ lệ theo phần nghìn (1000 = 100%).

export const BALANCE = {
  seed: 20261102,
  /** Số cặp đội mỗi ô; mỗi cặp đánh hai lần đổi bên nên số trận mỗi ô gấp đôi. `--n <số>` và `--nhanh` ghi đè. */
  pairs: 200,
  quickPairs: 20,
  teamSize: 10,
  /** Cấp của mỗi cặp quay đều trong khoảng này; hai đội luôn cùng cấp, công pháp lấy phẩm cao nhất học được ở cấp đó. */
  levelMin: 1,
  levelMax: 250,
  /** Chỉ số mỗi vị trí lệch tới ±20% quanh chỉ số chuẩn (thay cho đồ); vị trí cùng thứ tự ở hai đội lệch như nhau. */
  statSpread: 200,
  /** Cấp tông của đội mẫu: bộ truyền thụ 14 suất, mỗi công pháp 1 phụ quyển (phụ quyển thứ hai cần cấp 100). */
  sectLevel: 50,
  /** Đội "theo loại chiêu": số công pháp loại đang xét trong bộ truyền thụ; mỗi người mang 1 cái ở ưu tiên 1. */
  typedTechniques: 4,
  /** Tiêu chí 1: đội đúng hệ khắc yếu hơn bao nhiêu (máu, công lực, phòng thủ cùng giảm). */
  weaker: 150,
  /** Tiêu chí 1: tỷ lệ thắng tối thiểu của đội khắc. */
  counterMin: 500,
  /** Tiêu chí 2: tỷ lệ thắng tối đa của một lựa chọn (hệ, loại chiêu, tổ hợp hệ chủ–phụ) trước đội ngẫu nhiên cùng sức. */
  choiceMax: 650,
  /** Hòa tính bao nhiêu phần trận thắng. */
  drawScore: 500,
  /** Ô cách ngưỡng tiêu chí dưới 1,5 lần sai số được đánh thêm số cặp gấp bấy nhiêu lần (seed khác) rồi gộp. */
  confirmFactor: 3,
};

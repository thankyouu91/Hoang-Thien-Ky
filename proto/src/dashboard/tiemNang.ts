// Điểm tiềm năng nhân vật (GDD mục 6, đề xuất 2026-11-09): mỗi cấp +1 điểm, 6 thuộc tính, mốc mềm từ điểm 121.
// Luật ở @ktlp/rules tiem_nang.ts (unspentPoints, attributeBonuses, lệnh cong_diem, tay_diem); file này chỉ giữ phần
// hiển thị: tên, tóm tắt, phí tẩy điểm và điểm hiệu quả cho dòng chữ, đọc thẳng data/he_thong/json/diem_tiem_nang.json
// (số của phiên số liệu, ô vàng). Không vẽ gì: mock/source.ts dựng TiemNangView, screens/tiemNangUi.ts vẽ.
import TN_JSON from "../../../data/he_thong/json/diem_tiem_nang.json" with { type: "json" };

export interface ThuocTinh {
  id: string;
  ten: string;
  tomTat: string;
  /** Khóa BuffStat của sim → phần nghìn mỗi điểm (hp, atk, def, manaMax theo ‰ chỉ số gốc, còn lại tuyệt đối). */
  moiDiem: Record<string, number>;
}

export const TN = TN_JSON as unknown as {
  diemMoiCap: number;
  mocGiam: number;
  giamConLai: number;
  tayDiem: { mienPhiDuoiCap: number; linhThach: number };
  thuocTinh: ThuocTinh[];
};

/** Điểm hiệu quả sau mốc mềm, cho dòng hiệu ứng trên màn (trận dùng rules.attributeBonuses, cùng công thức). */
export function diemHieuQua(d: number): number {
  return Math.min(d, TN.mocGiam) + (Math.max(0, d - TN.mocGiam) * TN.giamConLai) / 1000;
}

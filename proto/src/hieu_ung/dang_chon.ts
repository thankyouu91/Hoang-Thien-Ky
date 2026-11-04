// Dáng chiêu đặc trưng: hình riêng thay hình gốc của loại chiêu (người dùng đề xuất 2026-11-04: đao chém ngang, kiếm xoay
// rồi đâm, mưa kiếm, cự kiếm giáng, âm tà đầu lâu, sát thủ huyết tuyến…). File này chỉ chọn dáng, không vẽ (dang.ts vẽ).
//
// Trận thật chưa có dữ liệu dáng của từng công pháp, nên chọn theo luật dưới (đề xuất): tài năng, vũ khí, hệ của người ra
// chiêu. Khi tàn quyển có cột "Dáng chiêu" (Excel) và replay mang theo, dáng ghi sẵn được ưu tiên.
import type { ElementId, SkillId } from "../replay/types.ts";

export const DANG = [
  "dao_khi", "kiem_tran", "mua_kiem", "cu_kiem", "dau_lau", "huyet_tuyen", "thien_loi", "gai_troi", "loc_xoay", "tien_dong",
] as const;
export type Dang = (typeof DANG)[number];

export const DANG_NAME: Record<Dang, string> = {
  dao_khi: "Đao khí chém ngang",
  kiem_tran: "Kiếm trận xoay rồi đâm",
  mua_kiem: "Mưa kiếm",
  cu_kiem: "Cự kiếm giáng",
  dau_lau: "Đầu lâu (âm tà)",
  huyet_tuyen: "Huyết tuyến (sát thủ)",
  thien_loi: "Thiên lôi giáng",
  gai_troi: "Gai trồi (đá, băng)",
  loc_xoay: "Lốc xoáy",
  tien_dong: "Đồng tiền bay",
};

/** Loại chiêu mỗi dáng dùng được; ngoài danh sách thì vẽ hình gốc. */
export const DANG_FOR: Record<Dang, readonly SkillId[]> = {
  dao_khi: ["can_quet", "dien_rong", "can_don"],
  kiem_tran: ["tam_xa", "can_quet", "khong_che"],
  mua_kiem: ["dien_rong", "tran_phap"],
  cu_kiem: ["bua_chu", "can_don", "tran_phap"],
  dau_lau: ["tam_xa", "khong_che", "bua_chu", "dien_rong"],
  huyet_tuyen: ["can_don", "than_phap", "can_quet"],
  thien_loi: ["dien_rong", "bua_chu"],
  gai_troi: ["dien_rong", "khong_che"],
  loc_xoay: ["dien_rong", "khong_che"],
  tien_dong: ["tam_xa", "bua_chu"],
};

/** Người ra chiêu: vũ khí đang cầm (kiem, dao, truong…) và tài năng (tu_the, sat_thu…), nếu biết. */
export interface Persona {
  weapon?: string;
  talent?: string;
}

/**
 * Luật chọn dáng (đề xuất, đọc từ trên xuống, gặp luật khớp thì dừng):
 * 1. Sát thủ đánh cận chiến, thân pháp: huyết tuyến.
 * 2. Âm tà (hệ chủ Âm lãnh, Cực âm) đánh tầm xa, khống chế, bùa chú: đầu lâu.
 * 3. Diện rộng theo hệ: Lôi thiên lôi giáng; Thổ, Cực hàn gai trồi; Phong lốc xoáy (hệ rõ hơn vũ khí với chiêu vùng).
 * 4. Kim hệ hoặc cầm kiếm: diện rộng là mưa kiếm; bùa chú là cự kiếm; tầm xa, cận chiến quét là kiếm trận.
 * 5. Cầm đao, cận chiến quét hoặc diện rộng: đao khí chém ngang.
 * 6. Tu kim tiền đánh tầm xa: đồng tiền bay.
 */
export function autoDang(skill: SkillId, element: ElementId, p: Persona = {}): Dang | null {
  const kiem = p.weapon === "kiem" || element === "kim";
  if (p.talent === "sat_thu" && (skill === "can_don" || skill === "than_phap" || skill === "can_quet")) return "huyet_tuyen";
  if ((element === "am_lanh" || element === "cuc_am") && (skill === "tam_xa" || skill === "khong_che" || skill === "bua_chu")) return "dau_lau";
  if (skill === "dien_rong") {
    if (element === "loi") return "thien_loi";
    if (element === "tho" || element === "cuc_han") return "gai_troi";
    if (element === "phong") return "loc_xoay";
  }
  if (kiem && skill === "dien_rong") return "mua_kiem";
  if (kiem && skill === "bua_chu") return "cu_kiem";
  if (kiem && (skill === "tam_xa" || skill === "can_quet")) return "kiem_tran";
  if (p.weapon === "dao" && (skill === "can_quet" || skill === "dien_rong")) return "dao_khi";
  if (p.talent === "tu_kim_tien" && skill === "tam_xa") return "tien_dong";
  return null;
}

/** Dáng ép (trang xem thử, hay dữ liệu công pháp) chỉ dùng khi hợp loại chiêu. */
export function fits(d: Dang | null | undefined, skill: SkillId): d is Dang {
  return !!d && DANG_FOR[d].includes(skill);
}

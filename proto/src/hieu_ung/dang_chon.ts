// Dáng chiêu đặc trưng: hình riêng thay hình gốc của loại chiêu (người dùng đề xuất 2026-11-04: đao chém ngang, kiếm xoay
// rồi đâm, mưa kiếm, cự kiếm giáng, âm tà đầu lâu, sát thủ huyết tuyến…). File này chỉ chọn dáng, không vẽ (dang.ts vẽ).
//
// Trận thật chưa có dữ liệu dáng của từng công pháp, nên chọn theo luật dưới (đề xuất): tài năng, vũ khí, hệ của người ra
// chiêu. Khi tàn quyển có cột "Dáng chiêu" (Excel) và replay mang theo, dáng ghi sẵn được ưu tiên.
import type { ElementId, SkillId } from "../replay/types.ts";

export const DANG = [
  "dao_khi", "kiem_tran", "mua_kiem", "cu_kiem", "dau_lau", "huyet_tuyen", "thien_loi", "gai_troi", "loc_xoay", "tien_dong",
  // đợt theo hệ (2026-11-04)
  "hoa_long", "luu_tinh", "thuy_long", "song_than", "re_cay", "hoa_no", "phat_thu", "thanh_quang", "liet_nhat",
  "nguyet_thuc", "quy_thu", "bao_tuyet", "kim_cuong_xu",
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
  hoa_long: "Hỏa long cuộn tới",
  luu_tinh: "Thiên hỏa lưu tinh",
  thuy_long: "Thủy long quyển",
  song_than: "Sóng thần quét ngang",
  re_cay: "Rễ cây trói",
  hoa_no: "Hoa nở",
  phat_thu: "Phật thủ ấn",
  thanh_quang: "Thánh quang thập tự",
  liet_nhat: "Liệt nhật",
  nguyet_thuc: "Nguyệt thực",
  quy_thu: "Quỷ thủ",
  bao_tuyet: "Bão tuyết",
  kim_cuong_xu: "Kim cương xử",
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
  hoa_long: ["tam_xa", "bua_chu", "khong_che"],
  luu_tinh: ["dien_rong", "tran_phap", "bua_chu"],
  thuy_long: ["dien_rong", "khong_che"],
  song_than: ["can_quet", "dien_rong"],
  re_cay: ["khong_che", "dien_rong"],
  hoa_no: ["hoi_phuc", "ho_the"],
  phat_thu: ["bua_chu", "dien_rong", "can_don"],
  thanh_quang: ["hoi_phuc", "ho_the"],
  liet_nhat: ["dien_rong", "bua_chu", "tran_phap"],
  nguyet_thuc: ["dien_rong", "khong_che"],
  quy_thu: ["khong_che", "dien_rong"],
  bao_tuyet: ["dien_rong"],
  kim_cuong_xu: ["can_don", "bua_chu"],
};

/** Người ra chiêu: vũ khí đang cầm (kiem, dao, truong…) và tài năng (tu_the, sat_thu…), nếu biết. */
export interface Persona {
  weapon?: string;
  talent?: string;
}

/** Dáng theo hệ chủ cho từng loại chiêu (đợt theo hệ, đề xuất 2026-11-04). */
const BY_ELEMENT: Partial<Record<ElementId, Partial<Record<SkillId, Dang>>>> = {
  hoa: { tam_xa: "hoa_long", bua_chu: "hoa_long", dien_rong: "luu_tinh" },
  thuy: { dien_rong: "thuy_long", khong_che: "thuy_long", can_quet: "song_than" },
  moc: { khong_che: "re_cay", dien_rong: "re_cay", hoi_phuc: "hoa_no" },
  quang: { bua_chu: "phat_thu", dien_rong: "phat_thu", hoi_phuc: "thanh_quang", ho_the: "thanh_quang" },
  cuc_duong: { dien_rong: "liet_nhat", bua_chu: "liet_nhat" },
  cuc_am: { dien_rong: "nguyet_thuc" },
  am_lanh: { khong_che: "quy_thu", dien_rong: "quy_thu" },
  cuc_han: { dien_rong: "bao_tuyet", khong_che: "gai_troi" },
  tho: { dien_rong: "gai_troi" },
  loi: { dien_rong: "thien_loi" },
  phong: { dien_rong: "loc_xoay" },
  kim: { can_don: "kim_cuong_xu" },
};

/**
 * Luật chọn dáng (đề xuất, đọc từ trên xuống, gặp luật khớp thì dừng):
 * 1. Tài năng: sát thủ đánh cận chiến, thân pháp ra huyết tuyến; Tu kim tiền đánh tầm xa ra đồng tiền bay.
 * 2. Hệ chủ (bảng BY_ELEMENT): mỗi hệ một dáng cho chiêu vùng và vài loại chiêu hợp tính hệ.
 * 3. Âm tà còn lại (Âm lãnh, Cực âm) đánh tầm xa, khống chế, bùa chú: đầu lâu.
 * 4. Kim hệ hoặc cầm kiếm: diện rộng là mưa kiếm; bùa chú là cự kiếm; tầm xa, cận chiến quét là kiếm trận.
 * 5. Cầm đao, cận chiến quét hoặc diện rộng: đao khí chém ngang.
 */
export function autoDang(skill: SkillId, element: ElementId, p: Persona = {}): Dang | null {
  if (p.talent === "sat_thu" && (skill === "can_don" || skill === "than_phap" || skill === "can_quet")) return "huyet_tuyen";
  if (p.talent === "tu_kim_tien" && skill === "tam_xa") return "tien_dong";
  const byEl = BY_ELEMENT[element]?.[skill];
  if (byEl) return byEl;
  if ((element === "am_lanh" || element === "cuc_am") && (skill === "tam_xa" || skill === "khong_che" || skill === "bua_chu")) return "dau_lau";
  const kiem = p.weapon === "kiem" || element === "kim";
  if (kiem && skill === "dien_rong") return "mua_kiem";
  if (kiem && skill === "bua_chu") return "cu_kiem";
  if (kiem && (skill === "tam_xa" || skill === "can_quet")) return "kiem_tran";
  if (p.weapon === "dao" && (skill === "can_quet" || skill === "dien_rong")) return "dao_khi";
  return null;
}

/** Dáng ép (trang xem thử, hay dữ liệu công pháp) chỉ dùng khi hợp loại chiêu. */
export function fits(d: Dang | null | undefined, skill: SkillId): d is Dang {
  return !!d && DANG_FOR[d].includes(skill);
}

// Trang phục của hình lớn Pháp tướng (2026-11-05, người dùng: nhiều trang phục hơn, có giáp chiến, linh hoạt theo nghề và
// phong cách; lên cảnh giới cao thì đồ đổi khác). Búp bê mặc theo món áo đang mặc: 60 kiểu áo (trang_bi.json, ô "ao")
// gộp thành 13 dáng theo tên; chưa mặc áo thì mặc áo theo nghề (tài năng). Mỗi dáng có 3 bậc theo cảnh giới: 1 Luyện Khí
// (giản dị), 2 Trúc Cơ và Kết Đan (tinh xảo), 3 Nguyên Anh trở lên (lộng lẫy).
// Hình ở assets/pixellab/nhan_vat/<thân>/lon/<dáng>_<bậc>.png (vẽ bằng tools/hinh_lon). Thiếu hình thì lùi bậc, rồi lùi về
// áo theo nghề (<thân>/<áo>/lon.png), cuối cùng là hình ghép của trận.
import TRANG_BI from "../../../data/he_thong/json/trang_bi.json" with { type: "json" };

export const DANG = ["bo_y", "thu_sinh", "dao_bao", "vo_phuc", "da_hanh", "tang_y", "ao_long", "tien_y", "phap_y", "giap_da", "giap_phien", "giap_lan", "giap_tuong"] as const;
export type Dang = (typeof DANG)[number];

/** Luật gộp theo tên kiểu áo, xét theo thứ tự (luật cụ thể trước). */
const LUAT: [RegExp, Dang][] = [
  [/^Giáp (Da|Vải|Trúc)/, "giap_da"],
  [/^Giáp (Đồng Phiến|Liên Hoàn|Ngực Đồng|Huyền Thiết)/, "giap_phien"],
  [/^Giáp (Thiết Lân|Ngân Lân|Long Lân|Bích Lân|Quy Bối|Hổ Văn)/, "giap_lan"],
  [/^Giáp/, "giap_tuong"],
  [/Dạ Hành|Hắc Ưng/, "da_hanh"],
  [/Tăng Nhân/, "tang_y"],
  [/Choàng Lông/, "ao_long"],
  [/Võ Sinh/, "vo_phuc"],
  [/^Pháp Y|Tử Vân|Cửu Long|Xích Hoàng|Phần Thiên/, "phap_y"],
  [/Phi Yến|Lưu Ly|Thiên Tằm|Tiên Y|Mai Hoa|Thanh Liên|Nguyệt Hoa|Vạn Hoa|Phượng Vũ/, "tien_y"],
  [/^Đạo Bào|Lam Đơn|Hạc Văn|Tùng Hạc|Trúc Lâm|Lá Trúc/, "dao_bao"],
  [/^Sam |Thư Sinh|Thanh Sam|Mực Nhạt/, "thu_sinh"],
  [/.*/, "bo_y"],
];

const AO = (TRANG_BI.kieu as { ma_vp: string; o: string; ten: string }[]).filter((k) => k.o === "ao");

/** Dáng của từng kiểu áo theo mã (TB-AO-…). */
export const DANG_THEO_MA: Record<string, Dang> = Object.fromEntries(AO.map((k) => [k.ma_vp, LUAT.find(([re]) => re.test(k.ten))![1]]));

/** Bậc trang phục theo cấp: 1 Luyện Khí, 2 Trúc Cơ và Kết Đan (từ cấp 51), 3 Nguyên Anh trở lên (từ cấp 151). */
export const bacTrangPhuc = (level: number): 1 | 2 | 3 => (level >= 151 ? 3 : level >= 51 ? 2 : 1);

/**
 * Các khoá hình lớn để thử theo thứ tự (khoá trong assets/pixellab, không đuôi). `dang` là dáng của áo đang mặc, `outfit`
 * là áo theo nghề. Ví dụ nam khoẻ mặc Giáp Thiên Tướng ở Kết Đan: lon/giap_tuong_2, lon/giap_tuong_1, rồi áo theo nghề.
 */
export function hinhLonCands(body: string, outfit: string, dang: Dang | undefined, bac: 1 | 2 | 3): string[] {
  const out: string[] = [];
  for (const d of dang ? [dang, outfit] : [outfit]) for (let b = bac; b >= 1; b--) out.push(`nhan_vat/${body}/lon/${d}_${b}`);
  out.push(`nhan_vat/${body}/${outfit}/lon`);
  return out;
}

// Nội dung dựng file số liệu lần đầu: bảng chép từ GDD (rev 162) và các tên, số mới đặt (đánh dấu "đề xuất" trong file Excel).
// Số đã có trong packages/sim lấy thẳng từ code ở tao.ts, không chép lại ở đây.
import type { Element, SkillType, Variant } from "@ktlp/sim";
import type { Src } from "./bang.ts";

/** Thứ tự hệ như bảng GDD mục 3 và 9. */
export const ELEMENT_ORDER: Element[] = [
  "kim", "moc", "thuy", "hoa", "tho", "loi", "phong", "quang", "am_lanh", "cuc_duong", "cuc_am", "cuc_han",
];

export const HE_INFO: Record<Element, {
  short: string; // đề xuất: chữ dùng ghép tên công pháp, "Lôi Âm Châm Quyết" cho thấy Âm lãnh là "Âm"
  group: string;
  identity: string;
  effect: string;
  effectUnit: "%" | "giây" | "ô";
  buff: string;
}> = {
  kim: { short: "Kim", group: "Ngũ Hành", identity: "Xuyên giáp, đơn mục tiêu", effect: "Xuyên giáp", effectUnit: "%", buff: "Sát thương chí mạng" },
  moc: { short: "Mộc", group: "Ngũ Hành", identity: "Hồi phục, trói chân", effect: "Trói chân", effectUnit: "giây", buff: "Hồi máu nhận được" },
  thuy: { short: "Thủy", group: "Ngũ Hành", identity: "Làm chậm, tiết kiệm mana", effect: "Làm chậm", effectUnit: "%", buff: "Mana tối đa" },
  hoa: { short: "Hỏa", group: "Ngũ Hành", identity: "Diện rộng, thiêu đốt", effect: "Thiêu đốt mỗi giây (theo sát thương đòn đánh)", effectUnit: "%", buff: "Sát thương" },
  tho: { short: "Thổ", group: "Ngũ Hành", identity: "Phòng thủ, khiên", effect: "Khiên bản thân (theo máu tối đa)", effectUnit: "%", buff: "Máu tối đa" },
  loi: { short: "Lôi", group: "Biến dị", identity: "Chí mạng, tê liệt", effect: "Tê liệt khi chí mạng", effectUnit: "giây", buff: "Tốc độ đánh" },
  phong: { short: "Phong", group: "Biến dị", identity: "Tốc độ, đẩy lùi", effect: "Đẩy lùi", effectUnit: "ô", buff: "Giảm hồi chiêu" },
  quang: { short: "Quang", group: "Thiên địa dị hệ", identity: "Hồi máu, chói mắt", effect: "Hồi máu theo sát thương gây ra", effectUnit: "%", buff: "Hiệu quả hồi máu và khiên" },
  am_lanh: { short: "Âm", group: "Thiên địa dị hệ", identity: "Tầm xa, hút máu", effect: "Hút máu", effectUnit: "%", buff: "Hút máu" },
  cuc_duong: { short: "Dương", group: "Biến dị", identity: "Bùng nổ, xuyên kháng", effect: "Xuyên kháng", effectUnit: "%", buff: "Xuyên kháng" },
  cuc_am: { short: "U", group: "Biến dị", identity: "Nguyền rủa, sát thương theo thời gian", effect: "Giảm hồi máu của mục tiêu", effectUnit: "%", buff: "Sát thương theo thời gian" },
  cuc_han: { short: "Băng", group: "Biến dị", identity: "Đóng băng, khống chế", effect: "Đóng băng (tỷ lệ)", effectUnit: "%", buff: "Thời gian khống chế" },
};

/**
 * Tên tàn quyển (đề xuất) = tiền tố theo hệ và biến thể + hậu tố theo loại chiêu, nên 480 tên không trùng và nhìn tiền tố là biết biến thể.
 * Khớp cả 6 tên trong GDD: Lôi Đình Trảm, Tử Điện Liên Hoàn, Tử Điện Châm, Phá Hiểu Cố Bản, Âm Sát Xạ, U Lãnh Chỉ, Cửu Tiêu Cuồng Vũ.
 */
export const PREFIX: Record<Element, Record<Variant, string>> = {
  kim: { bao: "Canh Kim", toc: "Kiếm Ảnh", linh: "Phá Giáp", ben: "Kim Cương" },
  moc: { bao: "Cự Mộc", toc: "Phi Diệp", linh: "Triền Đằng", ben: "Trường Xuân" },
  thuy: { bao: "Nộ Đào", toc: "Lưu Thủy", linh: "Huyền Thủy", ben: "Trường Hà" },
  hoa: { bao: "Liệt Hỏa", toc: "Phi Diễm", linh: "Nghiệp Hỏa", ben: "Tam Muội" },
  tho: { bao: "Toái Nhạc", toc: "Lưu Sa", linh: "Hậu Thổ", ben: "Bàn Thạch" },
  loi: { bao: "Lôi Đình", toc: "Thiểm Điện", linh: "Tử Điện", ben: "Ngũ Lôi" },
  phong: { bao: "Liệt Phong", toc: "Truy Phong", linh: "Cửu Tiêu", ben: "Thanh Phong" },
  quang: { bao: "Diệu Nhật", toc: "Lưu Quang", linh: "Thần Hi", ben: "Phá Hiểu" },
  am_lanh: { bao: "Phệ Huyết", toc: "Quỷ Ảnh", linh: "U Lãnh", ben: "Âm Sát" },
  cuc_duong: { bao: "Kiêu Dương", toc: "Xích Hồng", linh: "Thuần Dương", ben: "Chí Dương" },
  cuc_am: { bao: "Cửu U", toc: "Câu Hồn", linh: "Thực Cốt", ben: "Huyền Âm" },
  cuc_han: { bao: "Huyền Băng", toc: "Phi Sương", linh: "Băng Phách", ben: "Hàn Ngọc" },
};
export const SUFFIX: Record<SkillType, string> = {
  can_don: "Trảm", can_quet: "Liên Hoàn", tam_xa: "Châm", dien_rong: "Cuồng Vũ", ho_the: "Cố Bản",
  bua_chu: "Phù", tran_phap: "Trận", hoi_phuc: "Hồi Xuân", khong_che: "Tỏa", than_phap: "Bộ",
};
/** Hậu tố riêng theo hệ, lấy từ tên ví dụ trong GDD (Âm Sát Xạ, U Lãnh Chỉ). */
export const SUFFIX_OVERRIDE: Partial<Record<Element, Partial<Record<SkillType, string>>>> = {
  am_lanh: { tam_xa: "Xạ", khong_che: "Chỉ" },
};

/**
 * Cặp tương hợp, cùng hệ số với tương sinh: chỉ Lôi + Quang (ví dụ GDD mục 9), như comboRelation ở technique.ts.
 * Bốn cặp kề nhau trên vòng vùng Hạ vị (Phong + Quang, Quang + Hỏa, Cực âm + Âm lãnh, Âm lãnh + Kim) từng được đề xuất,
 * người dùng chọn để Trung tính ngày 2026-11-02 vì hai cặp trùng vòng khắc một chiều trong trận và cân bằng đã đo không có chúng.
 */
export const HARMONY: [Element, Element][] = [["loi", "quang"]];

export const RELATIONS = [
  { id: "thuan", name: "Thuần", example: "Lôi + Lôi", rule: "Cùng hệ" },
  { id: "tuong_sinh", name: "Tương sinh", example: "Mộc + Hỏa", rule: "Ngũ Hành sinh nhau (biến dị tính như hệ gốc), hoặc hệ gốc với biến dị của nó" },
  { id: "tuong_hop", name: "Tương hợp", example: "Lôi + Quang", rule: "Lôi + Quang (ví dụ GDD mục 9)" },
  { id: "trung_tinh", name: "Trung tính", example: "Lôi + Âm lãnh", rule: "Các cặp còn lại" },
  { id: "tuong_khac", name: "Tương khắc", example: "Kim + Mộc", rule: "Ngũ Hành khắc nhau (biến dị tính như hệ gốc)" },
  { id: "doi_cuc", name: "Đối cực", example: "Cực dương + Cực âm", rule: "Cực dương + Cực âm, Quang + Âm lãnh" },
] as const;

export const SKILL_RULE_TEXT: Record<SkillType, string> = {
  can_don: "Mạnh nhất đơn mục tiêu, phải áp sát và chịu đòn",
  can_quet: "Nhiều mục tiêu gần, sát thương mỗi mục tiêu thấp hơn đòn đơn",
  tam_xa: "An toàn, +4% chí mạng, nhưng yếu hơn cận chiến",
  dien_rong: "Đánh rộng thì yếu; vận công 1 s, bị khống chế là mất chiêu",
  ho_the: "Khiên bằng 120% sát thương gốc, gần như không gây sát thương",
  bua_chu: "Rất mạnh nhưng chỉ 3 lần mỗi trận",
  tran_phap: "Bày 5 s; địch bước vào có 15% bị tuyệt sát (trừ boss và đối thủ cảnh giới cao hơn)",
  hoi_phuc: "Hệ số k là hệ số hồi máu; tốn mana gấp 3, hồi mana −20% khi đang vận",
  khong_che: "Choáng 1,5 s; khống chế liên tiếp cùng mục tiêu thì giảm một nửa",
  than_phap: "Lướt tới, đòn đầu +10% chí mạng; sau đó lộ vị trí 3 s",
};
export const VARIANT_TEXT: Record<Variant, string> = {
  bao: "+10% sát thương", toc: "−10% hồi chiêu, +2% chí mạng", linh: "Hiệu ứng đặc trưng +50%", ben: "−25% mana",
};

export const TALENT_TEXT: Record<string, [string, string, string, string]> = {
  tu_the: ["Tu thể", "+15% máu, +10% phòng thủ; cận chiến và hộ thể +10%", "Khai khoáng thủ công +10%", "Học Hộ thể cao hơn 1 phẩm"],
  tu_phap: ["Tu pháp", "+15% sát thương tầm xa và diện rộng, +10% mana", "—", "Bùa chú thêm 1 lần mỗi trận"],
  tu_tran: ["Tu trận", "Bày trận nhanh hơn 30%, tuyệt sát +5%", "Hộ Sơn Đại Trận +5% khi có Tu trận trấn giữ", "Chỉ Tu trận học Trận pháp từ Địa pháp, xây Truyền Tống Trận và hộ trận ở cứ điểm"],
  tu_dan: ["Tu đan", "Đan dược tự dùng +20%", "Luyện đan +1 bậc chất lượng, sản lượng +15%", "Luyện Tẩy Tủy Đan"],
  sat_thu: ["Sát thủ", "+10% chí mạng, +20% sát thương chí mạng, ẩn thân 3 s đầu trận", "—", "Thân pháp hồi chiêu −20%"],
  tu_ren: ["Tu rèn", "Pháp bảo tự rèn +10%", "Rèn +1 bậc chất lượng, tốn quặng −15%", "Rèn pháp bảo từ Thiên phẩm"],
  tu_duoc: ["Tu dược", "Hồi máu nhận +10%", "Mỏ dược +20%, nhận ra dược liệu hiếm", "Thu được dược liệu hiếm"],
  tu_kim_tien: ["Tu kim tiền", "Luck +10 (tăng tỷ lệ rơi phẩm cao)", "Khai khoáng +15%, lợi nhuận giao dịch +10%, thuế chợ −2%, +1 gian hàng", "Mở Thương hội"],
};

/** Phẩm: vị diện, cấp học được (GDD mục 6, đề xuất trong GDD), tỷ lệ rơi theo vị diện (GDD mục 11). */
export const GRADE_INFO: { plane: string; learn?: number; drop: Partial<Record<"ha" | "trung" | "than" | "thanh", number>> }[] = [
  { plane: "Hạ vị", learn: 1, drop: { ha: 0.60 } },
  { plane: "Hạ vị", learn: 50, drop: { ha: 0.28 } },
  { plane: "Hạ vị", learn: 100, drop: { ha: 0.10, trung: 0.40 } },
  { plane: "Hạ vị", learn: 150, drop: { ha: 0.02, trung: 0.35 } },
  { plane: "Trung vị", learn: 1, drop: { trung: 0.20, than: 0.35 } },
  { plane: "Trung vị", learn: 100, drop: { trung: 0.05, than: 0.35 } },
  { plane: "Thần vực", drop: { than: 0.20, thanh: 0.30 } },
  { plane: "Thần vực", drop: { than: 0.08, thanh: 0.35 } },
  { plane: "Thần vực", drop: { than: 0.02, thanh: 0.25 } },
  { plane: "Thánh vực", drop: { thanh: 0.10 } },
];

type Cellish = string | number | null | { v: string | number | null; src: Src };
const dx = (v: number): Cellish => ({ v, src: "de_xuat" });

/** Vị diện (GDD mục 3, 7, 12). Số mỏ thượng vị là đề xuất: số Hạ vị nhân tỷ lệ điểm mỗi vùng (350, 250, 150 trên 450). */
export const PLANES: Record<string, Cellish>[] = [
  { ma: "ha", ten: "Hạ vị diện", linh_khi: 1, so_vung: 12, diem_moi_vung: 450, bi_canh_moi_vung: 6, mo_linh_thach: 120, mo_quang: 80, mo_duoc: 80, linh_tuyen: 10, cap_mo_toi_da: 5, pham_linh_thach: "hạ phẩm", pham_cong_phap_toi_da: 4, cap_nhan_vat_toi_da: 250, canh_gioi: "Luyện Khí (1–50), Trúc Cơ (51–100), Kết Đan (101–150), Nguyên Anh (151–200), Hóa Thần (201–250)" },
  { ma: "trung", ten: "Trung vị diện", linh_khi: 4, so_vung: 9, diem_moi_vung: 350, bi_canh_moi_vung: 5, mo_linh_thach: dx(93), mo_quang: dx(62), mo_duoc: dx(62), linh_tuyen: dx(8), cap_mo_toi_da: 8, pham_linh_thach: "trung phẩm", pham_cong_phap_toi_da: 6, cap_nhan_vat_toi_da: 200, canh_gioi: "Luyện Hư (1–100), Hợp Thể (101–200); cấp đếm lại từ 1, giữ chỉ số" },
  { ma: "than", ten: "Thần vực", linh_khi: 8, so_vung: 5, diem_moi_vung: 250, bi_canh_moi_vung: 4, mo_linh_thach: dx(67), mo_quang: dx(44), mo_duoc: dx(44), linh_tuyen: dx(6), cap_mo_toi_da: 20, pham_linh_thach: "thượng phẩm", pham_cong_phap_toi_da: 9, cap_nhan_vat_toi_da: null, canh_gioi: "Đại Thừa, Độ Kiếp; không còn cấp, tu luyện chiêu thức" },
  { ma: "thanh", ten: "Thánh vực", linh_khi: 12, so_vung: 2, diem_moi_vung: 150, bi_canh_moi_vung: 3, mo_linh_thach: dx(40), mo_quang: dx(27), mo_duoc: dx(27), linh_tuyen: dx(3), cap_mo_toi_da: 100, pham_linh_thach: "cực phẩm", pham_cong_phap_toi_da: 10, cap_nhan_vat_toi_da: null, canh_gioi: "Chân Tiên; không còn cấp" },
];

/** Tàn quyển rơi ở 12 vùng Hạ vị (GDD mục 3): hệ chủ đạo trước, rồi 3 hệ phụ. */
export const HA_DROPS: Record<Element, Element[]> = {
  kim: ["kim", "loi", "tho", "cuc_duong"],
  moc: ["moc", "phong", "thuy", "quang"],
  thuy: ["thuy", "cuc_han", "kim", "am_lanh"],
  hoa: ["hoa", "cuc_duong", "moc", "loi"],
  tho: ["tho", "cuc_am", "hoa", "kim"],
  loi: ["loi", "phong", "quang", "am_lanh"],
  phong: ["phong", "moc", "loi", "cuc_han"],
  quang: ["quang", "cuc_duong", "hoa", "moc"],
  am_lanh: ["am_lanh", "cuc_am", "thuy", "tho"],
  cuc_duong: ["cuc_duong", "hoa", "quang", "kim"],
  cuc_am: ["cuc_am", "am_lanh", "tho", "cuc_han"],
  cuc_han: ["cuc_han", "thuy", "cuc_am", "phong"],
};

/**
 * Tên và hệ 16 vùng thượng vị (đề xuất), theo thứ tự "Trung vị 1…9", "Thần vực 1…5", "Thánh vực 1–2" trong data/maps/*_toa_do.json.
 * Hệ lấy theo hướng của tâm vùng so với vòng Hạ vị, nên càng vào trong vùng càng gom nhiều hệ; tàn quyển chia đều cho các hệ.
 */
export const UPPER_REGIONS: Record<"trung" | "than" | "thanh", [string, Element[]][]> = {
  trung: [
    ["Hàn Sương Lĩnh", ["cuc_han"]],
    ["Trường Thanh Cốc", ["moc"]],
    ["Lăng Vân Đỉnh", ["phong", "quang"]],
    ["Phần Thiên Cốc", ["hoa"]],
    ["Xích Sa Nguyên", ["cuc_duong", "tho"]],
    ["Vạn Hồn Uyên", ["cuc_am"]],
    ["Ám Nguyệt Hồ", ["am_lanh"]],
    ["Tàng Kiếm Sơn", ["kim"]],
    ["Kinh Lôi Trạch", ["loi", "thuy"]],
  ],
  than: [
    ["Huyền Minh Châu", ["cuc_han", "moc", "thuy"]],
    ["Thanh Tiêu Châu", ["phong", "quang"]],
    ["Đại Nhật Châu", ["hoa", "cuc_duong", "tho"]],
    ["Cửu Tuyền Châu", ["cuc_am", "am_lanh"]],
    ["Thiên Cương Châu", ["kim", "loi"]],
  ],
  thanh: [
    ["Thái Âm Thiên", ["cuc_am", "am_lanh", "kim", "loi", "thuy", "cuc_han"]],
    ["Thái Dương Thiên", ["moc", "phong", "quang", "hoa", "cuc_duong", "tho"]],
  ],
};

/** 20 loại bí cảnh (GDD mục 11). */
export const SECRET_REALMS: [string, number, string][] = [
  ["Linh Thạch Quật", 0.50, "Linh thạch"],
  ["Dược Cốc", 0.45, "Dược liệu, nguyên liệu đan"],
  ["Khoáng Mạch Động", 0.45, "Quặng rèn"],
  ["Thú Lâm", 0.40, "Đan thú, dị thú"],
  ["Cổ Chiến Trường", 0.35, "Trang bị linh cấp"],
  ["Tàng Kinh Động", 0.35, "Tàn quyển"],
  ["Ngọc Tủy Động", 0.30, "Ngọc khảm"],
  ["Linh Tuyền Động", 0.30, "Kinh nghiệm, tu vi"],
  ["Băng Phách Cung", 0.25, "Ngọc và đồ hệ Cực hàn, Thủy"],
  ["Lôi Trì", 0.25, "Nguyên liệu hệ Lôi, Kim"],
  ["Yêu Thú Sào Huyệt", 0.20, "Thú cưỡi hiếm"],
  ["Cổ Tông Di Tích", 0.20, "Pháp bảo"],
  ["Đan Tiên Động Phủ", 0.15, "Đan phương, mảnh lô đỉnh"],
  ["Luyện Khí Di Chỉ", 0.15, "Mảnh lò rèn, trang bị thiên cấp"],
  ["Huyết Sát Ma Quật", 0.12, "Công pháp luyện tà, đồ sát thủ"],
  ["Thiên Lôi Đài", 0.10, "Phù chống lôi kiếp, Thần đan"],
  ["Vạn Kiếm Trủng", 0.10, "Vũ khí thiên cấp"],
  ["Tiên Nhân Động Phủ", 0.07, "Thần vật"],
  ["Thượng Cổ Chiến Trường", 0.05, "Thần vật, mảnh pháp bảo trấn giáo"],
  ["Hỗn Độn Bí Cảnh", 0.04, "Mọi loại, tỷ lệ thần vật cao nhất"],
];

/** Mốc ở GDD mục 5: số điểm giữ tối đa (Hạ vị). Cấp giữa hai mốc nội suy tuyến tính, làm tròn xuống (đề xuất). */
export const POINT_MILESTONES: [number, number][] = [[1, 3], [10, 4], [30, 6], [50, 8], [100, 12], [150, 16], [200, 20]];
/** Mở khóa theo cấp tông môn (GDD mục 5, 10). */
export const UNLOCKS: [number, string, Src][] = [
  [1, "Lập tông, Chính Điện, vị trí ngẫu nhiên, Truyền Tống Trận cơ bản", "gdd"],
  [5, "Gia nhập liên minh", "gdd"],
  [10, "Tranh đoạt bí cảnh", "gdd"],
  [15, "Thương hội (cần Tu kim tiền)", "de_xuat"],
  [20, "Lập liên minh", "gdd"],
  [30, "Tuyên chiến địa bàn; hết được bảo trợ", "gdd"],
  [50, "Truyền Tống Trận lớn; làm được tông bảo trợ", "gdd"],
  [100, "Ghép công pháp 3 tàn quyển", "gdd"],
  [150, "Hộ Sơn Đại Trận cấp cao", "gdd"],
  [200, "Phi Thăng Đài, thăng vị diện", "gdd"],
];
/** Quy mô tông môn (GDD mục 6, đề xuất trong GDD): đến cấp, tên, phó tông chủ, trưởng lão, đường chủ. */
export const SCALES: [number, string, number, number, number][] = [
  [49, "Nhỏ", 1, 2, 1], [99, "Trung", 1, 4, 2], [149, "Vừa", 2, 5, 3], [200, "Lớn", 2, 6, 4],
];

/** Thú cưỡi (GDD mục 6). */
export const PET_GRADES: [string, string, number, string, number, string, number | null][] = [
  ["pham", "Phàm", 36, "Hạ vị", 0.008, "Được, nếu chưa lên Hóa Hình", 5],
  ["linh", "Linh", 24, "Hạ vị (hiếm), Trung vị", 0.012, "Được, nếu chưa lên Hóa Hình", 10],
  ["huyen", "Huyền", 24, "Trung vị, Thần vực; Yêu Thú Sào Huyệt ở Hạ vị", 0.016, "Không, khóa vào nhân vật", 20],
  ["thien", "Thiên", 12, "Thần vực, Thánh vực; Yêu Thú Sào Huyệt ở Trung vị", 0.020, "Không", 40],
  ["than", "Thần", 4, "Chỉ Thánh vực", 0.024, "Không", null],
];
export const PET_REALMS: Record<string, number | string | null>[] = [
  { so: 1, ten: "Khai Linh", tang_tu: 1, tang_den: 20, mo_cap: 1, toc_do: 1.2, cong_thanh: 400, dot_pha: null, pha_canh_don: null, cong_chi_so_pham: 0.002, cong_chi_so_than: 0.006 },
  { so: 2, ten: "Ngưng Đan", tang_tu: 21, tang_den: 40, mo_cap: 50, toc_do: 1.4, cong_thanh: 1000, dot_pha: 0.60, pha_canh_don: 3, cong_chi_so_pham: 0.004, cong_chi_so_than: 0.012 },
  { so: 3, ten: "Hóa Hình", tang_tu: 41, tang_den: 60, mo_cap: 100, toc_do: 1.6, cong_thanh: 2500, dot_pha: 0.40, pha_canh_don: 6, cong_chi_so_pham: 0.006, cong_chi_so_than: 0.018 },
  { so: 4, ten: "Thông Thiên", tang_tu: 61, tang_den: 80, mo_cap: 150, toc_do: 1.8, cong_thanh: 6000, dot_pha: 0.25, pha_canh_don: 8, cong_chi_so_pham: 0.008, cong_chi_so_than: 0.024 },
];
export const PET_SETS: [string, string, string, string][] = [
  ["dong_he", "Đồng hệ", "3 loài cùng hệ", "Công pháp hệ đó +3% sát thương"],
  ["thuan_he", "Thuần hệ", "Cả 5 loài cùng hệ", "Thay Đồng hệ: công pháp hệ đó +6% sát thương; nhận sát thương từ hệ khắc mình −5%"],
  ["goc_bien", "Gốc và biến", "1 hệ gốc + biến dị của nó (Kim + Lôi, Mộc + Phong, Thủy + Cực hàn, Hỏa + Cực dương, Thổ + Cực âm)", "Công pháp của hai hệ đó +2% sát thương"],
  ["doi_cuc", "Đối cực", "Cực dương + Cực âm, hoặc Quang + Âm lãnh", "Đòn đối cực ×1,5 thành ×1,55"],
  ["ngu_hanh", "Ngũ Hành tương sinh", "Đủ 5 hệ Kim, Mộc, Thủy, Hỏa, Thổ", "+2% máu, công, phòng; nhận sát thương từ hệ khắc mình −5%"],
  ["dong_dang", "Đồng dáng", "Cả 5 thú cùng dáng", "Tẩu thú: đoàn hộ tống +20% tốc độ. Phi cầm: xác suất gặp sự kiện mỗi chặng −10%. Thủy thú: qua bến đò không phải chờ"],
  ["tu_tuong", "Tứ Tượng", "Đủ Thanh Long, Bạch Hổ, Chu Tước, Huyền Vũ", "+3% máu, công, phòng; party cùng hành trình +1%"],
];
export const PET_PILLS: [string, string, string, string, string, string][] = [
  ["duong_linh", "Dưỡng Linh Đơn", "1–8, theo đại cảnh giới của thú", "Tăng tu vi thú", "Đan thú (Thú Lâm), dược liệu", "Bán được"],
  ["pha_canh", "Phá Cảnh Đơn", "3 vào Ngưng Đan, 6 vào Hóa Hình, 8 vào Thông Thiên", "Bắt buộc khi qua thú kiếp", "Đan thú phẩm cao, dược liệu hiếm", "Cấp 3 bán được; cấp 6 và 8 khóa vào nhân vật"],
  ["hoi_linh", "Hồi Linh Đơn", "1–5", "Chữa thú bị thương ngay", "Dược liệu", "Bán được"],
];

/** Tham số không có trong code: [nhóm, khóa, tên, giá trị như hiện trong Excel, kiểu, mục GDD, nguồn]. */
export const PARAMS_EXTRA: [string, string, string, number | string, string, string, Src][] = [
  ["kinh_te", "xpPerDay", "XP tông môn trung bình mỗi ngày", 2_500_000, "số", "5, 12", "gdd"],
  ["kinh_te", "xpCoef", "XP lên cấp kế = A × cấp^q: hệ số A", 1000, "số", "5", "de_xuat"],
  ["kinh_te", "xpExp", "XP lên cấp kế: số mũ q", 1.6, "số", "5", "de_xuat"],
  ["kinh_te", "xpPerStone", "XP mỗi linh thạch hiến tế", 50, "số", "12", "gdd"],
  ["kinh_te", "maxSectLevel", "Cấp tông môn tối đa mỗi vị diện", 200, "số", "5", "gdd"],
  ["kinh_te", "membersBase", "Thành viên = gốc + cấp × hệ số, làm tròn xuống: gốc", 10, "số", "5", "de_xuat"],
  ["kinh_te", "membersPerLevel", "Thành viên: thêm mỗi cấp", 0.25, "số", "5", "de_xuat"],
  ["kinh_te", "rangeLevelStep", "Tầm = 1 + cấp ÷ bước, làm tròn xuống: bước", 50, "số", "5", "de_xuat"],
  ["kinh_te", "rangeMax", "Tầm Truyền Tống Trận tối đa ở Hạ vị (chặng)", 5, "số", "3", "gdd"],
  ["kinh_te", "transmissionBase", "Bộ truyền thụ: số suất gốc", 12, "số", "9", "gdd"],
  ["kinh_te", "transmissionPerLevels", "Bộ truyền thụ: thêm 1 suất mỗi số cấp này", 25, "số", "9", "gdd"],
  ["kinh_te", "transmissionMax", "Bộ truyền thụ: tối đa", 20, "số", "9", "gdd"],
  ["kinh_te", "miniPortalLevels", "Tiểu Truyền Tống Trận tối đa = cấp ÷ số này", 10, "số", "10", "gdd"],
  ["kinh_te", "miniPortalCost", "Tiểu Truyền Tống Trận: chi phí dựng (linh thạch)", 2000, "số", "10", "gdd"],
  ["kinh_te", "miniPortalUpkeep", "Tiểu Truyền Tống Trận: duy trì mỗi ngày", 200, "số", "10", "gdd"],
  ["kinh_te", "npcLevelDiv", "NPC chiến tối đa = cấp ÷ a + thành viên ÷ b: a", 5, "số", "10", "gdd"],
  ["kinh_te", "npcMemberDiv", "NPC chiến tối đa: b", 2, "số", "10", "gdd"],
  ["kinh_te", "elderInviteBase", "Tỷ lệ mời trưởng lão cấp cao: gốc", 0.10, "%", "10", "gdd"],
  ["kinh_te", "elderInvitePerLevel", "Tỷ lệ mời trưởng lão: thêm mỗi cấp tông môn", 0.0025, "%", "10", "gdd"],
  ["kinh_te", "elderInviteMax", "Tỷ lệ mời trưởng lão: tối đa", 0.60, "%", "10", "gdd"],
  ["kinh_te", "allianceJoinLevel", "Cấp tông môn được gia nhập liên minh", 5, "số", "10", "gdd"],
  ["kinh_te", "allianceCreateLevel", "Cấp tông môn được lập liên minh", 20, "số", "10", "gdd"],
  ["kinh_te", "allianceMaxSects", "Số tông môn tối đa mỗi liên minh", 5, "số", "10", "gdd"],
  ["kinh_te", "warLevel", "Cấp tông môn được tuyên chiến", 30, "số", "10", "gdd"],
  ["kinh_te", "warLevelGap", "Tuyên chiến: chênh cấp tối đa", 30, "số", "10", "gdd"],
  ["kinh_te", "protecteeMaxLevel", "Bảo trợ: tông môn dưới cấp này được bảo trợ", 30, "số", "10", "gdd"],
  ["kinh_te", "protectorMinLevel", "Bảo trợ: tông bảo trợ từ cấp", 50, "số", "10", "gdd"],
  ["kinh_te", "tributeShare", "Bảo trợ: cống nạp theo sản lượng mỏ", 0.05, "%", "10", "gdd"],
  ["kinh_te", "tradeGuildLevel", "Thương hội mở ở cấp tông môn", 15, "số", "5", "de_xuat"],
  ["kinh_te", "npcMineShare", "Mỏ của NPC: phần mỏ linh thạch cấp 1 do NPC giữ lúc mở vùng", 0.10, "%", "5", "gdd"],
  ["kinh_te", "npcRetakePerDay", "Mỏ của NPC: Huyết Sát Môn đánh lại tối đa số mỏ cấp 1–2 mỗi ngày", 3, "số", "5", "gdd"],
  ["kinh_te", "npcRetakeIdleHours", "Mỏ của NPC: mỏ không ai trấn giữ quá số giờ này thì bị đánh lại", 24, "số", "5", "gdd"],
  ["kinh_te", "sectCreateLevel", "Cấp nhân vật để lập tông môn", 20, "số", "6", "gdd"],
  ["kinh_te", "sectCreateCost", "Linh thạch hạ phẩm để lập tông môn", 10_000, "số", "6", "gdd"],
  ["kinh_te", "mineCoef", "Sản lượng mỏ linh thạch mỗi giờ = a × cấp^b: a", 20, "số", "12", "gdd"],
  ["kinh_te", "mineExp", "Sản lượng mỏ: b", 1.15, "số", "12", "gdd"],
  ["kinh_te", "mineUpgradeCoef", "Nâng mỏ = c × cấp^d linh thạch: c", 500, "số", "12", "gdd"],
  ["kinh_te", "mineUpgradeExp", "Nâng mỏ: d", 1.8, "số", "12", "gdd"],
  ["kinh_te", "stoneRatio", "1 linh thạch phẩm trên đổi bao nhiêu phẩm dưới", 100, "số", "12", "gdd"],
  ["kinh_te", "ascendStoneKeep", "Thăng vị diện: giữ lại phần linh thạch", 0.10, "%", "7", "gdd"],
  ["kinh_te", "marketTax", "Thuế chợ", 0.05, "%", "12", "gdd"],
  ["kinh_te", "marketTaxTuKimTien", "Thuế chợ khi có Tu kim tiền", 0.03, "%", "12", "gdd"],
  ["kinh_te", "exchangeFee", "Sàn Linh Ngọc: phí mỗi lệnh", 0.05, "%", "12", "gdd"],
  ["kinh_te", "exchangeDailyMove", "Sàn Linh Ngọc: giá dao động tối đa mỗi ngày", 0.10, "%", "12", "gdd"],
  ["kinh_te", "exchangeWeeklyCap", "Sàn Linh Ngọc: đổi tối đa mỗi tuần theo linh thạch tự kiếm 7 ngày trước", 0.20, "%", "12", "gdd"],
  ["cong_phap", "gradeStep", "Mỗi phẩm mạnh hơn phẩm dưới (hệ số)", 1.25, "số", "9", "gdd"],
  ["cong_phap", "subShare", "Phụ quyển góp phần chỉ số", 0.5, "%", "9", "gdd"],
  ["cong_phap", "secondSubLevel", "Cấp tông môn được thêm phụ quyển thứ hai", 100, "số", "9", "gdd"],
  ["cong_phap", "loadoutSize", "Công pháp mang vào trận", 4, "số", "6", "gdd"],
  ["cong_phap", "techniqueLayers", "Số tầng mỗi công pháp", 10, "số", "6", "gdd"],
  ["cong_phap", "outerMaxLearned", "Ngoại môn: học tối đa số công pháp", 2, "số", "6", "gdd"],
  ["cong_phap", "outerMaxGrade", "Ngoại môn: phẩm cao nhất học được", 2, "số", "6", "gdd"],
  ["cong_phap", "outerDays", "Số ngày ở ngoại môn", 7, "số", "6", "gdd"],
  ["cong_phap", "diemLuyenMoiCap", "Điểm luyện công pháp cộng mỗi lần nhân vật lên cấp (quỹ chung, tiêu để lên tầng)", 20, "số", "6", "de_xuat"],
  ["roi_do", "mainElementShare", "Tàn quyển rơi thuộc hệ chủ đạo của vùng Hạ vị", 0.5, "%", "3, 11", "gdd"],
  ["roi_do", "luckTopGradesBonus", "Luck +10 của Tu kim tiền: cộng cho 2 phẩm cao nhất", 0.02, "%", "11", "gdd"],
  ["roi_do", "dropRateMin", "Tỷ lệ rơi gốc thấp nhất của bí cảnh", 0.04, "%", "11", "gdd"],
  ["roi_do", "dropRateMax", "Tỷ lệ rơi gốc cao nhất của bí cảnh", 0.50, "%", "11", "gdd"],
  ["roi_do", "godItemMin", "Khi rơi: thần vật thấp nhất", 0.03, "%", "11", "gdd"],
  ["roi_do", "godItemMax", "Khi rơi: thần vật cao nhất", 0.07, "%", "11", "gdd"],
  ["roi_do", "heavenItemMin", "Khi rơi: thiên cấp thấp nhất", 0.10, "%", "11", "gdd"],
  ["roi_do", "heavenItemMax", "Khi rơi: thiên cấp cao nhất", 0.15, "%", "11", "gdd"],
  ["roi_do", "spiritItemMin", "Khi rơi: linh cấp thấp nhất", 0.19, "%", "11", "gdd"],
  ["roi_do", "spiritItemMax", "Khi rơi: linh cấp cao nhất", 0.35, "%", "11", "gdd"],
  ["roi_do", "secretGearBonusMin", "Trang bị bí cảnh: thuộc tính cao hơn đồ ngoài, thấp nhất", 0.04, "%", "11", "gdd"],
  ["roi_do", "secretGearBonusMax", "Trang bị bí cảnh: thuộc tính cao hơn đồ ngoài, cao nhất", 0.08, "%", "11", "gdd"],
  ["roi_do", "outsiderTax", "Người ngoài vào bí cảnh nộp thuế tàn quyển", 0.10, "%", "11", "gdd"],
  ["roi_do", "opensPerDay", "Số lần bí cảnh mở mỗi ngày", 2, "số", "11", "gdd"],
  ["roi_do", "openMinutes", "Mỗi lần mở (phút)", 30, "số", "11", "gdd"],
  ["roi_do", "spiritLossPerRun", "Linh lực bí cảnh giảm mỗi lượt", 0.002, "%", "11", "gdd"],
  ["roi_do", "spiritRegenPerDay", "Linh lực bí cảnh tự hồi mỗi ngày", 0.05, "%", "11", "gdd"],
  ["roi_do", "spiritNurtureMax", "Nuôi dưỡng thêm tối đa mỗi ngày", 0.20, "%", "11", "gdd"],
  ["roi_do", "pityRuns", "Bảo hiểm: số lượt liên tiếp không ra từ thiên cấp", 50, "số", "12", "gdd"],
  ["roi_do", "regionAdjustMax", "Cân bằng rơi theo vùng: chỉnh tối đa mỗi chiều", 0.30, "%", "12", "gdd"],
  ["roi_do", "regionAdjustTrigger", "Cân bằng rơi theo vùng: lệch mục tiêu thì chỉnh", 0.10, "%", "12", "gdd"],
  ["thu_cuoi", "maxPets", "Số thú mỗi người", 5, "số", "6", "gdd"],
  ["thu_cuoi", "powerCap", "Trần lực chiến từ thú và kích phát", 0.15, "%", "6", "gdd"],
  ["thu_cuoi", "xpShare", "Tu vi thú nhận theo kinh nghiệm của chủ", 0.10, "%", "6", "gdd"],
  ["thu_cuoi", "dailyPillMax", "Dưỡng Linh Đơn tối đa mỗi thú mỗi ngày", 10, "số", "6", "gdd"],
  ["thu_cuoi", "guardianBonus", "Thú kiếp: mỗi người hộ pháp cộng", 0.03, "%", "6", "gdd"],
  ["thu_cuoi", "guardianMax", "Thú kiếp: số người hộ pháp tối đa", 5, "số", "6", "gdd"],
  ["thu_cuoi", "sameElementRealmBonus", "Thú kiếp trong bí cảnh cùng hệ cộng", 0.10, "%", "6", "gdd"],
  ["thu_cuoi", "breakthroughMax", "Thú kiếp: tổng tỷ lệ tối đa", 0.80, "%", "6", "gdd"],
  ["thu_cuoi", "breakthroughFailLoss", "Thú kiếp thất bại: mất tu vi đang tích", 0.20, "%", "6", "gdd"],
  ["thu_cuoi", "tameBase", "Thuần phục: tỷ lệ gốc", 0.20, "%", "6", "gdd"],
  ["thu_cuoi", "tamePerLevel", "Thuần phục: mỗi cấp chủ cao hơn dị thú", 0.01, "%", "6", "gdd"],
  ["thu_cuoi", "tameMax", "Thuần phục: tối đa", 0.50, "%", "6", "gdd"],
  ["thu_cuoi", "refineReturn", "Luyện hóa thú: nhận lại phần Dưỡng Linh Đơn đã nuôi", 0.50, "%", "6", "gdd"],
  ["thu_cuoi", "refineTuDanBonus", "Luyện hóa thú: Tu đan được thêm", 0.15, "%", "6", "gdd"],
  ["thu_cuoi", "eggHatchHours", "Trứng thú ấp (giờ)", 24, "số", "6", "gdd"],
  ["thu_cuoi", "injuredHours", "Thú cưỡi bị thương đi chậm (giờ)", 2, "số", "6", "gdd"],
  ["thu_cuoi", "siegeMinutesPerNight", "Mỗi thú phá trận tối đa mỗi tối chiến tranh (phút)", 30, "số", "6", "gdd"],
  ["thu_cuoi", "flyerSpeedBonus", "Phi cầm nhanh thêm", 0.10, "%", "6", "gdd"],
  ["thu_cuoi", "waterSpeedMul", "Thủy thú qua sông, bến đò (hệ số)", 2, "hệ số", "6", "gdd"],
  ["thu_cuoi", "escortSpeed", "Hộ tống đỉnh vô chủ: tốc độ thường", 0.50, "%", "6, 12", "gdd"],
  ["thu_cuoi", "escortSpeedBeasts", "Hộ tống có 5 tẩu thú từ Hóa Hình", 0.75, "%", "6", "gdd"],
  // Thú: tăng trưởng, bổ trợ, phát triển (GDD tab cùng tên, 2026-11-05; đề xuất)
  ["thu_cuoi", "supportPets", "Thú hộ chủ: số con ra thú kỹ trong trận", 1, "số", "", "de_xuat"],
  ["thu_cuoi", "supportFirstTicks", "Thú kỹ: lần đầu ra ở giây", 5, "giây", "", "de_xuat"],
  ["thu_cuoi", "supportCooldownTicks", "Thú kỹ: hồi", 10, "giây", "", "de_xuat"],
  ["thu_cuoi", "supportPowerTarget", "Thú kỹ cấp 4: mục tiêu lực chiến tối đa (đo bằng tools/balance)", 0.02, "%", "", "de_xuat"],
  ["thu_cuoi", "fourSymbolsExtraTargets", "Tứ Tượng: thú kỹ thêm số đồng đội gần chủ nhất", 1, "số", "", "de_xuat"],
  ["thu_cuoi", "pillTuVi", "Dưỡng Linh Đơn đúng cấp: tu vi mỗi viên", 100, "số", "", "de_xuat"],
  ["thu_cuoi", "pillLowerRealmShare", "Dưỡng Linh Đơn thấp hơn đại cảnh giới của thú: còn", 0.5, "%", "", "de_xuat"],
  ["thu_cuoi", "ownerTuViPerDay", "Mục tiêu cân bằng: tu vi thú nhận từ kinh nghiệm chủ mỗi ngày ở Hạ vị", 200, "số", "", "de_xuat"],
  ["thu_cuoi", "growthDaysTarget", "Mục tiêu: số ngày nuôi đều để thú 3 sao vào Thông Thiên ở Hạ vị", 90, "số", "6", "de_xuat"],
  ["thu_cuoi", "aptitudeRerollPerDay", "Tẩy Tủy Đơn: mỗi thú tối đa số viên mỗi ngày", 1, "số", "", "de_xuat"],
  ["thu_cuoi", "aptitudeRerollPillLevel", "Tẩy Tủy Đơn: cấp linh đơn", 5, "số", "", "de_xuat"],
  ["thu_cuoi", "nestMinAptitude", "Thú nở từ trứng Yêu Thú Sào Huyệt: tư chất tối thiểu (sao)", 3, "số", "", "de_xuat"],
  ["thu_cuoi", "fourSymbolsAptitude", "Tứ Tượng: tư chất (sao)", 5, "số", "", "de_xuat"],
  ["thu_cuoi", "talentStatSameMax", "Thiên phú chỉ số cùng tên: tính tối đa số thú", 2, "số", "", "de_xuat"],
  ["thu_cuoi", "talentTier2Realm", "Thiên phú bậc 2: từ đại cảnh giới", 3, "số", "", "de_xuat"],
  ["thu_cuoi", "bloodlineRealm", "Huyết mạch thức tỉnh: khi vào đại cảnh giới", 3, "số", "", "de_xuat"],
  ["thu_cuoi", "bloodlineSwapPillLevel", "Đổi huyết mạch: tốn 1 Phá Cảnh Đơn cấp", 6, "số", "", "de_xuat"],
];

/** Mô tả tham số lấy từ code: [khóa, tên, kiểu, mục GDD (trống = chỉ có trong code), nguồn]. */
export const CODE_PARAMS: Record<"SKILL_RULES" | "CAST_FLOOR" | "BATTLE" | "UNIT_CURVE" | "TALENT_RULES" | "ARTIFACT_RULES", [string, string, string, string, Src][]> = {
  /** Sàn sau mọi phần giảm (Tu trận, set, Ý châu); đề xuất của phiên set đồ 2026-11-03, sim c72b41f. */
  CAST_FLOOR: [
    ["formationTicks", "Trận pháp: bày trận ngắn nhất sau mọi phần giảm (Tu trận, set, Ý châu)", "giây", "", "de_xuat"],
    ["channelTicks", "Diện rộng: vận công ngắn nhất sau mọi phần giảm", "giây", "", "de_xuat"],
  ],
  SKILL_RULES: [
    ["aoeCastTicks", "Diện rộng: thời gian vận công", "giây", "8", "gdd"],
    ["shieldOfBase", "Hộ thể: khiên theo sát thương gốc", "hệ số", "8", "gdd"],
    ["shieldTicks", "Hộ thể: khiên tồn tại", "giây", "", "code"],
    ["shieldHitRange", "Hộ thể: đánh ×0,2 vào địch gần nhất trong tầm", "ô", "", "code"],
    ["talismanUses", "Bùa chú: số lần mỗi trận", "số", "8", "gdd"],
    ["formationCastTicks", "Trận pháp: thời gian bày", "giây", "8", "gdd"],
    ["formationInterruptible", "Trận pháp: bị khống chế cắt ngang", "có/không", "", "code"],
    ["executeChance", "Trận pháp: tỷ lệ tuyệt sát", "%", "8", "gdd"],
    ["realmLevels", "Số cấp mỗi đại cảnh giới ở Hạ vị", "số", "7", "gdd"],
    ["healerRegenPenalty", "Hồi phục: giảm hồi mana khi mang", "%", "8", "gdd"],
    ["stunTicks", "Khống chế: thời gian choáng", "giây", "8", "gdd"],
    ["controlDrWindow", "Khống chế: bị khống chế lại trong khoảng này thì còn một nửa", "giây", "", "code"],
    ["dashCritBonus", "Thân pháp: chí mạng đòn đầu", "%", "8", "gdd"],
    ["dashStandOff", "Thân pháp: đứng cách mục tiêu sau khi lướt", "ô", "", "code"],
    ["exposedTicks", "Thân pháp: lộ vị trí", "giây", "8", "gdd"],
    ["selfShieldCooldownTicks", "Thổ: khiên bản thân tối đa một lần mỗi khoảng này", "giây", "", "code"],
    ["meleeKnockback", "Phong: chiêu cận chiến cũng đẩy lùi", "có/không", "", "code"],
    // Hợp trận (người dùng đổi luật trận pháp 2026-11-04): nhiều người cùng bày trận pháp gần nhau thì nhập một trận
    ["formationJoinRange", "Hợp trận: tâm trận cách nhau trong khoảng này thì nhập một trận", "ô", "", "de_xuat"],
    ["formationBond2", "Hợp trận 2 người: hệ số", "hệ số", "8", "gdd"],
    ["formationBond3", "Hợp trận 3 người: hệ số", "hệ số", "8", "gdd"],
    ["formationBond5", "Hợp trận 5 người: hệ số", "hệ số", "8", "gdd"],
    // Hợp trận lần 2 (người dùng duyệt 2026-11-04)
    ["formationJoinWait", "Hợp trận: bày xong muộn hơn người sớm nhất của trận quá khoảng này thì bày trận riêng", "giây", "", "de_xuat"],
    ["formationExtraTargets", "Hợp trận: mỗi người thêm, trận chung đánh thêm số mục tiêu", "số", "", "de_xuat"],
    ["formationMaxTargets", "Hợp trận: số mục tiêu tối đa của trận chung", "số", "", "de_xuat"],
  ],
  BATTLE: [
    ["fieldLength", "Chiều dài sân", "ô", "", "code"],
    ["frontPos", "Hàng trước của đội A", "ô", "", "code"],
    ["backPos", "Hàng sau của đội A", "ô", "", "code"],
    ["moveSpeed", "Tốc độ đi", "ô/giây", "", "code"],
    ["supportStandoff", "Người chỉ có chiêu hỗ trợ đứng cách địch", "ô", "", "code"],
    ["manaMax", "Mana tối đa", "số", "", "code"],
    ["manaRegenPerSec", "Hồi mana mỗi giây", "số", "", "code"],
    ["initialCooldown", "Đầu trận công pháp đã hồi sẵn", "%", "", "code"],
    ["ultMultiplier", "Chiêu cuối tông chủ", "hệ số", "", "code"],
    ["betrayalDamage", "Công pháp tông cũ đánh người tông đó", "%", "6", "gdd"],
    ["rampStartTicks", "Chống hòa: bắt đầu sau", "giây", "", "code"],
    ["rampStepTicks", "Chống hòa: mỗi nấc", "giây", "", "code"],
    ["rampPerStep", "Chống hòa: sát thương thêm mỗi nấc", "%", "", "code"],
    ["critDamage", "Sát thương chí mạng", "hệ số", "", "code"],
    ["defScale", "Phòng thủ giảm def ÷ (def + hằng số này)", "số", "", "code"],
    ["defCap", "Phòng thủ giảm tối đa", "%", "", "code"],
  ],
  UNIT_CURVE: [
    ["hpBase", "Máu ở cấp 0", "số", "", "code"],
    ["hpPerLevel", "Máu tăng mỗi cấp (theo máu cấp 0)", "%", "", "code"],
    ["atkBase", "Công ở cấp 0", "số", "", "code"],
    ["atkPerLevel", "Công tăng mỗi cấp", "số", "", "code"],
    ["defPerLevel", "Phòng thủ tăng mỗi cấp", "số", "", "code"],
  ],
  TALENT_RULES: [
    ["tuTheHp", "Tu thể: máu", "%", "6", "gdd"],
    ["tuTheDef", "Tu thể: phòng thủ", "%", "6", "gdd"],
    ["tuTheMelee", "Tu thể: cận chiến và hộ thể", "%", "6", "gdd"],
    ["tuPhapRanged", "Tu pháp: sát thương tầm xa và diện rộng", "%", "6", "gdd"],
    ["tuPhapMana", "Tu pháp: mana", "%", "6", "gdd"],
    ["tuPhapTalismans", "Tu pháp: bùa chú thêm mỗi trận", "số", "6", "gdd"],
    ["tuTranCastCut", "Tu trận: bày trận nhanh hơn", "%", "6", "gdd"],
    ["tuTranExecute", "Tu trận: tuyệt sát thêm", "%", "6", "gdd"],
    ["satThuCrit", "Sát thủ: chí mạng", "%", "6", "gdd"],
    ["satThuCritDamage", "Sát thủ: sát thương chí mạng", "%", "6", "gdd"],
    ["satThuStealthTicks", "Sát thủ: ẩn thân đầu trận", "giây", "6", "gdd"],
    ["satThuDashCooldownCut", "Sát thủ: thân pháp hồi chiêu giảm", "%", "6", "gdd"],
    ["tuDuocHealTaken", "Tu dược: hồi máu nhận", "%", "6", "gdd"],
  ],
  /** Điều kiện kích hoạt pháp bảo (GDD tab Trang bị; sim f656195). Hai tầm "kề bên", "trong tầm" là đề xuất. */
  ARTIFACT_RULES: [
    ["adjacentRange", "Pháp bảo: \"kề bên\", \"đứng sát\" là trong khoảng này", "ô", "", "de_xuat"],
    ["nearRange", "Pháp bảo Hồ lô: \"trong tầm\" là trong khoảng này", "ô", "", "de_xuat"],
    ["luanMinEnemies", "Luân: số kẻ địch cận chiến đứng sát tối thiểu", "số", "", "gdd"],
    ["chauHits", "Châu: số đòn tầm xa kế tiếp", "số", "", "gdd"],
    ["thapAllies", "Tháp: số đồng đội gần nhất được che", "số", "", "gdd"],
    ["dinhHealOfMax", "Đỉnh: kích hoạt khi lượng hồi từ phần này của máu tối đa", "%", "", "gdd"],
    ["chuongMinControlled", "Chuông: số đồng đội đang bị khống chế tối thiểu", "số", "", "gdd"],
    ["anDashDamage", "Ấn: đòn lướt của địch còn lại", "%", "", "gdd"],
  ],
};

// Khung của file số liệu: từng sheet, từng cột, kiểu số và khóa JSON. tao.ts dùng để dựng file Excel, xuat.ts dùng để đọc lại.
// Cột tìm theo chữ ở dòng tiêu đề, nên đổi thứ tự cột trong Excel vẫn đọc được; đổi chữ tiêu đề thì phải sửa ở đây.
//
// Kiểu cột và cách đổi sang JSON (đơn vị như packages/sim: phần nghìn, tick 20/giây, milli-ô):
//   text, list (cách nhau bằng dấu phẩy), bool ("có" / "không"), int, num: giữ nguyên
//   pct (Excel lưu 0,1 hiện 10%), mul (hệ số 1,5): × 1000      sec (giây): × 20      cell (ô): × 1000
//   qty: đơn vị lấy từ cột `unitCol` của cùng dòng ("%", "giây", "ô")
//   unit: chữ đơn vị trong Excel ("%", "giây", "số ô") → mã đơn vị trong JSON ("phan_nghin", "tick", "o")
//   kv: object viết "khóa: giá trị; khóa: giá trị", giá trị giữ đơn vị code; [a, b] là mảng, true/false là đúng sai
import type { Fill } from "./xlsx.ts";

export type Kind = "text" | "list" | "bool" | "int" | "num" | "pct" | "mul" | "sec" | "cell" | "qty" | "unit" | "kv";
/** Nguồn của số: GDD, code đang chạy, đề xuất mới trong file này, công thức. */
export type Src = "gdd" | "code" | "de_xuat" | "cong_thuc";

export interface Col {
  key: string;
  header: string;
  kind: Kind;
  src: Src;
  width?: number;
  /** Khóa trong JSON, có thể lồng bằng dấu chấm ("stats.dmg") và chỉ số mảng ("a[0]"); false = không xuất. Mặc định bằng `key`. */
  json?: string | false;
  unitCol?: string;
  optional?: boolean; // ô trống được phép (JSON bỏ khóa)
  nullable?: boolean; // ô trống thành null trong JSON
  /** Ô ghi tên (một hoặc nhiều, cách nhau dấu phẩy) của dòng trong sheet khác; JSON đổi sang mã của dòng đó. */
  ref?: "he" | "thu_pham";
}
export interface TableDef {
  kind: "table";
  sheet: string;
  file?: string; // tên file JSON trong data/he_thong/json; không có thì bảng là một phần của file ghép (trang_bi.ts)
  id: string; // khóa cột định danh
  shape: "map" | "list"; // JSON là object theo định danh hay mảng theo thứ tự dòng
  cols: Col[];
}
export interface MatrixDef {
  kind: "matrix";
  sheet: string;
  file: string;
  corner: string; // chữ ở ô A1
  cell: "mul" | "relation";
}
export interface ParamsDef {
  kind: "params";
  sheet: string;
  file: string;
}
export type SheetDef = TableDef | MatrixDef | ParamsDef;

export const SRC_FILL: Record<Src, Fill> = { gdd: "gdd", code: "code", de_xuat: "de_xuat", cong_thuc: "cong_thuc" };

const c = (key: string, header: string, kind: Kind, src: Src, more: Partial<Col> = {}): Col => ({ key, header, kind, src, ...more });

export const PARAMS: ParamsDef = { kind: "params", sheet: "Tham số", file: "tham_so.json" };
/** Cột của sheet Tham số. Giá trị đổi sang JSON theo cột Kiểu: "số", "%", "hệ số", "giây", "ô", "ô/giây", "có/không". */
export const PARAM_COLS = ["Nhóm", "Khóa", "Tên", "Giá trị", "Kiểu", "Mục GDD", "Nguồn"] as const;

export const HE: TableDef = {
  kind: "table", sheet: "Hệ", file: "he.json", id: "ma", shape: "map", cols: [
    c("ma", "Mã", "text", "code", { json: "id", width: 10 }),
    c("ten", "Tên", "text", "gdd", { json: "name", width: 11 }),
    c("chu", "Chữ trong tên công pháp", "text", "de_xuat", { json: "short", width: 12 }),
    c("nhom", "Nhóm", "text", "gdd", { json: "group", width: 15 }),
    c("he_goc", "Hệ gốc", "text", "gdd", { json: "parent", optional: true, width: 8 }),
    c("ban_sac", "Bản sắc", "text", "gdd", { json: "identity", width: 30 }),
    c("hieu_ung", "Hiệu ứng đặc trưng", "text", "gdd", { json: "effect.desc", width: 30 }),
    c("hieu_ung_gia_tri", "Giá trị hiệu ứng", "qty", "gdd", { json: "effect.value", unitCol: "hieu_ung_don_vi", width: 9 }),
    c("hieu_ung_don_vi", "Đơn vị", "text", "gdd", { json: false, width: 7 }),
    c("hieu_ung_thoi_gian", "Thời gian hiệu ứng (giây)", "sec", "gdd", { json: "effect.ticks", optional: true, width: 10 }),
    c("sat_thuong", "Chỉ số kèm: sát thương", "pct", "gdd", { json: "stats.dmg", width: 10 }),
    c("chi_mang", "Chỉ số kèm: chí mạng", "pct", "gdd", { json: "stats.crit", width: 10 }),
    c("hoi_chieu", "Chỉ số kèm: hồi chiêu", "pct", "gdd", { json: "stats.cd", width: 10 }),
    c("mana", "Chỉ số kèm: mana", "pct", "gdd", { json: "stats.mana", width: 10 }),
    c("tam", "Chỉ số kèm: tầm (ô)", "cell", "gdd", { json: "stats.range", width: 10 }),
    c("buff", "Buff khi luyện đúng hệ", "text", "gdd", { json: "rootBuff.desc", width: 26 }),
    c("buff_chi_so", "Mã chỉ số buff", "text", "code", { json: "rootBuff.stat", width: 12 }),
    c("buff_gia_tri", "Giá trị buff", "pct", "gdd", { json: "rootBuff.value", width: 9 }),
  ],
};

export const KHAC_CHE: MatrixDef = { kind: "matrix", sheet: "Khắc chế", file: "khac_che.json", corner: "Hệ đánh \\ hệ bị đánh", cell: "mul" };

export const QUAN_HE: TableDef = {
  kind: "table", sheet: "Quan hệ tổ hợp", file: "quan_he_to_hop.json", id: "ma", shape: "map", cols: [
    c("ma", "Mã", "text", "code", { json: "id", width: 12 }),
    c("ten", "Tên", "text", "gdd", { json: "name", width: 12 }),
    c("he_so", "Hệ số tổ hợp t", "mul", "gdd", { json: "t", width: 10 }),
    c("mana", "Nhân mana", "mul", "gdd", { json: "manaMul", width: 10 }),
    c("vi_du", "Ví dụ trong GDD", "text", "gdd", { json: false, width: 22 }),
    c("quy_tac", "Cặp nào thuộc quan hệ này", "text", "de_xuat", { json: "rule", width: 70 }),
  ],
};

export const TO_HOP: MatrixDef = { kind: "matrix", sheet: "Tổ hợp", file: "to_hop.json", corner: "Hệ chủ \\ hệ phụ", cell: "relation" };

export const LOAI_CHIEU: TableDef = {
  kind: "table", sheet: "Loại chiêu", file: "loai_chieu.json", id: "ma", shape: "map", cols: [
    c("ma", "Mã", "text", "code", { json: "id", width: 11 }),
    c("ten", "Tên", "text", "gdd", { json: "name", width: 15 }),
    c("k", "Hệ số sát thương k", "mul", "gdd", { width: 10 }),
    c("muc_tieu", "Số mục tiêu", "int", "gdd", { json: "targets", width: 9 }),
    c("hoi_chieu", "Hồi chiêu (giây)", "sec", "gdd", { json: "cooldownTicks", width: 9 }),
    c("chi_mang", "Chí mạng cộng thêm", "pct", "gdd", { json: "critPerMille", width: 10 }),
    c("mana", "Mana", "int", "code", { width: 7 }),
    c("tam", "Tầm (ô)", "cell", "code", { json: "range", width: 7 }),
    c("ban_kinh", "Bán kính vùng (ô)", "cell", "code", { json: "radius", width: 9 }),
    c("dong_minh", "Nhắm đồng minh", "bool", "code", { json: "ally", width: 9 }),
    c("hau_to", "Hậu tố tên tàn quyển", "text", "de_xuat", { json: "suffix", width: 12 }),
    c("luat", "Luật đánh đổi", "text", "gdd", { json: "rule", width: 60 }),
  ],
};

export const BIEN_THE: TableDef = {
  kind: "table", sheet: "Biến thể", file: "bien_the.json", id: "ma", shape: "map", cols: [
    c("ma", "Mã", "text", "code", { json: "id", width: 7 }),
    c("ten", "Tên", "text", "gdd", { json: "name", width: 7 }),
    c("sat_thuong", "Sát thương", "pct", "gdd", { json: "dmg", width: 10 }),
    c("hoi_chieu", "Hồi chiêu", "pct", "gdd", { json: "cd", width: 10 }),
    c("chi_mang", "Chí mạng", "pct", "gdd", { json: "crit", width: 10 }),
    c("mana", "Mana", "pct", "gdd", { json: "mana", width: 10 }),
    c("suc_hieu_ung", "Sức hiệu ứng đặc trưng", "mul", "gdd", { json: "effectPower", width: 11 }),
    c("mo_ta", "Mô tả", "text", "gdd", { json: false, width: 32 }),
  ],
};

export const PHAM: TableDef = {
  kind: "table", sheet: "Phẩm", file: "pham.json", id: "so", shape: "list", cols: [
    c("so", "Phẩm", "int", "gdd", { json: "grade", width: 7 }),
    c("ten", "Tên", "text", "gdd", { json: "name", width: 8 }),
    c("ten_cong_phap", "Tên công pháp", "text", "gdd", { json: "techniqueName", width: 12 }),
    c("vi_dien", "Vị diện", "text", "gdd", { json: "plane", width: 9 }),
    c("he_so", "Hệ số sát thương", "mul", "cong_thuc", { json: "power", width: 10 }),
    c("cap_hoc", "Cấp học được ở vị diện đó", "int", "gdd", { json: "learnLevel", optional: true, width: 11 }),
    c("roi_ha", "Rơi ở Hạ vị", "pct", "gdd", { json: "drop.ha", optional: true, width: 9 }),
    c("roi_trung", "Rơi ở Trung vị", "pct", "gdd", { json: "drop.trung", optional: true, width: 9 }),
    c("roi_than", "Rơi ở Thần vực", "pct", "gdd", { json: "drop.than", optional: true, width: 9 }),
    c("roi_thanh", "Rơi ở Thánh vực", "pct", "gdd", { json: "drop.thanh", optional: true, width: 9 }),
    c("cong_hien", "Cống hiến khi nộp 1 tàn quyển", "int", "code", { json: "contribution", width: 12 }),
  ],
};

export const TAI_NANG: TableDef = {
  kind: "table", sheet: "Tài năng", file: "tai_nang.json", id: "ma", shape: "map", cols: [
    c("ma", "Mã", "text", "code", { json: "id", width: 12 }),
    c("ten", "Tên", "text", "gdd", { json: "name", width: 12 }),
    c("ty_le", "Tỷ lệ có", "pct", "gdd", { json: "chance", width: 8 }),
    c("chien_dau", "Chiến đấu", "text", "gdd", { json: "combat", width: 45 }),
    c("kinh_te", "Kinh tế", "text", "gdd", { json: "economy", width: 45 }),
    c("dac_quyen", "Đặc quyền", "text", "gdd", { json: "privilege", width: 45 }),
  ],
};

export const TAN_QUYEN: TableDef = {
  kind: "table", sheet: "Tàn quyển", file: "tan_quyen.json", id: "ma", shape: "list", cols: [
    c("ma", "Mã (hệ.loại.biến thể)", "text", "code", { json: "id", width: 24 }),
    c("ten", "Tên", "text", "de_xuat", { json: "name", width: 22 }),
    c("he", "Hệ", "text", "cong_thuc", { json: false, width: 10 }),
    c("loai", "Loại chiêu", "text", "cong_thuc", { json: false, width: 15 }),
    c("bien_the", "Biến thể", "text", "cong_thuc", { json: false, width: 8 }),
    c("sat_thuong", "Sát thương", "pct", "cong_thuc", { json: false, width: 9 }),
    c("chi_mang", "Chí mạng", "pct", "cong_thuc", { json: false, width: 9 }),
    c("hoi_chieu", "Hồi chiêu", "pct", "cong_thuc", { json: false, width: 9 }),
    c("mana", "Mana", "pct", "cong_thuc", { json: false, width: 9 }),
    c("tam", "Tầm (ô)", "cell", "cong_thuc", { json: false, width: 7 }),
    c("suc_hieu_ung", "Sức hiệu ứng", "mul", "cong_thuc", { json: false, width: 9 }),
  ],
};

export const CONG_PHAP: TableDef = {
  kind: "table", sheet: "Công pháp mẫu", file: "cong_phap_mau.json", id: "stt", shape: "list", cols: [
    c("stt", "STT", "int", "de_xuat", { json: "no", width: 5 }),
    c("ten", "Tên", "text", "de_xuat", { json: "name", width: 28 }),
    c("nhom", "Nhóm", "text", "de_xuat", { json: "group", width: 16 }),
    c("chu_quyen", "Chủ quyển", "text", "de_xuat", { json: "main", width: 22 }),
    c("phu_quyen_1", "Phụ quyển 1", "text", "de_xuat", { json: "sub1", width: 22 }),
    c("phu_quyen_2", "Phụ quyển 2", "text", "de_xuat", { json: "sub2", optional: true, width: 22 }),
    c("pham", "Phẩm", "int", "de_xuat", { json: "grade", width: 6 }),
    c("loai", "Loại chiêu", "text", "cong_thuc", { json: false, width: 14 }),
    c("he_chu", "Hệ chủ", "text", "cong_thuc", { json: false, width: 9 }),
    c("he_phu_1", "Hệ phụ 1", "text", "cong_thuc", { json: false, width: 9 }),
    c("he_phu_2", "Hệ phụ 2", "text", "cong_thuc", { json: false, width: 9 }),
    c("quan_he_1", "Quan hệ 1", "text", "cong_thuc", { json: false, width: 10 }),
    c("quan_he_2", "Quan hệ 2", "text", "cong_thuc", { json: false, width: 10 }),
    c("t", "Hệ số tổ hợp t", "mul", "cong_thuc", { json: false, width: 9 }),
    c("sat_thuong", "Sát thương", "num", "cong_thuc", { json: false, width: 9 }),
    c("muc_tieu", "Mục tiêu", "int", "cong_thuc", { json: false, width: 8 }),
    c("chi_mang", "Chí mạng", "pct", "cong_thuc", { json: false, width: 8 }),
    c("hoi_chieu", "Hồi chiêu (giây)", "num", "cong_thuc", { json: false, width: 9 }),
    c("mana", "Mana", "num", "cong_thuc", { json: false, width: 8 }),
  ],
};

export const VI_DIEN: TableDef = {
  kind: "table", sheet: "Vị diện", file: "vi_dien.json", id: "ma", shape: "map", cols: [
    c("ma", "Mã", "text", "code", { json: "id", width: 7 }),
    c("ten", "Tên", "text", "gdd", { json: "name", width: 12 }),
    c("linh_khi", "Linh khí", "mul", "gdd", { json: "qi", width: 8 }),
    c("so_vung", "Số vùng", "int", "gdd", { json: "regions", width: 7 }),
    c("diem_moi_vung", "Điểm cố định mỗi vùng (trung bình)", "int", "gdd", { json: "pointsPerRegion", width: 11 }),
    c("bi_canh_moi_vung", "Bí cảnh mỗi vùng (trung bình)", "int", "gdd", { json: "secretRealmsPerRegion", width: 10 }),
    c("mo_linh_thach", "Mỏ linh thạch mỗi vùng (trung bình)", "int", "gdd", { json: "mines.linh_thach", width: 12 }),
    c("mo_quang", "Mỏ quặng mỗi vùng", "int", "gdd", { json: "mines.quang", width: 9 }),
    c("mo_duoc", "Mỏ dược mỗi vùng", "int", "gdd", { json: "mines.duoc", width: 9 }),
    c("linh_tuyen", "Linh tuyền mỗi vùng", "int", "gdd", { json: "mines.linh_tuyen", width: 9 }),
    c("cap_mo_toi_da", "Cấp mỏ tối đa", "int", "gdd", { json: "maxMineLevel", width: 8 }),
    c("pham_linh_thach", "Phẩm linh thạch", "text", "gdd", { json: "stoneGrade", width: 12 }),
    c("pham_cong_phap_toi_da", "Phẩm công pháp cao nhất rơi", "int", "gdd", { json: "maxTechniqueGrade", width: 11 }),
    c("cap_nhan_vat_toi_da", "Cấp nhân vật tối đa", "int", "gdd", { json: "maxCharacterLevel", optional: true, width: 9 }),
    c("canh_gioi", "Cảnh giới", "text", "gdd", { json: "realms", width: 60 }),
  ],
};

export const VUNG: TableDef = {
  kind: "table", sheet: "Vùng", file: "vung.json", id: "ma", shape: "map", cols: [
    c("ma", "Mã", "text", "code", { json: "id", width: 20 }),
    c("ten", "Tên", "text", "gdd", { json: "name", width: 22 }),
    c("vi_dien", "Vị diện", "text", "gdd", { json: "plane", width: 7 }),
    c("thu_tu", "Thứ tự trên vòng", "int", "gdd", { json: "ring", width: 8 }),
    c("he", "Hệ của vùng", "list", "gdd", { json: "elements", ref: "he", width: 40 }),
    c("he_roi", "Tàn quyển rơi (hệ đầu là hệ chủ đạo)", "list", "gdd", { json: "dropElements", ref: "he", width: 40 }),
    c("ty_le_he_dau", "Tỷ lệ hệ đầu (trống = chia đều)", "pct", "gdd", { json: "dropMainShare", optional: true, width: 12 }),
    c("x", "Tâm x", "int", "gdd", { width: 7 }),
    c("y", "Tâm y", "int", "gdd", { width: 7 }),
  ],
};

export const CAP_TONG_MON: TableDef = {
  kind: "table", sheet: "Cấp tông môn", file: "cap_tong_mon.json", id: "cap", shape: "list", cols: [
    c("cap", "Cấp", "int", "gdd", { json: "level", width: 6 }),
    c("xp_len_cap", "XP lên cấp kế", "int", "cong_thuc", { json: "xpToNext", width: 13 }),
    c("xp_tich_luy", "XP tích lũy tới cấp này", "int", "cong_thuc", { json: "xpTotal", width: 15 }),
    c("ngay", "Ngày ước tính", "num", "cong_thuc", { json: "days", width: 9 }),
    c("thanh_vien", "Thành viên tối đa", "int", "cong_thuc", { json: "members", width: 10 }),
    c("diem_giu", "Điểm giữ tối đa (Hạ vị)", "int", "de_xuat", { json: "maxPoints", width: 11 }),
    c("tam", "Tầm Truyền Tống Trận (chặng)", "int", "cong_thuc", { json: "range", width: 12 }),
    c("suat_truyen_thu", "Suất bộ truyền thụ", "int", "cong_thuc", { json: "transmissionSlots", width: 10 }),
    c("tieu_truyen_tong", "Tiểu Truyền Tống Trận tối đa", "int", "cong_thuc", { json: "miniPortals", width: 12 }),
    c("npc_chien", "NPC chiến tối đa", "int", "cong_thuc", { json: "combatNpcs", width: 9 }),
    c("moi_truong_lao", "Tỷ lệ mời được trưởng lão cấp cao", "pct", "cong_thuc", { json: "elderInviteChance", width: 12 }),
    c("quy_mo", "Quy mô", "text", "gdd", { json: "scale", width: 8 }),
    c("pho_tong_chu", "Phó tông chủ", "int", "gdd", { json: "viceMasters", width: 8 }),
    c("truong_lao", "Trưởng lão", "int", "gdd", { json: "elders", width: 8 }),
    c("duong_chu", "Đường chủ", "int", "gdd", { json: "hallMasters", width: 8 }),
    c("mo_khoa", "Mở khóa", "text", "gdd", { json: "unlocks", optional: true, width: 60 }),
  ],
};

export const MO: TableDef = {
  kind: "table", sheet: "Mỏ", file: "mo.json", id: "cap", shape: "list", cols: [
    c("cap", "Cấp mỏ", "int", "gdd", { json: "level", width: 7 }),
    c("san_luong_gio", "Sản lượng mỗi giờ", "int", "cong_thuc", { json: "perHour", width: 11 }),
    c("san_luong_ngay", "Sản lượng mỗi ngày", "int", "cong_thuc", { json: "perDay", width: 11 }),
    c("chi_phi_nang", "Chi phí nâng lên cấp kế", "int", "cong_thuc", { json: "upgradeCost", optional: true, width: 13 }),
  ],
};

export const BI_CANH: TableDef = {
  kind: "table", sheet: "Bí cảnh", file: "bi_canh.json", id: "ma", shape: "map", cols: [
    c("ma", "Mã", "text", "code", { json: "id", width: 22 }),
    c("ten", "Tên", "text", "gdd", { json: "name", width: 22 }),
    c("roi_goc", "Tỷ lệ rơi gốc", "pct", "gdd", { json: "dropRate", width: 9 }),
    c("the_manh", "Thế mạnh", "text", "gdd", { json: "strength", width: 34 }),
    c("than_vat", "Thần vật khi rơi", "pct", "cong_thuc", { json: "share.thanVat", width: 10 }),
    c("thien_cap", "Thiên cấp", "pct", "cong_thuc", { json: "share.thienCap", width: 10 }),
    c("linh_cap", "Linh cấp", "pct", "cong_thuc", { json: "share.linhCap", width: 10 }),
    c("tan_quyen", "Tàn quyển", "pct", "cong_thuc", { json: "share.tanQuyen", width: 10 }),
  ],
};

export const THU: TableDef = {
  kind: "table", sheet: "Thú cưỡi", file: "thu_cuoi.json", id: "ma", shape: "list", cols: [
    c("stt", "STT", "int", "gdd", { json: "no", width: 5 }),
    c("ma", "Mã", "text", "gdd", { json: "id", width: 18 }),
    c("ten", "Tên", "text", "gdd", { json: "name", width: 16 }),
    c("he", "Hệ", "text", "gdd", { json: "element", ref: "he", width: 9 }),
    c("pham", "Phẩm loài", "text", "gdd", { json: "grade", ref: "thu_pham", width: 8 }),
    c("dang", "Dáng", "text", "gdd", { json: "form", width: 9 }),
    c("gap_o", "Gặp ở", "text", "gdd", { json: "habitat", width: 40 }),
    c("mvp", "Có trong MVP", "bool", "gdd", { json: "mvp", width: 8 }),
    c("mo_ta", "Mô tả", "text", "gdd", { json: "desc", width: 40 }),
    c("ma_hinh", "Khóa hình", "text", "gdd", { json: "asset", width: 22 }),
    c("cong_chi_so", "Cộng chỉ số ở đỉnh", "pct", "cong_thuc", { json: false, width: 9 }),
  ],
};

export const THU_PHAM: TableDef = {
  kind: "table", sheet: "Thú phẩm", file: "thu_pham.json", id: "ma", shape: "map", cols: [
    c("ma", "Mã", "text", "code", { json: "id", width: 7 }),
    c("ten", "Phẩm loài", "text", "gdd", { json: "name", width: 9 }),
    c("so_loai", "Số loài", "int", "gdd", { json: "species", width: 7 }),
    c("gap_o", "Gặp ở", "text", "gdd", { json: "habitat", width: 45 }),
    c("cong_chi_so", "Cộng chỉ số mỗi thú ở đỉnh", "pct", "gdd", { json: "statBonus", width: 11 }),
    c("ban_tren_cho", "Bán trên chợ", "text", "gdd", { json: "market", width: 30 }),
    c("luyen_hoa_them", "Luyện hóa: Dưỡng Linh Đơn thêm", "int", "gdd", { json: "refineBonus", optional: true, width: 12 }),
  ],
};

export const THU_CANH_GIOI: TableDef = {
  kind: "table", sheet: "Thú cảnh giới", file: "thu_canh_gioi.json", id: "so", shape: "list", cols: [
    c("so", "Đại cảnh giới", "int", "gdd", { json: "realm", width: 8 }),
    c("ten", "Tên", "text", "gdd", { json: "name", width: 12 }),
    c("tang_tu", "Từ tiểu cảnh giới", "int", "gdd", { json: "fromStage", width: 9 }),
    c("tang_den", "Đến tiểu cảnh giới", "int", "gdd", { json: "toStage", width: 9 }),
    c("mo_cap", "Mở ở Hạ vị khi chủ đạt cấp", "int", "gdd", { json: "unlockLevel", width: 11 }),
    c("toc_do", "Tốc độ hành trình khi cưỡi", "mul", "gdd", { json: "speed", width: 11 }),
    c("cong_thanh", "Linh thú công thành mỗi phút", "int", "gdd", { json: "siegePerMinute", width: 12 }),
    c("dot_pha", "Tỷ lệ gốc khi đột phá vào", "pct", "gdd", { json: "breakthroughChance", optional: true, width: 11 }),
    c("pha_canh_don", "Cấp Phá Cảnh Đơn", "int", "gdd", { json: "breakPillLevel", optional: true, width: 9 }),
    c("cong_chi_so_pham", "Cộng chỉ số tầng cuối (Phàm)", "pct", "gdd", { json: "statBonus.pham", width: 11 }),
    c("cong_chi_so_than", "Cộng chỉ số tầng cuối (Thần)", "pct", "gdd", { json: "statBonus.than", width: 11 }),
  ],
};

export const THU_KICH_PHAT: TableDef = {
  kind: "table", sheet: "Thú kích phát", file: "thu_kich_phat.json", id: "ma", shape: "map", cols: [
    c("ma", "Mã", "text", "code", { json: "id", width: 14 }),
    c("ten", "Tổ hợp", "text", "gdd", { json: "name", width: 18 }),
    c("dieu_kien", "Điều kiện trong 5 ô", "text", "gdd", { json: "condition", width: 50 }),
    c("hieu_ung", "Hiệu ứng", "text", "gdd", { json: "effect", width: 70 }),
  ],
};

export const LINH_DON: TableDef = {
  kind: "table", sheet: "Linh đơn", file: "linh_don.json", id: "ma", shape: "map", cols: [
    c("ma", "Mã", "text", "code", { json: "id", width: 14 }),
    c("ten", "Tên", "text", "gdd", { json: "name", width: 15 }),
    c("cap", "Cấp", "text", "gdd", { json: "levels", width: 35 }),
    c("cong_dung", "Công dụng", "text", "gdd", { json: "use", width: 26 }),
    c("nguyen_lieu", "Nguyên liệu chính", "text", "gdd", { json: "materials", width: 30 }),
    c("cho", "Chợ", "text", "gdd", { json: "market", width: 40 }),
  ],
};

/** Thứ tự sheet trong file (sau sheet Ghi chú). */
export const SHEETS: SheetDef[] = [
  PARAMS, HE, KHAC_CHE, QUAN_HE, TO_HOP, LOAI_CHIEU, BIEN_THE, PHAM, TAI_NANG, TAN_QUYEN, CONG_PHAP,
  VI_DIEN, VUNG, CAP_TONG_MON, MO, BI_CANH, THU, THU_PHAM, THU_CANH_GIOI, THU_KICH_PHAT, LINH_DON,
];
export const NOTE_SHEET = "Ghi chú";

// ---------- đổi đơn vị ----------

/** "ô" đổi sang milli-ô như sim; "số ô" là số ô đếm nguyên (đơn vị "o" của data/trang_bi). */
const UNIT: Record<string, number> = { "%": 1000, "giây": 20, "ô": 1000, "số ô": 1, "hệ số": 1000, "ô/giây": 50, "số": 1 };

/** Giá trị Excel → JSON theo kiểu cột. */
export function toJson(kind: Kind, v: unknown, unit?: unknown): unknown {
  if (v === null || v === undefined || v === "") return undefined;
  switch (kind) {
    case "text": return String(v).trim();
    case "list": return String(v).split(",").map((s) => s.trim()).filter(Boolean);
    case "bool": return String(v).trim().toLowerCase() === "có" || v === true;
    case "int": return Math.round(num(v));
    case "num": return num(v);
    case "pct": case "mul": case "cell": return Math.round(num(v) * 1000);
    case "sec": return Math.round(num(v) * 20);
    case "qty": {
      const k = UNIT[String(unit ?? "").trim()];
      if (k === undefined) throw new Error(`Đơn vị lạ: ${String(unit)}`);
      return Math.round(num(v) * k);
    }
    case "unit": {
      const code = UNIT_CODE[String(v).trim()];
      if (!code) throw new Error(`Đơn vị lạ: ${String(v)} (dùng ${Object.keys(UNIT_CODE).join(", ")})`);
      return code;
    }
    case "kv": return parseKv(String(v));
  }
}

/** Chữ đơn vị trong Excel ↔ mã đơn vị trong JSON (cột kiểu unit). */
const UNIT_CODE: Record<string, string> = { "%": "phan_nghin", "giây": "tick", "số ô": "o" };
export function unitLabel(code: string): string {
  const label = Object.keys(UNIT_CODE).find((k) => UNIT_CODE[k] === code);
  if (!label) throw new Error(`Mã đơn vị lạ: ${code}`);
  return label;
}
/** Số theo mã đơn vị JSON → giá trị hiện trong Excel (ngược của qty). */
export function fromCodeUnit(v: number, code: string): number {
  return v / UNIT[unitLabel(code)];
}

/** Object → "khóa: giá trị; khóa: giá trị" (giữ đơn vị code). */
export function kvText(o: Record<string, unknown>): string {
  const one = (x: unknown): string => (Array.isArray(x) ? `[${x.map(one).join(", ")}]` : String(x));
  return Object.entries(o).map(([k, x]) => `${k}: ${one(x)}`).join("; ");
}
function parseKv(s: string): Record<string, unknown> {
  const one = (x: string): unknown => {
    x = x.trim();
    if (x.startsWith("[") && x.endsWith("]")) return x.slice(1, -1).split(",").map((y) => y.trim()).filter(Boolean).map(one);
    if (x === "true" || x === "false") return x === "true";
    return /^-?\d+(\.\d+)?$/.test(x) ? Number(x) : x;
  };
  const out: Record<string, unknown> = {};
  for (const part of s.split(";")) {
    if (!part.trim()) continue;
    const i = part.indexOf(":");
    if (i < 0) throw new Error(`Thiếu dấu ":" trong "${part.trim()}"`);
    out[part.slice(0, i).trim()] = one(part.slice(i + 1));
  }
  return out;
}
/** Giá trị của sheet Tham số → JSON theo cột Kiểu. */
export function paramToJson(kieu: string, v: unknown): unknown {
  if (kieu === "có/không") return String(v).trim().toLowerCase() === "có" || v === true;
  const k = UNIT[kieu];
  if (k === undefined) throw new Error(`Kiểu tham số lạ: ${kieu}`);
  return k === 1 ? num(v) : Math.round(num(v) * k);
}
/** Ngược lại: số theo đơn vị code → giá trị hiện trong Excel. */
export function paramFromCode(kieu: string, v: number | boolean): number | string {
  if (kieu === "có/không") return v ? "có" : "không";
  return (v as number) / UNIT[kieu];
}
// ---------- đường dẫn JSON ----------

/** "a.b[0].c" → ["a", "b", 0, "c"]; số sau dấu chấm là khóa object ("tran.x.2"), số trong ngoặc vuông là chỉ số mảng. */
function parsePath(path: string): (string | number)[] {
  const out: (string | number)[] = [];
  for (const part of path.split(".")) {
    const m = /^([^[]*)((?:\[\d+\])*)$/.exec(part)!;
    if (m[1]) out.push(m[1]);
    for (const i of m[2].matchAll(/\[(\d+)\]/g)) out.push(Number(i[1]));
  }
  return out;
}
export function setPath(obj: Record<string, unknown>, path: string, v: unknown): void {
  const seg = parsePath(path);
  let o: Record<string | number, unknown> = obj;
  seg.slice(0, -1).forEach((k, i) => {
    o = (o[k] ??= typeof seg[i + 1] === "number" ? [] : {}) as Record<string | number, unknown>;
  });
  o[seg[seg.length - 1]] = v;
}
export function getPath(obj: unknown, path: string): unknown {
  let o = obj as Record<string | number, unknown> | undefined;
  for (const k of parsePath(path)) o = o?.[k] as Record<string | number, unknown> | undefined;
  return o;
}

function num(v: unknown): number {
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  if (!Number.isFinite(n)) throw new Error(`Không phải số: ${String(v)}`);
  return n;
}

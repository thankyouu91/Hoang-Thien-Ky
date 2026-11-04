// Trang bị, pháp bảo, ngọc, set đồ và vật phẩm (GDD tab "Trang bị, pháp bảo và set đồ"; mọi số là đề xuất).
// Mỗi bảng con của 7 file trang bị (trang_bi, vu_khi, ngoc, set, phap_bao, phap_khi, vat_pham) thành một sheet; xuat.ts ghép
// các sheet lại đúng cấu trúc đó trong data/he_thong/json. Lần đầu dựng từ bản nháp data/trang_bi của phiên set đồ (đã bỏ ở
// e79c326); giờ tao.ts dựng lại từ data/he_thong/json, vốn xuất từ chính file Excel.
import { existsSync, readFileSync } from "node:fs";
import * as B from "./bang.ts";

export interface PartDef {
  def: B.TableDef;
  file: string; // file JSON ghép
  path: string; // chỗ đặt mảng dòng trong file đó; trống = ghép riêng (Set mốc, Luật, Ghi chú)
}

const c = (key: string, header: string, kind: B.Kind, more: Partial<B.Col> = {}): B.Col =>
  ({ key, header, kind, src: key === "ma_vp" || key === "id" ? "code" : "de_xuat", ...more });
const T = (sheet: string, file: string, path: string, id: string, cols: B.Col[], width = 14): PartDef => ({
  def: { kind: "table", sheet, id, shape: "list", cols: cols.map((x) => ({ width, ...x })) }, file, path,
});
const nguon = c("nguon", "Nguồn", "list", { width: 34 });
const moTa = c("mo_ta", "Mô tả", "text", { width: 50 });

export const PARTS: PartDef[] = [
  T("Độ hiếm", "trang_bi.json", "do_hiem", "id", [
    c("id", "Mã", "text"), c("ten", "Tên", "text"), c("bac", "Bậc", "int"), c("he_so", "Hệ số chỉ số", "mul"),
    c("dong_kham", "Số dòng khảm", "int"), c("nguon", "Nguồn", "text", { width: 50 }),
  ]),
  T("Ô trang bị", "trang_bi.json", "o", "id", [
    c("id", "Mã", "text"), c("ma", "Mã ngắn", "text"), c("ten", "Tên", "text"),
    c("chinh_stat", "Chỉ số chính", "text", { json: "chinh.stat" }), c("chinh_ten", "Tên chỉ số chính", "text", { json: "chinh.ten" }),
    c("chinh_gia_tri", "Chỉ số chính (theo chỉ số chuẩn cùng cấp)", "pct", { json: "chinh.gia_tri" }),
    c("phu_stat", "Chỉ số phụ", "text", { json: "phu.stat" }), c("phu_ten", "Tên chỉ số phụ", "text", { json: "phu.ten" }),
    c("phu_gia_tri", "Chỉ số phụ (theo chỉ số chuẩn cùng cấp)", "pct", { json: "phu.gia_tri" }),
    c("ngoc", "Ô ngọc (cong: công, thu: thủ)", "text"), c("hien_tren_nguoi", "Hiện trên người", "bool"),
    c("cong_thuc_ren", "Công thức rèn (khóa: số lượng)", "kv", { width: 40 }),
  ]),
  T("Kiểu trang bị", "trang_bi.json", "kieu", "ma_vp", [
    c("ma_vp", "Mã vật phẩm", "text"), c("o", "Ô", "text"), c("so", "Số", "int"), c("ten", "Tên", "text", { width: 22 }),
    c("do_hiem", "Độ hiếm", "text"), c("khi_hinh", "Khí hình", "text", { optional: true }),
    c("ten_de_xuat", "Tên đề xuất theo khí hình", "text", { optional: true, width: 22 }), c("dang", "Dáng", "text", { optional: true }),
    moTa, nguon,
  ]),
  T("Khí hình", "vu_khi.json", "khi_hinh", "id", [
    c("id", "Mã", "text"), c("ten", "Tên", "text"), c("loai_chieu", "Loại chiêu", "text"), moTa,
    c("y_chau", "Ý châu", "text"), c("so_kieu", "Số kiểu vũ khí", "int"),
  ]),
  T("Hình khi cầm", "vu_khi.json", "hinh_khi_cam", "tai_nang", [
    c("tai_nang", "Tài năng", "text"), c("ten", "Tên", "text"), c("ma_vp", "Mã vật phẩm", "text"),
  ]),
  T("Ngọc hệ", "ngoc.json", "he", "ma_vp", [
    c("ma_vp", "Mã vật phẩm", "text"), c("he", "Hệ", "text"), c("ten", "Tên", "text"), c("ten_han_viet", "Tên Hán Việt", "text", { width: 18 }), nguon,
  ]),
  T("Ngọc cấp", "ngoc.json", "cap", "cap", [
    c("cap", "Cấp", "int"), c("gia_tri", "Sát thương hoặc kháng hệ", "pct"),
    c("ty_le_nen_len", "Tỷ lệ nén lên cấp này", "pct", { nullable: true }), c("khoa", "Khóa vào nhân vật", "bool"),
  ]),
  T("Ý châu", "ngoc.json", "y_chau", "ma_vp", [
    c("ma_vp", "Mã vật phẩm", "text"), c("ten", "Tên", "text"), c("khi_hinh", "Khí hình", "text"), c("loai_chieu", "Loại chiêu", "text"),
    c("chi_kham_vao", "Chỉ khảm vào", "text"), moTa, c("tham_so", "Tham số (đơn vị code)", "kv", { width: 40 }),
    c("ban_cho", "Bán ở chợ", "bool"), nguon,
  ]),
  T("Ấn bộ", "ngoc.json", "an_bo", "ma_vp", [
    c("ma_vp", "Mã vật phẩm", "text"), c("ten", "Tên", "text"), c("bo", "Bộ", "text"),
    c("he", "Hệ ấn (trống: không hệ)", "text", { nullable: true }), c("ban_cho", "Bán ở chợ", "bool"), nguon,
  ]),
  T("Set", "set.json", "bo", "id", [
    c("id", "Mã bộ", "text"), c("ten", "Tên", "text"), c("nguon", "Bí cảnh ra ấn", "text", { width: 20 }), c("chu_de", "Chủ đề", "text"),
    c("gan_voi", "Gắn với", "kv", { width: 30 }), c("than", "Bộ thần", "bool"),
    c("rang_buoc", "Ràng buộc", "text", { nullable: true, width: 40 }), c("an", "Ấn bộ", "text"),
  ]),
  T("Set mốc", "set.json", "", "bo", [
    c("bo", "Mã bộ", "text"), c("so", "Số món", "int"), c("loai", "Loại hiệu ứng", "text"),
    c("mo_ta", "Mô tả", "text", { width: 60 }), c("tham_so", "Tham số (đơn vị code)", "kv", { width: 50 }),
  ]),
  // Đạo Cơ Bàn: bàn ô lục giác đặt ấn bộ và ngọc hệ để tính thêm món set và cộng hưởng (GDD tab Trang bị phần 8, rev 28)
  T("Đạo Cơ Bàn", "dao_co_ban.json", "o", "ma", [
    c("ma", "Mã ô", "text", { width: 7 }), c("vong", "Vòng (tam, trong, canh, goc)", "text", { width: 12 }),
    c("q", "q", "int", { width: 5 }), c("r", "r", "int", { width: 5 }),
    // Ô mở khi vị diện hiện tại cao hơn, hoặc cùng vị diện và cấp ≥ cap (Thần vực không còn cấp, xét cảnh giới)
    c("mo_vi_dien", "Mở ở vị diện (ha, trung, than)", "text", { json: "mo.viDien", width: 11 }),
    c("mo_cap", "Mở từ cấp (trống ở Thần vực)", "int", { json: "mo.cap", optional: true, width: 11 }),
    c("mo_canh_gioi", "Mở ở cảnh giới (1 Luyện Khí … 9 Độ Kiếp)", "int", { json: "mo.canhGioi", width: 14 }),
    c("chi_nhan", "Nhận (an: ấn bộ, ngoc: ngọc hệ)", "list", { width: 16 }),
  ]),
  T("Cộng hưởng", "dao_co_ban.json", "cong_huong", "mach", [
    c("mach", "Mạch", "text", { width: 8 }), c("ten", "Tên", "text"), c("heSoMoc2", "Nhân số ở mốc 2", "mul", { width: 10 }),
    c("khangHe", "Kháng hệ đó", "pct", { optional: true, width: 9 }), c("manaMax", "Mana tối đa", "pct", { optional: true, width: 9 }),
    c("mo_ta", "Tác dụng", "text", { width: 60 }),
  ]),
  T("Mạch cộng hưởng", "dao_co_ban.json", "", "quan_he", [
    c("quan_he", "Quan hệ tổ hợp (mã)", "text", { width: 14 }), c("mach", "Mạch", "text", { width: 8 }),
    c("ten", "Tên mạch", "text", { json: false }), c("mau", "Gợi ý màu", "text", { json: false, width: 16 }),
  ]),
  T("Pháp bảo loại", "phap_bao.json", "loai", "id", [
    c("ma", "Mã ngắn", "text"), c("id", "Mã", "text"), c("ten", "Tên", "text"), c("khac_loai_chieu", "Khắc loại chiêu", "text"),
    c("kich_hoat", "Kích hoạt khi", "text", { width: 45 }), c("hieu_ung", "Hiệu ứng", "text", { width: 40 }),
    c("chinh_ten", "Chỉ số chính", "text", { json: "chinh.ten" }), c("chinh_don_vi", "Đơn vị", "unit", { json: "chinh.don_vi", width: 8 }),
    ...["Lục", "Lam", "Tím", "Vàng", "Đỏ"].map((d, i) =>
      c(`chinh_${i}`, `Chỉ số chính · ${d}`, "qty", { json: `chinh.theo_do_hiem[${i}]`, unitCol: "chinh_don_vi", width: 10 })),
    c("so_lan_moi_tran", "Số lần mỗi trận", "int"), c("hoi_chieu", "Hồi chiêu (giây)", "sec", { json: "hoi_chieu_ticks" }),
  ]),
  T("Pháp bảo", "phap_bao.json", "mon", "ma_vp", [
    c("ma_vp", "Mã vật phẩm", "text"), c("ten", "Tên", "text", { width: 20 }), c("loai", "Loại", "text"), c("do_hiem", "Độ hiếm", "text"),
    c("chinh_ten", "Chỉ số chính", "text", { json: "chinh.ten" }),
    c("chinh_gia_tri", "Giá trị chính", "qty", { json: "chinh.gia_tri", unitCol: "chinh_don_vi", width: 10 }),
    c("chinh_don_vi", "Đơn vị", "unit", { json: "chinh.don_vi", width: 8 }),
    c("so_lan", "Số lần mỗi trận", "int", { json: "phu.so_lan_moi_tran" }),
    c("hoi_chieu", "Hồi chiêu (giây)", "sec", { json: "phu.hoi_chieu_ticks" }),
    c("linh_luc", "Linh lực tối đa", "int", { json: "phu.linh_luc_toi_da" }),
    moTa, nguon, c("khoa", "Khóa vào nhân vật", "bool"),
  ]),
  T("Pháp bảo trấn giáo", "phap_bao.json", "tran_giao", "ma_vp", [
    c("ma_vp", "Mã vật phẩm", "text"), c("ten", "Tên", "text", { width: 20 }), moTa, c("cap", "Cấp", "text"), c("dat_o", "Đặt ở", "text"),
    nguon, c("ghi_chu", "Ghi chú", "text", { width: 50 }),
  ]),
  T("Pháp khí", "phap_khi.json", "mon", "ma_vp", [
    c("ma_vp", "Mã vật phẩm", "text"), c("ten", "Tên", "text"), c("loai", "Loại", "text"), c("do_hiem", "Độ hiếm", "text"),
    c("tai_nang_hop", "Hợp tài năng", "text"), c("chinh_ten", "Chỉ số chính", "text", { json: "chinh.ten", width: 22 }),
    c("chinh_gia_tri", "Giá trị chính", "qty", { json: "chinh.gia_tri", unitCol: "chinh_don_vi", width: 10 }),
    c("chinh_don_vi", "Đơn vị", "unit", { json: "chinh.don_vi", width: 8 }), c("phu", "Phụ (đơn vị code)", "kv", { width: 24 }), nguon,
  ]),
  T("Phù", "vat_pham.json", "phu", "ma_vp", [
    c("ma_vp", "Mã vật phẩm", "text"), c("ten", "Tên", "text"), c("ten_icon", "Tên icon", "text", { optional: true, width: 20 }),
    moTa, nguon, c("moi", "Mới", "bool"),
  ]),
  T("Đan", "vat_pham.json", "dan", "ma_vp", [
    c("ma_vp", "Mã vật phẩm", "text"), c("nhom", "Nhóm", "text"), c("ten", "Tên", "text"),
    c("ten_icon", "Tên icon", "text", { optional: true, width: 26 }), moTa, c("cap", "Cấp", "text", { optional: true, width: 8 }),
    nguon, c("khoa", "Khóa vào nhân vật", "bool"),
  ]),
  T("Nguyên liệu rèn", "vat_pham.json", "nguyen_lieu", "ma_vp", [
    c("ma_vp", "Mã vật phẩm", "text"), c("ten", "Tên", "text"), moTa, nguon, c("moi", "Mới", "bool"),
  ]),
  // Luyện khí sau cấp tối đa (GDD tab Trang bị phần 13, rev 37): tẩy luyện, khí linh, khí văn, phân giải, Ngọc Phách, song hệ,
  // danh khí, Bảo Giám, tế luyện tầng pháp bảo
  T("Tẩy luyện", "luyen_khi.json", "tay_luyen", "o", [
    c("o", "Ô", "text", { width: 10 }), c("loai", "Loại (1 là mặc định)", "int", { width: 9 }),
    c("stat", "Khóa sim", "text", { width: 13 }), c("ten", "Chỉ số phụ", "text", { width: 26 }),
    c("gia_tri", "Giá trị ở lục +0", "pct", { width: 10 }),
  ]),
  T("Khí linh", "luyen_khi.json", "khi_linh", "cap", [
    c("cap", "Cấp khí linh", "int", { width: 8 }), c("kinh_nghiem", "Kinh nghiệm lên cấp này", "int", { width: 12 }),
    c("kinh_nghiem_tich_luy", "Kinh nghiệm tích lũy", "int", { width: 12 }),
    c("cong_chi_so", "Cộng chỉ số gốc của món", "pct", { width: 12 }), c("mo_o_khi_van", "Mở ô khí văn", "bool", { width: 9 }),
  ]),
  T("Khí văn", "luyen_khi.json", "khi_van", "ma", [
    c("ma", "Mã", "text", { width: 11 }), c("nhom", "Nhóm ô (cong, thu)", "text", { width: 9 }), c("ten", "Tên", "text", { width: 15 }),
    c("tac_dung", "Tác dụng", "text", { width: 60 }), c("gia_tri", "Số chính", "qty", { unitCol: "don_vi", width: 9 }),
    c("don_vi", "Đơn vị", "unit", { width: 8 }),
  ]),
  T("Phân giải", "luyen_khi.json", "phan_giai", "do_hiem", [
    c("do_hiem", "Độ hiếm", "text", { width: 9 }), c("khi_tinh", "Khí Tinh nhận được", "int", { width: 10 }),
  ]),
  T("Ngọc Phách", "ngoc.json", "phach", "ma_vp", [
    c("ma_vp", "Mã vật phẩm", "text"), c("he", "Hệ", "text", { width: 9 }), c("ten", "Tên", "text", { width: 16 }),
    c("gia_tri", "Sát thương hệ", "pct", { width: 9 }), c("tran_toi_da", "Trần sát thương hệ đó nâng lên", "pct", { width: 11 }),
    c("khoa", "Khóa vào nhân vật", "bool"), nguon,
  ]),
  T("Song hệ ngọc", "ngoc.json", "song_he", "ma_vp", [
    c("ma_vp", "Mã vật phẩm", "text"), c("ten", "Tên", "text"), c("moi_he", "Mỗi hệ so với một viên thường", "pct", { width: 12 }),
    moTa, nguon,
    c("ty_le_dau", "Tỷ lệ đậu (cố định, không theo bảng nén)", "pct", { width: 12 }),
    c("that_bai_mat", "Thất bại mất số viên (viên đặt thứ hai)", "int", { width: 12 }),
    c("phu_giu", "Phù giữ lại cả hai", "text", { width: 11 }),
  ]),
  T("Danh khí", "luyen_khi.json", "danh_khi", "ma_vp", [
    c("ma_vp", "Mã vật phẩm", "text"), c("ten", "Tên", "text", { width: 16 }), c("khi_hinh", "Khí hình", "text", { width: 9 }),
    c("danh_van", "Danh văn", "text", { width: 60 }), c("do_pho", "Đồ phổ", "text", { width: 11 }),
  ]),
  T("Bảo Giám", "luyen_khi.json", "bao_giam", "ma", [
    c("ma", "Mã trang", "text", { width: 11 }), c("ten", "Tên trang", "text", { width: 18 }),
    c("dem", "Đếm (đơn vị code)", "kv", { width: 30 }), c("so_luong", "Số kiểu cần đủ", "int", { width: 9 }),
    c("thuong", "Thưởng (không cộng chỉ số)", "text", { width: 45 }),
    c("loai_thuong", "Loại thưởng", "text", { width: 15 }),
    c("so_thuong", "Số thưởng (ô, Khí Tinh)", "int", { width: 10, nullable: true }),
  ]),
  T("Tế luyện tầng", "luyen_khi.json", "te_luyen_tang", "tang", [
    c("tang", "Tầng", "int", { width: 6 }), c("linh_luc", "Linh lực tối đa (cộng dồn)", "pct", { width: 11 }),
    c("hoi_chieu", "Hồi chiêu (cộng dồn)", "pct", { width: 10 }), c("khi_tinh", "Khí Tinh lên tầng này", "int", { width: 10 }),
  ]),
  T("Luật trang bị", "", "", "khoa", [
    c("khoa", "Khóa (file:đường dẫn)", "text", { width: 40 }), c("ten", "Tên", "text", { width: 45, json: false }),
    c("gia_tri", "Giá trị", "qty", { unitCol: "kieu", width: 10 }), c("kieu", "Kiểu", "text", { width: 8 }),
  ]),
  T("Ghi chú trang bị", "", "", "file", [
    c("file", "File", "text", { width: 16 }), c("stt", "STT", "int", { width: 5 }), c("noi_dung", "Nội dung", "text", { width: 140 }),
  ]),
];
const part = (sheet: string) => PARTS.find((p) => p.def.sheet === sheet)!;

/** Loại mạch của Đạo Cơ Bàn: tên và gợi ý màu (chỉ để xem trong Excel). */
export const MACH_INFO: Record<string, [string, string]> = {
  thuan: ["Thuần", "trắng ngà"], sinh: ["Sinh", "xanh lục"], cuc: ["Cực", "tím"], trung: ["Trung", "xám"],
  dut: ["Đứt (không phải mạch)", "đỏ, nét đứt"],
};

/** Thứ tự khóa cấp đầu của từng file, như data/trang_bi. */
const TOP_ORDER: Record<string, string[]> = {
  "trang_bi.json": ["ghi_chu", "do_hiem", "o", "kieu"],
  "vu_khi.json": ["ghi_chu", "khi_hinh", "hinh_khi_cam"],
  "ngoc.json": ["ghi_chu", "he", "cap", "tran", "song_he", "phach", "y_chau", "an_bo"],
  "set.json": ["ghi_chu", "moc", "tran", "ty_le_kham_san_tim_tro_len", "bo"],
  "phap_bao.json": ["ghi_chu", "o", "loai", "mon", "tran_giao"],
  "phap_khi.json": ["ghi_chu", "o", "mon"],
  "vat_pham.json": ["ghi_chu", "phu", "dan", "nguyen_lieu"],
  "dao_co_ban.json": ["ghi_chu", "o", "cong_huong", "mach", "luat"],
  "luyen_khi.json": ["ghi_chu", "tay_luyen", "khi_linh", "khi_van", "phan_giai", "danh_khi", "bao_giam", "te_luyen_tang", "luat"],
};
export const TB_FILES = Object.keys(TOP_ORDER);

/** Luật lẻ trong các file: [file:đường dẫn, tên, kiểu]. */
export const LUAT: [string, string, string][] = [
  ["set.json:moc[0]", "Mốc set thứ nhất (số món)", "số"],
  ["set.json:moc[1]", "Mốc set thứ hai (số món)", "số"],
  ["set.json:moc[2]", "Mốc set thứ ba (số món)", "số"],
  ["set.json:tran.boToiDa", "Số bộ kích cùng lúc tối đa", "số"],
  ["set.json:tran.luc_chien_phan_nghin.2", "Trần lực chiến của một bộ ở mốc 2", "%"],
  ["set.json:tran.luc_chien_phan_nghin.4", "Trần lực chiến của một bộ ở mốc 4", "%"],
  ["set.json:tran.luc_chien_phan_nghin.7", "Trần lực chiến của một bộ ở mốc 7", "%"],
  ["set.json:tran.kinhTeToiDa", "Kinh tế từ đồ tối đa mỗi loại", "%"],
  ["set.json:tran.tyLeChungTranPhu", "Tỷ lệ cộng từ đồ chung trần với phù", "%"],
  ["set.json:ty_le_kham_san_tim_tro_len", "Đồ từ tím trở lên rơi ra đã khảm sẵn ấn", "%"],
  ["phap_bao.json:o.ha_vi", "Ô pháp bảo ở Hạ vị", "số"],
  ["phap_bao.json:o.trung_vi_tro_len", "Ô pháp bảo từ Trung vị", "số"],
  ["phap_khi.json:o", "Ô pháp khí", "số"],
  ["ngoc.json:tran.satThuongMem", "Ngọc: sát thương một hệ từ ngọc, phần trên mức này chỉ tính một nửa", "%"],
  ["ngoc.json:tran.satThuongToiDa", "Ngọc: sát thương một hệ từ ngọc tối đa", "%"],
  ["ngoc.json:tran.khangMem", "Ngọc: kháng một hệ từ ngọc, phần trên mức này chỉ tính một nửa", "%"],
  ["ngoc.json:tran.khangToiDa", "Ngọc: kháng một hệ từ ngọc tối đa", "%"],
  ["dao_co_ban.json:luat.banMonToiDaMoiBo", "Đạo Cơ Bàn: mỗi bộ tính thêm tối đa số món từ bàn (gồm ô tâm)", "số"],
  ["dao_co_ban.json:luat.banMonTrenDoToiThieu", "Đạo Cơ Bàn: bộ cần ít nhất số món trên đồ đang mặc mới được tính thêm", "số"],
  ["dao_co_ban.json:luat.banMoTuCap", "Đạo Cơ Bàn: mở từ cấp nhân vật", "số"],
  ["dao_co_ban.json:luat.banTranLucChien", "Đạo Cơ Bàn: bàn đầy thêm tối đa lực chiến", "%"],
  // Luyện khí sau cấp tối đa: mở khóa
  ["luyen_khi.json:luat.phanGiaiMoCap", "Phân giải mở từ cấp nhân vật", "số"],
  ["luyen_khi.json:luat.baoGiamMoCap", "Bảo Giám mở từ cấp nhân vật", "số"],
  ["luyen_khi.json:luat.tayLuyenMoCap", "Tẩy luyện mở từ cấp (Kết Đan)", "số"],
  ["luyen_khi.json:luat.khiLinhMoCap", "Khí linh và khí văn mở từ cấp (Hóa Thần)", "số"],
  ["luyen_khi.json:luat.khiLinhBacToiThieu", "Khí linh: món từ bậc độ hiếm này (3 là tím)", "số"],
  ["luyen_khi.json:luat.songHeCapNgoc", "Hợp ngọc song hệ: khi có ngọc cấp", "số"],
  ["luyen_khi.json:luat.phachCapNgoc", "Ngọc Phách: điểm hóa ngọc cấp", "số"],
  ["luyen_khi.json:luat.danhKhiMoCap", "Danh khí: từ cấp 250 ở Hạ vị (từ Trung vị thì luôn mở)", "số"],
  ["luyen_khi.json:luat.danhKhiLoToiThieu", "Danh khí: lò rèn tông môn tối thiểu cấp", "số"],
  // Phân giải, tẩy luyện, khí linh, khí văn
  ["luyen_khi.json:luat.phanGiaiKhiTinhMoiCapKhiLinh", "Phân giải: Khí Tinh thêm mỗi cấp khí linh của món", "số"],
  ["luyen_khi.json:luat.phanGiaiTraNac", "Phân giải: số nấc cường hóa trả lại thành Luyện Khí Thạch", "%"],
  ["luyen_khi.json:luat.tayLuyenKhiTinh", "Tẩy luyện: Khí Tinh mỗi lần", "số"],
  ["luyen_khi.json:luat.tayLuyenLinhThach.luc", "Tẩy luyện món lục: linh thạch (đúng phẩm của vị diện) mỗi lần", "số"],
  ["luyen_khi.json:luat.tayLuyenLinhThach.lam", "Tẩy luyện món lam: linh thạch (đúng phẩm của vị diện) mỗi lần", "số"],
  ["luyen_khi.json:luat.tayLuyenLinhThach.tim", "Tẩy luyện món tím: linh thạch (đúng phẩm của vị diện) mỗi lần", "số"],
  ["luyen_khi.json:luat.tayLuyenLinhThach.vang", "Tẩy luyện món vàng: linh thạch (đúng phẩm của vị diện) mỗi lần", "số"],
  ["luyen_khi.json:luat.tayLuyenLinhThach.do", "Tẩy luyện món đỏ: linh thạch (đúng phẩm của vị diện) mỗi lần", "số"],
  ["luyen_khi.json:luat.khiLinhKnTran", "Khí linh: kinh nghiệm mỗi trận món được mặc", "số"],
  ["luyen_khi.json:luat.khiLinhKnBiCanh", "Khí linh: kinh nghiệm mỗi lượt bí cảnh", "số"],
  ["luyen_khi.json:luat.khiLinhKnKhiTinh", "Khí linh: kinh nghiệm mỗi Khí Tinh nạp vào", "số"],
  ["luyen_khi.json:luat.khiVanToiDa.tim", "Khí văn tối đa trên món tím", "số"],
  ["luyen_khi.json:luat.khiVanToiDa.vang", "Khí văn tối đa trên món vàng", "số"],
  ["luyen_khi.json:luat.khiVanToiDa.do", "Khí văn tối đa trên món đỏ", "số"],
  ["luyen_khi.json:luat.khiVanTinhToiDa", "Một khí văn trên nhiều món tính tối đa số lần (1: mỗi khí văn tính 1 lần; giữ cho code rules, sẽ bỏ)", "số"],
  ["luyen_khi.json:luat.khiVanKichToiDa", "Khí văn: mỗi người chọn tối đa số khí văn đang kích (khác nhau, mỗi khí văn tính 1 lần)", "số"],
  ["luyen_khi.json:luat.khiVanTranLucChien", "Tổng mọi khí văn quy đổi không quá lực chiến", "%"],
  ["luyen_khi.json:luat.taoVanLinhVanThach", "Tẩy văn (quay lại 3 lựa chọn): Linh Văn Thạch mỗi lần", "số"],
  // Ngọc Phách, danh khí, Bảo Giám, tế luyện tầng
  ["luyen_khi.json:luat.phachTyLe", "Ngọc Phách: tỷ lệ điểm hóa thành công", "%"],
  ["luyen_khi.json:luat.phachKhiTinh", "Ngọc Phách: Khí Tinh mỗi lần điểm hóa", "số"],
  ["luyen_khi.json:luat.danhKhiVanThiet", "Danh khí: Thiên Ngoại Vẫn Thiết mỗi lần luyện", "số"],
  ["luyen_khi.json:luat.danhKhiKhiTinh", "Danh khí: Khí Tinh mỗi lần luyện", "số"],
  ["luyen_khi.json:luat.danhKhiHoLo", "Danh khí: số thành viên hộ lô cùng tông (thêm 1 Tu rèn chủ lò)", "số"],
  ["luyen_khi.json:luat.danhKhiTyLe.lo9", "Danh khí: tỷ lệ thành ở lò cấp 9", "%"],
  ["luyen_khi.json:luat.danhKhiTyLe.lo10", "Danh khí: tỷ lệ thành ở lò cấp 10", "%"],
  ["luyen_khi.json:luat.danhKhiYHeSo", "Danh khí: Ý của khí hình mạnh gấp Ý châu", "hệ số"],
  ["luyen_khi.json:luat.danhKhiMoiNguoi", "Danh khí: mỗi người mặc tối đa", "số"],
  ["luyen_khi.json:luat.baoGiamTuanLinhVanThach", "Bảo Giám: trang tuần thưởng Linh Văn Thạch", "số"],
  ["luyen_khi.json:luat.teLuyenHoiChieuSan", "Tế luyện tầng: hồi chiêu pháp bảo sau mọi nguồn không dưới", "%"],
];

// ---------- dựng lần đầu từ data/trang_bi ----------

type Row = Record<string, string | number | null>;

/** Giá trị JSON → ô Excel theo kiểu cột (ngược của B.toJson). */
function toCell(col: B.Col, v: unknown, unitCode: unknown): string | number | null {
  if (v === undefined || v === null) return null;
  switch (col.kind) {
    case "list": return (v as string[]).join(", ");
    case "bool": return v ? "có" : "không";
    case "kv": return B.kvText(v as Record<string, unknown>);
    case "unit": return B.unitLabel(String(v));
    case "pct": case "mul": case "cell": return (v as number) / 1000;
    case "sec": return (v as number) / 20;
    case "qty": return typeof unitCode === "string" && unitCode !== "số" ? B.fromCodeUnit(v as number, unitCode) : (v as number);
    default: return v as string | number;
  }
}

/** Dòng Excel cho mọi sheet trang bị, đọc từ data/trang_bi (thư mục `dir`). Không có thư mục thì trả rỗng. */
export function sourceRows(dir: URL): Record<string, Row[]> {
  if (!existsSync(new URL("trang_bi.json", dir))) return {};
  const src: Record<string, Record<string, unknown>> = {};
  for (const f of TB_FILES) if (existsSync(new URL(f, dir))) src[f] = JSON.parse(readFileSync(new URL(f, dir), "utf8"));
  const rowOf = (p: PartDef, item: Record<string, unknown>): Row => {
    const row: Row = {};
    for (const col of p.def.cols) {
      const unit = col.unitCol ? B.getPath(item, String(p.def.cols.find((x) => x.key === col.unitCol)!.json ?? col.unitCol)) : undefined;
      row[col.key] = toCell(col, B.getPath(item, String(col.json ?? col.key)), unit);
    }
    return row;
  };
  const out: Record<string, Row[]> = {};
  for (const p of PARTS) if (p.path && src[p.file]) out[p.def.sheet] = (B.getPath(src[p.file], p.path) as Record<string, unknown>[]).map((it) => rowOf(p, it));
  const moc = part("Set mốc");
  out[moc.def.sheet] = (src["set.json"].bo as { id: string; moc: Record<string, unknown>[] }[])
    .flatMap((b) => b.moc.map((m) => rowOf(moc, { bo: b.id, ...m })));
  const dcb = src["dao_co_ban.json"];
  if (dcb) out["Mạch cộng hưởng"] = Object.entries(dcb.mach as Record<string, string>)
    .map(([quan_he, mach]) => ({ quan_he, mach, ten: MACH_INFO[mach]?.[0] ?? null, mau: MACH_INFO[mach]?.[1] ?? null }));
  out["Luật trang bị"] = LUAT.filter(([khoa]) => src[khoa.split(":")[0]]).map(([khoa, ten, kieu]) => {
    const [f, path] = khoa.split(":");
    const v = B.getPath(src[f], path) as number;
    return { khoa, ten, gia_tri: kieu === "%" ? v / 1000 : v, kieu };
  });
  out["Ghi chú trang bị"] = TB_FILES.filter((f) => src[f]).flatMap((f) => ((src[f].ghi_chu ?? []) as string[]).map((noi_dung, i) => ({ file: f, stt: i + 1, noi_dung })));
  return out;
}

// ---------- ghép JSON ----------

/** Dòng đã đổi sang JSON (theo sheet) → 7 file như data/trang_bi. Thiếu sheet trang bị thì trả rỗng. */
export function assemble(rows: Record<string, Record<string, unknown>[]>): Record<string, unknown> {
  if (!rows["Kiểu trang bị"]) return {};
  const files: Record<string, Record<string, unknown>> = {};
  for (const f of TB_FILES) files[f] = { ghi_chu: [] };
  for (const n of [...rows["Ghi chú trang bị"]].sort((a, b) => (a.stt as number) - (b.stt as number))) {
    const f = files[n.file as string];
    if (!f) throw new Error(`Sheet "Ghi chú trang bị": file lạ ${String(n.file)}`);
    (f.ghi_chu as string[]).push(n.noi_dung as string);
  }
  for (const r of rows["Luật trang bị"]) {
    const [f, path] = String(r.khoa).split(":");
    if (!files[f] || !path) throw new Error(`Sheet "Luật trang bị": khóa lạ ${String(r.khoa)}`);
    B.setPath(files[f], path, r.gia_tri);
  }
  for (const p of PARTS) if (p.path && rows[p.def.sheet]) B.setPath(files[p.file], p.path, rows[p.def.sheet]);
  // Đạo Cơ Bàn: quan hệ tổ hợp → loại mạch
  if (rows["Mạch cộng hưởng"]) files["dao_co_ban.json"].mach = Object.fromEntries(rows["Mạch cộng hưởng"].map((m) => [m.quan_he, m.mach]));
  // File chưa có sheet nào trong Excel (Đạo Cơ Bàn ở file cũ) thì không xuất
  for (const f of TB_FILES) if (!PARTS.some((p) => p.file === f && rows[p.def.sheet])) delete files[f];
  const order = ["id", "ten", "nguon", "chu_de", "gan_voi", "than", "rang_buoc", "moc", "an"];
  files["set.json"].bo = (files["set.json"].bo as Record<string, unknown>[]).map((b) => {
    const moc = rows["Set mốc"].filter((m) => m.bo === b.id).map(({ bo: _, ...m }) => m);
    const full: Record<string, unknown> = { ...b, moc };
    return Object.fromEntries(order.filter((k) => k in full).map((k) => [k, full[k]]));
  });
  for (const [f, keys] of Object.entries(TOP_ORDER)) {
    const o = files[f];
    if (!o) continue;
    files[f] = Object.fromEntries([...keys.filter((k) => k in o), ...Object.keys(o).filter((k) => !keys.includes(k))].map((k) => [k, o[k]]));
  }
  return files;
}

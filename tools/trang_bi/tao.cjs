// Sinh danh mục trang bị, pháp bảo, pháp khí, ngọc, set đồ và vật phẩm phụ (GDD tab "Trang bị, pháp bảo và set đồ").
// Chạy ở thư mục repo: node tools/trang_bi/tao.cjs → ghi data/trang_bi/*.json
// Tên, mã và độ hiếm của 420 kiểu trang bị lấy từ assets/icon_ve/danh_sach.json (phiên icon giữ file đó).
// Đơn vị như data/he_thong: tỷ lệ theo phần nghìn (80 = 8%), thời gian theo tick (20 tick = 1 giây). Mọi số là đề xuất.
const fs = require("fs");
const path = require("path");

const GOC = path.resolve(__dirname, "../..");
const RA = path.join(GOC, "data/trang_bi");
const ICON = require(path.join(GOC, "assets/icon_ve/danh_sach.json")).icon;
const TICK = 20;

// ---------- Độ hiếm và 7 ô trang bị ----------

const DO_HIEM = [
  { id: "luc", ten: "Lục", bac: 1, he_so: 1000, dong_kham: 1, nguon: "Shop NPC ở thành chủ" },
  { id: "lam", ten: "Lam", bac: 2, he_so: 1120, dong_kham: 2, nguon: "Rơi trong và ngoài bí cảnh; rèn ở lò cấp 1–4" },
  { id: "tim", ten: "Tím", bac: 3, he_so: 1250, dong_kham: 2, nguon: "Bí cảnh; rèn ở lò cấp 5 trở lên" },
  { id: "vang", ten: "Vàng", bac: 4, he_so: 1400, dong_kham: 3, nguon: "Thần vật: bí cảnh hiếm, săn linh thú và thần thú" },
  { id: "do", ten: "Đỏ", bac: 5, he_so: 1550, dong_kham: 3, nguon: "Thần vật, hiếm hơn vàng: bí cảnh hiếm, săn linh thú và thần thú" },
];
const HIEM = Object.fromEntries(DO_HIEM.map((d) => [d.id, d]));

// gia_tri: phần nghìn của chỉ số chuẩn nhân vật cùng cấp, ở độ hiếm lục +0. Ngọc "cong" = sát thương hệ, "thu" = kháng hệ.
const O = [
  { id: "vu_khi", ma: "KI", ten: "Vũ khí", chinh: ["atk", "Công lực", 80], phu: ["critDamage", "Sát thương chí mạng", 40], ngoc: "cong", hien_tren_nguoi: true },
  { id: "mu", ma: "MU", ten: "Mũ", chinh: ["hp", "Máu", 40], phu: ["manaMax", "Mana tối đa", 40], ngoc: "thu", hien_tren_nguoi: true },
  { id: "ao", ma: "AO", ten: "Áo", chinh: ["def", "Phòng thủ", 80], phu: ["hp", "Máu", 30], ngoc: "thu", hien_tren_nguoi: true },
  { id: "dai", ma: "DA", ten: "Đai", chinh: ["hp", "Máu", 50], phu: ["healTaken", "Hồi máu nhận", 20], ngoc: "thu", hien_tren_nguoi: false },
  { id: "bao_tay", ma: "BT", ten: "Bao tay", chinh: ["atk", "Công lực", 40], phu: ["critBonus", "Chí mạng", 10], ngoc: "cong", hien_tren_nguoi: false },
  { id: "giay", ma: "GI", ten: "Giày", chinh: ["def", "Phòng thủ", 40], phu: ["attackSpeed", "Tốc đánh", 20], ngoc: "thu", hien_tren_nguoi: false },
  { id: "ngoc_boi", ma: "NB", ten: "Ngọc bội", chinh: ["manaMax", "Mana tối đa", 50], phu: ["cooldownCut", "Giảm hồi chiêu", 10], ngoc: "cong", hien_tren_nguoi: false },
];
const chiSo = ([stat, ten, gia_tri]) => ({ stat, ten, gia_tri });

// Nguyên liệu rèn mỗi ô (đề xuất), số lượng cho một món lam; tím ×2. "quang" là quặng đúng bậc vị diện.
const CONG_THUC_REN = {
  vu_khi: { quang: 10, linh_moc: 2 },
  mu: { quang: 4, yeu_thu_cot: 2 },
  ao: { quang: 6, yeu_thu_bi: 3, thien_tam_ti: 3 },
  dai: { quang: 2, van_cam: 2 },
  bao_tay: { quang: 2, yeu_thu_bi: 2 },
  giay: { quang: 3, yeu_thu_bi: 2 },
  ngoc_boi: { quang: 1, van_cam: 1, ngoc_cap_1: 1 },
};

// ---------- Vũ khí: 10 khí hình gắn 10 loại chiêu (qua Ý châu) ----------

const KHI_HINH = [
  ["kiem", "Kiếm", "can_don", "Kiếm thẳng hai lưỡi, binh khí quen tay của tu sĩ"],
  ["dao", "Đao", "can_quet", "Đao một lưỡi bản rộng, chém quét"],
  ["cung", "Cung", "tam_xa", "Cung và tên, bắn từ hàng sau"],
  ["phien", "Phiến", "dien_rong", "Quạt nan sắt hoặc lông vũ, quạt ra gió lửa một vùng"],
  ["con", "Côn", "ho_the", "Côn dài, thủ thế che thân và che bạn"],
  ["but", "Bút", "bua_chu", "Phù bút vẽ bùa, điểm huyệt"],
  ["ky", "Kỳ", "tran_phap", "Trận kỳ cắm đất bày trận"],
  ["cam", "Cầm", "hoi_phuc", "Đàn cổ, tiếng đàn dưỡng thương"],
  ["tieu", "Tiêu", "khong_che", "Sáo trúc, tiếng tiêu mê hồn trói chân địch"],
  ["thuong", "Thương", "than_phap", "Trường thương, lao tới đâm xuyên"],
];

// Khí hình của 26 kiểu chưa vẽ (lam trở lên), tên đề xuất. Các số khác giữ khí hình kiếm và tên ở danh_sach.json,
// vì phiên icon đã vẽ 34 kiểu kiếm (01–30, 41, 42, 53, 58) tới commit 1c11379.
const KHI_HINH_MOI = {
  31: ["dao", "Đao Hổ Khiếu"], 32: ["thuong", "Thương Ngân Long"], 33: ["con", "Côn Bàn Long"], 34: ["cung", "Cung Hạc Vũ"],
  35: ["phien", "Phiến Thu Thủy"], 36: ["but", "Bút Phán Quan"], 37: ["ky", "Kỳ Ngũ Hành"], 38: ["cam", "Cầm Lưu Thủy"],
  39: ["tieu", "Tiêu Bích Ngọc"], 40: ["dao", "Đao Nguyệt Nha"], 43: ["thuong", "Thương Lôi Minh"], 44: ["con", "Côn Kim Cang"],
  45: ["cung", "Cung Truy Tinh"], 46: ["phien", "Phiến Hàn Băng"], 47: ["but", "Bút Xuân Thu"], 48: ["ky", "Kỳ Thất Tinh"],
  49: ["cam", "Cầm Tiêu Vĩ"], 50: ["tieu", "Tiêu Phượng Minh"], 51: ["dao", "Đao Hàn Nguyệt"], 52: ["thuong", "Thương Truy Phong"],
  54: ["cung", "Cung Xạ Nhật"], 55: ["phien", "Phiến Thái Hư"], 56: ["cam", "Cầm Thiên Lại"], 57: ["ky", "Kỳ Vạn Tượng"],
  59: ["dao", "Đao Phần Thiên"], 60: ["phien", "Phiến Hỗn Độn"],
};

// Ý châu: ngọc đặc biệt chỉ khảm vào vũ khí, đổi hành vi một loại chiêu. Thứ tự như KHI_HINH.
const Y_CHAU = [
  ["Kiếm Ý Châu", "Cận chiến đơn xuyên 15% khiên của mục tiêu", { xuyenKhien: 150 }],
  ["Đao Ý Châu", "Cận chiến quét trúng thêm 1 mục tiêu (5 thành 6); mục tiêu thêm nhận 50% sát thương", { themMucTieu: 1, heSoMucTieuThem: 500 }],
  ["Cung Ý Châu", "Tầm xa +1 ô; không cộng dồn với tầm +1 ô của Âm lãnh (mỗi công pháp tối đa +1 ô)", { tamMilliO: 1000 }],
  ["Phiến Ý Châu", "Diện rộng vận công 0,7 s thay 1 s", { vanCongTicks: 14 }],
  ["Côn Ý Châu", "Hộ thể đặt khiên lên đồng đội đang bị nhiều kẻ địch nhắm nhất thay vì đồng đội gần nhất", { chonMucTieu: "bi_nham_nhieu_nhat" }],
  ["Bút Ý Châu", "Lần Bùa chú đầu tiên mỗi trận nhắm kẻ địch máu thấp nhất", { chonMucTieu: "mau_thap_nhat", soLan: 1 }],
  ["Kỳ Ý Châu", "Trận pháp bày trong 4,5 s thay 5 s", { bayTranTicks: 90 }],
  ["Cầm Ý Châu", "Hồi phục chọn đồng đội máu thấp nhất trước; tốn mana ×2,7 thay ×3", { chonMucTieu: "mau_thap_nhat", heSoMana: 2700 }],
  ["Tiêu Ý Châu", "Khống chế ưu tiên kẻ địch đang vận công (diện rộng, trận pháp)", { chonMucTieu: "dang_van_cong" }],
  ["Thương Ý Châu", "Thân pháp lướt tới kẻ địch hàng sau có máu thấp nhất", { chonMucTieu: "hang_sau_mau_thap_nhat" }],
];

// ---------- Dáng của 6 ô còn lại (chỉ là hình, không mang chỉ số) ----------

const DANG = {
  mu: [
    ["Ô Sa", "o_sa", "Ô sa: mũ cánh chuồn của văn sĩ"], ["Đấu Lạp", "non", "Nón: nón lá, nón tre, đấu lạp"], ["Nón", "non", null],
    ["Khăn", "khan", "Khăn: khăn vấn, khăn chít đầu"], ["Khôi", "khoi", "Khôi: mũ giáp kim loại của võ tướng"],
    ["Đạo Mạo", "mao", "Mạo: mũ mềm của nho sinh, đạo sĩ"], ["Mạo", "mao", null], ["Mũ", "mu", "Mũ: mũ da, mũ lông, mũ vải"],
  ],
  ao: [["Giáp", "giap", "Giáp: giáp da, giáp vảy, giáp phiến cho người đứng trước"]],
  bao_tay: [
    ["Găng", "gang", "Găng: găng da, găng vải"], ["Hộ Uyển", "ho_uyen", "Hộ uyển: bao cổ tay"], ["Băng Tay", "ho_uyen", null],
    ["Thủ Sáo", "thu_sao", "Thủ sáo: bao tay lụa, bao tay vải mỏng"], ["Hộ Thủ", "ho_thu", "Hộ thủ: bao tay giáp kim loại"],
  ],
  giay: [["Ngoa", "ngoa", "Ngoa: ủng cao cổ"], ["Hài", "hai", "Hài: giày vải, giày gấm mũi cong"]],
};
const DANG_MAC_DINH = {
  mu: ["quan", "Quan: mũ quan, phát quan, trâm cài của đạo sĩ và tiên nhân"],
  ao: ["bao", "Bào: đạo bào, pháp y, sam vải lụa cho người đứng sau"],
  dai: ["dai", "Đai lưng: da, vải, ngọc khấu"],
  bao_tay: ["gang", null],
  giay: ["giay", "Giày: giày vải, guốc, dép"],
  ngoc_boi: ["boi", "Ngọc bội đeo hông: đá, ngọc, gỗ, đồng"],
};
const MO_TA_DANG = {};
for (const [o, ds] of Object.entries(DANG)) for (const [, id, mt] of ds) if (mt) MO_TA_DANG[`${o}/${id}`] = mt;
for (const [o, [id, mt]] of Object.entries(DANG_MAC_DINH)) if (mt) MO_TA_DANG[`${o}/${id}`] = mt;

function dangCua(o, ten) {
  for (const [tien_to, id] of DANG[o] || []) if (ten.startsWith(tien_to)) return id;
  return DANG_MAC_DINH[o][0];
}

// ---------- Nguồn rơi theo bí cảnh (mục 11) ----------

const NGUON_TB = {
  luc: ["shop_npc"],
  lam: ["co_chien_truong", "roi_ngoai_bi_canh", "ren_lo_1_4"],
  tim: ["luyen_khi_di_chi", "ren_lo_5_tro_len"],
  vang: ["tien_nhan_dong_phu", "thuong_co_chien_truong", "hon_don_bi_canh", "san_linh_thu", "san_than_thu"],
  do: ["thuong_co_chien_truong", "hon_don_bi_canh", "san_linh_thu", "san_than_thu"],
};

// ---------- Ghép 420 kiểu trang bị ----------

const O_THEO_MA = Object.fromEntries(O.map((o) => [o.ma, o]));
const kieu = [];
for (const m of ICON) {
  if (!m.ma_vp.startsWith("TB-")) continue;
  const o = O_THEO_MA[m.ma_vp.split("-")[1]];
  const so = Number(m.ma_vp.split("-")[2]);
  const k = { ma_vp: m.ma_vp, o: o.id, so, ten: m.ten, do_hiem: m.do_hiem };
  if (o.id === "vu_khi") {
    const [kh, ten] = KHI_HINH_MOI[so] || ["kiem", m.ten];
    const khi = KHI_HINH.find((x) => x[0] === kh);
    k.khi_hinh = kh;
    if (ten !== m.ten) k.ten_de_xuat = ten;
    k.mo_ta = khi[3];
  } else {
    k.dang = dangCua(o.id, m.ten);
    k.mo_ta = MO_TA_DANG[`${o.id}/${k.dang}`];
  }
  k.nguon = [...NGUON_TB[m.do_hiem]];
  if (o.id === "vu_khi" && m.do_hiem === "tim") k.nguon.unshift("van_kiem_trung");
  kieu.push(k);
}

const trangBi = {
  ghi_chu: [
    "7 ô trang bị (GDD mục 6, 12). Kiểu chỉ đổi hình và tên; chỉ số gốc theo ô và độ hiếm; hệ và thuộc tính đến từ ngọc khảm (người dùng chốt 2026-11-03).",
    "chinh, phu: gia_tri là phần nghìn của chỉ số chuẩn nhân vật cùng cấp ở độ hiếm lục +0. Món độ hiếm khác nhân he_so của độ hiếm; cường hóa mỗi nấc +3% chỉ số gốc; đồ bí cảnh +4–8% (chốt).",
    "dong_kham: số dòng khảm gốc theo độ hiếm; đồ bí cảnh thêm 1–2 dòng (chốt), tối đa 5. Một dòng giữ được 1 ngọc hệ, 1 Ý châu (chỉ vũ khí) hoặc 1 ấn bộ.",
    "ngoc: 'cong' = ngọc khảm vào ô này tăng sát thương chiêu cùng hệ; 'thu' = tăng kháng hệ đó (resist trong packages/sim).",
    "Trần: trang bị, ngọc, cường hóa và set cộng lại không quá khoảng 35% lực chiến (mục 13). Phiên Sprint chỉnh số tuyệt đối bằng công cụ cân bằng; ở đây chỉ là tỷ lệ giữa các ô.",
  ],
  do_hiem: DO_HIEM,
  o: O.map((o) => ({ ...o, chinh: chiSo(o.chinh), phu: chiSo(o.phu), cong_thuc_ren: CONG_THUC_REN[o.id] })),
  kieu,
};

const vuKhi = {
  ghi_chu: [
    "Trả lời câu hỏi mục 20 (đề xuất): vũ khí vẫn là một loại khi rơi, rèn và bán. 60 kiểu chia 10 khí hình để icon và tên trong túi đa dạng; cầm lên vẫn hiện nhóm vũ khí theo tài năng (đã chốt ở mục 6).",
    "Khí hình không mang chỉ số. Mối nối với 10 loại chiêu nằm ở Ý châu (ngọc đặc biệt, chỉ khảm vào vũ khí). Ý châu trùng khí hình thì món phát sáng theo màu ý châu, chỉ là hình.",
    "34 kiểu đã vẽ (01–30, 41, 42, 53, 58) giữ khí hình kiếm. ten_de_xuat ở trang_bi.json là tên mới cho 26 kiểu lam trở lên chưa vẽ, chia cho 9 khí hình còn lại; chờ người dùng duyệt rồi phiên icon cập nhật trang_bi_ten.cjs và danh_sach.json. Mã TB-KI giữ nguyên.",
  ],
  khi_hinh: KHI_HINH.map(([id, ten, loai_chieu, mo_ta], i) => ({
    id, ten, loai_chieu, mo_ta, y_chau: `NG-YC-${String(i + 1).padStart(3, "0")}`,
    so_kieu: kieu.filter((k) => k.khi_hinh === id).length,
  })),
  hinh_khi_cam: [
    ["tu_the", "Quyền giáp", "VK-TN-001"], ["tu_phap", "Pháp trượng", "VK-TN-002"], ["tu_tran", "Trận bàn", "VK-TN-003"],
    ["tu_dan", "Hồ lô", "VK-TN-004"], ["sat_thu", "Song chủy thủ", "VK-TN-005"], ["tu_ren", "Búa rèn", "VK-TN-006"],
    ["tu_duoc", "Liềm hái thuốc", "VK-TN-007"], ["tu_kim_tien", "Bàn tính", "VK-TN-008"],
  ].map(([tai_nang, ten, ma_vp]) => ({ tai_nang, ten, ma_vp })),
};

// ---------- Ngọc: 12 hệ, Ý châu, ấn bộ ----------

const HE = [
  ["kim", "Kim", "Canh Kim Thạch"], ["moc", "Mộc", "Thanh Mộc Tinh"], ["thuy", "Thủy", "Huyền Thủy Châu"],
  ["hoa", "Hỏa", "Xích Diễm Thạch"], ["tho", "Thổ", "Hậu Thổ Tinh"], ["loi", "Lôi", "Tử Lôi Tinh"],
  ["phong", "Phong", "Thanh Phong Ngọc"], ["quang", "Quang", "Diệu Quang Thạch"], ["am_lanh", "Âm lãnh", "U Lãnh Ngọc"],
  ["cuc_duong", "Cực dương", "Thuần Dương Tinh"], ["cuc_am", "Cực âm", "Huyền Âm Tinh"], ["cuc_han", "Cực hàn", "Hàn Tủy Ngọc"],
];
const NGUON_NGOC_RIENG = { thuy: ["bang_phach_cung"], cuc_han: ["bang_phach_cung"], loi: ["loi_tri"], kim: ["loi_tri"] };
const CAP_NGOC = Array.from({ length: 10 }, (_, i) => {
  const k = i + 1;
  return { cap: k, gia_tri: (25 * k * (k + 1)) / 10, ty_le_nen_len: [null, 1000, 900, 800, 650, 500, 350, 200, 100, 50][i], khoa: k >= 7 };
});

const SET = require("./set.cjs");

const ngoc = {
  ghi_chu: [
    "12 hệ cấp 1–10 (chốt). gia_tri: phần nghìn, = 0,25 × k × (k + 1)% (mục 12, đề xuất). Khảm trùng hệ linh căn hiệu quả +20%.",
    "Ô 'cong' (vũ khí, bao tay, ngọc bội): tăng sát thương chiêu có hệ chủ là hệ ngọc. Ô 'thu' (mũ, áo, đai, giày): kháng hệ ngọc, trần kháng 80% (RESIST_CAP).",
    "Nén 3 viên cùng hệ cùng cấp lên 1 viên cấp trên; ty_le_nen_len là tỷ lệ đậu khi nén lên cấp đó (đề xuất). Ngọc từ cấp 7 khóa vào nhân vật (chốt mục 13).",
    "Cấp là thuộc tính của từng viên, không nằm trong mã. Mã NG-KH giữ như danh_sach.json; ten_han_viet là tên hiện trong tooltip (đề xuất).",
  ],
  he: HE.map(([id, ten, ten_han_viet], i) => ({
    ma_vp: `NG-KH-${String(i + 1).padStart(3, "0")}`, he: id, ten: `Ngọc ${ten}`, ten_han_viet,
    nguon: ["ngoc_tuy_dong", ...(NGUON_NGOC_RIENG[id] || []), "roi_bi_canh_cap_1_3", "nen_ngoc"],
  })),
  cap: CAP_NGOC,
  y_chau: Y_CHAU.map(([ten, mo_ta, tham_so], i) => ({
    ma_vp: `NG-YC-${String(i + 1).padStart(3, "0")}`, ten, khi_hinh: KHI_HINH[i][0], loai_chieu: KHI_HINH[i][2],
    chi_kham_vao: "vu_khi", mo_ta, tham_so, ban_cho: true,
    nguon: i < 3 || i === 9 ? ["van_kiem_trung", "luyen_khi_di_chi"] : ["tang_kinh_dong", "luyen_khi_di_chi"],
  })),
  an_bo: SET.bo.map((b) => ({
    ma_vp: b.an, ten: `Ấn ${b.ten}`, bo: b.id, ban_cho: !b.than, nguon: [b.nguon, "doi_cong_hien_khi_tong_giu_bi_canh"],
  })),
};

// ---------- Pháp bảo ----------

// [mã loại, id, tên, loại chiêu khắc, điều kiện kích hoạt, hiệu ứng, tên chỉ số chính, giá trị theo 5 độ hiếm, đơn vị, số lần gốc, hồi chiêu (s), 5 món]
const PHAP_BAO = [
  ["TH", "thuan", "Thuẫn", "can_don", "Đồng đội hàng trước sắp trúng đòn Cận chiến đơn chí mạng", "Chặn một phần sát thương đòn đó",
    "Chặn", [500, 550, 600, 650, 700], "phan_nghin", 2, 8, ["Đằng Giáp Thuẫn", "Huyền Thiết Thuẫn", "Huyền Quy Thuẫn", "Thái Sơn Thuẫn", "Bàn Cổ Thuẫn"]],
  ["LU", "luan", "Luân", "can_quet", "Từ 3 kẻ địch cận chiến trở lên đứng sát chủ nhân", "Đẩy lùi các kẻ đó và cắt chiêu quét đang ra",
    "Đẩy lùi", [1, 1, 1, 2, 2], "o", 1, 10, ["Mộc Phong Luân", "Thiết Phong Luân", "Phong Hỏa Luân", "Càn Khôn Luân", "Nhật Nguyệt Luân"]],
  ["CH", "chau", "Châu", "tam_xa", "Hàng sau trúng đòn Tầm xa đầu tiên", "2 đòn Tầm xa kế tiếp vào hàng sau giảm sát thương",
    "Giảm", [400, 450, 500, 550, 600], "phan_nghin", 2, 6, ["Hộ Tâm Châu", "Định Phong Châu", "Tử Kim Châu", "Định Hải Châu", "Hỗn Nguyên Châu"]],
  ["TA", "thap", "Tháp", "dien_rong", "Kẻ địch bắt đầu vận công chiêu Diện rộng", "Che 3 đồng đội gần nhất trước chiêu đó",
    "Giảm", [350, 390, 430, 470, 510], "phan_nghin", 2, 8, ["Thanh Thạch Tháp", "Trấn Yêu Tháp", "Trấn Ma Tháp", "Linh Lung Bảo Tháp", "Cửu Tầng Thông Thiên Tháp"]],
  ["HL", "ho_lo", "Hồ lô", "ho_the", "Kẻ địch trong tầm vừa nhận khiên Hộ thể", "Thu một phần khiên đó về làm khiên của chủ nhân",
    "Thu", [500, 550, 600, 650, 700], "phan_nghin", 2, 8, ["Tửu Hồ Lô", "Ngọc Tịnh Hồ Lô", "Thu Linh Hồ Lô", "Càn Khôn Hồ Lô", "Thôn Thiên Hồ Lô"]],
  ["KN", "kinh", "Kính", "bua_chu", "Chủ nhân hoặc đồng đội kề bên trúng Bùa chú", "Phản một phần sát thương bùa chú về người thi triển",
    "Phản", [300, 340, 380, 420, 460], "phan_nghin", 2, 6, ["Đồng Kính", "Chiếu Yêu Kính", "Bát Quái Kính", "Côn Lôn Kính", "Âm Dương Kính"]],
  ["PN", "phien_co", "Phiên", "tran_phap", "Kẻ địch bày xong Trận pháp", "Trận đó ngắn lại; đồng đội đầu tiên bước vào không bị tuyệt sát",
    "Rút ngắn", [400, 440, 480, 520, 560], "phan_nghin", 1, 20, ["Thanh Bố Phiên", "Ngũ Hành Phiên", "Tụ Linh Phiên", "Thất Tinh Phiên", "Hỗn Thiên Phiên"]],
  ["DI", "dinh", "Đỉnh", "hoi_phuc", "Kẻ địch hồi cho một mục tiêu từ 15% máu tối đa trở lên", "Luyện hóa một phần lượng hồi đó",
    "Luyện hóa", [400, 440, 480, 520, 560], "phan_nghin", 2, 8, ["Thanh Đồng Đỉnh", "Tam Túc Đỉnh", "Cửu Long Đỉnh", "Thần Nông Đỉnh", "Cửu Châu Đỉnh"]],
  ["CU", "chuong", "Chuông", "khong_che", "Từ 2 đồng đội trở lên đang bị Khống chế", "Giải khống chế cả đội, rồi miễn khống chế một lúc",
    "Miễn khống chế", [20, 24, 28, 32, 36], "tick", 1, 12, ["Đồng Linh", "Thanh Âm Chung", "Tỉnh Thần Chung", "Thái Cổ Chung", "Thái Nhất Chung"]],
  ["AN", "an", "Ấn", "than_phap", "Kẻ địch dùng Thân pháp lướt vào hàng sau", "Đập ấn choáng kẻ đó; đòn lướt giảm 50% sát thương",
    "Choáng", [20, 22, 24, 28, 30], "tick", 2, 8, ["Thạch Ấn", "Trấn Sơn Ấn", "Lôi Công Ấn", "Phiên Thiên Ấn", "Thiên Đế Ấn"]],
];
const LINH_LUC = [20, 25, 30, 40, 50];
const NGUON_PB = [
  ["ren_luyen_khi_cac", "cho"],
  ["ren_luyen_khi_cac", "roi_bi_canh"],
  ["co_tong_di_tich", "tu_ren_ren"],
  ["co_tong_di_tich", "tien_nhan_dong_phu"],
  ["hon_don_bi_canh", "thuong_co_chien_truong", "san_than_thu"],
];

const phapBao = {
  ghi_chu: [
    "Pháp bảo khác trang bị: nằm ở ô pháp bảo riêng (1 ô ở Hạ vị, 2 ô từ Trung vị), không cộng chỉ số, không tính vào set; trong trận tự kích hoạt khi gặp điều kiện, có số lần mỗi trận và hồi chiêu.",
    "Mỗi loại khắc một loại chiêu của địch, nên chọn pháp bảo là đọc đội hình đối phương (trụ cột Trí hơn lực).",
    "Linh lực thay độ bền: mỗi lần kích hoạt tốn 1, hết thì không kích hoạt; nạp lại bằng linh thạch ở Luyện Khí Các. Không bị giảm linh lực tối đa như sửa đồ.",
    "Tế luyện (nhận chủ) trước khi dùng: tốn linh thạch và 1 giờ; đã tế luyện thì khóa vào nhân vật. Chưa tế luyện bán được trên chợ (lục–tím).",
    "Vàng, đỏ thêm 1 lần kích hoạt mỗi trận. Pháp bảo do chính mình rèn (Tu rèn) +10% chỉ số chính (mục 6). Tím trở lên chỉ Tu rèn rèn được.",
    "Thăng vị diện giữ nguyên pháp bảo (mục 7).",
  ],
  o: { ha_vi: 1, trung_vi_tro_len: 2 },
  loai: PHAP_BAO.map(([ma, id, ten, khac, kich_hoat, hieu_ung, ten_chinh, gt, don_vi, lan, hc]) => ({
    ma, id, ten, khac_loai_chieu: khac, kich_hoat, hieu_ung, chinh: { ten: ten_chinh, don_vi, theo_do_hiem: gt },
    so_lan_moi_tran: lan, hoi_chieu_ticks: hc * TICK,
  })),
  mon: PHAP_BAO.flatMap(([ma, id, , , , hieu_ung, ten_chinh, gt, don_vi, lan, hc, ten]) =>
    DO_HIEM.map((d, i) => ({
      ma_vp: `PB-${ma}-${String(i + 1).padStart(3, "0")}`, ten: ten[i], loai: id, do_hiem: d.id,
      chinh: { ten: ten_chinh, gia_tri: gt[i], don_vi },
      phu: { so_lan_moi_tran: lan + (i >= 3 ? 1 : 0), hoi_chieu_ticks: hc * TICK, linh_luc_toi_da: LINH_LUC[i] },
      mo_ta: hieu_ung, nguon: NGUON_PB[i], khoa: i >= 3,
    }))),
  tran_giao: [
    ["Trấn Giáo Lệnh Bài", "Máu hộ trận Chính Điện ×2"],
    ["Tứ Tượng Trấn Giáo Kỳ", "Máu hộ trận Chính Điện ×2; mỗi đợt công bị đẩy lui thì hộ trận hồi 5% máu"],
    ["Thông Thiên Trấn Giáo Tháp", "Máu hộ trận Chính Điện ×2; bên công thành tính như chênh thêm 5 cấp khi phá trận"],
    ["Thái Cổ Trấn Giáo Đỉnh", "Máu hộ trận Chính Điện ×2; khiên hộ tông sau diệt môn dài 4 ngày thay 3"],
  ].map(([ten, mo_ta], i) => ({
    ma_vp: `PB-TG-${String(i + 1).padStart(3, "0")}`, ten, mo_ta, cap: "tong_mon", dat_o: "chinh_dien",
    nguon: ["thuong_tien_thanh_chu", "ghep_10_MA-PB-001"], ghi_chu: "Diệt môn khi có pháp bảo trấn giáo: theo bảng đã chốt ở mục 10",
  })),
};

// ---------- Pháp khí: công cụ ngoài trận ----------

const PHAP_KHI = [
  ["CU", "Cuốc", "tu_the", "Khai khoáng thủ công", [20, 30, 40], ["Thiết Cuốc", "Huyền Thiết Cuốc", "Khai Sơn Thần Cuốc"]],
  ["LB", "La bàn", "tu_phap", "Cơ hội gặp tài bảo trên chặng đang đi", [50, 80, 120], ["Đồng La Bàn", "Tầm Bảo La Bàn", "Thiên Cơ La Bàn"]],
  ["TB", "Trận bàn", "tu_tran", "Tốc độ xây và sửa trận nhãn, Truyền Tống Trận", [30, 50, 70], ["Mộc Trận Bàn", "Ngọc Trận Bàn", "Tinh Đấu Trận Bàn"]],
  ["QP", "Quạt lửa", "tu_dan", "Tỷ lệ luyện đan thành công", [10, 20, 30], ["Bồ Phiến", "Khống Hỏa Phiến", "Tam Muội Hỏa Phiến"]],
  ["AT", "Ngọc ẩn tức", "sat_thu", "Giảm cơ hội gặp sự kiện xấu khi hành trình", [50, 80, 120], ["Ẩn Tức Thạch", "Ẩn Tức Ngọc", "Vô Ảnh Ngọc"]],
  ["CR", "Chùy rèn", "tu_ren", "Giảm quặng tốn khi rèn và giá sửa đồ", [20, 30, 50], ["Thiết Chùy", "Huyền Thiết Chùy", "Bách Luyện Chùy"]],
  ["LI", "Liềm", "tu_duoc", "Sản lượng thu tay ở mỏ dược", [20, 30, 40], ["Thiết Liêm", "Thải Dược Liêm", "Ngọc Cốt Liêm"]],
  ["BA", "Bàn tính", "tu_kim_tien", "Lợi nhuận bán trên chợ", [10, 20, 30], ["Mộc Bàn Tính", "Kim Châu Bàn Tính", "Thông Bảo Bàn Tính"]],
];
const phapKhi = {
  ghi_chu: [
    "Pháp khí là công cụ ngoài trận, nằm ở ô pháp khí riêng (1 ô). Không có tác dụng trong trận, không tính vào set, không có độ bền.",
    "Ai cũng dùng được; người có đúng tài năng nhận gấp đôi. Chỉ có lục, lam, tím; bán được trên chợ.",
    "Trần kinh tế từ đồ: pháp khí cộng hiệu ứng kinh tế của set không quá +10% mỗi loại sản lượng hay tỷ lệ; tỷ lệ luyện đan tính chung trần +15% của phù (mục 13).",
    "Hình pháp khí dùng lại hình vũ khí theo tài năng (VK-TN) khi trùng: trận bàn, búa rèn, liềm, bàn tính.",
  ],
  o: 1,
  mon: PHAP_KHI.flatMap(([ma, loai, tai_nang, hieu_ung, gt, ten]) =>
    ten.map((t, i) => ({
      ma_vp: `PK-${ma}-${String(i + 1).padStart(3, "0")}`, ten: t, loai, do_hiem: DO_HIEM[i].id, tai_nang_hop: tai_nang,
      chinh: { ten: hieu_ung, gia_tri: gt[i], don_vi: "phan_nghin" }, phu: { dung_tai_nang: "×2" },
      nguon: i === 0 ? ["shop_npc"] : i === 1 ? ["ren_luyen_khi_cac", "cho"] : ["ren_lo_5_tro_len", "bi_canh_the_manh_cung_nghe"],
    }))),
};

// ---------- Phù, đan, nguyên liệu ----------

const KHAC = require("./vat_pham.cjs");

// ---------- Ghi file ----------

fs.mkdirSync(RA, { recursive: true });
const ghi = (ten, obj) => fs.writeFileSync(path.join(RA, ten), JSON.stringify(obj, null, 1) + "\n");
ghi("trang_bi.json", trangBi);
ghi("vu_khi.json", vuKhi);
ghi("ngoc.json", ngoc);
ghi("phap_bao.json", phapBao);
ghi("phap_khi.json", phapKhi);
ghi("set.json", SET);
ghi("vat_pham.json", KHAC);

// Phép kiểm nhỏ
const loi = [];
const maDaCo = new Set();
const tatCaMa = [
  ...kieu.map((k) => k.ma_vp), ...ngoc.y_chau.map((x) => x.ma_vp), ...ngoc.an_bo.map((x) => x.ma_vp),
  ...phapBao.mon.map((x) => x.ma_vp), ...phapBao.tran_giao.map((x) => x.ma_vp), ...phapKhi.mon.map((x) => x.ma_vp),
  ...KHAC.phu.map((x) => x.ma_vp), ...KHAC.dan.map((x) => x.ma_vp), ...KHAC.nguyen_lieu.map((x) => x.ma_vp),
];
for (const m of tatCaMa) { if (maDaCo.has(m)) loi.push("Trùng mã " + m); maDaCo.add(m); }
const tenVK = new Set();
for (const k of kieu.filter((k) => k.o === "vu_khi")) { const t = k.ten_de_xuat || k.ten; if (tenVK.has(t)) loi.push("Trùng tên vũ khí " + t); tenVK.add(t); }
if (kieu.length !== 420) loi.push("Số kiểu trang bị " + kieu.length);
for (const b of SET.bo) if (b.moc.length !== 3) loi.push("Bộ thiếu mốc " + b.id);
const dem = (nhom) => KHAC.dan.filter((d) => d.ma_vp.startsWith(nhom)).length;
if (dem("DA-DD") !== 50 || dem("DA-LD") !== 40 || dem("DA-TD") !== 30) loi.push(`Số đan ${dem("DA-DD")}/${dem("DA-LD")}/${dem("DA-TD")}`);
console.log(`Kiểu trang bị ${kieu.length}, đổi tên vũ khí ${kieu.filter((k) => k.ten_de_xuat).length}, pháp bảo ${phapBao.mon.length}+${phapBao.tran_giao.length}, pháp khí ${phapKhi.mon.length}, ý châu ${ngoc.y_chau.length}, bộ ${SET.bo.length}, phù ${KHAC.phu.length}, đan ${KHAC.dan.length}, nguyên liệu ${KHAC.nguyen_lieu.length}, mã ${tatCaMa.length}`);
if (loi.length) { console.error(loi.join("\n")); process.exit(1); }

// Phù, đan và nguyên liệu rèn. Dùng trong tools/trang_bi/tao.cjs.
// Mã cũ (DA-DD-001…, PH-CH-001…, QU-BA-001…) giữ như assets/icon_ve/danh_sach.json; ten_icon là tên đang dùng ở đó.
// Mọi số là đề xuất; đan dược tính ở cấp 1, mỗi cấp trên +25% hiệu quả.

const so = (n) => String(n).padStart(3, "0");
const HE = ["Kim", "Mộc", "Thủy", "Hỏa", "Thổ", "Lôi", "Phong", "Quang", "Âm lãnh", "Cực dương", "Cực âm", "Cực hàn"];

// ---------- Phù ----------

const phu = [
  ["Tị Lôi Phù", "phù chống sét", "Đỡ một phần lôi kiếp khi đột phá, thú kiếp, hộ pháp phi thăng", ["thien_loi_dai", "cho"]],
  ["Bảo Ngọc Phù", "phù bảo ngọc", "Nén ngọc thất bại không mất ngọc", ["cho"]],
  ["Bảo Hộ Phù", "phù bảo hộ", "Cường hóa từ +21 thất bại giữ nguyên nấc", ["cho"]],
  ["Tăng Thành Phù", "phù tăng thành", "Cường hóa hoặc nén ngọc +5%, +10%, +15% theo phẩm; tổng từ phù tối đa +15%", ["cho"]],
  ["Hộ Thân Phù", "phù hộ thân", "Giảm xác suất gặp sự kiện trên đường (mục 3)", ["cho", "nhiem_vu"]],
  ["Độn Thổ Phù", "phù độn thổ", "Đưa về thành chủ ngay (mục 3)", ["cho", "nhiem_vu"]],
  ["Ngự Thú Phù", "Ngự Thú Phù", "Thuần phục +5%, +10%, +15% theo phẩm, chung trần +15% (mục 6)", ["cho"]],
  ["Thoát Khảm Phù", null, "Gỡ ngọc, Ý châu hoặc ấn bộ khỏi món mà vật gỡ ra còn nguyên", ["cho"]],
  ["Di Hồn Phù", null, "Chuyển nấc cường hóa sang món khác cùng ô, giữ 70% số nấc, tối đa +20", ["cho", "luyen_khi_di_chi"]],
  ["Hộ Khí Phù", null, "Lần chết kế tiếp, đồ đang mặc không mất độ bền", ["cho"]],
].map(([ten, ten_icon, mo_ta, nguon], i) => ({ ma_vp: `PH-CH-${so(i + 1)}`, ten, ...(ten_icon && ten_icon !== ten ? { ten_icon } : {}), mo_ta, nguon, moi: i >= 7 }));

// ---------- Đan ----------

const NGUON_DAN_CO_BAN = ["luyen_dan", "cho_npc"];
const NGUON_DAN = ["luyen_dan", "dan_phuong_dan_tien_dong_phu"];

const danDuoc = [
  ["Bổ Huyết Đan", "Đan dược hồi máu (Bổ Huyết Đan)", "Máu dưới 40% thì tự hồi 15% máu; dùng được giữa các chặng hành trình", NGUON_DAN_CO_BAN],
  ["Hồi Khí Đan", "Đan dược hồi mana (Hồi Khí Đan)", "Mana dưới 20% thì tự hồi 20% mana", NGUON_DAN_CO_BAN],
  ["Đại Lực Đan", "Đan dược tăng chỉ số tạm thời", "Công lực +5% trong 1 trận", NGUON_DAN_CO_BAN],
  ["Giải Độc Đan", "Đan dược giải độc", "Giải thiêu đốt và sát thương theo thời gian 1 lần", NGUON_DAN_CO_BAN],
  ["Hồi Xuân Đan", null, "Hồi 3% máu mỗi 2 s trong 10 s đầu trận"],
  ["Đại Hoàn Đan", null, "Máu dưới 25% thì tự hồi 30% máu"],
  ["Ngưng Khí Đan", null, "Mana tối đa +8% trong 1 trận"],
  ["Bổ Nguyên Đan", null, "Mana cạn thì tự hồi 40% mana"],
  ["Thiết Bì Đan", null, "Phòng thủ +6% trong 1 trận"],
  ["Bồi Nguyên Đan", null, "Máu tối đa +6% trong 1 trận"],
  ["Ưng Nhãn Đan", null, "Chí mạng +3% trong 1 trận"],
  ["Bạo Huyết Đan", null, "Sát thương chí mạng +8% trong 1 trận"],
  ["Tật Phong Đan", null, "Tốc đánh +4% trong 1 trận"],
  ["Thanh Tâm Đan", null, "Giải khống chế 1 lần"],
  ["Định Thần Đan", null, "Thời gian bị khống chế −20% trong 1 trận"],
  ...HE.map((h, i) => [`Tị ${["Kim", "Mộc", "Thủy", "Hỏa", "Thổ", "Lôi", "Phong", "Quang", "U", "Dương", "Âm", "Hàn"][i]} Đan`, null, `Kháng ${h} +5% trong 1 trận`]),
  ["Hộ Tâm Đan", null, "Vào trận có khiên bằng 8% máu tối đa"],
  ["Tục Mệnh Đan", null, "Máu dưới 10% thì hồi 20% máu, 1 lần"],
  ["Phá Giáp Đan", null, "Xuyên giáp +4% trong 1 trận"],
  ["Xuyên Linh Đan", null, "Xuyên kháng +4% trong 1 trận"],
  ["Hấp Huyết Đan", null, "Hút máu +2% trong 1 trận"],
  ["Ngự Phong Đan", null, "Giảm hồi chiêu 4% trong 1 trận"],
  ["Thanh Lương Đan", null, "Thiêu đốt nhận −30% trong 1 trận"],
  ["Ôn Dương Đan", null, "Làm chậm và đóng băng nhận −30% trong 1 trận"],
  ["Khu Tà Đan", null, "Hiệu ứng giảm hồi máu nhận −30% trong 1 trận"],
  ["Trấn Hồn Đan", null, "Tỷ lệ bị tuyệt sát −50% trong 1 trận"],
  ["Bất Hoại Đan", null, "Sát thương nhận −10% trong 5 s đầu trận"],
  ["Phấn Chiến Đan", null, "Sát thương +4% khi máu dưới 50%"],
  ["Cuồng Bạo Đan", null, "Sát thương +8% nhưng phòng thủ −8% trong 1 trận"],
  ["Quy Tức Đan", null, "Hồi mana +15% nhưng tốc đánh −5% trong 1 trận"],
  ["Hồi Thiên Đan", null, "Hồi 10% máu cả đội 1 lần; chỉ Tu đan luyện được"],
  ["Hóa Ứ Đan", null, "Chết trong trận kế tiếp thì đồ mất độ bền ít hơn một nửa"],
  ["Hành Cước Đan", null, "Tốc độ hành trình +10% trong 1 giờ"],
  ["Linh Giác Đan", null, "Thấy trước sự kiện trên chặng kế tiếp trước khi đi, trong 1 giờ"],
  ["Khai Sơn Đan", null, "Khai khoáng thủ công +5% trong 1 giờ"],
  ["Linh Mục Đan", null, "Cơ hội thấy dược liệu hiếm +5% trong 1 giờ"],
  ["Ngưng Hỏa Đan", null, "Lần rèn kế tiếp +2% thành công (chung trần +15% của phù)"],
  ["Tiếp Cốt Đan", null, "Đệ tử NPC bị thương hồi sớm 2 giờ"],
  ["Mê Hồn Đan", null, "Thuần phục dị thú +3% (chung trần +15% với Ngự Thú Phù)"],
];

const linhDan = [
  ["Liệu Thương Đan", "Linh đan trị thương", "Hết trạng thái bị thương của bản thân ngay sau trận thua"],
  ["Tụ Nguyên Đan", "Linh đan tăng kinh nghiệm", "Kinh nghiệm +20% trong 1 giờ; tối đa 3 viên mỗi ngày (mục 13)"],
  ["Tụ Linh Đan", "Linh đan tăng tốc tu luyện (Tụ Linh Đan)", "Tốc độ tu luyện +20% trong 8 giờ"],
  ["Tục Cốt Đan", null, "Đệ tử NPC hoặc NPC chiến bị thương hồi sớm 4 giờ"],
  ["Sinh Cơ Đan", null, "Hồi phục sau tử vong khi hành trình nhanh gấp đôi"],
  ["Cố Bản Đan", null, "Miễn bị thương nặng 1 lần trong 24 giờ"],
  ["Hộ Mạch Đan", null, "NPC chiến không bị thương sau 1 trận"],
  ["Dưỡng Hồn Đan", null, "Thú bị thương hồi phục nhanh hơn 50%"],
  ...["Luyện Khí", "Trúc Cơ", "Kết Đan", "Nguyên Anh", "Hóa Thần", "Luyện Hư", "Hợp Thể"].map((cg, i) => [
    `${["Dưỡng Khí", "Trúc Nguyên", "Kim Nguyên", "Anh Nguyên", "Thần Nguyên", "Hư Nguyên", "Hợp Nguyên"][i]} Đan`, null,
    `Một lượng kinh nghiệm cố định cho cảnh giới ${cg}; chung giới hạn 3 viên mỗi ngày`]),
  ["Đồng Tâm Đan", null, "Kinh nghiệm cả party +10% trong 1 giờ"],
  ["Truyền Công Đan", null, "Truyền 5% kinh nghiệm hôm nay của mình cho một ngoại môn đệ tử cùng tông"],
  ["Ngưng Thần Đan", null, "Bế quan +10% trong 8 giờ"],
  ["Tĩnh Tâm Đan", null, "Đột phá cảnh giới nhỏ +3%"],
  ["Linh Tuyền Đan", null, "Bế quan +10% khi tông môn không giữ linh tuyền nào"],
  ["Tụ Vi Đan", null, "Tích tu vi ở thượng vị +10% trong 8 giờ"],
  ["Hộ Pháp Đan", null, "Hộ pháp cho người khác hiệu quả +10%"],
  ["Khai Khiếu Đan", null, "Lên tầng công pháp tốn cống hiến ít hơn 5%"],
  ["Thông Mạch Đan", null, "Tầng công pháp có hệ phụ trùng linh căn tiến nhanh hơn 10% trong 8 giờ"],
  ["Định Căn Đan", null, "Đột phá trong bí cảnh cùng hệ +3%"],
  ["Phục Linh Đan", null, "Lấy lại 5% tu vi đã mất khi đột phá thất bại"],
  ["Minh Tâm Đan", null, "Bế quan bị gián đoạn không mất tiến độ giờ đang dở"],
  ["Quy Nguyên Đan", null, "Tu vi thú nhận từ chủ +10% trong 8 giờ"],
  ["Ngộ Pháp Đan", null, "Thêm 1 lượt ghép thử ở bia Tầm Đạo trong ngày"],
  ["Tị Chướng Đan", null, "Miễn khí độc ở vùng nguy hiểm trong 1 giờ"],
  ["Ngự Hàn Đan", null, "Miễn rét buốt ở vùng băng trong 1 giờ"],
  ["Tị Nhiệt Đan", null, "Miễn nóng bỏng ở vùng lửa và sa mạc trong 1 giờ"],
  ["Tị Lôi Linh Đan", null, "Miễn sét đánh trên đường ở vùng Lôi trong 1 giờ"],
  ["Định Phong Linh Đan", null, "Miễn bão gió trên đường trong 1 giờ"],
  ["Khinh Thân Đan", null, "Tốc độ hành trình +15% trong 2 giờ"],
  ["Ẩn Hình Đan", null, "Dị thú không chủ động tấn công trong 1 giờ"],
  ["Dẫn Thú Đan", null, "Dụ dị thú trong hang ra ngay, khỏi chờ"],
  ["Hồi Lộ Đan", null, "Chặng quay về đi nhanh hơn 10%"],
  ["Hộ Tống Đan", null, "Đoàn hộ tống đỉnh vô chủ đi nhanh hơn 10% trong 1 giờ"],
  ["Truy Tung Đan", null, "Thấy đường đi của đoàn hộ tống đỉnh vô chủ trong 1 giờ"],
];

const CANH_GIOI_PHA = [["Trúc Cơ", "Luyện Khí lên Trúc Cơ"], ["Kết Kim", "Trúc Cơ lên Kết Đan"], ["Ngưng Anh", "Kết Đan lên Nguyên Anh"],
  ["Hóa Thần", "Nguyên Anh lên Hóa Thần"], ["Hợp Thể", "Luyện Hư lên Hợp Thể"], ["Độ Ách", "Đại Thừa lên Độ Kiếp"]];
const thanDan = [
  ["Phá Cảnh Đan", "Thần đan vượt cảnh giới (Phá Cảnh Đan)", "Đột phá cảnh giới nhỏ +10%"],
  ["Ngộ Đạo Đan", "Thần đan tăng ngộ đạo", "Đột phá chiêu thức ở thượng vị +5%"],
  ["Tị Kiếp Đan", "Thần đan giảm lôi kiếp", "Sát thương lôi kiếp −15%"],
  ...CANH_GIOI_PHA.map(([t, mt]) => [`${t} Đan`, null, `Đột phá đại cảnh giới ${mt} +15%`]),
  ...[["Phá Chướng", 5], ["Thông Huyền", 8], ["Tạo Hóa", 10], ["Thái Ất", 12], ["Cửu Chuyển Kim", 15]].map(([t, p]) => [`${t} Đan`, null, `Đột phá chiêu thức ở thượng vị +${p}% (tổng tỷ lệ tối đa 80%, mục 7)`]),
  ["Hỗn Nguyên Đan", null, "Đột phá chiêu thức thất bại không mất tu vi, 1 lần"],
  ...HE.map((h, i) => [`${["Kim", "Mộc", "Thủy", "Hỏa", "Thổ", "Lôi", "Phong", "Quang", "U", "Dương", "Âm", "Hàn"][i]} Tâm Đan`, null, `Đột phá chiêu thức hệ ${h} +5%`]),
  ["Thiết Cốt Đan", null, "Máu +20% khi chịu lôi kiếp"],
  ["Dẫn Lôi Đan", null, "Người hộ pháp gánh thêm 20% lôi kiếp"],
  ["Tái Tạo Đan", null, "Đột phá thất bại chỉ mất 10% tu vi thay 20%"],
];

const dan = [
  ...danDuoc.map(([ten, ten_icon, mo_ta, nguon], i) => ({ ma_vp: `DA-DD-${so(i + 1)}`, nhom: "dan_duoc", ten, ...(ten_icon ? { ten_icon } : {}), mo_ta, cap: "1–5", nguon: nguon || NGUON_DAN, khoa: false })),
  ...linhDan.map(([ten, ten_icon, mo_ta], i) => ({ ma_vp: `DA-LD-${so(i + 1)}`, nhom: "linh_dan", ten, ...(ten_icon ? { ten_icon } : {}), mo_ta, nguon: NGUON_DAN, khoa: false })),
  ...thanDan.map(([ten, ten_icon, mo_ta], i) => ({ ma_vp: `DA-TD-${so(i + 1)}`, nhom: "than_dan", ten, ...(ten_icon ? { ten_icon } : {}), mo_ta, nguon: ["thien_loi_dai", "luyen_dan_cap_8_10"], khoa: true })),
];

// ---------- Nguyên liệu rèn ----------

const nguyen_lieu = [
  ["QU-BA-001", "Thiết tinh", "Quặng rèn Hạ vị", ["mo_quang", "khoang_mach_dong"]],
  ["QU-BA-002", "Huyền thiết", "Quặng rèn Trung vị", ["mo_quang", "khoang_mach_dong"]],
  ["QU-BA-003", "Tinh kim", "Quặng rèn Thần vực", ["mo_quang", "khoang_mach_dong"]],
  ["QU-BA-004", "Thần kim", "Quặng rèn Thánh vực", ["mo_quang", "khoang_mach_dong"]],
  ["NL-LK-001", "Hạ phẩm Luyện Khí Thạch", "Cường hóa +1 đến +10", ["cho", "roi_bi_canh"]],
  ["NL-LK-002", "Trung phẩm Luyện Khí Thạch", "Cường hóa +11 đến +20", ["cho", "roi_bi_canh"]],
  ["NL-LK-003", "Thượng phẩm Luyện Khí Thạch", "Cường hóa +21 đến +30; chỉ rơi trong bí cảnh, khóa vào nhân vật (mục 13)", ["luyen_khi_di_chi", "khoang_mach_dong"]],
  ["NL-LK-004", "Cực phẩm Luyện Khí Thạch", "Cường hóa +31 đến +50 ở Thần vực và Thánh vực; khóa vào nhân vật", ["luyen_khi_di_chi", "thuong_co_chien_truong"]],
  ["NL-TB-001", "Tu Bổ Sa", "Cát luyện để sửa đồ, đi cùng linh thạch và quặng", ["cho", "khoang_mach_dong"]],
  ["NL-KM-001", "Khai Mạch Đinh", "Kích hoạt 1 dòng khảm trên món đồ", ["cho", "luyen_khi_di_chi"]],
  ["NL-GL-001", "Yêu Thú Bì", "Da dị thú: áo giáp, bao tay, giày", ["san_di_thu", "thu_lam"]],
  ["NL-GL-002", "Yêu Thú Cốt", "Xương dị thú: mũ khôi", ["san_di_thu", "thu_lam"]],
  ["NL-GL-003", "Thiên Tằm Ti", "Tơ tằm linh: đạo bào, khăn", ["linh_duoc_vien", "duoc_coc"]],
  ["NL-GL-004", "Linh Mộc", "Gỗ linh: cán vũ khí, cung, cầm, tiêu, trận kỳ", ["linh_duoc_vien", "duoc_coc"]],
  ["NL-GL-005", "Vân Cẩm", "Gấm mây: đai, dây ngọc bội", ["cho", "co_chien_truong"]],
  ["NL-PB-001", "Pháp Bảo Phôi", "Phôi luyện pháp bảo; độ hiếm của phôi là độ hiếm pháp bảo luyện ra", ["co_tong_di_tich", "luyen_khi_di_chi"]],
  ["NL-DB-001", "Thiên Ngoại Vẫn Thiết", "Rèn lại món vàng, đỏ để quay lại 1–2 dòng khảm thêm của đồ bí cảnh", ["thuong_co_chien_truong", "hon_don_bi_canh"]],
].map(([ma_vp, ten, mo_ta, nguon]) => ({ ma_vp, ten, mo_ta, nguon, moi: ma_vp.startsWith("NL-") }));

module.exports = {
  ghi_chu: [
    "Phù bán bằng linh thạch ở chợ (mục 12); tổng tỷ lệ cộng từ phù tối đa +15% (mục 13).",
    "Đan dược 50 loại × 5 cấp, linh đan 40, thần đan 30 (mục 12). Thần đan khóa vào nhân vật (mục 13). Đan phương rơi ở Đan Tiên Động Phủ.",
    "Nguyên liệu: quặng 4 bậc theo vị diện (mục 12), đá cường hóa 4 phẩm, vật liệu giáp phục và phôi pháp bảo. Mảnh lô đỉnh, lò rèn, pháp bảo trấn giáo giữ mã MA- như danh_sach.json.",
  ],
  phu,
  dan,
  nguyen_lieu,
};

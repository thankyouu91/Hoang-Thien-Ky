// 20 bộ set đồ, mỗi bộ gắn một loại bí cảnh làm nguồn rơi ấn bộ. Dùng trong tools/trang_bi/tao.cjs.
// loai hiệu ứng: chi_so (cộng thẳng, nhỏ), hanh_vi (đổi cách ra chiêu), khac_che, ho_tran (chiến tranh), kinh_te.
// Đơn vị: phần nghìn, tick (20 = 1 s). Mọi số là đề xuất.

const B = (id, ten, nguon, chu_de, gan_voi, moc, than = false, rang_buoc = null) => ({ id, ten, nguon, chu_de, gan_voi, than, rang_buoc, moc });
const M = (so, loai, mo_ta, tham_so = {}) => ({ so, loai, mo_ta, tham_so });

const bo = [
  B("tu_bao", "Tụ Bảo", "linh_thach_quat", "tai_nang", { tai_nang: "tu_kim_tien" }, [
    M(2, "kinh_te", "Thuế chợ −1% (cộng với Tu kim tiền không dưới 2%)", { thueCho: -10 }),
    M(4, "kinh_te", "Mỏ linh thạch người mặc trấn giữ +5% sản lượng", { sanLuongMoLinhThach: 50 }),
    M(7, "kinh_te", "Mỏ người mặc trấn giữ bị chiếm thì sản lượng chưa thu vẫn về Bảo Khố; Tu kim tiền thêm 1 gian hàng", { giuSanLuongKhiMatMo: true, gianHangTuKimTien: 1 }),
  ]),
  B("bach_thao", "Bách Thảo", "duoc_coc", "tai_nang", { tai_nang: "tu_duoc" }, [
    M(2, "chi_so", "Hồi máu nhận +4%", { healTaken: 40 }),
    M(4, "kinh_te", "Mỏ dược trấn giữ +5%; cứ 10 lần thu tay thêm 1 dược liệu cùng bậc", { sanLuongMoDuoc: 50, themMoi10LanThu: 1 }),
    M(7, "khac_che", "Lần đầu mỗi trận người mặc hoặc đồng đội kề bên bị giảm hồi máu (Cực âm) thì tẩy ngay; Tu dược nhận ra dược liệu hiếm cao hơn 1 bậc", { tayGiamHoiMau: 1 }),
  ]),
  B("ban_thach", "Bàn Thạch", "khoang_mach_dong", "tai_nang", { tai_nang: "tu_the", loai_chieu: "ho_the" }, [
    M(2, "chi_so", "Khiên nhận được +6%", { khienNhan: 60 }),
    M(4, "hanh_vi", "Hộ thể của người mặc che thêm chính mình (3 thành 4 mục tiêu, khiên phần thêm bằng 50%)", { themMucTieuBanThan: 1, heSoKhienThem: 500 }),
    M(7, "hanh_vi", "Lần đầu mỗi trận máu dưới 30%: hóa đá 1,5 s, miễn sát thương nhưng không ra chiêu; khai khoáng thủ công +5%", { nguongMau: 300, hoaDaTicks: 30, khaiKhoang: 50 }),
  ]),
  B("liep_thu", "Liệp Thú", "thu_lam", "vai_tro", { vai_tro: "san_di_thu", loai_chieu: "tam_xa" }, [
    M(2, "chi_so", "Sát thương lên dị thú và boss +5% (chỉ PvE)", { satThuongPvE: 50 }),
    M(4, "hanh_vi", "Tầm xa ưu tiên kẻ địch máu thấp nhất trong tầm", { chonMucTieu: "mau_thap_nhat" }),
    M(7, "kinh_te", "Săn dị thú +10% cơ hội rơi đan thú; đòn Tầm xa đầu tiên mỗi trận PvE trúng thêm 1 mục tiêu", { roiDanThu: 100, themMucTieuPvE: 1 }),
  ]),
  B("thiet_ky", "Thiết Kỵ", "co_chien_truong", "vai_tro", { vai_tro: "tien_tuyen", loai_chieu: "can_quet" }, [
    M(2, "chi_so", "Phòng thủ +3%", { def: 30 }),
    M(4, "hanh_vi", "Mỗi lần Cận chiến quét, mục tiêu đầu tiên nhận thêm 20% sát thương", { mucTieuDau: 200 }),
    M(7, "khac_che", "Đứng hàng trước khi hàng sau còn từ 2 đồng đội: nhận ít hơn 12% sát thương Diện rộng", { giamDienRong: 120 }),
  ]),
  B("van_uyen", "Văn Uyên", "tang_kinh_dong", "tai_nang", { tai_nang: "tu_phap", loai_chieu: "dien_rong" }, [
    M(2, "chi_so", "Mana tối đa +4%", { manaMax: 40 }),
    M(4, "hanh_vi", "Diện rộng bị khống chế lúc vận công thì hoàn lại 50% hồi chiêu thay vì mất trắng", { hoanHoiChieu: 500 }),
    M(7, "hanh_vi", "Chiêu Diện rộng đầu tiên mỗi trận không cần vận công; nộp tàn quyển vào Tàng Kinh Các +5% cống hiến", { boVanCongLanDau: 1, congHienNopQuyen: 50 }),
  ]),
  B("ngoc_tuy", "Ngọc Tủy", "ngoc_tuy_dong", "he", { he: "theo_linh_can" }, [
    M(2, "kinh_te", "Nén ngọc +2% tỷ lệ (tính chung trần +15% của phù)", { tyLeNenNgoc: 20 }),
    M(4, "khac_che", "Kháng hệ đang khắc linh căn chính của người mặc +6%", { khangHeKhacMinh: 60 }),
    M(7, "khac_che", "Đầu trận: kháng +8% với hệ xuất hiện nhiều nhất trong đội địch (hòa thì lấy hệ đứng trước trong bảng 12 hệ)", { khangHeDichNhieuNhat: 80 }),
  ]),
  B("linh_tuyen", "Linh Tuyền", "linh_tuyen_dong", "vai_tro", { vai_tro: "hoi_phuc", loai_chieu: "hoi_phuc" }, [
    M(2, "chi_so", "Hiệu quả hồi máu và khiên +4%", { healPower: 40 }),
    M(4, "hanh_vi", "Hồi phục: hồi mana khi đang vận chỉ −10% thay −20%", { hoiManaKhiVan: -100 }),
    M(7, "hanh_vi", "Khi một đồng đội ngã, chiêu Hồi phục kế tiếp hồi chiêu ngay (1 lần mỗi trận); bế quan +5%", { lamMoiHoiPhuc: 1, beQuan: 50 }),
  ]),
  B("bang_phach", "Băng Phách", "bang_phach_cung", "he", { he: ["thuy", "cuc_han"], loai_chieu: "khong_che" }, [
    M(2, "chi_so", "Thời gian khống chế +5%", { controlTime: 50 }),
    M(4, "hanh_vi", "Khống chế liên tiếp cùng mục tiêu còn 75% thay vì 50%", { giamDanKhongChe: 750 }),
    M(7, "khac_che", "Kẻ địch đang bị đóng băng hoặc làm chậm nhận thêm 8% sát thương từ người mặc", { satThuongMucTieuCham: 80 }),
  ], false, "Mốc 7 cần ít nhất 1 công pháp hệ chủ Thủy hoặc Cực hàn"),
  B("loi_tri", "Lôi Trì", "loi_tri", "he", { he: ["loi", "kim"] }, [
    M(2, "chi_so", "Chí mạng +2%", { critBonus: 20 }),
    M(4, "chi_so", "Tê liệt khi chí mạng (Lôi) +0,25 s; xuyên giáp (Kim) +3%", { teLietTicks: 5, xuyenGiap: 30 }),
    M(7, "hanh_vi", "Đòn chí mạng thứ 3 mỗi trận nảy sang 1 kẻ địch khác với 50% sát thương", { thuTuChiMang: 3, heSoNay: 500 }),
  ], false, "Mốc 7 cần ít nhất 1 công pháp hệ chủ Lôi hoặc Kim"),
  B("ngu_thu", "Ngự Thú", "yeu_thu_sao_huyet", "vai_tro", { vai_tro: "thu_cuoi" }, [
    M(2, "chi_so", "Hồi chiêu kích phát của thú cưỡi −5%", { hoiChieuKichPhat: -50 }),
    M(4, "chi_so", "Hiệu ứng kích phát +10% (vẫn trong trần 15% lực chiến của thú)", { kichPhat: 100 }),
    M(7, "kinh_te", "Tỷ lệ qua thú kiếp và thuần phục +5%", { thuKiep: 50, thuanPhuc: 50 }),
  ]),
  B("co_tong", "Cổ Tông", "co_tong_di_tich", "vai_tro", { vai_tro: "phap_bao" }, [
    M(2, "chi_so", "Linh lực tối đa của pháp bảo +20%", { linhLucPhapBao: 200 }),
    M(4, "hanh_vi", "Hồi chiêu pháp bảo −15%", { hoiChieuPhapBao: -150 }),
    M(7, "hanh_vi", "Pháp bảo kích hoạt thêm 1 lần mỗi trận (tối đa 3)", { themLanPhapBao: 1, toiDa: 3 }),
  ]),
  B("dan_tien", "Đan Tiên", "dan_tien_dong_phu", "tai_nang", { tai_nang: "tu_dan" }, [
    M(2, "chi_so", "Đan dược tự dùng +5%", { danTuDung: 50 }),
    M(4, "kinh_te", "Đan dược buff trước trận kéo dài thêm 1 trận", { themTranBuff: 1 }),
    M(7, "kinh_te", "Luyện đan +5% thành công; Tu đan có 10% không tốn dược liệu phụ", { luyenDan: 50, khongTonPhuLieu: 100 }),
  ]),
  B("thien_cong", "Thiên Công", "luyen_khi_di_chi", "tai_nang", { tai_nang: "tu_ren" }, [
    M(2, "kinh_te", "Độ bền mất mỗi trận giảm một nửa (2 trận mất 1)", { matBenMoiTran: 500 }),
    M(4, "kinh_te", "Sửa đồ không bị giảm độ bền tối đa", { suaKhongMon: true }),
    M(7, "kinh_te", "Cường hóa +3% thành công (tính chung trần +15%); Tu rèn có 10% rèn ra món thêm 1 dòng khảm", { cuongHoa: 30, themDongTuRen: 100 }),
  ]),
  B("huyet_anh", "Huyết Ảnh", "huyet_sat_ma_quat", "tai_nang", { tai_nang: "sat_thu", loai_chieu: "than_phap" }, [
    M(2, "chi_so", "Sát thương chí mạng +5%", { critDamage: 50 }),
    M(4, "hanh_vi", "Thân pháp chỉ lộ vị trí 2 s thay 3 s", { loViTriTicks: 40 }),
    M(7, "hanh_vi", "Hạ gục kẻ địch bằng Thân pháp thì ẩn thân 1,5 s (1 lần mỗi trận)", { anThanTicks: 30 }),
  ], false, "Bộ tà: mặc từ 4 món thì sát nghiệp nhận +50%"),
  B("do_kiep", "Độ Kiếp", "thien_loi_dai", "vai_tro", { vai_tro: "do_kiep", loai_chieu: "bua_chu" }, [
    M(2, "chi_so", "Kháng Lôi +4%", { khangLoi: 40 }),
    M(4, "hanh_vi", "Lần Bùa chú cuối cùng mỗi trận không tốn mana", { buaCuoiMienMana: 1 }),
    M(7, "kinh_te", "Lôi kiếp (đột phá, thú kiếp, hộ pháp phi thăng) gây ít hơn 10% sát thương lên người mặc", { giamLoiKiep: 100 }),
  ]),
  B("van_kiem", "Vạn Kiếm", "van_kiem_trung", "vai_tro", { vai_tro: "sat_thuong_don", loai_chieu: "can_don" }, [
    M(2, "chi_so", "Công lực +2%", { atk: 20 }),
    M(4, "hanh_vi", "Cận chiến đơn đánh mục tiêu dưới 30% máu +15% sát thương", { nguongMau: 300, satThuong: 150 }),
    M(7, "hanh_vi", "Mỗi 5 s, đòn Cận chiến đơn kế tiếp phát kiếm khí trúng thêm kẻ đứng sau mục tiêu với 30% sát thương", { chuKyTicks: 100, heSoKiemKhi: 300 }),
  ]),
  B("chu_thien", "Chu Thiên", "tien_nhan_dong_phu", "tai_nang", { tai_nang: "tu_tran", loai_chieu: "tran_phap" }, [
    M(2, "chi_so", "Bày trận nhanh hơn 0,5 s", { bayTranTicks: -10 }),
    M(4, "hanh_vi", "Trận pháp đặt vào chỗ đông kẻ địch nhất thay vì quanh mục tiêu đầu tiên", { chonViTri: "dong_dich_nhat" }),
    M(7, "ho_tran", "Trấn giữ trận nhãn Hộ Sơn Đại Trận: trận nhãn đó +8% máu; Tu trận tuyệt sát +2%", { mauTranNhan: 80, tuyetSatTuTran: 20 }),
  ], true),
  B("pha_quan", "Phá Quân", "thuong_co_chien_truong", "vai_tro", { vai_tro: "cong_thanh" }, [
    M(2, "ho_tran", "Sát thương lên trận nhãn và hộ trận +5%", { satThuongHoTran: 50 }),
    M(4, "ho_tran", "Đòn phá trận đầu tiên mỗi trận công thành ×1,5", { heSoDonDau: 1500 }),
    M(7, "ho_tran", "Khi công thành, người mặc miễn 1 lần tuyệt sát của trận pháp địch", { mienTuyetSat: 1 }),
  ], true, "Mốc 4 và 7 chỉ áp trong chiến tranh địa bàn"),
  B("hon_don", "Hỗn Độn", "hon_don_bi_canh", "he", { he: "moi_he" }, [
    M(2, "chi_so", "Kháng mọi hệ +2%", { khangMoiHe: 20 }),
    M(4, "khac_che", "Trúng đòn của hệ khắc mình thì hệ số ×1,5 giảm còn ×1,4", { heSoBiKhac: 1400 }),
    M(7, "khac_che", "Trước trận chọn 1 hệ ngụy linh căn: 8 s đầu trận bị đánh tính theo hệ đó thay linh căn thật", { nguyLinhCanTicks: 160 }),
  ], true),
];
bo.forEach((b, i) => { b.an = `NG-AN-${String(i + 1).padStart(3, "0")}`; });

module.exports = {
  ghi_chu: [
    "Set đồ dựa trên ấn bộ: ấn là vật phẩm khảm vào một dòng khảm đã kích hoạt, nên đúng luật 'thuộc tính chỉ hiện khi khảm ngọc' (chốt 2026-11-03). Kiểu món nào cũng mang được ấn bộ nào.",
    "Mốc 2/4/7: số món đang mặc có cùng ấn và còn độ bền trên 0. 3 món tính mốc 2, 5–6 món tính mốc 4.",
    "Mỗi món giữ tối đa 1 ấn bộ. Tối đa 3 bộ cùng lúc (2+2+2), 7 ô nên chỉ một bộ đạt mốc 7.",
    "Hiệu ứng set không tăng theo cường hóa, độ hiếm hay cấp; ấn bộ không có cấp.",
    "Trần: quy đổi lực chiến mốc 2 không quá 1%, đủ mốc 4 không quá 3%, đủ mốc 7 không quá 6%, tính trong trần 35% của đồ. Hiệu ứng kinh tế của set cộng pháp khí không quá +10% mỗi loại sản lượng; tỷ lệ nén, cường hóa, luyện đan tính chung trần +15% của phù.",
    "Hiệu ứng 'mỗi trận' tính lại từ đầu mỗi trận mô phỏng; mọi chọn mục tiêu phải deterministic (hòa thì theo id).",
    "Đồ tím trở lên rơi ở bí cảnh có 30% đã khảm sẵn ấn bộ của bí cảnh đó ở một dòng khảm thêm. Ấn rời cũng rơi ở bí cảnh đó; tông môn giữ bí cảnh đổi được ấn bằng cống hiến.",
    "3 bộ thần (Chu Thiên, Phá Quân, Hỗn Độn): ấn khóa vào nhân vật. 17 bộ còn lại: ấn chưa khảm bán được trên chợ; món đã khảm bán kèm ấn nếu món đó bán được.",
    "Gỡ ấn bằng Thoát Khảm Phù (PH-CH-008) thì ấn còn nguyên; gỡ không phù thì ấn vỡ.",
  ],
  moc: [2, 4, 7],
  tran: { boToiDa: 3, luc_chien_phan_nghin: { 2: 10, 4: 30, 7: 60 }, kinhTeToiDa: 100, tyLeChungTranPhu: 150 },
  ty_le_kham_san_tim_tro_len: 300,
  bo,
};

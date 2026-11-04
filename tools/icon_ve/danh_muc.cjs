// Ghi ma_vp vào manifest.json và sinh danh_muc.md (bảng mọi món: mã, tên, độ hiếm, file, đã vẽ chưa).
const fs = require("fs");
const path = require("path");
const GOC = path.resolve(__dirname, "../../assets/icon_ve");
const DS = JSON.parse(fs.readFileSync(path.join(GOC, "danh_sach.json"), "utf8"));
const MF_FILE = path.join(GOC, "manifest.json");
const MF = JSON.parse(fs.readFileSync(MF_FILE, "utf8"));
const theoMa = Object.fromEntries(DS.icon.map(i => [i.ma, i]));

MF.assets = MF.assets.map(a => {
  const i = theoMa[a.file.replace(/\.webp$/, "")];
  if (!i) throw new Error("Manifest có file không nằm trong danh sách: " + a.file);
  const { ma_vp, ...con } = a;
  return { ma_vp: i.ma_vp, ...con };
});
MF.assets.sort((a, b) => a.file.localeCompare(b.file));
fs.writeFileSync(MF_FILE, JSON.stringify(MF, null, 2) + "\n");

// Hình đã vẽ còn đúng món khi tên trong manifest khớp tên trong danh sách; lệch tên (món đổi tên, đổi khí hình) thì cần vẽ lại.
const tenDaVe = Object.fromEntries(MF.assets.map(a => [a.file.replace(/\.webp$/, ""), a.ten]));
const trangThai = i => !(i.ma in tenDaVe) ? "" : tenDaVe[i.ma] === i.ten ? "✓" : "vẽ lại";
const daVe = new Set(DS.icon.filter(i => trangThai(i) === "✓").map(i => i.ma));
const TEN_NHOM = {
  trang_bi: "Trang bị", ngoc: "Ngọc khảm", tan_quyen: "Tàn quyển", cong_phap: "Công pháp", linh_thach: "Linh thạch",
  quang: "Quặng", duoc: "Dược liệu", dan: "Đan", linh_don: "Linh đơn (thú)", phu: "Phù chú", trung_thu: "Trứng thú",
  lo_dinh: "Lô đỉnh", lo_ren: "Lò rèn", manh: "Mảnh", dac_biet: "Vật phẩm đặc biệt", vu_khi_tai_nang: "Vũ khí theo tài năng",
  nguyen_lieu: "Nguyên liệu", phap_bao: "Pháp bảo", phap_khi: "Pháp khí", y_chau: "Ý châu", an_bo: "Ấn bộ", ngoc_phach: "Ngọc Phách",
};
const dh = Object.fromEntries(DS.do_hiem.map(d => [d.id, d.ten]));
let md = "# Danh mục vật phẩm có icon vẽ\n\n";
md += "Sinh từ `danh_sach.json`, đừng sửa tay. Mã (`ma_vp`) cố định: không đổi, không dùng lại; món mới nhận số kế tiếp. ";
md += "Độ hiếm trang bị là màu nền ô trên UI (lục < lam < tím < vàng < đỏ), số kiểu mỗi độ hiếm là đề xuất. Cột Hình: ✓ là đã vẽ; \"vẽ lại\" là hình cũ của món đã đổi tên hoặc đổi khí hình.\n\n";
md += `Tổng ${DS.icon.length} món, đã vẽ ${daVe.size}, cần vẽ lại ${DS.icon.filter(i => trangThai(i) === "vẽ lại").length}.\n\n`;
md += "| Tiền tố | Nghĩa |\n|---|---|\n" + Object.entries(DS.tien_to_ma).map(([k, v]) => `| ${k} | ${v} |`).join("\n") + "\n\n";
const nhom = [...new Set(DS.icon.map(i => i.nhom))];
for (const n of nhom) {
  const cac = DS.icon.filter(i => i.nhom === n);
  const coLoai = cac.some(i => i.loai);
  for (const l of coLoai ? [...new Set(cac.map(i => i.loai))] : [null]) {
    const ds = cac.filter(i => !coLoai || i.loai === l);
    md += `## ${TEN_NHOM[n]}${l ? ` · ${l}` : ""} (${ds.length})\n\n`;
    const cot = [["Mã", i => i.ma_vp_chung ? `${i.ma_vp_chung[0]}…${i.ma_vp_chung[i.ma_vp_chung.length - 1]}` : i.ma_vp], ["Tên", i => i.ten]];
    if (ds.some(i => i.do_hiem)) cot.push(["Độ hiếm", i => dh[i.do_hiem] || ""]);
    if (ds.some(i => i.khi_hinh)) cot.push(["Khí hình", i => i.khi_hinh || ""]);
    cot.push(["File", i => `${i.ma}.webp`], ["Hình", trangThai]);
    md += `| ${cot.map(c => c[0]).join(" | ")} |\n|${cot.map(() => "---").join("|")}|\n`;
    for (const i of ds) md += `| ${cot.map(c => c[1](i)).join(" | ")} |\n`;
    md += "\n";
  }
}
fs.writeFileSync(path.join(GOC, "danh_muc.md"), md);
console.log("danh mục:", DS.icon.length, "món; manifest:", MF.assets.length, "dòng");

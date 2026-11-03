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

const daVe = new Set(MF.assets.map(a => a.file.replace(/\.webp$/, "")));
const TEN_NHOM = {
  trang_bi: "Trang bị", ngoc: "Ngọc khảm", tan_quyen: "Tàn quyển", cong_phap: "Công pháp", linh_thach: "Linh thạch",
  quang: "Quặng", duoc: "Dược liệu", dan: "Đan", linh_don: "Linh đơn (thú)", phu: "Phù chú", trung_thu: "Trứng thú",
  lo_dinh: "Lô đỉnh", lo_ren: "Lò rèn", manh: "Mảnh", dac_biet: "Vật phẩm đặc biệt", vu_khi_tai_nang: "Vũ khí theo tài năng",
};
const dh = Object.fromEntries(DS.do_hiem.map(d => [d.id, d.ten]));
let md = "# Danh mục vật phẩm có icon vẽ\n\n";
md += "Sinh từ `danh_sach.json`, đừng sửa tay. Mã (`ma_vp`) cố định: không đổi, không dùng lại; món mới nhận số kế tiếp. ";
md += "Độ hiếm trang bị là màu nền ô trên UI (lục < lam < tím < vàng < đỏ), số kiểu mỗi độ hiếm là đề xuất. Cột Hình: ✓ là đã vẽ.\n\n";
md += `Tổng ${DS.icon.length} món, đã vẽ ${DS.icon.filter(i => daVe.has(i.ma)).length}.\n\n`;
md += "| Tiền tố | Nghĩa |\n|---|---|\n" + Object.entries(DS.tien_to_ma).map(([k, v]) => `| ${k} | ${v} |`).join("\n") + "\n\n";
const nhom = [...new Set(DS.icon.map(i => i.nhom))];
for (const n of nhom) {
  const cac = DS.icon.filter(i => i.nhom === n);
  const coLoai = cac.some(i => i.loai);
  for (const l of coLoai ? [...new Set(cac.map(i => i.loai))] : [null]) {
    const ds = cac.filter(i => !coLoai || i.loai === l);
    md += `## ${TEN_NHOM[n]}${l ? ` · ${l}` : ""} (${ds.length})\n\n`;
    md += coLoai ? "| Mã | Tên | Độ hiếm | File | Hình |\n|---|---|---|---|---|\n" : "| Mã | Tên | File | Hình |\n|---|---|---|---|\n";
    for (const i of ds) md += coLoai
      ? `| ${i.ma_vp} | ${i.ten} | ${dh[i.do_hiem]} | ${i.ma}.webp | ${daVe.has(i.ma) ? "✓" : ""} |\n`
      : `| ${i.ma_vp} | ${i.ten} | ${i.ma}.webp | ${daVe.has(i.ma) ? "✓" : ""} |\n`;
    md += "\n";
  }
}
fs.writeFileSync(path.join(GOC, "danh_muc.md"), md);
console.log("danh mục:", DS.icon.length, "món; manifest:", MF.assets.length, "dòng");

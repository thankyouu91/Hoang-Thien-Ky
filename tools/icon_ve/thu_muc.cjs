// Ánh xạ mã icon → thư mục Canva; in danh sách "media_id<TAB>folder_id" cho các ảnh chưa chuyển.
// Chạy: node thu_muc.cjs <thư mục xuat>   (ghi lại các id đã chuyển vào da_chuyen.txt)
const fs = require("fs");
const path = require("path");
const dir = process.argv[2];
const TM = {
  kiem: "FAHZ1h8jjjs", mu: "FAHZ1i-CGX4", ao: "FAHZ1iSHx2U", dai: "FAHZ1lNhTiQ", bao_tay: "FAHZ1ibEY9E",
  giay: "FAHZ1naC6cs", ngoc_boi: "FAHZ1n8nJu8", ngoc: "FAHZ1rhaPVA", tan_quyen: "FAHZ1sNqPs4",
  linh_thach: "FAHZ1tSo9xk", quang: "FAHZ1kVUdSI", duoc: "FAHZ1tZ9w7o", dan: "FAHZ1s-kfAs",
  trung_thu: "FAHZ1h-fQNA", lo: "FAHZ1kRC-WY", phu: "FAHZ1-UPg-o", bo: "FAHZ1qKqhag",
};
function thuMuc(ma, ghi) {
  if ((ghi || "").startsWith("bo")) return TM.bo;
  const [nhom, sau] = ma.split("/");
  if (nhom === "trang_bi") {
    const loai = sau.replace(/_(linh|thien|than)$/, "");
    return TM[loai === "vu_khi" ? "kiem" : loai];
  }
  if (["lo_dinh", "lo_ren", "manh"].includes(nhom)) return TM.lo;
  return TM[nhom];
}
const rd = f => fs.existsSync(path.join(dir, f)) ? fs.readFileSync(path.join(dir, f), "utf8").trim().split("\n").map(l => l.replace(/\r$/, "").split("\t")) : [];
const da = new Set(rd("da_chuyen.txt").map(r => r[0]));
const ra = [];
// Ảnh tách nền do remove-background lưu chỗ riêng, API báo "Not allowed to access this folder", nên chỉ chuyển ảnh gốc.
for (const [ma, id, ghi] of rd("nhat_ky.tsv")) {
  if (da.has(id)) continue;
  const f = thuMuc(ma, ghi);
  if (!f) { console.error("Không có thư mục:", ma); continue; }
  ra.push(`${id}\t${f}\t${ma}`);
}
console.log(ra.join("\n"));

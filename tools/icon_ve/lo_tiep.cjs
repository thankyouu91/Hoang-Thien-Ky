// Lấy lô kế tiếp: n món ưu tiên 2 chưa vẽ (chưa có trong manifest), theo thứ tự danh sách.
// Chạy: node lo_tiep.cjs [n=24]   → in ra "ma<TAB>do_hiem<TAB>lời gửi Canva", ghi vào lo.tsv của lô.
const path = require("path");
const G = path.resolve(__dirname, "../../assets/icon_ve");
const d = require(path.join(G, "danh_sach.json")), m = require(path.join(G, "manifest.json"));
const co = new Set(m.assets.map(a => a.file.replace(/\.webp$/, "")));
const n = +(process.argv[2] || 24);
for (const i of d.icon.filter(i => !co.has(i.ma) && i.uu_tien === 2).slice(0, n))
  console.log(i.ma + "\t" + (i.do_hiem || "") + "\t" + "Game inventory item icon: " + i.mo_ta + ". " + d.duoi_loi_mo_ta);

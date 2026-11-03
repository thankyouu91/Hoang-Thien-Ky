// Ghép nhat_ky.tsv (media gốc), tach.tsv (media tách nền), trang.tsv (trang trong design) và file URL xuất thành lo.json.
// Chạy: node tao_lo.cjs <thư mục xuat> <file url> <lo.json> [ma=ghi_chu ...]
const fs = require("fs");
const path = require("path");
const [dir, urlFile, outFile, ...notes] = process.argv.slice(2);
const rd = f => fs.readFileSync(path.join(dir, f), "utf8").trim().split("\n").map(l => l.replace(/\r$/, "").split("\t"));
const goc = {}, tach = {};
for (const r of rd("nhat_ky.tsv")) if (!(r[2] || "").startsWith("bo")) goc[r[0]] = r[1];
for (const r of rd("tach.tsv")) tach[r[0]] = r[1];
const urls = fs.readFileSync(urlFile, "utf8").trim().split("\n").map(s => s.trim());
const ghi = Object.fromEntries(notes.map(n => n.split("=")));
// Lời mô tả thật đã gửi Canva khi khác lời trong danh sách (danh sách sửa sau khi sinh): ma<TAB>lời mô tả.
const loiRieng = fs.existsSync(path.join(dir, "loi_rieng.tsv")) ? Object.fromEntries(rd("loi_rieng.tsv")) : {};
const lo = [];
// Trang tờ xuất có thể được dùng lại (Canva giới hạn 100 trang): dòng sau cùng của mỗi trang là đúng.
const theoTrang = {};
for (const r of rd("trang.tsv")) theoTrang[r[2]] = r;
for (const [ma, , tr] of Object.values(theoTrang)) {
  const url = urls.find(u => u.includes(`/${String(tr).padStart(4, "0")}-`));
  if (!url) continue;
  const x = { ma, url, media_goc: goc[ma], media_tach_nen: tach[ma], trang: +tr };
  if (ghi[ma]) x.ghi_chu = ghi[ma];
  if (loiRieng[ma]) x.loi_mo_ta = loiRieng[ma];
  if (!x.media_goc || !x.media_tach_nen) throw new Error("Thiếu id: " + ma);
  lo.push(x);
}
fs.writeFileSync(outFile, JSON.stringify(lo, null, 1));
console.log("lô", lo.length);

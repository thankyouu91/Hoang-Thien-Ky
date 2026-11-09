// Ảnh ghép xem trước từ webp trong repo. Chạy: node ghep.cjs <ra.png> <tiền tố mã ...> (không có tiền tố = tất cả trong manifest)
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const GOC = path.resolve(__dirname, "../../assets/icon_ve");
const DS = JSON.parse(fs.readFileSync(path.join(GOC, "danh_sach.json"), "utf8"));
const MF = JSON.parse(fs.readFileSync(path.join(GOC, "manifest.json"), "utf8"));
const [ra, ...loc] = process.argv.slice(2);
const thuTu = DS.icon.map(i => i.ma);
const ds = MF.assets.map(a => a.file.replace(/\.webp$/, ""))
  .filter(m => !loc.length || loc.some(p => m.startsWith(p)))
  .sort((a, b) => thuTu.indexOf(a) - thuTu.indexOf(b));
(async () => {
  const O = 160, CH = 30, COT = Math.min(8, ds.length), HANG = Math.ceil(ds.length / COT);
  const comp = [];
  const esc = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  for (let i = 0; i < ds.length; i++) {
    const x = (i % COT) * O, y = Math.floor(i / COT) * (O + CH);
    comp.push({ input: await sharp(path.join(GOC, ds[i] + ".webp")).resize(O - 12, O - 12).toBuffer(), left: x + 6, top: y + 6 });
    const ten = DS.icon.find(t => t.ma === ds[i])?.ten.replace(/ \(.*\)$/, "") ?? ds[i];
    comp.push({ input: Buffer.from(`<svg width="${O}" height="${CH}" xmlns="http://www.w3.org/2000/svg"><text x="${O / 2}" y="13" font-family="Segoe UI, Arial" font-size="12" fill="#3b2f20" text-anchor="middle">${esc(ten.slice(0, 26))}</text><text x="${O / 2}" y="26" font-family="Consolas, monospace" font-size="10" fill="#8a7a62" text-anchor="middle">${esc(ds[i])}</text></svg>`), left: x, top: y + O });
  }
  await sharp({ create: { width: COT * O, height: HANG * (O + CH), channels: 4, background: "#f4ecdc" } }).composite(comp).png().toFile(ra);
  console.log(ds.length, "hình →", ra);
})();

// Xử lý một lô icon xuất từ Canva: tải PNG 512, đổi sang webp vào repo, ghi manifest, ghép ảnh xem trước.
// Chạy: node xu_ly.cjs <lo.json> <anh_ghep.png>
// lo.json: [{ ma, url, media_goc, media_tach_nen, trang }]
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const REPO = path.resolve(__dirname, "../..");
const GOC = path.join(REPO, "assets/icon_ve");
const DS = JSON.parse(fs.readFileSync(path.join(GOC, "danh_sach.json"), "utf8"));
const MF = path.join(GOC, "manifest.json");
const DESIGN = "DAHZ1iamT_w";
const NGAY = new Date().toISOString().slice(0, 10);

async function main() {
  const [loFile, ghepFile] = process.argv.slice(2);
  const lo = JSON.parse(fs.readFileSync(loFile, "utf8"));
  const mf = fs.existsSync(MF) ? JSON.parse(fs.readFileSync(MF, "utf8")) : { ghi_chu: [], assets: [] };
  const tile = [];
  for (const x of lo) {
    const muc = DS.icon.find(i => i.ma === x.ma);
    if (!muc) throw new Error(`Không có trong danh sách: ${x.ma}`);
    const buf = x.url.startsWith("http") ? Buffer.from(await (await fetch(x.url)).arrayBuffer()) : fs.readFileSync(x.url);
    const meta = await sharp(buf).metadata();
    if (meta.width !== 512 || meta.height !== 512 || !meta.hasAlpha) throw new Error(`${x.ma}: ảnh ${meta.width}x${meta.height}, alpha ${meta.hasAlpha}`);
    const ra = path.join(GOC, `${x.ma}.webp`);
    fs.mkdirSync(path.dirname(ra), { recursive: true });
    await sharp(buf).webp({ quality: 88, alphaQuality: 100, effort: 6 }).toFile(ra);
    const dong = {
      ma_vp: muc.ma_vp,
      file: `${x.ma}.webp`,
      ten: muc.ten,
      description: x.loi_mo_ta || `Game inventory item icon: ${muc.mo_ta}. ${DS.duoi_loi_mo_ta}`,
      tool: "Canva generate-image (SQUARE_1_1) → remove-background → xuất PNG 512 nền trong → webp q88",
      canva_media_goc: x.media_goc || null,
      canva_media_tach_nen: x.media_tach_nen,
      canva_design: `${DESIGN} trang ${x.trang}`,
      created: x.ngay || NGAY,
    };
    if (x.ghi_chu) dong.ghi_chu = x.ghi_chu;
    mf.assets = mf.assets.filter(a => a.file !== dong.file).concat(dong);
    tile.push({ ma: x.ma, ten: muc.ten, buf });
    console.log("ok", x.ma, fs.statSync(ra).size);
  }
  mf.assets.sort((a, b) => a.file.localeCompare(b.file));
  fs.writeFileSync(MF, JSON.stringify(mf, null, 2) + "\n");

  // Ảnh ghép: nền kem như giao diện, mỗi ô 200 px kèm tên.
  const O = 200, CH = 34, COT = Math.min(6, tile.length), HANG = Math.ceil(tile.length / COT);
  const W = COT * O, H = HANG * (O + CH);
  const comp = [];
  for (let i = 0; i < tile.length; i++) {
    const x = (i % COT) * O, y = Math.floor(i / COT) * (O + CH);
    comp.push({ input: await sharp(tile[i].buf).resize(O - 16, O - 16).toBuffer(), left: x + 8, top: y + 8 });
    const esc = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
    const svg = `<svg width="${O}" height="${CH}" xmlns="http://www.w3.org/2000/svg"><text x="${O / 2}" y="14" font-family="Segoe UI, Arial" font-size="13" fill="#3b2f20" text-anchor="middle">${esc(tile[i].ten.slice(0, 30))}</text><text x="${O / 2}" y="29" font-family="Consolas, monospace" font-size="11" fill="#8a7a62" text-anchor="middle">${esc(tile[i].ma)}</text></svg>`;
    comp.push({ input: Buffer.from(svg), left: x, top: y + O });
  }
  await sharp({ create: { width: W, height: H, channels: 4, background: "#f4ecdc" } }).composite(comp).png().toFile(ghepFile);
  console.log("ghép", ghepFile);
}
main().catch(e => { console.error(e); process.exit(1); });

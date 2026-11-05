// Dựng bộ dấu ấn Thiên Hoang Ký từ ảnh Canva (nền trắng, 512 px) vào assets/brand/.
// Chạy: NODE_PATH=<thư mục node_modules có sharp> node dau_an.cjs <thư mục ảnh PNG> <tên bản chọn>
// - Đổi nền trắng thành trong suốt theo độ đậm mực ("color to alpha"): chỗ son nhạt, vân giấy thành bán trong suốt,
//   đặt lên nền kem trông như ấn in trên giấy. Bản tách nền của Canva giữ mảng trắng bên trong khung nên không dùng.
// - Cắt sát mép mực, đặt giữa khung vuông, xuất các cỡ; favicon tăng độ đậm để đọc được ở 16–32 px.
// - Ghép ảnh so sánh các phương án trên nền kem (màu --c-bg của dashboard).
const fs = require("fs"), path = require("path"), sharp = require("sharp");
const [nguon, chon] = process.argv.slice(2);
const RA = path.resolve(__dirname, "../../assets/brand");
const PA = path.join(RA, "phuong_an");
fs.mkdirSync(PA, { recursive: true });
const TEN = {
  tron_nhat_nguyet: "Tròn: núi dưới nhật nguyệt, viền mây",
  bat_giac_bat_quai: "Bát giác: bát quái, kiếm xuyên mây",
  vuong_nui_may: "Vuông: núi mây, mặt trời",
  vuong_dai_hoang: "Vuông bo góc: đại hoang, sông núi",
  tron_rong_may: "Tròn: rồng mây giữ châu",
  bat_giac_ba_nui: "Bát giác: ba núi, vệt kiếm khí",
};
const KEM = "#f6efdf", KHUNG = "rgba(138,31,22,0.55)", SON = "#8a1f16";

async function trongSuot(file, tang = 1) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
    let a = 1 - Math.min(r, g, b) / 255;
    if (a < 0.06) a = 0;
    const aa = Math.min(1, a * tang);
    if (a > 0) for (let k = 0; k < 3; k++) data[i + k] = Math.max(0, Math.min(255, Math.round((data[i + k] - 255 * (1 - a)) / a)));
    data[i + 3] = Math.round(aa * 255);
  }
  const anh = sharp(data, { raw: info }).png();
  const cat = await sharp(await anh.toBuffer()).trim({ threshold: 1 }).toBuffer({ resolveWithObject: true });
  const c = Math.max(cat.info.width, cat.info.height), le = Math.round(c * 0.04);
  return sharp(cat.data).extend({
    top: Math.floor((c - cat.info.height) / 2) + le, bottom: Math.ceil((c - cat.info.height) / 2) + le,
    left: Math.floor((c - cat.info.width) / 2) + le, right: Math.ceil((c - cat.info.width) / 2) + le,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  }).png().toBuffer();
}
// Favicon: hình ấn đầy đủ thành vệt mờ ở 16–32 px, nên lấy phần giữa (núi, nhật nguyệt), tô mực son đặc
// (nét trắng khắc thành trong suốt), cắt tròn và thêm viền son.
async function favicon(file, n) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    const muc = Math.min(data[i], data[i + 1], data[i + 2]) < 175;
    data[i] = 0xb3; data[i + 1] = 0x26; data[i + 2] = 0x1e; data[i + 3] = muc ? 255 : 0;
  }
  const cat = await sharp(await sharp(data, { raw: info }).png().toBuffer()).trim({ threshold: 1 }).toBuffer({ resolveWithObject: true });
  const W = cat.info.width, H = cat.info.height, D = Math.round(Math.min(W, H) * 0.66);
  const giua = await sharp(cat.data).extract({ left: Math.round((W - D) / 2), top: Math.round((H - D) / 2) + Math.round(D * 0.02), width: D, height: D }).toBuffer();
  const R = 256, vien = 26;
  const matNa = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${R}" height="${R}"><circle cx="${R / 2}" cy="${R / 2}" r="${R / 2 - vien}" fill="#fff"/></svg>`);
  const tron = await sharp(giua).resize(R, R).composite([{ input: matNa, blend: "dest-in" }]).png().toBuffer();
  const vong = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${R}" height="${R}"><circle cx="${R / 2}" cy="${R / 2}" r="${R / 2 - vien / 2 - 2}" fill="none" stroke="#b3261e" stroke-width="${vien}"/></svg>`);
  const lon = await sharp({ create: { width: R, height: R, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: tron }, { input: vong }]).png().toBuffer();
  if (n > 16) return sharp(lon).resize(n, n, { kernel: "lanczos3" }).png({ compressionLevel: 9 }).toBuffer();
  // 16 px: làm dày nét khắc (làm mờ rồi cắt ngưỡng kênh alpha) để núi và nhật nguyệt còn thấy.
  const m = await sharp(lon).blur(7).raw().toBuffer({ resolveWithObject: true });
  for (let i = 3; i < m.data.length; i += 4) m.data[i] = m.data[i] > 215 ? 255 : 0;
  return sharp(m.data, { raw: m.info }).resize(n, n, { kernel: "lanczos3" }).png({ compressionLevel: 9 }).toBuffer();
}
// 16 px: hình ấn đầy đủ hay phần cắt đều thành vệt mờ, nên vẽ giản lược cùng mô típ (đĩa son, núi trắng, trăng khuyết, mặt trời).
async function favicon16() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 16 16">
<circle cx="8" cy="8" r="7.6" fill="#b3261e"/>
<path d="M2.6 12.6 L6.4 5.6 L8 8.2 L9.4 6.4 L13.4 12.6 Z" fill="#fff"/>
<path d="M6.4 5.6 L5.4 8.6 L6.6 7.6 L7.2 9.6 L8 8.2 Z" fill="#b3261e" opacity="0.9"/>
<circle cx="11.6" cy="3.9" r="1.3" fill="#fff"/>
<path d="M4.9 2.4 a1.6 1.6 0 1 0 1.2 2.9 a1.25 1.25 0 1 1 -1.2 -2.9 Z" fill="#fff"/>
</svg>`;
  return sharp(await sharp(Buffer.from(svg)).png().toBuffer()).resize(16, 16, { kernel: "lanczos3" }).png({ compressionLevel: 9 }).toBuffer();
}
const coDo = (buf, n) => sharp(buf).resize(n, n, { kernel: "lanczos3" }).png({ compressionLevel: 9 }).toBuffer();

function ico(pngs) { // ICO chứa PNG (Vista trở lên đọc được)
  const dau = Buffer.alloc(6 + 16 * pngs.length);
  dau.writeUInt16LE(0, 0); dau.writeUInt16LE(1, 2); dau.writeUInt16LE(pngs.length, 4);
  let off = dau.length;
  pngs.forEach(([n, b], i) => {
    const o = 6 + 16 * i;
    dau.writeUInt8(n >= 256 ? 0 : n, o); dau.writeUInt8(n >= 256 ? 0 : n, o + 1);
    dau.writeUInt16LE(1, o + 4); dau.writeUInt16LE(32, o + 6);
    dau.writeUInt32LE(b.length, o + 8); dau.writeUInt32LE(off, o + 12);
    off += b.length;
  });
  return Buffer.concat([dau, ...pngs.map(p => p[1])]);
}

async function main() {
  const ds = Object.keys(TEN).filter(t => fs.existsSync(path.join(nguon, t + ".png")));
  const banh = {};
  for (const t of ds) {
    banh[t] = await coDo(await trongSuot(path.join(nguon, t + ".png")), 512);
    await sharp(banh[t]).webp({ quality: 90, alphaQuality: 100 }).toFile(path.join(PA, t + ".webp"));
  }
  // Bản chọn: nhiều cỡ và favicon.
  const goc = banh[chon];
  fs.writeFileSync(path.join(RA, "dau_an.png"), goc);
  await sharp(goc).webp({ quality: 90, alphaQuality: 100 }).toFile(path.join(RA, "dau_an.webp"));
  fs.writeFileSync(path.join(RA, "dau_an_256.png"), await coDo(goc, 256));
  fs.writeFileSync(path.join(RA, "dau_an_128.png"), await coDo(goc, 128));
  const f32 = await favicon(path.join(nguon, chon + ".png"), 32), f16 = await favicon16();
  fs.writeFileSync(path.join(RA, "favicon-32.png"), f32);
  fs.writeFileSync(path.join(RA, "favicon-16.png"), f16);
  fs.writeFileSync(path.join(RA, "favicon.png"), f32);
  fs.writeFileSync(path.join(RA, "favicon.ico"), ico([[16, f16], [32, f32]]));
  // Bản lớn 1024 (xuất lại trang Canva ở 1024 px, lưu là <chọn>_1024.png): ảnh trong suốt, và biểu tượng Discord nền kem
  // (Discord cắt tròn biểu tượng; nền đặc giữ màu son đúng trên nền tối của Discord).
  const lon = path.join(nguon, chon + "_1024.png");
  if (fs.existsSync(lon)) {
    const t1024 = await coDo(await trongSuot(lon), 1024);
    fs.writeFileSync(path.join(RA, "dau_an_1024.png"), t1024);
    await sharp({ create: { width: 1024, height: 1024, channels: 4, background: KEM } })
      .composite([{ input: await coDo(t1024, 880), left: 72, top: 72 }]).flatten({ background: KEM })
      .png({ compressionLevel: 9 }).toFile(path.join(RA, "discord_icon.png"));
  }

  // Ảnh ghép so sánh: 3 cột × 2 hàng, mỗi ô khung đỏ mảnh trên nền kem; hàng dưới là bản chọn ở các cỡ nhỏ.
  const O = 360, DAU = 250, cot = 3, hang = Math.ceil(ds.length / cot), CAO = O * hang + 200;
  const lop = [];
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${O * cot}" height="${CAO}"><rect width="100%" height="100%" fill="${KEM}"/>`;
  const thuTu = [chon, ...ds.filter(t => t !== chon)];
  const nho = {};
  for (const t of thuTu) nho[t] = await coDo(banh[t], DAU);
  thuTu.forEach((t, i) => {
    const x = (i % cot) * O, y = Math.floor(i / cot) * O;
    svg += `<rect x="${x + 14}" y="${y + 14}" width="${O - 28}" height="${O - 28}" fill="none" stroke="${t === chon ? SON : KHUNG}" stroke-width="${t === chon ? 2.5 : 1}"/>`;
    svg += `<text x="${x + O / 2}" y="${y + O - 34}" font-family="Times New Roman, Noto Serif, serif" font-size="17" fill="${SON}" text-anchor="middle">${(t === chon ? "✓ Chọn · " : "") + TEN[t]}</text>`;
    lop.push({ input: nho[t], left: x + (O - DAU) / 2, top: y + 34 });
  });
  const y0 = O * hang;
  svg += `<text x="24" y="${y0 + 40}" font-family="Times New Roman, Noto Serif, serif" font-size="18" fill="${SON}">Bản chọn ở cỡ nhỏ: 128 · 32 · 16 (favicon)</text></svg>`;
  lop.push({ input: await coDo(goc, 128), left: 40, top: y0 + 60 });
  lop.push({ input: f32, left: 200, top: y0 + 108 });
  lop.push({ input: f16, left: 252, top: y0 + 116 });
  lop.push({ input: await sharp(f32).resize(96, 96, { kernel: "nearest" }).toBuffer(), left: 320, top: y0 + 76 });
  lop.push({ input: await sharp(f16).resize(96, 96, { kernel: "nearest" }).toBuffer(), left: 440, top: y0 + 76 });
  await sharp(Buffer.from(svg)).composite(lop).png().toFile(path.join(RA, "phuong_an", "so_sanh.png"));
  console.log("xong:", ds.length, "phương án; chọn", chon);
}
main().catch(e => { console.error(e); process.exit(1); });

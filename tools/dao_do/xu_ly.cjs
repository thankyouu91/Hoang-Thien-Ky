// Đạo đồ theo công pháp chủ tu: mỗi hệ 5 bức, mỗi cảnh giới một bức (Luyện Khí → Hóa Thần).
// Đổi PNG 600×900 xuất từ Canva sang webp q80 vào assets/icon_ve/dao_do/<hệ>/<cấp>.webp, ghi manifest riêng của bộ này.
// Chạy: NODE_PATH=<node_modules có sharp> node xu_ly.cjs <thư mục png> <bang.tsv> <loi.json>
//   thư mục png: file <hệ>-<cấp>.png
//   bang.tsv: he<TAB>cap<TAB>media<TAB>trang (dòng đầu là tiêu đề)
//   loi.json: [{ media, prompt }] — lời đã gửi generate-image cho từng media
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const REPO = path.resolve(__dirname, "../..");
const GOC = path.join(REPO, "assets/icon_ve/dao_do");
const MF = path.join(GOC, "manifest.json");
// Tờ xuất riêng của đạo đồ (trang dọc 600×900), không dùng chung với tờ xuất icon 512×512.
const DESIGN = process.env.DESIGN || "DAHaApFanBI";
const NGAY = new Date().toISOString().slice(0, 10);
const CANH_GIOI = ["Luyện Khí", "Trúc Cơ", "Kết Đan", "Nguyên Anh", "Hóa Thần"];
const TEN_HE = {
  kim: "Kim", moc: "Mộc", thuy: "Thủy", hoa: "Hỏa", tho: "Thổ", loi: "Lôi", phong: "Phong",
  quang: "Quang", am_lanh: "Âm lãnh", cuc_duong: "Cực dương", cuc_am: "Cực âm", cuc_han: "Cực hàn",
};

async function main() {
  const [dir, bang, loiFile] = process.argv.slice(2);
  const loi = Object.fromEntries(JSON.parse(fs.readFileSync(loiFile, "utf8")).map((x) => [x.media, x.prompt]));
  const rows = fs.readFileSync(bang, "utf8").trim().split("\n").slice(1).map((l) => l.replace(/\r$/, "").split("\t"));
  const mf = fs.existsSync(MF) ? JSON.parse(fs.readFileSync(MF, "utf8")) : {
    ghi_chu: [
      "Đạo đồ hiện mờ sau hình nhân vật ở màn Pháp tướng, chọn theo hệ chính của công pháp đang tu và cảnh giới.",
      "Ảnh nền trắng; giao diện hòa vào giấy kem bằng mix-blend-mode multiply.",
    ],
    assets: [],
  };
  for (const [he, cap, media, trang] of rows) {
    const src = path.join(dir, `${he}-${cap}.png`);
    if (!fs.existsSync(src)) { console.log("bỏ qua, chưa có", src); continue; }
    if (!TEN_HE[he]) throw new Error("Hệ lạ: " + he);
    const meta = await sharp(src).metadata();
    if (meta.width !== 600 || meta.height !== 900) throw new Error(`${he}-${cap}: ảnh ${meta.width}x${meta.height}`);
    if (!loi[media]) throw new Error(`${he}-${cap}: thiếu lời mô tả cho ${media}`);
    const file = `${he}/${cap}.webp`;
    const ra = path.join(GOC, file);
    fs.mkdirSync(path.dirname(ra), { recursive: true });
    await sharp(src).webp({ quality: 80, effort: 6 }).toFile(ra);
    const dong = {
      file,
      ten: `Đạo đồ hệ ${TEN_HE[he]} · ${CANH_GIOI[+cap - 1]}`,
      he,
      canh_gioi: +cap,
      description: loi[media],
      tool: "Canva generate-image (PORTRAIT_2_3) → trang 600×900 → xuất PNG → webp q80",
      canva_media: media,
      canva_design: `${DESIGN} trang ${trang}`,
      created: NGAY,
    };
    const cu = mf.assets.find((a) => a.file === file);
    if (cu && cu.canva_media === media) dong.created = cu.created;
    mf.assets = mf.assets.filter((a) => a.file !== file).concat(dong);
    console.log("ok", file, fs.statSync(ra).size);
  }
  mf.assets.sort((a, b) => a.file.localeCompare(b.file));
  fs.writeFileSync(MF, JSON.stringify(mf, null, 2) + "\n");
}
main().catch((e) => { console.error(e); process.exit(1); });

// Chọn hình có sẵn trong repo (assets/pixellab, assets/icon_ve) và xuất WebP nhỏ cho website vào public/hinh/,
// kèm src/hinh.json (cỡ ảnh, chú thích) để plugin trong vite.config.ts dựng thư viện hình thành HTML tĩnh.
// Hình pixel giữ cỡ gốc, nén không mất (lossless); trình duyệt phóng to bằng image-rendering: pixelated.
// Tranh vẽ Canva thu nhỏ còn 320 px (hiện ~160 px, đủ nét ở màn dpr 2), nén có mất chất lượng 80.
// Chạy lại khi đổi danh sách: npm.cmd run hinh (dev và build tự chạy). Ảnh đã xuất mà nguồn không đổi thì bỏ qua.
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const WEB = fileURLToPath(new URL("..", import.meta.url));
const ASSETS = join(WEB, "..", "assets");
const OUT = join(WEB, "public", "hinh");
const PL = join(ASSETS, "pixellab");
const BRAND = join(ASSETS, "brand");
const IV = join(ASSETS, "icon_ve");

const HE = {
  kim: "Kim", moc: "Mộc", thuy: "Thủy", hoa: "Hỏa", tho: "Thổ", loi: "Lôi", phong: "Phong", quang: "Quang",
  am_lanh: "Âm lãnh", cuc_duong: "Cực dương", cuc_am: "Cực âm", cuc_han: "Cực hàn",
};
const HE_IDS = Object.keys(HE);

// Tên hình lấy từ manifest PixelLab: mô tả bắt đầu bằng tên, ví dụ "Bạch Hổ (thú cưỡi hệ Kim, phẩm Thần, tẩu thú): ...".
const manifest = JSON.parse(readFileSync(join(PL, "manifest.json"), "utf8"));
const moTa = new Map();
for (const v of Object.values(manifest)) {
  const list = Array.isArray(v) ? v : [];
  for (const m of list) if (m && m.file) moTa.set(m.file, m.description ?? "");
}
function tenTuManifest(file, duPhong) {
  const d = moTa.get(file) ?? "";
  const m = /^([^(:—–,.]+?)\s*[(:—–,]/.exec(d);
  return m ? m[1].trim() : duPhong;
}

/** Hệ và dáng thú trong ngoặc của mô tả manifest: "(thú cưỡi hệ Kim, phẩm Thần, tẩu thú)". */
function thuTuManifest(file) {
  const m = /\(thú cưỡi hệ ([^,]+), phẩm [^,]+, ([^)]+)\)/.exec(moTa.get(file) ?? "");
  return m ? `Hệ ${m[1]} · ${m[2]}` : "";
}

/** Thú cưỡi: 2 con mỗi hệ, dáng khác nhau (tẩu thú, phi cầm, thủy thú), lấy theo danh sách 100 loài trong GDD. */
const THU = [
  "thiet_boi_nguu", "dong_trao_ung", "thanh_loc", "thanh_phong_yen", "bich_ba_bao", "huyen_vu", "hoa_tong_ma", "chu_tuoc",
  "kim_giap_quy", "nham_ung", "thiem_dien_bao", "cuu_tieu_loi_ung", "cuong_phong_lang", "ngu_phong_hac", "minh_quang_tuoc", "ky_lan",
  "u_minh_lang", "huyet_buc", "liet_diem_ho", "kim_o", "cuu_u_ma_ho", "u_uyen_ngac", "tuyet_lang", "bang_phuong",
  "bach_ho", "thanh_long", "cuu_vi_ho", "ty_huu",
];

const THAN = { nam_khoe: "Nam khỏe", nam_manh: "Nam mảnh", nu_khoe: "Nữ khỏe", nu_manh: "Nữ mảnh" };
const AO = { dao_bao: "đạo bào", vo_phuc: "võ phục" };

const CONG_TRINH = {
  chinh_dien: "Chính Điện", tang_kinh_cac: "Tàng Kinh Các", ho_son_dai_tran: "Hộ Sơn Đại Trận", dien_vo_truong: "Diễn Võ Trường",
  luyen_dan_phong: "Luyện Đan Phòng", luyen_khi_cac: "Luyện Khí Các", linh_duoc_vien: "Linh Dược Viên", bao_kho: "Bảo Khố",
  truyen_tong_tran: "Truyền Tống Trận", thuong_hoi: "Thương Hội", phi_thang_dai: "Phi Thăng Đài",
};
/** 9 mô hình tông môn đã có đủ 11 công trình; mỗi mô hình một hệ. */
const MO_HINH = [
  ["kim_van_kiem_tong", "kim"], ["moc_thanh_truc_coc", "moc"], ["thuy_thuy_ta_cung", "thuy"], ["hoa_hoa_son_thanh", "hoa"],
  ["tho_son_nhac_tu", "tho"], ["loi_loi_tri_phong", "loi"], ["phong_phi_van_dinh", "phong"], ["quang_quang_minh_dien", "quang"],
  ["am_lanh_u_hon_dien", "am_lanh"],
];

const DIEM = [
  ["mo_linh_thach", "Mỏ linh thạch"], ["mo_quang", "Mỏ quặng"], ["mo_duoc", "Mỏ dược"], ["linh_tuyen", "Linh tuyền"],
  ["hang_di_thu", "Hang dị thú"], ["cua_bi_canh", "Cửa bí cảnh"], ["deo", "Đèo"], ["ben_do", "Bến đò"],
];

const CHIEU = {
  can_quet: "Cận quét", can_don: "Cận đơn", tam_xa: "Tầm xa", dien_rong: "Diện rộng", khong_che: "Khống chế",
  hoi_phuc: "Hồi phục", ho_the: "Hộ thể", than_phap: "Thân pháp", bua_chu: "Bùa chú", tran_phap: "Trận pháp",
};

/** Ảnh chụp prototype trong web/anh-chup/ (chụp lại bằng scripts/chup.mjs), theo thứ tự hiện. */
const ANH_CHUP = [
  ["dang_nhap", "Màn đăng nhập"],
  ["dong_phu", "Động phủ, dashboard của người chơi"],
  ["ban_do", "Bản đồ tranh một vùng"],
  ["nhan_vat", "Màn Nhân vật, Pháp tướng"],
  ["tong_mon", "Màn Tông môn"],
  ["tran", "Trận đấu tự động"],
];

/** Danh sách nhóm. Mỗi ảnh: nguồn, đích, cách xuất ("pix" giữ nguyên điểm ảnh, "ve" thu nhỏ), chú thích. */
function nhom() {
  const tuSi = [];
  for (const [t, tt] of Object.entries(THAN))
    for (const [a, ta] of Object.entries(AO)) tuSi.push({ src: join(PL, "nhan_vat", t, a, "lon.png"), out: `tu_si/${t}_${a}.webp`, kieu: "pix", ten: `${tt}, ${ta}` });

  const thu = THU.map((id) => {
    const ten = tenTuManifest(`thu/${id}.png`, id);
    const phu = thuTuManifest(`thu/${id}.png`);
    return { src: join(PL, "thu", `${id}.png`), out: `thu/${id}.webp`, kieu: "pix", ten, phu };
  });

  const ctMau = Object.keys(CONG_TRINH).map((c) => ({
    src: join(PL, "cong_trinh", "kim_van_kiem_tong", `${c}.png`), out: `cong_trinh/kim_van_kiem_tong_${c}.webp`, kieu: "pix", ten: CONG_TRINH[c], phu: "Vạn Kiếm Tông, hệ Kim",
  }));
  const chinhDien = MO_HINH.slice(1).map(([m, he]) => ({
    src: join(PL, "cong_trinh", m, "chinh_dien.png"), out: `cong_trinh/${m}_chinh_dien.webp`, kieu: "pix",
    ten: tenTuManifest(`tong_mon/${m}.png`, m), phu: `Chính Điện, hệ ${HE[he]}`,
  }));
  const daoTong = MO_HINH.map(([m, he]) => ({
    src: join(PL, "tong_mon", `${m}.png`), out: `tong_mon/${m}.webp`, kieu: "pix", ten: tenTuManifest(`tong_mon/${m}.png`, m), phu: `Hệ ${HE[he]}`,
  }));
  const diem = DIEM.map(([id, ten]) => ({ src: join(PL, "diem", `${id}.png`), out: `diem/${id}.webp`, kieu: "pix", ten }));

  const tanQuyen = HE_IDS.map((h) => ({ src: join(IV, "tan_quyen", `${h}.webp`), out: `tan_quyen/${h}.webp`, kieu: "ve", ten: `Tàn quyển ${HE[h]}` }));
  const congPhap = HE_IDS.map((h) => ({ src: join(IV, "cong_phap", `${h}.webp`), out: `cong_phap/${h}.webp`, kieu: "ve", ten: `Công pháp ${HE[h]}` }));
  const chieu = Object.entries(CHIEU).map(([id, ten]) => ({ src: join(IV, "chieu", `${id}.webp`), out: `chieu/${id}.webp`, kieu: "ve", ten }));
  const ngoc = HE_IDS.map((h) => ({ src: join(IV, "ngoc", `${h}.webp`), out: `ngoc/${h}.webp`, kieu: "ve", ten: `Ngọc ${HE[h]}` }));
  const daoDo = HE_IDS.map((h, i) => ({ src: join(IV, "dao_do", h, `${(i % 5) + 1}.webp`), out: `dao_do/${h}.webp`, kieu: "dao", ten: `Đạo đồ ${HE[h]}` }));

  const canh = [
    { src: join(PL, "san_dau", "vo_truong.png"), out: "canh/vo_truong.webp", kieu: "pix", ten: "Võ trường" },
    { src: join(PL, "san_dau", "cao_nguyen.png"), out: "canh/cao_nguyen.webp", kieu: "pix", ten: "Cao nguyên" },
    { src: join(PL, "chien_truong", "loi_dinh_coc", "deo.png"), out: "canh/loi_dinh_coc_deo.webp", kieu: "pix", ten: "Đèo ở Lôi Đình Cốc" },
    { src: join(PL, "chien_truong", "van_nien_bang_nguyen", "deo.png"), out: "canh/bang_nguyen_deo.webp", kieu: "pix", ten: "Đèo ở Vạn Niên Băng Nguyên" },
  ];

  const chup = ANH_CHUP.map(([id, ten]) => ({ src: join(WEB, "anh-chup", `${id}.webp`), out: `anh_chup/${id}.webp`, kieu: "chup", ten }));

  return [
    { id: "anh_chup", ten: "Ảnh chụp bản thử", mo_ta: "Chụp từ prototype trên khung điện thoại. Giao diện còn đổi trước khi chơi thử.", nguon: "chụp màn hình prototype", anh: chup },
    { id: "tu_si", ten: "Tu sĩ", mo_ta: "Bốn thân, mỗi thân hai kiểu áo khởi đầu. Thân và đồ khởi đầu chỉ là hình, chỉ số như nhau.", nguon: "PixelLab", anh: tuSi },
    { id: "thu", ten: "Thú cưỡi", mo_ta: "28 trong 100 loài thú cưỡi, hai con mỗi hệ.", nguon: "PixelLab", anh: thu },
    { id: "cong_trinh", ten: "Công trình", mo_ta: "Đủ 11 công trình của Vạn Kiếm Tông, rồi Chính Điện của các mô hình tông môn khác.", nguon: "PixelLab", anh: [...ctMau, ...chinhDien] },
    { id: "dao", ten: "Đảo nổi trên bản đồ", mo_ta: "Mỗi điểm trên bản đồ tranh là một đảo nổi: sơn môn của các mô hình tông môn và các loại điểm tài nguyên.", nguon: "PixelLab", anh: [...daoTong, ...diem] },
    { id: "canh", ten: "Sân đấu và chiến trường", mo_ta: "Nền trận đấu tự động.", nguon: "PixelLab", anh: canh },
    { id: "vat_pham", ten: "Vật phẩm", mo_ta: "Tàn quyển, công pháp, 10 loại chiêu và ngọc theo 12 hệ, vẽ tay kiểu tranh.", nguon: "Canva", anh: [...tanQuyen, ...congPhap, ...chieu, ...ngoc] },
    { id: "dao_do", ten: "Đạo đồ", mo_ta: "Tranh mực hiện sau nhân vật, đổi theo công pháp và cảnh giới.", nguon: "Canva", anh: daoDo },
  ];
}

function bam(buf, kieu) {
  return createHash("sha1").update(buf).update(kieu).digest("hex").slice(0, 12);
}

async function xuat(a, camCu) {
  const dich = join(OUT, a.out);
  const goc = readFileSync(a.src);
  const h = bam(goc, a.kieu + "|2|" + (a.rong ?? ""));
  const cu = camCu[a.out];
  if (cu && cu.bam === h && existsSync(dich)) return { ...cu };
  mkdirSync(dirname(dich), { recursive: true });
  let img = sharp(goc);
  if (a.kieu === "pix") img = img.webp({ lossless: true, effort: 6 });
  else if (a.kieu === "ve") img = img.resize({ width: 320, withoutEnlargement: true }).webp({ quality: 80, effort: 6 });
  else if (a.kieu === "chup") img = img.resize({ width: 600, withoutEnlargement: true }).webp({ quality: 80, effort: 6 });
  else if (a.kieu === "brand") img = img.resize({ width: a.rong, withoutEnlargement: true }).webp({ quality: 88, alphaQuality: 92, effort: 6 });
  else if (a.kieu === "hero") img = img.resize({ width: a.rong, withoutEnlargement: true }).webp({ quality: 80, effort: 6 });
  else img = img.resize({ width: 360, withoutEnlargement: true }).webp({ quality: 78, effort: 6 });
  const info = await img.toFile(dich);
  return { bam: h, w: info.width, h: info.height, kb: Math.round(info.size / 102.4) / 10 };
}

const camPath = join(WEB, "src", "hinh.json");
const camCu = {};
if (existsSync(camPath)) {
  try {
    for (const g of JSON.parse(readFileSync(camPath, "utf8")).nhom) for (const a of g.anh) camCu[a.file] = a;
  } catch {}
}

const ketQua = [];
let tong = 0;
let so = 0;
for (const g of nhom()) {
  const anh = [];
  for (const a of g.anh) {
    if (!existsSync(a.src)) {
      console.warn("thiếu hình:", a.src);
      continue;
    }
    const r = await xuat(a, camCu);
    tong += statSync(join(OUT, a.out)).size;
    so++;
    anh.push({ file: a.out, ten: a.ten, phu: a.phu ?? "", kieu: a.kieu, w: r.w, h: r.h, bam: r.bam, kb: r.kb });
  }
  ketQua.push({ id: g.id, ten: g.ten, mo_ta: g.mo_ta, nguon: g.nguon, anh });
}

// Hình không nằm trong thư viện: dải 8 khung tu sĩ lơ lửng (96 × 96 mỗi khung) cho hình động ở trang chủ (CSS steps).
// Và công pháp ghép Lôi + Quang cho ví dụ ghép tàn quyển ở trang Điểm riêng (GDD mục 9: Lôi Quang Liên Hoàn Quyết).
const RIENG = [
  { src: join(PL, "nhan_vat", "nu_manh", "dao_bao", "dung_lo_lung.png"), out: "rieng/tu_si_lo_lung.webp", kieu: "pix", ten: "Tu sĩ lơ lửng" },
  { src: join(IV, "cong_phap", "ghep", "loi_quang.webp"), out: "rieng/cong_phap_loi_quang.webp", kieu: "ve", ten: "Lôi Quang Liên Hoàn Quyết" },
  // Dấu ấn Thiên Hoang Ký (assets/brand, tab icon Canva) thay ô đỏ chữ Hán: logo đầu trang, ấn lớn đầu trang chủ, trang cổng.
  { src: join(BRAND, "dau_an_256.png"), out: "brand/dau_an_96.webp", kieu: "brand", rong: 96, ten: "Dấu ấn nhỏ" },
  { src: join(BRAND, "dau_an.png"), out: "brand/dau_an_256.webp", kieu: "brand", rong: 256, ten: "Dấu ấn" },
  // Toàn cảnh Hạ vị diện (chụp bằng scripts/chup.mjs --chi=dai_luc --w=1440 --h=900) cho phần Thiên Hoang đại lục ở trang chủ.
  { src: join(WEB, "anh-chup", "dai_luc.webp"), out: "rieng/dai_luc.webp", kieu: "brand", rong: 1600, ten: "Hạ vị diện" },
  // Tranh thủy mặc người dùng gửi làm hero trang chủ (2026-11-05 tối; bản đã cắt logo, tab deploy cắt).
  { src: join(WEB, "anh-chup", "hero_thuy_mac.webp"), out: "rieng/hero_1880.webp", kieu: "hero", rong: 1880, ten: "Hero thủy mặc" },
  { src: join(WEB, "anh-chup", "hero_thuy_mac.webp"), out: "rieng/hero_960.webp", kieu: "hero", rong: 960, ten: "Hero thủy mặc nhỏ" },
];
const rieng = [];
for (const a of RIENG) {
  const r = await xuat(a, camCu);
  tong += statSync(join(OUT, a.out)).size;
  so++;
  rieng.push({ file: a.out, ten: a.ten, phu: "", kieu: a.kieu, w: r.w, h: r.h, bam: r.bam, kb: r.kb });
}
ketQua.push({ id: "rieng", ten: "Riêng", mo_ta: "Không hiện trong thư viện.", nguon: "PixelLab", anh: rieng });

// Favicon vẽ sẵn ở assets/brand (16 và 32 px): chép nguyên.
mkdirSync(join(OUT, "brand"), { recursive: true });
for (const f of ["favicon.ico", "favicon-32.png", "favicon-16.png"]) copyFileSync(join(BRAND, f), join(OUT, "brand", f));

writeFileSync(camPath, JSON.stringify({ ghi_chu: "Sinh bởi scripts/hinh.mjs, đừng sửa tay.", nhom: ketQua }, null, 1) + "\n");
console.log(`hinh: ${so} ảnh, ${(tong / 1024).toFixed(0)} KB trong public/hinh`);

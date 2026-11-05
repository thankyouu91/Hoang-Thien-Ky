// Dịch tên trên bản đồ (data/maps: điểm, địa hình, vùng) sang tiếng Anh theo từ điển âm tiết, ghi
// proto/src/dashboard/i18n/en_ban_do.json (i18n.ts nạp cùng en.json khi chọn tiếng Anh).
// Tên do tools/mapgen/ten.ts sinh theo khuôn "âm tiết 1 + âm tiết 2 + hậu tố loại điểm/địa hình" ("Lôi Hạc Động"), nên
// dịch từng âm tiết theo một nghĩa cố định và hậu tố theo loại: "Thunder Crane Cave". Bản đồ sinh lại thì chạy lại công cụ.
// Tên không theo khuôn (thiếu âm tiết trong từ điển, số chữ khác) lấy từ tools/i18n/ten_ban_do_tay.json (dịch tay); còn
// thiếu thì in ra để bổ sung.
// Chạy: node tools/i18n/ten_ban_do.cjs
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "../..");
const VI = /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i;

/** Mỗi âm tiết một nghĩa (chữ đa nghĩa chọn nghĩa hợp nhiều chỗ nhất). Đề xuất, sửa thoải mái. */
const AM = {
  // kim
  Kim: "Gold", Kiếm: "Sword", Ngân: "Silver", Thiết: "Iron", Cương: "Steel", Duệ: "Keen", Bạch: "White", Phong: "Wind",
  // mộc
  Mộc: "Wood", Lâm: "Forest", Tùng: "Pine", Trúc: "Bamboo", Diệp: "Leaf", Liễu: "Willow", Hoa: "Flower", Thanh: "Azure",
  // thủy
  Thủy: "Water", Ba: "Wave", Lam: "Mist", Giang: "River", Hồ: "Lake", Bích: "Emerald", Lãng: "Billow", Triều: "Tide",
  // hỏa
  Hỏa: "Fire", Viêm: "Flame", Xích: "Crimson", Diễm: "Blaze", Liệt: "Fierce", Dung: "Molten", Đan: "Cinnabar", Hồng: "Scarlet",
  // thổ
  Thổ: "Earth", Sơn: "Mountain", Hoàng: "Yellow", Nham: "Crag", Khâu: "Hill", Hậu: "Deep", Địa: "Ground", Thạch: "Stone",
  // lôi
  Lôi: "Thunder", Điện: "Lightning", Vân: "Cloud", Chấn: "Quake", Đình: "Bolt", Lăng: "Soaring", Tử: "Purple", Minh: "Mystic",
  // phong
  Toàn: "Whirl", Phiêu: "Drift", Dương: "Yang", Thảo: "Grass", Khiếu: "Howl",
  // quang
  Quang: "Light", Diệu: "Radiant", Huy: "Gleam", Nhật: "Sun", Thần: "Divine",
  // âm lãnh, cực âm, cực hàn, hỗn độn
  U: "Nether", Âm: "Yin", Hàn: "Frost", Vụ: "Fog", Đầm: "Marsh", Tịch: "Silent", Lãnh: "Chill", Sa: "Sand",
  Uyên: "Abyss", Ám: "Shadow", Huyền: "Profound", Cửu: "Nine", Mặc: "Ink",
  Băng: "Ice", Tuyết: "Snow", Sương: "Rime", Lẫm: "Bleak", Đông: "Winter",
  Hỗn: "Chaos", Độn: "Murk", Hoang: "Wild", Cổ: "Ancient", Huyết: "Blood", Thái: "Supreme", Ma: "Demon", Diệt: "Ruin",
  // kho chung
  Nguyệt: "Moon", Hạc: "Crane", Long: "Dragon", Hổ: "Tiger", Ngọc: "Jade", Linh: "Spirit", Tiên: "Immortal", Phượng: "Phoenix",
  Lộc: "Deer", An: "Peace", Bình: "Calm", Trường: "Eternal", Lục: "Green", Hà: "Stream", Khê: "Brook", Yên: "Haze",
  Lạc: "Joy", Tĩnh: "Still", Nhạn: "Goose", Mai: "Plum", Lan: "Orchid", Hương: "Fragrant", Châu: "Pearl", Phù: "Floating",
  Đào: "Peach", Uyển: "Garden", Kỳ: "Rare", Thúy: "Verdant", Ẩn: "Hidden", Đạo: "Dao", Hư: "Void", Tinh: "Star",
};

/** Hậu tố theo loại điểm và địa hình (tools/mapgen/ten.ts SUFFIX, FEATURE_SUFFIX). Hậu tố hai chữ thử trước. */
const HAU_TO = {
  "Linh Khoáng": "Spirit Mine", "Thạch Mạch": "Stone Vein", "Thiết Sơn": "Iron Mountain", "Dược Cốc": "Herb Valley",
  "Linh Điền": "Spirit Field", "Bí Cảnh": "Secret Realm", "Hoàng Sào": "Royal Nest", "Vương Huyệt": "King's Lair",
  "Tuyết Nguyên": "Snowfield", "Băng Nguyên": "Icefield",
  Thành: "City", Phong: "Peak", Sơn: "Mountain", Nhai: "Cliff", Cốc: "Valley", Đỉnh: "Summit", Khoáng: "Mine",
  Tuyền: "Spring", Động: "Cave", Quật: "Grotto", Huyệt: "Den", Quan: "Pass", Độ: "Ferry",
  Khê: "Brook", Thủy: "River", Hà: "River", Giang: "River", Lĩnh: "Ridge", Lâm: "Forest", Dã: "Wilds", Bình: "Plain",
  Sa: "Sands", Mạc: "Desert", Trạch: "Marsh", Đàm: "Pool", Địa: "Land",
};
const HAU_TO_SAP = Object.keys(HAU_TO).sort((a, b) => b.split(" ").length - a.split(" ").length);

/** "Lôi Hạc Động" → "Thunder Crane Cave"; không theo khuôn (đúng hai âm tiết có trong từ điển + hậu tố) thì undefined. */
function dich(ten) {
  const w = ten.trim().split(/\s+/);
  for (const h of HAU_TO_SAP) {
    const hw = h.split(" ");
    if (w.length !== hw.length + 2) continue;
    if (w.slice(2).join(" ") !== h) continue;
    const [a, b] = w;
    if (AM[a] && AM[b]) return `${AM[a]} ${AM[b]} ${HAU_TO[h]}`;
  }
  return undefined;
}

const KEYS = new Set(["ten", "name", "label", "nhan", "tieu_de", "mo_ta", "ten_ngan"]);
const ten = new Map();
function walk(o, f, k) {
  if (typeof o === "string") {
    if (KEYS.has(k) && VI.test(o) && o.length <= 80 && !ten.has(o)) ten.set(o, f);
    return;
  }
  if (Array.isArray(o)) o.forEach((x) => walk(x, f, k));
  else if (o && typeof o === "object") for (const [kk, v] of Object.entries(o)) walk(v, f, kk);
}
const dir = path.join(ROOT, "data/maps");
for (const f of fs.readdirSync(dir)) {
  if (!f.endsWith(".json")) continue;
  try {
    walk(JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")), f);
  } catch {
    // không phải JSON hợp lệ: bỏ qua
  }
}

const en = JSON.parse(fs.readFileSync(path.join(ROOT, "proto/src/dashboard/i18n/en.json"), "utf8"));
const tayFile = path.join(__dirname, "ten_ban_do_tay.json");
const tay = fs.existsSync(tayFile) ? JSON.parse(fs.readFileSync(tayFile, "utf8")) : {};
// Mẫu có biến của bảng chính ("Thần vực {}") cũng tính là đã dịch.
const mau = Object.keys(en)
  .filter((k) => k.includes("{}"))
  .map((k) => new RegExp("^" + k.split("{}").map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("(.+?)") + "$", "su"));
const out = {};
const thieu = [];
let khuon = 0;
for (const [vi, f] of ten) {
  if (en[vi] || mau.some((re) => re.test(vi) && !/^\(\.\+\?\)/.test(re.source.slice(1)))) continue; // đã có trong bảng chính
  const t = tay[vi] ?? dich(vi);
  if (t) {
    out[vi] = t;
    if (!tay[vi]) khuon++;
  } else thieu.push({ vi, where: f });
}
const sorted = Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b, "vi")));
fs.writeFileSync(path.join(ROOT, "proto/src/dashboard/i18n/en_ban_do.json"), JSON.stringify(sorted, null, 1) + "\n");
console.log(`tên trên bản đồ ${ten.size}: dịch theo khuôn ${khuon}, dịch tay ${Object.keys(out).length - khuon}, chưa dịch ${thieu.length}`);
if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify(thieu, null, 1));
else if (thieu.length) console.log(thieu.slice(0, 60).map((x) => x.vi).join(" | "));

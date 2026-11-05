// Dịch tên trên bản đồ (data/maps: điểm, địa hình, vùng) sang tiếng Anh, ghi proto/src/dashboard/i18n/en_ban_do.json
// (i18n.ts nạp cùng en.json khi chọn tiếng Anh).
// Tên do tools/mapgen/ten.ts sinh theo khuôn "âm tiết 1 + âm tiết 2 + hậu tố loại điểm/địa hình" ("Lôi Hạc Động"), nên dịch
// từng âm tiết theo một nghĩa cố định và hậu tố theo loại: "Thunder Crane Cave". Từ điển ở proto/src/dashboard/i18n/am_tiet.json,
// dùng chung với bộ tra lúc chạy (i18nTra.ts), nên tên ghép mới (tông NPC trong mock) cũng tự dịch dù chưa có trong bảng.
// Tên không theo khuôn lấy từ tools/i18n/ten_ban_do_tay.json (dịch tay); còn thiếu thì in ra để bổ sung.
// Bản đồ sinh lại thì chạy lại. Chạy: node tools/i18n/ten_ban_do.cjs [thiếu.json]
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "../..");
const VI = /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i;
const { am: AM, hau_to: HAU_TO } = JSON.parse(fs.readFileSync(path.join(ROOT, "proto/src/dashboard/i18n/am_tiet.json"), "utf8"));
const HAU_TO_SAP = Object.keys(HAU_TO).sort((a, b) => b.split(" ").length - a.split(" ").length);

/** "Lôi Hạc Động" → "Thunder Crane Cave"; không theo khuôn (đúng hai âm tiết có trong từ điển + hậu tố) thì undefined. */
function dich(ten) {
  const w = ten.trim().split(/\s+/);
  for (const h of HAU_TO_SAP) {
    const hw = h.split(" ");
    if (w.length !== hw.length + 2 || w.slice(2).join(" ") !== h) continue;
    const [a, b] = w;
    if (AM[a] && AM[b]) return `${AM[a]} ${AM[b]} ${HAU_TO[h]}`;
  }
  return undefined;
}

const KEYS = new Set(["ten", "name", "label", "nhan", "tieu_de", "mo_ta", "ten_ngan"]);
const ten = new Map();
function walk(o, f, k) {
  if (typeof o === "string") {
    // Tên không dấu ("Ma Linh Quan") vẫn là tên Việt: nhận khi khớp khuôn âm tiết.
    if (KEYS.has(k) && (VI.test(o) || dich(o)) && o.length <= 80 && !ten.has(o)) ten.set(o, f);
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
// Mẫu có biến của bảng chính ("Thần vực {}") dùng để biết tên nào còn thiếu thật khi báo cáo.
const mau = Object.keys(en)
  .filter((k) => k.includes("{}") && /\p{L}/u.test(k.replace(/\{\}/g, "")))
  .map((k) => new RegExp("^" + k.split("{}").map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("(.+?)") + "$", "su"));
const out = {};
const thieu = [];
let khuon = 0;
for (const [vi, f] of ten) {
  if (en[vi]) continue; // đã có khóa cố định trong bảng chính (vùng, tông môn…)
  const t = tay[vi] ?? dich(vi);
  if (t) {
    out[vi] = t;
    if (!tay[vi]) khuon++;
  } else if (!mau.some((re) => re.test(vi))) thieu.push({ vi, where: f });
}
const sorted = Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b, "vi")));
fs.writeFileSync(path.join(ROOT, "proto/src/dashboard/i18n/en_ban_do.json"), JSON.stringify(sorted, null, 1) + "\n");
console.log(`tên trên bản đồ ${ten.size}: dịch theo khuôn ${khuon}, dịch tay ${Object.keys(out).length - khuon}, chưa dịch ${thieu.length}`);
if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify(thieu, null, 1));
else if (thieu.length) console.log(thieu.slice(0, 60).map((x) => x.vi).join(" | "));

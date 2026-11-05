// Trích chữ nội dung game có thể hiện trên giao diện từ dữ liệu JSON (tên, mô tả ngắn, hiệu ứng…) để dịch.
// Chạy: node tools/i18n/noi_dung.cjs [ra.json]  — in số chuỗi theo tệp; có ra.json thì ghi [{vi, where}] cho chuỗi chưa có trong en.json.
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "../..");
const VI = /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i;
const KEYS = new Set(["ten", "name", "label", "nhan", "tieu_de", "mo_ta", "moTa", "hieu_ung", "combat", "ten_ngan", "loai_ten", "nhom", "noi_dung", "thuong", "dieu_kien", "ghi_chu_ngan", "condition", "effect"]);
const per = {};
const all = new Map();

function walk(o, f, k) {
  if (typeof o === "string") {
    if (KEYS.has(k) && VI.test(o) && o.length <= 200) {
      if (!all.has(o)) all.set(o, f);
      per[f] = (per[f] ?? 0) + 1;
    }
    return;
  }
  if (Array.isArray(o)) o.forEach((x) => walk(x, f, k));
  else if (o && typeof o === "object") for (const [kk, v] of Object.entries(o)) walk(v, f, kk);
}
function files(d) {
  return fs.readdirSync(d).flatMap((x) => {
    const p = path.join(d, x);
    if (fs.statSync(p).isDirectory()) return /ha_nen|ha_mini/.test(x) ? [] : files(p);
    return p.endsWith(".json") ? [p] : [];
  });
}
for (const f of [...files(path.join(ROOT, "data/he_thong/json")), ...files(path.join(ROOT, "data/maps"))]) {
  try {
    walk(JSON.parse(fs.readFileSync(f, "utf8")), path.relative(ROOT, f).replace(/\\/g, "/"));
  } catch {
    // tệp không phải JSON hợp lệ: bỏ qua
  }
}
const en = JSON.parse(fs.readFileSync(path.join(ROOT, "proto/src/dashboard/i18n/en.json"), "utf8"));
const chua = [...all].filter(([k]) => !en[k]).map(([vi, where]) => ({ vi, where }));
console.log(`tổng ${all.size}, chưa dịch ${chua.length}`);
for (const [f, n] of Object.entries(per).sort((a, b) => b[1] - a[1]).slice(0, 30)) console.log(n, f);
if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify(chua, null, 1));

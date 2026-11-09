// Gộp các tệp dịch { "chữ Việt": "English" } vào proto/src/dashboard/i18n/en.json (tệp sau đè tệp trước, en.json hiện có
// được giữ trừ khi tệp mới có cùng khóa), soát số chỗ biến "{}" hai bên khớp nhau rồi ghi lại theo thứ tự khóa.
// Chạy: node tools/i18n/gop.cjs <tệp.json>...   (không đối số: chỉ soát en.json)
const fs = require("fs");
const path = require("path");

const EN = path.resolve(__dirname, "../../proto/src/dashboard/i18n/en.json");
const dict = fs.existsSync(EN) ? JSON.parse(fs.readFileSync(EN, "utf8")) : {};
let them = 0;
for (const f of process.argv.slice(2)) {
  const part = JSON.parse(fs.readFileSync(f, "utf8"));
  for (const [k, v] of Object.entries(part)) {
    if (dict[k] !== v) them++;
    dict[k] = v;
  }
}
const loi = [];
for (const [k, v] of Object.entries(dict)) {
  const nk = (k.match(/\{\}/g) ?? []).length;
  const nv = (v.match(/\{\d*\}/g) ?? []).length;
  if (nk !== nv) loi.push(`${JSON.stringify(k)} → ${JSON.stringify(v)} (${nk} ≠ ${nv})`);
  for (const m of v.matchAll(/\{(\d+)\}/g)) if (Number(m[1]) < 1 || Number(m[1]) > nk) loi.push(`${JSON.stringify(k)}: {${m[1]}} ngoài 1…${nk}`);
}
const sorted = Object.fromEntries(Object.entries(dict).sort(([a], [b]) => a.localeCompare(b, "vi")));
fs.mkdirSync(path.dirname(EN), { recursive: true });
fs.writeFileSync(EN, JSON.stringify(sorted, null, 1) + "\n");
console.log(`en.json: ${Object.keys(sorted).length} khóa, ${them} khóa mới hoặc đổi`);
if (loi.length) {
  console.log(`Lệch chỗ biến (${loi.length}):\n` + loi.join("\n"));
  process.exitCode = 1;
}

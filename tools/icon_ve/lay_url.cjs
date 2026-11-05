// Lấy URL PNG xuất từ Canva ra khỏi transcript phiên Claude (URL dài, chép tay dễ sai).
// Chạy: node lay_url.cjs <design id> <khóa job> <file ra>
// Khóa job là số sau số trang trong URL xuất, ví dụ ".../0036-8215086899566695621.png" → 8215086899566695621.
// Quét mọi *.jsonl trong ~/.claude/projects sửa trong 6 giờ gần nhất; mỗi trang giữ một URL.
const fs = require("fs"), path = require("path"), os = require("os");
const [design, khoa, ra] = process.argv.slice(2);
if (!design || !khoa || !ra) throw new Error("Thiếu tham số: <design> <khóa job> <file ra>");
const goc = path.join(os.homedir(), ".claude", "projects");
const moi = Date.now() - 6 * 3600 * 1000;
const re = new RegExp(`https://export-download\\.canva\\.com/[^/"\\\\]+/${design}/-1/0/(\\d{4})-${khoa}\\.png[^"\\\\\\s]*`, "g");
const theoTrang = {};
for (const d of fs.readdirSync(goc)) {
  const dd = path.join(goc, d);
  if (!fs.statSync(dd).isDirectory()) continue;
  for (const f of fs.readdirSync(dd)) {
    if (!f.endsWith(".jsonl")) continue;
    const p = path.join(dd, f);
    if (fs.statSync(p).mtimeMs < moi) continue;
    for (const m of fs.readFileSync(p, "utf8").matchAll(re)) theoTrang[m[1]] = m[0];
  }
}
const urls = Object.keys(theoTrang).sort().map(k => theoTrang[k]);
fs.writeFileSync(ra, urls.join("\n") + "\n");
console.log("url", urls.length, "trang", Object.keys(theoTrang).sort().join(","));

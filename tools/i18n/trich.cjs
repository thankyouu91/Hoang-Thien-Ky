// Trích chữ tiếng Việt hiện trên giao diện từ mã TS: chuỗi '…', "…" và template `…${}…` (kể cả lồng), bỏ chú thích,
// tách theo thẻ HTML; lấy cả giá trị thuộc tính aria-label, title, placeholder, alt. Phần ${…} ghi là {}.
// Chạy: node tools/i18n/trich.cjs <tệp hoặc thư mục>... > ra.json
// Ra: { exact: {chữ: [nơi]}, pattern: {mẫu có {}: [nơi]} } — dùng để soạn proto/src/dashboard/i18n/en.ts.
const fs = require("fs");
const path = require("path");

const VI = /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i;

/** Quét một tệp, trả danh sách { text, line } (template: các đoạn chữ nối bằng "{}"). */
function scan(src) {
  const out = [];
  let i = 0;
  const line = (p) => src.slice(0, p).split("\n").length;
  function readQuoted(q) {
    const start = i;
    i++;
    let s = "";
    while (i < src.length && src[i] !== q) {
      if (src[i] === "\\") { s += src[i + 1] === "n" ? "\n" : src[i + 1]; i += 2; continue; }
      if (src[i] === "\n") break;
      s += src[i++];
    }
    i++;
    out.push({ text: s, line: line(start) });
  }
  function readTemplate() {
    const start = i;
    i++;
    let s = "";
    while (i < src.length && src[i] !== "`") {
      if (src[i] === "\\") { s += src[i + 1]; i += 2; continue; }
      if (src[i] === "$" && src[i + 1] === "{") {
        i += 2;
        code(1);
        s += "{}";
        continue;
      }
      s += src[i++];
    }
    i++;
    out.push({ text: s, line: line(start) });
  }
  /** Đọc mã tới khi gặp `}` khớp (depth > 0) hoặc hết tệp (depth 0). */
  function code(depth) {
    let d = depth;
    while (i < src.length) {
      const c = src[i];
      const n = src[i + 1];
      if (c === "/" && n === "/") { while (i < src.length && src[i] !== "\n") i++; continue; }
      if (c === "/" && n === "*") { const e = src.indexOf("*/", i + 2); i = e < 0 ? src.length : e + 2; continue; }
      if (c === "'" || c === '"') { readQuoted(c); continue; }
      if (c === "`") { readTemplate(); continue; }
      if (c === "{") d++;
      if (c === "}") { d--; if (depth > 0 && d === 0) { i++; return; } }
      i++;
    }
  }
  code(0);
  return out;
}

/** Tách chữ hiện ra từ một chuỗi (có thể chứa HTML): đoạn chữ giữa các thẻ và giá trị thuộc tính hiển thị. */
function pieces(text) {
  const res = [];
  for (const m of text.matchAll(/\b(?:aria-label|title|placeholder|alt|data-done)="([^"]*)"/g)) res.push(m[1]);
  for (const chunk of text.split(/<[^>]*>/)) res.push(chunk);
  return res
    .map((x) => x.replace(/\s+/g, " ").trim())
    .filter((x) => VI.test(x.replace(/\{\}/g, "")));
}

function files(p) {
  const st = fs.statSync(p);
  if (st.isFile()) return [p];
  return fs.readdirSync(p).flatMap((f) => files(path.join(p, f))).filter((f) => /\.ts$/.test(f) && !/\.test\.ts$/.test(f));
}

const exact = {};
const pattern = {};
for (const f of process.argv.slice(2).flatMap(files)) {
  const rel = path.relative(process.cwd(), f).replace(/\\/g, "/");
  for (const { text, line } of scan(fs.readFileSync(f, "utf8"))) {
    for (const p of pieces(text)) {
      const box = p.includes("{}") ? pattern : exact;
      (box[p] ??= []).push(`${rel}:${line}`);
    }
  }
}
process.stdout.write(JSON.stringify({ exact, pattern }, null, 1));
console.error(`chữ cố định ${Object.keys(exact).length}, mẫu có biến ${Object.keys(pattern).length}`);

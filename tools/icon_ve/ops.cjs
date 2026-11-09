// Sinh lệnh edit-design cho một lô từ tach.tsv (ma<TAB>media đã tách nền).
// node ops.cjs add <thư mục lô>                      → in mảng add_page 512×512, mỗi món một trang.
// node ops.cjs fill <thư mục lô> <trang đầu> <id trang...> → ghi trang.tsv và in mảng insert_fill.
// node ops.cjs sap <thư mục lô>                      → xếp lại nhat_ky.tsv và tach.tsv theo thứ tự lo.tsv; in số món còn thiếu.
const fs = require("fs"), path = require("path");
const [cmd, dir, dau, ...pid] = process.argv.slice(2);
if (cmd === "sap") {
  const doc = f => fs.existsSync(path.join(dir, f)) ? fs.readFileSync(path.join(dir, f), "utf8").trim().split("\n").filter(Boolean).map(l => l.replace(/\r$/, "").split("\t")) : [];
  const thuTu = doc("lo.tsv").map(r => r[0]);
  for (const f of ["nhat_ky.tsv", "tach.tsv"]) {
    const theoMa = Object.fromEntries(doc(f).map(r => [r[0], r]));
    const ds = thuTu.filter(m => theoMa[m]).map(m => theoMa[m].join("\t"));
    if (ds.length) fs.writeFileSync(path.join(dir, f), ds.join("\n") + "\n");
    console.log(f, ds.length + "/" + thuTu.length, "thiếu:", thuTu.filter(m => !theoMa[m]).join(" ") || "không");
  }
  process.exit(0);
}
const t = fs.readFileSync(path.join(dir, "tach.tsv"), "utf8").trim().split("\n").map(l => l.replace(/\r$/, "").split("\t"));
if (cmd === "add") console.log(JSON.stringify(t.map(([m]) => ({ type: "add_page", width: 512, height: 512, title: m }))));
else if (cmd === "fill") {
  if (pid.length !== t.length) throw new Error(`lệch: ${pid.length} trang, ${t.length} ảnh`);
  fs.writeFileSync(path.join(dir, "trang.tsv"), t.map(([m], i) => `${m}\t${pid[i]}\t${+dau + i}`).join("\n") + "\n");
  console.log(JSON.stringify(t.map(([m, a], i) => ({ type: "insert_fill", page_id: pid[i], asset_type: "image", asset_id: a, alt_text: m, top: 0, left: 0, width: 512, height: 512 }))));
} else throw new Error("Lệnh: add | fill");

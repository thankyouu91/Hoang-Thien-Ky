// Trợ lý cho tác vụ vẽ icon ban đêm (22:00–6:00): khóa chống chạy chồng, nhớ cooldown Canva, chọn lô đang làm.
// Thư mục làm việc ngoài repo: %LOCALAPPDATA%\ktlp-icon-ve (đổi bằng biến ICON_VE_LAM):
//   node_modules/ (sharp), lo/xuatNN/ (mỗi lô một thư mục), trang_thai.json, nhat_ky_dem.txt.
// Lệnh:
//   node dem.cjs bat-dau      kiểm giờ, khóa, cooldown; chọn hoặc tạo lô; in trạng thái JSON. Mã thoát khác 0 = không làm.
//   node dem.cjs ket-thuc [cooldown] [ghi chú...]   mở khóa; "cooldown" ghi lại lúc Canva báo hết lượt.
//   node dem.cjs xong <thư mục lô> [commit]          đánh dấu lô đã commit.
//   node dem.cjs to-xuat <design id>                 ghi tờ xuất đang dùng.
//   node dem.cjs trang-thai                          in trạng thái, không khóa.
const fs = require("fs"), path = require("path"), { execFileSync } = require("child_process");
const W = process.env.ICON_VE_LAM || path.join(process.env.LOCALAPPDATA || "", "ktlp-icon-ve");
const LO = path.join(W, "lo"), TT = path.join(W, "trang_thai.json"), LOG = path.join(W, "nhat_ky_dem.txt");
const KHOA_PHUT = 50, COOLDOWN_PHUT = 20, SO_MON = 24;
fs.mkdirSync(LO, { recursive: true });
const doc = () => fs.existsSync(TT) ? JSON.parse(fs.readFileSync(TT, "utf8")) : {};
const ghi = s => fs.writeFileSync(TT, JSON.stringify(s, null, 2) + "\n");
const log = s => fs.appendFileSync(LOG, `${new Date().toLocaleString("sv-SE")}  ${s}\n`);
const phut = iso => iso ? (Date.now() - Date.parse(iso)) / 60000 : Infinity;
const dong = f => fs.existsSync(f) ? fs.readFileSync(f, "utf8").trim().split("\n").filter(Boolean).length : 0;

function cacLo() {
  return fs.readdirSync(LO).filter(d => /^xuat\d+$/.test(d)).sort((a, b) => +a.slice(4) - +b.slice(4));
}
function trangThaiLo(d) {
  const p = path.join(LO, d);
  return {
    lo: p, ten: d, tong: dong(path.join(p, "lo.tsv")), da_ve: dong(path.join(p, "nhat_ky.tsv")),
    da_tach: dong(path.join(p, "tach.tsv")), co_trang: dong(path.join(p, "trang.tsv")),
    co_url: dong(path.join(p, "url.txt")), xong: fs.existsSync(path.join(p, "xong.txt")),
  };
}
function loDangLam(taoMoi) {
  const ds = cacLo();
  const dang = ds.find(d => !fs.existsSync(path.join(LO, d, "xong.txt")));
  if (dang) return trangThaiLo(dang);
  if (!taoMoi) return null;
  const so = ds.length ? +ds[ds.length - 1].slice(4) + 1 : 20;
  const ra = execFileSync("node", [path.join(__dirname, "lo_tiep.cjs"), String(SO_MON)], { encoding: "utf8" }).trim();
  if (!ra) return { het: true };
  const p = path.join(LO, "xuat" + so);
  fs.mkdirSync(p, { recursive: true });
  fs.writeFileSync(path.join(p, "lo.tsv"), ra + "\n");
  log(`tạo lô xuat${so}: ${ra.split("\n").length} món`);
  return trangThaiLo("xuat" + so);
}

const [cmd, ...a] = process.argv.slice(2);
const s = doc();
if (cmd === "bat-dau") {
  const h = new Date().getHours();
  if (!(h >= 22 || h < 6) && !process.env.BAT_KE_GIO) { console.log("NGOAI_GIO"); process.exit(2); }
  if (phut(s.khoa) < KHOA_PHUT) { console.log("DANG_CHAY từ " + s.khoa); process.exit(3); }
  if (phut(s.cooldown) < COOLDOWN_PHUT) { console.log("COOLDOWN từ " + s.cooldown); process.exit(4); }
  const lo = loDangLam(true);
  if (lo.het) { console.log("HET: không còn món ưu tiên 2 chưa vẽ"); process.exit(5); }
  s.khoa = new Date().toISOString();
  ghi(s);
  log(`bắt đầu, lô ${lo.ten}: ${lo.da_ve}/${lo.tong} đã vẽ, ${lo.da_tach} đã tách`);
  console.log(JSON.stringify({ ...lo, to_xuat: s.to_xuat || null, node_path: path.join(W, "node_modules") }, null, 1));
} else if (cmd === "ket-thuc") {
  s.khoa = null;
  if (a[0] === "cooldown") { s.cooldown = new Date().toISOString(); a.shift(); }
  ghi(s);
  log("kết thúc" + (s.cooldown && phut(s.cooldown) < 1 ? " (cooldown)" : "") + (a.length ? ": " + a.join(" ") : ""));
  console.log("đã mở khóa");
} else if (cmd === "xong") {
  const p = path.resolve(a[0]);
  fs.writeFileSync(path.join(p, "xong.txt"), (a[1] || "") + "\n");
  log(`lô ${path.basename(p)} xong ${a[1] || ""}`);
  console.log("đã đánh dấu");
} else if (cmd === "to-xuat") {
  s.to_xuat = a[0]; ghi(s); log("tờ xuất " + a[0]); console.log("tờ xuất", a[0]);
} else if (cmd === "trang-thai") {
  console.log(JSON.stringify({ ...s, lo_dang_lam: loDangLam(false), lam_viec: W }, null, 1));
} else {
  console.error("Lệnh: bat-dau | ket-thuc [cooldown] | xong <lô> [commit] | to-xuat <id> | trang-thai");
  process.exit(1);
}

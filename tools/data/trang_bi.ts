// Trang bị, pháp bảo, ngọc, set đồ và vật phẩm (GDD tab "Trang bị, pháp bảo và set đồ"; mọi số là đề xuất).
// Mỗi bảng con của 7 file trang bị (trang_bi, vu_khi, ngoc, set, phap_bao, phap_khi, vat_pham) thành một sheet; xuat.ts ghép
// các sheet lại đúng cấu trúc đó trong data/he_thong/json. Lần đầu dựng từ bản nháp data/trang_bi của phiên set đồ (đã bỏ ở
// e79c326); giờ tao.ts dựng lại từ data/he_thong/json, vốn xuất từ chính file Excel.
import { existsSync, readFileSync } from "node:fs";
import * as B from "./bang.ts";

export interface PartDef {
  def: B.TableDef;
  file: string; // file JSON ghép
  path: string; // chỗ đặt mảng dòng trong file đó; trống = ghép riêng (Set mốc, Luật, Ghi chú)
}

const c = (key: string, header: string, kind: B.Kind, more: Partial<B.Col> = {}): B.Col =>
  ({ key, header, kind, src: key === "ma_vp" || key === "id" ? "code" : "de_xuat", ...more });
const T = (sheet: string, file: string, path: string, id: string, cols: B.Col[], width = 14): PartDef => ({
  def: { kind: "table", sheet, id, shape: "list", cols: cols.map((x) => ({ width, ...x })) }, file, path,
});
const nguon = c("nguon", "Nguồn", "list", { width: 34 });
const moTa = c("mo_ta", "Mô tả", "text", { width: 50 });

export const PARTS: PartDef[] = [
  T("Độ hiếm", "trang_bi.json", "do_hiem", "id", [
    c("id", "Mã", "text"), c("ten", "Tên", "text"), c("bac", "Bậc", "int"), c("he_so", "Hệ số chỉ số", "mul"),
    c("dong_kham", "Số dòng khảm", "int"), c("nguon", "Nguồn", "text", { width: 50 }),
  ]),
  T("Ô trang bị", "trang_bi.json", "o", "id", [
    c("id", "Mã", "text"), c("ma", "Mã ngắn", "text"), c("ten", "Tên", "text"),
    c("chinh_stat", "Chỉ số chính", "text", { json: "chinh.stat" }), c("chinh_ten", "Tên chỉ số chính", "text", { json: "chinh.ten" }),
    c("chinh_gia_tri", "Chỉ số chính (theo chỉ số chuẩn cùng cấp)", "pct", { json: "chinh.gia_tri" }),
    c("phu_stat", "Chỉ số phụ", "text", { json: "phu.stat" }), c("phu_ten", "Tên chỉ số phụ", "text", { json: "phu.ten" }),
    c("phu_gia_tri", "Chỉ số phụ (theo chỉ số chuẩn cùng cấp)", "pct", { json: "phu.gia_tri" }),
    c("ngoc", "Ô ngọc (cong: công, thu: thủ)", "text"), c("hien_tren_nguoi", "Hiện trên người", "bool"),
    c("cong_thuc_ren", "Công thức rèn (khóa: số lượng)", "kv", { width: 40 }),
  ]),
  T("Kiểu trang bị", "trang_bi.json", "kieu", "ma_vp", [
    c("ma_vp", "Mã vật phẩm", "text"), c("o", "Ô", "text"), c("so", "Số", "int"), c("ten", "Tên", "text", { width: 22 }),
    c("do_hiem", "Độ hiếm", "text"), c("khi_hinh", "Khí hình", "text", { optional: true }),
    c("ten_de_xuat", "Tên đề xuất theo khí hình", "text", { optional: true, width: 22 }), c("dang", "Dáng", "text", { optional: true }),
    moTa, nguon,
  ]),
  T("Khí hình", "vu_khi.json", "khi_hinh", "id", [
    c("id", "Mã", "text"), c("ten", "Tên", "text"), c("loai_chieu", "Loại chiêu", "text"), moTa,
    c("y_chau", "Ý châu", "text"), c("so_kieu", "Số kiểu vũ khí", "int"),
  ]),
  T("Hình khi cầm", "vu_khi.json", "hinh_khi_cam", "tai_nang", [
    c("tai_nang", "Tài năng", "text"), c("ten", "Tên", "text"), c("ma_vp", "Mã vật phẩm", "text"),
  ]),
  T("Ngọc hệ", "ngoc.json", "he", "ma_vp", [
    c("ma_vp", "Mã vật phẩm", "text"), c("he", "Hệ", "text"), c("ten", "Tên", "text"), c("ten_han_viet", "Tên Hán Việt", "text", { width: 18 }), nguon,
  ]),
  T("Ngọc cấp", "ngoc.json", "cap", "cap", [
    c("cap", "Cấp", "int"), c("gia_tri", "Sát thương hoặc kháng hệ", "pct"),
    c("ty_le_nen_len", "Tỷ lệ nén lên cấp này", "pct", { nullable: true }), c("khoa", "Khóa vào nhân vật", "bool"),
  ]),
  T("Ý châu", "ngoc.json", "y_chau", "ma_vp", [
    c("ma_vp", "Mã vật phẩm", "text"), c("ten", "Tên", "text"), c("khi_hinh", "Khí hình", "text"), c("loai_chieu", "Loại chiêu", "text"),
    c("chi_kham_vao", "Chỉ khảm vào", "text"), moTa, c("tham_so", "Tham số (đơn vị code)", "kv", { width: 40 }),
    c("ban_cho", "Bán ở chợ", "bool"), nguon,
  ]),
  T("Ấn bộ", "ngoc.json", "an_bo", "ma_vp", [
    c("ma_vp", "Mã vật phẩm", "text"), c("ten", "Tên", "text"), c("bo", "Bộ", "text"), c("ban_cho", "Bán ở chợ", "bool"), nguon,
  ]),
  T("Set", "set.json", "bo", "id", [
    c("id", "Mã bộ", "text"), c("ten", "Tên", "text"), c("nguon", "Bí cảnh ra ấn", "text", { width: 20 }), c("chu_de", "Chủ đề", "text"),
    c("gan_voi", "Gắn với", "kv", { width: 30 }), c("than", "Bộ thần", "bool"),
    c("rang_buoc", "Ràng buộc", "text", { nullable: true, width: 40 }), c("an", "Ấn bộ", "text"),
  ]),
  T("Set mốc", "set.json", "", "bo", [
    c("bo", "Mã bộ", "text"), c("so", "Số món", "int"), c("loai", "Loại hiệu ứng", "text"),
    c("mo_ta", "Mô tả", "text", { width: 60 }), c("tham_so", "Tham số (đơn vị code)", "kv", { width: 50 }),
  ]),
  T("Pháp bảo loại", "phap_bao.json", "loai", "id", [
    c("ma", "Mã ngắn", "text"), c("id", "Mã", "text"), c("ten", "Tên", "text"), c("khac_loai_chieu", "Khắc loại chiêu", "text"),
    c("kich_hoat", "Kích hoạt khi", "text", { width: 45 }), c("hieu_ung", "Hiệu ứng", "text", { width: 40 }),
    c("chinh_ten", "Chỉ số chính", "text", { json: "chinh.ten" }), c("chinh_don_vi", "Đơn vị", "unit", { json: "chinh.don_vi", width: 8 }),
    ...["Lục", "Lam", "Tím", "Vàng", "Đỏ"].map((d, i) =>
      c(`chinh_${i}`, `Chỉ số chính · ${d}`, "qty", { json: `chinh.theo_do_hiem[${i}]`, unitCol: "chinh_don_vi", width: 10 })),
    c("so_lan_moi_tran", "Số lần mỗi trận", "int"), c("hoi_chieu", "Hồi chiêu (giây)", "sec", { json: "hoi_chieu_ticks" }),
  ]),
  T("Pháp bảo", "phap_bao.json", "mon", "ma_vp", [
    c("ma_vp", "Mã vật phẩm", "text"), c("ten", "Tên", "text", { width: 20 }), c("loai", "Loại", "text"), c("do_hiem", "Độ hiếm", "text"),
    c("chinh_ten", "Chỉ số chính", "text", { json: "chinh.ten" }),
    c("chinh_gia_tri", "Giá trị chính", "qty", { json: "chinh.gia_tri", unitCol: "chinh_don_vi", width: 10 }),
    c("chinh_don_vi", "Đơn vị", "unit", { json: "chinh.don_vi", width: 8 }),
    c("so_lan", "Số lần mỗi trận", "int", { json: "phu.so_lan_moi_tran" }),
    c("hoi_chieu", "Hồi chiêu (giây)", "sec", { json: "phu.hoi_chieu_ticks" }),
    c("linh_luc", "Linh lực tối đa", "int", { json: "phu.linh_luc_toi_da" }),
    moTa, nguon, c("khoa", "Khóa vào nhân vật", "bool"),
  ]),
  T("Pháp bảo trấn giáo", "phap_bao.json", "tran_giao", "ma_vp", [
    c("ma_vp", "Mã vật phẩm", "text"), c("ten", "Tên", "text", { width: 20 }), moTa, c("cap", "Cấp", "text"), c("dat_o", "Đặt ở", "text"),
    nguon, c("ghi_chu", "Ghi chú", "text", { width: 50 }),
  ]),
  T("Pháp khí", "phap_khi.json", "mon", "ma_vp", [
    c("ma_vp", "Mã vật phẩm", "text"), c("ten", "Tên", "text"), c("loai", "Loại", "text"), c("do_hiem", "Độ hiếm", "text"),
    c("tai_nang_hop", "Hợp tài năng", "text"), c("chinh_ten", "Chỉ số chính", "text", { json: "chinh.ten", width: 22 }),
    c("chinh_gia_tri", "Giá trị chính", "qty", { json: "chinh.gia_tri", unitCol: "chinh_don_vi", width: 10 }),
    c("chinh_don_vi", "Đơn vị", "unit", { json: "chinh.don_vi", width: 8 }), c("phu", "Phụ (đơn vị code)", "kv", { width: 24 }), nguon,
  ]),
  T("Phù", "vat_pham.json", "phu", "ma_vp", [
    c("ma_vp", "Mã vật phẩm", "text"), c("ten", "Tên", "text"), c("ten_icon", "Tên icon", "text", { optional: true, width: 20 }),
    moTa, nguon, c("moi", "Mới", "bool"),
  ]),
  T("Đan", "vat_pham.json", "dan", "ma_vp", [
    c("ma_vp", "Mã vật phẩm", "text"), c("nhom", "Nhóm", "text"), c("ten", "Tên", "text"),
    c("ten_icon", "Tên icon", "text", { optional: true, width: 26 }), moTa, c("cap", "Cấp", "text", { optional: true, width: 8 }),
    nguon, c("khoa", "Khóa vào nhân vật", "bool"),
  ]),
  T("Nguyên liệu rèn", "vat_pham.json", "nguyen_lieu", "ma_vp", [
    c("ma_vp", "Mã vật phẩm", "text"), c("ten", "Tên", "text"), moTa, nguon, c("moi", "Mới", "bool"),
  ]),
  T("Luật trang bị", "", "", "khoa", [
    c("khoa", "Khóa (file:đường dẫn)", "text", { width: 40 }), c("ten", "Tên", "text", { width: 45, json: false }),
    c("gia_tri", "Giá trị", "qty", { unitCol: "kieu", width: 10 }), c("kieu", "Kiểu", "text", { width: 8 }),
  ]),
  T("Ghi chú trang bị", "", "", "file", [
    c("file", "File", "text", { width: 16 }), c("stt", "STT", "int", { width: 5 }), c("noi_dung", "Nội dung", "text", { width: 140 }),
  ]),
];
const part = (sheet: string) => PARTS.find((p) => p.def.sheet === sheet)!;

/** Thứ tự khóa cấp đầu của từng file, như data/trang_bi. */
const TOP_ORDER: Record<string, string[]> = {
  "trang_bi.json": ["ghi_chu", "do_hiem", "o", "kieu"],
  "vu_khi.json": ["ghi_chu", "khi_hinh", "hinh_khi_cam"],
  "ngoc.json": ["ghi_chu", "he", "cap", "y_chau", "an_bo"],
  "set.json": ["ghi_chu", "moc", "tran", "ty_le_kham_san_tim_tro_len", "bo"],
  "phap_bao.json": ["ghi_chu", "o", "loai", "mon", "tran_giao"],
  "phap_khi.json": ["ghi_chu", "o", "mon"],
  "vat_pham.json": ["ghi_chu", "phu", "dan", "nguyen_lieu"],
};
export const TB_FILES = Object.keys(TOP_ORDER);

/** Luật lẻ trong các file: [file:đường dẫn, tên, kiểu]. */
const LUAT: [string, string, string][] = [
  ["set.json:moc[0]", "Mốc set thứ nhất (số món)", "số"],
  ["set.json:moc[1]", "Mốc set thứ hai (số món)", "số"],
  ["set.json:moc[2]", "Mốc set thứ ba (số món)", "số"],
  ["set.json:tran.boToiDa", "Số bộ kích cùng lúc tối đa", "số"],
  ["set.json:tran.luc_chien_phan_nghin.2", "Trần lực chiến của một bộ ở mốc 2", "%"],
  ["set.json:tran.luc_chien_phan_nghin.4", "Trần lực chiến của một bộ ở mốc 4", "%"],
  ["set.json:tran.luc_chien_phan_nghin.7", "Trần lực chiến của một bộ ở mốc 7", "%"],
  ["set.json:tran.kinhTeToiDa", "Kinh tế từ đồ tối đa mỗi loại", "%"],
  ["set.json:tran.tyLeChungTranPhu", "Tỷ lệ cộng từ đồ chung trần với phù", "%"],
  ["set.json:ty_le_kham_san_tim_tro_len", "Đồ từ tím trở lên rơi ra đã khảm sẵn ấn", "%"],
  ["phap_bao.json:o.ha_vi", "Ô pháp bảo ở Hạ vị", "số"],
  ["phap_bao.json:o.trung_vi_tro_len", "Ô pháp bảo từ Trung vị", "số"],
  ["phap_khi.json:o", "Ô pháp khí", "số"],
];

// ---------- dựng lần đầu từ data/trang_bi ----------

type Row = Record<string, string | number | null>;

/** Giá trị JSON → ô Excel theo kiểu cột (ngược của B.toJson). */
function toCell(col: B.Col, v: unknown, unitCode: unknown): string | number | null {
  if (v === undefined || v === null) return null;
  switch (col.kind) {
    case "list": return (v as string[]).join(", ");
    case "bool": return v ? "có" : "không";
    case "kv": return B.kvText(v as Record<string, unknown>);
    case "unit": return B.unitLabel(String(v));
    case "pct": case "mul": case "cell": return (v as number) / 1000;
    case "sec": return (v as number) / 20;
    case "qty": return typeof unitCode === "string" && unitCode !== "số" ? B.fromCodeUnit(v as number, unitCode) : (v as number);
    default: return v as string | number;
  }
}

/** Dòng Excel cho mọi sheet trang bị, đọc từ data/trang_bi (thư mục `dir`). Không có thư mục thì trả rỗng. */
export function sourceRows(dir: URL): Record<string, Row[]> {
  if (!existsSync(new URL("trang_bi.json", dir))) return {};
  const src: Record<string, Record<string, unknown>> = {};
  for (const f of TB_FILES) src[f] = JSON.parse(readFileSync(new URL(f, dir), "utf8"));
  const rowOf = (p: PartDef, item: Record<string, unknown>): Row => {
    const row: Row = {};
    for (const col of p.def.cols) {
      const unit = col.unitCol ? B.getPath(item, String(p.def.cols.find((x) => x.key === col.unitCol)!.json ?? col.unitCol)) : undefined;
      row[col.key] = toCell(col, B.getPath(item, String(col.json ?? col.key)), unit);
    }
    return row;
  };
  const out: Record<string, Row[]> = {};
  for (const p of PARTS) if (p.path) out[p.def.sheet] = (B.getPath(src[p.file], p.path) as Record<string, unknown>[]).map((it) => rowOf(p, it));
  const moc = part("Set mốc");
  out[moc.def.sheet] = (src["set.json"].bo as { id: string; moc: Record<string, unknown>[] }[])
    .flatMap((b) => b.moc.map((m) => rowOf(moc, { bo: b.id, ...m })));
  out["Luật trang bị"] = LUAT.map(([khoa, ten, kieu]) => {
    const [f, path] = khoa.split(":");
    const v = B.getPath(src[f], path) as number;
    return { khoa, ten, gia_tri: kieu === "%" ? v / 1000 : v, kieu };
  });
  out["Ghi chú trang bị"] = TB_FILES.flatMap((f) => ((src[f].ghi_chu ?? []) as string[]).map((noi_dung, i) => ({ file: f, stt: i + 1, noi_dung })));
  return out;
}

// ---------- ghép JSON ----------

/** Dòng đã đổi sang JSON (theo sheet) → 7 file như data/trang_bi. Thiếu sheet trang bị thì trả rỗng. */
export function assemble(rows: Record<string, Record<string, unknown>[]>): Record<string, unknown> {
  if (!rows["Kiểu trang bị"]) return {};
  const files: Record<string, Record<string, unknown>> = {};
  for (const f of TB_FILES) files[f] = { ghi_chu: [] };
  for (const n of [...rows["Ghi chú trang bị"]].sort((a, b) => (a.stt as number) - (b.stt as number))) {
    const f = files[n.file as string];
    if (!f) throw new Error(`Sheet "Ghi chú trang bị": file lạ ${String(n.file)}`);
    (f.ghi_chu as string[]).push(n.noi_dung as string);
  }
  for (const r of rows["Luật trang bị"]) {
    const [f, path] = String(r.khoa).split(":");
    if (!files[f] || !path) throw new Error(`Sheet "Luật trang bị": khóa lạ ${String(r.khoa)}`);
    B.setPath(files[f], path, r.gia_tri);
  }
  for (const p of PARTS) if (p.path) B.setPath(files[p.file], p.path, rows[p.def.sheet]);
  const order = ["id", "ten", "nguon", "chu_de", "gan_voi", "than", "rang_buoc", "moc", "an"];
  files["set.json"].bo = (files["set.json"].bo as Record<string, unknown>[]).map((b) => {
    const moc = rows["Set mốc"].filter((m) => m.bo === b.id).map(({ bo: _, ...m }) => m);
    const full: Record<string, unknown> = { ...b, moc };
    return Object.fromEntries(order.filter((k) => k in full).map((k) => [k, full[k]]));
  });
  for (const [f, keys] of Object.entries(TOP_ORDER)) {
    const o = files[f];
    files[f] = Object.fromEntries([...keys.filter((k) => k in o), ...Object.keys(o).filter((k) => !keys.includes(k))].map((k) => [k, o[k]]));
  }
  return files;
}

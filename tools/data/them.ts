// Thêm cấu trúc mới (dòng, cột, sheet) vào file số liệu Excel đang có, giữ nguyên mọi ô cũ, màu và chỗ người dùng đã sửa tay.
// Dùng khi Excel đã là nguồn duy nhất, không dựng lại được bằng tao.ts. Mỗi việc là một bước có tên; chạy lại thì bỏ qua phần
// đã có. Chạy xong tự xuất JSON và kiểm.
//
// Chạy: node --experimental-strip-types --no-warnings tools/data/them.ts <bước> [...]
//   artifact_rules  nhóm ARTIFACT_RULES ở sheet Tham số (điều kiện kích hoạt pháp bảo, sim f656195)
//   dao_co_ban      Đạo Cơ Bàn (GDD tab Trang bị phần 8): sheet Đạo Cơ Bàn, Cộng hưởng, Mạch cộng hưởng; cột Hệ ấn ở Ấn bộ;
//                   4 luật ở Luật trang bị; ghi chú của dao_co_ban.json
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { ARTIFACT_RULES } from "@ktlp/sim";
import {
  unzip, zip, readFiles, sheetParts, cellXml, rowXml, worksheetXml, esc, colName, StyleBook,
  type Cell, type SheetIn, type SheetOut, type Value,
} from "./xlsx.ts";
import { patchCell } from "./sua.ts";
import * as B from "./bang.ts";
import * as N from "./noi_dung.ts";
import * as TB from "./trang_bi.ts";
import { table, paramCells, pctFmt } from "./tao.ts";

/** Gói xlsx đang sửa: đọc lại sau mỗi bước, thêm dòng, cột, sheet. */
export class Workbook {
  files: Map<string, Buffer>;
  styles: StyleBook;
  constructor(buf: Buffer) {
    this.files = unzip(buf);
    this.styles = new StyleBook(this.text("xl/styles.xml"));
  }
  private text(name: string): string {
    const b = this.files.get(name);
    if (!b) throw new Error(`Thiếu ${name} trong file xlsx`);
    return b.toString("utf8");
  }
  private put(name: string, s: string): void {
    this.files.set(name, Buffer.from(s));
  }
  private part(sheet: string): string {
    const p = new Map(sheetParts(this.files)).get(sheet);
    if (!p) throw new Error(`Không có sheet "${sheet}"`);
    return p;
  }
  private styleOf = (c: Cell) => this.styles.index(c);
  names(): string[] {
    return sheetParts(this.files).map(([n]) => n);
  }
  sheet(name: string): SheetIn {
    const s = readFiles(this.files).find((x) => x.name === name);
    if (!s) throw new Error(`Không có sheet "${name}"`);
    return s;
  }

  /** Thêm dòng vào cuối sheet. */
  appendRows(sheet: string, rows: (Cell | null)[][]): void {
    const part = this.part(sheet);
    let xml = this.text(part);
    const last = Math.max(0, ...[...xml.matchAll(/<row\b[^>]*?\br="(\d+)"/g)].map((m) => Number(m[1])));
    const add = rows.map((r, i) => rowXml(last + i, r, this.styleOf, sheet)).join("");
    xml = xml.includes("</sheetData>") ? xml.replace("</sheetData>", `${add}</sheetData>`) : xml.replace("<sheetData/>", `<sheetData>${add}</sheetData>`);
    this.put(part, xml.replace(/<dimension\b[^>]*\/>/, "")); // Excel tự tính lại vùng dữ liệu
  }

  /** Thêm một cột sau cột cuối: ô tiêu đề ở dòng 1, ô dữ liệu do `cellFor(dòng Excel đếm từ 0, giá trị dòng)` trả về. */
  addColumn(sheet: string, header: Cell, cellFor: (r: number, row: Value[]) => Cell | null, width?: number): void {
    const s = this.sheet(sheet);
    const col = Math.max(...s.cells.map((r) => r.length));
    const part = this.part(sheet);
    let xml = this.text(part).replace(/<row\b([^>]*?\br="(\d+)"[^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g, (_, attrs: string, n: string, body = "") => {
      const r = Number(n) - 1;
      const c = r === 0 ? header : cellFor(r, s.cells[r] ?? []);
      return `<row${attrs}>${body}${c ? cellXml(r, col, c, this.styleOf, sheet) : ""}</row>`;
    });
    if (width) {
      const def = `<col min="${col + 1}" max="${col + 1}" width="${width}" customWidth="1"/>`;
      xml = xml.includes("</cols>") ? xml.replace("</cols>", `${def}</cols>`) : xml.replace(/<sheetData\b/, `<cols>${def}</cols><sheetData`);
    }
    this.put(part, xml.replace(/<dimension\b[^>]*\/>/, ""));
  }

  /** Ghi đè một ô (dòng `r`, cột `col` đếm từ 0) bằng ô mới với màu, định dạng của `c`. */
  setCell(sheet: string, r: number, col: number, c: Cell): void {
    const part = this.part(sheet);
    this.put(part, patchCell(this.text(part), r + 1, col, () => cellXml(r, col, c, this.styleOf, sheet) || `<c r="${colName(col)}${r + 1}"/>`));
  }

  /** Thêm sheet ngay sau sheet `after`. */
  addSheet(s: SheetOut, after: string): void {
    if (this.names().includes(s.name)) throw new Error(`Sheet "${s.name}" đã có`);
    const n = Math.max(0, ...[...this.files.keys()].map((k) => Number(/^xl\/worksheets\/sheet(\d+)\.xml$/.exec(k)?.[1] ?? 0))) + 1;
    const partName = `xl/worksheets/sheet${n}.xml`;
    this.put(partName, worksheetXml(s, this.styleOf, false));

    let rels = this.text("xl/_rels/workbook.xml.rels");
    const rid = `rId${Math.max(0, ...[...rels.matchAll(/\bId="rId(\d+)"/g)].map((m) => Number(m[1]))) + 1}`;
    rels = rels.replace("</Relationships>",
      `<Relationship Id="${rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${n}.xml"/></Relationships>`);
    this.put("xl/_rels/workbook.xml.rels", rels);

    let wb = this.text("xl/workbook.xml");
    const sheetTags = [...wb.matchAll(/<sheet\b[^>]*\/>/g)];
    const at = sheetTags.findIndex((m) => m[0].includes(`name="${esc(after)}"`));
    if (at < 0) throw new Error(`Không có sheet "${after}" để chèn sau`);
    const id = Math.max(...sheetTags.map((m) => Number(/\bsheetId="(\d+)"/.exec(m[0])![1]))) + 1;
    const tag = `<sheet name="${esc(s.name)}" sheetId="${id}" r:id="${rid}"/>`;
    const end = sheetTags[at].index! + sheetTags[at][0].length;
    wb = wb.slice(0, end) + tag + wb.slice(end);
    // Tên vùng gắn với sheet (bộ lọc Excel tự thêm) đếm sheet theo vị trí: dời các sheet phía sau lên 1
    wb = wb.replace(/\blocalSheetId="(\d+)"/g, (m, k) => (Number(k) > at ? `localSheetId="${Number(k) + 1}"` : m));
    this.put("xl/workbook.xml", wb);

    const types = this.text("[Content_Types].xml").replace("</Types>",
      `<Override PartName="/${partName}" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`);
    this.put("[Content_Types].xml", types);
  }

  save(): Buffer {
    this.put("xl/styles.xml", this.styles.xml);
    return zip([...this.files].map(([name, data]) => ({ name, data })));
  }
}

const norm = (v: Value | undefined) => String(v ?? "").replace(/\s+/g, " ").trim();
/** Dòng dữ liệu của bảng theo schema (bỏ dòng tiêu đề), dựng bằng table() của tao.ts cho cùng màu và định dạng. */
const tableRows = (def: B.TableDef, rows: Record<string, string | number | null>[]) => table(def, rows).rows.slice(1);
const partDef = (sheet: string) => TB.PARTS.find((p) => p.def.sheet === sheet)!.def;

// ---------- các bước ----------

type Step = (wb: Workbook, log: string[]) => void;

const artifactRules: Step = (wb, log) => {
  const s = wb.sheet(B.PARAMS.sheet);
  if (s.cells.some((r) => norm(r?.[0]) === "ARTIFACT_RULES")) return void log.push("Tham số: đã có nhóm ARTIFACT_RULES, bỏ qua");
  const desc = N.CODE_PARAMS.ARTIFACT_RULES;
  const missing = Object.keys(ARTIFACT_RULES).filter((k) => !desc.some((d) => d[0] === k));
  if (missing.length) throw new Error(`ARTIFACT_RULES trong code có khóa chưa mô tả ở noi_dung.ts: ${missing.join(", ")}`);
  const code = ARTIFACT_RULES as Record<string, number>;
  wb.appendRows(B.PARAMS.sheet, desc.map(([key, name, kieu, muc, src]) =>
    paramCells("ARTIFACT_RULES", key, name, B.paramFromCode(kieu, code[key]), kieu, muc, src)));
  log.push(`Tham số: thêm ${desc.length} dòng nhóm ARTIFACT_RULES`);
};

/** Hệ của ấn từng bộ (GDD tab Trang bị phần 8; đề xuất). Hỗn Độn không hệ. */
const AN_HE: Record<string, string | null> = {
  tu_bao: "kim", van_kiem: "kim", bach_thao: "moc", ngu_thu: "moc", linh_tuyen: "thuy", ngoc_tuy: "thuy",
  dan_tien: "hoa", thien_cong: "hoa", ban_thach: "tho", chu_thien: "tho", loi_tri: "loi", do_kiep: "loi",
  liep_thu: "phong", thiet_ky: "phong", van_uyen: "quang", co_tong: "am_lanh", pha_quan: "cuc_duong",
  huyet_anh: "cuc_am", bang_phach: "cuc_han", hon_don: null,
};
/**
 * 19 ô: mã, vòng, q, r, mở ở (vị diện, cấp, cảnh giới 1 Luyện Khí … 9 Độ Kiếp; chốt với phiên Sprint 2026-11-04).
 * Trung vị đếm cấp lại từ 1; Thần vực không còn cấp. Ô tâm chỉ nhận ấn (ấn chủ).
 */
const O_BAN: [string, string, number, number, string, number | null, number][] = [
  ["O", "tam", 0, 0, "ha", 20, 1],
  ["T1", "trong", 1, 0, "ha", 51, 2], ["T4", "trong", -1, 0, "ha", 51, 2],
  ["T2", "trong", 1, -1, "ha", 101, 3], ["T5", "trong", -1, 1, "ha", 101, 3],
  ["T3", "trong", 0, -1, "ha", 151, 4], ["T6", "trong", 0, 1, "ha", 151, 4],
  ["N2", "canh", 2, -1, "ha", 201, 5], ["N6", "canh", -1, -1, "ha", 201, 5], ["N10", "canh", -1, 2, "ha", 201, 5],
  ["N4", "canh", 1, -2, "trung", 1, 6], ["N8", "canh", -2, 1, "trung", 1, 6], ["N12", "canh", 1, 1, "trung", 1, 6],
  ["N1", "goc", 2, 0, "trung", 101, 7], ["N5", "goc", 0, -2, "trung", 101, 7], ["N9", "goc", -2, 2, "trung", 101, 7],
  ["N3", "goc", 2, -2, "than", null, 8], ["N7", "goc", -2, 0, "than", null, 8], ["N11", "goc", 0, 2, "than", null, 9],
];
const banRow = ([ma, vong, q, r, mo_vi_dien, mo_cap, mo_canh_gioi]: (typeof O_BAN)[number]) =>
  ({ ma, vong, q, r, mo_vi_dien, mo_cap, mo_canh_gioi, chi_nhan: ma === "O" ? "an" : "an, ngoc" });
const CONG_HUONG: [string, string, number, number | null, number | null, string][] = [
  ["thuan", "Đồng Khí", 1.25, 0.03, null, "Số ở mốc 2 của cả hai bộ ×1,25; kháng hệ đó +3%"],
  ["sinh", "Tương Dưỡng", 1.5, null, null, "Số ở mốc 2 của cả hai bộ ×1,5"],
  ["cuc", "Âm Dương", 2, null, -0.05, "Số ở mốc 2 của cả hai bộ ×2; mana tối đa −5% (như tổ hợp đối cực: mạnh mà tốn mana)"],
];
const MACH: [string, string][] = [
  ["thuan", "thuan"], ["tuong_sinh", "sinh"], ["tuong_hop", "sinh"], ["doi_cuc", "cuc"], ["trung_tinh", "trung"], ["tuong_khac", "dut"],
];
const LUAT_DCB: [string, number][] = [
  ["dao_co_ban.json:luat.banMonToiDaMoiBo", 2], ["dao_co_ban.json:luat.banMonTrenDoToiThieu", 2],
  ["dao_co_ban.json:luat.banMoTuCap", 20], ["dao_co_ban.json:luat.banTranLucChien", 30],
];
const GHI_CHU_DCB = [
  "Đạo Cơ Bàn (GDD tab Trang bị, pháp bảo và set đồ, phần 8; mọi số là đề xuất): bàn lục giác 19 ô, tọa độ trục (q, r). Hai ô kề khi chênh một trong 6 hướng (±1, 0), (0, ±1), (1, −1), (−1, 1). Ô mở dần theo cảnh giới (o[].mo).",
  "Đặt được ấn bộ (NG-AN) và ngọc hệ (NG-KH, mọi cấp); ô tâm chỉ nhận ấn (ấn chủ). Ngọc trên bàn không cộng chỉ số, chỉ mang hệ để dẫn mạch. Hệ của ấn ở ngoc.json an_bo[].he; Hỗn Độn không hệ.",
  "Ô có đồ là thông khi nối về ô tâm qua chuỗi ô kề đều có đồ và không cặp kề nào tương khắc. Hai ô kề đều thông tạo một mạch; loại mạch lấy theo quan hệ hệ ở to_hop.json qua bảng mach (Hỗn Độn kề gì cũng là trung).",
  "Mỗi ấn thông tính thêm 1 món cho bộ của nó, tối đa luat.banMonToiDaMoiBo món mỗi bộ (gồm ô tâm), chỉ khi bộ đó có ít nhất luat.banMonTrenDoToiThieu món trên đồ đang mặc còn độ bền.",
  "Cộng hưởng: hai ấn của hai bộ đang kích, kề nhau và đều thông. Mỗi bộ chỉ nhận cộng hưởng mạnh nhất (Âm Dương > Tương Dưỡng > Đồng Khí) và chỉ nhân số ở mốc 2. Bàn đầy thêm tối đa luat.banTranLucChien lực chiến, trong trần 35% của đồ.",
];

const daoCoBan: Step = (wb, log) => {
  // Cột Hệ ấn ở sheet Ấn bộ
  const an = partDef("Ấn bộ"), heCol = an.cols.find((c) => c.key === "he")!;
  const s = wb.sheet(an.sheet), header = (s.cells[0] ?? []).map(norm);
  if (header.includes(heCol.header)) log.push("Ấn bộ: đã có cột Hệ ấn, bỏ qua");
  else {
    const boAt = header.indexOf(an.cols.find((c) => c.key === "bo")!.header);
    wb.addColumn(an.sheet, { v: heCol.header, fill: "tieu_de", bold: true, wrap: true }, (_, row) => {
      const bo = norm(row[boAt]);
      if (!(bo in AN_HE)) throw new Error(`Ấn bộ: chưa có hệ cho bộ "${bo}"`);
      return { v: AN_HE[bo], fill: "de_xuat" };
    }, 12);
    log.push(`Ấn bộ: thêm cột "${heCol.header}" cho ${s.cells.length - 1} ấn`);
  }

  // Ba sheet mới, sau Set mốc
  const sheets: [string, Record<string, string | number | null>[]][] = [
    ["Đạo Cơ Bàn", O_BAN.map(banRow)],
    ["Cộng hưởng", CONG_HUONG.map(([mach, ten, heSoMoc2, khangHe, manaMax, mo_ta]) => ({ mach, ten, heSoMoc2, khangHe, manaMax, mo_ta }))],
    ["Mạch cộng hưởng", MACH.map(([quan_he, mach]) => ({ quan_he, mach, ten: TB.MACH_INFO[mach][0], mau: TB.MACH_INFO[mach][1] }))],
  ];
  let after = "Set mốc";
  for (const [name, rows] of sheets) {
    if (wb.names().includes(name)) log.push(`${name}: sheet đã có, bỏ qua`);
    else {
      wb.addSheet(table(partDef(name), rows), after);
      log.push(`${name}: thêm sheet ${rows.length} dòng`);
    }
    after = name;
  }

  // Dòng giới thiệu ở sheet Ghi chú
  const intro = "Đạo Cơ Bàn, Cộng hưởng, Mạch cộng hưởng";
  if (!wb.sheet(B.NOTE_SHEET).cells.some((r) => norm(r?.[0]) === intro)) {
    wb.appendRows(B.NOTE_SHEET, [[{ v: intro, bold: true }, { v: "Bàn ô lục giác 19 ô đặt ấn bộ và ngọc hệ để tính thêm món set và cộng hưởng (GDD tab Trang bị phần 8); mọi số là đề xuất. Xuất ra dao_co_ban.json; hệ ấn nằm ở cột Hệ ấn của sheet Ấn bộ" }]]);
  }

  // Luật và ghi chú
  const luatDef = partDef("Luật trang bị");
  const have = new Set(wb.sheet(luatDef.sheet).cells.map((r) => norm(r?.[0])));
  const luat = LUAT_DCB.filter(([k]) => !have.has(k)).map(([khoa, v]) => {
    const [, ten, kieu] = TB.LUAT.find((l) => l[0] === khoa)!;
    return { khoa, ten, gia_tri: kieu === "%" ? v / 1000 : v, kieu };
  });
  if (luat.length) wb.appendRows(luatDef.sheet, tableRows(luatDef, luat));
  log.push(`Luật trang bị: thêm ${luat.length} dòng`);
  const gcDef = partDef("Ghi chú trang bị");
  if (wb.sheet(gcDef.sheet).cells.some((r) => norm(r?.[0]) === "dao_co_ban.json")) log.push("Ghi chú trang bị: đã có ghi chú Đạo Cơ Bàn, bỏ qua");
  else {
    wb.appendRows(gcDef.sheet, tableRows(gcDef, GHI_CHU_DCB.map((noi_dung, i) => ({ file: "dao_co_ban.json", stt: i + 1, noi_dung }))));
    log.push(`Ghi chú trang bị: thêm ${GHI_CHU_DCB.length} dòng`);
  }
};

/**
 * Sheet Đạo Cơ Bàn dựng ở 3812b44 có một cột "Mở ở cảnh giới" ghi mã cảnh giới. Đổi sang 3 cột vị diện, cấp, số thứ tự cảnh giới
 * (theo đề nghị của phiên Sprint, 2026-11-04): ghi lại cột cũ thành vị diện, cột Nhận thành cấp, rồi thêm cảnh giới và Nhận ở cuối,
 * để thứ tự cột khớp thứ tự khóa trong JSON.
 */
const daoCoBanMo: Step = (wb, log) => {
  const def = partDef("Đạo Cơ Bàn");
  const s = wb.sheet(def.sheet), header = (s.cells[0] ?? []).map(norm);
  const oldAt = header.indexOf("Mở ở cảnh giới");
  if (oldAt < 0) return void log.push("Đạo Cơ Bàn: cột mở đã theo vị diện, cấp, cảnh giới, bỏ qua");
  const col = (k: string) => def.cols.find((c) => c.key === k)!;
  const nhanAt = header.indexOf(col("chi_nhan").header);
  if (nhanAt !== oldAt + 1 || nhanAt !== header.length - 1) throw new Error("Đạo Cơ Bàn: thứ tự cột khác lúc dựng, cần sửa tay");
  const maAt = header.indexOf(col("ma").header);
  const byMa = new Map(O_BAN.map((o) => [o[0], banRow(o)]));
  const head = (k: string): Cell => ({ v: col(k).header, fill: "tieu_de", bold: true, wrap: true });
  const val = (v: string | number | null): Cell => ({ v, fill: "de_xuat" });
  const rowOf = (r: number) => {
    const b = byMa.get(norm(s.cells[r]?.[maAt]));
    if (!b) throw new Error(`Đạo Cơ Bàn: ô lạ ${String(s.cells[r]?.[maAt])}`);
    return b;
  };
  wb.setCell(def.sheet, 0, oldAt, head("mo_vi_dien"));
  wb.setCell(def.sheet, 0, nhanAt, head("mo_cap"));
  for (let r = 1; r < s.cells.length; r++) {
    if (!norm(s.cells[r]?.[maAt])) continue;
    wb.setCell(def.sheet, r, oldAt, val(rowOf(r).mo_vi_dien));
    wb.setCell(def.sheet, r, nhanAt, val(rowOf(r).mo_cap));
  }
  wb.addColumn(def.sheet, head("mo_canh_gioi"), (r) => val(rowOf(r).mo_canh_gioi), col("mo_canh_gioi").width);
  // Lấy giá trị Nhận từ bản đọc trước khi ghi đè cột đó
  wb.addColumn(def.sheet, head("chi_nhan"), (r) => val(norm(s.cells[r]?.[nhanAt])), col("chi_nhan").width);
  log.push("Đạo Cơ Bàn: cột mở thành vị diện, cấp, cảnh giới (19 ô); cột Nhận dời ra cuối");
};

/** Dòng (đếm từ 0) và cột của ô ở `header`, dòng có cột `idHeader` bằng `id`. */
function locate(wb: Workbook, sheet: string, idHeader: string, id: string, header: string): [number, number] {
  const s = wb.sheet(sheet), h = (s.cells[0] ?? []).map(norm);
  const ic = h.indexOf(idHeader), cc = h.indexOf(header);
  const rows = s.cells.map((r, i) => (i > 0 && norm(r?.[ic]) === id ? i : -1)).filter((i) => i > 0);
  if (ic < 0 || cc < 0 || rows.length !== 1) throw new Error(`${sheet}: không tìm được đúng một ô "${header}" của "${id}"`);
  return [rows[0], cc];
}
const pctCell = (v: number): Cell => ({ v, fill: "de_xuat", fmt: pctFmt(v) });

/** Chỉ số món theo ô sau lần đo trần 2 (phần nghìn của chỉ số chuẩn cùng cấp; trước đó gấp đôi). */
const TRAN_O: Record<string, [number, number]> = {
  vu_khi: [40, 20], mu: [20, 20], ao: [40, 15], dai: [25, 10], bao_tay: [20, 5], giay: [20, 10], ngoc_boi: [25, 5],
};
/** Ngọc cấp k: k × (k + 1) phần nghìn, tức 0,1 × k × (k + 1)%. */
const NGOC_CAP = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((k) => k * (k + 1));
const LUAT_NGOC: [string, number][] = [
  ["ngoc.json:tran.satThuongMem", 150], ["ngoc.json:tran.satThuongToiDa", 250],
  ["ngoc.json:tran.khangMem", 100], ["ngoc.json:tran.khangToiDa", 150],
];
const GHI_CHU_NGOC: [number, string][] = [
  [1, "12 hệ cấp 1–10 (chốt). gia_tri: phần nghìn, = k × (k + 1), tức 0,1 × k × (k + 1)% (đề xuất, sửa sau lần đo trần 2 ngày 2026-11-04; trước là 0,25 × k × (k + 1)%). Khảm trùng hệ linh căn hiệu quả +20%."],
  [2, "Ô 'cong' (vũ khí, bao tay, ngọc bội): tăng sát thương chiêu có hệ chủ là hệ ngọc. Ô 'thu' (mũ, áo, đai, giày): kháng hệ ngọc. Tổng kháng một hệ từ mọi nguồn (ngọc, set, cộng hưởng, đan) tối đa resistCap ở tham_so.json (20%)."],
  [5, "tran (đề xuất 2026-11-04): mỗi hệ, phần sát thương từ ngọc trên satThuongMem chỉ tính một nửa và không vượt satThuongToiDa; kháng từ ngọc trên khangMem tính một nửa và không vượt khangToiDa."],
];

/**
 * Bộ số trần lần 2 (phiên set đồ chọn, phiên Sprint đo đạt mọi mục tiêu 2026-11-04; mọi số là đề xuất): chỉ số món ×0,5, ngọc
 * 0,1 × k × (k + 1)%, trần mềm của ngọc ở ngoc.json tran, tổng kháng một hệ resistCap 20%. Ghi số tuyệt đối nên chạy lại vẫn vậy.
 */
const tranLan2: Step = (wb, log) => {
  const o = partDef("Ô trang bị"), oh = (k: string) => o.cols.find((c) => c.key === k)!.header;
  for (const [id, [chinh, phu]] of Object.entries(TRAN_O)) {
    wb.setCell(o.sheet, ...locate(wb, o.sheet, oh("id"), id, oh("chinh_gia_tri")), pctCell(chinh / 1000));
    wb.setCell(o.sheet, ...locate(wb, o.sheet, oh("id"), id, oh("phu_gia_tri")), pctCell(phu / 1000));
  }
  log.push("Ô trang bị: chỉ số chính và phụ của 7 ô theo trần lần 2 (×0,5)");

  const nc = partDef("Ngọc cấp"), nh = (k: string) => nc.cols.find((c) => c.key === k)!.header;
  NGOC_CAP.forEach((v, i) => wb.setCell(nc.sheet, ...locate(wb, nc.sheet, nh("cap"), String(i + 1), nh("gia_tri")), pctCell(v / 1000)));
  log.push(`Ngọc cấp: ${NGOC_CAP.join(", ")} phần nghìn`);

  const ts = B.PARAMS.sheet;
  wb.setCell(ts, ...locate(wb, ts, "Khóa", "resistCap", "Giá trị"), pctCell(0.2));
  wb.setCell(ts, ...locate(wb, ts, "Khóa", "resistCap", "Tên"), { v: "Tổng kháng một hệ từ mọi nguồn (ngọc, set, cộng hưởng, đan) tối đa" });
  wb.setCell(ts, ...locate(wb, ts, "Khóa", "resistCap", "Nguồn"), { v: "đề xuất" });
  log.push("Tham số: resistCap 20% (tổng kháng một hệ từ mọi nguồn)");

  const luatDef = partDef("Luật trang bị");
  const have = new Set(wb.sheet(luatDef.sheet).cells.map((r) => norm(r?.[0])));
  const luat = LUAT_NGOC.filter(([k]) => !have.has(k)).map(([khoa, v]) => {
    const [, ten, kieu] = TB.LUAT.find((l) => l[0] === khoa)!;
    return { khoa, ten, gia_tri: kieu === "%" ? v / 1000 : v, kieu };
  });
  if (luat.length) wb.appendRows(luatDef.sheet, tableRows(luatDef, luat));
  log.push(`Luật trang bị: thêm ${luat.length} dòng trần mềm của ngọc`);

  // Ghi chú của ngoc.json: sửa dòng 1, 2; thêm dòng 5 nếu chưa có
  const gc = partDef("Ghi chú trang bị"), gs = wb.sheet(gc.sheet);
  const gh = (k: string) => (gs.cells[0] ?? []).map(norm).indexOf(gc.cols.find((c) => c.key === k)!.header);
  const rowOf = (stt: number) => gs.cells.findIndex((r, i) => i > 0 && norm(r?.[gh("file")]) === "ngoc.json" && Number(r?.[gh("stt")]) === stt);
  const add: Record<string, string | number>[] = [];
  for (const [stt, text] of GHI_CHU_NGOC) {
    const r = rowOf(stt);
    if (r > 0) wb.setCell(gc.sheet, r, gh("noi_dung"), { v: text, fill: "de_xuat" });
    else add.push({ file: "ngoc.json", stt, noi_dung: text });
  }
  if (add.length) wb.appendRows(gc.sheet, tableRows(gc, add));
  log.push(`Ghi chú trang bị: sửa ${GHI_CHU_NGOC.length - add.length}, thêm ${add.length} dòng của ngoc.json`);
};

export const STEPS: Record<string, Step> = { artifact_rules: artifactRules, dao_co_ban: daoCoBan, dao_co_ban_mo: daoCoBanMo, tran_lan_2: tranLan2 };

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const names = process.argv.slice(2);
  const bad = names.filter((n) => !STEPS[n]);
  if (!names.length || bad.length) {
    console.error(`Cách dùng: them.ts <bước> [...]; các bước: ${Object.keys(STEPS).join(", ")}`);
    process.exit(2);
  }
  const path = fileURLToPath(new URL("../../data/he_thong/KhaiTongLapPhai_HeThong_v1.xlsx", import.meta.url));
  const wb = new Workbook(readFileSync(path));
  const log: string[] = [];
  for (const n of names) STEPS[n](wb, log);
  writeFileSync(path, wb.save());
  for (const l of log) console.log(`  ${l}`);
  console.log("Xuất lại JSON:");
  execFileSync(process.execPath, [...process.execArgv, fileURLToPath(new URL("xuat.ts", import.meta.url))], { stdio: "inherit" });
}

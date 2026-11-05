// Thêm cấu trúc mới (dòng, cột, sheet) vào file số liệu Excel đang có, giữ nguyên mọi ô cũ, màu và chỗ người dùng đã sửa tay.
// Dùng khi Excel đã là nguồn duy nhất, không dựng lại được bằng tao.ts. Mỗi việc là một bước có tên; chạy lại thì bỏ qua phần
// đã có. Chạy xong tự xuất JSON và kiểm.
//
// Chạy: node --experimental-strip-types --no-warnings tools/data/them.ts <bước> [...]
//   artifact_rules  nhóm ARTIFACT_RULES ở sheet Tham số (điều kiện kích hoạt pháp bảo, sim f656195)
//   dao_co_ban      Đạo Cơ Bàn (GDD tab Trang bị phần 8): sheet Đạo Cơ Bàn, Cộng hưởng, Mạch cộng hưởng; cột Hệ ấn ở Ấn bộ;
//                   4 luật ở Luật trang bị; ghi chú của dao_co_ban.json
//   luyen_khi       Luyện khí sau cấp tối đa (GDD tab Trang bị phần 13): 9 sheet sau Nguyên liệu rèn → luyen_khi.json, Phách và song
//                   hệ vào ngoc.json; 10 danh khí ở Kiểu trang bị, Khí Tinh, Linh Văn Thạch, đồ phổ ở Nguyên liệu rèn; luật, ghi chú
//   hop_tran_2      3 khóa hợp trận ở SKILL_RULES: formationJoinWait, formationExtraTargets, formationMaxTargets (đề xuất)
//   luyen_khi_2     song hệ ngọc đậu cố định, giá linh thạch tẩy luyện theo độ hiếm, thưởng Bảo Giám theo loại (đề xuất)
//   luyen_khi_3     khiVanTinhToiDa 1 và khiVanKichToiDa 3, Hộ Mệnh 3%, Định Thân 50%, Ý danh khí ×1,25, 2 danh văn, counterFloor
//   luyen_khi_4     cột tham số danh văn ở Danh khí, tham số phụ (ngưỡng, chu kỳ) ở Khí văn
//   luyen_khi_5     xóa dòng luật khiVanTinhToiDa (code thôi đọc), bỏ câu nhắc nó trong ghi chú khi_van
//   luyen_khi_6     Hộ Mệnh 1,8%, Ý danh khí ×1,0, ngân sách khí văn khiVanTranLucChien 2% (lần đo 2)
//   luyen_khi_7     ghi chú song hệ: Bảo Ngọc Phù tiêu 1 tấm mỗi lần dùng, đậu hay không cũng mất
//   thu_phat_trien  thú: 5 sheet tư chất, tu vi, thú kỹ, huyết mạch, thiên phú sau Linh đơn → thu_phat_trien.json; luật ở
//                   nhóm thu_cuoi của Tham số; Tẩy Tủy Đơn ở Linh đơn
//   set_2           set đồ 2.0 (set-2.md phần 7): Bậc ấn, Hợp bộ, Binh bộ, Binh ấn, Bộ trọn, Dòng rèn, Dòng ẩn, Điểm trang bị;
//                   cột Lộ, Chỉ số kèm, Có dòng ẩn; mốc 2, 4 của 16 bộ; áo, giày thủ ngoại, thủ nội; luật, ghi chú
//   set_2b          cột Loại sát thương ở Loại chiêu (khớp sim DAMAGE_KIND); ghi chú áo, giày theo chốt tách 2026-11-05
//   set_2c          14 trang Ẩn văn ở Bảo Giám; chỉ số kèm gộp vào tham_so của Set mốc, xóa cột Chỉ số kèm
//   goc_085         chỉ số gốc 7 ô (chính, phụ, 4 loại tẩy luyện) ×0,85, làm tròn 0,5 lên (phiên Sprint đo)
//   set_2d          set đồ 2.0 sau lần đo 1: 6 mốc set, nhóm và hệ số dòng ẩn, giảm sát thương ngoại/nội, dòng rèn 15%
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { ARTIFACT_RULES } from "@ktlp/sim";
import {
  unzip, zip, readFiles, sheetParts, cellXml, rowXml, worksheetXml, esc, colName, StyleBook,
  type Cell, type SheetIn, type SheetOut, type Value,
} from "./xlsx.ts";
import { patchCell } from "./sua.ts";
import { recalcFiles } from "./tinh.ts";
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

  /**
   * Chèn dòng ngay sau dòng Excel `after` (đếm từ 1), dời các dòng phía dưới xuống. Chỉ dùng cho sheet không có công thức
   * và không bị sheet khác trỏ tới bằng địa chỉ cố định (như sheet Tham số, tra theo cả cột).
   */
  insertRows(sheet: string, after: number, rows: (Cell | null)[][]): void {
    if (this.sheet(sheet).formulas.some((r) => r?.some(Boolean))) throw new Error(`Sheet "${sheet}" có công thức, không chèn dòng giữa được`);
    const n = rows.length, part = this.part(sheet);
    const shift = (k: number) => (k > after ? k + n : k);
    let xml = this.text(part).replace(/<row\b([^>]*?)\br="(\d+)"([^>]*?)(\/>|>([\s\S]*?)<\/row>)/g, (m, pre: string, k: string, post: string, tail: string, body?: string) => {
      const r = Number(k);
      if (r <= after) return m;
      const newBody = (body ?? "").replace(/(<c\b[^>]*?\br=")([A-Z]+)(\d+)"/g, (_, a: string, c: string, rr: string) => `${a}${c}${shift(Number(rr))}"`);
      return `<row${pre}r="${shift(r)}"${post}${body === undefined ? tail : `>${newBody}</row>`}`;
    });
    // Vùng chọn từ danh sách và vùng gộp ô: dời phần nằm dưới chỗ chèn
    xml = xml.replace(/\b(sqref|ref)="([^"]+)"/g, (_, attr: string, v: string) =>
      `${attr}="${v.replace(/([A-Z]+)(\d+)/g, (__, c: string, r: string) => `${c}${shift(Number(r))}`)}"`);
    const add = rows.map((r, i) => rowXml(after + i, r, this.styleOf, sheet)).join("");
    const at = new RegExp(`<row\\b[^>]*?\\br="${after}"[^>]*?(?:/>|>[\\s\\S]*?</row>)`).exec(xml);
    if (!at) throw new Error(`Sheet "${sheet}" không có dòng ${after}`);
    xml = xml.slice(0, at.index + at[0].length) + add + xml.slice(at.index + at[0].length);
    this.put(part, xml.replace(/<dimension\b[^>]*\/>/, ""));
  }

  /** Xóa cột cuối `col` (đếm từ 0) của sheet không có công thức: bỏ mọi ô của cột đó và độ rộng cột. */
  deleteColumn(sheet: string, col: number): void {
    const s = this.sheet(sheet);
    if (s.formulas.some((r) => r?.some(Boolean))) throw new Error(`Sheet "${sheet}" có công thức, không xóa cột được`);
    if (col !== Math.max(...s.cells.map((r) => r.length)) - 1) throw new Error(`Sheet "${sheet}": chỉ xóa được cột cuối`);
    const part = this.part(sheet), name = colName(col);
    let xml = this.text(part).replace(new RegExp(`<c\\b[^>]*?\\br="${name}\\d+"[^>]*?(?:/>|>[\\s\\S]*?</c>)`, "g"), "");
    xml = xml.replace(new RegExp(`<col\\b[^>]*?\\bmin="${col + 1}"[^>]*?/>`, "g"), "").replace("<cols></cols>", "");
    this.put(part, xml.replace(/<dimension\b[^>]*\/>/, ""));
  }

  /** Xóa dòng Excel `row` (đếm từ 1), dời các dòng phía dưới lên. Cùng giới hạn như insertRows (sheet không có công thức). */
  deleteRow(sheet: string, row: number): void {
    if (this.sheet(sheet).formulas.some((r) => r?.some(Boolean))) throw new Error(`Sheet "${sheet}" có công thức, không xóa dòng giữa được`);
    if (row < 2) throw new Error("Không xóa dòng tiêu đề");
    const part = this.part(sheet);
    const shift = (k: number) => (k > row ? k - 1 : k);
    let found = false;
    let xml = this.text(part).replace(/<row\b([^>]*?)\br="(\d+)"([^>]*?)(\/>|>([\s\S]*?)<\/row>)/g, (m, pre: string, k: string, post: string, tail: string, body?: string) => {
      const r = Number(k);
      if (r === row) { found = true; return ""; }
      if (r < row) return m;
      const newBody = (body ?? "").replace(/(<c\b[^>]*?\br=")([A-Z]+)(\d+)"/g, (_, a: string, c: string, rr: string) => `${a}${c}${shift(Number(rr))}"`);
      return `<row${pre}r="${shift(r)}"${post}${body === undefined ? tail : `>${newBody}</row>`}`;
    });
    if (!found) throw new Error(`Sheet "${sheet}" không có dòng ${row}`);
    xml = xml.replace(/\b(sqref|ref)="([^"]+)"/g, (_, attr: string, v: string) =>
      `${attr}="${v.replace(/([A-Z]+)(\d+)/g, (__, c: string, r: string) => `${c}${shift(Number(r))}`)}"`);
    this.put(part, xml.replace(/<dimension\b[^>]*\/>/, ""));
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

  /** Số ô công thức đã tính lại ở lần save gần nhất. */
  recalculated = 0;
  save(): Buffer {
    this.put("xl/styles.xml", this.styles.xml);
    this.recalculated = recalcFiles(this.files);
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
  vu_khi: [40, 20], mu: [20, 20], ao: [30, 15], dai: [25, 10], bao_tay: [20, 5], giay: [30, 10], ngoc_boi: [25, 5],
};
/**
 * Hạ chỉ số gốc 7 ô (chính, phụ, 4 loại tẩy luyện) theo trần 35% chia lại của set đồ 2.0 (phiên Sprint đo, 2026-11-05):
 * × GOC_HE_SO, làm tròn về số nguyên gần nhất, 0,5 làm tròn lên (30 → 26, 10 → 9, 5 → 4). TRAN_O (áo, giày đã theo set_2)
 * và TAY_LUYEN là số trước khi hạ; mọi bước ghi các ô này đều qua goc() nên chạy lại không lệch nhau.
 */
const GOC_HE_SO = 0.85;
const goc = (v: number): number => Math.floor(v * GOC_HE_SO + 0.5);
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
    wb.setCell(o.sheet, ...locate(wb, o.sheet, oh("id"), id, oh("chinh_gia_tri")), pctCell(goc(chinh) / 1000));
    wb.setCell(o.sheet, ...locate(wb, o.sheet, oh("id"), id, oh("phu_gia_tri")), pctCell(goc(phu) / 1000));
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

/** Số hợp trận theo đơn vị code (người dùng đổi luật trận pháp 2026-11-04; tầm nhập là đề xuất). */
const HOP_TRAN: Record<string, number> = { formationJoinRange: 2000, formationBond2: 1300, formationBond3: 1600, formationBond5: 2000 };

/**
 * Trận pháp cá nhân ×6,0 (bù 5 s gồng, đã chốt) và hợp trận 2–3–5 người: k của tran_phap ở sheet Loại chiêu, 4 khóa mới của
 * SKILL_RULES chèn ngay sau dòng SKILL_RULES cuối ở sheet Tham số.
 */
const hopTran: Step = (wb, log) => {
  const lc = B.LOAI_CHIEU, lh = (k: string) => lc.cols.find((c) => c.key === k)!.header;
  wb.setCell(lc.sheet, ...locate(wb, lc.sheet, lh("ma"), "tran_phap", lh("k")), { v: 6, fill: "gdd" });
  log.push("Loại chiêu: tran_phap k ×6,0");
  chenSkillRules(wb, log, HOP_TRAN, "hợp trận");
};

/** Chèn các khóa SKILL_RULES còn thiếu (tên, kiểu, nguồn lấy ở N.CODE_PARAMS) ngay sau dòng SKILL_RULES cuối của sheet Tham số. */
function chenSkillRules(wb: Workbook, log: string[], values: Record<string, number>, label: string): void {
  const ts = B.PARAMS.sheet, s = wb.sheet(ts);
  const groupAt = (s.cells[0] ?? []).map(norm).indexOf("Nhóm"), keyAt = (s.cells[0] ?? []).map(norm).indexOf("Khóa");
  const have = new Set(s.cells.map((r) => norm(r?.[keyAt])));
  const missing = Object.keys(values).filter((k) => !N.CODE_PARAMS.SKILL_RULES.some(([x]) => x === k));
  if (missing.length) throw new Error(`Thiếu mô tả ở noi_dung.ts CODE_PARAMS.SKILL_RULES cho ${missing.join(", ")}`);
  const desc = N.CODE_PARAMS.SKILL_RULES.filter(([k]) => k in values && !have.has(k));
  if (!desc.length) return void log.push(`Tham số: đã có ${Object.keys(values).length} khóa ${label}, bỏ qua`);
  const last = s.cells.reduce((a, r, i) => (norm(r?.[groupAt]) === "SKILL_RULES" ? i : a), -1);
  if (last < 0) throw new Error("Tham số: không có nhóm SKILL_RULES");
  wb.insertRows(ts, last + 1, desc.map(([key, name, kieu, muc, src]) =>
    paramCells("SKILL_RULES", key, name, B.paramFromCode(kieu, values[key]), kieu, muc, src)));
  log.push(`Tham số: chèn ${desc.length} khóa ${label} sau dòng ${last + 1} (SKILL_RULES)`);
}

/** Hợp trận lần 2 (người dùng duyệt 2026-11-04, phiên trận pháp; đề xuất): chờ nhập trận, mục tiêu thêm mỗi người, trần mục tiêu. */
const HOP_TRAN_2: Record<string, number> = { formationJoinWait: 20, formationExtraTargets: 2, formationMaxTargets: 10 };
const hopTran2: Step = (wb, log) => chenSkillRules(wb, log, HOP_TRAN_2, "hợp trận lần 2");

// ---------- luyện khí sau cấp tối đa (GDD tab Trang bị phần 13, rev 37; ghi chú chung luyen-khi.md; mọi số là đề xuất) ----------

const STAT_TEN: Record<string, string> = {
  critDamage: "Sát thương chí mạng", armorPen: "Xuyên giáp", attackSpeed: "Tốc đánh", lifesteal: "Hút máu", manaMax: "Mana tối đa",
  cooldownCut: "Giảm hồi chiêu", controlTime: "Thời gian khống chế", healPower: "Hiệu quả hồi máu và khiên", hp: "Máu",
  shieldTaken: "Khiên nhận", healTaken: "Hồi máu nhận", critBonus: "Chí mạng", resistPen: "Xuyên kháng", def: "Phòng thủ",
  dot: "Sát thương theo thời gian", defOuter: "Thủ ngoại", defInner: "Thủ nội",
};
/** 4 loại chỉ số phụ mỗi ô, giá trị phần nghìn ở lục +0; loại 1 là chỉ số phụ mặc định. */
const TAY_LUYEN: Record<string, [string, number][]> = {
  vu_khi: [["critDamage", 20], ["armorPen", 10], ["attackSpeed", 10], ["lifesteal", 5]],
  mu: [["manaMax", 20], ["cooldownCut", 5], ["controlTime", 20], ["healPower", 10]],
  ao: [["hp", 15], ["shieldTaken", 20], ["healTaken", 10], ["defInner", 10]],
  dai: [["healTaken", 10], ["hp", 10], ["healPower", 10], ["shieldTaken", 10]],
  bao_tay: [["critBonus", 5], ["critDamage", 10], ["resistPen", 10], ["attackSpeed", 5]],
  giay: [["attackSpeed", 10], ["cooldownCut", 5], ["controlTime", 20], ["defOuter", 10]],
  ngoc_boi: [["cooldownCut", 5], ["manaMax", 10], ["dot", 20], ["resistPen", 10]],
};
/** Khí văn: mã, tên, tác dụng, số chính, đơn vị. */
const KHI_VAN: [string, string, string, number, string][] = [
  ["KV-CO-001", "Phá Thuẫn Văn", "Đòn đầu tiên lên mục tiêu đang có khiên +10% sát thương", 0.10, "%"],
  ["KV-CO-002", "Truy Mệnh Văn", "Mục tiêu dưới 20% máu nhận thêm 5% sát thương", 0.05, "%"],
  ["KV-CO-003", "Tiên Phát Văn", "Chiêu đầu tiên mỗi trận +15% sát thương", 0.15, "%"],
  ["KV-CO-004", "Liên Kích Văn", "Đánh cùng mục tiêu 3 lần liên tiếp thì lần thứ 3 +8% sát thương", 0.08, "%"],
  ["KV-CO-005", "Khắc Hệ Văn", "Đánh hệ mình khắc: hệ số ×1,5 thành ×1,53", 1.53, "hệ số"],
  ["KV-CO-006", "Tụ Linh Văn", "Hạ gục kẻ địch thì hồi 3% mana", 0.03, "%"],
  ["KV-CO-007", "Phá Trận Văn", "Sát thương lên trận nhãn, hộ trận +3% (chiến tranh)", 0.03, "%"],
  ["KV-CO-008", "Liệp Yêu Văn", "Sát thương lên dị thú và boss PvE +4%", 0.04, "%"],
  ["KV-TH-001", "Hộ Mệnh Văn", "Lần đầu máu dưới 25%: khiên 1,8% máu tối đa", 0.018, "%"],
  ["KV-TH-002", "Ngự Khắc Văn", "Trúng đòn hệ khắc mình: hệ số ×1,5 thành ×1,47", 1.47, "hệ số"],
  ["KV-TH-003", "Phản Chấn Văn", "Phản 3% sát thương cận chiến nhận được", 0.03, "%"],
  ["KV-TH-004", "Thiết Bích Văn", "Đứng hàng trước: phòng thủ +3%", 0.03, "%"],
  ["KV-TH-005", "Tĩnh Tâm Văn", "Đứng hàng sau: mana tối đa +3%", 0.03, "%"],
  ["KV-TH-006", "Hồi Xuân Văn", "Hồi 1% máu mỗi 5 s", 0.01, "%"],
  ["KV-TH-007", "Định Thân Văn", "Mỗi lần bị đẩy lùi chỉ bị đẩy một nửa quãng", 0.5, "%"],
  ["KV-TH-008", "Tị Kiếp Văn", "Lôi kiếp gây ít hơn 5% sát thương (ngoài trận)", 0.05, "%"],
];
const PHAN_GIAI: [string, number][] = [["lam", 1], ["tim", 3], ["vang", 10], ["do", 25]];
const PHACH_TEN = ["Canh Kim Phách", "Thanh Mộc Phách", "Huyền Thủy Phách", "Xích Diễm Phách", "Hậu Thổ Phách", "Tử Lôi Phách",
  "Thanh Phong Phách", "Diệu Quang Phách", "U Lãnh Phách", "Thuần Dương Phách", "Huyền Âm Phách", "Hàn Tủy Phách"];
/** Danh khí: mã, tên, khí hình, danh văn. Đồ phổ NL-DP-001…010 theo cùng thứ tự. */
const DANH_KHI: [string, string, string, string][] = [
  ["TB-KI-061", "Thiên Vấn Kiếm", "kiem", "Cận chiến đơn chí mạng thì chiêu đó hồi chiêu nhanh 0,5 s"],
  ["TB-KI-062", "Đoạn Nhạc Đao", "dao", "Mỗi mục tiêu trúng quét từ thứ 3 trở đi cho người cầm khiên 1% máu tối đa"],
  ["TB-KI-063", "Lạc Tinh Cung", "cung", "Đòn tầm xa vào kẻ đang vận công +20% sát thương"],
  ["TB-KI-064", "Phong Lôi Phiến", "phien", "Diện rộng trúng từ 6 mục tiêu thì lần vận công kế tiếp nhanh gấp đôi"],
  ["TB-KI-065", "Bất Động Côn", "con", "Khiên hộ thể của người cầm đỡ thêm 1 lần khống chế cho người được che"],
  ["TB-KI-066", "Tạo Hóa Bút", "but", "Bùa chú thêm 1 lần mỗi trận, mỗi lần −15% sát thương"],
  ["TB-KI-067", "Tinh La Kỳ", "ky", "Trận pháp bày xong thì đồng đội đứng trong trận +5% phòng thủ trong 5 s"],
  ["TB-KI-068", "Vọng Nguyệt Cầm", "cam", "Hồi phục giải luôn 1 hiệu ứng thiêu đốt hoặc độc"],
  ["TB-KI-069", "Ngọc Lâu Tiêu", "tieu", "Khống chế trúng kẻ đang vận công hoặc đang bày trận thì chiêu đó mất luôn, không hoàn hồi chiêu"],
  ["TB-KI-070", "Phá Thiên Thương", "thuong", "Lướt tới xong, đòn kế tiếp xuyên 20% khiên"],
];
const LUAT_LK: [string, number][] = [
  ["phanGiaiMoCap", 20], ["baoGiamMoCap", 20], ["tayLuyenMoCap", 101], ["khiLinhMoCap", 201], ["khiLinhBacToiThieu", 3],
  ["songHeCapNgoc", 7], ["phachCapNgoc", 10], ["danhKhiMoCap", 250], ["danhKhiLoToiThieu", 9],
  ["phanGiaiKhiTinhMoiCapKhiLinh", 1], ["phanGiaiTraNac", 500], ["tayLuyenKhiTinh", 2],
  ["khiLinhKnTran", 1], ["khiLinhKnBiCanh", 5], ["khiLinhKnKhiTinh", 10],
  ["khiVanToiDa.tim", 1], ["khiVanToiDa.vang", 2], ["khiVanToiDa.do", 3], ["khiVanKichToiDa", 3], ["khiVanTranLucChien", 20],
  ["taoVanLinhVanThach", 1], ["phachTyLe", 300], ["phachKhiTinh", 20],
  ["danhKhiVanThiet", 5], ["danhKhiKhiTinh", 50], ["danhKhiHoLo", 3], ["danhKhiTyLe.lo9", 400], ["danhKhiTyLe.lo10", 600],
  ["danhKhiYHeSo", 1000], ["danhKhiMoiNguoi", 1], ["baoGiamTuanLinhVanThach", 2], ["teLuyenHoiChieuSan", 600],
];
const GHI_CHU_LK = [
  "Luyện khí sau cấp tối đa (GDD tab Trang bị, pháp bảo và set đồ, phần 13; mọi số là đề xuất): mở rộng theo chiều ngang (thêm lựa chọn, thứ để thử, thứ để sưu tầm), cả lớp cộng tối đa khoảng 3 điểm lực chiến, trong trần 35% của đồ.",
  "Mở khóa (số ở luat): phân giải và Bảo Giám từ cấp 20; tẩy luyện từ Kết Đan; khí linh và khí văn từ Hóa Thần, món từ tím; song hệ khi có ngọc cấp 7; Ngọc Phách khi có ngọc cấp 10; danh khí từ cấp 250 Hạ vị hoặc từ Trung vị, tông môn có lò rèn cấp 9; tế luyện tầng pháp bảo từ Trung vị.",
  "tay_luyen: đổi loại chỉ số phụ của một món sang loại khác trong 4 loại của ô, cùng thang giá trị (giá trị ở lục +0, nhân độ hiếm, cường hóa, bí cảnh như chỉ số phụ cũ). Loại 1 là chỉ số phụ mặc định ở trang_bi.json o[].phu. Người thường quay ngẫu nhiên trong 3 loại còn lại; Tu rèn chọn thẳng.",
  "khi_linh: mỗi cấp cộng cong_chi_so vào hệ số cùng chỗ với cường hóa; món có khí linh từ cấp 1 khóa vào nhân vật. Cấp 3, 6, 9 mở ô khí văn, tối đa luat.khiVanToiDa theo độ hiếm; chọn 1 trong 3 khí văn của nhóm ô (cong: vũ khí, bao tay, ngọc bội; thu: mũ, áo, đai, giày).",
  "khi_van: gia_tri là số chính của tác dụng để chỉnh. Một khí văn trên nhiều món tính tối đa luat.khiVanTinhToiDa lần; tổng mọi khí văn không quá luat.khiVanTranLucChien lực chiến; khắc hệ sau mọi thứ vẫn còn ít nhất ×1,2.",
  "phan_giai: món từ lam ra Khí Tinh theo độ hiếm, cộng luat.phanGiaiKhiTinhMoiCapKhiLinh mỗi cấp khí linh; ngọc, Ý châu, ấn trả nguyên vẹn; luat.phanGiaiTraNac số nấc cường hóa trả lại thành Luyện Khí Thạch đúng phẩm. Khí Tinh từ đồ khóa cũng khóa.",
  "danh_khi: luyện ở lò tông môn cấp luat.danhKhiLoToiThieu trở lên theo đồ phổ, phôi là 1 vũ khí đỏ cùng khí hình; Ý của khí hình mạnh gấp luat.danhKhiYHeSo lần Ý châu, không chiếm dòng khảm, cộng danh văn riêng. Mỗi người mặc luat.danhKhiMoiNguoi danh khí; khóa. Thất bại mất Khí Tinh và Vẫn Thiết, giữ phôi và đồ phổ.",
  "bao_giam: ghi mọi kiểu đã từng sở hữu, cả khi đã phân giải; mỗi trang cho thưởng không cộng chỉ số chiến đấu. Trang, số lượng và thưởng là đề xuất. Mỗi tuần một trang tuần ngẫu nhiên cho luat.baoGiamTuanLinhVanThach Linh Văn Thạch.",
  "te_luyen_tang: pháp bảo đã tế luyện, từ Trung vị, lên tầng 1–5; linh_luc, hoi_chieu là cộng dồn tới tầng đó. Hồi chiêu pháp bảo sau mọi nguồn (set Cổ Tông, tầng) không dưới luat.teLuyenHoiChieuSan hồi chiêu gốc.",
];
const GHI_CHU_NGOC_LK = "song_he, phach (luyện khí, đề xuất 2026-11-04): song hệ hợp 2 viên cùng cấp, hai hệ tương sinh hoặc tương hợp, mỗi hệ moi_he giá trị một viên thường, tính trong trần mềm của hệ đó. Phách điểm hóa từ 1 ngọc cấp 10 (luyen_khi.json luat.phachKhiTinh, luat.phachTyLe), khảm ô công, cho gia_tri và nâng trần sát thương hệ đó lên tran_toi_da; mỗi hệ 1 Phách tính trần; khóa.";

const luyenKhi: Step = (wb, log) => {
  // Sheet mới, đặt sau Nguyên liệu rèn
  const pb = wb.sheet("Pháp bảo loại"), pbh = (pb.cells[0] ?? []).map(norm);
  const pbId = pbh.indexOf("Mã"), pbTen = pbh.indexOf("Tên");
  const pbLoai = pb.cells.slice(1).filter((r) => norm(r?.[pbId])).map((r) => [norm(r[pbId]), norm(r[pbTen])]);
  const oTen: Record<string, string> = { vu_khi: "Vũ khí", mu: "Mũ", ao: "Áo", dai: "Đai", bao_tay: "Bao tay", giay: "Giày", ngoc_boi: "Ngọc bội" };
  const baoGiam = [
    ...Object.keys(TAY_LUYEN).map((o) => ({
      ma: `BG-TB-${o.toUpperCase().replace(/_/g, "")}`, ten: `${oTen[o]} phổ`, dem: `loai: trang_bi; o: ${o}`, so_luong: o === "vu_khi" ? 70 : 60,
      thuong: o === "vu_khi" ? "Danh hiệu Vạn Binh; ánh sáng vũ khí" : `Khung ô ${oTen[o].toLowerCase()}; 10 Khí Tinh`,
    })),
    ...pbLoai.map(([id, ten]) => ({ ma: `BG-PB-${id.toUpperCase().replace(/_/g, "")}`, ten: `${ten} đủ năm màu`, dem: `loai: phap_bao; phap_bao: ${id}`, so_luong: 5, thuong: "5 Khí Tinh" })),
    { ma: "BG-PB-ALL", ten: "Bách Bảo phổ", dem: "loai: phap_bao", so_luong: 50, thuong: "Danh hiệu Bách Bảo; 10 ô kho" },
    { ma: "BG-PK-ALL", ten: "Pháp khí phổ", dem: "loai: phap_khi", so_luong: 24, thuong: "10 ô túi" },
    { ma: "BG-YC-ALL", ten: "Ý châu phổ", dem: "loai: y_chau", so_luong: 10, thuong: "Ánh sáng vũ khí theo Ý" },
    { ma: "BG-AN-ALL", ten: "Ấn phổ", dem: "loai: an_bo", so_luong: 20, thuong: "Danh hiệu Ấn Tàng" },
    { ma: "BG-PH-ALL", ten: "Phách phổ", dem: "loai: phach", so_luong: 12, thuong: "Khung ô ngọc" },
    { ma: "BG-DK-ALL", ten: "Danh khí phổ", dem: "loai: danh_khi", so_luong: 10, thuong: "Danh hiệu Thần Binh" },
  ];
  const sheets: [string, Record<string, string | number | null>[]][] = [
    ["Tẩy luyện", Object.entries(TAY_LUYEN).flatMap(([o, list]) => list.map(([stat, v], i) => ({ o, loai: i + 1, stat, ten: STAT_TEN[stat], gia_tri: v / 1000 })))],
    ["Khí linh", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((k) => ({
      cap: k, kinh_nghiem: 100 * k, kinh_nghiem_tich_luy: (100 * k * (k + 1)) / 2, cong_chi_so: (5 * k) / 1000, mo_o_khi_van: k > 0 && k % 3 === 0 ? "có" : "không",
    }))],
    ["Khí văn", KHI_VAN.map(([ma, ten, tac_dung, gia_tri, don_vi]) => ({ ma, nhom: ma.startsWith("KV-CO") ? "cong" : "thu", ten, tac_dung, gia_tri, don_vi }))],
    ["Phân giải", PHAN_GIAI.map(([do_hiem, khi_tinh]) => ({ do_hiem, khi_tinh }))],
    ["Ngọc Phách", N.ELEMENT_ORDER.map((he, i) => ({
      ma_vp: `NG-PH-${String(i + 1).padStart(3, "0")}`, he, ten: PHACH_TEN[i], gia_tri: 0.11, tran_toi_da: 0.28, khoa: "có", nguon: "diem_hoa_ngoc_cap_10",
    }))],
    ["Song hệ ngọc", [{ ma_vp: "NG-SH-001", ten: "Song Hệ Ngọc", moi_he: 0.6, mo_ta: "Hợp 2 viên cùng cấp, hai hệ tương sinh hoặc tương hợp; hai hệ và cấp là thuộc tính từng viên. Tỷ lệ đậu như nén lên chính cấp đó", nguon: "hop_ngoc" }]],
    ["Danh khí", DANH_KHI.map(([ma_vp, ten, khi_hinh, danh_van], i) => ({ ma_vp, ten, khi_hinh, danh_van, do_pho: `NL-DP-${String(i + 1).padStart(3, "0")}` }))],
    ["Bảo Giám", baoGiam],
    ["Tế luyện tầng", [1, 2, 3, 4, 5].map((k) => ({ tang: k, linh_luc: k / 10, hoi_chieu: -k / 50, khi_tinh: 5 * k }))],
  ];
  let after = "Nguyên liệu rèn";
  for (const [name, rows] of sheets) {
    if (wb.names().includes(name)) log.push(`${name}: sheet đã có, bỏ qua`);
    else { wb.addSheet(table(partDef(name), rows), after); log.push(`${name}: thêm sheet ${rows.length} dòng`); }
    after = name;
  }

  // 10 danh khí vào Kiểu trang bị, ngay sau TB-KI-060
  const kt = partDef("Kiểu trang bị"), ks = wb.sheet(kt.sheet), kh = (ks.cells[0] ?? []).map(norm);
  const kId = kh.indexOf(kt.cols.find((c) => c.key === "ma_vp")!.header);
  const haveKieu = new Set(ks.cells.map((r) => norm(r?.[kId])));
  const newKieu = DANH_KHI.filter(([ma]) => !haveKieu.has(ma)).map(([ma_vp, ten, khi_hinh, danh_van]) => ({
    ma_vp, o: "vu_khi", so: Number(ma_vp.slice(-3)), ten, do_hiem: "do", khi_hinh, ten_de_xuat: null, dang: null,
    mo_ta: `Danh khí (thần binh có tên): ${danh_van}`, nguon: "luyen_danh_khi",
  }));
  if (newKieu.length) {
    const last = ks.cells.reduce((a, r, i) => (/^TB-KI-\d{3}$/.test(norm(r?.[kId])) ? i : a), -1);
    wb.insertRows(kt.sheet, last + 1, tableRows(kt, newKieu));
  }
  log.push(`Kiểu trang bị: chèn ${newKieu.length} danh khí sau vũ khí cuối`);

  // Nguyên liệu: Khí Tinh, Linh Văn Thạch, 10 đồ phổ
  const nl = partDef("Nguyên liệu rèn"), ns = wb.sheet(nl.sheet), nId = (ns.cells[0] ?? []).map(norm).indexOf(nl.cols.find((c) => c.key === "ma_vp")!.header);
  const haveNl = new Set(ns.cells.map((r) => norm(r?.[nId])));
  const newNl = [
    { ma_vp: "NL-KT-001", ten: "Khí Tinh", mo_ta: "Phân giải đồ từ lam trở lên ra; dùng tẩy luyện, dưỡng khí linh, luyện danh khí, tế luyện tầng pháp bảo. Từ đồ khóa thì khóa, từ đồ chưa khóa thì bán được bằng linh thạch", nguon: "phan_giai", moi: "có" },
    { ma_vp: "NL-KT-002", ten: "Linh Văn Thạch", mo_ta: "Tẩy văn: quay lại 3 lựa chọn khí văn của một ô", nguon: "bao_giam_trang_tuan", moi: "có" },
    ...DANH_KHI.map(([, ten], i) => ({
      ma_vp: `NL-DP-${String(i + 1).padStart(3, "0")}`, ten: `${ten} đồ phổ`, mo_ta: `Đồ phổ luyện danh khí ${ten}; khóa`,
      nguon: "thuong_co_chien_truong, hon_don_bi_canh", moi: "có",
    })),
  ].filter((r) => !haveNl.has(r.ma_vp));
  if (newNl.length) wb.appendRows(nl.sheet, tableRows(nl, newNl));
  log.push(`Nguyên liệu rèn: thêm ${newNl.length} dòng`);

  // Luật và ghi chú
  const luatDef = partDef("Luật trang bị");
  const have = new Set(wb.sheet(luatDef.sheet).cells.map((r) => norm(r?.[0])));
  const luat = LUAT_LK.map(([k, v]) => [`luyen_khi.json:luat.${k}`, v] as const).filter(([k]) => !have.has(k)).map(([khoa, v]) => {
    const [, ten, kieu] = TB.LUAT.find((l) => l[0] === khoa)!;
    return { khoa, ten, gia_tri: kieu === "số" ? v : v / 1000, kieu };
  });
  if (luat.length) wb.appendRows(luatDef.sheet, tableRows(luatDef, luat));
  log.push(`Luật trang bị: thêm ${luat.length} dòng`);
  const gcDef = partDef("Ghi chú trang bị"), gs = wb.sheet(gcDef.sheet);
  const gh = (k: string) => (gs.cells[0] ?? []).map(norm).indexOf(gcDef.cols.find((c) => c.key === k)!.header);
  const addGc: Record<string, string | number>[] = [];
  if (!gs.cells.some((r) => norm(r?.[gh("file")]) === "luyen_khi.json")) GHI_CHU_LK.forEach((noi_dung, i) => addGc.push({ file: "luyen_khi.json", stt: i + 1, noi_dung }));
  const ngocNotes = gs.cells.filter((r) => norm(r?.[gh("file")]) === "ngoc.json");
  if (!ngocNotes.some((r) => norm(r?.[gh("noi_dung")]).startsWith("song_he, phach"))) {
    addGc.push({ file: "ngoc.json", stt: Math.max(0, ...ngocNotes.map((r) => Number(r?.[gh("stt")]))) + 1, noi_dung: GHI_CHU_NGOC_LK });
  }
  if (addGc.length) wb.appendRows(gcDef.sheet, tableRows(gcDef, addGc));
  log.push(`Ghi chú trang bị: thêm ${addGc.length} dòng`);
  const intro = "Tẩy luyện … Tế luyện tầng (9 sheet)";
  if (!wb.sheet(B.NOTE_SHEET).cells.some((r) => norm(r?.[0]) === intro)) {
    wb.appendRows(B.NOTE_SHEET, [[{ v: intro, bold: true }, { v: "Luyện khí sau cấp tối đa (GDD tab Trang bị phần 13): tẩy luyện, khí linh, khí văn, phân giải, Ngọc Phách, song hệ ngọc, danh khí, Bảo Giám, tế luyện tầng pháp bảo; mọi số là đề xuất. Xuất ra luyen_khi.json; Phách và song hệ vào ngoc.json; 10 danh khí ở Kiểu trang bị" }]]);
  }
};

// ---------- luyện khí lần 2 (phiên set đồ chốt với tab giao diện, GDD tab Trang bị phần 13 rev 47; đề xuất) ----------

/** Linh thạch đúng phẩm của vị diện mỗi lần tẩy luyện, theo độ hiếm món. */
const TAY_LUYEN_LINH_THACH: [string, number][] = [["luc", 50], ["lam", 200], ["tim", 500], ["vang", 1500], ["do", 3000]];
/** Loại thưởng Bảo Giám theo thứ được đếm: [loại thưởng, số thưởng] (số trống khi thưởng không có số). */
function baoGiamThuong(dem: Record<string, string>, ten: string, oTen: Record<string, string>, pbTen: Record<string, string>): [string, string, number | null] | null {
  switch (dem.loai) {
    case "an_van": return null; // trang Ẩn văn (set_2c) có thưởng riêng
    case "trang_bi": return dem.o === "vu_khi" ? ["Ánh sáng vũ khí", "anh_sang_vu_khi", null] : [`Khung ô ${oTen[dem.o].toLowerCase()}`, "khung_o", null];
    case "danh_khi": return ["Ánh sáng vũ khí riêng của danh khí", "anh_sang_vu_khi", null]; // danh khí là vũ khí
    case "phap_bao": return [dem.phap_bao ? `Danh hiệu ${pbTen[dem.phap_bao]} Chủ` : "Danh hiệu Bách Bảo", "danh_hieu", null];
    case "phach": return ["Danh hiệu Thập Nhị Phách", "danh_hieu", null];
    case "phap_khi": return ["10 ô kho", "o_kho", 10];
    case "an_bo": return ["10 ô túi", "o_tui", 10];
    case "y_chau": return ["10 Khí Tinh", "khi_tinh", 10];
    default: throw new Error(`Bảo Giám ${ten}: loại đếm lạ ${dem.loai}`);
  }
}

/** Ghi chú song hệ, Phách ở ngoc.json (luyen_khi_2 viết, luyen_khi_7 thêm câu Bảo Ngọc Phù). */
const GHI_CHU_SONG_HE = "song_he, phach (luyện khí, đề xuất 2026-11-04): song hệ hợp 2 viên cùng cấp, hai hệ tương sinh hoặc tương hợp, mỗi hệ moi_he giá trị một viên thường, tính trong trần mềm của hệ đó; đậu theo ty_le_dau cố định (không theo bảng nén), thất bại mất that_bai_mat viên (viên đặt thứ hai), phù phu_giu giữ lại cả hai; mỗi lần dùng tiêu 1 tấm phù, đậu hay không cũng mất. Phách điểm hóa từ 1 ngọc cấp 10 (luyen_khi.json luat.phachKhiTinh, luat.phachTyLe), khảm ô công, cho gia_tri và nâng trần sát thương hệ đó lên tran_toi_da; mỗi hệ 1 Phách tính trần; khóa.";

const luyenKhi2: Step = (wb, log) => {
  const text = (v: string): Cell => ({ v, fill: "de_xuat" });
  const hdr = (v: string): Cell => ({ v, fill: "tieu_de", bold: true, wrap: true });
  const colOf = (def: B.TableDef, key: string) => def.cols.find((c) => c.key === key)!;

  // 1. Song hệ ngọc: tỷ lệ đậu cố định, thất bại mất viên đặt thứ hai, Bảo Ngọc Phù giữ cả hai
  const sh = partDef("Song hệ ngọc");
  const shCols: [string, (r: number) => Cell | null][] = [
    ["ty_le_dau", (r) => (r > 0 ? pctCell(0.8) : null)],
    ["that_bai_mat", (r) => (r > 0 ? { v: 1, fill: "de_xuat" } : null)],
    ["phu_giu", (r) => (r > 0 ? text("PH-CH-002") : null)],
  ];
  for (const [key, cell] of shCols) {
    const c = colOf(sh, key);
    if ((wb.sheet(sh.sheet).cells[0] ?? []).map(norm).includes(c.header)) continue;
    wb.addColumn(sh.sheet, hdr(c.header), (r, row) => (norm(row[0]) ? cell(r) : null), c.width);
    log.push(`Song hệ ngọc: thêm cột ${c.header}`);
  }
  wb.setCell(sh.sheet, ...locate(wb, sh.sheet, colOf(sh, "ma_vp").header, "NG-SH-001", colOf(sh, "mo_ta").header),
    text("Hợp 2 viên cùng cấp, hai hệ tương sinh hoặc tương hợp; hai hệ và cấp là thuộc tính từng viên. Tỷ lệ đậu cố định, không theo bảng nén; thất bại mất viên đặt thứ hai, Bảo Ngọc Phù giữ lại cả hai"));

  // 2. Tẩy luyện: linh thạch mỗi lần theo độ hiếm, chèn ngay sau dòng tayLuyenKhiTinh
  const luatDef = partDef("Luật trang bị"), ls = wb.sheet(luatDef.sheet);
  const have = new Set(ls.cells.map((r) => norm(r?.[0])));
  const luat = TAY_LUYEN_LINH_THACH.map(([k, v]) => [`luyen_khi.json:luat.tayLuyenLinhThach.${k}`, v] as const).filter(([k]) => !have.has(k))
    .map(([khoa, v]) => ({ khoa, ten: TB.LUAT.find((l) => l[0] === khoa)![1], gia_tri: v, kieu: "số" }));
  if (luat.length) {
    const at = ls.cells.findIndex((r) => norm(r?.[0]) === "luyen_khi.json:luat.tayLuyenKhiTinh");
    if (at < 0) throw new Error("Luật trang bị: không có dòng luyen_khi.json:luat.tayLuyenKhiTinh");
    wb.insertRows(luatDef.sheet, at + 1, tableRows(luatDef, luat));
  }
  log.push(`Luật trang bị: chèn ${luat.length} dòng giá linh thạch tẩy luyện`);

  // 3. Bảo Giám: thưởng theo loại; thêm cột loại thưởng và số thưởng
  const bg = partDef("Bảo Giám");
  const oTen: Record<string, string> = { vu_khi: "Vũ khí", mu: "Mũ", ao: "Áo", dai: "Đai", bao_tay: "Bao tay", giay: "Giày", ngoc_boi: "Ngọc bội" };
  const pb = wb.sheet("Pháp bảo loại"), pbh = (pb.cells[0] ?? []).map(norm);
  const pbTen = Object.fromEntries(pb.cells.slice(1).map((r) => [norm(r?.[pbh.indexOf("Mã")]), norm(r?.[pbh.indexOf("Tên")])]));
  const bs = wb.sheet(bg.sheet), bh = (bs.cells[0] ?? []).map(norm);
  const demAt = bh.indexOf(colOf(bg, "dem").header), maAt = bh.indexOf(colOf(bg, "ma").header), thuongAt = bh.indexOf(colOf(bg, "thuong").header);
  const plan = bs.cells.map((r, i) => (i > 0 && norm(r?.[maAt]) ? baoGiamThuong(B.parseKv(norm(r[demAt])) as Record<string, string>, norm(r[maAt]), oTen, pbTen) : null));
  plan.forEach((p, i) => p && wb.setCell(bg.sheet, i, thuongAt, text(p[0])));
  for (const [key, pick] of [["loai_thuong", (p: [string, string, number | null]) => text(p[1])], ["so_thuong", (p: [string, string, number | null]) => (p[2] === null ? null : { v: p[2], fill: "de_xuat" as const })]] as const) {
    const c = colOf(bg, key);
    if ((wb.sheet(bg.sheet).cells[0] ?? []).map(norm).includes(c.header)) {
      const at = (wb.sheet(bg.sheet).cells[0] ?? []).map(norm).indexOf(c.header);
      plan.forEach((p, i) => { const v = p && pick(p); if (v) wb.setCell(bg.sheet, i, at, v); });
    } else wb.addColumn(bg.sheet, hdr(c.header), (r) => (plan[r] ? pick(plan[r]!) : null), c.width);
  }
  log.push(`Bảo Giám: thưởng theo loại cho ${plan.filter(Boolean).length} trang`);

  // Ghi chú: tẩy luyện tốn linh thạch; song hệ đậu cố định
  const gc = partDef("Ghi chú trang bị"), gs = wb.sheet(gc.sheet), gh = (gs.cells[0] ?? []).map(norm);
  const fAt = gh.indexOf(colOf(gc, "file").header), nAt = gh.indexOf(colOf(gc, "noi_dung").header);
  const note = (file: string, start: string, v: string) => {
    const i = gs.cells.findIndex((r) => norm(r?.[fAt]) === file && norm(r?.[nAt]).startsWith(start));
    if (i < 0) throw new Error(`Ghi chú trang bị: không có dòng ${file} "${start}…"`);
    wb.setCell(gc.sheet, i, nAt, text(v));
  };
  note("luyen_khi.json", "tay_luyen:", "tay_luyen: đổi loại chỉ số phụ của một món sang loại khác trong 4 loại của ô, cùng thang giá trị (giá trị ở lục +0, nhân độ hiếm, cường hóa, bí cảnh như chỉ số phụ cũ). Loại 1 là chỉ số phụ mặc định ở trang_bi.json o[].phu. Người thường quay ngẫu nhiên trong 3 loại còn lại; Tu rèn chọn thẳng. Mỗi lần tốn luat.tayLuyenKhiTinh Khí Tinh và luat.tayLuyenLinhThach linh thạch theo độ hiếm món, linh thạch đúng phẩm của vị diện.");
  note("luyen_khi.json", "bao_giam:", GHI_CHU_BAO_GIAM);
  note("ngoc.json", "song_he, phach", GHI_CHU_SONG_HE);
  log.push("Ghi chú trang bị: sửa 3 dòng (tẩy luyện, Bảo Giám, song hệ)");
};

// ---------- luyện khí lần 3 (sau lần đo đầu của phiên Sprint: khí văn vượt trần; GDD tab Trang bị phần 13 rev 55; đề xuất) ----------

/** Số luật luyện khí hiện hành (đơn vị code) theo LUAT_LK; các bước sau ghi đúng số này nên chạy lại không lệch nhau. */
const lkLuat = (k: string): number => {
  const x = LUAT_LK.find(([key]) => key === k);
  if (!x) throw new Error(`LUAT_LK không có ${k}`);
  return x[1];
};

const luyenKhi3: Step = (wb, log) => {
  const text = (v: string): Cell => ({ v, fill: "de_xuat" });
  const colOf = (def: B.TableDef, key: string) => def.cols.find((c) => c.key === key)!.header;
  const put = (def: B.TableDef, id: string, key: string, c: Cell) => wb.setCell(def.sheet, ...locate(wb, def.sheet, colOf(def, def.id), id, colOf(def, key)), c);

  // 1. Luật khí văn: mỗi khí văn tính 1 lần (khiVanTinhToiDa 2 → 1, giữ dòng vì code rules còn đọc; bỏ khi code thôi đọc),
  //    thêm "mỗi người tối đa 3 khí văn đang kích" ngay sau; Ý danh khí ×1,25
  const luat = partDef("Luật trang bị"), cu = "luyen_khi.json:luat.khiVanTinhToiDa", moi = "luyen_khi.json:luat.khiVanKichToiDa";
  const keys = wb.sheet(luat.sheet).cells.map((r) => norm(r?.[0]));
  if (keys.includes(cu)) { // luyen_khi_5 xóa dòng này khi code thôi đọc; chạy lại sau đó thì bỏ qua phần này
    put(luat, cu, "ten", text("Một khí văn trên nhiều món tính tối đa số lần (1: mỗi khí văn tính 1 lần; giữ cho code rules, sẽ bỏ)"));
    put(luat, cu, "gia_tri", { v: 1, fill: "de_xuat" });
    if (!keys.includes(moi)) {
      wb.insertRows(luat.sheet, keys.indexOf(cu) + 1, tableRows(luat, [{ khoa: moi, ten: TB.LUAT.find((l) => l[0] === moi)![1], gia_tri: 3, kieu: "số" }]));
    }
    log.push("Luật trang bị: khiVanTinhToiDa 2 → 1, thêm khiVanKichToiDa 3");
  } else if (!keys.includes(moi)) throw new Error(`Luật trang bị: không có dòng ${cu} lẫn ${moi}`);
  put(luat, "luyen_khi.json:luat.danhKhiYHeSo", "gia_tri", { v: lkLuat("danhKhiYHeSo") / 1000, fill: "de_xuat" });
  log.push(`Luật trang bị: danhKhiYHeSo ×${lkLuat("danhKhiYHeSo") / 1000}`);

  // 2–3. Khí văn Hộ Mệnh, Định Thân (số và chữ theo KHI_VAN)
  const kv = partDef("Khí văn");
  for (const ma of ["KV-TH-001", "KV-TH-007"]) {
    const [, , tacDung, giaTri, donVi] = KHI_VAN.find((x) => x[0] === ma)!;
    put(kv, ma, "tac_dung", text(tacDung));
    put(kv, ma, "gia_tri", donVi === "%" ? pctCell(giaTri) : { v: giaTri, fill: "de_xuat" });
    put(kv, ma, "don_vi", text(donVi));
  }
  log.push("Khí văn: KV-TH-001 khiên 3%, KV-TH-007 đẩy một nửa quãng (50%)");

  // 4. Danh văn Tinh La Kỳ, Ngọc Lâu Tiêu (sheet Danh khí và mô tả ở Kiểu trang bị)
  const dk = partDef("Danh khí"), kt = partDef("Kiểu trang bị");
  for (const ma of ["TB-KI-067", "TB-KI-069"]) {
    const [, , , danhVan] = DANH_KHI.find((x) => x[0] === ma)!;
    put(dk, ma, "danh_van", text(danhVan));
    put(kt, ma, "mo_ta", text(`Danh khí (thần binh có tên): ${danhVan}`));
  }
  log.push("Danh khí: danh văn TB-KI-067, TB-KI-069");

  // 5. Sàn khắc hệ (sim COUNTER_FLOOR) ngay sau resistCap
  const ts = B.PARAMS.sheet, s = wb.sheet(ts), keyAt = (s.cells[0] ?? []).map(norm).indexOf("Khóa");
  if (!s.cells.some((r) => norm(r?.[keyAt]) === "counterFloor")) {
    const at = s.cells.findIndex((r) => norm(r?.[keyAt]) === "resistCap");
    if (at < 0) throw new Error("Tham số: không có dòng resistCap");
    wb.insertRows(ts, at + 1, [paramCells("cong_phap", "counterFloor", "Khắc hệ sau mọi nguồn làm mềm (kháng, set, khí văn) không dưới hệ số", 1.2, "hệ số", "", "de_xuat")]);
    log.push(`Tham số: chèn counterFloor ×1,2 sau dòng ${at + 1} (resistCap)`);
  }

  // Ghi chú khí văn theo luật mới
  const gc = partDef("Ghi chú trang bị"), gs = wb.sheet(gc.sheet), gh = (gs.cells[0] ?? []).map(norm);
  const fAt = gh.indexOf(colOf(gc, "file")), nAt = gh.indexOf(colOf(gc, "noi_dung"));
  const i = gs.cells.findIndex((r) => norm(r?.[fAt]) === "luyen_khi.json" && norm(r?.[nAt]).startsWith("khi_van:"));
  if (i < 0) throw new Error("Ghi chú trang bị: không có dòng khi_van của luyen_khi.json");
  if (!norm(gs.cells[i][nAt]).includes("luat.khiVanKichToiDa")) wb.setCell(gc.sheet, i, nAt, text("khi_van: gia_tri là số chính của tác dụng để chỉnh. Mỗi người chọn tối đa luat.khiVanKichToiDa khí văn đang kích, khác nhau, mỗi khí văn tính 1 lần (luat.khiVanTinhToiDa = 1, giữ tạm cho code); tổng mọi khí văn không quá luat.khiVanTranLucChien lực chiến; khắc hệ sau mọi nguồn làm mềm vẫn còn ít nhất tham_so.json cong_phap.counterFloor (×1,2)."));
  log.push("Ghi chú trang bị: sửa dòng khi_van");
};

// ---------- luyện khí lần 4: cột số cho danh văn và ngưỡng khí văn (phiên Sprint nhờ; số lấy từ câu mô tả, đề xuất) ----------

/** Số của danh văn theo đơn vị code (phần nghìn, tick, số lần); rules đổi sang SkillMod của sim. */
const DANH_VAN_SO: Record<string, string> = {
  "TB-KI-061": "hoiChieuNhanhTicks: 10",
  "TB-KI-062": "khienMoiMucTieu: 10; tuMucTieuThu: 3",
  "TB-KI-063": "satThuongThem: 200",
  "TB-KI-064": "tuSoMucTieu: 6",
  "TB-KI-065": "doThemKhongChe: 1",
  "TB-KI-066": "themLan: 1; heSoSatThuong: 850",
  "TB-KI-067": "phongThuThem: 50; thoiGianTicks: 100",
  "TB-KI-068": "giaiHieuUng: 1",
  "TB-KI-069": "huyChieu: true",
  "TB-KI-070": "xuyenKhien: 200",
};
/** Ngưỡng, chu kỳ trong câu tác dụng của khí văn (số chính vẫn ở gia_tri). */
const KHI_VAN_PHU: Record<string, string> = {
  "KV-CO-002": "nguongMau: 200",
  "KV-TH-001": "nguongMau: 250",
  "KV-TH-006": "chuKyTicks: 100",
};

const luyenKhi4: Step = (wb, log) => {
  const text = (v: string): Cell => ({ v, fill: "de_xuat" });
  for (const [sheet, values, label] of [["Danh khí", DANH_VAN_SO, "danh văn"], ["Khí văn", KHI_VAN_PHU, "khí văn"]] as const) {
    const def = partDef(sheet), col = def.cols.find((c) => c.key === "tham_so")!;
    const idHeader = def.cols.find((c) => c.key === def.id)!.header;
    const s = wb.sheet(sheet), h = (s.cells[0] ?? []).map(norm), idAt = h.indexOf(idHeader);
    const cellOf = (row: Value[] | undefined) => { const v = (values as Record<string, string>)[norm(row?.[idAt])]; return v ? text(v) : null; };
    const at = h.indexOf(col.header);
    if (at < 0) wb.addColumn(sheet, { v: col.header, fill: "tieu_de", bold: true, wrap: true }, (_r, row) => cellOf(row), col.width);
    else s.cells.forEach((row, r) => { const c = r > 0 ? cellOf(row) : null; if (c) wb.setCell(sheet, r, at, c); });
    log.push(`${sheet}: cột ${col.header}, ${Object.keys(values).length} ${label}`);
  }
  // Ghi chú: nói rõ cột mới
  const gc = partDef("Ghi chú trang bị"), gs = wb.sheet(gc.sheet), gh = (gs.cells[0] ?? []).map(norm);
  const hd = (k: string) => gh.indexOf(gc.cols.find((c) => c.key === k)!.header);
  const add: [string, string][] = [
    ["danh_khi:", " danh_khi[].tham_so: số của danh văn theo đơn vị code (phần nghìn, tick, số lần); loại chiêu của danh văn là loại chiêu của khí hình."],
    ["khi_van:", " khi_van[].tham_so: ngưỡng, chu kỳ trong câu tác dụng (nguongMau phần nghìn máu, chuKyTicks tick); trống là không có."],
  ];
  for (const [start, more] of add) {
    const i = gs.cells.findIndex((r) => norm(r?.[hd("file")]) === "luyen_khi.json" && norm(r?.[hd("noi_dung")]).startsWith(start));
    if (i < 0) throw new Error(`Ghi chú trang bị: không có dòng luyen_khi.json "${start}…"`);
    const cur = norm(gs.cells[i][hd("noi_dung")]);
    if (!cur.endsWith(more.trim())) wb.setCell(gc.sheet, i, hd("noi_dung"), text(cur + more));
  }
  log.push("Ghi chú trang bị: thêm câu về cột tham_so ở danh_khi, khi_van");
};

// ---------- luyện khí lần 5: bỏ luật khiVanTinhToiDa (code rules thôi đọc từ 3cb7ba5; mỗi khí văn luôn tính 1 lần) ----------

const luyenKhi5: Step = (wb, log) => {
  const luat = partDef("Luật trang bị"), cu = "luyen_khi.json:luat.khiVanTinhToiDa";
  const at = wb.sheet(luat.sheet).cells.findIndex((r) => norm(r?.[0]) === cu);
  if (at > 0) { wb.deleteRow(luat.sheet, at + 1); log.push(`Luật trang bị: xóa dòng ${at + 1} (khiVanTinhToiDa)`); }
  else log.push("Luật trang bị: khiVanTinhToiDa đã xóa, bỏ qua");
  const gc = partDef("Ghi chú trang bị"), gs = wb.sheet(gc.sheet), gh = (gs.cells[0] ?? []).map(norm);
  const hd = (k: string) => gh.indexOf(gc.cols.find((c) => c.key === k)!.header);
  const i = gs.cells.findIndex((r) => norm(r?.[hd("file")]) === "luyen_khi.json" && norm(r?.[hd("noi_dung")]).startsWith("khi_van:"));
  if (i < 0) throw new Error("Ghi chú trang bị: không có dòng khi_van của luyen_khi.json");
  const cur = norm(gs.cells[i][hd("noi_dung")]), next = cur.replace(" (luat.khiVanTinhToiDa = 1, giữ tạm cho code)", "");
  if (next !== cur) { wb.setCell(gc.sheet, i, hd("noi_dung"), { v: next, fill: "de_xuat" }); log.push("Ghi chú trang bị: bỏ câu khiVanTinhToiDa ở dòng khi_van"); }
};

// ---------- luyện khí lần 6 (sau lần đo 2 của phiên Sprint; GDD tab Trang bị phần 13 rev 62; đề xuất) ----------

const luyenKhi6: Step = (wb, log) => {
  const text = (v: string): Cell => ({ v, fill: "de_xuat" });
  const colOf = (def: B.TableDef, key: string) => def.cols.find((c) => c.key === key)!.header;
  const put = (def: B.TableDef, id: string, key: string, c: Cell) => wb.setCell(def.sheet, ...locate(wb, def.sheet, colOf(def, def.id), id, colOf(def, key)), c);
  // Hộ Mệnh Văn khiên 1,8% máu tối đa
  const kv = partDef("Khí văn"), [, , tacDung, giaTri] = KHI_VAN.find((x) => x[0] === "KV-TH-001")!;
  put(kv, "KV-TH-001", "tac_dung", text(tacDung));
  put(kv, "KV-TH-001", "gia_tri", pctCell(giaTri));
  // Ý danh khí bằng Ý châu; ngân sách khí văn khoảng 2% lực chiến
  const luat = partDef("Luật trang bị"), y = "luyen_khi.json:luat.danhKhiYHeSo";
  put(luat, y, "ten", text(TB.LUAT.find((l) => l[0] === y)![1]));
  put(luat, y, "gia_tri", { v: lkLuat("danhKhiYHeSo") / 1000, fill: "de_xuat" });
  put(luat, "luyen_khi.json:luat.khiVanTranLucChien", "gia_tri", pctCell(lkLuat("khiVanTranLucChien") / 1000));
  log.push(`Khí văn: KV-TH-001 khiên ${Math.round(giaTri * 1000) / 10}%; Luật: danhKhiYHeSo ×${lkLuat("danhKhiYHeSo") / 1000}, khiVanTranLucChien ${lkLuat("khiVanTranLucChien") / 10}%`);
  // Ghi chú danh_khi
  const gc = partDef("Ghi chú trang bị"), gs = wb.sheet(gc.sheet), gh = (gs.cells[0] ?? []).map(norm);
  const hd = (k: string) => gh.indexOf(gc.cols.find((c) => c.key === k)!.header);
  const i = gs.cells.findIndex((r) => norm(r?.[hd("file")]) === "luyen_khi.json" && norm(r?.[hd("noi_dung")]).startsWith("danh_khi:"));
  if (i < 0) throw new Error("Ghi chú trang bị: không có dòng danh_khi của luyen_khi.json");
  const cur = norm(gs.cells[i][hd("noi_dung")]);
  const next = cur.replace("Ý của khí hình mạnh gấp luat.danhKhiYHeSo lần Ý châu, không chiếm dòng khảm", "Ý của khí hình mạnh bằng Ý châu (luat.danhKhiYHeSo), không chiếm dòng khảm");
  if (next !== cur) { wb.setCell(gc.sheet, i, hd("noi_dung"), text(next)); log.push("Ghi chú trang bị: danh_khi, Ý bằng Ý châu"); }
};

// ---------- luyện khí lần 7: Bảo Ngọc Phù tiêu 1 tấm mỗi lần dùng (phiên set đồ) ----------

const luyenKhi7: Step = (wb, log) => {
  const gc = partDef("Ghi chú trang bị"), gs = wb.sheet(gc.sheet), gh = (gs.cells[0] ?? []).map(norm);
  const hd = (k: string) => gh.indexOf(gc.cols.find((c) => c.key === k)!.header);
  const i = gs.cells.findIndex((r) => norm(r?.[hd("file")]) === "ngoc.json" && norm(r?.[hd("noi_dung")]).startsWith("song_he, phach"));
  if (i < 0) throw new Error("Ghi chú trang bị: không có dòng song_he của ngoc.json");
  if (norm(gs.cells[i][hd("noi_dung")]) !== GHI_CHU_SONG_HE) {
    wb.setCell(gc.sheet, i, hd("noi_dung"), { v: GHI_CHU_SONG_HE, fill: "de_xuat" });
    log.push("Ghi chú trang bị: song hệ thêm câu Bảo Ngọc Phù tiêu 1 tấm mỗi lần");
  } else log.push("Ghi chú trang bị: song hệ đã có câu Bảo Ngọc Phù, bỏ qua");
};

// ---------- thú: tăng trưởng, bổ trợ, phát triển (GDD tab cùng tên, 2026-11-05; mọi số là đề xuất) ----------

/** Khóa luật thú mới ở nhóm thu_cuoi (dòng đầy đủ ở noi_dung.ts PARAMS_EXTRA). */
const THU_PT_KEYS = [
  "supportPets", "supportFirstTicks", "supportCooldownTicks", "supportPowerTarget", "fourSymbolsExtraTargets", "pillTuVi",
  "pillLowerRealmShare", "ownerTuViPerDay", "growthDaysTarget", "aptitudeRerollPerDay", "aptitudeRerollPillLevel", "nestMinAptitude",
  "fourSymbolsAptitude", "talentStatSameMax", "talentTier2Realm", "bloodlineRealm", "bloodlineSwapPillLevel",
];
/** Tư chất: sao, tên, tỷ lệ ra, hệ số tu vi, số ô thiên phú. */
const THU_TU_CHAT: [number, string, number, number, number][] = [
  [1, "Hạ", 0.40, 0.8, 1], [2, "Trung", 0.30, 0.9, 1], [3, "Thượng", 0.18, 1.0, 2], [4, "Cực", 0.09, 1.1, 2], [5, "Tuyệt", 0.03, 1.2, 3],
];
/** Tu vi lên tầng n: G × (1 + 0,05 × (t − 1)), G theo đại cảnh giới, t là vị trí tầng trong đại cảnh giới (1–20). */
const THU_TU_VI_G = [400, 1200, 2000, 3000];
/** Thú kỹ: hệ, tên, mục tiêu, khóa hiệu ứng, tác dụng, cấp 1–4 (đơn vị hiển thị), đơn vị, kéo dài (giây, null: tức thời). */
const THU_KY: Record<string, [string, string, string, string, number[], string, number | null]> = {
  kim: ["Kim Phong Hộ Chủ", "chu", "armorPen", "Chủ xuyên giáp thêm", [0.04, 0.06, 0.08, 0.10], "%", 4],
  moc: ["Thanh Mộc Hồi Xuân", "dong_doi_it_mau", "heal", "Đồng đội ít máu nhất (theo %) hồi theo máu tối đa của người đó", [0.008, 0.012, 0.016, 0.02], "%", null],
  thuy: ["Tĩnh Thủy Dưỡng Nguyên", "chu", "mana", "Chủ hồi mana theo mana tối đa", [0.04, 0.06, 0.08, 0.10], "%", null],
  hoa: ["Hỏa Linh Trợ Uy", "chu", "damage", "Chủ gây thêm sát thương", [0.024, 0.036, 0.048, 0.06], "%", 4],
  tho: ["Hậu Thổ Hộ Thuẫn", "chu", "shield", "Chủ nhận khiên theo máu tối đa của chủ", [0.008, 0.012, 0.016, 0.02], "%", null],
  loi: ["Lôi Động Cửu Tiêu", "chu", "attackSpeed", "Chủ đánh nhanh hơn", [0.06, 0.09, 0.12, 0.15], "%", 4],
  phong: ["Ngự Phong Tật Hành", "chu", "cooldown", "Mọi công pháp đang hồi của chủ hồi nhanh thêm", [0.3, 0.4, 0.55, 0.7], "giây", null],
  quang: ["Thánh Quang Tịnh Thể", "dong_doi_bi_hieu_ung", "cleanseHeal", "Giải 1 hiệu ứng xấu (khống chế, thiêu, độc, giảm hồi máu) trên đồng đội đang bị; người đó hồi theo máu tối đa", [0.004, 0.006, 0.008, 0.01], "%", null],
  am_lanh: ["U Ảnh Phệ Huyết", "chu", "lifesteal", "Chủ hút máu thêm", [0.024, 0.036, 0.048, 0.06], "%", 4],
  cuc_duong: ["Liệt Dương Phá Pháp", "chu", "resistPen", "Chủ xuyên kháng thêm", [0.04, 0.06, 0.08, 0.10], "%", 4],
  cuc_am: ["Phệ Hồn Đoạn Sinh", "dich_gan_nhat", "healCut", "Kẻ địch gần chủ nhất nhận ít hồi máu hơn", [0.2, 0.3, 0.4, 0.5], "%", 3],
  cuc_han: ["Hàn Sương Ngưng Bộ", "dich_gan_nhat", "slow", "Kẻ địch gần chủ nhất chậm lại; không cộng với làm chậm của hệ Thủy, lấy mức mạnh hơn", [0.12, 0.18, 0.24, 0.3], "%", 2],
};
/** Huyết mạch: mã, tên, hệ số hiệu lực, thêm mục tiêu, hồi (giây, null: như luật), thay đổi, hợp với. */
const THU_HUYET_MACH: [string, string, number, number, number | null, string, string][] = [
  ["chuyen_tam", "Chuyên Tâm", 1.3, 0, null, "Hiệu lực ×1,3, giữ 1 mục tiêu", "Một người gánh, đánh bí cảnh một mình"],
  ["quang_bo", "Quảng Bố", 0.65, 1, null, "Thêm 1 mục tiêu (đồng đội gần chủ nhất, hoặc kẻ địch thứ hai), hiệu lực mỗi mục tiêu ×0,65", "Party, chiến tranh"],
  ["cap_toc", "Cấp Tốc", 0.9, 0, 7, "Hồi 7 s thay vì 10 s, hiệu lực ×0,9; trận 30 s ra 4 lần", "Trận ngắn, đội cần giải khống chế sớm"],
];
/** Thiên phú: mã Thú Quyết, tên, nhóm, khóa hiệu ứng, tác dụng, bậc 1, bậc 2, đơn vị, tính khi. */
const THU_THIEN_PHU: [string, string, string, string, string, number, number, string, string][] = [
  ["TH-TQ-001", "Cường Kỹ", "thu_ky", "thuKyHieuLuc", "Hiệu lực thú kỹ tăng", 0.10, 0.20, "%", "ho_chu"],
  ["TH-TQ-002", "Tốc Kỹ", "thu_ky", "thuKyHoiNhanh", "Thú kỹ hồi nhanh hơn", 0.5, 1, "giây", "ho_chu"],
  ["TH-TQ-003", "Tiên Phát", "thu_ky", "thuKyLanDauSom", "Lần đầu ra thú kỹ sớm hơn", 1, 2, "giây", "ho_chu"],
  ["TH-TQ-004", "Hộ Chủ", "thu_ky", "hoChuNguongMau", "Lần đầu mỗi trận chủ dưới ngưỡng máu này, thú kỹ ra ngay", 0.30, 0.40, "%", "ho_chu"],
  ["TH-TQ-005", "Thú Uy", "chi_so", "atk", "Chủ cộng công", 0.003, 0.006, "%", "ca_5"],
  ["TH-TQ-006", "Linh Giáp", "chi_so", "def", "Chủ cộng phòng", 0.003, 0.006, "%", "ca_5"],
  ["TH-TQ-007", "Linh Nguyên", "chi_so", "hp", "Chủ cộng máu", 0.003, 0.006, "%", "ca_5"],
  ["TH-TQ-008", "Truy Phong", "ngoai", "tocDoHanhTrinh", "Tốc độ hành trình tăng", 0.05, 0.10, "%", "thu_cuoi"],
  ["TH-TQ-009", "Linh Giác", "ngoai", "suKienGiam", "Xác suất gặp sự kiện mỗi chặng giảm", 0.05, 0.10, "%", "thu_cuoi"],
  ["TH-TQ-010", "Phá Thành", "ngoai", "phaTran", "Sức phá trận của linh thú công thành tăng", 0.05, 0.10, "%", "cong_thanh"],
  ["TH-TQ-011", "Dưỡng Tính", "ngoai", "tuVi", "Tu vi thú này nhận tăng", 0.05, 0.10, "%", "luon"],
  ["TH-TQ-012", "Độ Kiếp", "ngoai", "thuKiep", "Tỷ lệ thú kiếp của thú này tăng, trong trần 80%", 0.03, 0.06, "%", "luon"],
  ["TH-TQ-013", "Tầm Bảo", "ngoai", "danThuRoi", "Thú Lâm rơi đan thú tăng, chung trần rơi ở mục 12", 0.05, 0.10, "%", "ho_chu"],
  ["TH-TQ-014", "Tụ Linh", "ngoai", "luyenHoaThem", "Luyện hóa thú này trả thêm Dưỡng Linh Đơn", 0.10, 0.20, "%", "luyen_hoa"],
];
const GHI_CHU_THU_PT = [
  "Thú: tăng trưởng, bổ trợ, phát triển (GDD tab cùng tên, 2026-11-05; mọi số là đề xuất). Lớp này nằm trên hệ thú ở thu_cuoi.json, thu_canh_gioi.json, thu_kich_phat.json, linh_don.json; luật số ở tham_so.json thu_cuoi (support*, pill*, aptitude*, talent*, bloodline*, growthDaysTarget).",
  "tu_chat: ty_le phần nghìn, tổng 1000; tu_vi là hệ số ×1000 nhân mọi tu vi thú nhận; tư chất không đổi chỉ số ở cùng tầng. Tẩy Tủy Đơn (linh_don.json tay_tuy) tung lại theo ty_le, chỉ nhận khi ra cao hơn.",
  "tu_vi: tu_vi là tu vi lên tầng đó từ tầng trước, tich_luy cộng dồn từ tầng 1. Công thức G × (1 + 0,05 × (t − 1)), G = 400 / 1200 / 2000 / 3000 theo đại cảnh giới, t là vị trí tầng trong đại cảnh giới. thu_kiep: vào tầng đó phải qua thú kiếp như thu_canh_gioi.json.",
  "thu_ky: cap_1…cap_4 theo đại cảnh giới của thú, đơn vị ở don_vi (phan_nghin: theo máu tối đa, mana tối đa hoặc chỉ số của mục tiêu; tick: giảm hồi chiêu); thoi_gian tick, null là tức thời hoặc khiên giữ tới khi vỡ. Lần đầu ra ở supportFirstTicks, hồi supportCooldownTicks; không tốn mana, không bị cắt, thú hộ chủ đứng ngoài sân.",
  "huyet_mach: he_so nhân hiệu lực thú kỹ; them_muc_tieu thêm mục tiêu cùng loại (đồng đội gần chủ nhất hoặc kẻ địch thứ hai); hoi_chieu thay supportCooldownTicks khi có. Thức tỉnh khi vào đại cảnh giới bloodlineRealm; đổi tốn 1 Phá Cảnh Đơn cấp bloodlineSwapPillLevel.",
  "thien_phu: ma_vp là mã cuốn Thú Quyết; bac_1, bac_2 theo don_vi. Nhóm thu_ky chỉ tính ở thú hộ chủ; chi_so tính trên 5 thú, mỗi tên tối đa talentStatSameMax thú, trong trần powerCap; bậc 2 từ đại cảnh giới talentTier2Realm. Truyền thừa: luyện hóa một thú thì chuyển 1 thiên phú, giữ bậc, sang thú khác của chủ.",
];

const thuPhatTrien: Step = (wb, log) => {
  const dx = (v: string | number | null) => ({ v, src: "de_xuat" as const });
  const tuVi = Array.from({ length: 80 }, (_, i) => {
    const n = i + 1, r = Math.ceil(n / 20), t = n - 20 * (r - 1);
    return { n, r, cost: n === 1 ? 0 : THU_TU_VI_G[r - 1] * (1 + 0.05 * (t - 1)) };
  });
  let sum = 0;
  const sheets: [string, Record<string, unknown>[]][] = [
    ["Thú tư chất", THU_TU_CHAT.map(([sao, ten, ty_le, tu_vi, o_thien_phu]) => ({ sao, ten, ty_le, tu_vi, o_thien_phu }))],
    ["Thú tu vi", tuVi.map(({ n, r, cost }) => ({ tang: n, canh_gioi: r, tu_vi: Math.round(cost), tich_luy: (sum += Math.round(cost)), thu_kiep: [21, 41, 61].includes(n) ? "có" : "không" }))],
    ["Thú kỹ", N.ELEMENT_ORDER.map((he) => {
      const [ten, muc_tieu, hieu_ung, tac_dung, cap, don_vi, thoi_gian] = THU_KY[he];
      return { he, ten, muc_tieu, hieu_ung, tac_dung, cap_1: cap[0], cap_2: cap[1], cap_3: cap[2], cap_4: cap[3], don_vi, thoi_gian };
    })],
    ["Thú huyết mạch", THU_HUYET_MACH.map(([ma, ten, he_so, them_muc_tieu, hoi_chieu, tac_dung, hop_voi]) => ({ ma, ten, he_so, them_muc_tieu, hoi_chieu, tac_dung, hop_voi }))],
    ["Thú thiên phú", THU_THIEN_PHU.map(([ma_vp, ten, nhom, hieu_ung, tac_dung, bac_1, bac_2, don_vi, tinh_khi]) => ({
      ma_vp, ten, nhom, hieu_ung, tac_dung, bac_1, bac_2, don_vi, tinh_khi, nguon: nhom === "ngoai" ? "thu_lam" : "yeu_thu_sao_huyet, yeu_trieu",
    }))],
  ];
  let after = "Linh đơn";
  for (const [name, rows] of sheets) {
    if (wb.names().includes(name)) log.push(`${name}: sheet đã có, bỏ qua`);
    else { wb.addSheet(table(partDef(name), rows as Record<string, string | number | null>[]), after); log.push(`${name}: thêm sheet ${rows.length} dòng`); }
    after = name;
  }

  // Luật thú ở nhóm thu_cuoi của sheet Tham số, ngay sau dòng thu_cuoi cuối
  const ts = B.PARAMS.sheet, s = wb.sheet(ts), h = (s.cells[0] ?? []).map(norm);
  const gAt = h.indexOf("Nhóm"), kAt = h.indexOf("Khóa");
  const have = new Set(s.cells.map((r) => norm(r?.[kAt])));
  const add = N.PARAMS_EXTRA.filter((p) => p[0] === "thu_cuoi" && THU_PT_KEYS.includes(p[1]) && !have.has(p[1]));
  if (add.length) {
    const last = s.cells.reduce((a, r, i) => (norm(r?.[gAt]) === "thu_cuoi" ? i : a), -1);
    if (last < 0) throw new Error("Tham số: không có nhóm thu_cuoi");
    wb.insertRows(ts, last + 1, add.map((p) => paramCells(...p)));
  }
  log.push(`Tham số: chèn ${add.length} luật thú vào nhóm thu_cuoi`);

  // Tẩy Tủy Đơn ở sheet Linh đơn
  const ld = B.LINH_DON, ls = wb.sheet(ld.sheet), idAt = (ls.cells[0] ?? []).map(norm).indexOf(ld.cols.find((c) => c.key === "ma")!.header);
  if (!ls.cells.some((r) => norm(r?.[idAt]) === "tay_tuy")) {
    wb.appendRows(ld.sheet, tableRows(ld, [{
      ma: "tay_tuy", ten: dx("Tẩy Tủy Đơn"), cap: dx("5"), cong_dung: dx("Tung lại tư chất thú, chỉ nhận khi ra cao hơn; mỗi thú 1 viên mỗi ngày"),
      nguyen_lieu: dx("Đan thú phẩm Huyền trở lên, dược liệu hiếm"), cho: dx("Bán được"),
    }] as unknown as Record<string, string | number | null>[]));
    log.push("Linh đơn: thêm Tẩy Tủy Đơn");
  }

  // Ghi chú của thu_phat_trien.json và dòng giới thiệu ở sheet Ghi chú
  const gc = partDef("Ghi chú trang bị"), gs = wb.sheet(gc.sheet);
  const fAt = (gs.cells[0] ?? []).map(norm).indexOf(gc.cols.find((c) => c.key === "file")!.header);
  if (!gs.cells.some((r) => norm(r?.[fAt]) === "thu_phat_trien.json")) {
    wb.appendRows(gc.sheet, tableRows(gc, GHI_CHU_THU_PT.map((noi_dung, i) => ({ file: "thu_phat_trien.json", stt: i + 1, noi_dung }))));
    log.push(`Ghi chú trang bị: thêm ${GHI_CHU_THU_PT.length} dòng`);
  }
  const intro = "Thú tư chất … Thú thiên phú (5 sheet)";
  if (!wb.sheet(B.NOTE_SHEET).cells.some((r) => norm(r?.[0]) === intro)) {
    wb.appendRows(B.NOTE_SHEET, [[{ v: intro, bold: true }, { v: "Thú: tăng trưởng, bổ trợ, phát triển (GDD tab cùng tên): tư chất, tu vi 80 tầng, thú kỹ của thú hộ chủ theo hệ, huyết mạch ở Hóa Hình, thiên phú học từ Thú Quyết; mọi số là đề xuất. Xuất ra thu_phat_trien.json; luật ở nhóm thu_cuoi của Tham số; Tẩy Tủy Đơn ở Linh đơn" }]]);
  }
};

// ---------- set đồ 2.0 (ghi chú chung set-2.md phần 7; GDD tab Trang bị phần 14, rev 71; mọi số là đề xuất) ----------

const SET2_LO: Record<string, string> = {
  van_kiem: "ngoai_cong", loi_tri: "ngoai_cong", liep_thu: "ngoai_cong", pha_quan: "ngoai_cong", van_uyen: "noi_cong", do_kiep: "noi_cong",
  ban_thach: "thu_ngoai", ngoc_tuy: "thu_noi", chu_thien: "thu_noi", bach_thao: "hap_thu", linh_tuyen: "hap_thu", huyet_anh: "hap_thu",
  co_tong: "hap_thu", thiet_ky: "phan_chan", bang_phach: "khong_toc", hon_don: "khac_che",
  tu_bao: "kinh_te", ngu_thu: "kinh_te", dan_tien: "kinh_te", thien_cong: "kinh_te",
};
/** Mốc 2 và 4 của 16 bộ chiến đấu, số ở bậc tím: bộ, mốc, loại, mô tả, tham số, chỉ số kèm. */
const SET2_MOC: [string, number, string, string, string, string | null][] = [
  ["van_kiem", 2, "chi_so", "Công lực +2%", "atk: 20", null],
  ["van_kiem", 4, "hanh_vi", "Xuyên giáp +4%; Cận chiến đơn đánh mục tiêu dưới 30% máu +15% sát thương", "nguongMau: 300; satThuong: 150; xuyenGiap: 40", null],
  ["loi_tri", 2, "chi_so", "Chí mạng +2%", "critBonus: 20", null],
  ["loi_tri", 4, "chi_so", "Sát thương chí mạng +8%; tê liệt khi chí mạng (Lôi) +0,25 s", "critDamage: 80; teLietTicks: 5", null],
  ["liep_thu", 2, "chi_so", "Tốc đánh +3%", "attackSpeed: 30", null],
  ["liep_thu", 4, "chi_so", "Chí mạng +2%; sát thương lên dị thú và boss PvE +8%", "critBonus: 20; satThuongPvE: 80", null],
  ["pha_quan", 2, "ho_tran", "Xuyên giáp +2%; sát thương lên trận nhãn và hộ trận +5%", "satThuongHoTran: 50; xuyenGiap: 20", null],
  ["pha_quan", 4, "ho_tran", "Đòn phá trận đầu tiên mỗi trận công thành ×1,5", "heSoDonDau: 1500", null],
  ["van_uyen", 2, "chi_so", "Mana tối đa +4%", "manaMax: 40", null],
  ["van_uyen", 4, "chi_so", "Giảm mana thi triển 8%; sát thương chiêu nội +3%", "manaCostCut: 80; innerDamage: 30", null],
  ["do_kiep", 2, "chi_so", "Kháng Lôi +4%", "khangLoi: 40", null],
  ["do_kiep", 4, "hanh_vi", "Bùa chú giảm mana thi triển 15%; lần Bùa chú cuối cùng mỗi trận không tốn mana", "buaGiamMana: 150; buaCuoiMienMana: 1", null],
  ["ban_thach", 2, "chi_so", "Máu +3%", "hp: 30", null],
  ["ban_thach", 4, "chi_so", "Giảm sát thương ngoại nhận 10%; hồi 0,1% máu mỗi giây", "damageTakenCutOuter: 100; hpRegen: 1", null],
  ["ngoc_tuy", 2, "chi_so", "Thủ nội +4%", "defInner: 40", null],
  ["ngoc_tuy", 4, "chi_so", "Mana tối đa +5%; giảm mana thi triển 8%; giảm sát thương nội nhận 10%; công lực −3%", "manaMax: 50; manaCostCut: 80; damageTakenCutInner: 100; atk: -30", null],
  ["chu_thien", 2, "chi_so", "Bày trận nhanh hơn 0,5 s", "bayTranTicks: -10", null],
  ["chu_thien", 4, "hanh_vi", "Giảm sát thương nội nhận 8%; Trận pháp đặt vào chỗ đông kẻ địch nhất thay vì quanh mục tiêu đầu tiên", "chonViTri: dong_dich_nhat; damageTakenCutInner: 80", null],
  ["bach_thao", 2, "chi_so", "Hồi máu nhận +4%", "healTaken: 40", null],
  ["bach_thao", 4, "kinh_te", "Hồi 0,3% máu mỗi giây; mỏ dược trấn giữ +5%", "sanLuongMoDuoc: 50; hpRegen: 3", null],
  ["linh_tuyen", 2, "chi_so", "Hiệu quả hồi máu và khiên +4%", "healPower: 40", null],
  ["linh_tuyen", 4, "hanh_vi", "Hồi phục: hồi mana khi đang vận chỉ −10% thay −20%; thủ nội +2%", "hoiManaKhiVan: -100; defInner: 20", null],
  ["huyet_anh", 2, "chi_so", "Hút máu +1,5%", "lifesteal: 15", null],
  ["huyet_anh", 4, "hanh_vi", "Sát thương chí mạng +5%; Thân pháp chỉ lộ vị trí 2 s thay 3 s", "loViTriTicks: 40; critDamage: 50", null],
  ["co_tong", 2, "chi_so", "Hút mana: mỗi đòn rút 1% mana tối đa của mục tiêu", "manaDrain: 10", null],
  ["co_tong", 4, "hanh_vi", "Hồi chiêu pháp bảo −15%; mỗi lần pháp bảo kích hoạt hồi 5% mana", "hoiChieuPhapBao: -150; hoiManaPhapBao: 50", null],
  ["thiet_ky", 2, "chi_so", "Giảm sát thương nhận 2%", "damageTakenCut: 20", null],
  ["thiet_ky", 4, "chi_so", "Phản 12% sát thương cận chiến nhận; giảm sát thương nhận thêm 1%", "reflect: 120; damageTakenCut: 10", null],
  ["bang_phach", 2, "chi_so", "Thời gian khống chế +15%", "controlTime: 150", null],
  ["bang_phach", 4, "hanh_vi", "Khống chế liên tiếp cùng mục tiêu còn 75% thay vì 50%; khống chế mục tiêu đang vận công thêm 0,5 s; thủ nội +2%", "giamDanKhongChe: 750; khongCheDangVanCongTicks: 10; defInner: 20", null],
  ["hon_don", 2, "chi_so", "Kháng mọi hệ +2%", "khangMoiHe: 20", null],
  ["hon_don", 4, "khac_che", "Trúng đòn của hệ khắc mình thì hệ số ×1,5 giảm còn ×1,4", "heSoBiKhac: 1400", null],
];
/** Bậc ấn: mã, tên, bậc, hệ số mốc 2 và 4, tính mốc 7, ghép lên bậc trên, giao dịch, nguồn. */
const SET2_BAC: [string, string, number, number, boolean, boolean, string, string][] = [
  ["luc", "Lục", 1, 0.6, false, true, "khong_ban_lai", "Shop NPC; shop còn bán bộ trọn 7 món lục có sẵn ấn"],
  ["lam", "Lam", 2, 0.8, false, true, "ban_duoc", "Chợ người chơi; quái thường, bí cảnh"],
  ["tim", "Tím", 3, 1.0, true, false, "ban_duoc", "Boss của bí cảnh nguồn bộ đó, dị thú"],
  ["vang", "Vàng", 4, 1.1, true, false, "khoa", "Boss dị thú Linh, Huyền, Thiên; boss liên minh cuối tuần"],
  ["do", "Đỏ", 5, 1.2, true, false, "khoa", "Thần thú Tứ Tượng, boss Hỗn Độn Bí Cảnh"],
];
/** Hợp bộ: quan hệ, hệ số mốc 2, mana tối đa (null: không đổi), ghi chú. */
const SET2_HOP: [string, number, number | null, string][] = [
  ["thuan", 1.1, null, "Cùng hệ. Đặt kề trên Đạo Cơ Bàn thì thành cộng hưởng Đồng Khí ×1,25, kháng hệ đó +3%"],
  ["tuong_sinh", 1.2, null, "Trên Đạo Cơ Bàn: cộng hưởng Tương Dưỡng ×1,5"],
  ["tuong_hop", 1.2, null, "Trên Đạo Cơ Bàn: cộng hưởng Tương Dưỡng ×1,5"],
  ["doi_cuc", 1.3, -0.02, "Trên Đạo Cơ Bàn: cộng hưởng Âm Dương ×2, mana tối đa −2%"],
  ["trung_tinh", 1.0, null, "Không đổi"],
  ["tuong_khac", 0.8, null, "Bộ bị bất kỳ bộ đang kích nào khắc thì mốc 2 nhân thêm ×0,8, kể cả khi có hợp bộ hay cộng hưởng; trên bàn là mạch đứt"],
];
/** Binh bộ: mã, tên, lộ, mốc 2 (mô tả, tham số), mốc 3 (mô tả, tham số). Binh ấn NG-BA-001…006 theo cùng thứ tự. */
const SET2_BINH: [string, string, string, string, string, string, string][] = [
  ["bao_kich", "Bạo Kích", "ngoai_cong", "Chí mạng +2%", "critBonus: 20", "Sát thương chí mạng +8%", "critDamage: 80"],
  ["xuyen_pha", "Xuyên Phá", "ngoai_cong", "Xuyên giáp +3%", "xuyenGiap: 30", "Xuyên kháng +3%; xuyên giáp thêm +2%", "resistPen: 30; xuyenGiap: 20"],
  ["lien_kich", "Liên Kích", "ngoai_cong", "Tốc đánh +3%", "attackSpeed: 30", "Giảm hồi chiêu 3%", "cooldownCut: 30"],
  ["phap_nguyen", "Pháp Nguyên", "noi_cong", "Giảm mana thi triển 6%", "manaCostCut: 60", "Sát thương chiêu nội +4%", "innerDamage: 40"],
  ["hap_hon", "Hấp Hồn", "hap_thu", "Hút máu +1%", "lifesteal: 10", "Hút mana 0,5% mỗi đòn", "manaDrain: 5"],
  ["tran_thu", "Trấn Thủ", "thu_ngoai, thu_noi", "Khiên nhận +5%", "khienNhan: 50", "Thủ ngoại +3%; thủ nội +3%", "defOuter: 30; defInner: 30"],
];
/** Dòng ẩn: mã, nội dung, tham số (đơn vị code). */
const SET2_DK: [string, string, string][] = [
  ["DN-DK-001", "Đang mặc từ 4 món cùng một bộ", "cungBoToiThieu: 4"],
  ["DN-DK-002", "Hai ngọc trên món này tương sinh nhau", "haiNgocTuongSinh: true"],
  ["DN-DK-003", "Linh căn trùng hệ một ngọc trên món này", "linhCanTrungNgoc: true"],
  ["DN-DK-004", "Trận PvE (dị thú, boss)", "tran: pve"],
  ["DN-DK-005", "Trận chiến tranh địa bàn", "tran: chien_tranh"],
  ["DN-DK-006", "Máu dưới 50%", "mauDuoi: 500"],
  ["DN-DK-007", "10 giây đầu trận", "truocTicks: 200"],
  ["DN-DK-008", "Sau giây thứ 30", "sauTicks: 600"],
  ["DN-DK-009", "Đứng hàng trước", "hang: truoc"],
  ["DN-DK-010", "Đứng hàng sau", "hang: sau"],
  ["DN-DK-011", "Khí linh của món từ cấp 3", "khiLinhCapToiThieu: 3"],
  ["DN-DK-012", "Đội địch có hệ khắc linh căn mình", "dichKhacLinhCan: true"],
];
const SET2_HU: [string, string, string][] = [
  ["DN-HU-001", "Công lực +3%", "atk: 30"],
  ["DN-HU-002", "Thủ ngoại +4%", "defOuter: 40"],
  ["DN-HU-003", "Thủ nội +4%", "defInner: 40"],
  ["DN-HU-004", "Chí mạng +2%", "critBonus: 20"],
  ["DN-HU-005", "Hút máu +1%", "lifesteal: 10"],
  ["DN-HU-006", "Giảm mana thi triển 5%", "manaCostCut: 50"],
  ["DN-HU-007", "Hồi 0,2% máu mỗi giây", "hpRegen: 2"],
  ["DN-HU-008", "Phản 3% sát thương cận chiến", "reflect: 30"],
  ["DN-HU-009", "Giảm sát thương nhận 2%", "damageTakenCut: 20"],
  ["DN-HU-010", "Tốc đánh +2%", "attackSpeed: 20"],
  ["DN-HU-011", "Giảm hồi chiêu 2%", "cooldownCut: 20"],
  ["DN-HU-012", "Kháng hệ khắc mình +3%", "khangHeKhacMinh: 30"],
];
/** Điểm trang bị: khóa chỉ số, tên, điểm, mỗi (phần trăm). */
const SET2_DIEM: [string, string, number, number][] = [
  ["atk", "Công lực", 10, 0.01], ["hp", "Máu", 8, 0.01], ["defOuter", "Thủ ngoại", 5, 0.01], ["defInner", "Thủ nội", 5, 0.01],
  ["critBonus", "Chí mạng", 12, 0.01], ["critDamage", "Sát thương chí mạng", 3, 0.01], ["attackSpeed", "Tốc đánh", 10, 0.01],
  ["cooldownCut", "Giảm hồi chiêu", 12, 0.01], ["armorPen", "Xuyên giáp", 6, 0.01], ["resistPen", "Xuyên kháng", 6, 0.01],
  ["elementDamage", "Sát thương hệ (ngọc)", 4, 0.01], ["resist", "Kháng hệ (ngọc)", 3, 0.01], ["lifesteal", "Hút máu", 15, 0.01],
  ["manaDrain", "Hút mana", 8, 0.01], ["manaCostCut", "Giảm mana thi triển", 4, 0.01], ["manaMax", "Mana tối đa", 2, 0.01],
  ["hpRegen", "Hồi máu mỗi giây", 10, 0.001], ["healTaken", "Hồi máu nhận", 4, 0.01], ["healPower", "Hiệu quả hồi máu và khiên", 4, 0.01],
  ["shieldTaken", "Khiên nhận", 3, 0.01], ["damageTakenCut", "Giảm sát thương nhận", 12, 0.01],
  ["damageTakenCutOuter", "Giảm sát thương ngoại nhận", 6, 0.01], ["damageTakenCutInner", "Giảm sát thương nội nhận", 6, 0.01], ["reflect", "Phản đòn", 6, 0.01],
  ["controlTime", "Thời gian khống chế", 3, 0.01], ["innerDamage", "Sát thương chiêu nội", 8, 0.01],
];
/** Luật mới: khóa, giá trị như hiện trong Excel (theo kiểu ở TB.LUAT). */
const SET2_LUAT: [string, number][] = [
  ["set.json:luat.ghepAnSo", 3], ["set.json:luat.boThanTuBac", 3], ["set.json:luat.binhBoMoiNguoi", 1],
  ["set.json:luat.binhBoMoc[0]", 2], ["set.json:luat.binhBoMoc[1]", 3], ["set.json:luat.binhBoDongLoHeSo", 1.2],
  ["trang_bi.json:luat.dongAn.soDong.lam", 1], ["trang_bi.json:luat.dongAn.soDong.tim", 2], ["trang_bi.json:luat.dongAn.soDong.vang", 3],
  ["trang_bi.json:luat.dongAn.soDong.do", 3], ["trang_bi.json:luat.dongAn.songAnHeSo", 1.25], ["trang_bi.json:luat.dongAn.tayAnLinhVanThach", 3],
  ["trang_bi.json:luat.dongAn.tranMoiDong", 0.003], ["trang_bi.json:luat.dongAn.tranTong", 0.01], ["trang_bi.json:luat.dongAn.toiDaHieuLuc", 3],
  ["trang_bi.json:luat.giamSatThuongNhanToiDa", 0.25],
  ["trang_bi.json:luat.dongRen.heSoLoaiPhu", 0.15], ["trang_bi.json:luat.dongRen.toiDa.ha", 3], ["trang_bi.json:luat.dongRen.toiDa.trung", 3],
  ["trang_bi.json:luat.dongRen.toiDa.than", 5], ["trang_bi.json:luat.dongRen.toiDa.thanh", 5], ["trang_bi.json:luat.dongRen.doiDongKhiTinh", 2],
];
const SET2_GHI_CHU: Record<string, [string, string][]> = {
  // [đầu câu cũ cần thay (trống: thêm mới), câu mới]
  "set.json": [
    ["Hiệu ứng set không tăng theo", "Hiệu ứng set không tăng theo cường hóa, độ hiếm hay cấp đồ; ấn bộ không có cấp nhưng có bậc lục → đỏ (bac_an): mốc 2 và 4 nhân he_so theo bậc thấp nhất trong các ấn đang tính cho bộ đó; số trong moc[] là ở bậc tím (set đồ 2.0, đề xuất)."],
    ["3 bộ thần (Chu Thiên, Phá Quân, Hỗn Độn): ấn khóa", "Giao dịch theo bậc ấn (bac_an[].giao_dich): lục không bán lại trên chợ, lam và tím bán được, vàng và đỏ khóa vào nhân vật. 3 bộ thần (Chu Thiên, Phá Quân, Hỗn Độn) chỉ có ấn từ bậc luat.boThanTuBac. Món đã khảm bán kèm ấn nếu món đó và ấn đều bán được."],
    ["", "bo[].lo: lộ sức mạnh của bộ (ngoai_cong, noi_cong, thu_ngoai, thu_noi, hap_thu, phan_chan, khong_toc, kinh_te, khac_che), dùng cho binh bộ đồng lộ và bản đồ khắc lộ (GDD tab Trang bị phần 14)."],
    ["moc[].", "moc[].tham_so: mọi khóa chỉ số trong tham_so được áp như hiệu ứng chi_so, mốc loại nào cũng vậy; phần hành vi đi theo loai. Khóa chỉ số mới của set đồ 2.0: attackSpeed, lifesteal (hút máu theo sát thương), manaDrain, manaCostCut, innerDamage, defOuter, defInner, hpRegen (phần nghìn máu tối đa mỗi giây), damageTakenCut, damageTakenCutOuter, damageTakenCutInner (giảm sát thương ngoại, nội nhận; mỗi loại đòn tổng tối đa trang_bi.json luat.giamSatThuongNhanToiDa), reflect; buaGiamMana, hoiManaPhapBao, khongCheDangVanCongTicks là hành vi mới."],
    ["", "bac_an: mốc 7 chỉ mở khi cả 7 ấn có tinh_moc_7; ghép luat.ghepAnSo ấn cùng bộ cùng bậc thành 1 ấn bậc trên, chỉ ở bậc có ghep_len (lục lên lam, lam lên tím); vàng, đỏ chỉ rơi. Bậc là thuộc tính từng viên, mã giữ NG-AN-001…020."],
    ["", "hop_bo: mặc cùng lúc từ 2 bộ đang kích (đủ mốc 2), mỗi cặp xét quan hệ hệ ấn (quan_he_to_hop.json). Mỗi bộ lấy he_so tốt nhất của nó (cộng hưởng Đạo Cơ Bàn thay nếu cao hơn), rồi nhân he_so của tuong_khac nếu có bất kỳ bộ đang kích nào khắc nó. Chỉ nhân mốc 2; mana_max cộng một lần cho mỗi cặp đối cực."],
    ["", "binh_bo: binh ấn (ngoc.json binh_an) khảm vào vũ khí, bao tay, ngọc bội và chiếm dòng khảm. Mốc luat.binhBoMoc (2 và 3 món), mỗi người luat.binhBoMoiNguoi binh bộ; cùng lộ với một ấn bộ đang kích thì mốc 3 nhân luat.binhBoDongLoHeSo. Bậc binh ấn như ấn bộ (bac_an); số ở bậc tím."],
    ["", "bo_tron: bộ 7 món lục bán ở shop NPC, mỗi món khảm sẵn ấn bậc lục của bộ đó; 17 bộ, không có 3 bộ thần."],
  ],
  "trang_bi.json": [
    ["", "Áo, giày (set đồ 2.0): tách phòng thủ thành thủ ngoại, thủ nội đã chốt 2026-11-05 (GDD mục 8), số vẫn là đề xuất. Chỉ số chính áo là thủ ngoại +3%, giày là thủ nội +3%; tẩy luyện loại 4 của giày thành thủ ngoại, của áo thành thủ nội. Loại sát thương của từng loại chiêu ở loai_chieu.json loai_sat_thuong."],
    ["", "dong_ren: cường hóa lên nac mở 1 dòng rèn ở vi_dien; chọn 1 trong 4 loại phụ của ô (luyen_khi.json tay_luyen), giá trị luat.dongRen.heSoLoaiPhu của loại đó. Tối đa luat.dongRen.toiDa theo vị diện; đổi dòng tốn luat.dongRen.doiDongKhiTinh Khí Tinh; tụt nấc dưới mốc thì dòng tạm tắt."],
    ["", "dong_an: chỉ trên ô có co_dong_an (ngọc bội, đai). Mỗi dòng là 1 điều kiện (loai dieu_kien) + 1 hiệu ứng (hieu_ung), quay khi món rơi hoặc rèn ra; số dòng luat.dongAn.soDong theo độ hiếm. Hiện ??? tới lần đầu kích phát; Giám Định Phù (PH-CH-011) lộ trước điều kiện 1 dòng; tẩy ẩn quay lại hiệu ứng, giữ điều kiện. Song ẩn: ngọc bội và đai cùng điều kiện thì cả hai hiệu ứng ×luat.dongAn.songAnHeSo. Nhóm của điều kiện (nhom) nhân hiệu ứng theo he_so: tinh ×0,2, loai_tran ×0,5, trong_tran ×1,0; cùng lúc tối đa luat.dongAn.toiDaHieuLuc dòng có hiệu lực, chọn theo điểm trang bị sau hệ số."],
    ["", "diem: điểm trang bị cho mỗi `moi` (1% hoặc 0,1%) của chỉ số; điểm món là tổng các lớp, điểm nhân vật là 7 món cộng set. Chỉ để so sánh, gợi ý và lọc chợ, không dùng trong trận; phiên Sprint chỉnh bằng đo."],
  ],
  "ngoc.json": [
    ["", "binh_an (set đồ 2.0, đề xuất): 6 binh ấn của binh bộ (set.json binh_bo), chỉ khảm vào chi_kham_vao, chiếm dòng khảm như ngọc, Ý châu, ấn bộ; bậc như ấn bộ (set.json bac_an)."],
  ],
};

const set2: Step = (wb, log) => {
  const text = (v: string | number): Cell => ({ v, fill: "de_xuat" });
  const hdr = (v: string): Cell => ({ v, fill: "tieu_de", bold: true, wrap: true });
  const head = (def: B.TableDef, key: string) => def.cols.find((c) => c.key === key)!.header;
  const at = (sheet: string, header: string) => (wb.sheet(sheet).cells[0] ?? []).map(norm).indexOf(header);
  const same = (a: Value | undefined, b: string | number, kv = false) =>
    kv ? JSON.stringify(B.parseKv(norm(a))) === JSON.stringify(B.parseKv(String(b))) : norm(a) === norm(b as Value);

  // 1. Sheet mới
  const add = (name: string, after: string, rows: Record<string, string | number | null>[]) => {
    if (wb.names().includes(name)) log.push(`${name}: sheet đã có, bỏ qua`);
    else { wb.addSheet(table(partDef(name), rows), after); log.push(`${name}: thêm sheet ${rows.length} dòng`); }
  };
  add("Dòng rèn", "Ô trang bị", [10, 20, 30, 40, 50].map((nac, i) => ({ so: i + 1, nac, vi_dien: nac <= 30 ? "ha, trung, than, thanh" : "than, thanh" })));
  add("Dòng ẩn", "Dòng rèn", [...SET2_DK.map((r) => ["dieu_kien", ...r]), ...SET2_HU.map((r) => ["hieu_ung", ...r])]
    .map(([loai, ma, noi_dung, tham_so]) => ({ ma, loai, noi_dung, tham_so })));
  add("Điểm trang bị", "Dòng ẩn", SET2_DIEM.map(([stat, ten, diem, moi]) => ({ stat, ten, diem, moi })));
  add("Binh ấn", "Ấn bộ", SET2_BINH.map(([id, ten], i) => ({
    ma_vp: `NG-BA-${String(i + 1).padStart(3, "0")}`, ten: `Binh Ấn ${ten}`, binh_bo: id, chi_kham_vao: "vu_khi, bao_tay, ngoc_boi", nguon: "theo_bac_an",
  })));
  const relName: Record<string, string> = Object.fromEntries(N.RELATIONS.map((r) => [r.id, r.name]));
  add("Bậc ấn", "Set mốc", SET2_BAC.map(([ma, ten, bac, he_so, m7, ghep, giao_dich, nguon]) => ({
    ma, ten, bac, he_so, tinh_moc_7: m7 ? "có" : "không", ghep_len: ghep ? "có" : "không", giao_dich, nguon,
  })));
  add("Hợp bộ", "Bậc ấn", SET2_HOP.map(([quan_he, he_so, mana_max, mo_ta]) => ({ quan_he, ten: relName[quan_he] ?? quan_he, he_so, mana_max, mo_ta })));
  add("Binh bộ", "Hợp bộ", SET2_BINH.map(([id, ten, lo, m2, p2, m3, p3], i) => ({
    id, ten, lo, an: `NG-BA-${String(i + 1).padStart(3, "0")}`, moc_2_mo_ta: m2, moc_2_tham_so: p2, moc_3_mo_ta: m3, moc_3_tham_so: p3,
  })));
  const setDef = partDef("Set"), ss = wb.sheet(setDef.sheet);
  const setIdAt = at(setDef.sheet, head(setDef, "id")), setTenAt = at(setDef.sheet, head(setDef, "ten")), thanAt = at(setDef.sheet, head(setDef, "than"));
  const sets = ss.cells.slice(1).filter((r) => norm(r?.[setIdAt])).map((r) => ({ id: norm(r[setIdAt]), ten: norm(r[setTenAt]), than: norm(r[thanAt]) === "có" }));
  add("Bộ trọn", "Binh bộ", sets.filter((b) => !b.than).map((b, i) => ({
    ma_vp: `TB-BO-${String(i + 1).padStart(3, "0")}`, bo: b.id, ten: `Bộ trọn ${b.ten}`, bac: "luc", so_mon: 7,
    mo_ta: `7 món lục, mỗi món khảm sẵn ấn ${b.ten} bậc lục; không bán lại trên chợ`, nguon: "shop_npc",
  })));

  // 2. Cột mới ở sheet có sẵn: Lộ (Set), Chỉ số kèm (Set mốc), Có dòng ẩn (Ô trang bị)
  if (at(setDef.sheet, head(setDef, "lo")) < 0) {
    wb.addColumn(setDef.sheet, hdr(head(setDef, "lo")), (r, row) => (r > 0 && SET2_LO[norm(row[setIdAt])] ? text(SET2_LO[norm(row[setIdAt])]) : null), 12);
    log.push("Set: thêm cột Lộ sức mạnh");
  }
  const mocDef = partDef("Set mốc");
  const mBo = at(mocDef.sheet, head(mocDef, "bo")), mSo = at(mocDef.sheet, head(mocDef, "so"));
  const mocRow = (bo: string, so: number) => {
    const i = wb.sheet(mocDef.sheet).cells.findIndex((r, k) => k > 0 && norm(r?.[mBo]) === bo && Number(r?.[mSo]) === so);
    if (i < 0) throw new Error(`Set mốc: không có dòng ${bo} mốc ${so}`);
    return i;
  };
  // Chỉ số kèm nằm luôn trong tham_so (set_2c gộp và xóa cột Chỉ số kèm; rules áp mọi khóa chỉ số trong tham_so)
  const oDef = partDef("Ô trang bị"), oId = at(oDef.sheet, head(oDef, "id"));
  if (at(oDef.sheet, head(oDef, "co_dong_an")) < 0) {
    wb.addColumn(oDef.sheet, hdr(head(oDef, "co_dong_an")), (r, row) => (r > 0 && norm(row[oId]) ? text(["ngoc_boi", "dai"].includes(norm(row[oId])) ? "có" : "không") : null), 9);
    log.push("Ô trang bị: thêm cột Có dòng ẩn");
  }

  // 3. Viết lại mốc 2 và 4 của 16 bộ chiến đấu (chỉ ghi ô khác)
  let changed = 0;
  const put = (sheet: string, r: number, header: string, v: string | number, kv = false, c?: Cell) => {
    const col = at(sheet, header);
    if (col < 0) throw new Error(`${sheet}: không có cột ${header}`);
    if (same(wb.sheet(sheet).cells[r]?.[col], v, kv)) return;
    wb.setCell(sheet, r, col, c ?? text(v));
    changed++;
  };
  for (const [bo, so, loai, mo_ta, tham_so] of SET2_MOC) {
    const r = mocRow(bo, so);
    put(mocDef.sheet, r, head(mocDef, "loai"), loai);
    put(mocDef.sheet, r, head(mocDef, "mo_ta"), mo_ta);
    put(mocDef.sheet, r, head(mocDef, "tham_so"), tham_so, true);
  }
  log.push(`Set mốc: viết lại mốc 2, 4 của 16 bộ (${changed} ô đổi)`);

  // 4. Áo, giày: chỉ số chính; tẩy luyện loại 4
  const oRow = (id: string) => wb.sheet(oDef.sheet).cells.findIndex((r, k) => k > 0 && norm(r?.[oId]) === id);
  for (const [id, stat, ten] of [["ao", "defOuter", "Thủ ngoại"], ["giay", "defInner", "Thủ nội"]]) {
    const r = oRow(id);
    put(oDef.sheet, r, head(oDef, "chinh_stat"), stat);
    put(oDef.sheet, r, head(oDef, "chinh_ten"), ten);
    put(oDef.sheet, r, head(oDef, "chinh_gia_tri"), goc(30) / 1000, false, pctCell(goc(30) / 1000));
  }
  const tl = partDef("Tẩy luyện"), tlO = at(tl.sheet, head(tl, "o")), tlL = at(tl.sheet, head(tl, "loai"));
  for (const [o, stat, ten] of [["giay", "defOuter", "Thủ ngoại"], ["ao", "defInner", "Thủ nội"]]) {
    const r = wb.sheet(tl.sheet).cells.findIndex((row, k) => k > 0 && norm(row?.[tlO]) === o && Number(row?.[tlL]) === 4);
    if (r < 0) throw new Error(`Tẩy luyện: không có ${o} loại 4`);
    put(tl.sheet, r, head(tl, "stat"), stat);
    put(tl.sheet, r, head(tl, "ten"), ten);
  }
  log.push("Ô trang bị, Tẩy luyện: áo thủ ngoại +3%, giày thủ nội +3%; loại 4 giày thủ ngoại, áo thủ nội");

  // 5. Ấn bộ thần: bán theo bậc (cột Bán ở chợ thành có cho cả 20)
  const an = partDef("Ấn bộ"), anId = at(an.sheet, head(an, "ma_vp"));
  for (const ma of ["NG-AN-018", "NG-AN-019", "NG-AN-020"]) {
    const r = wb.sheet(an.sheet).cells.findIndex((row, k) => k > 0 && norm(row?.[anId]) === ma);
    put(an.sheet, r, head(an, "ban_cho"), "có");
  }

  // 6. Giám Định Phù
  const ph = partDef("Phù"), phId = at(ph.sheet, head(ph, "ma_vp"));
  if (!wb.sheet(ph.sheet).cells.some((r) => norm(r?.[phId]) === "PH-CH-011")) {
    wb.appendRows(ph.sheet, tableRows(ph, [{ ma_vp: "PH-CH-011", ten: "Giám Định Phù", ten_icon: null, mo_ta: "Lộ trước điều kiện kích phát của 1 dòng ẩn trên ngọc bội hoặc đai", nguon: "cho", moi: "có" }]));
    log.push("Phù: thêm PH-CH-011 Giám Định Phù");
  }

  // 7. Luật
  const luatDef = partDef("Luật trang bị");
  const haveLuat = new Set(wb.sheet(luatDef.sheet).cells.map((r) => norm(r?.[0])));
  const luat = SET2_LUAT.filter(([k]) => !haveLuat.has(k)).map(([khoa, gia_tri]) => {
    const [, ten, kieu] = TB.LUAT.find((l) => l[0] === khoa)!;
    return { khoa, ten, gia_tri, kieu };
  });
  if (luat.length) wb.appendRows(luatDef.sheet, tableRows(luatDef, luat));
  log.push(`Luật trang bị: thêm ${luat.length} dòng`);

  // 8. Ghi chú
  const gc = partDef("Ghi chú trang bị"), gFile = at(gc.sheet, head(gc, "file")), gStt = at(gc.sheet, head(gc, "stt")), gNd = at(gc.sheet, head(gc, "noi_dung"));
  const newNotes: Record<string, string | number>[] = [];
  for (const [file, notes] of Object.entries(SET2_GHI_CHU)) {
    const rows = () => wb.sheet(gc.sheet).cells.map((r, i) => ({ r, i })).filter(({ r, i }) => i > 0 && norm(r?.[gFile]) === file);
    let stt = Math.max(0, ...rows().map(({ r }) => Number(r[gStt])));
    for (const [start, v] of notes) {
      if (rows().some(({ r }) => norm(r[gNd]) === v)) continue;
      if (start) {
        const hit = rows().find(({ r }) => norm(r[gNd]).startsWith(start));
        if (!hit) throw new Error(`Ghi chú trang bị: không có dòng ${file} "${start}…"`);
        wb.setCell(gc.sheet, hit.i, gNd, text(v));
      } else newNotes.push({ file, stt: ++stt, noi_dung: v });
    }
  }
  if (newNotes.length) wb.appendRows(gc.sheet, tableRows(gc, newNotes));
  log.push(`Ghi chú trang bị: thêm ${newNotes.length} dòng, sửa 2 dòng của set.json`);
  const intro = "Set đồ 2.0 (8 sheet và cột mới)";
  if (!wb.sheet(B.NOTE_SHEET).cells.some((r) => norm(r?.[0]) === intro)) {
    wb.appendRows(B.NOTE_SHEET, [[{ v: intro, bold: true }, { v: "GDD tab Trang bị phần 14 (ghi chú chung set-2.md): Dòng rèn, Dòng ẩn, Điểm trang bị → trang_bi.json; Binh ấn → ngoc.json; Bậc ấn, Hợp bộ, Binh bộ, Bộ trọn → set.json; cột Lộ ở Set, Chỉ số kèm ở Set mốc, Có dòng ẩn ở Ô trang bị; mốc 2, 4 của 16 bộ viết lại; mọi số là đề xuất" }]]);
  }
};

/** Set đồ 2.0 lần 2: loại sát thương theo loại chiêu (như sim DAMAGE_KIND); ghi chú áo, giày theo chốt tách thủ ngoại, thủ nội. */
const SET2_LOAI_ST: Record<string, "ngoai" | "noi" | null> = {
  can_don: "ngoai", can_quet: "ngoai", than_phap: "ngoai", tam_xa: "ngoai", ho_the: "ngoai",
  dien_rong: "noi", bua_chu: "noi", tran_phap: "noi", khong_che: "noi", hoi_phuc: null,
};
const set2b: Step = (wb, log) => {
  const lc = B.LOAI_CHIEU, col = lc.cols.find((c) => c.key === "loai_sat_thuong")!, h = (wb.sheet(lc.sheet).cells[0] ?? []).map(norm);
  const idAt = h.indexOf(lc.cols.find((c) => c.key === "ma")!.header);
  if (h.indexOf(col.header) < 0) {
    wb.addColumn(lc.sheet, { v: col.header, fill: "tieu_de", bold: true, wrap: true }, (r, row) => {
      const v = r > 0 ? SET2_LOAI_ST[norm(row[idAt])] : undefined;
      return v ? { v, fill: "gdd" } : null;
    }, col.width);
    log.push("Loại chiêu: thêm cột Loại sát thương");
  }
  const gc = partDef("Ghi chú trang bị"), gs = wb.sheet(gc.sheet), gh = (gs.cells[0] ?? []).map(norm);
  const nAt = gh.indexOf(gc.cols.find((c) => c.key === "noi_dung")!.header);
  const i = gs.cells.findIndex((r) => norm(r?.[nAt]) === "Áo, giày (set đồ 2.0, đề xuất, chờ duyệt ở mục 20 vì đổi công thức trận mục 8): chỉ số chính áo là thủ ngoại +3%, giày là thủ nội +3%; tẩy luyện loại 4 của giày thành thủ ngoại, của áo thành thủ nội.");
  if (i > 0) { wb.setCell(gc.sheet, i, nAt, { v: "Áo, giày (set đồ 2.0): tách phòng thủ thành thủ ngoại, thủ nội đã chốt 2026-11-05 (GDD mục 8), số vẫn là đề xuất. Chỉ số chính áo là thủ ngoại +3%, giày là thủ nội +3%; tẩy luyện loại 4 của giày thành thủ ngoại, của áo thành thủ nội. Loại sát thương của từng loại chiêu ở loai_chieu.json loai_sat_thuong.", fill: "de_xuat" }); log.push("Ghi chú trang bị: áo, giày theo chốt tách thủ ngoại, thủ nội"); }
};

// ---------- set đồ 2.0 lần 3: trang Ẩn văn ở Bảo Giám (GDD tab Trang bị rev 73, phần 14.5); chỉ số kèm gộp vào tham_so ----------

/** Ghi chú bao_giam của luyen_khi.json (luyen_khi_2 viết, set_2c thêm câu Ẩn văn). */
const GHI_CHU_BAO_GIAM = "bao_giam: ghi mọi kiểu đã từng sở hữu, cả khi đã phân giải; mỗi trang cho thưởng không cộng chỉ số chiến đấu, loại thưởng theo thứ được đếm (vũ khí, danh khí: ánh sáng vũ khí; ô khác: khung ô; pháp bảo, Phách: danh hiệu; pháp khí: ô kho; ấn bộ: ô túi; Ý châu: Khí Tinh). Trang, số lượng và thưởng là đề xuất. Mỗi tuần một trang tuần ngẫu nhiên cho luat.baoGiamTuanLinhVanThach Linh Văn Thạch. Trang Ẩn văn (dem loai an_van): một cặp điều kiện và hiệu ứng dòng ẩn (trang_bi.json dong_an) tính khi cả cặp đã lộ, tức sau lần kích phát đầu; Giám Định Phù chỉ lộ điều kiện nên chưa tính. dieu_kien là đủ các cặp của điều kiện đó; bat_ky là đủ so_luong cặp bất kỳ.";
const GHI_CHU_THAM_SO_SET = "moc[].tham_so: mọi khóa chỉ số trong tham_so được áp như hiệu ứng chi_so, mốc loại nào cũng vậy; phần hành vi đi theo loai. Khóa chỉ số mới của set đồ 2.0: attackSpeed, lifesteal (hút máu theo sát thương), manaDrain, manaCostCut, innerDamage, defOuter, defInner, hpRegen (phần nghìn máu tối đa mỗi giây), damageTakenCut, damageTakenCutOuter, damageTakenCutInner (giảm sát thương ngoại, nội nhận; mỗi loại đòn tổng tối đa trang_bi.json luat.giamSatThuongNhanToiDa), reflect; buaGiamMana, hoiManaPhapBao, khongCheDangVanCongTicks là hành vi mới.";

const set2c: Step = (wb, log) => {
  const text = (v: string | number): Cell => ({ v, fill: "de_xuat" });
  const head = (def: B.TableDef, key: string) => def.cols.find((c) => c.key === key)!.header;
  const at = (sheet: string, header: string) => (wb.sheet(sheet).cells[0] ?? []).map(norm).indexOf(header);

  // 1. Chỉ số kèm vào tham_so (rules áp mọi khóa chỉ số trong tham_so), rồi xóa cột Chỉ số kèm
  const mocDef = partDef("Set mốc");
  const mBo = at(mocDef.sheet, head(mocDef, "bo")), mSo = at(mocDef.sheet, head(mocDef, "so")), mTs = at(mocDef.sheet, head(mocDef, "tham_so"));
  let n = 0;
  for (const [bo, so, , , tham_so] of SET2_MOC) {
    const r = wb.sheet(mocDef.sheet).cells.findIndex((row, k) => k > 0 && norm(row?.[mBo]) === bo && Number(row?.[mSo]) === so);
    if (r < 0) throw new Error(`Set mốc: không có dòng ${bo} mốc ${so}`);
    const cur = wb.sheet(mocDef.sheet).cells[r]?.[mTs];
    if (JSON.stringify(B.parseKv(norm(cur))) !== JSON.stringify(B.parseKv(tham_so))) { wb.setCell(mocDef.sheet, r, mTs, text(tham_so)); n++; }
  }
  const kemAt = at(mocDef.sheet, "Chỉ số kèm hiệu ứng (đơn vị code)");
  if (kemAt >= 0) { wb.deleteColumn(mocDef.sheet, kemAt); log.push("Set mốc: xóa cột Chỉ số kèm"); }
  log.push(`Set mốc: gộp chỉ số kèm vào tham_so (${n} ô đổi)`);

  // 2. 14 trang Ẩn văn
  const bg = partDef("Bảo Giám"), maAt = at(bg.sheet, head(bg, "ma"));
  const have = new Set(wb.sheet(bg.sheet).cells.map((r) => norm(r?.[maAt])));
  const rows = [
    { ma: "BG-AV-NHAPMON", ten: "Ẩn văn nhập môn", dem: "loai: an_van; bat_ky: true", so_luong: 24, thuong: "2 Giám Định Phù", loai_thuong: "giam_dinh_phu", so_thuong: 2 },
    ...SET2_DK.map(([ma, noi_dung], k) => ({
      ma: `BG-AV-DK-${String(k + 1).padStart(3, "0")}`, ten: `Ẩn văn: ${noi_dung}`, dem: `loai: an_van; dieu_kien: ${ma}`, so_luong: SET2_HU.length,
      thuong: "3 Linh Văn Thạch", loai_thuong: "linh_van_thach", so_thuong: 3,
    })),
    { ma: "BG-AV-TOAN", ten: "Ẩn văn toàn thư", dem: "loai: an_van", so_luong: SET2_DK.length * SET2_HU.length, thuong: "Danh hiệu Ẩn Văn Thông Giám; khung ô ngọc bội, đai kiểu ẩn văn", loai_thuong: "danh_hieu", so_thuong: null },
  ].filter((r) => !have.has(r.ma));
  if (rows.length) wb.appendRows(bg.sheet, tableRows(bg, rows));
  log.push(`Bảo Giám: thêm ${rows.length} trang Ẩn văn`);

  // 3. Ghi chú
  const gc = partDef("Ghi chú trang bị"), gs = wb.sheet(gc.sheet);
  const fAt = at(gc.sheet, head(gc, "file")), nAt = at(gc.sheet, head(gc, "noi_dung"));
  const fix = (file: string, startsWith: string, v: string) => {
    const k = gs.cells.findIndex((r) => norm(r?.[fAt]) === file && norm(r?.[nAt]).startsWith(startsWith));
    if (k < 0) throw new Error(`Ghi chú trang bị: không có dòng ${file} "${startsWith}…"`);
    if (norm(gs.cells[k][nAt]) !== v) { wb.setCell(gc.sheet, k, nAt, text(v)); log.push(`Ghi chú trang bị: sửa dòng ${file} "${startsWith}"`); }
  };
  fix("luyen_khi.json", "bao_giam:", GHI_CHU_BAO_GIAM);
  fix("set.json", "moc[].", GHI_CHU_THAM_SO_SET);
};

// ---------- chỉ số gốc 7 ô ×0,85 (phiên Sprint đo, theo trần 35% chia lại của set đồ 2.0; đề xuất) ----------

const goc085: Step = (wb, log) => {
  const o = partDef("Ô trang bị"), oh = (k: string) => o.cols.find((c) => c.key === k)!.header;
  const at = (sheet: string, header: string) => (wb.sheet(sheet).cells[0] ?? []).map(norm).indexOf(header);
  let n = 0;
  const put = (sheet: string, r: number, col: number, v: number) => {
    const cur = Number(wb.sheet(sheet).cells[r]?.[col]);
    if (Math.round(cur * 1000) === v) return;
    wb.setCell(sheet, r, col, pctCell(v / 1000));
    n++;
  };
  const oId = at(o.sheet, oh("id")), oChinh = at(o.sheet, oh("chinh_gia_tri")), oPhu = at(o.sheet, oh("phu_gia_tri"));
  for (const [id, [chinh, phu]] of Object.entries(TRAN_O)) {
    const r = wb.sheet(o.sheet).cells.findIndex((row, k) => k > 0 && norm(row?.[oId]) === id);
    if (r < 0) throw new Error(`Ô trang bị: không có ô ${id}`);
    put(o.sheet, r, oChinh, goc(chinh));
    put(o.sheet, r, oPhu, goc(phu));
  }
  const tl = partDef("Tẩy luyện"), th = (k: string) => tl.cols.find((c) => c.key === k)!.header;
  const tO = at(tl.sheet, th("o")), tL = at(tl.sheet, th("loai")), tV = at(tl.sheet, th("gia_tri"));
  for (const [ten, list] of Object.entries(TAY_LUYEN)) list.forEach(([, v], i) => {
    const r = wb.sheet(tl.sheet).cells.findIndex((row, k) => k > 0 && norm(row?.[tO]) === ten && Number(row?.[tL]) === i + 1);
    if (r < 0) throw new Error(`Tẩy luyện: không có ${ten} loại ${i + 1}`);
    put(tl.sheet, r, tV, goc(v));
  });
  log.push(`Ô trang bị, Tẩy luyện: chỉ số gốc ×${GOC_HE_SO} (${n} ô đổi)`);
  // Ghi chú trang_bi.json: nói rõ số đã hạ
  const gc = partDef("Ghi chú trang bị"), gs = wb.sheet(gc.sheet), gh = (k: string) => at(gc.sheet, gc.cols.find((c) => c.key === k)!.header);
  const note = "Chỉ số chính, phụ của 7 ô và 4 loại tẩy luyện (luyen_khi.json tay_luyen) đã hạ ×0,85 theo trần 35% chia lại của set đồ 2.0 (phiên Sprint đo 2026-11-05), làm tròn về số nguyên gần nhất, 0,5 làm tròn lên; dòng rèn lấy theo bảng tẩy luyện này.";
  if (!gs.cells.some((r) => norm(r?.[gh("noi_dung")]) === note)) {
    const stt = Math.max(0, ...gs.cells.filter((r) => norm(r?.[gh("file")]) === "trang_bi.json").map((r) => Number(r[gh("stt")])));
    wb.appendRows(gc.sheet, tableRows(gc, [{ file: "trang_bi.json", stt: stt + 1, noi_dung: note }]));
    log.push("Ghi chú trang bị: thêm câu chỉ số gốc ×0,85");
  }
};

// ---------- set đồ 2.0 lần 4: sửa số sau lần đo 1 của phiên Sprint (GDD tab Trang bị rev 74; đề xuất) ----------

/** Nhóm điều kiện dòng ẩn và hệ số hiệu ứng (phần nghìn). */
const DONG_AN_NHOM: Record<string, [string, number]> = {
  "DN-DK-001": ["tinh", 200], "DN-DK-002": ["tinh", 200], "DN-DK-003": ["tinh", 200], "DN-DK-009": ["tinh", 200],
  "DN-DK-010": ["tinh", 200], "DN-DK-011": ["tinh", 200], "DN-DK-004": ["loai_tran", 500], "DN-DK-005": ["loai_tran", 500],
  "DN-DK-012": ["loai_tran", 500], "DN-DK-006": ["trong_tran", 1000], "DN-DK-007": ["trong_tran", 1000], "DN-DK-008": ["trong_tran", 1000],
};

const set2d: Step = (wb, log) => {
  const text = (v: string | number): Cell => ({ v, fill: "de_xuat" });
  const hdr = (v: string): Cell => ({ v, fill: "tieu_de", bold: true, wrap: true });
  const head = (def: B.TableDef, key: string) => def.cols.find((c) => c.key === key)!.header;
  const at = (sheet: string, header: string) => (wb.sheet(sheet).cells[0] ?? []).map(norm).indexOf(header);
  let n = 0;

  // 1. Set mốc theo SET2_MOC (chỉ ghi ô khác)
  const mocDef = partDef("Set mốc");
  const mBo = at(mocDef.sheet, head(mocDef, "bo")), mSo = at(mocDef.sheet, head(mocDef, "so"));
  const cols = { loai: at(mocDef.sheet, head(mocDef, "loai")), mo_ta: at(mocDef.sheet, head(mocDef, "mo_ta")), tham_so: at(mocDef.sheet, head(mocDef, "tham_so")) };
  for (const [bo, so, loai, mo_ta, tham_so] of SET2_MOC) {
    const r = wb.sheet(mocDef.sheet).cells.findIndex((row, k) => k > 0 && norm(row?.[mBo]) === bo && Number(row?.[mSo]) === so);
    if (r < 0) throw new Error(`Set mốc: không có dòng ${bo} mốc ${so}`);
    const row = wb.sheet(mocDef.sheet).cells[r];
    if (norm(row[cols.loai]) !== loai) { wb.setCell(mocDef.sheet, r, cols.loai, text(loai)); n++; }
    if (norm(row[cols.mo_ta]) !== mo_ta) { wb.setCell(mocDef.sheet, r, cols.mo_ta, text(mo_ta)); n++; }
    if (JSON.stringify(B.parseKv(norm(row[cols.tham_so]))) !== JSON.stringify(B.parseKv(tham_so))) { wb.setCell(mocDef.sheet, r, cols.tham_so, text(tham_so)); n++; }
  }
  log.push(`Set mốc: sửa theo lần đo 1 (${n} ô đổi)`);

  // 2. Dòng ẩn: cột Nhóm và Hệ số cho 12 điều kiện
  const da = partDef("Dòng ẩn"), daMa = at(da.sheet, head(da, "ma"));
  for (const [key, pick] of [["nhom", (v: [string, number]) => text(v[0])], ["he_so", (v: [string, number]) => text(v[1] / 1000)]] as const) {
    const h = head(da, key), col = at(da.sheet, h);
    const cellFor = (row: Value[]) => { const v = DONG_AN_NHOM[norm(row[daMa])]; return v ? pick(v) : null; };
    if (col < 0) { wb.addColumn(da.sheet, hdr(h), (r, row) => (r > 0 ? cellFor(row) : null), key === "nhom" ? 11 : 9); log.push(`Dòng ẩn: thêm cột ${h}`); }
    else wb.sheet(da.sheet).cells.forEach((row, r) => {
      const c = r > 0 ? cellFor(row) : null;
      if (c && norm(row[col]) !== norm(c.v as Value)) wb.setCell(da.sheet, r, col, c);
    });
  }

  // 3. Điểm trang bị: 2 chỉ số mới
  const dm = partDef("Điểm trang bị"), dmStat = at(dm.sheet, head(dm, "stat"));
  const haveDiem = new Set(wb.sheet(dm.sheet).cells.map((r) => norm(r?.[dmStat])));
  const addDiem = SET2_DIEM.filter(([stat]) => !haveDiem.has(stat)).map(([stat, ten, diem, moi]) => ({ stat, ten, diem, moi }));
  if (addDiem.length) wb.appendRows(dm.sheet, tableRows(dm, addDiem));
  log.push(`Điểm trang bị: thêm ${addDiem.length} dòng`);

  // 4. Luật: sửa giá trị có sẵn, thêm khóa mới
  const luatDef = partDef("Luật trang bị"), ls = wb.sheet(luatDef.sheet), lv = at(luatDef.sheet, head(luatDef, "gia_tri"));
  const keys = ls.cells.map((r) => norm(r?.[0]));
  const addLuat: Record<string, string | number>[] = [];
  for (const [khoa, gia_tri] of SET2_LUAT) {
    const [, ten, kieu] = TB.LUAT.find((l) => l[0] === khoa)!;
    const r = keys.indexOf(khoa);
    if (r < 0) { addLuat.push({ khoa, ten, gia_tri, kieu }); continue; }
    if (Math.abs(Number(ls.cells[r][lv]) - gia_tri) > 1e-9) { wb.setCell(luatDef.sheet, r, lv, kieu === "%" ? pctCell(gia_tri) : text(gia_tri)); log.push(`Luật trang bị: ${khoa} = ${gia_tri}`); }
  }
  if (addLuat.length) wb.appendRows(luatDef.sheet, tableRows(luatDef, addLuat));
  log.push(`Luật trang bị: thêm ${addLuat.length} dòng`);

  // 5. Ghi chú theo SET2_GHI_CHU và GHI_CHU_THAM_SO_SET
  const gc = partDef("Ghi chú trang bị"), gs = wb.sheet(gc.sheet);
  const fAt = at(gc.sheet, head(gc, "file")), nAt = at(gc.sheet, head(gc, "noi_dung"));
  const fix = (file: string, startsWith: string, v: string) => {
    const k = gs.cells.findIndex((r) => norm(r?.[fAt]) === file && norm(r?.[nAt]).startsWith(startsWith));
    if (k < 0) throw new Error(`Ghi chú trang bị: không có dòng ${file} "${startsWith}…"`);
    if (norm(gs.cells[k][nAt]) !== v) { wb.setCell(gc.sheet, k, nAt, text(v)); log.push(`Ghi chú trang bị: sửa dòng ${file} "${startsWith}"`); }
  };
  fix("trang_bi.json", "dong_an:", SET2_GHI_CHU["trang_bi.json"].find(([, v]) => v.startsWith("dong_an:"))![1]);
  fix("set.json", "moc[].", GHI_CHU_THAM_SO_SET);
};

export const STEPS: Record<string, Step> = {
  artifact_rules: artifactRules, dao_co_ban: daoCoBan, dao_co_ban_mo: daoCoBanMo, tran_lan_2: tranLan2, hop_tran: hopTran,
  luyen_khi: luyenKhi, hop_tran_2: hopTran2, luyen_khi_2: luyenKhi2, luyen_khi_3: luyenKhi3, luyen_khi_4: luyenKhi4, luyen_khi_5: luyenKhi5, luyen_khi_6: luyenKhi6, luyen_khi_7: luyenKhi7,
  thu_phat_trien: thuPhatTrien, set_2: set2, set_2b: set2b, set_2c: set2c, goc_085: goc085, set_2d: set2d,
};

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
  log.push(`Tính lại ${wb.recalculated} ô công thức`);
  for (const l of log) console.log(`  ${l}`);
  console.log("Xuất lại JSON:");
  execFileSync(process.execPath, [...process.execArgv, fileURLToPath(new URL("xuat.ts", import.meta.url))], { stdio: "inherit" });
}

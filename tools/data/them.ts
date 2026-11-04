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
  dot: "Sát thương theo thời gian",
};
/** 4 loại chỉ số phụ mỗi ô, giá trị phần nghìn ở lục +0; loại 1 là chỉ số phụ mặc định. */
const TAY_LUYEN: Record<string, [string, number][]> = {
  vu_khi: [["critDamage", 20], ["armorPen", 10], ["attackSpeed", 10], ["lifesteal", 5]],
  mu: [["manaMax", 20], ["cooldownCut", 5], ["controlTime", 20], ["healPower", 10]],
  ao: [["hp", 15], ["shieldTaken", 20], ["healTaken", 10], ["manaMax", 10]],
  dai: [["healTaken", 10], ["hp", 10], ["healPower", 10], ["shieldTaken", 10]],
  bao_tay: [["critBonus", 5], ["critDamage", 10], ["resistPen", 10], ["attackSpeed", 5]],
  giay: [["attackSpeed", 10], ["cooldownCut", 5], ["controlTime", 20], ["def", 10]],
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
  ["KV-TH-001", "Hộ Mệnh Văn", "Lần đầu máu dưới 25%: khiên 8% máu tối đa", 0.08, "%"],
  ["KV-TH-002", "Ngự Khắc Văn", "Trúng đòn hệ khắc mình: hệ số ×1,5 thành ×1,47", 1.47, "hệ số"],
  ["KV-TH-003", "Phản Chấn Văn", "Phản 3% sát thương cận chiến nhận được", 0.03, "%"],
  ["KV-TH-004", "Thiết Bích Văn", "Đứng hàng trước: phòng thủ +3%", 0.03, "%"],
  ["KV-TH-005", "Tĩnh Tâm Văn", "Đứng hàng sau: mana tối đa +3%", 0.03, "%"],
  ["KV-TH-006", "Hồi Xuân Văn", "Hồi 1% máu mỗi 5 s", 0.01, "%"],
  ["KV-TH-007", "Định Thân Văn", "Bị đẩy lùi thì đứng lại sau 0,5 s thay vì bị đẩy hết ô", 0.5, "giây"],
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
  ["TB-KI-067", "Tinh La Kỳ", "ky", "Trận pháp bày xong thì đồng đội đứng trong trận +5% phòng thủ"],
  ["TB-KI-068", "Vọng Nguyệt Cầm", "cam", "Hồi phục giải luôn 1 hiệu ứng thiêu đốt hoặc độc"],
  ["TB-KI-069", "Ngọc Lâu Tiêu", "tieu", "Khống chế trúng kẻ đang vận công thì chiêu đó mất luôn, không hoàn hồi chiêu"],
  ["TB-KI-070", "Phá Thiên Thương", "thuong", "Lướt tới xong, đòn kế tiếp xuyên 20% khiên"],
];
const LUAT_LK: [string, number][] = [
  ["phanGiaiMoCap", 20], ["baoGiamMoCap", 20], ["tayLuyenMoCap", 101], ["khiLinhMoCap", 201], ["khiLinhBacToiThieu", 3],
  ["songHeCapNgoc", 7], ["phachCapNgoc", 10], ["danhKhiMoCap", 250], ["danhKhiLoToiThieu", 9],
  ["phanGiaiKhiTinhMoiCapKhiLinh", 1], ["phanGiaiTraNac", 500], ["tayLuyenKhiTinh", 2],
  ["khiLinhKnTran", 1], ["khiLinhKnBiCanh", 5], ["khiLinhKnKhiTinh", 10],
  ["khiVanToiDa.tim", 1], ["khiVanToiDa.vang", 2], ["khiVanToiDa.do", 3], ["khiVanTinhToiDa", 2], ["khiVanTranLucChien", 10],
  ["taoVanLinhVanThach", 1], ["phachTyLe", 300], ["phachKhiTinh", 20],
  ["danhKhiVanThiet", 5], ["danhKhiKhiTinh", 50], ["danhKhiHoLo", 3], ["danhKhiTyLe.lo9", 400], ["danhKhiTyLe.lo10", 600],
  ["danhKhiYHeSo", 1500], ["danhKhiMoiNguoi", 1], ["baoGiamTuanLinhVanThach", 2], ["teLuyenHoiChieuSan", 600],
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
function baoGiamThuong(dem: Record<string, string>, ten: string, oTen: Record<string, string>, pbTen: Record<string, string>): [string, string, number | null] {
  switch (dem.loai) {
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
  note("luyen_khi.json", "bao_giam:", "bao_giam: ghi mọi kiểu đã từng sở hữu, cả khi đã phân giải; mỗi trang cho thưởng không cộng chỉ số chiến đấu, loại thưởng theo thứ được đếm (vũ khí, danh khí: ánh sáng vũ khí; ô khác: khung ô; pháp bảo, Phách: danh hiệu; pháp khí: ô kho; ấn bộ: ô túi; Ý châu: Khí Tinh). Trang, số lượng và thưởng là đề xuất. Mỗi tuần một trang tuần ngẫu nhiên cho luat.baoGiamTuanLinhVanThach Linh Văn Thạch.");
  note("ngoc.json", "song_he, phach", "song_he, phach (luyện khí, đề xuất 2026-11-04): song hệ hợp 2 viên cùng cấp, hai hệ tương sinh hoặc tương hợp, mỗi hệ moi_he giá trị một viên thường, tính trong trần mềm của hệ đó; đậu theo ty_le_dau cố định (không theo bảng nén), thất bại mất that_bai_mat viên (viên đặt thứ hai), phù phu_giu giữ lại cả hai. Phách điểm hóa từ 1 ngọc cấp 10 (luyen_khi.json luat.phachKhiTinh, luat.phachTyLe), khảm ô công, cho gia_tri và nâng trần sát thương hệ đó lên tran_toi_da; mỗi hệ 1 Phách tính trần; khóa.");
  log.push("Ghi chú trang bị: sửa 3 dòng (tẩy luyện, Bảo Giám, song hệ)");
};

export const STEPS: Record<string, Step> = {
  artifact_rules: artifactRules, dao_co_ban: daoCoBan, dao_co_ban_mo: daoCoBanMo, tran_lan_2: tranLan2, hop_tran: hopTran,
  luyen_khi: luyenKhi, hop_tran_2: hopTran2, luyen_khi_2: luyenKhi2,
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

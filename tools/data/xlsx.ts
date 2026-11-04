// Đọc và ghi file .xlsx không cần gói ngoài. File .xlsx là file zip chứa XML (Office Open XML), nên chỉ cần
// node:zlib có sẵn (deflateRawSync, inflateRawSync, crc32 từ Node 22.2) và vài biểu thức chính quy.
// Ghi: chuỗi viết thẳng trong ô (inlineStr), công thức kèm giá trị đã tính sẵn, Excel tự tính lại khi mở (fullCalcOnLoad).
// Đọc: hiểu cả file do Excel, LibreOffice hay Google Sheets lưu lại (sharedStrings, chữ nhiều định dạng, ô trống tự đóng).
import { deflateRawSync, inflateRawSync, crc32 } from "node:zlib";

// ---------- zip ----------

// Ngày giờ cố định trong zip để cùng nội dung thì cùng byte (git không báo đổi vô cớ).
const DOS_DATE = ((2026 - 1980) << 9) | (1 << 5) | 1;

export function zip(entries: { name: string; data: Buffer }[]): Buffer {
  const parts: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const e of entries) {
    const name = Buffer.from(e.name, "utf8");
    const comp = deflateRawSync(e.data, { level: 9 });
    const crc = crc32(e.data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6); // tên UTF-8
    local.writeUInt16LE(8, 8); // deflate
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(comp.length, 18);
    local.writeUInt32LE(e.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    parts.push(local, name, comp);
    const dir = Buffer.alloc(46);
    dir.writeUInt32LE(0x02014b50, 0);
    dir.writeUInt16LE(20, 4);
    dir.writeUInt16LE(20, 6);
    dir.writeUInt16LE(0x0800, 8);
    dir.writeUInt16LE(8, 10);
    dir.writeUInt16LE(0, 12);
    dir.writeUInt16LE(DOS_DATE, 14);
    dir.writeUInt32LE(crc, 16);
    dir.writeUInt32LE(comp.length, 20);
    dir.writeUInt32LE(e.data.length, 24);
    dir.writeUInt16LE(name.length, 28);
    dir.writeUInt32LE(offset, 42);
    central.push(dir, name);
    offset += local.length + name.length + comp.length;
  }
  const dir = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(dir.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, dir, end]);
}

export function unzip(buf: Buffer): Map<string, Buffer> {
  let end = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 0xffff); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { end = i; break; }
  }
  if (end < 0) throw new Error("Không phải file zip hay xlsx");
  const count = buf.readUInt16LE(end + 10);
  let p = buf.readUInt32LE(end + 16);
  const out = new Map<string, Buffer>();
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error("Thư mục trong file zip bị hỏng");
    const method = buf.readUInt16LE(p + 10);
    const size = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString("utf8", p + 46, p + 46 + nameLen);
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const raw = buf.subarray(start, start + size);
    if (method === 0) out.set(name, Buffer.from(raw));
    else if (method === 8) out.set(name, inflateRawSync(raw));
    else throw new Error(`Kiểu nén ${method} trong ${name} chưa hỗ trợ`);
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

// ---------- ô, cột ----------

export function colName(i: number): string {
  let s = "";
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}
export function cellRef(row: number, col: number): string {
  return `${colName(col)}${row + 1}`;
}
function parseRef(ref: string): { row: number; col: number } {
  const m = /^([A-Z]+)(\d+)$/.exec(ref);
  if (!m) throw new Error(`Địa chỉ ô lạ: ${ref}`);
  let col = 0;
  for (const ch of m[1]) col = col * 26 + ch.charCodeAt(0) - 64;
  return { row: Number(m[2]) - 1, col: col - 1 };
}

// ---------- ghi ----------

/** Màu nền ô: lấy từ GDD, lấy từ code, đề xuất mới, công thức, tiêu đề. */
export type Fill = "gdd" | "code" | "de_xuat" | "cong_thuc" | "tieu_de" | "none";
/** Định dạng số: chung, số nguyên có dấu nghìn, %, % một số lẻ, % hai số lẻ, hai số lẻ. */
export type Fmt = "general" | "int" | "pct" | "pct1" | "pct2" | "dec2";
export interface Cell {
  v?: string | number | null;
  f?: string; // công thức, không có dấu "=" đầu
  fill?: Fill;
  fmt?: Fmt;
  bold?: boolean;
  wrap?: boolean;
}
export interface SheetOut {
  name: string;
  rows: (Cell | null)[][];
  widths?: number[];
  freeze?: { rows: number; cols: number };
  lists?: { ref: string; values: string[] }[]; // ô chọn từ danh sách
}

export const FILL_COLORS: Record<Exclude<Fill, "none">, string> = {
  gdd: "E2EFDA",
  code: "DDEBF7",
  de_xuat: "FFF2CC",
  cong_thuc: "EDEDED",
  tieu_de: "BDD7EE",
};
const FMT_ID: Record<Fmt, number> = { general: 0, int: 3, pct: 9, pct1: 164, pct2: 10, dec2: 2 };

export function esc(s: string): string {
  return s
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const NS = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';

/** Một kiểu ô trong cellXfs, viết cùng một cách cho file mới và file có sẵn (để tìm lại được bằng so chuỗi). */
export function xfXml(numFmtId: number, fontId: number, fillId: number, wrap: boolean): string {
  const align = wrap ? `<alignment wrapText="1" vertical="top"/>` : "";
  return `<xf numFmtId="${numFmtId}" fontId="${fontId}" fillId="${fillId}" borderId="0" xfId="0"`
    + `${numFmtId ? ' applyNumberFormat="1"' : ""}${fontId ? ' applyFont="1"' : ""}${fillId ? ' applyFill="1"' : ""}`
    + `${align ? ` applyAlignment="1">${align}</xf>` : "/>"}`;
}

/** Một ô <c> ở dòng `r`, cột `ci` (đếm từ 0); ô trống không kiểu trả "". */
export function cellXml(r: number, ci: number, c: Cell, styleOf: (c: Cell) => number, sheetName = ""): string {
  const ref = cellRef(r, ci);
  const st = styleOf(c);
  const sAttr = st ? ` s="${st}"` : "";
  if (c.f !== undefined) {
    const f = `<f>${esc(c.f)}</f>`;
    if (typeof c.v === "number") return `<c r="${ref}"${sAttr}>${f}<v>${c.v}</v></c>`;
    if (typeof c.v === "string") return `<c r="${ref}"${sAttr} t="str">${f}<v>${esc(c.v)}</v></c>`;
    return `<c r="${ref}"${sAttr}>${f}</c>`;
  }
  if (typeof c.v === "number") {
    if (!Number.isFinite(c.v)) throw new Error(`Số không hợp lệ ở ${sheetName}!${ref}`);
    return `<c r="${ref}"${sAttr}><v>${c.v}</v></c>`;
  }
  if (typeof c.v === "string" && c.v !== "") return `<c r="${ref}"${sAttr} t="inlineStr"><is><t xml:space="preserve">${esc(c.v)}</t></is></c>`;
  return st ? `<c r="${ref}"${sAttr}/>` : "";
}

/** Một dòng <row> (dòng `r`, đếm từ 0), kiểu ô lấy qua `styleOf`. Dòng trống trả "". */
export function rowXml(r: number, row: (Cell | null)[], styleOf: (c: Cell) => number, sheetName = ""): string {
  const cells = row.map((c, ci) => (c ? cellXml(r, ci, c, styleOf, sheetName) : "")).filter(Boolean);
  return cells.length ? `<row r="${r + 1}">${cells.join("")}</row>` : "";
}

/** Cả file XML của một sheet. */
export function worksheetXml(s: SheetOut, styleOf: (c: Cell) => number, selected = false): string {
  const rows = s.rows.map((row, r) => rowXml(r, row, styleOf, s.name)).filter(Boolean);
  let view = `<sheetView workbookViewId="0"${selected ? ' tabSelected="1"' : ""}`;
  if (s.freeze && (s.freeze.rows || s.freeze.cols)) {
    const { rows: fr, cols: fc } = s.freeze;
    const pane = fr && fc ? "bottomRight" : fr ? "bottomLeft" : "topRight";
    view += `><pane${fc ? ` xSplit="${fc}"` : ""}${fr ? ` ySplit="${fr}"` : ""} topLeftCell="${cellRef(fr, fc)}" activePane="${pane}" state="frozen"/></sheetView>`;
  } else view += "/>";
  const cols = s.widths?.length
    ? `<cols>${s.widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("")}</cols>`
    : "";
  const lists = s.lists?.length
    ? `<dataValidations count="${s.lists.length}">${s.lists.map((l) =>
      `<dataValidation type="list" allowBlank="1" showErrorMessage="1" sqref="${l.ref}"><formula1>"${esc(l.values.join(","))}"</formula1></dataValidation>`).join("")}</dataValidations>`
    : "";
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet ${NS}><sheetViews>${view}</sheetViews><sheetFormatPr defaultRowHeight="15"/>${cols}<sheetData>${rows.join("")}</sheetData>${lists}<pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/></worksheet>`;
}

/**
 * Kiểu ô của một file có sẵn (styles.xml): tìm hoặc thêm màu nền, định dạng số, chữ đậm và kiểu ô, để thêm dòng, cột, sheet
 * mà không đụng tới kiểu cũ. File do Excel lưu lại có thể viết kiểu ô khác cách của mình; khi đó kiểu mới được thêm vào.
 */
export class StyleBook {
  xml: string;
  constructor(xml: string) {
    this.xml = xml;
  }
  index(c: Cell): number {
    const fmt = c.fmt ?? "general";
    const numFmtId = fmt === "pct1" ? this.customFmt("0.0%") : FMT_ID[fmt];
    const fontId = c.bold ? this.boldFont() : 0;
    const fillId = !c.fill || c.fill === "none" ? 0 : this.fillOf(FILL_COLORS[c.fill]);
    return this.findOrAdd("cellXfs", /<xf\b[^>]*?(?:\/>|>[\s\S]*?<\/xf>)/g, xfXml(numFmtId, fontId, fillId, !!c.wrap));
  }
  private block(name: string): RegExpExecArray | null {
    return new RegExp(`<${name}\\b[^>]*?(?:/>|>([\\s\\S]*?)</${name}>)`).exec(this.xml);
  }
  /** Chỉ số của `want` trong khối `name`; chưa có thì thêm cuối khối (tạo khối trước `before` nếu chưa có). */
  private findOrAdd(name: string, item: RegExp, want: string, before?: string): number {
    const b = this.block(name);
    const list = b ? [...(b[1] ?? "").matchAll(item)].map((m) => m[0]) : [];
    const i = list.indexOf(want);
    if (i >= 0) return i;
    list.push(want);
    const next = `<${name} count="${list.length}">${list.join("")}</${name}>`;
    if (b) this.xml = this.xml.slice(0, b.index) + next + this.xml.slice(b.index + b[0].length);
    else this.xml = this.xml.replace(`<${before}`, `${next}<${before}`);
    return list.length - 1;
  }
  private fillOf(rgb: string): number {
    const list = [...(this.block("fills")?.[1] ?? "").matchAll(/<fill>[\s\S]*?<\/fill>|<fill\/>/g)].map((m) => m[0]);
    const i = list.findIndex((f) => f.toUpperCase().includes(`RGB="FF${rgb}"`));
    return i >= 0 ? i : this.findOrAdd("fills", /<fill>[\s\S]*?<\/fill>|<fill\/>/g,
      `<fill><patternFill patternType="solid"><fgColor rgb="FF${rgb}"/><bgColor indexed="64"/></patternFill></fill>`);
  }
  private boldFont(): number {
    const list = [...(this.block("fonts")?.[1] ?? "").matchAll(/<font>[\s\S]*?<\/font>|<font\/>/g)].map((m) => m[0]);
    const i = list.findIndex((f) => /<b\/>|<b val="(1|true)"\/>/.test(f));
    return i >= 0 ? i : this.findOrAdd("fonts", /<font>[\s\S]*?<\/font>|<font\/>/g, `<font><b/><sz val="11"/><name val="Calibri"/><family val="2"/></font>`);
  }
  private customFmt(code: string): number {
    const items = [...(this.block("numFmts")?.[1] ?? "").matchAll(/<numFmt\b[^>]*\/>/g)].map((m) => m[0]);
    const found = items.find((x) => x.includes(`formatCode="${code}"`));
    if (found) return Number(/numFmtId="(\d+)"/.exec(found)![1]);
    const id = Math.max(163, ...items.map((x) => Number(/numFmtId="(\d+)"/.exec(x)![1]))) + 1;
    this.findOrAdd("numFmts", /<numFmt\b[^>]*\/>/g, `<numFmt numFmtId="${id}" formatCode="${code}"/>`, "fonts");
    return id;
  }
}

export function writeXlsx(sheets: SheetOut[]): Buffer {
  const fills = Object.keys(FILL_COLORS) as Exclude<Fill, "none">[];
  const xfKeys: string[] = ["none|general|0|0"];
  const xfIndex = (c: Cell): number => {
    const key = `${c.fill ?? "none"}|${c.fmt ?? "general"}|${c.bold ? 1 : 0}|${c.wrap ? 1 : 0}`;
    let i = xfKeys.indexOf(key);
    if (i < 0) { xfKeys.push(key); i = xfKeys.length - 1; }
    return i;
  };

  const sheetXml = sheets.map((s, si) => worksheetXml(s, xfIndex, si === 0));

  const xfs = xfKeys.map((k) => {
    const [fill, fmt, bold, wrap] = k.split("|");
    const fillId = fill === "none" ? 0 : 2 + fills.indexOf(fill as Exclude<Fill, "none">);
    return xfXml(FMT_ID[fmt as Fmt], bold === "1" ? 1 : 0, fillId, wrap === "1");
  });
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">`
    + `<numFmts count="1"><numFmt numFmtId="164" formatCode="0.0%"/></numFmts>`
    + `<fonts count="2"><font><sz val="11"/><name val="Calibri"/><family val="2"/></font><font><b/><sz val="11"/><name val="Calibri"/><family val="2"/></font></fonts>`
    + `<fills count="${2 + fills.length}"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>`
    + fills.map((f) => `<fill><patternFill patternType="solid"><fgColor rgb="FF${FILL_COLORS[f]}"/><bgColor indexed="64"/></patternFill></fill>`).join("")
    + `</fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>`
    + `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>`
    + `<cellXfs count="${xfs.length}">${xfs.join("")}</cellXfs>`
    + `<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;

  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<workbook ${NS}><bookViews><workbookView activeTab="0"/></bookViews><sheets>`
    + sheets.map((s, i) => `<sheet name="${esc(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")
    + `</sheets><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>`;
  const rel = (id: string, type: string, target: string) =>
    `<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${type}" Target="${target}"/>`;
  const workbookRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`
    + sheets.map((_, i) => rel(`rId${i + 1}`, "worksheet", `worksheets/sheet${i + 1}.xml`)).join("")
    + rel(`rId${sheets.length + 1}`, "styles", "styles.xml") + `</Relationships>`;
  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`
    + rel("rId1", "officeDocument", "xl/workbook.xml") + `</Relationships>`;
  const ct = "application/vnd.openxmlformats-officedocument.spreadsheetml";
  const types = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">`
    + `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>`
    + `<Override PartName="/xl/workbook.xml" ContentType="${ct}.sheet.main+xml"/>`
    + sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="${ct}.worksheet+xml"/>`).join("")
    + `<Override PartName="/xl/styles.xml" ContentType="${ct}.styles+xml"/></Types>`;

  return zip([
    { name: "[Content_Types].xml", data: Buffer.from(types) },
    { name: "_rels/.rels", data: Buffer.from(rootRels) },
    { name: "xl/workbook.xml", data: Buffer.from(workbook) },
    { name: "xl/_rels/workbook.xml.rels", data: Buffer.from(workbookRels) },
    { name: "xl/styles.xml", data: Buffer.from(styles) },
    ...sheetXml.map((x, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data: Buffer.from(x) })),
  ]);
}

// ---------- đọc ----------

export type Value = string | number | boolean | null;
export interface SheetIn {
  name: string;
  cells: Value[][]; // [dòng][cột], ô trống là null
  formulas: (string | null)[][];
}

function unesc(s: string): string {
  return s
    .replace(/_x([0-9A-Fa-f]{4})_/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&#x([0-9A-Fa-f]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
}
function attrs(s: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of s.matchAll(/([\w:]+)="([^"]*)"/g)) out[m[1]] = unesc(m[2]);
  return out;
}
/** Nối mọi đoạn <t> trong một chuỗi (bỏ phần phiên âm <rPh>). */
function textOf(xml: string): string {
  return [...xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, "").matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => unesc(m[1])).join("");
}

function getPart(files: Map<string, Buffer>, name: string): string {
  const b = files.get(name.replace(/^\//, ""));
  if (!b) throw new Error(`Thiếu ${name} trong file xlsx`);
  return b.toString("utf8");
}

/** Tên sheet → đường dẫn file XML của sheet trong gói, theo thứ tự trong workbook. */
export function sheetParts(files: Map<string, Buffer>): [string, string][] {
  const rels: Record<string, string> = {};
  for (const m of getPart(files, "xl/_rels/workbook.xml.rels").matchAll(/<Relationship\b([^>]*)\/?>/g)) {
    const a = attrs(m[1]);
    rels[a.Id] = a.Target.startsWith("/") ? a.Target.slice(1) : `xl/${a.Target}`;
  }
  return [...getPart(files, "xl/workbook.xml").matchAll(/<sheet\b([^>]*)\/?>/g)].map((m) => {
    const a = attrs(m[1]);
    return [a.name, rels[a["r:id"]]];
  });
}

/** Dời các địa chỉ tương đối (không có $) của công thức đi `dr` dòng, `dc` cột; bỏ qua chuỗi "..." và tên sheet '...'. */
export function shiftFormula(f: string, dr: number, dc: number): string {
  if (!dr && !dc) return f;
  return f.split(/("(?:[^"]|"")*"|'(?:[^']|'')*')/).map((part, i) => i % 2 ? part
    : part.replace(/(?<![A-Za-z0-9_.])(\$?)([A-Z]{1,3})(\$?)(\d+)(?![\d(A-Za-z_])/g, (m, cAbs: string, c: string, rAbs: string, r: string) => {
      let col = 0;
      for (const ch of c) col = col * 26 + ch.charCodeAt(0) - 64;
      const nc = cAbs ? c : colName(col - 1 + dc);
      const nr = rAbs ? r : String(Number(r) + dr);
      return `${cAbs}${nc}${rAbs}${nr}`;
    })).join("");
}

export function readXlsx(buf: Buffer): SheetIn[] {
  return readFiles(unzip(buf));
}

/** Như readXlsx nhưng đọc từ gói đã giải nén (dùng khi đang sửa gói). */
export function readFiles(files: Map<string, Buffer>): SheetIn[] {
  const get = (name: string): string => getPart(files, name);
  const shared: string[] = files.has("xl/sharedStrings.xml")
    ? [...get("xl/sharedStrings.xml").matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => textOf(m[1]))
    : [];
  const out: SheetIn[] = [];
  for (const [name, part] of sheetParts(files)) {
    const a = { name };
    const xml = get(part);
    const cells: Value[][] = [];
    const formulas: (string | null)[][] = [];
    // Công thức chung (Excel lưu công thức lặp lại một lần ở ô đầu, các ô sau chỉ ghi si): dời địa chỉ theo khoảng cách tới ô đầu
    const masters = new Map<string, { text: string; row: number; col: number }>();
    for (const c of xml.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const ca = attrs(c[1]);
      const body = c[2] ?? "";
      const { row, col } = parseRef(ca.r);
      const vm = /<v>([\s\S]*?)<\/v>/.exec(body);
      const fe = /<f\b([^>]*?)(?:\/>|>([\s\S]*?)<\/f>)/.exec(body);
      let fm: [string, string] | null = null;
      if (fe) {
        const fa = attrs(fe[1]), text = unesc(fe[2] ?? "");
        if (fa.t === "shared" && fa.si !== undefined) {
          if (text) masters.set(fa.si, { text, row, col });
          const m = masters.get(fa.si);
          fm = m ? ["", shiftFormula(m.text, row - m.row, col - m.col)] : null;
        } else fm = ["", text];
      }
      let v: Value = null;
      switch (ca.t) {
        case "s": v = vm ? shared[Number(vm[1])] : null; break;
        case "inlineStr": v = textOf(body); break;
        case "str": v = vm ? unesc(vm[1]) : ""; break;
        case "b": v = vm ? vm[1] === "1" : null; break;
        case "e": v = vm ? `#LỖI ${unesc(vm[1])}` : "#LỖI"; break;
        default: v = vm ? Number(vm[1]) : null;
      }
      (cells[row] ??= [])[col] = v === "" ? null : v;
      if (fm) (formulas[row] ??= [])[col] = fm[1];
    }
    for (let r = 0; r < cells.length; r++) {
      cells[r] ??= [];
      for (let k = 0; k < cells[r].length; k++) if (cells[r][k] === undefined) cells[r][k] = null;
    }
    out.push({ name: a.name, cells, formulas });
  }
  return out;
}

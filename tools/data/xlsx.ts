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

export function writeXlsx(sheets: SheetOut[]): Buffer {
  const fills = Object.keys(FILL_COLORS) as Exclude<Fill, "none">[];
  const xfKeys: string[] = ["none|general|0|0"];
  const xfIndex = (c: Cell): number => {
    const key = `${c.fill ?? "none"}|${c.fmt ?? "general"}|${c.bold ? 1 : 0}|${c.wrap ? 1 : 0}`;
    let i = xfKeys.indexOf(key);
    if (i < 0) { xfKeys.push(key); i = xfKeys.length - 1; }
    return i;
  };

  const sheetXml = sheets.map((s, si) => {
    const rows: string[] = [];
    s.rows.forEach((row, r) => {
      const cells: string[] = [];
      row.forEach((c, ci) => {
        if (!c) return;
        const ref = cellRef(r, ci);
        const st = xfIndex(c);
        const sAttr = st ? ` s="${st}"` : "";
        if (c.f !== undefined) {
          const f = `<f>${esc(c.f)}</f>`;
          if (typeof c.v === "number") cells.push(`<c r="${ref}"${sAttr}>${f}<v>${c.v}</v></c>`);
          else if (typeof c.v === "string") cells.push(`<c r="${ref}"${sAttr} t="str">${f}<v>${esc(c.v)}</v></c>`);
          else cells.push(`<c r="${ref}"${sAttr}>${f}</c>`);
        } else if (typeof c.v === "number") {
          if (!Number.isFinite(c.v)) throw new Error(`Số không hợp lệ ở ${s.name}!${ref}`);
          cells.push(`<c r="${ref}"${sAttr}><v>${c.v}</v></c>`);
        } else if (typeof c.v === "string" && c.v !== "") {
          cells.push(`<c r="${ref}"${sAttr} t="inlineStr"><is><t xml:space="preserve">${esc(c.v)}</t></is></c>`);
        } else if (st) {
          cells.push(`<c r="${ref}"${sAttr}/>`);
        }
      });
      if (cells.length) rows.push(`<row r="${r + 1}">${cells.join("")}</row>`);
    });
    let view = `<sheetView workbookViewId="0"${si === 0 ? ' tabSelected="1"' : ""}`;
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
  });

  const xfs = xfKeys.map((k) => {
    const [fill, fmt, bold, wrap] = k.split("|");
    const fillId = fill === "none" ? 0 : 2 + fills.indexOf(fill as Exclude<Fill, "none">);
    const numFmtId = FMT_ID[fmt as Fmt];
    const align = wrap === "1" ? `<alignment wrapText="1" vertical="top"/>` : "";
    return `<xf numFmtId="${numFmtId}" fontId="${bold === "1" ? 1 : 0}" fillId="${fillId}" borderId="0" xfId="0"`
      + `${numFmtId ? ' applyNumberFormat="1"' : ""}${bold === "1" ? ' applyFont="1"' : ""}${fillId ? ' applyFill="1"' : ""}`
      + `${align ? ` applyAlignment="1">${align}</xf>` : "/>"}`;
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

export function readXlsx(buf: Buffer): SheetIn[] {
  const files = unzip(buf);
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
    for (const c of xml.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const ca = attrs(c[1]);
      const body = c[2] ?? "";
      const { row, col } = parseRef(ca.r);
      const vm = /<v>([\s\S]*?)<\/v>/.exec(body);
      const fm = /<f(?:\s[^>]*)?>([\s\S]*?)<\/f>/.exec(body);
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
      if (fm) (formulas[row] ??= [])[col] = unesc(fm[1]);
    }
    for (let r = 0; r < cells.length; r++) {
      cells[r] ??= [];
      for (let k = 0; k < cells[r].length; k++) if (cells[r][k] === undefined) cells[r][k] = null;
    }
    out.push({ name: a.name, cells, formulas });
  }
  return out;
}

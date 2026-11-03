// Sửa từng ô ngay trong file số liệu Excel: chỉ thay XML của đúng ô đó, giữ nguyên định dạng, các sheet khác và mọi chỗ
// người dùng đã sửa tay. Dùng cho yêu cầu nhỏ từ các phiên khác khi Excel đã là nguồn gốc; sửa xong tự chạy xuat.ts.
//
// Chạy: node --experimental-strip-types --no-warnings tools/data/sua.ts "<sheet>" "<mã dòng>" "<cột>=<giá trị>" [...]
//   <mã dòng>: giá trị ở cột mã của sheet (cột Khóa ở sheet Tham số, cột đầu ở ma trận); <cột>: chữ tiêu đề hoặc khóa cột
//   trong bang.ts / trang_bi.ts; <giá trị> trống thì xóa ô. Không sửa ô công thức.
// Ví dụ: tools/data/sua.ts "Ý châu" NG-YC-008 "Mô tả=..." "tham_so=heSoMana: 2700"
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { unzip, zip, readXlsx, sheetParts, colName, esc, type Value } from "./xlsx.ts";
import * as B from "./bang.ts";
import * as TB from "./trang_bi.ts";

export interface Edit { sheet: string; id: string; col: string; value: string }

const NUMERIC: B.Kind[] = ["int", "num", "pct", "mul", "sec", "cell", "qty"];
const norm = (v: Value | undefined) => String(v ?? "").replace(/\s+/g, " ").trim();

function tableDef(sheet: string): B.TableDef | undefined {
  return [...B.SHEETS, ...TB.PARTS.map((p) => p.def)].find((d): d is B.TableDef => d.kind === "table" && d.sheet === sheet);
}

/** Trả file mới và danh sách "sheet!ô: cũ → mới". */
export function editCells(buf: Buffer, edits: Edit[]): { buf: Buffer; log: string[] } {
  const files = unzip(buf);
  const parts = new Map(sheetParts(files));
  const sheets = new Map(readXlsx(buf).map((s) => [s.name, s]));
  const log: string[] = [];
  for (const e of edits) {
    const s = sheets.get(e.sheet), part = parts.get(e.sheet);
    if (!s || !part) throw new Error(`Không có sheet "${e.sheet}"`);
    const def = tableDef(e.sheet);
    const header = (s.cells[0] ?? []).map(norm);
    const idHeader = e.sheet === B.PARAMS.sheet ? "Khóa" : def ? def.cols.find((c) => c.key === def.id)!.header : header[0];
    const idCol = header.indexOf(idHeader);
    const colDef = def?.cols.find((c) => c.key === e.col || c.header === e.col);
    const col = header.indexOf(colDef ? colDef.header : e.col);
    if (idCol < 0 || col < 0) throw new Error(`Sheet "${e.sheet}" không có cột "${idCol < 0 ? idHeader : e.col}"`);
    const rows = s.cells.map((r, i) => (i > 0 && norm(r?.[idCol]) === e.id ? i : -1)).filter((i) => i > 0);
    if (rows.length !== 1) throw new Error(`Sheet "${e.sheet}": ${rows.length} dòng có mã "${e.id}"`);
    const r = rows[0];
    if (s.formulas[r]?.[col]) throw new Error(`${e.sheet}!${colName(col)}${r + 1} là ô công thức, không sửa`);
    const old = s.cells[r]?.[col] ?? null;
    const numeric = colDef ? NUMERIC.includes(colDef.kind) : typeof old === "number";
    let value: string | number | null = e.value.trim() === "" ? null : e.value;
    if (value !== null && numeric) {
      const n = Number(value.replace(",", "."));
      if (!Number.isFinite(n)) throw new Error(`Cột "${e.col}" cần số, nhận "${e.value}"`);
      value = n;
    }
    const xml = files.get(part)!.toString("utf8");
    files.set(part, Buffer.from(setCell(xml, r + 1, col, value)));
    (s.cells[r] ??= [])[col] = value;
    log.push(`${e.sheet}!${colName(col)}${r + 1} (${e.id}, ${colDef?.header ?? e.col}): ${JSON.stringify(old)} → ${JSON.stringify(value)}`);
  }
  return { buf: zip([...files].map(([name, data]) => ({ name, data }))), log };
}

/** Thay một ô trong XML của sheet, giữ kiểu định dạng (s) của ô cũ; thêm ô vào đúng thứ tự cột nếu chưa có. */
function setCell(xml: string, row: number, col: number, value: string | number | null): string {
  const ref = `${colName(col)}${row}`;
  const rowRe = new RegExp(`<row\\b([^>]*?\\br="${row}"[^>]*?)(?:/>|>([\\s\\S]*?)</row>)`);
  const m = rowRe.exec(xml);
  if (!m) throw new Error(`Không thấy dòng ${row}`);
  const body = m[2] ?? "";
  const cells = [...body.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)];
  const at = cells.find((c) => new RegExp(`\\br="${ref}"`).test(c[1]));
  // Ô chưa có (Excel bỏ ô trống khi lưu) thì mượn định dạng của ô cùng cột ở dòng trên
  const style = at ? /\bs="(\d+)"/.exec(at[1])?.[1]
    : new RegExp(`<c\\b[^>]*?\\br="${colName(col)}${row - 1}"[^>]*?\\bs="(\\d+)"`).exec(xml)?.[1]
      ?? new RegExp(`<c\\b[^>]*?\\bs="(\\d+)"[^>]*?\\br="${colName(col)}${row - 1}"`).exec(xml)?.[1];
  const sAttr = style ? ` s="${style}"` : "";
  const cell = value === null ? `<c r="${ref}"${sAttr}/>`
    : typeof value === "number" ? `<c r="${ref}"${sAttr}><v>${value}</v></c>`
      : `<c r="${ref}"${sAttr} t="inlineStr"><is><t xml:space="preserve">${esc(value)}</t></is></c>`;
  let newBody: string;
  if (at) newBody = body.slice(0, at.index) + cell + body.slice(at.index! + at[0].length);
  else {
    const colOf = (attrs: string) => {
      const r = /\br="([A-Z]+)\d+"/.exec(attrs)![1];
      let n = 0;
      for (const ch of r) n = n * 26 + ch.charCodeAt(0) - 64;
      return n - 1;
    };
    const after = cells.find((c) => colOf(c[1]) > col);
    newBody = after ? body.slice(0, after.index) + cell + body.slice(after.index!) : body + cell;
  }
  return xml.slice(0, m.index) + `<row${m[1]}>${newBody}</row>` + xml.slice(m.index + m[0].length);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [sheet, id, ...pairs] = process.argv.slice(2);
  if (!sheet || !id || !pairs.length) {
    console.error('Cách dùng: sua.ts "<sheet>" "<mã dòng>" "<cột>=<giá trị>" [...]');
    process.exit(2);
  }
  const edits = pairs.map((p) => {
    const i = p.indexOf("=");
    if (i < 0) throw new Error(`Thiếu "=" trong "${p}"`);
    return { sheet, id, col: p.slice(0, i).trim(), value: p.slice(i + 1) };
  });
  const path = fileURLToPath(new URL("../../data/he_thong/KhaiTongLapPhai_HeThong_v1.xlsx", import.meta.url));
  const { buf, log } = editCells(readFileSync(path), edits);
  writeFileSync(path, buf);
  for (const l of log) console.log(`  ${l}`);
  console.log(`Đã sửa ${log.length} ô trong ${path}; xuất lại JSON:`);
  execFileSync(process.execPath, [...process.execArgv, fileURLToPath(new URL("xuat.ts", import.meta.url))], { stdio: "inherit" });
}

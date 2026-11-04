// Sửa từng ô ngay trong file số liệu Excel: chỉ thay XML của đúng ô đó, giữ nguyên định dạng, các sheet khác và mọi chỗ
// người dùng đã sửa tay. Dùng cho yêu cầu nhỏ từ các phiên khác khi Excel đã là nguồn gốc; sửa xong tự chạy xuat.ts.
//
// Sửa giá trị: node --experimental-strip-types --no-warnings tools/data/sua.ts "<sheet>" "<dòng>" "<cột>=<giá trị>" [...]
// Đổi màu ô:   node --experimental-strip-types --no-warnings tools/data/sua.ts --mau <gdd|code|de_xuat> "<sheet>" "<dòng>" "<cột>" [...]
//   <dòng>: giá trị ở cột mã của sheet (cột Khóa ở sheet Tham số, cột đầu ở ma trận), hoặc "#12" là dòng 12 của Excel.
//           Đổi màu nhận thêm "*" (mọi dòng) và "TB-KI-*" (mã bắt đầu bằng TB-KI-).
//   <cột>: chữ tiêu đề hoặc khóa cột trong bang.ts / trang_bi.ts. <giá trị> trống thì xóa ô. Không sửa ô công thức.
// Ví dụ: tools/data/sua.ts "Ý châu" NG-YC-008 "Mô tả=..." "tham_so=heSoMana: 2700"
//        tools/data/sua.ts --mau gdd "Kiểu trang bị" "TB-KI-*" khi_hinh ten_de_xuat
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { unzip, zip, readXlsx, sheetParts, colName, esc, FILL_COLORS, type Fill, type SheetIn, type Value } from "./xlsx.ts";
import * as B from "./bang.ts";
import * as TB from "./trang_bi.ts";

export interface Edit { sheet: string; id: string; col: string; value: string }

const NUMERIC: B.Kind[] = ["int", "num", "pct", "mul", "sec", "cell", "qty"];
const norm = (v: Value | undefined) => String(v ?? "").replace(/\s+/g, " ").trim();

function tableDef(sheet: string): B.TableDef | undefined {
  return [...B.SHEETS, ...TB.PARTS.map((p) => p.def)].find((d): d is B.TableDef => d.kind === "table" && d.sheet === sheet);
}

/** Tìm các dòng (chỉ số 0 trong cells) và cột của một yêu cầu sửa. */
function locate(s: SheetIn, id: string, colName_: string): { rows: number[]; col: number; colDef?: B.Col } {
  const def = tableDef(s.name);
  const header = (s.cells[0] ?? []).map(norm);
  const idHeader = s.name === B.PARAMS.sheet ? "Khóa" : def ? def.cols.find((c) => c.key === def.id)!.header : header[0];
  const idCol = header.indexOf(idHeader);
  const colDef = def?.cols.find((c) => c.key === colName_ || c.header === colName_);
  const col = header.indexOf(colDef ? colDef.header : colName_);
  if (idCol < 0 || col < 0) throw new Error(`Sheet "${s.name}" không có cột "${idCol < 0 ? idHeader : colName_}"`);
  const match = (v: Value | undefined, r: number) => {
    if (id.startsWith("#")) return r + 1 === Number(id.slice(1));
    const x = norm(v);
    if (id === "*") return x !== "";
    return id.endsWith("*") ? x.startsWith(id.slice(0, -1)) : x === id;
  };
  const rows = s.cells.map((r, i) => (i > 0 && match(r?.[idCol], i) ? i : -1)).filter((i) => i > 0);
  if (!rows.length) throw new Error(`Sheet "${s.name}": không có dòng "${id}"`);
  return { rows, col, colDef };
}

/** Sửa giá trị; trả file mới và danh sách "sheet!ô: cũ → mới". */
export function editCells(buf: Buffer, edits: Edit[]): { buf: Buffer; log: string[] } {
  const files = unzip(buf);
  const parts = new Map(sheetParts(files));
  const sheets = new Map(readXlsx(buf).map((s) => [s.name, s]));
  const log: string[] = [];
  for (const e of edits) {
    const s = sheets.get(e.sheet), part = parts.get(e.sheet);
    if (!s || !part) throw new Error(`Không có sheet "${e.sheet}"`);
    const { rows, col, colDef } = locate(s, e.id, e.col);
    if (rows.length !== 1) throw new Error(`Sheet "${e.sheet}": ${rows.length} dòng khớp "${e.id}", sửa giá trị cần đúng 1 dòng`);
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
    files.set(part, Buffer.from(patchCell(files.get(part)!.toString("utf8"), r + 1, col, (style) => {
      const sAttr = style ? ` s="${style}"` : "";
      const ref = `${colName(col)}${r + 1}`;
      return value === null ? `<c r="${ref}"${sAttr}/>`
        : typeof value === "number" ? `<c r="${ref}"${sAttr}><v>${value}</v></c>`
          : `<c r="${ref}"${sAttr} t="inlineStr"><is><t xml:space="preserve">${esc(value)}</t></is></c>`;
    })));
    (s.cells[r] ??= [])[col] = value;
    log.push(`${e.sheet}!${colName(col)}${r + 1} (${e.id}, ${colDef?.header ?? e.col}): ${JSON.stringify(old)} → ${JSON.stringify(value)}`);
  }
  return { buf: zip([...files].map(([name, data]) => ({ name, data }))), log };
}

/** Đổi màu nền các ô (giữ giá trị, định dạng số, chữ đậm); trả file mới và số ô đã đổi. */
export function recolor(buf: Buffer, fill: Exclude<Fill, "none">, sheet: string, id: string, cols: string[]): { buf: Buffer; count: number } {
  const files = unzip(buf);
  const part = new Map(sheetParts(files)).get(sheet);
  const s = readXlsx(buf).find((x) => x.name === sheet);
  if (!s || !part) throw new Error(`Không có sheet "${sheet}"`);
  let styles = files.get("xl/styles.xml")!.toString("utf8");
  let xml = files.get(part)!.toString("utf8");
  const fillId = ensureFill();
  let count = 0;
  for (const c of cols) {
    const { rows, col } = locate(s, id, c);
    for (const r of rows) {
      xml = patchCell(xml, r + 1, col, (style, cell) => {
        const newStyle = xfWithFill(Number(style ?? 0), fillId);
        const ref = `${colName(col)}${r + 1}`;
        if (!cell) return `<c r="${ref}" s="${newStyle}"/>`;
        const open = /^<c\b[^>]*?(?=\/?>)/.exec(cell)![0];
        const newOpen = /\bs="\d+"/.test(open) ? open.replace(/\bs="\d+"/, `s="${newStyle}"`) : `${open} s="${newStyle}"`;
        return newOpen + cell.slice(open.length);
      });
      count++;
    }
  }
  files.set(part, Buffer.from(xml));
  files.set("xl/styles.xml", Buffer.from(styles));
  return { buf: zip([...files].map(([name, data]) => ({ name, data }))), count };

  /** Chỉ số fill có màu này trong styles.xml; chưa có thì thêm. */
  function ensureFill(): number {
    const rgb = `FF${FILL_COLORS[fill]}`;
    const block = /<fills\b[^>]*>([\s\S]*?)<\/fills>/.exec(styles)!;
    const list = [...block[1].matchAll(/<fill>[\s\S]*?<\/fill>|<fill\/>/g)].map((m) => m[0]);
    const i = list.findIndex((f) => f.toUpperCase().includes(`RGB="${rgb}"`));
    if (i >= 0) return i;
    list.push(`<fill><patternFill patternType="solid"><fgColor rgb="${rgb}"/><bgColor indexed="64"/></patternFill></fill>`);
    styles = styles.replace(block[0], `<fills count="${list.length}">${list.join("")}</fills>`);
    return list.length - 1;
  }
  /** Chỉ số kiểu ô giống kiểu `xf` nhưng nền là `fid`; chưa có thì thêm vào cellXfs. */
  function xfWithFill(xf: number, fid: number): number {
    const block = /<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/.exec(styles)!;
    const list = [...block[1].matchAll(/<xf\b[^>]*?(?:\/>|>[\s\S]*?<\/xf>)/g)].map((m) => m[0]);
    const base = list[xf] ?? list[0];
    let want = /\bfillId="\d+"/.test(base) ? base.replace(/\bfillId="\d+"/, `fillId="${fid}"`) : base.replace("<xf ", `<xf fillId="${fid}" `);
    if (!/\bapplyFill=/.test(want)) want = want.replace("<xf ", '<xf applyFill="1" ');
    const i = list.indexOf(want);
    if (i >= 0) return i;
    list.push(want);
    styles = styles.replace(block[0], `<cellXfs count="${list.length}">${list.join("")}</cellXfs>`);
    return list.length - 1;
  }
}

/**
 * Thay một ô trong XML của sheet bằng `make(kiểu cũ, ô cũ)`; ô chưa có (Excel bỏ ô trống khi lưu) thì chèn đúng thứ tự cột
 * và mượn kiểu của ô cùng cột ở dòng trên.
 */
export function patchCell(xml: string, row: number, col: number, make: (style: string | undefined, cell: string | undefined) => string): string {
  const ref = `${colName(col)}${row}`;
  const m = new RegExp(`<row\\b([^>]*?\\br="${row}"[^>]*?)(?:/>|>([\\s\\S]*?)</row>)`).exec(xml);
  if (!m) throw new Error(`Không thấy dòng ${row}`);
  const body = m[2] ?? "";
  const cells = [...body.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)];
  const at = cells.find((c) => new RegExp(`\\br="${ref}"`).test(c[1]));
  const style = at ? /\bs="(\d+)"/.exec(at[1])?.[1]
    : new RegExp(`<c\\b[^>]*?\\br="${colName(col)}${row - 1}"[^>]*?\\bs="(\\d+)"`).exec(xml)?.[1]
      ?? new RegExp(`<c\\b[^>]*?\\bs="(\\d+)"[^>]*?\\br="${colName(col)}${row - 1}"`).exec(xml)?.[1];
  const cell = make(style, at?.[0]);
  let newBody: string;
  if (at) newBody = body.slice(0, at.index) + cell + body.slice(at.index! + at[0].length);
  else {
    const colOf = (attrs: string) => {
      let n = 0;
      for (const ch of /\br="([A-Z]+)\d+"/.exec(attrs)![1]) n = n * 26 + ch.charCodeAt(0) - 64;
      return n - 1;
    };
    const after = cells.find((c) => colOf(c[1]) > col);
    newBody = after ? body.slice(0, after.index) + cell + body.slice(after.index!) : body + cell;
  }
  return xml.slice(0, m.index) + `<row${m[1]}>${newBody}</row>` + xml.slice(m.index + m[0].length);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const path = fileURLToPath(new URL("../../data/he_thong/KhaiTongLapPhai_HeThong_v1.xlsx", import.meta.url));
  if (args[0] === "--mau") {
    const [, fill, sheet, id, ...cols] = args;
    if (!(fill in FILL_COLORS) || !sheet || !id || !cols.length) {
      console.error(`Cách dùng: sua.ts --mau <${Object.keys(FILL_COLORS).join("|")}> "<sheet>" "<dòng>" "<cột>" [...]`);
      process.exit(2);
    }
    const { buf, count } = recolor(readFileSync(path), fill as Exclude<Fill, "none">, sheet, id, cols);
    writeFileSync(path, buf);
    console.log(`Đã đổi màu ${count} ô ở sheet "${sheet}" sang ${fill}; xuất lại JSON để kiểm:`);
  } else {
    const [sheet, id, ...pairs] = args;
    if (!sheet || !id || !pairs.length) {
      console.error('Cách dùng: sua.ts "<sheet>" "<dòng>" "<cột>=<giá trị>" [...]   hoặc   sua.ts --mau <màu> "<sheet>" "<dòng>" "<cột>" [...]');
      process.exit(2);
    }
    const edits = pairs.map((p) => {
      const i = p.indexOf("=");
      if (i < 0) throw new Error(`Thiếu "=" trong "${p}"`);
      return { sheet, id, col: p.slice(0, i).trim(), value: p.slice(i + 1) };
    });
    const { buf, log } = editCells(readFileSync(path), edits);
    writeFileSync(path, buf);
    for (const l of log) console.log(`  ${l}`);
    console.log(`Đã sửa ${log.length} ô trong ${path}; xuất lại JSON:`);
  }
  execFileSync(process.execPath, [...process.execArgv, fileURLToPath(new URL("xuat.ts", import.meta.url))], { stdio: "inherit" });
}

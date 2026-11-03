// Đọc file số liệu Excel (nguồn gốc), xuất JSON cho code vào data/he_thong/json, rồi chạy phép kiểm ở kiem.ts.
// JSON luôn được ghi theo đúng file Excel; có lỗi thì lệnh trả mã 1 để biết mà sửa.
// Chạy: node --experimental-strip-types --no-warnings tools/data/xuat.ts [đường dẫn .xlsx]
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { readXlsx, type SheetIn, type Value } from "./xlsx.ts";
import * as B from "./bang.ts";
import * as TB from "./trang_bi.ts";
import { kiem } from "./kiem.ts";

const ROOT = new URL("../../", import.meta.url);
export const XLSX_URL = new URL("data/he_thong/KhaiTongLapPhai_HeThong_v1.xlsx", ROOT);
export const JSON_URL = new URL("data/he_thong/json/", ROOT);

/** Dòng thô của một sheet bảng: khóa cột → giá trị Excel, kèm số dòng Excel để báo lỗi. */
export interface RawRow { _row: number; [key: string]: Value | number }
export type Raw = Record<string, RawRow[]>;

function need(sheets: Map<string, SheetIn>, name: string): SheetIn {
  const s = sheets.get(name);
  if (!s) throw new Error(`Thiếu sheet "${name}"`);
  return s;
}
const norm = (v: Value) => String(v ?? "").replace(/\s+/g, " ").trim();

function readTable(def: B.TableDef, s: SheetIn): RawRow[] {
  const header = (s.cells[0] ?? []).map(norm);
  const at: Record<string, number> = {};
  for (const c of def.cols) {
    const i = header.indexOf(c.header);
    if (i < 0) {
      if (c.json === false) continue; // cột chỉ để xem, thiếu cũng được
      throw new Error(`Sheet "${def.sheet}" thiếu cột "${c.header}"`);
    }
    at[c.key] = i;
  }
  const idCol = at[def.id];
  const rows: RawRow[] = [];
  for (let r = 1; r < s.cells.length; r++) {
    const line = s.cells[r] ?? [];
    if (line[idCol] === null || line[idCol] === undefined) continue;
    const row: RawRow = { _row: r + 1 };
    for (const [k, i] of Object.entries(at)) row[k] = line[i] ?? null;
    rows.push(row);
  }
  return rows;
}

/** Excel → { tên file JSON: nội dung } và các dòng thô (cho phép kiểm). */
export function convert(sheetList: SheetIn[]): { files: Record<string, unknown>; raw: Raw } {
  const sheets = new Map(sheetList.map((s) => [s.name, s]));
  const raw: Raw = {};
  for (const def of B.SHEETS) if (def.kind === "table") raw[def.sheet] = readTable(def, need(sheets, def.sheet));
  // Sheet trang bị: file cũ chưa có thì bỏ qua
  const tbDefs = TB.PARTS.map((p) => p.def).filter((d) => sheets.has(d.sheet));
  for (const def of tbDefs) raw[def.sheet] = readTable(def, need(sheets, def.sheet));

  const nameToId = (def: B.TableDef): Record<string, string> =>
    Object.fromEntries(raw[def.sheet].map((r) => [norm(r.ten as Value), norm(r[def.id] as Value)]));
  const refs: Record<"he" | "thu_pham", Record<string, string>> = { he: nameToId(B.HE), thu_pham: nameToId(B.THU_PHAM) };
  const relIds = nameToId(B.QUAN_HE);

  const files: Record<string, unknown> = {};
  const tableRows: Record<string, Record<string, unknown>[]> = {};
  for (const def of [...B.SHEETS, ...tbDefs]) {
    if (def.kind === "params") files[def.file] = readParams(need(sheets, def.sheet));
    else if (def.kind === "matrix") files[def.file] = readMatrix(def, need(sheets, def.sheet), refs.he, relIds, files);
    else {
      const rows = raw[def.sheet].map((r) => {
        const o: Record<string, unknown> = {};
        for (const c of def.cols) {
          if (c.json === false || !(c.key in r)) continue;
          const where = `sheet "${def.sheet}" dòng ${r._row}, cột "${c.header}"`;
          let v: unknown;
          try {
            v = B.toJson(c.kind, r[c.key], c.unitCol ? r[c.unitCol] : undefined);
          } catch (e) {
            throw new Error(`${where}: ${(e as Error).message}`);
          }
          if (v !== undefined && c.ref) {
            const map = refs[c.ref];
            const conv = (n: string) => {
              if (!(n in map)) throw new Error(`${where}: không có "${n}" trong sheet ${c.ref === "he" ? "Hệ" : "Thú phẩm"}`);
              return map[n];
            };
            v = Array.isArray(v) ? v.map(conv) : conv(v as string);
          }
          if (v === undefined) {
            if (c.nullable) v = null;
            else if (c.optional) continue;
            else throw new Error(`${where}: ô trống`);
          }
          B.setPath(o, c.json ?? c.key, v);
        }
        return o;
      });
      tableRows[def.sheet] = rows;
      if (def.file) files[def.file] = def.shape === "list" ? rows : Object.fromEntries(rows.map((o) => [String(o[def.cols.find((c) => c.key === def.id)!.json || def.id]), o]));
    }
  }
  postProcess(files);
  Object.assign(files, TB.assemble(tableRows));
  return { files, raw };
}

function readParams(s: SheetIn): Record<string, Record<string, unknown>> {
  const header = (s.cells[0] ?? []).map(norm);
  const col = (h: string) => {
    const i = header.indexOf(h);
    if (i < 0) throw new Error(`Sheet "${s.name}" thiếu cột "${h}"`);
    return i;
  };
  const [g, k, v, t] = [col("Nhóm"), col("Khóa"), col("Giá trị"), col("Kiểu")];
  const out: Record<string, Record<string, unknown>> = {};
  const seen = new Set<string>();
  for (let r = 1; r < s.cells.length; r++) {
    const line = s.cells[r] ?? [];
    const key = norm(line[k]);
    if (!key) continue;
    if (seen.has(key)) throw new Error(`Sheet "${s.name}": khóa "${key}" bị trùng (dòng ${r + 1})`);
    seen.add(key);
    try {
      (out[norm(line[g])] ??= {})[key] = B.paramToJson(norm(line[t]), line[v]);
    } catch (e) {
      throw new Error(`Sheet "${s.name}" dòng ${r + 1} (${key}): ${(e as Error).message}`);
    }
  }
  return out;
}

function readMatrix(def: B.MatrixDef, s: SheetIn, he: Record<string, string>, rel: Record<string, string>, files: Record<string, unknown>): unknown {
  const head = s.cells[0] ?? [];
  const id = (name: Value, where: string) => {
    const n = norm(name);
    if (!(n in he)) throw new Error(`Sheet "${def.sheet}" ${where}: "${n}" không phải tên hệ`);
    return he[n];
  };
  const cols = head.slice(1).map((n, i) => id(n, `cột ${i + 2}`));
  const grid: Record<string, Record<string, unknown>> = {};
  for (let r = 1; r < s.cells.length; r++) {
    const line = s.cells[r] ?? [];
    if (line[0] === null || line[0] === undefined) continue;
    const a = id(line[0], `dòng ${r + 1}`);
    grid[a] = {};
    cols.forEach((b, i) => {
      const v = line[i + 1];
      if (v === null || v === undefined) throw new Error(`Sheet "${def.sheet}" dòng ${r + 1}: ô trống ở cột ${head[i + 1]}`);
      if (def.cell === "mul") grid[a][b] = B.toJson("mul", v);
      else {
        const n = norm(v);
        if (!(n in rel)) throw new Error(`Sheet "${def.sheet}" dòng ${r + 1}: "${n}" không có trong sheet Quan hệ tổ hợp`);
        grid[a][b] = rel[n];
      }
    });
  }
  if (def.cell === "mul") return grid;
  const kinds = files[B.QUAN_HE.file] as Record<string, { t: number; manaMul: number }>;
  const combo: Record<string, Record<string, { t: number; manaMul: number }>> = {};
  for (const [a, row] of Object.entries(grid)) {
    combo[a] = {};
    for (const [b, r] of Object.entries(row)) combo[a][b] = { t: kinds[r as string].t, manaMul: kinds[r as string].manaMul };
  }
  return { relation: grid, combo };
}

/** Trường tính thêm cho code đỡ phải tự suy: hệ, loại, biến thể của tàn quyển; trọng số rơi theo hệ của vùng. */
function postProcess(files: Record<string, unknown>): void {
  for (const s of files[B.TAN_QUYEN.file] as Record<string, unknown>[]) {
    const [element, type, variant] = String(s.id).split(".");
    Object.assign(s, { element, type, variant });
  }
  for (const r of files[B.CONG_PHAP.file] as Record<string, unknown>[]) {
    r.subs = [r.sub1, r.sub2].filter(Boolean);
    delete r.sub1;
    delete r.sub2;
  }
  for (const r of Object.values(files[B.VUNG.file] as Record<string, Record<string, unknown>>)) {
    const els = r.dropElements as string[];
    const main = r.dropMainShare as number | undefined;
    const w: Record<string, number> = {};
    if (main !== undefined && els.length > 1) {
      w[els[0]] = main;
      split(1000 - main, els.slice(1), w);
    } else split(1000, els, w);
    r.dropWeights = w;
  }
}
/** Chia `total` phần nghìn đều cho các hệ, phần dư cho các hệ đầu, để tổng luôn đúng. */
function split(total: number, els: string[], into: Record<string, number>): void {
  const base = Math.floor(total / els.length);
  els.forEach((e, i) => { into[e] = base + (i < total - base * els.length ? 1 : 0); });
}

/** JSON dễ đọc khi xem diff: object, mảng ngắn nằm trên một dòng. */
export function pretty(v: unknown, indent = ""): string {
  const flat = JSON.stringify(v);
  if (v === null || typeof v !== "object" || flat.length + indent.length <= 120) return flat;
  const next = indent + "  ";
  if (Array.isArray(v)) return `[\n${v.map((x) => next + pretty(x, next)).join(",\n")}\n${indent}]`;
  return `{\n${Object.entries(v).map(([k, x]) => `${next}${JSON.stringify(k)}: ${pretty(x, next)}`).join(",\n")}\n${indent}}`;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const path = process.argv[2] ?? fileURLToPath(XLSX_URL);
  const sheets = readXlsx(readFileSync(path));
  const { files, raw } = convert(sheets);
  mkdirSync(JSON_URL, { recursive: true });
  for (const f of readdirSync(JSON_URL)) if (f.endsWith(".json") && !(f in files)) rmSync(new URL(f, JSON_URL));
  for (const [f, v] of Object.entries(files)) writeFileSync(new URL(f, JSON_URL), pretty(v) + "\n");
  console.log(`Đã xuất ${Object.keys(files).length} file JSON vào ${fileURLToPath(JSON_URL)}`);
  const { errors, warnings, notes } = kiem(files, raw);
  for (const n of notes) console.log(`  ✓ ${n}`);
  for (const w of warnings) console.log(`  ! ${w}`);
  for (const e of errors) console.log(`  ✗ ${e}`);
  console.log(`Kiểm: ${errors.length} lỗi, ${warnings.length} chỗ khác code hoặc GDD cần xem.`);
  if (errors.length) process.exit(1);
}

// Tính lại các ô công thức của file số liệu, để sau khi sua.ts hay them.ts sửa ô đầu vào thì giá trị lưu sẵn vẫn đúng mà không
// cần mở Excel (máy dev không có Excel). Hiểu tập hàm file này dùng: INDEX, MATCH (kiểu 0), IF, ROUND, POWER, INT, MIN, MAX,
// LEFT, MID, FIND, các phép + − × ÷ ^ & và so sánh. Công thức có hàm khác thì giữ nguyên giá trị Excel đã lưu.
import { readFiles, sheetParts, colName, esc, type SheetIn, type Value } from "./xlsx.ts";

type Range = { sheet: string; r1: number; c1: number; r2: number; c2: number };
type V = Value | Range;
type Node = { k: "v"; v: V } | { k: "ref"; t: string } | { k: "neg"; a: Node } | { k: "op"; op: string; a: Node; b: Node } | { k: "fn"; name: string; args: Node[] };

class Unsupported extends Error {}

const colNum = (s: string) => { let c = 0; for (const ch of s) c = c * 26 + ch.charCodeAt(0) - 64; return c - 1; };

function tokenize(f: string): string[] {
  const re = /\s*('(?:[^']|'')+'!|[A-Za-z_][\w.]*!)?(\$?[A-Z]{1,3}\$?\d+(?::\$?[A-Z]{1,3}\$?\d+)?|\$?[A-Z]{1,3}:\$?[A-Z]{1,3}|\$?\d+:\$?\d+)|\s*("(?:[^"]|"")*"|\d+(?:\.\d+)?(?:E[+-]?\d+)?|[A-Z][A-Z0-9.]*\(|>=|<=|<>|[-+*/^&=<>(),])/gy;
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while (re.lastIndex < f.length && (m = re.exec(f))) out.push(m[2] ? `REF:${m[1] ?? ""}${m[2]}` : m[3]);
  if (re.lastIndex < f.length) throw new Unsupported(`không tách được công thức tại: ${f.slice(re.lastIndex, re.lastIndex + 20)}`);
  return out;
}

function parse(f: string): Node {
  const t = tokenize(f);
  let i = 0;
  const peek = () => t[i], next = () => t[i++];
  const primary = (): Node => {
    const k = next();
    if (k === undefined) throw new Unsupported("công thức cụt");
    if (k === "(") { const v = expr(); next(); return v; }
    if (k === "-") return { k: "neg", a: primary() };
    if (k === "+") return primary();
    if (k.startsWith("REF:")) return { k: "ref", t: k.slice(4) };
    if (k.startsWith('"')) return { k: "v", v: k.slice(1, -1).replace(/""/g, '"') };
    if (/^\d/.test(k)) return { k: "v", v: Number(k) };
    if (k.endsWith("(")) {
      const name = k.slice(0, -1), args: Node[] = [];
      if (peek() !== ")") { args.push(expr()); while (peek() === ",") { next(); args.push(expr()); } }
      next();
      return { k: "fn", name, args };
    }
    throw new Unsupported(`ký hiệu lạ ${k}`);
  };
  const bin = (sub: () => Node, ops: string[]) => () => {
    let a = sub();
    while (ops.includes(peek())) { const op = next(); a = { k: "op", op, a, b: sub() }; }
    return a;
  };
  const pow = bin(primary, ["^"]), mulDiv = bin(pow, ["*", "/"]), addSub = bin(mulDiv, ["+", "-"]), concat = bin(addSub, ["&"]);
  const expr = bin(concat, ["=", "<>", ">=", "<=", ">", "<"]);
  const tree = expr();
  if (i !== t.length) throw new Unsupported(`thừa ${t.slice(i).join(" ")}`);
  return tree;
}

/** Tính lại mọi ô công thức (trong bộ nhớ). Trả các ô có giá trị đổi: "sheet\tr,c" → giá trị mới. */
export function recalc(sheets: SheetIn[]): Map<string, Value> {
  const byName = new Map(sheets.map((s) => [s.name, s]));
  const memo = new Map<string, Value>(), busy = new Set<string>(), changed = new Map<string, Value>();
  const trees = new Map<string, Node>();

  const valueAt = (sheet: string, r: number, c: number): Value => {
    const s = byName.get(sheet)!;
    const f = s.formulas[r]?.[c];
    if (!f) return s.cells[r]?.[c] ?? null;
    const key = `${sheet}\t${r},${c}`;
    if (memo.has(key)) return memo.get(key)!;
    if (busy.has(key)) throw new Unsupported(`vòng lặp ở ${sheet}!${colName(c)}${r + 1}`);
    busy.add(key);
    try {
      let tree = trees.get(f);
      if (!tree) { tree = parse(f); trees.set(f, tree); }
      const v = val(evalNode(tree, sheet));
      memo.set(key, v);
      return v;
    } finally {
      busy.delete(key);
    }
  };
  const refRange = (tok: string, here: string): Range => {
    let s = tok, sheet = here;
    const bang = s.lastIndexOf("!");
    if (bang >= 0) {
      let name = s.slice(0, bang);
      if (name.startsWith("'")) name = name.slice(1, -1).replace(/''/g, "'");
      if (!byName.has(name)) throw new Unsupported(`không có sheet ${name}`);
      sheet = name;
      s = s.slice(bang + 1);
    }
    s = s.replace(/\$/g, "");
    const [a, b = a] = s.split(":");
    const maxR = byName.get(sheet)!.cells.length - 1, maxC = 200;
    const p = (x: string, end: boolean) => {
      const m = /^([A-Z]*)(\d*)$/.exec(x)!;
      return { r: m[2] ? Number(m[2]) - 1 : end ? maxR : 0, c: m[1] ? colNum(m[1]) : end ? maxC : 0 };
    };
    const lo = p(a, false), hi = p(b, true);
    return { sheet, r1: lo.r, c1: lo.c, r2: hi.r, c2: hi.c };
  };
  const at = (rg: Range, r: number, c: number) => valueAt(rg.sheet, r, c);
  const val = (v: V): Value => (v !== null && typeof v === "object" ? at(v, v.r1, v.c1) : v);
  const num = (v: V): number => {
    const x = val(v);
    if (typeof x === "string" && x.startsWith("#")) throw new Unsupported(`lỗi ${x}`);
    return x === null || x === "" ? 0 : Number(x);
  };
  const str = (v: V): string => { const x = val(v); return x === null ? "" : String(x); };
  const key = (x: Value) => (typeof x === "string" ? x.toLowerCase() : x);

  const call = (name: string, a: V[]): V => {
    switch (name) {
      case "INDEX": {
        const rg = a[0] as Range, r = num(a[1]), c = a.length > 2 ? num(a[2]) : 1;
        return at(rg, rg.r1 + r - 1, rg.c1 + c - 1);
      }
      case "MATCH": {
        const want = key(val(a[0])), rg = a[1] as Range;
        if (a.length > 2 && num(a[2]) !== 0) throw new Unsupported("MATCH không phải kiểu 0");
        if (rg.r1 === rg.r2) { for (let c = rg.c1; c <= rg.c2; c++) if (key(at(rg, rg.r1, c)) === want) return c - rg.c1 + 1; }
        else for (let r = rg.r1; r <= rg.r2; r++) if (key(at(rg, r, rg.c1)) === want) return r - rg.r1 + 1;
        throw new Unsupported(`#N/A: MATCH không thấy ${String(want)}`);
      }
      case "ROUND": { const d = num(a[1]), k = 10 ** d, x = num(a[0]); return (Math.sign(x) * Math.round(Math.abs(x) * k)) / k; }
      case "POWER": return num(a[0]) ** num(a[1]);
      case "INT": return Math.floor(num(a[0]));
      case "MIN": case "MAX": {
        const xs: number[] = [];
        for (const x of a) {
          if (x !== null && typeof x === "object") {
            for (let r = x.r1; r <= x.r2; r++) for (let c = x.c1; c <= Math.min(x.c2, x.c1 + 50); c++) { const v = at(x, r, c); if (typeof v === "number") xs.push(v); }
          } else xs.push(num(x));
        }
        return name === "MIN" ? Math.min(...xs) : Math.max(...xs);
      }
      case "LEFT": return str(a[0]).slice(0, num(a[1]));
      case "MID": return str(a[0]).substr(num(a[1]) - 1, num(a[2]));
      case "FIND": { const p = str(a[1]).indexOf(str(a[0]), a.length > 2 ? num(a[2]) - 1 : 0); if (p < 0) throw new Unsupported("#VALUE: FIND"); return p + 1; }
    }
    throw new Unsupported(`hàm ${name} chưa hỗ trợ`);
  };
  const evalNode = (n: Node, here: string): V => {
    switch (n.k) {
      case "v": return n.v;
      case "ref": return refRange(n.t, here);
      case "neg": return -num(evalNode(n.a, here));
      case "fn": {
        if (n.name === "IF") {
          const c = val(evalNode(n.args[0], here));
          return (typeof c === "boolean" ? c : num(c) !== 0) ? val(evalNode(n.args[1], here)) : n.args[2] ? val(evalNode(n.args[2], here)) : false;
        }
        return call(n.name, n.args.map((x) => evalNode(x, here)));
      }
      case "op": {
        const a = evalNode(n.a, here), b = evalNode(n.b, here);
        switch (n.op) {
          case "+": return num(a) + num(b);
          case "-": return num(a) - num(b);
          case "*": return num(a) * num(b);
          case "/": return num(a) / num(b);
          case "^": return num(a) ** num(b);
          case "&": return str(a) + str(b);
        }
        const x = val(a), y = val(b);
        const cmp = typeof x === "number" || typeof y === "number" ? num(a) - num(b)
          : str(a).toLowerCase() < str(b).toLowerCase() ? -1 : str(a).toLowerCase() > str(b).toLowerCase() ? 1 : 0;
        return ({ "=": cmp === 0, "<>": cmp !== 0, ">=": cmp >= 0, "<=": cmp <= 0, ">": cmp > 0, "<": cmp < 0 } as Record<string, boolean>)[n.op];
      }
    }
  };

  for (const s of sheets) s.formulas.forEach((row, r) => row?.forEach((f, c) => {
    if (!f) return;
    let v: Value;
    try { v = valueAt(s.name, r, c); } catch (e) { if (e instanceof Unsupported) return; throw e; }
    const old = s.cells[r]?.[c] ?? null;
    const same = typeof v === "number" && typeof old === "number" ? Math.abs(v - old) <= 1e-12 * Math.max(1, Math.abs(old)) : (v ?? "") === (old ?? "");
    if (!same) changed.set(`${s.name}\t${r},${c}`, v);
  }));
  // Ghi giá trị mới vào bản đọc để các bước sau (xuất JSON) thấy số mới
  for (const [k, v] of changed) {
    const [name, rc] = k.split("\t"), [r, c] = rc.split(",").map(Number);
    (byName.get(name)!.cells[r] ??= [])[c] = v;
  }
  return changed;
}

/** Tính lại và ghi giá trị mới vào XML của gói (giữ nguyên thẻ <f>, kể cả công thức chung). Trả số ô đổi. */
export function recalcFiles(files: Map<string, Buffer>): number {
  const sheets = readFiles(files);
  const changed = recalc(sheets);
  if (!changed.size) return 0;
  const parts = new Map(sheetParts(files));
  const bySheet = new Map<string, Map<string, Value>>();
  for (const [k, v] of changed) {
    const [name, rc] = k.split("\t"), [r, c] = rc.split(",").map(Number);
    if (!bySheet.has(name)) bySheet.set(name, new Map());
    bySheet.get(name)!.set(`${colName(c)}${r + 1}`, v);
  }
  for (const [name, refs] of bySheet) {
    const part = parts.get(name)!;
    const xml = files.get(part)!.toString("utf8").replace(/<c\b([^>]*?)>(<f\b[^>]*?(?:\/>|>[\s\S]*?<\/f>))(?:<v>[\s\S]*?<\/v>)?<\/c>/g, (m, attrs: string, f: string) => {
      const ref = /\br="([A-Z]+\d+)"/.exec(attrs)?.[1];
      if (!ref || !refs.has(ref)) return m;
      const v = refs.get(ref)!;
      const base = attrs.replace(/\s+t="[^"]*"/, "");
      if (typeof v === "number") return `<c${base}>${f}<v>${v}</v></c>`;
      if (typeof v === "boolean") return `<c${base} t="b">${f}<v>${v ? 1 : 0}</v></c>`;
      return `<c${base} t="str">${f}<v>${esc(String(v ?? ""))}</v></c>`;
    });
    files.set(part, Buffer.from(xml));
  }
  return changed.size;
}

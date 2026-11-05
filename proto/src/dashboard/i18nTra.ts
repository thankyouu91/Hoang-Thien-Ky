// Bộ tra dịch của i18n.ts, không đụng DOM để chạy được bằng node --test.
// Thứ tự: chữ cố định → mẫu có biến "{}" (mẫu nhiều chữ cố định thử trước; phần biến dịch tiếp nếu có trong bảng, số và
// tên người giữ nguyên) → chuỗi nối bằng " · " dịch từng phần. Không dịch được thì trả nguyên và ghi vào danh sách thiếu.

/** Có chữ cái tiếng Việt có dấu. */
export const VI_CHAR = /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i;

const norm = (s: string) => s.replace(/\s+/g, " ").trim();
const reEsc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

interface Mau {
  re: RegExp;
  out: string;
  lit: number;
  /** Phần cố định chỉ là ký hiệu ("{}: {}"): chỉ nhận khi dịch được ít nhất một phần biến, để chữ chưa có trong bảng vẫn
   *  lộ ra ở danh sách thiếu thay vì bị coi là đã dịch. */
  sym: boolean;
}

export class BoTra {
  private exact = new Map<string, string>();
  private mau: Mau[] = [];
  readonly thieu = new Map<string, number>();
  readonly thieuPhan = new Map<string, number>();

  constructor(d: Record<string, string>) {
    for (const [k, v] of Object.entries(d)) {
      if (!k.includes("{}")) {
        this.exact.set(norm(k), v);
        continue;
      }
      // Mẫu chỉ có biến và khoảng trắng ("{} {}") bỏ đi.
      const lit = norm(k.replace(/\{\}/g, " "));
      if (!lit) continue;
      const re = new RegExp("^" + norm(k).split("{}").map(reEsc).join("(.+?)") + "$", "su");
      this.mau.push({ re, out: v, lit: lit.length, sym: !/\p{L}/u.test(lit) });
    }
    this.mau.sort((a, b) => b.lit - a.lit);
  }

  /** Nên thử dịch chuỗi này không (có chữ Việt có dấu, hoặc là khóa cố định như "Thua"). */
  can(s: string): boolean {
    return VI_CHAR.test(s) || this.exact.has(norm(s));
  }

  /** Dịch, giữ khoảng trắng đầu và cuối; không dịch được thì trả nguyên. */
  tr(s: string): string {
    const core = norm(s);
    if (!core) return s;
    const t = this.core(core, 0);
    if (t === undefined) {
      if (VI_CHAR.test(core)) this.thieu.set(core, (this.thieu.get(core) ?? 0) + 1);
      return s;
    }
    return (/^\s*/.exec(s)?.[0] ?? "") + t + (/\s*$/.exec(s)?.[0] ?? "");
  }

  private core(core: string, depth: number): string | undefined {
    const e = this.exact.get(core);
    if (e !== undefined) return e;
    if (depth > 3) return undefined;
    for (const p of this.mau) {
      const m = p.re.exec(core);
      if (!m) continue;
      const raw = m.slice(1);
      const g = raw.map((x) => this.part(x, depth));
      if (p.sym && g.every((x, j) => x === raw[j])) continue;
      let i = 0;
      return p.out.replace(/\{(\d*)\}/g, (_x, n: string) => g[n ? Number(n) - 1 : i++] ?? "");
    }
    // Đoạn chữ nối tiếp phần tử trước hoặc sau bằng dấu "·" ("· 10 đấu 10 · 2 giờ trước").
    if (core.startsWith("· ")) {
      const t = this.core(core.slice(2), depth + 1);
      return t === undefined ? undefined : `· ${t}`;
    }
    if (core.endsWith(" ·")) {
      const t = this.core(core.slice(0, -2), depth + 1);
      return t === undefined ? undefined : `${t} ·`;
    }
    if (core.includes(" · ")) {
      const parts = core.split(" · ");
      const out = parts.map((x) => this.core(x.trim(), depth + 1));
      if (out.some((x) => x !== undefined)) return out.map((x, i) => x ?? parts[i]).join(" · ");
    }
    return undefined;
  }

  /** Phần biến trong mẫu: số và chữ không dấu giữ nguyên; chữ có trong bảng thì dịch; tên người không có thì giữ. */
  private part(x: string, depth: number): string {
    const c = norm(x);
    if (!c || !this.can(c)) return x;
    const t = this.core(c, depth + 1);
    if (t === undefined) this.thieuPhan.set(c, (this.thieuPhan.get(c) ?? 0) + 1);
    return t ?? x;
  }
}

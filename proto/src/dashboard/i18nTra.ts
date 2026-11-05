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

/** Từ điển âm tiết (i18n/am_tiet.json) cho tên ghép "âm tiết + âm tiết + hậu tố" (tên bản đồ, tông NPC). */
export interface AmTiet {
  am: Record<string, string>;
  hau_to: Record<string, string>;
}

export class BoTra {
  private exact = new Map<string, string>();
  private mau: Mau[] = [];
  private am?: AmTiet;
  private hauToSap: string[] = [];
  readonly thieu = new Map<string, number>();
  readonly thieuPhan = new Map<string, number>();

  constructor(d: Record<string, string>, amTiet?: AmTiet) {
    if (amTiet) {
      this.am = amTiet;
      this.hauToSap = Object.keys(amTiet.hau_to).sort((a, b) => b.split(" ").length - a.split(" ").length);
    }
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

  /** Nên thử dịch chuỗi này không (có chữ Việt có dấu, là khóa cố định như "Thua", hoặc tên ghép như "Ma Linh Quan"). */
  can(s: string): boolean {
    const c = norm(s);
    return VI_CHAR.test(c) || this.exact.has(c) || this.ghep(c) !== undefined;
  }

  /** Tên ghép theo khuôn: đúng hai âm tiết có trong từ điển rồi một hậu tố ("Lôi Hạc Động" → "Thunder Crane Cave"). */
  private ghep(core: string): string | undefined {
    const am = this.am;
    if (!am) return undefined;
    const w = core.split(" ");
    if (w.length < 3 || w.length > 4) return undefined;
    for (const h of this.hauToSap) {
      if (w.length !== h.split(" ").length + 2 || w.slice(2).join(" ") !== h) continue;
      const a = am.am[w[0]];
      const b = am.am[w[1]];
      if (a && b) return `${a} ${b} ${am.hau_to[h]}`;
    }
    return undefined;
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
    const ten = this.ghep(core);
    if (ten !== undefined) return ten;
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

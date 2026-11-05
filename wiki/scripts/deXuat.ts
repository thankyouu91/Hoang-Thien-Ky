// Đọc file số liệu Excel (data/he_thong/KhaiTongLapPhai_HeThong_v1.xlsx) để biết cột nào còn số "đề xuất".
// Quy ước của file (data/he_thong/README.md): ô nền vàng FFF2CC là đề xuất chờ duyệt, xanh lá là theo GDD, xanh dương là
// theo code. JSON xuất ra không giữ màu, nên wiki đọc thẳng màu ô để gắn nhãn "đang thử nghiệm, có thể đổi".
// Dùng unzip và sheetParts của tools/data/xlsx.ts (chỉ đọc, không sửa file đó).
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { join } from "node:path";

export interface CotDeXuat {
  /** Số ô số (không phải chữ) tô vàng trong cột. */
  so: number;
  /** Số ô chữ tô vàng (tên, mô tả đặt tạm). */
  chu: number;
}
/** sheet → tiêu đề cột (dòng 1) → số ô đề xuất. */
export type BangDeXuat = Map<string, Map<string, CotDeXuat>>;

const VANG = "FFFFF2CC";

function giai(s: string): string {
  return s
    .replace(/_x([0-9A-Fa-f]{4})_/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&#x([0-9A-Fa-f]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
}

function chuCua(xml: string): string {
  return [...xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, "").matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => giai(m[1])).join("");
}

function cot(ref: string): number {
  let c = 0;
  for (const ch of /^[A-Z]+/.exec(ref)![0]) c = c * 26 + ch.charCodeAt(0) - 64;
  return c - 1;
}

export async function docDeXuat(repo: string): Promise<BangDeXuat> {
  const xlsx = await import(pathToFileURL(join(repo, "tools/data/xlsx.ts")).href);
  const files: Map<string, Buffer> = xlsx.unzip(readFileSync(join(repo, "data/he_thong/KhaiTongLapPhai_HeThong_v1.xlsx")));
  const styles = files.get("xl/styles.xml")!.toString("utf8");
  const fills = [.../<fills\b[^>]*>([\s\S]*?)<\/fills>/.exec(styles)![1].matchAll(/<fill>[\s\S]*?<\/fill>|<fill\/>/g)].map(
    (m) => /rgb="([0-9A-Fa-f]+)"/.exec(m[0])?.[1]?.toUpperCase(),
  );
  const xfFill = [.../<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/.exec(styles)![1].matchAll(/<xf\b([^>]*?)(?:\/>|>)/g)].map((m) =>
    Number(/fillId="(\d+)"/.exec(m[1])?.[1] ?? 0),
  );
  const ss = files.get("xl/sharedStrings.xml")?.toString("utf8") ?? "";
  const chuChung = [...ss.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => chuCua(m[1]));

  const out: BangDeXuat = new Map();
  for (const [ten, duong] of xlsx.sheetParts(files) as [string, string][]) {
    const xml = files.get(duong)!.toString("utf8");
    const tieuDe: string[] = [];
    const dem = new Map<number, CotDeXuat>();
    for (const [, r, than] of xml.matchAll(/<row\b[^>]*?\br="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) {
      for (const c of than.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const a = c[1];
        const ref = /\br="([A-Z]+\d+)"/.exec(a)?.[1];
        if (!ref) continue;
        const ci = cot(ref);
        const kieu = /\bt="(\w+)"/.exec(a)?.[1];
        const v = /<v>([\s\S]*?)<\/v>/.exec(c[2] ?? "")?.[1];
        if (r === "1") {
          tieuDe[ci] = kieu === "s" ? chuChung[Number(v)] : kieu === "inlineStr" ? chuCua(c[2] ?? "") : (v ?? "");
          continue;
        }
        const s = Number(/\bs="(\d+)"/.exec(a)?.[1] ?? 0);
        if (fills[xfFill[s]] !== VANG) continue;
        if (v === undefined && kieu !== "inlineStr") continue; // ô trống tô màu sẵn
        const d = dem.get(ci) ?? { so: 0, chu: 0 };
        if (kieu === "s" || kieu === "inlineStr" || kieu === "str" || kieu === "b") d.chu++;
        else d.so++;
        dem.set(ci, d);
      }
    }
    // Giữ cả cột không có ô vàng (0, 0) để sinh.ts kiểm được tên tiêu đề có thật.
    const m = new Map<string, CotDeXuat>();
    tieuDe.forEach((h, ci) => h && m.set(h.trim(), { so: 0, chu: 0 }));
    for (const [ci, d] of dem) m.set((tieuDe[ci] ?? `#${ci}`).trim(), d);
    out.set(ten, m);
  }
  return out;
}

// Chạy riêng để xem: node scripts/deXuat.ts [tên sheet…]
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const repo = join(import.meta.dirname, "..", "..");
  const bang = await docDeXuat(repo);
  const chon = process.argv.slice(2);
  for (const [sheet, cots] of bang) {
    if (chon.length && !chon.includes(sheet)) continue;
    if (!cots.size) continue;
    console.log(sheet);
    for (const [h, d] of cots) if (d.so + d.chu || chon.length) console.log(`  ${h}: ${d.so} số, ${d.chu} chữ`);
  }
}

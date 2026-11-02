// 12 hệ và luật khắc chế theo GDD mục 8 (hệ số theo phần nghìn).
import { DI_HE_COUNTERS } from "./config.ts";

export const ELEMENTS = [
  "kim", "moc", "thuy", "hoa", "tho",
  "loi", "phong", "cuc_duong", "cuc_am", "cuc_han",
  "quang", "am_lanh",
] as const;
export type Element = (typeof ELEMENTS)[number];

/** Hệ biến dị -> hệ gốc */
const PARENT: Partial<Record<Element, Element>> = {
  loi: "kim", phong: "moc", cuc_han: "thuy", cuc_duong: "hoa", cuc_am: "tho",
};
/** Ngũ Hành khắc: A khắc B */
const BEATS: Partial<Record<Element, Element>> = {
  kim: "moc", moc: "tho", tho: "thuy", thuy: "hoa", hoa: "kim",
};
/** Ngũ Hành sinh: A sinh B (Mộc → Hỏa → Thổ → Kim → Thủy → Mộc) */
const GENERATES: Partial<Record<Element, Element>> = {
  moc: "hoa", hoa: "tho", tho: "kim", kim: "thuy", thuy: "moc",
};
const OPPOSITE: Partial<Record<Element, Element>> = {
  cuc_duong: "cuc_am", cuc_am: "cuc_duong", quang: "am_lanh", am_lanh: "quang",
};

/** Hệ biến dị quy về hệ gốc; hệ khác giữ nguyên. */
export function baseElement(e: Element): Element {
  return PARENT[e] ?? e;
}
export function parentOf(e: Element): Element | undefined {
  return PARENT[e];
}
export function isOpposite(a: Element, b: Element): boolean {
  return OPPOSITE[a] === b;
}
/** Hai hệ gốc Ngũ Hành sinh nhau theo một trong hai chiều. */
export function generatesEither(a: Element, b: Element): boolean {
  return GENERATES[a] === b || GENERATES[b] === a;
}
/** Khắc một chiều thêm cho thiên địa dị hệ (config.ts), xét trên hệ gốc. */
function diHeBeats(a: Element, b: Element): boolean {
  for (const [x, y] of DI_HE_COUNTERS) if (x === a && y === b) return true;
  return false;
}
/** Hai hệ gốc Ngũ Hành khắc nhau theo một trong hai chiều; khắc thêm của dị hệ chỉ áp trong trận, không áp khi ghép công pháp. */
export function beatsEither(a: Element, b: Element): boolean {
  return BEATS[a] === b || BEATS[b] === a;
}

/** Hệ số sát thương khi hệ `atk` đánh hệ `def`, theo phần nghìn. */
export function elementMultiplier(atk: Element, def: Element): number {
  if (OPPOSITE[atk] === def) return 1500; // đối cực hai chiều
  if (PARENT[atk] === def) return 1200; // biến dị đánh hệ gốc
  if (PARENT[def] === atk) return 900; // hệ gốc đánh biến dị
  const a = baseElement(atk), d = baseElement(def);
  if (diHeBeats(a, d)) return 1500; // khắc thêm của dị hệ
  if (diHeBeats(d, a)) return 700;
  if (a === "quang" || a === "am_lanh" || d === "quang" || d === "am_lanh") return 1000;
  if (BEATS[a] === d) return 1500; // khắc
  if (BEATS[d] === a) return 700; // bị khắc
  return 1000;
}

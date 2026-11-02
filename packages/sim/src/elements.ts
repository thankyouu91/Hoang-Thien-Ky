// 12 hệ và luật khắc chế theo GDD mục 8 (hệ số theo phần nghìn).
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
const OPPOSITE: Partial<Record<Element, Element>> = {
  cuc_duong: "cuc_am", cuc_am: "cuc_duong", quang: "am_lanh", am_lanh: "quang",
};

function base(e: Element): Element {
  return PARENT[e] ?? e;
}

/** Hệ số sát thương khi hệ `atk` đánh hệ `def`, theo phần nghìn. */
export function elementMultiplier(atk: Element, def: Element): number {
  if (OPPOSITE[atk] === def) return 1500; // đối cực hai chiều
  if (PARENT[atk] === def) return 1200; // biến dị đánh hệ gốc
  if (PARENT[def] === atk) return 900; // hệ gốc đánh biến dị
  const a = base(atk), d = base(def);
  if (a === "quang" || a === "am_lanh" || d === "quang" || d === "am_lanh") return 1000;
  if (BEATS[a] === d) return 1500; // khắc
  if (BEATS[d] === a) return 700; // bị khắc
  return 1000;
}

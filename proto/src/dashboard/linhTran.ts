// Linh trận (tên tạm): bàn ô lục giác ở màn Nhân vật để đặt đồ bổ trợ kích thêm set đồ. Người dùng yêu cầu 2026-11-03
// ("xây các ô cho phép bỏ đồ bổ trợ vào để kích thêm ... mỗi cách tu luyện sẽ có hình nền khác nhau").
// File này không import three: bố cục ô, luật nối tạm và trạng thái mẫu, dùng chung cho lớp nút DOM và cảnh three
// (art/linhTranScene.ts). Luật và số là TẠM, chờ đặc tả của phiên set đồ; trạng thái sẽ chuyển sang DashboardSource.
import { beatsEither, generatesEither, type Element } from "@ktlp/sim";
import setData from "../../../data/he_thong/json/set.json";

/** Ô theo toạ độ trục (q, r) của lưới lục giác đỉnh nhọn; vòng 0 là ô tâm. */
export interface HexCell {
  id: number;
  q: number;
  r: number;
  ring: number;
}

export type TranItemKind = "an" | "ngoc";

export interface TranItem {
  kind: TranItemKind;
  name: string;
  /** Ấn bộ: mã bộ trong set.json. */
  set?: string;
  element?: Element;
  /** Mã ảnh icon vẽ (assets/icon_ve) nếu có. */
  art?: string;
}

export interface TranState {
  /** Cách tu luyện quyết định nền (tạm hiểu là tài năng). */
  path: string;
  open: number[];
  items: Record<number, TranItem>;
  /** Ấn bộ trên đồ đang mặc, đếm cùng ấn trên bàn. */
  gearSeals: Record<string, number>;
}

export type LinkKind = "mach" | "sinh" | "khac";

export interface TranLink {
  a: number;
  b: number;
  kind: LinkKind;
}

interface SetInfo {
  id: string;
  ten: string;
  gan_voi: { he?: string | string[] };
  moc: { so: number; mo_ta: string }[];
}

const SETS = new Map<string, SetInfo>((setData as { bo: SetInfo[] }).bo.map((b) => [b.id, b]));
export const SET_TIERS: number[] = (setData as { moc: number[] }).moc;

export function setName(id: string): string {
  return SETS.get(id)?.ten ?? id;
}

/** Hệ đại diện của một bộ (bộ gắn hệ), để xét tương sinh, tương khắc khi hai ô kề nhau. */
export function setElement(id: string): Element | undefined {
  const he = SETS.get(id)?.gan_voi.he;
  const e = Array.isArray(he) ? he[0] : he;
  return e && !["theo_linh_can", "moi_he"].includes(e) ? (e as Element) : undefined;
}

export function setTierText(id: string, so: number): string {
  return SETS.get(id)?.moc.find((m) => m.so === so)?.mo_ta ?? "";
}

/** 19 ô: tâm, 6 ô vòng trong, 12 ô vòng ngoài; trong mỗi vòng xếp theo chiều kim đồng hồ từ đỉnh. */
export const CELLS: HexCell[] = (() => {
  const out: Omit<HexCell, "id">[] = [];
  for (let q = -2; q <= 2; q++)
    for (let r = -2; r <= 2; r++) {
      const s = -q - r;
      if (Math.abs(s) <= 2) out.push({ q, r, ring: Math.max(Math.abs(q), Math.abs(r), Math.abs(s)) });
    }
  const ang = (c: Omit<HexCell, "id">) => {
    const { x, y } = axialToXY(c.q, c.r, 1);
    return (Math.atan2(x, -y) + Math.PI * 2) % (Math.PI * 2);
  };
  out.sort((a, b) => a.ring - b.ring || ang(a) - ang(b));
  return out.map((c, id) => ({ id, ...c }));
})();

/** Tâm ô theo px, gốc ở giữa bàn, y hướng xuống (như DOM). */
export function axialToXY(q: number, r: number, size: number): { x: number; y: number } {
  return { x: size * Math.sqrt(3) * (q + r / 2), y: size * 1.5 * r };
}

/** Bán kính ngoài của ô (tâm tới đỉnh) để cả bàn vừa khung w × h, chừa lề. */
export function hexSize(w: number, h: number): number {
  return Math.max(12, Math.min((w - 12) / (Math.sqrt(3) * 5), (h - 12) / 8));
}

export function adjacent(a: HexCell, b: HexCell): boolean {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2 === 1;
}

function elementOf(it: TranItem): Element | undefined {
  return it.element ?? (it.set ? setElement(it.set) : undefined);
}

/**
 * Nối hai ô kề nhau (TẠM): cùng bộ thì mạch linh khí; hệ tương sinh thì sinh, tương khắc thì khắc.
 * Một cặp chỉ một loại, mạch ưu tiên.
 */
export function links(state: TranState): TranLink[] {
  const out: TranLink[] = [];
  for (const a of CELLS)
    for (const b of CELLS) {
      if (b.id <= a.id || !adjacent(a, b)) continue;
      const ia = state.items[a.id];
      const ib = state.items[b.id];
      if (!ia || !ib) continue;
      if (ia.set && ia.set === ib.set) {
        out.push({ a: a.id, b: b.id, kind: "mach" });
        continue;
      }
      const ea = elementOf(ia);
      const eb = elementOf(ib);
      if (!ea || !eb) continue;
      if (generatesEither(ea, eb)) out.push({ a: a.id, b: b.id, kind: "sinh" });
      else if (beatsEither(ea, eb)) out.push({ a: a.id, b: b.id, kind: "khac" });
    }
  return out;
}

export interface SetCount {
  id: string;
  name: string;
  count: number;
  tiers: { so: number; on: boolean; text: string }[];
}

/** Đếm món mỗi bộ: ấn trên đồ đang mặc cộng ấn trên bàn (TẠM: mỗi ấn trên bàn tính 1 món). */
export function setCounts(state: TranState): SetCount[] {
  const n = new Map<string, number>(Object.entries(state.gearSeals));
  for (const it of Object.values(state.items)) if (it.set) n.set(it.set, (n.get(it.set) ?? 0) + 1);
  return [...n]
    .map(([id, count]) => ({ id, name: setName(id), count: Math.min(7, count), tiers: SET_TIERS.map((so) => ({ so, on: count >= so, text: setTierText(id, so) })) }))
    .sort((a, b) => b.count - a.count);
}

/** Bộ kích nhau (TẠM): hai bộ khác nhau, mỗi bộ đã đủ mốc đầu, có ít nhất một cặp ô kề tương sinh giữa hai bộ. */
export function resonances(state: TranState, ls = links(state)): { a: string; b: string }[] {
  const active = new Set(setCounts(state).filter((s) => s.count >= SET_TIERS[0]).map((s) => s.id));
  const seen = new Set<string>();
  const out: { a: string; b: string }[] = [];
  for (const l of ls) {
    if (l.kind !== "sinh") continue;
    const sa = state.items[l.a]?.set;
    const sb = state.items[l.b]?.set;
    if (!sa || !sb || sa === sb || !active.has(sa) || !active.has(sb)) continue;
    const k = [sa, sb].sort().join("|");
    if (!seen.has(k)) {
      seen.add(k);
      out.push({ a: sa, b: sb });
    }
  }
  return out;
}

/** Trạng thái mẫu cho Lăng Vân (Tu thể, linh căn Lôi). TẠM, chờ DashboardSource. */
export function sampleTran(path: string): TranState {
  const byCell = (q: number, r: number) => CELLS.find((c) => c.q === q && c.r === r)!.id;
  return {
    path,
    // Luyện Khí: tâm, vòng trong và nửa vòng ngoài mở (đề xuất)
    open: CELLS.filter((c) => c.ring < 2 || c.id % 2 === 0).map((c) => c.id),
    items: {
      [byCell(0, 0)]: { kind: "an", name: "Ấn Lôi Trì", set: "loi_tri" },
      [byCell(1, -1)]: { kind: "an", name: "Ấn Lôi Trì", set: "loi_tri" },
      [byCell(0, -1)]: { kind: "ngoc", name: "Ngọc Thổ cấp 2", element: "tho", art: "ngoc/tho" },
      [byCell(-1, 0)]: { kind: "an", name: "Ấn Bàn Thạch", set: "ban_thach" },
      [byCell(-1, 1)]: { kind: "an", name: "Ấn Bàn Thạch", set: "ban_thach" },
      [byCell(1, 0)]: { kind: "ngoc", name: "Ngọc Hỏa cấp 1", element: "hoa", art: "ngoc/hoa" },
      [byCell(0, 1)]: { kind: "ngoc", name: "Ngọc Thủy cấp 1", element: "thuy", art: "ngoc/thuy" },
    },
    gearSeals: { ban_thach: 2, loi_tri: 1 },
  };
}

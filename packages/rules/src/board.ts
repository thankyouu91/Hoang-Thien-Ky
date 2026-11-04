// Đạo Cơ Bàn (GDD tab Trang bị, phần 8; số trong data/he_thong/json/dao_co_ban.json, mọi số là đề xuất).
// Bàn 19 ô lục giác, tọa độ trục; ô mở theo vị diện, cấp, cảnh giới. Ô nhận ấn bộ hoặc ngọc hệ; ô tâm chỉ nhận ấn.
// Ô thông: nối về ô tâm qua các ô kề có đồ, không qua cặp kề tương khắc. Mỗi ấn thông thêm 1 món cho bộ của nó
// (tối đa 2 món mỗi bộ, chỉ khi bộ có ít nhất 2 món trên đồ còn độ bền). Hai ấn thông, kề nhau, của hai bộ đang kích
// thì cộng hưởng theo loại mạch; mỗi bộ lấy cộng hưởng mạnh nhất (hòa thì bộ đứng trước theo thứ tự ấn NG-AN-001…020).
import { ELEMENTS, type Element } from "@ktlp/sim";
import DAO from "../../../data/he_thong/json/dao_co_ban.json" with { type: "json" };
import NGOC from "../../../data/he_thong/json/ngoc.json" with { type: "json" };
import SET from "../../../data/he_thong/json/set.json" with { type: "json" };
import TO_HOP from "../../../data/he_thong/json/to_hop.json" with { type: "json" };

export type ViDien = "ha" | "trung" | "than" | "thanh";
/** Chỗ nhân vật đang đứng: vị diện, cấp trong vị diện (Thần vực trở lên không còn cấp), số thứ tự cảnh giới 1 Luyện Khí … 9 Độ Kiếp. */
export interface Progress { viDien: ViDien; cap: number; canhGioi: number }
/** Một viên trên bàn: ấn bộ, hoặc ngọc hệ (ngọc trên bàn không cộng chỉ số, chỉ mang hệ để dẫn mạch). */
export type BoardPiece = { loai: "an"; ma: string } | { loai: "ngoc"; he: Element; cap: number };
/** Bàn của một nhân vật: mã ô → viên đặt ở đó; ô trống thì không ghi. */
export interface BoardSetup { cells: Record<string, BoardPiece>; progress: Progress }
export type MachKind = "thuan" | "sinh" | "cuc";
/** Một cặp cộng hưởng được ít nhất một bộ chọn. `he` là hệ chung của hai ấn ở mạch Thuần. */
export interface Resonance { a: string; b: string; mach: MachKind; ten: string; he?: Element }
export interface BoardResult {
  thong: string[]; // các ô thông, theo thứ tự ô trong dữ liệu
  monThem: Record<string, number>; // id bộ → số món thêm từ bàn
  heSo: Record<string, number>; // id bộ → hệ số nhân mốc 2 (phần nghìn) từ cộng hưởng mạnh nhất
  congHuong: Resonance[];
}
interface CellRow { ma: string; q: number; r: number; mo: { viDien: ViDien; cap?: number; canhGioi: number }; chi_nhan: string[] }
interface ResonanceRow { mach: MachKind; ten: string; heSoMoc2: number; khangHe?: number; manaMax?: number }

const VI_DIEN: ViDien[] = ["ha", "trung", "than", "thanh"];
const CELLS = DAO.o as CellRow[];
const CELL: Record<string, CellRow> = {};
for (const c of CELLS) CELL[c.ma] = c;
const CENTER = CELLS[0].ma;
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, -1], [-1, 1]];
const RESONANCE: Record<string, ResonanceRow> = {};
for (const row of DAO.cong_huong as ResonanceRow[]) RESONANCE[row.mach] = row;
const MACH = DAO.mach as Record<string, string>;
const RELATION = TO_HOP.relation as Record<string, Record<string, string>>;
const SEAL_SET: Record<string, string> = {};
const SEAL_ELEMENT: Record<string, Element | null> = {};
for (const a of NGOC.an_bo as { ma_vp: string; bo: string; he: Element | null }[]) {
  SEAL_SET[a.ma_vp] = a.bo;
  SEAL_ELEMENT[a.ma_vp] = a.he;
}
const SET_ORDER = (SET.bo as { id: string }[]).map((b) => b.id);
const GEM_LEVELS = NGOC.cap.length;
const has = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);

/** Thông số ô theo mã. */
export function boardCell(ma: string): CellRow {
  if (!has(CELL, ma)) throw new Error(`Không có ô ${ma} trên Đạo Cơ Bàn`);
  return CELL[ma];
}

/** Ô đã mở chưa: vị diện cao hơn thì mở; cùng vị diện thì xét cấp, ở Thần vực trở lên (không có cấp) thì xét cảnh giới. */
export function boardCellOpen(ma: string, p: Progress): boolean {
  const mo = boardCell(ma).mo;
  const now = VI_DIEN.indexOf(p.viDien), need = VI_DIEN.indexOf(mo.viDien);
  if (now < 0) throw new Error(`Vị diện ${p.viDien} sai`);
  if (now !== need) return now > need;
  return mo.cap !== undefined ? p.cap >= mo.cap : p.canhGioi >= mo.canhGioi;
}

/** Hệ của một viên; Hỗn Độn không hệ. */
function pieceElement(piece: BoardPiece): Element | null {
  return piece.loai === "an" ? SEAL_ELEMENT[piece.ma] : piece.he;
}

/** Loại mạch giữa hai viên kề nhau theo quan hệ hệ (to_hop.json); không hệ kề gì cũng là trung. */
export function machBetween(a: Element | null, b: Element | null): string {
  if (a === null || b === null) return "trung";
  return MACH[RELATION[a][b]];
}

function validate(setup: BoardSetup): void {
  for (const ma of Object.keys(setup.cells)) {
    const cell = boardCell(ma);
    const piece = setup.cells[ma];
    if (!boardCellOpen(ma, setup.progress)) throw new Error(`Ô ${ma} chưa mở`);
    if (cell.chi_nhan.indexOf(piece.loai) < 0) throw new Error(`Ô ${ma} không nhận ${piece.loai}`);
    if (piece.loai === "an" && !has(SEAL_SET, piece.ma)) throw new Error(`Ô ${ma}: không có ấn bộ ${piece.ma}`);
    if (piece.loai === "ngoc" && (ELEMENTS.indexOf(piece.he) < 0 || piece.cap < 1 || piece.cap > GEM_LEVELS)) throw new Error(`Ô ${ma}: ngọc sai`);
  }
}

const neighbours = (ma: string): string[] => {
  const c = CELL[ma];
  const out: string[] = [];
  for (const [dq, dr] of DIRS) for (const n of CELLS) if (n.q === c.q + dq && n.r === c.r + dr) out.push(n.ma);
  return out;
};

/** Các ô thông: tìm theo chiều rộng từ ô tâm qua ô kề có đồ, bỏ cặp kề tương khắc. Ô tâm trống thì không ô nào thông. */
export function connectedCells(cells: Record<string, BoardPiece>): string[] {
  if (!has(cells, CENTER)) return [];
  const seen: string[] = [CENTER];
  for (let i = 0; i < seen.length; i++) {
    const cur = seen[i];
    for (const n of neighbours(cur)) {
      if (!has(cells, n) || seen.indexOf(n) >= 0) continue;
      if (machBetween(pieceElement(cells[cur]), pieceElement(cells[n])) === "dut") continue;
      seen.push(n);
    }
  }
  return CELLS.map((c) => c.ma).filter((ma) => seen.indexOf(ma) >= 0);
}

/**
 * Bàn tính thêm món cho bộ và cộng hưởng. `gearPieces`: số món mang ấn mỗi bộ trên đồ còn độ bền.
 * Một bộ đang kích khi tổng món (đồ + bàn) đủ mốc đầu tiên.
 */
export function boardBonus(setup: BoardSetup, gearPieces: Record<string, number>): BoardResult {
  validate(setup);
  const L = DAO.luat;
  const thong = connectedCells(setup.cells);
  const monThem: Record<string, number> = {};
  for (const ma of thong) {
    const p = setup.cells[ma];
    if (p.loai !== "an") continue;
    const bo = SEAL_SET[p.ma];
    if ((gearPieces[bo] ?? 0) < L.banMonTrenDoToiThieu) continue;
    monThem[bo] = Math.min(L.banMonToiDaMoiBo, (monThem[bo] ?? 0) + 1);
  }
  const active = (bo: string) => (gearPieces[bo] ?? 0) + (monThem[bo] ?? 0) >= (SET.moc as number[])[0];

  // Mọi cặp ấn thông, kề nhau, của hai bộ khác nhau đều đang kích.
  const pairs: { a: string; b: string; row: ResonanceRow; he: Element | null }[] = [];
  for (const ma of thong) {
    const p = setup.cells[ma];
    if (p.loai !== "an") continue;
    for (const n of neighbours(ma)) {
      const q = setup.cells[n];
      if (thong.indexOf(n) < 0 || !q || q.loai !== "an") continue;
      const a = SEAL_SET[p.ma], b = SEAL_SET[q.ma];
      if (a === b || !active(a) || !active(b)) continue;
      const mach = machBetween(SEAL_ELEMENT[p.ma], SEAL_ELEMENT[q.ma]);
      if (has(RESONANCE, mach)) pairs.push({ a, b, row: RESONANCE[mach], he: SEAL_ELEMENT[p.ma] });
    }
  }
  // Mỗi bộ lấy cộng hưởng mạnh nhất; hòa thì với bộ đứng trước theo thứ tự ấn.
  const heSo: Record<string, number> = {};
  const chosen: Resonance[] = [];
  const bos = SET_ORDER.filter((bo) => pairs.some((x) => x.a === bo));
  for (const bo of bos) {
    let best: (typeof pairs)[number] | null = null;
    for (const x of pairs) {
      if (x.a !== bo) continue;
      if (!best || x.row.heSoMoc2 > best.row.heSoMoc2 || (x.row.heSoMoc2 === best.row.heSoMoc2 && SET_ORDER.indexOf(x.b) < SET_ORDER.indexOf(best.b))) best = x;
    }
    if (!best) continue;
    const pick = best;
    heSo[bo] = pick.row.heSoMoc2;
    const [a, b] = SET_ORDER.indexOf(bo) < SET_ORDER.indexOf(pick.b) ? [bo, pick.b] : [pick.b, bo];
    if (!chosen.some((c) => c.a === a && c.b === b && c.mach === pick.row.mach)) {
      const r: Resonance = { a, b, mach: pick.row.mach, ten: pick.row.ten };
      if (pick.row.mach === "thuan" && pick.he) r.he = pick.he;
      chosen.push(r);
    }
  }
  return { thong, monThem, heSo, congHuong: chosen };
}

/** Tác dụng phụ của một cặp cộng hưởng: kháng hệ (Đồng Khí), mana tối đa theo phần nghìn chỉ số chuẩn (Âm Dương). */
export function resonanceSideEffects(r: Resonance): { khangHe?: number; manaMax?: number } {
  const row = RESONANCE[r.mach];
  const out: { khangHe?: number; manaMax?: number } = {};
  if (row.khangHe !== undefined) out.khangHe = row.khangHe;
  if (row.manaMax !== undefined) out.manaMax = row.manaMax;
  return out;
}

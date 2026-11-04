// Đạo Cơ Bàn ở màn Nhân vật (GDD tab Trang bị, pháp bảo và set đồ, phần 8; đặc tả của phiên set đồ). Bàn lục giác 19 ô
// đặt ấn bộ hoặc ngọc hệ để kích thêm set và cho hai bộ cộng hưởng. Luật lấy thẳng từ @ktlp/rules (board.ts), số từ
// data/he_thong/json/dao_co_ban.json. File này không import three: dữ liệu vẽ dùng chung cho lớp nút DOM và cảnh three
// (art/daoCoBanScene.ts). Bàn đang đặt, số món trên đồ và tiến độ đọc từ NhanVatView.board (DashboardSource).
import { boardBonus, boardCellOpen, connectedCells, machBetween, type BoardPiece, type BoardResult, type Progress } from "@ktlp/rules";
import type { Element } from "@ktlp/sim";
import DAO from "../../../data/he_thong/json/dao_co_ban.json";
import NGOC from "../../../data/he_thong/json/ngoc.json";
import SET from "../../../data/he_thong/json/set.json";
import { ELEMENT_STYLE } from "../theme/elements.ts";

export interface BanCell {
  ma: string;
  q: number;
  r: number;
  vong: "tam" | "trong" | "ngoai";
  chiNhan: ("an" | "ngoc")[];
}

export const CELLS: BanCell[] = (DAO.o as { ma: string; q: number; r: number; vong: BanCell["vong"]; chi_nhan: BanCell["chiNhan"] }[]).map((o) => ({
  ma: o.ma,
  q: o.q,
  r: o.r,
  vong: o.vong,
  chiNhan: o.chi_nhan,
}));
export const CENTER = CELLS[0].ma;

interface Seal {
  ma_vp: string;
  ten: string;
  bo: string;
  he: Element | null;
}
const SEALS = NGOC.an_bo as Seal[];
const SEAL: Record<string, Seal> = Object.fromEntries(SEALS.map((s) => [s.ma_vp, s]));
interface SetRow {
  id: string;
  ten: string;
  moc: { so: number; mo_ta: string }[];
}
const SETS = SET.bo as SetRow[];
export const TIERS = SET.moc as number[];
const MAX_SETS = (SET.tran as { boToiDa: number }).boToiDa;
export const RESONANCE = DAO.cong_huong as { mach: string; ten: string; mo_ta: string }[];

/** Mốc mở theo cảnh giới (cap là cấp vào cảnh giới đó trong vị diện; Thần vực xét số thứ tự cảnh giới). */
export const REALMS: { ten: string; p: Progress }[] = [
  { ten: "Luyện Khí", p: { viDien: "ha", cap: 20, canhGioi: 1 } },
  { ten: "Trúc Cơ", p: { viDien: "ha", cap: 51, canhGioi: 2 } },
  { ten: "Kết Đan", p: { viDien: "ha", cap: 101, canhGioi: 3 } },
  { ten: "Nguyên Anh", p: { viDien: "ha", cap: 151, canhGioi: 4 } },
  { ten: "Hóa Thần", p: { viDien: "ha", cap: 201, canhGioi: 5 } },
  { ten: "Luyện Hư", p: { viDien: "trung", cap: 1, canhGioi: 6 } },
  { ten: "Hợp Thể", p: { viDien: "trung", cap: 101, canhGioi: 7 } },
  { ten: "Đại Thừa", p: { viDien: "than", cap: 0, canhGioi: 8 } },
  { ten: "Độ Kiếp", p: { viDien: "than", cap: 0, canhGioi: 9 } },
];

export function cellOpen(ma: string, p: Progress): boolean {
  return boardCellOpen(ma, p);
}

/** Cảnh giới mở ô (để ghi trên ô khóa). */
export function cellOpensAt(ma: string): string {
  return REALMS.find((x) => boardCellOpen(ma, x.p))?.ten ?? "";
}

export function sealName(ma: string): string {
  return SEAL[ma]?.ten ?? ma;
}
export function sealSet(ma: string): string {
  return SEAL[ma]?.bo ?? "";
}
export function setName(id: string): string {
  return SETS.find((s) => s.id === id)?.ten ?? id;
}
export function setTier(id: string, so: number): string {
  return SETS.find((s) => s.id === id)?.moc.find((m) => m.so === so)?.mo_ta ?? "";
}
/** Ấn của một bộ. */
export function sealOfSet(bo: string): string | undefined {
  return SEALS.find((s) => s.bo === bo)?.ma_vp;
}

export function pieceElement(p: BoardPiece): Element | null {
  return p.loai === "an" ? (SEAL[p.ma]?.he ?? null) : p.he;
}

export function pieceName(p: BoardPiece): string {
  return p.loai === "an" ? sealName(p.ma) : `Ngọc ${ELEMENT_STYLE[p.he].name} cấp ${p.cap}`;
}

/** Màu hệ của viên (ô tâm sáng theo màu hệ ấn chủ); Hỗn Độn không hệ. */
export function pieceColor(p: BoardPiece | undefined): string | undefined {
  const e = p ? pieceElement(p) : null;
  return e ? ELEMENT_STYLE[e].color : undefined;
}

export type LinkKind = "thuan" | "sinh" | "cuc" | "trung" | "dut";
export interface BanLink {
  a: string;
  b: string;
  kind: LinkKind;
}

export const LINK_NAMES: Record<LinkKind, string> = { thuan: "Thuần", sinh: "Sinh", cuc: "Cực", trung: "Trung", dut: "Đứt (tương khắc)" };

const adjacent = (a: BanCell, b: BanCell) => {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2 === 1;
};

/** Hình vẽ của bàn: ô thông và các mạch giữa hai ô kề đều thông; cặp kề tương khắc vẽ nét đứt dù không thông. */
export interface BanDraw {
  open: Set<string>;
  pieces: Record<string, BoardPiece>;
  thong: Set<string>;
  links: BanLink[];
  centerColor?: string;
}

export function drawOf(pieces: Record<string, BoardPiece>, p: Progress): BanDraw {
  const open = new Set(CELLS.filter((c) => cellOpen(c.ma, p)).map((c) => c.ma));
  const thong = new Set(connectedCells(pieces));
  const links: BanLink[] = [];
  for (const a of CELLS)
    for (const b of CELLS) {
      if (a.ma >= b.ma || !adjacent(a, b) || !pieces[a.ma] || !pieces[b.ma]) continue;
      const kind = machBetween(pieceElement(pieces[a.ma]), pieceElement(pieces[b.ma])) as LinkKind;
      if (kind === "dut" || (thong.has(a.ma) && thong.has(b.ma))) links.push({ a: a.ma, b: b.ma, kind });
    }
  return { open, pieces, thong, links, centerColor: pieceColor(pieces[CENTER]) };
}

export interface SetLine {
  id: string;
  name: string;
  gear: number;
  board: number;
  total: number;
  tiers: { so: number; on: boolean; text: string }[];
}

/** Các bộ có món (đồ + bàn), bộ đang kích trước; tối đa 3 bộ cùng lúc (luật cũ). */
export function setLines(gear: Record<string, number>, res: BoardResult): SetLine[] {
  const ids = new Set([...Object.keys(gear), ...Object.keys(res.monThem)]);
  return [...ids]
    .map((id) => {
      const g = gear[id] ?? 0;
      const b = res.monThem[id] ?? 0;
      const total = Math.min(7, g + b);
      return { id, name: setName(id), gear: g, board: b, total, tiers: TIERS.map((so) => ({ so, on: total >= so, text: setTier(id, so) })) };
    })
    .sort((x, y) => y.total - x.total)
    .slice(0, MAX_SETS);
}

/** Bàn chỉ giữ viên ở ô đã mở (xem thử cảnh giới thấp hơn thì viên ở ô khóa tạm bỏ ra). */
export function onOpenCells(pieces: Record<string, BoardPiece>, p: Progress): Record<string, BoardPiece> {
  return Object.fromEntries(Object.entries(pieces).filter(([ma]) => cellOpen(ma, p)));
}

export function bonusOf(pieces: Record<string, BoardPiece>, p: Progress, gear: Record<string, number>): BoardResult {
  return boardBonus({ cells: onOpenCells(pieces, p), progress: p }, gear);
}

/** Tâm ô theo px, gốc ở giữa bàn, y hướng xuống (như DOM); lưới lục giác đỉnh nhọn, toạ độ trục. */
export function axialToXY(q: number, r: number, size: number): { x: number; y: number } {
  return { x: size * Math.sqrt(3) * (q + r / 2), y: size * 1.5 * r };
}

/** Bán kính ngoài của ô (tâm tới đỉnh) để cả bàn 5 ô ngang, 5 hàng vừa khung w × h, chừa lề. */
export function hexSize(w: number, h: number): number {
  return Math.max(12, Math.min((w - 12) / (Math.sqrt(3) * 5), (h - 12) / 8));
}

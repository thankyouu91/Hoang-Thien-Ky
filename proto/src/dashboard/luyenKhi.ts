// Luyện khí sau cấp tối đa (GDD tab Trang bị phần 13; đặc tả luyen-khi.md của phiên set đồ, mọi số là đề xuất).
// Bảng số và hàm dùng chung cho mục Luyện khí ở màn Nhân vật (screens/luyenKhiPanel.ts), lò danh khí ở Luyện Khí Các
// (screens/forge.ts) và nguồn đọc mẫu (mock/source.ts). File này không vẽ gì. Số đọc thẳng từ data/he_thong/json:
// luyen_khi.json (tẩy luyện, khí linh, khí văn, phân giải, danh khí, Bảo Giám, luat), ngoc.json (cấp, Phách, song hệ,
// Ý châu, ấn bộ), trang_bi.json (430 kiểu, ô công hay thủ, bậc độ hiếm), phap_bao.json, phap_khi.json, vu_khi.json.
// Khi @htk/rules có luật luyện khí thì các hàm addExp, rerollSub, rollOffer… chuyển sang gọi rules.
import { machBetween, type Progress } from "@htk/rules";
import type { Element } from "@htk/sim";
import LK from "../../../data/he_thong/json/luyen_khi.json";
import NGOC from "../../../data/he_thong/json/ngoc.json";
import PHAP_BAO from "../../../data/he_thong/json/phap_bao.json";
import PHAP_KHI from "../../../data/he_thong/json/phap_khi.json";
import TRANG_BI from "../../../data/he_thong/json/trang_bi.json";
import VU_KHI from "../../../data/he_thong/json/vu_khi.json";
import { REALMS } from "./daoCoBan.ts";
import type { GearSlot, Rarity } from "./source.ts";

const L = LK.luat as unknown as {
  phanGiaiMoCap: number; baoGiamMoCap: number; tayLuyenMoCap: number; khiLinhMoCap: number; khiLinhBacToiThieu: number; songHeCapNgoc: number;
  phachCapNgoc: number; danhKhiMoCap: number; danhKhiLoToiThieu: number; phanGiaiKhiTinhMoiCapKhiLinh: number; phanGiaiTraNac: number;
  tayLuyenKhiTinh: number; tayLuyenLinhThach: Record<Rarity, number>; khiLinhKnTran: number; khiLinhKnBiCanh: number; khiLinhKnKhiTinh: number;
  khiVanToiDa: Partial<Record<Rarity, number>>; khiVanKichToiDa?: number; khiVanTinhToiDa?: number; khiVanTranLucChien: number; taoVanLinhVanThach: number; phachTyLe: number;
  phachKhiTinh: number; danhKhiVanThiet: number; danhKhiKhiTinh: number; danhKhiHoLo: number; danhKhiTyLe: Record<string, number>;
  danhKhiYHeSo: number; baoGiamTuanLinhVanThach: number;
};

export const SLOTS: GearSlot[] = ["vu_khi", "mu", "ao", "dai", "bao_tay", "giay", "ngoc_boi"];
const O = TRANG_BI.o as { id: GearSlot; ten: string; ngoc: "cong" | "thu" }[];
export const SLOT_NAMES = Object.fromEntries(O.map((o) => [o.id, o.ten])) as Record<GearSlot, string>;
const DO_HIEM = TRANG_BI.do_hiem as { id: Rarity; ten: string; bac: number }[];
export const RARITY_NAMES = Object.fromEntries(DO_HIEM.map((r) => [r.id, r.ten])) as Record<Rarity, string>;
const bac = (r: Rarity) => DO_HIEM.find((x) => x.id === r)?.bac ?? 0;
export const atLeast = (r: Rarity, min: Rarity) => bac(r) >= bac(min);

// ---- Mở khóa ------------------------------------------------------------------------------------------------------

const VI_DIEN = ["ha", "trung", "than"];
export interface Gate {
  viDien: string;
  cap: number;
  ten: string;
}
/** Tên mốc: cảnh giới Hạ vị chứa cấp đó, kèm số cấp. */
const gate = (cap: number, ten?: string): Gate => ({
  viDien: "ha",
  cap,
  ten: ten ?? `${REALMS.filter((r) => r.p.viDien === "ha" && r.p.cap <= cap).at(-1)?.ten ?? ""} (cấp ${cap})`,
});
/** Mốc mở của từng phần (luyen_khi.json luat). Hợp ngọc và Phách mở theo viên ngọc đang có, xét riêng. */
export const UNLOCK = {
  phanGiai: gate(L.phanGiaiMoCap, `cấp ${L.phanGiaiMoCap}`),
  baoGiam: gate(L.baoGiamMoCap, `cấp ${L.baoGiamMoCap}`),
  tayLuyen: gate(L.tayLuyenMoCap),
  khiLinh: gate(L.khiLinhMoCap),
  danhKhi: gate(L.danhKhiMoCap, `cấp ${L.danhKhiMoCap} Hạ vị hoặc từ Trung vị`),
};

export function reached(p: Progress, g: Gate): boolean {
  const now = VI_DIEN.indexOf(p.viDien);
  const need = VI_DIEN.indexOf(g.viDien);
  return now !== need ? now > need : p.cap >= g.cap;
}

// ---- 1. Phân giải --------------------------------------------------------------------------------------------------

const PHAN_GIAI = LK.phan_giai as { do_hiem: Rarity; khi_tinh: number }[];
/** Món phân giải được: có dòng ở phan_giai (từ lam). */
export const canDecompose = (r: Rarity) => PHAN_GIAI.some((x) => x.do_hiem === r);
export const khiTinhOf = (r: Rarity, klCap = 0) => {
  const row = PHAN_GIAI.find((x) => x.do_hiem === r);
  return row ? row.khi_tinh + klCap * L.phanGiaiKhiTinhMoiCapKhiLinh : 0;
};
/** Bảng Khí Tinh theo độ hiếm, để ghi chú. */
export const KHI_TINH_TEXT = PHAN_GIAI.map((x) => `${RARITY_NAMES[x.do_hiem].toLowerCase()} ${x.khi_tinh}`).join(", ");
export const KHI_TINH_PER_KL = L.phanGiaiKhiTinhMoiCapKhiLinh;
/** Khí Tinh từ đồ khóa (vàng, đỏ, đồ đã dưỡng khí linh) cũng khóa, không bán được. */
export const yieldLocked = (r: Rarity, klCap = 0) => atLeast(r, "vang") || klCap >= 1;
/** Phần số nấc cường hóa trả thành Luyện Khí Thạch đúng phẩm (phanGiaiTraNac phần nghìn). */
export const stoneBack = (plus: number) => Math.floor((plus * L.phanGiaiTraNac) / 1000);

// ---- 2. Tẩy luyện ---------------------------------------------------------------------------------------------------

export interface SubStat {
  stat: string;
  ten: string;
  /** Giá trị ở lục +0, phần nghìn. */
  giaTri: number;
  /** Chữ hiện: "+2%", giảm hồi chiêu không có dấu cộng. */
  gt: string;
}
const pct = (perMille: number) => `${(perMille / 10).toLocaleString("vi-VN", { maximumFractionDigits: 1 })}%`;
const TAY = LK.tay_luyen as { o: GearSlot; loai: number; stat: string; ten: string; gia_tri: number }[];
/** 4 loại chỉ số phụ của mỗi ô theo thứ tự loai 1–4 (chỉ số 0–3 trong UI và lệnh), loại 1 là mặc định. */
export const SUB = Object.fromEntries(
  SLOTS.map((s) => [
    s,
    TAY.filter((x) => x.o === s)
      .sort((a, b) => a.loai - b.loai)
      .map((x) => ({ stat: x.stat, ten: x.ten, giaTri: x.gia_tri, gt: `${x.stat === "cooldownCut" ? "" : "+"}${pct(x.gia_tri)}` })),
  ]),
) as Record<GearSlot, SubStat[]>;
/** Mỗi lần tẩy luyện: Khí Tinh, cộng linh thạch đúng phẩm của vị diện theo độ hiếm món. */
export const REROLL_KHI_TINH = L.tayLuyenKhiTinh;
export const rerollStone = (r: Rarity) => L.tayLuyenLinhThach[r] ?? 0;

/** Người thường quay ngẫu nhiên trong 3 loại còn lại. */
export function rerollSub(cur: number): number {
  const others = [0, 1, 2, 3].filter((i) => i !== cur);
  return others[Math.floor(Math.random() * others.length)];
}

// ---- 3. Khí linh và khí văn -------------------------------------------------------------------------------------------

const KHI_LINH = LK.khi_linh as { cap: number; kinh_nghiem: number; cong_chi_so: number; mo_o_khi_van: boolean }[];
export const KL_MAX = KHI_LINH[KHI_LINH.length - 1].cap;
/** Kinh nghiệm để lên cấp kế tiếp (cấp tối đa thì 0). */
export const klNeed = (cap: number) => KHI_LINH.find((x) => x.cap === cap + 1)?.kinh_nghiem ?? 0;
export const KL_PER_KHI_TINH = L.khiLinhKnKhiTinh;
export const KL_PER_TRAN = L.khiLinhKnTran;
export const KL_PER_BI_CANH = L.khiLinhKnBiCanh;
/** Cộng chỉ số gốc của món ở cấp đó (phần nghìn). */
export const klBonus = (cap: number) => KHI_LINH.find((x) => x.cap === cap)?.cong_chi_so ?? 0;
/** Cấp mở ô khí văn (3, 6, 9); số ô tối đa theo độ hiếm. */
export const VAN_AT = KHI_LINH.filter((x) => x.mo_o_khi_van).map((x) => x.cap);
export const vanSlots = (r: Rarity): number => L.khiVanToiDa[r] ?? 0;
export const hasKhiLinh = (r: Rarity) => bac(r) >= L.khiLinhBacToiThieu;
/** Một khí văn trên nhiều món chỉ tính tối đa ngần này lần; tổng mọi khí văn không quá VAN_CAP lực chiến (phần nghìn). */
export const VAN_STACK = L.khiVanKichToiDa ?? L.khiVanTinhToiDa ?? 2;
export const VAN_CAP = L.khiVanTranLucChien;
/** Tẩy văn (quay lại 3 lựa chọn) tốn Linh Văn Thạch. */
export const VAN_REROLL = L.taoVanLinhVanThach;

export interface KhiVan {
  ma: string;
  ten: string;
  tac: string;
}
const KHI_VAN = (LK.khi_van as { ma: string; nhom: "cong" | "thu"; ten: string; tac_dung: string }[]).map((x) => ({ ma: x.ma, ten: x.ten, tac: x.tac_dung, nhom: x.nhom }));
/** Ô công (vũ khí, bao tay, ngọc bội) hay ô thủ, theo trang_bi.json o[].ngoc. */
export const vanGroup = (s: GearSlot) => (O.find((o) => o.id === s)?.ngoc === "cong" ? "công" : "thủ");
export const vanPool = (s: GearSlot): KhiVan[] => KHI_VAN.filter((x) => x.nhom === (vanGroup(s) === "công" ? "cong" : "thu"));
export const khiVan = (ma: string): KhiVan | undefined => KHI_VAN.find((x) => x.ma === ma);

/** 3 khí văn quay ngẫu nhiên từ nhóm của ô. */
export function rollOffer(s: GearSlot): string[] {
  const pool = vanPool(s).map((x) => x.ma);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, 3);
}

/** Nạp kinh nghiệm; trả về các cấp vừa vượt. */
export function addExp(kl: { cap: number; exp: number }, exp: number): number[] {
  const passed: number[] = [];
  kl.exp += exp;
  while (kl.cap < KL_MAX && kl.exp >= klNeed(kl.cap)) {
    kl.exp -= klNeed(kl.cap);
    kl.cap++;
    passed.push(kl.cap);
  }
  if (kl.cap >= KL_MAX) kl.exp = 0;
  return passed;
}

/** Số Khí Tinh cần để lên cấp kế. */
export const khiTinhToNext = (kl: { cap: number; exp: number }) => Math.ceil(Math.max(0, klNeed(kl.cap) - kl.exp) / KL_PER_KHI_TINH);

/** Đồng bộ ô khí văn với cấp khí linh: mở ô đến cấp 3, 6, 9 theo độ hiếm. */
export function syncVan(s: { kl: { cap: number }; van: (string | null)[] }, r: Rarity): void {
  const open = VAN_AT.filter((at, i) => i < vanSlots(r) && s.kl.cap >= at).length;
  while (s.van.length < open) s.van.push(null);
}

// ---- 4. Ngọc ------------------------------------------------------------------------------------------------------------

const GEM_CAP = NGOC.cap as { cap: number; gia_tri: number; ty_le_nen_len: number | null }[];
/** Giá trị một viên thường theo cấp (phần nghìn) và tỷ lệ đậu khi nén lên cấp đó (phần nghìn). */
export const gemValue = (cap: number) => GEM_CAP[cap - 1]?.gia_tri ?? 0;
export const gemRate = (cap: number) => GEM_CAP[cap - 1]?.ty_le_nen_len ?? 1000;
export const GEM_NAME: Record<string, string> = Object.fromEntries((NGOC.he as { he: string; ten: string }[]).map((h) => [h.he, h.ten]));

const SONG_HE = (NGOC.song_he as { moi_he: number; ty_le_dau: number; that_bai_mat: number; phu_giu: string }[])[0];
export const SONG_HE_FROM = L.songHeCapNgoc;
/** Viên song hệ cho mỗi hệ phần này của một viên thường (phần nghìn). */
export const SONG_HE_PART = SONG_HE.moi_he;
/** Tỷ lệ đậu cố định (không theo bảng nén); thất bại mất SONG_HE_LOSE viên (viên đặt thứ hai), phù SONG_HE_PHU giữ cả hai. */
export const SONG_HE_RATE = SONG_HE.ty_le_dau;
export const SONG_HE_LOSE = SONG_HE.that_bai_mat;
export const SONG_HE_PHU = SONG_HE.phu_giu;
/** Hai hệ tương sinh hoặc tương hợp (mạch "sinh" của bảng quan hệ). */
export const songHeOk = (a: Element, b: Element) => a !== b && machBetween(a, b) === "sinh";

const PHACH = NGOC.phach as { ma_vp: string; he: string; ten: string; gia_tri: number; tran_toi_da: number }[];
export const PHACH_FROM = L.phachCapNgoc;
export const PHACH_KHI_TINH = L.phachKhiTinh;
export const PHACH_RATE = L.phachTyLe;
export const phachName = (he: string) => PHACH.find((x) => x.he === he)?.ten ?? he;
export const phachCode = (he: string) => PHACH.find((x) => x.he === he)?.ma_vp ?? he;
/** Phách cho như ngọc cấp 10 và nâng trần mềm sát thương hệ đó (phần nghìn). */
export const PHACH_VALUE = PHACH[0].gia_tri;
export const DMG_CAP = (NGOC.tran as { satThuongToiDa: number }).satThuongToiDa;
export const DMG_CAP_PHACH = PHACH[0].tran_toi_da;

// ---- 5. Danh khí ----------------------------------------------------------------------------------------------------------

export interface DanhKhi {
  ma: string;
  ten: string;
  khiHinh: string;
  /** Tên khí hình (vu_khi.json). */
  hinh: string;
  van: string;
  doPho: string;
}
const KHI_HINH = VU_KHI.khi_hinh as { id: string; ten: string }[];
export const DANH_KHI: DanhKhi[] = (LK.danh_khi as { ma_vp: string; ten: string; khi_hinh: string; danh_van: string; do_pho: string }[]).map((d) => ({
  ma: d.ma_vp,
  ten: d.ten,
  khiHinh: d.khi_hinh,
  hinh: KHI_HINH.find((k) => k.id === d.khi_hinh)?.ten ?? d.khi_hinh,
  van: d.danh_van,
  doPho: d.do_pho,
}));
/** Đồ phổ của danh khí thứ i. */
export const doPhoCode = (i: number) => DANH_KHI[i].doPho;
export const DANH_KHI_COST = { vanThiet: L.danhKhiVanThiet, khiTinh: L.danhKhiKhiTinh, hoLo: L.danhKhiHoLo };
/** Ý của khí hình trên danh khí so với Ý châu (phần nghìn). */
export const DANH_KHI_Y = L.danhKhiYHeSo;
/** Lò từ cấp LO_MIN; tỷ lệ thành theo cấp lò (phần nghìn), lò cao hơn bảng thì lấy mức cao nhất. */
export const LO_MIN = L.danhKhiLoToiThieu;
const LO_TOP = Math.max(...Object.keys(L.danhKhiTyLe).map((k) => Number(k.slice(2))));
export const loRate = (lv: number) => (lv < LO_MIN ? 0 : (L.danhKhiTyLe[`lo${Math.min(lv, LO_TOP)}`] ?? 0));
export const LO_RATES = Object.entries(L.danhKhiTyLe).map(([k, v]) => ({ lv: Number(k.slice(2)), rate: v }));

/** Khí hình của một kiểu vũ khí (trang_bi.json), để tìm phôi đỏ cùng khí hình. */
const KIEU = TRANG_BI.kieu as { ma_vp: string; o: GearSlot; so: number; ten: string; do_hiem: Rarity; khi_hinh?: string }[];
export const khiHinhOf = (code?: string) => KIEU.find((k) => k.ma_vp === code)?.khi_hinh;

// ---- 6. Bảo Giám --------------------------------------------------------------------------------------------------------

export interface BaoEntry {
  ma: string;
  ten: string;
  rarity?: Rarity;
  art?: string;
  he?: string;
}
export interface BaoPage {
  id: string;
  ten: string;
  nhom: "Trang bị" | "Pháp bảo" | "Ẩn văn" | "Khác";
  entries: BaoEntry[];
  /** Số ô cần để đủ trang khi khác số entries (trang "bất kỳ": Ẩn văn nhập môn cần 24 cặp bất kỳ trong 144). */
  can?: number;
  /** Phần thưởng khi đủ trang, không cộng chỉ số chiến đấu. */
  thuong: string;
}
const ART_DIR: Record<GearSlot, string> = { vu_khi: "kiem", mu: "mu", ao: "ao", dai: "dai", bao_tay: "bao_tay", giay: "giay", ngoc_boi: "ngoc_boi" };
const gearEntry = (k: (typeof KIEU)[number]): BaoEntry => ({ ma: k.ma_vp, ten: k.ten, rarity: k.do_hiem, art: `trang_bi/${ART_DIR[k.o]}/${String(k.so).padStart(2, "0")}` });
const PB = PHAP_BAO.mon as { ma_vp: string; ten: string; loai: string; do_hiem: Rarity }[];
interface Dem {
  loai: string;
  o?: GearSlot;
  phap_bao?: string;
  /** Trang Ẩn văn của một điều kiện (DN-DK-…): 12 hiệu ứng đi cùng điều kiện đó. */
  dieu_kien?: string;
  bat_ky?: boolean;
}
/** Dòng ẩn (trang_bi.json dong_an): 12 điều kiện × 12 hiệu ứng = 144 cặp; ô của trang Ẩn văn mang mã "DK|HU". */
const DONG_AN = TRANG_BI.dong_an as { ma: string; loai: "dieu_kien" | "hieu_ung"; noi_dung: string }[];
const DA_DK = DONG_AN.filter((d) => d.loai === "dieu_kien");
const DA_HU = DONG_AN.filter((d) => d.loai === "hieu_ung");
const anVanEntries = (dk: typeof DA_DK): BaoEntry[] =>
  dk.flatMap((k) => DA_HU.map((h) => ({ ma: `${k.ma}|${h.ma}`, ten: `Khi ${k.noi_dung} thì ${h.noi_dung}` })));
function entriesOf(d: Dem): BaoEntry[] {
  switch (d.loai) {
    case "trang_bi":
      return KIEU.filter((k) => k.o === d.o).map(gearEntry);
    case "phap_bao":
      return PB.filter((m) => !d.phap_bao || m.loai === d.phap_bao).map((m) => ({ ma: m.ma_vp, ten: m.ten, rarity: m.do_hiem }));
    case "phap_khi":
      return (PHAP_KHI.mon as { ma_vp: string; ten: string; do_hiem: Rarity }[]).map((m) => ({ ma: m.ma_vp, ten: m.ten, rarity: m.do_hiem }));
    case "y_chau":
      return (NGOC.y_chau as { ma_vp: string; ten: string }[]).map((m) => ({ ma: m.ma_vp, ten: m.ten }));
    case "an_bo":
      return (NGOC.an_bo as { ma_vp: string; ten: string; he: string | null }[]).map((m) => ({ ma: m.ma_vp, ten: m.ten, he: m.he ?? undefined }));
    case "phach":
      return PHACH.map((m) => ({ ma: m.ma_vp, ten: m.ten, he: m.he }));
    case "an_van":
      return anVanEntries(d.dieu_kien ? DA_DK.filter((k) => k.ma === d.dieu_kien) : DA_DK);
    case "danh_khi":
      return DANH_KHI.map((dk) => KIEU.find((k) => k.ma_vp === dk.ma)).filter((k): k is (typeof KIEU)[number] => !!k).map(gearEntry);
    default:
      return [];
  }
}
/** Các trang theo luyen_khi.json bao_giam (đếm theo loại, ô, loại pháp bảo); một kiểu có thể nằm ở nhiều trang. */
export const BAO_PAGES: BaoPage[] = (LK.bao_giam as { ma: string; ten: string; dem: Dem; thuong: string; so_luong?: number }[]).map((p) => {
  const entries = entriesOf(p.dem);
  return {
    id: p.ma,
    ten: p.ten,
    nhom: p.dem.loai === "trang_bi" ? "Trang bị" : p.dem.loai === "phap_bao" ? "Pháp bảo" : p.dem.loai === "an_van" ? "Ẩn văn" : "Khác",
    entries,
    can: p.dem.bat_ky && p.so_luong && p.so_luong < entries.length ? p.so_luong : undefined,
    thuong: p.thuong,
  };
});
/** Số ô cần để đủ một trang. */
export const baoCan = (p: BaoPage) => p.can ?? p.entries.length;
/** Tổng số kiểu đồ khác nhau trong sổ (cặp ẩn văn đếm riêng, không phải kiểu đồ). */
export const BAO_TOTAL = new Set(BAO_PAGES.filter((p) => p.nhom !== "Ẩn văn").flatMap((p) => p.entries.map((e) => e.ma))).size;
/** Số cặp dòng ẩn (12 × 12). */
export const AN_VAN_TOTAL = DA_DK.length * DA_HU.length;
export const BAO_WEEK_REWARD = L.baoGiamTuanLinhVanThach;

/** Số lần một khí văn đang có trên mọi món (tính tối đa VAN_STACK). */
export function vanCount(slots: Partial<Record<GearSlot, { van: (string | null)[] }>>, ma: string): number {
  return Object.values(slots).reduce((n, s) => n + (s?.van.filter((x) => x === ma).length ?? 0), 0);
}

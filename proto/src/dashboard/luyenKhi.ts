// Luyện khí sau cấp tối đa (GDD tab Trang bị phần 13; đặc tả luyen-khi.md của phiên set đồ, mọi số là đề xuất).
// Lớp chuyển đổi cho mục Luyện khí ở màn Nhân vật và lò danh khí ở Luyện Khí Các. File này không vẽ gì.
// Số đã có JSON thì đọc thẳng: giá trị và tỷ lệ ngọc (ngoc.json), 420 kiểu đồ (trang_bi.json), pháp bảo, pháp khí, Ý châu,
// ấn bộ. Bảng TẠM chép từ đặc tả, chờ phiên bảng số liệu xuất JSON và phiên Sprint viết rules: chỉ số phụ tẩy luyện, khí
// văn, Khí Tinh khi phân giải, kinh nghiệm khí linh, Phách, danh khí, phần thưởng Bảo Giám. Trạng thái (Khí Tinh, khí linh,
// ngọc cấp cao, sổ Bảo Giám) cũng là mẫu TẠM ở màn, chờ DashboardSource.
import { machBetween, type Progress } from "@ktlp/rules";
import type { Element } from "@ktlp/sim";
import NGOC from "../../../data/he_thong/json/ngoc.json";
import PHAP_BAO from "../../../data/he_thong/json/phap_bao.json";
import PHAP_KHI from "../../../data/he_thong/json/phap_khi.json";
import TRANG_BI from "../../../data/he_thong/json/trang_bi.json";
import type { GearSlot, NhanVatView, Rarity } from "./source.ts";

export const SLOTS: GearSlot[] = ["vu_khi", "mu", "ao", "dai", "bao_tay", "giay", "ngoc_boi"];
export const SLOT_NAMES: Record<GearSlot, string> = { vu_khi: "Vũ khí", mu: "Mũ", ao: "Áo", dai: "Đai", bao_tay: "Bao tay", giay: "Giày", ngoc_boi: "Ngọc bội" };
export const RARITY_NAMES: Record<Rarity, string> = { luc: "Lục", lam: "Lam", tim: "Tím", vang: "Vàng", do: "Đỏ" };
const RANK: Record<Rarity, number> = { luc: 0, lam: 1, tim: 2, vang: 3, do: 4 };
export const atLeast = (r: Rarity, min: Rarity) => RANK[r] >= RANK[min];

// ---- Mở khóa ------------------------------------------------------------------------------------------------------

const VI_DIEN = ["ha", "trung", "than"];
export interface Gate {
  viDien: string;
  cap: number;
  ten: string;
}
/** Mốc mở của từng phần (đặc tả mục Mở khóa). Hợp ngọc và Phách mở theo viên ngọc đang có, xét riêng. */
export const UNLOCK = {
  phanGiai: { viDien: "ha", cap: 20, ten: "cấp 20" },
  baoGiam: { viDien: "ha", cap: 20, ten: "cấp 20" },
  tayLuyen: { viDien: "ha", cap: 101, ten: "Kết Đan (cấp 101)" },
  khiLinh: { viDien: "ha", cap: 201, ten: "Hóa Thần (cấp 201)" },
  danhKhi: { viDien: "ha", cap: 250, ten: "cấp 250 Hạ vị hoặc từ Trung vị" },
} satisfies Record<string, Gate>;

export function reached(p: Progress, g: Gate): boolean {
  const now = VI_DIEN.indexOf(p.viDien);
  const need = VI_DIEN.indexOf(g.viDien);
  return now !== need ? now > need : p.cap >= g.cap;
}

// ---- 1. Phân giải --------------------------------------------------------------------------------------------------

/** Khí Tinh mỗi món theo độ hiếm (lục không phân giải được), cộng 1 mỗi cấp khí linh. */
const KHI_TINH: Record<Rarity, number> = { luc: 0, lam: 1, tim: 3, vang: 10, do: 25 };
export const canDecompose = (r: Rarity) => atLeast(r, "lam");
export const khiTinhOf = (r: Rarity, klCap = 0) => KHI_TINH[r] + (KHI_TINH[r] ? klCap : 0);
/** Khí Tinh từ đồ khóa (vàng, đỏ, đồ đã dưỡng khí linh) cũng khóa, không bán được. */
export const yieldLocked = (r: Rarity, klCap = 0) => atLeast(r, "vang") || klCap >= 1;
/** Nửa số nấc cường hóa trả thành Luyện Khí Thạch đúng phẩm. */
export const stoneBack = (plus: number) => Math.floor(plus / 2);

// ---- 2. Tẩy luyện ---------------------------------------------------------------------------------------------------

export interface SubStat {
  stat: string;
  ten: string;
  gt: string;
}
const sub = (stat: string, ten: string, gt: string): SubStat => ({ stat, ten, gt });
/** 4 loại chỉ số phụ của mỗi ô, loại 1 là mặc định; giá trị ở lục +0 (đã chia đôi ngày 2026-11-04). */
export const SUB: Record<GearSlot, SubStat[]> = {
  vu_khi: [sub("critDamage", "Sát thương chí mạng", "+2%"), sub("armorPen", "Xuyên giáp", "+1%"), sub("attackSpeed", "Tốc đánh", "+1%"), sub("lifesteal", "Hút máu", "+0,5%")],
  mu: [sub("manaMax", "Mana tối đa", "+2%"), sub("cooldownCut", "Giảm hồi chiêu", "0,5%"), sub("controlTime", "Thời gian khống chế", "+2%"), sub("healPower", "Hiệu quả hồi máu và khiên", "+1%")],
  ao: [sub("hp", "Máu", "+1,5%"), sub("shieldTaken", "Khiên nhận", "+2%"), sub("healTaken", "Hồi máu nhận", "+1%"), sub("manaMax", "Mana tối đa", "+1%")],
  dai: [sub("healTaken", "Hồi máu nhận", "+1%"), sub("hp", "Máu", "+1%"), sub("healPower", "Hiệu quả hồi máu và khiên", "+1%"), sub("shieldTaken", "Khiên nhận", "+1%")],
  bao_tay: [sub("critBonus", "Chí mạng", "+0,5%"), sub("critDamage", "Sát thương chí mạng", "+1%"), sub("resistPen", "Xuyên kháng", "+1%"), sub("attackSpeed", "Tốc đánh", "+0,5%")],
  giay: [sub("attackSpeed", "Tốc đánh", "+1%"), sub("cooldownCut", "Giảm hồi chiêu", "0,5%"), sub("controlTime", "Thời gian khống chế", "+2%"), sub("def", "Phòng thủ", "+1%")],
  ngoc_boi: [sub("cooldownCut", "Giảm hồi chiêu", "0,5%"), sub("manaMax", "Mana tối đa", "+1%"), sub("dot", "Sát thương theo thời gian", "+2%"), sub("resistPen", "Xuyên kháng", "+1%")],
};
/** Mỗi lần tẩy luyện tốn 2 Khí Tinh, cộng linh thạch theo độ hiếm (số chờ sheet Tẩy luyện). */
export const REROLL_KHI_TINH = 2;

/** Người thường quay ngẫu nhiên trong 3 loại còn lại. */
export function rerollSub(cur: number): number {
  const others = [0, 1, 2, 3].filter((i) => i !== cur);
  return others[Math.floor(Math.random() * others.length)];
}

// ---- 3. Khí linh và khí văn -------------------------------------------------------------------------------------------

export const KL_MAX = 9;
/** Kinh nghiệm để lên cấp kế tiếp: 100 × cấp kế (cấp 9 cần tổng 4.500). */
export const klNeed = (cap: number) => (cap >= KL_MAX ? 0 : 100 * (cap + 1));
export const KL_PER_KHI_TINH = 10;
/** Mỗi cấp +0,5% chỉ số gốc của món (phần nghìn). */
export const klBonus = (cap: number) => cap * 5;
/** Ô khí văn mở ở cấp 3, 6, 9; tím tối đa 1 ô, vàng 2, đỏ 3. */
export const VAN_AT = [3, 6, 9];
export const vanSlots = (r: Rarity): number => ({ luc: 0, lam: 0, tim: 1, vang: 2, do: 3 })[r];
export const hasKhiLinh = (r: Rarity) => atLeast(r, "tim");
/** Một khí văn trên nhiều món chỉ tính tối đa 2 lần. */
export const VAN_STACK = 2;
/** Tẩy văn (quay lại 3 lựa chọn) tốn 1 Linh Văn Thạch. */
export const VAN_REROLL = 1;

export interface KhiVan {
  ma: string;
  ten: string;
  tac: string;
}
const kv = (ma: string, ten: string, tac: string): KhiVan => ({ ma, ten, tac });
/** Ô công: vũ khí, bao tay, ngọc bội. */
export const VAN_CONG: KhiVan[] = [
  kv("KV-CO-001", "Phá Thuẫn Văn", "Đòn đầu tiên lên mục tiêu đang có khiên +10% sát thương"),
  kv("KV-CO-002", "Truy Mệnh Văn", "Mục tiêu dưới 20% máu nhận thêm 5% sát thương"),
  kv("KV-CO-003", "Tiên Phát Văn", "Chiêu đầu tiên mỗi trận +15% sát thương"),
  kv("KV-CO-004", "Liên Kích Văn", "Đánh cùng mục tiêu 3 lần liên tiếp thì lần thứ 3 +8% sát thương"),
  kv("KV-CO-005", "Khắc Hệ Văn", "Đánh hệ mình khắc: hệ số ×1,5 thành ×1,53"),
  kv("KV-CO-006", "Tụ Linh Văn", "Hạ gục kẻ địch thì hồi 3% mana"),
  kv("KV-CO-007", "Phá Trận Văn", "Sát thương lên trận nhãn, hộ trận +3% (chiến tranh)"),
  kv("KV-CO-008", "Liệp Yêu Văn", "Sát thương lên dị thú và boss PvE +4%"),
];
/** Ô thủ: mũ, áo, đai, giày. */
export const VAN_THU: KhiVan[] = [
  kv("KV-TH-001", "Hộ Mệnh Văn", "Lần đầu máu dưới 25%: khiên 8% máu tối đa"),
  kv("KV-TH-002", "Ngự Khắc Văn", "Trúng đòn hệ khắc mình: hệ số ×1,5 thành ×1,47"),
  kv("KV-TH-003", "Phản Chấn Văn", "Phản 3% sát thương cận chiến nhận được"),
  kv("KV-TH-004", "Thiết Bích Văn", "Đứng hàng trước: phòng thủ +3%"),
  kv("KV-TH-005", "Tĩnh Tâm Văn", "Đứng hàng sau: mana tối đa +3%"),
  kv("KV-TH-006", "Hồi Xuân Văn", "Hồi 1% máu mỗi 5 s"),
  kv("KV-TH-007", "Định Thân Văn", "Bị đẩy lùi thì đứng lại sau 0,5 s thay vì bị đẩy hết ô"),
  kv("KV-TH-008", "Tị Kiếp Văn", "Lôi kiếp gây ít hơn 5% sát thương (ngoài trận)"),
];
const CONG_SLOTS: GearSlot[] = ["vu_khi", "bao_tay", "ngoc_boi"];
export const vanPool = (s: GearSlot) => (CONG_SLOTS.includes(s) ? VAN_CONG : VAN_THU);
export const vanGroup = (s: GearSlot) => (CONG_SLOTS.includes(s) ? "công" : "thủ");
export const khiVan = (ma: string) => [...VAN_CONG, ...VAN_THU].find((x) => x.ma === ma);

/** 3 khí văn quay ngẫu nhiên từ nhóm của ô. */
export function rollOffer(s: GearSlot): string[] {
  const pool = vanPool(s).map((x) => x.ma);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, 3);
}

// ---- 4. Ngọc ------------------------------------------------------------------------------------------------------------

const GEM_CAP = NGOC.cap as { cap: number; gia_tri: number; ty_le_nen_len: number | null }[];
/** Giá trị một viên thường theo cấp (phần nghìn) và tỷ lệ đậu khi nén lên cấp đó (phần nghìn). */
export const gemValue = (cap: number) => GEM_CAP[cap - 1]?.gia_tri ?? 0;
export const gemRate = (cap: number) => GEM_CAP[cap - 1]?.ty_le_nen_len ?? 1000;
export const GEM_NAME: Record<string, string> = Object.fromEntries((NGOC.he as { he: string; ten: string }[]).map((h) => [h.he, h.ten]));
export const SONG_HE_FROM = 7;
/** Viên song hệ cho mỗi hệ 60% giá trị một viên thường. */
export const SONG_HE_PART = 600;
/** Hai hệ tương sinh hoặc tương hợp (mạch "sinh" của bảng quan hệ). */
export const songHeOk = (a: Element, b: Element) => a !== b && machBetween(a, b) === "sinh";

export const PHACH_FROM = 10;
export const PHACH_KHI_TINH = 20;
export const PHACH_RATE = 300;
const PHACH: Record<string, string> = {
  kim: "Canh Kim Phách", moc: "Thanh Mộc Phách", thuy: "Huyền Thủy Phách", hoa: "Xích Diễm Phách", tho: "Hậu Thổ Phách", loi: "Tử Lôi Phách",
  phong: "Thanh Phong Phách", quang: "Diệu Quang Phách", am_lanh: "U Lãnh Phách", cuc_duong: "Thuần Dương Phách", cuc_am: "Huyền Âm Phách", cuc_han: "Hàn Tủy Phách",
};
const ELEMENT_ORDER = (NGOC.he as { he: string }[]).map((h) => h.he);
export const phachName = (he: string) => PHACH[he] ?? he;
export const phachCode = (he: string) => `NG-PH-${String(ELEMENT_ORDER.indexOf(he) + 1).padStart(3, "0")}`;
/** Trần mềm sát thương hệ từ ngọc (phần nghìn): 25%, có Phách hệ đó thì 28%. */
export const DMG_CAP = (NGOC.tran as { satThuongToiDa: number }).satThuongToiDa;
export const DMG_CAP_PHACH = 280;

// ---- 5. Danh khí ----------------------------------------------------------------------------------------------------------

export interface DanhKhi {
  ma: string;
  ten: string;
  khiHinh: string;
  hinh: string;
  van: string;
}
const dk = (n: number, ten: string, khiHinh: string, hinh: string, van: string): DanhKhi => ({ ma: `TB-KI-0${60 + n}`, ten, khiHinh, hinh, van });
export const DANH_KHI: DanhKhi[] = [
  dk(1, "Thiên Vấn Kiếm", "kiem", "Kiếm", "Cận chiến đơn chí mạng thì chiêu đó hồi chiêu nhanh 0,5 s"),
  dk(2, "Đoạn Nhạc Đao", "dao", "Đao", "Mỗi mục tiêu trúng quét từ thứ 3 trở đi cho người cầm khiên 1% máu tối đa"),
  dk(3, "Lạc Tinh Cung", "cung", "Cung", "Đòn tầm xa vào kẻ đang vận công +20% sát thương"),
  dk(4, "Phong Lôi Phiến", "phien", "Phiến", "Diện rộng trúng từ 6 mục tiêu thì lần vận công kế tiếp nhanh gấp đôi"),
  dk(5, "Bất Động Côn", "con", "Côn", "Khiên hộ thể của người cầm đỡ thêm 1 lần khống chế cho người được che"),
  dk(6, "Tạo Hóa Bút", "but", "Bút", "Bùa chú thêm 1 lần mỗi trận, mỗi lần −15% sát thương"),
  dk(7, "Tinh La Kỳ", "ky", "Kỳ", "Trận pháp bày xong thì đồng đội đứng trong trận +5% phòng thủ"),
  dk(8, "Vọng Nguyệt Cầm", "cam", "Cầm", "Hồi phục giải luôn 1 hiệu ứng thiêu đốt hoặc độc"),
  dk(9, "Ngọc Lâu Tiêu", "tieu", "Tiêu", "Khống chế trúng kẻ đang vận công thì chiêu đó mất luôn, không hoàn hồi chiêu"),
  dk(10, "Phá Thiên Thương", "thuong", "Thương", "Lướt tới xong, đòn kế tiếp xuyên 20% khiên"),
];
/** Đồ phổ NL-DP-001…010 theo thứ tự danh khí. */
export const doPhoCode = (i: number) => `NL-DP-${String(i + 1).padStart(3, "0")}`;
export const DANH_KHI_COST = { vanThiet: 5, khiTinh: 50, hoLo: 3 };
/** Lò từ cấp 9; tỷ lệ thành theo cấp lò (phần nghìn). */
export const LO_MIN = 9;
export const loRate = (lv: number) => (lv >= 10 ? 600 : lv >= 9 ? 400 : 0);

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
  entries: BaoEntry[];
  /** Phần thưởng khi đủ trang: đề xuất của tab giao diện, chờ sheet Bảo Giám. Không cộng chỉ số chiến đấu. */
  thuong: string;
}
const ART_DIR: Record<GearSlot, string> = { vu_khi: "kiem", mu: "mu", ao: "ao", dai: "dai", bao_tay: "bao_tay", giay: "giay", ngoc_boi: "ngoc_boi" };
const gearPage = (s: GearSlot): BaoPage => ({
  id: s,
  ten: SLOT_NAMES[s],
  // Vũ khí 70 kiểu đã gồm 10 danh khí TB-KI-061…070 (nguồn luyen_danh_khi).
  entries: KIEU.filter((k) => k.o === s).map((k) => ({ ma: k.ma_vp, ten: k.ten, rarity: k.do_hiem, art: `trang_bi/${ART_DIR[s]}/${String(k.so).padStart(2, "0")}` })),
  thuong: s === "vu_khi" ? "Ánh sáng vũ khí" : `Khung ô ${SLOT_NAMES[s].toLowerCase()}`,
});
export const BAO_PAGES: BaoPage[] = [
  ...SLOTS.map(gearPage),
  { id: "phap_bao", ten: "Pháp bảo", entries: (PHAP_BAO.mon as { ma_vp: string; ten: string; do_hiem: Rarity }[]).map((m) => ({ ma: m.ma_vp, ten: m.ten, rarity: m.do_hiem })), thuong: "Danh hiệu" },
  { id: "phap_khi", ten: "Pháp khí", entries: (PHAP_KHI.mon as { ma_vp: string; ten: string; do_hiem: Rarity }[]).map((m) => ({ ma: m.ma_vp, ten: m.ten, rarity: m.do_hiem })), thuong: "Thêm ô kho" },
  { id: "y_chau", ten: "Ý châu", entries: (NGOC.y_chau as { ma_vp: string; ten: string }[]).map((m) => ({ ma: m.ma_vp, ten: m.ten })), thuong: "Khí Tinh" },
  { id: "an_bo", ten: "Ấn bộ", entries: (NGOC.an_bo as { ma_vp: string; ten: string; he: string | null }[]).map((m) => ({ ma: m.ma_vp, ten: m.ten, he: m.he ?? undefined })), thuong: "Thêm ô túi" },
  { id: "phach", ten: "Ngọc Phách", entries: ELEMENT_ORDER.map((he) => ({ ma: phachCode(he), ten: phachName(he), he })), thuong: "Danh hiệu" },
];

// ---- Trạng thái mẫu ----------------------------------------------------------------------------------------------------

export interface KhiLinh {
  cap: number;
  exp: number;
}
export interface LkSlot {
  /** Loại chỉ số phụ đang có (0–3). */
  sub: number;
  kl: KhiLinh;
  /** Khí văn theo ô (3, 6, 9); null là ô đã mở mà chưa chọn. */
  van: (string | null)[];
  /** 3 lựa chọn đang chờ cho ô khí văn `offerAt`. */
  offer?: string[];
  offerAt?: number;
}
export interface LkGem {
  id: string;
  he: Element;
  he2?: Element;
  cap: number;
  n: number;
}
export interface LkState {
  khiTinh: number;
  khiTinhKhoa: number;
  linhVanThach: number;
  vanThiet: number;
  slots: Partial<Record<GearSlot, LkSlot>>;
  /** uid món đã phân giải (ẩn khỏi túi ở màn). */
  gone: Set<number>;
  gems: LkGem[];
  phach: Element[];
  /** Mã kiểu từng sở hữu (Bảo Giám), kể cả món đã phân giải. */
  owned: Set<string>;
  doPho: Set<string>;
  week: { text: string; have: number; need: number; thuong: string; endsAt: number };
}

let shared: LkState | undefined;
/** Trạng thái mẫu dùng chung cho màn Nhân vật và Luyện Khí Các (TẠM, sống đến khi tải lại trang). */
export function lkState(v: NhanVatView): LkState {
  return (shared ??= sampleLuyenKhi(v, v.serverNow));
}
/**
 * Công cụ xem thử của prototype: cảnh giới (chỉ số trong REALMS của daoCoBan.ts, mặc định Luyện Hư để mở đủ các phần)
 * và có xem như Tu rèn không (mặc định theo tài năng thật).
 */
export const lkPreview: { realm: number; tuRen?: boolean } = { realm: 5 };

/** Số lần một khí văn đang có trên mọi món (tính tối đa VAN_STACK). */
export function vanCount(st: LkState, ma: string): number {
  return Object.values(st.slots).reduce((n, s) => n + (s?.van.filter((x) => x === ma).length ?? 0), 0);
}

/** Nạp kinh nghiệm; trả về các cấp vừa vượt. */
export function addExp(kl: KhiLinh, exp: number): number[] {
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
export const khiTinhToNext = (kl: KhiLinh) => Math.ceil(Math.max(0, klNeed(kl.cap) - kl.exp) / KL_PER_KHI_TINH);

/** Đồng bộ ô khí văn với cấp khí linh: mở ô đến cấp 3, 6, 9 theo độ hiếm. */
export function syncVan(s: LkSlot, r: Rarity): void {
  const open = VAN_AT.filter((at, i) => i < vanSlots(r) && s.kl.cap >= at).length;
  while (s.van.length < open) s.van.push(null);
}

/**
 * Mẫu TẠM cho Lăng Vân: dùng đồ đang mặc của nguồn đọc; vũ khí tím khí linh 4 đã chọn 1 văn, áo tím sắp lên cấp 3,
 * ngọc bội vàng cấp 6 còn ô văn thứ hai chờ chọn. Ngọc cấp cao, Khí Tinh và sổ Bảo Giám cũng là mẫu.
 */
export function sampleLuyenKhi(v: NhanVatView, now: number): LkState {
  const slots: Partial<Record<GearSlot, LkSlot>> = {};
  const preset: Partial<Record<GearSlot, Omit<LkSlot, "van"> & { van?: (string | null)[] }>> = {
    vu_khi: { sub: 0, kl: { cap: 4, exp: 150 }, van: ["KV-CO-003"] },
    ao: { sub: 1, kl: { cap: 2, exp: 260 } },
    ngoc_boi: { sub: 2, kl: { cap: 6, exp: 300 }, van: ["KV-CO-001", null] },
    giay: { sub: 3, kl: { cap: 0, exp: 0 } },
  };
  for (const s of SLOTS) {
    const g = v.gear[s];
    if (!g) continue;
    const p = preset[s];
    const slot: LkSlot = { sub: p?.sub ?? 0, kl: hasKhiLinh(g.rarity) ? { ...(p?.kl ?? { cap: 0, exp: 0 }) } : { cap: 0, exp: 0 }, van: [...(p?.van ?? [])] };
    syncVan(slot, g.rarity);
    slots[s] = slot;
  }
  const owned = new Set<string>();
  for (const g of Object.values(v.gear)) if (g?.code) owned.add(g.code);
  for (const it of v.bag.items) if (it.code && it.gear) owned.add(it.code);
  const seen = ["TB-KI-001", "TB-KI-002", "TB-KI-003", "TB-KI-005", "TB-KI-008", "TB-KI-013", "TB-KI-021", "TB-KI-030", "TB-MU-001", "TB-MU-002", "TB-MU-004", "TB-MU-007", "TB-MU-011", "TB-MU-016",
    "TB-AO-001", "TB-AO-003", "TB-AO-009", "TB-DA-002", "TB-DA-005", "TB-GI-001", "TB-GI-006", "TB-BT-001", "TB-NB-002", "PB-TH-001", "PK-CU-001", "NG-AN-001", "NG-AN-003", "NG-AN-010", "NG-YC-001"];
  for (const c of seen) owned.add(c);
  return {
    khiTinh: 46,
    khiTinhKhoa: 18,
    linhVanThach: 3,
    vanThiet: 2,
    slots,
    gone: new Set(),
    gems: [
      { id: "g1", he: "loi", cap: 7, n: 2 },
      { id: "g2", he: "quang", cap: 7, n: 1 },
      { id: "g3", he: "hoa", cap: 7, n: 1 },
      { id: "g4", he: "tho", cap: 7, n: 1 },
      { id: "g5", he: "kim", cap: 10, n: 1 },
      { id: "g6", he: "loi", cap: 10, n: 1 },
    ],
    phach: [],
    owned,
    doPho: new Set([doPhoCode(0)]),
    week: { text: "Mặc 3 món khí hình Cầm khác nhau trong tuần", have: 1, need: 3, thuong: "Linh Văn Thạch", endsAt: now + 3 * 86_400_000 + 5 * 3_600_000 },
  };
}

// Trạng thái mẫu cho dashboard khi chưa có server giả (Sprint 5).
// Phần tông môn, tàn quyển, công pháp dựng bằng chính lệnh của @ktlp/rules qua apply(); phần luật chưa có
// (mỏ, hành trình, trang bị, thú cưỡi, liên minh) là dữ liệu tạm ở đây, số lấy từ data/he_thong/json.
// Tên người, tên tông môn và số lượng là tự đặt cho bản mẫu.
import { addMember, addSect, apply, emptyState, type Bac, type BoardPiece, type Command, type GameState, type Role } from "@ktlp/rules";
import type { Element } from "@ktlp/sim";
import type { SectModel } from "../art/sectScene.ts";
import type { BagItem, Building, GearItem, GearSlot, LuyenKhiSlot, LuyenKhiView, PointType, Rarity } from "../source.ts";
import { doPhoCode, hasKhiLinh, rollOffer, syncVan } from "../luyenKhi.ts";
import { HOLDABLE, stagesFrom, type RegionMap } from "../../scenes/map/region.ts";
import NGOC from "../../../../data/he_thong/json/ngoc.json";

export const PLAYER = "p1";
export const SECT = "loi_tri_phong";
export const REGION = "loi_dinh_coc";
/** Hạt giống bốc chỗ sơn môn: cố định để bản mẫu giống nhau mỗi lần tải; máy chủ thật bốc ngẫu nhiên khi lập tông. */
const LANDING_SEED = 20_261_104;
/** Tầm Truyền Tống Trận lớn nhất ở Hạ vị: chỗ bốc cách sơn môn tông mạnh hơn quá chừng này chặng (đề xuất GDD mục 7). */
const SAFE_STAGES = 5;
/** Phần chỗ sơn môn còn trống của mỗi vùng đã có tông NPC lập (bản mẫu). */
const NPC_SHARE = 0.3;

const H = 3600_000;
const MIN = 60_000;

/**
 * Dòng ẩn thật của một món (ngọc bội, đai): `lo` là phần người chơi đã thấy ("an" chưa lộ, "dk" đã lộ điều kiện, "het" đã
 * kích phát nên lộ cả hai). Nguồn chỉ gửi phần đã lộ (GearItem.hiddenLines).
 */
export interface DongAnRaw { dk: string; hu: string; lo: "an" | "dk" | "het" }

/** Món trong trạng thái mẫu: món của màn kèm phần chỉ server giữ (dòng ẩn thật, loại phụ chọn ở mỗi mốc rèn). */
export interface WorldGear extends GearItem {
  dongAn?: DongAnRaw[];
  /** Dòng rèn: loại chỉ số phụ 1–4 chọn ở mỗi mốc +10, +20, +30 (như EquipItem.ren). */
  ren?: number[];
}

export interface HeldPoint {
  pointId: number;
  type: PointType;
  level: number;
  uncollectedSince: number;
  attacked?: { by: string; endsAt: number };
}

export interface OtherSect {
  id: string;
  name: string;
  level: number;
  faction: string;
  sonMon: number;
  points: number[];
  ally: boolean;
  online: number;
  color: string;
}

export interface Job {
  kind: "hanh_trinh" | "xay" | "ren" | "luyen_dan" | "be_quan";
  title: string;
  detail: string;
  startsAt: number;
  endsAt: number;
}

export interface World {
  rules: GameState;
  region: RegionMap;
  sonMon: number;
  names: Record<string, string>;
  online: Record<string, boolean>;
  npc: Record<string, boolean>;
  player: {
    name: string;
    roots: Element[];
    talent: "tu_the";
    exp: number;
    linhThach: number;
    tienNgoc: number;
    satNghiep: number;
    gear: Partial<Record<GearSlot, WorldGear>>;
    mounts: (string | null)[];
    /** Ô của thú đang cưỡi. */
    riding: number;
    /** Món trong túi chưa có luật (đồ, ngọc, đan, nguyên liệu, phù, trứng thú); tàn quyển lấy từ @ktlp/rules. */
    bag: BagItem[];
    /** Đạo Cơ Bàn: mã ô → viên đang đặt. */
    board: Record<string, BoardPiece>;
    /** Luyện khí: Khí Tinh, khí linh và khí văn theo ô, ngọc cấp cao, Phách, sổ Bảo Giám. */
    luyenKhi: LuyenKhiView;
    nextUid: number;
  };
  sect: { name: string; model: SectModel; xp: number; faction: string; vault: { linhThach: number; quang: number; duoc: number } };
  held: HeldPoint[];
  sects: OtherSect[];
  applicants: { id: string; name: string; level: number }[];
  wars: { id: number; with: string; direction: "di" | "den"; startsAt: number }[];
  /** Yêu Triều (GDD mục 17): yêu thú tràn vào vùng biên trong một khung giờ; maxRing chọn các điểm sát rìa ngoài. */
  tides: { title: string; startsAt: number; endsAt: number; maxRing: number }[];
  jobs: Job[];
  buildings: Building[];
  travel: { from: number; to: number; startsAt: number; endsAt: number };
  /** arena: bản đồ chiến trường "<vùng>/<bối cảnh>" (chien_truong/) hay sân san_dau/<tên> của màn Trận; bỏ trống là võ trường. */
  reports: { id: number; seed: number; title: string; at: number; arena?: string }[];
  mail: { id: number; from: string; title: string; body: string; unread: boolean }[];
  alliance: { joined: boolean; name: string; leader: string };
  chat: { id: number; from: string; text: string; at: number; reported?: boolean }[];
  nextChat: number;
}

/** Phẩm lọc túi theo độ hiếm (đề xuất GDD rev 217): lục, lam là hạ; tím là trung; vàng, đỏ là cao. */
export const RARITY_GRADE: Record<Rarity, BagItem["grade"]> = { luc: "ha", lam: "ha", tim: "trung", vang: "cao", do: "cao" };
export const RARITY_LABEL: Record<Rarity, string> = { luc: "Lục", lam: "Lam", tim: "Tím", vang: "Vàng", do: "Đỏ" };

const GEMS = NGOC.he as { ma_vp: string; he: Element; ten: string }[];
const SEALS = NGOC.an_bo as { ma_vp: string; ten: string; bo: string }[];

/** Món túi của một viên Đạo Cơ Bàn: ấn bộ, hoặc ngọc hệ (phẩm lọc theo cấp như túi mẫu). */
export function pieceBagItem(uid: number, piece: BoardPiece, count = 1): BagItem {
  if (piece.loai === "an") {
    const a = SEALS.find((x) => x.ma_vp === piece.ma)!;
    const bac: Bac = piece.bac ?? "tim";
    return {
      uid, kind: "ngoc", name: a.ten, grade: RARITY_GRADE[bac], gradeLabel: `Ấn bộ ${RARITY_LABEL[bac]}`, count, code: a.ma_vp, rarity: bac,
      detail: "Khảm vào đồ hoặc đặt lên Đạo Cơ Bàn: tính thêm một món cho bộ. Ba viên cùng bộ cùng bậc lục hoặc lam ghép thành một viên bậc trên.", boardPiece: piece,
    };
  }
  const g = GEMS.find((x) => x.he === piece.he)!;
  return {
    uid, kind: "ngoc", name: g.ten, grade: piece.cap >= 3 ? "cao" : piece.cap === 2 ? "trung" : "ha", gradeLabel: `Cấp ${piece.cap}`, count, element: piece.he,
    icon: `he/${piece.he}`, art: `ngoc/${piece.he}`, code: g.ma_vp, detail: "Khảm vào dòng đã kích hoạt, hoặc đặt lên Đạo Cơ Bàn để dẫn mạch.", boardPiece: piece,
  };
}

/** Hai viên cùng loại (để gộp chồng trong túi). */
export function samePiece(a: BoardPiece, b: BoardPiece): boolean {
  return a.loai === "an" ? b.loai === "an" && a.ma === b.ma && (a.bac ?? "tim") === (b.bac ?? "tim") : b.loai === "ngoc" && a.he === b.he && a.cap === b.cap;
}

/** Túi mẫu: đồ dự phòng, ngọc, ấn bộ, đan, nguyên liệu, phù và một trứng thú; uid từ 10.000 để khỏi trùng uid tàn quyển. */
function sampleBag(): BagItem[] {
  let uid = 10_000;
  const gear = (g: Omit<WorldGear, "durability" | "durabilityMax" | "gems"> & { durability?: number }, detail: string): BagItem => ({
    uid: uid++, kind: "trang_bi", name: g.name, grade: RARITY_GRADE[g.rarity], gradeLabel: RARITY_LABEL[g.rarity],
    count: 1, icon: g.icon, art: g.art, rarity: g.rarity, code: g.code, detail, gear: { durability: 100, durabilityMax: 100, gems: [], ...g },
  });
  // art, code theo assets/icon_ve/danh_sach.json; ngọc giữ ký hiệu hệ PixelLab làm hình dự phòng.
  // Ngọc hệ đặt được lên Đạo Cơ Bàn, cấp lấy từ nhãn "Cấp N".
  const item = (kind: BagItem["kind"], name: string, grade: BagItem["grade"], gradeLabel: string, count: number, detail: string, art: string, code: string, element?: Element): BagItem => ({
    uid: uid++, kind, name, grade, gradeLabel, count, detail, element, art, code, icon: kind === "ngoc" && element ? `he/${element}` : undefined,
    boardPiece: kind === "ngoc" && element ? { loai: "ngoc", he: element, cap: Number(/\d+/.exec(gradeLabel)?.[0] ?? 1) } : undefined,
  });
  return [
    // Vũ khí đủ 10 khí hình (kiếm, đao, côn, thương, cung, phiến, bút, kỳ, cầm, tiêu), hình vẽ Canva theo danh_sach.json.
    gear({ slot: "vu_khi", name: "Đao Hổ Khiếu", plus: 2, sockets: 1, stats: { atk: 90 }, art: "trang_bi/kiem/31", rarity: "lam", code: "TB-KI-031" }, "Đao rèn ở lò thành chủ."),
    gear({ slot: "vu_khi", name: "Đao Hàn Nguyệt", plus: 1, sockets: 2, stats: { atk: 112 }, art: "trang_bi/kiem/51", rarity: "tim", code: "TB-KI-051" }, "Đao lạnh, chém quét mạnh."),
    gear({ slot: "vu_khi", name: "Côn Kim Cang", plus: 0, sockets: 2, stats: { atk: 105, def: 20 }, art: "trang_bi/kiem/44", rarity: "tim", code: "TB-KI-044" }, "Rơi ở bí cảnh Mộc."),
    gear({ slot: "vu_khi", name: "Thương Lôi Minh", plus: 0, sockets: 2, stats: { atk: 115 }, art: "trang_bi/kiem/43", rarity: "tim", code: "TB-KI-043" }, "Thương có vân sấm, hợp lối lướt tới."),
    gear({ slot: "vu_khi", name: "Cung Xạ Nhật", plus: 0, sockets: 3, stats: { atk: 140 }, art: "trang_bi/kiem/54", rarity: "vang", code: "TB-KI-054" }, "Cung tầm xa của thần xạ."),
    gear({ slot: "vu_khi", name: "Phiến Hàn Băng", plus: 0, sockets: 2, stats: { atk: 100, mana: 30 }, art: "trang_bi/kiem/46", rarity: "tim", code: "TB-KI-046" }, "Quạt pháp, đánh diện rộng."),
    gear({ slot: "vu_khi", name: "Bút Phán Quan", plus: 0, sockets: 1, stats: { atk: 85, mana: 30 }, art: "trang_bi/kiem/36", rarity: "lam", code: "TB-KI-036" }, "Bút vẽ bùa chú."),
    gear({ slot: "vu_khi", name: "Kỳ Ngũ Hành", plus: 0, sockets: 1, stats: { atk: 80, def: 15 }, art: "trang_bi/kiem/37", rarity: "lam", code: "TB-KI-037" }, "Cờ bày trận pháp."),
    gear({ slot: "vu_khi", name: "Cầm Tiêu Vĩ", plus: 0, sockets: 2, stats: { atk: 95, mana: 40 }, art: "trang_bi/kiem/49", rarity: "tim", code: "TB-KI-049" }, "Đàn hồi phục, giải hiệu ứng xấu."),
    gear({ slot: "vu_khi", name: "Tiêu Bích Ngọc", plus: 0, sockets: 1, stats: { atk: 85, mana: 25 }, art: "trang_bi/kiem/39", rarity: "lam", code: "TB-KI-039" }, "Tiêu khống chế bằng âm luật."),
    gear({ slot: "mu", name: "Nón Lá Tị Thủy", plus: 1, sockets: 1, stats: { hp: 700, def: 25 }, art: "trang_bi/mu/10", rarity: "luc", code: "TB-MU-010" }, "Nón lá đan bằng cỏ linh."),
    gear({ slot: "mu", name: "Ngọc Quan Tử Vân", plus: 3, sockets: 2, stats: { hp: 1200, def: 40 }, art: "trang_bi/mu/25", rarity: "lam", code: "TB-MU-025" }, "Mũ ngọc của chân truyền."),
    gear({ slot: "ao", name: "Giáp Huyền Thiết", plus: 0, sockets: 2, stats: { hp: 2400, def: 90 }, art: "trang_bi/ao/26", rarity: "lam", code: "TB-AO-026" }, "Giáp nặng, thủ cao."),
    gear({ slot: "dai", name: "Đai Lôi Văn", plus: 0, sockets: 1, stats: { hp: 500, def: 35 }, art: "trang_bi/dai/25", rarity: "lam", code: "TB-DA-025", dongAn: [{ dk: "DN-DK-010", hu: "DN-HU-007", lo: "an" }] }, "Đai thêu vân sấm."),
    gear({ slot: "giay", name: "Giày Đạp Vân", plus: 1, sockets: 1, stats: { hp: 600, def: 30 }, art: "trang_bi/giay/25", rarity: "lam", code: "TB-GI-025" }, "Giày nhẹ của thân pháp sư."),
    gear({ slot: "vu_khi", name: "Kiếm Huyết Long", plus: 0, sockets: 3, stats: { atk: 160 }, art: "trang_bi/kiem/58", rarity: "do", code: "TB-KI-058" }, "Thần vật rơi ở bí cảnh cao."),
    item("ngoc", "Ngọc Lôi", "trung", "Cấp 2", 3, "Khảm vào dòng đã kích hoạt: tăng sát thương hoặc kháng Lôi.", "ngoc/loi", "NG-KH-006", "loi"),
    item("ngoc", "Ngọc Hỏa", "ha", "Cấp 1", 5, "Khảm vào dòng đã kích hoạt: tăng sát thương hoặc kháng Hỏa.", "ngoc/hoa", "NG-KH-004", "hoa"),
    item("ngoc", "Ngọc Kim", "cao", "Cấp 3", 1, "Khảm vào dòng đã kích hoạt: tăng sát thương hoặc kháng Kim.", "ngoc/kim", "NG-KH-001", "kim"),
    item("ngoc", "Ngọc Thủy", "ha", "Cấp 1", 2, "Ba viên cùng hệ cùng cấp nén thành một viên cấp trên.", "ngoc/thuy", "NG-KH-003", "thuy"),
    item("ngoc", "Ngọc Thổ", "trung", "Cấp 2", 2, "Khảm vào dòng đã kích hoạt, hoặc đặt lên Đạo Cơ Bàn để dẫn mạch.", "ngoc/tho", "NG-KH-005", "tho"),
    // Ấn bộ: Bàn Thạch (Thổ) và Tụ Bảo (Kim) có 2 món trên đồ nên đặt lên bàn thì thêm món; Bách Thảo (Mộc) khắc Thổ.
    // Bàn Thạch lam đủ 3 viên để thử ghép lên tím (ghep_an).
    pieceBagItem(uid++, { loai: "an", ma: "NG-AN-003", bac: "lam" }, 3),
    pieceBagItem(uid++, { loai: "an", ma: "NG-AN-001", bac: "luc" }),
    pieceBagItem(uid++, { loai: "an", ma: "NG-AN-002", bac: "lam" }),
    item("ngoc", "Binh Ấn Liên Kích", "ha", "Binh ấn Lam", 1, "Khảm vào vũ khí, bao tay hoặc ngọc bội: 2 và 3 binh ấn cùng bộ mở mốc của binh bộ.", "binh_an/lien_kich", "NG-BA-003"),
    item("phu", "Giám Định Phù", "trung", "Phù", 2, "Lộ trước điều kiện kích phát của 1 dòng ẩn trên ngọc bội hoặc đai.", "phu/giam_dinh", "PH-CH-011"),
    item("dan", "Hồi Khí Đan", "ha", "Đan dược", 10, "Hồi mana trong trận.", "dan/dan_duoc_hoi_mana", "DA-DD-002"),
    item("dan", "Bổ Huyết Đan", "ha", "Đan dược", 6, "Hồi máu trong trận.", "dan/dan_duoc_hoi_mau", "DA-DD-001"),
    item("dan", "Tụ Linh Đan", "trung", "Linh đan", 2, "Tăng tốc tu luyện khi bế quan.", "dan/linh_dan_tu_luyen", "DA-LD-003"),
    item("dan", "Phá Cảnh Đan", "cao", "Thần đan", 1, "Dùng khi đột phá cảnh giới, giảm lôi kiếp.", "dan/than_dan_pha_canh", "DA-TD-001"),
    item("nguyen_lieu", "Thiết tinh", "ha", "Quặng", 40, "Rèn và sửa đồ ở Hạ vị.", "quang/thiet_tinh", "QU-BA-001"),
    item("nguyen_lieu", "Huyền thiết", "trung", "Quặng", 12, "Rèn đồ thiên cấp.", "quang/huyen_thiet", "QU-BA-002"),
    item("nguyen_lieu", "Linh thảo", "ha", "Dược liệu", 25, "Luyện đan dược phẩm thấp.", "duoc/linh_thao", "DL-TH-001"),
    item("nguyen_lieu", "Tử Lôi Thảo", "trung", "Dược liệu", 4, "Dược liệu hệ Lôi.", "duoc/tu_loi_thao", "DL-HI-001", "loi"),
    item("phu", "Phù chống sét", "trung", "Phù", 3, "Đỡ một đợt lôi kiếp khi đột phá.", "phu/chong_set", "PH-CH-001"),
    item("phu", "Phù bảo ngọc", "cao", "Phù", 1, "Giữ lại ngọc khi nén thất bại.", "phu/bao_ngoc", "PH-CH-002"),
    item("phu", "Phù bảo hộ", "trung", "Phù", 2, "Giữ nguyên nấc khi rèn từ +21 thất bại.", "phu/bao_ho", "PH-CH-003"),
    item("trung_thu", "Trứng Lôi Tước", "trung", "Trứng thú", 1, "Nở ra Lôi Tước khi còn trống một ô thú.", "trung_thu/thuong", "TT-TH-001", "loi"),
  ];
}

/**
 * Luyện khí mẫu (cùng số với mẫu tạm của màn trước đây): vũ khí tím khí linh 4 đã chọn 1 văn, áo tím sắp lên cấp 3,
 * ngọc bội vàng cấp 6 còn ô văn thứ hai chờ chọn; ngọc cấp cao, Khí Tinh, sổ Bảo Giám là số tự đặt.
 */
function sampleLuyenKhi(gear: Partial<Record<GearSlot, GearItem>>, bag: BagItem[], now: number): LuyenKhiView {
  const preset: Partial<Record<GearSlot, { sub: number; kl: { cap: number; exp: number }; van?: (string | null)[] }>> = {
    vu_khi: { sub: 0, kl: { cap: 4, exp: 150 }, van: ["KV-CO-003"] },
    ao: { sub: 1, kl: { cap: 2, exp: 260 } },
    ngoc_boi: { sub: 2, kl: { cap: 6, exp: 300 }, van: ["KV-CO-001", null] },
    giay: { sub: 3, kl: { cap: 0, exp: 0 } },
  };
  const slots: Partial<Record<GearSlot, LuyenKhiSlot>> = {};
  for (const [s, g] of Object.entries(gear) as [GearSlot, GearItem][]) {
    const p = preset[s];
    const slot: LuyenKhiSlot = { sub: p?.sub ?? 0, kl: hasKhiLinh(g.rarity) ? { ...(p?.kl ?? { cap: 0, exp: 0 }) } : { cap: 0, exp: 0 }, van: [...(p?.van ?? [])] };
    syncVan(slot, g.rarity);
    // Ô khí văn đã mở mà chưa chọn: có sẵn 3 lựa chọn chờ.
    const open = slot.van.indexOf(null);
    if (open >= 0) {
      slot.offer = rollOffer(s);
      slot.offerAt = open;
    }
    slots[s] = slot;
  }
  const seen = ["TB-KI-001", "TB-KI-002", "TB-KI-003", "TB-KI-005", "TB-KI-008", "TB-KI-013", "TB-KI-021", "TB-KI-030", "TB-MU-001", "TB-MU-002", "TB-MU-004", "TB-MU-007", "TB-MU-011", "TB-MU-016",
    "TB-AO-001", "TB-AO-003", "TB-AO-009", "TB-DA-002", "TB-DA-005", "TB-GI-001", "TB-GI-006", "TB-BT-001", "TB-NB-002", "PB-TH-001", "PK-CU-001", "NG-AN-001", "NG-AN-003", "NG-AN-010", "NG-YC-001"];
  const owned = new Set(seen);
  for (const g of Object.values(gear)) if (g?.code) owned.add(g.code);
  for (const it of bag) if (it.code && it.gear) owned.add(it.code);
  return {
    khiTinh: 46,
    khiTinhKhoa: 18,
    linhVanThach: 9,
    vanThiet: 2,
    slots,
    gems: [
      { id: "g1", he: "loi", cap: 7, n: 2 },
      { id: "g2", he: "quang", cap: 7, n: 1 },
      { id: "g3", he: "hoa", cap: 7, n: 1 },
      { id: "g4", he: "tho", cap: 7, n: 1 },
      { id: "g5", he: "kim", cap: 10, n: 1 },
      { id: "g6", he: "loi", cap: 10, n: 1 },
    ],
    phach: [],
    owned: [...owned],
    doPho: [doPhoCode(0)],
    // Cặp đã lộ trên đồ đang mặc và vài cặp từ đồ cũ (đã phân giải).
    anVanLo: ["DN-DK-006|DN-HU-005", "DN-DK-006|DN-HU-009", "DN-DK-002|DN-HU-001", "DN-DK-007|DN-HU-010", "DN-DK-003|DN-HU-004"],
    week: { text: "Mặc 3 món khí hình Cầm khác nhau trong tuần", have: 1, need: 3, thuong: "Linh Văn Thạch", endsAt: now + 3 * 86_400_000 + 5 * 3_600_000 },
  };
}

/** Mốc giờ hôm nay theo giờ máy (server giả cùng múi giờ với người chơi). */
export function todayAt(now: number, hour: number, minute = 0): number {
  const d = new Date(now);
  d.setHours(hour, minute, 0, 0);
  return d.getTime();
}

function must(state: GameState, cmd: Command, now: number) {
  const r = apply(state, cmd, now);
  if (!r.ok) throw new Error(`Dữ liệu mẫu: lệnh ${cmd.type} lỗi ${r.error}`);
  return r.events;
}

/** Dựng tông môn mẫu bằng lệnh của @ktlp/rules: nhặt và nộp tàn quyển, ghép, chọn bộ truyền thụ, học, mang vào trận. */
function buildRules(now: number): GameState {
  const s = emptyState();
  addSect(s, SECT, 34);
  addMember(s, PLAYER, SECT, "tong_chu", 42);
  const roster: [string, Role, number][] = [
    ["m2", "pho_tong_chu", 40], ["m3", "truong_lao", 38], ["m4", "truong_lao", 35],
    ["m5", "noi_mon", 33], ["m6", "noi_mon", 31], ["m7", "noi_mon", 29], ["m8", "noi_mon", 27],
    ["m9", "noi_mon", 24], ["m10", "ngoai_mon", 12], ["n1", "noi_mon", 30], ["n2", "noi_mon", 30], ["n3", "noi_mon", 28],
  ];
  for (const [id, role, level] of roster) addMember(s, id, SECT, role, level);

  const give = (kind: string, grade: number): number => {
    const ev = must(s, { type: "nhat_tan_quyen", actor: "system", memberId: PLAYER, kind, grade }, now)[0];
    return ev.type === "nhat_tan_quyen" ? ev.scroll.uid : -1;
  };
  const deposit = (uid: number) => must(s, { type: "nop_tan_quyen", actor: PLAYER, scrollUid: uid }, now);
  const compose = (main: [string, number], sub: [string, number]): number => {
    const a = give(...main);
    const b = give(...sub);
    deposit(a);
    deposit(b);
    const ev = must(s, { type: "ghep_cong_phap", actor: PLAYER, main: a, subs: [b] }, now)[0];
    return ev.type === "ghep_cong_phap" ? ev.technique.id : -1;
  };

  // Sáu công pháp của tông; một công pháp phẩm Hoàng để thấy luật học theo cấp (cấp 42 chưa học được).
  const t1 = compose(["loi.can_quet.linh", 1], ["quang.can_quet.bao", 1]);
  const t2 = compose(["loi.tam_xa.toc", 1], ["am_lanh.tam_xa.bao", 1]);
  const t3 = compose(["kim.can_don.bao", 1], ["loi.can_don.toc", 1]);
  const t4 = compose(["loi.ho_the.ben", 1], ["tho.ho_the.ben", 1]);
  const t5 = compose(["loi.dien_rong.bao", 2], ["hoa.dien_rong.linh", 2]);
  const t6 = compose(["moc.hoi_phuc.linh", 1], ["thuy.hoi_phuc.ben", 1]);
  must(s, { type: "dat_bo_truyen_thu", actor: PLAYER, techniqueIds: [t1, t2, t3, t4, t5, t6] }, now);
  for (const t of [t1, t2, t3, t4]) must(s, { type: "hoc_cong_phap", actor: PLAYER, techniqueId: t }, now);
  // Ô thứ tư để trống: thẻ Việc nên làm "Ô công pháp còn trống"; công pháp hộ thể đã học nằm chờ trong túi để kéo vào.
  must(s, { type: "mang_vao_tran", actor: PLAYER, techniqueIds: [t1, t2, t3] }, now);

  // Tàng Kinh Các còn vài quyển để ghép thử; túi còn vài quyển chưa nộp.
  for (const [k, g] of [["loi.khong_che.linh", 1], ["kim.khong_che.toc", 1], ["phong.than_phap.toc", 1], ["loi.than_phap.bao", 1], ["quang.tran_phap.linh", 2]] as [string, number][]) {
    deposit(give(k, g));
  }
  for (const [k, g] of [["loi.bua_chu.linh", 1], ["cuc_han.tam_xa.toc", 2], ["moc.can_don.ben", 1]] as [string, number][]) give(k, g);
  return s;
}

/** Số ngẫu nhiên có hạt giống (mulberry32), cho bản mẫu ổn định. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/**
 * Bốc một chỗ sơn môn còn trống (GDD mục 3: lập tông thì đặt ngẫu nhiên vào chỗ còn trống). Theo đề xuất GDD mục 7, chỗ bốc
 * cách sơn môn các tông mạnh hơn quá SAFE_STAGES chặng; không còn chỗ như vậy thì bốc trong các chỗ xa họ nhất. `fit` lọc
 * thêm (bản mẫu cần chỗ có đủ điểm quanh), không chỗ nào hợp thì bỏ qua lọc này.
 */
export function landSect(m: RegionMap, taken: Set<number>, stronger: number[], rand: () => number, fit = (_id: number) => true): number {
  const all = m.points.filter((p) => p.type === "son_mon" && !taken.has(p.id)).map((p) => p.id);
  const fitting = all.filter(fit);
  const free = fitting.length ? fitting : all;
  const far = stronger.map((id) => stagesFrom(m, id));
  const gap = (id: number) => Math.min(Infinity, ...far.map((d) => d.get(id) ?? Infinity));
  const safe = free.filter((id) => gap(id) > SAFE_STAGES);
  const best = Math.max(...free.map(gap));
  const pool = safe.length ? safe : free.filter((id) => gap(id) === best);
  const id = pool[Math.floor(rand() * pool.length)];
  taken.add(id);
  return id;
}

export interface NpcSect {
  pointId: number;
  name: string;
  level: number;
}

// Tiếng Anh dịch tên tông NPC lúc chạy theo từ điển âm tiết dashboard/i18n/am_tiet.json: thêm âm tiết hay hậu tố mới
// vào ba bảng dưới thì thêm nghĩa vào file đó.
const NPC_HEAD = ["Thanh", "Huyền", "Tử", "Kim", "Ngọc", "Vân", "Thiên", "Bích", "Huyết", "Hàn", "Liệt", "Lưu", "Tinh", "Nguyệt", "Phong", "Thủy", "Hỏa", "Mộc", "Thạch", "Linh", "Vạn", "Cửu", "Bạch", "Hắc", "Xích", "Thương", "Vô", "Lạc", "Tuyết", "Kiếm"];
const NPC_TAIL = ["Vân", "Hà", "Sơn", "Kiếm", "Tuyết", "Lâm", "Nguyệt", "Dương", "Tiêu", "Hư", "Diệp", "Tâm", "Hồ", "Uyên", "Châu", "Long", "Hạc", "Tùng", "Liên", "Nhạn"];
const NPC_KIND = ["Môn", "Tông", "Các", "Cung", "Phái", "Điện", "Cốc", "Phong", "Đài", "Lâu", "Trang", "Viện"];

/**
 * Tông NPC lấp NPC_SHARE chỗ sơn môn còn trống của mỗi vùng (bản mẫu: tông của người chơi khác đã lập; Cấm Khu không có).
 * Mỗi vùng bốc theo hạt giống riêng, xét vùng theo mã, nên kết quả không đổi theo thứ tự tải; tên không trùng cả vị diện
 * và không trùng `used`. `taken` là các chỗ đã có tông trong vùng mình.
 */
export function npcSects(maps: RegionMap[], home: string, taken: Set<number>, used: Set<string>): Record<string, NpcSect[]> {
  const out: Record<string, NpcSect[]> = {};
  const names = new Set(used);
  for (const m of [...maps].sort((a, b) => a.region.code.localeCompare(b.region.code))) {
    const code = m.region.code;
    const rand = seeded(LANDING_SEED + [...code].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7));
    const free = m.points.filter((p) => p.type === "son_mon" && !(code === home && taken.has(p.id))).map((p) => p.id);
    // Xáo Fisher–Yates rồi lấy phần đầu.
    for (let i = free.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [free[i], free[j]] = [free[j], free[i]];
    }
    out[code] = free.slice(0, Math.round(free.length * NPC_SHARE)).map((pointId) => {
      let name = "";
      while (!name || names.has(name)) {
        const pick = (a: string[]) => a[Math.floor(rand() * a.length)];
        const head = pick(NPC_HEAD);
        const tail = pick(NPC_TAIL);
        if (head !== tail) name = `${head} ${tail} ${pick(NPC_KIND)}`;
      }
      names.add(name);
      return { pointId, name, level: 5 + Math.floor(rand() * 56) };
    });
  }
  return out;
}

/** Điểm giữ được trong `range` chặng quanh một sơn môn, gần nhất trước. */
function nearbyHoldable(m: RegionMap, sonMon: number, range: number, taken: Set<number>): number[] {
  const d = stagesFrom(m, sonMon);
  return m.points
    .filter((p) => HOLDABLE.includes(p.type) && !taken.has(p.id) && (d.get(p.id) ?? 99) <= range)
    .sort((a, b) => d.get(a.id)! - d.get(b.id)! || a.id - b.id)
    .map((p) => p.id);
}

export function createWorld(region: RegionMap, now: number): World {
  const rules = buildRules(now);
  const point = (id: number) => region.points[id];

  // Các tông khác trong vùng: hai đồng minh, hai đối thủ; mỗi tông giữ vài điểm quanh sơn môn của họ.
  const others: Omit<OtherSect, "points" | "sonMon">[] = [
    { id: "van_loi_cac", name: "Vạn Lôi Các", level: 41, faction: "Chính", ally: true, online: 6, color: "#5aa9e6" },
    { id: "thien_loi_dai", name: "Thiên Lôi Đài", level: 27, faction: "Chính", ally: true, online: 3, color: "#7bc96f" },
    { id: "thanh_phong_cac", name: "Thanh Phong Các", level: 38, faction: "Tà", ally: false, online: 9, color: "#c77dff" },
    { id: "tu_dien_mon", name: "Tử Điện Môn", level: 22, faction: "Tà", ally: false, online: 2, color: "#e9a23b" },
  ];
  // Sơn môn bốc ngẫu nhiên vào chỗ còn trống, tông mạnh lập trước; tông mình cần chỗ có đủ 6 điểm giữ được trong 1 chặng.
  const rand = seeded(LANDING_SEED);
  const taken = new Set<number>();
  const order = [...others.map((o) => ({ id: o.id, level: o.level })), { id: SECT, level: rules.sects[SECT].level }].sort((a, b) => b.level - a.level);
  const site = new Map<string, number>();
  for (const s of order) {
    const stronger = order.filter((o) => o.level > s.level && site.has(o.id)).map((o) => site.get(o.id)!);
    const fit = s.id === SECT ? (id: number) => nearbyHoldable(region, id, 1, taken).length >= 6 : undefined;
    site.set(s.id, landSect(region, taken, stronger, rand, fit));
  }
  const sonMon = site.get(SECT)!;

  // Lãnh thổ: 6 điểm trong 1 chặng quanh sơn môn (cấp 34: tối đa 6 điểm, tầm 1 chặng).
  const mine = nearbyHoldable(region, sonMon, 1, taken).slice(0, 6);
  mine.forEach((id) => taken.add(id));
  const mineLevel: Partial<Record<PointType, number>> = { mo_linh_thach: 3, mo_quang: 2, mo_duoc: 2 };
  const held: HeldPoint[] = mine.map((id, i) => ({
    pointId: id,
    type: point(id).type,
    level: mineLevel[point(id).type] ?? 0,
    // Một mỏ chưa thu quá 8 giờ để thẻ Việc nên làm có việc.
    uncollectedSince: now - (i === 1 ? 9 * H + 20 * MIN : 3 * H + 10 * MIN),
  }));
  // Huyết Sát Môn đang đánh một mỏ linh thạch; trận phá trận kết thúc sau 38 phút.
  const target = held.find((h) => h.type === "mo_linh_thach" && h !== held[1]) ?? held[0];
  target.attacked = { by: "Huyết Sát Môn", endsAt: now + 38 * MIN };

  const sects: OtherSect[] = others.map((o) => {
    const sonMon = site.get(o.id)!;
    const pts = nearbyHoldable(region, sonMon, o.level >= 50 ? 2 : 1, taken).slice(0, 5);
    pts.forEach((id) => taken.add(id));
    return { ...o, sonMon, points: pts };
  });

  const thanhChu = region.points.find((p) => p.type === "thanh_chu")!.id;
  const names: Record<string, string> = {
    p1: "Lăng Vân", m2: "Mộ Dung Tuyết", m3: "Hàn Thạch", m4: "Tô Linh", m5: "Bạch Khởi Phong", m6: "Diệp Thanh",
    m7: "Lâm Mặc", m8: "Cố Tiểu Vũ", m9: "Phương Hạo", m10: "Tiểu Bảo", n1: "Đệ tử NPC Giáp", n2: "Đệ tử NPC Ất", n3: "Đệ tử NPC Bính",
  };

  const gear: Partial<Record<GearSlot, WorldGear>> = {
    // Tên, hình vẽ, độ hiếm và mã lấy từ assets/icon_ve/danh_sach.json; đồ đang mặc có đủ lam, tím, vàng để thấy màu nền.
    // Mọi món có hình vẽ Canva (art); vũ khí và mũ giữ icon PixelLab chỉ để ghép hình nhân vật (look.weapon, look.hat).
    // Ấn khảm (set đồ 2.0): Lôi Trì 3 món, bậc thấp nhất tím; Bàn Thạch 2 món lam; Tụ Bảo 2 món lục. Binh ấn Bạo Kích trên
    // bao tay và ngọc bội (binh bộ 2 món, cùng lộ ngoại công với Lôi Trì). Vũ khí +12 có dòng rèn +10 đang bật; mũ tụt về +5
    // nên dòng rèn +10 tạm tắt. Ngọc bội và đai vàng mỗi món 3 dòng ẩn, dòng đầu cùng điều kiện (song ẩn).
    vu_khi: { slot: "vu_khi", seal: "NG-AN-010", sealTier: "tim", ren: [2], name: "Kiếm Tử Vân", plus: 12, durability: 76, durabilityMax: 100, sockets: 2, gems: [{ element: "loi", level: 3 }], stats: { atk: 120 }, icon: "do/vu_khi/kiem", art: "trang_bi/kiem/42", rarity: "tim", code: "TB-KI-042" },
    mu: { slot: "mu", seal: "NG-AN-003", sealTier: "lam", ren: [3], name: "Ô Sa Lôi Văn", plus: 5, durability: 64, durabilityMax: 100, sockets: 1, gems: [], stats: { hp: 900, def: 30 }, icon: "do/mu/o_sa", art: "trang_bi/mu/27", rarity: "lam", code: "TB-MU-027" },
    ao: { slot: "ao", seal: "NG-AN-010", sealTier: "tim", name: "Pháp Y Tinh Hà", plus: 6, durability: 58, durabilityMax: 98, sockets: 2, gems: [{ element: "kim", level: 2 }], stats: { hp: 1800, def: 60 }, art: "trang_bi/ao/41", rarity: "tim", code: "TB-AO-041" },
    dai: {
      slot: "dai", seal: "NG-AN-003", sealTier: "lam", name: "Đai Hoàng Long",
      dongAn: [{ dk: "DN-DK-006", hu: "DN-HU-009", lo: "het" }, { dk: "DN-DK-009", hu: "DN-HU-002", lo: "an" }, { dk: "DN-DK-012", hu: "DN-HU-012", lo: "an" }], plus: 4, durability: 81, durabilityMax: 100, sockets: 1, gems: [], stats: { hp: 600, def: 40 }, art: "trang_bi/dai/53", rarity: "vang", code: "TB-DA-053" },
    bao_tay: { slot: "bao_tay", seal: "NG-AN-001", sealTier: "luc", binhAn: { ma: "NG-BA-001", tier: "lam" }, name: "Hộ Thủ Thiết Lân", plus: 2, durability: 88, durabilityMax: 100, sockets: 2, gems: [], stats: { atk: 20, def: 35 }, art: "trang_bi/bao_tay/25", rarity: "lam", code: "TB-BT-025" },
    giay: { slot: "giay", seal: "NG-AN-001", sealTier: "luc", name: "Ngoa Tinh Tú", plus: 3, durability: 14, durabilityMax: 100, sockets: 0, gems: [], stats: { hp: 400, def: 25 }, art: "trang_bi/giay/42", rarity: "tim", code: "TB-GI-042" },
    ngoc_boi: {
      slot: "ngoc_boi", seal: "NG-AN-010", sealTier: "vang", binhAn: { ma: "NG-BA-001", tier: "tim" }, name: "Bội Long Phượng", plus: 2, durability: 92, durabilityMax: 100, sockets: 3, gems: [{ element: "loi", level: 2 }],
      dongAn: [{ dk: "DN-DK-006", hu: "DN-HU-005", lo: "het" }, { dk: "DN-DK-004", hu: "DN-HU-001", lo: "dk" }, { dk: "DN-DK-001", hu: "DN-HU-004", lo: "an" }], stats: { atk: 40, mana: 30 }, art: "trang_bi/ngoc_boi/53", rarity: "vang", code: "TB-NB-053" },
  };
  const bag = sampleBag();
  return {
    rules,
    region,
    sonMon,
    names,
    online: { p1: true, m2: true, m3: false, m4: true, m5: true, m6: false, m7: false, m8: true, m9: false, m10: true, n1: true, n2: true, n3: true },
    npc: { n1: true, n2: true, n3: true },
    player: {
      name: names.p1,
      roots: ["loi"],
      talent: "tu_the",
      exp: 8_960,
      linhThach: 3_280,
      tienNgoc: 120,
      satNghiep: 0,
      gear,
      mounts: ["thiem_dien_bao", "loi_am_lang", "loi_tuoc", "thiet_boi_nguu", null],
      riding: 0,
      bag,
      // Cấp 42 mới mở ô tâm (dao_co_ban.json): đặt sẵn Ấn Lôi Trì, bộ chính của người chơi.
      board: { O: { loai: "an", ma: "NG-AN-010" } },
      luyenKhi: sampleLuyenKhi(gear, bag, now),
      nextUid: 10_100,
    },
    sect: { name: "Lôi Trì Phong", model: { id: "loi_loi_tri_phong", name: "Lôi Trì Phong", element: "loi" }, xp: 118_400, faction: "Chính", vault: { linhThach: 8_420, quang: 1_260, duoc: 540 } },
    held,
    sects,
    applicants: [
      { id: "a1", name: "Vân Khê", level: 18 },
      { id: "a2", name: "Thạch Đầu", level: 9 },
    ],
    wars: [{ id: 1, with: "Thanh Phong Các", direction: "den", startsAt: todayAt(now, 21) }],
    // Đang có một đợt Yêu Triều để thấy nhấp nháy đỏ trên bản đồ (bản mẫu; mùa Yêu Triều là đề xuất ở GDD mục 17).
    tides: [{ title: "Yêu Triều tràn vào rìa Lôi Đình Cốc", startsAt: now - 15 * MIN, endsAt: now + 45 * MIN, maxRing: 0.15 }],
    jobs: [
      { kind: "xay", title: "Tàng Kinh Các lên cấp 6", detail: "Hàng xây ở sơn môn", startsAt: now - 2 * H, endsAt: now + 1 * H + 25 * MIN },
      { kind: "ren", title: "Kiếm Tử Vân +8 → +9", detail: "Lò rèn thành chủ", startsAt: now - 20 * MIN, endsAt: now + 6 * MIN },
      { kind: "luyen_dan", title: "Hồi Khí Đan × 10", detail: "Luyện Đan Phòng", startsAt: now - 30 * MIN, endsAt: now + 42 * MIN },
      { kind: "be_quan", title: "Bế quan: Lôi Quang Liên Hoàn Quyết", detail: "Tầng 1 → 2", startsAt: now - 1 * H, endsAt: now + 3 * H },
    ],
    buildings: [
      { id: "chinh_dien", name: "Chính Điện", level: 7 },
      { id: "tang_kinh_cac", name: "Tàng Kinh Các", level: 5, upgradingUntil: now + 1 * H + 25 * MIN },
      { id: "ho_son_dai_tran", name: "Hộ Sơn Đại Trận", level: 4 },
      { id: "dien_vo_truong", name: "Diễn Võ Trường", level: 4 },
      { id: "luyen_dan_phong", name: "Luyện Đan Phòng", level: 3 },
      { id: "luyen_khi_cac", name: "Luyện Khí Các", level: 3 },
      { id: "linh_duoc_vien", name: "Linh Dược Viên", level: 2 },
      { id: "bao_kho", name: "Bảo Khố", level: 4 },
      { id: "truyen_tong_tran", name: "Truyền Tống Trận", level: 1 },
      { id: "thuong_hoi", name: "Thương hội", level: 0, locked: "Cần người có tài năng Tu kim tiền" },
      { id: "phi_thang_dai", name: "Phi Thăng Đài", level: 0, locked: "Mở ở cấp tông môn 200" },
    ],
    // Đang đi từ thành chủ về sơn môn, còn 14 phút.
    travel: { from: thanhChu, to: sonMon, startsAt: now - 9 * MIN, endsAt: now + 14 * MIN },
    reports: [
      { id: 1, seed: 11, title: "Thủ mỏ linh thạch trước Huyết Sát Môn", at: now - 2 * H, arena: `${REGION}/mo_linh_thach` },
      { id: 2, seed: 2, title: "Hang dị thú cấp 58", at: now - 5 * H, arena: `${REGION}/hang_di_thu` },
      { id: 3, seed: 3, title: "Tranh cửa bí cảnh 12:00", at: now - 9 * H, arena: `${REGION}/cua_bi_canh` },
    ],
    mail: [
      { id: 1, from: "Hệ thống", title: "Thưởng bí cảnh hôm qua", body: "Tông môn nhận 2 tàn quyển phẩm Phàm vào Tàng Kinh Các.", unread: true },
      { id: 2, from: "Mộ Dung Tuyết", title: "Tối nay thủ mỏ", body: "Thanh Phong Các tuyên chiến 21:00. Ai rảnh thì vào Diễn Võ Trường xếp đội trước 20:45.", unread: false },
    ],
    alliance: { joined: true, name: "Lôi Minh", leader: "Vạn Lôi Các" },
    chat: [
      { id: 1, from: "Vạn Lôi Các · Tần Phong", text: "Thứ Năm này đánh Thanh Phong Các, các tông chuẩn bị trận pháp sư.", at: now - 50 * MIN },
      { id: 2, from: "Thiên Lôi Đài · Lục Y", text: "Bên mình xin hộ chiến mỏ quặng phía bắc.", at: now - 22 * MIN },
      { id: 3, from: "Lôi Trì Phong · Mộ Dung Tuyết", text: "Đã nhận, 20:45 tập trung.", at: now - 18 * MIN },
    ],
    nextChat: 4,
  };
}

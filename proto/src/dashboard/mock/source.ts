// Nguồn đọc gộp chạy ngay trong trang (chưa có server giả). Mỗi lệnh đọc dựng đủ các thẻ của một màn từ World,
// kèm mốc giờ server; lệnh ghi đi qua apply() của @ktlp/rules khi luật đã có, phần còn lại sửa World trực tiếp.
import {
  apply, bacHeSo, binhBoOf, boardCell, boardCellOpen, diemTrangBi, DONG_REN, gearStats, ghepAn, GRADE_NAMES, kieuInfo, loadoutTechniques, RULES,
  scrollKind, setLo, techniqueOf, transmissionSlots,
  type Bac, type BoardPiece, type Command, type EquipItem, type GearStats, type InlayLine, type LearnedTechnique, type Progress, type Role,
  type SectTechnique,
} from "@ktlp/rules";
import {
  BASE_CRIT_PER_MILLE, baseStats, BATTLE, maxGradeAtLevel, simulate, TICKS_PER_SECOND, unitBonuses,
  type BattleInput, type Element, type Technique,
} from "@ktlp/sim";
import CAP_TONG_MON from "../../../../data/he_thong/json/cap_tong_mon.json";
import MO from "../../../../data/he_thong/json/mo.json";
import THAM_SO from "../../../../data/he_thong/json/tham_so.json";
import TAI_NANG from "../../../../data/he_thong/json/tai_nang.json";
import THU_CUOI from "../../../../data/he_thong/json/thu_cuoi.json";
import THU_PHAM from "../../../../data/he_thong/json/thu_pham.json";
import THU_CANH_GIOI from "../../../../data/he_thong/json/thu_canh_gioi.json";
import THU_KICH_PHAT from "../../../../data/he_thong/json/thu_kich_phat.json";
import NHIEM_VU from "../../../../data/nhiem_vu/ha_nhiem_vu.json";
import { sampleBattle } from "../../mock/sampleBattle.ts";
import { loadRegion, loadWorld, POINT_NAMES, stagesFrom } from "../../scenes/map/region.ts";
import type {
  BagItem, BanDoView, BinhBoView, CommandResult, CongPhapView, DashboardCommand, DashboardSource, DongPhuView, ForgeLineView, GearItem, GearSlot, Go,
  HiddenLineView, LienMinhView, LuyenKhiView, MiniMapView, MountView, NhanVatView, ScrollCard, SetMilestone, SetView, StatLine, StatSource, TechniqueCard,
  TodoCard, TongMonView, TopBarView,
} from "../source.ts";
import { ADULT_AGE, ageOn, MINOR_DAILY_MINUTES, type AuthSource } from "../auth.ts";
import {
  createWorld, npcSects, pieceBagItem, PLAYER, RARITY_GRADE, RARITY_LABEL, REGION, SECT, samePiece, todayAt, type DongAnRaw, type NpcSect, type World, type WorldGear,
} from "./world.ts";
import NGOC from "../../../../data/he_thong/json/ngoc.json";
import SET from "../../../../data/he_thong/json/set.json";
import TO_HOP from "../../../../data/he_thong/json/to_hop.json";
import TRANG_BI from "../../../../data/he_thong/json/trang_bi.json";
import {
  addExp, canDecompose, DANH_KHI, DANH_KHI_COST, doPhoCode, hasKhiLinh, khiHinhOf, khiTinhOf, KL_MAX, KL_PER_KHI_TINH, LO_MIN, loRate, PHACH_FROM,
  PHACH_KHI_TINH, PHACH_RATE, phachCode, phachName, reached, REROLL_KHI_TINH, rerollStone, rerollSub, rollOffer, SONG_HE_FROM, SONG_HE_LOSE, SONG_HE_PHU,
  SONG_HE_RATE, songHeOk, stoneBack, SUB, syncVan, UNLOCK,
  VAN_REROLL, yieldLocked,
} from "../luyenKhi.ts";

const H = 3600_000;
const KT = THAM_SO.kinh_te;

/** Nhãn phân loại độ tuổi G1 (đề xuất, chờ chốt khi xin giấy phép). */
export const AGE_LABEL = "16+";
/** Mỏ chưa thu quá bấy nhiêu giờ thì vào Việc nên làm (GDD mục 14). */
const MINE_STALE_HOURS = 8;
/** Mỏ tích tối đa 24 giờ sản lượng (đề xuất). */
const MINE_CAP_HOURS = 24;
/** Đồ có độ bền dưới mức này thì vào Việc nên làm (GDD mục 14). */
const LOW_DURABILITY = 20;
/** Cống hiến khi hiến tế: 1 mỗi 10 linh thạch (đề xuất). */
const DONATE_CONTRIBUTION_DIV = 10;
/** Phí duy trì mỗi tiểu Truyền Tống Trận mỗi ngày (sheet Tham số). */
const MINI_PORTAL_UPKEEP = KT.miniPortalUpkeep;
/** Trận pháp sư dựng hộ trận sơn môn của tông mẫu: số người, tổng cấp. */
const WARD = { casters: 4, totalLevel: 152 };
/** Lực chiến (đề xuất cho proto): máu / 10 + công lực × 4 + phòng thủ × 3, công pháp D × số mục tiêu × 4. */
const POWER = { hp: 0.1, atk: 4, def: 3, tech: 4 };
/** Trần phần đồ và phần thú trong lực chiến (GDD mục 13 và 6). */
const GEAR_CAP = 0.35;
const MOUNT_CAP = 0.15;
/** Mỗi thú cộng statBonus / 5 % máu, công, phòng gốc (đề xuất cho proto). */
const MOUNT_STAT_DIV = 5;
/** Túi gốc 50 ô (GDD mục 12, đề xuất). */
const BAG_CAPACITY = 50;
/** Bế quan ở Hạ vị: mỗi giờ được 1/8 kinh nghiệm của cấp đang tu (đề xuất); linh tuyền tông giữ cộng 20% (đề xuất). */
const RETREAT_HOURS_PER_LEVEL = 8;
const SPRING_BONUS = 0.2;
/** Linh khí vị diện nhân thẳng vào tốc độ tu luyện (GDD mục 7). */
const LINH_KHI_HA = 1;
/** Uid ảo cho công pháp đã học khi hiện trong túi (không chiếm ô). */
const LEARNED_UID = 1_000_000;

/** Món trang bị đem vào túi, phẩm lọc và nhãn theo độ hiếm. */
function gearBagItem(uid: number, g: GearItem): BagItem {
  return {
    uid, kind: "trang_bi", name: g.name, grade: RARITY_GRADE[g.rarity], gradeLabel: RARITY_LABEL[g.rarity],
    count: 1, icon: g.icon, art: g.art, rarity: g.rarity, code: g.code, detail: "Đồ đã tháo.", gear: g,
  };
}

/** Thứ tự hệ trong mã vật phẩm của danh sách icon vẽ (TQ-HE-xxx, CP-HE-xxx; assets/icon_ve/danh_sach.json). */
const ICON_ELEMENTS: Element[] = ["kim", "moc", "thuy", "hoa", "tho", "loi", "phong", "quang", "am_lanh", "cuc_duong", "cuc_am", "cuc_han"];
/** Hình công pháp đã vẽ trong assets/icon_ve/cong_phap (chỉ lấy tên file, không nạp ảnh). */
const CONG_PHAP_ART = new Set(Object.keys(import.meta.glob("../../../../assets/icon_ve/cong_phap/**/*.webp")).map((k) => k.replace(/^.*icon_ve\//, "").replace(/\.webp$/, "")));

/** Hình công pháp: ba hệ là bộ ba theo chủ hệ, hai hệ là cặp theo thứ tự 12 hệ, một hệ là quyển thuần hệ; chưa vẽ thì lùi về quyển thuần hệ. */
function techniqueArt(main: Element, subs: Element[]): string {
  const pure = `cong_phap/${main}`;
  const pair = () => [main, subs[0]].sort((a, b) => ICON_ELEMENTS.indexOf(a) - ICON_ELEMENTS.indexOf(b)).join("_");
  const want = subs.length >= 2 ? `cong_phap/bo_ba/${main}` : subs.length === 1 ? `cong_phap/ghep/${pair()}` : pure;
  return CONG_PHAP_ART.has(want) ? want : pure;
}
const elementCode = (prefix: string, e: Element) => `${prefix}-HE-${String(ICON_ELEMENTS.indexOf(e) + 1).padStart(3, "0")}`;

/** Phẩm lọc của tàn quyển và công pháp: Phàm, Hoàng là hạ; Huyền là trung; từ Địa trở lên là cao (đề xuất). */
function techGrade(grade: number): BagItem["grade"] {
  return grade <= 2 ? "ha" : grade === 3 ? "trung" : "cao";
}

const ROLE_ORDER: Role[] = ["tong_chu", "pho_tong_chu", "truong_lao", "noi_mon", "ngoai_mon"];
const atLeast = (role: Role | null, min: Role): boolean => role !== null && ROLE_ORDER.indexOf(role) <= ROLE_ORDER.indexOf(min);

const TERRAIN_NAMES: Record<string, string> = {
  son_hiem: "Sơn hiểm", thuy_trach: "Thủy trạch", thuong_lo: "Thương lộ", co_tich: "Cổ tích", linh_mach: "Linh mạch", hoa_mach: "Hỏa mạch",
};

const SEAL_SET: Record<string, string> = Object.fromEntries((NGOC.an_bo as { ma_vp: string; bo: string }[]).map((a) => [a.ma_vp, a.bo]));

/** Số món mỗi bộ trên đồ đang mặc còn độ bền (mỗi món một ấn), như gearStats của @ktlp/rules. */
function gearSets(gear: World["player"]["gear"]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const g of Object.values(gear)) if (g?.seal && g.durability > 0) out[SEAL_SET[g.seal]] = (out[SEAL_SET[g.seal]] ?? 0) + 1;
  return out;
}

// ---- Set đồ 2.0 (GDD tab Trang bị phần 14): mọi số tính bằng gearStats, diemTrangBi của @ktlp/rules ----------------------

const DONG_AN = TRANG_BI.dong_an as { ma: string; loai: string; noi_dung: string }[];
const DONG_AN_TEXT: Record<string, string> = Object.fromEntries(DONG_AN.map((d) => [d.ma, d.noi_dung]));
const DONG_AN_HU = DONG_AN.filter((d) => d.loai === "hieu_ung").map((d) => d.ma);
const TAY_AN_LVT = (TRANG_BI.luat as { dongAn: { tayAnLinhVanThach: number } }).dongAn.tayAnLinhVanThach;
const GHEP_AN_SO = (SET.luat as { ghepAnSo: number }).ghepAnSo;
/** Mã Giám Định Phù (vat_pham.json). */
const GIAM_DINH_PHU = "PH-CH-011";
const SET_ROW: Record<string, { ten: string; moc: { so: number; mo_ta: string }[] }> = Object.fromEntries(
  (SET.bo as unknown as { id: string; ten: string; moc: { so: number; mo_ta: string }[] }[]).map((b) => [b.id, b]),
);
const BINH_ROW: Record<string, { moc_2: { mo_ta: string }; moc_3: { mo_ta: string } }> = Object.fromEntries(
  (SET.binh_bo as unknown as { id: string; moc_2: { mo_ta: string }; moc_3: { mo_ta: string } }[]).map((b) => [b.id, b]),
);
const SET_HE: Record<string, string | null> = Object.fromEntries((NGOC.an_bo as { bo: string; he: string | null }[]).map((a) => [a.bo, a.he]));
const RELATION = TO_HOP.relation as Record<string, Record<string, string>>;
/** Quan hệ hệ ấn giữa hai bộ (như set2.ts của @ktlp/rules); Hỗn Độn không hệ là trung tính. */
const quanHe = (a: string, b: string): string => {
  const x = SET_HE[a], y = SET_HE[b];
  return x && y ? RELATION[x][y] : "trung_tinh";
};
const kieuOk = (code?: string): code is string => {
  if (!code) return false;
  try {
    kieuInfo(code);
    return true;
  } catch {
    return false;
  }
};
const minBac = (bacs: Bac[]): Bac => bacs.reduce<Bac>((m, b) => (bacHeSo(b) < bacHeSo(m) ? b : m), "do");

/** Món của trạng thái mẫu đổi sang EquipItem của @ktlp/rules; `sub` là loại phụ 0–3 của ô (luyenKhi.slots). */
function toEquip(g: WorldGear, sub = 0): EquipItem {
  const kham: InlayLine[] = g.gems.map((x): InlayLine => ({ loai: "ngoc", he: x.element, cap: x.level }));
  if (g.seal) kham.push({ loai: "an", ma: g.seal, bac: g.sealTier });
  if (g.binhAn) kham.push({ loai: "binh_an", ma: g.binhAn.ma, bac: g.binhAn.tier });
  return {
    kieu: g.code!, nac: g.plus, doBen: g.durability, biCanh: 0, dongThem: 0, kham, phu: sub + 1, ren: g.ren,
    dongAn: g.dongAn?.map((d) => ({ dk: d.dk, hu: d.hu })),
  };
}

/** Dòng ẩn phần đã lộ; `pair` là dòng ẩn của món kia (ngọc bội với đai) để báo song ẩn khi cả hai điều kiện đã lộ. */
function hiddenView(lines: DongAnRaw[], pair?: DongAnRaw[]): HiddenLineView[] {
  return lines.map((l) => {
    const dk = l.lo !== "an";
    const hu = l.lo === "het";
    const v: HiddenLineView = { dk: dk ? l.dk : null, hu: hu ? l.hu : null };
    if (dk) v.dkText = DONG_AN_TEXT[l.dk];
    if (hu) v.huText = DONG_AN_TEXT[l.hu];
    if (dk && (pair ?? []).some((o) => o.lo !== "an" && o.dk === l.dk)) v.songAn = true;
    return v;
  });
}

/** Dòng rèn: giá trị là phần gearStats thêm vào khi bật dòng đó (tính ở nấc đủ mốc, nên dòng tạm tắt vẫn có số). */
function forgeView(g: WorldGear, sub: number, level: number, roots: Element[]): ForgeLineView[] {
  const ren = g.ren ?? [];
  return ren.map((loai, i) => {
    const at = DONG_REN.moc[i];
    const row = SUB[g.slot][loai - 1];
    const base = { ...toEquip(g, sub), nac: Math.max(g.plus, at) };
    const a = gearStats([{ ...base, ren: ren.slice(0, i + 1) }], level, roots);
    const b = gearStats([{ ...base, ren: ren.slice(0, i) }], level, roots);
    const key = row.stat === "lifesteal" ? "lifestealFlat" : row.stat;
    const flat = key === "hp" || key === "atk" || key === "def" || key === "manaMax";
    const bonus = (x: GearStats) => x.bonuses[key as keyof GearStats["bonuses"]] ?? 0;
    const value = flat ? a[key] - b[key] : bonus(a) - bonus(b);
    return { at, stat: row.stat, label: row.ten, value, unit: flat ? "" : "‰", on: g.plus >= at };
  });
}

/**
 * Món như màn thấy: bỏ phần chỉ server giữ (dòng ẩn thật, mã dòng rèn), thêm dòng ẩn đã lộ, dòng rèn, điểm riêng món.
 * Mã kiểu không có trong trang_bi.json (danh khí của bản mẫu) thì không có điểm và dòng rèn.
 */
function gearView(g: WorldGear, sub: number, level: number, roots: Element[], pair?: DongAnRaw[]): GearItem {
  const { dongAn, ren, ...v } = g;
  const out: GearItem = { ...v, gems: g.gems.map((x) => ({ ...x })) };
  if (dongAn?.length) out.hiddenLines = hiddenView(dongAn, pair);
  if (!kieuOk(g.code)) return out;
  if (ren?.length) out.forgeLines = forgeView(g, sub, level, roots);
  out.score = diemTrangBi(gearStats([toEquip(g, sub)], level, roots), level);
  return out;
}

/** Bộ có món trên người: bộ đang kích theo gearStats (bậc, hệ số, mốc), bộ 1 món thì mọi mốc tắt. */
function setViews(gs: GearStats, gear: World["player"]["gear"]): SetView[] {
  const bacs: Record<string, Bac[]> = {};
  for (const g of Object.values(gear)) if (g?.seal && g.durability > 0) (bacs[SEAL_SET[g.seal]] ??= []).push(g.sealTier ?? "tim");
  const active = gs.sets.map((a) => a.bo);
  const out: SetView[] = gs.sets.map((a) => {
    const relations: SetView["relations"] = [];
    if (a.hopBo.nguon === "ban") {
      const r = gs.board?.congHuong.find((c) => c.a === a.bo || c.b === a.bo);
      if (r) relations.push({ with: r.a === a.bo ? r.b : r.a, kind: "ban", quanHe: r.mach });
    } else if (a.hopBo.nguon) {
      const w = active.find((b) => b !== a.bo && quanHe(a.bo, b) === a.hopBo.nguon);
      if (w) relations.push({ with: w, kind: "hop", quanHe: a.hopBo.nguon });
    }
    if (a.hopBo.biKhac) relations.push({ with: a.hopBo.biKhac, kind: "khac" });
    const milestones = SET_ROW[a.bo].moc.map((m): SetMilestone => {
      const reached = a.mon >= m.so;
      const lock = !reached ? undefined : m.so === 7 && a.moc7ThieuBac ? "bac" : a.thieuDieuKien?.includes(m.so) ? "dieu_kien" : undefined;
      return lock ? { at: m.so, on: false, text: m.mo_ta, lock } : { at: m.so, on: reached, text: m.mo_ta };
    });
    return { id: a.bo, name: SET_ROW[a.bo].ten, pieces: a.mon, tier: a.bac, factor: a.heSo2, factor4: a.heSo4, lo: setLo(a.bo), relations, milestones };
  });
  for (const [bo, list] of Object.entries(bacs)) {
    if (active.includes(bo)) continue;
    const tier = minBac(list);
    out.push({
      id: bo, name: SET_ROW[bo].ten, pieces: list.length, tier, factor: bacHeSo(tier), factor4: bacHeSo(tier), lo: setLo(bo), relations: [],
      milestones: SET_ROW[bo].moc.map((m) => ({ at: m.so, on: false, text: m.mo_ta })),
    });
  }
  return out;
}

/** Binh bộ trên ô công: bộ có nhiều binh ấn nhất (mỗi người 1 binh bộ); đồng lộ xét với bộ đang kích. */
function binhBoView(gs: GearStats, gear: World["player"]["gear"]): BinhBoView | undefined {
  const by: Record<string, Bac[]> = {};
  for (const g of Object.values(gear)) if (g?.binhAn && g.durability > 0) (by[g.binhAn.ma] ??= []).push(g.binhAn.tier);
  const ma = Object.keys(by).sort((a, b) => by[b].length - by[a].length || a.localeCompare(b))[0];
  if (!ma) return undefined;
  const row = binhBoOf(ma);
  const n = by[ma].length;
  const dongLo = gs.binhBo?.bo === row.id ? gs.binhBo.dongLo : gs.sets.some((a) => setLo(a.bo).some((l) => row.lo.includes(l)));
  const text = BINH_ROW[row.id];
  return {
    id: row.id, name: row.ten, pieces: n, tier: minBac(by[ma]), lo: row.lo, dongLo,
    milestones: [{ at: 2, on: n >= 2, text: text.moc_2.mo_ta }, { at: 3, on: n >= 3, text: text.moc_3.mo_ta }],
  };
}

/** Tiến độ cho Đạo Cơ Bàn: Hạ vị, cấp và số thứ tự cảnh giới (1 Luyện Khí … 5 Hóa Thần, cùng mốc với realmOf). */
function progressOf(level: number): Progress {
  return { viDien: "ha", cap: level, canhGioi: level <= 50 ? 1 : level <= 100 ? 2 : level <= 150 ? 3 : level <= 200 ? 4 : 5 };
}

/** Tên viên cho lời báo: ấn theo tên, ngọc kèm cấp. */
function pieceLabel(piece: BoardPiece): string {
  const name = pieceBagItem(0, piece).name;
  return piece.loai === "an" ? name : `${name} cấp ${piece.cap}`;
}

/** Cấp cuối cảnh giới chứa `level`: tới đây tu vi dừng ở mức đủ, chờ Đột phá (Hạ vị tối đa cấp 250). */
function breakLevelOf(level: number): number {
  return Math.min(250, Math.ceil(level / 50) * 50);
}

/** Cảnh giới Hạ vị theo cấp (GDD mục 7). */
export function realmOf(level: number): string {
  return level <= 50 ? "Luyện Khí" : level <= 100 ? "Trúc Cơ" : level <= 150 ? "Kết Đan" : level <= 200 ? "Nguyên Anh" : "Hóa Thần";
}

/** Kinh nghiệm lên cấp kế: E(L) = 320 × q(L) × (0,4 + 0,002 L) × p(L) (tab Nhiệm vụ của GDD, khoá `exp` của ha_nhiem_vu.json). */
export function expToNext(level: number): number {
  const c = NHIEM_VU.exp.curve;
  const q = NHIEM_VU.exp.q.base + NHIEM_VU.exp.q.perLevel * level;
  const days = (c.daysBasePermille + c.daysPerLevelPermille * level) / 1000;
  const p = level < c.earlyUntilLevel ? (c.earlyFloorPermille + ((1000 - c.earlyFloorPermille) * (level - 1)) / (c.earlyUntilLevel - 1)) / 1000 : 1;
  return Math.round((c.dailyQ * q * days * p) / c.roundTo) * c.roundTo;
}

export function minePerHour(level: number): number {
  return level > 0 ? MO[level - 1].perHour : 0;
}

function sectRow(level: number) {
  return CAP_TONG_MON[Math.max(0, Math.min(CAP_TONG_MON.length - 1, level - 1))];
}

function techCard(t: Pick<SectTechnique, "name" | "main" | "subs" | "grade"> & { id: number }, extra: Partial<TechniqueCard> = {}): TechniqueCard {
  const tech: Technique = techniqueOf(t);
  const cd = tech.cooldownTicks / TICKS_PER_SECOND;
  return {
    id: t.id,
    name: t.name,
    grade: t.grade,
    gradeName: GRADE_NAMES[t.grade - 1],
    element: tech.element,
    subElements: tech.subElements,
    type: tech.type,
    summary: `D ${Math.round(tech.damage / 1000)} · ${tech.targets} mục tiêu · hồi ${cd.toLocaleString("vi-VN")} s · ${tech.manaCost} mana`,
    art: techniqueArt(tech.element, tech.subElements),
    ...extra,
  };
}

function scrollCard(s: { uid: number; kind: string; grade: number }): ScrollCard {
  const k = scrollKind(s.kind);
  return {
    uid: s.uid,
    kind: s.kind,
    name: k.name,
    element: k.element,
    type: k.type,
    grade: s.grade,
    gradeName: GRADE_NAMES[s.grade - 1],
    contribution: RULES.contributionPerScroll[s.grade - 1],
  };
}

function learnedCard(l: LearnedTechnique): TechniqueCard {
  return techCard({ ...l, id: l.techniqueId }, { layer: l.layer, frozen: l.frozen });
}

export class MockDashboardSource implements DashboardSource {
  protected w: World;
  protected auth?: AuthSource;

  protected constructor(w: World, auth?: AuthSource) {
    this.w = w;
    this.auth = auth;
  }

  static async create(now = Date.now(), auth?: AuthSource): Promise<MockDashboardSource> {
    return new MockDashboardSource(createWorld(await loadRegion(REGION), now), auth);
  }

  /** Giờ server giả: cùng đồng hồ máy. */
  protected now(): number {
    return Date.now();
  }

  protected get me() {
    return this.w.rules.members[PLAYER];
  }

  /** Thêm tu vi: lên cấp trong cảnh giới; ở cấp cuối cảnh giới thì tu vi dừng ở mức đủ, chờ Đột phá. */
  protected gainExp(amount: number): void {
    const p = this.w.player;
    const me = this.me;
    p.exp += amount;
    while (me.level < breakLevelOf(me.level) && p.exp >= expToNext(me.level)) {
      p.exp -= expToNext(me.level);
      me.level++;
    }
    if (me.level === breakLevelOf(me.level)) p.exp = Math.min(p.exp, expToNext(me.level));
  }

  /** Luyện khí cho màn: bản sao trạng thái, sổ Bảo Giám gộp cả đồ đang có. */
  private luyenKhiView(): LuyenKhiView {
    const p = this.w.player;
    const lk = p.luyenKhi;
    const owned = new Set(lk.owned);
    for (const g of Object.values(p.gear)) if (g?.code) owned.add(g.code);
    for (const it of p.bag) if (it.code && it.gear) owned.add(it.code);
    return {
      ...lk,
      slots: Object.fromEntries(Object.entries(lk.slots).map(([k, v]) => [k, { ...v, kl: { ...v!.kl }, van: [...v!.van], offer: v!.offer && [...v!.offer] }])),
      gems: lk.gems.filter((g) => g.n > 0).map((g) => ({ ...g })),
      phach: [...lk.phach],
      owned: [...owned],
      doPho: [...lk.doPho],
      anVanLo: [...lk.anVanLo],
      week: { ...lk.week },
    };
  }

  /** Tiêu Khí Tinh: phần khóa tiêu trước (không bán được), rồi tới phần tự do. */
  private spendKhiTinh(n: number): void {
    const lk = this.w.player.luyenKhi;
    lk.khiTinh -= n;
    lk.khiTinhKhoa = Math.max(0, Math.min(lk.khiTinhKhoa - n, lk.khiTinh));
  }

  /** Ô khí văn chưa chọn đầu tiên mà chưa có lựa chọn chờ: quay sẵn 3 khí văn (miễn phí). */
  private offerNext(slot: GearSlot): void {
    const ls = this.w.player.luyenKhi.slots[slot];
    if (!ls || ls.offer) return;
    const o = ls.van.indexOf(null);
    if (o < 0) return;
    ls.offer = rollOffer(slot);
    ls.offerAt = o;
  }

  /** Món về túi: gộp chồng cùng loại nếu là viên Đạo Cơ Bàn. */
  private toBag(piece: BoardPiece, count: number): void {
    const p = this.w.player;
    const stack = this.pieceStack(piece);
    if (stack) stack.count += count;
    else p.bag.push(pieceBagItem(p.nextUid++, piece, count));
  }

  private bagFull(): boolean {
    return this.w.player.bag.length + this.me.bag.length >= BAG_CAPACITY;
  }

  /** Chồng cùng loại trong túi của một viên Đạo Cơ Bàn. */
  private pieceStack(piece: BoardPiece): BagItem | undefined {
    return this.w.player.bag.find((x) => x.boardPiece && samePiece(x.boardPiece, piece));
  }

  /** Viên gỡ khỏi bàn về túi: gộp vào chồng cùng loại, chưa có thì thêm món mới. */
  private pieceToBag(piece: BoardPiece): void {
    const p = this.w.player;
    const stack = this.pieceStack(piece);
    if (stack) stack.count++;
    else p.bag.push(pieceBagItem(p.nextUid++, piece));
  }

  protected get sect() {
    return this.w.rules.sects[SECT];
  }

  protected top(): TopBarView {
    const p = this.w.player;
    return {
      name: p.name,
      portrait: "nhan_vat/nam_khoe/dao_bao",
      level: this.me.level,
      realm: realmOf(this.me.level),
      exp: p.exp,
      expToNext: expToNext(this.me.level),
      linhThach: p.linhThach,
      tienNgoc: p.tienNgoc,
      satNghiep: p.satNghiep,
      playMinutesLeft: this.minorMinutesLeft(),
      ageLabel: AGE_LABEL,
    };
  }

  /** Người dưới 18 tuổi thấy thời gian chơi còn lại trong ngày (GDD mục 14, G1). */
  private minorMinutesLeft(): number | undefined {
    const session = this.auth?.session();
    if (!session || ageOn(session.birthDate) >= ADULT_AGE) return undefined;
    return Math.max(0, MINOR_DAILY_MINUTES - this.auth!.playedMinutesToday());
  }

  protected miniMap(focus?: number[]): MiniMapView {
    const w = this.w;
    const now = this.now();
    const marks: MiniMapView["marks"] = w.held.map((h) => ({ pointId: h.pointId, owner: "minh", attacked: !!h.attacked && h.attacked.endsAt > now }));
    for (const s of w.sects) {
      for (const id of [s.sonMon, ...s.points]) marks.push({ pointId: id, owner: s.ally && w.alliance.joined ? "dong_minh" : "dich" });
    }
    // Sương mù: mở quanh lãnh thổ của mình và đồng minh, trong 2 chặng (đề xuất).
    const revealed = new Set<number>();
    const near = new Map<number, number[]>();
    for (const e of w.region.edges) {
      if (!near.has(e.a)) near.set(e.a, []);
      if (!near.has(e.b)) near.set(e.b, []);
      near.get(e.a)!.push(e.b);
      near.get(e.b)!.push(e.a);
    }
    const thanhChu = w.region.points.find((p) => p.type === "thanh_chu")!.id;
    let frontier = [w.sonMon, thanhChu, ...w.held.map((h) => h.pointId), ...(w.alliance.joined ? w.sects.filter((s) => s.ally).flatMap((s) => [s.sonMon, ...s.points]) : [])];
    frontier.forEach((id) => revealed.add(id));
    for (let step = 0; step < 2; step++) {
      const next: number[] = [];
      for (const id of frontier) for (const n of near.get(id) ?? []) if (!revealed.has(n)) (revealed.add(n), next.push(n));
      frontier = next;
    }
    const t = w.travel;
    const progress = Math.max(0, Math.min(1, (now - t.startsAt) / (t.endsAt - t.startsAt)));
    const openGates = this.calendarOpen(now) ? w.region.points.filter((p) => p.type === "cua_bi_canh" && revealed.has(p.id)).map((p) => p.id) : [];
    // Sự kiện đang diễn ra: chiến tranh 21:00–22:00 (điểm của mình và của tông địch), Yêu Triều (hang dị thú sát rìa ngoài).
    const alerts: MiniMapView["alerts"] = [];
    for (const war of w.wars) {
      if (now < war.startsAt || now >= war.startsAt + H) continue;
      const foe = w.sects.find((s) => s.name === war.with);
      alerts.push({
        kind: "chien_tranh", title: `Chiến tranh với ${war.with}`, endsAt: war.startsAt + H,
        points: [w.sonMon, ...w.held.map((h) => h.pointId), ...(foe ? [foe.sonMon, ...foe.points] : [])],
      });
    }
    for (const tide of w.tides) {
      if (now < tide.startsAt || now >= tide.endsAt) continue;
      alerts.push({ kind: "yeu_trieu", title: tide.title, endsAt: tide.endsAt, points: w.region.points.filter((p) => p.type === "hang_di_thu" && p.ring < tide.maxRing).map((p) => p.id) });
    }
    return { region: REGION, marks, sonMon: w.sonMon, self: { from: t.from, to: t.to, progress }, openGates, revealed: [...revealed], focus, alerts };
  }

  /** Bí cảnh mở 12:00 và 20:00, mỗi lần 30 phút (sheet Tham số: opensPerDay, openMinutes). */
  private calendarOpen(now: number): boolean {
    const mins = THAM_SO.roi_do.openMinutes;
    return [12, 20].some((h) => now >= todayAt(now, h) && now < todayAt(now, h) + mins * 60_000);
  }

  protected todo(now: number): TodoCard[] {
    const w = this.w;
    const cards: TodoCard[] = [];
    const hit = w.held.find((h) => h.attacked && h.attacked.endsAt > now);
    if (hit) {
      cards.push({
        id: "bi_danh",
        title: `${POINT_NAMES[hit.type]} đang bị đánh`,
        detail: `${hit.attacked!.by} phá trận, còn {cd:${hit.attacked!.endsAt}}`,
        go: { screen: "ban-do", pointId: hit.pointId },
      });
    }
    const stale = w.held.filter((h) => h.level > 0 && now - h.uncollectedSince > MINE_STALE_HOURS * H);
    if (stale.length) {
      const hours = Math.floor((now - Math.min(...stale.map((h) => h.uncollectedSince))) / H);
      cards.push({ id: "thu_mo", title: "Mỏ chờ thu", detail: `${stale.length} mỏ chưa thu ${hours} giờ`, go: { screen: "tong-mon", tab: "tong-quan" } });
    }
    if (this.me.loadout.length < RULES.loadoutSize) {
      cards.push({ id: "o_trong", title: "Ô công pháp còn trống", detail: `Đang mang ${this.me.loadout.length}/${RULES.loadoutSize}`, go: { screen: "cong-phap", section: "mang" } });
    }
    const worn = Object.values(w.player.gear).find((g) => g && g.durability < LOW_DURABILITY);
    if (worn) cards.push({ id: "do_hong", title: "Đồ sắp hỏng", detail: `${worn.name} còn ${worn.durability}/${worn.durabilityMax}`, go: { screen: "nhan-vat", tab: "phap-tuong" } });
    if (w.applicants.length && atLeast(this.me.role, "truong_lao")) {
      cards.push({ id: "don", title: "Đơn xin vào", detail: `${w.applicants.length} đơn chờ duyệt`, go: { screen: "tong-mon", tab: "thanh-vien" } });
    }
    const q = this.currentQuest();
    if (q) cards.push({ id: "nhiem_vu", title: q.name, detail: q.step, go: q.go });
    return cards.slice(0, 3);
  }

  protected currentQuest(): { id: string; name: string; step: string; go: Go } | undefined {
    const level = this.me.level;
    const main = NHIEM_VU.quests.filter((q) => q.kind === "chinh" && q.minLevel <= level);
    const q = main[main.length - 1];
    if (!q) return undefined;
    const step = q.steps[0] as { do: string; target?: { type?: unknown } };
    const verbs: Record<string, string> = {
      tam_dao: "Vượt ải Tầm Đạo ở thành chủ", den: "Đến", thang: "Thắng trận", tu_luyen: "Tu luyện ở linh tuyền", dot_pha: "Đột phá cảnh giới",
    };
    return { id: q.id, name: `Nhiệm vụ chính: ${q.name}`, step: verbs[step.do] ?? step.do, go: { screen: "ban-do" } };
  }

  async dongPhu(): Promise<DongPhuView> {
    const w = this.w;
    const now = this.now();
    const thanhChu = w.region.points.find((p) => p.type === "thanh_chu")!;
    const t = w.travel;
    const running = [
      ...(t.endsAt > now - 30 * 60_000
        ? [{
            kind: "hanh_trinh" as const,
            title: "Hành trình về sơn môn",
            detail: `Từ thành chủ, ${Math.max(0, 3 - Math.floor(((now - t.startsAt) / (t.endsAt - t.startsAt)) * 3))}/3 chặng còn lại`,
            endsAt: t.endsAt,
            go: { screen: "ban-do", pointId: t.to } as Go,
          }]
        : []),
      ...w.jobs.map((j) => ({
        kind: j.kind,
        title: j.title,
        detail: j.detail,
        endsAt: j.endsAt,
        go: (j.kind === "xay" ? { screen: "tong-mon", tab: "son-mon" } : j.kind === "be_quan" ? { screen: "cong-phap", section: "mang" } : { screen: "nhan-vat", tab: "phap-tuong" }) as Go,
      })),
    ];
    const mins = THAM_SO.roi_do.openMinutes * 60_000;
    const calendar: DongPhuView["calendar"] = [
      { title: "Bí cảnh", startsAt: todayAt(now, 12), endsAt: todayAt(now, 12) + mins, go: { screen: "ban-do" } },
      { title: "Bí cảnh", startsAt: todayAt(now, 20), endsAt: todayAt(now, 20) + mins, go: { screen: "ban-do" } },
    ];
    for (const war of w.wars) {
      if (new Date(war.startsAt).toDateString() === new Date(now).toDateString()) {
        calendar.push({ title: `Chiến tranh với ${war.with}`, startsAt: war.startsAt, endsAt: war.startsAt + H, go: { screen: "tong-mon", tab: "chien-su" } });
      }
    }
    // Boss liên minh thứ Sáu – Chủ Nhật (GDD mục 14, hình bố cục Liên minh); giờ mở là đề xuất.
    const dow = new Date(now).getDay();
    if (w.alliance.joined && (dow === 5 || dow === 6 || dow === 0)) {
      calendar.push({ title: "Boss liên minh", startsAt: todayAt(now, 19), endsAt: todayAt(now, 19) + H, go: { screen: "lien-minh" } });
    }
    calendar.sort((a, b) => a.startsAt - b.startsAt);
    const q = this.currentQuest();
    return {
      serverNow: now,
      top: this.top(),
      running,
      calendar,
      todo: this.todo(now),
      reports: w.reports.map((r) => {
        const res = simulate(sampleBattle(r.seed)).winner;
        return {
          id: r.id,
          title: r.title,
          result: res === "A" ? "thang" : res === "B" ? "thua" : "hoa",
          at: r.at,
          detail: "10 đấu 10",
        };
      }),
      mail: w.mail.map(({ id, from, title, unread }) => ({ id, from, title, unread })),
      quests: q ? [{ id: q.id, name: q.name.replace("Nhiệm vụ chính: ", ""), step: q.step, go: q.go }] : [],
      miniMap: this.miniMap(),
      city: { name: `Thành chủ ${w.region.region.name}`, pointId: thanhChu.id, facilities: ["Chợ", "Sàn Linh Ngọc", "Kho cá nhân", "Lò rèn", "Nhiệm vụ NPC"] },
    };
  }

  async mail(id: number): Promise<{ from: string; title: string; body: string } | undefined> {
    const m = this.w.mail.find((x) => x.id === id);
    if (m) m.unread = false;
    return m && { from: m.from, title: m.title, body: m.body };
  }

  /** Chiến báo mẫu dùng đội hình mẫu của màn Trận (mock/sampleBattle.ts) với seed riêng. */
  async battle(id: number): Promise<{ label: string; input: BattleInput; arena?: string } | undefined> {
    const r = this.w.reports.find((x) => x.id === id);
    return r && { label: `Chiến báo · ${r.title}`, input: sampleBattle(r.seed), arena: r.arena };
  }

  async nhanVat(): Promise<NhanVatView> {
    const w = this.w;
    const me = this.me;
    const p = w.player;
    const base = baseStats(me.level);
    const techs = loadoutTechniques(w.rules, PLAYER);
    const fromRoot = unitBonuses(p.roots, [], techs);
    const fromTalent = unitBonuses([], [p.talent], techs);

    // Đồ: chỉ số gốc × (1 + 3% mỗi nấc); độ bền 0 thì mất hết chỉ số (GDD mục 12).
    const gear = { hp: 0, atk: 0, def: 0, mana: 0 };
    for (const g of Object.values(p.gear) as GearItem[]) {
      if (!g || g.durability <= 0) continue;
      const k = 1 + 0.03 * g.plus;
      gear.hp += Math.round((g.stats.hp ?? 0) * k);
      gear.atk += Math.round((g.stats.atk ?? 0) * k);
      gear.def += Math.round((g.stats.def ?? 0) * k);
      gear.mana += Math.round((g.stats.mana ?? 0) * k);
    }
    // Ngọc: cấp k cho 0,25 × k × (k + 1)% kháng hệ đó, trùng linh căn +20% (GDD mục 12, đề xuất).
    const resist: Partial<Record<Element, number>> = {};
    for (const g of Object.values(p.gear) as GearItem[]) {
      for (const gem of g?.gems ?? []) {
        let v = 2.5 * gem.level * (gem.level + 1); // phần nghìn
        if (p.roots.includes(gem.element)) v *= 1.2;
        resist[gem.element] = (resist[gem.element] ?? 0) + v;
      }
    }
    const mounts = p.mounts.map((id) => (id ? THU_CUOI.find((t) => t.id === id) : undefined));
    const mountPct = mounts.reduce((s, m) => s + (m ? THU_PHAM[m.grade as keyof typeof THU_PHAM].statBonus / MOUNT_STAT_DIV : 0), 0) / 100;
    const mount = { hp: Math.round(base.hp * mountPct), atk: Math.round(base.atk * mountPct), def: Math.round(base.def * mountPct) };

    const pct = (v: number, perMille: number) => Math.round((v * perMille) / 1000);
    const line = (id: string, label: string, unit: StatLine["unit"], sources: StatSource[]): StatLine => ({
      id, label, unit, sources: sources.filter((s) => s.value !== 0 || s.label === "Gốc theo cấp"), value: sources.reduce((a, s) => a + s.value, 0),
    });
    const hp = line("hp", "Máu", "", [
      { label: "Gốc theo cấp", value: base.hp }, { label: "Đồ", value: gear.hp }, { label: "Thú", value: mount.hp },
      { label: "Tài năng", value: pct(base.hp, fromTalent.hp) }, { label: "Buff linh căn", value: pct(base.hp, fromRoot.hp) },
    ]);
    const atk = line("atk", "Công lực", "", [{ label: "Gốc theo cấp", value: base.atk }, { label: "Đồ", value: gear.atk }, { label: "Thú", value: mount.atk }]);
    const defSources: StatSource[] = [
      { label: "Gốc theo cấp", value: base.def }, { label: "Đồ", value: gear.def }, { label: "Thú", value: mount.def },
      { label: "Tài năng", value: pct(base.def, fromTalent.def) }, { label: "Buff linh căn", value: pct(base.def, fromRoot.def) },
    ];
    // Phòng thủ chung chỉ còn trong main (trường def của UnitSpec); bảng chỉ số tách thủ ngoại, thủ nội (set đồ 2.0): cùng
    // phòng thủ gốc, cộng phần nghìn defOuter, defInner của set, dòng phụ, dòng rèn như sim.
    const def = line("def", "Phòng thủ", "", defSources);
    const sub = (s: GearSlot) => p.luyenKhi.slots[s]?.sub ?? 0;
    const worn = (Object.values(p.gear) as WorldGear[]).filter((g) => g && kieuOk(g.code));
    const gs = gearStats(
      worn.map((g) => toEquip(g, sub(g.slot))), me.level, p.roots, { cells: p.board, progress: progressOf(me.level) }, techs.map((t) => t.element),
    );
    const defOuter = line("defOuter", "Thủ ngoại", "", [...defSources, { label: "Set, dòng phụ, dòng rèn", value: pct(def.value, gs.bonuses.defOuter ?? 0) }]);
    const defInner = line("defInner", "Thủ nội", "", [...defSources, { label: "Set, dòng phụ, dòng rèn", value: pct(def.value, gs.bonuses.defInner ?? 0) }]);
    const mana = line("mana", "Mana", "", [
      { label: "Gốc theo cấp", value: BATTLE.manaMax }, { label: "Đồ", value: gear.mana },
      { label: "Tài năng", value: pct(BATTLE.manaMax, fromTalent.manaMax) }, { label: "Buff linh căn", value: pct(BATTLE.manaMax, fromRoot.manaMax) },
    ]);
    const permille = (id: string, label: string, baseValue: number, key: keyof typeof fromRoot): StatLine =>
      line(id, label, "‰", [{ label: "Gốc theo cấp", value: baseValue }, { label: "Tài năng", value: fromTalent[key] }, { label: "Buff linh căn", value: fromRoot[key] }]);
    const stats: StatLine[] = [
      hp, atk, defOuter, defInner, mana,
      permille("crit", "Chí mạng", BASE_CRIT_PER_MILLE, "critBonus"),
      permille("critDamage", "Sát thương chí mạng", BATTLE.critDamage, "critDamage"),
      permille("attackSpeed", "Tốc đánh", 0, "attackSpeed"),
      permille("cooldownCut", "Giảm hồi chiêu", 0, "cooldownCut"),
      permille("lifesteal", "Hút máu", 0, "lifesteal"),
      permille("resistPen", "Xuyên kháng", 0, "resistPen"),
      ...(Object.entries(resist) as [Element, number][]).map(([e, v]) => line(`resist_${e}`, `Kháng ${ELEMENT_LABEL[e]}`, "‰", [{ label: "Gốc theo cấp", value: 0 }, { label: "Ngọc", value: Math.round(v) }])),
      line("luck", "Luck", "", [{ label: "Gốc theo cấp", value: 0 }]),
    ];

    const power = (s: { hp: number; atk: number; def: number }) => s.hp * POWER.hp + s.atk * POWER.atk + s.def * POWER.def;
    const techPower = techs.reduce((a, t) => a + (t.damage / 1000) * t.targets * POWER.tech, 0);
    const core = power({ hp: hp.value - gear.hp - mount.hp, atk: atk.value - gear.atk - mount.atk, def: def.value - gear.def - mount.def }) + techPower;
    // Phần đồ và thú bị chặn ở trần tính trên tổng.
    let gearP = power(gear);
    let mountP = power(mount);
    gearP = Math.min(gearP, (GEAR_CAP / (1 - GEAR_CAP)) * (core + mountP));
    mountP = Math.min(mountP, (MOUNT_CAP / (1 - MOUNT_CAP)) * (core + gearP));
    const total = Math.round(core + gearP + mountP);

    const realm = THU_CANH_GIOI[0];
    const mountViews: (MountView | null)[] = mounts.map((m) =>
      m ? { id: m.id, name: m.name, element: m.element as Element, grade: THU_PHAM[m.grade as keyof typeof THU_PHAM].name, realm: realm.name, icon: m.asset } : null,
    );
    const owned = mountViews.filter((m): m is MountView => m !== null);
    const countBy = (key: (m: MountView) => string) => {
      const c: Record<string, number> = {};
      for (const m of owned) c[key(m)] = (c[key(m)] ?? 0) + 1;
      return Math.max(0, ...Object.values(c));
    };
    const els = new Set(owned.map((m) => m.element));
    const active: Record<string, boolean> = {
      dong_he: countBy((m) => m.element) >= 3 && owned.length < 5,
      thuan_he: owned.length === 5 && countBy((m) => m.element) === 5,
      goc_bien: (["kim:loi", "moc:phong", "thuy:cuc_han", "hoa:cuc_duong", "tho:cuc_am"] as const).some((pair) => pair.split(":").every((e) => els.has(e as Element))),
      doi_cuc: (els.has("cuc_duong") && els.has("cuc_am")) || (els.has("quang") && els.has("am_lanh")),
      ngu_hanh: ["kim", "moc", "thuy", "hoa", "tho"].every((e) => els.has(e as Element)),
      dong_dang: false,
      tu_tuong: false,
    };
    const talent = TAI_NANG[p.talent];
    const now = this.now();
    // Tu luyện: gốc theo cấp, nhân linh khí vị diện, cộng linh tuyền tông đang giữ.
    const perHourBase = Math.round(expToNext(me.level) / RETREAT_HOURS_PER_LEVEL);
    const spring = w.held.some((h) => h.type === "linh_tuyen") ? Math.round(perHourBase * LINH_KHI_HA * SPRING_BONUS) : 0;
    const breakLevel = breakLevelOf(me.level);
    const retreat = w.jobs.find((j) => j.kind === "be_quan" && j.endsAt > now);
    const byId = (id: number) => me.learned.find((l) => l.techniqueId === id)!;
    const loadout: (TechniqueCard | null)[] = [];
    for (let i = 0; i < RULES.loadoutSize; i++) loadout.push(me.loadout[i] !== undefined ? learnedCard(byId(me.loadout[i])) : null);
    const learned = me.learned.map(learnedCard);
    const items: BagItem[] = [
      ...p.bag.map((it) => (it.gear ? { ...it, gear: gearView(it.gear, 0, me.level, p.roots) } : it)),
      ...me.bag.map((sc): BagItem => {
        const c = scrollCard(sc);
        return {
          uid: c.uid, kind: "tan_quyen", name: c.name, grade: techGrade(c.grade), gradeLabel: c.gradeName, count: 1, element: c.element,
          art: `tan_quyen/${c.element}`, code: elementCode("TQ", c.element), detail: `Nộp ở Tàng Kinh Các được ${c.contribution} cống hiến.`,
        };
      }),
      ...learned
        .filter((t) => !me.loadout.includes(t.id))
        // Hình công pháp vẽ Canva theo hệ (TechniqueCard.art); loại chiêu hiện ở chip icon_ve/chieu/<loại> trên màn.
        .map((t): BagItem => ({ uid: LEARNED_UID + t.id, kind: "cong_phap", name: t.name, grade: techGrade(t.grade), gradeLabel: t.gradeName, count: 1, element: t.element, art: t.art, code: elementCode("CP", t.element), detail: t.summary, technique: t })),
    ];
    return {
      serverNow: now,
      top: this.top(),
      name: p.name,
      roots: p.roots,
      talent: { id: talent.id, name: talent.name, combat: talent.combat },
      level: me.level,
      exp: p.exp,
      expToNext: expToNext(me.level),
      sect: { name: w.sect.name, role: me.role, faction: w.sect.faction },
      satNghiep: p.satNghiep,
      contribution: me.contribution,
      cultivation: {
        perHour: perHourBase * LINH_KHI_HA + spring,
        sources: [
          { label: `Gốc: 1/${RETREAT_HOURS_PER_LEVEL} kinh nghiệm cấp mỗi giờ`, value: perHourBase },
          { label: `Linh khí Hạ vị ×${LINH_KHI_HA}`, value: perHourBase * (LINH_KHI_HA - 1) },
          { label: `Linh tuyền của tông +${SPRING_BONUS * 100}%`, value: spring },
        ],
        breakAt: { level: breakLevel, realm: realmOf(breakLevel + 1) },
        canBreak: me.level === breakLevel && p.exp >= expToNext(me.level),
        retreat: retreat && { title: retreat.title, endsAt: retreat.endsAt },
      },
      loadout,
      learned,
      bag: { capacity: BAG_CAPACITY, items },
      riding: p.riding,
      power: {
        total,
        parts: [
          { id: "co_ban", label: "Cấp, công pháp, tài năng", value: Math.round(core) },
          { id: "do", label: "Đồ", value: Math.round(gearP), cap: GEAR_CAP },
          { id: "thu", label: "Thú", value: Math.round(mountP), cap: MOUNT_CAP },
        ],
      },
      gear: Object.fromEntries(
        (Object.entries(p.gear) as [GearSlot, WorldGear][]).map(([s, g]) => [
          s, gearView(g, sub(s), me.level, p.roots, s === "ngoc_boi" ? p.gear.dai?.dongAn : s === "dai" ? p.gear.ngoc_boi?.dongAn : undefined),
        ]),
      ),
      sets: setViews(gs, p.gear),
      binhBo: binhBoView(gs, p.gear),
      score: diemTrangBi(gs, me.level),
      main: [hp, atk, def, mana],
      stats,
      mounts: mountViews,
      combos: Object.values(THU_KICH_PHAT).map((k) => ({ name: k.name, effect: `${k.condition}: ${k.effect}`, active: active[k.id] ?? false })),
      // Mũ và vũ khí trên hình đổi theo món đang mặc.
      board: { cells: { ...p.board }, gearSets: gearSets(p.gear), progress: progressOf(me.level) },
      luyenKhi: this.luyenKhiView(),
      look: { body: "nam_khoe", outfit: "dao_bao", idle: "nhan_vat/nam_khoe/dao_bao/dung", hat: p.gear.mu?.icon?.split("/").pop(), weapon: p.gear.vu_khi?.icon?.split("/").pop() },
    };
  }

  async tongMon(): Promise<TongMonView> {
    const w = this.w;
    const now = this.now();
    const sect = this.sect;
    const row = sectRow(sect.level);
    const role = this.me.role;
    const perHour = { linhThach: 0, quang: 0, duoc: 0 };
    for (const h of w.held) {
      const v = minePerHour(h.level);
      if (h.type === "mo_linh_thach") perHour.linhThach += v;
      if (h.type === "mo_quang") perHour.quang += v;
      if (h.type === "mo_duoc") perHour.duoc += v;
    }
    // Phí duy trì (GDD mục 10, đề xuất): hộ trận 10 × (máu ÷ 1.000)^1,5 mỗi ngày; máu = 50 × tổng cấp × (1 + 0,05 × (n − 1)).
    const wardHp = 50 * WARD.totalLevel * (1 + 0.05 * (WARD.casters - 1));
    const wardUpkeep = Math.round(10 * Math.pow(wardHp / 1000, 1.5));
    const portalUpkeep = row.miniPortals * MINI_PORTAL_UPKEEP;
    const upkeep = wardUpkeep + portalUpkeep;
    const sonMon = w.region.points[w.sonMon];
    const members = Object.values(w.rules.members)
      .filter((m) => m.sectId === SECT)
      .map((m) => ({ id: m.id, name: w.names[m.id] ?? m.id, role: m.role!, level: m.level, online: !!w.online[m.id], npc: !!w.npc[m.id] }))
      .sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role) || b.level - a.level);
    return {
      serverNow: now,
      top: this.top(),
      viewerRole: role,
      sect: {
        name: w.sect.name,
        level: sect.level,
        xp: w.sect.xp,
        xpToNext: row.xpToNext,
        region: REGION,
        regionName: w.region.region.name,
        terrain: TERRAIN_NAMES[sonMon.terrain ?? ""] ?? "—",
        faction: w.sect.faction,
        island: `tong_mon/${w.sect.model.id}`,
        model: w.sect.model,
        terrainId: sonMon.terrain ?? "co_tich",
      },
      territory: {
        held: w.held.map((h) => ({ pointId: h.pointId, type: h.type, level: h.level, perHour: minePerHour(h.level), uncollectedSince: h.uncollectedSince, attacked: h.attacked && h.attacked.endsAt > now ? h.attacked : undefined })),
        max: row.maxPoints,
        range: row.range,
        perHour,
      },
      vault: {
        linhThach: w.sect.vault.linhThach,
        upkeepPerDay: upkeep,
        daysLeft: upkeep > 0 ? Math.floor(w.sect.vault.linhThach / upkeep) : Infinity,
        parts: [
          { label: `Hộ trận sơn môn (${WARD.casters} trận pháp sư)`, value: wardUpkeep },
          { label: `${row.miniPortals} tiểu Truyền Tống Trận`, value: portalUpkeep },
        ],
      },
      wars: w.wars,
      members,
      memberMax: row.members,
      applicants: w.applicants,
      buildings: w.buildings,
      miniMap: this.miniMap([w.sonMon, ...w.held.map((h) => h.pointId)]),
      can: {
        hienTe: role !== null,
        duyet: atLeast(role, "truong_lao"),
        tuyenChien: atLeast(role, "pho_tong_chu") && sect.level >= KT.warLevel,
        xuatSu: role !== null && RULES.releaseRoles.includes(role),
        xay: atLeast(role, "pho_tong_chu"),
      },
      donateXpPerStone: KT.xpPerStone,
    };
  }

  async congPhap(): Promise<CongPhapView> {
    const me = this.me;
    const sect = this.sect;
    const role = me.role;
    const byId = (id: number) => me.learned.find((l) => l.techniqueId === id)!;
    const loadout: (TechniqueCard | null)[] = [];
    for (let i = 0; i < RULES.loadoutSize; i++) loadout.push(me.loadout[i] !== undefined ? learnedCard(byId(me.loadout[i])) : null);
    const fromSect = me.learned.filter((l) => l.sectId === SECT).length;
    return {
      serverNow: this.now(),
      top: this.top(),
      viewerRole: role,
      loadout,
      learned: me.learned.map(learnedCard),
      transmission: sect.transmission.map((id) => {
        const t = sect.techniques.find((x) => x.id === id)!;
        const learned = me.learned.some((l) => l.techniqueId === id);
        let blocked: string | undefined;
        if (!learned && role === "ngoai_mon" && (t.grade > RULES.outerMaxGrade || fromSect >= RULES.outerMaxLearned)) blocked = "Ngoại môn giới hạn";
        else if (!learned && t.grade > maxGradeAtLevel(me.level)) blocked = `Cần cấp ${[1, 50, 100, 150][t.grade - 1] ?? "?"}`;
        return { ...techCard(t), learned, blocked };
      }),
      transmissionSlots: transmissionSlots(sect.level),
      bag: me.bag.map(scrollCard),
      library: sect.library.map(scrollCard),
      sectTechniques: sect.techniques.map((t) => techCard(t)),
      contribution: me.contribution,
      can: {
        ghep: role !== null && RULES.composeRoles.includes(role),
        truyenThu: role !== null && RULES.transmissionRoles.includes(role),
      },
      maxSubs: sect.level >= RULES.secondSubLevel ? 2 : 1,
    };
  }

  async lienMinh(): Promise<LienMinhView> {
    const w = this.w;
    const now = this.now();
    const role = this.me.role;
    const mine = { id: SECT, name: w.sect.name, level: this.sect.level, faction: w.sect.faction, points: w.held.length, online: Object.values(w.online).filter(Boolean).length, color: "#e6d8b8" };
    const allies = w.sects.filter((s) => s.ally);
    // Thứ Ba, Năm, Bảy 21:00–22:00 (hình bố cục Liên minh): trận gần nhất trong tuần.
    const nextWar = (() => {
      for (let d = 0; d < 7; d++) {
        const t = todayAt(now + d * 24 * H, 21);
        if ([2, 4, 6].includes(new Date(t).getDay()) && t + H > now) return t;
      }
      return todayAt(now, 21);
    })();
    return {
      serverNow: now,
      top: this.top(),
      viewerRole: role,
      sectLevel: this.sect.level,
      alliance: w.alliance.joined
        ? {
            name: w.alliance.name,
            leader: w.alliance.leader,
            sects: [
              ...allies.filter((s) => s.name === w.alliance.leader).map(toAllianceSect),
              mine,
              ...allies.filter((s) => s.name !== w.alliance.leader).map(toAllianceSect),
            ],
            warDays: "Thứ Ba, Năm, Bảy",
            warHours: "21:00–22:00",
            wars: [{ with: "Thanh Phong Các", startsAt: nextWar }],
            helpRequests: [{ from: "Thiên Lôi Đài", point: "Mỏ quặng phía bắc", at: now - 22 * 60_000 }],
            boss: { name: "Lôi Giao Vương", days: "Thứ Sáu – Chủ Nhật", hpPercent: 64 },
            chat: w.chat.slice(-30),
            miniMap: this.miniMap([w.sonMon, ...w.held.map((h) => h.pointId), ...allies.flatMap((s) => [s.sonMon, ...s.points])]),
          }
        : null,
      list: [
        { id: "lien_minh_loi", name: "Lôi Minh", sects: 3, level: 41, invited: true },
        { id: "phong_van_hoi", name: "Phong Vân Hội", sects: 4, level: 52, invited: false },
        { id: "huyet_y_minh", name: "Huyết Y Minh", sects: 2, level: 33, invited: false },
      ],
      joinLevel: KT.allianceJoinLevel,
      createLevel: KT.allianceCreateLevel,
      can: { lienMinh: atLeast(role, "pho_tong_chu") },
    };
  }

  private npc?: Promise<Record<string, NpcSect[]>>;
  /** Tông NPC cả vị diện: dựng lần đầu mở bản đồ (cần file điểm mọi vùng; màn bản đồ cũng dùng lại các file này). */
  private npcSects(): Promise<Record<string, NpcSect[]>> {
    const w = this.w;
    return (this.npc ??= loadWorld()
      .then((plane) => Promise.all(plane.regions.map((r) => loadRegion(r.code))))
      .then((maps) => npcSects(maps, REGION, new Set([w.sonMon, ...w.sects.map((s) => s.sonMon)]), new Set([w.sect.name, ...w.sects.map((s) => s.name), "Huyết Sát Môn"]))));
  }

  async banDo(): Promise<BanDoView> {
    const w = this.w;
    const now = this.now();
    const role = this.me.role;
    const npc = await this.npcSects();
    const owners: BanDoView["owners"] = {};
    for (const s of npc[REGION] ?? []) owners[s.pointId] = { owner: "npc", name: s.name };
    const sectSites: BanDoView["sectSites"] = {};
    for (const [code, list] of Object.entries(npc))
      if (code !== REGION) sectSites[code] = Object.fromEntries(list.map((s) => [s.pointId, { owner: "npc", name: s.name }]));
    owners[w.sonMon] = { owner: "minh", name: w.sect.name };
    for (const h of w.held) {
      owners[h.pointId] = {
        owner: "minh", name: w.sect.name, level: h.level || undefined, perHour: minePerHour(h.level) || undefined,
        attacked: h.attacked && h.attacked.endsAt > now ? h.attacked : undefined,
      };
    }
    for (const s of w.sects) {
      const owner = s.ally && w.alliance.joined ? "dong_minh" : "dich";
      owners[s.sonMon] = { owner, name: s.name };
      for (const id of s.points) {
        const p = w.region.points[id];
        const level = p.type.startsWith("mo_") ? 1 + (id % 3) : undefined;
        owners[id] = { owner, name: s.name, level, perHour: level ? minePerHour(level) : undefined };
      }
    }
    const row = sectRow(this.sect.level);
    const dist = stagesFrom(w.region, w.sonMon);
    return {
      serverNow: now,
      top: this.top(),
      viewerRole: role,
      map: this.miniMap(),
      sectIsland: `tong_mon/${w.sect.model.id}`,
      owners,
      sectSites,
      inRange: [...dist].filter(([, d]) => d <= row.range).map(([id]) => id),
      held: w.held.length,
      maxHeld: row.maxPoints,
      can: { chiem: atLeast(role, "truong_lao"), tuyenChien: atLeast(role, "pho_tong_chu") && this.sect.level >= KT.warLevel },
    };
  }

  async send(cmd: DashboardCommand): Promise<CommandResult> {
    const w = this.w;
    const now = this.now();
    const rule = (c: Command): CommandResult => {
      const r = apply(w.rules, c, now);
      return r.ok ? { ok: true } : { ok: false, error: r.error };
    };
    switch (cmd.type) {
      case "nop_tan_quyen": {
        const s = this.me.bag.find((x) => x.uid === cmd.scrollUid);
        const r = rule({ type: "nop_tan_quyen", actor: PLAYER, scrollUid: cmd.scrollUid });
        return r.ok && s ? { ok: true, message: `Nộp xong, +${RULES.contributionPerScroll[s.grade - 1]} cống hiến` } : r;
      }
      case "ghep_cong_phap": {
        const r = rule({ type: "ghep_cong_phap", actor: PLAYER, main: cmd.main, subs: cmd.subs });
        const t = this.sect.techniques[this.sect.techniques.length - 1];
        return r.ok ? { ok: true, message: `Ghép được ${t.name}` } : r;
      }
      case "dat_bo_truyen_thu": {
        const r = rule({ type: "dat_bo_truyen_thu", actor: PLAYER, techniqueIds: cmd.techniqueIds });
        return r.ok ? { ok: true, message: `Bộ truyền thụ có ${cmd.techniqueIds.length} công pháp` } : r;
      }
      case "hoc_cong_phap": {
        const r = rule({ type: "hoc_cong_phap", actor: PLAYER, techniqueId: cmd.techniqueId });
        const t = this.sect.techniques.find((x) => x.id === cmd.techniqueId);
        return r.ok ? { ok: true, message: `Đã học ${t?.name ?? "công pháp"}, tầng 1` } : r;
      }
      case "mac_do": {
        const p = w.player;
        const i = p.bag.findIndex((x) => x.uid === cmd.uid && x.gear);
        if (i < 0) return { ok: false, error: "khong_thay_mon" };
        const g = p.bag[i].gear!;
        const old = p.gear[g.slot];
        p.bag.splice(i, 1);
        if (old) p.bag.push(gearBagItem(p.nextUid++, old));
        p.gear[g.slot] = g;
        return { ok: true, message: old ? `Đã mặc ${g.name}, ${old.name} về túi` : `Đã mặc ${g.name}` };
      }
      case "thao_do": {
        const p = w.player;
        const g = p.gear[cmd.slot];
        if (!g) return { ok: false, error: "khong_thay_mon" };
        if (p.bag.length + this.me.bag.length >= BAG_CAPACITY) return { ok: false, error: "tui_day" };
        delete p.gear[cmd.slot];
        p.bag.push(gearBagItem(p.nextUid++, g));
        return { ok: true, message: `${g.name} về túi` };
      }
      case "dot_pha": {
        const p = w.player;
        const me = this.me;
        if (me.level !== breakLevelOf(me.level) || me.level >= 250 || p.exp < expToNext(me.level)) return { ok: false, error: "chua_du_tu_vi" };
        p.exp -= expToNext(me.level);
        me.level++;
        // Không báo bằng chữ: thanh trên phát màn đột phá khi cảnh giới đổi.
        return { ok: true };
      }
      case "dev_len_cap": {
        let need = -w.player.exp;
        for (let i = 0, lv = this.me.level; i < Math.max(1, cmd.levels); i++, lv++) need += expToNext(lv);
        this.gainExp(Math.max(0, need));
        return { ok: true };
      }
      case "phan_giai": {
        const p = w.player;
        const lk = p.luyenKhi;
        if (!reached(progressOf(this.me.level), UNLOCK.phanGiai)) return { ok: false, error: "chua_mo" };
        const items = cmd.uids.map((uid) => p.bag.find((x) => x.uid === uid));
        if (!items.length || items.some((it) => !it?.gear)) return { ok: false, error: "khong_thay_mon" };
        if (items.some((it) => !canDecompose(it!.gear!.rarity))) return { ok: false, error: "khong_phan_giai_duoc" };
        let kt = 0;
        let stones = 0;
        for (const it of items) {
          const g = it!.gear!;
          const n = khiTinhOf(g.rarity);
          kt += n;
          if (yieldLocked(g.rarity)) lk.khiTinhKhoa += n;
          stones += stoneBack(g.plus);
          // Ngọc và ấn đang khảm về túi nguyên vẹn; kiểu của món vẫn ghi trong Bảo Giám.
          for (const gem of g.gems) this.toBag({ loai: "ngoc", he: gem.element, cap: gem.level }, 1);
          if (g.seal) this.toBag({ loai: "an", ma: g.seal }, 1);
          if (it!.code && !lk.owned.includes(it!.code)) lk.owned.push(it!.code);
          p.bag.splice(p.bag.indexOf(it!), 1);
        }
        lk.khiTinh += kt;
        return { ok: true, message: `Nhận ${fmt(kt)} Khí Tinh${stones ? `, ${stones} nấc Luyện Khí Thạch` : ""}` };
      }
      case "tay_luyen": {
        const p = w.player;
        const ls = p.luyenKhi.slots[cmd.slot];
        if (!reached(progressOf(this.me.level), UNLOCK.tayLuyen)) return { ok: false, error: "chua_mo" };
        if (!ls || !p.gear[cmd.slot]) return { ok: false, error: "khong_thay_mon" };
        if (p.luyenKhi.khiTinh < REROLL_KHI_TINH) return { ok: false, error: "khong_du_khi_tinh" };
        const stone = rerollStone(p.gear[cmd.slot]!.rarity);
        if (p.linhThach < stone) return { ok: false, error: "khong_du_linh_thach" };
        // Chỉ Tu rèn chọn thẳng loại; người khác quay trong 3 loại còn lại.
        if (cmd.loai !== undefined && String(p.talent) !== "tu_ren") return { ok: false, error: "chi_tu_ren" };
        if (cmd.loai !== undefined && (cmd.loai < 0 || cmd.loai > 3 || cmd.loai === ls.sub)) return { ok: false, error: "sai_loai" };
        this.spendKhiTinh(REROLL_KHI_TINH);
        p.linhThach -= stone;
        ls.sub = cmd.loai ?? rerollSub(ls.sub);
        const x = SUB[cmd.slot][ls.sub];
        return { ok: true, message: `Chỉ số phụ mới: ${x.ten} ${x.gt}` };
      }
      case "nap_khi_linh": {
        const p = w.player;
        const g = p.gear[cmd.slot];
        const ls = p.luyenKhi.slots[cmd.slot];
        if (!reached(progressOf(this.me.level), UNLOCK.khiLinh)) return { ok: false, error: "chua_mo" };
        if (!g || !ls) return { ok: false, error: "khong_thay_mon" };
        if (!hasKhiLinh(g.rarity)) return { ok: false, error: "khong_co_khi_linh" };
        if (ls.kl.cap >= KL_MAX) return { ok: false, error: "khi_linh_toi_da" };
        const n = Math.min(Math.floor(cmd.khiTinh), p.luyenKhi.khiTinh);
        if (n < 1) return { ok: false, error: "khong_du_khi_tinh" };
        this.spendKhiTinh(n);
        const passed = addExp(ls.kl, n * KL_PER_KHI_TINH);
        syncVan(ls, g.rarity);
        this.offerNext(cmd.slot);
        return { ok: true, message: passed.length ? `Khí linh ${g.name} lên cấp ${ls.kl.cap}` : `Nạp ${n} Khí Tinh` };
      }
      case "chon_khi_van": {
        const ls = w.player.luyenKhi.slots[cmd.slot];
        if (!reached(progressOf(this.me.level), UNLOCK.khiLinh)) return { ok: false, error: "chua_mo" };
        if (!ls || cmd.o < 0 || cmd.o >= ls.van.length) return { ok: false, error: "khong_thay_o" };
        if (ls.offerAt !== cmd.o || !ls.offer?.includes(cmd.ma)) return { ok: false, error: "khong_co_lua_chon" };
        ls.van[cmd.o] = cmd.ma;
        ls.offer = undefined;
        ls.offerAt = undefined;
        this.offerNext(cmd.slot);
        return { ok: true };
      }
      case "tay_van": {
        const lk = w.player.luyenKhi;
        const ls = lk.slots[cmd.slot];
        if (!reached(progressOf(this.me.level), UNLOCK.khiLinh)) return { ok: false, error: "chua_mo" };
        if (!ls || cmd.o < 0 || cmd.o >= ls.van.length) return { ok: false, error: "khong_thay_o" };
        if (lk.linhVanThach < VAN_REROLL) return { ok: false, error: "khong_du_linh_van_thach" };
        lk.linhVanThach -= VAN_REROLL;
        ls.offer = rollOffer(cmd.slot);
        ls.offerAt = cmd.o;
        return { ok: true };
      }
      case "hop_song_he": {
        const lk = w.player.luyenKhi;
        const a = lk.gems.find((x) => x.id === cmd.a && x.n > 0);
        const b = lk.gems.find((x) => x.id === cmd.b && x.n > 0);
        if (!a || !b || a === b) return { ok: false, error: "khong_thay_mon" };
        if (a.he2 || b.he2 || a.cap !== b.cap || a.cap < SONG_HE_FROM || !songHeOk(a.he, b.he)) return { ok: false, error: "khong_hop_duoc" };
        // Phù bảo ngọc dùng mỗi lần hợp (đậu hay không đều tiêu một tấm).
        const bag = w.player.bag;
        const phu = cmd.phu ? bag.find((it) => it.code === SONG_HE_PHU && it.count > 0) : undefined;
        if (cmd.phu && !phu) return { ok: false, error: "khong_thay_mon" };
        if (phu && --phu.count === 0) bag.splice(bag.indexOf(phu), 1);
        // Tỷ lệ đậu cố định (GDD rev 47). Không đậu: mất viên b (SONG_HE_LOSE viên), giữ viên a; có phù thì giữ cả hai.
        if (Math.random() * 1000 >= SONG_HE_RATE) {
          if (phu) return { ok: true, message: "Hợp không đậu: Phù bảo ngọc giữ lại cả hai viên" };
          b.n -= SONG_HE_LOSE;
          return { ok: true, message: "Hợp không đậu: mất viên thứ hai" };
        }
        a.n--;
        b.n--;
        const same = lk.gems.find((x) => x.he === a.he && x.he2 === b.he && x.cap === a.cap);
        if (same) same.n++;
        else lk.gems.push({ id: `sh${w.player.nextUid++}`, he: a.he, he2: b.he, cap: a.cap, n: 1 });
        return { ok: true, message: `Thành ngọc song hệ cấp ${a.cap}` };
      }
      case "diem_hoa_phach": {
        const lk = w.player.luyenKhi;
        const g = lk.gems.find((x) => x.id === cmd.gem && x.n > 0);
        if (!g) return { ok: false, error: "khong_thay_mon" };
        if (g.he2 || g.cap < PHACH_FROM) return { ok: false, error: "khong_hop_duoc" };
        if (lk.phach.includes(g.he)) return { ok: false, error: "da_co_phach" };
        if (lk.khiTinh < PHACH_KHI_TINH) return { ok: false, error: "khong_du_khi_tinh" };
        this.spendKhiTinh(PHACH_KHI_TINH);
        if (Math.random() * 1000 >= PHACH_RATE) return { ok: true, message: `Không đậu: mất ${PHACH_KHI_TINH} Khí Tinh, ngọc còn nguyên` };
        g.n--;
        lk.phach.push(g.he);
        if (!lk.owned.includes(phachCode(g.he))) lk.owned.push(phachCode(g.he));
        return { ok: true, message: `Thành ${phachName(g.he)}` };
      }
      case "khai_lo_danh_khi": {
        const p = w.player;
        const lk = p.luyenKhi;
        const i = DANH_KHI.findIndex((d) => d.ma === cmd.ma);
        if (i < 0) return { ok: false, error: "khong_thay_mon" };
        const d = DANH_KHI[i];
        if (!reached(progressOf(this.me.level), UNLOCK.danhKhi)) return { ok: false, error: "chua_mo" };
        const lo = w.buildings.find((b) => b.id === "luyen_khi_cac")?.level ?? 0;
        if (lo < LO_MIN) return { ok: false, error: "lo_chua_du_cap" };
        const phoi = p.bag.find((it) => it.gear?.slot === "vu_khi" && it.gear.rarity === "do" && khiHinhOf(it.code) === d.khiHinh);
        if (!lk.doPho.includes(doPhoCode(i)) || !phoi) return { ok: false, error: "thieu_nguyen_lieu" };
        if (lk.vanThiet < DANH_KHI_COST.vanThiet || lk.khiTinh < DANH_KHI_COST.khiTinh) return { ok: false, error: "thieu_nguyen_lieu" };
        // 4 người khác nhau cùng tông; chủ lò là mình thì phải Tu rèn (nguồn đọc chưa có tài năng của thành viên khác).
        const crew = new Set(cmd.nguoi);
        if (cmd.nguoi.length !== 4 || crew.size !== 4 || cmd.nguoi.some((id) => !w.rules.members[id])) return { ok: false, error: "thieu_nguoi_luyen" };
        if (cmd.nguoi[0] === PLAYER && String(p.talent) !== "tu_ren") return { ok: false, error: "chi_tu_ren" };
        this.spendKhiTinh(DANH_KHI_COST.khiTinh);
        lk.vanThiet -= DANH_KHI_COST.vanThiet;
        if (Math.random() * 1000 >= loRate(lo)) return { ok: true, message: "Lò không thành: mất Khí Tinh và Vẫn Thiết, còn phôi và đồ phổ" };
        // Thành: phôi thành danh khí (giữ chỉ số phôi), đồ phổ dùng hết; danh khí khóa vào nhân vật.
        const g = phoi.gear!;
        phoi.name = d.ten;
        phoi.code = d.ma;
        phoi.art = undefined;
        phoi.detail = `Danh khí. Danh văn: ${d.van}`;
        phoi.gear = { ...g, name: d.ten, code: d.ma, art: undefined };
        lk.doPho.splice(lk.doPho.indexOf(doPhoCode(i)), 1);
        if (!lk.owned.includes(d.ma)) lk.owned.push(d.ma);
        return { ok: true, message: `Luyện thành ${d.ten}` };
      }
      case "ghep_an": {
        const p = w.player;
        const it = p.bag.find((x) => x.uid === cmd.uid);
        if (!it) return { ok: false, error: "khong_thay_mon" };
        const pc = it.boardPiece;
        if (!pc || pc.loai !== "an") return { ok: false, error: "khong_phai_an" };
        if (it.count < GHEP_AN_SO) return { ok: false, error: "an_khong_du" };
        let next: Bac;
        try {
          next = ghepAn(pc.bac ?? "tim", GHEP_AN_SO);
        } catch {
          return { ok: false, error: "an_khong_ghep_len" };
        }
        const up: BoardPiece = { loai: "an", ma: pc.ma, bac: next };
        // Chồng cũ còn viên mà chưa có chồng bậc trên thì cần thêm một ô túi.
        if (it.count > GHEP_AN_SO && !this.pieceStack(up) && this.bagFull()) return { ok: false, error: "tui_day" };
        it.count -= GHEP_AN_SO;
        if (it.count === 0) p.bag.splice(p.bag.indexOf(it), 1);
        this.pieceToBag(up);
        return { ok: true, message: `Ghép thành ${pieceBagItem(0, up).name} bậc ${RARITY_LABEL[next]}` };
      }
      case "giam_dinh": {
        const p = w.player;
        const lines = p.gear[cmd.slot]?.dongAn ?? [];
        if (!lines.length) return { ok: false, error: "khong_co_dong_an" };
        const i = cmd.i ?? lines.findIndex((l) => l.lo === "an");
        if (i < 0) return { ok: false, error: "da_lo" };
        const l = lines[i];
        if (!l) return { ok: false, error: "khong_thay_dong" };
        if (l.lo !== "an") return { ok: false, error: "da_lo" };
        const phu = p.bag.find((x) => x.code === GIAM_DINH_PHU && x.count > 0);
        if (!phu) return { ok: false, error: "thieu_giam_dinh_phu" };
        if (--phu.count === 0) p.bag.splice(p.bag.indexOf(phu), 1);
        l.lo = "dk";
        return { ok: true, message: `Điều kiện lộ: ${DONG_AN_TEXT[l.dk]}` };
      }
      case "tay_an": {
        // Chỉ tẩy dòng đã kích phát (hiệu ứng đã lộ); hiệu ứng mới hiện ngay nên cặp mới vào sổ Ẩn văn (đề xuất).
        const p = w.player;
        const l = p.gear[cmd.slot]?.dongAn?.[cmd.i];
        if (!l) return { ok: false, error: "khong_thay_dong" };
        if (l.lo !== "het") return { ok: false, error: "an_chua_lo" };
        const lk = p.luyenKhi;
        if (lk.linhVanThach < TAY_AN_LVT) return { ok: false, error: "khong_du_linh_van_thach" };
        lk.linhVanThach -= TAY_AN_LVT;
        const others = DONG_AN_HU.filter((h) => h !== l.hu);
        l.hu = others[Math.floor(Math.random() * others.length)];
        const pair = `${l.dk}|${l.hu}`;
        if (!lk.anVanLo.includes(pair)) lk.anVanLo.push(pair);
        return { ok: true, message: `Hiệu ứng mới: ${DONG_AN_TEXT[l.hu]}` };
      }
      case "dat_vien": {
        const p = w.player;
        const i = p.bag.findIndex((x) => x.uid === cmd.uid && x.boardPiece);
        if (i < 0) return { ok: false, error: "khong_thay_mon" };
        const it = p.bag[i];
        const piece = it.boardPiece!;
        let cell: ReturnType<typeof boardCell>;
        try {
          cell = boardCell(cmd.cell);
        } catch {
          return { ok: false, error: "khong_thay_o" };
        }
        if (!boardCellOpen(cmd.cell, progressOf(this.me.level))) return { ok: false, error: "o_chua_mo" };
        if (!cell.chi_nhan.includes(piece.loai)) return { ok: false, error: "o_khong_nhan" };
        const old = p.board[cmd.cell];
        // Viên cũ về túi cần một ô trống khi chưa có chồng cùng loại và viên mới không làm trống ô nào.
        if (old && !this.pieceStack(old) && it.count > 1 && this.bagFull()) return { ok: false, error: "tui_day" };
        if (it.count > 1) it.count--;
        else p.bag.splice(i, 1);
        if (old) this.pieceToBag(old);
        p.board[cmd.cell] = piece;
        return { ok: true, message: old ? `Đặt ${pieceLabel(piece)} vào ô ${cmd.cell}, ${pieceLabel(old)} về túi` : `Đặt ${pieceLabel(piece)} vào ô ${cmd.cell}` };
      }
      case "go_vien": {
        const p = w.player;
        const piece = p.board[cmd.cell];
        if (!piece) return { ok: false, error: "khong_thay_mon" };
        if (!this.pieceStack(piece) && this.bagFull()) return { ok: false, error: "tui_day" };
        delete p.board[cmd.cell];
        this.pieceToBag(piece);
        return { ok: true, message: `${pieceLabel(piece)} về túi` };
      }
      case "cuoi_thu": {
        const p = w.player;
        const id = p.mounts[cmd.index];
        if (!id) return { ok: false, error: "khong_thay_mon" };
        p.riding = cmd.index;
        return { ok: true, message: `Đang cưỡi ${THU_CUOI.find((t) => t.id === id)?.name ?? "thú"}` };
      }
      case "mang_vao_tran": {
        const r = rule({ type: "mang_vao_tran", actor: PLAYER, techniqueIds: cmd.techniqueIds });
        return r.ok ? { ok: true, message: `Mang ${cmd.techniqueIds.length}/${RULES.loadoutSize} công pháp vào trận` } : r;
      }
      case "cho_xuat_su": {
        const r = rule({ type: "cho_xuat_su", actor: PLAYER, memberId: cmd.memberId });
        return r.ok ? { ok: true, message: `${w.names[cmd.memberId]} đã xuất sư` } : r;
      }
      case "thu_mo": {
        // Sprint 5 chuyển vào @ktlp/rules (mỏ tính lười 20 × cấp^1,15 mỗi giờ).
        const got = { linhThach: 0, quang: 0, duoc: 0 };
        for (const h of w.held) {
          if (h.level <= 0) continue;
          const hours = Math.min(MINE_CAP_HOURS, (now - h.uncollectedSince) / H);
          const amount = Math.floor(minePerHour(h.level) * hours);
          if (h.type === "mo_linh_thach") got.linhThach += amount;
          if (h.type === "mo_quang") got.quang += amount;
          if (h.type === "mo_duoc") got.duoc += amount;
          h.uncollectedSince = now;
        }
        w.sect.vault.linhThach += got.linhThach;
        w.sect.vault.quang += got.quang;
        w.sect.vault.duoc += got.duoc;
        return { ok: true, message: `Bảo Khố +${fmt(got.linhThach)} linh thạch, +${fmt(got.quang)} quặng, +${fmt(got.duoc)} dược` };
      }
      case "hien_te": {
        // Hiến tế: 50 XP tông môn mỗi linh thạch (GDD mục 12); Sprint 5 chuyển vào @ktlp/rules.
        const amount = Math.floor(cmd.amount);
        if (amount <= 0 || amount > w.player.linhThach) return { ok: false, error: "khong_du_linh_thach" };
        w.player.linhThach -= amount;
        w.sect.xp += amount * KT.xpPerStone;
        this.me.contribution += Math.floor(amount / DONATE_CONTRIBUTION_DIV);
        let up = 0;
        while (this.sect.level < KT.maxSectLevel && w.sect.xp >= sectRow(this.sect.level).xpToNext) {
          w.sect.xp -= sectRow(this.sect.level).xpToNext;
          this.sect.level++;
          up++;
        }
        return { ok: true, message: `+${fmt(amount * KT.xpPerStone)} XP tông môn${up ? `, lên cấp ${this.sect.level}` : ""}` };
      }
      case "duyet_don": {
        if (!atLeast(this.me.role, "truong_lao")) return { ok: false, error: "khong_du_quyen" };
        const a = w.applicants.find((x) => x.id === cmd.applicantId);
        if (!a) return { ok: false, error: "khong_co_thanh_vien" };
        w.applicants = w.applicants.filter((x) => x !== a);
        if (cmd.accept) {
          // Lệnh gia nhập có ở Sprint 5; tạm thêm thẳng vào trạng thái của rules.
          w.rules.members[a.id] = { id: a.id, level: a.level, sectId: SECT, role: "ngoai_mon", contribution: 0, bag: [], learned: [], loadout: [] };
          w.names[a.id] = a.name;
          w.online[a.id] = true;
        }
        return { ok: true, message: cmd.accept ? `${a.name} vào ngoại môn` : `Đã từ chối ${a.name}` };
      }
      case "chat": {
        const text = filterWords(cmd.text.trim()).slice(0, 200);
        if (!text) return { ok: false, error: "lenh_khong_hop_le" };
        w.chat.push({ id: w.nextChat++, from: `${w.sect.name} · ${w.player.name}`, text, at: now });
        return { ok: true };
      }
      case "bao_cao": {
        const c = w.chat.find((x) => x.id === cmd.chatId);
        if (c) c.reported = true;
        return { ok: true, message: "Đã gửi báo cáo cho quản trị" };
      }
      case "xin_vao_lien_minh":
        return this.sect.level >= KT.allianceJoinLevel ? { ok: true, message: "Đã gửi đơn, chờ minh chủ duyệt" } : { ok: false, error: "chua_du_cap" };
      case "dev_chuc_vi":
        this.me.role = cmd.role;
        return { ok: true };
      case "dev_mo_hinh":
        w.sect.model = cmd.model;
        return { ok: true, message: `Mô hình ${cmd.model.name}` };
      case "dev_lien_minh":
        w.alliance.joined = cmd.joined;
        return { ok: true };
    }
  }
}

const ELEMENT_LABEL: Record<Element, string> = {
  kim: "Kim", moc: "Mộc", thuy: "Thủy", hoa: "Hỏa", tho: "Thổ", loi: "Lôi", phong: "Phong",
  cuc_duong: "Cực dương", cuc_am: "Cực âm", cuc_han: "Cực hàn", quang: "Quang", am_lanh: "Âm lãnh",
};

function toAllianceSect(s: World["sects"][number]) {
  return { id: s.id, name: s.name, level: s.level, faction: s.faction, points: s.points.length, online: s.online, color: s.color };
}

/** Lọc từ trong chat (G1); danh sách thật do vận hành giữ, đây chỉ là mẫu. */
const BANNED = ["ngu", "chết đi", "lừa đảo"];
export function filterWords(text: string): string {
  let out = text;
  for (const b of BANNED) out = out.replace(new RegExp(`(^|\\s)${b}(?=\\s|$|[.,!?])`, "giu"), (_m, pre: string) => pre + "*".repeat(b.length));
  return out;
}

export function fmt(n: number): string {
  return Math.round(n).toLocaleString("vi-VN");
}

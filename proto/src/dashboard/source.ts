// Lệnh đọc gộp của dashboard (GDD mục 14, Kỹ thuật): mỗi màn tải bằng một lệnh trả đủ các thẻ.
// Bản đầu là MockDashboardSource dựng trạng thái mẫu bằng chính lệnh của @ktlp/rules; Sprint 5 thay bằng
// server giả trong Web Worker với cùng các hàm này, nên các màn không phải sửa.
import type { BattleInput, Element, SkillType } from "@ktlp/sim";
import type { Role, RuleError } from "@ktlp/rules";
import type { LocationId, SectModel } from "./art/sectScene.ts";

/** Mốc giờ server (ms) gửi kèm mọi lệnh đọc; đồng hồ đếm ngược ở client tự đếm từ mốc này. */
export interface Stamped {
  serverNow: number;
}

/** Thanh trên, có trong mọi lệnh đọc gộp. */
export interface TopBarView {
  name: string;
  /** Khoá hình chân dung trong manifest PixelLab. */
  portrait: string;
  level: number;
  realm: string; // cảnh giới, Hạ vị suy từ cấp (GDD mục 7)
  linhThach: number; // linh thạch đúng phẩm vị diện
  tienNgoc: number;
  satNghiep: number; // chỉ hiện khi lớn hơn 0
  /** Phút chơi còn lại trong ngày, chỉ có với người dưới 18 tuổi (G1). */
  playMinutesLeft?: number;
  ageLabel: string; // nhãn phân loại độ tuổi G1, luôn ở góc
}

export type PointType =
  | "thanh_chu" | "deo" | "ben_do" | "cua_bi_canh" | "mo_linh_thach" | "linh_tuyen"
  | "son_mon" | "mo_quang" | "mo_duoc" | "hang_di_thu"
  /** Chỉ có trong Linh Hải Cấm Khu. */
  | "hang_thu_hoang";

/** Chủ của một điểm trên bản đồ mini, từ bảng chủ điểm (GDD mục 16). */
export type Owner = "minh" | "dong_minh" | "dich" | "npc";

export interface MiniMapMark {
  pointId: number;
  owner: Owner;
  /** Điểm đang bị đánh thì nhấp nháy. */
  attacked?: boolean;
}

/** Dữ liệu động của bản đồ mini; phần tĩnh (điểm, chặng) vẽ từ data/maps/ha_diem_<mã vùng>.json. */
export interface MiniMapView {
  region: string; // mã vùng, ví dụ loi_dinh_coc
  marks: MiniMapMark[];
  sonMon: number; // id điểm sơn môn của tông mình
  /** Vị trí của mình hoặc đoàn đang đi: điểm đi, điểm tới và tỉ lệ đã đi (0–1). */
  self: { from: number; to: number; progress: number };
  /** Cửa bí cảnh đang mở. */
  openGates: number[];
  /** Id các điểm đã mở sương; ngoài tập này là sương mù. */
  revealed: number[];
  /** Thu khung về lãnh thổ: tông môn hoặc liên minh; không có thì cả vùng. */
  focus?: number[];
  /**
   * Sự kiện đang diễn ra trên vùng: điểm của nó nhấp nháy đỏ trên bản đồ mini và bản đồ tranh, khung mini viền đỏ nhấp
   * nháy; hết giờ thì không còn trong danh sách. Chiến tranh địa bàn (GDD mục 10): điểm của mình và của tông địch.
   * Yêu Triều (GDD mục 17): yêu thú tràn từ Hư Không Hải vào vùng biên, các hang dị thú sát rìa ngoài.
   */
  alerts: { kind: "chien_tranh" | "yeu_trieu"; title: string; endsAt: number; points: number[] }[];
}

/** Một việc đang chạy, kèm mốc kết thúc theo giờ server. */
export interface RunningJob {
  kind: "hanh_trinh" | "xay" | "ren" | "luyen_dan" | "be_quan";
  title: string;
  detail: string;
  endsAt: number;
  /** Màn mở khi chạm vào việc này. */
  go: Go;
}

export interface CalendarEntry {
  title: string;
  startsAt: number;
  endsAt: number;
  go: Go;
}

/** Nơi một thẻ dẫn tới: màn, tab con, hay điểm trên bản đồ. Mỗi đích cách màn chính tối đa 1 lần chạm nữa. */
export type Go =
  | { screen: "dong-phu" }
  | { screen: "nhan-vat"; tab?: "thong-tin" | "phap-tuong" | "tui" }
  | { screen: "ban-do"; pointId?: number; at?: { x: number; y: number } }
  | { screen: "tong-mon"; tab?: "tong-quan" | "son-mon" | "thanh-vien" | "chien-su" }
  | { screen: "cong-phap"; section?: "mang" | "truyen-thu" | "tui" | "tang-kinh" }
  | { screen: "lien-minh" }
  | { screen: "thanh-chu" }
  | { screen: "tran"; battleId: number };

export interface TodoCard {
  id: string;
  title: string;
  detail: string;
  go: Go;
}

export interface BattleReport {
  id: number;
  title: string; // ví dụ "Thủ mỏ linh thạch #19"
  result: "thang" | "thua" | "hoa";
  at: number;
  detail: string;
}

export interface DongPhuView extends Stamped {
  top: TopBarView;
  running: RunningJob[];
  calendar: CalendarEntry[];
  todo: TodoCard[]; // tối đa 3, rỗng thì ẩn thẻ
  reports: BattleReport[];
  mail: { id: number; from: string; title: string; unread: boolean }[];
  quests: { id: string; name: string; step: string; go: Go }[];
  miniMap: MiniMapView;
  city: { name: string; pointId: number; facilities: string[] };
}

/** 7 ô trang bị (người dùng chốt 2026-11-03): kiếm, mũ, áo, đai, bao tay, giày, ngọc bội. */
export type GearSlot = "vu_khi" | "mu" | "ao" | "dai" | "bao_tay" | "giay" | "ngoc_boi";
/** Độ hiếm, hiện bằng màu nền ô (người dùng chốt 2026-11-03): lục là đồ shop < lam < tím < vàng < đỏ. */
export type Rarity = "luc" | "lam" | "tim" | "vang" | "do";

export interface Gem {
  element: Element;
  level: number;
}

export interface GearItem {
  slot: GearSlot;
  name: string;
  plus: number; // nấc cường hóa
  durability: number;
  durabilityMax: number;
  sockets: number; // số dòng khảm đã kích hoạt
  gems: Gem[];
  /** Chỉ số gốc của món, cộng 3% mỗi nấc (GDD mục 12). */
  stats: { hp?: number; atk?: number; def?: number; mana?: number };
  /** Khoá hình trong manifest PixelLab, nếu có; dùng khi chưa có hình vẽ `art`. */
  icon?: string;
  /** Hình vẽ Canva (assets/icon_ve/<art>.webp), mã như "trang_bi/ao/26". */
  art?: string;
  /** Độ hiếm thay cho 3 cấp linh, thiên, thần (GDD rev 217). */
  rarity: Rarity;
  /** Mã vật phẩm cố định (ma_vp trong assets/icon_ve/danh_sach.json), ví dụ "TB-AO-026". */
  code?: string;
}

/** Một dòng nguồn của chỉ số; `value` cùng đơn vị với chỉ số. */
export interface StatSource {
  label: string;
  value: number;
}

export interface StatLine {
  id: string;
  label: string;
  value: number;
  unit: "" | "%" | "‰";
  sources: StatSource[];
}

export interface MountView {
  id: string;
  name: string;
  element: Element;
  grade: string;
  realm: string;
  icon: string;
}

/** Loại món trong túi (GDD mục 9, 11, 12). Công pháp đã học không chiếm ô túi, chỉ hiện khi lọc "Công pháp". */
export type ItemKind = "trang_bi" | "cong_phap" | "tan_quyen" | "ngoc" | "dan" | "nguyen_lieu" | "phu" | "trung_thu";
/** Phẩm để lọc túi theo ba phẩm của chợ chung (GDD mục 12); đồ linh, thiên, thần xếp vào hạ, trung, cao. */
export type ItemGrade = "ha" | "trung" | "cao";

export interface BagItem {
  uid: number;
  kind: ItemKind;
  name: string;
  grade: ItemGrade;
  /** Nhãn phẩm riêng của loại món: "Thiên" với đồ, "Cấp 3" với ngọc, phẩm công pháp với tàn quyển. */
  gradeLabel: string;
  count: number;
  element?: Element;
  /** Khoá hình trong manifest PixelLab; không có `art` lẫn `icon` thì vẽ ký hiệu theo loại trên nền màu phẩm. */
  icon?: string;
  /** Hình vẽ Canva (assets/icon_ve/<art>.webp), mã như "ngoc/loi"; món chưa có hình thì để trống. */
  art?: string;
  /** Độ hiếm theo do_hiem của danh sách icon; món không phải trang bị thường không có. */
  rarity?: Rarity;
  /** Mã vật phẩm cố định (ma_vp), ví dụ "NG-KH-006". */
  code?: string;
  /** Một dòng công dụng. */
  detail: string;
  gear?: GearItem;
  technique?: TechniqueCard;
}

export interface NhanVatView extends Stamped {
  top: TopBarView;
  name: string;
  roots: Element[];
  talent: { id: string; name: string; combat: string };
  level: number;
  exp: number;
  expToNext: number;
  sect: { name: string; role: Role | null; faction: string };
  satNghiep: number;
  contribution: number;
  /** Tu luyện ở Hạ vị: kinh nghiệm mỗi giờ bế quan và nguồn, mốc đột phá cảnh giới kế (GDD mục 7; số đề xuất). */
  cultivation: {
    perHour: number;
    sources: StatSource[];
    breakAt: { level: number; realm: string };
    /** Đủ kinh nghiệm ở cấp cuối cảnh giới: nút lớn đổi thành Đột phá. */
    canBreak: boolean;
    retreat?: { title: string; endsAt: number };
  };
  /** 4 ô công pháp mang vào trận và công pháp đã học (để kéo vào ô). */
  loadout: (TechniqueCard | null)[];
  learned: TechniqueCard[];
  bag: { capacity: number; items: BagItem[] };
  /** Ô của thú đang cưỡi trong `mounts`. */
  riding: number;
  /** Lực chiến chia theo nguồn; đồ và thú có trần (GDD mục 13 và 6). */
  power: { total: number; parts: { id: "co_ban" | "do" | "thu"; label: string; value: number; cap?: number }[] };
  gear: Partial<Record<GearSlot, GearItem>>;
  /** Bốn chỉ số chính, đúng các trường của UnitSpec trong @ktlp/sim. */
  main: StatLine[];
  stats: StatLine[];
  mounts: (MountView | null)[]; // 5 ô
  combos: { name: string; effect: string; active: boolean }[];
  /** Hình nhân vật ghép: thân, áo và đồ (khoá manifest). */
  look: { body: string; outfit: string; idle: string; hat?: string; weapon?: string };
}

export interface TerritoryPoint {
  pointId: number;
  type: PointType;
  level: number; // cấp mỏ; linh tuyền, đèo, bến đò là 0
  perHour: number;
  uncollectedSince: number;
  attacked?: { by: string; endsAt: number };
}

export interface Building {
  id: LocationId;
  name: string;
  level: number; // 0 = chưa xây
  /** Đang nâng cấp tới cấp kế, kết thúc lúc nào. */
  upgradingUntil?: number;
  /** Chưa xây được thì vì sao (ví dụ "Mở ở cấp 200"). */
  locked?: string;
}

export interface SectMember {
  id: string;
  name: string;
  role: Role;
  level: number;
  online: boolean;
  npc: boolean;
}

export interface WarEntry {
  id: number;
  with: string;
  direction: "di" | "den"; // mình tuyên chiến hay bị tuyên chiến
  startsAt: number;
}

export interface TongMonView extends Stamped {
  top: TopBarView;
  viewerRole: Role | null;
  sect: {
    name: string;
    level: number;
    xp: number;
    xpToNext: number;
    region: string;
    regionName: string;
    terrain: string;
    faction: string;
    shieldUntil?: number;
    patron?: string;
    island: string; // khoá hình đảo tông môn
    /** Mô hình tông môn (đảo PixelLab) và mã địa thế, để vẽ hình nền từng công trình. */
    model: SectModel;
    terrainId: string;
  };
  territory: { held: TerritoryPoint[]; max: number; range: number; perHour: { linhThach: number; quang: number; duoc: number } };
  vault: { linhThach: number; upkeepPerDay: number; daysLeft: number; parts: StatSource[] };
  wars: WarEntry[];
  members: SectMember[];
  memberMax: number;
  applicants: { id: string; name: string; level: number }[];
  buildings: Building[];
  miniMap: MiniMapView;
  /** Nút mà chức vị của người xem được bấm (GDD mục 6). */
  can: { hienTe: boolean; duyet: boolean; tuyenChien: boolean; xuatSu: boolean; xay: boolean };
  donateXpPerStone: number;
}

export interface TechniqueCard {
  id: number;
  name: string;
  grade: number;
  gradeName: string;
  element: Element;
  subElements: Element[];
  type: SkillType;
  layer?: number;
  frozen?: boolean;
  /** Mô tả ngắn từ chỉ số trận: sát thương, số mục tiêu, hồi chiêu. */
  summary: string;
}

export interface ScrollCard {
  uid: number;
  kind: string;
  name: string;
  element: Element;
  type: SkillType;
  grade: number;
  gradeName: string;
  contribution: number; // cống hiến nếu nộp
}

export interface CongPhapView extends Stamped {
  top: TopBarView;
  viewerRole: Role | null;
  loadout: (TechniqueCard | null)[]; // 4 ô
  learned: TechniqueCard[];
  transmission: (TechniqueCard & { learned: boolean; blocked?: string })[];
  transmissionSlots: number;
  bag: ScrollCard[];
  library: ScrollCard[];
  sectTechniques: TechniqueCard[];
  contribution: number;
  can: { ghep: boolean; truyenThu: boolean };
  maxSubs: number;
}

export interface AllianceSect {
  id: string;
  name: string;
  level: number;
  faction: string;
  points: number;
  online: number;
  color: string;
}

export interface ChatLine {
  id: number;
  from: string;
  text: string;
  at: number;
  reported?: boolean;
}

export interface LienMinhView extends Stamped {
  top: TopBarView;
  viewerRole: Role | null;
  sectLevel: number;
  alliance: null | {
    name: string;
    leader: string;
    sects: AllianceSect[];
    warDays: string;
    warHours: string;
    wars: { with: string; startsAt: number }[];
    helpRequests: { from: string; point: string; at: number }[];
    boss: { name: string; days: string; hpPercent: number };
    chat: ChatLine[];
    miniMap: MiniMapView;
  };
  /** Khi chưa có liên minh: các liên minh cùng vị diện và lời mời. */
  list: { id: string; name: string; sects: number; level: number; invited: boolean }[];
  joinLevel: number;
  createLevel: number;
  can: { lienMinh: boolean };
}

/** Chủ và số liệu một điểm, cho thẻ điểm trên bản đồ tranh. */
export interface PointOwner {
  owner: Owner;
  name: string;
  level?: number; // cấp mỏ
  perHour?: number;
  attacked?: { by: string; endsAt: number };
}

export interface BanDoView extends Stamped {
  top: TopBarView;
  viewerRole: Role | null;
  map: MiniMapView;
  /** Khoá hình đảo của tông mình (sơn môn trên bản đồ). */
  sectIsland: string;
  owners: Record<number, PointOwner>;
  /** Điểm trong tầm Truyền Tống Trận của tông mình: chỉ chiếm được các điểm này (GDD mục 5). */
  inRange: number[];
  held: number;
  maxHeld: number;
  can: { chiem: boolean; tuyenChien: boolean };
}

export type DashboardCommand =
  | { type: "thu_mo" }
  | { type: "hien_te"; amount: number }
  | { type: "duyet_don"; applicantId: string; accept: boolean }
  | { type: "cho_xuat_su"; memberId: string }
  | { type: "nop_tan_quyen"; scrollUid: number }
  | { type: "ghep_cong_phap"; main: number; subs: number[] }
  | { type: "dat_bo_truyen_thu"; techniqueIds: number[] }
  | { type: "hoc_cong_phap"; techniqueId: number }
  | { type: "mang_vao_tran"; techniqueIds: number[] }
  /** Mặc một món trang bị trong túi; món đang ở ô đó về túi. */
  | { type: "mac_do"; uid: number }
  /** Tháo món ở một ô về túi; túi đầy thì không tháo được. */
  | { type: "thao_do"; slot: GearSlot }
  /** Chọn thú cưỡi trong 5 ô thú (GDD mục 6). */
  | { type: "cuoi_thu"; index: number }
  | { type: "chat"; text: string }
  | { type: "bao_cao"; chatId: number }
  | { type: "xin_vao_lien_minh"; allianceId: string }
  /** Chỉ prototype: xem dashboard dưới chức vị khác để kiểm nút theo quyền. */
  | { type: "dev_chuc_vi"; role: Role }
  /** Chỉ prototype: bật tắt việc tông môn đã vào liên minh. */
  | { type: "dev_lien_minh"; joined: boolean }
  /** Chỉ prototype: đổi mô hình tông môn để xem hình nền các công trình. */
  | { type: "dev_mo_hinh"; model: SectModel };

export type CommandResult = { ok: true; message?: string } | { ok: false; error: RuleError | "chua_co_trong_proto" | string };

export interface DashboardSource {
  dongPhu(): Promise<DongPhuView>;
  nhanVat(): Promise<NhanVatView>;
  tongMon(): Promise<TongMonView>;
  congPhap(): Promise<CongPhapView>;
  lienMinh(): Promise<LienMinhView>;
  banDo(): Promise<BanDoView>;
  /** Thư đầy đủ, mở từ thẻ Tin báo; đánh dấu đã đọc. */
  mail(id: number): Promise<{ from: string; title: string; body: string } | undefined>;
  /** Đầu vào trận của một chiến báo để màn Trận phát lại (nhật ký lệnh, GDD mục 16). */
  battle(id: number): Promise<{ label: string; input: BattleInput; arena?: string } | undefined>;
  send(cmd: DashboardCommand): Promise<CommandResult>;
}

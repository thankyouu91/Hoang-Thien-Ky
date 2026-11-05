// Lệnh đọc gộp của dashboard (GDD mục 14, Kỹ thuật): mỗi màn tải bằng một lệnh trả đủ các thẻ.
// Bản đầu là MockDashboardSource dựng trạng thái mẫu bằng chính lệnh của @ktlp/rules; Sprint 5 thay bằng
// server giả trong Web Worker với cùng các hàm này, nên các màn không phải sửa.
import type { BattleInput, Element, SkillType } from "@ktlp/sim";
import type { Bac, BoardPiece, Progress, Role, RuleError } from "@ktlp/rules";
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
  /** Tu vi đã có trong cấp hiện tại và tu vi cần để lên cấp kế (vòng quanh chân dung). */
  exp: number;
  expToNext: number;
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
  /**
   * Vị trí của mình hoặc đoàn đang đi: điểm đi, điểm tới và tỉ lệ đã đi (0–1) của đoạn hiện tại; đã tới nơi thì from = to.
   * `region`: vùng (hay khu đặc biệt) của đoạn đó khi khác `region` của bản đồ. `startsAt`, `endsAt`: giờ đi và giờ tới của
   * đoạn, để màn tự chạy dấu theo đồng hồ; hết đoạn thì đọc lại. `dest`: điểm tới cuối chuyến khi đang đi.
   */
  self: {
    from: number;
    to: number;
    progress: number;
    region?: string;
    startsAt?: number;
    endsAt?: number;
    dest?: { region: string; pointId: number; name: string; endsAt: number; stages: number };
  };
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
  | { screen: "tran"; battleId: number }
  /** Nhiệm vụ nhập môn của người mới: mở đúng việc của bước đang làm (moi/ftueUi.ts); bản mẫu không dùng. */
  | { screen: "nhiem-vu"; id?: string };

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
  /** Ấn bộ khảm trên món (ma_vp NG-AN-…): món còn độ bền thì tính một món cho bộ của ấn. */
  seal?: string;
  /** Bậc ấn bộ (set đồ 2.0, set.json bac_an); không ghi là tím. Mốc 2, 4 của bộ nhân theo bậc thấp nhất, mốc 7 cần cả 7 ấn từ tím. */
  sealTier?: Bac;
  /** Binh ấn (NG-BA-…, chỉ vũ khí, bao tay, ngọc bội) và bậc; chiếm một dòng khảm như ấn bộ. */
  binhAn?: { ma: string; tier: Bac };
  /**
   * Dòng ẩn của ngọc bội, đai (số dòng theo độ hiếm, trang_bi.json luat.dongAn.soDong). Mã và chữ chỉ có khi đã lộ: điều
   * kiện lộ sau Giám Định Phù hoặc lần kích phát đầu, hiệu ứng lộ sau lần kích phát đầu. `songAn`: ngọc bội và đai có cùng
   * điều kiện đã lộ, cả hai hiệu ứng ×1,25.
   */
  hiddenLines?: HiddenLineView[];
  /** Dòng rèn đã mở (mỗi mốc +10, +20, +30 ở Hạ vị); `on` false khi nấc tụt dưới mốc. */
  forgeLines?: ForgeLineView[];
  /** Điểm trang bị của riêng món (diemTrangBi của @ktlp/rules, không tính set); nguồn điền cho đồ đang mặc và đồ trong túi. */
  score?: number;
  /** Số dòng khảm tối đa (theo độ hiếm, đồ bí cảnh thêm); ngọc, ấn bộ, binh ấn mỗi viên một dòng. Màn dùng để báo hết dòng khi kéo. */
  lines?: number;
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

/** Một dòng ẩn trên ngọc bội hoặc đai (xem GearItem.hiddenLines). */
export interface HiddenLineView {
  /** Mã điều kiện DN-DK-… và chữ; null khi chưa lộ (hiện ???). */
  dk: string | null;
  dkText?: string;
  /** Mã hiệu ứng DN-HU-… và chữ; null tới lần kích phát đầu. */
  hu: string | null;
  huText?: string;
  songAn?: boolean;
}

/** Một dòng rèn: loại chỉ số phụ đã chọn ở mốc `at`, giá trị như dòng chỉ số (`unit` "" là cộng thẳng, "‰" là phần nghìn). */
export interface ForgeLineView {
  at: number;
  stat: string;
  label: string;
  value: number;
  unit: "" | "‰";
  on: boolean;
}

/** Một mốc của bộ: `lock` cho biết vì sao mốc đã đủ món mà chưa có tác dụng (bậc ấn dưới tím ở mốc 7, ràng buộc của bộ). */
export interface SetMilestone {
  at: number;
  on: boolean;
  text: string;
  lock?: "bac" | "dieu_kien";
}

/** Một bộ đang có món trên người (set đồ 2.0, GDD tab Trang bị phần 14). */
export interface SetView {
  id: string;
  name: string;
  /** Số món đang tính: đồ còn độ bền và món thêm từ Đạo Cơ Bàn. */
  pieces: number;
  /** Bậc thấp nhất trong các ấn đang tính. */
  tier: Bac;
  /** Hệ số mốc 2 (bậc × hợp bộ hoặc cộng hưởng × bị khắc) và mốc 4 (bậc), phần nghìn; chữ trong `milestones` là số ở bậc tím. */
  factor: number;
  factor4: number;
  /** Lộ sức mạnh (ngoai_cong, thu_noi, …). */
  lo: string[];
  /**
   * Quan hệ đang nhân vào mốc 2: `hop` là hợp bộ với `with` (`quanHe`: thuan, tuong_sinh, tuong_hop, doi_cuc), `ban` là cộng
   * hưởng trên Đạo Cơ Bàn mạnh hơn hợp bộ, `khac` là bị bộ `with` khắc (×0,8).
   */
  relations: { with: string; kind: "hop" | "ban" | "khac"; quanHe?: string }[];
  milestones: SetMilestone[];
}

/** Binh bộ trên 3 ô công (mỗi người 1 binh bộ). */
export interface BinhBoView {
  id: string;
  name: string;
  pieces: number;
  tier: Bac;
  lo: string[];
  /** Cùng lộ với một bộ đang kích: mốc 3 ×1,2. */
  dongLo: boolean;
  milestones: SetMilestone[];
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
  /** Viên đặt được lên Đạo Cơ Bàn: ấn bộ hoặc ngọc hệ (lệnh dat_vien). */
  boardPiece?: BoardPiece;
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
  /**
   * Đạo Cơ Bàn (GDD tab Trang bị, phần 8): viên đang đặt theo mã ô của dao_co_ban.json; số món mỗi bộ (id trong set.json)
   * trên đồ đang mặc còn độ bền; tiến độ nhân vật để biết ô nào mở (boardCellOpen). Món thêm, ô thông và cộng hưởng tính
   * bằng boardBonus của @ktlp/rules.
   */
  board: { cells: Record<string, BoardPiece>; gearSets: Record<string, number>; progress: Progress };
  /** Luyện khí sau cấp tối đa (GDD tab Trang bị phần 13; đặc tả luyen-khi.md, số đề xuất). Mở theo board.progress. */
  luyenKhi: LuyenKhiView;
  /** Các bộ có món trên người, bộ đang kích trước (set đồ 2.0); bộ 1 món có mọi mốc tắt. */
  sets: SetView[];
  /** Binh bộ của binh ấn trên ô công, nếu có món nào mang binh ấn. */
  binhBo?: BinhBoView;
  /** Điểm trang bị của nhân vật: 7 món cộng set, binh bộ, dòng ẩn tĩnh (diemTrangBi). */
  score: number;
}

/** Một ô đồ đang mặc ở Luyện khí. */
export interface LuyenKhiSlot {
  /** Loại chỉ số phụ đang có (0–3, loại 0 là mặc định của ô). */
  sub: number;
  /** Khí linh 0–9 (đồ từ tím), kinh nghiệm trong cấp hiện tại. */
  kl: { cap: number; exp: number };
  /** Khí văn theo ô mở ở khí linh 3, 6, 9; null là ô đã mở mà chưa chọn. */
  van: (string | null)[];
  /** 3 khí văn đang chờ chọn cho ô `offerAt` (lệnh chon_khi_van; tay_van quay lại). */
  offer?: string[];
  offerAt?: number;
}

export interface LuyenKhiView {
  /** Tổng Khí Tinh; `khiTinhKhoa` là phần khóa vào nhân vật (từ đồ vàng, đỏ, đồ có khí linh), tiêu trước. */
  khiTinh: number;
  khiTinhKhoa: number;
  linhVanThach: number;
  /** Thiên Ngoại Vẫn Thiết (luyện danh khí). */
  vanThiet: number;
  slots: Partial<Record<GearSlot, LuyenKhiSlot>>;
  /** Kho ngọc cấp cao (từ cấp 7 hợp song hệ, từ cấp 10 điểm hóa Phách); `he2` có nghĩa là viên song hệ. */
  gems: { id: string; he: Element; he2?: Element; cap: number; n: number }[];
  /** Ngọc Phách đã có, theo hệ. */
  phach: Element[];
  /** Mã kiểu từng sở hữu (sổ Bảo Giám), kể cả món đã phân giải. */
  owned: string[];
  /** Đồ phổ danh khí đang có (NL-DP-…). */
  doPho: string[];
  /** Cặp dòng ẩn đã lộ cả hai (sau lần kích phát đầu), dạng "DN-DK-001|DN-HU-004"; trang Ẩn văn của Bảo Giám đếm các cặp này. */
  anVanLo: string[];
  /** Trang tuần của Bảo Giám. */
  week: { text: string; have: number; need: number; thuong: string; endsAt: number };
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
  /**
   * Hình vẽ Canva (assets/icon_ve, mở bằng artUrl): bộ ba quyển theo chủ hệ, cặp ghép hai hệ, hay quyển thuần hệ; hình chưa
   * vẽ thì là quyển thuần hệ của chủ hệ. Loại chiêu có hình riêng ở chieu/<loại>.
   */
  art?: string;
  /** Chỉ công pháp đã học: bảng tầng và giá lên tầng kế (tangCongPhap.ts, số ở tang_cong_phap.json). */
  tang?: TangCongPhapView;
}

/** Một tầng của công pháp: chỉ số trận ở tầng đó và giá lên tới tầng đó (GDD mục 6; số đề xuất 2026-11-05). */
export interface TangCongPhapRow {
  tang: number;
  /** Phần nghìn cộng dồn so với tầng 1: uy lực cộng, hồi chiêu và mana giảm. */
  uyLuc: number;
  hoiChieu: number;
  mana: number;
  /** Chỉ số trận ở tầng này: D (đã chia 1000), hồi chiêu giây, mana. */
  damage: number;
  cooldownS: number;
  manaCost: number;
  /** Giá lên tới tầng này từ tầng ngay dưới. */
  diemLuyen: number;
  congHien: number;
}

export interface TangCongPhapView {
  rows: TangCongPhapRow[];
  /** Tầng kế và lý do chưa lên được (thiếu điểm, thiếu cống hiến, đang dừng tầng); không có là đã đủ 10 tầng. */
  next?: { tang: number; diemLuyen: number; congHien: number; thieu?: string };
}

/** Điểm luyện công pháp của nhân vật và phần cộng mỗi lần lên cấp. */
export interface DiemLuyenView {
  /** Quỹ chung cho mọi công pháp đã học. */
  co: number;
  moiCap: number;
  level: number;
  /** Tu vi đang có và cần để lên cấp kế; `dotPha` là đang ở cấp cuối cảnh giới, phải đột phá. */
  exp: number;
  expNext: number;
  dotPha: boolean;
  /** Nhân vật mỗi cấp (UNIT_CURVE): máu, công, thủ. */
  moiCapChiSo: { hp: number; atk: number; def: number };
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
  /** Điểm luyện công pháp (lên tầng) và điểm cộng khi lên cấp; nguồn chưa có thì màn ẩn phần này. */
  diemLuyen?: DiemLuyenView;
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
  /**
   * Sơn môn có chủ ở các vùng khác, theo mã vùng rồi id điểm (vùng mình xem owners). Chỗ sơn môn còn trống không có ở đây
   * và không hiện trên bản đồ (GDD mục 3: lập tông thì đặt ngẫu nhiên vào một chỗ còn trống).
   */
  sectSites: Record<string, Record<number, PointOwner>>;
  /** Điểm trong tầm Truyền Tống Trận của tông mình: chỉ chiếm được các điểm này (GDD mục 5). */
  inRange: number[];
  held: number;
  maxHeld: number;
  can: { chiem: boolean; tuyenChien: boolean };
}

/** Bế quan chọn được 1 hoặc 8 giờ (đề xuất, cùng mốc với bản người mới moi/ftue.ts). */
export const RETREAT_HOURS = [1, 8];

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
  /** Lên một tầng cho công pháp đã học: tốn điểm luyện và cống hiến theo tang_cong_phap.json (lệnh rules len_tang_cong_phap). */
  | { type: "len_tang_cong_phap"; techniqueId: number }
  /** Mặc một món trang bị trong túi; món đang ở ô đó về túi. */
  | { type: "mac_do"; uid: number }
  /** Tháo món ở một ô về túi; túi đầy thì không tháo được. */
  | { type: "thao_do"; slot: GearSlot }
  /**
   * Đặt một viên trong túi (món có boardPiece) vào ô Đạo Cơ Bàn; ô đã có viên thì viên cũ về túi. Ô phải mở và nhận loại
   * viên đó (chi_nhan); tương khắc không chặn, chỉ làm đứt mạch.
   */
  | { type: "dat_vien"; cell: string; uid: number }
  /** Gỡ viên ở một ô Đạo Cơ Bàn về túi. */
  | { type: "go_vien"; cell: string }
  /** Đột phá sang cảnh giới kế khi ở cấp cuối cảnh giới và đủ tu vi (cultivation.canBreak). */
  | { type: "dot_pha" }
  /** Chỉ prototype: thêm tu vi cho đủ lên `levels` cấp (dừng ở mốc đột phá) để xem hiệu ứng lên cấp. */
  | { type: "dev_len_cap"; levels: number }
  /** Phân giải đồ trong túi (từ lam) ra Khí Tinh; ngọc, ấn khảm trên món về túi. */
  | { type: "phan_giai"; uids: number[] }
  /** Tẩy luyện chỉ số phụ của ô (Khí Tinh và linh thạch theo độ hiếm món): quay trong 3 loại còn lại; Tu rèn chọn thẳng `loai`. */
  | { type: "tay_luyen"; slot: GearSlot; loai?: number }
  /** Nạp Khí Tinh cho khí linh của ô (10 kinh nghiệm mỗi viên); qua cấp 3, 6, 9 thì mở ô khí văn và có 3 lựa chọn chờ. */
  | { type: "nap_khi_linh"; slot: GearSlot; khiTinh: number }
  /** Chọn 1 trong 3 khí văn đang chờ cho ô khí văn `o`. */
  | { type: "chon_khi_van"; slot: GearSlot; o: number; ma: string }
  /** Tẩy văn: quay lại 3 lựa chọn cho ô khí văn `o` (1 Linh Văn Thạch). */
  | { type: "tay_van"; slot: GearSlot; o: number }
  /**
   * Hợp hai viên cùng cấp (từ 7), hai hệ tương sinh, thành ngọc song hệ; tỷ lệ đậu cố định. Không đậu thì mất viên b,
   * giữ viên a; `phu` dùng một Phù bảo ngọc trong túi để giữ cả hai.
   */
  | { type: "hop_song_he"; a: string; b: string; phu?: boolean }
  /** Điểm hóa ngọc cấp 10 thành Phách (20 Khí Tinh); không đậu mất Khí Tinh, giữ ngọc. */
  | { type: "diem_hoa_phach"; gem: string }
  /** Khai lò danh khí ở Luyện Khí Các: `nguoi` là 4 thành viên (chủ lò Tu rèn trước, rồi 3 hộ lô). */
  | { type: "khai_lo_danh_khi"; ma: string; nguoi: string[] }
  /** Ghép 3 ấn bộ cùng bộ cùng bậc trong chồng túi `uid` thành 1 ấn bậc trên (chỉ lục lên lam, lam lên tím). */
  | { type: "ghep_an"; uid: number }
  /** Dùng 1 Giám Định Phù lộ điều kiện dòng ẩn `i` của ô (ngọc bội, đai); bỏ `i` là dòng đầu chưa lộ. */
  | { type: "giam_dinh"; slot: GearSlot; i?: number }
  /** Tẩy ẩn: quay lại hiệu ứng dòng ẩn `i` đã lộ, giữ điều kiện (3 Linh Văn Thạch); hiệu ứng mới hiện ngay. */
  | { type: "tay_an"; slot: GearSlot; i: number }
  /**
   * Đi tới một điểm theo đường chặng (GDD mục 7): `region` là mã vùng hay khu đặc biệt của điểm. Sang vùng khác thì qua đèo,
   * vào khu qua cửa ải. Đang đi thì đổi đích, đi tiếp từ điểm gần chỗ đang đứng nhất trên đường.
   */
  | { type: "di_toi"; region: string; pointId: number }
  /** Chỉ bản thử: tới nơi ngay để chơi thử nhanh (máy chủ thật không có; GDD chỉ có Phù độn thổ về thành chủ). */
  | { type: "toi_ngay" }
  /** Bế quan `gio` giờ (1 hoặc 8, như bản người mới): xong thì cộng tu vi theo tốc độ bế quan (cultivation.perHour). */
  | { type: "be_quan"; gio: number }
  /**
   * Khảm một viên trong túi vào món đang mặc ở ô `slot`: ngọc hệ vào dòng trống; ấn bộ, binh ấn (chỉ vũ khí, bao tay, ngọc
   * bội) mỗi món một viên, đã có thì viên cũ về túi.
   */
  | { type: "kham"; uid: number; slot: GearSlot }
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
  /**
   * Đầu vào trận của một chiến báo để màn Trận phát lại (nhật ký lệnh, GDD mục 16). `teams`: tên đội A, đội B (tông môn,
   * "Dị thú"); `viewer`: đội của người xem, để màn Trận hiện Ta/Địch và Thắng/Thua thay Đội A/Đội B.
   */
  battle(id: number): Promise<{ label: string; input: BattleInput; arena?: string; teams?: [string, string]; viewer?: 0 | 1 } | undefined>;
  send(cmd: DashboardCommand): Promise<CommandResult>;
}

// Định dạng replay mà trình phát đọc. Đơn vị khớp @ktlp/sim: tick (20 tick = 1 giây), vị trí theo milli-ô trên trục 12 ô.
//
// Sau Sprint 1, một SimReplaySource sẽ chạy simulate() của @ktlp/sim với BattleInput (seed, đội hình, nhật ký lệnh)
// và đổi nhật ký sự kiện của sim sang Replay. Trình phát chỉ biết tới interface ReplaySource bên dưới.

/** 12 hệ, cùng mã với ELEMENTS của @ktlp/sim. */
export const ELEMENT_IDS = [
  "kim", "moc", "thuy", "hoa", "tho",
  "loi", "phong", "cuc_duong", "cuc_am", "cuc_han",
  "quang", "am_lanh",
] as const;
export type ElementId = (typeof ELEMENT_IDS)[number];

/** 10 loại chiêu, cùng mã với SKILL_TYPES của @ktlp/sim. */
export const SKILL_IDS = [
  "can_don", "can_quet", "tam_xa", "dien_rong", "ho_the",
  "bua_chu", "tran_phap", "hoi_phuc", "khong_che", "than_phap",
] as const;
export type SkillId = (typeof SKILL_IDS)[number];

export interface ReplayUnit {
  id: number;
  team: 0 | 1;
  /** 0 hàng trước, 1 hàng sau */
  row: 0 | 1;
  name: string;
  element: ElementId;
  hpMax: number;
  manaMax: number;
  /** Vị trí đầu trận, milli-ô; đội A ở nửa thấp của trục, đội B ở nửa cao. */
  pos: number;
  /** Khoá hình tĩnh trong assets/pixellab/manifest.json (tu_si/<tài năng>); thiếu hình thì vẽ khối màu. */
  sprite?: string;
  /** Ngoại hình ghép: thân, áo, đồ; chưa có thì trình xem tự chọn theo hàng đứng. */
  look?: Look;
  /** Cấp nhân vật (GDD mục 6–7), để vẽ theo cảnh giới; replay giả có thể bỏ trống. */
  level?: number;
  /** Dị thú hay boss PvE (UnitSpec.monster): màn Trận vẽ bằng hình thú `sprite`, không ghép người. */
  monster?: boolean;
}

/** Ngoại hình nhân vật ghép từ thân và từng món đồ (ghi chú chung pixellab-tu-si.md). */
export interface Look {
  /** nam_khoe, nam_manh, nu_khoe, nu_manh */
  body: string;
  /** Bộ áo, ví dụ dao_bao */
  outfit: string;
  /** Mã mũ trong do/mu/ */
  hat?: string;
  /** Mã vũ khí trong do/vu_khi/ */
  weapon?: string;
  /** Màu áo theo hệ (linh căn chính), bảng nhan_vat/mau_he.json; bỏ trống thì giữ màu gốc của bộ áo */
  tint?: ElementId;
  /** Nhóm độ hiếm của vũ khí: tím, vàng, đỏ thì vũ khí có vầng sáng (GDD mục 6) */
  weaponRarity?: "luc" | "lam" | "tim" | "vang" | "do";
  /** Mức cường hoá của vũ khí; từ +21 có thêm ánh sáng (GDD mục 6) */
  weaponPlus?: number;
}

/** Sự kiện xếp theo tick tăng dần. Các trường hp, mana, pos là giá trị sau sự kiện. */
export type ReplayEvent =
  | { tick: number; kind: "move"; unit: number; pos: number }
  | {
      tick: number;
      kind: "cast";
      unit: number;
      skill: SkillId;
      element: ElementId;
      targets: number[];
      /** Chiêu vận công (diện rộng) hay bày trận (trận pháp): tick bắt đầu; `tick` là lúc phát. */
      start?: number;
      /** Chiêu có vùng: tâm và bán kính vùng đánh trên trục, milli-ô. */
      center?: number;
      radius?: number;
      /** Hệ của các phụ quyển trong công pháp (GDD mục 9) */
      subElements?: ElementId[];
      /** Đòn mang chiêu cuối tông chủ */
      ult?: boolean;
      /** Phẩm công pháp 1–10 (GDD mục 9); hiệu ứng chiêu càng cao phẩm càng nhiều hạt, càng sáng */
      grade?: number;
    }
  /** `counter`: hệ chiêu khắc linh căn người trúng (hệ số khắc 1,5 trở lên, GDD mục 8), màn Trận vẽ số nổi hơn. */
  | { tick: number; kind: "hit"; unit: number; src: number; amount: number; crit: boolean; hp: number; counter?: boolean }
  | { tick: number; kind: "heal"; unit: number; src: number; amount: number; hp: number }
  | { tick: number; kind: "mana"; unit: number; mana: number }
  | { tick: number; kind: "death"; unit: number }
  /**
   * Trạng thái do chiêu hay hệ gây ra (choáng, trói, chậm, thiêu, giảm hồi máu, khiên, lộ vị trí, ẩn thân), lấy từ sim
   * lúc thời hạn đổi: `until` là tick hết hạn; bằng `tick` khi trạng thái mất sớm (khiên bị phá hết).
   */
  | { tick: number; kind: "status"; unit: number; status: StatusKind; until: number };

/** Trạng thái theo thời gian, cùng tên với các trường *Until của Unit trong @ktlp/sim. */
export const STATUS_KINDS = ["stun", "root", "slow", "burn", "healCut", "shield", "exposed", "stealth"] as const;
export type StatusKind = (typeof STATUS_KINDS)[number];

export interface Replay {
  /** Tick mỗi giây */
  tps: number;
  /** Độ dài trận, tick */
  ticks: number;
  /** Chiều dài sân, milli-ô */
  fieldLength: number;
  units: ReplayUnit[];
  events: ReplayEvent[];
  winner: "A" | "B" | "draw";
  /** Nền sân trong assets/pixellab/san_dau/ (vo_truong, cao_nguyen, mo_linh_thach); bỏ trống là võ trường. */
  arena?: string;
  /** Tên hai bên (đội A, đội B), ví dụ tên tông môn và "Dị thú"; bỏ trống thì "Ta"/"Địch" theo `viewer`, không có nữa thì "Đội A"/"Đội B". */
  teams?: [string, string];
  /** Phía của người xem (0 đội A, 1 đội B): có thì hết trận hiện "Thắng"/"Thua" theo phía này. */
  viewer?: 0 | 1;
}

/** Nguồn replay: hiện là replay giả trong src/mock, sau này là simulate() của @ktlp/sim. */
export interface ReplaySource {
  readonly label: string;
  load(): Promise<Replay>;
}

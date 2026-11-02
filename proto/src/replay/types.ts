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
  /** Khoá hình trong assets/pixellab/manifest.json; thiếu hình thì vẽ khối màu. */
  sprite?: string;
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
    }
  | { tick: number; kind: "hit"; unit: number; src: number; amount: number; crit: boolean; hp: number }
  | { tick: number; kind: "heal"; unit: number; src: number; amount: number; hp: number }
  | { tick: number; kind: "mana"; unit: number; mana: number }
  | { tick: number; kind: "death"; unit: number };

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
}

/** Nguồn replay: hiện là replay giả trong src/mock, sau này là simulate() của @ktlp/sim. */
export interface ReplaySource {
  readonly label: string;
  load(): Promise<Replay>;
}

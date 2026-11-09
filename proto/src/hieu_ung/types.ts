// Kiểu dữ liệu chung của lớp hiệu ứng chiêu, không cần three (Node chạy thẳng được để test).
import type { ReplayIndex } from "../replay/timeline.ts";
import type { ElementId, ReplayEvent, StatusKind } from "../replay/types.ts";

export type Cast = Extract<ReplayEvent, { kind: "cast" }>;

export interface Point {
  x: number;
  y: number;
}

/** Vùng đánh trên sân thành elip theo toạ độ thế giới màn Trận. */
export type Zone = Point & { rx: number; ry: number };

export interface StatusSpan {
  unit: number;
  status: StatusKind;
  /** Tick bắt đầu (lúc áp) và tick hết hạn */
  from: number;
  until: number;
}

/** Những gì lớp hiệu ứng cần từ màn Trận trong một khung hình. Toạ độ là toạ độ thế giới sau camera của màn Trận. */
export interface FxInput {
  index: ReplayIndex;
  /** Thời điểm phát, tick có phần lẻ */
  t: number;
  /** Tốc độ phát ×1, ×2, ×4 */
  speed: number;
  /** Giây thực ra số tick theo tốc độ phát (như màn Trận: tối đa 2 giây trận) */
  life: (seconds: number) => number;
  /** Tâm khối nhân vật ở thời điểm `time` (mặc định t); chân người ở y + size/2 */
  at: (unit: number, time?: number) => Point | null;
  /** Vùng đánh: tâm và bán kính trên trục (milli-ô) ra elip thế giới */
  zone: (center: number, radius: number) => Zone;
  /** Cạnh khối nhân vật, đơn vị thế giới */
  size: number;
  /** Trạng thái theo thời gian nếu replay có; thiếu thì lớp hiệu ứng tự suy từ ra chiêu và trúng đòn */
  statuses?: StatusSpan[];
}

/** Camera của màn Trận ở khung này: như app/camera.ts cộng độ rung màn (px CSS). */
export interface FxCamera {
  /** Cỡ vùng vẽ px CSS (cả màn) và phần đáy bị thanh dưới che */
  w: number;
  h: number;
  bottom: number;
  x: number;
  y: number;
  /** px CSS mỗi đơn vị thế giới */
  zoom: number;
  shakeX: number;
  shakeY: number;
}

export type { ElementId, StatusKind };

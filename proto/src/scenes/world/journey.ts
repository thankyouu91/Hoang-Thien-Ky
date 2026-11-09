// Hành trình trên map lớn (GDD mục 3, tầng 1): chạm Đi tới là nhân vật đi theo đường, tính thời gian theo
// quãng đường chia tốc độ; tới nơi mới vào được khu vực (tầng 2, worldScene). Prototype lưu vào localStorage;
// bản thật server giữ hành trình và tính theo giờ server (mục 16).

/** Tốc độ đi bộ trên map lớn, ô bản đồ mỗi giây (đề xuất; thú cưỡi nhân sau). */
export const TRAVEL_SPEED = 8;

const KEY_GOING = "htk.hanhTrinh.dangDi";
const KEY_AT = "htk.hanhTrinh.dangO";

export interface Journey {
  /** Điểm đích (id trong file điểm của vùng). */
  to: number;
  /** Mốc tới nơi, ms theo đồng hồ máy (prototype). */
  endsAt: number;
}

/** Id điểm người chơi đang đứng (mặc định 0 = thành chủ). */
export function currentSpot(): number {
  try {
    return JSON.parse(localStorage.getItem(KEY_AT) ?? "0") as number;
  } catch {
    return 0;
  }
}

/** Hành trình đang chạy, nếu có và chưa tới. Tới rồi thì chốt vị trí và trả về undefined. */
export function ongoing(): Journey | undefined {
  try {
    const j = JSON.parse(localStorage.getItem(KEY_GOING) ?? "null") as Journey | null;
    if (!j) return undefined;
    if (Date.now() >= j.endsAt) {
      localStorage.setItem(KEY_AT, String(j.to));
      localStorage.removeItem(KEY_GOING);
      return undefined;
    }
    return j;
  } catch {
    return undefined;
  }
}

/** Bắt đầu đi tới điểm; trả về số giây hành trình. */
export function startJourney(to: number, fromXY: { x: number; y: number }, toXY: { x: number; y: number }): number {
  const dist = Math.hypot(toXY.x - fromXY.x, toXY.y - fromXY.y);
  const sec = Math.max(3, Math.round(dist / TRAVEL_SPEED));
  const j: Journey = { to, endsAt: Date.now() + sec * 1000 };
  try {
    localStorage.setItem(KEY_GOING, JSON.stringify(j));
  } catch {
    // Không lưu được thì coi như tới ngay.
    localStorage.setItem(KEY_AT, String(to));
  }
  return sec;
}

/** Trạng thái của một điểm với người chơi: đang ở, đang đi tới (còn bao giây), hoặc chưa tới. */
export function spotStatus(pointId: number): { kind: "o_day" } | { kind: "dang_di"; remainSec: number } | { kind: "xa" } {
  ongoing(); // chốt hành trình đã tới nơi trước khi so vị trí
  if (currentSpot() === pointId) return { kind: "o_day" };
  const j = ongoing();
  if (j && j.to === pointId) return { kind: "dang_di", remainSec: Math.max(1, Math.ceil((j.endsAt - Date.now()) / 1000)) };
  return { kind: "xa" };
}

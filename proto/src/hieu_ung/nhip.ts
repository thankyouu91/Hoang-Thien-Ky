// Nhịp chuyển động của hiệu ứng (luật ở DONG_TAC.md): khung chuẩn 30 khung/giây, easing có tên theo luật, khựng khi
// chạm (hit-stop), cung trọng lực, kéo dài theo tốc độ (smear, co giãn). Hàm thuần, không giữ trạng thái.

/** Khung chuẩn để viết beats: 30 khung mỗi giây thực (đổi ra tick theo tốc độ phát qua S). */
export const FPS = 30;
/** Khung va chạm tương phản cao ngay lúc chạm (thay cho mờ dần). */
export const IMPACT_FRAMES = 2;
/** Khựng khi chạm: giữ nguyên hình chạm bấy nhiêu khung rồi mới bung (đề xuất). */
export const HIT_STOP_FRAMES = 5;

/** n khung (ở 30 khung/giây) ra tick theo nhịp của chiêu (S: giây thực × nhịp biến thể → tick). */
export function frames(S: (sec: number) => number, n: number): number {
  return S(n / FPS);
}

function c01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

/** Easing theo luật: không dùng nội suy tuyến tính cho chuyển động chính. */
export const ease = {
  /** Tụ lực: lùi một chút rồi mới đi (back-in). */
  anticipate(x: number): number {
    const k = c01(x);
    return k * k * (2.7 * k - 1.7);
  },
  /** Vụt (whip): bứt rất nhanh rồi chậm hẳn (expo-out). */
  whip(x: number): number {
    const k = c01(x);
    return k >= 1 ? 1 : 1 - Math.pow(2, -10 * k);
  },
  /** Lắng: vượt quá đích một chút rồi về (back-out). */
  settle(x: number): number {
    const k = c01(x) - 1;
    return 1 + 2.7 * k * k * k + 1.7 * k * k;
  },
  /** Vào ra êm (cubic in-out). */
  inOut(x: number): number {
    const k = c01(x);
    return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
  },
};

/**
 * Khựng khi chạm: tuổi tính từ lúc chạm (tick) đổi sang tuổi đã khựng: giữ 0 trong `hold` tick đầu rồi chạy tiếp.
 * Âm (trước lúc chạm) giữ nguyên.
 */
export function hitStop(age: number, hold: number): number {
  if (age <= 0) return age;
  return age < hold ? 0 : age - hold;
}

/**
 * Cung trọng lực: đi ngang đều theo thời gian (q 0..1), độ cao theo parabol có đỉnh `apex` ở giữa đường,
 * thay cho đường thẳng hay cung sin.
 */
export function gravityArc(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, q: number, apex: number): [number, number, number] {
  return [x0 + (x1 - x0) * q, y0 + (y1 - y0) * q, z0 + (z1 - z0) * q + 4 * apex * q * (1 - q)];
}

/**
 * Co giãn theo tốc độ (smear): `speed` đơn vị thế giới mỗi tick; dài ra tối đa `max` lần, bề ngang co lại để giữ diện
 * tích. Trả về hệ số nhân cho nửa dài và nửa rộng.
 */
export function smear(speed: number, max = 3): { len: number; wid: number } {
  const len = Math.min(max, 1 + speed * 0.12);
  return { len, wid: 1 / Math.sqrt(len) };
}

/** Bẹt khi chạm (squash): khung chạm bè ra theo ngang, lùn theo dọc, rồi về hình cũ theo `settle`. */
export function squash(ageFrames: number): { sx: number; sy: number } {
  if (ageFrames < 0) return { sx: 1, sy: 1 };
  const k = c01(ageFrames / 6);
  const amt = 0.45 * (1 - ease.settle(k));
  return { sx: 1 + amt, sy: 1 - amt * 0.6 };
}

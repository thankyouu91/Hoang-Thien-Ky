import type { WebGLRenderer, WebGLRenderTarget } from "three";

/**
 * Một thứ vẽ được bằng renderer dùng chung: cảnh nền của lớp này, hoặc cảnh riêng của màn khác (Pháp tướng).
 * Host gọi resize khi đổi cỡ, render mỗi khung (chế độ động) hoặc một lần (nướng ảnh, giảm chuyển động).
 */
export interface Program {
  /** Cỡ theo px CSS và mật độ điểm ảnh thật đang vẽ. */
  resize(w: number, h: number, dpr: number): void;
  /** target null là canvas đang gắn; t tính bằng giây từ lúc gắn, dt giây từ khung trước. */
  render(renderer: WebGLRenderer, target: WebGLRenderTarget | null, t: number, dt: number): void;
  /** Con trỏ hoặc độ nghiêng máy, -1..1 mỗi trục; dùng cho thị sai. */
  pointer?(x: number, y: number): void;
  /** Độ cuộn tính bằng số màn hình. */
  scroll?(screens: number): void;
  /** false: cảnh không đổi theo thời gian, chỉ vẽ lại khi đổi cỡ hay có thị sai. */
  readonly animated?: boolean;
  dispose(): void;
}

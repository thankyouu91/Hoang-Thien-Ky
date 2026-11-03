// Phần không cần three: dò WebGL, giảm chuyển động, giới hạn mật độ điểm ảnh.
// Module này nạp tĩnh được ở mọi màn; three chỉ tới khi có màn gọi tới engine (import() động trong index.ts).

let webgl: boolean | undefined;

/**
 * three r186 chỉ chạy trên WebGL2. Máy không có thì mọi API nền trả null hoặc không gắn gì, màn giữ nền 2D đang có.
 * Thử nền 2D trên máy có WebGL: đặt localStorage `ktlp.nowebgl` = 1 hoặc thêm `?nowebgl` vào URL.
 */
export function hasWebGL(): boolean {
  if (webgl !== undefined) return webgl;
  try {
    const forcedOff = location.search.includes("nowebgl") || localStorage.getItem("ktlp.nowebgl") === "1";
    if (forcedOff) return (webgl = false);
  } catch {
    // localStorage bị chặn: coi như không ép tắt
  }
  try {
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl2");
    webgl = !!gl;
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    webgl = false;
  }
  return webgl;
}

const motionQuery = typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : undefined;

/** Người chơi bật "giảm chuyển động" trong máy: cảnh vẽ một khung tĩnh, không thị sai, không vòng lặp. */
export function prefersReducedMotion(): boolean {
  return motionQuery?.matches ?? false;
}

export function onReducedMotionChange(fn: () => void): void {
  motionQuery?.addEventListener("change", fn);
}

/** Mật độ điểm ảnh tối đa: cảnh động phủ cả màn hình tốn nhất nên thấp hơn ảnh nướng. */
export const DPR_CAP = { live: 1.5, bake: 2 } as const;

export function deviceDpr(cap: number): number {
  return Math.min(window.devicePixelRatio || 1, cap);
}

/** Thông tin vẽ một khung hình. Kích thước theo px CSS; canvas thật nhân thêm dpr. */
export interface View {
  ctx: CanvasRenderingContext2D;
  w: number;
  h: number;
  dpr: number;
  /** Phần đáy màn hình bị thanh dưới và HUD che, px CSS. */
  bottom: number;
}

export function createView(canvas: HTMLCanvasElement): View {
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("Trình duyệt không hỗ trợ canvas 2D");
  return { ctx, w: 0, h: 0, dpr: 1, bottom: 0 };
}

/** Khớp bộ đệm canvas với kích thước hiển thị và devicePixelRatio; trả về true nếu có đổi. */
export function syncSize(canvas: HTMLCanvasElement, v: View): boolean {
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (w === v.w && h === v.h && dpr === v.dpr) return false;
  v.w = w;
  v.h = h;
  v.dpr = dpr;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  return true;
}

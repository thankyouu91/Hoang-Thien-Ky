import type { Camera } from "./camera.ts";
import type { View } from "./view.ts";

/**
 * Kéo bằng 1 ngón để di chuyển, chụm 2 ngón để zoom; trên máy tính kéo chuột và lăn chuột.
 * getCamera trả về camera của scene đang mở tại thời điểm có sự kiện.
 */
export function attachInput(canvas: HTMLCanvasElement, view: View, getCamera: () => Camera): void {
  const pts = new Map<number, { x: number; y: number }>();

  // Tâm và khoảng cách của các ngón đang chạm, theo toạ độ trong canvas.
  const gesture = () => {
    let x = 0;
    let y = 0;
    for (const p of pts.values()) {
      x += p.x;
      y += p.y;
    }
    x /= pts.size;
    y /= pts.size;
    let dist = 0;
    if (pts.size >= 2) {
      const [a, b] = [...pts.values()];
      dist = Math.hypot(a.x - b.x, a.y - b.y);
    }
    return { x, y, dist };
  };

  canvas.addEventListener("pointerdown", (e) => {
    canvas.setPointerCapture(e.pointerId);
    pts.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
  });

  canvas.addEventListener("pointermove", (e) => {
    const p = pts.get(e.pointerId);
    if (!p) return;
    const before = gesture();
    p.x = e.offsetX;
    p.y = e.offsetY;
    const after = gesture();
    const cam = getCamera();
    cam.panBy(after.x - before.x, after.y - before.y);
    if (before.dist > 0 && after.dist > 0) cam.zoomAt(after.x, after.y, after.dist / before.dist, view);
  });

  const release = (e: PointerEvent) => {
    pts.delete(e.pointerId);
  };
  canvas.addEventListener("pointerup", release);
  canvas.addEventListener("pointercancel", release);

  canvas.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      getCamera().zoomAt(e.offsetX, e.offsetY, Math.exp(-e.deltaY * 0.0015), view);
    },
    { passive: false },
  );

  canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  // Safari iOS vẫn zoom cả trang khi chụm dù đã đặt viewport.
  document.addEventListener("gesturestart", (e) => e.preventDefault());
}

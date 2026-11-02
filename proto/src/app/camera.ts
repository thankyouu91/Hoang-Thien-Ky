import type { View } from "./view.ts";

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Camera 2D: (x, y) là điểm thế giới nằm giữa vùng nhìn; zoom là số px CSS cho mỗi đơn vị thế giới. */
export class Camera {
  x = 0;
  y = 0;
  zoom = 1;
  minZoom = 0.2;
  maxZoom = 5;
  /** Tâm camera không ra khỏi vùng này (nếu có). */
  bounds: Rect | null = null;

  // Tâm vùng nhìn trên màn hình, chừa phần đáy bị thanh dưới che.
  private cx(v: View): number {
    return v.w / 2;
  }
  private cy(v: View): number {
    return (v.h - v.bottom) / 2;
  }

  /** Đặt phép biến đổi của ctx để vẽ theo toạ độ thế giới. */
  apply(v: View): void {
    const s = v.dpr * this.zoom;
    v.ctx.setTransform(s, 0, 0, s, v.dpr * (this.cx(v) - this.x * this.zoom), v.dpr * (this.cy(v) - this.y * this.zoom));
  }

  toWorld(sx: number, sy: number, v: View): { x: number; y: number } {
    return { x: (sx - this.cx(v)) / this.zoom + this.x, y: (sy - this.cy(v)) / this.zoom + this.y };
  }

  toScreen(wx: number, wy: number, v: View): { x: number; y: number } {
    return { x: (wx - this.x) * this.zoom + this.cx(v), y: (wy - this.y) * this.zoom + this.cy(v) };
  }

  /** Vùng thế giới đang thấy trên màn hình. */
  visible(v: View): Rect {
    const a = this.toWorld(0, 0, v);
    const b = this.toWorld(v.w, v.h, v);
    return { x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y };
  }

  panBy(dx: number, dy: number): void {
    this.x -= dx / this.zoom;
    this.y -= dy / this.zoom;
    this.clampToBounds();
  }

  /** Zoom quanh một điểm màn hình, giữ điểm thế giới dưới ngón tay đứng yên. */
  zoomAt(sx: number, sy: number, factor: number, v: View): void {
    const before = this.toWorld(sx, sy, v);
    this.zoom = Math.min(this.maxZoom, Math.max(this.minZoom, this.zoom * factor));
    const after = this.toWorld(sx, sy, v);
    this.x += before.x - after.x;
    this.y += before.y - after.y;
    this.clampToBounds();
  }

  /** Thu cả vùng r vào màn hình. */
  fit(r: Rect, v: View, pad = 16): void {
    const zw = (v.w - 2 * pad) / r.w;
    const zh = (v.h - v.bottom - 2 * pad) / r.h;
    this.zoom = Math.min(this.maxZoom, Math.max(this.minZoom, Math.min(zw, zh)));
    this.x = r.x + r.w / 2;
    this.y = r.y + r.h / 2;
  }

  private clampToBounds(): void {
    const b = this.bounds;
    if (!b) return;
    this.x = Math.min(b.x + b.w, Math.max(b.x, this.x));
    this.y = Math.min(b.y + b.h, Math.max(b.y, this.y));
  }
}

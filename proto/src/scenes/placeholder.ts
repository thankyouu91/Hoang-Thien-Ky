import { Camera } from "../app/camera.ts";
import type { Scene } from "../app/scene.ts";
import type { View } from "../app/view.ts";

const CELL = 64;

/** Scene giữ chỗ: lưới kéo và zoom được, kèm dòng ghi chú sprint sẽ làm. */
export class PlaceholderScene implements Scene {
  readonly id: string;
  readonly label: string;
  readonly camera = new Camera();
  private note: string;
  private size: number;
  private fitted = false;

  constructor(id: string, label: string, note: string, size = CELL * 40) {
    this.id = id;
    this.label = label;
    this.note = note;
    this.size = size;
    this.camera.bounds = { x: 0, y: 0, w: size, h: size };
  }

  enter(v: View): void {
    if (this.fitted) return;
    this.camera.fit({ x: 0, y: 0, w: this.size, h: this.size }, v);
    this.fitted = true;
  }

  update(): void {}

  draw(v: View): void {
    const ctx = v.ctx;
    const cam = this.camera;
    cam.apply(v);

    ctx.fillStyle = "#1d1915";
    ctx.fillRect(0, 0, this.size, this.size);

    // Chỉ vẽ các đường lưới trong vùng đang thấy.
    const r = cam.visible(v);
    const x0 = Math.max(0, Math.floor(r.x / CELL) * CELL);
    const x1 = Math.min(this.size, r.x + r.w);
    const y0 = Math.max(0, Math.floor(r.y / CELL) * CELL);
    const y1 = Math.min(this.size, r.y + r.h);
    ctx.beginPath();
    for (let x = x0; x <= x1; x += CELL) {
      ctx.moveTo(x, Math.max(0, r.y));
      ctx.lineTo(x, y1);
    }
    for (let y = y0; y <= y1; y += CELL) {
      ctx.moveTo(Math.max(0, r.x), y);
      ctx.lineTo(x1, y);
    }
    ctx.strokeStyle = "#2e2720";
    ctx.lineWidth = 1 / cam.zoom;
    ctx.stroke();

    ctx.fillStyle = "#a89c88";
    ctx.font = "bold 96px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(this.label, this.size / 2, this.size / 2 - 60);
    ctx.font = "56px system-ui, sans-serif";
    ctx.fillText(this.note, this.size / 2, this.size / 2 + 60);
  }
}

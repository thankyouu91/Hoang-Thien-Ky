// Sương mù của bản đồ mở (GDD mục 3): đi tới đâu mở tới đó trong một bán kính, lưu lại theo người chơi.
// Canvas phủ khung vùng ở tỉ lệ 1/DIV; mỗi ô sương ứng DIV đơn vị bản đồ, lưu bitfield vào localStorage.

const DIV = 2;
/** Bán kính mở sương quanh nhân vật, đơn vị bản đồ (đề xuất). */
export const REVEAL_R = 12;

export class FogMap {
  readonly ox: number;
  readonly oy: number;
  readonly w: number;
  readonly h: number;
  private seen: Uint8Array;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private key: string;
  private dirty = false;

  constructor(code: string, origin: [number, number], w: number, h: number) {
    this.ox = origin[0];
    this.oy = origin[1];
    this.w = Math.ceil(w / DIV);
    this.h = Math.ceil(h / DIV);
    this.key = `htk.theGioi.suong.${code}`;
    this.seen = new Uint8Array(this.w * this.h);
    try {
      const saved = localStorage.getItem(this.key);
      if (saved) {
        const bin = atob(saved);
        for (let i = 0; i < Math.min(bin.length, this.seen.length); i++) this.seen[i] = bin.charCodeAt(i);
      }
    } catch {
      // Không đọc được thì bắt đầu mù hoàn toàn.
    }
    this.canvas = document.createElement("canvas");
    this.canvas.width = this.w;
    this.canvas.height = this.h;
    this.ctx = this.canvas.getContext("2d")!;
    this.repaint();
  }

  /** Mở sương quanh điểm (toạ độ bản đồ); gọi mỗi khi nhân vật đi được một đoạn. */
  reveal(x: number, y: number, r = REVEAL_R): void {
    const r2 = r * r;
    const x0 = Math.max(0, Math.floor((x - r - this.ox) / DIV));
    const y0 = Math.max(0, Math.floor((y - r - this.oy) / DIV));
    const x1 = Math.min(this.w - 1, Math.floor((x + r - this.ox) / DIV));
    const y1 = Math.min(this.h - 1, Math.floor((y + r - this.oy) / DIV));
    let changed = false;
    for (let gy = y0; gy <= y1; gy++)
      for (let gx = x0; gx <= x1; gx++) {
        const i = gy * this.w + gx;
        if (this.seen[i]) continue;
        const cx = this.ox + gx * DIV + DIV / 2;
        const cy = this.oy + gy * DIV + DIV / 2;
        if ((cx - x) ** 2 + (cy - y) ** 2 <= r2) {
          this.seen[i] = 1;
          changed = true;
        }
      }
    if (changed) {
      this.repaint();
      this.dirty = true;
    }
  }

  /** Điểm đã mở sương chưa. */
  lit(x: number, y: number): boolean {
    const gx = Math.floor((x - this.ox) / DIV);
    const gy = Math.floor((y - this.oy) / DIV);
    if (gx < 0 || gy < 0 || gx >= this.w || gy >= this.h) return false;
    return this.seen[gy * this.w + gx] === 1;
  }

  /** Vẽ sương lên ctx đã đặt biến đổi camera. */
  draw(ctx: CanvasRenderingContext2D): void {
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.canvas, this.ox, this.oy, this.w * DIV, this.h * DIV);
  }

  /** Lưu xuống localStorage; gọi định kỳ hoặc khi rời scene. */
  flush(): void {
    if (!this.dirty) return;
    this.dirty = false;
    try {
      localStorage.setItem(this.key, btoa(String.fromCharCode(...this.seen)));
    } catch {
      // Đầy bộ nhớ thì bỏ qua, sương mù mở lại từ đầu lần sau.
    }
  }

  private repaint(): void {
    const img = this.ctx.createImageData(this.w, this.h);
    const [fr, fg, fb, fa] = [238, 226, 198, 210];
    for (let i = 0; i < this.seen.length; i++) {
      if (this.seen[i]) continue;
      img.data[i * 4] = fr;
      img.data[i * 4 + 1] = fg;
      img.data[i * 4 + 2] = fb;
      img.data[i * 4 + 3] = fa;
    }
    this.ctx.putImageData(img, 0, 0);
  }
}

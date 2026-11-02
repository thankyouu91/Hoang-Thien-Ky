/** Đếm khung hình mỗi giây và khung chậm nhất trong giây vừa qua. */
export class FpsMeter {
  fps = 0;
  worstMs = 0;
  private frames = 0;
  private start = 0;
  private prev = 0;
  private worst = 0;

  tick(now: number): void {
    if (this.prev) this.worst = Math.max(this.worst, now - this.prev);
    this.prev = now;
    this.frames++;
    if (!this.start) this.start = now;
    if (now - this.start >= 1000) {
      this.fps = (this.frames * 1000) / (now - this.start);
      this.worstMs = this.worst;
      this.frames = 0;
      this.worst = 0;
      this.start = now;
    }
  }
}

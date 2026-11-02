/** Đồng hồ phát lại: thời gian tính bằng tick có phần lẻ, chạy theo thời gian thực nhân tốc độ. */
export class ReplayPlayer {
  t = 0;
  speed = 1;
  playing = true;
  readonly tps: number;
  readonly end: number;

  constructor(tps: number, end: number) {
    this.tps = tps;
    this.end = end;
  }

  update(dt: number): void {
    if (!this.playing) return;
    this.t = Math.min(this.end, this.t + dt * this.tps * this.speed);
    if (this.t >= this.end) this.playing = false;
  }

  seek(tick: number): void {
    this.t = Math.min(this.end, Math.max(0, tick));
  }

  /** Hết trận mà bấm phát thì phát lại từ đầu. */
  toggle(): void {
    if (!this.playing && this.t >= this.end) this.t = 0;
    this.playing = !this.playing;
  }
}

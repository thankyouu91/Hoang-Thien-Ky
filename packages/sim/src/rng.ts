// RNG có seed (mulberry32), chỉ dùng phép toán số nguyên 32 bit nên deterministic.
export class Rng {
  private s: number;
  constructor(seed: number) {
    this.s = seed >>> 0;
  }
  nextU32(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  }
  /** Số nguyên trong [0, n) */
  int(n: number): number {
    return this.nextU32() % n;
  }
  /** Tung xác suất theo phần nghìn (0–1000) */
  chance(perMille: number): boolean {
    return this.int(1000) < perMille;
  }
}

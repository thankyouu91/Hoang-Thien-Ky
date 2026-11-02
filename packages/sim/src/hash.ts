// FNV-1a 32 bit trên dãy số nguyên: dùng để so trạng thái giữa client và worker xác minh.
export class Hasher {
  private h = 0x811c9dc5;
  add(n: number): void {
    let v = n | 0;
    for (let i = 0; i < 4; i++) {
      this.h ^= v & 0xff;
      this.h = Math.imul(this.h, 0x01000193) >>> 0;
      v >>>= 8;
    }
  }
  value(): number {
    return this.h >>> 0;
  }
}

// FNV-1a 32 bit trên dãy số nguyên: dùng để so trạng thái giữa client và worker xác minh.
export class Hasher {
  private h = 0x811c9dc5;
  add(n: number): void {
    // Trải vòng 4 byte cho nhanh; kết quả giống hệt vòng lặp byte thấp trước.
    const v = n | 0;
    let h = this.h;
    h = Math.imul(h ^ (v & 0xff), 0x01000193);
    h = Math.imul(h ^ ((v >>> 8) & 0xff), 0x01000193);
    h = Math.imul(h ^ ((v >>> 16) & 0xff), 0x01000193);
    h = Math.imul(h ^ (v >>> 24), 0x01000193);
    this.h = h >>> 0;
  }
  value(): number {
    return this.h >>> 0;
  }
}

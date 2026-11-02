// Băm dãy số nguyên kiểu FNV-1a theo từng số 32 bit: dùng để so trạng thái giữa client và worker xác minh.
// Mỗi bước (xor rồi nhân số lẻ) là song ánh, nên hai dãy khác nhau ở một vị trí luôn cho mã khác nhau.
export class Hasher {
  private h = 0x811c9dc5;
  add(n: number): void {
    this.h = Math.imul(this.h ^ (n | 0), 0x01000193);
  }
  /** Trộn thêm một lượt (fmix32 của MurmurHash3) cho các bit phân bố đều. */
  value(): number {
    let h = this.h;
    h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
    return (h ^ (h >>> 16)) >>> 0;
  }
}

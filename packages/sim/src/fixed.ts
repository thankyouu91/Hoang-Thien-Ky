// Số thực cố định (fixed-point) thang 1000: 1.000 = 1000.
// Chỉ dùng số nguyên và Math.trunc để mọi máy (client, Node, Nakama) cho cùng kết quả.
export const ONE = 1000;
export function mul(a: number, b: number): number {
  return Math.trunc((a * b) / ONE);
}
export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

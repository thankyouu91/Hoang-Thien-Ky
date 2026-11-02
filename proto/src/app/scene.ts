import type { Camera } from "./camera.ts";
import type { View } from "./view.ts";

/** Một màn trong thanh dưới (GDD mục 14). */
export interface Scene {
  /** Dùng làm hash trên URL, ví dụ #tran. */
  readonly id: string;
  /** Nhãn trên thanh dưới. */
  readonly label: string;
  readonly camera: Camera;
  /** Phần điều khiển DOM nằm ngay trên thanh dưới, chỉ hiện khi scene đang mở. */
  readonly hud?: HTMLElement;
  /** Gọi mỗi lần scene được mở, sau khi canvas đã có kích thước. */
  enter?(v: View): void;
  /** dt tính bằng giây thực. */
  update(dt: number): void;
  draw(v: View): void;
}

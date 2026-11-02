import type { Camera } from "./camera.ts";
import type { View } from "./view.ts";

/** Một màn của prototype; màn có nút trên thanh dưới hay không là do App quyết (GDD mục 14). */
export interface Scene {
  /** Dùng làm hash trên URL, ví dụ #tran. */
  readonly id: string;
  /** Nhãn trên thanh dưới. */
  readonly label: string;
  readonly camera: Camera;
  /** Phần điều khiển DOM nằm ngay trên thanh dưới, chỉ hiện khi scene đang mở. */
  readonly hud?: HTMLElement;
  /** Màn DOM phủ kín canvas (dashboard); có page thì App không vẽ canvas khi scene đang mở. */
  readonly page?: HTMLElement;
  /** Gọi mỗi lần scene được mở, sau khi canvas đã có kích thước. */
  enter?(v: View): void;
  /** Gọi khi chuyển sang scene khác. */
  leave?(): void;
  /** dt tính bằng giây thực. */
  update(dt: number): void;
  draw(v: View): void;
}

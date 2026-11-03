// Kiểu công khai của lớp Three.js dùng chung. Không import three ở đây để màn nào cũng import được mà không kéo three theo.
import type { ElementId } from "../replay/types.ts";

export type { ElementId };

/** Cảnh nền: sơn thủy thủy mặc, 12 cảnh theo hệ (mã như ELEMENT_IDS), hoặc lớp hạt linh khí (nền trong suốt). */
export type SceneName = "son_thuy" | ElementId | "linh_khi";

/**
 * Tông màu: "giay" (mặc định) là nền kem sáng hợp dashboard màu kem (nét mực nhạt, sương trắng, màu hệ làm điểm nhấn);
 * "chang_vang" là bản tối (trời đêm, cộng sáng).
 */
export type Tone = "chang_vang" | "giay";

export interface SceneParams {
  /** Cùng seed thì cùng bố cục núi, cây, công trình. */
  seed?: number;
  tone?: Tone;
  /** Phủ thêm hạt linh khí trong cùng cảnh (một canvas, khỏi tốn thêm lớp). */
  linhKhi?: boolean;
  /** Màu hạt linh khí theo hệ; mặc định ngọc và vàng của dashboard. */
  element?: ElementId;
  /** false: bỏ mặt trời, trăng. */
  disc?: boolean;
  /**
   * false: bỏ cả trời (nền trong suốt): chỉ còn núi, sương, mây, cây, nằm trên nền của màn bên dưới. Hợp làm lớp nền mờ
   * dưới thẻ. Cũng bỏ đĩa trời, tia sáng, viền tối.
   */
  sky?: boolean;
}

/** Loại hình nền cho renderBackground. */
export type BgKind =
  /** Nền một công trình trong tông môn; variant là LocationId (chinh_dien, tang_kinh_cac, ...). */
  | "cong_trinh"
  /** Nền một loại điểm bản đồ; variant là loại điểm (thanh_chu, son_mon, mo_linh_thach, ...). */
  | "diem"
  /** Nền chung theo hệ, không công trình (thẻ vùng, thẻ tông môn, thư). */
  | "vung";

export interface BackgroundOptions {
  /** Mã công trình hoặc loại điểm, xem BgKind. */
  variant?: string;
  /** Cỡ ảnh theo px CSS; mặc định 320 × 192 như hình PixelLab. */
  width?: number;
  height?: number;
  /** Mật độ điểm ảnh; mặc định devicePixelRatio, tối đa 2. */
  dpr?: number;
  /** Mặc định "giay" (kem sáng). */
  tone?: Tone;
}

/** Ba loại sân đấu, cùng tên với nền PixelLab san_dau/<tên>. */
export type ArenaKind = "vo_truong" | "mo_linh_thach" | "cao_nguyen";

export interface ArenaOptions {
  /** Màn đứng: trục sân chạy dọc ảnh (đội A dưới, đội B trên). Mặc định ngang: đội A trái, đội B phải. */
  vertical?: boolean;
  seed?: number;
  dpr?: number;
}

/** Hai lớp sân đấu đã nướng, cùng cỡ: vẽ back, rồi người và hiệu ứng, rồi front (sương, cành, bóng mép). */
export interface ArenaLayers {
  back: HTMLCanvasElement;
  front: HTMLCanvasElement;
}

export interface MountOptions {
  /** "back": nằm dưới nội dung của container (mặc định); "front": phủ lên trên, không nhận chạm. */
  layer?: "back" | "front";
  /** Phần tử cuộn của màn: cuộn thì núi gần trôi nhanh hơn núi xa. */
  scrollEl?: HTMLElement | null;
  /** Gọi khi không dựng được WebGL; màn giữ nền đang có. */
  onFallback?: () => void;
}

export interface SceneHandle {
  /** true khi đã vẽ bằng WebGL, false khi quay về nền 2D. */
  readonly ready: Promise<boolean>;
  /** Đổi cảnh hoặc tham số mà giữ canvas. */
  set(name: SceneName, params?: SceneParams): void;
  /** Độ cuộn, tính bằng số màn hình (scrollTop / chiều cao); dùng khi không truyền scrollEl. */
  setScroll(screens: number): void;
  dispose(): void;
}

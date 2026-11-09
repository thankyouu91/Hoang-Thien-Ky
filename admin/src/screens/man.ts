import type { Toi } from "../../shared/hopDong.ts";

export interface NguCanh {
  toi: Toi;
  /** Vẽ lại màn (sau khi lưu). */
  veLai: () => Promise<void>;
  /** false khi người dùng đã sang màn khác trong lúc chờ API: bỏ kết quả. */
  conHieuLuc: () => boolean;
}

export interface Man {
  id: string;
  ten: string;
  mo_ta: string;
  chiAdmin?: boolean;
  ve: (el: HTMLElement, ctx: NguCanh) => Promise<void>;
}

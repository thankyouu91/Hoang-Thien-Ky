// Lưu tiến độ chơi trên máy, riêng từng tài khoản (Session.account: số điện thoại đã băm của MockAuth), cho tới khi có server
// game thật (Nakama, MVP). Khóa có số phiên bản: tăng PHIEN_BAN_LUU thì mọi tiến độ cũ trên mọi máy bị bỏ ở lần mở game kế,
// kể cả nhân vật cấp 42 của bản mẫu; người chơi bắt đầu lại từ cấp 1. File thuần, nhận đối tượng kiểu Storage để test được.
import type { World } from "../mock/world.ts";
import type { MoiState } from "./theGioiMoi.ts";

/**
 * Lịch sử: 1 = bản đầu có lưu tiến độ (2026-11-05). Trước đó game không lưu gì, ai vào cũng nhận thế giới mẫu cấp 42.
 * Muốn xóa tiến độ của mọi người chơi (đổi luật, đổi dạng World) thì tăng số này.
 */
export const PHIEN_BAN_LUU = 1;
export const TIEN_TO = "htk.tien_do.";

/** Bản lưu: World bỏ file điểm của vùng (nạp lại từ data/maps theo mã vùng), cộng phần riêng của người mới. */
export interface BanLuu {
  phienBan: number;
  luc: number;
  vung: string;
  world: Omit<World, "region">;
  moi: MoiState;
}

type Kho = Pick<Storage, "getItem" | "setItem" | "removeItem" | "key" | "length">;

export function khoaLuu(account: string): string {
  return `${TIEN_TO}v${PHIEN_BAN_LUU}.${account}`;
}

/** Bỏ mọi bản lưu khác phiên bản hiện tại; trả số khóa đã bỏ. */
export function donBanCu(kho: Kho): number {
  const hien = `${TIEN_TO}v${PHIEN_BAN_LUU}.`;
  const bo: string[] = [];
  for (let i = 0; i < kho.length; i++) {
    const k = kho.key(i);
    if (k && k.startsWith(TIEN_TO) && !k.startsWith(hien)) bo.push(k);
  }
  for (const k of bo) kho.removeItem(k);
  return bo.length;
}

export function docTienDo(kho: Kho, account: string): BanLuu | null {
  try {
    const raw = kho.getItem(khoaLuu(account));
    if (!raw) return null;
    const v = JSON.parse(raw) as BanLuu;
    return v && v.phienBan === PHIEN_BAN_LUU && v.world && v.moi ? v : null;
  } catch {
    return null;
  }
}

export function ghiTienDo(kho: Kho, account: string, world: World, moi: MoiState, now: number): boolean {
  const { region, ...rest } = world;
  const ban: BanLuu = { phienBan: PHIEN_BAN_LUU, luc: now, vung: region.region.code, world: rest, moi };
  try {
    kho.setItem(khoaLuu(account), JSON.stringify(ban));
    return true;
  } catch {
    // Bộ nhớ đầy hoặc trình duyệt chặn: tiến độ chỉ sống tới khi đóng trang.
    return false;
  }
}

export function xoaTienDo(kho: Kho, account: string): void {
  try {
    kho.removeItem(khoaLuu(account));
  } catch {
    // Bỏ qua: không xóa được thì lần sau vẫn đọc bản cũ.
  }
}

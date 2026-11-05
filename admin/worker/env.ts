// Biến môi trường của Worker thienhoangky-admin (wrangler.jsonc "vars", secret qua `wrangler secret put`).

import { normalizeEmail } from "./jwt.ts";

export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  /** Team domain Access, ví dụ "jolly-water-a8bd.cloudflareaccess.com" (có hay không có https:// đều được). Thiếu thì mọi yêu cầu bị từ chối. */
  ACCESS_TEAM_DOMAIN: string;
  /** AUD tag của ứng dụng Access cho admin.thienhoangky.fun. Thiếu thì mọi yêu cầu bị từ chối. */
  ACCESS_AUD: string;
  /** Email Admin gốc, cách nhau dấu phẩy. Luôn là Admin, không sửa được từ giao diện (chống tự khóa mình). */
  ADMIN_GOC: string;
  /** Chỉ cho test cục bộ: lấy khóa JWKS từ địa chỉ khác (máy chủ khóa giả). Không đặt khi deploy. */
  ACCESS_CERTS_URL?: string;
  /** Nơi chạy game, ví dụ "https://thienhoangky.fun" (hoặc "https://choi.thienhoangky.fun" nếu dời). Link mời = GAME_ORIGIN/moi/<ma>. */
  GAME_ORIGIN?: string;
  /** Đồng bộ Access Group quản trị (không bắt buộc). CF_API_TOKEN là secret. */
  CF_ACCOUNT_ID?: string;
  CF_API_TOKEN?: string;
  ACCESS_GROUP_QUAN_TRI?: string;
}

/** Team domain không có scheme và dấu / cuối: "https://x.cloudflareaccess.com/" → "x.cloudflareaccess.com". */
export function teamDomain(env: Env): string {
  return (env.ACCESS_TEAM_DOMAIN ?? "").trim().replace(/^https?:\/\//, "").replace(/\/+$/, "");
}

/** Gốc link mời, luôn kết thúc bằng "/moi/". Thiếu GAME_ORIGIN thì dùng tên miền game hiện tại. */
export function linkGoc(env: Env): string {
  const goc = (env.GAME_ORIGIN ?? "").trim().replace(/\/+$/, "") || "https://thienhoangky.fun";
  return `${goc}/moi/`;
}

export function dsAdminGoc(env: Env): string[] {
  return (env.ADMIN_GOC ?? "")
    .split(",")
    .map(normalizeEmail)
    .filter((e) => e.includes("@"));
}

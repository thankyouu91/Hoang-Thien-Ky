// Biến môi trường của Worker thienhoangky-admin (wrangler.jsonc "vars", secret qua `wrangler secret put`).

import { normalizeEmail } from "./jwt.ts";

export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  /** Team domain Access, ví dụ "thienhoangky.cloudflareaccess.com". Thiếu thì mọi yêu cầu bị từ chối. */
  ACCESS_TEAM_DOMAIN: string;
  /** AUD tag của ứng dụng Access cho admin.thienhoangky.fun. Thiếu thì mọi yêu cầu bị từ chối. */
  ACCESS_AUD: string;
  /** Email Admin gốc, cách nhau dấu phẩy. Luôn là Admin, không sửa được từ giao diện (chống tự khóa mình). */
  ADMIN_GOC: string;
  /** Chỉ cho test cục bộ: lấy khóa JWKS từ địa chỉ khác (máy chủ khóa giả). Không đặt khi deploy. */
  ACCESS_CERTS_URL?: string;
  /** Đồng bộ Access Group (không bắt buộc). CF_API_TOKEN là secret. */
  CF_ACCOUNT_ID?: string;
  CF_API_TOKEN?: string;
  ACCESS_GROUP_NGUOI_CHOI?: string;
  ACCESS_GROUP_QUAN_TRI?: string;
}

export function dsAdminGoc(env: Env): string[] {
  return (env.ADMIN_GOC ?? "")
    .split(",")
    .map(normalizeEmail)
    .filter((e) => e.includes("@"));
}

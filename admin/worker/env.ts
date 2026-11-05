// Biến môi trường của Worker thienhoangky-admin (wrangler.jsonc "vars").

export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  /** Lớp Access bên ngoài (không bắt buộc). Đặt cả hai thì mọi yêu cầu, kể cả trang đăng nhập, phải qua Access trước,
   *  rồi mới tới đăng nhập bằng tên + mật khẩu. Để trống thì chỉ dùng tên + mật khẩu. */
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;
  /** Chỉ cho test cục bộ: lấy khóa JWKS từ địa chỉ khác (máy chủ khóa giả). Không đặt khi deploy. */
  ACCESS_CERTS_URL?: string;
  /** Nơi chạy game, ví dụ "https://choi.thienhoangky.fun". Link mời = GAME_ORIGIN/moi/<ma>. */
  GAME_ORIGIN?: string;
}

/** Team domain không có scheme và dấu / cuối: "https://x.cloudflareaccess.com/" → "x.cloudflareaccess.com". */
export function teamDomain(env: Env): string {
  return (env.ACCESS_TEAM_DOMAIN ?? "").trim().replace(/^https?:\/\//, "").replace(/\/+$/, "");
}

/** Gốc link mời, luôn kết thúc bằng "/moi/". Thiếu GAME_ORIGIN thì dùng tên miền game hiện tại. */
export function linkGoc(env: Env): string {
  const goc = (env.GAME_ORIGIN ?? "").trim().replace(/\/+$/, "") || "https://choi.thienhoangky.fun";
  return `${goc}/moi/`;
}

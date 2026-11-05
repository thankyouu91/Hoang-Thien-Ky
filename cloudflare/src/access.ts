// Xác minh người gọi qua Cloudflare Access: kiểm chữ ký JWT trong header Cf-Access-Jwt-Assertion bằng khoá công khai
// của team (https://<team>.cloudflareaccess.com/cdn-cgi/access/certs), kiểm `iss` là team và `aud` là ứng dụng Access
// của hostname này. Không tin header email (Cf-Access-Authenticated-User-Email) vì header đó không ký.
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";

export interface NguoiGoi {
  email: string;
  /** `sub` của Access: mã người dùng trong team. */
  sub: string;
}

export interface CauHinhAccess {
  /** https://<team>.cloudflareaccess.com (không có / ở cuối). */
  ACCESS_TEAM_DOMAIN?: string;
  /** AUD tag của ứng dụng Access; nhiều tag thì ngăn bằng dấu phẩy. */
  ACCESS_AUD?: string;
  /** Chỉ dùng khi chạy `wrangler dev` trên localhost: coi người gọi là email này. */
  DEV_EMAIL?: string;
}

export type KetQuaXacMinh = { ok: true; nguoi: NguoiGoi } | { ok: false; ma: "chua_cau_hinh" | "thieu_token" | "token_sai" };

const boKhoa = new Map<string, JWTVerifyGetKey>();

export function chuanTeam(domain: string): string {
  const d = domain.trim().replace(/\/+$/, "");
  return /^https:\/\//.test(d) ? d : `https://${d}`;
}

function khoaCuaTeam(team: string): JWTVerifyGetKey {
  let k = boKhoa.get(team);
  if (!k) {
    // jose tự giữ bộ khoá trong bộ nhớ của isolate và tải lại khi gặp `kid` lạ (Access xoay khoá định kỳ).
    k = createRemoteJWKSet(new URL(`${team}/cdn-cgi/access/certs`));
    boKhoa.set(team, k);
  }
  return k;
}

function laLocalhost(url: URL): boolean {
  return url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]";
}

/**
 * Xác minh request. `khoa` chỉ truyền trong test (bộ khoá cục bộ); bình thường lấy từ team.
 * Thiếu cấu hình thì từ chối (đóng khi lỗi), trừ khi chạy local với DEV_EMAIL.
 */
export async function xacMinh(req: Request, env: CauHinhAccess, khoa?: JWTVerifyGetKey): Promise<KetQuaXacMinh> {
  const url = new URL(req.url);
  if (env.DEV_EMAIL && laLocalhost(url)) return { ok: true, nguoi: { email: env.DEV_EMAIL.toLowerCase(), sub: "dev" } };
  const team = env.ACCESS_TEAM_DOMAIN ? chuanTeam(env.ACCESS_TEAM_DOMAIN) : "";
  const auds = (env.ACCESS_AUD ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!team || auds.length === 0) return { ok: false, ma: "chua_cau_hinh" };
  const token = req.headers.get("Cf-Access-Jwt-Assertion");
  if (!token) return { ok: false, ma: "thieu_token" };
  try {
    const { payload } = await jwtVerify(token, khoa ?? khoaCuaTeam(team), {
      issuer: team,
      audience: auds,
      algorithms: ["RS256"],
      clockTolerance: 30,
    });
    // Service token của Access không có email: không phải người, từ chối.
    const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
    if (!email) return { ok: false, ma: "token_sai" };
    return { ok: true, nguoi: { email, sub: String(payload.sub ?? "") } };
  } catch {
    return { ok: false, ma: "token_sai" };
  }
}

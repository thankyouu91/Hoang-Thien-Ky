// Đồng bộ danh sách quản trị (ADMIN_GOC + qt_vai_tro) sang Access Group "THK quan tri" qua API Cloudflare, để policy của
// ứng dụng admin (và của game, nếu muốn admin vào chơi) luôn khớp vai trò trong D1.
// Người chơi thử vào bằng link mời, không qua Access, nên không có nhóm người chơi.
// Chỉ chạy khi có đủ CF_ACCOUNT_ID, CF_API_TOKEN (secret, quyền "Access: Organizations, Identity Providers, and Groups: Edit")
// và ACCESS_GROUP_QUAN_TRI. Thiếu thì màn Phân quyền hiện danh sách email để admin dán tay (admin/README.md).

import type { DongBo } from "../shared/hopDong.ts";
import type { Env } from "./env.ts";
import { dsAdminGoc } from "./env.ts";

export function daNoi(env: Env): boolean {
  return Boolean(env.CF_ACCOUNT_ID && env.CF_API_TOKEN && env.ACCESS_GROUP_QUAN_TRI);
}

export async function emailQuanTri(env: Env): Promise<string[]> {
  const r = await env.DB.prepare("SELECT email FROM qt_vai_tro ORDER BY email").all<{ email: string }>();
  return [...new Set([...dsAdminGoc(env), ...r.results.map((x) => x.email)])].sort();
}

export async function trangThai(env: Env): Promise<DongBo> {
  const r = await env.DB.prepare("SELECT luc, ok, so_email, loi FROM qt_dong_bo WHERE nhom = 'quan_tri'").first<{ luc: number; ok: number; so_email: number; loi: string | null }>();
  return { nhom: "quan_tri", da_noi: daNoi(env), luc: r?.luc ?? null, ok: r ? r.ok === 1 : null, so_email: r?.so_email ?? null, loi: r?.loi ?? null };
}

/** Ghi đè include của group bằng danh sách hiện tại. Không ném lỗi ra ngoài: trả kết quả để màn báo. */
export async function dongBo(env: Env): Promise<DongBo> {
  if (!daNoi(env)) return trangThai(env);
  const emails = await emailQuanTri(env);
  let ok = false;
  let loi: string | null = null;
  try {
    // Luôn có ít nhất Admin gốc; danh sách rỗng nghĩa là ADMIN_GOC chưa đặt, không ghi để khỏi khóa hết người.
    if (emails.length === 0) throw new Error("danh sách trống (chưa đặt ADMIN_GOC), Access giữ nguyên");
    const url = `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/access/groups/${env.ACCESS_GROUP_QUAN_TRI}`;
    const headers = { Authorization: `Bearer ${env.CF_API_TOKEN}`, "Content-Type": "application/json" };
    const cur = await fetch(url, { headers });
    const curBody = (await cur.json()) as { success?: boolean; result?: { name?: string }; errors?: { message?: string }[] };
    if (!cur.ok || !curBody.success || !curBody.result?.name) throw new Error(`đọc group: ${loiApi(cur.status, curBody.errors)}`);
    const put = await fetch(url, {
      method: "PUT",
      headers,
      body: JSON.stringify({ name: curBody.result.name, include: emails.map((email) => ({ email: { email } })) }),
    });
    const putBody = (await put.json()) as { success?: boolean; errors?: { message?: string }[] };
    if (!put.ok || !putBody.success) throw new Error(`ghi group: ${loiApi(put.status, putBody.errors)}`);
    ok = true;
  } catch (e) {
    loi = String((e as Error).message ?? e).slice(0, 300);
  }
  const luc = Date.now();
  await env.DB.prepare(
    "INSERT INTO qt_dong_bo (nhom, luc, ok, so_email, loi) VALUES ('quan_tri', ?, ?, ?, ?) ON CONFLICT(nhom) DO UPDATE SET luc = excluded.luc, ok = excluded.ok, so_email = excluded.so_email, loi = excluded.loi",
  )
    .bind(luc, ok ? 1 : 0, emails.length, loi)
    .run();
  return { nhom: "quan_tri", da_noi: true, luc, ok, so_email: emails.length, loi };
}

function loiApi(status: number, errors?: { message?: string }[]): string {
  const m = errors?.map((e) => e.message).filter(Boolean).join("; ");
  return `${status}${m ? ` ${m}` : ""}`;
}

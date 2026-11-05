// Đồng bộ danh sách email từ D1 sang Access Group qua API Cloudflare.
//   nhóm "nguoi_choi": email đã mời, không khóa (qt_nguoi_choi) → group mà policy của ứng dụng game include.
//   nhóm "quan_tri":   ADMIN_GOC + qt_vai_tro                    → group mà policy của ứng dụng admin include.
// Chỉ chạy khi có đủ CF_ACCOUNT_ID, CF_API_TOKEN (secret, quyền "Access: Organizations, Identity Providers, and Groups: Edit")
// và id group. Thiếu thì màn hiện danh sách email để admin dán tay vào Access (admin/README.md).

import type { DongBo } from "../shared/hopDong.ts";
import type { Env } from "./env.ts";
import { dsAdminGoc } from "./env.ts";

export type Nhom = DongBo["nhom"];

function groupId(env: Env, nhom: Nhom): string | undefined {
  return nhom === "nguoi_choi" ? env.ACCESS_GROUP_NGUOI_CHOI : env.ACCESS_GROUP_QUAN_TRI;
}

export function daNoi(env: Env, nhom: Nhom): boolean {
  return Boolean(env.CF_ACCOUNT_ID && env.CF_API_TOKEN && groupId(env, nhom));
}

export async function emailCuaNhom(env: Env, nhom: Nhom): Promise<string[]> {
  if (nhom === "nguoi_choi") {
    const r = await env.DB.prepare("SELECT email FROM qt_nguoi_choi WHERE khoa = 0 ORDER BY email").all<{ email: string }>();
    return r.results.map((x) => x.email);
  }
  const r = await env.DB.prepare("SELECT email FROM qt_vai_tro ORDER BY email").all<{ email: string }>();
  return [...new Set([...dsAdminGoc(env), ...r.results.map((x) => x.email)])].sort();
}

export async function trangThai(env: Env, nhom: Nhom): Promise<DongBo> {
  const r = await env.DB.prepare("SELECT luc, ok, so_email, loi FROM qt_dong_bo WHERE nhom = ?")
    .bind(nhom)
    .first<{ luc: number; ok: number; so_email: number; loi: string | null }>();
  return { nhom, da_noi: daNoi(env, nhom), luc: r?.luc ?? null, ok: r ? r.ok === 1 : null, so_email: r?.so_email ?? null, loi: r?.loi ?? null };
}

/** Ghi đè include của group bằng danh sách hiện tại. Không bao giờ ném lỗi ra ngoài: trả kết quả để màn báo. */
export async function dongBo(env: Env, nhom: Nhom): Promise<DongBo> {
  if (!daNoi(env, nhom)) return trangThai(env, nhom);
  const emails = await emailCuaNhom(env, nhom);
  let ok = false;
  let loi: string | null = null;
  try {
    if (emails.length === 0) {
      // Access không nhận group rỗng; để nguyên group, Worker game vẫn chặn email khóa bằng D1.
      throw new Error("danh sách trống, Access giữ nguyên");
    }
    const url = `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/access/groups/${groupId(env, nhom)}`;
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
    "INSERT INTO qt_dong_bo (nhom, luc, ok, so_email, loi) VALUES (?, ?, ?, ?, ?) ON CONFLICT(nhom) DO UPDATE SET luc = excluded.luc, ok = excluded.ok, so_email = excluded.so_email, loi = excluded.loi",
  )
    .bind(nhom, luc, ok ? 1 : 0, emails.length, loi)
    .run();
  return { nhom, da_noi: true, luc, ok, so_email: emails.length, loi };
}

function loiApi(status: number, errors?: { message?: string }[]): string {
  const m = errors?.map((e) => e.message).filter(Boolean).join("; ");
  return `${status}${m ? ` ${m}` : ""}`;
}

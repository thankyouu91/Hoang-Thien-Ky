// Đặt lại mật khẩu qua email cho tài khoản quản trị (người dùng yêu cầu 2026-11-05; giữ gói Workers Free).
//   - Gói Free chỉ gửi được tới địa chỉ đã xác nhận ở Email Routing của tài khoản Cloudflare: email của từng tài khoản
//     quản trị phải được thêm ở đó (`wrangler email routing addresses create <email>` rồi bấm link xác nhận).
//   - "Quên mật khẩu" luôn trả cùng một câu và trả ngay; việc tra tài khoản và gửi thư chạy sau (waitUntil), nên không
//     đoán được tên nào tồn tại hay có email qua nội dung hoặc thời gian trả lời. Mỗi tài khoản tối đa 3 link mỗi giờ.
//   - Link: <origin>/dat-lai#<token>. Token 256 bit ở phần # nên không vào log máy chủ hay Referer; D1 chỉ giữ SHA-256.
//     Hết hạn 30 phút, dùng một lần; đặt xong thì mọi link khác của tài khoản hết dùng và mọi phiên bị đăng xuất.
//   - Lỗi gửi thư ghi vào nhật ký quản trị, không lộ ra người yêu cầu.

import type { Env } from "./env.ts";
import { bamMatKhau, loiMatKhauMoi } from "./matKhau.ts";
import { b64u, sha256hex } from "./taiKhoan.ts";

export const DAT_LAI_MS = 30 * 60 * 1000;
const TOI_DA_MOI_GIO = 3;
const GUI_TU = { email: "khong-tra-loi@thienhoangky.fun", name: "Thiên Hoang Ký" };

export const CAU_QUEN = "Nếu tài khoản này có email, link đặt lại mật khẩu đã được gửi tới đó. Link dùng một lần trong 30 phút.";

/** Chạy sau khi đã trả lời người yêu cầu. Không ném lỗi. */
export async function guiLinkDatLai(env: Env, tenVao: string, origin: string): Promise<void> {
  const ten = tenVao.trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,32}$/.test(ten)) return;
  const now = Date.now();
  const tk = await env.DB.prepare("SELECT ten, vai_tro, email, khoa FROM qt_tai_khoan WHERE ten = ?")
    .bind(ten)
    .first<{ ten: string; vai_tro: string; email: string | null; khoa: number }>();
  if (!tk || !tk.email || tk.khoa === 1) return;
  const gan = await env.DB.prepare("SELECT COUNT(*) AS so FROM qt_dat_lai WHERE ten = ? AND tao_luc > ?").bind(ten, now - 3600 * 1000).first<{ so: number }>();
  if ((gan?.so ?? 0) >= TOI_DA_MOI_GIO) {
    await ghiNhatKyHeThong(env, tk, { ok: false, loi: "quá 3 link trong một giờ, không gửi" });
    return;
  }

  const token = b64u(crypto.getRandomValues(new Uint8Array(32)));
  await env.DB.prepare("INSERT INTO qt_dat_lai (ma_bam, ten, tao_luc, het_han) VALUES (?, ?, ?, ?)").bind(await sha256hex(token), ten, now, now + DAT_LAI_MS).run();
  const link = `${origin}/dat-lai#${token}`;

  let ok = false;
  let loi: string | null = null;
  try {
    if (!env.THU) throw new Error("chưa có binding send_email THU");
    await env.THU.send({
      from: GUI_TU,
      to: tk.email,
      subject: "Đặt lại mật khẩu · Thiên Hoang Ký Quản trị",
      text: [
        `Có yêu cầu đặt lại mật khẩu cho tài khoản quản trị "${ten}".`,
        "",
        "Mở link dưới đây trong 30 phút để đặt mật khẩu mới (link chỉ dùng được một lần):",
        link,
        "",
        "Trang này vẫn nằm sau Cloudflare Access: nếu được hỏi, nhập email và mã gửi về hộp thư như mọi lần.",
        "Nếu bạn không yêu cầu, bỏ qua thư này; mật khẩu hiện tại không đổi.",
      ].join("\n"),
      html: `<div style="font-family:Georgia,'Times New Roman',serif;color:#2a2018;max-width:520px">
<h2 style="color:#8a1f16;font-weight:700">Thiên Hoang Ký · Quản trị</h2>
<p>Có yêu cầu đặt lại mật khẩu cho tài khoản quản trị <b>${ten}</b>.</p>
<p><a href="${link}" style="display:inline-block;padding:10px 18px;background:#b3261e;color:#fff8ef;text-decoration:none;border-radius:2px">Đặt mật khẩu mới</a></p>
<p style="color:#76634f;font-size:14px">Link dùng một lần, hết hạn sau 30 phút. Trang vẫn nằm sau Cloudflare Access: nếu được hỏi, nhập email và mã gửi về hộp thư như mọi lần.<br>Nếu bạn không yêu cầu, bỏ qua thư này; mật khẩu hiện tại không đổi.</p>
</div>`,
    });
    ok = true;
  } catch (e) {
    loi = String((e as Error)?.message ?? e).slice(0, 300);
    console.warn(`dat-lai: gửi thư lỗi (${loi.slice(0, 120)})`);
  }
  await ghiNhatKyHeThong(env, tk, { ok, loi });
}

async function ghiNhatKyHeThong(env: Env, tk: { ten: string; vai_tro: string }, chiTiet: Record<string, unknown>): Promise<void> {
  // Người làm là chính tài khoản được yêu cầu (chưa đăng nhập); không ghi email vào nhật ký.
  await env.DB.prepare("INSERT INTO qt_nhat_ky (luc, nguoi, vai_tro, hanh_dong, doi_tuong, chi_tiet) VALUES (?, ?, ?, 'phien.gui_dat_lai', ?, ?)")
    .bind(Date.now(), tk.ten, tk.vai_tro, tk.ten, JSON.stringify(chiTiet))
    .run();
}

export type KetQuaDatLai = { ok: true; ten: string; vai_tro: string } | { ok: false; status: 400 | 403; loi: string };

/** Đặt mật khẩu mới bằng token trong link. Token sai, đã dùng hay hết hạn đều trả cùng một câu. */
export async function datLaiBangToken(env: Env, token: string, moi: string): Promise<KetQuaDatLai> {
  const hong = { ok: false as const, status: 400 as const, loi: "Link đặt lại không còn dùng được (sai, đã dùng hoặc quá 30 phút). Xin link mới ở màn đăng nhập." };
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return hong;
  const now = Date.now();
  const maBam = await sha256hex(token);
  const r = await env.DB.prepare(
    "SELECT d.ten, d.het_han, d.da_dung, t.vai_tro, t.khoa FROM qt_dat_lai d JOIN qt_tai_khoan t ON t.ten = d.ten WHERE d.ma_bam = ?",
  )
    .bind(maBam)
    .first<{ ten: string; het_han: number; da_dung: number; vai_tro: string; khoa: number }>();
  if (!r || r.da_dung === 1 || r.het_han <= now) return hong;
  if (r.khoa === 1) return { ok: false, status: 403, loi: "Tài khoản này đã bị Admin khóa; đặt lại mật khẩu không mở khóa được." };
  const l = loiMatKhauMoi(r.ten, moi);
  if (l) return { ok: false, status: 400, loi: l };
  await env.DB.batch([
    env.DB.prepare("UPDATE qt_tai_khoan SET mat_khau = ?, phai_doi = 0, sai_lien_tiep = 0, tam_khoa_den = NULL, doi_mat_khau_luc = ? WHERE ten = ?").bind(
      await bamMatKhau(moi),
      now,
      r.ten,
    ),
    // Mọi link của tài khoản này hết dùng, mọi phiên bị đăng xuất.
    env.DB.prepare("UPDATE qt_dat_lai SET da_dung = 1 WHERE ten = ?").bind(r.ten),
    env.DB.prepare("DELETE FROM qt_phien WHERE ten = ?").bind(r.ten),
    env.DB.prepare("DELETE FROM qt_dat_lai WHERE het_han < ?").bind(now - 7 * 86400 * 1000),
  ]);
  return { ok: true, ten: r.ten, vai_tro: r.vai_tro };
}

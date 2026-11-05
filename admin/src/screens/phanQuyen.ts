// Phân quyền (chỉ Admin): email nào là Admin, email nào là Vận hành. Admin gốc (ADMIN_GOC) sửa trong wrangler.jsonc.
// Cổng vào admin là ứng dụng Access riêng: email mới phải có trong policy đó (tự đồng bộ hoặc dán tay).

import type { DongBo, DsVaiTro, VaiTro } from "../../shared/hopDong.ts";
import { TEN_VAI_TRO } from "../../shared/hopDong.ts";
import { api } from "../api.ts";
import { esc, gio, toast, voiNut, xacNhan } from "../ui.ts";
import type { Man } from "./man.ts";
import { baoDongBo, chep, khoiAccess } from "./nguoiChoi.ts";

export const manPhanQuyen: Man = {
  id: "phan-quyen",
  ten: "Phân quyền",
  mo_ta: "Chỉ Admin · ai là Admin, ai là Vận hành",
  chiAdmin: true,
  async ve(el, ctx) {
    let ds = await api.get<DsVaiTro>("/api/vai-tro");
    if (!ctx.conHieuLuc()) return;
    const tai = async () => {
      ds = await api.get<DsVaiTro>("/api/vai-tro");
      if (ctx.conHieuLuc()) ve();
    };

    const ve = () => {
      el.innerHTML = `<div class="panel"><div class="cols">
        <div class="col">
          <section class="card primary"><h2>Thêm hoặc đổi vai trò</h2>
            <form class="form" data-them>
              <div class="row2">
                <label class="f"><span>Email</span><input type="email" name="email" required autocomplete="off"></label>
                <label class="f"><span>Vai trò</span><select name="vai_tro"><option value="van_hanh">Vận hành</option><option value="admin">Admin</option></select></label>
              </div>
              <label class="f"><span>Ghi chú</span><input type="text" name="ghi_chu" maxlength="200" placeholder="ví dụ: trực phản hồi buổi tối"></label>
              <div class="btns"><button class="seal" type="submit">Lưu vai trò</button></div>
            </form>
          </section>
          <section class="card"><h2>Hai vai trò</h2>
            <dl style="margin:0;display:grid;gap:6px">
              <dt><b>Admin</b></dt><dd style="margin:0" class="muted">Làm được mọi việc: mời, khóa, bỏ mời người chơi; cấu hình sống; phân quyền; cùng mọi việc của Vận hành.</dd>
              <dt><b>Vận hành</b></dt><dd style="margin:0" class="muted">Xem số liệu và sự kiện, ghi chú người chơi, đăng và gỡ thông báo, xử lý phản hồi, xem nhật ký. Không vào Cấu hình sống và Phân quyền (server trả 403).</dd>
            </dl>
          </section>
          <section class="card"><h2>Đang có quyền <span class="right">${ds.dong.length} email</span></h2>
            <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Email</th><th>Vai trò</th><th>Thêm bởi</th><th></th></tr></thead><tbody>
            ${ds.dong
              .map(
                (r) => `<tr data-email="${esc(r.email)}"><td><span class="email">${esc(r.email)}</span>${r.ghi_chu ? `<br><span class="muted">${esc(r.ghi_chu)}</span>` : ""}</td>
                <td><span class="chip ${r.vai_tro === "admin" ? "son" : "info"}">${TEN_VAI_TRO[r.vai_tro]}${r.goc ? " gốc" : ""}</span></td>
                <td>${r.goc ? `<span class="muted">wrangler.jsonc</span>` : `${esc(r.them_boi ?? "")}<br><span class="muted">${gio(r.them_luc)}</span>`}</td>
                <td>${
                  r.goc || r.email === ctx.toi.email
                    ? `<span class="muted">${r.goc ? "sửa ADMIN_GOC" : "là bạn"}</span>`
                    : `<div class="btns" style="flex-wrap:nowrap;justify-content:flex-end"><button class="btn small" type="button" data-doi="${r.vai_tro === "admin" ? "van_hanh" : "admin"}">Đổi sang ${TEN_VAI_TRO[r.vai_tro === "admin" ? "van_hanh" : "admin"]}</button><button class="btn small danger" type="button" data-xoa>Thu quyền</button></div>`
                }</td></tr>`,
              )
              .join("")}
            </tbody></table></div>
          </section>
        </div>
        <div class="col"><section class="card">${khoiAccess(ds.dong_bo, ds.danh_sach_access, true, "admin")}</section></div>
      </div></div>`;
    };

    const luu = async (btn: HTMLButtonElement | null, email: string, vai_tro: VaiTro, ghi_chu?: string) =>
      voiNut(btn, async () => {
        const r = await api.post<{ dong_bo: DongBo }>("/api/vai-tro", { email, vai_tro, ghi_chu });
        toast(`${email} là ${TEN_VAI_TRO[vai_tro]}. ${baoDongBo(r.dong_bo)}`, r.dong_bo.da_noi && r.dong_bo.ok === false);
        await tai();
      });

    el.addEventListener("submit", async (e) => {
      const f = e.target as HTMLFormElement;
      if (!f.matches("[data-them]")) return;
      e.preventDefault();
      const fd = new FormData(f);
      await luu(f.querySelector("button"), String(fd.get("email") ?? "").trim(), fd.get("vai_tro") as VaiTro, String(fd.get("ghi_chu") ?? ""));
    });
    el.addEventListener("click", async (e) => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>("button");
      if (!b) return;
      if (b.matches("[data-chep]")) return chep(ds.danh_sach_access);
      if (b.matches("[data-dong-bo]")) {
        await voiNut(b, async () => {
          const r = await api.post<DongBo>("/api/access/dong-bo", { nhom: "quan_tri" });
          toast(baoDongBo(r), r.ok === false);
          await tai();
        });
        return;
      }
      const email = b.closest<HTMLElement>("[data-email]")?.dataset.email;
      if (!email) return;
      if (b.dataset.doi) {
        const vt = b.dataset.doi as VaiTro;
        const ok = await xacNhan("Đổi vai trò", `<b>${esc(email)}</b> thành <b>${TEN_VAI_TRO[vt]}</b>. Có hiệu lực từ yêu cầu kế tiếp của người đó.`, "Đổi");
        if (ok) await luu(b, email, vt);
      }
      if (b.matches("[data-xoa]")) {
        const ok = await xacNhan("Thu quyền", `Thu quyền của <b>${esc(email)}</b>. Admin chặn email này ngay từ yêu cầu kế tiếp${ds.dong_bo.da_noi ? " và bỏ khỏi Access group" : "; nhớ bỏ email khỏi policy Access của admin"}.`, "Thu quyền");
        if (!ok) return;
        await voiNut(b, async () => {
          const r = await api.post<{ dong_bo: DongBo }>("/api/vai-tro/xoa", { email });
          toast(`Đã thu quyền ${email}. ${baoDongBo(r.dong_bo)}`, r.dong_bo.da_noi && r.dong_bo.ok === false);
          await tai();
        });
      }
    });

    ve();
  },
};

// Tài khoản quản trị (chỉ Admin): ai là Admin, ai là Vận hành; tạo tài khoản, đặt lại mật khẩu, khóa, xóa.
// Mật khẩu tạm chỉ hiện một lần ngay sau khi tạo hoặc đặt lại; người nhận phải đổi ở lần đăng nhập đầu.
// Server chặn: không tự khóa, hạ quyền, xóa chính mình; luôn còn ít nhất một Admin đang hoạt động.

import type { DsTaiKhoan, MatKhauTam, TaiKhoan, VaiTro } from "../../shared/hopDong.ts";
import { TEN_VAI_TRO } from "../../shared/hopDong.ts";
import { api } from "../api.ts";
import { esc, gio, hopThoai, toast, truoc, voiNut, xacNhan } from "../ui.ts";
import type { Man } from "./man.ts";

export const manTaiKhoan: Man = {
  id: "tai-khoan",
  ten: "Tài khoản",
  mo_ta: "Chỉ Admin · ai là Admin, ai là Vận hành",
  chiAdmin: true,
  async ve(el, ctx) {
    let ds = await api.get<DsTaiKhoan>("/api/tai-khoan");
    if (!ctx.conHieuLuc()) return;
    const tai = async () => {
      ds = await api.get<DsTaiKhoan>("/api/tai-khoan");
      if (ctx.conHieuLuc()) ve();
    };

    const ve = () => {
      el.innerHTML = `<div class="panel"><div class="cols">
        <div class="col">
          <section class="card"><h2>Tài khoản <span class="right">${ds.dong.length} tài khoản</span></h2>
            <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Tên đăng nhập</th><th>Vai trò</th><th>Đăng nhập cuối</th><th>Trạng thái</th><th></th></tr></thead><tbody>
            ${ds.dong.map((t) => dong(t, t.ten === ctx.toi.ten)).join("")}
            </tbody></table></div>
          </section>
        </div>
        <div class="col">
          <section class="card primary"><h2>Tạo tài khoản</h2>
            <form class="form" data-tao novalidate>
              <div class="row2">
                <label class="f"><span>Tên đăng nhập</span><input type="text" name="ten" required autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="vd. vanhanh.lan"><small>3–32 ký tự: chữ thường không dấu, số, . _ -</small></label>
                <label class="f"><span>Vai trò</span><select name="vai_tro"><option value="van_hanh">Vận hành</option><option value="admin">Admin</option></select></label>
              </div>
              <label class="f"><span>Ghi chú</span><input type="text" name="ghi_chu" maxlength="200" placeholder="vd. trực phản hồi buổi tối"></label>
              <div class="btns"><button class="seal" type="submit">Tạo và lấy mật khẩu tạm</button></div>
            </form>
          </section>
          <section class="card"><h2>Hai vai trò</h2>
            <dl style="margin:0;display:grid;gap:6px">
              <dt><b>Admin</b></dt><dd style="margin:0" class="muted">Làm được mọi việc: link mời, khóa người chơi, cấu hình sống, tài khoản; cùng mọi việc của Vận hành.</dd>
              <dt><b>Vận hành</b></dt><dd style="margin:0" class="muted">Xem số liệu và sự kiện, chép link mời, ghi chú người chơi, đăng và gỡ thông báo, xử lý phản hồi, xem nhật ký. Không vào Cấu hình sống và Tài khoản (server trả 403).</dd>
            </dl>
            <p class="note">Mật khẩu tạm chỉ hiện một lần. Gửi cho người nhận qua kênh riêng; lần đăng nhập đầu họ phải đặt mật khẩu của mình.</p>
          </section>
        </div>
      </div></div>`;
    };

    const hienMatKhau = (r: MatKhauTam, viec: string) =>
      hopThoai(
        `${viec}: ${r.ten}`,
        `<p style="margin:0">Mật khẩu tạm (chỉ hiện lần này):</p>
         <input type="text" readonly value="${esc(r.mat_khau_tam)}" aria-label="Mật khẩu tạm" style="font-family:ui-monospace,Consolas,monospace;font-size:18px;letter-spacing:.04em">
         <p class="note">Gửi cho người nhận qua kênh riêng (không dán vào nhóm chat chung). Lần đăng nhập đầu họ phải đổi mật khẩu.</p>
         <div class="btns"><button class="seal" type="button" data-chep>Chép mật khẩu</button><button class="btn" type="button" data-dong>Đã ghi lại</button></div>`,
        (d) => {
          d.querySelector("[data-chep]")!.addEventListener("click", async () => {
            try {
              await navigator.clipboard.writeText(r.mat_khau_tam);
              toast("Đã chép mật khẩu tạm.");
            } catch {
              d.querySelector<HTMLInputElement>("input")!.select();
            }
          });
          d.querySelector<HTMLInputElement>("input")!.addEventListener("focus", (e) => (e.target as HTMLInputElement).select());
        },
      );

    el.addEventListener("submit", async (e) => {
      const f = e.target as HTMLFormElement;
      if (!f.matches("[data-tao]")) return;
      e.preventDefault();
      const fd = new FormData(f);
      await voiNut(f.querySelector("button"), async () => {
        const r = await api.post<MatKhauTam>("/api/tai-khoan", {
          ten: String(fd.get("ten") ?? "").trim().toLowerCase(),
          vai_tro: fd.get("vai_tro"),
          ghi_chu: String(fd.get("ghi_chu") ?? ""),
        });
        f.reset();
        await tai();
        hienMatKhau(r, "Đã tạo tài khoản");
      });
    });

    el.addEventListener("click", async (e) => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>("button");
      const ten = b?.closest<HTMLElement>("[data-ten]")?.dataset.ten;
      const t = ds.dong.find((x) => x.ten === ten);
      if (!b || !t) return;
      if (b.matches("[data-doi]")) {
        const vt = b.dataset.doi as VaiTro;
        const ok = await xacNhan("Đổi vai trò", `<b>${esc(t.ten)}</b> thành <b>${TEN_VAI_TRO[vt]}</b>. Có hiệu lực từ yêu cầu kế tiếp của người đó.`, "Đổi");
        if (!ok) return;
        await voiNut(b, async () => {
          await api.post("/api/tai-khoan/sua", { ten: t.ten, vai_tro: vt, ghi_chu: t.ghi_chu });
          toast(`${t.ten} là ${TEN_VAI_TRO[vt]}.`);
          await tai();
        });
      } else if (b.matches("[data-email]")) {
        hopThoai(
          `Email của ${t.ten}`,
          `<form class="form" novalidate>
            <label class="f"><span>Email nhận link đặt lại mật khẩu</span><input type="email" name="email" value="${esc(t.email ?? "")}" autocomplete="off"><small>Để trống rồi lưu là bỏ email.</small></label>
            <p class="note block">Gói miễn phí của Cloudflare chỉ gửi được tới địa chỉ đã xác nhận ở Email Routing: thêm email này ở đó (\`wrangler email routing addresses create <email>\`) và bấm link xác nhận trong thư, nếu không thư đặt lại sẽ không tới.</p>
            <div class="btns"><button class="seal" type="submit">Lưu</button><button class="btn" type="button" data-dong>Thôi</button></div>
          </form>`,
          (d) => {
            const f = d.querySelector("form")!;
            f.addEventListener("submit", async (ev) => {
              ev.preventDefault();
              await voiNut(f.querySelector<HTMLButtonElement>(".seal"), async () => {
                await api.post("/api/tai-khoan/sua", { ten: t.ten, vai_tro: t.vai_tro, ghi_chu: t.ghi_chu, email: String(new FormData(f).get("email") ?? "") });
                d.close();
                toast(`Đã lưu email của ${t.ten}.`);
                await tai();
              });
            });
          },
        );
      } else if (b.matches("[data-dat-lai]")) {
        const ok = await xacNhan("Đặt lại mật khẩu", `Tạo mật khẩu tạm mới cho <b>${esc(t.ten)}</b> và đăng xuất mọi phiên của tài khoản này.`, "Đặt lại");
        if (!ok) return;
        await voiNut(b, async () => {
          const r = await api.post<MatKhauTam>("/api/tai-khoan/dat-lai", { ten: t.ten });
          await tai();
          hienMatKhau(r, "Đã đặt lại mật khẩu");
        });
      } else if (b.matches("[data-khoa]")) {
        const khoa = !t.khoa;
        const ok = await xacNhan(khoa ? "Khóa tài khoản" : "Mở khóa tài khoản", khoa ? `Khóa <b>${esc(t.ten)}</b>: đăng xuất ngay mọi phiên, không đăng nhập lại được tới khi mở khóa.` : `Mở khóa <b>${esc(t.ten)}</b>.`, khoa ? "Khóa" : "Mở khóa");
        if (!ok) return;
        await voiNut(b, async () => {
          await api.post("/api/tai-khoan/khoa", { ten: t.ten, khoa });
          toast(khoa ? `Đã khóa ${t.ten}.` : `Đã mở khóa ${t.ten}.`);
          await tai();
        });
      } else if (b.matches("[data-xoa]")) {
        const ok = await xacNhan("Xóa tài khoản", `Xóa hẳn <b>${esc(t.ten)}</b>. Nhật ký cũ vẫn giữ tên này.`, "Xóa");
        if (!ok) return;
        await voiNut(b, async () => {
          await api.post("/api/tai-khoan/xoa", { ten: t.ten });
          toast(`Đã xóa ${t.ten}.`);
          await tai();
        });
      }
    });

    ve();
  },
};

function dong(t: TaiKhoan, laToi: boolean): string {
  const khac: VaiTro = t.vai_tro === "admin" ? "van_hanh" : "admin";
  const tt = t.khoa
    ? `<span class="chip son">Khóa</span>`
    : t.tam_khoa_den
      ? `<span class="chip warn" title="Sai mật khẩu nhiều lần">Tạm khóa tới ${gio(t.tam_khoa_den)}</span>`
      : t.phai_doi
        ? `<span class="chip warn">Chờ đổi mật khẩu</span>`
        : `<span class="chip ok">Hoạt động</span>`;
  return `<tr data-ten="${esc(t.ten)}" class="${t.khoa ? "khoa" : ""}">
    <td><span class="email">${esc(t.ten)}</span>${laToi ? ` <span class="muted">(bạn)</span>` : ""}${t.ghi_chu ? `<br><span class="muted">${esc(t.ghi_chu)}</span>` : ""}<br><span class="muted">${t.email ? `email ${esc(t.email)}` : "chưa có email đặt lại"}</span><br><span class="muted">tạo bởi ${esc(t.tao_boi)} ${gio(t.tao_luc)}</span></td>
    <td><span class="chip ${t.vai_tro === "admin" ? "son" : "info"}">${TEN_VAI_TRO[t.vai_tro]}</span></td>
    <td class="nowrap" title="${gio(t.dang_nhap_cuoi)}">${t.dang_nhap_cuoi ? esc(truoc(t.dang_nhap_cuoi)) : "chưa"}${t.so_phien ? `<br><span class="muted">${t.so_phien} phiên đang mở</span>` : ""}</td>
    <td>${tt}</td>
    <td>${
      laToi
        ? `<span class="muted">Đổi mật khẩu, email ở thanh bên</span>`
        : `<div class="btns" style="justify-content:flex-end;min-width:15rem">
        <button class="btn small" type="button" data-doi="${khac}">Sang ${TEN_VAI_TRO[khac]}</button>
        <button class="btn small" type="button" data-dat-lai>Đặt lại mật khẩu</button>
        <button class="btn small" type="button" data-email>Email</button>
        <button class="btn small ${t.khoa ? "" : "danger"}" type="button" data-khoa>${t.khoa ? "Mở khóa" : "Khóa"}</button>
        <button class="btn small danger" type="button" data-xoa>Xóa</button></div>`
    }</td></tr>`;
}

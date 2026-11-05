// Màn đăng nhập (tên + mật khẩu) và màn đổi mật khẩu (bắt buộc ở lần đầu, hoặc tự đổi từ thanh bên).
// Cùng tấm giấy khung đỏ mảnh với các màn khác; dấu ấn son của Thiên Hoang Ký (assets/brand, không chữ).

import type { Toi } from "../shared/hopDong.ts";
import { api } from "./api.ts";
import { esc, hopThoai, toast } from "./ui.ts";

const DAU = `<img class="an lon" src="/dau_an_256.png" alt="" width="64" height="64">`;

export function veDangNhap(app: HTMLElement, xong: (t: Toi) => void, bao?: string): void {
  app.innerHTML = `<div class="dang-nhap"><form class="panel form" novalidate>
      <div class="brand">${DAU}<span><b>Thiên Hoang Ký</b><small>Quản trị · chơi thử kín</small></span></div>
      ${bao ? `<p class="note block">${esc(bao)}</p>` : ""}
      <label class="f"><span>Tên đăng nhập</span><input type="text" name="ten" autocomplete="username" autocapitalize="none" spellcheck="false" required></label>
      <label class="f"><span>Mật khẩu</span><input type="password" name="mat_khau" autocomplete="current-password" required></label>
      <p class="loi-dn" role="alert" hidden></p>
      <button class="seal" type="submit">Đăng nhập</button>
      <p class="muted" style="margin:0">Quên mật khẩu: nhờ Admin khác đặt lại ở màn Tài khoản.</p>
    </form></div>`;
  const f = app.querySelector("form")!;
  const loiEl = f.querySelector<HTMLElement>(".loi-dn")!;
  f.querySelector<HTMLInputElement>("input[name=ten]")!.focus();
  f.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(f);
    const ten = String(fd.get("ten") ?? "").trim();
    const mk = String(fd.get("mat_khau") ?? "").trim();
    if (!ten || !mk) return void ((loiEl.textContent = "Nhập tên đăng nhập và mật khẩu."), (loiEl.hidden = false));
    const nut = f.querySelector<HTMLButtonElement>("button")!;
    nut.disabled = true;
    try {
      const t = await api.post<Toi>("/api/dang-nhap", { ten, mat_khau: mk });
      xong(t);
    } catch (err) {
      loiEl.textContent = (err as Error).message;
      loiEl.hidden = false;
      f.querySelector<HTMLInputElement>("input[name=mat_khau]")!.value = "";
    } finally {
      nut.disabled = false;
    }
  });
}

function formDoi(batBuoc: boolean): string {
  return `<form class="form" novalidate>
    ${batBuoc ? `<p class="note block">Đây là lần đăng nhập đầu, hoặc mật khẩu vừa được đặt lại. Đặt mật khẩu của riêng bạn để tiếp tục.</p>` : ""}
    <label class="f"><span>${batBuoc ? "Mật khẩu tạm" : "Mật khẩu hiện tại"}</span><input type="password" name="cu" autocomplete="current-password" required></label>
    <label class="f"><span>Mật khẩu mới</span><input type="password" name="moi" autocomplete="new-password" minlength="12" required><small>Ít nhất 12 ký tự, không chứa tên đăng nhập. Một câu dài dễ nhớ là tốt.</small></label>
    <label class="f"><span>Nhập lại mật khẩu mới</span><input type="password" name="lai" autocomplete="new-password" required></label>
    <p class="loi-dn" role="alert" hidden></p>
    <div class="btns"><button class="seal" type="submit">Đổi mật khẩu</button>${batBuoc ? "" : `<button class="btn" type="button" data-dong>Thôi</button>`}</div>
  </form>`;
}

function ganDoi(f: HTMLFormElement, xong: () => void): void {
  const loiEl = f.querySelector<HTMLElement>(".loi-dn")!;
  const bao = (m: string) => ((loiEl.textContent = m), (loiEl.hidden = false));
  f.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(f);
    const cu = String(fd.get("cu") ?? "").trim();
    const moi = String(fd.get("moi") ?? "").trim();
    if (moi.length < 12) return bao("Mật khẩu mới dài ít nhất 12 ký tự.");
    if (moi !== String(fd.get("lai") ?? "").trim()) return bao("Hai lần nhập mật khẩu mới không giống nhau.");
    const nut = f.querySelector<HTMLButtonElement>(".seal")!;
    nut.disabled = true;
    try {
      await api.post("/api/doi-mat-khau", { cu, moi });
      toast("Đã đổi mật khẩu. Các phiên khác của tài khoản này đã bị đăng xuất.");
      xong();
    } catch (err) {
      bao((err as Error).message);
    } finally {
      nut.disabled = false;
    }
  });
}

/** Màn bắt buộc đổi mật khẩu: thay cả trang, chỉ có đổi hoặc đăng xuất. */
export function veDoiBatBuoc(app: HTMLElement, t: Toi, xong: () => void, dangXuat: () => void): void {
  app.innerHTML = `<div class="dang-nhap"><div class="panel">
      <div class="brand">${DAU}<span><b>Đổi mật khẩu</b><small>Tài khoản ${esc(t.ten)}</small></span></div>
      ${formDoi(true)}
      <button class="link" type="button" data-thoat>Đăng xuất</button>
    </div></div>`;
  ganDoi(app.querySelector("form")!, xong);
  app.querySelector("[data-thoat]")!.addEventListener("click", dangXuat);
  app.querySelector<HTMLInputElement>("input[name=cu]")!.focus();
}

/** Tự đổi mật khẩu từ thanh bên. */
export function moDoiMatKhau(): void {
  hopThoai("Đổi mật khẩu", formDoi(false), (d) => ganDoi(d.querySelector("form")!, () => d.close()));
}

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
      <button class="link" type="button" data-quen style="justify-self:start">Quên mật khẩu?</button>
    </form></div>`;
  app.querySelector("[data-quen]")!.addEventListener("click", () => veQuenMatKhau(app, xong));
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

/** Quên mật khẩu: nhập tên đăng nhập, server luôn trả cùng một câu (không lộ tên nào có email). */
function veQuenMatKhau(app: HTMLElement, xong: (t: Toi) => void): void {
  app.innerHTML = `<div class="dang-nhap"><form class="panel form" novalidate>
      <div class="brand">${DAU}<span><b>Quên mật khẩu</b><small>Gửi link đặt lại qua email</small></span></div>
      <p class="note block">Tài khoản đã có email (Admin đặt ở màn Tài khoản, hoặc bạn tự đặt ở thanh bên) sẽ nhận link đặt lại, dùng một lần trong 30 phút. Chưa có email thì nhờ Admin khác đặt lại ở màn Tài khoản.</p>
      <label class="f"><span>Tên đăng nhập</span><input type="text" name="ten" autocomplete="username" autocapitalize="none" spellcheck="false" required></label>
      <p class="loi-dn" role="alert" hidden></p>
      <p class="note block" data-da-gui hidden></p>
      <button class="seal" type="submit">Gửi link đặt lại</button>
      <button class="link" type="button" data-ve style="justify-self:start">Về màn đăng nhập</button>
    </form></div>`;
  const f = app.querySelector("form")!;
  const loiEl = f.querySelector<HTMLElement>(".loi-dn")!;
  const daGui = f.querySelector<HTMLElement>("[data-da-gui]")!;
  f.querySelector<HTMLInputElement>("input[name=ten]")!.focus();
  f.querySelector("[data-ve]")!.addEventListener("click", () => veDangNhap(app, xong));
  f.addEventListener("submit", async (e) => {
    e.preventDefault();
    const ten = String(new FormData(f).get("ten") ?? "").trim();
    if (!ten) return void ((loiEl.textContent = "Nhập tên đăng nhập."), (loiEl.hidden = false));
    const nut = f.querySelector<HTMLButtonElement>(".seal")!;
    nut.disabled = true;
    loiEl.hidden = true;
    try {
      const r = await api.post<{ thong_diep: string }>("/api/quen-mat-khau", { ten });
      daGui.textContent = r.thong_diep;
      daGui.hidden = false;
    } catch (err) {
      loiEl.textContent = (err as Error).message;
      loiEl.hidden = false;
    } finally {
      nut.disabled = false;
    }
  });
}

/** Trang /dat-lai#<token> mở từ thư: đặt mật khẩu mới. Token đã được khung bỏ khỏi thanh địa chỉ trước khi gọi hàm này. */
export function veDatLai(app: HTMLElement, token: string): void {
  app.innerHTML = `<div class="dang-nhap"><form class="panel form" novalidate>
      <div class="brand">${DAU}<span><b>Đặt mật khẩu mới</b><small>Từ link trong email</small></span></div>
      ${token ? "" : `<p class="loi-dn">Link thiếu mã đặt lại. Mở lại đúng link trong thư, hoặc xin link mới ở màn đăng nhập.</p>`}
      <label class="f"><span>Mật khẩu mới</span><input type="password" name="moi" autocomplete="new-password" minlength="12" required><small>Ít nhất 12 ký tự, không chứa tên đăng nhập.</small></label>
      <label class="f"><span>Nhập lại mật khẩu mới</span><input type="password" name="lai" autocomplete="new-password" required></label>
      <p class="loi-dn" role="alert" data-loi hidden></p>
      <button class="seal" type="submit" ${token ? "" : "disabled"}>Đặt mật khẩu</button>
      <a class="link" href="/" style="justify-self:start">Về màn đăng nhập</a>
    </form></div>`;
  const f = app.querySelector("form")!;
  const loiEl = f.querySelector<HTMLElement>("[data-loi]")!;
  const bao = (m: string) => ((loiEl.textContent = m), (loiEl.hidden = false));
  f.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(f);
    const moi = String(fd.get("moi") ?? "").trim();
    if (moi.length < 12) return bao("Mật khẩu mới dài ít nhất 12 ký tự.");
    if (moi !== String(fd.get("lai") ?? "").trim()) return bao("Hai lần nhập mật khẩu mới không giống nhau.");
    const nut = f.querySelector<HTMLButtonElement>(".seal")!;
    nut.disabled = true;
    try {
      await api.post("/api/dat-lai", { ma: token, moi });
      app.innerHTML = `<div class="dang-nhap"><div class="panel form">
          <div class="brand">${DAU}<span><b>Đã đặt mật khẩu mới</b><small>Mọi phiên cũ đã bị đăng xuất</small></span></div>
          <a class="seal" href="/">Đăng nhập</a></div></div>`;
    } catch (err) {
      bao((err as Error).message);
      nut.disabled = false;
    }
  });
}

/** Email nhận link đặt lại của chính mình (thanh bên). Cần mật khẩu hiện tại. */
export function moEmailCuaToi(t: Toi, xong: (email: string | null) => void): void {
  hopThoai(
    "Email nhận link đặt lại",
    `<form class="form" novalidate>
      <p class="muted" style="margin:0">Hiện tại: ${t.email ? `<b>${esc(t.email)}</b>` : "chưa có"}. Để trống rồi lưu là bỏ email.</p>
      <label class="f"><span>Email</span><input type="email" name="email" value="${esc(t.email ?? "")}" autocomplete="email"></label>
      <label class="f"><span>Mật khẩu hiện tại</span><input type="password" name="mat_khau" autocomplete="current-password" required></label>
      <p class="note block">Gói miễn phí của Cloudflare chỉ gửi được tới địa chỉ đã xác nhận ở Email Routing. Email mới phải được thêm ở đó và bấm link xác nhận trong thư thì mới nhận được link đặt lại (admin/README.md).</p>
      <p class="loi-dn" role="alert" hidden></p>
      <div class="btns"><button class="seal" type="submit">Lưu</button><button class="btn" type="button" data-dong>Thôi</button></div>
    </form>`,
    (d) => {
      const f = d.querySelector("form")!;
      const loiEl = f.querySelector<HTMLElement>(".loi-dn")!;
      f.addEventListener("submit", async (e) => {
        e.preventDefault();
        const fd = new FormData(f);
        const nut = f.querySelector<HTMLButtonElement>(".seal")!;
        nut.disabled = true;
        try {
          const r = await api.post<{ email: string | null }>("/api/email-cua-toi", { email: String(fd.get("email") ?? ""), mat_khau: String(fd.get("mat_khau") ?? "") });
          d.close();
          toast(r.email ? "Đã lưu email nhận link đặt lại." : "Đã bỏ email.");
          xong(r.email);
        } catch (err) {
          loiEl.textContent = (err as Error).message;
          loiEl.hidden = false;
        } finally {
          nut.disabled = false;
        }
      });
    },
  );
}

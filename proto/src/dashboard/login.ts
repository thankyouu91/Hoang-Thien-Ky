// Màn đăng nhập (FTUE bước 1, dưới 1 phút): số điện thoại → mã OTP → ngày sinh lần đầu (dưới 16 tuổi thêm người giám hộ).
// Nền là cảnh sơn thủy động tông giấy của lớp three (máy không có WebGL2 thì giữ núi thủy mặc SVG) và dấu ấn Thiên Hoang Ký
// (assets/brand/dau_an.webp: dấu tròn son núi dưới nhật nguyệt, không chữ); chân màn có nhãn tuổi và lời nhắc sức khỏe theo G1.
import { mountScene } from "../three/index.ts";
import { inkwashSvg } from "./art/inkwash.ts";
import { ageOn, GUARDIAN_AGE, maskPhone, normalizePhone, type AuthSource } from "./auth.ts";
import { bindLangSwitch, langSwitch } from "./i18n.ts";
import { esc } from "./ui.ts";

type Step = { kind: "phone" } | { kind: "otp"; phone: string; resendAfter: number; devCode?: string } | { kind: "profile"; phone: string };

export function showLogin(auth: AuthSource, ageLabel: string, onDone: () => void): void {
  const root = document.createElement("div");
  root.id = "login";
  root.innerHTML = `
    <div class="login-art">${inkwashSvg("#f6efdf")}</div>
    <div class="login-top">${langSwitch()}<span class="age-badge" title="Nhãn phân loại độ tuổi">${esc(ageLabel)}</span></div>
    <header class="login-brand">
      <img class="login-seal" src="${import.meta.env.BASE_URL}brand/dau_an.webp" alt="" width="104" height="104">
      <h1>Thiên Hoang Ký</h1>
      <p class="tag">Lập tông, giữ mỏ, ghép công pháp.</p>
    </header>
    <form class="login-card" novalidate></form>
    <footer class="login-foot">Chơi quá 180 phút một ngày sẽ ảnh hưởng xấu đến sức khỏe.</footer>`;
  document.body.append(root);
  bindLangSwitch(root);
  const art = root.querySelector<HTMLElement>(".login-art")!;
  const scene = mountScene(art, "son_thuy", { tone: "giay", linhKhi: true });
  void scene.ready.then((ok) => art.classList.toggle("live", ok));
  const form = root.querySelector<HTMLFormElement>("form")!;
  let step: Step = { kind: "phone" };
  let timer = 0;
  let busy = false;

  const error = (text: string) => {
    const el = form.querySelector(".err");
    if (el) el.textContent = text;
  };

  const render = () => {
    clearInterval(timer);
    if (step.kind === "phone") {
      form.innerHTML = `
        <h2>Đăng nhập</h2>
        <label class="field"><span>Số điện thoại</span>
          <span class="input-row"><span class="prefix">+84</span><input name="phone" type="tel" inputmode="tel" autocomplete="tel-national" placeholder="09x xxx xxxx" required></span>
        </label>
        <p class="err" role="alert"></p>
        <button type="submit" class="primary" disabled>Nhận mã OTP</button>
        <p class="note">Mỗi tài khoản gắn một số điện thoại (quy định trò chơi G1).</p>`;
      const input = form.querySelector<HTMLInputElement>("[name=phone]")!;
      const btn = form.querySelector<HTMLButtonElement>("button")!;
      input.addEventListener("input", () => (btn.disabled = !normalizePhone(input.value)));
      input.focus();
    } else if (step.kind === "otp") {
      const s = step;
      form.innerHTML = `
        <h2>Nhập mã</h2>
        <p class="lead">Mã 6 số đã gửi tới <b>${esc(maskPhone(s.phone))}</b>. <button type="button" class="link" data-back>Đổi số</button></p>
        <label class="field"><span class="sr">Mã OTP</span>
          <input name="code" class="otp" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]*" placeholder="••••••" required>
        </label>
        ${s.devCode ? `<p class="dev">Prototype chưa gửi SMS. Mã thử: <b>${s.devCode}</b></p>` : ""}
        <p class="err" role="alert"></p>
        <button type="submit" class="primary" disabled>Xác nhận</button>
        <button type="button" class="secondary" data-resend disabled></button>`;
      const input = form.querySelector<HTMLInputElement>("[name=code]")!;
      const btn = form.querySelector<HTMLButtonElement>("button[type=submit]")!;
      input.addEventListener("input", () => {
        input.value = input.value.replace(/\D/g, "").slice(0, 6);
        btn.disabled = input.value.length !== 6;
        if (input.value.length === 6) form.requestSubmit();
      });
      const resend = form.querySelector<HTMLButtonElement>("[data-resend]")!;
      const tick = () => {
        const left = Math.ceil((s.resendAfter - Date.now()) / 1000);
        resend.disabled = left > 0;
        resend.textContent = left > 0 ? `Gửi lại sau ${left} giây` : "Gửi lại mã";
      };
      tick();
      timer = window.setInterval(tick, 1000);
      input.focus();
    } else {
      const max = new Date().toISOString().slice(0, 10);
      form.innerHTML = `
        <h2>Ngày sinh</h2>
        <p class="lead">Dùng để áp giới hạn giờ chơi theo độ tuổi.</p>
        <label class="field"><span>Ngày sinh</span><input name="dob" type="date" max="${max}" min="1926-01-01" required></label>
        <fieldset class="guardian" hidden>
          <legend>Người giám hộ</legend>
          <p class="lead">Dưới ${GUARDIAN_AGE} tuổi cần đăng ký bằng thông tin người giám hộ.</p>
          <label class="field"><span>Họ tên</span><input name="gname" autocomplete="off"></label>
          <label class="field"><span>Số điện thoại</span><input name="gphone" type="tel" inputmode="tel" autocomplete="off"></label>
          <label class="check"><input type="checkbox" name="gok"> Người giám hộ đồng ý cho tài khoản này chơi</label>
        </fieldset>
        <p class="err" role="alert"></p>
        <button type="submit" class="primary" disabled>Vào game</button>`;
      const dob = form.querySelector<HTMLInputElement>("[name=dob]")!;
      const box = form.querySelector<HTMLFieldSetElement>(".guardian")!;
      const btn = form.querySelector<HTMLButtonElement>("button[type=submit]")!;
      const ok = form.querySelector<HTMLInputElement>("[name=gok]")!;
      const check = () => {
        const minor = !!dob.value && ageOn(dob.value) < GUARDIAN_AGE;
        box.hidden = !minor;
        btn.disabled = !dob.value || (minor && !ok.checked);
      };
      form.addEventListener("input", check);
      form.addEventListener("change", check);
    }
  };

  form.addEventListener("click", (e) => {
    const t = e.target as HTMLElement;
    if (t.closest("[data-back]")) {
      step = { kind: "phone" };
      render();
    } else if (t.closest("[data-resend]") && step.kind === "otp") {
      const phone = step.phone;
      void auth.requestOtp(phone).then((r) => {
        if (r.ok) {
          step = { kind: "otp", phone, resendAfter: r.resendAfter, devCode: r.devCode };
          render();
        }
      });
    }
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (busy) return;
    busy = true;
    const data = new FormData(form);
    try {
      if (step.kind === "phone") {
        const phone = normalizePhone(String(data.get("phone") ?? ""));
        const r = await auth.requestOtp(String(data.get("phone") ?? ""));
        if (!r.ok || !phone) return error(r.ok ? "Số điện thoại chưa đúng." : r.error);
        step = { kind: "otp", phone, resendAfter: r.resendAfter, devCode: r.devCode };
        render();
      } else if (step.kind === "otp") {
        const r = await auth.verifyOtp(step.phone, String(data.get("code") ?? ""));
        if (!r.ok) return error(r.error);
        if (r.needsProfile) {
          step = { kind: "profile", phone: step.phone };
          render();
        } else finish();
      } else {
        const dob = String(data.get("dob") ?? "");
        const minor = dob && ageOn(dob) < GUARDIAN_AGE;
        const r = await auth.completeProfile(step.phone, dob, minor ? { name: String(data.get("gname") ?? ""), phone: String(data.get("gphone") ?? "") } : undefined);
        if (!r.ok) return error(r.error);
        finish();
      }
    } finally {
      busy = false;
    }
  });

  const finish = () => {
    clearInterval(timer);
    root.classList.add("leaving");
    setTimeout(() => {
      scene.dispose();
      root.remove();
    }, 280);
    onDone();
  };

  render();
}

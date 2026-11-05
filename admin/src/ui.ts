// Tiện ích giao diện: thoát HTML, định dạng giờ và số kiểu Việt Nam, thông báo nổi, hộp thoại.

export function esc(v: unknown): string {
  return String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

const TZ = "Asia/Ho_Chi_Minh";
const fmtGio = new Intl.DateTimeFormat("vi-VN", { timeZone: TZ, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const fmtNgay = new Intl.DateTimeFormat("vi-VN", { timeZone: TZ, day: "2-digit", month: "2-digit" });
const fmtDay = new Intl.DateTimeFormat("vi-VN", { timeZone: TZ, weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" });

export function gio(ms: number | null | undefined): string {
  return ms ? fmtGio.format(new Date(ms)) : "—";
}
export function ngayNgan(iso: string): string {
  return fmtNgay.format(new Date(`${iso}T12:00:00+07:00`));
}
export function ngayDai(iso: string): string {
  return fmtDay.format(new Date(`${iso}T12:00:00+07:00`));
}

/** "3 phút trước", "2 giờ trước", "hôm qua"… cho cột "lần chơi cuối". */
export function truoc(ms: number | null | undefined, now = Date.now()): string {
  if (!ms) return "chưa chơi";
  const s = Math.max(0, Math.round((now - ms) / 1000));
  if (s < 60) return "vừa xong";
  if (s < 3600) return `${Math.floor(s / 60)} phút trước`;
  if (s < 86400) return `${Math.floor(s / 3600)} giờ trước`;
  const d = Math.floor(s / 86400);
  return d === 1 ? "hôm qua" : `${d} ngày trước`;
}

export function pct(tu: number, mau: number): string {
  return mau > 0 ? `${Math.round((tu / mau) * 100)}%` : "—";
}

export const so = new Intl.NumberFormat("vi-VN");

/** Giá trị cho <input type="datetime-local"> theo giờ Việt Nam. */
export function toLocalInput(ms: number): string {
  const d = new Date(ms + 7 * 3600 * 1000);
  return d.toISOString().slice(0, 16);
}
export function fromLocalInput(v: string): number | null {
  if (!v) return null;
  const t = Date.parse(`${v}:00+07:00`);
  return Number.isFinite(t) ? t : null;
}

export function toast(msg: string, loi = false): void {
  let box = document.getElementById("toast");
  if (!box) {
    box = document.createElement("div");
    box.id = "toast";
    box.setAttribute("role", "status");
    document.body.append(box);
  }
  const el = document.createElement("div");
  if (loi) el.className = "loi";
  el.textContent = msg;
  box.append(el);
  setTimeout(() => el.remove(), loi ? 6000 : 3200);
}

/** Hộp thoại khung giấy. Trả về <dialog> đã mở; nội dung gắn sự kiện qua tham số mount. */
export function hopThoai(tieuDe: string, html: string, mount?: (d: HTMLDialogElement) => void): HTMLDialogElement {
  const d = document.createElement("dialog");
  d.className = "dlg";
  d.innerHTML = `<div class="panel"><header><h2>${esc(tieuDe)}</h2><button class="x" type="button" aria-label="Đóng" data-dong>×</button></header>${html}</div>`;
  document.body.append(d);
  d.addEventListener("close", () => d.remove());
  d.addEventListener("click", (e) => {
    const t = e.target as HTMLElement;
    if (t === d || t.closest("[data-dong]")) d.close();
  });
  mount?.(d);
  d.showModal();
  return d;
}

/** Hộp xác nhận cho việc khó hoàn tác (khóa, bỏ mời, thu quyền, gỡ thông báo, đổi cấu hình). */
export function xacNhan(tieuDe: string, cau: string, nut = "Xác nhận", oLyDo?: string): Promise<{ lyDo: string } | null> {
  return new Promise((resolve) => {
    let xong = false;
    const d = hopThoai(
      tieuDe,
      `<p style="margin:0">${cau}</p>
      ${oLyDo ? `<label class="f"><span>${esc(oLyDo)}</span><input type="text" name="ly_do" maxlength="300"></label>` : ""}
      <div class="btns"><button class="seal" type="button" data-ok>${esc(nut)}</button><button class="btn" type="button" data-dong>Thôi</button></div>`,
      (dlg) => {
        dlg.querySelector("[data-ok]")!.addEventListener("click", () => {
          xong = true;
          const lyDo = (dlg.querySelector<HTMLInputElement>("input[name=ly_do]")?.value ?? "").trim();
          dlg.close();
          resolve({ lyDo });
        });
        dlg.addEventListener("close", () => {
          if (!xong) resolve(null);
        });
      },
    );
    d.querySelector<HTMLElement>("[data-ok]")?.focus();
  });
}

export function chipNguon(nguon: "that" | "mau", ten = "bảng sự kiện"): string {
  return nguon === "mau"
    ? `<span class="chip mau" title="Worker game chưa tạo ${esc(ten)} trong D1; số dưới đây là dữ liệu giả cùng dạng.">Dữ liệu mẫu · chưa có ${esc(ten)}</span>`
    : "";
}

/** Khóa nút trong lúc gọi API để không bấm hai lần. */
export async function voiNut<T>(btn: HTMLButtonElement | null, f: () => Promise<T>): Promise<T | undefined> {
  if (btn) btn.disabled = true;
  try {
    return await f();
  } catch (e) {
    toast((e as Error).message, true);
    return undefined;
  } finally {
    if (btn) btn.disabled = false;
  }
}

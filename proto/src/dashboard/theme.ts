// Chủ đề giao diện và lời nhắc sức khỏe.
// - "scroll": khung cuộn giấy ghép từ hình PixelLab (assets/pixellab/ui/), theo GDD mục 15; mặc định.
// - "minimal": bản phẳng tối giản. Lựa chọn lưu trên máy người xem.
import type { AuthSource } from "./auth.ts";

export type Theme = "scroll" | "minimal";
const KEY = "ktlp.theme";

export function theme(): Theme {
  try {
    return localStorage.getItem(KEY) === "minimal" ? "minimal" : "scroll";
  } catch {
    return "scroll";
  }
}

export function applyTheme(t: Theme = theme()): void {
  document.body.classList.toggle("theme-scroll", t === "scroll");
}

export function setTheme(t: Theme): void {
  try {
    localStorage.setItem(KEY, t);
  } catch {
    // Không lưu được thì chỉ đổi cho lần mở này.
  }
  applyTheme(t);
}

/** Lời nhắc nghỉ sau mỗi 30 phút chơi trong ngày (G1, GDD mục 14). */
export const REST_EVERY_MINUTES = 30;

export function startRestReminder(auth: AuthSource): void {
  const key = "ktlp.rest";
  const shown = () => {
    try {
      return Number(sessionStorage.getItem(key) ?? "0");
    } catch {
      return 0;
    }
  };
  const check = () => {
    if (!auth.session() || document.getElementById("rest-reminder")) return;
    const minutes = auth.playedMinutesToday();
    const bucket = Math.floor(minutes / REST_EVERY_MINUTES);
    if (bucket < 1 || bucket <= shown()) return;
    try {
      sessionStorage.setItem(key, String(bucket));
    } catch {
      // bỏ qua
    }
    const el = document.createElement("div");
    el.id = "rest-reminder";
    el.setAttribute("role", "alertdialog");
    el.innerHTML = `<div class="box"><b>Bạn đã chơi ${minutes} phút hôm nay</b>
      <p>Hãy nghỉ mắt, đứng dậy vận động một chút. Chơi quá 180 phút một ngày sẽ ảnh hưởng xấu đến sức khỏe.</p>
      <button type="button">Đã hiểu</button></div>`;
    el.querySelector("button")!.addEventListener("click", () => el.remove());
    document.body.append(el);
  };
  setInterval(check, 30_000);
}

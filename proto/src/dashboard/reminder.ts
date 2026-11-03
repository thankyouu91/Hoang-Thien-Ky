// Lời nhắc sức khỏe sau mỗi 30 phút chơi trong ngày (G1, GDD mục 14).
import type { AuthSource } from "./auth.ts";

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
      // Không lưu được thì lần sau vẫn nhắc lại, chấp nhận được.
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

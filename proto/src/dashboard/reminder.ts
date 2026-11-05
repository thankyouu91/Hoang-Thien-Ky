// Lời nhắc sức khỏe sau mỗi 30 phút chơi trong ngày (G1, GDD mục 14), và chặn chơi khi người dưới 18 tuổi đủ
// 60 phút trong ngày (GDD mục 18: tối đa 60 phút/ngày mỗi game). Bộ đếm thật ở server từ khối M1; bản mẫu đếm trên máy.
import { ADULT_AGE, ageOn, MINOR_DAILY_MINUTES, type AuthSource } from "./auth.ts";

export const REST_EVERY_MINUTES = 30;

/** Hết giờ chơi trong ngày: hộp không đóng được, chỉ có Đăng xuất (đổi sang tài khoản khác vẫn được). */
function showLimit(auth: AuthSource): void {
  if (document.querySelector("#rest-reminder[data-het-gio]")) return;
  document.getElementById("rest-reminder")?.remove();
  const el = document.createElement("div");
  el.id = "rest-reminder";
  el.dataset.hetGio = "";
  el.setAttribute("role", "alertdialog");
  el.innerHTML = `<div class="box"><b>Hôm nay bạn đã chơi đủ ${MINOR_DAILY_MINUTES} phút</b>
    <p>Người dưới ${ADULT_AGE} tuổi chơi tối đa ${MINOR_DAILY_MINUTES} phút mỗi ngày. Hẹn gặp lại bạn vào ngày mai.</p>
    <button type="button">Đăng xuất</button></div>`;
  el.querySelector("button")!.addEventListener("click", () => {
    auth.logout();
    location.reload();
  });
  document.body.append(el);
}

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
    const s = auth.session();
    if (s && ageOn(s.birthDate) < ADULT_AGE && auth.playedMinutesToday() >= MINOR_DAILY_MINUTES) return showLimit(auth);
    if (!s || document.getElementById("rest-reminder")) return;
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
  // Vào lại game sau khi đã hết giờ thì chặn ngay, không đợi 30 giây.
  check();
}

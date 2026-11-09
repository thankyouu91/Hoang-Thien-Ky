// Chơi tiếp sau nhập môn và phanh nhịp lên cấp (f566933, người dùng yêu cầu 2026-11-09 "không lên cấp quá nhanh"):
// bế quan 16q mỗi giờ (q = 10 + 2L), trần 8 giờ mỗi ngày, làm mới lúc 05:00. Đồng hồ giả bắt đầu 08:00 để trần ngày
// không lệch theo giờ chạy bài kiểm; tua giờ như người chơi tắt game rồi quay lại. Tốc độ suy từ tu vi tăng thật.
import { expect, test, type Page } from "@playwright/test";
import { capHienTai, dangNhap, lamTheoHuongDan, MayAnh, moGame, ngaySinhTuoi, q, soThu, THE_FTUE, thanhTrenOnDinh, tongTuVi, tuViHienTai } from "./nguoi-choi.ts";

const BAT_DAU = new Date("2026-11-10T08:00:00+07:00");
/** Tốc độ hợp lệ ở cấp L: 16q, hoặc +20% khi tông giữ linh tuyền (nguonMoi.retreatPerHour). */
const hopLe = (L: number) => [16 * q(L), 16 * q(L) + Math.round(16 * q(L) * 0.2)];

async function moNutBeQuan(page: Page, gio: 1 | 8) {
  const nutNv = page.locator(`${THE_FTUE} [data-f="nv"]`);
  if (await nutNv.isVisible()) await nutNv.click();
  const nut = page.locator(`#sheet [data-f="be_quan"][data-gio="${gio}"], ${THE_FTUE} [data-f="be_quan"][data-gio="${gio}"]`).first();
  await expect(nut, `có nút Bế quan ${gio} giờ (bảng nhiệm vụ hoặc thẻ)`).toBeVisible();
  return nut;
}

async function tong(page: Page) {
  const { cap } = await thanhTrenOnDinh(page);
  return { cap, tong: tongTuVi(cap, await tuViHienTai(page)) };
}

test("bế quan 16q mỗi giờ, trần 8 giờ một ngày, làm mới 05:00", async ({ page }, info) => {
  const anh = new MayAnh(page, info, "choi-tiep");
  await page.clock.install({ time: BAT_DAU });
  await moGame(page);
  await dangNhap(page, { sdt: soThu(51), ngaySinh: ngaySinhTuoi(27) });
  await lamTheoHuongDan(page, anh);
  const dau = await tong(page);
  expect(dau.cap, "hết nhập môn ở cấp 5").toBe(5);

  await (await moNutBeQuan(page, 8)).click();
  await anh.chup("dang-be-quan");
  // Tắt game 8 giờ rồi mở lại (16:01 cùng ngày).
  await page.clock.fastForward("08:01:00");
  await page.reload();
  const sau = await tong(page);
  await anh.chup("sau-8-gio");
  const tocDo = (sau.tong - dau.tong) / 8;
  expect(hopLe(dau.cap), `bế quan 8 giờ ở cấp ${dau.cap} được ${sau.tong - dau.tong} tu vi = ${tocDo}/giờ, phải là 16q`).toContain(tocDo);
  // Phanh: 8 giờ ở cấp 5 không được vượt quá vài cấp (16q × 8 = 128q, ~2–3 cấp ở đầu game).
  expect(sau.cap - dau.cap, "một ngày bế quan ở cấp 5 lên tối đa 3 cấp").toBeLessThanOrEqual(3);

  // Trần 8 giờ: cùng ngày bế quan nữa thì bị từ chối.
  await (await moNutBeQuan(page, 1)).click();
  await expect(page.locator("#toast"), "quá trần 8 giờ trong ngày thì báo").toContainText("đủ 8 giờ");
  await anh.chup("qua-tran-8-gio");

  // Sang ngày mới sau 05:00 (05:02 hôm sau) thì bế quan lại được; 1 giờ theo tốc độ cấp mới.
  await page.keyboard.press("Escape");
  await page.clock.fastForward("13:01:00");
  await page.reload();
  const ngay2 = await tong(page);
  await (await moNutBeQuan(page, 1)).click();
  await expect(page.locator("#toast"), "sau 05:00 hôm sau bế quan lại được").not.toContainText("đủ 8 giờ");
  await page.clock.fastForward("01:01:00");
  await page.reload();
  const sau2 = await tong(page);
  await anh.chup("ngay-moi-be-quan");
  expect(hopLe(ngay2.cap), `1 giờ ở cấp ${ngay2.cap} được ${sau2.tong - ngay2.tong} tu vi, phải là 16q`).toContain(sau2.tong - ngay2.tong);
});

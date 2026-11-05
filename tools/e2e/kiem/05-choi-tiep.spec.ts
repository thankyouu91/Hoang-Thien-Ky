// Chơi tiếp sau nhập môn (yêu cầu "chơi tiếp vài cấp"): hết chương 0 ở cấp 5, bế quan 8 giờ (GDD mục 14: 8 giờ đủ một cấp
// ở Hạ vị), tua đồng hồ 8 giờ như người chơi tắt game rồi quay lại, phải lên cấp 6 và tốc độ bế quan tăng theo cấp.
import { expect, test } from "@playwright/test";
import { capHienTai, dangNhap, lamTheoHuongDan, MayAnh, moGame, ngaySinhTuoi, soThu, THE_FTUE, thanhTrenOnDinh } from "./nguoi-choi.ts";

test("hết nhập môn, bế quan 8 giờ thì lên cấp 6", async ({ page }, info) => {
  const anh = new MayAnh(page, info, "choi-tiep");
  // Đồng hồ giả: chạy như thật, tới lúc cần thì tua (Date, hẹn giờ, khung hình).
  await page.clock.install();
  await moGame(page);
  await dangNhap(page, { sdt: soThu(51), ngaySinh: ngaySinhTuoi(27) });
  await lamTheoHuongDan(page, anh);
  expect(await capHienTai(page), "hết nhập môn ở cấp 5").toBe(5);

  const the = page.locator(THE_FTUE);
  const beQuan8 = the.locator('[data-f="be_quan"][data-gio="8"]');
  await expect(beQuan8, "thẻ đã xong có nút Bế quan 8 giờ để lên cấp tiếp").toBeVisible();
  const tocDo = Number(((await the.innerText()).match(/\+(\d+)\s*tu vi/) ?? [])[1]);
  expect(tocDo, "bế quan cấp 5: 1/8 kinh nghiệm cấp mỗi giờ (E(5) = 910 → 114)").toBe(114);
  await beQuan8.click();
  await expect(page.getByText(/Đang bế quan|Bế quan/).first()).toBeVisible();
  await anh.chup("dang-be-quan");

  // Tắt game 8 giờ rồi mở lại.
  await page.clock.fastForward("08:01:00");
  await page.reload();
  const { cap } = await thanhTrenOnDinh(page);
  await anh.chup("sau-8-gio");
  expect(cap, "bế quan 8 giờ (+912 tu vi) phải lên cấp 6").toBe(6);
  await expect(page.locator("#topbar .xp-ring"), "tu vi dư sang cấp 6").toHaveAttribute("title", /\/\s*1\.?040/);
  await expect(the.locator('[data-f="be_quan"]').first(), "vẫn có nút bế quan để lên tiếp").toBeVisible();
  await expect(the, "tốc độ bế quan cấp 6 = E(6)/8 = 130").toContainText("130");
});

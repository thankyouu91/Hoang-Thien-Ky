// Lưu tiến độ riêng từng người trên máy: tải lại trang giữ nguyên; "Chơi lại từ đầu" về cấp 1 và FTUE bước 2;
// tài khoản khác trên cùng trình duyệt không bị đụng tới.
import { expect, test } from "@playwright/test";
import { buocHienTai, capHienTai, choiLai, dangNhap, HUONG_DAN, lamTheoHuongDan, MayAnh, moGame, ngaySinhTuoi, soThu } from "./nguoi-choi.ts";

test("tải lại trang giữ tiến độ, Chơi lại từ đầu về cấp 1", async ({ page }, info) => {
  const anh = new MayAnh(page, info, "luu-tien-do");
  await moGame(page);
  await dangNhap(page, { sdt: soThu(21), ngaySinh: ngaySinhTuoi(22) });
  await expect(page.locator(`${HUONG_DAN}:visible`).first()).toBeVisible({ timeout: 15_000 });
  // Đi tới hết bước 4 (đã vào tông môn, cấp 2) rồi kiểm.
  await lamTheoHuongDan(page, anh, { den: 4 });
  const cap = await capHienTai(page);
  const buoc = await buocHienTai(page);
  expect(buoc, "đang ở FTUE bước 5").toBe(5);

  await page.reload();
  await expect(page.locator("#login")).toHaveCount(0);
  expect(await capHienTai(page), "tải lại giữ cấp").toBe(cap);
  await expect.poll(() => buocHienTai(page), { message: "tải lại giữ bước FTUE" }).toBe(buoc);

  // Đóng hẳn trình duyệt rồi mở lại (trang mới, cùng bộ nhớ): vẫn như cũ.
  const trang2 = await page.context().newPage();
  await page.close();
  await trang2.goto("/");
  expect(await capHienTai(trang2), "mở lại game giữ cấp").toBe(cap);
  await expect.poll(() => buocHienTai(trang2), { message: "mở lại game giữ bước FTUE" }).toBe(buoc);

  const anh2 = new MayAnh(trang2, info, "choi-lai");
  await choiLai(trang2);
  await anh2.chup("sau-choi-lai");
  await expect.poll(() => capHienTai(trang2), { message: "Chơi lại từ đầu thì về cấp 1" }).toBe(1);
  await expect.poll(() => buocHienTai(trang2), { message: "Chơi lại từ đầu thì FTUE về bước 2" }).toBe(2);
  await trang2.reload();
  expect(await capHienTai(trang2), "chơi lại xong tải lại vẫn cấp 1 (không hồi về bản cũ)").toBe(1);
});

test("hai tài khoản trên cùng máy giữ tiến độ riêng", async ({ page }, info) => {
  const anh = new MayAnh(page, info, "hai-tai-khoan");
  await moGame(page);
  await dangNhap(page, { sdt: soThu(31), ngaySinh: ngaySinhTuoi(28) });
  await expect(page.locator(`${HUONG_DAN}:visible`).first()).toBeVisible({ timeout: 15_000 });
  await lamTheoHuongDan(page, anh, { den: 3 });
  const capA = await capHienTai(page);
  const buocA = await buocHienTai(page);

  // Đăng xuất (màn Nhân vật → Tài khoản → Đăng xuất), vào bằng số khác: phải là người mới.
  page.once("dialog", (d) => void d.accept());
  await page.locator("#topbar .portrait").click();
  const dx = page.locator("[data-act=logout]");
  if (!(await dx.isVisible())) await page.getByText(/^(Tài khoản|Account)$/).first().click();
  await dx.click();
  await expect(page.locator("#login")).toBeVisible();
  await dangNhap(page, { sdt: soThu(32), ngaySinh: ngaySinhTuoi(28) });
  expect(await capHienTai(page), "tài khoản B mới vào ở cấp 1").toBe(1);
  await expect.poll(() => buocHienTai(page), { message: "tài khoản B bắt đầu FTUE bước 2" }).toBe(2);
  await anh.chup("tai-khoan-b");

  // Quay lại tài khoản A: tiến độ còn nguyên.
  page.once("dialog", (d) => void d.accept());
  await page.locator("#topbar .portrait").click();
  if (!(await dx.isVisible())) await page.getByText(/^(Tài khoản|Account)$/).first().click();
  await dx.click();
  await dangNhap(page, { sdt: soThu(31), ngaySinh: ngaySinhTuoi(28) });
  expect(await capHienTai(page), "tài khoản A giữ cấp").toBe(capA);
  await expect.poll(() => buocHienTai(page), { message: "tài khoản A giữ bước FTUE" }).toBe(buocA);
  await anh.chup("tai-khoan-a-quay-lai");
});

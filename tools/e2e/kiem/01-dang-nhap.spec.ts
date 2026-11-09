// FTUE bước 1 (GDD mục 14): đăng nhập dưới 1 phút; người mới vào game ở cấp 1, không phải thế giới mẫu.
import { expect, test } from "@playwright/test";
import { capHienTai, dangNhap, ghiLoiTrang, MayAnh, moGame, ngaySinhTuoi, soThu } from "./nguoi-choi.ts";

test.describe("Đăng nhập người mới", () => {
  test("người lớn: số điện thoại → OTP → ngày sinh → vào game ở cấp 1", async ({ page }, info) => {
    const loi = ghiLoiTrang(page);
    const anh = new MayAnh(page, info, "dang-nhap");
    const t0 = Date.now();
    await moGame(page);
    const tai = (Date.now() - t0) / 1000;
    const login = page.locator("#login");
    await expect(login.locator(".age-badge"), "nhãn tuổi G1 ở màn đăng nhập").toBeVisible();
    await expect(login.locator(".login-foot"), "lời nhắc sức khỏe ở chân màn").toContainText("180");
    await anh.chup("man-dang-nhap");
    // GDD: đăng nhập dưới 1 phút, tính phần người chơi thao tác (không chụp ảnh giữa chừng để khỏi cộng thời gian chụp).
    const t1 = Date.now();
    await dangNhap(page, { sdt: soThu(1), ngaySinh: ngaySinhTuoi(25) });
    const nhap = (Date.now() - t1) / 1000;
    await info.attach("thoi-gian.json", { body: JSON.stringify({ taiTrangGiay: tai, thaoTacGiay: nhap }), contentType: "application/json" });
    expect.soft(tai, "tải trang tới màn đăng nhập dưới 15 giây").toBeLessThan(15);
    expect.soft(nhap, "GDD: đăng nhập dưới 1 phút").toBeLessThan(60);
    await anh.chup("vao-game");
    expect(await capHienTai(page), "người mới phải bắt đầu ở cấp 1").toBe(1);
    expect(loi, "không có lỗi JS").toEqual([]);
  });

  test("dưới 16 tuổi: bắt thông tin người giám hộ, thấy giờ chơi còn lại", async ({ page }, info) => {
    const loi = ghiLoiTrang(page);
    const anh = new MayAnh(page, info, "duoi-16");
    await moGame(page);
    await dangNhap(page, { sdt: soThu(2), ngaySinh: ngaySinhTuoi(12), giamHo: { ten: "Nguyễn Văn Thử", sdt: soThu(3) } }, anh);
    await anh.chup("vao-game");
    await expect(page.locator("#topbar .pill.play"), "dưới 18 tuổi thấy thời gian chơi còn lại (G1)").toBeVisible();
    expect(await capHienTai(page), "người mới phải bắt đầu ở cấp 1").toBe(1);
    expect(loi, "không có lỗi JS").toEqual([]);
  });

  test("ngày sinh quá nhỏ (dưới 6 tuổi) bị từ chối", async ({ page }) => {
    await moGame(page);
    const login = page.locator("#login");
    await login.locator("input[name=phone]").fill(soThu(4));
    await login.locator("button[type=submit]").click();
    const ma = (await login.locator(".dev b").textContent())!.trim();
    await login.locator("input[name=code]").fill(ma);
    await login.locator("input[name=dob]").fill(ngaySinhTuoi(3));
    const gh = login.locator("fieldset.guardian");
    await gh.locator("input[name=gname]").fill("Nguyễn Văn Thử");
    await gh.locator("input[name=gphone]").fill(soThu(5));
    await gh.locator("input[name=gok]").check();
    await login.locator("button[type=submit]").click();
    await expect(login.locator(".err")).not.toBeEmpty();
    await expect(login).toBeVisible();
  });
});

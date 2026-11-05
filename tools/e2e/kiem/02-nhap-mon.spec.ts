// FTUE bước 2–8 và chuỗi nhập môn chinh.0.1–0.7 (KICH_BAN.md): người lớn làm theo thẻ Nhiệm vụ tới hết, tải lại trang
// giữa chừng không mất bước, cuối cùng lên cấp 5, thẻ chỉ tới nhiệm vụ kế, đóng thẻ rồi tải lại không hiện lại FTUE.
import { expect, test } from "@playwright/test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  buocHienTai,
  capHienTai,
  dangNhap,
  ghiLoiTrang,
  lamTheoHuongDan,
  MayAnh,
  moGame,
  ngaySinhTuoi,
  soCau,
  soThu,
  THE_FTUE,
  trangThaiFtue,
} from "./nguoi-choi.ts";

// Cấp tối thiểu sau khi xong mỗi bước FTUE (KICH_BAN.md, cột "Cấp sau bước").
const CAP_SAU_BUOC: Record<number, number> = { 2: 1, 3: 1, 4: 2, 5: 3, 6: 3, 7: 4, 8: 5 };

test("người mới đi hết nhập môn từ cấp 1 tới cấp 5", async ({ page }, info) => {
  const loiTrang = ghiLoiTrang(page);
  const anh = new MayAnh(page, info, "nhap-mon");
  await moGame(page);
  await dangNhap(page, { sdt: soThu(11), ngaySinh: ngaySinhTuoi(25) });
  expect(await capHienTai(page), "vào game ở cấp 1").toBe(1);
  await expect.poll(() => buocHienTai(page), { message: "vào game xong phải hiện ngay thẻ Nhiệm vụ ở FTUE bước 2 (nhiệm vụ 1/7)", timeout: 15_000 }).toBe(2);

  let daTaiLai = false;
  const qua = await lamTheoHuongDan(page, anh, {
    truocMoiBuoc: async (b) => {
      // Tải lại trang ngay đầu bước 5 (đã vào tông môn): phải giữ nguyên bước và cấp.
      if (b !== 5 || daTaiLai) return;
      daTaiLai = true;
      const cap = await capHienTai(page);
      await page.reload();
      await expect(page.locator("#login"), "tải lại trang không bắt đăng nhập lại").toHaveCount(0);
      expect(await capHienTai(page), "tải lại trang giữ cấp").toBe(cap);
      await expect.poll(() => buocHienTai(page), { message: "tải lại trang giữ bước FTUE", timeout: 10_000 }).toBe(5);
      await anh.chup("tai-lai-o-buoc-5");
    },
  });

  // Bảng từng bước gắn vào báo cáo để đọc nhanh.
  await info.attach("cac-buoc.json", { body: JSON.stringify(qua, null, 2), contentType: "application/json" });
  writeFileSync(join("ket-qua", "anh", info.project.name, "nhap-mon", "cac-buoc.json"), JSON.stringify(qua, null, 2));
  expect(qua.map((q) => q.buoc), "đi đủ FTUE bước 2–8 theo thứ tự").toEqual([2, 3, 4, 5, 6, 7, 8]);
  for (const q of qua) {
    expect.soft(soCau(q.loi), `bước ${q.buoc}: hướng dẫn tối đa 2 câu ("${q.loi}")`).toBeLessThanOrEqual(2);
    expect.soft(q.cap, `cấp sau bước ${q.buoc}`).toBeGreaterThanOrEqual(CAP_SAU_BUOC[q.buoc]);
    expect.soft(q.baoLoi, `bước ${q.buoc}: không hiện báo lỗi khi làm đúng hướng dẫn`).toEqual([]);
  }
  const b6 = qua.find((q) => q.buoc === 6);
  const b7 = qua.find((q) => q.buoc === 7);
  if (b6 && b7) expect.soft(b7.linhThach, "chiếm và thu mỏ xong thì linh thạch tăng").toBeGreaterThan(b6.linhThach);

  const cap = await capHienTai(page);
  expect(cap, "hết nhập môn (2.500 kinh nghiệm) phải lên cấp 5").toBeGreaterThanOrEqual(5);
  const the = page.locator(THE_FTUE);
  await expect(the, "thẻ báo đã xong 15 phút đầu").toBeVisible();
  await expect.soft(the, "thẻ đã xong chỉ tới nhiệm vụ kế (chơi tiếp, không ngõ cụt)").toContainText(/Nhiệm vụ kế|Next quest/i);
  await anh.chup("het-nhap-mon");

  // Bước 8: thẻ Lịch hôm nay hiện giờ bí cảnh gần nhất.
  await expect(page.getByText(/12:00|20:00/).first(), "Lịch hôm nay hiện giờ bí cảnh").toBeVisible();

  // Đóng thẻ, tải lại: không hiện lại FTUE, cấp giữ nguyên.
  await the.locator('[data-f="an"]').click();
  await expect(the).toHaveCount(0);
  await page.reload();
  expect(await capHienTai(page)).toBe(cap);
  await page.waitForTimeout(1500);
  const st = await trangThaiFtue(page);
  expect(st.buoc, "tải lại sau khi xong không hiện lại bước FTUE nào").toBeNull();
  await anh.chup("sau-khi-dong-the");
  expect(loiTrang, "không có lỗi JS suốt lượt chơi").toEqual([]);
});

test("chạm lung tung ngoài hướng dẫn không làm kẹt FTUE", async ({ page }, info) => {
  const anh = new MayAnh(page, info, "cham-lung-tung");
  const loiTrang = ghiLoiTrang(page);
  await moGame(page);
  await dangNhap(page, { sdt: soThu(12), ngaySinh: ngaySinhTuoi(30) });
  await expect.poll(() => buocHienTai(page), { timeout: 15_000 }).toBe(2);
  // Người mới hay bấm thử các tab dưới trước khi đọc hướng dẫn.
  for (const b of await page.locator("#tabbar button").all()) {
    if (await b.isVisible()) {
      await b.click();
      await page.waitForTimeout(400);
      await anh.chup(`tab-${(await b.innerText()).trim().replace(/\s+/g, "-")}`);
    }
  }
  await page.locator("#tabbar button").first().click();
  await expect.poll(() => buocHienTai(page), { message: "bấm các tab xong vẫn còn thẻ Nhiệm vụ, đúng bước cũ", timeout: 10_000 }).toBe(2);
  await expect(page.locator(`${THE_FTUE} [data-f="lam"]`), "vẫn còn nút làm bước kế").toBeVisible();
  // Thu gọn rồi mở lại thẻ.
  const gon = page.locator(`${THE_FTUE} [data-f="gon"]`);
  if (await gon.isVisible()) {
    await gon.click();
    await expect(page.locator(`${THE_FTUE} .ftue-pill`), "thu gọn thẻ còn viên nhỏ").toBeVisible();
    await page.locator(`${THE_FTUE} .ftue-pill`).click();
    await expect(page.locator(`${THE_FTUE} [data-f="lam"]`)).toBeVisible();
  }
  expect(loiTrang, "không có lỗi JS").toEqual([]);
});

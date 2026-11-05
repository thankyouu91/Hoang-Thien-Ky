// FTUE bước 2–8 và chuỗi nhập môn chinh.0.1–0.7 (KICH_BAN.md): người lớn làm theo hướng dẫn tới hết, tải lại trang
// giữa chừng không mất bước, cuối cùng lên cấp 5 và chơi tiếp được nhiệm vụ chính kế tiếp.
import { expect, test } from "@playwright/test";
import {
  buocHienTai,
  capHienTai,
  dangNhap,
  DICH,
  ghiLoiTrang,
  HUONG_DAN,
  lamTheoHuongDan,
  MayAnh,
  moGame,
  ngaySinhTuoi,
  soCau,
  soThu,
} from "./nguoi-choi.ts";

// Cấp tối thiểu sau khi xong mỗi bước FTUE (KICH_BAN.md, cột "Cấp sau bước").
const CAP_SAU_BUOC: Record<number, number> = { 1: 1, 2: 1, 3: 1, 4: 2, 5: 3, 6: 3, 7: 4, 8: 5 };

test("người mới đi hết nhập môn từ cấp 1 tới cấp 5", async ({ page }, info) => {
  const loiTrang = ghiLoiTrang(page);
  const anh = new MayAnh(page, info, "nhap-mon");
  await moGame(page);
  await dangNhap(page, { sdt: soThu(11), ngaySinh: ngaySinhTuoi(25) });
  expect(await capHienTai(page), "vào game ở cấp 1").toBe(1);
  await expect(page.locator(`${HUONG_DAN}:visible`).first(), "vào game xong phải hiện ngay hướng dẫn FTUE bước 2").toBeVisible({ timeout: 15_000 });
  expect(await buocHienTai(page), "FTUE bước 1 (đăng nhập) đã xong, khung đầu tiên là bước 2").toBe(2);

  let daTaiLai = false;
  const qua = await lamTheoHuongDan(page, anh, {
    truocMoiBuoc: async (b) => {
      // Tải lại trang ngay đầu bước 5 (sau khi đã vào tông môn): phải giữ nguyên bước và cấp.
      if (b !== 5 || daTaiLai) return;
      daTaiLai = true;
      const cap = await capHienTai(page);
      await page.reload();
      await expect(page.locator("#login"), "tải lại trang không bắt đăng nhập lại").toHaveCount(0);
      expect(await capHienTai(page), "tải lại trang giữ cấp").toBe(cap);
      await expect.poll(() => buocHienTai(page), { message: "tải lại trang giữ bước FTUE" }).toBe(5);
      await anh.chup("tai-lai-o-buoc-5");
    },
  });

  // Bảng từng bước gắn vào báo cáo để đọc nhanh.
  await info.attach("cac-buoc.json", { body: JSON.stringify(qua, null, 2), contentType: "application/json" });
  expect(qua.map((q) => q.buoc), "đi đủ FTUE bước 2–8 theo thứ tự").toEqual([2, 3, 4, 5, 6, 7, 8]);
  for (const q of qua) {
    expect.soft(soCau(q.loi), `bước ${q.buoc}: hướng dẫn tối đa 2 câu ("${q.loi}")`).toBeLessThanOrEqual(2);
    expect.soft(q.cap, `cấp sau bước ${q.buoc}`).toBeGreaterThanOrEqual(CAP_SAU_BUOC[q.buoc]);
  }
  const b7 = qua.find((q) => q.buoc === 7);
  const b6 = qua.find((q) => q.buoc === 6);
  if (b6 && b7) expect.soft(b7.linhThach, "chiếm và thu mỏ xong thì linh thạch tăng").toBeGreaterThan(b6.linhThach);

  await expect(page.locator(`${HUONG_DAN}:visible`), "hết FTUE thì không còn khung hướng dẫn").toHaveCount(0);
  const cap = await capHienTai(page);
  expect(cap, "hết nhập môn (2.500 kinh nghiệm) phải lên cấp 5").toBeGreaterThanOrEqual(5);
  await anh.chup("het-nhap-mon");

  // Bước 8: thẻ Lịch hiện giờ bí cảnh gần nhất.
  await expect(page.getByText(/12:00|20:00/).first(), "Lịch hôm nay hiện giờ bí cảnh").toBeVisible();

  // Tải lại sau khi xong: không hiện lại FTUE, cấp giữ nguyên.
  await page.reload();
  expect(await capHienTai(page)).toBe(cap);
  await expect(page.locator(`${HUONG_DAN}:visible`), "tải lại sau khi xong không hiện lại FTUE").toHaveCount(0);

  // Chơi tiếp: Việc nên làm phải chỉ tới nhiệm vụ chính kế tiếp (chinh.1.1 Ải thứ nhất, mở ở cấp 5).
  const ke = page.locator("[data-nhiem-vu^='chinh.1.']").first();
  await expect(ke, "Việc nên làm chỉ tới nhiệm vụ chính kế tiếp (chinh.1.*), không ngõ cụt").toBeVisible();
  await anh.chup("nhiem-vu-ke-tiep");
  expect(loiTrang, "không có lỗi JS suốt lượt chơi").toEqual([]);
});

test("chạm lung tung ngoài hướng dẫn không làm kẹt FTUE", async ({ page }, info) => {
  const anh = new MayAnh(page, info, "cham-lung-tung");
  await moGame(page);
  await dangNhap(page, { sdt: soThu(12), ngaySinh: ngaySinhTuoi(30) });
  await expect(page.locator(`${HUONG_DAN}:visible`).first()).toBeVisible({ timeout: 15_000 });
  const truoc = await buocHienTai(page);
  // Người mới hay bấm thử các tab dưới trước khi đọc hướng dẫn.
  for (const b of await page.locator("#tabbar button").all()) {
    if (await b.isVisible()) await b.click();
    await page.waitForTimeout(300);
  }
  await page.locator("#tabbar button").first().click();
  await anh.chup("sau-khi-bam-cac-tab");
  await expect.poll(() => buocHienTai(page), { message: "bấm các tab xong vẫn còn hướng dẫn, đúng bước cũ" }).toBe(truoc);
  await expect(page.locator(`${DICH}:visible`).first(), "vẫn có chỗ để chạm tiếp").toBeVisible({ timeout: 10_000 });
});

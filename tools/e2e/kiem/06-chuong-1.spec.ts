// Tuyến nhiệm vụ chính chương 1 (chinh.1.1–1.10, f566933) chơi như người thật: làm nhiệm vụ khi đủ cấp, thiếu cấp thì bế
// quan (trần 8 giờ/ngày, làm mới 05:00), bí cảnh chờ khung 12:00/20:00, tới cấp 50 thì Đột phá ở màn Nhân vật.
// Đồng hồ giả tua giờ. Kết quả là bảng nhịp: mỗi nhiệm vụ mở ở ngày thứ mấy, cấp bao nhiêu (gắn vào báo cáo, ghi file).
import { expect, test, type Page } from "@playwright/test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { baoLoiDangHien, capHienTai, dangNhap, lamTheoHuongDan, MayAnh, moGame, ngaySinhTuoi, soThu, THE_FTUE, thanhTrenOnDinh, trangThaiFtue, xemHetTran } from "./nguoi-choi.ts";

const BAT_DAU = new Date("2026-11-10T08:00:00+07:00");
const NGAY = 86_400_000;

const gioTrang = (page: Page) => page.evaluate(() => Date.now());

/** Tua tới mốc giờ `h:m` kế tiếp theo giờ của trang (Asia/Ho_Chi_Minh), rồi tải lại để game chốt việc đã hết giờ. */
async function tuaToi(page: Page, h: number, m: number): Promise<void> {
  const conLai = await page.evaluate(([h, m]) => {
    const d = new Date();
    d.setHours(h, m, 0, 0);
    if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1);
    return d.getTime() - Date.now();
  }, [h, m]);
  await page.clock.fastForward(conLai);
  await page.reload();
  await thanhTrenOnDinh(page);
}

/** Bế quan `gio` giờ rồi tua qua; hết trần ngày thì tua tới 05:05 hôm sau và thử lại. */
async function beQuan(page: Page, gio: 1 | 8): Promise<void> {
  for (let lan = 0; lan < 2; lan++) {
    await page.keyboard.press("Escape");
    const nutNv = page.locator(`${THE_FTUE} [data-f="nv"]`);
    if (await nutNv.isVisible()) await nutNv.click();
    const nut = page.locator(`#sheet [data-f="be_quan"][data-gio="${gio}"], ${THE_FTUE} [data-f="be_quan"][data-gio="${gio}"]`).first();
    await expect(nut, `có nút Bế quan ${gio} giờ`).toBeVisible();
    await nut.click();
    await page.waitForTimeout(500);
    if (/đủ 8 giờ/.test((await baoLoiDangHien(page)) ?? "")) {
      await tuaToi(page, 5, 5);
      continue;
    }
    await page.clock.fastForward(gio * 3_600_000 + 60_000);
    await page.reload();
    await thanhTrenOnDinh(page);
    return;
  }
  throw new Error(`Bế quan ${gio} giờ bị từ chối cả sau khi sang ngày mới`);
}

/** Màn Nhân vật › Thông tin › nút lớn "Đột phá" (hiện khi đầy tu vi ở cấp cuối cảnh giới). Trả false khi chưa có nút. */
async function dotPha(page: Page, anh: MayAnh): Promise<boolean> {
  await page.keyboard.press("Escape");
  await page.locator("#topbar .portrait").click();
  const the = page.locator('[role=tab][data-tab="thong-tin"]:visible');
  if (await the.count()) await the.click();
  const nut = page.locator("button[data-act=main]:visible").filter({ hasText: "Đột phá" });
  if (!(await nut.count())) {
    await page.locator("#tabbar button").first().click();
    return false;
  }
  await anh.chup("nut-dot-pha");
  await nut.click();
  await page.waitForTimeout(4000);
  const ok = page.locator("#sheet [data-ok]:visible");
  if (await ok.count()) await ok.first().click();
  await anh.chup("sau-dot-pha");
  await page.locator("#tabbar button").first().click();
  return true;
}

test("chương 1: nhiệm vụ chính và bế quan tới hết chương, đo nhịp lên cấp", async ({ page }, info) => {
  test.setTimeout(25 * 60_000);
  const anh = new MayAnh(page, info, "chuong-1");
  await page.clock.install({ time: BAT_DAU });
  await moGame(page);
  await dangNhap(page, { sdt: soThu(61), ngaySinh: ngaySinhTuoi(26) });
  await lamTheoHuongDan(page, anh);
  const t0 = await gioTrang(page);

  const nhip: { nv: string; ngay: number; gio: string; cap: number }[] = [];
  const baoLoi: string[] = [];
  let nvCu = "";
  let lanCungNv = 0;
  for (let vong = 0; vong < 500; vong++) {
    const st = await trangThaiFtue(page);
    if (st.tran) {
      await xemHetTran(page, anh, 60);
      continue;
    }
    const nv = st.nv ?? "";
    if (nv !== nvCu) {
      const t = await gioTrang(page);
      nhip.push({ nv: nv || "(hết)", ngay: Math.floor((t - t0) / NGAY) + 1, gio: new Date(t).toISOString(), cap: await capHienTai(page) });
      await anh.chup(`nv-${nv || "het"}`);
      nvCu = nv;
      lanCungNv = 0;
    }
    if (!nv.startsWith("1.")) break;
    if (++lanCungNv > 40) {
      await anh.chup(`ket-${nv}`);
      throw new Error(`Kẹt ở nhiệm vụ ${nv} sau 40 lần thử. Báo lỗi đã gặp: ${baoLoi.slice(-5).join(" | ")}`);
    }

    // Mở bảng nhiệm vụ; thẻ không có nút nhiệm vụ nghĩa là chưa đủ cấp: bế quan.
    if (!(await page.locator("#sheet").isVisible())) {
      const nutNv = page.locator(`${THE_FTUE} [data-f="nv"]`);
      if (!(await nutNv.isVisible())) {
        await beQuan(page, 8);
        continue;
      }
      await nutNv.click();
      await page.waitForTimeout(500);
    }
    const ok = page.locator("#sheet [data-ok]:visible:enabled").first();
    if (!(await ok.count())) {
      await beQuan(page, 8);
      continue;
    }
    await ok.click();
    await page.waitForTimeout(700);
    const loi = await baoLoiDangHien(page);
    if (!loi) continue;
    baoLoi.push(`${nv}: ${loi}`);
    if (/Bí cảnh chỉ mở/.test(loi)) await tuaToi(page, (await page.evaluate(() => new Date().getHours())) < 12 ? 12 : 20, 5);
    else if (/Bế quan một lượt|Đang bế quan/.test(loi)) await beQuan(page, 1);
    else if (/Chưa đột phá/.test(loi)) {
      if (!(await dotPha(page, anh))) await beQuan(page, 8);
    } else if (/Chưa đủ cấp|Thiếu tàn quyển/.test(loi)) await beQuan(page, 8);
    else {
      await anh.chup(`loi-${nv}`);
      throw new Error(`Nhiệm vụ ${nv}: báo lỗi lạ "${loi}"`);
    }
  }

  await info.attach("nhip-chuong-1.json", { body: JSON.stringify({ nhip, baoLoi }, null, 2), contentType: "application/json" });
  writeFileSync(join("ket-qua", "anh", info.project.name, "chuong-1", "nhip.json"), JSON.stringify({ nhip, baoLoi }, null, 2));
  const ids = nhip.map((n) => n.nv);
  expect(ids.slice(0, 10), "đi đủ 1.1 → 1.10 theo thứ tự").toEqual(["1.1", "1.2", "1.3", "1.4", "1.5", "1.6", "1.7", "1.8", "1.9", "1.10"]);
  expect(ids[10], "hết chương 1 thì sang chương 2 (hoặc hết nhiệm vụ)").toMatch(/^2\.|\(hết\)/);
  expect(await capHienTai(page), "xong 1.10 Trúc Cơ kiếp: đã đột phá qua cấp 50").toBeGreaterThan(50);
});

// Tiếng Anh: chọn EN từ màn đăng nhập rồi đi hết FTUE. Mỗi bước chụp ảnh và liệt kê chữ tiếng Việt có dấu còn sót
// trên màn (trừ tên riêng giữ nguyên như "Thiên Hoang Ký"). Còn sót thì trượt mềm, ghi danh sách vào báo cáo.
import { expect, test } from "@playwright/test";
import { buocHienTai, capHienTai, chuVietConSot, dangNhap, lamTheoHuongDan, MayAnh, moGame, ngaySinhTuoi, soThu } from "./nguoi-choi.ts";

const TEN_RIENG = [/Thiên Hoang Ký/];

test("đi hết nhập môn bằng tiếng Anh", async ({ page }, info) => {
  const anh = new MayAnh(page, info, "tieng-anh");
  await moGame(page, "en");
  const login = page.locator("#login");
  await expect(login.locator("h2")).toHaveText("Sign in");
  const sot: Record<string, string[]> = {};
  const soat = async (man: string) => {
    const con = (await chuVietConSot(page)).filter((t) => !TEN_RIENG.some((r) => r.test(t) && t.replace(r, "").trim() === ""));
    if (con.length) sot[man] = con;
  };
  await soat("dang-nhap");
  await dangNhap(page, { sdt: soThu(41), ngaySinh: ngaySinhTuoi(25) });
  expect(await capHienTai(page)).toBe(1);
  await soat("vao-game");
  await expect.poll(() => buocHienTai(page), { timeout: 15_000 }).toBe(2);
  await lamTheoHuongDan(page, anh, { truocMoiBuoc: (b) => soat(`buoc-${b}`) });
  await soat("het-nhap-mon");
  await info.attach("chu-viet-con-sot.json", { body: JSON.stringify(sot, null, 2), contentType: "application/json" });
  expect.soft(sot, "không còn chữ tiếng Việt khi chọn tiếng Anh").toEqual({});
  expect(await capHienTai(page)).toBeGreaterThanOrEqual(5);
});

// Thao tác của một người chơi mới: chỉ chạm nút và gõ chữ như người thật, đọc chữ trên màn để quyết bước sau.
// Bộ chọn ưu tiên thứ ổn định khi đổi ngôn ngữ (id, name của ô nhập, data-act, data-ftue-*), chữ chỉ dùng để kiểm.
import { expect, type Locator, type Page, type TestInfo } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

export type NgonNgu = "vi" | "en";

/** Ngày sinh tròn `tuoi` tuổi tính tới hôm nay, trừ thêm 30 ngày cho chắc (YYYY-MM-DD). */
export function ngaySinhTuoi(tuoi: number): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - tuoi);
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}

/** Số di động thử, khác nhau giữa các bài kiểm để không đụng tài khoản của nhau trên cùng trình duyệt. */
export function soThu(hau: number): string {
  return `09${String(10_000_000 + (hau % 89_999_999)).padStart(8, "0")}`;
}

/** Ảnh một bước: gắn vào báo cáo HTML và lưu ở ket-qua/anh/<khung>/<số>-<tên>.png để gửi kèm báo lỗi. */
export class MayAnh {
  private n = 0;
  constructor(
    private readonly page: Page,
    private readonly info: TestInfo,
    private readonly nhom: string,
  ) {}

  async chup(ten: string): Promise<string> {
    this.n++;
    const dir = join("ket-qua", "anh", this.info.project.name, this.nhom);
    mkdirSync(dir, { recursive: true });
    const file = join(dir, `${String(this.n).padStart(2, "0")}-${ten}.png`);
    await this.page.screenshot({ path: file, fullPage: false });
    await this.info.attach(`${this.n}. ${ten}`, { path: file, contentType: "image/png" });
    return file;
  }
}

/** Gom lỗi console và lỗi trang: bài kiểm cuối mỗi màn đòi danh sách này rỗng. */
export function ghiLoiTrang(page: Page): string[] {
  const loi: string[] = [];
  page.on("pageerror", (e) => loi.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const t = m.text();
    // Chạy ở máy không có /api (vite preview): server.ts tự tắt, trình duyệt vẫn in 404 của lần thử đầu.
    if (/\/api\/|Failed to load resource: the server responded with a status of 404/.test(t)) return;
    loi.push(`console: ${t}`);
  });
  return loi;
}

/** Mở game như người mới: trình duyệt sạch, chọn ngôn ngữ trước khi trang chạy (giống bấm VI · EN rồi tải lại). */
export async function moGame(page: Page, ngonNgu: NgonNgu = "vi"): Promise<void> {
  if (ngonNgu === "en") await page.addInitScript(() => localStorage.getItem("ktlp.lang") ?? localStorage.setItem("ktlp.lang", "en"));
  await page.goto("/");
  await expect(page.locator("#login, #topbar .lv").first()).toBeVisible({ timeout: 30_000 });
}

export interface HoSo {
  sdt: string;
  ngaySinh: string;
  giamHo?: { ten: string; sdt: string };
}

/** FTUE bước 1: số điện thoại → OTP thử (đọc trên màn) → ngày sinh lần đầu (dưới 16 tuổi thêm người giám hộ). */
export async function dangNhap(page: Page, hs: HoSo, anh?: MayAnh): Promise<void> {
  const login = page.locator("#login");
  await expect(login).toBeVisible();
  const sdt = login.locator("input[name=phone]");
  const nut = login.locator("button[type=submit]");
  await sdt.click();
  await sdt.fill("123");
  await expect(nut, "số sai thì nút Nhận mã phải khóa").toBeDisabled();
  await sdt.fill(hs.sdt);
  await expect(nut, "số đúng thì nút Nhận mã phải mở").toBeEnabled();
  await anh?.chup("so-dien-thoai");
  await nut.click();

  const ma = login.locator("input[name=code]");
  await expect(ma).toBeVisible();
  const maThu = (await login.locator(".dev b").textContent())?.trim() ?? "";
  expect(maThu, "màn OTP thử phải in mã thử").toMatch(/^\d{6}$/);
  const sai = maThu === "111111" ? "222222" : "111111";
  await ma.fill(sai);
  await expect(login.locator(".err"), "mã sai phải báo lỗi").not.toBeEmpty();
  await anh?.chup("otp-sai");
  await ma.fill(maThu);

  const ngay = login.locator("input[name=dob]");
  // Số đã có hồ sơ trên máy này thì vào thẳng, không hỏi ngày sinh lần nữa.
  await expect(ngay.or(page.locator("#topbar .lv")).first()).toBeVisible();
  if (!(await ngay.isVisible())) return;
  await ngay.fill(hs.ngaySinh);
  const vao = login.locator("button[type=submit]");
  const giamHo = login.locator("fieldset.guardian");
  if (hs.giamHo) {
    await expect(giamHo, "dưới 16 tuổi phải hiện ô người giám hộ").toBeVisible();
    await expect(vao, "chưa có người giám hộ đồng ý thì chưa vào được").toBeDisabled();
    await giamHo.locator("input[name=gname]").fill(hs.giamHo.ten);
    await giamHo.locator("input[name=gphone]").fill(hs.sdt);
    await giamHo.locator("input[name=gok]").check();
    await vao.click();
    await expect(login.locator(".err"), "số người giám hộ trùng số mình phải bị từ chối").not.toBeEmpty();
    await giamHo.locator("input[name=gphone]").fill(hs.giamHo.sdt);
    await anh?.chup("nguoi-giam-ho");
  } else {
    await expect(giamHo).toBeHidden();
    await anh?.chup("ngay-sinh");
  }
  await expect(vao).toBeEnabled();
  await vao.click();
  await expect(login).toBeHidden({ timeout: 15_000 });
}

/** Cấp trên thanh trên (`#topbar .lv`). */
export async function capHienTai(page: Page): Promise<number> {
  const lv = page.locator("#topbar .lv");
  await expect(lv).toBeVisible({ timeout: 20_000 });
  return Number((await lv.textContent())?.trim());
}

/** Linh thạch trên thanh trên. */
export async function linhThach(page: Page): Promise<number> {
  const t = (await page.locator("#topbar .pill.stone").textContent()) ?? "";
  return Number(t.replace(/\D/g, ""));
}

// ---- FTUE: người chơi làm theo khung hướng dẫn ----
// Móc đã hẹn với tab Khởi đầu mới: khung hướng dẫn đang hiện có data-ftue-buoc="<1..8>" (BUOC_FTUE), thứ người chơi
// phải chạm có data-ftue-dich. Đổi móc thì chỉ sửa hai hằng dưới đây.
export const HUONG_DAN = "[data-ftue-buoc]";
export const DICH = "[data-ftue-dich]";

export interface BuocDaQua {
  buoc: number;
  loi: string;
  cap: number;
  linhThach: number;
  giay: number;
  cham: number;
  anh: string;
}

/** Bước FTUE đang hiện (đọc khung hướng dẫn đang thấy), hoặc null khi không có khung nào. */
export async function buocHienTai(page: Page): Promise<number | null> {
  const k = page.locator(`${HUONG_DAN}:visible`).first();
  if ((await k.count()) === 0) return null;
  const v = Number(await k.getAttribute("data-ftue-buoc"));
  return Number.isFinite(v) ? v : null;
}

async function loiHuongDan(page: Page): Promise<string> {
  const k = page.locator(`${HUONG_DAN}:visible`).first();
  return (await k.count()) ? ((await k.innerText()).replace(/\s+/g, " ").trim()) : "";
}

/** Số câu của lời hướng dẫn (GDD mục 14: tối đa 2 câu mỗi bước). */
export function soCau(s: string): number {
  return s.split(/(?<=[.!?…])\s+/).filter((c) => /\p{L}/u.test(c)).length;
}

/**
 * Làm theo hướng dẫn cho tới khi qua bước `den` (hoặc hết FTUE). Mỗi lần: đợi thứ có data-ftue-dich hiện ra, chạm nó,
 * đợi màn đổi. Kẹt quá `kẹtGiay` giây không có gì để chạm và bước không đổi thì báo trượt kèm ảnh, ghi rõ bước nào.
 */
export async function lamTheoHuongDan(
  page: Page,
  anh: MayAnh,
  opts: { den?: number; ketGiay?: number; toiDaCham?: number; truocMoiBuoc?: (buoc: number) => Promise<void> } = {},
): Promise<BuocDaQua[]> {
  const den = opts.den ?? 8;
  const ketGiay = opts.ketGiay ?? 45;
  const toiDa = opts.toiDaCham ?? 80;
  const qua: BuocDaQua[] = [];
  let buoc = await buocHienTai(page);
  let batDau = Date.now();
  let cham = 0;
  let loi = await loiHuongDan(page);
  const ghiBuoc = async (b: number) => {
    const file = await anh.chup(`xong-buoc-${b}`);
    qua.push({ buoc: b, loi, cap: await capHienTai(page), linhThach: await linhThach(page), giay: Math.round((Date.now() - batDau) / 1000), cham, anh: file });
  };
  if (buoc !== null) {
    await anh.chup(`buoc-${buoc}`);
    await opts.truocMoiBuoc?.(buoc);
  }
  for (let n = 0; n < toiDa; n++) {
    if (buoc === null || buoc > den) break;
    // Đợi tới khi có thứ để chạm, hoặc bước tự đổi (ví dụ trận tự phát xong).
    const dich = page.locator(`${DICH}:visible`).first();
    const het = Date.now() + ketGiay * 1000;
    let coDich = false;
    while (Date.now() < het) {
      if ((await dich.count()) > 0) {
        coDich = true;
        break;
      }
      if ((await buocHienTai(page)) !== buoc) break;
      await page.waitForTimeout(250);
    }
    const moi = await buocHienTai(page);
    if (moi !== buoc) {
      await ghiBuoc(buoc);
      buoc = moi;
      batDau = Date.now();
      cham = 0;
      loi = await loiHuongDan(page);
      if (buoc !== null) {
        await anh.chup(`buoc-${buoc}`);
        await opts.truocMoiBuoc?.(buoc);
      }
      continue;
    }
    if (!coDich) {
      await anh.chup(`ket-buoc-${buoc}`);
      throw new Error(`Kẹt ở FTUE bước ${buoc}: ${ketGiay} giây không có gì để chạm (${DICH}) và bước không đổi. Lời hướng dẫn: "${loi}"`);
    }
    await dich.scrollIntoViewIfNeeded();
    await dich.click();
    cham++;
    await page.waitForTimeout(400);
    const sau = await buocHienTai(page);
    if (sau !== buoc) {
      await ghiBuoc(buoc);
      buoc = sau;
      batDau = Date.now();
      cham = 0;
      loi = await loiHuongDan(page);
      if (buoc !== null) {
        await anh.chup(`buoc-${buoc}`);
        await opts.truocMoiBuoc?.(buoc);
      }
    }
  }
  if (buoc !== null && buoc <= den) throw new Error(`Chạm ${toiDa} lần vẫn chưa qua FTUE bước ${buoc}.`);
  return qua;
}

/** Màn Nhân vật → Chơi lại từ đầu → đồng ý. Hộp hỏi lại có thể là confirm() của trình duyệt hoặc nút trong trang. */
export async function choiLai(page: Page): Promise<void> {
  page.once("dialog", (d) => void d.accept());
  const nut = page.locator("[data-act=choi-lai]");
  if (!(await nut.isVisible())) {
    await page.locator("#topbar .portrait").click();
    if (!(await nut.isVisible())) {
      const taiKhoan = page.getByText(/^(Tài khoản|Account)$/).first();
      if (await taiKhoan.isVisible()) await taiKhoan.click();
    }
  }
  await expect(nut, "phải có nút Chơi lại từ đầu (data-act=choi-lai)").toBeVisible();
  await nut.click();
  const ok = page.locator("[data-act=choi-lai-ok]");
  if (await ok.waitFor({ state: "visible", timeout: 2000 }).then(() => true, () => false)) await ok.click();
}

/** Chữ tiếng Việt có dấu còn sót khi đang chọn tiếng Anh (trên màn đang thấy). */
export async function chuVietConSot(page: Page, vung: Locator = page.locator("body")): Promise<string[]> {
  const text = await vung.evaluate((el) => {
    const out: string[] = [];
    const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = walk.nextNode(); n; n = walk.nextNode()) {
      const p = n.parentElement;
      if (!p || p.closest("script,style,[hidden],[aria-hidden=true]")) continue;
      const s = p.getBoundingClientRect();
      if (s.width === 0 || s.height === 0) continue;
      const t = n.textContent?.trim();
      if (t) out.push(t);
    }
    return out;
  });
  // Dấu riêng của tiếng Việt (không có trong tiếng Anh). Tên riêng ghép âm tiết đã dịch thì không còn dấu.
  return [...new Set(text.filter((t) => /[ăâđêôơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/i.test(t)))];
}

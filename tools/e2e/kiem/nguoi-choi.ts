// Thao tác của một người chơi mới: chỉ chạm nút và gõ chữ như người thật, đọc chữ trên màn để quyết bước sau.
// Bộ chọn ưu tiên thứ ổn định khi đổi ngôn ngữ (id, name của ô nhập, data-act, data-ftue-*), chữ chỉ dùng để kiểm.
import { expect, type Locator, type Page, type TestInfo } from "@playwright/test";
import { mkdirSync, rmSync } from "node:fs";
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
  private readonly dir: string;
  constructor(
    private readonly page: Page,
    private readonly info: TestInfo,
    nhom: string,
  ) {
    // Mỗi lần chạy bắt đầu thư mục ảnh sạch, để ảnh hai lần chạy không lẫn số thứ tự.
    this.dir = join("ket-qua", "anh", info.project.name, nhom);
    rmSync(this.dir, { recursive: true, force: true });
    mkdirSync(this.dir, { recursive: true });
  }

  async chup(ten: string): Promise<string> {
    this.n++;
    const file = join(this.dir, `${String(this.n).padStart(2, "0")}-${ten}.png`);
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

/** q(L) và E(L) của tab Nhiệm vụ (GDD): kinh nghiệm một trận cùng cấp, và kinh nghiệm lên cấp kế (làm tròn chục). */
export const q = (L: number) => 10 + 2 * L;
export function kinhNghiemCap(L: number): number {
  const p = L < 60 ? 0.3 + (0.7 * (L - 1)) / 59 : 1;
  return Math.round((320 * q(L) * (0.4 + 0.002 * L) * p) / 10) * 10;
}
/** Tổng tu vi từ cấp 1 tới (cấp, tu vi dư). */
export function tongTuVi(cap: number, tuVi: number): number {
  let t = tuVi;
  for (let L = 1; L < cap; L++) t += kinhNghiemCap(L);
  return t;
}
/** Cấp và tu vi dư sau khi cộng `them` vào (cấp, tu vi) đang có. */
export function congTuVi(cap: number, tuVi: number, them: number): { cap: number; tuVi: number } {
  let t = tuVi + them;
  while (t >= kinhNghiemCap(cap)) t -= kinhNghiemCap(cap++);
  return { cap, tuVi: t };
}

/** Tu vi hiện có, đọc từ title vòng tu vi trên thanh trên ("Tu vi 20 / 910"). */
export async function tuViHienTai(page: Page): Promise<number> {
  const t = (await page.locator("#topbar .xp-ring").getAttribute("title")) ?? "";
  return Number((/([\d.]+)\s*\//.exec(t)?.[1] ?? "").replace(/\./g, ""));
}

/** Linh thạch trên thanh trên. */
export async function linhThach(page: Page): Promise<number> {
  const t = (await page.locator("#topbar .pill.stone").textContent()) ?? "";
  return Number(t.replace(/\D/g, ""));
}

// ---- FTUE: người chơi làm theo thẻ Nhiệm vụ ----
// Thẻ nhập môn của tab Khởi đầu mới (proto/src/dashboard/moi/ftueUi.ts): #ftue, ".ftue-so" ghi "… n/7", nút
// [data-f=lam] mở việc của bước; bảng trượt #sheet có nút chính [data-ok]; màn gieo quẻ #gieo-que có nút .seal
// ([data-gieo] → [data-tiep] → [data-xong]); trận mở ở #tran, về bằng #topbar .back. Bước nhiệm vụ n/7 (chinh.0.n)
// là FTUE bước n+1 (GDD mục 14; bước 1 là đăng nhập). Thẻ "đã xong" có nút [data-f=an].
export const THE_FTUE = "#ftue:not([hidden])";

export interface BuocDaQua {
  buoc: number;
  loi: string;
  cap: number;
  linhThach: number;
  giay: number;
  cham: number;
  anh: string;
  baoLoi: string[];
}

export interface TrangThaiFtue {
  /** FTUE bước 2–8 đang làm, null khi không đọc được (thẻ ẩn, đang trong trận, hoặc đã xong). */
  buoc: number | null;
  /** Hết chương 0 (Nhập Thế): thẻ chuyển sang tuyến nhiệm vụ chính, hoặc báo xong. */
  xong: boolean;
  /** Nhiệm vụ chính đang làm sau chương 0, ví dụ "1.3" (thẻ "Chương 1 · 1.3"); null khi chưa tới. */
  nv: string | null;
  tran: boolean;
  loi: string;
}

export async function trangThaiFtue(page: Page): Promise<TrangThaiFtue> {
  return page.evaluate(() => {
    const the = document.getElementById("ftue");
    const tran = location.hash === "#tran";
    const hien = !!the && !the.hidden && the.getBoundingClientRect().height > 0;
    const loi = (the?.querySelector("p")?.textContent ?? "").replace(/\s+/g, " ").trim();
    if (!hien) return { buoc: null, xong: false, nv: null, tran, loi };
    const so = the.querySelector(".ftue-so, .ftue-pill")?.textContent ?? "";
    // Thẻ chương 1+: "Chương 1 · 1.1"; thu gọn: "Nhiệm vụ 1.1 · Tên" (f566933).
    const nv = /Chương\s*\d+\s*·\s*(\d+\.\d+)/.exec(so)?.[1] ?? /Nhiệm vụ\s+(\d+\.\d+)\s*·/.exec(so)?.[1] ?? null;
    const xong = !!nv || !!the.querySelector('[data-f="an"], [data-f="nv"]') || (!!the.querySelector(".ftue-pill") && !/\d+\s*\/\s*\d+/.test(the.textContent ?? ""));
    const m = /(\d+)\s*\/\s*(\d+)/.exec(so);
    return { buoc: !xong && m ? Number(m[1]) + 1 : null, xong, nv, tran, loi };
  });
}

/** Bước FTUE đang làm (2–8), hoặc null. */
export async function buocHienTai(page: Page): Promise<number | null> {
  return (await trangThaiFtue(page)).buoc;
}

/** Số câu của lời hướng dẫn (GDD mục 14: tối đa 2 câu mỗi bước). */
export function soCau(s: string): number {
  return s.split(/(?<=[.!?…])\s+/).filter((c) => /\p{L}/u.test(c)).length;
}

/** Chữ báo lỗi đang hiện (toast đỏ), để ghi vào báo cáo khi bấm mà không qua bước. */
export async function baoLoiDangHien(page: Page): Promise<string | null> {
  const t = page.locator("#toast.show.bad");
  return (await t.count()) ? ((await t.textContent()) ?? "").trim() : null;
}

/**
 * Cấp và linh thạch trên thanh trên sau khi hiệu ứng thăng cấp chạy xong: số trên thanh đổi sau dấu "Thăng cấp", nên
 * đọc tới khi hai lần liền nhau (cách 800 ms) như nhau, tối đa 8 giây.
 */
export async function thanhTrenOnDinh(page: Page): Promise<{ cap: number; lt: number }> {
  let truoc = { cap: await capHienTai(page), lt: await linhThach(page) };
  const het = Date.now() + 8000;
  while (Date.now() < het) {
    await page.waitForTimeout(800);
    const nay = { cap: await capHienTai(page), lt: await linhThach(page) };
    if (nay.cap === truoc.cap && nay.lt === truoc.lt) return nay;
    truoc = nay;
  }
  return truoc;
}

/** Trong màn Trận: chọn tốc độ nhanh nhất, chờ phát hết (thanh tua tới cuối), rồi Quay lại như người chơi. */
export async function xemHetTran(page: Page, anh: MayAnh, toiDaGiay = 120): Promise<void> {
  // Như người mới: xem vài giây đầu ở ×1 (lúc nhãn "Khắc ×1,5" hiện), chụp, rồi mới tua nhanh nhất.
  await page.waitForTimeout(2500);
  await anh.chup("dang-xem-tran");
  const nhanh = page.locator("[data-speed]").last();
  if (await nhanh.isVisible()) await nhanh.click();
  const het = Date.now() + toiDaGiay * 1000;
  while (Date.now() < het) {
    const xong = await page.evaluate(() => {
      const s = document.querySelector<HTMLInputElement>("input.seek");
      return !!s && !s.disabled && Number(s.max) > 1 && Number(s.value) >= Number(s.max) - 1;
    });
    if (xong) break;
    await page.waitForTimeout(500);
  }
  await anh.chup("het-tran");
  // Hết trận: người chơi bấm nút to "Tiếp tục" giữa màn (07dff22); bản cũ chưa có thì dùng "Quay lại" trên thanh trên.
  const tiep = page.locator("button.next:visible");
  if (await tiep.waitFor({ state: "visible", timeout: 3000 }).then(() => true, () => false)) await tiep.click();
  else await page.locator("#topbar .back").click();
  await expect(page, "Quay lại từ màn Trận").not.toHaveURL(/#tran$/);
}

/**
 * Làm theo thẻ Nhiệm vụ cho tới khi qua bước `den` (hoặc hết FTUE). Mỗi vòng chạm đúng một thứ người mới sẽ chạm: nút
 * chính của màn gieo quẻ hoặc bảng trượt đang mở, nút của thẻ, hoặc xem hết trận rồi Quay lại. Không có gì để chạm quá
 * `ketGiay` giây, hay chạm `toiDaMoiBuoc` lần mà bước không đổi, thì trượt kèm ảnh và lời báo lỗi đang hiện.
 */
export async function lamTheoHuongDan(
  page: Page,
  anh: MayAnh,
  opts: { den?: number; ketGiay?: number; toiDaMoiBuoc?: number; truocMoiBuoc?: (buoc: number) => Promise<void> } = {},
): Promise<BuocDaQua[]> {
  const den = opts.den ?? 8;
  const ketGiay = opts.ketGiay ?? 30;
  const toiDaMoiBuoc = opts.toiDaMoiBuoc ?? 12;
  const qua: BuocDaQua[] = [];
  let st = await trangThaiFtue(page);
  let buoc = st.buoc;
  let loi = st.loi;
  let batDau = Date.now();
  let cham = 0;
  let baoLoi: string[] = [];
  let ranhTu = Date.now();
  const sangBuoc = async (moi: number | null) => {
    if (buoc !== null) {
      const file = await anh.chup(`xong-buoc-${buoc}`);
      const { cap, lt } = await thanhTrenOnDinh(page);
      qua.push({ buoc, loi, cap, linhThach: lt, giay: Math.round((Date.now() - batDau) / 1000), cham, anh: file, baoLoi });
    }
    buoc = moi;
    batDau = Date.now();
    cham = 0;
    baoLoi = [];
    loi = (await trangThaiFtue(page)).loi;
    if (buoc !== null && buoc <= den) {
      await anh.chup(`buoc-${buoc}`);
      await opts.truocMoiBuoc?.(buoc);
    }
  };
  if (buoc !== null) {
    await anh.chup(`buoc-${buoc}`);
    await opts.truocMoiBuoc?.(buoc);
  }
  const ket = async (vi: string) => {
    await anh.chup(`ket-buoc-${buoc ?? "?"}`);
    const sheet = page.locator("#sheet .sheet");
    const trongBang = (await sheet.count()) ? ` Bảng đang mở: "${(await sheet.innerText()).replace(/\s+/g, " ").slice(0, 200)}".` : "";
    throw new Error(`Kẹt ở FTUE bước ${buoc}: ${vi}. Lời hướng dẫn: "${loi}".${baoLoi.length ? ` Báo lỗi trên màn: ${baoLoi.join(" | ")}.` : ""}${trongBang}`);
  };

  for (;;) {
    st = await trangThaiFtue(page);
    if (st.buoc !== null && st.buoc !== buoc) await sangBuoc(st.buoc);
    if (st.xong) {
      await sangBuoc(null);
      break;
    }
    if (buoc !== null && buoc > den) break;
    if (cham >= toiDaMoiBuoc) await ket(`chạm ${cham} lần mà bước không đổi`);

    const gieo = page.locator("#gieo-que .seal:visible:enabled").first();
    const okBang = page.locator("#sheet [data-ok]:visible:enabled").first();
    const lam = page.locator(`${THE_FTUE} [data-f="lam"]:visible`).first();
    const pill = page.locator(`${THE_FTUE} .ftue-pill:visible`).first();
    let daCham = true;
    if (await page.locator("#gieo-que").isVisible()) {
      if (await gieo.count()) await gieo.click();
      else daCham = false; // đang quay quẻ
    } else if (await page.locator("#sheet").isVisible()) {
      if (await okBang.count()) await okBang.click();
      else await ket("bảng trượt đang mở nhưng không có nút để làm tiếp");
    } else if (st.tran) {
      await xemHetTran(page, anh);
    } else if (await lam.count()) {
      await lam.click();
    } else if (await pill.count()) {
      await pill.click();
    } else daCham = false;

    if (daCham) {
      cham++;
      ranhTu = Date.now();
      await page.waitForTimeout(500);
      const bl = await baoLoiDangHien(page);
      if (bl && !baoLoi.includes(bl)) baoLoi.push(bl);
    } else {
      if (Date.now() - ranhTu > ketGiay * 1000) await ket(`${ketGiay} giây không có gì để chạm và bước không đổi`);
      await page.waitForTimeout(300);
    }
  }
  return qua;
}

/**
 * Mở mục Tài khoản ở màn Nhân vật như người chơi: chạm hình nhân vật trên thanh trên; điện thoại chia màn thành thẻ con
 * nên chạm thẻ "Thông tin"; mục Tài khoản thu gọn thì chạm tiêu đề. Trả nút data-act cần bấm.
 */
export async function moTaiKhoan(page: Page, act: "choi-lai" | "logout"): Promise<Locator> {
  const nut = page.locator(`[data-act=${act}]:visible`).first();
  if (await nut.count()) return nut;
  if (!/#nhan-vat/.test(page.url())) await page.locator("#topbar .portrait").click();
  const the = page.locator('[role=tab][data-tab="thong-tin"]:visible');
  await page.waitForTimeout(400);
  if (await the.count()) await the.click();
  if (!(await nut.count())) {
    const tieuDe = page.getByText(/^(Tài khoản|Account)$/).first();
    if (await tieuDe.isVisible()) await tieuDe.click();
  }
  await expect(nut, `màn Nhân vật phải có nút data-act=${act} ở mục Tài khoản`).toBeVisible();
  await nut.scrollIntoViewIfNeeded();
  return nut;
}

/** Màn Nhân vật → Tài khoản → Chơi lại từ đầu → đồng ý (bảng trượt [data-ok], hoặc confirm() của trình duyệt). */
export async function choiLai(page: Page): Promise<void> {
  page.once("dialog", (d) => void d.accept());
  await (await moTaiKhoan(page, "choi-lai")).click();
  const ok = page.locator("#sheet [data-ok]");
  if (await ok.waitFor({ state: "visible", timeout: 3000 }).then(() => true, () => false)) await ok.click();
  await page.waitForLoadState("load");
}

/** Màn Nhân vật → Tài khoản → Đăng xuất (đồng ý nếu có hỏi lại), chờ màn đăng nhập. */
export async function dangXuat(page: Page): Promise<void> {
  page.once("dialog", (d) => void d.accept());
  await (await moTaiKhoan(page, "logout")).click();
  const ok = page.locator("#sheet [data-ok]");
  if (await ok.waitFor({ state: "visible", timeout: 1500 }).then(() => true, () => false)) await ok.click();
  await expect(page.locator("#login")).toBeVisible();
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
  // Thêm vài cụm tiếng Việt không dấu hay sót trong lời báo ("+114 tu vi khi xong").
  return [...new Set(text.filter((t) => /[ăâđêôơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/i.test(t) || /\b(tu vi|khi xong|linh thach)\b/i.test(t)))];
}

// Tiện ích DOM cho các màn dashboard: chuỗi HTML an toàn, đồng hồ đếm ngược theo giờ server, bảng trượt, thông báo.
import type { Element, SkillType } from "@ktlp/sim";
import { ELEMENT_STYLE, SKILL_NAME } from "../theme/elements.ts";
import { icon } from "./icons.ts";
// Lớp dịch tự chạy khi được nạp (mọi màn đều nạp ui.ts): đang chọn tiếng Anh thì dịch chữ hiện trên trang.
import { lang, locale } from "./i18n.ts";

export function esc(s: unknown): string {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** Số nguyên theo ngôn ngữ: "3.280" (vi), "3,280" (en). */
export function fmt(n: number): string {
  return Number.isFinite(n) ? Math.round(n).toLocaleString(locale()) : "∞";
}

/** Phần nghìn ra phần trăm, một chữ số lẻ: 85 → "8,5%" (vi), "8.5%" (en). */
export function pctText(perMille: number): string {
  return `${(perMille / 10).toLocaleString(locale(), { maximumFractionDigits: 1 })}%`;
}

export function clockText(t: number): string {
  const d = new Date(t);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** "1 giờ 25 phút", "6 phút", "42 giây"; tiếng Anh "1h 25m", "6m", "42s" (viết thẳng, không qua bảng, vì đếm mỗi giây). */
export function durationText(ms: number): string {
  const en = lang() === "en";
  const s = Math.max(0, Math.ceil(ms / 1000));
  if (s < 60) return en ? `${s}s` : `${s} giây`;
  const m = Math.ceil(s / 60);
  if (m < 60) return en ? `${m}m` : `${m} phút`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h < 24) return en ? (r ? `${h}h ${r}m` : `${h}h`) : r ? `${h} giờ ${r} phút` : `${h} giờ`;
  return en ? `${Math.floor(h / 24)}d ${h % 24}h` : `${Math.floor(h / 24)} ngày ${h % 24} giờ`;
}

/** "vừa xong", "18 phút trước", "2 giờ trước", "3 ngày trước"; tiếng Anh "just now", "18m ago"… */
export function agoText(now: number, t: number): string {
  const en = lang() === "en";
  const m = Math.floor((now - t) / 60_000);
  if (m < 1) return en ? "just now" : "vừa xong";
  if (m < 60) return en ? `${m}m ago` : `${m} phút trước`;
  const h = Math.floor(m / 60);
  if (en) return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`;
  return h < 24 ? `${h} giờ trước` : `${Math.floor(h / 24)} ngày trước`;
}

/**
 * Đồng hồ server: mỗi lệnh đọc gửi kèm `serverNow`; client đếm tiếp bằng performance.now(), không hỏi lại mỗi giây
 * (GDD mục 14, Kỹ thuật).
 */
export class ServerClock {
  private base = Date.now();
  private at = performance.now();

  sync(serverNow: number): void {
    this.base = serverNow;
    this.at = performance.now();
  }

  now(): number {
    return this.base + (performance.now() - this.at);
  }
}

/**
 * Chỗ đếm ngược trong HTML: `<span data-cd="<endsAt>"></span>`. Chuỗi "{cd:<endsAt>}" trong văn bản đã esc
 * cũng được đổi thành span này.
 */
export function cd(endsAt: number, done = "Xong"): string {
  return `<span class="cd" data-cd="${endsAt}" data-done="${esc(done)}"></span>`;
}

export function withCountdowns(escaped: string): string {
  return escaped.replace(/\{cd:(\d+)\}/g, (_m, t: string) => cd(Number(t)));
}

/** Cập nhật mọi chỗ đếm ngược trong `root`; trả về số chỗ còn chạy. */
export function tickCountdowns(root: HTMLElement, now: number): number {
  let running = 0;
  for (const el of root.querySelectorAll<HTMLElement>("[data-cd]")) {
    const left = Number(el.dataset.cd) - now;
    const text = left > 0 ? durationText(left) : (el.dataset.done ?? "Xong");
    if (el.textContent !== text) el.textContent = text;
    el.classList.toggle("done", left <= 0);
    if (left > 0) running++;
  }
  return running;
}

/** Icon vật phẩm vẽ (Canva, assets/icon_ve) theo mã ảnh, ví dụ "trang_bi/ao/26". */
export function artUrl(ma: string): string {
  return `${import.meta.env.BASE_URL}icon_ve/${ma}.webp`;
}

/** Icon PixelLab theo khoá manifest, ví dụ "he/loi". */
export function assetUrl(key: string): string {
  return `${import.meta.env.BASE_URL}pixellab/${key}.png`;
}

const cropped = new Map<string, Promise<string>>();

/** Ảnh đồ ghép (do/mu, do/vu_khi) vẽ trong khung lớn của thân: cắt theo phần có hình để làm icon ô trang bị. */
function cropToContent(src: string): Promise<string> {
  let p = cropped.get(src);
  if (!p) {
    p = new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement("canvas");
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        const g = c.getContext("2d", { willReadFrequently: true })!;
        g.drawImage(img, 0, 0);
        const { data, width, height } = g.getImageData(0, 0, c.width, c.height);
        let x0 = width, y0 = height, x1 = -1, y1 = -1;
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            if (data[(y * width + x) * 4 + 3] > 16) {
              x0 = Math.min(x0, x);
              x1 = Math.max(x1, x);
              y0 = Math.min(y0, y);
              y1 = Math.max(y1, y);
            }
          }
        }
        if (x1 < 0) return resolve(src);
        const side = Math.max(x1 - x0, y1 - y0) + 3;
        const out = document.createElement("canvas");
        out.width = out.height = side;
        out.getContext("2d")!.drawImage(img, x0 - 1, y0 - 1, side, side, (side - (x1 - x0)) / 2 - 1, (side - (y1 - y0)) / 2 - 1, side, side);
        resolve(out.toDataURL());
      };
      img.onerror = () => resolve(src);
      img.src = src;
    });
    cropped.set(src, p);
  }
  return p;
}

/** Thay mọi `<img data-crop>` trong `root` bằng ảnh đã cắt sát hình. */
export function cropIcons(root: HTMLElement): void {
  for (const img of root.querySelectorAll<HTMLImageElement>("img[data-crop]")) {
    const src = img.getAttribute("src")!;
    img.removeAttribute("data-crop");
    void cropToContent(src).then((url) => (img.src = url));
  }
}

/** Hình hệ: viên ngọc tròn vẽ Canva (assets/icon_ve/he/<hệ>.webp, 256 px, nền trong). */
export const heArt = (e: string) => artUrl(`he/${e}`);

/** Chip hệ: icon kèm tên, màu theo GDD mục 15 (không chỉ dựa vào màu). */
export function elementChip(e: Element, withName = true): string {
  const st = ELEMENT_STYLE[e];
  return `<span class="chip el" style="--c:${st.color};--ink:${st.ink}"><img src="${heArt(e)}" alt="" onerror="this.remove()">${withName ? esc(st.name) : ""}</span>`;
}

/**
 * Bìa công pháp vẽ Canva (TechniqueCard.art: bộ ba quyển, cặp ghép hai hệ, hay quyển thuần hệ; không có thì quyển thuần
 * hệ chủ). Hệ phụ là huy hiệu tròn viền màu hệ ở góc dưới phải, vì hình cặp ghép và bộ ba chưa vẽ đủ (phiên icon gợi ý).
 * Tên hệ ghi bằng chữ ở chỗ khác trên thẻ nên không chỉ dựa vào màu.
 */
export function techCover(t: { art?: string; element: Element; subElements?: Element[] }, size: "s" | "m" | "l" = "m"): string {
  const subs = (t.subElements ?? [])
    .map((e) => `<i style="--c:${ELEMENT_STYLE[e].color}" title="Hệ phụ ${esc(ELEMENT_STYLE[e].name)}"><img src="${heArt(e)}" alt="" onerror="this.remove()"></i>`)
    .join("");
  return `<span class="tech-art ${size}"><img class="ve" src="${artUrl(t.art ?? `cong_phap/${t.element}`)}" alt="" onerror="this.remove()">${subs ? `<span class="tech-sub">${subs}</span>` : ""}</span>`;
}

export function skillChip(t: SkillType): string {
  return `<span class="chip sk"><img class="ve" src="${artUrl(`chieu/${t}`)}" alt="" onerror="this.remove()">${esc(SKILL_NAME[t])}</span>`;
}

let toastTimer = 0;
/** Thông báo ngắn ở trên thanh dưới. */
/** Việc chưa mở ở bản chơi thử: một câu chung cho người chơi, không nhắc tên khối việc nội bộ (M3…M6, Sprint). */
export function sapCo(what: string): void {
  toast(`${what} sắp có ở bản sau.`);
}

/** Nhãn "Sắp có" trên nút của việc chưa mở; nút thêm lớp sap-co cho mờ đi (bấm vẫn được, để nghe câu sapCo). */
export const SAP_CO = `<span class="sap-co-tag">Sắp có</span>`;

export function toast(text: string, bad = false): void {
  let el = document.getElementById("toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    el.setAttribute("role", "status");
    document.body.append(el);
  }
  el.textContent = text;
  el.classList.toggle("bad", bad);
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el!.classList.remove("show"), 2600);
}

/**
 * Bảng trượt từ dưới lên cho chi tiết (món đồ, thẻ điểm, Thành chủ, Tàng Kinh Các); trên máy tính là hộp thoại giữa màn.
 * Chạm nền mờ, nút × hoặc phím Esc để tắt; trả về phần thân để màn gắn sự kiện.
 */
export function openSheet(title: string, html: string, onClose?: () => void): HTMLElement {
  closeSheet();
  const wrap = document.createElement("div");
  wrap.id = "sheet";
  wrap.innerHTML = `
    <div class="sheet-bg" data-close></div>
    <section class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <header><h2>${esc(title)}</h2><button type="button" class="icon-btn" data-close aria-label="Đóng">${icon("close")}</button></header>
      <div class="sheet-body">${html}</div>
    </section>`;
  wrap.addEventListener("click", (e) => {
    if ((e.target as HTMLElement).closest("[data-close]")) {
      closeSheet();
      onClose?.();
    }
  });
  document.body.append(wrap);
  wrap.querySelector<HTMLElement>(".icon-btn")?.focus({ preventScroll: true });
  return wrap.querySelector(".sheet-body")!;
}

addEventListener("keydown", (e) => {
  if (e.key === "Escape") document.querySelector<HTMLElement>("#sheet [data-close].icon-btn")?.click();
});

export function closeSheet(): void {
  document.getElementById("sheet")?.remove();
}

export const ROLE_NAMES: Record<string, string> = {
  tong_chu: "Tông chủ", pho_tong_chu: "Phó tông chủ", truong_lao: "Trưởng lão", noi_mon: "Nội môn", ngoai_mon: "Ngoại môn",
};

/** Lời của từng mã lỗi luật, để màn hiện cho người chơi. */
export const ERROR_TEXT: Record<string, string> = {
  khong_du_quyen: "Chức vị của bạn không làm được việc này.",
  khong_thay_mon: "Không tìm thấy món này.",
  tui_day: "Túi đầy, cần trống một ô.",
  chua_du_cap: "Chưa đủ cấp để học phẩm này.",
  ngoai_mon_gioi_han: "Ngoại môn chỉ học tối đa 2 công pháp phẩm Phàm hoặc Hoàng.",
  da_hoc: "Đã học công pháp này.",
  vuot_so_cong_phap: "Chỉ mang được 4 công pháp.",
  vuot_so_suat: "Bộ truyền thụ đã đủ suất.",
  can_cap_tong_100: "Ghép 2 phụ quyển cần tông môn cấp 100.",
  sai_so_phu_quyen: "Cần 1 chủ quyển và 1–2 phụ quyển.",
  tan_quyen_trung: "Một quyển không dùng hai lần.",
  khong_co_tan_quyen: "Không còn tàn quyển này.",
  tong_chu_khong_roi_duoc: "Tông chủ không rời tông được.",
  khong_du_linh_thach: "Không đủ linh thạch.",
  chua_du_tu_vi: "Chưa đủ tu vi để đột phá.",
  khong_thay_o: "Không có ô này trên Đạo Cơ Bàn.",
  o_chua_mo: "Ô này chưa mở.",
  o_khong_nhan: "Ô này không nhận loại viên đó (ô tâm chỉ nhận ấn).",
  chua_mo: "Chưa mở ở cảnh giới này.",
  khong_phan_giai_duoc: "Đồ lục không phân giải được.",
  khong_du_khi_tinh: "Không đủ Khí Tinh.",
  khong_du_linh_van_thach: "Không đủ Linh Văn Thạch.",
  chi_tu_ren: "Chỉ người có tài năng Tu rèn làm được.",
  sai_loai: "Loại chỉ số phụ không hợp lệ.",
  khong_co_khi_linh: "Món từ tím mới có khí linh.",
  khi_linh_toi_da: "Khí linh đã cấp tối đa.",
  khong_co_lua_chon: "Khí văn này không nằm trong 3 lựa chọn.",
  khong_hop_duoc: "Hai viên không hợp được.",
  da_co_phach: "Đã có Phách hệ này.",
  lo_chua_du_cap: "Lò của tông chưa đủ cấp.",
  thieu_nguyen_lieu: "Thiếu đồ phổ, phôi hoặc nguyên liệu.",
  thieu_nguoi_luyen: "Cần đủ 4 người khác nhau cùng tông.",
  chua_co_trong_proto: "Chức năng này chưa có trong prototype.",
  // Set đồ 2.0: ghép ấn, dòng ẩn
  khong_phai_an: "Món này không phải ấn bộ.",
  an_khong_du: "Cần đủ 3 ấn cùng bộ cùng bậc.",
  an_khong_ghep_len: "Ấn bậc này không ghép lên được.",
  khong_co_dong_an: "Món này không có dòng ẩn.",
  da_lo: "Điều kiện của dòng này đã lộ.",
  khong_thay_dong: "Không thấy dòng ẩn này.",
  thieu_giam_dinh_phu: "Hết Giám Định Phù.",
  an_chua_lo: "Hiệu ứng chưa lộ: dòng phải kích phát một lần mới tẩy được.",
  // Khảm bằng kéo thả (lệnh kham)
  chua_mac_do: "Ô này chưa mặc đồ.",
  khong_kham_duoc: "Món này không khảm được.",
  het_dong_kham: "Món này đã hết dòng khảm.",
  binh_an_sai_o: "Binh ấn chỉ khảm vào vũ khí, bao tay, ngọc bội.",
  // Đi lại trên bản đồ (mapScene giữ lời riêng; đây cho nơi khác gửi cùng lệnh)
  da_o_day: "Bạn đang ở đây rồi.",
  khong_co_duong: "Không có đường tới điểm này.",
  khong_thay_diem: "Không tìm thấy điểm này.",
  khong_dang_di: "Không có hành trình nào đang đi.",
};

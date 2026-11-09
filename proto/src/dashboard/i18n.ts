// Hai ngôn ngữ cho giao diện (người dùng 2026-11-05: "dùng tiếng Việt, bổ sung thêm tiếng Anh", áp cho cả giao diện game).
// Chữ gốc trong mã là tiếng Việt và vẫn là mặc định. Chọn tiếng Anh thì lớp này dịch chữ đã hiện trên trang bằng bộ tra
// i18nTra.ts với bảng i18n/en.json (chỉ tải khi chọn tiếng Anh). Một MutationObserver dịch mọi phần tử mới gắn vào trang,
// nên không phải sửa từng màn và dịch được cả phần do phiên khác viết (màn đột phá, thông báo, chữ lấy từ nguồn dữ liệu).
// Thuộc tính aria-label, title, placeholder, alt, data-done cũng dịch. Chưa dịch: chữ vẽ trên canvas (tên địa danh trên
// bản đồ, nhãn trong cảnh three). Soát độ phủ: window.__i18n.thieu() trả các chuỗi có chữ Việt đã hiện mà chưa có trong bảng.
import { BoTra, type AmTiet } from "./i18nTra.ts";

export type Lang = "vi" | "en";

const KEY = "htk.lang";

function readLang(): Lang {
  try {
    return localStorage.getItem(KEY) === "en" ? "en" : "vi";
  } catch {
    return "vi";
  }
}

let cur: Lang = readLang();
let bo: BoTra | undefined;

export function lang(): Lang {
  return cur;
}

/** Đổi ngôn ngữ: lưu rồi tải lại trang để mọi màn vẽ lại từ đầu. */
export function setLang(l: Lang): void {
  try {
    localStorage.setItem(KEY, l);
  } catch {
    // Không lưu được (chế độ riêng tư): vẫn tải lại, lần sau về tiếng Việt.
  }
  location.reload();
}

/** Mã locale cho số và ngày giờ. */
export function locale(): string {
  return cur === "en" ? "en-US" : "vi-VN";
}

/** Dịch một chuỗi sang ngôn ngữ đang chọn (tiếng Việt, hoặc bảng chưa nạp: trả nguyên). */
export function tr(s: string): string {
  return cur === "vi" || !bo || !s ? s : bo.tr(s);
}

/** Nút đổi ngôn ngữ (VI · EN): màn dùng data-act thì bắt "lang", nơi khác gọi `bindLangSwitch`. */
export function langSwitch(): string {
  const b = (l: Lang, t: string) => `<button type="button" data-act="lang" data-lang="${l}" aria-pressed="${cur === l}" lang="${l}" title="${l === "vi" ? "Tiếng Việt" : "English"}">${t}</button>`;
  return `<span class="lang-sw" role="group" aria-label="Ngôn ngữ">${b("vi", "VI")}${b("en", "EN")}</span>`;
}

/** Gắn sự kiện cho mọi nút đổi ngôn ngữ trong `root`. */
export function bindLangSwitch(root: HTMLElement): void {
  root.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>(".lang-sw [data-lang]");
    if (b && b.dataset.lang !== cur) setLang(b.dataset.lang as Lang);
  });
}

// ---- Dịch trang -------------------------------------------------------------------------------------------------

const ATTRS = ["aria-label", "title", "placeholder", "alt", "data-done"];
/** Không dịch gì bên trong. */
const SKIP = new Set(["SCRIPT", "STYLE"]);
/** Dịch thuộc tính (placeholder…) nhưng không đụng chữ bên trong (người chơi đang gõ, mã). */
const NO_TEXT = new Set(["TEXTAREA", "CODE", "PRE"]);

/** Dịch cây DOM tại chỗ; phần tử có `data-no-tr` (chữ người chơi nhập…) và con của nó bỏ qua. */
export function translateTree(n: Node): void {
  const b = bo;
  if (cur === "vi" || !b) return;
  if (n.nodeType === Node.TEXT_NODE) {
    const v = n.nodeValue ?? "";
    if (b.can(v)) {
      const t = b.tr(v);
      if (t !== v) n.nodeValue = t;
    }
    return;
  }
  if (n.nodeType !== Node.ELEMENT_NODE) return;
  const el = n as Element;
  if (SKIP.has(el.tagName) || el.hasAttribute("data-no-tr") || (el as HTMLElement).isContentEditable) return;
  for (const a of ATTRS) {
    const v = el.getAttribute(a);
    if (v && b.can(v)) {
      const t = b.tr(v);
      if (t !== v) el.setAttribute(a, t);
    }
  }
  if (NO_TEXT.has(el.tagName)) return;
  for (let c = el.firstChild; c; c = c.nextSibling) translateTree(c);
}

function start(d: Record<string, string>, am?: AmTiet): void {
  bo = new BoTra(d, am);
  document.documentElement.lang = "en";
  document.title = tr(document.title);
  translateTree(document.body);
  new MutationObserver((list) => {
    for (const m of list) for (const n of m.addedNodes) translateTree(n);
  }).observe(document.documentElement, { childList: true, subtree: true });
}

declare global {
  interface Window {
    __i18n?: { lang: () => Lang; thieu: () => [string, number][]; thieuPhan: () => [string, number][] };
  }
}
const sorted = (m?: Map<string, number>) => [...(m ?? new Map<string, number>()).entries()].sort((a, b) => b[1] - a[1]);
window.__i18n = { lang, thieu: () => sorted(bo?.thieu), thieuPhan: () => sorted(bo?.thieuPhan) };

/**
 * Dữ liệu chữ vẽ trên canvas (bản đồ): chờ bảng nạp xong rồi dịch tại chỗ mọi trường `name`, `label`, `text` trong `p`
 * (đi sâu vào mảng và object). Tiếng Việt thì trả nguyên. Dùng ở chỗ nạp dữ liệu: `dichTen(loadJson())`.
 */
export function dichTen<T>(p: Promise<T>): Promise<T> {
  if (cur === "vi") return p;
  const KEYS = new Set(["name", "label", "text"]);
  const walk = (o: unknown): void => {
    if (Array.isArray(o)) for (const x of o) walk(x);
    else if (o && typeof o === "object") {
      const r = o as Record<string, unknown>;
      for (const [k, v] of Object.entries(r)) {
        if (typeof v === "string") {
          if (KEYS.has(k)) r[k] = tr(v);
        } else walk(v);
      }
    }
  };
  return Promise.all([p, i18nReady]).then(([d]) => {
    walk(d);
    return d;
  });
}

/**
 * Nạp xong bảng tiếng Anh và dịch trang (hoặc ngay nếu đang tiếng Việt). Hai bảng: en.json (giao diện, nội dung) và
 * en_ban_do.json (tên trên bản đồ, sinh bằng tools/i18n/ten_ban_do.cjs), bảng chính thắng khi trùng khóa; cùng từ điển âm
 * tiết am_tiet.json để tên ghép chưa có trong bảng (tông NPC, điểm bản đồ mới) vẫn dịch được.
 */
export const i18nReady: Promise<void> =
  cur === "en"
    ? Promise.all([import("./i18n/en_ban_do.json"), import("./i18n/en.json"), import("./i18n/am_tiet.json")]).then(
        ([bd, en, am]) => start({ ...(bd.default as Record<string, string>), ...(en.default as Record<string, string>) }, am.default as AmTiet),
        () => undefined,
      )
    : Promise.resolve();

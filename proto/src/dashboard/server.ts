// Nối bản chơi thử với API trên play.thienhoangky.fun (Worker `thienhoangky`, hợp đồng ở docs/api.md):
//   - gửi sự kiện analytics GDD mục 19 lên POST /api/su-kien, gom 20 giây một lần, phần còn lại gửi bằng sendBeacon khi đóng trang;
//   - gửi phản hồi POST /api/phan-hoi; đọc thông báo GET /api/thong-bao và cấu hình sống GET /api/cau-hinh.
// Sự kiện ẩn danh: chỉ kèm mã ngẫu nhiên của trình duyệt (ktlp.an_danh) và của phiên. Server biết người chơi thử qua cookie
// link mời thk_moi (HttpOnly, trình duyệt tự gửi), không có email hay số điện thoại.
// Chạy `npm run dev` (không có API) thì /api/toi không trả JSON: module tự tắt, không gửi gì.
import type { AuthSource } from "./auth.ts";

export type LoaiPhanHoi = "loi" | "gop_y" | "khac";

export interface ThongBao {
  id: number;
  tieu_de: string;
  noi_dung: string;
  muc: "thuong" | "quan_trong";
  bat_dau: number;
  ket_thuc: number | null;
}

/** Tham số cấu hình sống (mặc định ở admin/worker/cauHinh.ts). */
export type CauHinh = Record<string, number | boolean | string>;

export type TrangThaiMayChu = "dang_noi" | "co" | "khong_co" | "bi_khoa";

const CHU_KY_MS = 20_000;
const TOI_DA_MOT_LAN = 50;
const HANG_TOI_DA = 500;
/** Ẩn trang lâu hơn chừng này thì lần hiện lại tính là phiên mới. */
const PHIEN_NGHI_MS = 30 * 60_000;
const PHIEN_BAN: string = import.meta.env.VITE_PHIEN_BAN ?? "dev";

type SuKien = { loai: string; luc: number; du_lieu?: Record<string, unknown> };

function maNgauNhien(): string {
  return typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

function anDanh(): string {
  try {
    let v = localStorage.getItem("ktlp.an_danh");
    if (!v) localStorage.setItem("ktlp.an_danh", (v = maNgauNhien()));
    return v;
  } catch {
    return maNgauNhien();
  }
}

let trangThai: TrangThaiMayChu = "dang_noi";
const hang: SuKien[] = [];
let phien = maNgauNhien();
let batDauPhien = Date.now();
let anLuc = 0;
let san: Promise<boolean> | null = null;
const nghe = new Set<(t: TrangThaiMayChu) => void>();

function datTrangThai(t: TrangThaiMayChu): void {
  trangThai = t;
  for (const f of nghe) f(t);
}

/** Trạng thái nối API: "co" là đang chạy trên play.thienhoangky.fun và đã qua cổng link mời; "bi_khoa" là admin đã khóa người chơi này. */
export function trangThaiMayChu(): TrangThaiMayChu {
  return trangThai;
}

export function theoDoiTrangThai(f: (t: TrangThaiMayChu) => void): () => void {
  nghe.add(f);
  return () => nghe.delete(f);
}

async function goi<T>(path: string, init?: RequestInit): Promise<{ ok: true; data: T } | { ok: false; status: number; loi?: string }> {
  try {
    const r = await fetch(path, { credentials: "same-origin", ...init, headers: { Accept: "application/json", ...(init?.body ? { "Content-Type": "application/json" } : {}), ...init?.headers } });
    const type = r.headers.get("Content-Type") ?? "";
    if (!type.includes("application/json")) return { ok: false, status: r.status };
    const data = (await r.json()) as T & { loi?: string };
    if (!r.ok) {
      if (r.status === 403 && data.loi === "bi_khoa") datTrangThai("bi_khoa");
      return { ok: false, status: r.status, loi: data.loi };
    }
    return { ok: true, data };
  } catch {
    return { ok: false, status: 0 };
  }
}

/** Hỏi /api/toi một lần; các hàm khác chờ kết quả này. */
function sanSang(): Promise<boolean> {
  san ??= goi<{ nguoi_choi: string }>("/api/toi").then((r) => {
    if (trangThai !== "bi_khoa") datTrangThai(r.ok ? "co" : "khong_co");
    return r.ok;
  });
  return san;
}

/** Ghi một sự kiện (tên theo docs/api.md, ví dụ "chiem_diem", "tran_dau"). Không có API thì bỏ qua. */
export function ghi(loai: string, du_lieu?: Record<string, unknown>): void {
  if (trangThai === "khong_co" || trangThai === "bi_khoa") return;
  hang.push({ loai, luc: Date.now(), ...(du_lieu ? { du_lieu } : {}) });
  if (hang.length > HANG_TOI_DA) hang.splice(0, hang.length - HANG_TOI_DA);
}

function lo(suKien: SuKien[]): string {
  return JSON.stringify({ an_danh: anDanh(), phien, phien_ban: PHIEN_BAN, su_kien: suKien });
}

async function guiHang(): Promise<void> {
  if (!(await sanSang()) || hang.length === 0) return;
  while (hang.length) {
    const phan = hang.splice(0, TOI_DA_MOT_LAN);
    const r = await goi("/api/su-kien", { method: "POST", body: lo(phan), keepalive: true });
    if (!r.ok) {
      // Lỗi mạng hoặc server: trả lại hàng đợi, lần sau gửi tiếp. Lỗi dữ liệu (4xx) thì bỏ để khỏi kẹt mãi.
      if (r.status === 0 || r.status >= 500) hang.unshift(...phan);
      return;
    }
  }
}

/** Gửi nốt khi đóng hoặc ẩn trang (sendBeacon vẫn chạy khi trang đã đi). */
function guiBeacon(): void {
  if (trangThai !== "co" || hang.length === 0) return;
  while (hang.length) {
    const phan = hang.splice(0, TOI_DA_MOT_LAN);
    const ok = navigator.sendBeacon?.("/api/su-kien", new Blob([lo(phan)], { type: "application/json" }));
    if (!ok) {
      hang.unshift(...phan);
      return;
    }
  }
}

/** Gửi phản hồi của người chơi. Trả lỗi bằng câu tiếng Việt để màn hiện thẳng. */
export async function guiPhanHoi(loai: LoaiPhanHoi, noi_dung: string, man?: string, lien_he?: string): Promise<{ ok: true } | { ok: false; loi: string }> {
  if (!(await sanSang())) return { ok: false, loi: trangThai === "bi_khoa" ? "Tài khoản chơi thử này đang bị khóa." : "Bản này chưa nối máy chủ, chưa gửi được phản hồi." };
  const r = await goi("/api/phan-hoi", { method: "POST", body: JSON.stringify({ loai, noi_dung, man: man ?? document.body.dataset.scene ?? null, lien_he: lien_he?.trim() || null, phien_ban: PHIEN_BAN }) });
  if (r.ok) {
    ghi("phan_hoi", { loai });
    return { ok: true };
  }
  const cau: Record<string, string> = {
    qua_ngan: "Viết thêm vài chữ nữa nhé.",
    qua_dai: "Phản hồi dài quá 2000 ký tự.",
    qua_nhieu: "Hôm nay đạo hữu đã gửi nhiều phản hồi, mai gửi tiếp nhé.",
  };
  return { ok: false, loi: cau[r.loi ?? ""] ?? "Chưa gửi được, thử lại sau." };
}

/** Thông báo đang hiện (quan trọng trước). Không có API thì trả mảng rỗng. */
export async function layThongBao(): Promise<ThongBao[]> {
  if (!(await sanSang())) return [];
  const r = await goi<{ thong_bao: ThongBao[] }>("/api/thong-bao");
  return r.ok ? r.data.thong_bao : [];
}

/** Cấu hình sống (bao_tri, loi_bao_tri, nhac_nghi_phut, toc_do_kinh_te...). Không có API thì null: dùng mặc định trong mã. */
export async function layCauHinh(): Promise<CauHinh | null> {
  if (!(await sanSang())) return null;
  const r = await goi<{ cau_hinh: CauHinh }>("/api/cau-hinh");
  return r.ok ? r.data.cau_hinh : null;
}

let daChay = false;

/**
 * Gọi một lần lúc vào game (index.ts). Tự ghi: mo_phien, dong_phien (kèm số giây), ftue_buoc 1 khi xong màn đăng nhập,
 * cham_the khi chạm nút có data-act hoặc nút thanh dưới (kèm màn đang mở).
 */
export function startTelemetry(auth: AuthSource): void {
  if (daChay) return;
  daChay = true;
  ghi("mo_phien", { man: document.body.dataset.scene ?? null });
  void sanSang().then((ok) => {
    if (!ok) hang.length = 0;
    else void guiHang();
  });
  setInterval(() => void guiHang(), CHU_KY_MS);

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      anLuc = Date.now();
      ghi("dong_phien", { giay: Math.round((anLuc - batDauPhien) / 1000) });
      guiBeacon();
    } else if (anLuc && Date.now() - anLuc > PHIEN_NGHI_MS) {
      phien = maNgauNhien();
      batDauPhien = Date.now();
      ghi("mo_phien", { man: document.body.dataset.scene ?? null, quay_lai: true });
    }
  });
  addEventListener("pagehide", guiBeacon);

  // FTUE bước 1 (Đăng nhập): màn #login biến mất khi đã có phiên.
  if (!auth.session()) {
    const obs = new MutationObserver(() => {
      if (!document.getElementById("login") && auth.session()) {
        obs.disconnect();
        ghi("ftue_buoc", { buoc: 1 });
      }
    });
    obs.observe(document.body, { childList: true });
  }

  // Chạm thẻ dashboard: nút nào, ở màn nào. Giãn 300 ms để chạm liên tục không thành hàng trăm dòng.
  let cuoi = 0;
  document.addEventListener(
    "click",
    (e) => {
      const el = (e.target as Element | null)?.closest?.<HTMLElement>("[data-act], #tabbar button[data-scene]");
      if (!el || Date.now() - cuoi < 300) return;
      cuoi = Date.now();
      ghi("cham_the", { the: el.dataset.act ?? `tab:${el.dataset.scene}`, man: document.body.dataset.scene ?? null });
    },
    { capture: true, passive: true },
  );
}

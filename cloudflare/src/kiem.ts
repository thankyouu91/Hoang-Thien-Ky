// Kiểm dữ liệu đầu vào của API game (thuần, không đụng D1, để test bằng node --test).
import { LoiApi } from "./http.ts";

export const GIOI_HAN = {
  suKienMoiLan: 50,
  duLieuSuKien: 2048,
  bodySuKien: 64 * 1024,
  bodyPhanHoi: 8 * 1024,
  noiDungPhanHoi: 2000,
  phanHoiMoiNgay: 30,
} as const;

const MA = /^[A-Za-z0-9_-]{8,64}$/;
const LOAI_SU_KIEN = /^[a-z][a-z0-9_]{1,47}$/;
const NGAY = 24 * 3600 * 1000;

function laObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function chuoi(v: unknown, ten: string, toiDa: number, batBuoc: boolean): string | null {
  if (v === undefined || v === null || v === "") {
    if (batBuoc) throw new LoiApi(400, "thieu_truong", `Thiếu ${ten}.`);
    return null;
  }
  if (typeof v !== "string") throw new LoiApi(400, "sai_kieu", `${ten} phải là chuỗi.`);
  const s = v.trim();
  if (batBuoc && s.length === 0) throw new LoiApi(400, "thieu_truong", `Thiếu ${ten}.`);
  if (s.length > toiDa) throw new LoiApi(400, "qua_dai", `${ten} tối đa ${toiDa} ký tự.`);
  return s;
}

export interface SuKienHopLe {
  loai: string;
  luc: number;
  du_lieu: string;
}

export interface LoSuKien {
  an_danh: string;
  phien: string;
  phien_ban: string | null;
  su_kien: SuKienHopLe[];
  /** Số sự kiện bị bỏ vì sai (loại, giờ, dữ liệu quá lớn); không làm hỏng cả lô. */
  bo: number;
}

/** POST /api/su-kien. Sai khung (mã, mảng) thì 400; từng sự kiện sai thì bỏ riêng sự kiện đó. */
export function kiemLoSuKien(body: unknown, now: number): LoSuKien {
  if (!laObject(body)) throw new LoiApi(400, "sai_kieu", "Body phải là object.");
  const an_danh = chuoi(body.an_danh, "an_danh", 64, true)!;
  const phien = chuoi(body.phien, "phien", 64, true)!;
  if (!MA.test(an_danh) || !MA.test(phien)) throw new LoiApi(400, "ma_sai", "an_danh và phien là 8–64 ký tự A-Z a-z 0-9 _ -.");
  const phien_ban = chuoi(body.phien_ban, "phien_ban", 40, false);
  if (!Array.isArray(body.su_kien) || body.su_kien.length === 0) throw new LoiApi(400, "thieu_truong", "Thiếu su_kien (mảng).");
  if (body.su_kien.length > GIOI_HAN.suKienMoiLan) throw new LoiApi(413, "qua_nhieu", `Tối đa ${GIOI_HAN.suKienMoiLan} sự kiện mỗi lần.`);
  const out: SuKienHopLe[] = [];
  let bo = 0;
  for (const e of body.su_kien) {
    if (!laObject(e) || typeof e.loai !== "string" || !LOAI_SU_KIEN.test(e.loai)) {
      bo++;
      continue;
    }
    const luc = typeof e.luc === "number" && Number.isInteger(e.luc) ? e.luc : now;
    // Giờ máy lệch quá xa (trước 7 ngày hoặc sau 1 ngày) thì bỏ, để không làm méo retention.
    if (luc < now - 7 * NGAY || luc > now + NGAY) {
      bo++;
      continue;
    }
    const dl = e.du_lieu === undefined || e.du_lieu === null ? {} : e.du_lieu;
    if (!laObject(dl)) {
      bo++;
      continue;
    }
    const du_lieu = JSON.stringify(dl);
    if (new TextEncoder().encode(du_lieu).length > GIOI_HAN.duLieuSuKien) {
      bo++;
      continue;
    }
    out.push({ loai: e.loai, luc, du_lieu });
  }
  return { an_danh, phien, phien_ban, su_kien: out, bo };
}

export interface PhanHoiHopLe {
  loai: "loi" | "gop_y" | "khac";
  noi_dung: string;
  man: string | null;
  /** Cách liên lạc người chơi tự để lại (email, Zalo...), có thể trống. */
  lien_he: string | null;
  phien_ban: string | null;
}

export function kiemPhanHoi(body: unknown): PhanHoiHopLe {
  if (!laObject(body)) throw new LoiApi(400, "sai_kieu", "Body phải là object.");
  const loai = body.loai ?? "gop_y";
  if (loai !== "loi" && loai !== "gop_y" && loai !== "khac") throw new LoiApi(400, "loai_sai", "loai là loi, gop_y hoặc khac.");
  const noi_dung = chuoi(body.noi_dung, "noi_dung", GIOI_HAN.noiDungPhanHoi, true)!;
  if (noi_dung.length < 3) throw new LoiApi(400, "qua_ngan", "Nội dung ít nhất 3 ký tự.");
  return {
    loai,
    noi_dung,
    man: chuoi(body.man, "man", 60, false),
    lien_he: chuoi(body.lien_he, "lien_he", 120, false),
    phien_ban: chuoi(body.phien_ban, "phien_ban", 40, false),
  };
}

/** User-Agent rút gọn để lưu kèm phản hồi (không lưu IP). */
export function rutGonUA(ua: string | null): string | null {
  if (!ua) return null;
  return ua.replace(/\s+/g, " ").slice(0, 200);
}

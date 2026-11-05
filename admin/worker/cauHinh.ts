// Tham số cấu hình sống cho bản chơi thử (Cửa 1). Mọi số ở đây là ĐỀ XUẤT, người dùng duyệt lại.
// Worker game đọc `SELECT khoa, gia_tri FROM qt_cau_hinh`; khoa chưa có dòng thì dùng mac_dinh dưới đây.

import type { ThamSo } from "../shared/hopDong.ts";

export type DinhNghia = Omit<ThamSo, "gia_tri" | "sua_boi" | "sua_luc">;

export const THAM_SO: DinhNghia[] = [
  {
    khoa: "toc_do_kinh_te",
    ten: "Tốc độ kinh tế",
    mo_ta: "Nhân sản lượng mỏ, linh thạch và tài nguyên theo giờ. 1 là đúng GDD; chơi thử ngắn ngày có thể đẩy lên để người chơi thấy vòng lặp sớm hơn.",
    kieu: "so",
    min: 0.25,
    max: 10,
    buoc: 0.25,
    don_vi: "×",
    mac_dinh: 1,
  },
  {
    khoa: "he_so_tua",
    ten: "Hệ số tua thời gian",
    mo_ta: "Rút ngắn mọi đếm ngược (hành trình, xây, tu luyện, hồi mỏ). 1 là giờ thật; 4 nghĩa là 1 giờ trong game xong sau 15 phút.",
    kieu: "so",
    min: 1,
    max: 60,
    buoc: 1,
    don_vi: "×",
    mac_dinh: 1,
  },
  {
    khoa: "he_so_kinh_nghiem",
    ten: "Hệ số kinh nghiệm",
    mo_ta: "Nhân kinh nghiệm nhận từ nhiệm vụ, trận và luyện bãi quái.",
    kieu: "so",
    min: 0.25,
    max: 10,
    buoc: 0.25,
    don_vi: "×",
    mac_dinh: 1,
  },
  {
    khoa: "he_so_roi",
    ten: "Hệ số rơi tàn quyển",
    mo_ta: "Nhân tỷ lệ rơi tàn quyển ở bí cảnh và trận PvE.",
    kieu: "so",
    min: 0.25,
    max: 5,
    buoc: 0.25,
    don_vi: "×",
    mac_dinh: 1,
  },
  {
    khoa: "nhac_nghi_phut",
    ten: "Nhắc nghỉ sau (phút)",
    mo_ta: "Phút chơi liền trước khi game nhắc nghỉ. Không đổi giới hạn 60 phút mỗi ngày của người dưới 18 tuổi (GDD mục 14).",
    kieu: "so",
    min: 15,
    max: 240,
    buoc: 15,
    don_vi: "phút",
    mac_dinh: 60,
  },
  {
    khoa: "bao_tri",
    ten: "Đang bảo trì",
    mo_ta: "Bật thì game hiện màn bảo trì thay cho Động phủ; tiến độ trong trình duyệt của người chơi vẫn giữ nguyên.",
    kieu: "bat_tat",
    mac_dinh: false,
  },
  {
    khoa: "loi_bao_tri",
    ten: "Lời báo bảo trì",
    mo_ta: "Câu hiện trên màn bảo trì.",
    kieu: "chu",
    mac_dinh: "Thiên Hoang Ký đang bảo trì, đạo hữu quay lại sau ít phút.",
  },
];

/** Kiểm giá trị mới theo định nghĩa; trả về giá trị đã chuẩn hóa hoặc lỗi bằng tiếng Việt. */
export function kiemGiaTri(d: DinhNghia, v: unknown): { ok: true; v: number | boolean | string } | { ok: false; loi: string } {
  if (d.kieu === "so") {
    const n = typeof v === "string" ? Number(v.replace(",", ".")) : v;
    if (typeof n !== "number" || !Number.isFinite(n)) return { ok: false, loi: `${d.ten} phải là số` };
    if (d.min !== undefined && n < d.min) return { ok: false, loi: `${d.ten} nhỏ nhất là ${d.min}` };
    if (d.max !== undefined && n > d.max) return { ok: false, loi: `${d.ten} lớn nhất là ${d.max}` };
    return { ok: true, v: Math.round(n * 1000) / 1000 };
  }
  if (d.kieu === "bat_tat") {
    if (typeof v !== "boolean") return { ok: false, loi: `${d.ten} phải là bật hoặc tắt` };
    return { ok: true, v };
  }
  if (typeof v !== "string") return { ok: false, loi: `${d.ten} phải là chữ` };
  const s = v.trim();
  if (s.length === 0 || s.length > 300) return { ok: false, loi: `${d.ten} dài 1–300 ký tự` };
  return { ok: true, v: s };
}

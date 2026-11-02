import type { ElementId, SkillId } from "../replay/types.ts";

export interface ElementStyle {
  name: string;
  /** Chữ ngắn vẽ trên khối khi chưa có icon, để phân biệt hệ không chỉ bằng màu (GDD mục 15). */
  short: string;
  color: string;
  /** Màu chữ đọc được trên nền color */
  ink: string;
}

const DARK = "#1b1712";
const LIGHT = "#fbf6ec";

/** Bảng màu 12 hệ, GDD mục 15. */
export const ELEMENT_STYLE: Record<ElementId, ElementStyle> = {
  kim: { name: "Kim", short: "Kim", color: "#d9dde3", ink: DARK }, // trắng bạc
  moc: { name: "Mộc", short: "Mộc", color: "#3f9b4b", ink: LIGHT }, // xanh lục
  thuy: { name: "Thủy", short: "Thủy", color: "#1f4fa8", ink: LIGHT }, // lam đậm
  hoa: { name: "Hỏa", short: "Hỏa", color: "#d1352b", ink: LIGHT }, // đỏ son
  tho: { name: "Thổ", short: "Thổ", color: "#b8893b", ink: DARK }, // vàng đất
  loi: { name: "Lôi", short: "Lôi", color: "#8a3ffc", ink: LIGHT }, // tím điện
  phong: { name: "Phong", short: "Phong", color: "#86dcc8", ink: DARK }, // xanh ngọc nhạt
  quang: { name: "Quang", short: "Quang", color: "#f2c230", ink: DARK }, // vàng kim
  am_lanh: { name: "Âm lãnh", short: "Lãnh", color: "#6b7c93", ink: LIGHT }, // xám lam
  cuc_duong: { name: "Cực dương", short: "Dương", color: "#f28c28", ink: DARK }, // cam
  cuc_am: { name: "Cực âm", short: "Âm", color: "#4a3370", ink: LIGHT }, // tím than
  cuc_han: { name: "Cực hàn", short: "Hàn", color: "#a8e6f5", ink: DARK }, // xanh băng
};

/** Tên 10 loại chiêu, GDD mục 8. */
export const SKILL_NAME: Record<SkillId, string> = {
  can_don: "Cận chiến đơn",
  can_quet: "Cận chiến quét",
  tam_xa: "Tầm xa",
  dien_rong: "Diện rộng",
  ho_the: "Hộ thể",
  bua_chu: "Bùa chú",
  tran_phap: "Trận pháp",
  hoi_phuc: "Hồi phục",
  khong_che: "Khống chế",
  than_phap: "Thân pháp",
};

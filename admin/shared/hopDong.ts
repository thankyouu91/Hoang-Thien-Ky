// Hợp đồng dữ liệu giữa giao diện admin (src/) và API admin (worker/). Chỉ có kiểu và hằng, không có mã chạy theo môi trường,
// để cả hai tsconfig cùng import được.

export type VaiTro = "admin" | "van_hanh";

export const TEN_VAI_TRO: Record<VaiTro, string> = { admin: "Admin", van_hanh: "Vận hành" };

/** Nguồn số liệu game: "that" là bảng của Worker game trong D1; "mau" là dữ liệu giả cùng dạng, khi bảng game chưa có. */
export type Nguon = "that" | "mau";

export interface Toi {
  email: string;
  /** Vai trò đang dùng cho yêu cầu này (Admin bật "Xem như Vận hành" thì là van_hanh). */
  vai_tro: VaiTro;
  vai_tro_that: VaiTro;
  admin_goc: boolean;
  /** Team Access và việc đồng bộ group quản trị đã nối chưa (để màn Phân quyền hiện hướng dẫn làm tay). */
  access: { team: string; dong_bo_quan_tri: boolean };
}

// ---- Tổng quan --------------------------------------------------------------------------------------------------

/** 8 bước FTUE, GDD mục 14 "15 phút đầu". */
export const BUOC_FTUE = [
  "Đăng nhập",
  "Chọn vùng bắt đầu",
  "Nhận tài năng, tạo hình",
  "Gia nhập tông môn",
  "Ghép công pháp đầu",
  "Trận PvE đầu tiên",
  "Chiếm và thu mỏ",
  "Nhắc giờ bí cảnh",
] as const;

/** Mốc closed beta, GDD mục 19. */
export const MUC_TIEU = { ftue: 0.8, d1: 0.35, d7: 0.12, phien_ngay: 3 } as const;

export interface TongQuan {
  nguon: Nguon;
  /** Người chơi thử (nguoi_choi_thu: mỗi trình duyệt đã mở link mời), số đang khóa, số chơi hôm nay; số link mời còn dùng được. */
  nguoi_choi: { tong: number; khoa: number; hom_nay: number; link_mo: number };
  /** Mỗi ngày (giờ Việt Nam): số phiên, số người chơi. */
  theo_ngay: { ngay: string; phien: number; nguoi: number }[];
  /** Số người đã qua từng bước FTUE (chỉ số 0 là bước 1). */
  ftue: number[];
  giu_chan: { d1: TyLe; d7: TyLe };
  /** Trung bình số phiên mỗi người mỗi ngày có chơi. */
  phien_moi_nguoi: number;
}

export interface TyLe {
  /** Số người quay lại / số người đủ ngày để tính. */
  tu: number;
  mau: number;
}

// ---- Sự kiện (GDD mục 19) --------------------------------------------------------------------------------------

/** Tên loại sự kiện đề xuất theo GDD mục 19; Worker game ghi qua POST /api/su-kien. Loại lạ vẫn hiện, chỉ không có nhãn. */
export const LOAI_SU_KIEN: Record<string, string> = {
  mo_phien: "Mở phiên",
  dong_phien: "Đóng phiên",
  ftue_buoc: "Bước FTUE",
  vung_bat_dau: "Vùng bắt đầu",
  tai_nang: "Nhận tài năng",
  chiem_diem: "Chiếm điểm",
  chiem_mo: "Chiếm mỏ",
  mat_mo: "Mất mỏ",
  bi_canh: "Lượt bí cảnh",
  tan_quyen_roi: "Tàn quyển rơi",
  ghep_cong_phap: "Ghép công pháp",
  tran_dau: "Trận đấu",
  tuyen_chien: "Tuyên chiến",
  phan_boi: "Phản bội tông môn",
  giao_dich_cho: "Giao dịch chợ",
  mua_hang: "Mua hàng",
  cham_the: "Chạm thẻ dashboard",
  phan_hoi: "Gửi phản hồi",
};

/** Sự kiện ẩn danh: an_danh là mã ngẫu nhiên của trình duyệt, không nối với email (docs/api.md). */
export interface SuKien {
  id: string;
  luc: number;
  loai: string;
  an_danh: string | null;
  phien: string | null;
  phien_ban: string | null;
  du_lieu: Record<string, unknown> | null;
}

export interface DsSuKien {
  nguon: Nguon;
  dem: { loai: string; so: number }[];
  dong: SuKien[];
  /** Có trang sau: gửi lại với truoc = id cuối. */
  con: boolean;
}

// ---- Người chơi thử và link mời ---------------------------------------------------------------------------------
// Người chơi thử vào bằng link mời https://thienhoangky.fun/moi/<ma>, không qua Access và không có email
// (cloudflare/migrations/0002_link_moi.sql, docs/api.md).

export const LINK_MOI_GOC = "https://thienhoangky.fun/moi/";

/** mo: còn dùng được; tat: Admin tắt; het_luot: đủ toi_da; het_han: quá het_han. */
export type TrangThaiLink = "mo" | "tat" | "het_luot" | "het_han";

export interface LoiMoi {
  ma: string;
  ten: string;
  toi_da: number | null;
  da_dung: number;
  het_han: number | null;
  tat: boolean;
  trang_thai: TrangThaiLink;
  tao_boi: string;
  tao_luc: number;
  sua_boi: string | null;
  sua_luc: number | null;
}

export interface NguoiChoi {
  /** Mã công khai 10 ký tự của Worker game. Không phải tên hay email. */
  id: string;
  ma_moi: string;
  lan_dau: number;
  lan_cuoi: number;
  so_phien: number;
  khoa: boolean;
  ly_do_khoa: string | null;
  sua_boi: string | null;
  sua_luc: number | null;
  ghi_chu: string | null;
  so_phan_hoi: number;
}

export interface DsNguoiChoi {
  nguon: Nguon;
  link: LoiMoi[];
  dong: NguoiChoi[];
}

export interface DongBo {
  nhom: "quan_tri";
  /** false: chưa có API token và group id, admin cập nhật Access bằng tay. */
  da_noi: boolean;
  luc: number | null;
  ok: boolean | null;
  so_email: number | null;
  loi: string | null;
}

// ---- Phản hồi ----------------------------------------------------------------------------------------------------

export type TrangThaiPhanHoi = "moi" | "dang_xem" | "da_xu_ly";
export const TEN_TRANG_THAI_PH: Record<TrangThaiPhanHoi, string> = { moi: "Mới", dang_xem: "Đang xem", da_xu_ly: "Đã xử lý" };

export interface PhanHoi {
  id: string;
  luc: number;
  /** nguoi_choi_thu.id của người gửi. */
  nguoi_choi: string | null;
  /** Cách liên lạc người chơi tự để lại (có thể trống). */
  lien_he: string | null;
  loai: string | null;
  noi_dung: string;
  /** Màn hoặc ngữ cảnh người chơi đang ở khi gửi. */
  man: string | null;
  /** User-Agent rút gọn do Worker game ghi. */
  thiet_bi: string | null;
  phien_ban: string | null;
  trang_thai: TrangThaiPhanHoi;
  sua_boi: string | null;
  sua_luc: number | null;
  ghi_chu: { email: string; noi_dung: string; luc: number }[];
}

export interface DsPhanHoi {
  nguon: Nguon;
  dong: PhanHoi[];
}

// ---- Thông báo ---------------------------------------------------------------------------------------------------

export type MucThongBao = "thuong" | "quan_trong";
export type TrangThaiTB = "nhap" | "dang" | "go";
/** Trạng thái hiển thị tính từ trang_thai và giờ. */
export type HienTB = "nhap" | "hen" | "dang_hien" | "het_han" | "da_go";

export interface ThongBao {
  id: number;
  tieu_de: string;
  noi_dung: string;
  muc: MucThongBao;
  bat_dau: number;
  ket_thuc: number | null;
  trang_thai: TrangThaiTB;
  hien: HienTB;
  tao_boi: string;
  tao_luc: number;
  sua_boi: string | null;
  sua_luc: number | null;
  go_boi: string | null;
  go_luc: number | null;
}

// ---- Cấu hình sống -----------------------------------------------------------------------------------------------

export interface ThamSo {
  khoa: string;
  ten: string;
  mo_ta: string;
  kieu: "so" | "bat_tat" | "chu";
  min?: number;
  max?: number;
  buoc?: number;
  don_vi?: string;
  mac_dinh: number | boolean | string;
  gia_tri: number | boolean | string;
  sua_boi: string | null;
  sua_luc: number | null;
}

export interface LichSuCauHinh {
  id: number;
  khoa: string;
  cu: unknown;
  moi: unknown;
  ly_do: string | null;
  boi: string;
  luc: number;
}

export interface CauHinh {
  tham_so: ThamSo[];
  lich_su: LichSuCauHinh[];
}

// ---- Phân quyền và nhật ký ---------------------------------------------------------------------------------------

export interface DongVaiTro {
  email: string;
  vai_tro: VaiTro;
  ghi_chu: string | null;
  goc: boolean;
  them_boi: string | null;
  them_luc: number | null;
}

export interface DsVaiTro {
  dong: DongVaiTro[];
  dong_bo: DongBo;
  danh_sach_access: string[];
}

export interface NhatKy {
  id: number;
  luc: number;
  email: string;
  vai_tro: VaiTro;
  hanh_dong: string;
  doi_tuong: string | null;
  chi_tiet: Record<string, unknown> | null;
}

/** Nhãn tiếng Việt cho mã hành động trong nhật ký. */
export const TEN_HANH_DONG: Record<string, string> = {
  "loi_moi.tao": "Tạo link mời",
  "loi_moi.sua": "Sửa link mời",
  "loi_moi.tat": "Tắt link mời",
  "loi_moi.mo": "Mở lại link mời",
  "nguoi_choi.ghi_chu": "Ghi chú người chơi",
  "nguoi_choi.khoa": "Khóa người chơi",
  "nguoi_choi.mo_khoa": "Mở khóa người chơi",
  "phan_hoi.trang_thai": "Đổi trạng thái phản hồi",
  "phan_hoi.ghi_chu": "Ghi chú phản hồi",
  "thong_bao.tao": "Soạn thông báo",
  "thong_bao.sua": "Sửa thông báo",
  "thong_bao.go": "Gỡ thông báo",
  "cau_hinh.doi": "Đổi cấu hình",
  "vai_tro.dat": "Phân quyền",
  "vai_tro.xoa": "Thu quyền",
  "access.dong_bo": "Đồng bộ Access",
};

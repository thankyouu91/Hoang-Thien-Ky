-- Bảng của Admin Dashboard (Worker thienhoangky-admin), dùng chung D1 `thienhoangky` với Worker game.
-- Mọi bảng có tiền tố qt_ (quản trị). Bảng migration riêng: d1_migrations_qt (wrangler.jsonc), nên không đụng
-- migration của Worker game trong cloudflare/migrations/.
-- Thời gian là epoch mili giây (Date.now()). Cột *_boi, nguoi là tên đăng nhập của tài khoản quản trị.

-- Tài khoản quản trị: đăng nhập bằng tên + mật khẩu (người dùng chốt 2026-11-05). Mật khẩu chỉ lưu dạng băm
-- (worker/matKhau.ts: PBKDF2-SHA256 có muối). Tài khoản đầu tiên tạo bằng scripts/tao-tai-khoan.ts, không nằm trong migration.
CREATE TABLE IF NOT EXISTS qt_tai_khoan (
  ten              TEXT PRIMARY KEY CHECK (ten = lower(ten) AND length(ten) BETWEEN 3 AND 32),
  vai_tro          TEXT NOT NULL CHECK (vai_tro IN ('admin', 'van_hanh')),
  mat_khau         TEXT NOT NULL,
  phai_doi         INTEGER NOT NULL DEFAULT 1 CHECK (phai_doi IN (0, 1)),   -- 1: phải đổi mật khẩu trước khi làm gì khác
  khoa             INTEGER NOT NULL DEFAULT 0 CHECK (khoa IN (0, 1)),       -- Admin khóa tài khoản
  ghi_chu          TEXT,
  sai_lien_tiep    INTEGER NOT NULL DEFAULT 0,                              -- sai mật khẩu liền nhau
  tam_khoa_den     INTEGER,                                                 -- sai 5 lần liền: tạm khóa 15 phút
  dang_nhap_cuoi   INTEGER,
  doi_mat_khau_luc INTEGER,
  tao_boi          TEXT NOT NULL,
  tao_luc          INTEGER NOT NULL,
  sua_boi          TEXT,
  sua_luc          INTEGER
);

-- Phiên đăng nhập. Cookie __Host-qt giữ mã ngẫu nhiên 32 byte; bảng chỉ lưu SHA-256 của mã đó.
CREATE TABLE IF NOT EXISTS qt_phien (
  ma_bam    TEXT PRIMARY KEY,
  ten       TEXT NOT NULL,
  tao_luc   INTEGER NOT NULL,
  het_han   INTEGER NOT NULL,
  thiet_bi  TEXT
);
CREATE INDEX IF NOT EXISTS qt_phien_ten ON qt_phien (ten);

-- Đếm đăng nhập sai theo IP (băm SHA-256, không lưu IP thô) để chặn dò mật khẩu: quá 20 lần trong 15 phút thì trả 429.
CREATE TABLE IF NOT EXISTS qt_dang_nhap_sai (
  ip_bam  TEXT PRIMARY KEY,
  so_lan  INTEGER NOT NULL,
  tu_luc  INTEGER NOT NULL
);

-- Nhật ký quản trị: ai làm gì, lúc nào.
CREATE TABLE IF NOT EXISTS qt_nhat_ky (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  luc        INTEGER NOT NULL,
  nguoi      TEXT NOT NULL,
  vai_tro    TEXT NOT NULL,
  hanh_dong  TEXT NOT NULL,
  doi_tuong  TEXT,
  chi_tiet   TEXT
);
CREATE INDEX IF NOT EXISTS qt_nhat_ky_luc ON qt_nhat_ky (luc DESC);
CREATE INDEX IF NOT EXISTS qt_nhat_ky_nguoi ON qt_nhat_ky (nguoi, luc DESC);

-- Cấu hình sống: Worker game đọc `SELECT khoa, gia_tri FROM qt_cau_hinh`. gia_tri là JSON (số, chuỗi, true/false).
-- Khoa nào chưa có dòng thì game dùng mặc định trong admin/worker/cauHinh.ts (cũng trả ở GET /api/cau-hinh).
CREATE TABLE IF NOT EXISTS qt_cau_hinh (
  khoa     TEXT PRIMARY KEY,
  gia_tri  TEXT NOT NULL,
  sua_boi  TEXT NOT NULL,
  sua_luc  INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS qt_cau_hinh_lich_su (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  khoa   TEXT NOT NULL,
  cu     TEXT,
  moi    TEXT NOT NULL,
  ly_do  TEXT,
  boi    TEXT NOT NULL,
  luc    INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS qt_cau_hinh_lich_su_luc ON qt_cau_hinh_lich_su (luc DESC);

-- Thông báo hiện ở Động phủ. trang_thai: nhap (chưa đăng), dang (đã đăng, hiện trong [bat_dau, ket_thuc)), go (đã gỡ).
-- Worker game đọc: trang_thai = 'dang' AND bat_dau <= now AND (ket_thuc IS NULL OR ket_thuc > now).
CREATE TABLE IF NOT EXISTS qt_thong_bao (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  tieu_de    TEXT NOT NULL,
  noi_dung   TEXT NOT NULL,
  muc        TEXT NOT NULL DEFAULT 'thuong' CHECK (muc IN ('thuong', 'quan_trong')),
  bat_dau    INTEGER NOT NULL,
  ket_thuc   INTEGER,
  trang_thai TEXT NOT NULL DEFAULT 'nhap' CHECK (trang_thai IN ('nhap', 'dang', 'go')),
  tao_boi    TEXT NOT NULL,
  tao_luc    INTEGER NOT NULL,
  sua_boi    TEXT,
  sua_luc    INTEGER,
  go_boi     TEXT,
  go_luc     INTEGER
);
CREATE INDEX IF NOT EXISTS qt_thong_bao_hien ON qt_thong_bao (trang_thai, bat_dau);

-- Ghi chú nội bộ về người chơi thử. Người chơi thử (nguoi_choi_thu, link mời loi_moi) là bảng của Worker game
-- (cloudflare/migrations/0002_link_moi.sql); admin chỉ ghi loi_moi và cột khoa của nguoi_choi_thu, còn ghi chú để ở đây.
CREATE TABLE IF NOT EXISTS qt_ghi_chu_nguoi_choi (
  nguoi_choi_id TEXT PRIMARY KEY,
  ghi_chu       TEXT NOT NULL,
  sua_boi       TEXT NOT NULL,
  sua_luc       INTEGER NOT NULL
);

-- Xử lý phản hồi: phản hồi gốc do Worker game ghi (bảng phan_hoi); ở đây chỉ có trạng thái và ghi chú nội bộ.
CREATE TABLE IF NOT EXISTS qt_phan_hoi_xu_ly (
  phan_hoi_id TEXT PRIMARY KEY,
  trang_thai  TEXT NOT NULL CHECK (trang_thai IN ('moi', 'dang_xem', 'da_xu_ly')),
  sua_boi     TEXT NOT NULL,
  sua_luc     INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS qt_phan_hoi_ghi_chu (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  phan_hoi_id  TEXT NOT NULL,
  nguoi        TEXT NOT NULL,
  noi_dung     TEXT NOT NULL,
  luc          INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS qt_phan_hoi_ghi_chu_ph ON qt_phan_hoi_ghi_chu (phan_hoi_id, luc);

-- Bảng của Admin Dashboard (Worker thienhoangky-admin), dùng chung D1 `thienhoangky` với Worker game.
-- Mọi bảng có tiền tố qt_ (quản trị). Bảng migration riêng: d1_migrations_qt (wrangler.jsonc), nên không đụng
-- migration của Worker game trong cloudflare/migrations/.
-- Thời gian là epoch mili giây (Date.now()). Email luôn viết thường.

-- Phân quyền: email nào là Admin, email nào là Vận hành. Email trong biến ADMIN_GOC luôn là Admin, không cần dòng ở đây.
CREATE TABLE IF NOT EXISTS qt_vai_tro (
  email     TEXT PRIMARY KEY,
  vai_tro   TEXT NOT NULL CHECK (vai_tro IN ('admin', 'van_hanh')),
  ghi_chu   TEXT,
  them_boi  TEXT NOT NULL,
  them_luc  INTEGER NOT NULL,
  sua_boi   TEXT,
  sua_luc   INTEGER
);

-- Nhật ký quản trị: ai làm gì, lúc nào. Nơi duy nhất ngoài các bảng dữ liệu được ghi email.
CREATE TABLE IF NOT EXISTS qt_nhat_ky (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  luc        INTEGER NOT NULL,
  email      TEXT NOT NULL,
  vai_tro    TEXT NOT NULL,
  hanh_dong  TEXT NOT NULL,
  doi_tuong  TEXT,
  chi_tiet   TEXT
);
CREATE INDEX IF NOT EXISTS qt_nhat_ky_luc ON qt_nhat_ky (luc DESC);
CREATE INDEX IF NOT EXISTS qt_nhat_ky_email ON qt_nhat_ky (email, luc DESC);

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
  email        TEXT NOT NULL,
  noi_dung     TEXT NOT NULL,
  luc          INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS qt_phan_hoi_ghi_chu_ph ON qt_phan_hoi_ghi_chu (phan_hoi_id, luc);

-- Trạng thái đồng bộ Access Group của admin (lần cuối, kết quả), để màn Phân quyền báo còn phải làm tay hay không.
CREATE TABLE IF NOT EXISTS qt_dong_bo (
  nhom     TEXT PRIMARY KEY CHECK (nhom IN ('quan_tri')),
  luc      INTEGER NOT NULL,
  ok       INTEGER NOT NULL,
  so_email INTEGER NOT NULL,
  loi      TEXT
);

-- Thiên Hoang Ký — bảng của Worker game (`thienhoangky`) trong D1 `thienhoangky`, cho bản chơi thử Cửa 1.
-- Bảng quản trị (thông báo, cấu hình sống, phân quyền, nhật ký, khóa người chơi) có tiền tố qt_ và thuộc
-- Admin Dashboard: admin/migrations/, bảng theo dõi riêng d1_migrations_qt.
--
-- Chỉ lưu email người chơi thử (qua Access), sự kiện ẩn danh và phản hồi. Số điện thoại, ngày sinh, người giám hộ
-- KHÔNG lên server: màn OTP thử giữ trong trình duyệt (GDD mục 16, 18). Thời gian là mili giây UTC như Date.now().

-- Người chơi thử đã gọi API ít nhất một lần. Không nối với mã ẩn danh của sự kiện.
CREATE TABLE nguoi_choi_thu (
  email     TEXT PRIMARY KEY,
  lan_dau   INTEGER NOT NULL,
  lan_cuoi  INTEGER NOT NULL,
  so_phien  INTEGER NOT NULL DEFAULT 0    -- cộng 1 mỗi sự kiện mo_phien
);

-- Sự kiện analytics (GDD mục 19). Không có email: an_danh là mã ngẫu nhiên của trình duyệt, phien là mã ngẫu nhiên của phiên.
CREATE TABLE su_kien (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  loai       TEXT    NOT NULL,
  an_danh    TEXT    NOT NULL,
  phien      TEXT    NOT NULL,
  luc        INTEGER NOT NULL,              -- giờ máy người chơi lúc xảy ra
  nhan_luc   INTEGER NOT NULL,              -- giờ server lúc nhận
  du_lieu    TEXT    NOT NULL DEFAULT '{}', -- JSON thuộc tính, tối đa 2 KB
  phien_ban  TEXT                           -- phiên bản bản build
);
CREATE INDEX su_kien_luc ON su_kien (luc);
CREATE INDEX su_kien_loai_luc ON su_kien (loai, luc);
CREATE INDEX su_kien_an_danh_luc ON su_kien (an_danh, luc);

-- Phản hồi trong game. Có email để ban vận hành hỏi lại. Trạng thái xử lý ở qt_phan_hoi_xu_ly (phan_hoi_id = CAST(id AS TEXT)).
CREATE TABLE phan_hoi (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  email      TEXT    NOT NULL,
  loai       TEXT    NOT NULL CHECK (loai IN ('loi', 'gop_y', 'khac')),
  noi_dung   TEXT    NOT NULL,
  man        TEXT,                          -- màn đang mở khi gửi
  thiet_bi   TEXT,                          -- User-Agent rút gọn (không lưu IP)
  phien_ban  TEXT,
  luc        INTEGER NOT NULL
);
CREATE INDEX phan_hoi_luc ON phan_hoi (luc);
CREATE INDEX phan_hoi_email_luc ON phan_hoi (email, luc);

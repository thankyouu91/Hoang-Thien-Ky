-- Đổi cách vào chơi thử (người dùng chốt 2026-11-05): người chơi vào bằng LINK MỜI https://thienhoangky.fun/moi/<ma>,
-- không qua Cloudflare Access và không lưu email người chơi. Worker game cấp cookie HttpOnly `thk_moi` khi link hợp lệ.
-- Hai bảng cũ nguoi_choi_thu (theo email) và phan_hoi (có email) đang trống nên tạo lại.

DROP TABLE IF EXISTS nguoi_choi_thu;
DROP TABLE IF EXISTS phan_hoi;

-- Link mời. Admin Dashboard tạo, sửa, tắt; Worker game tăng da_dung khi có người dùng link.
CREATE TABLE loi_moi (
  ma        TEXT PRIMARY KEY CHECK (length(ma) BETWEEN 6 AND 40),
  ten       TEXT    NOT NULL,                 -- nhãn: link phát ở đâu, cho ai
  toi_da    INTEGER,                          -- số người tối đa; NULL: không giới hạn
  da_dung   INTEGER NOT NULL DEFAULT 0,
  het_han   INTEGER,                          -- ms; NULL: không hết hạn
  tat       INTEGER NOT NULL DEFAULT 0 CHECK (tat IN (0, 1)),
  tao_boi   TEXT    NOT NULL,
  tao_luc   INTEGER NOT NULL,
  sua_boi   TEXT,
  sua_luc   INTEGER
);

-- Người chơi thử: một dòng cho mỗi trình duyệt đã mở link mời. Không có email, số điện thoại hay tên.
CREATE TABLE nguoi_choi_thu (
  id          TEXT PRIMARY KEY,                -- mã công khai 10 ký tự, hiện trong Admin
  the_hash    TEXT    NOT NULL UNIQUE,         -- SHA-256 (hex) của cookie thk_moi; cookie là thẻ vào, không lưu thẳng
  ma_moi      TEXT    NOT NULL REFERENCES loi_moi (ma),
  lan_dau     INTEGER NOT NULL,
  lan_cuoi    INTEGER NOT NULL,
  so_phien    INTEGER NOT NULL DEFAULT 0,      -- cộng 1 mỗi sự kiện mo_phien
  khoa        INTEGER NOT NULL DEFAULT 0 CHECK (khoa IN (0, 1)),
  ly_do_khoa  TEXT,
  sua_boi     TEXT,
  sua_luc     INTEGER
);
CREATE INDEX nguoi_choi_thu_ma_moi ON nguoi_choi_thu (ma_moi);

-- Phản hồi trong game. nguoi_choi = nguoi_choi_thu.id; lien_he là cách liên lạc người chơi tự để lại (có thể trống).
-- Trạng thái xử lý ở qt_phan_hoi_xu_ly (phan_hoi_id = CAST(id AS TEXT)).
CREATE TABLE phan_hoi (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  nguoi_choi  TEXT    NOT NULL,
  loai        TEXT    NOT NULL CHECK (loai IN ('loi', 'gop_y', 'khac')),
  noi_dung    TEXT    NOT NULL,
  man         TEXT,
  lien_he     TEXT,
  thiet_bi    TEXT,                            -- User-Agent rút gọn (không lưu IP)
  phien_ban   TEXT,
  luc         INTEGER NOT NULL
);
CREATE INDEX phan_hoi_luc ON phan_hoi (luc);
CREATE INDEX phan_hoi_nguoi_choi_luc ON phan_hoi (nguoi_choi, luc);

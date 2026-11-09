-- Đặt lại mật khẩu qua email (người dùng yêu cầu 2026-11-05, chỉ cho tài khoản quản trị, giữ gói Workers Free).
-- Gói Free chỉ gửi được tới "verified destination addresses" của Email Routing, nên email của tài khoản phải được
-- thêm và xác nhận ở Email Routing trước (admin/README.md).

-- Email nhận link đặt lại; NULL là không đặt lại qua email được. Chỉ Admin (màn Tài khoản) và chính chủ thấy.
ALTER TABLE qt_tai_khoan ADD COLUMN email TEXT;

-- Link đặt lại: token ngẫu nhiên 256 bit nằm ở phần # của link (không vào log, không vào Referer); bảng chỉ giữ SHA-256.
-- Hết hạn sau 30 phút, dùng một lần; đặt mật khẩu xong thì mọi link khác của tài khoản cũng hết dùng.
CREATE TABLE IF NOT EXISTS qt_dat_lai (
  ma_bam   TEXT PRIMARY KEY,
  ten      TEXT NOT NULL,
  tao_luc  INTEGER NOT NULL,
  het_han  INTEGER NOT NULL,
  da_dung  INTEGER NOT NULL DEFAULT 0 CHECK (da_dung IN (0, 1))
);
CREATE INDEX IF NOT EXISTS qt_dat_lai_ten ON qt_dat_lai (ten, tao_luc);

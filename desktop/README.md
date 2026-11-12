# Thiên Hoang Ký — bản máy tính

Vỏ Electron mở bản game đã build (`proto/dist`) trong cửa sổ riêng, chơi không cần trình duyệt hay mạng. Thư mục này không nằm trong
workspaces của repo, có `node_modules` riêng.

## Lệnh

Chạy trong `desktop/`:

- `npm.cmd install` — cài Electron và electron-builder (lần đầu).
- `npm.cmd start` — mở game từ `proto/dist` (cần `npm.cmd run build` trong `proto/` trước).
- `npm.cmd run dist` — build `proto` rồi đóng gói bộ cài Windows: `desktop/dist/ThienHoangKy-Setup-<phiên bản>.exe`.

Phiên bản lấy từ `version` trong `package.json` của thư mục này; tăng số đó trước khi phát hành bản mới.

## Cần biết

- Tiến độ lưu ở `localStorage` của ứng dụng, trong `%APPDATA%\thien-hoang-ky-desktop`. Nó tách khỏi tiến độ trên trình duyệt
  (`play.thienhoangky.fun`), không tự chuyển sang.
- Gỡ cài đặt không xóa thư mục dữ liệu đó; cài bản mới đè lên thì tiến độ giữ nguyên.
- Bộ cài chưa ký số: Windows SmartScreen sẽ hiện cảnh báo "Windows protected your PC", bấm "More info" rồi "Run anyway".
- Bản cài không tự cập nhật; muốn bản mới phải tải và chạy bộ cài mới.
- F11 bật tắt toàn màn hình.
- Trang được nạp qua giao thức riêng `app://game/` (xem `main.cjs`) vì ES module và `fetch` không chạy trên `file://`.

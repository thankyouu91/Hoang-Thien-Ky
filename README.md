# Thiên Hoang Ký — mã nguồn

MMORPG mobile tiên hiệp thời gian thực xoay quanh tông môn (chuyển từ chiến lược dashboard ngày 2026-11-09; tên cũ: Khai Tông Lập Phái, Hoàng Thiên Ký). Thiết kế đầy đủ nằm trong `docs/gdd/` (GDD, git là nguồn sự thật).

## Cấu trúc

| Thư mục | Nội dung | Trạng thái |
|---|---|---|
| `docs/gdd` | GDD Thiên Hoang Ký (nguồn sự thật từ 2026-11-09): GDD chính, Nhiệm vụ, Trang bị, Hub (README) | Có |
| `packages/sim` | Thư viện mô phỏng trận deterministic (fixed-point, RNG có seed, 20 tick/giây, mã băm trạng thái): ghép công pháp, sân đấu, 10 loại chiêu, hiệu ứng 12 hệ, tài năng. Từ 2026-11-09 chạy trên combat server cho trận thời gian thực; client dùng để hiển thị và phát lại chiến báo | Sprint 0–1: xong |
| `packages/rules` | Luật game bằng TypeScript thuần: tàn quyển, Tàng Kinh Các, tông môn, mỏ; chạy trong prototype rồi mang nguyên vào Nakama | Sprint 2, 5 |
| `tools/balance` | Chạy hàng nghìn trận, xuất tỷ lệ thắng theo hệ, loại chiêu và tổ hợp | Sprint 2 |
| `proto` | Prototype web (Vite + canvas) chơi một mình: xem trận, bản đồ, dashboard. Từ 2026-11-09 giữ làm testbench cho sim và dashboard; map mở real-time làm mới ở Cửa 1 | Sprint 3–7: đã có khung |
| `assets/pixellab` | Hình từ PixelLab và `manifest.json` ghi nguồn gốc từng hình | Sprint 3: còn trống |
| `tools/mapgen` | Sinh bản đồ điểm từng vùng | Sprint 4 |
| `data/maps` | Khung bản đồ 4 vị diện và toạ độ thành chủ | Có |
| `server/nakama` | Module TypeScript cho Nakama: tài khoản, tông môn, bản đồ điểm | MVP, khối M1 |
| `worker/combat` | Pool worker Node.js chạy `packages/sim` tính trận thời gian thực (trước là worker xác minh trận) | MVP, khối M2 |
| `client` | Cocos Creator 3.8: dashboard, bản đồ tranh, bản đồ mini, xem trận | MVP, khối M4 |
| `tools/bots` | Bot kiểm thử tải | MVP, khối M8 |

## Chạy

Cần Node.js 22.6 trở lên (Node 24 chạy thẳng file `.ts`, không cần build).

```
npm.cmd test        # chạy test (trong PowerShell dùng npm.cmd, hoặc mở cmd)
npm.cmd run bench   # đo tốc độ mô phỏng
```

Xem lộ trình ở `docs/ROADMAP.md`.

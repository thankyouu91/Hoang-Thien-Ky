# Khai Tông Lập Phái — mã nguồn

Game mobile chiến lược tông môn dạng dashboard, có yếu tố nhập vai tu tiên. Thiết kế đầy đủ nằm trong GDD (`C:\Project\GDD\Khai_Tong_Lap_Phai_GDD.md`, bản gốc trên Claude Docs).

## Cấu trúc

| Thư mục | Nội dung | Trạng thái |
|---|---|---|
| `packages/sim` | Thư viện mô phỏng trận deterministic (fixed-point, RNG có seed, 20 tick/giây, mã băm trạng thái): ghép công pháp, sân đấu, 10 loại chiêu, hiệu ứng 12 hệ, tài năng. Dùng chung cho client, worker xác minh và bot | Sprint 0–1: xong |
| `packages/rules` | Luật game bằng TypeScript thuần: tàn quyển, Tàng Kinh Các, tông môn, mỏ; chạy trong prototype rồi mang nguyên vào Nakama | Sprint 2, 5 |
| `tools/balance` | Chạy hàng nghìn trận, xuất tỷ lệ thắng theo hệ, loại chiêu và tổ hợp | Sprint 2 |
| `proto` | Prototype web (Vite + canvas) chơi một mình tới Cửa 1: xem trận, bản đồ, dashboard; bỏ đi sau Cửa 1 | Sprint 3–7: đã có khung |
| `assets/pixellab` | Hình từ PixelLab và `manifest.json` ghi nguồn gốc từng hình | Sprint 3: còn trống |
| `tools/mapgen` | Sinh bản đồ điểm từng vùng | Sprint 4 |
| `data/maps` | Khung bản đồ 4 vị diện và toạ độ thành chủ | Có |
| `server/nakama` | Module TypeScript cho Nakama: tài khoản, tông môn, bản đồ điểm | MVP, khối M1 |
| `worker/verify` | Worker Node.js xác minh trận qua hàng đợi | MVP, khối M2 |
| `client` | Cocos Creator 3.8: dashboard, bản đồ tranh, bản đồ mini, xem trận | MVP, khối M4 |
| `tools/bots` | Bot kiểm thử tải | MVP, khối M8 |

## Chạy

Cần Node.js 22.6 trở lên (Node 24 chạy thẳng file `.ts`, không cần build).

```
npm.cmd test        # chạy test (trong PowerShell dùng npm.cmd, hoặc mở cmd)
npm.cmd run bench   # đo tốc độ mô phỏng
```

Xem lộ trình ở `docs/ROADMAP.md`.

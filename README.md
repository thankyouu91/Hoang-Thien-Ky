# Khai Tông Lập Phái — mã nguồn

Game mobile chiến lược tông môn dạng dashboard, có yếu tố nhập vai tu tiên. Thiết kế đầy đủ nằm trong GDD (`C:\Project\GDD\Khai_Tong_Lap_Phai_GDD.md`, bản gốc trên Claude Docs).

## Cấu trúc

| Thư mục | Nội dung | Trạng thái |
|---|---|---|
| `packages/sim` | Thư viện mô phỏng trận deterministic (fixed-point, RNG có seed, 20 tick/giây, mã băm trạng thái), dùng chung cho client, worker xác minh và bot | Sprint 0: đang làm |
| `packages/shared` | Kiểu dữ liệu và cấu hình dùng chung | Sau |
| `server/nakama` | Module TypeScript cho Nakama | Sprint 2 |
| `worker/verify` | Worker Node.js xác minh trận qua hàng đợi | Sprint 3 |
| `client` | Cocos Creator 3.8 | Sprint 4 |
| `tools/bots` | Bot kiểm thử tải | Sprint 6 |
| `data/maps` | Khung bản đồ 4 vị diện và toạ độ thành chủ | Có |

## Chạy

Cần Node.js 22.6 trở lên (Node 24 chạy thẳng file `.ts`, không cần build).

```
npm.cmd test        # chạy test (trong PowerShell dùng npm.cmd, hoặc mở cmd)
npm.cmd run bench   # đo tốc độ mô phỏng
```

Xem lộ trình ở `docs/ROADMAP.md`.

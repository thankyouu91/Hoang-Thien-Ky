# hieu_ung — hiệu ứng chiêu thức

Thư mục tập trung mọi thứ về hiệu ứng chiêu trong trận (người dùng yêu cầu ngày 2026-11-03). Luật hiệu ứng (chiêu làm gì) vẫn nằm ở `packages/sim` và GDD mục 8–9; ở đây chỉ là phần nhìn.

## Hiện trạng (trước khi gom về đây)

| Phần | Nằm ở | Làm bằng |
|---|---|---|
| Hình dạng theo loại chiêu: đạn bay, vệt chém, vòng báo trước rồi nổ | `proto/src/scenes/battle/fx.ts`, `motifs.ts` | Canvas 2D, hạt theo seed, tua tới lui vẫn y hệt |
| 4 hiệu ứng pixel: trận đồ, nổ vùng, chạm trúng, chiêu cuối | `proto/src/scenes/battle/vfx.ts`, ảnh ở `assets/pixellab/vfx/` | PixelLab `vfx_workbench`, bản xám tô theo màu hệ |
| Nền sân đấu | `proto/src/three/` (`renderArena`) | Three.js |
| Màu và ký hiệu 12 hệ | `proto/src/theme/elements.ts` | Bảng GDD mục 15 |

## Quy ước khi làm ở đây

- Mỗi hiệu ứng là hàm của thời điểm phát t và seed của sự kiện trong replay, để tua tới lui và xem lại cho cùng một hình.
- Màu lấy từ `theme/elements.ts`, không viết cứng.
- Không sửa `packages/sim`; cần thêm dữ liệu sự kiện thì nhắn phiên giữ sim.
- Hiệu ứng Three.js dùng renderer chung trong `proto/src/three/`, không mở WebGL context riêng.
- Giữ 60 khung/giây ở khung 375×812 khi cả hai đội cùng ra chiêu.

# Lộ trình triển khai

Kế hoạch chi tiết, lý do và các việc chờ quyết nằm ở `docs/KE_HOACH.md` (duyệt 2026-11-02). Sprint dài 2 tuần.

## Prototype (tới Cửa 1)

| Sprint | Lịch | Nội dung | Kết quả cần có | Trạng thái |
|---|---|---|---|---|
| 0 | 02/11 | Repo, `packages/sim` lõi deterministic | Test 10.000 trận so mã băm; đo ms/trận trên Node | Xong |
| 1 | 02/11 – 15/11 | Trận đấu đúng GDD mục 8–9: sân đấu, mana, 10 loại chiêu, ghép công pháp và công thức sát thương, hiệu ứng 12 hệ, tài năng | Hai công pháp ví dụ ở mục 9 ra đúng số; 10.000 trận khớp mã băm; trận 10 đấu 10 dưới 1 ms | Xong. Đã chốt trận trung bình khoảng 30 giây: chỉ số chuẩn theo cấp dò cho mức này; 10 đấu 10 (4 công pháp mỗi người) trung bình 29 giây, 0,98 ms/trận, hòa 1,4% |
| 2 | 16/11 – 29/11 | `packages/rules`: 480 tàn quyển, ghép công pháp, bộ truyền thụ, luật xuất sư và phản bội; `tools/balance` | Đội yếu hơn 15% đúng hệ khắc thắng ≥ 50%; không tổ hợp nào thắng quá 65% | |
| 3 | 30/11 – 13/12 | `proto/` xem trận trên web; bộ hình đầu tiên từ PixelLab | Trận 10 đấu 10 chạy 60 khung/giây trên Android tầm trung | |
| 4 | 14/12 – 27/12 | Bản đồ điểm từ địa hình Azgaar (`tools/mapgen`): heightmap từ khung, xuất JSON, đặt điểm theo vùng; kéo và zoom, sương mù theo số chặng | Vùng Lôi Đình Cốc mượt trên điện thoại; mọi điểm tới được thành chủ | Làm trước, 2026-11-02: bản đồ Hạ vị chốt trong Azgaar (không biển, mưa và biome theo hệ); Lôi Đình Cốc có file điểm qua 21 phép kiểm, người dùng đã duyệt ảnh. Còn: chia số điểm theo diện tích, ảnh nền bản đồ tranh, vẽ trong `proto/` |
| 5 | 28/12 – 10/01 | Lập tông theo địa thế, Truyền Tống Trận, chiếm điểm, mỏ tính lười, hiến tế, Tàng Kinh Các; server giả trong Web Worker | Test đưa tông môn từ cấp 1 lên cấp 30 chỉ bằng lệnh | |
| 6 | 11/01 – 24/01 | Tông môn NPC, trận tranh điểm, bí cảnh 12:00 và 20:00 | | |
| 7 | 25/01 – 14/02 | Dashboard tối thiểu, FTUE rút gọn, analytics, bản build tĩnh (gồm tuần Tết) | Người mới chơi hết FTUE trong 15 phút | |
| 8 | 15/02 – 28/02 | Chơi thử 2 tuần; song song dựng Nakama và đo sim trong runtime Nakama | Cửa 1 | |

## MVP (tháng 5–16)

Các khối M1–M8 ở `docs/KE_HOACH.md` mục 5: Nakama và tài khoản, worker xác minh, bản đồ thời gian thực và hành trình, client Cocos, chiến tranh, vật phẩm và kinh tế, tuân thủ G1, bot và giám sát. Chia sprint chi tiết khi qua Cửa 1.

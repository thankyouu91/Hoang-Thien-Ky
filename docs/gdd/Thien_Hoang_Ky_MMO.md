# Thiên Hoang Ký — bản MMORPG chơi được: tài liệu thiết kế

> **Nguồn gốc:** viết ngược từ code ngày 2026-11-11 (theo quy trình `reverse-document` của bộ Game-Studios), không phải bản thiết kế có trước.
> Code là gốc: `proto/src/scenes/mmo/` (`tienTrinh.ts` luật, `mmoScene.ts` màn chơi, `mapKhu.ts` map) và `proto/src/scenes/bai/` (trận đánh tay).
> Khi tài liệu này lệch code thì code đúng. Số nào ghi "đề xuất" là số do phiên làm việc đặt, chưa có trong GDD chính (`Hoang_Thien_Ky_GDD.md`).
> Báo cáo rà soát đi kèm: `MMO_ra_soat_2026-11-11.md`.

## 1. Tổng quan

Game nhập vai nhìn 3/4 từ trên, chạy trong trình duyệt tại `play.thienhoangky.fun`. Một người chơi; "người chơi khác" là bot trong trình duyệt cho tới khi có máy chủ. Tiến độ lưu ở `localStorage` (khóa `htk.mmo.v1`).

Vòng chơi: đi qua các khu nối nhau → diệt dị thú bằng đánh tay và chiêu → nhặt đồ rơi → lên cấp, mặc đồ, học và lên tầng chiêu → hạ thủ lĩnh cửa bí cảnh → sang vùng kế.

## 2. Thế giới

- 13 vùng (12 hệ + Cấm Khu), mỗi vùng 9 khu theo thứ tự: Sơn môn, Đồng hoang, Mỏ dược, Hang dị thú, Mỏ quặng, Mỏ linh thạch, Đèo, Cửa bí cảnh, Bến đò. Tổng 117 khu nối thành một dải; đi tới mép trái hay phải của khu là sang khu kế.
- Sơn môn và Bến đò là khu an toàn (không quái, vào là hồi đầy máu). Cửa bí cảnh có một thủ lĩnh. Sáu khu còn lại có 24 bầy quái, mỗi bầy 6 con, và một thủ lĩnh trong bãi.
- Cấp quái của khu: `1 + 12 × vùng + 1,7 × (thứ tự khu − 1)`; khu cuối cùng cấp 155.
- Bản đồ (phím M) hai tầng: đĩa 13 vùng có sương mù cho vùng chưa tới; chín khu của một vùng, bấm khu để tự chạy tới.
- Truyền tống tới sơn môn hay bến đò đã từng tới: miễn phí khi đang đứng ở khu an toàn, ở ngoài tốn 1 Truyền Tống Phù.

## 3. Nhân vật

- Chọn lúc tạo: đạo hiệu, giới tính (nam, nữ), một trong 12 hệ. Hệ quyết định tên chiêu, màu hiệu ứng, đạo đồ.
- Máu `2000 + 220 × (cấp − 1)`; công `(100 + 12 × (cấp − 1)) × (1 + 5% × bậc cường hóa vũ khí)`, cường hóa tối đa +20.
- Tu vi lên cấp kế: `40 × cấp^1,3`. Cảnh giới mỗi 50 cấp: Luyện Khí, Trúc Cơ, Kết Đan, Nguyên Anh, Hóa Thần, mỗi cảnh giới ba kỳ.
- Điểm tiềm năng: mỗi cấp 1 điểm vào sáu thuộc tính (luật `@htk/rules` `tiem_nang.ts`); tẩy điểm miễn phí dưới cấp 50, từ đó 1.000 linh thạch.
- Bảng Nhân vật (P hoặc I): sân Pháp tướng (đạo đồ, hình nhân vật, pháp luân từ Trúc Cơ), bảy ô trang bị, chỉ số, túi, bộ trang bị, tiềm năng.

## 4. Chiến đấu

- Đánh tay thời gian thực. Đánh thường mỗi giây một đòn bằng công. Mana tối đa 300, hồi 50 mỗi giây.
- Sáu ô chiêu Q W E R T Y, chiêu cuối U (mở ở cấp 150, cần thanh nội tại đầy). Sát thương chiêu = công × hệ số × 2.
- Mười loại chiêu, tên riêng theo hệ (lấy từ `tan_quyen.json`):

| Loại | Hệ số | Mục tiêu | Hồi | Mana | Cơ chế riêng |
|---|---|---|---|---|---|
| Cận chiến quét | 1,0 | 5 | 2 s | 140 | — |
| Tầm xa | 0,95 | 2 | 1 s | 140 | — |
| Diện rộng | 0,5 | 10 | 4 s | 70 | — |
| Hộ thể | — | mình | 8 s | 25 | Khiên 25% máu trong 6 giây |
| Hồi phục | — | mình | 6 s | 180 | Hồi 20% máu |
| Cận chiến đơn | 1,3 | 1 | 1 s | 120 | Hút 20% sát thương thành máu |
| Khống chế | 0,65 | 1 | 3 s | 60 | Choáng 2 giây (thủ lĩnh 0,6 giây) |
| Thân pháp | 1,6 | 1 | 8 s | 25 | Lướt tới sát mục tiêu |
| Bùa chú | 3,0 | 1 | 4 s | 200 | Thiêu đốt thêm 60% trong 5 giây |
| Trận pháp | 4,3 | 6 | 12 s | 280 | Trận cháy 5 giây, mỗi giây 20% |

- Năm chiêu đầu có sẵn. Năm chiêu sau cần đủ cấp (5, 10, 15, 20, 30) và tàn quyển (1, 2, 3, 4, 6; hệ nào cũng được).
- Tầng chiêu 1–10 bằng điểm luyện (mỗi cấp 20 điểm, luật `layers.ts`): tăng uy lực, giảm mana. Mỗi chiêu đã học còn cho một chỉ số bị động theo tầng (công, chí mạng, sát thương chí mạng, thủ, máu, hồi chiêu, tốc đánh, giảm mana, mana tối đa).
- Lướt né (phím Cách): 180 đơn vị, 0,35 giây không dính đòn, hồi 4 giây.
- Tab khóa mục tiêu; chuột phải vào quái để khóa đánh; giữ chuột phải để chạy theo chuột.
- Treo auto (F khi không có ngữ cảnh): tự tìm quái, tự đánh, tự ra chiêu (chừa 30% mana cho hồi phục và hộ thể), tự hút đồ.
- Tự uống: máu dưới 35% uống bình máu (hồi 40%, hồi chiêu 10 giây); mana dưới 20% uống Hồi Linh Đan (hồi 50%).
- Chết: hồi sinh sau 3 giây, không mất gì.

## 5. Rơi đồ và vật phẩm

- Quái thường: 40% số lần giết là có rơi. Khi có rơi: linh thạch `(2 + cấp) ± 25%` luôn có; 30% bình máu hoặc Hồi Linh Đan; 25% nguyên liệu; 10% trang bị; 5% tàn quyển hệ của vùng.
- Thủ lĩnh: luôn rơi linh thạch, một trang bị ít nhất Lam, một bình máu; 40% thêm tàn quyển. Trong giờ Bí Cảnh Tranh Đoạt thì trang bị ít nhất Tím.
- Phẩm trang bị: Đỏ 0,5%, Vàng 3%, Tím 5%, còn lại Lục 70% và Lam 30%.
- Đồ rơi nằm trên đất 120 giây, có cột sáng màu phẩm; lại gần 125 đơn vị thì tự hút, phím F hút cả khu.
- Túi 30 ô; bình máu, Truyền Tống Phù, linh thạch là bộ đếm riêng. Nguyên liệu, đan, tàn quyển xếp chồng.
- Trang bị: 430 kiểu từ `trang_bi.json`, bảy ô. Chỉ số theo ô và cấp của món, nhân hệ số độ hiếm (1,0 → 1,55). Mũ, áo, đai, giày chia đồ nam và đồ nữ.
- Bộ trang bị: tám bộ (Vạn Kiếm, Lôi Trì, Bàn Thạch, Huyết Ảnh, Liệp Thú, Văn Uyên, Bách Thảo, Tụ Bảo), mốc 2 / 4 / 7 món, cộng dồn. Món Lam trở lên mang bộ của vùng rơi ra nó (vùng n rơi bộ thứ `n mod 8`).

## 6. Kinh tế

- Nguồn linh thạch: đồ rơi, thưởng nhiệm vụ chính (`20 × cấp khu` mỗi 8 con), treo thưởng ngày, tháp, thư, bán đồ, điểm danh tông môn.
- Chỗ tiêu: bình máu, Truyền Tống Phù, cường hóa vũ khí (`100 × (bậc + 1)^1,5`), hiến tông môn, tẩy điểm.
- Cống hiến tông môn là tiền riêng, tiêu ở Bảo Khố.

## 7. Tông môn, liên minh, hoạt động

- Tông môn (G, từ cấp 10): ba tông NPC. Đại Điện: điểm danh, ba nhiệm vụ ngày (diệt 30 dị thú, nộp 10 nguyên liệu, hạ một thủ lĩnh), quyên linh thạch hoặc nguyên liệu. Năm cấp bậc theo cống hiến cả đời, mỗi bậc cộng công. Tàng Kinh Các: 10 tàn quyển cùng hệ lên một bậc lĩnh ngộ (+1% công, tối đa 10 bậc mỗi hệ). Bảo Khố: đổi đồ bằng cống hiến. Đại Trận: chỉ hiện trạng thái.
- Liên minh (L): màn xem trước, số liệu là tông môn NPC; chỉ đồng hồ đếm tới 21:00 là thật.
- Hoạt động (V): Bí Cảnh Tranh Đoạt 12:00–12:30 và 20:00–20:30; Dị Thú Xuất Thế 21:00 (chưa mở); tháp Tầm Đạo tám tầng (tầng n là hạ thủ lĩnh cửa bí cảnh vùng n, thưởng linh thạch, tàn quyển, danh hiệu); bế quan (mỗi giờ 2% tu vi của một cấp, tối đa 8 giờ mỗi ngày).
- Thư (H): quà theo mốc cấp 1, 5, 10, 20, 30, 50.

## 8. NPC ở khu an toàn

Tám NPC đứng thẳng trên nền đất, lại gần bấm F hoặc chuột phải: Cố Tàng (nhiệm vụ, hướng dẫn), Chưởng Quỹ (tiệm), Thiết Tượng (cường hóa vũ khí), Đan Đạo (luyện 3 nguyên liệu thành một viên đan; thắp hương +10% tu vi diệt thú trong ngày), Trọng Tài (bảng Hoạt động), Mật Thám (treo thưởng ngày: 20 dị thú ở một khu), Sứ Giả (tông môn), Xa Phu (bản đồ). Danh sách NPC nằm dưới bản đồ nhỏ, bấm để tự chạy tới.

## 9. Giao diện và phím

- Trên trái: chân dung có hào quang cảnh giới, máu, mana, tu vi, linh thạch, nhiệm vụ. Trên phải: hàng nút nhanh, bản đồ nhỏ, hàng nút tròn, danh sách NPC. Dưới giữa: sáu ô vật phẩm (1 bình máu, 2 Hồi Linh Đan), nút Menu, thanh tu vi. Dưới phải: cụm phím cánh hoa. Dưới trái: nhật ký hệ thống.
- Phím: mũi tên đi; A đánh thường; Q W E R T Y chiêu; U chiêu cuối; Cách lướt; Tab khóa mục tiêu; F ngữ cảnh; 1, 2 vật phẩm; X tọa thiền; P / I nhân vật và túi; O kỹ năng; G tông môn; L liên minh; V hoạt động; M bản đồ; B tiệm; H thư; Esc đóng bảng.

## 10. Chưa có (cần máy chủ hoặc cần hình)

Người chơi thật, tổ đội, giao dịch, PvP, chợ, tranh mỏ, Công Thành Chiến, săn boss thế giới, pháp bảo, khảm ngọc, công trình trong khu an toàn (chờ sprite nền trong suốt), vùng cấm trên mặt nước.

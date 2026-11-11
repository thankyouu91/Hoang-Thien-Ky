# Rà soát bản MMORPG — 2026-11-11

Rà theo bốn quy trình của bộ Game-Studios (`C:\Project\Game-Studios`): `reverse-document`, `balance-check`, `review-all-gdds` + `scope-check`, `ux-review`. Tài liệu thiết kế viết ngược từ code: `Thien_Hoang_Ky_MMO.md`.

Cách đo: số cân bằng tính bằng script gọi thẳng luật trong `tienTrinh.ts`, `thamSo.ts` và `SKILL_SPECS` của `@htk/sim`, giả định người chơi luôn đánh quái ngang cấp ở khu hợp cấp và luôn có nhiệm vụ. Thời gian quy đổi theo 1 lần giết mỗi 3 giây (đo thực tế khi treo auto ở khu cấp thấp là nhanh hơn: 67 lần giết trong 60 giây).

## A. Cân bằng — kết luận: CÓ VẤN ĐỀ NGHIÊM TRỌNG

### A1. Nhịp lên cấp (NGHIÊM TRỌNG, ĐÃ SỬA theo quyết định cùng ngày)

| Mốc | Số lần giết | Giờ chơi (1 lần giết / 3 giây) |
|---|---|---|
| Cấp 10 | 104 | 0,1 |
| Cấp 30 | 440 | 0,4 |
| Cấp 50 | 803 | 0,7 |
| Cấp 100 | 1.776 | 1,5 |
| Cấp 150 | 2.784 | 2,3 |

- Khu cuối của thế giới là cấp 155, nên đi hết 117 khu mất chừng 2,3 giờ.
- Mục tiêu đã chốt ngày 2026-11-09 là "cấp 50 ≈ ngày 24". Hiện cấp 50 đạt trong khoảng 40 phút. Lệch hàng chục lần.
- Nguyên nhân chính: thưởng nhiệm vụ chính là 30% tu vi của một cấp cho mỗi 8 con. Ở cấp 50, không có nhiệm vụ cần 63 lần giết mỗi cấp; có nhiệm vụ còn 19.
- Vì thế bế quan (16% một cấp mỗi ngày) và thắp hương (+10%) gần như không đáng kể so với nhịp này.
- Quyết định: giữ đúng mốc "cấp 50 ≈ ngày 24". Sửa: tu vi cần `54 × cấp^2,2`; thưởng nhiệm vụ đổi thành thêm 50% tu vi của số quái vừa diệt (thưởng tính theo phần trăm một cấp thì dù tăng tu vi cần bao nhiêu, mỗi cấp cũng không quá 160 lần giết).
- Sau sửa: cấp 5 sau 128 lần giết (6 phút), cấp 10 sau 866 (0,7 giờ), cấp 20 sau 4.837 (4 giờ), cấp 30 sau 12.616 (10,5 giờ), cấp 50 sau 41.008 (34 giờ, khoảng ngày 23 nếu chơi 1,5 giờ mỗi ngày).
- Hệ quả cần theo dõi: chuỗi nhiệm vụ vẫn đẩy người chơi sang khu kế sau mỗi 8 con, nên người chơi sẽ tới khu vượt cấp mình và phải quay lại cày; mốc học chiêu (cấp 15, 20, 30) và tông môn (cấp 10) giờ xa hơn nhiều; chiêu cuối cấp 150 và tháp tầng cao là đích rất xa.

### A2. Cường hóa vũ khí không trần (ĐÃ SỬA)

- Trước: mỗi bậc +8% công, không giới hạn. +20 là +160% công, tổng giá 76.079 linh thạch, tức chừng 530 lần giết ở cấp 50. Trong khi trọn bảy món trang bị chỉ +14% công, bộ 7 món +16%, bị động công pháp tối đa +20%.
- Là chiến thuật áp đảo: dồn hết linh thạch vào vũ khí thắng mọi lựa chọn khác.
- Sửa: mỗi bậc +5%, trần +20 (tối đa +100% công). Bản lưu có bậc cao hơn 20 chỉ tính tới 20.

### A3. Bình máu cho trụ vô hạn (ĐÃ SỬA một phần)

- Trước: hồi 40% máu, hồi chiêu 5 giây, tức 8% máu mỗi giây. Ở mọi cấp, chừng đó đủ trụ trước 5–6 con ngang cấp đánh cùng lúc. Cộng với tự uống và giá bình rẻ (55 linh thạch ở cấp 50, trong khi mỗi lần giết thu khoảng 143), người chơi gần như không thể chết.
- Sửa: hồi chiêu bình máu 10 giây (trụ được khoảng 2,8 con).
- Còn lại: giá bình vẫn rẻ so với thu nhập; chết không mất gì. Chờ quyết định ở mục A1 rồi cân tiếp.

### A4. Bộ trang bị gần như không gom được (ĐÃ SỬA)

- Trước: bộ chọn ngẫu nhiên trong 8, chỉ nửa số đồ Lam có bộ. Một món đúng bộ, đúng ô cần chừng 6.300 lần giết; cả thế giới chỉ khoảng 2.800 lần.
- Sửa: món Lam trở lên mang bộ của vùng rơi ra nó (vùng n rơi bộ thứ n mod 8). Một món đúng ô giờ cần chừng 490 lần giết quái thường; thủ lĩnh luôn rơi một món có bộ. Bảng Nhân vật ghi vùng đang đứng rơi bộ nào.
- Còn lại: chỉ số công và máu của món tính theo cấp quái rơi ra nó, nên đồ nhanh lỗi thời khi lên cấp nhanh (liên quan A1). Dòng cộng của bộ là phần trăm nên không lỗi thời.

### A5. Tàn quyển quá hiếm (ĐÃ SỬA một phần)

- Trước: 0,8% mỗi lần giết quái thường. Học đủ năm chiêu cần 16 quyển, tức khoảng 2.000 lần giết nếu chỉ dựa vào quái thường.
- Sửa: 2% mỗi lần giết (5% trong số lần có rơi).
- Còn lại: lĩnh ngộ tối đa cả 12 hệ cần 1.200 quyển, vẫn ngoài tầm. Nên coi lĩnh ngộ là đích dài hạn hoặc hạ số quyển mỗi bậc.

### A6. Mana không phải là giới hạn (ĐÃ SỬA theo quyết định cùng ngày)

- Mana tối đa 300, hồi 50 mỗi giây: đầy lại sau 6 giây. Cận chiến đơn (120 mana, hồi 1 giây) gần như dùng liên tục được.
- Hệ quả: Hồi Linh Đan, bộ Văn Uyên, bị động giảm mana và mana tối đa gần như vô dụng.
- Số hồi 50 lấy của trận tự động cũ (`BATTLE.manaRegenPerSec`), chưa chỉnh cho đánh tay.
- Sửa: đánh tay hồi 15 mỗi giây (`BAI.manaRegen`), đầy lại sau 20 giây.

### A7. Linh thạch: nhiệm vụ lấn át đồ rơi (ghi nhận)

- Ở cấp 50: đồ rơi cho khoảng 20 linh thạch mỗi lần giết, thưởng nhiệm vụ chia ra là 122. Lệnh "giảm linh thạch rơi còn 40%" vì thế chỉ giảm chừng 14% thu nhập thật.

### A8. Chiêu (ghi nhận)

- Sát thương đơn mục tiêu mỗi giây theo hồi chiêu: Cận chiến đơn 2,6 lần công (kèm hút máu), Bùa chú 2,4, Tầm xa 1,9, đánh thường 1,0. Cận chiến đơn nhỉnh nhất và còn hồi máu; chưa tới mức áp đảo.
- Khống chế: choáng 2 giây, hồi 3 giây. Với giảm hồi chiêu từ bị động và bộ trang bị có thể khóa gần như liên tục một con quái thường. Thủ lĩnh chỉ choáng 0,6 giây nên không sao.
- Thân pháp yếu về sát thương (0,4 lần công mỗi giây), giá trị nằm ở lướt.

### A9. Đồ chia nam nữ (ghi nhận)

- Bốn trong bảy ô chia giới, và đồ khác giới vẫn rơi: khoảng 29% trang bị rơi ra là không mặc được.

## B. Rà chéo hệ thống và phạm vi

1. **Treo auto chơi thay toàn bộ.** Tự đánh, tự ra chiêu, tự hút đồ, tự uống thuốc, cộng với việc không thể chết (A3) và nhịp A1: game có thể tự đi hết nội dung. Trái với trụ cột "đánh tay thời gian thực" chốt 2026-11-09.
2. **Chết không có giá (ĐÃ SỬA).** Trước: hồi sinh 3 giây tại chỗ vào khu, không mất gì. Giờ: mất 5% tu vi của cấp đang có và hồi sinh ở sơn môn của vùng.
3. **Phím F ba nghĩa** (nói chuyện, nhặt đồ, bật tắt auto): đồ vừa hút xong mà bấm lần nữa là bật auto ngoài ý muốn.
4. **Bốn màn chỉ để xem:** Liên minh, thẻ Đại Trận, Dị Thú Xuất Thế, ba mục trong menu người chơi. Đều do yêu cầu, nhưng người chơi mới sẽ gặp nhiều nút không làm được gì.
5. **Tàn quyển có ba chỗ tiêu** (học chiêu, lĩnh ngộ, và là hàng ở Bảo Khố) trong khi nguồn ít: đã nới ở A5.
6. **Nguyên liệu có ba chỗ tiêu** (nhiệm vụ nộp 10, quyên 5, luyện đan 3) với nguồn khoảng 4% mỗi lần giết: hợp lý.
7. **Tải nhận thức:** hơn 20 phím, bảy nút nhanh, năm nút tròn, tám nút NPC, chín nút cụm phím, sáu ô vật phẩm, một Menu lặp lại hàng nút nhanh. Người mới không có bước dẫn dắt nào ngoài bảng hướng dẫn chữ.
8. **Dọn code thừa (đã làm):** bỏ phần vẽ khung công trình và trường `ten` còn sót sau khi gỡ tranh khỏi mặt đất.

## C. UI/UX — kết luận: CẦN SỬA

Đạt: không phần tử nào che giữa màn hình lâu; thông báo có hàng chờ (tối đa bốn dòng, ba giây); Esc và nút × đóng mọi bảng; có `prefers-reduced-motion` cho hào quang và ống máu; bảng không tràn ngang ở 375px.

Chưa đạt:

1. **Mở bảng thì mất tự uống thuốc (ĐÃ SỬA).** Thế giới không dừng khi mở bảng, mà tự uống lại tắt lúc đó: mở túi giữa bãi quái là dễ chết.
2. **Phẩm chất chỉ phân biệt bằng màu** (viền ô, cột sáng): người mù màu không phân biệt được Lục với Đỏ. Chi tiết món có ghi chữ, nhưng ô túi và đồ trên đất thì không.
3. **Chữ nhỏ dưới 12px** ở danh sách NPC (10px), nhãn phím trên cụm cánh hoa, chú thích dưới nút tròn.
4. **Màn hình cảm ứng:** không có chuột phải nên không có "mặc ngay" và menu người chơi; danh sách NPC và hàng nút nhanh ẩn dưới 760px, chỉ còn nút Menu. Cụm cánh hoa chưa kiểm trên điện thoại thật.
5. **Bảng Nhân vật quá dài** (hình, túi, bộ trang bị, tiềm năng): phải cuộn nhiều trên màn hình thấp.
6. **Không có lựa chọn cho người chơi:** tắt tự uống, đổi ngưỡng, đổi phím.
7. **Chưa có tài liệu HUD** (triết lý, mức ưu tiên từng phần tử, ngân sách hiển thị) theo mẫu của bộ Game-Studios.

## D. Việc đã sửa trong đợt này

| Việc | File |
|---|---|
| Cường hóa vũ khí: +5% mỗi bậc, trần +20 | `tienTrinh.ts` (`WPN_MAX`, `WPN_STEP`), `mmoScene.ts` (lò rèn) |
| Bình máu hồi chiêu 10 giây | `mmoScene.ts` (`POT_CD`) |
| Bộ trang bị theo vùng, mọi món Lam trở lên có bộ | `tienTrinh.ts` (`setOfRegion`, `gear`) |
| Tàn quyển 2% mỗi lần giết | `tienTrinh.ts` (`rollDrop`) |
| Tự uống thuốc cả khi đang mở bảng | `mmoScene.ts` (`usePot`, `useMana`) |
| Dọn code khung công trình thừa | `mmoScene.ts`, `mapKhu.ts` |
| Tu vi cần `54 × cấp^2,2`; thưởng nhiệm vụ = 50% tu vi số quái của nhiệm vụ | `tienTrinh.ts` (`XP_A`, `XP_POW`, `QUEST_XP`) |
| Mana hồi 15 mỗi giây | `thamSo.ts` (`manaRegen`), `bai.ts` |
| Chết: mất 5% tu vi cấp, về sơn môn | `tienTrinh.ts` (`die`), `mmoScene.ts` |

## E. Quyết định đã chốt (2026-11-11)

1. Nhịp lên cấp: đúng mốc cũ, cấp 50 ≈ ngày 24 (A1).
2. Mana: hồi 15 mỗi giây (A6).
3. Chết: về sơn môn, mất 5% tu vi cấp (B2). Treo auto giữ nguyên.
4. Đồ khác giới: vẫn rơi cả hai (A9).

## F. Còn mở

- Giá bình máu so với thu nhập (A3); lĩnh ngộ cần 1.200 tàn quyển (A5); linh thạch nhiệm vụ lấn át đồ rơi (A7).
- Chuỗi nhiệm vụ đẩy người chơi vượt cấp sau khi nhịp chậm lại (A1).
- Phím F ba nghĩa; bốn màn chỉ để xem; tải nhận thức cho người mới (B3, B4, B7).
- Mục C2 tới C7 của phần UI/UX.

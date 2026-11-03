# Kế hoạch xây dựng Khai Tông Lập Phái

Lập ngày 2026-11-02, dựa trên GDD rev 78 (Claude Docs) và repo ở commit `225a5b2`. Bản này chi tiết hoá lộ trình mục 18 của GDD; `docs/ROADMAP.md` giữ bảng tóm tắt và sẽ cập nhật theo bản này khi được duyệt.

**Đề xuất chính:** đi thẳng tới Cửa 1 bằng một bản prototype web chơi một mình, chạy trên trình duyệt điện thoại, có tông môn NPC làm đối thủ và đồng hồ tua nhanh. Nakama, Docker, Cocos và máy chủ để sang MVP. Luật game viết trong `packages/rules` (TypeScript thuần) để mang nguyên vào Nakama sau này; chỉ phần giao diện prototype là bỏ đi.

## 1. Hiện trạng

| Hạng mục | Trạng thái |
|---|---|
| `packages/sim` | Sprint 0 xong: fixed-point, RNG có seed, khắc chế 12 hệ, chênh lệch cấp, mã băm. 5/5 test qua; đo lại 2026-11-02: 0,20 ms/trận, khoảng 5.000 trận/giây trên 1 luồng |
| Trận đấu theo GDD | Mới có đòn thường + tuyệt chiêu; chưa có mana, vị trí, 10 loại chiêu, công pháp, hiệu ứng hệ |
| GDD | Phần 4A, 4B xong. Còn 4C (thú cưỡi), 4D (dashboard), mục "vận hành và admin" |
| Số liệu | `KhaiTongLapPhai_HeThong_v1.xlsx` mà GDD nhắc tới không có trên máy |
| Bản đồ | Khung 4 vị diện và toạ độ tâm vùng ở `data/maps`; chưa có đa giác vùng, chưa có điểm |
| Hình ảnh | Chưa có. PixelLab MCP chưa cài trong Claude Code |
| Máy dev | Node 24, Git; chưa có Docker |

## 2. Vì sao đổi thứ tự

`ROADMAP.md` hiện xây hạ tầng trước (Nakama ở Sprint 2, worker Sprint 3, Cocos Sprint 4), nên bản chơi thử đầu tiên chỉ có sau khoảng 4 tháng. GDD mục 18 đặt Cửa 1 trước MVP và ghi: trận đánh chưa vui thì mọi thứ xây trên nó đều phí.

| | Hạ tầng trước (ROADMAP cũ) | Prototype web trước (đề xuất) |
|---|---|---|
| Bản chơi được đầu tiên | Khoảng tháng 3–4 | Sprint 3 (xem trận), Sprint 7 (vòng chơi) |
| Cần cài | Docker, Nakama, PostgreSQL, Redis, Cocos | Không gì thêm ngoài Node |
| Claude Code tự làm được | Phần lớn, trừ dựng scene trong Cocos Editor | Toàn bộ |
| Phần bỏ đi sau Cửa 1 | Ít | Giao diện prototype và server giả (khoảng 15–20% công prototype) |
| Nếu Cửa 1 không qua | Đã tốn công hạ tầng | Chỉ sửa luật và giao diện web |

Ràng buộc để không phải viết lại: `packages/rules` không dùng API của Node hay trình duyệt, không async trong lõi, mọi lệnh đi qua một hàm `apply(state, command, now)`; từ Sprint 5 CI đóng gói thử `packages/rules` thành một file ES5 như Nakama yêu cầu.

## 3. Lộ trình theo giai đoạn

Sprint dài 2 tuần, tính từ thứ Hai 2026-11-02. Tết Nguyên Đán 2027 rơi vào 06/02, đã chừa 1 tuần nghỉ.

| Giai đoạn | Tháng (GDD) | Lịch | Sprint | Cửa ra |
|---|---|---|---|---|
| Prototype | 1–4 | 11/2026 – 02/2027 | 0–8 | Cửa 1: ghép công pháp và chiếm điểm vẫn vui sau 2 tuần chơi thử |
| MVP | 5–16 | 03/2027 – 02/2028 | M1–M8 (khoảng 24 sprint) | Cửa 2: một vùng chịu 2.000 người ảo, xác minh khớp 100%, chốt đường xin G1 |
| Closed beta | 17–20 | 03/2028 – 06/2028 | | Cửa 3: D1 ≥ 35%, D7 ≥ 12%, có Quyết định phát hành G1 |
| Open beta | 21–24 | 07/2028 – 10/2028 | | Cửa 4: D30 ≥ 5%, có tông môn chạm cấp 200 |

## 4. Prototype: từng sprint tới Cửa 1

### Sprint 1 · 02/11 – 15/11 · Trận đấu đúng GDD mục 8–9

- Sân đấu và vị trí (xem quyết định Q4), mana, di chuyển, chọn mục tiêu theo loại chiêu.
- 10 loại chiêu với đủ luật đánh đổi: vận công 1 s của diện rộng, khiên hộ thể 120%, bùa chú 3 lần/trận, trận pháp bày 5 s và tuyệt sát 15%, hồi phục tốn mana gấp 3, khống chế giảm một nửa khi liên tiếp, thân pháp lộ vị trí 3 s.
- 12 hiệu ứng đặc trưng theo hệ và buff khi luyện đúng hệ (bảng mục 9).
- Công thức D = 100 × k × 1,25^(g−1) × (1 + s_c + 0,5(s₁ + s₂)) × t, với 1,25^(g−1) là bảng tra số nguyên.
- Mỗi nhân vật 4 công pháp, tự ra chiêu theo hồi chiêu và thứ tự ưu tiên; chiêu cuối tông chủ qua nhật ký lệnh.
- Phần chiến đấu của 8 tài năng.

Xong khi: hai công pháp ví dụ ở mục 9 ra đúng 110 · 5 mục tiêu · 8% · 2 s và 95 · 2 · 12% · 1 s; 10.000 trận vẫn khớp mã băm; trận 10 đấu 10 dưới 1 ms trên Node; ghi mã băm crosscheck mới.

### Sprint 2 · 16/11 – 29/11 · Tàn quyển, ghép công pháp, công cụ cân bằng

- `packages/rules`: 480 tàn quyển (12 hệ × 10 loại × 4 biến thể Bạo, Tốc, Linh, Bền), ghép công pháp (chủ quyển + 1–2 phụ quyển, phẩm theo quyển thấp nhất, 5 hệ số tổ hợp), bộ truyền thụ 12 suất + 1 mỗi 25 cấp, luật dừng tầng khi xuất sư hoặc phản bội.
- Nạp số từ file Excel (Q2); chưa có file thì sinh từ luật trong GDD và đánh dấu tạm.
- `tools/balance`: chạy hàng nghìn trận giữa các đội mẫu, xuất CSV tỷ lệ thắng theo hệ, loại chiêu, tổ hợp.

Xong khi (đề xuất): đội yếu hơn 15% chỉ số nhưng đúng hệ khắc thắng ≥ 50% (trụ cột 2); không tổ hợp nào thắng quá 65% trước mọi đối thủ cùng sức.

### Sprint 3 · 30/11 – 13/12 · Xem trận trên web, bộ hình đầu tiên

- `proto/` (Vite + TypeScript + canvas): phát lại trận từ nhật ký lệnh, thanh máu và mana, số sát thương, icon hệ; chạy được qua mạng LAN trên điện thoại.
- PixelLab: khoá phong cách bằng 1 nhân vật mẫu, rồi 8 tu sĩ theo tài năng, 12 icon hệ, 10 icon loại chiêu (mục 6).

Xong khi: trận 10 đấu 10 chạy 60 khung/giây trên một máy Android tầm trung.

### Sprint 4 · 14/12 – 27/12 · Bản đồ điểm một vùng, địa hình từ Azgaar

Đổi ngày 2026-11-02: địa hình, sông hồ, đường và điểm đặc biệt lấy từ Azgaar Fantasy Map Generator (MIT, cài ở `C:\Project\Fantasy-Map-Generator`); vùng vẫn lấy từ khung của mình.

- Không có biển (người dùng chọn ngày 2026-11-02, vì điểm trên bản đồ sẽ là đảo nổi vẽ bằng PixelLab) và ít sông. Lòng giữa (Linh Hải) thành cao nguyên, rìa ngoài (Hư Không Hải) thành đất thấp; GDD mục 3 vẫn ghi là biển, cần sửa ở GDD.
- `tools/mapgen/heightmap.ts` (đã có): đổi `ha_khung.png` thành `ha_heightmap.png` và ảnh chỉ số vùng `ha_vung.png`. Biên giới vùng thành dãy núi có khe làm đèo, mỗi hệ một dáng địa hình, đất dốc từ lòng giữa ra rìa để sông chảy ra mép. Có thư mục Azgaar thì chép thêm heightmap "KTLP · Hạ vị diện", ảnh vùng và `azgaar-patch.ts` (thành `public/ktlp/patch.js`).
- `tools/mapgen/azgaar-patch.ts` chạy trong trang Azgaar: gán mưa và biome theo hệ của từng vùng. Không có biển thì khí hậu của Azgaar cho cả bản đồ thành sa mạc và mọi sông chảy ngoài 12 vùng. Nền ngoài vùng là biome "Hư Không": không ai ở, không mưa, không có thị trấn hay đường.
- Đã chốt ngày 2026-11-02: tùy chọn và cách sinh lại ở `data/maps/ha_azgaar_tuy_chon.json` (seed 488055760, 40K điểm, 1536 × 1024), ra `ha_azgaar.map`. Chạy lại ba lần cùng kết quả: 79 sông, 1.021 thị trấn, 696 đoạn đường. Không dùng quốc gia của Azgaar. Full JSON xuất từ Azgaar (37,7 MB, `ha_azgaar_full.json`) không vào git; `tools/mapgen` tự ghi bản rút gọn nén `ha_azgaar.json.gz` (2,3 MB) để commit.
- `tools/mapgen/vung.ts` (đã có): gán mỗi ô vào 1 trong 12 vùng theo `ha_vung.png`. Nét viền tối của khung gần màu Cửu U Uyên nên có mảnh lẻ dọc biên giới; mỗi vùng chỉ giữ mảng liền lớn nhất. Mỗi vùng có 897–2.287 ô, 2–58 chỗ đường cắt sông; Lôi Đình Cốc có 1.064 ô, 125 thị trấn, 73 ô sông, 29 chỗ đường cắt sông.
- `tools/mapgen/diem.ts` (đã có, 2026-11-02): đặt điểm và nối đường cho một vùng, ra `data/maps/ha_diem_<mã vùng>.json` (định dạng bản 1). Số điểm chia theo diện tích (người dùng chọn 2026-11-02): `MEAN_COUNTS` là mức của vùng trung bình, mỗi vùng nhân với số ô của mình chia số ô trung bình. Cùng ngày người dùng giảm mỏ linh thạch và mỏ dược còn một nửa vì quá nhiều đảo giống nhau: mức vùng trung bình giờ là 350 điểm, 60 mỏ linh thạch, 80 quặng, 40 dược, 10 linh tuyền, 6 cửa bí cảnh (tổng bớt đúng phần mỏ để số vị trí sơn môn không đổi). 12 vùng có 236 (Bích Ba Hải) tới 601 (Cuồng Phong Nguyên) điểm, tổng 4.201. GDD cần sửa: mục 3 "khoảng 450 điểm" thành 350, mục 12 "120 mỏ linh thạch, 80 mỏ dược mỗi vùng" thành 60 và 40 trung bình mỗi vùng.
    - Cửa bí cảnh chia ba bậc (người dùng chọn 2026-11-02; hình cửa xanh, vàng, đỏ), trường `tier`: `thap`, `vua`, `cao`. Xếp theo cấp nguy hiểm trong vùng: một phần ba cửa gần thành chủ nhất là thấp, xa nhất là cao, nên vùng nào cũng có đủ ba bậc. Đề xuất của phiên nhiệm vụ, đã làm: mỗi vùng ít nhất một cửa dưới cấp 50 cho nhiệm vụ đầu game; thiếu thì đổi nhãn cửa gần nhất với mỏ linh thạch quanh cấp 30 (12 vùng giờ có cửa thấp nhất cấp 21–45). Việc sau (Sprint 6): ghép 20 loại bí cảnh của GDD mục 11 vào cửa theo bậc, loại có tỷ lệ rơi gốc thấp vào bậc cao.
    - Hang dị thú là bãi quái, cấp bãi = cấp nguy hiểm của điểm (người dùng chốt qua phiên nhiệm vụ: nhiệm vụ tới cấp 60, sau đó lên cấp bằng luyện bãi). Đề xuất của phiên nhiệm vụ, đã làm: mỗi vùng ít nhất 2 hang trong 2 chặng từ thành chủ (nhiệm vụ đầu game, thuần phục thú đầu tiên) và 2 hang mỗi bậc 10 cấp từ 10 tới 250, tức tối thiểu 50 hang; phần thêm lấy bớt từ vị trí sơn môn. Hang đặt sau cùng, là điểm cụt nối bằng lối mòn vào một điểm gần đó sao cho đúng bậc cấp cần (cách 3 ô, thiếu chỗ thì tìm rộng tới 9 ô, cuối cùng mới đặt trên ô có đường), nên cấp nguy hiểm của các điểm khác không đổi.
    - Mỗi điểm có `ring`: 0 sát rìa ngoài (Hư Không Hải), 1 sát lòng giữa (Linh Hải), để nhiệm vụ chọn "nửa vùng giáp Hư Không Hải".
    - Cấp nguy hiểm tính theo quãng đường tới thành chủ (người dùng chọn 2026-11-02, thay cho số chặng): quãng đường ngắn nhất theo các chặng, đo bằng số ô (trường `distance`); cấp = 1 + quãng đường / quãng đường xa nhất × 249. Số chặng (`stages`) vẫn giữ cho tầm Truyền Tống Trận và sương mù. Mỗi vùng giờ có 54–113 mức cấp khác nhau (theo số chặng chỉ 13–35). GDD mục 3 cần sửa "cấp nguy hiểm tăng theo số chặng" thành "theo quãng đường".
    - Lôi Đình Cốc (×0,799): 280 điểm gồm 48 mỏ linh thạch, 64 quặng, 32 dược, 8 linh tuyền, 5 cửa bí cảnh (thấp 32, 80; vừa 136, 176; cao 211), 50 hang dị thú (cấp 18–246, 4 hang trong 2 chặng), 4 đèo, 10 bến đò, 58 vị trí sơn môn chia gần đều 5 địa thế (vùng không có núi lửa nên không có Hỏa mạch); 360 chặng, xa thành chủ nhất 19 chặng, 57 ô.
    - Số hang dị thú, số bến đò tối đa, số đèo mỗi vùng kề là tham số đề xuất ở đầu file.
    - Đã sinh file điểm cho cả 12 vùng (2026-11-02), vùng nào cũng đạt 28/28 phép kiểm và đủ 2 hang mỗi bậc 10 cấp; xa thành chủ nhất từ 13 chặng (Vạn Mộc Lâm) tới 35 chặng (Băng Nguyên), từ 54 ô (Bích Ba Hải) tới 115 ô (Cuồng Phong Nguyên). Số đèo hai bên mỗi biên giới khớp nhau (1–2 mỗi bên). Việc sau: nối từng cặp đèo của hai vùng thành chặng liên vùng.
- `tools/mapgen/kiem.ts` (đã có): 28 phép kiểm (có cửa bí cảnh dưới cấp 50, đủ số từng loại theo diện tích, mỗi điểm một ô trong vùng, đèo sang đúng vùng kề, mọi điểm tới được thành chủ, số chặng, quãng đường và cấp nguy hiểm khớp, mỏ dược dùng hết rừng trước, có hang ở mỗi bậc cấp có điểm (ghi rõ bậc chỉ có 1), hang gần thành chủ, có `ring`, bậc cửa bí cảnh), sai thì thoát mã 1; vẽ ảnh xem trước `data/maps/ha_diem_<mã vùng>.svg`. Người dùng đã duyệt ảnh Lôi Đình Cốc (bản 450 điểm); bố cục điểm đã đổi sau đó vì chia theo diện tích và hang theo bậc cấp.
- `tools/mapgen`: đọc JSON của Azgaar, đặt khoảng 450 điểm mỗi vùng theo số lượng ở mục 3 và 12 (120 mỏ linh thạch, 80 quặng, 80 dược, 10 linh tuyền, 6 cửa bí cảnh, 1 thành chủ, vị trí sơn môn, đèo, bến đò, hang dị thú).
    - Thành chủ đặt ở thị trấn lớn nhất của Azgaar trong vùng.
    - Đèo đặt ở khe núi biên giới, bến đò ở chỗ đường cắt sông.
    - Mỏ quặng đặt nơi cao so với chính vùng đó (Lôi Đình Cốc chỉ có 17 ô từ độ cao 62), mỏ dược đặt trong rừng.
    - Địa thế sơn môn suy từ địa hình: núi cao là Sơn hiểm, đầm hồ là Thủy trạch, núi lửa là Hỏa mạch, phế tích là Cổ tích, gần đường lớn là Thương lộ.
- Đường đi nối theo đường của Azgaar, thiếu thì nối điểm gần nhất. Cấp nguy hiểm tăng theo quãng đường tới thành chủ (đổi từ số chặng ngày 2026-11-02). Xuất JSON có số phiên bản vào `data/maps/`.
- Hình nền bản đồ tranh (đã có, 2026-11-02): `tools/mapgen/azgaar-nen.ts` chạy trong Azgaar trên bản đồ đã chốt, kiểu "ancient" (giấy cũ), chỉ bật nền, biome (mờ còn 45%), sông và biểu tượng địa hình; không nhãn, thị trấn, quốc gia hay đường. Xuất WebP tỉ lệ ×6 theo khung `map.frame` trong file điểm: Lôi Đình Cốc `data/maps/ha_nen_loi_dinh_coc.webp`, 1.926 × 1.842 px, 860 KB. Điểm (x, y) nằm ở ((x − x0) × 6, (y − y0) × 6); đã kiểm bằng màu sông: 79% tâm ô sông trúng nét sông trên ảnh, dời 4 px còn 11–18%. Đã có ảnh nền cho cả 12 vùng (`data/maps/ha_nen_<mã vùng>.webp`, 485 KB – 1,7 MB mỗi ảnh, tổng khoảng 10 MB), vẽ một lần bằng `renderZip`; vùng nào cũng đúng cỡ khung và khớp toạ độ (tâm ô sông trúng 74–93%, dời 4 px còn tối đa 28%).
- Giấy phép cần kiểm trước khi phát hành: ảnh nền dùng ảnh giấy `public/images/textures/antique-small.jpg` và bộ biểu tượng địa hình "illustrated" đi kèm Azgaar. Trang Policy của Azgaar nói font, bộ icon và hình huy hiệu đi kèm "có giấy phép riêng", nhưng trang Dependencies không ghi nguồn của hai thứ này; phải hỏi tác giả hoặc tra lịch sử repo Azgaar. Ảnh nền không có chữ nên không dính font. Nếu không dùng được thì đổi sang ảnh giấy và biểu tượng của mình (PixelLab).
- Hình điểm: mỗi điểm là một đảo nổi vẽ bằng PixelLab, đặt lên ảnh nền theo toạ độ trên; rê chuột hiện thông tin, nhấn thì mở màn con (sơn môn → bản đồ trong tông môn ở Sprint 5). Khi thu nhỏ chỉ vẽ chấm, phóng to mới hiện hình; sương mù theo số chặng cũng làm mỗi lúc chỉ vài chục hình hiện ra.
- Đổi ngày 2026-11-03 (người dùng): đảo nổi phủ kín bản đồ làm nhìn tối và rối, nên trên bản đồ lớn mỗi điểm là một ô nút vuông nhỏ (kiểu ô ký hiệu trên bản đồ cổ), trong ô là ký hiệu hệ của vùng (`assets/pixellab/he/<hệ>.png`), màu khung theo loại điểm, rê chuột hiện tên. Bản đồ lớn hiện đủ cả vị diện chứ không một góc; người chơi ở vùng nào thì phóng vào vùng đó, và chỉ tải các ô ảnh nền đang nhìn thấy để đỡ lag.
    - `tools/mapgen/ten.ts`: tên Hán Việt cho mỗi điểm (trường `name`), gốc hai chữ theo hệ của vùng cộng đuôi theo loại ("… Thành", "… Tuyền", "… Động", "… Quan", "… Độ", "… Bí Cảnh"), không trùng trong vùng.
    - `tools/mapgen/vi_dien.ts` → `data/maps/ha_vi_dien.json`: 12 vùng (file điểm, khung, thành chủ để phóng vào), ranh giới vùng dạng đường kẻ, nhãn và màu khung gợi ý theo loại điểm, bậc cửa bí cảnh (xanh, vàng, đỏ), địa thế, và các mức ảnh nền chia ô.
    - Ảnh nền cả vị diện chia ô 1024 px ở 4 mức ×1, ×2, ×4, ×6 (86 ô, 11,3 MB), vẽ bằng `renderTiles` của `azgaar-nen.ts`, lưu `data/maps/ha_nen/x<mức>/<cột>_<hàng>.webp` (đã có, 2026-11-03). Trang Azgaar gửi thẳng từng ô vào `data/maps` qua máy nhận file `tools/mapgen/nhan-file.ts` (chỉ nghe 127.0.0.1, mã ngẫu nhiên mỗi lần chạy, chỉ ghi trong `data/maps`), không qua hộp thoại lưu của trình duyệt. Đã kiểm: cả 86 ô đúng cỡ theo `ha_vi_dien.json`; ô ×6 khớp ảnh nền vùng Lôi Đình Cốc ở đúng độ lệch 0 (dời 2–4 px chênh nhiều hơn); chỗ nối hai ô liền nhau không lệch màu hơn hai cột liền nhau trong một ô. Ảnh nền từng vùng (`ha_nen_<mã vùng>.webp`) bỏ khi proto chuyển sang ô.
- Diện tích 12 vùng trong khung chênh nhau tới 2,5 lần (Bích Ba Hải nhỏ nhất, Cuồng Phong Nguyên lớn nhất). Đã chọn ngày 2026-11-02: chia số điểm theo diện tích (xem `diem.ts` ở trên).
- Prototype vẽ bản đồ, kéo và zoom, sương mù theo số chặng.
- PixelLab: icon 10 loại điểm.

Xong khi: vùng Lôi Đình Cốc mượt trên điện thoại; mọi điểm đi tới được thành chủ.

### Sprint 5 · 28/12 – 10/01 · Tông môn và kinh tế tối thiểu

- Lập tông ngẫu nhiên theo 6 loại địa thế, Chính Điện, Truyền Tống Trận tầm 1–5 chặng, chiếm điểm trong tầm, mỏ tính lười 20 × cấp^1,15 mỗi giờ, nâng mỏ, hiến tế lên cấp tông môn, Tàng Kinh Các.
- Server giả chạy trong Web Worker với đúng dạng lệnh mà Nakama sẽ nhận; lưu IndexedDB; đồng hồ có hệ số tua (×1 khi chơi thử, ×24 trở lên khi test tự động).
- Bản đồ trong tông môn (người dùng chọn ngày 2026-11-02): bố cục lấy từ Village Generator của Watabou (Procgen Arcana), theo cách của addon Godot [gd-procgen-arcana-addon](https://github.com/Flynsarmy/gd-procgen-arcana-addon) (CC0, bản 0.1, commit cuối 2024-11-30).
    - Addon chỉ là bộ nhập trong trình soạn Godot 4: đọc JSON của Watabou rồi dựng cảnh 3D với nhà và cây mẫu. Prototype là web nên không chạy addon được; chép cách đọc của nó (khoảng 100 dòng) sang TypeScript, vẽ 2D trên canvas.
    - JSON là GeoJSON, đơn vị khoảng mét, gồm `earth`, `buildings` (nhà hình chữ nhật), `roads` (đường kèm bề rộng), `squares`, `fields`, `trees`, `water`, `planks` (cầu ván), `palisade`. Khi chọn địa hình đảo, `water` có lỗ hình đảo, hợp với sơn môn là đảo nổi.
    - Đề xuất ghép: nhà lớn nhất là Chính Điện, các nhà còn lại chia cho công trình theo cỡ, `squares` là Diễn Võ Trường và Truyền Tống Trận, `fields` là Linh Dược Viên, `palisade` là ranh Hộ Sơn Đại Trận.
    - Generator của Watabou không mở mã và không chạy tự động được, nên làm sẵn một bộ mẫu bằng tay (vài mẫu cho mỗi địa thế), xuất JSON vào `data/tong_mon/`; tông môn chọn mẫu theo địa thế và seed.
    - Điều khoản (FAQ của Watabou, đọc ngày 2026-11-02): bản đồ sinh ra được dùng tự do, kể cả thương mại, không bắt buộc ghi công, nhưng tác giả phản đối việc bán lại chính bản đồ sinh ra. Không có văn bản giấy phép chính thức, nên lưu lại nội dung FAQ trước khi phát hành.

Xong khi: test tự đưa một tông môn từ cấp 1 lên cấp 30 chỉ bằng lệnh.

### Sprint 6 · 11/01 – 24/01 · Đối thủ NPC, tranh điểm, bí cảnh

- Tông môn NPC: chiếm mỏ gần, ghép công pháp theo hệ của vùng, tuyên chiến khi mạnh hơn, giữ điểm bằng đệ tử NPC.
- Trận tranh điểm dùng `packages/sim`; bí cảnh mở theo đồng hồ game lúc 12:00 và 20:00, rơi tàn quyển theo bảng mục 11.
- PixelLab: 11 công trình, dị thú và cướp Huyết Sát Môn, icon vật phẩm.

### Sprint 7 · 25/01 – 14/02 (gồm tuần Tết) · Ghép thành vòng chơi

- Dashboard người chơi và tông môn bản tối thiểu (cần GDD phần 4D, Q5), FTUE rút gọn theo các bước 2–8 ở mục 14.
- Ghi sự kiện analytics vào file xuất được (mục 19); đăng bản build tĩnh lên một host miễn phí.

Xong khi: một người chưa từng thấy game chơi hết FTUE trong 15 phút mà không phải hỏi.

### Sprint 8 · 15/02 – 28/02 · Chơi thử 2 tuần, Cửa 1

- 5–10 người chơi thử theo giờ thật, mỗi ngày vài phiên ngắn cộng hai khung bí cảnh. Nếu 2 tuần không đủ để thấy tiến triển của tông môn, tăng tốc độ kinh tế bằng tham số chứ không tua đồng hồ.
- Song song, chuẩn bị MVP: cài Docker, dựng Nakama + PostgreSQL ở máy, đo thời gian chạy một trận trong runtime của Nakama (mục 16 yêu cầu làm sớm).

Cửa 1 qua khi (đề xuất, chờ duyệt): ít nhất 60% người thử còn chơi ở ngày 14; trung bình mỗi người tự ghép ít nhất 10 công pháp; ít nhất một nửa nói ghép công pháp và tranh mỏ là phần vui nhất. Không qua thì dành tối đa 2 sprint sửa luật rồi thử lại, trước khi vào MVP.

## 5. MVP: các khối việc

Thứ tự này thay cho Sprint 2–6 của `ROADMAP.md`; chia sprint chi tiết khi qua Cửa 1.

| Khối | Nội dung | Ước lượng |
|---|---|---|
| M1 | Docker, Nakama, PostgreSQL; đưa `packages/rules` vào runtime Nakama; tài khoản với OTP giả; `world_id` trên mọi khoá | 2 sprint |
| M2 | Worker xác minh bằng Node qua Redis; luồng một trận ở mục 16; xác minh có chọn lọc | 2 sprint |
| M3 | Match có thẩm quyền cho mỗi vùng, bản vá delta; hành trình theo chặng, tử vong, đồ sát, sát nghiệp, lao tù, party; thú cưỡi khi GDD 4C xong | 4 sprint |
| M4 | Client Cocos: dashboard, bản đồ tranh, bản đồ mini, xem trận; thay hình prototype bằng hình theo hướng mỹ thuật đã chốt (Q7) | 5 sprint |
| M5 | Liên minh, tuyên chiến, cứ điểm, tiểu Truyền Tống Trận, hộ trận, công thành, chính và tà, bảo trợ, diệt môn | 4 sprint |
| M6 | Rèn, độ bền, ngọc, đan, lô đỉnh, lò rèn; chợ chung, Sàn Linh Ngọc, túi và kho; cân bằng tỷ lệ rơi | 3 sprint |
| M7 | Tuân thủ G1: OTP SMS thật, form người giám hộ, giới hạn giờ chơi, nhắc 30 phút, lịch sử nạp; thanh toán sandbox | 2 sprint |
| M8 | Bot 1.000–10.000, cấu hình sống, trang admin, giám sát; kiểm Cửa 2 | 2 sprint |

## 6. Hình ảnh và PixelLab

**Vai trò.** GDD mục 15 chốt trận đấu và sơn môn 2D isometric thủy mặc, nhân vật Spine, AI chỉ để phác thảo. PixelLab ra pixel art, nên trong Prototype nó thay cho đồ họa khối xám và làm bản phác ý tưởng. Hướng mỹ thuật cuối chốt trước khối M4 (Q7).

**Cài đặt (bạn tự chạy, token là của bạn):** tạo tài khoản ở pixellab.ai, lấy API token, rồi chạy trong terminal:

```
claude mcp add pixellab https://api.pixellab.ai/mcp -t http -H "Authorization: Bearer <TOKEN_CUA_BAN>"
```

Kiểm tra trước khi tạo hàng loạt: giá theo gói và điều khoản dùng thương mại cho ảnh sinh ra (trang Pricing và Terms của PixelLab; chưa có số trong kế hoạch này).

**Quy ước:**

- Ảnh lưu ở `assets/pixellab/<nhóm>/<tên>.png`; mỗi ảnh có một dòng trong `assets/pixellab/manifest.json` ghi mô tả, công cụ, tham số, ngày tạo, id của PixelLab. Biết nguồn gốc từng ảnh để làm hồ sơ bản quyền và để thay dần bằng hình của họa sĩ.
- Khoá phong cách trước: tạo 1 tu sĩ mẫu, bạn duyệt, rồi các hình sau dùng hình đó làm tham chiếu. Màu theo bảng 12 hệ ở mục 15.
- Không dùng PixelLab cho bản đồ tranh từng vùng (vẽ bằng code trên khung `ha_khung.png`), logo và key art.
- Đổi ngày 2026-11-03 theo yêu cầu người dùng ("dùng pixel labs xây dựng dashboard ui ux người dùng"): khung UI cuộn giấy của dashboard làm bằng PixelLab, gồm 5 mảnh ở `assets/pixellab/ui/` ghép bằng CSS `border-image`. Hình nền công trình (`cong_trinh/`) và điểm bản đồ (`diem_nen/`) cũng làm bằng PixelLab, 1 lượt mỗi hình. Ba nhóm này nạp qua CSS, không qua `Sprites`.

| Nhóm | Số lượng | Công cụ PixelLab | Cỡ | Sprint |
|---|---|---|---|---|
| Tu sĩ theo 8 tài năng, mỗi người 4 hoạt ảnh: đứng, ra chiêu, trúng đòn, ngã | 8 nhân vật, 32 hoạt ảnh | `create_character` 4 hướng, `animate_character` | 64 px | 3 |
| Icon 12 hệ (hình tròn, lá, sóng, lửa, vuông, sét, xoáy, tia sáng, lửa ma, mặt trời, trăng khuyết, bông tuyết) | 12 | `create_image_pixflux`, nền trong | 32 px | 3 |
| Icon 10 loại chiêu | 10 | `create_image_pixflux` | 32 px | 3 |
| Icon 10 loại điểm bản đồ | 10 | `create_map_object` | 48 px | 4 |
| 11 công trình, 1 dáng mỗi công trình | 11 | `create_isometric_tile` hoặc `create_map_object` | 64–96 px | 6 |
| Dị thú, cướp Huyết Sát Môn, NPC hộ đạo | 5 | `create_character`, `animate_character` | 64 px | 6 |
| Vật phẩm: tàn quyển 4 phẩm, linh thạch, quặng, dược liệu, đan | khoảng 10 | `create_image_pixflux` | 32 px | 6 |

Tổng cho Prototype: khoảng 70 hình và 50 hoạt ảnh.

## 7. Việc cần bạn quyết hoặc gửi

| Mã | Việc | Đề xuất của mình | Cần trước |
|---|---|---|---|
| Q1 | Duyệt hướng prototype web chơi một mình tới Cửa 1 (mục 2) | Duyệt | Sprint 2 |
| Q2 | Gửi file `KhaiTongLapPhai_HeThong_v1.xlsx` | Đặt vào `data/` | Sprint 2 |
| Q3 | Cài PixelLab MCP (mục 6) | | Sprint 3 |
| Q4 | Sân đấu: GDD có "đẩy lùi 1 ô", "tầm +1 ô", "áp sát" nhưng chưa định nghĩa sân | Một trục 12 ô, mỗi bên 6 ô; đội hình 2 hàng trước và sau; đi 1 ô mỗi 0,5 s; tầm cận chiến 1 ô, tầm xa 4 ô, diện rộng bán kính 2 ô. Tất cả là tham số | Sprint 1 |
| Q5 | Viết GDD phần 4D (dashboard người chơi, tông môn, liên minh) | Làm trong tháng 12 | Sprint 7 |
| Q6 | Viết GDD phần 4C (thú cưỡi) | Không chặn Prototype | Khối M3 |
| Q7 | Hướng mỹ thuật cuối: thủy mặc + Spine như GDD, hay pixel art từ PixelLab rồi họa sĩ chỉnh | Quyết sau Cửa 1, khi đã thấy hình pixel trong game | Khối M4 |
| Q8 | Tiêu chí số của Cửa 1 (Sprint 8) | Như đề xuất ở Sprint 8 | Sprint 7 |

**Chỗ GDD còn sót từ bản đồ ô, nên sửa khi làm phần 4D:**

- Mục 1: "bản đồ chung 2000 × 2000 ô".
- Mục 4: "đưa linh lực mở thêm vài chục ô đất".
- Mục 7: tông môn phi thăng "chỉ rơi vào ô trống, cách tông môn mạnh hơn ít nhất 50 ô".
- Mục 14: "zoom từ toàn bản đồ tới từng ô"; FTUE bước 2 cho chọn vùng, trong khi mục 3 nói hệ thống gợi ý vùng theo số người; bước 7 "mở rộng lãnh thổ bằng linh lực".
- Mục 16: luồng trận "tranh một ô", khối 64 × 64 ô, lan đất, "4–6 byte mỗi ô", "tông môn cấp 200 giữ 9.000 ô".
- Mục 18: sơ đồ lộ trình ghi Cửa 1 là "lan đất vẫn vui".
- Mục 20: rủi ro "chuyển phần lan đất sang Go", biện pháp chống gian lận "server tính lan đất".

## 8. Cách làm mỗi sprint

- Làm từng bước và báo lại sau mỗi bước, như `CLAUDE.md`.
- Hết sprint: test xanh, commit, ghi nhật ký vào tab Coding của GDD, cập nhật bảng ở `ROADMAP.md`.
- Mỗi tháng có một bản chơi được (biện pháp chống kiệt sức ở mục 20).
- Số nào GDD ghi "đề xuất" thì để thành tham số cấu hình, không viết cứng.

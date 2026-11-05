# Pháp luân: vòng sáng sau lưng từ Trúc Cơ

Người dùng thích vòng hào quang sau lưng ở dáng đứng (2026-11-05). Người dùng muốn:
- nhân vật đạt Trúc Cơ thì có vòng sáng sau lưng;
- mỗi công pháp tu luyện có hiệu ứng riêng;
- chuyển động làm theo công thức đạo diễn chuyển động (khái niệm, nhịp khung, luật, điều tránh, soát).

Mã ở `proto/src/scenes/battle/phapLuan.ts`. Trong trận, dáng đứng vẽ pháp luân sau thân qua `dangDung.ts`.

## Khái niệm

Pháp luân là hình chiếu của công pháp chủ tu (công pháp ưu tiên 1) sau lưng tu sĩ. Nhìn vòng là đọc được công pháp:

| Thành phần công pháp (GDD mục 9) | Hiện ra ở pháp luân |
|---|---|
| Hệ chính | màu vành, ký hiệu hệ quanh vành (GDD mục 15), tính cách chuyển động |
| Loại chiêu (chủ quyển) | hình vành: kiếm, trăng khuyết, mũi tên, vành kép, lục giác, bùa, bát quái, cánh sen, xích, vệt gió |
| Hệ phụ (phụ quyển) | màu vành trong và hạt |
| Quan hệ tổ hợp | cách hai vành quay: thuần cùng nhịp; tương sinh cùng chiều, vành trong nhanh hơn; trung tính chậm hơn; tương khắc ngược chiều; đối cực chia đôi âm dương |
| Phẩm 1–10 | độ dày vành, độ sáng quầng, số hạt |

Mỗi tổ hợp (12 hệ chính × 10 loại × hệ phụ × quan hệ) ra một vòng khác, nên mỗi công pháp có pháp luân riêng.

Cảnh giới (GDD mục 7) quyết số lớp:

| Cảnh giới | Cấp | Lớp |
|---|---|---|
| Luyện Khí | 1–50 | không có pháp luân |
| Trúc Cơ | 51–100 | vành chính, 6 ký hiệu, hình loại chiêu |
| Kết Đan | 101–150 | thêm vành trong hệ phụ, 8 ký hiệu |
| Nguyên Anh | 151–200 | thêm tia sáng toả và hạt bay theo cung |
| Hóa Thần | 201–250 | thêm quầng ngoài, 12 ký hiệu, vệt sáng quét vành |

## Tăng trưởng theo cấp

Người dùng yêu cầu ngày 2026-11-05: lên cấp thì pháp luân thay đổi theo. Vòng lớn dần liên tục theo cấp, không nhảy bậc giữa hai cấp liền nhau. GDD chưa chia tiểu cảnh giới; phần dưới là đề xuất: mỗi cảnh giới chia bốn phần đều theo cấp.

| Tiểu cảnh giới (đề xuất) | Trúc Cơ | Mỗi cảnh giới |
|---|---|---|
| Sơ kỳ (12 cấp đầu) | 51–62 | Lớp mới của cảnh giới mọc dần từ 30% tới đủ. Trúc Cơ: vành chính khép từ 70% tới kín. Kết Đan: vành trong. Nguyên Anh: 12 tia lần lượt dài ra. Hóa Thần: quầng ngoài |
| Trung kỳ | 63–75 | Trúc Cơ: hình loại chiêu hiện dần (bát quái, cánh sen…) |
| Hậu kỳ | 76–88 | Ký hiệu thêm dần, vòng to và sáng dần |
| Viên mãn (12 cấp cuối) | 89–100 | Lớp của cảnh giới kế tiếp thấp thoáng theo nhịp thở; vòng chập chờn như sắp vỡ |

Đi suốt cả thang:
- **Số ký hiệu:** Trúc Cơ 3 → 6, Kết Đan 6 → 8, Nguyên Anh 8 → 10, Hóa Thần 10 → 12. Ký hiệu mới nở dần (ease-out-back), các ký hiệu cũ dịch chỗ dần.
- **Bán kính:** tăng 6% mỗi cảnh giới, thêm 5% trải đều trong cảnh giới.
- **Độ sáng:** quầng sáng từ 80% lên 100% trong mỗi cảnh giới; sóng sáng quanh vành rõ dần.
- **Cuối Luyện Khí (cấp 41–50, đề xuất):** chưa có vòng, chỉ có vài đốm khí màu hệ bay xoắn vào sau lưng, đuôi lấy từ chính đường đi, cùng một vòng mờ đứt đoạn khép dần, báo sắp Trúc Cơ.

### Nhịp lên cấp và đột phá

| Khung | Nhịp |
|---|---|
| lên cấp 0–18 | Vòng lớn dần từ cấp cũ sang cấp mới (ease-in-out-cubic), ký hiệu mới nở; 9 khung đầu sáng mềm hơn (không trắng) |
| đột phá 0–20 | Tụ: vòng cũ co lại, run tăng dần (bao tụ lực) |
| đột phá 20, 30, 40 | Thiên kiếp nhỏ (GDD mục 7): tia sét gấp khúc đánh xuống đỉnh vòng, khung chạm trắng, vòng đứng 3 khung |
| đột phá 44–58 | Vỡ: vòng cũ gãy 8 mảnh bay theo cung trọng lực, xoay, đuôi lấy từ đường đi; mảnh chỉ tàn khi đã bay xa |
| đột phá 46–64 | Hiện: vòng cảnh giới mới nở từ tâm (bao hiện, ký hiệu tới lệch nhịp), sóng xung kích trắng rồi về màu hệ lan ra |

Màn Nhân vật nhớ cấp đã thấy (`trackLevel`). Khi cấp đổi, màn diễn nhịp lên cấp, hoặc diễn nhịp đột phá nếu sang cảnh giới mới. Nhịp bắt đầu lúc thẻ Pháp tướng hiện, nên mở thẻ sau khi bấm Đột phá vẫn xem được. Màn Trận không cần nhịp này vì cấp không đổi trong trận.

## Nơi dùng

- **Màn Trận:**
  - `buildPhapLuan` lấy công pháp chủ tu từ lần ra chiêu đầu của mỗi người và cấp từ `ReplayUnit.level`; thiếu cấp thì không vẽ.
  - `phapLuanBeat` tính nhịp theo t, không giữ trạng thái.
  - Đội B lật cả vòng; người ngã thì không vẽ vòng.
- **Màn Nhân vật:**
  - Công pháp mang vào trận đầu tiên và `v.level`; tông chủ có lông vũ vàng.
  - Người thu lại tối đa 22% cho vòng vừa canvas. Ở Nguyên Anh, Hóa Thần, chóp lông vũ và quầng ngoài có thể chạm mép canvas.
  - Bóng pháp tướng không vẽ vòng, vì CSS làm mờ và nhuộm nâu bóng đó.

## Nhịp (30 khung/giây, khung tính từ mốc của nhịp)

| Khung | Nhịp |
|---|---|
| 0–18 | Hiện: vành nở từ tâm, vượt 1,08 rồi về 1 (ease-out-back); ký hiệu tới lệch 2 khung mỗi cái |
| vòng 0–120 | Thở: 0–60 hít vào, scale 1 → 1,035, quầng 0,75 → 1 (ease-in-out-sine); 60–120 thở ra. Sóng sáng chạy hết một vòng vành mỗi 120 khung. Vành trong trễ 6 khung so với vành ngoài |
| vận công 0–8 | Tụ lực (anticipation): vành co 0,9 và dẹt (x 1,04, y 0,92); ký hiệu kéo vào tâm 15%; quầng tăng. Từ khung 8 giữ, run nhẹ tới lúc phát |
| phát 0–4 | Bung (4 khung, ease-out-quad): vành giãn 1,15 theo chiều quay (stretch); 2 bóng mờ lệch góc phía sau vệt quay (smear) |
| phát 4–8 | Khung chạm (hit-stop): góc quay và nhịp thở đứng yên; vành trắng sáng một khung rồi về màu hệ |
| phát 8–25 | Lắng: lò xo tắt dần về 1 (vượt xuống khoảng 0,98 một lần) |
| phát 25 → | Trở lại vòng thở |

Lần dò đầu tiên bắt được lỗi: lúc bung 3 khung với ease-out-cubic, vành nhảy 0,178 trong một khung. Đã sửa thành bung 4 khung ease-out-quad, mỗi khung đi không quá 0,11.

## Luật

- Có tụ lực trước khi bung (vận công co lại, rồi phát mới giãn).
- Mọi hạt và tia lửa đi theo cung: hạt trôi trên quỹ đạo elip, tàn lửa bay lên rồi cong; không đi đường thẳng.
- Chồng nhịp (overlap): vành trong, ký hiệu và hạt đáp lại cùng một nhịp nhưng trễ dần (6, 2 × thứ tự, 4 khung).
- Co giãn (squash & stretch) khi tụ lực và lúc bung. Diện tích vành gần như giữ nguyên.
- Hit-stop 4 khung ở đỉnh lúc phát.

## Điều tránh

| Tránh | Thay bằng |
|---|---|
| Đường thẳng | cung trọng lực, quỹ đạo elip |
| Đuôi vẽ sẵn | đuôi lấy từ chính đường đi (lấy mẫu vị trí ở các thời điểm trước) |
| Tween tuyến tính, quay đều tắp | khoá có ease; quay theo tính cách hệ (Thổ quay từng nấc rồi lắng; Lôi giật; Thủy đung đưa) |
| Mờ dần lúc phát | khung chạm sáng trắng rồi về màu |

## Tính cách chuyển động theo hệ

| Hệ | Ký hiệu | Chuyển động |
|---|---|---|
| Kim | hình tròn | quay chậm đều nhịp, vệt sáng loé chạy qua vành |
| Mộc | lá | đung đưa, lá thở to nhỏ lệch nhịp |
| Thủy | gợn sóng | lắc qua lại như con lắc, gợn lan ra ngoài |
| Hỏa | lửa | quay vừa, lưỡi lửa liếm lên, tàn lửa bay lên |
| Thổ | hình vuông | quay từng nấc 1/6 vòng, mỗi nấc ease rồi lắng |
| Lôi | tia sét | giật nấc ngẫu nhiên (theo hàm băm thời gian), tia điện nhảy giữa ký hiệu |
| Phong | xoáy | quay nhanh có ease, vệt gió kéo theo |
| Quang | tia sáng | tia toả nhịp theo hơi thở |
| Âm lãnh | lửa ma | trôi chậm, ký hiệu hiện ẩn lệch pha |
| Cực dương | mặt trời | vành nhật hoa phập phồng |
| Cực âm | trăng khuyết | trăng đổi pha quanh vành |
| Cực hàn | bông tuyết | gai băng mọc ra rút vào, hạt tuyết rơi theo cung |

## Soát

1. Mỗi nhịp một ảnh tĩnh: hiện, thở (đỉnh và đáy), tụ lực, bung, khung chạm, lắng. Đối chiếu với các luật trên.
2. Dò mọi khung qua hàm `probe()` trong phapLuan.ts:
   - nối vòng thở không giật (khung 119 → 0);
   - không có bước nhảy lớn giữa hai khung liền nhau, trừ khung chạm;
   - scale nằm trong 0,85–1,2;
   - từ cấp 51 tới 250 (bước 0,25 cấp): vòng không nhỏ lại, ký hiệu không bớt, không nhảy lớn kể cả khi qua mốc cảnh giới;
   - khung 0 của nhịp đột phá trùng với vòng đang thở.
3. Rồi mới xem trong màn Trận và màn Nhân vật ở 375×812.

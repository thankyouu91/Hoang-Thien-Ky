# Luật chuyển động của hiệu ứng chiêu

Áp công thức "đạo diễn chuyển động" (người dùng gửi 2026-11-05) cho hiệu ứng chiêu màn Trận: viết chiêu thành các
nhịp (beat) ở 30 khung/giây, theo năm luật nhà, tránh bốn lỗi quen, và duyệt bằng ảnh từng nhịp rồi soi từng khung.
Mã: `nhip.ts` (khung chuẩn, easing, khựng, cung trọng lực, kéo dài), `chung.ts` (khung va chạm, khựng, pha chạm chung),
`chieu.ts` và `dang*.ts` (từng loại chiêu, dáng chiêu).

Mọi con số dưới đây là **đề xuất**, chỉnh được trong `recipe.ts` (`hold`) và `nhip.ts`.

## Khung chuẩn

- 30 khung mỗi giây **thực** (`FPS`). Khung va chạm và khựng đếm theo giây thực (`frameTick` = `life(1/30)`), nên ở ×1,
  ×2, ×4 vẫn dài đúng bấy nhiêu khung trên màn hình. Thời lượng các pha khác vẫn theo nhịp biến thể (Tốc ngắn, Bền dài).
- Mọi hình vẫn là hàm của (seed, t): khựng là một phép đổi thời gian (`stopped`), không giữ trạng thái, tua tới lui
  vẫn ra y hệt.

## Năm luật nhà

| Luật | Làm thế nào trong mã |
|---|---|
| Tụ lực (anticipation) | `windup`: quầng tụ lực lùi về sau lưng 6 đơn vị (`ease.inOut`), phình dần, bị nén dẹt dọc hướng đánh ở 55–80% pha, rồi vụt tới 12 đơn vị (`ease.whip`) và kéo dài theo hướng đánh. Hạt hệ xoáy vào tay nhanh dần. |
| Cung (arcs) | Đạn, cầu khí, đầu lâu, tiền đồng… bay theo **parabol** (`gravityArc`, `flightPath`): đi ngang đều theo thời gian, độ cao 4·đỉnh·q·(1−q). Tia lửa khi chạm bay theo cung trọng lực (lên rồi rơi xuống dưới chỗ chạm). Vệt chém vốn là cung. |
| Trễ nhịp (overlap) | Vệt hệ phụ đuổi sau vệt chính 0,08 pha; vòng hệ phụ của nổ vùng trễ 0,06; nét hệ phụ khi trúng trễ 0,08 mỗi hệ; trạng thái (pha 4) chạy riêng, không khựng. |
| Co giãn (squash & stretch) | Đầu đạn, cầu khí, tia lửa kéo dài theo tốc độ trên màn (`smear`: dài tối đa 3 lần, bề ngang co theo căn để giữ diện tích). Quầng tụ lực nén dẹt trước khi phóng. Lõi trắng lúc khựng bè ngang 1,35 × 0,75 rồi thu tròn khi bung. |
| Khựng (hit-stop) | Từ lúc chạm, cả lần ra chiêu chạy theo **thời điểm đã khựng** (`stoppedCtx`): 2 khung va chạm + `hold` khung đứng yên rồi mới bung. `hold`: thường 5, Bạo 8, Tốc 3, Bền 4, chiêu cuối 9. Hộ thể, hồi phục không chạm nên không khựng. |

## Bốn lỗi quen và cách thay

| Tránh | Thay bằng |
|---|---|
| Đường bay thẳng | Cung trọng lực (`gravityArc`). Ngoại lệ có chủ ý: tia sét (Lôi) gấp khúc, cột sáng thẳng đứng, chém đâm thẳng của kiếm trận. |
| Đuôi hiện sớm | Đuôi lấy từ chính đường đã đi: `trail` lấy mẫu các điểm cũ của đầu đạn, không vượt điểm phóng; đuôi vệt chém đuổi bằng `ease.inOut`, luôn sau đầu vệt (`ease.whip`). |
| Nội suy tuyến tính | Khoá có easing: `ease.anticipate`, `ease.whip` (bứt nhanh), `ease.settle` (vượt rồi về), `ease.inOut`. Đi ngang của đạn đều theo thời gian là đúng vật lý của cung trọng lực. |
| Mờ dần lúc chạm | **Khung va chạm** (`impactFrame`, hình `K.BURST` sắc cạnh, hoà màu thường): khung 0 sao gai màu hệ lõi trắng, khung 1 đảo sang vành gai mực đậm quanh lõi trắng. Sau khựng, các hình thu nhỏ về 0 hoặc mỏng dần; chỉ tan ở 35–40% cuối pha. Nổ vùng, kích trận dùng vành gai khoét giữa để người trong vùng vẫn thấy. |

## Nhịp theo loại chiêu (khung ở 30 khung/giây, 0 là lúc chạm)

Nhịp pha 1–2 theo thời lượng gốc của loại chiêu (`castTimeline`); khựng tính ở nhịp thường (`hold` 5).

| Loại | Tụ lực | Vụt / bay | Chạm | Khựng | Bung, lắng |
|---|---|---|---|---|---|
| Cận chiến đơn | −7…−2: quầng lùi đà, nén | −2…0: vệt chém vụt (whip) | 0–1 khung va chạm | 2–6: vệt chém đứng yên giữa nhát | 7–17: vệt chém chạy hết, vòng nở, tia lửa rơi |
| Cận chiến quét | −9…−1: lốc vệt quanh người | −1…0: cung quét bung | 0–1 | 2–6: cung đứng giữa đường | 7–16 |
| Tầm xa | −5…−4 trước lúc phóng | 2 khung chớp nòng, rồi bay cung parabol, đầu đạn kéo dài | 0–1 | 2–6 | 7–17 |
| Khống chế | như tầm xa, xích nối theo cung | | 0–1 | 2–6: vòng xích đứng | 7–17: vòng xích siết (whip) |
| Bùa chú | lá bùa nảy ra trong tay | lá bùa bay cung cao | 0–1 | 2–6: ấn son đứng | 7–23: ấn đóng, mảnh giấy văng |
| Diện rộng | suốt lúc vận: vòng báo trước | −9…0: cầu khí rơi theo cung, kéo dài | 0–1: vành gai trên vùng | 2–6: vòng xung kích đứng | 7–25: vòng nở (whip), mảnh hệ văng theo cung |
| Trận pháp | suốt lúc bày | −12…0: trận nhãn bắn về tâm | 0–1: vành gai quanh trận | 2–6 | 7–33: cột sáng vụt lên, chữ Trận nảy (settle) |
| Thân pháp | −6…0: hạ người, tụ dưới chân | bóng mờ dọc đường lướt | 0–1 | 2–6: nhát chém đầu đứng giữa | 7–21: chém chữ thập |
| Hộ thể, hồi phục | như cũ | | không khung va chạm, không khựng | | khiên nảy (settle), hạt sáng bay lên |
| Chiêu cuối | 27 khung tối màn, phù trận nở | | 0–1: khung va chạm vàng rồi mực | 2–10 | 11–53: tia toả, sóng xung kích (whip); mỗi kiếm quang giáng có khung va chạm riêng |

## Duyệt

1. **Mỗi nhịp một ảnh**: trang xem thử, nút "Ảnh nhịp" (hay `xemThu.film()`): tụ lực, đường bay, khung va chạm, khựng,
   bung, trạng thái. Soi từng ảnh với bảng luật trên.
2. **Soi mọi khung rồi mới dựng**: nút "Soi từng khung" (hay `xemThu.probe({ from, to, cols })`): mọi khung 30 khung/giây
   quanh lúc chạm, ghi số khung và nhịp (va chạm đỏ, khựng vàng).
3. **Test dò luật** (`hieu_ung.test.ts`): khung va chạm có hình sắc cạnh và đổi màu giữa khung 0 và 1; trong lúc khựng
   bộ đệm đứng yên; đường bay là parabol; lúc chạm không có hình đang mờ dần; easing đúng dáng.

## Còn mở

- Khựng của người (thân người giật, nảy khi trúng) do phiên dáng đứng làm ở `scenes/battle/chuyenDong.ts` (2026-11-05),
  đọc từ đây: `nhip.ts` (`ease`, `hitStop`, `squash`, `IMPACT_FRAMES`, `FPS`), `chung.ts` (`holdOf`, `NO_CONTACT`,
  `ink`), `recipe.ts` (`recipeOf`). Đổi tên hay chữ ký mấy hàm này thì báo phiên đó trước. Rung màn theo khựng vẫn là
  phần màn Trận (proto-shell).
- Vật cảnh (cây, cờ, bụi, nước trên sân) thuộc lớp nền `proto/src/three/` (phiên three-nen): có thể áp cùng luật (lay
  theo cung, trễ nhịp giữa gốc và ngọn, co giãn khi bị sóng xung kích quét qua).

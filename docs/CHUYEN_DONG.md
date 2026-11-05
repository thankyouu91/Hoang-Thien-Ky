# Chuyển động thân người trong trận (gói 1)

Người dùng duyệt ngày 2026-11-05: làm cho nhân vật trong trận di chuyển, ra chiêu, trúng đòn và ngã có cảm giác hơn. Phần này làm bằng code, không vẽ thêm hình. Làm theo công thức đạo diễn chuyển động (khái niệm, nhịp, luật, điều tránh, soát) và dùng chung nhịp với hiệu ứng chiêu (`proto/src/hieu_ung/nhip.ts`, `DONG_TAC.md`). DONG_TAC.md để ngỏ phần khựng của thân người cho màn Trận; phần này lấp chỗ đó.

Mã: `proto/src/scenes/battle/chuyenDong.ts` (tính) và `drawSwingTrail` trong `dangDung.ts` (vệt vũ khí). Mọi số là đề xuất.

## Khái niệm

Thân người đáp lại đúng nhịp của hiệu ứng: hiệu ứng khựng thì người trúng đòn cũng khựng. Đòn nặng đẩy người lùi theo cung rồi lắng về. Đi thì nhún theo bước, lướt thì để lại bóng. Ngã thì tan thành hạt hệ thay vì mờ dần.

## Nhịp (30 khung/giây thực; khung 0 là lúc trúng)

| Khung | Nhịp |
|---|---|
| 0 | Khung va chạm: thân hoá trắng, bị dời ngay 35% quãng đẩy, bè ngang (x 1 + 0,12w, y 1 − 0,08w) |
| 1 | Khung va chạm: thân hoá mực |
| 2 … stop−1 | Khựng: hoạt ảnh đứng ở khung chạm, thân rung trái phải đổi chiều mỗi khung (±1,2w) |
| stop … +4 | Bật ra hết quãng lệch (3 + 4w đơn vị) theo hướng ra xa người đánh (ease-out-quad), nảy lên theo cung |
| +4 … +16 | Lắng về chỗ cũ (ease-in-out), bè ngang thu về theo ease vượt đà (settle) |

Cú đẩy chỉ là độ lệch hình quanh vị trí replay rồi lắng về 0, vì sim đã có đẩy lùi thật trong vị trí. Hiệu ứng chiêu ngắm theo vị trí replay nên người không lệch xa chỗ đạn chạm. Khung va chạm cần `ctx.filter`. Máy không có (Safari, WebView cũ) và đòn nhẹ thì vẫn nháy mờ 0,7 như cũ. Trong hai khung va chạm không vẽ pháp luân, để khỏi thành vòng trắng hay mực to. Người không có hình ghép (tu_si tĩnh, khối màu) giữ cách nháy cũ. Thanh máu, dấu hệ, vòng đội và số sát thương không rung theo.

- `stop` = IMPACT_FRAMES (2) + `holdOf` của chiêu gây đòn: thường 5, Bạo 8, Tốc 3, Bền 4, chiêu cuối 9. Đếm theo giây thực nên ở ×1, ×2, ×4 vẫn dài bằng nhau trên màn.
- Hộ thể và hồi phục không chạm: không khựng, không khung va chạm.
- `w` = sát thương ÷ máu tối đa ÷ 10%, tối đa 1. Đòn dưới 3% máu không làm thân phản ứng, để người không giật liên tục.

| Lúc khác | Nhịp |
|---|---|
| Đi | Một bước mỗi nửa ô, bước theo quãng đã đi (không theo giờ). Thân nhún lên tới 2,4 đơn vị; lúc chân chạm đất bè 5%. Mỗi bước để lại bụi, tàn trong 0,4 giây thực |
| Lướt (nhanh hơn 120 milli-ô mỗi tick) | 3 bóng mờ ở vị trí 1, 2, 3 tick trước (độ đậm 0,24 / 0,16 / 0,08) |
| Ra chiêu cận chiến (đơn, quét, thân pháp) | Vệt mũi vũ khí theo đường đi thật qua các khung ra chiêu, 7 mẫu cách 0,3 khung; thon và nhạt dần về đuôi, lõi trắng viền màu hệ |
| Ngã | Hoạt ảnh ngã chạy xong (5 khung) thì tan trong 0,5 giây: hạt ký hiệu hệ văng ra theo cung, thân mờ còn 0,3 (ease-in-out) |

## Luật

| Luật | Áp vào thân |
|---|---|
| Tụ lực | Đã có ở hiệu ứng (quầng tụ lực) và cú nhích tới của người đánh cận chiến (`fx.lunges`) |
| Cung | Nảy lên khi bị đẩy; hạt tan khi ngã bay theo cung trọng lực |
| Trễ nhịp | Bè ngang thu về sau cú đẩy; bụi trễ theo bước |
| Co giãn | Bè ra lúc trúng, bè nhẹ mỗi bước chạm đất |
| Khựng | Đứng ở khung chạm đúng số khung của hiệu ứng |

## Điều tránh

| Tránh | Thay bằng |
|---|---|
| Đường thẳng | Cú đẩy có nảy lên theo cung; hạt tan rơi theo cung |
| Đuôi vẽ sẵn | Vệt vũ khí và bóng lướt lấy từ chính đường đã đi |
| Tween tuyến tính | ease-out-quad, ease-in-out, settle |
| Mờ dần lúc trúng | Khung va chạm trắng rồi mực (trước đây người trúng đòn nháy mờ 0,7) |

## Soát

1. Dò mọi khung trên một trận giả: người trúng đòn cận chiến 10% máu, chạy ở ×1 và ×4. Kiểm:
   - khựng đúng 7 khung;
   - khung 0 trắng, khung 1 mực, sau đó không còn khung va chạm;
   - không có bước nhảy quá 3 đơn vị mỗi khung, trừ khung chạm (dời 35%) và 4 khung bật ra (tới 4);
   - thân về đúng chỗ cũ;
   - người đi có nhún, có bụi;
   - ngã thì tan, thân còn 0,3.

   Lần dò đầu bắt được ba lỗi:
   - làm tròn khiến khựng thành 8 khung;
   - cú đẩy dùng whip nên bứt 6,9 đơn vị trong một khung;
   - lắng về dùng ease vượt đà nên tụt 4 đơn vị trong một khung.

   Cả ba đã sửa.
2. Xem ảnh từng nhịp trong màn Trận ở 375×812, rồi mới gửi người dùng.
3. Đo hiệu năng phần thêm vào (seed 11, 20 người, ×4, quanh giây 7 và 25, canvas 375×812 ở dpr 2): 0,13 ms và 0,04 ms mỗi khung, gồm bụi, bóng lướt, vệt vũ khí, hạt tan; mức cho phép là 2 ms. Bộ lọc khung va chạm tốn khoảng 0,02 ms mỗi người.

# Gói 2: chạy và ra chiêu theo loại chiêu

Người dùng duyệt ngày 2026-11-05. Mỗi thân và áo có thêm 5 dải PixelLab (`animate_character`, mode `skeleton-v3`, dùng `move` có sẵn, hướng south-east, 3 lượt mỗi dải):

| Dải | Move | Dùng cho | Khung chạm |
|---|---|---|---|
| `chay` (8 khung, lặp) | `run` | đi tới phía địch | không có |
| `ra_chieu_chem` (10) | `slash`, tay trước | cận đơn, cận quét | 4: tay chém xuống trước mặt |
| `ra_chieu_dam` (10) | `stab`, tay trước | thân pháp | 5: tay vươn xa nhất |
| `ra_chieu_dap` (8 trong 12) | `arms_overhead` rồi `cast_down` | diện rộng, trận pháp | 5: khuỵu, hai tay đập xuống; khung giữ 3 là hai tay giơ cao |
| `ra_chieu_phong` (10) | `throw`, tay trước | tầm xa, bùa chú, khống chế | 5: tay buông ra trước |

- Hộ thể và hồi phục vẫn dùng dải `ra_chieu` chung. Thân chưa có dải riêng cũng lùi về dải này.
- Mô tả gửi PixelLab không được nhắc tới vũ khí. Lần đầu mô tả có chữ "sword", PixelLab vẽ luôn thanh kiếm vào tay, trùng với vũ khí ghép. Nhóm hỏng đó bị loại trong `BO_NHOM` của `tools/dang_dung/dong_tac.ts`.
- Dải đập: move `arms_overhead` cho tay giơ lên hạ xuống hai lần, nên chỉ giữ khung 0–3 và 8–11.

## Nhịp (`ThanNguoi.act`, `gait` trong `chuyenDong.ts`)

Replay biết trước mọi sự kiện, nên động tác vung tay bắt đầu trước lúc trúng đòn.

| Nhóm | Mốc |
|---|---|
| Chém, đâm | Khung chạm trùng tick trúng đòn; các khung trước đó diễn ngay trước tick ấy. |
| Đập | Giơ tay từ lúc vận công (`start`), giữ ở khung giữ, đập xuống đúng tick nổ. |
| Phóng | Khung buông tay trùng lúc đạn rời tay: tick trúng trừ thời gian bay, cùng công thức với `fx2d.ts`. |
| Chung | Có đòn nặng chạm trúng thì người đánh đứng ở khung chạm đúng số khung khựng như người trúng đòn (IMPACT_FRAMES + holdOf), đếm theo giây thực. Sau đó diễn nốt phần theo đà. |

- Khung dải chạy theo thời gian trận như dải cũ, nên tua ×4 thì diễn nhanh gấp 4. Riêng lúc khựng tính theo giây thực, nên khung chạm vẫn hiện đủ lâu.
- Hai lần ra chiêu sát nhau: lần sau không vung trước khi lần trước chạm và khựng xong. Lần sau mà chạm trước lúc đó thì gộp vào lần trước, không vung lại từ đầu. Hay gặp ở thân pháp nối cận đơn, cận quét nối cận đơn.
- Chạy: chỉ khi tiến về phía địch nhanh hơn 3 và không quá 120 milli-ô mỗi tick. Khung theo quãng đã đi, một vòng hai bước mỗi ô. Lùi, bị đẩy và lướt vẫn như gói 1. Khi chạy, độ nhún của gói 1 giảm còn 25% và bỏ bè ra, vì dải đã tự nhún.

## Vũ khí theo tay

Neo tay của các dải mới là `[x, y, góc cẳng tay, vươn]`:
- `góc` là hướng từ khuỷu tới cổ tay;
- `vươn` từ 0 tới 1, cho biết cổ tay đã rời chỗ nghỉ bao xa (đủ 1 ở 14 px). Với dải không lặp, tính từ chỗ nghỉ của `dung.png` hoặc từ khung đầu của dải, lấy giá trị nhỏ hơn.

Khi vẽ, lưỡi vũ khí quay từ hướng gốc của ảnh đồ về hướng cẳng tay theo độ vươn (`heldRotation` trong `dangDung.ts`):
- tay ở chỗ nghỉ thì vũ khí giữ như lúc đứng, nên lúc chuyển động tác không giật;
- tay vươn hết thì lưỡi nối dài cẳng tay: đâm chĩa thẳng tới, chém theo cung tay.

Vệt vũ khí cũng xoay mũi theo góc này. Lúc chạy, vũ khí chỉ đung đưa 40%. Dáng đeo lưng hay cất vũ khí thì khi chạy vẫn đeo lưng hay cất. Neo cũ chỉ có `[x, y]` thì vẫn vẽ như trước.

## Làm lại hay thêm áo

1. Trên PixelLab: `animate_character` với state thân + áo, `mode: "skeleton-v3"`, `directions: ["south-east"]`, đúng `animation_name`, `frame_count` và `move` như bảng trên. Các mô tả đã dùng:
   - chạy: "running forward";
   - chém: "raises one empty fist high, then chops it down diagonally across the body, bare hands";
   - đâm: "pulls back and thrusts forward in a lunging stab";
   - đập: "raises both arms high overhead, then slams both hands down toward the ground";
   - phóng: "winds back and throws forward with one hand".
2. `node tools/dang_dung/dong_tac.ts <dải,…|all> <thân/áo,…|all> <thư mục tạm> <ra.json>`: tải khung, ghép dải, ước neo (0,1 lượt mỗi khung).
3. `node tools/dang_dung/ghep.ts <ra.json> assets/pixellab/manifest.json`.

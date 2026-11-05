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

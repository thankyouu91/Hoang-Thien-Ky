# Đồ mặc nhân vật (gói 3)

Người dùng duyệt ngày 2026-11-05. Gói này làm 4 phần: áo theo tài năng, màu áo theo hệ, vũ khí theo tài năng, và vầng sáng vũ khí theo độ hiếm. Mọi số trong tài liệu là đề xuất.

## Áo theo tài năng

| Tài năng | Bộ áo | Vũ khí hiện trên người |
|---|---|---|
| Tu thể | võ phục (`vo_phuc`) | quyền giáp (`quyen_giap`) |
| Tu pháp | đạo bào (`dao_bao`) | trượng (`truong`) |
| Tu trận | áo tu trận: lam sẫm, viền mây trắng | trận bàn (`tran_ban`) |
| Tu đan | áo tu đan: tạp dề da nâu | hồ lô (`ho_lo`) |
| Sát thủ | áo sát thủ: trùm đầu, che mặt; không đội mũ | chủy thủ (`song_chuy`), thấy một chiếc ở tay trước |
| Tu rèn | áo tu rèn: áo không tay, tạp dề da | búa rèn (`bua_ren`) |
| Tu dược | áo tu dược: lam nhạt, dép cỏ | liềm (`liem`) |
| Tu kim tiền | áo tu kim tiền: viền vàng, cổ lông | bàn tính (`ban_tinh`) |

- Bảng áo theo tài năng nằm ở `tai_nang` trong `assets/pixellab/nhan_vat/mau_he.json`. Bảng vũ khí theo GDD mục 6 nằm ở `VU_KHI_THEO_TAI_NANG` trong `proto/src/scenes/battle/aoTaiNang.ts`.
- Sáu bộ áo riêng là state PixelLab của từng thân (`create_character_state` từ thân trống, cùng mô tả). Bộ trên nam khoẻ có từ trước, ba thân kia làm trong gói này. Mã state và mô tả lưu ở `tools/dang_dung/ao_tai_nang.json`.
- Mỗi bộ áo có đủ dải như đạo bào, tức 10 hoặc 11 dải:
  - đứng, ra chiêu, trúng đòn, ngã;
  - chạy và 4 kiểu ra chiêu của gói 2;
  - dáng đứng theo tài năng: tu trận bắt ấn, tu đan ngồi thiền, sát thủ khoanh tay, tu rèn vác vai, tu dược chắp tay và ngồi thiền, tu kim tiền chống nạnh.
- Thân chưa có bộ áo thì `resolveLook` lùi về đạo bào.

### Neo của áo mới chép từ đạo bào

Cùng thân và cùng move (hay cùng tư thế) thì xương như nhau. Đo trên các dải có sẵn:
- neo đầu giữa đạo bào và võ phục lệch trung bình dưới 1 px;
- neo tay chỉ lệch lớn ở những khung bị ước sai, khi tay khuất.

Vì vậy `tools/dang_dung/ao_moi.ts` chép neo, khung chạm, khung giữ và cách giữ khung từ dải đạo bào cùng thân, không ước lại. Áo trùm đầu còn làm ước khung xương sai thêm, nên chép chắc hơn, và không tốn lượt.

Có một bước soát: ước khung xương ở khung giữa mỗi dải. Nếu đầu lệch quá 3 px thì ước lại đầu cho cả dải. Bước này có vì PixelLab đôi khi chỉnh nhẹ tư thế cho vừa thân, ví dụ ngả người vài độ khi ngồi thiền hay khoanh tay.

## Màu áo theo hệ (`mauAo.ts`)

Điểm ảnh của áo được thay bằng màu nội suy giữa ba tông đậm, giữa, nhạt của hệ (12 hệ, bảng `he`), theo độ sáng của chính điểm đó. Điểm của áo là điểm có hue trong dải của bộ áo và đủ bão hoà (bảng `ao`). Độ sáng được chuẩn hoá trên dải đứng của bộ áo, nên nếp áo, bóng và viền sáng vẫn giữ. Da, tóc, viền đen, đồ da nâu và viền vàng không đổi.

Ngoại hình có `tint` (hệ chủ) thì `drawCharacter` vẽ bằng dải đã đổi màu; chưa đổi xong thì vẽ dải gốc.
- Không đổi màu ngay lúc vẽ, vì getImageData giữa trận làm giật hình. `drawDang` chỉ xếp hàng các dải người đó sẽ dùng, dải đứng trước. Hàng đợi chạy khi trình duyệt rảnh (`requestIdleCallback`, mỗi lần ít nhất một dải, mỗi dải vài ms).
- Mỗi tổ hợp (thân, áo, động tác, hệ) tính một lần, cắt theo khung bao của nhân vật trên mọi khung. Một bộ (thân, áo, hệ) với 10 dải tốn khoảng 0,8 MB, so với 2,6 MB nếu để đủ khung 96 px. Trận 20 người khác nhau khoảng 16 MB.
- Trần 24 MB; quá thì bỏ dải lâu không dùng, cần lại thì xếp hàng lại.

## Vũ khí theo tài năng

Bảy món mới vẽ như kiếm, đao, trượng (`tools/dang_dung/vu_khi.ts`):
1. Inpaint Pro Flash vùng quanh bàn tay trước trên ảnh nghỉ thân nam khoẻ.
2. Tách lớp:
   - giữ điểm khác ảnh nền;
   - bỏ điểm mà ảnh nền vốn là da và ảnh mới vẫn là da (cẳng tay vẽ lại);
   - bỏ cụm điểm lẻ dưới 12 điểm;
   - giữ nắm tay quanh điểm cầm.
3. Khi PixelLab vẽ nắm tay lệch khỏi cổ tay (tay co lên cầm đồ), cắt bớt (`cat`) và dời lớp (`doi`) cho nắm tay về điểm cầm `[44.7, 35.4]`.

Cách mang (`CARRY`, `TIP`, `KHONG_XOAY` trong `dangDung.ts`):
- Quyền giáp luôn đeo trên nắm tay.
- Dao găm và liềm mang như kiếm.
- Búa vác vai cán chếch ra sau; dáng chống kiếm thì chống đầu búa xuống đất.
- Hồ lô treo sau hông.
- Trận bàn, hồ lô, bàn tính không xoay theo cẳng tay khi ra chiêu.

## Vầng sáng vũ khí theo độ hiếm

GDD mục 6 ghi: lục và lam không sáng; tím, vàng, đỏ có sáng; vũ khí từ +21 có thêm ánh sáng. `weaponGlow` trong `dangDung.ts` đặt bóng sáng (canvas `shadowBlur`) quanh lớp vũ khí:
- màu tím, vàng hay đỏ theo `weaponRarity`;
- từ `weaponPlus` 21 thì sáng mạnh hơn, đồ lục hay lam cũng có ánh vàng nhạt;
- có nhịp thở theo thời gian.

Vũ khí có sáng được vẽ tách khỏi thân, để bóng sáng không phủ lên người. Trận đấu chưa có dữ liệu đồ, nên hiện chỉ màn Nhân vật truyền độ hiếm vào được.

## Phân đội

Trước gói 3, màu áo là dấu phân đội chính: đội A đạo bào xanh, đội B võ phục đỏ. Nay áo theo tài năng và màu theo hệ. Người dùng chọn ngày 2026-11-05: vòng dưới chân dày và sáng hơn theo màu đội, viền thanh máu theo màu đội, không tô đai áo.

## Làm thêm áo hay thân

1. `create_character_state` từ thân trống với mô tả trong `ao_tai_nang.json`, rồi ghi mã state vào file đó.
2. Vẽ các dải bằng `animate_character` mode `skeleton-v3`, đúng tên, move và tư thế như đạo bào. Tham số nằm trong `docs/CHUYEN_DONG.md` và `docs/DANG_DUNG.md`. PixelLab cho tối đa 20 việc chạy cùng lúc, tính chung mọi phiên.
3. `node tools/dang_dung/ao_moi.ts <thân,…|all> <áo,…|all> <thư mục tạm> <ra.json>`, rồi `node tools/dang_dung/ghep.ts <ra.json> assets/pixellab/manifest.json`.

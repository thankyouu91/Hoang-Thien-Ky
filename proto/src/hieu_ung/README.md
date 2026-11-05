# hieu_ung — hiệu ứng chiêu thức

Thư mục tập trung mọi thứ về hiệu ứng chiêu trong trận (người dùng yêu cầu ngày 2026-11-03). Luật hiệu ứng (chiêu làm gì) vẫn nằm ở `packages/sim` và GDD mục 8–9; ở đây chỉ là phần nhìn.

## Hiện trạng (2026-11-04)

Màn Trận vẽ hiệu ứng chiêu bằng Three.js. Lớp này dùng renderer chung của `proto/src/three/` ở chế độ `driven` (commit `05aa64d` của phiên Three.js), là một canvas phủ đúng `#view`, nằm dưới HUD và thanh dưới. Máy không có WebGL2, hoặc lúc chunk hiệu ứng chưa tải xong, thì màn Trận vẽ bản 2D cũ (`fx2d.ts`).

| File | Việc |
|---|---|
| `index.ts` | API cho màn Trận: `createSkillFx(canvas)` → `frame(input, camera, dt)`, `active`, `show()`. Không import three. |
| `engine.ts` | Phần cần three, tải động: ba lớp tấm instancing (đất, thân, không), mỗi lớp một lần vẽ. |
| `shader.ts` | Một shader cho mọi tấm, vẽ hình theo `kind`: hạt atlas, quầng, vòng, vệt chém, dải sáng, khiên bán cầu, trận đồ, tia toả, phủ tối. Màu ra là alpha nhân trước nên hòa màu thường và cộng sáng chung một lần vẽ. |
| `atlas.ts` | Atlas hạt 512 × 512 vẽ bằng canvas 2D: tia lửa, sao, lá bùa, ấn son, mắt xích, băng, đá, bóng người, chữ Tuyệt, chữ Trận, phù văn, 12 họa tiết hệ. |
| `emit.ts`, `ve.ts` | Bộ đệm tấm, màu 12 hệ (từ `theme/elements.ts`), nét vẽ cơ bản, ngẫu nhiên theo seed. |
| `recipe.ts` | Công thức hiệu ứng ghép từ dữ liệu công pháp (xem dưới). |
| `chieu.ts` | Bốn pha của 10 loại chiêu và chiêu cuối tông chủ. |
| `he.ts` | Nét riêng 12 hệ khi trúng (pha 3), trạng thái kéo dài (pha 4). |
| `trang_thai.ts` | Dựng trạng thái theo thời gian từ sự kiện `status` của replay; replay cũ thì suy từ ra chiêu. |
| `canh.ts` | Ghép một khung: chiêu quanh t, trạng thái còn hiệu lực, giảm hạt khi đông chiêu. |
| `fx2d.ts`, `motifs.ts`, `vfx.ts` | Bản 2D cũ (chuyển từ `scenes/battle/`, proto-shell đồng ý), giữ làm dự phòng. |
| `xem_thu/` | Trang xem thử (xem dưới). |
| `hieu_ung.test.ts` | Test: tua tới lui ra y hệt; đủ 10 loại × 12 hệ × chiêu cuối; 10 đấu 10 ở ×4 không tràn bộ đệm; replay từ sim khớp `simulate()`. Chạy cùng test Three.js bằng `npm.cmd test -w @ktlp/proto` (từ `de5a5eb`), hoặc riêng `node --test src/hieu_ung/hieu_ung.test.ts` trong `proto/`. |

## Bốn pha, ghép tự động (người dùng chốt 2026-11-04)

Mỗi lần ra chiêu có bốn pha: khởi chiêu, đường bay, chạm trúng, trạng thái kéo dài. Pha 1 và 2 nằm trước tick ra chiêu (replay biết trước), pha 3 bắt đầu đúng tick sim tính đòn, pha 4 theo đúng thời hạn trạng thái của sim.

- **Loại chiêu** quyết định hình:
  - cận chiến đơn: vệt chém;
  - cận chiến quét: cung chém rộng;
  - tầm xa: kiếm khí bay có vệt (Kim là phi kiếm, Lôi là tia sét);
  - diện rộng: vòng báo trước, cầu khí bay xuống, nổ;
  - hộ thể: khiên bán cầu;
  - bùa chú: lá bùa và ấn son;
  - trận pháp: trận đồ bát quái xoay, trận nhãn, cột sáng, chữ Tuyệt khi tuyệt sát;
  - hồi phục: hạt sáng bay lên;
  - khống chế: xích và sao choáng;
  - thân pháp: lướt kèm bóng mờ, lộ vị trí.
- **Hệ chủ** cho màu chính và nét riêng khi trúng:
  - Kim xuyên giáp, Mộc dây trói, Thủy gợn nước và làm chậm, Hỏa thiêu;
  - Thổ đá vụn và khiên đá, Lôi sét chuỗi và tê liệt, Phong luồng gió đẩy lùi;
  - Quang hạt sáng hồi về người đánh, Âm lãnh lửa ma hút máu;
  - Cực dương tia mặt trời phá vòng kháng, Cực âm trăng khuyết giảm hồi máu, Cực hàn băng và đóng băng.
- **Hệ phụ** cho màu vệt kéo và lõi, cùng nét hệ ở độ đậm một nửa.
- **Biến thể** (đề xuất, chỉnh ở `recipe.ts`):
  - Bạo: va chạm to (×1,45);
  - Tốc: nhanh (×0,72 thời lượng), nhiều vệt mảnh;
  - Linh: nét hệ đậm (×1,7);
  - Bền: chậm (×1,35), êm.
- **Phẩm** (đề xuất):
  - số hạt ×(0,55 + 0,09 × phẩm), độ sáng ×(0,74 + 0,034 × phẩm);
  - từ phẩm 4 thêm sao lấp lánh, từ phẩm 7 thêm tia toả.
- **Chiêu đặc biệt** (mọi loại trừ cận chiến đơn, tầm xa) có vòng phù văn dưới chân lúc khởi chiêu.
- **Chiêu cuối tông chủ**:
  - lúc tụ lực: tối màn trừ quanh tông chủ, phù trận vàng, linh khí khắp sân xoáy về;
  - lúc bùng: chớp vàng, tia toả, sóng quét sân, cột sáng trời, kiếm quang giáng xuống từng mục tiêu.

## Dáng chiêu đặc trưng (người dùng đề xuất 2026-11-04)

Dáng thay hình gốc của loại chiêu ở pha 1–3 (`dang.ts`, `dang_he.ts`). Nét hệ khi trúng và trạng thái kéo dài vẫn giữ. Đã có 23 dáng; đợt đầu 10 dáng:

| Dáng | Loại chiêu dùng được | Hình |
|---|---|---|
| Đao khí chém ngang | cận chiến quét, diện rộng, cận chiến đơn | tụ đao khí trước mặt, một lưỡi liềm khổng lồ lướt ngang qua cả vùng |
| Kiếm trận xoay rồi đâm | tầm xa, cận chiến quét, khống chế | kiếm hiện dần, xoay quanh người, rồi lần lượt phóng vào mục tiêu |
| Mưa kiếm | diện rộng, trận pháp | kiếm treo dày trên vùng, cắm xuống rất nhanh, cắm lại trên đất rồi tan |
| Cự kiếm giáng | bùa chú, cận chiến đơn, trận pháp | thanh kiếm khổng lồ hiện trên đầu mục tiêu, cắm thẳng xuống, nứt đất |
| Đầu lâu (âm tà) | tầm xa, khống chế, bùa chú, diện rộng | đầu lâu bốc lửa ma lượn tới, cắn, tan thành khói đen và hồn ma |
| Huyết tuyến (sát thủ) | cận chiến đơn, thân pháp, cận chiến quét | sợi chỉ máu mảnh cắt ngang mục tiêu gần như cùng lúc, máu bắn rồi rơi |
| Thiên lôi giáng | diện rộng, bùa chú | mây đen tụ lúc vận công, sét giáng thẳng xuống từng mục tiêu |
| Gai trồi (đá, băng) | diện rộng, khống chế | gai đá hay gai băng trồi thành sóng từ tâm vùng ra ngoài |
| Lốc xoáy | diện rộng, khống chế | lốc xoáy thành hình ở người ra chiêu, lướt tới vùng, cuốn bụi lá |
| Đồng tiền bay | tầm xa, bùa chú | chuỗi đồng tiền vàng lật bay tới, chạm thì tung toé |

Đợt theo hệ, 13 dáng (người dùng chọn 2026-11-04):

| Dáng | Hệ, loại chiêu tự chọn | Hình |
|---|---|---|
| Hỏa long cuộn tới | Hỏa: tầm xa, bùa chú | rồng lửa thân nhiều đốt lượn sóng bay tới, tàn lửa rơi |
| Thiên hỏa lưu tinh | Hỏa: diện rộng | thiên thạch lửa rơi chéo xuống từng mục tiêu, nổ hố, khói |
| Thủy long quyển | Thủy: diện rộng, khống chế | gợn nước rồi cột nước xoáy dâng giữa vùng, đổ xuống loang ra |
| Sóng thần quét ngang | Thủy: cận chiến quét | con sóng lớn có bọt trắng trên đỉnh lướt ngang qua mục tiêu |
| Rễ cây trói | Mộc: khống chế, diện rộng | vết nứt xanh chạy dưới đất, rễ cây trồi quấn lên chân |
| Hoa nở | Mộc: hồi phục | cánh hoa bay tới đồng đội, hoa nở dưới chân rồi cánh bay lên |
| Phật thủ ấn | Quang: bùa chú, diện rộng | bàn tay vàng khổng lồ hiện trên không, ấn xuống, in dấu tay lên đất |
| Thánh quang thập tự | Quang: hồi phục, hộ thể | tia sáng từ trời xuống, thập tự sáng đứng trên đồng đội |
| Liệt nhật | Cực dương: diện rộng, bùa chú | mặt trời nhỏ thành hình trên vùng rồi rơi xuống nổ tia |
| Nguyệt thực | Cực âm: diện rộng | vùng tối với trăng khuyết hút hạt vào tâm, co lại rồi bùng tím |
| Quỷ thủ | Âm lãnh: khống chế, diện rộng | vệt tối bò dưới đất, tay ma trồi lên nắm chân mục tiêu |
| Bão tuyết | Cực hàn: diện rộng | gió tuyết thổi chéo khắp vùng, sương băng phủ đất |
| Kim cương xử | Kim: cận chiến đơn | chày kim cương xoay trên không rồi giáng thẳng xuống |

Chọn dáng (`dang_chon.ts`, đề xuất; trận thật chưa có dữ liệu dáng của từng công pháp):
1. Tài năng: sát thủ đánh cận chiến, thân pháp ra huyết tuyến; Tu kim tiền đánh tầm xa ra đồng tiền bay.
2. Hệ chủ theo bảng `BY_ELEMENT` (cột "Hệ, loại chiêu tự chọn" ở trên, cùng Lôi thiên lôi, Thổ gai trồi, Cực hàn khống chế gai băng, Phong lốc xoáy).
3. Âm tà còn lại (Âm lãnh, Cực âm) đánh tầm xa, khống chế, bùa chú: đầu lâu.
4. Kim hệ hoặc cầm kiếm: diện rộng là mưa kiếm, bùa chú là cự kiếm, tầm xa và quét là kiếm trận.
5. Cầm đao, quét hoặc diện rộng: đao khí.

Vũ khí lấy theo ngoại hình màn Trận (`assignLooks`), tài năng theo `tu_si/<tài năng>` của replay. Đề xuất về sau: thêm cột "Dáng chiêu" cho tàn quyển trong Excel, sim mang theo lên replay, dáng ghi sẵn được ưu tiên hơn luật trên. Trang xem thử có ô "Dáng chiêu" để ép một dáng.

Ý tưởng cho đợt sau (chưa làm):
- Theo tài năng, vũ khí GDD mục 6:
  - Tu thể: quyền ảnh dồn dập. Tu pháp: vòng phù văn quanh pháp trượng bắn tia.
  - Tu trận: trận bàn bay ra xoay rồi nổ. Tu đan: hồ lô phun lửa đan, độc vụ.
  - Tu rèn: búa rèn giáng, tia lửa, sóng chấn. Tu dược: lưỡi liềm xanh, cánh hoa thuốc.
- Phe tà: huyết hải dâng dưới chân, vạn hồn phiên (oan hồn bay quanh cờ), ma nhãn trên trời chiếu tia.
- Chiêu cuối theo tông môn: pháp tướng khổng lồ hiện sau lưng tông chủ.

Dữ liệu từ replay:
- `cast.grade` lấy từ sim.
- Sự kiện `status`: simSource so `stunUntil`, `rootUntil`, `slowUntil`, `burnUntil`, `healCutUntil`, `shieldUntil`, `exposedUntil`, `stealthUntil` giữa hai tick.
- Sim chưa giữ biến thể của chủ quyển trong `Technique`, nên trận thật vẽ biến thể trung tính. Trang xem thử dùng biến thể của công pháp mẫu.

## Quy ước

- Mỗi hiệu ứng là hàm của (replay, thời điểm phát t, tốc độ) và seed của sự kiện: tua tới lui, ×1, ×2, ×4 ra đúng một hình. Thời lượng tính bằng giây thực rồi đổi ra tick theo tốc độ (như `life()` của màn Trận); đạn bay chạm đúng tick trúng.
- Màu lấy từ `theme/elements.ts`. Nền sân sáng nên phần cộng sáng chỉ giữ khoảng một nửa (`Emitter.addScale`), để màu hệ không ngả trắng.
- Hiệu ứng nằm trên người, thanh máu, số sát thương, nên phải ngắn và trong (điều kiện của proto-shell).
- Không sửa `packages/sim`; cần thêm dữ liệu sự kiện thì nhắn phiên giữ sim.
- Hạt dùng instancing; đông chiêu thì giảm số hạt mỗi chiêu (`setCrowd`), hình chính giữ nguyên.
- Nhiều vòng diện rộng, trận đồ cùng hiện thì mỗi cái mờ theo 1/√n (`Ctx.zoneK`), vòng nổ tắt nhanh hơn, để vẫn đọc được thanh máu và số (góp ý của proto-shell 2026-11-04).
- Chuyển động theo luật ở [DONG_TAC.md](DONG_TAC.md) (người dùng gửi công thức 2026-11-05): nhịp 30 khung/giây, tụ lực lùi đà, cung trọng lực, trễ nhịp, co giãn theo tốc độ, khung va chạm rồi khựng thay cho chớp mờ dần.

## Trang xem thử

Chạy dev, mở `/src/hieu_ung/xem_thu/index.html`:
- chọn một trong 300 công pháp mẫu, đổi phẩm, biến thể, hệ phụ, bật chiêu cuối;
- bật "2D cũ" để so với bản trước;
- "Ảnh nhịp" dựng tấm ảnh mỗi nhịp một ảnh: tụ lực, đường bay, khung va chạm, khựng, bung, trạng thái;
- "Soi từng khung" dựng mọi khung 30 khung/giây quanh lúc chạm, ghi số khung và nhịp;
- nút ◀ ▶ chạy qua 12 chiêu tiêu biểu: mỗi hệ một chiêu, phủ đủ 10 loại chiêu.

## Đo (máy dev, 2026-11-04)

- Trận seed 11 ở ×4, lúc đông chiêu nhất (khoảng 1.100 tấm):
  - cả khung màn Trận (2D, ghép hiệu ứng, GPU, có chờ GPU xong): 2,07 ms;
  - riêng ghép hiệu ứng: 0,64 ms; ở ×1 là 0,22 ms.
- Gói:
  - chunk `engine-*.js` 54 KB (19,6 KB gzip), chỉ tải khi vào màn Trận;
  - phần three dùng chung lớn thêm khoảng 6 KB;
  - gói chính tăng dưới 3,3 KB.
- Chưa đo trên Android thật (Sprint 8).

## Việc còn mở

- Sim ghi biến thể chủ quyển vào `Technique` (hoặc cast), để trận thật vẽ Bạo, Tốc, Linh, Bền.
- Sim ghi cờ tuyệt sát. Hiện suy từ "bị hạ đúng tick trận pháp kích".
- Đo 60 khung/giây trên Android tầm trung.

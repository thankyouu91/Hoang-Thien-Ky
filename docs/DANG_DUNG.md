# Dáng đứng nhân vật

Dáng đứng là tư thế chờ của tu sĩ trong màn Trận và màn Nhân vật (khi không ra chiêu, không trúng đòn, chưa ngã). Mỗi tài năng có dáng riêng, để nhìn dáng là đoán được vai trò, giống nhóm vũ khí theo tài năng ở GDD mục 6. Người dùng duyệt hướng này ngày 2026-11-04, kèm ảnh mẫu: lơ lửng chân buông thõng; khoanh tay, kiếm sau lưng; vác vũ khí, chống nạnh; bắt ấn có vòng hào quang sau lưng.

Mã: `proto/src/scenes/battle/dangDung.ts`. Dải hình: `assets/pixellab/nhan_vat/<thân>/<áo>/dung_<dáng>.png`. Công cụ dựng dải: `tools/dang_dung/`.

## Danh mục

| Mã | Tên | Cách làm | Vũ khí | Hiệu ứng code |
|---|---|---|---|---|
| `thuong` | Đứng thở | dải `dung` có sẵn | cầm tay | — |
| `the_thu` | Thế thủ quyền | PixelLab, move `guard` | cầm tay | khí tức màu hệ bốc quanh người |
| `chuc_kiem` | Chúc kiếm | code trên dải `dung` | chúc mũi xuống đất bên hông | — |
| `lo_lung` | Lơ lửng | PixelLab, move `hover` (chân buông thõng, tay hơi dang) + code nhấc 10 px, nhấp nhô | cầm tay | lửa khí màu hệ dưới chân, bóng nhỏ và nhạt |
| `tran_do` | Trận đồ dưới chân | code trên dải `dung` | cầm tay | vòng trận đồ màu hệ xoay trên đất |
| `bat_an` | Bắt ấn | PixelLab, tư thế viết tay (một tay dựng trước mặt) | cất | vòng pháp luân màu hệ sau lưng, bùa giấy bay quanh |
| `thien_toa` | Ngồi thiền | PixelLab, tư thế viết tay (ngồi trên đất, tay trong lòng) + code nhấc 3 px | đeo lưng | đan hỏa lượn bên cạnh |
| `khoanh_tay` | Khoanh tay, kiếm sau lưng | PixelLab, tư thế viết tay | đeo chéo sau lưng | — |
| `vac_vai` | Vác vũ khí | PixelLab, tư thế viết tay (nắm tay giơ ngang vai, tay kia chống hông) | gác lên vai | — |
| `chap_tay` | Chắp tay sau lưng | PixelLab, tư thế viết tay | đeo lưng | lá thuốc bay quanh |
| `chong_nanh` | Chống nạnh | PixelLab, tư thế viết tay (tay chống hông, tay kia trước ngực) | cầm trước ngực (bàn tính về sau) | đồng tiền xoay quanh |
| `ngu_kiem` | Ngự kiếm | dải `chap_tay` + code nhấc 12 px | đeo lưng | phi kiếm dưới chân, vòng hào quang vàng sau lưng |

## Chọn dáng

| Tài năng | Dáng (dáng đầu là dáng chính) |
|---|---|
| Tu thể | `the_thu`, `chuc_kiem` |
| Tu pháp | `lo_lung`, `bat_an` |
| Tu trận | `tran_do`, `bat_an` |
| Tu đan | `thien_toa` |
| Sát thủ | `khoanh_tay` |
| Tu rèn | `vac_vai`, `chuc_kiem` |
| Tu dược | `chap_tay`, `thien_toa` |
| Tu kim tiền | `chong_nanh` |
| Tông chủ (vai trò, đè lên tài năng) | `ngu_kiem` |

- Màn Trận (`assignDang`): tài năng lấy từ khoá hình `tu_si/<tài năng>` của `ReplayUnit.sprite`; tông chủ là người id nhỏ nhất mỗi đội (cùng luật với `assignLooks`). Người cùng tài năng trong một đội lần lượt nhận các dáng trong danh sách, để không đứng giống hệt nhau.
- Màn Nhân vật: `dangFor(talent.id, role === "tong_chu")`, lấy dáng chính.
- Dáng bay (`lo_lung`, `ngu_kiem`) giữ độ nhấc cả lúc ra chiêu và trúng đòn, xuống đất khi ngã. Hiệu ứng khác chỉ hiện lúc đứng.
- Dự phòng: thân và áo chưa có dải `dung_<dáng>` thì vẽ dải `dung` thường cùng vũ khí và hiệu ứng của dáng; chưa có cả dải `dung` thì nơi gọi vẽ hình tĩnh như cũ.

## Đề xuất về sau (chưa làm)

- Theo phe (GDD mục 10): tà phái khí tức đỏ đen, chính phái ánh vàng nhạt. Replay chưa có trường phe; khi có thì truyền màu vào `tint`.
- Vũ khí theo tài năng (quyền giáp, trận bàn, hồ lô, song chủy, búa rèn, liềm, bàn tính) khi có hình: `vac_vai` sẽ vác búa, `chong_nanh` cầm bàn tính, `thien_toa` có thể ôm hồ lô.
- Áo theo tài năng (đã có state trên PixelLab: tu trận, tu đan, sát thủ, tu rèn, tu dược, tu kim tiền) khi có dải hoạt ảnh: chạy lại `tools/dang_dung/lam.ts` cho áo mới sau khi vẽ các dáng trên state đó.

## Làm thêm dải cho thân hoặc áo mới

1. Trên PixelLab, gọi `animate_character` với state thân + áo, `mode: "skeleton-v3"`, `directions: ["south-east"]`, `animation_name: "dung_<dáng>"` và tư thế như bảng dưới (10 khung; 3 khung đầu là đoạn chuyển, lam.ts bỏ đi). Mỗi lần 3 lượt.
2. `node tools/dang_dung/lam.ts <dáng,…|all> <thân/áo,…|all> <thư mục tạm> <ra.json>`: tải khung, ghép dải, ước neo (0,1 lượt mỗi khung).
3. `node tools/dang_dung/ghep.ts <ra.json> assets/pixellab/manifest.json`.

| Dáng | Tư thế gửi PixelLab |
|---|---|
| `the_thu` | `move: { name: "guard", energy: 0.9 }`, 8 khung |
| `lo_lung` | `move: { name: "hover", energy: 0.8 }`, 8 khung; mọi khung `right_hand [0.215, 0.03, ~0]`, `left_hand [-0.215, 0.03, ~0]`, `head [0, 3]` |
| `khoanh_tay` | khung 4–10: `right_hand [-0.085, 0.1, 0.08]`, `left_hand [0.085, 0.09, 0.1]`, khuỷu `[±0.7, 0.3, -0.6]`, `lean [-3, 0]`, `head [0..8, -4]`, hông nhấp 0,002–0,008 |
| `chap_tay` | khung 4–10: `right_hand [0.02, -0.125, 0.02]`, `left_hand [-0.02, -0.125, 0.03]`, khuỷu `[±1, -0.6, -0.3]`, `lean [-5, 0]`, `head [6, -6]` |
| `thien_toa` | khung 4–10: `pelvis [0, 0, -0.249]`, `right_foot [-0.24, 0.14, 0]`, `left_foot [0.24, 0.11, 0]`, tay `[±0.05, 0.12, -0.03]`, khuỷu `[±0.6, 0.2, -1]`, `head [0, 5]` |
| `vac_vai` | khung 4–10: `right_hand [0.15, 0.05, 0.17]`, khuỷu `[0.5, 0.4, -1]`, `left_hand [-0.15, -0.01, 0.04]`, khuỷu `[-1, -0.3, 0.1]` |
| `chong_nanh` | khung 4–10: `left_hand [-0.15, -0.01, 0.04]`, khuỷu `[-1, -0.3, 0.1]`, `right_hand [0.09, 0.15, 0.09]`, khuỷu `[0.3, 0, -1]` |
| `bat_an` | khung 4–10: `right_hand [0.04, 0.14, 0.23]`, khuỷu `[0.4, 0.2, -1]`, `left_hand [-0.21, -0.05, -0.01]`, `chest 10`, `head [-5, 3]` |

Danh sách đầy đủ từng khung nằm trong lịch sử gọi PixelLab (trường `params.group` của dòng manifest là animation group).

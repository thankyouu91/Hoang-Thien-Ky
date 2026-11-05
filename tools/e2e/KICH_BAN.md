# Kịch bản người chơi mới: từ link mời tới hết nhập môn

Kịch bản này là nguồn cho bài kiểm Playwright trong `kiem/` và cho lượt chơi thử bằng tay. Nó bám GDD mục 14 ("15 phút đầu (FTUE)", 8 bước) và chuỗi nhiệm vụ chương 0 `chinh.0.1`–`chinh.0.7` trong `data/nhiem_vu/ha_nhiem_vu.json`.

## Người chơi mẫu

| Vai | Số điện thoại | Ngày sinh | Ghi chú |
|---|---|---|---|
| Người lớn | `0910000001` | tròn 25 tuổi | Đi hết FTUE |
| Dưới 16 tuổi | `0910000002` | tròn 12 tuổi | Người giám hộ `0910000003`; thấy giờ chơi còn lại |
| Quá nhỏ | `0910000004` | tròn 3 tuổi | Phải bị từ chối |

Mã OTP là mã thử in trên màn (prototype chưa gửi SMS). Số thật không dùng.

## Các bước

Cột "Cấp sau bước" tính theo đường cong kinh nghiệm E(L) ở tab Nhiệm vụ của GDD (E(1) = 460, E(2) = 560, E(3) = 670, E(4) = 790) và phần thưởng của chương 0. Nếu tab Khởi đầu mới cộng thêm kinh nghiệm từ trận, cấp có thể cao hơn, nhưng không được thấp hơn.

| # | Bước người chơi làm | FTUE (GDD) | Nhiệm vụ | Phải thấy | Cấp sau bước |
|---|---|---|---|---|---|
| 0 | Mở `https://play.thienhoangky.fun/moi/<mã>` | — | — | Trang chuyển về `/`, hiện màn đăng nhập. Mở lại link không tốn thêm lượt | — |
| 1 | Gõ số điện thoại, nhận mã thử, gõ mã, nhập ngày sinh | 1 | — | Số sai thì nút khóa; mã sai thì báo lỗi; dưới 16 tuổi bắt người giám hộ; cả bước dưới 1 phút | 1 |
| 2 | Chọn vùng bắt đầu (vùng gợi ý chọn sẵn), đi tới thành chủ | 2 | `chinh.0.1` | Mỗi vùng hiện hệ chủ đạo và tàn quyển hay rơi | 1 (200 kinh nghiệm) |
| 3 | Gieo quẻ ở bia Tầm Đạo: nhận linh căn và tài năng, chọn thân, áo, mũ, kiểu vũ khí | 3 | `chinh.0.2` | Hiệu ứng gieo quẻ; linh căn và tài năng hiện ở màn Nhân vật | 1 (450) |
| 4 | Gia nhập tông môn được gợi ý trong vùng, về sơn môn | 4 | `chinh.0.3` | Tên tông môn trên Động phủ và tab Tông môn; chức vị ngoại môn hoặc đệ tử | 2 (750) |
| 5 | Ghép công pháp đầu từ 2 tàn quyển tặng sẵn | 5 | `chinh.0.4` | Công pháp tân thủ vào 1 trong 4 ô mang vào trận | 3 (1.100) |
| 6 | Đánh trận PvE đầu (3 dị thú hệ bị khắc) | 6 | `chinh.0.5` | Trận phát được, thấy chữ khắc chế hệ, thắng, về Động phủ | 3 (1.500) |
| 7 | Cùng tông môn chiếm một mỏ linh thạch cấp 1 của NPC trong tầm Truyền Tống Trận, rồi thu mỏ ở Động phủ | 7 | `chinh.0.6` | Mỏ đổi sang màu tông môn; thu mỏ thì linh thạch tăng | 4 (1.950) |
| 8 | Đặt nhắc giờ bí cảnh gần nhất (12:00 hoặc 20:00) trên thẻ Lịch | 8 | `chinh.0.7` | Lịch hiện giờ bí cảnh kế tiếp và dấu đã nhắc; nhận đan, phù | **5** (2.500) |
| 9 | Chơi tiếp: nhiệm vụ chính `chinh.1.1` Ải thứ nhất (mở ở cấp 5) | — | `chinh.1.1` | Việc nên làm chỉ tới bước kế; không có ngõ cụt | 6 |

Ở mỗi bước, hướng dẫn tối đa 2 câu và người chơi tự chạm (GDD mục 14, Nguyên tắc). Thuật ngữ Hán Việt có tooltip.

## Kiểm thêm

- **Không vào thế giới mẫu:** sau đăng nhập, thanh trên là `Cấp 1`; không có mỏ đang bị đánh, đồ +8, tông chủ cấp 42. Thế giới mẫu chỉ còn ở `?demo=1`.
- **Tải lại trang giữa chừng** (sau bước 4 và sau bước 8): vẫn đăng nhập, cùng cấp, cùng bước FTUE, không bắt làm lại bước đã xong.
- **Chơi lại từ đầu:** nút trong màn Nhân vật (phần Tài khoản) hoặc Cài đặt; có hỏi lại; xong thì về cấp 1 và FTUE bước 2. Tài khoản khác trên cùng máy không bị xóa.
- **Hai khung:** điện thoại 375 × 812 (cảm ứng) và máy tính 1280 × 800. Không nút nào bị che, không phải cuộn ngang.
- **Tiếng Anh:** chọn EN ở màn đăng nhập rồi đi hết FTUE. Không còn chữ tiếng Việt có dấu trên màn, trừ tên riêng (Thiên Hoang Ký).
- **Không có lỗi JS** trong console suốt lượt chơi.
- **Sự kiện ẩn danh** (chỉ trên mạng): `ftue_buoc` 1–8 đi đủ, đúng thứ tự.

## Mức lỗi

| Mức | Nghĩa |
|---|---|
| Chặn | Người chơi không đi tiếp được, hoặc vào sai trạng thái (ví dụ cấp 42) |
| Nặng | Đi tiếp được nhưng sai luật GDD, mất tiến độ, hoặc phải đoán mới biết làm gì |
| Nhẹ | Chữ, bố cục, dịch, chỗ khó hiểu không làm kẹt |

## Chạy

```
cd tools/e2e
npm.cmd install
npm.cmd run cai-trinh-duyet
npm.cmd test                       # build proto vào .ban-build, chạy cả 2 khung
npm.cmd run test:mang -- <mã mời>  # trên play.thienhoangky.fun; mã chỉ đi qua biến môi trường
npm.cmd run bao-cao                # mở báo cáo HTML (ảnh từng bước, trace khi trượt)
```

Ảnh từng bước nằm ở `ket-qua/anh/<khung>/<nhóm>/`. `E2E_BO_BUILD=1` thì bỏ bước build, dùng `.ban-build` có sẵn.

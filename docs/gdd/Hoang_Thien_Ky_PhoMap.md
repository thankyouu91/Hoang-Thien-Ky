# Thiên Hoang Ký · Bảng phổ map luyện cấp (Hạ vị diện)

Lập 2026-11-10. **Toàn bộ là đề xuất, chưa chốt.** Bảng này xếp map nhỏ (tầng 2, GDD mục 3 "Di chuyển hai tầng") theo cấp nhân vật 1–250 cho 12 vùng Hạ vị. Trung vị, Thần vực, Thánh vực chưa xét.

## 1. Vì sao cần bảng này

Bản chơi thử `proto/choi.html` đang nối 13 vùng thành một dải thẳng, mỗi vùng hơn vùng trước 12 cấp. Ở mỗi dải cấp chỉ có đúng một nơi để đi: mọi người dồn vào một bãi và không có gì để chọn. GDD mục 3 thì đã chốt ngược lại: vùng nào cũng có cấp nguy hiểm từ 1 tới 250, "bậc 10 cấp nào cũng có chỗ luyện". Bảng này cụ thể hóa hướng của GDD.

Tham khảo cách một MMORPG võ hiệp kinh điển phổ khoảng 130 map luyện công cho cấp 1–90 (video tổng hợp, xem ngày 2026-11-10; chỉ lấy nguyên tắc, không lấy tên hay nội dung):

| Nguyên tắc | Áp dụng ở đây |
|---|---|
| Mỗi bậc 10 cấp có 12–17 map song song | Mỗi bậc 10 cấp có 12 bãi, mỗi vùng một bãi |
| Từ cấp 20, quái trong một map đồng cấp (bậc + 5) | Quái trong một bãi đồng cấp, bằng giữa bậc |
| Mỗi map một cảnh, một họ quái, một tỉ lệ ngũ hành | Mỗi vùng một cảnh và một hệ; mỗi bãi 2 loài |
| Map khác nhau ở mật độ, độ xa, quái hiền hay dữ | Năm loại khu có tính cách riêng (mục 3) |
| Động nhiều tầng dùng chung một bộ hình | Hang dị thú 5 tầng mỗi vùng |
| Map gắn nhiệm vụ môn phái | Truyện vùng 6 bước đã neo vào mỏ, hang, đèo, cửa bí cảnh |
| Cuối game luyện vì đồ rơi, không vì kinh nghiệm | Bãi cấp 241–250 và hầm ngục |

## 2. Khung chung của một vùng

Mỗi vùng có 13 mẫu map nhỏ. "Mẫu" nghĩa là: vùng có 236–601 điểm trên map lớn, nhưng không vẽ riêng map cho từng điểm; điểm loại T ở cảnh giới k dùng chung mẫu (vùng, T, k), chỉ khác vị trí tổ quái.

| Mẫu | Số lượng | Cấp | Ghi chú |
|---|---|---|---|
| Thành chủ | 1 | an toàn | Chợ, NPC, hồi sinh |
| Bến đò | 1 | an toàn | Nối sang vùng kề |
| Khu dã ngoại | 5, mỗi cảnh giới một khu | 4 bãi × 10 cấp | Loại khu xoay theo bảng mục 4 |
| Hang dị thú | 5 tầng, mỗi cảnh giới một tầng | 1 bãi × 10 cấp | Một bộ hình cho cả 5 tầng |
| Cửa bí cảnh | 1 | trùm, phó bản | Giữ như GDD |

Cả Hạ vị: 12 × 13 = **156 mẫu map**, trong đó 120 map có quái, với 12 × (5 × 4 + 5) = **300 bãi**.

Cấp của bãi theo cảnh giới k (1 Luyện Khí, 2 Trúc Cơ, 3 Kết Đan, 4 Nguyên Anh, 5 Hóa Thần), với gốc = 50 × (k − 1):

| Nơi | Bãi | Dải cấp người chơi | Cấp quái |
|---|---|---|---|
| Khu dã ngoại k | 1 | gốc + 1 đến gốc + 10 | gốc + 5 |
| Khu dã ngoại k | 2 | gốc + 11 đến gốc + 20 | gốc + 15 |
| Khu dã ngoại k | 3 | gốc + 21 đến gốc + 30 | gốc + 25 |
| Khu dã ngoại k | 4 | gốc + 31 đến gốc + 40 | gốc + 35 |
| Hang dị thú tầng k | 1 | gốc + 41 đến gốc + 50 | gốc + 45 |

Ngoại lệ: bãi cấp 1–10 của mọi vùng là bãi tân thủ. Quái nhảy cấp ngẫu nhiên 1–10, không tự tấn công, nằm trong tầm NPC hộ đạo của thành chủ nên không bị đồ sát.

## 3. Tính cách năm loại khu và hang

| Loại | Mật độ quái | Quái | Đồ rơi nghiêng về | Điểm riêng |
|---|---|---|---|---|
| Đồng hoang | Thưa đến vừa | Hiền | Ngọc | Dễ treo auto một mình |
| Mỏ dược | Vừa | Hiền, có một tinh anh đi tuần | Dược liệu | Phải né tinh anh |
| Mỏ quặng | Vừa | Dữ | Quặng | Địa hình hẹp, nhiều ngõ cụt |
| Mỏ linh thạch | Đông, hồi nhanh | Dữ | Linh thạch | Bãi ngon nhất bậc, dễ bị tranh bãi và đồ sát |
| Đèo | Thưa | Dữ, lẫn cướp Huyết Sát Môn | Tàn quyển | Thông sang vùng kề, không dùng được truyền tống |
| Hang dị thú | Đông gấp đôi | Dữ | Tàn quyển, ấn bộ | Hợp party; từ tầng 2 có cửa hầm ngục 3 tầng (GDD mục 3) |

Số cụ thể (quái mỗi bầy, thời gian hồi, tỉ lệ rơi) để ở cấu hình bãi, chưa đặt trong bảng này.

Đường đi: hang tầng k vào từ khu dã ngoại k của cùng vùng; hai tầng liền nhau thông nhau. Người chơi phải đi qua bãi thấp mới tới bãi cao, trừ khi dùng Truyền Tống Trận tới nơi đã mở sương mù.

## 4. Loại khu dã ngoại theo vùng và cảnh giới

Loại khu xoay vòng để ở cảnh giới nào cũng có đủ năm loại đồ rơi trên toàn Hạ vị (mỗi loại ở 2–3 vùng). Người chơi chọn vùng theo ba thứ: hệ quái mình khắc, loại đồ đang cần, và muốn bãi yên hay bãi đông.

Công thức: loại = danh sách [Đồng hoang, Mỏ dược, Mỏ quặng, Mỏ linh thạch, Đèo] lấy ở vị trí (thứ tự vùng + k − 1) chia dư 5, thứ tự vùng bắt đầu từ 0 theo bảng dưới.

| Vùng · hệ | Cảnh (đề xuất) | Luyện Khí 1–40 | Trúc Cơ 51–90 | Kết Đan 101–140 | Nguyên Anh 151–190 | Hóa Thần 201–240 |
|---|---|---|---|---|---|---|
| Vạn Mộc Lâm · Mộc | rừng rậm | Đồng hoang | Mỏ dược | Mỏ quặng | Mỏ linh thạch | Đèo |
| Hậu Thổ Nguyên · Thổ | thảo nguyên đất vàng | Mỏ dược | Mỏ quặng | Mỏ linh thạch | Đèo | Đồng hoang |
| Bích Ba Hải · Thủy | chuỗi hồ cạn | Mỏ quặng | Mỏ linh thạch | Đèo | Đồng hoang | Mỏ dược |
| Thiên Kiếm Nguyên · Kim | đồng kiếm, đá xám | Mỏ linh thạch | Đèo | Đồng hoang | Mỏ dược | Mỏ quặng |
| Xích Viêm Sơn · Hỏa | núi lửa, đá đen | Đèo | Đồng hoang | Mỏ dược | Mỏ quặng | Mỏ linh thạch |
| Cuồng Phong Nguyên · Phong | đồng cỏ gió | Đồng hoang | Mỏ dược | Mỏ quặng | Mỏ linh thạch | Đèo |
| Lôi Đình Cốc · Lôi | hẻm núi giông | Mỏ dược | Mỏ quặng | Mỏ linh thạch | Đèo | Đồng hoang |
| Diệu Quang Đài · Quang | đài đá trắng | Mỏ quặng | Mỏ linh thạch | Đèo | Đồng hoang | Mỏ dược |
| Liệt Dương Mạc · Cực dương | sa mạc | Mỏ linh thạch | Đèo | Đồng hoang | Mỏ dược | Mỏ quặng |
| U Minh Đầm · Âm lãnh | đầm sương | Đèo | Đồng hoang | Mỏ dược | Mỏ quặng | Mỏ linh thạch |
| Vạn Niên Băng Nguyên · Cực hàn | băng tuyết | Đồng hoang | Mỏ dược | Mỏ quặng | Mỏ linh thạch | Đèo |
| Cửu U Uyên · Cực âm | vực tối | Mỏ dược | Mỏ quặng | Mỏ linh thạch | Đèo | Đồng hoang |

Hang dị thú tầng k của mỗi vùng phủ dải cấp còn lại của cảnh giới: 41–50, 91–100, 141–150, 191–200, 241–250.

Ví dụ đọc bảng: người chơi cấp 115 (Kết Đan, bãi 2, quái cấp 115) cần quặng thì tới Mỏ quặng ở Vạn Mộc Lâm, Cuồng Phong Nguyên hoặc Vạn Niên Băng Nguyên; trong ba nơi đó chọn vùng có hệ quái mà công pháp của mình khắc.

## 5. Quái của từng bãi

- Hệ quái theo hệ chủ đạo của vùng (GDD mục 3).
- Mỗi bãi dùng 2 loài, để mỗi bãi có mặt mũi riêng; loài lặp lại ở bãi cao hơn được đổi màu và tên.
- Chưa gán loài cụ thể. Việc cần làm: lấy danh sách dị thú theo hệ trong `data/`, chia cho 25 bãi mỗi vùng.

## 6. Hình cần vẽ

156 mẫu map không cần 156 bộ hình:

| Bộ hình | Số bộ | Dùng cho |
|---|---|---|
| Bộ ô đất ngoài trời theo cảnh của vùng | 12 | 5 khu dã ngoại, thành chủ, bến đò của vùng đó |
| Bộ ô hang | 3 (đá xám, đá lửa, băng), đổi màu theo hệ | 60 tầng hang |
| Vật cảnh theo vùng (cây, đá, công trình mỏ) | 12 nhóm | Phân biệt năm loại khu trong cùng một vùng |

Năm khu dã ngoại của một vùng dùng chung một bộ ô đất; khác nhau ở bố cục, vật cảnh và quái. Bố cục dựng bằng `proto/sua_map.html`.

## 7. Thứ tự làm đề xuất

1. Một vùng mẫu đủ 13 mẫu map: Vạn Mộc Lâm.
2. Bộ ô đất rừng và bộ ô hang đá xám cho vùng mẫu.
3. Sửa `proto/src/scenes/mmo/tienTrinh.ts` từ dải thẳng 13 vùng sang khung này (việc code, chưa làm).
4. Nhân ra 11 vùng còn lại.

Danh sách đủ 300 bãi, tên 72 khu và hang đã duyệt 2026-11-10: [Hoang_Thien_Ky_BaiLuyen.md](Hoang_Thien_Ky_BaiLuyen.md) (sinh bởi `tools/o_dat/bai_luyen.mjs`).

## 8. Điểm còn mở

- Bãi 1–10 ở vùng có loại khu Đèo hoặc Mỏ linh thạch (Thiên Kiếm Nguyên, Xích Viêm Sơn, Liệt Dương Mạc, U Minh Đầm) vẫn theo luật tân thủ; tính cách "tranh bãi", "cướp" chỉ bắt đầu từ bãi 2.
- Vùng thứ 13 "Cấm Khu" trong bản chơi thử không có trong GDD; chưa xếp vào bảng.
- Có nên thêm 1–2 bãi "vàng" mỗi cảnh giới (đông quái hẳn, ai cũng muốn giành) để tạo điểm nóng đồ sát hay không.
- Khớp với luật luyện bãi quái hiện có (18 trận mỗi giờ, trần 8 giờ) chưa kiểm.

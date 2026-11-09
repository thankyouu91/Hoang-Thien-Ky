---
created: 2026-11-03 17:10
updated: 2026-11-09 10:30
tags:
  - project
  - game
  - gdd
type: project
status: active
source: git repo Hoang-Thien-Ky, docs/gdd (bản gốc cũ: Claude Docs tab Trang bị, pháp bảo và set đồ, rev 91)
---

# Trang bị, pháp bảo và set đồ

2026-11-03 · @ANN

Tab này là danh mục vật phẩm chiến đấu và hệ thống set đồ: 7 ô trang bị với 420 kiểu, 10 khí hình vũ khí, ngọc 12 hệ cùng 2 loại ngọc đặc biệt, 20 bộ set, 50 pháp bảo, 24 pháp khí, phù, đan và nguyên liệu rèn. Mọi số là đề xuất. Số liệu đầy đủ nằm ở 20 sheet mới của file số liệu `data/he_thong/HoangThienKy_HeThong_v1.xlsx`, xuất ra `data/he_thong/json/` trong repo game.

Tách thành tab riêng vì danh mục dài hơn 200 dòng bảng; mục 12 của tab chính giữ phần tóm tắt và trỏ sang đây.

## 1. Năm lớp vật phẩm chiến đấu

Trang bị cho chỉ số, pháp bảo cho phản ứng trong trận, pháp khí cho kinh tế. Ngọc, Ý châu và ấn bộ cùng khảm vào dòng khảm của trang bị, nên mỗi dòng khảm là một lựa chọn. Cách này giữ đúng luật đã chốt "thuộc tính chỉ hiện khi khảm ngọc" (mục 12).

| Lớp | Ô | Trong trận | Hao mòn | Cách có | Giao dịch (đề xuất) |
|---|---|---|---|---|---|
| Trang bị | 7 ô: vũ khí, mũ, áo, đai, bao tay, giày, ngọc bội | Cộng chỉ số gốc theo ô và độ hiếm | Độ bền 100, mất 1 mỗi trận, sửa ở lò rèn | Shop (lục), rơi, rèn, bí cảnh, săn thú | Lam, tím bán được; vàng, đỏ khóa |
| Pháp bảo | 1 ô ở Hạ vị, 2 ô từ Trung vị | Tự kích hoạt khi gặp điều kiện, 1–3 lần mỗi trận; không cộng chỉ số | Linh lực: mỗi lần kích hoạt tốn 1, nạp lại bằng linh thạch | Luyện từ pháp bảo phôi ở Luyện Khí Các; Cổ Tông Di Tích | Chưa tế luyện thì bán được (lục–tím); tế luyện xong khóa |
| Pháp khí | 1 ô | Không dùng trong trận | Không hao | Shop, rèn | Bán được |
| Ngọc hệ và Ý châu | Dòng khảm của trang bị | Ngọc: sát thương hoặc kháng một hệ; Ý châu: đổi hành vi một loại chiêu | Không | Bí cảnh, nén ngọc | Ngọc cấp 1–6 và Ý châu bán được; ngọc từ cấp 7 khóa (chốt) |
| Ấn bộ | Dòng khảm của trang bị | Hiệu ứng set khi đủ 2, 4, 7 món cùng ấn | Theo độ bền món mang ấn | Bí cảnh nguồn; đổi cống hiến khi tông giữ bí cảnh đó | 17 bộ bán được; 3 bộ thần khóa |

Thuật ngữ: trong mục 5, 6 và 10 của tab chính, "rèn pháp bảo" ở Luyện Khí Các là rèn chung cả trang bị lẫn pháp bảo. Tab này dùng "pháp bảo" theo nghĩa hẹp ở bảng trên.

## 2. Trang bị 7 ô

Chỉ số gốc theo ô và độ hiếm, không theo kiểu (đã chốt). Mỗi ô có một chỉ số chính, một chỉ số phụ và một vai cho ngọc: ba ô công nhận ngọc tăng sát thương hệ, bốn ô thủ nhận ngọc tăng kháng hệ. Giá trị là % chỉ số chuẩn của nhân vật cùng cấp, ở độ hiếm lục +0 (đề xuất).

Từ 2026-11-05 (Set đồ 2.0, số đo ở phần 14.7), số ở bảng dưới và bảng tẩy luyện ở phần 13 đã nhân ×0,85, làm tròn tới 0,1% (nửa làm tròn lên), khớp file số liệu. Áo và giày đã đổi sang thủ ngoại và thủ nội (người dùng chốt 2026-11-05).

| Ô | Chỉ số chính | Chỉ số phụ | Ngọc khảm vào | Hiện trên người | Nguyên liệu rèn một món lam |
|---|---|---|---|---|---|
| Vũ khí | Công lực +3,4% | Sát thương chí mạng +1,7% | Công | Có, hình theo tài năng | 10 quặng, 2 Linh Mộc |
| Mũ | Máu +1,7% | Mana tối đa +1,7% | Thủ | Có | 4 quặng, 2 Yêu Thú Cốt |
| Áo | Thủ ngoại +2,6% | Máu +1,3% | Thủ | Có | 6 quặng, 3 Yêu Thú Bì (giáp) hoặc 3 Thiên Tằm Ti (bào) |
| Đai | Máu +2,1% | Hồi máu nhận +0,9% | Thủ | Không | 2 quặng, 2 Vân Cẩm |
| Bao tay | Công lực +1,7% | Chí mạng +0,4% | Công | Không | 2 quặng, 2 Yêu Thú Bì |
| Giày | Thủ nội +2,6% | Tốc đánh +0,9% | Thủ | Không | 3 quặng, 2 Yêu Thú Bì |
| Ngọc bội | Mana tối đa +2,1% | Giảm hồi chiêu 0,4% | Công | Không | 1 quặng, 1 Vân Cẩm, 1 ngọc cấp 1 |

| Độ hiếm | Hệ số chỉ số gốc | Dòng khảm gốc | Nguồn |
|---|---|---|---|
| Lục | ×1,00 | 1 | Shop NPC ở thành chủ |
| Lam | ×1,12 | 2 | Rơi trong và ngoài bí cảnh; rèn ở lò cấp 1–4 |
| Tím | ×1,25 | 2 | Bí cảnh; rèn ở lò cấp 5 trở lên |
| Vàng | ×1,40 | 3 | Thần vật: bí cảnh hiếm, săn linh thú và thần thú |
| Đỏ | ×1,55 | 3 | Thần vật, hiếm hơn vàng |

- Đồ bí cảnh có chỉ số cao hơn 4–8% và thêm 1–2 dòng khảm (đã chốt); một món tối đa 5 dòng. Khớp với "đồ thường 1–3 dòng" ở mục 12.
- Một dòng khảm đã kích hoạt (bằng Khai Mạch Đinh) giữ đúng một thứ: ngọc hệ, Ý châu (chỉ vũ khí) hoặc ấn bộ.
- Rèn ra kiểu ngẫu nhiên trong độ hiếm đó; Tu rèn chọn được khí hình vũ khí hoặc dáng áo (giáp hay bào). Món tím tốn gấp đôi nguyên liệu.
- 7 món lục +0 cộng lại khoảng Công lực +5,1%, Thủ ngoại +2,6%, Thủ nội +2,6%, Máu +5,1%. Số ở bảng đã giảm một nửa ngày 2026-11-04 sau khi đo trần (phần 6), rồi nhân ×0,85 ngày 2026-11-05 khi thêm dòng rèn, binh bộ và dòng ẩn (phần 14.7).

## 3. Vũ khí và 10 khí hình

Vũ khí vẫn là một loại khi rơi, rèn và bán, đúng lý do đã chốt ở mục 6. Người dùng đã chốt 2026-11-03: 60 kiểu là icon và tên trong túi, cầm lên hiện nhóm vũ khí của tài năng người cầm (Quyền giáp, Pháp trượng… ở mục 6). Người dùng chốt thêm 2026-11-03: giữ 34 kiểu kiếm đã vẽ, chuyển 26 kiểu từ lam trở lên chưa vẽ sang 9 khí hình khác kiếm.

- Khí hình chỉ là hình và tên, không mang chỉ số, nên chợ chỉ cần thêm bộ lọc theo khí hình.
- Mối nối với 10 loại chiêu nằm ở Ý châu (phần 5): ngọc đặc biệt cùng tên khí hình, chỉ khảm vào vũ khí. Khảm Ý châu trùng khí hình thì món phát sáng, chỉ là hình.
- Khí hình không đổi cách rơi đồ, rèn hay bán: vẫn là một loại vũ khí, không chia 8 hay 10 loại.
- Mã TB-KI và độ hiếm theo số giữ nguyên (01–24 lục, 25–40 lam, 41–52 tím, 53–57 vàng, 58–60 đỏ). 34 kiểu đã vẽ (01–30, 41, 42, 53, 58) giữ là kiếm và giữ tên; 26 kiểu từ lam trở lên chưa vẽ đổi tên theo 9 khí hình còn lại (đã chốt). Vì vậy đồ lục ở shop đều là kiếm, khí hình khác có từ lam.

| Khí hình | Loại chiêu gắn | Số kiểu | Các kiểu (số TB-KI và tên) |
|---|---|---|---|
| Kiếm | Cận chiến đơn | 34 | 01–30, 41, 42, 53, 58: đã vẽ, giữ tên ở danh mục icon |
| Đao | Cận chiến quét | 4 | 31 Đao Hổ Khiếu, 40 Nguyệt Nha, 51 Hàn Nguyệt, 59 Phần Thiên |
| Thương | Thân pháp | 3 | 32 Thương Ngân Long, 43 Lôi Minh, 52 Truy Phong |
| Côn | Hộ thể | 2 | 33 Côn Bàn Long, 44 Kim Cang |
| Cung | Tầm xa | 3 | 34 Cung Hạc Vũ, 45 Truy Tinh, 54 Xạ Nhật |
| Phiến | Diện rộng | 4 | 35 Phiến Thu Thủy, 46 Hàn Băng, 55 Thái Hư, 60 Hỗn Độn |
| Bút | Bùa chú | 2 | 36 Bút Phán Quan, 47 Xuân Thu |
| Kỳ | Trận pháp | 3 | 37 Kỳ Ngũ Hành, 48 Thất Tinh, 57 Vạn Tượng |
| Cầm | Hồi phục | 3 | 38 Cầm Lưu Thủy, 49 Tiêu Vĩ, 56 Thiên Lại |
| Tiêu | Khống chế | 2 | 39 Tiêu Bích Ngọc, 50 Phượng Minh |

Trong ô Các kiểu, tên đầu ghi đủ khí hình, các tên sau bỏ chữ đầu cho gọn (40 Nguyệt Nha là Đao Nguyệt Nha). Vũ khí tím rơi nhiều nhất ở Vạn Kiếm Trủng (mục 11).

## 4. Giáp phục và phụ kiện

360 kiểu của 6 ô còn lại giữ tên ở danh mục icon. Dáng đọc từ chữ đầu của tên, chỉ là hình, dùng để lọc ở chợ và để Tu rèn chọn khi rèn.

| Ô | Dáng (số kiểu) | Ghi chú |
|---|---|---|
| Mũ | Quan 19 · Khôi 14 · Mũ 7 · Mạo 7 · Khăn 6 · Nón 5 · Ô sa 2 | Hiện trên người; khôi cho dáng võ tướng, quan cho đạo sĩ |
| Áo | Bào 40 · Giáp 20 | Hiện trên người; rèn giáp cần Yêu Thú Bì, rèn bào cần Thiên Tằm Ti |
| Đai | Đai lưng 60 | Da, vải, ngọc khấu |
| Bao tay | Hộ uyển 19 · Hộ thủ 18 · Thủ sáo 13 · Găng 10 | Hộ thủ là bao tay giáp kim loại |
| Giày | Ngoa 36 · Hài 16 · Giày, guốc, dép 8 |  |
| Ngọc bội | Bội 60 | Đá, ngọc, gỗ, đồng |

Hình trên người của mũ và áo vẫn theo nhóm độ hiếm, không theo từng kiểu (mục 6); hình giáp và hình bào là hai bộ riêng nếu người dùng muốn (câu hỏi mở ở mục 20).

## 5. Ngọc, Ý châu và ấn bộ

Dòng khảm nhận ba thứ: ngọc hệ cho sát thương hoặc kháng, Ý châu cho hành vi của một loại chiêu, ấn bộ cho set. Người chơi đổi chỉ số lấy chiến thuật trên cùng một số dòng có hạn.

**Ngọc 12 hệ** (cấp 1–10, công thức mới 0,1 × k × (k + 1)%, sửa cả ở mục 12 ngày 2026-11-04):

| Cấp | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---|---|---|---|---|---|---|---|---|---|
| Sát thương hoặc kháng hệ mỗi viên | 0,2% | 0,6% | 1,2% | 2% | 3% | 4,2% | 5,6% | 7,2% | 9% | 11% |

- Ngọc khảm vào ô công (vũ khí, bao tay, ngọc bội) tăng sát thương của công pháp có hệ chủ trùng hệ ngọc. Khảm vào ô thủ (mũ, áo, đai, giày) tăng kháng hệ đó. Trùng linh căn hiệu quả +20%. Trần mềm mỗi hệ (đề xuất): sát thương hệ từ ngọc, phần trên 15% chỉ tính một nửa, tối đa 25%; kháng hệ từ ngọc, phần trên 10% tính một nửa, tối đa 15%; tổng kháng một hệ từ mọi nguồn (ngọc, set, cộng hưởng, đan) tối đa 20%, nên hệ số khắc ×1,5 sau kháng vẫn còn ít nhất ×1,2. Đủ dòng khảm thì ngọc cấp 5 đã chạm trần; cấp cao hơn có ích khi nhường dòng cho ấn bộ và Ý châu.
- Tên trong tooltip (đề xuất), mã NG-KH-001 tới 012 theo thứ tự hệ: Canh Kim Thạch, Thanh Mộc Tinh, Huyền Thủy Châu, Xích Diễm Thạch, Hậu Thổ Tinh, Tử Lôi Tinh, Thanh Phong Ngọc, Diệu Quang Thạch, U Lãnh Ngọc, Thuần Dương Tinh, Huyền Âm Tinh, Hàn Tủy Ngọc.
- Nguồn: Ngọc Tủy Động ra mọi hệ; cấp 1–3 rơi rải rác ở mọi bí cảnh; cấp cao lên bằng nén. Băng Phách Cung ra Thủy và Cực hàn, Lôi Trì ra Lôi và Kim. Cách hiểu "đồ hệ Cực hàn, Thủy" của Băng Phách Cung (mục 11): đồ rơi ở đó có sẵn một ngọc Thủy hoặc Cực hàn.

**Ý châu** (mã NG-YC, chỉ khảm vào vũ khí, mỗi vũ khí 1 viên, không có cấp, bán được). Hiệu ứng áp cho mọi công pháp cùng loại chiêu người cầm mang vào trận. Phần giảm thời gian cộng sau phần cắt % của tài năng, sàn 1 s cho bày trận và 0,5 s cho vận công (đề xuất).

| Ý châu | Loại chiêu | Hiệu ứng (đề xuất) | Nguồn |
|---|---|---|---|
| Kiếm Ý Châu | Cận chiến đơn | Xuyên 15% khiên của mục tiêu | Vạn Kiếm Trủng, Luyện Khí Di Chỉ |
| Đao Ý Châu | Cận chiến quét | Trúng thêm 1 mục tiêu (5 thành 6), mục tiêu thêm nhận 50% | Vạn Kiếm Trủng, Luyện Khí Di Chỉ |
| Cung Ý Châu | Tầm xa | Tầm +1 ô, không cộng dồn với tầm +1 ô của Âm lãnh | Vạn Kiếm Trủng, Luyện Khí Di Chỉ |
| Phiến Ý Châu | Diện rộng | Vận công nhanh hơn 0,3 s (1 s còn 0,7 s) | Tàng Kinh Động, Luyện Khí Di Chỉ |
| Côn Ý Châu | Hộ thể | Khiên đặt lên đồng đội đang bị nhiều kẻ địch nhắm nhất | Tàng Kinh Động, Luyện Khí Di Chỉ |
| Bút Ý Châu | Bùa chú | Lần bùa đầu tiên mỗi trận nhắm kẻ địch máu thấp nhất | Tàng Kinh Động, Luyện Khí Di Chỉ |
| Kỳ Ý Châu | Trận pháp | Bày trận nhanh hơn 0,5 s (5 s còn 4,5 s) | Tàng Kinh Động, Luyện Khí Di Chỉ |
| Cầm Ý Châu | Hồi phục | Phần hồi tràn quá máu tối đa thành khiên bằng 50% phần tràn, giữ 3 s; tốn mana ×2,7 thay ×3 | Tàng Kinh Động, Luyện Khí Di Chỉ |
| Tiêu Ý Châu | Khống chế | Ưu tiên kẻ địch đang vận công (diện rộng, trận pháp) | Tàng Kinh Động, Luyện Khí Di Chỉ |
| Thương Ý Châu | Thân pháp | Lướt tới kẻ địch hàng sau có máu thấp nhất | Vạn Kiếm Trủng, Luyện Khí Di Chỉ |

**Ấn bộ** (mã NG-AN-001 tới 020): mỗi bộ set một loại ấn, luật ở phần 6 và 20 bộ ở phần 7.

## 6. Hệ thống set đồ

Set dựa trên ấn bộ khảm vào dòng khảm, không dựa trên kiểu đồ (đề xuất). Món nào cũng mang được ấn nào, nên set là lựa chọn chiến thuật trước mỗi trận, không phải việc săn đủ 7 món có tên. Kiểu vẫn chỉ đổi hình và tên như đã chốt.

**Luật (đề xuất):**

1. Mốc 2, 4, 7 là số món đang mặc có cùng ấn và còn độ bền trên 0. 3 món tính mốc 2; 5 hoặc 6 món tính mốc 4.
2. Mỗi món giữ tối đa 1 ấn. Tối đa 3 bộ cùng lúc (2+2+2 hoặc 4+2); có 7 ô nên chỉ một bộ đạt mốc 7.
3. Mốc 2 là cộng nhỏ; mốc 4 đổi cách ra chiêu hoặc khắc chế; mốc 7 là hiệu ứng riêng, kèm điều kiện hoặc giới hạn số lần mỗi trận.
4. Ấn không có cấp; hiệu ứng set không tăng theo cường hóa, độ hiếm hay cấp đồ. Người mới mặc đồ lục vẫn có đủ hiệu ứng set, đổi lại mất chỗ cho ngọc.
5. Mọi hiệu ứng trong trận phải deterministic: chọn mục tiêu hòa thì theo id; "mỗi trận" tính lại từ đầu mỗi trận mô phỏng.

**Trần sức mạnh (đề xuất):**

| Đủ mốc | Quy đổi lực chiến tối đa, cộng các mốc dưới |
|---|---|
| 2 món | 1% |
| 4 món | 3% |
| 7 món | 6% |

- Hiệu ứng set tính trong trần 35% của đồ (mục 13). Cả bộ 7 món không quá 6%, thấp hơn nhiều so với hệ số khắc ×1,5, nên đội yếu hơn 15% đúng hệ vẫn thắng (trụ cột 2).
- Hiệu ứng kinh tế của set cộng pháp khí không quá +10% mỗi loại sản lượng. Tỷ lệ nén ngọc, cường hóa, luyện đan từ set tính chung trần +15% của phù.
- Đo ngày 2026-11-04 (đội ngẫu nhiên, 150 cặp, đồ bí cảnh 5 dòng): đỏ +30 không ngọc 20,0%; đỏ +50 không ngọc 24,9%; đỏ +50 đủ ngọc 28,4%; thêm 7 ấn Vạn Kiếm 29,0%. Đội đúng hệ khắc yếu hơn 15% thắng ít nhất 83%, kể cả khi bên kia khảm kháng (ngưỡng đề xuất ≥ 70%). Đo mỗi bộ 7 món trên nền đỏ +50, ngọc cấp 10 (2026-11-04, có hành vi mốc 4 và 7): 13 bộ đã đo thêm từ 0,2% (Liệp Thú, chưa có dị thú) tới 1,9% (Hỗn Độn). Bàn Thạch vượt trần với +11,7% vì hóa đá, nên giảm còn 0,5 s dưới 15% máu (+5,1%). Cổ Tông +0,0% (đo với Thuẫn lục), Phá Quân +0,3% (hộ trận chưa có trong mô phỏng); các bộ kinh tế chưa đo. Đạo Cơ Bàn mạnh nhất hiện thêm gần 0%. Hiệu ứng nào vượt trần thì giảm số, không bỏ luật.

**Quan hệ với các hệ thống khác:**

| Hệ thống | Luật với set (đề xuất) |
|---|---|
| Cường hóa | Không làm mạnh hiệu ứng set. Di Hồn Phù chuyển nấc sang món mới, ấn vẫn nằm ở món cũ |
| Ngọc khảm | Ấn chiếm 1 dòng, nên món mang ấn bớt 1 ngọc; đồ lục chỉ có 1 dòng phải chọn ngọc hoặc ấn |
| Độ bền | Món về 0 độ bền không tính vào mốc cho tới khi sửa |
| Bí cảnh | 30% đồ tím trở lên rơi ở bí cảnh đã khảm sẵn ấn của bí cảnh đó ở một dòng thêm; ấn rời cũng rơi ở đó |
| Lãnh thổ | Tông môn giữ bí cảnh đổi được ấn của bí cảnh đó bằng cống hiến, nên tranh bí cảnh cũng là tranh set (trụ cột 3) |
| Chợ | Ấn chưa khảm của 17 bộ thường bán được; món đã khảm bán kèm ấn nếu món đó bán được |
| Khóa giao dịch | Ấn của 3 bộ thần (Chu Thiên, Phá Quân, Hỗn Độn) khóa vào nhân vật khi nhận |
| Gỡ ấn | Thoát Khảm Phù gỡ nguyên vẹn; gỡ không dùng phù thì ấn vỡ |
| Tiền thật | Ấn không bán bằng tiên ngọc; chỉ có qua bí cảnh, cống hiến và chợ linh thạch (mục 13) |
| Thăng vị diện | Ấn và hiệu ứng set giữ nguyên |

## 7. 20 bộ set

Mỗi loại bí cảnh ra ấn của đúng một bộ, nên bản đồ bí cảnh cũng là bản đồ set. Có 8 bộ theo tài năng, 8 bộ theo vai trò, 4 bộ theo hệ và khắc chế. 10 loại chiêu đều có một bộ đổi hành vi; Chu Thiên và Phá Quân lo hộ trận và công thành. Mọi số là đề xuất.

| Bộ | Nguồn ấn | Gắn với | 2 món | 4 món | 7 món |
|---|---|---|---|---|---|
| Tụ Bảo | Linh Thạch Quật | Tu kim tiền | Thuế chợ −1% (cộng với Tu kim tiền không dưới 2%) | Mỏ linh thạch người mặc trấn giữ +5% sản lượng | Mỏ người mặc trấn giữ bị chiếm thì sản lượng chưa thu vẫn về Bảo Khố; Tu kim tiền thêm 1 gian hàng |
| Bách Thảo | Dược Cốc | Tu dược | Hồi máu nhận +4% | Mỏ dược trấn giữ +5%; cứ 10 lần thu tay thêm 1 dược liệu cùng bậc | Lần đầu mỗi trận người mặc hoặc đồng đội kề bên bị giảm hồi máu (Cực âm) thì tẩy ngay; Tu dược nhận ra dược liệu hiếm cao hơn 1 bậc |
| Bàn Thạch | Khoáng Mạch Động | Tu thể; hộ thể | Khiên nhận được +6% | Hộ thể của người mặc che thêm chính mình (3 thành 4 mục tiêu, khiên phần thêm bằng 50%) | Lần đầu mỗi trận máu dưới 15%: nhận khiên bằng 6% máu tối đa trong 3 s (thay hóa đá 0,5 s ngày 2026-11-05 khi cân lộ); khai khoáng thủ công +5% |
| Liệp Thú | Thú Lâm | Săn dị thú; tầm xa | Sát thương lên dị thú và boss +5% (chỉ PvE) | Tầm xa ưu tiên kẻ địch máu thấp nhất trong tầm | Săn dị thú +10% cơ hội rơi đan thú; đòn Tầm xa đầu tiên mỗi trận PvE trúng thêm 1 mục tiêu |
| Thiết Kỵ | Cổ Chiến Trường | Tiền tuyến; cận chiến quét | Phòng thủ +3% | Mỗi lần Cận chiến quét, mục tiêu đầu tiên nhận thêm 20% sát thương | Đứng hàng trước khi hàng sau còn từ 2 đồng đội: nhận ít hơn 12% sát thương Diện rộng |
| Văn Uyên | Tàng Kinh Động | Tu pháp; diện rộng | Mana tối đa +4% | Diện rộng bị khống chế lúc vận công thì hoàn lại 50% hồi chiêu thay vì mất trắng | Chiêu Diện rộng đầu tiên mỗi trận không cần vận công; nộp tàn quyển vào Tàng Kinh Các +5% cống hiến |
| Ngọc Tủy | Ngọc Tủy Động | Khắc chế theo linh căn | Nén ngọc +2% tỷ lệ (tính chung trần +15% của phù) | Kháng hệ đang khắc linh căn chính của người mặc +6% | Đầu trận: kháng +8% với hệ xuất hiện nhiều nhất trong đội địch (hòa thì lấy hệ đứng trước trong bảng 12 hệ) |
| Linh Tuyền | Linh Tuyền Động | Hồi phục | Hiệu quả hồi máu và khiên +4% | Hồi phục: hồi mana khi đang vận chỉ −10% thay −20% | Khi một đồng đội ngã, chiêu Hồi phục kế tiếp hồi chiêu ngay (1 lần mỗi trận); bế quan +5% |
| Băng Phách | Băng Phách Cung | Thủy, Cực hàn; khống chế | Thời gian khống chế +5% | Khống chế liên tiếp cùng mục tiêu còn 75% thay vì 50% | Kẻ địch đang bị khống chế, đóng băng hoặc làm chậm nhận thêm 8% sát thương từ người mặc (bỏ điều kiện công pháp hệ Thủy, Cực hàn ngày 2026-11-05) |
| Lôi Trì | Lôi Trì | Lôi, Kim | Chí mạng +2% | Tê liệt khi chí mạng (Lôi) +0,25 s; xuyên giáp (Kim) +3% | Đòn chí mạng thứ 3 mỗi trận nảy sang 1 kẻ địch khác với 50% sát thương; cần ít nhất 1 công pháp hệ chủ Lôi hoặc Kim |
| Ngự Thú | Yêu Thú Sào Huyệt | Thú cưỡi | Hồi chiêu kích phát của thú cưỡi −5% | Hiệu ứng kích phát +10% (vẫn trong trần 15% lực chiến của thú) | Tỷ lệ qua thú kiếp và thuần phục +5% |
| Cổ Tông | Cổ Tông Di Tích | Pháp bảo | Linh lực tối đa của pháp bảo +20% | Hồi chiêu pháp bảo −15% | Pháp bảo kích hoạt thêm 1 lần mỗi trận (tối đa 3) |
| Đan Tiên | Đan Tiên Động Phủ | Tu đan | Đan dược tự dùng +5% | Đan dược buff trước trận kéo dài thêm 1 trận | Luyện đan +5% thành công; Tu đan có 10% không tốn dược liệu phụ |
| Thiên Công | Luyện Khí Di Chỉ | Tu rèn | Độ bền mất mỗi trận giảm một nửa (2 trận mất 1) | Sửa đồ không bị giảm độ bền tối đa | Cường hóa +3% thành công (tính chung trần +15%); Tu rèn có 10% rèn ra món thêm 1 dòng khảm |
| Huyết Ảnh | Huyết Sát Ma Quật | Sát thủ; thân pháp | Sát thương chí mạng +5% | Thân pháp chỉ lộ vị trí 2 s thay 3 s | Hạ gục kẻ địch bằng Thân pháp thì ẩn thân 1,5 s (1 lần mỗi trận). Bộ tà: mặc từ 4 món thì sát nghiệp nhận +50% |
| Độ Kiếp | Thiên Lôi Đài | Độ kiếp; bùa chú | Kháng Lôi +4% | Lần Bùa chú cuối cùng mỗi trận không tốn mana | Lôi kiếp (đột phá, thú kiếp, hộ pháp phi thăng) gây ít hơn 10% sát thương lên người mặc |
| Vạn Kiếm | Vạn Kiếm Trủng | Sát thương đơn; cận chiến đơn | Công lực +2% | Cận chiến đơn đánh mục tiêu dưới 30% máu +15% sát thương | Mỗi 5 s, đòn Cận chiến đơn kế tiếp phát kiếm khí trúng thêm kẻ đứng sau mục tiêu với 30% sát thương |
| Chu Thiên (thần) | Tiên Nhân Động Phủ | Tu trận; trận pháp | Bày trận nhanh hơn 0,5 s | Trận pháp đặt vào chỗ đông kẻ địch nhất thay vì quanh mục tiêu đầu tiên | Trấn giữ trận nhãn Hộ Sơn Đại Trận: trận nhãn đó +8% máu; Tu trận tuyệt sát +2% |
| Phá Quân (thần) | Thượng Cổ Chiến Trường | Công thành | Sát thương lên trận nhãn và hộ trận +5% | Đòn phá trận đầu tiên mỗi trận công thành ×1,5 | Khi công thành, người mặc miễn 1 lần tuyệt sát của trận pháp địch. Mốc 4 và 7 chỉ áp trong chiến tranh địa bàn |
| Hỗn Độn (thần) | Hỗn Độn Bí Cảnh | Mọi hệ | Kháng mọi hệ +2% | Trúng đòn của hệ khắc mình thì hệ số ×1,5 giảm còn ×1,4 | Trước trận chọn 1 hệ ngụy linh căn: 8 s đầu trận bị đánh tính theo hệ đó thay linh căn thật |

Bộ Hỗn Độn mốc 7 là bộ mạnh nhất về khắc chế, nên chỉ có 8 giây và ấn khóa vào nhân vật. Đối thủ vẫn xem được hệ ngụy linh căn ở màn chuẩn bị trận, để việc đọc trận trước khi đánh vẫn còn ý nghĩa (mục 8).

## 8. Đạo Cơ Bàn: ô bổ trợ và cộng hưởng set

Đạo Cơ Bàn là bàn lục giác 19 ô trong màn Nhân vật. Người chơi đặt ấn bộ và ngọc lên bàn để bộ có thêm món và các bộ kích nhau (đề xuất 2026-11-03, theo yêu cầu người dùng). Luật "kích nhau" dùng lại bảng quan hệ hệ của công pháp ở mục 9, nên người chơi đã biết ghép công pháp thì đọc được bàn. Mọi số là đề xuất.

**Bàn và ô mở theo cảnh giới.** Một ô tâm, 6 ô vòng trong, 12 ô vòng ngoài (6 ô cạnh kề 2 ô trong, 6 ô góc kề 1 ô trong). Tọa độ từng ô nằm trong file số liệu.

| Cảnh giới | Mở thêm | Tổng số ô |
|---|---|---|
| Luyện Khí, từ cấp 20 | Ô tâm | 1 |
| Trúc Cơ | 2 ô trong | 3 |
| Kết Đan | 2 ô trong | 5 |
| Nguyên Anh | 2 ô trong | 7 |
| Hóa Thần | 3 ô cạnh ngoài | 10 |
| Luyện Hư | 3 ô cạnh ngoài | 13 |
| Hợp Thể | 3 ô góc | 16 |
| Đại Thừa | 2 ô góc | 18 |
| Độ Kiếp | 1 ô góc | 19 |

**Đồ bổ trợ và luật đặt:**

1. Bàn nhận ấn bộ và ngọc hệ mọi cấp; ô tâm chỉ nhận ấn, gọi là ấn chủ. Viên đang ở trên bàn thì không khảm vào đồ. Ngọc trên bàn không cộng chỉ số, chỉ mang hệ để dẫn mạch, nên ngọc cấp thấp có chỗ dùng.
2. Một ô là **thông** khi nối được về ô tâm qua chuỗi ô kề đều có đồ và không cặp kề nào tương khắc. Ô không thông thì không tính gì.
3. Mỗi ấn thông tính thêm 1 món cho bộ của nó. Mỗi bộ thêm tối đa 2 món từ bàn, và chỉ khi bộ có ít nhất 2 món trên đồ đang mặc. Vì vậy mốc 4 cần 2 món đồ cộng 2 ấn, mốc 7 cần 5 món đồ cộng 2 ấn; tối đa 3 bộ cùng lúc như cũ.
4. Hai ô kề đều thông tạo một **mạch**, loại theo quan hệ hệ ở mục 9: Thuần (cùng hệ), Sinh (tương sinh hoặc tương hợp), Cực (đối cực), Trung (trung tính). Tương khắc thì mạch đứt.
5. Đổi bàn miễn phí, lúc nào cũng được khi không đang trong trận; gỡ khỏi bàn không vỡ. Trận dùng bàn đúng lúc khóa đội hình.

**Hệ của ấn:**

| Hệ | Bộ |
|---|---|
| Kim | Tụ Bảo, Vạn Kiếm |
| Mộc | Bách Thảo, Ngự Thú |
| Thủy | Linh Tuyền, Ngọc Tủy |
| Hỏa | Đan Tiên, Thiên Công |
| Thổ | Bàn Thạch, Chu Thiên |
| Lôi | Lôi Trì, Độ Kiếp |
| Phong | Liệp Thú, Thiết Kỵ |
| Quang | Văn Uyên |
| Âm lãnh | Cổ Tông |
| Cực dương | Phá Quân |
| Cực âm | Huyết Ảnh |
| Cực hàn | Băng Phách |
| Không hệ | Hỗn Độn: kề gì cũng là mạch Trung, nên không bao giờ làm đứt |

**Cộng hưởng (bộ kích bộ).** Hai ấn của hai bộ khác nhau, cả hai bộ đang kích (đủ mốc 2 sau khi tính bàn), đặt kề nhau và đều thông, thì cộng hưởng theo loại mạch giữa chúng.

| Mạch | Cộng hưởng | Tác dụng lên cả hai bộ |
|---|---|---|
| Thuần | Đồng Khí | Số ở mốc 2 ×1,25; kháng hệ đó +3% |
| Sinh | Tương Dưỡng | Số ở mốc 2 ×1,5 |
| Cực | Âm Dương | Số ở mốc 2 ×2; mana tối đa −2%, giống tổ hợp đối cực mạnh mà tốn mana |
| Trung | Không có |  |

- Mỗi bộ chỉ nhận cộng hưởng mạnh nhất của nó, không nhân dồn. Cộng hưởng chỉ nhân số ở mốc 2; hành vi ở mốc 4 và 7 không đổi.
- Ví dụ: Bàn Thạch (Thổ) ở tâm, Tụ Bảo (Kim) kề bên. Thổ sinh Kim nên thành Tương Dưỡng: khiên nhận +6% lên +9%, thuế chợ −1% thành −1,5%.
- Ví dụ: Phá Quân (Cực dương) kề Huyết Ảnh (Cực âm) thành Âm Dương: sát thương lên trận nhãn và sát thương chí mạng cùng từ +5% lên +10%, mana tối đa −2%.

**Hình nền theo cách tu luyện.** "Cách tu luyện" là 8 tài năng (người dùng xác nhận 2026-11-04). Mỗi tài năng có một hình nền bàn riêng, vẽ bằng Three.js ở màn Nhân vật; chỉ là hình, không đổi luật. Người có 2 tài năng chọn nền theo một trong hai, như hình vũ khí. Ô tâm sáng theo màu hệ của ấn chủ, mạch tô màu theo loại.

**Trần.** Món thêm từ bàn và cộng hưởng tính trong trần mỗi bộ (đủ 7 món không quá 6% lực chiến) và trần 35% của đồ. Bàn đầy so với không có bàn thêm tối đa khoảng 3% lực chiến. Đo 2026-11-04 trên cùng một cặp bộ: Đồng Khí +0,3%, Tương Dưỡng +0,6%, Âm Dương +0,2% khi phạt mana −5%. Phạt mana vì vậy giảm còn −2% để Âm Dương, loại khó xếp nhất, lợi bằng Tương Dưỡng (+0,6%). Cộng hưởng kinh tế vẫn chịu trần +10% mỗi loại sản lượng.

## 9. Pháp bảo

Pháp bảo là vật phản ứng trong trận: mỗi loại khắc một loại chiêu của địch, nên chọn pháp bảo là đọc đội hình đối phương. Địch nhiều trận pháp thì mang Phiên, nhiều thân pháp thì mang Ấn (đề xuất). "Kề bên" và "đứng sát" là trong 1 ô, "trong tầm" của Hồ lô là 4 ô; pháp bảo vẫn kích hoạt khi chủ bị khống chế (đề xuất).

- **Ô riêng:** 1 ô ở Hạ vị, 2 ô từ Trung vị. Không nằm trong 7 ô trang bị, không tính vào set.
- **Trong trận:** không cộng chỉ số; tự kích hoạt khi gặp điều kiện, theo số lần mỗi trận và hồi chiêu ở bảng dưới. Vàng và đỏ thêm 1 lần.
- **Linh lực thay độ bền:** tối đa 20, 25, 30, 40, 50 theo độ hiếm; mỗi lần kích hoạt tốn 1, hết thì không kích hoạt; nạp lại bằng linh thạch ở Luyện Khí Các. Không mòn tối đa như sửa trang bị.
- **Luyện:** Pháp Bảo Phôi cùng quặng ở Luyện Khí Các; độ hiếm của phôi là độ hiếm pháp bảo, loại do người luyện chọn. Từ tím trở lên chỉ Tu rèn luyện được, khớp "rèn pháp bảo từ Thiên phẩm" ở mục 6 vì thiên cấp nay là tím. Pháp bảo tự rèn +10% chỉ số chính (Tu rèn, mục 6).
- **Tế luyện (nhận chủ):** tốn linh thạch và 1 giờ trước khi dùng; tế luyện xong thì khóa vào nhân vật. Chưa tế luyện thì bán được (lục tới tím); vàng, đỏ khóa ngay khi nhận.
- **Thăng vị diện** giữ nguyên pháp bảo (mục 7).

| Loại | Khắc chiêu | Kích hoạt khi | Hiệu ứng, lục tới đỏ | Lần mỗi trận | Hồi chiêu | 5 món: lục, lam, tím, vàng, đỏ |
|---|---|---|---|---|---|---|
| Thuẫn | Cận chiến đơn | Đồng đội hàng trước sắp trúng đòn cận chiến đơn chí mạng | Chặn 50% tới 70% đòn đó | 2 | 8 s | Đằng Giáp Thuẫn, Huyền Thiết Thuẫn, Huyền Quy Thuẫn, Thái Sơn Thuẫn, Bàn Cổ Thuẫn |
| Luân | Cận chiến quét | Từ 3 kẻ địch cận chiến đứng sát chủ nhân | Đẩy lùi 1 ô (vàng, đỏ 2 ô), cắt chiêu quét đang ra | 1 | 10 s | Mộc Phong Luân, Thiết Phong Luân, Phong Hỏa Luân, Càn Khôn Luân, Nhật Nguyệt Luân |
| Châu | Tầm xa | Hàng sau trúng đòn tầm xa đầu tiên | 2 đòn tầm xa kế tiếp vào hàng sau giảm 40% tới 60% | 2 | 6 s | Hộ Tâm Châu, Định Phong Châu, Tử Kim Châu, Định Hải Châu, Hỗn Nguyên Châu |
| Tháp | Diện rộng | Kẻ địch bắt đầu vận công diện rộng | 3 đồng đội gần nhất nhận ít hơn 35% tới 51% từ chiêu đó | 2 | 8 s | Thanh Thạch Tháp, Trấn Yêu Tháp, Trấn Ma Tháp, Linh Lung Bảo Tháp, Cửu Tầng Thông Thiên Tháp |
| Hồ lô | Hộ thể | Kẻ địch trong tầm vừa nhận khiên hộ thể | Thu 50% tới 70% khiên đó về chủ nhân | 2 | 8 s | Tửu Hồ Lô, Ngọc Tịnh Hồ Lô, Thu Linh Hồ Lô, Càn Khôn Hồ Lô, Thôn Thiên Hồ Lô |
| Kính | Bùa chú | Chủ nhân hoặc đồng đội kề bên trúng bùa chú | Phản 30% tới 46% sát thương về người thi triển | 2 | 6 s | Đồng Kính, Chiếu Yêu Kính, Bát Quái Kính, Côn Lôn Kính, Âm Dương Kính |
| Phiên | Trận pháp | Kẻ địch bày xong trận | Trận đó gây ít hơn 40% tới 56% sát thương; mục tiêu đầu tiên không bị tuyệt sát | 1 | 20 s | Thanh Bố Phiên, Ngũ Hành Phiên, Tụ Linh Phiên, Thất Tinh Phiên, Hỗn Thiên Phiên |
| Đỉnh | Hồi phục | Kẻ địch hồi cho một mục tiêu từ 15% máu tối đa | Luyện hóa 40% tới 56% lượng hồi đó | 2 | 8 s | Thanh Đồng Đỉnh, Tam Túc Đỉnh, Cửu Long Đỉnh, Thần Nông Đỉnh, Cửu Châu Đỉnh |
| Chuông | Khống chế | Từ 2 đồng đội đang bị khống chế | Giải khống chế cả đội, miễn khống chế 1 s tới 1,8 s | 1 | 12 s | Đồng Linh, Thanh Âm Chung, Tỉnh Thần Chung, Thái Cổ Chung, Thái Nhất Chung |
| Ấn | Thân pháp | Kẻ địch dùng thân pháp lướt vào hàng sau | Choáng kẻ đó 1 s tới 1,5 s; đòn lướt giảm 50% | 2 | 8 s | Thạch Ấn, Trấn Sơn Ấn, Lôi Công Ấn, Phiên Thiên Ấn, Thiên Đế Ấn |

Mã món: PB-\<loại>-001 tới 005 theo thứ tự lục tới đỏ (ví dụ PB-TH-005 là Bàn Cổ Thuẫn). Nguồn: lục và lam luyện ở Luyện Khí Các hoặc rơi bí cảnh; tím ở Cổ Tông Di Tích hoặc do Tu rèn luyện; vàng ở Cổ Tông Di Tích, Tiên Nhân Động Phủ; đỏ ở Hỗn Độn Bí Cảnh, Thượng Cổ Chiến Trường và khi săn thần thú.

**Pháp bảo trấn giáo** thuộc tông môn, đặt ở Chính Điện, không phải của người chơi. Mọi loại đều nhân đôi máu hộ trận và theo luật diệt môn đã chốt ở mục 10. Có được bằng cách mua, đổi với thượng tiên, hoặc ghép 10 Mảnh pháp bảo trấn giáo (Thượng Cổ Chiến Trường). Từ 2026-11-05 (người dùng chốt) pháp bảo trấn giáo gộp vào bảo vật chấn tông ở mục 10 tab chính: 4 món này là bậc khởi đầu, chỉ có phần trấn tông và nét thêm bên dưới, không kích được, không thăng hạn; đúc một trong 30 bảo vật chấn tông thì món trấn giáo tan vào lò.

| Mã | Tên | Thêm ngoài máu hộ trận ×2 (đề xuất) |
|---|---|---|
| PB-TG-001 | Trấn Giáo Lệnh Bài | Không |
| PB-TG-002 | Tứ Tượng Trấn Giáo Kỳ | Mỗi đợt công bị đẩy lùi thì hộ trận hồi 5% máu |
| PB-TG-003 | Thông Thiên Trấn Giáo Tháp | Bên công thành tính như chênh thêm 5 cấp khi phá trận |
| PB-TG-004 | Thái Cổ Trấn Giáo Đỉnh | Khiên hộ tông sau diệt môn dài 4 ngày thay 3 |

## 10. Pháp khí

Pháp khí là công cụ ngoài trận, mỗi loại gắn phần kinh tế của một tài năng (đề xuất). Ai cũng dùng được; người có đúng tài năng nhận gấp đôi. Nằm ở 1 ô pháp khí riêng, không vào trận, không tính vào set, không có độ bền, chỉ có lục, lam, tím và bán được trên chợ.

| Loại | Tài năng hợp | Tác dụng, lục / lam / tím | 3 món |
|---|---|---|---|
| Cuốc | Tu thể | Khai khoáng thủ công +2% / +3% / +4% | Thiết Cuốc, Huyền Thiết Cuốc, Khai Sơn Thần Cuốc |
| La bàn | Tu pháp | Cơ hội gặp tài bảo trên chặng đang đi +5% / +8% / +12% | Đồng La Bàn, Tầm Bảo La Bàn, Thiên Cơ La Bàn |
| Trận bàn | Tu trận | Xây và sửa trận nhãn, Truyền Tống Trận nhanh hơn 3% / 5% / 7% | Mộc Trận Bàn, Ngọc Trận Bàn, Tinh Đẩu Trận Bàn |
| Quạt lửa | Tu đan | Luyện đan thành công +1% / +2% / +3% | Bồ Phiến, Khống Hỏa Phiến, Tam Muội Hỏa Phiến |
| Ngọc ẩn tức | Sát thủ | Giảm cơ hội gặp sự kiện xấu khi hành trình 5% / 8% / 12%, chung trần với phù hộ thân | Ẩn Tức Thạch, Ẩn Tức Ngọc, Vô Ảnh Ngọc |
| Chùy rèn | Tu rèn | Rèn tốn quặng ít hơn và sửa rẻ hơn 2% / 3% / 5% | Thiết Chùy, Huyền Thiết Chùy, Bách Luyện Chùy |
| Liềm | Tu dược | Sản lượng thu tay ở mỏ dược +2% / +3% / +4% | Thiết Liêm, Thải Dược Liêm, Ngọc Cốt Liêm |
| Bàn tính | Tu kim tiền | Lợi nhuận bán trên chợ +1% / +2% / +3% | Mộc Bàn Tính, Kim Châu Bàn Tính, Thông Bảo Bàn Tính |

- Trần kinh tế từ đồ: pháp khí cộng hiệu ứng kinh tế của set không quá +10% mỗi loại sản lượng hay tỷ lệ. Tỷ lệ luyện đan tính chung trần +15% của phù (mục 13).
- Lục bán ở shop NPC, lam rèn ở Luyện Khí Các, tím rèn ở lò cấp 5 trở lên hoặc rơi ở bí cảnh có thế mạnh cùng nghề. Mã PK-\<loại>-001 tới 003.
- Hình dùng lại hình vũ khí theo tài năng khi trùng (trận bàn, búa rèn, liềm, bàn tính), đỡ phải vẽ thêm.

## 11. Phù, đan và nguyên liệu rèn

Bổ sung các nhóm mà trang bị cần: 3 phù mới cho khảm và cường hóa, đủ 120 loại đan theo số đã ghi ở mục 12, và 13 nguyên liệu rèn mới. Danh sách đầy đủ của đan nằm ở sheet Đan của file số liệu (`data/he_thong/json/vat_pham.json`).

**Phù** (bán bằng linh thạch ở chợ; tổng tỷ lệ cộng từ phù tối đa +15%, mục 13):

| Mã | Tên | Tác dụng |
|---|---|---|
| PH-CH-001 | Tị Lôi Phù (phù chống sét) | Đỡ một phần lôi kiếp khi đột phá, thú kiếp, hộ pháp phi thăng |
| PH-CH-002 | Bảo Ngọc Phù | Nén ngọc thất bại không mất ngọc |
| PH-CH-003 | Bảo Hộ Phù | Cường hóa từ +21 thất bại giữ nguyên nấc |
| PH-CH-004 | Tăng Thành Phù | Cường hóa hoặc nén ngọc +5%, +10%, +15% theo phẩm |
| PH-CH-005 | Hộ Thân Phù | Giảm xác suất gặp sự kiện trên đường (mục 3) |
| PH-CH-006 | Độn Thổ Phù | Đưa về thành chủ ngay (mục 3) |
| PH-CH-007 | Ngự Thú Phù | Thuần phục +5%, +10%, +15% theo phẩm (mục 6) |
| PH-CH-008 | Thoát Khảm Phù (mới) | Gỡ ngọc, Ý châu hoặc ấn bộ mà vật gỡ ra còn nguyên |
| PH-CH-009 | Di Hồn Phù (mới) | Chuyển nấc cường hóa sang món khác cùng ô, giữ 70% số nấc, tối đa +20 |
| PH-CH-010 | Hộ Khí Phù (mới) | Lần chết kế tiếp, đồ đang mặc không mất độ bền |

Di Hồn Phù dừng ở +20 để nấc từ +21, vốn cần nguyên liệu khóa, không chuyển được; người chơi đổi đồ mới mà không mất trắng công cường hóa.

**Đan** (mã DA-DD, DA-LD, DA-TD; mã 001 tới 003 hoặc 004 giữ như danh mục icon):

| Nhóm | Số loại | Gồm | Nguồn và giao dịch |
|---|---|---|---|
| Đan dược, mỗi loại 5 cấp | 50 | 8 hồi máu, mana, khiên (Bổ Huyết, Hồi Khí, Đại Hoàn…); 15 tăng chỉ số một trận (Đại Lực, Thiết Bì, Ưng Nhãn, Cuồng Bạo…); 7 giải trừ (Giải Độc, Thanh Tâm, Trấn Hồn…); 12 đan kháng từng hệ (Tị Kim Đan tới Tị Hàn Đan); 8 ngoài trận (Hành Cước, Khai Sơn, Ngưng Hỏa, Tiếp Cốt…) | Luyện Đan Phòng; 4 loại cơ bản bán ở chợ NPC; đan phương rơi ở Đan Tiên Động Phủ. Bán được |
| Linh đan | 40 | 6 trị thương (Liệu Thương, Tục Cốt, Cố Bản…); 10 kinh nghiệm (Tụ Nguyên, 7 đan theo cảnh giới, Đồng Tâm, Truyền Công), chung giới hạn 3 viên mỗi ngày; 13 tu luyện (Tụ Linh, Ngưng Thần, Tụ Vi, Hộ Pháp…); 11 hành trình (Tị Chướng, Ngự Hàn, Khứnh Thân, Hộ Tống…) | Luyện Đan Phòng, đan phương ở Đan Tiên Động Phủ. Bán được |
| Thần đan | 30 | 7 đột phá cảnh giới (Phá Cảnh, Trúc Cơ, Kết Kim, Ngưng Anh, Hóa Thần, Hợp Thể, Độ Ách); 7 đột phá chiêu thức thượng vị (Ngộ Đạo, Phá Chướng tới Cửu Chuyển Kim Đan +5% tới +15%, Hỗn Nguyên); 12 Tâm Đan theo hệ; 4 lôi kiếp và thất bại (Tị Kiếp, Thiết Cốt, Dẫn Lôi, Tái Tạo) | Thiên Lôi Đài, luyện đan cấp 8–10 của người chơi. Khóa vào nhân vật (mục 13) |

Tổng tỷ lệ đột phá từ đan vẫn tối đa 80% như mục 7.

**Nguyên liệu rèn:**

| Mã | Tên | Dùng để | Nguồn |
|---|---|---|---|
| QU-BA-001 tới 004 | Thiết tinh, Huyền thiết, Tinh kim, Thần kim | Rèn và sửa, theo bậc vị diện (mục 12) | Mỏ quặng, Khoáng Mạch Động |
| NL-LK-001, 002 | Hạ phẩm, Trung phẩm Luyện Khí Thạch | Cường hóa +1 tới +10, +11 tới +20 | Chợ, rơi bí cảnh |
| NL-LK-003 | Thượng phẩm Luyện Khí Thạch | Cường hóa +21 tới +30; khóa (mục 13) | Luyện Khí Di Chỉ, Khoáng Mạch Động |
| NL-LK-004 | Cực phẩm Luyện Khí Thạch | Cường hóa +31 tới +50 ở Thần vực, Thánh vực; khóa | Luyện Khí Di Chỉ, Thượng Cổ Chiến Trường |
| NL-TB-001 | Tu Bổ Sa | Sửa đồ, đi cùng linh thạch và quặng | Chợ, Khoáng Mạch Động |
| NL-KM-001 | Khai Mạch Đinh | Kích hoạt 1 dòng khảm | Chợ, Luyện Khí Di Chỉ |
| NL-GL-001 | Yêu Thú Bì | Áo giáp, bao tay, giày | Săn dị thú, Thú Lâm |
| NL-GL-002 | Yêu Thú Cốt | Mũ | Săn dị thú, Thú Lâm |
| NL-GL-003 | Thiên Tằm Ti | Đạo bào, khăn | Linh Dược Viên, Dược Cốc |
| NL-GL-004 | Linh Mộc | Cán vũ khí, cung, cầm, tiêu, trận kỳ | Linh Dược Viên, Dược Cốc |
| NL-GL-005 | Vân Cẩm | Đai, dây ngọc bội | Chợ, Cổ Chiến Trường |
| NL-PB-001 | Pháp Bảo Phôi | Luyện pháp bảo; độ hiếm phôi là độ hiếm pháp bảo | Cổ Tông Di Tích, Luyện Khí Di Chỉ |
| NL-DB-001 | Thiên Ngoại Vẫn Thiết | Rèn lại món vàng, đỏ để quay lại 1–2 dòng khảm thêm của đồ bí cảnh | Thượng Cổ Chiến Trường, Hỗn Độn Bí Cảnh |

Mảnh lô đỉnh, mảnh lò rèn và mảnh pháp bảo trấn giáo giữ mã MA- như danh mục icon.

## 12. Giao dịch, khóa và mã mới

Thứ gắn với bậc mạnh nhất thì khóa vào nhân vật, đúng nguyên tắc "bậc mạnh nhất không mua được bằng linh thạch" ở mục 13. Còn lại bán được trên chợ bằng linh thạch, không bán thẳng bằng tiên ngọc.

| Vật phẩm | Bán trên chợ (đề xuất) | Khóa vào nhân vật |
|---|---|---|
| Trang bị lục | Không; mua và bán lại ở shop NPC | Không |
| Trang bị lam, tím | Được | Khi cường hóa từ +21 |
| Trang bị vàng, đỏ | Không | Khi nhận |
| Ngọc hệ | Cấp 1–6 | Từ cấp 7 (đã chốt) |
| Ý châu, pháp khí, phù, đan dược, linh đan | Được | Không |
| Ấn bộ | 17 bộ thường, khi chưa khảm | 3 bộ thần, khi nhận |
| Pháp bảo | Lục tới tím, khi chưa tế luyện | Khi tế luyện; vàng, đỏ khi nhận |
| Thần đan, Luyện Khí Thạch thượng và cực phẩm | Không | Khi nhận (mục 13) |

**Mã vật phẩm mới** (nối quy ước NHÓM-LOẠI-SỐ ở mục 12; mã cũ giữ nguyên):

| Mã | Nghĩa |
|---|---|
| PB-\<loại>-001… | Pháp bảo: TH thuẫn, LU luân, CH châu, TA tháp, HL hồ lô, KN kính, PN phiên, DI đỉnh, CU chuông, AN ấn, TG trấn giáo |
| PK-\<loại>-001… | Pháp khí: CU cuốc, LB la bàn, TB trận bàn, QP quạt lửa, AT ngọc ẩn tức, CR chùy rèn, LI liềm, BA bàn tính |
| NG-YC-001…010 | Ý châu, theo thứ tự khí hình ở phần 3 |
| NG-AN-001…020 | Ấn bộ, theo thứ tự bộ ở phần 7 |
| NL-\<loại>-001… | Nguyên liệu rèn: LK luyện khí thạch, TB tu bổ, KM khai mạch, GL giáp liệu, PB phôi pháp bảo, DB đặc biệt |
| DA-DD-005…050, DA-LD-004…040, DA-TD-004…030, PH-CH-008…010 | Đan và phù mới, nối tiếp số cũ |

Tổng cộng 687 mã kể cả 12 ngọc hệ, không trùng (phép kiểm trong `tools/data/xuat.ts`). Phiên icon thêm các món mới vào `assets/icon_ve/danh_sach.json` theo đúng các mã này.

## 13. Luyện khí sau cấp tối đa

Ở cấp tối đa, đồ đã chiếm khoảng 29% lực chiến trên trần 35%, nên phần này mở rộng theo chiều ngang: thêm lựa chọn, thêm thứ để thử và để sưu tầm, không thêm nhiều chỉ số (đề xuất 2026-11-04, theo yêu cầu người dùng). Cả lớp cộng tối đa khoảng 4 điểm lực chiến. Mỗi hệ thống là một vòng lặp riêng: đồ rơi không bao giờ vô dụng, tìm dòng phụ hợp lối đánh, nuôi món đồ mình thích, săn ngọc đỉnh, chế thần binh cùng tông môn, sưu tầm. Mọi số là đề xuất.

| Hệ thống | Mở | Vòng lặp |
|---|---|---|
| Phân giải | Từ cấp 20 | Đồ thừa thành Khí Tinh, nguyên liệu chung của cả lớp |
| Bảo Giám | Từ cấp 20 | Sưu tầm kiểu, đủ trang thì nhận thưởng ngoài chiến đấu |
| Tẩy luyện chỉ số phụ | Kết Đan (cấp 101) | Đổi dòng phụ cho hợp lối đánh, không mạnh hơn |
| Khí linh và khí văn | Hóa Thần (cấp 201), món từ tím | Nuôi món đồ qua trận đấu, mở khí văn đổi cách đánh |
| Hợp ngọc song hệ | Có ngọc cấp 7 | Một viên cho hai hệ |
| Ngọc Phách | Có ngọc cấp 10 | Săn viên đỉnh nâng trần mềm một hệ |
| Danh khí | Cấp 250 Hạ vị hoặc Trung vị, lò rèn cấp 9 | Chế thần binh có tên cùng tông môn |
| Tế luyện tầng pháp bảo | Trung vị | Pháp bảo thêm linh lực, hồi chiêu nhanh hơn chút ít |

**Phân giải và Khí Tinh.** Phân giải món từ lam trở lên ra Khí Tinh: lam 1, tím 3, vàng 10, đỏ 25, thêm 1 mỗi cấp khí linh. Ngọc, Ý châu, ấn đang khảm trả lại nguyên vẹn; 50% số nấc cường hóa trả lại thành Luyện Khí Thạch. Khí Tinh từ đồ khóa cũng khóa; từ đồ chưa khóa thì bán được bằng linh thạch.

**Tẩy luyện chỉ số phụ.** Mỗi ô có 4 loại chỉ số phụ cùng thang giá trị, nên tẩy luyện là đổi ngang. Người thường quay ngẫu nhiên trong 3 loại còn lại; Tu rèn chọn thẳng loại muốn, là đặc quyền mới của Tu rèn. Mỗi lần tốn 2 Khí Tinh và linh thạch đúng phẩm của vị diện: lục 50, lam 200, tím 500, vàng 1.500, đỏ 3.000.

| Ô | Loại 1 (mặc định) | Loại 2 | Loại 3 | Loại 4 |
|---|---|---|---|---|
| Vũ khí | Sát thương chí mạng +1,7% | Xuyên giáp +0,9% | Tốc đánh +0,9% | Hút máu +0,4% |
| Mũ | Mana tối đa +1,7% | Giảm hồi chiêu 0,4% | Thời gian khống chế +1,7% | Hiệu quả hồi máu và khiên +0,9% |
| Áo | Máu +1,3% | Khiên nhận +1,7% | Hồi máu nhận +0,9% | Thủ nội +0,9% |
| Đai | Hồi máu nhận +0,9% | Máu +0,9% | Hiệu quả hồi máu và khiên +0,9% | Khiên nhận +0,9% |
| Bao tay | Chí mạng +0,4% | Sát thương chí mạng +0,9% | Xuyên kháng +0,9% | Tốc đánh +0,4% |
| Giày | Tốc đánh +0,9% | Giảm hồi chiêu 0,4% | Thời gian khống chế +1,7% | Thủ ngoại +0,9% |
| Ngọc bội | Giảm hồi chiêu 0,4% | Mana tối đa +0,9% | Sát thương theo thời gian +1,7% | Xuyên kháng +0,9% |

Giá trị ở độ hiếm lục +0, nhân độ hiếm, cường hóa và thưởng bí cảnh như chỉ số phụ ở phần 2.

**Khí linh: tăng cấp đồ.**

- Món từ tím trở lên có khí linh cấp 0–9. Kinh nghiệm khí linh đến từ trận đấu (+1 mỗi trận món được mặc), lượt bí cảnh (+5) và Khí Tinh (1 viên = 10). Lên cấp k cần 100 × k, nên cấp 9 cần tổng 4.500.
- Mỗi cấp khí linh +0,5% chỉ số gốc của món, cộng vào cùng hệ số với cường hóa.
- Món có khí linh từ cấp 1 khóa vào nhân vật, vì kinh nghiệm khí linh là thời gian chơi (mục 13: không mua được thời gian).
- Cấp 3, 6, 9 mở một ô khí văn: tím tối đa 1, vàng 2, đỏ 3. Mở ô thì chọn 1 trong 3 khí văn quay ngẫu nhiên từ nhóm của ô; quay lại tốn 1 Linh Văn Thạch.
- Mỗi người chọn tối đa 3 khí văn đang kích, khác nhau, trong số khí văn có trên đồ đang mặc; mỗi khí văn tính 1 lần. Các ô còn lại để sưu tầm và đổi qua lại trước trận. Luật này thay luật "một khí văn tính tối đa 2 lần" ngày 2026-11-04, vì đo thấy 21 ô khí văn cùng kích cộng hơn 10% lực chiến. Tổng khí văn mục tiêu không quá khoảng 2% lực chiến, mỗi khí văn quanh 0,3–0,6% để không cái nào át các cái khác.

| Mã | Khí văn | Nhóm | Tác dụng |
|---|---|---|---|
| KV-CO-001 | Phá Thuẫn Văn | Công | Đòn đầu tiên lên mục tiêu đang có khiên +10% sát thương |
| KV-CO-002 | Truy Mệnh Văn | Công | Mục tiêu dưới 20% máu nhận thêm 5% sát thương |
| KV-CO-003 | Tiên Phát Văn | Công | Chiêu đầu tiên mỗi trận +15% sát thương |
| KV-CO-004 | Liên Kích Văn | Công | Đánh cùng mục tiêu 3 lần liên tiếp thì lần thứ 3 +8% sát thương |
| KV-CO-005 | Khắc Hệ Văn | Công | Đánh hệ mình khắc: hệ số ×1,5 thành ×1,53 |
| KV-CO-006 | Tụ Linh Văn | Công | Hạ gục kẻ địch thì hồi 3% mana |
| KV-CO-007 | Phá Trận Văn | Công | Sát thương lên trận nhãn, hộ trận +3% (chiến tranh) |
| KV-CO-008 | Liệp Yêu Văn | Công | Sát thương lên dị thú và boss PvE +4% |
| KV-TH-001 | Hộ Mệnh Văn | Thủ | Lần đầu máu dưới 25%: khiên 1,8% máu tối đa |
| KV-TH-002 | Ngự Khắc Văn | Thủ | Trúng đòn hệ khắc mình: hệ số ×1,5 thành ×1,47 |
| KV-TH-003 | Phản Chấn Văn | Thủ | Phản 3% sát thương cận chiến nhận được |
| KV-TH-004 | Thiết Bích Văn | Thủ | Đứng hàng trước: phòng thủ +3% |
| KV-TH-005 | Tĩnh Tâm Văn | Thủ | Đứng hàng sau: mana tối đa +3% |
| KV-TH-006 | Hồi Xuân Văn | Thủ | Hồi 1% máu mỗi 5 s |
| KV-TH-007 | Định Thân Văn | Thủ | Mỗi lần bị đẩy lùi chỉ bị đẩy một nửa quãng |
| KV-TH-008 | Tị Kiếp Văn | Thủ | Lôi kiếp gây ít hơn 5% sát thương (ngoài trận) |

Nhóm công dùng cho vũ khí, bao tay, ngọc bội; nhóm thủ cho mũ, áo, đai, giày. Khắc Hệ Văn và Ngự Khắc Văn chỉ làm khắc hệ rõ hơn hoặc mềm hơn một chút. Sàn khắc: sau mọi nguồn (kháng, bộ Hỗn Độn, Ngự Khắc Văn), hệ số khắc nhân với (1 − kháng) không dưới ×1,2.

**Khảm ngọc nâng cao.**

- **Hợp ngọc song hệ:** 2 viên cùng cấp, hai hệ tương sinh hoặc tương hợp, hợp thành 1 viên song hệ cùng cấp cho mỗi hệ 60% giá trị. Tỷ lệ đậu cố định 80%, không theo bảng nén, vì song hệ là đổi ngang chứ không lên cấp; thất bại mất 1 viên, Bảo Ngọc Phù giữ lại cả hai (phù tiêu 1 tấm mỗi lần dùng, đậu hay không cũng mất, như khi nén ngọc). Dành cho người mang công pháp hai hệ hoặc cần kháng hai hệ trong ít dòng; mỗi hệ vẫn tính trong trần mềm của hệ đó.
- **Ngọc Phách:** điểm hóa 1 viên cấp 10 với 20 Khí Tinh, tỷ lệ đậu 30% (thất bại mất Khí Tinh, giữ ngọc). Phách khảm vào ô công, cho 11% như ngọc cấp 10 và nâng trần mềm sát thương hệ đó từ 25% lên 28%. Mỗi hệ chỉ 1 Phách tính trần. 12 Phách: Canh Kim, Thanh Mộc, Huyền Thủy, Xích Diễm, Hậu Thổ, Tử Lôi, Thanh Phong, Diệu Quang, U Lãnh, Thuần Dương, Huyền Âm, Hàn Tủy. Phách khóa vào nhân vật.

**Danh khí: thần binh có tên.** Mỗi khí hình vũ khí có một danh khí, mã TB-KI-061…070, nên vũ khí lên 70 kiểu, vẫn trong khoảng 50–70. Luyện ở lò cấp 9 trở lên của tông môn theo đồ phổ rơi ở Thượng Cổ Chiến Trường và Hỗn Độn Bí Cảnh. Nguyên liệu: 1 vũ khí đỏ cùng khí hình làm phôi, 5 Thiên Ngoại Vẫn Thiết, 50 Khí Tinh. Một Tu rèn chủ lò và 3 thành viên hộ lò cùng tông. Lò cấp 9 thành 40%, cấp 10 thành 60%; thất bại mất Khí Tinh và Vẫn Thiết, giữ phôi và đồ phổ. Danh khí là vũ khí đỏ có sẵn "Ý" của khí hình mạnh bằng Ý châu (hạ từ 1,5 qua hai lần đo; lợi thế còn lại là danh văn và dòng khảm được giữ cho ngọc), không chiếm dòng khảm, cộng một danh văn riêng. Mỗi người chỉ mặc 1 danh khí; danh khí khóa vào nhân vật.

| Mã | Danh khí | Danh văn |
|---|---|---|
| TB-KI-061 | Thiên Vấn Kiếm | Cận chiến đơn chí mạng thì chiêu đó hồi chiêu nhanh 0,5 s |
| TB-KI-062 | Đoạn Nhạc Đao | Mỗi mục tiêu trúng quét từ thứ 3 trở đi cho người cầm khiên 1% máu tối đa |
| TB-KI-063 | Lạc Tinh Cung | Đòn tầm xa vào kẻ đang vận công +20% sát thương |
| TB-KI-064 | Phong Lôi Phiến | Diện rộng trúng từ 6 mục tiêu thì lần vận công kế tiếp nhanh gấp đôi |
| TB-KI-065 | Bất Động Côn | Khiên hộ thể của người cầm đỡ thêm 1 lần khống chế cho người được che |
| TB-KI-066 | Tạo Hóa Bút | Bùa chú thêm 1 lần mỗi trận, mỗi lần −15% sát thương |
| TB-KI-067 | Tinh La Kỳ | Trận pháp bày xong thì đồng đội đứng trong trận +5% phòng thủ trong 5 s |
| TB-KI-068 | Vọng Nguyệt Cầm | Hồi phục giải luôn 1 hiệu ứng thiêu đốt hoặc độc |
| TB-KI-069 | Ngọc Lâu Tiêu | Khống chế trúng kẻ đang vận công hoặc đang bày trận thì chiêu đó mất luôn, không hoàn hồi chiêu |
| TB-KI-070 | Phá Thiên Thương | Lướt tới xong, đòn kế tiếp xuyên 20% khiên |

**Bảo Giám.** Sổ ghi mọi kiểu nhân vật đã từng sở hữu, kể cả đã phân giải: 430 kiểu trang bị, 50 pháp bảo, 24 pháp khí, 10 Ý châu, 20 ấn bộ, 12 Phách. Đủ một trang (ví dụ đủ 60 kiểu mũ, đủ 5 màu một loại pháp bảo, đủ 20 ấn) thì nhận thưởng, không cộng chỉ số chiến đấu: trang vũ khí cho ánh sáng vũ khí; sáu ô đồ còn lại cho khung ô của ô đó; pháp bảo và Phách cho danh hiệu; pháp khí thêm ô kho; ấn bộ thêm ô túi; Ý châu cho Khí Tinh. Mỗi tuần một trang tuần ngẫu nhiên, ví dụ "mặc 3 món khí hình Cầm khác nhau", thưởng Linh Văn Thạch, để người ở cấp tối đa có lý do thử đồ mới.

**Tế luyện tầng pháp bảo.** Từ Trung vị, pháp bảo đã tế luyện lên được tầng 1–5: mỗi tầng linh lực tối đa +10%, hồi chiêu −2%; tầng k tốn 5 × k Khí Tinh. Hồi chiêu sau mọi nguồn không dưới 60% hồi chiêu gốc.

**Trần.** Khí linh cấp 9 trên 7 món thêm khoảng 0,8 điểm, khí văn tối đa khoảng 2 điểm, Ngọc Phách khoảng 0,5, danh khí so với vũ khí đỏ có Ý châu khoảng 0,5. Ở đỉnh: đồ 29% cộng Đạo Cơ Bàn và lớp này (tối đa khoảng 4 điểm) vẫn dưới trần 35%. Đo lần đầu 2026-11-04 (đỏ +50, đủ ngọc cấp 10): khí linh +0,9%, Phách +0,6%, danh khí +1,2%, khí văn hơn 10% (Hộ Mệnh riêng +4,2%), cả lớp +14,6% đưa đồ lên 36,6%, vượt trần. Đã sửa: mỗi người kích tối đa 3 khí văn, Hộ Mệnh 8% còn 3%, Ý của danh khí ×1,5 còn ×1,25. Đo lần 2: 3 khí văn mạnh nhất +2,2% (Hộ Mệnh riêng +1,0%), danh khí +1,1%, đồ ở đỉnh có cả lớp này 31,6%, dưới trần. Sửa lần 3: Hộ Mệnh còn 1,8% cho ngang các khí văn khác, Ý của danh khí bằng Ý châu; ngân sách khí văn nâng lên khoảng 2% vì tổng đồ còn xa trần và khí văn quá nhỏ thì người chơi không thấy. Đo lần 3 đạt: Hộ Mệnh +0,6%, ngang Phá Thuẫn, Tiên Phát, Hồi Xuân; 3 khí văn mạnh nhất cùng kích +1,8%; danh khí hơn vũ khí có Ý châu 0,3–0,7%; cả lớp luyện khí +4,5%. Đồ ở đỉnh (đỏ +50, ngọc cấp 10, 3 bộ mốc 4 có bàn đầy, khí linh 9, 3 khí văn, Phách, danh khí) chiếm 32,6% lực chiến, dưới trần 35%. Vượt thì giảm số, không bỏ luật.

**Mã mới:** NL-KT-001 Khí Tinh, NL-KT-002 Linh Văn Thạch, NL-DP-001…010 đồ phổ danh khí, NG-SH-001 song hệ ngọc, NG-PH-001…012 Ngọc Phách, TB-KI-061…070 danh khí, KV-CO và KV-TH cho khí văn. Khóa giao dịch: Phách, danh khí, đồ phổ và món đã dưỡng khí linh khóa vào nhân vật; Khí Tinh và Linh Văn Thạch từ đồ chưa khóa bán được bằng linh thạch.

## 14. Set đồ 2.0, hệ chỉ số đồ và bản đồ tương sinh tương khắc

### 14.1 Kiểm tra 20 bộ hiện có

20 bộ ở phần 7 chưa có "kiểu sức mạnh" rõ: mốc 2 chỉ cộng một chỉ số rất nhỏ, mốc 4 và 7 phần lớn là hành vi. Ấn không có bậc nên set không có đường phát triển, trong khi người chơi lên cấp tối đa nhanh và cần thứ để tối ưu (đánh giá 2026-11-05, theo yêu cầu người dùng). Phần 14 viết lại mốc 2 và 4 theo lộ sức mạnh, giữ mốc 7 đã làm và đã đo; bảng ở phần 7 là bản trước.

| Bộ | Nhóm cũ | Đo 7 món (2026-11-04) | Lộ mới |
|---|---|---|---|
| Bàn Thạch | Tài năng Tu thể | 5,1% (sau sửa) | Thủ Ngoại |
| Hỗn Độn | Hệ | 1,9% | Khắc chế |
| Văn Uyên | Tài năng Tu pháp | 1,4% | Nội Công |
| Linh Tuyền | Vai trò hồi phục | 1,4% | Hấp Thu |
| Ngọc Tủy | Hệ | 1,3% | Thủ Nội |
| Vạn Kiếm | Vai trò | 1,3% | Ngoại Công |
| Chu Thiên | Tài năng Tu trận | 1,2% | Thủ Nội |
| Thiết Kỵ | Vai trò tiền tuyến | 0,9% | Phản Chấn |
| Lôi Trì | Hệ | 0,9% | Ngoại Công |
| Băng Phách | Hệ | 0,5% | Khống Tốc |
| Huyết Ảnh | Tài năng Sát thủ | 0,5% | Hấp Thu |
| Độ Kiếp | Vai trò | 0,5% | Nội Công |
| Bách Thảo | Tài năng Tu dược | 0,4% | Hấp Thu |
| Phá Quân | Vai trò công thành | 0,3% | Ngoại Công |
| Liệp Thú | Vai trò săn thú | 0,2% (chưa có dị thú) | Ngoại Công |
| Cổ Tông | Vai trò pháp bảo | 0,0% | Hấp Thu (mana) |
| Tụ Bảo, Ngự Thú, Đan Tiên, Thiên Công | Kinh tế | Ngoài trận | Kinh tế |

- Cổ Tông gần như vô dụng; Bàn Thạch mạnh gấp nhiều lần các bộ khác.
- Chưa có phòng thủ nội, ngoại; chưa có giảm mana thi triển, hút mana, phản đòn, giảm sát thương nhận, hồi máu mỗi giây, nên chưa làm được các kiểu bộ người dùng mô tả.
- 4 bộ kinh tế dùng chung dòng khảm với bộ chiến đấu. Giữ nguyên, vì đó là lựa chọn thật.

### 14.2 Hệ chỉ số đồ

**Thủ ngoại và thủ nội (người dùng chốt 2026-11-05, ghi ở mục 8 tab chính).**

- Mỗi loại chiêu gây một loại sát thương. Ngoại: cận chiến đơn, cận chiến quét, thân pháp, tầm xa. Nội: diện rộng, bùa chú, trận pháp, khống chế. Hồi phục không gây sát thương.
- Đòn ngoại giảm theo thủ ngoại, đòn nội giảm theo thủ nội, cùng công thức phòng thủ hiện nay. Xuyên giáp bỏ qua một phần phòng thủ đúng loại của đòn.
- Phòng thủ gốc của nhân vật tách thành thủ ngoại bằng thủ nội bằng phòng thủ chuẩn cũ, nên trận không đồ không đổi.
- Đồ: áo chính "Phòng thủ +4%" thành "Thủ ngoại +3%"; giày chính "Phòng thủ +2%" thành "Thủ nội +3%", tổng giữ 6%. Bảng tẩy luyện ở phần 13: loại 4 của giày thành "Thủ ngoại +1%", loại 4 của áo thành "Thủ nội +1%".

**Chỉ số mới** (để làm được các kiểu bộ người dùng mô tả): thủ ngoại, thủ nội, giảm mana thi triển, hút mana (mỗi đòn rút một phần mana tối đa của mục tiêu về mình), phản đòn (phản một phần sát thương cận chiến nhận), giảm sát thương nhận (sau phòng thủ), hồi máu mỗi giây (theo máu tối đa), sát thương chiêu nội; thêm sau lần đo 2026-11-05: giảm sát thương ngoại nhận và giảm sát thương nội nhận (chỉ với đúng loại đòn, sau phòng thủ; tổng giảm sát thương nhận của một loại đòn tối đa 25%).

**Sáu lớp chỉ số của một món:**

| Lớp | Gồm |
|---|---|
| Gốc | Chỉ số chính và phụ theo ô, độ hiếm (phần 2) |
| Rèn | Cường hóa +3% mỗi nấc, khí linh +0,5% mỗi cấp, dòng rèn |
| Phụ | Loại chỉ số phụ chọn bằng tẩy luyện (phần 13) |
| Khảm | Ngọc hệ, Ý châu, ấn bộ, binh ấn |
| Ẩn | Dòng ẩn của trang sức (phần 14.5) |
| Bộ | Mốc set, hợp bộ, Đạo Cơ Bàn, binh bộ |

**Dòng rèn.** Cường hóa lên +10, +20, +30 (và +40, +50 ở Thần, Thánh vực) mở một dòng rèn: chọn 1 trong 4 loại chỉ số phụ của ô, giá trị 15% (hạ từ 50% sau lần đo 2026-11-05) loại đó. Đổi dòng rèn tốn 2 Khí Tinh. Tối đa 3 dòng ở Hạ, Trung vị, 5 dòng ở Thần, Thánh vực. Tụt nấc dưới mốc thì dòng đó tạm tắt. Cường hóa vì vậy có mốc để mong, không chỉ là cộng %.

**Điểm trang bị.** Mỗi chỉ số quy ra điểm theo phần đóng góp vào lực chiến; điểm món bằng tổng sáu lớp, điểm nhân vật bằng tổng 7 món cộng bộ. Dùng để so sánh, gợi ý thay đồ và lọc trên chợ; không dùng trong trận. Trọng số đề xuất, điểm mỗi 1%:

| Nhóm | Chỉ số và điểm |
|---|---|
| Công | Công lực 10 · Chí mạng 12 · Sát thương chí mạng 3 · Tốc đánh 10 · Giảm hồi chiêu 12 · Xuyên giáp, xuyên kháng 6 · Sát thương chiêu nội 8 · Sát thương hệ 4 |
| Thủ | Máu 8 · Thủ ngoại, thủ nội 5 · Giảm sát thương nhận 12 · Giảm sát thương ngoại nhận, nội nhận 6 · Phản đòn 6 · Khiên nhận 3 · Kháng hệ 3 |
| Hồi, mana | Hút máu 15 · Hút mana 8 · Hồi máu mỗi giây 10 mỗi 0,1% · Hồi máu nhận, hiệu quả hồi và khiên 4 · Giảm mana thi triển 4 · Mana tối đa 2 |
| Khống | Thời gian khống chế 3 |

### 14.3 Bậc ấn và nguồn

Ấn bộ có bậc. Bậc là thuộc tính của từng viên; mã ấn giữ NG-AN-001…020.

| Bậc ấn | Hệ số mốc 2, 4 | Nguồn | Giao dịch |
|---|---|---|---|
| Lục | 0,6 | Shop NPC; shop còn bán "bộ trọn" 7 món lục có sẵn ấn | Không bán lại trên chợ |
| Lam | 0,8 | Chợ người chơi; quái thường, bí cảnh | Bán được |
| Tím | 1,0 | Boss của bí cảnh nguồn bộ đó, dị thú | Bán được |
| Vàng | 1,1 | Boss dị thú Linh, Huyền, Thiên; boss liên minh cuối tuần | Khóa |
| Đỏ | 1,2 | Thần thú Tứ Tượng, boss Hỗn Độn Bí Cảnh | Khóa |

- Hệ số của một bộ lấy theo bậc thấp nhất trong các ấn đang tính cho bộ đó. Mốc 7 chỉ mở khi cả 7 ấn từ tím trở lên.
- Ghép ấn: 3 ấn cùng bộ, cùng bậc thành 1 ấn bậc trên, chỉ từ lục lên lam và lam lên tím. Vàng, đỏ chỉ rơi.
- 3 bộ thần (Chu Thiên, Phá Quân, Hỗn Độn) chỉ có từ tím.
- Luật này thay luật cũ "17 bộ bán được, 3 bộ thần khóa" ở phần 7.
- Đường đi của người chơi: mua bộ trọn lục ở shop để có ngay mốc 2 và 4; mua hoặc ghép lên lam, tím; đánh boss để đủ 7 ấn tím mở mốc 7; sau đó săn vàng, đỏ để đẩy hệ số.

### 14.4 Tám lộ sức mạnh và 20 bộ

Mỗi bộ thuộc một lộ, tức một kiểu sức mạnh. Mốc 2 và 4 viết lại theo lộ; mốc 7 giữ như bảng phần 7.

| Lộ | Kiểu sức mạnh |
|---|---|
| Ngoại Công | Dồn sát thương ngoại: chí mạng, xuyên giáp, tốc đánh |
| Nội Công | Chiêu nội: mana, giảm mana thi triển, sát thương chiêu nội |
| Thủ Ngoại | Máu, thủ ngoại, hồi máu mỗi giây |
| Thủ Nội | Thủ nội, mana, giảm mana thi triển; đổi lại công lực giảm |
| Hấp Thu | Hồi phục, hút máu, hút mana |
| Phản Chấn | Giảm sát thương nhận, phản đòn |
| Khống Tốc | Thời gian khống chế, tốc độ |
| Kinh tế và Khắc chế | Ngoài trận; khắc hệ |

Giá trị ghi ở bậc tím (×1,0). "Giữ" là giữ như bảng phần 7.

| Bộ | Lộ | Hệ ấn | Mốc 2 | Mốc 4 |
|---|---|---|---|---|
| Vạn Kiếm | Ngoại Công | Kim | Công lực +3% | Xuyên giáp +4%; cận chiến đơn vào mục tiêu dưới 30% máu +15% |
| Lôi Trì | Ngoại Công | Lôi | Chí mạng +3% | Sát thương chí mạng +8%; tê liệt khi chí mạng +0,25 s |
| Liệp Thú | Ngoại Công | Phong | Tốc đánh +3% | Chí mạng +2%; sát thương lên dị thú và boss PvE +8% |
| Phá Quân | Ngoại Công | Cực dương | Xuyên giáp +2%; sát thương lên trận nhãn +5% | Đòn phá trận đầu ×1,5 |
| Văn Uyên | Nội Công | Quang | Mana tối đa +4% | Giảm mana thi triển 4,5%; sát thương chiêu nội +2% |
| Độ Kiếp | Nội Công | Lôi | Kháng Lôi +4% | Bùa chú giảm mana thi triển 15%; lần bùa cuối không tốn mana |
| Bàn Thạch | Thủ Ngoại | Thổ | Máu +1% | Giảm sát thương ngoại nhận 13%; hồi 0,1% máu mỗi giây |
| Ngọc Tủy | Thủ Nội | Thủy | Thủ nội +2% | Giảm sát thương nội nhận 15%; giảm mana thi triển 5%; công lực −3% |
| Chu Thiên | Thủ Nội | Thổ | Bày trận nhanh 0,5 s; giảm sát thương nội nhận 2% | Giảm sát thương nội nhận 8%; trận đặt vào chỗ đông địch nhất |
| Bách Thảo | Hấp Thu | Mộc | Hồi máu nhận +6%; thời gian bị khống chế −50%; hồi 0,2% máu mỗi giây | Hồi thêm 0,1% máu mỗi giây (cả bộ 0,3%); mỏ dược +5% |
| Linh Tuyền | Hấp Thu | Thủy | Hiệu quả hồi máu và khiên +4% | Hồi phục chỉ giảm hồi mana 10% khi vận; thủ nội +2% |
| Huyết Ảnh | Hấp Thu | Cực âm | Hút máu +3,5% | Sát thương chí mạng +5%; thân pháp lộ vị trí 2 s |
| Cổ Tông | Hấp Thu | Âm lãnh | Hút mana: mỗi đòn rút 1% mana tối đa của mục tiêu | Pháp bảo hồi chiêu −15%; mỗi lần pháp bảo kích hoạt hồi 5% mana |
| Thiết Kỵ | Phản Chấn | Phong | Giảm sát thương ngoại nhận 7% | Phản 30% sát thương cận chiến nhận; giảm sát thương nhận thêm 1% |
| Băng Phách | Khống Tốc | Cực hàn | Thời gian khống chế +20%; tốc đánh +3% | Khống chế liên tiếp còn 75%; khống chế trúng mục tiêu đang vận công hoặc bày trận thì hủy chiêu đó (vào hồi chiêu như đã dùng) và đốt 30% mana tối đa của mục tiêu; thủ nội +2% |
| Hỗn Độn | Khắc chế | Không hệ | Kháng mọi hệ +2% | Trúng hệ khắc mình ×1,4 |
| Tụ Bảo | Kinh tế | Kim | Giữ | Giữ |
| Ngự Thú | Kinh tế | Mộc | Giữ | Giữ |
| Đan Tiên | Kinh tế | Hỏa | Giữ | Giữ |
| Thiên Công | Kinh tế | Hỏa | Giữ | Giữ |

Bốn kiểu người dùng nêu đều có bộ: Ngọc Tủy (thủ nội, mana, giảm mana thi triển, đổi lại công lực giảm); Bàn Thạch (máu, thủ ngoại, hồi máu); Bách Thảo, Huyết Ảnh, Cổ Tông (hồi, hút máu, hút mana); Thiết Kỵ (giảm sát thương nhận, phản đòn).

### 14.5 Hợp bộ, binh bộ và dòng ẩn

**Hợp bộ: set tương sinh, tương khắc.** Mặc cùng lúc từ 2 bộ đang kích (đủ mốc 2) thì mỗi cặp bộ xét quan hệ hệ ấn theo bảng tổ hợp mục 9. Không cần Đạo Cơ Bàn; bàn chỉ nâng hệ số lên.

| Quan hệ hai ấn | Không trên bàn (hợp bộ) | Đặt kề trên Đạo Cơ Bàn (cộng hưởng) |
|---|---|---|
| Thuần (cùng hệ) | Mốc 2 ×1,1 | ×1,25; kháng hệ đó +3% |
| Tương sinh, tương hợp | Mốc 2 ×1,2 | ×1,5 |
| Đối cực | Mốc 2 ×1,3; mana tối đa −2% | ×2; mana tối đa −2% |
| Trung tính | ×1,0 | ×1,0 |
| Tương khắc | Mốc 2 ×0,8 | Mạch đứt; ×0,8 |

- Mỗi bộ lấy hệ số tốt nhất của nó (cộng hưởng trên bàn thay hợp bộ nếu cao hơn), rồi nhân thêm ×0,8 nếu có bất kỳ bộ đang kích nào khắc nó.
- Chọn bộ vì vậy phải xem hệ: hai bộ khắc nhau làm yếu nhau.

**Binh bộ: set vũ khí.**

- 6 binh ấn (NG-BA-001…006), chỉ khảm vào 3 ô công: vũ khí, bao tay, ngọc bội. Bậc, hệ số và nguồn như ấn bộ.
- Mốc 2 (2 món) và mốc 3 (đủ 3 món). Mỗi người 1 binh bộ. Binh ấn chiếm dòng khảm, tranh chỗ với ngọc, Ý châu và ấn bộ.
- Đồng lộ: binh bộ cùng lộ với một bộ đang kích thì mốc 3 ×1,2.

| Binh bộ | Lộ | Mốc 2 | Mốc 3 |
|---|---|---|---|
| Bạo Kích | Ngoại Công | Chí mạng +2% | Sát thương chí mạng +10% |
| Xuyên Phá | Ngoại Công | Xuyên giáp +3% | Xuyên kháng +3%; xuyên giáp thêm +2% |
| Liên Kích | Ngoại Công | Tốc đánh +4% | Giảm hồi chiêu 3% |
| Pháp Nguyên | Nội Công | Giảm mana thi triển 4% | Sát thương chiêu nội +2,5% |
| Hấp Hồn | Hấp Thu | Hút máu +1,5% | Hút mana 0,5% mỗi đòn; sát thương phản đòn nhận vào −60% |
| Trấn Thủ | Thủ Ngoại, Thủ Nội, Phản Chấn (đồng lộ với cả ba) | Khiên nhận +3% | Thủ ngoại +1,5%; thủ nội +1,5% |

**Trang sức và dòng ẩn.**

- Trang sức là ngọc bội và đai, hai món đeo không hiện trên người.
- Số dòng ẩn theo độ hiếm: lam 1, tím 2, vàng 3, đỏ 3. Mỗi dòng ẩn là 1 điều kiện kích phát cộng 1 hiệu ứng, quay ngẫu nhiên khi món rơi hoặc rèn ra.
- Dòng ẩn hiện "???" tới lần đầu kích phát trong trận; từ đó lộ hẳn và ghi vào Bảo Giám, trang Ẩn văn (144 cặp).
- Giám Định Phù (PH-CH-011, mới) lộ trước điều kiện của 1 dòng. Tẩy ẩn: 3 Linh Văn Thạch quay lại hiệu ứng, giữ điều kiện.
- Song ẩn: ngọc bội và đai có dòng ẩn cùng điều kiện thì khi kích phát cả hai hiệu ứng ×1,25 (hạ từ ×1,5 sau lần đo 2026-11-05).
- Trần: mỗi dòng tối đa khoảng 0,3% lực chiến; tổng dòng ẩn khoảng 1%.

**Hệ số theo nhóm điều kiện (sau lần đo 2026-11-05).** Điều kiện tĩnh gần như luôn đúng ở cuối game, nên hiệu ứng của chúng chỉ còn ×0,2: DK-001, 002, 003, 009, 010, 011. Điều kiện theo loại trận ×0,25 (hạ từ ×0,5 sau lần đo 2): DK-004, 005, 012. Điều kiện trong trận ×0,3 (hạ từ ×1,0 sau lần đo 2): DK-006, 007, 008. Mỗi người có tối đa 3 dòng ẩn hiệu lực cùng lúc; hơn 3 dòng đúng điều kiện thì lấy 3 dòng có điểm trang bị cao nhất sau hệ số. 6 dòng của đồ đỏ vì vậy có giá trị khi điều kiện khác nhau và nối nhau trong trận (10 giây đầu, máu dưới 50%, sau giây 30), chứ không cộng dồn.

**Trang Ẩn văn trong Bảo Giám** (đề xuất, như các trang khác ở phần 13: không cộng chỉ số chiến đấu). Mỗi cặp điều kiện và hiệu ứng lộ lần đầu được ghi một lần.

| Trang | Đủ khi | Thưởng |
|---|---|---|
| Ẩn văn nhập môn | Lộ 24 cặp bất kỳ | 2 Giám Định Phù |
| Một trang cho mỗi điều kiện (12 trang) | Đủ 12 hiệu ứng của điều kiện đó | 3 Linh Văn Thạch (đủ một lần tẩy ẩn) |
| Ẩn văn toàn thư | Đủ 144 cặp | Danh hiệu Ẩn Văn Thông Giám; khung ô ngọc bội và đai kiểu ẩn văn |

| Mã | Điều kiện kích phát | Mã | Hiệu ứng |
|---|---|---|---|
| DN-DK-001 | Đang mặc từ 4 món cùng một bộ | DN-HU-001 | Công lực +3% |
| DN-DK-002 | Hai ngọc trên món này tương sinh nhau | DN-HU-002 | Thủ ngoại +4% |
| DN-DK-003 | Linh căn trùng hệ một ngọc trên món này | DN-HU-003 | Thủ nội +4% |
| DN-DK-004 | Trận PvE (dị thú, boss) | DN-HU-004 | Chí mạng +2% |
| DN-DK-005 | Trận chiến tranh địa bàn | DN-HU-005 | Hút máu +1% |
| DN-DK-006 | Máu dưới 50% | DN-HU-006 | Giảm mana thi triển 5% |
| DN-DK-007 | 10 giây đầu trận | DN-HU-007 | Hồi 0,2% máu mỗi giây |
| DN-DK-008 | Sau giây thứ 30 | DN-HU-008 | Phản 3% sát thương cận chiến |
| DN-DK-009 | Đứng hàng trước | DN-HU-009 | Giảm sát thương nhận 2% |
| DN-DK-010 | Đứng hàng sau | DN-HU-010 | Tốc đánh +2% |
| DN-DK-011 | Khí linh của món từ cấp 3 | DN-HU-011 | Giảm hồi chiêu 2% |
| DN-DK-012 | Đội địch có hệ khắc linh căn mình | DN-HU-012 | Kháng hệ khắc mình +3% |

Hai cột ghi chung một bảng cho gọn; điều kiện và hiệu ứng quay độc lập, không đi theo hàng.

### 14.6 Bản đồ tương sinh tương khắc

Hai lớp. Lớp lộ là đối đầu giữa hai người: khắc nảy ra từ chỉ số (thủ ngoại chỉ chặn đòn ngoại, phản đòn chỉ phản cận chiến), không cần hệ số riêng. Lớp hệ là quan hệ giữa các bộ trên cùng một người: hợp bộ và Đạo Cơ Bàn nhân mốc 2 theo hệ ấn.

*[Hình nhúng: khắc chế giữa 7 lộ chiến đấu · 10 mũi tên — xem bản gốc trên Claude Docs]*

Nên ghép trên một người: Thủ Ngoại với Hấp Thu (đỡ rồi hồi), Nội Công với Thủ Nội (cùng xoay quanh mana), Ngoại Công với Khống Tốc (giữ mục tiêu để dồn). Hệ chen vào lớp lộ: Cực âm (giảm hồi) khắc Hấp Thu; Kim (xuyên giáp) khắc Thủ Ngoại. Bộ vũ khí (binh bộ) đi theo lộ nên cũng nằm trong lớp này.

*[Hình nhúng: 20 bộ trên vòng Ngũ Hành · sinh, khắc, đối cực — xem bản gốc trên Claude Docs]*

Ví dụ: Bàn Thạch (Thổ) với Vạn Kiếm (Kim) là Thổ sinh Kim, mốc 2 của cả hai ×1,2. Thêm Thiết Kỵ (Phong, tính như Mộc): Mộc khắc Thổ và Kim khắc Mộc, nên Bàn Thạch còn ×1,2 × 0,8, Thiết Kỵ ×0,8, Vạn Kiếm giữ ×1,2.

### 14.7 Ngân sách trần và mã mới

Trần 35% lực chiến của đồ giữ nguyên, chia lại cho các lớp mới:

| Lớp | Ngân sách ở đỉnh |
|---|---|
| Gốc + rèn (cường hóa, khí linh, dòng rèn), đỏ +50 | khoảng 22% |
| Ngọc khảm | khoảng 3,5% |
| Ấn bộ, hợp bộ, Đạo Cơ Bàn | khoảng 3% |
| Binh bộ | khoảng 1,5% |
| Dòng ẩn | khoảng 1% |
| Khí văn, Ngọc Phách, danh khí | khoảng 4% |
| Tổng | 35% |

Đỏ +50 không ngọc đang đo 24,9%. Thêm dòng rèn, binh bộ và dòng ẩn thì phải hạ chỉ số gốc 7 ô khoảng ×0,85; phiên Sprint đo rồi chốt số.

**Đo lần 1 (2026-11-05, phiên Sprint, 200 cặp đội).** Đỏ +50 có đủ mọi lớp lên 42,7%, vượt trần. Hai lớp vượt ngân sách: dòng rèn +8% (gốc + rèn 29,2%) và dòng ẩn +4,3% (6 dòng song ẩn tới +9,3%). Các lớp khác trong ngân sách: ngọc 3,5%, ấn bộ và hợp bộ và bàn 2,5%, binh bộ 1,2%, luyện khí 2,1%. Sửa: chỉ số gốc ×0,85; dòng rèn 50% còn 15% (gốc + rèn khoảng 22%); dòng ẩn theo nhóm điều kiện, tối đa 3 dòng cùng lúc, song ẩn ×1,25. Ước còn khoảng 32%, chờ đo lại. Xuyên giáp từ đồ cộng vào mọi công pháp, không riêng hệ Kim.

**Vòng khắc 7 lộ, đo lần 1.** Chưa thành: Thủ Ngoại thắng cả 6 lộ (trung bình 68%) nhờ máu, hồi máu và hóa đá, không nhờ thủ ngoại. Thủ +4–5% gần như không tạo khắc vì công thức phòng thủ làm mòn phần thêm; phản 5% và khống chế +5% quá nhỏ. Đạt 3 cặp (Ngoại Công thắng Thủ Nội 58,5%, Ngoại Công thắng Hấp Thu 61%, Nội Công thắng Phản Chấn 63%); 5 cặp ngược hướng. Sửa ở phần 14.4: bộ thủ dùng giảm sát thương ngoại nhận hoặc nội nhận 8–10% thay thủ +4–5% ở mốc 4; Bàn Thạch hồi 0,1% mỗi giây; Thiết Kỵ phản 12%; Băng Phách khống chế +15% và thêm 0,5 s lên mục tiêu đang vận công. Mục tiêu mỗi cặp khắc 55–65% cho bên khắc, không lộ nào thắng tất cả.

**Đo lần 2 (2026-11-05, phiên Sprint, 200 cặp).** Ngân sách đạt: đỉnh 33,7% (gốc + rèn 22,9; ngọc 4,3; ấn, hợp bộ, bàn 2,5; binh bộ 0,7; dòng ẩn tĩnh 0,8; luyện khí 2,5). Dòng ẩn trong trận còn vượt: 6 dòng nối nhau +3,6%, nên nhóm trong trận hạ còn ×0,3 và nhóm theo loại trận còn ×0,25. Vòng khắc vẫn chưa thành vì sức mạnh bộ và binh bộ của mỗi lộ chênh nhau (bậc tím, so với cùng đồ không ấn): Thủ Ngoại +9,1%, Nội Công +6,8%, Thủ Nội +5,5%, Ngoại Công +3,8%, Khống Tốc +3,4%, Phản Chấn +3,2%, Hấp Thu +2,8%. Thủ Ngoại trung bình 70,5%, thắng cả 6 lộ.

**Cân lộ (bước 1, đề xuất).** Đưa mọi lộ về khoảng +4,5% (ngân sách ấn 3 cộng binh bộ 1,5). Cắt chỉ số chung, giữ chỉ số khắc, trừ Thủ Ngoại vì nó thắng Ngoại Công quá xa (75,7%).

| Lộ | Đo | Sửa |
|---|---|---|
| Thủ Ngoại | +9,1% | Bàn Thạch mốc 4 giảm sát thương ngoại nhận 10% còn 6%; mốc 7 hóa đá 0,5 s thành khiên 6% máu tối đa trong 3 s |
| Nội Công | +6,8% | Văn Uyên mốc 4 giảm mana thi triển 6%, sát thương chiêu nội +2%; Pháp Nguyên mốc 2 giảm mana 4%, mốc 3 chiêu nội +2,5% |
| Thủ Nội | +5,5% | Ngọc Tủy mốc 4 mana +3%, giảm mana thi triển 5%; giữ giảm sát thương nội nhận 10% |
| Ngoại Công | +3,8% | Vạn Kiếm mốc 2 công lực +3%; Bạo Kích mốc 3 sát thương chí mạng +10% |
| Khống Tốc | +3,4% | Băng Phách mốc 2 khống chế +20%; mốc 4 hủy chiêu đang vận công hoặc bày trận và đốt 10% mana; mốc 7 tính cả mục tiêu bị khống chế, bỏ điều kiện hệ; Liên Kích mốc 2 tốc đánh +4% |
| Phản Chấn | +3,2% | Thiết Kỵ mốc 2 giảm sát thương nhận 3%, mốc 4 phản 15%; Trấn Thủ tính đồng lộ với Phản Chấn |
| Hấp Thu | +2,8% | Huyết Ảnh mốc 2 hút máu +2,5%; Bách Thảo mốc 2 hồi máu nhận +6%; Hấp Hồn mốc 2 hút máu +1,5% |

Bước 2, sau khi đo lại: chỉnh các chỉ số khắc (phản đòn, giảm sát thương theo loại đòn, khống chế) cho từng cặp vào 55–65%.

**Đo lần 3 (2026-11-05, sau cân lộ bước 1).** 6/7 lộ nằm trong ±1 điểm quanh +4,5% (Ngoại Công 4,7; Nội Công 5,3; Thủ Ngoại 5,0; Thủ Nội 4,3; Phản Chấn 4,1; Khống Tốc 5,3); Hấp Thu 3,4 hơi thấp. Đỉnh 34,5%, dưới trần; dòng ẩn trong trận +0,8%, đạt. Không lộ nào trung bình trên 60%. Vòng khắc đạt 4/10 cặp khi công pháp theo lộ và 2/10 khi hai bên cùng công pháp. Bộ 3 món chỉ có mốc 2, nên chỉ số khắc ở mốc 4 thường vắng trong cách ghép bộ 4 cộng bộ 3; bước 2 vì vậy đưa một phần chỉ số khắc xuống mốc 2 và binh bộ.

**Cân khắc (bước 2, đề xuất).** Chỉ đổi chỉ số khắc.

| Cặp chưa đạt | Đo: theo lộ / cùng công pháp | Sửa |
|---|---|---|
| Thủ Ngoại khắc Ngoại Công | 45,7 / 57,6 | Bàn Thạch mốc 4 giảm sát thương ngoại nhận 6% lên 9% |
| Thủ Nội khắc Nội Công | 45,6 / 47,2 | Ngọc Tủy mốc 4 giảm sát thương nội nhận 10% lên 15%; Chu Thiên mốc 2 thêm giảm sát thương nội nhận 4% |
| Phản Chấn khắc Ngoại Công | 46,0 / 53,4 | Thiết Kỵ mốc 4 phản 15% lên 22% |
| Hấp Thu khắc Phản Chấn | 50,5 / 50,5 | Hấp Hồn mốc 3 thêm sát thương phản đòn nhận vào −50% |
| Hấp Thu khắc Khống Tốc | 42,1 / 42,1 | Bách Thảo mốc 2 thêm thời gian bị khống chế −20%; Huyết Ảnh mốc 2 hút máu 2,5% lên 3,5% (Hấp Thu thêm khoảng 1 điểm) |
| Khống Tốc khắc Nội Công | 48,0 / 52,2 | Băng Phách mốc 4 đốt mana 10% lên 20% |

Hai chỉ số mới: giảm thời gian bị khống chế (3 điểm trang bị mỗi 1%) và giảm sát thương phản đòn nhận (1 điểm mỗi 1%).

**Đo lần 4 (2026-11-05, sau cân khắc bước 2).** Đỉnh 34,7%, đạt. 7 lộ: Ngoại Công 4,7; Nội Công 5,3; Thủ Ngoại 5,7; Thủ Nội 6,1; Hấp Thu 4,1; Phản Chấn 4,3; Khống Tốc 5,1 (Thủ Ngoại và Thủ Nội vượt ±1). Đạt 4/10 cặp khi công pháp theo lộ.

**Tiêu chí đo (chốt 2026-11-05).** Bốn cặp khắc theo loại đòn (Thủ Ngoại với Ngoại Công, Thủ Nội với Nội Công, Ngoại Công với Thủ Nội, Nội Công với Thủ Ngoại) chỉ xét khi đội công mang đúng loại đòn của lộ mình, vì người chọn lộ Ngoại Công sẽ dùng chiêu ngoại. Sáu cặp còn lại xét cả khi công pháp theo lộ lẫn khi hai bên cùng công pháp. Thêm bản đo thứ ba: mỗi lộ mang công pháp đúng lộ, Khống Tốc mang ít nhất 1 công pháp Khống chế. Đạt khi ít nhất 8/10 cặp vào 55–65% theo tiêu chí trên, không lộ nào trung bình trên 60%, và 7 lộ trong ±1 quanh +4,5%.

**Bước 3 (đề xuất).**

| Mục tiêu | Sửa |
|---|---|
| Đưa Thủ Ngoại, Thủ Nội về ±1 | Bàn Thạch mốc 2 máu +3% còn +2%; Ngọc Tủy mốc 2 thủ nội +4% còn +2%, mốc 4 bỏ mana +3% |
| Thủ Ngoại khắc Ngoại Công (51,2) | Bàn Thạch giảm sát thương ngoại nhận 9% lên 12% |
| Thủ Nội khắc Nội Công (50,2) | Ngọc Tủy giảm sát thương nội nhận 15% lên 18% |
| Phản Chấn khắc Ngoại Công (47,5) | Thiết Kỵ phản 22% lên 30%; Hấp Hồn giảm phản đòn nhận vào 50% lên 60%, để Hấp Thu vẫn khắc Phản Chấn |
| Hấp Thu khắc Khống Tốc (41,3) | Bách Thảo mốc 2 thời gian bị khống chế −30% và hồi 0,2% máu mỗi giây; mốc 4 còn hồi thêm 0,1% (cả bộ vẫn 0,3%) |
| Khống Tốc khắc Nội Công (48,2) | Giữ số; đo lại ở bản thứ ba khi Khống Tốc mang công pháp Khống chế |

**Đo lần 5 (2026-11-05, sau bước 3).** Đỉnh 34,7%, đạt. 9/10 cặp khắc đúng chiều ở ít nhất một cách đo, nhưng chỉ khoảng 2/10 cặp vào hẳn 55–65%; nhiều cặp kẹt ở 50–55%. Không lộ nào trung bình trên 60%. Thủ Ngoại 6,2 và Thủ Nội 6,7 còn vượt ±1, vì đội thường gây cả hai loại đòn, nên giảm sát thương theo loại vẫn chặn được khoảng nửa. Khi lộ công chỉ mang đúng loại đòn, ba cặp khắc theo loại đòn lại quá mạnh (66; 72,8; 68,8).

**Phát hiện ngoài set.** Đội chỉ mang chiêu nội (diện rộng, bùa chú, trận pháp, khống chế) thắng trung bình 34,9%, thua đội chỉ mang chiêu ngoại khoảng 20–80. Phần lệch còn lại của vòng khắc vì vậy nằm ở cân bằng 10 loại chiêu (mục 9 tab chính), không ở số của set. Đã ghi câu hỏi ở mục 20 tab chính.

**Chốt dừng chỉnh set (2026-11-05).** Tiêu chí dừng: ít nhất 9/10 cặp khắc đúng chiều; không lộ nào trung bình trên 60%; 7 lộ trong ±1 quanh +4,5%; đỉnh ≤ 35%. Khoảng 55–65% vẫn là đích, đo lại sau khi cân 10 loại chiêu. Lần chỉnh cuối chỉ để đưa hai lộ thủ về ±1:

- Bàn Thạch giảm sát thương ngoại nhận 12% còn 10%; Ngọc Tủy giảm sát thương nội nhận 18% còn 15%. Cả hai đang quá mạnh khi lộ công mang đúng loại đòn.
- Binh bộ Trấn Thủ: mốc 2 khiên nhận +5% còn +3%; mốc 3 thủ ngoại và thủ nội +3% còn +1,5%.
- Bàn Thạch giữ hồi 0,1% máu mỗi giây, vì đó là kiểu sức mạnh người dùng nêu cho bộ này (máu, thủ ngoại, hồi máu).

**Đo lần 6 (2026-11-05, sau lần chỉnh cuối).** Đạt 3/4 tiêu chí dừng: 9/10 cặp đúng chiều; không lộ nào trung bình trên 60%; đỉnh 34,7%. 7/10 cặp vào 55–65% ở ít nhất một cách đo. Thủ Ngoại 5,6 và Thủ Nội 5,9 còn vượt ±1. Cặp duy nhất chưa đúng chiều là Hấp Thu khắc Khống Tốc (45–48%), để lại tới khi cân 10 loại chiêu. Chỉnh nốt mốc 2: Bàn Thạch máu +2% còn +1,5%; Chu Thiên giảm sát thương nội nhận 4% còn 2% (cặp Thủ Nội khắc Nội Công đang quá mạnh khi đội công chỉ mang chiêu nội, 70,7%).

**Đo lần 7: đạt đủ 4 tiêu chí dừng (2026-11-05).** Số ở bảng phần 14.4 và 14.5 là bộ số chốt của Set đồ 2.0, đã thay bằng bộ số ở lần đo 11.

- 7 lộ đều trong 3,5–5,5: Ngoại Công 4,7; Nội Công 5,3; Thủ Ngoại 5,5; Thủ Nội 5,5; Hấp Thu 4,2; Phản Chấn 4,3; Khống Tốc 5,1.
- 9/10 cặp khắc đúng chiều.
- Không lộ nào trung bình trên 60% (cao nhất 55,5%).
- Đỉnh 34,7%.

Còn lại cho lần cân 10 loại chiêu: cặp Hấp Thu khắc Khống Tốc (45–48%) và cặp Thủ Nội khắc Nội Công quá mạnh khi đội công chỉ mang chiêu nội (70%). Cả hai đều dính tới việc nhóm chiêu nội yếu.

**Đo lần 8: sau đề xuất cân 10 loại chiêu (2026-11-05; người dùng duyệt cùng ngày).** Số loại chiêu ở mục 8 tab Hoàng Thiên Ký — GDD, kèm Văn Uyên mốc 4 giảm mana thi triển 6% còn 4,5%. 200 cặp, bậc tím. Bảng ghi tỷ lệ thắng của bên khắc. A: công pháp theo lộ; B: hai bên cùng công pháp; C: lộ mang đúng loại đòn.

| Cặp | Trước A / B / C | Sau A / B / C |
|---|---|---|
| Thủ Ngoại > Ngoại Công | 48,5 / 55,9 / 59,2 | 52,2 / 57,2 / 53,2 |
| Thủ Nội > Nội Công | 48,4 / 45,2 / 70,0 | 58,0 / 47,4 / 63,7 |
| Ngoại Công > Thủ Nội | 60,0 / 49,1 / 69,3 | 52,8 / 45,4 / 73,3 |
| Nội Công > Thủ Ngoại | 57,3 / 45,8 / 43,3 | 49,4 / 51,4 / 57,5 |
| Phản Chấn > Ngoại Công | 50,5 / 50,6 / 50,2 | 55,7 / 52,7 / 42,1 |
| Nội Công > Phản Chấn | 54,0 / 56,4 / 40,8 | 48,8 / 58,0 / 56,3 |
| Ngoại Công > Hấp Thu | 60,3 / 51,2 / 61,9 | 54,0 / 46,6 / 68,5 |
| Hấp Thu > Phản Chấn | 59,9 / 59,9 / 59,9 | 60,7 / 60,7 / 60,7 |
| Hấp Thu > Khống Tốc | 48,1 / 48,1 / 45,3 | 54,9 / 54,9 / 54,4 |
| Khống Tốc > Nội Công | 48,2 / 52,5 / 60,8 | 51,1 / 44,2 / 52,2 |

- 10/10 cặp đúng chiều (trước 9/10): cặp Hấp Thu khắc Khống Tốc hết ngược.
- 5/10 cặp vào 55–65% theo tiêu chí (trước 6/10). Ba cặp ở 54–55; Ngoại Công khắc Thủ Nội và Hấp Thu ở bản C còn quá mạnh (73, 68).
- Không lộ nào trung bình trên 60% ở A, B (cao nhất 55,5%).
- 7 lộ: Ngoại Công 4,8; Nội Công 5,3; Thủ Ngoại 4,9; Thủ Nội 5,1; Hấp Thu 4,9; Phản Chấn 3,9; Khống Tốc 5,5. Đỉnh 34,8%.
- Ngoại Công đấu Nội Công ở bản C: 80,5% còn 55,3%.

Vòng khắc phẳng hơn, vì trước đây một phần "khắc" chỉ là Ngoại Công mạnh sẵn. Đích 55–65% cho từng cặp đo lại sau khi người dùng duyệt số loại chiêu.

**Bước 4: cân khắc trên nền loại chiêu mới (đề xuất, 2026-11-05).** Theo tiêu chí ở trên, 5/10 cặp đã vào 55–65%:

- Thủ Nội khắc Nội Công.
- Nội Công khắc Thủ Ngoại.
- Phản Chấn khắc Ngoại Công.
- Nội Công khắc Phản Chấn.
- Hấp Thu khắc Phản Chấn.

Bước này nhắm năm cặp còn lại.

| Cặp | Đo lần 8 | Sửa |
|---|---|---|
| Thủ Ngoại khắc Ngoại Công | A 52,2; C 53,2 | Bàn Thạch giảm sát thương ngoại nhận 10% lên 13% |
| Ngoại Công khắc Thủ Nội | A 52,8; C 73,3 | Lôi Trì mốc 2 chí mạng +2% lên +3%, cho Ngoại Công thêm sức chung |
| Ngoại Công khắc Hấp Thu | A 54,0; B 46,6 | Như dòng trên |
| Hấp Thu khắc Khống Tốc | A 54,9; B 54,9 | Bách Thảo thời gian bị khống chế −30% lên −35% |
| Khống Tốc khắc Nội Công | A 51,1; B 44,2; C 52,2 | Băng Phách đốt mana 20% lên 30%, vì chiêu nội nay tốn mana hơn; Liên Kích mốc 2 tốc đánh +4% còn +3% để Khống Tốc không vượt +5,5% |
| Giữ Phản Chấn khắc Ngoại Công khi Ngoại Công mạnh lên | A 55,7 | Thiết Kỵ mốc 2 giảm sát thương nhận 3% lên 4%; Phản Chấn đang thấp nhất (3,9) |

Mục tiêu: ít nhất 8/10 cặp vào 55–65% theo tiêu chí, 7 lộ trong ±1, đỉnh ≤ 35%.

**Đo lần 9 (sau bước 4, trên code loại chiêu mới).** 6/10 cặp vào 55–65% (trước 5), 10/10 đúng chiều. Không lộ nào trung bình trên 60%. Đỉnh 34,8%.

- 7 lộ: Ngoại Công 5,1; Nội Công 5,3; Thủ Ngoại 5,7; Thủ Nội 5,1; Hấp Thu 5,3; Phản Chấn 4,1; Khống Tốc 4,9.
- Thủ Ngoại vượt 5,5.
- Cặp chưa vào khoảng đích: Nội Công khắc Phản Chấn 54,0; Ngoại Công khắc Hấp Thu 54,8; Hấp Thu khắc Khống Tốc 51,0; Khống Tốc khắc Nội Công 51,2.
- Khống Tốc yếu nhất (trung bình 44%), vì đội mang công pháp ngẫu nhiên ít khi có chiêu Khống chế.

**Bước 5 (đề xuất).**

- Bàn Thạch mốc 2 máu +1,5% còn +1%, đưa Thủ Ngoại về dưới 5,5. Cặp Thủ Ngoại khắc Ngoại Công còn dư khoảng 0,5 điểm.
- Băng Phách mốc 2 thêm tốc đánh +3%; Liên Kích mốc 2 tốc đánh +3% lại lên +4%. Khống Tốc ra chiêu dày hơn, nhắm hai cặp của Khống Tốc.
- Thiết Kỵ mốc 2 giảm sát thương nhận 4% đổi thành giảm sát thương ngoại nhận 4%, để đòn nội đi qua. Phản Chấn về đúng kiểu: chặn và phản đòn ngoại, thua chiêu nội.
- Cặp Ngoại Công khắc Hấp Thu (thiếu 0,2 điểm) giữ nguyên, coi là dao động đo, vì cắt hút máu sẽ làm yếu hai cặp khác của Hấp Thu.

**Đo lần 10 (sau bước 5).** 8/10 cặp vào 55–65%. Không lộ nào trung bình trên 60%. Đỉnh 34,8%. Còn trượt hai chỗ:

- Cặp Hấp Thu khắc Khống Tốc ngược (48%), vì tốc đánh mới của Khống Tốc.
- Phản Chấn tụt còn 3,1, dưới 3,5, vì giảm sát thương nhận đổi sang chỉ đòn ngoại.

**Bước 6 (đề xuất).**

- Thiết Kỵ mốc 2: giảm sát thương ngoại nhận 4% lên 7%. Phản Chấn mạnh lên nhưng Nội Công vẫn khắc được, vì đòn nội không bị chặn.
- Bách Thảo mốc 2: thời gian bị khống chế −35% lên −50%. Chỉ đụng tới khống chế, nên không ảnh hưởng các cặp khác. Giữ tốc đánh của Liên Kích để cặp Khống Tốc khắc Nội Công không tụt lại.

**Đo lần 11: đạt đủ tiêu chí, chốt Set đồ 2.0 trên nền loại chiêu mới (2026-11-05).** Số ở phần 14.4 và 14.5 là bộ số chốt, người dùng duyệt 2026-11-05.

- 7 lộ đều trong 3,5–5,5: Ngoại Công 5,1; Nội Công 5,3; Thủ Ngoại 5,5; Thủ Nội 5,1; Hấp Thu 5,1; Phản Chấn 4,3; Khống Tốc 5,5.
- 8/10 cặp khắc vào 55–65%; 10/10 đúng chiều. Hai cặp đúng chiều nhưng ngoài khoảng: Ngoại Công khắc Hấp Thu 54%, Hấp Thu khắc Khống Tốc 51%.
- Không lộ nào trung bình trên 60% (cao nhất 55,4%).
- Đỉnh 34,8%.

| Mã mới | Nghĩa |
|---|---|
| NG-BA-001…006 | Binh ấn (bậc là thuộc tính từng viên) |
| DN-DK-001…012 | Điều kiện dòng ẩn |
| DN-HU-001…012 | Hiệu ứng dòng ẩn |
| PH-CH-011 | Giám Định Phù |
| TB-BO-001… | Bộ trọn lục bán ở shop, một mã cho mỗi bộ có bán |

Người dùng đã duyệt ngày 2026-11-05: cả Set đồ 2.0; bậc ấn và nguồn; việc tách thủ ngoại và thủ nội; bộ hệ số mới của 10 loại chiêu. Các con số vẫn chỉnh được khi đo lại, theo tiêu chí dừng ở trên.

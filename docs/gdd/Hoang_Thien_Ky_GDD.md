---
created: 2026-11-01 00:00
updated: 2026-11-09 10:30
tags:
  - project
  - game
  - gdd
type: project
status: active
source: git repo Hoang-Thien-Ky, docs/gdd (bản gốc cũ: Claude Docs tab chính, rev 296)
---

# Thiên Hoang Ký — Tài liệu thiết kế game (GDD)

2026-11-01 · @ANN

## 1. Tổng quan

Thiên Hoang Ký là tên chính thức của game (chốt 2026-11-05, đổi sang Hoàng Thiên Ký sáng 2026-11-09 rồi quay lại Thiên Hoang Ký cùng ngày; tên tạm trước đó là Khai Tông Lập Phái), lấy theo Thiên Hoang đại lục, thế giới của game. Đây là MMORPG mobile tiên hiệp thời gian thực xoay quanh tông môn (chốt 2026-11-09, trước đó là chiến lược dạng dashboard). Người chơi chạm điểm để đi trên map lớn, điều khiển nhân vật di chuyển tự do trong map nhỏ của từng khu vực, đánh thời gian thực có auto đầy đủ; các tông môn chiếm các khu vực tranh chung trên bản đồ, giành mỏ và bí cảnh, ghép tàn quyển thành công pháp riêng, rồi thăng vị diện cả môn.

**Một câu:** Bạn sống ở thành chủ trung lập của một vùng Hạ vị diện, lập hoặc gia nhập một tông môn (tông môn mới rơi ngẫu nhiên vào một vị trí có địa thế riêng), chạm điểm để đi trên map lớn, vào khu vực thì chạy tự do farm và mở dần sương mù, chiếm mỏ và tranh tài nguyên với các liên minh khác trong các trận thời gian thực. Khi tông môn đạt cấp 200, cả môn phi thăng lên vị diện cao hơn và bắt đầu lại từ cấp 1 ở một vùng ngẫu nhiên.

| Mục | Quyết định |
|---|---|
| Thể loại | MMORPG mobile thời gian thực xoay quanh tông môn, auto đầy đủ (tự làm nhiệm vụ, treo máy, tự PK) theo chuẩn MMORPG mobile Việt Nam; chốt 2026-11-09 |
| Bản đồ | Hai tầng (chốt 2026-11-09): map lớn của vùng/vị diện di chuyển bằng chạm điểm đến, tính thời gian theo quãng đường; map nhỏ của từng khu vực là bản đồ mở chi tiết, di chuyển tự do thời gian thực, có bãi farm và hầm ngục; có sương mù; 4 vị diện, 28 vùng (12 Hạ vị, 9 Trung vị, 5 Thần vực, 2 Thánh vực) |
| Nền tảng | Android và iOS cùng lúc |
| Thị trường đầu | Việt Nam (cần giấy phép G1, xem mục 18) |
| Đội | Một người; thuê ngoài mỹ thuật, âm thanh và pháp lý |
| Đồ họa | Bản đồ mở và trận đánh 2D isometric thủy mặc; HUD kiểu MMORPG mobile khi ra map; dashboard quản lý (Động phủ, Tông môn, Liên minh) khi quản trị |
| Phiên chơi | 5–10 phút (auto gánh phần cày), cộng hai khung bí cảnh 12:00 và 20:00 |
| Mô hình | Free-to-play: tiên ngọc đổi ra linh thạch qua Sàn Linh Ngọc, thẻ tháng, battle pass, cosmetic; không bán trực tiếp tàn quyển, công pháp hay tài năng |

**Ba điểm khác biệt:**

1. **Bản đồ mở có sương mù:** mỗi vùng là một map mở phong cách bản đồ cổ vẽ tay. Người chơi chạy tự do, mở dần sương mù khi đi qua, với tới mỏ xa hơn và gặp nhiều dị thú, tài bảo hơn. Nhìn bản đồ là thấy thế lực từng tông môn và liên minh.
2. **Công pháp tự ghép:** 480 tàn quyển thuộc 12 hệ, ghép thành công pháp riêng của tông môn. Đệ tử chỉ học được công pháp của tông môn mình.
3. **Thăng vị diện cả môn:** đạt cấp 200 thì cả tông môn phi thăng, về cấp 1 ở vị diện cao hơn với linh khí đậm hơn (Trung ×4, Thần ×8, Thánh ×12), mỏ nhiều cấp hơn và công pháp phẩm cao hơn.

**Định vị:** MMORPG tiên hiệp có chiều sâu chiến thuật tông môn như game SLG, nhưng mỗi tông môn có bộ võ học riêng và phải giữ người, vì đệ tử phản bội sẽ mất đà tu luyện. Auto đầy đủ để tôn trọng thời gian, tay chơi canh được ở các khung chiến. Thông điệp: tu tiên bằng trí, không bằng ví.

**File số liệu kèm theo:** `data/he_thong/HoangThienKy_HeThong_v1.xlsx` trong repo mã nguồn. File gốc không còn, nên ngày 2026-11-02 dựng lại từ tài liệu này và code. File gồm 12 hệ, 480 tàn quyển, 300 công pháp mẫu, 28 vùng, cấp tông môn 1–200, mỏ, bí cảnh, tỷ lệ rơi và thú cưỡi; ô màu vàng là đề xuất chờ duyệt. Mọi con số trong tài liệu này lấy từ file đó. File Excel là nguồn gốc: sửa file, chạy `tools/data/xuat.ts` để code đọc bản mới, rồi mình cập nhật lại tài liệu.

## 2. Trụ cột thiết kế và người chơi mục tiêu

Mọi tính năng mới phải phục vụ ít nhất một trong bốn trụ cột dưới đây; không phục vụ trụ nào thì cắt.

1. **Tông môn của riêng tôi.** Lãnh thổ, kiến trúc và bộ công pháp do tông môn tự xây. Không hai tông môn nào đánh giống nhau.
2. **Trí hơn lực.** Ghép tàn quyển đúng tổ hợp và đánh đúng hệ khắc quyết định thắng thua nhiều hơn chỉ số. Một đội yếu hơn 15% vẫn thắng được nếu chọn đúng hệ.
3. **Không ai tu tiên một mình.** Tông môn, liên minh và chiến tranh địa bàn là trung tâm; người chơi một mình tiến chậm hơn rõ rệt.
4. **Tôn trọng thời gian.** Phiên ngắn; hoạt động cố định chỉ ở các khung giờ đã báo trước: bí cảnh 12:00 và 20:00, chiến tranh 21:00.

| Nhóm người chơi | Họ là ai | Họ cần gì từ game |
|---|---|---|
| Độc giả tiên hiệp, 18–30 tuổi | Đọc truyện convert, xem donghua, ít chơi game chiến thuật | Cảm giác tu luyện, đột phá, thế giới đúng chất |
| Người chơi chiến thuật mobile | Đã chơi game xây base, chán bối cảnh quân sự phương Tây | Chiều sâu chiến thuật, PvP công bằng |
| Trưởng clan, người chơi xã hội | Thích tổ chức, chỉ huy, làm cộng đồng | Công cụ liên minh, chiến tranh có lịch, danh vọng |

## 3. Thế giới: vị diện, vùng và nguyên tố

Thiên Hoang đại lục gồm 4 vị diện, mỗi vị diện là một bản đồ riêng (đã chốt): Hạ vị 12 vùng xếp vòng quanh Linh Hải, cao nguyên tụ linh khí ở lòng giữa, Trung vị 9 vùng quanh Vân Hải, Thần vực 5 vùng quanh Thần Sơn, Thánh vực 2 vùng. Khung bố cục, lưới định vị 24 × 16 ô (A1–X16) và toạ độ thành chủ nằm trong thư mục map của dự án. Càng vào trong, linh khí càng đậm và tài nguyên càng quý. Mỗi vùng là một bản đồ mở liền mạch (chốt 2026-11-09, trước là bản đồ điểm nối bằng đường): người chơi di chuyển tự do thời gian thực trên map 2D isometric, không chia ô; các điểm tranh (thành chủ, vị trí sơn môn, mỏ, linh tuyền, cửa bí cảnh, đèo, bến đò, hang dị thú) là các khu vực có tọa độ và bán kính trên map. Số lượng, vị trí và phân bố điểm giữ nguyên từ bộ sinh bản đồ (`tools/mapgen`); đèo và bến đò vẫn là cửa ải vì địa hình (núi, hẻm, sông) ép đường đi tự nhiên qua đó.

*[Hình nhúng: bản đồ đề xuất · 4 vị diện, 28 vùng — xem bản gốc trên Claude Docs]*

8 trong 12 cặp vùng Hạ vị kề nhau có hệ tương sinh; 4 cặp còn lại trung tính (Phong và Quang, Quang và Hỏa, Cực âm và Âm lãnh, Âm lãnh và Kim; chốt 2026-11-02). Mỗi lần thăng vị diện, tông môn dời một vòng vào gần tâm, ở một vùng ngẫu nhiên.

| Vị diện | Số vùng | Số điểm cố định mỗi vùng (đề xuất) | Linh khí | Mỏ linh thạch | Phẩm công pháp cao nhất rơi | Cấp nhân vật tối đa |
|---|---|---|---|---|---|---|
| Hạ vị diện | 12 | Trung bình 350; 236–601 theo diện tích vùng (đã chốt) | ×1 | Cấp 1–5, hạ phẩm | Địa pháp (4) | 250 |
| Trung vị diện | 9 | ~350 | ×4 | Cấp 1–8, trung phẩm | Vương pháp (6) | 200 (cấp về 1, giữ chỉ số) |
| Thần vực | 5 | ~250 | ×8 | Cấp 1–20, thượng phẩm | Thần pháp (9) | Không còn cấp, tu luyện chiêu thức |
| Thánh vực | 2 | ~150 | ×12 | Cấp 1–100, cực phẩm | Thánh pháp (10) | Không còn cấp, tu luyện chiêu thức |

Rìa ngoài đại lục là Hư Không Hải, vùng đất chết: không ai chiếm được, dùng cho sự kiện và đảo bí cảnh đặc biệt. Bản đồ không có biển và ít sông (đã chốt 2026-11-02); điểm trên bản đồ vẽ thành đảo nổi. Linh khí theo vị diện đã chốt: Hạ ×1, Trung ×4, Thần ×8, Thánh ×12.

**12 hệ nguyên tố:** 5 hệ Ngũ Hành, 5 hệ biến dị (mỗi hệ sinh ra từ một hệ gốc) và 2 thiên địa dị hệ. Mỗi vùng Hạ vị diện thuộc về một hệ, nên vùng mà tông môn rơi vào quyết định hướng công pháp ban đầu.

| Hệ | Nhóm | Bản sắc | Vùng Hạ vị diện | Tàn quyển rơi ở vùng đó |
|---|---|---|---|---|
| Kim | Ngũ Hành | Xuyên giáp, đơn mục tiêu | Thiên Kiếm Nguyên | Kim, Lôi, Thổ, Cực dương |
| Mộc | Ngũ Hành | Hồi phục, trói chân | Vạn Mộc Lâm | Mộc, Phong, Thủy, Quang |
| Thủy | Ngũ Hành | Làm chậm, tiết kiệm mana | Bích Ba Hải | Thủy, Cực hàn, Kim, Âm lãnh |
| Hỏa | Ngũ Hành | Diện rộng, thiêu đốt | Xích Viêm Sơn | Hỏa, Cực dương, Mộc, Lôi |
| Thổ | Ngũ Hành | Phòng thủ, khiên | Hậu Thổ Nguyên | Thổ, Cực âm, Hỏa, Kim |
| Lôi | Biến dị của Kim | Chí mạng, tê liệt | Lôi Đình Cốc | Lôi, Phong, Quang, Âm lãnh |
| Phong | Biến dị của Mộc | Tốc độ, đẩy lùi | Cuồng Phong Nguyên | Phong, Mộc, Lôi, Cực hàn |
| Quang | Thiên địa dị hệ | Hồi máu, chói mắt | Diệu Quang Đài | Quang, Cực dương, Hỏa, Mộc |
| Âm lãnh | Thiên địa dị hệ | Tầm xa, hút máu | U Minh Đầm | Âm lãnh, Cực âm, Thủy, Thổ |
| Cực dương | Biến dị của Hỏa | Bùng nổ, xuyên kháng | Liệt Dương Mạc | Cực dương, Hỏa, Quang, Kim |
| Cực âm | Biến dị của Thổ | Nguyền rủa, sát thương theo thời gian | Cửu U Uyên | Cực âm, Âm lãnh, Thổ, Cực hàn |
| Cực hàn | Biến dị của Thủy | Đóng băng, khống chế | Vạn Niên Băng Nguyên | Cực hàn, Thủy, Cực âm, Phong |

Ở mỗi vùng Hạ vị diện, 50% tàn quyển rơi ra thuộc hệ chủ đạo; phần còn lại chia đều cho 3 hệ phụ. Phần lớn vùng kề nhau có hệ tương sinh, nên biên giới giữa hai vùng đó là nơi ghép công pháp tốt nhất. Tên 9 vùng Trung vị, 5 Thần vực và 2 Thánh vực nằm ở sheet Vùng.

**Phe phái NPC và giọng điệu** giữ như bản trước: Chính Đạo Minh, Huyết Sát Môn, Yêu tộc, Cổ tông di tích; thuật ngữ Hán Việt có tooltip; toàn bộ tên và cốt truyện là nguyên tác.

### Thành chủ, lập tông và sương mù

**Thành chủ.** Mỗi vùng có một thành chủ trung lập, không thuộc thế lực nào và không thể bị chiếm. Người chơi sống ở đây: chợ chung, NPC nhiệm vụ, kho cá nhân, nơi hồi sinh sau khi chết. Trong thành không có giao chiến. Từ thành, người chơi truyền tống thẳng về sơn môn của mình qua Truyền Tống Trận cơ bản mà mọi tông môn có từ cấp 1. Người chơi mới bắt đầu ở thành chủ của vùng được hệ thống gợi ý theo số người; khi gia nhập tông môn, thành chủ nhà chuyển về vùng của tông môn đó.

**Lập tông: vị trí ngẫu nhiên.** Khi lập tông môn, người chơi không chọn vùng hay vị trí. Tông môn được đặt ngẫu nhiên vào một vị trí sơn môn còn trống của một vùng Hạ vị và phải phát triển theo đặc thù ở đó. Vùng quyết định hệ chủ đạo; địa thế của vị trí quyết định công trình nào mạnh, công trình nào yếu. Sơn môn là một điểm trên bản đồ, nơi đặt Chính Điện, nên cũng là mục tiêu cuối cùng trong chiến tranh.

| Địa thế (đề xuất) | Mạnh | Yếu |
|---|---|---|
| Linh mạch | Tu luyện +15% | Hộ Sơn Đại Trận −10% |
| Sơn hiểm | Hộ Sơn Đại Trận +20%, bên công đi thêm 1 chặng | Ít mỏ trong tầm gần |
| Hỏa mạch | Luyện Khí Các: rèn +10%, tốn quặng −10% | Linh Dược Viên −15% |
| Thủy trạch | Linh Dược Viên +20% | Luyện Khí Các −10% |
| Cổ tích | Thêm 1 lượt bí cảnh di tích mỗi ngày | Dị thú quanh sơn môn mạnh hơn |
| Thương lộ | Gần thành chủ, thuế chợ −1% | Dễ bị cướp trên đường, phòng thủ −10% |

**Sương mù và khám phá.** Bản đồ phủ sương mù. Người chơi chạy tới đâu thì sương mù tan trong một bán kính quanh chỗ đó; phần đã mở lưu lại vĩnh viễn và chia sẻ chung trong tông môn, đồng minh thấy chung phần đã mở của nhau. Truyền Tống Trận giữ vai trò dịch chuyển nhanh: mọi tông môn có trận cơ bản nối thành chủ với sơn môn từ cấp 1; Truyền Tống Trận lớn (mở ở cấp tông môn 50) cho đặt điểm đến trong tầm, tối đa một quãng đường tương đương 5 chặng cũ ở Hạ vị (đề xuất). Càng đi xa, tông môn với tới càng nhiều mỏ, và trong phần sương vừa mở càng nhiều dị thú, tài bảo và mạch linh thạch tạm thời xuất hiện ngẫu nhiên. Đổi lại, điểm ở xa cần nhiều người canh hơn và dễ bị tông môn khác tranh. Tỷ lệ xuất hiện có trần chung theo vùng để cân bằng tài nguyên (mục 12).

### Hành trình, vùng nguy hiểm và tử vong

**Di chuyển hai tầng (chốt 2026-11-09).** Bản đồ chia hai tầng rõ rệt:

- **Tầng 1 — map lớn (vùng và vị diện):** là màn Bản đồ; di chuyển chỉ bằng chạm điểm đến (nút Đi tới), không điều khiển tay. Thời gian đi tính theo quãng đường chia tốc độ (đề xuất: 8 ô mỗi giây khi đi bộ; thú cưỡi nhân tốc độ), hiện đếm ngược trên bản đồ; trên đường vẫn gặp cướp và sát thủ như luật vùng nguy hiểm. Tới nơi rồi mới vào được khu vực của điểm đó.
- **Tầng 2 — map nhỏ (khu vực):** mỗi điểm (hang dị thú, mỏ, thành chủ, sơn môn…) có một map nhỏ chi tiết, di chuyển tự do thời gian thực bằng joystick hoặc chạm (combat mục 8 diễn ra ở tầng này). Trong map nhỏ, người chơi thấy những người chơi khác đang ở cùng khu vực: đang farm, đang treo máy auto (có cờ auto); ủy thác khi tắt game thì nhân vật rời map nên không hiện. Server đồng bộ tầng này bằng AOI (mục 16).

**Vùng hoạt động theo cấp.** Mỗi khu vực trên map có cấp nguy hiểm, tính theo quãng đường ngắn nhất tới thành chủ (đã chốt 2026-11-02): 1 ở thành chủ, 250 ở nơi xa nhất của vùng, nên bậc 10 cấp nào cũng có chỗ luyện. Thành chủ và khu vực quanh sơn môn có NPC hộ đạo là vùng an toàn; ra ngoài đó, ai cũng có thể bị người chơi khác đồ sát. Đi vào nơi có cấp nguy hiểm càng cao hơn cấp mình thì dị thú càng mạnh, càng dễ gặp cướp và sát thủ. Ở thượng vị, nơi không còn cấp nhân vật, cấp nguy hiểm so với cảnh giới.

**Bãi farm trong map nhỏ (chốt hướng 2026-11-09, số là đề xuất).** Map nhỏ của hang dị thú và khu dã ngoại có nhiều bãi farm. Mỗi bãi có: hệ quái theo hệ chủ đạo của vùng; dải cấp riêng (bãi chia theo bậc 10 cấp quanh cấp nguy hiểm của điểm, ví dụ điểm cấp 80 có bãi 70–80 và 80–90); hồ sơ rơi đồ riêng — mỗi bãi nghiêng một loại (ngọc, dược liệu, quặng, tàn quyển, linh thạch), để người chơi chọn bãi theo nhu cầu; mật độ quái. Luật luyện bãi quái (18 trận mỗi giờ, trần 8 giờ, chênh cấp, đúng hệ, trần cộng +40%) giữ nguyên ở tab Nhiệm vụ; bãi farm chính là hiện thân real-time của luật đó.

**Hầm ngục trong bãi farm (đề xuất).** Bãi từ cấp 60 trở lên có cửa hầm ngục. Trong hầm: quái đông gấp đôi và chỉ số +30%, đổi lại rơi đồ quý (ấn bộ từ tím, ngọc cấp cao, tàn quyết bảo vật, tỷ lệ thần vật ×2). Hầm thiết kế cho party: một mình rất khó vì quái đông, và đi một mình thì mất buff party theo tài năng (mục 3); khuyến khích đi cùng team có đủ vai trò. Hầm có 3 tầng, càng sâu quái càng mạnh và đồ càng quý; tầng 3 có boss nhỏ.

**Đồ sát, sát nghiệp và lao tù thành chủ (đã chốt).** Ngoài thành chủ và khu vực có NPC hộ đạo, người chơi được đồ sát người chơi khác, bên cạnh dị thú và cướp NPC của Huyết Sát Môn. Mỗi lần đồ sát cộng điểm sát nghiệp. Kẻ sát nghiệp quá nặng mà bị giết thì bị nhốt trong lao tù thành chủ 4–12 giờ, không ra ngoài được, tùy mức sát nghiệp. Có hai cách ra sớm: tông môn chuộc ra, hoặc mua Kim Bài Miễn Tử với giá rất cao. Khi ra tù, dù bằng cách nào, nhân vật mất hết đồ đang mặc và rớt 2 cảnh giới nhỏ (ví dụ cấp 100 xuống 98), chỉ số bị trừ theo cấp.

**Tông môn hắc ám (đã chốt).** Thành viên tông môn hắc ám theo bộ pháp luyện tà hoặc sát thủ không bị nhốt vào lao tù dù sát nghiệp nặng, nhưng khi bị diệt sát vẫn rớt 1 cấp và mất đồ.

**Số và luật đề xuất, chờ bạn duyệt:**

- Sát nghiệp +1 mỗi lần giết người chơi không có sát nghiệp; giết kẻ đang có sát nghiệp không bị cộng, để người chơi có động lực săn kẻ đồ sát. Sát nghiệp giảm 1 điểm mỗi 6 giờ online.
- Từ 5 điểm trở lên, tên hiện màu đỏ trên bản đồ và bị nhốt khi chết: 4 giờ ở 5 điểm, mỗi điểm thêm 1 giờ, tối đa 12 giờ.
- Kim Bài Miễn Tử bán bằng linh thạch ở thành chủ, không bán bằng tiền nạp, để giữ nguyên tắc tiền không mua được lợi thế chiến đấu. Tiền chuộc của tông môn trả từ Bảo Khố.
- Ở thượng vị, nơi không còn cấp, rớt cảnh giới được thay bằng trừ tu vi tương đương.
- Chính hay tà không do tông môn tự chọn mà tính theo mức đồ sát của cả tông môn (xem mục 10).

**Tử vong.** Nhân vật chết thì rơi ngẫu nhiên đồ đang mặc và bị trừ kinh nghiệm, rồi hồi sinh ở thành chủ. Đề xuất số: rơi 1 món ngẫu nhiên; trừ 10% kinh nghiệm của cấp hiện tại, không rớt cấp; ở thượng vị trừ 10% tu vi đang tích. Đồ rơi do người chơi giết thì thành chiến lợi phẩm của họ; do dị thú hay NPC giết thì nằm lại tại chỗ 30 phút cho party nhặt lại, sau đó mất.

**Sống lâu hơn trên đường:** chỉ số cao nhờ điểm cộng, đan dược hồi máu dùng giữa các chặng, phù trú (phù hộ thân giảm xác suất gặp sự kiện, phù độn thổ đưa về thành chủ ngay), và đi theo party.

**Party.** Tối đa 6 người; khi nhận nhiệm vụ tông môn, party mở rộng tới 10. Mỗi thành viên mang cho cả party một buff theo tài năng của mình, ví dụ Tu thể tăng máu cả đội, Tu dược tăng hồi máu, Tu kim tiền tăng tỷ lệ rơi. Thành viên nào chết thì party mất buff của người đó tới hết hành trình. Đề xuất: mỗi buff 3–5%, buff cùng loại không cộng dồn, để party nhiều tài năng khác nhau có lợi hơn party toàn một loại.

## 4. Vòng lặp gameplay

Mỗi ngày có hai đỉnh hoạt động là bí cảnh 12:00 và 20:00; giữa hai đỉnh là các phiên ngắn để thu mỏ, chiếm điểm mới và ghép công pháp. Vòng dài nhất là thăng vị diện, khoảng 5 tháng mỗi vị diện.

| Vòng | Nhịp | Hoạt động | Phần thưởng |
|---|---|---|---|
| Phiên | 5–10 phút | Xem Động phủ, thu mỏ, chiếm điểm trong tầm Truyền Tống Trận, xếp hàng xây, đổi công pháp cho đệ tử | Linh thạch, quặng, dược liệu |
| Ngày | 2 khung bí cảnh + 2–4 phiên | Bí cảnh 12:00 và 20:00, nhiệm vụ tông môn, mua bán ở chợ | Tàn quyển, cống hiến |
| Tuần | Theo lịch | Chiến tranh địa bàn lúc 21:00, boss liên minh, đấu giá tàn quyển | Lãnh thổ, mỏ cấp cao |
| Vị diện | Khoảng 5 tháng | Tông môn từ cấp 1 lên 200, rồi phi thăng | Vị diện mới, linh khí đậm hơn (×4 đến ×12) |

**Một ngày mẫu:**

1. Sáng: mở Động phủ, thu mỏ, cử đoàn đệ tử đi chiếm 1–2 điểm trong tầm Truyền Tống Trận, ghép một công pháp mới.
2. 12:00: vào bí cảnh tông môn đang chiếm, hoặc theo đội đi tranh đoạt bí cảnh của tông môn khác.
3. Chiều: mua bán tàn quyển và quặng ở chợ, hiến tế linh thạch để tăng cấp tông môn.
4. 20:00: bí cảnh lần 2.
5. 21:00 (Thứ Ba, Thứ Năm, Thứ Bảy): chiến tranh địa bàn với tông môn láng giềng.

Người dưới 18 tuổi chỉ được chơi 60 phút mỗi ngày, nên hai khung bí cảnh 30 phút vừa đủ cho một ngày của họ.

## 5. Tông môn: cấp độ, lãnh thổ và công trình

Tông môn có cấp 1–200 ở mỗi vị diện; cấp quyết định số điểm giữ được, tầm Truyền Tống Trận, số thành viên và các tính năng mở khóa.

| Cấp | Điểm giữ tối đa · tầm (Hạ vị, đề xuất) | Thành viên | Mở khóa | Ngày ước tính |
|---|---|---|---|---|
| 1 | 3 điểm · 1 chặng | 10 | Lập tông, Chính Điện, vị trí ngẫu nhiên, Truyền Tống Trận cơ bản | 0 |
| 10 | 4 điểm · 1 chặng | 12 | Tranh đoạt bí cảnh | 0,1 |
| 30 | 6 điểm · 1 chặng | 17 | Tuyên chiến địa bàn | 1 |
| 50 | 8 điểm · 2 chặng | 22 | Truyền Tống Trận lớn | 4 |
| 100 | 12 điểm · 3 chặng | 35 | Ghép công pháp 3 tàn quyển | 24 |
| 150 | 16 điểm · 4 chặng | 47 | Hộ Sơn Đại Trận cấp cao | 69 |
| 200 | 20 điểm · 5 chặng | 60 | Phi Thăng Đài, thăng vị diện | 147 |

Ngày ước tính giả định tông môn kiếm 2,5 triệu XP mỗi ngày; đủ 200 cấp và các mốc khác (liên minh, Thương hội) nằm ở sheet Cấp tông môn.

**Lãnh thổ theo điểm (đề xuất, chờ bạn duyệt):**

- Lãnh thổ là tập các điểm tông môn đang giữ: mỏ, linh tuyền, cửa bí cảnh, đèo, bến đò. Chỉ chiếm được điểm nằm trong tầm Truyền Tống Trận.
- Trên bản đồ, mỗi điểm mang màu tông môn; các điểm liền nhau được tô thành một mảng để nhìn ra thế lực từng tông môn và liên minh.
- Điểm có mỏ, linh tuyền, cửa bí cảnh là mục tiêu tranh chấp chính; đèo và bến đò chặn đường của tông môn khác đi qua đó.
- Bản đồ tranh hiện công trình, mỏ, đoàn quân (đường đi kèm đồng hồ đếm ngược) và những gì xuất hiện ngẫu nhiên trong phần đã mở sương.

**Điểm có hạn, phải tranh (đã chốt 2026-11-02).** Tài nguyên trên bản đồ cố ý không đủ cho mọi tông môn. Một vùng Hạ vị trung bình có khoảng 90 vị trí sơn môn nhưng chỉ khoảng 210 điểm giữ được (mỏ, linh tuyền, cửa bí cảnh, đèo, bến đò). Không giới hạn số tông môn mỗi vùng; số điểm giữ tối đa ở bảng trên là trần, không phải mức tông môn chắc chắn có. Muốn thêm mỏ thì phải giành từ tông môn khác.

**Mỏ của NPC (đề xuất).** Dị thú và Huyết Sát Môn cũng giành điểm, để luôn có mỏ cho người mới và tông môn nhỏ đánh lấy mà không phải cướp của người chơi. Lúc mở vùng, NPC giữ 10% số mỏ linh thạch cấp 1. Mỗi ngày Huyết Sát Môn đánh lại tối đa 3 mỏ cấp 1–2 không có ai trấn giữ quá 24 giờ, ưu tiên vùng biên (mục 11). Mỏ NPC không tính vào điểm giữ của tông môn nào.

| Công trình | Chức năng |
|---|---|
| Chính Điện | Lõi tông môn; giới hạn cấp mọi công trình khác |
| Tàng Kinh Các | Lưu tàn quyển, ghép công pháp, chọn bộ công pháp truyền thụ |
| Hộ Sơn Đại Trận | Phòng thủ Chính Điện bằng trận nhãn theo hệ; từ cấp 150 nâng thành Chu Thiên Tinh Đấu Đại Trận (mục 10) |
| Diễn Võ Trường | Huấn luyện đệ tử, xếp đội hình chiến |
| Luyện Đan Phòng | Đan dược; Tẩy Tủy Đan (cần Tu đan) |
| Luyện Khí Các | Rèn pháp bảo từ quặng (Tu rèn rèn được phẩm cao) |
| Linh Dược Viên | Trồng dược liệu, mạnh hơn khi đặt cạnh linh tuyền |
| Bảo Khố | Chứa tài nguyên; một phần không bị cướp khi thua chiến |
| Truyền Tống Trận | Cơ bản: nối thành chủ với sơn môn. Lớn (từ cấp 50): tăng tầm chiếm điểm và mở sương mù, đưa đệ tử tới chiến trường xa, hỗ trợ đồng minh |
| Thương hội | Gian hàng ở chợ, giảm thuế (cần Tu kim tiền) |
| Phi Thăng Đài | Mở ở cấp 200, kích hoạt thăng vị diện |

## 6. Nhân vật, đệ tử, tài năng và thú cưỡi

Mỗi người chơi điều khiển một tu sĩ, tự lập tông môn hoặc gia nhập tông môn của người khác; đệ tử NPC lấp các vị trí trống. Mỗi nhân vật có linh căn (hệ) và đúng một tài năng ngẫu nhiên.

| Thuộc tính | Giá trị | Ảnh hưởng |
|---|---|---|
| Linh căn | 1–2 trong 12 hệ | Luyện công pháp trùng hệ chủ quyển nhận đủ buff của hệ, trùng hệ phụ quyển nhận một nửa |
| Tài năng | 1 trong 8, mỗi loại 12,5% | Vai trò trong chiến đấu và kinh tế (bảng dưới) |
| Cấp nhân vật | Hạ vị tối đa 250; Trung vị về cấp 1, giữ chỉ số, tối đa 200; Thần vực và Thánh vực không còn cấp (xem mục 7) | Phẩm công pháp học được (đề xuất, chờ bạn duyệt): Hạ vị Phàm từ cấp 1, Hoàng từ cấp 50, Huyền từ cấp 100, Địa từ cấp 150; Trung vị Thiên từ cấp 1, Vương từ cấp 100; Tôn, Tiên, Thần và Thánh pháp mở theo cảnh giới ở thượng vị |

| Tài năng | Chiến đấu | Kinh tế | Đặc quyền |
|---|---|---|---|
| Tu thể | +15% máu, +10% phòng thủ; cận chiến và hộ thể +10% | Khai khoáng thủ công +10% | Học Hộ thể cao hơn 1 phẩm |
| Tu pháp | +15% sát thương tầm xa và diện rộng, +10% mana | — | Bùa chú thêm 1 lần mỗi trận |
| Tu trận | Bày trận nhanh hơn 30%, tuyệt sát +5% | Hộ Sơn Đại Trận +5% khi có Tu trận trấn giữ | Chỉ Tu trận học Trận pháp từ Địa pháp, xây Truyền Tống Trận và hộ trận ở cứ điểm |
| Tu đan | Đan dược tự dùng +20% | Luyện đan +1 bậc chất lượng, sản lượng +15% | Luyện Tẩy Tủy Đan |
| Sát thủ | +10% chí mạng, +20% sát thương chí mạng, ẩn thân 3 s đầu trận | — | Thân pháp hồi chiêu −20% |
| Tu rèn | Pháp bảo tự rèn +10% | Rèn +1 bậc chất lượng, tốn quặng −15% | Rèn pháp bảo từ Thiên phẩm |
| Tu dược | Hồi máu nhận +10% | Mỏ dược +20%, nhận ra dược liệu hiếm | Thu được dược liệu hiếm |
| Tu kim tiền | Luck +10 (tăng tỷ lệ rơi phẩm cao) | Khai khoáng +15%, lợi nhuận giao dịch +10%, thuế chợ −2%, +1 gian hàng | Mở Thương hội |

**Tẩy tủy:** chỉ khi tông môn đã ở Trung vị diện và nhân vật đạt cấp 100 ở Trung vị. Tốn 1 Tẩy Tủy Đan (Tu đan luyện), 5.000 linh thạch trung phẩm, 20 Long Tủy Thảo và 3 Thiên Địa Linh Tủy. Kết quả là thêm 1 tài năng ngẫu nhiên khác tài năng đang có; tối đa 2 tài năng.

**Điểm tiềm năng (đề xuất 2026-11-09, chờ bạn duyệt):** mỗi lần lên cấp nhận 1 điểm tiềm năng (điểm đang có = cấp − 1, trừ phần đã cộng). Người chơi tự cộng vào 6 thuộc tính, mỗi điểm cho mức sau; hp, công, thủ, mana tính theo phần nghìn của chỉ số gốc theo cấp, các mức còn lại là phần nghìn tuyệt đối:

| Thuộc tính | Mỗi điểm | Vai trò |
|---|---|---|
| Thể phách | Máu +1‰ | Bền bỉ |
| Khí lực | Công lực +0,8‰ | Sát thương |
| Căn cốt | Phòng thủ +2‰ | Chống chịu |
| Thần thức | Chí mạng +1‰, sát thương chí mạng +1‰ | Bạo kích |
| Linh lực | Mana tối đa +2,5‰, mana tiêu −0,4‰ | Thi triển, hồi phục |
| Thân pháp | Tốc đánh +1,5‰, hồi chiêu −1‰ | Nhanh nhẹn |

- Mốc mềm: từ điểm thứ 121 trong cùng một thuộc tính, mỗi điểm chỉ còn nửa tác dụng. Cộng dồn một thuộc tính vẫn chơi được nhưng build lai có giá hơn; người chơi tự khám phá cách chia theo tài năng, linh căn và bộ công pháp.
- Tẩy điểm: miễn phí khi dưới cấp 50; từ cấp 50 tốn 1.000 linh thạch mỗi lần.
- Đo trên bản sao mô phỏng (2026-11-09), hai bàn đo: đội hình 10 đấu 10 cố định cấp 60 (200 trận) cho 250 điểm dồn một thuộc tính thắng 84,5–88,5%, Linh lực thấp nhất; 200 đội ngẫu nhiên của tools/balance cho 76,0–85,1% (+5,9 tới +8,9% lực chiến quy đổi), Linh lực và Thân pháp cao nhất, Thể phách và Căn cốt thấp nhất. Hai bàn lệch ngược chiều nhau, nên giữ nguyên bảng mỗi điểm; chỉnh theo một bàn sẽ làm bàn kia lệch thêm.
- Người chơi biết chia điểm dưới mốc mềm (ví dụ 120 Linh lực + 120 Thân pháp + 10 Khí lực) được +14,5% lực chiến quy đổi, cao hơn dồn một thuộc tính — đúng ý "khám phá cách cộng". Ngân sách lực chiến tổng lấy **+15%** cho lớp này (đo của phiên Sprint 2026-11-09), cộng cạnh lớp tầng công pháp +19,3% và trần đồ 35%.

**Học công pháp theo tông môn:** đệ tử chỉ học được công pháp trong bộ công pháp truyền thụ của tông môn mình và mang tối đa 4 công pháp vào trận. Mỗi công pháp có 10 tầng; tầng tăng bằng tu luyện và cống hiến.

**Phản bội tông môn:**

- Rời tông môn khi chưa được tông chủ cho xuất sư là phản bội.
- Mọi công pháp của tông môn cũ dừng ở tầng đang học, không tăng được nữa nhưng vẫn dùng được.
- Thi triển công pháp đó lên người của tông môn cũ chỉ gây 50% sát thương.
- Xuất sư hợp lệ (đã chốt): công pháp của tông môn cũ cũng dừng ở tầng đang học nhưng không bị giảm 50% sát thương. Đề xuất thêm, chờ bạn duyệt: phản bội trong lúc đang chiến tranh thì bị khóa gia nhập tông môn mới 72 giờ.

**Đệ tử NPC:** tuyển hằng ngày ở sơn môn, làm việc ở mỏ và công trình, ra trận khi thiếu người. Họ dùng chung luật tài năng và công pháp với người chơi.

**Cấu trúc tông môn (đã chốt: người chơi gia nhập như guild).** Một tông môn do một người chơi lập, các người chơi khác gia nhập. Số người chơi tối đa theo cấp tông môn: 10 ở cấp 1, 60 ở cấp 200. Chỗ trống được lấp bằng đệ tử NPC.

| Chức vị | Số lượng | Quyền |
|---|---|---|
| Tông chủ | 1 | Mọi quyền: tuyên chiến, liên minh, chọn bộ công pháp truyền thụ, cho xuất sư, khởi động thăng vị diện |
| Phó tông chủ | 1–2 theo quy mô | Như tông chủ, trừ giải tán tông môn và khởi động thăng vị |
| Trưởng lão | 2–6 theo quy mô | Duyệt người vào, xếp đội chiến, ghép công pháp ở Tàng Kinh Các, chia tàn quyển trong kho |
| Nội môn đệ tử | Không giới hạn riêng | Học toàn bộ bộ công pháp truyền thụ, ra mọi trận, vào bí cảnh của tông môn |
| Ngoại môn đệ tử | Người mới vào, 7 ngày đầu | Học tối đa 2 công pháp phẩm Phàm hoặc Hoàng; chưa vào trận giữ Chính Điện |

**Nhân sự theo quy mô và NPC thay thế (đã chốt).** Tông môn nhỏ, trung, vừa, lớn có cơ cấu vị trí khác nhau. Thiếu phó tông chủ hay trưởng lão thì thuê NPC thay thế; NPC làm được hộ trận, phòng thủ và tấn công, nhưng người chơi cùng cấp có đồ tốt thì nhỉnh hơn một chút.

| Quy mô (đề xuất) | Cấp tông môn | Phó tông chủ | Trưởng lão | Đường chủ (Trận pháp, Luyện đan, Luyện khí, Chiến đường) |
|---|---|---|---|---|
| Nhỏ | 1–49 | 1 | 2 | 1 |
| Trung | 50–99 | 1 | 4 | 2 |
| Vừa | 100–149 | 2 | 5 | 3 |
| Lớn | 150–200 | 2 | 6 | 4 |

Đề xuất cho NPC thay thế: chỉ số bằng 90% người chơi cùng cấp mang đồ cường hóa +10 và ngọc cấp 3; trả lương linh thạch mỗi ngày; không có quyền quyết định (tuyên chiến, liên minh, duyệt người, khởi động thăng vị, giải tán). Người chơi vào đúng vị trí đó thì NPC tự rời.

**Luật vận hành (đề xuất, chờ bạn duyệt):**

- **Lập tông môn** cần nhân vật cấp 20 và 10.000 linh thạch hạ phẩm. Người mới chưa đủ cấp thì gia nhập tông môn có sẵn.
- **Gia nhập** bằng đơn xin hoặc lời mời, chỉ tông môn cùng vị diện. Sau 7 ngày ở ngoại môn, trưởng lão duyệt lên nội môn.
- **Tàn quyển nhặt được thuộc về người nhặt.** Nộp vào Tàng Kinh Các thì đổi được cống hiến; chỉ tàn quyển trong Tàng Kinh Các mới ghép thành công pháp của tông môn.
- **Cống hiến cá nhân** đến từ nộp tàn quyển, khai mỏ, hiến tế linh thạch, chiến đấu và hộ pháp. Cống hiến dùng để lên tầng công pháp và đổi vật phẩm trong kho tông môn.
- **Tông chủ vắng 14 ngày** thì quyền tự chuyển cho phó tông chủ có cống hiến cao nhất.
- **Thăng vị diện:** mọi thành viên đang trong tông môn đi theo. Ai không muốn đi thì xin xuất sư trước khi tông chủ khởi động, không bị tính là phản bội. Đây là con đường duy nhất để lên vị diện cao hơn; không có thăng vị cá nhân (xem mục 7).

### Ngoại hình nhân vật

Người chơi chọn 1 trong 4 thân trống lúc tạo nhân vật; áo, mũ và vũ khí hiện trên người và đổi hình khi thay đồ (đã chốt 2026-11-02).

| Phần | Chọn lúc tạo nhân vật | Về sau |
|---|---|---|
| Thân | 1 trong 4: nam khỏe, nam mảnh, nữ khỏe, nữ mảnh | Đổi bằng Dịch Dung Đan; lần đổi đầu miễn phí (đã chốt) |
| Áo | 1 trong 3 kiểu khởi đầu (đề xuất) | Hình theo áo đang mặc |
| Mũ | 1 trong 3 kiểu khởi đầu, có một kiểu để đầu trần (đề xuất) | Hình theo mũ đang đội |
| Vũ khí | 1 trong 2 kiểu của nhóm vũ khí theo tài năng (đề xuất) | Hình theo tài năng người cầm và độ hiếm món đồ |
| Đai, bao tay, giày, ngọc bội | Không chọn | Không hiện trên người, chỉ có chỉ số |

- **Thân và đồ khởi đầu chỉ là hình (đã chốt).** 4 thân có chỉ số như nhau, mọi món khởi đầu cũng cùng chỉ số, nên người chơi chọn theo ý thích mà không sợ chọn sai.
- **Vũ khí theo tài năng (đã chốt).** Một món vũ khí có chỉ số chung, ai cũng cầm được; hình hiện theo tài năng người cầm. Nhìn dáng vũ khí là biết vai trò, còn rơi đồ, rèn và chợ không phải chia 8 loại. Icon trong túi là một trong 60 kiểu vũ khí có tên riêng (mục 12); cầm lên mới hiện dáng theo tài năng (người dùng chốt 2026-11-03). Người có 2 tài năng sau tẩy tủy chọn hình theo một trong hai (đề xuất).
- **Trang bị và y phục (đã chốt).** Trang bị chiến đấu hiện hình của chính nó. Y phục (mục 13) mặc vào ô áo, mũ hoặc vũ khí thì che hình trang bị ở ô đó, không đổi chỉ số; tắt y phục là thấy lại trang bị. Y phục vũ khí chỉ đổi kiểu trong nhóm của tài năng, để vai trò vẫn đọc được.
- **Hình theo độ hiếm (đề xuất).** Mỗi ô có một hình cho mỗi nhóm độ hiếm (lục và lam, tím, vàng và đỏ), không vẽ riêng từng món, để số hình vừa sức một người; thần vật có thể có hình riêng. Icon trong túi thì vẽ riêng cho từng kiểu (mục 12, Kiểu trang bị, độ hiếm và mã vật phẩm). Vũ khí từ +21 có thêm ánh sáng.
- **Đệ tử NPC (đề xuất).** Thân, áo và mũ ngẫu nhiên; vũ khí hiện theo tài năng như người chơi.

| Tài năng | Nhóm vũ khí hiện trên người (đề xuất) |
|---|---|
| Tu thể | Quyền giáp |
| Tu pháp | Pháp trượng |
| Tu trận | Trận bàn |
| Tu đan | Hồ lô |
| Sát thủ | Song chủy thủ |
| Tu rèn | Búa rèn |
| Tu dược | Liềm hái thuốc |
| Tu kim tiền | Bàn tính |

Mỗi nhóm một dáng khác hẳn, để nhận ra tài năng cả khi nhân vật nhỏ trên màn hình điện thoại (mục 15).

### Thú cưỡi

Mỗi người chơi giữ tối đa 5 thú: 1 con làm thú cưỡi để tăng tốc hành trình và công thành, cả 5 con cộng chỉ số cho chủ. Thú lên 4 đại cảnh giới × 20 tiểu cảnh giới bằng linh đơn, và 5 thú đúng tổ hợp thì kích phát hiệu ứng riêng.

**Đã chốt:** 100 loài; 4 đại cảnh giới × 20 tiểu cảnh giới; 5 thú mỗi người; ghép kích phát; luyện linh đơn. Phần này khớp với các chỗ GDD đã nhắc: thú cưỡi tăng tốc hành trình (mục 3), linh thú công thành 400 / 1.000 / 2.500 / 6.000 mỗi phút theo đại cảnh giới (mục 10), Yêu Thú Sào Huyệt rơi thú cưỡi hiếm (mục 11). Mọi con số khác trong phần này là đề xuất, chờ bạn duyệt.

**Phục vụ trụ cột (mục 2):** Trí hơn lực, vì tổ hợp kích phát theo hệ và khắc chế; Không ai tu tiên một mình, vì công thành, hộ tống, hộ pháp thú kiếp và linh đơn cấp cao đều cần cả tông môn.

**5 thú mỗi người.** Mỗi người chơi sở hữu tối đa 5 thú, không có chuồng chứa thêm. Cả 5 thú đều cộng chỉ số cho chủ; chủ chọn 1 con làm thú cưỡi, đổi được khi đang ở thành chủ hoặc sơn môn. Muốn nhận thú thứ 6 thì phải phóng sinh, bán, hoặc luyện hóa 1 con thành linh đơn. Trứng thú trong túi không tính vào 5; trứng nở khi đã đủ 5 thú thì phải trống 1 ô trước.

**Trần lực chiến từ thú.** Chỉ số thú và hiệu ứng kích phát cộng lại không quá khoảng 15% lực chiến. Cùng trần 35% của đồ (mục 13), phần từ cấp, cảnh giới, công pháp và tài năng vẫn chiếm ít nhất một nửa.

**100 loài (đề xuất).** 12 hệ, mỗi hệ 8 loài, cộng 4 Tứ Tượng, đủ 100. Hệ của thú quyết định tổ hợp kích phát; phẩm loài quyết định thú cộng bao nhiêu chỉ số và gặp ở vị diện nào.

| Phẩm loài | Số loài | Gặp ở | Cộng chỉ số mỗi thú ở đỉnh (Thông Thiên tầng 20) | Bán trên chợ |
|---|---|---|---|---|
| Phàm | 36 (3 mỗi hệ) | Hạ vị | 0,8% | Được, nếu chưa lên Hóa Hình |
| Linh | 24 (2 mỗi hệ) | Hạ vị (hiếm), Trung vị | 1,2% | Được, nếu chưa lên Hóa Hình |
| Huyền | 24 (2 mỗi hệ) | Trung vị, Thần vực; Yêu Thú Sào Huyệt ở Hạ vị | 1,6% | Không, khóa vào nhân vật |
| Thiên | 12 (1 mỗi hệ) | Thần vực, Thánh vực; Yêu Thú Sào Huyệt ở Trung vị | 2,0% | Không |
| Thần | 4 (Tứ Tượng) | Chỉ Thánh vực | 2,4% | Không |

“Cộng chỉ số” là % máu, công và phòng của chủ, tăng đều theo 80 tiểu cảnh giới. Đủ 5 thú Thiên phẩm ở đỉnh là +10%; 4 Tứ Tượng cùng 1 thú Thiên phẩm là +11,6%; phần còn lại tới trần 15% dành cho kích phát.

| Hệ | Phàm | Linh | Huyền | Thiên |
|---|---|---|---|---|
| Kim | Thiết Bối Ngưu, Kim Tông Mã, Đồng Trảo Ưng | Ngân Lân Báo, Kiếm Vũ Điêu | Kim Giáp Quy, Liệt Kim Sư | Tỳ Hưu |
| Mộc | Thanh Lộc, Đằng Giáp Quy, Bích Vũ Tước | Cổ Thụ Hùng, Thanh Linh Hạc | Thanh Mộc Giao, Lục Mao Sư | Cửu Sắc Lộc |
| Thủy | Bích Thủy Quy, Thủy Ngưu, Bạch Âu | Lam Lân Giao, Bích Ba Báo | Huyền Thủy Kình, Thủy Vân Hạc | Bắc Minh Côn |
| Hỏa | Hỏa Tông Mã, Xích Diễm Lang, Hỏa Nha | Viêm Giáp Ngưu, Xích Vũ Điêu | Dung Nham Giao, Liệt Diễm Hổ | Tất Phương |
| Thổ | Hoàng Sa Đà, Thạch Bì Tượng, Nham Ưng | Nham Giáp Tê, Hoàng Hà Ngạc | Địa Long Tích, Trấn Nhạc Hùng | Kỳ Lân |
| Lôi | Thiểm Điện Báo, Lôi Âm Lang, Lôi Tước | Tử Điện Điêu, Điện Văn Giao | Cửu Tiêu Lôi Ưng, Lôi Giác Tê | Quỳ Ngưu |
| Phong | Truy Phong Mã, Phong Linh Hồ, Thanh Phong Yến | Cuồng Phong Lang, Ngự Phong Hạc | Lăng Vân Điêu, Toàn Phong Giao | Phù Diêu Bằng |
| Quang | Bạch Ngọc Mã, Minh Quang Tước, Thần Hi Dương | Diệu Nhật Sư, Thải Vân Loan | Ngân Quang Kình, Bạch Hồng Hạc | Bạch Trạch |
| Âm lãnh | U Minh Lang, Âm Nha, Hắc Đầm Ngạc | U Hồn Báo, Huyết Bức | Minh Hà Giao, Âm Phong Mã | Cửu Vĩ Hồ |
| Cực dương | Xích Sa Đà, Dương Viêm Tích, Diệm Linh Ưng | Phần Thiên Sư, Thái Dương Điêu | Liệt Dương Tê, Viêm Dương Giao | Kim Ô |
| Cực âm | Thi Cốt Mã, Âm Độc Hạt, Quỷ Kiêu | Phệ Hồn Mãng, U Uyên Ngạc | Cửu U Ma Hổ, Huyết Đồng Điêu | Thao Thiết |
| Cực hàn | Tuyết Lang, Hàn Mao Tượng, Sương Vũ Tước | Tuyết Báo, Hàn Băng Giao | Huyền Băng Hùng, Băng Phách Ưng | Băng Phượng |

**Tứ Tượng** (phẩm Thần): Thanh Long hệ Mộc, Bạch Hổ hệ Kim, Chu Tước hệ Hỏa, Huyền Vũ hệ Thủy.

**Ba dáng**, đọc theo tên con vật: chim (ưng, điêu, hạc, tước, yến, âu, nha, loan, phượng, bằng, kiêu, bức, cùng Tất Phương, Kim Ô, Thanh Long, Chu Tước) là phi cầm; giao, quy, kình, ngạc, côn và Huyền Vũ là thủy thú; còn lại là tẩu thú. Dáng đổi cách thú đi đường, xem phần hành trình bên dưới.

Tên và số ở đây nằm ở các sheet Thú cưỡi, Thú phẩm, Thú cảnh giới, Thú kích phát và Linh đơn của file số liệu (mục 1). Mọi số trong đó vẫn là đề xuất, chờ bạn duyệt.

**4 đại cảnh giới × 20 tiểu cảnh giới.** Mỗi thú có 80 tiểu cảnh giới, chia 4 đại cảnh giới. Tiểu cảnh giới tăng bằng tu vi thú; qua mỗi đại cảnh giới phải đột phá. Ở Hạ vị, đại cảnh giới mở theo cấp của chủ để thú không vượt sức người cưỡi; từ Trung vị trở lên mở đủ 4. Tên, mốc và số dưới đây là đề xuất, trừ cột công thành lấy từ mục 10.

| Đại cảnh giới | Tiểu cảnh giới | Mở ở Hạ vị khi chủ đạt | Tốc độ hành trình khi cưỡi | Linh thú công thành (mục 10) | Cộng chỉ số ở tầng cuối (Phàm → Thần) |
|---|---|---|---|---|---|
| 1. Khai Linh | 1–20 | Cấp 1 | ×1,2 | 400 mỗi phút | 0,2% → 0,6% |
| 2. Ngưng Đan | 21–40 | Cấp 50 | ×1,4 | 1.000 mỗi phút | 0,4% → 1,2% |
| 3. Hóa Hình | 41–60 | Cấp 100 | ×1,6 | 2.500 mỗi phút | 0,6% → 1,8% |
| 4. Thông Thiên | 61–80 | Cấp 150 | ×1,8 | 6.000 mỗi phút | 0,8% → 2,4% |

Mốc mở cấp 50 / 100 / 150 khớp các ví dụ công thành ở mục 10: người chơi cấp 50 dùng thú Ngưng Đan, người chơi cấp 150–200 dùng thú Hóa Hình hoặc Thông Thiên. Sức công thành chỉ theo đại cảnh giới, không theo phẩm loài.

**Tu vi thú.** Thú trong 5 ô nhận tu vi bằng 10% kinh nghiệm chủ nhận được (ở thượng vị là 10% tu vi), nhân linh khí vị diện. Phần lớn tu vi đến từ Dưỡng Linh Đơn. Mục tiêu cân bằng: người chơi đều đặn đưa một thú từ Khai Linh tầng 1 lên Thông Thiên trong khoảng 90 ngày ở Hạ vị.

**Thú kiếp.** Đột phá từ tầng 20 lên 21, 40 lên 41 và 60 lên 61 phải qua thú kiếp, theo cùng khuôn đột phá ở mục 7:

- Tỷ lệ gốc: vào Ngưng Đan 60%, vào Hóa Hình 40%, vào Thông Thiên 25%.
- Bắt buộc dùng Phá Cảnh Đơn đúng cấp; đơn phẩm cao cộng thêm 5–15%.
- Mỗi thành viên tông môn hộ pháp cộng 3%, tối đa 5 người; đột phá trong bí cảnh cùng hệ với thú cộng 10%. Tổng tỷ lệ tối đa 80%.
- Thất bại mất Phá Cảnh Đơn và 20% tu vi đang tích, không tụt tầng.

**Ghép kích phát.** 5 thú đang giữ hợp thành một bộ; bộ đủ điều kiện thì tự kích phát hiệu ứng, không tốn vật phẩm. Tổ hợp tính trên cả 5 ô, nên đổi thú cưỡi không làm mất tổ hợp. Một loài giữ 2 con chỉ tính 1 lần cho tổ hợp. Bảng dưới là đề xuất:

| Tổ hợp | Điều kiện trong 5 ô | Hiệu ứng |
|---|---|---|
| Đồng hệ | 3 loài cùng hệ | Công pháp hệ đó +3% sát thương |
| Thuần hệ | Cả 5 loài cùng hệ | Thay Đồng hệ: công pháp hệ đó +6% sát thương; nhận sát thương từ hệ khắc mình −5% |
| Gốc và biến | 1 hệ gốc + biến dị của nó (Kim + Lôi, Mộc + Phong, Thủy + Cực hàn, Hỏa + Cực dương, Thổ + Cực âm) | Công pháp của hai hệ đó +2% sát thương |
| Đối cực | Cực dương + Cực âm, hoặc Quang + Âm lãnh | Đòn đối cực ×1,5 thành ×1,55 |
| Ngũ Hành tương sinh | Đủ 5 hệ Kim, Mộc, Thủy, Hỏa, Thổ | +2% máu, công, phòng; nhận sát thương từ hệ khắc mình −5% |
| Đồng dáng | Cả 5 thú cùng dáng | Tẩu thú: đoàn hộ tống +20% tốc độ. Phi cầm: xác suất gặp sự kiện mỗi chặng −10%. Thủy thú: qua bến đò không phải chờ |
| Tứ Tượng | Đủ Thanh Long, Bạch Hổ, Chu Tước, Huyền Vũ | +3% máu, công, phòng; party cùng hành trình +1% |

Các tổ hợp khác loại hiệu ứng thì cộng dồn; phần máu, công, phòng từ thú và kích phát chặn ở 15%. Bộ thuần hệ mạnh về một hệ, bộ Tứ Tượng cộng Kỳ Lân đạt trần chỉ số, nên người chơi phải chọn theo công pháp của tông môn và đối thủ hay gặp.

**Luyện linh đơn.** Linh đơn là đan dành cho thú, luyện ở Luyện Đan Phòng theo cùng luật luyện đan sư và lô đỉnh ở mục 12, dùng chung thang cấp 1–10 của đan dược. Đề xuất 3 loại:

| Linh đơn | Cấp | Công dụng | Nguyên liệu chính | Chợ |
|---|---|---|---|---|
| Dưỡng Linh Đơn | 1–8, theo đại cảnh giới của thú | Tăng tu vi thú | Đan thú (Thú Lâm), dược liệu | Bán được |
| Phá Cảnh Đơn | 3 vào Ngưng Đan, 6 vào Hóa Hình, 8 vào Thông Thiên | Bắt buộc khi qua thú kiếp | Đan thú phẩm cao, dược liệu hiếm | Cấp 3 bán được; cấp 6 và 8 khóa vào nhân vật |
| Hồi Linh Đơn | 1–5 | Chữa thú bị thương ngay | Dược liệu | Bán được |

- Phá Cảnh Đơn cấp 8 phải do luyện đan sư người chơi luyện, vì NPC luyện đan sư chỉ tới cấp 7 (mục 10). Muốn có thú Thông Thiên, tông môn cần Tu đan và lô đỉnh cấp 8.
- Mỗi thú dùng tối đa 10 Dưỡng Linh Đơn mỗi ngày, theo nguyên tắc không mua được thời gian (mục 13).
- **Luyện hóa thú:** đưa 1 thú vào lô đỉnh để nhận lại Dưỡng Linh Đơn, bằng khoảng 50% số đơn đã nuôi nó, cộng 5 / 10 / 20 / 40 viên theo phẩm Phàm / Linh / Huyền / Thiên. Tu đan được thêm 15% như sản lượng luyện đan ở mục 6. Tứ Tượng không luyện hóa được.
- Luyện hóa là lối ra cho thú thừa khi đã đủ 5 con, và là một chỗ hút tài nguyên ra khỏi nền kinh tế (mục 12), vì nửa số đơn đã nuôi mất đi.

**Nguồn thú (đề xuất).** Thú đến từ bản đồ và bí cảnh, không từ cửa hàng. Phẩm ra theo bảng phẩm loài ở trên.

| Nguồn | Phẩm ra | Cách lấy |
|---|---|---|
| Hang dị thú và dị thú trong phần sương mù vừa mở (mục 3) | Phẩm của vị diện | Đánh thắng rồi thuần phục ngay tại chỗ |
| Thú Lâm (mục 11) | Phẩm của vị diện | Rơi trứng thú cùng đan thú; trứng ấp 24 giờ |
| Yêu Thú Sào Huyệt (mục 11) | Huyền ở Hạ vị, Thiên từ Trung vị trở lên | Rơi trứng thú hiếm; thú nở ra khóa vào nhân vật |
| Yêu Triều (mục 17) | Phẩm của vị diện | Phần thưởng giữ đất trong mùa |
| Chợ chung | Phàm, Linh | Mua của người chơi khác bằng linh thạch |
| Boss Tứ Tượng ở Thánh vực | Thần | Liên minh cùng đánh; mỗi thế giới mỗi mùa chỉ rơi 1 trứng mỗi loài |

- **Thuần phục:** tỷ lệ gốc 20%, mỗi cấp chủ cao hơn dị thú cộng 1%, tối đa 50%; ở thượng vị so theo cảnh giới. Ngự Thú Phù bán bằng linh thạch cộng 5%, 10% hoặc 15% theo phẩm, chung trần +15% của phù ở mục 13. Thất bại thì dị thú bỏ chạy.
- Đi party thì người gây sát thương nhiều nhất được thuần phục; mỗi dị thú chỉ thuần phục được 1 lần.
- Tần suất dị thú và trứng thú nằm trong cơ chế cân bằng tỷ lệ rơi ở mục 12, có trần chung theo vùng.

**Trên đường và trong chiến tranh (đề xuất):**

- **Dáng khi đi đường:** tẩu thú đi theo tốc độ ở bảng cảnh giới; phi cầm nhanh thêm 10% nhưng không kéo hàng; thủy thú đi chặng qua sông, bến đò và ven hồ nhanh gấp đôi. Mọi dáng vẫn bị đèo và bến đò của tông môn khác chặn (mục 5).
- **Hộ tống đỉnh vô chủ (mục 12):** đoàn có ít nhất 5 tẩu thú từ Hóa Hình trở lên đi bằng 75% tốc độ thường thay vì 50%.
- **Công thành:** mỗi người chơi tham gia góp thú cưỡi của mình làm 1 linh thú công thành, sức phá trận theo bảng cảnh giới. Mỗi thú phá trận tối đa 30 phút mỗi tối chiến tranh.
- **Tử vong và đồ sát:** chủ chết thì thú không rơi và không bị cướp. Thú cưỡi bị thương, đi chậm như đi bộ trong 2 giờ hoặc tới khi dùng Hồi Linh Đơn. Ra lao tù thành chủ mất đồ đang mặc nhưng không mất thú.
- **Phản bội và xuất sư:** thú là của người chơi, đi theo người.

**Chợ và tiền (theo mục 13):**

- Không bán bằng tiền hay tiên ngọc: thú, trứng, linh đơn, Ngự Thú Phù, lượt thuần phục.
- Bán trên chợ bằng linh thạch: thú Phàm và Linh chưa lên Hóa Hình, trứng Phàm và Linh, Dưỡng Linh Đơn, Hồi Linh Đơn, Phá Cảnh Đơn cấp 3, Ngự Thú Phù. Người nạp mua những thứ này cũng chỉ qua linh thạch, nên vẫn chịu hạn mức đổi ở mục 13.
- Khóa vào nhân vật: thú từ phẩm Huyền trở lên, mọi thú đã lên Hóa Hình (để không bán được thời gian nuôi), trứng Yêu Thú Sào Huyệt, Phá Cảnh Đơn cấp 6 và 8.
- Tiền chỉ mua vẻ ngoài: skin thú cưỡi, cùng nhóm với y phục và phi kiếm ở mục 13. Skin không đổi chỉ số, tốc độ hay dáng.

**Thăng vị diện:** thú đi theo chủ, giữ phẩm và cảnh giới như pháp bảo. Ở vị diện mới, linh khí ×4 / ×8 / ×12 nhân phần tu vi thú nhận từ chủ.

**Mỹ thuật và phạm vi:** mỗi loài 1 hình gốc; cảnh giới thể hiện bằng hào quang và hiệu ứng, không vẽ lại, nên cần 100 hình thay vì 400. MVP chỉ có Hạ vị (mục 18), nên đề xuất ra trước 36 loài Phàm, 24 loài Linh và 12 loài Huyền (1 mỗi hệ) cho Yêu Thú Sào Huyệt, tổng 72 hình; Thiên và Tứ Tượng làm sau.

**Tăng trưởng, bổ trợ, phát triển (đề xuất 2026-11-05):** tư chất 1–5 sao, tu vi từng tầng, thú hộ chủ ra thú kỹ theo hệ trong trận, huyết mạch ở Hóa Hình, 14 thiên phú học từ Thú Quyết và truyền thừa khi luyện hóa nằm ở tab Thú: tăng trưởng, bổ trợ, phát triển. Lớp đó không đổi gì đã chốt ở phần này và vẫn nằm trong trần 15% lực chiến từ thú.

## 7. Tu luyện, linh khí và thăng vị diện

Linh khí của vị diện nhân thẳng vào tốc độ tu luyện: Hạ ×1, Trung ×4, Thần ×8, Thánh ×12. Ở Hạ và Trung vị, linh khí đẩy nhanh việc lên cấp; ở Thần vực và Thánh vực, linh khí đẩy nhanh việc tích tu vi để nâng chiêu thức.

| Vị diện | Cấp nhân vật | Cảnh giới | Cách tiến |
|---|---|---|---|
| Hạ vị diện | 1–250 | Luyện Khí (1–50), Trúc Cơ (51–100), Kết Đan (101–150), Nguyên Anh (151–200), Hóa Thần (201–250) | Lên cấp bằng tu luyện, nhiệm vụ và chiến đấu |
| Trung vị diện | 1–200, cấp đếm lại từ 1 | Luyện Hư (1–100), Hợp Thể (101–200) | Lên cấp như Hạ vị; chỉ số của 250 cấp Hạ vị được giữ và cộng dồn |
| Thần vực | Không còn cấp | Đại Thừa, Độ Kiếp | Tu luyện tích tu vi, đột phá từng điểm chiêu thức |
| Thánh vực | Không còn cấp | Chân Tiên | Như Thần vực |

**Tu luyện ở thượng vị (Thần vực và Thánh vực).** Nhân vật không còn lên cấp. Bế quan, linh tuyền và hộ pháp tích tu vi; tu vi đổi thành điểm để nâng từng chiêu thức trong các công pháp đang mang vào trận. Mỗi điểm chiêu thức là một lần đột phá:

- Tỷ lệ thành công gốc 30%.
- Bắt buộc phục dụng đan dược trước khi đột phá; đan phẩm cao cộng thêm tỷ lệ.
- Đột phá bên trong bí cảnh hoặc phó bản ngẫu nhiên cùng nguyên tố với chiêu thức được cộng thêm may mắn.
- Mỗi lần đột phá, thiên đạo giáng lôi kiếp. Người chơi phải chuẩn bị đan dược và phù chống sét; không chịu hết lôi kiếp thì lần đó thất bại.

Số đề xuất, chờ bạn duyệt: đan dược +5% đến +15% theo phẩm; cùng nguyên tố +10%; tổng tỷ lệ tối đa 80%. Thất bại mất đan dược đã dùng và 20% tu vi đang tích, không mất điểm chiêu thức đã có.

Đột phá cảnh giới cá nhân vẫn có thiên kiếp nhỏ như bản trước; thành viên tông môn hộ pháp được.

**Không có thăng vị cá nhân (đã chốt).** Người chơi chỉ lên vị diện cao hơn khi tông môn của mình phi thăng. Không có vật phẩm, nhiệm vụ, gói nạp hay Truyền Tống Trận nào đưa một người lên một mình; Truyền Tống Trận chỉ dịch chuyển trong cùng vị diện. Người chơi cũng chỉ gia nhập được tông môn cùng vị diện, nên không thể đổi sang tông môn ở vị diện cao hơn để đi tắt. Ai rời tông môn ở một vị diện (xuất sư hay phản bội) thì ở lại vị diện đó.

**Thăng vị diện (phi thăng cả môn):**

1. Tông môn đạt cấp 200 và xây Phi Thăng Đài.
2. Tông chủ khởi động thiên kiếp toàn môn: 5 đợt lôi kiếp đánh vào Chính Điện, thành viên và đồng minh cùng hộ pháp.
3. Thành công: cả tông môn lên vị diện kế, rơi vào một vùng ngẫu nhiên của vị diện đó và về lại cấp 1.
4. Thất bại: chỉ mất vật phẩm khởi động, thử lại sau 24 giờ.

| Được giữ khi thăng vị | Mất khi thăng vị |
|---|---|
| Thành viên, chỉ số và tài năng nhân vật (cấp về 1 khi lên Trung vị) | Toàn bộ lãnh thổ, mỏ và bí cảnh đang chiếm |
| Tàn quyển, công pháp, pháp bảo | Cấp tông môn (về 1) và cấp công trình |
| 10% linh thạch, đổi sang phẩm cao hơn theo tỷ giá 100 : 1 | Liên minh ở vị diện cũ |

Vị trí mới ngẫu nhiên đúng theo yêu cầu. Đề xuất thêm: chỉ rơi vào vị trí sơn môn còn trống, xa sơn môn của tông môn mạnh hơn quá tầm Truyền Tống Trận lớn nhất của vị diện đó (ở Hạ vị là hơn 5 chặng), và có khiên 7 ngày như tông môn mới.

## 8. Chiến đấu và khắc chế nguyên tố

Trận đấu là combat thời gian thực (chốt 2026-11-09, trước là mô phỏng tự động tách màn). Người chơi điều khiển nhân vật của mình: di chuyển, chọn mục tiêu và tung chiêu từ 4 ô công pháp mang vào trận, kèm đánh thường và nút pháp bảo. Auto đầy đủ theo chuẩn MMORPG mobile: bật auto thì nhân vật tự chọn mục tiêu, tự ra chiêu theo ưu tiên đã xếp, tự dùng đan — người chơi can thiệp tay bất cứ lúc nào. Khi người chơi offline hoặc ủy thác, nhân vật và đệ tử NPC do AI của server điều khiển theo đúng bộ auto đó, nên luật "không cần online" của các trận tông môn vẫn giữ. Mọi trận có trọng trách (PvP, boss, tranh điểm, Chính Điện, bí cảnh) do server tính bằng chính thư viện mô phỏng chạy thời gian thực 20 tick mỗi giây (mục 16), client chỉ gửi input; vì vậy toàn bộ số đã cân (10 loại chiêu, hệ khắc, hợp trận, chênh cấp) chuyển nguyên sang thời gian thực: hồi chiêu thành cooldown, vận công và bày trận vẫn tính bằng giây.

**Độ dài trận (đã chốt):** một trận kéo dài trung bình khoảng 30 giây. Chỉ số chuẩn của nhân vật theo cấp được chỉnh để giữ mức này ở mọi cấp.

**Chống hòa (đề xuất):** trận kéo quá 45 giây thì mọi sát thương tăng 20% mỗi 5 giây, cộng dồn; hồi máu không tăng. Hết 90 giây mà chưa phân thắng bại thì hòa. Đo bằng đội mẫu: hòa còn khoảng 0,3% ở trận 10 đấu 10.

*[Hình nhúng: Ngũ Hành · 5 hệ, 5 cặp sinh, 5 cặp khắc — xem bản gốc trên Claude Docs]*

Đội hình nào cũng có một hệ khắc nó, nên người tấn công phải do thám trận địch (xem trực tiếp trên map hoặc xem lại chiến báo) rồi mới chọn công pháp và đội đánh.

**Chọn mục tiêu thời gian thực.** Cột "Mục tiêu" trong bảng 10 loại chiêu bên dưới nay là luật nhắm của auto và giới hạn của chiêu: chiêu đơn đánh mục tiêu đang chọn (auto ưu tiên gần và ít máu), chiêu quét và diện rộng đánh vùng quanh điểm chỉ định, hộ thể và hồi phục chọn đồng đội ít máu nhất trong tầm. Người chơi tắt auto thì tự chỉ điểm đổ và mục tiêu.

**Luật khắc chế 12 hệ** (hệ số sát thương; ma trận đủ 12 × 12 ở sheet Khắc chế; Ngũ Hành vẫn là vòng gốc, 7 hệ còn lại gắn vào vòng này theo luật bên dưới):

- Ngũ Hành khắc: ×1,5; bị khắc: ×0,7.
- Hệ biến dị thừa hưởng quan hệ khắc của hệ gốc: Lôi như Kim, Phong như Mộc, Cực hàn như Thủy, Cực dương như Hỏa, Cực âm như Thổ.
- Biến dị đánh hệ gốc ×1,2; hệ gốc đánh biến dị ×0,9.
- Đối cực hai chiều ×1,5: Cực dương ↔ Cực âm, Quang ↔ Âm lãnh.
- Thiên địa dị hệ khắc một chiều (đề xuất 2026-11-02), ×1,5 / ×0,7 như Ngũ Hành, theo vòng Hỏa → Âm lãnh → Kim → Quang → Hỏa: lửa xua âm khí, hàn âm làm kim khí giòn gãy, gương kim khí phản quang, thánh quang tịnh hóa lửa. Hệ biến dị thừa hưởng (Lôi như Kim, Cực dương như Hỏa). Chỉ áp trong trận, không đổi quan hệ tổ hợp ở mục 9. Lý do: trước đây Quang và Âm lãnh chỉ khắc nhau hai chiều nên không hệ nào khắc chúng một chiều; với vòng này, đội yếu hơn 15% đúng hệ khắc thắng 84–97% tùy đội hình (số đo mới 2026-11-04, thay câu "trên 97%" của bản cũ).
- Các cặp còn lại ×1,0.

**10 loại chiêu và luật đánh đổi:**

| Loại chiêu | Sát thương | Mục tiêu | Hồi chiêu | Luật đánh đổi |
|---|---|---|---|---|
| Cận chiến đơn | ×1,30 | 1 | 1 s | Mạnh nhất đơn mục tiêu, phải áp sát và chịu đòn |
| Cận chiến quét | ×1,00 | 5 | 2 s | Nhiều mục tiêu gần, sát thương mỗi mục tiêu thấp hơn đòn đơn |
| Tầm xa | ×0,95 | 2 | 1 s | An toàn, +4% chí mạng, nhưng yếu hơn cận chiến |
| Diện rộng | ×0,50 | 10 | 4 s | Đánh rộng thì yếu; vận công 1 s, bị khống chế là mất chiêu |
| Hộ thể | ×0,20 | 3 đồng đội | 8 s | Khiên bằng 120% sát thương gốc, gần như không gây sát thương |
| Bùa chú | ×3,00 | 1 | 4 s | Rất mạnh nhưng chỉ 3 lần mỗi trận |
| Trận pháp | ×4,30 | 6 | 12 s | Bày 5 s; địch bước vào có 15% bị tuyệt sát (trừ boss và đối thủ cảnh giới cao hơn); đồng đội cùng bày thì hợp trận |
| Hồi phục | Hồi ×0,90 | 3 đồng đội | 6 s | Tốn mana gấp 3, hồi mana −20% khi đang vận |
| Khống chế | ×0,65 | 1 | 3 s | Choáng 1,5 s; khống chế liên tiếp cùng mục tiêu thì giảm một nửa |
| Thân pháp | ×1,60 | 1 | 8 s | Lướt tới, đòn đầu +10% chí mạng; sau đó lộ vị trí 3 s |

**Đòn ngoại và đòn nội (người dùng chốt 2026-11-05).** Cận chiến đơn, cận chiến quét, tầm xa và thân pháp gây đòn ngoại, giảm theo thủ ngoại. Diện rộng, bùa chú, trận pháp và khống chế gây đòn nội, giảm theo thủ nội. Phần sát thương nhỏ của hộ thể tính là ngoại; hồi phục không gây sát thương. Cả hai dùng công thức phòng thủ hiện có; xuyên giáp bỏ qua phòng thủ đúng loại của đòn. Phòng thủ gốc của nhân vật chia thành thủ ngoại và thủ nội, mỗi loại bằng phòng thủ chuẩn cũ, nên trận không đồ không đổi. Đồ và set cộng từng loại riêng (tab Trang bị, pháp bảo và set đồ, phần 14.2).

**Cân 10 loại chiêu (người dùng duyệt 2026-11-05; số vẫn là đề xuất).** Đội chỉ mang chiêu nội thua đội chỉ mang chiêu ngoại (40,6% khi không đồ, 32,8% khi đồ đỉnh), vì hai nhóm bị giới hạn bởi hai thứ khác nhau. Chiêu ngoại dồn sát thương bằng mana đầu trận; chiêu nội rẻ mana nhưng ra chậm. Trận ngắn (15–17 giây) thì ngoại thắng, trận dài thì nội thắng. Trận pháp lần đầu kích lúc 15 giây, khi trận gần xong. Khống chế gần như không làm đội ngoại mất gì, vì khi bị choáng hồi chiêu và mana vẫn chạy. Đề xuất: chiêu nội ra sớm hơn và tốn mana hơn, giữ nguyên mọi luật đánh đổi ở bảng trên; nhóm ngoại không đổi.

| Loại chiêu | Sát thương | Hồi chiêu | Mana |
|---|---|---|---|
| Diện rộng | ×0,60 → ×0,50 | 4 s (giữ) | 35 → 70 |
| Bùa chú | ×3,00 (giữ) | 6 s → 4 s | 160 → 200 |
| Trận pháp | ×6,00 → ×4,30 | 20 s → 12 s | 240 → 280 |
| Khống chế | ×0,50 → ×0,65 | 6 s → 3 s | 10 → 60 |

- Kèm theo hai chỉnh nhỏ (đề xuất), vì chiêu nội tốn mana hơn làm mọi nguồn giảm mana mạnh lên:
  - Thủy "Mana −10%" còn −5% (mục 9). Không chỉnh thì Thủy + Thủy lên 70%, vượt ngưỡng 65%.
  - Văn Uyên mốc 4 giảm mana thi triển 6% còn 4,5% (tab Trang bị, pháp bảo và set đồ, phần 14.4). Không chỉnh thì lộ Nội Công +5,9%.
- Đo 400 cặp:
  - Nội đấu ngoại 52,4% khi không đồ, 48,3% khi đồ đỉnh.
  - Bốn loại chiêu nội, khi đứng ưu tiên 1 trong đội chỉ nội, nằm trong 44–55% (trước 23–57).
  - Công cụ cân bằng vẫn đạt hai tiêu chí; trận cùng sức dài 25 giây (trước 22,5).
- Vòng khắc 7 lộ của set đồ (phần 14.7):
  - 10/10 cặp đúng chiều (trước 9/10); 5/10 vào 55–65%.
  - 7 lộ trong 3,9–5,5; đỉnh 34,8%.
  - Ngoại Công đấu Nội Công khi mỗi bên mang đúng loại đòn: 80,5% còn 55,3%.
- Đã sửa bảng trên, đoạn Hợp trận và bảng hệ ở mục 9. File số liệu giao phiên bảng số liệu, mô phỏng giao phiên Sprint (2026-11-05).

**Hợp trận (đã chốt 2026-11-04).** Trận pháp gồng 5 s nên một người đánh ×4,30, hồi chiêu 12 s (người dùng duyệt 2026-11-05 khi cân 10 loại chiêu; trước là ×6,00 hồi chiêu 20 s, trước nữa ×5,00). Đồng đội cùng bày trận pháp chồng lên nhau thì nhập thành một trận, kích một lần khi người cuối bày xong. Sát thương bằng tổng sát thương của từng người nhân hệ số hợp trận:

| Số người | Tên trận | Hệ số |
|---|---|---|
| 2 | Lưỡng Nghi | ×1,3 |
| 3–4 | Tam Tài | ×1,6 |
| 5 trở lên | Ngũ Hành | ×2,0 |

Cách hiểu trong mô phỏng (đề xuất): tâm hai trận cách nhau không quá 2 ô, trận trước chưa kích, và người vào sau bày xong không muộn hơn người xong sớm nhất của trận quá 1 s thì nhập (muộn hơn thì bày trận riêng); 4 người tính mức Tam Tài. Mục tiêu lấy theo tâm của người bày đầu tiên; trận chung đánh thêm 2 mục tiêu cho mỗi người thêm, tối đa 10. Tuyệt sát mỗi mục tiêu chỉ tung một lần cho cả trận: 15% cộng phần tuyệt sát cao nhất trong nhóm (Tu trận), xét cảnh giới theo người cao nhất nhóm. Người bày xong trước đứng chờ, không ra chiêu khác, tới khi trận kích; ai chết thì rời trận. Bị khống chế vẫn không mất trận. Giới hạn chờ 1 s và thêm mục tiêu được duyệt ngày 2026-11-04 sau khi đo công cụ cân bằng: không có hai điều này, đội dồn trận pháp chỉ thắng 35% vì người bày xong phải đứng chờ; có cả hai thì thắng 42%.

**Phòng thủ Chính Điện:** Hộ Sơn Đại Trận gồm các trận nhãn theo hệ, nối thành đại trận như bản trước; bậc trận, đại trận tông môn và Hộ Sơn Đại Trận cấp cao ở mục 10. Trong chiến tranh, trận tranh mỏ, bí cảnh và Chính Điện đều là trận thời gian thực giữa đội hai bên tại khu vực điểm đó, tối đa 10 đấu 10 trong phòng chiến của điểm (mục 10).

**Chênh lệch cấp (đã chốt).** Khi chênh nhau 10, 20, 30 cấp, bên cảnh giới thấp vẫn gây được thương tổn cho bên cấp cao để không bị áp đảo hoàn toàn. Đề xuất: sát thương của bên cấp thấp lên bên cấp cao nhân hệ số 1 − 0,015 × số cấp chênh, không thấp hơn 0,55 (chênh 10 cấp còn 85%, chênh 20 cấp còn 70%, từ 30 cấp trở lên giữ ở 55%); bên cấp cao đánh bên cấp thấp được cộng 1% mỗi cấp chênh, tối đa +30%. Luật này áp dụng cho trận giữa người chơi, NPC và đội chiến; đòn phá trận riêng ở mục 10 vẫn tính theo cấp².

## 9. Tàn quyển và công pháp

Công pháp không có sẵn: tông môn nhặt tàn quyển trong bí cảnh rồi ghép thành công pháp riêng. Có 480 tàn quyển (12 hệ × 10 loại chiêu × 4 biến thể, mỗi hệ 40 cái) và 300 công pháp mẫu trong file Excel.

**Tàn quyển:**

- Mỗi tàn quyển mang 1 hệ, 1 loại chiêu và 1 biến thể: Bạo (+10% sát thương), Tốc (−10% hồi chiêu, +2% chí mạng), Linh (hiệu ứng đặc trưng +50%), Bền (−25% mana).
- Phẩm 1–10 được quay khi rơi, theo vị diện của bí cảnh (mục 11).
- Tên ghép từ hệ và loại chiêu, ví dụ Lôi Đình Trảm, Cửu Tiêu Cuồng Vũ, U Lãnh Chỉ.
- Mọi tàn quyển cùng hệ mang chung một hiệu ứng đặc trưng và một buff khi luyện đúng hệ:

| Hệ | Hiệu ứng đặc trưng | Chỉ số kèm | Buff khi luyện đúng hệ |
|---|---|---|---|
| Kim | Xuyên giáp 10% | Chí mạng +2% | Sát thương chí mạng +12% |
| Mộc | Trói chân 1 s | — | Hồi máu nhận được +10% |
| Thủy | Làm chậm 20% | Mana −5% (duyệt 2026-11-05, trước là −10%) | Mana tối đa +15% |
| Hỏa | Thiêu đốt 10% mỗi giây trong 3 s | Sát thương +5%, mana +5% | Sát thương +10% |
| Thổ | Khiên bản thân 5% máu tối đa | Sát thương −5% | Máu tối đa +12% |
| Lôi | Tê liệt 0,5 s khi chí mạng | Chí mạng +3% | Tốc độ đánh +8% (đã chốt 2026-11-02, trước là +12%) |
| Phong | Đẩy lùi 1 ô | Hồi chiêu −5% | Giảm hồi chiêu 10% |
| Quang | Hồi máu 2% sát thương gây ra | — | Hiệu quả hồi máu và khiên +15% |
| Âm lãnh | Hút máu 3% | Tầm +1 ô | Hút máu +8% |
| Cực dương | Xuyên kháng 10% | Sát thương +5%, mana +5% | Xuyên kháng +10% |
| Cực âm | Giảm 30% hồi máu của mục tiêu | — | Sát thương theo thời gian +12% |
| Cực hàn | 8% đóng băng 1 s | — | Thời gian khống chế +15% |

**Cách hiểu trong mô phỏng (đề xuất, chỉnh 2026-11-02 theo công cụ cân bằng):**

- Âm lãnh "tầm +1 ô": phụ quyển góp 50% như các chỉ số khác; tầm cộng thêm của một công pháp tối đa 1 ô.
- Âm lãnh "hút máu +8%" khi luyện đúng hệ: tăng 8% hiệu quả hút máu của công pháp (3% thành 3,24%).
- Thổ "khiên bản thân 5% máu tối đa": tối đa một lần mỗi 6 giây.
- Phong "đẩy lùi 1 ô": chỉ chiêu đánh xa đẩy, chiêu cận chiến không đẩy địch ra khỏi tầm của chính mình.
- Thủy "làm chậm 20%": chỉ chậm di chuyển, không chậm hồi chiêu.
- Hệ số tổ hợp: đã chốt bộ thuần ×1,08, tương sinh ×1,05, tương khắc ×0,92, đối cực ×1,12 (bảng dưới). Còn 2 tổ hợp có Lôi làm hệ chủ nhỉnh trên 65%, trong sai số đo.
- Thủy "Mana −10%": người dùng duyệt 2026-11-05 còn −5% (số vẫn là đề xuất), đi cùng cân 10 loại chiêu ở mục 8. Khi chiêu nội tốn mana hơn, giữ −10% thì Thủy + Thủy thắng 70%.

**Ghép công pháp ở Tàng Kinh Các:**

1. Chọn 1 chủ quyển: quyết định loại chiêu và hệ chính.
2. Thêm 1 phụ quyển; từ cấp tông môn 100 được thêm phụ quyển thứ hai. Phụ quyển góp 50% chỉ số (sát thương, chí mạng, hồi chiêu, mana) và 100% hiệu ứng đặc trưng.
3. Phẩm công pháp bằng phẩm thấp nhất trong các tàn quyển đem ghép.
4. Quan hệ giữa hệ chủ và hệ phụ cho ra hệ số tổ hợp:

| Quan hệ | Hệ số | Ví dụ |
|---|---|---|
| Thuần (cùng hệ) | ×1,08 | Lôi + Lôi |
| Tương sinh hoặc tương hợp | ×1,05 | Lôi + Quang, Mộc + Hỏa |
| Trung tính | ×1,00 | Lôi + Âm lãnh |
| Tương khắc | ×0,92 | Kim + Mộc |
| Đối cực hợp nhất | ×1,12, nhưng mana ×1,5 | Cực dương + Cực âm |

Hệ số tổ hợp đã chốt ngày 2026-11-02, thu hẹp từ ×1,15 / 1,10 / 0,85 / 1,25: với bộ cũ, đội dồn một tổ hợp thuần hoặc tương sinh thắng tới 74%, còn tương khắc chỉ 25% (công cụ cân bằng). Vì vậy ví dụ Lôi Quang Liên Hoàn Quyết bên dưới còn 105 thay vì 110.

**Công thức sát thương:**

```latex
D = 100 \times k \times 1.25^{\,g-1} \times \left(1 + s_c + 0.5\,(s_1 + s_2)\right) \times t
```

Trong đó k là hệ số loại chiêu, g là phẩm, s là % sát thương của chủ quyển và hai phụ quyển, t là hệ số tổ hợp. Chí mạng = 5% + chí mạng loại chiêu + chí mạng chủ quyển + 50% của phụ quyển.

**Hai ví dụ của bạn, tính lại bằng công thức** (khớp từng chỉ số):

| Công pháp | Ghép từ | Sát thương | Mục tiêu | Chí mạng | Hồi chiêu | Hiệu ứng |
|---|---|---|---|---|---|---|
| Lôi Quang Liên Hoàn Quyết (Phàm pháp) | Tử Điện Liên Hoàn (Lôi, cận chiến quét, Linh) + Phá Hiểu Cố Bản (Quang, Bền) | 105 | 5 | 8% | 2 s | Hồi máu 2% sát thương; tê liệt 0,75 s khi chí mạng |
| Lôi Âm Châm Quyết (Phàm pháp) | Tử Điện Châm (Lôi, tầm xa, Linh) + Âm Sát Xạ (Âm lãnh, Bền) | 95 | 2 | 12% | 1 s | Hút máu 3%; tê liệt 0,75 s khi chí mạng |

**Phẩm công pháp:** Phàm, Hoàng, Huyền, Địa (Hạ vị) · Thiên, Vương (Trung vị) · Tôn, Tiên, Thần (Thần vực) · Thánh pháp (Thánh vực). Mỗi phẩm mạnh hơn phẩm dưới 25%; Thánh pháp gấp khoảng 7,45 lần Phàm pháp.

**Bộ công pháp tông môn:** Tàng Kinh Các giữ mọi công pháp đã ghép. Tông chủ chọn 12 công pháp làm bộ truyền thụ, thêm 1 suất mỗi 25 cấp tông môn (tối đa 20). Đệ tử chọn 4 trong bộ này để mang vào trận.

## 10. Liên minh và chiến tranh địa bàn

Chiến tranh là tranh điểm trên bản đồ mở: mỏ, linh tuyền, cửa bí cảnh, đèo và Chính Điện. Mọi điểm đều phân thắng thua bằng combat thời gian thực (mục 8): người chơi chạy tới khu vực điểm và đánh trực tiếp; người offline được AI điều khiển theo bộ auto đã xếp, nên lịch chiến cố định vẫn không bắt ai phải thức.

**Liên minh tông môn:**

- Tối đa 5 tông môn, cùng vị diện. Tông môn thăng vị thì tự rời liên minh cũ.
- Đồng minh không đánh nhau, thấy chung phần sương mù đã mở, đi qua điểm của nhau và gửi đệ tử hộ chiến qua Truyền Tống Trận.
- Gia nhập từ cấp tông môn 5, lập liên minh từ cấp 20.
- Chat liên minh có lọc từ và nút báo cáo, theo yêu cầu kiểm soát nội dung của giấy phép G1.

**Chiến tranh địa bàn:**

1. Tông môn từ cấp 30 tuyên chiến trước ít nhất 12 giờ; bên bị tuyên chiến được báo ngay.
2. Giao chiến chỉ trong khung 21:00–22:00 các tối Thứ Ba, Thứ Năm và Thứ Bảy.
3. Chỉ tấn công được điểm nằm trong tầm với của mình hoặc của đồng minh; đoàn quân chạy thật trên map, thời gian đi hiện trên bản đồ với đồng hồ đếm ngược.
4. Mỗi điểm phân thắng thua bằng trận thời gian thực trong phòng chiến của điểm giữa đội hai bên, tối đa 10 người mỗi đội (người chơi điều khiển hoặc auto, NPC do server điều khiển).
5. Mất Chính Điện là bị diệt môn; hậu quả theo phần Diệt môn, hòa và hậu quả bên dưới.

**Chống bắt nạt:**

- Chỉ tuyên chiến được tông môn chênh không quá 30 cấp, trừ khi bên yếu hơn tuyên chiến trước.
- Tông môn mới và tông môn vừa thăng vị có khiên 7 ngày.
- Điểm vừa chiếm phải giữ 24 giờ mới tính vào sản lượng.
- Không trận nào xảy ra ngoài khung giờ, nên người chơi không bị đánh lúc ngủ.

Các con số ở phần trên (30 cấp, 72 giờ, 10 người) là đề xuất của mình, chờ bạn duyệt.

### Chính và tà

Chính hay tà không do tông môn tự chọn mà tính theo biên độ đồ sát của cả tông môn. Đề xuất: sát khí tông môn bằng tổng sát nghiệp của thành viên trong 7 ngày gần nhất chia cho số thành viên; trên 1,0 là tà, dưới 0,3 là chính, ở giữa thì giữ phe cũ để không đổi qua đổi lại liên tục. Nghiêng về phe nào cũng có phúc lợi riêng.

| Phe | Phúc lợi (đề xuất) |
|---|---|
| Chính | Thưởng nhiệm vụ thành chủ +10%; vùng NPC hộ đạo quanh sơn môn rộng thêm 1 chặng |
| Tà | Chiến lợi phẩm khi đồ sát +20%; không bị nhốt vào lao tù; truyền thụ được công pháp luyện tà và sát thủ |

**Cân bằng phe theo vùng.** Khi một phe chiếm quá 60% số tông môn đang hoạt động trong vùng, phe ít hơn được bù: +15% thưởng, +10% sát thương lên phe kia, và thêm NPC phụ chiến trong tông môn chiến (đề xuất 2 NPC mỗi trận). Chênh lệch càng lớn thì mức bù càng cao, tối đa gấp đôi.

### Bảo trợ và tạo phản

- Tông môn mới lập rơi vào khu vực có tông môn lớn thì nằm dưới bảo trợ của một tông lớn được chọn ngẫu nhiên. Ví dụ khu vực có hai tông môn cấp 50–100: tông mới rơi vào bên nào thì chịu bảo trợ bên đó. Đề xuất: áp dụng cho tông môn dưới cấp 30, tông bảo trợ từ cấp 50.
- Được bảo trợ thì tông môn khác không tuyên chiến với mình được; đổi lại nộp cống cho tông bảo trợ (đề xuất 5% sản lượng mỏ).
- Tông nhỏ có thể tạo phản, quay sang tông lớn bên kia. Tông môn bên kia có quyền cử NPC trưởng lão sang trấn giữ khu vực của tông nhỏ. NPC được cử quá yếu thì tông nhỏ vẫn có thể bị tông bảo trợ cũ diệt môn.

### Cứ điểm, tiểu Truyền Tống Trận và mặt trận

- **Chiến thuật lan dần:** chiếm cứ điểm, trận pháp sư xây tiểu Truyền Tống Trận tại đó, đưa quân qua chiếm điểm kế tiếp, rồi xây tiếp. Cách này rẻ và điều quân nhanh hơn nâng Truyền Tống Trận lớn ở sơn môn, nhưng mỗi tiểu truyền tống là một điểm yếu địch có thể phá.
- **Chỉ trận pháp sư** (người chơi có tài năng Tu trận) xây được Truyền Tống Trận và hộ trận.
- **Chi phí đề xuất:** tiểu truyền tống tốn 2.000 linh thạch cùng phẩm vị diện, tầm 1 chặng từ cứ điểm đó, phí duy trì 200 linh thạch mỗi ngày; số tiểu truyền tống tối đa bằng cấp tông môn chia 10.
- **Không giới hạn mặt trận:** hai tông môn giáp nhau ở bao nhiêu điểm thì phải giữ bấy nhiêu điểm. Mỗi điểm cần người trấn giữ, là người chơi hoặc NPC; điểm bỏ trống chỉ còn hộ trận, không có hộ trận thì phòng thủ rất yếu.
- Khi một bên xây cứ điểm lấn vào lãnh địa bên kia, bên kia được cử quân đi phá hoặc chiếm lại.

### Hộ trận và công thành

Hộ trận là tấm khiên che cứ điểm. Càng nhiều trận pháp sư cùng dựng thì khiên càng dày và hồi càng nhanh. Phá xong khiên, quân hai bên mới vào trận thời gian thực tại điểm; trận pháp sư yếu đứng trong điểm đó dễ bị diệt ngay. Bên công dùng chiến thuyền, linh thú công thành và đòn phá trận của người chơi (đòn phá trận là một kỹ năng đặc biệt tại khu vực điểm, hồi 5 phút một đòn).

| Thành phần | Công thức (đề xuất) |
|---|---|
| Máu hộ trận | 50 × tổng cấp trận pháp sư dựng trận × hệ số đồng trận |
| Hệ số đồng trận (n người) | 1 + 0,05 × (n − 1), tối đa 1,95 khi 20 người |
| Hồi trận mỗi phút | Máu tối đa × 1% × (1 + 0,15 × (n − 1)); không có trận pháp sư trấn giữ tại chỗ thì chỉ hồi 1/4 |
| Chiến thuyền | Phá trận 40 × cấp thuyền mỗi phút; mua ở thành chủ bằng linh thạch; cấp thuyền không vượt cấp tông môn; mỗi lần công mất 20% độ bền |
| Linh thú công thành | Theo đại cảnh giới 1 / 2 / 3 / 4: 400 / 1.000 / 2.500 / 6.000 mỗi phút |
| Đòn phá trận của người chơi | 0,3 × cấp², mỗi 5 phút một đòn: cấp 50 = 750, cấp 100 = 3.000, cấp 150 = 6.750, cấp 200 = 12.000 |

| Phòng thủ | Máu · hồi mỗi phút | Bên công | Kết quả |
|---|---|---|---|
| 4 trận pháp sư cấp 50 (tổng 200) | 11.500 · 167 | Thuyền cấp 50 + linh thú đại cảnh giới 2 (3.000/phút) | Vỡ sau khoảng 4 phút |
| 4 trận pháp sư cấp 50 | 11.500 · 167 | Thuyền cấp 100 + linh thú đại cảnh giới 2 (5.000/phút) | Vỡ sau khoảng 2,4 phút |
| 4 trận pháp sư cấp 50 | 11.500 · 167 | 1 người chơi cấp 200 | Vỡ ngay bằng một đòn 12.000; trận pháp sư bị diệt tại chỗ |
| 10 trận pháp sư cấp 100 (tổng 1.000) | 72.500 · 1.704 | 1 người chơi cấp 200 + thuyền cấp 100 | Vỡ sau khoảng 16 phút |
| 10 trận pháp sư cấp 100 | 72.500 · 1.704 | Thuyền cấp 100 + linh thú đại cảnh giới 2 | Vỡ sau khoảng 22 phút |
| 20 trận pháp sư cấp 150 (tổng 3.000) | 292.500 · 11.261 | 3 người cấp 200 + 2 thuyền cấp 150 + linh thú đại cảnh giới 4 | Vỡ sau khoảng 22 phút |
| 20 trận pháp sư cấp 150 | 292.500 · 11.261 | 1 người cấp 200 + thuyền cấp 100 + linh thú đại cảnh giới 3 | Không phá được: hộ trận hồi nhanh hơn sát thương |

Cứ điểm vài trận pháp sư cấp thấp chỉ cầm cự vài phút, còn chiến trường lớn chỉ phá được khi bên công đủ quân. Ở Trung vị và thượng vị, “cấp” trong công thức là cấp quy đổi theo chỉ số (đề xuất).

**Chi phí hộ trận (đã chốt).** Hộ trận càng lớn càng cần lượng linh thạch khổng lồ để xây và duy trì. Bảo Khố hết linh thạch thì hộ trận, kể cả hộ trận sơn môn, giảm 50% sức kháng cho tới khi nộp đủ. Đề xuất công thức: chi phí dựng bằng máu hộ trận (tính bằng linh thạch cùng phẩm vị diện); phí duy trì mỗi ngày bằng 10 × (máu ÷ 1.000)^1,5; giảm 50% sức kháng nghĩa là máu tối đa và hồi trận còn một nửa.

| Hộ trận | Chi phí dựng | Duy trì mỗi ngày | Tương đương sản lượng |
|---|---|---|---|
| 4 trận pháp sư cấp 50 (máu 11.500) | 11.500 | khoảng 390 | 1/8 mỏ cấp 5 Hạ vị |
| 10 trận pháp sư cấp 100 (máu 72.500) | 72.500 | khoảng 6.170 | 2 mỏ cấp 5 |
| 20 trận pháp sư cấp 150 (máu 292.500) | 292.500 | khoảng 50.000 | 16 mỏ cấp 5 |

Phí duy trì tăng nhanh hơn máu, nên chỉ tông môn giữ nhiều mỏ mới nuôi nổi đại trận; mất mỏ là hộ trận yếu đi.

### Bậc trận pháp và đại trận tông môn

**Đề xuất 2026-11-05, chờ bạn duyệt.** Trận pháp có năm bậc theo số người cùng triển khai. Hai bậc đầu là chiêu thức trong trận đấu (mục 8); ba bậc sau dựng trên bản đồ, mở theo cấp tông môn, và người giữ chỗ trong trận có thể là người chơi hoặc NPC.

| Bậc | Số người | Đặt ở | Mở |
|---|---|---|---|
| Tiểu trận | 1 | Trận đấu: chiêu Trận pháp ×6,00, 6 mục tiêu | Có công pháp Trận pháp |
| Hợp trận | 2–10, cùng đội | Trận đấu: Lưỡng Nghi, Tam Tài, Ngũ Hành | Đã chốt ở mục 8 |
| Hộ trận | 1–20 trận pháp sư | Khiên một cứ điểm hoặc Chính Điện | Phần Hộ trận và công thành ở trên |
| Trung trận | 8–28 | Một điểm, hoặc lãnh thổ quanh sơn môn | Cấp tông môn 30–80 |
| Đại trận | 30–50 | Sơn môn, điểm của địch, cửa bí cảnh, Phi Thăng Đài | Cấp tông môn 100–200 |

**Cấp trận theo phẩm.** Cấp của một trận bằng phẩm công pháp Trận pháp của chủ trận, từ Phàm tới Thánh như mục 9. Mỗi trận có phẩm tối thiểu; mỗi phẩm cao hơn mức đó cộng 10% sức trận (máu, phá trận và các hiệu ứng tính theo %), tối đa +50%. Trận pháp từ Địa pháp chỉ Tu trận học được, nên đại trận lớn luôn cần trận pháp sư có Tu trận làm chủ.

| Vai | Ai giữ | Việc |
|---|---|---|
| Chủ trận (1) | Tu trận có Trận pháp đủ phẩm | Quyết định cấp trận; tính là một trận nhãn |
| Trận nhãn | Tu trận: người chơi, đệ tử NPC có Tu trận, NPC trận pháp sư thuê | Thiếu trận nhãn thì không kích được; mỗi trận nhãn mang hệ linh căn của người giữ |
| Trợ trận | Mọi người: thành viên, đệ tử NPC, NPC chiến, người chơi đồng minh | Truyền linh lực cho trận |

**Ai được giữ chỗ:**

- Mỗi người góp theo cấp quy đổi của mình (cấp nhân vật ở Hạ và Trung vị, cấp quy đổi theo chỉ số ở thượng vị); NPC góp 80%, như NPC trận pháp sư dựng hộ trận.
- NPC giữ tối đa 60% số chỗ, người chơi đồng minh tối đa 1/3, để đại trận vẫn cần người thật của tông môn và liên minh. Đệ tử NPC và NPC chiến có sẵn không tốn thêm; thuê NPC trận pháp sư tính phí như phần NPC bên dưới.
- Người góp phải đóng quân tại điểm đặt trận trước lúc kích; không cần online vì khi kích, nhân vật của người offline do AI server điều khiển theo bộ auto (mục 8).
- Mỗi người chỉ giữ một chỗ: đang trong một trận thì không giữ chỗ ở trận khác, không ra đòn phá trận riêng và không vào đội trận ở điểm khác. Người góp trận đặt tại một điểm vẫn được vào đội trận 10 người của chính điểm đó.
- Đường chủ Trận pháp xếp chỗ và kích trận; tông chủ và phó tông chủ cũng làm được.

Tông môn đủ người cho đại trận: cấp 100 có 35 thành viên và tối đa 37 NPC chiến, cấp 150 có 47 thành viên và tối đa 53 NPC chiến (công thức ở phần NPC bên dưới). Với giới hạn 60% NPC, Thiên Cương Vạn Kiếm 36 chỗ cần ít nhất 15 người chơi của tông môn hoặc đồng minh, Đại Diễn 50 chỗ cần 20.

**Thường trực và kích.** Trận kinh tế và trận che điểm là thường trực: giữ chỗ cả ngày, trả phí duy trì mỗi ngày. Trận chiến tranh dựng một lần rồi nằm ở thế tĩnh, không tốn phí; chỉ kích trong khung chiến tranh 21:00–22:00, mỗi khung một lần mỗi trận, kích xong không dời được và tồn tại tới hết khung hoặc tới khi vỡ. Trận đặt ngoài sơn môn có máu như hộ trận cùng số người góp, nên bên kia phá được bằng chiến thuyền, linh thú và đòn phá trận.

| Trận | Bậc · số người · trận nhãn | Mở · phẩm tối thiểu | Cách dùng | Hiệu ứng |
|---|---|---|---|---|
| Bát Quái Mê Tung Trận | Trung trận · 8 · 2 | Cấp 30 · Phàm | Thường trực ở một cứ điểm; tối đa cấp tông môn ÷ 15 trận | Địch không thấy quân trấn giữ và hộ trận của điểm; đoàn quân địch đi chặng kề điểm mất thêm 50% thời gian; trong trận đấu tại điểm, bên thủ ẩn thân 1 s đầu trận |
| Thập Nhị Nguyên Thần Tụ Linh Trận | Trung trận · 12 · 3 | Cấp 50 · Hoàng | Thường trực ở sơn môn; mỗi tông môn một trận | Tu luyện +10% cho thành viên trong lãnh thổ; bí cảnh trong 2 chặng hồi thêm 10% linh lực mỗi ngày (tính trong trần 20% của trận tụ linh ở mục 11). Người góp đủ 12 hệ linh căn mới đạt đủ hiệu ứng, thiếu mỗi hệ −8% |
| Nhị Thập Bát Tú Khốn Long Trận | Trung trận · 28 · 4 (Tứ Tượng) | Cấp 80 · Hoàng | Kích lên một điểm của địch trong tầm Truyền Tống Trận | Địch không đưa quân vào hay ra điểm đó; hộ trận của điểm không hồi; trong trận đấu tại điểm, bên bị vây −10% tốc độ đánh |
| Thiên Cương Vạn Kiếm Trận | Đại trận · 36 · 6 | Cấp 100 · Huyền | Kích tại điểm đang công | Mỗi 5 phút gom đòn phá trận của mọi người góp thành một đòn ×2, đòn đầu ngay lúc kích |
| Thập Phương Phong Ma Trận | Đại trận · 40 · 10 | Cấp 120 · Huyền | Kích ở cửa bí cảnh tông môn đang giữ, bất kỳ giờ nào, hồi 24 giờ | Trong 1 giờ boss của bí cảnh đó yếu 30% và rơi thêm một lượt; Huyết Sát Môn không đánh mỏ trong 2 chặng quanh đó 3 ngày |
| Càn Khôn Na Di Trận | Đại trận · 30 · 5 | Cấp 130 · Địa | Kích ở sơn môn | Đưa một đội 10 người tới điểm ngoài tầm Truyền Tống Trận thêm 2 chặng, chỉ trong khung chiến tranh đó; hết khung đội tự về |
| Chu Thiên Tinh Đấu Đại Trận (Hộ Sơn Đại Trận cấp cao) | Đại trận · 30–50 · 6–12 | Cấp 150 · Địa | Kích ở Chính Điện, thay hộ trận thường trong khung chiến tranh | Máu theo công thức hộ trận, hệ số đồng trận tính tới 50 người; trận nhãn đủ 12 hệ thì máu ×1,2; trong trận đấu tại Chính Điện, bên thủ +12% máu |
| Đại Diễn Hộ Kiếp Đại Trận | Đại trận · 50 · 7 | Cấp 200 · Địa | Kích khi phi thăng cả môn (mục 7) | Cần đủ 50 người; 5 đợt lôi kiếp vào Chính Điện và thành viên giảm 40% |

**Hộ Sơn Đại Trận cấp cao.** Dưới cấp tông môn 150, Hộ Sơn Đại Trận là hộ trận của Chính Điện, tối đa 20 trận pháp sư như bảng ở trên. Từ cấp 150 nâng thành Chu Thiên Tinh Đấu: từ người thứ 21, mỗi người thêm 0,02 vào hệ số đồng trận, tối đa 2,55 khi 50 người; hồi trận vẫn tính theo tối đa 20 người (3,85% máu mỗi phút) để đại trận công vẫn phá được. Ngoài khung chiến tranh, Chính Điện giữ hộ trận thường và trả duy trì như cũ. Ví dụ dưới đây, mọi người cấp 150:

| Tình huống | Phá trận | Kết quả |
|---|---|---|
| Thủ: Chu Thiên Tinh Đấu 50 người (30 người chơi, 20 NPC, đủ 12 hệ), máu 1.055.700, hồi 40.644 mỗi phút | — | — |
| Công: 36 người (20 người chơi, 16 NPC) đánh riêng + 2 thuyền cấp 150 + linh thú đại cảnh giới 4 | Khoảng 62.280 mỗi phút | Vỡ sau khoảng 40–50 phút, sát hết khung giờ |
| Công: cùng 36 người kết Thiên Cương Vạn Kiếm, cùng thuyền và linh thú | Đòn gom 442.800 mỗi 5 phút + 18.000 mỗi phút | Vỡ sau khoảng 10 phút |
| Như trên, bên thủ có bảo vật chấn tông (phần trấn tông ×2: máu 2.111.400, hồi 81.289 mỗi phút) | Như trên | Vỡ sau khoảng 70 phút: không kịp trong một khung |

Đại trận công phá được đại trận thủ nhanh gấp bốn so với cùng số người đánh lẻ, còn tông môn có bảo vật chấn tông vẫn giữ được Chính Điện qua một đêm nhờ phần trấn tông.

| Trận | Chi phí dựng | Duy trì hoặc mỗi lần kích |
|---|---|---|
| Bát Quái Mê Tung | 5.000 | 300 mỗi ngày |
| Thập Nhị Nguyên Thần Tụ Linh | 30.000 | 1.500 mỗi ngày, khoảng nửa mỏ cấp 5 |
| Nhị Thập Bát Tú Khốn Long | 60.000 | 8.000 mỗi lần kích |
| Thiên Cương Vạn Kiếm | 120.000 | 15.000 mỗi lần kích |
| Thập Phương Phong Ma | 150.000 | 12.000 mỗi lần kích |
| Càn Khôn Na Di | 200.000 | 25.000 mỗi lần kích |
| Chu Thiên Tinh Đấu | 300.000 | Bằng 2 giờ phí duy trì của hộ trận cùng máu: khoảng 28.600 với ví dụ trên |
| Đại Diễn Hộ Kiếp | 500.000 | 50.000 mỗi lần phi thăng |

Tính bằng linh thạch cùng phẩm vị diện. Một đêm kích cả Chu Thiên Tinh Đấu và Vạn Kiếm tốn khoảng 43.600, bằng một ngày sản lượng 14 mỏ cấp 5, nên đại trận là đòn quyết định chứ không dùng mỗi đêm. Bảo Khố cạn thì mọi trận còn 50% sức như hộ trận.

**Hiệu ứng trong trận đấu (đo ngày 2026-11-05).** Đo trên bản sao mô phỏng hiện tại: đội ngẫu nhiên đấu đội ngẫu nhiên cùng sức, 4.000 trận mỗi mức, sai số ±1,5%. Để so: đội yếu hơn 5% chỉ số chỉ thắng 35,9%, nên cột cuối quy mỗi hiệu ứng ra số % chỉ số nó đáng giá.

| Hiệu ứng | Bên có hiệu ứng thắng | Bằng chừng ấy % chỉ số |
|---|---|---|
| Bên thủ ẩn thân 1 s / 1,5 s / 2 s | 55,1% / 58,8% / 62,7% | 1,7 / 3,1 / 4,3 |
| Bên bị vây −5% / −10% / −15% tốc độ đánh | 55,6% / 60,3% / 66,5% | 1,9 / 3,6 / 5,4 |
| Bên thủ +10% / +12% / +15% máu | 59,4% / 61,6% / 63,9% | 3,1 / 3,8 / 4,6 |
| Cùng bên: ẩn thân 2 s và +10% máu | 69,9% | 7,2 |
| Cùng bên: ẩn thân 1 s và +12% máu | 65,4% | 5,6 |
| +12% máu nhưng bị Khốn Long −10% tốc độ đánh | 49,9% | — |

Chọn mức theo công sức dựng trận: Mê Tung (8 người, rẻ, dựng được nhiều trận) ẩn thân 1 s, Khốn Long (28 người) −10% tốc độ đánh, Chu Thiên Tinh Đấu (tới 50 người) +12% máu; cả ba dưới trần 65%. Mỗi bên chỉ hưởng một hiệu ứng trận trong một trận đấu, lấy cái mạnh hơn, vì hai trận cùng bên vượt 65%. Khốn Long vây Chính Điện thì xóa vừa đúng phần lợi trong trận đấu của Chu Thiên Tinh Đấu (49,9%), còn khiên vẫn nguyên. Ba hiệu ứng này chưa có trong mô phỏng của repo.

### NPC chiến và NPC thuê

- NPC chiến (trưởng lão, hộ pháp) được tuyển hoặc mời; số lượng tối đa và tỷ lệ mời thành công tăng theo độ lớn tông môn. Đề xuất: số NPC chiến tối đa bằng cấp tông môn chia 5 cộng số thành viên chia 2; tỷ lệ mời được trưởng lão cấp cao bằng 10% cộng cấp tông môn chia 4 (tính theo %), tối đa 60%.
- NPC bị thương sau trận không ra chiến tuyến được trong 6–12 giờ.
- Pháp bảo trấn giáo nay gộp vào bảo vật chấn tông (người dùng chốt 2026-11-05, phần ngay dưới). Thượng tiên là NPC ở thành chủ, bán món trấn giáo khởi đầu và tàn quyết; có bảo vật thì máu hộ trận Chính Điện ×2.

**Thuê NPC khi cấp bách (đã chốt).** Tông môn thuê được NPC luyện đan sư và NPC trận pháp sư dựng hộ trận khi cần, chi phí cao. Đề xuất: NPC trận pháp sư góp vào hộ trận bằng 80% một trận pháp sư người chơi cùng cấp, phí thuê mỗi giờ bằng cấp² ÷ 2 linh thạch (cấp 50 là 1.250 mỗi giờ, khoảng 10 mỏ cấp 5); NPC luyện đan sư tính phí gấp 3 lần nguyên liệu mỗi lần luyện và chỉ luyện tới đan cấp 7; đan cấp 8–10 phải do luyện đan sư người chơi.

### Bảo vật chấn tông

**Đề xuất 2026-11-05, chờ bạn duyệt.** Bảo vật chấn tông là vũ khí của cả tông môn trong tông môn chiến. Mỗi tông môn chỉ có một, đúc từ 100 tàn quyết cùng loại và rất nhiều tài nguyên, dùng đúng lúc thì xoay chuyển cả một đêm chiến rồi phải chờ 12–15 ngày. Bảo vật chấn tông gộp luôn pháp bảo trấn giáo cũ (người dùng chốt 2026-11-05): mọi bảo vật đặt ở Chính Điện và có phần trấn tông thụ động, nhân đôi máu hộ trận Chính Điện và giữ luật diệt môn khi có bảo vật ở phần Diệt môn bên dưới; phần chủ động là hiệu ứng riêng của từng loại.

**Tàn quyết và đúc.**

- Có 30 loại bảo vật, mỗi loại một bản vẽ gồm 100 tàn quyết. Tàn quyết khác tàn quyển: không ghép công pháp, chỉ dùng để đúc, thăng hạn và tế luyện bảo vật.
- Tàn quyết rơi khi hạ boss và mua bán được trên chợ chung và đấu giá cuối tuần. Đủ 100 quyển cùng loại thì ghép thành bản vẽ ở Tàng Kinh Các; bản vẽ khóa vào tông môn, không bán lại được.
- Đúc ở Luyện Khí Các, mở từ tông môn cấp 50: bản vẽ, 1.500.000 linh thạch, 300.000 quặng và 100.000 dược liệu (Hạ vị; vị diện cao tính bằng phẩm của vị diện đó). Tu rèn chủ lò thì quặng −15%.
- Đổi loại thì luyện hóa bảo vật cũ, nhận lại 30% tài nguyên đúc và 30 tàn quyết loại cũ.

**Bậc khởi đầu: 4 món trấn giáo.** Trấn Giáo Lệnh Bài, Tứ Tượng Trấn Giáo Kỳ, Thông Thiên Trấn Giáo Tháp và Thái Cổ Trấn Giáo Đỉnh (tab Trang bị, pháp bảo và set đồ) vẫn mua hoặc đổi được với thượng tiên, hoặc ghép từ 10 mảnh trấn giáo rơi ở Thượng Cổ Chiến Trường, để tông môn nhỏ có phần trấn tông sớm. Chúng chỉ có phần trấn tông và nét thêm riêng của từng món, không kích được, không thăng hạn; khi tính hệ số K thì coi như bảo vật hạn 1 không thuộc đạo nào. Mỗi tông môn vẫn chỉ giữ một: đúc một trong 30 bảo vật thì món trấn giáo tan vào lò, và bản vẽ chỉ cần 90 tàn quyết.

| Nguồn tàn quyết | Rơi |
|---|---|
| Boss bí cảnh | 3% mỗi lần hạ boss |
| Boss Cổ Tông Di Tích, Thượng Cổ Chiến Trường, Hỗn Độn Bí Cảnh, thủ lĩnh Huyết Sát Môn | 8% |
| Boss liên minh cuối tuần | 3–6 quyển cho mỗi tông môn tham gia, theo sát thương |
| Đấu giá cuối tuần | 5 quyển mỗi phiên mỗi vùng |
| Thượng tiên ở thành chủ | Bán 1 quyển mỗi tuần cho mỗi tông môn, 50.000 linh thạch; người chơi đã lên vị diện cao bán xuống qua chợ |

Mỗi quyển rơi ra có 60% thuộc đạo ứng với hệ chủ đạo của vùng (theo Ngũ Hành của hệ đó, ví dụ Lôi Đình Cốc ra đạo Kim), 40% ngẫu nhiên trong 30 loại. Tông môn lớn 47 thành viên nhặt khoảng 2,7 quyển mỗi ngày, khoảng 480 quyển sau 6 tháng, nhưng chỉ chừng 55 quyển đúng loại muốn đúc; phần còn lại phải đổi trên chợ. Vì vậy tông môn lớn mất khoảng 6 tháng, tông môn vừa (22 thành viên, khoảng 26 quyển đúng loại sau 6 tháng) mất khoảng một năm.

**Hạn và uy lực.**

- Hạn 1–12. Trần hạn bằng cấp tông môn ÷ 20: cấp 50 là hạn 2, cấp 100 là hạn 5, cấp 200 là hạn 10. Chi gấp 3 lần thì vượt trần 1 hạn, gấp 9 lần thì vượt 2 hạn, nên tông môn cấp 200 lên được hạn 12 và tông môn cấp 100 lên được hạn 7.
- Thăng hạn h lên h + 1 tốn 10 tàn quyết cùng loại và 10.000 × h² linh thạch. Từ hạn 1 lên 10 tổng 90 tàn quyết và 2.850.000 linh thạch; vượt trần lên hạn 11 tốn 3.000.000, lên hạn 12 tốn 10.890.000.
- Uy lực U tăng từ 50% ở hạn 1 tới 70% ở hạn 10, mỗi hạn thêm 2,2% (hạn 12 là 74,4%). Hiệu ứng ghi dạng “a → b” trong bảng dưới tăng đều từ hạn 1 tới hạn 10, hạn 11–12 đi tiếp cùng bước.
- Thăng vị diện: bảo vật đi theo và giữ hạn, nhưng phải tế luyện lại bằng 30 tàn quyết cùng loại và tài nguyên của vị diện mới; chưa tế luyện thì chỉ phát 50% hiệu lực.

**Uy lực đánh vào đâu.** Mức 50–70% đánh vào một tầng của chiến trường: máu hộ trận, sức phá trận, hồi trận, quân số hoặc đường đi. Chỉ số trong trận đấu 10 đấu 10 thì rất nhạy: đo trên bản sao mô phỏng, địch giảm 10% chỉ số thì ta thắng 78,3%, giảm 30% thì thắng 98,8%, giảm 50% thì thắng 100%. Vì vậy bảo vật đụng tới chỉ số trận đấu chỉ đẩy tỷ lệ thắng lên khoảng 55–64% (riêng Thái Sơn Trấn Nhạc Ấn tới 76%). Nếu áp nguyên 50–70% vào chỉ số thì mọi trận trong lúc bảo vật có hiệu lực đều thắng chắc.

**Hội đồng quyết và cách dùng.**

- Hội đồng gồm tông chủ, phó tông chủ và trưởng lão là người chơi; NPC thay thế không bỏ phiếu. Muốn dùng trong một đêm chiến cần tông chủ đồng ý (tông chủ vắng thì phó tông chủ có cống hiến cao nhất) và quá nửa hội đồng thuận, chốt trước 20:30.
- Hội đồng chọn mục tiêu và lúc kích: một phút cố định trong khung 21:00–22:00, hoặc một điều kiện như hộ trận Chính Điện còn dưới 50% hay địch vừa kích bảo vật. Không cần ai online, vì người offline được AI điều khiển trong các trận thời gian thực (mục 8).
- Mỗi đêm kích tối đa một lần. Hồi chiêu 12–15 ngày theo bảng, từ hạn 7 bớt 1 ngày; kích mà không trúng ai vẫn tính hồi.
- Trang tông môn hiện loại, đạo, hạn của bảo vật và đang hồi hay sẵn sàng, nên hai bên biết nhau có gì trước khi quyết.
- Chỉ dùng trong tông môn chiến, trừ món ghi rõ dùng ngoài chiến tranh. Trong một trận đấu mỗi bên hưởng tối đa một hiệu ứng từ đại trận và một từ bảo vật (của mình hoặc của đồng minh), lấy cái mạnh nhất mỗi loại.

**Năm đạo, khắc nhau như Ngũ Hành.** 30 bảo vật chia đều cho năm đạo. Khắc và sinh đi đúng vòng Ngũ Hành của mục 8.

| Đạo | Hành | Làm gì | Khắc | Bị khắc |
|---|---|---|---|---|
| Gia trì | Mộc | Tăng sức, tăng kháng cho phe mình | Trấn áp | Biến hóa |
| Sát phạt | Hỏa | Đánh thẳng vào hộ trận, đại trận, quân địch | Biến hóa | Hộ thủ |
| Trấn áp | Thổ | Đè cảnh giới, khóa trận, giam đường đi | Hộ thủ | Gia trì |
| Biến hóa | Kim | Đoạt, phản, ẩn, điều quân | Gia trì | Sát phạt |
| Hộ thủ | Thủy | Giữ điểm, giữ Chính Điện | Sát phạt | Trấn áp |

Vòng sinh: Gia trì → Sát phạt → Trấn áp → Biến hóa → Hộ thủ → Gia trì.

**Khi cả hai tông môn cùng có bảo vật.** Hiệu ứng bất lợi của bảo vật A lên tông môn B nhân hệ số K. Chỉ cần B có bảo vật, kể cả đang hồi chiêu:

K = 0,7 × (1 + 0,08 × (hạn A − hạn B)) × hệ số đạo × hệ số cấp, giới hạn 0,2–1,3.

- Hệ số đạo: đạo của A khắc đạo của B thì ×1,3; đạo của B khắc A thì ×0,6; cùng đạo ×0,85; còn lại ×1.
- Hệ số cấp chống bắt nạt: A cao hơn B x cấp tông môn thì ×(1 − x%), tối đa −30% vì tuyên chiến chỉ được chênh 30 cấp; A thấp hơn thì ×1. B không có bảo vật thì K chỉ còn hệ số cấp.
- Hiệu ứng có lợi cho chính mình (đa số Gia trì và Hộ thủ) không nhân K, trừ khi bị bảo vật Biến hóa đoạt. Số cấp bị giảm nhân K rồi làm tròn xuống.
- Liên đới trong liên minh: hai đồng minh cùng kích trong một đêm, đạo bên này sinh đạo bên kia, thì bảo vật bên được sinh +15% hiệu lực. Liên minh kích đủ năm đạo trong cùng một đêm thì mọi bảo vật của liên minh đêm đó +10% (Ngũ Hành tề tựu).

| Bảo vật | Đạo | Phạm vi · thời gian | Hiệu ứng (hạn 1 → hạn 10) | Hồi (ngày) |
|---|---|---|---|---|
| Thanh Mộc Trường Sinh Thụ | Gia trì | Toàn chiến trường · 30 phút | Phe ta +5% → +12% sát thương trong trận đấu | 12 |
| Bách Hoa Ngưng Lộ Bình | Gia trì | Toàn chiến trường · 30 phút | Phe ta +6% → +15% máu trong trận đấu | 12 |
| Vạn Mộc Hồi Xuân Đăng | Gia trì | Phe ta · 30 phút | Kháng mọi tác động: hiệu ứng bất lợi của bảo vật, đại trận và trận pháp địch lên ta giảm U% | 13 |
| Kiến Mộc Thông Thiên Chi | Gia trì | Cả liên minh · 30 phút | Mọi tông môn trong liên minh +3% → +8% máu và sát thương trong trận đấu | 14 |
| Phù Tang Thần Mộc | Gia trì | Cả khung giờ | NPC ta góp vào hộ trận, đại trận bằng 100% thay vì 80%; số NPC chiến tối đa +U% | 12 |
| Linh Căn Hóa Đạo Lô | Gia trì | Cả tông môn · 7 ngày, dùng ngoài chiến tranh | Tu luyện +10% → +14%, đột phá cảnh giới +3% → +5% | 15 |
| Phần Thiên Hỏa Lô | Sát phạt | Một điểm địch · một đòn | Phá U% máu hộ trận điểm đó ngay lúc kích; Chính Điện tính trên máu đã nhân đôi nhờ phần trấn tông | 15 |
| Liệt Dương Xạ Nhật Cung | Sát phạt | Ba điểm địch · mỗi điểm một đòn | Mỗi điểm mất U ÷ 2 % máu hộ trận (25% → 35%) | 15 |
| Xích Long Phá Thành Chùy | Sát phạt | Phe ta · 30 phút | Đòn phá trận của người chơi, chiến thuyền và linh thú công thành của ta +U% | 14 |
| Cửu Dương Diệt Trận Mâu | Sát phạt | Một đại trận địch · một đòn | Đại trận đó mất U% máu (đại trận công thì mất U% sức của đòn gom) và tắt hiệu ứng trong trận đấu tới hết khung | 14 |
| Huyết Nhận Thiên La Võng | Sát phạt | Toàn chiến trường · 30 phút | Địch vào mỗi trận đấu với ta đã mất 4% → 10% máu | 13 |
| Lôi Hỏa Đoạn Lộ Kiếm | Sát phạt | Mọi đoàn quân địch đang đi · một đòn | U% số NPC trong đoàn bị thương (nghỉ 6–12 giờ), cả đoàn tới chậm thêm 50% | 13 |
| Thái Sơn Trấn Nhạc Ấn | Trấn áp | Toàn chiến trường · 30 phút | Cảnh giới địch −1 cấp → −5 cấp (hạn 1–3: −1; 4–5: −2; 6–7: −3; 8–9: −4; từ 10: −5), tính cả chỉ số và mọi luật xét cảnh giới | 13 |
| Hậu Thổ Phong Trận Bàn | Trấn áp | Toàn chiến trường · 30 phút | Hồi trận của mọi hộ trận, đại trận địch −U%; đại trận địch mất hiệu ứng trong trận đấu | 13 |
| Cửu Long Áp Thiên Đỉnh | Trấn áp | Chính Điện địch · 30 phút | Máu tối đa hộ trận Chính Điện −U ÷ 2 % (25% → 35%), kéo theo hồi trận | 13 |
| Trấn Hồn Thạch Bia | Trấn áp | Toàn chiến trường · 30 phút | Địch −5% → −12% tốc độ đánh trong trận đấu | 12 |
| Địa Mạch Khốn Tiên Thằng | Trấn áp | Bản đồ · 30 phút | Đoàn quân địch đi chậm U%; tiểu Truyền Tống Trận của địch ngừng; địch không kích được Càn Khôn Na Di | 13 |
| Vạn Pháp Phong Bảo Luân | Trấn áp | Bảo vật địch · 30 phút | Bảo vật địch kích trong 30 phút này yếu đi U%; địch không kích thì hồi chiêu của nó thêm 3 → 7 ngày | 14 |
| Càn Khôn Đảo Chuyển Kính | Biến hóa | Toàn chiến trường · 30 phút | Đoạt U% hiệu ứng có lợi từ bảo vật và đại trận của địch sang phe ta; địch mất đúng phần đó | 13 |
| Kim Quang Phản Thiên Kính | Biến hóa | Phe ta · 30 phút | Hiệu ứng bất lợi từ bảo vật địch lên ta giảm U ÷ 2 % và phần giảm đó dội ngược lại địch | 13 |
| Huyễn Ảnh Vạn Tượng Phiến | Biến hóa | Toàn chiến trường · 30 phút | Địch không thấy quân, đoàn quân và hộ trận của ta trên bản đồ; trong trận đấu ta ẩn thân 1 s → 2 s đầu trận | 12 |
| Lôi Ảnh Vô Tung Thoa | Biến hóa | Phe ta · 30 phút | Đoàn quân ta đi nhanh hơn U%; Truyền Tống Trận ta đưa quân tức thì; đổi chỗ đội trận giữa hai điểm ta không mất thời gian | 12 |
| Thiên Cơ Thôi Diễn Bàn | Biến hóa | Cả đêm | Thấy trước địch có kích bảo vật không, lúc nào, nhắm đâu, và đội hình địch ở mọi điểm; ta được đổi mục tiêu các đại trận và đội trận tới 21:00 | 12 |
| Kim Thiền Thoát Xác Y | Biến hóa | Phe ta · 30 phút | Điểm ta thua trong 30 phút thì quân không bị thương, NPC không phải nghỉ, tài nguyên bị cướp ở điểm đó −U% | 12 |
| Huyền Vũ Trấn Sơn Thuẫn | Hộ thủ | Chính Điện ta · cả khung giờ | Máu hộ trận Chính Điện +U% | 12 |
| Thiên Hà Đảo Quyển Châu | Hộ thủ | Mọi điểm ta · 30 phút | Phá trận của địch vào hộ trận ta −U% | 13 |
| Vạn Thủy Quy Nguyên Bình | Hộ thủ | Một điểm ta · tự kích khi hộ trận vỡ | Hộ trận dựng lại ngay với U% máu, một lần mỗi đêm | 12 |
| Huyền Băng Phong Môn Ấn | Hộ thủ | Một điểm ta, trừ Chính Điện · 20 → 30 phút | Phong điểm: không bên nào đánh vào hay rút ra, trận đang đánh dừng lại | 12 |
| Bích Hải Triều Sinh Bát | Hộ thủ | Mọi điểm ta · 30 phút | Trong trận đấu ở điểm của ta, quân ta nhận ít hơn 5% → 12% sát thương | 12 |
| Thủy Tinh Liên Hoàn Châu | Hộ thủ | Mọi điểm ta · 30 phút | Hộ trận các điểm ta liền nhau nối thành một: đòn phá trận vào một điểm chia đều cho nó và tối đa 3 điểm kề; hồi trận gộp chung | 12 |

**Đo hiệu ứng trong trận đấu (2026-11-05).** Đo trên bản sao mô phỏng mới nhất (đã tách thủ ngoại, thủ nội): đội ngẫu nhiên đấu đội ngẫu nhiên cùng sức, 4.000 trận mỗi mức, sai số ±1,5%.

| Bảo vật | Hiệu ứng ở hạn 1 và hạn 10 | Phe có lợi thắng |
|---|---|---|
| Thái Sơn Trấn Nhạc Ấn | Địch −1 / −2 / −3 / −4 / −5 cấp | 55,8% / 60,7% / 66,5% / 71,1% / 75,9% |
| Thanh Mộc Trường Sinh Thụ | +5% / +12% sát thương | 55,6% / 63,5% |
| Bách Hoa Ngưng Lộ Bình | +6% / +15% máu | 56,1% / 63,9% |
| Huyết Nhận Thiên La Võng | Địch −4% / −10% máu | 54,3% / 61,2% |
| Trấn Hồn Thạch Bia | Địch −5% / −12% tốc độ đánh | 55,6% / 62,4% |
| Huyễn Ảnh Vạn Tượng Phiến | Ẩn thân 1 s / 2 s | 55,1% / 62,7% |
| Để so: địch giảm thẳng chỉ số | −10% / −30% / −50% | 78,3% / 98,8% / 100% |

Bích Hải Triều Sinh Bát (nhận ít hơn 5–12% sát thương) gần như +5–14% máu nên ước 56–63%; Kiến Mộc Thông Thiên Chi chưa đo. Cả 30 bảo vật chưa có trong mô phỏng của repo; phần đụng hộ trận, đường đi và quân số cần mô phỏng chiến tranh theo phút, chưa có.

**Ví dụ đối đầu** (hộ trận Chính Điện B là Chu Thiên Tinh Đấu 1.055.700 máu như phần đại trận; hai tông môn cùng cấp trừ dòng cuối):

| Tình huống | K | Kết quả |
|---|---|---|
| A kích Phần Thiên Hỏa Lô hạn 8 (U 65,6%) vào Chính Điện B; B không có bảo vật | 1 | Mất khoảng 692.000 máu (65,6%) |
| B có Huyền Vũ Trấn Sơn Thuẫn hạn 6 và kích (phần trấn tông ×2 rồi +61,1%, thành 3.401.700); Hộ thủ khắc Sát phạt | 0,7 × 1,16 × 0,6 = 0,49 | Mất 31,9%, khoảng 1.086.500 |
| B có Càn Khôn Đảo Chuyển Kính hạn 6 (phần trấn tông ×2, thành 2.111.400); Sát phạt khắc Biến hóa | 0,7 × 1,16 × 1,3 = 1,06 | Mất 69,2%, khoảng 1.461.100 |
| A kích Thái Sơn Trấn Nhạc Ấn hạn 10 (−5 cấp); B có Vạn Mộc Hồi Xuân Đăng hạn 10 và kích; Gia trì khắc Trấn áp | 0,7 × 1 × 0,6 = 0,42, rồi Vạn Mộc giảm thêm 70% | −5 × 0,42 × 0,3 = −0,63, làm tròn thành 0: vô hiệu |
| A cấp 160 kích Thái Sơn hạn 8 (−4 cấp) lên B cấp 140 không có bảo vật | 0,8 (chống bắt nạt) | −3,2, còn −3 cấp (B thua khoảng 2/3 số trận trong 30 phút) |

**Gợi ý chọn bảo vật theo vị thế.**

| Vị thế của tông môn | Nên chọn | Vì sao |
|---|---|---|
| Lớn, đang bành trướng trên nhiều mặt trận | Liệt Dương Xạ Nhật Cung, Xích Long Phá Thành Chùy | Phá nhiều hộ trận trong một đêm |
| Muốn diệt một kình địch đã có bảo vật | Phần Thiên Hỏa Lô, Cửu Long Áp Thiên Đỉnh | Đánh thẳng vào máu Chính Điện đã nhân ×2 |
| Nhỏ, kẹp giữa tông lớn, hay bị tuyên chiến | Huyền Vũ Trấn Sơn Thuẫn, Vạn Thủy Quy Nguyên Bình | Giữ Chính Điện, hồi 12 ngày |
| Giữ nhiều mỏ xa, mặt trận dài | Thủy Tinh Liên Hoàn Châu, Lôi Ảnh Vô Tung Thoa | Chia đòn cho các điểm kề, điều quân nhanh |
| Sơn môn hiểm địa, ít mỏ | Huyền Băng Phong Môn Ấn, Thiên Hà Đảo Quyển Châu | Hộ Sơn đã +20%, chặn thêm đường vào |
| Minh chủ liên minh | Kiến Mộc Thông Thiên Chi | Cả liên minh cùng mạnh, dễ ghép tương sinh |
| Kình địch đã có bảo vật | Một món thuộc đạo khắc đạo của nó | Chỉ cần có là hiệu ứng của nó lên mình còn 0,42 |
| Tà phái, sống bằng đồ sát | Thái Sơn Trấn Nhạc Ấn, Lôi Hỏa Đoạn Lộ Kiếm | Đè cả chiến trường, chặn viện binh |
| Chủ bí cảnh, ít chiến | Linh Căn Hóa Đạo Lô | Tu luyện và đột phá; vẫn kháng Trấn áp nhờ đạo Gia trì |
| Ít người chơi, dựa vào NPC | Phù Tang Thần Mộc | NPC góp đủ 100% vào hộ trận, đại trận |
| Đông người chơi, giỏi đọc khắc chế | Thiên Cơ Thôi Diễn Bàn | Xem trận địch rồi mới xếp đệ tử |

**Mất bảo vật.** Tông môn có bảo vật mà bị diệt môn thì theo luật đã chốt ở bảng dưới: tự dời đi, mất 60% tài sản, thành viên rớt 5 cảnh giới nhỏ, được hộ tông 3 ngày. Bảo vật đi theo nhưng mất 3 hạn, bên thắng nhận 30 tàn quyết cùng loại; món trấn giáo khởi đầu thì đi theo nguyên vẹn. Tông môn không có bảo vật bị diệt môn thì mất hết như bảng dưới.

### Diệt môn, hòa và hậu quả

| Kết cục | Hậu quả (đã chốt) |
|---|---|
| Diệt môn | Toàn bộ tài sản về tay bên thắng; trong 48 giờ không lập lại được tông môn |
| Diệt môn khi đang có bảo vật chấn tông (trước là pháp bảo trấn giáo) | Tông môn tự dời ra khỏi phạm vi ảnh hưởng của bên thắng; mất 60% tiền bạc, pháp bảo và mọi tài sản; toàn bộ thành viên rớt 5 cảnh giới nhỏ (5 cấp); được hộ tông 3 ngày, tu sĩ quanh đó không tấn công được |
| Hòa (lực lượng tương xứng) | Cả hai bên mất tài nguyên; NPC bị thương nghỉ 6–12 giờ |

Đề xuất cách tính hòa: hết khung chiến tranh mà Chính Điện chưa vỡ và tổng lực chiến hai bên chênh dưới 15%; mỗi bên mất 10% tài nguyên trong Bảo Khố.

## 11. Bí cảnh và PvE

Bí cảnh là nguồn thần vật, trang bị cấp cao và tàn quyển, nên là thứ đáng tranh nhất trên bản đồ. Mỗi vùng Hạ vị có trung bình 6 bí cảnh, chia theo diện tích vùng (Lôi Đình Cốc có 5); mỗi vùng Trung vị 5, Thần vực 4, Thánh vực 3, thuộc 20 loại khác nhau, mở 2 lần mỗi ngày lúc 12:00 và 20:00, mỗi lần 30 phút. Bên trong bí cảnh là một phụ bản thời gian thực tách riêng (instance): party vào cùng nhau, đánh quái và boss bằng combat của mục 8; auto và treo máy vẫn chạy được trong phụ bản.

**Chiếm giữ bí cảnh:**

- Cửa bí cảnh là một điểm trên bản đồ; tông môn giữ điểm đó là chủ bí cảnh. Tông môn cũng có thể xây sơn môn ngay tại bí cảnh đó. Đề xuất: giữ bí cảnh đủ 7 ngày thì được dời sơn môn tới đó với chi phí lớn; thành viên được thêm 1 lượt vào bí cảnh mỗi ngày, nhưng mất Chính Điện là mất luôn bí cảnh.
- Thành viên tông môn chủ vào miễn phí. Người ngoài vào được nhưng nộp thuế 10% tàn quyển nhặt được cho chủ (đề xuất).
- Tông môn khác tranh đoạt trong giờ mở: thắng trận thời gian thực tại phòng chiến trước cửa thì giành quyền chủ từ lần mở kế tiếp.

**Rơi đồ:**

- Mỗi loại bí cảnh có tỷ lệ rơi gốc riêng, từ 4% đến 50% (bảng 20 loại bên dưới).
- Khi rơi vật phẩm (đã chốt): thần vật (vàng, đỏ) 3–7%, đồ tím 10–15%, đồ lam 19–35%, phần còn lại là tàn quyển ngẫu nhiên theo hệ của khu vực. Đề xuất: bí cảnh có tỷ lệ rơi gốc càng thấp thì càng nằm ở mức cao của các khoảng này; trong thần vật, khoảng 3/4 là vàng và 1/4 là đỏ. Mốc cũ linh cấp và thiên cấp nay là lam và tím (mục 12).
- Trang bị rơi trong bí cảnh có thuộc tính cao hơn đồ rơi bên ngoài 4–8% và có thêm 1 hoặc 2 dòng khảm (đã chốt).
- Hệ của tàn quyển: 50% hệ chủ đạo của vùng, phần còn lại chia đều cho 3 hệ phụ. Ví dụ Lôi Đình Cốc rơi Lôi, Phong, Quang và Âm lãnh.
- Phẩm tàn quyển theo vị diện (bảng dưới). Luck +10 của Tu kim tiền cộng thêm 2% cho 2 phẩm cao nhất.

| Vị diện | Phẩm tàn quyển rơi ra |
|---|---|
| Hạ vị diện | Phàm 60% · Hoàng 28% · Huyền 10% · Địa 2% |
| Trung vị diện | Huyền 40% · Địa 35% · Thiên 20% · Vương 5% |
| Thần vực | Thiên 35% · Vương 35% · Tôn 20% · Tiên 8% · Thần 2% |
| Thánh vực | Tôn 30% · Tiên 35% · Thần 25% · Thánh 10% |

### 20 loại bí cảnh

Tên và tỷ lệ rơi gốc dưới đây là đề xuất, nằm trong khoảng 4–50% đã chốt. Bí cảnh rơi nhiều thì chủ yếu là nguyên liệu; bí cảnh rơi ít thì là nơi ra thần vật.

| Bí cảnh | Rơi gốc | Thế mạnh |
|---|---|---|
| Linh Thạch Quật | 50% | Linh thạch |
| Dược Cốc | 45% | Dược liệu, nguyên liệu đan |
| Khoáng Mạch Động | 45% | Quặng rèn |
| Thú Lâm | 40% | Đan thú, dị thú |
| Cổ Chiến Trường | 35% | Trang bị lam |
| Tàng Kinh Động | 35% | Tàn quyển |
| Ngọc Tủy Động | 30% | Ngọc khảm |
| Linh Tuyền Động | 30% | Kinh nghiệm, tu vi |
| Băng Phách Cung | 25% | Ngọc và đồ hệ Cực hàn, Thủy |
| Lôi Trì | 25% | Nguyên liệu hệ Lôi, Kim |
| Yêu Thú Sào Huyệt | 20% | Thú cưỡi hiếm |
| Cổ Tông Di Tích | 20% | Pháp bảo |
| Đan Tiên Động Phủ | 15% | Đan phương, mảnh lô đỉnh |
| Luyện Khí Di Chỉ | 15% | Mảnh lò rèn, trang bị tím |
| Huyết Sát Ma Quật | 12% | Công pháp luyện tà, đồ sát thủ |
| Thiên Lôi Đài | 10% | Phù chống lôi kiếp, Thần đan |
| Vạn Kiếm Trủng | 10% | Vũ khí tím |
| Tiên Nhân Động Phủ | 7% | Thần vật |
| Thượng Cổ Chiến Trường | 5% | Thần vật, mảnh trấn giáo, tàn quyết bảo vật chấn tông |
| Hỗn Độn Bí Cảnh | 4% | Mọi loại, tỷ lệ thần vật cao nhất |

**Khai thác và nuôi dưỡng (đã chốt).** Bí cảnh bị khai thác nhiều thì chất lượng giảm, phải chế biến hoặc nuôi dưỡng để trở lại như cũ. Đề xuất cách tính: mỗi bí cảnh có linh lực 0–100%; tỷ lệ rơi thực bằng tỷ lệ gốc nhân linh lực. Mỗi lượt khám phá làm giảm 0,2%; linh lực tự hồi 5% mỗi ngày; tông môn chủ nạp linh thạch, dược liệu hoặc nhờ trận pháp sư dựng trận tụ linh để hồi thêm tối đa 20% mỗi ngày.

**PvE khác:** Huyết Sát Môn quấy lãnh thổ vùng biên, boss liên minh cuối tuần, và chiến dịch Tầm Đạo dạy người mới ghép công pháp và đọc khắc chế.

**Nhiệm vụ:** tuyến chính, nhiệm vụ phụ, 8 ải Tầm Đạo, cốt truyện và nhịp kinh nghiệm nằm ở tab Nhiệm vụ và cốt truyện.

## 12. Kinh tế, mỏ và tài nguyên

Tài nguyên nằm trên bản đồ, nên kinh tế và chiến tranh là một: muốn giàu phải giữ được mỏ. Mỗi vị diện dùng linh thạch đúng phẩm của nó (hạ, trung, thượng, cực phẩm); 1 linh thạch phẩm trên = 100 phẩm dưới.

| Loại mỏ | Dùng để | Số mỗi vùng Hạ vị (trung bình) | Cấp tối đa (Hạ / Trung / Thần / Thánh) |
|---|---|---|---|
| Mỏ linh thạch | Giao dịch, tăng cấp tông môn, nâng mỏ | 60 (giảm nửa ngày 2026-11-02, trước là 120) | 5 / 8 / 20 / 100 |
| Mỏ quặng | Rèn pháp bảo, xây công trình | 80 | Đề xuất giống linh thạch |
| Mỏ dược | Luyện đan, tẩy tủy | 40 (giảm nửa ngày 2026-11-02, trước là 80) | Đề xuất giống linh thạch |
| Linh tuyền | Tăng tốc tu luyện cho lãnh thổ quanh nó | 10 | Không có cấp |

Số điểm mỗi vùng chia theo diện tích (đã chốt 2026-11-02): bảng trên là mức của vùng trung bình, nên mật độ mỏ quanh mỗi vị trí sơn môn như nhau ở mọi vùng. 12 vùng Hạ vị có từ 236 điểm (Bích Ba Hải) tới 601 điểm (Cuồng Phong Nguyên), tổng 4.201. Lôi Đình Cốc có 280 điểm, gồm 48 mỏ linh thạch, 64 mỏ quặng, 32 mỏ dược, 8 linh tuyền, 58 vị trí sơn môn và 50 hang dị thú.

**Sản lượng mỏ linh thạch** là 20 × cấp^1,15 mỗi giờ. Mỏ Hạ vị cấp 5 cho 127 hạ phẩm/giờ; mỏ Thánh vực cấp 100 cho khoảng 3.990 cực phẩm/giờ. Nâng mỏ tốn 500 × cấp^1,8 linh thạch cùng phẩm.

**Chất lượng theo vị diện:** quặng đi từ Thiết tinh, Huyền thiết, Tinh kim tới Thần kim; dược liệu cũng 4 bậc tương ứng. Vị diện càng cao thì ít mỏ hơn nhưng mỗi đơn vị đáng giá gấp 100.

**Dòng tiền:**

- Nguồn: mỏ, bí cảnh, nhiệm vụ tông môn, chiến lợi phẩm.
- Chỗ tiêu: hiến tế tăng cấp tông môn (50 XP mỗi linh thạch), nâng mỏ, xây công trình, ghép công pháp, tẩy tủy.
- Chợ: người chơi mua bán tàn quyển, quặng, dược liệu bằng linh thạch. Thuế chợ 5% là chỗ hút tiền chính; Tu kim tiền giảm còn 3% (đề xuất).
- Mục tiêu cân bằng: tông môn trung bình kiếm 2,5 triệu XP mỗi ngày và lên cấp 200 sau khoảng 147 ngày. Đổi tham số này trong sheet Tham số thì mốc ngày ở sheet Cấp tông môn tự tính lại.

### Trang bị: rèn, độ bền và sửa

Trang bị chia theo 5 độ hiếm lục, lam, tím, vàng, đỏ (người dùng chốt 2026-11-03, thay 3 cấp linh, thiên, thần) và cường hóa bằng rèn. Trần cường hóa là +30 ở Hạ vị và Trung vị, +50 ở Thần vực và Thánh vực (đã chốt). Vũ khí và trang bị bị hư hại khi dùng, phải rèn sửa. Mỗi nhân vật mặc 7 món (người dùng chốt 2026-11-03, thêm bao tay): vũ khí, mũ, áo, đai, bao tay, giày, ngọc bội; màn Nhân vật ở mục 14 hiện đủ 7 ô. Áo, mũ và vũ khí hiện trên người; vũ khí ai cũng cầm được, hình hiện theo tài năng người cầm (mục 6, Ngoại hình nhân vật).

| Nấc cường hóa | Thành công (đề xuất) | Thất bại |
|---|---|---|
| +1 đến +10 | 100% giảm dần còn 70% | Không mất gì ngoài nguyên liệu |
| +11 đến +20 | 60% giảm dần còn 30% | Tụt 1 nấc |
| +21 đến +30 | 25% giảm dần còn 10% | Tụt 1–3 nấc, phù bảo hộ giữ nguyên nấc |
| +31 đến +50 | 9% giảm dần còn 2% | Tụt 1–5 nấc, phù bảo hộ giữ nguyên nấc |

- Mỗi nấc cộng 3% chỉ số gốc, nên +30 là +90% và +50 là +150% (đề xuất).
- Độ bền tối đa 100: mất 1 mỗi trận, mất 10 khi chết mà món đó không rơi. Về 0 thì mất hết chỉ số cho tới khi sửa.
- Rèn sửa ở lò rèn thành chủ hoặc Luyện Khí Các của tông môn, tốn linh thạch và quặng theo cấp và nấc của món đồ. Mỗi lần sửa có 10% khả năng giảm 1 điểm độ bền tối đa, để đồ cũ mòn dần và người chơi luôn cần đồ mới (đề xuất).

### Kiểu trang bị, độ hiếm và mã vật phẩm

Mỗi loại trang bị có 60 kiểu có tên riêng, và độ hiếm hiện bằng màu nền ô từ lục (đồ shop) tới đỏ (người dùng chốt 2026-11-03; số 60 là đề xuất trong khoảng 50–70 người dùng đưa).

- **7 loại, 420 kiểu (đề xuất).** Vũ khí, mũ, áo, đai, bao tay, giày, ngọc bội, mỗi loại 60 kiểu. Tên và hình từng kiểu nằm ở danh mục icon của repo game (`assets/icon_ve/danh_muc.md`).
- **Thuộc tính chỉ hiện khi khảm ngọc (người dùng chốt 2026-11-03).** Kiểu chỉ đổi hình và tên, không mang hệ; hệ và thuộc tính của món đến từ ngọc khảm (Ngọc và khảm, bên dưới). Chỉ số gốc tính theo độ hiếm, không theo kiểu (đề xuất).
- **Vũ khí: kiểu chỉ ở trong túi (người dùng chốt 2026-11-03).** 60 kiểu vũ khí là icon và tên món trong túi. Cầm lên vẫn hiện nhóm vũ khí theo tài năng người cầm, và hình trên người theo nhóm độ hiếm, không theo kiểu (mục 6).
- **Mỗi kiểu một độ hiếm cố định (đề xuất).** Màu nền do UI tô, không vẽ vào hình.

| Độ hiếm | Màu nền ô | Nguồn | Số kiểu mỗi loại (đề xuất) |
|---|---|---|---|
| 1 | Lục | Mua ở shop: đồ bình thường | 24 |
| 2 | Lam | Rơi đồ, rèn (đề xuất) | 16 |
| 3 | Tím | Bí cảnh, rèn lò cao (đề xuất) | 12 |
| 4 | Vàng | Thần vật: rất ít rơi, từ bí cảnh và khi săn linh thú, thần thú | 5 |
| 5 | Đỏ | Thần vật, hiếm hơn vàng: từ bí cảnh và khi săn linh thú, thần thú | 3 |

Mỗi lần săn linh thú hoặc thần thú rơi 1–4 món đỏ và 4–5 món vàng (người dùng chốt 2026-11-03); ngoài đó vàng và đỏ rất ít rơi. Số kiểu mỗi màu ở bảng trên chỉ là đề xuất cho danh mục. Linh thú là dị thú phẩm Linh (hiếm ở Hạ vị, nhiều ở Trung vị), thần thú là Tứ Tượng phẩm Thần ở Thánh vực (bảng phẩm loài ở mục 6; người dùng chốt 2026-11-03). Luật chia và trần lượt rơi dưới đây cũng do người dùng chốt 2026-11-03.

- Số món mỗi lần săn chia cho cả party (tối đa 6 người).
- Mỗi người nhận vàng, đỏ từ dị thú tối đa 1 lần mỗi tuần, gộp chung phẩm Linh, Huyền và Thiên. Với party đủ 6 người, đủ 7 ô đỏ mất khoảng 17 tuần.
- Dị thú phẩm Huyền và Thiên cũng rơi vàng, đỏ, ít nhất bằng phẩm Linh, để người chơi không bỏ thú mạnh mà săn thú yếu.
- Thần thú là boss Tứ Tượng do liên minh cùng đánh, nên số món chia cho cả liên minh.

5 màu thay 3 cấp linh, thiên, thần trước đây (người dùng chốt 2026-11-03): lam ứng với linh cấp, tím với thiên cấp, vàng và đỏ là thần vật.

**Mã vật phẩm (đề xuất).** Mỗi món trong danh mục có mã cố định dạng NHÓM-LOẠI-SỐ để dễ theo dõi về sau (người dùng yêu cầu 2026-11-03). Ví dụ TB-KI-001 là Kiếm Thanh Cương, TB-BT-001 là Găng Da Thô.

- Mã đã cấp không đổi, không dùng lại; món mới nhận số kế tiếp.
- Độ hiếm, cấp, nấc cường hóa và ngọc đã khảm là thuộc tính của từng món trong túi, không nằm trong mã.
- Nhóm: TB trang bị, NG ngọc khảm, TQ tàn quyển, CP công pháp, LT linh thạch, QU quặng, DL dược liệu, DA đan, LD linh đơn của thú, PH phù chú, TT trứng thú, LO lô đỉnh và lò rèn, MA mảnh, DB vật phẩm đặc biệt, VK hình vũ khí theo tài năng.
- Loại trong nhóm TB: KI vũ khí (kiếm), MU mũ, AO áo, DA đai, BT bao tay, GI giày, NB ngọc bội; số là số kiểu 001–060.
- Quy ước đầy đủ ở `tools/icon_ve/README.md`, danh sách mã ở `assets/icon_ve/danh_sach.json` (repo game).

### Ngọc và khảm

- Trang bị có dòng khảm; phải kích hoạt dòng trước khi khảm ngọc. Đề xuất: đồ thường 1–3 dòng; đồ bí cảnh thêm 1–2 dòng.
- Ngọc có 12 hệ như nguyên tố, mỗi hệ cấp 1–10 (đã chốt). Đề xuất: ngọc cấp k tăng sát thương hoặc kháng của hệ đó 0,1 × k × (k + 1)%, tức cấp 1 là 0,2%, cấp 5 là 3%, cấp 10 là 11%; khảm trùng hệ linh căn thì hiệu quả +20%. Mỗi hệ có trần mềm: sát thương từ ngọc tối đa 25%, kháng từ ngọc tối đa 15%, tổng kháng một hệ từ mọi nguồn tối đa 20%. Giảm từ 0,25 × k × (k + 1)% ngày 2026-11-04, vì đo thấy ngọc cộng dồn đẩy phần của đồ lên 58% lực chiến, quá trần 35% ở mục 13 (chi tiết ở tab Trang bị, pháp bảo và set đồ, phần 5 và 6).
- Nén ngọc: 3 viên cùng hệ cùng cấp nén thành 1 viên cấp trên. Cấp càng cao tỷ lệ đậu càng thấp (đã chốt).

| Nén lên cấp | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---|---|---|---|---|---|---|---|---|
| Tỷ lệ đậu (đề xuất) | 100% | 90% | 80% | 65% | 50% | 35% | 20% | 10% | 5% |

- Thất bại thì mất ngọc đem nén. Phù chú mua ở chợ giúp không mất ngọc và tăng tỷ lệ thành công (đã chốt). Đề xuất: phù bảo ngọc giữ lại ngọc khi thất bại; phù tăng thành +5%, +10%, +15% theo phẩm; bán bằng linh thạch.
- Luyện ngọc tại khu vực đặc thù tăng tỷ lệ thành công (đã chốt). Đề xuất: vùng có hệ chủ đạo trùng hệ ngọc +10%, sơn môn địa thế Linh mạch thêm +5%.

### Set đồ, pháp bảo và danh mục vật phẩm

Danh mục đầy đủ và hệ thống set nằm ở tab Trang bị, pháp bảo và set đồ, tách riêng vì dài hơn 200 dòng bảng (đề xuất 2026-11-03). Tóm tắt:

- **Set đồ dựa trên ấn bộ.** Ấn khảm vào một dòng khảm như ngọc, nên kiểu vẫn chỉ đổi hình và tên. Đủ 2, 4, 7 món cùng ấn thì có hiệu ứng; có 20 bộ, mỗi loại bí cảnh ra ấn của một bộ. Hiệu ứng nghiêng về đổi hành vi chiêu, khắc chế, hộ trận và kinh tế; cả bộ 7 món quy đổi không quá 6% lực chiến, nằm trong trần 35% của đồ. Đạo Cơ Bàn (bàn lục giác 19 ô, mở dần theo cảnh giới) cho đặt thêm ấn và ngọc: ấn trên bàn tính thêm món cho bộ, hai bộ kề nhau cộng hưởng theo quan hệ hệ ở mục 9.
- **Ba thứ khảm vào dòng khảm:** ngọc 12 hệ (ô vũ khí, bao tay, ngọc bội tăng sát thương hệ; ô mũ, áo, đai, giày tăng kháng hệ), Ý châu chỉ khảm vào vũ khí và đổi hành vi một loại chiêu, ấn bộ cho set.
- **Vũ khí:** 10 khí hình (kiếm, đao, thương, côn, cung, phiến, bút, kỳ, cầm, tiêu) gắn 10 loại chiêu qua Ý châu; khí hình chỉ là hình trong túi. Người dùng chốt 2026-11-03: 34 kiểu đã vẽ giữ là kiếm, 26 kiểu từ lam trở lên chưa vẽ đổi sang 9 khí hình còn lại.
- **Pháp bảo:** ô riêng (1 ô ở Hạ vị, 2 ô từ Trung vị), không cộng chỉ số, tự kích hoạt trong trận để khắc một loại chiêu của địch; dùng linh lực thay độ bền, tế luyện xong thì khóa. Có 10 loại, 50 món; 4 món trấn giáo nay là bậc khởi đầu của bảo vật chấn tông (mục 10).
- **Pháp khí:** 1 ô, công cụ kinh tế ngoài trận theo 8 tài năng.
- **Bổ sung:** 3 phù mới (Thoát Khảm, Di Hồn, Hộ Khí), đủ 120 loại đan, 13 nguyên liệu rèn. Số liệu nằm ở 20 sheet mới của file số liệu (mục 1), xuất ra `data/he_thong/json/`.
- **Sau cấp tối đa (đề xuất 2026-11-04):** lớp luyện khí mở rộng theo chiều ngang, cộng tối đa khoảng 4 điểm lực chiến (đo 2026-11-04: đồ ở đỉnh có cả lớp này là 31,6%, dưới trần 35%). Gồm phân giải đồ thành Khí Tinh, tẩy luyện chỉ số phụ (đổi ngang, Tu rèn chọn được), khí linh cấp 0–9 cho đồ từ tím và 16 khí văn, ngọc song hệ, Ngọc Phách nâng trần mềm một hệ, 10 danh khí luyện cùng tông môn ở lò cấp 9, Bảo Giám sưu tầm và tế luyện tầng pháp bảo.
- **Set đồ 2.0 (người dùng duyệt 2026-11-05):** mỗi bộ thuộc một trong 8 lộ sức mạnh (Ngoại Công, Nội Công, Thủ Ngoại, Thủ Nội, Hấp Thu, Phản Chấn, Khống Tốc, Kinh tế và Khắc chế). Ấn bộ có 5 bậc: lục bán ở shop NPC (có bộ trọn 7 món), lam mua ở chợ, từ tím do boss rơi, vàng và đỏ khóa. Mặc nhiều bộ thì hợp bộ nhân mốc 2 theo hệ ấn (sinh ×1,2, đối cực ×1,3, khắc ×0,8). Thêm 6 binh bộ cho 3 ô công, dòng ẩn trên ngọc bội và đai (hiện "???" tới lần kích đầu), dòng rèn ở +10, +20, +30 và điểm trang bị để so đồ. Phòng thủ tách thành thủ ngoại và thủ nội (người dùng chốt 2026-11-05, mục 8): áo chính thành thủ ngoại +3%, giày chính thành thủ nội +3%. Chi tiết và hai bản đồ tương sinh tương khắc ở tab Trang bị, pháp bảo và set đồ, phần 14.

### Đan dược và lô đỉnh

| Nhóm | Số loại | Công dụng |
|---|---|---|
| Đan dược | 50 loại, mỗi loại 5 cấp | Nhiều công dụng: hồi máu, hồi mana, tăng chỉ số tạm thời, giải độc |
| Linh đan | 40 loại | Trị thương, buff kinh nghiệm, tăng tốc tu luyện |
| Thần đan | 30 loại | Vượt cảnh giới, tăng ngộ đạo, giảm lôi kiếp |

- Ngoài luyện đan sư, tông môn phải tìm và chế tạo lô đỉnh. Lô đỉnh có 10 cấp; lô đỉnh cấp 10 rất khó có, tỷ lệ chế tạo thành công 5%, thường chỉ hợp với tầng cao nhất (đã chốt).
- Cấp lô đỉnh và cấp luyện đan sư cùng đạt cấp của đan thì luyện thành công 100% (đã chốt). Đề xuất: thiếu mỗi bậc thì trừ 20%.
- Tỷ lệ chế tạo lô đỉnh (đề xuất): cấp 1–5 từ 100% giảm còn 60%, cấp 6 là 40%, cấp 7 là 25%, cấp 8 là 15%, cấp 9 là 8%, cấp 10 là 5%.

### Lò rèn

- Lò rèn ở thành chủ có cấp 1–7 cho 3 vị diện dưới và cấp 8 ở Thánh vực (đã chốt).
- Tông môn muốn có lò rèn cấp 9 hoặc 10 phải tìm đủ tài nguyên để xây, tỷ lệ thành công chỉ 2–5% (đã chốt). Đề xuất: cấp 9 là 5%, cấp 10 là 2%.
- Đề xuất: cấp lò quyết định độ hiếm trang bị rèn được và cộng tỷ lệ cường hóa; cường hóa từ +31 cần lò cấp 8 trở lên, từ +41 cần lò cấp 9–10.

**Đỉnh vô chủ trên bản đồ (đã chốt).** Một vài đỉnh luyện đan và đỉnh rèn xuất hiện ngẫu nhiên trên bản đồ. Tông môn tìm thấy thì vị trí được thông báo cho toàn server. Phải có đủ 10 người chơi thủ hộ mới di chuyển được đỉnh, và phải cắt cử người hộ tống về tông môn. Đề xuất: đỉnh vô chủ có cấp 6–10 theo vị diện; đoàn hộ tống đi chậm bằng nửa tốc độ thường và có thể bị chặn cướp trên đường.

### Chợ chung, túi và kho

- Mỗi thành chủ có chợ chung để người chơi bán sản phẩm hạ phẩm, trung phẩm, cao phẩm (đã chốt). Đề xuất: mỗi vị diện một chợ riêng, thuế 5%; NPC trong chợ bán phù chú và đan cơ bản bằng linh thạch.
- Túi và kho mở rộng được tối đa gấp 10 lần (đã chốt). Đề xuất: túi gốc 50 ô, mỗi lần mở +50, tối đa 500; kho cá nhân ở thành chủ gốc 100 ô, tối đa 1.000; giá mỗi lần mở tăng dần. Chỗ chứa là tiện ích nên bán được cả bằng linh thạch lẫn tiên ngọc.

### Cân bằng tỷ lệ rơi

Mục tiêu là lượng tài nguyên vào nền kinh tế bám sát kế hoạch, dù số người chơi và tầm Truyền Tống Trận tăng (đề xuất, chờ bạn duyệt):

- Đặt mục tiêu tài nguyên mỗi người mỗi ngày cho từng vị diện trong cấu hình sống.
- Mỗi 6 giờ, server so sản lượng thực của từng vùng với mục tiêu: vượt quá 10% thì giảm tần suất dị thú, tài bảo, mạch linh thạch và tỷ lệ rơi ngoài bí cảnh, tối đa −30%; thấp hơn thì tăng, tối đa +30%.
- Theo dõi giá trên chợ chung theo phẩm: giá một phẩm giảm quá 20% trong 7 ngày thì giảm tỷ lệ rơi phẩm đó.
- Giảm dần theo người: quá một số lượt rơi trong ngày thì tỷ lệ cá nhân giảm dần, để chống cày bằng bot.
- Bảo hiểm thần vật: 50 lượt bí cảnh liên tiếp không ra vật phẩm từ tím trở lên thì lượt kế tiếp chắc chắn ra đồ tím.
- Chỗ hút tài nguyên ra khỏi nền kinh tế: sửa đồ, cường hóa và nén ngọc thất bại, thuế chợ, phí duy trì tiểu truyền tống, nuôi dưỡng bí cảnh.

### Giá linh thạch và Sàn Linh Ngọc

**Đã chốt:** mọi vật phẩm trong chợ chung mua bằng linh thạch 100%. Người chơi nạp tiền được đổi sang linh thạch, nên linh thạch luôn có giá và mọi mỏ linh thạch, dù cấp nhỏ nhất, đều tạo ra tài chính. Tông môn nhỏ hoặc trung mất mỏ linh thạch có thể giảm 50–70% thu hoạch tài chính.

**Cách đổi (đề xuất, chờ bạn duyệt):**

- Tiên ngọc mua bằng tiền thật đổi ra linh thạch trên Sàn Linh Ngọc ở thành chủ: người nạp bán tiên ngọc, người khai mỏ bán linh thạch, giá khớp theo cung cầu và hiện trên dashboard.
- Hệ thống không tự in linh thạch để bán. Mọi linh thạch đều do mỏ, bí cảnh, nhiệm vụ sinh ra, nên tiền nạp chảy về phía người giữ mỏ và giá linh thạch không bị pha loãng.
- Phí sàn 5% mỗi lệnh; giá dao động tối đa 10% mỗi ngày; mỗi tài khoản mỗi tuần chỉ đổi được tối đa bằng 20% số linh thạch chính mình kiếm trong 7 ngày trước (mục 13).
- Đổi một chiều: không đổi linh thạch hay tiên ngọc ngược ra tiền thật, để tránh rủi ro pháp lý về đổi thưởng.

**Cơ cấu thu nhập mục tiêu (đề xuất):** tông môn nhỏ lấy khoảng 70% thu nhập từ mỏ linh thạch, tông trung 60%, tông vừa 50%, tông lớn 40% (tông lớn có thêm bí cảnh, cống nạp, thuế). Nhờ vậy mất mỏ làm tông nhỏ và trung giảm 50–70% thu hoạch như đã chốt. Mỏ cấp 1 ở Hạ vị ra 20 hạ phẩm mỗi giờ, khoảng 480 mỗi ngày, và số này luôn bán được trên sàn.

## 13. Kiếm tiền

Doanh thu chính đến từ tiên ngọc, thẻ tháng, Thiên Đạo Lệnh và cosmetic. Tiên ngọc nạp bằng tiền thật đổi được sang linh thạch trên Sàn Linh Ngọc (mục 12), nên linh thạch luôn có giá; mọi vật phẩm trong chợ chung chỉ mua bằng linh thạch.

| Sản phẩm | Giá tham khảo (VNĐ) | Nội dung | Vai trò |
|---|---|---|---|
| Thẻ tháng | 49.000 | Nhận tiên ngọc ngay, thêm tiên ngọc mỗi ngày đăng nhập trong 30 ngày | Nguồn thu đều, người chơi Việt đã quen |
| Thiên Đạo Lệnh (mỗi mùa 6 tuần) | 99.000 | Nhánh miễn phí + nhánh trả phí: skin, tiên ngọc, tài nguyên, Thiên Tài Lệnh | Nguồn thu chính |
| Gói nạp đầu | 22.000 | Gấp đôi tiên ngọc lần nạp đầu, 1 đệ tử tư chất Thượng, khung avatar | Chuyển người chơi thành người trả tiền lần đầu |
| Thợ xây thứ 4 và thứ 5 | 49.000–199.000 | Cũng mua được bằng tiên ngọc kiếm trong game | Mua một lần |
| Skin tông môn | 99.000–299.000 | Kiến trúc cả base theo chủ đề (Băng Cung, Hỏa Sơn Thành) | Thuần cosmetic, sau launch |
| Y phục, phi kiếm, hiệu ứng độ kiếp | 49.000–149.000 | Y phục che hình áo, mũ hoặc vũ khí đang mặc, bật tắt từng ô (mục 6); hiện trong trận, replay và lúc độ kiếp | Thuần cosmetic |
| Dịch Dung Đan | 20.000 (đề xuất) | Đổi thân nhân vật (mục 6); lần đổi đầu miễn phí, cũng mua được bằng linh thạch ở chợ NPC | Thuần cosmetic |
| Tiên ngọc lẻ | Nhiều mức | Tăng tốc (giới hạn mỗi ngày), làm mới ứng viên đệ tử | Linh hoạt |

Giá là điểm khởi đầu, sẽ khớp lại theo bậc giá của Google Play và App Store.

**VIP Danh Vọng (sau launch):** cấp VIP theo tổng nạp, vì người chơi Việt đã quen mô hình này. Mỗi cấp chỉ mở tiện ích và vẻ ngoài: thu hoạch một chạm, thêm ô lưu bố cục, khung chat, biểu tượng tên. Không cấp nào cộng chỉ số.

**Thanh toán:** trong app dùng thanh toán của Google Play và App Store; phí 15% cho nhà phát triển nhỏ (dưới 1 triệu USD mỗi năm). Nạp qua web bằng ví điện tử hoặc thẻ cào rất phổ biến ở Việt Nam, nhưng app không được dẫn người chơi ra ngoài để mua; kiểm tra chính sách hiện hành của hai cửa hàng trước khi làm. Giấy phép G1 còn yêu cầu người chơi tra cứu được lịch sử nạp của mình trong game. Nếu đi qua nhà phát hành, họ thường lo phần thanh toán và chốt giá cùng bạn.

**Nguyên tắc giữ giá linh thạch và giới hạn trả tiền:**

- Hệ thống không bán linh thạch trực tiếp; tiên ngọc chỉ ra linh thạch qua Sàn Linh Ngọc giữa người chơi.
- Đổi một chiều, không đổi ngược ra tiền thật.
- Không bán trực tiếp bằng tiền: tàn quyển, công pháp, phẩm, Luck, vé bí cảnh, lượt tranh đoạt, tài năng.
- Không gacha trả tiền cho đệ tử. Nếu sau này có hộp ngẫu nhiên thì công bố tỷ lệ trong game, đúng chính sách cửa hàng.
- Quảng cáo thưởng: tùy chọn, tối đa 5 lượt mỗi ngày, chỉ đổi lấy tăng tốc nhỏ.

**Biên độ nạp: người nạp chỉ nhỉnh hơn 10–20% (đã chốt mục tiêu, số cụ thể là đề xuất):**

1. **Hạn mức đổi gắn với sức tự kiếm.** Mỗi tuần, một tài khoản đổi tiên ngọc ra linh thạch tối đa bằng 20% số linh thạch chính mình kiếm trong 7 ngày trước. Cùng mức chơi, người nạp có tối đa hơn 20% tài nguyên; vì lực chiến tăng chậm dần theo tài nguyên, chênh lệch lực chiến còn khoảng 10–15%. Không chơi thì cũng không đổi được bao nhiêu.
2. **Bậc mạnh nhất không mua được bằng linh thạch.** Nguyên liệu cường hóa từ +21, ngọc từ cấp 7, thần đan và lô đỉnh cấp cao chỉ rơi trong bí cảnh hoặc tông môn chiến và khóa vào nhân vật, không bán được trên chợ.
3. **Tiền mua số lần thử, không mua sự chắc chắn.** Tổng tỷ lệ cộng từ phù tối đa +15%; cường hóa từ +21 và nén ngọc từ cấp 7 tối đa 3 lần mỗi ngày.
4. **Trần lực chiến từ đồ.** Trang bị, ngọc và cường hóa cộng lại chiếm không quá khoảng 35% tổng lực chiến; phần còn lại đến từ cấp, cảnh giới, công pháp và tài năng. Đồ hơn 50% thì lực chiến chung chỉ hơn khoảng 15–18%.
5. **Không mua được thời gian.** Không bán kinh nghiệm; linh đan tăng kinh nghiệm giới hạn số viên mỗi ngày; hiến tế linh thạch lên cấp tông môn có trần mỗi ngày; số NPC thuê trong một trận chiến có trần.
6. **Đo và chỉnh.** Theo dõi lực chiến trung bình của 10% người nạp nhiều nhất so với người không nạp có cùng số giờ chơi. Vượt 20% thì siết hạn mức đổi trong cấu hình sống, không cần ra bản cập nhật.

**Thông điệp marketing:** “mỏ nào cũng có giá, nạp chỉ nhanh hơn chứ không mua được thiên hạ”. Người không nạp có thu nhập thật trong game nhờ bán linh thạch trên Sàn Linh Ngọc, và người nạp chỉ nhỉnh hơn 10–20% lực chiến.

## 14. UI/UX và onboarding

Game có hai chế độ hiển thị (chốt 2026-11-09): ra map thì là HUD kiểu MMORPG mobile, vào quản trị thì là dashboard. Màn hình quản trị chính là Động phủ, dashboard của người chơi; bản đồ, tông môn, công pháp và liên minh nằm trên thanh dưới (tiểu mục Dashboard, nhân vật và bản đồ mini bên dưới). Mọi chức năng cách tối đa 2 lần chạm.

**HUD khi ra map (thời gian thực, đề xuất):**

- Trái dưới: joystick ảo (chạm điểm đến trên map cũng được). Phải dưới: nút đánh thường lớn nhất, xung quanh là 4 nút công pháp đang mang (mục 8), một nút pháp bảo và một nút đan dược; mỗi nút chiêu có vòng đếm hồi chiêu.
- Nút Auto bật tắt ngay cạnh cụm chiêu; bấm giữ mở màn tùy chọn auto và treo máy (tab Nhiệm vụ, phần Tự động).
- Trên cùng: thanh máu và mana của mình, khung mục tiêu đang chọn (máu, hệ, cấp), bản đồ mini ở góc phải.
- Chạm một người chơi hoặc dị thú trên map để chọn mục tiêu và hiện các nút bối cảnh: Đánh, Mời party, Xem trang bị.
- Trong phòng chiến tranh điểm và bí cảnh, HUD giữ nguyên, thêm đồng hồ trận và số người còn lại hai bên.

**Bản đồ (màn Bản đồ):**

- Zoom xa: cả vùng; khu vực điểm tô màu tông môn và liên minh, cửa bí cảnh đang mở.
- Zoom gần: chính map mở đang đứng (mục 3), điểm kèm cấp mỏ, cấp nguy hiểm khu vực, đoàn đang đi kèm giờ tới.
- Lớp lọc: tài nguyên, chiến tranh, liên minh.
- Chạm một điểm mở thẻ điểm: chủ, sản lượng, cấp nguy hiểm, nút Đi tới (auto chạy), Chiếm, Tuyên chiến.
- Nút Vị diện mở hình cả 12 vùng; góc màn luôn có bản đồ mini.

**15 phút đầu (FTUE):**

1. Đăng nhập (dưới 1 phút): xác thực số điện thoại bằng OTP và nhập ngày sinh. Dưới 16 tuổi thì đăng ký bằng thông tin người giám hộ.
2. Chọn vùng bắt đầu trong các vùng đang mở (mục 18); vùng ít người xếp đầu và được chọn sẵn theo gợi ý của hệ thống (mục 3; đề xuất). Mỗi vùng hiện hệ chủ đạo và các tàn quyển hay rơi.
3. Nhận tài năng ngẫu nhiên và linh căn, có hiệu ứng gieo quẻ. Rồi tạo hình: chọn 1 trong 4 thân, áo, mũ và kiểu vũ khí của tài năng vừa nhận; mọi món cùng chỉ số (mục 6, Ngoại hình nhân vật).
4. Gia nhập một tông môn được gợi ý trong vùng (tự lập tông môn mở từ cấp nhân vật 20).
5. Ghép công pháp đầu tiên từ 2 tàn quyển tặng sẵn.
6. Đánh trận PvE đầu tiên và thấy khắc chế hệ hoạt động.
7. Cùng tông môn đánh chiếm một mỏ linh thạch cấp 1 đang do dị thú hoặc Huyết Sát Môn giữ trong tầm Truyền Tống Trận (mục 5, Mỏ của NPC), rồi thu mỏ lần đầu ở Động phủ. Người mới không phải cướp mỏ của người chơi khác. Trong tầm không còn mỏ NPC nào thì bước này dùng một mạch linh thạch tạm thời có dị thú canh (mục 3; đề xuất).
8. Được nhắc giờ bí cảnh gần nhất (12:00 hoặc 20:00) trên thẻ Lịch của Động phủ.

**Nguyên tắc:** mỗi bước hướng dẫn tối đa 2 câu, người chơi phải tự làm chứ không xem. Thuật ngữ Hán Việt có tooltip, ví dụ “Trúc Cơ — cảnh giới thứ 2”. Mục tiêu: từ 80% người chơi hoàn thành FTUE trở lên.

**Hiển thị theo yêu cầu G1:** nhãn phân loại độ tuổi ở màn hình chính; lời nhắc sức khỏe mỗi 30 phút chơi; người dưới 18 tuổi thấy thời gian chơi còn lại trong ngày. Bộ đếm giờ chạy ở server, không tin đồng hồ của máy.

### Dashboard, nhân vật và bản đồ mini

Phần lớn thời gian chơi diễn ra trên map mở với HUD; khi quản trị, năm màn nối bằng thanh dưới: Động phủ · Bản đồ · Tông môn · Công pháp · Liên minh (đề xuất, chờ bạn duyệt). Động phủ là dashboard của người chơi; màn Nhân vật mở bằng cách chạm hình nhân vật trên thanh trên. Mọi chức năng cách tối đa 2 lần chạm từ bất kỳ màn chính nào; trận đấu không có tab riêng mà diễn ra ngay trên map hoặc trong phòng chiến, xem lại qua chiến báo.

*[Hình nhúng: điều hướng đề xuất · 5 tab và 1 lối qua thanh trên — xem bản gốc trên Claude Docs]*

Động phủ là màn mở sẵn; màn Nhân vật mở từ thanh trên nên không chiếm một tab, và không màn nào cần tới lần chạm thứ ba.

| Màn | Vào bằng | Số lần chạm | Hiện gì |
|---|---|---|---|
| Động phủ (dashboard người chơi) | Vào game đứng ở map; tab 1 | 0–1 | Đang chạy (hành trình auto, hàng xây, rèn, luyện đan, bế quan, kèm đếm ngược); Lịch hôm nay (bí cảnh 12:00 và 20:00, chiến tranh 21:00 khi có tuyên chiến, boss liên minh); tối đa 3 thẻ Việc nên làm; Tin báo (chiến báo kèm nút Xem trận, thư, nhiệm vụ đang nhận); bản đồ mini; thẻ Thành chủ |
| Nhân vật | Chạm hình nhân vật trên thanh trên | 1 | Bảng giấy ba phần Thông tin · Pháp tướng · Túi (màn rộng ba cột, điện thoại ba thẻ); chạm một ô trang bị, công pháp hay thú để chọn món trong túi (2 chạm) |
| Bản đồ (bản đồ tranh) | Tab 2 | 1 | Bản đồ tranh của vùng đang đứng (xem Bản đồ tranh ở trên); thẻ điểm và hình cả vị diện cách 2 chạm |
| Bản đồ mini | Có sẵn trên Động phủ, Tông môn, Liên minh và ở góc bản đồ tranh | 0 | Hình vùng, sương mù, điểm có chủ, vị trí của mình; chạm vào là mở bản đồ tranh đúng chỗ đó |
| Tông môn (dashboard tông môn) | Tab 3 | 1 | Cấp và nút Hiến tế, vùng, địa thế, phe, khiên, bảo trợ; thẻ Lãnh thổ, Bảo Khố, Chiến sự, Thành viên; tab con Sơn môn (cảnh 2D công trình và hàng xây), Thành viên, Chiến sự (2 chạm) |
| Công pháp | Tab 4 | 1 | 4 ô công pháp mang vào trận và tầng từng công pháp; bộ truyền thụ để học; tàn quyển trong túi để nộp; Tàng Kinh Các để ghép, từ trưởng lão trở lên (2 chạm) |
| Liên minh | Tab 5 | 1 | Chưa có liên minh: danh sách liên minh cùng vị diện, lời mời, nút Lập (tông môn cấp 20) hoặc Xin vào (cấp 5). Đã có: 5 tông môn thành viên, bản đồ mini lãnh thổ liên minh, lịch chiến, xin hộ chiến, boss, chat có lọc từ và nút báo cáo |
| Thành chủ | Thẻ Thành chủ trên Động phủ, hoặc chạm thành chủ trên bản đồ | 2 | Chợ, Sàn Linh Ngọc, kho cá nhân, lò rèn, nhiệm vụ NPC |
| Xem trận | Chiến báo trên Động phủ | 2 | Phát lại nhật ký lệnh của trận (mục 16) |

**Thanh trên** cố định ở mọi màn chính: hình nhân vật, cấp và cảnh giới (thượng vị: cảnh giới và tu vi), linh thạch đúng phẩm vị diện, tiên ngọc. Sát nghiệp chỉ hiện khi lớn hơn 0; người dưới 18 tuổi thấy thời gian chơi còn lại trong ngày, và nhãn tuổi G1 luôn nằm ở góc.

**Việc nên làm (đề xuất).** Động phủ hiện tối đa 3 thẻ, mỗi thẻ chạm 1 lần là tới đúng màn cần làm. Thứ tự ưu tiên: điểm của tông môn đang bị đánh; mỏ chưa thu quá 8 giờ; ô công pháp còn trống; món đồ độ bền dưới 20; đơn xin vào chờ duyệt (chỉ với người có quyền duyệt); bước FTUE hoặc nhiệm vụ chính kế tiếp. Không còn việc thì thẻ này ẩn, để Động phủ không thành một danh sách nhắc nhở dài.

*[Hình nhúng: bố cục đề xuất · Động phủ và Nhân vật — xem bản gốc trên Claude Docs]*

Động phủ trả lời câu hỏi hôm nay cần làm gì; thẻ Pháp tướng xếp đồ, công pháp và thú quanh vòng 12 hệ, để thấy ngay linh căn hợp với hệ nào.

**Nhân vật: hồ sơ ba phần (đề xuất, theo prototype).** Màn Nhân vật là một bảng giấy. Đầu bảng hiện tên, cảnh giới, cấp và tông môn, kèm nút "?" (cách dùng) và nút đóng. Màn rộng xếp ba phần thành ba cột; điện thoại (375 × 812) chia thành ba thẻ Thông tin · Pháp tướng · Túi, và mọi việc trong màn cách tối đa 2 lần chạm.

- **Thông tin:** các nhóm thu gọn được, nhãn bên trái, giá trị bên phải.
  - Thân phận: cảnh giới và cấp, tông môn, chức vị, phe, sát nghiệp, cống hiến, linh thạch.
  - Linh căn và tài năng.
  - Chỉ số chiến đấu: lực chiến, Máu, Mana, Công lực, Thủ ngoại, Thủ nội (đúng các trường của thư viện mô phỏng trận), chí mạng, sát thương chí mạng, tốc đánh. Chạm một chỉ số hiện bảng nguồn: gốc theo cấp, điểm cộng, đồ, ngọc, thú, tài năng, buff linh căn. Lực chiến vẫn có trần: phần từ đồ khoảng 35% (mục 13), từ thú khoảng 15% (mục 6).
  - Tu luyện: tu vi, tốc độ bế quan, mốc đột phá cảnh giới kế tiếp.
  - Tài khoản: số điện thoại (che bớt), nhóm tuổi, đăng xuất.
  - Cuối phần là nút lớn Bế quan; khi đủ kinh nghiệm ở cấp cuối của cảnh giới, nút đổi thành Đột phá.
- **Pháp tướng:**
  - Nhân vật đứng giữa vòng 12 hệ. Hệ linh căn sáng lên; các vạch nối cho thấy tương sinh, tương khắc, biến dị và đối cực theo mục 8.
  - 7 ô trang bị hai bên (vũ khí, mũ, áo, đai, bao tay, giày, ngọc bội; mục 12). Mỗi ô có nền màu theo độ hiếm (lục, lam, tím, vàng, đỏ); nấc cường hóa, độ bền và số dòng khảm đã có ngọc hiện bằng số (chốt 2026-11-03). Bên trái là mũ, áo, đai, giày; bên phải là vũ khí, bao tay, ngọc bội.
  - Hình ở giữa mặc đúng áo, mũ, vũ khí đang trang bị, hoặc y phục che lên; nút Y phục bật tắt từng ô, nút Dịch dung đổi thân (mục 6).
  - 4 ô công pháp mang vào trận, mỗi ô hiện hệ chủ, hệ phụ và loại chiêu. Đây cũng là 4 ô của tab Công pháp; đổi ở đâu cũng được.
  - 5 ô thú; ô thú đang cưỡi có dấu yên. Bên dưới là các kích phát đang bật và chú giải ký hiệu.
- **Túi:** 50 ô (mục 12), lọc theo loại (trang bị, công pháp, tàn quyển, ngọc, đan dược, nguyên liệu, phù chú, trứng thú) và theo phẩm (hạ, trung, cao). Trang bị lọc thêm theo 5 màu độ hiếm; khi lọc chung theo phẩm, lục và lam xếp vào hạ, tím vào trung, vàng và đỏ vào cao (đề xuất). Công pháp đã học hiện khi lọc Công pháp nhưng không chiếm ô. Khung bên cạnh hiện chi tiết món đang chọn, kèm nút Rèn, Sửa, Khảm; Rèn và Sửa dẫn tới lò rèn thành chủ hoặc Luyện Khí Các của tông môn.

**Thao tác.** Màn rộng kéo thả bằng chuột: kéo món từ túi vào ô để mặc hay mang vào trận, kéo ô về túi để tháo, kéo đổi chỗ hai ô công pháp. Điện thoại: chạm một ô để mở bảng chọn món trong túi; chạm một món trong túi để xem rồi chọn Mặc hoặc Mang vào trận. Thú cưỡi chọn ngay ở ô thú.

**Bế quan (đã thống nhất 2026-11-09, theo công thức đang chạy trong prototype của repo Hoang-Thien-Ky).** Bế quan cho 16q mỗi giờ (q là kinh nghiệm một trận bãi quái cùng cấp, tab Nhiệm vụ), nhân linh khí vị diện (mục 7), trần 8 giờ mỗi ngày. Tông môn giữ linh tuyền thì nhanh thêm 20% (đề xuất; tab Nhiệm vụ từng ghi +50%, thống nhất còn 20% để bế quan không vượt quá vai trò nguồn phụ). Nhịp thiết kế tính theo người đều đặn bế quan 2 giờ mỗi ngày (32q, 10% thu nhập ngày); người cày đủ 8 giờ được 128q. Không còn luật cũ "8 giờ đủ một cấp".

**Bản đồ mini (đề xuất).** Một khung nhỏ vẽ hình vùng đang đứng và sương mù, không vẽ hết 236–601 điểm của vùng. Điểm của tông môn mình mang màu tông môn, điểm đồng minh mang màu liên minh, điểm đang bị đánh nhấp nháy, điểm chưa ai giữ là chấm mờ. Thêm vị trí của mình hoặc đoàn đang đi, sơn môn, thành chủ, cửa bí cảnh đang mở và một khung chữ nhật cho phần bản đồ tranh đang xem. Chạm một chỗ trên bản đồ mini thì bản đồ tranh nhảy tới đó. Trên Tông môn, bản đồ mini thu vào lãnh thổ của tông môn; trên Liên minh, vào lãnh thổ của cả liên minh.

*[Hình nhúng: bố cục đề xuất · Tông môn và Liên minh — xem bản gốc trên Claude Docs]*

Thẻ Bảo Khố đặt ngay dưới Lãnh thổ vì mất mỏ là hết tiền nuôi hộ trận; bảng liên minh đặt lịch chiến cạnh bản đồ mini để nhìn ra mặt trận.

**Quyền theo chức vị.** Dashboard tông môn và liên minh chỉ hiện nút cho việc mà chức vị của người xem được làm (bảng chức vị ở mục 6); ai cũng thấy số liệu. Ví dụ ai cũng thấy Hiến tế; trưởng lão trở lên thấy đơn xin vào và Tàng Kinh Các; chỉ tông chủ và phó tông chủ thấy Tuyên chiến và các nút liên minh. Thẻ Bảo Khố đếm số ngày còn đủ linh thạch trả phí duy trì hộ trận và tiểu truyền tống, vì Bảo Khố cạn thì hộ trận chỉ còn 50% sức kháng (mục 10).

**Kỹ thuật (đề xuất).** Mỗi màn dashboard tải bằng một lệnh đọc gộp (một RPC trả đủ các thẻ), server giữ cache vài giây theo người chơi. Đồng hồ đếm ngược tính từ mốc giờ server gửi kèm; client tự đếm, không hỏi lại mỗi giây. Thẻ đổi khi có sự kiện (trận xong, điểm đổi chủ, tin mới) qua cùng kênh đồng bộ thời gian thực của bản đồ (mục 16). Bản đồ mini vẽ từ file điểm của vùng (`data/maps/ha_diem_<mã vùng>.json`) và bảng chủ điểm, không cần ảnh riêng.

**Bản prototype (Sprint 7).** Bản tối thiểu gồm Động phủ (Đang chạy, Lịch, Việc nên làm, bản đồ mini) và Tông môn (Lãnh thổ, Bảo Khố, Sơn môn); Công pháp dùng màn Tàng Kinh Các của Sprint 5. Màn Nhân vật đã có trong prototype; Liên minh và Chợ để sau Cửa 1 (đề xuất). Thanh dưới của `proto/` đã dùng thanh dưới ở trên; Trận mở từ chiến báo, khi thử thì vào thẳng bằng đường dẫn #tran.

## 15. Mỹ thuật và âm thanh

Bản đồ mỗi vùng là bản đồ tranh kiểu bản đồ cổ, nền xuất từ Azgaar; mỗi điểm vẽ thành một đảo nổi mang màu tông môn đang giữ. Dashboard dùng thẻ phẳng, chữ to, đọc được trên máy nhỏ; trận đấu và sơn môn dùng 2D isometric thủy mặc. Hình trong prototype vẽ bằng PixelLab; hướng mỹ thuật cuối quyết sau Cửa 1. Mỗi hệ có một màu, một ký hiệu và một âm thanh riêng, để người chơi nhận ra hệ ngay cả khi không phân biệt được màu.

| Hệ | Màu | Ký hiệu | Âm thanh |
|---|---|---|---|
| Kim | Trắng bạc | Hình tròn | Kiếm ngân |
| Mộc | Xanh lục | Chiếc lá | Lá xào xạc |
| Thủy | Lam đậm | Gợn sóng | Nước chảy |
| Hỏa | Đỏ son | Ngọn lửa | Lửa bùng |
| Thổ | Vàng đất | Hình vuông | Đá lăn |
| Lôi | Tím điện | Tia sét | Sấm nổ |
| Phong | Xanh ngọc nhạt | Vòng xoáy | Gió rít |
| Quang | Vàng kim | Tia sáng | Chuông trong |
| Âm lãnh | Xám lam | Ngọn lửa ma | Tiếng thì thầm |
| Cực dương | Cam | Mặt trời | Lửa thiêng nổ |
| Cực âm | Tím than | Trăng khuyết | Trống trầm |
| Cực hàn | Xanh băng | Bông tuyết | Băng nứt |

**Hình ảnh:**

- Mỗi công trình có 3 dáng theo nhóm cấp (1–4, 5–8, từ 9), để nhìn base là thấy tiến bộ.
- 8 tài năng nhận ra qua dáng vũ khí, kể cả khi nhỏ trên màn hình điện thoại: thân, áo, mũ do người chơi chọn, còn vũ khí hiện theo tài năng (mục 6, Ngoại hình nhân vật).
- Nhân vật dùng Spine 2D (hoạt hình xương), ít tốn bộ nhớ hơn sprite sheet. Hệ ghép đồ hợp với Spine: mỗi thân một bộ xương, áo là skin, mũ và vũ khí gắn vào xương đầu và cổ tay (đề xuất).
- Trong trận, hình người nhìn chéo về hướng đông nam; đội bên phải vẽ lật ngang để hai đội quay mặt vào nhau (đã chốt 2026-11-02).
- Prototype vẽ bằng PixelLab: thân trống và mỗi bộ áo là một bộ hình có hoạt ảnh riêng; mũ và vũ khí là lớp rời, neo theo đầu và cổ tay từng khung hình. Số hình tối thiểu (đề xuất): 4 thân, 24 bộ áo (3 kiểu khởi đầu và 3 nhóm độ hiếm, trên mỗi thân), 6 mũ và 40 vũ khí (8 nhóm × 5 kiểu).
- UI dạng cuộn giấy; nút xác nhận là ấn triện đỏ.
- AI có thể hỗ trợ phác thảo ý tưởng, nhưng tài sản cuối do họa sĩ hoàn thiện để giữ nhất quán và tránh rủi ro bản quyền.

**Âm thanh:**

- Nhạc cụ: cổ cầm, tiêu, sáo, đàn tranh, trống. Mỗi vùng Ngũ Hành một chủ đề nhạc nền; nhạc chiến nhanh hơn và dồn dập hơn.
- Tiếng đòn đánh theo hệ (bảng trên): nghe là biết hệ, kể cả khi không nhìn màn hình.
- Độ kiếp: sấm lớn kèm rung máy, là khoảnh khắc đáng quay clip nhất game.

## 16. Kiến trúc kỹ thuật

Server quyết định mọi thứ; client chỉ hiển thị và gửi input. Vì vậy sửa client cũng không đổi được kết quả trận hay số tài nguyên. Với combat thời gian thực (chốt 2026-11-09), nguyên tắc này nâng lên một bậc: server tính luôn trận đấu bằng chính thư viện mô phỏng, không còn mô hình "client chạy rồi worker chạy lại để xác minh" như bản dashboard.

*[Hình nhúng: kiến trúc cho một người làm · 6 thành phần — xem bản gốc trên Claude Docs]*

| Lớp | Lựa chọn | Lý do |
|---|---|---|
| Client | Cocos Creator 3.8 trở lên (TypeScript) | Xuất Android và iOS từ một mã nguồn, nhẹ trên máy cấu hình thấp, hỗ trợ Spine sẵn |
| Mô phỏng trận | Thư viện TypeScript thuần, số nguyên fixed-point (`packages/sim`) | Chạy 20 tick/giây trong combat server để tính trận thời gian thực; client dùng cùng mã để hiển thị dự đoán và phát lại chiến báo |
| Game server | Nakama, runtime TypeScript | Tài khoản, liên minh, chat, xếp hạng, chợ, dashboard; điều phối tạo phòng chiến, không tự tính trận |
| World server real-time | Module Go của Nakama (hoặc service Go riêng khi cần), mỗi vùng một match có thẩm quyền | Đồng bộ vị trí, AOI, dị thú, trạng thái điểm ở 10–20 Hz; goja (JS) quá chậm cho việc này (xem Rủi ro hiệu năng) |
| Combat server | Pool worker Node.js chạy `packages/sim` thời gian thực, một trận một phòng | Node nhanh hơn goja nhiều lần; tách pool để tự tăng giảm theo tải |
| Việc định kỳ | Giải đấu và bảng xếp hạng có lịch reset của Nakama | Mở bí cảnh 12:00 và 20:00, mở khung chiến tranh, đóng mùa; không cần worker riêng |
| Xác thực | OTP qua SMS tới số điện thoại Việt Nam | Bắt buộc theo Nghị định 147 |
| Cơ sở dữ liệu | PostgreSQL (hỏi Heroic Labs mức hỗ trợ cho production; phương án khác là CockroachDB) | Nakama hỗ trợ sẵn; mọi khóa dữ liệu có world_id từ đầu để sau này tách thế giới |
| Analytics | Sự kiện ghi ra file log, nạp theo lô vào kho riêng, xem bằng Metabase; từ nấc 100.000 người chuyển sang ClickHouse | Không ghi analytics vào PostgreSQL của game để không tranh tải ghi; không phụ thuộc SDK nước ngoài |
| Hạ tầng | Docker trên máy chủ cloud đặt tại Việt Nam, sao lưu hằng ngày | Thông tin người chơi phải lưu tại Việt Nam |

**Vì sao đổi từ Unity sang Cocos Creator:** làm một mình thì một ngôn ngữ cho cả client và server tiết kiệm nhất. Thư viện mô phỏng viết một lần, chạy ở client để hiển thị và chạy trong Nakama để xác minh, không cần thêm service .NET. Nếu bạn đã thạo Unity thì vẫn dùng được, nhưng phải tự dựng thêm validator .NET.

**Ra cả Android và iOS:** build iOS cần máy Mac có Xcode và tài khoản Apple Developer (99 USD/năm); Google Play thu phí đăng ký một lần 25 USD. Thử mỗi tuần trên ít nhất một máy Android RAM 3 GB và một iPhone cũ.

**Luồng một trận đấu thời gian thực (tranh mỏ, bí cảnh, Chính Điện):**

1. Khi trận tranh một điểm bắt đầu, Nakama khóa điểm, gom bản chụp hai đội (người chơi, NPC, công pháp, trận nhãn) và mở một phòng chiến trên combat server (worker Node chạy `packages/sim`), kèm một seed ngẫu nhiên và một mã trận.
2. Client của mỗi người tham chiến nối vào phòng, gửi input (di chuyển, chọn mục tiêu, tung chiêu, bật auto) tới 10–20 lần mỗi giây; người offline hoặc bật auto thì server tự sinh input theo bộ auto của người đó.
3. Combat server mô phỏng 20 tick mỗi giây, tính hết sát thương, khắc chế, hợp trận; mỗi 100 ms gửi snapshot trạng thái (vị trí, máu, hiệu ứng) trong tầm nhìn (AOI) về client. Client nội suy chuyển động giữa hai snapshot và dự đoán chuyển động của chính mình để không thấy trễ.
4. Hết trận, combat server ký kết quả (kèm mã băm input log và seed) gửi Nakama; Nakama ghi kết quả và chuyển tài nguyên, đổi chủ điểm.
5. Hai tông môn nhận thông báo; chiến báo kèm nút Xem trận phát lại từ input log bằng chính `packages/sim` trên client.

**Luật deterministic (bắt buộc từ sprint đầu):**

- Chỉ dùng số nguyên (fixed-point). Không dùng Math.sin, Math.sqrt hay physics của engine, vì kết quả có thể lệch giữa các máy; dùng bảng tra và hàm số nguyên. Va chạm và tìm đường trên map cũng tính bằng số nguyên trong combat server; client chỉ vẽ theo.
- RNG có seed, thứ tự cập nhật cố định, 20 tick mỗi giây.
- CI chạy 10.000 trận ngẫu nhiên trên bản build client và server, so mã băm từng tick.
- Mỗi bản mô phỏng có số phiên bản; replay cũ phát bằng bản cũ hoặc bị ẩn khi đổi lớn.

**Chống gian lận:** combat hoàn toàn do server tính nên không sửa client được sát thương; movement client gửi vị trí mong muốn, server kiểm tra quãng đường và tốc độ mỗi tick — vượt thì kéo về, lặp lại nhiều lần thì đánh dấu tài khoản. Timer và tài nguyên tính theo giờ server; hóa đơn nạp tiền xác minh ở server; giới hạn tần suất gọi API; cảnh báo khi tỷ lệ 3 sao của một tài khoản cao bất thường. Bãi quái farm lẻ vẫn tính lười theo lực chiến (tab Nhiệm vụ), chỉ mô phỏng thật khi có sự kiện, nên auto của người chơi và bot thật không khác nhau về tải.

**Đồng bộ map mở:** world server (Go) giữ trạng thái sống của từng vùng: vị trí người chơi và dị thú đang hiện, đoàn quân, chủ điểm, sự kiện. Client chỉ nhận entity trong AOI quanh mình (bán kính tầm nhìn theo độ phóng), snapshot 10 lần mỗi giây, mỗi gói dưới 1.500 byte; ra khỏi AOI thì entity biến mất khỏi client. Server lọc theo sương mù: khu vực chưa mở với tông môn và đồng minh thì không gửi điểm và đoàn quân xuống client. Phần tĩnh của vùng (địa hình, vị trí điểm, cấp nguy hiểm, ảnh nền) là file có số phiên bản sinh từ `tools/mapgen`, tải một lần qua CDN. Ngoài giờ chiến tranh match hạ nhịp snapshot còn 2 lần mỗi giây cho đối tượng đứng yên.

**Rủi ro hiệu năng:** runtime JavaScript của Nakama (goja) là trình thông dịch không có JIT, chậm hơn Node.js nhiều lần. Vì vậy ngay từ MVP: combat chạy ở pool worker Node.js riêng, còn world server real-time (vị trí, AOI ở 10–20 Hz) viết bằng Go — bản dashboard cũ ghi đây là phương án dự phòng, bản thời gian thực nâng lên thành mặc định. **Đo thật 2026-11-09 trên Node 24 (máy dev, `npm run bench`):** trận 10 đấu 10 đủ 4 công pháp mỗi người chạy hết 600 tick (trận 30 giây) trong **0,85 ms** — về mặt tính toán, một lõi CPU gánh được khoảng 35.000 trận đồng thời; chừa ngân sách ×100 cho input, snapshot và điều phối thì khoảng **350 phòng chiến mỗi lõi** (đề xuất). Nút thắt thật của world server là băng thông snapshot AOI chứ không phải CPU trận: entity khoảng 16 byte, AOI 50 entity × 10 Hz ≈ 8 KB/s mỗi người, tức khoảng 16 MB/s cho 2.000 người một vùng; nén delta và hạ nhịp khi đứng yên (2 Hz) đưa về khoảng 2–4 KB/s mỗi người (đề xuất, đo lại ở Cửa 1).

### Kiến trúc mở rộng theo nấc

**Nhiều thế giới, không phải một bản đồ khổng lồ.** Một vùng Hạ vị trung bình có khoảng 90 vị trí sơn môn và khoảng 210 điểm giữ được (mỏ, linh tuyền, cửa bí cảnh, đèo, bến đò); tông môn cấp 200 giữ tối đa 20 điểm. Với tông môn trung bình 25–55 người, mỗi vùng chứa được khoảng 2.000–5.000 người và mỗi thế giới 12 vùng khoảng 30.000–50.000 người (ước lượng). Quy mô lớn đạt được bằng cách chạy nhiều thế giới song song. Mỗi thế giới là một bản đồ Thiên Hoang đầy đủ 4 vị diện; tông môn phi thăng trong thế giới của mình. Chat, liên minh, chợ và xếp hạng gói trong một thế giới; tài khoản và thanh toán dùng chung.

| Thành phần | MVP (vài nghìn người) | 100.000 người | 1 triệu người |
|---|---|---|---|
| Thế giới | 1 thế giới, mở dần 4 vùng | 2–4 thế giới | 20–40 thế giới |
| Nakama | 1 node, mỗi vùng 1 match | 1 node cho mỗi thế giới | Như trên, thêm cổng đăng nhập chung |
| World server (vị trí, AOI) | Module Go trong cùng node Nakama | Service Go riêng cho mỗi thế giới, chia zone khi vùng đông | Cụm Go cho mỗi thế giới |
| Combat server (tính trận) | Pool worker Node.js, tự tăng giảm | Nhân theo số trận đồng thời; cân nhắc port `packages/sim` sang Go hoặc WASM | Vài chục đến hơn 100 vCPU |
| Hàng đợi và cache | Redis | Redis cho bảng chủ điểm, khóa điểm, giới hạn tần suất | NATS JetStream, Redis cho mỗi thế giới |
| Cơ sở dữ liệu | 1 PostgreSQL + bản sao, PgBouncer | Mỗi thế giới 1 cơ sở dữ liệu; tài khoản, thanh toán ở cơ sở dữ liệu chung | Như trên |
| Analytics | File log, nạp theo lô | ClickHouse | ClickHouse |

Các phần lần đầu dùng (Redis, NATS, ClickHouse, nhiều thế giới) chỉ thêm khi bài kiểm thử tải ở nấc trước thực sự gãy. Máy chủ, cơ sở dữ liệu, bản sao lưu và object storage chứa thông tin người chơi đều đặt tại Việt Nam; asset không chứa dữ liệu cá nhân được dùng CDN quốc tế.

**Làm ngay ở MVP vì sửa muộn rất đắt:**

- Đo CPU một trận trong Node.js: xong 2026-11-09 (0,85 ms mỗi trận 10 đấu 10, xem Rủi ro hiệu năng). Còn lại: đo băng thông snapshot AOI của một zone thật ở Cửa 1.
- Tách combat ra pool worker Node.js, world real-time viết bằng Go.
- Tính sản lượng mỏ và bãi quái farm kiểu lười: chỉ lưu cấp mỏ và mốc thu cuối, tính khi người chơi mở ra; không chạy tick, không ghi định kỳ.
- Gắn world_id vào mọi khóa dữ liệu.
- Đồng bộ AOI có lọc sương mù; gói snapshot nhỏ, gộp nhiều entity một gói.
- Gộp các lần ghi khoảng 1 giây hoặc theo tông môn rồi ghi một lượt; chat ghi vào log, không ghi vào cơ sở dữ liệu game.

**Kiểm chứng có chọn lọc (đề xuất, chờ bạn duyệt):** combat đã do server tính nên không cần chạy lại để xác minh; thay vào đó, input log của một tỷ lệ nhỏ trận (đề xuất 5–10%) được phát lại ngoại tuyến bằng `packages/sim` để phát hiện lệch hành vi giữa các bản build, và tài khoản bị đánh dấu thì 100% trận của họ được phát lại kiểm tra.

**Dàn đỉnh tải:** vào bí cảnh qua hàng chờ rải trong 2–3 phút thay vì cùng một giây; phát thưởng cuối mùa bằng job nền.

**Hai điểm cần hỏi Heroic Labs trước khi chốt:** bản Nakama mã nguồn mở chạy một node, chạy cụm cần bản Enterprise, nên hỏi bản Enterprise có tự host trên cloud tại Việt Nam được không; và hỏi mức hỗ trợ PostgreSQL cho production, vì tài liệu cài đặt ghi CockroachDB là lựa chọn chính thức. Kiến trúc nhiều thế giới ở trên vẫn chạy được với bản mã nguồn mở, mỗi thế giới một node.

### Kiểm thử tải với 1 triệu người chơi ảo

Không cần người thật: server được thử bằng bot (virtual user), mỗi bot là một chương trình nhỏ giả làm một người chơi. Mốc 1 triệu là bài thử trần để biết hệ thống gãy ở đâu, không phải dự báo số người chơi lúc ra mắt. 1 triệu là tổng của 20–40 thế giới chạy song song, mỗi thế giới 30.000–50.000 bot, không phải 1 triệu bot trên một bản đồ.

**Bot.** Bot là client không giao diện, viết bằng TypeScript trên Node.js, dùng thư viện nakama-js và cùng thư viện mô phỏng với game. Với combat thời gian thực, bot phát lại input log của các trận thật đã ghi (di chuyển, tung chiêu, đổi mục tiêu) đúng nhịp thời gian, nên combat server chịu đúng tải CPU như khi có người chơi thật; khi đi trên map, bot phát input di chuyển theo kịch bản đường đi ghi sẵn. Không vẽ hình nên một máy chạy được hàng nghìn bot; số bot mỗi vCPU đo thật ở nấc đầu rồi mới tính số máy cho các nấc sau.

**Mô hình tải (workload model).** Người thật không bấm liên tục: giữa hai thao tác quản trị có thời gian nghĩ (think time), nhưng khi đang trên map thì input di chuyển chảy liên tục. Giả định ban đầu: 30% người chơi online đang trên map và phát trung bình 5 input mỗi giây, còn lại đang ở dashboard với trung bình 20 giây một thao tác. 1 triệu bot tương đương khoảng 50.000 lệnh quản trị mỗi giây cộng khoảng 1,5 triệu input map mỗi giây trên toàn hệ thống (chia cho 20–40 thế giới), chưa kể snapshot AOI server đẩy xuống 10 lần mỗi giây. Tỷ lệ thao tác dưới đây là giả định; từ thử nghiệm kín trở đi, thay bằng tần suất thật lấy từ sự kiện analytics ở mục 19.

| Thao tác của bot | Tỷ lệ (giả định) | Phần server chịu tải |
|---|---|---|
| Input di chuyển và chiêu trên map | Chiếm đa số gói tin | World server Go (AOI, kiểm tra tốc độ), combat server |
| Mở Động phủ, thu mỏ | 25% lệnh quản trị | PostgreSQL đọc gộp và ghi, timer theo giờ server |
| Xem bản đồ, nhận snapshot vùng | 20% | World server, match có thẩm quyền của vùng |
| Chat tông môn và liên minh | 15% | Chat Nakama, lọc từ, lưu log |
| Hành trình auto, chiếm điểm | 10% | World server, khóa điểm |
| Trận phòng chiến (input log) | 10% | Combat server, CPU nặng nhất |
| Tàng Kinh Các, ghép công pháp | 5% | PostgreSQL |
| Chợ, giao dịch | 5% | Giao dịch cơ sở dữ liệu, chống trùng |
| Cống hiến, duyệt thành viên | 5% | PostgreSQL |
| Vào bí cảnh | 5% | Phòng bí cảnh, combat server |

**Cùng một bộ bot, bốn kiểu chạy.**

| Kiểu | Cách chạy trong game này | Bắt lỗi gì |
|---|---|---|
| Load test | Giữ mức tải bình thường của nấc đang thử | Xác nhận đạt ngưỡng p95, p99 |
| Stress test | Đẩy vượt mức bình thường 1,5 đến 2 lần | Biết hệ thống xuống cấp ra sao |
| Soak test | Giữ tải 8 đến 24 giờ | Rò bộ nhớ runtime TypeScript, PostgreSQL phình, hàng đợi ùn |
| Spike test | Tải tăng đột ngột trong vài phút | Các đỉnh riêng của game, xem dưới |

Kịch bản spike lấy từ những lúc cả server cùng hành động: 30% bot cùng vào bí cảnh trong 5 phút lúc 12:00 và 20:00; khung chiến tranh mở, hàng trăm tông môn cùng tuyên chiến và đánh tranh điểm; một tông môn 60 người cùng hộ pháp 5 đợt lôi kiếp phi thăng; đóng mùa và phát thưởng bảng xếp hạng.

**Tăng dần theo nấc (ramp-up), không nhảy cóc.** Không bật 1 triệu bot một lần. Mỗi nấc thường gãy ở một chỗ khác nhau, nên bỏ nấc là bỏ lỡ lỗi. Sau nấc cuối, tiếp tục tăng cho tới khi gãy (breakpoint test) và ghi lại nấc gãy.

| Nấc | Chỗ dự đoán sẽ gãy trước |
|---|---|
| 1.000 bot | Lỗi logic, deadlock khi hai trận cùng tranh một điểm; đo số bot mỗi vCPU; đo CPU một phòng chiến và băng thông AOI thật |
| 10.000 bot | Pool combat server; world server Go của vùng trong giờ chiến tranh (hàng trăm phòng chiến cùng mở) |
| 100.000 bot | Số kết nối và khóa ghi của PostgreSQL trong một thế giới; băng thông snapshot tổng của một thế giới; đây là nấc bắt đầu chạy 2–4 thế giới song song |
| 1.000.000 bot | 20–40 thế giới cùng lúc: cổng đăng nhập chung, cơ sở dữ liệu tài khoản và thanh toán chung, cụm world server và combat server, biên mạng |

Mỗi nấc giữ ít nhất 1 giờ. Một thế giới phải chịu được 50.000 bot và đạt đủ ngưỡng p95, p99 trước khi nhân lên nhiều thế giới.

**Đo bằng p95 và p99, không đo bằng trung bình.** p95 là mức mà 95% lệnh nhanh hơn; p99 là mức mà 99% lệnh nhanh hơn. Một nấc chỉ tính là qua khi đạt đủ các ngưỡng dưới đây (đề xuất, chờ bạn duyệt).

| Loại lệnh | p95 | p99 |
|---|---|---|
| Lệnh thường (thu mỏ, chợ, tông môn) | dưới 300 ms | dưới 800 ms |
| Input map → thấy phản hồi trong snapshot | dưới 150 ms | dưới 300 ms |
| Snapshot AOI tới client | dưới 100 ms nội vùng | dưới 200 ms |
| Combat server xử lý tick (không trễ nhịp 20 Hz) | dưới 25 ms mỗi tick | dưới 40 ms |
| Tỷ lệ lỗi | dưới 0,1% toàn bài thử |  |

**Dùng open model để số liệu không đẹp giả.** Với closed model, bot đợi trả lời xong mới gửi lệnh tiếp; server chậm thì bot cũng gửi chậm theo, nên độ trễ đo được thấp hơn thực tế (coordinated omission). Bài thử chính dùng open model: lệnh đến theo nhịp cố định dù server nhanh hay chậm, và độ trễ tính từ thời điểm lệnh lẽ ra được gửi. Bộ lập lịch của bot chạy theo nhịp đến cố định và ghi độ trễ vào histogram; phần API HTTP có thể thử bằng k6 với chế độ constant-arrival-rate. Closed model chỉ dùng để kiểm tra luồng một phiên chơi đúng thứ tự.

**Máy bắn tải phải chạy riêng.** Bot chạy trên cụm máy riêng, không chung với server. Nếu CPU hoặc mạng của máy bắn tải nghẽn trước server (vượt khoảng 70% CPU) thì loại kết quả lần chạy đó, vì lúc đó đang đo máy bắn chứ không đo server. Cụm máy cho nấc 1 triệu chỉ thuê theo giờ, tắt ngay sau bài thử.

**Môi trường thử.** Một bản staging giống hệt production, đặt tại Việt Nam. OTP SMS thay bằng dải số thử nội bộ để không tốn tiền SMS; thanh toán dùng sandbox; mọi sự kiện analytics của bot gắn cờ bot để không lẫn vào số liệu Metabase. Tài khoản bot chỉ có dữ liệu giả, không chứa thông tin cá nhân thật.

**Lịch theo lộ trình (mục 18).** Mỗi lần CI chạy 1.000 bot trong 15 phút. Nấc 10.000 xong trước thử nghiệm kín; nấc 100.000 cùng soak test 24 giờ xong trước open beta; nấc 1 triệu và breakpoint test xong trước launch. Từ thử nghiệm kín, mô hình tải cập nhật lại theo dữ liệu thật trước mỗi nấc.

## 17. LiveOps và mùa giải

Mỗi mùa dài 6 tuần, có chủ đề, một Thiên Đạo Lệnh và một sự kiện thế giới. Mùa không reset lãnh thổ; chỉ thăng vị diện mới đưa tông môn về cấp 1.

| Lịch | Hoạt động cố định |
|---|---|
| Hằng ngày | Bí cảnh 12:00 và 20:00, mỗi lần 30 phút |
| Thứ Ba, Thứ Năm, Thứ Bảy | Chiến tranh địa bàn 21:00–22:00 |
| Thứ Sáu – Chủ Nhật | Boss liên minh |
| Chủ Nhật | Đấu giá tàn quyển phẩm cao ở chợ |

**Ba mùa đầu (đề xuất):**

1. **Linh Mạch Phục Tô:** mở Hạ vị diện, xếp hạng tông môn lên cấp cao nhanh nhất.
2. **Yêu Triều:** yêu thú tràn từ Hư Không Hải vào các vùng biên, liên minh cùng giữ đất.
3. **Phi Thăng:** mở Trung vị diện cho các tông môn đủ cấp 200.

**Sự kiện lễ:** Tết Nguyên Đán (skin hoa đào, lì xì tiên ngọc) và Trung Thu (đèn lồng, bí cảnh Nguyệt Cung).

**Cân bằng:** patch mỗi 2 tuần theo tỷ lệ thắng của từng hệ và vai trò. Mỗi mùa có “Thiên Đạo biến”: một hệ được +5%, để meta xoay vòng.

**Cộng đồng:** Discord hoặc group Facebook, devlog 2 tuần một lần, và một hội đồng gồm các Minh chủ top để góp ý trước mỗi patch.

## 18. Phạm vi MVP và lộ trình phát hành

MVP chỉ gồm Hạ vị diện: 12 vùng bản đồ mở, tông môn cấp 1–200, lãnh thổ, mỏ, bí cảnh, ghép công pháp và chiến tranh địa bàn thời gian thực. Thăng vị diện và Trung vị diện ra sau launch. Làm một mình, ước tính khoảng 30 tháng tới open beta (đề xuất 2026-11-09, trước là 24 tháng), vì netcode thời gian thực (world server, AOI, client prediction) và đồ họa map mở nặng hơn bản dashboard trước; bù lại, auto đầy đủ giữ được nhịp phiên ngắn và `packages/sim` vẫn dùng được nguyên cho combat server.

Cửa 1 là lúc sửa rẻ nhất: chạy trên map và đánh một trận mà chưa vui thì mọi thứ xây trên nó đều phí. Prototype Cửa 1 đổi mục tiêu thành: một vùng map mở chạy real-time, một nhân vật điều khiển tay + auto, một trận PvE và một trận PvP 10 đấu 10 trên combat server.

*[Hình nhúng: lộ trình đề xuất · 5 giai đoạn, 4 cửa — xem bản gốc trên Claude Docs]*

| Hạng mục | Có trong MVP | Để sau launch |
|---|---|---|
| Bản đồ | 12 vùng Hạ vị diện, mở dần 4 vùng một lúc theo số người chơi | Trung vị diện, Thần vực, Thánh vực |
| Giao diện | HUD map mở (joystick, nút chiêu, Auto), Động phủ, Tông môn, Công pháp, Liên minh, màn Nhân vật, bản đồ mini (mục 14) | Tự sắp xếp thẻ trên Động phủ (đề xuất) |
| Tông môn | Cấp 1–200, lãnh thổ, 10 công trình | Phi Thăng Đài, thăng vị diện |
| Công pháp | 12 hệ, 10 loại chiêu, 480 tàn quyển, phẩm 1–4 | Phẩm 5–10 |
| Nhân vật | 8 tài năng, cấp 1–250, luật phản bội | Tẩy tủy (cần Trung vị diện) |
| Chiến tranh | Liên minh, tuyên chiến, chiếm điểm, trận tranh mỏ và bí cảnh | Chiến tranh giữa các vùng |
| Bí cảnh | Trung bình 6 bí cảnh mỗi vùng, 12:00 và 20:00, tranh đoạt | Đảo bí cảnh ở Hư Không Hải |
| Kinh tế | Mỏ linh thạch, quặng, dược; chợ | Đấu giá, Thương hội |
| Kiếm tiền | Gói nạp đầu, thẻ tháng, Thiên Đạo Lệnh | Skin, VIP Danh Vọng |
| Tuân thủ G1 | Xác thực số điện thoại, giới hạn giờ chơi, nhắc 30 phút, lịch sử nạp | Không áp dụng: phải có đủ trước khi mở cửa |

**Làm một mình:** bạn giữ thiết kế, lập trình client, mô phỏng và server. Thuê ngoài theo hợp đồng: họa sĩ 2D (concept, công trình, nhân vật Spine, UI), âm thanh, và luật sư cho hồ sơ G1. Dùng công cụ AI hỗ trợ viết code và kiểm thử để bù thiếu người.

**Pháp lý (phát hành tại Việt Nam trước):** game có PvP và liên minh qua server thuộc nhóm G1 theo Nghị định 147/2024/NĐ-CP. Theo [Điều 39](https://hethongphapluat.com/decree-no-147-2024-nd-cp-dated-november-9-2024-on-management-provision-and-use-of-internet-services-and-cyber-information/dieu-39), chỉ doanh nghiệp Việt Nam có đăng ký ngành trò chơi điện tử trên mạng mới được cấp giấy phép G1, nên cá nhân không tự xin được. Có hai đường:

1. Lập công ty, xin Giấy phép cung cấp dịch vụ G1, rồi xin Quyết định phát hành cho riêng game này.
2. Ký với một nhà phát hành trong nước đã có giấy phép. Họ lo giấy phép, thanh toán, chăm sóc khách hàng và marketing, đổi lại ăn chia doanh thu theo hợp đồng.

Làm một mình thì đường 2 thường nhanh hơn. Dù chọn đường nào, game vẫn phải tự có các tính năng dưới đây, nên chúng nằm trong MVP.

| Yêu cầu theo Điều 39 | Cách làm trong game |
|---|---|
| Xác thực tài khoản bằng số điện thoại di động Việt Nam; chỉ tài khoản đã xác thực mới được chơi | OTP qua SMS ở bước đăng nhập |
| Người dưới 16 tuổi đăng ký bằng thông tin cha, mẹ hoặc người giám hộ | Hỏi ngày sinh trước; dưới 16 thì chuyển sang form người giám hộ |
| Người dưới 18 tuổi chơi tối đa 60 phút/ngày mỗi game và 180 phút/ngày cho mọi game của doanh nghiệp | Bộ đếm giờ ở server; phiên 5–10 phút nên vẫn chơi trọn vòng một ngày |
| Hiển thị phân loại độ tuổi, nhắc sức khỏe mỗi 30 phút | Nhãn tuổi ở màn hình chính, lời nhắc trong game |
| Lưu họ tên, ngày sinh, số điện thoại người chơi tại Việt Nam | Cơ sở dữ liệu trên máy chủ đặt tại Việt Nam |
| Người chơi tra cứu được thông tin tài khoản thanh toán của mình | Màn lịch sử nạp trong game |
| Kiểm soát nội dung trao đổi, lưu nhật ký sử dụng | Lọc từ trong chat, nút báo cáo, lưu log |

Sau đợt sáp nhập năm 2025, mảng này do Bộ Văn hóa, Thể thao và Du lịch quản lý (Cục Phát thanh, Truyền hình và Thông tin điện tử). Bộ đang lấy ý kiến dự thảo sửa đổi Nghị định 147 ([VnEconomy](https://vneconomy.vn/co-nen-cho-phep-phat-hanh-tam-thoi-game-chua-duoc-cap-phep-de-phuc-vu-esport.htm)), nên kiểm tra lại quy định trước khi nộp hồ sơ. Hỏi luật sư hoặc nhà phát hành xem thử nghiệm kín trước khi có Quyết định phát hành được làm tới đâu.

## 19. Chỉ số và phân tích

Mỗi giai đoạn có chỉ số qua cửa. Chưa đạt thì sửa vòng lặp hiện có, không thêm tính năng mới.

| Chỉ số | Mục tiêu closed beta | Mục tiêu open beta |
|---|---|---|
| Hoàn thành FTUE | ≥ 80% | ≥ 85% |
| Quay lại ngày 1 (D1) | ≥ 35% | ≥ 40% |
| Quay lại ngày 7 (D7) | ≥ 12% | ≥ 15% |
| Quay lại ngày 30 (D30) | Chưa đo | ≥ 5% |
| Số phiên mỗi ngày | ≥ 3 | ≥ 4 |
| Vào tông môn trong 3 ngày đầu | ≥ 50% | ≥ 60% |
| Tỷ lệ người trả tiền | Chưa đo | 2–4% |
| Doanh thu mỗi người so với chi phí kéo một người | Chưa đo | Doanh thu lớn hơn chi phí |

Các mốc là tham khảo cho thể loại chiến thuật mobile, sẽ chỉnh theo dữ liệu thật.

**Sự kiện cần ghi:** từng bước FTUE, vùng bắt đầu, tài năng nhận, chiếm điểm (loại điểm, quãng đường từ thành chủ), chiếm và mất mỏ, lượt bí cảnh và tàn quyển rơi (hệ, phẩm), ghép công pháp (tổ hợp, phẩm), trận đấu (hệ, loại chiêu, tỷ lệ auto hay tay, kết quả), tuyên chiến, phản bội tông môn, giao dịch ở chợ, mua hàng, mở và đóng phiên, chạm thẻ dashboard (thẻ nào, mở màn nào, sau mấy lần chạm).

**Bảng theo dõi:**

- Phễu FTUE theo từng bước.
- Retention theo nhóm ngày cài đặt và theo vùng bắt đầu.
- Kinh tế: nguồn và tiêu từng tài nguyên theo ngày; giá tàn quyển ở chợ.
- Tỷ lệ dùng và tỷ lệ thắng theo hệ, loại chiêu và tổ hợp, để cân bằng.
- Tốc độ lên cấp tông môn so với mục tiêu 147 ngày tới cấp 200.
- Bỏ game sau khi mất lãnh thổ hoặc mỏ.

## 20. Rủi ro và câu hỏi mở

Rủi ro lớn nhất là phạm vi: bản đồ thời gian thực, 28 vùng và 480 tàn quyển lớn hơn bản trước nhiều lần, trong khi bạn làm một mình. Các biện pháp dưới đây phải bắt đầu từ prototype.

| Rủi ro | Biện pháp | Làm từ khi nào |
|---|---|---|
| Phạm vi quá lớn cho một người | MVP chỉ Hạ vị diện; dữ liệu công pháp sinh từ file Excel thay vì làm tay; thuê ngoài mỹ thuật; auto đầy đủ để cắt nội dung phải làm tay | Ngay bây giờ |
| Kiệt sức, trễ hạn | Mỗi tháng có một bản chơi được; dùng AI hỗ trợ code và kiểm thử | Ngay bây giờ |
| Netcode thời gian thực vượt sức một người (chuyển đổi 2026-11-09) | Cửa 1 làm trước: một vùng map mở, combat server chạy `packages/sim`; movement chỉ client prediction cho chính mình, người khác nội suy; bãi quái farm vẫn tính lười nên phần real-time thật chỉ gom ở PvP, boss và tranh điểm | Prototype |
| Map mở thời gian thực quá tải server | World server Go, AOI lọc tầm nhìn, snapshot 10 Hz hạ nhịp khi đứng yên, lọc theo sương mù; thử tải 2.000 người giả lập mỗi vùng | Prototype |
| 480 tàn quyển mất cân bằng | Cân bằng bằng tham số trong Excel; theo dõi tỷ lệ thắng theo tổ hợp; patch 2 tuần | Closed beta |
| Tông môn lớn đè tông môn nhỏ | Giới hạn chênh cấp khi tuyên chiến, khiên tông môn mới, khung giờ chiến cố định | MVP |
| Server vắng khi mới mở | Mở 4 vùng trước, thêm vùng theo số người; tông môn NPC lấp chỗ | MVP |
| Thế giới già bị thao túng | Theo dõi chỉ số tập trung lãnh thổ; mở thế giới mới theo lịch; cơ chế gộp thế giới (mục 21) | Open beta |
| Gian lận | Combat server tính toàn bộ, client chỉ gửi input; kiểm tra tốc độ di chuyển mỗi tick; không gửi điểm còn trong sương mù | Prototype |
| Studio cày thuê vì Sàn Linh Ngọc | Hạn mức đổi gắn với sức tự kiếm (mục 13); phát hiện hành vi bot và giao dịch bất thường (mục 21) | MVP |
| Phản bội hàng loạt phá tông môn | Luật dừng tầng và giảm 50%; khóa gia nhập 72 giờ khi đang chiến (chờ duyệt) | MVP |
| Không có giấy phép G1 đúng hẹn | Chọn sớm giữa lập công ty và nhà phát hành; làm sẵn tính năng tuân thủ | MVP |

**Câu hỏi mở — đã gom nhóm tại phiên duyệt 2026-11-09.** Mỗi nhóm ghi quyết định đề xuất của phiên này (tự chọn theo ủy quyền, đánh dấu "đề xuất chốt", chờ bạn xác nhận lại một lượt); muốn đổi câu nào thì mở lại riêng câu đó.

### Đã chốt, không mở lại

- [x] Đội: một người, thuê ngoài mỹ thuật và âm thanh.
- [x] Nền tảng: Android và iOS cùng lúc.
- [x] Thị trường đầu tiên: Việt Nam.
- [x] Mô hình tông môn: người chơi gia nhập tông môn của người khác như guild (đã chốt, xem mục 6).
- [x] Linh khí theo vị diện: Hạ ×1, Trung ×4, Thần ×8, Thánh ×12 (đã chốt, xem mục 3 và 7).
- [x] 12 hệ giữ đúng như bảng mục 3, có Phong, Quang và Âm lãnh (đã chốt).
- [x] Cấp nhân vật: Hạ vị tối đa 250; Trung vị về cấp 1, giữ chỉ số, tối đa 200; thượng vị không còn cấp, tu luyện chiêu thức với tỷ lệ 30% (đã chốt, xem mục 7).
- [x] Xuất sư hợp lệ chỉ dừng tầng công pháp, không bị giảm 50% (đã chốt, xem mục 6).
- [x] Thể loại: MMORPG mobile thời gian thực, auto đầy đủ; điểm tranh giữ trên bản đồ mở dạng khu vực có tọa độ (chốt 2026-11-09, chuyển từ chiến lược dashboard).
- [x] Tên chính thức: Thiên Hoang Ký (chốt 2026-11-05, đổi sang Hoàng Thiên Ký rồi quay lại Thiên Hoang Ký trong ngày 2026-11-09; tên tạm Khai Tông Lập Phái). Việc kiểm tra trùng tên và nhãn hiệu chuyển sang nhóm J.
- [x] Engine: Cocos Creator + TypeScript toàn stack (chốt 2026-11-09 theo hướng repo đang chạy; world server real-time bằng Go, xem mục 16).
- [x] Bế quan: 16q mỗi giờ nhân linh khí vị diện, trần 8 giờ mỗi ngày, linh tuyền +20% (thống nhất 2026-11-09 giữa mục 14 và tab Nhiệm vụ, thay luật cũ "8 giờ đủ một cấp"; bảng ngày đều đặn tính 2 giờ).
- [x] Bãi quái trên bản đồ: mỗi vùng cần khoảng 50 hang dị thú phủ cấp nguy hiểm 60–250 theo bậc 10; cấp nguy hiểm tính theo quãng đường tới thành chủ (bản đồ commit 34d9da0), nên vùng nào cũng đủ 2 hang mỗi bậc 10 cấp từ 10 tới 250.
- [x] Chọn vùng ở FTUE: đã thống nhất ở mục 14 bước 2 (chọn trong các vùng đang mở, vùng ít người xếp đầu).
- [x] Mục 3 bỏ chữ biển: Linh Hải là cao nguyên tụ linh khí, Hư Không Hải là vùng đất chết.
- [x] Quang và Âm lãnh (mục 8): vòng khắc một chiều Hỏa → Âm lãnh → Kim → Quang → Hỏa; tab nhiệm vụ dùng vòng này cho trận cuối các vùng và ải Tầm Đạo.
- [x] Cửa bí cảnh cho người mới (mục 11, bản đồ commit 3bd3877): vùng nào cũng có ít nhất 1 cửa bậc thấp dưới cấp nguy hiểm 50.
- [x] Ngoại hình nhân vật (mục 6, 12, 13, 14, 15): chốt 2026-11-02. Chọn 1 trong 4 thân trống; áo, mũ, vũ khí hiện trên người; y phục che lên trang bị; vũ khí hiện theo tài năng; đồ khởi đầu cùng chỉ số; đổi thân bằng Dịch Dung Đan; trong trận đội bên phải lật ngang.
- [x] Độ hiếm 5 màu thay 3 cấp linh, thiên, thần (mục 6, 11, 12, 14, 15): chốt 2026-11-03.
- [x] Vàng và đỏ (mục 12): "1–4 món đỏ và 4–5 món vàng" là số món rơi mỗi lần săn linh thú, thần thú: chốt 2026-11-03.
- [x] Linh thú và thần thú (mục 3, 6, 12): dị thú phẩm Linh và Tứ Tượng phẩm Thần, chốt 2026-11-03.
- [x] Rơi vàng, đỏ khi săn linh thú (mục 6, 12): số món chia cho cả party; mỗi người tối đa 1 lần mỗi tuần, gộp phẩm Linh, Huyền, Thiên; thần thú chia cho cả liên minh. Chốt 2026-11-03.
- [x] Bao tay (mục 6, 12, 14): 7 ô trang bị, chốt 2026-11-03.
- [x] Vũ khí (mục 6, 12): 60 kiểu là icon và tên trong túi; cầm lên hiện nhóm vũ khí theo tài năng; hình trên người theo nhóm độ hiếm. Chốt 2026-11-03.
- [x] Vũ khí 10 khí hình (mục 12): giữ 34 kiểu kiếm đã vẽ, 26 kiểu đổi sang 9 khí hình còn lại. Chốt 2026-11-03.
- [x] Set đồ 2.0 (tab Trang bị phần 14): 8 lộ, mốc 2 và 4 viết lại, hợp bộ, 6 binh bộ, dòng ẩn, dòng rèn, điểm trang bị. Người dùng duyệt 2026-11-05.
- [x] Tách phòng thủ thành thủ ngoại và thủ nội (mục 8). Người dùng duyệt 2026-11-05.
- [x] Bậc ấn và nguồn (tab Trang bị): lục ở shop NPC, lam ở chợ, tím do boss rơi, vàng và đỏ khóa. Người dùng duyệt 2026-11-05.
- [x] Cân bằng 10 loại chiêu (mục 8): nội đấu ngoại 52,4% không đồ, 48,3% đồ đỉnh; kèm Thủy mana −5%, Văn Uyên mốc 4 còn 4,5%. Người dùng duyệt 2026-11-05.
- [x] Sức chứa vùng (mục 3, 5, 16): không giới hạn số tông môn; điểm cố ý thiếu để tranh nhau. Chốt 2026-11-02.
- [x] Hồi phục yếu nhất trong 10 loại chiêu (mục 8): duyệt chỉnh, đã áp vào bảng 10 loại chiêu (hồi ×0,90, tốn mana gấp 3, hồi mana −20% khi đang vận). Chốt 2026-11-09.
- [x] Câu "thắng trên 97%" ở mục 8: đã sửa thành 84–97% theo số đo 2026-11-04; ngưỡng đạt khi cân bằng là ≥ 70%. Chốt 2026-11-09.

### Nhóm A — Vận hành tông môn (mục 6)

- [ ] Lập tông ở cấp 20 với 10.000 linh thạch; ngoại môn 7 ngày; tàn quyển thuộc người nhặt; tông chủ vắng 14 ngày thì chuyển quyền; phản bội khi đang chiến khóa gia nhập 72 giờ. **Đề xuất chốt: duyệt tất.**
- [ ] Nhân sự theo quy mô và NPC thay thế: chỉ số NPC bằng 90% người chơi cùng cấp đồ +10 ngọc cấp 3, trả lương mỗi ngày, NPC không có quyền quyết định. **Đề xuất chốt: duyệt.**
- [ ] Prototype chơi một mình: nhiệm vụ 0.3 đổi thành lập tông (bỏ điều kiện cấp 20), hộ pháp và party do đệ tử NPC đứng. **Đề xuất chốt: duyệt.**

### Nhóm B — Bản đồ, PvP và hình phạt (mục 3, 5)

- [ ] Luật bản đồ đã chuyển sang thời gian thực (2026-11-09): điểm là khu vực trên map mở, di chuyển tự do có auto chạy, dị thú lang thang thay xác suất gặp sự kiện; cấp nguy hiểm theo quãng đường giữ nguyên. **Đề xuất chốt: duyệt.**
- [ ] Đồ sát và lao tù: sát nghiệp +1 mỗi lần giết người không sát nghiệp, giảm 1 điểm mỗi 6 giờ online; tên đỏ từ 5 điểm, tù 4–12 giờ; "mất đồ" của tông môn hắc ám là mất hết đồ đang mặc; thành viên tông tà vẫn vào được thành chủ và dùng chợ (trong thành không giao chiến). **Đề xuất chốt: duyệt theo hướng làm rõ này.**
- [ ] Tử vong: rơi 1 món ngẫu nhiên, trừ 10% kinh nghiệm cấp hiện tại không rớt cấp; đồ do dị thú giết nằm lại 30 phút. **Đề xuất chốt: duyệt.**
- [ ] Mỏ của NPC: 10% mỏ linh thạch cấp 1 do NPC giữ lúc mở vùng, tối đa 3 mỏ cấp 1–2 bị Huyết Sát Môn đánh lại mỗi ngày, ngưỡng 24 giờ không ai trấn giữ. **Đề xuất chốt: duyệt.**

### Nhóm C — Chiến tranh, trận pháp và bảo vật (mục 10)

- [ ] Chính và tà theo sát khí tông môn (trên 1,0 là tà, dưới 0,3 là chính); bù phe khi một phe quá 60%; bảo trợ (tông dưới cấp 30, tông bảo trợ từ cấp 50, cống 5%). **Đề xuất chốt: duyệt.**
- [ ] Khung chiến tranh giữ 21:00–22:00, không mở cả ngày (giữ trụ cột tôn trọng thời gian). **Đề xuất chốt: duyệt.**
- [ ] Cứ điểm và tiểu Truyền Tống Trận: 2.000 linh thạch dựng, 200 mỗi ngày, số tối đa bằng cấp tông ÷ 10. **Đề xuất chốt: duyệt.**
- [ ] Bảng hộ trận và công thành (máu 50 × tổng cấp × đồng trận, đòn phá trận 0,3 × cấp² mỗi 5 phút, chi phí dựng và duy trì); cách tính hòa (chênh dưới 15%, mỗi bên mất 10% Bảo Khố). Trong bản thời gian thực, đòn phá trận là kỹ năng hồi 5 phút tại khu vực điểm. **Đề xuất chốt: duyệt.**
- [ ] Bậc trận và đại trận tông môn: 8 trận, số người và trận nhãn, phẩm tối thiểu, giới hạn NPC 60% và đồng minh 1/3, hệ số đồng trận tới 50 người, chi phí dựng và kích; hiệu ứng trong trận đã đo 2026-11-05. **Đề xuất chốt: duyệt.**
- [ ] Bảo vật chấn tông: 30 bảo vật, năm đạo, hệ số K, hạn 1–12 và trần cấp tông ÷ 20, tỷ lệ rơi tàn quyết 3% và 8%, chi phí đúc và thăng hạn, hồi 12–15 ngày; 4 món trấn giáo là bậc khởi đầu. **Đề xuất chốt: duyệt.**
- [ ] Tông môn đánh sang vùng khác cùng vị diện: không ở MVP; chiến tranh giữa các vùng để sau launch (mục 18). **Đề xuất chốt: duyệt hướng này.**

### Nhóm D — Kinh tế, chợ và Sàn Linh Ngọc (mục 12, 13)

- [ ] Sàn Linh Ngọc: phí 5%, biên độ 10% mỗi ngày, hạn mức đổi bằng 20% số linh thạch tự kiếm trong 7 ngày; đổi một chiều. **Đề xuất chốt: duyệt.**
- [ ] Cơ cấu thu nhập theo quy mô (nhỏ 70% từ mỏ … lớn 40%); sản lượng mỏ 20 × cấp^1,15 mỗi giờ; nâng mỏ 500 × cấp^1,8. **Đề xuất chốt: duyệt.**
- [ ] Chợ: đặt lệnh mua bán được ở mọi nơi, hàng giao về kho ở thành chủ nhà; thuế 5%, Tu kim tiền còn 3%. **Đề xuất chốt: duyệt.**
- [ ] Thu mỏ: sản lượng vào Bảo Khố của tông; thu hoạch một chạm là tiện ích VIP (mục 13). **Đề xuất chốt: duyệt.**
- [ ] Khóa giao dịch trang bị: vàng, đỏ khóa khi nhận; lam, tím khóa khi cường hóa từ +21; giữ chặt như đề xuất để chống studio (mục 21). **Đề xuất chốt: duyệt.**
- [ ] Cân bằng tỷ lệ rơi tự động 6 giờ một lần, biên ±30%; bảo hiểm thần vật 50 lượt. **Đề xuất chốt: duyệt.**

### Nhóm E — Vật phẩm, set đồ và luyện khí (mục 11, 12; tab Trang bị)

- [ ] 20 loại bí cảnh: tên và tỷ lệ rơi gốc 4–50%; linh lực bí cảnh 0–100%, hồi 5% mỗi ngày, nuôi tối đa +20%. **Đề xuất chốt: duyệt.**
- [ ] Cường hóa +30/+50, mỗi nấc +3%; độ bền 100, sửa 10% mất 1 độ bền tối đa; nén ngọc theo bảng; lô đỉnh và lò rèn theo tỷ lệ đã ghi. **Đề xuất chốt: duyệt.**
- [ ] Túi 50 ô mở tới 500; kho 100 mở tới 1.000; giá mở tăng dần. **Đề xuất chốt: duyệt.**
- [ ] Set đồ dựa trên ấn bộ, mốc 2/4/7, trần 1%/3%/6%, 20 bộ theo 20 bí cảnh, 30% đồ tím trở lên rơi có sẵn ấn. **Đề xuất chốt: duyệt.**
- [ ] Đạo Cơ Bàn: 19 ô mở theo cảnh giới, ấn thông tính thêm tối đa 2 món, ba cộng hưởng ×1,25/×1,5/×2, nền theo 8 tài năng. **Đề xuất chốt: duyệt.**
- [ ] Trần đồ sau đo 2026-11-04: chỉ số gốc 7 ô giảm nửa, ngọc 0,1 × k × (k + 1)%, trần mềm 25%/15%, tổng kháng một hệ tối đa 20%. **Đề xuất chốt: duyệt.**
- [ ] Luyện khí sau cấp tối đa (tab Trang bị phần 13): Khí Tinh, tẩy luyện, khí linh 0–9, 16 khí văn (mỗi người kích tối đa 3), ngọc song hệ, Ngọc Phách, 10 danh khí, Bảo Giám, tế luyện tầng; cả lớp khoảng 4 điểm lực chiến. **Đề xuất chốt: duyệt.**
- [ ] Pháp bảo ô riêng (1 ô Hạ vị, 2 ô từ Trung vị), linh lực thay độ bền, tế luyện thì khóa, 10 loại khắc 10 loại chiêu; "rèn pháp bảo" ở mục 5, 6, 10 đổi chữ thành "rèn đồ". **Đề xuất chốt: duyệt.**
- [ ] Hình áo trên người: giáp và bào dùng chung một bộ hình cho mỗi nhóm độ hiếm (không gấp đôi số hình). **Đề xuất chốt: duyệt hướng dùng chung.**

### Nhóm F — Thú cưỡi (mục 6 và tab Thú)

- [ ] 100 tên loài và 5 phẩm; 4 đại cảnh giới × 20 tiểu cảnh giới, mốc mở theo cấp 50/100/150; trần 15% lực chiến từ thú; bảng ghép kích phát; 3 loại linh đơn, giới hạn 10 viên mỗi ngày; tỷ lệ thuần phục và thú kiếp; luật khóa và bán trên chợ. **Đề xuất chốt: duyệt.**
- [ ] Một người không giữ 2 con cùng loài (để ghép kích phát luôn cần săn hoặc đổi). **Đề xuất chốt: duyệt hướng không cho.**
- [ ] Boss Tứ Tượng rơi 1 trứng mỗi loài mỗi mùa mỗi thế giới: giữ độ hiếm này, vì đây là mục tiêu cấp liên minh cả mùa. **Đề xuất chốt: duyệt.**
- [ ] Tab Thú (tăng trưởng, bổ trợ, phát triển): tư chất 1–5 sao, tu vi từng tầng, 12 thú kỹ của thú hộ chủ, 3 huyết mạch, 14 thiên phú, Tẩy Tủy Đơn và Thú Quyết. **Đề xuất chốt: duyệt.**

### Nhóm G — Nhiệm vụ, kinh nghiệm, tự động và dashboard (tab Nhiệm vụ; mục 14)

- [ ] Tên 12 cổ tông và NPC (Cố Tàng, Bạch Thủ Nghiêm, Lệ Tuyết Y, Ngân Nha, Vân Đình); 57 nhiệm vụ chính và 8 ải Tầm Đạo; 12 vùng truyện và 24 nhiệm vụ ẩn; mẫu nhiệm vụ phụ; bậc danh vọng phe; giờ làm mới 05:00 và tích lượt 2 ngày. **Đề xuất chốt: duyệt.**
- [ ] Vùng truyện các vùng khác mở từ cấp 110: giữ, không cho đi sớm hơn (giữ nhịp khám phá map theo cấp). **Đề xuất chốt: duyệt giữ 110.**
- [ ] Bảng cấp E(L), kinh nghiệm nhiệm vụ tới cấp 60 và từ cấp 61; luật luyện bãi quái (8 giờ mỗi ngày như nhau dù mở game hay không, không bị đồ sát khi đang luyện, chênh cấp −3% và +2% mỗi cấp, đúng hệ ±20%, trần cộng thêm +40%). **Đề xuất chốt: duyệt.**
- [ ] Tuyến tông môn 6 hồi theo mốc cấp tông, mục tiêu tính cho tông 20 người, thưởng cả tuyến khoảng 16,9 triệu XP tông và 42.000 linh thạch; 12 di sản cổ tông; danh Chính thống mỗi mùa; di sản không làm vùng nào hấp dẫn hơn hẳn (chỉ thưởng danh và vật phẩm nhỏ). **Đề xuất chốt: duyệt.**
- [ ] Tự động: 5 mức tự PK (mặc định chỉ đánh trả), tự nhắm người chênh không quá 20 cấp, treo máy và ủy thác cùng mức kinh nghiệm, ủy thác không bị PK; nút Tự làm và tùy chọn treo máy nằm trên HUD và dashboard (mục 14). **Đề xuất chốt: duyệt.**
- [ ] Ghép công pháp trong nhiệm vụ: ghép thử ở bia Tầm Đạo không tiêu tàn quyển; một công pháp tân thủ từ 2 tàn quyển tặng, chỉ chủ nhân dùng. **Đề xuất chốt: duyệt.**
- [ ] Phi thăng khi chưa đủ cấp 250: bù dần phần chỉ số còn thiếu ở Trung vị (50% kinh nghiệm Trung vị đổ vào quỹ bù) và chuyển nhiệm vụ Hạ vị chưa xong thành nhiệm vụ hồi ức. **Đề xuất chốt: duyệt.**
- [ ] Mùa 3 Phi Thăng kết thúc ngày 126 trước mốc tông đạt cấp 200 (ngày 147): dời Phi Thăng sang mùa 4; mùa 3 đổi thành mùa tranh bá Hạ vị. **Đề xuất chốt: duyệt hướng dời.**
- [ ] Dashboard 5 tab và thẻ Việc nên làm (mục 14): duyệt, kèm HUD map mở ở chế độ ra map. **Đề xuất chốt: duyệt.**
- [ ] Màn Nhân vật ba phần Thông tin · Pháp tướng · Túi theo prototype. **Đề xuất chốt: duyệt.**

### Nhóm H — Cân bằng còn lại (mục 6, 7, 8, 9)

- [ ] Tu luyện thượng vị: đan +5% đến +15%, cùng nguyên tố +10%, trần 80%, thất bại mất đan và 20% tu vi; mốc phẩm công pháp theo cấp (mục 6). **Đề xuất chốt: duyệt.**
- [ ] Điểm tiềm năng: 1 điểm mỗi cấp, 6 thuộc tính, mốc mềm 120 điểm, tẩy điểm 1.000 linh thạch từ cấp 50. **Đề xuất chốt: duyệt.**
- [ ] Đối cực hợp nhất tụt sau khi cân loại chiêu: giảm phạt mana ×1,5 còn ×1,3, đo lại trong phiên cân bằng kế. **Đề xuất chốt: duyệt hướng này.**
- [ ] Thân pháp lướt vào hàng sau thắng 70,8% khi đồ đỉnh: giữ mở, chuyển sang danh sách đo lại trên combat thời gian thực (địa hình và điều khiển tay đổi bối cảnh hẳn). **Đề xuất chốt: mở, đo lại sau Cửa 1.**

### Nhóm I — Kỹ thuật (mục 16)

- [ ] Kiểm thử tải 1 triệu người chơi ảo: mô hình tải mới cho real-time (30% người phát input liên tục), ngưỡng p95/p99 đã cập nhật 2026-11-09. **Đề xuất chốt: duyệt.**
- [ ] Kiểm chứng có chọn lọc: combat do server tính; phát lại ngoại tuyến 5–10% input log, tài khoản bị đánh dấu 100%. **Đề xuất chốt: duyệt.**
- [ ] Hỏi Heroic Labs: Nakama Enterprise tự host tại Việt Nam, mức hỗ trợ PostgreSQL cho production. **Giữ mở — việc chờ ở Hub.**

### Nhóm J — Pháp lý và bên ngoài (giữ mở, không tự chốt)

- [ ] Tự lập công ty xin G1 hay đi qua nhà phát hành — quyết trước closed beta.
- [ ] Thử nghiệm kín trước khi có Quyết định phát hành được làm tới đâu — hỏi luật sư hoặc nhà phát hành.
- [ ] Kiểm tra trùng tên Thiên Hoang Ký trên Google Play, App Store Việt Nam, tên miền, mạng xã hội; tra và đăng ký nhãn hiệu ở Cục Sở hữu trí tuệ.
- [ ] Ngân sách cho mỹ thuật, âm thanh, luật sư, máy chủ và SMS OTP.
- [ ] Luyện bãi khi tắt game (ủy thác) và treo máy khi mở game có tính vào 60 phút mỗi ngày của người dưới 18 tuổi không — hỏi luật sư; nếu treo máy tính giờ thì hết giờ tự chuyển sang ủy thác.

### Nhóm K — Câu mới từ chuyển đổi thời gian thực (2026-11-09)

- [ ] Đồ họa map mở: giữ 2D isometric thủy mặc (PixelLab cho prototype, họa sĩ hoàn thiện), cần thêm tileset địa hình cho 12 vùng. **Đề xuất chốt: duyệt hướng này.**
- [ ] Prototype dashboard hiện tại (proto/): giữ làm testbench cho sim và dashboard; Cửa 1 làm map mở real-time mới. **Đề xuất chốt: duyệt hướng này.**
- [ ] Timeline MVP 30 tháng (mục 18, trước 24). **Đề xuất chốt: duyệt.**
- [ ] HUD: joystick trái, cụm chiêu phải, nút Auto cạnh cụm chiêu (mục 14). **Đề xuất chốt: duyệt.**
- [x] Ước lượng CPU combat server: đo 2026-11-09, trận 10 đấu 10 hết 600 tick trong 0,85 ms trên Node 24 → khoảng 350 phòng chiến mỗi lõi sau khi chừa ×100 cho input và snapshot. Băng thông AOI ước 2–4 KB/s mỗi người sau nén delta — đo lại ở Cửa 1.

## 21. Vận hành tự động và admin tối giản

**Đề xuất 2026-11-09, chờ bạn duyệt.** Một người vận hành nên nguyên tắc là: việc lặp lại phải tự động hết; admin chỉ làm việc không tự động được (khiếu nại, sự cố, quyết định chính sách). Mọi thao tác admin đều ghi audit log: ai, lúc nào, làm gì, lý do.

### Cấu hình sống (live config)

- Toàn bộ tham số vận hành (tỷ lệ rơi, hạn mức sàn, giá NPC, giờ mở bí cảnh, hệ số cân bằng, giới hạn tự động) nằm trong gói cấu hình có số phiên bản, sinh từ Excel qua `tools/data/xuat.ts`; server áp bản mới không cần khởi động lại, client tải theo phiên bản.
- Kill switch từng hệ thống (chợ, Sàn Linh Ngọc, chiến tranh, bí cảnh, nạp tiền) để khoá riêng khi có sự cố mà không phải tắt cả game.

### Vận hành tự động

- Lịch LiveOps (mùa, Thiên Đạo Lệnh, sự kiện lễ, đấu giá cuối tuần, boss liên minh) khai báo một lần trong dữ liệu mùa, server chạy đúng lịch.
- Cân bằng tỷ lệ rơi tự chạy 6 giờ một lần (mục 12); vượt biên ±30% thì chỉ cảnh báo, không tự siết thêm.
- Thế giới: tự mở vùng mới theo số người; tự mở thế giới mới khi các thế giới hiện có đủ 80% sức chứa; báo cáo hằng tuần về độ tập trung lãnh thổ của từng thế giới.
- Sao lưu hằng ngày tự động; hằng tuần tự khôi phục thử lên staging để chắc bản lưu dùng được.
- Báo cáo kinh tế hằng ngày tự gửi: nguồn và tiêu linh thạch theo phẩm, giá trên chợ và sàn, số lượt rơi thần vật.

### Công cụ admin (web nội bộ, phát triển từ khung `admin/` đã có trong repo)

| Màn | Việc |
|---|---|
| Tài khoản | Tra cứu nhân vật, tài nguyên, lịch sử trận (kèm input log), lịch sử nạp, thiết bị đăng nhập |
| Xử lý | Ban hoặc mute có thời hạn, thu hồi vật phẩm do lừa đảo, rollback một trận hoặc một giao dịch (nhờ input log và snapshot), gửi bồi thường có ghi lý do |
| Thế giới | Mở và đóng vùng, mở thế giới mới, gộp thế giới: chuyển tông môn vào thế giới chung, giữ tài sản và cấp, xếp lại vị trí sơn môn ngẫu nhiên, khiên 7 ngày sau gộp |
| Nội dung | Duyệt chat bị báo cáo, quản lý từ cấm, broadcast thông báo, sửa cấu hình sống, bật tắt kill switch |
| Khiếu nại | Hàng chờ ticket của người chơi, gắn với hồ sơ tài khoản và log liên quan |

### Chống studio và gian lận ở tầng vận hành

- Luật tự động: một thiết bị tối đa 3 tài khoản; tài khoản chưa xác thực đầy đủ không dùng được Sàn Linh Ngọc; lệnh sàn chênh giá bất thường bị giữ 24 giờ để xem xét; chuyển tài nguyên giữa hai tài khoản cùng thiết bị bị chặn.
- Phát hiện trên input log: nhịp input đều bất thường, online 24/7 nhiều ngày liền, nhiều tài khoản cùng thiết bị có hành vi giống hệt nhau. Điểm nghi ngờ cộng dồn, quá ngưỡng thì tự giới hạn giao dịch và đưa vào hàng xem xét.
- Quy trình: cảnh báo → giới hạn giao dịch → ban; mọi mức đều cho khiếu nại qua ticket.

### Giám sát và cảnh báo

- Dashboard giám sát: CCU theo thế giới và vùng, p95/p99 từng loại lệnh, CPU pool combat, độ dài hàng đợi, tỷ lệ lỗi, dung lượng cơ sở dữ liệu.
- Cảnh báo tự động qua Telegram/Discord khi: p99 vượt ngưỡng 5 phút liền, một phía của Sàn Linh Ngọc hết hàng, tỷ lệ rơi lệch mục tiêu 30%, sao lưu lỗi, có trận kết thúc bất thường (dưới 5 giây hoặc sát ngưỡng hòa).
- Push notification (bổ sung cho mục 17): Firebase Cloud Messaging; nhắc khung bí cảnh 12:00 và 20:00, chiến tranh 21:00 khi có tuyên chiến, điểm đang bị đánh, treo máy bị PK. Người chơi tắt bật theo loại; tối đa 5 thông báo mỗi ngày để không làm phiền.

### Quy trình sự cố

- Ba mức: SEV1 (sập, mất dữ liệu, lỗi nạp tiền) xử lý ngay, rollback theo checklist; SEV2 (một hệ thống hỏng) dùng kill switch rồi sửa; SEV3 (lỗi nhỏ) vào backlog.
- Bảo trì định kỳ 30 phút mỗi tuần vào 05:00 (trùng giờ làm mới ngày), báo trước trong game 24 giờ.

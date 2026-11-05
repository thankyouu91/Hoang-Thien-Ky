# Vẽ icon ban đêm (tác vụ lịch 22:00–6:00)

Tác vụ lịch `ve-icon-dem` chạy mỗi 10 phút từ 22:00 tới 5:50. Mỗi lần chạy làm tiếp **một lô** (tối đa 24 món ưu tiên 2 chưa vẽ), rồi dừng. Tiến độ ghi ở file nên lần sau làm tiếp đúng chỗ.

- Thư mục làm việc ngoài repo: `%LOCALAPPDATA%\ktlp-icon-ve`. Trong đó có `node_modules` (sharp), `lo/xuatNN/` cho mỗi lô, `trang_thai.json` và `nhat_ky_dem.txt`.
- Mọi lệnh `node` dưới đây chạy trong `C:\Project\KhaiTongLapPhai\tools\icon_ve` (Git Bash: `/c/Project/KhaiTongLapPhai/tools/icon_ve`).

## Luật

- Chỉ sửa và commit `assets/icon_ve/`. Không đụng file khác của repo, không push, không đổi nhánh, không stash, không reset.
- Canva báo hết lượt (`quota_cooldown`, hoặc lỗi nói về quota, credit, limit): dừng mọi lệnh Canva, chạy `node dem.cjs ket-thuc cooldown`, rồi kết thúc.
- Lỗi khác: thử lại một lần. Nếu vẫn lỗi thì chạy `node dem.cjs ket-thuc <mô tả ngắn lỗi>` rồi kết thúc.
- Luôn kết thúc bằng `node dem.cjs ket-thuc ...`, kể cả khi dừng giữa chừng.
- Ghi tiến độ vào file ngay sau mỗi đợt gọi Canva, để lần chạy sau không vẽ lại.

## Các bước

0. Chạy `node dem.cjs bat-dau`.
    - Mã thoát khác 0 (ngoài giờ, đang có lần chạy khác, đang cooldown, hết món): kết thúc ngay, không gọi Canva, không cần `ket-thuc`.
    - Mã thoát 0 thì kết quả in ra là JSON: `lo` (thư mục lô, gọi là L), `tong`, `da_ve`, `da_tach`, `co_trang`, `co_url`, `to_xuat` (design id tờ xuất), `node_path`.
1. **Vẽ.** Với mỗi dòng của `L/lo.tsv` (`ma`, độ hiếm, lời gửi Canva) mà `ma` chưa có trong `L/nhat_ky.tsv`:
    - Gọi `generate-image` với `prompt` là đúng cột 3 và `aspectRatio` `SQUARE_1_1`. Gọi tối đa 12 món một đợt.
    - Gọi `get-generate-image-job` cho từng job; nếu `PENDING` thì gọi lại.
    - Xem từng ảnh. Ảnh đạt khi có một vật duy nhất, đúng mô tả, kiểu tranh vẽ 3D, nền trắng, không chữ, không khung.
    - Ảnh hỏng thì vẽ lại một lần với cùng lời và ghi media id hỏng vào `L/bo.txt`.
    - Sau mỗi đợt, nối `ma<TAB>media id` vào `L/nhat_ky.tsv`.
2. **Tách nền.** Với mỗi `ma` có trong `nhat_ky.tsv` mà chưa có trong `L/tach.tsv`:
    - Gọi `remove-background` với `sourceMedia` `{type: "MEDIA", id}`, rồi nối `ma<TAB>id mới` vào `L/tach.tsv`.
    - Gọi song song đôi khi bị lỗi 409; gọi lại từng món là được.
    - Xong thì chạy `node ops.cjs sap L` và kiểm cả hai file đủ `tong` dòng.
3. **Đặt lên tờ xuất.** Bỏ qua bước này nếu `L/trang.tsv` đã đủ `tong` dòng. Gọi n = `tong`.
    - Gọi `read-design` với `design_id` = `to_xuat`, `open_transaction: true`, `filter: {fields: ["design_metadata"]}`. Ghi lại `page_count` (P) và `transaction_id`.
    - Nếu P + n > 100 thì tạo tờ mới:
        1. Gọi `create-design` với brief "A completely blank square page, no text, no images, no shapes, plain white background. Used only as an export sheet for game icons." và format "Instagram Post (Square)". Chờ 15 giây rồi gọi `get-create-design-async-job`.
        2. Chuyển design mới vào thư mục `FAHZ1qKqhag`.
        3. Chạy `node dem.cjs to-xuat <id mới>`, rồi mở transaction trên tờ mới như trên.
    - Gọi `edit-design` với `transaction_id`, `page_index: 1`, `finalize: "keep_open"`, `operations` = kết quả `node ops.cjs add L`. Sau đó gọi `edit-design` lần nữa với `operations: []` và `finalize: "commit"`. Trang mới là P+1 … P+n.
    - Gọi `read-design` với `filter: {fields: ["page_metadata"], page_indices: [P+1 … P+n]}` để lấy id trang theo thứ tự.
    - Chạy `node ops.cjs fill L <P+1> <id trang …>` để ra `operations`.
    - Mở transaction mới, gọi `edit-design` với `page_index: P+1`, `finalize: "keep_open"` và các `operations` đó, rồi commit như trên.
4. **Xuất.** Gọi `export-design` với `format: {type: "png", transparent_background: true, width: 512, height: 512, pages: [P+1 … P+n]}`.
    - Khóa job là dãy số sau `NNNN-` trong URL trả về.
    - Chạy `node lay_url.cjs <design> <khóa job> L/url.txt` và kiểm đủ n URL.
    - URL hết hạn sau vài giờ; nếu hết hạn thì xuất lại.
5. **Xử lý.**
    - Chạy `node tao_lo.cjs L L/url.txt L/lo.json && DESIGN=<design> NODE_PATH=<node_path> node xu_ly.cjs L/lo.json L/ghep.png && node danh_muc.cjs`.
    - Xem `L/ghep.png`: mỗi ô đúng món, nền trong.
6. **Commit.**
    - Trong `/c/Project/KhaiTongLapPhai` chạy `git add assets/icon_ve`, rồi `git commit -q -m "Icon vẽ lô NN: <loại món, khoảng số>" -m "Co-Authored-By: Claude <noreply@anthropic.com>" -- assets/icon_ve`.
    - Chạy `node dem.cjs xong L <hash commit>`.
7. **Xếp ảnh gốc.**
    - `node thu_muc.cjs L` in `media<TAB>thư mục<TAB>ma` cho mỗi ảnh gốc chưa chuyển. Gọi `move-item-to-folder` cho từng dòng, rồi nối media id vào `L/da_chuyen.txt`.
    - Ảnh trong `bo.txt` chuyển vào `FAHZ1qKqhag`.
    - Ảnh đã tách nền không chuyển được, bỏ qua.
8. Chạy `node dem.cjs ket-thuc lô NN xong, <số hình>`. Báo một dòng: lô, số hình đã vẽ, commit.

# Công cụ icon vật phẩm vẽ (Canva)

Icon vật phẩm và giao diện vẽ bằng Canva theo phong cách tranh vẽ 3D, nền trong. Nhân vật, thú và đảo vẫn là pixel art của PixelLab (`assets/pixellab/`).

## File

- `danh_sach.cjs` sinh `assets/icon_ve/danh_sach.json`. Mỗi món có mã theo dõi `ma_vp` cố định, lời mô tả gửi Canva và độ ưu tiên. Tên và hình 7 loại trang bị × 60 kiểu nằm ở `trang_bi_ten.cjs`; vũ khí có thêm `khi_hinh` (10 khí hình theo `data/he_thong/json/vu_khi.json`).
- `mon_so_lieu.cjs` thêm các món lấy từ số liệu `data/he_thong/json` (đan, phù, nguyên liệu, pháp bảo, pháp khí, Ý châu, ấn bộ) với mã `ma_vp` đúng như số liệu; lời mô tả hình viết theo mẫu từng loại.
- `danh_muc.cjs` ghi `ma_vp` vào `manifest.json` và sinh `assets/icon_ve/danh_muc.md`, bảng mọi món cho người đọc.
- `tao_lo.cjs` và `xu_ly.cjs` tải PNG 512 px xuất từ Canva, đổi sang webp q88, rồi thêm một dòng manifest cho mỗi món.
- `ghep.cjs` ghép ảnh xem trước từ webp trong repo.
- `thu_muc.cjs` chỉ ra thư mục Canva cho từng ảnh gốc.
- `lo_tiep.cjs` in lô kế tiếp: các món ưu tiên 2 chưa vẽ. `ops.cjs` sinh lệnh `add_page`, `insert_fill` cho một lô, và xếp lại `nhat_ky.tsv`, `tach.tsv` theo `lo.tsv`. `lay_url.cjs` lấy URL xuất ra từ transcript phiên.
- `dem.cjs` và `DEM.md`: tác vụ lịch vẽ ban đêm, chạy 22:00–6:00, mỗi 10 phút một lần. Mỗi lần làm tiếp một lô; có khóa chống chạy chồng và nhớ cooldown của Canva.

`xu_ly.cjs` và `ghep.cjs` cần `sharp`. Cài vào một thư mục tạm ngoài repo (`npm.cmd i sharp`), rồi chạy với `NODE_PATH` trỏ tới `node_modules` của thư mục đó.

## Quy trình mỗi món

1. Gọi `generate-image` với lời `Game inventory item icon: <mo_ta>. <duoi_loi_mo_ta>`, tỷ lệ `SQUARE_1_1`. Xem ảnh; món lệch phong cách, có chữ hay có khung thì vẽ lại.
2. Gọi `remove-background`. Gọi song song đôi khi bị 409; gọi lại từng món là được.
3. API Canva chỉ trả ảnh 200 px. Muốn có bản 512 px thì chèn ảnh đã tách nền vào trang 512×512 của design tờ xuất `DAHZ1iamT_w`, lưu, rồi `export-design` dạng PNG với `transparent_background` và `width` 512.
    - Mỗi design chỉ chứa được 100 trang. Tờ xuất 1 `DAHZ1iamT_w`, tờ 2 `DAHZ2R_YFBk`, tờ 3 `DAHZ2im7cjI` (lô 8–11) và tờ 4 `DAHaAXqAlKM` (lô 12–15, 95 trang) đã đầy. Tờ 5 `DAHaAl7aYjo` đang dùng từ lô 16 (28 trang). Lô sau chạy `xu_ly.cjs` với `DESIGN=<id tờ đang dùng>`. Tờ mới tạo bằng `create-design` với brief trang trắng, rồi `add_page` 512×512; id trang chỉ đọc được sau khi lưu.
    - Khi tờ đang dùng cũng đầy thì tạo tờ mới như trên, hoặc dùng lại trang đã xuất: `update_fill`, rồi `crop_media` về 512×512, vì `update_fill` tự phóng ảnh lên khoảng 4%.
4. Chạy `tao_lo.cjs` rồi `xu_ly.cjs`, sau đó `danh_muc.cjs`. Commit file trong `assets/icon_ve/`; nhớ `git add` thư mục webp trước, vì `git commit -- <đường dẫn>` không lấy file mới (lô 10–11 từng sót 48 file). Món đổi tên hoặc đổi hình thì vẽ lại cùng đường dẫn: `xu_ly.cjs` thay dòng manifest cũ, và `danh_muc.md` ghi "vẽ lại" cho món có tên trong manifest lệch danh sách.
5. Chuyển ảnh gốc vào thư mục Canva "HTK – Icon vật phẩm" (`FAHZ1p8MzDI`), đúng thư mục con theo loại món. Ảnh đã tách nền không chuyển được bằng API (lỗi "Not allowed to access this folder") và cũng không hiện ở thư mục gốc.

## Quy ước mã `ma_vp`

Mã có dạng `NHÓM-LOẠI-SỐ`, ví dụ `TB-KI-001` là Kiếm Thanh Cương. Mã đã cấp thì không đổi và không dùng lại; món mới nhận số kế tiếp. Nghĩa từng tiền tố ghi ở `tien_to_ma` trong `danh_sach.json`.

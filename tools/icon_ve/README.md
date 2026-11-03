# Công cụ icon vật phẩm vẽ (Canva)

Icon vật phẩm và giao diện vẽ bằng Canva theo phong cách tranh vẽ 3D, nền trong. Nhân vật, thú và đảo vẫn là pixel art của PixelLab (`assets/pixellab/`).

## File

- `danh_sach.cjs` sinh `assets/icon_ve/danh_sach.json`. Mỗi món có mã theo dõi `ma_vp` cố định, lời mô tả gửi Canva và độ ưu tiên. Tên và hình 7 loại trang bị × 60 kiểu nằm ở `trang_bi_ten.cjs`.
- `danh_muc.cjs` ghi `ma_vp` vào `manifest.json` và sinh `assets/icon_ve/danh_muc.md`, bảng mọi món cho người đọc.
- `tao_lo.cjs` và `xu_ly.cjs` tải PNG 512 px xuất từ Canva, đổi sang webp q88, rồi thêm một dòng manifest cho mỗi món.
- `ghep.cjs` ghép ảnh xem trước từ webp trong repo.
- `thu_muc.cjs` chỉ ra thư mục Canva cho từng ảnh gốc.

`xu_ly.cjs` và `ghep.cjs` cần `sharp`. Cài vào một thư mục tạm ngoài repo (`npm.cmd i sharp`), rồi chạy với `NODE_PATH` trỏ tới `node_modules` của thư mục đó.

## Quy trình mỗi món

1. Gọi `generate-image` với lời `Game inventory item icon: <mo_ta>. <duoi_loi_mo_ta>`, tỷ lệ `SQUARE_1_1`. Xem ảnh; món lệch phong cách, có chữ hay có khung thì vẽ lại.
2. Gọi `remove-background`. Gọi song song đôi khi bị 409; gọi lại từng món là được.
3. API Canva chỉ trả ảnh 200 px. Muốn có bản 512 px thì chèn ảnh đã tách nền vào trang 512×512 của design tờ xuất `DAHZ1iamT_w`, lưu, rồi `export-design` dạng PNG với `transparent_background` và `width` 512.
    - Mỗi design chỉ chứa được 100 trang. Khi đầy thì dùng lại trang đã xuất: `update_fill`, rồi `crop_media` về 512×512, vì `update_fill` tự phóng ảnh lên khoảng 4%.
4. Chạy `tao_lo.cjs` rồi `xu_ly.cjs`, sau đó `danh_muc.cjs`. Commit file trong `assets/icon_ve/`.
5. Chuyển ảnh gốc vào thư mục Canva "KTLP – Icon vật phẩm" (`FAHZ1p8MzDI`), đúng thư mục con theo loại món. Ảnh đã tách nền không chuyển được bằng API (lỗi "Not allowed to access this folder") và cũng không hiện ở thư mục gốc.

## Quy ước mã `ma_vp`

Mã có dạng `NHÓM-LOẠI-SỐ`, ví dụ `TB-KI-001` là Kiếm Thanh Cương. Mã đã cấp thì không đổi và không dùng lại; món mới nhận số kế tiếp. Nghĩa từng tiền tố ghi ở `tien_to_ma` trong `danh_sach.json`.

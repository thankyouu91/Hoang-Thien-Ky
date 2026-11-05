# Dấu ấn Thiên Hoang Ký

Dấu triện son kiểu tiên hiệp, dùng làm biểu tượng game thay ô vuông đỏ có chữ Hán: cổng link mời, màn đăng nhập, favicon. Hình không có chữ nào.

## Bản dùng

Bản chọn là dấu tròn: ngọn núi dưới trăng khuyết và mặt trời, viền vòng mây cuộn, khắc trắng trên nền son.

- Nhật nguyệt trên núi hợp tên Thiên Hoang Ký (trời và đại hoang).
- Khối son đặc, nét khắc trắng nên đọc rõ hơn các bản nét mảnh, kể cả ở 128 px.
- Mép loang và vân mực giống ấn in trên giấy, hợp nền kem, khung đỏ mảnh của dashboard.
- Dấu tròn khác hẳn ô vuông đỏ cũ mà người dùng chê.

| File | Cỡ | Dùng cho |
|---|---|---|
| `dau_an_1024.png` | 1024 | Bản lớn nền trong suốt (xuất lại từ Canva ở 1024 px) |
| `discord_icon.png` | 1024 | Biểu tượng máy chủ Discord: ấn trên nền kem đặc, chừa lề cho khung tròn của Discord |
| `dau_an.webp`, `dau_an.png` | 512 | Màn đăng nhập, cổng link mời |
| `dau_an_256.png` | 256 | Thẻ, banner nhỏ |
| `dau_an_128.png` | 128 | Nút, góc trang |
| `favicon-32.png`, `favicon.png` | 32 | Favicon: phần giữa của ấn (núi, nhật nguyệt), mực đặc, viền son |
| `favicon-16.png` | 16 | Favicon: vẽ giản lược cùng mô típ, vì ấn đầy đủ thành vệt mờ ở cỡ này |
| `favicon.ico` | 16 và 32 | Favicon cho trình duyệt cũ |

- Nền trong suốt theo độ đậm mực: son nhạt và vân giấy là bán trong suốt.
- Đặt thẳng lên nền kem (`--c-bg` `#f6efdf`). Không lót nền trắng, không bo khung.

## Phương án khác

- `phuong_an/` có đủ 6 phương án (vuông, tròn, bát giác), cùng cách xử lý.
- `phuong_an/so_sanh.png` là ảnh ghép so sánh trên nền kem, có bản chọn ở các cỡ nhỏ.

## Nguồn

- Vẽ bằng Canva `generate-image` ngày 2026-11-05. Lời vẽ: dấu son tiên hiệp trên giấy, hoa văn thuần hình, không chữ, mép loang.
- Bản chọn là media `MAHaBMz1XiU`. Đã xuất 512 px từ tờ xuất `DAHaAl7aYjo`, trang 60–65.
- Thư mục Canva "Thương hiệu" trong "KTLP – Icon vật phẩm" chứa ảnh gốc của cả 6 phương án.
- Dựng lại bằng `tools/brand/dau_an.cjs` (cần sharp):
    ```
    NODE_PATH=<node_modules có sharp> node tools/brand/dau_an.cjs <thư mục 6 PNG gốc> tron_nhat_nguyet
    ```
- Không dùng bản tách nền của Canva: bản đó giữ mảng trắng bên trong khung ấn.

# Hình lớn Pháp tướng theo trang phục và cảnh giới

Người dùng chốt hướng này ngày 2026-11-05: nhiều trang phục hơn, có giáp chiến, đồ đổi theo cảnh giới, da nhân vật nữ sáng. Lượt PixelLab tháng 11 đã hết, nên người dùng chọn **vẽ đủ khi gói đặt lại ngày 2026-12-05**.

## Cách chọn hình (proto)

- `proto/src/dashboard/trangPhuc.ts` gộp 60 kiểu áo (`trang_bi.json`, ô `ao`) thành 13 dáng theo tên:
  - bào: bố y, thư sinh, đạo bào, võ phục, dạ hành, áo tăng, áo choàng lông, tiên y, pháp y;
  - giáp: giáp da, giáp phiến, giáp vảy, giáp tướng.
- Bậc theo cấp: 1 là Luyện Khí; 2 là Trúc Cơ và Kết Đan (từ cấp 51); 3 là Nguyên Anh trở lên (từ cấp 151).
- Màn Nhân vật thử các hình theo thứ tự, thiếu hình nào thì sang hình sau (`hinhLonCands`):
  1. `lon/<dáng áo đang mặc>_<bậc>`, lùi dần bậc;
  2. `lon/<áo theo nghề>_<bậc>`, lùi dần bậc;
  3. `<áo theo nghề>/lon.png` (8 bức áo nghề đã có từ trước);
  4. hình ghép của trận.
- Linh khí quanh người theo cảnh giới vẽ bằng code (`linhKhi` trong `nhanVat.ts`), không cần hình.

## Vẽ (ngày 2026-12-05)

```
node tools/hinh_lon/ve.mjs 4 --thu
node tools/hinh_lon/ve.mjs 4
```

- Lệnh có `--thu` chỉ in số bức còn thiếu. Lệnh không có `--thu` thì vẽ, 4 việc cùng lúc. PixelLab cho tối đa 20 việc chạy cùng lúc, tính chung mọi phiên.
- Có 216 bức, khoảng 2.160 lượt:
  - 13 dáng × 3 bậc × 4 thân;
  - 6 áo nghề riêng (tu trận, tu đan, sát thủ, tu rèn, tu dược, tu kim tiền) ở bậc 2 và 3 cho 4 thân;
  - bậc 1 vẽ lại cho 2 thân nữ (da sáng).
- Ra: `assets/pixellab/nhan_vat/<thân>/lon/<mã>_<bậc>.png`. Bức đã có thì bỏ qua, nên chạy lại là vẽ tiếp phần thiếu. Mã việc ghi ở `tools/hinh_lon/jobs.log` (không commit).
- Lời mô tả ở `ao.json`. Mẫu nét là bức đạo bào đã duyệt của cùng thân (`style_copy` outline, detail, shading, không lấy màu).
- Không đưa bức đã duyệt vào `reference_images`: PixelLab sẽ chép luôn đạo bào.
- Thân nữ ghi "young female … fair porcelain skin". Không ghi thì có bức ra mặt nam (lần vẽ đầu nữ khoẻ tu rèn).
- Sau khi vẽ, soát từng bức: mặt và tóc đúng thân, đúng khung 192 × 256, đúng áo và bậc. Bức hỏng thì xoá file rồi chạy lại.

## Mẫu đã vẽ thử

10 bức thử (giáp tướng, giáp vảy, giáp da, tiên y; 2 dòng bào và giáp × 3 bậc) nằm trong ghi chú nhóm phiên, thư mục `hinh-lon-mau/`. Người dùng xem và chốt hướng; các bức này chưa đưa vào repo.

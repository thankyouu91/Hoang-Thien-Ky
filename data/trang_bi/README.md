# Trang bị, pháp bảo, ngọc và set đồ (bản nháp, đã chuyển sang file số liệu)

Từ commit `3f52a50`, nguồn gốc là file số liệu `data/he_thong/KhaiTongLapPhai_HeThong_v1.xlsx` (20 sheet trang bị, pháp bảo, ngọc, set, vật phẩm). `tools/data/xuat.ts` xuất 7 file cùng tên và cùng khóa vào `data/he_thong/json/`. Code đọc từ đó; muốn đổi số thì sửa Excel rồi chạy:

```
node --experimental-strip-types --no-warnings tools/data/xuat.ts
```

Thư mục này là bản nháp đầu do `tools/trang_bi/tao.cjs` sinh, theo tab "Trang bị, pháp bảo và set đồ" của GDD. `xuat.ts` vẫn so với nó và báo chỗ khác. Chỉ chạy lại `tao.cjs` khi phiên set đồ đổi cấu trúc danh mục, rồi báo phiên bảng số liệu đưa chỗ khác vào Excel; khi mọi code đã đọc `data/he_thong/json` thì bỏ cả thư mục này lẫn `tools/trang_bi/`.

| File | Nội dung |
|---|---|
| `trang_bi.json` | 5 độ hiếm, 7 ô (chỉ số chính, phụ, ô ngọc công hay thủ, nguyên liệu rèn) và 420 kiểu kèm dáng, khí hình, nguồn |
| `vu_khi.json` | 10 khí hình gắn 10 loại chiêu, hình khi cầm theo 8 tài năng |
| `ngoc.json` | 12 hệ ngọc cấp 1–10, 10 Ý châu, 20 ấn bộ |
| `set.json` | Luật set, trần, 20 bộ với hiệu ứng mốc 2/4/7 |
| `phap_bao.json` | 10 loại pháp bảo, 50 món, 4 pháp bảo trấn giáo |
| `phap_khi.json` | 8 loại pháp khí ngoài trận, 24 món |
| `vat_pham.json` | 10 phù, 120 đan, 17 nguyên liệu rèn |

Đơn vị như `data/he_thong`: tỷ lệ theo phần nghìn, thời gian theo tick (20 tick = 1 giây). Mã mới: `PB` pháp bảo, `PK` pháp khí, `NG-YC` Ý châu, `NG-AN` ấn bộ, `NL` nguyên liệu rèn. Trường `ten_de_xuat` của 26 kiểu vũ khí lam trở lên chưa vẽ là tên mới theo khí hình, chờ người dùng duyệt; 34 kiểu đã vẽ giữ khí hình kiếm.

# Trang bị, pháp bảo, ngọc và set đồ

Danh mục vật phẩm chiến đấu và hệ thống set đồ, theo tab "Trang bị, pháp bảo và set đồ" của GDD (Claude Docs). Mọi số là đề xuất. Sinh bằng:

```
node tools/trang_bi/tao.cjs
```

Lệnh đọc tên, mã và độ hiếm của 420 kiểu trang bị từ `assets/icon_ve/danh_sach.json`, ghi các file dưới đây, rồi kiểm trùng mã và đếm số món. Đơn vị như `data/he_thong`: tỷ lệ theo phần nghìn, thời gian theo tick (20 tick = 1 giây).

| File | Nội dung |
|---|---|
| `trang_bi.json` | 5 độ hiếm, 7 ô (chỉ số chính, phụ, ô ngọc công hay thủ, nguyên liệu rèn) và 420 kiểu kèm dáng, khí hình, nguồn |
| `vu_khi.json` | 10 khí hình gắn 10 loại chiêu, hình khi cầm theo 8 tài năng |
| `ngoc.json` | 12 hệ ngọc cấp 1–10, 10 Ý châu, 20 ấn bộ |
| `set.json` | Luật set, trần, 20 bộ với hiệu ứng mốc 2/4/7 |
| `phap_bao.json` | 10 loại pháp bảo, 50 món, 4 pháp bảo trấn giáo |
| `phap_khi.json` | 8 loại pháp khí ngoài trận, 24 món |
| `vat_pham.json` | 10 phù, 120 đan, 17 nguyên liệu rèn |

Mã mới: `PB` pháp bảo, `PK` pháp khí, `NG-YC` Ý châu, `NG-AN` ấn bộ, `NL` nguyên liệu rèn. Mã cũ giữ như `danh_sach.json`. Trường `ten_de_xuat` của 51 kiểu vũ khí là tên mới theo khí hình, chờ phiên icon áp vào `tools/icon_ve/trang_bi_ten.cjs`.

Khi phiên bảng số liệu đưa các bảng này vào `data/he_thong` qua `tools/data`, thư mục này chuyển thành nguồn phụ hoặc bỏ.

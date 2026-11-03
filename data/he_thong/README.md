# Số liệu hệ thống

`KhaiTongLapPhai_HeThong_v1.xlsx` là file số liệu mà GDD mục 1 nhắc tới. File gốc không còn, nên ngày 2026-11-02 dựng lại từ GDD (Claude Docs rev 162) và số đang chạy trong `packages/sim`. Ô màu vàng là đề xuất mới, chờ duyệt; sheet Ghi chú trong file giải thích màu và quy ước.

File Excel là nguồn gốc. Sửa trong Excel, lưu lại, rồi chạy ở thư mục repo:

```
node --experimental-strip-types --no-warnings tools/data/xuat.ts
```

Lệnh này ghi lại `json/` (mỗi sheet một file, đơn vị như code: phần nghìn, tick 20 mỗi giây, milli-ô) và chạy phép kiểm. Có lỗi thì lệnh trả mã 1.

Từ 2026-11-03 file có thêm 20 sheet trang bị, pháp bảo, pháp khí, ngọc, set đồ và vật phẩm, dựng lần đầu từ bản nháp `data/trang_bi` của phiên set đồ (bản nháp đã bỏ ở e79c326). Các sheet này ghép lại thành 7 file `trang_bi.json`, `vu_khi.json`, `ngoc.json`, `set.json`, `phap_bao.json`, `phap_khi.json`, `vat_pham.json`. Không còn `data/trang_bi` thì `tao.ts` dựng các sheet đó từ 7 file JSON này.

Sửa nhanh vài ô mà không mở Excel (dùng cho yêu cầu từ các phiên khác), lệnh tự xuất lại JSON:

```
node --experimental-strip-types --no-warnings tools/data/sua.ts "Ý châu" NG-YC-008 "Mô tả=..." "tham_so=heSoMana: 2700"
```

Lệnh chỉ thay XML của đúng các ô đó, giữ nguyên định dạng, các sheet khác và chỗ đã sửa tay; không sửa ô công thức.

`tools/data/tao.ts` chỉ dùng để dựng file lần đầu; chạy lại cần `--ghi-de` và sẽ xóa mọi chỗ đã sửa tay trong Excel.

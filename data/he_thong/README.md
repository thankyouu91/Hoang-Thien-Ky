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

Lệnh chỉ thay XML của đúng các ô đó, giữ nguyên định dạng, các sheet khác và chỗ đã sửa tay; không sửa ô công thức. Dòng có thể ghi bằng số dòng Excel (`"#9"`). Đổi màu ô khi một số được chốt (vàng → xanh lá), dòng nhận `*` và tiền tố như `TB-KI-*`:

```
node --experimental-strip-types --no-warnings tools/data/sua.ts --mau gdd "Kiểu trang bị" "TB-KI-*" khi_hinh ten_de_xuat
```

Thêm cấu trúc mới (nhóm tham số, cột, sheet) vào file đang có mà không đụng ô cũ: viết một bước trong `tools/data/them.ts` rồi chạy nó. Chạy lại thì bỏ qua phần đã có. Các bước đã chạy: `artifact_rules`, `dao_co_ban`, `dao_co_ban_mo`, `tran_lan_2`, `hop_tran`, `luyen_khi`, `hop_tran_2`, `luyen_khi_2`, `luyen_khi_3`, `luyen_khi_4`, `luyen_khi_5`, `luyen_khi_6`, `luyen_khi_7` (2026-11-04), `thu_phat_trien`, `set_2`, `set_2b`, `set_2c`, `goc_085`, `set_2d` (2026-11-05). Bước đổi số ghi số tuyệt đối, kèm đúng định dạng ô.

`sua.ts` và `them.ts` tự tính lại các ô công thức dựa vào ô vừa sửa (`tools/data/tinh.ts`), nên không cần mở Excel để giá trị lưu sẵn đúng. Công thức chung mà Excel tạo khi lưu (shared formula) cũng đọc được.

```
node --experimental-strip-types --no-warnings tools/data/them.ts dao_co_ban
```

`tools/data/tao.ts` chỉ dùng để dựng file lần đầu; chạy lại cần `--ghi-de` và sẽ xóa mọi chỗ đã sửa tay trong Excel.

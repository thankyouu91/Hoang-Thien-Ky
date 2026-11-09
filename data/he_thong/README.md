# Số liệu hệ thống

`HoangThienKy_HeThong_v1.xlsx` là file số liệu mà GDD mục 1 nhắc tới. File gốc không còn, nên ngày 2026-11-02 dựng lại từ GDD (Claude Docs rev 162) và số đang chạy trong `packages/sim`. Ô màu vàng là đề xuất mới, chờ duyệt; sheet Ghi chú trong file giải thích màu và quy ước.

File Excel là nguồn gốc. Sửa trong Excel, lưu lại, rồi chạy ở thư mục repo:

```
node --experimental-strip-types --no-warnings tools/data/xuat.ts
```

Lệnh này ghi lại `json/` (mỗi sheet một file, đơn vị như code: phần nghìn, tick 20 mỗi giây, milli-ô) và chạy phép kiểm. Có lỗi thì lệnh trả mã 1.

`tools/data/tao.ts` chỉ dùng để dựng file lần đầu; chạy lại cần `--ghi-de` và sẽ xóa mọi chỗ đã sửa tay trong Excel.

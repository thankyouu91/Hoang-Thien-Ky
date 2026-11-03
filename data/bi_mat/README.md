# Bí mật của dev

Thư mục này chứa luật chơi chỉ dev biết. Người chơi phải tự khám phá các luật này.

- **Không đưa vào bản build cho người chơi.** Proto chỉ nạp vài file cố định trong `data/maps/` qua `import.meta.glob`, và thư mục công khai của Vite là `assets/`. Đừng thêm glob nào trỏ vào `data/bi_mat/`, và đừng chép file ở đây sang `assets/`.
- **Không ghi lên giao diện, thông báo, mô tả vật phẩm hay nhật ký.** Người chơi chỉ thấy lời cảnh báo nằm trong file điểm công khai (ví dụ trường `warning` của `data/maps/ha_diem_cam_khu.json`).
- **Máy chủ đọc luật ở đây khi tính trận, rơi đồ và sự kiện.** Khi có máy chủ thật, chuyển các file này sang cấu hình phía máy chủ.

| File | Nội dung |
|---|---|
| `ha_cam_khu.json` | Linh Hải Cấm Khu ở lòng giữa Hạ vị: rơi đồ, vào khi cấp thấp, săn theo nhóm, Thú Hoàng, xây sơn môn bên trong |

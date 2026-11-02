# Quy ước cho Claude Code trong repo này

- Ngôn ngữ trao đổi: tiếng Việt. Làm từng bước và báo lại sau mỗi bước.
- Quyền tự làm (người dùng cho phép ngày 2026-11-02: "tôi cho phép duyệt các hoạt động ko cần hỏi lại"):
    - Làm tiếp các bước đã giao mà không dừng chờ duyệt.
    - Chỗ cần chọn thì lấy phương án mình đề xuất, rồi ghi rõ đã chọn gì và vì sao trong báo cáo.
    - Được commit phần việc của mình: chạy test trước, chỉ commit file của mình (`git commit -- <đường dẫn>`), vì nhiều phiên cùng làm trong repo này.
    - Trong GDD, số tự đặt vẫn ghi "đề xuất" để người dùng xem lại sau.
    - Vẫn phải hỏi trước khi: push hoặc đưa gì lên mạng; gửi tin nhắn, email ra ngoài; mua hoặc nâng gói; xóa dữ liệu hoặc viết lại lịch sử git; tải file qua trình duyệt; tiêu PixelLab khiến số dư xuống dưới 300 lượt; sửa file do phiên khác giữ.
- Nguồn thiết kế: GDD `C:\Project\GDD\Khai_Tong_Lap_Phai_GDD.md` (bản gốc Claude Docs). Mã phải khớp GDD; chỗ nào GDD ghi "đề xuất" thì để thành tham số cấu hình.
- `packages/sim` phải deterministic: chỉ số nguyên / fixed-point thang 1000 (`fixed.ts`), không dùng Math.random, Math.sin, Math.sqrt, Date; thứ tự cập nhật theo id; mọi ngẫu nhiên qua `Rng`.
- Mỗi thay đổi ở `packages/sim` phải chạy `npm.cmd test` (gồm 10.000 trận so mã băm) trước khi commit.
- TypeScript chỉ dùng cú pháp xóa được (không enum, không namespace) để Node chạy thẳng file `.ts`; import ghi rõ đuôi `.ts`.
- Máy dev: Windows, Node 24, Git. PowerShell chặn `npm.ps1` nên dùng `npm.cmd`. Chưa có Docker (cần trước Sprint 8, xem `docs/KE_HOACH.md`).

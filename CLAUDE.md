# Quy ước cho Claude Code trong repo này

- Ngôn ngữ trao đổi: tiếng Việt. Làm từng bước và báo lại sau mỗi bước.
- Quyền tự làm (người dùng cho phép ngày 2026-11-02: "tôi cho phép duyệt các hoạt động ko cần hỏi lại"):
    - Làm tiếp các bước đã giao mà không dừng chờ duyệt.
    - Chỗ cần chọn thì lấy phương án mình đề xuất, rồi ghi rõ đã chọn gì và vì sao trong báo cáo.
    - Được commit phần việc của mình: chạy test trước, chỉ commit file của mình (`git commit -- <đường dẫn>`), vì nhiều phiên cùng làm trong repo này.
    - Trong GDD, số tự đặt vẫn ghi "đề xuất" để người dùng xem lại sau.
    - Vẫn phải hỏi trước khi: push hoặc đưa gì lên mạng; gửi tin nhắn, email ra ngoài; mua hoặc nâng gói; xóa dữ liệu hoặc viết lại lịch sử git; tải file qua trình duyệt; sửa file do phiên khác giữ.
- PixelLab (người dùng nói ngày 2026-11-03: "ko phải lo ngân sách cứ phát triển hình ảnh nào tốt nhất tôi sẽ topup thêm chi phí tạo hình"):
    - Không còn sàn số dư; chọn công cụ và số lần thử cho ra hình đẹp nhất, không chọn theo giá rẻ.
    - Báo số lượt hoặc tiền đã dùng (lấy từ `get_balance`) trong báo cáo.
    - Hết lượt và hết credits thì báo người dùng nạp thêm rồi làm tiếp phần khác; không tự mua hay nâng gói.
- Nguồn thiết kế: GDD trong chính repo này tại `docs/gdd/` (`Hoang_Thien_Ky_GDD.md`; git là nguồn sự thật từ 2026-11-09, bản Claude Docs chỉ còn là lưu trữ). Mã phải khớp GDD; chỗ nào GDD ghi "đề xuất" thì để thành tham số cấu hình.
- Từ 2026-11-09 game là MMORPG mobile thời gian thực (trước là chiến lược dashboard): combat do server tính bằng `packages/sim` ở 20 tick/giây, client chỉ gửi input; world server real-time bằng Go; `proto/` dashboard giữ làm testbench, Cửa 1 làm map mở real-time.
- `packages/sim` phải deterministic: chỉ số nguyên / fixed-point thang 1000 (`fixed.ts`), không dùng Math.random, Math.sin, Math.sqrt, Date; thứ tự cập nhật theo id; mọi ngẫu nhiên qua `Rng`.
- Mỗi thay đổi ở `packages/sim` phải chạy `npm.cmd test` (gồm 10.000 trận so mã băm) trước khi commit.
- TypeScript chỉ dùng cú pháp xóa được (không enum, không namespace) để Node chạy thẳng file `.ts`; import ghi rõ đuôi `.ts`.
- Máy dev: Windows, Node 24, Git. PowerShell chặn `npm.ps1` nên dùng `npm.cmd`. Chưa có Docker (cần trước Sprint 8, xem `docs/KE_HOACH.md`).

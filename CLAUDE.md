# Quy ước cho Claude Code trong repo này

- Ngôn ngữ trao đổi: tiếng Việt. Làm từng bước, báo lại sau mỗi bước, không làm một lèo.
- Nguồn thiết kế: GDD `C:\Project\GDD\Khai_Tong_Lap_Phai_GDD.md` (bản gốc Claude Docs). Mã phải khớp GDD; chỗ nào GDD ghi "đề xuất" thì để thành tham số cấu hình.
- `packages/sim` phải deterministic: chỉ số nguyên / fixed-point thang 1000 (`fixed.ts`), không dùng Math.random, Math.sin, Math.sqrt, Date; thứ tự cập nhật theo id; mọi ngẫu nhiên qua `Rng`.
- Mỗi thay đổi ở `packages/sim` phải chạy `npm.cmd test` (gồm 10.000 trận so mã băm) trước khi commit.
- TypeScript chỉ dùng cú pháp xóa được (không enum, không namespace) để Node chạy thẳng file `.ts`; import ghi rõ đuôi `.ts`.
- Máy dev: Windows, Node 24, Git. PowerShell chặn `npm.ps1` nên dùng `npm.cmd`. Chưa có Docker (cần trước Sprint 2).

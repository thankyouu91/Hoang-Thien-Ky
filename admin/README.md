# admin/ — Admin Dashboard Thiên Hoang Ký

Trang quản trị cho admin và ban vận hành của bản chơi thử (Cửa 1), chạy ở **https://admin.thienhoangky.fun**, sau Cloudflare Access. Chỉ admin và vận hành đăng nhập bằng Access. Người chơi thử vào game bằng **link mời** `https://thienhoangky.fun/moi/<mã>`, không qua Access và không có email.

| Thư mục, file | Việc |
|---|---|
| `src/` | Giao diện (Vite + TypeScript, không framework), phong cách tranh giấy của dashboard game; token màu chép từ `proto/src/dashboard/tokens.css` |
| `worker/` | Worker `thienhoangky-admin`: phục vụ giao diện và `/api/*`, xác minh JWT Access, chặn quyền ở server |
| `shared/hopDong.ts` | Hợp đồng dữ liệu giữa giao diện và API, nhãn sự kiện `LOAI_SU_KIEN`, 8 bước FTUE, mốc GDD mục 19 |
| `migrations/` | Bảng `qt_*` trong D1 `thienhoangky` (dùng chung với Worker game), bảng theo dõi riêng `d1_migrations_qt` |
| `test/` | `jwt.test.ts` (xác minh JWT), `e2e.ts` (Worker thật trong wrangler dev, 52 phép kiểm), `dev.ts` (chạy thử trên máy) |

Bảng game (`loi_moi`, `nguoi_choi_thu`, `su_kien`, `phan_hoi`), Worker game và các ứng dụng Access do `cloudflare/` giữ. Hợp đồng chung nằm ở `docs/api.md`.

## Hai vai trò

| Việc | Admin | Vận hành |
|---|---|---|
| Tổng quan: người chơi thử, phiên mỗi ngày, phễu FTUE, D1/D7, sự kiện | ✓ | ✓ |
| Người chơi thử: xem link mời và người chơi, chép link, ghi chú người chơi | ✓ | ✓ |
| Link mời: tạo, sửa (tên, số người tối đa, hết hạn), tắt, mở lại | ✓ | — |
| Khóa, mở khóa người chơi thử | ✓ | — |
| Phản hồi: lọc, gắn trạng thái, ghi chú nội bộ | ✓ | ✓ |
| Thông báo ở Động phủ: soạn, hẹn giờ, sửa, gỡ | ✓ | ✓ |
| Cấu hình sống (cả xem) | ✓ | 403 |
| Phân quyền (cả xem) | ✓ | 403 |
| Nhật ký quản trị | ✓ | ✓ |

Quyền chặn ở server: mỗi yêu cầu, Worker lấy email từ JWT đã xác minh rồi tra vai trò trong D1. Giao diện chỉ ẩn nút cho gọn; gõ thẳng đường dẫn hay gọi API vẫn nhận 403.

**Admin gốc** là các email trong biến `ADMIN_GOC` (`wrangler.jsonc`). Họ luôn là Admin, và giao diện không sửa hay thu quyền được, nên không ai tự khóa mình ra ngoài được.

## Thêm Admin hoặc Vận hành

Mỗi người cần hai thứ: **qua được cổng Access** của admin.thienhoangky.fun, và **có vai trò** trong admin.

1. **Cho email vào cổng Access.** Vào Zero Trust (one.dash.cloudflare.com) → Access controls:
   - nếu policy của ứng dụng **Thiên Hoang Ký – quản trị** dùng Access group **THK quan tri**: vào Access groups → THK quan tri → Include → Emails → thêm email → Save;
   - nếu policy ghi thẳng email: vào Applications → Thiên Hoang Ký – quản trị → Policies → thêm email vào Include → Emails.

   Màn **Phân quyền** có nút **Chép N email**, chép đúng danh sách cần có: Admin gốc cộng mọi email đã phân quyền. Đã nối đồng bộ (mục [Đồng bộ Access](#đồng-bộ-access-không-bắt-buộc)) thì bỏ qua bước này.
2. **Đặt vai trò.** Đăng nhập admin bằng tài khoản Admin → **Phân quyền** → nhập email, chọn **Vận hành** hoặc **Admin** → **Lưu vai trò**.
3. Người đó mở https://admin.thienhoangky.fun, nhập email, rồi nhập mã 6 số Cloudflare gửi tới hộp thư. Thư đến từ `noreply@notify.cloudflare.com`, có khi rơi vào spam.

Thứ tự nào cũng được. Người qua Access mà chưa có vai trò thấy trang "Chưa được phân quyền", và mọi API trả 403.

**Thu quyền:** Phân quyền → **Thu quyền**. Admin chặn email đó ngay từ yêu cầu kế tiếp. Sau đó bỏ email khỏi Access; phiên Access đang mở còn hiệu lực tới khi hết hạn, nhưng không còn làm được gì trong admin.

**Thêm hoặc đổi Admin gốc:** sửa `ADMIN_GOC` trong `wrangler.jsonc` (nhiều email thì cách nhau dấu phẩy), deploy lại, và thêm email đó vào Access.

Zero Trust Free cho tối đa 50 người dùng. Vì người chơi thử không qua Access, 50 chỗ này chỉ dành cho admin và vận hành.

## Người chơi thử và link mời

- **Tạo link** (Admin): màn **Người chơi thử** → Tạo link mời. Đặt tên (để biết link phát ở đâu), số người tối đa và hạn dùng; hai mục sau để trống là không giới hạn. Server sinh mã ngẫu nhiên 12 ký tự.
- **Tên miền của link:** link ghép từ biến `GAME_ORIGIN` trong `wrangler.jsonc` (hiện là `https://choi.thienhoangky.fun`, chốt 2026-11-05), theo dạng `GAME_ORIGIN/moi/<mã>`. Nếu dời game sang tên miền khác (ví dụ `https://choi.thienhoangky.fun`), đổi dòng đó rồi deploy lại admin. Mã link nằm trong D1 nên không đổi; chỉ phần tên miền hiện và chép trong admin đổi theo. Link cũ đã gửi đi vẫn trỏ tên miền cũ, nên Worker game cần chuyển hướng từ tên miền cũ.
- Gửi link cho nhóm chơi thử. Mỗi trình duyệt mở link khi link còn mở trở thành một người chơi thử, có mã 10 ký tự, và giữ cookie vào game 180 ngày (do Worker game cấp).
- **Tắt link, hết lượt, hết hạn:** người mới mở link sẽ không vào được. Người đã vào vẫn chơi tiếp.
- **Khóa người chơi** (Admin): ghi `nguoi_choi_thu.khoa = 1`. Worker game chặn trình duyệt đó ngay ở lần tải trang hoặc lần gọi API kế tiếp. Tiến độ trong trình duyệt của họ không bị xóa.
- **Ghi chú** (cả hai vai trò): lưu ở `qt_ghi_chu_nguoi_choi`, chỉ admin và vận hành thấy. Không ghi thông tin định danh nếu không cần.
- Sự kiện game là ẩn danh (`an_danh` theo trình duyệt). FTUE, D1/D7 và người mỗi ngày đếm theo máy. Lần đầu, lần cuối và số phiên của từng người chơi thử lấy từ `nguoi_choi_thu`.

## Đồng bộ Access (không bắt buộc)

Chỉ áp dụng cho nhóm quản trị. Muốn Worker tự ghi danh sách Admin và Vận hành vào Access group **THK quan tri** sau mỗi lần phân quyền hay thu quyền:

1. Policy của ứng dụng quản trị include Access group `THK quan tri` (tab deploy dựng sẵn khi tạo Access).
2. Tạo API token ở dash.cloudflare.com → My Profile → API Tokens → Create Custom Token. Quyền: **Account → Access: Organizations, Identity Providers, and Groups → Edit**, chỉ cho tài khoản này, không thêm quyền khác.
3. Trong `wrangler.jsonc` → `vars`, điền `CF_ACCOUNT_ID` và `ACCESS_GROUP_QUAN_TRI` (id group nằm trên URL trang group). Token là secret:
   ```
   npx.cmd wrangler secret put CF_API_TOKEN
   ```
4. Deploy lại. Khung Access ở màn Phân quyền đổi thành "Tự đồng bộ", và có nút **Đồng bộ lại**.

Mỗi lần đồng bộ, Worker ghi đè toàn bộ Include của group bằng `ADMIN_GOC` cộng `qt_vai_tro`. Danh sách rỗng (chưa đặt `ADMIN_GOC`) thì không ghi.

## Hợp đồng với Worker game

Admin **ghi** vào bảng game:
- `loi_moi`: thêm, sửa `ten`, `toi_da`, `het_han`, `tat`, cùng `sua_boi` và `sua_luc`;
- `nguoi_choi_thu`: chỉ các cột `khoa`, `ly_do_khoa`, `sua_boi`, `sua_luc`.

Admin **đọc** `nguoi_choi_thu` (không bao giờ đọc `the_hash`), `su_kien` và `phan_hoi`. Trạng thái xử lý phản hồi nằm ở `qt_phan_hoi_xu_ly`, nối qua `phan_hoi_id = CAST(id AS TEXT)`.

Bảng game chưa có (khi chạy cục bộ không có `--bang-game`) thì API trả dữ liệu giả cùng dạng, `nguon: "mau"`, màn hiện nhãn "Dữ liệu mẫu", và các thao tác ghi bảng game trả 503.

Worker game đọc hai bảng `qt_*` (đã làm ở `cloudflare/src/game.ts`):

```sql
-- Thông báo đang hiện ở Động phủ (quan_trong trước)
SELECT id, tieu_de, noi_dung, muc, bat_dau, ket_thuc FROM qt_thong_bao
 WHERE trang_thai = 'dang' AND bat_dau <= :now AND (ket_thuc IS NULL OR ket_thuc > :now);
-- Cấu hình sống: khoa không có dòng thì dùng mac_dinh trong worker/cauHinh.ts (game import THAM_SO từ file này)
SELECT khoa, gia_tri FROM qt_cau_hinh;   -- gia_tri là JSON
```

## Bảo mật

- **Mọi yêu cầu, kể cả file tĩnh,** đều qua Worker (`run_worker_first`). Worker kiểm JWT trong `Cf-Access-Jwt-Assertion`:
  - chữ ký RS256 theo khóa của team;
  - `aud` của ứng dụng admin;
  - `iss` và hạn dùng;
  - có `email`, nên service token bị từ chối.

  Thiếu `ACCESS_TEAM_DOMAIN` hoặc `ACCESS_AUD` thì trả 503. Không có lối tắt bỏ qua JWT, kể cả khi chạy cục bộ.
- `workers_dev: false` và `preview_urls: false`: chỉ vào được qua admin.thienhoangky.fun.
- Chống CSRF: `POST` phải cùng `Origin` và là JSON. CSP chặt (`script-src 'self'`, `frame-ancestors 'none'`), `Cache-Control: no-store`.
- **Email của admin và vận hành là dữ liệu cá nhân:**
  - không nằm trong URL, vì thao tác theo email gửi qua thân POST;
  - không `console.log`;
  - Workers Logs tắt invocation log (`observability.logs.invocation_logs: false`).

  Nơi duy nhất ngoài bảng `qt_vai_tro` có email là nhật ký quản trị (`qt_nhat_ky`). "Liên hệ" trong phản hồi do người chơi tự để lại, và chỉ người có vai trò mới thấy.
- **"Xem như Vận hành"** (Admin bật ở thanh bên): giao diện gửi header `X-Xem-Nhu: van_hanh`, và server hạ quyền cho các yêu cầu đó. Header chỉ hạ quyền, không bao giờ nâng. Dùng để thử việc chặn mà không cần email thứ hai.

## Chạy ở máy

```
cd admin
npm.cmd install
npm.cmd run dev              # http://127.0.0.1:5180, Admin gốc admin@example.com; số liệu game là mẫu
node test/dev.ts --bang-game # chạy thêm migration game để thử tạo link mời, khóa thật
node test/dev.ts --van-hanh  # vào với quyền Vận hành
npm.cmd test                 # test JWT, build, rồi e2e trên wrangler dev
```

`test/dev.ts` dựng máy chủ khóa giả, chạy Worker thật bằng wrangler dev với D1 cục bộ, rồi chạy Vite. Vite chuyển `/api` sang wrangler kèm JWT ký bằng khóa giả. Đổi migration `qt_*` thì xóa `.wrangler/state` để tạo lại D1 cục bộ.

## Deploy

Thứ tự:

1. Đã có ứng dụng Access cho `admin.thienhoangky.fun`. Team `jolly-water-a8bd.cloudflareaccess.com` đã điền sẵn.
2. Điền `ACCESS_AUD` và `ADMIN_GOC` trong `wrangler.jsonc`.
3. Chạy:

```
cd admin
npm.cmd ci
npx.cmd wrangler d1 migrations apply thienhoangky --remote   # tạo bảng qt_* (lần đầu, và khi có migration mới)
npm.cmd run deploy                                         # check + build + wrangler deploy (gắn tên miền admin.thienhoangky.fun)
```

Phải có ứng dụng Access trước khi gắn tên miền. Kể cả khi Access tạm thiếu, Worker vẫn trả 401 hoặc 503, nên giao diện không lộ.

## Đã chọn và vì sao

- **Worker riêng `thienhoangky-admin`, không gộp vào Worker game.** Ứng dụng Access riêng có `aud` riêng. Hai bên deploy không giẫm nhau, và Worker game không mang mã quản trị.
- **Bảng `qt_*` có migration riêng** (`migrations_table: d1_migrations_qt`): mỗi bên tự chạy migration của mình trên cùng D1.
- **Tạo, sửa, tắt link và khóa người chơi chỉ Admin làm.** Mấy việc này đổi ai được vào game, gần với phân quyền. Vận hành vẫn xem, chép link và ghi chú được.
- **Mã link do server sinh** (12 ký tự, bỏ các chữ dễ nhầm `l`, `o`, `0`, `1`), không cho tự đặt, để link khó đoán.
- **Không tự đổi vai trò của chính mình, và không sửa Admin gốc từ giao diện**, để không ai lỡ tay khóa hết Admin.
- **Cấu hình sống là 7 tham số đề xuất:**
  - tốc độ kinh tế;
  - hệ số tua thời gian;
  - hệ số kinh nghiệm;
  - hệ số rơi tàn quyển;
  - phút nhắc nghỉ;
  - bật bảo trì;
  - lời báo bảo trì.

  Mọi số chờ người dùng duyệt. Thêm tham số thì sửa `THAM_SO` trong `worker/cauHinh.ts`; Worker game tự nhận.
- **Giao diện không dùng framework.** Bảy màn nhỏ, chữ Lora và Cormorant Garamond tự host (`@fontsource`), không gọi mạng ngoài.

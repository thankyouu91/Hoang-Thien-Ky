# admin/ — Admin Dashboard Thiên Hoang Ký

Trang quản trị cho admin và ban vận hành của bản chơi thử kín (Cửa 1), chạy ở **https://admin.thienhoangky.fun**, sau Cloudflare Access.

| Thư mục, file | Việc |
|---|---|
| `src/` | Giao diện (Vite + TypeScript, không framework), phong cách tranh giấy của dashboard game; token màu chép từ `proto/src/dashboard/tokens.css` |
| `worker/` | Worker `thienhoangky-admin`: phục vụ giao diện và `/api/*`, xác minh JWT Access, chặn quyền ở server |
| `shared/hopDong.ts` | Hợp đồng dữ liệu giữa giao diện và API, nhãn sự kiện `LOAI_SU_KIEN`, 8 bước FTUE, mốc GDD mục 19 |
| `migrations/` | Bảng `qt_*` trong D1 `thienhoangky` (dùng chung với Worker game), bảng theo dõi riêng `d1_migrations_qt` |
| `test/` | `jwt.test.ts` (xác minh JWT), `e2e.ts` (Worker thật trong wrangler dev, 50 phép kiểm), `dev.ts` (chạy thử trên máy) |

Bảng game, Worker game và các ứng dụng Access do `cloudflare/` giữ; hợp đồng chung ở `docs/api.md`.

## Hai vai trò

| Việc | Admin | Vận hành |
|---|---|---|
| Tổng quan: người chơi thử, phiên mỗi ngày, phễu FTUE, D1/D7, sự kiện | ✓ | ✓ |
| Người chơi thử: xem danh sách, lần chơi cuối, số phiên; sửa ghi chú | ✓ | ✓ |
| Người chơi thử: mời, khóa, mở khóa, bỏ mời | ✓ | — |
| Phản hồi: lọc, gắn trạng thái, ghi chú nội bộ | ✓ | ✓ |
| Thông báo ở Động phủ: soạn, hẹn giờ, sửa, gỡ | ✓ | ✓ |
| Cấu hình sống (cả xem) | ✓ | 403 |
| Phân quyền (cả xem) | ✓ | 403 |
| Nhật ký quản trị | ✓ | ✓ |

Quyền chặn ở server: mỗi yêu cầu, Worker lấy email từ JWT đã xác minh rồi tra vai trò trong D1. Giao diện chỉ ẩn nút cho gọn; gõ thẳng đường dẫn hay gọi API vẫn nhận 403.

**Admin gốc** là các email trong biến `ADMIN_GOC` (`wrangler.jsonc`). Họ luôn là Admin, và giao diện không sửa hay thu quyền được, nên không ai tự khóa mình ra ngoài được.

## Thêm Admin hoặc Vận hành

Mỗi người cần hai thứ: **qua được cổng Access** của admin.thienhoangky.fun, và **có vai trò** trong admin.

1. **Cho email vào cổng Access.** Vào Zero Trust (one.dash.cloudflare.com) → Access controls → Applications → **Thiên Hoang Ký – quản trị** → Policies → policy cho phép → Include → Emails → thêm email → Save.
   - Màn **Phân quyền** có khung "Access · admin.thienhoangky.fun", với nút **Chép N email**. Nút này chép đúng danh sách cần có trong policy: Admin gốc cộng mọi email đã phân quyền.
   - Nếu đã nối đồng bộ (xem mục [Đồng bộ Access](#đồng-bộ-access-không-bắt-buộc)), bỏ qua bước này.
2. **Đặt vai trò.** Đăng nhập admin bằng tài khoản Admin → **Phân quyền** → nhập email, chọn **Vận hành** hoặc **Admin** → **Lưu vai trò**.
3. Người đó mở https://admin.thienhoangky.fun, nhập email và mã 6 số Cloudflare gửi tới hộp thư (từ `noreply@notify.cloudflare.com`, có khi rơi vào spam).

Thứ tự nào cũng được. Người qua Access mà chưa có vai trò thấy trang "Chưa được phân quyền", và mọi API trả 403.

**Thu quyền:** Phân quyền → **Thu quyền**. Admin chặn email đó ngay từ yêu cầu kế tiếp. Sau đó bỏ email khỏi policy Access; phiên Access đang mở còn hiệu lực tới khi hết hạn, nhưng không còn làm được gì trong admin.

**Thêm hoặc đổi Admin gốc:** sửa `ADMIN_GOC` trong `wrangler.jsonc` (nhiều email thì cách nhau dấu phẩy), rồi deploy lại. Nhớ thêm email đó vào policy Access.

## Người chơi thử

Danh sách cổng thật là policy của ứng dụng Access **Thiên Hoang Ký – chơi thử** (thienhoangky.fun). Màn **Người chơi thử** là bản quản trị của danh sách ấy:

- **Mời:** dán email, mỗi dòng một email. Sau đó cập nhật Access: màn hiện các bước và nút **Chép N email**, chép đúng những email đang được chơi (đã mời và không khóa). Dán đè vào Include → Emails của policy "Người chơi thử". Đã nối đồng bộ thì không phải làm bước này.
- **Khóa:** Worker game trả 403 `bi_khoa` cho mọi API của email đó ngay lập tức. Muốn chặn cả phần tải game thì bỏ email khỏi Access (đồng bộ tự làm việc này).
- **Lần chơi cuối, số phiên:** lấy từ bảng `nguoi_choi_thu` của Worker game. Email đã vào game mà không có trong danh sách mời (thường là Admin, Vận hành, hoặc người được thêm thẳng vào Access) hiện dòng "Ngoài danh sách", và Admin bấm **Thêm vào danh sách** được.
- Sự kiện game là ẩn danh (`an_danh` theo trình duyệt), không nối với email. Vì vậy FTUE, D1/D7 và người mỗi ngày đếm theo máy, còn email chỉ có lần đầu, lần cuối và số phiên.

## Đồng bộ Access (không bắt buộc)

Khi chưa nối, admin dán danh sách bằng tay như hướng dẫn ở trên. Muốn Worker tự ghi danh sách vào Access sau mỗi lần mời, khóa, bỏ mời hay phân quyền, làm như sau:

1. Zero Trust → Access controls → **Access groups** → tạo hai group, Include → Emails tạm một email:
   - `THK nguoi choi thu`
   - `THK quan tri`
2. Sửa policy hai ứng dụng: policy "Người chơi thử" của ứng dụng chơi thử thì Include → Access groups → `THK nguoi choi thu`. Nếu muốn Admin và Vận hành chơi được, thêm cả `THK quan tri`. Policy của ứng dụng quản trị thì Include → Access groups → `THK quan tri`. Bỏ các dòng Emails cũ sau khi đồng bộ lần đầu thành công.
3. Tạo API token ở dash.cloudflare.com → My Profile → API Tokens → Create Custom Token. Quyền: **Account → Access: Organizations, Identity Providers, and Groups → Edit**, chỉ cho tài khoản này. Chỉ cần quyền đó, không cần quyền nào khác.
4. Trong `wrangler.jsonc` → `vars`, điền `CF_ACCOUNT_ID`, `ACCESS_GROUP_NGUOI_CHOI` và `ACCESS_GROUP_QUAN_TRI` (id group nằm trên URL trang group). Token là secret:
   ```
   npx.cmd wrangler secret put CF_API_TOKEN
   ```
5. Deploy lại. Khung Access ở hai màn đổi thành "Tự đồng bộ", và có nút **Đồng bộ lại**.

Mỗi lần đồng bộ, Worker ghi đè toàn bộ Include của group bằng danh sách trong D1. Group quản trị luôn có Admin gốc. Danh sách người chơi rỗng thì không ghi, vì Access không nhận group rỗng.

## Hợp đồng với Worker game

Worker game đọc ba bảng `qt_*` (đã làm ở `cloudflare/src/game.ts`):

```sql
-- Thông báo đang hiện ở Động phủ (quan_trong trước)
SELECT id, tieu_de, noi_dung, muc, bat_dau, ket_thuc FROM qt_thong_bao
 WHERE trang_thai = 'dang' AND bat_dau <= :now AND (ket_thuc IS NULL OR ket_thuc > :now);
-- Cấu hình sống: khoa không có dòng thì dùng mac_dinh trong worker/cauHinh.ts
SELECT khoa, gia_tri FROM qt_cau_hinh;          -- gia_tri là JSON
-- Khóa người chơi
SELECT khoa FROM qt_nguoi_choi WHERE email = :email;   -- 1 → 403 bi_khoa
```

Admin đọc bảng game `nguoi_choi_thu`, `su_kien` và `phan_hoi`. Trạng thái xử lý phản hồi nằm ở `qt_phan_hoi_xu_ly`, nối qua `phan_hoi_id = CAST(id AS TEXT)`. Bảng game chưa có (khi chạy cục bộ) thì API trả dữ liệu giả cùng dạng, `nguon: "mau"`, và màn hiện nhãn "Dữ liệu mẫu".

## Bảo mật

- **Mọi yêu cầu, kể cả file tĩnh,** đều qua Worker (`run_worker_first`). Worker kiểm JWT trong `Cf-Access-Jwt-Assertion`:
  - chữ ký RS256 theo khóa của team;
  - `aud` của ứng dụng admin, nên token của ứng dụng game không vào được;
  - `iss` và hạn dùng;
  - có `email`, nên service token bị từ chối.

  Thiếu `ACCESS_TEAM_DOMAIN` hoặc `ACCESS_AUD` thì Worker trả 503. Không có lối tắt bỏ qua JWT, kể cả khi chạy cục bộ.
- `workers_dev: false` và `preview_urls: false`: chỉ vào được qua admin.thienhoangky.fun.
- Chống CSRF: `POST` phải cùng `Origin` và là JSON. CSP chặt (`script-src 'self'`, `frame-ancestors 'none'`), `Cache-Control: no-store`.
- **Email là dữ liệu cá nhân:**
  - chỉ trả về cho người có vai trò;
  - không nằm trong URL, vì mọi thao tác theo email gửi qua thân POST;
  - không `console.log`;
  - Workers Logs tắt invocation log (`observability.logs.invocation_logs: false`).

  Nơi duy nhất ngoài bảng dữ liệu có email là nhật ký quản trị (`qt_nhat_ky`).
- **"Xem như Vận hành"** (Admin bật ở thanh bên): giao diện gửi header `X-Xem-Nhu: van_hanh`, và server hạ quyền cho các yêu cầu đó. Header chỉ hạ quyền, không bao giờ nâng. Dùng để thử việc chặn mà không cần email thứ hai.

## Chạy ở máy

```
cd admin
npm.cmd install
npm.cmd run dev        # http://127.0.0.1:5180, Admin gốc admin@example.com (thêm --van-hanh: node test/dev.ts --van-hanh)
npm.cmd test           # test JWT, build, rồi e2e trên wrangler dev
```

`test/dev.ts` dựng máy chủ khóa giả, chạy Worker thật bằng wrangler dev với D1 cục bộ, rồi chạy Vite. Vite chuyển `/api` sang wrangler kèm JWT ký bằng khóa giả. Lần đầu nó thêm sẵn một Vận hành, vài người chơi và một thông báo.

## Deploy

Đã có ứng dụng Access cho `admin.thienhoangky.fun` (tab deploy giữ). Điền `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD`, `ADMIN_GOC` trong `wrangler.jsonc` rồi:

```
cd admin
npm.cmd ci
npx.cmd wrangler d1 migrations apply thienhoangky --remote   # khi có migration mới trong admin/migrations
npm.cmd run deploy                                         # check + build + wrangler deploy (gắn tên miền admin.thienhoangky.fun)
```

Phải tạo ứng dụng Access trước khi gắn tên miền. Nếu Access tạm thiếu, Worker vẫn trả 401/503, nên giao diện không lộ.

## Đã chọn và vì sao

- **Worker riêng `thienhoangky-admin`, không gộp vào Worker game.** Ứng dụng Access riêng có `aud` riêng, nên token chơi game không mở được admin. Hai bên deploy không giẫm nhau, và Worker game không mang mã quản trị. Giá phải trả là cấu hình D1 lặp ở hai file `wrangler.jsonc`.
- **Bảng `qt_*` có migration riêng** (`migrations_table: d1_migrations_qt`): mỗi bên tự chạy migration của mình trên cùng D1.
- **Mời, khóa, bỏ mời chỉ Admin làm.** Ba việc này đổi người được vào game, gần với phân quyền. Vận hành vẫn sửa ghi chú người chơi được, vì đó là việc theo dõi.
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
- **Giao diện không dùng framework.** Bảy màn nhỏ, bản build khoảng 46 KB JS. Chữ Lora và Cormorant Garamond tự host (`@fontsource`), không gọi mạng ngoài.

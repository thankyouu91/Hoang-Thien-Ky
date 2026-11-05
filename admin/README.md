# admin/ — Admin Dashboard Thiên Hoang Ký

Trang quản trị cho admin và ban vận hành của bản chơi thử (Cửa 1), chạy ở **https://admin.thienhoangky.fun**.

- **Admin và vận hành** qua **hai lớp** (người dùng chốt ngày 2026-11-05):
  1. **Cloudflare Access:** ứng dụng "Thiên Hoang Ký – quản trị", nhận mã một lần gửi qua email; email phải có trong Access group "THK quan tri".
  2. **Tên đăng nhập và mật khẩu** của admin, với vai trò Admin hoặc Vận hành.
- **Người chơi thử** vào game bằng **link mời** `https://play.thienhoangky.fun/moi/<mã>`, không có tài khoản.

| Thư mục, file | Việc |
|---|---|
| `src/` | Giao diện (Vite + TypeScript, không framework), phong cách tranh giấy của dashboard game; token màu chép từ `proto/src/dashboard/tokens.css` |
| `worker/` | Worker `thienhoangky-admin`: phục vụ giao diện và `/api/*`, đăng nhập và phiên (`taiKhoan.ts`, `matKhau.ts`), chặn quyền ở server |
| `shared/hopDong.ts` | Hợp đồng dữ liệu giữa giao diện và API, nhãn sự kiện `LOAI_SU_KIEN`, 8 bước FTUE, mốc GDD mục 19 |
| `migrations/` | Bảng `qt_*` trong D1 `thienhoangky` (dùng chung với Worker game), bảng theo dõi riêng `d1_migrations_qt` |
| `scripts/tao-tai-khoan.ts` | Tạo tài khoản đầu tiên, hoặc đặt lại mật khẩu khi không còn Admin nào vào được |
| `test/` | `jwt.test.ts` (xác minh JWT Access), `e2e.ts` (Worker thật trong wrangler dev, 64 phép kiểm), `dev.ts` (chạy thử trên máy, tắt lớp Access) |

Bảng game (`loi_moi`, `nguoi_choi_thu`, `su_kien`, `phan_hoi`) và Worker game do `cloudflare/` giữ. Hợp đồng chung nằm ở `docs/api.md`.

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
| Tài khoản: tạo, đổi vai trò, đặt lại mật khẩu, khóa, xóa (cả xem) | ✓ | 403 |
| Nhật ký quản trị | ✓ | ✓ |
| Tự đổi mật khẩu của mình | ✓ | ✓ |

Quyền chặn ở server: mỗi yêu cầu, Worker kiểm JWT của Access, tìm phiên theo cookie, rồi lấy vai trò của tài khoản trong D1. Giao diện chỉ ẩn nút cho gọn; gõ thẳng đường dẫn hay gọi API vẫn nhận 403.

## Lần đăng nhập đầu: tài khoản `admin`

Tài khoản đầu tiên không nằm trong migration. Nó được tạo bằng script, để mật khẩu không bao giờ vào git:

```
cd admin
node scripts/tao-tai-khoan.ts admin admin --ghi <file mật khẩu>   # sinh .tmp/tai-khoan-admin.sql (chỉ có mật khẩu băm) và ghi mật khẩu tạm vào <file>
npx.cmd wrangler d1 execute thienhoangky --remote --file .tmp/tai-khoan-admin.sql
```

1. Mở https://admin.thienhoangky.fun. Access hỏi email: nhập votranlong91@gmail.com rồi nhập mã 6 số gửi về hộp thư (thư từ `noreply@notify.cloudflare.com`, có khi rơi vào spam). Sau đó đăng nhập `admin` bằng mật khẩu tạm.
2. Trang bắt đổi mật khẩu ngay: ít nhất 12 ký tự, không chứa tên đăng nhập. Một câu dài dễ nhớ là tốt.
3. Đổi xong thì xóa file mật khẩu tạm.

**Quên mật khẩu**, theo thứ tự ưu tiên:
1. Màn đăng nhập → **Quên mật khẩu?** → nhận link qua email (mục dưới). Cách này cần tài khoản đã có email.
2. Nhờ một Admin khác vào **Tài khoản → Đặt lại mật khẩu**.
3. Không còn Admin nào vào được thì chạy lại hai lệnh trên với tên tài khoản đó. Script đặt mật khẩu tạm mới, mở khóa tài khoản và đăng xuất mọi phiên của nó. Chạy script thì **phải** chạy cả lệnh `d1 execute`. Nếu không, mật khẩu trong file không khớp với D1, và mật khẩu tạm của lần chạy trước cũng hết dùng.

## Đặt lại mật khẩu qua email

Người dùng yêu cầu ngày 2026-11-05: chỉ cho tài khoản quản trị, giữ gói Workers Free.

**Dựng một lần.** Người dùng tự chạy các lệnh này, vì lệnh đổi DNS và Cloudflare bị chặn quyền ở các phiên Claude:

```
npx.cmd wrangler email routing enable thienhoangky.fun                      # thêm MX, SPF, DKIM cho tên miền gốc
npx.cmd wrangler email routing addresses create <email của tài khoản>      # mỗi email một lần, rồi bấm link xác nhận trong thư
```

Gói Free chỉ gửi được tới **địa chỉ đã xác nhận** ở Email Routing của tài khoản Cloudflare. Email nào chưa xác nhận thì thư đặt lại không tới. Lỗi gửi được ghi trong nhật ký quản trị ("Gửi link đặt lại mật khẩu"), không hiện cho người yêu cầu. Gửi tới địa chỉ bất kỳ cần gói Workers Paid.

**Đặt email cho tài khoản:**
- tự đặt: thanh bên → **Email** (phải nhập mật khẩu hiện tại);
- Admin đặt cho người khác: **Tài khoản → Email**.

Chưa đăng nhập được mà muốn đặt email cho `admin` thì chạy:
```
npx.cmd wrangler d1 execute thienhoangky --remote --command "UPDATE qt_tai_khoan SET email = '<email>' WHERE ten = 'admin'"
```

**Cách chạy:**
- **Quên mật khẩu?**: nhập tên đăng nhập. Server luôn trả cùng một câu và trả ngay. Việc tra tài khoản và gửi thư chạy sau (`waitUntil`), nên nhìn câu trả lời hay thời gian trả lời đều không đoán được tên nào có thật hay có email.
- **Giới hạn:** mỗi tài khoản tối đa 3 link mỗi giờ. Mỗi yêu cầu còn được cộng vào bộ đếm IP chung với đăng nhập (quá 20 lần trong 15 phút thì 429).
- **Thư:** gửi từ `khong-tra-loi@thienhoangky.fun`, chứa link `https://admin.thienhoangky.fun/dat-lai#<token>`.
  - Token 256 bit nằm sau dấu `#`, nên không vào log máy chủ hay Referer. Trang tự xóa token khỏi thanh địa chỉ ngay khi mở.
  - D1 (`qt_dat_lai`) chỉ giữ SHA-256 của token.
- **Link:** dùng một lần trong 30 phút. Đặt xong thì mọi link khác của tài khoản hết dùng, mọi phiên bị đăng xuất, và tạm khóa vì sai mật khẩu được gỡ. Tài khoản bị Admin khóa thì không đặt lại được.
- Trang `/dat-lai` vẫn nằm sau Cloudflare Access như cả tên miền, nên người đặt lại phải qua mã email Access trước.
- Chạy cục bộ: wrangler không gửi thư thật, mà ghi nội dung thư ra file và in đường dẫn ra console. `test/e2e.ts` đọc file đó để lấy link.

## Thêm Admin hoặc Vận hành

Mỗi người cần hai thứ: **email trong Access** và **một tài khoản trong admin**.

1. **Cho email qua cổng Access.** Vào Zero Trust (one.dash.cloudflare.com) → Access controls → Access groups → **THK quan tri** → Include → Emails → thêm email → Save. Zero Trust Free cho tối đa 50 người.
2. **Tạo tài khoản.** Admin vào **Tài khoản → Tạo tài khoản**: nhập tên đăng nhập (3–32 ký tự: chữ thường không dấu, số, `.` `_` `-`), chọn **Vận hành** hoặc **Admin**.
3. Màn hiện **mật khẩu tạm một lần duy nhất**. Gửi cho người nhận qua kênh riêng, không dán vào nhóm chat chung.
4. Người nhận mở admin.thienhoangky.fun, nhập email nhận mã Access, đăng nhập bằng mật khẩu tạm, rồi phải đặt mật khẩu của mình trước khi dùng các màn khác.

**Thu quyền** một người: khóa hoặc xóa tài khoản ở màn Tài khoản (có hiệu lực ngay), rồi bỏ email khỏi group THK quan tri.

Trên màn Tài khoản còn có:
- **đổi vai trò**: có hiệu lực ngay từ yêu cầu kế tiếp của người đó;
- **đặt lại mật khẩu**: tạo mật khẩu tạm mới và đăng xuất mọi phiên của tài khoản;
- **khóa**: đăng xuất ngay và không cho đăng nhập lại;
- **xóa**: nhật ký cũ vẫn giữ tên tài khoản.

Không ai tự khóa, tự hạ quyền hay tự xóa chính mình được, và server luôn giữ ít nhất một Admin đang hoạt động.

## Người chơi thử và link mời

- **Tạo link** (Admin): màn **Người chơi thử** → Tạo link mời. Đặt tên (để biết link phát ở đâu), số người tối đa và hạn dùng; hai mục sau để trống là không giới hạn. Server sinh mã ngẫu nhiên 12 ký tự.
- **Tên miền của link:** link ghép từ biến `GAME_ORIGIN` trong `wrangler.jsonc` (hiện là `https://play.thienhoangky.fun`; `choi.thienhoangky.fun` chuyển 301 sang đây), theo dạng `GAME_ORIGIN/moi/<mã>`. Game dời tên miền thì đổi dòng đó rồi deploy lại admin. Link đã gửi trước đó do trang ở tên miền cũ chuyển hướng sang tên miền mới.
- Mỗi trình duyệt mở link khi link còn mở trở thành một người chơi thử, có mã 10 ký tự, và giữ cookie vào game 180 ngày (do Worker game cấp).
- **Tắt link, hết lượt, hết hạn:** người mới mở link sẽ không vào được. Người đã vào vẫn chơi tiếp.
- **Khóa người chơi** (Admin): ghi `nguoi_choi_thu.khoa = 1`. Worker game chặn trình duyệt đó ngay ở lần tải trang hoặc lần gọi API kế tiếp. Tiến độ trong trình duyệt của họ không bị xóa.
- **Ghi chú** (cả hai vai trò): lưu ở `qt_ghi_chu_nguoi_choi`, chỉ admin và vận hành thấy.
- Sự kiện game là ẩn danh (`an_danh` theo trình duyệt). FTUE, D1/D7 và người mỗi ngày đếm theo máy. Lần đầu, lần cuối và số phiên của từng người chơi thử lấy từ `nguoi_choi_thu`.

## Hợp đồng với Worker game

Admin **ghi** vào bảng game:
- `loi_moi`: thêm, sửa `ten`, `toi_da`, `het_han`, `tat`, cùng `sua_boi` và `sua_luc`;
- `nguoi_choi_thu`: chỉ các cột `khoa`, `ly_do_khoa`, `sua_boi`, `sua_luc`.

Cột `*_boi` là tên đăng nhập của tài khoản quản trị.

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

- **Mật khẩu:**
  - băm bằng PBKDF2-SHA256 với muối riêng từng tài khoản, 30.000 vòng (`worker/matKhau.ts`);
  - không lưu, không log mật khẩu thô;
  - mật khẩu tạm có 16 ký tự ngẫu nhiên, và người nhận phải đổi ở lần đăng nhập đầu;
  - mật khẩu tự đặt có ít nhất 12 ký tự và không chứa tên đăng nhập.
- **Phiên:**
  - cookie `__Host-qt` (HttpOnly, Secure, SameSite=Strict, Path=/) giữ mã ngẫu nhiên 32 byte; D1 chỉ lưu SHA-256 của mã đó;
  - hết hạn sau 12 giờ;
  - đăng xuất, đổi mật khẩu, đặt lại mật khẩu hay khóa tài khoản đều xóa phiên tương ứng.
- **Chống dò mật khẩu:**
  - sai 5 lần liền thì tài khoản tạm khóa 15 phút;
  - một IP sai quá 20 lần trong 15 phút thì bị chặn (429); IP chỉ lưu dạng băm;
  - sai mật khẩu và sai tên đăng nhập trả cùng một câu, trong cùng một khoảng thời gian.
- **Chống CSRF:** `POST`, kể cả đăng nhập, phải cùng `Origin` và là JSON; cookie SameSite=Strict. CSP chặt (`script-src 'self'`, `frame-ancestors 'none'`), `Cache-Control: no-store`.
- **Không có địa chỉ phụ:** `workers_dev: false` và `preview_urls: false`, chỉ vào được qua admin.thienhoangky.fun.
- **Log:** Workers Logs tắt invocation log. Worker không log mật khẩu, mã phiên hay thân yêu cầu. "Liên hệ" trong phản hồi do người chơi tự để lại, và chỉ người có vai trò mới thấy.
- **"Xem như Vận hành"** (Admin bật ở thanh bên): giao diện gửi header `X-Xem-Nhu: van_hanh`, và server hạ quyền cho các yêu cầu đó. Header chỉ hạ quyền, không bao giờ nâng. Dùng để thử việc chặn mà không cần tài khoản thứ hai.
- **Lớp Cloudflare Access bên ngoài (đang bật):** `ACCESS_TEAM_DOMAIN` và `ACCESS_AUD` trong `wrangler.jsonc` là của ứng dụng "Thiên Hoang Ký – quản trị".
  - Mọi yêu cầu, kể cả trang đăng nhập và file tĩnh, phải mang JWT Access hợp lệ: chữ ký RS256 theo khóa của team, đúng `aud` của ứng dụng admin, đúng `iss`, còn hạn.
  - Worker kiểm lại JWT này dù Access đã chặn ở biên, nên đường vào nào lách được Access cũng không qua được.
  - Đặt thiếu một trong hai biến thì Worker trả 503, không chạy với cấu hình nửa vời.
  - Muốn bỏ lớp này: xóa hai biến rồi deploy lại, sau đó xóa ứng dụng Access. Làm ngược thứ tự thì mọi yêu cầu bị 401 trong lúc chờ.

## Chạy ở máy

```
cd admin
npm.cmd install
npm.cmd run dev              # mở http://localhost:5180 (không dùng 127.0.0.1: Chrome bỏ cookie Secure); số liệu game là mẫu
node test/dev.ts --bang-game # chạy thêm migration game để thử tạo link mời, khóa thật
npm.cmd test                 # test JWT, build, rồi e2e trên wrangler dev
```

`test/dev.ts` chạy Worker thật bằng wrangler dev với D1 cục bộ (ghi đè hai biến Access thành rỗng, vì máy dev không có Access), rồi chạy Vite (Vite chuyển `/api` sang wrangler). Lần đầu nó tạo hai tài khoản thử **chỉ có trong D1 cục bộ**:
- `admin` (Admin) và `vanhanh` (Vận hành);
- mật khẩu chung `mat-khau-thu-cuc-bo`.

Đổi migration `qt_*` thì xóa `.wrangler/state` để tạo lại D1 cục bộ.

## Deploy

```
cd admin
npm.cmd ci
npx.cmd wrangler d1 migrations apply thienhoangky --remote                    # tạo bảng qt_* (lần đầu, và khi có migration mới, như 0002_dat_lai)
npx.cmd wrangler d1 execute thienhoangky --remote --file .tmp/tai-khoan-admin.sql   # chỉ lần đầu: tài khoản admin (xem mục trên)
npm.cmd run deploy                                                          # check + build + wrangler deploy (gắn tên miền admin.thienhoangky.fun)
```

Trước khi có tài khoản, trang chỉ hiện màn đăng nhập, và mọi API dữ liệu trả 401.

## Đã chọn và vì sao

- **Hai lớp, Access ngoài rồi mật khẩu trong:** người dùng chốt ngày 2026-11-05 ("tên đăng nhập admin", rồi "Giữ Access"). Access chặn người lạ ngay ở biên. Mật khẩu tách vai trò Admin và Vận hành, và cho phép khóa từng tài khoản ngay lập tức.
- **PBKDF2 30.000 vòng, không phải 100.000:**
  - gói Workers Free cho 10 ms CPU mỗi yêu cầu;
  - đo trên máy dev, 30.000 vòng mất khoảng 5 ms, còn 100.000 vòng mất khoảng 16 ms;
  - số vòng nằm trong chuỗi băm của từng tài khoản. Lên gói trả phí thì nâng `VONG` trong `worker/matKhau.ts` (trần của workerd là 100.000); mật khẩu cũ được băm lại ở lần đăng nhập đúng kế tiếp.
- **Tài khoản đầu tạo bằng script, không nằm trong migration:** repo công khai, nên không đưa mật khẩu, kể cả bản băm, vào git.
- **Worker riêng `thienhoangky-admin`, không gộp vào Worker game.** Hai bên deploy không giẫm nhau, và Worker game không mang mã quản trị.
- **Bảng `qt_*` có migration riêng** (`migrations_table: d1_migrations_qt`): mỗi bên tự chạy migration của mình trên cùng D1.
- **Tạo, sửa, tắt link và khóa người chơi chỉ Admin làm.** Mấy việc này đổi ai được vào game. Vận hành vẫn xem, chép link và ghi chú được.
- **Mã link do server sinh** (12 ký tự, bỏ các chữ dễ nhầm), không cho tự đặt, để link khó đoán.
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

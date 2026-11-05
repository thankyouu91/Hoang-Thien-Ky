# API bản chơi thử — thienhoangky.fun

Hợp đồng giữa game (`proto/`), Worker game (`cloudflare/`) và Admin Dashboard (`admin/`). Bản chơi thử Cửa 1 (open test beta) chỉ vào được bằng link mời.

## Tổng quan

| Hostname | Worker | Cách vào | Nội dung |
|---|---|---|---|
| `thienhoangky.fun` | `thienhoangky` (`cloudflare/wrangler.jsonc`) | Link mời `https://thienhoangky.fun/moi/<ma>` cấp cookie | Bản build `proto/dist`, `/api/*` bên dưới |
| `admin.thienhoangky.fun` | `thienhoangky-admin` (`admin/wrangler.jsonc`) | Cloudflare Access, mã một lần gửi qua email | Admin Dashboard, `/api/*` của admin (`admin/shared/hopDong.ts`) |
| `www.thienhoangky.fun` | `thienhoangky-www` (`cloudflare/wrangler.www.jsonc`) | — | 301 về `https://thienhoangky.fun` |

- Ba Worker đều tắt `*.workers.dev` và URL xem trước, nên chỉ vào được qua tên miền.
- Hai Worker game và admin dùng chung D1 `thienhoangky` (id `aa2c1b16-661a-4df8-94a3-37ee20cc0f5e`, vùng APAC).
- Bảng game nằm trong `cloudflare/migrations/`. Bảng quản trị `qt_*` nằm trong `admin/migrations/`, theo dõi bằng bảng `d1_migrations_qt`.
- Team Access: `https://jolly-water-a8bd.cloudflareaccess.com`. Chỉ dùng cho admin, vì gói Zero Trust Free giới hạn 50 người đăng nhập.

## Link mời và cookie

1. Người chơi mở `https://thienhoangky.fun/moi/<ma>`. Mã gồm 6–40 ký tự `[a-z0-9-]`, không phân biệt hoa thường.
2. Worker kiểm dòng `loi_moi`: chưa tắt (`tat = 0`), chưa hết hạn (`het_han`), còn lượt (`da_dung < toi_da`). Nếu hợp lệ, Worker:
   - tăng `da_dung`;
   - tạo một dòng `nguoi_choi_thu` (mã `id` 10 ký tự);
   - đặt cookie `thk_moi` (thẻ ngẫu nhiên 256 bit, `HttpOnly; Secure; SameSite=Lax; Max-Age=180 ngày`);
   - chuyển 302 về `/`.
   Link không hợp lệ thì trả trang báo, mã 410.
3. Trình duyệt đã có cookie hợp lệ mà mở lại link thì về thẳng `/`, không tốn lượt. Người đã bị khoá mở lại link thì vẫn thấy trang "bị khóa".
4. Mọi trang HTML và `/api/*` đều cần cookie hợp lệ. Thiếu cookie: trang HTML trả 403 kèm trang "cần link mời", còn API trả 401 `chua_co_loi_moi`. Bị khoá (`nguoi_choi_thu.khoa = 1`): trang HTML trả 403 kèm trang báo, còn API trả 403 `bi_khoa`.
5. `/assets/*` (JS, CSS, font có mã băm), `/pixellab/*` và `/icon_ve/*` được phục vụ thẳng, không qua Worker, để khỏi tốn lượt request của gói free. Tên file JS chỉ biết được qua HTML, mà HTML đã bị chặn.
6. D1 chỉ lưu SHA-256 của thẻ (`the_hash`). Lộ bảng cũng không giả được cookie.

Trình duyệt tự gửi cookie, nên game chỉ cần gọi `fetch("/api/...")` cùng tên miền. Cookie gắn với một trình duyệt: mở link trong Zalo hay Facebook (trình duyệt trong app) rồi chuyển sang Chrome thì phải mở link lại, và lần đó tốn thêm một lượt. Tiến độ game cũng nằm theo từng trình duyệt.

**Ghi:** mọi `POST` phải có `Content-Type: application/json`, và nếu có header `Origin` thì nó phải trùng tên miền. Hai điều kiện này chặn trang khác gửi thay (CSRF).

**Lỗi:** body luôn là JSON `{ "loi": "<mã>", "thong_diep"?: "<câu tiếng Việt>" }`.

| HTTP | `loi` | Khi nào |
|---|---|---|
| 400 | `sai_kieu`, `thieu_truong`, `qua_dai`, `qua_ngan`, `ma_sai`, `loai_sai`, `json_sai` | Dữ liệu sai |
| 401 | `chua_co_loi_moi` | Chưa có cookie link mời, hoặc cookie sai |
| 403 | `bi_khoa` | Admin đã khoá người chơi này |
| 403 | `sai_nguon_goi` | `Origin` khác tên miền |
| 404 / 405 | `khong_co` / `sai_phuong_thuc` | Đường dẫn hoặc phương thức không có |
| 413 | `qua_lon`, `qua_nhieu` | Body quá lớn, hoặc quá 50 sự kiện trong một lần gửi |
| 415 | `can_json` | Ghi mà không gửi JSON |
| 429 | `qua_nhieu` | Quá 30 phản hồi trong 24 giờ |

Mọi phản hồi API có `Cache-Control: no-store`.

## API game (`https://thienhoangky.fun`)

### `GET /api/toi`

Dùng để kiểm đã nối được với server chưa. Mỗi lần gọi cập nhật `lan_cuoi`.

```json
{ "nguoi_choi": "acpc3p7xgt" }
```

### `POST /api/su-kien`

Gửi một lô sự kiện ẩn danh (GDD mục 19). Một lô có tối đa 50 sự kiện, body tối đa 64 KB.

```json
{
  "an_danh": "4f1c…",                 // mã ngẫu nhiên của trình duyệt (localStorage ktlp.an_danh), 8–64 ký tự [A-Za-z0-9_-]
  "phien": "9b2e…",                   // mã ngẫu nhiên của phiên, cùng dạng
  "phien_ban": "1e20bcd",             // tùy chọn, ≤ 40 ký tự: mã commit của bản build
  "su_kien": [
    { "loai": "mo_phien", "luc": 1793851628398, "du_lieu": { "man": "dong-phu" } },
    { "loai": "ftue_buoc", "luc": 1793851630000, "du_lieu": { "buoc": 1 } }
  ]
}
```

- `loai` khớp `^[a-z][a-z0-9_]{1,47}$`. Dùng tên trong bảng dưới. Tên lạ vẫn được nhận, nhưng Admin hiện mã thô.
- `luc` là mili giây theo giờ máy. Bỏ trống thì server lấy giờ của nó. Sự kiện lệch hơn 7 ngày về trước hoặc 1 ngày về sau bị bỏ.
- `du_lieu` là object JSON, tối đa 2 KB sau khi chuyển thành chuỗi.
- Trả **202** `{ "nhan": 2, "bo": 0 }`. Sự kiện sai bị bỏ riêng, đếm vào `bo`; các sự kiện còn lại vẫn được ghi.
- Bảng `su_kien` không lưu mã người chơi. Không gửi số điện thoại, ngày sinh, tên hay email trong `du_lieu`.

**Danh mục sự kiện** (nhãn hiện trong Admin lấy từ `LOAI_SU_KIEN` ở `admin/shared/hopDong.ts`):

| `loai` | Ai gửi | `du_lieu` |
|---|---|---|
| `mo_phien` | `server.ts` tự gửi khi vào game, hoặc khi quay lại sau hơn 30 phút ẩn trang | `man`, `quay_lai?` |
| `dong_phien` | `server.ts` tự gửi khi ẩn hoặc đóng trang | `giay` (độ dài phiên) |
| `ftue_buoc` | `server.ts` gửi bước 1 khi xong đăng nhập; bước 2–8 chưa gắn | `buoc` 1–8 theo `BUOC_FTUE`: Đăng nhập, Chọn vùng bắt đầu, Nhận tài năng/tạo hình, Gia nhập tông môn, Ghép công pháp đầu, Trận PvE đầu, Chiếm và thu mỏ, Nhắc giờ bí cảnh |
| `cham_the` | `server.ts` tự gửi khi chạm phần tử có `data-act` hoặc nút thanh dưới; hai lần chạm cách nhau ít nhất 300 ms | `the` (giá trị `data-act` hoặc `tab:<màn>`), `man` |
| `phan_hoi` | `server.ts` gửi sau khi gửi phản hồi thành công | `loai` |
| `vung_bat_dau` | chưa gắn | `vung` |
| `tai_nang` | chưa gắn | `tai_nang` |
| `chiem_diem` | chưa gắn | `loai_diem`, `so_chang` |
| `chiem_mo`, `mat_mo` | chưa gắn | `mo`, `loai_mo` |
| `bi_canh` | chưa gắn | `bi_canh`, `ket_qua` |
| `tan_quyen_roi` | chưa gắn | `he`, `pham` |
| `ghep_cong_phap` | chưa gắn | `to_hop`, `pham` |
| `tran_dau` | chưa gắn | `he`, `loai_chieu`, `ket_qua` |
| `tuyen_chien`, `phan_boi`, `giao_dich_cho`, `mua_hang` | chưa có ở Cửa 1 | |

"Chưa gắn" nghĩa là màn hoặc mock source xử lý thao tác đó cần gọi thêm `ghi("<loai>", {...})` (hàm trong `proto/src/dashboard/server.ts`).

### `POST /api/phan-hoi`

```json
{ "loai": "loi", "noi_dung": "Nút Nhận mã bị bàn phím che", "man": "dang-nhap", "lien_he": "zalo 09xx", "phien_ban": "1e20bcd" }
```

- `loai`: `loi`, `gop_y` (mặc định) hoặc `khac`.
- `noi_dung`: 3–2000 ký tự.
- `man`: tối đa 60 ký tự.
- `lien_he`: cách liên lạc người chơi tự để lại, tối đa 120 ký tự, có thể bỏ trống.
- Body tối đa 8 KB.
- Server lưu kèm mã người chơi thử, User-Agent rút gọn và giờ server. Không lưu IP.
- Trả **201** `{ "id": 12 }`. Mỗi người chơi gửi tối đa 30 phản hồi trong 24 giờ.

### `GET /api/thong-bao`

Trả tối đa 20 thông báo đang hiện. Thông báo `quan_trong` đứng trước, sau đó xếp theo giờ bắt đầu, mới nhất trước. Nguồn là bảng `qt_thong_bao`, lấy dòng có `trang_thai = 'dang'` và giờ hiện tại nằm trong khoảng `[bat_dau, ket_thuc)`.

```json
{ "thong_bao": [ { "id": 1, "tieu_de": "Chào đạo hữu", "noi_dung": "…", "muc": "quan_trong", "bat_dau": 1793851628398, "ket_thuc": null } ], "luc": 1793851628398 }
```

### `GET /api/cau-hinh`

Trả cấu hình sống. Giá trị mặc định lấy từ `THAM_SO` (`admin/worker/cauHinh.ts`), sau đó mọi dòng trong `qt_cau_hinh` đè lên, kể cả khoá mới admin thêm sau.

```json
{ "cau_hinh": { "toc_do_kinh_te": 1, "he_so_tua": 1, "he_so_kinh_nghiem": 1, "he_so_roi": 1, "nhac_nghi_phut": 60, "bao_tri": false, "loi_bao_tri": "…" }, "luc": 1793851628398 }
```

## Phía game: `proto/src/dashboard/server.ts`

| Hàm | Việc |
|---|---|
| `startTelemetry(auth)` | Đã gắn sẵn trong `index.ts`. Tự ghi `mo_phien`, `dong_phien`, `ftue_buoc` 1 và `cham_the`. Gom gửi 20 giây một lần; khi ẩn hoặc đóng trang thì gửi nốt bằng `sendBeacon`. |
| `ghi(loai, du_lieu?)` | Thêm một sự kiện vào hàng chờ. |
| `guiPhanHoi(loai, noi_dung, man?, lien_he?)` | Gửi phản hồi. Không bao giờ throw: lỗi trả về `{ ok: false, loi }` với `loi` là câu tiếng Việt, hiện thẳng lên màn được. |
| `layThongBao()`, `layCauHinh()` | Đọc thông báo và cấu hình. Khi không có API (chạy `npm run dev`) thì trả `[]` và `null`. |
| `trangThaiMayChu()`, `theoDoiTrangThai(f)` | Trạng thái nối server: `dang_noi`, `co`, `khong_co` hoặc `bi_khoa`. |

## Dữ liệu (D1 `thienhoangky`)

Bảng game nằm trong `cloudflare/migrations/`. Thời gian lưu bằng mili giây UTC; khi gom theo ngày thì đổi sang giờ Việt Nam (UTC+7).

| Bảng | Cột | Ai ghi |
|---|---|---|
| `loi_moi` | `ma` PK, `ten`, `toi_da` (NULL = không giới hạn), `da_dung`, `het_han` (ms, NULL = không hết hạn), `tat` 0\|1, `tao_boi`, `tao_luc`, `sua_boi`, `sua_luc` | Admin tạo, sửa, tắt. Game chỉ tăng `da_dung`. |
| `nguoi_choi_thu` | `id` PK (10 ký tự), `the_hash` (không hiện ra ngoài), `ma_moi`, `lan_dau`, `lan_cuoi`, `so_phien`, `khoa` 0\|1, `ly_do_khoa`, `sua_boi`, `sua_luc` | Game tạo và cập nhật `lan_cuoi`, `so_phien`. Admin chỉ ghi `khoa`, `ly_do_khoa`, `sua_*`. |
| `su_kien` | `id`, `loai`, `an_danh`, `phien`, `luc`, `nhan_luc`, `du_lieu` (JSON), `phien_ban` | Game. Không có mã người chơi; retention và FTUE tính theo `an_danh` (theo máy). |
| `phan_hoi` | `id`, `nguoi_choi` (= `nguoi_choi_thu.id`), `loai`, `noi_dung`, `man`, `lien_he`, `thiet_bi`, `phien_ban`, `luc` | Game. Trạng thái xử lý nằm ở `qt_phan_hoi_xu_ly`, với `phan_hoi_id = CAST(id AS TEXT)`. |

Bảng `qt_*` (`admin/migrations/`) giữ vai trò, nhật ký, cấu hình, thông báo, xử lý phản hồi. Worker game chỉ đọc `qt_thong_bao` và `qt_cau_hinh`; nếu chưa có hai bảng này thì dùng mặc định, không lỗi.

**Dữ liệu cá nhân:** người chơi thử không để lại email. Server chỉ có mã ngẫu nhiên, sự kiện ẩn danh, và phản hồi (kèm `lien_he` nếu người chơi tự ghi). Số điện thoại, ngày sinh, người giám hộ ở màn OTP thử chỉ nằm trong trình duyệt. Email chỉ có ở phía admin (Access). D1 đặt ở APAC; theo GDD mục 16 và 18, từ MVP dữ liệu người chơi thật phải lưu tại Việt Nam.

## Đổi hợp đồng

- Muốn thêm cột hoặc bảng game: nhắn tab deploy để thêm một migration mới vào `cloudflare/migrations/`. Không sửa migration đã chạy.
- Muốn thêm sự kiện: thêm vào bảng trên và vào `LOAI_SU_KIEN`. Worker không cần deploy lại.

# API bản chơi thử — thienhoangky.fun

Hợp đồng giữa game (`proto/`), Worker game (`cloudflare/`) và Admin Dashboard (`admin/`). Bản chơi thử Cửa 1, chỉ người được mời mới vào được.

## Tổng quan

| Hostname | Worker | Ứng dụng Access | Nội dung |
|---|---|---|---|
| `thienhoangky.fun` | `thienhoangky` (`cloudflare/wrangler.jsonc`) | Thiên Hoang Ký – chơi thử | Bản build `proto/dist` và `/api/*` dưới đây |
| `admin.thienhoangky.fun` | `thienhoangky-admin` (`admin/wrangler.jsonc`) | Thiên Hoang Ký – quản trị | Admin Dashboard và `/api/*` của admin (hợp đồng ở `admin/shared/hopDong.ts`) |
| `www.thienhoangky.fun` | `thienhoangky-www` (`cloudflare/wrangler.www.jsonc`) | không cần | 301 về `https://thienhoangky.fun` |

- Cả ba Worker tắt `*.workers.dev` và URL xem trước. Chỉ vào được qua tên miền, và tên miền nằm sau Access.
- Cả hai Worker dùng chung D1 `thienhoangky` (id `aa2c1b16-661a-4df8-94a3-37ee20cc0f5e`, vùng APAC).
- Bảng game: `cloudflare/migrations/`. Bảng quản trị `qt_*`: `admin/migrations/`, theo dõi bằng bảng `d1_migrations_qt`.

## Xác thực

Mọi request tới `/api/*` phải đi qua Cloudflare Access. Access gắn JWT vào header `Cf-Access-Jwt-Assertion`, và Worker kiểm token đó (`cloudflare/src/access.ts`):

- Chữ ký RS256, kiểm bằng khoá công khai của team: `https://<team>.cloudflareaccess.com/cdn-cgi/access/certs`.
- `iss` phải là team domain (biến `ACCESS_TEAM_DOMAIN`).
- `aud` phải là AUD tag của ứng dụng Access gắn với hostname đó (biến `ACCESS_AUD`). Token của ứng dụng admin không dùng được ở game, và ngược lại.
- Token phải còn hạn và có `email`. Service token không có email nên bị từ chối.
- Không tin header `Cf-Access-Authenticated-User-Email`, vì header này không có chữ ký.
- Chưa đặt `ACCESS_TEAM_DOMAIN` hoặc `ACCESS_AUD` thì mọi API trả 503 `chua_cau_hinh`: thiếu cấu hình thì đóng, không mở.
- Email bị khoá ở Admin (`qt_nguoi_choi.khoa = 1`) nhận 403 `bi_khoa` ở mọi API game. Muốn chặn cả phần tải game thì phải gỡ email đó khỏi Access.

Trình duyệt tự gửi cookie `CF_Authorization` cùng tên miền, nên game chỉ cần `fetch("/api/...")`, không phải tự gắn token.

**Ghi:** `POST` phải có `Content-Type: application/json`. Nếu có header `Origin` thì nó phải trùng tên miền, để chặn trang khác gửi thay (CSRF).

**Lỗi:** body luôn là JSON `{ "loi": "<mã>", "thong_diep"?: "<câu tiếng Việt>" }`.

| HTTP | `loi` | Khi nào |
|---|---|---|
| 400 | `sai_kieu`, `thieu_truong`, `qua_dai`, `qua_ngan`, `ma_sai`, `loai_sai`, `json_sai` | Dữ liệu sai |
| 401 | `thieu_token`, `token_sai` | Không qua Access, hoặc token sai, hết hạn, sai aud |
| 403 | `bi_khoa` | Admin đã khoá email này |
| 403 | `sai_nguon_goi` | `Origin` khác tên miền |
| 404 / 405 | `khong_co` / `sai_phuong_thuc` | |
| 413 | `qua_lon`, `qua_nhieu` | Body quá lớn, hoặc quá 50 sự kiện một lần |
| 415 | `can_json` | Ghi mà không phải JSON |
| 429 | `qua_nhieu` | Quá 30 phản hồi trong 24 giờ |
| 503 | `chua_cau_hinh` | Worker chưa có biến Access |

Mọi phản hồi API có `Cache-Control: no-store`.

## API game (`https://thienhoangky.fun`)

### `GET /api/toi`

Kiểm xem đã nối được chưa. Gọi lần đầu thì ghi email vào `nguoi_choi_thu`.

```json
{ "email": "nguoi.choi@example.com" }
```

### `POST /api/su-kien`

Gửi một lô sự kiện ẩn danh (GDD mục 19). Một lô có tối đa 50 sự kiện và body tối đa 64 KB.

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

- `loai`: `^[a-z][a-z0-9_]{1,47}$`. Dùng tên trong bảng dưới. Tên lạ vẫn được nhận, nhưng Admin chỉ hiện mã thô, không có nhãn.
- `luc`: mili giây theo giờ máy người chơi. Bỏ trống thì lấy giờ server. Lệch hơn 7 ngày về trước hoặc 1 ngày về sau thì sự kiện bị bỏ.
- `du_lieu`: object JSON, tối đa 2 KB sau khi chuyển thành chuỗi.
- Trả **202** `{ "nhan": 2, "bo": 0 }`. Sự kiện sai bị bỏ riêng và đếm vào `bo`, các sự kiện còn lại trong lô vẫn được ghi.
- Không gửi số điện thoại, ngày sinh, tên hay email trong `du_lieu`.

**Danh mục sự kiện** (nhãn hiện trong Admin: `LOAI_SU_KIEN` ở `admin/shared/hopDong.ts`):

| `loai` | Ai gửi | `du_lieu` |
|---|---|---|
| `mo_phien` | `server.ts` tự gửi khi vào game, hoặc khi quay lại sau hơn 30 phút ẩn trang | `man`, `quay_lai?` |
| `dong_phien` | `server.ts` tự gửi khi ẩn hoặc đóng trang | `giay` (độ dài phiên) |
| `ftue_buoc` | `server.ts` gửi bước 1 khi xong đăng nhập. Bước 2–8 chưa gắn | `buoc` 1–8, theo `BUOC_FTUE`: 1 Đăng nhập, 2 Chọn vùng bắt đầu, 3 Nhận tài năng/tạo hình, 4 Gia nhập tông môn, 5 Ghép công pháp đầu, 6 Trận PvE đầu, 7 Chiếm và thu mỏ, 8 Nhắc giờ bí cảnh |
| `cham_the` | `server.ts` tự gửi khi chạm phần tử có `data-act` hoặc nút thanh dưới, mỗi lần cách nhau ít nhất 300 ms | `the` (giá trị `data-act` hoặc `tab:<màn>`), `man` |
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

"Chưa gắn" là chỗ còn trống: màn hoặc mock source nào xử lý thao tác đó thì gọi `ghi("<loai>", {...})` trong `proto/src/dashboard/server.ts`.

### `POST /api/phan-hoi`

```json
{ "loai": "loi", "noi_dung": "Nút Nhận mã bị bàn phím che", "man": "dang-nhap", "phien_ban": "1e20bcd" }
```

- `loai`: `loi`, `gop_y` (mặc định) hoặc `khac`. `noi_dung`: 3–2000 ký tự. `man`: tối đa 60 ký tự. Body tối đa 8 KB.
- Server lưu kèm email (lấy từ Access), User-Agent rút gọn và giờ server. Không lưu IP.
- Trả **201** `{ "id": 12 }`. Mỗi email gửi tối đa 30 phản hồi trong 24 giờ.

### `GET /api/thong-bao`

Thông báo đang hiện, tối đa 20 cái. Thông báo `quan_trong` đứng trước, sau đó xếp theo giờ bắt đầu, mới trước. Admin đăng thông báo ở `qt_thong_bao`.

```json
{ "thong_bao": [ { "id": 1, "tieu_de": "Chào đạo hữu", "noi_dung": "…", "muc": "quan_trong", "bat_dau": 1793851628398, "ket_thuc": null } ], "luc": 1793851628398 }
```

### `GET /api/cau-hinh`

Cấu hình sống. Giá trị mặc định nằm trong `THAM_SO` (`admin/worker/cauHinh.ts`); dòng trong `qt_cau_hinh` đè lên mặc định. Khoá không có trong `THAM_SO` thì không trả.

```json
{ "cau_hinh": { "toc_do_kinh_te": 1, "he_so_tua": 1, "he_so_kinh_nghiem": 1, "he_so_roi": 1, "nhac_nghi_phut": 60, "bao_tri": false, "loi_bao_tri": "…" }, "luc": 1793851628398 }
```

## Phía game: `proto/src/dashboard/server.ts`

| Hàm | Việc |
|---|---|
| `startTelemetry(auth)` | Gọi một lần trong `index.ts` (đã gắn). Tự ghi `mo_phien`, `dong_phien`, `ftue_buoc` 1 và `cham_the`. Gửi gom 20 giây một lần; khi ẩn hoặc đóng trang thì gửi nốt bằng `sendBeacon`. |
| `ghi(loai, du_lieu?)` | Thêm một sự kiện vào hàng chờ gửi. |
| `guiPhanHoi(loai, noi_dung, man?)` | Gửi phản hồi. Nếu lỗi thì trả câu tiếng Việt để hiện thẳng lên màn. |
| `layThongBao()`, `layCauHinh()` | Đọc thông báo và cấu hình. Không có API (đang chạy `npm run dev`) thì trả `[]` và `null`. |
| `trangThaiMayChu()`, `theoDoiTrangThai(f)` | Trạng thái nối máy chủ: `dang_noi`, `co`, `khong_co` hoặc `bi_khoa`. |

Khi chạy `npm run dev` (Vite), `/api/toi` không trả JSON, nên module tự tắt và không gửi gì.

## Dữ liệu (D1 `thienhoangky`)

Bảng game (`cloudflare/migrations/0001_khoi_tao.sql`). Thời gian là mili giây UTC; khi gom theo ngày thì lấy ngày theo giờ Việt Nam (UTC+7).

| Bảng | Cột | Ghi chú |
|---|---|---|
| `nguoi_choi_thu` | `email` PK, `lan_dau`, `lan_cuoi`, `so_phien` | Bảng duy nhất nối email với hoạt động. `so_phien` cộng thêm khi nhận `mo_phien`. |
| `su_kien` | `id`, `loai`, `an_danh`, `phien`, `luc`, `nhan_luc`, `du_lieu` (JSON), `phien_ban` | Không có email. Tính retention và FTUE theo `an_danh` (theo máy). |
| `phan_hoi` | `id`, `email`, `loai`, `noi_dung`, `man`, `thiet_bi`, `phien_ban`, `luc` | Trạng thái xử lý ở `qt_phan_hoi_xu_ly`, với `phan_hoi_id = CAST(id AS TEXT)`. |

Bảng `qt_*` (`admin/migrations/`) gồm vai trò, nhật ký, cấu hình, thông báo, người chơi được mời (có cờ khoá), xử lý phản hồi và đồng bộ Access. Worker game chỉ đọc ba bảng: `qt_nguoi_choi.khoa`, `qt_thong_bao` (`trang_thai='dang'`, đang trong khoảng `[bat_dau, ket_thuc)`) và `qt_cau_hinh`. Nếu các bảng `qt_*` chưa được tạo thì Worker game dùng mặc định, không báo lỗi.

**Dữ liệu cá nhân:** bản chơi thử chỉ lưu email người chơi thử (do Access cấp), sự kiện ẩn danh và phản hồi. Số điện thoại, ngày sinh và người giám hộ ở màn OTP thử chỉ nằm trong trình duyệt. D1 đặt ở vùng APAC của Cloudflare, chưa đặt tại Việt Nam. Theo GDD mục 16 và 18, dữ liệu người chơi thật từ MVP phải lưu trên máy chủ đặt tại Việt Nam, nên D1 này chỉ dùng cho đợt chơi thử.

## Đổi hợp đồng

- Muốn thêm cột hoặc bảng game: nhắn tab deploy để thêm một file migration mới trong `cloudflare/migrations/`. Không sửa file migration đã chạy.
- Muốn thêm sự kiện: thêm tên vào bảng trên và vào `LOAI_SU_KIEN`. Worker không cần deploy lại.

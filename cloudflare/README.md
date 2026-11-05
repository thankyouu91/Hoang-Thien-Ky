# cloudflare/ — bản chơi thử trên thienhoangky.fun

Có hai Worker và một D1. Admin Dashboard (`admin.thienhoangky.fun`) là Worker riêng ở `admin/`. Hợp đồng API nằm ở `docs/api.md`.

| File | Việc |
|---|---|
| `wrangler.jsonc` | Worker `thienhoangky`: phục vụ `proto/dist` dưới dạng static assets (SPA) và `/api/*`, gắn tên miền `thienhoangky.fun` |
| `wrangler.www.jsonc` | Worker `thienhoangky-www`: chuyển `www.thienhoangky.fun` về tên miền gốc bằng mã 301 |
| `src/access.ts` | Xác minh JWT của Cloudflare Access: chữ ký theo bộ khoá của team, `iss`, `aud`, hạn dùng, email |
| `src/game.ts`, `src/kiem.ts`, `src/http.ts` | Các API game |
| `migrations/` | Bảng game trong D1 `thienhoangky`. Bảng `qt_*` nằm ở `admin/migrations/` |
| `scripts/chuan-bi.mjs` | Lệnh build mà wrangler tự chạy trước khi deploy: build `proto/dist`, chép `_headers`, kiểm số file và dung lượng |
| `_headers` | Header cache và header bảo mật cho asset |

## Chạy thử ở máy

```
cd cloudflare
npm.cmd install
echo DEV_EMAIL=ban@local.test> .dev.vars
npm.cmd run db:migrate:local
npm.cmd run dev            # http://127.0.0.1:8787, có /api/* với email giả ở trên
npm.cmd test               # test xác minh JWT và kiểm dữ liệu
```

`DEV_EMAIL` chỉ có tác dụng khi request vào `localhost` hoặc `127.0.0.1`. Script `dev` đã gắn sẵn `--local-upstream localhost:8787` cho việc đó. Trên tên miền thật, biến này bị bỏ qua.

## Deploy

Build phải chạy từ mã đã commit. Thư mục repo dùng chung còn file các phiên khác đang sửa dở, nên dùng một worktree riêng:

```
git worktree add --detach ..\KhaiTongLapPhai-deploy HEAD     # lần đầu
cd ..\KhaiTongLapPhai-deploy
git checkout --detach <commit cần đưa lên>                   # các lần sau
npm.cmd ci
cd cloudflare
npm.cmd ci
npx.cmd wrangler deploy                                       # tự build proto, kiểm giới hạn, rồi đẩy
npx.cmd wrangler deploy -c wrangler.www.jsonc                 # chỉ cần khi sửa Worker www
npx.cmd wrangler d1 migrations apply thienhoangky --remote    # khi có migration mới
```

Thứ tự an toàn khi dựng lần đầu: tạo ứng dụng Access cho hostname trước, điền `ACCESS_TEAM_DOMAIN` và `ACCESS_AUD` vào `wrangler.jsonc`, rồi mới deploy. Lúc deploy, wrangler gắn tên miền và Cloudflare cấp chứng chỉ; mất khoảng một tới vài phút. Nếu gắn tên miền trước khi có Access, asset sẽ mở công khai trong khoảng thời gian đó.

Không có đường nào vào game mà tránh được Access:

- `workers_dev: false` và `preview_urls: false`, nên không có địa chỉ `*.workers.dev` hay URL xem trước.
- Asset do Cloudflare phục vụ thẳng, nhưng vẫn nằm sau ứng dụng Access của hostname.
- `/api/*` kiểm lại JWT. Thiếu cấu hình Access thì trả 503.

## Cloudflare Access

Team: xem `ACCESS_TEAM_DOMAIN` trong `wrangler.jsonc`. Đăng nhập bằng mã một lần gửi qua email (One-time PIN).

| Ứng dụng | Hostname | Ai được vào | Biến |
|---|---|---|---|
| Thiên Hoang Ký – chơi thử | `thienhoangky.fun` | Người chơi thử, admin, vận hành | `ACCESS_AUD` trong `wrangler.jsonc` |
| Thiên Hoang Ký – quản trị | `admin.thienhoangky.fun` | Admin, vận hành | `ACCESS_AUD` trong `admin/wrangler.jsonc` |

**Mời thêm người chơi thử:** vào Zero Trust → Access controls → Applications → Thiên Hoang Ký – chơi thử → Policies → sửa policy "Người chơi thử" → thêm email vào Include → Emails → Save. Người được mời mở https://thienhoangky.fun, nhập email, rồi nhập mã 6 số Cloudflare gửi về hộp thư. Mã đến từ `noreply@notify.cloudflare.com`; nếu không thấy, xem trong thư mục spam.

**Gỡ người chơi thử:** xoá email khỏi policy. Phiên đăng nhập Access đang mở vẫn còn tới hết hạn (24 giờ). Muốn gỡ ngay thì vào Zero Trust → Team & Resources → Users → chọn người đó → Revoke session. Khoá ở Admin Dashboard thì chỉ chặn API, người đó vẫn tải được game.

## Giới hạn và chi phí (gói miễn phí)

- Static assets: tối đa 20.000 file mỗi phiên bản Worker và 25 MiB mỗi file. `proto/dist` hiện có khoảng 1.400 file, tổng 59 MB, file lớn nhất 766 KB. `scripts/chuan-bi.mjs` sẽ báo lỗi nếu vượt giới hạn.
- Worker: 100.000 request mỗi ngày. Chỉ request tới `/api/*` mới tính; asset không chạy Worker nên không tính.
- D1 free: 5 GB, 5 triệu lượt đọc và 100.000 lượt ghi mỗi ngày. Mỗi lô sự kiện (tối đa 50 sự kiện) tốn số lượt ghi bằng số sự kiện cộng 1.
- Zero Trust Free: tối đa 50 người dùng, tính theo số email đã đăng nhập Access trong kỳ.

# cloudflare/ — bản chơi thử trên thienhoangky.fun

Thư mục này có hai Worker và một D1. Admin Dashboard ở `admin.thienhoangky.fun` là Worker riêng, mã ở `admin/`. Hợp đồng API nằm trong `docs/api.md`.

| File | Việc |
|---|---|
| `wrangler.jsonc` | Worker `thienhoangky`: cổng link mời, phục vụ `proto/dist` (static assets, SPA) và `/api/*`, gắn tên miền `thienhoangky.fun` |
| `wrangler.www.jsonc` | Worker `thienhoangky-www`: chuyển `www.thienhoangky.fun` về tên miền gốc (301) |
| `src/game.ts` | Worker game: `/moi/<ma>`, chặn HTML và API khi không có cookie hợp lệ, các API |
| `src/moi.ts` | Thẻ cookie `thk_moi`, băm SHA-256, đọc cookie, kiểm mã link |
| `src/trang.ts` | Các trang báo ngắn: cần link mời, link hỏng, bị khóa |
| `src/kiem.ts`, `src/http.ts` | Kiểm dữ liệu đầu vào, hàm trả JSON, chặn ghi từ trang khác (CSRF) |
| `migrations/` | Bảng game trong D1 `thienhoangky`. Bảng `qt_*` nằm ở `admin/migrations/` |
| `scripts/chuan-bi.mjs` | Lệnh build wrangler tự chạy trước khi deploy: build `proto/dist`, chép `_headers`, kiểm số file và dung lượng |
| `_headers` | Header cache và header bảo mật cho asset |

## Chạy thử ở máy

```
cd cloudflare
npm.cmd install
npm.cmd run db:migrate:local
npx.cmd wrangler d1 execute thienhoangky --local --command "INSERT INTO loi_moi (ma, ten, tao_boi, tao_luc) VALUES ('thu-local-1', 'thử ở máy', 'dev', 0)"
npm.cmd run dev            # mở http://127.0.0.1:8787/moi/thu-local-1
npm.cmd test
```

## Deploy

Phải build từ mã đã commit. Thư mục repo dùng chung thường có file của phiên khác đang sửa dở, nên dùng worktree riêng:

```
git worktree add --detach ..\KhaiTongLapPhai-deploy HEAD     # lần đầu
cd ..\KhaiTongLapPhai-deploy
git checkout --detach <commit cần đưa lên>                   # các lần sau
npm.cmd ci
cd cloudflare
npm.cmd ci
npx.cmd wrangler d1 migrations apply thienhoangky --remote    # khi có migration mới
npx.cmd wrangler deploy                                       # tự build proto, kiểm giới hạn, rồi đẩy lên
npx.cmd wrangler deploy -c wrangler.www.jsonc                 # chỉ khi sửa Worker www
```

Cổng link mời nằm trong Worker, nên khi wrangler gắn tên miền ở lần deploy đầu, cổng đã chạy ngay. Không có đường nào vào game mà tránh được cổng:

- `workers_dev` và `preview_urls` đều tắt, nên không có địa chỉ `*.workers.dev` hay URL xem trước.
- Mọi đường dẫn đều chạy Worker trước (`run_worker_first`), trừ `/assets/*`, `/pixellab/*`, `/icon_ve/*`. Ba thư mục này là file JS có mã băm trong tên và hình, được phục vụ thẳng, không tốn lượt request.

## Link mời

Tạo và quản lý link ở Admin Dashboard. Khi chưa có Admin Dashboard thì tạo bằng lệnh. Không ghi mã thật vào repo, vì repo là public.

```
npx.cmd wrangler d1 execute thienhoangky --remote --command "INSERT INTO loi_moi (ma, ten, toi_da, het_han, tao_boi, tao_luc) VALUES ('<mã ngẫu nhiên>', 'Đợt 1', 50, NULL, 'tab deploy', <Date.now()>)"
npx.cmd wrangler d1 execute thienhoangky --remote --command "SELECT ma, ten, toi_da, da_dung, het_han, tat FROM loi_moi"
npx.cmd wrangler d1 execute thienhoangky --remote --command "UPDATE loi_moi SET tat = 1 WHERE ma = '<mã>'"
npx.cmd wrangler d1 execute thienhoangky --remote --command "UPDATE nguoi_choi_thu SET khoa = 1, ly_do_khoa = '<lý do>' WHERE id = '<id>'"
```

- Link có dạng `https://thienhoangky.fun/moi/<mã>`. Mỗi trình duyệt mở link lần đầu tốn một lượt. Đặt `toi_da` để giới hạn số người khi link bị chuyển tiếp.
- Tắt link (`tat = 1`) chỉ chặn người mới. Người đã vào vẫn chơi tiếp; muốn chặn ai thì khoá đúng người đó.

## Admin: Cloudflare Access

Team: `https://jolly-water-a8bd.cloudflareaccess.com`. Chỉ ứng dụng "Thiên Hoang Ký – quản trị" (`admin.thienhoangky.fun`) dùng Access, đăng nhập bằng mã một lần gửi qua email. Người chơi không dùng Access, vì gói Zero Trust Free chỉ cho 50 người đăng nhập.

## Giới hạn của gói miễn phí

- **Static assets:** tối đa 20.000 file mỗi phiên bản, mỗi file tối đa 25 MiB. `proto/dist` hiện có khoảng 1.400 file, tổng 59 MB, file lớn nhất 766 KB. `scripts/chuan-bi.mjs` báo lỗi nếu vượt.
- **Worker:** 100.000 request mỗi ngày. Chỉ tính trang HTML, `/api/*` và `/moi/*`, vì JS và hình không chạy Worker. Mỗi người chơi tốn khoảng 10–20 request khi mở game, cộng 3 request mỗi phút khi gửi sự kiện.
- **D1:** 5 GB, 5 triệu lượt đọc và 100.000 lượt ghi mỗi ngày. Mỗi request đã qua cổng tốn 1 lượt đọc. Mỗi lô sự kiện tốn số lượt ghi bằng số sự kiện cộng 1.

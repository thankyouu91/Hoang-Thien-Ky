# web/ — website thienhoangky.fun

Website giới thiệu Thiên Hoang Ký. Kín như game: chỉ trình duyệt đã mở link mời chơi thử mới xem được, vì chưa có giấy phép G1 thì chưa được quảng cáo game (Nghị định 147). Mở công khai sau khi có G1 (mục cuối).

| Tên miền | Việc | Mã |
|---|---|---|
| `thienhoangky.fun` | Website (Worker `thienhoangky-web`) | `web/` |
| `www.thienhoangky.fun` | 301 về tên gốc (Worker `thienhoangky-www`) | `cloudflare/wrangler.www.jsonc` |
| `play.thienhoangky.fun` | Game, cấp cookie link mời (Worker `thienhoangky`) | `cloudflare/` |
| `choi.thienhoangky.fun` | 301 sang `play.` (tên cũ, Worker `thienhoangky-www`) | `cloudflare/` |
| `wiki.thienhoangky.fun` | Wiki | tab wiki |
| `admin.thienhoangky.fun` | Admin Dashboard, sau Cloudflare Access | `admin/` |

## Trang

| Đường dẫn | File | Nội dung |
|---|---|---|
| `/` | `index.html` | Vườn trúc thủy mặc Three.js (đình uống trà), câu thơ, đại lục, tính năng, góc tranh, wiki, chính sách |
| `/the-gioi/` | `the-gioi/index.html` | 4 vị diện, 12 vùng và 12 hệ, thành chủ, sơn môn, bốn phe |
| `/diem-rieng/` | `diem-rieng/index.html` | Lập tông, bản đồ tranh, ghép tàn quyển, phi thăng, "tu tiên bằng trí, không bằng ví" (GDD mục 1–2) |
| `/thu-vien/` | `thu-vien/index.html` | Ảnh chụp prototype, tu sĩ, thú cưỡi, công trình, đảo nổi, sân đấu, vật phẩm, đạo đồ |
| `/lo-trinh/` | `lo-trinh/index.html` | Prototype, Cửa 1 chơi thử kín, MVP (không ghi ngày) |
| `/nhat-ky/` | `nhat-ky/index.html` | Devlog theo ngày, tóm từ tab Coding của GDD và lịch sử commit |
| `/gop-y/` | `gop-y/index.html` | Form góp ý, ghi vào bảng `phan_hoi` (Admin xem ở màn Phản hồi, `man` bắt đầu bằng `website`) |
| `/chinh-sach-bao-mat/` | `chinh-sach-bao-mat/index.html` | Bản chơi thử giữ gì, không giữ gì (theo docs/api.md) |
| `/chinh-sach-game/` | `chinh-sach-game/index.html` | Nhãn tuổi, giờ chơi, ứng xử, tiền trong game, sở hữu trí tuệ |
| (không có) | `404.html` | Trang lạc |

Không có: nạp tiền, tải app, thu email hay số điện thoại. Không đưa lên: số đề xuất chi tiết, kế hoạch kinh doanh, pháp lý, câu hỏi mở.

## Cách dựng

- **Vite 8.3.5 nhiều trang** (cùng bản với `proto/`, `admin/`), không Astro: 8 trang HTML tĩnh không cần framework; import thẳng lớp Three.js dùng chung `proto/src/three/` (file `.ts`) mà không cần adapter.
- Phần dùng chung chèn lúc build bằng plugin `thk-manh` trong `vite.config.ts`: `<!--#mo-->` (thẻ head), `<!--#dau-->` (đầu trang, đánh dấu mục đang mở), `<!--#chan-->` (chân trang: nhãn tuổi 16+, lời nhắc sức khỏe, ghi bản thử nghiệm kín), `<!--#hinh:nhom/file.webp-->` (một hình), `<!--#nhom:id-->` (cả nhóm thư viện). Trang ra HTML đầy đủ, đọc được khi tắt JavaScript.
- **Hình:** `scripts/hinh.mjs` chọn hình trong `assets/pixellab`, `assets/icon_ve` và `web/anh-chup/`, xuất WebP vào `public/hinh/` (không commit) và ghi `src/hinh.json` (cỡ, chú thích, mã băm). Hình pixel giữ cỡ gốc, nén không mất, phóng bằng `image-rendering: pixelated`; tranh vẽ thu còn 320 px. Mọi `<img>` có `width`/`height` và `loading="lazy"`. Hiện 142 hình, khoảng 2 MB tổng, trang nào cũng chỉ tải hình đang thấy.
- **Ảnh chụp prototype:** `node scripts/chup.mjs` (cần `npm.cmd run dev:proto` ở gốc repo, cổng 5173, và Chrome hoặc Edge) chụp 6 màn ở khung 390 × 844 vào `web/anh-chup/*.webp` (có commit).
- **Cảnh đầu trang chủ:** vườn trúc thủy mặc lắc lư trong gió, giữa là đình uống trà (`src/canhTruc.ts`, theo tranh mẫu người dùng gửi 2026-11-05: trúc mực xám nâu, lá đậm rủ từ mép trên, sương trắng, không thấy chân trời). Là một `Program` gắn qua `mountProgram` của `proto/src/three/` (phiên Three.js giữ, web không sửa thư mục đó): host lo vòng vẽ, thị sai, prefers-reduced-motion, hạ độ phân giải. Mọi cây trúc gộp MỘT mesh, gió trong vertex shader. Chỉ nạp three khi máy có WebGL2; không có (thử `?nowebgl`) thì giữ tranh SVG tĩnh trong HTML. Ra khỏi màn hình thì canvas ẩn để renderer ngừng vẽ. Khung đứng thì camera nhìn thẳng vào đình (chữ nằm trên), khung ngang chữ trái đình phải.
- Dấu ấn: `assets/brand` (dấu son tròn, tab icon Canva, thay ô đỏ chữ Hán người dùng chê), `scripts/hinh.mjs` xuất `hinh/brand/dau_an_96.webp` (logo đầu trang), `dau_an_256.webp` (đầu trang chủ, trang cổng) và chép favicon.
- Chữ (người dùng chốt 2026-11-05): tên game Great Vibes (theo mẫu thư pháp August người dùng gửi; không dùng font Agustus Việt hóa vì giấy phép không rõ), câu thơ Itim (tròn), tiêu đề Prata (chỉ có weight 400, đừng ép đậm), chữ đọc Lora; đều từ `@fontsource` (đủ dấu tiếng Việt, trình duyệt chỉ tải phần chữ cần). Token màu chép từ `proto/src/dashboard/tokens.css` (nền kem, khung đỏ mảnh, đỏ son ấn triện).

```
cd web
npm.cmd install
npm.cmd run dev          # http://localhost:5190 (xuất hình rồi chạy vite)
npm.cmd run build        # ra dist/
npm.cmd test             # 10 test Worker: cổng, khóa, công khai, góp ý, /moi/
npm.cmd run typecheck
```

## Worker và cổng

`worker/index.ts` (Worker `thienhoangky-web`, cấu hình `wrangler.jsonc`):

- Mọi trang HTML và `/api/gop-y` cần cookie `thk_moi` hợp lệ: Worker băm SHA-256 rồi tra `nguoi_choi_thu` trong D1 `thienhoangky` (chung với game). Thiếu cookie: trang "dành cho người được mời" (403). Bị khóa ở Admin: trang khóa (403).
- Cookie do game cấp ở `play.thienhoangky.fun/moi/<ma>` với `Domain=thienhoangky.fun` (`datCookie` trong `cloudflare/src/moi.ts`), nên tên gốc và wiki đọc được cùng cookie. `/moi/*` gõ vào tên gốc thì 302 sang game.
- `/assets/*` (JS, CSS, font có mã băm) và `/hinh/*` phục vụ thẳng, không chạy Worker, không tốn lượt request.
- Trang đã qua cổng: `Cache-Control: private, no-cache`, `X-Robots-Tag: noindex, nofollow`; `robots.txt` chặn mọi máy tìm kiếm.
- Dùng chung hàm với Worker game: `cloudflare/src/moi.ts` (đọc, băm cookie), `kiem.ts` (kiểm phản hồi), `http.ts` (JSON, chặn ghi từ trang khác).

### Chạy thử Worker ở máy

```
npx.cmd wrangler d1 migrations apply thienhoangky --local     # bảng game, từ ../cloudflare/migrations
npx.cmd wrangler d1 execute thienhoangky --local --file <sql thêm loi_moi và nguoi_choi_thu với the_hash đã biết>
npx.cmd wrangler dev --port 8790
```

Không chạy migration `--remote` trong thư mục này: migration game do `cloudflare/` giữ.

## Deploy

Build từ mã đã commit, trong worktree sạch (thư mục repo chung thường có file phiên khác đang sửa dở):

```
git worktree add --detach ..\KhaiTongLapPhai-web HEAD      # lần đầu; các lần sau: git checkout --detach <commit>
cd ..\KhaiTongLapPhai-web
npm.cmd ci                                                    # gốc repo: three, @types/three cho proto/src/three
cd web
npm.cmd ci
npx.cmd wrangler deploy                                       # tự chạy npm run build, gắn tên miền thienhoangky.fun
```

Tên gốc `thienhoangky.fun` do Worker web giữ; game đã chuyển sang `play.` (2026-11-05), nên hai Worker không tranh tên miền. Cổng nằm trong Worker, nên ngay lần deploy đầu tên gốc đã kín.

## Mở công khai sau khi có G1

1. `wrangler.jsonc`: `"CONG_KHAI": "1"`. Worker thôi kiểm cookie với trang, bỏ `noindex`, `robots.txt` cho phép.
2. `src/manh/mo.html`: bỏ thẻ `<meta name="robots" content="noindex, nofollow">`.
3. `src/manh/chan.html`: bỏ đoạn "Bản thử nghiệm kín".
4. Build và deploy. Góp ý vẫn cần link mời (gắn với người chơi thử).

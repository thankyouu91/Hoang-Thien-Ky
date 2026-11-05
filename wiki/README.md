# wiki/ — wiki người chơi Thiên Hoang Ký (wiki.thienhoangky.fun)

Wiki cho người chơi thử kín: luật chơi, công pháp, tông môn, bí cảnh, vật phẩm, và bảng tra số liệu sinh thẳng từ dữ liệu game. Kín như game: chỉ trình duyệt đã mở link mời của game mới xem được (cổng ở `worker/index.ts`, hợp đồng ở `docs/api.md`, mục "Link mời và cookie").

## Vì sao VitePress

Chọn VitePress 1.6.4 (bản ổn định mới nhất khi dựng, ghim đúng phiên bản trong `package.json`) thay vì Astro Starlight:

- **Tìm kiếm tiếng Việt có dấu hay không dấu đều ra.** Tìm kiếm cục bộ của VitePress dùng MiniSearch và cho đặt hàm `processTerm`; wiki đặt hàm bỏ dấu và đổi đ thành d cho cả lúc lập chỉ mục lẫn lúc gõ (`docs/.vitepress/config.mts`). Pagefind của Starlight không cho chỉnh như vậy.
- **Tìm tới từng món.** VitePress cho tự tách trang thành mục tìm kiếm (`_splitIntoSections`), nên mỗi dòng bảng tra cứu thành một kết quả riêng (`docs/.vitepress/timKiem.ts`).
- **Chèn đoạn sinh vào trang viết tay** bằng `<!--@include: ...-->`, và chỉ mục tìm kiếm đọc cả đoạn chèn.
- Nhẹ, build dưới 15 giây, theme mặc định đã ưu tiên điện thoại; chỉ phủ màu và chữ theo mẫu tranh giấy của dashboard (`docs/.vitepress/theme/style.css`, token lấy từ `proto/src/dashboard/tokens.css`).

## Cấu trúc

| Đường dẫn | Việc |
|---|---|
| `docs/<mục>/*.md` | Trang nội dung viết tay cho người chơi |
| `docs/tra-cuu/*.md` | Trang tra cứu, **sinh tự động**, không commit |
| `docs/_sinh/*.md` | Đoạn bảng sinh tự động để chèn vào trang viết tay, không commit |
| `docs/public/hinh/` | Icon (thu về 128 px) và hình pixel được dùng, chép từ `assets/`, không commit |
| `docs/.vitepress/config.mts` | Thanh bên, thanh trên, tìm kiếm |
| `docs/.vitepress/traCuu.ts` | Danh sách trang tra cứu (một nguồn cho thanh bên và script sinh) |
| `docs/.vitepress/theme/` | Màu, chữ, khung đỏ; thẻ `<ThuNghiem />` |
| `scripts/sinh.ts` | Sinh trang tra cứu và đoạn chèn từ `data/he_thong/json`, `data/maps`; chép hình |
| `scripts/deXuat.ts` | Đọc màu ô trong `data/he_thong/KhaiTongLapPhai_HeThong_v1.xlsx`: cột còn ô vàng (đề xuất) thì gắn nhãn thử nghiệm |
| `scripts/kiem.ts` | Soát bản build: chữ nội bộ lọt ra, trang thiếu, giới hạn static assets |
| `worker/index.ts` | Worker `thienhoangky-wiki`: cổng link mời rồi trả file tĩnh |
| `wrangler.jsonc` | Cấu hình Worker, tên miền, D1 (chỉ đọc) |
| `test/` | Test cổng vào (`npm.cmd test`) |

## Chạy ở máy

```
cd wiki
npm.cmd install
npm.cmd run dev        # sinh bảng rồi mở http://127.0.0.1:5195 (preview "ktlp-wiki")
npm.cmd run build      # sinh bảng, build vào docs/.vitepress/dist, rồi soát
npm.cmd run preview    # xem bản build ở http://127.0.0.1:5196
npm.cmd test           # test cổng vào của Worker
```

Đổi số trong game thì không phải sửa wiki: sửa Excel số liệu, xuất lại JSON (`data/he_thong/README.md`), rồi build lại wiki.

## Viết trang

- Người đọc là người chơi. Không đưa ghi chú nội bộ, câu hỏi mở, kế hoạch kinh doanh, pháp lý hay cốt truyện chưa mở. `scripts/kiem.ts` chặn một số chữ (GDD, đề xuất, chốt, tên công cụ, mã có dấu gạch dưới…) và làm build lỗi.
- Số còn đang thử: ghi số hiện hành rồi đặt `<ThuNghiem />` ngay sau (hiện "đang thử nghiệm, có thể đổi").
- Bảng số liệu có sẵn trong `docs/_sinh/` thì chèn, đừng gõ lại: `<!--@include: ../_sinh/he.md-->`.
- Tuyệt đối không đọc hay đưa gì từ `data/bi_mat/` lên wiki.
- Frontmatter có dấu hai chấm thì để trong ngoặc kép.

## Deploy

Cổng vào: `CONG = "loi_moi"` dùng chung cookie `thk_moi` (`Domain=thienhoangky.fun`) mà game đặt khi mở link mời; Worker chỉ đọc `nguoi_choi_thu` trong D1 `thienhoangky`. `wiki.thienhoangky.fun/moi/<mã>` chuyển 302 sang link mời của game (`LINK_GAME`, hiện là play.thienhoangky.fun). Dấu ấn và favicon lấy từ `assets/brand` (chép vào `/hinh/brand`, phục vụ thẳng để trang cổng cũng hiện). Trang HTML đi qua Worker; `/assets/*` (JS, CSS, font, chỉ mục tìm kiếm có mã băm trong tên) và `/hinh/*` phục vụ thẳng như game. `workers_dev` và `preview_urls` tắt.

Build từ mã đã commit, trong worktree riêng (thư mục chung hay có file phiên khác đang sửa dở):

```
git worktree add --detach ..\KhaiTongLapPhai-wiki-deploy HEAD     # lần đầu; các lần sau: git checkout --detach <commit>
cd ..\KhaiTongLapPhai-wiki-deploy\wiki
npm.cmd ci
npx.cmd wrangler deploy        # tự chạy npm run build (sinh, build, soát) rồi đẩy lên và gắn wiki.thienhoangky.fun
```

Kiểm sau deploy: trình duyệt chưa mở link mời thì thấy trang "Wiki dành cho người chơi thử" (403); trình duyệt đã vào game thì xem được wiki; `https://wiki.thienhoangky.fun/robots.txt` chặn mọi bot.

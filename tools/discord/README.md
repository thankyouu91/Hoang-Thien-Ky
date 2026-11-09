# Máy chủ Discord "Thiên Hoang Ký"

Script `thiet_lap.mjs` dựng máy chủ Discord của cộng đồng từ file cấu hình `cau_hinh.json` và nội dung trong `noi_dung/`. Script dùng bot Discord và REST API v10 (`fetch` của Node 24, không cần cài thư viện). Chạy lại bao nhiêu lần cũng được: lần sau chỉ sửa chỗ lệch so với cấu hình.

Máy chủ để **kín**: không bật Discovery, chỉ vào bằng link mời. Game chưa có giấy phép G1, và Nghị định 147 không cho quảng cáo game G1 trước khi được phê duyệt.

## Phần bạn tự làm (một lần)

### Bước 1. Tạo máy chủ và bật Cộng đồng

1. Mở app Discord. Ở cột trái, bấm dấu **+** (Thêm máy chủ).
2. Chọn **Tạo của riêng tôi**, rồi **Cho một câu lạc bộ hoặc cộng đồng**.
3. Đặt tên **Thiên Hoang Ký**, bỏ trống ảnh, bấm **Tạo**.
4. Bấm tên máy chủ → **Cài đặt máy chủ** → mục **Cộng đồng** (Enable Community) → **Bắt đầu**.
5. Làm theo 3 bước của Discord:
    - An toàn: để mặc định (bắt buộc email đã xác minh, quét nội dung nhạy cảm của mọi thành viên).
    - Kênh luật và kênh cập nhật cộng đồng: chọn **Tạo giúp tôi** cho cả hai. Script sẽ đổi tên và chuyển hai kênh này vào chỗ đúng.
    - Đọc và đồng ý Nguyên tắc cộng đồng của Discord, bấm **Hoàn tất**.
6. **Không** bật mục **Khám phá** (Discovery). Máy chủ phải kín.

### Bước 2. Tạo bot

1. Mở https://discord.com/developers/applications → **New Application**. Đặt tên, ví dụ `Thiên Hoang Ký – Trợ lý`, đồng ý điều khoản, bấm **Create**.
2. Tab **Installation**: ở **Install Link** chọn **None**, bấm **Save Changes**. Phải làm bước này trước, nếu không Discord không cho tắt Public Bot.
3. Tab **Bot**:
    - Tắt **Public Bot**, để chỉ bạn mời được bot. Bấm **Save Changes**.
    - Không cần bật các mục Privileged Gateway Intents.
    - Bấm **Reset Token** → **Yes, do it!** → **Copy**. Token chỉ hiện một lần.

### Bước 3. Cất token vào file ngoài repo

**Không dán token vào chat, không ghi vào repo.** Mở PowerShell của bạn và chạy khối dưới. Lệnh hỏi token mà không hiện ra màn hình, rồi ghi vào `%USERPROFILE%\.thienhoangky\discord.env`.

```powershell
New-Item -ItemType Directory -Force "$env:USERPROFILE\.thienhoangky" | Out-Null
$s = Read-Host "Dan token bot" -AsSecureString
$t = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($s))
Set-Content -Path "$env:USERPROFILE\.thienhoangky\discord.env" -Value "DISCORD_BOT_TOKEN=$t" -Encoding ascii
Remove-Variable s, t
```

Cách khác: tự tạo file đó bằng Notepad, một dòng `DISCORD_BOT_TOKEN=<token>`.

### Bước 4. Mời bot vào máy chủ

Lấy **Application ID** ở tab **General Information** (số này công khai, dán vào chat được). Thay vào link dưới rồi mở bằng trình duyệt:

```
https://discord.com/oauth2/authorize?client_id=<APPLICATION_ID>&scope=bot&permissions=2253295405231351
```

Hoặc chạy lệnh dưới, script tự đọc ID từ token và in sẵn link:

```bash
node tools/discord/thiet_lap.mjs link-bot
```

Chọn máy chủ **Thiên Hoang Ký** → **Tiếp tục** → giữ nguyên các quyền → **Ủy quyền**.

Quyền xin cho bot và lý do:

| Quyền | Dùng để |
| --- | --- |
| Manage Server | Đặt kênh luật, kênh hệ thống, AutoMod |
| Manage Roles | Tạo vai trò, phân quyền kênh, link mời gán vai trò |
| Manage Channels | Tạo danh mục, kênh, diễn đàn và thẻ |
| Manage Webhooks | Webhook để Admin Dashboard đăng thông báo (làm sau) |
| View Channels, Send Messages, Embed Links, Attach Files, Read Message History | Đăng luật, lời chào, giới thiệu |
| Manage Messages, Pin Messages | Sửa tin của bot, ghim tin |
| Create Instant Invite | Tạo link mời máy chủ |
| Manage Threads, Create Public/Private Threads, Send Messages in Threads, Add Reactions, Mention Everyone, Connect, Speak | Bot chỉ trao được quyền nó đang có, nên cần các quyền này để đặt quyền kênh |
| Moderate Members, Kick Members, Ban Members, Manage Nicknames, View Audit Log | Để trao các quyền này cho Vận hành và Ban quản trị; AutoMod tạm khóa người nhắc tên hàng loạt |

Bot không có quyền Administrator.

## Phần script làm

```bash
node tools/discord/thiet_lap.mjs kiem
```
Kiểm token, máy chủ, quyền và vị trí vai trò của bot. Chỉ đọc.

```bash
node tools/discord/thiet_lap.mjs dung
```
In ra những gì sẽ đổi, không ghi gì (chạy thử).

```bash
node tools/discord/thiet_lap.mjs dung --ghi
```
Ghi thật: vai trò, danh mục, kênh, diễn đàn và thẻ, quyền kênh, cài đặt máy chủ, biểu tượng (dấu ấn `assets/brand/discord_icon.png`), AutoMod, tin nhắn soạn sẵn (có ghim).

```bash
node tools/discord/thiet_lap.mjs moi --vai-tro thanh_vien --luot 0
```
Tạo link mời không hết hạn (`--luot 0` là không giới hạn lượt, hoặc 1–100). Người vào bằng link này tự nhận vai trò Thành viên. `--vai-tro choi_thu` cho thêm vai trò Người chơi thử; link đó chỉ gửi riêng, không đăng ở kênh công khai.

```bash
node tools/discord/thiet_lap.mjs moi --liet-ke
```
Liệt kê link mời đang có, số lượt đã dùng và vai trò mỗi link gán.

```bash
node tools/discord/thiet_lap.mjs bieu-tuong <tệp.png>
```
Đặt biểu tượng khác với cấu hình (bình thường `dung --ghi` tự đặt).

```bash
node tools/discord/thu_gia_lap.mjs
```
Thử script với một máy chủ Discord giả lập, không gọi Discord thật. Chạy sau mỗi lần sửa script.

Script đọc token từ biến môi trường `DISCORD_BOT_TOKEN`, nếu không có thì từ `%USERPROFILE%\.thienhoangky\discord.env`. Script không in token. Máy chủ được chọn theo tên trong `cau_hinh.json`, hoặc theo `DISCORD_GUILD_ID` nếu đặt. Id các kênh và vai trò đã dựng được nhớ ở `%USERPROFILE%\.thienhoangky\discord-state.json`, nên đổi tên kênh bằng tay không làm script tạo kênh trùng.

Script không xóa gì. Kênh mặc định của Discord (kênh chung, kênh thoại, hai kênh do bước Cộng đồng tạo) được đổi tên và chuyển chỗ. Kênh không có trong cấu hình được liệt kê ở cuối để bạn tự quyết.

## Cách phân quyền

| Ai | Thấy gì |
| --- | --- |
| Người vào mà chưa có vai trò | Chỉ danh mục Thông tin, chỉ đọc |
| Thành viên | Thông tin (đọc), Diễn đàn, Trò chuyện, Thoại |
| Người chơi thử | Như Thành viên, thêm danh mục Chơi thử |
| Vận hành | Tất cả, đăng ở Thông tin, quản lý tin và bài, tạm khóa, đuổi; danh mục Quản trị |
| Ban quản trị | Như Vận hành, thêm quyền sửa máy chủ, vai trò, kênh, cấm |

Link mời do script tạo tự gán vai trò, nên người vào bằng link không cần ai duyệt. Thành viên thường không tạo được link mời và không nhắc @everyone được. Muốn Ban quản trị có quyền Administrator thì chủ máy chủ tự bật trong **Cài đặt máy chủ → Vai trò**, vì bot không trao được quyền nó không có.

## File

- `thiet_lap.mjs`: script.
- `thu_gia_lap.mjs`: thử script trên máy chủ giả lập.
- `cau_hinh.json`: vai trò, danh mục, kênh, thẻ diễn đàn, quyền, AutoMod, cài đặt máy chủ.
- `noi_dung/*.md`: luật, lời chào, giới thiệu game, lời chào người chơi thử. Dòng `===` tách thành nhiều tin (mỗi tin tối đa 2000 ký tự). `{{kenh:<khóa>}}` và `{{vai_tro:<khóa>}}` thành nhắc kênh, nhắc vai trò (không gửi thông báo). Sửa file rồi chạy lại `dung --ghi`, bot sửa tin cũ của nó thay vì đăng tin mới.
- `noi_dung/tu_tuc.txt`: từ tục tiếng Việt cho AutoMod. Tiếng Anh dùng bộ có sẵn của Discord.

## Quyết định đã chọn

- Lời chào đặt ở 💬chung (cũng là kênh hệ thống, nơi Discord báo người mới vào) thay vì thêm kênh chào riêng, để danh mục Thông tin chỉ có bốn kênh như yêu cầu.
- Thêm danh mục Quản trị ẩn (🛡️kiểm-duyệt, 📝bàn-việc): AutoMod và Discord cần một kênh riêng cho đội vận hành để gửi cảnh báo.
- Thành viên thường không tạo được link mời. Link mời do Vận hành tạo và gán vai trò, nên người lạ vào bằng link cũ không có vai trò thì chỉ đọc được Thông tin.
- AutoMod chặn link mời vào game (`thienhoangky.fun/moi/...`) ở mọi kênh trừ 🧪phòng-chơi-thử và kênh Quản trị.
- 📢thông-báo là kênh chữ thường, không phải kênh Thông báo của Discord: máy chủ kín, không cần cho máy chủ khác theo dõi.

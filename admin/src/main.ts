// Khung Admin Dashboard: hỏi /api/toi (ai, vai trò), vẽ thanh bên theo vai trò, định tuyến theo hash.
// Màn chỉ Admin vẫn bị server chặn (403) nếu ai đó gõ thẳng đường dẫn; ở đây chỉ ẩn cho gọn.

import "./style.css";
import type { Toi } from "../shared/hopDong.ts";
import { TEN_VAI_TRO } from "../shared/hopDong.ts";
import { ApiLoi, api, dangXemNhu, datXemNhu } from "./api.ts";
import { esc } from "./ui.ts";
import type { Man } from "./screens/man.ts";
import { manTongQuan } from "./screens/tongQuan.ts";
import { manNguoiChoi } from "./screens/nguoiChoi.ts";
import { manPhanHoi } from "./screens/phanHoi.ts";
import { manThongBao } from "./screens/thongBao.ts";
import { manCauHinh } from "./screens/cauHinh.ts";
import { manPhanQuyen } from "./screens/phanQuyen.ts";
import { manNhatKy } from "./screens/nhatKy.ts";

const MAN: Man[] = [manTongQuan, manNguoiChoi, manPhanHoi, manThongBao, manCauHinh, manPhanQuyen, manNhatKy];

const app = document.getElementById("app")!;
let toi: Toi | null = null;
let dangVe = 0;

function manHienTai(): Man {
  const id = location.hash.replace(/^#\/?/, "").split("?")[0];
  return MAN.find((m) => m.id === id) ?? MAN[0];
}

function veKhung(): void {
  if (!toi) return;
  const t = toi;
  const laAdmin = t.vai_tro === "admin";
  const cur = manHienTai();
  const who = `<div class="who-box"><span class="email">${esc(t.email)}</span>
    <span class="chip ${t.vai_tro === "admin" ? "son" : "info"}">${TEN_VAI_TRO[t.vai_tro]}${t.admin_goc && laAdmin ? " gốc" : ""}</span>
    ${t.vai_tro_that === "admin" ? `<label class="check" title="Hạ quyền của chính bạn xuống Vận hành cho các lần gọi API, để thử việc chặn ở server."><input type="checkbox" aria-label="Xem như Vận hành" data-xem-nhu ${dangXemNhu() ? "checked" : ""}> Xem như Vận hành</label>` : ""}
    <a href="/cdn-cgi/access/logout">Đăng xuất</a></div>`;
  app.innerHTML = `
    <aside class="rail">
      <a class="brand" href="#/tong-quan"><span class="an" aria-hidden="true">天荒</span><span><b>Thiên Hoang Ký</b><small>Quản trị · chơi thử kín</small></span></a>
      <nav class="menu" aria-label="Màn quản trị">
        ${MAN.map(
          (m) =>
            `<a href="#/${m.id}" ${m === cur ? 'aria-current="page"' : ""} ${m.chiAdmin && !laAdmin ? 'aria-disabled="true" title="Chỉ Admin"' : ""}>${esc(m.ten)}${m.chiAdmin ? `<span class="khoa">${laAdmin ? "Admin" : "khóa"}</span>` : ""}</a>`,
        ).join("")}
      </nav>
      <div class="who">${who}</div>
    </aside>
    <main class="main">
      ${dangXemNhu() && t.vai_tro_that === "admin" ? `<p class="xem-nhu">Đang xem như Vận hành: server xử lý mọi yêu cầu với quyền Vận hành. Bỏ chọn "Xem như Vận hành" để trở lại Admin.</p>` : ""}
      <div class="topline"><h1>${esc(cur.ten)}</h1><span class="sub">${esc(cur.mo_ta)}</span><div class="tools who-box mobile">${who}</div></div>
      <div id="man"></div>
    </main>`;
  app.querySelectorAll<HTMLInputElement>("[data-xem-nhu]").forEach((cb) =>
    cb.addEventListener("change", async () => {
      datXemNhu(cb.checked);
      await batDau();
    }),
  );
  // Điện thoại: menu cuộn ngang, đưa mục đang mở vào giữa.
  app.querySelector('nav.menu a[aria-current="page"]')?.scrollIntoView({ inline: "center", block: "nearest" });
  void veMan(cur);
}

async function veMan(m: Man): Promise<void> {
  // Thay #man bằng phần tử mới mỗi lần vẽ để bỏ hết sự kiện màn cũ đã gắn.
  const cu = document.getElementById("man")!;
  const el = cu.cloneNode(false) as HTMLElement;
  cu.replaceWith(el);
  const lan = ++dangVe;
  el.innerHTML = `<div class="panel"><div class="loading">Đang tải…</div></div>`;
  try {
    await m.ve(el, { toi: toi!, veLai: () => veMan(m), conHieuLuc: () => lan === dangVe });
  } catch (e) {
    if (lan !== dangVe) return;
    const err = e as ApiLoi;
    el.innerHTML = `<div class="panel"><div class="empty"><b>${err.status === 403 ? "Không có quyền" : "Không tải được"}</b><br>${esc(err.message)}</div></div>`;
  }
}

function veChan(tieuDe: string, cau: string): void {
  app.innerHTML = `<div class="chan panel"><h1 style="font-family:var(--font-display);color:var(--c-accent-ink);font-size:26px">${esc(tieuDe)}</h1><p>${esc(cau)}</p><div class="btns"><button class="btn" type="button" data-tai-lai>Tải lại</button><a class="btn" href="/cdn-cgi/access/logout">Đăng xuất Access</a></div></div>`;
  app.querySelector("[data-tai-lai]")!.addEventListener("click", () => location.reload());
}

async function batDau(): Promise<void> {
  try {
    toi = await api.get<Toi>("/api/toi");
    // Hết quyền Admin thật thì bỏ cờ xem như.
    if (toi.vai_tro_that !== "admin" && dangXemNhu()) datXemNhu(false);
    veKhung();
  } catch (e) {
    const err = e as ApiLoi;
    veChan(err.status === 403 ? "Chưa được phân quyền" : "Chưa vào được", err.message);
  }
}

window.addEventListener("hashchange", () => veKhung());
void batDau();

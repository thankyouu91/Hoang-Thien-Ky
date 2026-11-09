// Cấu hình sống (chỉ Admin): tham số đề xuất cho bản chơi thử, mỗi lần đổi ghi lịch sử (cũ → mới, ai, lúc nào, lý do).

import type { CauHinh, ThamSo } from "../../shared/hopDong.ts";
import { api } from "../api.ts";
import { esc, gio, toast, voiNut, xacNhan } from "../ui.ts";
import type { Man } from "./man.ts";

export const manCauHinh: Man = {
  id: "cau-hinh",
  ten: "Cấu hình sống",
  mo_ta: "Chỉ Admin · game đọc lại khi người chơi tải trang",
  chiAdmin: true,
  async ve(el, ctx) {
    let ch = await api.get<CauHinh>("/api/cau-hinh");
    if (!ctx.conHieuLuc()) return;
    const tai = async () => {
      ch = await api.get<CauHinh>("/api/cau-hinh");
      if (ctx.conHieuLuc()) ve();
    };
    const ve = () => {
      const ten = new Map(ch.tham_so.map((t) => [t.khoa, t.ten]));
      el.innerHTML = `<div class="panel"><div class="cols">
        <div class="col"><section class="card"><h2>Tham số <span class="right">số là đề xuất, chờ duyệt</span></h2>
          <div class="items">${ch.tham_so.map(the).join("")}</div></section></div>
        <div class="col"><section class="card"><h2>Lịch sử đổi</h2>
          <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Lúc</th><th>Tham số</th><th>Cũ → mới</th><th>Ai, lý do</th></tr></thead><tbody>
          ${
            ch.lich_su
              .map(
                (l) =>
                  `<tr><td class="nowrap">${gio(l.luc)}</td><td>${esc(ten.get(l.khoa) ?? l.khoa)}</td><td class="nowrap">${esc(hien(l.cu))} → <b>${esc(hien(l.moi))}</b></td><td><span class="email">${esc(l.boi)}</span>${l.ly_do ? `<br><span class="muted">${esc(l.ly_do)}</span>` : ""}</td></tr>`,
              )
              .join("") || `<tr><td colspan="4" class="empty">Chưa đổi lần nào; mọi tham số đang ở mặc định.</td></tr>`
          }
          </tbody></table></div></section></div>
      </div></div>`;
    };

    el.addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = e.target as HTMLFormElement;
      const t = ch.tham_so.find((x) => x.khoa === f.dataset.khoa);
      if (!t) return;
      const inp = f.elements.namedItem("gia_tri") as HTMLInputElement;
      const gia_tri = t.kieu === "bat_tat" ? inp.checked : t.kieu === "so" ? Number(inp.value) : inp.value;
      if (gia_tri === t.gia_tri) return toast("Giá trị không đổi.");
      const ok = await xacNhan(
        "Đổi cấu hình sống",
        `<b>${esc(t.ten)}</b>: ${esc(hien(t.gia_tri))} → <b>${esc(hien(gia_tri))}</b>. Người chơi nhận giá trị mới khi tải lại game.`,
        "Đổi",
        "Lý do (ghi vào lịch sử)",
      );
      if (!ok) return;
      await voiNut(f.querySelector("button"), async () => {
        await api.post("/api/cau-hinh", { khoa: t.khoa, gia_tri, ly_do: ok.lyDo });
        toast(`Đã đổi ${t.ten}.`);
        await tai();
      });
    });

    ve();
  },
};

function hien(v: unknown): string {
  if (v === true) return "bật";
  if (v === false) return "tắt";
  if (typeof v === "number") return v.toLocaleString("vi-VN");
  return v === null || v === undefined ? "—" : String(v);
}

function the(t: ThamSo): string {
  const doi = t.gia_tri !== t.mac_dinh;
  const input =
    t.kieu === "bat_tat"
      ? `<label class="check"><input type="checkbox" name="gia_tri" ${t.gia_tri ? "checked" : ""}> Bật</label>`
      : t.kieu === "so"
        ? `<input type="number" name="gia_tri" value="${esc(t.gia_tri)}" min="${t.min ?? ""}" max="${t.max ?? ""}" step="${t.buoc ?? "any"}" style="max-width:9rem" aria-label="${esc(t.ten)}">${t.don_vi ? ` <span class="muted">${esc(t.don_vi)}</span>` : ""}`
        : `<input type="text" name="gia_tri" value="${esc(t.gia_tri)}" maxlength="300" aria-label="${esc(t.ten)}">`;
  return `<form class="item" data-khoa="${esc(t.khoa)}">
    <header><b style="color:var(--c-ink);font-size:var(--fs-md)">${esc(t.ten)}</b> <code>${esc(t.khoa)}</code>
      ${doi ? `<span class="chip son">đã đổi</span>` : `<span class="chip plain">mặc định</span>`}</header>
    <p class="muted" style="margin:0 0 var(--sp-2)">${esc(t.mo_ta)} Mặc định: ${esc(hien(t.mac_dinh))}${t.kieu === "so" ? ` · khoảng ${t.min}–${t.max}` : ""}.</p>
    <div class="btns">${input}<button class="btn small" type="submit">Lưu</button></div>
    ${t.sua_boi ? `<p class="note">Đổi lần cuối bởi ${esc(t.sua_boi)} lúc ${gio(t.sua_luc)}</p>` : ""}
  </form>`;
}

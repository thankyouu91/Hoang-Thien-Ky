// Phản hồi người chơi: lọc theo trạng thái, loại, chữ; gắn trạng thái (mới, đang xem, đã xử lý); ghi chú nội bộ.

import type { DsPhanHoi, PhanHoi, TrangThaiPhanHoi } from "../../shared/hopDong.ts";
import { TEN_TRANG_THAI_PH } from "../../shared/hopDong.ts";
import { api } from "../api.ts";
import { chipNguon, esc, gio, toast, truoc, voiNut } from "../ui.ts";
import type { Man } from "./man.ts";

const TEN_LOAI: Record<string, string> = { loi: "Lỗi", gop_y: "Góp ý", khac: "Khác" };
const CHIP_TT: Record<TrangThaiPhanHoi, string> = { moi: "son", dang_xem: "warn", da_xu_ly: "ok" };

export const manPhanHoi: Man = {
  id: "phan-hoi",
  ten: "Phản hồi",
  mo_ta: "Người chơi gửi từ game; trạng thái và ghi chú chỉ nội bộ thấy",
  async ve(el, ctx) {
    let ds = await api.get<DsPhanHoi>("/api/phan-hoi");
    if (!ctx.conHieuLuc()) return;
    let tt: TrangThaiPhanHoi | "" = "moi";
    let loai = "";
    let tim = "";

    const tai = async () => {
      ds = await api.get<DsPhanHoi>("/api/phan-hoi");
      if (ctx.conHieuLuc()) veDs();
    };

    el.innerHTML = `<div class="panel"><section class="card">
      <div class="filters" style="margin-bottom:var(--sp-3)">
        <div class="seg" role="group" aria-label="Trạng thái" id="loc-tt"></div>
        <select data-loai aria-label="Loại"><option value="">Mọi loại</option></select>
        <input type="search" placeholder="Tìm nội dung, email, màn" data-tim aria-label="Tìm">
        ${chipNguon(ds.nguon, "bảng phản hồi")}
      </div>
      <div class="items" id="ds"></div>
    </section></div>`;

    const veDs = () => {
      const dem = (x: TrangThaiPhanHoi | "") => ds.dong.filter((p) => !x || p.trang_thai === x).length;
      el.querySelector("#loc-tt")!.innerHTML = (["moi", "dang_xem", "da_xu_ly", ""] as (TrangThaiPhanHoi | "")[])
        .map((k) => `<button type="button" data-tt="${k}" aria-pressed="${k === tt}">${k ? TEN_TRANG_THAI_PH[k] : "Tất cả"}<span class="n">${dem(k)}</span></button>`)
        .join("");
      const sel = el.querySelector<HTMLSelectElement>("[data-loai]")!;
      const cacLoai = [...new Set(ds.dong.map((p) => p.loai ?? "khac"))];
      sel.innerHTML = `<option value="">Mọi loại</option>${cacLoai.map((l) => `<option value="${esc(l)}" ${l === loai ? "selected" : ""}>${esc(TEN_LOAI[l] ?? l)}</option>`).join("")}`;
      const q = tim.toLowerCase();
      const rows = ds.dong.filter(
        (p) =>
          (!tt || p.trang_thai === tt) &&
          (!loai || (p.loai ?? "khac") === loai) &&
          (!q || [p.noi_dung, p.email, p.man, ...p.ghi_chu.map((g) => g.noi_dung)].some((v) => (v ?? "").toLowerCase().includes(q))),
      );
      el.querySelector("#ds")!.innerHTML = rows.map(the).join("") || `<div class="empty">Không có phản hồi nào${tt ? ` ở trạng thái "${TEN_TRANG_THAI_PH[tt]}"` : ""}.</div>`;
    };

    el.addEventListener("input", (e) => {
      const t = e.target as HTMLInputElement;
      if (t.matches("[data-tim]")) (tim = t.value.trim()), veDs();
    });
    el.addEventListener("change", (e) => {
      const t = e.target as HTMLSelectElement;
      if (t.matches("[data-loai]")) (loai = t.value), veDs();
    });
    el.addEventListener("click", async (e) => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>("button");
      if (!b) return;
      if (b.dataset.tt !== undefined) return (tt = b.dataset.tt as TrangThaiPhanHoi | ""), veDs();
      const id = b.closest<HTMLElement>("[data-id]")?.dataset.id;
      if (!id) return;
      if (b.dataset.dat) {
        await voiNut(b, async () => {
          await api.post("/api/phan-hoi/trang-thai", { id, trang_thai: b.dataset.dat });
          toast(`Đã chuyển sang "${TEN_TRANG_THAI_PH[b.dataset.dat as TrangThaiPhanHoi]}".`);
          await tai();
        });
      }
      if (b.matches("[data-ghi]")) {
        const ta = b.closest(".item")!.querySelector<HTMLTextAreaElement>("textarea")!;
        if (!ta.value.trim()) return ta.focus();
        await voiNut(b, async () => {
          await api.post("/api/phan-hoi/ghi-chu", { id, noi_dung: ta.value });
          toast("Đã thêm ghi chú nội bộ.");
          await tai();
        });
      }
    });

    veDs();
  },
};

function the(p: PhanHoi): string {
  const nut = (k: TrangThaiPhanHoi) => (k === p.trang_thai ? "" : `<button class="btn small" type="button" data-dat="${k}">${TEN_TRANG_THAI_PH[k]}</button>`);
  return `<article class="item ${p.trang_thai === "moi" ? "moi" : ""}" data-id="${esc(p.id)}">
    <header><span class="chip ${CHIP_TT[p.trang_thai]}">${TEN_TRANG_THAI_PH[p.trang_thai]}</span>
      <span class="chip plain">${esc(TEN_LOAI[p.loai ?? "khac"] ?? p.loai)}</span>
      <span class="email">${esc(p.email ?? "ẩn danh")}</span>
      ${p.man ? `<span>màn ${esc(p.man)}</span>` : ""}${p.thiet_bi ? `<span>${esc(p.thiet_bi)}</span>` : ""}${p.phien_ban ? `<span>bản ${esc(p.phien_ban)}</span>` : ""}
      <span class="right" title="${gio(p.luc)}">${esc(truoc(p.luc))}</span></header>
    <div class="body">${esc(p.noi_dung)}</div>
    ${
      p.ghi_chu.length || p.sua_boi
        ? `<div class="notes">${p.ghi_chu.map((g) => `<p><b>${esc(g.email)}</b> <small>${gio(g.luc)}</small><br>${esc(g.noi_dung)}</p>`).join("")}
      ${p.sua_boi ? `<p class="muted" style="margin:0">Trạng thái do ${esc(p.sua_boi)} đặt lúc ${gio(p.sua_luc)}</p>` : ""}</div>`
        : ""
    }
    <div class="act"><textarea placeholder="Ghi chú nội bộ (người chơi không thấy)" maxlength="2000" aria-label="Ghi chú nội bộ"></textarea>
      <button class="btn small" type="button" data-ghi>Thêm ghi chú</button>
      <span class="btns">${nut("moi")}${nut("dang_xem")}${nut("da_xu_ly")}</span></div>
  </article>`;
}

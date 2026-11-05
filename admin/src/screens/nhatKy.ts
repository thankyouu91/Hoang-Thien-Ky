// Nhật ký quản trị: ai (tên đăng nhập) làm gì, lúc nào.

import type { NhatKy } from "../../shared/hopDong.ts";
import { TEN_HANH_DONG, TEN_VAI_TRO } from "../../shared/hopDong.ts";
import { api } from "../api.ts";
import { esc, gio } from "../ui.ts";
import type { Man } from "./man.ts";

const NHOM: [string, string][] = [
  ["", "Tất cả"],
  ["nguoi_choi", "Người chơi"],
  ["phan_hoi", "Phản hồi"],
  ["thong_bao", "Thông báo"],
  ["cau_hinh", "Cấu hình"],
  ["tai_khoan", "Tài khoản"],
  ["phien", "Đăng nhập"],
];

export const manNhatKy: Man = {
  id: "nhat-ky",
  ten: "Nhật ký",
  mo_ta: "Ai làm gì, lúc nào",
  async ve(el, ctx) {
    let nhom = "";
    let dong: NhatKy[] = [];
    let con = false;
    const tai = async (them = false) => {
      const truoc = them && dong.length ? `&truoc=${dong[dong.length - 1].id}` : "";
      const r = await api.get<{ dong: NhatKy[]; con: boolean }>(`/api/nhat-ky?hanh_dong=${nhom}${truoc}`);
      if (!ctx.conHieuLuc()) return;
      dong = them ? [...dong, ...r.dong] : r.dong;
      con = r.con;
      ve();
    };
    const ve = () => {
      el.innerHTML = `<div class="panel"><section class="card">
        <div class="filters" style="margin-bottom:var(--sp-3)"><div class="seg" role="group" aria-label="Nhóm việc">
          ${NHOM.map(([k, t]) => `<button type="button" data-nhom="${k}" aria-pressed="${k === nhom}">${t}</button>`).join("")}
        </div></div>
        <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Lúc</th><th>Ai</th><th>Việc</th><th>Đối tượng</th><th>Chi tiết</th></tr></thead><tbody>
        ${
          dong
            .map(
              (x) => `<tr><td class="nowrap">${gio(x.luc)}</td><td><span class="email">${esc(x.nguoi)}</span><br><span class="muted">${TEN_VAI_TRO[x.vai_tro] ?? esc(x.vai_tro)}</span></td>
              <td>${esc(TEN_HANH_DONG[x.hanh_dong] ?? x.hanh_dong)}</td><td class="email">${esc(x.doi_tuong ?? "")}</td><td>${chiTiet(x.chi_tiet)}</td></tr>`,
            )
            .join("") || `<tr><td colspan="5" class="empty">Chưa có việc nào.</td></tr>`
        }
        </tbody></table></div>
        ${con ? `<div class="btns" style="margin-top:var(--sp-2)"><button class="btn small" type="button" data-them>Tải thêm</button></div>` : ""}
      </section></div>`;
    };
    el.addEventListener("click", async (e) => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>("button");
      if (!b) return;
      if (b.dataset.nhom !== undefined) {
        nhom = b.dataset.nhom;
        await tai();
      } else if (b.matches("[data-them]")) await tai(true);
    });
    await tai();
  },
};

function chiTiet(c: Record<string, unknown> | null): string {
  if (!c) return "";
  const s = Object.entries(c)
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : typeof v === "object" ? JSON.stringify(v) : String(v)}`)
    .join("\n");
  return `<pre>${esc(s)}</pre>`;
}

// Nhóm "Điểm tiềm năng" ở cột Thông tin màn Nhân vật (GDD mục 6, đề xuất 2026-11-09): điểm chưa cộng, 6 thuộc tính
// với nút +1/+10, dòng hiệu ứng theo điểm đang có, nút tẩy điểm. Số từ nguồn đọc (tiemNang.ts), không đặt cứng ở đây.
// Tách khỏi nhanVat.ts để các phiên giao diện khác sửa màn Nhân vật không đụng file; nhanVat.ts chỉ gọi hai hàm này.
import type { TiemNangView } from "../source.ts";
import { esc, fmt } from "../ui.ts";
import "./tiemNangUi.css";

export function tiemNangHtml(t: TiemNangView): string {
  const rows = t.attrs
    .map(
      (a) => `<div class="nv-row tn-row"><span>${esc(a.ten)} <small class="tn-sub">${esc(a.tomTat)}</small></span>
        <span class="tn-ctl"><b>${fmt(a.diem)}</b>
          <button type="button" class="btn small" data-act="tn-cong" data-attr="${a.id}" data-n="1"${t.chuaCong < 1 ? " disabled" : ""}>+1</button>
          <button type="button" class="btn small" data-act="tn-cong" data-attr="${a.id}" data-n="10"${t.chuaCong < 10 ? " disabled" : ""}>+10</button>
        </span></div>
      <p class="nv-note tn-fx">${esc(a.hieuUng)}${a.quaMoc ? ` · <b class="tn-moc">qua mốc mềm</b>` : ""}</p>`,
    )
    .join("");
  return `
    <div class="nv-row"><span>Chưa cộng</span><b class="${t.chuaCong > 0 ? "tn-co" : ""}">${fmt(t.chuaCong)}</b></div>
    ${rows}
    <p class="nv-note">Mỗi cấp +${fmt(t.moiCap)} điểm. Từ điểm ${fmt(t.mocGiam + 1)} trong một thuộc tính, mỗi điểm chỉ còn nửa tác dụng. Số đề xuất, chờ duyệt.</p>
    ${t.daCong > 0 ? `<button type="button" class="btn small tn-tay" data-act="tn-tay">Tẩy điểm${t.tayDiemPhi ? ` · ${fmt(t.tayDiemPhi)} linh thạch` : " · miễn phí"}</button>` : ""}`;
}

/** Xử lý nút của nhóm; trả lệnh cần gửi, hay null nếu không phải nút của nhóm này (tẩy có phí thì hỏi trước). */
export function tiemNangCmd(name: string, el: HTMLElement, t: TiemNangView): { type: "cong_diem"; thuocTinh: string; diem: number } | { type: "tay_diem" } | null {
  if (name === "tn-cong") return { type: "cong_diem", thuocTinh: el.dataset.attr!, diem: Number(el.dataset.n) };
  if (name === "tn-tay") {
    if (t.tayDiemPhi && !confirm(`Tẩy toàn bộ ${t.daCong} điểm đã cộng, tốn ${t.tayDiemPhi} linh thạch?`)) return null;
    return { type: "tay_diem" };
  }
  return null;
}

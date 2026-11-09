// Phần nhìn của Set đồ 2.0 (GDD tab Trang bị phần 14; đặc tả set-2.md mục 7, việc của tab giao diện kem):
// - bậc ấn tô bằng màu viền (Lục, Lam, Tím, Vàng, Đỏ), không vẽ hình riêng;
// - thẻ "Bộ đang kích": lộ, hệ số bậc ở mốc 2 và 4, hợp bộ, cộng hưởng trên bàn, bị khắc, mốc khóa và vì sao khóa;
// - binh bộ của 3 ô công; dòng rèn; dòng ẩn "???" tới khi lộ; điểm trang bị.
// Số và trạng thái lấy từ DashboardSource (SetView, BinhBoView, GearItem); file này chỉ dựng HTML.
import { binhBoOf, ghepAn, type Bac } from "@htk/rules";
import SET from "../../../data/he_thong/json/set.json";
import TRANG_BI from "../../../data/he_thong/json/trang_bi.json";
import { sealSet as sealSetOf, setName } from "./daoCoBan.ts";
import { locale } from "./i18n.ts";
import type { BinhBoView, ForgeLineView, GearItem, HiddenLineView, SetMilestone, SetView } from "./source.ts";
import { artUrl, esc, fmt } from "./ui.ts";

export const BAC_TEN: Record<Bac, string> = { luc: "Lục", lam: "Lam", tim: "Tím", vang: "Vàng", do: "Đỏ" };

/** Tên lộ sức mạnh (set.json bo[].lo). */
export const LO_TEN: Record<string, string> = {
  ngoai_cong: "Ngoại Công",
  noi_cong: "Nội Công",
  thu_ngoai: "Thủ Ngoại",
  thu_noi: "Thủ Nội",
  khong_toc: "Khống Tốc",
  phan_chan: "Phản Chấn",
  hap_thu: "Hấp Thu",
  kinh_te: "Kinh Tế",
  khac_che: "Khắc Chế",
};

/** Số ấn cùng bộ cùng bậc để ghép lên bậc trên (set.json luat.ghepAnSo). */
export const GHEP_AN_SO = (SET as { luat?: { ghepAnSo?: number } }).luat?.ghepAnSo ?? 3;

/** Bậc sau khi ghép, hoặc undefined nếu bậc này không ghép lên được (theo luật bac_an.ghep_len). */
export function ghepLen(b: Bac): Bac | undefined {
  try {
    return ghepAn(b, GHEP_AN_SO);
  } catch {
    return undefined;
  }
}

const QUAN_HE: Record<string, string> = { thuan: "thuần", tuong_sinh: "tương sinh", tuong_hop: "tương hợp", doi_cuc: "đối cực" };

/** Nhãn bậc ấn: chữ trong khung viền màu bậc. */
export function bacBadge(b: Bac): string {
  return `<span class="bac bac-${b}">${BAC_TEN[b]}</span>`;
}

/** Hệ số phần nghìn ra "×1,2" (bỏ số 0 thừa). */
export function heSoText(perMille: number): string {
  return `×${(perMille / 1000).toLocaleString(locale(), { maximumFractionDigits: 2 })}`;
}

const loText = (lo: string[]) => lo.map((x) => LO_TEN[x] ?? x).join(", ");

function quanHeText(s: SetView): string[] {
  return s.relations.map((r) => {
    const ten = esc(setName(r.with));
    if (r.kind === "hop") return `Hợp bộ ${QUAN_HE[r.quanHe ?? ""] ?? ""} với ${ten}`.replace("  ", " ");
    if (r.kind === "ban") return `Cộng hưởng trên bàn với ${ten}`;
    return `Bị ${ten} khắc`;
  });
}

/** Chấm mốc: sáng khi có tác dụng, ổ khóa khi đã đủ món mà bị khóa (bậc dưới tím ở mốc 7, ràng buộc của bộ). */
function pips(ms: SetMilestone[]): string {
  return `<span class="lt-tiers">${ms.map((m) => `<i class="${m.on ? "on" : m.lock ? "lock" : ""}" title="${m.lock === "bac" ? "Cần cả 7 ấn từ bậc Tím" : m.lock === "dieu_kien" ? "Chưa đủ ràng buộc của bộ" : ""}">${m.at}</i>`).join("")}</span>`;
}

/** Một dòng ở thẻ "Bộ đang kích" (chạm mở chi tiết). */
export function setRow(s: SetView): string {
  const f2 = s.factor !== 1000 ? `<span class="set2-f" title="Hệ số mốc 2">${heSoText(s.factor)}</span>` : "";
  const sub = [s.lo.length ? loText(s.lo) : "", ...quanHeText(s)].filter(Boolean).map((x) => `<span>${x}</span>`).join(" · ");
  return `<li><button type="button" class="nv-row set2${s.pieces < 2 ? " tat" : ""}" data-act="lt-set" data-set="${esc(s.id)}">
      <span class="set2-l"><span class="set2-top"><b class="lt-set-name">${esc(s.name)}</b> <span class="set2-n">${s.pieces}/7</span> ${bacBadge(s.tier)}${f2}</span>${sub ? `<span class="muted set2-sub">${sub}</span>` : ""}</span>
      ${pips(s.milestones)}</button></li>`;
}

const lockText = (m: SetMilestone) =>
  m.lock === "bac" ? `<span class="muted block">Khóa: cần cả 7 ấn từ bậc ${BAC_TEN.tim}.</span>` : m.lock === "dieu_kien" ? `<span class="muted block">Khóa: chưa đủ ràng buộc của bộ.</span>` : "";

const msList = (ms: SetMilestone[]) =>
  `<ul class="list">${ms.map((m) => `<li class="row"><span class="lt-tiers"><i class="${m.on ? "on" : m.lock ? "lock" : ""}">${m.at}</i></span><span class="grow${m.on ? "" : " muted"}">${esc(m.text)}${lockText(m)}</span></li>`).join("")}</ul>`;

/** Chi tiết một bộ: số món, bậc, hệ số mốc 2 và 4, lộ, quan hệ, các mốc. */
export function setSheet(s: SetView): { title: string; html: string } {
  const rel = quanHeText(s);
  return {
    title: `${s.name} · ${s.pieces}/7`,
    html: `<dl class="kv">
        <dt>Bậc ấn</dt><dd>${bacBadge(s.tier)} <span class="muted">bậc thấp nhất trong các ấn đang tính</span></dd>
        <dt>Mốc 2</dt><dd>${heSoText(s.factor)}</dd>
        <dt>Mốc 4</dt><dd>${heSoText(s.factor4)}</dd>
        ${s.lo.length ? `<dt>Lộ</dt><dd>${esc(loText(s.lo))}</dd>` : ""}
        ${rel.length ? `<dt>Quan hệ</dt><dd>${rel.join("<br>")}</dd>` : ""}
      </dl>
      <p class="nv-note">Chữ ở các mốc là số ở bậc ${BAC_TEN.tim}; hệ số trên nhân vào mốc 2 và mốc 4.</p>
      ${msList(s.milestones)}`,
  };
}

/** Hình binh ấn theo binh bộ (assets/icon_ve/binh_an/<id>.webp). */
export function binhAnArt(ma: string): string | undefined {
  try {
    return artUrl(`binh_an/${binhBoOf(ma).id}`);
  } catch {
    return undefined;
  }
}

/** Bảng binh bộ ở cột công (Đạo Cơ Bàn). */
export function binhBoBlock(b: BinhBoView | undefined): string {
  if (!b) return `<p class="nv-note">Chưa có binh ấn. Khảm binh ấn vào vũ khí, bao tay hoặc ngọc bội để kích binh bộ.</p>`;
  return `<button type="button" class="nv-row set2 binh${b.pieces < 2 ? " tat" : ""}" data-act="binh-bo">
      <span class="set2-l"><span class="set2-top"><b class="lt-set-name">${esc(b.name)}</b> <span class="set2-n">${b.pieces}/3</span> ${bacBadge(b.tier)}${b.dongLo ? `<span class="set2-f" title="Cùng lộ với một bộ đang kích">Đồng lộ</span>` : ""}</span>
      <span class="muted set2-sub"><span>${esc(loText(b.lo))}</span>${b.dongLo ? " · <span>mốc 3 ×1,2</span>" : ""}</span></span>
      ${pips(b.milestones)}</button>`;
}

export function binhBoSheet(b: BinhBoView): { title: string; html: string } {
  return {
    title: `Binh bộ ${b.name} · ${b.pieces}/3`,
    html: `<dl class="kv"><dt>Bậc</dt><dd>${bacBadge(b.tier)}</dd><dt>Lộ</dt><dd>${esc(loText(b.lo))}</dd>
        <dt>Đồng lộ</dt><dd>${b.dongLo ? "Có: mốc 3 ×1,2" : "Chưa: cần một bộ đang kích cùng lộ"}</dd></dl>
      <p class="nv-note">Mỗi người một binh bộ, tính trên 3 ô công (vũ khí, bao tay, ngọc bội).</p>
      ${msList(b.milestones)}`,
  };
}

/** Các dòng của món theo Set 2.0 trong bảng xem món: ấn và bậc, binh ấn, điểm, dòng rèn. */
export function gearSet2Rows(g: GearItem): string {
  const rows: string[] = [];
  if (g.seal) rows.push(`<dt>Ấn bộ</dt><dd>${esc(setName(sealSetOf(g.seal)))} ${bacBadge(g.sealTier ?? "tim")}</dd>`);
  if (g.binhAn) {
    let ten = g.binhAn.ma;
    try {
      ten = binhBoOf(g.binhAn.ma).ten;
    } catch {
      // mã lạ: giữ mã
    }
    rows.push(`<dt>Binh ấn</dt><dd>${esc(ten)} ${bacBadge(g.binhAn.tier)}</dd>`);
  }
  if (g.score !== undefined) rows.push(`<dt>Điểm trang bị</dt><dd><b>${fmt(g.score)}</b></dd>`);
  return rows.join("");
}

/** Dòng rèn: mốc +10, +20, +30; tắt khi nấc tụt dưới mốc. */
export function dongRenHtml(lines: ForgeLineView[] | undefined): string {
  if (!lines?.length) return "";
  const val = (l: ForgeLineView) => (l.unit === "‰" ? `${(l.value / 10).toLocaleString(locale(), { maximumFractionDigits: 1 })}%` : fmt(l.value));
  return `<h3>Dòng rèn</h3><ul class="list dong-ren">${lines
    .map((l) => `<li class="row${l.on ? "" : " muted"}"><span class="moc">+${l.at}</span><span class="grow">${esc(l.label)} +${val(l)}</span><span class="muted">${l.on ? "đang bật" : "tạm tắt (nấc dưới mốc)"}</span></li>`)
    .join("")}</ul>`;
}

/** Tẩy ẩn tốn Linh Văn Thạch (trang_bi.json luat.dongAn.tayAnLinhVanThach). */
export const TAY_AN_GIA = (TRANG_BI.luat as { dongAn: { tayAnLinhVanThach: number } }).dongAn.tayAnLinhVanThach;

/**
 * Dòng ẩn (ngọc bội, đai): "???" tới khi lộ. Có `kho` (món đang mặc) thì kèm nút: chưa lộ điều kiện thì Giám định (1 Giám
 * Định Phù); đã lộ hiệu ứng thì Tẩy ẩn (giữ điều kiện, quay lại hiệu ứng). Nút gửi data-a="giam" | "tay-an" kèm data-i.
 */
export function dongAnHtml(lines: HiddenLineView[] | undefined, kho?: { phu: number; linhVan: number }): string {
  if (!lines?.length) return "";
  const head = kho ? ` <span class="muted">Giám Định Phù: ${kho.phu} · Linh Văn Thạch: ${fmt(kho.linhVan)}</span>` : "";
  return `<h3>Dòng ẩn${head}</h3><ul class="list dong-an">${lines
    .map((l, i) => {
      const dk = l.dk ? esc(l.dkText ?? l.dk) : `<span class="an">???</span>`;
      const hu = l.hu ? esc(l.huText ?? l.hu) : `<span class="an">???</span>`;
      const nut = !kho
        ? ""
        : !l.dk
          ? `<button type="button" class="btn small" data-a="giam" data-i="${i}"${kho.phu > 0 ? "" : " disabled"}>Giám định</button>`
          : l.hu
            ? `<button type="button" class="btn small" data-a="tay-an" data-i="${i}"${kho.linhVan >= TAY_AN_GIA ? "" : " disabled"}>Tẩy ẩn · ${TAY_AN_GIA}</button>`
            : "";
      return `<li class="row"><span class="grow"><span class="block"><span class="muted">Khi</span> ${dk}</span><span class="block"><span class="muted">thì</span> ${hu}${l.songAn ? ` <span class="song-an" title="Ngọc bội và đai cùng điều kiện: cả hai hiệu ứng ×1,25">Song ẩn</span>` : ""}</span></span>${nut}</li>`;
    })
    .join("")}</ul>
    <p class="nv-note">Điều kiện lộ sau Giám Định Phù hoặc lần kích phát đầu; hiệu ứng lộ sau lần kích phát đầu.</p>`;
}

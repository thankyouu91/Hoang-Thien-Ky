// Tổng quan: số người chơi thử, phiên mỗi ngày, phễu FTUE 8 bước, giữ chân D1/D7, sự kiện GDD mục 19.

import type { DsSuKien, SuKien, TongQuan } from "../../shared/hopDong.ts";
import { BUOC_FTUE, LOAI_SU_KIEN, MUC_TIEU } from "../../shared/hopDong.ts";
import { api } from "../api.ts";
import { chipNguon, esc, gio, ngayDai, ngayNgan, pct, so } from "../ui.ts";
import type { Man } from "./man.ts";

export const manTongQuan: Man = {
  id: "tong-quan",
  ten: "Tổng quan",
  mo_ta: "Số liệu chơi thử so với mốc closed beta (GDD mục 19)",
  async ve(el, ctx) {
    let soNgay = 14;
    let loai = "";
    const [tq, sk] = await Promise.all([api.get<TongQuan>(`/api/tong-quan?ngay=${soNgay}`), api.get<DsSuKien>("/api/su-kien")]);
    if (!ctx.conHieuLuc()) return;
    let suKien = sk;

    const ve = (tq: TongQuan) => {
      const nc = tq.nguoi_choi;
      const ftueXong = tq.ftue[tq.ftue.length - 1] ?? 0;
      const ftueDau = tq.ftue[0] ?? 0;
      el.innerHTML = `<div class="panel">
        <div class="filters"><div class="seg" role="group" aria-label="Khoảng ngày">
          ${[7, 14, 30].map((n) => `<button type="button" data-ngay="${n}" aria-pressed="${n === soNgay}">${n} ngày</button>`).join("")}
        </div>${chipNguon(tq.nguon)}</div>

        <section class="card"><h2>Người chơi thử</h2>
          <div class="metrics">
            ${metric("Người chơi thử", so.format(nc.tong), nc.khoa ? `đã vào bằng link mời · ${nc.khoa} đang khóa` : "đã vào bằng link mời")}
            ${metric("Chơi hôm nay", so.format(nc.hom_nay), "giờ Việt Nam")}
            ${metric("Link mời đang mở", so.format(nc.link_mo), "còn lượt, còn hạn, chưa tắt")}
            ${metricMucTieu("Phiên mỗi người mỗi ngày", tq.phien_moi_nguoi.toLocaleString("vi-VN"), tq.phien_moi_nguoi >= MUC_TIEU.phien_ngay, `mốc ≥ ${MUC_TIEU.phien_ngay}`)}
          </div>
        </section>

        <div class="cols">
          <div class="col">
            <section class="card"><h2>Phiên mỗi ngày <span class="right">${tq.theo_ngay.length} ngày gần nhất</span></h2>
              ${bieuDoNgay(tq.theo_ngay)}
              <details class="note"><summary>Xem dạng bảng</summary>${bangNgay(tq.theo_ngay)}</details>
            </section>
            <section class="card"><h2>Phễu FTUE <span class="right">hoàn thành ${pct(ftueXong, ftueDau)} · mốc ≥ ${MUC_TIEU.ftue * 100}%</span></h2>
              ${pheu(tq.ftue)}
              <p class="note">Mỗi bước đếm số máy (mã ẩn danh của trình duyệt) có sự kiện <code>ftue_buoc</code> của bước đó. Phần trăm so với bước 1; chữ đỏ là chỗ rơi nhiều nhất. Bước 2–8 chờ game gắn sự kiện (docs/api.md).</p>
            </section>
          </div>
          <div class="col">
            <section class="card"><h2>Giữ chân</h2>
              <div class="metrics" style="grid-template-columns:1fr 1fr">
                ${metricMucTieu("Quay lại ngày 1 (D1)", pct(tq.giu_chan.d1.tu, tq.giu_chan.d1.mau), tq.giu_chan.d1.mau > 0 && tq.giu_chan.d1.tu / tq.giu_chan.d1.mau >= MUC_TIEU.d1, `${tq.giu_chan.d1.tu}/${tq.giu_chan.d1.mau} người · mốc ≥ ${MUC_TIEU.d1 * 100}%`)}
                ${metricMucTieu("Quay lại ngày 7 (D7)", pct(tq.giu_chan.d7.tu, tq.giu_chan.d7.mau), tq.giu_chan.d7.mau > 0 && tq.giu_chan.d7.tu / tq.giu_chan.d7.mau >= MUC_TIEU.d7, `${tq.giu_chan.d7.tu}/${tq.giu_chan.d7.mau} người · mốc ≥ ${MUC_TIEU.d7 * 100}%`)}
              </div>
              <p class="note">Tính theo ngày chơi đầu của từng máy (mã ẩn danh, giờ Việt Nam); chỉ đếm máy đã đủ 1 hoặc 7 ngày.</p>
            </section>
            <section class="card" id="su-kien"></section>
          </div>
        </div>
      </div>`;
      veSuKien();
      ganTip(el);
    };

    const veSuKien = () => {
      const box = el.querySelector<HTMLElement>("#su-kien");
      if (!box) return;
      const max = Math.max(1, ...suKien.dem.map((d) => d.so));
      box.innerHTML = `<h2>Sự kiện <span class="right">${chipNguon(suKien.nguon)}</span></h2>
        <div class="hbars" role="group" aria-label="Lọc theo loại sự kiện">
          ${suKien.dem
            .map(
              (d) =>
                `<button type="button" class="r" data-loai="${esc(d.loai)}" aria-pressed="${d.loai === loai}" title="${esc(d.loai)}"><span class="nowrap" style="overflow:hidden;text-overflow:ellipsis">${esc(LOAI_SU_KIEN[d.loai] ?? d.loai)}</span><span class="track"><i style="width:${(d.so / max) * 100}%"></i></span><span class="v">${so.format(d.so)}</span></button>`,
            )
            .join("") || `<div class="empty">Chưa có sự kiện nào.</div>`}
        </div>
        <h3 class="muted" style="margin:var(--sp-4) 0 var(--sp-1)">${loai ? `Mới nhất · ${esc(LOAI_SU_KIEN[loai] ?? loai)} <button class="link" type="button" data-bo-loc>bỏ lọc</button>` : "Mới nhất"}</h3>
        <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Lúc</th><th>Loại</th><th>Máy</th><th>Dữ liệu</th></tr></thead>
        <tbody>${suKien.dong.map(dongSuKien).join("") || `<tr><td colspan="4" class="empty">Không có sự kiện.</td></tr>`}</tbody></table></div>
        ${suKien.con ? `<div class="btns" style="margin-top:var(--sp-2)"><button class="btn small" type="button" data-them>Tải thêm</button></div>` : ""}`;
    };

    // Gắn một lần cho cả màn; vẽ lại phần trong không gắn thêm.
    el.addEventListener("click", async (e) => {
      const t = e.target as HTMLElement;
      const nutNgay = t.closest<HTMLButtonElement>("[data-ngay]");
      const nutLoai = t.closest<HTMLButtonElement>("[data-loai]");
      if (nutNgay) {
        soNgay = Number(nutNgay.dataset.ngay);
        const moi = await api.get<TongQuan>(`/api/tong-quan?ngay=${soNgay}`);
        if (ctx.conHieuLuc()) ve(moi);
      } else if (nutLoai || t.closest("[data-bo-loc]")) {
        loai = nutLoai && nutLoai.dataset.loai !== loai ? nutLoai.dataset.loai! : "";
        suKien = await api.get<DsSuKien>(`/api/su-kien${loai ? `?loai=${encodeURIComponent(loai)}` : ""}`);
        if (ctx.conHieuLuc()) veSuKien();
      } else if (t.closest("[data-them]")) {
        const cuoi = suKien.dong[suKien.dong.length - 1]?.id;
        const them = await api.get<DsSuKien>(`/api/su-kien?truoc=${encodeURIComponent(cuoi ?? "")}${loai ? `&loai=${encodeURIComponent(loai)}` : ""}`);
        suKien = { ...them, dem: suKien.dem, dong: [...suKien.dong, ...them.dong] };
        if (ctx.conHieuLuc()) veSuKien();
      }
    });

    ve(tq);
  },
};

function metric(nhan: string, gt: string, phu: string): string {
  return `<div class="metric"><span>${esc(nhan)}</span><b>${esc(gt)}</b>${phu ? `<em>${esc(phu)}</em>` : ""}</div>`;
}
function metricMucTieu(nhan: string, gt: string, dat: boolean, phu: string): string {
  return `<div class="metric"><span>${esc(nhan)}</span><b>${esc(gt)}</b><em class="${gt === "—" ? "" : dat ? "dat" : "chua"}">${gt === "—" ? "chưa đủ ngày để tính · " : dat ? "Đạt · " : "Chưa đạt · "}${esc(phu)}</em></div>`;
}

/** Cột phiên mỗi ngày: một chuỗi, một màu; cột nhạt phía sau là số người. Rê chuột hiện số. */
function bieuDoNgay(rows: TongQuan["theo_ngay"]): string {
  const W = 640;
  const H = 180;
  const L = 30;
  const B = 22;
  const max = Math.max(1, ...rows.map((r) => r.phien));
  const buoc = Math.max(1, Math.ceil(max / 4 / 5) * 5);
  const top = Math.ceil(max / buoc) * buoc;
  const cw = (W - L) / rows.length;
  const bw = Math.max(3, Math.min(26, cw - 4));
  const y = (v: number) => H - B - (v / top) * (H - B - 8);
  const grid = [];
  for (let v = 0; v <= top; v += buoc) grid.push(`<line x1="${L}" x2="${W}" y1="${y(v)}" y2="${y(v)}"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${v}</text>`);
  const nhanMoi = Math.ceil(rows.length / 8);
  const bars = rows
    .map((r, i) => {
      const x = L + i * cw + (cw - bw) / 2;
      const h = Math.max(r.phien ? 2 : 0, H - B - y(r.phien));
      const tip = `${ngayDai(r.ngay)}: ${r.phien} phiên · ${r.nguoi} người`;
      return `<g data-tip="${esc(tip)}"><rect class="hit" x="${L + i * cw}" y="0" width="${cw}" height="${H - B}"/>
        <path class="bar" d="${cot(x, H - B, bw, h)}"/>
        ${i % nhanMoi === 0 || i === rows.length - 1 ? `<text class="lbl" x="${x + bw / 2}" y="${H - 6}" text-anchor="middle">${ngayNgan(r.ngay)}</text>` : ""}</g>`;
    })
    .join("");
  return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Số phiên mỗi ngày"><g class="grid axis">${grid.join("")}</g>${bars}</svg></div>
    <p class="note" style="margin-top:2px">Rê chuột lên cột để xem số phiên và số người chơi của ngày đó.</p>`;
}

/** Cột có đầu bo 4 px, chân vuông trên trục. */
function cot(x: number, day: number, w: number, h: number): string {
  if (h <= 0) return "";
  const r = Math.min(4, w / 2, h);
  return `M${x},${day}V${day - h + r}Q${x},${day - h} ${x + r},${day - h}H${x + w - r}Q${x + w},${day - h} ${x + w},${day - h + r}V${day}Z`;
}

function bangNgay(rows: TongQuan["theo_ngay"]): string {
  return `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Ngày</th><th class="num">Phiên</th><th class="num">Người</th></tr></thead><tbody>
    ${rows
      .slice()
      .reverse()
      .map((r) => `<tr><td>${esc(ngayDai(r.ngay))}</td><td class="num">${r.phien}</td><td class="num">${r.nguoi}</td></tr>`)
      .join("")}</tbody></table></div>`;
}

function pheu(f: number[]): string {
  const dau = Math.max(1, f[0] ?? 0);
  let roiMax = -1;
  let iRoi = -1;
  for (let i = 1; i < f.length; i++) {
    const roi = (f[i - 1] ?? 0) - (f[i] ?? 0);
    if (roi > roiMax) (roiMax = roi), (iRoi = i);
  }
  return `<div class="funnel">${BUOC_FTUE.map((ten, i) => {
    const v = f[i] ?? 0;
    const truocDo = i > 0 ? (f[i - 1] ?? 0) : v;
    const roi = i > 0 && truocDo > 0 ? Math.round(((truocDo - v) / truocDo) * 100) : 0;
    return `<div class="st ${i === iRoi && roiMax > 0 ? "drop" : ""}" title="Bước ${i + 1}: ${esc(ten)} · ${v} người${i > 0 ? ` · rơi ${roi}% so với bước trước` : ""}">
      <span class="i">${i + 1}</span><span class="t">${esc(ten)}</span><span class="track"><i style="width:${(v / dau) * 100}%"></i></span>
      <span class="v">${v} <small>${pct(v, dau)}${i > 0 && roi > 0 ? ` · −${roi}%` : ""}</small></span></div>`;
  }).join("")}</div>`;
}

function dongSuKien(s: SuKien): string {
  const du = s.du_lieu && Object.keys(s.du_lieu).length ? JSON.stringify(s.du_lieu) : "";
  // Mã máy rút gọn 8 ký tự: đủ để thấy các sự kiện cùng một máy, không phải định danh người.
  return `<tr><td class="nowrap">${gio(s.luc)}</td><td class="nowrap">${esc(LOAI_SU_KIEN[s.loai] ?? s.loai)}</td><td class="nowrap" title="Mã ẩn danh của trình duyệt${s.phien_ban ? ` · bản ${esc(s.phien_ban)}` : ""}"><code>${esc((s.an_danh ?? "—").slice(0, 8))}</code></td><td><pre>${esc(du)}</pre></td></tr>`;
}

/** Chú thích nổi khi rê chuột (hoặc chạm) lên cột có data-tip. */
export function ganTip(root: HTMLElement): void {
  root.querySelectorAll<HTMLElement>(".chart").forEach((chart) => {
    const tip = document.createElement("div");
    tip.className = "tip";
    tip.hidden = true;
    chart.append(tip);
    const show = (e: PointerEvent) => {
      const g = (e.target as Element).closest<SVGGElement>("g[data-tip]");
      chart.querySelectorAll("g.on").forEach((x) => x !== g && x.classList.remove("on"));
      if (!g) return void (tip.hidden = true);
      g.classList.add("on");
      const box = chart.getBoundingClientRect();
      const r = g.querySelector(".hit")!.getBoundingClientRect();
      tip.textContent = g.dataset.tip!;
      tip.style.left = `${Math.min(box.width - 80, Math.max(80, r.left - box.left + r.width / 2))}px`;
      tip.style.top = `${Math.max(24, (g.querySelector(".bar")?.getBoundingClientRect().top ?? r.top) - box.top)}px`;
      tip.hidden = false;
    };
    chart.addEventListener("pointermove", show);
    chart.addEventListener("pointerdown", show);
    chart.addEventListener("pointerleave", () => {
      tip.hidden = true;
      chart.querySelectorAll("g.on").forEach((x) => x.classList.remove("on"));
    });
  });
}

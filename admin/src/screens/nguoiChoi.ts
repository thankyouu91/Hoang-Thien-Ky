// Người chơi thử: vào game bằng link mời https://thienhoangky.fun/moi/<ma>, không qua Access, không có email.
// Màn có hai phần: link mời (tạo, sửa, tắt, xem đã dùng) và người chơi thử (mã, link nào, lần đầu/cuối, số phiên,
// ghi chú, khóa). Khóa ghi thẳng nguoi_choi_thu.khoa: Worker game chặn ngay ở yêu cầu kế tiếp.

import type { DsNguoiChoi, LoiMoi, NguoiChoi, TrangThaiLink } from "../../shared/hopDong.ts";
import { LINK_MOI_GOC } from "../../shared/hopDong.ts";
import { api } from "../api.ts";
import { chipNguon, esc, fromLocalInput, gio, hopThoai, toLocalInput, toast, truoc, voiNut, xacNhan } from "../ui.ts";
import type { Man } from "./man.ts";

type Loc = "tat_ca" | "mo" | "khoa";

const TEN_TT: Record<TrangThaiLink, [string, string]> = {
  mo: ["Đang mở", "ok"],
  tat: ["Đã tắt", "plain"],
  het_luot: ["Hết lượt", "warn"],
  het_han: ["Hết hạn", "warn"],
};

export const manNguoiChoi: Man = {
  id: "nguoi-choi",
  ten: "Người chơi thử",
  mo_ta: "Link mời và người chơi đã vào bằng link",
  async ve(el, ctx) {
    const laAdmin = ctx.toi.vai_tro === "admin";
    let ds = await api.get<DsNguoiChoi>("/api/nguoi-choi");
    if (!ctx.conHieuLuc()) return;
    let loc: Loc = "tat_ca";
    let theoLink = "";
    let tim = "";

    const tai = async () => {
      ds = await api.get<DsNguoiChoi>("/api/nguoi-choi");
      if (ctx.conHieuLuc()) veHet();
    };

    el.innerHTML = `<div class="panel">
      <div class="filters">${chipNguon(ds.nguon, "bảng link mời và người chơi")}</div>
      <div class="cols">
        <div class="col"><section class="card" id="link"></section></div>
        <div class="col">
          ${
            laAdmin
              ? `<section class="card primary"><h2>Tạo link mời</h2>${formLink()}</section>`
              : `<p class="note block">Vận hành xem và chép link, ghi chú người chơi; tạo, sửa, tắt link và khóa người chơi do Admin làm.</p>`
          }
          <section class="card"><h2>Cách dùng</h2>
            <ol class="steps">
              <li>Gửi link cho nhóm chơi thử (Discord, Zalo…). Mỗi trình duyệt mở link thành một người chơi thử, mã 10 ký tự.</li>
              <li>Link hết lượt, hết hạn hoặc bị tắt thì người mới không vào được; người đã vào vẫn chơi tiếp.</li>
              <li>Muốn chặn một người: khóa mã của họ ở bảng dưới. Game chặn ngay ở lần tải hoặc lần gọi kế tiếp.</li>
            </ol>
          </section>
        </div>
      </div>
      <section class="card"><h2>Người chơi thử <span class="right" id="dem"></span></h2>
        <div class="filters" style="margin-bottom:var(--sp-3)">
          <input type="search" placeholder="Tìm mã, ghi chú" data-tim aria-label="Tìm">
          <select data-theo-link aria-label="Theo link"></select>
          <div class="seg" role="group" aria-label="Lọc">
            ${(
              [
                ["tat_ca", "Tất cả"],
                ["mo", "Đang chơi được"],
                ["khoa", "Đang khóa"],
              ] as [Loc, string][]
            )
              .map(([k, t]) => `<button type="button" data-loc="${k}" aria-pressed="${k === loc}">${t}</button>`)
              .join("")}
          </div>
        </div>
        <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Mã</th><th>Link</th><th>Lần đầu</th><th>Lần cuối</th><th class="num" title="Số lần mở game (sự kiện mo_phien)">Phiên</th><th>Ghi chú</th><th>Trạng thái</th><th></th></tr></thead><tbody id="bang"></tbody></table></div>
      </section>
    </div>`;
    const f = el.querySelector<HTMLFormElement>("form[data-tao]");
    if (f) ganFormLink(f, async (body) => {
      const r = await api.post<{ ma: string; link: string }>("/api/loi-moi", body);
      f.reset();
      await tai();
      hienLinkMoi(r.link, body.ten);
    });

    const veLink = () => {
      const box = el.querySelector<HTMLElement>("#link")!;
      const dangMo = ds.link.filter((l) => l.trang_thai === "mo").length;
      box.innerHTML = `<h2>Link mời <span class="right">${dangMo}/${ds.link.length} đang mở</span></h2>
        <div class="items">${ds.link.map((l) => theLink(l, laAdmin, ds.dong.filter((n) => n.ma_moi === l.ma).length)).join("") || `<div class="empty">${laAdmin ? "Chưa có link nào. Tạo link ở khung bên cạnh." : "Chưa có link nào."}</div>`}</div>`;
    };

    const veBang = () => {
      const sel = el.querySelector<HTMLSelectElement>("[data-theo-link]")!;
      sel.innerHTML = `<option value="">Mọi link</option>${ds.link.map((l) => `<option value="${esc(l.ma)}" ${l.ma === theoLink ? "selected" : ""}>${esc(l.ten)}</option>`).join("")}`;
      const ten = new Map(ds.link.map((l) => [l.ma, l.ten]));
      const q = tim.toLowerCase();
      const rows = ds.dong.filter((n) => {
        if (loc === "mo" && n.khoa) return false;
        if (loc === "khoa" && !n.khoa) return false;
        if (theoLink && n.ma_moi !== theoLink) return false;
        return !q || [n.id, n.ghi_chu, ten.get(n.ma_moi)].some((v) => (v ?? "").toLowerCase().includes(q));
      });
      el.querySelector("#dem")!.textContent = `${rows.length}/${ds.dong.length} người · ${ds.dong.filter((n) => n.khoa).length} khóa`;
      el.querySelector("#bang")!.innerHTML =
        rows.map((n) => dong(n, ten.get(n.ma_moi) ?? n.ma_moi, laAdmin)).join("") ||
        `<tr><td colspan="8" class="empty">${ds.dong.length ? "Không có ai khớp bộ lọc." : "Chưa có ai vào bằng link mời."}</td></tr>`;
    };

    const veHet = () => {
      veLink();
      veBang();
    };

    el.addEventListener("input", (e) => {
      const t = e.target as HTMLInputElement;
      if (t.matches("[data-tim]")) (tim = t.value.trim()), veBang();
    });
    el.addEventListener("change", (e) => {
      const t = e.target as HTMLSelectElement;
      if (t.matches("[data-theo-link]")) (theoLink = t.value), veBang();
    });
    el.addEventListener("click", async (e) => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>("button");
      if (!b) return;
      if (b.dataset.loc) {
        loc = b.dataset.loc as Loc;
        el.querySelectorAll<HTMLButtonElement>("[data-loc]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
        return veBang();
      }
      const ma = b.closest<HTMLElement>("[data-ma]")?.dataset.ma;
      const l = ds.link.find((x) => x.ma === ma);
      if (l) {
        if (b.matches("[data-chep]")) return chep(LINK_MOI_GOC + l.ma, "Đã chép link mời.");
        if (b.matches("[data-loc-link]")) {
          theoLink = l.ma;
          veBang();
          el.querySelector("#bang")?.closest("section")?.scrollIntoView({ behavior: "smooth", block: "start" });
          return;
        }
        if (b.matches("[data-tat]")) {
          const tat = !l.tat;
          const ok = await xacNhan(
            tat ? "Tắt link mời" : "Mở lại link mời",
            tat ? `Tắt "<b>${esc(l.ten)}</b>": người mới mở link sẽ không vào được. Người đã vào vẫn chơi tiếp.` : `Mở lại "<b>${esc(l.ten)}</b>" cho người mới.`,
            tat ? "Tắt link" : "Mở lại",
          );
          if (!ok) return;
          await voiNut(b, async () => {
            await api.post("/api/loi-moi/tat", { ma: l.ma, tat });
            toast(tat ? "Đã tắt link." : "Đã mở lại link.");
            await tai();
          });
          return;
        }
        if (b.matches("[data-sua-link]")) {
          hopThoai(`Sửa link "${l.ten}"`, formLink(l), (d) => {
            ganFormLink(d.querySelector("form")!, async (body) => {
              await api.post("/api/loi-moi/sua", { ...body, ma: l.ma });
              d.close();
              toast("Đã lưu link.");
              await tai();
            });
          });
          return;
        }
      }
      const id = b.closest<HTMLElement>("[data-id]")?.dataset.id;
      const n = ds.dong.find((x) => x.id === id);
      if (!n) return;
      if (b.matches("[data-ghi-chu]")) return suaGhiChu(n, tai);
      if (b.matches("[data-khoa]")) {
        const khoa = !n.khoa;
        const ok = await xacNhan(
          khoa ? "Khóa người chơi" : "Mở khóa người chơi",
          khoa
            ? `Khóa <code>${esc(n.id)}</code>: game chặn trình duyệt này ngay ở lần tải hoặc lần gọi kế tiếp. Tiến độ trong trình duyệt của họ không bị xóa.`
            : `Mở khóa <code>${esc(n.id)}</code> để chơi tiếp.`,
          khoa ? "Khóa" : "Mở khóa",
          khoa ? "Lý do (ghi vào nhật ký)" : undefined,
        );
        if (!ok) return;
        await voiNut(b, async () => {
          await api.post("/api/nguoi-choi/khoa", { id: n.id, khoa, ly_do: ok.lyDo });
          toast(khoa ? `Đã khóa ${n.id}.` : `Đã mở khóa ${n.id}.`);
          await tai();
        });
      }
    });

    veHet();
  },
};

function theLink(l: LoiMoi, laAdmin: boolean, soNguoi: number): string {
  const [tt, chip] = TEN_TT[l.trang_thai];
  const luot = l.toi_da === null ? `${l.da_dung} lượt · không giới hạn` : `${l.da_dung}/${l.toi_da} lượt`;
  const pct = l.toi_da ? Math.min(100, (l.da_dung / l.toi_da) * 100) : 0;
  return `<article class="item" data-ma="${esc(l.ma)}" ${l.trang_thai === "mo" ? "" : 'style="opacity:.75"'}>
    <header><span class="chip ${chip}">${tt}</span><b style="color:var(--c-ink);font-size:var(--fs-md)">${esc(l.ten)}</b><span class="right">${esc(luot)}</span></header>
    <div class="btns" style="flex-wrap:nowrap"><code class="grow" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(LINK_MOI_GOC + l.ma)}</code><button class="btn small" type="button" data-chep>Chép link</button></div>
    ${l.toi_da ? `<div class="hbars" style="margin-top:6px"><div class="r" style="grid-template-columns:1fr"><span class="track"><i style="width:${pct}%"></i></span></div></div>` : ""}
    <p class="note">${l.het_han ? `Hết hạn ${gio(l.het_han)}` : "Không hết hạn"} · tạo bởi ${esc(l.tao_boi)} lúc ${gio(l.tao_luc)}${l.sua_boi ? ` · sửa bởi ${esc(l.sua_boi)} lúc ${gio(l.sua_luc)}` : ""}</p>
    <div class="btns" style="margin-top:var(--sp-2)">
      <button class="btn small" type="button" data-loc-link>Xem ${soNguoi} người</button>
      ${laAdmin ? `<button class="btn small" type="button" data-sua-link>Sửa</button><button class="btn small ${l.tat ? "" : "danger"}" type="button" data-tat>${l.tat ? "Mở lại" : "Tắt link"}</button>` : ""}
    </div>
  </article>`;
}

function dong(n: NguoiChoi, tenLink: string, laAdmin: boolean): string {
  return `<tr data-id="${esc(n.id)}" class="${n.khoa ? "khoa" : ""}">
    <td class="nowrap"><code>${esc(n.id)}</code>${n.so_phan_hoi ? `<br><span class="muted">${n.so_phan_hoi} phản hồi</span>` : ""}</td>
    <td>${esc(tenLink)}</td>
    <td class="nowrap">${gio(n.lan_dau)}</td>
    <td class="nowrap" title="${gio(n.lan_cuoi)}">${esc(truoc(n.lan_cuoi))}</td>
    <td class="num">${n.so_phien}</td>
    <td style="min-width:12rem">${n.ghi_chu ? esc(n.ghi_chu) : `<span class="muted">—</span>`}</td>
    <td>${n.khoa ? `<span class="chip son">Khóa</span>${n.ly_do_khoa ? `<br><span class="muted">${esc(n.ly_do_khoa)}</span>` : ""}` : `<span class="chip ok">Chơi được</span>`}</td>
    <td><div class="btns" style="justify-content:flex-end;flex-wrap:nowrap">
      <button class="btn small" type="button" data-ghi-chu>Ghi chú</button>
      ${laAdmin ? `<button class="btn small ${n.khoa ? "" : "danger"}" type="button" data-khoa>${n.khoa ? "Mở khóa" : "Khóa"}</button>` : ""}
    </div></td></tr>`;
}

function formLink(l?: LoiMoi): string {
  return `<form class="form" ${l ? "" : "data-tao"} novalidate>
    <label class="f"><span>Tên link</span><input type="text" name="ten" maxlength="80" required value="${esc(l?.ten ?? "")}" placeholder="ví dụ: Discord đợt 1"><small>Chỉ admin thấy, để biết link phát ở đâu.</small></label>
    <div class="row2">
      <label class="f"><span>Số người tối đa</span><input type="number" name="toi_da" min="1" max="10000" step="1" value="${l?.toi_da ?? ""}"><small>Để trống là không giới hạn.</small></label>
      <label class="f"><span>Hết hạn</span><input type="datetime-local" name="het_han" value="${l?.het_han ? toLocalInput(l.het_han) : ""}"><small>Để trống là không hết hạn. Giờ Việt Nam.</small></label>
    </div>
    <div class="btns"><button class="seal" type="submit">${l ? "Lưu" : "Tạo link"}</button>${l ? `<button class="btn" type="button" data-dong>Thôi</button>` : ""}</div>
  </form>`;
}

function ganFormLink(f: HTMLFormElement, gui: (b: { ten: string; toi_da: number | null; het_han: number | null }) => Promise<void>): void {
  f.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(f);
    const ten = String(fd.get("ten") ?? "").trim();
    const td = String(fd.get("toi_da") ?? "").trim();
    const body = { ten, toi_da: td ? Number(td) : null, het_han: fromLocalInput(String(fd.get("het_han") ?? "")) };
    if (!ten) return toast("Cần tên link.", true);
    if (body.toi_da !== null && (!Number.isInteger(body.toi_da) || body.toi_da < 1)) return toast("Số người tối đa là số nguyên từ 1.", true);
    await voiNut(f.querySelector<HTMLButtonElement>(".seal"), () => gui(body));
  });
}

function hienLinkMoi(link: string, ten: string): void {
  hopThoai(
    "Link mời đã tạo",
    `<p style="margin:0">${esc(ten)}</p><input type="text" readonly value="${esc(link)}" aria-label="Link mời">
     <p class="note">Gửi link này cho người chơi thử. Ai mở link (khi còn lượt, còn hạn) là vào được game, không cần đăng nhập Access.</p>
     <div class="btns"><button class="seal" type="button" data-chep-moi>Chép link</button><button class="btn" type="button" data-dong>Đóng</button></div>`,
    (d) => {
      d.querySelector("[data-chep-moi]")!.addEventListener("click", () => chep(link, "Đã chép link mời."));
      d.querySelector<HTMLInputElement>("input")!.addEventListener("focus", (e) => (e.target as HTMLInputElement).select());
    },
  );
}

function suaGhiChu(n: NguoiChoi, tai: () => Promise<void>): void {
  hopThoai(
    "Ghi chú người chơi",
    `<form class="form"><p class="muted" style="margin:0">Mã <code>${esc(n.id)}</code> · chỉ admin và vận hành thấy.</p>
      <label class="f"><span>Ghi chú</span><textarea name="ghi_chu" maxlength="1000" placeholder="ví dụ: bạn của Minh, chơi trên iPhone">${esc(n.ghi_chu ?? "")}</textarea><small>Không ghi số điện thoại hay thông tin định danh nếu không cần.</small></label>
      <div class="btns"><button class="seal" type="submit">Lưu</button><button class="btn" type="button" data-dong>Thôi</button></div></form>`,
    (d) => {
      const f = d.querySelector("form")!;
      f.addEventListener("submit", async (e) => {
        e.preventDefault();
        const fd = new FormData(f);
        await voiNut(f.querySelector<HTMLButtonElement>(".seal"), async () => {
          await api.post("/api/nguoi-choi/ghi-chu", { id: n.id, ghi_chu: fd.get("ghi_chu") });
          d.close();
          toast("Đã lưu ghi chú.");
          await tai();
        });
      });
    },
  );
}

export async function chep(text: string, bao: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    toast(bao);
  } catch {
    hopThoai("Chép tay", `<textarea readonly style="min-height:160px">${esc(text)}</textarea>`);
  }
}

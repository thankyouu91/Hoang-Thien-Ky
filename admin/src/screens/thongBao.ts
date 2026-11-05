// Thông báo hiện ở Động phủ: soạn, hẹn giờ (bắt đầu, kết thúc), lưu nháp, sửa, gỡ.
// Worker game đọc qt_thong_bao: trang_thai = 'dang' và đang trong khoảng giờ (admin/README.md).

import type { HienTB, ThongBao } from "../../shared/hopDong.ts";
import { api } from "../api.ts";
import { esc, fromLocalInput, gio, hopThoai, toLocalInput, toast, voiNut, xacNhan } from "../ui.ts";
import type { Man } from "./man.ts";

const TEN_HIEN: Record<HienTB, [string, string]> = {
  nhap: ["Nháp", "plain"],
  hen: ["Hẹn giờ", "warn"],
  dang_hien: ["Đang hiện", "ok"],
  het_han: ["Hết hạn", "plain"],
  da_go: ["Đã gỡ", "plain"],
};

export const manThongBao: Man = {
  id: "thong-bao",
  ten: "Thông báo",
  mo_ta: "Hiện ở Động phủ của người chơi thử",
  async ve(el, ctx) {
    let ds = (await api.get<{ dong: ThongBao[] }>("/api/thong-bao")).dong;
    if (!ctx.conHieuLuc()) return;
    const tai = async () => {
      ds = (await api.get<{ dong: ThongBao[] }>("/api/thong-bao")).dong;
      if (ctx.conHieuLuc()) veDs();
    };

    el.innerHTML = `<div class="panel"><div class="cols">
      <div class="col"><section class="card primary"><h2>Soạn thông báo</h2>${form()}</section></div>
      <div class="col"><section class="card"><h2>Đã soạn <span class="right" id="dem"></span></h2><div class="items" id="ds"></div></section></div>
    </div></div>`;
    const f = el.querySelector<HTMLFormElement>("form")!;
    ganForm(f, async (body) => {
      await api.post("/api/thong-bao", body);
      toast(body.dang ? (body.bat_dau && body.bat_dau > Date.now() ? "Đã hẹn giờ đăng." : "Đã đăng lên Động phủ.") : "Đã lưu nháp.");
      f.reset();
      xemTruoc(f);
      await tai();
    });

    const veDs = () => {
      el.querySelector("#dem")!.textContent = `${ds.filter((t) => t.hien === "dang_hien").length} đang hiện · ${ds.filter((t) => t.hien === "hen").length} hẹn giờ`;
      el.querySelector("#ds")!.innerHTML = ds.map(the).join("") || `<div class="empty">Chưa có thông báo nào.</div>`;
    };

    el.addEventListener("click", async (e) => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>("button");
      const id = Number(b?.closest<HTMLElement>("[data-id]")?.dataset.id);
      const tb = ds.find((x) => x.id === id);
      if (!b || !tb) return;
      if (b.matches("[data-go]")) {
        const ok = await xacNhan("Gỡ thông báo", `Gỡ "<b>${esc(tb.tieu_de)}</b>" khỏi Động phủ. Gỡ rồi không đăng lại được; muốn hiện lại thì soạn bản mới.`, "Gỡ");
        if (!ok) return;
        await voiNut(b, async () => {
          await api.post("/api/thong-bao/go", { id });
          toast("Đã gỡ.");
          await tai();
        });
      }
      if (b.matches("[data-sua]")) {
        hopThoai(`Sửa thông báo #${tb.id}`, form(tb), (d) => {
          const f2 = d.querySelector("form")!;
          xemTruoc(f2);
          ganForm(f2, async (body) => {
            await api.post("/api/thong-bao/sua", { ...body, id });
            d.close();
            toast("Đã lưu thông báo.");
            await tai();
          });
        });
      }
    });

    veDs();
  },
};

function form(tb?: ThongBao): string {
  const batDau = tb && tb.bat_dau > Date.now() ? toLocalInput(tb.bat_dau) : "";
  return `<form class="form" novalidate>
    <label class="f"><span>Tiêu đề</span><input type="text" name="tieu_de" maxlength="80" required value="${esc(tb?.tieu_de ?? "")}"></label>
    <label class="f"><span>Nội dung</span><textarea name="noi_dung" maxlength="1000" required>${esc(tb?.noi_dung ?? "")}</textarea><small>Tối đa 1.000 ký tự, giữ ngắn như mọi chữ trên Động phủ.</small></label>
    <div class="row2">
      <label class="f"><span>Bắt đầu hiện</span><input type="datetime-local" name="bat_dau" value="${batDau}"><small>Để trống là hiện ngay khi đăng. Giờ Việt Nam.</small></label>
      <label class="f"><span>Thôi hiện</span><input type="datetime-local" name="ket_thuc" value="${tb?.ket_thuc ? toLocalInput(tb.ket_thuc) : ""}"><small>Để trống là hiện tới khi gỡ.</small></label>
    </div>
    <label class="check"><input type="checkbox" name="quan_trong" ${tb?.muc === "quan_trong" ? "checked" : ""}> Quan trọng (viền son, xếp trên cùng)</label>
    <div><span class="muted">Xem trước ở Động phủ</span><div class="tb-xem" data-xem></div></div>
    <div class="btns"><button class="seal" type="submit" data-dang="1">${tb?.trang_thai === "dang" ? "Lưu và giữ đăng" : "Đăng"}</button><button class="btn" type="submit" data-dang="0">${tb?.trang_thai === "dang" ? "Chuyển về nháp" : "Lưu nháp"}</button></div>
  </form>`;
}

interface ThanTB {
  tieu_de: string;
  noi_dung: string;
  muc: "thuong" | "quan_trong";
  bat_dau: number | null;
  ket_thuc: number | null;
  dang: boolean;
}

function ganForm(f: HTMLFormElement, gui: (b: ThanTB) => Promise<void>): void {
  f.addEventListener("input", () => xemTruoc(f));
  f.addEventListener("submit", async (e) => {
    e.preventDefault();
    const nut = (e as SubmitEvent).submitter as HTMLButtonElement | null;
    const fd = new FormData(f);
    const body: ThanTB = {
      tieu_de: String(fd.get("tieu_de") ?? "").trim(),
      noi_dung: String(fd.get("noi_dung") ?? "").trim(),
      muc: fd.get("quan_trong") ? "quan_trong" : "thuong",
      bat_dau: fromLocalInput(String(fd.get("bat_dau") ?? "")),
      ket_thuc: fromLocalInput(String(fd.get("ket_thuc") ?? "")),
      dang: nut?.dataset.dang === "1",
    };
    if (!body.tieu_de || !body.noi_dung) return toast("Cần tiêu đề và nội dung.", true);
    if (body.ket_thuc && body.ket_thuc <= (body.bat_dau ?? Date.now())) return toast("Giờ thôi hiện phải sau giờ bắt đầu.", true);
    await voiNut(nut, () => gui(body));
  });
  xemTruoc(f);
}

function xemTruoc(f: HTMLFormElement): void {
  const fd = new FormData(f);
  const box = f.querySelector<HTMLElement>("[data-xem]")!;
  box.className = `tb-xem ${fd.get("quan_trong") ? "quan_trong" : ""}`;
  const t = String(fd.get("tieu_de") ?? "").trim();
  const n = String(fd.get("noi_dung") ?? "").trim();
  box.innerHTML = t || n ? `<b>${esc(t || "(chưa có tiêu đề)")}</b><div style="white-space:pre-wrap">${esc(n)}</div>` : `<span class="muted">Gõ tiêu đề và nội dung để xem trước.</span>`;
}

function the(t: ThongBao): string {
  const [ten, chip] = TEN_HIEN[t.hien];
  const moTa =
    t.hien === "hen"
      ? `hiện từ ${gio(t.bat_dau)}`
      : t.hien === "dang_hien"
        ? `từ ${gio(t.bat_dau)}${t.ket_thuc ? ` tới ${gio(t.ket_thuc)}` : ", tới khi gỡ"}`
        : t.hien === "het_han"
          ? `đã thôi hiện ${gio(t.ket_thuc)}`
          : t.hien === "da_go"
            ? `gỡ bởi ${esc(t.go_boi ?? "")} lúc ${gio(t.go_luc)}`
            : `chưa đăng`;
  return `<article class="item" data-id="${t.id}" ${t.hien === "da_go" ? 'style="opacity:.6"' : ""}>
    <header><span class="chip ${chip}">${ten}</span>${t.muc === "quan_trong" ? `<span class="chip son">Quan trọng</span>` : ""}<span>${moTa}</span><span class="right">#${t.id}</span></header>
    <h3>${esc(t.tieu_de)}</h3><div class="body">${esc(t.noi_dung)}</div>
    <p class="note">Soạn bởi ${esc(t.tao_boi)} lúc ${gio(t.tao_luc)}${t.sua_boi ? ` · sửa bởi ${esc(t.sua_boi)} lúc ${gio(t.sua_luc)}` : ""}</p>
    ${t.hien !== "da_go" ? `<div class="btns" style="margin-top:var(--sp-2)"><button class="btn small" type="button" data-sua>Sửa</button><button class="btn small danger" type="button" data-go>Gỡ</button></div>` : ""}
  </article>`;
}

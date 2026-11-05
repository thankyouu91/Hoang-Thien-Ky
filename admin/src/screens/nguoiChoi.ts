// Người chơi thử: email được mời, lần chơi cuối, số phiên, ghi chú, khóa/mở. Danh sách cổng thật nằm trong Access
// (ứng dụng game); có API token thì server tự ghi Access Group, chưa có thì màn hướng dẫn dán tay.

import type { DongBo, DsNguoiChoi, NguoiChoi } from "../../shared/hopDong.ts";
import { api } from "../api.ts";
import { esc, gio, hopThoai, toast, truoc, voiNut, xacNhan } from "../ui.ts";
import type { Man } from "./man.ts";

type Loc = "tat_ca" | "mo" | "khoa" | "chua_choi" | "ngoai";

export const manNguoiChoi: Man = {
  id: "nguoi-choi",
  ten: "Người chơi thử",
  mo_ta: "Danh sách mời chơi thử kín, ghi chú và khóa",
  async ve(el, ctx) {
    const laAdmin = ctx.toi.vai_tro === "admin";
    let ds = await api.get<DsNguoiChoi>("/api/nguoi-choi");
    if (!ctx.conHieuLuc()) return;
    let loc: Loc = "tat_ca";
    let tim = "";

    const tai = async () => {
      ds = await api.get<DsNguoiChoi>("/api/nguoi-choi");
      if (ctx.conHieuLuc()) veBang();
    };

    el.innerHTML = `<div class="panel">
      <div class="cols">
        <div class="col">
          ${
            laAdmin
              ? `<section class="card primary"><h2>Mời người chơi</h2>
            <form class="form" data-moi>
              <label class="f"><span>Email</span><textarea name="emails" placeholder="mỗi dòng một email, hoặc cách nhau dấu phẩy" required></textarea><small>Tối đa 200 email mỗi lần. Email đã có sẽ bỏ qua.</small></label>
              <label class="f"><span>Ghi chú chung (không bắt buộc)</span><input type="text" name="ghi_chu" maxlength="500" placeholder="ví dụ: nhóm bạn đợt 1"></label>
              <div class="btns"><button class="seal" type="submit">Thêm vào danh sách mời</button></div>
            </form></section>`
              : `<p class="note block">Vận hành xem danh sách và ghi chú; mời, khóa và bỏ mời do Admin làm.</p>`
          }
        </div>
        <div class="col"><section class="card" id="access"></section></div>
      </div>
      <section class="card"><h2>Danh sách <span class="right" id="dem"></span></h2>
        <div class="filters" style="margin-bottom:var(--sp-3)">
          <input type="search" placeholder="Tìm email, tên gọi, ghi chú" data-tim aria-label="Tìm">
          <div class="seg" role="group" aria-label="Lọc">
            ${(
              [
                ["tat_ca", "Tất cả"],
                ["mo", "Đang mở"],
                ["khoa", "Đang khóa"],
                ["chua_choi", "Chưa chơi"],
                ["ngoai", "Ngoài danh sách"],
              ] as [Loc, string][]
            )
              .map(([k, t]) => `<button type="button" data-loc="${k}" aria-pressed="${k === loc}">${t}</button>`)
              .join("")}
          </div>
          <span id="nguon"></span>
        </div>
        <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Email</th><th>Lần chơi cuối</th><th class="num" title="Số lần mở game (sự kiện mo_phien)">Phiên</th><th>Ghi chú</th><th>Trạng thái</th><th></th></tr></thead><tbody id="bang"></tbody></table></div>
      </section>
    </div>`;

    const veAccess = () => {
      const box = el.querySelector<HTMLElement>("#access")!;
      box.innerHTML = khoiAccess(ds.dong_bo, ds.danh_sach_access, laAdmin, "game");
    };

    const veBang = () => {
      veAccess();
      const q = tim.toLowerCase();
      const rows = ds.dong.filter((n) => {
        if (loc === "mo" && (n.khoa || !n.da_moi)) return false;
        if (loc === "khoa" && !n.khoa) return false;
        if (loc === "chua_choi" && n.lan_cuoi) return false;
        if (loc === "ngoai" && n.da_moi) return false;
        return !q || [n.email, n.ten_goi, n.ghi_chu].some((v) => (v ?? "").toLowerCase().includes(q));
      });
      const ngoai = ds.dong.filter((n) => !n.da_moi).length;
      el.querySelector("#dem")!.textContent = `${rows.length}/${ds.dong.length} email · ${ds.dong.filter((n) => n.khoa).length} khóa${ngoai ? ` · ${ngoai} ngoài danh sách` : ""}`;
      el.querySelector("#nguon")!.innerHTML = ds.nguon === "mau" ? `<span class="chip mau" title="Lần chơi và số phiên lấy từ bảng nguoi_choi_thu của Worker game, chưa có trong D1 này.">Chưa có bảng nguoi_choi_thu: lần chơi và số phiên để trống</span>` : "";
      el.querySelector("#bang")!.innerHTML =
        rows.map((n) => dong(n, laAdmin)).join("") ||
        `<tr><td colspan="6" class="empty">${ds.dong.length ? "Không có email nào khớp bộ lọc." : laAdmin ? "Chưa mời ai. Thêm email ở khung Mời người chơi." : "Chưa mời ai."}</td></tr>`;
    };

    el.addEventListener("input", (e) => {
      const t = e.target as HTMLInputElement;
      if (t.matches("[data-tim]")) {
        tim = t.value.trim();
        veBang();
      }
    });
    el.addEventListener("submit", async (e) => {
      const f = e.target as HTMLFormElement;
      if (!f.matches("[data-moi]")) return;
      e.preventDefault();
      const fd = new FormData(f);
      await voiNut(f.querySelector("button"), async () => {
        const r = await api.post<{ moi: number; da_co: number; dong_bo: DongBo }>("/api/nguoi-choi/moi", { emails: String(fd.get("emails")), ghi_chu: String(fd.get("ghi_chu") ?? "") });
        toast(`Đã thêm ${r.moi} email${r.da_co ? `, ${r.da_co} email đã có` : ""}. ${baoDongBo(r.dong_bo)}`, r.dong_bo.da_noi && r.dong_bo.ok === false);
        f.reset();
        await tai();
      });
    });
    el.addEventListener("click", async (e) => {
      const t = e.target as HTMLElement;
      const b = t.closest<HTMLButtonElement>("button");
      if (!b) return;
      if (b.dataset.loc) {
        loc = b.dataset.loc as Loc;
        el.querySelectorAll<HTMLButtonElement>("[data-loc]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
        return veBang();
      }
      if (b.matches("[data-chep]")) return chep(b.dataset.chep === "game" ? ds.danh_sach_access : []);
      if (b.matches("[data-dong-bo]")) {
        await voiNut(b, async () => {
          const r = await api.post<DongBo>("/api/access/dong-bo", { nhom: "nguoi_choi" });
          toast(baoDongBo(r), r.ok === false);
          await tai();
        });
        return;
      }
      const email = b.closest<HTMLElement>("[data-email]")?.dataset.email;
      const n = ds.dong.find((x) => x.email === email);
      if (!n) return;
      if (b.matches("[data-sua]")) return suaGhiChu(n, tai);
      if (b.matches("[data-them-ds]")) {
        await voiNut(b, async () => {
          const r = await api.post<{ moi: number; dong_bo: DongBo }>("/api/nguoi-choi/moi", { emails: n.email });
          toast(`Đã thêm ${n.email} vào danh sách mời. ${baoDongBo(r.dong_bo)}`, r.dong_bo.da_noi && r.dong_bo.ok === false);
          await tai();
        });
        return;
      }
      if (b.matches("[data-khoa]")) {
        const khoa = !n.khoa;
        const ok = await xacNhan(
          khoa ? "Khóa người chơi" : "Mở khóa người chơi",
          khoa
            ? `Khóa <b>${esc(n.email)}</b>: Worker game từ chối email này${ds.dong_bo.da_noi ? " và Access group bỏ email ra" : "; nhớ bỏ email khỏi Access nếu muốn chặn cả cổng vào"}.`
            : `Mở khóa <b>${esc(n.email)}</b> để chơi tiếp${ds.dong_bo.da_noi ? "" : "; nếu đã bỏ khỏi Access thì thêm lại"}.`,
          khoa ? "Khóa" : "Mở khóa",
          khoa ? "Lý do (ghi vào nhật ký)" : undefined,
        );
        if (!ok) return;
        await voiNut(b, async () => {
          const r = await api.post<{ dong_bo: DongBo }>("/api/nguoi-choi/khoa", { email: n.email, khoa, ly_do: ok.lyDo });
          toast(`${khoa ? "Đã khóa" : "Đã mở khóa"} ${n.email}. ${baoDongBo(r.dong_bo)}`, r.dong_bo.da_noi && r.dong_bo.ok === false);
          await tai();
        });
      }
      if (b.matches("[data-bo]")) {
        const ok = await xacNhan("Bỏ mời", `Bỏ <b>${esc(n.email)}</b> khỏi danh sách mời. Ghi chú của email này mất theo; tiến độ chơi nằm trong trình duyệt người chơi, không bị xóa.`, "Bỏ mời");
        if (!ok) return;
        await voiNut(b, async () => {
          const r = await api.post<{ dong_bo: DongBo }>("/api/nguoi-choi/bo", { email: n.email });
          toast(`Đã bỏ mời ${n.email}. ${baoDongBo(r.dong_bo)}`, r.dong_bo.da_noi && r.dong_bo.ok === false);
          await tai();
        });
      }
    });

    veBang();
  },
};

function dong(n: NguoiChoi, laAdmin: boolean): string {
  if (!n.da_moi) {
    return `<tr data-email="${esc(n.email)}" class="sel">
    <td><span class="email">${esc(n.email)}</span><br><span class="muted">vào game lần đầu ${gio(n.lan_dau)}</span></td>
    <td class="nowrap" title="${gio(n.lan_cuoi)}">${esc(truoc(n.lan_cuoi))}</td>
    <td class="num">${n.so_phien}</td>
    <td><span class="muted">Có trong Access nhưng không có trong danh sách mời (thường là Admin, Vận hành, hoặc được thêm thẳng vào Access).</span></td>
    <td><span class="chip warn">Ngoài danh sách</span></td>
    <td><div class="btns" style="justify-content:flex-end;flex-wrap:nowrap">${laAdmin ? `<button class="btn small" type="button" data-them-ds>Thêm vào danh sách</button>` : ""}</div></td></tr>`;
  }
  return `<tr data-email="${esc(n.email)}" class="${n.khoa ? "khoa" : ""}">
    <td><span class="email">${esc(n.email)}</span>${n.ten_goi ? `<br><span class="muted">${esc(n.ten_goi)}</span>` : ""}<br><span class="muted">mời ${gio(n.moi_luc)}${n.lan_dau ? ` · vào lần đầu ${gio(n.lan_dau)}` : ""}</span></td>
    <td class="nowrap" title="${gio(n.lan_cuoi)}">${esc(truoc(n.lan_cuoi))}</td>
    <td class="num">${n.so_phien}</td>
    <td style="min-width:12rem">${n.ghi_chu ? esc(n.ghi_chu) : `<span class="muted">—</span>`}</td>
    <td>${n.khoa ? `<span class="chip son">Khóa</span>${n.ly_do_khoa ? `<br><span class="muted">${esc(n.ly_do_khoa)}</span>` : ""}` : `<span class="chip ok">Đang mở</span>`}</td>
    <td><div class="btns" style="justify-content:flex-end;flex-wrap:nowrap">
      <button class="btn small" type="button" data-sua>Ghi chú</button>
      ${laAdmin ? `<button class="btn small ${n.khoa ? "" : "danger"}" type="button" data-khoa>${n.khoa ? "Mở khóa" : "Khóa"}</button><button class="btn small danger" type="button" data-bo>Bỏ mời</button>` : ""}
    </div></td></tr>`;
}

function suaGhiChu(n: NguoiChoi, tai: () => Promise<void>): void {
  hopThoai(
    "Ghi chú người chơi",
    `<form class="form"><p class="muted" style="margin:0">${esc(n.email)}</p>
      <label class="f"><span>Tên gọi</span><input type="text" name="ten_goi" maxlength="80" value="${esc(n.ten_goi ?? "")}"></label>
      <label class="f"><span>Ghi chú</span><textarea name="ghi_chu" maxlength="1000">${esc(n.ghi_chu ?? "")}</textarea></label>
      <div class="btns"><button class="seal" type="submit">Lưu</button><button class="btn" type="button" data-dong>Thôi</button></div></form>`,
    (d) => {
      const f = d.querySelector("form")!;
      f.addEventListener("submit", async (e) => {
        e.preventDefault();
        const fd = new FormData(f);
        await voiNut(f.querySelector<HTMLButtonElement>(".seal"), async () => {
          await api.post("/api/nguoi-choi/sua", { email: n.email, ten_goi: fd.get("ten_goi"), ghi_chu: fd.get("ghi_chu") });
          d.close();
          toast("Đã lưu ghi chú.");
          await tai();
        });
      });
    },
  );
}

export function baoDongBo(db: DongBo): string {
  if (!db.da_noi) return "Nhớ cập nhật Access bằng tay.";
  return db.ok ? `Access đã cập nhật (${db.so_email} email).` : `Access CHƯA cập nhật: ${db.loi ?? "lỗi lạ"}.`;
}

/** Khối trạng thái Access: tự đồng bộ hay hướng dẫn làm tay, dùng chung cho Người chơi thử và Phân quyền. */
export function khoiAccess(db: DongBo, emails: string[], laAdmin: boolean, ungDung: "game" | "admin"): string {
  const ten = ungDung === "game" ? "thienhoangky.fun (game)" : "admin.thienhoangky.fun";
  const nhom = ungDung === "game" ? "nguoi_choi" : "quan_tri";
  if (db.da_noi) {
    return `<h2>Access · ${esc(ten)}</h2>
      <p style="margin:0">Tự đồng bộ: mỗi lần ${ungDung === "game" ? "mời, khóa, mở khóa hay bỏ mời" : "phân quyền hay thu quyền"}, server ghi lại Access Group của ứng dụng này.</p>
      <p class="note">Lần cuối: ${db.luc ? gio(db.luc) : "chưa chạy"} ${db.ok === true ? `<span class="chip ok">Đã khớp · ${db.so_email} email</span>` : db.ok === false ? `<span class="chip son">Lỗi</span> ${esc(db.loi ?? "")}` : ""}</p>
      ${laAdmin ? `<div class="btns"><button class="btn small" type="button" data-dong-bo="${nhom}">Đồng bộ lại</button></div>` : ""}`;
  }
  return `<h2>Access · ${esc(ten)} <span class="right"><span class="chip warn">Cập nhật tay</span></span></h2>
    <p style="margin:0">Cổng vào ${esc(ten)} là Cloudflare Access. Admin chưa nối API token nên danh sách trong Access phải sửa tay sau mỗi thay đổi:</p>
    <ol class="steps" style="margin-top:var(--sp-2)">
      <li>Mở <b>one.dash.cloudflare.com</b> → Access → Applications → ứng dụng <b>${esc(ten)}</b> → Policies.</li>
      <li>Ở policy cho phép, mục Include → Emails: dán danh sách dưới đây (thay toàn bộ danh sách cũ).</li>
      <li>Lưu. Người bị bỏ ra mất quyền vào khi phiên Access hiện tại hết hạn${ungDung === "game" ? "; email đang khóa bị Worker game chặn ngay" : "; vai trò trong admin đổi ngay"}.</li>
    </ol>
    <div class="btns" style="margin-top:var(--sp-3)"><button class="btn small" type="button" data-chep="${ungDung}">Chép ${emails.length} email</button></div>
    <p class="note">Muốn tự động: làm theo mục "Đồng bộ Access" trong admin/README.md.</p>`;
}

export async function chep(emails: string[]): Promise<void> {
  try {
    await navigator.clipboard.writeText(emails.join("\n"));
    toast(`Đã chép ${emails.length} email, mỗi dòng một email.`);
  } catch {
    hopThoai("Danh sách email", `<textarea readonly style="min-height:200px">${esc(emails.join("\n"))}</textarea>`);
  }
}

// Giao diện nhập môn (GDD mục 14, FTUE bước 2–8): thẻ Nhiệm vụ nổi trên thanh dưới, mỗi bước tối đa 2 câu và một nút; nút mở
// bảng của bước đó (chọn vùng, gia nhập tông, ghép công pháp, ra trận, chiếm mỏ, đặt nhắc) hoặc màn gieo quẻ ở bia Tầm Đạo
// (linh căn, tài năng, rồi tạo hình). Người chơi tự bấm từng việc; thẻ chỉ chỉ đường. Dùng token và thành phần của
// dashboard.css (thẻ giấy kem, .seal, .btn, .chip, bảng trượt) để khớp giao diện; kiểu riêng ở moi.css.
import "./moi.css";
import type { Element, SkillType } from "@ktlp/sim";
import TAI_NANG from "../../../../data/he_thong/json/tai_nang.json";
import type { AuthSource } from "../auth.ts";
import type { Nav } from "../shell.ts";
import { artUrl, assetUrl, clockText, closeSheet, durationText, elementChip, esc, openSheet, skillChip, toast } from "../ui.ts";
import type { FtueChiTiet, NguonTheoTaiKhoan } from "./nguonMoi.ts";
import { AO, tenNgauNhien, THAN, type Ao, type Than } from "./theGioiMoi.ts";
import { TEN_HE } from "./ftue.ts";

export interface FtueHost {
  nguon: NguonTheoTaiKhoan;
  auth: AuthSource;
  nav: Nav;
  /** Đọc lại màn đang mở sau một việc. */
  reload(): void;
}

const TEN_THAN: Record<Than, string> = { nam_khoe: "Nam, khỏe", nam_manh: "Nam, mảnh", nu_khoe: "Nữ, khỏe", nu_manh: "Nữ, mảnh" };
const TEN_AO: Record<Ao, string> = { dao_bao: "Đạo bào", vo_phuc: "Võ phục" };
const TALENTS = TAI_NANG as Record<string, { id: string; name: string; combat: string; economy?: string; perk?: string }>;
const NHAC_TRUOC = 5 * 60_000;

const giam = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Gắn thẻ Nhiệm vụ nhập môn; trả hàm báo đổi màn để ẩn thẻ trong màn Trận. */
export function moFtue(host: FtueHost): { capNhat(): void; onShow(sceneId: string): void; moBuoc(): Promise<void> } {
  const el = document.createElement("aside");
  el.id = "ftue";
  el.setAttribute("aria-live", "polite");
  document.body.append(el);
  document.body.classList.add("nguoi-moi");
  let scene = "";
  let cu = "";
  /** Chỉ ghi lại thẻ khi nội dung đổi, để nút không bị thay giữa lúc đang chạm. */
  const ve = (html: string) => {
    if (html !== cu) el.innerHTML = cu = html;
  };

  const capNhat = async () => {
    if (!host.auth.session() || scene === "tran") {
      el.hidden = true;
      document.body.classList.remove("co-ftue");
      return;
    }
    const src = await host.nguon.get();
    const f = src.ftue();
    if (f.anThe) {
      el.hidden = true;
      document.body.classList.remove("co-ftue");
      return;
    }
    el.hidden = false;
    document.body.classList.add("co-ftue");
    el.classList.toggle("gon", f.thuGon);
    const pct = Math.round((f.xong / f.tong) * 100);
    if (f.thuGon) {
      ve(`<button type="button" class="ftue-pill" data-f="mo">${f.buoc ? `Nhiệm vụ ${f.buoc.so}/${f.tong} · ${esc(f.buoc.ten)}` : "Nhập Thế · xong"}</button>`);
      return;
    }
    if (!f.buoc) {
      const ke = f.ke ? `Nhiệm vụ kế: ${esc(f.ke.ten)} (${f.ke.mo ? "chưa có trong bản chơi thử" : `mở ở cấp ${f.ke.minLevel}`}).` : "";
      ve(`
        <div class="ftue-dau"><span class="ftue-so">Nhập Thế · ${f.tong}/${f.tong}</span><b>Đã xong 15 phút đầu</b></div>
        <p>Bạn đã có tông môn, công pháp và mỏ đầu tiên. ${ke}</p>
        <div class="ftue-hang"><span></span><button type="button" class="btn small" data-f="an">Đóng thẻ</button></div>
        <div class="ftue-tien"><i style="width:100%"></i></div>`);
      return;
    }
    const b = f.buoc;
    const thuong = src.thuong(b.id);
    ve(`
      <button type="button" class="ftue-thu icon-btn" data-f="gon" aria-label="Thu gọn thẻ nhiệm vụ">–</button>
      <div class="ftue-dau"><span class="ftue-so">Nhập Thế · ${b.so}/${f.tong}</span><b>${esc(b.ten)}</b></div>
      <p>${esc(b.loi)}</p>
      <div class="ftue-hang"><span class="ftue-thuong">${thuong ? `Thưởng: ${esc(thuong)}` : ""}</span><button type="button" class="seal small" data-f="lam" data-viec="${b.viec}">${esc(b.nut)}</button></div>
      <div class="ftue-tien" title="${f.xong}/${f.tong}"><i style="width:${pct}%"></i></div>`);
  };

  const sau = (r: { ok: boolean; message?: string; error?: string; battleId?: number }) => {
    if (!r.ok) {
      toast(baoLoi(r.error), true);
      return;
    }
    if (r.message) toast(r.message);
    closeSheet();
    void capNhat();
    if (r.battleId) host.nav.go({ screen: "tran", battleId: r.battleId });
    else host.reload();
  };

  const lam = async (viec: string, arg?: Record<string, unknown>) => sau((await host.nguon.get()).lam(viec, arg));

  const moViec = async (viec: string) => {
    const src = await host.nguon.get();
    const ct = await src.chiTiet();
    switch (viec) {
      case "chon_vung":
        return bangVung(ct, (code) => void lam("chon_vung", { vung: code }));
      case "gieo_que":
        return void manGieoQue(ct, async (look, name) => {
          const r = (await host.nguon.get()).lam("tao_hinh", { ...look, name });
          sau(r);
          return r.ok;
        }, () => (src.lam("gieo_que").ok ? true : (toast("Đã gieo quẻ rồi", true), false)));
      case "gia_nhap":
        return bangTong(ct, () => void lam("gia_nhap"));
      case "ghep":
        return bangGhep(ct, () => void lam("ghep"));
      case "thu_chieu":
        return bangThuChieu(ct, () => void lam("thu_chieu"));
      case "chiem_mo":
        return bangChiemMo(ct, () => void lam("chiem_mo"), () => host.nav.go({ screen: "ban-do", pointId: ct.mo.pointId }));
      case "thu_mo": {
        const r = await src.send({ type: "thu_mo" });
        return sau(r.ok ? { ok: true, message: r.message } : { ok: false, error: r.error });
      }
      case "dat_nhac":
        return bangNhac(ct, () => void lam("dat_nhac"));
    }
  };

  el.addEventListener("click", (e) => {
    const t = (e.target as HTMLElement).closest<HTMLElement>("[data-f]");
    if (!t) return;
    const f = t.dataset.f;
    if (f === "lam") void moViec(t.dataset.viec!);
    else if (f === "gon" || f === "mo") void host.nguon.get().then((s) => (s.lam("thu_gon", { on: f === "gon" }), capNhat()));
    else if (f === "an") void host.nguon.get().then((s) => (s.lam("an_the"), capNhat()));
  });

  // Nút "Chơi lại từ đầu" ở mục Tài khoản (màn Nhân vật).
  document.addEventListener("click", (e) => {
    const t = (e.target as HTMLElement).closest<HTMLElement>('[data-act="choi-lai"]');
    if (t) {
      e.stopPropagation();
      bangChoiLai(() => {
        host.nguon.choiLai();
        location.reload();
      });
    }
  }, true);

  // Lời nhắc bí cảnh đã đặt ở 0.7: báo trong trang khi còn 5 phút hoặc đang mở.
  setInterval(() => {
    void host.nguon.get().then((s) => {
      const at = s.moi.nhacBiCanh;
      const now = Date.now();
      if (!at || (s.moi.daNhacLuc ?? 0) >= at - NHAC_TRUOC || now < at - NHAC_TRUOC || now > at + 30 * 60_000) return;
      toast(now < at ? `Bí cảnh mở lúc ${clockText(at)}, còn ${durationText(at - now)}` : "Bí cảnh đang mở, vào ở Bản đồ");
      s.lam("da_nhac");
    });
  }, 30_000);

  void capNhat();
  setInterval(() => void capNhat(), 4_000);
  return {
    capNhat: () => void capNhat(),
    onShow(id: string) {
      scene = id;
      void capNhat();
    },
    // Dòng nhiệm vụ ở Việc nên làm hay Tin báo (Go "nhiem-vu"): mở đúng việc của bước đang làm, như nút trên thẻ nổi.
    async moBuoc() {
      const f = (await host.nguon.get()).ftue();
      if (f.buoc) return void moViec(f.buoc.viec);
      const ke = f.ke;
      openSheet("Nhiệm vụ chính", `
        <p>${ke ? `Nhiệm vụ kế: ${esc(ke.ten)} (${ke.mo ? "chưa có trong bản chơi thử" : `mở ở cấp ${ke.minLevel}`}).` : "Bạn đã xong các nhiệm vụ có trong bản chơi thử."}</p>
        <p class="moi-nho">Trong lúc chờ: học công pháp truyền thụ ở Công pháp, thu mỏ ở Tông môn, bế quan ở Nhân vật.</p>`);
    },
  };
}

const LOI: Record<string, string> = {
  khong_dung_buoc: "Chưa tới bước này của nhiệm vụ.",
  vung_chua_mo: "Vùng này chưa mở ở bản chơi thử.",
  ten_khong_hop_le: "Đạo hiệu cần 2–16 ký tự.",
  da_co_tong: "Bạn đã ở trong một tông môn.",
  chua_co_cong_phap: "Cần ghép công pháp đầu tiên trước.",
  khong_co_tan_quyen: "Không còn tàn quyển tặng trong túi.",
};
function baoLoi(e?: string): string {
  return (e && LOI[e]) ?? `Chưa làm được (${e ?? "lỗi"})`;
}

// ---- Bảng từng bước -----------------------------------------------------------------------------------------------

function bangVung(ct: FtueChiTiet, chon: (code: string) => void): void {
  let pick = ct.vung.find((v) => v.goiY && v.mo)?.code ?? "";
  const row = (v: FtueChiTiet["vung"][number]) => `
      <li><button type="button" class="row moi-vung-row" data-vung="${v.code}" ${v.mo ? "" : "disabled"} aria-pressed="${v.code === pick}">
        <span class="moi-vung-ten"><b>${esc(v.name)}</b>${v.goiY ? '<em class="moi-tag">Gợi ý · ít người</em>' : ""}</span>
        <span class="moi-vung-he"><span class="moi-nho">Hệ chủ đạo</span>${elementChip(v.element as Element)}</span>
        <span class="moi-vung-he"><span class="moi-nho">Tàn quyển hay rơi</span>${v.drops.map((d) => elementChip(d as Element)).join("")}</span>
        <span class="moi-nho">Thành chủ ${esc(v.capital)}</span>
      </button></li>`;
  const mo = ct.vung.filter((v) => v.mo);
  const khoa = ct.vung.filter((v) => !v.mo);
  // Nút chính đặt ngay sau các vùng mở được (và dính đáy bảng); vùng chưa mở gom vào một dòng thu gọn bên dưới.
  const body = openSheet("Chọn vùng bắt đầu", `
    <p class="moi-ghi">Vùng quyết định hệ chủ đạo và tàn quyển hay rơi. Vùng ít người xếp đầu và đã chọn sẵn.</p>
    <ul class="list moi-vung">${mo.map(row).join("")}</ul>
    <div class="actions moi-actions"><button type="button" class="seal wide" data-ok>Đến thành chủ</button></div>
    ${khoa.length ? `<details class="moi-khoa"><summary>${khoa.length} vùng chưa mở ở bản chơi thử</summary><ul class="list moi-vung">${khoa.map(row).join("")}</ul></details>` : ""}`);
  body.addEventListener("click", (e) => {
    const t = e.target as HTMLElement;
    const o = t.closest<HTMLButtonElement>("[data-vung]");
    if (o && !o.disabled) {
      pick = o.dataset.vung!;
      body.querySelectorAll("[data-vung]").forEach((b) => b.setAttribute("aria-pressed", String((b as HTMLElement).dataset.vung === pick)));
    }
    if (t.closest("[data-ok]") && pick) chon(pick);
  });
}

function bangTong(ct: FtueChiTiet, ok: () => void): void {
  const t = ct.tong;
  const body = openSheet("Tông môn gợi ý", `
    <section class="card moi-tong">
      <h3>${esc(t.name)}</h3>
      <p class="moi-nho">${elementChip(t.element as Element)} Cấp ${t.level} · Chính phái · ${t.members} thành viên</p>
      <ul class="moi-ds">
        <li><span>Tông chủ</span><b>${esc(t.tongChu)}</b></li>
        <li><span>Sơn môn</span><b>${esc(t.sonMon)}, cấp nguy hiểm ${t.danger}</b></li>
        <li><span>Truyền thụ</span><b>${t.techniques.map(esc).join(", ")}</b></li>
        <li><span>Chức vị khi vào</span><b>Ngoại môn đệ tử (7 ngày đầu)</b></li>
      </ul>
      <p class="moi-ghi">Vào tông thì thành chủ nhà chuyển về vùng của tông; truyền tống thẳng về sơn môn qua Truyền Tống Trận.</p>
    </section>
    <div class="actions moi-actions">
      <button type="button" class="seal wide" data-ok>Gia nhập ${esc(t.name)}</button>
      <button type="button" class="btn wide" disabled>Tự lập tông môn (mở ở cấp ${t.capLapTong}, bạn đang cấp ${t.level0})</button>
    </div>`);
  body.querySelector("[data-ok]")!.addEventListener("click", ok);
}

const TEN_CHIEU: Record<string, string> = {
  can_don: "Cận chiến đơn", can_quet: "Cận chiến quét", tam_xa: "Tầm xa", dien_rong: "Diện rộng", ho_the: "Hộ thể",
  bua_chu: "Bùa chú", tran_phap: "Trận pháp", hoi_phuc: "Hồi phục", khong_che: "Khống chế", than_phap: "Thân pháp",
};

function bangGhep(ct: FtueChiTiet, ok: () => void): void {
  const g = ct.ghep;
  if (!g) {
    openSheet("Tàng Kinh Các", `<p>Không còn tàn quyển tặng trong túi.</p>`);
    return;
  }
  const quyen = (k: { kind: string; element: string }, vai: string) => `
    <div class="moi-quyen"><img src="${artUrl(`tan_quyen/${k.element}`)}" alt="" onerror="this.remove()"><span class="moi-nho">${vai}</span>
      ${elementChip(k.element as Element)}<span class="moi-nho">${esc(TEN_CHIEU[k.kind.split(".")[1]] ?? "")}</span></div>`;
  const root = { du: "Hệ chủ trùng linh căn: nhận đủ buff của hệ.", nua: "Hệ phụ trùng linh căn: nhận một nửa buff.", khong: "Không trùng linh căn: chưa nhận buff hệ." }[g.rootMatch];
  const body = openSheet("Hai mảnh một quyển", `
    <p class="moi-ghi">Hai tàn quyển tặng sẵn ghép được ngay, không cần nộp vào Tàng Kinh Các. Công pháp tân thủ chỉ chủ nhân dùng.</p>
    <div class="moi-ghep">${quyen(g.main, "Chủ quyển")}<span class="moi-cong">+</span>${quyen(g.sub, "Phụ quyển")}</div>
    <section class="card moi-kq">
      <h3>${esc(g.ten)}</h3>
      <p>${skillChip(g.type as SkillType)} <span>Phẩm Phàm</span></p>
      <p class="moi-nho">D ${g.damage} · ${g.targets} mục tiêu · hồi ${g.cd.toLocaleString("vi-VN")} s · ${g.mana} mana</p>
      <p class="moi-nho">${root}</p>
    </section>
    <div class="actions moi-actions"><button type="button" class="seal wide" data-ok>Ghép và mang vào trận</button></div>`);
  body.querySelector("[data-ok]")!.addEventListener("click", ok);
}

function bangThuChieu(ct: FtueChiTiet, ok: () => void): void {
  const body = openSheet("Thử chiêu", `
    <section class="card">
      <p>3 dị thú hệ ${esc(ct.thuChieu.foe)} quanh sơn môn. Bạn đi cùng 2 đồng môn.</p>
      <p class="moi-nho">${esc(ct.thuChieu.home)} khắc ${esc(ct.thuChieu.foe)}: công pháp hệ ${esc(ct.thuChieu.home)} đánh trúng gây sát thương ×1,5. Trận tự đánh, bạn xem lại được ở Chiến báo.</p>
    </section>
    <div class="actions moi-actions"><button type="button" class="seal wide" data-ok>Ra trận</button></div>`);
  body.querySelector("[data-ok]")!.addEventListener("click", ok);
}

function bangChiemMo(ct: FtueChiTiet, ok: () => void, xem: () => void): void {
  const m = ct.mo;
  const body = openSheet("Mỏ đầu tiên", `
    <section class="card">
      <h3>${esc(m.name)}</h3>
      <p class="moi-nho">Mỏ linh thạch cấp ${m.level} · ${m.perHour} linh thạch mỗi giờ · ${esc(m.by)} đang canh · cách sơn môn 1 chặng</p>
      <p>Cùng 3 đồng môn đánh dị thú canh mỏ. Thắng thì mỏ về tay tông, sản lượng vào Bảo Khố.</p>
    </section>
    <div class="actions moi-actions"><button type="button" class="seal wide" data-ok>Đánh chiếm</button><button type="button" class="btn wide" data-xem>Xem trên bản đồ</button></div>`);
  body.querySelector("[data-ok]")!.addEventListener("click", ok);
  body.querySelector("[data-xem]")!.addEventListener("click", xem);
}

function bangNhac(ct: FtueChiTiet, ok: () => void): void {
  const at = ct.biCanhKe;
  const hom = new Date(at).toDateString() === new Date().toDateString() ? "hôm nay" : "ngày mai";
  const body = openSheet("Giờ mở cửa", `
    <section class="card">
      <p>Bí cảnh kế mở lúc ${clockText(at)} ${hom}, còn ${esc(durationText(at - Date.now()))}. Mỗi khung mở 30 phút.</p>
      <p class="moi-nho">Game nhắc bạn trước 5 phút khi đang mở trang. Khung giờ cũng nằm ở thẻ Lịch của Động phủ.</p>
    </section>
    <div class="actions moi-actions"><button type="button" class="seal wide" data-ok>Nhắc tôi</button></div>`);
  body.querySelector("[data-ok]")!.addEventListener("click", ok);
}

function bangChoiLai(ok: () => void): void {
  const body = openSheet("Chơi lại từ đầu", `
    <p>Mất hết tiến độ trên máy này của tài khoản đang chơi: cấp, đồ, tông môn, nhiệm vụ. Bạn bắt đầu lại từ cấp 1 và không hoàn tác được.</p>
    <div class="actions moi-actions"><button type="button" class="seal wide" data-ok>Chơi lại từ cấp 1</button><button type="button" class="btn wide" data-close>Thôi</button></div>`);
  body.querySelector("[data-ok]")!.addEventListener("click", ok);
}

// ---- Gieo quẻ ở bia Tầm Đạo và tạo hình -----------------------------------------------------------------------------

/**
 * Màn phủ cả trang: bia đá, vòng 12 hệ quay chậm dần rồi dừng ở linh căn (hai linh căn thì quay hai lần), sau đó 8 tài năng
 * lướt qua rồi dừng ở tài năng nhận được. Bước hai chọn thân, áo, đạo hiệu (mọi lựa chọn cùng chỉ số, GDD mục 6).
 */
function manGieoQue(ct: FtueChiTiet, xong: (look: { body: Than; outfit: Ao }, name: string) => Promise<boolean>, gieo: () => boolean): void {
  const que = ct.que!;
  const wrap = document.createElement("div");
  wrap.id = "gieo-que";
  wrap.setAttribute("role", "dialog");
  wrap.setAttribute("aria-modal", "true");
  wrap.setAttribute("aria-label", "Bia Tầm Đạo");
  const els = Object.keys(TEN_HE) as Element[];
  // Bia và 12 nút hệ vẽ Canva (assets/icon_ve/bia_tam_dao, manifest.json cùng thư mục); vòng tròn bán kính R quanh bia.
  const R = 122;
  wrap.innerHTML = `
    <div class="gq-khung">
      <button type="button" class="icon-btn gq-dong" aria-label="Đóng">×</button>
      <h2>Bia Tầm Đạo</h2>
      <p class="gq-loi">Đặt tay lên bia. Quẻ cho bạn linh căn và một tài năng.</p>
      <div class="gq-vong" aria-hidden="true">
        <img class="gq-bia" src="${artUrl("bia_tam_dao/bia")}" alt="">
        ${els.map((e, i) => {
          const a = (i / els.length) * Math.PI * 2 - Math.PI / 2;
          return `<span class="gq-he" data-he="${e}" style="left:calc(50% + ${Math.round(Math.cos(a) * R)}px);top:calc(50% + ${Math.round(Math.sin(a) * R)}px)"><img src="${artUrl(`bia_tam_dao/he/${e}`)}" alt=""><i>${esc(TEN_HE[e])}</i></span>`;
        }).join("")}
      </div>
      <ul class="gq-tai" aria-hidden="true">${Object.values(TALENTS).map((t) => `<li data-tai="${t.id}">${esc(t.name)}</li>`).join("")}</ul>
      <div class="gq-kq" hidden></div>
      <div class="gq-nut"><button type="button" class="seal wide" data-gieo>Gieo quẻ</button></div>
    </div>`;
  document.body.append(wrap);
  const dong = () => wrap.remove();
  wrap.querySelector(".gq-dong")!.addEventListener("click", dong);

  const quay = async (sel: string, attr: string, target: string, buoc: number) => {
    const items = [...wrap.querySelectorAll<HTMLElement>(sel)];
    const end = items.findIndex((x) => x.dataset[attr] === target);
    if (giam()) {
      items.forEach((x, i) => x.classList.toggle("on", i === end));
      return;
    }
    const total = buoc * items.length + ((end - 0 + items.length) % items.length);
    for (let s = 0; s <= total; s++) {
      items.forEach((x, i) => x.classList.toggle("on", i === s % items.length));
      // Chậm dần: 40 ms lúc đầu, tới khoảng 260 ms ở mấy ô cuối.
      await wait(40 + Math.round(220 * Math.pow(s / total, 3)));
    }
  };

  const ketQua = () => {
    const t = TALENTS[que.talent];
    const kq = wrap.querySelector<HTMLElement>(".gq-kq")!;
    kq.hidden = false;
    kq.innerHTML = `
      <p class="gq-goc"><span class="moi-nho">Linh căn</span> ${que.roots.map((e) => `<b><img src="${artUrl(`bia_tam_dao/he/${e}`)}" alt="">${esc(TEN_HE[e])}</b>`).join(" ")}</p>
      <p><span class="moi-nho">Tài năng</span> <b>${esc(t.name)}</b></p>
      <p class="moi-nho">${esc(t.combat)}</p>
      <p class="moi-nho">Luyện công pháp có hệ trùng linh căn thì nhận buff của hệ đó.</p>`;
    wrap.querySelector(".gq-nut")!.innerHTML = `<button type="button" class="seal wide" data-tiep>Tạo hình</button>`;
    wrap.querySelector("[data-tiep]")!.addEventListener("click", taoHinh);
  };

  const taoHinh = () => {
    let look = { ...ct.look };
    const khung = wrap.querySelector(".gq-khung")!;
    khung.classList.add("tao-hinh");
    const ve = () => {
      khung.innerHTML = `
        <button type="button" class="icon-btn gq-dong" aria-label="Đóng">×</button>
        <h2>Tạo hình</h2>
        <p class="gq-loi">Mọi lựa chọn cùng chỉ số; chỉ khác dáng người.</p>
        <div class="th-than">${THAN.map((b) => `
          <button type="button" class="th-o" data-than="${b}" aria-pressed="${b === look.body}">
            <img src="${assetUrl(`nhan_vat/${b}/${look.outfit}`)}" alt=""><span>${TEN_THAN[b]}</span></button>`).join("")}</div>
        <div class="seg th-ao" role="group" aria-label="Áo">${AO.map((o) => `<button type="button" data-ao="${o}" aria-pressed="${o === look.outfit}">${TEN_AO[o]}</button>`).join("")}</div>
        <label class="th-ten"><span class="moi-nho">Đạo hiệu</span>
          <span class="th-ten-o"><input type="text" maxlength="16" value="${esc(ct.name)}" autocomplete="off" spellcheck="false" aria-describedby="th-loi"><button type="button" class="btn small" data-ngau>Đổi</button></span></label>
        <p class="th-loi" id="th-loi" role="alert"></p>
        <div class="gq-nut"><button type="button" class="seal wide" data-xong>Bắt đầu tu đạo</button></div>`;
      khung.querySelector(".gq-dong")!.addEventListener("click", dong);
      kiemTen();
    };
    /** Đạo hiệu 2–16 ký tự: báo ngay dưới ô và khóa nút khi sai (màn này phủ trên toast). */
    const kiemTen = (): boolean => {
      const input = khung.querySelector<HTMLInputElement>(".th-ten input")!;
      const n = input.value.replace(/\s+/g, " ").trim().length;
      const ok = n >= 2 && n <= 16;
      khung.querySelector(".th-loi")!.textContent = ok ? "" : "Đạo hiệu cần 2–16 ký tự.";
      khung.querySelector<HTMLButtonElement>("[data-xong]")!.disabled = !ok;
      return ok;
    };
    ve();
    khung.addEventListener("input", kiemTen);
    khung.addEventListener("click", async (e) => {
      const t = e.target as HTMLElement;
      const input = khung.querySelector<HTMLInputElement>(".th-ten input")!;
      const b = t.closest<HTMLElement>("[data-than]");
      const o = t.closest<HTMLElement>("[data-ao]");
      if (b || o) {
        const name = input.value;
        look = { body: (b?.dataset.than as Than) ?? look.body, outfit: (o?.dataset.ao as Ao) ?? look.outfit };
        ct.name = name;
        ve();
      } else if (t.closest("[data-ngau]")) {
        input.value = tenNgauNhien(Math.random);
        kiemTen();
      } else if (t.closest("[data-xong]")) {
        if (kiemTen() && (await xong(look, input.value))) dong();
      }
    });
  };

  if (que.daGieo) {
    // Đã gieo ở lần mở trước (đóng màn giữa chừng): hiện lại kết quả.
    wrap.querySelectorAll<HTMLElement>(".gq-he").forEach((x) => x.classList.toggle("on", que.roots.includes(x.dataset.he as Element)));
    wrap.querySelectorAll<HTMLElement>(".gq-tai li").forEach((x) => x.classList.toggle("on", x.dataset.tai === que.talent));
    ketQua();
    return;
  }
  wrap.querySelector("[data-gieo]")!.addEventListener("click", async (e) => {
    const btn = e.currentTarget as HTMLButtonElement;
    if (!gieo()) return;
    btn.disabled = true;
    wrap.classList.add("dang-gieo");
    await quay(".gq-he", "he", que.roots[0], 3);
    const first = wrap.querySelector<HTMLElement>(`.gq-he[data-he="${que.roots[0]}"]`)!;
    first.classList.add("giu");
    if (que.roots[1]) await quay(".gq-he:not(.giu)", "he", que.roots[1], 1);
    wrap.querySelectorAll<HTMLElement>(".gq-he").forEach((x) => x.classList.toggle("on", que.roots.includes(x.dataset.he as Element)));
    await quay(".gq-tai li", "tai", que.talent, 2);
    wrap.classList.remove("dang-gieo");
    ketQua();
  });
}

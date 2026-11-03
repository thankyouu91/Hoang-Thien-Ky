// Tông môn: dashboard tông môn (GDD mục 14). Ai cũng thấy số liệu; nút chỉ hiện cho chức vị được làm việc đó (mục 6).
// Thẻ Bảo Khố đặt ngay dưới Lãnh thổ và đếm số ngày còn đủ linh thạch trả phí duy trì (mục 10).
import type { Role } from "@ktlp/rules";
import { POINT_NAMES } from "../../scenes/map/region.ts";
import { loadLocationArt, locationArt, LOCATIONS, pixelArtEnabled, pointArt, sectModels, setPixelArt } from "../art/sectScene.ts";
import { icon } from "../icons.ts";
import { MiniMap } from "../minimap.ts";
import { PageScene, type DashCtx } from "../shell.ts";
import type { TongMonView } from "../source.ts";
import { term } from "../terms.ts";
import { assetUrl, cd, closeSheet, esc, fmt, openSheet, ROLE_NAMES, toast } from "../ui.ts";

export type TongMonTab = "tong-quan" | "son-mon" | "thanh-vien" | "chien-su";

const TABS: [TongMonTab, string][] = [["tong-quan", "Tổng quan"], ["son-mon", "Sơn môn"], ["thanh-vien", "Thành viên"], ["chien-su", "Chiến sự"]];
const DONATE = [100, 500, 1000];
/** Mỏ tích tối đa 24 giờ sản lượng (cùng mức với nguồn mẫu). */
const MINE_CAP_HOURS = 24;
const H = 3600_000;

export class TongMonScene extends PageScene<TongMonView> {
  private tab: TongMonTab = "tong-quan";
  private mini: MiniMap;

  constructor(ctx: DashCtx) {
    super("tong-mon", "Tông môn", ctx);
    this.mini = new MiniMap((x, y) => ctx.nav.go({ screen: "ban-do", at: { x, y } }));
  }

  setTab(t: TongMonTab): void {
    this.tab = t;
    if (this.data) {
      this.render(this.data);
      this.mounted();
    }
  }

  protected async read(): Promise<TongMonView> {
    // Biết công trình nào có hình PixelLab trước khi vẽ (manifest đọc một lần).
    const [v] = await Promise.all([this.ctx.source.tongMon(), loadLocationArt()]);
    return v;
  }

  override enter(): void {
    super.enter();
    this.mini.start();
  }

  override leave(): void {
    super.leave();
    this.mini.stop();
  }

  protected render(v: TongMonView): void {
    const s = v.sect;
    const shield = s.shieldUntil && s.shieldUntil > v.serverNow ? `khiên còn ${cd(s.shieldUntil)}` : "không khiên";
    // Đầu màn: hình Chính Điện của mô hình tông môn; tên, cấp, XP và nút Hiến tế nằm dưới hình để chữ không đè lên tranh.
    const hero = locationArt({ model: s.model, terrain: s.terrainId, location: "chinh_dien" });
    this.page.innerHTML = `<div class="panel">
      <section class="card sect-head">
        <div class="sect-banner${hero.pixel ? " pix" : ""}" style="background-image:url('${hero.url}')" role="img" aria-label="${esc(`Chính Điện của ${s.name}`)}"></div>
        <div class="sect-id">
          <img class="island" src="${assetUrl(s.island)}" alt="">
          <div class="grow"><h1>${esc(s.name)}</h1><div class="sub">Cấp ${s.level} · ${esc(s.regionName)} · ${esc(s.terrain)}</div></div>
          ${v.can.hienTe ? `<button type="button" class="seal small" data-act="donate">Hiến tế</button>` : ""}
        </div>
        <div class="sect-xp"><div class="bar"><i style="width:${Math.min(100, (s.xp / s.xpToNext) * 100).toFixed(1)}%"></i></div><span>${fmt(s.xp)} / ${fmt(s.xpToNext)} XP</span></div>
        <div class="sect-tags"><span class="chip plain">Phe ${esc(s.faction)}</span><span class="chip plain">${shield}</span><span class="chip plain">${s.patron ? `Bảo trợ ${esc(s.patron)}` : "Không bảo trợ"}</span></div>
      </section>
      <div class="seg" role="tablist" aria-label="Tab con">${TABS.map(([id, label]) => `<button type="button" role="tab" data-act="tab" data-tab="${id}" aria-selected="${this.tab === id}">${label}</button>`).join("")}</div>
      ${this.tab === "tong-quan" ? this.overview(v) : this.tab === "son-mon" ? this.sonMon(v) : this.tab === "thanh-vien" ? this.members(v) : this.wars(v)}
      </div>
      ${this.devTools(v.viewerRole)}`;
  }

  protected override mounted(): void {
    const v = this.data;
    const slot = this.page.querySelector(".mini-slot");
    if (v && slot) {
      slot.append(this.mini.el);
      void this.mini.set(v.miniMap);
    }
    this.page.querySelector<HTMLSelectElement>("[data-dev=role]")?.addEventListener("change", (e) => {
      const role = (e.target as HTMLSelectElement).value as Role;
      void this.send({ type: "dev_chuc_vi", role }).then(() => toast(`Đang xem với chức vị ${ROLE_NAMES[role]}`));
    });
    this.page.querySelector<HTMLInputElement>("[data-dev=pixel]")?.addEventListener("change", (e) => {
      setPixelArt((e.target as HTMLInputElement).checked);
      if (this.data) this.setTab(this.tab);
    });
    // Đổi mô hình tông môn để xem mỗi mô hình có bộ hình nền công trình riêng.
    const pick = this.page.querySelector<HTMLSelectElement>("[data-dev=model]");
    if (pick && v) {
      void sectModels().then((models) => {
        pick.innerHTML = models.map((m) => `<option value="${m.id}" ${m.id === v.sect.model.id ? "selected" : ""}>${esc(m.name)}</option>`).join("");
        pick.addEventListener("change", () => {
          const model = models.find((m) => m.id === pick.value);
          if (model) void this.send({ type: "dev_mo_hinh", model });
        });
      });
    }
  }

  private overview(v: TongMonView): string {
    const thumb = (url?: string) => (url ? `<span class="pt-thumb pix" style="background-image:url('${url}')"></span>` : "");
    const t = v.territory;
    const now = v.serverNow;
    const pending = t.held.reduce((a, h) => a + (h.level > 0 ? Math.floor(h.perHour * Math.min(MINE_CAP_HOURS, (now - h.uncollectedSince) / H)) : 0), 0);
    const attacked = t.held.filter((h) => h.attacked);
    const vault = v.vault;
    const low = vault.daysLeft < 3;
    const chev = icon("chevron", "chev");
    // Việc chính của tab: Lãnh thổ và nút Thu mỏ. Bảo Khố ngay sau (mất mỏ là hết tiền nuôi hộ trận, GDD mục 14).
    const land = `<section class="card primary land">
        <h2>Lãnh thổ <button type="button" class="link right" data-act="go-map">Bản đồ ›</button></h2>
        <div class="metrics">
          <div class="metric"><span>Điểm giữ</span><b>${t.held.length}<small> / ${t.max}</small></b></div>
          <div class="metric"><span>${term("Truyền Tống", "truyen_tong_tran")}</span><b>${t.range}<small> chặng</small></b></div>
          <div class="metric"><span>Linh thạch</span><b>${fmt(t.perHour.linhThach)}<small>/giờ</small></b></div>
        </div>
        <p class="rates">Quặng <b>${fmt(t.perHour.quang)}</b>/giờ · Dược <b>${fmt(t.perHour.duoc)}</b>/giờ</p>
        <div class="mini-slot"></div>
        <ul class="list">${t.held
          .map(
            (h) => `<li><button type="button" class="row" data-act="point" data-id="${h.pointId}">
              ${thumb(pointArt(v.sect.region, h.type))}<span class="grow"><b>${POINT_NAMES[h.type]}</b>${h.level ? ` <span class="muted">cấp ${h.level}</span>` : ""}${h.attacked ? `<span class="bad block sub">${esc(h.attacked.by)} đang đánh, còn ${cd(h.attacked.endsAt)}</span>` : ""}</span>
              <span class="muted nowrap">${h.level ? `${fmt(h.perHour)}/giờ` : ""}</span>${chev}</button></li>`,
          )
          .join("")}</ul>
        <button type="button" class="wide${pending > 0 ? " seal" : ""}" data-act="collect" ${pending > 0 ? "" : "disabled"}>Thu mỏ · khoảng ${fmt(pending)}</button>
      </section>`;
    const vaultCard = `<section class="card vault${low ? " warn" : ""}">
        <h2>${term("Bảo Khố", "bao_kho")}</h2>
        <div class="vault-days">${Number.isFinite(vault.daysLeft) ? `<b>${vault.daysLeft}</b><span>ngày còn đủ phí duy trì</span>` : `<b>∞</b><span>không tốn phí duy trì</span>`}</div>
        <dl class="kv tight">
          <dt>Tồn kho</dt><dd>${fmt(vault.linhThach)} linh thạch</dd>
          <dt>Phí mỗi ngày</dt><dd>${fmt(vault.upkeepPerDay)}</dd>
          ${vault.parts.map((p) => `<dt class="sub">${esc(p.label)}</dt><dd class="sub">${fmt(p.value)}</dd>`).join("")}
        </dl>
        <p class="note">${vault.linhThach <= 0 ? `<span class="bad">Bảo Khố cạn: hộ trận chỉ còn 50% sức kháng.</span>` : "Bảo Khố cạn thì hộ trận chỉ còn 50% sức kháng cho tới khi nộp đủ."}</p>
      </section>`;
    const warRows = [
      ...v.wars.map((w) => `<li class="row"><span class="grow">${w.direction === "den" ? "Bị" : "Đã"} tuyên chiến ${w.direction === "den" ? "bởi" : "với"} <b>${esc(w.with)}</b></span><span class="muted nowrap">còn ${cd(w.startsAt, "đang đánh")}</span></li>`),
      ...attacked.map((h) => `<li class="row"><span class="grow bad">${POINT_NAMES[h.type]} bị ${esc(h.attacked!.by)} đánh</span><span class="muted nowrap">còn ${cd(h.attacked!.endsAt)}</span></li>`),
    ];
    const wars = `<section class="card">
        <h2>Chiến sự <button type="button" class="link right" data-act="tab" data-tab="chien-su">Xem ›</button></h2>
        <ul class="list">${warRows.join("") || `<li class="empty-note">Không có chiến sự.</li>`}</ul>
      </section>`;
    const online = v.members.filter((m) => m.online).length;
    const members = `<section class="card">
        <h2>Thành viên <button type="button" class="link right" data-act="tab" data-tab="thanh-vien">Xem ›</button></h2>
        <div class="metrics">
          <div class="metric"><span>Người</span><b>${v.members.length}<small> / ${v.memberMax}</small></b></div>
          <div class="metric"><span>Đang online</span><b>${online}</b></div>
          <div class="metric"><span>Đơn chờ</span><b${v.applicants.length ? ` class="bad"` : ""}>${v.applicants.length}</b></div>
        </div>
      </section>`;
    return `<div class="cols"><div class="col">${land}</div><div class="col">${vaultCard}${wars}${members}</div></div>`;
  }

  private sonMon(v: TongMonView): string {
    const busy = (until?: number) => until !== undefined && until > v.serverNow;
    // Mỗi công trình một hình theo mô hình tông môn và địa thế; tên và cấp nằm dưới hình. Chạm mở chi tiết (2 chạm).
    return `
      <section class="card">
        <h2>Công trình <span class="right">${esc(v.sect.model.name)}</span></h2>
        <div class="loc-grid">${v.buildings
          .map((b) => {
            const art = locationArt({ model: v.sect.model, terrain: v.sect.terrainId, location: b.id });
            const state = `${b.level === 0 ? "locked" : busy(b.upgradingUntil) ? "busy" : ""}${art.pixel ? " pix" : ""}`;
            const lv = b.level === 0 ? "Chưa xây" : busy(b.upgradingUntil) ? `Lên cấp ${b.level + 1} · ${cd(b.upgradingUntil!)}` : `Cấp ${b.level}`;
            return `<button type="button" class="loc ${state}" data-act="loc" data-id="${b.id}">
              <span class="art" style="background-image:url('${art.url}')"></span><span><span class="loc-name">${esc(b.name)}</span><span class="lv">${lv}</span></span></button>`;
          })
          .join("")}</div>
        <p class="note">Cảnh 2D công trình dựng theo mẫu Watabou ở Sprint 5. Mô hình có hình PixelLab thì dùng hình đó, chưa có thì dùng hình vẽ bằng code.</p>
      </section>`;
  }

  /** Chi tiết công trình: hình lớn, công dụng (GDD mục 5), cấp, hàng xây, nút Nâng cho chức vị được xây. */
  private openLocation(v: TongMonView, id: string): void {
    const b = v.buildings.find((x) => x.id === id);
    const meta = LOCATIONS.find((x) => x.id === id);
    if (!b || !meta) return;
    const busy = b.upgradingUntil !== undefined && b.upgradingUntil > v.serverNow;
    const art = locationArt({ model: v.sect.model, terrain: v.sect.terrainId, location: b.id });
    const body = openSheet(
      b.name,
      `<div class="loc-hero${art.pixel ? " pix" : ""}" style="background-image:url('${art.url}')" role="img" aria-label="${esc(`${b.name} của ${v.sect.name}`)}"></div>
       <p>${esc(meta.role)}</p>
       <dl class="kv">
         <dt>Cấp</dt><dd>${b.level === 0 ? "Chưa xây" : b.level}</dd>
         ${busy ? `<dt>Đang lên cấp ${b.level + 1}</dt><dd>còn ${cd(b.upgradingUntil!)}</dd>` : ""}
         ${b.locked ? `<dt>Điều kiện</dt><dd>${esc(b.locked)}</dd>` : ""}
       </dl>
       ${v.can.xay && !busy && !b.locked ? `<div class="actions"><button type="button" class="seal" data-a="build">${b.level === 0 ? "Xây" : `Nâng lên cấp ${b.level + 1}`}</button></div>` : ""}`,
    );
    body.addEventListener("click", (e) => {
      if ((e.target as HTMLElement).closest("[data-a=build]")) toast("Hàng xây và nâng công trình có ở Sprint 5.");
    });
  }

  private members(v: TongMonView): string {
    const applicants = v.applicants.length
      ? `<section class="card primary">
          <h2>Đơn xin vào <span class="right">${v.applicants.length}</span></h2>
          <ul class="list">${v.applicants
            .map(
              (a) => `<li class="row"><span class="grow"><b>${esc(a.name)}</b><span class="muted block">cấp ${a.level}</span></span>
                ${v.can.duyet ? `<span class="btns"><button type="button" class="btn small" data-act="reject" data-id="${a.id}">Từ chối</button><button type="button" class="seal small" data-act="accept" data-id="${a.id}">Duyệt</button></span>` : ""}</li>`,
            )
            .join("")}</ul>
          ${v.can.duyet ? "" : `<p class="note">Trưởng lão trở lên mới duyệt được.</p>`}
        </section>`
      : "";
    const list = `<section class="card">
        <h2>Thành viên <span class="right">${v.members.length} / ${v.memberMax}</span></h2>
        <ul class="list">${v.members
          .map(
            (m) => `<li class="row"><span class="online${m.online ? " on" : ""}" role="img" aria-label="${m.online ? "Đang online" : "Offline"}"></span>
              <span class="grow"><b>${esc(m.name)}</b><span class="muted block">${ROLE_NAMES[m.role]} · cấp ${m.level}${m.npc ? " · NPC" : ""}</span></span>
              ${v.can.xuatSu && m.role !== "tong_chu" && !m.npc ? `<button type="button" class="btn small" data-act="release" data-id="${m.id}">Cho xuất sư</button>` : ""}</li>`,
          )
          .join("")}</ul>
      </section>`;
    return applicants ? `<div class="cols"><div class="col">${list}</div><div class="col">${applicants}</div></div>` : list;
  }

  private wars(v: TongMonView): string {
    const attacked = v.territory.held.filter((h) => h.attacked);
    const rows = [
      ...v.wars.map((w) => `<li class="row"><span class="grow"><b>${esc(w.with)}</b><span class="muted block">${w.direction === "den" ? "Tuyên chiến với tông mình" : "Tông mình tuyên chiến"} · ${new Date(w.startsAt).toLocaleString("vi-VN", { weekday: "long", hour: "2-digit", minute: "2-digit" })}</span></span><span class="muted nowrap">còn ${cd(w.startsAt, "đang đánh")}</span></li>`),
      ...attacked.map((h) => `<li><button type="button" class="row" data-act="point" data-id="${h.pointId}"><span class="grow bad"><b>${POINT_NAMES[h.type]}</b> bị ${esc(h.attacked!.by)} phá trận</span><span class="muted nowrap">còn ${cd(h.attacked!.endsAt)}</span>${icon("chevron", "chev")}</button></li>`),
    ];
    return `
      <section class="card">
        <h2>Chiến sự</h2>
        <ul class="list">${rows.join("") || `<li class="empty-note">Không có chiến sự.</li>`}</ul>
        ${v.can.tuyenChien ? `<button type="button" class="wide seal" data-act="declare">Tuyên chiến</button>` : `<p class="note">Chỉ tông chủ và phó tông chủ tuyên chiến được (tông môn từ cấp 30).</p>`}
      </section>`;
  }

  /** Công cụ thử của prototype: đổi chức vị người xem để kiểm nút theo quyền. */
  private devTools(role: Role | null): string {
    return `<details class="dev"><summary>Công cụ thử (prototype)</summary>
      <label>Xem với chức vị <select data-dev="role">${(["tong_chu", "pho_tong_chu", "truong_lao", "noi_mon", "ngoai_mon"] as Role[])
        .map((r) => `<option value="${r}" ${r === role ? "selected" : ""}>${ROLE_NAMES[r]}</option>`)
        .join("")}</select></label>
      <label>Mô hình tông môn <select data-dev="model"><option>Đang tải…</option></select></label>
      <label><input type="checkbox" data-dev="pixel" ${pixelArtEnabled() ? "checked" : ""}> Dùng hình PixelLab khi có (tắt để so với bản vẽ code)</label></details>`;
  }

  protected override act(name: string, el: HTMLElement): void {
    const v = this.data;
    if (!v) return;
    const id = el.dataset.id!;
    switch (name) {
      case "tab":
        this.setTab(el.dataset.tab as TongMonTab);
        this.page.scrollTop = 0;
        break;
      case "go-map":
        this.ctx.nav.go({ screen: "ban-do", pointId: v.miniMap.sonMon });
        break;
      case "point":
        this.ctx.nav.go({ screen: "ban-do", pointId: Number(id) });
        break;
      case "collect":
        void this.send({ type: "thu_mo" });
        break;
      case "donate":
        this.openDonate(v);
        break;
      case "accept":
      case "reject":
        void this.send({ type: "duyet_don", applicantId: id, accept: name === "accept" });
        break;
      case "release":
        void this.send({ type: "cho_xuat_su", memberId: id });
        break;
      case "loc":
        this.openLocation(v, id);
        break;
      case "declare":
        toast("Tuyên chiến có ở khối M5.");
        break;
    }
  }

  private openDonate(v: TongMonView): void {
    const have = v.top.linhThach;
    const body = openSheet(
      "Hiến tế",
      `<p>Mỗi linh thạch hiến tế thêm ${v.donateXpPerStone} XP cho tông môn. Bạn có ${fmt(have)} linh thạch.</p>
       <div class="actions">${[...DONATE, have]
         .map((n, i) => `<button type="button" ${i === DONATE.length ? `class="seal"` : ""} data-n="${n}" ${n > have || n <= 0 ? "disabled" : ""}>${i === DONATE.length ? "Tất cả" : fmt(n)}<span class="muted block">+${fmt(n * v.donateXpPerStone)} XP</span></button>`)
         .join("")}</div>`,
    );
    body.addEventListener("click", (e) => {
      const n = (e.target as HTMLElement).closest<HTMLElement>("[data-n]")?.dataset.n;
      if (n) {
        closeSheet();
        void this.send({ type: "hien_te", amount: Number(n) });
      }
    });
  }
}

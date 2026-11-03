// Tông môn: dashboard tông môn (GDD mục 14). Ai cũng thấy số liệu; nút chỉ hiện cho chức vị được làm việc đó (mục 6).
// Thẻ Bảo Khố đặt ngay dưới Lãnh thổ và đếm số ngày còn đủ linh thạch trả phí duy trì (mục 10).
import type { Role } from "@ktlp/rules";
import { POINT_NAMES } from "../../scenes/map/region.ts";
import { loadLocationArt, locationArt, LOCATIONS, pixelArtEnabled, pointArt, sectModels, setPixelArt } from "../art/sectScene.ts";
import { MiniMap } from "../minimap.ts";
import { PageScene, type DashCtx } from "../shell.ts";
import type { TongMonView } from "../source.ts";
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
    // Đầu màn là hình Chính Điện của mô hình tông môn; tên, cấp và XP nằm trên chân hình.
    const hero = locationArt({ model: s.model, terrain: s.terrainId, location: "chinh_dien" });
    this.page.innerHTML = `
      <section class="sect-hero${hero.pixel ? " pix" : ""}" style="background-image:url('${hero.url}')">
        <div class="hero-body">
          <img class="island" src="${assetUrl(s.island)}" alt="">
          <div class="grow">
            <h2>${esc(s.name)}</h2>
            <div class="meta">Cấp ${s.level} · ${fmt(s.xp)} / ${fmt(s.xpToNext)} XP</div>
            <div class="bar"><i style="width:${Math.min(100, (s.xp / s.xpToNext) * 100).toFixed(1)}%"></i></div>
          </div>
          ${v.can.hienTe ? `<button type="button" class="seal small" data-act="donate">Hiến tế</button>` : ""}
        </div>
      </section>
      <p class="muted sect-meta">${esc(s.regionName)} · ${esc(s.terrain)} · phe ${esc(s.faction)} · ${shield} · ${s.patron ? `bảo trợ ${esc(s.patron)}` : "không bảo trợ"}</p>
      <div class="seg" role="group" aria-label="Tab con">${TABS.map(([id, label]) => `<button type="button" data-act="tab" data-tab="${id}" aria-pressed="${this.tab === id}">${label}</button>`).join("")}</div>
      ${this.tab === "tong-quan" ? this.overview(v) : this.tab === "son-mon" ? this.sonMon(v) : this.tab === "thanh-vien" ? this.members(v) : this.wars(v)}
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
    return `
      <section class="card land">
        <h2>Lãnh thổ <button type="button" class="link right" data-act="go-map">Bản đồ ›</button></h2>
        <div class="land-grid">
          <dl class="kv tight">
            <dt>Điểm giữ</dt><dd>${t.held.length} / ${t.max}</dd>
            <dt>Tầm Truyền Tống</dt><dd>${t.range} chặng</dd>
            <dt>Linh thạch</dt><dd>${fmt(t.perHour.linhThach)}/giờ</dd>
            <dt>Quặng</dt><dd>${fmt(t.perHour.quang)}/giờ</dd>
            <dt>Dược</dt><dd>${fmt(t.perHour.duoc)}/giờ</dd>
          </dl>
          <div class="mini-slot"></div>
        </div>
        <ul class="list">${t.held
          .map(
            (h) => `<li><button type="button" class="row" data-act="point" data-id="${h.pointId}">
              ${thumb(pointArt(v.sect.region, h.type))}<span class="grow"><b>${POINT_NAMES[h.type]}</b>${h.level ? ` cấp ${h.level}` : ""}${h.attacked ? `<span class="bad block">${esc(h.attacked.by)} đang đánh, còn ${cd(h.attacked.endsAt)}</span>` : ""}</span>
              <span class="muted">${h.level ? `${fmt(h.perHour)}/giờ` : ""}</span></button></li>`,
          )
          .join("")}</ul>
        <button type="button" class="wide${pending > 0 ? " seal" : ""}" data-act="collect" ${pending > 0 ? "" : "disabled"}>Thu mỏ (khoảng ${fmt(pending)})</button>
      </section>
      <section class="card vault${low ? " warn" : ""}">
        <h2>Bảo Khố <span class="right">${Number.isFinite(vault.daysLeft) ? `còn đủ <b>${vault.daysLeft}</b> ngày` : ""}</span></h2>
        <dl class="kv tight">
          <dt>Tồn kho</dt><dd>${fmt(vault.linhThach)} linh thạch</dd>
          <dt>Phí duy trì mỗi ngày</dt><dd>${fmt(vault.upkeepPerDay)}</dd>
          ${vault.parts.map((p) => `<dt class="sub">${esc(p.label)}</dt><dd class="muted">${fmt(p.value)}</dd>`).join("")}
        </dl>
        <p class="muted">${vault.linhThach <= 0 ? `<span class="bad">Bảo Khố cạn: hộ trận chỉ còn 50% sức kháng.</span>` : "Bảo Khố cạn thì hộ trận chỉ còn 50% sức kháng cho tới khi nộp đủ."}</p>
      </section>
      <section class="card">
        <h2><button type="button" class="link" data-act="tab" data-tab="chien-su">Chiến sự</button></h2>
        <ul class="list">${v.wars.map((w) => `<li class="row"><span class="grow">${w.direction === "den" ? "Bị" : "Đã"} tuyên chiến ${w.direction === "den" ? "bởi" : "với"} <b>${esc(w.with)}</b></span><span class="muted">còn ${cd(w.startsAt, "đang đánh")}</span></li>`).join("")}
          ${attacked.map((h) => `<li class="row"><span class="grow bad">${POINT_NAMES[h.type]} bị ${esc(h.attacked!.by)} đánh</span><span class="muted">còn ${cd(h.attacked!.endsAt)}</span></li>`).join("")}</ul>
      </section>
      <section class="card">
        <h2><button type="button" class="link" data-act="tab" data-tab="thanh-vien">Thành viên</button></h2>
        <p>${v.members.length} / ${v.memberMax} người · ${v.members.filter((m) => m.online).length} đang online · ${v.applicants.length} đơn chờ duyệt</p>
      </section>`;
  }

  private sonMon(v: TongMonView): string {
    const busy = (until?: number) => until !== undefined && until > v.serverNow;
    // Mỗi công trình một hình nền theo mô hình tông môn và địa thế; chạm mở chi tiết (2 chạm từ tab Tông môn).
    return `
      <section class="card">
        <h2>Công trình <span class="right">${esc(v.sect.model.name)}</span></h2>
        <div class="loc-grid">${v.buildings
          .map((b) => {
            const art = locationArt({ model: v.sect.model, terrain: v.sect.terrainId, location: b.id });
            const state = `${b.level === 0 ? "locked" : busy(b.upgradingUntil) ? "busy" : ""}${art.pixel ? " pix" : ""}`;
            const lv = b.level === 0 ? "Chưa xây" : busy(b.upgradingUntil) ? `${cd(b.upgradingUntil!)}` : `Cấp ${b.level}`;
            return `<button type="button" class="loc ${state}" data-act="loc" data-id="${b.id}" style="background-image:url('${art.url}')">
              <span class="lv">${lv}</span><span class="loc-name">${esc(b.name)}</span></button>`;
          })
          .join("")}</div>
        <p class="muted">Cảnh 2D công trình dựng theo mẫu Watabou ở Sprint 5. Mô hình có hình PixelLab thì dùng hình đó, chưa có thì dùng hình vẽ bằng code.</p>
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
      ? `<section class="card">
          <h2>Đơn xin vào <span class="right">${v.applicants.length}</span></h2>
          <ul class="list">${v.applicants
            .map(
              (a) => `<li class="row"><span class="grow"><b>${esc(a.name)}</b> <span class="muted">cấp ${a.level}</span></span>
                ${v.can.duyet ? `<button type="button" class="seal small" data-act="accept" data-id="${a.id}">Duyệt</button><button type="button" class="btn small" data-act="reject" data-id="${a.id}">Từ chối</button>` : ""}</li>`,
            )
            .join("")}</ul>
          ${v.can.duyet ? "" : `<p class="muted">Trưởng lão trở lên mới duyệt được.</p>`}
        </section>`
      : "";
    return `${applicants}
      <section class="card">
        <h2>Thành viên <span class="right">${v.members.length} / ${v.memberMax}</span></h2>
        <ul class="list">${v.members
          .map(
            (m) => `<li class="row"><span class="online${m.online ? " on" : ""}" aria-label="${m.online ? "Đang online" : "Offline"}"></span>
              <span class="grow"><b>${esc(m.name)}</b><span class="muted block">${ROLE_NAMES[m.role]} · cấp ${m.level}${m.npc ? " · NPC" : ""}</span></span>
              ${v.can.xuatSu && m.role !== "tong_chu" && !m.npc ? `<button type="button" class="btn small" data-act="release" data-id="${m.id}">Cho xuất sư</button>` : ""}</li>`,
          )
          .join("")}</ul>
      </section>`;
  }

  private wars(v: TongMonView): string {
    const attacked = v.territory.held.filter((h) => h.attacked);
    return `
      <section class="card">
        <h2>Chiến sự</h2>
        <ul class="list">${v.wars
          .map((w) => `<li class="row"><span class="grow"><b>${esc(w.with)}</b><span class="muted block">${w.direction === "den" ? "Tuyên chiến với tông mình" : "Tông mình tuyên chiến"} · ${new Date(w.startsAt).toLocaleString("vi-VN", { weekday: "long", hour: "2-digit", minute: "2-digit" })}</span></span><span class="muted">còn ${cd(w.startsAt, "đang đánh")}</span></li>`)
          .join("")}
          ${attacked
            .map((h) => `<li><button type="button" class="row" data-act="point" data-id="${h.pointId}"><span class="grow bad"><b>${POINT_NAMES[h.type]}</b> bị ${esc(h.attacked!.by)} phá trận</span><span class="muted">còn ${cd(h.attacked!.endsAt)}</span></button></li>`)
            .join("")}</ul>
        ${v.can.tuyenChien ? `<button type="button" class="wide seal" data-act="declare">Tuyên chiến</button>` : `<p class="muted">Chỉ tông chủ và phó tông chủ tuyên chiến được (tông môn từ cấp 30).</p>`}
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

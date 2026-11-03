// Màn Nhân vật (GDD mục 14): mở bằng chân dung trên thanh trên. Đầu màn là linh căn, tài năng, cấp, tông môn và
// chức vị; lực chiến kèm thanh chia nguồn cho thấy đồ và thú chỉ góp một phần có trần. Ba tab con: Trang bị (6 ô
// quanh hình nhân vật), Chỉ số (chạm để xem nguồn), Thú cưỡi (5 ô và kích phát).
import type { Sprites } from "../../assets/sprites.ts";
import { animInfo, drawCharacter } from "../../scenes/battle/character.ts";
import { ADULT_AGE, ageOn, GUARDIAN_AGE } from "../auth.ts";
import { REALM_TERM, term } from "../terms.ts";
import { setTheme, theme } from "../theme.ts";
import { icon } from "../icons.ts";
import { PageScene, type DashCtx } from "../shell.ts";
import type { GearItem, GearSlot, NhanVatView, StatLine } from "../source.ts";
import { assetUrl, cropIcons, elementChip, esc, fmt, openSheet, pctText, ROLE_NAMES, toast } from "../ui.ts";

export type NhanVatTab = "trang-bi" | "chi-so" | "thu-cuoi";

const SLOT_NAMES: Record<GearSlot, string> = { vu_khi: "Vũ khí", mu: "Mũ", ao: "Áo", dai: "Đai", giay: "Giày", ngoc_boi: "Ngọc bội" };
const LEFT: GearSlot[] = ["vu_khi", "mu", "ao"];
const RIGHT: GearSlot[] = ["dai", "giay", "ngoc_boi"];
const TIER_NAMES = { linh: "Linh", thien: "Thiên", than: "Thần" };
const STAT_KEYS: Record<string, string> = { hp: "Máu", atk: "Công lực", def: "Phòng thủ", mana: "Mana" };
/** Độ bền dưới mức này tô đỏ (cùng mức với thẻ Việc nên làm). */
const LOW = 20;

function statText(s: StatLine, v = s.value): string {
  return s.unit === "‰" ? pctText(v) : fmt(v);
}

export class NhanVatScene extends PageScene<NhanVatView> {
  private tab: NhanVatTab = "trang-bi";
  private sprites: Sprites;
  private doll?: HTMLCanvasElement;
  private anim = 0;
  private frame = 0;

  constructor(ctx: DashCtx, sprites: Sprites) {
    super("nhan-vat", "Nhân vật", ctx);
    this.sprites = sprites;
  }

  setTab(t: NhanVatTab): void {
    this.tab = t;
    if (this.data) this.render(this.data);
  }

  protected read(): Promise<NhanVatView> {
    return this.ctx.source.nhanVat();
  }

  override enter(): void {
    super.enter();
    clearInterval(this.anim);
    // Hoạt ảnh đứng của nhân vật ghép, 6 khung mỗi giây như dải hình.
    this.anim = window.setInterval(() => {
      this.frame++;
      this.drawDoll();
    }, 1000 / 6);
  }

  override leave(): void {
    super.leave();
    clearInterval(this.anim);
  }

  protected render(v: NhanVatView): void {
    const exp = Math.min(1, v.exp / v.expToNext);
    const total = v.power.parts.reduce((a, p) => a + p.value, 0) || 1;
    const seg = (id: NhanVatTab, label: string) => `<button type="button" data-act="tab" data-tab="${id}" aria-pressed="${this.tab === id}">${label}</button>`;
    this.page.innerHTML = `
      <button type="button" class="ghost back-link" data-act="back">${icon("back")}Quay lại</button>
      <section class="card nv-id">
        <div class="nv-line">${term("Linh căn", "linh_can")} ${v.roots.map((e) => elementChip(e)).join(" ")} · ${term("Tài năng", "tai_nang")} <span class="chip sk">${esc(v.talent.name)}</span></div>
        <div class="nv-line"><b>${esc(v.sect.name)}</b> · ${esc(v.sect.role ? ROLE_NAMES[v.sect.role] : "Chưa vào tông")}${v.satNghiep > 0 ? ` · <span class="bad">Sát nghiệp ${fmt(v.satNghiep)}</span>` : ""}</div>
        <div class="nv-line"><b>Cấp ${v.level}</b> ${term(v.top.realm, REALM_TERM[v.top.realm] ?? "")} <span class="muted">${fmt(v.exp)} / ${fmt(v.expToNext)} kinh nghiệm</span></div>
        <div class="bar"><i style="width:${(exp * 100).toFixed(1)}%"></i></div>
        <div class="nv-power"><span class="muted">${term("Lực chiến", "luc_chien")}</span> <b>${fmt(v.power.total)}</b></div>
        <div class="power-bar">${v.power.parts.map((p) => `<i class="p-${p.id}" style="flex:${p.value / total}" title="${esc(p.label)}"></i>`).join("")}</div>
        <div class="power-legend">${v.power.parts
          .map((p) => `<span class="p-${p.id}"><i></i>${esc(p.label)} ${Math.round((p.value / total) * 100)}%${p.cap ? ` <span class="muted">(trần ${Math.round(p.cap * 100)}%)</span>` : ""}</span>`)
          .join("")}</div>
      </section>
      <div class="seg" role="group" aria-label="Tab con">${seg("trang-bi", "Trang bị")}${seg("chi-so", "Chỉ số")}${seg("thu-cuoi", "Thú cưỡi")}</div>
      ${this.tab === "trang-bi" ? this.gearTab(v) : this.tab === "chi-so" ? this.statsTab(v) : this.mountTab(v)}
      ${this.accountCard()}`;
    this.doll = this.page.querySelector<HTMLCanvasElement>(".doll") ?? undefined;
    cropIcons(this.page);
    this.drawDoll();
  }

  /** Tài khoản đăng nhập: số điện thoại che bớt, nhóm tuổi theo G1, đăng xuất. */
  private accountCard(): string {
    const s = this.ctx.auth.session();
    if (!s) return "";
    const age = ageOn(s.birthDate);
    const group = age < GUARDIAN_AGE ? "Dưới 16 tuổi, có người giám hộ" : age < ADULT_AGE ? "Dưới 18 tuổi, giới hạn giờ chơi" : "Từ 18 tuổi";
    return `<section class="card"><h2>Tài khoản</h2>
      <div class="account"><span class="grow"><b>${esc(s.phoneMasked)}</b><span class="muted block">${group}${s.guardian ? ` · giám hộ ${esc(s.guardian.name)}` : ""}</span></span>
      <button type="button" class="btn small" data-act="logout">${icon("logout")} Đăng xuất</button></div>
      <div class="account theme-row"><span class="grow">Giao diện<span class="muted block">Cuộn giấy dùng khung PixelLab; tối giản là bản phẳng</span></span>
      <button type="button" class="${theme() === "scroll" ? "seal" : "btn"} small" data-act="theme" data-theme="scroll">Cuộn giấy</button>
      <button type="button" class="${theme() === "minimal" ? "seal" : "btn"} small" data-act="theme" data-theme="minimal">Tối giản</button></div></section>`;
  }

  private slot(v: NhanVatView, s: GearSlot): string {
    const g = v.gear[s];
    if (!g) return `<button type="button" class="slot empty" data-act="slot" data-slot="${s}"><span class="slot-glyph">${SLOT_NAMES[s]}</span><span class="muted">Trống</span></button>`;
    const dur = g.durability / g.durabilityMax;
    return `<button type="button" class="slot tier-${g.tier}" data-act="slot" data-slot="${s}" aria-label="${esc(`${SLOT_NAMES[s]}: ${g.name} +${g.plus}`)}">
      ${g.icon ? `<img src="${assetUrl(g.icon)}" alt="" data-crop>` : `<span class="slot-glyph">${SLOT_NAMES[s]}</span>`}
      <span class="plus">+${g.plus}</span>
      <span class="gems">◆${g.gems.length}/${g.sockets}</span>
      <span class="dur${g.durability < LOW ? " low" : ""}"><i style="width:${(dur * 100).toFixed(0)}%"></i></span>
    </button>`;
  }

  private gearTab(v: NhanVatView): string {
    return `
      <section class="card gear">
        <div class="gear-grid">
          <div class="col">${LEFT.map((s) => this.slot(v, s)).join("")}</div>
          <canvas class="doll" aria-label="Hình nhân vật"></canvas>
          <div class="col">${RIGHT.map((s) => this.slot(v, s)).join("")}</div>
        </div>
        <p class="muted center">Viền theo cấp đồ (linh, thiên, thần) · nấc + · thanh độ bền · ngọc đã khảm trên số dòng</p>
        <div class="main-stats">${v.main
          .map((s) => `<button type="button" class="stat-tile" data-act="stat" data-stat="${s.id}"><span class="muted">${esc(s.label)}</span><b>${statText(s)}</b></button>`)
          .join("")}</div>
      </section>`;
  }

  private statsTab(v: NhanVatView): string {
    return `<section class="card"><ul class="list">${v.stats
      .map(
        // Nguồn hiện ngay dưới tên để không cần chạm lần thứ ba; chạm vẫn mở bảng nguồn đầy đủ.
        (s) => `<li><button type="button" class="row" data-act="stat" data-stat="${s.id}">
          <span class="grow">${esc(s.label)}<span class="muted block">${s.sources
            .filter((x) => x.value !== 0)
            .map((x) => `${esc(x.label)} ${statText(s, x.value)}`)
            .join(" · ") || "Chưa có nguồn"}</span></span><b>${statText(s)}</b><span class="muted" aria-hidden="true">›</span></button></li>`,
      )
      .join("")}</ul><p class="muted">Nguồn: gốc theo cấp, đồ, ngọc, thú, tài năng, buff linh căn. Chạm để xem bảng đầy đủ.</p></section>`;
  }

  private mountTab(v: NhanVatView): string {
    return `
      <section class="card">
        <h2>5 ô thú cưỡi</h2>
        <ul class="mounts">${v.mounts
          .map((m) =>
            m
              ? `<li><img src="${assetUrl(m.icon)}" alt=""><span class="grow"><b>${esc(m.name)}</b><span class="block">${elementChip(m.element)} <span class="muted">${esc(m.grade)} · ${esc(m.realm)}</span></span></span></li>`
              : `<li class="empty"><span class="mount-empty">+</span><span class="grow muted">Ô trống: thuần phục ở hang dị thú</span></li>`,
          )
          .join("")}</ul>
      </section>
      <section class="card">
        <h2>Kích phát</h2>
        <ul class="list">${v.combos
          .map((c) => `<li class="row${c.active ? " on" : ""}"><span class="badge">${c.active ? "Bật" : "—"}</span><span class="grow"><b>${esc(c.name)}</b><span class="muted block">${esc(c.effect)}</span></span></li>`)
          .join("")}</ul>
      </section>`;
  }

  /** Thân (đã gồm áo), mũ neo ở đầu, vũ khí neo ở tay; dùng đúng hàm vẽ của màn Trận. */
  private drawDoll(): void {
    const c = this.doll;
    const v = this.data;
    if (!c || !v || !c.isConnected) return;
    const w = c.clientWidth;
    const h = c.clientHeight;
    if (!w || !h) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
    }
    const ctx = c.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath();
    ctx.ellipse(w / 2, h - 12, w * 0.3, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    const look = { body: v.look.body, outfit: v.look.outfit, hat: v.look.hat, weapon: v.look.weapon };
    const info = animInfo(this.sprites, look, "dung");
    const scale = Math.min(2.4, (h - 16) / 72);
    if (!info || !drawCharacter(ctx, this.sprites, look, "dung", this.frame % info.frames, w / 2, h - 12, scale, false)) {
      // Chưa có dải hoạt ảnh: vẽ ảnh tĩnh của thân mặc áo.
      const img = this.sprites.get(`nhan_vat/${v.look.body}/${v.look.outfit}`);
      if (img) ctx.drawImage(img, w / 2 - 32 * scale, h - 12 - 56 * scale, 64 * scale, 64 * scale);
    }
  }

  protected override act(name: string, el: HTMLElement): void {
    const v = this.data;
    if (!v) return;
    if (name === "back") this.ctx.nav.back();
    else if (name === "theme") {
      setTheme(el.dataset.theme === "minimal" ? "minimal" : "scroll");
      this.render(v);
    } else if (name === "logout") {
      this.ctx.auth.logout();
      location.reload();
    }
    else if (name === "tab") this.setTab(el.dataset.tab as NhanVatTab);
    else if (name === "stat") this.openStat([...v.main, ...v.stats].find((s) => s.id === el.dataset.stat)!);
    else if (name === "slot") this.openSlot(el.dataset.slot as GearSlot, v.gear[el.dataset.slot as GearSlot]);
  }

  private openStat(s: StatLine): void {
    openSheet(
      `${s.label}: ${statText(s)}`,
      `<dl class="kv">${s.sources.map((x) => `<dt>${esc(x.label)}</dt><dd>${x.value > 0 && x.label !== "Gốc theo cấp" ? "+" : ""}${statText(s, x.value)}</dd>`).join("")}</dl>
       <p class="muted">Điểm cộng chưa có trong GDD nên chưa hiện. Số của đồ, ngọc và thú là dữ liệu mẫu.</p>`,
    );
  }

  /** Chi tiết món (2 chạm từ thanh trên): chỉ số, ngọc đã khảm, nút Rèn, Sửa, Khảm, Tháo. */
  private openSlot(slot: GearSlot, g: GearItem | undefined): void {
    if (!g) {
      openSheet(SLOT_NAMES[slot], `<p class="muted">Chưa mặc món nào. Đồ rơi ở bí cảnh hoặc rèn ở lò rèn.</p>`);
      return;
    }
    const k = 1 + 0.03 * g.plus;
    const stats = (Object.entries(g.stats) as [string, number][])
      .map(([key, val]) => `<dt>${STAT_KEYS[key]}</dt><dd>${fmt(val * k)} <span class="muted">(${fmt(val)} + ${g.plus * 3}%)</span></dd>`)
      .join("");
    const gems = g.gems.length
      ? g.gems.map((gem) => `<li class="row">${elementChip(gem.element)} <span class="grow">Ngọc cấp ${gem.level}</span><span class="muted">kháng +${pctText(2.5 * gem.level * (gem.level + 1))}</span></li>`).join("")
      : `<li class="muted">Chưa khảm ngọc.</li>`;
    const body = openSheet(
      `${SLOT_NAMES[slot]}: ${g.name}`,
      `<dl class="kv">
         <dt>Cấp đồ</dt><dd>${TIER_NAMES[g.tier]}</dd>
         <dt>Cường hóa</dt><dd>+${g.plus} / +30</dd>
         <dt>Độ bền</dt><dd class="${g.durability < LOW ? "bad" : ""}">${g.durability} / ${g.durabilityMax}</dd>
         ${stats}
         <dt>Dòng khảm</dt><dd>${g.gems.length} / ${g.sockets}</dd>
       </dl>
       <ul class="list">${gems}</ul>
       <div class="actions">
         <button type="button" class="seal" data-a="ren">Rèn</button>
         <button type="button" data-a="sua">Sửa</button>
         <button type="button" data-a="kham" ${g.gems.length >= g.sockets ? "disabled" : ""}>Khảm</button>
         <button type="button" data-a="thao">Tháo</button>
       </div>
       <p class="muted">Rèn và Sửa làm ở lò rèn thành chủ hoặc Luyện Khí Các của tông môn.</p>`,
    );
    body.addEventListener("click", (e) => {
      const a = (e.target as HTMLElement).closest<HTMLElement>("[data-a]")?.dataset.a;
      if (a) toast("Rèn, sửa, khảm có ở khối MVP M6; prototype chưa làm.");
    });
  }
}

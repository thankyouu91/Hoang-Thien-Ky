// Màn Nhân vật (GDD mục 14): mở bằng chân dung trên thanh trên. Một thẻ ba cột:
//  - Thông tin: các nhóm thu gọn được (thân phận, linh căn và tài năng, chỉ số chiến đấu, tu luyện, tài khoản), nhãn trái
//    giá trị phải; nút lớn Bế quan hoặc Đột phá ở đáy.
//  - Pháp tướng (theo mẫu người dùng gửi 2026-11-03): bóng lớn của chính nhân vật vẽ màu mực nâu mờ dần vào núi sương
//    (nướng bằng three), tu sĩ đứng trước, 7 ô trang bị hai bên (icon vẽ assets/icon_ve, nền màu theo độ hiếm), 4 ô công pháp mang vào trận, 5 ô thú (ô đang cưỡi có dấu
//    yên), chú giải một dòng ở đáy. Vòng 12 hệ (elementWheel.ts) chỉ hiện khi bấm "Vòng hệ".
//  - Túi: 50 ô, lọc theo loại và theo phẩm, khung chi tiết món đang chọn.
// Màn rộng (từ 1100 px) hiện đủ ba cột và kéo thả bằng chuột: kéo đồ hay công pháp từ túi vào ô để mặc, kéo ra túi để
// tháo. Điện thoại đổi thành ba thẻ Thông tin · Pháp tướng · Túi và dùng chạm: chạm ô mở bảng chọn món, chạm món mở chi
// tiết; việc nào cũng trong 2 chạm.
import type { Element } from "@ktlp/sim";
import type { Sprites } from "../../assets/sprites.ts";
import { mountBakedScene, type SceneHandle } from "../../three/index.ts";
import { animInfo, drawCharacter } from "../../scenes/battle/character.ts";
import { ADULT_AGE, ageOn, GUARDIAN_AGE } from "../auth.ts";
import { elementWheel } from "../elementWheel.ts";
import { icon, type IconName } from "../icons.ts";
import { PageScene, type DashCtx } from "../shell.ts";
import type { BagItem, GearItem, GearSlot, ItemGrade, ItemKind, NhanVatView, Rarity, StatLine, TechniqueCard } from "../source.ts";
import { REALM_TERM, term } from "../terms.ts";
import { artUrl, assetUrl, cd, closeSheet, cropIcons, elementChip, esc, fmt, openSheet, pctText, ROLE_NAMES, skillChip, toast } from "../ui.ts";
import { ELEMENT_STYLE } from "../../theme/elements.ts";

export type NhanVatTab = "thong-tin" | "phap-tuong" | "tui";

const SLOT_NAMES: Record<GearSlot, string> = { vu_khi: "Vũ khí", mu: "Mũ", ao: "Áo", dai: "Đai", bao_tay: "Bao tay", giay: "Giày", ngoc_boi: "Ngọc bội" };
/** 7 ô (người dùng chốt 2026-11-03, thêm bao tay): bên trái theo thân từ đầu xuống chân, bên phải tay cầm và đeo. */
const LEFT: GearSlot[] = ["mu", "ao", "dai", "giay"];
const RIGHT: GearSlot[] = ["vu_khi", "bao_tay", "ngoc_boi"];
/** Độ hiếm hiện bằng màu nền ô (lục là đồ shop); khung chi tiết ghi chữ. */
const RARITY_NAMES: Record<Rarity, string> = { luc: "Lục", lam: "Lam", tim: "Tím", vang: "Vàng", do: "Đỏ" };
/** Lớp màu của ô món: độ hiếm nếu có, không thì phẩm. */
const tone = (it: { rarity?: Rarity; grade: ItemGrade }) => (it.rarity ? `r-${it.rarity}` : `g-${it.grade}`);
const STAT_KEYS: Record<string, string> = { hp: "Máu", atk: "Công lực", def: "Phòng thủ", mana: "Mana" };
/** Chỉ số hiện ở nhóm Chỉ số chiến đấu, đúng thứ tự (số từ @ktlp/sim qua nguồn đọc). */
const COMBAT = ["hp", "mana", "atk", "def", "crit", "critDamage", "attackSpeed"];
const KIND_NAMES: Record<ItemKind, string> = {
  trang_bi: "Trang bị", cong_phap: "Công pháp", tan_quyen: "Tàn quyển", ngoc: "Ngọc", dan: "Đan dược", nguyen_lieu: "Nguyên liệu", phu: "Phù chú", trung_thu: "Trứng thú",
};
const GRADE_NAMES: Record<ItemGrade, string> = { ha: "Hạ phẩm", trung: "Trung phẩm", cao: "Cao phẩm" };
/** Ký hiệu tạm cho món chưa có hình PixelLab. */
const KIND_GLYPH: Record<ItemKind, IconName> = {
  trang_bi: "sword", cong_phap: "scroll", tan_quyen: "scroll", ngoc: "gem", dan: "dan", nguyen_lieu: "quang", phu: "phu", trung_thu: "trung",
};
const SLOT_GLYPH: Record<GearSlot, IconName> = { vu_khi: "sword", mu: "shield", ao: "ao", dai: "dai", bao_tay: "bao_tay", giay: "giay", ngoc_boi: "ngoc_boi" };
/** Độ bền dưới mức này tô đỏ (cùng mức với thẻ Việc nên làm). */
const LOW = 20;
const WIDE = "(min-width: 1100px)";

function statText(s: StatLine, v = s.value): string {
  return s.unit === "‰" ? pctText(v) : fmt(v);
}

/** Ô kéo thả: "item:<uid>" món trong túi, "gear:<ô>" món đang mặc, "tech:<i>" ô công pháp. */
type DragRef = string;

export class NhanVatScene extends PageScene<NhanVatView> {
  private tab: NhanVatTab = "phap-tuong";
  private kind: ItemKind | "all" = "all";
  /** Lọc thứ hai: độ hiếm khi đang xem trang bị, phẩm với các loại khác. */
  private grade: ItemGrade | Rarity | "all" = "all";
  private selected?: number;
  private sprites: Sprites;
  private doll?: HTMLCanvasElement;
  private anim = 0;
  private frame = 0;
  /** Vừa thả xong một món: bỏ qua cú nhấp đi kèm. */
  private dropped = false;
  /** Bóng pháp tướng phía sau tu sĩ. */
  private ghost?: HTMLCanvasElement;
  /** Núi sương dưới đáy cột Pháp tướng: ảnh three nướng một lần, giữ qua các lần vẽ lại. */
  private mistEl: HTMLElement;
  private mist?: SceneHandle;
  private showWheel = false;

  constructor(ctx: DashCtx, sprites: Sprites) {
    super("nhan-vat", "Nhân vật", ctx);
    this.sprites = sprites;
    this.page.addEventListener("change", (e) => {
      const el = e.target as HTMLSelectElement;
      if (el.dataset.filter === "kind") {
        this.kind = el.value as ItemKind | "all";
        this.grade = "all";
      } else if (el.dataset.filter === "grade") this.grade = el.value as ItemGrade | Rarity | "all";
      else return;
      if (this.data) this.render(this.data);
    });
    this.page.addEventListener("pointerdown", (e) => this.dragStart(e));
    this.mistEl = document.createElement("div");
    this.mistEl.className = "pt-mist";
    this.mistEl.setAttribute("aria-hidden", "true");
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
    const tab = (id: NhanVatTab, label: string) => `<button type="button" role="tab" data-act="tab" data-tab="${id}" aria-selected="${this.tab === id}">${label}</button>`;
    this.page.innerHTML = `
      <section class="card nv">
        <header class="nv-head">
          <h1><b>${esc(v.name)}</b><span>${term(v.top.realm, REALM_TERM[v.top.realm] ?? "")} · Cấp ${v.level} · ${esc(v.sect.name)}</span></h1>
          <button type="button" class="nv-ic" data-act="help" aria-label="Cách dùng màn Nhân vật">${icon("help")}</button>
          <button type="button" class="nv-ic" data-act="back" aria-label="Đóng">${icon("close")}</button>
        </header>
        <div class="seg nv-tabs" role="tablist" aria-label="Phần của màn Nhân vật">${tab("thong-tin", "Thông tin")}${tab("phap-tuong", "Pháp tướng")}${tab("tui", "Túi")}</div>
        <div class="nv-cols" data-tab="${this.tab}">
          <div class="nv-col nv-info">${this.info(v)}</div>
          <div class="nv-col nv-form">${this.form(v)}</div>
          <div class="nv-col nv-bag">${this.bag(v)}</div>
        </div>
      </section>`;
    this.doll = this.page.querySelector<HTMLCanvasElement>(".doll") ?? undefined;
    this.ghost = this.page.querySelector<HTMLCanvasElement>(".pt-ghost") ?? undefined;
    this.page.querySelector(".nv-form")?.prepend(this.mistEl);
    // Máy không có WebGL2 thì mountBakedScene không gắn gì: cột giữa chỉ còn bóng pháp tướng trên giấy.
    this.mist ??= mountBakedScene(this.mistEl, "son_thuy", { tone: "giay", seed: 3, sky: false });
    cropIcons(this.page);
    this.drawDoll();
  }

  // ---- Cột trái: thông tin ---------------------------------------------------------------------------------------

  private info(v: NhanVatView): string {
    const group = (title: string, body: string, open = true) => `<details class="nv-group"${open ? " open" : ""}><summary><span>${title}</span></summary>${body}</details>`;
    const row = (k: string, val: string) => `<div class="nv-row"><span>${k}</span><b>${val}</b></div>`;
    const c = v.cultivation;
    const exp = Math.min(1, v.exp / v.expToNext);
    const statRow = (s: StatLine) => `<button type="button" class="nv-row" data-act="stat" data-stat="${s.id}"><span>${esc(s.label)}</span><b>${statText(s)}</b></button>`;
    const combat = COMBAT.map((id) => v.stats.find((s) => s.id === id)).filter((s): s is StatLine => !!s);
    const s = this.ctx.auth.session();
    const age = s ? ageOn(s.birthDate) : ADULT_AGE;
    return `
      ${group("Thân phận", `
        ${row("Cảnh giới", `${esc(v.top.realm)} · cấp ${v.level}`)}
        ${row("Tông môn", esc(v.sect.name))}
        ${row("Chức vị", esc(v.sect.role ? ROLE_NAMES[v.sect.role] : "Chưa vào tông"))}
        ${row("Phe", esc(v.sect.faction))}
        ${row(term("Sát nghiệp", "sat_nghiep"), `<span class="${v.satNghiep > 0 ? "bad" : ""}">${fmt(v.satNghiep)}</span>`)}
        ${row("Cống hiến", fmt(v.contribution))}
        ${row("Linh thạch", `<span class="stone">${fmt(v.top.linhThach)}</span>`)}`)}
      ${group(`${term("Linh căn", "linh_can")} và tài năng`, `
        ${v.roots.map((e) => `<div class="nv-row"><span class="nv-el"><img src="${assetUrl(`he/${e}`)}" alt="">${esc(ELEMENT_STYLE[e].name)}</span><b class="tag">Linh căn</b></div>`).join("")}
        <div class="nv-row"><span>${term("Tài năng", "tai_nang")}</span><b>${esc(v.talent.name)}</b></div>
        <p class="nv-note">${esc(v.talent.combat)}</p>`)}
      ${group("Chỉ số chiến đấu", `
        <div class="nv-row"><span>${term("Lực chiến", "luc_chien")}</span><b class="power">${fmt(v.power.total)}</b></div>
        ${combat.map(statRow).join("")}
        <p class="nv-note">Chạm một dòng để xem nguồn: gốc theo cấp, đồ, ngọc, thú, tài năng, linh căn.</p>`)}
      ${group("Tu luyện", `
        <div class="nv-row"><span>Tu vi</span><b>${fmt(v.exp)} / ${fmt(v.expToNext)}</b></div>
        <div class="bar"><i style="width:${(exp * 100).toFixed(1)}%"></i></div>
        <button type="button" class="nv-row" data-act="cultivation"><span>Tốc độ bế quan</span><b>${fmt(c.perHour)}/giờ</b></button>
        ${row("Mốc đột phá", `cấp ${c.breakAt.level} → ${esc(c.breakAt.realm)}`)}
        ${c.retreat ? row("Đang bế quan", `<span data-cd="${c.retreat.endsAt}">${cd(c.retreat.endsAt)}</span>`) : ""}`)}
      ${s ? group("Tài khoản", `
        ${row("Số điện thoại", esc(s.phoneMasked))}
        ${row("Nhóm tuổi", age < GUARDIAN_AGE ? "Dưới 16, có giám hộ" : age < ADULT_AGE ? "Dưới 18" : "Từ 18")}
        <button type="button" class="btn small nv-logout" data-act="logout">${icon("logout")} Đăng xuất</button>`, false) : ""}
      <button type="button" class="seal nv-main" data-act="main"${c.retreat && !c.canBreak ? " disabled" : ""}>${c.canBreak ? "Đột phá" : c.retreat ? "Đang bế quan" : "Bế quan"}</button>`;
  }

  // ---- Cột giữa: Pháp tướng -------------------------------------------------------------------------------------

  private form(v: NhanVatView): string {
    const riding = v.mounts[v.riding];
    const combos = v.combos.filter((k) => k.active);
    const wheelLegend = this.showWheel
      ? `<li><i class="lg-root"></i>Linh căn</li><li><i class="lg-sinh"></i>Tương sinh</li><li><i class="lg-khac"></i>Tương khắc</li><li><i class="lg-cuc"></i>Đối cực</li><li><i class="lg-bien"></i>Biến dị</li>`
      : "";
    return `
      <div class="nv-sub"><b>Pháp tướng · ${esc(v.roots.map((e) => ELEMENT_STYLE[e].name).join(", "))} linh căn</b>
        <button type="button" class="nv-tog" data-act="wheel" aria-pressed="${this.showWheel}">Vòng hệ</button></div>
      <div class="pt-stage${this.showWheel ? " wheel-on" : ""}">
        <canvas class="pt-ghost" aria-hidden="true"></canvas>
        ${elementWheel(v.roots)}
        <canvas class="doll" aria-label="Hình nhân vật"></canvas>
        <div class="pt-gear left">${LEFT.map((s) => this.gearSlot(v, s)).join("")}</div>
        <div class="pt-gear right">${RIGHT.map((s) => this.gearSlot(v, s)).join("")}</div>
      </div>
      <h3 class="nv-h">Công pháp mang vào trận <span>${v.loadout.filter(Boolean).length} / ${v.loadout.length}</span></h3>
      <div class="pt-tech">${v.loadout.map((t, i) => this.techSlot(t, i)).join("")}</div>
      <h3 class="nv-h">Thú <span>${riding ? `đang cưỡi ${esc(riding.name)}` : "chưa cưỡi"}</span></h3>
      <div class="pt-pets">${v.mounts
        .map((m, i) =>
          m
            ? `<button type="button" class="pt-pet${i === v.riding ? " riding" : ""}" data-act="pet" data-i="${i}" aria-label="${esc(m.name)}${i === v.riding ? ", đang cưỡi" : ""}">
                <img src="${assetUrl(m.icon)}" alt=""><i class="el" style="background:${ELEMENT_STYLE[m.element].color}"></i>${i === v.riding ? `<span class="saddle">${icon("yen")}</span>` : ""}</button>`
            : `<button type="button" class="pt-pet empty" data-act="pet" data-i="${i}" aria-label="Ô thú trống">+</button>`,
        )
        .join("")}</div>
      ${combos.length ? `<p class="pt-combos">${combos.map((k) => `<span class="chip sk" title="${esc(k.effect)}">${esc(k.name)}</span>`).join("")}</p>` : ""}
      <ul class="pt-legend">${wheelLegend}
        <li><b class="lg-plus">+8</b>Nấc rèn</li>
        <li><b class="lg-gem">◆</b>Dòng khảm</li>
        <li><i class="lg-dur"></i>Độ bền</li>
        <li><span class="lg-yen">${icon("yen")}</span>Thú cưỡi</li>
      </ul>`;
  }

  private gearSlot(v: NhanVatView, s: GearSlot): string {
    const g = v.gear[s];
    if (!g) return `<button type="button" class="pt-slot empty" data-act="slot" data-slot="${s}" data-drop="gear:${s}"><span class="lbl">${SLOT_NAMES[s]}</span></button>`;
    const dur = g.durability / g.durabilityMax;
    return `<button type="button" class="pt-slot r-${g.rarity}" data-act="slot" data-slot="${s}" data-drop="gear:${s}" data-drag="gear:${s}" aria-label="${esc(`${SLOT_NAMES[s]}: ${g.name} +${g.plus}`)}">
      ${g.art ? `<img class="ve" src="${artUrl(g.art)}" alt="">` : g.icon ? `<img src="${assetUrl(g.icon)}" alt="" data-crop>` : icon(SLOT_GLYPH[s], "glyph")}
      <span class="plus">+${g.plus}</span>
      ${g.sockets ? `<span class="gems">◆${g.gems.length}/${g.sockets}</span>` : ""}
      <span class="dur${g.durability < LOW ? " low" : ""}"><i style="width:${(dur * 100).toFixed(0)}%"></i></span>
    </button>`;
  }

  private techSlot(t: TechniqueCard | null, i: number): string {
    if (!t) return `<button type="button" class="pt-tslot empty" data-act="tech" data-i="${i}" data-drop="tech:${i}"><span class="lbl">Ô ${i + 1}</span></button>`;
    const st = ELEMENT_STYLE[t.element];
    return `<button type="button" class="pt-tslot" data-act="tech" data-i="${i}" data-drop="tech:${i}" data-drag="tech:${i}" style="--c:${st.color}" aria-label="${esc(t.name)}">
      <img class="type" src="${assetUrl(`chieu/${t.type}`)}" alt="">
      <span class="els"><img src="${assetUrl(`he/${t.element}`)}" alt="${esc(st.name)}" title="Hệ chủ ${esc(st.name)}">${t.subElements.map((e) => `<img class="sub" src="${assetUrl(`he/${e}`)}" alt="" title="Hệ phụ ${esc(ELEMENT_STYLE[e].name)}">`).join("")}</span>
      <span class="name">${esc(t.name)}</span>
    </button>`;
  }

  // ---- Cột phải: túi ------------------------------------------------------------------------------------------

  private bag(v: NhanVatView): string {
    const real = v.bag.items.filter((it) => it.kind !== "cong_phap");
    const byRarity = this.kind === "trang_bi";
    const shown = v.bag.items.filter(
      (it) => (this.kind === "all" ? it.kind !== "cong_phap" : it.kind === this.kind) && (this.grade === "all" || (byRarity ? it.rarity === this.grade : it.grade === this.grade)),
    );
    const empty = this.kind === "all" && this.grade === "all" ? Math.max(0, v.bag.capacity - real.length) : 0;
    const opt = (val: string, label: string, cur: string) => `<option value="${val}"${val === cur ? " selected" : ""}>${label}</option>`;
    const sel = v.bag.items.find((it) => it.uid === this.selected);
    return `
      <div class="nv-sub"><b>Túi đồ</b><span class="muted"><b>${real.length}</b> / ${v.bag.capacity} ô</span></div>
      <div class="bag-filters">
        <select data-filter="kind" aria-label="Lọc theo loại">${opt("all", "Tất cả loại", this.kind)}${(Object.keys(KIND_NAMES) as ItemKind[]).map((k) => opt(k, KIND_NAMES[k], this.kind)).join("")}</select>
        ${byRarity
          ? `<select data-filter="grade" aria-label="Lọc theo độ hiếm">${opt("all", "Mọi độ hiếm", this.grade)}${(Object.keys(RARITY_NAMES) as Rarity[]).map((r) => opt(r, RARITY_NAMES[r], this.grade)).join("")}</select>`
          : `<select data-filter="grade" aria-label="Lọc theo phẩm">${opt("all", "Tất cả phẩm", this.grade)}${(Object.keys(GRADE_NAMES) as ItemGrade[]).map((g) => opt(g, GRADE_NAMES[g], this.grade)).join("")}</select>`}
      </div>
      <div class="bag-grid" data-drop="bag">
        ${shown.map((it) => this.cell(it)).join("")}${"<span class=\"bag-cell empty\"></span>".repeat(empty)}
        ${!shown.length && !empty ? `<p class="nv-note bag-none">Không có món nào khớp bộ lọc.</p>` : ""}
      </div>
      ${this.kind === "cong_phap" ? `<p class="nv-note">Công pháp đã học không chiếm ô túi; kéo vào ô công pháp để mang vào trận.</p>` : ""}
      <div class="bag-detail">${sel ? this.detail(sel, v) : `<p class="nv-note">Chọn một món để xem. Kéo trang bị hay công pháp sang Pháp tướng để dùng, kéo về túi để tháo.</p>`}</div>`;
  }

  private cell(it: BagItem): string {
    return `<button type="button" class="bag-cell ${tone(it)}${it.uid === this.selected ? " sel" : ""}" data-act="item" data-uid="${it.uid}"${it.gear || it.technique ? ` data-drag="item:${it.uid}"` : ""} aria-label="${esc(`${it.name}${it.count > 1 ? ` × ${it.count}` : ""}`)}" title="${esc(it.name)}">
      ${this.itemIcon(it)}${it.count > 1 ? `<span class="n">${it.count}</span>` : ""}${it.kind === "cong_phap" ? `<span class="learned">Đã học</span>` : ""}
    </button>`;
  }

  private itemIcon(it: BagItem): string {
    if (it.art) return `<img class="ve" src="${artUrl(it.art)}" alt="">`;
    if (it.icon) return `<img src="${assetUrl(it.icon)}" alt=""${it.gear ? " data-crop" : ""}>`;
    const glyph = it.gear ? SLOT_GLYPH[it.gear.slot] : KIND_GLYPH[it.kind];
    return `<span class="glyph-wrap"${it.element ? ` style="color:${ELEMENT_STYLE[it.element as Element].color}"` : ""}>${icon(glyph, "glyph")}</span>`;
  }

  /** Khung chi tiết món: tên theo màu phẩm, loại và phẩm, công dụng, chỉ số, nút dùng. */
  private detail(it: BagItem, v: NhanVatView): string {
    const head = `<div class="bd-head"><span class="bag-cell ${tone(it)}">${this.itemIcon(it)}</span><span class="grow"><b class="${tone(it)}">${esc(it.name)}</b>
      <span class="block muted">${KIND_NAMES[it.kind]} · ${it.rarity ? `<span class="rar r-${it.rarity}">${RARITY_NAMES[it.rarity]}</span>` : esc(it.gradeLabel)}${it.count > 1 ? ` · × ${it.count}` : ""}</span></span>${it.element ? elementChip(it.element as Element) : ""}</div>`;
    let body = `<p class="nv-note">${esc(it.detail)}</p>`;
    let act = "";
    if (it.gear) {
      const g = it.gear;
      const k = 1 + 0.03 * g.plus;
      const cur = v.gear[g.slot];
      body += `<dl class="kv">
        <dt>Ô</dt><dd>${SLOT_NAMES[g.slot]}${cur ? ` <span class="muted">(đang mặc ${esc(cur.name)})</span>` : ""}</dd>
        <dt>Cường hóa</dt><dd>+${g.plus} / +30</dd>
        ${(Object.entries(g.stats) as [string, number][]).map(([key, val]) => `<dt>${STAT_KEYS[key]}</dt><dd>${fmt(val * k)}</dd>`).join("")}
        <dt>Dòng khảm</dt><dd>${g.sockets}</dd></dl>`;
      act = `<button type="button" class="seal" data-act="wear" data-uid="${it.uid}">Mặc</button>`;
    } else if (it.technique) {
      const t = it.technique;
      body += `<p>${elementChip(t.element)} ${t.subElements.map((e) => elementChip(e)).join(" ")} ${skillChip(t.type)}</p>`;
      act = `<button type="button" class="seal" data-act="carry" data-id="${t.id}"${v.loadout.every(Boolean) ? " disabled" : ""}>Mang vào trận</button>${v.loadout.every(Boolean) ? `<span class="muted">Đủ 4 ô; kéo vào một ô để thay.</span>` : ""}`;
    } else if (it.kind === "tan_quyen") act = `<button type="button" class="seal" data-act="deposit" data-uid="${it.uid}">Nộp Tàng Kinh Các</button>`;
    else act = `<button type="button" class="btn small" data-act="use" data-uid="${it.uid}">Dùng</button>`;
    return `${head}${body}<div class="actions">${act}</div>`;
  }

  // ---- Hình nhân vật ------------------------------------------------------------------------------------------

  /** Thân (đã gồm áo), mũ neo ở đầu, vũ khí neo ở tay; dùng đúng hàm vẽ của màn Trận. */
  private drawDoll(): void {
    this.drawGhost();
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
    ctx.fillStyle = "rgba(42, 29, 20, 0.25)";
    ctx.beginPath();
    ctx.ellipse(w / 2, h - 10, w * 0.28, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    const look = { body: v.look.body, outfit: v.look.outfit, hat: v.look.hat, weapon: v.look.weapon };
    const info = animInfo(this.sprites, look, "dung");
    const scale = Math.min(2.6, (h - 14) / 72);
    if (!info || !drawCharacter(ctx, this.sprites, look, "dung", this.frame % info.frames, w / 2, h - 10, scale, false)) {
      // Chưa có dải hoạt ảnh: vẽ ảnh tĩnh của thân mặc áo.
      const img = this.sprites.get(`nhan_vat/${v.look.body}/${v.look.outfit}`);
      if (img) ctx.drawImage(img, w / 2 - 32 * scale, h - 10 - 56 * scale, 64 * scale, 64 * scale);
    }
  }

  /**
   * Bóng pháp tướng: chính nhân vật phóng to gần bằng cột, chân chìm dưới đáy; CSS nhuộm mực nâu, làm nhòe và mờ dần.
   * Vẽ ở 1 điểm ảnh CSS (đằng nào cũng nhòe) và cùng khung hoạt ảnh với tu sĩ, như cái bóng thở theo.
   */
  private drawGhost(): void {
    const c = this.ghost;
    const v = this.data;
    if (!c || !v || !c.isConnected) return;
    const w = c.clientWidth;
    const h = c.clientHeight;
    if (!w || !h) return;
    if (c.width !== w || c.height !== h) {
      c.width = w;
      c.height = h;
    }
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, w, h);
    ctx.imageSmoothingEnabled = true;
    const look = { body: v.look.body, outfit: v.look.outfit, hat: v.look.hat, weapon: v.look.weapon };
    const info = animInfo(this.sprites, look, "dung");
    const scale = (h * 1.18) / 72;
    const foot = h * 1.16;
    if (!info || !drawCharacter(ctx, this.sprites, look, "dung", this.frame % info.frames, w / 2, foot, scale, false)) {
      const img = this.sprites.get(`nhan_vat/${v.look.body}/${v.look.outfit}`);
      if (img) ctx.drawImage(img, w / 2 - 32 * scale, foot - 56 * scale, 64 * scale, 64 * scale);
    }
  }

  // ---- Thao tác -----------------------------------------------------------------------------------------------

  protected override act(name: string, el: HTMLElement): void {
    const v = this.data;
    if (!v || this.dropped) return;
    const uid = Number(el.dataset.uid);
    if (name === "back") this.ctx.nav.back();
    else if (name === "help") this.openHelp();
    else if (name === "tab") this.setTab(el.dataset.tab as NhanVatTab);
    else if (name === "wheel") {
      this.showWheel = !this.showWheel;
      this.render(v);
    }
    else if (name === "logout") {
      this.ctx.auth.logout();
      location.reload();
    } else if (name === "stat") this.openStat(v.stats.find((s) => s.id === el.dataset.stat)!);
    else if (name === "cultivation") this.openCultivation(v);
    else if (name === "main") toast(v.cultivation.canBreak ? "Đột phá cảnh giới và thiên kiếp có ở khối M4; prototype chưa làm." : "Bế quan có ở khối M4; prototype chưa làm.");
    else if (name === "slot") this.openSlot(v, el.dataset.slot as GearSlot);
    else if (name === "tech") this.openTech(v, Number(el.dataset.i));
    else if (name === "pet") this.openPet(v, Number(el.dataset.i));
    else if (name === "item") {
      this.selected = uid;
      const it = v.bag.items.find((x) => x.uid === uid);
      // Màn rộng có khung chi tiết cạnh túi; điện thoại mở bảng trượt để khỏi phải cuộn xuống dưới 50 ô.
      if (it && !matchMedia(WIDE).matches) {
        const body = openSheet(it.name, this.detail(it, v));
        body.addEventListener("click", (e) => {
          const a = (e.target as HTMLElement).closest<HTMLElement>("[data-act]");
          if (a && !(a as HTMLButtonElement).disabled) {
            closeSheet();
            this.act(a.dataset.act!, a);
          }
        });
      } else this.render(v);
    } else if (name === "wear") void this.send({ type: "mac_do", uid });
    else if (name === "carry") void this.carry(v, Number(el.dataset.id), v.loadout.findIndex((t) => !t));
    else if (name === "deposit") void this.send({ type: "nop_tan_quyen", scrollUid: uid });
    else if (name === "use") toast("Dùng đan, phù và ấp trứng có ở khối M6; prototype chưa làm.");
  }

  /** Đặt công pháp vào ô i (thay món đang ở đó); i = -1 hoặc ô sau cùng thì thêm vào cuối. */
  private carry(v: NhanVatView, id: number, i: number): Promise<unknown> {
    const ids = v.loadout.map((t) => t?.id ?? null).map((x) => (x === id ? null : x));
    if (i >= 0) ids[i] = id;
    else ids.push(id);
    return this.send({ type: "mang_vao_tran", techniqueIds: ids.filter((x): x is number => x !== null) });
  }

  private openHelp(): void {
    openSheet(
      "Màn Nhân vật",
      `<ul class="list nv-help">
        <li><b>Thông tin</b>: thân phận, linh căn, chỉ số chiến đấu, tu luyện. Chạm một chỉ số để xem nguồn.</li>
        <li><b>Pháp tướng</b>: 7 ô trang bị quanh hình (màu nền ô là độ hiếm: lục, lam, tím, vàng, đỏ), 4 ô công pháp mang vào trận, 5 ô thú. Bấm "Vòng hệ" để xem 12 hệ: hệ linh căn sáng, vạch xanh là tương sinh, vạch đỏ là tương khắc, nét đứt là đối cực.</li>
        <li><b>Túi</b>: 50 ô gốc, lọc theo loại và phẩm. Màn rộng kéo món sang ô để mặc, kéo về túi để tháo; điện thoại chạm ô hoặc chạm món rồi chọn.</li>
      </ul>`,
    );
  }

  private openStat(s: StatLine): void {
    openSheet(
      `${s.label}: ${statText(s)}`,
      `<dl class="kv">${s.sources.map((x) => `<dt>${esc(x.label)}</dt><dd>${x.value > 0 && x.label !== "Gốc theo cấp" ? "+" : ""}${statText(s, x.value)}</dd>`).join("")}</dl>
       <p class="muted">Số của đồ, ngọc và thú là dữ liệu mẫu.</p>`,
    );
  }

  private openCultivation(v: NhanVatView): void {
    const c = v.cultivation;
    openSheet(
      `Tốc độ bế quan: ${fmt(c.perHour)}/giờ`,
      `<dl class="kv">${c.sources.map((x) => `<dt>${esc(x.label)}</dt><dd>${x.value ? `+${fmt(x.value)}` : "—"}</dd>`).join("")}</dl>
       <p class="muted">Đề xuất: bế quan 8 giờ đủ một cấp ở Hạ vị; linh khí vị diện nhân thẳng vào tốc độ (GDD mục 7). Còn ${fmt(Math.max(0, v.expToNext - v.exp))} tu vi tới cấp kế; mốc đột phá cấp ${c.breakAt.level}.</p>`,
    );
  }

  /** Ô trang bị: món đang mặc, các món cùng ô trong túi để thay, nút Tháo. */
  private openSlot(v: NhanVatView, slot: GearSlot): void {
    const g = v.gear[slot];
    const spare = v.bag.items.filter((it) => it.gear?.slot === slot);
    const body = openSheet(
      g ? `${SLOT_NAMES[slot]}: ${g.name}` : SLOT_NAMES[slot],
      `${g ? this.gearDetail(g) : `<p class="muted">Chưa mặc món nào. Đồ rơi ở bí cảnh hoặc rèn ở lò rèn.</p>`}
       ${spare.length ? `<h3>Trong túi</h3><ul class="list">${spare
         .map((it) => `<li class="row"><span class="bag-cell ${tone(it)}">${this.itemIcon(it)}</span><span class="grow"><b>${esc(it.name)}</b><span class="muted block">${it.rarity ? RARITY_NAMES[it.rarity] : esc(it.gradeLabel)} · +${it.gear!.plus}</span></span><button type="button" class="btn small" data-a="wear" data-uid="${it.uid}">Mặc</button></li>`)
         .join("")}</ul>` : ""}
       ${g ? `<div class="actions"><button type="button" data-a="off">Tháo về túi</button><button type="button" data-a="ren">Rèn</button></div>` : ""}`,
    );
    cropIcons(body);
    body.addEventListener("click", (e) => {
      const a = (e.target as HTMLElement).closest<HTMLElement>("[data-a]");
      if (!a) return;
      closeSheet();
      if (a.dataset.a === "wear") void this.send({ type: "mac_do", uid: Number(a.dataset.uid) });
      else if (a.dataset.a === "off") void this.send({ type: "thao_do", slot });
      else toast("Rèn, sửa, khảm có ở khối MVP M6; prototype chưa làm.");
    });
  }

  private gearDetail(g: GearItem): string {
    const k = 1 + 0.03 * g.plus;
    const stats = (Object.entries(g.stats) as [string, number][])
      .map(([key, val]) => `<dt>${STAT_KEYS[key]}</dt><dd>${fmt(val * k)} <span class="muted">(${fmt(val)} + ${g.plus * 3}%)</span></dd>`)
      .join("");
    const gems = g.gems.map((gem) => `<li class="row">${elementChip(gem.element)} <span class="grow">Ngọc cấp ${gem.level}</span><span class="muted">+${pctText(2.5 * gem.level * (gem.level + 1))}</span></li>`).join("");
    return `<dl class="kv">
        <dt>Độ hiếm</dt><dd class="rar r-${g.rarity}">${RARITY_NAMES[g.rarity]}</dd>
        <dt>Cường hóa</dt><dd>+${g.plus} / +30</dd>
        <dt>Độ bền</dt><dd class="${g.durability < LOW ? "bad" : ""}">${g.durability} / ${g.durabilityMax}</dd>
        ${stats}
        <dt>Dòng khảm</dt><dd>${g.gems.length} / ${g.sockets}</dd>
      </dl>${gems ? `<ul class="list">${gems}</ul>` : ""}`;
  }

  /** Ô công pháp: công pháp đang mang, các công pháp đã học để thay, nút Bỏ ra. */
  private openTech(v: NhanVatView, i: number): void {
    const t = v.loadout[i];
    const free = v.learned.filter((x) => !v.loadout.some((y) => y?.id === x.id));
    const body = openSheet(
      t ? t.name : `Ô công pháp ${i + 1}`,
      `${t ? `<p>${elementChip(t.element)} ${t.subElements.map((e) => elementChip(e)).join(" ")} ${skillChip(t.type)}</p><p class="muted">${esc(t.gradeName)}${t.layer ? ` · tầng ${t.layer}` : ""} · ${esc(t.summary)}</p>` : `<p class="muted">Ô trống.</p>`}
       ${free.length ? `<h3>Đã học</h3><ul class="list">${free
         .map((x) => `<li class="row">${elementChip(x.element, false)}<span class="grow"><b>${esc(x.name)}</b><span class="muted block">${esc(x.gradeName)} · ${esc(x.summary)}</span></span><button type="button" class="btn small" data-a="carry" data-id="${x.id}">Mang</button></li>`)
         .join("")}</ul>` : ""}
       ${t ? `<div class="actions"><button type="button" data-a="off">Bỏ ra</button></div>` : ""}`,
    );
    body.addEventListener("click", (e) => {
      const a = (e.target as HTMLElement).closest<HTMLElement>("[data-a]");
      if (!a) return;
      closeSheet();
      if (a.dataset.a === "carry") void this.carry(v, Number(a.dataset.id), i);
      else if (a.dataset.a === "off") void this.send({ type: "mang_vao_tran", techniqueIds: v.loadout.filter((x, j) => x && j !== i).map((x) => x!.id) });
    });
  }

  private openPet(v: NhanVatView, i: number): void {
    const m = v.mounts[i];
    if (!m) {
      openSheet("Ô thú trống", `<p class="muted">Thuần phục ở hang dị thú hoặc ấp trứng thú trong túi. Mỗi người tối đa 5 thú (GDD mục 6).</p>`);
      return;
    }
    const body = openSheet(
      m.name,
      `<div class="pet-hero"><img src="${assetUrl(m.icon)}" alt=""></div>
       <p>${elementChip(m.element)} <span class="muted">${esc(m.grade)} · ${esc(m.realm)}</span></p>
       <p class="muted">Cả 5 thú cộng chỉ số cho chủ; chọn 1 con làm thú cưỡi, đổi ở thành chủ hoặc sơn môn.</p>
       <div class="actions">${i === v.riding ? `<button type="button" disabled>Đang cưỡi</button>` : `<button type="button" class="seal" data-a="ride">Cưỡi con này</button>`}</div>`,
    );
    body.addEventListener("click", (e) => {
      if ((e.target as HTMLElement).closest("[data-a='ride']")) {
        closeSheet();
        void this.send({ type: "cuoi_thu", index: i });
      }
    });
  }

  // ---- Kéo thả (chuột, bút trên màn rộng) -------------------------------------------------------------------------

  /** Ô thả có nhận món đang kéo không. */
  private accepts(drag: DragRef, drop: string): boolean {
    const v = this.data!;
    const [k, id] = drag.split(":");
    if (k === "item") {
      const it = v.bag.items.find((x) => x.uid === Number(id));
      if (it?.gear) return drop === `gear:${it.gear.slot}`;
      if (it?.technique) return drop.startsWith("tech:");
      return false;
    }
    if (k === "gear") return drop === "bag";
    if (k === "tech") return drop === "bag" || (drop.startsWith("tech:") && drop !== drag);
    return false;
  }

  private drop(drag: DragRef, drop: string): void {
    const v = this.data!;
    const [k, id] = drag.split(":");
    const target = Number(drop.split(":")[1]);
    if (k === "item") {
      const it = v.bag.items.find((x) => x.uid === Number(id))!;
      if (it.gear) void this.send({ type: "mac_do", uid: it.uid });
      else if (it.technique) void this.carry(v, it.technique.id, target);
    } else if (k === "gear") void this.send({ type: "thao_do", slot: id as GearSlot });
    else if (k === "tech") {
      const ids = v.loadout.map((t) => t?.id ?? null);
      const i = Number(id);
      if (drop === "bag") ids[i] = null;
      else [ids[i], ids[target]] = [ids[target] ?? null, ids[i]];
      void this.send({ type: "mang_vao_tran", techniqueIds: ids.filter((x): x is number => x !== null) });
    }
  }

  private dragStart(e: PointerEvent): void {
    // Chạm trên điện thoại để cuộn và mở bảng chọn; kéo thả chỉ cho chuột và bút.
    if (e.pointerType === "touch" || e.button !== 0) return;
    const src = (e.target as HTMLElement).closest<HTMLElement>("[data-drag]");
    if (!src || !this.data) return;
    const ref = src.dataset.drag!;
    const x0 = e.clientX;
    const y0 = e.clientY;
    let ghost: HTMLElement | undefined;
    let hover: HTMLElement | null = null;
    const targets = () => [...this.page.querySelectorAll<HTMLElement>("[data-drop]")];
    const at = (x: number, y: number) => document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-drop]") ?? null;
    const move = (ev: PointerEvent) => {
      if (!ghost) {
        if (Math.hypot(ev.clientX - x0, ev.clientY - y0) < 6) return;
        const r = src.getBoundingClientRect();
        ghost = src.cloneNode(true) as HTMLElement;
        ghost.classList.add("drag-ghost");
        ghost.style.width = `${r.width}px`;
        ghost.style.height = `${r.height}px`;
        document.body.append(ghost);
        src.classList.add("dragging");
        for (const t of targets()) if (this.accepts(ref, t.dataset.drop!)) t.classList.add("drop-ok");
      }
      ghost.style.transform = `translate(${ev.clientX - ghost.offsetWidth / 2}px, ${ev.clientY - ghost.offsetHeight / 2}px)`;
      const h = at(ev.clientX, ev.clientY);
      if (h !== hover) {
        hover?.classList.remove("drop-hover");
        hover = h && h.classList.contains("drop-ok") ? h : null;
        hover?.classList.add("drop-hover");
      }
    };
    const end = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      if (!ghost) return;
      ghost.remove();
      src.classList.remove("dragging");
      for (const t of targets()) t.classList.remove("drop-ok", "drop-hover");
      const t = ev.type === "pointerup" ? at(ev.clientX, ev.clientY) : null;
      // Cú nhấp đi sau lần thả không được mở bảng chọn.
      this.dropped = true;
      setTimeout(() => (this.dropped = false));
      if (t && this.accepts(ref, t.dataset.drop!)) this.drop(ref, t.dataset.drop!);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  }
}

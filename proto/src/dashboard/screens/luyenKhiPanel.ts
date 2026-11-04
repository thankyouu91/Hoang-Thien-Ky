// Mục Luyện khí ở màn Nhân vật (GDD tab Trang bị phần 13, đặc tả luyen-khi.md): cột giữa thứ ba cạnh Pháp tướng và
// Đạo Cơ Bàn (điện thoại là tab Luyện khí). Năm phần: Phân giải nhiều món một lần, Tẩy luyện chỉ số phụ (4 loại của ô,
// loại đang có), Khí linh (thanh 0–9 cũng hiện trên ô đồ ở Pháp tướng; cấp 3, 6, 9 bật bảng chọn 1 trong 3 khí văn),
// Ngọc (hợp song hệ, điểm hóa Phách) và Bảo Giám (sổ chia trang, trang tuần). Danh khí luyện ở Luyện Khí Các (màn Tông
// môn, forge.ts). Số và luật ở ../luyenKhi.ts; trạng thái là mẫu TẠM dùng chung, chờ DashboardSource.
import type { Element } from "@ktlp/sim";
import { REALMS } from "../daoCoBan.ts";
import { icon } from "../icons.ts";
import {
  addExp, BAO_PAGES, canDecompose, gemRate, gemValue, GEM_NAME, hasKhiLinh, khiTinhOf, khiTinhToNext, khiVan, klBonus, klNeed, KL_MAX, KL_PER_KHI_TINH,
  lkPreview, lkState, PHACH_FROM, PHACH_KHI_TINH, PHACH_RATE, phachCode, phachName, RARITY_NAMES, reached, rerollSub, REROLL_KHI_TINH, rollOffer, SLOT_NAMES, SLOTS,
  SONG_HE_FROM, SONG_HE_PART, songHeOk, stoneBack, SUB, syncVan, UNLOCK, VAN_AT, VAN_REROLL, VAN_STACK, vanCount, vanGroup, vanSlots, yieldLocked,
  DMG_CAP, DMG_CAP_PHACH, type Gate, type LkGem, type LkState,
} from "../luyenKhi.ts";
import type { BagItem, GearItem, GearSlot, NhanVatView } from "../source.ts";
import { artUrl, cd, closeSheet, cropIcons, esc, fmt, openSheet, pctText, toast } from "../ui.ts";
import { ELEMENT_STYLE } from "../../theme/elements.ts";

export type LkTab = "phan-giai" | "tay-luyen" | "khi-linh" | "ngoc" | "bao-giam";
const TABS: [LkTab, string][] = [["phan-giai", "Phân giải"], ["tay-luyen", "Tẩy luyện"], ["khi-linh", "Khí linh"], ["ngoc", "Ngọc"], ["bao-giam", "Bảo Giám"]];
const ELEMENTS = Object.keys(GEM_NAME) as Element[];

export interface LkHost {
  redraw(): void;
  forge(): void;
  gearIcon(g: GearItem, s: GearSlot): string;
  itemIcon(it: BagItem): string;
}

const gemLabel = (g: LkGem) => (g.he2 ? `Ngọc song hệ ${ELEMENT_STYLE[g.he].name}·${ELEMENT_STYLE[g.he2].name}` : GEM_NAME[g.he]) + ` cấp ${g.cap}`;
const chance = (perMille: number) => Math.random() * 1000 < perMille;

export class LuyenKhiPanel {
  tab: LkTab = "phan-giai";
  slot: GearSlot = "vu_khi";
  private pick = new Set<number>();
  private gemA?: string;
  /** Dòng chỉ số phụ vừa đổi: tô sáng ở lần vẽ kế. */
  private fresh?: { slot: GearSlot; i: number };

  private host: LkHost;

  constructor(host: LkHost) {
    this.host = host;
  }

  state(v: NhanVatView): LkState {
    return lkState(v);
  }

  private p() {
    return REALMS[lkPreview.realm].p;
  }

  tuRen(v: NhanVatView): boolean {
    return lkPreview.tuRen ?? v.talent.id === "tu_ren";
  }

  /** Món đã phân giải (màn Nhân vật ẩn khỏi túi). */
  gone(v: NhanVatView, uid: number): boolean {
    return this.state(v).gone.has(uid);
  }

  /** Mở thẳng một phần (từ bảng ô trang bị hay chi tiết ngọc). */
  goto(tab: LkTab, slot?: GearSlot): void {
    this.tab = tab;
    if (slot) this.slot = slot;
  }

  /** Ô khí văn đã mở mà chưa chọn. */
  private ready(v: NhanVatView, s: GearSlot): boolean {
    const g = v.gear[s];
    return !!g && hasKhiLinh(g.rarity) && reached(this.p(), UNLOCK.khiLinh) && !!this.state(v).slots[s]?.van.includes(null);
  }

  /** Thanh khí linh 0–9 trên ô đồ (Pháp tướng, Đạo Cơ Bàn, Tẩy luyện); món dưới tím hay chưa mở thì không có. */
  slotBar(v: NhanVatView, s: GearSlot): string {
    const g = v.gear[s];
    if (!g || !hasKhiLinh(g.rarity) || !reached(this.p(), UNLOCK.khiLinh)) return "";
    const kl = this.state(v).slots[s]?.kl;
    if (!kl) return "";
    const f = kl.cap >= KL_MAX ? 1 : (kl.cap + kl.exp / klNeed(kl.cap)) / KL_MAX;
    return `<span class="kl${this.ready(v, s) ? " ready" : ""}" aria-hidden="true"><i style="width:${(f * 100).toFixed(0)}%"></i></span>`;
  }

  /** Nhãn đọc màn hình cho ô đồ có khí linh. */
  slotLabel(v: NhanVatView, s: GearSlot): string {
    if (!this.slotBar(v, s)) return "";
    const kl = this.state(v).slots[s]!.kl;
    return `, khí linh ${kl.cap} trên 9${this.ready(v, s) ? ", có ô khí văn chờ chọn" : ""}`;
  }

  // ---- Vẽ -----------------------------------------------------------------------------------------------------------

  view(v: NhanVatView, switcher: string): string {
    const st = this.state(v);
    const anyReady = SLOTS.some((s) => this.ready(v, s));
    const tabs = TABS.map(
      ([id, label]) =>
        `<button type="button" role="tab" data-act="lk-tab" data-lk="${id}" aria-selected="${this.tab === id}">${label}${id === "khi-linh" && anyReady ? `<i class="lk-dot" aria-label=", có ô khí văn chờ chọn"></i>` : ""}</button>`,
    ).join("");
    const body = {
      "phan-giai": () => this.phanGiai(v),
      "tay-luyen": () => this.tayLuyen(v),
      "khi-linh": () => this.khiLinh(v),
      ngoc: () => this.ngoc(v),
      "bao-giam": () => this.baoGiam(v),
    }[this.tab]();
    return `
      <div class="nv-sub">${switcher}<span class="lk-purse"><span>Khí Tinh <b>${fmt(st.khiTinh)}</b>${st.khiTinhKhoa ? ` <span class="muted">(${fmt(st.khiTinhKhoa)} khóa)</span>` : ""}</span><span>Linh Văn Thạch <b>${st.linhVanThach}</b></span></span></div>
      <div class="seg lk-tabs" role="tablist" aria-label="Phần luyện khí">${tabs}</div>
      <div class="lk-body">${body}</div>
      <div class="lt-realm lk-tools">
        <label>Xem thử ở cảnh giới <select data-filter="lk-realm">${REALMS.map((r, i) => `<option value="${i}"${i === lkPreview.realm ? " selected" : ""}>${r.ten}</option>`).join("")}</select></label>
        <label class="lk-check"><input type="checkbox" data-filter="lk-turen"${this.tuRen(v) ? " checked" : ""}> Như Tu rèn</label>
      </div>
      <p class="nv-note lk-foot">Khí Tinh, khí linh, ngọc cấp cao và sổ Bảo Giám là dữ liệu mẫu; số theo đặc tả (đề xuất). Danh khí luyện ở <button type="button" class="lk-link" data-act="lk-forge">Luyện Khí Các</button> của tông môn.</p>`;
  }

  private locked(g: Gate, what: string): string {
    return `<div class="lk-lock"><i class="lg-lock" aria-hidden="true"></i><b>Mở ở ${esc(g.ten)}</b><p class="nv-note">${esc(what)}</p></div>`;
  }

  /** Ô đồ nhỏ để chọn ô (Tẩy luyện). */
  private miniSlot(v: NhanVatView, s: GearSlot): string {
    const g = v.gear[s];
    const sel = s === this.slot;
    if (!g) return `<button type="button" class="pt-slot empty${sel ? " sel" : ""}" data-act="lk-slot" data-slot="${s}" aria-pressed="${sel}"><span class="lbl">${SLOT_NAMES[s]}</span></button>`;
    return `<button type="button" class="pt-slot r-${g.rarity}${sel ? " sel" : ""}" data-act="lk-slot" data-slot="${s}" aria-pressed="${sel}" aria-label="${esc(`${SLOT_NAMES[s]}: ${g.name}${this.slotLabel(v, s)}`)}">${this.host.gearIcon(g, s)}${this.slotBar(v, s)}</button>`;
  }

  // ---- Phân giải --------------------------------------------------------------------------------------------------

  private candidates(v: NhanVatView): BagItem[] {
    const st = this.state(v);
    return v.bag.items.filter((it) => it.gear && !st.gone.has(it.uid) && canDecompose(it.gear.rarity));
  }

  private yieldOf(items: BagItem[]) {
    let kt = 0;
    let khoa = 0;
    const gems: string[] = [];
    const stones: Partial<Record<string, number>> = {};
    for (const it of items) {
      const g = it.gear!;
      const n = khiTinhOf(g.rarity);
      kt += n;
      if (yieldLocked(g.rarity)) khoa += n;
      for (const gem of g.gems) gems.push(`${GEM_NAME[gem.element]} cấp ${gem.level}`);
      const back = stoneBack(g.plus);
      if (back) stones[g.rarity] = (stones[g.rarity] ?? 0) + back;
    }
    const stoneText = Object.entries(stones).map(([r, n]) => `${RARITY_NAMES[r as keyof typeof RARITY_NAMES].toLowerCase()} cho ${n} nấc`);
    return { kt, khoa, gems, stones: stoneText };
  }

  private phanGiai(v: NhanVatView): string {
    if (!reached(this.p(), UNLOCK.phanGiai)) return this.locked(UNLOCK.phanGiai, "Phân giải đồ từ lam trở lên ra Khí Tinh.");
    const items = this.candidates(v);
    for (const uid of this.pick) if (!items.some((it) => it.uid === uid)) this.pick.delete(uid);
    const sel = items.filter((it) => this.pick.has(it.uid));
    const y = this.yieldOf(sel);
    const cells = items
      .map((it) => {
        const r = it.gear!.rarity;
        const on = this.pick.has(it.uid);
        const lock = yieldLocked(r);
        return `<button type="button" class="bag-cell r-${r}${on ? " sel lk-on" : ""}" data-act="lk-pick" data-uid="${it.uid}" aria-pressed="${on}" aria-label="${esc(`${it.name}, ${RARITY_NAMES[r]}, ${khiTinhOf(r)} Khí Tinh${lock ? " khóa" : ""}`)}" title="${esc(it.name)}">
          ${this.host.itemIcon(it)}${lock ? `<span class="lk-k">khóa</span>` : ""}${on ? `<span class="lk-tick" aria-hidden="true"></span>` : ""}</button>`;
      })
      .join("");
    const back = [...y.gems, ...(y.stones.length ? [`Luyện Khí Thạch ${y.stones.join(", ")}`] : [])];
    return `
      <p class="nv-note">Chạm món để chọn; lục không phân giải được. Ngọc, Ý châu và ấn đang khảm trả lại nguyên vẹn, nửa số nấc cường hóa trả thành Luyện Khí Thạch.</p>
      <div class="lk-quick">
        <button type="button" class="chip plain" data-act="lk-pick-r" data-r="lam">Mọi món lam</button>
        <button type="button" class="chip plain" data-act="lk-pick-r" data-r="tim">Mọi món tím</button>
        ${this.pick.size ? `<button type="button" class="chip plain" data-act="lk-pick-none">Bỏ chọn</button>` : ""}
      </div>
      ${items.length ? `<div class="bag-grid lk-grid">${cells}</div>` : `<p class="nv-note">Túi không có món nào từ lam trở lên.</p>`}
      <div class="lk-sum">
        <div class="lk-yield"><span>Nhận</span><b>${fmt(y.kt)}</b><span>Khí Tinh</span>${y.khoa ? `<span class="muted">(${fmt(y.khoa)} khóa, từ đồ vàng, đỏ)</span>` : ""}</div>
        <p class="nv-note">${sel.length ? (back.length ? `Trả lại: ${esc(back.join("; "))}.` : "Không có ngọc hay ấn khảm để trả lại.") : "Khí Tinh: lam 1, tím 3, vàng 10, đỏ 25; thêm 1 mỗi cấp khí linh."}</p>
        <button type="button" class="seal wide" data-act="lk-decompose"${sel.length ? "" : " disabled"}>${sel.length ? `Phân giải ${sel.length} món` : "Chọn món để phân giải"}</button>
      </div>`;
  }

  private confirmDecompose(v: NhanVatView): void {
    const st = this.state(v);
    const sel = this.candidates(v).filter((it) => this.pick.has(it.uid));
    if (!sel.length) return;
    const y = this.yieldOf(sel);
    const high = sel.some((it) => yieldLocked(it.gear!.rarity));
    const body = openSheet(
      `Phân giải ${sel.length} món`,
      `<ul class="list">${sel
        .map((it) => `<li class="row"><span class="bag-cell r-${it.gear!.rarity}">${this.host.itemIcon(it)}</span><span class="grow"><b>${esc(it.name)}</b><span class="muted block">${RARITY_NAMES[it.gear!.rarity]} · +${it.gear!.plus}</span></span><b>+${khiTinhOf(it.gear!.rarity)}</b></li>`)
        .join("")}</ul>
       <p>Nhận <b>${fmt(y.kt)} Khí Tinh</b>${y.khoa ? `, trong đó ${fmt(y.khoa)} khóa vào nhân vật` : ""}.</p>
       <p class="muted">${high ? "Có món vàng hoặc đỏ. " : ""}Món đã phân giải không lấy lại được; kiểu của món vẫn ghi trong Bảo Giám.</p>
       <div class="actions"><button type="button" data-close>Thôi</button><button type="button" class="seal" data-a="ok">Phân giải</button></div>`,
    );
    cropIcons(body);
    body.addEventListener("click", (e) => {
      if (!(e.target as HTMLElement).closest("[data-a=ok]")) return;
      closeSheet();
      for (const it of sel) {
        st.gone.add(it.uid);
        if (it.code) st.owned.add(it.code);
      }
      st.khiTinh += y.kt;
      st.khiTinhKhoa += y.khoa;
      this.pick.clear();
      toast(`Nhận ${fmt(y.kt)} Khí Tinh.`);
      this.host.redraw();
    });
  }

  // ---- Tẩy luyện ---------------------------------------------------------------------------------------------------

  private tayLuyen(v: NhanVatView): string {
    if (!reached(this.p(), UNLOCK.tayLuyen)) return this.locked(UNLOCK.tayLuyen, "Đổi loại chỉ số phụ của một món sang loại khác trong 4 loại của ô.");
    const st = this.state(v);
    const g = v.gear[this.slot];
    const ls = st.slots[this.slot];
    const tuRen = this.tuRen(v);
    const fresh = this.fresh?.slot === this.slot ? this.fresh.i : -1;
    this.fresh = undefined;
    let body: string;
    if (!g || !ls) body = `<p class="nv-note">Ô ${SLOT_NAMES[this.slot].toLowerCase()} chưa mặc đồ.</p>`;
    else {
      const rows = SUB[this.slot]
        .map((x, i) => {
          const cur = i === ls.sub;
          const tail = cur ? `<span class="badge on">Đang có</span>` : tuRen ? `<button type="button" class="btn small" data-act="lk-sub" data-i="${i}"${st.khiTinh < REROLL_KHI_TINH ? " disabled" : ""}>Chọn</button>` : `<span class="badge"></span>`;
          return `<li class="row lk-sub${cur ? " cur" : ""}${i === fresh ? " new" : ""}"><span class="lk-i">${i + 1}</span><span class="grow"><b>${esc(x.ten)}</b>${i === 0 ? `<span class="muted block">Loại mặc định của ô</span>` : ""}</span><b class="lk-gt">${esc(x.gt)}</b>${tail}</li>`;
        })
        .join("");
      body = `
        <h3 class="nv-h">${esc(g.name)} <span><span class="rar r-${g.rarity}">${RARITY_NAMES[g.rarity]}</span> +${g.plus}</span></h3>
        <ul class="list lk-subs">${rows}</ul>
        <p class="nv-note">Giá trị ở lục +0; món thật nhân theo độ hiếm, cường hóa và bí cảnh như chỉ số phụ cũ. Đổi ngang, không mạnh hơn.</p>
        ${tuRen
          ? `<p class="nv-note">Tu rèn chọn thẳng loại muốn, mỗi lần ${REROLL_KHI_TINH} Khí Tinh cộng linh thạch theo độ hiếm.</p>`
          : `<button type="button" class="seal wide" data-act="lk-reroll"${st.khiTinh < REROLL_KHI_TINH ? " disabled" : ""}>Tẩy luyện · ${REROLL_KHI_TINH} Khí Tinh</button>
             <p class="nv-note">Quay ngẫu nhiên trong 3 loại còn lại; Tu rèn chọn thẳng được. Cộng linh thạch theo độ hiếm (số chờ sheet Tẩy luyện).</p>`}`;
    }
    return `<div class="lt-gear lk-slots" role="group" aria-label="Chọn ô">${SLOTS.map((s) => this.miniSlot(v, s)).join("")}</div>${body}`;
  }

  private setSub(v: NhanVatView, i: number): void {
    const st = this.state(v);
    const ls = st.slots[this.slot];
    if (!ls || st.khiTinh < REROLL_KHI_TINH) return;
    this.spend(st, REROLL_KHI_TINH);
    ls.sub = i;
    this.fresh = { slot: this.slot, i };
    toast(`Chỉ số phụ mới: ${SUB[this.slot][i].ten} ${SUB[this.slot][i].gt}.`);
    this.host.redraw();
  }

  /** Tiêu Khí Tinh khóa trước (không bán được), rồi tới phần tự do. */
  private spend(st: LkState, n: number): void {
    st.khiTinh -= n;
    st.khiTinhKhoa = Math.max(0, Math.min(st.khiTinhKhoa - n, st.khiTinh));
  }

  // ---- Khí linh -----------------------------------------------------------------------------------------------------

  private pips(v: NhanVatView, s: GearSlot): string {
    const g = v.gear[s]!;
    const ls = this.state(v).slots[s]!;
    return VAN_AT.slice(0, vanSlots(g.rarity))
      .map((at, i) => {
        const ma = ls.van[i];
        if (ma) return `<i class="pip on" title="${esc(khiVan(ma)?.ten ?? ma)}"></i>`;
        if (ma === null) return `<i class="pip ready" title="Ô khí văn chờ chọn"></i>`;
        return `<i class="pip" title="Mở ở khí linh cấp ${at}"></i>`;
      })
      .join("");
  }

  private khiLinh(v: NhanVatView): string {
    if (!reached(this.p(), UNLOCK.khiLinh)) return this.locked(UNLOCK.khiLinh, "Món từ tím trở lên có khí linh cấp 0–9: mỗi cấp +0,5% chỉ số gốc, cấp 3, 6, 9 mở ô khí văn.");
    const st = this.state(v);
    const rows = SLOTS.map((s) => {
      const g = v.gear[s];
      const ls = st.slots[s];
      if (!g || !ls) return "";
      const cell = `<span class="bag-cell r-${g.rarity}">${this.host.gearIcon(g, s)}</span>`;
      if (!hasKhiLinh(g.rarity)) return `<li class="row lk-kl off">${cell}<span class="grow"><b>${esc(g.name)}</b><span class="muted block">${RARITY_NAMES[g.rarity]} · khí linh mở từ tím</span></span></li>`;
      const kl = ls.kl;
      const f = kl.cap >= KL_MAX ? 1 : kl.exp / klNeed(kl.cap);
      return `<li><button type="button" class="row lk-kl${this.ready(v, s) ? " ready" : ""}" data-act="lk-kl" data-slot="${s}">${cell}
        <span class="grow"><b>${esc(g.name)}</b><span class="muted block">Linh ${kl.cap}/${KL_MAX} · +${pctText(klBonus(kl.cap))} chỉ số gốc</span>
          <span class="lk-bar"><i style="width:${(f * 100).toFixed(0)}%"></i></span>
          <span class="muted block lk-exp">${kl.cap >= KL_MAX ? "Đã tối đa" : `${fmt(kl.exp)} / ${fmt(klNeed(kl.cap))} kinh nghiệm`}</span></span>
        <span class="lk-pips" aria-label="Khí văn">${this.pips(v, s)}</span>${icon("chevron", "chev")}</button></li>`;
    }).join("");
    return `
      <p class="nv-note">Kinh nghiệm: +1 mỗi trận món được mặc, +5 mỗi lượt bí cảnh, nạp Khí Tinh (1 = ${KL_PER_KHI_TINH}). Món có khí linh từ cấp 1 khóa vào nhân vật.</p>
      <ul class="list lk-kls">${rows}</ul>
      <ul class="pt-legend"><li><i class="pip on"></i>Khí văn đã chọn</li><li><i class="pip ready"></i>Chờ chọn</li><li><i class="pip"></i>Chưa mở</li></ul>`;
  }

  private openKl(v: NhanVatView, s: GearSlot): void {
    const st = this.state(v);
    const g = v.gear[s];
    const ls = st.slots[s];
    if (!g || !ls) return;
    const kl = ls.kl;
    const need = klNeed(kl.cap);
    const toNext = khiTinhToNext(kl);
    const f = kl.cap >= KL_MAX ? 1 : kl.exp / need;
    const vans = VAN_AT.slice(0, vanSlots(g.rarity))
      .map((at, i) => {
        const ma = ls.van[i];
        if (ma) {
          const x = khiVan(ma)!;
          return `<li class="row"><i class="pip on"></i><span class="grow"><b>${esc(x.ten)}</b><span class="muted block">${esc(x.tac)}</span></span><button type="button" class="btn small" data-a="retry" data-i="${i}"${st.linhVanThach < VAN_REROLL && ls.offerAt !== i ? " disabled" : ""}>Tẩy văn</button></li>`;
        }
        if (ma === null) return `<li class="row"><i class="pip ready"></i><span class="grow"><b>Ô ${i + 1} đã mở</b><span class="muted block">Chọn 1 trong 3 khí văn ô ${vanGroup(s)}</span></span><button type="button" class="seal small" data-a="choose" data-i="${i}">Chọn</button></li>`;
        return `<li class="row muted"><i class="pip"></i><span class="grow">Ô ${i + 1}: mở ở khí linh cấp ${at}</span></li>`;
      })
      .join("");
    const feed = (n: number, label: string, seal = false) =>
      `<button type="button"${seal ? ` class="seal"` : ""} data-a="feed" data-n="${n}"${st.khiTinh < n || n < 1 ? " disabled" : ""}>${label}</button>`;
    const body = openSheet(
      `Khí linh · ${g.name}`,
      `<div class="bd-head"><span class="bag-cell r-${g.rarity}">${this.host.gearIcon(g, s)}</span><span class="grow"><b class="r-${g.rarity}">${esc(g.name)}</b><span class="block muted">${SLOT_NAMES[s]} · ${RARITY_NAMES[g.rarity]} · ô ${vanGroup(s)}</span></span></div>
       <dl class="kv">
         <dt>Khí linh</dt><dd>cấp ${kl.cap} / ${KL_MAX}</dd>
         <dt>Kinh nghiệm</dt><dd>${kl.cap >= KL_MAX ? "tối đa" : `${fmt(kl.exp)} / ${fmt(need)}`}</dd>
         <dt>Cộng chỉ số gốc</dt><dd>+${pctText(klBonus(kl.cap))}</dd>
         <dt>Khóa</dt><dd>${kl.cap >= 1 ? "Đã khóa vào nhân vật" : "Khóa từ cấp 1"}</dd>
       </dl>
       <div class="lk-bar big"><i style="width:${(f * 100).toFixed(0)}%"></i></div>
       ${kl.cap < KL_MAX ? `<h3>Nạp Khí Tinh <span class="muted">đang có ${fmt(st.khiTinh)}</span></h3>
         <div class="actions">${feed(1, "+1")}${feed(10, "+10")}${feed(toNext, `Đủ cấp ${kl.cap + 1} (${toNext} Khí Tinh)`, true)}</div>` : ""}
       <h3>Khí văn <span class="muted">${RARITY_NAMES[g.rarity]} tối đa ${vanSlots(g.rarity)} ô</span></h3>
       <ul class="list">${vans}</ul>`,
    );
    cropIcons(body);
    body.addEventListener("click", (e) => {
      const a = (e.target as HTMLElement).closest<HTMLElement>("[data-a]");
      if (!a || (a as HTMLButtonElement).disabled) return;
      const i = Number(a.dataset.i);
      if (a.dataset.a === "feed") {
        const n = Math.min(Number(a.dataset.n), st.khiTinh);
        this.spend(st, n);
        const passed = addExp(kl, n * KL_PER_KHI_TINH);
        syncVan(ls, g.rarity);
        this.host.redraw();
        const open = ls.van.indexOf(null);
        // Đủ cấp 3, 6, 9: bật luôn bảng chọn khí văn.
        if (passed.some((c) => VAN_AT.includes(c)) && open >= 0) this.openVan(v, s, open);
        else {
          if (passed.length) toast(`Khí linh lên cấp ${kl.cap}.`);
          this.openKl(v, s);
        }
      } else if (a.dataset.a === "choose") this.openVan(v, s, i);
      else if (a.dataset.a === "retry") {
        if (ls.offerAt !== i) {
          st.linhVanThach -= VAN_REROLL;
          ls.offer = rollOffer(s);
          ls.offerAt = i;
          this.host.redraw();
        }
        this.openVan(v, s, i);
      }
    });
  }

  /** Bảng chọn 1 trong 3 khí văn của ô i; Tẩy văn quay lại 3 lựa chọn. */
  private openVan(v: NhanVatView, s: GearSlot, i: number): void {
    const st = this.state(v);
    const g = v.gear[s]!;
    const ls = st.slots[s]!;
    if (ls.offerAt !== i || !ls.offer) {
      ls.offer = rollOffer(s);
      ls.offerAt = i;
    }
    const cur = ls.van[i];
    const body = openSheet(
      `Khí văn ô ${i + 1} · ${g.name}`,
      `<p class="muted">Chọn 1 trong 3 khí văn ô ${vanGroup(s)}. Một khí văn có trên nhiều món chỉ tính tối đa ${VAN_STACK} lần; tổng mọi khí văn không quá 1% lực chiến.</p>
       <div class="lk-vans">${ls.offer
         .map((ma) => {
           const x = khiVan(ma)!;
           const n = vanCount(st, ma) - (cur === ma ? 1 : 0);
           return `<button type="button" class="lk-van" data-a="pick" data-ma="${ma}"><b>${esc(x.ten)}</b><span>${esc(x.tac)}</span>${n >= VAN_STACK ? `<em class="bad">Đã có ${n} lần: không tính thêm</em>` : n ? `<em>Đang có trên ${n} món</em>` : ""}</button>`;
         })
         .join("")}</div>
       ${cur ? `<p class="muted">Đang có: ${esc(khiVan(cur)?.ten ?? cur)}. Đóng bảng thì giữ khí văn cũ.</p>` : ""}
       <div class="actions"><button type="button" data-a="reroll"${st.linhVanThach < VAN_REROLL ? " disabled" : ""}>Tẩy văn · ${VAN_REROLL} Linh Văn Thạch (còn ${st.linhVanThach})</button></div>`,
    );
    body.addEventListener("click", (e) => {
      const a = (e.target as HTMLElement).closest<HTMLElement>("[data-a]");
      if (!a || (a as HTMLButtonElement).disabled) return;
      if (a.dataset.a === "pick") {
        ls.van[i] = a.dataset.ma!;
        ls.offer = undefined;
        ls.offerAt = undefined;
        closeSheet();
        toast(`Khắc ${khiVan(a.dataset.ma!)?.ten} vào ${g.name}.`);
        this.host.redraw();
      } else if (a.dataset.a === "reroll") {
        st.linhVanThach -= VAN_REROLL;
        ls.offer = rollOffer(s);
        this.host.redraw();
        this.openVan(v, s, i);
      }
    });
  }

  // ---- Ngọc ------------------------------------------------------------------------------------------------------------

  private gemCell(g: LkGem, cls: string, act: string): string {
    return `<button type="button" class="bag-cell lk-gem ${cls}" data-act="${act}" data-gem="${g.id}" aria-label="${esc(`${gemLabel(g)}${g.n > 1 ? `, ${g.n} viên` : ""}`)}" title="${esc(gemLabel(g))}">
      <img class="ve${g.he2 ? " he1" : ""}" src="${artUrl(`ngoc/${g.he}`)}" alt="">${g.he2 ? `<img class="ve he2" src="${artUrl(`ngoc/${g.he2}`)}" alt="">` : ""}<span class="lk-cap">${g.cap}</span>${g.n > 1 ? `<span class="n">${g.n}</span>` : ""}</button>`;
  }

  private ngoc(v: NhanVatView): string {
    const st = this.state(v);
    const gems = st.gems.filter((g) => g.n > 0);
    const single = gems.filter((g) => !g.he2);
    const a = single.find((g) => g.id === this.gemA && g.cap >= SONG_HE_FROM);
    const pairOk = (g: LkGem) => !!a && g !== a && g.cap === a.cap && songHeOk(a.he, g.he);
    const merge = single.filter((g) => g.cap >= SONG_HE_FROM);
    const mates = a ? ELEMENTS.filter((e) => songHeOk(a.he, e)).map((e) => ELEMENT_STYLE[e].name) : [];
    const songHe = merge.length
      ? `<div class="lk-gems">${merge.map((g) => this.gemCell(g, g === a ? "sel" : a ? (pairOk(g) ? "ok" : "dim") : "", "lk-gem")).join("")}</div>
         <p class="nv-note">${a ? `Viên thứ hai: cùng cấp ${a.cap}, hệ tương sinh hoặc tương hợp với ${esc(ELEMENT_STYLE[a.he].name)} (${esc(mates.join(", "))}).` : "Chọn viên thứ nhất."} Viên song hệ cho mỗi hệ ${pctText(SONG_HE_PART)} giá trị một viên thường; mỗi hệ vẫn tính trong trần mềm của hệ đó.</p>`
      : `<p class="nv-note">Mở khi có ngọc cấp ${SONG_HE_FROM}.</p>`;
    const top = single.filter((g) => g.cap >= PHACH_FROM);
    const phach = top.length
      ? `<ul class="list">${top
          .map((g) => `<li class="row">${this.gemCell(g, "", "lk-gem-x")}<span class="grow"><b>${esc(phachName(g.he))}</b><span class="muted block">${PHACH_KHI_TINH} Khí Tinh · đậu ${pctText(PHACH_RATE)}</span></span><button type="button" class="btn small" data-act="lk-phach" data-gem="${g.id}"${st.khiTinh < PHACH_KHI_TINH ? " disabled" : ""}>Điểm hóa</button></li>`)
          .join("")}</ul>`
      : `<p class="nv-note">Mở khi có ngọc cấp ${PHACH_FROM}.</p>`;
    const duals = gems.filter((g) => g.he2);
    return `
      <h3 class="nv-h">Hợp song hệ <span>2 viên cùng cấp từ ${SONG_HE_FROM}</span></h3>
      ${songHe}
      ${duals.length ? `<div class="lk-gems">${duals.map((g) => this.gemCell(g, "", "lk-gem-x")).join("")}</div>` : ""}
      <h3 class="nv-h">Ngọc Phách <span>điểm hóa viên cấp ${PHACH_FROM}</span></h3>
      ${phach}
      <p class="nv-note">Phách khảm ô công: vừa cho ${pctText(gemValue(10))} như ngọc cấp 10, vừa nâng trần sát thương hệ đó từ ${pctText(DMG_CAP)} lên ${pctText(DMG_CAP_PHACH)}. Mỗi hệ chỉ 1 Phách tính trần. Phách khóa vào nhân vật.</p>
      ${st.phach.length ? `<p class="lk-phachs">${st.phach.map((e) => `<span class="chip el" style="--c:${ELEMENT_STYLE[e].color}">${esc(phachName(e))}</span>`).join("")}</p>` : ""}`;
  }

  private tapGem(v: NhanVatView, id: string): void {
    const st = this.state(v);
    const g = st.gems.find((x) => x.id === id);
    if (!g || g.he2 || g.cap < SONG_HE_FROM) return;
    const a = st.gems.find((x) => x.id === this.gemA);
    if (!a || a === g) {
      this.gemA = a === g ? undefined : id;
      this.host.redraw();
      return;
    }
    if (g.cap !== a.cap || !songHeOk(a.he, g.he)) {
      this.gemA = id;
      this.host.redraw();
      return;
    }
    const each = (gemValue(a.cap) * SONG_HE_PART) / 1000;
    const rate = gemRate(a.cap);
    const body = openSheet(
      "Hợp song hệ",
      `<div class="lk-gems center">${this.gemCell(a, "", "x")}<span class="lk-plus">+</span>${this.gemCell(g, "", "x")}</div>
       <dl class="kv">
         <dt>Ra</dt><dd>Ngọc song hệ ${esc(ELEMENT_STYLE[a.he].name)}·${esc(ELEMENT_STYLE[g.he].name)} cấp ${a.cap}</dd>
         <dt>Mỗi hệ</dt><dd>+${pctText(each)} <span class="muted">(${pctText(SONG_HE_PART)} của ${pctText(gemValue(a.cap))})</span></dd>
         <dt>Tỷ lệ đậu</dt><dd>${pctText(rate)} <span class="muted">như nén lên cấp ${a.cap}</span></dd>
       </dl>
       <p class="muted">Dành cho người mang công pháp hai hệ hoặc cần kháng hai hệ trong ít dòng khảm. Thất bại tính như nén ngọc thất bại (luật chờ rules).</p>
       <div class="actions"><button type="button" data-close>Thôi</button><button type="button" class="seal" data-a="ok">Hợp</button></div>`,
    );
    body.addEventListener("click", (e) => {
      if (!(e.target as HTMLElement).closest("[data-a=ok]")) return;
      closeSheet();
      a.n--;
      g.n--;
      this.gemA = undefined;
      if (chance(rate)) {
        st.gems.push({ id: `sh${Date.now()}`, he: a.he, he2: g.he, cap: a.cap, n: 1 });
        toast(`Thành ngọc song hệ ${ELEMENT_STYLE[a.he].name}·${ELEMENT_STYLE[g.he].name} cấp ${a.cap}.`);
      } else toast("Hợp không đậu: mất hai viên như nén ngọc thất bại.", true);
      this.host.redraw();
    });
  }

  private confirmPhach(v: NhanVatView, id: string): void {
    const st = this.state(v);
    const g = st.gems.find((x) => x.id === id);
    if (!g || g.n < 1 || st.khiTinh < PHACH_KHI_TINH) return;
    const body = openSheet(
      `Điểm hóa ${GEM_NAME[g.he]} cấp ${g.cap}`,
      `<div class="lk-gems center">${this.gemCell(g, "", "x")}</div>
       <dl class="kv">
         <dt>Ra</dt><dd>${esc(phachName(g.he))}</dd>
         <dt>Tốn</dt><dd>${PHACH_KHI_TINH} Khí Tinh</dd>
         <dt>Tỷ lệ đậu</dt><dd>${pctText(PHACH_RATE)}</dd>
       </dl>
       <p class="muted">Thất bại mất Khí Tinh, giữ ngọc. Phù bảo ngọc không áp.</p>
       <div class="actions"><button type="button" data-close>Thôi</button><button type="button" class="seal" data-a="ok">Điểm hóa</button></div>`,
    );
    body.addEventListener("click", (e) => {
      if (!(e.target as HTMLElement).closest("[data-a=ok]")) return;
      closeSheet();
      this.spend(st, PHACH_KHI_TINH);
      if (chance(PHACH_RATE)) {
        g.n--;
        st.phach.push(g.he);
        st.owned.add(phachCode(g.he));
        toast(`Thành ${phachName(g.he)}.`);
      } else toast(`Không đậu: mất ${PHACH_KHI_TINH} Khí Tinh, ngọc còn nguyên.`, true);
      this.host.redraw();
    });
  }

  // ---- Bảo Giám ---------------------------------------------------------------------------------------------------------

  private baoGiam(v: NhanVatView): string {
    if (!reached(this.p(), UNLOCK.baoGiam)) return this.locked(UNLOCK.baoGiam, "Sổ ghi mọi kiểu đã từng sở hữu.");
    const st = this.state(v);
    const w = st.week;
    let have = 0;
    let all = 0;
    const rows = BAO_PAGES.map((pg) => {
      const n = pg.entries.filter((e) => st.owned.has(e.ma)).length;
      have += n;
      all += pg.entries.length;
      return `<li><button type="button" class="row lk-page" data-act="lk-page" data-page="${pg.id}"><span class="grow"><b>${esc(pg.ten)}</b><span class="muted block">Đủ trang: ${esc(pg.thuong)}</span></span>
        <span class="lk-prog"><span><b>${n}</b> / ${pg.entries.length}</span><span class="lk-bar small"><i style="width:${((n / pg.entries.length) * 100).toFixed(0)}%"></i></span></span>${icon("chevron", "chev")}</button></li>`;
    }).join("");
    return `
      <div class="lk-week">
        <b>Trang tuần</b><span>${esc(w.text)}</span>
        <span class="lk-bar"><i style="width:${((w.have / w.need) * 100).toFixed(0)}%"></i></span>
        <span class="muted">${w.have} / ${w.need} · thưởng ${esc(w.thuong)} · còn <span data-cd="${w.endsAt}">${cd(w.endsAt)}</span></span>
      </div>
      <h3 class="nv-h">Sổ Bảo Giám <span>${fmt(have)} / ${fmt(all)} kiểu</span></h3>
      <ul class="list lk-pages">${rows}</ul>
      <p class="nv-note">Ghi cả món đã phân giải. Phần thưởng mỗi trang là đề xuất (chờ sheet Bảo Giám), không cộng chỉ số chiến đấu.</p>`;
  }

  private openPage(v: NhanVatView, id: string): void {
    const st = this.state(v);
    const i = BAO_PAGES.findIndex((p) => p.id === id);
    const pg = BAO_PAGES[i];
    if (!pg) return;
    const n = pg.entries.filter((e) => st.owned.has(e.ma)).length;
    const glyph = pg.id in SLOT_NAMES ? "sword" : "gem";
    const cells = pg.entries
      .map((e, j) => {
        const own = st.owned.has(e.ma);
        const c = e.he ? ` style="--el:${ELEMENT_STYLE[e.he as Element]?.color ?? "#8a7f70"}"` : "";
        return `<button type="button" class="bag-cell lk-entry${e.rarity ? ` r-${e.rarity}` : ""}${own ? " have" : ""}" data-a="entry" data-j="${j}"${c} aria-label="${esc(`${e.ten}${own ? "" : ", chưa có"}`)}">
          ${icon(glyph === "sword" ? "sword" : "gem", "glyph")}${e.art ? `<img class="ve" loading="lazy" src="${artUrl(e.art)}" alt="" onerror="this.remove()">` : ""}</button>`;
      })
      .join("");
    const prev = BAO_PAGES[(i - 1 + BAO_PAGES.length) % BAO_PAGES.length];
    const next = BAO_PAGES[(i + 1) % BAO_PAGES.length];
    const body = openSheet(
      `Bảo Giám · ${pg.ten}`,
      `<p class="muted">${n} / ${pg.entries.length} kiểu · đủ trang: ${esc(pg.thuong)}</p>
       <div class="lk-book">${cells}</div>
       <p class="lk-caption muted" aria-live="polite">Chạm một ô để xem tên.</p>
       <div class="actions lk-pager"><button type="button" data-a="go" data-page="${prev.id}">‹ ${esc(prev.ten)}</button><button type="button" data-a="go" data-page="${next.id}">${esc(next.ten)} ›</button></div>`,
    );
    body.addEventListener("click", (e) => {
      const a = (e.target as HTMLElement).closest<HTMLElement>("[data-a]");
      if (!a) return;
      if (a.dataset.a === "go") this.openPage(v, a.dataset.page!);
      else if (a.dataset.a === "entry") {
        const en = pg.entries[Number(a.dataset.j)];
        const own = st.owned.has(en.ma);
        body.querySelector(".lk-caption")!.innerHTML = `<b>${esc(en.ten)}</b>${en.rarity ? ` · <span class="rar r-${en.rarity}">${RARITY_NAMES[en.rarity]}</span>` : ""} · ${own ? "đã có" : "chưa có"} <span class="muted">${esc(en.ma)}</span>`;
        for (const x of body.querySelectorAll(".lk-entry.sel")) x.classList.remove("sel");
        a.classList.add("sel");
      }
    });
  }

  // ---- Thao tác -----------------------------------------------------------------------------------------------------

  /** Thao tác "lk-*" của màn Nhân vật; trả false nếu không phải của mục này. */
  act(name: string, el: HTMLElement, v: NhanVatView): boolean {
    if (!name.startsWith("lk-")) return false;
    const st = this.state(v);
    if (name === "lk-tab") {
      this.tab = el.dataset.lk as LkTab;
      this.host.redraw();
    } else if (name === "lk-pick") {
      const uid = Number(el.dataset.uid);
      if (!this.pick.delete(uid)) this.pick.add(uid);
      this.host.redraw();
    } else if (name === "lk-pick-r") {
      for (const it of this.candidates(v)) if (it.gear!.rarity === el.dataset.r) this.pick.add(it.uid);
      this.host.redraw();
    } else if (name === "lk-pick-none") {
      this.pick.clear();
      this.host.redraw();
    } else if (name === "lk-decompose") this.confirmDecompose(v);
    else if (name === "lk-slot") {
      this.slot = el.dataset.slot as GearSlot;
      this.host.redraw();
    } else if (name === "lk-sub") this.setSub(v, Number(el.dataset.i));
    else if (name === "lk-reroll") {
      const ls = st.slots[this.slot];
      if (ls) this.setSub(v, rerollSub(ls.sub));
    } else if (name === "lk-kl") this.openKl(v, el.dataset.slot as GearSlot);
    else if (name === "lk-gem") this.tapGem(v, el.dataset.gem!);
    else if (name === "lk-phach") this.confirmPhach(v, el.dataset.gem!);
    else if (name === "lk-page") this.openPage(v, el.dataset.page!);
    else if (name === "lk-forge") this.host.forge();
    return true;
  }

  /** Ô chọn của công cụ xem thử; trả false nếu không phải của mục này. */
  change(el: HTMLInputElement | HTMLSelectElement): boolean {
    if (el.dataset.filter === "lk-realm") lkPreview.realm = Number(el.value);
    else if (el.dataset.filter === "lk-turen") lkPreview.tuRen = (el as HTMLInputElement).checked;
    else return false;
    return true;
  }
}

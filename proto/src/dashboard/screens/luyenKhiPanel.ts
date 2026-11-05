// Mục Luyện khí ở màn Nhân vật (GDD tab Trang bị phần 13, đặc tả luyen-khi.md): cột giữa thứ ba cạnh Pháp tướng và
// Đạo Cơ Bàn (điện thoại là tab Luyện khí). Năm phần: Phân giải nhiều món một lần, Tẩy luyện chỉ số phụ (4 loại của ô,
// loại đang có), Khí linh (thanh 0–9 cũng hiện trên ô đồ ở Pháp tướng; cấp 3, 6, 9 bật bảng chọn 1 trong 3 khí văn),
// Ngọc (hợp song hệ, điểm hóa Phách) và Bảo Giám (sổ chia trang, trang tuần). Danh khí luyện ở Luyện Khí Các (màn Tông
// môn, forge.ts). Trạng thái đọc từ NhanVatView.luyenKhi, mở theo cảnh giới thật (board.progress); mọi thao tác là lệnh
// của DashboardSource. Số và bảng ở ../luyenKhi.ts.
import type { Element } from "@ktlp/sim";
import { icon } from "../icons.ts";
import {
  AN_VAN_TOTAL, baoCan, BAO_PAGES, BAO_TOTAL, BAO_WEEK_REWARD, canDecompose, DMG_CAP, DMG_CAP_PHACH, gemValue, GEM_NAME, hasKhiLinh, KHI_TINH_PER_KL, KHI_TINH_TEXT, khiTinhOf,
  khiTinhToNext, khiVan, klBonus, klNeed, KL_MAX, KL_PER_BI_CANH, KL_PER_KHI_TINH, KL_PER_TRAN, PHACH_FROM, PHACH_KHI_TINH, PHACH_RATE, PHACH_VALUE, phachName,
  RARITY_NAMES, reached, REROLL_KHI_TINH, rerollStone, SLOT_NAMES, SLOTS, SONG_HE_FROM, SONG_HE_PART, SONG_HE_PHU, SONG_HE_RATE, songHeOk, stoneBack, SUB, UNLOCK, VAN_AT,
  VAN_CAP, VAN_REROLL, VAN_STACK, vanCount, vanGroup, vanSlots, yieldLocked, type Gate,
} from "../luyenKhi.ts";
import type { BagItem, CommandResult, DashboardCommand, GearItem, GearSlot, LuyenKhiView, NhanVatView } from "../source.ts";
import { artUrl, cd, closeSheet, cropIcons, esc, fmt, openSheet, pctText } from "../ui.ts";
import { ELEMENT_STYLE } from "../../theme/elements.ts";

export type LkTab = "phan-giai" | "tay-luyen" | "khi-linh" | "ngoc" | "bao-giam";
const TABS: [LkTab, string][] = [["phan-giai", "Phân giải"], ["tay-luyen", "Tẩy luyện"], ["khi-linh", "Khí linh"], ["ngoc", "Ngọc"], ["bao-giam", "Bảo Giám"]];
const ELEMENTS = Object.keys(GEM_NAME) as Element[];
type Gem = LuyenKhiView["gems"][number];

export interface LkHost {
  /** Dữ liệu mới nhất (sau lệnh thì đã đọc lại). */
  data(): NhanVatView | undefined;
  /** Gửi lệnh; nguồn báo lỗi hoặc tin bằng toast rồi đọc lại và vẽ lại màn. */
  send(cmd: DashboardCommand): Promise<CommandResult>;
  redraw(): void;
  forge(): void;
  gearIcon(g: GearItem, s: GearSlot): string;
  itemIcon(it: BagItem): string;
}

const gemLabel = (g: Gem) => (g.he2 ? `Ngọc song hệ ${ELEMENT_STYLE[g.he].name}·${ELEMENT_STYLE[g.he2].name}` : GEM_NAME[g.he]) + ` cấp ${g.cap}`;

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

  private open(v: NhanVatView, g: Gate): boolean {
    return reached(v.board.progress, g);
  }

  private tuRen(v: NhanVatView): boolean {
    return v.talent.id === "tu_ren";
  }

  /** Mở thẳng một phần (từ bảng ô trang bị hay chi tiết ngọc). */
  goto(tab: LkTab, slot?: GearSlot): void {
    this.tab = tab;
    if (slot) this.slot = slot;
  }

  /** Ô khí văn đã mở mà chưa chọn. */
  private ready(v: NhanVatView, s: GearSlot): boolean {
    const g = v.gear[s];
    return !!g && hasKhiLinh(g.rarity) && this.open(v, UNLOCK.khiLinh) && !!v.luyenKhi.slots[s]?.van.includes(null);
  }

  /** Thanh khí linh 0–9 trên ô đồ (Pháp tướng, Đạo Cơ Bàn, Tẩy luyện); món dưới tím hay chưa mở thì không có. */
  slotBar(v: NhanVatView, s: GearSlot): string {
    const g = v.gear[s];
    const kl = v.luyenKhi.slots[s]?.kl;
    if (!g || !kl || !hasKhiLinh(g.rarity) || !this.open(v, UNLOCK.khiLinh)) return "";
    const f = kl.cap >= KL_MAX ? 1 : (kl.cap + kl.exp / klNeed(kl.cap)) / KL_MAX;
    return `<span class="kl${this.ready(v, s) ? " ready" : ""}" aria-hidden="true"><i style="width:${(f * 100).toFixed(0)}%"></i></span>`;
  }

  /** Nhãn đọc màn hình cho ô đồ có khí linh. */
  slotLabel(v: NhanVatView, s: GearSlot): string {
    if (!this.slotBar(v, s)) return "";
    return `, khí linh ${v.luyenKhi.slots[s]!.kl.cap} trên ${KL_MAX}${this.ready(v, s) ? ", có ô khí văn chờ chọn" : ""}`;
  }

  // ---- Vẽ -----------------------------------------------------------------------------------------------------------

  view(v: NhanVatView, switcher: string): string {
    const st = v.luyenKhi;
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
      <p class="nv-note lk-foot">Số theo GDD tab Trang bị phần 13 (đề xuất). Danh khí luyện ở <button type="button" class="lk-link" data-act="lk-forge">Luyện Khí Các</button> của tông môn.</p>`;
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
    return v.bag.items.filter((it) => it.gear && canDecompose(it.gear.rarity));
  }

  private yieldOf(items: BagItem[]) {
    let kt = 0;
    let khoa = 0;
    const back: string[] = [];
    const stones: Partial<Record<string, number>> = {};
    for (const it of items) {
      const g = it.gear!;
      const n = khiTinhOf(g.rarity);
      kt += n;
      if (yieldLocked(g.rarity)) khoa += n;
      for (const gem of g.gems) back.push(`${GEM_NAME[gem.element]} cấp ${gem.level}`);
      if (g.seal) back.push("1 ấn bộ");
      const s = stoneBack(g.plus);
      if (s) stones[g.rarity] = (stones[g.rarity] ?? 0) + s;
    }
    const st = Object.entries(stones).map(([r, n]) => `${RARITY_NAMES[r as keyof typeof RARITY_NAMES].toLowerCase()} cho ${n} nấc`);
    if (st.length) back.push(`Luyện Khí Thạch ${st.join(", ")}`);
    return { kt, khoa, back };
  }

  private phanGiai(v: NhanVatView): string {
    if (!this.open(v, UNLOCK.phanGiai)) return this.locked(UNLOCK.phanGiai, "Phân giải đồ từ lam trở lên ra Khí Tinh.");
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
        <p class="nv-note">${sel.length ? (y.back.length ? `Trả lại: ${esc(y.back.join("; "))}.` : "Không có ngọc hay ấn khảm để trả lại.") : `Khí Tinh: ${esc(KHI_TINH_TEXT)}; thêm ${KHI_TINH_PER_KL} mỗi cấp khí linh.`}</p>
        <button type="button" class="seal wide" data-act="lk-decompose"${sel.length ? "" : " disabled"}>${sel.length ? `Phân giải ${sel.length} món` : "Chọn món để phân giải"}</button>
      </div>`;
  }

  private confirmDecompose(v: NhanVatView): void {
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
      const uids = sel.map((it) => it.uid);
      this.pick.clear();
      void this.host.send({ type: "phan_giai", uids });
    });
  }

  // ---- Tẩy luyện ---------------------------------------------------------------------------------------------------

  private tayLuyen(v: NhanVatView): string {
    if (!this.open(v, UNLOCK.tayLuyen)) return this.locked(UNLOCK.tayLuyen, "Đổi loại chỉ số phụ của một món sang loại khác trong 4 loại của ô.");
    const st = v.luyenKhi;
    const g = v.gear[this.slot];
    const ls = st.slots[this.slot];
    const tuRen = this.tuRen(v);
    const fresh = this.fresh?.slot === this.slot ? this.fresh.i : -1;
    this.fresh = undefined;
    let body: string;
    if (!g || !ls) body = `<p class="nv-note">Ô ${SLOT_NAMES[this.slot].toLowerCase()} chưa mặc đồ.</p>`;
    else {
      const stone = rerollStone(g.rarity);
      const can = st.khiTinh >= REROLL_KHI_TINH && v.top.linhThach >= stone;
      const cost = `${REROLL_KHI_TINH} Khí Tinh + ${fmt(stone)} linh thạch`;
      const rows = SUB[this.slot]
        .map((x, i) => {
          const cur = i === ls.sub;
          const tail = cur ? `<span class="badge on">Đang có</span>` : tuRen ? `<button type="button" class="btn small" data-act="lk-sub" data-i="${i}"${can ? "" : " disabled"}>Chọn</button>` : `<span class="badge"></span>`;
          return `<li class="row lk-sub${cur ? " cur" : ""}${i === fresh ? " new" : ""}"><span class="lk-i">${i + 1}</span><span class="grow"><b>${esc(x.ten)}</b>${i === 0 ? `<span class="muted block">Loại mặc định của ô</span>` : ""}</span><b class="lk-gt">${esc(x.gt)}</b>${tail}</li>`;
        })
        .join("");
      body = `
        <h3 class="nv-h">${esc(g.name)} <span><span class="rar r-${g.rarity}">${RARITY_NAMES[g.rarity]}</span> +${g.plus}</span></h3>
        <ul class="list lk-subs">${rows}</ul>
        <p class="nv-note">Giá trị ở lục +0; món thật nhân theo độ hiếm, cường hóa và bí cảnh như chỉ số phụ cũ. Đổi ngang, không mạnh hơn.</p>
        ${tuRen
          ? `<p class="nv-note">Tu rèn chọn thẳng loại muốn, mỗi lần ${cost}.</p>`
          : `<button type="button" class="seal wide" data-act="lk-reroll"${can ? "" : " disabled"}>Tẩy luyện · ${cost}</button>
             <p class="nv-note">Quay ngẫu nhiên trong 3 loại còn lại; Tu rèn chọn thẳng được. Linh thạch theo độ hiếm món, đúng phẩm của vị diện.</p>`}`;
    }
    return `<div class="lt-gear lk-slots" role="group" aria-label="Chọn ô">${SLOTS.map((s) => this.miniSlot(v, s)).join("")}</div>${body}`;
  }

  private async reroll(v: NhanVatView, loai?: number): Promise<void> {
    const slot = this.slot;
    const before = v.luyenKhi.slots[slot]?.sub;
    const r = await this.host.send(loai === undefined ? { type: "tay_luyen", slot } : { type: "tay_luyen", slot, loai });
    const after = this.host.data()?.luyenKhi.slots[slot]?.sub;
    if (r.ok && after !== undefined && after !== before) {
      this.fresh = { slot, i: after };
      this.host.redraw();
    }
  }

  // ---- Khí linh -----------------------------------------------------------------------------------------------------

  private pips(v: NhanVatView, s: GearSlot): string {
    const g = v.gear[s]!;
    const ls = v.luyenKhi.slots[s]!;
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
    if (!this.open(v, UNLOCK.khiLinh)) return this.locked(UNLOCK.khiLinh, `Món từ tím trở lên có khí linh cấp 0–${KL_MAX}: mỗi cấp cộng chỉ số gốc, cấp ${VAN_AT.join(", ")} mở ô khí văn.`);
    const st = v.luyenKhi;
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
      <p class="nv-note">Kinh nghiệm: +${KL_PER_TRAN} mỗi trận món được mặc, +${KL_PER_BI_CANH} mỗi lượt bí cảnh, nạp Khí Tinh (1 = ${KL_PER_KHI_TINH}). Món có khí linh từ cấp 1 khóa vào nhân vật.</p>
      <ul class="list lk-kls">${rows}</ul>
      <ul class="pt-legend"><li><i class="pip on"></i>Khí văn đã chọn</li><li><i class="pip ready"></i>Chờ chọn</li><li><i class="pip"></i>Chưa mở</li></ul>`;
  }

  private openKl(v: NhanVatView, s: GearSlot): void {
    const st = v.luyenKhi;
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
      if (a.dataset.a === "feed") void this.feed(s, Number(a.dataset.n));
      else if (a.dataset.a === "choose") this.openVan(v, s, i);
      else if (a.dataset.a === "retry") void this.retryVan(v, s, i);
    });
  }

  /** Nạp Khí Tinh; vượt cấp 3, 6, 9 thì bật luôn bảng chọn khí văn, không thì mở lại bảng khí linh với số mới. */
  private async feed(s: GearSlot, n: number): Promise<void> {
    const before = this.host.data()?.luyenKhi.slots[s]?.kl.cap ?? 0;
    const r = await this.host.send({ type: "nap_khi_linh", slot: s, khiTinh: n });
    const v = this.host.data();
    const ls = v?.luyenKhi.slots[s];
    if (!r.ok || !v || !ls) return;
    const open = ls.van.indexOf(null);
    if (VAN_AT.some((at) => before < at && ls.kl.cap >= at) && open >= 0) this.openVan(v, s, open);
    else this.openKl(v, s);
  }

  /** Tẩy văn ô đã có khí văn: quay lại 3 lựa chọn (tốn Linh Văn Thạch) rồi mở bảng chọn; lựa chọn đã trả tiền thì mở lại. */
  private async retryVan(v: NhanVatView, s: GearSlot, i: number): Promise<void> {
    if (v.luyenKhi.slots[s]?.offerAt === i) {
      this.openVan(v, s, i);
      return;
    }
    const r = await this.host.send({ type: "tay_van", slot: s, o: i });
    const nv = this.host.data();
    if (r.ok && nv) this.openVan(nv, s, i);
  }

  /** Bảng chọn 1 trong 3 khí văn của ô i (lựa chọn do nguồn quay, nằm ở offer); Tẩy văn quay lại 3 lựa chọn. */
  private openVan(v: NhanVatView, s: GearSlot, i: number): void {
    const st = v.luyenKhi;
    const g = v.gear[s]!;
    const ls = st.slots[s]!;
    const offer = ls.offerAt === i ? (ls.offer ?? []) : [];
    const cur = ls.van[i];
    const body = openSheet(
      `Khí văn ô ${i + 1} · ${g.name}`,
      `<p class="muted">Chọn 1 trong 3 khí văn ô ${vanGroup(s)}. Một khí văn có trên nhiều món chỉ tính tối đa ${VAN_STACK} lần; tổng mọi khí văn không quá ${pctText(VAN_CAP)} lực chiến.</p>
       ${offer.length ? `<div class="lk-vans">${offer
         .map((ma) => {
           const x = khiVan(ma)!;
           const n = vanCount(st.slots, ma) - (cur === ma ? 1 : 0);
           return `<button type="button" class="lk-van" data-a="pick" data-ma="${ma}"><b>${esc(x.ten)}</b><span>${esc(x.tac)}</span>${n >= VAN_STACK ? `<em class="bad">Đã có ${n} lần: không tính thêm</em>` : n ? `<em>Đang có trên ${n} món</em>` : ""}</button>`;
         })
         .join("")}</div>` : `<p class="muted">Chưa có lựa chọn cho ô này: bấm Tẩy văn để quay 3 khí văn.</p>`}
       ${cur ? `<p class="muted">Đang có: ${esc(khiVan(cur)?.ten ?? cur)}. Đóng bảng thì giữ khí văn cũ.</p>` : ""}
       <div class="actions"><button type="button" data-a="reroll"${st.linhVanThach < VAN_REROLL ? " disabled" : ""}>Tẩy văn · ${VAN_REROLL} Linh Văn Thạch (còn ${st.linhVanThach})</button></div>`,
    );
    body.addEventListener("click", async (e) => {
      const a = (e.target as HTMLElement).closest<HTMLElement>("[data-a]");
      if (!a || (a as HTMLButtonElement).disabled) return;
      if (a.dataset.a === "pick") {
        closeSheet();
        void this.host.send({ type: "chon_khi_van", slot: s, o: i, ma: a.dataset.ma! });
      } else if (a.dataset.a === "reroll") {
        const r = await this.host.send({ type: "tay_van", slot: s, o: i });
        const nv = this.host.data();
        if (r.ok && nv) this.openVan(nv, s, i);
      }
    });
  }

  // ---- Ngọc ------------------------------------------------------------------------------------------------------------

  private gemCell(g: Gem, cls: string, act: string): string {
    return `<button type="button" class="bag-cell lk-gem ${cls}" data-act="${act}" data-gem="${g.id}" aria-label="${esc(`${gemLabel(g)}${g.n > 1 ? `, ${g.n} viên` : ""}`)}" title="${esc(gemLabel(g))}">
      <img class="ve${g.he2 ? " he1" : ""}" src="${artUrl(`ngoc/${g.he}`)}" alt="">${g.he2 ? `<img class="ve he2" src="${artUrl(`ngoc/${g.he2}`)}" alt="">` : ""}<span class="lk-cap">${g.cap}</span>${g.n > 1 ? `<span class="n">${g.n}</span>` : ""}</button>`;
  }

  private ngoc(v: NhanVatView): string {
    const st = v.luyenKhi;
    const gems = st.gems.filter((g) => g.n > 0);
    const single = gems.filter((g) => !g.he2);
    const a = single.find((g) => g.id === this.gemA && g.cap >= SONG_HE_FROM);
    if (!a) this.gemA = undefined;
    const pairOk = (g: Gem) => !!a && g !== a && g.cap === a.cap && songHeOk(a.he, g.he);
    const merge = single.filter((g) => g.cap >= SONG_HE_FROM);
    const mates = a ? ELEMENTS.filter((e) => songHeOk(a.he, e)).map((e) => ELEMENT_STYLE[e].name) : [];
    const songHe = merge.length
      ? `<div class="lk-gems">${merge.map((g) => this.gemCell(g, g === a ? "sel" : a ? (pairOk(g) ? "ok" : "dim") : "", "lk-gem")).join("")}</div>
         <p class="nv-note">${a ? `Viên thứ hai: cùng cấp ${a.cap}, hệ tương sinh hoặc tương hợp với ${esc(ELEMENT_STYLE[a.he].name)} (${esc(mates.join(", "))}).` : "Chọn viên thứ nhất."} Viên song hệ cho mỗi hệ ${pctText(SONG_HE_PART)} giá trị một viên thường; mỗi hệ vẫn tính trong trần mềm của hệ đó.</p>`
      : `<p class="nv-note">Mở khi có ngọc cấp ${SONG_HE_FROM}.</p>`;
    const top = single.filter((g) => g.cap >= PHACH_FROM);
    const phach = top.length
      ? `<ul class="list">${top
          .map((g) => {
            const has = st.phach.includes(g.he);
            return `<li class="row">${this.gemCell(g, "", "lk-gem-x")}<span class="grow"><b>${esc(phachName(g.he))}</b><span class="muted block">${has ? "Đã có Phách hệ này" : `${PHACH_KHI_TINH} Khí Tinh · đậu ${pctText(PHACH_RATE)}`}</span></span><button type="button" class="btn small" data-act="lk-phach" data-gem="${g.id}"${has || st.khiTinh < PHACH_KHI_TINH ? " disabled" : ""}>Điểm hóa</button></li>`;
          })
          .join("")}</ul>`
      : `<p class="nv-note">Mở khi có ngọc cấp ${PHACH_FROM}.</p>`;
    const duals = gems.filter((g) => g.he2);
    return `
      <h3 class="nv-h">Hợp song hệ <span>2 viên cùng cấp từ ${SONG_HE_FROM}</span></h3>
      ${songHe}
      ${duals.length ? `<div class="lk-gems">${duals.map((g) => this.gemCell(g, "", "lk-gem-x")).join("")}</div>` : ""}
      <h3 class="nv-h">Ngọc Phách <span>điểm hóa viên cấp ${PHACH_FROM}</span></h3>
      ${phach}
      <p class="nv-note">Phách khảm ô công: vừa cho ${pctText(PHACH_VALUE)} như ngọc cấp 10, vừa nâng trần sát thương hệ đó từ ${pctText(DMG_CAP)} lên ${pctText(DMG_CAP_PHACH)}. Mỗi hệ chỉ 1 Phách. Phách khóa vào nhân vật.</p>
      ${st.phach.length ? `<p class="lk-phachs">${st.phach.map((e) => `<span class="chip el" style="--c:${ELEMENT_STYLE[e].color}">${esc(phachName(e))}</span>`).join("")}</p>` : ""}`;
  }

  private tapGem(v: NhanVatView, id: string): void {
    const g = v.luyenKhi.gems.find((x) => x.id === id);
    if (!g || g.he2 || g.cap < SONG_HE_FROM) return;
    const a = v.luyenKhi.gems.find((x) => x.id === this.gemA);
    if (!a || a === g || g.cap !== a.cap || !songHeOk(a.he, g.he)) {
      this.gemA = a === g ? undefined : id;
      this.host.redraw();
      return;
    }
    const each = (gemValue(a.cap) * SONG_HE_PART) / 1000;
    // Phù bảo ngọc trong túi: dùng thì thất bại giữ cả hai viên; mỗi lần dùng tốn một tấm, đậu hay không.
    const phu = v.bag.items.filter((it) => it.code === SONG_HE_PHU).reduce((n, it) => n + it.count, 0);
    const body = openSheet(
      "Hợp song hệ",
      `<div class="lk-gems center">${this.gemCell(a, "", "x")}<span class="lk-plus">+</span>${this.gemCell(g, "", "x")}</div>
       <dl class="kv">
         <dt>Ra</dt><dd>Ngọc song hệ ${esc(ELEMENT_STYLE[a.he].name)}·${esc(ELEMENT_STYLE[g.he].name)} cấp ${a.cap}</dd>
         <dt>Mỗi hệ</dt><dd>+${pctText(each)} <span class="muted">(${pctText(SONG_HE_PART)} của ${pctText(gemValue(a.cap))})</span></dd>
         <dt>Tỷ lệ đậu</dt><dd>${pctText(SONG_HE_RATE)}</dd>
       </dl>
       <p class="muted">Thất bại mất viên thứ hai (${esc(gemLabel(g))}), giữ viên thứ nhất. Dành cho người mang công pháp hai hệ hoặc cần kháng hai hệ trong ít dòng khảm.</p>
       <label class="lk-phu${phu ? "" : " off"}"><input type="checkbox" data-phu${phu ? "" : " disabled"}><span><b>Dùng Phù bảo ngọc</b><span class="muted block">${phu ? `Thất bại thì giữ cả hai viên. Tốn 1 tấm mỗi lần, còn ${phu}.` : "Túi không còn Phù bảo ngọc."}</span></span></label>
       <div class="actions"><button type="button" data-close>Thôi</button><button type="button" class="seal" data-a="ok">Hợp</button></div>`,
    );
    body.addEventListener("click", (e) => {
      if (!(e.target as HTMLElement).closest("[data-a=ok]")) return;
      closeSheet();
      this.gemA = undefined;
      const usePhu = !!body.querySelector<HTMLInputElement>("[data-phu]")?.checked;
      void this.host.send(usePhu ? { type: "hop_song_he", a: a.id, b: g.id, phu: true } : { type: "hop_song_he", a: a.id, b: g.id });
    });
  }

  private confirmPhach(v: NhanVatView, id: string): void {
    const g = v.luyenKhi.gems.find((x) => x.id === id);
    if (!g || g.n < 1) return;
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
      void this.host.send({ type: "diem_hoa_phach", gem: g.id });
    });
  }

  // ---- Bảo Giám ---------------------------------------------------------------------------------------------------------

  private baoGiam(v: NhanVatView): string {
    if (!this.open(v, UNLOCK.baoGiam)) return this.locked(UNLOCK.baoGiam, "Sổ ghi mọi kiểu đã từng sở hữu.");
    const st = v.luyenKhi;
    const owned = new Set([...st.owned, ...st.anVanLo]);
    const w = st.week;
    const group = (nhom: string) =>
      BAO_PAGES.filter((pg) => pg.nhom === nhom)
        .map((pg) => {
          const can = baoCan(pg);
          const n = Math.min(can, pg.entries.filter((e) => owned.has(e.ma)).length);
          return `<li><button type="button" class="row lk-page${n >= can ? " done" : ""}" data-act="lk-page" data-page="${pg.id}"><span class="grow"><b>${esc(pg.ten)}</b><span class="muted block">${esc(pg.thuong)}</span></span>
            <span class="lk-prog"><span><b>${n}</b> / ${can}</span><span class="lk-bar small"><i style="width:${((n / can) * 100).toFixed(0)}%"></i></span></span>${icon("chevron", "chev")}</button></li>`;
        })
        .join("");
    const have = new Set(BAO_PAGES.filter((p) => p.nhom !== "Ẩn văn").flatMap((p) => p.entries.map((e) => e.ma)).filter((m) => owned.has(m))).size;
    return `
      <div class="lk-week">
        <b>Trang tuần</b><span>${esc(w.text)}</span>
        <span class="lk-bar"><i style="width:${((w.have / w.need) * 100).toFixed(0)}%"></i></span>
        <span class="muted">${w.have} / ${w.need} · thưởng ${BAO_WEEK_REWARD} ${esc(w.thuong)} · còn <span data-cd="${w.endsAt}">${cd(w.endsAt)}</span></span>
      </div>
      <h3 class="nv-h">Sổ Bảo Giám <span>${fmt(have)} / ${fmt(BAO_TOTAL)} kiểu</span></h3>
      <p class="nv-note">Ghi cả món đã phân giải. Đủ một trang thì nhận thưởng; thưởng không cộng chỉ số chiến đấu.</p>
      <h3 class="nv-h lk-group">Trang bị</h3><ul class="list lk-pages">${group("Trang bị")}</ul>
      <h3 class="nv-h lk-group">Pháp bảo</h3><ul class="list lk-pages">${group("Pháp bảo")}</ul>
      <h3 class="nv-h lk-group">Khác</h3><ul class="list lk-pages">${group("Khác")}</ul>
      <h3 class="nv-h lk-group">Ẩn văn <span>${fmt(st.anVanLo.length)} / ${fmt(AN_VAN_TOTAL)} cặp</span></h3>
      <p class="nv-note">Một cặp vào sổ khi cả điều kiện và hiệu ứng của dòng ẩn đã lộ (sau lần kích phát đầu, hoặc sau Tẩy ẩn).</p>
      <ul class="list lk-pages">${group("Ẩn văn")}</ul>`;
  }

  private openPage(v: NhanVatView, id: string): void {
    const owned = new Set([...v.luyenKhi.owned, ...v.luyenKhi.anVanLo]);
    const i = BAO_PAGES.findIndex((p) => p.id === id);
    const pg = BAO_PAGES[i];
    if (!pg) return;
    const can = baoCan(pg);
    const n = Math.min(can, pg.entries.filter((e) => owned.has(e.ma)).length);
    const anVan = pg.nhom === "Ẩn văn";
    const glyph = pg.nhom === "Trang bị" ? "sword" : anVan ? "scroll" : "gem";
    const cells = pg.entries
      .map((e, j) => {
        const own = owned.has(e.ma);
        const c = e.he ? ` style="--el:${ELEMENT_STYLE[e.he as Element]?.color ?? "#8a7f70"}"` : "";
        return `<button type="button" class="bag-cell lk-entry${anVan ? " an-van" : ""}${e.rarity ? ` r-${e.rarity}` : ""}${own ? " have" : ""}" data-a="entry" data-j="${j}"${c} aria-label="${esc(anVan ? (own ? e.ten : "Cặp ẩn văn chưa lộ") : `${e.ten}${own ? "" : ", chưa có"}`)}">
          ${icon(glyph, "glyph")}${e.art ? `<img class="ve" loading="lazy" src="${artUrl(e.art)}" alt="" onerror="this.remove()">` : ""}</button>`;
      })
      .join("");
    const prev = BAO_PAGES[(i - 1 + BAO_PAGES.length) % BAO_PAGES.length];
    const next = BAO_PAGES[(i + 1) % BAO_PAGES.length];
    const body = openSheet(
      `Bảo Giám · ${pg.ten}`,
      `<p class="muted"><span>${n} / ${can} ${anVan ? "cặp" : "kiểu"}${pg.can ? ` bất kỳ trong ${pg.entries.length}` : ""}</span> · <span>đủ trang: ${esc(pg.thuong)}</span></p>
       <div class="lk-book${anVan ? ` an-van${pg.entries.length > 24 ? " day" : ""}` : ""}">${cells}</div>
       <p class="lk-caption muted" aria-live="polite">Chạm một ô để xem tên.</p>
       <div class="actions lk-pager"><button type="button" data-a="go" data-page="${prev.id}">‹ <span>${esc(prev.ten)}</span></button><button type="button" data-a="go" data-page="${next.id}"><span>${esc(next.ten)}</span> ›</button></div>`,
    );
    body.addEventListener("click", (e) => {
      const a = (e.target as HTMLElement).closest<HTMLElement>("[data-a]");
      if (!a) return;
      if (a.dataset.a === "go") this.openPage(v, a.dataset.page!);
      else if (a.dataset.a === "entry") {
        const en = pg.entries[Number(a.dataset.j)];
        const own = owned.has(en.ma);
        // Cặp ẩn văn chưa lộ thì không nói trước nội dung: chỉ "???".
        const ten = anVan && !own ? "???" : en.ten;
        body.querySelector(".lk-caption")!.innerHTML = `<b>${esc(ten)}</b>${en.rarity ? ` · <span class="rar r-${en.rarity}">${RARITY_NAMES[en.rarity]}</span>` : ""} · ${own ? (anVan ? "đã lộ" : "đã có") : anVan ? "chưa lộ" : "chưa có"}${anVan ? "" : ` <span class="muted">${esc(en.ma)}</span>`}`;
        for (const x of body.querySelectorAll(".lk-entry.sel")) x.classList.remove("sel");
        a.classList.add("sel");
      }
    });
  }

  // ---- Thao tác -----------------------------------------------------------------------------------------------------

  /** Thao tác "lk-*" của màn Nhân vật; trả false nếu không phải của mục này. */
  act(name: string, el: HTMLElement, v: NhanVatView): boolean {
    if (!name.startsWith("lk-")) return false;
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
    } else if (name === "lk-sub") void this.reroll(v, Number(el.dataset.i));
    else if (name === "lk-reroll") void this.reroll(v);
    else if (name === "lk-kl") this.openKl(v, el.dataset.slot as GearSlot);
    else if (name === "lk-gem") this.tapGem(v, el.dataset.gem!);
    else if (name === "lk-phach") this.confirmPhach(v, el.dataset.gem!);
    else if (name === "lk-page") this.openPage(v, el.dataset.page!);
    else if (name === "lk-forge") this.host.forge();
    return true;
  }
}

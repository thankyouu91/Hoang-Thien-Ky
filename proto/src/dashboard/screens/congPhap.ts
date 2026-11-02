// Công pháp (GDD mục 14): 4 ô mang vào trận và tầng từng công pháp; bộ truyền thụ để học; tàn quyển trong túi để nộp;
// Tàng Kinh Các để ghép, từ trưởng lão trở lên. Mọi nút đi qua lệnh của @ktlp/rules (mang_vao_tran, hoc_cong_phap,
// nop_tan_quyen, ghep_cong_phap, dat_bo_truyen_thu); bản xem trước khi ghép dùng chính hàm của rules.
import { GRADE_NAMES, scrollKind, techniqueName, techniqueOf, VARIANT_NAMES } from "@ktlp/rules";
import { TICKS_PER_SECOND } from "@ktlp/sim";
import { PageScene, type DashCtx } from "../shell.ts";
import type { CongPhapView, ScrollCard, TechniqueCard } from "../source.ts";
import { closeSheet, elementChip, esc, fmt, openSheet, skillChip } from "../ui.ts";

export type CongPhapSection = "mang" | "truyen-thu" | "tui" | "tang-kinh";

function techHtml(t: TechniqueCard): string {
  return `<span class="tech">
    <span class="tech-top">${elementChip(t.element)}${t.subElements.map((e) => elementChip(e, false)).join("")} <b>${esc(t.name)}</b></span>
    <span class="muted block">${esc(t.gradeName)} · ${skillChip(t.type)}${t.layer ? ` · tầng ${t.layer}/10${t.frozen ? " (dừng)" : ""}` : ""}</span>
    <span class="muted block">${esc(t.summary)}</span>
  </span>`;
}

function scrollHtml(s: ScrollCard): string {
  return `<span class="grow">${elementChip(s.element, false)} <b>${esc(s.name)}</b><span class="muted block">${esc(s.gradeName)} · ${skillChip(s.type)} · ${VARIANT_NAMES[scrollKind(s.kind).variant]}</span></span>`;
}

export class CongPhapScene extends PageScene<CongPhapView> {
  private section?: CongPhapSection;

  constructor(ctx: DashCtx) {
    super("cong-phap", "Công pháp", ctx);
  }

  /** Thẻ Việc nên làm dẫn tới đúng phần của màn (ví dụ ô công pháp còn trống). */
  focusSection(s?: CongPhapSection): void {
    this.section = s;
    if (this.data) this.scrollToSection();
  }

  protected read(): Promise<CongPhapView> {
    return this.ctx.source.congPhap();
  }

  protected render(v: CongPhapView): void {
    this.page.innerHTML = `
      <section class="card" id="cp-mang">
        <h2>Mang vào trận <span class="right">${v.loadout.filter(Boolean).length} / ${v.loadout.length}</span></h2>
        <ol class="list loadout">${v.loadout
          .map(
            (t, i) => `<li><button type="button" class="row slot-row${t ? "" : " empty"}" data-act="slot" data-i="${i}">
              <span class="prio">${i + 1}</span>${t ? techHtml(t) : `<span class="grow muted">Ô trống · chạm để chọn công pháp đã học</span>`}</button></li>`,
          )
          .join("")}</ol>
        <p class="muted">Thứ tự là thứ tự ưu tiên ra chiêu trong trận.</p>
      </section>
      <section class="card">
        <h2>Đã học <span class="right">${v.learned.length}</span></h2>
        <ul class="list">${v.learned.map((t) => `<li class="row">${techHtml(t)}</li>`).join("") || `<li class="muted">Chưa học công pháp nào.</li>`}</ul>
      </section>
      <section class="card" id="cp-truyen-thu">
        <h2>Bộ truyền thụ <span class="right">${v.transmission.length} / ${v.transmissionSlots} suất</span></h2>
        <ul class="list">${v.transmission
          .map(
            (t) => `<li class="row">${techHtml(t)}
              ${t.learned ? `<span class="muted">Đã học</span>` : t.blocked ? `<span class="muted nowrap">${esc(t.blocked)}</span>` : `<button type="button" class="seal small" data-act="learn" data-id="${t.id}">Học</button>`}</li>`,
          )
          .join("")}</ul>
        ${v.can.truyenThu ? `<button type="button" class="wide" data-act="edit-transmission">Chọn bộ truyền thụ</button>` : ""}
      </section>
      <section class="card" id="cp-tui">
        <h2>Tàn quyển trong túi <span class="right">cống hiến ${fmt(v.contribution)}</span></h2>
        <ul class="list">${v.bag
          .map((s) => `<li class="row">${scrollHtml(s)}<button type="button" class="btn small" data-act="deposit" data-uid="${s.uid}">Nộp +${fmt(s.contribution)}</button></li>`)
          .join("") || `<li class="muted">Túi trống.</li>`}</ul>
        <p class="muted">Tàn quyển nhặt được thuộc về người nhặt; nộp vào Tàng Kinh Các để đổi cống hiến.</p>
      </section>
      <section class="card" id="cp-tang-kinh">
        <h2>Tàng Kinh Các <span class="right">${v.library.length} quyển · ${v.sectTechniques.length} công pháp</span></h2>
        ${v.can.ghep
          ? `<button type="button" class="wide seal" data-act="compose" ${v.library.length >= 2 ? "" : "disabled"}>Ghép công pháp</button>`
          : `<p class="muted">Trưởng lão trở lên mới ghép công pháp ở Tàng Kinh Các.</p>`}
      </section>`;
  }

  protected override mounted(): void {
    this.scrollToSection();
  }

  private scrollToSection(): void {
    if (!this.section) return;
    const el = this.page.querySelector(`#cp-${this.section}`);
    this.section = undefined;
    el?.scrollIntoView({ block: "start" });
    el?.classList.add("flash");
    setTimeout(() => el?.classList.remove("flash"), 1200);
  }

  protected override act(name: string, el: HTMLElement): void {
    const v = this.data;
    if (!v) return;
    if (name === "slot") this.pickForSlot(v, Number(el.dataset.i));
    else if (name === "learn") void this.send({ type: "hoc_cong_phap", techniqueId: Number(el.dataset.id) });
    else if (name === "deposit") void this.send({ type: "nop_tan_quyen", scrollUid: Number(el.dataset.uid) });
    else if (name === "compose") this.openCompose(v);
    else if (name === "edit-transmission") this.openTransmission(v);
  }

  /** Chọn công pháp đã học cho một ô; công pháp đang ở ô khác thì đổi chỗ. */
  private pickForSlot(v: CongPhapView, i: number): void {
    const current = v.loadout.map((t) => t?.id ?? null);
    const body = openSheet(
      `Ô ${i + 1}`,
      `<ul class="list">${v.learned
        .map((t) => `<li><button type="button" class="row" data-pick="${t.id}">${techHtml(t)}${current.includes(t.id) ? `<span class="muted nowrap">Ô ${current.indexOf(t.id) + 1}</span>` : ""}</button></li>`)
        .join("")}</ul>
       ${current[i] !== null ? `<button type="button" class="wide" data-pick="none">Bỏ khỏi ô này</button>` : ""}`,
    );
    body.addEventListener("click", (e) => {
      const pick = (e.target as HTMLElement).closest<HTMLElement>("[data-pick]")?.dataset.pick;
      if (!pick) return;
      const next = [...current];
      const id = pick === "none" ? null : Number(pick);
      const was = id === null ? -1 : next.indexOf(id);
      if (was >= 0) next[was] = next[i];
      next[i] = id;
      closeSheet();
      void this.send({ type: "mang_vao_tran", techniqueIds: next.filter((x): x is number => x !== null) });
    });
  }

  /** Tàng Kinh Các: chọn 1 chủ quyển và 1 phụ quyển (2 từ tông môn cấp 100), xem trước rồi ghép. */
  private openCompose(v: CongPhapView): void {
    const pick: number[] = [];
    const body = openSheet("Ghép công pháp", "");
    const draw = () => {
      const scrolls = pick.map((uid) => v.library.find((s) => s.uid === uid)!);
      let preview = `<p class="muted">Chọn chủ quyển trước, rồi ${v.maxSubs === 2 ? "1–2" : "1"} phụ quyển.</p>`;
      if (scrolls.length >= 2) {
        const [main, ...subs] = scrolls;
        const recipe = { main: { kind: main.kind, grade: main.grade }, subs: subs.map((s) => ({ kind: s.kind, grade: s.grade })) };
        const t = techniqueOf(recipe);
        const grade = Math.min(...scrolls.map((s) => s.grade));
        preview = `<div class="card preview"><b>${esc(techniqueName(main.kind, subs.map((s) => s.kind)))}</b>
          <span class="muted block">${GRADE_NAMES[grade - 1]} · ${skillChip(t.type)} · D ${Math.round(t.damage / 1000)} · ${t.targets} mục tiêu · hồi ${(t.cooldownTicks / TICKS_PER_SECOND).toLocaleString("vi-VN")} s · ${t.manaCost} mana</span>
          <span class="muted block">Phẩm theo quyển thấp nhất; các quyển đem ghép bị tiêu hao.</span></div>`;
      }
      body.innerHTML = `
        ${preview}
        <ul class="list">${v.library
          .map((s) => {
            const at = pick.indexOf(s.uid);
            return `<li><button type="button" class="row${at >= 0 ? " picked" : ""}" data-uid="${s.uid}">${scrollHtml(s)}<span class="nowrap">${at === 0 ? "Chủ" : at > 0 ? "Phụ" : ""}</span></button></li>`;
          })
          .join("")}</ul>
        <div class="actions"><button type="button" class="seal" data-go ${pick.length >= 2 ? "" : "disabled"}>Ghép</button></div>`;
    };
    body.addEventListener("click", (e) => {
      const t = e.target as HTMLElement;
      const uid = t.closest<HTMLElement>("[data-uid]")?.dataset.uid;
      if (uid) {
        const n = Number(uid);
        const at = pick.indexOf(n);
        if (at >= 0) pick.splice(at, 1);
        else if (pick.length < 1 + v.maxSubs) pick.push(n);
        draw();
      } else if (t.closest("[data-go]")) {
        closeSheet();
        void this.send({ type: "ghep_cong_phap", main: pick[0], subs: pick.slice(1) });
      }
    });
    draw();
  }

  /** Tông chủ, phó tông chủ chọn lại cả bộ truyền thụ (12 suất, thêm 1 mỗi 25 cấp tông môn). */
  private openTransmission(v: CongPhapView): void {
    const chosen = new Set(v.transmission.map((t) => t.id));
    const body = openSheet("Chọn bộ truyền thụ", "");
    const draw = () => {
      body.innerHTML = `<p class="muted">${chosen.size} / ${v.transmissionSlots} suất. Công pháp đã học không bị ảnh hưởng khi bỏ khỏi bộ.</p>
        <ul class="list">${v.sectTechniques
          .map((t) => `<li><button type="button" class="row${chosen.has(t.id) ? " picked" : ""}" data-id="${t.id}">${techHtml(t)}<span class="nowrap">${chosen.has(t.id) ? "✓" : ""}</span></button></li>`)
          .join("")}</ul>
        <div class="actions"><button type="button" class="seal" data-save>Lưu</button></div>`;
    };
    body.addEventListener("click", (e) => {
      const t = e.target as HTMLElement;
      const id = t.closest<HTMLElement>("[data-id]")?.dataset.id;
      if (id) {
        const n = Number(id);
        if (chosen.has(n)) chosen.delete(n);
        else if (chosen.size < v.transmissionSlots) chosen.add(n);
        draw();
      } else if (t.closest("[data-save]")) {
        closeSheet();
        void this.send({ type: "dat_bo_truyen_thu", techniqueIds: v.sectTechniques.map((x) => x.id).filter((x) => chosen.has(x)) });
      }
    });
    draw();
  }
}

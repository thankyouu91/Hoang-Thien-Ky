// Công pháp (GDD mục 14): 4 ô mang vào trận và tầng từng công pháp; bộ truyền thụ để học; tàn quyển trong túi để nộp;
// Tàng Kinh Các để ghép, từ trưởng lão trở lên. Mọi nút đi qua lệnh của @ktlp/rules (mang_vao_tran, hoc_cong_phap,
// nop_tan_quyen, ghep_cong_phap, dat_bo_truyen_thu); bản xem trước khi ghép dùng chính hàm của rules.
import { GRADE_NAMES, scrollKind, techniqueName, techniqueOf, VARIANT_NAMES } from "@ktlp/rules";
import { TICKS_PER_SECOND } from "@ktlp/sim";
import { ELEMENT_STYLE, SKILL_NAME } from "../../theme/elements.ts";
import { enableDrag, type DragControl, type DropAction } from "../keoTha.ts";
import { PageScene, type DashCtx } from "../shell.ts";
import type { CongPhapView, ScrollCard, TechniqueCard } from "../source.ts";
import { term } from "../terms.ts";
import { closeSheet, esc, fmt, openSheet, techCover } from "../ui.ts";

export type CongPhapSection = "mang" | "truyen-thu" | "tui" | "tang-kinh";

/** Một công pháp gọn ba dòng, bìa vẽ bên trái: tên · hệ, phẩm, loại chiêu, tầng · số liệu. */
function techHtml(t: TechniqueCard): string {
  const els = [t.element, ...t.subElements].map((e) => ELEMENT_STYLE[e].name).join(" + ");
  return `<span class="tech has-art">${techCover(t)}
    <span class="tech-top"><b>${esc(t.name)}</b>${t.layer ? `<span class="layer${t.frozen ? " frozen" : ""}">tầng ${t.layer}/10${t.frozen ? " · dừng" : ""}</span>` : ""}</span>
    <span class="tech-meta">${esc(els)} · ${esc(t.gradeName)} · ${esc(SKILL_NAME[t.type])}</span>
    <span class="tech-sum">${esc(t.summary)}</span>
  </span>`;
}

function scrollHtml(s: ScrollCard): string {
  return `<span class="tech has-art">${techCover({ art: `tan_quyen/${s.element}`, element: s.element })}
    <span class="tech-top"><b>${esc(s.name)}</b></span>
    <span class="tech-meta">${esc(ELEMENT_STYLE[s.element].name)} · ${esc(s.gradeName)} · ${esc(SKILL_NAME[s.type])} · ${VARIANT_NAMES[scrollKind(s.kind).variant]}</span>
  </span>`;
}

export class CongPhapScene extends PageScene<CongPhapView> {
  private section?: CongPhapSection;
  /** Kéo thả (keoTha.ts): "hoc:<id>" công pháp đã học, "slot:<i>" ô mang vào trận; thả vào ô, hay vùng "bo" để bỏ khỏi trận. */
  private dnd: DragControl;

  constructor(ctx: DashCtx) {
    super("cong-phap", "Công pháp", ctx);
    this.dnd = enableDrag(this.page, { action: (d, t) => this.dropAction(d, t), drop: (d, t) => this.drop(d, t) });
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
    // Việc chính: 4 ô mang vào trận. "Đã học" lặp lại phần lớn các ô này nên gập lại.
    const loadout = `<section class="card primary" id="cp-mang">
        <h2>Mang vào trận <span class="right"><b>${v.loadout.filter(Boolean).length}</b> / ${v.loadout.length}</span></h2>
        <ol class="list loadout">${v.loadout
          .map(
            (t, i) => `<li><button type="button" class="row${t ? "" : " empty"}" data-act="slot" data-i="${i}" data-drop="slot:${i}"${t ? ` data-drag="slot:${i}"` : ""}>
              <span class="prio">${i + 1}</span>${t ? techHtml(t) : `<span class="grow">Ô trống · chạm để chọn, hoặc kéo công pháp đã học vào đây</span>`}</button></li>`,
          )
          .join("")}</ol>
        <div class="drop-zone cp-bo" data-drop="bo">Thả vào đây để bỏ khỏi trận</div>
        <p class="note">Thứ tự là thứ tự ưu tiên ra chiêu trong trận. Kéo giữa các ô để đổi thứ tự.</p>
        <details class="fold"${v.loadout.some((t) => !t) && v.learned.length ? " open" : ""}>
          <summary>Đã học <span class="right">${v.learned.length}</span></summary>
          <ul class="list">${v.learned.map((t) => `<li class="row" data-drag="hoc:${t.id}">${techHtml(t)}${v.loadout.some((x) => x?.id === t.id) ? `<span class="pick-tag">Ô ${v.loadout.findIndex((x) => x?.id === t.id) + 1}</span>` : ""}</li>`).join("") || `<li class="empty-note">Chưa học công pháp nào.</li>`}</ul>
          ${v.learned.length ? `<p class="drag-hint">Kéo công pháp lên một ô để mang vào trận${matchMedia("(pointer: coarse)").matches ? " (giữ tay một chút rồi kéo)" : ""}.</p>` : ""}
        </details>
      </section>`;
    const transmission = `<section class="card" id="cp-truyen-thu">
        <h2>${term("Bộ truyền thụ", "bo_truyen_thu")} <span class="right">${v.transmission.length} / ${v.transmissionSlots} suất</span></h2>
        <ul class="list">${v.transmission
          .map(
            (t) => `<li class="row">${techHtml(t)}
              ${t.learned ? `<span class="muted nowrap">Đã học</span>` : t.blocked ? `<span class="muted">${esc(t.blocked)}</span>` : `<button type="button" class="seal small" data-act="learn" data-id="${t.id}">Học</button>`}</li>`,
          )
          .join("")}</ul>
        ${v.can.truyenThu ? `<button type="button" class="wide" data-act="edit-transmission">Chọn bộ truyền thụ</button>` : ""}
      </section>`;
    const bag = `<section class="card" id="cp-tui">
        <h2>${term("Tàn quyển", "tan_quyen")} trong túi <span class="right">${term("cống hiến", "cong_hien")} <b>${fmt(v.contribution)}</b></span></h2>
        <ul class="list">${v.bag
          .map((s) => `<li class="row">${scrollHtml(s)}<button type="button" class="btn small" data-act="deposit" data-uid="${s.uid}">Nộp +${fmt(s.contribution)}</button></li>`)
          .join("") || `<li class="empty-note">Túi trống.</li>`}</ul>
        <p class="note">Tàn quyển nhặt được thuộc về người nhặt; nộp vào Tàng Kinh Các để đổi cống hiến.</p>
      </section>`;
    const library = `<section class="card" id="cp-tang-kinh">
        <h2>${term("Tàng Kinh Các", "tang_kinh_cac")} <span class="right">${v.library.length} quyển · ${v.sectTechniques.length} công pháp</span></h2>
        ${v.can.ghep
          ? `<p class="muted">Ghép 1 chủ quyển với ${v.maxSubs === 2 ? "1–2" : "1"} phụ quyển thành công pháp mới cho tông môn.</p>
             <button type="button" class="wide seal" data-act="compose" ${v.library.length >= 2 ? "" : "disabled"}>Ghép công pháp</button>`
          : `<p class="note">Trưởng lão trở lên mới ghép công pháp ở Tàng Kinh Các.</p>`}
      </section>`;
    this.page.innerHTML = `<div class="panel"><div class="cols"><div class="col">${loadout}</div><div class="col">${transmission}${bag}${library}</div></div></div>`;
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

  /** Việc sẽ làm khi thả (nhãn cạnh ngón tay); null là chỗ đó không nhận. */
  private dropAction(drag: string, drop: string): DropAction {
    const v = this.data;
    if (!v) return null;
    const [k, id] = drag.split(":");
    const [dk, did] = drop.split(":");
    if (k === "slot" && dk === "bo") return "Bỏ khỏi trận";
    if (dk !== "slot") return null;
    const j = Number(did);
    const cur = v.loadout[j];
    if (k === "slot") return Number(id) === j ? null : cur ? "Đổi chỗ hai ô" : `Chuyển sang ô ${j + 1}`;
    if (k !== "hoc") return null;
    const was = v.loadout.findIndex((t) => t?.id === Number(id));
    if (was === j) return null;
    if (was >= 0) return cur ? `Đổi chỗ với ô ${was + 1}` : `Chuyển sang ô ${j + 1}`;
    return cur ? `Thay ${cur.name}` : `Mang vào ô ${j + 1}`;
  }

  private drop(drag: string, drop: string): void {
    const v = this.data!;
    const [k, id] = drag.split(":");
    const [dk, did] = drop.split(":");
    const next = v.loadout.map((t) => t?.id ?? null);
    if (k === "slot" && dk === "bo") next[Number(id)] = null;
    else {
      const j = Number(did);
      const tid = k === "slot" ? next[Number(id)] : Number(id);
      const was = tid === null ? -1 : next.indexOf(tid);
      if (was >= 0) next[was] = next[j];
      next[j] = tid;
    }
    void this.send({ type: "mang_vao_tran", techniqueIds: next.filter((x): x is number => x !== null) });
  }

  protected override act(name: string, el: HTMLElement): void {
    const v = this.data;
    if (!v || this.dnd.justDropped()) return;
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
        .map((t) => `<li><button type="button" class="row${current[i] === t.id ? " picked" : ""}" data-pick="${t.id}">${techHtml(t)}${current.includes(t.id) ? `<span class="pick-tag">Ô ${current.indexOf(t.id) + 1}</span>` : ""}</button></li>`)
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
        preview = `<div class="preview"><b>${esc(techniqueName(main.kind, subs.map((s) => s.kind)))}</b>
          <span class="muted block">${GRADE_NAMES[grade - 1]} · ${esc(SKILL_NAME[t.type])} · D ${Math.round(t.damage / 1000)} · ${t.targets} mục tiêu · hồi ${(t.cooldownTicks / TICKS_PER_SECOND).toLocaleString("vi-VN")} s · ${t.manaCost} mana</span>
          <span class="muted block">Phẩm theo quyển thấp nhất; các quyển đem ghép bị tiêu hao.</span></div>`;
      }
      body.innerHTML = `
        ${preview}
        <ul class="list">${v.library
          .map((s) => {
            const at = pick.indexOf(s.uid);
            return `<li><button type="button" class="row${at >= 0 ? " picked" : ""}" data-uid="${s.uid}">${scrollHtml(s)}<span class="pick-tag">${at === 0 ? "Chủ" : at > 0 ? "Phụ" : ""}</span></button></li>`;
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
          .map((t) => `<li><button type="button" class="row${chosen.has(t.id) ? " picked" : ""}" data-id="${t.id}">${techHtml(t)}<span class="pick-tag">${chosen.has(t.id) ? "✓" : ""}</span></button></li>`)
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

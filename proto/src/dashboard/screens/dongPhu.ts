// Động phủ: dashboard của người chơi, mở sẵn khi vào game (GDD mục 14). Trả lời câu hỏi hôm nay cần làm gì.
import { MiniMap } from "../minimap.ts";
import { PageScene, type DashCtx } from "../shell.ts";
import type { DongPhuView, Go } from "../source.ts";
import { agoText, cd, clockText, esc, openSheet, withCountdowns } from "../ui.ts";

const JOB_ICON: Record<string, string> = { hanh_trinh: "⇢", xay: "⌂", ren: "⚒", luyen_dan: "⚗", be_quan: "☯" };
const RESULT: Record<string, string> = { thang: "Thắng", thua: "Thua", hoa: "Hòa" };

export class DongPhuScene extends PageScene<DongPhuView> {
  private mini: MiniMap;
  private gos: Go[] = [];

  constructor(ctx: DashCtx) {
    super("dong-phu", "Động phủ", ctx);
    this.mini = new MiniMap((x, y) => ctx.nav.go({ screen: "ban-do", at: { x, y } }));
  }

  protected read(): Promise<DongPhuView> {
    return this.ctx.source.dongPhu();
  }

  override enter(): void {
    super.enter();
    this.mini.start();
  }

  override leave(): void {
    super.leave();
    this.mini.stop();
  }

  /** Mỗi thẻ dẫn tới đâu; nút trong HTML chỉ mang số thứ tự. */
  private link(g: Go): string {
    this.gos.push(g);
    return `data-act="go" data-go="${this.gos.length - 1}"`;
  }

  protected render(v: DongPhuView): void {
    this.gos = [];
    const now = v.serverNow;
    const calendar = v.calendar
      .map((c) => {
        const state = now >= c.endsAt ? "past" : now >= c.startsAt ? "open" : "next";
        const when = state === "open" ? `đang mở, còn ${cd(c.endsAt)}` : state === "next" ? `còn ${cd(c.startsAt, "đang mở")}` : "đã qua";
        return `<li class="${state}"><button type="button" class="row" ${this.link(c.go)}>
          <span class="time">${clockText(c.startsAt)}</span><span class="grow">${esc(c.title)}</span><span class="muted">${when}</span></button></li>`;
      })
      .join("");
    const todo = v.todo.length
      ? `<section class="card todo">
          <h2>Việc nên làm</h2>
          <ul class="todo-list">${v.todo
            .map(
              (t) => `<li><button type="button" class="todo-item" ${this.link(t.go)}>
                <b>${esc(t.title)}</b><span class="muted">${withCountdowns(esc(t.detail))}</span></button>
                ${t.id === "thu_mo" ? `<button type="button" class="seal small" data-act="thu-mo">Thu</button>` : ""}</li>`,
            )
            .join("")}</ul>
        </section>`
      : "";
    this.page.innerHTML = `
      <section class="card">
        <h2>Đang chạy</h2>
        <ul class="list">${v.running
          .map(
            (j) => `<li><button type="button" class="row" ${this.link(j.go)}>
              <span class="icon" aria-hidden="true">${JOB_ICON[j.kind]}</span>
              <span class="grow"><b>${esc(j.title)}</b><span class="muted block">${esc(j.detail)}</span></span>
              <span class="cd-wrap">${cd(j.endsAt)}</span></button></li>`,
          )
          .join("")}</ul>
      </section>
      <section class="card">
        <h2>Lịch hôm nay</h2>
        <ul class="list cal">${calendar}</ul>
      </section>
      ${todo}
      <div class="pair">
        <section class="card mini-card">
          <h2>Bản đồ mini</h2>
          <div class="mini-slot"></div>
        </section>
        <section class="card city">
          <h2><button type="button" class="link" data-act="city">${esc(v.city.name)}</button></h2>
          <ul class="plain">${v.city.facilities.map((f) => `<li><button type="button" class="link" data-act="city">${esc(f)}</button></li>`).join("")}</ul>
        </section>
      </div>
      <section class="card news">
        <h2>Tin báo</h2>
        <h3>Chiến báo</h3>
        <ul class="list">${v.reports
          .map(
            (r) => `<li class="report ${r.result}"><span class="badge">${RESULT[r.result]}</span>
              <span class="grow"><b>${esc(r.title)}</b><span class="muted block">${esc(r.detail)} · ${agoText(now, r.at)}</span></span>
              <button type="button" class="seal small" ${this.link({ screen: "tran", battleId: r.id })}>Xem trận</button></li>`,
          )
          .join("")}</ul>
        <h3>Thư</h3>
        <ul class="list">${v.mail
          .map(
            (m) => `<li><button type="button" class="row" data-act="mail" data-id="${m.id}">
              ${m.unread ? `<span class="dot" aria-label="Chưa đọc"></span>` : ""}<span class="grow"><b>${esc(m.title)}</b><span class="muted block">${esc(m.from)}</span></span></button></li>`,
          )
          .join("")}</ul>
        <h3>Nhiệm vụ đang nhận</h3>
        <ul class="list">${v.quests
          .map((q) => `<li><button type="button" class="row" ${this.link(q.go)}><span class="grow"><b>${esc(q.name)}</b><span class="muted block">${esc(q.step)}</span></span></button></li>`)
          .join("")}</ul>
      </section>`;
    this.page.querySelector(".mini-slot")!.append(this.mini.el);
  }

  protected override mounted(): void {
    if (this.data) void this.mini.set(this.data.miniMap);
  }

  protected override act(name: string, el: HTMLElement): void {
    const v = this.data;
    if (!v) return;
    if (name === "go") this.ctx.nav.go(this.gos[Number(el.dataset.go)]);
    else if (name === "thu-mo") void this.send({ type: "thu_mo" });
    else if (name === "mail") void this.openMail(Number(el.dataset.id));
    else if (name === "city") this.openCity(v);
  }

  private async openMail(id: number): Promise<void> {
    const m = await this.ctx.source.mail(id);
    if (!m) return;
    openSheet(m.title, `<p class="muted">Từ ${esc(m.from)}</p><p>${esc(m.body)}</p>`);
    void this.reload();
  }

  /** Thành chủ: chợ, sàn, kho, lò rèn, nhiệm vụ NPC (GDD mục 14: cách Động phủ 2 chạm). */
  private openCity(v: DongPhuView): void {
    const body = openSheet(
      v.city.name,
      `<ul class="list">${v.city.facilities
        .map((f) => `<li class="row"><span class="grow"><b>${esc(f)}</b><span class="muted block">Có ở khối MVP (chợ, kho, lò rèn: M6)</span></span></li>`)
        .join("")}</ul>
       <button type="button" class="wide" data-map>Xem thành chủ trên bản đồ</button>`,
    );
    body.querySelector("[data-map]")!.addEventListener("click", () => this.ctx.nav.go({ screen: "ban-do", pointId: v.city.pointId }));
  }
}

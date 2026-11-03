// Động phủ: dashboard của người chơi, mở sẵn khi vào game (GDD mục 14). Trả lời câu hỏi hôm nay cần làm gì.
import { loadLocationArt, pointArt } from "../art/sectScene.ts";
import { icon, type IconName } from "../icons.ts";
import { MiniMap } from "../minimap.ts";
import { PageScene, type DashCtx } from "../shell.ts";
import type { DongPhuView, Go } from "../source.ts";
import { agoText, cd, clockText, esc, openSheet, withCountdowns } from "../ui.ts";

const JOB_ICON: Record<string, IconName> = { hanh_trinh: "hanh_trinh", xay: "xay", ren: "ren", luyen_dan: "luyen_dan", be_quan: "be_quan" };
const RESULT: Record<string, string> = { thang: "Thắng", thua: "Thua", hoa: "Hòa" };
const TODO_ICON: Record<string, IconName> = { bi_danh: "sword", thu_mo: "gem", o_trong: "cong_phap", do_hong: "shield", don: "users", nhiem_vu: "scroll" };
/** Việc gấp: dấu son trên ô icon. */
const HOT = new Set(["bi_danh"]);
type NewsTab = "bao" | "thu" | "nv";

export class DongPhuScene extends PageScene<DongPhuView> {
  private mini: MiniMap;
  private gos: Go[] = [];
  private news: NewsTab = "bao";

  constructor(ctx: DashCtx) {
    super("dong-phu", "Động phủ", ctx);
    this.mini = new MiniMap((x, y) => ctx.nav.go({ screen: "ban-do", at: { x, y } }));
  }

  protected async read(): Promise<DongPhuView> {
    const [v] = await Promise.all([this.ctx.source.dongPhu(), loadLocationArt()]);
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

  /** Mỗi thẻ dẫn tới đâu; nút trong HTML chỉ mang số thứ tự. */
  private link(g: Go): string {
    this.gos.push(g);
    return `data-act="go" data-go="${this.gos.length - 1}"`;
  }

  protected render(v: DongPhuView): void {
    this.gos = [];
    const now = v.serverNow;
    const chev = icon("chevron", "chev");
    // Việc chính của màn: tối đa 3 việc nên làm, mỗi việc chạm một lần là tới đúng chỗ. Không còn việc thì ẩn.
    const todo = v.todo.length
      ? `<section class="card primary todo">
          <h2>Việc nên làm</h2>
          <ul class="list todo-list">${v.todo
            .map(
              (t) => `<li><button type="button" class="row" ${this.link(t.go)}>
                <span class="todo-mark${HOT.has(t.id) ? " hot" : ""}">${icon(TODO_ICON[t.id] ?? "scroll")}</span>
                <span class="grow"><b>${esc(t.title)}</b><span class="sub block muted">${withCountdowns(esc(t.detail))}</span></span>
                ${t.id === "thu_mo" ? "" : chev}</button>
                ${t.id === "thu_mo" ? `<button type="button" class="seal small" data-act="thu-mo">Thu</button>` : ""}</li>`,
            )
            .join("")}</ul>
        </section>`
      : "";
    const running = `<section class="card running">
        <h2>Đang chạy <span class="right">${v.running.length}</span></h2>
        <ul class="list">${v.running
          .map(
            (j) => `<li><button type="button" class="row" ${this.link(j.go)}>
              <span class="icon">${icon(JOB_ICON[j.kind])}</span>
              <span class="grow"><b>${esc(j.title)}</b><span class="muted block">${esc(j.detail)}</span></span>
              <span class="cd-wrap">${cd(j.endsAt)}</span></button></li>`,
          )
          .join("")}</ul>
      </section>`;
    const calendar = `<section class="card cal-card">
        <h2>Lịch hôm nay</h2>
        <ul class="list cal">${v.calendar
          .map((c) => {
            const state = now >= c.endsAt ? "past" : now >= c.startsAt ? "open" : "next";
            const when = state === "open" ? `đang mở · còn ${cd(c.endsAt)}` : state === "next" ? `còn ${cd(c.startsAt, "đang mở")}` : "đã qua";
            return `<li class="${state}"><button type="button" class="row" ${this.link(c.go)}>
              <span class="time">${clockText(c.startsAt)}</span><span class="grow">${esc(c.title)}<span class="when block">${when}</span></span>${icon("chevron", "chev")}</button></li>`;
          })
          .join("")}</ul>
      </section>`;
    // Tin báo gộp ba loại vào một thẻ, chia tab con để thẻ không dài: chạm tab rồi chạm tin là 2 lần.
    const unread = v.mail.filter((m) => m.unread).length;
    const tabs: [NewsTab, string, string][] = [
      ["bao", "Chiến báo", String(v.reports.length)],
      ["thu", "Thư", unread ? String(unread) : ""],
      ["nv", "Nhiệm vụ", String(v.quests.length)],
    ];
    const newsBody =
      this.news === "bao"
        ? v.reports
            .map(
              (r) => `<li class="report ${r.result}">
                <span class="grow"><b>${esc(r.title)}</b><span class="muted block"><span class="res">${RESULT[r.result]}</span> · ${esc(r.detail)} · ${agoText(now, r.at)}</span></span>
                <button type="button" class="btn small" ${this.link({ screen: "tran", battleId: r.id })}>Xem trận</button></li>`,
            )
            .join("")
        : this.news === "thu"
          ? v.mail
              .map(
                (m) => `<li><button type="button" class="row" data-act="mail" data-id="${m.id}">
                  ${m.unread ? `<span class="dot" aria-label="Chưa đọc"></span>` : ""}<span class="grow"><b>${esc(m.title)}</b><span class="muted block">${esc(m.from)}</span></span>${chev}</button></li>`,
              )
              .join("")
          : v.quests
              .map((q) => `<li><button type="button" class="row" ${this.link(q.go)}><span class="grow"><b>${esc(q.name)}</b><span class="muted block">${esc(q.step)}</span></span>${chev}</button></li>`)
              .join("");
    const news = `<section class="card news">
        <h2>Tin báo</h2>
        <div class="seg" role="tablist" aria-label="Tin báo">${tabs
          .map(([id, label, n]) => `<button type="button" role="tab" data-act="news" data-tab="${id}" aria-selected="${this.news === id}">${label}${n ? `<span class="n${id === "thu" ? " hot" : ""}">${n}</span>` : ""}</button>`)
          .join("")}</div>
        <ul class="list">${newsBody || `<li class="empty-note">Chưa có tin.</li>`}</ul>
      </section>`;
    // Bản đồ mini và Thành chủ: Thành chủ là một thẻ chạm được, chi tiết mở bằng bảng trượt (2 chạm).
    const around = `<div class="around">
        <section class="card mini-card"><h2>Bản đồ mini</h2><div class="mini-slot"></div></section>
        <button type="button" class="card city-card" data-act="city">
          <span class="sec-h">Thành chủ</span>
          <span class="city-name">${esc(v.city.name)}</span>
          <span class="muted">${v.city.facilities.map(esc).join(" · ")}</span>
          <span class="go">Vào thành ›</span>
        </button>
      </div>`;
    // Điện thoại: một cột theo order trong CSS. Máy tính: cột trái việc cần làm và tin, cột phải lịch và quanh mình.
    this.page.innerHTML = `<div class="cols">
        <div class="col">${todo}${running}${news}</div>
        <div class="col">${calendar}${around}</div>
      </div>`;
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
    else if (name === "news") {
      this.news = el.dataset.tab as NewsTab;
      this.render(v);
      this.mounted();
    }
  }

  private async openMail(id: number): Promise<void> {
    const m = await this.ctx.source.mail(id);
    if (!m) return;
    openSheet(m.title, `<p class="muted">Từ ${esc(m.from)}</p><p>${esc(m.body)}</p>`);
    void this.reload();
  }

  /** Thành chủ: chợ, sàn, kho, lò rèn, nhiệm vụ NPC (GDD mục 14: cách Động phủ 2 chạm). */
  private openCity(v: DongPhuView): void {
    const art = pointArt(v.miniMap.region, "thanh_chu");
    const body = openSheet(
      v.city.name,
      `${art ? `<div class="loc-hero pix" style="background-image:url('${art}')" role="img" aria-label="${esc(v.city.name)}"></div>` : ""}<ul class="list">${v.city.facilities
        .map((f) => `<li class="row"><span class="grow"><b>${esc(f)}</b><span class="muted block">Có ở khối MVP (chợ, kho, lò rèn: M6)</span></span></li>`)
        .join("")}</ul>
       <button type="button" class="wide" data-map>Xem thành chủ trên bản đồ</button>`,
    );
    body.querySelector("[data-map]")!.addEventListener("click", () => this.ctx.nav.go({ screen: "ban-do", pointId: v.city.pointId }));
  }
}

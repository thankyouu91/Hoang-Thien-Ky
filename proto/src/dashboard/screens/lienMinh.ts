// Liên minh (GDD mục 14). Chưa có liên minh: danh sách liên minh cùng vị diện, lời mời, nút Lập (tông môn cấp 20)
// hoặc Xin vào (cấp 5). Đã có: 5 tông môn thành viên, bản đồ mini lãnh thổ liên minh đặt cạnh lịch chiến để nhìn ra
// mặt trận, xin hộ chiến, boss, chat có lọc từ và nút báo cáo (G1). Nút liên minh chỉ tông chủ và phó tông chủ thấy.
import { MiniMap } from "../minimap.ts";
import { PageScene, type DashCtx } from "../shell.ts";
import type { LienMinhView } from "../source.ts";
import { agoText, cd, clockText, esc, toast } from "../ui.ts";

export class LienMinhScene extends PageScene<LienMinhView> {
  private mini: MiniMap;

  constructor(ctx: DashCtx) {
    super("lien-minh", "Liên minh", ctx);
    this.mini = new MiniMap((x, y) => ctx.nav.go({ screen: "ban-do", at: { x, y } }));
  }

  protected read(): Promise<LienMinhView> {
    return this.ctx.source.lienMinh();
  }

  override enter(): void {
    super.enter();
    this.mini.start();
  }

  override leave(): void {
    super.leave();
    this.mini.stop();
  }

  protected render(v: LienMinhView): void {
    this.page.innerHTML = `${v.alliance ? this.joined(v) : this.none(v)}
      <details class="dev"><summary>Công cụ thử (prototype)</summary>
        <label><input type="checkbox" data-dev="joined" ${v.alliance ? "checked" : ""}> Tông môn đã vào liên minh</label>
      </details>`;
  }

  protected override mounted(): void {
    const a = this.data?.alliance;
    const slot = this.page.querySelector(".mini-slot");
    if (a && slot) {
      slot.append(this.mini.el);
      void this.mini.set(a.miniMap);
    }
    this.page.querySelector<HTMLInputElement>("[data-dev=joined]")?.addEventListener("change", (e) => {
      void this.send({ type: "dev_lien_minh", joined: (e.target as HTMLInputElement).checked });
    });
    const log = this.page.querySelector(".chat-log");
    if (log) log.scrollTop = log.scrollHeight;
  }

  private none(v: LienMinhView): string {
    const canJoin = v.can.lienMinh && v.sectLevel >= v.joinLevel;
    const canCreate = v.can.lienMinh && v.sectLevel >= v.createLevel;
    // Việc chính khi chưa có liên minh: nhận lời mời hoặc xin vào một liên minh cùng vị diện.
    return `<div class="cols">
      <div class="col">
        <section class="card primary">
          <h2>Liên minh cùng vị diện</h2>
          <ul class="list">${v.list
            .map(
              (l) => `<li class="row"><span class="grow"><b>${esc(l.name)}</b>${l.invited ? ` <span class="chip plain bad">Mời bạn</span>` : ""}<span class="muted block">${l.sects}/5 tông môn · tông mạnh nhất cấp ${l.level}</span></span>
                ${v.can.lienMinh ? `<button type="button" class="${l.invited ? "seal" : "btn"} small" data-act="join" data-id="${l.id}" ${canJoin ? "" : "disabled"}>${l.invited ? "Nhận lời" : "Xin vào"}</button>` : ""}</li>`,
            )
            .join("") || `<li class="empty-note">Chưa có liên minh nào trong vị diện.</li>`}</ul>
          ${v.can.lienMinh ? "" : `<p class="note">Chỉ tông chủ và phó tông chủ xin vào hay lập liên minh.</p>`}
        </section>
      </div>
      <div class="col">
        <section class="card">
          <h2>Chưa có liên minh</h2>
          <p class="muted">Liên minh tối đa 5 tông môn cùng vị diện. Xin vào từ tông môn cấp ${v.joinLevel}, lập từ cấp ${v.createLevel}.</p>
          ${v.can.lienMinh ? `<button type="button" class="wide" data-act="create" ${canCreate ? "" : "disabled"}>Lập liên minh</button>` : ""}
        </section>
      </div>
    </div>`;
  }

  private joined(v: LienMinhView): string {
    const a = v.alliance!;
    const now = v.serverNow;
    const head = `<section class="card al-head">
        <h1>${esc(a.name)}</h1>
        <p class="sub">Minh chủ ${esc(a.leader)} · ${a.sects.length}/5 tông môn cùng vị diện</p>
        ${v.can.lienMinh ? `<div class="btns compact"><button type="button" class="btn small" data-act="invite" ${a.sects.length >= 5 ? "disabled" : ""}>Mời tông môn</button><button type="button" class="btn small" data-act="declare">Tuyên chiến</button><button type="button" class="btn small" data-act="leave">Rời liên minh</button></div>` : ""}
      </section>`;
    const sects = `<section class="card">
        <h2>Tông môn thành viên <span class="right">${a.sects.length} / 5</span></h2>
        <ul class="list">${a.sects
          .map((s) => `<li class="row"><span class="swatch" style="background:${s.color}"></span><span class="grow"><b>${esc(s.name)}</b><span class="muted block">cấp ${s.level} · phe ${esc(s.faction)} · ${s.points} điểm · ${s.online} online</span></span></li>`)
          .join("")}</ul>
      </section>`;
    // Bản đồ mini lãnh thổ liên minh đặt cạnh lịch chiến để nhìn ra mặt trận (GDD mục 14).
    const front = `<section class="card front-card">
        <h2>Mặt trận</h2>
        <div class="front">
          <div class="mini-slot"></div>
          <div class="war-days"><span class="muted">Lịch chiến tuần</span><b>${esc(a.warDays)}</b><b>${esc(a.warHours)}</b>
            ${a.wars.map((w) => `<span class="muted">${esc(w.with)}: còn ${cd(w.startsAt, "đang đánh")}</span>`).join("")}</div>
        </div>
      </section>`;
    // Việc chính khi đã có liên minh: hộ chiến cho đồng minh đang bị đánh.
    const help = `<section class="card primary">
        <h2>Xin hộ chiến <span class="right">${a.helpRequests.length}</span></h2>
        <ul class="list">${a.helpRequests
          .map((h) => `<li class="row"><span class="grow"><b>${esc(h.from)}</b><span class="muted block">${esc(h.point)} · ${agoText(now, h.at)}</span></span><button type="button" class="seal small" data-act="help">Hộ chiến</button></li>`)
          .join("") || `<li class="empty-note">Không ai đang xin hộ chiến.</li>`}</ul>
        <button type="button" class="wide" data-act="ask-help">Xin hộ chiến cho tông mình</button>
      </section>`;
    const boss = `<section class="card">
        <h2>Boss liên minh <span class="right">${esc(a.boss.days)}</span></h2>
        <div class="boss-line"><b>${esc(a.boss.name)}</b><span class="muted">còn ${a.boss.hpPercent}% máu</span></div>
        <div class="bar"><i style="width:${a.boss.hpPercent}%"></i></div>
      </section>`;
    const chat = `<section class="card chat">
        <h2>Chat liên minh</h2>
        <ul class="chat-log">${a.chat
          .map(
            (c) => `<li><span class="who"><span><b>${esc(c.from)}</b> · ${clockText(c.at)}</span>
              ${c.reported ? `<span>Đã báo cáo</span>` : `<button type="button" class="link small-link" data-act="report" data-id="${c.id}">Báo cáo</button>`}</span>
              <span class="text">${esc(c.text)}</span></li>`,
          )
          .join("")}</ul>
        <form class="chat-form" data-act="chat"><input name="text" maxlength="200" autocomplete="off" placeholder="Nhắn cho liên minh" aria-label="Tin nhắn"><button type="submit" class="seal">Gửi</button></form>
        <p class="note">Có lọc từ; chạm Báo cáo để gửi tin xấu cho quản trị (G1).</p>
      </section>`;
    return `${head}<div class="cols"><div class="col">${help}${front}${boss}</div><div class="col">${sects}${chat}</div></div>`;
  }

  protected override act(name: string, el: HTMLElement): void {
    switch (name) {
      case "join":
        void this.send({ type: "xin_vao_lien_minh", allianceId: el.dataset.id! });
        break;
      case "report":
        void this.send({ type: "bao_cao", chatId: Number(el.dataset.id) });
        break;
      case "chat": {
        const input = (el as HTMLFormElement).elements.namedItem("text") as HTMLInputElement;
        if (input.value.trim()) void this.send({ type: "chat", text: input.value });
        break;
      }
      case "create":
      case "invite":
      case "leave":
      case "declare":
        toast("Lập, mời, rời liên minh và tuyên chiến có ở khối M5.");
        break;
      case "help":
      case "ask-help":
        toast("Hộ chiến có ở khối M5.");
        break;
    }
  }
}

// Khung chung của các màn dashboard: thanh trên, điều hướng theo `Go`, và lớp PageScene cho màn DOM.
import { Camera } from "../app/camera.ts";
import type { Scene } from "../app/scene.ts";
import type { CommandResult, DashboardCommand, DashboardSource, Go, Stamped, TopBarView } from "./source.ts";
import { assetUrl, ERROR_TEXT, esc, fmt, ServerClock, tickCountdowns, toast } from "./ui.ts";

export interface Nav {
  go(g: Go): void;
  /** Về màn chính trước đó (dùng ở Nhân vật, mở từ thanh trên). */
  back(): void;
}

/** Những gì mọi màn dashboard dùng chung. */
export interface DashCtx {
  source: DashboardSource;
  clock: ServerClock;
  topbar: TopBar;
  nav: Nav;
}

/** Thanh trên cố định ở mọi màn chính (GDD mục 14): chân dung, cấp và cảnh giới, linh thạch, tiên ngọc, nhãn tuổi G1. */
export class TopBar {
  readonly el: HTMLElement;

  constructor(onPortrait: () => void, onBack: () => void) {
    this.el = document.createElement("header");
    this.el.id = "topbar";
    this.el.innerHTML = `<button type="button" class="back" aria-label="Quay lại">‹ Quay lại</button><div class="content"></div>`;
    this.el.addEventListener("click", (e) => {
      const t = e.target as HTMLElement;
      if (t.closest(".portrait")) onPortrait();
      else if (t.closest(".back")) onBack();
    });
  }

  set(t: TopBarView): void {
    const minor = t.playMinutesLeft !== undefined ? `<span class="play" title="Thời gian chơi còn lại hôm nay">⏳ ${t.playMinutesLeft} phút</span>` : "";
    const sat = t.satNghiep > 0 ? `<span class="sat" title="Sát nghiệp">Sát nghiệp ${fmt(t.satNghiep)}</span>` : "";
    this.el.querySelector(".content")!.innerHTML = `
      <button type="button" class="portrait" aria-label="Mở màn Nhân vật">
        <img src="${assetUrl(t.portrait)}" alt="">
      </button>
      <div class="who">
        <div class="lv"><b>Cấp ${t.level}</b> · ${esc(t.realm)}</div>
        <div class="money"><span title="Linh thạch hạ phẩm">◆ ${fmt(t.linhThach)}</span><span title="Tiên ngọc">✦ ${fmt(t.tienNgoc)}</span>${sat}</div>
      </div>
      ${minor}
      <span class="age" title="Nhãn phân loại độ tuổi">${esc(t.ageLabel)}</span>`;
  }
}

/**
 * Màn DOM: mỗi lần mở thì gọi một lệnh đọc gộp, vẽ lại các thẻ, rồi tự đếm ngược theo giờ server mỗi giây.
 * Lớp con chỉ viết `read`, `render` và xử lý nút qua thuộc tính data-act.
 */
export abstract class PageScene<V extends Stamped & { top: TopBarView }> implements Scene {
  readonly id: string;
  readonly label: string;
  readonly camera = new Camera();
  readonly page: HTMLElement;
  protected ctx: DashCtx;
  protected data?: V;
  private timer = 0;
  private running = 0;
  private loading = false;

  constructor(id: string, label: string, ctx: DashCtx) {
    this.id = id;
    this.label = label;
    this.ctx = ctx;
    this.page = document.createElement("main");
    this.page.className = `page page-${id}`;
    this.page.addEventListener("click", (e) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>("[data-act]");
      if (el && this.page.contains(el) && !(el as HTMLButtonElement).disabled) this.act(el.dataset.act!, el);
    });
    this.page.addEventListener("submit", (e) => {
      e.preventDefault();
      const form = e.target as HTMLFormElement;
      if (form.dataset.act) this.act(form.dataset.act, form);
    });
  }

  enter(): void {
    void this.reload();
    clearInterval(this.timer);
    this.timer = window.setInterval(() => this.tick(), 1000);
  }

  leave(): void {
    clearInterval(this.timer);
  }

  update(): void {}
  draw(): void {}

  protected abstract read(): Promise<V>;
  protected abstract render(v: V): void;
  protected act(_name: string, _el: HTMLElement): void {}
  /** Sau mỗi lần render, khi các phần tử đã nằm trong trang. */
  protected mounted(): void {}

  async reload(): Promise<void> {
    if (this.loading) return;
    this.loading = true;
    try {
      const v = await this.read();
      this.ctx.clock.sync(v.serverNow);
      this.ctx.topbar.set(v.top);
      this.data = v;
      this.render(v);
      this.mounted();
      this.running = tickCountdowns(this.page, this.ctx.clock.now());
    } finally {
      this.loading = false;
    }
  }

  /** Một việc vừa xong (đếm ngược về 0) thì đọc lại, để thẻ đổi theo. */
  protected tick(): void {
    const n = tickCountdowns(this.page, this.ctx.clock.now());
    if (n < this.running) void this.reload();
    this.running = n;
  }

  protected async send(cmd: DashboardCommand): Promise<CommandResult> {
    const r = await this.ctx.source.send(cmd);
    if (r.ok) {
      if (r.message) toast(r.message);
    } else toast(ERROR_TEXT[r.error] ?? `Lỗi: ${r.error}`, true);
    await this.reload();
    return r;
  }
}

/** Nguồn dựng lười: các màn gọi ngay được, lệnh đầu tiên chờ dữ liệu mẫu nạp xong. */
export function lazySource(create: () => Promise<DashboardSource>): DashboardSource {
  let p: Promise<DashboardSource> | undefined;
  const get = () => (p ??= create());
  return {
    dongPhu: async () => (await get()).dongPhu(),
    nhanVat: async () => (await get()).nhanVat(),
    tongMon: async () => (await get()).tongMon(),
    congPhap: async () => (await get()).congPhap(),
    lienMinh: async () => (await get()).lienMinh(),
    banDo: async () => (await get()).banDo(),
    mail: async (id) => (await get()).mail(id),
    battle: async (id) => (await get()).battle(id),
    send: async (cmd) => (await get()).send(cmd),
  };
}

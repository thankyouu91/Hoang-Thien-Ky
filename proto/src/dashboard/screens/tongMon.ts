import { PageScene, type DashCtx } from "../shell.ts";
import type { TongMonView } from "../source.ts";

export type TongMonTab = "tong-quan" | "son-mon" | "thanh-vien" | "chien-su";

export class TongMonScene extends PageScene<TongMonView> {
  private tab: TongMonTab = "tong-quan";

  constructor(ctx: DashCtx) {
    super("tong-mon", "Tông môn", ctx);
  }

  setTab(t: TongMonTab): void {
    this.tab = t;
  }

  protected read(): Promise<TongMonView> {
    return this.ctx.source.tongMon();
  }

  protected render(v: TongMonView): void {
    this.page.innerHTML = `<section class="card"><h2>${v.sect.name} · ${this.tab}</h2></section>`;
  }
}

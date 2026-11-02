import { PageScene, type DashCtx } from "../shell.ts";
import type { LienMinhView } from "../source.ts";

export class LienMinhScene extends PageScene<LienMinhView> {
  constructor(ctx: DashCtx) {
    super("lien-minh", "Liên minh", ctx);
  }

  protected read(): Promise<LienMinhView> {
    return this.ctx.source.lienMinh();
  }

  protected render(v: LienMinhView): void {
    this.page.innerHTML = `<section class="card"><h2>${v.alliance?.name ?? "Chưa có liên minh"}</h2></section>`;
  }
}

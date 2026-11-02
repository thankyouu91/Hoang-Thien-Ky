import { PageScene, type DashCtx } from "../shell.ts";
import type { CongPhapView } from "../source.ts";

export type CongPhapSection = "mang" | "truyen-thu" | "tui" | "tang-kinh";

export class CongPhapScene extends PageScene<CongPhapView> {
  constructor(ctx: DashCtx) {
    super("cong-phap", "Công pháp", ctx);
  }

  focusSection(_s?: CongPhapSection): void {}

  protected read(): Promise<CongPhapView> {
    return this.ctx.source.congPhap();
  }

  protected render(v: CongPhapView): void {
    this.page.innerHTML = `<section class="card"><h2>Công pháp ${v.learned.length}</h2></section>`;
  }
}

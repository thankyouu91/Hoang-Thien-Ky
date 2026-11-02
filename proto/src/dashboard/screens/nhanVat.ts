import type { Sprites } from "../../assets/sprites.ts";
import { PageScene, type DashCtx } from "../shell.ts";
import type { NhanVatView } from "../source.ts";

export type NhanVatTab = "trang-bi" | "chi-so" | "thu-cuoi";

export class NhanVatScene extends PageScene<NhanVatView> {
  private tab: NhanVatTab = "trang-bi";
  private sprites: Sprites;

  constructor(ctx: DashCtx, sprites: Sprites) {
    super("nhan-vat", "Nhân vật", ctx);
    this.sprites = sprites;
  }

  setTab(t: NhanVatTab): void {
    this.tab = t;
  }

  protected read(): Promise<NhanVatView> {
    return this.ctx.source.nhanVat();
  }

  protected render(v: NhanVatView): void {
    this.page.innerHTML = `<section class="card"><h2>Lực chiến ${v.power.total} · ${this.tab} ${this.sprites.size}</h2></section>`;
  }
}

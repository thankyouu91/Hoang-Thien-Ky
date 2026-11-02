import { FpsMeter } from "./fps.ts";
import { attachInput } from "./input.ts";
import type { Scene } from "./scene.ts";
import { createView, syncSize, type View } from "./view.ts";

const BG = "#14110f";

/** Vòng lặp vẽ, thanh dưới và chuyển scene. */
export class App {
  readonly view: View;
  readonly fps = new FpsMeter();
  private canvas: HTMLCanvasElement;
  private hud: HTMLElement;
  private tabbar: HTMLElement;
  private current: Scene;
  private last = 0;

  constructor(canvas: HTMLCanvasElement, hud: HTMLElement, tabbar: HTMLElement, scenes: Scene[]) {
    this.canvas = canvas;
    this.hud = hud;
    this.tabbar = tabbar;
    this.view = createView(canvas);
    this.current = scenes.find((s) => "#" + s.id === location.hash) ?? scenes[scenes.length - 1];

    for (const s of scenes) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = s.label;
      b.dataset.scene = s.id;
      b.addEventListener("click", () => this.show(s));
      tabbar.append(b);
      if (s.hud) {
        s.hud.hidden = true;
        hud.append(s.hud);
      }
    }
    // HUD đổi chiều cao thì vùng nhìn của camera đổi theo.
    new ResizeObserver(() => this.measureBottom()).observe(hud);
    window.addEventListener("hashchange", () => {
      const s = scenes.find((x) => "#" + x.id === location.hash);
      if (s && s !== this.current) this.show(s);
    });
    attachInput(canvas, this.view, () => this.current.camera);
  }

  start(): void {
    syncSize(this.canvas, this.view);
    this.show(this.current);
    requestAnimationFrame(this.frame);
  }

  show(s: Scene): void {
    if (this.current.hud) this.current.hud.hidden = true;
    this.current = s;
    if (s.hud) s.hud.hidden = false;
    for (const b of this.tabbar.querySelectorAll("button")) b.setAttribute("aria-selected", String(b.dataset.scene === s.id));
    history.replaceState(null, "", "#" + s.id);
    this.measureBottom();
    s.enter?.(this.view);
  }

  private measureBottom(): void {
    this.view.bottom = Math.max(0, this.canvas.getBoundingClientRect().bottom - this.hud.getBoundingClientRect().top);
  }

  private frame = (now: number): void => {
    const dt = this.last ? Math.min(0.1, (now - this.last) / 1000) : 0;
    this.last = now;
    this.fps.tick(now);
    if (syncSize(this.canvas, this.view)) this.measureBottom();

    const v = this.view;
    const ctx = v.ctx;
    this.current.update(dt);
    ctx.setTransform(v.dpr, 0, 0, v.dpr, 0, 0);
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, v.w, v.h);
    this.current.draw(v);

    ctx.setTransform(v.dpr, 0, 0, v.dpr, 0, 0);
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillStyle = "rgba(239, 230, 214, 0.6)";
    ctx.fillText(`${Math.round(this.fps.fps)} fps · ${this.fps.worstMs.toFixed(0)} ms`, 8, 8);

    requestAnimationFrame(this.frame);
  };
}

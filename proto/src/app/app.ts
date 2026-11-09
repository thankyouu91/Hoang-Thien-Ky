import { FpsMeter } from "./fps.ts";
import { attachInput } from "./input.ts";
import type { Scene } from "./scene.ts";
import { createView, syncSize, type View } from "./view.ts";

const BG = "#14110f";

export interface AppOptions {
  /** Scene không có nút trên thanh dưới, mở bằng hash hoặc `open` (Trận mở từ chiến báo, Nhân vật từ thanh trên). */
  offTab?: Scene[];
  /** Gọi mỗi lần đổi scene, sau `enter`. */
  onShow?: (s: Scene) => void;
}

/** Vòng lặp vẽ, thanh dưới và chuyển scene. */
export class App {
  readonly view: View;
  readonly fps = new FpsMeter();
  private canvas: HTMLCanvasElement;
  private hud: HTMLElement;
  private tabbar: HTMLElement;
  private scenes: Scene[];
  private current: Scene;
  private onShow?: (s: Scene) => void;
  private last = 0;

  /** `scenes` theo thứ tự trên thanh dưới; scene đầu là màn mở mặc định (Động phủ, GDD mục 14). */
  constructor(canvas: HTMLCanvasElement, hud: HTMLElement, tabbar: HTMLElement, scenes: Scene[], options: AppOptions = {}) {
    this.canvas = canvas;
    this.hud = hud;
    this.tabbar = tabbar;
    this.scenes = [...scenes, ...(options.offTab ?? [])];
    this.onShow = options.onShow;
    this.view = createView(canvas);
    this.current = this.byHash() ?? scenes[0];

    // Màn DOM nằm trong #pages, ngay trên canvas.
    const pages = document.createElement("div");
    pages.id = "pages";
    canvas.after(pages);

    for (const s of scenes) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = s.label;
      b.dataset.scene = s.id;
      b.addEventListener("click", () => this.show(s));
      tabbar.append(b);
    }
    for (const s of this.scenes) {
      if (s.hud) {
        s.hud.hidden = true;
        hud.append(s.hud);
      }
      if (s.page) {
        s.page.hidden = true;
        pages.append(s.page);
      }
    }
    // HUD đổi chiều cao thì vùng nhìn của camera đổi theo.
    new ResizeObserver(() => this.measureBottom()).observe(hud);
    window.addEventListener("hashchange", () => {
      const s = this.byHash();
      if (s && s !== this.current) this.show(s);
    });
    // Nút Quay lại của trình duyệt sau `open`.
    window.addEventListener("popstate", () => {
      const s = this.byHash();
      if (s && s !== this.current) this.show(s);
    });
    attachInput(canvas, this.view, () => this.current.camera);
  }

  start(): void {
    syncSize(this.canvas, this.view);
    this.show(this.current);
    requestAnimationFrame(this.frame);
  }

  /** Scene đang mở. */
  get scene(): Scene {
    return this.current;
  }

  /**
   * Mở scene theo id và ghi một mục lịch sử, để nút Quay lại của trình duyệt về màn trước
   * (ví dụ Xem trận từ chiến báo rồi quay về Động phủ). Chạm tab thì không ghi lịch sử.
   */
  open(id: string): void {
    const s = this.scenes.find((x) => x.id === id);
    if (!s) throw new Error(`Không có scene ${id}`);
    if (s === this.current) return;
    history.pushState(null, "", "#" + id);
    this.show(s);
  }

  show(s: Scene): void {
    if (s !== this.current) this.current.leave?.();
    if (this.current.hud) this.current.hud.hidden = true;
    if (this.current.page) this.current.page.hidden = true;
    this.current = s;
    if (s.hud) s.hud.hidden = false;
    if (s.page) s.page.hidden = false;
    document.body.dataset.scene = s.id;
    for (const b of this.tabbar.querySelectorAll("button")) b.setAttribute("aria-selected", String(b.dataset.scene === s.id));
    this.measureBottom();
    s.enter?.(this.view);
    // Ghi hash sau enter để scene đọc được tham số deep-link (ví dụ #the-gioi/232) trước khi hash về dạng gọn.
    history.replaceState(history.state, "", "#" + s.id);
    this.onShow?.(s);
  }

  private byHash(): Scene | undefined {
    // Cho phép deep-link kèm tham số dạng #the-gioi/232 (chỉ số của điểm), phục vụ thử nghiệm.
    return this.scenes.find((s) => "#" + s.id === location.hash || location.hash.startsWith("#" + s.id + "/"));
  }

  private measureBottom(): void {
    this.view.bottom = Math.max(0, this.canvas.getBoundingClientRect().bottom - this.hud.getBoundingClientRect().top);
  }

  private frame = (now: number): void => {
    const dt = this.last ? Math.min(0.1, (now - this.last) / 1000) : 0;
    this.last = now;
    this.fps.tick(now);
    if (syncSize(this.canvas, this.view)) this.measureBottom();

    this.current.update(dt);
    // Màn DOM phủ kín canvas nên không cần vẽ.
    if (!this.current.page) {
      const v = this.view;
      const ctx = v.ctx;
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
    }

    requestAnimationFrame(this.frame);
  };
}

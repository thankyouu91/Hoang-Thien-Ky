import type { ReplayPlayer } from "../../replay/player.ts";

const SPEEDS = [1, 2, 4];

/** Thanh điều khiển replay (DOM): tua, phát/tạm dừng, tốc độ. */
export class ReplayControls {
  readonly el: HTMLElement;
  private seek: HTMLInputElement;
  private play: HTMLButtonElement;
  private time: HTMLSpanElement;
  private speedButtons: HTMLButtonElement[];
  private player: ReplayPlayer | null = null;
  private seeking = false;
  private shown = "";

  constructor() {
    this.el = document.createElement("div");
    this.el.className = "replay";
    this.el.innerHTML = `
      <input class="seek" type="range" min="0" max="1" step="1" value="0" aria-label="Tua trận" disabled />
      <div class="row">
        <button class="play" type="button" aria-label="Phát hoặc tạm dừng" disabled>❚❚</button>
        <span class="time">Đang tải…</span>
        <div class="speeds" role="group" aria-label="Tốc độ">
          ${SPEEDS.map((s) => `<button type="button" data-speed="${s}">×${s}</button>`).join("")}
        </div>
      </div>`;
    this.seek = this.el.querySelector(".seek")!;
    this.play = this.el.querySelector(".play")!;
    this.time = this.el.querySelector(".time")!;
    this.speedButtons = [...this.el.querySelectorAll<HTMLButtonElement>("[data-speed]")];

    this.seek.addEventListener("pointerdown", () => (this.seeking = true));
    this.seek.addEventListener("change", () => (this.seeking = false));
    this.seek.addEventListener("input", () => this.player?.seek(Number(this.seek.value)));
    this.play.addEventListener("click", () => this.player?.toggle());
    for (const b of this.speedButtons) {
      b.addEventListener("click", () => {
        if (this.player) this.player.speed = Number(b.dataset.speed);
      });
    }
  }

  bind(player: ReplayPlayer): void {
    this.player = player;
    this.seek.max = String(player.end);
    this.seek.disabled = false;
    this.play.disabled = false;
  }

  /** Gọi mỗi khung hình; chỉ chạm DOM khi giá trị hiển thị đổi. */
  sync(): void {
    const p = this.player;
    if (!p) return;
    if (!this.seeking && Math.abs(Number(this.seek.value) - p.t) >= 1) this.seek.value = String(Math.floor(p.t));
    const sec = (x: number) => (x / p.tps).toFixed(1).replace(".", ",");
    const label = `${sec(p.t)} / ${sec(p.end)} s`;
    const state = `${label}|${p.playing}|${p.speed}`;
    if (state === this.shown) return;
    this.shown = state;
    this.time.textContent = label;
    this.play.textContent = p.playing ? "❚❚" : p.t >= p.end ? "↺" : "▶";
    for (const b of this.speedButtons) b.setAttribute("aria-pressed", String(Number(b.dataset.speed) === p.speed));
  }
}

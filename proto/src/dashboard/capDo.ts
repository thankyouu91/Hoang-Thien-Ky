// Cấp độ người chơi trên thanh trên (người dùng yêu cầu 2026-11-04 "thêm hiệu ứng level và cấp độ người chơi"): vòng tu
// vi quanh chân dung theo kinh nghiệm, số cấp chữ tiêu đề. Khi cấp tăng giữa hai lần đọc: lên cấp thì ấn son "升", bụi
// vàng bung từ chân dung và băng giấy "Thăng cấp"; sang cảnh giới mới thì màn đột phá (tia sáng, chớp thiên kiếp, tên
// cảnh giới lớn, ấn "破"). Chỉ dùng DOM và Web Animations, không cần WebGL; người chọn giảm chuyển động thì chỉ hiện băng.
import "./capDo.css";
import type { TopBarView } from "./source.ts";
import { esc } from "./ui.ts";

const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

function layer(): HTMLElement {
  let el = document.getElementById("cap-fx");
  if (!el) {
    el = document.createElement("div");
    el.id = "cap-fx";
    document.body.append(el);
  }
  return el;
}

/** Phần tu vi đã có của cấp hiện tại, 0–1. */
export function xpShare(t: TopBarView): number {
  return t.expToNext > 0 ? Math.max(0, Math.min(1, t.exp / t.expToNext)) : 0;
}

/** Vòng sáng và bụi vàng bung ra quanh một điểm (tâm chân dung). */
function burst(x: number, y: number, motes: number): void {
  const fx = layer();
  const ring = document.createElement("i");
  ring.className = "cap-burst";
  ring.style.left = `${x}px`;
  ring.style.top = `${y}px`;
  fx.append(ring);
  ring.animate([{ transform: "scale(0.6)", opacity: 1 }, { transform: "scale(3.2)", opacity: 0 }], { duration: 900, easing: "cubic-bezier(0.2, 0.7, 0.3, 1)" }).finished.then(() => ring.remove());
  for (let i = 0; i < motes; i++) {
    const m = document.createElement("i");
    m.className = "cap-mote";
    m.style.left = `${x}px`;
    m.style.top = `${y}px`;
    fx.append(m);
    const a = (i / motes) * Math.PI * 2 + Math.random() * 0.4;
    const d = 38 + Math.random() * 70;
    const dx = Math.cos(a) * d;
    const dy = Math.sin(a) * d + 18;
    m.animate(
      [
        { transform: "translate(0, 0) rotate(45deg) scale(1.4)", opacity: 1 },
        { transform: `translate(${dx * 0.8}px, ${dy * 0.6 - 14}px) rotate(45deg) scale(1)`, opacity: 1, offset: 0.55 },
        { transform: `translate(${dx}px, ${dy}px) rotate(45deg) scale(0.4)`, opacity: 0 },
      ],
      { duration: 900 + Math.random() * 500, easing: "cubic-bezier(0.15, 0.8, 0.4, 1)" },
    ).finished.then(() => m.remove());
  }
}

/** Ấn son rơi xuống: phóng to, xoay nghiêng, đập xuống rồi rung nhẹ khung chứa. */
function stamp(seal: HTMLElement, host: HTMLElement, delay: number): void {
  seal.animate(
    [
      { transform: "scale(2.6) rotate(-18deg)", opacity: 0 },
      { transform: "scale(0.92) rotate(-6deg)", opacity: 1, offset: 0.7 },
      { transform: "scale(1) rotate(-6deg)", opacity: 1 },
    ],
    { duration: 420, delay, easing: "cubic-bezier(0.5, 0, 0.8, 0.6)", fill: "backwards" },
  );
  host.animate(
    [{ transform: "translate(0, 0)" }, { transform: "translate(-2px, 1px)" }, { transform: "translate(2px, -1px)" }, { transform: "translate(0, 0)" }],
    { duration: 160, delay: delay + 300, composite: "add" },
  );
}

/** Băng giấy "Thăng cấp · Cấp N" dưới thanh trên, tự tắt. */
function levelBanner(level: number): void {
  const b = document.createElement("div");
  b.className = "cap-banner";
  b.setAttribute("role", "status");
  b.innerHTML = `<span class="t"><small>Thăng cấp</small><b>Cấp <em>${level}</em></b></span><span class="cap-seal" aria-hidden="true">升</span>`;
  layer().append(b);
  const still = reduced();
  b.animate(
    [
      { transform: "translate(-50%, -24px)", opacity: 0 },
      { transform: "translate(-50%, 0)", opacity: 1, offset: 0.12 },
      { transform: "translate(-50%, 0)", opacity: 1, offset: 0.85 },
      { transform: "translate(-50%, -12px)", opacity: 0 },
    ],
    { duration: still ? 2200 : 2900, easing: "ease-out" },
  ).finished.then(() => b.remove());
  if (!still) stamp(b.querySelector<HTMLElement>(".cap-seal")!, b, 320);
}

/**
 * Màn đột phá cảnh giới: cả màn, chớp thiên kiếp hai lần, tên cảnh giới mới, ấn "破"; chạm để đóng, tự đóng sau 5 giây.
 * daoDoFx.ts (ui-kem) chèn đạo đồ vào `#cap-fx .cap-break` ngay trước `.flash` và coi màn đã đóng khi `.cap-break` bị gỡ;
 * nhịp của nó khóa vào đỉnh chớp đầu (≈ 238 ms). Đổi tên lớp, thứ tự con hay nhịp chớp thì báo ui-kem.
 */
function breakthrough(realm: string, level: number): void {
  const o = document.createElement("div");
  o.className = "cap-break";
  o.setAttribute("role", "dialog");
  o.setAttribute("aria-label", `Đột phá ${realm}`);
  o.innerHTML = `<i class="rays"></i><i class="flash"></i>
    <div class="cap-panel"><small>Đột phá cảnh giới</small><h2>${esc(realm)}</h2><p>Cấp ${level} · Hạ vị</p><span class="cap-seal" aria-hidden="true">破</span></div>
    <span class="hint">Chạm để tiếp tục</span>`;
  layer().append(o);
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    o.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 380, easing: "ease-in" }).finished.then(() => o.remove());
  };
  o.addEventListener("click", close);
  setTimeout(close, 5000);
  o.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, easing: "ease-out" });
  if (reduced()) return;
  const flash = o.querySelector<HTMLElement>(".flash")!;
  flash.animate(
    [{ opacity: 0 }, { opacity: 0.95, offset: 0.08 }, { opacity: 0.1, offset: 0.2 }, { opacity: 0.8, offset: 0.3 }, { opacity: 0, offset: 0.55 }, { opacity: 0 }],
    { duration: 1100, delay: 150 },
  );
  const h = o.querySelector<HTMLElement>("h2")!;
  h.animate(
    [
      { letterSpacing: "0.5em", opacity: 0, filter: "blur(6px)" },
      { letterSpacing: "0.06em", opacity: 1, filter: "blur(0)" },
    ],
    { duration: 1100, delay: 450, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)", fill: "backwards" },
  );
  stamp(o.querySelector<HTMLElement>(".cap-seal")!, o.querySelector<HTMLElement>(".cap-panel")!, 1350);
  const r = o.querySelector<HTMLElement>(".cap-panel")!.getBoundingClientRect();
  setTimeout(() => !closed && burst(r.left + r.width / 2, r.top + r.height * 0.4, 36), 1500);
}

/**
 * Theo dõi cấp trên thanh trên: lần đọc đầu chỉ ghi nhớ; cấp tăng thì vòng tu vi chạy đầy rồi về phần mới, số cấp nảy,
 * kèm hiệu ứng lên cấp hoặc đột phá (cảnh giới đổi).
 */
export class LevelFx {
  private last?: { level: number; realm: string; xp: number };

  /** Gọi sau khi thanh trên vẽ lại; `root` là thanh trên. */
  update(t: TopBarView, root: HTMLElement): void {
    const prev = this.last;
    const xp = xpShare(t);
    this.last = { level: t.level, realm: t.realm, xp };
    const ring = root.querySelector<HTMLElement>(".xp-ring");
    const lv = root.querySelector<HTMLElement>(".lv");
    if (!ring || !lv) return;
    if (!prev || reduced()) {
      ring.style.setProperty("--xp", String(xp));
      if (prev && t.level > prev.level) this.celebrate(t, prev.realm, ring);
      return;
    }
    // Đặt --xp; animate = false thì nhảy thẳng. Đọc lại kiểu tính để trình duyệt chốt giá trị trước lần đổi kế (nếu không,
    // hai lần đổi trong cùng khung gộp làm một và vòng không chạy).
    const set = (v: number, animate = true) => {
      if (!animate) ring.style.transition = "none";
      ring.style.setProperty("--xp", String(v));
      getComputedStyle(ring).getPropertyValue("--xp");
      if (!animate) ring.style.transition = "";
    };
    // Vòng chạy từ phần cũ: cùng cấp thì tới phần mới, lên cấp thì đầy rồi về phần của cấp mới.
    set(prev.xp, false);
    if (t.level <= prev.level) {
      set(xp);
      return;
    }
    lv.textContent = String(prev.level);
    set(1);
    ring.classList.add("full");
    setTimeout(() => {
      set(0, false);
      set(xp);
      ring.classList.remove("full");
      lv.textContent = String(t.level);
      lv.classList.add("pop");
    }, 650);
    this.celebrate(t, prev.realm, ring);
  }

  private celebrate(t: TopBarView, prevRealm: string, ring: HTMLElement): void {
    if (t.realm !== prevRealm) {
      breakthrough(t.realm, t.level);
      return;
    }
    const r = ring.getBoundingClientRect();
    if (!reduced()) setTimeout(() => burst(r.left + r.width / 2, r.top + r.height / 2, 18), 600);
    levelBanner(t.level);
  }
}

// Kéo thả dùng chung cho các màn dashboard (người dùng 2026-11-05: "phải có tính năng drag drop trong game để người chơi có
// thể kéo thả các item vào khu vực cần hoặc chỉnh sửa thuận tiện"). Món kéo được có data-drag="<loại>:<id>", chỗ thả có
// data-drop="<chỗ>"; màn cho biết chỗ nào nhận món nào và làm gì khi thả.
// - Chuột, bút: nhấn rồi kéo quá 6 px. Cảm ứng: giữ yên một chút (GIU_MS) rồi kéo, máy rung nhẹ báo đã nhấc; vuốt ngay thì
//   vẫn là cuộn như cũ.
// - Đang kéo: chỗ nhận được viền đứt, chỗ dưới tay viền son, nhãn cạnh ngón tay nói việc sẽ làm ("Mặc vào Vũ khí"); chỗ không
//   nhận thì nhãn đỏ. Gần mép trên, dưới khung cuộn thì tự cuộn. Esc hay thả ra ngoài thì món bay về chỗ cũ.
// - Bấm, chạm (không kéo) vẫn mở bảng chọn như trước, nên ai không quen kéo vẫn dùng nút được.

/** Việc sẽ làm khi thả (chữ trên nhãn); `{ no }` là chỗ đó không nhận kèm lý do; null là không nhận. */
export type DropAction = string | { no: string } | null;

export interface DragHandlers {
  /** Việc sẽ làm khi thả `drag` vào `drop`. */
  action(drag: string, drop: string): DropAction;
  drop(drag: string, drop: string): void;
  /** Bắt đầu kéo (để màn mở sẵn phần chứa chỗ thả, ví dụ). */
  start?(drag: string): void;
}

/** Giữ bao lâu trên màn cảm ứng thì nhấc món lên (ms). */
const GIU_MS = 260;
/** Lệch quá bấy nhiêu px trước khi nhấc: chuột thì bắt đầu kéo, cảm ứng thì coi là cuộn. */
const LECH = 6;
/** Khoảng sát mép khung cuộn thì tự cuộn (px), tốc độ tối đa (px mỗi khung). */
const MEP = 48;
const CUON = 14;

export interface DragControl {
  /** Vừa thả xong (cú click ngay sau lần thả không được mở bảng chọn). */
  justDropped(): boolean;
  dispose(): void;
}

const scrollParent = (el: Element | null): HTMLElement | null => {
  for (let e = el as HTMLElement | null; e && e !== document.body; e = e.parentElement) {
    const s = getComputedStyle(e);
    if (/(auto|scroll)/.test(s.overflowY) && e.scrollHeight > e.clientHeight + 2) return e;
  }
  return document.scrollingElement as HTMLElement | null;
};

export function enableDrag(root: HTMLElement, h: DragHandlers): DragControl {
  let dropped = false;

  const onDown = (e: PointerEvent) => {
    const touch = e.pointerType === "touch";
    if (!touch && e.button !== 0) return;
    const src = (e.target as HTMLElement).closest<HTMLElement>("[data-drag]");
    if (!src || !root.contains(src)) return;
    const ref = src.dataset.drag!;
    const x0 = e.clientX;
    const y0 = e.clientY;
    let px = x0;
    let py = y0;
    let live = false;
    let timer = 0;
    let ghost: HTMLElement | undefined;
    let tip: HTMLElement | undefined;
    let hover: HTMLElement | null = null;
    let raf = 0;
    const targets = () => [...root.querySelectorAll<HTMLElement>("[data-drop]")];
    const under = (x: number, y: number) => document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-drop]") ?? null;
    // Cảm ứng: đang kéo thì chặn cuộn trang và menu giữ tay của trình duyệt.
    const noScroll = (ev: TouchEvent) => live && ev.cancelable && ev.preventDefault();
    const noMenu = (ev: Event) => ev.preventDefault();

    const lift = () => {
      live = true;
      const r = src.getBoundingClientRect();
      ghost = src.cloneNode(true) as HTMLElement;
      ghost.classList.add("drag-ghost");
      ghost.removeAttribute("id");
      ghost.style.width = `${r.width}px`;
      ghost.style.height = `${r.height}px`;
      tip = document.createElement("div");
      tip.className = "drag-tip";
      tip.hidden = true;
      document.body.append(ghost, tip);
      document.body.classList.add("is-dragging");
      src.classList.add("dragging");
      h.start?.(ref);
      for (const t of targets()) if (t !== src && typeof h.action(ref, t.dataset.drop!) === "string") t.classList.add("drop-ok");
      if (touch) navigator.vibrate?.(12);
      place();
      raf = requestAnimationFrame(autoScroll);
    };

    // Ngón tay che món: trên cảm ứng hình nổi lên phía trên ngón tay.
    const place = () => {
      if (!ghost || !tip) return;
      const gx = px - ghost.offsetWidth / 2;
      const gy = touch ? py - ghost.offsetHeight - 18 : py - ghost.offsetHeight / 2;
      ghost.style.transform = `translate(${gx}px, ${gy}px) scale(1.06)`;
      const h0 = under(px, py);
      if (h0 !== hover) {
        hover?.classList.remove("drop-hover", "drop-no");
        const a = h0 && h0 !== src ? h.action(ref, h0.dataset.drop!) : null;
        // Chỗ chứa món vừa nhấc (túi khi kéo món trong túi) mà không nhận thì để yên, không báo đỏ.
        hover = h0 && h0 !== src && (a || !h0.contains(src)) ? h0 : null;
        const ok = typeof a === "string";
        hover?.classList.add(ok ? "drop-hover" : "drop-no");
        tip.hidden = !hover;
        tip.classList.toggle("no", !ok);
        tip.textContent = ok ? a : (a?.no ?? "Không thả vào đây được");
      }
      tip.style.transform = `translate(${Math.min(px + 14, innerWidth - tip.offsetWidth - 6)}px, ${Math.max(6, gy - tip.offsetHeight - 6)}px)`;
    };

    // Sát mép khung cuộn (túi, cột trang bị) thì tự cuộn để với tới chỗ thả đang khuất.
    const autoScroll = () => {
      if (!live) return;
      const box = scrollParent(document.elementFromPoint(px, py)) ?? scrollParent(src);
      if (box) {
        const r = box === document.scrollingElement ? { top: 0, bottom: innerHeight } : box.getBoundingClientRect();
        const dy = py < r.top + MEP ? -CUON * (1 - (py - r.top) / MEP) : py > r.bottom - MEP ? CUON * (1 - (r.bottom - py) / MEP) : 0;
        if (dy) {
          box.scrollTop += dy;
          place();
        }
      }
      raf = requestAnimationFrame(autoScroll);
    };

    const move = (ev: PointerEvent) => {
      px = ev.clientX;
      py = ev.clientY;
      if (live) return place();
      const far = Math.hypot(px - x0, py - y0) > LECH;
      if (touch && far) return stop(); // vuốt: để trình duyệt cuộn
      if (!touch && far) lift();
    };

    const cleanup = () => {
      clearTimeout(timer);
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", stop);
      window.removeEventListener("keydown", key);
      window.removeEventListener("touchmove", noScroll);
      src.removeEventListener("contextmenu", noMenu);
      document.body.classList.remove("is-dragging");
      src.classList.remove("dragging", "pressing");
      for (const t of targets()) t.classList.remove("drop-ok", "drop-hover", "drop-no");
      tip?.remove();
    };

    // Thả ra ngoài: hình bay về chỗ cũ rồi mới mất.
    const flyBack = () => {
      const g = ghost;
      if (!g) return;
      const r = src.getBoundingClientRect();
      g.style.transition = "transform 0.18s ease-in, opacity 0.18s ease-in";
      g.style.transform = `translate(${r.left}px, ${r.top}px) scale(1)`;
      g.style.opacity = "0.4";
      setTimeout(() => g.remove(), 200);
    };

    const finish = (ok: boolean) => {
      const t = hover;
      const label = ok && t ? h.action(ref, t.dataset.drop!) : null;
      cleanup();
      if (!live) return;
      dropped = true;
      setTimeout(() => (dropped = false));
      if (t && typeof label === "string") {
        ghost?.remove();
        t.classList.add("drop-done");
        setTimeout(() => t.classList.remove("drop-done"), 450);
        h.drop(ref, t.dataset.drop!);
      } else flyBack();
    };

    const up = () => finish(true);
    const stop = () => finish(false);
    const key = (ev: KeyboardEvent) => ev.key === "Escape" && stop();

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", stop);
    window.addEventListener("keydown", key);
    if (touch) {
      window.addEventListener("touchmove", noScroll, { passive: false });
      src.addEventListener("contextmenu", noMenu);
      src.classList.add("pressing");
      timer = window.setTimeout(lift, GIU_MS);
    }
  };

  root.addEventListener("pointerdown", onDown);
  return {
    justDropped: () => dropped,
    dispose: () => root.removeEventListener("pointerdown", onDown),
  };
}

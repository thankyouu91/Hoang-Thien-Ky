// Đạo đồ lúc đột phá: gắn nhịp của daoDoNhip.ts vào hai chỗ.
// - Màn đột phá cả màn của capDo.ts (#cap-fx .cap-break, phiên dashboard-proto): chèn bức đạo đồ cảnh giới mới sau tên
//   cảnh giới, không sửa capDo.ts. Thanh trên vẽ (tạo màn đột phá) trước màn Nhân vật trong cùng một lần đọc, nên lúc
//   Nhân vật thấy cảnh giới tăng thì màn đã có sẵn.
// - Sân Pháp tướng (nhanVat.ts): khi màn đột phá đóng, bức cũ thu về tâm rồi bức mới nở.
// Keyframe Web Animations lấy mẫu từng khung từ hàm dò khung `probe`, nên ảnh tĩnh từng nhịp và test khớp với lúc chạy.
import { FPS, NHIP_MAN, NHIP_SAN, nhipLen, probe, type DaoDoNhip } from "./daoDoNhip.ts";
import { artUrl } from "./ui.ts";

export const daoDoReduced = (): boolean => matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Bán kính lộ 100 % của mask là khoảng từ tâm (50 %, 48 %) tới góc xa nhất ảnh 600×900; mép lộ ở 108 % của nó. */
const LO_HET = 108;
const RING_R = Math.hypot(300, 900 * 0.52) * (LO_HET / 100);

/**
 * HTML lớp đạo đồ: bức mới, thêm bức cũ khi đang chờ chuyển (`cho`: bức cũ hiện, bức mới còn ẩn), vòng mực và chấm mực
 * ở tâm cho nhịp chạy. `cls` là lớp vị trí (pt-dao-do ở sân, cap-dao-do ở màn đột phá).
 */
export function daoDoHtml(cls: string, to: string, from?: string, cho = false, halo = false): string {
  const dd = (ma: string, kind: string, r: number) => `<div class="dd ${kind}" style="--dd-r:${r}%"><img src="${artUrl(`dao_do/${ma}`)}" alt=""></div>`;
  const cu = cho && from && from !== to ? dd(from, "cu", LO_HET) : "";
  const h = halo ? `<i class="dd-halo"${cho ? "" : ` style="opacity:1"`}></i>` : "";
  return `<div class="${cls} dd-fx" aria-hidden="true">${cu}${dd(to, "moi", cho ? 0 : LO_HET)}${h}<svg class="dd-ring" viewBox="0 0 600 900"><circle cx="300" cy="432" r="1"/></svg><i class="dd-dot"></i></div>`;
}

/** Chạy một nhịp trên lớp `fx` (phần tử .dd-fx); xong thì bỏ bức cũ, giữ trạng thái cuối. */
function run(fx: HTMLElement, n: DaoDoNhip): Promise<void> {
  const fr = probe(n);
  const opt: KeyframeAnimationOptions = { duration: (nhipLen(n) / FPS) * 1000, easing: "linear", fill: "both" };
  const pct = (x: number) => `${(x * LO_HET).toFixed(2)}%`;
  const moi = fx.querySelector<HTMLElement>(".dd.moi");
  const cu = fx.querySelector<HTMLElement>(".dd.cu");
  const ring = fx.querySelector<SVGCircleElement>(".dd-ring circle");
  const dot = fx.querySelector<HTMLElement>(".dd-dot");
  const halo = fx.querySelector<HTMLElement>(".dd-halo");
  const anims: Animation[] = [];
  if (halo) anims.push(halo.animate(fr.map((k) => ({ opacity: k.halo.toFixed(3) })), opt));
  if (moi) anims.push(moi.animate(fr.map((k) => ({ "--dd-r": pct(k.r), transform: `translateX(-50%) scale(${k.scale.toFixed(4)})`, filter: `blur(${k.blur.toFixed(2)}px)` })), opt));
  if (cu) anims.push(cu.animate(fr.map((k) => ({ "--dd-r": pct(k.oldR), transform: `translateX(-50%) scale(${k.oldScale.toFixed(4)})` })), opt));
  if (ring) anims.push(ring.animate(fr.map((k) => ({ transform: `scale(${Math.max(0.001, k.ring * RING_R).toFixed(2)})`, strokeWidth: (0.6 + 2.4 * k.ringA).toFixed(2), opacity: k.ringA.toFixed(3) })), opt));
  if (dot) anims.push(dot.animate(fr.map((k) => ({ transform: `translate(-50%, -50%) scale(${(k.dot / k.dotSy).toFixed(3)}, ${(k.dot * k.dotSy).toFixed(3)})` })), opt));
  return Promise.all(anims.map((a) => a.finished)).then(
    () => cu?.remove(),
    () => undefined,
  );
}

/**
 * Chèn và diễn bức đạo đồ `ma` trong màn đột phá đang mở (nếu có và chưa chèn). Giảm chuyển động thì hiện tĩnh.
 * Trả true khi đã chèn.
 */
export function daoDoManDotPha(ma: string): boolean {
  const br = [...document.querySelectorAll<HTMLElement>("#cap-fx .cap-break")].pop();
  if (!br || br.querySelector(".cap-dao-do")) return false;
  const still = daoDoReduced();
  const tmp = document.createElement("div");
  tmp.innerHTML = daoDoHtml("cap-dao-do", ma, undefined, !still, true);
  const fx = tmp.firstElementChild as HTMLElement;
  br.insertBefore(fx, br.querySelector(".flash"));
  if (!still) void run(fx, NHIP_MAN);
  return true;
}

/** Gọi `cb` khi màn đột phá đang mở bị gỡ khỏi #cap-fx (chạm để đóng hoặc tự đóng); không có màn thì gọi ngay. */
export function khiManDotPhaDong(cb: () => void): void {
  const layer = document.getElementById("cap-fx");
  const br = layer ? [...layer.querySelectorAll(".cap-break")].pop() : undefined;
  if (!layer || !br) {
    cb();
    return;
  }
  let done = false;
  const fire = () => {
    if (done) return;
    done = true;
    mo.disconnect();
    clearTimeout(t);
    cb();
  };
  const mo = new MutationObserver(() => !br.isConnected && fire());
  mo.observe(layer, { childList: true });
  // capDo tự đóng sau 5 giây; giữ một mốc phòng khi màn bị gỡ cách khác.
  const t = setTimeout(fire, 8000);
}

/** Nhịp sân Pháp tướng trên lớp .pt-dao-do đã vẽ ở trạng thái chờ. */
export function daoDoSan(fx: HTMLElement): Promise<void> {
  return run(fx, NHIP_SAN);
}

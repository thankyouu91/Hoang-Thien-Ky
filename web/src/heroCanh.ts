// Lớp động cho hero trang chủ (người dùng xin 2026-11-05 tối): vẽ lại bức tranh thủy mặc trong <canvas>
// rồi cho tu sĩ ở giữa "bước tới" (nhịp bước bồng bềnh, nghiêng nhẹ), vạt khăn bay, hạt linh khí bay lên.
// Tu sĩ là sprite tách từ chính bức tranh (anh-chup/hero_nguoi.png, tách bằng scripts trong lịch sử phiên);
// chỗ người gốc trong ảnh được che bằng mảng mây bên cạnh (mặt nạ mềm) trước khi vẽ người động.
// Ảnh <img> tĩnh giữ nguyên làm fallback: không JS, giảm chuyển động, hoặc lỗi tải thì thôi không gắn canvas.
// Mọi tọa độ dưới đây theo hệ ẢNH GỐC 1880 × 848; canvas đặt transform cover (object-position 53% 42%) rồi vẽ thẳng.

const ANH_W = 1880;
const ANH_H = 848;
/** Hộp tu sĩ trong ảnh gốc và vùng phản chiếu phải che. Dải lụa tĩnh xa bên phải giữ nguyên (nhìn như dải mây). */
const NGUOI = { x: 955, y: 625, w: 120, h: 152 };
const BONG = { x: 955, y: 777, w: 120, h: 71 };

function taiAnh(src: string): Promise<HTMLImageElement> {
  return new Promise((ok, loi) => {
    const i = new Image();
    i.onload = () => ok(i);
    i.onerror = loi;
    i.src = src;
  });
}

/**
 * Mảng lấp vùng người trong tranh: mỗi HÀNG lấy màu mây trung bình ở hai mép ngoài hộp rồi trộn ngang qua hộp,
 * cộng nhiễu nhẹ — khớp độ sáng mây theo chiều dọc nên không lộ ô chữ nhật; 4 mép fade 5 px.
 */
function patchLap(nen: HTMLImageElement, v: { x: number; y: number; w: number; h: number }): HTMLCanvasElement {
  const MEP = 16;
  const off = document.createElement("canvas");
  off.width = v.w + MEP * 2;
  off.height = v.h;
  const og = off.getContext("2d")!;
  og.drawImage(nen, v.x - MEP, v.y, off.width, v.h, 0, 0, off.width, v.h);
  const src = og.getImageData(0, 0, off.width, v.h).data;
  const ra = document.createElement("canvas");
  ra.width = v.w;
  ra.height = v.h;
  const rg = ra.getContext("2d")!;
  const out = rg.createImageData(v.w, v.h);
  const o = out.data;
  for (let y = 0; y < v.h; y++) {
    const mau = (x0: number) => {
      let r = 0, g = 0, b = 0;
      for (let i = 0; i < MEP; i++) {
        const k = (y * off.width + x0 + i) * 4;
        r += src[k];
        g += src[k + 1];
        b += src[k + 2];
      }
      return [r / MEP, g / MEP, b / MEP];
    };
    const [r0, g0, b0] = mau(0);
    const [r1, g1, b1] = mau(v.w + MEP);
    for (let x = 0; x < v.w; x++) {
      const k = x / (v.w - 1);
      const on = ((x * 7349 + y * 911) % 13) - 6; // nhiễu giấy nhẹ
      const i = (y * v.w + x) * 4;
      o[i] = r0 + (r1 - r0) * k + on * 0.4;
      o[i + 1] = g0 + (g1 - g0) * k + on * 0.4;
      o[i + 2] = b0 + (b1 - b0) * k + on * 0.4;
      const bien = Math.min(x, v.w - 1 - x, y, v.h - 1 - y);
      o[i + 3] = bien < 5 ? Math.round((bien / 5) * 255) : 255;
    }
  }
  rg.putImageData(out, 0, 0);
  return ra;
}

interface Hat {
  x: number;
  y: number;
  sp: number;
  ph: number;
  r: number;
  son: boolean;
}

export async function ganHeroCanh(): Promise<void> {
  const nenEl = document.querySelector<HTMLElement>(".dau-tranh .tranh-nen");
  const img = nenEl?.querySelector<HTMLImageElement>(".hero-anh");
  if (!nenEl || !img || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  let nen: HTMLImageElement;
  let nguoi: HTMLImageElement;
  try {
    [nen, nguoi] = await Promise.all([taiAnh("/hinh/rieng/hero_1880.webp"), taiAnh("/hinh/rieng/hero_nguoi.png")]);
  } catch {
    return; // giữ ảnh tĩnh
  }

  const canvas = document.createElement("canvas");
  canvas.className = "hero-canvas";
  canvas.setAttribute("aria-hidden", "true");
  nenEl.append(canvas);
  const ctx = canvas.getContext("2d")!;

  const cheNguoi = patchLap(nen, NGUOI);
  const cheBong = patchLap(nen, BONG);

  // Hạt linh khí: 2/3 quanh cột sáng giữa, còn lại rải khắp; vài hạt màu son.
  const hat: Hat[] = [];
  for (let i = 0; i < 64; i++) {
    const giua = i % 3 !== 0;
    hat.push({
      x: giua ? 900 + Math.random() * 260 : Math.random() * ANH_W,
      y: Math.random() * ANH_H,
      sp: 14 + Math.random() * 30,
      ph: Math.random() * Math.PI * 2,
      r: 1.6 + Math.random() * 2.6,
      son: i % 11 === 0,
    });
  }

  let w = 0;
  let h = 0;
  let dpr = 1;
  let s = 1;
  let ox = 0;
  let oy = 0;
  const doCo = () => {
    const r = nenEl.getBoundingClientRect();
    dpr = Math.min(1.6, devicePixelRatio || 1);
    w = Math.max(1, Math.round(r.width));
    h = Math.max(1, Math.round(r.height));
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    // Cover như object-fit, tâm nhìn 53% 42% (khớp .hero-anh trong styles.css).
    s = Math.max(w / ANH_W, h / ANH_H);
    ox = (w - ANH_W * s) * 0.53;
    oy = (h - ANH_H * s) * 0.42;
  };
  doCo();
  new ResizeObserver(doCo).observe(nenEl);

  let chay = true;
  new IntersectionObserver(([e]) => {
    chay = e.isIntersecting;
    if (chay) requestAnimationFrame(khung);
  }).observe(nenEl);

  /** Dải khăn bay: dải cong từ hông tu sĩ về phải, dày ở gốc mỏng ở đuôi, lượn theo thời gian. */
  const veKhan = (g: CanvasRenderingContext2D, x0: number, y0: number, dai: number, t: number, pha: number, alpha: number) => {
    const s1 = Math.sin(t * 2.4 + pha) * 6;
    const s2 = Math.sin(t * 2.4 + pha + 1.4) * 9;
    const s3 = Math.sin(t * 1.7 + pha + 2.6) * 7;
    const x1 = x0 + dai;
    g.beginPath();
    g.moveTo(x0, y0);
    g.bezierCurveTo(x0 + dai * 0.3, y0 - 10 + s1, x0 + dai * 0.65, y0 + 4 + s2, x1 + s3 * 0.6, y0 - 4 + s2 * 0.8);
    g.bezierCurveTo(x0 + dai * 0.66, y0 + 9 + s2, x0 + dai * 0.32, y0 - 3 + s1, x0, y0 + 4.5);
    g.closePath();
    g.fillStyle = `rgba(32,27,22,${alpha})`;
    g.filter = "blur(1.1px)"; // mép lụa mềm như nét mực loang; trình duyệt không hỗ trợ filter thì vẽ thường
    g.fill();
    g.filter = "none";
  };

  let dau = true;
  const khung = (ms: number) => {
    if (!chay || document.hidden) return;
    const t = ms / 1000;
    ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * ox, dpr * oy);
    ctx.clearRect(-ox / s, -oy / s, w / s, h / s);
    ctx.drawImage(nen, 0, 0);
    // Che người tĩnh, khăn tĩnh và phản chiếu tĩnh trong ảnh.
    ctx.drawImage(cheNguoi, NGUOI.x, NGUOI.y);
    ctx.drawImage(cheBong, BONG.x, BONG.y);

    // Tu sĩ bước tới: nhún theo nhịp bước, nghiêng người nhẹ về trước; phản chiếu mờ dưới biển mây.
    const bob = Math.sin(t * 2.2) * 2.3;
    const lean = 0.012 + Math.sin(t * 2.2 + 0.9) * 0.013;
    const chanX = NGUOI.x + 60;
    const chanY = NGUOI.y + 147;
    ctx.save();
    ctx.translate(chanX, chanY + bob);
    ctx.rotate(lean);
    ctx.drawImage(nguoi, -60, -147);
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = 0.15;
    ctx.translate(chanX, chanY + 12 - bob * 0.4);
    ctx.scale(1, -0.48);
    ctx.drawImage(nguoi, -60, -147);
    ctx.restore();
    // Hai dải khăn bay từ hông.
    veKhan(ctx, chanX + 14, chanY - 58 + bob, 82, t, 0, 0.42);
    veKhan(ctx, chanX + 10, chanY - 44 + bob, 58, t, 2.1, 0.27);

    // Hạt linh khí bay lên, lượn nhẹ, sáng ấm (vài hạt son).
    for (const p of hat) {
      const y = ((p.y - t * p.sp) % ANH_H + ANH_H) % ANH_H;
      const x = p.x + Math.sin(t * 0.5 + p.ph) * 16;
      const nhay = 0.55 + 0.45 * Math.sin(t * 1.8 + p.ph * 3);
      const mo = Math.min(1, y / 140) * (0.16 + 0.22 * nhay);
      ctx.fillStyle = p.son ? `rgba(196,92,70,${mo * 0.55})` : `rgba(255,247,222,${mo})`;
      ctx.beginPath();
      ctx.arc(x, y, p.r * (0.8 + 0.3 * nhay), 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = p.son ? `rgba(196,92,70,${mo * 0.25})` : `rgba(255,247,222,${mo * 0.3})`;
      ctx.beginPath();
      ctx.arc(x, y, p.r * 2.4, 0, Math.PI * 2);
      ctx.fill();
    }

    if (dau) {
      dau = false;
      img.style.opacity = "0"; // canvas đã thế chỗ; giữ img trong DOM làm fallback khi canvas lỗi
    }
    requestAnimationFrame(khung);
  };
  requestAnimationFrame(khung);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && chay) requestAnimationFrame(khung);
  });
}

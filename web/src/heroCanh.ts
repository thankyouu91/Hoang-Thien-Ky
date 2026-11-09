// Linh khí cho hero trang chủ. Người dùng chốt 2026-11-05 tối: GIỮ NGUYÊN tranh gốc tĩnh (lớp tu sĩ động
// trước đó bị chê, đã bỏ), chỉ thêm hạt linh khí bay CHẬM lên, dày hơn; mỗi hạt tự tan biến khi lên tới
// khoảng 70–90% chiều cao hero (ngưỡng ngẫu nhiên từng hạt) rồi sinh lại từ dưới.
// Canvas TRONG SUỐT phủ trên ảnh, không vẽ lại tranh, không đụng người trong tranh.
// Giảm chuyển động (prefers-reduced-motion) thì không gắn gì.

interface Hat {
  x: number; // 0..1 theo bề ngang
  y: number; // px từ mép trên
  sp: number; // px/giây, chậm
  lac: number; // biên độ lượn ngang
  ph: number;
  r: number;
  tan: number; // 0.10..0.30: hạt tan hết khi còn cách mép trên chừng này (tức đã bay 70–90%)
  son: boolean;
}

export function ganHeroCanh(): void {
  const nenEl = document.querySelector<HTMLElement>(".dau-tranh .tranh-nen");
  if (!nenEl || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const canvas = document.createElement("canvas");
  canvas.className = "hero-canvas";
  canvas.setAttribute("aria-hidden", "true");
  nenEl.append(canvas);
  const ctx = canvas.getContext("2d")!;

  let w = 0;
  let h = 0;
  let dpr = 1;
  const hat: Hat[] = [];

  const sinh = (p: Hat, duoi: boolean) => {
    p.x = Math.random();
    p.y = duoi ? h + Math.random() * 60 : Math.random() * (h + 60);
    p.sp = 9 + Math.random() * 16;
    p.lac = 8 + Math.random() * 16;
    p.ph = Math.random() * Math.PI * 2;
    p.r = 1.5 + Math.random() * 2.6;
    p.tan = 0.1 + Math.random() * 0.2;
    p.son = Math.random() < 0.08;
  };

  const doCo = () => {
    const r = nenEl.getBoundingClientRect();
    dpr = Math.min(1.75, devicePixelRatio || 1);
    w = Math.max(1, Math.round(r.width));
    h = Math.max(1, Math.round(r.height));
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    // Linh khí dày: theo diện tích, chừng gấp rưỡi tới gấp đôi bản trước.
    const so = Math.min(150, Math.max(80, Math.round((w * h) / 8500)));
    while (hat.length < so) {
      const p = {} as Hat;
      sinh(p, false);
      hat.push(p);
    }
    hat.length = so;
  };
  doCo();
  new ResizeObserver(doCo).observe(nenEl);

  let chay = true;
  let truoc = 0;
  new IntersectionObserver(([e]) => {
    chay = e.isIntersecting;
    if (chay) {
      truoc = 0;
      requestAnimationFrame(khung);
    }
  }).observe(nenEl);

  const khung = (ms: number) => {
    if (!chay || document.hidden) {
      truoc = 0;
      return;
    }
    const t = ms / 1000;
    const dt = truoc ? Math.min(0.1, t - truoc) : 0.016;
    truoc = t;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    for (const p of hat) {
      p.y -= p.sp * dt;
      const tanY = h * p.tan; // mốc tan, tính từ mép trên
      if (p.y < tanY - 4) {
        sinh(p, true);
        continue;
      }
      const x = p.x * w + Math.sin(t * 0.45 + p.ph) * p.lac;
      // Hiện dần khi vừa sinh dưới mép, rồi tan dần về 0 khi chạm mốc 70–90% đường bay.
      const vao = Math.min(1, Math.max(0, (h + 30 - p.y) / 90));
      const ra = Math.min(1, (p.y - tanY) / (h * 0.14));
      const nhay = 0.6 + 0.4 * Math.sin(t * 1.6 + p.ph * 3);
      const a = vao * ra * nhay;
      if (a <= 0.01) continue;
      ctx.fillStyle = p.son ? `rgba(198,96,74,${a * 0.4})` : `rgba(255,247,222,${a * 0.5})`;
      ctx.beginPath();
      ctx.arc(x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = p.son ? `rgba(198,96,74,${a * 0.14})` : `rgba(255,247,222,${a * 0.18})`;
      ctx.beginPath();
      ctx.arc(x, p.y, p.r * 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
    requestAnimationFrame(khung);
  };
  requestAnimationFrame(khung);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && chay) requestAnimationFrame(khung);
  });
}

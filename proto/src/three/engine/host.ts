// Bộ quản lý renderer: một WebGLRenderer, một canvas, dùng lại giữa mọi màn.
//
// - Chế độ động (mount): canvas được chuyển vào container của màn đang hiện. Nhiều màn cùng gắn thì màn gắn sau cùng
//   mà đang thấy được giữ canvas. Container bị ẩn (hidden, display:none, cuộn khuất) hay tab trình duyệt ẩn thì dừng vẽ.
// - Chế độ nướng (bake): vẽ vào render target rồi đọc ra canvas 2D, không đụng canvas đang gắn ở màn khác.
// - Mật độ điểm ảnh tối đa DPR_CAP.live; khung chậm (dưới ~50 khung/giây) thì tự hạ độ phân giải, máy rảnh thì nâng lại.
// - prefers-reduced-motion: vẽ một khung tĩnh, không vòng lặp, không thị sai.
import {
  DataTexture,
  LinearFilter,
  RepeatWrapping,
  RGBAFormat,
  UnsignedByteType,
  WebGLRenderer,
  WebGLRenderTarget,
} from "three";
import { deviceDpr, DPR_CAP, onReducedMotionChange, prefersReducedMotion } from "../support.ts";
import { makeNoise, type NoiseField } from "./noise.ts";
import type { Program } from "./program.ts";

export type ProgramFactory = (host: Host) => Program;

export interface LiveOptions {
  layer?: "back" | "front";
  scrollEl?: HTMLElement | null;
  /** Ghi đè DPR_CAP.live cho cảnh nhẹ (lớp hạt) hay cảnh cần nét. */
  dprCap?: number;
  /**
   * Màn tự lái: host không tự lặp rAF cho chỗ gắn này, màn gọi LiveMount.render(dt, t) trong rAF của nó, cùng khung với
   * phần vẽ 2D (hiệu ứng chiêu màn Trận theo thời điểm replay). Không áp khung tĩnh của prefers-reduced-motion, không
   * thị sai. Khung nào màn không gọi render thì canvas giữ hình cũ.
   */
  driven?: boolean;
}

/** Tay cầm một container đã gắn ở chế độ động. */
export interface LiveMount {
  /** Đổi chương trình vẽ mà giữ chỗ gắn (đổi cảnh, đổi seed). */
  replace(factory: ProgramFactory): void;
  setScroll(screens: number): void;
  /**
   * Vẽ ngay một khung, đồng bộ (dùng cho chỗ gắn driven). dt: giây từ khung trước theo đồng hồ của màn (replay);
   * t: thời điểm truyền cho Program, mặc định cộng dồn dt. Trả false khi chỗ gắn không đang giữ canvas (màn ẩn,
   * chỗ gắn khác mới hơn) hoặc mất WebGL context.
   */
  render(dt: number, t?: number): boolean;
  dispose(): void;
}

interface Mount {
  container: HTMLElement;
  factory: ProgramFactory;
  program: Program | null;
  options: LiveOptions;
  visible: boolean;
  order: number;
  t0: number;
  scroll: number;
  /** driven: đồng hồ cộng dồn dt và lúc gọi render trước (đo nhịp khung thật cho việc hạ độ phân giải). */
  clock: number;
  lastCall: number;
  io: IntersectionObserver;
  ro: ResizeObserver;
  onScroll?: () => void;
}

/** Thời điểm cố định cho khung tĩnh: hạt đã rải đều, mây đã trôi một đoạn. */
const STILL_T = 14;

export class Host {
  readonly renderer: WebGLRenderer;
  readonly canvas: HTMLCanvasElement;
  readonly noise: NoiseField;
  readonly noiseTex: DataTexture;
  private mounts: Mount[] = [];
  private active: Mount | null = null;
  private order = 0;
  private raf = 0;
  private last = 0;
  private needsResize = true;
  private lost = false;
  private reduced = prefersReducedMotion();
  // con trỏ / độ nghiêng máy
  private px = 0;
  private py = 0;
  private beta0: number | null = null;
  // tự hạ độ phân giải khi khung chậm
  private scale = 1;
  private ema = 1 / 60;
  private slowFor = 0;
  private fastFor = 0;
  private warmup = 0;
  private probe: { ema: number; scale: number; t: number } | null = null;
  private noShrink = false;
  private bakeRT: WebGLRenderTarget | null = null;
  private bakeRTTimer = 0;
  /** Số khung đã vẽ ở chế độ động, để trang thử đo. */
  frames = 0;

  constructor() {
    this.canvas = document.createElement("canvas");
    this.canvas.className = "ktlp-three";
    Object.assign(this.canvas.style, {
      position: "absolute",
      inset: "0",
      width: "100%",
      height: "100%",
      display: "block",
      pointerEvents: "none",
    });
    this.renderer = new WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true,
      premultipliedAlpha: true,
      powerPreference: "default",
      preserveDrawingBuffer: false,
    });
    this.renderer.autoClear = false;

    this.noise = makeNoise(7);
    const tex = new DataTexture(this.noise.data, this.noise.size, this.noise.size, RGBAFormat, UnsignedByteType);
    tex.wrapS = tex.wrapT = RepeatWrapping;
    // Không mipmap: sống núi đọc nhiễu ở tần số vừa phải, và CPU (đặt cây, công trình) phải ra đúng giá trị GPU đọc.
    tex.magFilter = LinearFilter;
    tex.minFilter = LinearFilter;
    tex.generateMipmaps = false;
    tex.needsUpdate = true;
    this.noiseTex = tex;

    this.canvas.addEventListener("webglcontextlost", (e) => {
      e.preventDefault();
      this.lost = true;
      this.cancel();
    });
    this.canvas.addEventListener("webglcontextrestored", () => {
      this.lost = false;
      this.noiseTex.needsUpdate = true;
      this.needsResize = true;
      this.request();
    });
    document.addEventListener("visibilitychange", () => (document.hidden ? this.cancel() : this.request()));
    onReducedMotionChange(() => {
      this.reduced = prefersReducedMotion();
      this.request();
    });
    window.addEventListener(
      "pointermove",
      (e) => {
        if (e.pointerType !== "mouse") return;
        this.px = (e.clientX / innerWidth) * 2 - 1;
        this.py = (e.clientY / innerHeight) * 2 - 1;
        this.requestIfStatic();
      },
      { passive: true },
    );
    window.addEventListener("deviceorientation", (e) => {
      if (e.gamma == null || e.beta == null) return;
      this.beta0 ??= e.beta;
      this.px = Math.max(-1, Math.min(1, e.gamma / 25));
      this.py = Math.max(-1, Math.min(1, (e.beta - this.beta0) / 25));
      this.requestIfStatic();
    });
  }

  // ---- chế độ động -------------------------------------------------------------------------------------------------

  mount(container: HTMLElement, factory: ProgramFactory, options: LiveOptions = {}): LiveMount {
    const m: Mount = {
      container,
      factory,
      program: null,
      options,
      visible: false,
      order: ++this.order,
      t0: performance.now(),
      scroll: 0,
      clock: 0,
      lastCall: 0,
      io: new IntersectionObserver((entries) => {
        m.visible = entries[entries.length - 1].isIntersecting;
        this.pick();
      }),
      ro: new ResizeObserver(() => {
        if (this.active === m) {
          this.needsResize = true;
          this.request();
        }
      }),
    };
    if (getComputedStyle(container).position === "static") container.style.position = "relative";
    if ((options.layer ?? "back") === "back") container.style.isolation = "isolate";
    const el = options.scrollEl;
    if (el) {
      m.onScroll = () => {
        m.scroll = el.scrollTop / Math.max(1, el.clientHeight);
        this.requestIfStatic();
      };
      el.addEventListener("scroll", m.onScroll, { passive: true });
    }
    this.mounts.push(m);
    m.io.observe(container);
    m.ro.observe(container);
    // Không chờ IntersectionObserver (báo trễ một nhịp vẽ): container đang hiện thì gắn canvas ngay.
    m.visible = container.isConnected && container.getClientRects().length > 0;
    if (m.visible) this.pick();
    return {
      replace: (f) => {
        m.program?.dispose();
        m.program = null;
        m.factory = f;
        if (this.active === m) {
          m.program = f(this);
          this.needsResize = true;
          this.request();
        }
      },
      setScroll: (s) => {
        m.scroll = s;
        this.requestIfStatic();
      },
      render: (dt, t) => {
        if (this.active !== m || !m.program || this.lost) return false;
        const now = performance.now();
        // Hạ độ phân giải theo nhịp khung thật (dt của màn có thể là thời gian replay nhân tốc độ); bỏ quãng dừng dài.
        const real = m.lastCall ? (now - m.lastCall) / 1000 : 0;
        m.lastCall = now;
        if (real > 0 && real < 0.1) this.adapt(real);
        if (this.needsResize) this.resizeActive();
        m.clock += dt;
        m.program.render(this.renderer, null, t ?? m.clock, dt);
        this.frames++;
        return true;
      },
      dispose: () => {
        m.io.disconnect();
        m.ro.disconnect();
        if (el && m.onScroll) el.removeEventListener("scroll", m.onScroll);
        this.mounts = this.mounts.filter((x) => x !== m);
        m.program?.dispose();
        m.program = null;
        if (this.active === m) this.active = null;
        this.pick();
      },
    };
  }

  /** Chọn container được giữ canvas: container gắn sau cùng mà đang thấy được. */
  private pick(): void {
    let next: Mount | null = null;
    for (const m of this.mounts) if (m.visible && (!next || m.order > next.order)) next = m;
    if (next === this.active && (!next || this.canvas.parentElement === next.container)) return;
    this.active = next;
    if (!next) {
      this.cancel();
      this.canvas.remove();
      return;
    }
    const front = next.options.layer === "front";
    this.canvas.style.zIndex = front ? "5" : "-1";
    if (front) next.container.append(this.canvas);
    else next.container.prepend(this.canvas);
    next.program ??= next.factory(this);
    this.needsResize = true;
    this.warmup = 20;
    this.last = 0;
    this.request();
  }

  private resizeActive(): void {
    const m = this.active;
    if (!m || !m.program) return;
    const w = m.container.clientWidth;
    const h = m.container.clientHeight;
    if (!w || !h) return;
    const dpr = deviceDpr(m.options.dprCap ?? DPR_CAP.live) * this.scale;
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    m.program.resize(w, h, dpr);
    this.needsResize = false;
  }

  private request(): void {
    if (!this.raf && this.active && !this.active.options.driven && !document.hidden && !this.lost) this.raf = requestAnimationFrame(this.frame);
  }

  private requestIfStatic(): void {
    if (this.reduced) return;
    const p = this.active?.program;
    if (p && p.animated === false) this.request();
  }

  private cancel(): void {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.last = 0;
  }

  private frame = (now: number): void => {
    this.raf = 0;
    const m = this.active;
    if (!m || !m.program || m.options.driven || document.hidden || this.lost) return;
    const dt = this.last ? Math.min(0.1, (now - this.last) / 1000) : 0;
    this.last = now;
    if (dt > 0) this.adapt(dt);
    if (this.needsResize) this.resizeActive();
    const p = m.program;
    const still = this.reduced;
    p.pointer?.(still ? 0 : this.px, still ? 0 : this.py);
    p.scroll?.(still ? 0 : m.scroll);
    p.render(this.renderer, null, still ? STILL_T : (now - m.t0) / 1000, still ? 0 : dt);
    this.frames++;
    if (!still && p.animated !== false) this.raf = requestAnimationFrame(this.frame);
  };

  /**
   * Khung chậm liên tục 1,5 giây thì hạ 15% độ phân giải (tối thiểu một nửa); nhanh liên tục 6 giây thì nâng lại.
   * Hạ xong mà khung không nhanh hơn thì chậm không do GPU (trình duyệt bóp nhịp 30 khung/giây khi tiết kiệm pin hay
   * cửa sổ ẩn): trả lại độ phân giải cũ và thôi hạ trong phiên này.
   */
  private adapt(dt: number): void {
    if (this.warmup > 0) {
      this.warmup--;
      return;
    }
    this.ema += (dt - this.ema) * 0.1;
    if (this.probe && (this.probe.t += dt) > 1.5) {
      if (this.ema > this.probe.ema * 0.9) {
        this.scale = this.probe.scale;
        this.noShrink = true;
        this.needsResize = true;
        this.warmup = 10;
      }
      this.probe = null;
    }
    if (this.ema > 1 / 50) {
      this.slowFor += dt;
      this.fastFor = 0;
      if (this.slowFor > 1.5 && this.scale > 0.5 && !this.noShrink && !this.probe) {
        this.probe = { ema: this.ema, scale: this.scale, t: 0 };
        this.scale = Math.max(0.5, this.scale * 0.85);
        this.slowFor = 0;
        this.needsResize = true;
        this.warmup = 10;
      }
    } else if (this.ema < 1 / 57) {
      this.fastFor += dt;
      this.slowFor = 0;
      if (this.fastFor > 6 && this.scale < 1) {
        this.scale = Math.min(1, this.scale * 1.1);
        this.fastFor = 0;
        this.needsResize = true;
        this.warmup = 10;
      }
    }
  }

  /** Độ phân giải hiện tại so với mức tối đa, để trang thử hiện. */
  get resolutionScale(): number {
    return this.scale;
  }

  // ---- chế độ nướng ------------------------------------------------------------------------------------------------

  /**
   * Vẽ một khung ra canvas 2D cỡ w × h px CSS nhân dpr. transparent: giữ kênh alpha (lớp phủ), bỏ nhân trước alpha.
   * Gọi đồng bộ; nhiều ảnh liền thì index.ts xếp hàng và nhường luồng giữa các ảnh.
   */
  bake(factory: ProgramFactory, w: number, h: number, dpr: number, opts: { transparent?: boolean; t?: number } = {}): HTMLCanvasElement {
    const W = Math.max(1, Math.min(2048, Math.round(w * dpr)));
    const H = Math.max(1, Math.min(2048, Math.round(h * dpr)));
    const rt = this.bakeTarget(W, H);
    const p = factory(this);
    p.resize(w, h, W / w);
    p.render(this.renderer, rt, opts.t ?? STILL_T, 0);
    const buf = new Uint8Array(W * H * 4);
    this.renderer.readRenderTargetPixels(rt, 0, 0, W, H, buf);
    this.renderer.setRenderTarget(null);
    p.dispose();

    const out = document.createElement("canvas");
    out.width = W;
    out.height = H;
    const ctx = out.getContext("2d")!;
    const img = ctx.createImageData(W, H);
    const row = W * 4;
    // WebGL đọc từ dưới lên
    for (let y = 0; y < H; y++) img.data.set(buf.subarray((H - 1 - y) * row, (H - y) * row), y * row);
    if (opts.transparent) {
      const d = img.data;
      for (let i = 0; i < d.length; i += 4) {
        const a = d[i + 3];
        if (a > 0 && a < 255) {
          const k = 255 / a;
          d[i] = Math.min(255, d[i] * k);
          d[i + 1] = Math.min(255, d[i + 1] * k);
          d[i + 2] = Math.min(255, d[i + 2] * k);
        }
      }
    } else {
      for (let i = 3; i < img.data.length; i += 4) img.data[i] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return out;
  }

  /**
   * Đo thông lượng vẽ (CPU + GPU, ms mỗi khung): vẽ liền `frames` khung vào render target cỡ màn rồi chờ GPU xong một
   * lần (đọc 1 điểm ảnh). Dùng ở trang thử, vì rAF bị bóp khi cửa sổ ẩn nên đếm khung/giây không tin được.
   * `cpu`: thời gian JS gửi lệnh, chưa chờ GPU.
   */
  bench(factory: ProgramFactory, w: number, h: number, dpr: number, frames = 120): { avg: number; cpu: number } {
    const W = Math.round(w * dpr);
    const H = Math.round(h * dpr);
    const rt = this.bakeTarget(W, H);
    const p = factory(this);
    p.resize(w, h, dpr);
    const px = new Uint8Array(4);
    // khung đầu dịch shader, không tính
    p.render(this.renderer, rt, 0, 1 / 60);
    this.renderer.readRenderTargetPixels(rt, 0, 0, 1, 1, px);
    const t0 = performance.now();
    for (let i = 1; i <= frames; i++) p.render(this.renderer, rt, i / 60, 1 / 60);
    const t1 = performance.now();
    this.renderer.readRenderTargetPixels(rt, 0, 0, 1, 1, px);
    const t2 = performance.now();
    this.renderer.setRenderTarget(null);
    p.dispose();
    return { avg: (t2 - t0) / frames, cpu: (t1 - t0) / frames };
  }

  /** Một render target dùng lại cho mọi lần nướng; nhả sau 3 giây không dùng để trả bộ nhớ GPU. */
  private bakeTarget(W: number, H: number): WebGLRenderTarget {
    clearTimeout(this.bakeRTTimer);
    this.bakeRTTimer = window.setTimeout(() => {
      this.bakeRT?.dispose();
      this.bakeRT = null;
    }, 3000);
    if (!this.bakeRT) this.bakeRT = new WebGLRenderTarget(W, H, { samples: 4, depthBuffer: true });
    else if (this.bakeRT.width !== W || this.bakeRT.height !== H) this.bakeRT.setSize(W, H);
    return this.bakeRT;
  }
}

let host: Host | null = null;

/** Host dùng chung; tạo ở lần gọi đầu. */
export function getHost(): Host {
  return (host ??= new Host());
}

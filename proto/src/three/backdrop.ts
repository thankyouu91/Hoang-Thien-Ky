// Nền sân đấu cho màn Trận, vẽ theo toạ độ thế giới của màn Trận (sau camera.apply: mỗi ô 64 đơn vị, trục 768,
// ngang -210..210). Mặt sân 3D nướng một lần (Three.js) thành ảnh phủ sân và lề, kèm toạ độ thế giới của ảnh; mỗi khung
// chỉ còn drawImage vào đúng toạ độ đó (camera kéo, zoom vẫn khớp vì camera 3D là trực giao), cộng vài lớp động vẽ bằng
// canvas 2D: sương trôi, đèn và linh thạch nhịp sáng, bụi sáng. Không vẽ WebGL mỗi khung.
import type { ArenaLight, WorldFrame } from "./engine/entry.ts";
import { enqueue, load } from "./lazy.ts";
import { hasWebGL } from "./support.ts";
import type { ArenaKind } from "./types.ts";

export interface ArenaBackdropOptions {
  seed?: number;
  /** Dài trục sân theo đơn vị thế giới màn Trận; mặc định 768 (12 ô × 64). */
  length?: number;
  /** Nửa bề ngang sân; mặc định 210. */
  halfCross?: number;
}

/** Tham số cho render(): như camera của màn Trận (app/camera.ts). */
export interface BackdropRenderOptions {
  /** Cỡ màn px CSS. */
  w: number;
  h: number;
  dpr: number;
  camX: number;
  camY: number;
  /** px CSS mỗi đơn vị thế giới. */
  zoom: number;
  vertical: boolean;
  /** Giây, cho lớp động. */
  t: number;
  /** Phần đáy màn bị thanh dưới che (View.bottom), để tâm camera khớp. Mặc định 0. */
  bottom?: number;
}

export interface ArenaBackdrop {
  /** Bắt đầu nướng hướng này nếu chưa có; true khi đã sẵn sàng, false khi không có WebGL hay lỗi. */
  ready(vertical: boolean): Promise<boolean>;
  /**
   * Vẽ nền sân vào ctx đang ở toạ độ thế giới màn Trận (gọi ngay sau camera.apply, trước người).
   * false khi chưa sẵn sàng (lần đầu gọi thì bắt đầu nướng): màn Trận vẽ nền dự phòng.
   */
  draw(ctx: CanvasRenderingContext2D, t: number, vertical: boolean): boolean;
  /** Lớp trên người: cành, nhũ đá, sương ở mép sân (phủ cả lề). Vẽ sau người, trước số và nhãn. */
  drawFront(ctx: CanvasRenderingContext2D, t: number, vertical: boolean): boolean;
  /** Theo đề xuất của phiên màn Trận: canvas cỡ màn đã khớp camera (draw() vào một canvas riêng). null khi chưa có. */
  render(o: BackdropRenderOptions): HTMLCanvasElement | null;
  dispose(): void;
}

interface Baked {
  back: HTMLCanvasElement;
  front: HTMLCanvasElement;
  haze: HTMLCanvasElement;
  frame: WorldFrame;
  field: { x: number; y: number; w: number; h: number };
  lights: ArenaLight[];
  edge: string;
}

interface Style {
  haze: number;
  hazeSpeed: number;
  light: number;
  motes: { n: number; color: string; size: number; vx: number; vy: number };
}

const STYLE: Record<ArenaKind, Style> = {
  vo_truong: { haze: 0.18, hazeSpeed: 9, light: 0.55, motes: { n: 10, color: "255, 214, 150", size: 2.2, vx: 4, vy: -6 } },
  mo_linh_thach: { haze: 0.22, hazeSpeed: 6, light: 0.8, motes: { n: 42, color: "140, 255, 238", size: 2.4, vx: 2, vy: -10 } },
  cao_nguyen: { haze: 0.3, hazeSpeed: 14, light: 0, motes: { n: 8, color: "245, 240, 225", size: 2, vx: 18, vy: 2 } },
};

/** Ảnh quầng sáng tròn, một ảnh cho mỗi màu. */
const sprites = new Map<string, HTMLCanvasElement>();
function glowSprite(color: string): HTMLCanvasElement {
  let c = sprites.get(color);
  if (!c) {
    c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d")!;
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, color);
    grad.addColorStop(0.35, color + "88");
    grad.addColorStop(1, color + "00");
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    sprites.set(color, c);
  }
  return c;
}

/** Màu trung bình ở mép ảnh, để tô phần ngoài khung nướng khi camera lùi xa. */
function edgeColor(c: HTMLCanvasElement): string {
  const g = c.getContext("2d")!;
  const rows = [g.getImageData(0, 0, c.width, 1).data, g.getImageData(0, c.height - 1, c.width, 1).data];
  let r = 0;
  let gg = 0;
  let b = 0;
  let n = 0;
  for (const d of rows) {
    for (let i = 0; i < d.length; i += 16) {
      r += d[i];
      gg += d[i + 1];
      b += d[i + 2];
      n++;
    }
  }
  return `rgb(${Math.round(r / n)}, ${Math.round(gg / n)}, ${Math.round(b / n)})`;
}

/**
 * Nền sân đấu cho màn Trận. Mỗi hướng (ngang, đứng) nướng một lần khi cần, khoảng 0,2–0,5 s chạy nền theo từng phần,
 * rồi mỗi khung vẽ chừng 1 ảnh lớn + 2 lớp sương + vài chục chấm. Không có WebGL2 thì draw() luôn trả false.
 */
export function createArenaBackdrop(kind: ArenaKind, opts: ArenaBackdropOptions = {}): ArenaBackdrop {
  const seed = opts.seed ?? 1;
  const len = opts.length ?? 768;
  const hc = opts.halfCross ?? 210;
  const style = STYLE[kind];
  const baked: Partial<Record<"h" | "v", Baked>> = {};
  const pending: Partial<Record<"h" | "v", Promise<boolean>>> = {};
  let disposed = false;
  let out: HTMLCanvasElement | null = null;
  // bụi sáng: vị trí gốc 0..1 trong sân, tốc độ, pha nhấp nháy
  let a = (seed * 9301 + 49297) % 233280;
  const rand = () => (a = (a * 9301 + 49297) % 233280) / 233280;
  const motes = Array.from({ length: style.motes.n }, () => ({ u: rand(), v: rand(), s: 0.6 + rand() * 0.8, p: rand() * 6.28 }));

  const bake = (vertical: boolean): Promise<boolean> => {
    const key = vertical ? "v" : "h";
    if (pending[key]) return pending[key];
    if (!hasWebGL()) return (pending[key] = Promise.resolve(false));
    const field = vertical ? { x: -hc, y: 0, w: 2 * hc, h: len } : { x: 0, y: -hc, w: len, h: 2 * hc };
    // khung nướng: sân + lề (dọc trục 30% mỗi đầu, ngang 120% nửa bề ngang mỗi bên) để zoom ra vẫn thấy cảnh quanh sân
    const ml = len * 0.3;
    const mc = hc * 1.2;
    const frame: WorldFrame = vertical
      ? { x0: -hc - mc, y0: -ml, x1: hc + mc, y1: len + ml, length: len, halfCross: hc }
      : { x0: -ml, y0: -hc - mc, x1: len + ml, y1: hc + mc, length: len, halfCross: hc };
    const fw = frame.x1 - frame.x0;
    const fh = frame.y1 - frame.y0;
    const k = Math.min(2, 2048 / Math.max(fw, fh));
    return (pending[key] = load()
      .then(async (e) => {
        const host = e.getHost();
        const back = await enqueue(() => e.bakeArenaWorld(host, kind, vertical, seed, frame, k));
        // Lớp front phủ cả khung nướng (sương kéo sang lề, không có vệt cắt ở mép sân), độ phân giải 0,6 lần lớp back.
        const inFrame = { u0: (field.x - frame.x0) / fw, v0: (field.y - frame.y0) / fh, u1: (field.x + field.w - frame.x0) / fw, v1: (field.y + field.h - frame.y0) / fh };
        const front = await enqueue(() => host.bake(e.arenaFrontFactory(kind, vertical, seed, inFrame), fw * k * 0.6, fh * k * 0.6, 1, { transparent: true }));
        const haze = await enqueue(() => host.bake(e.hazeFactory(kind), fw * 0.3, fh * 0.3, 1, { transparent: true }));
        if (disposed) return false;
        baked[key] = { back: back.canvas, front, haze, frame, field, lights: back.lights, edge: edgeColor(back.canvas) };
        return true;
      })
      .catch((err) => {
        console.warn("createArenaBackdrop lỗi", kind, err);
        return false;
      }));
  };

  const get = (vertical: boolean): Baked | undefined => {
    const b = baked[vertical ? "v" : "h"];
    if (!b && !disposed) void bake(vertical);
    return b;
  };

  const draw = (ctx: CanvasRenderingContext2D, t: number, vertical: boolean): boolean => {
    const b = get(vertical);
    if (!b) return false;
    const f = b.frame;
    const fw = f.x1 - f.x0;
    const fh = f.y1 - f.y0;
    ctx.save();
    ctx.fillStyle = b.edge;
    ctx.fillRect(f.x0 - fw * 2, f.y0 - fh * 2, fw * 5, fh * 5);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(b.back, f.x0, f.y0, fw, fh);
    // Sương trôi dọc trục sân: hai lớp lệch nửa chu kỳ, lớp nào sắp quay vòng thì mờ hẳn nên không thấy giật.
    const D = len * 0.35;
    for (const ph of [0, 0.5]) {
      const u = ((t * style.hazeSpeed) / D + ph) % 1;
      ctx.globalAlpha = style.haze * (1 - Math.abs(2 * u - 1));
      if (vertical) ctx.drawImage(b.haze, f.x0, f.y0 - D + u * D, fw, fh + D);
      else ctx.drawImage(b.haze, f.x0 - D + u * D, f.y0, fw + D, fh);
    }
    // đèn, linh thạch nhịp sáng
    if (style.light > 0) {
      ctx.globalCompositeOperation = "lighter";
      b.lights.forEach((l, i) => {
        ctx.globalAlpha = style.light * (0.62 + 0.38 * Math.sin(t * (1.3 + (i % 3) * 0.4) + i * 1.7));
        ctx.drawImage(glowSprite(l.color), l.x - l.r, l.y - l.r, l.r * 2, l.r * 2);
      });
    }
    // bụi sáng trôi trong sân
    const m = style.motes;
    ctx.globalCompositeOperation = kind === "cao_nguyen" ? "source-over" : "lighter";
    for (const p of motes) {
      const x = b.field.x + (((p.u * b.field.w + t * m.vx * p.s) % b.field.w) + b.field.w) % b.field.w;
      const y = b.field.y + (((p.v * b.field.h + t * m.vy * p.s) % b.field.h) + b.field.h) % b.field.h;
      ctx.globalAlpha = 0.25 + 0.55 * (0.5 + 0.5 * Math.sin(t * 2.1 * p.s + p.p));
      ctx.fillStyle = `rgb(${m.color})`;
      const s = m.size * p.s;
      ctx.fillRect(x - s / 2, y - s / 2, s, s);
    }
    ctx.restore();
    return true;
  };

  const drawFront = (ctx: CanvasRenderingContext2D, _t: number, vertical: boolean): boolean => {
    const b = get(vertical);
    if (!b) return false;
    const f = b.frame;
    ctx.drawImage(b.front, f.x0, f.y0, f.x1 - f.x0, f.y1 - f.y0);
    return true;
  };

  return {
    ready: (vertical) => bake(vertical),
    draw,
    drawFront,
    render(o) {
      const W = Math.max(1, Math.round(o.w * o.dpr));
      const H = Math.max(1, Math.round(o.h * o.dpr));
      out ??= document.createElement("canvas");
      if (out.width !== W || out.height !== H) {
        out.width = W;
        out.height = H;
      }
      const ctx = out.getContext("2d", { alpha: false })!;
      const s = o.dpr * o.zoom;
      ctx.setTransform(s, 0, 0, s, o.dpr * (o.w / 2 - o.camX * o.zoom), o.dpr * ((o.h - (o.bottom ?? 0)) / 2 - o.camY * o.zoom));
      return draw(ctx, o.t, o.vertical) ? out : null;
    },
    dispose() {
      disposed = true;
      for (const b of Object.values(baked)) for (const c of [b.back, b.front, b.haze]) c.width = c.height = 0;
      if (out) out.width = out.height = 0;
    },
  };
}

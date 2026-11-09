// Sân khấu 2D nhiều lớp: camera trực giao, khung cao 1 đơn vị (y 0..1), rộng theo tỉ lệ khung.
// Mỗi lớp có độ sâu 0 (xa, đứng yên) .. 1 (gần, trôi nhiều nhất) để làm thị sai theo con trỏ, độ nghiêng máy và cuộn.
import { Mesh, Object3D, OrthographicCamera, Scene, ShaderMaterial, Vector3, type WebGLRenderer, type WebGLRenderTarget } from "three";
import type { Tone } from "../types.ts";
import type { Host } from "./host.ts";
import { hashSeed, rng } from "./noise.ts";
import type { Program } from "./program.ts";

export interface CommonUniforms {
  uNoise: { value: unknown };
  uTime: { value: number };
  uSpan: { value: number };
  uAspect: { value: number };
  uFlash: { value: number };
  uPx: { value: number };
  [k: string]: { value: unknown };
}

interface Layer {
  obj: Object3D;
  depth: number;
  x: number;
  y: number;
}

/** "#rrggbb" → Vector3 0..1, không đổi không gian màu (xem glsl.ts). */
export function col(hex: string): Vector3 {
  const n = parseInt(hex.slice(1), 16);
  return new Vector3(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

export function mixHex(a: string, b: string, t: number): string {
  const x = col(a);
  const y = col(b);
  const v = x.lerp(y, t);
  const h = (c: number) => Math.round(Math.max(0, Math.min(1, c)) * 255).toString(16).padStart(2, "0");
  return `#${h(v.x)}${h(v.y)}${h(v.z)}`;
}

export class Stage implements Program {
  readonly scene = new Scene();
  readonly camera = new OrthographicCamera(-0.5, 0.5, 1, 0, -10, 10);
  readonly u: CommonUniforms;
  readonly host: Host;
  readonly seed: number;
  readonly rand: () => number;
  /** Cảnh trong suốt (lớp phủ): xoá về alpha 0. Cảnh nền thì lớp trời phủ kín, khỏi xoá màu. */
  transparent = false;
  animated = true;
  /** Tông màu: "giay" là nền kem sáng của dashboard (nét mực nhạt, cộng màu không thấy được nên dùng hòa màu thường). */
  tone: Tone = "chang_vang";
  aspect = 1;
  w = 1;
  h = 1;
  private layers: Layer[] = [];
  private updaters: ((t: number, dt: number) => void)[] = [];
  private resizers: ((aspect: number) => void)[] = [];
  private order = 0;
  private par = { x: 0, y: 0, tx: 0, ty: 0, s: 0, ts: 0 };

  constructor(host: Host, seed: number | string = 1) {
    this.host = host;
    this.seed = typeof seed === "number" ? seed >>> 0 : hashSeed(seed);
    this.rand = rng(this.seed);
    this.u = {
      uNoise: { value: host.noiseTex },
      uTime: { value: 0 },
      uSpan: { value: 1 },
      uAspect: { value: 1 },
      uFlash: { value: 0 },
      uPx: { value: 800 },
    };
  }

  /** Thêm một lớp; lớp thêm sau vẽ đè lên lớp trước. */
  add<T extends Object3D>(obj: T, depth = 0): T {
    obj.renderOrder = this.order++;
    obj.frustumCulled = false;
    this.layers.push({ obj, depth, x: obj.position.x, y: obj.position.y });
    this.scene.add(obj);
    return obj;
  }

  /** Đặt lại vị trí gốc của lớp (sau khi đổi cỡ khung) mà giữ thị sai. */
  place(obj: Object3D, x: number, y: number): void {
    const l = this.layers.find((v) => v.obj === obj);
    if (l) {
      l.x = x;
      l.y = y;
    }
    obj.position.set(x, y, obj.position.z);
  }

  onUpdate(fn: (t: number, dt: number) => void): void {
    this.updaters.push(fn);
  }

  onResize(fn: (aspect: number) => void): void {
    this.resizers.push(fn);
  }

  /** Vật liệu dùng chung uniform của sân khấu (thời gian, nhiễu, tỉ lệ khung). */
  material(vertexShader: string, fragmentShader: string, uniforms: Record<string, unknown>, opts: Partial<ShaderMaterial> = {}): ShaderMaterial {
    const own: Record<string, { value: unknown }> = {};
    for (const [k, v] of Object.entries(uniforms)) own[k] = { value: v };
    const m = new ShaderMaterial({
      uniforms: { ...this.u, ...own },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    Object.assign(m, opts);
    return m;
  }

  resize(w: number, h: number, dpr: number): void {
    this.w = w;
    this.h = h;
    this.aspect = w / h;
    const c = this.camera;
    c.left = -this.aspect / 2;
    c.right = this.aspect / 2;
    c.top = 1;
    c.bottom = 0;
    c.updateProjectionMatrix();
    this.u.uAspect.value = this.aspect;
    this.u.uSpan.value = Math.pow(this.aspect, 0.6);
    this.u.uPx.value = h * dpr;
    for (const fn of this.resizers) fn(this.aspect);
  }

  pointer(x: number, y: number): void {
    this.par.tx = x;
    this.par.ty = y;
  }

  scroll(screens: number): void {
    this.par.ts = screens;
  }

  render(r: WebGLRenderer, target: WebGLRenderTarget | null, t: number, dt: number): void {
    const p = this.par;
    const k = dt > 0 ? 1 - Math.exp(-dt * 3) : 1;
    p.x += (p.tx - p.x) * k;
    p.y += (p.ty - p.y) * k;
    p.s += (p.ts - p.s) * (dt > 0 ? 1 - Math.exp(-dt * 8) : 1);
    for (const l of this.layers) {
      l.obj.position.x = l.x - p.x * 0.035 * l.depth;
      l.obj.position.y = l.y + p.y * 0.012 * l.depth + p.s * 0.06 * l.depth;
    }
    this.u.uTime.value = t;
    for (const fn of this.updaters) fn(t, dt);
    r.setRenderTarget(target);
    if (this.transparent) r.setClearColor(0x000000, 0);
    r.clear(true, true, true);
    r.render(this.scene, this.camera);
  }

  dispose(): void {
    this.scene.traverse((o) => {
      const m = o as Mesh;
      m.geometry?.dispose();
      const mat = m.material;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else mat?.dispose();
    });
  }
}

// Các lớp dựng sẵn cho sân khấu 2D: trời, núi mực, sương mây, đĩa trời, tia sáng, sóng, hạt, viền tối.
// Mỗi hàm thêm một mesh vào Stage và trả mesh đó (uniforms đổi được qua mesh.material.uniforms).
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CustomBlending,
  Mesh,
  OneFactor,
  PlaneGeometry,
  Points,
  ZeroFactor,
  type ShaderMaterial,
} from "three";
import * as G from "./glsl.ts";
import { col, type Stage } from "./stage.ts";

/** Mảnh phẳng rộng 4 đơn vị (đủ cho mọi tỉ lệ khung kể cả thị sai), từ y0 tới y1. */
export function quad(y0: number, y1: number, w = 4): PlaneGeometry {
  const g = new PlaneGeometry(w, y1 - y0);
  g.translate(0, (y0 + y1) / 2, 0);
  return g;
}

export interface SkyOpts {
  top: string;
  mid: string;
  bottom: string;
  midAt?: number;
  glow?: { x: number; y: number; r: number; color: string };
  stars?: number;
  grain?: number;
  flash?: string;
}

export function sky(s: Stage, o: SkyOpts): Mesh {
  const m = s.material(G.QUAD_VERT, G.SKY_FRAG, {
    uTop: col(o.top),
    uMid: col(o.mid),
    uBottom: col(o.bottom),
    uMidAt: o.midAt ?? 0.4,
    uGlowCol: col(o.glow?.color ?? "#000000"),
    uGlow: col("#000000").set(o.glow?.x ?? 0, o.glow?.y ?? 0.5, o.glow?.r ?? 0.3),
    uStars: o.stars ?? 0,
    uGrain: o.grain ?? 0.02,
    uFlashCol: col(o.flash ?? "#000000"),
  });
  return s.add(new Mesh(quad(-0.2, 1.2), m), 0);
}

export interface RidgeOpts {
  base: number;
  amp: number;
  freq?: number;
  sharp?: number;
  /** Cao nguyên: mặt bằng ở độ cao plat (0..1 của amp), mức làm phẳng platAmt. */
  plat?: number;
  platAmt?: number;
  /** Núi lửa: tâm x, nửa bề rộng, độ cao (0..1 của amp). */
  cone?: [number, number, number];
  ink: string;
  wash: string;
  fog: string;
  fogAmt?: number;
  /** Độ sâu từ sống núi xuống mà mực nhạt dần hẳn. */
  fade?: number;
  /** 0: đặc tới đáy; ~0,6: chân núi tan vào sương. */
  dissolve?: number;
  cun?: number;
  edge?: number;
  opacity?: number;
  snow?: string;
  snowAmt?: number;
  snowLine?: number;
  glow?: string;
  glowAmt?: number;
  strata?: number;
  heat?: number;
  rim?: string;
  rimAmt?: number;
  flash?: string;
  depth?: number;
  row?: number;
  seed?: number;
}

/** Thông số sống núi để CPU tính lại độ cao (đặt cây, công trình). Phải khớp ridgeH trong RIDGE_FRAG. */
export interface RidgeShape {
  row: number;
  seed: number;
  freq: number;
  base: number;
  amp: number;
  sharp: number;
  plat: number;
  platAmt: number;
  cone: [number, number, number];
}

export function ridge(s: Stage, o: RidgeOpts): Mesh & { shape: RidgeShape } {
  const shape: RidgeShape = {
    row: o.row ?? s.rand(),
    seed: o.seed ?? s.rand() * 50,
    freq: o.freq ?? 1.6,
    base: o.base,
    amp: o.amp,
    sharp: o.sharp ?? 0.35,
    plat: o.plat ?? 0.6,
    platAmt: o.platAmt ?? 0,
    cone: o.cone ?? [0, 0.1, 0],
  };
  const m = s.material(G.QUAD_VERT, G.RIDGE_FRAG, {
    uRow: shape.row,
    uSeed: shape.seed,
    uFreq: shape.freq,
    uBase: shape.base,
    uAmp: shape.amp,
    uSharp: shape.sharp,
    uPlat: shape.plat,
    uPlatAmt: shape.platAmt,
    uCone: col("#000000").set(...shape.cone),
    uInk: col(o.ink),
    uWash: col(o.wash),
    uFog: col(o.fog),
    uFogAmt: o.fogAmt ?? 0,
    uFade: o.fade ?? 0.25,
    uDissolve: o.dissolve ?? 0,
    uCun: o.cun ?? 0.35,
    uEdge: o.edge ?? 0.6,
    uOpacity: o.opacity ?? 1,
    uSnow: col(o.snow ?? "#ffffff"),
    uSnowAmt: o.snowAmt ?? 0,
    uSnowLine: o.snowLine ?? 0.7,
    uGlowCol: col(o.glow ?? "#000000"),
    uGlowAmt: o.glowAmt ?? 0,
    uStrata: o.strata ?? 0,
    uHeat: o.heat ?? 0,
    uRim: col(o.rim ?? "#000000"),
    uRimAmt: o.rimAmt ?? 0,
    uFlashCol: col(o.flash ?? "#000000"),
  });
  const top = o.base + o.amp + 0.03;
  const bottom = o.dissolve ? o.base - (o.fade ?? 0.25) - 0.02 : -0.15;
  const mesh = s.add(new Mesh(quad(Math.min(bottom, o.base - 0.02), top), m), o.depth ?? 0.5);
  return Object.assign(mesh, { shape });
}

/** Độ cao sống núi tại x (toạ độ cảnh), bản CPU của ridgeH. */
export function ridgeAt(s: Stage, r: RidgeShape, x: number): number {
  const n = s.host.noise;
  const span = s.u.uSpan.value;
  const xs = (x / span) * r.freq + r.seed;
  const a = n.sample(xs * 0.22, r.row, 0);
  const b = n.sample(xs * 0.45, r.row + 0.31, 1);
  const c = n.sample(xs * 1.2, r.row + 0.57, 2);
  const s0 = Math.max(0, Math.min(1, (a * 0.58 + b * 0.32 + c * 0.1 - 0.26) / 0.52));
  let h = s0 + (Math.pow(s0, 1 + r.sharp * 2.2) - s0) * r.sharp;
  const r2 = 1 - Math.abs(2 * n.sample(xs * 0.7, r.row + 0.83, 2) - 1);
  const blade = Math.max(0, Math.min(1, (r.sharp - 0.85) / 0.15));
  h *= 1 - blade * blade * (3 - 2 * blade) * 0.4 * (1 - r2 * r2 * r2);
  h += (n.sample(xs * 2.5, r.row + 0.11, 2) - 0.5) * 0.014;
  const ss = (e0: number, e1: number, v: number) => {
    const t = Math.max(0, Math.min(1, (v - e0) / (e1 - e0)));
    return t * t * (3 - 2 * t);
  };
  const pl = ss(r.plat - 0.05, r.plat + 0.02, h);
  const flat = h * 0.55 + (r.plat + (h - r.plat) * 0.06 - h * 0.55) * pl;
  h = h + (flat - h) * r.platAmt;
  const cd = Math.abs(x - r.cone[0]) / Math.max(r.cone[1], 1e-3);
  let cone = 1 - ss(0, 1, cd);
  cone = cone * cone * (3 - 2 * cone) - ss(0.1, 0, cd) * 0.06;
  h = Math.max(h, cone * r.cone[2]);
  return r.base + r.amp * h;
}

/** Tìm x có đỉnh cao nhất trong khoảng [x0, x1]. */
export function peakIn(s: Stage, r: RidgeShape, x0: number, x1: number, steps = 60): { x: number; y: number } {
  let best = { x: x0, y: -1 };
  for (let i = 0; i <= steps; i++) {
    const x = x0 + ((x1 - x0) * i) / steps;
    const y = ridgeAt(s, r, x);
    if (y > best.y) best = { x, y };
  }
  return best;
}

export interface MistOpts {
  y0: number;
  y1: number;
  color: string;
  color2?: string;
  alpha?: number;
  speed?: number;
  scale?: number;
  thresh?: number;
  soft?: number;
  shade?: number;
  flash?: string;
  depth?: number;
}

export function mist(s: Stage, o: MistOpts): Mesh {
  const m = s.material(G.QUAD_VERT, G.MIST_FRAG, {
    uColor: col(o.color),
    uColor2: col(o.color2 ?? o.color),
    uY0: o.y0,
    uY1: o.y1,
    uAlpha: o.alpha ?? 0.6,
    uSpeed: o.speed ?? 0.004,
    uScale: o.scale ?? 1,
    uThresh: o.thresh ?? 0.25,
    uSoft: o.soft ?? 0.3,
    uRow: s.rand(),
    uShade: o.shade ?? 0,
    uFlashCol: col(o.flash ?? "#000000"),
  });
  return s.add(new Mesh(quad(o.y0, o.y1), m), o.depth ?? 0.4);
}

export interface DiscOpts {
  x: number;
  y: number;
  r: number;
  color: string;
  glow: string;
  glowSize?: number;
  glowAmt?: number;
  crescent?: number;
  corona?: number;
  tex?: number;
  depth?: number;
}

export function disc(s: Stage, o: DiscOpts): Mesh {
  // Mảnh phủ tới 2,6 bán kính: quầng rộng hơn thì đặt ở lớp trời (SkyOpts.glow), rẻ hơn một mảnh phủ cả màn.
  const size = o.r * 5.2;
  const m = s.material(G.QUAD_VERT, G.DISC_FRAG, {
    uR: o.r,
    uColor: col(o.color),
    uGlowCol: col(o.glow),
    uGlow: o.glowSize ?? 1.5,
    uGlowAmt: o.glowAmt ?? 0.8,
    uCrescent: o.crescent ?? 0,
    uCorona: o.corona ?? 0,
    uTex: o.tex ?? 0,
  });
  const mesh = s.add(new Mesh(new PlaneGeometry(size, size), m), o.depth ?? 0.05);
  s.place(mesh, o.x, o.y);
  return mesh;
}

export function rays(s: Stage, o: { x: number; y: number; color: string; alpha?: number; count?: number; spread?: number }): Mesh {
  const m = s.material(G.QUAD_VERT, G.RAYS_FRAG, {
    uOrigin: col("#000000").set(o.x, o.y, 0),
    uColor: col(o.color),
    uAlpha: o.alpha ?? 0.5,
    uCount: o.count ?? 10,
    uSpread: o.spread ?? 1.0,
  });
  // AdditiveBlending của three nhân màu với alpha nguồn; shader ghi alpha 0 nên tự đặt hệ số ONE, ONE.
  setAdditiveOne(m);
  return s.add(new Mesh(quad(-0.1, 1.1), m), 0.1);
}

/** Cộng màu đã nhân sẵn (shader ghi alpha 0): đích giữ nguyên alpha. */
export function setAdditiveOne(m: ShaderMaterial): void {
  m.blending = CustomBlending;
  m.blendSrc = OneFactor;
  m.blendDst = OneFactor;
  m.blendSrcAlpha = ZeroFactor;
  m.blendDstAlpha = OneFactor;
}

export interface WaveOpts {
  y: number;
  amp: number;
  k?: number;
  w?: number;
  water: string;
  deep: string;
  foam: string;
  lines?: number;
  depth?: number;
}

export function wave(s: Stage, o: WaveOpts): Mesh {
  const m = s.material(G.QUAD_VERT, G.WAVE_FRAG, {
    uY: o.y,
    uAmp: o.amp,
    uK: o.k ?? 9,
    uW: o.w ?? 0.6,
    uRow: s.rand(),
    uWater: col(o.water),
    uDeep: col(o.deep),
    uFoam: col(o.foam),
    uLines: o.lines ?? 60,
  });
  return s.add(new Mesh(quad(-0.15, o.y + o.amp * 1.6 + 0.02), m), o.depth ?? 0.5);
}

export interface ParticleOpts {
  count: number;
  /** x0, y0, x1, y1 theo toạ độ cảnh; x tính theo bề rộng khung nếu wide (mặc định). */
  area: [number, number, number, number];
  vel: [number, number];
  size: number;
  color: string;
  color2?: string;
  /** 0 chấm mềm, 1 tàn lửa, 2 lá, 3 vệt mưa, 4 lửa ma, 5 tuyết. */
  shape?: number;
  alpha?: number;
  sway?: number;
  swayF?: number;
  twinkle?: number;
  spin?: number;
  angle?: number;
  life?: number;
  additive?: boolean;
  depth?: number;
}

export function particles(s: Stage, o: ParticleOpts): Points {
  const g = new BufferGeometry();
  const seeds = new Float32Array(o.count * 4);
  for (let i = 0; i < seeds.length; i++) seeds[i] = s.rand();
  g.setAttribute("position", new BufferAttribute(new Float32Array(o.count * 3), 3));
  g.setAttribute("aSeed", new BufferAttribute(seeds, 4));
  const m = s.material(G.POINTS_VERT, G.POINTS_FRAG, {
    uSize: o.size,
    uSway: o.sway ?? 0,
    uSwayF: o.swayF ?? 1,
    uArea: col("#000000"),
    uVel: col("#000000"),
    uColor: col(o.color),
    uColor2: col(o.color2 ?? o.color),
    uShape: o.shape ?? 0,
    uAlpha: o.alpha ?? 1,
    uTwinkle: o.twinkle ?? 0,
    uSpin: o.spin ?? 0,
    uAngle: o.angle ?? 0,
    uLife: o.life ?? 0,
  }, o.additive ? { blending: AdditiveBlending } : {});
  // uArea là vec4, uVel là vec2: dùng mảng số để three gửi đúng kiểu.
  m.uniforms.uArea.value = [0, 0, 1, 1];
  m.uniforms.uVel.value = [o.vel[0], o.vel[1]];
  const p = s.add(new Points(g, m), o.depth ?? 0.6);
  const [ax0, ay0, ax1, ay1] = o.area;
  const fit = (aspect: number) => {
    // area theo bề rộng khung: -0.5..0.5 nhân tỉ lệ khung, cộng lề cho thị sai
    const half = aspect / 2 + 0.06;
    m.uniforms.uArea.value = [ax0 * half * 2, ay0, ax1 * half * 2, ay1];
  };
  s.onResize(fit);
  fit(s.aspect);
  return p;
}

export function vignette(s: Stage, o: { color: string; amt?: number; bottom?: number }): Mesh {
  const m = s.material(G.QUAD_VERT, G.VIGNETTE_FRAG, { uColor: col(o.color), uAmt: o.amt ?? 0.5, uBottom: o.bottom ?? 0 });
  return s.add(new Mesh(quad(-0.05, 1.05), m), 0);
}

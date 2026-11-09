// Vật dựng trên sân khấu 2D: bóng cây, công trình, kiếm, linh thạch, cổng; cỏ gợn gió; tia chớp.
// Hình bóng vẽ bằng Shape của three theo toạ độ riêng (chân ở y = 0, cao chừng 1), rồi co giãn và đặt lên sống núi.
import {
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  Mesh,
  PlaneGeometry,
  Shape,
  ShapeGeometry,
} from "three";
import * as G from "./glsl.ts";
import { setAdditiveOne } from "./layers.ts";
import { col, type Stage } from "./stage.ts";

// ---- hình cơ bản ---------------------------------------------------------------------------------------------------

export function rect(x0: number, y0: number, x1: number, y1: number): Shape {
  const s = new Shape();
  s.moveTo(x0, y0);
  s.lineTo(x1, y0);
  s.lineTo(x1, y1);
  s.lineTo(x0, y1);
  s.closePath();
  return s;
}

export function poly(pts: [number, number][]): Shape {
  const s = new Shape();
  s.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]);
  s.closePath();
  return s;
}

export function ellipse(cx: number, cy: number, rx: number, ry: number, rot = 0): Shape {
  const s = new Shape();
  s.absellipse(cx, cy, rx, ry, 0, Math.PI * 2, false, rot);
  return s;
}

/** Mái cong kiểu điện các: góc mái hếch lên, có đầu đao ở hai đầu nóc. */
function roof(cx: number, yb: number, w: number, h: number, lift: number): Shape[] {
  const hw = w / 2;
  const s = new Shape();
  s.moveTo(cx - hw - 0.03, yb + lift);
  s.quadraticCurveTo(cx - hw * 0.72, yb + h * 0.08, cx - hw * 0.46, yb + h * 0.5);
  s.lineTo(cx - hw * 0.3, yb + h);
  s.lineTo(cx + hw * 0.3, yb + h);
  s.lineTo(cx + hw * 0.46, yb + h * 0.5);
  s.quadraticCurveTo(cx + hw * 0.72, yb + h * 0.08, cx + hw + 0.03, yb + lift);
  s.lineTo(cx + hw * 0.82, yb - 0.01);
  s.lineTo(cx - hw * 0.82, yb - 0.01);
  s.closePath();
  const orn = (x: number, d: number) =>
    poly([
      [x, yb + h - 0.005],
      [x + d * 0.05, yb + h + 0.05],
      [x + d * 0.065, yb + h + 0.03],
      [x + d * 0.03, yb + h - 0.005],
    ]);
  return [s, orn(cx - hw * 0.3, -1), orn(cx + hw * 0.3, 1)];
}

export interface Built {
  body: Shape[];
  glow: Shape[];
}

type R = () => number;

// ---- công trình ----------------------------------------------------------------------------------------------------

export function hall(r: R, tiers = 1, wide = 1): Built {
  const body: Shape[] = [rect(-0.58 * wide, 0, 0.58 * wide, 0.05), rect(-0.5 * wide, 0.05, 0.5 * wide, 0.08)];
  const glow: Shape[] = [];
  const bw = 0.4 * wide;
  body.push(rect(-bw, 0.08, bw, 0.34));
  const n = wide > 1.2 ? 5 : 3;
  for (let i = 0; i < n; i++) {
    const x = -bw + ((i + 0.5) * 2 * bw) / n;
    const ww = (bw / n) * 0.55;
    if (r() < 0.85) glow.push(rect(x - ww, 0.13, x + ww, i === (n - 1) / 2 ? 0.3 : 0.27));
  }
  body.push(...roof(0, 0.33, 1.08 * wide, 0.2, 0.07));
  if (tiers > 1) {
    body.push(rect(-0.27 * wide, 0.5, 0.27 * wide, 0.64));
    glow.push(rect(-0.16 * wide, 0.53, -0.04 * wide, 0.61), rect(0.04 * wide, 0.53, 0.16 * wide, 0.61));
    body.push(...roof(0, 0.63, 0.78 * wide, 0.17, 0.05));
  }
  return { body, glow };
}

export function pagoda(r: R, levels = 4): Built {
  const body: Shape[] = [rect(-0.42, 0, 0.42, 0.05)];
  const glow: Shape[] = [];
  let y = 0.05;
  for (let i = 0; i < levels; i++) {
    const w = 0.62 * (1 - i * 0.13);
    const h = 0.15 * (1 - i * 0.06);
    body.push(rect(-w * 0.36, y, w * 0.36, y + h));
    if (r() < 0.8) glow.push(rect(-w * 0.1, y + h * 0.25, w * 0.1, y + h * 0.8));
    body.push(...roof(0, y + h - 0.01, w, 0.1, 0.045));
    y += h + 0.08;
  }
  body.push(rect(-0.012, y - 0.02, 0.012, y + 0.16), ellipse(0, y + 0.05, 0.03, 0.02));
  return { body, glow };
}

export function gate(_r: R): Built {
  const body: Shape[] = [];
  for (const x of [-0.42, -0.15, 0.15, 0.42]) body.push(rect(x - 0.025, 0, x + 0.025, x === -0.15 || x === 0.15 ? 0.62 : 0.46));
  body.push(rect(-0.5, 0.4, 0.5, 0.44), rect(-0.2, 0.56, 0.2, 0.6));
  body.push(...roof(0, 0.6, 0.5, 0.12, 0.04), ...roof(-0.29, 0.44, 0.34, 0.09, 0.03), ...roof(0.29, 0.44, 0.34, 0.09, 0.03));
  // bậc đá dẫn lên cổng
  for (let i = 0; i < 4; i++) body.push(rect(-0.18 - i * 0.05, -0.03 * (i + 1), 0.18 + i * 0.05, -0.03 * i));
  return { body, glow: [rect(-0.09, 0.48, 0.09, 0.54)] };
}

export function walls(r: R): Built {
  const body: Shape[] = [rect(-1.3, 0, 1.3, 0.24)];
  for (let x = -1.27; x < 1.27; x += 0.09) body.push(rect(x, 0.24, x + 0.05, 0.28));
  const glow: Shape[] = [poly([[-0.1, 0], [0.1, 0], [0.1, 0.12], [0, 0.17], [-0.1, 0.12]])];
  for (const tx of [-0.95, 0.95]) {
    const t = hall(r, 1, 0.55);
    for (const s of t.body) body.push(shift(s, tx, 0.24));
    for (const s of t.glow) glow.push(shift(s, tx, 0.24));
  }
  const keep = hall(r, 2, 0.9);
  for (const s of keep.body) body.push(shift(s, 0, 0.28));
  for (const s of keep.glow) glow.push(shift(s, 0, 0.28));
  return { body, glow };
}

export function tower(r: R): Built {
  const body: Shape[] = [poly([[-0.14, 0], [0.14, 0], [0.1, 0.62], [-0.1, 0.62]])];
  body.push(...roof(0, 0.62, 0.42, 0.12, 0.04));
  return { body, glow: r() < 0.9 ? [rect(-0.04, 0.42, 0.04, 0.54)] : [] };
}

/** Đỉnh luyện đan ba chân, miệng lò sáng. */
export function cauldron(_r: R): Built {
  const body: Shape[] = [
    poly([[-0.28, 0.12], [0.28, 0.12], [0.33, 0.3], [0.3, 0.42], [-0.3, 0.42], [-0.33, 0.3]]),
    rect(-0.36, 0.42, 0.36, 0.46),
    rect(-0.25, 0, -0.2, 0.14), rect(0.2, 0, 0.25, 0.14), rect(-0.025, 0, 0.025, 0.12),
    rect(-0.33, 0.46, -0.28, 0.56), rect(0.28, 0.46, 0.33, 0.56),
  ];
  return { body, glow: [ellipse(0, 0.46, 0.27, 0.035), rect(-0.12, 0.2, 0.12, 0.26)] };
}

/** Diễn võ trường: sân đá có cột cờ. */
export function plaza(r: R): Built {
  const body: Shape[] = [poly([[-0.9, 0], [0.9, 0], [0.8, 0.06], [-0.8, 0.06]])];
  const glow: Shape[] = [];
  for (const x of [-0.7, -0.25, 0.25, 0.7]) {
    const h = 0.42 + r() * 0.12;
    body.push(rect(x - 0.012, 0.06, x + 0.012, 0.06 + h));
    glow.push(poly([[x + 0.012, 0.06 + h], [x + 0.17, 0.06 + h - 0.03], [x + 0.15, 0.06 + h - 0.1], [x + 0.012, 0.06 + h - 0.12]]));
  }
  const t = hall(r, 1, 0.7);
  for (const s of t.body) body.push(shift(s, 0, 0.06));
  return { body, glow };
}

export function terraces(r: R): Built {
  const body: Shape[] = [];
  for (let i = 0; i < 5; i++) {
    const w = 1 - i * 0.16;
    const y = i * 0.07;
    body.push(poly([[-w, y], [w, y], [w - 0.04, y + 0.05], [-w + 0.04, y + 0.05]]));
  }
  const p = hall(r, 1, 0.45);
  for (const s of p.body) body.push(shift(s, 0.15, 0.35));
  return { body, glow: p.glow.map((s) => shift(s, 0.15, 0.35)) };
}

export function crystals(r: R, n = 5): Built {
  const glow: Shape[] = [];
  for (let i = 0; i < n; i++) {
    const x = (i - (n - 1) / 2) * 0.13 + (r() - 0.5) * 0.06;
    const h = 0.3 + r() * 0.45 * (1 - Math.abs(i - (n - 1) / 2) / n);
    const w = 0.04 + r() * 0.03;
    const lean = (r() - 0.5) * 0.2;
    glow.push(poly([[x - w, 0], [x + w, 0], [x + w * 0.9 + lean * h, h * 0.8], [x + lean * h, h], [x - w * 0.9 + lean * h, h * 0.8]]));
  }
  return { body: [poly([[-0.5, 0], [0.5, 0], [0.38, 0.07], [-0.4, 0.06]])], glow };
}

/** Gò đá có hang; miệng hang đặt riêng bằng caveMouth (màu tối hơn), mắt thú là phần sáng của miệng hang. */
export function cave(_r: R): Built {
  const s = new Shape();
  s.moveTo(-0.7, 0);
  s.quadraticCurveTo(-0.65, 0.55, -0.1, 0.62);
  s.quadraticCurveTo(0.55, 0.6, 0.72, 0);
  s.closePath();
  return { body: [s], glow: [] };
}

export function caveMouth(_r: R): Built {
  const hole = new Shape();
  hole.moveTo(-0.32, 0);
  hole.quadraticCurveTo(-0.3, 0.36, 0, 0.38);
  hole.quadraticCurveTo(0.3, 0.36, 0.32, 0);
  hole.closePath();
  return { body: [hole], glow: [ellipse(-0.08, 0.17, 0.032, 0.013, 0.25), ellipse(0.08, 0.17, 0.032, 0.013, -0.25)] };
}

export function mine(_r: R): Built {
  const body: Shape[] = [
    poly([[-0.8, 0], [0.8, 0], [0.55, 0.5], [-0.5, 0.55]]),
    rect(-0.26, 0, -0.21, 0.36), rect(0.21, 0, 0.26, 0.36), rect(-0.3, 0.34, 0.3, 0.4),
  ];
  for (let i = 0; i < 6; i++) body.push(rect(-0.5 + i * 0.12, -0.04, -0.47 + i * 0.12, -0.01));
  return { body, glow: [rect(-0.2, 0, 0.2, 0.33)] };
}

export function pier(r: R): Built {
  const body: Shape[] = [rect(-0.9, 0.04, 0.1, 0.07)];
  for (let x = -0.85; x < 0.1; x += 0.18) body.push(rect(x, -0.12, x + 0.025, 0.05));
  const boat = new Shape();
  boat.moveTo(0.25, 0.02);
  boat.quadraticCurveTo(0.55, -0.06, 0.9, 0.04);
  boat.lineTo(0.85, 0.06);
  boat.lineTo(0.3, 0.06);
  boat.closePath();
  body.push(boat, rect(0.5, 0.06, 0.52, 0.5), poly([[0.53, 0.48], [0.8, 0.12], [0.53, 0.14]]));
  const h = hall(r, 1, 0.45);
  return { body: [...body, ...h.body.map((s) => shift(s, -0.65, 0.07))], glow: [ellipse(0.62, 0.1, 0.02, 0.02), ...h.glow.map((s) => shift(s, -0.65, 0.07))] };
}

export function spring(_r: R): Built {
  return {
    body: [poly([[-0.6, 0], [0.6, 0], [0.45, 0.06], [-0.45, 0.07]]), ellipse(-0.5, 0.06, 0.1, 0.05), ellipse(0.5, 0.05, 0.12, 0.06)],
    glow: [ellipse(0, 0.035, 0.42, 0.04)],
  };
}

/** Thanh kiếm cắm đất (núi kiếm). */
/** Thanh kiếm cắm mũi xuống đất (núi kiếm): lưỡi từ chân lên tới chắn tay, chuôi và núm ở trên. */
export function sword(r: R): Built {
  const w = 0.05 + r() * 0.02;
  return {
    body: [
      poly([[-w * 0.8, 0], [w * 0.8, 0], [w, 0.78], [-w, 0.78]]),
      rect(-0.17, 0.78, 0.17, 0.82),
      poly([[-0.17, 0.82], [-0.21, 0.86], [-0.15, 0.82]]),
      poly([[0.17, 0.82], [0.21, 0.86], [0.15, 0.82]]),
      rect(-0.022, 0.82, 0.022, 0.98),
      ellipse(0, 1.0, 0.04, 0.03),
    ],
    glow: [rect(-w * 0.18, 0.04, w * 0.18, 0.74)],
  };
}

export function pine(r: R): Built {
  const lean = (r() - 0.5) * 0.4;
  const trunk = new Shape();
  trunk.moveTo(-0.06, 0);
  trunk.quadraticCurveTo(-0.03 + lean * 0.6, 0.5, lean - 0.018, 0.95);
  trunk.lineTo(lean + 0.018, 0.95);
  trunk.quadraticCurveTo(0.04 + lean * 0.6, 0.5, 0.06, 0);
  trunk.closePath();
  const body = [trunk];
  // tán thông vẽ mực: từng tầng là một chùm bầu dục dẹt chồng lên nhau, tầng trên nhỏ dần
  const n = 3 + Math.floor(r() * 2);
  for (let i = 0; i < n; i++) {
    const y = 0.42 + (i / n) * 0.55;
    const side = i % 2 ? 1 : -1;
    const cx = lean * y + side * (0.05 + r() * 0.12);
    const w = 0.36 * (1 - (i / n) * 0.5) * (0.85 + r() * 0.3);
    const hh = 0.075 + r() * 0.03;
    body.push(ellipse(cx, y, w, hh, (r() - 0.5) * 0.2));
    body.push(ellipse(cx - w * 0.45, y + hh * 0.35, w * 0.5, hh * 0.8, 0.15));
    body.push(ellipse(cx + w * 0.5, y + hh * 0.25, w * 0.45, hh * 0.75, -0.15));
    // nhánh nối tán vào thân
    body.push(poly([[lean * y - 0.012, y - 0.02], [cx, y - 0.01], [cx, y + 0.01], [lean * y + 0.012, y + 0.01]]));
  }
  return { body, glow: [] };
}

export function broadleaf(r: R): Built {
  const body = [poly([[-0.04, 0], [0.04, 0], [0.02, 0.5], [-0.02, 0.5]])];
  for (let i = 0; i < 6; i++) body.push(ellipse((r() - 0.5) * 0.45, 0.5 + r() * 0.4, 0.14 + r() * 0.12, 0.11 + r() * 0.08));
  return { body, glow: [] };
}

/** Cây khô cho cảnh âm lãnh: cành chẻ đôi đệ quy. */
export function deadTree(r: R): Built {
  const body: Shape[] = [];
  const branch = (x: number, y: number, a: number, len: number, w: number, d: number) => {
    const x2 = x + Math.sin(a) * len;
    const y2 = y + Math.cos(a) * len;
    const nx = Math.cos(a) * w;
    const ny = -Math.sin(a) * w;
    body.push(poly([[x - nx, y - ny], [x + nx, y + ny], [x2 + nx * 0.6, y2 + ny * 0.6], [x2 - nx * 0.6, y2 - ny * 0.6]]));
    if (d <= 0) return;
    const k = 2 + (r() < 0.3 ? 1 : 0);
    for (let i = 0; i < k; i++) branch(x2, y2, a + (r() - 0.5) * 1.4, len * (0.62 + r() * 0.15), w * 0.6, d - 1);
  };
  branch(0, 0, (r() - 0.5) * 0.3, 0.42, 0.035, 4);
  return { body, glow: [] };
}

export function stele(_r: R): Built {
  return { body: [rect(-0.12, 0.05, 0.12, 0.62), rect(-0.18, 0, 0.18, 0.06), ellipse(0, 0.62, 0.12, 0.05)], glow: [] };
}

function shift(s: Shape, dx: number, dy: number): Shape {
  const pts = s.getPoints(12);
  return poly(pts.map((p) => [p.x + dx, p.y + dy] as [number, number]));
}

// ---- đặt hình lên sân khấu -----------------------------------------------------------------------------------------

export interface PlaceOpts {
  color: string;
  color2?: string;
  glow?: string;
  glowAlpha?: number;
  flicker?: number;
  /** Chiều cao bóng tính theo đơn vị khung (khung cao 1). */
  scale: number;
  depth?: number;
  sheen?: number;
  /** Độ cao (theo đơn vị khung) mà màu chuyển hết sang color2: chân bóng tan vào sương. */
  fadeFrom?: number;
  fadeTo?: number;
  flip?: boolean;
  /** Lay theo gió (góc ở ngọn cho mỗi đơn vị chiều cao bóng, radian); 0 là đứng yên. */
  sway?: number;
  /** Ngọn trễ nhịp so với gốc: giây cho mỗi đơn vị chiều cao bóng. */
  swayLag?: number;
}

export interface Placed {
  body: Mesh;
  glow: Mesh | null;
  at(x: number, y: number, rot?: number): void;
}

export function place(s: Stage, b: Built, o: PlaceOpts): Placed {
  const sx = o.flip ? -o.scale : o.scale;
  const bodyMat = s.material(G.SILHOUETTE_VERT, G.SILHOUETTE_FRAG, {
    uColor: col(o.color),
    uColor2: col(o.color2 ?? o.color),
    uFadeY0: o.fadeFrom ?? 0,
    uFadeY1: o.fadeTo ?? 1,
    uSheen: o.sheen ?? 0,
    uOpacity: 1,
    uSway: o.sway ?? 0,
    uSwayLag: o.swayLag ?? 0.35,
  }, { side: DoubleSide });
  const body = s.add(new Mesh(new ShapeGeometry(b.body, 6), bodyMat), o.depth ?? 0.5);
  body.scale.set(sx, o.scale, 1);
  let glow: Mesh | null = null;
  if (b.glow.length && o.glow) {
    const gm = s.material(G.SILHOUETTE_VERT, G.GLOW_FRAG, { uColor: col(o.glow), uAlpha: o.glowAlpha ?? 1, uFlicker: o.flicker ?? 0.5, uSway: o.sway ?? 0, uSwayLag: o.swayLag ?? 0.35 }, { side: DoubleSide });
    glow = s.add(new Mesh(new ShapeGeometry(b.glow, 6), gm), o.depth ?? 0.5);
    glow.scale.set(sx, o.scale, 1);
  }
  return {
    body,
    glow,
    at(x: number, y: number, rot = 0) {
      s.place(body, x, y);
      body.rotation.z = rot;
      if (glow) {
        s.place(glow, x, y);
        glow.rotation.z = rot;
      }
    },
  };
}

/** Nhiều bóng cùng loại (rừng cây) bằng InstancedMesh: một lệnh vẽ. */
export function forest(s: Stage, variants: Built[], spots: () => { x: number; y: number; h: number; flip: boolean }[], o: Omit<PlaceOpts, "scale">): void {
  for (const [vi, b] of variants.entries()) {
    const geo = new ShapeGeometry(b.body, 4);
    const mat = s.material(G.SILHOUETTE_VERT, G.SILHOUETTE_FRAG, {
      uColor: col(o.color),
      uColor2: col(o.color2 ?? o.color),
      uFadeY0: o.fadeFrom ?? 0,
      uFadeY1: o.fadeTo ?? 1,
      uSheen: o.sheen ?? 0,
      uOpacity: 1,
      uSway: o.sway ?? 0,
      uSwayLag: o.swayLag ?? 0.35,
    }, { side: DoubleSide });
    const max = 64;
    const mesh = s.add(new InstancedMesh(geo, mat, max), o.depth ?? 0.5);
    const m4 = new Matrix4();
    const fill = () => {
      const list = spots().filter((_, i) => i % variants.length === vi).slice(0, max);
      mesh.count = list.length;
      list.forEach((p, i) => {
        m4.makeScale(p.flip ? -p.h : p.h, p.h, 1).setPosition(p.x, p.y, 0);
        mesh.setMatrixAt(i, m4);
      });
      mesh.instanceMatrix.needsUpdate = true;
    };
    s.onResize(fill);
  }
}

// ---- cổng / trận pháp ----------------------------------------------------------------------------------------------

export function portal(s: Stage, o: { x: number; y: number; r: number; color: string; color2: string; squash?: number; ring?: number; alpha?: number; depth?: number }): Mesh {
  const ink = s.tone === "giay";
  const m = s.material(G.QUAD_VERT, G.PORTAL_FRAG, { uR: o.r, uColor: col(o.color), uColor2: col(o.color2), uAlpha: o.alpha ?? 1, uRing: o.ring ?? 1, uInk: ink ? 1 : 0 });
  if (!ink) setAdditiveOne(m);
  const mesh = s.add(new Mesh(new PlaneGeometry(o.r * 3, o.r * 3), m), o.depth ?? 0.5);
  mesh.scale.y = o.squash ?? 1;
  s.place(mesh, o.x, o.y);
  return mesh;
}

// ---- cỏ gợn gió ----------------------------------------------------------------------------------------------------

const GRASS_VERT = G.NOISE + G.MOTION + /* glsl */ `
attribute vec4 aOff;
attribute float aTint;
uniform float uWind;
varying float vV;
varying float vT;
void main() {
  float v = position.y;
  float h = aOff.z;
  float xs = aOff.x / uSpan;
  // Gió giật lan dọc khung (tụ lực, vụt, lắng); ngọn trễ nhịp so với gốc (overlap).
  float w = wind(xs + aOff.w * 0.015, uTime - v * 0.3) * uWind;
  // Ngọn đi theo cung quanh gốc: góc uốn tăng dần lên ngọn, chiều dài lá giữ nguyên (không trượt ngang).
  float ang = (w * 0.55 + 0.1 * uWind) * v;
  vec2 dir = vec2(sin(ang), cos(ang));
  vec2 q = dir * v * h + vec2(dir.y, -dir.x) * position.x * h * 0.09;
  vec4 w4 = modelMatrix * vec4(aOff.x + q.x, aOff.y + q.y, 0.0, 1.0);
  gl_Position = projectionMatrix * viewMatrix * w4;
  vV = v;
  vT = aTint;
}
`;

const GRASS_FRAG = /* glsl */ `
uniform vec3 uBase;
uniform vec3 uTip;
varying float vV;
varying float vT;
void main() {
  vec3 c = mix(uBase, uTip, vV) * (0.82 + 0.36 * vT);
  gl_FragColor = vec4(c, 1.0);
}
`;

export function grass(s: Stage, o: { count: number; y0: number; y1: number; h: [number, number]; base: string; tip: string; wind?: number; depth?: number }): Mesh {
  const seg = 4;
  const pos: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= seg; i++) {
    const v = i / seg;
    const w = 1 - v;
    pos.push(-w, v, 0, w, v, 0);
    if (i < seg) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(new Float32Array(pos), 3));
  g.setIndex(idx);
  const off = new Float32Array(o.count * 4);
  const tint = new Float32Array(o.count);
  const xr: number[] = [];
  for (let i = 0; i < o.count; i++) {
    xr.push(s.rand());
    const yr = s.rand();
    off[i * 4 + 1] = o.y1 - (o.y1 - o.y0) * Math.sqrt(yr);
    // hàng gần (y thấp) cao hơn
    const near = 1 - (off[i * 4 + 1] - o.y0) / Math.max(1e-3, o.y1 - o.y0);
    off[i * 4 + 2] = o.h[0] + (o.h[1] - o.h[0]) * (0.4 + 0.6 * near) * (0.7 + 0.3 * s.rand());
    off[i * 4 + 3] = s.rand() * 6.28;
    tint[i] = s.rand();
  }
  const offAttr = new InstancedBufferAttribute(off, 4);
  g.setAttribute("aOff", offAttr);
  g.setAttribute("aTint", new InstancedBufferAttribute(tint, 1));
  const m = s.material(GRASS_VERT, GRASS_FRAG, { uBase: col(o.base), uTip: col(o.tip), uWind: o.wind ?? 1 }, { side: DoubleSide });
  const mesh = s.add(new InstancedMesh(g, m, o.count), o.depth ?? 0.9);
  // Mesh dùng aOff thay cho instanceMatrix; vẫn phải đặt ma trận đơn vị để three không bỏ qua.
  const id = new Matrix4();
  for (let i = 0; i < o.count; i++) mesh.setMatrixAt(i, id);
  s.onResize((aspect) => {
    const half = aspect / 2 + 0.08;
    for (let i = 0; i < o.count; i++) off[i * 4] = (xr[i] * 2 - 1) * half;
    offAttr.needsUpdate = true;
  });
  return mesh;
}

// ---- tia chớp ------------------------------------------------------------------------------------------------------

const BOLT_VERT = /* glsl */ `
attribute float aEdge;
varying float vE;
void main() {
  vE = aEdge;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const BOLT_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uAlpha;
uniform float uInk;
varying float vE;
void main() {
  float k = 1.0 - vE * vE;
  // nền kem: tia chớp là nét mực màu hệ (hòa thường); nền tối: cộng sáng
  gl_FragColor = uInk > 0.5 ? vec4(uColor, k * uAlpha) : vec4(uColor * k * uAlpha, 0.0);
}
`;

/**
 * Tia chớp: đường gấp khúc chia đôi giữa đoạn, hai nhánh phụ; mỗi lần đánh dựng lại hình, nháy 2–3 nhịp,
 * đẩy uFlash của sân khấu để trời, mây, sống núi sáng theo. Khung tĩnh (dt = 0) luôn có một tia.
 */
export function lightning(s: Stage, o: { color: string; glow: string; top: number; bottom: number; every?: [number, number]; depth?: number; paper?: { color: string; glow: string } }): void {
  const ink = s.tone === "giay" && !!o.paper;
  if (ink) o = { ...o, ...o.paper };
  const PTS = 33;
  const BR = 17;
  const lines = [PTS, BR, BR];
  const total = lines.reduce((a, b) => a + b, 0);
  const mk = (width: number, color: string, alpha: number) => {
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(new Float32Array(total * 2 * 3), 3));
    const edge = new Float32Array(total * 2);
    for (let i = 0; i < total; i++) {
      edge[i * 2] = -1;
      edge[i * 2 + 1] = 1;
    }
    g.setAttribute("aEdge", new BufferAttribute(edge, 1));
    const idx: number[] = [];
    let base = 0;
    for (const n of lines) {
      for (let i = 0; i < n - 1; i++) {
        const a = (base + i) * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
      base += n;
    }
    g.setIndex(idx);
    const m = s.material(BOLT_VERT, BOLT_FRAG, { uColor: col(color), uAlpha: 0, uInk: ink ? 1 : 0 });
    if (!ink) setAdditiveOne(m);
    const mesh = s.add(new Mesh(g, m), o.depth ?? 0.2);
    return { mesh, width, alpha, m };
  };
  const glow = mk(0.022, o.glow, 0.5);
  const core = mk(0.004, o.color, 1);

  const path = (x0: number, y0: number, x1: number, y1: number, n: number, rough: number): [number, number][] => {
    const pts: [number, number][] = new Array(n);
    pts[0] = [x0, y0];
    pts[n - 1] = [x1, y1];
    const split = (a: number, b: number, r: number) => {
      if (b - a < 2) return;
      const m = (a + b) >> 1;
      const len = Math.hypot(pts[b][0] - pts[a][0], pts[b][1] - pts[a][1]);
      pts[m] = [(pts[a][0] + pts[b][0]) / 2 + (s.rand() - 0.5) * len * r, (pts[a][1] + pts[b][1]) / 2 + (s.rand() - 0.5) * len * r * 0.2];
      split(a, m, r * 0.9);
      split(m, b, r * 0.9);
    };
    split(0, n - 1, rough);
    return pts;
  };

  const build = () => {
    const half = s.aspect / 2;
    const x0 = (s.rand() - 0.5) * half * 1.4;
    const x1 = x0 + (s.rand() - 0.5) * 0.35;
    const main = path(x0, o.top, x1, o.bottom, PTS, 0.55);
    const from1 = main[8 + Math.floor(s.rand() * 8)];
    const from2 = main[14 + Math.floor(s.rand() * 10)];
    const b1 = path(from1[0], from1[1], from1[0] + (s.rand() - 0.5) * 0.3, from1[1] - 0.12 - s.rand() * 0.12, BR, 0.7);
    const b2 = path(from2[0], from2[1], from2[0] + (s.rand() - 0.5) * 0.3, from2[1] - 0.1 - s.rand() * 0.1, BR, 0.7);
    for (const g of [glow, core]) {
      const pos = g.mesh.geometry.getAttribute("position") as BufferAttribute;
      let k = 0;
      for (const [li, pts] of [main, b1, b2].entries()) {
        for (let i = 0; i < pts.length; i++) {
          const p = pts[i];
          const q = pts[Math.min(pts.length - 1, i + 1)];
          const pp = pts[Math.max(0, i - 1)];
          let dx = q[0] - pp[0];
          let dy = q[1] - pp[1];
          const l = Math.hypot(dx, dy) || 1;
          dx /= l;
          dy /= l;
          const w = g.width * (li === 0 ? 1 : 0.55) * (1 - (i / pts.length) * 0.6);
          pos.setXYZ(k++, p[0] - dy * w, p[1] + dx * w, 0);
          pos.setXYZ(k++, p[0] + dy * w, p[1] - dx * w, 0);
        }
      }
      pos.needsUpdate = true;
    }
  };

  const [e0, e1] = o.every ?? [1.6, 4.5];
  let next = 0;
  let strike = -10;
  let still = true;
  s.onUpdate((t, dt) => {
    if (dt === 0 && still) {
      build();
      still = false;
      strike = t - 0.04;
      next = t + e0;
    } else if (dt > 0) {
      still = false;
      if (t >= next) {
        build();
        strike = t;
        next = t + e0 + s.rand() * (e1 - e0);
      }
    }
    const age = t - strike;
    let a = 0;
    if (age >= 0 && age < 0.5) {
      // Khung va chạm: 2 khung (30 khung/giây) sáng đủ, một khung tắt, một nhịp giữ, rồi tắt dần có easing
      // (không giảm tuyến tính).
      const f = age * 30;
      const k = Math.min(1, Math.max(0, (age - 0.2) / 0.3));
      a = f < 2 ? 1 : f < 3 ? 0.2 : f < 6 ? 0.9 : 0.7 * (1 - k * k * (3 - 2 * k));
    }
    for (const g of [glow, core]) (g.m.uniforms.uAlpha as { value: number }).value = a * g.alpha;
    s.u.uFlash.value = a;
  });
}

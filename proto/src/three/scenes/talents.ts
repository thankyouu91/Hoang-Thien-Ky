// Nền tông giấy cho bàn ô đặt đồ bổ trợ ở màn Nhân vật: mỗi cách tu luyện (8 tài năng, TALENTS của @htk/sim) một cảnh.
// Bàn ô nằm giữa, rộng chừng 70% khung, nên vật chính đặt ở mép và góc; cuối cùng phủ một lớp giấy dày ở giữa nhạt dần
// ra mép (centerWash) để nét mực nhạt dần vào giữa. Khung gợi ý 360 × 360 tới 520 × 420 px CSS.
import { Mesh, PlaneGeometry } from "three";
import type { TalentId } from "../types.ts";
import * as G from "../engine/glsl.ts";
import { mist, peakIn, quad, type RidgeOpts } from "../engine/layers.ts";
import { cauldron, ellipse as ellipseShape, gate, grass, hall, place, plaza, poly, rect, terraces, type Built } from "../engine/props.ts";
import { col, mixHex, type Stage } from "../engine/stage.ts";
import { compose, type Recipe, type Refs } from "./compose.ts";
import { INK, PAPER, SURFACE } from "./paper.ts";

/** Màu nhấn từng tài năng (tự đặt, đề xuất): chỉ dùng làm điểm nhấn trên nền kem. */
export const TALENT_ACCENT: Record<TalentId, string> = {
  tu_the: "#8a5a2b",
  tu_phap: "#3b6fb0",
  tu_tran: "#a8842c",
  tu_dan: "#3f8f6a",
  sat_thu: "#4a4560",
  tu_ren: "#b3261e",
  tu_duoc: "#4f8a3a",
  tu_kim_tien: "#b8862a",
};

/** Mực của tài năng, đậm k (0 = giấy, 1 = mực). */
function ink(t: TalentId, k: number): string {
  return mixHex(PAPER, mixHex(INK, TALENT_ACCENT[t], 0.22), k);
}

// ---- shader riêng ----------------------------------------------------------------------------------------------

const FRAG_HEAD = G.NOISE + "\nvarying vec2 vP;\n";

/** Giấy dày ở giữa, nhạt dần ra mép, dạng chữ nhật bo góc; mép loang theo nhiễu như giấy thấm. */
const WASH_FRAG = FRAG_HEAD + /* glsl */ `
uniform vec3 uColor;
uniform float uAmt;
uniform vec2 uR;
void main() {
  vec2 q = vec2(vP.x / (uAspect * 0.5 * uR.x), (vP.y - 0.5) / (0.5 * uR.y));
  float d = pow(pow(abs(q.x), 4.0) + pow(abs(q.y), 4.0), 0.25);
  float n = (nR(vP * vec2(2.2, 1.7)) - 0.5) * 0.22;
  float a = (1.0 - smoothstep(0.45, 1.05, d + n)) * uAmt;
  gl_FragColor = vec4(uColor, a);
}
`;

/** Thác: dải nước chảy xuống, vệt trắng trôi theo thời gian, mép mờ, chân thác tan vào sương. */
const FALL_FRAG = FRAG_HEAD + /* glsl */ `
uniform vec3 uColor;
uniform float uW;
uniform float uY0;
uniform float uY1;
uniform float uAlpha;
void main() {
  float u = vP.x / uW;
  float edge = smoothstep(0.5, 0.2, abs(u));
  float flow = nB(vec2(u * 2.5 + 7.0, vP.y * 1.4 + uTime * 0.45)) * 0.6 + nG(vec2(u * 1.5 + 3.0, vP.y * 0.7 + uTime * 0.3)) * 0.4;
  float streak = smoothstep(0.38, 0.78, flow);
  float fade = smoothstep(uY0, uY0 + 0.12, vP.y) * smoothstep(uY1, uY1 - 0.04, vP.y);
  float a = edge * fade * (0.3 + 0.7 * streak) * uAlpha;
  if (a < 0.003) discard;
  gl_FragColor = vec4(mix(uColor, vec3(1.0), streak * 0.7), a);
}
`;

/** Trận đồ bát quái khắc trên đá: các vòng, vạch chia 8 cung, 8 quẻ ba hào (hào âm có khe), nét mòn theo nhiễu. */
const BAGUA_FRAG = FRAG_HEAD + /* glsl */ `
uniform float uR;
uniform vec3 uColor;
uniform float uAlpha;
float ring(float r, float r0, float w, float aa) {
  return 1.0 - smoothstep(w * 0.5, w * 0.5 + aa, abs(r - r0));
}
int trigram(int i) {
  // thứ tự Tiên thiên: Càn, Tốn, Khảm, Cấn, Khôn, Chấn, Ly, Đoài (bit 1 = hào dương, từ trong ra ngoài)
  if (i == 0) return 7;
  if (i == 1) return 3;
  if (i == 2) return 2;
  if (i == 3) return 4;
  if (i == 4) return 0;
  if (i == 5) return 1;
  if (i == 6) return 5;
  return 6;
}
void main() {
  vec2 p = vP / uR;
  float r = length(p);
  float aa = fwidth(r) * 1.2;
  float ang = atan(p.y, p.x);
  float ink = ring(r, 1.0, 0.014, aa) + ring(r, 0.94, 0.006, aa) + ring(r, 0.6, 0.008, aa) + ring(r, 0.55, 0.004, aa) + ring(r, 0.2, 0.006, aa);
  float sec = (ang + 3.14159265 + 0.39269908) / 0.78539816;
  float si = mod(floor(sec), 8.0);
  float sf = fract(sec);
  // vạch chia cung giữa vòng 0,6 và 0,94
  float div = 1.0 - smoothstep(0.0, 0.006 / max(r, 0.1) + aa, min(sf, 1.0 - sf) * 0.785 * r);
  ink += div * step(0.6, r) * step(r, 0.94);
  int bits = trigram(int(si));
  for (int k = 0; k < 3; k++) {
    float rk = 0.68 + float(k) * 0.08;
    float band = ring(r, rk, 0.04, aa) * step(0.24, sf) * step(sf, 0.76);
    bool yang = ((bits >> k) & 1) == 1;
    if (!yang) band *= step(0.07, abs(sf - 0.5));
    ink += band;
  }
  // tia ngắn quanh vòng ngoài
  ink += ring(r, 1.04, 0.03, aa) * step(0.92, abs(cos(ang * 16.0)));
  ink = clamp(ink, 0.0, 1.0);
  float wear = 0.55 + 0.45 * smoothstep(0.25, 0.75, nB(p * 3.0));
  float a = ink * wear * uAlpha;
  if (a < 0.003) discard;
  gl_FragColor = vec4(uColor, a);
}
`;

/** Quầng màu hòa thường (lửa lò rèn, ánh đèn lồng) trên nền kem: cộng màu thì không thấy được. */
const WARM_FRAG = FRAG_HEAD + /* glsl */ `
uniform vec3 uColor;
uniform float uAlpha;
uniform float uR;
void main() {
  float r = length(vP) / uR;
  float flick = 0.9 + 0.1 * sin(uTime * 3.1 + nB(vP * 4.0 + uTime * 0.2) * 6.0);
  float a = exp(-r * r * 2.2) * uAlpha * flick;
  if (a < 0.003) discard;
  gl_FragColor = vec4(uColor, a);
}
`;

// ---- lớp dựng ------------------------------------------------------------------------------------------------------

export function centerWash(s: Stage, o: { color?: string; amt?: number; rx?: number; ry?: number } = {}): void {
  const m = s.material(G.QUAD_VERT, WASH_FRAG, { uColor: col(o.color ?? PAPER), uAmt: o.amt ?? 0.88, uR: [o.rx ?? 0.78, o.ry ?? 0.82] });
  s.add(new Mesh(quad(-0.1, 1.1), m), 0);
}

function waterfall(s: Stage, fx: number, y0: number, y1: number, w: number, color: string): void {
  const g = new PlaneGeometry(w, y1 - y0);
  g.translate(0, (y0 + y1) / 2, 0);
  const m = s.material(G.QUAD_VERT, FALL_FRAG, { uColor: col(color), uW: w, uY0: y0, uY1: y1, uAlpha: 0.85 });
  const mesh = s.add(new Mesh(g, m), 0.4);
  s.onResize((a) => s.place(mesh, (fx * a) / 2, 0));
}

/** Bán kính vòng ngoài 0,47 cạnh ngắn của khung, tâm giữa khung (bàn ô che phần trong, vòng ngoài lộ quanh bàn). */
function bagua(s: Stage, color: string, alpha: number): void {
  // mảnh 1,2 × 1,2 đơn vị, vòng ngoài ở bán kính 0,5 trong mảnh; co mảnh để ra bán kính thật
  const m = s.material(G.QUAD_VERT, BAGUA_FRAG, { uR: 0.5, uColor: col(color), uAlpha: alpha });
  const mesh = s.add(new Mesh(new PlaneGeometry(1.2, 1.2), m), 0.1);
  s.onResize((a) => {
    const k = (0.47 * Math.min(1, a)) / 0.5;
    mesh.scale.set(k, k, 1);
    s.place(mesh, 0, 0.5);
  });
}

function warm(s: Stage, fx: number, y: number, r: number, color: string, alpha: number): void {
  const m = s.material(G.QUAD_VERT, WARM_FRAG, { uColor: col(color), uAlpha: alpha, uR: r });
  const mesh = s.add(new Mesh(new PlaneGeometry(r * 4, r * 4), m), 0.5);
  s.onResize((a) => s.place(mesh, (fx * a) / 2, y));
}

/** Đặt bóng tại (fx theo nửa bề rộng khung, y). */
function at(s: Stage, b: Built, fx: number, y: number, o: { color: string; color2?: string; glow?: string; scale: number; rot?: number; flip?: boolean; depth?: number; fadeFrom?: number; fadeTo?: number; sway?: number; swayLag?: number }): void {
  const p = place(s, b, { ...o, depth: o.depth ?? 0.6 });
  s.onResize((a) => p.at((fx * a) / 2, y, o.rot ?? 0));
}

/** Bóng đặt lên đỉnh cao nhất của sống núi trong khoảng [a0, a1] (theo nửa bề rộng khung). */
function onRidge(s: Stage, ref: Refs["mid"], b: Built, a0: number, a1: number, scale: number, color: string, glow?: string): void {
  if (!ref) return;
  const p = place(s, b, { color, glow, scale, depth: 0.34, fadeFrom: ref.shape.base, fadeTo: ref.shape.base + ref.shape.amp });
  s.onResize((a) => {
    const pk = peakIn(s, ref.shape, (a0 * a) / 2, (a1 * a) / 2);
    p.at(pk.x, pk.y - scale * 0.06);
  });
}

/** Cây trúc: đốt thẳng có mấu, vài chùm lá nhọn ở mấu trên. */
function bamboo(r: () => number, h: number): Built {
  const body = [];
  const w = 0.012 + r() * 0.008;
  const lean = (r() - 0.5) * 0.06;
  const n = Math.round(h / 0.11);
  for (let i = 0; i < n; i++) {
    const y0 = (i * h) / n;
    const y1 = ((i + 1) * h) / n - 0.006;
    const x0 = lean * y0;
    const x1 = lean * y1;
    body.push(poly([[x0 - w, y0], [x0 + w, y0], [x1 + w * 0.96, y1], [x1 - w * 0.96, y1]]));
    body.push(rect(x1 - w * 1.25, y1 - 0.003, x1 + w * 1.25, y1 + 0.003));
  }
  for (let i = 0; i < 4 + Math.floor(r() * 4); i++) {
    const y = h * (0.45 + r() * 0.55);
    const side = r() < 0.5 ? -1 : 1;
    const x = lean * y;
    for (let k = 0; k < 3; k++) {
      const len = 0.05 + r() * 0.04;
      const ang = side * (0.5 + k * 0.35 + r() * 0.2);
      body.push(ellipseShape(x + Math.sin(ang) * len * 0.55, y - Math.cos(ang) * len * 0.2, len * 0.5, 0.006, Math.PI / 2 - ang));
    }
  }
  return { body, glow: [] };
}

/** Dây đèn lồng võng giữa hai điểm (toạ độ riêng, chân trái ở 0,0), đèn đỏ có quầng. */
function lanternString(r: () => number, len: number, sag: number, n: number): Built {
  const body = [];
  const glow = [];
  const y = (u: number) => -sag * 4 * u * (1 - u);
  for (let i = 0; i < 24; i++) {
    const u0 = i / 24;
    const u1 = (i + 1) / 24;
    body.push(poly([[u0 * len, y(u0) - 0.002], [u1 * len, y(u1) - 0.002], [u1 * len, y(u1) + 0.002], [u0 * len, y(u0) + 0.002]]));
  }
  for (let i = 0; i < n; i++) {
    const u = (i + 0.5 + (r() - 0.5) * 0.3) / n;
    const x = u * len;
    const yy = y(u) - 0.035;
    body.push(rect(x - 0.0015, yy, x + 0.0015, y(u)));
    glow.push(ellipseShape(x, yy - 0.022, 0.016, 0.022));
    body.push(rect(x - 0.01, yy - 0.003, x + 0.01, yy + 0.002), rect(x - 0.01, yy - 0.047, x + 0.01, yy - 0.042));
  }
  return { body, glow };
}

function anvil(): Built {
  return { body: [poly([[-0.3, 0.42], [0.42, 0.42], [0.3, 0.32], [0.08, 0.3], [0.1, 0.12], [0.2, 0], [-0.2, 0], [-0.1, 0.12], [-0.08, 0.3], [-0.2, 0.34]])], glow: [] };
}

// ---- 8 cảnh ---------------------------------------------------------------------------------------------------------

function paperSky(t: TalentId, tint = 0.06): Recipe["sky"] {
  const acc = TALENT_ACCENT[t];
  return { top: mixHex(SURFACE, acc, tint * 0.6), mid: mixHex(PAPER, acc, tint), bottom: mixHex(PAPER, acc, tint * 1.8), midAt: 0.45, grain: 0.03 };
}

function ridgeK(t: TalentId, k0: number, k1: number, o: Omit<RidgeOpts, "ink" | "wash" | "fog">): RidgeOpts {
  return { ...o, ink: ink(t, k0), wash: ink(t, k1), fog: PAPER };
}

const whiteMist = (t: TalentId, y0: number, y1: number, alpha = 0.75) => ({ y0, y1, color: SURFACE, color2: ink(t, 0.12), alpha, speed: 0.004, thresh: 0.22, soft: 0.35, shade: 0.6 });

type Build = (s: Stage) => void;

const TALENT_SCENES: Record<TalentId, Build> = {
  // Võ đường đá trên núi: sân võ trên đỉnh trái, cổng đá trên đỉnh phải, thông và sương.
  tu_the: (s) => {
    const t = "tu_the";
    compose(s, {
      sky: paperSky(t),
      far: ridgeK(t, 0.28, 0.08, { base: 0.42, amp: 0.34, freq: 1.3, sharp: 0.7, fade: 0.15, dissolve: 0.7, edge: 0.3 }),
      farMist: whiteMist(t, 0.3, 0.52),
      mid: { ...ridgeK(t, 0.58, 0.2, { base: 0.16, amp: 0.5, freq: 1.5, sharp: 0.8, fade: 0.2, dissolve: 0.6, edge: 0.7, cun: 0.45 }), trees: { kind: "pine", color: ink(t, 0.7), count: 8, h: [0.03, 0.05] } },
      hooks: {
        afterMid: (st, refs) => {
          onRidge(st, refs.mid, plaza(st.rand), -1, -0.55, 0.2, ink(t, 0.85));
          onRidge(st, refs.mid, gate(st.rand), 0.55, 1, 0.17, ink(t, 0.85), "#ffc56a");
        },
      },
      midMist: whiteMist(t, 0.08, 0.3, 0.8),
      near: { ...ridgeK(t, 0.85, 0.35, { base: -0.04, amp: 0.2, freq: 2.4, sharp: 0.5, fade: 0.25, cun: 0.5, edge: 0.9 }), trees: { kind: "pine", color: ink(t, 0.9), count: 6, h: [0.07, 0.11] } },
    });
  },

  // Mây cuộn và thác: vách núi hai bên có thác đổ, biển mây trên và dưới.
  tu_phap: (s) => {
    const t = "tu_phap";
    compose(s, {
      sky: paperSky(t, 0.08),
      high: [
        { y0: 0.7, y1: 1.08, color: SURFACE, color2: ink(t, 0.18), alpha: 0.85, speed: 0.008, thresh: 0.25, soft: 0.25, shade: 1, scale: 0.8 },
        { y0: 0.58, y1: 0.85, color: SURFACE, color2: ink(t, 0.14), alpha: 0.6, speed: 0.012, thresh: 0.3, soft: 0.25, shade: 0.9 },
      ],
      far: ridgeK(t, 0.3, 0.1, { base: 0.3, amp: 0.45, freq: 1.1, sharp: 0.85, fade: 0.18, dissolve: 0.65, edge: 0.3 }),
      mid: ridgeK(t, 0.62, 0.22, { base: 0.1, amp: 0.72, freq: 0.9, sharp: 0.9, fade: 0.25, dissolve: 0.55, edge: 0.7, cun: 0.5 }),
      hooks: {
        afterMid: (st) => {
          waterfall(st, -0.8, 0.12, 0.74, 0.05, mixHex(PAPER, TALENT_ACCENT[t], 0.35));
          waterfall(st, 0.84, 0.16, 0.66, 0.035, mixHex(PAPER, TALENT_ACCENT[t], 0.3));
        },
      },
      midMist: { y0: -0.06, y1: 0.3, color: SURFACE, color2: ink(t, 0.16), alpha: 0.9, speed: 0.01, thresh: 0.18, soft: 0.3, shade: 1, scale: 0.8 },
      particles: [{ count: 30, area: [-0.5, 0, 0.5, 0.3], vel: [0.004, 0.02], size: 0.006, color: ink(t, 0.5), sway: 0.02, twinkle: 0.8, alpha: 0.5 }],
    });
  },

  // Trận đồ bát quái khắc trên nền đá.
  tu_tran: (s) => {
    const t = "tu_tran";
    compose(s, {
      sky: { top: "#ece6d8", mid: "#e9e2d2", bottom: "#e3dbc9", midAt: 0.5, grain: 0.07 },
      hooks: {
        afterSky: (st) => {
          // vân đá: hai dải sương mờ màu đá làm loang mặt đá
          mist(st, { y0: -0.1, y1: 1.1, color: "#f4efe3", color2: "#d6ccb8", alpha: 0.5, speed: 0, thresh: 0.2, soft: 0.5, scale: 2.4, shade: 0.4 });
          bagua(st, ink(t, 0.85), 0.75);
        },
      },
    });
  },

  // Lò đan khói: đỉnh luyện đan góc dưới trái, khói cuộn lên dọc mép, đan phòng trên đỉnh phải.
  tu_dan: (s) => {
    const t = "tu_dan";
    compose(s, {
      sky: paperSky(t),
      far: ridgeK(t, 0.26, 0.08, { base: 0.36, amp: 0.3, freq: 1.2, sharp: 0.6, fade: 0.15, dissolve: 0.7, edge: 0.3 }),
      mid: ridgeK(t, 0.5, 0.18, { base: 0.12, amp: 0.4, freq: 1.4, sharp: 0.6, fade: 0.2, dissolve: 0.6, edge: 0.6, cun: 0.4 }),
      hooks: { afterMid: (st, refs) => onRidge(st, refs.mid, hall(st.rand, 2, 0.8), 0.55, 1, 0.2, ink(t, 0.85), "#ffc56a") },
      midMist: whiteMist(t, 0.04, 0.26, 0.8),
      particles: [
        { count: 34, area: [-0.47, 0.18, -0.28, 1.05], vel: [0.008, 0.05], size: 0.16, color: ink(t, 0.5), color2: ink(t, 0.3), sway: 0.05, swayF: 0.35, alpha: 0.4, life: 0.08 },
        { count: 14, area: [-0.45, 0.15, -0.33, 0.5], vel: [0.004, 0.06], size: 0.012, color: "#c8532a", color2: "#e8a03a", shape: 1, sway: 0.02, twinkle: 0.6, alpha: 0.8 },
      ],
    });
    warm(s, -0.78, 0.12, 0.09, "#e8803a", 0.3);
    at(s, cauldron(s.rand), -0.78, 0.0, { color: ink(t, 0.9), glow: "#f08a3a", scale: 0.3 });
  },

  // Rừng trúc đêm trăng: trăng nhạt góc trên phải, trúc dày hai mép, lá trúc rơi.
  sat_thu: (s) => {
    const t = "sat_thu";
    compose(s, {
      sky: { top: "#e7e6e1", mid: "#eeebe2", bottom: "#f2ede1", midAt: 0.5, grain: 0.03 },
      disc: { x: 0.62, y: 0.84, r: 0.075, color: "#fdfcf7", glow: "#a9a497", glowSize: 0.9, glowAmt: 0.75, tex: 0.15 },
      far: ridgeK(t, 0.22, 0.06, { base: 0.18, amp: 0.2, freq: 1.4, sharp: 0.5, fade: 0.15, dissolve: 0.7, edge: 0.2 }),
      nearMist: whiteMist(t, -0.04, 0.2, 0.7),
      particles: [{ count: 18, area: [-0.5, 0, 0.5, 1], vel: [0.02, -0.04], size: 0.016, color: ink(t, 0.6), shape: 2, sway: 0.04, swayF: 0.9, arc: true, alpha: 0.7 }],
    });
    const stalks: [number, number, number][] = [
      [-1.02, 1.15, 0.55], [-0.92, 1.05, 0.8], [-0.82, 1.2, 0.95], [-0.74, 0.9, 0.5],
      [0.76, 1.1, 0.6], [0.86, 1.25, 0.95], [0.97, 1.0, 0.75],
    ];
    // trúc lay theo gió, ngọn trễ nhịp so với gốc; cây đậm (gần) lay nhiều hơn cây nhạt (xa)
    for (const [fx, h, k] of stalks) at(s, bamboo(s.rand, h), fx, -0.02, { color: ink(t, k), scale: 1, depth: 0.5 + k * 0.4, sway: 0.02 + k * 0.025, swayLag: 0.45 });
  },

  // Lò rèn đỏ lửa: xưởng rèn mép trái, quầng lửa đỏ, tia lửa bắn, đe sắt góc phải.
  tu_ren: (s) => {
    const t = "tu_ren";
    compose(s, {
      sky: paperSky(t, 0.05),
      far: ridgeK(t, 0.24, 0.08, { base: 0.34, amp: 0.28, freq: 1.2, sharp: 0.55, fade: 0.15, dissolve: 0.7, edge: 0.25 }),
      midMist: whiteMist(t, 0.2, 0.42, 0.6),
      particles: [
        { count: 24, area: [-0.5, 0.35, -0.25, 1.05], vel: [0.01, 0.05], size: 0.12, color: ink(t, 0.45), color2: ink(t, 0.25), sway: 0.05, swayF: 0.35, alpha: 0.25, life: 0.08 },
        // tia lửa văng khỏi lò theo cung trọng lực, kéo dài dọc vận tốc
        { count: 34, area: [-0.42, 0.1, -0.3, 0.1], vel: [0.14, 0.8], size: 0.03, color: "#c8321e", color2: "#e0702a", shape: 6, gravity: 1.2, flight: 1.3, twinkle: 0.3, alpha: 1 },
      ],
    });
    warm(s, -0.72, 0.1, 0.16, "#d8481e", 0.45);
    at(s, hall(s.rand, 1, 0.9), -0.78, 0.02, { color: ink(t, 0.85), glow: "#e8582a", scale: 0.32 });
    at(s, { body: [rect(-0.04, 0, 0.04, 0.5)], glow: [] }, -0.66, 0.2, { color: ink(t, 0.8), scale: 0.4 });
    at(s, anvil(), 0.8, 0.02, { color: ink(t, 0.88), scale: 0.16 });
  },

  // Vườn linh thảo: ruộng bậc hai bên, cỏ thuốc ở chân, hoa điểm, đình nhỏ trên đỉnh.
  tu_duoc: (s) => {
    const t = "tu_duoc";
    compose(s, {
      sky: paperSky(t),
      far: ridgeK(t, 0.26, 0.08, { base: 0.38, amp: 0.28, freq: 1.1, sharp: 0.5, fade: 0.15, dissolve: 0.7, edge: 0.25 }),
      mid: ridgeK(t, 0.45, 0.16, { base: 0.18, amp: 0.3, freq: 1.2, sharp: 0.3, fade: 0.2, dissolve: 0.6, edge: 0.5, cun: 0.35 }),
      hooks: {
        afterMid: (st, refs) => onRidge(st, refs.mid, hall(st.rand, 1, 0.6), 0.5, 1, 0.13, ink(t, 0.8), "#ffc56a"),
        afterNear: (st) => grass(st, { count: 500, y0: -0.02, y1: 0.16, h: [0.03, 0.08], base: ink(t, 0.75), tip: mixHex(PAPER, TALENT_ACCENT[t], 0.75), wind: 0.6, depth: 0.85 }),
      },
      midMist: whiteMist(t, 0.12, 0.34, 0.7),
      particles: [
        { count: 26, area: [-0.5, 0.0, 0.5, 0.2], vel: [0, 0], size: 0.009, color: "#c8506a", color2: "#d8a83a", twinkle: 0.4, alpha: 0.85 },
        { count: 8, area: [-0.5, 0.1, 0.5, 0.6], vel: [0.03, 0.01], size: 0.014, color: ink(t, 0.5), shape: 2, sway: 0.05, swayF: 3, arc: true, alpha: 0.7 },
      ],
    });
    at(s, terraces(s.rand), -0.86, 0.02, { color: ink(t, 0.6), scale: 0.32 });
    at(s, terraces(s.rand), 0.9, 0.0, { color: ink(t, 0.7), scale: 0.26, flip: true });
  },

  // Thương lộ có đèn lồng: dãy hàng quán hai mép, dây đèn lồng đỏ võng ở hai góc trên.
  tu_kim_tien: (s) => {
    const t = "tu_kim_tien";
    compose(s, {
      sky: paperSky(t),
      far: ridgeK(t, 0.24, 0.07, { base: 0.4, amp: 0.26, freq: 1.2, sharp: 0.6, fade: 0.15, dissolve: 0.7, edge: 0.25 }),
      midMist: whiteMist(t, 0.25, 0.45, 0.6),
    });
    const shops: [number, number, number][] = [[-0.98, 0.0, 0.22], [-0.8, 0.0, 0.17], [-0.66, 0.02, 0.12], [0.98, 0.0, 0.2], [0.82, 0.01, 0.15], [0.69, 0.03, 0.11]];
    for (const [fx, y, sc] of shops) at(s, hall(s.rand, sc > 0.18 ? 2 : 1, 0.8), fx, y, { color: ink(t, 0.6 + sc * 1.5), glow: "#ffb84a", scale: sc, flip: fx > 0 });
    const red = "#b3261e";
    // dây đèn chỉ ở hai góc trên, không vắt qua giữa (bàn ô)
    const left = lanternString(s.rand, 0.36, 0.05, 3);
    const right = lanternString(s.rand, 0.36, 0.055, 3);
    at(s, { body: left.body, glow: [] }, -1.02, 0.95, { color: ink(t, 0.7), scale: 1, rot: -0.12 });
    at(s, { body: [], glow: left.glow }, -1.02, 0.95, { color: red, glow: red, scale: 1, rot: -0.12 });
    at(s, { body: right.body, glow: [] }, 1.02, 0.95, { color: ink(t, 0.7), scale: 1, rot: 0.12, flip: true });
    at(s, { body: [], glow: right.glow }, 1.02, 0.95, { color: red, glow: red, scale: 1, rot: 0.12, flip: true });
    warm(s, -0.82, 0.86, 0.12, "#e8783a", 0.16);
    warm(s, 0.82, 0.86, 0.12, "#e8783a", 0.16);
  },
};

/** Dựng nền một tài năng; wash = false thì bỏ lớp làm thoáng giữa (khi bàn ô tự lo phần giữa). */
export function talentScene(s: Stage, t: TalentId, o: { wash?: boolean } = {}): void {
  TALENT_SCENES[t](s);
  if (o.wash !== false) centerWash(s, { amt: t === "tu_tran" ? 0.7 : 0.88, color: t === "tu_tran" ? "#ebe4d5" : t === "sat_thu" ? "#efece3" : undefined });
}


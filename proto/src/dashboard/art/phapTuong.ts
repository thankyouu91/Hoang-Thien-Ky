// Cảnh three của khu Pháp tướng (màn Nhân vật), gắn bằng mountProgram của lớp three dùng chung. Nền trong suốt trên
// thẻ giấy kem; tu sĩ (canvas 2D) và 6 ô trang bị nằm trên. Từ sau ra trước:
//  - nét mực tròn kiểu nhất bút (enso) vẽ bằng shader, xoay rất chậm;
//  - vòng 12 hệ có chiều sâu: nghiêng ra sau, lắc nhẹ theo thời gian và theo con trỏ. Bố cục và vạch nối lấy đúng
//    elementWheel.ts (luật @ktlp/sim); hệ linh căn sáng có quầng son, hệ khác mờ;
//  - vũng sáng dưới chân và hạt linh khí màu linh căn bay lên quanh người.
// Đơn vị thế giới là px CSS ở mặt z = 0, tâm ở giữa khung, trục y hướng lên; cỡ vòng khớp SVG dự phòng (tối đa 320 px).
// File này import three nên chỉ được nạp bằng import() động (từ nhanVat.ts).
import type { Element } from "@ktlp/sim";
import {
  BufferGeometry,
  CircleGeometry,
  Color,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineDashedMaterial,
  LineLoop,
  LineSegments,
  Mesh,
  NearestFilter,
  PerspectiveCamera,
  PlaneGeometry,
  Points,
  Scene,
  ShaderMaterial,
  TextureLoader,
  type Material,
  type WebGLRenderer,
  type WebGLRenderTarget,
} from "three";
import type { Host, Program } from "../../three/index.ts";
import { ELEMENT_STYLE } from "../../theme/elements.ts";
import { at, C, LINKS, NODE_R, RINGS, type LinkKind } from "../elementWheel.ts";
import { assetUrl } from "../ui.ts";

const FOV = 28;
/** Bề rộng vòng tối đa, như .pt-wheel của SVG dự phòng. */
const WHEEL_MAX = 320;
/** Chân tu sĩ cách tâm khung bao nhiêu px (canvas.doll cao 220, vẽ chân cách đáy 10 px). */
const FOOT = 100;
const INK = "#2a2018";
const PAPER = "#fffaf0";
const ACCENT = "#b3261e";
const LINK_COLOR: Record<LinkKind, string> = { sinh: "#2e6b34", khac: "#b3261e", cuc: "#5d3f8a", bien: "#76634f" };
const PARTICLES = 140;

/** Màu hex sang vec3 sRGB cho ShaderMaterial (lớp three truyền thẳng sRGB, không qua quản lý màu). */
function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

const NODE_VS = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

// Ô hệ: đĩa giấy viền màu hệ, icon PixelLab ở giữa; hệ linh căn có quầng son thở nhẹ.
const NODE_FS = /* glsl */ `
uniform sampler2D uIcon;
uniform vec3 uEdge;
uniform vec3 uPaper;
uniform vec3 uHalo;
uniform float uOn;
uniform float uAlpha;
uniform float uT;
varying vec2 vUv;
void main() {
  vec2 p = (vUv * 2.0 - 1.0) * 1.6;        // r = 1 ở mép ô
  float r = length(p);
  float fill = 1.0 - smoothstep(0.95, 1.02, r);
  float ring = smoothstep(0.80, 0.87, r) * fill;
  vec3 col = mix(uPaper, uEdge, ring);
  vec2 iu = p / 0.72 * 0.5 + 0.5;
  if (iu.x > 0.0 && iu.x < 1.0 && iu.y > 0.0 && iu.y < 1.0) {
    vec4 ic = texture2D(uIcon, iu);
    col = mix(col, ic.rgb, ic.a * fill);
  }
  float halo = uOn * (1.0 - smoothstep(0.0, 0.18, abs(r - 1.22))) * (0.75 + 0.25 * sin(uT * 1.8));
  float a = max(fill, halo * 0.9);
  gl_FragColor = vec4(mix(uHalo, col, fill), a * uAlpha);
}`;

// Nét mực nhất bút: vòng có độ dày đổi theo nhiễu, chỗ bút khô, và một khe hở như nét chưa khép.
const ENSO_FS = /* glsl */ `
uniform sampler2D uNoise;
uniform vec3 uInk;
uniform float uR;
varying vec2 vUv;
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float r = length(p);
  float ang = atan(p.y, p.x) / 6.2831853 + 0.5;
  float wob = texture2D(uNoise, vec2(ang * 2.0, 0.21)).r - 0.5;
  float w = 0.03 + 0.03 * texture2D(uNoise, vec2(ang * 5.0, 0.63)).g;
  float d = abs(r - uR - wob * 0.035);
  float stroke = 1.0 - smoothstep(w * 0.55, w, d);
  float dry = smoothstep(0.30, 0.62, texture2D(uNoise, vec2(ang * 18.0, r * 9.0)).b);
  float tail = smoothstep(0.0, 0.16, fract(ang - 0.58)) * (1.0 - 0.55 * smoothstep(0.75, 1.0, fract(ang - 0.58)));
  float a = stroke * mix(0.35, 1.0, dry) * tail * 0.2;
  float wash = (1.0 - smoothstep(0.0, uR, r)) * 0.035;
  gl_FragColor = vec4(uInk, max(a, wash));
}`;

// Vũng sáng dưới chân: elip mờ màu linh căn pha vàng.
const POOL_FS = /* glsl */ `
uniform vec3 uC;
varying vec2 vUv;
void main() {
  float r = length(vUv * 2.0 - 1.0);
  float a = 1.0 - smoothstep(0.0, 1.0, r);
  gl_FragColor = vec4(uC, a * a * 0.32);
}`;

// Hạt linh khí: bay từ chân lên đầu, lượn ngang, mờ ở hai đầu đời.
const DUST_VS = /* glsl */ `
uniform float uT;
uniform float uH;
uniform float uFoot;
uniform float uDpr;
attribute vec4 aSeed;   // x lệch ngang, tốc độ, pha, cỡ
attribute vec3 aColor;
varying float vA;
varying vec3 vC;
void main() {
  float life = fract(aSeed.z + uT * aSeed.y);
  float x = aSeed.x * (1.0 - life * 0.35) + sin(uT * 1.1 + aSeed.z * 31.0) * 5.0;
  vec3 pos = vec3(x, uFoot + life * uH, 30.0);
  vA = sin(life * 3.14159);
  vC = aColor;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  gl_PointSize = aSeed.w * uDpr;
}`;

const DUST_FS = /* glsl */ `
varying float vA;
varying vec3 vC;
void main() {
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  float d = dot(c, c);
  if (d > 1.0) discard;
  gl_FragColor = vec4(vC, (1.0 - d) * vA * 0.7);
}`;

const PLANE_VS = NODE_VS;

/** Hàm sinh số giả ngẫu nhiên có seed cho hạt (cố định giữa các lần gắn). */
function rand(seed: number): () => number {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}

export function phapTuong(host: Host, roots: Element[]): Program {
  const lit = new Set(roots);
  const scene = new Scene();
  const camera = new PerspectiveCamera(FOV, 1, 1, 4000);
  const owned: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(x: T): T => (owned.push(x), x);
  const loader = new TextureLoader();
  const shader = (fs: string, uniforms: Record<string, { value: unknown }>, vs = PLANE_VS) =>
    keep(new ShaderMaterial({ vertexShader: vs, fragmentShader: fs, uniforms, transparent: true, depthTest: false, depthWrite: false }));
  const uT = { value: 0 };

  // Vòng hệ: nhóm nghiêng, mọi thứ đo theo đơn vị viewBox rồi nhóm co giãn theo bề rộng khung.
  const wheel = new Group();
  scene.add(wheel);
  const P = (e: Element) => {
    const p = at(e);
    return [p.x - C, C - p.y] as const;
  };

  const enso = new Mesh(keep(new PlaneGeometry(2 * 112, 2 * 112)), shader(ENSO_FS, { uNoise: { value: host.noiseTex }, uInk: { value: rgb(INK) }, uR: { value: 98 / 112 } }));
  enso.position.z = -14;
  enso.renderOrder = 0;
  wheel.add(enso);

  for (const r of RINGS) {
    const g = keep(new CircleGeometry(r, 96));
    // CircleGeometry có đỉnh tâm; bỏ đỉnh đầu để LineLoop chỉ chạy theo vành.
    const pos = g.getAttribute("position");
    const ring = keep(new BufferGeometry());
    ring.setAttribute("position", new Float32BufferAttribute(Array.from(pos.array).slice(3), 3));
    const loop = new LineLoop(ring, keep(new LineBasicMaterial({ color: new Color(INK), transparent: true, opacity: 0.1, depthTest: false })));
    loop.renderOrder = 1;
    wheel.add(loop);
  }

  // Vạch nối: gom theo loại và theo có chạm linh căn hay không, mỗi nhóm một lần vẽ.
  const groups = new Map<string, number[]>();
  for (const { a, b, kind } of LINKS) {
    const key = `${kind}|${lit.has(a) || lit.has(b) ? 1 : 0}`;
    const [ax, ay] = P(a);
    const [bx, by] = P(b);
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(ax, ay, 0, bx, by, 0);
  }
  for (const [key, pts] of groups) {
    const [kind, on] = key.split("|") as [LinkKind, string];
    const geo = keep(new BufferGeometry());
    geo.setAttribute("position", new Float32BufferAttribute(pts, 3));
    const color = new Color(LINK_COLOR[kind]);
    const opacity = on === "1" ? 0.62 : 0.13;
    const mat: Material =
      kind === "cuc" || kind === "bien"
        ? keep(new LineDashedMaterial({ color, transparent: true, opacity, depthTest: false, dashSize: kind === "cuc" ? 3 : 1, gapSize: kind === "cuc" ? 2 : 1.6 }))
        : keep(new LineBasicMaterial({ color, transparent: true, opacity, depthTest: false }));
    const lines = new LineSegments(geo, mat);
    if (kind === "cuc" || kind === "bien") lines.computeLineDistances();
    lines.renderOrder = 2;
    wheel.add(lines);
  }

  // Ô hệ
  for (const e of Object.keys(ELEMENT_STYLE) as Element[]) {
    const tex = keep(loader.load(assetUrl(`he/${e}`)));
    tex.magFilter = NearestFilter;
    tex.minFilter = NearestFilter;
    tex.generateMipmaps = false;
    const on = lit.has(e);
    const m = shader(NODE_FS, {
      uIcon: { value: tex },
      uEdge: { value: rgb(ELEMENT_STYLE[e].color) },
      uPaper: { value: rgb(PAPER) },
      uHalo: { value: rgb(ACCENT) },
      uOn: { value: on ? 1 : 0 },
      uAlpha: { value: on ? 1 : 0.42 },
      uT,
    });
    const s = NODE_R * 1.6 * 2;
    const node = new Mesh(keep(new PlaneGeometry(s, s)), m);
    const [x, y] = P(e);
    node.position.set(x, y, on ? 6 : 3);
    node.renderOrder = on ? 4 : 3;
    wheel.add(node);
  }

  // Vũng sáng dưới chân và hạt linh khí (không thuộc vòng, không lắc theo vòng)
  const rootColors = (roots.length ? roots : (["kim"] as Element[])).map((e) => rgb(ELEMENT_STYLE[e].color));
  const warm = rgb("#f2c230");
  const poolColor = rootColors[0].map((c, i) => c * 0.55 + warm[i] * 0.45);
  const pool = new Mesh(keep(new PlaneGeometry(1, 1)), shader(POOL_FS, { uC: { value: poolColor } }));
  pool.renderOrder = 5;
  scene.add(pool);

  const rnd = rand(roots.join("").length * 7919 + 17);
  const seeds: number[] = [];
  const colors: number[] = [];
  for (let i = 0; i < PARTICLES; i++) {
    seeds.push((rnd() * 2 - 1) * 58, 0.08 + rnd() * 0.14, rnd(), 2 + rnd() * 3.2);
    colors.push(...rootColors[i % rootColors.length]);
  }
  const dustGeo = keep(new BufferGeometry());
  // Points cần position; vị trí thật tính trong vertex shader.
  dustGeo.setAttribute("position", new Float32BufferAttribute(new Array(PARTICLES * 3).fill(0), 3));
  dustGeo.setAttribute("aSeed", new Float32BufferAttribute(seeds, 4));
  dustGeo.setAttribute("aColor", new Float32BufferAttribute(colors, 3));
  const uDpr = { value: 1 };
  const uFoot = { value: -FOOT };
  const uH = { value: 210 };
  const dust = new Points(dustGeo, shader(DUST_FS, { uT, uH, uFoot, uDpr }, DUST_VS));
  dust.frustumCulled = false;
  dust.renderOrder = 6;
  scene.add(dust);

  let px = 0;
  let py = 0;
  return {
    resize(w, h, dpr) {
      camera.aspect = w / h;
      camera.position.set(0, 0, h / 2 / Math.tan((FOV * Math.PI) / 360));
      camera.updateProjectionMatrix();
      const k = Math.min(w, WHEEL_MAX) / (2 * C);
      wheel.scale.setScalar(k);
      pool.scale.set(Math.min(w * 0.7, 230), 46, 1);
      pool.position.set(0, -FOOT + 4, 20);
      uDpr.value = dpr;
    },
    pointer(x, y) {
      px = x;
      py = y;
    },
    render(renderer: WebGLRenderer, target: WebGLRenderTarget | null, t: number) {
      uT.value = t;
      // Nghiêng ra sau cho có chiều sâu, lắc nhẹ theo thời gian và theo con trỏ.
      wheel.rotation.x = -0.2 + py * 0.06;
      wheel.rotation.y = Math.sin(t * 0.22) * 0.14 + px * 0.1;
      enso.rotation.z = t * 0.03;
      renderer.setRenderTarget(target);
      renderer.setClearColor(0x000000, 0);
      renderer.clear(true, true, true);
      renderer.render(scene, camera);
    },
    dispose() {
      for (const x of owned) x.dispose();
      owned.length = 0;
    },
  };
}

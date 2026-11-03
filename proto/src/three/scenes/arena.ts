// Nền sân đấu nhiều lớp cho màn Trận: cảnh 3D thật nhìn từ camera trực giao nghiêng 32° (thấy mặt bên của cột,
// vách đá), nên toạ độ trên sân vẫn thẳng hàng với trục 12 ô mà màn Trận vẽ người lên. Hai lớp:
//   back: mặt sân, vật hai bên làn, bóng đổ, vách và biển mây phía dưới (cao nguyên);
//   front: lớp phủ trong suốt ở mép khung (cành, nhũ đá, mây, khói, viền tối), vẽ sau người.
// Trục sân luôn khớp cạnh dài: ngang thì đội A trái, đội B phải; đứng thì đội A dưới, đội B trên. Lane-local (l, c):
// l chạy dọc trục sân từ -6 tới 6 (mỗi ô 1 đơn vị), c chạy ngang làn.
import {
  BoxGeometry,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  DoubleSide,
  ExtrudeGeometry,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  OctahedronGeometry,
  OrthographicCamera,
  PlaneGeometry,
  Quaternion,
  Scene,
  ShaderMaterial,
  Shape,
  Vector3,
  type WebGLRenderer,
  type WebGLRenderTarget,
} from "three";
import type { ArenaKind } from "../types.ts";
import * as G from "../engine/glsl.ts";
import type { Host } from "../engine/host.ts";
import { mist, particles, setAdditiveOne, vignette } from "../engine/layers.ts";
import { hashSeed, rng } from "../engine/noise.ts";
import type { Program } from "../engine/program.ts";
import { deadTree, pine, place, poly } from "../engine/props.ts";
import { col, Stage } from "../engine/stage.ts";

const LANE = 12;
const TILT = (32 * Math.PI) / 180;

// ---- shader 3D -----------------------------------------------------------------------------------------------------

const WORLD_VERT = /* glsl */ `
varying vec3 vW;
varying vec3 vN;
varying vec3 vC;
void main() {
  vec4 p = vec4(position, 1.0);
  vec3 n = normal;
  #ifdef USE_INSTANCING
  p = instanceMatrix * p;
  n = mat3(instanceMatrix) * n;
  #endif
  #ifdef USE_INSTANCING_COLOR
  vC = instanceColor;
  #else
  vC = vec3(1.0);
  #endif
  vec4 w = modelMatrix * p;
  vW = w.xyz;
  vN = normalize(mat3(modelMatrix) * n);
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

const LIGHT = /* glsl */ `
uniform vec3 uLight;
uniform vec3 uLightCol;
uniform vec3 uSky;
uniform vec3 uGround;
uniform float uVertical;
uniform vec2 uHalf;
varying vec3 vW;
varying vec3 vN;
varying vec3 vC;
vec2 lane(vec3 w) { return uVertical > 0.5 ? vec2(-w.z, w.x) : vec2(w.x, w.z); }
vec3 shade(vec3 base, vec3 n) {
  float d = max(dot(n, uLight), 0.0);
  float hemi = n.y * 0.5 + 0.5;
  return base * (mix(uGround, uSky, hemi) + uLightCol * d);
}
// Vũng sáng giữa sân, mép tối dần: dồn mắt vào làn đánh.
float pool(vec2 p) {
  vec2 q = p / vec2(LANE_HALF * 1.25, uHalf.y * 1.6);
  return 0.72 + 0.38 * exp(-dot(q, q) * 1.6);
}
`.replace(/LANE_HALF/g, (LANE / 2).toFixed(1));

/** Mặt sân và vách: kind 0 võ trường (đá lát so le, vòng khắc, vạch giữa), 1 mỏ (đất nện, sỏi, ray), 2 cao nguyên (cỏ, lối đất). */
const DECK_FRAG = G.NOISE + LIGHT + /* glsl */ `
uniform float uKind;
uniform vec3 uA;
uniform vec3 uB;
uniform vec3 uC;
uniform vec3 uSide;
vec3 top(vec2 p) {
  vec3 col;
  if (uKind < 0.5) {
    float row = floor(p.y);
    vec2 q = vec2(p.x + mod(row, 2.0) * 0.5, p.y);
    vec2 id = floor(q);
    vec2 f = fract(q);
    float e = min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y));
    float grout = smoothstep(0.012, 0.05, e);
    float h = hash12(id + 3.1);
    vec3 stone = mix(uA, uB, h * 0.55 + nB(p * 0.6) * 0.45);
    stone *= 0.82 + 0.3 * nR(p * 0.06);
    float crack = (1.0 - smoothstep(0.0, 0.018, abs(nG(p * 0.4 + id * 0.13) - 0.5))) * step(0.72, h);
    col = mix(stone * 0.42, stone, grout) * (1.0 - crack * 0.35);
    float bevel = smoothstep(0.05, 0.12, e);
    col *= 0.94 + 0.06 * bevel;
    float r = length(p);
    float ring = 1.0 - smoothstep(0.025, 0.06, abs(r - 1.9));
    float ring2 = 1.0 - smoothstep(0.015, 0.04, abs(r - 2.25));
    float ang = atan(p.y, p.x);
    float ticks = (1.0 - smoothstep(0.02, 0.05, abs(r - 2.07))) * step(0.92, abs(cos(ang * 4.0)));
    float mid = 1.0 - smoothstep(0.03, 0.06, abs(p.x));
    float carve = max(max(ring, ring2 * 0.8), max(ticks, mid * (1.0 - smoothstep(1.85, 1.95, r) * 0.0)));
    col = mix(col, col * 0.45 + uC * 0.12, carve);
    float curb = smoothstep(uHalf.y - 0.45, uHalf.y - 0.4, abs(p.y));
    col = mix(col, uB * 0.8, curb * 0.6);
  } else if (uKind < 1.5) {
    float n = nR(p * 0.12) * 0.55 + nB(p * 1.3) * 0.45;
    col = mix(uB, uA, n);
    vec2 id = floor(p * 3.0);
    float peb = step(0.86, hash12(id)) * (1.0 - smoothstep(0.18, 0.32, length(fract(p * 3.0) - 0.5)));
    col = mix(col, uA * 1.25, peb * 0.5);
    float wear = exp(-pow(p.y / (uHalf.y * 0.55), 2.0));
    col = mix(col, uA * 1.15, wear * 0.25);
    float railC = uHalf.y - 0.55;
    float rails = (1.0 - smoothstep(0.02, 0.045, abs(abs(p.y) - railC - 0.22))) + (1.0 - smoothstep(0.02, 0.045, abs(abs(p.y) - railC + 0.22)));
    float sleeper = step(abs(abs(p.y) - railC), 0.34) * step(fract(p.x * 1.6), 0.35);
    col = mix(col, uB * 0.55, sleeper * 0.8);
    col = mix(col, vec3(0.55, 0.58, 0.6), clamp(rails, 0.0, 1.0) * 0.85);
    float shard = step(0.965, hash12(floor(p * 5.0) + 7.0)) * (1.0 - smoothstep(0.05, 0.2, length(fract(p * 5.0) - 0.5)));
    col += uC * shard * 0.9;
  } else {
    float n = nR(p * 0.1) * 0.5 + nG(p * 0.45) * 0.3 + nB(p * 2.2) * 0.2;
    col = mix(uB, uA, n);
    float blades = nB(p * vec2(2.5, 9.0)) * 0.5 + nB(p * vec2(9.0, 2.5) + 0.3) * 0.5;
    col *= 0.85 + 0.3 * blades;
    float path = exp(-pow(p.y / 0.9, 2.0)) * (0.6 + 0.4 * nR(p * 0.3));
    col = mix(col, uC, path * 0.55);
    float rock = smoothstep(0.78, 0.84, nA(p * 0.18));
    col = mix(col, uSide * 1.1, rock * 0.7);
  }
  return col;
}
void main() {
  vec3 n = normalize(vN);
  vec2 p = lane(vW);
  vec3 col;
  if (n.y > 0.5) {
    col = top(p) * pool(p);
  } else {
    float along = uVertical > 0.5 ? (abs(n.x) > 0.5 ? vW.z : vW.x) : (abs(n.z) > 0.5 ? vW.x : vW.z);
    float strata = nG(vec2(along * 0.25, vW.y * 0.9)) * 0.6 + nB(vec2(along * 1.4, vW.y * 2.5)) * 0.4;
    col = uSide * (0.65 + 0.55 * strata);
    col *= 1.0 - smoothstep(0.45, 0.6, fract(vW.y * (uKind < 0.5 ? 2.5 : 0.6) + strata * 0.5)) * 0.25;
    col *= smoothstep(-14.0, -0.5, vW.y) * 0.6 + 0.4;
  }
  gl_FragColor = vec4(shade(col * vC, n), 1.0);
}
`;

/** Đất ngoài sân: vườn cỏ (võ trường), vách mỏ có mạch linh thạch (mỏ), biển mây dưới vực (cao nguyên). */
const GROUND_FRAG = G.NOISE + LIGHT + /* glsl */ `
uniform float uKind;
uniform vec3 uA;
uniform vec3 uB;
uniform vec3 uC;
void main() {
  vec2 p = lane(vW);
  vec3 col;
  if (uKind < 0.5) {
    float n = nR(p * 0.15) * 0.6 + nB(p * 1.8) * 0.4;
    col = mix(uB, uA, n);
    float gravel = smoothstep(0.55, 0.75, nG(p * 0.5));
    col = mix(col, uC, gravel * 0.5);
  } else if (uKind < 1.5) {
    float n = nR(p * 0.2) * 0.6 + nB(p * 2.0) * 0.4;
    col = mix(uB, uA, n);
    float vein = 1.0 - smoothstep(0.0, 0.03, abs(nG(p * 0.22) - 0.5));
    float vein2 = 1.0 - smoothstep(0.0, 0.02, abs(nA(p * 0.4 + 0.3) - 0.5));
    col += uC * (vein * 0.9 + vein2 * 0.5) * smoothstep(0.3, 0.7, nR(p * 0.08 + 0.5));
  } else {
    vec2 q = p * 0.05;
    float n = nR(q + 0.3) * 0.55 + nG(q * 2.3) * 0.3 + nB(q * 6.0) * 0.15;
    col = mix(uB, uA, smoothstep(0.25, 0.8, n));
    col = mix(col, uC, smoothstep(0.7, 0.95, n) * 0.5);
    // biển mây tự sáng, chỉ tối đi trong bóng vách cao nguyên
    vec2 d = max(abs(p) - uHalf, 0.0);
    col *= 1.0 - exp(-length(d) * 0.35) * 0.3;
    gl_FragColor = vec4(col, 1.0);
    return;
  }
  gl_FragColor = vec4(shade(col, vec3(0.0, 1.0, 0.0)) * pool(p), 1.0);
}
`;

const PROP_FRAG = LIGHT + /* glsl */ `
uniform vec3 uColor;
uniform float uEmissive;
void main() {
  vec3 n = normalize(vN);
  vec3 base = uColor * vC;
  vec3 c = shade(base, n) * (0.85 + 0.15 * smoothstep(-1.0, 3.0, vW.y)) + base * uEmissive;
  gl_FragColor = vec4(c, 1.0);
}
`;

const SHADOW_FRAG = /* glsl */ `
uniform float uAlpha;
varying vec2 vP;
void main() {
  float r = length(vP) * 2.0;
  gl_FragColor = vec4(0.0, 0.0, 0.0, uAlpha * smoothstep(1.0, 0.2, r));
}
`;

const HALO_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uAlpha;
varying vec2 vP;
void main() {
  float r = length(vP) * 2.0;
  gl_FragColor = vec4(uColor * uAlpha * pow(max(0.0, 1.0 - r), 2.0), 0.0);
}
`;

// ---- bảng màu từng sân ---------------------------------------------------------------------------------------------

interface ArenaStyle {
  kind: number;
  light: string;
  sky: string;
  groundAmb: string;
  deck: [string, string, string];
  side: string;
  outside: [string, string, string];
  /** Mặt sân cao bao nhiêu so với đất ngoài; cao nguyên là vách vực. */
  height: number;
  /** Phần bề ngang làn mà mặt sân chiếm. */
  cross: number;
}

const STYLES: Record<ArenaKind, ArenaStyle> = {
  vo_truong: {
    kind: 0, light: "#f3dcae", sky: "#6d6a73", groundAmb: "#3a2c20",
    deck: ["#b5a58c", "#7d7062", "#b02a20"], side: "#6b5f52",
    outside: ["#4b5a2f", "#2c3a1e", "#8a7d68"], height: 0.45, cross: 0.74,
  },
  mo_linh_thach: {
    kind: 1, light: "#9fd8e8", sky: "#2a3a48", groundAmb: "#120f14",
    deck: ["#6b5a4a", "#3e3329", "#5ff0e0"], side: "#3a3230",
    outside: ["#35303a", "#17141b", "#4ff0e4"], height: 0.0, cross: 0.7,
  },
  cao_nguyen: {
    kind: 2, light: "#ffe2b0", sky: "#8aa0b8", groundAmb: "#3a3020",
    deck: ["#7d8a3e", "#4c5a26", "#a08a5c"], side: "#7a6a58",
    outside: ["#f4ede2", "#9aa6b8", "#f6d0a8"], height: 14, cross: 0.68,
  },
};

// ---- chương trình 3D (lớp back) ------------------------------------------------------------------------------------

class ArenaBack implements Program {
  readonly animated = false;
  private scene = new Scene();
  private camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 400);
  private host: Host;
  private kind: ArenaKind;
  private vertical: boolean;
  private seed: number;
  private built = "";

  constructor(host: Host, kind: ArenaKind, vertical: boolean, seed: number) {
    this.host = host;
    this.kind = kind;
    this.vertical = vertical;
    this.seed = seed;
  }

  /** (l, c) theo làn → (x, z) thế giới. */
  private w(l: number, c: number): [number, number] {
    return this.vertical ? [c, -l] : [l, c];
  }

  resize(w: number, h: number, _dpr: number): void {
    const cam = this.camera;
    let fw: number;
    let fh: number;
    if (this.vertical) {
      fh = LANE * Math.cos(TILT);
      fw = (fh * w) / h;
    } else {
      fw = LANE;
      fh = (LANE * h) / w;
    }
    cam.left = -fw / 2;
    cam.right = fw / 2;
    cam.top = fh / 2;
    cam.bottom = -fh / 2;
    cam.position.set(0, 100 * Math.cos(TILT), 100 * Math.sin(TILT));
    cam.lookAt(0, 0, 0);
    cam.updateProjectionMatrix();
    // nửa bề ngang làn thấy được: màn đứng là nửa bề rộng khung; màn ngang là nửa chiều cao chia cos(nghiêng)
    const crossVis = this.vertical ? fw / 2 : fh / 2 / Math.cos(TILT);
    const key = `${crossVis.toFixed(3)}`;
    if (key !== this.built) {
      this.build(crossVis);
      this.built = key;
    }
  }

  private uniforms(style: ArenaStyle, halfCross: number, extra: Record<string, unknown>): Record<string, { value: unknown }> {
    const light = new Vector3(-0.45, 1, 0.55).normalize();
    const u: Record<string, { value: unknown }> = {
      uNoise: { value: this.host.noiseTex },
      uTime: { value: 0 },
      uSpan: { value: 1 },
      uAspect: { value: 1 },
      uFlash: { value: 0 },
      uLight: { value: light },
      uLightCol: { value: col(style.light).multiplyScalar(0.75) },
      uSky: { value: col(style.sky).multiplyScalar(0.55) },
      uGround: { value: col(style.groundAmb).multiplyScalar(0.6) },
      uVertical: { value: this.vertical ? 1 : 0 },
      uHalf: { value: [LANE / 2 + 2, halfCross] },
    };
    for (const [k, v] of Object.entries(extra)) u[k] = { value: v };
    return u;
  }

  private build(crossVis: number): void {
    this.dispose();
    this.scene = new Scene();
    const st = STYLES[this.kind];
    const r = rng(hashSeed("arena", this.kind, this.seed));
    const half = crossVis * st.cross;
    const deckU = (extra: Record<string, unknown> = {}) => this.uniforms(st, half, extra);
    const mat = (frag: string, extra: Record<string, unknown>, opts: Partial<ShaderMaterial> = {}) =>
      Object.assign(new ShaderMaterial({ uniforms: deckU(extra), vertexShader: WORLD_VERT, fragmentShader: frag }), opts);

    // đất ngoài sân (cao nguyên: biển mây dưới vực)
    const groundY = this.kind === "cao_nguyen" ? -st.height : this.kind === "vo_truong" ? -st.height : 0;
    const ground = new Mesh(new PlaneGeometry(200, 200).rotateX(-Math.PI / 2), mat(GROUND_FRAG, { uKind: st.kind, uA: col(st.outside[0]), uB: col(st.outside[1]), uC: col(st.outside[2]) }));
    ground.position.y = groundY;
    this.scene.add(ground);

    // mặt sân: khối đùn từ đường viền (cao nguyên viền lởm chởm theo nhiễu)
    if (this.kind !== "mo_linh_thach") {
      const shape = new Shape();
      const L = LANE / 2 + 6;
      const pts: [number, number][] = [];
      const jag = this.kind === "cao_nguyen" ? 0.55 : 0;
      const n = 80;
      for (let i = 0; i <= n; i++) pts.push([-L + (2 * L * i) / n, half + (jag ? (this.host.noise.sample(i * 0.031 + 0.2, 0.37, 1) - 0.5) * jag * 2 : 0)]);
      for (let i = 0; i <= n; i++) pts.push([L - (2 * L * i) / n, -half - (jag ? (this.host.noise.sample(i * 0.029 + 0.6, 0.71, 1) - 0.5) * jag * 2 : 0)]);
      pts.forEach(([l, c], i) => {
        const [x, z] = this.w(l, c);
        if (i === 0) shape.moveTo(x, z);
        else shape.lineTo(x, z);
      });
      const geo = new ExtrudeGeometry(shape, { depth: st.height, bevelEnabled: false, steps: 1 });
      geo.rotateX(Math.PI / 2);
      geo.computeVertexNormals();
      const deck = new Mesh(geo, mat(DECK_FRAG, { uKind: st.kind, uA: col(st.deck[0]), uB: col(st.deck[1]), uC: col(st.deck[2]), uSide: col(st.side) }));
      this.scene.add(deck);
    } else {
      // làn là nền đất nện (khối mỏng có mép), ngoài làn là nền đá có mạch linh thạch (ground)
      const geo = new BoxGeometry(...(this.vertical ? [half * 2, 0.3, 60] : [60, 0.3, half * 2]) as [number, number, number]);
      const floor = new Mesh(geo, mat(DECK_FRAG, { uKind: st.kind, uA: col(st.deck[0]), uB: col(st.deck[1]), uC: col(st.deck[2]), uSide: col(st.side) }));
      floor.position.y = -0.15 + 0.001;
      this.scene.add(floor);
    }

    this.props(st, half, crossVis, r);
  }

  /** Đặt một vật ở (l, c) lane-local. */
  private put(mesh: Mesh, l: number, c: number, y = 0): Mesh {
    const [x, z] = this.w(l, c);
    mesh.position.set(x, y, z);
    this.scene.add(mesh);
    return mesh;
  }

  private propMat(color: string, emissive = 0, st: ArenaStyle, half: number): ShaderMaterial {
    return new ShaderMaterial({ uniforms: this.uniforms(st, half, { uColor: col(color), uEmissive: emissive }), vertexShader: WORLD_VERT, fragmentShader: PROP_FRAG });
  }

  private shadow(l: number, c: number, y: number, size: number, alpha = 0.45): void {
    const m = new ShaderMaterial({ uniforms: { uAlpha: { value: alpha } }, vertexShader: G.QUAD_VERT, fragmentShader: SHADOW_FRAG, transparent: true, depthWrite: false });
    m.polygonOffset = true;
    m.polygonOffsetFactor = -2;
    const g = new PlaneGeometry(size * 1.5, size).rotateX(-Math.PI / 2);
    const mesh = new Mesh(g, m);
    // bóng lệch theo hướng ngược nguồn sáng (nguồn ở trên trái phía trước)
    const [x, z] = this.w(l, c);
    mesh.position.set(x + size * 0.25, y + 0.01, z - size * 0.18);
    this.scene.add(mesh);
  }

  private halo(l: number, c: number, y: number, size: number, color: string, alpha: number): void {
    const m = new ShaderMaterial({ uniforms: { uColor: { value: col(color) }, uAlpha: { value: alpha } }, vertexShader: G.QUAD_VERT, fragmentShader: HALO_FRAG, transparent: true, depthWrite: false });
    setAdditiveOne(m);
    const mesh = new Mesh(new PlaneGeometry(size, size).rotateX(-Math.PI / 2), m);
    const [x, z] = this.w(l, c);
    mesh.position.set(x, y + 0.02, z);
    this.scene.add(mesh);
  }

  private props(st: ArenaStyle, half: number, crossVis: number, r: () => number): void {
    const sides = [-1, 1];
    const edge = half + (crossVis - half) * 0.5;
    if (this.kind === "vo_truong") {
      const stone = this.propMat("#9c917f", 0, st, half);
      const dark = this.propMat("#5d554b", 0, st, half);
      const lamp = this.propMat("#ffd27a", 0.9, st, half);
      const red = this.propMat("#a3271c", 0.05, st, half);
      const wood = this.propMat("#4a3020", 0, st, half);
      const leaf = this.propMat("#2b4426", 0, st, half);
      const gy = -st.height;
      for (const sd of sides) {
        // đèn đá ở hai đầu và giữa, cột cờ đỏ xen giữa
        for (const l of [-5.2, 0, 5.2]) {
          const c = sd * (half + 0.55);
          this.put(new Mesh(new BoxGeometry(0.55, 0.14, 0.55), stone), l, c, gy + 0.07);
          this.put(new Mesh(new CylinderGeometry(0.09, 0.11, 0.55, 8), stone), l, c, gy + 0.42);
          this.put(new Mesh(new BoxGeometry(0.38, 0.28, 0.38), lamp), l, c, gy + 0.83);
          const roofM = new Mesh(new ConeGeometry(0.42, 0.24, 4), dark);
          roofM.rotation.y = Math.PI / 4;
          this.put(roofM, l, c, gy + 1.09);
          this.shadow(l, c, gy, 0.8);
          this.halo(l, c, gy, 2.2, "#ffb64a", 0.35);
        }
        for (const l of [-2.6, 2.6]) {
          const c = sd * (half + 0.45);
          this.put(new Mesh(new CylinderGeometry(0.05, 0.06, 2.6, 6), wood), l, c, gy + 1.3);
          const flag = new Mesh(new PlaneGeometry(0.62, 1.3), red);
          flag.material.side = DoubleSide;
          this.put(flag, l + 0.34, c, gy + 1.85);
          this.shadow(l, c, gy, 0.5, 0.35);
        }
        // thông trong vườn ngoài sân
        for (let i = 0; i < 7; i++) {
          const l = -7 + i * 2.3 + (r() - 0.5);
          const c = sd * (edge + 0.4 + r() * 0.8);
          const hgt = 1.2 + r() * 0.9;
          for (let k = 0; k < 3; k++) this.put(new Mesh(new ConeGeometry(0.55 - k * 0.12, 0.6, 7), leaf), l, c, gy + hgt * 0.45 + k * 0.38);
          this.put(new Mesh(new CylinderGeometry(0.05, 0.07, hgt * 0.5, 5), wood), l, c, gy + hgt * 0.25);
          this.shadow(l, c, gy, 1.3, 0.4);
        }
      }
      // bậc đá ở hai đầu sân (mép làn)
      for (const sd of sides) for (let k = 0; k < 3; k++) this.put(new Mesh(new BoxGeometry(...(this.vertical ? [1.6 + k * 0.3, 0.15, 0.3] : [0.3, 0.15, 1.6 + k * 0.3]) as [number, number, number]), stone), 0, sd * (half + 0.15 + k * 0.3), -0.07 - k * 0.15);
    } else if (this.kind === "mo_linh_thach") {
      const rock = this.propMat("#4a4248", 0, st, half);
      const wood = this.propMat("#5a3a22", 0, st, half);
      // vách đá hai bên làn
      const rocks = new InstancedMesh(new DodecahedronGeometry(1, 0), rock, 80);
      const m4 = new Matrix4();
      const q = new Quaternion();
      let ri = 0;
      for (const sd of sides) {
        for (let i = 0; i < 26; i++) {
          const l = -8 + i * 0.65 + (r() - 0.5) * 0.4;
          const c = sd * (half + 0.4 + r() * (crossVis - half + 0.6));
          const s = 0.35 + r() * 0.6;
          const [x, z] = this.w(l, c);
          q.setFromAxisAngle(new Vector3(r(), r(), r()).normalize(), r() * 3);
          m4.compose(new Vector3(x, s * 0.3, z), q, new Vector3(s * (1 + r() * 0.6), s * (0.7 + r() * 0.5), s));
          rocks.setMatrixAt(ri, m4);
          rocks.setColorAt(ri, new Color().setRGB(0.75 + r() * 0.4, 0.75 + r() * 0.35, 0.8 + r() * 0.3));
          ri++;
        }
      }
      rocks.count = ri;
      this.scene.add(rocks);
      // cụm linh thạch tự sáng
      const crystal = this.propMat("#5ff0e0", 0.85, st, half);
      const cr = new InstancedMesh(new OctahedronGeometry(1, 0), crystal, 90);
      let ci = 0;
      for (const sd of sides) {
        for (const l of [-5.5, -2.2, 1.2, 4.6]) {
          const lc = l + (r() - 0.5) * 1.2;
          const cc = sd * (half + 0.3 + r() * 0.4);
          const n = 4 + Math.floor(r() * 4);
          for (let k = 0; k < n; k++) {
            const [x, z] = this.w(lc + (r() - 0.5) * 0.7, cc + (r() - 0.5) * 0.5);
            const hgt = 0.35 + r() * 0.75;
            q.setFromAxisAngle(new Vector3((r() - 0.5) * 0.8, 1, (r() - 0.5) * 0.8).normalize(), r() * 3);
            const tilt = new Quaternion().setFromAxisAngle(new Vector3(r() - 0.5, 0, r() - 0.5).normalize(), (r() - 0.5) * 0.9);
            m4.compose(new Vector3(x, hgt * 0.5, z), tilt.multiply(q), new Vector3(0.12 + r() * 0.08, hgt, 0.12 + r() * 0.08));
            cr.setMatrixAt(ci, m4);
            const t = r();
            cr.setColorAt(ci, new Color().setRGB(0.6 + t * 0.5, 0.9 + t * 0.1, 0.85 + (1 - t) * 0.2));
            ci++;
          }
          this.halo(lc, cc, 0, 3.2, "#3fe0d0", 0.55);
        }
      }
      cr.count = ci;
      this.scene.add(cr);
      // cột gỗ chống hầm dọc hai mép làn (không bắc xà ngang làn để khỏi che người)
      for (const l of [-6, -2, 2, 6]) {
        for (const sd of sides) {
          this.put(new Mesh(new BoxGeometry(0.2, 2.2, 0.2), wood), l, sd * (half + 0.2), 1.1);
          this.put(new Mesh(new BoxGeometry(...(this.vertical ? [0.7, 0.18, 0.2] : [0.2, 0.18, 0.7]) as [number, number, number]), wood), l, sd * (half + 0.45), 2.1);
          this.shadow(l, sd * (half + 0.2), 0, 0.6, 0.4);
        }
      }
    } else {
      const rock = this.propMat("#857766", 0, st, half);
      const moss = this.propMat("#55663a", 0, st, half);
      const wood = this.propMat("#4a3a2a", 0, st, half);
      const leaf = this.propMat("#3a5a2e", 0, st, half);
      for (const sd of sides) {
        for (let i = 0; i < 6; i++) {
          const l = -6.5 + i * 2.6 + (r() - 0.5) * 1.2;
          const c = sd * (half - 0.35 - r() * 0.3);
          const s = 0.25 + r() * 0.35;
          const m = new Mesh(new DodecahedronGeometry(s, 0), r() < 0.5 ? rock : moss);
          m.rotation.set(r() * 3, r() * 3, r() * 3);
          m.scale.y = 0.6;
          this.put(m, l, c, s * 0.25);
          this.shadow(l, c, 0, s * 2.4, 0.35);
        }
        // đá dựng và cây lệch gió ở mép vực
        for (const l of [-4.2, 3.6]) {
          const lc = l * (sd > 0 ? 1 : -0.8);
          const c = sd * (half - 0.25);
          const m = new Mesh(new BoxGeometry(0.32, 1.25, 0.24), rock);
          m.rotation.y = r();
          this.put(m, lc, c, 0.62);
          this.shadow(lc, c, 0, 1.0, 0.4);
        }
        const tl = sd * 5.4;
        const tc = sd * (half - 0.6);
        this.put(new Mesh(new CylinderGeometry(0.06, 0.09, 1.1, 5), wood), tl, tc, 0.55);
        const crown = new Mesh(new IcosahedronGeometry(0.62, 0), leaf);
        crown.scale.set(1.3, 0.55, 1);
        this.put(crown, tl + 0.3, tc, 1.2);
        this.shadow(tl, tc, 0, 1.6, 0.4);
      }
    }
  }

  render(r: WebGLRenderer, target: WebGLRenderTarget | null): void {
    r.setRenderTarget(target);
    r.setClearColor(0x000000, 1);
    r.clear(true, true, true);
    r.render(this.scene, this.camera);
  }

  dispose(): void {
    this.scene.traverse((o) => {
      const m = o as Mesh;
      (m.geometry as BufferGeometry | undefined)?.dispose();
      const mat = m.material;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else mat?.dispose();
    });
  }
}

// ---- lớp front (2D, trong suốt) ------------------------------------------------------------------------------------

function arenaFront(host: Host, kind: ArenaKind, vertical: boolean, seed: number): Stage {
  const s = new Stage(host, `arena-front|${kind}|${seed}`);
  s.transparent = true;
  s.animated = false;
  // Cành, cây khô ở góc: co theo cạnh ngắn của khung để màn đứng hẹp không bị che làn.
  const corner = (b: ReturnType<typeof pine>, color: string, fx: number, fy: number, scale: number, rot: number, flip: boolean) => {
    const p = place(s, b, { color, scale, depth: 1, flip });
    (p.body.material as ShaderMaterial).uniforms.uOpacity.value = 0.92;
    s.onResize((a) => {
      const k = scale * Math.min(1, a);
      p.body.scale.set(flip ? -k : k, k, 1);
      p.at((fx * a) / 2, fy, rot);
    });
  };
  if (kind === "vo_truong") {
    corner(pine(s.rand), "#0b0d09", -1.04, 0.9, 0.42, -1.3, false);
    corner(pine(s.rand), "#0b0d09", 1.05, 0.06, 0.38, 1.9, true);
    mist(s, { y0: 0.0, y1: 0.22, color: "#d8cdb8", color2: "#8a7f6c", alpha: 0.28, thresh: 0.3, soft: 0.35 });
    particles(s, { count: 16, area: [-0.5, 0, 0.5, 1], vel: [0, 0], size: 0.008, color: "#ffd9a0", twinkle: 0.5, additive: true, alpha: 0.5 });
    vignette(s, { color: "#0c0906", amt: 0.55 });
  } else if (kind === "mo_linh_thach") {
    // nhũ đá rủ từ mép trên (màn đứng: mép trên là phía đội B)
    for (let i = 0; i < 16; i++) {
      const f = (i + s.rand() * 0.6) / 16;
      const len = 0.04 + s.rand() * 0.1;
      const w = 0.01 + s.rand() * 0.018;
      const b = { body: [poly([[-w, 0.06], [w, 0.06], [w * 0.15, -len], [-w * 0.2, -len * 0.9]])], glow: [] };
      const p = place(s, b, { color: "#08070b", scale: 1, depth: 1 });
      s.onResize((a) => p.at((f * 2 - 1) * (a / 2 + 0.02), 0.985));
    }
    mist(s, { y0: 0.75, y1: 1.05, color: "#1a2a30", color2: "#05080a", alpha: 0.5, thresh: 0.2, soft: 0.4 });
    particles(s, { count: 50, area: [-0.5, 0, 0.5, 1], vel: [0, 0], size: 0.009, color: "#7ff6ea", color2: "#c8fff8", twinkle: 1, additive: true, alpha: 0.8 });
    vignette(s, { color: "#020306", amt: 0.85 });
  } else {
    mist(s, { y0: -0.05, y1: 0.2, color: "#fbf6ee", color2: "#b9c3d2", alpha: 0.55, thresh: 0.25, soft: 0.35, shade: 0.6 });
    mist(s, { y0: 0.82, y1: 1.06, color: "#fbf6ee", color2: "#b9c3d2", alpha: 0.4, thresh: 0.3, soft: 0.35, shade: 0.6 });
    corner(deadTree(s.rand), "#151310", -1.02, 0.66, 0.34, -1.0, false);
    particles(s, { count: 7, area: [-0.4, 0.62, 0.3, 0.9], vel: [0, 0], size: 0.012, color: "#1d1a17", alpha: 0.75 });
    vignette(s, { color: "#0d0b09", amt: 0.4 });
  }
  void vertical;
  s.resize(1, 1, 1);
  return s;
}

export function arenaBackFactory(kind: ArenaKind, vertical: boolean, seed: number) {
  return (host: Host): Program => new ArenaBack(host, kind, vertical, seed);
}

export function arenaFrontFactory(kind: ArenaKind, vertical: boolean, seed: number) {
  return (host: Host): Program => arenaFront(host, kind, vertical, seed);
}

// Cảnh three của Linh trận (màn Nhân vật), gắn bằng mountProgram của lớp three dùng chung. Nền trong suốt: phía sau là
// bóng pháp tướng và núi sương của cột giữa (sau này là nền riêng theo cách tu luyện của phiên three-nen); phía trên là
// lớp nút DOM có hình món đồ. Vẽ: ô lục giác giấy (ô khóa mờ, viền đứt), ô tâm viền son, mạch linh khí phát sáng có xung
// chạy dọc nối hai ô cùng bộ, nét mảnh xanh (tương sinh) và đỏ (tương khắc) giữa hai ô kề.
// File này import three nên chỉ được nạp bằng import() động (từ nhanVat.ts).
import { Mesh, OrthographicCamera, PlaneGeometry, Scene, ShaderMaterial, type WebGLRenderer, type WebGLRenderTarget } from "three";
import type { Host, Program } from "../../three/index.ts";
import { axialToXY, CELLS, hexSize, links, type LinkKind, type TranState } from "../linhTran.ts";

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

const PAPER = rgb("#fffaf0");
const INK = rgb("#2a2018");
const ACCENT = rgb("#b3261e");
const LINK: Record<LinkKind, [number, number, number]> = { mach: rgb("#2f7fd0"), sinh: rgb("#2e7d3c"), khac: rgb("#c0392b") };

const VS = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

// Ô lục giác đỉnh nhọn. uState: 0 khóa, 1 mở trống, 2 có món, 3 ô tâm. uEdge là màu viền nổi (sinh, khắc) nếu uHi > 0.
const CELL_FS = /* glsl */ `
uniform vec3 uPaper;
uniform vec3 uInk;
uniform vec3 uAccent;
uniform vec3 uEdge;
uniform float uHi;
uniform float uState;
uniform float uGlow;
uniform float uT;
uniform float uPx;      // số đơn vị uv mỗi px, để viền luôn khoảng 1 px
varying vec2 vUv;
float hexd(vec2 p) { p = abs(p); return max(p.x, 0.5 * p.x + 0.8660254 * p.y) - 0.8660254; }
void main() {
  vec2 p = (vUv * 2.0 - 1.0) * 1.12;   // r = 1 ở đỉnh ô
  float d = hexd(p);
  float aa = uPx * 1.2;
  float inside = 1.0 - smoothstep(-aa, aa, d + 0.06);
  float edge = (1.0 - smoothstep(0.0, aa * 1.6, abs(d + 0.06)));
  vec4 col = vec4(0.0);
  if (uState < 0.5) {
    // ô khóa: nền rất nhạt, viền đứt
    float ang = atan(p.y, p.x);
    float dash = step(0.5, fract(ang * 9.0 / 6.2831853 * 2.0));
    col = vec4(uPaper, inside * 0.22);
    col = mix(col, vec4(uInk, 0.35), edge * dash);
  } else {
    float fillA = uState > 1.5 ? 0.92 : 0.7;
    col = vec4(uPaper, inside * fillA);
    vec3 e = mix(uInk, uEdge, uHi);
    float ea = mix(0.32, 0.9, uHi);
    if (uState > 2.5) { e = uAccent; ea = 0.85; }
    col = mix(col, vec4(e, ea), edge);
    if (uState > 2.5) {
      float inner = 1.0 - smoothstep(0.0, aa * 1.4, abs(d + 0.2));
      col = mix(col, vec4(uAccent, 0.5), inner);
    }
  }
  // quầng linh khí quanh ô nằm trên mạch
  float halo = uGlow * exp(-max(d, 0.0) * 9.0) * step(-0.02, d) * (0.75 + 0.25 * sin(uT * 2.2));
  col.rgb = mix(col.rgb, vec3(0.38, 0.68, 0.95), halo * (1.0 - col.a));
  col.a = max(col.a, halo * 0.55);
  gl_FragColor = col;
}`;

// Một đoạn nối dài L px, rộng W px: lõi sáng, quầng mềm, xung chạy (mạch), hoặc nét đứt mảnh (sinh, khắc).
const LINK_FS = /* glsl */ `
uniform vec3 uC;
uniform float uKind;    // 0 mạch, 1 sinh, 2 khắc
uniform float uLen;
uniform float uT;
varying vec2 vUv;
void main() {
  float v = abs(vUv.y * 2.0 - 1.0);
  float u = vUv.x;
  if (uKind < 0.5) {
    float core = 1.0 - smoothstep(0.1, 0.24, v);
    float glow = exp(-v * v * 3.0) * 0.6;
    float pulse = pow(0.5 + 0.5 * sin((u * uLen / 18.0 - uT * 1.6) * 6.2831853), 6.0);
    vec3 c = mix(uC, vec3(0.92, 0.97, 1.0), core * (0.4 + 0.6 * pulse));
    gl_FragColor = vec4(c, max(core * 0.95, glow + pulse * glow));
  } else {
    float line = 1.0 - smoothstep(0.12, 0.3, v);
    float dash = step(0.45, fract(u * uLen / 7.0));
    gl_FragColor = vec4(uC, line * dash * 0.85);
  }
}`;

export interface LinhTranProgram extends Program {
  setState(s: TranState): void;
}

export function linhTranScene(_host: Host, initial: TranState): LinhTranProgram {
  const scene = new Scene();
  const camera = new OrthographicCamera(-1, 1, 1, -1, -10, 10);
  const uT = { value: 0 };
  const owned: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(x: T): T => (owned.push(x), x);
  const unit = keep(new PlaneGeometry(1, 1));
  let state = initial;
  let size = 30;

  const cellMats = CELLS.map(() =>
    keep(
      new ShaderMaterial({
        vertexShader: VS,
        fragmentShader: CELL_FS,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        uniforms: {
          uPaper: { value: PAPER },
          uInk: { value: INK },
          uAccent: { value: ACCENT },
          uEdge: { value: INK },
          uHi: { value: 0 },
          uState: { value: 1 },
          uGlow: { value: 0 },
          uT,
          uPx: { value: 0.03 },
        },
      }),
    ),
  );
  const cellMeshes = CELLS.map((_, i) => {
    const m = new Mesh(unit, cellMats[i]);
    m.renderOrder = 2;
    scene.add(m);
    return m;
  });
  let linkMeshes: Mesh[] = [];

  const layout = () => {
    for (const c of CELLS) {
      const { x, y } = axialToXY(c.q, c.r, size);
      const m = cellMeshes[c.id];
      m.position.set(x, -y, 0);
      // quad phủ ô và quầng: cạnh 2 × size × 1.12 (khớp hệ số 1.12 trong shader)
      m.scale.set(size * 2 * 1.12, size * 2 * 1.12, 1);
      (m.material as ShaderMaterial).uniforms.uPx.value = 1 / (size * 1.12);
    }
    rebuildLinks();
  };

  const rebuildLinks = () => {
    for (const m of linkMeshes) {
      scene.remove(m);
      (m.material as ShaderMaterial).dispose();
    }
    linkMeshes = [];
    const ls = links(state);
    const onMach = new Set<number>();
    const hi = new Map<number, LinkKind>();
    for (const l of ls) {
      const A = CELLS[l.a];
      const B = CELLS[l.b];
      const pa = axialToXY(A.q, A.r, size);
      const pb = axialToXY(B.q, B.r, size);
      const dx = pb.x - pa.x;
      const dy = -(pb.y - pa.y);
      const len = Math.hypot(dx, dy);
      const w = l.kind === "mach" ? 18 : 5;
      const mat = new ShaderMaterial({
        vertexShader: VS,
        fragmentShader: LINK_FS,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        uniforms: { uC: { value: LINK[l.kind] }, uKind: { value: l.kind === "mach" ? 0 : l.kind === "sinh" ? 1 : 2 }, uLen: { value: len }, uT },
      });
      const m = new Mesh(unit, mat);
      m.position.set((pa.x + pb.x) / 2, -(pa.y + pb.y) / 2, 0.1);
      m.rotation.z = Math.atan2(dy, dx);
      m.scale.set(len, w, 1);
      m.renderOrder = l.kind === "mach" ? 4 : 3;
      scene.add(m);
      linkMeshes.push(m);
      if (l.kind === "mach") {
        onMach.add(l.a);
        onMach.add(l.b);
      } else {
        if (!hi.has(l.a)) hi.set(l.a, l.kind);
        if (!hi.has(l.b)) hi.set(l.b, l.kind);
      }
    }
    const open = new Set(state.open);
    for (const c of CELLS) {
      const u = cellMats[c.id].uniforms;
      u.uState.value = c.ring === 0 ? 3 : !open.has(c.id) ? 0 : state.items[c.id] ? 2 : 1;
      u.uGlow.value = onMach.has(c.id) ? 1 : 0;
      const k = hi.get(c.id);
      u.uHi.value = k ? 1 : 0;
      u.uEdge.value = k ? LINK[k] : INK;
    }
  };

  return {
    setState(s) {
      state = s;
      rebuildLinks();
    },
    resize(w, h) {
      camera.left = -w / 2;
      camera.right = w / 2;
      camera.top = h / 2;
      camera.bottom = -h / 2;
      camera.updateProjectionMatrix();
      size = hexSize(w, h);
      layout();
    },
    render(renderer: WebGLRenderer, target: WebGLRenderTarget | null, t: number) {
      uT.value = t;
      renderer.setRenderTarget(target);
      renderer.setClearColor(0x000000, 0);
      renderer.clear(true, true, true);
      renderer.render(scene, camera);
    },
    dispose() {
      for (const m of linkMeshes) (m.material as ShaderMaterial).dispose();
      for (const x of owned) x.dispose();
    },
  };
}

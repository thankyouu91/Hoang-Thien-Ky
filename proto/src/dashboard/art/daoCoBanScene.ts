// Cảnh three của Đạo Cơ Bàn (màn Nhân vật), gắn bằng mountProgram của lớp three dùng chung. Nền là cảnh theo tài năng
// "tai_nang:<mã>" của phiên three-nen (loadSceneFactory), vẽ trước trong cùng Program; không có thì nền trong suốt.
// Trên nền: ô lục giác giấy (ô khóa mờ viền đứt, ô có đồ mà chưa thông thì nhạt), ô tâm sáng theo màu hệ của ấn chủ,
// mạch giữa hai ô kề đều thông tô theo loại (Thuần ngà, Sinh lục, Cực tím có xung chạy; Trung xám mảnh), cặp kề tương
// khắc là nét đứt đỏ. Hình món đồ do lớp nút DOM vẽ đè lên. Chỉ nạp bằng import() động (từ nhanVat.ts).
import { Mesh, OrthographicCamera, PlaneGeometry, Scene, ShaderMaterial, type WebGLRenderer, type WebGLRenderTarget } from "three";
import type { Host, Program } from "../../three/index.ts";
import { axialToXY, CELLS, CENTER, hexSize, type BanDraw, type LinkKind } from "../daoCoBan.ts";

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

const PAPER = rgb("#fffaf0");
const INK = rgb("#2a2018");
const ACCENT = rgb("#b3261e");
const LINK: Record<LinkKind, [number, number, number]> = {
  thuan: rgb("#a8842f"),
  sinh: rgb("#2e8b4a"),
  cuc: rgb("#7b4fb0"),
  trung: rgb("#8a7f70"),
  dut: rgb("#c0392b"),
};
/** 0: mạch sáng có xung, 1: nét liền mảnh, 2: nét đứt. */
const LINK_STYLE: Record<LinkKind, number> = { thuan: 0, sinh: 0, cuc: 0, trung: 1, dut: 2 };

const VS = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

// uState: 0 khóa, 1 mở trống, 2 có đồ và thông, 3 ô tâm, 4 có đồ mà chưa thông.
const CELL_FS = /* glsl */ `
uniform vec3 uPaper;
uniform vec3 uInk;
uniform vec3 uAccent;
uniform vec3 uCore;
uniform float uHasCore;
uniform float uState;
uniform float uGlow;
uniform float uT;
uniform float uPx;
varying vec2 vUv;
float hexd(vec2 p) { p = abs(p); return max(p.x, 0.5 * p.x + 0.8660254 * p.y) - 0.8660254; }
void main() {
  vec2 p = (vUv * 2.0 - 1.0) * 1.12;
  float d = hexd(p);
  float aa = uPx * 1.2;
  float inside = 1.0 - smoothstep(-aa, aa, d + 0.06);
  float edge = 1.0 - smoothstep(0.0, aa * 1.6, abs(d + 0.06));
  vec4 col = vec4(0.0);
  if (uState < 0.5) {
    float ang = atan(p.y, p.x);
    float dash = step(0.5, fract(ang * 9.0 / 6.2831853 * 2.0));
    col = vec4(uPaper, inside * 0.45);
    col = mix(col, vec4(uInk, 0.35), edge * dash);
  } else {
    float fillA = uState > 3.5 ? 0.6 : uState > 1.5 ? 0.94 : 0.8;
    col = vec4(uPaper, inside * fillA);
    float ea = uState > 3.5 ? 0.22 : 0.34;
    col = mix(col, vec4(uInk, ea), edge);
    if (uState > 2.5 && uState < 3.5) {
      vec3 c = mix(uAccent, uCore, uHasCore);
      col = mix(col, vec4(uAccent, 0.85), edge);
      float inner = 1.0 - smoothstep(0.0, aa * 1.4, abs(d + 0.2));
      col = mix(col, vec4(uAccent, 0.5), inner);
      // ô tâm sáng theo màu hệ của ấn chủ
      float glow = uHasCore * (1.0 - smoothstep(-0.9, -0.05, d)) * (0.32 + 0.1 * sin(uT * 1.6));
      col.rgb = mix(col.rgb, c, glow);
    }
  }
  float halo = uGlow * exp(-max(d, 0.0) * 9.0) * step(-0.02, d) * (0.75 + 0.25 * sin(uT * 2.2));
  col.rgb = mix(col.rgb, vec3(0.95, 0.86, 0.6), halo * (1.0 - col.a));
  col.a = max(col.a, halo * 0.5);
  gl_FragColor = col;
}`;

const LINK_FS = /* glsl */ `
uniform vec3 uC;
uniform float uStyle;
uniform float uLen;
uniform float uT;
varying vec2 vUv;
void main() {
  float v = abs(vUv.y * 2.0 - 1.0);
  float u = vUv.x;
  if (uStyle < 0.5) {
    float core = 1.0 - smoothstep(0.1, 0.24, v);
    float glow = exp(-v * v * 3.0) * 0.6;
    float pulse = pow(0.5 + 0.5 * sin((u * uLen / 18.0 - uT * 1.6) * 6.2831853), 6.0);
    vec3 c = mix(uC, vec3(1.0, 0.98, 0.92), core * (0.35 + 0.6 * pulse));
    gl_FragColor = vec4(c, max(core * 0.95, glow + pulse * glow));
  } else {
    float line = 1.0 - smoothstep(0.12, 0.3, v);
    float dash = uStyle > 1.5 ? step(0.45, fract(u * uLen / 7.0)) : 1.0;
    gl_FragColor = vec4(uC, line * dash * 0.85);
  }
}`;

export interface DaoCoBanProgram extends Program {
  setDraw(d: BanDraw): void;
}

export function daoCoBanScene(host: Host, initial: BanDraw, bgFactory: ((h: Host) => Program) | null): DaoCoBanProgram {
  const scene = new Scene();
  const camera = new OrthographicCamera(-1, 1, 1, -1, -10, 10);
  const uT = { value: 0 };
  const owned: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(x: T): T => (owned.push(x), x);
  const unit = keep(new PlaneGeometry(1, 1));
  const bg: Program | null = bgFactory ? bgFactory(host) : null;
  let draw = initial;
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
          uCore: { value: ACCENT },
          uHasCore: { value: 0 },
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
  const index = new Map(CELLS.map((c, i) => [c.ma, i]));

  const rebuild = () => {
    for (const m of linkMeshes) {
      scene.remove(m);
      (m.material as ShaderMaterial).dispose();
    }
    linkMeshes = [];
    const glow = new Set<string>();
    for (const l of draw.links) {
      const A = CELLS[index.get(l.a)!];
      const B = CELLS[index.get(l.b)!];
      const pa = axialToXY(A.q, A.r, size);
      const pb = axialToXY(B.q, B.r, size);
      const dx = pb.x - pa.x;
      const dy = -(pb.y - pa.y);
      const len = Math.hypot(dx, dy);
      const style = LINK_STYLE[l.kind];
      const mat = new ShaderMaterial({
        vertexShader: VS,
        fragmentShader: LINK_FS,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        uniforms: { uC: { value: LINK[l.kind] }, uStyle: { value: style }, uLen: { value: len }, uT },
      });
      const m = new Mesh(unit, mat);
      m.position.set((pa.x + pb.x) / 2, -(pa.y + pb.y) / 2, 0.1);
      m.rotation.z = Math.atan2(dy, dx);
      m.scale.set(len, style === 0 ? 18 : 5, 1);
      m.renderOrder = style === 0 ? 4 : 3;
      scene.add(m);
      linkMeshes.push(m);
      if (style === 0) {
        glow.add(l.a);
        glow.add(l.b);
      }
    }
    for (const [i, c] of CELLS.entries()) {
      const u = cellMats[i].uniforms;
      const has = !!draw.pieces[c.ma];
      u.uState.value = c.ma === CENTER ? (draw.open.has(c.ma) ? 3 : 0) : !draw.open.has(c.ma) ? 0 : !has ? 1 : draw.thong.has(c.ma) ? 2 : 4;
      u.uGlow.value = glow.has(c.ma) ? 1 : 0;
      if (c.ma === CENTER) {
        u.uHasCore.value = draw.centerColor ? 1 : 0;
        if (draw.centerColor) u.uCore.value = rgb(draw.centerColor);
      }
    }
  };

  const layout = () => {
    for (const [i, c] of CELLS.entries()) {
      const { x, y } = axialToXY(c.q, c.r, size);
      const m = cellMeshes[i];
      m.position.set(x, -y, 0);
      m.scale.set(size * 2 * 1.12, size * 2 * 1.12, 1);
      cellMats[i].uniforms.uPx.value = 1 / (size * 1.12);
    }
    rebuild();
  };

  return {
    setDraw(d) {
      draw = d;
      rebuild();
    },
    resize(w, h, dpr) {
      bg?.resize(w, h, dpr);
      camera.left = -w / 2;
      camera.right = w / 2;
      camera.top = h / 2;
      camera.bottom = -h / 2;
      camera.updateProjectionMatrix();
      size = hexSize(w, h);
      layout();
    },
    render(renderer: WebGLRenderer, target: WebGLRenderTarget | null, t: number, dt: number) {
      uT.value = t;
      if (bg) {
        // Nền tự xoá và vẽ kín khung; chỉ xoá depth trước khi vẽ bàn.
        bg.render(renderer, target, t, dt);
        renderer.clear(false, true, false);
      } else {
        renderer.setRenderTarget(target);
        renderer.setClearColor(0x000000, 0);
        renderer.clear(true, true, true);
      }
      renderer.render(scene, camera);
    },
    dispose() {
      bg?.dispose();
      for (const m of linkMeshes) (m.material as ShaderMaterial).dispose();
      for (const x of owned) x.dispose();
    },
  };
}

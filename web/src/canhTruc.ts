// Cảnh đầu trang chủ: vườn trúc thủy mặc lắc lư trong gió, giữa-phải là đình uống trà.
// Theo tranh mẫu người dùng gửi 2026-11-05: trúc vẽ MỰC (xám nâu, không xanh), lá đậm hơn thân, có cụm lá rủ từ
// mép trên khung; sương trắng loang che gốc và nhấn chìm các lớp sau; gần như không thấy đường chân trời.
// Là một Program của lớp Three.js dùng chung (proto/src/three): host lo vòng vẽ, thị sai, hạ độ phân giải,
// dừng khi cuộn khuất; ở đây chỉ dựng cảnh và vẽ. Toàn cảnh gộp lại còn it draw call:
//   - Mọi cây trúc là MỘT mesh: thân, đốt, cành, lá merge chung; lắc gió trong vertex shader
//     (phase theo cây, biên độ theo (độ cao)², lá rung thêm nhịp nhanh).
//   - Đình trà: mái cong hai tầng (Lathe), cột son, bàn trà, đèn lồng — Lambert + 2 đèn để có khối.
//   - Ba dải sương trôi ngang và hạt linh khí bay lên.
// Máy không có WebGL thì main.ts giữ tranh SVG tĩnh trong HTML.
import {
  AdditiveBlending,
  Fog,
  AmbientLight,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  Group,
  LatheGeometry,
  Matrix4,
  Mesh,
  MeshLambertMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Points,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  Vector2,
  Vector3,
  type WebGLRenderer,
  type WebGLRenderTarget,
} from "three";
import type { Program } from "../../proto/src/three/engine/program.ts";

/** Bảng màu theo token của website (styles.css); đổi token thì đổi ở đây. */
const PAPER = 0xf6efdf;
const PAPER_HIGH = 0xfbf6ea;
const INK = 0x2a2018;
const SON = 0xb3261e;

function rngFrom(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Gộp hình hộp/trụ... đã nhân ma trận vào mảng đỉnh chung của bụi trúc, kèm màu và tham số gió. */
interface Merge {
  pos: number[];
  col: number[];
  sway: number[]; // (phase cây, biên độ cong, phase lá, biên độ lá)
  idx: number[];
  base: number;
}

function addGeo(m: Merge, geo: BufferGeometry, mat: Matrix4, color: Color, phase: number, bend: (y: number) => number, flutter = 0): void {
  const p = geo.getAttribute("position");
  const v = new Vector3();
  const fp = phase * 2.3 + 1.7;
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).applyMatrix4(mat);
    m.pos.push(v.x, v.y, v.z);
    m.col.push(color.r, color.g, color.b);
    m.sway.push(phase, bend(v.y), fp, flutter);
  }
  const idx = geo.getIndex();
  if (idx) for (let i = 0; i < idx.count; i++) m.idx.push(m.base + idx.getX(i));
  else for (let i = 0; i < p.count; i++) m.idx.push(m.base + i);
  m.base += p.count;
}

const TRUC_VS = `
uniform float uT;
uniform float uGust;
attribute vec3 aColor;
attribute vec4 aSway;
varying vec3 vColor;
varying float vDepth;
void main() {
  vColor = aColor;
  vec3 p = position;
  // Cả cây nghiêng theo gió (biên độ đã nhân (độ cao)² khi dựng), lá rung thêm nhịp nhanh.
  float wind = sin(uT * 0.9 + aSway.x) + 0.5 * sin(uT * 0.37 + aSway.x * 1.3);
  float b = aSway.y * (0.6 + 0.4 * uGust) * wind;
  p.x += b;
  p.z += 0.35 * aSway.y * cos(uT * 0.53 + aSway.x);
  p.x += aSway.w * sin(uT * 3.1 + aSway.z + p.y * 2.0);
  p.y += aSway.w * 0.4 * cos(uT * 2.7 + aSway.z);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}`;
const TRUC_FS = `
precision mediump float;
uniform vec3 uPaper;
varying vec3 vColor;
varying float vDepth;
void main() {
  // Xa thì phai về màu giấy như tranh mực loãng.
  float fog = smoothstep(7.5, 23.0, vDepth) * 0.88;
  gl_FragColor = vec4(mix(vColor, uPaper, fog), 1.0);
}`;

const SUONG_VS = `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const SUONG_FS = `
precision mediump float;
uniform float uT;
uniform float uA;
uniform float uSeed;
varying vec2 vUv;
void main() {
  float x = vUv.x * 5.0 + uT * 0.02 + uSeed;
  float band = sin(x) * 0.5 + 0.3 * sin(x * 2.7 + 1.0) + 0.5;
  float a = smoothstep(0.0, 0.42, vUv.y) * smoothstep(1.0, 0.55, vUv.y) * band * uA;
  gl_FragColor = vec4(1.0, 0.985, 0.955, a);
}`;

/** Lá trúc: hình thoi dài nhọn hai đầu (2 tam giác). */
function laGeometry(dai: number, rong: number): BufferGeometry {
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(new Float32Array([0, 0, 0, dai * 0.45, rong / 2, 0, dai, 0, 0, dai * 0.45, -rong / 2, 0]), 3));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  return g;
}

function discTexture(): CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 32;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, "rgba(255,250,235,1)");
  grad.addColorStop(0.5, "rgba(255,245,220,0.55)");
  grad.addColorStop(1, "rgba(255,245,220,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 32, 32);
  return new CanvasTexture(c);
}

/** Màu mực theo độ đậm (0 nhạt, 1 đậm) pha về giấy; xaK càng lớn càng chìm trong sương. */
function mucColor(dam: number, xaK: number): Color {
  const paper = new Color(PAPER);
  return new Color(INK).lerp(paper, 1 - Math.min(1, dam)).lerp(paper, xaK * 0.65);
}

/**
 * Một cây trúc thủy mặc: thân mảnh nét mực nhạt hơn lá, đốt sẫm ở khớp, chùm lá nhọn xòe rủ dồn về ngọn.
 * dam: độ đậm mực của cây (tiền cảnh gần 1, lớp sau nhạt).
 */
function themTruc(m: Merge, rand: () => number, x: number, z: number, xaK: number): void {
  const h = 3.4 + rand() * 2.8;
  const r = 0.03 + rand() * 0.04 * (h / 5);
  const phase = rand() * Math.PI * 2;
  const nghieng = (rand() - 0.5) * 0.18;
  const bendAmp = (0.1 + rand() * 0.1) * (h / 5);
  const dam = 0.55 + rand() * 0.45;
  const than = mucColor(dam * (0.48 + rand() * 0.14), xaK);
  const dot = mucColor(dam * (0.75 + rand() * 0.12), xaK);
  const laMau = mucColor(dam * (0.92 + rand() * 0.1), xaK);
  const bend = (y: number) => bendAmp * Math.pow(Math.max(0, y) / h, 2);

  const doan = 5 + Math.floor(rand() * 3);
  const thanGeo = new CylinderGeometry(r * 0.8, r, h / doan, 5, 1, true);
  const vong = new CylinderGeometry(r * 1.14, r * 1.14, 0.018 + r * 0.26, 5, 1, true);
  const mat = new Matrix4();
  for (let i = 0; i < doan; i++) {
    const y = (i + 0.5) * (h / doan);
    const lech = nghieng * y;
    mat.makeTranslation(x + lech, y, z);
    addGeo(m, thanGeo, mat, than, phase, bend);
    mat.makeTranslation(x + lech, y + h / doan / 2, z);
    addGeo(m, vong, mat, dot, phase, bend);
  }
  thanGeo.dispose();
  vong.dispose();

  // Chùm lá kiểu nét trúc: 4–6 lá nhọn xòe quạt chúc xuống quanh một điểm, dồn về ngọn.
  const laGeo = laGeometry(0.52, 0.075);
  const soChum = 6 + Math.floor(rand() * 4);
  for (let i = 0; i < soChum; i++) {
    const k01 = (i + rand() * 0.7) / soChum;
    const y = h * (0.5 + 0.5 * k01);
    const goc = rand() * Math.PI * 2;
    const soLa = 4 + Math.floor(rand() * 3);
    for (let k = 0; k < soLa; k++) {
      const a = goc + (k / soLa) * Math.PI * 2 + rand() * 0.4;
      mat
        .makeRotationY(a)
        .multiply(new Matrix4().makeRotationZ(-0.25 - rand() * 0.85))
        .setPosition(x + nghieng * y + Math.cos(a) * 0.1, y + (rand() - 0.3) * 0.14, z + Math.sin(a) * 0.1);
      addGeo(m, laGeo, mat, laMau, phase, bend, 0.014 + rand() * 0.02);
    }
  }
  laGeo.dispose();
}

/** Cụm lá rủ từ mép trên khung (hai góc của tranh mẫu): nhiều chùm lá đậm dọc một cành chéo vô hình. */
function themLaRu(m: Merge, rand: () => number, x0: number, y0: number, z: number, huong: number, dai: number, dam: number): void {
  const phase = rand() * Math.PI * 2;
  const laGeo = laGeometry(0.62, 0.085);
  const mat = new Matrix4();
  const soChum = Math.round(dai * 7);
  for (let i = 0; i < soChum; i++) {
    const k = i / soChum;
    const x = x0 + huong * dai * k + (rand() - 0.5) * 0.3;
    const y = y0 - k * dai * 0.7 - rand() * 0.3;
    const laMau = mucColor(dam * (0.86 + rand() * 0.14), 0);
    const soLa = 5 + Math.floor(rand() * 3);
    const goc = rand() * Math.PI * 2;
    for (let j = 0; j < soLa; j++) {
      const a = goc + (j / soLa) * Math.PI * 2;
      mat
        .makeRotationY(a)
        .multiply(new Matrix4().makeRotationZ(-0.45 - rand() * 0.8))
        .setPosition(x + Math.cos(a) * 0.12, y, z + Math.sin(a) * 0.12);
      addGeo(m, laGeo, mat, laMau, phase, () => 0.05, 0.02 + rand() * 0.02);
    }
  }
  laGeo.dispose();
}

/** Đình trà tám mái ở giữa vườn. */
function dungDinh(): Group {
  const g = new Group();
  const mat = (c: number) => new MeshLambertMaterial({ color: c });
  const da = mat(0xe3d9c0);
  const daSam = mat(0xd2c5a6);
  const go = mat(0x5c4a3d);
  const maiMat = new MeshLambertMaterial({ color: 0x4e463c, side: DoubleSide });
  const sonMat = mat(SON);

  // Đài đá hai bậc.
  const b1 = new Mesh(new CylinderGeometry(2.15, 2.3, 0.18, 8), daSam);
  b1.position.y = 0.09;
  const b2 = new Mesh(new CylinderGeometry(1.85, 1.95, 0.16, 8), da);
  b2.position.y = 0.26;
  g.add(b1, b2);

  // 6 cột son quanh bàn trà.
  const cot = new CylinderGeometry(0.055, 0.062, 1.5, 6);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    const c = new Mesh(cot, go);
    c.position.set(Math.cos(a) * 1.45, 1.1, Math.sin(a) * 1.45);
    g.add(c);
  }
  // Lan can thấp.
  const lan = new Mesh(new CylinderGeometry(1.52, 1.52, 0.05, 24, 1, true), go);
  lan.position.y = 0.62;
  g.add(lan);

  // Mái cong hai tầng: Lathe với mép hất lên.
  // Mái cong kiểu đình: dốc xuống rõ, mép hất nhẹ.
  const profile = (r0: number, y0: number, cao: number) => {
    const pts: Vector2[] = [];
    for (let i = 0; i <= 10; i++) {
      const k = i / 10;
      pts.push(new Vector2(r0 * (1 - k * 0.97), y0 + cao * (k * k * 0.7 + k * 0.3) + Math.pow(1 - k, 3) * 0.1));
    }
    return pts;
  };
  const mai1 = new Mesh(new LatheGeometry(profile(2.0, 1.72, 0.85), 8), maiMat);
  const mai2 = new Mesh(new LatheGeometry(profile(1.05, 2.62, 0.55), 8), maiMat);
  const co = new Mesh(new CylinderGeometry(0.5, 0.56, 0.38, 8), go);
  co.position.y = 2.72;
  const chop = new Mesh(new SphereGeometry(0.1, 8, 6), sonMat);
  chop.position.y = 3.28;
  g.add(mai1, mai2, co, chop);

  // Bàn trà thấp, ấm trà và hai đôn.
  const ban = new Mesh(new CylinderGeometry(0.42, 0.46, 0.09, 10), go);
  ban.position.y = 0.52;
  const am = new Mesh(new SphereGeometry(0.085, 8, 6), mat(0x4e463c));
  am.position.set(0.08, 0.61, 0);
  const don1 = new Mesh(new CylinderGeometry(0.14, 0.16, 0.26, 8), daSam);
  don1.position.set(-0.62, 0.47, 0.3);
  const don2 = don1.clone();
  don2.position.set(0.5, 0.47, -0.5);
  g.add(ban, am, don1, don2);

  return g;
}

export function canhTruc(): Program {
  const scene = new Scene();
  const camera = new PerspectiveCamera(34, 1, 0.1, 60);
  const rand = rngFrom(20261105);
  const paper = new Color(PAPER);
  // Xa mờ dần về màu giấy (đình, đất đi qua fog; trúc tự phai trong shader).
  scene.fog = new Fog(PAPER, 9, 24);

  scene.add(new AmbientLight(0xfff6e4, 1.05));
  const nang = new DirectionalLight(0xffecd0, 1.1);
  nang.position.set(4, 7, 5);
  scene.add(nang);

  // Không vẽ mặt đất (tranh mẫu để nền giấy trống, chân trúc chìm trong sương); chỉ một bóng mờ dưới đình.
  const bong = new Mesh(
    new PlaneGeometry(6.4, 2.6),
    new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      vertexShader: SUONG_VS,
      fragmentShader: `precision mediump float;varying vec2 vUv;void main(){float d=distance(vUv,vec2(0.5));float a=smoothstep(0.5,0.08,d)*0.16;gl_FragColor=vec4(0.42,0.35,0.27,a);}`,
    }),
  );
  bong.rotation.x = -Math.PI / 2;
  bong.position.set(1.7, 0.012, -3.9);
  scene.add(bong);

  // Mặt trời son mờ (như dấu ấn) phía sau bên phải.
  const troi = new Mesh(
    new PlaneGeometry(3.4, 3.4),
    new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      vertexShader: SUONG_VS,
      fragmentShader: `precision mediump float;varying vec2 vUv;void main(){float d=distance(vUv,vec2(0.5));float a=smoothstep(0.5,0.18,d)*0.22;gl_FragColor=vec4(0.76,0.3,0.24,a);}`,
    }),
  );
  troi.position.set(8.2, 7.8, -17);
  scene.add(troi);

  // Đình giữa vườn, hơi lùi.
  const dinh = dungDinh();
  dinh.position.set(1.7, 0.02, -3.9);
  dinh.rotation.y = 0.26;
  scene.add(dinh);

  // Bụi trúc: hai cánh gà dày, sau đình thưa, và vài cây tiền cảnh sát mép.
  const m: Merge = { pos: [], col: [], sway: [], idx: [], base: 0 };
  const them = (n: number, x0: number, x1: number, z0: number, z1: number, xaK: number) => {
    for (let i = 0; i < n; i++) themTruc(m, rand, x0 + rand() * (x1 - x0), z0 + rand() * (z1 - z0), xaK);
  };
  // Lớp theo tranh mẫu: hai cánh gà rõ nét, lớp giữa nhạt, lớp xa chìm hẳn trong sương; vài cây tiền cảnh sát mép.
  them(12, -9.5, -2.6, -7.5, -1, 0.2);
  them(12, 4.6, 11, -7.5, -1, 0.2);
  them(12, -13, 13, -13, -8, 0.5);
  them(10, -14, 14, -19, -14, 0.75);
  them(4, -8.5, -5.5, 0.5, 2.4, 0);
  them(4, 5.5, 8.5, 0.5, 2.4, 0);
  // Cụm lá rủ từ mép trên hai góc, đậm như tiền cảnh của tranh.
  themLaRu(m, rand, -5.4, 6.1, 1.6, 1, 2.6, 0.95);
  themLaRu(m, rand, 6.2, 6.5, 0.8, -1, 2.2, 0.9);
  themLaRu(m, rand, -7.8, 5.2, -2.5, 1, 1.6, 0.55);
  const geo = new BufferGeometry();
  geo.setAttribute("position", new BufferAttribute(new Float32Array(m.pos), 3));
  geo.setAttribute("aColor", new BufferAttribute(new Float32Array(m.col), 3));
  geo.setAttribute("aSway", new BufferAttribute(new Float32Array(m.sway), 4));
  geo.setIndex(m.idx);
  const trucMat = new ShaderMaterial({
    uniforms: { uT: { value: 0 }, uGust: { value: 0.5 }, uPaper: { value: paper } },
    vertexShader: TRUC_VS,
    fragmentShader: TRUC_FS,
    side: DoubleSide,
  });
  scene.add(new Mesh(geo, trucMat));

  // Ba dải sương trôi.
  const suong: Mesh[] = [];
  for (const [y, z, a, seed] of [
    [0.5, -1.4, 0.62, 0],
    [1.3, -6, 0.42, 7],
    [2.4, -10.5, 0.34, 13],
  ]) {
    const mesh = new Mesh(
      new PlaneGeometry(30, 1.7 + y),
      new ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: { uT: { value: 0 }, uA: { value: a }, uSeed: { value: seed } },
        vertexShader: SUONG_VS,
        fragmentShader: SUONG_FS,
      }),
    );
    mesh.position.set(0, y, z);
    suong.push(mesh);
    scene.add(mesh);
  }

  // Hạt linh khí bay lên.
  const SO_HAT = 48;
  const hatPos = new Float32Array(SO_HAT * 3);
  const hatGoc = new Float32Array(SO_HAT * 3);
  for (let i = 0; i < SO_HAT; i++) {
    hatGoc[i * 3] = (rand() - 0.5) * 16;
    hatGoc[i * 3 + 1] = rand() * 5;
    hatGoc[i * 3 + 2] = -1 - rand() * 8;
  }
  const hatGeo = new BufferGeometry();
  hatGeo.setAttribute("position", new BufferAttribute(hatPos, 3));
  const hat = new Points(
    hatGeo,
    new (class extends ShaderMaterial {})({
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      uniforms: { uMap: { value: discTexture() }, uScale: { value: 300 } },
      vertexShader: `uniform float uScale;void main(){vec4 mv=modelViewMatrix*vec4(position,1.0);gl_PointSize=uScale/max(1.0,-mv.z)*0.055;gl_Position=projectionMatrix*mv;}`,
      fragmentShader: `precision mediump float;uniform sampler2D uMap;void main(){vec4 t=texture2D(uMap,gl_PointCoord);gl_FragColor=vec4(0.72,0.6,0.32,t.a*0.5);}`,
    }),
  );
  scene.add(hat);

  let px = 0;
  let py = 0;
  let sy = 0;
  let w = 1;
  let hgt = 1;
  let gust = 0.5;
  let hep = 0; // 1 khi khung đứng: nhìn thẳng vào đình (chữ nằm trên), 0 khi khung ngang (chữ bên trái, đình bên phải).

  return {
    resize(cw, ch, dpr) {
      w = cw;
      hgt = ch;
      camera.aspect = cw / ch;
      // Màn đứng hẹp: lùi camera và nhìn thẳng vào đình (chữ nằm phía trên).
      hep = Math.min(1, Math.max(0, (1.0 - cw / ch) / 0.45));
      camera.position.z = 8.6 + Math.max(0, 1.05 - cw / ch) * 4.6;
      camera.updateProjectionMatrix();
      void dpr;
    },
    render(renderer: WebGLRenderer, target: WebGLRenderTarget | null, t: number, dt: number) {
      trucMat.uniforms.uT.value = t;
      // Gió lúc mạnh lúc nhẹ.
      gust = 0.5 + 0.5 * Math.sin(t * 0.21) * Math.sin(t * 0.073 + 1.3);
      trucMat.uniforms.uGust.value = 0.35 + 0.65 * Math.abs(gust);
      for (const s of suong) (s.material as ShaderMaterial).uniforms.uT.value = t;
      for (let i = 0; i < SO_HAT; i++) {
        const sp = 0.12 + (i % 5) * 0.03;
        hatPos[i * 3] = hatGoc[i * 3] + Math.sin(t * 0.3 + i) * 0.7;
        hatPos[i * 3 + 1] = (hatGoc[i * 3 + 1] + t * sp) % 5.6;
        hatPos[i * 3 + 2] = hatGoc[i * 3 + 2];
      }
      hatGeo.getAttribute("position").needsUpdate = true;
      camera.position.x = px * 0.45 + hep * 1.1;
      camera.position.y = 1.72 + py * 0.2 + sy * 1.5;
      camera.lookAt(0.55 + hep * 1.05, 2.3 - hep * 0.5 + sy * 1.5, -3.6);
      renderer.setRenderTarget(target);
      renderer.setClearColor(PAPER_HIGH, 1);
      renderer.clear();
      renderer.render(scene, camera);
      void dt;
      void w;
      void hgt;
    },
    pointer(x, y) {
      px = x;
      py = -y;
    },
    scroll(screens) {
      sy = screens;
    },
    dispose() {
      scene.traverse((o) => {
        const mesh = o as Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const mm = mesh.material as { dispose?: () => void } | undefined;
        if (mm?.dispose) mm.dispose();
      });
    },
  };
}

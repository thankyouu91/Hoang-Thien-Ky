// Cảnh đầu trang chủ: vườn trúc thủy mặc lắc lư trong gió, giữa là đình uống trà.
// Theo tranh mẫu người dùng gửi 2026-11-05: trúc vẽ MỰC (xám nâu, không xanh), lá đậm hơn thân, có cụm lá rủ từ
// mép trên khung; sương trắng loang che gốc và nhấn chìm các lớp sau; gần như không thấy đường chân trời.
// Chỉnh 2026-11-05 tối (người dùng): tre dày hơn; đình VẼ TAY bằng canvas 2D (không còn khối 3D) đặt giữa;
// nền có đường đá và cỏ; hai mép có ống tre to tiền cảnh che khung.
// Là một Program của lớp Three.js dùng chung (proto/src/three): host lo vòng vẽ, thị sai, hạ độ phân giải,
// dừng khi cuộn khuất; ở đây chỉ dựng cảnh và vẽ. Toàn cảnh gộp lại còn ít draw call:
//   - Mọi cây trúc là MỘT mesh: thân, đốt, lá merge chung; lắc gió trong vertex shader
//     (phase theo cây, biên độ theo (độ cao)², lá rung thêm nhịp nhanh).
//   - Đình trà và nền (đường đá, cỏ) là hai tấm canvas 2D vẽ một lần làm texture.
//   - Ba dải sương trôi ngang và hạt linh khí bay lên.
// Máy không có WebGL thì main.ts giữ tranh SVG tĩnh trong HTML.
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  DoubleSide,
  Fog,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Points,
  Scene,
  ShaderMaterial,
  SRGBColorSpace,
  Vector3,
  type WebGLRenderer,
  type WebGLRenderTarget,
} from "three";
import type { Program } from "../../proto/src/three/engine/program.ts";

/** Bảng màu theo token của website (styles.css); đổi token thì đổi ở đây. */
const PAPER = 0xf6efdf;
const PAPER_HIGH = 0xfbf6ea;
const INK = 0x2a2018;

function rngFrom(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Gộp các mảnh hình đã nhân ma trận vào mảng đỉnh chung của bụi trúc, kèm màu và tham số gió. */
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

/**
 * Ống tre TO tiền cảnh sát mép khung: che hai rìa như khung tranh tự nhiên (và che các lỗi vặt phía sau).
 * Thân vượt khỏi khung trên, đốt dài, ít lá nhưng lá to; lắc rất nhẹ vì ở sát người xem.
 */
function themTreTo(m: Merge, rand: () => number, x: number, z: number, nghieng: number, dam: number): void {
  const h = 11;
  const r = 0.16 + rand() * 0.08;
  const phase = rand() * Math.PI * 2;
  const than = mucColor(dam * 0.64, 0);
  const dot = mucColor(dam * 0.98, 0);
  const laMau = mucColor(dam, 0);
  const bend = (y: number) => 0.018 * Math.pow(Math.max(0, y) / h, 2);

  const doan = 7;
  const thanGeo = new CylinderGeometry(r * 0.86, r, h / doan, 7, 1, true);
  const vong = new CylinderGeometry(r * 1.1, r * 1.1, 0.05, 7, 1, true);
  const mat = new Matrix4();
  for (let i = 0; i < doan; i++) {
    const y = (i + 0.5) * (h / doan);
    mat.makeTranslation(x + nghieng * y, y, z);
    addGeo(m, thanGeo, mat, than, phase, bend);
    mat.makeTranslation(x + nghieng * y, y + h / doan / 2, z);
    addGeo(m, vong, mat, dot, phase, bend);
  }
  thanGeo.dispose();
  vong.dispose();

  // Vài chùm lá to ở nửa trên, chúc vào trong khung.
  const laGeo = laGeometry(1.0, 0.14);
  for (let i = 0; i < 4; i++) {
    const y = h * (0.32 + i * 0.1 + rand() * 0.05);
    const goc = rand() * Math.PI * 2;
    for (let k = 0; k < 5; k++) {
      const a = goc + (k / 5) * Math.PI * 2;
      mat
        .makeRotationY(a)
        .multiply(new Matrix4().makeRotationZ(-0.35 - rand() * 0.7))
        .setPosition(x + nghieng * y + Math.cos(a) * r, y, z + Math.sin(a) * r);
      addGeo(m, laGeo, mat, laMau, phase, bend, 0.02 + rand() * 0.015);
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

/**
 * Đình trà vẽ tay bằng canvas 2D (1024²) theo nét tranh mực: bệ đá hai bậc, cột gỗ, lan can, bàn trà với ấm,
 * mái cong hai tầng có vạch ngói và đuôi vểnh, chóp hồ lô và hai đèn lồng son. Trả texture nền trong suốt.
 */
function veDinhTexture(): CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 1024;
  const g = c.getContext("2d")!;
  const GO = "#5a4a3d";
  const GO_DAM = "#463a2f";
  const MUC = "#3c352c";
  const SON = "#a8322a";

  // Bệ đá hai bậc (hình thang) và sàn.
  const bac = (nua: number, yD: number, yT: number, mau: string) => {
    g.beginPath();
    g.moveTo(512 - nua, yD);
    g.lineTo(512 + nua, yD);
    g.lineTo(512 + nua - 28, yT);
    g.lineTo(512 - nua + 28, yT);
    g.closePath();
    g.fillStyle = mau;
    g.fill();
    g.strokeStyle = "rgba(70,58,47,0.55)";
    g.lineWidth = 3;
    g.stroke();
  };
  bac(425, 980, 946, "#d3c6a8");
  bac(360, 946, 914, "#ddd2b8");
  // Vạch đá trên bệ.
  g.strokeStyle = "rgba(70,58,47,0.25)";
  g.lineWidth = 2;
  for (const [x0, x1, y] of [[180, 320, 963], [560, 700, 963], [760, 840, 963], [250, 370, 930], [600, 740, 930]] as const) {
    g.beginPath();
    g.moveTo(x0, y);
    g.lineTo(x1, y);
    g.stroke();
  }
  g.fillStyle = "#cdbf9f";
  g.fillRect(512 - 330, 902, 660, 14);

  // Bốn cột gỗ.
  for (const dx of [-295, -103, 103, 295]) {
    g.fillStyle = Math.abs(dx) > 200 ? GO_DAM : GO;
    g.fillRect(512 + dx - 13, 566, 26, 338);
    g.fillStyle = "rgba(0,0,0,0.14)";
    g.fillRect(512 + dx + 7, 566, 6, 338);
  }

  // Lan can: tay vịn, con tiện, thanh chân (chừa ô cửa giữa).
  g.fillStyle = GO;
  for (const [xa, xb] of [[-295, -103], [103, 295]] as const) {
    g.fillRect(512 + xa, 782, xb - xa, 11);
    g.fillRect(512 + xa, 856, xb - xa, 9);
    for (let x = xa + 30; x < xb - 12; x += 48) g.fillRect(512 + x - 4, 793, 8, 63);
  }

  // Bàn trà, ấm, chén và hai đôn (bóng mực sau lan can giữa).
  g.fillStyle = MUC;
  g.beginPath();
  g.ellipse(512, 838, 92, 20, 0, 0, Math.PI * 2);
  g.fill();
  g.fillRect(504, 838, 16, 52);
  g.beginPath(); // thân ấm
  g.arc(497, 806, 24, 0, Math.PI * 2);
  g.fill();
  g.beginPath(); // vòi
  g.moveTo(519, 802);
  g.quadraticCurveTo(538, 795, 541, 781);
  g.lineTo(533, 778);
  g.quadraticCurveTo(528, 792, 515, 795);
  g.closePath();
  g.fill();
  g.fillRect(492, 777, 10, 8); // nắp
  g.beginPath();
  g.ellipse(551, 816, 10, 6, 0, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.ellipse(576, 816, 10, 6, 0, 0, Math.PI * 2);
  g.fill();
  for (const dx of [-170, 168]) {
    g.beginPath();
    g.ellipse(512 + dx, 872, 30, 12, 0, 0, Math.PI * 2);
    g.fill();
    g.fillRect(512 + dx - 22, 872, 44, 24);
  }

  // Xà ngang đầu cột.
  g.fillStyle = GO_DAM;
  g.fillRect(512 - 332, 540, 664, 28);

  /** Một tầng mái cong: đuôi vểnh hai đầu, vạch ngói, diềm đậm. */
  const mai = (nuaRong: number, yDinh: number, yMep: number, yDuoi: number, vey: number) => {
    const xT = 512 - nuaRong;
    const xP = 512 + nuaRong;
    g.beginPath();
    g.moveTo(xT, yMep - vey);
    g.quadraticCurveTo(512 - nuaRong * 0.52, yDinh + (yMep - yDinh) * 0.22, 512, yDinh);
    g.quadraticCurveTo(512 + nuaRong * 0.52, yDinh + (yMep - yDinh) * 0.22, xP, yMep - vey);
    g.quadraticCurveTo(xP - nuaRong * 0.12, yDuoi - 4, xP - nuaRong * 0.2, yDuoi);
    g.quadraticCurveTo(512 + nuaRong * 0.4, yDuoi - (yDuoi - yDinh) * 0.3, 512, yDuoi - (yDuoi - yDinh) * 0.34);
    g.quadraticCurveTo(512 - nuaRong * 0.4, yDuoi - (yDuoi - yDinh) * 0.3, xT + nuaRong * 0.2, yDuoi);
    g.quadraticCurveTo(xT + nuaRong * 0.12, yDuoi - 4, xT, yMep - vey);
    g.closePath();
    const grad = g.createLinearGradient(0, yDinh, 0, yDuoi);
    grad.addColorStop(0, "#5d5346");
    grad.addColorStop(1, "#423b32");
    g.fillStyle = grad;
    g.fill();
    // Vạch ngói tỏa từ đỉnh.
    g.strokeStyle = "rgba(246,239,223,0.14)";
    g.lineWidth = 2.5;
    for (let i = -4; i <= 4; i++) {
      if (!i) continue;
      const tx = 512 + i * nuaRong * 0.2;
      const bx = 512 + i * nuaRong * 0.23;
      g.beginPath();
      g.moveTo(512 + i * 8, yDinh + 6);
      g.quadraticCurveTo((tx + bx) / 2, (yDinh + yDuoi) / 2, bx, yDuoi - (yDuoi - yDinh) * 0.32);
      g.stroke();
    }
    // Diềm mái.
    g.strokeStyle = "#332d26";
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(xT + nuaRong * 0.2, yDuoi);
    g.quadraticCurveTo(512, yDuoi - (yDuoi - yDinh) * 0.36, xP - nuaRong * 0.2, yDuoi);
    g.stroke();
  };

  // Mái dưới, cổ lầu có song cửa, mái trên.
  mai(462, 404, 540, 580, 42);
  g.beginPath();
  g.moveTo(512 - 128, 404);
  g.lineTo(512 + 128, 404);
  g.lineTo(512 + 100, 330);
  g.lineTo(512 - 100, 330);
  g.closePath();
  g.fillStyle = GO;
  g.fill();
  g.strokeStyle = "rgba(246,239,223,0.2)";
  g.lineWidth = 3;
  for (const dx of [-60, -20, 20, 60]) {
    g.beginPath();
    g.moveTo(512 + dx, 398);
    g.lineTo(512 + dx * 0.88, 336);
    g.stroke();
  }
  mai(210, 250, 316, 342, 24);

  // Chóp hồ lô son.
  g.fillStyle = SON;
  g.beginPath();
  g.ellipse(512, 244, 26, 10, 0, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.arc(512, 221, 15, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.arc(512, 198, 10, 0, Math.PI * 2);
  g.fill();
  g.fillRect(509, 184, 6, 10);

  // Hai đèn lồng son treo đuôi mái dưới.
  for (const dx of [-452, 452]) {
    const x = 512 + dx;
    g.strokeStyle = MUC;
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(x, 506);
    g.lineTo(x, 536);
    g.stroke();
    g.fillStyle = SON;
    g.beginPath();
    g.ellipse(x, 560, 17, 24, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = "rgba(246,239,223,0.35)";
    g.lineWidth = 2;
    g.beginPath();
    g.ellipse(x, 560, 10, 24, 0, 0, Math.PI * 2);
    g.stroke();
    g.strokeStyle = SON;
    g.beginPath();
    g.moveTo(x, 584);
    g.lineTo(x, 596);
    g.stroke();
  }

  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/**
 * Nền vườn: đường đá cong dẫn tới đình và các khóm cỏ nét mực, vẽ canvas trong suốt rồi trải phẳng;
 * mép tự tan vào giấy (mặt nạ radial) nên không tạo đường chân trời.
 */
function veNenTexture(rand: () => number): CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 1024;
  const g = c.getContext("2d")!;

  // Đường đá: các phiến tròn dẹt men theo đường cong từ mép dưới (gần) tới chân đình (xa, trên).
  // Texture v=1 (y=0) là XA; đình nằm ở khoảng (545, 260).
  const duong = (k: number) => {
    const y = 1000 - k * 640; // 1000 (gần) → 360 (dừng trước chân đình)
    const x = 526 + Math.sin(k * Math.PI * 1.5) * 95 * (1 - k * 0.8);
    return [x, y] as const;
  };
  for (let i = 1; i < 15; i++) {
    const k = i / 14;
    const [x, y] = duong(k);
    const w = (1 - k * 0.72) * 46;
    const h = w * 0.42;
    g.fillStyle = i % 3 === 1 ? "#d9cdae" : "#e0d5ba";
    g.strokeStyle = "rgba(74,60,44,0.4)";
    g.lineWidth = 2.5;
    g.beginPath();
    g.ellipse(x + (rand() - 0.5) * 14, y, w, h, (rand() - 0.5) * 0.3, 0, Math.PI * 2);
    g.fill();
    g.stroke();
  }

  // Khóm cỏ nét mực: dày ở gần (dưới), thưa dần lên xa; né lòng đường.
  const co = (x: number, y: number, cao: number, alpha: number) => {
    g.strokeStyle = `rgba(80,68,50,${alpha})`;
    g.lineWidth = 2;
    const n = 3 + Math.floor(rand() * 4);
    for (let i = 0; i < n; i++) {
      const dx = (i - n / 2) * 4 + (rand() - 0.5) * 4;
      g.beginPath();
      g.moveTo(x + dx, y);
      g.quadraticCurveTo(x + dx + (rand() - 0.5) * 10, y - cao * 0.6, x + dx + (rand() - 0.5) * 26, y - cao);
      g.stroke();
    }
  };
  for (let i = 0; i < 150; i++) {
    const y = 180 + rand() * 820;
    const gan = (y - 180) / 820;
    const x = rand() * 1024;
    const [dx] = duong(Math.min(1, (1024 - y) / 790));
    if (Math.abs(x - dx) < 70 * (1 - (1024 - y) / 1100)) continue; // chừa lòng đường
    co(x, y, 10 + gan * 26 + rand() * 8, 0.16 + gan * 0.3);
  }

  // Mặt nạ: giữ giữa, tan ra bốn mép (không thành đường chân trời).
  g.globalCompositeOperation = "destination-in";
  const mask = g.createRadialGradient(512, 600, 60, 512, 600, 520);
  mask.addColorStop(0, "rgba(0,0,0,0.9)");
  mask.addColorStop(0.62, "rgba(0,0,0,0.55)");
  mask.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = mask;
  g.fillRect(0, 0, 1024, 1024);
  g.globalCompositeOperation = "source-over";

  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

export function canhTruc(): Program {
  const scene = new Scene();
  const camera = new PerspectiveCamera(34, 1, 0.1, 60);
  const rand = rngFrom(20261105);
  const paper = new Color(PAPER);
  // Xa mờ dần về màu giấy (đình, nền đi qua fog; trúc tự phai trong shader).
  scene.fog = new Fog(PAPER, 9, 24);

  // Nền vườn: đường đá và cỏ trải quanh trục camera→đình.
  const nen = new Mesh(
    new PlaneGeometry(22, 14),
    new MeshBasicMaterial({ map: veNenTexture(rand), transparent: true, depthWrite: false }),
  );
  nen.rotation.x = -Math.PI / 2;
  nen.position.set(0.9, 0.006, -1.6);
  scene.add(nen);

  // Bóng mờ dưới đình.
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
  bong.position.set(1.2, 0.012, -3.9);
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

  // Đình trà vẽ tay, đặt giữa vườn (billboard phẳng như một lớp tranh).
  const dinhTex = veDinhTexture();
  // Canvas 1024: nội dung rộng ~930 px, đáy ở y=980. Plane 5.1 world ⇒ đáy nội dung chạm y≈0.02.
  const DINH_CAO = 5.1;
  const dinh = new Mesh(
    new PlaneGeometry(DINH_CAO, DINH_CAO),
    new MeshBasicMaterial({ map: dinhTex, transparent: true, alphaTest: 0.06, side: DoubleSide }),
  );
  const datDinh = (k: number) => {
    // Khung đứng (k→1): đình nhỏ lại một chút cho chữ phía trên thoáng.
    dinh.scale.setScalar(1 - 0.12 * k);
    dinh.position.set(1.2, (DINH_CAO / 2 - (44 / 1024) * DINH_CAO) * dinh.scale.x + 0.02, -3.9);
  };
  datDinh(0);
  scene.add(dinh);

  // Bụi trúc: hai cánh gà dày, lớp giữa, lớp xa chìm sương, cây tiền cảnh và ỐNG TRE TO che mép.
  const m: Merge = { pos: [], col: [], sway: [], idx: [], base: 0 };
  const them = (n: number, x0: number, x1: number, z0: number, z1: number, xaK: number) => {
    for (let i = 0; i < n; i++) themTruc(m, rand, x0 + rand() * (x1 - x0), z0 + rand() * (z1 - z0), xaK);
  };
  them(17, -9.5, -2.2, -7.5, -1, 0.2);
  them(17, 4.4, 11, -7.5, -1, 0.2);
  them(16, -13, 13, -13, -8, 0.5);
  them(14, -14, 14, -19, -14, 0.75);
  them(5, -8.5, -5.5, 0.5, 2.4, 0);
  them(5, 5.5, 8.5, 0.5, 2.4, 0);
  // Cụm lá rủ từ mép trên hai góc, đậm như tiền cảnh của tranh.
  themLaRu(m, rand, -5.4, 6.1, 1.6, 1, 2.6, 0.95);
  themLaRu(m, rand, 6.2, 6.5, 0.8, -1, 2.2, 0.9);
  themLaRu(m, rand, -7.8, 5.2, -2.5, 1, 1.6, 0.55);
  // Ống tre to sát camera che hai mép khung.
  themTreTo(m, rand, -1.95, 4.6, -0.05, 0.98);
  themTreTo(m, rand, -2.75, 3.0, 0.04, 0.8);
  themTreTo(m, rand, 2.75, 4.4, 0.05, 0.95);
  themTreTo(m, rand, 3.8, 3.2, -0.028, 0.78);
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
  let hep = 0; // 1 khi khung đứng: nhìn thẳng vào đình (chữ nằm trên), 0 khi khung ngang (chữ bên trái, đình giữa-phải).

  return {
    resize(cw, ch, dpr) {
      w = cw;
      hgt = ch;
      camera.aspect = cw / ch;
      // Màn đứng hẹp: lùi camera và nhìn thẳng vào đình (chữ nằm phía trên).
      hep = Math.min(1, Math.max(0, (1.0 - cw / ch) / 0.45));
      datDinh(hep);
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
      camera.position.x = px * 0.45 + hep * 0.9;
      camera.position.y = 1.72 + py * 0.2 + sy * 1.5;
      camera.lookAt(0.55 + hep * 0.7, 2.3 + hep * 0.2 + sy * 1.5, -3.6);
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

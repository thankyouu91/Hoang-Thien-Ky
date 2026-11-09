// Shader dùng chung cho mọi tấm hiệu ứng: một quad mỗi instance, hình vẽ bằng hàm khoảng cách theo `kind` (emit.ts K).
// Màu ra là alpha nhân trước: rgb·a và a·(1 − cộng sáng), nên một lần vẽ (ONE, ONE_MINUS_SRC_ALPHA) làm được cả hòa màu
// thường lẫn cộng sáng. Màu truyền thẳng như canvas 2D (không qua ColorManagement của three).

export const VERT = /* glsl */ `
attribute vec4 a0; // x, y, z, xoay
attribute vec4 a1; // hx, hy, cộng sáng, loại
attribute vec4 a2; // rgba
attribute vec4 a3; // p
attribute vec4 a4; // q
uniform vec4 uCam;  // tâm camera (đã trừ rung màn), zoom (px CSS mỗi đơn vị), 0
uniform vec4 uView; // rộng, cao (px CSS), tâm vùng nhìn x, y
varying vec2 vL;
varying vec2 vS;
varying vec4 vC;
varying vec2 vM;
varying vec4 vP;
varying vec4 vQ;
void main() {
  vec2 local = position.xy * a1.xy;
  float c = cos(a0.w);
  float s = sin(a0.w);
  vec2 off = vec2(c * local.x - s * local.y, s * local.x + c * local.y);
  vec2 w = vec2(a0.x, a0.y - a0.z) + off;
  vec2 p = (w - uCam.xy) * uCam.z + uView.zw;
  gl_Position = vec4(p.x / uView.x * 2.0 - 1.0, 1.0 - p.y / uView.y * 2.0, 0.0, 1.0);
  vL = position.xy;
  vS = a1.xy;
  vC = a2;
  vM = a1.zw;
  vP = a3;
  vQ = a4;
}
`;

export const FRAG = /* glsl */ `
precision highp float;
uniform sampler2D uAtlas;
uniform float uPx; // đơn vị thế giới mỗi px CSS, để khử răng cưa
varying vec2 vL;
varying vec2 vS;
varying vec4 vC;
varying vec2 vM;
varying vec4 vP;
varying vec4 vQ;

const float PI = 3.14159265;
const float TAU = 6.28318531;

float band(float x, float c, float hw, float aa) {
  return 1.0 - smoothstep(hw, hw + aa, abs(x - c));
}

vec2 rot2(vec2 p, float a) {
  float c = cos(a);
  float s = sin(a);
  return vec2(c * p.x - s * p.y, s * p.x + c * p.y);
}

float hexDist(vec2 p) {
  p = abs(p);
  return max(dot(p, vec2(0.5, 0.8660254)), p.x);
}

float h11(float x) {
  return fract(sin(x * 127.1 + 311.7) * 43758.5453);
}

void main() {
  float kind = vM.y;
  vec3 rgb = vC.rgb;
  float a = 0.0;
  vec2 u = vL;
  float px = uPx;

  if (kind < 0.5) {
    // SPRITE: ô atlas 8 × 8
    vec2 uv = u * 0.5 + 0.5;
    float cell = vP.x;
    vec2 cuv = (vec2(mod(cell, 8.0), floor(cell / 8.0)) + uv) / 8.0;
    vec4 tx = texture2D(uAtlas, cuv);
    a = tx.a;
    rgb = rgb * tx.rgb + vP.y * tx.a * tx.a * tx.a;
  } else if (kind < 1.5) {
    // GLOW
    float d = length(u);
    float k = mix(3.2, 10.0, vP.x);
    a = exp(-d * d * k) * (1.0 - smoothstep(0.82, 1.0, d));
    rgb = rgb + vP.y * a * a;
  } else if (kind < 2.5) {
    // RING: elip, bề dày theo đơn vị thế giới
    float r = length(u);
    float g = length(u / vS) / max(r, 1e-3);
    float dw = (r - vP.x) / max(g, 1e-5);
    float hw = vP.y * 0.5;
    float soft = vP.w + px;
    float line = 1.0 - smoothstep(hw - soft * 0.5, hw + soft * 0.5 + px, abs(dw));
    if (vQ.x > 0.5) {
      float s = fract(atan(u.y, u.x) / TAU * vQ.x + vQ.y);
      line *= smoothstep(0.0, 0.05, s) * (1.0 - smoothstep(vQ.z, vQ.z + 0.05, s));
    }
    float inside = 1.0 - smoothstep(-px, px, dw);
    float fill = vP.z * inside * (0.45 + 0.55 * smoothstep(vP.x * 0.15, vP.x, r));
    float halo = vQ.w * exp(-abs(dw) / max(vP.y * 3.0, 2.0)) * (1.0 - smoothstep(0.92, 1.0, r));
    a = clamp(max(line, fill) + halo, 0.0, 1.0);
    rgb = mix(rgb, vec3(1.0), line * 0.25);
  } else if (kind < 3.5) {
    // ARC: vệt chém lưỡi liềm; vòng tròn trong toạ độ chuẩn hoá (tấm dẹt thì vệt nằm trên đất)
    float r = length(u);
    float ang = atan(u.y, u.x);
    float sw = vQ.y;
    float da = sw >= 0.0 ? mod(ang - vQ.x, TAU) : mod(vQ.x - ang, TAU);
    float s = da / max(abs(sw), 1e-3);
    float head = vQ.z;
    float tail = vQ.w;
    if (s <= 1.0 && s <= head && s >= tail) {
      float k = (s - tail) / max(head - tail, 1e-3);
      float th = vP.y * pow(sin(PI * clamp(k, 0.0, 1.0)), 0.6) * (0.3 + 0.7 * k);
      float pxn = px / vS.x;
      float d = abs(r - vP.x) - th;
      a = (1.0 - smoothstep(-pxn - vP.z * th, pxn, d)) * (0.35 + 0.65 * k);
      float core = vP.w * (1.0 - smoothstep(0.0, th * 0.55 + pxn, abs(r - vP.x))) * smoothstep(0.25, 0.95, k);
      rgb = mix(rgb, vec3(1.0), clamp(core, 0.0, 1.0));
      a = max(a, core);
    }
  } else if (kind < 4.5) {
    // BEAM: dải đầu tròn dọc trục x của tấm
    vec2 w = u * vS;
    float L = max(vS.x - vS.y, 0.0);
    float k = clamp((w.x + L) / max(2.0 * L, 1e-3), 0.0, 1.0);
    float rad = max(vS.y * mix(1.0 - vQ.x, 1.0, k), 1e-3);
    float d = length(vec2(max(abs(w.x) - L, 0.0), w.y));
    float soft = max(vP.w * rad, px);
    float body = 1.0 - smoothstep(rad - soft, rad + px * 0.5, d);
    float core = vP.z > 0.0 ? 1.0 - smoothstep(0.0, rad * vP.z * 0.6 + px * 0.5, d) : 0.0;
    float ramp = mix(vP.x, vP.y, k);
    a = max(body * (0.5 + 0.5 * (1.0 - d / rad)), core) * ramp;
    rgb = mix(rgb, vec3(1.0), core * 0.85);
  } else if (kind < 5.5) {
    // DOME: khiên bán cầu đặt trên đất; nửa trên là vòm, nửa dưới là mép đáy elip
    vec2 w = u * vS;
    float R = vS.x;
    float H = R * vP.x;
    float base = 0.36;
    float up = step(w.y, 0.0);
    float e = length(vec2(w.x / R, w.y / mix(R * base, H, up)));
    float pxn = px / R;
    float inside = 1.0 - smoothstep(1.0 - pxn * 1.5, 1.0 + pxn, e);
    float rim = pow(clamp(e, 0.0, 1.0), 4.0);
    vec2 hp = vec2(w.x, w.y * 1.15) / (R * 0.27);
    vec2 r2 = vec2(1.0, 1.7320508);
    vec2 h1 = mod(hp, r2) - r2 * 0.5;
    vec2 h2 = mod(hp - r2 * 0.5, r2) - r2 * 0.5;
    vec2 gv = dot(h1, h1) < dot(h2, h2) ? h1 : h2;
    float hexl = vP.z * smoothstep(0.40, 0.47, hexDist(gv)) * (0.25 + 0.75 * rim);
    float bandPos = (w.x * 0.6 - w.y * 0.8) / R - (fract(vQ.x) * 3.2 - 1.6);
    float sweep = exp(-bandPos * bandPos * 14.0) * up;
    float ge = length(vec2(w.x / R, w.y / (R * base)));
    float gring = 1.0 - smoothstep(0.0, pxn * 2.0 + 0.05, abs(ge - 1.0));
    a = inside * (0.08 + 0.7 * rim + hexl * 0.45 + sweep * 0.35) + gring * 0.55;
    a *= vP.y;
    rgb = mix(rgb, vec3(1.0), clamp(rim * rim * 0.45 + sweep * 0.45, 0.0, 1.0));
  } else if (kind < 6.5) {
    // RUNE: trận đồ, phù trận, ấn
    float r = length(u);
    float pxn = 1.4 * px / min(vS.x, vS.y);
    float rot = vP.x;
    float lit = vP.y;
    float style = vP.z;
    vec2 ru = rot2(u, -rot);
    float ang = atan(ru.y, ru.x);
    float v = 0.0;
    if (style < 0.5) {
      // bát quái: hai vòng ngoài có khắc vạch, tám quẻ, vòng trong xoay ngược với hai hình vuông đan nhau
      v += band(r, 0.97, 0.012, pxn) + band(r, 0.90, 0.008, pxn);
      float tk = fract(ang / TAU * 72.0);
      v += step(0.905, r) * step(r, 0.965) * band(tk, 0.5, 0.06, 0.08) * 0.8;
      float sa = ang / TAU * 8.0;
      float si = floor(sa + 0.5);
      float la = (sa - si) * TAU / 8.0;
      float code = mod(si + 8.0, 8.0);
      for (int j = 0; j < 3; j++) {
        float rr = 0.64 + float(j) * 0.075;
        float bit = mod(floor(code / pow(2.0, float(j))), 2.0);
        float bar = band(r, rr, 0.021, pxn) * (1.0 - smoothstep(0.25, 0.25 + pxn * 2.0, abs(la)));
        float gap = bit < 0.5 ? smoothstep(0.04, 0.04 + pxn * 2.0, abs(la)) : 1.0;
        v += bar * gap;
      }
      vec2 q1 = rot2(u, rot * 1.7);
      vec2 q2 = rot2(u, rot * 1.7 + PI * 0.25);
      float s1 = max(abs(q1.x), abs(q1.y));
      float s2 = max(abs(q2.x), abs(q2.y));
      v += band(r, 0.53, 0.008, pxn);
      v += (band(s1, 0.36, 0.007, pxn) + band(s2, 0.36, 0.007, pxn)) * step(r, 0.53);
      v += band(r, 0.15, 0.012, pxn);
      float yy = step(r, 0.15) * step(0.0, sin(atan(q1.y, q1.x)) + 0.0) * 0.6;
      v += yy;
      v += 0.07 * (1.0 - r);
    } else if (style < 1.5) {
      // phù trận chiêu cuối: ba vòng, dải chữ phù xoay, 12 nan hoa, lục mang tinh ở giữa
      v += band(r, 0.98, 0.01, pxn) + band(r, 0.93, 0.006, pxn) + band(r, 0.70, 0.01, pxn);
      float seg = floor(ang / TAU * 40.0 + 40.0);
      float sf = fract(ang / TAU * 40.0);
      float hh = h11(seg);
      float rr = 0.76 + 0.12 * h11(seg + 7.0);
      v += step(0.74, r) * step(r, 0.89) * band(sf, 0.5, 0.12 + 0.2 * hh, 0.06) * band(r, rr, 0.02 + 0.03 * hh, pxn);
      float sp = fract(ang / TAU * 12.0);
      v += step(0.3, r) * step(r, 0.69) * band(sp, 0.5, 0.012 / max(r, 0.2), 0.02) * 0.9;
      vec2 t1 = rot2(u, -rot * 2.0);
      float tri1 = max(abs(t1.x) * 0.8660254 + t1.y * 0.5, -t1.y);
      float tri2 = max(abs(t1.x) * 0.8660254 - t1.y * 0.5, t1.y);
      v += band(tri1, 0.25, 0.007, pxn) + band(tri2, 0.25, 0.007, pxn);
      v += band(r, 0.12, 0.012, pxn);
      v += 0.1 * (1.0 - r);
    } else if (style < 2.5) {
      // ấn vuông (bùa chú): khung dày, khung trong, chữ điền
      float s = max(abs(ru.x), abs(ru.y));
      v += band(s, 0.84, 0.07, pxn);
      v += band(s, 0.62, 0.025, pxn);
      v += step(s, 0.62) * (band(ru.x, 0.0, 0.03, pxn) + band(ru.y, 0.0, 0.03, pxn));
      v += step(s, 0.62) * band(abs(ru.x) - abs(ru.y), 0.0, 0.025, pxn) * 0.7;
      v += step(s, 0.92) * 0.12;
    } else {
      // vòng phù văn đơn (diện rộng): vòng ngoài, vòng trong, 24 nét khắc giữa hai vòng
      v += band(r, 0.97, 0.01, pxn) + band(r, 0.78, 0.007, pxn);
      float seg = floor(ang / TAU * 24.0 + 24.0);
      float sf = fract(ang / TAU * 24.0);
      float hh = h11(seg);
      v += step(0.8, r) * step(r, 0.95) * band(sf, 0.5, 0.1 + 0.15 * hh, 0.05) * band(r, 0.86 + 0.05 * (hh - 0.5), 0.025, pxn);
    }
    // phần đã sáng tính theo chiều kim đồng hồ từ đỉnh vòng
    float f = mod(atan(u.y, u.x) + PI * 0.5 + TAU, TAU) / TAU;
    float on = lit >= 0.999 ? 1.0 : 1.0 - smoothstep(lit - 0.01, lit, f);
    v *= mix(0.28, 1.0, on);
    a = clamp(v, 0.0, 1.0) * (1.0 - smoothstep(0.985, 1.0, style > 1.5 && style < 2.5 ? max(abs(ru.x), abs(ru.y)) : r));
    rgb = mix(rgb, vec3(1.0), clamp(v * 0.25 * vQ.x, 0.0, 0.6));
  } else if (kind < 7.5) {
    // RAYS: tia toả và lõi sáng
    float r = length(u);
    float ang = atan(u.y, u.x);
    float ray = pow(abs(cos(ang * vP.x * 0.5 + vP.y)), vP.z);
    float fall = 1.0 - smoothstep(0.0, 1.0, r);
    a = ray * fall * fall + vP.w * exp(-r * r * 16.0);
    rgb = mix(rgb, vec3(1.0), clamp(vP.w * exp(-r * r * 9.0), 0.0, 1.0));
  } else if (kind < 8.5) {
    // SHADE: phủ tối trừ quanh tâm
    float d = length(u * vS);
    a = smoothstep(vP.x, vP.y, d);
  } else {
    // BURST: khung va chạm (impact frame), sao gai sắc cạnh không mờ; gai dài ngắn lệch nhau theo seed, có thể khoét lỗ
    // giữa thành vành gai; viền trắng ở mép trong khi q.y > 0.
    float r = length(u);
    float f = (atan(u.y, u.x) / TAU + 0.5) * vP.x + vP.y;
    float id = mod(floor(f), max(vP.x, 1.0));
    float tri = 1.0 - abs(2.0 * fract(f) - 1.0);
    float tip = 1.0 - vP.w * h11(id + vQ.x * 17.0);
    float rr = mix(vQ.z, tip, pow(tri, 2.2));
    float pxn = px / max(min(vS.x, vS.y), 1e-3) * 1.2;
    a = 1.0 - smoothstep(rr - pxn, rr + pxn, r);
    if (vP.z > 0.0) a *= smoothstep(vP.z * rr - pxn, vP.z * rr + pxn, r);
    float rim = smoothstep(rr - pxn - 0.16 * vQ.y, rr - pxn, r);
    rgb = mix(rgb, vec3(1.0), rim * vQ.y);
  }

  a = clamp(a, 0.0, 1.0) * vC.a;
  gl_FragColor = vec4(rgb * a, a * (1.0 - vM.x));
}
`;

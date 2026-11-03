// Mảnh GLSL dùng chung. Màu truyền thẳng giá trị sRGB (không qua quản lý màu của three) và shader không gọi
// colorspace_fragment, nên ảnh nướng vào render target và ảnh vẽ thẳng ra canvas ra cùng một màu.
// Toạ độ cảnh 2D: y = 0 đáy khung, y = 1 đỉnh khung; x tính cùng đơn vị, tâm ở 0 (khung rộng = tỉ lệ khung).
// uSpan = tỉ lệ khung^0,6 giãn nhiễu theo bề ngang, để màn đứng và ảnh ngang đều có số đỉnh núi vừa mắt.

export const NOISE = /* glsl */ `
uniform sampler2D uNoise;
uniform float uTime;
uniform float uSpan;
uniform float uAspect;
uniform float uFlash;
float nR(vec2 p) { return texture2D(uNoise, p).r; }
float nG(vec2 p) { return texture2D(uNoise, p).g; }
float nB(vec2 p) { return texture2D(uNoise, p).b; }
float nA(vec2 p) { return texture2D(uNoise, p).a; }
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
`;

/** Vertex cho mọi mảnh phẳng: vP là toạ độ trong vật, nên dời mảnh (thị sai) thì hình trôi theo. */
export const QUAD_VERT = /* glsl */ `
varying vec2 vP;
void main() {
  vP = position.xy;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FRAG_HEAD = NOISE + `\nvarying vec2 vP;\n`;

export const SKY_FRAG = FRAG_HEAD + /* glsl */ `
uniform vec3 uTop;
uniform vec3 uMid;
uniform vec3 uBottom;
uniform float uMidAt;
uniform vec3 uGlowCol;
uniform vec3 uGlow;
uniform float uStars;
uniform float uGrain;
uniform vec3 uFlashCol;
void main() {
  float y = vP.y;
  vec3 c = y > uMidAt ? mix(uMid, uTop, smoothstep(uMidAt, 1.0, y)) : mix(uBottom, uMid, smoothstep(0.0, uMidAt, y));
  vec2 d = vP - uGlow.xy;
  c += uGlowCol * exp(-dot(d, d) / (uGlow.z * uGlow.z));
  if (uStars > 0.0) {
    vec2 sp = vP * 150.0;
    vec2 id = floor(sp);
    float h = hash12(id);
    float s = step(1.0 - uStars * 0.03, h) * smoothstep(0.32, 0.0, length(fract(sp) - 0.5));
    float tw = 0.55 + 0.45 * sin(uTime * (0.8 + h * 2.5) + h * 40.0);
    c += s * tw * smoothstep(0.3, 0.75, y) * 0.9;
  }
  // hạt giấy và vệt quét bút loang
  float gr = nB(vP * vec2(2.7, 1.9)) - 0.5;
  float wash = nR(vec2(vP.x / uSpan * 0.4, vP.y * 0.6)) - 0.5;
  c += gr * uGrain + wash * uGrain * 1.6;
  c += uFlashCol * uFlash * smoothstep(0.15, 1.0, y);
  gl_FragColor = vec4(c, 1.0);
}
`;

/** Một lớp núi vẽ mực: sống núi từ nhiễu, nét viền đậm, vân thuân, chân núi tan vào sương. */
export const RIDGE_FRAG = FRAG_HEAD + /* glsl */ `
uniform float uRow;
uniform float uSeed;
uniform float uFreq;
uniform float uBase;
uniform float uAmp;
uniform float uSharp;
uniform float uPlat;
uniform float uPlatAmt;
uniform vec3 uCone;
uniform vec3 uInk;
uniform vec3 uWash;
uniform vec3 uFog;
uniform float uFogAmt;
uniform float uFade;
uniform float uDissolve;
uniform float uCun;
uniform float uEdge;
uniform float uOpacity;
uniform vec3 uSnow;
uniform float uSnowAmt;
uniform float uSnowLine;
uniform vec3 uGlowCol;
uniform float uGlowAmt;
uniform float uStrata;
uniform float uHeat;
uniform vec3 uRim;
uniform float uRimAmt;
uniform vec3 uFlashCol;

float ridgeSmooth;
float ridgeH(float x) {
  float xs = x / uSpan * uFreq + uSeed;
  float a = nR(vec2(xs * 0.22, uRow));
  float b = nG(vec2(xs * 0.45, uRow + 0.31));
  float c = nB(vec2(xs * 1.2, uRow + 0.57));
  float s = clamp((a * 0.58 + b * 0.32 + c * 0.1 - 0.26) / 0.52, 0.0, 1.0);
  float h = mix(s, pow(s, 1.0 + uSharp * 2.2), uSharp);
  float r2 = 1.0 - abs(2.0 * nB(vec2(xs * 0.7, uRow + 0.83)) - 1.0);
  h *= 1.0 - smoothstep(0.85, 1.0, uSharp) * 0.4 * (1.0 - r2 * r2 * r2);
  // ridgeSmooth: sống núi bỏ răng cưa mịn, dùng cho độ đậm nhạt trong thân núi để khỏi thành vệt dọc
  ridgeSmooth = clamp((a * 0.64 + b * 0.36 - 0.26) / 0.52, 0.0, 1.0);
  ridgeSmooth = mix(ridgeSmooth, pow(ridgeSmooth, 1.0 + uSharp * 2.2), uSharp);
  h += (nB(vec2(xs * 2.5, uRow + 0.11)) - 0.5) * 0.014;
  float pl = smoothstep(uPlat - 0.05, uPlat + 0.02, h);
  h = mix(h, mix(h * 0.55, uPlat + (h - uPlat) * 0.06, pl), uPlatAmt);
  float cd = abs(x - uCone.x) / max(uCone.y, 1e-3);
  float cone = 1.0 - smoothstep(0.0, 1.0, cd);
  cone = cone * cone * (3.0 - 2.0 * cone) - smoothstep(0.1, 0.0, cd) * 0.06;
  h = max(h, cone * uCone.z);
  ridgeSmooth = uBase + uAmp * max(mix(ridgeSmooth, mix(ridgeSmooth * 0.55, uPlat, step(uPlat, ridgeSmooth)), uPlatAmt), cone * uCone.z);
  return uBase + uAmp * h;
}

void main() {
  float x = vP.x;
  if (uHeat > 0.0) x += sin(vP.y * 95.0 + uTime * 2.6) * 0.0022 * uHeat * smoothstep(0.7, 0.2, vP.y);
  float h = ridgeH(x);
  float d = h - vP.y;
  float aa = max(fwidth(d), 1e-4);
  float inside = smoothstep(-aa, aa, d);
  if (inside < 0.003) discard;
  float xs = x / uSpan;
  // vân thuân: vệt chéo theo sườn, không kéo dọc thành rèm
  float cun = nB(vec2(xs * 1.1 + vP.y * 0.5 + uSeed, vP.y * 1.3 - xs * 0.35 + uRow));
  float cun2 = nG(vec2(xs * 0.9 + uSeed * 0.3, vP.y * 1.2 + uRow));
  float k = clamp((ridgeSmooth - vP.y) / uFade, 0.0, 1.0);
  float tone = k * 0.85 + (cun - 0.5) * uCun + (cun2 - 0.5) * uCun * 0.7;
  vec3 col = mix(uInk, uWash, clamp(tone, 0.0, 1.0));
  float lw = 0.0035 + 0.006 * cun2;
  float edge = 1.0 - smoothstep(0.0, lw, d);
  col = mix(col, uInk * 0.75, edge * uEdge);
  col += uRim * uRimAmt * (1.0 - smoothstep(0.0, lw * 2.5, d));
  if (uSnowAmt > 0.0) {
    float line = uBase + uAmp * uSnowLine + (cun2 - 0.5) * 0.07 + (cun - 0.5) * 0.03;
    float s = smoothstep(line - 0.008, line + 0.008, vP.y) * (1.0 - smoothstep(0.35, 0.9, k));
    col = mix(col, uSnow * (0.82 + cun * 0.3), s * uSnowAmt);
  }
  if (uStrata > 0.0) {
    float band = fract(vP.y * 48.0 + cun2 * 1.4);
    col *= 1.0 - uStrata * smoothstep(0.72, 0.9, band) * 0.4;
    col = mix(col, uWash, uStrata * smoothstep(0.2, 0.0, abs(band - 0.4)) * 0.15);
  }
  if (uGlowAmt > 0.0) {
    float cd = abs(x - uCone.x) / max(uCone.y, 1e-3);
    float top = uBase + uAmp * uCone.z;
    float crater = exp(-cd * cd * 40.0) * smoothstep(0.12, 0.0, top - vP.y);
    float flow = smoothstep(0.7, 0.92, nB(vec2(xs * 9.0 + cd, vP.y * 0.45 - uTime * 0.012))) * exp(-cd * cd * 5.0)
      * smoothstep(top - 0.32, top - 0.02, vP.y);
    float pulse = 0.85 + 0.15 * sin(uTime * 1.7 + vP.y * 10.0);
    col += uGlowCol * (crater * 1.4 + flow) * uGlowAmt * pulse;
  }
  float alpha = inside * uOpacity;
  if (uDissolve > 0.0) {
    float m = nR(vec2(xs * 1.4 + uTime * 0.003, vP.y * 2.0 + uRow)) - 0.5;
    alpha *= 1.0 - smoothstep(1.0 - uDissolve, 1.0, k + m * 0.45);
  }
  col = mix(col, uFog, uFogAmt);
  col += uFlashCol * uFlash * 0.35 * (1.0 - k);
  gl_FragColor = vec4(col, alpha);
}
`;

/** Dải sương hay mây: nhiễu kéo dài ngang trôi theo thời gian, mép trên sáng, mép dưới tối. */
export const MIST_FRAG = FRAG_HEAD + /* glsl */ `
uniform vec3 uColor;
uniform vec3 uColor2;
uniform float uY0;
uniform float uY1;
uniform float uAlpha;
uniform float uSpeed;
uniform float uScale;
uniform float uThresh;
uniform float uSoft;
uniform float uRow;
uniform float uShade;
uniform vec3 uFlashCol;
void main() {
  float t = uTime * uSpeed;
  float yy = (vP.y - uY0) / (uY1 - uY0);
  float xs = vP.x / uSpan * uScale;
  float n = nR(vec2(xs * 0.3 + t, yy * 0.22 + uRow)) * 0.62 + nG(vec2(xs * 0.85 - t * 0.6, yy * 0.55 + uRow + 0.4)) * 0.38;
  float band = smoothstep(0.0, 0.5, yy) * smoothstep(1.0, 0.5, yy);
  float v = n * (0.35 + 0.65 * band) - (1.0 - band) * 0.35;
  float a = smoothstep(uThresh, uThresh + uSoft, v);
  if (a < 0.003) discard;
  float lit = clamp(0.5 + (yy - 0.5) * uShade + (n - 0.5) * uShade, 0.0, 1.0);
  vec3 col = mix(uColor2, uColor, lit);
  col += uFlashCol * uFlash * a * lit;
  gl_FragColor = vec4(col, a * uAlpha);
}
`;

/** Mặt trời, trăng (khuyết), quầng sáng. Mảnh đặt ở tâm đĩa; vP tính từ tâm. */
export const DISC_FRAG = FRAG_HEAD + /* glsl */ `
uniform float uR;
uniform vec3 uColor;
uniform vec3 uGlowCol;
uniform float uGlow;
uniform float uGlowAmt;
uniform float uCrescent;
uniform float uCorona;
uniform float uTex;
void main() {
  float r = length(vP);
  float aa = max(fwidth(r), 1e-4);
  float disc = 1.0 - smoothstep(uR - aa, uR + aa, r);
  if (uCrescent > 0.0) {
    vec2 q = vP - vec2(uR * 0.62, uR * 0.28) * uCrescent;
    disc *= smoothstep(uR * 0.96 - aa, uR * 0.96 + aa, length(q));
  }
  float tex = 1.0 - uTex * (nG(vP * 2.5 + 0.3) * 0.7 + nB(vP * 6.0) * 0.3);
  float g = exp(-max(r - uR, 0.0) / (uR * uGlow));
  if (uCorona > 0.0) {
    float ang = atan(vP.y, vP.x) / 6.2831853;
    float rays = nR(vec2(ang * 3.0, uTime * 0.015)) * 0.6 + nG(vec2(ang * 7.0, uTime * 0.02 + 0.5)) * 0.4;
    g *= 1.0 + uCorona * (rays - 0.45) * 2.2 * smoothstep(uR * 0.9, uR * 1.6, r);
  }
  // mảnh chỉ rộng tới 2,6 bán kính (quầng xa do lớp trời vẽ), nên tắt dần trước mép mảnh
  g *= uGlowAmt * (1.0 - disc) * smoothstep(uR * 2.6, uR * 1.9, r);
  vec3 col = uColor * tex * disc + uGlowCol * g;
  float a = clamp(disc + g, 0.0, 1.0);
  if (a < 0.003) discard;
  gl_FragColor = vec4(col / max(a, 1e-3), a);
}
`;

/** Tia sáng xuyên mây, cộng màu. */
export const RAYS_FRAG = FRAG_HEAD + /* glsl */ `
uniform vec2 uOrigin;
uniform vec3 uColor;
uniform float uAlpha;
uniform float uCount;
uniform float uSpread;
void main() {
  vec2 d = vP - uOrigin;
  float ang = atan(d.x, -d.y);
  float dist = length(d);
  float n = nR(vec2(ang * uCount * 0.08 + uTime * 0.004, 0.37)) * 0.7 + nG(vec2(ang * uCount * 0.21 - uTime * 0.007, 0.71)) * 0.3;
  float rays = smoothstep(0.42, 0.86, n);
  float fall = smoothstep(uSpread, 0.0, abs(ang)) * exp(-dist * 1.1) * smoothstep(0.0, 0.08, dist);
  gl_FragColor = vec4(uColor * rays * fall * uAlpha, 0.0);
}
`;

/** Một dải sóng: ngọn sóng chạy, vạch sóng song song kiểu tranh khắc, bọt trắng trên ngọn. */
export const WAVE_FRAG = FRAG_HEAD + /* glsl */ `
uniform float uY;
uniform float uAmp;
uniform float uK;
uniform float uW;
uniform float uRow;
uniform vec3 uWater;
uniform vec3 uDeep;
uniform vec3 uFoam;
uniform float uLines;
float crest(float x) {
  float xs = x / uSpan;
  return uY + uAmp * (0.55 * sin(xs * uK + uTime * uW + uRow * 10.0) + 0.3 * sin(xs * uK * 2.3 - uTime * uW * 1.3 + uRow * 3.0)
    + 0.6 * (nR(vec2(xs * 0.3 + uTime * 0.008, uRow)) - 0.5));
}
void main() {
  float h = crest(vP.x);
  float d = h - vP.y;
  float aa = max(fwidth(d), 1e-4);
  float inside = smoothstep(-aa, aa, d);
  if (inside < 0.003) discard;
  vec3 col = mix(uWater, uDeep, smoothstep(0.0, 0.14, d));
  float ln = fract(d * uLines + nG(vec2(vP.x / uSpan * 1.6, uRow)) * 0.9);
  col = mix(col, uFoam, (1.0 - smoothstep(0.0, 0.12, ln)) * 0.28 * smoothstep(0.16, 0.01, d));
  float fw = 0.004 + 0.011 * nB(vec2(vP.x / uSpan * 3.5 + uTime * 0.02, uRow));
  col = mix(col, uFoam, 1.0 - smoothstep(0.0, fw, d));
  gl_FragColor = vec4(col, inside);
}
`;

/** Viền tối quanh khung để chữ trên thẻ dễ đọc. */
export const VIGNETTE_FRAG = FRAG_HEAD + /* glsl */ `
uniform vec3 uColor;
uniform float uAmt;
uniform float uBottom;
void main() {
  vec2 q = vec2(vP.x / max(uAspect, 0.3) * 2.0, vP.y * 2.0 - 1.0);
  float v = smoothstep(0.55, 1.45, length(q * vec2(0.9, 1.0)));
  float b = smoothstep(0.45, 0.0, vP.y) * uBottom;
  gl_FragColor = vec4(uColor, clamp(v * uAmt + b, 0.0, 1.0));
}
`;

/** Hạt: chấm mềm, tàn lửa, lá, vệt mưa, lửa ma, tuyết. Vị trí tính hết trong vertex shader, CPU không cập nhật gì. */
export const POINTS_VERT = NOISE + /* glsl */ `
attribute vec4 aSeed;
uniform float uPx;
uniform float uSize;
uniform float uSway;
uniform float uSwayF;
uniform vec4 uArea;
uniform vec2 uVel;
uniform float uTwinkle;
uniform float uSpin;
uniform float uAngle;
uniform float uLife;
varying vec4 vS;
varying float vA;
varying float vRot;
void main() {
  vec2 span = uArea.zw - uArea.xy;
  float sp = mix(0.55, 1.45, aSeed.z);
  vec2 p = aSeed.xy * span + uVel * sp * uTime;
  p.x += sin(uTime * uSwayF * (0.6 + aSeed.w) + aSeed.z * 6.2831) * uSway;
  vec2 f = mod(p, span) / span;
  vec2 pos = uArea.xy + f * span;
  float edge = smoothstep(0.0, 0.07, f.y) * smoothstep(1.0, 0.93, f.y) * smoothstep(0.0, 0.03, f.x) * smoothstep(1.0, 0.97, f.x);
  float tw = 0.5 + 0.5 * sin(uTime * (1.3 + aSeed.w * 3.7) + aSeed.x * 50.0);
  float life = 1.0;
  if (uLife > 0.0) {
    float ph = fract(uTime * uLife * (0.6 + aSeed.w * 0.8) + aSeed.y * 7.0);
    life = smoothstep(0.0, 0.15, ph) * smoothstep(1.0, 0.55, ph);
  }
  vA = edge * mix(1.0, tw, uTwinkle) * life;
  vS = aSeed;
  vRot = uAngle + (aSeed.z * 6.2831 + uTime * (aSeed.w - 0.5) * 3.0) * uSpin;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 0.0, 1.0);
  gl_PointSize = max(1.0, uSize * uPx * mix(0.55, 1.45, aSeed.w));
}
`;

export const POINTS_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform vec3 uColor2;
uniform float uShape;
uniform float uAlpha;
varying vec4 vS;
varying float vA;
varying float vRot;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float cs = cos(vRot);
  float sn = sin(vRot);
  vec2 r = vec2(c.x * cs - c.y * sn, c.x * sn + c.y * cs);
  vec3 col = mix(uColor, uColor2, vS.y);
  float a;
  if (uShape < 0.5) {
    a = smoothstep(0.5, 0.0, length(c));
    a *= a;
  } else if (uShape < 1.5) {
    float d = length(c);
    a = smoothstep(0.5, 0.0, d);
    a *= a;
    col = mix(col, vec3(1.0, 0.95, 0.82), smoothstep(0.16, 0.0, d));
  } else if (uShape < 2.5) {
    vec2 q = r * vec2(1.0, 2.3);
    float d = length(q);
    a = 1.0 - smoothstep(0.4, 0.47, d);
    col *= 0.8 + 0.35 * (1.0 - smoothstep(0.0, 0.035, abs(r.x)));
  } else if (uShape < 3.5) {
    a = (1.0 - smoothstep(0.015, 0.05, abs(r.x))) * smoothstep(0.5, 0.15, abs(r.y));
  } else if (uShape < 4.5) {
    vec2 q = c;
    q.y += 0.12;
    q.x *= 1.0 + max(-q.y, 0.0) * 2.6;
    float d = length(q * vec2(1.7, 1.0));
    a = smoothstep(0.32, 0.05, d);
    col = mix(col, vec3(0.92, 0.98, 1.0), smoothstep(0.14, 0.0, length(c + vec2(0.0, 0.1))));
  } else {
    float d = length(c);
    a = smoothstep(0.5, 0.2, d);
    float arms = abs(cos(atan(c.y, c.x) * 3.0));
    a = max(a * 0.55, (1.0 - smoothstep(0.03, 0.07, abs(r.x) * arms + abs(r.y) * (1.0 - arms) * 0.2)) * smoothstep(0.5, 0.3, d));
  }
  a *= vA * uAlpha;
  if (a < 0.004) discard;
  gl_FragColor = vec4(col, a);
}
`;

/** Bóng đen phẳng (cây, công trình, kiếm): mực đậm, dưới chân nhạt vào sương. */
export const SILHOUETTE_VERT = /* glsl */ `
varying vec2 vP;
varying vec2 vW;
void main() {
  vP = position.xy;
  vec4 p = vec4(position, 1.0);
  #ifdef USE_INSTANCING
  p = instanceMatrix * p;
  #endif
  vec4 w = modelMatrix * p;
  vW = w.xy;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

export const SILHOUETTE_FRAG = NOISE + /* glsl */ `
uniform vec3 uColor;
uniform vec3 uColor2;
uniform float uFadeY0;
uniform float uFadeY1;
uniform float uSheen;
uniform float uOpacity;
varying vec2 vP;
varying vec2 vW;
void main() {
  float n = nB(vW * vec2(3.0, 1.4));
  vec3 col = mix(uColor, uColor2, clamp((vW.y - uFadeY0) / max(uFadeY1 - uFadeY0, 1e-3), 0.0, 1.0));
  col *= 0.9 + n * 0.2;
  if (uSheen > 0.0) {
    float s = smoothstep(0.06, 0.0, abs(fract(vW.x * 0.6 - vW.y * 0.9 - uTime * 0.07) - 0.5) - 0.42);
    col += vec3(0.85, 0.9, 1.0) * s * uSheen;
  }
  gl_FragColor = vec4(col, uOpacity);
}
`;

/** Đốm sáng tự phát (cửa sổ, linh thạch, mắt thú): màu cộng, nhấp nháy nhẹ. */
export const GLOW_FRAG = NOISE + /* glsl */ `
uniform vec3 uColor;
uniform float uAlpha;
uniform float uFlicker;
varying vec2 vP;
varying vec2 vW;
void main() {
  float f = 1.0 - uFlicker * 0.35 * nB(vec2(vW.x * 7.0 + uTime * 0.6, vW.y * 3.0));
  gl_FragColor = vec4(uColor * f, uAlpha);
}
`;

/** Vòng trận pháp / cổng bí cảnh: vòng xoáy nhiễu trong vòng tròn, cộng màu. */
export const PORTAL_FRAG = FRAG_HEAD + /* glsl */ `
uniform float uR;
uniform vec3 uColor;
uniform vec3 uColor2;
uniform float uAlpha;
uniform float uRing;
void main() {
  float r = length(vP) / uR;
  float ang = atan(vP.y, vP.x);
  float sw = nR(vec2(ang / 6.2831853 * 2.0 + r * 0.6 - uTime * 0.05, r * 0.5 + uTime * 0.02));
  float inner = smoothstep(1.0, 0.0, r) * (0.35 + 0.65 * sw);
  float ring = exp(-pow((r - 0.92) * 14.0, 2.0)) * uRing;
  float marks = uRing * smoothstep(0.6, 0.95, abs(cos(ang * 4.0))) * exp(-pow((r - 0.78) * 30.0, 2.0)) * 0.7;
  float glow = exp(-max(r - 0.95, 0.0) * 6.0) * 0.35;
  vec3 col = mix(uColor2, uColor, sw) * (inner + glow) + uColor * (ring + marks) * 1.3;
  gl_FragColor = vec4(col * uAlpha, 0.0);
}
`;

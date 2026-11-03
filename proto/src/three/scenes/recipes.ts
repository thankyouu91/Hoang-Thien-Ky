// Công thức cảnh: sơn thủy thủy mặc (hai tông) và 12 cảnh theo hệ, màu và ký hiệu theo GDD mục 15.
// Màu chủ của hệ lấy từ theme/elements.ts; các màu phụ (trời, mực, sương) tự đặt cho hợp nền tối của dashboard.
import type { ElementId, Tone } from "../types.ts";
import { ridgeAt, wave } from "../engine/layers.ts";
import { grass, lightning, place, stele, sword } from "../engine/props.ts";
import type { Stage } from "../engine/stage.ts";
import type { Recipe, Refs } from "./compose.ts";

// ---- sơn thủy ------------------------------------------------------------------------------------------------------

/** Núi đá dựng đứng kiểu tranh sơn thủy: năm lớp, xa nhạt gần đậm, chân núi tan vào sương, thông trên núi gần. */
export function sonThuy(tone: Tone): Recipe {
  if (tone === "giay") {
    return {
      sky: { top: "#e6d8bb", mid: "#efe3c9", bottom: "#f4ead6", midAt: 0.45, glow: { x: 0, y: 0.35, r: 0.5, color: "#0a0804" }, grain: 0.035 },
      disc: { x: 0.55, y: 0.84, r: 0.035, color: "#b23a2a", glow: "#c46a4a", glowSize: 0.6, glowAmt: 0.25 },
      high: [{ y0: 0.72, y1: 0.98, color: "#f6eedd", color2: "#ddd0b5", alpha: 0.55, speed: 0.003, thresh: 0.38, soft: 0.25, shade: 0.6 }],
      far: { base: 0.4, amp: 0.36, freq: 1.2, sharp: 0.7, ink: "#9c978c", wash: "#d9d0be", fog: "#efe4cc", fogAmt: 0.25, fade: 0.16, dissolve: 0.7, cun: 0.25, edge: 0.35 },
      farMist: { y0: 0.3, y1: 0.55, color: "#f3ead6", color2: "#e2d6bd", alpha: 0.8, speed: 0.0035, thresh: 0.2, soft: 0.35 },
      mid: { base: 0.27, amp: 0.44, freq: 1.6, sharp: 0.75, ink: "#55524c", wash: "#b8b0a0", fog: "#efe4cc", fogAmt: 0.05, fade: 0.2, dissolve: 0.65, cun: 0.45, edge: 0.75,
        trees: { kind: "pine", color: "#3e3b36", count: 10, h: [0.025, 0.045] } },
      midMist: { y0: 0.16, y1: 0.42, color: "#f4ebd8", color2: "#e0d4bb", alpha: 0.85, speed: 0.005, thresh: 0.22, soft: 0.35 },
      near: { base: 0.1, amp: 0.3, freq: 2.2, sharp: 0.55, ink: "#22201d", wash: "#8b857a", fog: "#efe4cc", fade: 0.22, dissolve: 0.5, cun: 0.55, edge: 0.9,
        trees: { kind: "pine", color: "#1a1816", count: 9, h: [0.05, 0.09] } },
      nearMist: { y0: -0.02, y1: 0.2, color: "#f5ecda", color2: "#e4d8c0", alpha: 0.85, speed: 0.007, thresh: 0.2, soft: 0.4 },
      fore: { base: -0.06, amp: 0.2, freq: 3.2, sharp: 0.3, ink: "#0f0e0c", wash: "#4a463f", fog: "#efe4cc", fade: 0.35, cun: 0.6, edge: 1 },
      particles: [{ count: 14, area: [-0.5, 0.55, 0.5, 0.9], vel: [0.018, 0.002], size: 0.008, color: "#2a2620", sway: 0.01, swayF: 3, shape: 0, alpha: 0.7 }],
      vignette: { color: "#5a4628", amt: 0.28 },
    };
  }
  return {
    sky: { top: "#08090e", mid: "#231f24", bottom: "#a2774a", midAt: 0.42, glow: { x: 0.12, y: 0.4, r: 0.32, color: "#5a3a1c" }, stars: 0.5, grain: 0.018 },
    disc: { x: -0.5, y: 0.84, r: 0.042, color: "#f4ead2", glow: "#9a8a72", glowSize: 1.6, glowAmt: 0.55, tex: 0.22 },
    high: [{ y0: 0.66, y1: 0.98, color: "#5a5058", color2: "#15131a", alpha: 0.5, speed: 0.003, thresh: 0.34, soft: 0.25, shade: 0.9 }],
    far: { base: 0.38, amp: 0.36, freq: 1.2, sharp: 0.7, ink: "#4e4a52", wash: "#86787a", fog: "#a08066", fogAmt: 0.42, fade: 0.16, dissolve: 0.7, cun: 0.25, edge: 0.3 },
    farMist: { y0: 0.28, y1: 0.54, color: "#d2b48e", color2: "#6a5a54", alpha: 0.5, speed: 0.0035, thresh: 0.22, soft: 0.35, shade: 0.7 },
    mid: { base: 0.26, amp: 0.44, freq: 1.6, sharp: 0.75, ink: "#25232a", wash: "#5d5459", fog: "#7a6660", fogAmt: 0.1, fade: 0.2, dissolve: 0.65, cun: 0.42, edge: 0.6, rim: "#c79a6a", rimAmt: 0.22,
      trees: { kind: "pine", color: "#18161b", count: 10, h: [0.025, 0.045] } },
    midMist: { y0: 0.15, y1: 0.42, color: "#c2a383", color2: "#4a4048", alpha: 0.55, speed: 0.005, thresh: 0.22, soft: 0.35, shade: 0.7 },
    near: { base: 0.1, amp: 0.3, freq: 2.2, sharp: 0.55, ink: "#111015", wash: "#36313a", fog: "#6a5a54", fade: 0.22, dissolve: 0.5, cun: 0.5, edge: 0.8, rim: "#a07a52", rimAmt: 0.14,
      trees: { kind: "pine", color: "#0b0a0e", count: 9, h: [0.05, 0.09] } },
    nearMist: { y0: -0.02, y1: 0.2, color: "#a88e72", color2: "#2e2a32", alpha: 0.6, speed: 0.007, thresh: 0.22, soft: 0.4, shade: 0.6 },
    fore: { base: -0.06, amp: 0.2, freq: 3.2, sharp: 0.3, ink: "#08070a", wash: "#1a181d", fog: "#000000", fade: 0.35, cun: 0.5, edge: 1 },
    particles: [{ count: 30, area: [-0.5, 0, 0.5, 1], vel: [0.004, 0.012], size: 0.006, color: "#f2dcae", color2: "#9fd8c4", sway: 0.02, twinkle: 0.8, additive: true, alpha: 0.6 }],
    vignette: { color: "#050407", amt: 0.5 },
  };
}

// ---- 12 hệ ---------------------------------------------------------------------------------------------------------

type Hook = (s: Stage, refs: Refs) => void;

/** Bóng kiếm cắm trên sống núi: xếp đều ngang khung, nghiêng nhẹ, ánh bạc lướt qua lưỡi. */
function swords(layer: "mid" | "near", n: number, h: [number, number], color: string, color2: string, sheen: number): Hook {
  return (s, refs) => {
    const ref = refs[layer];
    if (!ref) return;
    for (let i = 0; i < n; i++) {
      const f = (i + 0.5) / n + (s.rand() - 0.5) * 0.08;
      const sc = h[0] + (h[1] - h[0]) * s.rand();
      const rot = (s.rand() - 0.5) * 0.35;
      const p = place(s, sword(s.rand), { color, color2, glow: "#f2f6fa", glowAlpha: 0.35, flicker: 0, scale: sc, sheen, depth: layer === "mid" ? 0.34 : 0.62, fadeFrom: ref.shape.base, fadeTo: ref.shape.base + ref.shape.amp + sc });
      s.onResize((a) => {
        const x = (f * 2 - 1) * (a / 2 + 0.04);
        p.at(x, ridgeAt(s, ref.shape, x) - sc * 0.18, rot);
      });
    }
  };
}

function steles(n: number, color: string): Hook {
  return (s, refs) => {
    const ref = refs.mid;
    if (!ref) return;
    for (let i = 0; i < n; i++) {
      const f = s.rand();
      const sc = 0.05 + s.rand() * 0.04;
      const rot = (s.rand() - 0.5) * 0.1;
      const p = place(s, stele(s.rand), { color, scale: sc, depth: 0.35 });
      s.onResize((a) => {
        const x = (f * 2 - 1) * (a / 2);
        p.at(x, ridgeAt(s, ref.shape, x) - 0.006, rot);
      });
    }
  };
}

export const ELEMENT_RECIPES: Record<ElementId, () => Recipe> = {
  // Lôi: mây giông tím, chớp nhánh, mưa xiên; trời và sống núi lóe sáng theo tia chớp.
  loi: () => ({
    sky: { top: "#0a0712", mid: "#1c132e", bottom: "#2d2244", midAt: 0.45, glow: { x: 0, y: 0.75, r: 0.5, color: "#1a1030" }, grain: 0.015, flash: "#7a5cc8" },
    high: [
      { y0: 0.62, y1: 1.08, color: "#4a3a6a", color2: "#110c1c", alpha: 0.95, speed: 0.01, thresh: 0.12, soft: 0.25, shade: 1.3, flash: "#d2c0ff" },
      { y0: 0.5, y1: 0.8, color: "#3a2d55", color2: "#0e0a17", alpha: 0.7, speed: 0.016, thresh: 0.3, soft: 0.25, shade: 1, flash: "#b9a0ff" },
    ],
    far: { base: 0.3, amp: 0.2, freq: 1.4, sharp: 0.6, ink: "#2a2240", wash: "#3d3358", fog: "#3a2f52", fogAmt: 0.35, fade: 0.15, dissolve: 0.6, edge: 0.3, flash: "#8f74e0" },
    hooks: { afterFar: (s) => lightning(s, { color: "#f2ecff", glow: "#9d6bff", top: 0.84, bottom: 0.36, depth: 0.2 }) },
    mid: { base: 0.2, amp: 0.28, freq: 1.8, sharp: 0.8, ink: "#17121f", wash: "#2c2340", fog: "#2d2244", fogAmt: 0.1, fade: 0.2, dissolve: 0.55, edge: 0.6, cun: 0.4, rim: "#8a3ffc", rimAmt: 0.12, flash: "#a68cf0" },
    midMist: { y0: 0.12, y1: 0.34, color: "#4b3d6b", color2: "#1c1430", alpha: 0.5, speed: 0.01, thresh: 0.25, soft: 0.3, flash: "#b9a0ff" },
    near: { base: 0.04, amp: 0.2, freq: 2.6, sharp: 0.9, ink: "#0b0910", wash: "#1d1729", fog: "#000000", fade: 0.3, cun: 0.5, edge: 0.9, flash: "#7c5ad6" },
    particles: [{ count: 170, area: [-0.5, -0.05, 0.5, 1.05], vel: [-0.12, -1.25], size: 0.024, color: "#a596d8", shape: 3, angle: -0.095, alpha: 0.3 }],
    vignette: { color: "#05030a", amt: 0.5 },
  }),

  // Hỏa: núi lửa giữa khung, miệng núi rực, dung nham chảy, khói đen bốc, tàn lửa bay lên.
  hoa: () => ({
    sky: { top: "#160604", mid: "#45120b", bottom: "#8a2a12", midAt: 0.42, glow: { x: 0, y: 0.6, r: 0.32, color: "#7a1e08" }, grain: 0.015 },
    high: [{ y0: 0.7, y1: 1.1, color: "#3a1a14", color2: "#0e0504", alpha: 0.75, speed: 0.004, thresh: 0.3, soft: 0.3, shade: 0.9 }],
    far: { base: 0.3, amp: 0.16, freq: 1.3, sharp: 0.3, ink: "#3a120c", wash: "#5e1d10", fog: "#7a2410", fogAmt: 0.35, fade: 0.15, dissolve: 0.6, edge: 0.2 },
    farMist: { y0: 0.26, y1: 0.42, color: "#a3381a", color2: "#4a140a", alpha: 0.45, speed: 0.004, thresh: 0.25, soft: 0.3 },
    mid: { base: 0.18, amp: 0.5, freq: 1.1, sharp: 0.15, cone: [0, 0.34, 1], ink: "#130605", wash: "#3a120b", fog: "#2a0b06", fade: 0.3, dissolve: 0.45, edge: 0.7, cun: 0.4, glow: "#ff6a1a", glowAmt: 1, rim: "#ff7a2a", rimAmt: 0.25 },
    midMist: { y0: 0.08, y1: 0.28, color: "#6a2412", color2: "#200a05", alpha: 0.5, speed: 0.006, thresh: 0.25, soft: 0.3 },
    near: { base: 0.02, amp: 0.18, freq: 2.4, sharp: 0.5, ink: "#0a0403", wash: "#2a0d07", fog: "#000000", fade: 0.25, cun: 0.5, edge: 0.9, rim: "#ff5a1a", rimAmt: 0.45 },
    particles: [
      { count: 36, area: [-0.07, 0.66, 0.07, 1.1], vel: [0.012, 0.05], size: 0.16, color: "#2c1a16", color2: "#140a08", sway: 0.05, swayF: 0.3, alpha: 0.32, life: 0.08 },
      { count: 110, area: [-0.5, 0, 0.5, 1], vel: [0.015, 0.11], size: 0.013, color: "#ffb347", color2: "#ff4a1a", shape: 1, sway: 0.03, swayF: 1.5, twinkle: 0.6, additive: true },
    ],
    vignette: { color: "#0a0302", amt: 0.5 },
  }),

  // Cực hàn: núi tuyết trắng xanh dưới trời băng, tuyết rơi hai lớp, bông tuyết gần to.
  cuc_han: () => ({
    sky: { top: "#0b1824", mid: "#274860", bottom: "#8db4c6", midAt: 0.4, glow: { x: -0.1, y: 0.5, r: 0.4, color: "#21485a" }, stars: 0.3, grain: 0.015 },
    disc: { x: 0.45, y: 0.82, r: 0.035, color: "#f1fbff", glow: "#8fd2ea", glowSize: 1.3, glowAmt: 0.6 },
    far: { base: 0.34, amp: 0.34, freq: 1.3, sharp: 0.7, ink: "#5b7d94", wash: "#9cbdcf", fog: "#a9c7d5", fogAmt: 0.35, fade: 0.18, dissolve: 0.6, edge: 0.3, snow: "#eaf6fb", snowAmt: 1, snowLine: 0.5 },
    farMist: { y0: 0.26, y1: 0.48, color: "#d8eef6", color2: "#7fa6ba", alpha: 0.5, speed: 0.003, thresh: 0.25, soft: 0.35 },
    mid: { base: 0.2, amp: 0.38, freq: 1.7, sharp: 0.75, ink: "#2c475a", wash: "#6d8fa5", fog: "#7fa6ba", fogAmt: 0.1, fade: 0.2, dissolve: 0.55, edge: 0.6, cun: 0.4, snow: "#f4fbff", snowAmt: 1, snowLine: 0.42,
      trees: { kind: "pine", color: "#14232d", count: 8, h: [0.025, 0.04] } },
    midMist: { y0: 0.1, y1: 0.32, color: "#cfe6ef", color2: "#6b90a4", alpha: 0.55, speed: 0.005, thresh: 0.22, soft: 0.35 },
    near: { base: 0.04, amp: 0.24, freq: 2.3, sharp: 0.55, ink: "#152330", wash: "#3a5466", fog: "#000000", fade: 0.25, cun: 0.5, edge: 0.8, snow: "#e6f3f9", snowAmt: 0.95, snowLine: 0.25,
      trees: { kind: "pine", color: "#0b141b", count: 7, h: [0.05, 0.08] } },
    particles: [
      { count: 150, area: [-0.5, -0.05, 0.5, 1.05], vel: [0.012, -0.05], size: 0.006, color: "#e9f7ff", sway: 0.02, swayF: 1.2, alpha: 0.75 },
      { count: 45, area: [-0.5, -0.05, 0.5, 1.05], vel: [0.025, -0.11], size: 0.022, color: "#f4fbff", shape: 5, sway: 0.04, swayF: 0.8, spin: 0.4, alpha: 0.85 },
    ],
    vignette: { color: "#040a10", amt: 0.4 },
  }),

  // Thủy: biển đêm, đảo xa, năm lớp sóng gợn kiểu tranh khắc, bọt trắng, trăng.
  thuy: () => ({
    sky: { top: "#06101f", mid: "#11294d", bottom: "#3b6590", midAt: 0.45, glow: { x: 0.2, y: 0.65, r: 0.35, color: "#1b3a63" }, stars: 0.6, grain: 0.012 },
    disc: { x: 0.4, y: 0.8, r: 0.045, color: "#e8f1ff", glow: "#5f8fd0", glowSize: 1.4, glowAmt: 0.6, tex: 0.25 },
    high: [{ y0: 0.6, y1: 0.95, color: "#36588a", color2: "#0c1a30", alpha: 0.5, speed: 0.004, thresh: 0.35, soft: 0.25, shade: 0.8 }],
    far: { base: 0.4, amp: 0.16, freq: 1.4, sharp: 0.6, ink: "#173252", wash: "#2a4f78", fog: "#3b6590", fogAmt: 0.3, fade: 0.1, dissolve: 0.5, edge: 0.3 },
    farMist: { y0: 0.37, y1: 0.5, color: "#7aa0c8", color2: "#2b4e78", alpha: 0.45, speed: 0.004, thresh: 0.25, soft: 0.3 },
    hooks: {
      afterFar: (s) => {
        const bands: [number, number, number, string, string, string, number][] = [
          [0.41, 0.008, 16, "#2a5585", "#1c3d66", "#9cbde0", 140],
          [0.35, 0.016, 12, "#24508a", "#173866", "#b2cdea", 105],
          [0.27, 0.026, 9, "#1f4c8c", "#123162", "#c5dbf2", 80],
          [0.17, 0.04, 7, "#1f4fa8", "#0f2a5c", "#dceaf8", 60],
          [0.05, 0.06, 5, "#2357b5", "#0c2452", "#eef5ff", 44],
        ];
        bands.forEach(([y, amp, k, water, deep, foam, lines], i) => wave(s, { y, amp, k, w: 0.5 + i * 0.12, water, deep, foam, lines, depth: 0.2 + i * 0.18 }));
      },
    },
    particles: [{ count: 50, area: [-0.5, 0.02, 0.5, 0.3], vel: [0.03, 0.02], size: 0.008, color: "#eef5ff", sway: 0.01, twinkle: 1, life: 0.5, alpha: 0.7, additive: true }],
    vignette: { color: "#030812", amt: 0.45 },
  }),

  // Mộc: rừng nhiều tầng trong sương lục, nắng xiên qua tán, lá rơi xoay.
  moc: () => ({
    sky: { top: "#0a170e", mid: "#1d3b22", bottom: "#4f7a4a", midAt: 0.4, glow: { x: -0.2, y: 0.85, r: 0.4, color: "#2c4f22" }, grain: 0.015 },
    rays: { x: -0.25, y: 1.15, color: "#5f9a48", alpha: 0.35, count: 9, spread: 0.8 },
    far: { base: 0.36, amp: 0.22, freq: 1.2, sharp: 0.3, ink: "#2c5534", wash: "#4b7a50", fog: "#5c8a58", fogAmt: 0.35, fade: 0.15, dissolve: 0.6, edge: 0.25,
      trees: { kind: "broad", color: "#2a5232", count: 30, h: [0.03, 0.05] } },
    farMist: { y0: 0.3, y1: 0.5, color: "#9fc49a", color2: "#3d6a42", alpha: 0.45, speed: 0.003, thresh: 0.25, soft: 0.3 },
    mid: { base: 0.22, amp: 0.26, freq: 1.6, sharp: 0.4, ink: "#16321d", wash: "#2f5a37", fog: "#3d6a42", fogAmt: 0.1, fade: 0.2, dissolve: 0.55, edge: 0.5, cun: 0.4,
      trees: { kind: "pine", color: "#10261a", count: 26, h: [0.05, 0.08] } },
    midMist: { y0: 0.12, y1: 0.32, color: "#8fb889", color2: "#2c5232", alpha: 0.5, speed: 0.005, thresh: 0.22, soft: 0.35 },
    near: { base: 0.04, amp: 0.18, freq: 2.2, sharp: 0.3, ink: "#0a1a0f", wash: "#1c3a22", fog: "#000000", fade: 0.25, cun: 0.5, edge: 0.8,
      trees: { kind: "broad", color: "#08150c", count: 16, h: [0.12, 0.2] } },
    particles: [{ count: 60, area: [-0.5, -0.05, 0.5, 1.05], vel: [0.03, -0.07], size: 0.022, color: "#6fbf5a", color2: "#c9b04a", shape: 2, sway: 0.05, swayF: 1, spin: 1, alpha: 0.9 }],
    vignette: { color: "#030805", amt: 0.45 },
  }),

  // Phong: đồng cỏ gợn sóng theo cơn gió, mây trôi nhanh, vệt gió xoáy, cánh hoa bay ngang.
  phong: () => ({
    sky: { top: "#0d2123", mid: "#2b5856", bottom: "#86c2b3", midAt: 0.42, glow: { x: 0.2, y: 0.55, r: 0.4, color: "#2a5a52" }, grain: 0.012 },
    high: [
      { y0: 0.62, y1: 0.98, color: "#d8f3ec", color2: "#4d8a82", alpha: 0.6, speed: 0.022, thresh: 0.3, soft: 0.25, shade: 1 },
      { y0: 0.5, y1: 0.72, color: "#b8e6da", color2: "#3d7a72", alpha: 0.4, speed: 0.03, thresh: 0.35, soft: 0.25, shade: 0.8 },
    ],
    far: { base: 0.34, amp: 0.2, freq: 0.9, sharp: 0.1, ink: "#2e6560", wash: "#4f8a82", fog: "#86c2b3", fogAmt: 0.3, fade: 0.12, dissolve: 0.45, edge: 0.2 },
    mid: { base: 0.24, amp: 0.2, freq: 1, sharp: 0.05, ink: "#1d4843", wash: "#3a726b", fog: "#5e9c92", fogAmt: 0.1, fade: 0.2, edge: 0.4, cun: 0.3,
      trees: { kind: "broad", color: "#163a35", count: 6, h: [0.05, 0.08] } },
    midMist: { y0: 0.2, y1: 0.36, color: "#d2f0e8", color2: "#4d8a82", alpha: 0.45, speed: 0.02, thresh: 0.25, soft: 0.3 },
    hooks: {
      afterMid: (s) => grass(s, { count: 700, y0: 0.18, y1: 0.36, h: [0.02, 0.05], base: "#173f3a", tip: "#7cc9b6", wind: 1, depth: 0.45 }),
      afterNear: (s) => grass(s, { count: 1100, y0: -0.02, y1: 0.3, h: [0.06, 0.2], base: "#0b2421", tip: "#8fe0cb", wind: 1.25, depth: 0.85 }),
    },
    particles: [
      { count: 34, area: [-0.5, 0.15, 0.5, 0.95], vel: [0.32, 0.01], size: 0.07, color: "#e6fff8", shape: 3, angle: 1.5708, sway: 0.05, swayF: 2.2, alpha: 0.4, life: 0.3, additive: true },
      { count: 30, area: [-0.5, 0.05, 0.5, 0.7], vel: [0.16, 0.015], size: 0.014, color: "#f2fff9", color2: "#f5c6d6", shape: 2, sway: 0.04, swayF: 1.6, spin: 1.2, alpha: 0.85 },
    ],
    vignette: { color: "#03100e", amt: 0.4 },
  }),

  // Quang: tia sáng rọi qua biển mây vàng, đỉnh núi viền sáng, bụi sáng lấp lánh.
  quang: () => ({
    sky: { top: "#22180a", mid: "#6b5020", bottom: "#c99a45", midAt: 0.5, glow: { x: 0, y: 0.82, r: 0.35, color: "#8a6a20" }, grain: 0.012 },
    disc: { x: 0, y: 0.8, r: 0.07, color: "#fff6d8", glow: "#ffcf5a", glowSize: 1.6, glowAmt: 0.9, corona: 0.4 },
    rays: { x: 0, y: 0.82, color: "#ffe39a", alpha: 0.65, count: 14, spread: 1.4 },
    far: { base: 0.36, amp: 0.3, freq: 1.3, sharp: 0.75, ink: "#6b5126", wash: "#a4864a", fog: "#c9a35a", fogAmt: 0.35, fade: 0.15, dissolve: 0.6, edge: 0.2, rim: "#fff0b8", rimAmt: 0.5 },
    farMist: { y0: 0.25, y1: 0.48, color: "#fff0c2", color2: "#b88f42", alpha: 0.75, speed: 0.004, thresh: 0.2, soft: 0.35, shade: 1 },
    mid: { base: 0.18, amp: 0.38, freq: 1.7, sharp: 0.8, ink: "#3b2a10", wash: "#7a5d28", fog: "#a07a35", fogAmt: 0.1, fade: 0.2, dissolve: 0.6, edge: 0.5, cun: 0.35, rim: "#ffe6a0", rimAmt: 0.6 },
    midMist: { y0: 0.05, y1: 0.3, color: "#ffeab5", color2: "#a37b34", alpha: 0.8, speed: 0.006, thresh: 0.18, soft: 0.35, shade: 1 },
    particles: [{ count: 80, area: [-0.5, 0, 0.5, 1], vel: [0.006, 0.01], size: 0.008, color: "#fff2c0", color2: "#ffd36a", sway: 0.02, twinkle: 1, additive: true, alpha: 0.9 }],
    vignette: { color: "#0c0802", amt: 0.4 },
  }),

  // Âm lãnh: sương ma dày trôi chậm, cây khô, lửa ma lam lập lòe, trăng mờ sau mây.
  am_lanh: () => ({
    sky: { top: "#06080c", mid: "#141a23", bottom: "#2a3341", midAt: 0.45, grain: 0.02 },
    disc: { x: -0.35, y: 0.8, r: 0.05, color: "#b9c6d6", glow: "#4a5a70", glowSize: 1.6, glowAmt: 0.5, tex: 0.3 },
    high: [{ y0: 0.62, y1: 0.95, color: "#3a4658", color2: "#0c1016", alpha: 0.75, speed: 0.004, thresh: 0.28, soft: 0.3, shade: 0.8 }],
    far: { base: 0.34, amp: 0.24, freq: 1.4, sharp: 0.55, ink: "#1d242e", wash: "#2d3745", fog: "#2a3341", fogAmt: 0.35, fade: 0.15, dissolve: 0.6, edge: 0.3 },
    farMist: { y0: 0.26, y1: 0.5, color: "#7b8ca3", color2: "#2a3341", alpha: 0.6, speed: 0.0025, thresh: 0.18, soft: 0.4 },
    mid: { base: 0.2, amp: 0.26, freq: 1.8, sharp: 0.5, ink: "#121820", wash: "#222b37", fog: "#2a3341", fogAmt: 0.1, fade: 0.2, dissolve: 0.6, edge: 0.5, cun: 0.4,
      trees: { kind: "dead", color: "#0e131a", count: 8, h: [0.05, 0.08] } },
    midMist: { y0: 0.08, y1: 0.36, color: "#8697ad", color2: "#222b37", alpha: 0.65, speed: 0.004, thresh: 0.2, soft: 0.4 },
    near: { base: 0.02, amp: 0.16, freq: 2.4, sharp: 0.4, ink: "#07090c", wash: "#161c25", fog: "#000000", fade: 0.25, cun: 0.5, edge: 0.8,
      trees: { kind: "dead", color: "#05070a", count: 5, h: [0.16, 0.26] } },
    nearMist: { y0: -0.05, y1: 0.18, color: "#9aabbf", color2: "#2a3341", alpha: 0.55, speed: 0.006, thresh: 0.2, soft: 0.4 },
    particles: [{ count: 20, area: [-0.5, 0.06, 0.5, 0.55], vel: [0.004, 0.018], size: 0.045, color: "#9fe0ff", color2: "#7a8cff", shape: 4, sway: 0.03, swayF: 0.7, twinkle: 0.6, life: 0.12, additive: true }],
    vignette: { color: "#020305", amt: 0.6 },
  }),

  // Cực âm: trăng khuyết lớn sau mây đen, trời tím than đầy sao, sống núi viền ánh trăng.
  cuc_am: () => ({
    sky: { top: "#04030a", mid: "#110a1f", bottom: "#231738", midAt: 0.4, glow: { x: 0.1, y: 0.72, r: 0.35, color: "#1e1235" }, stars: 0.8, grain: 0.015 },
    disc: { x: 0.25, y: 0.73, r: 0.11, color: "#ddd0f5", glow: "#5b3f8a", glowSize: 1.2, glowAmt: 0.9, crescent: 1, tex: 0.3 },
    high: [
      { y0: 0.6, y1: 0.86, color: "#2c1f44", color2: "#0a0613", alpha: 0.85, speed: 0.006, thresh: 0.36, soft: 0.22, shade: 1 },
      { y0: 0.82, y1: 1.05, color: "#22183a", color2: "#07040e", alpha: 0.7, speed: 0.004, thresh: 0.35, soft: 0.25, shade: 1 },
    ],
    far: { base: 0.32, amp: 0.22, freq: 1.3, sharp: 0.6, ink: "#1d1430", wash: "#2c2045", fog: "#231738", fogAmt: 0.3, fade: 0.15, dissolve: 0.6, edge: 0.3, rim: "#9f88d8", rimAmt: 0.25 },
    farMist: { y0: 0.24, y1: 0.44, color: "#4a3370", color2: "#170f27", alpha: 0.45, speed: 0.003, thresh: 0.25, soft: 0.3 },
    mid: { base: 0.18, amp: 0.3, freq: 1.8, sharp: 0.7, ink: "#0f0a19", wash: "#1e1530", fog: "#231738", fogAmt: 0.05, fade: 0.2, dissolve: 0.55, edge: 0.6, cun: 0.4, rim: "#b9a2f0", rimAmt: 0.35,
      trees: { kind: "pine", color: "#0a0612", count: 7, h: [0.03, 0.05] } },
    midMist: { y0: 0.06, y1: 0.28, color: "#3c2a5c", color2: "#120b1e", alpha: 0.5, speed: 0.004, thresh: 0.25, soft: 0.35 },
    near: { base: 0.02, amp: 0.18, freq: 2.4, sharp: 0.5, ink: "#06040b", wash: "#130d1f", fog: "#000000", fade: 0.25, cun: 0.5, edge: 0.9, rim: "#7f66c0", rimAmt: 0.3 },
    particles: [{ count: 30, area: [-0.5, 0, 0.5, 0.8], vel: [0.004, 0.008], size: 0.007, color: "#b9a2f0", sway: 0.02, twinkle: 0.9, additive: true, alpha: 0.7 }],
    vignette: { color: "#020105", amt: 0.55 },
  }),

  // Cực dương: mặt trời lớn có quầng tia, trời cam đỏ, đồi khô gợn hơi nóng.
  cuc_duong: () => ({
    sky: { top: "#341004", mid: "#9a3c0e", bottom: "#eea04a", midAt: 0.45, glow: { x: 0, y: 0.58, r: 0.4, color: "#b84a10" }, grain: 0.012 },
    disc: { x: 0, y: 0.62, r: 0.1, color: "#fff4d6", glow: "#ff9a2a", glowSize: 2.2, glowAmt: 1.15, corona: 1, tex: 0.08 },
    far: { base: 0.3, amp: 0.12, freq: 0.9, sharp: 0.1, ink: "#8a3812", wash: "#c0601e", fog: "#e08a3a", fogAmt: 0.35, fade: 0.1, dissolve: 0.4, edge: 0.15, heat: 1 },
    farMist: { y0: 0.22, y1: 0.36, color: "#ffb35a", color2: "#a84a12", alpha: 0.4, speed: 0.008, thresh: 0.25, soft: 0.3 },
    mid: { base: 0.16, amp: 0.15, freq: 1.1, sharp: 0.2, plat: 0.5, platAmt: 0.5, ink: "#5a200a", wash: "#9a4214", fog: "#c0601e", fogAmt: 0.1, fade: 0.15, edge: 0.4, cun: 0.35, heat: 1, rim: "#ffcf7a", rimAmt: 0.3 },
    near: { base: 0.02, amp: 0.12, freq: 1.8, sharp: 0.3, ink: "#2a0d04", wash: "#5a2009", fog: "#000000", fade: 0.25, cun: 0.4, edge: 0.8, heat: 0.6, rim: "#ff9a3a", rimAmt: 0.35 },
    particles: [{ count: 50, area: [-0.5, 0, 0.5, 0.7], vel: [0.004, 0.035], size: 0.01, color: "#ffd27a", color2: "#ff7a1a", sway: 0.02, twinkle: 0.7, additive: true, alpha: 0.6, life: 0.2 }],
    vignette: { color: "#120402", amt: 0.45 },
  }),

  // Kim: núi kiếm sắc nhọn viền bạc, kiếm khổng lồ cắm trên sống núi, ánh bạc lướt, tia lóe.
  kim: () => ({
    sky: { top: "#0c0e11", mid: "#262b32", bottom: "#69717d", midAt: 0.42, glow: { x: 0, y: 0.7, r: 0.35, color: "#2e343c" }, grain: 0.015 },
    disc: { x: -0.3, y: 0.8, r: 0.08, color: "#e9edf2", glow: "#8c96a3", glowSize: 0.8, glowAmt: 0.5, tex: 0.12 },
    far: { base: 0.32, amp: 0.36, freq: 2.2, sharp: 1, ink: "#3a4048", wash: "#626a75", fog: "#69717d", fogAmt: 0.35, fade: 0.15, dissolve: 0.6, edge: 0.3, rim: "#dfe5ec", rimAmt: 0.3 },
    farMist: { y0: 0.24, y1: 0.46, color: "#aab3be", color2: "#3a4048", alpha: 0.45, speed: 0.004, thresh: 0.25, soft: 0.3 },
    mid: { base: 0.18, amp: 0.4, freq: 2.6, sharp: 1, ink: "#1e2227", wash: "#434a53", fog: "#4a525c", fogAmt: 0.05, fade: 0.2, dissolve: 0.55, edge: 0.6, cun: 0.35, rim: "#eef2f6", rimAmt: 0.45 },
    hooks: {
      afterMid: swords("mid", 5, [0.16, 0.24], "#262b31", "#8f99a4", 0.5),
      afterNear: swords("near", 3, [0.3, 0.42], "#14171b", "#6d7682", 0.6),
    },
    midMist: { y0: 0.08, y1: 0.3, color: "#9aa4b0", color2: "#2a2f36", alpha: 0.45, speed: 0.005, thresh: 0.25, soft: 0.35 },
    near: { base: 0.02, amp: 0.2, freq: 2.8, sharp: 1, ink: "#0b0d10", wash: "#23272d", fog: "#000000", fade: 0.25, cun: 0.4, edge: 0.9, rim: "#c9d1da", rimAmt: 0.35 },
    particles: [{ count: 28, area: [-0.5, 0.05, 0.5, 0.95], vel: [0, 0.004], size: 0.03, color: "#ffffff", color2: "#d9dde3", shape: 5, twinkle: 1, life: 0.35, additive: true, alpha: 0.9 }],
    vignette: { color: "#030405", amt: 0.5 },
  }),

  // Thổ: cao nguyên mặt bằng có vân đá tầng, bia đá vuông, bụi đất bay ngang.
  tho: () => ({
    sky: { top: "#1b1309", mid: "#57391b", bottom: "#b8894a", midAt: 0.42, glow: { x: -0.2, y: 0.5, r: 0.4, color: "#6a4a20" }, grain: 0.015 },
    disc: { x: -0.4, y: 0.74, r: 0.06, color: "#ffe6b0", glow: "#c98a3a", glowSize: 1.2, glowAmt: 0.6 },
    far: { base: 0.3, amp: 0.26, freq: 1, sharp: 0.2, plat: 0.5, platAmt: 1, strata: 1, ink: "#5a3a1a", wash: "#8f6632", fog: "#a87a42", fogAmt: 0.35, fade: 0.2, dissolve: 0.5, edge: 0.3 },
    farMist: { y0: 0.24, y1: 0.4, color: "#d9b47a", color2: "#7a5428", alpha: 0.45, speed: 0.006, thresh: 0.25, soft: 0.3 },
    mid: { base: 0.16, amp: 0.3, freq: 1.2, sharp: 0.2, plat: 0.55, platAmt: 1, strata: 1, ink: "#3a240f", wash: "#6e4a22", fog: "#7a5428", fogAmt: 0.08, fade: 0.25, dissolve: 0.45, edge: 0.6, cun: 0.4, rim: "#f2c27a", rimAmt: 0.2 },
    hooks: { afterMid: steles(4, "#24160a") },
    midMist: { y0: 0.06, y1: 0.26, color: "#c99d62", color2: "#4a3016", alpha: 0.45, speed: 0.008, thresh: 0.25, soft: 0.35 },
    near: { base: 0.02, amp: 0.14, freq: 1.6, sharp: 0.2, plat: 0.6, platAmt: 0.8, strata: 1, ink: "#1f1408", wash: "#4a3216", fog: "#000000", fade: 0.25, cun: 0.4, edge: 0.8 },
    particles: [{ count: 70, area: [-0.5, 0, 0.5, 0.6], vel: [0.07, 0.006], size: 0.009, color: "#e2c08a", sway: 0.02, alpha: 0.4 }],
    vignette: { color: "#0a0603", amt: 0.45 },
  }),
};

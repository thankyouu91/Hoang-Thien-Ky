// Tông kem sáng cho dashboard (người dùng chọn 2026-11-03: "dùng màu vàng kem nhẹ để cho sáng"): nền kem, nét mực nhạt,
// sương trắng, màu hệ chỉ làm điểm nhấn. Đổi từ công thức tông tối theo vai trò từng lớp, để 12 hệ giữ cùng bố cục.
// Màu nền theo token của dashboard (proto/src/dashboard/tokens.css): --c-bg #f6efdf, --c-surface #fffaf0, --c-ink #2a2018.
import { ELEMENT_STYLE } from "../../theme/elements.ts";
import type { DiscOpts, MistOpts, ParticleOpts } from "../engine/layers.ts";
import { col, mixHex } from "../engine/stage.ts";
import type { ElementId } from "../types.ts";
import type { LayerOpts, Recipe } from "./compose.ts";

export const PAPER = "#f6efdf";
export const SURFACE = "#fffaf0";
export const INK = "#2a2018";

function lum(hex: string): number {
  const v = col(hex);
  return 0.2126 * v.x + 0.7152 * v.y + 0.0722 * v.z;
}

/** Mực của một hệ: mực nâu đen pha chút màu hệ. */
export function inkOf(el: ElementId): string {
  return mixHex(INK, ELEMENT_STYLE[el].color, 0.2);
}

/** Nét mực đậm k (0 = giấy, 1 = mực) của hệ trên nền kem. */
export function paperInk(el: ElementId, k: number): string {
  return mixHex(PAPER, inkOf(el), k);
}

/** Màu điểm xuyết đọc được trên nền kem: màu quá sáng thì kéo về phía mực. */
export function accentOnPaper(hex: string, el: ElementId): string {
  const l = lum(hex);
  return l > 0.45 ? mixHex(hex, inkOf(el), Math.min(0.75, (l - 0.35) * 1.3)) : hex;
}

/** Mỗi lớp núi: độ đậm của nét viền và của thân. */
const LAYER_K = { far: [0.28, 0.09], mid: [0.55, 0.19], near: [0.78, 0.32], fore: [0.92, 0.48] } as const;

interface Tweak {
  /** Độ đậm phần dưới mây (mây giông, sương ma đậm hơn). */
  cloud?: number;
  /** Đĩa trời: trăng tối (Cực âm), trăng nhạt, mặt trời màu hệ. */
  disc?: "toi" | "nhat" | "mat_troi";
  /** Màu hạt riêng (tuyết, tia lóe kim loại). */
  particle?: string;
}

const TWEAKS: Partial<Record<ElementId, Tweak>> = {
  loi: { cloud: 0.5 },
  am_lanh: { cloud: 0.3, disc: "nhat" },
  cuc_am: { cloud: 0.32, disc: "toi" },
  cuc_han: { particle: "#7aa3b8", disc: "nhat" },
  kim: { particle: "#7d8792", disc: "nhat" },
  thuy: { disc: "nhat" },
  quang: { particle: "#b8892a", disc: "mat_troi" },
  cuc_duong: { disc: "mat_troi" },
  tho: { disc: "mat_troi" },
};

export function toPaper(r: Recipe, el: ElementId): Recipe {
  const acc = ELEMENT_STYLE[el].color;
  const ink = inkOf(el);
  const tw = TWEAKS[el] ?? {};
  const layer = (o: LayerOpts | undefined, key: keyof typeof LAYER_K): LayerOpts | undefined => {
    if (!o) return undefined;
    const [k0, k1] = LAYER_K[key];
    return {
      ...o,
      ink: mixHex(PAPER, ink, k0),
      wash: mixHex(PAPER, ink, k1),
      fog: PAPER,
      fogAmt: key === "far" ? 0.12 : 0,
      rimAmt: 0,
      flash: undefined,
      snow: "#ffffff",
      trees: o.trees && { ...o.trees, color: mixHex(PAPER, ink, Math.min(1, k0 + 0.12)), color2: undefined },
    };
  };
  const mist = <T extends Omit<MistOpts, "depth"> | undefined>(m: T): T =>
    (m && { ...m, color: SURFACE, color2: mixHex(PAPER, ink, tw.cloud ?? 0.13), flash: undefined }) as T;
  const disc = (d: Omit<DiscOpts, "depth">): Omit<DiscOpts, "depth"> => {
    const kind = tw.disc ?? (d.corona ? "mat_troi" : "nhat");
    if (kind === "toi") return { ...d, color: mixHex(INK, acc, 0.45), glow: mixHex(PAPER, acc, 0.45), glowAmt: 0.35, tex: 0.2 };
    if (kind === "mat_troi") return { ...d, color: mixHex(SURFACE, acc, 0.7), glow: mixHex(PAPER, acc, 0.55), glowAmt: 0.55, tex: 0 };
    return { ...d, color: mixHex(PAPER, ink, 0.14), glow: mixHex(PAPER, ink, 0.06), glowAmt: 0.3, tex: 0.35, corona: 0 };
  };
  const part = (p: Omit<ParticleOpts, "depth">): Omit<ParticleOpts, "depth"> => ({
    ...p,
    additive: false,
    color: tw.particle ?? accentOnPaper(p.color, el),
    color2: tw.particle ?? accentOnPaper(p.color2 ?? p.color, el),
    alpha: (p.alpha ?? 1) * 0.75,
  });
  return {
    ...r,
    sky: {
      top: mixHex(SURFACE, acc, 0.05),
      mid: mixHex(PAPER, acc, 0.07),
      bottom: mixHex(PAPER, acc, 0.16),
      midAt: r.sky.midAt,
      glow: r.sky.glow && { ...r.sky.glow, color: mixHex("#000000", acc, 0.07) },
      stars: 0,
      grain: 0.03,
    },
    disc: r.disc && disc(r.disc),
    rays: r.rays && { ...r.rays, color: "#ffffff", alpha: (r.rays.alpha ?? 0.5) * 0.55 },
    high: r.high?.map(mist),
    far: layer(r.far, "far"),
    farMist: mist(r.farMist),
    mid: layer(r.mid, "mid"),
    midMist: mist(r.midMist),
    near: layer(r.near, "near"),
    nearMist: mist(r.nearMist),
    fore: layer(r.fore, "fore"),
    particles: r.particles?.map(part),
    vignette: { color: "#7a5f3a", amt: 0.14 },
  };
}

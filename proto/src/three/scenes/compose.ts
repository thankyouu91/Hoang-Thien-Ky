// Ghép một cảnh nền từ công thức: trời → đĩa trời, tia sáng → mây cao → núi xa → sương → núi giữa (+cây, công trình)
// → sương → núi gần (+cây) → sương thấp → tiền cảnh → hạt → viền tối. Mỗi hệ chỉ khai báo màu và phần riêng.
import type { Mesh } from "three";
import { disc, mist, particles, rays, ridge, ridgeAt, sky, vignette, type DiscOpts, type MistOpts, type ParticleOpts, type RidgeOpts, type RidgeShape, type SkyOpts } from "../engine/layers.ts";
import { broadleaf, deadTree, forest, pine, type Built } from "../engine/props.ts";
import type { Stage } from "../engine/stage.ts";

export type TreeKind = "pine" | "broad" | "dead";

export interface TreeRow {
  kind: TreeKind;
  color: string;
  color2?: string;
  count: number;
  /** Chiều cao cây theo đơn vị khung. */
  h: [number, number];
}

export type LayerOpts = Omit<RidgeOpts, "depth"> & { trees?: TreeRow };

export interface Refs {
  far?: Mesh & { shape: RidgeShape };
  mid?: Mesh & { shape: RidgeShape };
  near?: Mesh & { shape: RidgeShape };
}

export interface Recipe {
  sky: SkyOpts;
  /** Đĩa trời; x tính theo nửa bề rộng khung (-1 mép trái .. 1 mép phải). */
  disc?: Omit<DiscOpts, "depth">;
  rays?: { x: number; y: number; color: string; alpha?: number; count?: number; spread?: number };
  high?: Omit<MistOpts, "depth">[];
  far?: LayerOpts;
  farMist?: Omit<MistOpts, "depth">;
  mid?: LayerOpts;
  midMist?: Omit<MistOpts, "depth">;
  near?: LayerOpts;
  nearMist?: Omit<MistOpts, "depth">;
  fore?: LayerOpts;
  particles?: Omit<ParticleOpts, "depth">[];
  vignette?: { color: string; amt?: number; bottom?: number };
  /** Phần riêng của hệ, gọi ở đúng chỗ trong thứ tự lớp. */
  hooks?: {
    afterSky?: (s: Stage, refs: Refs) => void;
    afterFar?: (s: Stage, refs: Refs) => void;
    afterMid?: (s: Stage, refs: Refs) => void;
    afterNear?: (s: Stage, refs: Refs) => void;
    end?: (s: Stage, refs: Refs) => void;
  };
}

export interface ComposeExtra {
  /** Bỏ mặt trời, trăng. */
  noDisc?: boolean;
  /** Bỏ lớp trời, tia sáng, viền tối: nền trong suốt (Stage.transparent). */
  noSky?: boolean;
  /** Chèn công trình, điểm bản đồ ngay sau núi giữa (trước sương và núi gần). */
  afterMid?: (s: Stage, refs: Refs) => void;
  /** Chèn vật ở tiền cảnh, ngay sau núi gần. */
  afterNear?: (s: Stage, refs: Refs) => void;
  /** Bỏ hạt (ảnh nướng nhỏ cho thẻ: hạt thành lấm tấm bẩn). */
  noParticles?: boolean;
  /** Nhân số hạt (ảnh nướng nhỏ trên nền kem nên thưa hơn). */
  particleScale?: number;
}

const TREES: Record<TreeKind, (r: () => number) => Built> = { pine, broad: broadleaf, dead: deadTree };

function trees(s: Stage, layer: Mesh & { shape: RidgeShape }, row: TreeRow, depth: number): void {
  const variants = [0, 1, 2].map(() => TREES[row.kind](s.rand));
  const seeds = Array.from({ length: row.count }, () => [s.rand(), s.rand(), s.rand() < 0.5] as const);
  forest(
    s,
    variants,
    () => {
      const half = s.aspect / 2 + 0.05;
      return seeds.map(([a, b, flip]) => {
        const x = (a * 2 - 1) * half;
        return { x, y: ridgeAt(s, layer.shape, x) - 0.012, h: row.h[0] + (row.h[1] - row.h[0]) * b, flip };
      });
    },
    { color: row.color, color2: row.color2, depth, fadeFrom: layer.shape.base, fadeTo: layer.shape.base + layer.shape.amp },
  );
}

export function compose(s: Stage, r: Recipe, extra: ComposeExtra = {}): Refs {
  const refs: Refs = {};
  if (!extra.noSky) sky(s, r.sky);
  r.hooks?.afterSky?.(s, refs);
  if (r.disc && !extra.noDisc && !extra.noSky) {
    const d = r.disc;
    const m = disc(s, { ...d, x: 0 });
    s.onResize((a) => s.place(m, (d.x * a) / 2, d.y));
  }
  if (r.rays && !extra.noSky) rays(s, r.rays);
  for (const h of r.high ?? []) mist(s, { ...h, depth: 0.08 });
  const layer = (o: LayerOpts | undefined, depth: number, key: keyof Refs) => {
    if (!o) return;
    const m = ridge(s, { ...o, depth });
    refs[key] = m;
    if (o.trees) trees(s, m, o.trees, depth);
  };
  layer(r.far, 0.15, "far");
  r.hooks?.afterFar?.(s, refs);
  if (r.farMist) mist(s, { ...r.farMist, depth: 0.22 });
  layer(r.mid, 0.32, "mid");
  r.hooks?.afterMid?.(s, refs);
  extra.afterMid?.(s, refs);
  if (r.midMist) mist(s, { ...r.midMist, depth: 0.42 });
  layer(r.near, 0.6, "near");
  r.hooks?.afterNear?.(s, refs);
  extra.afterNear?.(s, refs);
  if (r.nearMist) mist(s, { ...r.nearMist, depth: 0.72 });
  if (r.fore) ridge(s, { ...r.fore, depth: 1 });
  if (!extra.noParticles) for (const p of r.particles ?? []) particles(s, { ...p, count: Math.max(1, Math.round(p.count * (extra.particleScale ?? 1))), depth: 0.85 });
  r.hooks?.end?.(s, refs);
  if (r.vignette && !extra.noSky) vignette(s, r.vignette);
  return refs;
}

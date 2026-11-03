// Nền cho chỗ chưa có hình PixelLab: cảnh theo hệ + bóng công trình (11 công trình GDD mục 5) hoặc điểm bản đồ (10 loại).
// Công trình đặt trên đỉnh cao nhất của núi giữa quanh giữa khung (lớp "mid"); vật tiền cảnh (linh thạch, suối, bến, hang)
// đặt ngay sau núi gần (lớp "near"). Cửa sổ sáng đèn ấm; cổng, trận pháp, linh thạch sáng theo màu hệ.
import { ELEMENT_STYLE } from "../../theme/elements.ts";
import type { BgKind, ElementId } from "../types.ts";
import { particles, peakIn, wave } from "../engine/layers.ts";
import {
  cauldron,
  cave,
  caveMouth,
  crystals,
  gate,
  hall,
  mine,
  pagoda,
  pier,
  place,
  plaza,
  portal,
  spring,
  terraces,
  tower,
  walls,
  type Built,
} from "../engine/props.ts";
import { mixHex, type Stage } from "../engine/stage.ts";
import { compose, type Recipe, type Refs } from "./compose.ts";
import { ELEMENT_RECIPES } from "./recipes.ts";

const LAMP = "#ffc56a";

interface Ctx {
  s: Stage;
  refs: Refs;
  recipe: Recipe;
  ink: string;
  accent: string;
}

interface Piece {
  at: "mid" | "near";
  run: (c: Ctx) => void;
}

type Shape = (r: () => number) => Built;

/** Bóng cao `scale` trên đỉnh cao nhất của núi giữa trong khoảng `range` (theo nửa bề rộng khung). */
function onPeak(b: Shape, scale: number, o: { range?: [number, number]; sink?: number } = {}): Piece {
  return {
    at: "mid",
    run: (c) => {
      const ref = c.refs.mid;
      if (!ref) return;
      const p = place(c.s, b(c.s.rand), {
        color: c.ink,
        color2: mixHex(c.ink, c.recipe.mid?.wash ?? c.ink, 0.3),
        glow: LAMP,
        scale,
        depth: 0.34,
        fadeFrom: ref.shape.base,
        fadeTo: ref.shape.base + ref.shape.amp,
      });
      const [a0, a1] = o.range ?? [-0.35, 0.35];
      c.s.onResize((a) => {
        const pk = peakIn(c.s, ref.shape, (a0 * a) / 2, (a1 * a) / 2);
        p.at(pk.x, pk.y - scale * (o.sink ?? 0.06));
      });
    },
  };
}

/** Vật ở chân khung, trước núi gần: x theo nửa bề rộng, y theo đơn vị khung. */
function atFoot(b: Shape, scale: number, x: number, y: number, o: { color?: string; glow?: (c: Ctx) => string; glowAlpha?: number } = {}): Piece {
  return {
    at: "near",
    run: (c) => {
      const p = place(c.s, b(c.s.rand), {
        color: o.color ?? mixHex(c.ink, "#000000", 0.35),
        glow: o.glow?.(c) ?? LAMP,
        glowAlpha: o.glowAlpha,
        scale,
        depth: 0.66,
      });
      c.s.onResize((a) => p.at((x * a) / 2, y));
    },
  };
}

/** Vòng trận pháp hoặc cổng bí cảnh. onRidge: đặt lên sống núi giữa ở x; squash < 1 là vòng nằm trên mặt đất. */
function ring(o: { x: number; y: number; r: number; squash?: number; onRidge?: boolean; at?: "mid" | "near"; tint?: string }): Piece {
  return {
    at: o.at ?? "mid",
    run: (c) => {
      const color = o.tint ? mixHex(c.accent, o.tint, 0.5) : c.accent;
      const m = portal(c.s, { x: 0, y: o.y, r: o.r, color, color2: mixHex(color, "#000000", 0.5), squash: o.squash, depth: o.at === "near" ? 0.66 : 0.35 });
      c.s.onResize((a) => {
        const x = (o.x * a) / 2;
        const ref = c.refs.mid;
        const y = o.onRidge && ref ? peakIn(c.s, ref.shape, x - 0.12, x + 0.12).y + o.r * (o.squash ?? 1) * 0.35 : o.y;
        c.s.place(m, x, y);
      });
    },
  };
}

function smoke(x: number, y0: number, light = false): Piece {
  return {
    at: "near",
    run: (c) =>
      void particles(c.s, {
        count: 16,
        area: [x - 0.04, y0, x + 0.04, y0 + 0.4],
        vel: [0.01, 0.05],
        size: 0.07,
        color: light ? "#d9d2c5" : "#3a3530",
        color2: light ? "#9a948a" : "#1a1714",
        sway: 0.03,
        swayF: 0.4,
        alpha: 0.35,
        life: 0.1,
        depth: 0.66,
      }),
  };
}

const water: Piece = {
  at: "near",
  run: (c) => {
    const w = mixHex(ELEMENT_STYLE.thuy.color, c.ink, 0.45);
    wave(c.s, { y: 0.15, amp: 0.016, k: 12, water: w, deep: mixHex(w, "#000000", 0.5), foam: mixHex(w, "#ffffff", 0.6), lines: 90, depth: 0.66 });
  },
};

const steam: Piece = {
  at: "near",
  run: (c) => void particles(c.s, { count: 20, area: [-0.2, 0.06, 0.2, 0.45], vel: [0.004, 0.04], size: 0.07, color: "#e8f2f0", sway: 0.02, swayF: 0.5, alpha: 0.18, life: 0.15, depth: 0.7 }),
};

/** 11 công trình, GDD mục 5 (mã như LocationId của dashboard/art/sectScene.ts). */
export const LOCATION_PIECES: Record<string, Piece[]> = {
  chinh_dien: [onPeak((r) => hall(r, 2, 1.2), 0.26)],
  tang_kinh_cac: [onPeak((r) => pagoda(r, 4), 0.34)],
  ho_son_dai_tran: [ring({ x: 0, y: 0.5, r: 0.17, squash: 0.32, onRidge: true }), onPeak((r) => hall(r, 1, 0.8), 0.14)],
  dien_vo_truong: [onPeak(plaza, 0.22)],
  luyen_dan_phong: [onPeak((r) => hall(r, 1, 0.9), 0.17, { range: [-0.5, 0] }), atFoot(cauldron, 0.24, 0.3, 0.03, { glow: () => "#ff8a3a" }), smoke(0.15, 0.14)],
  luyen_khi_cac: [onPeak((r) => hall(r, 2, 0.9), 0.22), ring({ x: -0.35, y: 0.08, r: 0.05, at: "near", tint: "#ff7a2a" }), smoke(-0.18, 0.12)],
  linh_duoc_vien: [onPeak(terraces, 0.24, { sink: 0.15 })],
  bao_kho: [onPeak((r) => hall(r, 1, 1.4), 0.2)],
  truyen_tong_tran: [ring({ x: 0.15, y: 0.45, r: 0.15, onRidge: true }), onPeak(gate, 0.16, { range: [-0.6, -0.25] })],
  thuong_hoi: [onPeak((r) => hall(r, 1, 0.8), 0.16, { range: [-0.5, -0.05] }), onPeak((r) => hall(r, 2, 0.7), 0.2, { range: [0.05, 0.5] })],
  phi_thang_dai: [onPeak((r) => pagoda(r, 3), 0.3), ring({ x: 0, y: 0.92, r: 0.12, squash: 0.3 })],
};

/** 10 loại điểm bản đồ (data/maps/ha_diem_*.json). */
export const POINT_PIECES: Record<string, Piece[]> = {
  thanh_chu: [onPeak(walls, 0.2, { sink: 0.2 })],
  son_mon: [onPeak(gate, 0.24, { sink: 0.02 })],
  ben_do: [water, atFoot(pier, 0.34, 0.05, 0.13)],
  deo: [onPeak(tower, 0.26, { range: [-0.15, 0.15] })],
  hang_di_thu: [atFoot(cave, 0.62, 0.05, -0.03, { color: "#0a0806" }), atFoot(caveMouth, 0.62, 0.05, -0.03, { color: "#030202", glow: (c) => c.accent })],
  linh_tuyen: [atFoot(spring, 0.5, 0, 0.05, { glow: (c) => mixHex(c.accent, "#ffffff", 0.3), glowAlpha: 0.85 }), steam],
  mo_duoc: [onPeak(terraces, 0.26, { sink: 0.15 })],
  mo_linh_thach: [atFoot((r) => crystals(r, 7), 0.48, 0.1, 0.02, { glow: (c) => mixHex(c.accent, "#7fe8ff", 0.5), glowAlpha: 0.9 }), ring({ x: 0.1, y: 0.07, r: 0.26, squash: 0.4, at: "near", tint: "#7fe8ff" })],
  mo_quang: [atFoot(mine, 0.46, -0.1, 0.02, { glow: () => "#ffb04a", glowAlpha: 0.7 })],
  cua_bi_canh: [ring({ x: 0, y: 0.4, r: 0.17, onRidge: true })],
};

/** Ghép cảnh hệ với công trình hoặc điểm. variant không có trong bảng thì chỉ còn cảnh hệ. */
export function composePlace(s: Stage, kind: BgKind, el: ElementId, variant?: string): void {
  const recipe = ELEMENT_RECIPES[el]();
  const table = kind === "cong_trinh" ? LOCATION_PIECES : kind === "diem" ? POINT_PIECES : {};
  const pieces = (variant && table[variant]) || [];
  const ctx = (st: Stage, refs: Refs): Ctx => ({ s: st, refs, recipe, ink: mixHex(recipe.mid?.ink ?? "#0c0a08", "#000000", 0.35), accent: ELEMENT_STYLE[el].color });
  compose(s, recipe, {
    afterMid: (st, refs) => pieces.filter((p) => p.at === "mid").forEach((p) => p.run(ctx(st, refs))),
    afterNear: (st, refs) => pieces.filter((p) => p.at === "near").forEach((p) => p.run(ctx(st, refs))),
  });
}

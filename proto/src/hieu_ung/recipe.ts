// Công thức hiệu ứng của một chiêu thức, ghép tự động từ dữ liệu công pháp (người dùng chốt 2026-11-04):
// - loại chiêu quyết định hình dạng (chieu.ts);
// - hệ chủ cho màu chính và nét riêng khi trúng (he.ts);
// - hệ phụ cho màu phụ và vệt kéo đi kèm;
// - biến thể: Bạo va chạm to; Tốc nhanh, nhiều vệt mảnh; Linh nét hệ đậm hơn; Bền chậm, êm;
// - phẩm càng cao càng nhiều hạt và càng sáng;
// - chiêu đặc biệt (không phải đòn thường) và chiêu cuối tông chủ được vẽ riêng cho nổi bật.
// Cùng một công pháp thì công thức và seed giống hệt, nên lúc nào cũng ra đúng một hình.
import { COLORS, type ElementColors } from "./emit.ts";
import { hash } from "./ve.ts";
import type { ElementId, SkillId } from "../replay/types.ts";
import type { Cast } from "./types.ts";

export type Variant = "bao" | "toc" | "linh" | "ben";
export const VARIANTS: readonly Variant[] = ["bao", "toc", "linh", "ben"];

/** Dữ liệu công pháp mà hiệu ứng cần. */
export interface FxStyle {
  skill: SkillId;
  element: ElementId;
  subs?: readonly ElementId[];
  variant?: Variant;
  /** Phẩm 1–10 (GDD mục 9) */
  grade?: number;
}

export interface Recipe {
  key: string;
  skill: SkillId;
  el: ElementId;
  /** Hệ phụ khác hệ chủ, không lặp */
  subs: ElementId[];
  variant: Variant | null;
  grade: number;
  main: ElementColors;
  /** Màu vệt kéo: hệ phụ đầu tiên, không có thì hệ chủ */
  trail: ElementColors;
  trailEl: ElementId;
  /** Chiêu đặc biệt: mọi loại trừ đòn thường cận chiến đơn và tầm xa */
  special: boolean;
  /** Cỡ va chạm (Bạo to hơn) */
  impact: number;
  /** Nhân thời lượng (Tốc ngắn, Bền dài) */
  pace: number;
  /** Số vệt mảnh, bóng mờ (Tốc nhiều hơn) */
  streaks: number;
  /** Độ đậm nét hệ khi trúng (Linh đậm hơn) */
  sig: number;
  /** Bền: nét mềm, ít giật */
  smooth: number;
  /** Nhân số hạt theo phẩm */
  density: number;
  /** Nhân độ sáng theo phẩm */
  bright: number;
  /** Bậc trang trí thêm theo phẩm: 0 (1–3), 1 (4–6), 2 (7–9), 3 (10) */
  tier: number;
  /** Seed riêng của công thức (lệch góc chém, chọn hạt) */
  seed: number;
}

/** Phẩm mặc định khi replay chưa ghi phẩm công pháp. */
export const DEFAULT_GRADE = 3;
/** Đòn thường: hồi chiêu ngắn, vẽ gọn để màn hình khỏi rối. */
export const BASIC: ReadonlySet<SkillId> = new Set<SkillId>(["can_don", "tam_xa"]);

const cache = new Map<string, Recipe>();

export function recipe(s: FxStyle): Recipe {
  const subs: ElementId[] = [];
  for (const el of s.subs ?? []) if (el !== s.element && !subs.includes(el)) subs.push(el);
  const grade = Math.max(1, Math.min(10, Math.round(s.grade ?? DEFAULT_GRADE)));
  const variant = s.variant ?? null;
  const key = `${s.skill}|${s.element}|${subs.join(",")}|${variant ?? "-"}|${grade}`;
  const hit = cache.get(key);
  if (hit) return hit;
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (Math.imul(h, 31) + key.charCodeAt(i)) | 0;
  const trailEl = subs[0] ?? s.element;
  const r: Recipe = {
    key,
    skill: s.skill,
    el: s.element,
    subs,
    variant,
    grade,
    main: COLORS[s.element],
    trail: COLORS[trailEl],
    trailEl,
    special: !BASIC.has(s.skill),
    impact: variant === "bao" ? 1.45 : variant === "ben" ? 0.92 : 1,
    pace: variant === "toc" ? 0.72 : variant === "ben" ? 1.35 : 1,
    streaks: variant === "toc" ? 3 : 1,
    sig: variant === "linh" ? 1.7 : 1,
    smooth: variant === "ben" ? 1 : 0,
    density: 0.55 + 0.09 * grade,
    bright: 0.74 + 0.034 * grade,
    tier: grade >= 10 ? 3 : grade >= 7 ? 2 : grade >= 4 ? 1 : 0,
    seed: hash(h),
  };
  cache.set(key, r);
  return r;
}

/**
 * Hệ số giảm hạt của khung đang ghép (1 khi ít chiêu, nhỏ dần khi nhiều chiêu cùng lúc), để 10 đấu 10 ở ×4 vẫn nhẹ.
 * canh.ts đặt mỗi khung từ số lần ra chiêu quanh t, nên vẫn là hàm của (replay, t, tốc độ).
 */
let crowd = 1;
export function setCrowd(k: number): void {
  crowd = k;
}

/** Số hạt theo phẩm: n hạt ở phẩm trung bình, nhân hệ số giảm khi đông. */
export function count(r: Recipe, n: number): number {
  return Math.max(1, Math.round(n * r.density * crowd));
}

/** Công thức của một lần ra chiêu trong replay: phẩm và biến thể nếu replay có ghi, không thì mặc định. */
export function recipeOf(c: Cast): Recipe {
  const extra = c as Cast & { grade?: number; variant?: Variant };
  return recipe({ skill: c.skill, element: c.element, subs: c.subElements, variant: extra.variant, grade: extra.grade });
}

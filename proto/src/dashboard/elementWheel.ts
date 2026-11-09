// Vòng 12 hệ làm nền khu Pháp tướng (màn Nhân vật). Năm hệ gốc xếp ngũ giác theo vòng sinh Mộc → Hỏa → Thổ → Kim → Thủy,
// mỗi hệ biến dị đứng ngoài hệ gốc của nó, Quang và Âm Lãnh ở hai khoảng trống. Vạch nối lấy đúng luật của @htk/sim
// (GDD mục 8): tương sinh, tương khắc giữa hệ gốc, biến dị nối về hệ gốc, đối cực nét đứt. Hệ linh căn sáng, hệ khác mờ.
import { beatsEither, ELEMENTS, generatesEither, isOpposite, parentOf, type Element } from "@htk/sim";
import { ELEMENT_STYLE } from "../theme/elements.ts";
import { heArt } from "./ui.ts";

/** Tâm và cỡ vòng theo đơn vị viewBox 200 × 200; cảnh three của Pháp tướng (art/phapTuong.ts) dùng cùng bố cục. */
export const C = 100;
/** Bán kính hai vòng tròn mảnh và của ô hệ. */
export const RINGS = [62, 94] as const;
export const NODE_R = 11;
const ANGLE: Record<Element, number> = {
  moc: -90, hoa: -18, tho: 54, kim: 126, thuy: 198,
  phong: -90, cuc_duong: -18, cuc_am: 54, loi: 126, cuc_han: 198,
  quang: -126, am_lanh: 90,
};
const RADIUS = (e: Element) => (parentOf(e) || e === "quang" || e === "am_lanh" ? 80 : 46);

export function at(e: Element): { x: number; y: number } {
  const a = (ANGLE[e] * Math.PI) / 180;
  return { x: C + RADIUS(e) * Math.cos(a), y: C + RADIUS(e) * Math.sin(a) };
}

/** Các cặp hệ có quan hệ, mỗi cặp một lần. */
export type LinkKind = "sinh" | "khac" | "bien" | "cuc";

function links(): { a: Element; b: Element; kind: LinkKind }[] {
  const out: { a: Element; b: Element; kind: LinkKind }[] = [];
  for (let i = 0; i < ELEMENTS.length; i++)
    for (let j = i + 1; j < ELEMENTS.length; j++) {
      const a = ELEMENTS[i];
      const b = ELEMENTS[j];
      const base = !parentOf(a) && !parentOf(b);
      if (isOpposite(a, b)) out.push({ a, b, kind: "cuc" });
      else if (parentOf(a) === b || parentOf(b) === a) out.push({ a, b, kind: "bien" });
      else if (base && generatesEither(a, b)) out.push({ a, b, kind: "sinh" });
      else if (base && beatsEither(a, b)) out.push({ a, b, kind: "khac" });
    }
  return out;
}

export const LINKS = links();

/** Cỡ hình ngọc hệ trong vòng (đơn vị viewBox); hệ linh căn to hơn. */
const ORB = 22;
const ORB_ON = 28;

/**
 * SVG vòng hệ, `roots` là linh căn của nhân vật. Mỗi hệ là viên ngọc vẽ Canva (assets/icon_ve/he). Hệ linh căn sáng
 * và có hiệu ứng: quầng màu hệ thở, vòng chấm xoay, ba đốm linh khí bay quanh (game.css; tắt khi giảm chuyển động).
 * Hệ khác mờ và nhạt màu.
 */
export function elementWheel(roots: Element[]): string {
  const lit = new Set(roots);
  const lines = LINKS.map(({ a, b, kind }) => {
    const p = at(a);
    const q = at(b);
    const on = lit.has(a) || lit.has(b);
    return `<line class="wl ${kind}${on ? " on" : ""}" x1="${p.x.toFixed(1)}" y1="${p.y.toFixed(1)}" x2="${q.x.toFixed(1)}" y2="${q.y.toFixed(1)}"/>`;
  }).join("");
  const glow = ELEMENTS.filter((e) => lit.has(e))
    .map((e) => `<radialGradient id="wg-${e}"><stop offset="0.35" stop-color="${ELEMENT_STYLE[e].color}" stop-opacity="0.75"/><stop offset="1" stop-color="${ELEMENT_STYLE[e].color}" stop-opacity="0"/></radialGradient>`)
    .join("");
  const nodes = ELEMENTS.map((e) => {
    const p = at(e);
    const st = ELEMENT_STYLE[e];
    const on = lit.has(e);
    const s = on ? ORB_ON : ORB;
    const fx = on
      ? `<circle class="w-glow" r="${s * 0.95}" fill="url(#wg-${e})"/><circle class="w-ring" r="${s * 0.66}" style="stroke:${st.color}"/><g class="w-sparks" style="fill:${st.color}"><circle cx="${s * 0.62}" r="1.3"/><circle cx="${-s * 0.62}" r="1"/><circle cy="${s * 0.62}" r="0.8"/><circle cy="${-s * 0.62}" r="0.8" opacity="0"/></g>`
      : "";
    return `<g class="wn${on ? " on" : ""}" transform="translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})"><title>${st.name}${on ? " · linh căn" : ""}</title>
      ${fx}<image class="w-orb" href="${heArt(e)}" x="${-s / 2}" y="${-s / 2}" width="${s}" height="${s}"/></g>`;
  }).join("");
  return `<svg class="pt-wheel" viewBox="0 0 200 200" aria-hidden="true"><defs>${glow}</defs>${RINGS.map((r) => `<circle class="ring" cx="${C}" cy="${C}" r="${r}"/>`).join("")}${lines}${nodes}</svg>`;
}

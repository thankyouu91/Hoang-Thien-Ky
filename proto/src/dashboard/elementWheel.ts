// Vòng 12 hệ làm nền khu Pháp tướng (màn Nhân vật). Năm hệ gốc xếp ngũ giác theo vòng sinh Mộc → Hỏa → Thổ → Kim → Thủy,
// mỗi hệ biến dị đứng ngoài hệ gốc của nó, Quang và Âm Lãnh ở hai khoảng trống. Vạch nối lấy đúng luật của @ktlp/sim
// (GDD mục 8): tương sinh, tương khắc giữa hệ gốc, biến dị nối về hệ gốc, đối cực nét đứt. Hệ linh căn sáng, hệ khác mờ.
import { beatsEither, ELEMENTS, generatesEither, isOpposite, parentOf, type Element } from "@ktlp/sim";
import { ELEMENT_STYLE } from "../theme/elements.ts";
import { assetUrl } from "./ui.ts";

const C = 100;
const ANGLE: Record<Element, number> = {
  moc: -90, hoa: -18, tho: 54, kim: 126, thuy: 198,
  phong: -90, cuc_duong: -18, cuc_am: 54, loi: 126, cuc_han: 198,
  quang: -126, am_lanh: 90,
};
const RADIUS = (e: Element) => (parentOf(e) || e === "quang" || e === "am_lanh" ? 80 : 46);

function at(e: Element): { x: number; y: number } {
  const a = (ANGLE[e] * Math.PI) / 180;
  return { x: C + RADIUS(e) * Math.cos(a), y: C + RADIUS(e) * Math.sin(a) };
}

/** Các cặp hệ có quan hệ, mỗi cặp một lần. */
function links(): { a: Element; b: Element; kind: "sinh" | "khac" | "bien" | "cuc" }[] {
  const out: { a: Element; b: Element; kind: "sinh" | "khac" | "bien" | "cuc" }[] = [];
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

const LINKS = links();

/** SVG vòng hệ, `roots` là linh căn của nhân vật. */
export function elementWheel(roots: Element[]): string {
  const lit = new Set(roots);
  const lines = LINKS.map(({ a, b, kind }) => {
    const p = at(a);
    const q = at(b);
    const on = lit.has(a) || lit.has(b);
    return `<line class="wl ${kind}${on ? " on" : ""}" x1="${p.x.toFixed(1)}" y1="${p.y.toFixed(1)}" x2="${q.x.toFixed(1)}" y2="${q.y.toFixed(1)}"/>`;
  }).join("");
  const nodes = ELEMENTS.map((e) => {
    const p = at(e);
    const st = ELEMENT_STYLE[e];
    const on = lit.has(e);
    return `<g class="wn${on ? " on" : ""}" transform="translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})"><title>${st.name}${on ? " · linh căn" : ""}</title>
      ${on ? `<circle r="15" class="halo"/>` : ""}<circle r="11" style="stroke:${st.color}"/>
      <image href="${assetUrl(`he/${e}`)}" x="-8" y="-8" width="16" height="16"/></g>`;
  }).join("");
  return `<svg class="pt-wheel" viewBox="0 0 200 200" aria-hidden="true"><circle class="ring" cx="${C}" cy="${C}" r="94"/><circle class="ring" cx="${C}" cy="${C}" r="62"/>${lines}${nodes}</svg>`;
}

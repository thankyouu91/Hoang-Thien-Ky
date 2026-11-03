// Tên cảnh → hàm dựng Stage. index.ts chỉ biết tới bảng này qua import() động.
import { ELEMENT_STYLE } from "../../theme/elements.ts";
import type { BgKind, ElementId, SceneName, SceneParams, TalentId, Tone } from "../types.ts";
import type { Host, ProgramFactory } from "../engine/host.ts";
import { particles } from "../engine/layers.ts";
import { mixHex, Stage } from "../engine/stage.ts";
import { compose } from "./compose.ts";
import { composePlace } from "./places.ts";
import { accentOnPaper, toPaper } from "./paper.ts";
import { ELEMENT_RECIPES, sonThuy } from "./recipes.ts";
import { talentScene } from "./talents.ts";

/**
 * Hạt linh khí: chấm nhỏ bay lên lượn nhẹ, vài quả cầu mờ, vài vệt khí. Nền tối: cộng màu cho sáng lên; nền kem: cộng
 * màu không thấy được, nên hòa thường với màu ngọc, vàng đậm hơn (hoặc màu hệ kéo về phía mực).
 */
export function linhKhi(s: Stage, el?: ElementId, strength = 1): void {
  const kem = s.tone === "giay";
  const c1 = el ? (kem ? accentOnPaper(ELEMENT_STYLE[el].color, el) : ELEMENT_STYLE[el].color) : kem ? "#2f8f7a" : "#7fd1bd";
  const c2 = el ? mixHex(c1, kem ? "#b3261e" : "#ffffff", kem ? 0.15 : 0.45) : kem ? "#b08422" : "#d9b45a";
  const add = !kem;
  const k = kem ? 0.7 : 1;
  particles(s, { count: Math.round(80 * strength), area: [-0.5, -0.05, 0.5, 1.05], vel: [0.003, 0.028], size: 0.009, color: c1, color2: c2, sway: 0.025, swayF: 0.9, twinkle: 0.7, additive: add, alpha: 0.9 * k, depth: 0.8 });
  particles(s, { count: Math.round(12 * strength), area: [-0.5, -0.05, 0.5, 1.05], vel: [0.004, 0.012], size: 0.04, color: c1, color2: c2, sway: 0.04, swayF: 0.5, life: 0.1, additive: add, alpha: 0.38 * k, depth: 0.95 });
  particles(s, { count: Math.round(8 * strength), area: [-0.5, -0.05, 0.5, 1.05], vel: [0, 0.07], size: 0.06, color: c2, shape: 3, sway: 0.05, swayF: 0.6, life: 0.15, additive: add, alpha: 0.18 * k, depth: 0.9 });
}

export function sceneFactory(name: SceneName, p: SceneParams = {}): ProgramFactory {
  return (host: Host) => {
    const s = new Stage(host, `${name}|${p.seed ?? 1}`);
    s.tone = p.tone ?? "giay";
    if (name === "linh_khi") {
      s.transparent = true;
      linhKhi(s, p.element);
    } else if (name.startsWith("tai_nang:")) {
      s.tone = "giay";
      talentScene(s, name.slice("tai_nang:".length) as TalentId, { wash: p.wash });
      if (p.linhKhi) linhKhi(s, p.element, 0.5);
    } else {
      const dark = name === "son_thuy" ? null : ELEMENT_RECIPES[name as ElementId]();
      s.transparent = p.sky === false;
      compose(s, dark === null ? sonThuy(s.tone) : s.tone === "giay" ? toPaper(dark, name as ElementId) : dark, { noDisc: p.disc === false, noSky: p.sky === false });
      if (p.linhKhi) linhKhi(s, p.element ?? (name === "son_thuy" ? undefined : (name as ElementId)), 0.6);
    }
    s.resize(1, 1, 1);
    return s;
  };
}

export function placeFactory(kind: BgKind, el: ElementId, seed: number | string, variant?: string, tone: Tone = "giay"): ProgramFactory {
  return (host: Host) => {
    const s = new Stage(host, `${kind}|${el}|${variant ?? ""}|${seed}`);
    s.tone = tone;
    composePlace(s, kind, el, variant);
    s.resize(1, 1, 1);
    return s;
  };
}

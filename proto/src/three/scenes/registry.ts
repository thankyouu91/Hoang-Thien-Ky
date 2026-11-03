// Tên cảnh → hàm dựng Stage. index.ts chỉ biết tới bảng này qua import() động.
import { ELEMENT_STYLE } from "../../theme/elements.ts";
import type { BgKind, ElementId, SceneName, SceneParams } from "../types.ts";
import type { Host, ProgramFactory } from "../engine/host.ts";
import { particles } from "../engine/layers.ts";
import { mixHex, Stage } from "../engine/stage.ts";
import { compose } from "./compose.ts";
import { composePlace } from "./places.ts";
import { ELEMENT_RECIPES, sonThuy } from "./recipes.ts";

/** Hạt linh khí: chấm sáng nhỏ bay lên lượn nhẹ, vài quả cầu mờ, vài vệt khí; cộng màu nên sáng lên trên mọi nền. */
export function linhKhi(s: Stage, el?: ElementId, strength = 1): void {
  const c1 = el ? ELEMENT_STYLE[el].color : "#7fd1bd";
  const c2 = el ? mixHex(ELEMENT_STYLE[el].color, "#ffffff", 0.45) : "#d9b45a";
  particles(s, { count: Math.round(80 * strength), area: [-0.5, -0.05, 0.5, 1.05], vel: [0.003, 0.028], size: 0.009, color: c1, color2: c2, sway: 0.025, swayF: 0.9, twinkle: 0.7, additive: true, alpha: 0.9, depth: 0.8 });
  particles(s, { count: Math.round(12 * strength), area: [-0.5, -0.05, 0.5, 1.05], vel: [0.004, 0.012], size: 0.04, color: c1, color2: c2, sway: 0.04, swayF: 0.5, life: 0.1, additive: true, alpha: 0.38, depth: 0.95 });
  particles(s, { count: Math.round(8 * strength), area: [-0.5, -0.05, 0.5, 1.05], vel: [0, 0.07], size: 0.06, color: c2, shape: 3, sway: 0.05, swayF: 0.6, life: 0.15, additive: true, alpha: 0.18, depth: 0.9 });
}

export function sceneFactory(name: SceneName, p: SceneParams = {}): ProgramFactory {
  return (host: Host) => {
    const s = new Stage(host, `${name}|${p.seed ?? 1}`);
    if (name === "linh_khi") {
      s.transparent = true;
      linhKhi(s, p.element);
    } else {
      compose(s, name === "son_thuy" ? sonThuy(p.tone ?? "chang_vang") : ELEMENT_RECIPES[name]());
      if (p.linhKhi) linhKhi(s, p.element, 0.6);
    }
    s.resize(1, 1, 1);
    return s;
  };
}

export function placeFactory(kind: BgKind, el: ElementId, seed: number | string, variant?: string): ProgramFactory {
  return (host: Host) => {
    const s = new Stage(host, `${kind}|${el}|${variant ?? ""}|${seed}`);
    composePlace(s, kind, el, variant);
    s.resize(1, 1, 1);
    return s;
  };
}

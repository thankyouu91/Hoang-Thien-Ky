// Lớp hiệu ứng chiêu bằng Three.js cho màn Trận. Màn chỉ import file này (không kéo three); three và mã hiệu ứng nằm ở
// chunk nạp động lần đầu gọi createSkillFx, dùng renderer chung của proto/src/three ở chế độ driven: màn gọi frame()
// trong rAF của nó, cùng khung với phần vẽ 2D, theo thời điểm replay.
//
//   const fx3d = createSkillFx(canvas);          // canvas #view của App; lớp WebGL phủ đúng lên nó, dưới HUD và thanh dưới
//   mỗi khung: fx3d.frame(input, camera, dt)     // input: replay, t, tốc độ, vị trí người; camera: như app/camera.ts + rung
//   if (!fx3d.active) { fx.ground(); fx.air(); } // máy không có WebGL2, hoặc chunk chưa nạp xong: giữ bản 2D (fx2d.ts)
//   rời màn: fx3d.show(false); vào màn: fx3d.show(true)
import { hasWebGL, mountProgram, type LiveMount } from "../three/index.ts";
import type { FxCamera, FxInput } from "./types.ts";

export type { FxCamera, FxInput, StatusKind, StatusSpan } from "./types.ts";
export type { FxStyle, Variant } from "./recipe.ts";

export interface SkillFxStats {
  /** Số tấm đã vẽ ở khung trước (đất, thân, không) */
  quads: number[];
  /** Số tấm bị bỏ vì đầy bộ đệm */
  dropped: number;
  /** ms JS ghép tấm ở khung trước */
  emitMs: number;
}

export interface SkillFx {
  /** true khi lớp Three.js đã vẽ được khung trước; false thì màn vẽ hiệu ứng 2D */
  readonly active: boolean;
  /** true khi đã gắn được vào renderer chung; false khi không có WebGL2 hay lỗi */
  readonly ready: Promise<boolean>;
  frame(input: FxInput, cam: FxCamera, dt: number): void;
  show(on: boolean): void;
  stats(): SkillFxStats;
  dispose(): void;
}

const CLASS = "ktlp-hieu-ung";
let styled = false;

function addStyle(): void {
  if (styled) return;
  styled = true;
  const st = document.createElement("style");
  // Lớp phủ đúng chỗ canvas #view; chỉ hiện ở màn Trận (App đặt body[data-scene]).
  st.textContent = `.${CLASS}{position:fixed;inset:0;width:100vw;height:100dvh;pointer-events:none}
body:not([data-scene="tran"]) .${CLASS}{display:none}`;
  document.head.append(st);
}

type Engine = typeof import("./engine.ts");

export function createSkillFx(anchor: HTMLElement): SkillFx {
  let active = false;
  let disposed = false;
  let live: LiveMount | null = null;
  let program: ReturnType<Engine["createFxProgram"]> | null = null;
  let engine: Engine | null = null;
  let emitMs = 0;
  if (!hasWebGL()) {
    return { active: false, ready: Promise.resolve(false), frame() {}, show() {}, stats: () => ({ quads: [0, 0, 0], dropped: 0, emitMs: 0 }), dispose() {} };
  }
  addStyle();
  const el = document.createElement("div");
  el.className = CLASS;
  el.setAttribute("aria-hidden", "true");
  anchor.after(el);

  const ready = (async () => {
    try {
      engine = await import("./engine.ts");
      if (disposed) return false;
      live = await mountProgram(el, () => (program = engine!.createFxProgram()), { layer: "front", driven: true, dprCap: 1.5 });
      return !!live;
    } catch (err) {
      console.warn("hieu_ung: không gắn được lớp Three.js, giữ hiệu ứng 2D", err);
      return false;
    }
  })();

  return {
    get active() {
      return active;
    },
    ready,
    frame(input, cam, dt) {
      if (!live || !engine || el.hidden) {
        active = false;
        return;
      }
      if (program) {
        const t0 = performance.now();
        engine.emitFrame(program.emitter, input);
        emitMs = performance.now() - t0;
        program.setCamera(cam);
      }
      active = live.render(dt, input.t / input.index.replay.tps) && !!program;
    },
    show(on) {
      el.hidden = !on;
      if (!on) active = false;
    },
    stats() {
      const e = program?.emitter;
      return { quads: e ? [...e.count] : [0, 0, 0], dropped: e?.dropped ?? 0, emitMs };
    },
    dispose() {
      disposed = true;
      live?.dispose();
      live = null;
      el.remove();
      active = false;
    },
  };
}

// Ngữ cảnh một khung cho các hàm hiệu ứng: bộ đệm, đầu vào của màn Trận, vị trí chân và thân người.
import type { Emitter } from "./emit.ts";
import type { Cast, FxInput, Point } from "./types.ts";
import type { ElementId } from "../replay/types.ts";

/** Độ cao (đơn vị thế giới) của ngực, đầu và đỉnh đầu so với chân, khớp hình người 56 đơn vị của màn Trận. */
export const BODY_Z = 24;
export const HEAD_Z = 44;
export const TOP_Z = 58;

export interface Ctx {
  e: Emitter;
  f: FxInput;
  /** Thời điểm phát, tick */
  t: number;
  tps: number;
  /** Điểm chân của một người (mặt đất) ở thời điểm time (mặc định t) */
  foot(id: number, time?: number): Point | null;
  alive(id: number, time?: number): boolean;
  /** Hệ số độ sáng của vòng, trận đồ trên đất khi nhiều chiêu diện rộng, trận pháp chồng nhau (1 khi chỉ một) */
  zoneK: number;
}

export function makeCtx(e: Emitter, f: FxInput): Ctx {
  const half = f.size / 2;
  return {
    e,
    f,
    t: f.t,
    tps: f.index.replay.tps,
    zoneK: 1,
    foot(id, time) {
      const p = f.at(id, time);
      return p ? { x: p.x, y: p.y + half } : null;
    },
    alive(id, time = f.t) {
      const ut = f.index.byId.get(id);
      return !!ut && ut.death > time;
    },
  };
}

/** Hệ chủ rồi các hệ phụ khác hệ chủ, không lặp. */
export function palette(c: Cast): ElementId[] {
  const out: ElementId[] = [c.element];
  for (const el of c.subElements ?? []) if (!out.includes(el)) out.push(el);
  return out;
}

/** Điểm giữa các mục tiêu (dưới chân) ở thời điểm time. */
export function aim(x: Ctx, c: Cast, time?: number): Point | null {
  let sx = 0;
  let sy = 0;
  let n = 0;
  for (const id of c.targets) {
    const p = x.foot(id, time);
    if (!p) continue;
    sx += p.x;
    sy += p.y;
    n++;
  }
  return n ? { x: sx / n, y: sy / n } : null;
}

/** Seed của một sự kiện ra chiêu (tick, người ra, mục tiêu đầu, loại chiêu). */
export function castSeed(c: Cast): number {
  let s = 0;
  for (let i = 0; i < c.skill.length; i++) s = (s * 31 + c.skill.charCodeAt(i)) | 0;
  return (c.tick * 7919) ^ (c.unit * 104729) ^ ((c.targets[0] ?? 0) * 1299709) ^ s;
}

// Chuyển động thân người trong trận (gói 1, 2026-11-05): khựng và khung va chạm khi trúng đòn, bị đẩy lùi theo cung
// rồi lắng, nhún theo bước khi đi, bụi dưới chân, bóng mờ khi lướt nhanh, tan thành hạt hệ khi ngã. Theo công thức
// đạo diễn chuyển động (docs/CHUYEN_DONG.md) và dùng chung nhịp với hiệu ứng chiêu (hieu_ung/nhip.ts, DONG_TAC.md):
// người trúng đòn khựng đúng IMPACT_FRAMES + holdOf của chiêu gây đòn, đếm theo giây thực.
// Chỉ mục dựng một lần lúc nạp trận; mỗi khung là hàm thuần của t, không giữ trạng thái, nên tua và đổi tốc độ vẫn đúng.
import { holdOf, NO_CONTACT } from "../../hieu_ung/chung.ts";
import { burst, seed } from "../../hieu_ung/motifs.ts";
import { ease, HIT_STOP_FRAMES, IMPACT_FRAMES } from "../../hieu_ung/nhip.ts";
import { recipeOf } from "../../hieu_ung/recipe.ts";
import type { ReplayIndex, UnitTimeline } from "../../replay/timeline.ts";
import type { ElementId, ReplayEvent, SkillId } from "../../replay/types.ts";

type Cast = Extract<ReplayEvent, { kind: "cast" }>;

/** Khung chuẩn 30/giây thực, như hiệu ứng chiêu. */
const FPS = 30;
/** Đòn từ 3% máu tối đa trở lên mới có khung va chạm, khựng và bị đẩy (đề xuất). */
const HEAVY = 0.03;
/** Trọng số đầy (cú đẩy, bè ra lớn nhất) ở đòn 10% máu. */
const FULL = 0.1;
/** Đi chậm hơn ngần này (milli-ô mỗi tick) coi như đứng yên; nhanh hơn LUOT là lướt (có bóng mờ). */
const WALK = 3;
const LUOT = 120;
/** Cận chiến: có vệt vũ khí khi ra chiêu. */
export const MELEE: ReadonlySet<SkillId> = new Set<SkillId>(["can_don", "can_quet", "than_phap"]);

/** Một đòn nặng vào một người: tick trúng, người đánh, trọng số 0–1, số khung đứng (khung va chạm + khựng). */
interface Blow {
  tick: number;
  src: number;
  w: number;
  stop: number;
}

export interface Point {
  x: number;
  y: number;
}

/** Thân người tại một khung. */
export interface BodyMotion {
  /** Thời điểm dùng để chọn khung hoạt ảnh: đứng yên trong lúc khựng. */
  tPose: number;
  /** Dời thân (đơn vị thế giới): bị đẩy, nảy, nhún bước. */
  dx: number;
  dy: number;
  /** Co giãn quanh chân. */
  sx: number;
  sy: number;
  /** Khung va chạm: 0 trắng, 1 mực, -1 không. */
  impact: number;
  /** Độ đậm của thân khi ngã (tan dần); 1 khi còn sống. */
  alpha: number;
  /** Bụi dưới chân: vị trí và độ tàn 0 → 1. */
  dust: { x: number; y: number; a: number }[];
  /** Bóng mờ khi lướt: vị trí chân và độ đậm. */
  ghosts: { x: number; y: number; alpha: number }[];
  /** Tan thành hạt khi ngã: tiến độ 0 → 1 và seed. */
  dissolve?: { q: number; seed: number };
  /** Đang vung chiêu cận chiến: giây (thời gian trận) từ lúc bắt đầu động tác ra chiêu. */
  swing?: number;
}

/** Chỉ mục thân người của một trận: đòn nặng theo người trúng, các lần ra chiêu theo người ra. */
export class ThanNguoi {
  private blows = new Map<number, Blow[]>();
  private castsBy = new Map<number, Cast[]>();
  private tps: number;

  constructor(index: ReplayIndex) {
    this.tps = index.replay.tps;
    for (const c of index.casts) {
      let list = this.castsBy.get(c.unit);
      if (!list) this.castsBy.set(c.unit, (list = []));
      list.push(c);
    }
    for (const list of this.castsBy.values()) list.sort((a, b) => a.tick - b.tick);
    for (const h of index.hits) {
      if (h.kind !== "hit") continue;
      const ut = index.byId.get(h.unit);
      if (!ut) continue;
      const frac = h.amount / ut.unit.hpMax;
      if (frac < HEAVY) continue;
      const c = this.lastCast(h.src, h.tick);
      const contact = c ? !NO_CONTACT.has(c.skill) : true;
      const stop = contact ? IMPACT_FRAMES + (c ? holdOf(c, recipeOf(c)) : HIT_STOP_FRAMES) : 0;
      let list = this.blows.get(h.unit);
      if (!list) this.blows.set(h.unit, (list = []));
      const w = Math.min(1, frac / FULL);
      const prev = list[list.length - 1];
      // Nhiều đòn cùng tick vào một người: giữ đòn nặng nhất.
      if (prev && prev.tick === h.tick) {
        if (w > prev.w) list[list.length - 1] = { tick: h.tick, src: h.src, w, stop };
      } else list.push({ tick: h.tick, src: h.src, w, stop });
    }
  }

  /** Lần ra chiêu gần nhất của `unit` có tick ≤ `tick`. */
  private lastCast(unit: number, tick: number): Cast | undefined {
    const list = this.castsBy.get(unit);
    if (!list) return undefined;
    let found: Cast | undefined;
    for (const c of list) {
      if (c.tick > tick) break;
      found = c;
    }
    return found;
  }

  /**
   * Thân người tại t. `life(s)` đổi giây thực ra tick theo tốc độ phát (như battleScene), `posAt(id, tick)` là vị trí
   * thế giới của một người, `placePos(pos)` đổi vị trí trên trục (milli-ô) của chính người này ra toạ độ thế giới.
   */
  motion(
    ut: UnitTimeline, t: number, life: (s: number) => number,
    posAt: (id: number, tick: number) => Point | null, placePos: (pos: number) => Point,
  ): BodyMotion {
    const id = ut.unit.id;
    const m: BodyMotion = { tPose: t, dx: 0, dy: 0, sx: 1, sy: 1, impact: -1, alpha: 1, dust: [], ghosts: [] };
    const frame = Math.max(1e-6, life(1 / FPS)); // tick của một khung thực
    const dead = t >= ut.death;

    // ---- trúng đòn: khựng, khung va chạm, bị đẩy theo cung, bè ra rồi lắng ----
    const b = lastBefore(this.blows.get(id), t);
    if (b && !dead) {
      // Dung sai làm tròn: t dựng từ số khung nhân tick mỗi khung nên có thể lệch 1e-9.
      const ageF = (t - b.tick) / frame + 1e-6;
      const knockF = 16; // 4 khung bật ra + 12 khung lắng về
      if (ageF < b.stop + knockF) {
        if (ageF < b.stop) m.tPose = b.tick; // khựng: hoạt ảnh đứng ở khung chạm
        if (ageF < IMPACT_FRAMES && b.stop > 0) m.impact = Math.floor(ageF);
        const me = posAt(id, b.tick);
        const src = posAt(b.src, b.tick);
        let ux = 0;
        let uy = ut.unit.team === 0 ? 1 : -1;
        if (me && src) {
          const len = Math.hypot(me.x - src.x, me.y - src.y);
          if (len > 1e-3) {
            ux = (me.x - src.x) / len;
            uy = (me.y - src.y) / len;
          }
        }
        // Chỉ là độ lệch hình quanh vị trí replay (sim đã có đẩy lùi thật), lắng về 0; nhỏ để không xa chỗ đạn chạm.
        const dist = 3 + 4 * b.w;
        let k: number;
        let hop = 0;
        let bulge: number;
        if (ageF < b.stop) {
          // Trong lúc khựng: đã bị dời 35%, bè ra, rung trái phải đổi chiều mỗi khung (sau khung va chạm).
          k = 0.35;
          bulge = 1;
          const jit = ageF >= IMPACT_FRAMES ? (Math.floor(ageF) % 2 ? 1 : -1) * 1.2 * b.w : 0;
          m.dx += -uy * jit;
          m.dy += ux * jit;
        } else {
          const q = ageF - b.stop;
          // Bật ra 4 khung (ease-out-quad: nhanh mà không giật quá 3 đơn vị mỗi khung), lắng về 12 khung (ease-in-out).
          if (q < 4) k = 0.35 + 0.65 * (1 - (1 - q / 4) * (1 - q / 4));
          else k = 1 - ease.inOut((q - 4) / 12);
          hop = Math.sin(Math.PI * Math.min(1, q / 12)); // nảy lên theo cung rồi rơi
          bulge = 1 - ease.settle(Math.min(1, q / 6));
        }
        m.dx += ux * dist * k;
        m.dy += uy * dist * k - hop * 3 * b.w;
        m.sx *= 1 + 0.12 * b.w * bulge;
        m.sy *= 1 - 0.08 * b.w * bulge;
      }
    }

    // ---- di chuyển: nhún theo bước, bè nhẹ lúc chân chạm đất, bụi, bóng mờ khi lướt ----
    const p1 = ut.pos.moving(t);
    const p0 = ut.pos.moving(t - 1);
    const speed = Math.abs(p1 - p0); // milli-ô mỗi tick
    if (!dead && speed > WALK) {
      const dirSign = p1 >= p0 ? 1 : -1;
      const phase = (p1 / 1000) * Math.PI * 2; // một bước mỗi nửa ô
      const s = Math.abs(Math.sin(phase));
      const amp = Math.min(1, speed / 40);
      m.dy -= s * 2.4 * amp;
      const land = 1 - s;
      if (land > 0.8) {
        const f = ((land - 0.8) / 0.2) * 0.05 * amp;
        m.sx *= 1 + f;
        m.sy *= 1 - f;
      }
      // Bụi ở hai bước gần nhất: tuổi tính từ quãng đã đi kể từ lúc chân chạm, đổi ra giây thực.
      const perSec = Math.max(1e-6, life(1));
      const n0 = dirSign > 0 ? Math.floor(p1 / 500) : Math.ceil(p1 / 500);
      for (let k2 = 0; k2 < 2; k2++) {
        const pf = (n0 - k2 * dirSign) * 500;
        const ageS = Math.abs(p1 - pf) / speed / perSec;
        if (ageS < 0.4) m.dust.push({ ...placePos(pf), a: ageS / 0.4 });
      }
      if (speed > LUOT) {
        for (let k2 = 1; k2 <= 3; k2++) m.ghosts.push({ ...placePos(ut.pos.moving(t - k2)), alpha: 0.32 - k2 * 0.08 });
      }
    }

    // ---- ngã: hoạt ảnh ngã chạy xong (5 khung, 8 khung/giây) thì tan thành hạt hệ, xác còn mờ 0,3 ----
    if (dead) {
      const start = ut.death + (5 / 8) * this.tps;
      const q = (t - start) / (0.5 * this.tps);
      if (q < 0) m.alpha = 1;
      else {
        m.alpha = 1 - 0.7 * ease.inOut(Math.min(1, q));
        if (q < 1) m.dissolve = { q, seed: seed(id, ut.death, 7) };
      }
    }

    // ---- vung chiêu cận chiến: tuổi của động tác ra chiêu đang diễn (theo thời điểm đã khựng) ----
    if (!dead) {
      const c = this.castAt(id, m.tPose);
      if (c && MELEE.has(c.skill)) m.swing = (m.tPose - (c.start ?? c.tick)) / this.tps;
    }
    return m;
  }

  /** Lần ra chiêu có động tác đang diễn tại t: bắt đầu (lúc vận công nếu có) trong 0,6 giây trước t. */
  private castAt(unit: number, t: number): Cast | undefined {
    const list = this.castsBy.get(unit);
    if (!list) return undefined;
    let found: Cast | undefined;
    for (const c of list) {
      const from = c.start ?? c.tick;
      if (from > t) break;
      if (t - from < 0.6 * this.tps) found = c;
    }
    return found;
  }
}

function lastBefore(list: Blow[] | undefined, t: number): Blow | undefined {
  if (!list) return undefined;
  let lo = 0;
  let hi = list.length - 1;
  let found: Blow | undefined;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (list[mid].tick <= t) {
      found = list[mid];
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return found;
}

// ---- vẽ ----

/** Bộ lọc canvas cho khung va chạm: khung 0 hoá trắng, khung 1 hoá mực (khớp khung va chạm của hiệu ứng chiêu). */
export function impactFilter(impact: number): string {
  return impact === 0 ? "brightness(0) invert(1)" : impact === 1 ? "brightness(0)" : "none";
}

/** Bụi dưới chân: ba cụm tròn mờ nở ra và bay lên chút ít theo cung, tàn ở cuối. */
export function drawDust(ctx: CanvasRenderingContext2D, dust: BodyMotion["dust"], footDy: number): void {
  if (!dust.length) return;
  ctx.save();
  ctx.fillStyle = "#cbb894";
  for (const d of dust) {
    const e = ease.whip(d.a);
    for (let i = 0; i < 3; i++) {
      const ang = Math.PI * (0.15 + 0.35 * i);
      const r = 2 + 5 * e;
      ctx.globalAlpha = 0.45 * (1 - d.a) * (1 - d.a);
      ctx.beginPath();
      ctx.arc(d.x + Math.cos(ang) * r * (i - 1), d.y + footDy - 1.5 * e - 3 * d.a * d.a, 1.6 + 2.2 * e, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

/** Tan thành hạt hệ khi ngã: hạt ký hiệu hệ văng ra từ thân rồi rơi theo cung (burst của hiệu ứng chiêu). */
export function drawDissolve(ctx: CanvasRenderingContext2D, el: ElementId, x: number, y: number, d: NonNullable<BodyMotion["dissolve"]>): void {
  burst(ctx, el, x, y, d.q, d.seed, 9, 26, 3.2);
}

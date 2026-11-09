// Chuyển động thân người trong trận (gói 1, 2026-11-05): khựng và khung va chạm khi trúng đòn, bị đẩy lùi theo cung
// rồi lắng, nhún theo bước khi đi, bụi dưới chân, bóng mờ khi lướt nhanh, tan thành hạt hệ khi ngã. Theo công thức
// đạo diễn chuyển động (docs/CHUYEN_DONG.md) và dùng chung nhịp với hiệu ứng chiêu (hieu_ung/nhip.ts, DONG_TAC.md):
// người trúng đòn khựng đúng IMPACT_FRAMES + holdOf của chiêu gây đòn, đếm theo giây thực.
// Gói 2 (2026-11-05): chạy và ra chiêu theo loại chiêu bằng dải PixelLab riêng (act, gait): khung chạm trùng tick trúng
// đòn (đạn: lúc rời tay), vung tay bắt đầu trước đó vì replay biết trước, người đánh khựng ở khung chạm cùng nhịp với
// người trúng đòn.
// Chỉ mục dựng một lần lúc nạp trận; mỗi khung là hàm thuần của t, không giữ trạng thái, nên tua và đổi tốc độ vẫn đúng.
import type { ManifestEntry, Sprites } from "../../assets/sprites.ts";
import { holdOf, NO_CONTACT } from "../../hieu_ung/chung.ts";
import { burst, seed } from "../../hieu_ung/motifs.ts";
import { ease, HIT_STOP_FRAMES, IMPACT_FRAMES } from "../../hieu_ung/nhip.ts";
import { recipeOf } from "../../hieu_ung/recipe.ts";
import type { ReplayIndex, UnitTimeline } from "../../replay/timeline.ts";
import type { ElementId, Look, ReplayEvent, SkillId } from "../../replay/types.ts";
import { resolveLook, type Anim } from "./character.ts";

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

/**
 * Động tác ra chiêu theo loại chiêu (gói 2): dải ra_chieu_<nhóm>. Hộ thể, hồi phục và thân chưa có dải nhóm thì dùng
 * dải ra_chieu chung như trước.
 */
export const NHOM_CHIEU: Partial<Record<SkillId, "chem" | "dam" | "dap" | "phong">> = {
  can_don: "chem", can_quet: "chem", than_phap: "dam",
  dien_rong: "dap", tran_phap: "dap",
  tam_xa: "phong", bua_chu: "phong", khong_che: "phong",
};
/** Xét lùi tối đa ngần này lần ra chiêu khi tìm động tác đang diễn; cách nhau từ RESET tick thì không ảnh hưởng nhau. */
const BACK = 6;
const RESET = 40;

/** Khung hoạt ảnh do ThanNguoi chọn: `trail` là chỉ số khung (số thực) cho vệt vũ khí khi ra chiêu cận chiến. */
export interface ActPose {
  anim: Anim;
  frame: number;
  trail?: number;
}

/** Dải ra chiêu theo nhóm: `cham` khung chạm (đòn trúng, đạn rời tay), `giu` khung tay giơ cao giữ lúc vận công. */
type ActMeta = ManifestEntry & { cham?: number; giu?: number };

/** Một lần diễn động tác: các mốc (tick, chỉ số khung) tăng dần, nội suy tuyến tính giữa hai mốc; hết mốc cuối là xong. */
interface Win {
  anim: Anim;
  keys: [number, number][];
  frames: number;
  /** Lần ra chiêu sau không được bắt đầu vung trước lúc này (hết khung chạm và khựng). */
  free: number;
  trail: boolean;
}

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
}

/** Chỉ mục thân người của một trận: đòn nặng theo người trúng, các lần ra chiêu theo người ra. */
export class ThanNguoi {
  private blows = new Map<number, Blow[]>();
  private castsBy = new Map<number, Cast[]>();
  /** Số khung khựng của người đánh theo "người đánh:tick" (có đòn nặng chạm trúng ở tick đó). */
  private strikes = new Map<string, number>();
  private looks = new Map<number, Look>();
  private tps: number;
  private index: ReplayIndex;
  private sprites?: Sprites;
  private lookOf?: (id: number) => Look | undefined;

  /**
   * `sprites` và `lookOf` (ngoại hình đã gán của từng người) để biết thân và áo nào có dải chạy, ra chiêu theo loại;
   * thiếu thì act() và gait() trả null, nơi gọi dùng cách chọn khung cũ.
   */
  constructor(index: ReplayIndex, sprites?: Sprites, lookOf?: (id: number) => Look | undefined) {
    this.index = index;
    this.sprites = sprites;
    this.lookOf = lookOf;
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
      const key = `${h.src}:${h.tick}`;
      this.strikes.set(key, Math.max(this.strikes.get(key) ?? 0, stop));
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
      // Có dải chạy thì dải tự nhún theo bước: chỉ giữ chút nhún và bỏ bè ra, để không nhún hai lần.
      const running = this.runPhase(ut, t) !== null && !!this.meta(id, "chay");
      const amp = Math.min(1, speed / 40) * (running ? 0.25 : 1);
      m.dy -= s * 2.4 * amp;
      const land = running ? 0 : 1 - s;
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

    return m;
  }

  // ---- gói 2: chạy, ra chiêu theo loại chiêu ----

  /** Dòng manifest của dải `anim` theo ngoại hình người `id` (đã lùi về đạo bào nếu thiếu áo), hay undefined. */
  private meta(id: number, anim: string): ActMeta | undefined {
    if (!this.sprites || !this.lookOf) return undefined;
    let look = this.looks.get(id);
    if (!look) {
      const wanted = this.lookOf(id);
      look = wanted && resolveLook(this.sprites, wanted);
      if (!look) return undefined; // hình chưa nạp xong: chưa ghi nhớ
      this.looks.set(id, look);
    }
    const meta = this.sprites.asset(`nhan_vat/${look.body}/${look.outfit}/${anim}`)?.meta;
    return meta?.frames ? meta : undefined;
  }

  /**
   * Động tác ra chiêu đang diễn tại t, hay null. Theo thời gian trận như dải ra_chieu cũ (tua nhanh thì diễn nhanh),
   * riêng khựng ở khung chạm tính theo giây thực như người trúng đòn. `life` như motion().
   */
  act(ut: UnitTimeline, t: number, life: (s: number) => number): ActPose | null {
    if (t >= ut.death) return null;
    const list = this.castsBy.get(ut.unit.id);
    if (!list) return null;
    // Lần ra chiêu cuối có thể đã bắt đầu vung: chạm trong vòng 2 giây sau t.
    let k = -1;
    for (let lo = 0, hi = list.length - 1; lo <= hi; ) {
      const mid = (lo + hi) >> 1;
      if (list[mid].tick <= t + 2 * this.tps) {
        k = mid;
        lo = mid + 1;
      } else hi = mid - 1;
    }
    if (k < 0) return null;
    // Lùi về các lần còn có thể đang diễn (chạm trong 3 giây trước t) và các lần sát nhau ảnh hưởng lần sau.
    let a = k;
    while (a > 0 && k - a < BACK && (list[a - 1].tick > t - 3 * this.tps || list[a].tick - list[a - 1].tick < RESET)) a--;
    // Lần sau không vung trước khi lần trước chạm và khựng xong; chạm trước lúc đó thì gộp vào lần trước.
    let free = -Infinity;
    let best: Win | null = null;
    for (let i = a; i <= k; i++) {
      const w = this.plan(list[i], life, free);
      if (!w) continue;
      free = w.free;
      if (w.keys[0][0] <= t) best = w;
    }
    if (!best) return null;
    const f = along(best.keys, t);
    if (f === undefined) return null;
    return { anim: best.anim, frame: Math.min(best.frames - 1, Math.floor(f)), trail: best.trail ? f : undefined };
  }

  private plan(c: Cast, life: (s: number) => number, free: number): Win | null {
    const g = NHOM_CHIEU[c.skill];
    const meta = g ? this.meta(c.unit, `ra_chieu_${g}`) : undefined;
    if (!g || !meta || meta.cham === undefined) {
      // Dải ra_chieu chung: diễn từ lúc vận công (hay lúc ra chiêu) theo fps của dải, như trước gói 2.
      const gen = this.meta(c.unit, "ra_chieu");
      if (!gen || c.tick < free) return null;
      const d = this.tps / (gen.fps ?? 10);
      const n = gen.frames!;
      const begin = Math.max(c.start ?? c.tick, free);
      return { anim: "ra_chieu", keys: [[begin, 0], [begin + n * d, n]], frames: n, free: begin + 2 * d, trail: MELEE.has(c.skill) };
    }
    const d = this.tps / (meta.fps ?? 16); // tick mỗi khung
    const n = meta.frames!;
    const C = meta.cham;
    const T = g === "phong" ? c.tick - this.flight(c) : c.tick; // khung chạm: đòn trúng, hay đạn rời tay
    if (T <= free) return null;
    const stop = g === "phong" ? 0 : this.strikes.get(`${c.unit}:${c.tick}`) ?? 0;
    const H = stop > 0 ? life(stop / FPS) : 0;
    let begin = T - C * d;
    if (g === "dap" && c.start !== undefined) begin = Math.min(begin, c.start); // giơ tay từ lúc vận công
    begin = Math.max(begin, free); // lần trước chưa xong: vung nhanh hơn cho kịp chạm
    const keys: [number, number][] = [[begin, 0]];
    if (g === "dap" && meta.giu !== undefined && meta.giu < C) {
      // Giơ tay lên khung giữ, giữ tới lúc đập, rồi đập xuống đúng tick nổ.
      const slam = T - (C - meta.giu) * d;
      if (slam > begin) {
        const up = Math.min(begin + meta.giu * d, slam);
        keys.push([up, meta.giu]);
        if (slam > up) keys.push([slam, meta.giu]);
      }
    }
    keys.push([T, C]);
    if (H > 0) keys.push([T + H, C]);
    keys.push([T + H + (n - C) * d, n]);
    return { anim: `ra_chieu_${g}`, keys, frames: n, free: T + H, trail: g === "chem" || g === "dam" };
  }

  /** Thời gian bay của đạn tới mục tiêu đầu, tick; cùng công thức với đạn trong hiệu ứng (fx2d.ts flight). */
  private flight(c: Cast): number {
    const from = this.index.byId.get(c.unit);
    const to = this.index.byId.get(c.targets[0]);
    if (!from || !to) return 0;
    const cells = Math.abs(from.pos.moving(c.tick) - to.pos.moving(c.tick)) / 1000;
    const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
    return c.skill === "bua_chu" ? clamp(Math.round(cells * 2.2), 4, 12) : clamp(Math.round(cells * 1.5), 2, 8);
  }

  /** Dải chạy khi đang tiến về phía địch, hay null. Khung theo quãng đã đi (một vòng hai bước mỗi ô), không theo giờ. */
  gait(ut: UnitTimeline, t: number): ActPose | null {
    if (t >= ut.death) return null;
    const meta = this.meta(ut.unit.id, "chay");
    const phase = this.runPhase(ut, t);
    if (!meta || phase === null) return null;
    return { anim: "chay", frame: Math.floor(phase * meta.frames!) % meta.frames! };
  }

  /** Pha bước chạy 0–1 khi đang tiến (đội A tiến theo chiều tăng của trục) nhanh hơn WALK và chưa tới mức lướt. */
  private runPhase(ut: UnitTimeline, t: number): number | null {
    const sign = ut.unit.team === 0 ? 1 : -1;
    const p1 = ut.pos.moving(t);
    const fwd = sign * (p1 - ut.pos.moving(t - 1));
    if (fwd <= WALK || fwd > LUOT) return null;
    const s = ((sign * p1) / 1000) % 1;
    return s < 0 ? s + 1 : s;
  }
}

/** Nội suy chỉ số khung theo các mốc (tick, khung); ngoài khoảng mốc thì undefined. */
function along(keys: [number, number][], t: number): number | undefined {
  if (t < keys[0][0] || t >= keys[keys.length - 1][0]) return undefined;
  for (let i = 1; i < keys.length; i++) {
    const [t1, f1] = keys[i];
    if (t >= t1) continue;
    const [t0, f0] = keys[i - 1];
    return t1 > t0 ? f0 + ((f1 - f0) * (t - t0)) / (t1 - t0) : f1;
  }
  return undefined;
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

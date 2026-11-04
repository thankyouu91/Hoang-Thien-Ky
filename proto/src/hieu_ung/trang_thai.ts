// Pha 4 (trạng thái kéo dài): dựng danh sách trạng thái theo thời gian một lần cho mỗi replay, chọn kiểu hình theo chiêu
// gây ra. Nguồn: sự kiện "status" trong replay (simSource so trạng thái sim giữa hai tick), hoặc FxInput.statuses;
// replay không có thì suy từ ra chiêu: khống chế thì choáng, thân pháp thì lộ vị trí, hộ thể thì khiên một lúc.
import { SKILL_RULES } from "@ktlp/sim";
import { between, type ReplayIndex } from "../replay/timeline.ts";
import type { ActiveStatus, StatusLook } from "./he.ts";
import { palette } from "./ctx.ts";
import { recipeOf } from "./recipe.ts";
import type { Cast, StatusSpan } from "./types.ts";
import type { ElementId, ReplayEvent } from "../replay/types.ts";

/** Sự kiện trạng thái trong replay: `until` là tick hết hạn (bằng tick nếu trạng thái vừa mất, ví dụ khiên bị phá). */
export type StatusEvent = Extract<ReplayEvent, { kind: "status" }>;

/** Khiên hộ thể khi replay không ghi trạng thái: chỉ hiện một lúc vì không biết lúc vỡ. */
const GUESS_SHIELD_TICKS = 30;

export interface StatusTrack {
  /** Xếp theo tick bắt đầu */
  list: (ActiveStatus & { tick: number })[];
  /** Thời hạn dài nhất, để tra theo khoảng */
  longest: number;
}

const cache = new WeakMap<ReplayIndex, StatusTrack>();

/** Trạng thái của replay, dựng một lần rồi nhớ. `given` (FxInput.statuses) được ưu tiên hơn sự kiện trong replay. */
export function statusTrack(index: ReplayIndex, given?: StatusSpan[]): StatusTrack {
  const hit = !given ? cache.get(index) : undefined;
  if (hit) return hit;
  const spans = given ?? spansFromEvents(index) ?? guessSpans(index);
  const list = spans
    .map((s) => ({ ...s, tick: s.from, ...lookOf(index, s) }))
    .filter((s) => s.until > s.from)
    .sort((a, b) => a.from - b.from || a.unit - b.unit);
  let longest = 0;
  for (const s of list) longest = Math.max(longest, s.until - s.from);
  const track = { list, longest };
  if (!given) cache.set(index, track);
  return track;
}

/** Trạng thái còn hiệu lực ở t (kể cả `tail` tick sau khi hết, cho khối băng vỡ). */
export function activeAt(track: StatusTrack, t: number, tail: number): StatusTrack["list"] {
  return between(track.list, t - track.longest - tail - 1, t).filter((s) => s.until + tail > t);
}

/** Gộp sự kiện "status": cùng người, cùng trạng thái, còn hiệu lực thì kéo dài; until ≤ tick là mất sớm. */
function spansFromEvents(index: ReplayIndex): StatusSpan[] | null {
  const events = index.statuses;
  if (!events.length) return null;
  const open = new Map<string, StatusSpan>();
  const out: StatusSpan[] = [];
  for (const ev of events) {
    const key = ev.unit + "|" + ev.status;
    const cur = open.get(key);
    if (cur && cur.until > ev.tick) {
      if (ev.until <= ev.tick) {
        cur.until = ev.tick;
        open.delete(key);
      } else if (sameCause(index, cur, ev)) {
        cur.until = Math.max(cur.until, ev.until);
      } else {
        cur.until = ev.tick;
        const next = { unit: ev.unit, status: ev.status, from: ev.tick, until: ev.until };
        out.push(next);
        open.set(key, next);
      }
    } else if (ev.until > ev.tick) {
      const next = { unit: ev.unit, status: ev.status, from: ev.tick, until: ev.until };
      out.push(next);
      open.set(key, next);
    }
  }
  return out;
}

function sameCause(index: ReplayIndex, cur: StatusSpan, ev: StatusEvent): boolean {
  return lookOf(index, cur).look === lookOf(index, { unit: ev.unit, status: ev.status, from: ev.tick, until: ev.until }).look;
}

function guessSpans(index: ReplayIndex): StatusSpan[] {
  const out: StatusSpan[] = [];
  for (const c of index.casts) {
    if (c.skill === "khong_che") for (const id of c.targets) out.push({ unit: id, status: "stun", from: c.tick, until: c.tick + SKILL_RULES.stunTicks });
    if (c.skill === "than_phap") out.push({ unit: c.unit, status: "exposed", from: c.tick, until: c.tick + SKILL_RULES.exposedTicks });
    if (c.skill === "ho_the") for (const id of c.targets) out.push({ unit: id, status: "shield", from: c.tick, until: c.tick + GUESS_SHIELD_TICKS });
  }
  return out;
}

/** Chiêu gây ra trạng thái: ra chiêu đúng tick bắt đầu, nhắm vào người đó (khiên đá Thổ, lộ vị trí: chính người ra chiêu). */
function causes(index: ReplayIndex, s: StatusSpan): Cast[] {
  return between(index.casts, s.from - 1, s.from).filter((c) => c.targets.includes(s.unit) || c.unit === s.unit);
}

function lookOf(index: ReplayIndex, s: StatusSpan): { look: StatusLook; el: ElementId; r: ActiveStatus["r"] } {
  const cs = causes(index, s);
  const onTarget = cs.filter((c) => c.targets.includes(s.unit) && c.unit !== s.unit);
  const has = (list: Cast[], el: ElementId) => list.find((c) => palette(c).includes(el));
  const pick = (look: StatusLook, c: Cast | undefined, fallback: ElementId) => ({ look, el: c ? (palette(c).includes(fallback) ? fallback : c.element) : fallback, r: c ? recipeOf(c) : null });
  const own = index.byId.get(s.unit)?.unit.element ?? "kim";
  switch (s.status) {
    case "stun": {
      const chain = onTarget.find((c) => c.skill === "khong_che");
      if (chain) return { look: "chain", el: chain.element, r: recipeOf(chain) };
      const ice = has(onTarget, "cuc_han");
      if (ice) return pick("ice", ice, "cuc_han");
      const shock = has(onTarget, "loi");
      if (shock) return pick("shock", shock, "loi");
      return pick("stars", onTarget[0], onTarget[0]?.element ?? own);
    }
    case "root":
      return pick("vines", has(onTarget, "moc"), "moc");
    case "slow":
      return pick("ripple", has(onTarget, "thuy"), "thuy");
    case "burn":
      return pick("flames", has(onTarget, "hoa"), "hoa");
    case "healCut":
      return pick("curse", has(onTarget, "cuc_am"), "cuc_am");
    case "shield": {
      const guard = cs.find((c) => (c.skill === "ho_the" || c.skill === "hoi_phuc") && c.targets.includes(s.unit));
      if (guard) return { look: "dome", el: guard.element, r: recipeOf(guard) };
      const stone = cs.find((c) => c.unit === s.unit && palette(c).includes("tho"));
      if (stone) return { look: "stone", el: "tho", r: recipeOf(stone) };
      return { look: "dome", el: own, r: null };
    }
    case "exposed": {
      const d = cs.find((c) => c.unit === s.unit && c.skill === "than_phap");
      return { look: "exposed", el: d?.element ?? own, r: d ? recipeOf(d) : null };
    }
    case "stealth":
      return { look: "stealth", el: own, r: null };
  }
}

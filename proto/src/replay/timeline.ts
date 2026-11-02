import type { Replay, ReplayEvent, ReplayUnit } from "./types.ts";

type Hit = Extract<ReplayEvent, { kind: "hit" | "heal" }>;
type Cast = Extract<ReplayEvent, { kind: "cast" }>;

/** Chuỗi mẫu (tick, giá trị) của một đơn vị; tra theo thời gian có phần lẻ để vẽ mượt giữa hai tick. */
export class Track {
  private ticks: number[] = [-Infinity];
  private values: number[];

  constructor(initial: number) {
    this.values = [initial];
  }

  push(tick: number, value: number): void {
    this.ticks.push(tick);
    this.values.push(value);
  }

  /** Chỉ số mẫu cuối cùng có tick ≤ t. */
  private find(t: number): number {
    let lo = 0;
    let hi = this.ticks.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (this.ticks[mid] <= t) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  }

  /** Giá trị nhảy bậc tại từng sự kiện (máu). */
  step(t: number): number {
    return this.values[this.find(t)];
  }

  /** Đoạn tăng nội suy tuyến tính tới mẫu sau (hồi mana đều); đoạn giảm nhảy bậc (tiêu mana). */
  rising(t: number): number {
    const i = this.find(t);
    const v = this.values[i];
    const j = i + 1;
    if (j >= this.values.length || this.values[j] <= v || this.ticks[i] === -Infinity) return v;
    const f = (t - this.ticks[i]) / (this.ticks[j] - this.ticks[i]);
    return v + (this.values[j] - v) * f;
  }

  /** Vị trí: mẫu ở tick T là chỗ đứng cuối tick T, nên đơn vị đi dần tới đó trong khoảng (T − 1, T]. */
  moving(t: number): number {
    const i = this.find(t);
    const v = this.values[i];
    const j = i + 1;
    if (j >= this.values.length || this.ticks[j] - 1 >= t) return v;
    const f = t - (this.ticks[j] - 1);
    return v + (this.values[j] - v) * f;
  }
}

export interface UnitTimeline {
  unit: ReplayUnit;
  pos: Track;
  hp: Track;
  mana: Track;
  /** Tick ngã; Infinity nếu sống tới cuối trận. */
  death: number;
}

/** Chỉ mục dựng một lần khi nạp replay, để vẽ mọi khung hình như một hàm của thời gian: tua tới lui không cần chạy lại. */
export class ReplayIndex {
  readonly replay: Replay;
  readonly units: UnitTimeline[];
  readonly byId = new Map<number, UnitTimeline>();
  readonly hits: Hit[] = [];
  readonly casts: Cast[] = [];

  constructor(replay: Replay) {
    this.replay = replay;
    this.units = replay.units.map((u) => ({
      unit: u,
      pos: new Track(u.pos),
      hp: new Track(u.hpMax),
      mana: new Track(0),
      death: Infinity,
    }));
    for (const ut of this.units) this.byId.set(ut.unit.id, ut);

    for (const e of replay.events) {
      const ut = this.byId.get(e.unit);
      if (!ut) continue;
      switch (e.kind) {
        case "move":
          ut.pos.push(e.tick, e.pos);
          break;
        case "hit":
        case "heal":
          ut.hp.push(e.tick, e.hp);
          this.hits.push(e);
          break;
        case "mana":
          ut.mana.push(e.tick, e.mana);
          break;
        case "cast":
          this.casts.push(e);
          break;
        case "death":
          ut.death = e.tick;
          break;
      }
    }
  }

  alive(team: 0 | 1, t: number): number {
    let n = 0;
    for (const ut of this.units) if (ut.unit.team === team && ut.death > t) n++;
    return n;
  }
}

/** Các phần tử có tick trong khoảng (t0, t1]; list xếp theo tick tăng dần. */
export function between<T extends { tick: number }>(list: T[], t0: number, t1: number): T[] {
  let lo = 0;
  let hi = list.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (list[mid].tick <= t0) lo = mid + 1;
    else hi = mid;
  }
  const out: T[] = [];
  for (let i = lo; i < list.length && list[i].tick <= t1; i++) out.push(list[i]);
  return out;
}

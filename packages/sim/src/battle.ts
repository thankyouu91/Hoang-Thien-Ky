import { mul, clamp, ONE } from "./fixed.ts";
import { Rng } from "./rng.ts";
import { Hasher } from "./hash.ts";
import { elementMultiplier, type Element } from "./elements.ts";

export const TICKS_PER_SECOND = 20;
export const MAX_TICKS = 90 * TICKS_PER_SECOND; // trận tối đa 90 giây

export interface UnitSpec {
  id: number; // duy nhất trong trận, quyết định thứ tự cập nhật
  level: number;
  element: Element;
  hp: number;
  atk: number;
  def: number;
  cooldownTicks: number; // hồi chiêu đòn thường
  critPerMille: number; // tỷ lệ chí mạng, phần nghìn
}
export interface BattleInput {
  seed: number;
  teamA: UnitSpec[];
  teamB: UnitSpec[];
  /** Nhật ký lệnh: tại tick nào, đơn vị nào tung tuyệt chiêu */
  commands?: { tick: number; unitId: number }[];
}
export interface BattleResult {
  winner: "A" | "B" | "draw";
  ticks: number;
  hash: number;
  survivorsA: number;
  survivorsB: number;
}

interface Unit extends UnitSpec {
  team: 0 | 1;
  curHp: number;
  cd: number;
  ultReady: boolean;
}

/** Hệ số chênh lệch cấp (GDD mục 8): bên thấp còn tối thiểu 55%, bên cao cộng tối đa 30%. */
export function levelGapMultiplier(atkLevel: number, defLevel: number): number {
  const gap = atkLevel - defLevel;
  if (gap < 0) return Math.max(550, ONE - 15 * -gap);
  return ONE + Math.min(300, 10 * gap);
}

export function damage(a: UnitSpec, d: UnitSpec, crit: boolean, ultimate: boolean): number {
  let dmg = a.atk;
  dmg = mul(dmg, elementMultiplier(a.element, d.element));
  dmg = mul(dmg, levelGapMultiplier(a.level, d.level));
  if (ultimate) dmg = mul(dmg, 2500);
  if (crit) dmg = mul(dmg, 1500);
  // Phòng thủ giảm sát thương theo tỷ lệ def / (def + 1000), không về 0.
  const reduce = Math.trunc((d.def * ONE) / (d.def + 1000));
  dmg = mul(dmg, ONE - clamp(reduce, 0, 800));
  return Math.max(1, dmg);
}

export function simulate(input: BattleInput): BattleResult {
  const rng = new Rng(input.seed);
  const units: Unit[] = [
    ...input.teamA.map((u) => ({ ...u, team: 0 as const, curHp: u.hp, cd: u.cooldownTicks, ultReady: false })),
    ...input.teamB.map((u) => ({ ...u, team: 1 as const, curHp: u.hp, cd: u.cooldownTicks, ultReady: false })),
  ].sort((x, y) => x.id - y.id);
  const cmds = [...(input.commands ?? [])].sort((x, y) => x.tick - y.tick || x.unitId - y.unitId);
  let ci = 0;
  const hasher = new Hasher();
  let tick = 0;
  const alive = (t: 0 | 1) => units.filter((u) => u.team === t && u.curHp > 0);

  for (; tick < MAX_TICKS; tick++) {
    while (ci < cmds.length && cmds[ci].tick === tick) {
      const u = units.find((x) => x.id === cmds[ci].unitId);
      if (u && u.curHp > 0) u.ultReady = true;
      ci++;
    }
    for (const u of units) {
      if (u.curHp <= 0) continue;
      if (--u.cd > 0) continue;
      u.cd = u.cooldownTicks;
      const foes = alive(u.team === 0 ? 1 : 0);
      if (foes.length === 0) break;
      // Mục tiêu: máu thấp nhất, hòa thì id nhỏ hơn (deterministic).
      let target = foes[0];
      for (const f of foes) if (f.curHp < target.curHp || (f.curHp === target.curHp && f.id < target.id)) target = f;
      const crit = rng.chance(u.critPerMille);
      const ult = u.ultReady;
      u.ultReady = false;
      target.curHp -= damage(u, target, crit, ult);
    }
    for (const u of units) hasher.add(u.curHp > 0 ? u.curHp : 0);
    hasher.add(tick);
    if (alive(0).length === 0 || alive(1).length === 0) {
      tick++;
      break;
    }
  }
  const a = alive(0).length, b = alive(1).length;
  return { winner: a > 0 && b === 0 ? "A" : b > 0 && a === 0 ? "B" : "draw", ticks: tick, hash: hasher.value(), survivorsA: a, survivorsB: b };
}

import { Rng, ELEMENTS, type UnitSpec, type BattleInput } from "../src/index.ts";
export function randomBattle(seed: number): BattleInput {
  const r = new Rng(seed ^ 0x9e3779b9);
  const team = (base: number): UnitSpec[] =>
    Array.from({ length: 1 + r.int(10) }, (_, i) => ({
      id: base + i,
      level: 1 + r.int(250),
      element: ELEMENTS[r.int(12)],
      hp: 5000 + r.int(50000),
      atk: 300 + r.int(3000),
      def: r.int(2000),
      cooldownTicks: 10 + r.int(30),
      critPerMille: 50 + r.int(200),
    }));
  const teamA = team(1), teamB = team(101);
  const commands = Array.from({ length: r.int(4) }, () => ({ tick: r.int(600), unitId: teamA[r.int(teamA.length)].id }));
  return { seed, teamA, teamB, commands };
}

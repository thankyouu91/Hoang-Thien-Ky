import {
  Rng, ELEMENTS, SKILL_TYPES, VARIANTS, TALENTS, composeTechnique, baseStats, maxGradeAtLevel, mul, clamp,
  type UnitSpec, type BattleInput, type Scroll, type Technique, type Talent,
} from "../src/index.ts";

function randomTechnique(r: Rng, maxGrade: number): Technique {
  const scroll = (): Scroll => ({ element: ELEMENTS[r.int(12)], type: SKILL_TYPES[r.int(10)], variant: VARIANTS[r.int(4)], grade: 1 + r.int(maxGrade) });
  const main = scroll();
  return composeTechnique(main, r.int(3) === 0 ? [scroll(), scroll()] : [scroll()]);
}

/**
 * Trận ngẫu nhiên giữa hai đội cùng tầm cấp (cách nhau tối đa 20 cấp), chỉ số theo chỉ số chuẩn ±20% cho đồ và tài năng,
 * phẩm công pháp theo cấp. `size` = số người mỗi đội, `techniques` = số công pháp mỗi người; 0 = ngẫu nhiên (1–10 người, 1–4 công pháp).
 */
export function randomBattle(seed: number, size = 0, techniques = 0): BattleInput {
  const r = new Rng(seed ^ 0x9e3779b9);
  const center = 1 + r.int(250);
  const team = (base: number): UnitSpec[] =>
    Array.from({ length: size || 1 + r.int(10) }, (_, i) => {
      const level = clamp(center - 10 + r.int(21), 1, 250);
      const s = baseStats(level);
      const vary = (v: number) => mul(v, 800 + r.int(401));
      const talents: Talent[] = [TALENTS[r.int(8)]];
      if (r.int(4) === 0) talents.push(TALENTS[r.int(8)]); // đã tẩy tủy
      return {
        id: base + i,
        level,
        element: ELEMENTS[r.int(12)],
        element2: r.int(2) === 0 ? ELEMENTS[r.int(12)] : undefined,
        talents,
        hp: vary(s.hp),
        atk: vary(s.atk),
        def: vary(s.def),
        resist: r.int(3) === 0 ? { [ELEMENTS[r.int(12)]]: r.int(300) } : undefined,
        row: r.int(2) as 0 | 1,
        techniques: Array.from({ length: techniques || 1 + r.int(4) }, () => randomTechnique(r, maxGradeAtLevel(level))),
      };
    });
  const teamA = team(1), teamB = team(101);
  const commands = Array.from({ length: r.int(4) }, () => ({ tick: r.int(600), unitId: teamA[r.int(teamA.length)].id }));
  return { seed, teamA, teamB, commands };
}

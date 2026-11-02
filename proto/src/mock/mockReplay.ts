// Replay giả 10 đấu 10 để dựng trình phát trong lúc Sprint 1 viết lại @ktlp/sim.
// Luật ở đây chỉ cần trông giống một trận (tiến lên, ra chiêu, trúng đòn, ngã); số liệu và luật thật nằm ở @ktlp/sim.
import { ELEMENT_IDS, type ElementId, type Replay, type ReplayEvent, type ReplaySource, type ReplayUnit, type SkillId } from "../replay/types.ts";

const TPS = 20;
const MAX_TICKS = 90 * TPS;
const FIELD = 12000;
const FRONT = 4500; // hàng trước đội A; đội B đối xứng qua giữa sân
const BACK = 2500;
const SPEED = 100; // milli-ô mỗi tick
const MANA_MAX = 1000;
const MANA_REGEN = 50 / TPS;

interface MockSkill {
  k: number;
  targets: number;
  cd: number; // tick
  mana: number;
  range: number; // milli-ô
  ally?: boolean;
}
// k, mục tiêu, hồi chiêu theo GDD mục 8; mana và tầm theo đề xuất ở packages/sim/src/config.ts.
const SKILLS: Record<SkillId, MockSkill> = {
  can_don: { k: 1.3, targets: 1, cd: 20, mana: 20, range: 1000 },
  can_quet: { k: 1.0, targets: 5, cd: 40, mana: 40, range: 1000 },
  tam_xa: { k: 0.95, targets: 2, cd: 20, mana: 20, range: 4000 },
  dien_rong: { k: 0.6, targets: 10, cd: 80, mana: 80, range: 4000 },
  ho_the: { k: 1.2, targets: 3, cd: 160, mana: 160, range: 4000, ally: true },
  bua_chu: { k: 3.0, targets: 1, cd: 120, mana: 120, range: 4000 },
  tran_phap: { k: 5.0, targets: 6, cd: 400, mana: 400, range: 4000 },
  hoi_phuc: { k: 0.9, targets: 3, cd: 120, mana: 360, range: 4000, ally: true },
  khong_che: { k: 0.5, targets: 1, cd: 120, mana: 120, range: 3000 },
  than_phap: { k: 1.6, targets: 1, cd: 160, mana: 160, range: 6000 },
};
const FRONT_SPECIALS: SkillId[] = ["can_quet", "ho_the", "khong_che", "than_phap", "can_quet"];
const BACK_SPECIALS: SkillId[] = ["dien_rong", "bua_chu", "tran_phap", "hoi_phuc", "dien_rong"];
// Tài năng (GDD mục 6) theo cùng vị trí, chỉ để chọn hình tu_si/<tài năng> trong manifest PixelLab.
const FRONT_TALENTS = ["tu_the", "tu_the", "tu_ren", "sat_thu", "tu_kim_tien"];
const BACK_TALENTS = ["tu_phap", "tu_phap", "tu_tran", "tu_duoc", "tu_dan"];

// Khắc chế rút gọn cho đẹp mắt: Ngũ Hành khắc ×1,5, bị khắc ×0,7, biến dị theo hệ gốc.
const PARENT: Partial<Record<ElementId, ElementId>> = { loi: "kim", phong: "moc", cuc_han: "thuy", cuc_duong: "hoa", cuc_am: "tho" };
const BEATS: Partial<Record<ElementId, ElementId>> = { kim: "moc", moc: "tho", tho: "thuy", thuy: "hoa", hoa: "kim" };
function elementMul(a: ElementId, d: ElementId): number {
  const pa = PARENT[a] ?? a;
  const pd = PARENT[d] ?? d;
  if (BEATS[pa] === pd) return 1.5;
  if (BEATS[pd] === pa) return 0.7;
  return 1;
}

/** mulberry32: đủ cho dữ liệu giả, cùng seed ra cùng trận. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Fighter extends ReplayUnit {
  hp: number;
  mana: number;
  atk: number;
  def: number;
  skills: SkillId[]; // theo thứ tự ưu tiên; chiêu cuối là đòn thường
  cd: number[];
  stunUntil: number;
}

export function mockReplay(seed = 7): Replay {
  const rand = rng(seed);
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)];
  const fighters: Fighter[] = [];
  for (const team of [0, 1] as const) {
    for (let i = 0; i < 10; i++) {
      const row = (i < 5 ? 0 : 1) as 0 | 1;
      const special = row === 0 ? FRONT_SPECIALS[i % 5] : BACK_SPECIALS[i % 5];
      const base: SkillId = row === 0 ? "can_don" : "tam_xa";
      const start = row === 0 ? FRONT : BACK;
      fighters.push({
        id: team * 10 + i + 1,
        team,
        row,
        name: `${team === 0 ? "A" : "B"}${i + 1}`,
        element: pick(ELEMENT_IDS),
        hpMax: 0,
        manaMax: MANA_MAX,
        pos: team === 0 ? start : FIELD - start,
        sprite: "tu_si/" + (row === 0 ? FRONT_TALENTS : BACK_TALENTS)[i % 5],
        hp: Math.round(1800 + rand() * 800),
        mana: Math.round(rand() * 400),
        atk: Math.round(45 + rand() * 20),
        def: Math.round(200 + rand() * 200),
        skills: [special, base],
        cd: [Math.round(SKILLS[special].cd * rand()), 0],
        stunUntil: 0,
      });
    }
  }
  for (const f of fighters) f.hpMax = f.hp;

  const events: ReplayEvent[] = [];
  for (const f of fighters) events.push({ tick: 0, kind: "mana", unit: f.id, mana: f.mana });

  const alive = (team: number) => fighters.filter((f) => f.team === team && f.hp > 0);
  const dist = (a: Fighter, b: Fighter) => Math.abs(a.pos - b.pos);
  let tick = 0;
  for (; tick < MAX_TICKS; tick++) {
    if (alive(0).length === 0 || alive(1).length === 0) break;
    for (const f of fighters) {
      if (f.hp <= 0) continue;
      if (f.mana < MANA_MAX) {
        f.mana = Math.min(MANA_MAX, f.mana + MANA_REGEN);
        if (f.mana === MANA_MAX) events.push({ tick, kind: "mana", unit: f.id, mana: f.mana });
      }
      for (let s = 0; s < f.cd.length; s++) f.cd[s]--;
      if (tick < f.stunUntil) continue;

      const foes = alive(1 - f.team).sort((a, b) => dist(f, a) - dist(f, b) || a.id - b.id);
      if (foes.length === 0) break;
      const near = dist(f, foes[0]);

      // Chiêu đầu tiên trong danh sách ưu tiên đã hồi, đủ mana và có mục tiêu trong tầm.
      let cast = -1;
      for (let s = 0; s < f.skills.length && cast < 0; s++) {
        const sk = SKILLS[f.skills[s]];
        if (f.cd[s] > 0 || f.mana < sk.mana) continue;
        if (!sk.ally && near > sk.range) continue;
        cast = s;
      }
      if (cast < 0) {
        const reach = SKILLS[f.skills[f.skills.length - 1]].range;
        if (near > reach) {
          f.pos += f.team === 0 ? SPEED : -SPEED;
          events.push({ tick, kind: "move", unit: f.id, pos: f.pos });
        }
        continue;
      }

      const id = f.skills[cast];
      const sk = SKILLS[id];
      const pool = sk.ally
        ? alive(f.team).sort((a, b) => a.hp / a.hpMax - b.hp / b.hpMax || a.id - b.id)
        : foes.filter((e) => dist(f, e) <= sk.range);
      const targets = pool.slice(0, sk.targets);
      if (targets.length === 0) continue;

      events.push({ tick, kind: "mana", unit: f.id, mana: f.mana });
      f.mana -= sk.mana;
      f.cd[cast] = sk.cd;
      events.push({ tick, kind: "mana", unit: f.id, mana: f.mana });
      // Trận giả phát chiêu ngay; diện rộng và trận pháp ghi lùi lúc bắt đầu để trình phát vẽ vòng báo trước.
      const zone = id === "dien_rong" || id === "tran_phap"
        ? { start: Math.max(0, tick - (id === "tran_phap" ? 100 : 20)), center: targets[0].pos, radius: 2000 }
        : {};
      // Công pháp đặc biệt ghép thêm một hệ phụ (chọn cố định theo id để không đổi trận giả).
      const subs = cast === 0
        ? { subElements: [ELEMENT_IDS[(ELEMENT_IDS.indexOf(f.element) + 1 + (f.id % 5)) % ELEMENT_IDS.length]] }
        : {};
      events.push({ tick, kind: "cast", unit: f.id, skill: id, element: f.element, targets: targets.map((t) => t.id), ...zone, ...subs });

      if (id === "than_phap") {
        f.pos = foes[0].pos + (f.team === 0 ? -500 : 500);
        events.push({ tick, kind: "move", unit: f.id, pos: f.pos });
      }
      for (const t of targets) {
        if (sk.ally) {
          const amount = Math.round(f.atk * sk.k * 4 * (0.85 + rand() * 0.3));
          t.hp = Math.min(t.hpMax, t.hp + amount);
          events.push({ tick, kind: "heal", unit: t.id, src: f.id, amount, hp: t.hp });
          continue;
        }
        const crit = rand() < (id === "tam_xa" ? 0.09 : 0.05);
        const raw = f.atk * sk.k * elementMul(f.element, t.element) * (0.85 + rand() * 0.3) * (crit ? 1.5 : 1);
        const amount = Math.max(1, Math.round((raw * 1000) / (t.def + 1000)));
        t.hp = Math.max(0, t.hp - amount);
        events.push({ tick, kind: "hit", unit: t.id, src: f.id, amount, crit, hp: t.hp });
        if (id === "khong_che") t.stunUntil = tick + 30;
        if (t.hp === 0) events.push({ tick, kind: "death", unit: t.id });
      }
    }
  }

  const a = alive(0).length;
  const b = alive(1).length;
  return {
    tps: TPS,
    ticks: tick,
    fieldLength: FIELD,
    units: fighters.map(({ id, team, row, name, element, hpMax, manaMax, sprite }) => ({
      id, team, row, name, element, hpMax, manaMax, sprite,
      pos: team === 0 ? (row === 0 ? FRONT : BACK) : FIELD - (row === 0 ? FRONT : BACK),
    })),
    events,
    winner: a > 0 && b === 0 ? "A" : b > 0 && a === 0 ? "B" : "draw",
  };
}

export const mockReplaySource: ReplaySource = {
  label: "Trận giả",
  load: async () => mockReplay(),
};

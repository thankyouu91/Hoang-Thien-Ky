// Replay từ trận thật: chạy lớp Battle của @ktlp/sim từng tick (bật ghi sự kiện ra chiêu) và so trạng thái
// giữa hai tick để sinh sự kiện di chuyển, máu, mana, ngã. Không sửa sim; cùng BattleInput thì cùng trận với simulate().
//
// Giới hạn vì sim chưa ghi từng đòn đánh:
// - Nhiều đòn trúng một người trong cùng tick gộp thành một số; thiêu đốt không có người đánh.
// - Không biết đòn nào chí mạng, và phần sát thương khiên hút không hiện thành số.
import { Battle, BATTLE, TICKS_PER_SECOND, type BattleInput } from "@ktlp/sim";
import type { Replay, ReplayEvent, ReplaySource, ReplayUnit, StatusKind } from "./types.ts";

const ONE = 1000; // mana trong sim tính theo phần nghìn

/** Trạng thái có thời hạn trên Unit của sim (khiên xét riêng vì còn có thể vỡ sớm). */
const UNTIL = [
  ["stun", "stunUntil"], ["root", "rootUntil"], ["slow", "slowUntil"], ["burn", "burnUntil"],
  ["healCut", "healCutUntil"], ["exposed", "exposedUntil"], ["stealth", "stealthUntil"],
] as const satisfies readonly (readonly [StatusKind, string])[];

export function replayFromSim(input: BattleInput): Replay {
  const battle = new Battle(input, true);
  const specs = new Map([...input.teamA, ...input.teamB].map((s) => [s.id, s]));
  const units: ReplayUnit[] = battle.units.map((u) => {
    const spec = specs.get(u.id)!;
    const talent = spec.talents?.[0];
    return {
      id: u.id,
      team: u.team,
      row: spec.row,
      name: `${u.team === 0 ? "A" : "B"}${u.id}`,
      element: u.element,
      hpMax: u.hp,
      manaMax: u.manaMax / ONE,
      pos: u.pos,
      sprite: talent ? "tu_si/" + talent : undefined,
    };
  });

  const events: ReplayEvent[] = battle.units.map((u) => ({ tick: 0, kind: "mana" as const, unit: u.id, mana: u.mana / ONE }));
  const prev = battle.units.map((u) => ({
    hp: u.curHp, pos: u.pos, mana: u.mana,
    until: Object.fromEntries(UNTIL.map(([k, f]) => [k, u[f]])) as Record<(typeof UNTIL)[number][0], number>,
    shieldUntil: u.shieldUntil, shieldOn: u.shield > 0,
  }));
  // Tâm vùng của chiêu đang vận công, chốt lúc bắt đầu; sim chỉ ghi sự kiện lúc chiêu phát.
  const centers = new Map<number, number>();
  // Chiêu cuối tông chủ: sim không ghi cờ trên sự kiện, nên suy ra từ lúc `ultReady` bị dùng mất.
  const commands = [...(input.commands ?? [])].sort((a, b) => a.tick - b.tick);
  const ultUsedAt = new Map<number, number>();
  let ci = 0;
  let logged = 0;

  while (!battle.finished) {
    const tick = battle.tick;
    const armed = new Set(battle.units.filter((u) => u.ultReady).map((u) => u.id));
    for (; ci < commands.length && commands[ci].tick <= tick; ci++) armed.add(commands[ci].unitId);
    battle.step();
    for (const u of battle.units) if (armed.has(u.id) && !u.ultReady && u.curHp > 0) ultUsedAt.set(u.id, tick);

    // Người đánh của từng mục tiêu trong tick này, để số sát thương lệch theo người đánh.
    const hitBy = new Map<number, number>();
    for (; logged < battle.events.length; logged++) {
      const e = battle.events[logged];
      const slot = battle.units.find((u) => u.id === e.unitId)!.slots[e.slot];
      const zone = slot.radius > 0 ? { start: e.startTick, center: centers.get(e.unitId), radius: slot.radius } : {};
      const subs = slot.tech.subElements.length > 0 ? { subElements: [...slot.tech.subElements] } : {};
      const ult = ultUsedAt.get(e.unitId) === e.startTick;
      if (ult) ultUsedAt.delete(e.unitId);
      events.push({
        tick: e.tick, kind: "cast", unit: e.unitId, skill: slot.tech.type, element: slot.tech.element, targets: e.targets,
        ...zone, ...subs, ...(ult ? { ult } : {}), grade: slot.tech.grade,
      });
      for (const t of e.targets) if (!hitBy.has(t)) hitBy.set(t, e.unitId);
    }
    for (const u of battle.units) if (u.channel) centers.set(u.id, u.channel.center);

    battle.units.forEach((u, i) => {
      const p = prev[i];
      if (p.hp <= 0) return;
      if (u.pos !== p.pos) events.push({ tick, kind: "move", unit: u.id, pos: u.pos });
      const hp = Math.max(0, u.curHp);
      if (hp < p.hp) {
        events.push({ tick, kind: "hit", unit: u.id, src: hitBy.get(u.id) ?? u.id, amount: p.hp - hp, crit: false, hp });
        if (hp === 0) events.push({ tick, kind: "death", unit: u.id });
      } else if (hp > p.hp) {
        events.push({ tick, kind: "heal", unit: u.id, src: hitBy.get(u.id) ?? u.id, amount: hp - p.hp, hp });
      }
      // Mana hồi đều mỗi tick nên chỉ ghi lúc tiêu (trước và sau khi trừ) và lúc vừa đầy; trình phát nội suy đoạn hồi.
      const regen = Math.min(u.manaMax, p.mana + u.regen);
      if (u.mana < regen) {
        events.push({ tick, kind: "mana", unit: u.id, mana: regen / ONE });
        events.push({ tick, kind: "mana", unit: u.id, mana: u.mana / ONE });
      } else if (u.mana === u.manaMax && p.mana < u.manaMax) {
        events.push({ tick, kind: "mana", unit: u.id, mana: u.mana / ONE });
      }
      // Trạng thái: ghi lúc thời hạn đổi (áp mới, kéo dài); khiên ghi thêm lúc vỡ trước hạn (until = tick).
      for (const [kind, field] of UNTIL) {
        const until = u[field];
        if (until === p.until[kind]) continue;
        if (until > tick) events.push({ tick, kind: "status", unit: u.id, status: kind, until });
        p.until[kind] = until;
      }
      const shieldOn = u.shield > 0 && u.shieldUntil > tick;
      if (shieldOn && u.shieldUntil !== p.shieldUntil) events.push({ tick, kind: "status", unit: u.id, status: "shield", until: u.shieldUntil });
      else if (!shieldOn && p.shieldOn && p.shieldUntil > tick + 1) events.push({ tick, kind: "status", unit: u.id, status: "shield", until: tick });
      p.shieldUntil = u.shieldUntil;
      p.shieldOn = shieldOn;
      p.hp = hp;
      p.pos = u.pos;
      p.mana = u.mana;
    });
  }

  const result = battle.result();
  return { tps: TICKS_PER_SECOND, ticks: result.ticks, fieldLength: BATTLE.fieldLength, units, events, winner: result.winner };
}

/** Nguồn replay chạy trận thật từ một BattleInput dựng sẵn; `arena` chọn nền sân (ví dụ mo_linh_thach cho trận tranh mỏ). */
export function simReplaySource(label: string, input: () => BattleInput, arena?: string): ReplaySource {
  return { label, load: async () => ({ ...replayFromSim(input()), ...(arena ? { arena } : {}) }) };
}

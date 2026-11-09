// Replay từ trận thật: chạy lớp Battle của @ktlp/sim từng tick (bật ghi sự kiện ra chiêu) và so trạng thái
// giữa hai tick để sinh sự kiện di chuyển, máu, mana, ngã. Không sửa sim; cùng BattleInput thì cùng trận với simulate().
//
// Giới hạn vì sim chưa ghi từng đòn đánh:
// - Nhiều đòn trúng một người trong cùng tick gộp thành một số; thiêu đốt không có người đánh.
// - Không biết đòn nào chí mạng, và phần sát thương khiên hút không hiện thành số.
// - Đòn khắc hệ suy từ hệ chiêu của người đánh và linh căn người trúng (elementMultiplier), không tính phép thế thân.
import { Battle, BATTLE, elementMultiplier, TICKS_PER_SECOND, type BattleInput, type Element } from "@ktlp/sim";
import THU_CUOI from "../../../data/he_thong/json/thu_cuoi.json" with { type: "json" };
import type { Replay, ReplayEvent, ReplaySource, ReplayUnit, StatusKind } from "./types.ts";

const ONE = 1000; // mana trong sim tính theo phần nghìn
const COUNTER = 1500; // hệ số khắc hệ trong sim (phần nghìn), từ mức này là đòn khắc

/**
 * Hình cho dị thú (UnitSpec.monster) khi chưa có hình thú riêng cho trận: thú cưỡi PixelLab cùng hệ, ưu tiên tẩu thú
 * (đứng trên sân), mỗi con một hình theo id. undefined khi hệ đó chưa có thú nào.
 */
export function beastSprite(element: Element, id: number): string | undefined {
  const same = THU_CUOI.filter((t) => t.element === element);
  const walkers = same.filter((t) => t.form === "Tẩu thú");
  const list = walkers.length > 0 ? walkers : same;
  return list.length > 0 ? list[id % list.length].asset : undefined;
}

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
    const monster = !!spec.monster;
    return {
      id: u.id,
      team: u.team,
      row: spec.row,
      name: `${u.team === 0 ? "A" : "B"}${u.id}`,
      element: u.element,
      hpMax: u.hp,
      manaMax: u.manaMax / ONE,
      pos: u.pos,
      sprite: monster ? beastSprite(u.element, u.id) : talent ? "tu_si/" + talent : undefined,
      level: spec.level,
      ...(monster ? { monster } : {}),
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

    // Người đánh và hệ chiêu của từng mục tiêu trong tick này: số sát thương lệch theo người đánh, đòn khắc hiện nổi hơn.
    const hitBy = new Map<number, { src: number; element: Element }>();
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
      for (const t of e.targets) if (!hitBy.has(t)) hitBy.set(t, { src: e.unitId, element: slot.tech.element });
    }
    for (const u of battle.units) if (u.channel) centers.set(u.id, u.channel.center);

    battle.units.forEach((u, i) => {
      const p = prev[i];
      if (p.hp <= 0) return;
      if (u.pos !== p.pos) events.push({ tick, kind: "move", unit: u.id, pos: u.pos });
      const hp = Math.max(0, u.curHp);
      const by = hitBy.get(u.id);
      if (hp < p.hp) {
        const counter = !!by && elementMultiplier(by.element, u.element) >= COUNTER;
        events.push({ tick, kind: "hit", unit: u.id, src: by?.src ?? u.id, amount: p.hp - hp, crit: false, hp, ...(counter ? { counter } : {}) });
        if (hp === 0) events.push({ tick, kind: "death", unit: u.id });
      } else if (hp > p.hp) {
        events.push({ tick, kind: "heal", unit: u.id, src: by?.src ?? u.id, amount: hp - p.hp, hp });
      }
      // Mana hồi đều mỗi tick nên chỉ ghi lúc tiêu (trước và sau khi trừ) và lúc vừa đầy; trình phát nội suy đoạn hồi.
      const regen = Math.min(u.manaMax, p.mana + u.regen);
      if (u.mana < regen) {
        events.push({ tick, kind: "mana", unit: u.id, mana: regen / ONE });
        events.push({ tick, kind: "mana", unit: u.id, mana: u.mana / ONE });
      } else if (u.mana === u.manaMax && p.mana < u.manaMax) {
        events.push({ tick, kind: "mana", unit: u.id, mana: u.mana / ONE });
      }
      // Trạng thái: ghi lúc thời hạn đổi (áp mới, kéo dài); giải sớm (Chuông giải choáng, trói cả đội) và khiên vỡ
      // trước hạn thì ghi until = tick.
      for (const [kind, field] of UNTIL) {
        const until = u[field];
        if (until === p.until[kind]) continue;
        if (until > tick) events.push({ tick, kind: "status", unit: u.id, status: kind, until });
        else if (p.until[kind] > tick) events.push({ tick, kind: "status", unit: u.id, status: kind, until: tick });
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

/**
 * Nguồn replay chạy trận thật từ một BattleInput dựng sẵn; `arena` chọn nền sân (ví dụ mo_linh_thach cho trận tranh mỏ).
 * `side`: tên hai bên và phía người xem, để màn Trận hiện "Ta"/"Địch" (hay tên tông môn) và "Thắng"/"Thua".
 */
export function simReplaySource(label: string, input: () => BattleInput, arena?: string, side?: Pick<Replay, "teams" | "viewer">): ReplaySource {
  return { label, load: async () => ({ ...replayFromSim(input()), ...(arena ? { arena } : {}), ...side }) };
}

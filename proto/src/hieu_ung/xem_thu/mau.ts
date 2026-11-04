// Replay dựng sẵn cho trang xem thử: một người ra một chiêu theo công thức (loại chiêu, hệ chủ, hệ phụ, biến thể, phẩm),
// đủ bốn pha: khởi chiêu, đường bay, chạm trúng, trạng thái kéo dài (trạng thái theo hiệu ứng hệ ở GDD mục 9 và luật
// loại chiêu ở mục 8, thời hạn lấy từ @ktlp/sim). Không chạy sim: đây là trận mẫu để xem hình.
import { BATTLE, ELEMENT_EFFECTS, SKILL_RULES, TICKS_PER_SECOND } from "@ktlp/sim";
import type { ElementId, Replay, ReplayEvent, ReplayUnit, SkillId } from "../../replay/types.ts";
import type { FxStyle } from "../recipe.ts";
import type { StatusEvent } from "../trang_thai.ts";

const TPS = TICKS_PER_SECOND;
/** Tick ra chiêu (pha 3) của chiêu không vận công; chiêu vận công bắt đầu vận sớm hơn. */
const CAST = 40;
const AFTER = 90;

const TARGETS: Record<SkillId, number> = {
  can_don: 1, can_quet: 3, tam_xa: 2, dien_rong: 4, ho_the: 3, bua_chu: 1, tran_phap: 4, hoi_phuc: 3, khong_che: 1, than_phap: 1,
};
const MELEE = new Set<SkillId>(["can_don", "can_quet"]);
const ALLY = new Set<SkillId>(["ho_the", "hoi_phuc"]);

/** Trận mẫu cho một chiêu. `ult`: chiêu mang chiêu cuối tông chủ. */
export function sampleReplay(style: FxStyle, opts: { ult?: boolean } = {}): Replay {
  const { skill, element } = style;
  const subs = (style.subs ?? []).filter((e) => e !== element);
  const palette: ElementId[] = [element, ...subs];
  const castTicks = skill === "tran_phap" ? SKILL_RULES.formationCastTicks : skill === "dien_rong" ? SKILL_RULES.aoeCastTicks : 0;
  const tick = CAST + castTicks;
  const melee = MELEE.has(skill);
  // Người ra chiêu đội A (id 1) cùng hai đồng đội; bốn địch đội B. Cận chiến đứng sát địch, thân pháp lướt tới.
  const casterPos = melee ? 5400 : skill === "than_phap" ? 3600 : 3800;
  const units: ReplayUnit[] = [
    unit(1, 0, 0, element, casterPos),
    unit(2, 0, 0, subs[0] ?? element, casterPos - 300),
    unit(3, 0, 1, subs[1] ?? "quang", casterPos - 1100),
    unit(101, 1, 0, "kim", 6200),
    unit(102, 1, 0, "moc", 6300),
    unit(103, 1, 1, "thuy", 7000),
    unit(104, 1, 1, "hoa", 7100),
  ];
  const foes = [101, 102, 103, 104];
  const allies = [1, 2, 3];
  const n = TARGETS[skill];
  const targets = (ALLY.has(skill) ? allies : foes).slice(0, n);
  const events: ReplayEvent[] = [];
  const statuses: StatusEvent[] = [];
  const zone = skill === "dien_rong" || skill === "tran_phap";
  if (skill === "than_phap") events.push({ tick, kind: "move", unit: 1, pos: 6200 - 500 });
  const extra = { grade: style.grade, variant: style.variant, ...(style.dang !== undefined ? { dang: style.dang } : {}) };
  events.push({
    tick, kind: "cast", unit: 1, skill, element, targets,
    ...(castTicks ? { start: CAST } : {}),
    ...(zone ? { center: 6600, radius: skill === "tran_phap" ? 1500 : 1200 } : {}),
    ...(subs.length ? { subElements: subs } : {}),
    ...(opts.ult ? { ult: true } : {}),
    ...extra,
  } as ReplayEvent);
  for (const id of targets) {
    if (ALLY.has(skill)) {
      events.push({ tick, kind: "heal", unit: id, src: 1, amount: 900, hp: 30000 });
      continue;
    }
    const kill = skill === "tran_phap" && id === targets[0];
    events.push({ tick, kind: "hit", unit: id, src: 1, amount: kill ? 30000 : 2400, crit: palette.includes("loi"), hp: kill ? 0 : 27600 });
    if (kill) {
      events.push({ tick, kind: "death", unit: id });
      continue;
    }
    // Trạng thái theo hiệu ứng hệ của chủ quyển và phụ quyển; Cực hàn, Lôi luôn ra ở trận mẫu để xem được hình.
    if (skill === "khong_che") statuses.push(st(tick, id, "stun", SKILL_RULES.stunTicks));
    else if (palette.includes("cuc_han")) statuses.push(st(tick, id, "stun", ELEMENT_EFFECTS.cuc_han.ticks ?? TPS));
    else if (palette.includes("loi")) statuses.push(st(tick, id, "stun", ELEMENT_EFFECTS.loi.value));
    if (palette.includes("moc")) statuses.push(st(tick, id, "root", ELEMENT_EFFECTS.moc.value));
    if (palette.includes("thuy")) statuses.push(st(tick, id, "slow", ELEMENT_EFFECTS.thuy.ticks ?? 2 * TPS));
    if (palette.includes("hoa")) statuses.push(st(tick, id, "burn", ELEMENT_EFFECTS.hoa.ticks ?? 3 * TPS));
    if (palette.includes("cuc_am")) statuses.push(st(tick, id, "healCut", ELEMENT_EFFECTS.cuc_am.ticks ?? 3 * TPS));
    if (palette.includes("phong") && !melee) events.push({ tick, kind: "move", unit: id, pos: Math.min(BATTLE.fieldLength, posOf(units, id) + 1000) });
  }
  if (skill === "ho_the" || (skill === "hoi_phuc" && style.variant === "linh")) {
    for (const id of targets) statuses.push(st(tick, id, "shield", SKILL_RULES.shieldTicks / 2));
  }
  if (palette.includes("tho") && !ALLY.has(skill)) statuses.push(st(tick, 1, "shield", SKILL_RULES.shieldTicks / 2));
  if (skill === "than_phap") statuses.push(st(tick, 1, "exposed", SKILL_RULES.exposedTicks));
  events.push(...statuses);
  events.sort((a, b) => a.tick - b.tick);
  return {
    tps: TPS,
    ticks: tick + AFTER,
    fieldLength: BATTLE.fieldLength,
    units,
    events,
    winner: "A",
    arena: "vo_truong",
  };
}

function unit(id: number, team: 0 | 1, row: 0 | 1, element: ElementId, pos: number): ReplayUnit {
  return { id, team, row, name: (team ? "B" : "A") + id, element, hpMax: 30000, manaMax: 100, pos };
}

function posOf(units: ReplayUnit[], id: number): number {
  return units.find((u) => u.id === id)?.pos ?? 0;
}

function st(tick: number, unit: number, status: StatusEvent["status"], ticks: number): StatusEvent {
  return { tick, kind: "status", unit, status, until: tick + ticks };
}

/** Tick ra chiêu của trận mẫu (để trang xem thử báo pha). */
export function sampleCastTick(skill: SkillId): number {
  return CAST + (skill === "tran_phap" ? SKILL_RULES.formationCastTicks : skill === "dien_rong" ? SKILL_RULES.aoeCastTicks : 0);
}

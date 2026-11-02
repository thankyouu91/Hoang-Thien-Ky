// Dựng đội mẫu qua luật của @ktlp/rules, đúng đường người chơi đi: nhặt tàn quyển trong danh mục 480, nộp vào Tàng Kinh Các,
// ghép công pháp, đặt bộ truyền thụ, rồi mỗi đệ tử học và chọn 4 công pháp mang vào trận.
import {
  Rng, TALENTS, baseStats, maxGradeAtLevel, mul, ONE,
  type Element, type SkillType, type Talent, type UnitSpec,
} from "@ktlp/sim";
import {
  SCROLL_KINDS, RULES, apply, emptyState, addSect, addMember, transmissionSlots, loadoutTechniques,
  type Command, type GameState, type RuleEvent, type ScrollKind,
} from "@ktlp/rules";
import { BALANCE } from "./config.ts";

/** Đội mẫu cố định một chiều, còn lại ngẫu nhiên; để trống là đội ngẫu nhiên. */
export interface Plan {
  element?: Element; // hệ chủ quyển của mọi công pháp, cũng là linh căn của mọi người
  sub?: Element; // hệ phụ quyển của mọi công pháp
  firstType?: SkillType; // mọi người mang loại chiêu này ở ưu tiên 1
}

/** Phần giống nhau ở hai đội của một cặp: cấp, rồi chỉ số và tài năng theo từng vị trí. */
export interface Frame {
  level: number;
  slots: { hp: number; atk: number; def: number; talent: Talent }[];
}

export type Member = Omit<UnitSpec, "id">;

/** Công pháp ưu tiên 1 thuộc loại này thì đứng hàng trước. */
const FRONT: SkillType[] = ["can_don", "can_quet", "ho_the", "than_phap"];

export function makeFrame(r: Rng): Frame {
  const level = BALANCE.levelMin + r.int(BALANCE.levelMax - BALANCE.levelMin + 1);
  const s = baseStats(level);
  const spread = BALANCE.statSpread;
  const vary = (v: number) => mul(v, ONE - spread + r.int(2 * spread + 1));
  return {
    level,
    slots: Array.from({ length: BALANCE.teamSize }, () => ({ hp: vary(s.hp), atk: vary(s.atk), def: vary(s.def), talent: TALENTS[r.int(TALENTS.length)] })),
  };
}

function run(state: GameState, cmd: Command): RuleEvent[] {
  const res = apply(state, cmd, 0);
  if (!res.ok) throw new Error(`${cmd.type}: ${res.error}`);
  return res.events;
}

const kinds: Record<string, ScrollKind[]> = {};
/** Một loại tàn quyển ngẫu nhiên trong danh mục, theo hệ và loại chiêu nếu có; `notType` = bỏ loại chiêu này. */
function pickKind(r: Rng, element?: Element, type?: SkillType, notType?: SkillType): ScrollKind {
  const key = `${element ?? "*"}|${type ?? "*"}|${notType ?? "-"}`;
  const list = (kinds[key] ??= SCROLL_KINDS.filter((k) => (!element || k.element === element) && (!type || k.type === type) && k.type !== notType));
  return list[r.int(list.length)];
}

/** `count` phần tử khác nhau của `list`, thứ tự ngẫu nhiên. */
function pickDistinct<T>(r: Rng, list: T[], count: number): T[] {
  const rest = list.slice();
  const out: T[] = [];
  for (let i = 0; i < count; i++) out.push(rest.splice(r.int(rest.length), 1)[0]);
  return out;
}

/** Một đội theo `plan` trên khung `frame`; `weaker` = máu, công lực, phòng thủ giảm bao nhiêu phần nghìn. */
export function buildTeam(r: Rng, plan: Plan, frame: Frame, weaker = 0): Member[] {
  const state = emptyState();
  addSect(state, "tong", BALANCE.sectLevel);
  addMember(state, "chu", "tong", "tong_chu", frame.level);
  const grade = maxGradeAtLevel(frame.level);
  const typed = plan.firstType ? BALANCE.typedTechniques : 0;

  // Bộ truyền thụ: `typed` công pháp loại đang xét đứng đầu, còn lại loại khác.
  const pool: number[] = [];
  for (let i = 0; i < transmissionSlots(BALANCE.sectLevel); i++) {
    const main = i < typed ? pickKind(r, plan.element, plan.firstType) : pickKind(r, plan.element, undefined, plan.firstType);
    const sub = pickKind(r, plan.sub);
    const uids = [main, sub].map((k) => {
      const ev = run(state, { type: "nhat_tan_quyen", actor: "system", memberId: "chu", kind: k.id, grade })[0];
      if (ev.type !== "nhat_tan_quyen") throw new Error(ev.type);
      run(state, { type: "nop_tan_quyen", actor: "chu", scrollUid: ev.scroll.uid });
      return ev.scroll.uid;
    });
    const ev = run(state, { type: "ghep_cong_phap", actor: "chu", main: uids[0], subs: uids.slice(1) })[0];
    if (ev.type !== "ghep_cong_phap") throw new Error(ev.type);
    pool.push(ev.technique.id);
  }
  run(state, { type: "dat_bo_truyen_thu", actor: "chu", techniqueIds: pool });

  const pct = ONE - weaker;
  return frame.slots.map((slot, i) => {
    const id = `d${i}`;
    addMember(state, id, "tong", "noi_mon", frame.level);
    const loadout = typed
      ? [pool[r.int(typed)], ...pickDistinct(r, pool.slice(typed), RULES.loadoutSize - 1)]
      : pickDistinct(r, pool, RULES.loadoutSize);
    for (const techniqueId of loadout) run(state, { type: "hoc_cong_phap", actor: id, techniqueId });
    run(state, { type: "mang_vao_tran", actor: id, techniqueIds: loadout });
    const techniques = loadoutTechniques(state, id);
    return {
      level: frame.level,
      element: plan.element ?? techniques[0].element, // luyện đúng hệ của công pháp ưu tiên 1
      talents: [slot.talent],
      hp: mul(slot.hp, pct), atk: mul(slot.atk, pct), def: mul(slot.def, pct),
      row: (FRONT.includes(techniques[0].type) ? 0 : 1) as 0 | 1,
      techniques,
    };
  });
}

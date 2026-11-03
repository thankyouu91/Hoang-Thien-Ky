// Vòng trận 20 tick/giây trên trục 12 ô (GDD mục 8). Đơn vị: phần nghìn, tick, milli-ô (xem config.ts).
import { mul, clamp, ONE } from "./fixed.ts";
import { Rng } from "./rng.ts";
import { Hasher } from "./hash.ts";
import { elementMultiplier, type Element } from "./elements.ts";
import {
  BATTLE, SKILL_SPECS, ALLY_SKILLS, SKILL_RULES as R, CAST_FLOOR, RESIST_CAP, MAX_RANGE_BONUS, type SkillType, type Talent, type BuffStat,
} from "./config.ts";
import { techniqueFx, type Technique, type TechniqueFx } from "./technique.ts";
import { unitBonuses, type UnitBonuses } from "./stats.ts";

export const TICKS_PER_SECOND = 20;
export const MAX_TICKS = 90 * TICKS_PER_SECOND; // trận tối đa 90 giây
const MANA_REGEN_PER_TICK = (BATTLE.manaRegenPerSec * ONE) / TICKS_PER_SECOND; // mana tính theo phần nghìn
const NEVER = -1_000_000; // mốc tick "chưa từng xảy ra"
const MELEE: SkillType[] = ["can_don", "can_quet", "ho_the"]; // Tu thể +10%
const CLOSE_RANGE: SkillType[] = ["can_don", "can_quet", "ho_the", "than_phap"]; // đánh sát người: không đẩy lùi
const RANGED: SkillType[] = ["tam_xa", "dien_rong"]; // Tu pháp +15%

/** Cách chọn mục tiêu thay cho mặc định của loại chiêu. "Máu thấp nhất" là % máu, hòa thì máu còn ít hơn, rồi id. */
export type TargetPick = "most_targeted" | "lowest_hp" | "channeling" | "back_row_lowest_hp";

/** Ý châu: đổi hành vi một loại chiêu, áp cho mọi công pháp loại đó người cầm mang (tab Trang bị, phần 5). */
export interface SkillMod {
  shieldPierce?: number; // phần nghìn sát thương đi thẳng vào máu, bỏ qua khiên
  extraTargets?: number; // thêm mục tiêu; các mục tiêu thêm nhận `extraTargetDamage`
  extraTargetDamage?: number; // phần nghìn
  rangeBonus?: number; // milli-ô, chung trần MAX_RANGE_BONUS với tầm của hệ
  castTicks?: number; // cộng tick vận công hoặc bày trận (âm là nhanh hơn), sau phần cắt % của tài năng, không dưới CAST_FLOOR
  manaCost?: number; // phần nghìn mana của chiêu
  pick?: TargetPick;
  pickUses?: number; // số lần ra chiêu đầu mỗi trận dùng `pick`; không ghi là mọi lần
}

export interface UnitSpec {
  id: number; // duy nhất trong trận, quyết định thứ tự cập nhật
  level: number;
  element: Element; // linh căn chính, là hệ bị đánh trúng
  element2?: Element; // linh căn thứ hai
  talents?: Talent[]; // 1–2 tài năng
  hp: number;
  atk: number; // công lực: sát thương = D × atk / 100
  def: number;
  resist?: Partial<Record<Element, number>>; // kháng theo hệ, phần nghìn (từ ngọc)
  row: 0 | 1; // 0 hàng trước, 1 hàng sau
  techniques: Technique[]; // 1–4 công pháp, theo thứ tự ưu tiên
  manaMax?: number; // mặc định BATTLE.manaMax
  boss?: boolean; // miễn tuyệt sát
  monster?: boolean; // dị thú hoặc boss PvE, nhận sát thương cộng thêm của set Liệp Thú; NPC, trận nhãn, hộ trận trong chiến tranh không đặt cờ này dù là boss
  sectId?: string; // tông môn, để xét công pháp của kẻ phản bội
  /** Cộng thêm vào chỉ số trận từ trang bị và set (phần nghìn; hp, atk, def, manaMax là % của chỉ số gốc). */
  bonuses?: Partial<Record<BuffStat, number>>;
  /** Sát thương cộng thêm cho công pháp có hệ chủ là hệ đó (ngọc ở ô công), phần nghìn. */
  elementDamage?: Partial<Record<Element, number>>;
  /** Đổi hành vi theo loại chiêu (Ý châu trên vũ khí). */
  skillMods?: Partial<Record<SkillType, SkillMod>>;
}
export interface BattleInput {
  seed: number;
  teamA: UnitSpec[];
  teamB: UnitSpec[];
  /** Nhật ký lệnh: tại tick nào, đơn vị nào tung chiêu cuối tông chủ */
  commands?: { tick: number; unitId: number }[];
}
export interface BattleResult {
  winner: "A" | "B" | "draw";
  ticks: number;
  hash: number;
  survivorsA: number;
  survivorsB: number;
}
/** Một lần ra chiêu; dùng cho test và trình xem trận. Chiêu vận công ghi lúc phát, `startTick` là lúc bắt đầu. */
export interface CastEvent {
  tick: number;
  startTick: number;
  unitId: number;
  slot: number; // vị trí công pháp trong danh sách ưu tiên
  targets: number[];
}

interface Slot {
  tech: Technique;
  fx: TechniqueFx;
  range: number;
  radius: number;
  cost: number; // mana phần nghìn
  cooldown: number; // hồi chiêu sau buff, tick
  cd: number; // hồi chiêu còn lại, phần nghìn tick; <= 0 là sẵn sàng
  bonus: number; // sát thương cộng thêm của công pháp này (Hỏa, Tu thể, Tu pháp)
  ally: boolean;
  uses: number; // số lần còn dùng trong trận, -1 = không giới hạn
  maxTargets: number; // số mục tiêu của loại chiêu cộng mục tiêu thêm của Ý châu
  mod: SkillMod;
  pickLeft: number; // số lần còn dùng `mod.pick`, -1 = mọi lần
}
/** Chiêu đang vận công (diện rộng) hoặc đang bày (trận pháp). */
interface Channel {
  slot: number;
  startTick: number;
  resolveTick: number;
  center: number; // tâm vùng, chốt lúc bắt đầu
  ult: boolean;
  interruptible: boolean;
}
export interface Unit {
  id: number;
  team: 0 | 1;
  level: number;
  element: Element;
  hp: number; // máu tối đa sau buff
  atk: number;
  def: number; // sau buff
  resist: Partial<Record<Element, number>>;
  boss: boolean;
  monster: boolean;
  row: 0 | 1;
  sectId: string | null;
  b: UnitBonuses;
  curHp: number;
  pos: number;
  mana: number;
  manaMax: number;
  regen: number; // mana hồi mỗi tick, phần nghìn
  slots: Slot[];
  preferredRange: number; // dừng tiến khi địch gần nhất trong khoảng này
  ultReady: boolean;
  shield: number;
  shieldUntil: number;
  stunUntil: number; // bị khống chế tới tick này
  rootUntil: number; // bị trói chân, không đi được
  slow: number;
  slowUntil: number;
  burn: number; // sát thương thiêu đốt mỗi giây
  burnNext: number;
  burnUntil: number;
  healCut: number;
  healCutUntil: number;
  exposedUntil: number; // lộ vị trí tới tick này, địch ưu tiên đánh
  stealthUntil: number; // ẩn thân, địch không chọn được
  selfShieldNext: number; // Thổ: tick sớm nhất được khiên bản thân lại
  channel: Channel | null;
}

/** Hệ số chênh lệch cấp (GDD mục 8): bên thấp còn tối thiểu 55%, bên cao cộng tối đa 30%. */
export function levelGapMultiplier(atkLevel: number, defLevel: number): number {
  const gap = atkLevel - defLevel;
  if (gap < 0) return Math.max(550, ONE - 15 * -gap);
  return ONE + Math.min(300, 10 * gap);
}

/** Điều chỉnh cho một đòn: sát thương cộng thêm, sát thương chí mạng cộng thêm, xuyên giáp, xuyên kháng (phần nghìn). */
export interface HitMods {
  damage?: number;
  critDamage?: number;
  armorPen?: number;
  resistPen?: number;
}

/** Sát thương một đòn lên một mục tiêu. */
export function hitDamage(
  a: { atk: number; level: number },
  tech: Technique,
  d: { element: Element; level: number; def: number; resist?: Partial<Record<Element, number>> },
  crit: boolean,
  ult: boolean,
  mods: HitMods = {},
): number {
  let dmg = Math.trunc((tech.damage * a.atk) / (100 * ONE));
  if (mods.damage) dmg = mul(dmg, ONE + mods.damage);
  dmg = mul(dmg, elementMultiplier(tech.element, d.element));
  dmg = mul(dmg, levelGapMultiplier(a.level, d.level));
  if (ult) dmg = mul(dmg, BATTLE.ultMultiplier);
  if (crit) dmg = mul(dmg, BATTLE.critDamage + (mods.critDamage ?? 0));
  // Phòng thủ giảm sát thương theo tỷ lệ def / (def + 1000), không về 0; xuyên giáp bỏ qua một phần phòng thủ.
  const def = mul(d.def, ONE - (mods.armorPen ?? 0));
  const reduce = Math.trunc((def * ONE) / (def + BATTLE.defScale));
  dmg = mul(dmg, ONE - clamp(reduce, 0, BATTLE.defCap));
  const resist = d.resist?.[tech.element] ?? 0;
  if (resist > 0) dmg = mul(dmg, ONE - clamp(mul(resist, ONE - (mods.resistPen ?? 0)), 0, RESIST_CAP));
  return Math.max(1, dmg);
}

/** Khiên hộ thể: 120% sát thương gốc (bỏ hệ số k của loại chiêu) nhân công lực. */
export function shieldAmount(atk: number, tech: Technique): number {
  const base = Math.trunc((tech.damage * ONE) / SKILL_SPECS[tech.type].k);
  return mul(Math.trunc((base * atk) / (100 * ONE)), R.shieldOfBase);
}

const realm = (level: number) => Math.trunc((level - 1) / R.realmLevels);

function makeUnit(spec: UnitSpec, team: 0 | 1): Unit {
  if (spec.techniques.length < 1 || spec.techniques.length > 4) throw new Error(`Đơn vị ${spec.id} cần 1–4 công pháp`);
  const talents = spec.talents ?? [];
  if (talents.length > 2) throw new Error(`Đơn vị ${spec.id} có tối đa 2 tài năng`);
  const roots = spec.element2 && spec.element2 !== spec.element ? [spec.element, spec.element2] : [spec.element];
  const b = unitBonuses(roots, talents, spec.techniques);
  if (spec.bonuses) for (const k of Object.keys(spec.bonuses) as BuffStat[]) b[k] += spec.bonuses[k] ?? 0;
  const slots: Slot[] = spec.techniques.map((tech) => {
    const s = SKILL_SPECS[tech.type];
    const cut = b.cooldownCut + (tech.type === "than_phap" ? b.dashCooldownCut : 0);
    const cooldown = Math.max(1, mul(tech.cooldownTicks, ONE - cut));
    // Set đồ chỉ làm mạnh hiệu ứng hệ công pháp đã có: tê liệt của Lôi, xuyên giáp của Kim.
    const fx = techniqueFx(tech);
    if (fx.paralyze) fx.paralyze += b.paralyzeTicks;
    if (fx.armorPen) fx.armorPen += b.armorPen;
    const mod = spec.skillMods?.[tech.type] ?? {};
    return {
      tech,
      fx,
      // Cung Ý không cộng dồn với tầm của hệ: mỗi công pháp tối đa +1 ô.
      range: s.range + Math.min(MAX_RANGE_BONUS, tech.rangeBonus + (mod.rangeBonus ?? 0)),
      radius: s.radius,
      // Không công pháp nào tốn hơn mana tối đa chuẩn, để ghép đối cực (mana ×1,5) không tạo chiêu không bao giờ ra được (đề xuất).
      cost: mul(Math.min(tech.manaCost, BATTLE.manaMax), mod.manaCost ?? ONE) * ONE,
      cooldown,
      cd: mul(cooldown * ONE, BATTLE.initialCooldown),
      bonus: b.damage + (MELEE.includes(tech.type) ? b.melee : 0) + (RANGED.includes(tech.type) ? b.ranged : 0) +
        (spec.elementDamage?.[tech.element] ?? 0),
      ally: ALLY_SKILLS.includes(tech.type),
      uses: tech.type === "bua_chu" ? R.talismanUses + b.extraTalismans : -1,
      maxTargets: tech.targets + (mod.extraTargets ?? 0),
      mod,
      pickLeft: mod.pick ? mod.pickUses ?? -1 : 0,
    };
  });
  const firstAttack = slots.find((s) => !s.ally);
  const healer = slots.some((s) => s.tech.type === "hoi_phuc");
  const startA = spec.row === 0 ? BATTLE.frontPos : BATTLE.backPos;
  const hp = mul(spec.hp, ONE + b.hp);
  const manaMax = mul(spec.manaMax ?? BATTLE.manaMax, ONE + b.manaMax) * ONE;
  return {
    id: spec.id, team, level: spec.level, element: spec.element,
    hp, atk: mul(spec.atk, ONE + b.atk), def: mul(spec.def, ONE + b.def), resist: spec.resist ?? {}, boss: spec.boss ?? false,
    monster: spec.monster ?? false, row: spec.row, sectId: spec.sectId ?? null, b,
    curHp: hp,
    pos: team === 0 ? startA : BATTLE.fieldLength - startA,
    mana: manaMax,
    manaMax,
    regen: healer ? mul(MANA_REGEN_PER_TICK, ONE - R.healerRegenPenalty) : MANA_REGEN_PER_TICK,
    slots,
    preferredRange: firstAttack ? firstAttack.range : BATTLE.supportStandoff,
    ultReady: false,
    shield: 0, shieldUntil: NEVER,
    stunUntil: NEVER, rootUntil: NEVER,
    slow: 0, slowUntil: NEVER,
    burn: 0, burnNext: NEVER, burnUntil: NEVER,
    healCut: 0, healCutUntil: NEVER,
    exposedUntil: NEVER,
    stealthUntil: b.stealthTicks > 0 ? b.stealthTicks : NEVER,
    selfShieldNext: NEVER,
    channel: null,
  };
}

/** Trận chạy từng tick; `simulate` chạy hết một lượt. */
export class Battle {
  readonly units: Unit[];
  readonly events: CastEvent[] = [];
  tick = 0;
  private readonly rng: Rng;
  private readonly hasher = new Hasher();
  private readonly cmds: { tick: number; unitId: number }[];
  private ci = 0;
  private readonly alive: [number, number];
  private readonly teams: [Unit[], Unit[]]; // theo id; tìm địch chỉ duyệt đội bên kia
  private readonly record: boolean;

  /** `record` = ghi lại từng lần ra chiêu vào `events`. */
  constructor(input: BattleInput, record = false) {
    this.record = record;
    this.rng = new Rng(input.seed);
    this.units = [...input.teamA.map((u) => makeUnit(u, 0)), ...input.teamB.map((u) => makeUnit(u, 1))].sort((x, y) => x.id - y.id);
    this.teams = [this.units.filter((u) => u.team === 0), this.units.filter((u) => u.team === 1)];
    this.cmds = [...(input.commands ?? [])].sort((x, y) => x.tick - y.tick || x.unitId - y.unitId);
    this.alive = [input.teamA.length, input.teamB.length];
  }

  get finished(): boolean {
    return this.alive[0] === 0 || this.alive[1] === 0 || this.tick >= MAX_TICKS;
  }

  step(): void {
    const tick = this.tick;
    while (this.ci < this.cmds.length && this.cmds[this.ci].tick <= tick) {
      const c = this.cmds[this.ci++];
      const u = this.units.find((x) => x.id === c.unitId);
      if (u && u.curHp > 0) u.ultReady = true;
    }
    for (const u of this.units) {
      if (u.curHp <= 0) continue;
      if (u.burn > 0 && tick >= u.burnNext) {
        this.hurt(u, u.burn);
        u.burnNext += TICKS_PER_SECOND;
        if (u.burnNext > u.burnUntil) u.burn = 0;
        if (u.curHp <= 0) {
          if (this.alive[0] === 0 || this.alive[1] === 0) break;
          continue;
        }
      }
      u.mana = Math.min(u.manaMax, u.mana + u.regen);
      const slowed = tick < u.slowUntil ? u.slow : 0; // chỉ chậm di chuyển
      const recover = ONE + u.b.attackSpeed;
      for (const s of u.slots) if (s.cd > 0) s.cd -= recover;
      if (u.shield > 0 && tick >= u.shieldUntil) u.shield = 0;
      if (u.channel) {
        // Chiêu vận công vẫn phát khi tới giờ; chiêu không bị cắt ngang thì phát cả khi đang choáng.
        if (tick >= u.channel.resolveTick) this.resolve(u);
      } else if (tick >= u.stunUntil) {
        this.act(u, slowed);
      }
      if (this.alive[0] === 0 || this.alive[1] === 0) break;
    }
    for (const u of this.units) {
      this.hasher.add(u.curHp > 0 ? u.curHp : 0);
      this.hasher.add(u.pos);
      this.hasher.add(u.mana);
      this.hasher.add(u.shield);
    }
    this.hasher.add(tick);
    this.tick++;
  }

  result(): BattleResult {
    const [a, b] = this.alive;
    return { winner: a > 0 && b === 0 ? "A" : b > 0 && a === 0 ? "B" : "draw", ticks: this.tick, hash: this.hasher.value(), survivorsA: a, survivorsB: b };
  }

  /** Khống chế `t` trong `ticks`; bị khống chế lại trong cửa sổ thì còn một nửa. Cắt chiêu vận công. */
  control(t: Unit, ticks: number): void {
    if (t.curHp <= 0) return;
    const dur = this.tick < t.stunUntil + R.controlDrWindow ? Math.trunc(ticks / 2) : ticks;
    t.stunUntil = Math.max(t.stunUntil, this.tick + dur);
    if (t.channel && t.channel.interruptible) t.channel = null;
  }

  /** Dùng công pháp đầu tiên sẵn sàng, đủ mana và có mục tiêu; không có thì tiến về địch gần nhất. */
  private act(u: Unit, slowed: number): void {
    const foe = this.nearestEnemy(u);
    if (!foe) return;
    const dist = Math.abs(foe.pos - u.pos);
    for (let i = 0; i < u.slots.length; i++) {
      const s = u.slots[i];
      if (s.cd > 0 || u.mana < s.cost || s.uses === 0) continue;
      if (!s.ally && dist > s.range) continue;
      const type = s.tech.type;
      let targets: Unit[] = [];
      const pick = s.pickLeft !== 0 ? s.mod.pick : undefined;
      // Hồi phục mặc định đã chọn % máu thấp nhất, nên `lowest_hp` của Cầm Ý không đổi gì.
      if (type === "hoi_phuc") targets = this.pickAllies(u, s);
      else if (type === "ho_the") targets = this.pickGuarded(u, s, foe, pick);
      else if (s.radius === 0) targets = this.pickEnemies(u, s, u.pos, s.range, pick);
      if (targets.length === 0 && s.radius === 0) continue;

      u.mana -= s.cost;
      s.cd = s.cooldown * ONE;
      if (s.uses > 0) s.uses--;
      if (pick && s.pickLeft > 0) s.pickLeft--;
      if (s.fx.selfShield && this.tick >= u.selfShieldNext) {
        this.addShield(u, u, mul(u.hp, s.fx.selfShield));
        u.selfShieldNext = this.tick + R.selfShieldCooldownTicks;
      }
      if (s.radius > 0) {
        // Diện rộng vận công, trận pháp bày trận: phát sau, tâm chốt ở địch gần nhất lúc bắt đầu.
        const formation = type === "tran_phap";
        u.channel = {
          slot: i,
          startTick: this.tick,
          resolveTick: this.tick + (formation
            ? Math.max(CAST_FLOOR.formationTicks, mul(R.formationCastTicks, ONE - u.b.formationCut) + u.b.formationTicks + (s.mod.castTicks ?? 0))
            : Math.max(CAST_FLOOR.channelTicks, R.aoeCastTicks + u.b.channelTicks + (s.mod.castTicks ?? 0))),
          center: foe.pos,
          ult: this.takeUlt(u),
          interruptible: !formation || R.formationInterruptible,
        };
        return;
      }
      if (type === "hoi_phuc") this.heal(u, s, targets);
      else if (type === "ho_the") this.guard(u, s, targets, foe);
      else if (type === "than_phap") this.dash(u, s, targets[0]);
      else {
        this.strike(u, s, targets, this.takeUlt(u), 0, false);
        if (type === "khong_che") for (const t of targets) this.control(t, this.controlTicks(u, R.stunTicks));
      }
      this.log(u, i, this.tick, targets);
      return;
    }
    if (dist > u.preferredRange && this.tick >= u.rootUntil) {
      const speed = slowed ? mul(BATTLE.moveSpeed, ONE - slowed) : BATTLE.moveSpeed;
      const move = Math.min(speed, dist - u.preferredRange);
      u.pos = clamp(u.pos + (foe.pos > u.pos ? move : -move), 0, BATTLE.fieldLength);
    }
  }

  private resolve(u: Unit): void {
    const ch = u.channel!;
    u.channel = null;
    const s = u.slots[ch.slot];
    const targets = this.pickEnemies(u, s, ch.center, s.radius);
    this.strike(u, s, targets, ch.ult, 0, s.tech.type === "tran_phap");
    this.log(u, ch.slot, ch.startTick, targets);
  }

  /** Chiêu cuối tông chủ áp vào lần đánh kế tiếp rồi hết. */
  private takeUlt(u: Unit): boolean {
    const ult = u.ultReady;
    u.ultReady = false;
    return ult;
  }

  private log(u: Unit, slot: number, startTick: number, targets: Unit[]): void {
    if (this.record) this.events.push({ tick: this.tick, startTick, unitId: u.id, slot, targets: targets.map((t) => t.id) });
  }

  /** Địch nhìn thấy được (không ẩn thân), gần nhất → máu thấp hơn → id nhỏ hơn. */
  private nearestEnemy(u: Unit): Unit | undefined {
    let best: Unit | undefined;
    let bestDist = 0;
    for (const e of this.teams[1 - u.team]) {
      if (e.curHp <= 0 || this.tick < e.stealthUntil) continue;
      const d = Math.abs(e.pos - u.pos);
      if (!best || d < bestDist || (d === bestDist && (e.curHp < best.curHp || (e.curHp === best.curHp && e.id < best.id)))) {
        best = e;
        bestDist = d;
      }
    }
    return best;
  }

  /**
   * Địch trong khoảng `reach` quanh `center`: chiêu đơn ưu tiên kẻ đang lộ vị trí, rồi gần nhất → máu thấp → id.
   * `pick` của Ý châu thay thứ tự: % máu thấp nhất, kẻ đang vận công trước, hoặc hàng sau % máu thấp nhất (không có ai hàng sau thì như mặc định).
   */
  private pickEnemies(u: Unit, s: Slot, center: number, reach: number, pick?: TargetPick): Unit[] {
    const tick = this.tick;
    let list: Unit[] = [];
    for (const e of this.teams[1 - u.team]) {
      if (e.curHp > 0 && tick >= e.stealthUntil && Math.abs(e.pos - center) <= reach) list.push(e);
    }
    let byHp = pick === "lowest_hp";
    if (pick === "back_row_lowest_hp") {
      const back = list.filter((e) => e.row === 1);
      if (back.length > 0) {
        list = back;
        byHp = true;
      }
    }
    const exposedFirst = s.radius === 0;
    const order = (a: Unit, b: Unit) =>
      (exposedFirst ? (b.exposedUntil > tick ? 1 : 0) - (a.exposedUntil > tick ? 1 : 0) : 0) ||
      Math.abs(a.pos - center) - Math.abs(b.pos - center) || a.curHp - b.curHp || a.id - b.id;
    if (byHp) list.sort((a, b) => a.curHp * b.hp - b.curHp * a.hp || a.curHp - b.curHp || a.id - b.id);
    else if (pick === "channeling") list.sort((a, b) => (b.channel ? 1 : 0) - (a.channel ? 1 : 0) || order(a, b));
    else list.sort(order);
    if (list.length > s.maxTargets) list.length = s.maxTargets;
    return list;
  }

  /** Đồng minh (kể cả bản thân) đang mất máu, trong tầm, % máu thấp nhất trước. */
  private pickAllies(u: Unit, s: Slot): Unit[] {
    const list: Unit[] = [];
    for (const a of this.teams[u.team]) {
      if (a.curHp > 0 && a.curHp < a.hp && Math.abs(a.pos - u.pos) <= s.range) list.push(a);
    }
    list.sort((a, b) => a.curHp * b.hp - b.curHp * a.hp || a.id - b.id);
    if (list.length > s.tech.targets) list.length = s.tech.targets;
    return list;
  }

  /**
   * Hộ thể che các đồng minh (kể cả bản thân) đứng gần địch nhất, rồi % máu thấp nhất.
   * Côn Ý (`most_targeted`): trước hết là đồng minh bị nhiều địch nhắm nhất, tính là địch gần nhất của từng kẻ địch.
   */
  private pickGuarded(u: Unit, s: Slot, foe: Unit, pick?: TargetPick): Unit[] {
    const list: Unit[] = [];
    for (const a of this.teams[u.team]) {
      if (a.curHp > 0 && Math.abs(a.pos - u.pos) <= s.range) list.push(a);
    }
    const order = (a: Unit, b: Unit) =>
      Math.abs(a.pos - foe.pos) - Math.abs(b.pos - foe.pos) || a.curHp * b.hp - b.curHp * a.hp || a.id - b.id;
    if (pick === "most_targeted") {
      const aimed: Record<number, number> = {};
      for (const e of this.teams[1 - u.team]) {
        if (e.curHp <= 0) continue;
        const t = this.nearestEnemy(e);
        if (t) aimed[t.id] = (aimed[t.id] ?? 0) + 1;
      }
      list.sort((a, b) => (aimed[b.id] ?? 0) - (aimed[a.id] ?? 0) || order(a, b));
    } else list.sort(order);
    if (list.length > s.maxTargets) list.length = s.maxTargets;
    return list;
  }

  /** Đánh từng mục tiêu và áp hiệu ứng hệ; `execute` = trận pháp, mỗi mục tiêu có thể bị tuyệt sát. */
  private strike(u: Unit, s: Slot, targets: Unit[], ult: boolean, critBonus: number, execute: boolean): void {
    const fx = s.fx;
    const ramp = this.rampMultiplier();
    for (let i = 0; i < targets.length; i++) {
      const t = targets[i];
      if (t.curHp <= 0) continue;
      if (execute && !t.boss && realm(t.level) <= realm(u.level) && this.rng.chance(R.executeChance + u.b.executeBonus)) {
        this.hurt(t, t.curHp + t.shield);
        continue;
      }
      const crit = this.rng.chance(s.tech.critPerMille + u.b.critBonus + critBonus);
      let dmg = hitDamage(u, s.tech, t, crit, ult, {
        damage: s.bonus + (t.monster ? u.b.monsterDamage : 0), critDamage: u.b.critDamage, armorPen: fx.armorPen, resistPen: fx.resistPen + u.b.resistPen,
      });
      // Mục tiêu thêm của Đao Ý (sau số mục tiêu của loại chiêu) nhận ít sát thương hơn.
      if (i >= s.tech.targets) dmg = Math.max(1, mul(dmg, s.mod.extraTargetDamage ?? ONE));
      if (s.tech.forsakenSect !== undefined && s.tech.forsakenSect === t.sectId) dmg = Math.max(1, mul(dmg, BATTLE.betrayalDamage));
      if (ramp !== ONE) dmg = mul(dmg, ramp);
      this.hurt(t, dmg, s.mod.shieldPierce ?? 0);
      const drain = fx.healOfDamage + mul(fx.lifesteal, ONE + u.b.lifesteal);
      if (drain > 0) this.restore(u, u, mul(dmg, drain));
      if (t.curHp <= 0) continue;
      this.applyEffects(u, s, t, dmg, crit);
    }
  }

  /** Hiệu ứng hệ lên mục tiêu còn sống sau đòn đánh (GDD mục 9). */
  private applyEffects(u: Unit, s: Slot, t: Unit, dmg: number, crit: boolean): void {
    const fx = s.fx;
    const tick = this.tick;
    if (fx.root) t.rootUntil = Math.max(t.rootUntil, tick + this.controlTicks(u, fx.root));
    if (fx.slow) {
      t.slow = tick < t.slowUntil ? Math.max(t.slow, fx.slow) : fx.slow;
      t.slowUntil = Math.max(t.slowUntil, tick + fx.slowTicks);
    }
    if (fx.burn) {
      // Thiêu đốt không cộng dồn: đòn mới mạnh hơn thì thay, yếu hơn thì bỏ.
      const perSec = mul(mul(dmg, fx.burn), ONE + u.b.dot);
      if (t.burn === 0 || perSec >= t.burn) {
        t.burn = perSec;
        t.burnNext = tick + TICKS_PER_SECOND;
        t.burnUntil = tick + fx.burnTicks;
      }
    }
    if (fx.healCut) {
      t.healCut = tick < t.healCutUntil ? Math.max(t.healCut, fx.healCut) : fx.healCut;
      t.healCutUntil = Math.max(t.healCutUntil, tick + fx.healCutTicks);
    }
    if (fx.knockback && (R.meleeKnockback || !CLOSE_RANGE.includes(s.tech.type))) {
      t.pos = clamp(t.pos + (t.pos >= u.pos ? fx.knockback : -fx.knockback), 0, BATTLE.fieldLength);
    }
    if (fx.paralyze && crit) this.control(t, this.controlTicks(u, fx.paralyze));
    if (fx.freezeChance && this.rng.chance(fx.freezeChance)) this.control(t, this.controlTicks(u, fx.freezeTicks));
  }

  /** Trận quá `rampStartTicks` thì sát thương tăng dần theo từng nấc để trận phân thắng bại (chống hòa). */
  private rampMultiplier(): number {
    if (this.tick < BATTLE.rampStartTicks) return ONE;
    return ONE + BATTLE.rampPerStep * (1 + Math.trunc((this.tick - BATTLE.rampStartTicks) / BATTLE.rampStepTicks));
  }

  /** Thời gian khống chế sau buff Cực hàn. */
  private controlTicks(u: Unit, ticks: number): number {
    return mul(ticks, ONE + u.b.controlTime);
  }

  /** Trừ khiên trước, rồi trừ máu; phần `pierce` (phần nghìn) của sát thương đi thẳng vào máu. */
  private hurt(t: Unit, dmg: number, pierce = 0): void {
    if (t.shield > 0) {
      const absorbed = Math.min(t.shield, dmg - (pierce > 0 ? mul(dmg, pierce) : 0));
      t.shield -= absorbed;
      dmg -= absorbed;
    }
    if (dmg <= 0) return;
    t.curHp -= dmg;
    if (t.curHp <= 0) {
      this.alive[t.team]--;
      t.channel = null;
    }
  }

  /** Hồi máu: nhân hiệu quả hồi máu của người hồi, hồi máu nhận của người nhận, trừ phần bị Cực âm giảm. */
  private restore(src: Unit, t: Unit, amount: number): void {
    let a = mul(amount, ONE + src.b.healPower);
    a = mul(a, ONE + t.b.healTaken);
    if (this.tick < t.healCutUntil) a = mul(a, ONE - t.healCut);
    t.curHp = Math.min(t.hp, t.curHp + a);
  }

  /** Khiên không cộng dồn, giữ khiên lớn hơn; nhân hiệu quả khiên của người tạo và khiên nhận được của người nhận. */
  private addShield(src: Unit, t: Unit, amount: number): void {
    t.shield = Math.max(t.shield, mul(mul(amount, ONE + src.b.healPower), ONE + t.b.shieldTaken));
    t.shieldUntil = this.tick + R.shieldTicks;
  }

  private heal(u: Unit, s: Slot, targets: Unit[]): void {
    const amount = Math.trunc((s.tech.damage * u.atk) / (100 * ONE));
    for (const t of targets) this.restore(u, t, amount);
  }

  /** Hộ thể: khiên cho đồng minh, kèm đòn ×0,2 nếu địch đứng sát. Tu thể cộng 10% khiên. */
  private guard(u: Unit, s: Slot, targets: Unit[], foe: Unit): void {
    const amount = mul(shieldAmount(u.atk, s.tech), ONE + u.b.melee);
    for (const t of targets) this.addShield(u, t, amount);
    if (Math.abs(foe.pos - u.pos) <= R.shieldHitRange) this.strike(u, s, [foe], this.takeUlt(u), 0, false);
  }

  /** Thân pháp: lướt tới sát mục tiêu, đòn đầu cộng chí mạng, rồi lộ vị trí. */
  private dash(u: Unit, s: Slot, t: Unit): void {
    u.pos = clamp(t.pos + (u.pos < t.pos ? -R.dashStandOff : R.dashStandOff), 0, BATTLE.fieldLength);
    this.strike(u, s, [t], this.takeUlt(u), R.dashCritBonus, false);
    u.exposedUntil = this.tick + R.exposedTicks;
  }
}

export function simulate(input: BattleInput): BattleResult {
  const b = new Battle(input);
  while (!b.finished) b.step();
  return b.result();
}

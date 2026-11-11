// Logic bãi quái mẫu, đánh tay thời gian thực (người dùng chốt 2026-11-09): người chơi chạm đất để đi, chạm quái để tới gần
// và đánh thường, bấm chiêu trên thanh chiêu; quái đi theo bầy quanh tổ, bị đánh thì cả bầy đuổi, chết thì hồi sinh; bot là
// người chơi khác giả lập. Không vẽ gì ở đây (baiScene.ts vẽ), để test được bằng node.
// Mana và chiêu dùng lại của sim: BATTLE.manaMax, manaRegenPerSec, SKILL_SPECS (Mana, hồi chiêu, tầm, bán kính, hệ số).
import { BATTLE, SKILL_SPECS, TICKS_PER_SECOND, type SkillType } from "@htk/sim";
import type { ElementId } from "../../replay/types.ts";
import { BAI, ultPoints } from "./thamSo.ts";

export type Kind = "player" | "bot" | "monster";

export interface Actor {
  id: number;
  kind: Kind;
  name: string;
  element: ElementId;
  x: number;
  y: number;
  /** 1 nhìn phải, -1 nhìn trái */
  face: 1 | -1;
  hp: number;
  hpMax: number;
  atk: number;
  shield: number;
  shieldUntil: number;
  /** Điểm đang đi tới: chỗ người chơi chạm, hay chỗ quái lang thang */
  goal: { x: number; y: number } | null;
  /** Đối thủ đang đánh hay đuổi */
  target: number | null;
  nextHit: number;
  alive: boolean;
  respawnAt: number;
  /** Tổ của quái, cửa bãi của người */
  home: { x: number; y: number };
  /** Bầy của quái (-1 với người) */
  pack: number;
  /** Lúc ra đòn gần nhất và lúc trúng đòn gần nhất (để màn chọn hoạt ảnh) */
  actAt: number;
  hurtAt: number;
  /** Thủ lĩnh của khu (màn vẽ to hơn) */
  boss?: boolean;
}

/** Tuỳ chọn cho thế giới liền mạch (scenes/mmo): cỡ khu, dải đi được, cấp quái, chỉ số người chơi. Bỏ trống là bãi mẫu. */
export interface BaiOpts {
  w?: number;
  h?: number;
  /** y nhỏ nhất đi được (phần trên của nền 3/4 là tường, cây) */
  top?: number;
  monsterLevel?: number;
  hp?: number;
  atk?: number;
  packs?: number;
  boss?: boolean;
  entry?: { x: number; y: number };
  bots?: string[];
  elements?: ElementId[];
  /** Tổ của từng bầy (map tự thiết kế); có thì số bầy theo đây */
  homes?: { x: number; y: number }[];
  /** Vùng không đi vào được */
  blocked?: { x: number; y: number; w: number; h: number }[];
  /** Boss của khu: mỗi chỗ một con đứng một mình, mạnh theo BAI.bossHp/bossAtk, hồi sinh chậm */
  bosses?: { x: number; y: number; ten?: string }[];
}

/** Sự kiện để màn vẽ: số sát thương, hồi máu, chiêu, chiêu cuối. */
export interface Fx {
  t: number;
  x: number;
  y: number;
  el: ElementId;
  kind: "hit" | "heal" | "skill" | "ult";
  amount?: number;
  r?: number;
  /** Chiêu vừa tung (kind skill) */
  skill?: SkillType;
  /** Đòn có người chơi tham gia (đánh hoặc bị đánh), để màn chỉ vẽ hiệu ứng cho những đòn này */
  me?: boolean;
  /** Hướng đòn: 1 từ trái sang, -1 từ phải sang */
  dir?: 1 | -1;
}

const PACK_ELEMENTS: ElementId[] = ["moc", "kim", "thuy", "hoa"];
const FX_LIFE = 1.2;

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

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

export class Bai {
  t = 0;
  readonly actors: Actor[] = [];
  fx: Fx[] = [];
  readonly player: Actor;
  level: number;
  readonly w: number;
  readonly h: number;
  readonly top: number;
  readonly mLevel: number;
  /** Treo auto: người chơi tự tìm quái như bot */
  auto = false;
  onKill?: (m: Actor) => void;
  private o: BaiOpts;
  tuVi = 0;
  kills = 0;
  mana: number = BATTLE.manaMax;
  manaMax: number = BATTLE.manaMax;
  /** Chỉ số cộng của riêng người chơi, phần nghìn: thủ, chí mạng, sát thương chí mạng, giảm mana, tốc đánh, giảm hồi chiêu */
  mod = { def: 0, crit: 0, critDmg: 0, manaCut: 0, speed: 0, cd: 0 };
  /** Mức cộng theo tầng của một chiêu, phần nghìn (layerBonus của @htk/rules) */
  skillBonus: (skill: SkillType) => { uyLuc: number; hoiChieu: number; mana: number } = () => ({ uyLuc: 0, hoiChieu: 0, mana: 0 });
  /** Thanh nội tại chiêu cuối, 0 tới 1 */
  ult = 0;
  /** Lúc hết hồi chiêu của từng chiêu */
  readonly ready = new Map<SkillType, number>();
  private rnd: () => number;

  constructor(level = 1, element: ElementId = "moc", seed = 1, o: BaiOpts = {}) {
    this.level = level;
    this.o = o;
    this.w = o.w ?? BAI.w;
    this.h = o.h ?? BAI.h;
    this.top = o.top ?? 0;
    this.mLevel = o.monsterLevel ?? BAI.level;
    const els = o.elements ?? PACK_ELEMENTS;
    const packs = o.boss ? 1 : (o.homes?.length ?? o.packs ?? BAI.packs);
    const cols = Math.ceil(Math.sqrt((packs * this.w) / (this.h - this.top)));
    this.rnd = rng(seed);
    this.player = this.human(1, "player", "Ta", element, 0);
    (o.bots ?? BAI.bots).forEach((name, i) => this.human(100 + i, "bot", name, PACK_ELEMENTS[i % PACK_ELEMENTS.length], i + 1));
    for (let p = 0; p < packs; p++) {
      // Tới 4 bầy: chỗ của bãi mẫu. Nhiều hơn (khu rộng): rải theo lưới ô gần vuông khắp khu.
      const home = o.homes?.[p]
        ? { ...o.homes[p] }
        : o.boss
        ? { x: this.w * 0.7, y: (this.top + this.h) / 2 }
        : packs <= 4
          ? { x: this.w * (0.45 + 0.4 * (p % 2)), y: this.top + (this.h - this.top) * (0.25 + 0.5 * Math.floor(p / 2)) }
          : { x: (this.w * ((p % cols) + 0.5)) / cols, y: this.top + ((this.h - this.top) * (Math.floor(p / cols) + 0.5)) / Math.ceil(packs / cols) };
      this.spawnPack(home, p, els[p % els.length], o.boss ? 15 : 1, o.boss ? 2.5 : 1, o.boss ? 1 : BAI.perPack, o.boss, "Dị thú");
    }
    (o.bosses ?? []).forEach((b, i) => this.spawnPack({ x: b.x, y: b.y }, packs + i, els[i % els.length], BAI.bossHp, BAI.bossAtk, 1, true, b.ten ?? "Thủ lĩnh"));
  }

  private spawnPack(home: { x: number; y: number }, p: number, element: ElementId, kHp: number, kAtk: number, n: number, boss: boolean | undefined, name: string): void {
    {
      for (let k = 0; k < n; k++) {
        const hp = BAI.monsterHp(this.mLevel) * kHp;
        this.actors.push({
          id: 1000 + p * 100 + k, kind: "monster", name, element, boss,
          x: home.x + (this.rnd() - 0.5) * BAI.roam, y: home.y + (this.rnd() - 0.5) * BAI.roam, face: -1,
          hp, hpMax: hp, atk: BAI.monsterAtk(this.mLevel) * kAtk, shield: 0, shieldUntil: 0, goal: null, target: null, nextHit: 0,
          alive: true, respawnAt: 0, home, pack: p, actAt: -9, hurtAt: -9,
        });
      }
    }
  }

  private human(id: number, kind: Kind, name: string, element: ElementId, i: number): Actor {
    // Người chơi đứng giữa cửa bãi, bot xếp vòng quanh để không dồn thành một cột.
    const e = this.o.entry ?? BAI.entry;
    const home = { x: e.x + (i ? Math.cos(i * 0.9) * 70 : 0), y: e.y + (i ? Math.sin(i * 0.9) * 110 : 0) };
    const hp = this.o.hp ?? BAI.hp;
    const a: Actor = {
      id, kind, name, element, x: home.x, y: home.y, face: 1, hp, hpMax: hp, atk: this.o.atk ?? BAI.atk, shield: 0,
      shieldUntil: 0, goal: null, target: null, nextHit: 0, alive: true, respawnAt: 0, home, pack: -1, actAt: -9, hurtAt: -9,
    };
    this.actors.push(a);
    return a;
  }

  get(id: number | null): Actor | undefined {
    return id === null ? undefined : this.actors.find((a) => a.id === id);
  }

  /** Chạm đất: đi tới đó, bỏ mục tiêu đang đánh. */
  moveTo(x: number, y: number): void {
    this.player.goal = { x: Math.max(0, Math.min(this.w, x)), y: Math.max(this.top, Math.min(this.h, y)) };
    this.player.target = null;
  }

  /** Chạm quái: tới gần rồi đánh thường. */
  attack(id: number): void {
    const m = this.get(id);
    if (!m || !m.alive || m.kind !== "monster") return;
    this.player.target = id;
    this.player.goal = null;
  }

  manaCost(skill: SkillType): number {
    return Math.round((SKILL_SPECS[skill].mana * Math.max(0, 1000 - this.skillBonus(skill).mana - this.mod.manaCut)) / 1000);
  }

  /** Giây hồi chiêu đầy đủ của một chiêu, đã tính tầng và chỉ số giảm hồi chiêu. */
  cooldownOf(skill: SkillType): number {
    return (SKILL_SPECS[skill].cooldownTicks / TICKS_PER_SECOND) * Math.max(0.2, (1000 - this.skillBonus(skill).hoiChieu - this.mod.cd) / 1000);
  }

  /** Giây hồi chiêu còn lại (0 là dùng được). */
  cooldown(skill: SkillType): number {
    return Math.max(0, (this.ready.get(skill) ?? 0) - this.t);
  }

  /** Ra chiêu trên thanh chiêu; false khi đang hồi, thiếu Mana, hay không có quái trong tầm. */
  cast(skill: SkillType): boolean {
    const spec = SKILL_SPECS[skill];
    const p = this.player;
    const cost = this.manaCost(skill);
    const pow = (1000 + this.skillBonus(skill).uyLuc) / 1000;
    if (!p.alive || this.cooldown(skill) > 0 || this.mana < cost) return false;
    if (skill === "hoi_phuc" || skill === "ho_the") {
      if (skill === "hoi_phuc") this.heal(p, p.hpMax * BAI.healPct * pow);
      else {
        p.shield = p.hpMax * BAI.shieldPct * pow;
        p.shieldUntil = this.t + BAI.shieldSec;
      }
      this.fx.push({ t: this.t, x: p.x, y: p.y, el: p.element, kind: "skill", r: 50, skill });
    } else {
      const range = (spec.range / 1000) * BAI.cell + BAI.meleeRange;
      const main = this.get(p.target) ?? this.nearestMonster(p, range);
      if (!main?.alive || dist(p, main) > range) return false;
      const radius = spec.radius > 0 ? (spec.radius / 1000) * BAI.cell : BAI.cell;
      const hit = this.actors
        .filter((a) => a.kind === "monster" && a.alive && dist(a, main) <= radius)
        .sort((a, b) => dist(a, main) - dist(b, main))
        .slice(0, spec.targets);
      for (const m of hit) this.damage(p, m, ((p.atk * spec.k * BAI.skillScale) / 1000) * pow);
      p.target = main.id;
      p.face = main.x >= p.x ? 1 : -1;
      this.fx.push({ t: this.t, x: main.x, y: main.y, el: p.element, kind: "skill", r: radius, skill, dir: main.x >= p.x ? 1 : -1 });
    }
    this.mana -= cost;
    this.ready.set(skill, this.t + this.cooldownOf(skill));
    p.actAt = this.t;
    return true;
  }

  /** Chiêu cuối: cần đủ cấp và thanh nội tại đầy; đánh mọi quái quanh người chơi. */
  castUlt(): boolean {
    const points = ultPoints(this.level);
    const p = this.player;
    if (points === 0 || this.ult < 1 || !p.alive) return false;
    const dmg = ((p.atk * BAI.ultK) / 1000) * (1 + BAI.ultPerPoint * (points - 1));
    for (const m of this.actors) if (m.kind === "monster" && m.alive && dist(m, p) <= BAI.ultRadius) this.damage(p, m, dmg);
    this.ult = 0;
    p.actAt = this.t;
    this.fx.push({ t: this.t, x: p.x, y: p.y, el: p.element, kind: "ult", r: BAI.ultRadius });
    return true;
  }

  step(dt: number): void {
    this.t += dt;
    this.mana = Math.min(this.manaMax, this.mana + BATTLE.manaRegenPerSec * dt);
    for (const a of this.actors) {
      if (!a.alive) {
        if (this.t >= a.respawnAt) this.revive(a);
        continue;
      }
      if (a.shield > 0 && this.t >= a.shieldUntil) a.shield = 0;
      if (a.kind === "monster") this.monster(a, dt);
      else this.fighter(a, dt);
    }
    this.fx = this.fx.filter((f) => this.t - f.t < FX_LIFE);
  }

  private revive(a: Actor): void {
    a.alive = true;
    a.hp = a.hpMax;
    a.x = a.home.x;
    a.y = a.home.y;
    a.target = null;
    a.goal = null;
  }

  private nearestMonster(from: Actor, within: number): Actor | undefined {
    let best: Actor | undefined;
    for (const a of this.actors) {
      if (a.kind !== "monster" || !a.alive) continue;
      const d = dist(from, a);
      if (d <= within && (!best || d < dist(from, best))) best = a;
    }
    return best;
  }

  private inBlocked(x: number, y: number): boolean {
    return !!this.o.blocked?.some((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
  }

  /** Đi về phía (x, y); true khi đã tới. */
  private walk(a: Actor, x: number, y: number, speed: number, dt: number): boolean {
    const d = Math.hypot(x - a.x, y - a.y);
    if (d < 2) return true;
    const s = Math.min(d, speed * dt);
    const nx = Math.max(0, Math.min(this.w, a.x + ((x - a.x) / d) * s));
    const ny = Math.max(this.top, Math.min(this.h, a.y + ((y - a.y) / d) * s));
    // Đích nằm ngoài dải đi được (quái lang thang sát mép): coi như đã tới, khỏi giậm chân mãi.
    if (nx === a.x && ny === a.y) return true;
    // shortcut: gặp vùng cấm thì đứng lại, không trượt dọc mép hay tìm đường vòng; cần thì thêm A* (scenes/world/walkGrid.ts).
    if (!this.inBlocked(a.x, a.y) && this.inBlocked(nx, ny)) return true;
    a.x = nx;
    a.y = ny;
    if (Math.abs(x - a.x) > 1) a.face = x > a.x ? 1 : -1;
    return false;
  }

  /** Người chơi và bot: đi tới đích, hay tới gần mục tiêu rồi đánh thường. Bot tự tìm quái gần nhất. */
  private fighter(a: Actor, dt: number): void {
    let tgt = this.get(a.target);
    if (tgt && !tgt.alive) {
      a.target = null;
      tgt = undefined;
    }
    if (!tgt && (a.kind === "bot" || (this.auto && a === this.player)) && !a.goal) {
      tgt = this.nearestMonster(a, 520);
      if (tgt) a.target = tgt.id;
      else a.goal = { x: this.w * (0.2 + 0.6 * this.rnd()), y: this.top + (this.h - this.top) * this.rnd() };
    }
    if (tgt) {
      if (dist(a, tgt) > BAI.meleeRange) this.walk(a, tgt.x, tgt.y, BAI.speed, dt);
      else if (this.t >= a.nextHit) {
        a.face = tgt.x >= a.x ? 1 : -1;
        this.damage(a, tgt, a.atk);
        a.nextHit = this.t + BAI.hitEvery * (a === this.player ? 1000 / (1000 + this.mod.speed) : 1);
        a.actAt = this.t;
      }
    } else if (a.goal && this.walk(a, a.goal.x, a.goal.y, BAI.speed, dt)) a.goal = null;
  }

  /** Quái: lang thang quanh tổ; có mục tiêu thì đuổi và đánh; chạy quá xa tổ thì bỏ đuổi, về tổ hồi đầy máu. */
  private monster(m: Actor, dt: number): void {
    const tgt = this.get(m.target);
    if (tgt && (!tgt.alive || dist(m, m.home) > BAI.leash)) {
      m.target = null;
      m.goal = { ...m.home };
      m.hp = m.hpMax;
    } else if (tgt) {
      if (dist(m, tgt) > BAI.meleeRange * 0.8) this.walk(m, tgt.x, tgt.y, BAI.monsterChase, dt);
      else if (this.t >= m.nextHit) {
        m.face = tgt.x >= m.x ? 1 : -1;
        this.damage(m, tgt, m.atk);
        m.nextHit = this.t + BAI.monsterHitEvery;
        m.actAt = this.t;
      }
      return;
    }
    if (m.goal) {
      if (this.walk(m, m.goal.x, m.goal.y, BAI.monsterWalk, dt)) m.goal = null;
    } else if (this.rnd() < dt * 0.4) {
      m.goal = { x: m.home.x + (this.rnd() - 0.5) * 2 * BAI.roam, y: m.home.y + (this.rnd() - 0.5) * 2 * BAI.roam };
    }
  }

  private heal(a: Actor, amount: number): void {
    const v = Math.round(Math.min(amount, a.hpMax - a.hp));
    a.hp += v;
    this.fx.push({ t: this.t, x: a.x, y: a.y, el: a.element, kind: "heal", amount: v });
  }

  private damage(from: Actor, to: Actor, raw: number): void {
    let amount = raw;
    // Chưa cộng điểm thì crit = 0, không rút số ngẫu nhiên: trận cũ giữ nguyên kết quả.
    if (from === this.player && this.mod.crit > 0 && this.rnd() < this.mod.crit / 1000) amount *= 1.5 + this.mod.critDmg / 1000;
    if (to === this.player) amount = (amount * 1000) / (1000 + this.mod.def);
    amount = Math.round(amount);
    const blocked = Math.min(to.shield, amount);
    to.shield -= blocked;
    amount -= blocked;
    to.hp -= amount;
    to.hurtAt = this.t;
    this.fx.push({ t: this.t, x: to.x, y: to.y, el: from.element, kind: "hit", amount: amount + blocked, me: from === this.player || to === this.player, dir: to.x >= from.x ? 1 : -1 });
    if (from === this.player) this.ult = Math.min(1, this.ult + (amount + blocked) / BAI.ultFill);
    // Quái bị đánh thì cả bầy quay sang đuổi người đánh.
    if (to.kind === "monster" && from.kind !== "monster") {
      for (const m of this.actors) if (m.pack === to.pack && m.alive && m.target === null) m.target = from.id;
    }
    if (to.hp > 0) return;
    to.hp = 0;
    to.alive = false;
    to.shield = 0;
    to.respawnAt = this.t + (to.kind !== "monster" ? BAI.revive : to.boss ? BAI.bossRespawn : BAI.respawn);
    if (to.kind === "monster" && from === this.player) {
      this.tuVi += BAI.tuVi(this.mLevel) * (to.boss ? BAI.bossTuVi : 1);
      this.kills++;
      this.onKill?.(to);
    }
  }
}

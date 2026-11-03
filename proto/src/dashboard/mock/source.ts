// Nguồn đọc gộp chạy ngay trong trang (chưa có server giả). Mỗi lệnh đọc dựng đủ các thẻ của một màn từ World,
// kèm mốc giờ server; lệnh ghi đi qua apply() của @ktlp/rules khi luật đã có, phần còn lại sửa World trực tiếp.
import {
  apply, GRADE_NAMES, loadoutTechniques, RULES, scrollKind, techniqueOf, transmissionSlots,
  type Command, type LearnedTechnique, type Role, type SectTechnique,
} from "@ktlp/rules";
import {
  BASE_CRIT_PER_MILLE, baseStats, BATTLE, maxGradeAtLevel, simulate, TICKS_PER_SECOND, unitBonuses,
  type BattleInput, type Element, type Technique,
} from "@ktlp/sim";
import CAP_TONG_MON from "../../../../data/he_thong/json/cap_tong_mon.json";
import MO from "../../../../data/he_thong/json/mo.json";
import THAM_SO from "../../../../data/he_thong/json/tham_so.json";
import TAI_NANG from "../../../../data/he_thong/json/tai_nang.json";
import THU_CUOI from "../../../../data/he_thong/json/thu_cuoi.json";
import THU_PHAM from "../../../../data/he_thong/json/thu_pham.json";
import THU_CANH_GIOI from "../../../../data/he_thong/json/thu_canh_gioi.json";
import THU_KICH_PHAT from "../../../../data/he_thong/json/thu_kich_phat.json";
import NHIEM_VU from "../../../../data/nhiem_vu/ha_nhiem_vu.json";
import { sampleBattle } from "../../mock/sampleBattle.ts";
import { loadRegion, POINT_NAMES, stagesFrom } from "../../scenes/map/region.ts";
import type {
  BagItem, BanDoView, CommandResult, CongPhapView, DashboardCommand, DashboardSource, DongPhuView, GearItem, Go, LienMinhView,
  MiniMapView, MountView, NhanVatView, ScrollCard, StatLine, StatSource, TechniqueCard, TodoCard, TongMonView, TopBarView,
} from "../source.ts";
import { ADULT_AGE, ageOn, MINOR_DAILY_MINUTES, type AuthSource } from "../auth.ts";
import { createWorld, PLAYER, REGION, SECT, todayAt, type World } from "./world.ts";

const H = 3600_000;
const KT = THAM_SO.kinh_te;

/** Nhãn phân loại độ tuổi G1 (đề xuất, chờ chốt khi xin giấy phép). */
export const AGE_LABEL = "16+";
/** Mỏ chưa thu quá bấy nhiêu giờ thì vào Việc nên làm (GDD mục 14). */
const MINE_STALE_HOURS = 8;
/** Mỏ tích tối đa 24 giờ sản lượng (đề xuất). */
const MINE_CAP_HOURS = 24;
/** Đồ có độ bền dưới mức này thì vào Việc nên làm (GDD mục 14). */
const LOW_DURABILITY = 20;
/** Cống hiến khi hiến tế: 1 mỗi 10 linh thạch (đề xuất). */
const DONATE_CONTRIBUTION_DIV = 10;
/** Phí duy trì mỗi tiểu Truyền Tống Trận mỗi ngày (sheet Tham số). */
const MINI_PORTAL_UPKEEP = KT.miniPortalUpkeep;
/** Trận pháp sư dựng hộ trận sơn môn của tông mẫu: số người, tổng cấp. */
const WARD = { casters: 4, totalLevel: 152 };
/** Lực chiến (đề xuất cho proto): máu / 10 + công lực × 4 + phòng thủ × 3, công pháp D × số mục tiêu × 4. */
const POWER = { hp: 0.1, atk: 4, def: 3, tech: 4 };
/** Trần phần đồ và phần thú trong lực chiến (GDD mục 13 và 6). */
const GEAR_CAP = 0.35;
const MOUNT_CAP = 0.15;
/** Mỗi thú cộng statBonus / 5 % máu, công, phòng gốc (đề xuất cho proto). */
const MOUNT_STAT_DIV = 5;
/** Túi gốc 50 ô (GDD mục 12, đề xuất). */
const BAG_CAPACITY = 50;
/** Bế quan ở Hạ vị: mỗi giờ được 1/8 kinh nghiệm của cấp đang tu (đề xuất); linh tuyền tông giữ cộng 20% (đề xuất). */
const RETREAT_HOURS_PER_LEVEL = 8;
const SPRING_BONUS = 0.2;
/** Linh khí vị diện nhân thẳng vào tốc độ tu luyện (GDD mục 7). */
const LINH_KHI_HA = 1;
/** Uid ảo cho công pháp đã học khi hiện trong túi (không chiếm ô). */
const LEARNED_UID = 1_000_000;

/** Món trang bị đem vào túi, kèm phẩm lọc theo cấp đồ. */
function gearBagItem(uid: number, g: GearItem): BagItem {
  return {
    uid, kind: "trang_bi", name: g.name, grade: g.tier === "linh" ? "ha" : g.tier === "thien" ? "trung" : "cao",
    gradeLabel: { linh: "Linh", thien: "Thiên", than: "Thần" }[g.tier], count: 1, icon: g.icon, art: g.art, rarity: g.rarity, code: g.code, detail: "Đồ đã tháo.", gear: g,
  };
}

/** Thứ tự hệ trong mã vật phẩm của danh sách icon vẽ (TQ-HE-xxx, CP-HE-xxx; assets/icon_ve/danh_sach.json). */
const ICON_ELEMENTS: Element[] = ["kim", "moc", "thuy", "hoa", "tho", "loi", "phong", "quang", "am_lanh", "cuc_duong", "cuc_am", "cuc_han"];
const elementCode = (prefix: string, e: Element) => `${prefix}-HE-${String(ICON_ELEMENTS.indexOf(e) + 1).padStart(3, "0")}`;

/** Phẩm lọc của tàn quyển và công pháp: Phàm, Hoàng là hạ; Huyền là trung; từ Địa trở lên là cao (đề xuất). */
function techGrade(grade: number): BagItem["grade"] {
  return grade <= 2 ? "ha" : grade === 3 ? "trung" : "cao";
}

const ROLE_ORDER: Role[] = ["tong_chu", "pho_tong_chu", "truong_lao", "noi_mon", "ngoai_mon"];
const atLeast = (role: Role | null, min: Role): boolean => role !== null && ROLE_ORDER.indexOf(role) <= ROLE_ORDER.indexOf(min);

const TERRAIN_NAMES: Record<string, string> = {
  son_hiem: "Sơn hiểm", thuy_trach: "Thủy trạch", thuong_lo: "Thương lộ", co_tich: "Cổ tích", linh_mach: "Linh mạch", hoa_mach: "Hỏa mạch",
};

/** Cảnh giới Hạ vị theo cấp (GDD mục 7). */
export function realmOf(level: number): string {
  return level <= 50 ? "Luyện Khí" : level <= 100 ? "Trúc Cơ" : level <= 150 ? "Kết Đan" : level <= 200 ? "Nguyên Anh" : "Hóa Thần";
}

/** Kinh nghiệm lên cấp kế: E(L) = 320 × q(L) × (0,4 + 0,002 L) × p(L) (tab Nhiệm vụ của GDD, khoá `exp` của ha_nhiem_vu.json). */
export function expToNext(level: number): number {
  const c = NHIEM_VU.exp.curve;
  const q = NHIEM_VU.exp.q.base + NHIEM_VU.exp.q.perLevel * level;
  const days = (c.daysBasePermille + c.daysPerLevelPermille * level) / 1000;
  const p = level < c.earlyUntilLevel ? (c.earlyFloorPermille + ((1000 - c.earlyFloorPermille) * (level - 1)) / (c.earlyUntilLevel - 1)) / 1000 : 1;
  return Math.round((c.dailyQ * q * days * p) / c.roundTo) * c.roundTo;
}

export function minePerHour(level: number): number {
  return level > 0 ? MO[level - 1].perHour : 0;
}

function sectRow(level: number) {
  return CAP_TONG_MON[Math.max(0, Math.min(CAP_TONG_MON.length - 1, level - 1))];
}

function techCard(t: Pick<SectTechnique, "name" | "main" | "subs" | "grade"> & { id: number }, extra: Partial<TechniqueCard> = {}): TechniqueCard {
  const tech: Technique = techniqueOf(t);
  const cd = tech.cooldownTicks / TICKS_PER_SECOND;
  return {
    id: t.id,
    name: t.name,
    grade: t.grade,
    gradeName: GRADE_NAMES[t.grade - 1],
    element: tech.element,
    subElements: tech.subElements,
    type: tech.type,
    summary: `D ${Math.round(tech.damage / 1000)} · ${tech.targets} mục tiêu · hồi ${cd.toLocaleString("vi-VN")} s · ${tech.manaCost} mana`,
    ...extra,
  };
}

function scrollCard(s: { uid: number; kind: string; grade: number }): ScrollCard {
  const k = scrollKind(s.kind);
  return {
    uid: s.uid,
    kind: s.kind,
    name: k.name,
    element: k.element,
    type: k.type,
    grade: s.grade,
    gradeName: GRADE_NAMES[s.grade - 1],
    contribution: RULES.contributionPerScroll[s.grade - 1],
  };
}

function learnedCard(l: LearnedTechnique): TechniqueCard {
  return techCard({ ...l, id: l.techniqueId }, { layer: l.layer, frozen: l.frozen });
}

export class MockDashboardSource implements DashboardSource {
  private w: World;
  private auth?: AuthSource;

  private constructor(w: World, auth?: AuthSource) {
    this.w = w;
    this.auth = auth;
  }

  static async create(now = Date.now(), auth?: AuthSource): Promise<MockDashboardSource> {
    return new MockDashboardSource(createWorld(await loadRegion(REGION), now), auth);
  }

  /** Giờ server giả: cùng đồng hồ máy. */
  private now(): number {
    return Date.now();
  }

  private get me() {
    return this.w.rules.members[PLAYER];
  }

  private get sect() {
    return this.w.rules.sects[SECT];
  }

  private top(): TopBarView {
    const p = this.w.player;
    return {
      name: p.name,
      portrait: "nhan_vat/nam_khoe/dao_bao",
      level: this.me.level,
      realm: realmOf(this.me.level),
      linhThach: p.linhThach,
      tienNgoc: p.tienNgoc,
      satNghiep: p.satNghiep,
      playMinutesLeft: this.minorMinutesLeft(),
      ageLabel: AGE_LABEL,
    };
  }

  /** Người dưới 18 tuổi thấy thời gian chơi còn lại trong ngày (GDD mục 14, G1). */
  private minorMinutesLeft(): number | undefined {
    const session = this.auth?.session();
    if (!session || ageOn(session.birthDate) >= ADULT_AGE) return undefined;
    return Math.max(0, MINOR_DAILY_MINUTES - this.auth!.playedMinutesToday());
  }

  private miniMap(focus?: number[]): MiniMapView {
    const w = this.w;
    const now = this.now();
    const marks: MiniMapView["marks"] = w.held.map((h) => ({ pointId: h.pointId, owner: "minh", attacked: !!h.attacked && h.attacked.endsAt > now }));
    for (const s of w.sects) {
      for (const id of [s.sonMon, ...s.points]) marks.push({ pointId: id, owner: s.ally && w.alliance.joined ? "dong_minh" : "dich" });
    }
    // Sương mù: mở quanh lãnh thổ của mình và đồng minh, trong 2 chặng (đề xuất).
    const revealed = new Set<number>();
    const near = new Map<number, number[]>();
    for (const e of w.region.edges) {
      if (!near.has(e.a)) near.set(e.a, []);
      if (!near.has(e.b)) near.set(e.b, []);
      near.get(e.a)!.push(e.b);
      near.get(e.b)!.push(e.a);
    }
    const thanhChu = w.region.points.find((p) => p.type === "thanh_chu")!.id;
    let frontier = [w.sonMon, thanhChu, ...w.held.map((h) => h.pointId), ...(w.alliance.joined ? w.sects.filter((s) => s.ally).flatMap((s) => [s.sonMon, ...s.points]) : [])];
    frontier.forEach((id) => revealed.add(id));
    for (let step = 0; step < 2; step++) {
      const next: number[] = [];
      for (const id of frontier) for (const n of near.get(id) ?? []) if (!revealed.has(n)) (revealed.add(n), next.push(n));
      frontier = next;
    }
    const t = w.travel;
    const progress = Math.max(0, Math.min(1, (now - t.startsAt) / (t.endsAt - t.startsAt)));
    const openGates = this.calendarOpen(now) ? w.region.points.filter((p) => p.type === "cua_bi_canh" && revealed.has(p.id)).map((p) => p.id) : [];
    // Sự kiện đang diễn ra: chiến tranh 21:00–22:00 (điểm của mình và của tông địch), Yêu Triều (hang dị thú sát rìa ngoài).
    const alerts: MiniMapView["alerts"] = [];
    for (const war of w.wars) {
      if (now < war.startsAt || now >= war.startsAt + H) continue;
      const foe = w.sects.find((s) => s.name === war.with);
      alerts.push({
        kind: "chien_tranh", title: `Chiến tranh với ${war.with}`, endsAt: war.startsAt + H,
        points: [w.sonMon, ...w.held.map((h) => h.pointId), ...(foe ? [foe.sonMon, ...foe.points] : [])],
      });
    }
    for (const tide of w.tides) {
      if (now < tide.startsAt || now >= tide.endsAt) continue;
      alerts.push({ kind: "yeu_trieu", title: tide.title, endsAt: tide.endsAt, points: w.region.points.filter((p) => p.type === "hang_di_thu" && p.ring < tide.maxRing).map((p) => p.id) });
    }
    return { region: REGION, marks, sonMon: w.sonMon, self: { from: t.from, to: t.to, progress }, openGates, revealed: [...revealed], focus, alerts };
  }

  /** Bí cảnh mở 12:00 và 20:00, mỗi lần 30 phút (sheet Tham số: opensPerDay, openMinutes). */
  private calendarOpen(now: number): boolean {
    const mins = THAM_SO.roi_do.openMinutes;
    return [12, 20].some((h) => now >= todayAt(now, h) && now < todayAt(now, h) + mins * 60_000);
  }

  private todo(now: number): TodoCard[] {
    const w = this.w;
    const cards: TodoCard[] = [];
    const hit = w.held.find((h) => h.attacked && h.attacked.endsAt > now);
    if (hit) {
      cards.push({
        id: "bi_danh",
        title: `${POINT_NAMES[hit.type]} đang bị đánh`,
        detail: `${hit.attacked!.by} phá trận, còn {cd:${hit.attacked!.endsAt}}`,
        go: { screen: "ban-do", pointId: hit.pointId },
      });
    }
    const stale = w.held.filter((h) => h.level > 0 && now - h.uncollectedSince > MINE_STALE_HOURS * H);
    if (stale.length) {
      const hours = Math.floor((now - Math.min(...stale.map((h) => h.uncollectedSince))) / H);
      cards.push({ id: "thu_mo", title: "Mỏ chờ thu", detail: `${stale.length} mỏ chưa thu ${hours} giờ`, go: { screen: "tong-mon", tab: "tong-quan" } });
    }
    if (this.me.loadout.length < RULES.loadoutSize) {
      cards.push({ id: "o_trong", title: "Ô công pháp còn trống", detail: `Đang mang ${this.me.loadout.length}/${RULES.loadoutSize}`, go: { screen: "cong-phap", section: "mang" } });
    }
    const worn = Object.values(w.player.gear).find((g) => g && g.durability < LOW_DURABILITY);
    if (worn) cards.push({ id: "do_hong", title: "Đồ sắp hỏng", detail: `${worn.name} còn ${worn.durability}/${worn.durabilityMax}`, go: { screen: "nhan-vat", tab: "phap-tuong" } });
    if (w.applicants.length && atLeast(this.me.role, "truong_lao")) {
      cards.push({ id: "don", title: "Đơn xin vào", detail: `${w.applicants.length} đơn chờ duyệt`, go: { screen: "tong-mon", tab: "thanh-vien" } });
    }
    const q = this.currentQuest();
    if (q) cards.push({ id: "nhiem_vu", title: q.name, detail: q.step, go: q.go });
    return cards.slice(0, 3);
  }

  private currentQuest(): { id: string; name: string; step: string; go: Go } | undefined {
    const level = this.me.level;
    const main = NHIEM_VU.quests.filter((q) => q.kind === "chinh" && q.minLevel <= level);
    const q = main[main.length - 1];
    if (!q) return undefined;
    const step = q.steps[0] as { do: string; target?: { type?: unknown } };
    const verbs: Record<string, string> = {
      tam_dao: "Vượt ải Tầm Đạo ở thành chủ", den: "Đến", thang: "Thắng trận", tu_luyen: "Tu luyện ở linh tuyền", dot_pha: "Đột phá cảnh giới",
    };
    return { id: q.id, name: `Nhiệm vụ chính: ${q.name}`, step: verbs[step.do] ?? step.do, go: { screen: "ban-do" } };
  }

  async dongPhu(): Promise<DongPhuView> {
    const w = this.w;
    const now = this.now();
    const thanhChu = w.region.points.find((p) => p.type === "thanh_chu")!;
    const t = w.travel;
    const running = [
      ...(t.endsAt > now - 30 * 60_000
        ? [{
            kind: "hanh_trinh" as const,
            title: "Hành trình về sơn môn",
            detail: `Từ thành chủ, ${Math.max(0, 3 - Math.floor(((now - t.startsAt) / (t.endsAt - t.startsAt)) * 3))}/3 chặng còn lại`,
            endsAt: t.endsAt,
            go: { screen: "ban-do", pointId: t.to } as Go,
          }]
        : []),
      ...w.jobs.map((j) => ({
        kind: j.kind,
        title: j.title,
        detail: j.detail,
        endsAt: j.endsAt,
        go: (j.kind === "xay" ? { screen: "tong-mon", tab: "son-mon" } : j.kind === "be_quan" ? { screen: "cong-phap", section: "mang" } : { screen: "nhan-vat", tab: "phap-tuong" }) as Go,
      })),
    ];
    const mins = THAM_SO.roi_do.openMinutes * 60_000;
    const calendar: DongPhuView["calendar"] = [
      { title: "Bí cảnh", startsAt: todayAt(now, 12), endsAt: todayAt(now, 12) + mins, go: { screen: "ban-do" } },
      { title: "Bí cảnh", startsAt: todayAt(now, 20), endsAt: todayAt(now, 20) + mins, go: { screen: "ban-do" } },
    ];
    for (const war of w.wars) {
      if (new Date(war.startsAt).toDateString() === new Date(now).toDateString()) {
        calendar.push({ title: `Chiến tranh với ${war.with}`, startsAt: war.startsAt, endsAt: war.startsAt + H, go: { screen: "tong-mon", tab: "chien-su" } });
      }
    }
    // Boss liên minh thứ Sáu – Chủ Nhật (GDD mục 14, hình bố cục Liên minh); giờ mở là đề xuất.
    const dow = new Date(now).getDay();
    if (w.alliance.joined && (dow === 5 || dow === 6 || dow === 0)) {
      calendar.push({ title: "Boss liên minh", startsAt: todayAt(now, 19), endsAt: todayAt(now, 19) + H, go: { screen: "lien-minh" } });
    }
    calendar.sort((a, b) => a.startsAt - b.startsAt);
    const q = this.currentQuest();
    return {
      serverNow: now,
      top: this.top(),
      running,
      calendar,
      todo: this.todo(now),
      reports: w.reports.map((r) => {
        const res = simulate(sampleBattle(r.seed)).winner;
        return {
          id: r.id,
          title: r.title,
          result: res === "A" ? "thang" : res === "B" ? "thua" : "hoa",
          at: r.at,
          detail: "10 đấu 10",
        };
      }),
      mail: w.mail.map(({ id, from, title, unread }) => ({ id, from, title, unread })),
      quests: q ? [{ id: q.id, name: q.name.replace("Nhiệm vụ chính: ", ""), step: q.step, go: q.go }] : [],
      miniMap: this.miniMap(),
      city: { name: `Thành chủ ${w.region.region.name}`, pointId: thanhChu.id, facilities: ["Chợ", "Sàn Linh Ngọc", "Kho cá nhân", "Lò rèn", "Nhiệm vụ NPC"] },
    };
  }

  async mail(id: number): Promise<{ from: string; title: string; body: string } | undefined> {
    const m = this.w.mail.find((x) => x.id === id);
    if (m) m.unread = false;
    return m && { from: m.from, title: m.title, body: m.body };
  }

  /** Chiến báo mẫu dùng đội hình mẫu của màn Trận (mock/sampleBattle.ts) với seed riêng. */
  async battle(id: number): Promise<{ label: string; input: BattleInput; arena?: string } | undefined> {
    const r = this.w.reports.find((x) => x.id === id);
    return r && { label: `Chiến báo · ${r.title}`, input: sampleBattle(r.seed), arena: r.arena };
  }

  async nhanVat(): Promise<NhanVatView> {
    const w = this.w;
    const me = this.me;
    const p = w.player;
    const base = baseStats(me.level);
    const techs = loadoutTechniques(w.rules, PLAYER);
    const fromRoot = unitBonuses(p.roots, [], techs);
    const fromTalent = unitBonuses([], [p.talent], techs);

    // Đồ: chỉ số gốc × (1 + 3% mỗi nấc); độ bền 0 thì mất hết chỉ số (GDD mục 12).
    const gear = { hp: 0, atk: 0, def: 0, mana: 0 };
    for (const g of Object.values(p.gear) as GearItem[]) {
      if (!g || g.durability <= 0) continue;
      const k = 1 + 0.03 * g.plus;
      gear.hp += Math.round((g.stats.hp ?? 0) * k);
      gear.atk += Math.round((g.stats.atk ?? 0) * k);
      gear.def += Math.round((g.stats.def ?? 0) * k);
      gear.mana += Math.round((g.stats.mana ?? 0) * k);
    }
    // Ngọc: cấp k cho 0,25 × k × (k + 1)% kháng hệ đó, trùng linh căn +20% (GDD mục 12, đề xuất).
    const resist: Partial<Record<Element, number>> = {};
    for (const g of Object.values(p.gear) as GearItem[]) {
      for (const gem of g?.gems ?? []) {
        let v = 2.5 * gem.level * (gem.level + 1); // phần nghìn
        if (p.roots.includes(gem.element)) v *= 1.2;
        resist[gem.element] = (resist[gem.element] ?? 0) + v;
      }
    }
    const mounts = p.mounts.map((id) => (id ? THU_CUOI.find((t) => t.id === id) : undefined));
    const mountPct = mounts.reduce((s, m) => s + (m ? THU_PHAM[m.grade as keyof typeof THU_PHAM].statBonus / MOUNT_STAT_DIV : 0), 0) / 100;
    const mount = { hp: Math.round(base.hp * mountPct), atk: Math.round(base.atk * mountPct), def: Math.round(base.def * mountPct) };

    const pct = (v: number, perMille: number) => Math.round((v * perMille) / 1000);
    const line = (id: string, label: string, unit: StatLine["unit"], sources: StatSource[]): StatLine => ({
      id, label, unit, sources: sources.filter((s) => s.value !== 0 || s.label === "Gốc theo cấp"), value: sources.reduce((a, s) => a + s.value, 0),
    });
    const hp = line("hp", "Máu", "", [
      { label: "Gốc theo cấp", value: base.hp }, { label: "Đồ", value: gear.hp }, { label: "Thú", value: mount.hp },
      { label: "Tài năng", value: pct(base.hp, fromTalent.hp) }, { label: "Buff linh căn", value: pct(base.hp, fromRoot.hp) },
    ]);
    const atk = line("atk", "Công lực", "", [{ label: "Gốc theo cấp", value: base.atk }, { label: "Đồ", value: gear.atk }, { label: "Thú", value: mount.atk }]);
    const def = line("def", "Phòng thủ", "", [
      { label: "Gốc theo cấp", value: base.def }, { label: "Đồ", value: gear.def }, { label: "Thú", value: mount.def },
      { label: "Tài năng", value: pct(base.def, fromTalent.def) }, { label: "Buff linh căn", value: pct(base.def, fromRoot.def) },
    ]);
    const mana = line("mana", "Mana", "", [
      { label: "Gốc theo cấp", value: BATTLE.manaMax }, { label: "Đồ", value: gear.mana },
      { label: "Tài năng", value: pct(BATTLE.manaMax, fromTalent.manaMax) }, { label: "Buff linh căn", value: pct(BATTLE.manaMax, fromRoot.manaMax) },
    ]);
    const permille = (id: string, label: string, baseValue: number, key: keyof typeof fromRoot): StatLine =>
      line(id, label, "‰", [{ label: "Gốc theo cấp", value: baseValue }, { label: "Tài năng", value: fromTalent[key] }, { label: "Buff linh căn", value: fromRoot[key] }]);
    const stats: StatLine[] = [
      hp, atk, def, mana,
      permille("crit", "Chí mạng", BASE_CRIT_PER_MILLE, "critBonus"),
      permille("critDamage", "Sát thương chí mạng", BATTLE.critDamage, "critDamage"),
      permille("attackSpeed", "Tốc đánh", 0, "attackSpeed"),
      permille("cooldownCut", "Giảm hồi chiêu", 0, "cooldownCut"),
      permille("lifesteal", "Hút máu", 0, "lifesteal"),
      permille("resistPen", "Xuyên kháng", 0, "resistPen"),
      ...(Object.entries(resist) as [Element, number][]).map(([e, v]) => line(`resist_${e}`, `Kháng ${ELEMENT_LABEL[e]}`, "‰", [{ label: "Gốc theo cấp", value: 0 }, { label: "Ngọc", value: Math.round(v) }])),
      line("luck", "Luck", "", [{ label: "Gốc theo cấp", value: 0 }]),
    ];

    const power = (s: { hp: number; atk: number; def: number }) => s.hp * POWER.hp + s.atk * POWER.atk + s.def * POWER.def;
    const techPower = techs.reduce((a, t) => a + (t.damage / 1000) * t.targets * POWER.tech, 0);
    const core = power({ hp: hp.value - gear.hp - mount.hp, atk: atk.value - gear.atk - mount.atk, def: def.value - gear.def - mount.def }) + techPower;
    // Phần đồ và thú bị chặn ở trần tính trên tổng.
    let gearP = power(gear);
    let mountP = power(mount);
    gearP = Math.min(gearP, (GEAR_CAP / (1 - GEAR_CAP)) * (core + mountP));
    mountP = Math.min(mountP, (MOUNT_CAP / (1 - MOUNT_CAP)) * (core + gearP));
    const total = Math.round(core + gearP + mountP);

    const realm = THU_CANH_GIOI[0];
    const mountViews: (MountView | null)[] = mounts.map((m) =>
      m ? { id: m.id, name: m.name, element: m.element as Element, grade: THU_PHAM[m.grade as keyof typeof THU_PHAM].name, realm: realm.name, icon: m.asset } : null,
    );
    const owned = mountViews.filter((m): m is MountView => m !== null);
    const countBy = (key: (m: MountView) => string) => {
      const c: Record<string, number> = {};
      for (const m of owned) c[key(m)] = (c[key(m)] ?? 0) + 1;
      return Math.max(0, ...Object.values(c));
    };
    const els = new Set(owned.map((m) => m.element));
    const active: Record<string, boolean> = {
      dong_he: countBy((m) => m.element) >= 3 && owned.length < 5,
      thuan_he: owned.length === 5 && countBy((m) => m.element) === 5,
      goc_bien: (["kim:loi", "moc:phong", "thuy:cuc_han", "hoa:cuc_duong", "tho:cuc_am"] as const).some((pair) => pair.split(":").every((e) => els.has(e as Element))),
      doi_cuc: (els.has("cuc_duong") && els.has("cuc_am")) || (els.has("quang") && els.has("am_lanh")),
      ngu_hanh: ["kim", "moc", "thuy", "hoa", "tho"].every((e) => els.has(e as Element)),
      dong_dang: false,
      tu_tuong: false,
    };
    const talent = TAI_NANG[p.talent];
    const now = this.now();
    // Tu luyện: gốc theo cấp, nhân linh khí vị diện, cộng linh tuyền tông đang giữ.
    const perHourBase = Math.round(expToNext(me.level) / RETREAT_HOURS_PER_LEVEL);
    const spring = w.held.some((h) => h.type === "linh_tuyen") ? Math.round(perHourBase * LINH_KHI_HA * SPRING_BONUS) : 0;
    const breakLevel = Math.min(250, Math.ceil(me.level / 50) * 50);
    const retreat = w.jobs.find((j) => j.kind === "be_quan" && j.endsAt > now);
    const byId = (id: number) => me.learned.find((l) => l.techniqueId === id)!;
    const loadout: (TechniqueCard | null)[] = [];
    for (let i = 0; i < RULES.loadoutSize; i++) loadout.push(me.loadout[i] !== undefined ? learnedCard(byId(me.loadout[i])) : null);
    const learned = me.learned.map(learnedCard);
    const items: BagItem[] = [
      ...p.bag,
      ...me.bag.map((sc): BagItem => {
        const c = scrollCard(sc);
        return {
          uid: c.uid, kind: "tan_quyen", name: c.name, grade: techGrade(c.grade), gradeLabel: c.gradeName, count: 1, element: c.element,
          icon: `chieu/${c.type}`, art: `tan_quyen/${c.element}`, code: elementCode("TQ", c.element), detail: `Nộp ở Tàng Kinh Các được ${c.contribution} cống hiến.`,
        };
      }),
      ...learned
        .filter((t) => !me.loadout.includes(t.id))
        // Công pháp chưa có hình vẽ (cong_phap/<hệ> trong danh sách icon), giữ hình loại chiêu PixelLab.
        .map((t): BagItem => ({ uid: LEARNED_UID + t.id, kind: "cong_phap", name: t.name, grade: techGrade(t.grade), gradeLabel: t.gradeName, count: 1, element: t.element, icon: `chieu/${t.type}`, code: elementCode("CP", t.element), detail: t.summary, technique: t })),
    ];
    return {
      serverNow: now,
      top: this.top(),
      name: p.name,
      roots: p.roots,
      talent: { id: talent.id, name: talent.name, combat: talent.combat },
      level: me.level,
      exp: p.exp,
      expToNext: expToNext(me.level),
      sect: { name: w.sect.name, role: me.role, faction: w.sect.faction },
      satNghiep: p.satNghiep,
      contribution: me.contribution,
      cultivation: {
        perHour: perHourBase * LINH_KHI_HA + spring,
        sources: [
          { label: `Gốc: 1/${RETREAT_HOURS_PER_LEVEL} kinh nghiệm cấp mỗi giờ`, value: perHourBase },
          { label: `Linh khí Hạ vị ×${LINH_KHI_HA}`, value: perHourBase * (LINH_KHI_HA - 1) },
          { label: `Linh tuyền của tông +${SPRING_BONUS * 100}%`, value: spring },
        ],
        breakAt: { level: breakLevel, realm: realmOf(breakLevel + 1) },
        canBreak: me.level === breakLevel && p.exp >= expToNext(me.level),
        retreat: retreat && { title: retreat.title, endsAt: retreat.endsAt },
      },
      loadout,
      learned,
      bag: { capacity: BAG_CAPACITY, items },
      riding: p.riding,
      power: {
        total,
        parts: [
          { id: "co_ban", label: "Cấp, công pháp, tài năng", value: Math.round(core) },
          { id: "do", label: "Đồ", value: Math.round(gearP), cap: GEAR_CAP },
          { id: "thu", label: "Thú", value: Math.round(mountP), cap: MOUNT_CAP },
        ],
      },
      gear: p.gear,
      main: [hp, atk, def, mana],
      stats,
      mounts: mountViews,
      combos: Object.values(THU_KICH_PHAT).map((k) => ({ name: k.name, effect: `${k.condition}: ${k.effect}`, active: active[k.id] ?? false })),
      // Mũ và vũ khí trên hình đổi theo món đang mặc.
      look: { body: "nam_khoe", outfit: "dao_bao", idle: "nhan_vat/nam_khoe/dao_bao/dung", hat: p.gear.mu?.icon?.split("/").pop(), weapon: p.gear.vu_khi?.icon?.split("/").pop() },
    };
  }

  async tongMon(): Promise<TongMonView> {
    const w = this.w;
    const now = this.now();
    const sect = this.sect;
    const row = sectRow(sect.level);
    const role = this.me.role;
    const perHour = { linhThach: 0, quang: 0, duoc: 0 };
    for (const h of w.held) {
      const v = minePerHour(h.level);
      if (h.type === "mo_linh_thach") perHour.linhThach += v;
      if (h.type === "mo_quang") perHour.quang += v;
      if (h.type === "mo_duoc") perHour.duoc += v;
    }
    // Phí duy trì (GDD mục 10, đề xuất): hộ trận 10 × (máu ÷ 1.000)^1,5 mỗi ngày; máu = 50 × tổng cấp × (1 + 0,05 × (n − 1)).
    const wardHp = 50 * WARD.totalLevel * (1 + 0.05 * (WARD.casters - 1));
    const wardUpkeep = Math.round(10 * Math.pow(wardHp / 1000, 1.5));
    const portalUpkeep = row.miniPortals * MINI_PORTAL_UPKEEP;
    const upkeep = wardUpkeep + portalUpkeep;
    const sonMon = w.region.points[w.sonMon];
    const members = Object.values(w.rules.members)
      .filter((m) => m.sectId === SECT)
      .map((m) => ({ id: m.id, name: w.names[m.id] ?? m.id, role: m.role!, level: m.level, online: !!w.online[m.id], npc: !!w.npc[m.id] }))
      .sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role) || b.level - a.level);
    return {
      serverNow: now,
      top: this.top(),
      viewerRole: role,
      sect: {
        name: w.sect.name,
        level: sect.level,
        xp: w.sect.xp,
        xpToNext: row.xpToNext,
        region: REGION,
        regionName: w.region.region.name,
        terrain: TERRAIN_NAMES[sonMon.terrain ?? ""] ?? "—",
        faction: w.sect.faction,
        island: `tong_mon/${w.sect.model.id}`,
        model: w.sect.model,
        terrainId: sonMon.terrain ?? "co_tich",
      },
      territory: {
        held: w.held.map((h) => ({ pointId: h.pointId, type: h.type, level: h.level, perHour: minePerHour(h.level), uncollectedSince: h.uncollectedSince, attacked: h.attacked && h.attacked.endsAt > now ? h.attacked : undefined })),
        max: row.maxPoints,
        range: row.range,
        perHour,
      },
      vault: {
        linhThach: w.sect.vault.linhThach,
        upkeepPerDay: upkeep,
        daysLeft: upkeep > 0 ? Math.floor(w.sect.vault.linhThach / upkeep) : Infinity,
        parts: [
          { label: `Hộ trận sơn môn (${WARD.casters} trận pháp sư)`, value: wardUpkeep },
          { label: `${row.miniPortals} tiểu Truyền Tống Trận`, value: portalUpkeep },
        ],
      },
      wars: w.wars,
      members,
      memberMax: row.members,
      applicants: w.applicants,
      buildings: w.buildings,
      miniMap: this.miniMap([w.sonMon, ...w.held.map((h) => h.pointId)]),
      can: {
        hienTe: role !== null,
        duyet: atLeast(role, "truong_lao"),
        tuyenChien: atLeast(role, "pho_tong_chu") && sect.level >= KT.warLevel,
        xuatSu: role !== null && RULES.releaseRoles.includes(role),
        xay: atLeast(role, "pho_tong_chu"),
      },
      donateXpPerStone: KT.xpPerStone,
    };
  }

  async congPhap(): Promise<CongPhapView> {
    const me = this.me;
    const sect = this.sect;
    const role = me.role;
    const byId = (id: number) => me.learned.find((l) => l.techniqueId === id)!;
    const loadout: (TechniqueCard | null)[] = [];
    for (let i = 0; i < RULES.loadoutSize; i++) loadout.push(me.loadout[i] !== undefined ? learnedCard(byId(me.loadout[i])) : null);
    const fromSect = me.learned.filter((l) => l.sectId === SECT).length;
    return {
      serverNow: this.now(),
      top: this.top(),
      viewerRole: role,
      loadout,
      learned: me.learned.map(learnedCard),
      transmission: sect.transmission.map((id) => {
        const t = sect.techniques.find((x) => x.id === id)!;
        const learned = me.learned.some((l) => l.techniqueId === id);
        let blocked: string | undefined;
        if (!learned && role === "ngoai_mon" && (t.grade > RULES.outerMaxGrade || fromSect >= RULES.outerMaxLearned)) blocked = "Ngoại môn giới hạn";
        else if (!learned && t.grade > maxGradeAtLevel(me.level)) blocked = `Cần cấp ${[1, 50, 100, 150][t.grade - 1] ?? "?"}`;
        return { ...techCard(t), learned, blocked };
      }),
      transmissionSlots: transmissionSlots(sect.level),
      bag: me.bag.map(scrollCard),
      library: sect.library.map(scrollCard),
      sectTechniques: sect.techniques.map((t) => techCard(t)),
      contribution: me.contribution,
      can: {
        ghep: role !== null && RULES.composeRoles.includes(role),
        truyenThu: role !== null && RULES.transmissionRoles.includes(role),
      },
      maxSubs: sect.level >= RULES.secondSubLevel ? 2 : 1,
    };
  }

  async lienMinh(): Promise<LienMinhView> {
    const w = this.w;
    const now = this.now();
    const role = this.me.role;
    const mine = { id: SECT, name: w.sect.name, level: this.sect.level, faction: w.sect.faction, points: w.held.length, online: Object.values(w.online).filter(Boolean).length, color: "#e6d8b8" };
    const allies = w.sects.filter((s) => s.ally);
    // Thứ Ba, Năm, Bảy 21:00–22:00 (hình bố cục Liên minh): trận gần nhất trong tuần.
    const nextWar = (() => {
      for (let d = 0; d < 7; d++) {
        const t = todayAt(now + d * 24 * H, 21);
        if ([2, 4, 6].includes(new Date(t).getDay()) && t + H > now) return t;
      }
      return todayAt(now, 21);
    })();
    return {
      serverNow: now,
      top: this.top(),
      viewerRole: role,
      sectLevel: this.sect.level,
      alliance: w.alliance.joined
        ? {
            name: w.alliance.name,
            leader: w.alliance.leader,
            sects: [
              ...allies.filter((s) => s.name === w.alliance.leader).map(toAllianceSect),
              mine,
              ...allies.filter((s) => s.name !== w.alliance.leader).map(toAllianceSect),
            ],
            warDays: "Thứ Ba, Năm, Bảy",
            warHours: "21:00–22:00",
            wars: [{ with: "Thanh Phong Các", startsAt: nextWar }],
            helpRequests: [{ from: "Thiên Lôi Đài", point: "Mỏ quặng phía bắc", at: now - 22 * 60_000 }],
            boss: { name: "Lôi Giao Vương", days: "Thứ Sáu – Chủ Nhật", hpPercent: 64 },
            chat: w.chat.slice(-30),
            miniMap: this.miniMap([w.sonMon, ...w.held.map((h) => h.pointId), ...allies.flatMap((s) => [s.sonMon, ...s.points])]),
          }
        : null,
      list: [
        { id: "lien_minh_loi", name: "Lôi Minh", sects: 3, level: 41, invited: true },
        { id: "phong_van_hoi", name: "Phong Vân Hội", sects: 4, level: 52, invited: false },
        { id: "huyet_y_minh", name: "Huyết Y Minh", sects: 2, level: 33, invited: false },
      ],
      joinLevel: KT.allianceJoinLevel,
      createLevel: KT.allianceCreateLevel,
      can: { lienMinh: atLeast(role, "pho_tong_chu") },
    };
  }

  async banDo(): Promise<BanDoView> {
    const w = this.w;
    const now = this.now();
    const role = this.me.role;
    const owners: BanDoView["owners"] = {};
    owners[w.sonMon] = { owner: "minh", name: w.sect.name };
    for (const h of w.held) {
      owners[h.pointId] = {
        owner: "minh", name: w.sect.name, level: h.level || undefined, perHour: minePerHour(h.level) || undefined,
        attacked: h.attacked && h.attacked.endsAt > now ? h.attacked : undefined,
      };
    }
    for (const s of w.sects) {
      const owner = s.ally && w.alliance.joined ? "dong_minh" : "dich";
      owners[s.sonMon] = { owner, name: s.name };
      for (const id of s.points) {
        const p = w.region.points[id];
        const level = p.type.startsWith("mo_") ? 1 + (id % 3) : undefined;
        owners[id] = { owner, name: s.name, level, perHour: level ? minePerHour(level) : undefined };
      }
    }
    const row = sectRow(this.sect.level);
    const dist = stagesFrom(w.region, w.sonMon);
    return {
      serverNow: now,
      top: this.top(),
      viewerRole: role,
      map: this.miniMap(),
      sectIsland: `tong_mon/${w.sect.model.id}`,
      owners,
      inRange: [...dist].filter(([, d]) => d <= row.range).map(([id]) => id),
      held: w.held.length,
      maxHeld: row.maxPoints,
      can: { chiem: atLeast(role, "truong_lao"), tuyenChien: atLeast(role, "pho_tong_chu") && this.sect.level >= KT.warLevel },
    };
  }

  async send(cmd: DashboardCommand): Promise<CommandResult> {
    const w = this.w;
    const now = this.now();
    const rule = (c: Command): CommandResult => {
      const r = apply(w.rules, c, now);
      return r.ok ? { ok: true } : { ok: false, error: r.error };
    };
    switch (cmd.type) {
      case "nop_tan_quyen": {
        const s = this.me.bag.find((x) => x.uid === cmd.scrollUid);
        const r = rule({ type: "nop_tan_quyen", actor: PLAYER, scrollUid: cmd.scrollUid });
        return r.ok && s ? { ok: true, message: `Nộp xong, +${RULES.contributionPerScroll[s.grade - 1]} cống hiến` } : r;
      }
      case "ghep_cong_phap": {
        const r = rule({ type: "ghep_cong_phap", actor: PLAYER, main: cmd.main, subs: cmd.subs });
        const t = this.sect.techniques[this.sect.techniques.length - 1];
        return r.ok ? { ok: true, message: `Ghép được ${t.name}` } : r;
      }
      case "dat_bo_truyen_thu": {
        const r = rule({ type: "dat_bo_truyen_thu", actor: PLAYER, techniqueIds: cmd.techniqueIds });
        return r.ok ? { ok: true, message: `Bộ truyền thụ có ${cmd.techniqueIds.length} công pháp` } : r;
      }
      case "hoc_cong_phap": {
        const r = rule({ type: "hoc_cong_phap", actor: PLAYER, techniqueId: cmd.techniqueId });
        const t = this.sect.techniques.find((x) => x.id === cmd.techniqueId);
        return r.ok ? { ok: true, message: `Đã học ${t?.name ?? "công pháp"}, tầng 1` } : r;
      }
      case "mac_do": {
        const p = w.player;
        const i = p.bag.findIndex((x) => x.uid === cmd.uid && x.gear);
        if (i < 0) return { ok: false, error: "khong_thay_mon" };
        const g = p.bag[i].gear!;
        const old = p.gear[g.slot];
        p.bag.splice(i, 1);
        if (old) p.bag.push(gearBagItem(p.nextUid++, old));
        p.gear[g.slot] = g;
        return { ok: true, message: old ? `Đã mặc ${g.name}, ${old.name} về túi` : `Đã mặc ${g.name}` };
      }
      case "thao_do": {
        const p = w.player;
        const g = p.gear[cmd.slot];
        if (!g) return { ok: false, error: "khong_thay_mon" };
        if (p.bag.length + this.me.bag.length >= BAG_CAPACITY) return { ok: false, error: "tui_day" };
        delete p.gear[cmd.slot];
        p.bag.push(gearBagItem(p.nextUid++, g));
        return { ok: true, message: `${g.name} về túi` };
      }
      case "cuoi_thu": {
        const p = w.player;
        const id = p.mounts[cmd.index];
        if (!id) return { ok: false, error: "khong_thay_mon" };
        p.riding = cmd.index;
        return { ok: true, message: `Đang cưỡi ${THU_CUOI.find((t) => t.id === id)?.name ?? "thú"}` };
      }
      case "mang_vao_tran": {
        const r = rule({ type: "mang_vao_tran", actor: PLAYER, techniqueIds: cmd.techniqueIds });
        return r.ok ? { ok: true, message: `Mang ${cmd.techniqueIds.length}/${RULES.loadoutSize} công pháp vào trận` } : r;
      }
      case "cho_xuat_su": {
        const r = rule({ type: "cho_xuat_su", actor: PLAYER, memberId: cmd.memberId });
        return r.ok ? { ok: true, message: `${w.names[cmd.memberId]} đã xuất sư` } : r;
      }
      case "thu_mo": {
        // Sprint 5 chuyển vào @ktlp/rules (mỏ tính lười 20 × cấp^1,15 mỗi giờ).
        const got = { linhThach: 0, quang: 0, duoc: 0 };
        for (const h of w.held) {
          if (h.level <= 0) continue;
          const hours = Math.min(MINE_CAP_HOURS, (now - h.uncollectedSince) / H);
          const amount = Math.floor(minePerHour(h.level) * hours);
          if (h.type === "mo_linh_thach") got.linhThach += amount;
          if (h.type === "mo_quang") got.quang += amount;
          if (h.type === "mo_duoc") got.duoc += amount;
          h.uncollectedSince = now;
        }
        w.sect.vault.linhThach += got.linhThach;
        w.sect.vault.quang += got.quang;
        w.sect.vault.duoc += got.duoc;
        return { ok: true, message: `Bảo Khố +${fmt(got.linhThach)} linh thạch, +${fmt(got.quang)} quặng, +${fmt(got.duoc)} dược` };
      }
      case "hien_te": {
        // Hiến tế: 50 XP tông môn mỗi linh thạch (GDD mục 12); Sprint 5 chuyển vào @ktlp/rules.
        const amount = Math.floor(cmd.amount);
        if (amount <= 0 || amount > w.player.linhThach) return { ok: false, error: "khong_du_linh_thach" };
        w.player.linhThach -= amount;
        w.sect.xp += amount * KT.xpPerStone;
        this.me.contribution += Math.floor(amount / DONATE_CONTRIBUTION_DIV);
        let up = 0;
        while (this.sect.level < KT.maxSectLevel && w.sect.xp >= sectRow(this.sect.level).xpToNext) {
          w.sect.xp -= sectRow(this.sect.level).xpToNext;
          this.sect.level++;
          up++;
        }
        return { ok: true, message: `+${fmt(amount * KT.xpPerStone)} XP tông môn${up ? `, lên cấp ${this.sect.level}` : ""}` };
      }
      case "duyet_don": {
        if (!atLeast(this.me.role, "truong_lao")) return { ok: false, error: "khong_du_quyen" };
        const a = w.applicants.find((x) => x.id === cmd.applicantId);
        if (!a) return { ok: false, error: "khong_co_thanh_vien" };
        w.applicants = w.applicants.filter((x) => x !== a);
        if (cmd.accept) {
          // Lệnh gia nhập có ở Sprint 5; tạm thêm thẳng vào trạng thái của rules.
          w.rules.members[a.id] = { id: a.id, level: a.level, sectId: SECT, role: "ngoai_mon", contribution: 0, bag: [], learned: [], loadout: [] };
          w.names[a.id] = a.name;
          w.online[a.id] = true;
        }
        return { ok: true, message: cmd.accept ? `${a.name} vào ngoại môn` : `Đã từ chối ${a.name}` };
      }
      case "chat": {
        const text = filterWords(cmd.text.trim()).slice(0, 200);
        if (!text) return { ok: false, error: "lenh_khong_hop_le" };
        w.chat.push({ id: w.nextChat++, from: `${w.sect.name} · ${w.player.name}`, text, at: now });
        return { ok: true };
      }
      case "bao_cao": {
        const c = w.chat.find((x) => x.id === cmd.chatId);
        if (c) c.reported = true;
        return { ok: true, message: "Đã gửi báo cáo cho quản trị" };
      }
      case "xin_vao_lien_minh":
        return this.sect.level >= KT.allianceJoinLevel ? { ok: true, message: "Đã gửi đơn, chờ minh chủ duyệt" } : { ok: false, error: "chua_du_cap" };
      case "dev_chuc_vi":
        this.me.role = cmd.role;
        return { ok: true };
      case "dev_mo_hinh":
        w.sect.model = cmd.model;
        return { ok: true, message: `Mô hình ${cmd.model.name}` };
      case "dev_lien_minh":
        w.alliance.joined = cmd.joined;
        return { ok: true };
    }
  }
}

const ELEMENT_LABEL: Record<Element, string> = {
  kim: "Kim", moc: "Mộc", thuy: "Thủy", hoa: "Hỏa", tho: "Thổ", loi: "Lôi", phong: "Phong",
  cuc_duong: "Cực dương", cuc_am: "Cực âm", cuc_han: "Cực hàn", quang: "Quang", am_lanh: "Âm lãnh",
};

function toAllianceSect(s: World["sects"][number]) {
  return { id: s.id, name: s.name, level: s.level, faction: s.faction, points: s.points.length, online: s.online, color: s.color };
}

/** Lọc từ trong chat (G1); danh sách thật do vận hành giữ, đây chỉ là mẫu. */
const BANNED = ["ngu", "chết đi", "lừa đảo"];
export function filterWords(text: string): string {
  let out = text;
  for (const b of BANNED) out = out.replace(new RegExp(`(^|\\s)${b}(?=\\s|$|[.,!?])`, "giu"), (_m, pre: string) => pre + "*".repeat(b.length));
  return out;
}

export function fmt(n: number): string {
  return Math.round(n).toLocaleString("vi-VN");
}

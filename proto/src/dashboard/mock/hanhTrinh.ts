// Hành trình theo chặng cho nguồn mẫu (GDD mục 7, "Hành trình thay cho đi bộ thời gian thực"): người chơi chọn điểm đến,
// đi theo đường trên bản đồ; thời gian theo số chặng và tốc độ, thú cưỡi tăng tốc. Máy chủ thật (khối M3) còn tung sự kiện
// mỗi chặng; bản mẫu chỉ có đi và tới. Sang vùng khác thì qua đèo (điểm có `neighbour`); vào khu đặc biệt (Cấm Khu) qua cửa
// ải của khu, phía vùng là điểm gần cửa ải nhất. Mỗi đoạn trong một vùng là một TravelLeg.
import { loadRegion, routeIds, type RegionMap, type WorldZone } from "../../scenes/map/region.ts";
import type { TravelLeg, World } from "./world.ts";

/** Phút mỗi chặng khi đi bộ (đề xuất: GDD chỉ nói thời gian theo số chặng và tốc độ, chưa có số). */
export const PHUT_MOI_CHANG = 6;
/** Thú cưỡi cảnh giới Khai Linh: tốc độ hành trình ×1,2 (GDD bảng cảnh giới thú, mục 6). */
export const TOC_DO_CUOI = 1.2;

const MIN = 60_000;
const clamp = (v: number) => Math.max(0, Math.min(1, v));

/** Chỗ của mình lúc `now`: đang đi thì đoạn hiện tại (vùng, điểm đi, điểm tới, tỉ lệ); đã tới thì from = to. */
export interface Where {
  region: string;
  from: number;
  to: number;
  progress: number;
  moving: boolean;
  leg?: TravelLeg;
}

/** Các đoạn của chuyến; chuyến cũ không có `legs` là một đoạn trong vùng nhà. */
export function legsOf(w: World): TravelLeg[] {
  const t = w.travel;
  return t.legs ?? [{ region: w.region.region.code, from: t.from, to: t.to, startsAt: t.startsAt, endsAt: t.endsAt }];
}

export function whereAt(w: World, now: number): Where {
  const legs = legsOf(w);
  for (const l of legs) {
    if (now >= l.endsAt) continue;
    if (now < l.startsAt) return { region: l.region, from: l.from, to: l.from, progress: 0, moving: true, leg: l };
    return { region: l.region, from: l.from, to: l.to, progress: clamp((now - l.startsAt) / (l.endsAt - l.startsAt)), moving: true, leg: l };
  }
  const last = legs[legs.length - 1];
  return { region: last.region, from: last.to, to: last.to, progress: 0, moving: false };
}

/** Điểm tới cuối chuyến. */
export function destOf(w: World): { region: string; pointId: number } {
  const l = legsOf(w);
  return { region: l[l.length - 1].region, pointId: l[l.length - 1].to };
}

/** Phút mỗi chặng theo việc đang cưỡi thú. */
export function minutesPerStage(riding: boolean): number {
  return riding ? PHUT_MOI_CHANG / TOC_DO_CUOI : PHUT_MOI_CHANG;
}

export type PlanError = "da_o_day" | "khong_co_duong";

/**
 * Lập chuyến từ `start` tới `dest`: tìm chuỗi vùng theo chiều rộng (đèo nối hai vùng, cửa ải nối khu với vùng), rồi mỗi vùng
 * một đoạn theo đường chặng ngắn nhất. Đoạn 0 chặng (đứng ngay đèo) bỏ đi. Thời gian từ `now`, `minPerStage` phút mỗi chặng.
 */
export async function planTrip(
  start: { region: string; pointId: number }, dest: { region: string; pointId: number }, zones: WorldZone[], regions: string[], now: number, minPerStage: number,
): Promise<{ legs: TravelLeg[]; stages: number } | PlanError> {
  if (start.region === dest.region && start.pointId === dest.pointId) return "da_o_day";
  const zoneCodes = new Set(zones.map((z) => z.code));
  const maps = new Map<string, RegionMap>();
  const get = async (code: string) => maps.get(code) ?? maps.set(code, await loadRegion(code)).get(code)!;
  // Vùng kề: đèo của vùng (neighbour), cửa ải của khu (neighbour của điểm cửa ải) nối cả hai chiều.
  const zoneMaps = await Promise.all([...zoneCodes].map(get));
  const zoneLinks = new Map<string, Set<string>>();
  for (const zm of zoneMaps) for (const p of zm.points) if (p.neighbour) (zoneLinks.get(p.neighbour) ?? zoneLinks.set(p.neighbour, new Set()).get(p.neighbour)!).add(zm.region.code);
  const next = async (code: string): Promise<string[]> => {
    const m = await get(code);
    const out = new Set(m.points.filter((p) => p.neighbour && regions.concat([...zoneCodes]).includes(p.neighbour)).map((p) => p.neighbour!));
    for (const z of zoneLinks.get(code) ?? []) out.add(z);
    return [...out];
  };
  const prev = new Map<string, string>([[start.region, ""]]);
  const queue = [start.region];
  for (let i = 0; i < queue.length && !prev.has(dest.region); i++) {
    for (const n of await next(queue[i])) {
      if (prev.has(n)) continue;
      prev.set(n, queue[i]);
      queue.push(n);
    }
  }
  if (!prev.has(dest.region)) return "khong_co_duong";
  const chain = [dest.region];
  while (chain[0] !== start.region) chain.unshift(prev.get(chain[0])!);

  const dist2 = (a: { x: number; y: number }, b: { x: number; y: number }) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
  const nearest = (m: RegionMap, at: { x: number; y: number }, ok: (id: number) => boolean = () => true) =>
    m.points.filter((p) => ok(p.id)).reduce((b, p) => (dist2(p, at) < dist2(b, at) ? p : b));
  const legs: TravelLeg[] = [];
  let total = 0;
  let t = now;
  let from = start.pointId;
  for (let i = 0; i < chain.length; i++) {
    const code = chain[i];
    const m = await get(code);
    let to = dest.pointId;
    let enter: number | undefined;
    if (i < chain.length - 1) {
      const nx = chain[i + 1];
      const nm = await get(nx);
      if (zoneCodes.has(code)) {
        // Rời khu: cửa ải của khu nối sang vùng kế; phía vùng là điểm gần cửa ải nhất.
        const gate = m.points.find((p) => p.neighbour === nx)!;
        to = gate.id;
        enter = nearest(nm, gate).id;
      } else if (zoneCodes.has(nx)) {
        // Vào khu: cửa ải của khu nối với vùng này; phía vùng đi tới điểm gần cửa ải nhất.
        const gate = nm.points.find((p) => p.neighbour === code)!;
        to = nearest(m, gate).id;
        enter = gate.id;
      } else {
        // Hai vùng: đèo gần nhất (ít chặng) của vùng này dẫn sang vùng kế; bên kia là đèo dẫn ngược lại, gần nhất về toạ độ.
        const passes = m.points.filter((p) => p.neighbour === nx);
        const len = (id: number) => routeIds(m, from, id)?.length ?? Infinity;
        const pass = passes.reduce((b, p) => (len(p.id) < len(b.id) ? p : b));
        to = pass.id;
        const back = nm.points.filter((p) => p.neighbour === code);
        enter = (back.length ? back.reduce((b, p) => (dist2(p, pass) < dist2(b, pass) ? p : b)) : nearest(nm, pass)).id;
      }
    }
    const ids = routeIds(m, from, to);
    if (!ids) return "khong_co_duong";
    const stages = ids.length - 1;
    if (stages > 0) {
      const end = t + Math.round(stages * minPerStage * MIN);
      legs.push({ region: code, from, to, startsAt: t, endsAt: end });
      total += stages;
      t = end;
    }
    if (enter !== undefined) from = enter;
  }
  if (!legs.length) return "da_o_day";
  return { legs, stages: total };
}

/**
 * Điểm bắt đầu khi đổi đích giữa đường: điểm trên đường của đoạn đang đi gần chỗ mình nhất theo số chặng đã qua (đi quá nửa
 * chặng thì lấy điểm phía trước). Dấu trên bản đồ nhảy tối đa nửa chặng.
 */
export async function startFrom(w: World, now: number): Promise<{ region: string; pointId: number }> {
  const at = whereAt(w, now);
  if (!at.moving || !at.leg) return { region: at.region, pointId: at.from };
  const m = await loadRegion(at.region);
  const ids = routeIds(m, at.leg.from, at.leg.to) ?? [at.leg.from];
  return { region: at.region, pointId: ids[Math.round(at.progress * (ids.length - 1))] };
}

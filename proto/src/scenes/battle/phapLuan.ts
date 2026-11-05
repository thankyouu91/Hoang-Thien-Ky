// Pháp luân: vòng sáng sau lưng tu sĩ từ cảnh giới Trúc Cơ, vẽ theo công pháp chủ tu (docs/PHAP_LUAN.md).
// Hệ chính cho màu, ký hiệu và tính cách quay; loại chiêu cho hình vành; hệ phụ và quan hệ tổ hợp cho vành trong;
// phẩm cho độ chi tiết; cảnh giới cho số lớp. Chuyển động theo nhịp khung 30/giây: hiện, thở, tụ lực, bung, khung chạm,
// lắng. Mọi thứ tính từ thời gian và mốc ra chiêu, không giữ trạng thái, nên tua và đổi tốc độ vẫn đúng.
import { comboRelation, type Element } from "@ktlp/sim";
import { drawMotif } from "../../hieu_ung/motifs.ts";
import type { ElementId, ReplayEvent, ReplayUnit, SkillId } from "../../replay/types.ts";
import { ELEMENT_STYLE } from "../../theme/elements.ts";

/** 0 Luyện Khí (không có pháp luân), 1 Trúc Cơ, 2 Kết Đan, 3 Nguyên Anh, 4 Hóa Thần (GDD mục 7, Hạ vị). */
export type Realm = 0 | 1 | 2 | 3 | 4;

export const REALM_NAMES = ["Luyện Khí", "Trúc Cơ", "Kết Đan", "Nguyên Anh", "Hóa Thần"] as const;

/** Cảnh giới Hạ vị theo cấp: 1–50, 51–100, 101–150, 151–200, 201–250. */
export function realmOf(level: number | undefined): Realm {
  if (!level || level <= 50) return 0;
  return Math.min(4, Math.floor((level - 1) / 50)) as Realm;
}

/** Tiểu cảnh giới trong mỗi cảnh giới (đề xuất, GDD chưa chia): mỗi phần một phần tư số cấp của cảnh giới. */
export const STAGE_NAMES = ["Sơ kỳ", "Trung kỳ", "Hậu kỳ", "Viên mãn"] as const;

/** Vị trí của một cấp trên thang tu luyện: cảnh giới, độ tiến trong cảnh giới (0 → 1) và tiểu cảnh giới. */
export interface Growth {
  realm: Realm;
  progress: number;
  stage: 0 | 1 | 2 | 3;
}

/** Tăng trưởng theo cấp; nhận cấp lẻ để vẽ lúc vòng đang lớn dần giữa hai cấp. */
export function growth(level: number): Growth {
  const realm = realmOf(Math.floor(level));
  const start = realm === 0 ? 1 : realm * 50 + 1;
  const progress = Math.max(0, Math.min(1, (level - start) / 49));
  return { realm, progress, stage: Math.min(3, Math.floor(progress * 4)) as Growth["stage"] };
}

/** Công pháp chủ tu và cấp của người mang pháp luân. */
export interface PhapLuanSpec {
  element: ElementId;
  /** Hệ phụ quyển đầu; không có thì vành trong cùng hệ chính */
  sub?: ElementId;
  type: SkillId;
  /** Phẩm 1–10 */
  grade: number;
  /** Cấp nhân vật (Hạ vị 1–250); cảnh giới, tiểu cảnh giới và độ lớn của vòng suy từ cấp (growth) */
  level: number;
  /** Tông chủ: thêm vành lông vũ vàng ngoài cùng */
  leader?: boolean;
  /**
   * Màn đông người (Trận): vòng nhỏ hơn 20% và nhạt còn 55% lúc nghỉ, đậm dần khi tụ lực, đậm hẳn lúc bung và khung chạm
   * rồi nhạt lại, để hàng người đứng sát nhau không rối mà lúc ra chiêu vẫn nổi.
   */
  quiet?: boolean;
}

/**
 * Mốc của nhịp tại thời điểm đang vẽ, giây (đã đổi từ tick): `appear` từ lúc hiện; `wind` từ lúc bắt đầu vận công
 * (chỉ khi đang vận công, chưa phát); `release` từ lúc phát (trong 1,2 s sau đó); `clock` đồng hồ quay đã trừ các
 * khoảng hit-stop, để vành đứng yên đúng lúc chạm rồi quay tiếp không giật.
 */
export interface PhapLuanBeat {
  appear: number;
  wind?: number;
  release?: number;
  clock: number;
  /** Vừa lên cấp trong cùng cảnh giới: giây từ lúc lên và cấp cũ; vòng lớn dần từ cấp cũ sang cấp mới trong 0,6 s */
  levelUp?: { age: number; from: number };
  /** Vừa đột phá sang cảnh giới mới: giây từ lúc đột phá và cấp cũ; diễn nhịp thiên kiếp (BREAK_LEN giây) */
  breakthrough?: { age: number; from: number };
}

/** Pháp luân của một người trong trận và các lần ra chiêu của người đó (xếp theo tick phát). */
export interface PhapLuanUnit {
  spec: PhapLuanSpec;
  casts: { tick: number; start?: number }[];
}

/**
 * Pháp luân cho cả trận từ replay: công pháp chủ tu lấy từ lần ra chiêu đầu tiên của mỗi người (hệ, hệ phụ đầu, loại
 * chiêu, phẩm); chưa ra chiêu lần nào thì lấy hệ linh căn. Cảnh giới theo `ReplayUnit.level` (thiếu thì Luyện Khí, không
 * vẽ). Tông chủ là người id nhỏ nhất mỗi đội, cùng luật với assignLooks.
 */
export function buildPhapLuan(units: readonly ReplayUnit[], events: readonly ReplayEvent[]): Map<number, PhapLuanUnit> {
  const out = new Map<number, PhapLuanUnit>();
  const leaders = new Set<number>();
  for (const team of [0, 1]) {
    const ids = units.filter((u) => u.team === team).map((u) => u.id);
    if (ids.length) leaders.add(Math.min(...ids));
  }
  for (const u of units) {
    const level = u.level;
    out.set(u.id, {
      spec: { element: u.element, type: "can_don", grade: 3, level: level ?? 0, leader: leaders.has(u.id), quiet: true },
      casts: [],
    });
  }
  for (const e of events) {
    if (e.kind !== "cast") continue;
    const pl = out.get(e.unit);
    if (!pl) continue;
    if (pl.casts.length === 0) {
      pl.spec = { ...pl.spec, element: e.element, sub: e.subElements?.[0], type: e.skill, grade: e.grade ?? 3 };
    }
    pl.casts.push({ tick: e.tick, start: e.start });
  }
  for (const pl of out.values()) pl.casts.sort((a, b) => a.tick - b.tick);
  return out;
}

const FPS = 30;
const HIT_FROM = 4 / FPS; // khung chạm từ khung 4 tới khung 8 sau lúc phát
const HIT_LEN = 4 / FPS;

/**
 * Nhịp tại t (tick) từ danh sách lần ra chiêu của một người (xếp theo tick phát; `start` là lúc bắt đầu vận công nếu có).
 * `appearTick` là lúc pháp luân hiện (đầu trận là 0).
 */
export function phapLuanBeat(casts: readonly { tick: number; start?: number }[], t: number, tps: number, appearTick = 0): PhapLuanBeat {
  let clock = t / tps;
  let wind: number | undefined;
  let release: number | undefined;
  for (const c of casts) {
    const from = c.start ?? c.tick;
    if (from > t) break;
    if (t < c.tick) wind = (t - from) / tps;
    else {
      const since = (t - c.tick) / tps;
      if (since < 1.2) {
        release = since;
        wind = undefined;
      }
      // Hit-stop: đồng hồ quay đứng trong khung 4–8 sau mỗi lần phát đã qua.
      clock -= Math.min(Math.max(since - HIT_FROM, 0), HIT_LEN);
    }
  }
  return { appear: Math.max(0, (t - appearTick) / tps), wind, release, clock };
}

// ---- ease ----

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeInOutSine = (x: number) => 0.5 - 0.5 * Math.cos(Math.PI * x);
const easeInOutCubic = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const easeOutCubic = (x: number) => 1 - Math.pow(1 - x, 3);
const easeOutQuad = (x: number) => 1 - (1 - x) * (1 - x);
function easeOutBack(x: number, s = 1.9): number {
  const y = x - 1;
  return 1 + (s + 1) * y * y * y + s * y * y;
}
/** Băm số nguyên ra [-1, 1], cho các nấc giật của Lôi; cùng đầu vào cùng kết quả. */
function hash(n: number): number {
  let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 0x7fffffff - 1;
}

/** Hình dạng tại một nhịp: scale chung, co giãn hai trục, độ sáng quầng, độ kéo ký hiệu vào tâm, rung, khung chạm, bóng mờ. */
export interface Envelope {
  scale: number;
  sx: number;
  sy: number;
  glow: number;
  pull: number;
  shake: number;
  flash: number;
  smear: number;
}

/** Bao chuyển động theo nhịp (bảng nhịp ở docs/PHAP_LUAN.md); `lag` giây trễ cho các lớp đáp lại sau (overlap). */
export function envelope(beat: PhapLuanBeat, lag = 0): Envelope {
  const appear = beat.appear - lag;
  const wind = beat.wind === undefined ? undefined : beat.wind - lag;
  const release = beat.release === undefined ? undefined : beat.release - lag;
  // Hiện: 18 khung, nở từ tâm, vượt 1,08 rồi về 1.
  const fa = (appear * FPS) / 18;
  let scale = fa >= 1 ? 1 : fa <= 0 ? 0 : easeOutBack(fa);
  // Thở: vòng 120 khung, khung 0–60 hít vào, 60–120 thở ra (ease-in-out-sine hai chiều, nối vòng liền).
  const ph = (((((beat.clock - lag) * FPS) % 120) + 120) % 120) / 120;
  const b = 0.5 - 0.5 * Math.cos(2 * Math.PI * ph);
  scale *= 1 + 0.035 * b;
  let sx = 1;
  let sy = 1;
  let glow = 0.75 + 0.25 * b;
  let pull = 0;
  let shake = 0;
  let flash = 0;
  let smear = 0;
  if (wind !== undefined && wind >= 0) {
    // Tụ lực: 8 khung co lại và dẹt, quầng tăng, ký hiệu kéo vào; sau đó giữ và run nhẹ.
    const fw = wind * FPS;
    const k = easeInOutCubic(clamp01(fw / 8));
    scale *= 1 - 0.1 * k;
    sx = 1 + 0.04 * k;
    sy = 1 - 0.08 * k;
    glow += 0.5 * k;
    pull = 0.15 * k;
    shake = fw > 8 ? 0.012 * Math.min(1, (fw - 8) / 20) : 0;
  } else if (release !== undefined && release >= 0) {
    const fr = release * FPS;
    if (fr < 4) {
      // Bung (4 khung): từ trạng thái tụ lực (0,9, dẹt) giãn lên 1,15, kéo dài theo chiều quay; bóng mờ phía sau.
      const s = easeOutQuad(fr / 4);
      scale *= 0.9 + 0.25 * s;
      sx = 1.04 + 0.04 * s;
      sy = 0.92 + 0.1 * s;
      glow += 0.5 + 0.5 * s;
      smear = 1 - fr / 4;
    } else if (fr < 8) {
      // Khung chạm: đứng yên ở đỉnh; khung đầu sáng trắng.
      scale *= 1.15;
      sx = 1.08;
      sy = 1.02;
      glow += 1;
      flash = fr < 5 ? 1 : 0;
    } else if (fr < 25) {
      // Lắng: lò xo tắt dần từ 1,15 về 1, vượt xuống khoảng 0,98 một lần.
      const x = (fr - 8) / 17;
      scale *= 1 + 0.15 * Math.cos(1.5 * Math.PI * x) * Math.exp(-3 * x);
      const k = 1 - easeOutCubic(x);
      sx = 1 + 0.08 * k;
      sy = 1 + 0.02 * k;
      glow += k;
    }
  }
  return { scale, sx, sy, glow, pull, shake, flash, smear };
}

// ---- quay theo tính cách hệ ----

/** Góc quay (radian) của vành chính theo đồng hồ quay `c` (giây). */
function spin(el: ElementId, c: number): number {
  switch (el) {
    case "kim":
      return c * 0.35;
    case "moc":
      return c * 0.08 + 0.25 * Math.sin(c * 0.6);
    case "thuy":
      return 0.4 * Math.sin(c * 0.9);
    case "hoa":
      return c * 0.6 + 0.05 * Math.sin(c * 3);
    case "tho": {
      // Từng nấc 1/6 vòng mỗi 1,5 s: 40% đầu nấc đi có vượt (ease-out-back), còn lại đứng.
      const step = Math.floor(c / 1.5);
      const f = (c - step * 1.5) / 1.5;
      return (step + (f < 0.4 ? easeOutBack(f / 0.4, 1.2) : 1)) * (Math.PI / 3);
    }
    case "loi": {
      const j = hash(Math.floor(c * 10));
      return c * 0.4 + (Math.abs(j) > 0.75 ? 0.09 * j : 0);
    }
    case "phong":
      return c * 1.4 + 0.3 * Math.sin(c * 1.2);
    case "quang":
      return c * 0.2;
    case "am_lanh":
      return c * 0.15 + 0.2 * Math.sin(c * 0.4);
    case "cuc_duong":
      return c * 0.3;
    case "cuc_am":
      return -c * 0.2;
    case "cuc_han":
      return c * 0.25;
  }
}

/** Hệ số quay của vành trong so với vành chính theo quan hệ tổ hợp; null là đối cực (vành chia đôi âm dương). */
function innerRatio(main: ElementId, sub: ElementId): number | null {
  const t = comboRelation(main as Element, sub as Element).t;
  if (t >= 1100) return null; // đối cực hợp nhất
  if (t >= 1070) return 1; // thuần
  if (t >= 1040) return 1.6; // tương sinh, tương hợp
  if (t >= 990) return 0.6; // trung tính
  return -1; // tương khắc
}

// ---- màu ----

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
/** Trộn màu hex với trắng theo k (0 giữ nguyên, 1 trắng), ra chuỗi rgba. */
function tone(hex: string, k: number, a = 1): string {
  const [r, g, b] = rgb(hex);
  const m = (v: number) => Math.round(v + (255 - v) * k);
  return `rgba(${m(r)},${m(g)},${m(b)},${a})`;
}

// ---- vẽ ----

/** Số ký hiệu đầu và cuối mỗi cảnh giới (Trúc Cơ → Hóa Thần); giữa hai mốc tăng dần theo cấp. */
const MOTIFS: Record<1 | 2 | 3 | 4, [number, number]> = { 1: [3, 6], 2: [6, 8], 3: [8, 10], 4: [10, 12] };

/**
 * Các thông số lớn dần theo cấp (docs/PHAP_LUAN.md, phần Tăng trưởng):
 * - `span`: phần vành chính đã khép (Trúc Cơ sơ kỳ chưa khép kín);
 * - `layer`: độ đầy của lớp mới của cảnh giới (mọc dần trong sơ kỳ);
 * - `shape`: độ hiện của hình loại chiêu (Trúc Cơ hiện dần trong trung kỳ);
 * - `motifs`: số ký hiệu, lẻ thì ký hiệu mới đang nở;
 * - `grow`: hệ số bán kính;
 * - `light`: hệ số sáng;
 * - `omen`: báo hiệu viên mãn, lớp của cảnh giới kế tiếp thấp thoáng.
 */
export function growthLook(g: Growth): { span: number; layer: number; shape: number; motifs: number; grow: number; light: number; omen: number } {
  if (g.realm === 0) return { span: 0, layer: 0, shape: 0, motifs: 0, grow: 1, light: 0, omen: clamp01((g.progress - 0.8) / 0.2) };
  const p = g.progress;
  const early = clamp01(p / 0.25);
  const [m0, m1] = MOTIFS[g.realm as 1 | 2 | 3 | 4];
  return {
    span: g.realm === 1 ? 0.7 + 0.3 * early : 1,
    layer: 0.3 + 0.7 * early,
    shape: g.realm === 1 ? clamp01((p - 0.15) / 0.25) : 1,
    motifs: m0 + (m1 - m0) * p,
    grow: 1 + 0.06 * (g.realm - 1) + 0.05 * p,
    light: 0.8 + 0.2 * p,
    omen: g.realm < 4 ? clamp01((p - 0.75) / 0.25) : 0,
  };
}

/**
 * Bán kính ngoài cùng của pháp luân (px ảnh, tính từ tâm vòng, với bán kính gốc `r`), gồm hình loại chiêu, tia, quầng
 * và lông vũ tông chủ, để khung chân dung thu người lại cho vòng không bị cắt mép. Luyện Khí là 0 (khí tụ nằm trong người).
 */
export function phapLuanExtent(spec: PhapLuanSpec, r = 17): number {
  const g = growth(spec.level);
  if (g.realm === 0) return 0;
  const R = r * growthLook(g).grow;
  const outer = g.realm >= 4 ? 14 : g.realm >= 3 ? 12 : 9;
  return R * 1.19 + outer + (spec.leader ? 10 : 0);
}

/** Giây của nhịp đột phá (thiên kiếp nhỏ, GDD mục 7): tụ 0–20, sét 20/30/40, vỡ 44–58, hiện lại 46–64 (khung 30/giây). */
export const BREAK_LEN = 64 / 30;
const STRIKES = [20, 30, 40];

/**
 * Vẽ pháp luân tâm tại (cx, cy), bán kính vành chính `r` đơn vị của ctx (đã ở hệ px ảnh của người), theo cấp của
 * `spec`. Vừa lên cấp thì vòng lớn dần từ cấp cũ; vừa đột phá thì diễn nhịp thiên kiếp; Luyện Khí chưa có vòng,
 * riêng cuối Luyện Khí có khí tụ báo trước. Lớp ngoài cùng vẽ trước, vành chính và ký hiệu vẽ sau.
 */
export function drawPhapLuan(ctx: CanvasRenderingContext2D, spec: PhapLuanSpec, beat: PhapLuanBeat, cx: number, cy: number, r: number): void {
  const bt = beat.breakthrough;
  if (bt && bt.age < BREAK_LEN) {
    drawBreakthrough(ctx, spec, beat, bt, cx, cy, r);
    return;
  }
  let level = spec.level;
  const up = beat.levelUp;
  if (up && up.age < 0.6) level = up.from + (spec.level - up.from) * easeInOutCubic(up.age / 0.6);
  const g = growth(level);
  if (g.realm === 0) {
    drawGathering(ctx, spec.element, beat.clock, cx, cy, r, growthLook(g).omen);
    return;
  }
  // Lên cấp: một nhịp sáng mềm (không trắng) 0,3 s để thấy vòng vừa lớn.
  const boost = up && up.age < 0.3 ? 0.5 * (1 - up.age / 0.3) : 0;
  if (spec.quiet) {
    drawLuan(ctx, spec, g, beat, cx, cy, r * 0.8, 0.55 + 0.45 * activity(beat), boost);
    return;
  }
  drawLuan(ctx, spec, g, beat, cx, cy, r, 1, boost);
}

/**
 * Độ "đang hành động" của vòng (0 nghỉ → 1): tụ lực đậm dần trong 14 khung (ease-in-out-sine, mỗi khung tối đa ~0,11); bung và khung chạm (khung 0–8 sau lúc phát)
 * là 1; lắng (khung 8–25) nhạt dần về 0 (ease-in-out-sine). Dùng cho chế độ quiet của màn Trận.
 */
export function activity(beat: PhapLuanBeat): number {
  if (beat.wind !== undefined && beat.wind >= 0) return easeInOutSine(clamp01((beat.wind * FPS) / 14));
  if (beat.release !== undefined && beat.release >= 0) {
    const fr = beat.release * FPS;
    if (fr < 8) return 1;
    if (fr < 25) return 1 - easeInOutSine((fr - 8) / 17);
  }
  return 0;
}

/** Vẽ một vòng theo tăng trưởng `gr`; `alpha` độ đậm chung, `boost` sáng thêm (lên cấp), `envOverride` bao định sẵn. */
function drawLuan(
  ctx: CanvasRenderingContext2D, spec: PhapLuanSpec, gr: Growth, beat: PhapLuanBeat, cx: number, cy: number, r: number,
  alpha = 1, boost = 0, envOverride?: Envelope,
): void {
  if (gr.realm < 1) return;
  const look = growthLook(gr);
  const env = { ...(envOverride ?? envelope(beat)) };
  if (env.scale <= 0.01) return;
  env.glow = env.glow * look.light + boost;
  const main = ELEMENT_STYLE[spec.element].color;
  const sub = spec.sub ?? spec.element;
  const subColor = ELEMENT_STYLE[sub].color;
  const g = Math.max(1, Math.min(10, spec.grade));
  const c = beat.clock;
  const a0 = spin(spec.element, c);
  const R = r * look.grow;
  // Viên mãn: vòng chập chờn như sắp vỡ để lên cảnh giới mới.
  const shake = env.shake + 0.005 * look.omen;
  const shakeX = shake ? Math.sin(c * 97) * shake * R : 0;
  const shakeY = shake ? Math.cos(c * 83) * shake * R : 0;
  const realm = gr.realm;

  ctx.save();
  const base = alpha;
  ctx.translate(cx + shakeX, cy + shakeY);
  ctx.scale(env.scale * env.sx, env.scale * env.sy);

  // Quầng: ba đĩa mờ chồng nhau (rẻ hơn gradient), sáng theo hơi thở và phẩm.
  const glowA = Math.min(1, env.glow) * (0.1 + 0.012 * g);
  for (const [k, f] of [[1.25, 0.5], [1.05, 0.8], [0.8, 1]] as const) {
    ctx.globalAlpha = base * glowA * f;
    ctx.fillStyle = tone(main, 0.35);
    ctx.beginPath();
    ctx.arc(0, 0, R * k, 0, Math.PI * 2);
    ctx.fill();
  }

  // Lớp của từng cảnh giới; lớp mới mọc dần trong sơ kỳ (layer), lớp kế tiếp thấp thoáng khi viên mãn (omen).
  const omen = look.omen * (0.5 + 0.5 * Math.sin(c * 2.2)) * 0.35;
  if (realm >= 4) drawCorona(ctx, spec.element, main, R, c, env, base * look.layer);
  else if (realm === 3 && omen > 0) drawCorona(ctx, spec.element, main, R, c, env, base * omen);
  if (realm >= 3) drawRays(ctx, main, R, a0, env, g, realm === 3 ? look.layer : 1, base);
  else if (realm === 2 && omen > 0) drawRays(ctx, main, R, a0, env, g, 1, base * omen);
  if (spec.leader) {
    ctx.globalAlpha = base;
    drawFeathers(ctx, R + 3, c * 0.35, env);
  }

  // Bóng mờ (smear) lúc bung: hai bản sao vành chính lệch góc về phía sau chiều quay.
  if (env.smear > 0) {
    for (const [d, a] of [[0.16, 0.35], [0.32, 0.18]] as const) {
      ctx.globalAlpha = base * a * env.smear * look.shape;
      drawShape(ctx, spec.type, main, R, a0 - d, c, g, 0.6);
    }
  }

  // Vành trong theo hệ phụ (từ Kết Đan), trễ 6 khung so với vành ngoài; Trúc Cơ viên mãn thấp thoáng.
  const inner = realm >= 2 ? (realm === 2 ? look.layer : 1) : omen;
  if (inner > 0) {
    const envIn = envOverride ?? envelope(beat, 6 / FPS);
    const ratio = innerRatio(spec.element, sub);
    const ri = R * 0.62 * (envIn.scale / Math.max(0.01, env.scale));
    ctx.globalAlpha = base * 0.9 * Math.min(1, inner * 1.2);
    ctx.lineWidth = 1 + g * 0.05;
    if (ratio === null) {
      // Đối cực: hai nửa vành hai màu, xoay ngược, có hai chấm âm dương.
      const ai = -a0 * 0.8;
      ctx.strokeStyle = tone(main, 0.2);
      ctx.beginPath();
      ctx.arc(0, 0, ri, ai, ai + Math.PI);
      ctx.stroke();
      ctx.strokeStyle = tone(subColor, 0.2);
      ctx.beginPath();
      ctx.arc(0, 0, ri, ai + Math.PI, ai + Math.PI * 2);
      ctx.stroke();
      for (const [k, col] of [[0, subColor], [Math.PI, main]] as const) {
        ctx.fillStyle = tone(col, 0.3);
        ctx.beginPath();
        ctx.arc(Math.cos(ai + k + Math.PI / 2) * ri * 0.5, Math.sin(ai + k + Math.PI / 2) * ri * 0.5, 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      const ai = a0 * ratio + 0.3;
      ctx.strokeStyle = tone(subColor, 0.25, 0.9);
      ctx.setLineDash([3, 2.2]);
      ctx.lineDashOffset = -ai * ri;
      ctx.beginPath();
      ctx.arc(0, 0, ri, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      // Bốn chấm hệ phụ trên vành trong
      ctx.fillStyle = tone(subColor, 0.45);
      for (let i = 0; i < 4; i++) {
        const a = ai + (i * Math.PI) / 2;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * ri, Math.sin(a) * ri, 1.1, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // Vành chính: nét hệ, khung chạm thì sáng trắng. Trúc Cơ sơ kỳ vành chưa khép, khe hở quay theo vành.
  ctx.globalAlpha = base;
  ctx.lineWidth = 1.2 + g * 0.08 + env.flash;
  ctx.strokeStyle = env.flash ? "#ffffff" : tone(main, 0.15);
  ctx.beginPath();
  const gap = (1 - look.span) * Math.PI * 2;
  ctx.arc(0, 0, R, a0 + gap / 2 - Math.PI / 2, a0 - gap / 2 + Math.PI * 1.5);
  ctx.stroke();
  // Sóng sáng chạy hết một vòng vành mỗi 4 s (120 khung), sáng dần theo cấp.
  const wave = ((c * FPS) % 120) / 120 * Math.PI * 2 + a0;
  ctx.strokeStyle = "rgba(255,255,255,0.75)";
  ctx.lineWidth = 1;
  ctx.globalAlpha = base * (0.4 + 0.6 * gr.progress);
  ctx.beginPath();
  ctx.arc(0, 0, R, wave, wave + 0.6);
  ctx.stroke();

  if (look.shape > 0) {
    ctx.globalAlpha = base * look.shape;
    drawShape(ctx, spec.type, main, R, a0, c, g, 1, env.flash);
  }
  ctx.globalAlpha = base;
  drawMotifs(ctx, spec, look.motifs, R, a0, beat, env, base);
  if (realm >= 3) {
    ctx.globalAlpha = base * (realm === 3 ? look.layer : 1);
    drawParticles(ctx, spec.element, subColor, R, c, g);
  }
  ctx.restore();
}

/**
 * Cuối Luyện Khí (cấp 41–50, đề xuất): chưa có vòng, chỉ có vài đốm khí màu hệ bay theo cung xoắn vào sau lưng, tụ dần
 * thành một vòng mờ đứt đoạn, báo sắp Trúc Cơ. `k` 0 → 1 theo cấp.
 */
function drawGathering(ctx: CanvasRenderingContext2D, el: ElementId, c: number, cx: number, cy: number, r: number, k: number): void {
  if (k <= 0) return;
  const color = ELEMENT_STYLE[el].color;
  const n = 3 + Math.round(3 * k);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = tone(color, 0.45);
  for (let i = 0; i < n; i++) {
    // Mỗi đốm đi một cung xoắn vào: bán kính co dần theo pha; đuôi lấy từ chính đường đi.
    for (let j = 3; j >= 0; j--) {
      const t = c - j * 0.07;
      const ph = (((t * 0.35 + i / n) % 1) + 1) % 1;
      const a = t * 1.1 + (i * Math.PI * 2) / n;
      const rr = r * (1.3 - 0.45 * ph);
      ctx.globalAlpha = Math.min(1, (0.35 + 0.65 * k) * (j === 0 ? 1 : 0.45 - j * 0.1) * Math.sin(Math.PI * ph) * 1.3);
      ctx.beginPath();
      ctx.arc(Math.cos(a) * rr, Math.sin(a) * rr * 0.8, j === 0 ? 1.9 : 1.5 - j * 0.25, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 0.45 * k;
  ctx.strokeStyle = tone(color, 0.3);
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 3]);
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.95, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

/**
 * Nhịp đột phá (thiên kiếp nhỏ, GDD mục 7), khung 30/giây:
 * - 0–20 tụ: vòng cũ co lại, run dần (dùng bao tụ lực);
 * - 20, 30, 40 sét: tia sét đánh từ trên xuống đỉnh vòng, khung chạm trắng, vòng đứng 3 khung;
 * - 44–58 vỡ: vòng cũ gãy thành 8 mảnh bay theo cung trọng lực, đuôi lấy từ đường đi, tàn khi đã xa;
 * - 46–64 hiện: vòng cảnh giới mới nở từ tâm (bao hiện, ký hiệu tới lệch nhịp), sóng xung kích lan ra.
 */
function drawBreakthrough(
  ctx: CanvasRenderingContext2D, spec: PhapLuanSpec, beat: PhapLuanBeat, bt: { age: number; from: number },
  cx: number, cy: number, r: number,
): void {
  const f = bt.age * FPS;
  const oldG = growth(bt.from);
  const newG = growth(spec.level);
  const main = ELEMENT_STYLE[spec.element].color;
  const strike = STRIKES.find((s) => f >= s && f < s + 3);
  if (f < 44) {
    // Đang sét đánh thì vòng cũ đứng ở khung lúc sét chạm (hit-stop), khung đầu sáng trắng.
    const hold = strike !== undefined ? strike / FPS : bt.age;
    const env = envelope({ ...beat, appear: 9, wind: hold, release: undefined, clock: beat.clock - (bt.age - hold) });
    env.shake = Math.min(0.03, 0.012 + f * 0.0008);
    env.flash = strike !== undefined && f < strike + 1 ? 1 : 0;
    if (oldG.realm >= 1) drawLuan(ctx, spec, oldG, beat, cx, cy, r, 1, 0, env);
    else drawGathering(ctx, spec.element, beat.clock, cx, cy, r, 1);
  }
  // Tia sét: đường gấp khúc cố định theo lần đánh, sáng 2 khung.
  for (const [i, s] of STRIKES.entries()) {
    if (f < s || f >= s + 2) continue;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.lineJoin = "round";
    const top = -r * 3.2;
    const pts: [number, number][] = [];
    for (let k = 0; k <= 6; k++) pts.push([k === 6 ? 0 : hash(i * 31 + k) * r * 0.35, top + ((-r - top) * k) / 6]);
    for (const [w, col] of [[4, tone("#8a3ffc", 0.4, 0.55)], [1.6, "#ffffff"]] as const) {
      ctx.strokeStyle = col;
      ctx.lineWidth = w;
      ctx.beginPath();
      pts.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.stroke();
    }
    ctx.restore();
  }
  // Vỡ: tám mảnh vành cũ bay ra theo cung trọng lực, xoay, chỉ tàn khi đã bay xa.
  if (f >= 44 && f < 58) {
    const R = r * growthLook(oldG.realm ? oldG : newG).grow;
    const tt = (f - 44) / FPS;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.strokeStyle = tone(main, 0.15);
    ctx.lineWidth = 1.6;
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4 + 0.2;
      const pos = (t: number): [number, number] => [Math.cos(a) * (R + 26 * t), Math.sin(a) * (R + 26 * t) + 30 * t * t];
      for (let j = 2; j >= 0; j--) {
        const [x, y] = pos(Math.max(0, tt - j * 0.05));
        ctx.globalAlpha = (j === 0 ? 1 : 0.35) * clamp01(1.4 - tt * 3);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(a + Math.PI / 2 + tt * 6 * (i % 2 ? 1 : -1));
        ctx.beginPath();
        ctx.arc(0, R * 0.05, R * 0.3, -0.4, 0.4);
        ctx.stroke();
        ctx.restore();
      }
    }
    ctx.restore();
  }
  // Hiện lại: vòng cảnh giới mới nở từ tâm; sóng xung kích lan ra, khung đầu trắng.
  if (f >= 46) {
    const appear = (f - 46) / FPS;
    drawLuan(ctx, spec, newG, { ...beat, appear, wind: undefined, release: undefined }, cx, cy, r);
    if (f < 64) {
      const k = (f - 46) / 18;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.globalAlpha = 1 - k;
      ctx.strokeStyle = k < 0.1 ? "#ffffff" : tone(main, 0.4);
      ctx.lineWidth = 2.5 * (1 - k) + 0.5;
      ctx.beginPath();
      ctx.arc(0, 0, r * (1 + 1.2 * easeOutCubic(k)), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }
}

/**
 * Ký hiệu hệ quanh vành, số lượng lớn dần theo cấp (`count` lẻ thì ký hiệu cuối đang nở); tới lệch 2 khung mỗi cái lúc
 * hiện; tụ lực thì kéo vào tâm. Ký hiệu chia theo `count` (lẻ cũng được) nên khi thêm một cái, các cái cũ dịch dần chỗ.
 */
function drawMotifs(
  ctx: CanvasRenderingContext2D, spec: PhapLuanSpec, count: number, R: number, a0: number, beat: PhapLuanBeat, env: Envelope, base: number,
): void {
  const n = Math.ceil(count - 1e-6);
  const grow = count - Math.floor(count + 1e-6);
  const slots = Math.max(1, count);
  const size = 2.6 + spec.grade * 0.12;
  const c = beat.clock;
  for (let i = 0; i < n; i++) {
    const arrive = clamp01(((beat.appear - (i * 2) / FPS) * FPS) / 10);
    if (arrive <= 0) continue;
    const a = a0 + (i * Math.PI * 2) / slots;
    const bloom = i === n - 1 && grow > 0 ? easeOutBack(grow, 1.4) : 1;
    let rr = R * (1 - env.pull) * (0.6 + 0.4 * easeOutCubic(arrive));
    let s = size * easeOutBack(arrive, 1.4) * bloom;
    let alpha = 1;
    let rot = a + Math.PI / 2;
    switch (spec.element) {
      case "moc":
        s *= 1 + 0.18 * Math.sin(c * 2 + i * 1.3); // lá thở lệch nhịp
        break;
      case "thuy":
        rr += 1.2 * Math.sin(c * 2.4 - i); // gợn lan
        break;
      case "am_lanh":
        alpha = 0.45 + 0.55 * easeInOutSine((Math.sin(c * 1.2 + i * 2.1) + 1) / 2); // hiện ẩn lệch pha
        break;
      case "cuc_am":
        rot = a + Math.PI / 2 + Math.sin(c * 0.8 + i) * 0.8; // trăng đổi pha
        break;
      case "hoa":
      case "quang":
      case "cuc_duong":
        rot = 0; // lửa và tia sáng luôn hướng lên
        break;
      case "cuc_han":
        s *= 0.85 + 0.25 * easeInOutSine((Math.sin(c * 1.5 + i * 0.9) + 1) / 2); // gai băng mọc ra rút vào
        break;
    }
    drawMotif(ctx, spec.element, Math.cos(a) * rr, Math.sin(a) * rr, s, rot, base * alpha * arrive);
  }
}

/** Hình vành theo loại chiêu của chủ quyển. `k` là độ đậm (bóng mờ dùng nhỏ hơn 1). */
function drawShape(ctx: CanvasRenderingContext2D, type: SkillId, color: string, R: number, a0: number, c: number, g: number, k: number, flash = 0): void {
  const stroke = flash ? "#ffffff" : tone(color, 0.1, k);
  const fill = flash ? "#ffffff" : tone(color, 0.35, k);
  ctx.save();
  ctx.lineWidth = 1 + g * 0.04;
  ctx.strokeStyle = stroke;
  ctx.fillStyle = fill;
  const at = (a: number, d: number) => [Math.cos(a) * d, Math.sin(a) * d] as const;
  switch (type) {
    case "can_don": // bốn kiếm chĩa ra ngoài
      for (let i = 0; i < 4; i++) {
        const a = a0 + Math.PI / 4 + (i * Math.PI) / 2;
        const [x0, y0] = at(a, R + 1);
        const [x1, y1] = at(a, R + 8);
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
        const [gx, gy] = at(a, R + 2.5);
        const [px, py] = [Math.cos(a + Math.PI / 2) * 2, Math.sin(a + Math.PI / 2) * 2];
        ctx.beginPath();
        ctx.moveTo(gx - px, gy - py);
        ctx.lineTo(gx + px, gy + py);
        ctx.stroke();
      }
      break;
    case "can_quet": // hai lưỡi trăng khuyết quét quanh vành
      for (let i = 0; i < 2; i++) {
        const a = a0 * 1.3 + i * Math.PI;
        ctx.beginPath();
        ctx.arc(0, 0, R + 4, a, a + 1.2);
        ctx.arc(0, 0, R + 1.5, a + 1.2, a + 0.1, true);
        ctx.closePath();
        ctx.fill();
      }
      break;
    case "tam_xa": // sáu mũi tên chĩa ra ngoài
      for (let i = 0; i < 6; i++) {
        const a = a0 + (i * Math.PI) / 3 + Math.PI / 6;
        const [tx, ty] = at(a, R + 6);
        const [l, m] = [at(a - 0.14, R + 2), at(a + 0.14, R + 2)];
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(l[0], l[1]);
        ctx.lineTo(m[0], m[1]);
        ctx.closePath();
        ctx.fill();
      }
      break;
    case "dien_rong": { // vành kép rộng, sóng lan ra ngoài
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.arc(0, 0, R + 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      const p = (c * 0.6) % 1;
      ctx.globalAlpha *= 1 - p;
      ctx.beginPath();
      ctx.arc(0, 0, R + 4 + p * 8, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
    case "ho_the": // lục giác hộ thể
      ctx.beginPath();
      for (let i = 0; i <= 6; i++) {
        const [x, y] = at(a0 * 0.5 + (i * Math.PI) / 3, R + 3);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      break;
    case "bua_chu": // bốn lá bùa treo dưới vành, đung đưa như con lắc
      for (let i = 0; i < 4; i++) {
        const a = a0 + (i * Math.PI) / 2;
        const [hx, hy] = at(a, R);
        const swing = 0.35 * Math.sin(c * 2 + i * 1.7);
        ctx.save();
        ctx.translate(hx, hy);
        ctx.rotate(swing);
        ctx.fillStyle = flash ? "#ffffff" : `rgba(243,216,115,${k})`;
        ctx.fillRect(-1.6, 1, 3.2, 6);
        ctx.fillStyle = `rgba(192,40,30,${k})`;
        ctx.fillRect(-0.5, 2, 1, 4);
        ctx.restore();
      }
      break;
    case "tran_phap": // bát quái: bát giác và tám vạch quẻ
      ctx.beginPath();
      for (let i = 0; i <= 8; i++) {
        const [x, y] = at(-a0 * 0.4 + (i * Math.PI) / 4, R + 3);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      for (let i = 0; i < 8; i++) {
        const a = -a0 * 0.4 + (i * Math.PI) / 4 + Math.PI / 8;
        // Ba hào mỗi quẻ: hào liền một nét, hào đứt hai nét (theo bit của số quẻ).
        for (let j = 0; j < 3; j++) {
          const d = R + 5 + j * 1.4;
          ctx.beginPath();
          if (((i >> j) & 1) === 1) {
            ctx.arc(0, 0, d, a - 0.16, a - 0.03);
            ctx.moveTo(Math.cos(a + 0.03) * d, Math.sin(a + 0.03) * d);
            ctx.arc(0, 0, d, a + 0.03, a + 0.16);
          } else {
            ctx.arc(0, 0, d, a - 0.16, a + 0.16);
          }
          ctx.stroke();
        }
      }
      break;
    case "hoi_phuc": // tám cánh sen quanh vành
      for (let i = 0; i < 8; i++) {
        const a = a0 * 0.6 + (i * Math.PI) / 4;
        const open = 1 + 0.12 * Math.sin(c * 1.6 + i);
        ctx.save();
        ctx.rotate(a);
        ctx.translate(R + 1, 0);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(3.5 * open, -2.6, 7 * open, 0);
        ctx.quadraticCurveTo(3.5 * open, 2.6, 0, 0);
        ctx.fill();
        ctx.restore();
      }
      break;
    case "khong_che": // xích: mắt xích so le dọc vành
      for (let i = 0; i < 16; i++) {
        const a = -a0 * 0.7 + (i * Math.PI) / 8;
        const [x, y] = at(a, R + 2.5);
        ctx.beginPath();
        ctx.ellipse(x, y, i % 2 ? 2.2 : 1.2, i % 2 ? 1.2 : 2.2, a, 0, Math.PI * 2);
        ctx.stroke();
      }
      break;
    case "than_phap": // ba vệt gió: đuôi lấy từ chính đường đi của đầu vệt
      for (let i = 0; i < 3; i++) {
        const head = (t: number) => a0 * 2.2 + (i * Math.PI * 2) / 3 + Math.sin(t * 1.3 + i) * 0.2;
        for (let k2 = 0; k2 < 6; k2++) {
          const a = head(c - k2 * 0.05) - k2 * 0.11;
          const [x, y] = at(a, R + 3 + k2 * 0.3);
          ctx.globalAlpha = k * (1 - k2 / 6);
          ctx.beginPath();
          ctx.arc(x, y, 1.6 - k2 * 0.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      break;
  }
  ctx.restore();
}

/** Tia sáng toả (từ Nguyên Anh): 12 tia, dài theo hơi thở. */
function drawRays(ctx: CanvasRenderingContext2D, color: string, R: number, a0: number, env: Envelope, g: number, fill = 1, alpha = 1): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = tone(color, 0.5, 0.55);
  ctx.lineWidth = 0.8;
  // fill < 1 (Nguyên Anh sơ kỳ): tia mọc dần, lần lượt từng tia dài ra.
  for (let i = 0; i < 12; i++) {
    const grown = clamp01(fill * 12 - i);
    if (grown <= 0) continue;
    const a = a0 * 0.5 + (i * Math.PI) / 6;
    const len = (4 + 3 * Math.min(1.5, env.glow) + (i % 2 ? 0 : 2) + g * 0.2) * easeOutCubic(grown);
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * (R + 2), Math.sin(a) * (R + 2));
    ctx.lineTo(Math.cos(a) * (R + 2 + len), Math.sin(a) * (R + 2 + len));
    ctx.stroke();
  }
  ctx.restore();
}

/** Quầng ngoài (Hóa Thần): vành nhật hoa phập phồng và vệt sáng quét quanh. */
function drawCorona(ctx: CanvasRenderingContext2D, el: ElementId, color: string, R: number, c: number, env: Envelope, alpha = 1): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = tone(color, 0.3, 0.22 * Math.min(1.5, env.glow));
  ctx.beginPath();
  for (let i = 0; i <= 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    const bump = 1 + 0.06 * Math.sin(a * 8 + c * (el === "cuc_duong" ? 3 : 1.5)) + 0.03 * Math.sin(a * 13 - c * 2);
    const rr = (R + 12) * bump;
    if (i === 0) ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
    else ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.arc(0, 0, R + 3, Math.PI * 2, 0, true);
  ctx.fill();
  const sweep = c * 1.1;
  ctx.strokeStyle = "rgba(255,255,255,0.6)";
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(0, 0, R + 9, sweep, sweep + 0.9);
  ctx.stroke();
  ctx.restore();
}

/** Lông vũ vàng của tông chủ quanh vành ngoài. */
function drawFeathers(ctx: CanvasRenderingContext2D, R: number, a0: number, env: Envelope): void {
  ctx.save();
  for (let i = 0; i < 12; i++) {
    const a = a0 + (i * Math.PI) / 6;
    ctx.save();
    ctx.rotate(a);
    ctx.fillStyle = i % 2 ? "#fff1b8" : "#f2c230";
    ctx.globalAlpha = 0.95;
    const l = 7 + 1.5 * Math.min(1.5, env.glow);
    ctx.beginPath();
    ctx.moveTo(R, -1.6);
    ctx.quadraticCurveTo(R + l * 0.6, -2.4, R + l, 0);
    ctx.quadraticCurveTo(R + l * 0.6, 2.4, R, 1.6);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

/** Hạt bay theo cung (từ Nguyên Anh): quỹ đạo elip quanh vành, đuôi lấy mẫu từ vị trí ở các thời điểm trước; Hỏa là tàn lửa bay lên rồi cong. */
function drawParticles(ctx: CanvasRenderingContext2D, el: ElementId, color: string, R: number, c: number, g: number): void {
  const n = 4 + Math.round(g / 2);
  const pos = (i: number, t: number): [number, number, number] => {
    if (el === "hoa" || el === "cuc_duong") {
      // Tàn lửa: sinh trên vành, bay lên, trôi ngang theo cung, tàn ở đỉnh.
      const p = (t * 0.45 + i / n) % 1;
      const a = (i * 2.4) % (Math.PI * 2);
      const x = Math.cos(a) * R + Math.sin(p * Math.PI) * (i % 2 ? 5 : -5);
      const y = Math.sin(a) * R * 0.6 - p * 22 + p * p * 6;
      return [x, y, 1 - p];
    }
    const a = t * (0.9 + (i % 3) * 0.2) + (i * Math.PI * 2) / n;
    const rr = R + 5 + 2 * Math.sin(t * 1.7 + i);
    return [Math.cos(a) * rr, Math.sin(a) * rr * 0.55, 1];
  };
  ctx.save();
  ctx.fillStyle = tone(color, 0.45);
  for (let i = 0; i < n; i++) {
    for (let k = 3; k >= 0; k--) {
      const [x, y, life] = pos(i, c - k * 0.06);
      ctx.globalAlpha = (k === 0 ? 0.95 : 0.4 - k * 0.09) * life;
      ctx.beginPath();
      ctx.arc(x, y, (k === 0 ? 1.4 : 1.1 - k * 0.2) + g * 0.03, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

// ---- soát ----

/**
 * Dò mọi khung của các nhịp (docs/PHAP_LUAN.md, bước soát 2). Trả danh sách lỗi; rỗng là đạt:
 * vòng thở nối liền, không nhảy lớn giữa hai khung liền nhau (trừ khung chạm), scale trong 0,85–1,2.
 */
export function probe(): string[] {
  const errors: string[] = [];
  const at = (b: Partial<PhapLuanBeat> & { clock: number }) => envelope({ appear: 10, ...b });
  // 1. Vòng thở: khung 119 và khung 0 (= 120) gần như trùng.
  const e119 = at({ clock: 119 / FPS }).scale;
  const e120 = at({ clock: 120 / FPS }).scale;
  const e121 = at({ clock: 121 / FPS }).scale;
  if (Math.abs(e120 - e119) > 0.004 || Math.abs(e121 - e120) > 0.004) errors.push(`vòng thở giật: ${e119} ${e120} ${e121}`);
  // 2. Chuỗi vận công 20 khung rồi phát, dò từng khung.
  const seq: { f: number; e: Envelope }[] = [];
  for (let f = 0; f < 20; f++) seq.push({ f, e: at({ clock: f / FPS, wind: f / FPS }) });
  for (let f = 0; f < 40; f++) seq.push({ f: 20 + f, e: at({ clock: (20 + f) / FPS, release: f / FPS }) });
  for (let f = 60; f < 70; f++) seq.push({ f, e: at({ clock: f / FPS }) });
  for (let i = 1; i < seq.length; i++) {
    const d = Math.abs(seq[i].e.scale - seq[i - 1].e.scale);
    const releaseFrame = seq[i].f - 20;
    const allowed = releaseFrame >= 0 && releaseFrame <= 4 ? 0.12 : 0.05; // lúc bung (4 khung) được nhảy nhanh
    if (d > allowed) errors.push(`khung ${seq[i].f}: scale nhảy ${d.toFixed(3)}`);
  }
  for (const { f, e } of seq) if (e.scale < 0.85 || e.scale > 1.2) errors.push(`khung ${f}: scale ${e.scale.toFixed(3)} ngoài 0,85–1,2`);
  // 3. Hiện: tăng dần rồi vượt và về 1.
  const appear = [0, 6, 12, 18, 24].map((f) => envelope({ appear: f / FPS, clock: 0 }).scale);
  if (!(appear[0] === 0 && appear[2] > 1 && Math.abs(appear[4] - 1) < 0.001)) errors.push(`nhịp hiện lạ: ${appear.map((v) => v.toFixed(2)).join(" ")}`);
  // 4. Tăng trưởng: từ cấp 51 tới 250 (bước 0,25 cấp), vòng không nhỏ lại, ký hiệu không bớt, không nhảy lớn kể cả qua mốc cảnh giới.
  let prev = growthLook(growth(51));
  for (let lv = 51.25; lv <= 250; lv += 0.25) {
    const cur = growthLook(growth(lv));
    if (cur.grow < prev.grow - 1e-9) errors.push(`cấp ${lv}: bán kính nhỏ lại`);
    if (cur.motifs < prev.motifs - 1e-9) errors.push(`cấp ${lv}: bớt ký hiệu`);
    if (cur.grow - prev.grow > 0.02) errors.push(`cấp ${lv}: bán kính nhảy ${(cur.grow - prev.grow).toFixed(3)}`);
    if (cur.motifs - prev.motifs > 0.2) errors.push(`cấp ${lv}: ký hiệu nhảy ${(cur.motifs - prev.motifs).toFixed(2)}`);
    prev = cur;
  }
  // 5. Độ đậm (quiet): tụ lực rồi phát rồi lắng, không nhảy quá 0,15 mỗi khung, về 0 khi hết lắng.
  let act = 0;
  for (let f = 0; f < 60; f++) {
    const b: PhapLuanBeat = f < 20 ? { appear: 9, clock: f / FPS, wind: f / FPS } : { appear: 9, clock: f / FPS, release: (f - 20) / FPS };
    const a = activity(b);
    if (Math.abs(a - act) > 0.15 && f !== 0) errors.push(`khung ${f}: độ đậm nhảy ${(a - act).toFixed(2)}`);
    act = a;
  }
  if (activity({ appear: 9, clock: 3, release: 1 }) !== 0) errors.push("độ đậm không về 0 sau lắng");
  // 6. Đột phá: khung 0 của nhịp tụ trùng với vòng đang thở (bao tụ lực ở 0 bằng bao thường).
  const idle = envelope({ appear: 9, clock: 2 });
  const tu0 = envelope({ appear: 9, clock: 2, wind: 0 });
  if (Math.abs(idle.scale - tu0.scale) > 1e-9) errors.push("đột phá: khung 0 giật so với lúc thở");
  return errors;
}

/**
 * Nhớ cấp đã thấy của một chỗ vẽ (ví dụ canvas của màn Nhân vật) để diễn nhịp lên cấp hay đột phá khi cấp đổi.
 * Dùng cho màn không có dòng thời gian (Nhân vật); màn Trận không cần vì cấp không đổi trong trận.
 * `now` giây (performance.now() / 1000). Trả phần nhịp: lúc hiện, lên cấp, đột phá.
 */
const seenLevel = new WeakMap<object, { level: number; shown: number; at: number; kind: "hien" | "len_cap" | "dot_pha"; from: number }>();
export function trackLevel(key: object, level: number, now: number): Pick<PhapLuanBeat, "appear" | "levelUp" | "breakthrough"> {
  let s = seenLevel.get(key);
  if (!s) {
    s = { level, shown: level, at: now, kind: "hien", from: level };
    seenLevel.set(key, s);
  } else if (level !== s.level) {
    const kind = realmOf(level) > realmOf(s.level) ? "dot_pha" : "len_cap";
    s = { level, shown: level, at: now, kind, from: s.level };
    seenLevel.set(key, s);
  }
  const age = now - s.at;
  if (s.kind === "dot_pha") return { appear: 9, breakthrough: { age, from: s.from } };
  if (s.kind === "len_cap") return { appear: 9, levelUp: { age, from: s.from } };
  return { appear: age };
}

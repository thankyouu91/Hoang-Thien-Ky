// Chỉ số trang bị và ngọc khảm (đặc tả của phiên set đồ; số trong data/trang_bi, mọi số là đề xuất).
// Món: chỉ số chính và phụ của ô × độ hiếm × (1 + 3% mỗi nấc) × (1 + thưởng bí cảnh). Độ bền 0 thì món không cộng gì.
// Ngọc: ô "công" cộng sát thương cho công pháp cùng hệ chủ, ô "thủ" cộng kháng hệ; trùng linh căn ×1,2.
// Ấn bộ và Ý châu chiếm dòng khảm nhưng tính ở bước set và Ý châu.
import { baseStats, mul, BATTLE, type Element, type BuffStat, type UnitSpec } from "@ktlp/sim";
import TRANG_BI from "../../../data/trang_bi/trang_bi.json" with { type: "json" };
import NGOC from "../../../data/trang_bi/ngoc.json" with { type: "json" };
import { GEAR } from "./config.ts";

export type SlotId = "vu_khi" | "mu" | "ao" | "dai" | "bao_tay" | "giay" | "ngoc_boi";
export type RarityId = "luc" | "lam" | "tim" | "vang" | "do";
/** Một dòng khảm: ngọc hệ, ấn bộ (set), Ý châu (chỉ vũ khí), hoặc dòng trống. */
export type InlayLine = { loai: "ngoc"; he: Element; cap: number } | { loai: "an"; ma: string } | { loai: "y_chau"; ma: string } | null;

/** Một món cụ thể đang mặc. Ô và độ hiếm lấy theo kiểu trong trang_bi.json. */
export interface EquipItem {
  kieu: string; // mã kiểu, ví dụ "TB-KI-001"
  nac: number; // cường hóa +0 … +50
  doBen: number; // độ bền 0–100
  biCanh: number; // thưởng bí cảnh 40–80 (phần nghìn), 0 nếu không phải đồ bí cảnh
  kham: InlayLine[];
}

/** Tổng cộng của bộ đồ đang mặc. hp, atk, def, manaMax là số cộng thẳng; bonuses theo phần nghìn như UnitBonuses. */
export interface GearStats {
  hp: number;
  atk: number;
  def: number;
  manaMax: number;
  bonuses: Partial<Record<BuffStat, number>>;
  resist: Partial<Record<Element, number>>;
  elementDamage: Partial<Record<Element, number>>;
}

interface SlotRow { id: string; chinh: { stat: string; gia_tri: number }; phu: { stat: string; gia_tri: number }; ngoc: string }
interface RarityRow { id: string; he_so: number; dong_kham: number }
interface KieuRow { ma_vp: string; o: string; do_hiem: string; ten: string }

const SLOTS: Record<string, SlotRow> = {};
for (const o of TRANG_BI.o as SlotRow[]) SLOTS[o.id] = o;
const RARITIES: Record<string, RarityRow> = {};
for (const r of TRANG_BI.do_hiem as RarityRow[]) RARITIES[r.id] = r;
const KIEU: Record<string, KieuRow> = {};
for (const k of TRANG_BI.kieu as KieuRow[]) KIEU[k.ma_vp] = k;
const GEM_VALUE: number[] = (NGOC.cap as { gia_tri: number }[]).map((c) => c.gia_tri);

/** Chỉ số cộng thẳng theo chỉ số chuẩn cùng cấp; các chỉ số khác là phần nghìn cộng vào UnitBonuses. */
const FLAT = ["hp", "atk", "def", "manaMax"];

export function kieuInfo(ma: string): { o: SlotId; doHiem: RarityId; ten: string } {
  const k = Object.prototype.hasOwnProperty.call(KIEU, ma) ? KIEU[ma] : undefined;
  if (!k) throw new Error(`Không có kiểu trang bị ${ma}`);
  return { o: k.o as SlotId, doHiem: k.do_hiem as RarityId, ten: k.ten };
}

/** Số dòng khảm tối đa của một món: theo độ hiếm, đồ bí cảnh thêm tối đa 2, không quá 5. */
export function maxInlayLines(item: EquipItem): number {
  const r = RARITIES[kieuInfo(item.kieu).doHiem];
  return Math.min(GEAR.maxLines, r.dong_kham + (item.biCanh > 0 ? GEAR.secretExtraLines : 0));
}

function validate(item: EquipItem): void {
  if (item.nac !== Math.floor(item.nac) || item.nac < 0 || item.nac > GEAR.maxEnhance) throw new Error(`${item.kieu}: nấc cường hóa ${item.nac} sai`);
  if (item.doBen < 0 || item.doBen > 100) throw new Error(`${item.kieu}: độ bền ${item.doBen} sai`);
  if (item.biCanh !== 0 && (item.biCanh < GEAR.secretBonusMin || item.biCanh > GEAR.secretBonusMax)) throw new Error(`${item.kieu}: thưởng bí cảnh ${item.biCanh} sai`);
  if (item.kham.length > maxInlayLines(item)) throw new Error(`${item.kieu}: quá số dòng khảm`);
  for (const line of item.kham) {
    if (line && line.loai === "ngoc" && (line.cap < 1 || line.cap > GEM_VALUE.length)) throw new Error(`${item.kieu}: ngọc cấp ${line.cap} sai`);
  }
}

/** Hệ số nhân của một món theo phần nghìn: độ hiếm × (1 + 3% mỗi nấc) × (1 + thưởng bí cảnh). */
function itemFactor(item: EquipItem): number {
  const r = RARITIES[kieuInfo(item.kieu).doHiem];
  return mul(mul(r.he_so, 1000 + GEAR.enhancePerLevel * item.nac), 1000 + item.biCanh);
}

function statAmount(stat: string, giaTri: number, factor: number, level: number): number {
  if (FLAT.indexOf(stat) < 0) return mul(giaTri, factor);
  const base = stat === "manaMax" ? BATTLE.manaMax : baseStats(level)[stat as "hp" | "atk" | "def"];
  return Math.trunc((base * giaTri * factor) / 1_000_000);
}

/** Cộng chỉ số chính, phụ và ngọc của các món đang mặc (mỗi ô tối đa một món). */
export function gearStats(items: EquipItem[], level: number, roots: Element[]): GearStats {
  const out: GearStats = { hp: 0, atk: 0, def: 0, manaMax: 0, bonuses: {}, resist: {}, elementDamage: {} };
  const used: string[] = [];
  for (const item of items) {
    validate(item);
    const info = kieuInfo(item.kieu);
    if (used.indexOf(info.o) >= 0) throw new Error(`Hai món cùng ô ${info.o}`);
    used.push(info.o);
    if (item.doBen <= 0) continue;
    const slot = SLOTS[info.o];
    const factor = itemFactor(item);
    for (const part of [slot.chinh, slot.phu]) {
      const v = statAmount(part.stat, part.gia_tri, factor, level);
      if (FLAT.indexOf(part.stat) >= 0) out[part.stat as "hp" | "atk" | "def" | "manaMax"] += v;
      else out.bonuses[part.stat as BuffStat] = (out.bonuses[part.stat as BuffStat] ?? 0) + v;
    }
    for (const line of item.kham) {
      if (!line || line.loai !== "ngoc") continue;
      let v = GEM_VALUE[line.cap - 1];
      if (roots.indexOf(line.he) >= 0) v = mul(v, GEAR.rootGemBonus);
      const target = slot.ngoc === "cong" ? out.elementDamage : out.resist;
      target[line.he] = (target[line.he] ?? 0) + v;
    }
  }
  return out;
}

/** Áp bộ đồ vào một đơn vị trong trận; linh căn lấy từ `element` và `element2` của đơn vị. */
export function withGear(spec: UnitSpec, items: EquipItem[]): UnitSpec {
  const roots = spec.element2 ? [spec.element, spec.element2] : [spec.element];
  const g = gearStats(items, spec.level, roots);
  const bonuses: Partial<Record<BuffStat, number>> = { ...spec.bonuses };
  for (const k of Object.keys(g.bonuses) as BuffStat[]) bonuses[k] = (bonuses[k] ?? 0) + (g.bonuses[k] ?? 0);
  const resist: Partial<Record<Element, number>> = { ...spec.resist };
  for (const e of Object.keys(g.resist) as Element[]) resist[e] = (resist[e] ?? 0) + (g.resist[e] ?? 0);
  const elementDamage: Partial<Record<Element, number>> = { ...spec.elementDamage };
  for (const e of Object.keys(g.elementDamage) as Element[]) elementDamage[e] = (elementDamage[e] ?? 0) + (g.elementDamage[e] ?? 0);
  return {
    ...spec,
    hp: spec.hp + g.hp,
    atk: spec.atk + g.atk,
    def: spec.def + g.def,
    manaMax: (spec.manaMax ?? BATTLE.manaMax) + g.manaMax,
    bonuses, resist, elementDamage,
  };
}

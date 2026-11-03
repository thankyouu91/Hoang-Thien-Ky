// Chỉ số trang bị và ngọc khảm (đặc tả của phiên set đồ; mọi số là đề xuất). Số đọc từ data/he_thong/json,
// xuất từ file Excel số liệu bằng tools/data/xuat.ts: đổi số thì sửa Excel rồi xuất lại.
// Món: chỉ số chính và phụ của ô × độ hiếm × (1 + 3% mỗi nấc) × (1 + thưởng bí cảnh). Độ bền 0 thì món không cộng gì.
// Ngọc: ô "công" cộng sát thương cho công pháp cùng hệ chủ, ô "thủ" cộng kháng hệ; trùng linh căn ×1,2.
// Set: ấn bộ khảm ở một dòng; đủ 2/4/7 món cùng ấn (còn độ bền) thì mở mốc. Bước này áp hiệu ứng loại chi_so;
// các loại khác (kinh tế, hành vi, khắc chế, hộ trận) chỉ được liệt kê trong `sets` để các bước sau dùng.
// Ý châu: chỉ khảm vũ khí, mỗi vũ khí 1 viên; đổi hành vi một loại chiêu cho mọi công pháp loại đó (sim: UnitSpec.skillMods).
import {
  baseStats, mul, ONE, BATTLE, ELEMENTS,
  type Element, type BuffStat, type UnitSpec, type SkillType, type SkillMod, type TargetPick,
} from "@ktlp/sim";
import TRANG_BI from "../../../data/he_thong/json/trang_bi.json" with { type: "json" };
import NGOC from "../../../data/he_thong/json/ngoc.json" with { type: "json" };
import SET from "../../../data/he_thong/json/set.json" with { type: "json" };
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
  dongThem: number; // dòng khảm thêm của đồ bí cảnh, 1 hoặc 2 (quay khi rơi); 0 nếu không phải đồ bí cảnh
  kham: InlayLine[];
}

/** Một hiệu ứng set như trong set.json. */
export interface SetEffect { so: number; loai: string; mo_ta: string; tham_so: Record<string, number | boolean> }
/** Một bộ đang mở: bộ nào, mấy món, mốc cao nhất đạt được và hiệu ứng của mọi mốc đã đạt. */
export interface ActiveSet {
  bo: string;
  mon: number;
  moc: number;
  hieuUng: SetEffect[];
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
  /** Các bộ đang mở, theo id bộ. */
  sets: ActiveSet[];
  /** Chỉ số từ set không dùng trong trận (thú cưỡi, pháp bảo, đan dược), phần nghìn, theo khóa trong set.json. */
  outside: Record<string, number>;
  /** Hành vi theo loại chiêu từ Ý châu trên vũ khí. */
  skillMods: Partial<Record<SkillType, SkillMod>>;
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
interface YChauRow { ma_vp: string; loai_chieu: string; chi_kham_vao: string; tham_so: Record<string, number | string> }
const Y_CHAU: Record<string, YChauRow> = {};
for (const y of NGOC.y_chau as unknown as YChauRow[]) Y_CHAU[y.ma_vp] = y;
/** Cách chọn mục tiêu trong ngoc.json → trong sim. */
const PICKS: Record<string, TargetPick> = {
  bi_nham_nhieu_nhat: "most_targeted", mau_thap_nhat: "lowest_hp", dang_van_cong: "channeling", hang_sau_mau_thap_nhat: "back_row_lowest_hp",
};
interface SetRow { id: string; an: string; moc: SetEffect[] }
const SETS: Record<string, SetRow> = {};
const SEAL_SET: Record<string, string> = {}; // mã ấn → id bộ
for (const b of SET.bo as unknown as SetRow[]) {
  SETS[b.id] = b;
  SEAL_SET[b.an] = b.id;
}

/**
 * Khóa tham_so của hiệu ứng chi_so đổi sang chỉ số trận; kháng hệ đổi sang kháng; khóa ngoài trận giữ nguyên tên.
 * hp, atk, def, manaMax của set là % trên chỉ số chuẩn theo cấp, đổi thành số cộng thẳng, không nhân theo đồ (set không tăng
 * theo cường hóa, độ hiếm, cấp đồ: tab Trang bị, phần 6, luật 4).
 */
const SET_STAT: Record<string, BuffStat> = {
  healTaken: "healTaken", healPower: "healPower", controlTime: "controlTime", critBonus: "critBonus", critDamage: "critDamage",
  khienNhan: "shieldTaken", satThuongPvE: "monsterDamage", xuyenGiap: "armorPen", teLietTicks: "paralyzeTicks", bayTranTicks: "formationTicks",
};
const SET_RESIST: Record<string, Element[]> = { khangLoi: ["loi"], khangMoiHe: ELEMENTS.slice() };
const SET_OUTSIDE = ["hoiChieuKichPhat", "kichPhat", "linhLucPhapBao", "danTuDung"];
const has = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);

/** Khóa chỉ số của set có chỗ áp không: trong trận, kháng, hoặc ngoài trận. */
export function isKnownSetStat(key: string): boolean {
  return FLAT.indexOf(key) >= 0 || has(SET_STAT, key) || has(SET_RESIST, key) || SET_OUTSIDE.indexOf(key) >= 0;
}

/** Mốc đạt được với n món cùng ấn: 3 món tính mốc 2, 5–6 món tính mốc 4; dưới 2 món là 0. */
export function setTier(count: number): number {
  let tier = 0;
  for (const m of SET.moc as number[]) if (count >= m) tier = m;
  return tier;
}

/** Chỉ số cộng thẳng theo chỉ số chuẩn cùng cấp; các chỉ số khác là phần nghìn cộng vào UnitBonuses. */
const FLAT = ["hp", "atk", "def", "manaMax"];

export function kieuInfo(ma: string): { o: SlotId; doHiem: RarityId; ten: string } {
  const k = Object.prototype.hasOwnProperty.call(KIEU, ma) ? KIEU[ma] : undefined;
  if (!k) throw new Error(`Không có kiểu trang bị ${ma}`);
  return { o: k.o as SlotId, doHiem: k.do_hiem as RarityId, ten: k.ten };
}

/** Số dòng khảm tối đa của một món: theo độ hiếm, cộng dòng thêm của đồ bí cảnh, không quá 5. */
export function maxInlayLines(item: EquipItem): number {
  const r = RARITIES[kieuInfo(item.kieu).doHiem];
  return Math.min(GEAR.maxLines, r.dong_kham + item.dongThem);
}

function validate(item: EquipItem): void {
  if (item.nac !== Math.floor(item.nac) || item.nac < 0 || item.nac > GEAR.maxEnhance) throw new Error(`${item.kieu}: nấc cường hóa ${item.nac} sai`);
  if (item.doBen < 0 || item.doBen > 100) throw new Error(`${item.kieu}: độ bền ${item.doBen} sai`);
  if (item.biCanh !== 0 && (item.biCanh < GEAR.secretBonusMin || item.biCanh > GEAR.secretBonusMax)) throw new Error(`${item.kieu}: thưởng bí cảnh ${item.biCanh} sai`);
  const extraOk = item.biCanh === 0 ? item.dongThem === 0 : item.dongThem >= 1 && item.dongThem <= GEAR.secretExtraLines;
  if (!extraOk) throw new Error(`${item.kieu}: dòng khảm thêm ${item.dongThem} sai`);
  if (item.kham.length > maxInlayLines(item)) throw new Error(`${item.kieu}: quá số dòng khảm`);
  let seals = 0;
  let yChau = 0;
  for (const line of item.kham) {
    if (line && line.loai === "ngoc" && (line.cap < 1 || line.cap > GEM_VALUE.length)) throw new Error(`${item.kieu}: ngọc cấp ${line.cap} sai`);
    if (line && line.loai === "an") {
      if (!has(SEAL_SET, line.ma)) throw new Error(`${item.kieu}: không có ấn bộ ${line.ma}`);
      seals++;
    }
    if (line && line.loai === "y_chau") {
      if (!has(Y_CHAU, line.ma)) throw new Error(`${item.kieu}: không có Ý châu ${line.ma}`);
      if (Y_CHAU[line.ma].chi_kham_vao !== kieuInfo(item.kieu).o) throw new Error(`${item.kieu}: ${line.ma} chỉ khảm vào ${Y_CHAU[line.ma].chi_kham_vao}`);
      yChau++;
    }
  }
  if (seals > 1) throw new Error(`${item.kieu}: mỗi món giữ tối đa 1 ấn bộ`);
  if (yChau > GEAR.maxYChau) throw new Error(`${item.kieu}: mỗi vũ khí khảm tối đa ${GEAR.maxYChau} Ý châu`);
}

/** Đổi tham_so của một Ý châu trong ngoc.json thành cách chỉnh loại chiêu của sim. */
export function yChauMod(ma: string): { loai: SkillType; mod: SkillMod } {
  if (!has(Y_CHAU, ma)) throw new Error(`Không có Ý châu ${ma}`);
  const y = Y_CHAU[ma];
  const loai = y.loai_chieu as SkillType;
  return { loai, mod: toSkillMod(loai, y.tham_so, ma) };
}

/** Đổi bộ tham_so của Ý châu cho loại chiêu `loai` thành SkillMod; `ma` chỉ để báo lỗi. */
export function toSkillMod(loai: SkillType, thamSo: Record<string, number | string>, ma: string): SkillMod {
  const mod: SkillMod = {};
  for (const key of Object.keys(thamSo)) {
    const v = thamSo[key];
    const num = (): number => {
      if (typeof v !== "number") throw new Error(`${ma}: ${key} phải là số`);
      return v;
    };
    if (key === "xuyenKhien") mod.shieldPierce = num();
    else if (key === "themMucTieu") mod.extraTargets = num();
    else if (key === "heSoMucTieuThem") mod.extraTargetDamage = num();
    else if (key === "tamMilliO") mod.rangeBonus = num();
    else if (key === "vanCongTicks" || key === "bayTranTicks") mod.castTicks = num();
    else if (key === "soLan") mod.pickUses = num();
    else if (key === "tranThanhKhien") mod.overhealShield = num();
    else if (key === "khienTicks") mod.overhealShieldTicks = num();
    else if (key === "heSoMana") {
      if (loai !== "hoi_phuc") throw new Error(`${ma}: heSoMana chỉ dùng cho hồi phục`);
      mod.manaCost = Math.trunc((num() * ONE) / GEAR.healManaTimes);
    } else if (key === "chonMucTieu") {
      if (typeof v !== "string" || !has(PICKS, v)) throw new Error(`${ma}: chưa biết cách chọn mục tiêu ${v}`);
      mod.pick = PICKS[v];
    } else throw new Error(`${ma}: chưa biết áp ${key}`);
  }
  return mod;
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
  const out: GearStats = { hp: 0, atk: 0, def: 0, manaMax: 0, bonuses: {}, resist: {}, elementDamage: {}, sets: [], outside: {}, skillMods: {} };
  const used: string[] = [];
  const pieces: Record<string, number> = {}; // id bộ → số món còn độ bền mang ấn bộ đó
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
      if (line && line.loai === "an") pieces[SEAL_SET[line.ma]] = (pieces[SEAL_SET[line.ma]] ?? 0) + 1;
      if (line && line.loai === "y_chau") {
        const y = yChauMod(line.ma);
        out.skillMods[y.loai] = y.mod;
      }
      if (!line || line.loai !== "ngoc") continue;
      let v = GEM_VALUE[line.cap - 1];
      if (roots.indexOf(line.he) >= 0) v = mul(v, GEAR.rootGemBonus);
      const target = slot.ngoc === "cong" ? out.elementDamage : out.resist;
      target[line.he] = (target[line.he] ?? 0) + v;
    }
  }
  // 7 ô, mỗi món tối đa 1 ấn, nên tối đa 3 bộ cùng mở (2+2+2 hoặc 2+2+3) và chỉ một bộ đạt mốc 7.
  for (const bo of Object.keys(pieces).sort()) {
    const moc = setTier(pieces[bo]);
    if (moc === 0) continue;
    const hieuUng = SETS[bo].moc.filter((m) => m.so <= moc);
    out.sets.push({ bo, mon: pieces[bo], moc, hieuUng });
    for (const m of hieuUng) if (m.loai === "chi_so") addSetStats(out, bo, m.tham_so, level);
  }
  return out;
}

/** Cộng một hiệu ứng chi_so của set vào chỉ số cộng thẳng, chỉ số trận, kháng, hoặc chỉ số ngoài trận. */
function addSetStats(out: GearStats, bo: string, params: Record<string, number | boolean>, level: number): void {
  for (const key of Object.keys(params)) {
    const v = params[key];
    if (typeof v !== "number") throw new Error(`Set ${bo}: ${key} không phải số`);
    if (FLAT.indexOf(key) >= 0) out[key as "hp" | "atk" | "def" | "manaMax"] += statAmount(key, v, ONE, level);
    else if (has(SET_STAT, key)) out.bonuses[SET_STAT[key]] = (out.bonuses[SET_STAT[key]] ?? 0) + v;
    else if (has(SET_RESIST, key)) for (const e of SET_RESIST[key]) out.resist[e] = (out.resist[e] ?? 0) + v;
    else if (SET_OUTSIDE.indexOf(key) >= 0) out.outside[key] = (out.outside[key] ?? 0) + v;
    else throw new Error(`Set ${bo}: chưa biết áp chỉ số ${key}`);
  }
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
    skillMods: { ...spec.skillMods, ...g.skillMods },
  };
}

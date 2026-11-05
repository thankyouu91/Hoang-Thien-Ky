// Tầng công pháp (GDD mục 6: "Mỗi công pháp có 10 tầng; tầng tăng bằng tu luyện và cống hiến"). Bảng số là đề xuất 2026-11-05
// của phiên Bảng Điểm (ghi chú tang-cong-phap.md); dữ liệu data/he_thong/json/tang_cong_phap.json chưa có thì dùng TANG_DU_PHONG.
// Điểm luyện là quỹ chung của nhân vật: mỗi cấp +diemLuyenMoiCap; điểm đang có = (cấp − 1) × diemLuyenMoiCap trừ giá các tầng
// đã lên của mọi công pháp đã học, nên không cần trường lưu riêng.
import { GRADE_POW, mul, ONE, type Technique } from "@ktlp/sim";
import THAM_SO from "../../../data/he_thong/json/tham_so.json" with { type: "json" };
import { RULES } from "./config.ts";
import type { GameState, LearnedTechnique, Member } from "./state.ts";
import type { Result } from "./apply.ts";

/** Một tầng: uy lực, giảm hồi chiêu, giảm mana (phần nghìn cộng dồn so với tầng 1); giá lên tầng này ở phẩm Phàm. */
export interface LayerRow { tang: number; uyLuc: number; hoiChieu: number; mana: number; diemLuyen: number; congHien: number }

const TANG_DU_PHONG: LayerRow[] = [
  { tang: 1, uyLuc: 0, hoiChieu: 0, mana: 0, diemLuyen: 0, congHien: 0 },
  { tang: 2, uyLuc: 25, hoiChieu: 0, mana: 0, diemLuyen: 10, congHien: 0 },
  { tang: 3, uyLuc: 50, hoiChieu: 0, mana: 0, diemLuyen: 20, congHien: 0 },
  { tang: 4, uyLuc: 75, hoiChieu: 0, mana: 50, diemLuyen: 30, congHien: 1 },
  { tang: 5, uyLuc: 100, hoiChieu: 0, mana: 50, diemLuyen: 40, congHien: 1 },
  { tang: 6, uyLuc: 125, hoiChieu: 0, mana: 50, diemLuyen: 50, congHien: 2 },
  { tang: 7, uyLuc: 150, hoiChieu: 0, mana: 100, diemLuyen: 60, congHien: 2 },
  { tang: 8, uyLuc: 175, hoiChieu: 0, mana: 100, diemLuyen: 70, congHien: 3 },
  { tang: 9, uyLuc: 200, hoiChieu: 0, mana: 100, diemLuyen: 80, congHien: 4 },
  { tang: 10, uyLuc: 250, hoiChieu: 50, mana: 100, diemLuyen: 90, congHien: 5 },
];
/** Bảng tầng đang dùng; thay bằng dữ liệu khi có (setLayerTable). */
let TANG: LayerRow[] = TANG_DU_PHONG;
const CP = THAM_SO.cong_phap as { techniqueLayers: number; diemLuyenMoiCap?: number };
/** Số tầng tối đa của một công pháp (tham_so.json cong_phap.techniqueLayers). */
export const TECHNIQUE_LAYERS = CP.techniqueLayers;
/** Điểm luyện mỗi lần lên cấp (tham_so.json cong_phap.diemLuyenMoiCap; chưa có thì 20, đề xuất 2026-11-05). */
export const DIEM_LUYEN_MOI_CAP = CP.diemLuyenMoiCap ?? 20;

/** Thay bảng tầng (dữ liệu tang_cong_phap.json); cần đúng TECHNIQUE_LAYERS dòng, tầng 1 cộng 0. */
export function setLayerTable(rows: LayerRow[]): void {
  if (rows.length !== TECHNIQUE_LAYERS) throw new Error(`Bảng tầng cần ${TECHNIQUE_LAYERS} dòng`);
  rows.forEach((r, i) => {
    if (r.tang !== i + 1) throw new Error(`Bảng tầng: dòng ${i + 1} ghi tầng ${r.tang}`);
  });
  const t1 = rows[0];
  if (t1.uyLuc || t1.hoiChieu || t1.mana) throw new Error("Tầng 1 không cộng gì");
  TANG = rows.slice();
}

function row(layer: number): LayerRow {
  if (layer !== Math.floor(layer) || layer < 1 || layer > TECHNIQUE_LAYERS) throw new Error(`Tầng ${layer} sai`);
  return TANG[layer - 1];
}

/** Mức cộng của một tầng so với tầng 1, phần nghìn: uy lực (sát thương, lượng hồi, khiên), giảm hồi chiêu, giảm mana. */
export function layerBonus(layer: number): { uyLuc: number; hoiChieu: number; mana: number } {
  const r = row(layer);
  return { uyLuc: r.uyLuc, hoiChieu: r.hoiChieu, mana: r.mana };
}

/**
 * Giá lên tầng `nextLayer` (2…TECHNIQUE_LAYERS) cho công pháp phẩm `grade`: điểm luyện = giá Phàm × hệ số phẩm, làm tròn;
 * cống hiến = số quyển × cống hiến của 1 tàn quyển cùng phẩm.
 */
export function layerCost(nextLayer: number, grade: number): { diemLuyen: number; congHien: number } {
  if (nextLayer < 2) throw new Error(`Tầng ${nextLayer} không phải lên tầng`);
  if (grade !== Math.floor(grade) || grade < 1 || grade > GRADE_POW.length) throw new Error(`Phẩm ${grade} sai`);
  const r = row(nextLayer);
  return { diemLuyen: Math.round((r.diemLuyen * GRADE_POW[grade - 1]) / ONE), congHien: r.congHien * RULES.contributionPerScroll[grade - 1] };
}

/** Điểm luyện đã tiêu cho các tầng của một công pháp đã học. */
function spentOn(l: LearnedTechnique): number {
  let s = 0;
  for (let k = 2; k <= l.layer; k++) s += layerCost(k, l.grade).diemLuyen;
  return s;
}

/** Điểm luyện đang có của một người: (cấp − 1) × điểm mỗi cấp, trừ giá các tầng đã lên. */
export function trainingPoints(member: Member): number {
  let spent = 0;
  for (const l of member.learned) spent += spentOn(l);
  return (member.level - 1) * DIEM_LUYEN_MOI_CAP - spent;
}

/** Chỉ số trận của công pháp ở tầng `layer`: sát thương (cả hồi, khiên) tăng, hồi chiêu và mana giảm. Tầng 1 giữ nguyên. */
export function applyLayer(t: Technique, layer: number): Technique {
  const b = layerBonus(layer);
  if (!b.uyLuc && !b.hoiChieu && !b.mana) return t;
  return {
    ...t,
    damage: mul(t.damage, ONE + b.uyLuc),
    cooldownTicks: Math.max(1, mul(t.cooldownTicks, ONE - b.hoiChieu)),
    manaCost: mul(t.manaCost, ONE - b.mana),
  };
}

/** Lên một tầng cho công pháp đã học: chưa dừng tầng, chưa tối đa, đủ điểm luyện và cống hiến; trừ cống hiến. */
export function raiseLayer(state: GameState, memberId: string, techniqueId: number): Result {
  const member = state.members[memberId];
  if (!member) return { ok: false, error: "khong_co_thanh_vien" };
  const l = member.learned.filter((x) => x.techniqueId === techniqueId)[0];
  if (!l) return { ok: false, error: "chua_hoc" };
  if (l.frozen) return { ok: false, error: "cong_phap_dung_tang" };
  if (l.layer >= TECHNIQUE_LAYERS) return { ok: false, error: "da_toi_tang" };
  const cost = layerCost(l.layer + 1, l.grade);
  if (trainingPoints(member) < cost.diemLuyen) return { ok: false, error: "thieu_diem_luyen" };
  if (member.contribution < cost.congHien) return { ok: false, error: "thieu_cong_hien" };
  member.contribution -= cost.congHien;
  l.layer++;
  return { ok: true, events: [{ type: "len_tang_cong_phap", memberId, techniqueId, layer: l.layer, diemLuyen: cost.diemLuyen, congHien: cost.congHien }] };
}

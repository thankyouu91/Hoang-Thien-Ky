// Điểm tiềm năng nhân vật (GDD mục 6, đề xuất 2026-11-09 của phiên Bảng Điểm; ghi chú diem-tiem-nang.md). Mỗi cấp +diemMoiCap điểm;
// điểm đang có = (cấp − 1) × diemMoiCap trừ điểm đã cộng, nên chỉ lưu phân bố (Member.diemTiemNang). Mỗi điểm cho `moiDiem` phần nghìn
// vào chỉ số trận (tên BuffStat của UnitSpec.bonuses); từ điểm thứ mocGiam + 1 trong một thuộc tính, mỗi điểm còn giamConLai phần nghìn.
// Số ở data/he_thong/json/diem_tiem_nang.json.
import type { BuffStat, UnitSpec } from "@htk/sim";
import DTN from "../../../data/he_thong/json/diem_tiem_nang.json" with { type: "json" };
import type { GameState, Member } from "./state.ts";
import type { Result } from "./apply.ts";

export interface AttributeRow { id: string; ten: string; moiDiem: Partial<Record<BuffStat, number>> }

const T = DTN as unknown as { diemMoiCap: number; mocGiam: number; giamConLai: number; tayDiem: { mienPhiDuoiCap: number; linhThach: number }; thuocTinh: AttributeRow[] };
export const DIEM_MOI_CAP = T.diemMoiCap;
export const ATTRIBUTES: AttributeRow[] = T.thuocTinh;
/** Phí tẩy điểm (bên gọi trừ): miễn phí dưới cấp mienPhiDuoiCap, từ đó linhThach linh thạch mỗi lần. */
export const TAY_DIEM = T.tayDiem;
const has = (id: string) => ATTRIBUTES.some((a) => a.id === id);

/** Tổng điểm đã cộng của một người. */
function spent(member: Member): number {
  let s = 0;
  for (const id of Object.keys(member.diemTiemNang ?? {})) s += member.diemTiemNang![id] ?? 0;
  return s;
}

/** Điểm tiềm năng chưa cộng: (cấp − 1) × điểm mỗi cấp trừ điểm đã cộng. */
export function unspentPoints(member: Member): number {
  return (member.level - 1) * DIEM_MOI_CAP - spent(member);
}

/**
 * Chỉ số trận từ điểm tiềm năng (phần nghìn, cùng nghĩa UnitSpec.bonuses: hp, atk, def, manaMax là % chỉ số gốc).
 * Điểm hiệu quả = min(d, mocGiam) + max(0, d − mocGiam) × giamConLai / 1000; nhân moiDiem rồi làm tròn từng thuộc tính.
 */
export function attributeBonuses(member: Member): Partial<Record<BuffStat, number>> {
  const out: Partial<Record<BuffStat, number>> = {};
  const d = member.diemTiemNang ?? {};
  for (const a of ATTRIBUTES) {
    const pts = d[a.id] ?? 0;
    if (pts <= 0) continue;
    // Tính bằng phần nghìn điểm để không lệch số thực giữa máy.
    const effMilli = Math.min(pts, T.mocGiam) * 1000 + Math.max(0, pts - T.mocGiam) * T.giamConLai;
    for (const stat of Object.keys(a.moiDiem) as BuffStat[]) {
      const perMilli = Math.round((a.moiDiem[stat] ?? 0) * 1000);
      out[stat] = (out[stat] ?? 0) + Math.round((effMilli * perMilli) / 1_000_000);
    }
  }
  return out;
}

/** Gộp chỉ số từ điểm tiềm năng vào đơn vị ra trận (như withGear). */
export function withAttributes(spec: UnitSpec, member: Member): UnitSpec {
  const add = attributeBonuses(member);
  const keys = Object.keys(add) as BuffStat[];
  if (keys.length === 0) return spec;
  const bonuses: Partial<Record<BuffStat, number>> = { ...spec.bonuses };
  for (const k of keys) bonuses[k] = (bonuses[k] ?? 0) + (add[k] ?? 0);
  return { ...spec, bonuses };
}

/** Cộng `diem` điểm vào một thuộc tính. */
export function addPoints(state: GameState, memberId: string, thuocTinh: string, diem: number): Result {
  const member = state.members[memberId];
  if (!member) return { ok: false, error: "khong_co_thanh_vien" };
  if (!has(thuocTinh)) return { ok: false, error: "thuoc_tinh_sai" };
  if (diem !== Math.floor(diem) || diem < 1) return { ok: false, error: "diem_khong_hop_le" };
  if (diem > unspentPoints(member)) return { ok: false, error: "thieu_diem_tiem_nang" };
  const d = (member.diemTiemNang ??= {});
  d[thuocTinh] = (d[thuocTinh] ?? 0) + diem;
  return { ok: true, events: [{ type: "cong_diem", memberId, thuocTinh, diem }] };
}

/** Tẩy điểm: xóa phân bố, trả lại toàn bộ điểm. Phí (TAY_DIEM) do bên gọi lo, như các phí ngoài luật khác. */
export function resetPoints(state: GameState, memberId: string): Result {
  const member = state.members[memberId];
  if (!member) return { ok: false, error: "khong_co_thanh_vien" };
  const diem = spent(member);
  member.diemTiemNang = {};
  return { ok: true, events: [{ type: "tay_diem", memberId, diem }] };
}

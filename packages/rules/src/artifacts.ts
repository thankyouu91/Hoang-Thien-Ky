// Pháp bảo (tab Trang bị, phần 9; số trong data/he_thong/json/phap_bao.json, mọi số là đề xuất).
// Ô riêng: 1 ô ở Hạ vị, 2 ô từ Trung vị. Không cộng chỉ số; trong trận tự kích hoạt (sim: UnitSpec.artifacts).
// Linh lực thay độ bền: mỗi lần kích hoạt tốn 1, hết thì không kích hoạt. Sim báo số lần đã dùng, rules trừ linh lực sau trận.
import { mul, type ArtifactKind, type ArtifactSpec, type UnitSpec } from "@htk/sim";
import PHAP_BAO from "../../../data/he_thong/json/phap_bao.json" with { type: "json" };
import LK from "../../../data/he_thong/json/luyen_khi.json" with { type: "json" };
import { GEAR } from "./config.ts";

/** Một pháp bảo của nhân vật. */
export interface PhapBaoItem {
  ma: string; // mã món, ví dụ "PB-TH-001"
  linhLuc: number; // linh lực còn lại, 0 … tối đa của món
  teLuyen: boolean; // đã tế luyện (nhận chủ); chưa tế luyện thì chưa dùng được
  tuRen: boolean; // do chính nhân vật rèn (Tu rèn): +10% chỉ số chính
  tang?: number; // tế luyện tầng 1–5 (từ Trung vị): linh lực tối đa thêm, hồi chiêu ngắn hơn (luyen_khi.json te_luyen_tang)
}

interface TangRow { tang: number; linh_luc: number; hoi_chieu: number }
const TANG = LK.te_luyen_tang as TangRow[];
const tangRow = (tang: number): TangRow | null => {
  if (tang === 0) return null;
  const r = TANG.find((x) => x.tang === tang);
  if (!r) throw new Error(`Tế luyện tầng ${tang} sai`);
  return r;
};

/** Linh lực tối đa của món sau tế luyện tầng. */
export function phapBaoLinhLucToiDa(item: PhapBaoItem): number {
  const base = phapBaoInfo(item.ma).linhLucToiDa;
  const t = tangRow(item.tang ?? 0);
  return t ? mul(base, 1000 + t.linh_luc) : base;
}

interface LoaiRow { id: string; chinh: { don_vi: string } }
interface MonRow { ma_vp: string; loai: string; do_hiem: string; chinh: { gia_tri: number }; phu: { so_lan_moi_tran: number; hoi_chieu_ticks: number; linh_luc_toi_da: number } }

const KINDS: ArtifactKind[] = ["thuan", "luan", "chau", "thap", "ho_lo", "kinh", "phien_co", "dinh", "chuong", "an"];
const UNIT_SCALE: Record<string, number> = { phan_nghin: 1, tick: 1, o: 1000 }; // "o" đổi sang milli-ô của sim
const LOAI: Record<string, LoaiRow> = {};
for (const l of PHAP_BAO.loai as LoaiRow[]) LOAI[l.id] = l;
const MON: Record<string, MonRow> = {};
for (const m of PHAP_BAO.mon as MonRow[]) MON[m.ma_vp] = m;
const has = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);

/** Số ô pháp bảo theo vị diện của nhân vật. */
export function phapBaoSlots(trungViTroLen: boolean): number {
  return trungViTroLen ? PHAP_BAO.o.trung_vi_tro_len : PHAP_BAO.o.ha_vi;
}

/** Loại, độ hiếm và linh lực tối đa của một món. */
export function phapBaoInfo(ma: string): { loai: ArtifactKind; doHiem: string; linhLucToiDa: number } {
  if (!has(MON, ma)) throw new Error(`Không có pháp bảo ${ma}`);
  const m = MON[ma];
  if (KINDS.indexOf(m.loai as ArtifactKind) < 0 || !has(LOAI, m.loai)) throw new Error(`${ma}: loại ${m.loai} chưa có trong sim`);
  return { loai: m.loai as ArtifactKind, doHiem: m.do_hiem, linhLucToiDa: m.phu.linh_luc_toi_da };
}

/** Pháp bảo đang mang (theo thứ tự ô) thành dữ liệu trận; số lần kích hoạt không quá linh lực còn lại. */
export function artifactSpecs(items: PhapBaoItem[], trungViTroLen: boolean): ArtifactSpec[] {
  const slots = phapBaoSlots(trungViTroLen);
  if (items.length > slots) throw new Error(`Chỉ mang được ${slots} pháp bảo`);
  return items.map((item) => {
    const info = phapBaoInfo(item.ma);
    if (!item.teLuyen) throw new Error(`${item.ma}: chưa tế luyện`);
    if ((item.tang ?? 0) > 0 && !trungViTroLen) throw new Error(`${item.ma}: tế luyện tầng chỉ từ Trung vị`);
    if (item.linhLuc !== Math.floor(item.linhLuc) || item.linhLuc < 0 || item.linhLuc > phapBaoLinhLucToiDa(item)) {
      throw new Error(`${item.ma}: linh lực ${item.linhLuc} sai`);
    }
    const m = MON[item.ma];
    const scale = UNIT_SCALE[LOAI[m.loai].chinh.don_vi];
    if (!scale) throw new Error(`${item.ma}: chưa biết đơn vị ${LOAI[m.loai].chinh.don_vi}`);
    let power = m.chinh.gia_tri * scale;
    if (item.tuRen) power = mul(power, GEAR.selfForgedArtifact);
    const t = tangRow(item.tang ?? 0);
    const base = m.phu.hoi_chieu_ticks;
    return {
      kind: info.loai, power, uses: Math.min(m.phu.so_lan_moi_tran, item.linhLuc),
      cooldownTicks: t ? mul(base, 1000 + t.hoi_chieu) : base,
      energy: item.linhLuc,
      minCooldownTicks: mul(base, LK.luat.teLuyenHoiChieuSan), // sau mọi nguồn (Cổ Tông, tầng) không dưới 60% hồi chiêu gốc
    };
  });
}

/** Gắn pháp bảo vào một đơn vị trong trận. */
export function withArtifacts(spec: UnitSpec, items: PhapBaoItem[], trungViTroLen: boolean): UnitSpec {
  return { ...spec, artifacts: artifactSpecs(items, trungViTroLen) };
}

/** Trừ linh lực sau trận theo số lần kích hoạt sim báo về (BattleResult.artifactUses), theo cùng thứ tự ô. */
export function spendLinhLuc(items: PhapBaoItem[], uses: number[]): PhapBaoItem[] {
  if (uses.length !== items.length) throw new Error("Số pháp bảo và số lần dùng không khớp");
  return items.map((item, i) => {
    if (uses[i] < 0 || uses[i] > item.linhLuc) throw new Error(`${item.ma}: dùng ${uses[i]} lần nhưng chỉ còn ${item.linhLuc} linh lực`);
    return { ...item, linhLuc: item.linhLuc - uses[i] };
  });
}

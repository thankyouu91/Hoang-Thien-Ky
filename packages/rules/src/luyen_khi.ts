// Luyện khí sau cấp tối đa (GDD tab Trang bị, phần 13; số trong data/he_thong/json/luyen_khi.json, mọi số là đề xuất).
// Khí linh cộng chỉ số gốc cùng chỗ với cường hóa và mở ô khí văn; tẩy luyện đổi loại chỉ số phụ; phân giải ra Khí Tinh;
// danh khí là vũ khí đỏ có sẵn Ý của khí hình ×luat.danhKhiYHeSo (không chiếm dòng khảm) cộng một danh văn. Khí văn và danh văn đổi sang
// dữ liệu trận của sim (SetFx, SkillMod) ở đây.
import { type SetFx, type SkillMod, type SkillType } from "@ktlp/sim";
import LK from "../../../data/he_thong/json/luyen_khi.json" with { type: "json" };
import NGOC from "../../../data/he_thong/json/ngoc.json" with { type: "json" };
import TRANG_BI from "../../../data/he_thong/json/trang_bi.json" with { type: "json" };
import VU_KHI from "../../../data/he_thong/json/vu_khi.json" with { type: "json" };

export const LUYEN_KHI = LK.luat;
interface LevelRow { cap: number; kinh_nghiem_tich_luy: number; cong_chi_so: number; mo_o_khi_van: boolean }
interface PhuRow { o: string; loai: number; stat: string; gia_tri: number }
interface KhiVanRow { ma: string; nhom: "cong" | "thu"; gia_tri: number; tham_so: Record<string, number> | null }
interface DanhKhiRow { ma_vp: string; khi_hinh: string; tham_so: Record<string, number | boolean> }
const LEVELS = LK.khi_linh as LevelRow[];
const PHU = LK.tay_luyen as PhuRow[];
const KHI_VAN: Record<string, KhiVanRow> = {};
for (const v of LK.khi_van as KhiVanRow[]) KHI_VAN[v.ma] = v;
const DANH_KHI: Record<string, DanhKhiRow> = {};
for (const d of LK.danh_khi as DanhKhiRow[]) DANH_KHI[d.ma_vp] = d;
const RARITY_ORDER = (TRANG_BI.do_hiem as { id: string }[]).map((r) => r.id);
const has = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);

/** Cấp khí linh theo kinh nghiệm tích lũy (0–9). */
export function khiLinhLevel(kn: number): number {
  let lv = 0;
  for (const r of LEVELS) if (kn >= r.kinh_nghiem_tich_luy) lv = r.cap;
  return lv;
}

/** Phần nghìn chỉ số gốc khí linh cộng thêm (cộng vào hệ số cùng chỗ với cường hóa). */
export function khiLinhBonus(kn: number): number {
  return LEVELS[khiLinhLevel(kn)].cong_chi_so;
}

/** Món có khí linh được không: độ hiếm từ tím trở lên. */
export function canHaveKhiLinh(doHiem: string): boolean {
  return RARITY_ORDER.indexOf(doHiem) + 1 >= LUYEN_KHI.khiLinhBacToiThieu;
}

/** Số ô khí văn đã mở: các cấp mở ô tới cấp hiện tại, không quá trần theo độ hiếm. */
export function khiVanSlots(kn: number, doHiem: string): number {
  const lv = khiLinhLevel(kn);
  const opened = LEVELS.filter((r) => r.mo_o_khi_van && r.cap <= lv).length;
  const cap = (LUYEN_KHI.khiVanToiDa as Record<string, number>)[doHiem] ?? 0;
  return Math.min(opened, cap);
}

/** Cộng kinh nghiệm khí linh, không vượt cấp tối đa. */
export function addKhiLinhKn(kn: number, add: number): number {
  return Math.min(LEVELS[LEVELS.length - 1].kinh_nghiem_tich_luy, kn + add);
}

/** Chỉ số phụ loại `loai` (1–4) của ô; loại 1 là chỉ số phụ mặc định. */
export function phuRow(o: string, loai: number): { stat: string; gia_tri: number } {
  const r = PHU.find((x) => x.o === o && x.loai === loai);
  if (!r) throw new Error(`Ô ${o} không có chỉ số phụ loại ${loai}`);
  return r;
}

/**
 * Tẩy luyện: đổi loại chỉ số phụ sang loại khác trong 4 loại của ô. Tu rèn chọn thẳng `chon`; người thường lấy `quay`
 * (số ngẫu nhiên không âm do máy chủ tung) trong 3 loại còn lại. Trả về loại mới.
 */
export function tayLuyen(hienTai: number, quay: number, chon?: number): number {
  const others = [1, 2, 3, 4].filter((x) => x !== hienTai);
  if (chon !== undefined) {
    if (others.indexOf(chon) < 0) throw new Error(`Tẩy luyện: loại ${chon} sai`);
    return chon;
  }
  if (quay < 0 || quay !== Math.floor(quay)) throw new Error("Tẩy luyện: số quay sai");
  return others[quay % others.length];
}

/** Khí Tinh nhận được khi phân giải món có độ hiếm `doHiem` và kinh nghiệm khí linh `kn`; lục không phân giải được. */
export function khiTinhPhanGiai(doHiem: string, kn: number): number {
  const r = (LK.phan_giai as { do_hiem: string; khi_tinh: number }[]).find((x) => x.do_hiem === doHiem);
  if (!r) throw new Error(`Không phân giải được đồ ${doHiem}`);
  return r.khi_tinh + LUYEN_KHI.phanGiaiKhiTinhMoiCapKhiLinh * khiLinhLevel(kn);
}

/** Danh khí: khí hình và mã Ý châu cùng khí hình; không phải danh khí thì null. */
export function danhKhiOf(kieu: string): { khiHinh: string; yChau: string } | null {
  if (!has(DANH_KHI, kieu)) return null;
  const khiHinh = DANH_KHI[kieu].khi_hinh;
  const y = (NGOC.y_chau as { ma_vp: string; khi_hinh: string }[]).find((x) => x.khi_hinh === khiHinh);
  if (!y) throw new Error(`Danh khí ${kieu}: không có Ý châu khí hình ${khiHinh}`);
  return { khiHinh, yChau: y.ma_vp };
}

/**
 * Ý của danh khí mạnh gấp `heSo` phần nghìn lần Ý châu: nhân phần thay đổi so với không có Ý, giữ nguyên số đếm (thêm mục
 * tiêu, số lần) và cách chọn mục tiêu. Tầm cộng vẫn chung trần +1 ô với hệ trong sim.
 */
export function scaleSkillMod(mod: SkillMod, heSo: number): SkillMod {
  const s = (v: number | undefined) => (v === undefined ? undefined : Math.trunc((v * heSo) / 1000));
  const out: SkillMod = { ...mod };
  if (mod.shieldPierce !== undefined) out.shieldPierce = s(mod.shieldPierce);
  if (mod.extraTargetDamage !== undefined) out.extraTargetDamage = Math.min(1000, s(mod.extraTargetDamage)!);
  if (mod.rangeBonus !== undefined) out.rangeBonus = s(mod.rangeBonus);
  if (mod.castTicks !== undefined) out.castTicks = s(mod.castTicks);
  if (mod.overhealShield !== undefined) out.overhealShield = s(mod.overhealShield);
  if (mod.manaCost !== undefined) out.manaCost = 1000 - s(1000 - mod.manaCost)!;
  return out;
}

const LOAI_CHIEU: Record<string, SkillType> = {};
for (const k of VU_KHI.khi_hinh as { id: string; loai_chieu: SkillType }[]) LOAI_CHIEU[k.id] = k.loai_chieu;

/** Đổi tham_so danh văn (luyen_khi.json danh_khi[].tham_so) sang SkillMod của sim, theo khí hình. */
function danhVanTuDuLieu(d: DanhKhiRow): SkillMod {
  const t = d.tham_so;
  const n = (k: string): number => {
    const v = t[k];
    if (typeof v !== "number") throw new Error(`${d.ma_vp}: thiếu số ${k}`);
    return v;
  };
  // Sim chỉ làm được đúng 1 lần (đỡ 1 khống chế, giải 1 thiêu đốt, hủy chiêu): số khác thì báo.
  const mot = (k: string): true => {
    if (t[k] !== true && t[k] !== 1) throw new Error(`${d.ma_vp}: sim chỉ làm được ${k} = 1`);
    return true;
  };
  switch (d.khi_hinh) {
    case "kiem": return { critCooldownCut: n("hoiChieuNhanhTicks") };
    case "dao": return { sweepShield: n("khienMoiMucTieu"), sweepShieldFrom: n("tuMucTieuThu") };
    case "cung": return { channelTargetBonus: n("satThuongThem") };
    case "phien": return { bigAoeHaste: n("tuSoMucTieu") };
    case "con": return { shieldBlocksControl: mot("doThemKhongChe") };
    case "but": return { extraUses: n("themLan"), useDamage: n("heSoSatThuong") };
    case "ky": return { allyDefBuff: n("phongThuThem"), allyDefTicks: n("thoiGianTicks") };
    case "cam": return { cleanseBurn: mot("giaiHieuUng") };
    case "tieu": return { breakChannel: mot("huyChieu") };
    case "thuong": return { dashPierceNext: n("xuyenKhien") };
    default: throw new Error(`Chưa biết đổi danh văn của khí hình ${d.khi_hinh}`);
  }
}

/** Danh văn theo danh khí: loại chiêu theo khí hình (vu_khi.json), số theo luyen_khi.json danh_khi[].tham_so. */
const DANH_VAN: Record<string, { loai: SkillType; mod: SkillMod }> = {};
for (const d of LK.danh_khi as DanhKhiRow[]) DANH_VAN[d.ma_vp] = { loai: LOAI_CHIEU[d.khi_hinh], mod: danhVanTuDuLieu(d) };

/** Số phụ của khí văn (luyen_khi.json khi_van[].tham_so). */
function khiVanSo(ma: string, k: string): number {
  const v = KHI_VAN[ma].tham_so?.[k];
  if (typeof v !== "number") throw new Error(`${ma}: thiếu số ${k}`);
  return v;
}

/** Danh văn của một danh khí. */
export function danhVanMod(kieu: string): { loai: SkillType; mod: SkillMod } {
  if (!has(DANH_VAN, kieu)) throw new Error(`Không có danh văn cho ${kieu}`);
  return DANH_VAN[kieu];
}

/** Nhóm và số chính của khí văn. */
export function khiVanInfo(ma: string): { nhom: "cong" | "thu"; giaTri: number } {
  if (!has(KHI_VAN, ma)) throw new Error(`Không có khí văn ${ma}`);
  return { nhom: KHI_VAN[ma].nhom, giaTri: KHI_VAN[ma].gia_tri };
}

/** Phần khí văn đổi sang trận và ngoài trận. */
export interface KhiVanFx { setFx: SetFx; monsterDamage: number; outside: Record<string, number> }

/**
 * Đổi số lần tính của từng khí văn (mỗi khí văn kích tính 1 lần) sang sim. Ngưỡng máu và chu kỳ lấy ở khi_van[].tham_so.
 */
export function khiVanFx(counts: Record<string, number>): KhiVanFx {
  const out: KhiVanFx = { setFx: {}, monsterDamage: 0, outside: {} };
  const f = out.setFx;
  for (const ma of Object.keys(counts)) {
    const c = counts[ma];
    const v = khiVanInfo(ma).giaTri;
    switch (ma) {
      case "KV-CO-001": f.shieldBreakBonus = v * c; break;
      case "KV-CO-002": f.lowHpAllBelow = khiVanSo(ma, "nguongMau"); f.lowHpAllBonus = v * c; break;
      case "KV-CO-003": f.openerBonus = v * c; break;
      case "KV-CO-004": f.comboThirdBonus = v * c; break;
      case "KV-CO-005": f.counterBoost = (v - 1500) * c; break;
      case "KV-CO-006": f.killMana = v * c; break;
      case "KV-CO-007": out.outside.satThuongHoTran = (out.outside.satThuongHoTran ?? 0) + v * c; break;
      case "KV-CO-008": out.monsterDamage += v * c; break;
      case "KV-TH-001": f.lastStandBelow = khiVanSo(ma, "nguongMau"); f.lastStandShield = v * c; break;
      case "KV-TH-002": f.counterCap = 1500 - (1500 - v) * c; break;
      case "KV-TH-003": f.meleeReflect = v * c; break;
      case "KV-TH-004": f.frontDef = v * c; break;
      case "KV-TH-005": f.backMana = v * c; break;
      case "KV-TH-006": f.regenPulse = v * c; f.regenPulseTicks = khiVanSo(ma, "chuKyTicks"); break;
      case "KV-TH-007": f.knockbackResist = Math.min(1000, v * c); break; // bị đẩy ngắn đi v phần nghìn quãng
      case "KV-TH-008": out.outside.loiKiepGiam = (out.outside.loiKiepGiam ?? 0) + v * c; break;
      default: throw new Error(`Chưa biết đổi khí văn ${ma}`);
    }
  }
  return out;
}


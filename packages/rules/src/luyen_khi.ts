// Luyện khí sau cấp tối đa (GDD tab Trang bị, phần 13; số trong data/he_thong/json/luyen_khi.json, mọi số là đề xuất).
// Khí linh cộng chỉ số gốc cùng chỗ với cường hóa và mở ô khí văn; tẩy luyện đổi loại chỉ số phụ; phân giải ra Khí Tinh;
// danh khí là vũ khí đỏ có sẵn Ý của khí hình ×1,5 (không chiếm dòng khảm) cộng một danh văn. Khí văn và danh văn đổi sang
// dữ liệu trận của sim (SetFx, SkillMod) ở đây.
import { type SetFx, type SkillMod, type SkillType } from "@ktlp/sim";
import LK from "../../../data/he_thong/json/luyen_khi.json" with { type: "json" };
import NGOC from "../../../data/he_thong/json/ngoc.json" with { type: "json" };
import TRANG_BI from "../../../data/he_thong/json/trang_bi.json" with { type: "json" };

export const LUYEN_KHI = LK.luat;
interface LevelRow { cap: number; kinh_nghiem_tich_luy: number; cong_chi_so: number; mo_o_khi_van: boolean }
interface PhuRow { o: string; loai: number; stat: string; gia_tri: number }
interface KhiVanRow { ma: string; nhom: "cong" | "thu"; gia_tri: number }
interface DanhKhiRow { ma_vp: string; khi_hinh: string }
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

/**
 * Danh văn theo danh khí. Dữ liệu chỉ có câu mô tả nên số lấy từ câu đó; thời gian phòng thủ của Tinh La Kỳ chưa ghi,
 * lấy 5 s (đề xuất).
 */
const DANH_VAN: Record<string, { loai: SkillType; mod: SkillMod }> = {
  "TB-KI-061": { loai: "can_don", mod: { critCooldownCut: 10 } },
  "TB-KI-062": { loai: "can_quet", mod: { sweepShield: 10 } },
  "TB-KI-063": { loai: "tam_xa", mod: { channelTargetBonus: 200 } },
  "TB-KI-064": { loai: "dien_rong", mod: { bigAoeHaste: 6 } },
  "TB-KI-065": { loai: "ho_the", mod: { shieldBlocksControl: true } },
  "TB-KI-066": { loai: "bua_chu", mod: { extraUses: 1, useDamage: 850 } },
  "TB-KI-067": { loai: "tran_phap", mod: { allyDefBuff: 50, allyDefTicks: 100 } },
  "TB-KI-068": { loai: "hoi_phuc", mod: { cleanseBurn: true } },
  "TB-KI-069": { loai: "khong_che", mod: { breakChannel: true } },
  "TB-KI-070": { loai: "than_phap", mod: { dashPierceNext: 200 } },
};

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
 * Đổi số lần tính của từng khí văn (mỗi khí văn kích tính 1 lần) sang sim. Ngưỡng trong mô tả (20% máu, 25% máu,
 * 5 s) chưa có cột số trong dữ liệu nên ghi ở đây. Định Thân: mỗi lần tính bị đẩy lùi ngắn đi một nửa (đề xuất).
 */
export function khiVanFx(counts: Record<string, number>): KhiVanFx {
  const out: KhiVanFx = { setFx: {}, monsterDamage: 0, outside: {} };
  const f = out.setFx;
  for (const ma of Object.keys(counts)) {
    const c = counts[ma];
    const v = khiVanInfo(ma).giaTri;
    switch (ma) {
      case "KV-CO-001": f.shieldBreakBonus = v * c; break;
      case "KV-CO-002": f.lowHpAllBelow = 200; f.lowHpAllBonus = v * c; break;
      case "KV-CO-003": f.openerBonus = v * c; break;
      case "KV-CO-004": f.comboThirdBonus = v * c; break;
      case "KV-CO-005": f.counterBoost = (v - 1500) * c; break;
      case "KV-CO-006": f.killMana = v * c; break;
      case "KV-CO-007": out.outside.satThuongHoTran = (out.outside.satThuongHoTran ?? 0) + v * c; break;
      case "KV-CO-008": out.monsterDamage += v * c; break;
      case "KV-TH-001": f.lastStandBelow = 250; f.lastStandShield = v * c; break;
      case "KV-TH-002": f.counterCap = 1500 - (1500 - v) * c; break;
      case "KV-TH-003": f.meleeReflect = v * c; break;
      case "KV-TH-004": f.frontDef = v * c; break;
      case "KV-TH-005": f.backMana = v * c; break;
      case "KV-TH-006": f.regenPulse = v * c; f.regenPulseTicks = 100; break;
      case "KV-TH-007": f.knockbackResist = Math.min(1000, v * c); break; // bị đẩy ngắn đi v phần nghìn quãng
      case "KV-TH-008": out.outside.loiKiepGiam = (out.outside.loiKiepGiam ?? 0) + v * c; break;
      default: throw new Error(`Chưa biết đổi khí văn ${ma}`);
    }
  }
  return out;
}


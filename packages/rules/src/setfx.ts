// Hiệu ứng hành vi và khắc chế của set (set.json, loai "hanh_vi" và "khac_che") đổi sang dữ liệu trận của sim:
// UnitSpec.setFx theo người mặc, SkillMod theo loại chiêu, kháng tĩnh và chỉ số ngoài trận. Mỗi mốc có cách đổi riêng
// vì cùng một khóa có thể mang nghĩa khác ở hai bộ (ví dụ `nguongMau` của Bàn Thạch và Vạn Kiếm).
import type { Element, SetFx, SkillMod, SkillType } from "@ktlp/sim";

/** Phần cộng dồn khi đổi các hiệu ứng set của một người. */
export interface SetFxAcc {
  setFx: SetFx;
  mods: Partial<Record<SkillType, SkillMod>>;
  resistVsCounters: number; // kháng thêm với mọi hệ đang khắc linh căn chính (Ngọc Tủy)
  outside: Record<string, number>; // phần ngoài trận, theo khóa trong set.json
}

export const emptySetFxAcc = (): SetFxAcc => ({ setFx: {}, mods: {}, resistVsCounters: 0, outside: {} });

type Params = Record<string, number | boolean | string>;
const num = (key: string, p: Params, k: string): number => {
  const v = p[k];
  if (typeof v !== "number") throw new Error(`Set ${key}: ${k} phải là số`);
  return v;
};
const mod = (a: SetFxAcc, t: SkillType): SkillMod => {
  const m = a.mods[t] ?? {};
  a.mods[t] = m;
  return m;
};
const outside = (a: SetFxAcc, k: string, v: number) => {
  a.outside[k] = (a.outside[k] ?? 0) + v;
};

/** Cách đổi theo "bộ:mốc". */
const HANDLERS: Record<string, (key: string, p: Params, a: SetFxAcc) => void> = {
  "bach_thao:7": (k, p, a) => { a.setFx.cleanseHealCut = num(k, p, "tayGiamHoiMau"); },
  "ban_thach:7": (k, p, a) => {
    a.setFx.petrifyBelow = num(k, p, "nguongMau");
    a.setFx.petrifyTicks = num(k, p, "hoaDaTicks");
    outside(a, "khaiKhoang", num(k, p, "khaiKhoang"));
  },
  "thiet_ky:7": (k, p, a) => { a.setFx.frontAoeCut = num(k, p, "giamDienRong"); },
  "van_uyen:7": (k, p, a) => {
    a.setFx.instantFirstAoe = num(k, p, "boVanCongLanDau") > 0;
    outside(a, "congHienNopQuyen", num(k, p, "congHienNopQuyen"));
  },
  "ngoc_tuy:7": (k, p, a) => { a.setFx.resistTopEnemy = num(k, p, "khangHeDichNhieuNhat"); },
  "linh_tuyen:4": (k, p, a) => { a.setFx.healerRegenPenalty = num(k, p, "hoiManaKhiVan"); },
  "linh_tuyen:7": (k, p, a) => {
    a.setFx.resetHealOnFall = num(k, p, "lamMoiHoiPhuc");
    outside(a, "beQuan", num(k, p, "beQuan"));
  },
  "bang_phach:4": (k, p, a) => {
    a.setFx.controlDr = num(k, p, "giamDanKhongChe");
    a.setFx.controlChannelTicks = num(k, p, "khongCheDangVanCongTicks"); // khống chế trúng kẻ đang vận công, bày trận: dài thêm
  },
  "bang_phach:7": (k, p, a) => { a.setFx.chilledBonus = num(k, p, "satThuongMucTieuCham"); },
  "loi_tri:7": (k, p, a) => {
    a.setFx.bounceCrit = num(k, p, "thuTuChiMang");
    a.setFx.bounceDamage = num(k, p, "heSoNay");
  },
  "co_tong:4": (k, p, a) => {
    a.setFx.artifactCooldownCut = -num(k, p, "hoiChieuPhapBao");
    a.setFx.artifactMana = num(k, p, "hoiManaPhapBao");
  },
  "co_tong:7": (k, p, a) => {
    a.setFx.artifactExtraUses = num(k, p, "themLanPhapBao");
    a.setFx.artifactMaxUses = num(k, p, "toiDa");
  },
  "huyet_anh:4": (k, p, a) => { mod(a, "than_phap").exposedTicks = num(k, p, "loViTriTicks"); },
  "huyet_anh:7": (k, p, a) => { a.setFx.stealthOnDashKill = num(k, p, "anThanTicks"); },
  "do_kiep:4": (k, p, a) => {
    const m = mod(a, "bua_chu");
    m.manaCost = 1000 - num(k, p, "buaGiamMana");
    m.lastUseFree = num(k, p, "buaCuoiMienMana") > 0;
  },
  "van_kiem:4": (k, p, a) => {
    const m = mod(a, "can_don");
    m.lowHpBelow = num(k, p, "nguongMau");
    m.lowHpBonus = num(k, p, "satThuong");
  },
  "van_kiem:7": (k, p, a) => {
    const m = mod(a, "can_don");
    m.qiCycleTicks = num(k, p, "chuKyTicks");
    m.qiDamage = num(k, p, "heSoKiemKhi");
  },
  "chu_thien:4": (k, p, a) => {
    if (p.chonViTri !== "dong_dich_nhat") throw new Error(`Set ${k}: chưa biết chọn vị trí ${p.chonViTri}`);
    mod(a, "tran_phap").densest = true;
  },
  "hon_don:4": (k, p, a) => { a.setFx.counterCap = num(k, p, "heSoBiKhac"); },
  "hon_don:7": (k, p, a) => { a.setFx.decoyTicks = num(k, p, "nguyLinhCanTicks"); },
};

/**
 * Ràng buộc trong set.json (`rang_buoc`) có tác dụng trong trận: mốc 7 cần ít nhất 1 công pháp mang theo có hệ chủ là
 * một trong các hệ này. Huyết Ảnh (sát nghiệp) và Phá Quân (chỉ trong chiến tranh) không thuộc trận.
 */
const NEEDS: Record<string, Element[]> = { "bang_phach:7": ["thuy", "cuc_han"], "loi_tri:7": ["loi", "kim"] };

/** Hiệu ứng "bộ:mốc" có cách đổi chưa. */
export function isKnownSetBehavior(bo: string, so: number): boolean {
  return Object.prototype.hasOwnProperty.call(HANDLERS, `${bo}:${so}`);
}

/** Mốc này có đủ điều kiện không; `mainElements` = hệ chủ của các công pháp mang theo, không có thì không xét. */
export function setMilestoneAllowed(bo: string, so: number, mainElements?: Element[]): boolean {
  const need = NEEDS[`${bo}:${so}`];
  if (!need || !mainElements) return true;
  return mainElements.some((e) => need.indexOf(e) >= 0);
}

/** Cộng một hiệu ứng hành vi hoặc khắc chế vào `acc`. */
export function addSetBehavior(acc: SetFxAcc, bo: string, so: number, tham_so: Params): void {
  const key = `${bo}:${so}`;
  if (!isKnownSetBehavior(bo, so)) throw new Error(`Set ${key}: chưa biết đổi hiệu ứng hành vi`);
  HANDLERS[key](key, tham_so, acc);
}

// Set đồ 2.0 (GDD tab Trang bị, phần 14; đặc tả set-2.md của phiên set đồ, mọi số là đề xuất): bậc ấn, lộ sức mạnh, hợp bộ,
// binh bộ, dòng ẩn của trang sức, dòng rèn, điểm trang bị. Số đọc ở set.json (bac_an, hop_bo, binh_bo, luat, bo[].lo) và
// trang_bi.json (dong_ren, dong_an, diem, luat); khóa nào dữ liệu chưa có thì lấy số ở đặc tả (DU_PHONG_*).
import { BATTLE, ONE, baseStats, elementMultiplier, type BuffStat, type Element, type HiddenCond, type HiddenStat } from "@ktlp/sim";
import SET from "../../../data/he_thong/json/set.json" with { type: "json" };
import NGOC from "../../../data/he_thong/json/ngoc.json" with { type: "json" };
import TRANG_BI from "../../../data/he_thong/json/trang_bi.json" with { type: "json" };
import TO_HOP from "../../../data/he_thong/json/to_hop.json" with { type: "json" };

export type Bac = "luc" | "lam" | "tim" | "vang" | "do";
export const BAC: Bac[] = ["luc", "lam", "tim", "vang", "do"];
type Params = Record<string, number | boolean>;
export interface BinhBoRow { id: string; ten: string; lo: string[]; an: string; moc: { so: number; tham_so: Params }[] }

interface SetData {
  bo: { id: string; an: string; than: boolean; lo?: string | string[] }[];
  bac_an?: { ma: Bac; he_so: number; tinh_moc_7: boolean; ghep_len: boolean }[];
  hop_bo?: { quan_he: string; he_so: number; mana_max?: number }[];
  binh_bo?: { id: string; ten: string; lo: string | string[]; an: string; moc_2: { tham_so: Params }; moc_3: { tham_so: Params } }[];
  luat?: { ghepAnSo?: number; boThanTuBac?: number; binhBoDongLoHeSo?: number };
}
const S = SET as unknown as SetData;
const has = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);
const list = (v: string | string[]): string[] => (typeof v === "string" ? [v] : v.slice());

// ---- Bậc ấn (phần 14.3.1) ----
const BAC_ROW: Record<string, { heSo: number; moc7: boolean; ghepLen: boolean }> = {
  luc: { heSo: 600, moc7: false, ghepLen: true }, lam: { heSo: 800, moc7: false, ghepLen: true }, tim: { heSo: 1000, moc7: true, ghepLen: false },
  vang: { heSo: 1100, moc7: true, ghepLen: false }, do: { heSo: 1200, moc7: true, ghepLen: false },
};
for (const r of S.bac_an ?? []) BAC_ROW[r.ma] = { heSo: r.he_so, moc7: r.tinh_moc_7, ghepLen: r.ghep_len };
const GHEP_SL = S.luat?.ghepAnSo ?? 3;
const THAN_TU = BAC[(S.luat?.boThanTuBac ?? 3) - 1];

/** Hệ số mốc 2, 4 theo bậc ấn, phần nghìn. */
export function bacHeSo(bac: Bac): number {
  if (!has(BAC_ROW, bac)) throw new Error(`Bậc ấn ${bac} sai`);
  return BAC_ROW[bac].heSo;
}
/** Bậc `bac` từ `min` trở lên. */
export const bacTu = (bac: Bac, min: Bac): boolean => BAC.indexOf(bac) >= BAC.indexOf(min);
/** Ấn bậc này tính được cho mốc 7 (từ tím). */
export const bacMoc7 = (bac: Bac): boolean => BAC_ROW[bac].moc7;
/** Bậc thấp nhất của ấn bộ thần. */
export const BAC_BO_THAN = THAN_TU;
/** Ghép `soLuong` ấn cùng bộ cùng bậc thành 1 ấn bậc trên; chỉ bậc có ghep_len (lục lên lam, lam lên tím). */
export function ghepAn(bac: Bac, soLuong: number): Bac {
  if (soLuong !== GHEP_SL) throw new Error(`Ghép ấn cần ${GHEP_SL} viên cùng bộ cùng bậc`);
  if (!BAC_ROW[bac]?.ghepLen) throw new Error(`Ấn bậc ${bac} không ghép lên được`);
  return BAC[BAC.indexOf(bac) + 1];
}

// ---- Lộ sức mạnh (phần 14.3.2) ----
const DU_PHONG_LO: Record<string, string> = {
  van_kiem: "ngoai_cong", loi_tri: "ngoai_cong", liep_thu: "ngoai_cong", pha_quan: "ngoai_cong",
  van_uyen: "noi_cong", do_kiep: "noi_cong", ban_thach: "thu_ngoai", ngoc_tuy: "thu_noi", chu_thien: "thu_noi",
  bach_thao: "hap_thu", linh_tuyen: "hap_thu", huyet_anh: "hap_thu", co_tong: "hap_thu", thiet_ky: "phan_chan",
  bang_phach: "khong_toc", hon_don: "khac_che", tu_bao: "kinh_te", ngu_thu: "kinh_te", dan_tien: "kinh_te", thien_cong: "kinh_te",
};
const SET_LO: Record<string, string[]> = {};
const SET_HE: Record<string, Element | null> = {};
const SET_THAN: Record<string, boolean> = {};
const SEAL_HE: Record<string, Element | null> = {};
for (const a of NGOC.an_bo as { ma_vp: string; he: string | null }[]) SEAL_HE[a.ma_vp] = (a.he as Element | null) ?? null;
for (const b of S.bo) {
  SET_LO[b.id] = b.lo !== undefined ? list(b.lo) : [DU_PHONG_LO[b.id]];
  SET_HE[b.id] = has(SEAL_HE, b.an) ? SEAL_HE[b.an] : null;
  SET_THAN[b.id] = b.than;
}
/** Lộ của một bộ ấn. */
export const setLo = (bo: string): string[] => SET_LO[bo] ?? [];
/** Bộ thần chỉ có ấn từ BAC_BO_THAN. */
export const setThan = (bo: string): boolean => SET_THAN[bo] ?? false;

// ---- Hợp bộ (phần 14.3.3) ----
const RELATION = TO_HOP.relation as Record<string, Record<string, string>>;
const HOP: Record<string, { heSo: number; manaMax?: number }> = {
  thuan: { heSo: 1100 }, tuong_sinh: { heSo: 1200 }, tuong_hop: { heSo: 1200 }, doi_cuc: { heSo: 1300, manaMax: -20 },
  trung_tinh: { heSo: 1000 }, tuong_khac: { heSo: 800 },
};
for (const r of S.hop_bo ?? []) HOP[r.quan_he] = { heSo: r.he_so, manaMax: r.mana_max };

/** Quan hệ giữa hai bộ theo hệ ấn (to_hop.json); Hỗn Độn không hệ là trung tính. */
function quanHe(a: string, b: string): string {
  const x = SET_HE[a], y = SET_HE[b];
  return x && y ? RELATION[x][y] : "trung_tinh";
}
/** Bộ `a` khắc bộ `b`: hai hệ ấn tương khắc và hệ của `a` đánh hệ của `b` ×1,5. */
function khacBo(a: string, b: string): boolean {
  const x = SET_HE[a], y = SET_HE[b];
  return !!x && !!y && RELATION[x][y] === "tuong_khac" && elementMultiplier(x, y) >= 1500;
}

export interface SetFactor {
  /** Hệ số mốc 2 do hợp bộ hoặc cộng hưởng trên bàn (lấy cái tốt hơn), phần nghìn; 1000 là không có. */
  hop: number;
  /** Nguồn của `hop`: "ban" (cộng hưởng trên Đạo Cơ Bàn), quan hệ hợp bộ (thuan, tuong_sinh, …), hoặc null. */
  nguon: string | null;
  /** Bộ đang kích khắc bộ này (mốc 2 ×hop_bo tuong_khac); null nếu không có. */
  biKhac: string | null;
}

/**
 * Hệ số mỗi bộ đang kích: hợp bộ với từng bộ đang kích khác (chỉ quan hệ hệ số trên 1000), cộng hưởng trên bàn thay nếu cao hơn,
 * rồi ×hop_bo tuong_khac nếu có bộ đang kích khắc nó. Hòa thì bộ đứng trước trong `active`. `manaMax`: tổng mana tối đa
 * (phần nghìn chỉ số chuẩn) từ các cặp hợp bộ Đối cực được chọn, mỗi cặp một lần.
 */
export function setFactors(active: string[], ban: Record<string, number>): { heSo: Record<string, SetFactor>; manaMax: number } {
  const heSo: Record<string, SetFactor> = {};
  const capCuc: string[] = [];
  for (const a of active) {
    let hop = ONE;
    let nguon: string | null = null;
    let partner = "";
    for (const b of active) {
      if (b === a) continue;
      const q = quanHe(a, b);
      if (has(HOP, q) && HOP[q].heSo > hop) {
        hop = HOP[q].heSo;
        nguon = q;
        partner = b;
      }
    }
    if ((ban[a] ?? 0) > hop) {
      hop = ban[a];
      nguon = "ban";
    } else if (nguon !== null && HOP[nguon].manaMax) {
      const key = [a, partner].sort().join("|");
      if (capCuc.indexOf(key) < 0) capCuc.push(key);
    }
    let biKhac: string | null = null;
    for (const b of active) if (b !== a && khacBo(b, a)) { biKhac = b; break; }
    heSo[a] = { hop, nguon, biKhac };
  }
  return { heSo, manaMax: capCuc.length * (HOP.doi_cuc.manaMax ?? 0) };
}
/** Hệ số mốc 2 của một bộ sau bậc ấn, hợp bộ, bị khắc. */
export function heSoMoc2(bac: number, f: SetFactor): number {
  let h = Math.trunc((bac * f.hop) / ONE);
  if (f.biKhac) h = Math.trunc((h * HOP.tuong_khac.heSo) / ONE);
  return h;
}

// ---- Binh bộ (phần 14.3.4) ----
const DU_PHONG_BINH: BinhBoRow[] = [
  { id: "bao_kich", ten: "Bạo Kích", lo: ["ngoai_cong"], an: "NG-BA-001", moc: [{ so: 2, tham_so: { critBonus: 20 } }, { so: 3, tham_so: { critDamage: 80 } }] },
  { id: "xuyen_pha", ten: "Xuyên Phá", lo: ["ngoai_cong"], an: "NG-BA-002", moc: [{ so: 2, tham_so: { xuyenGiap: 30 } }, { so: 3, tham_so: { resistPen: 30, xuyenGiap: 20 } }] },
  { id: "lien_kich", ten: "Liên Kích", lo: ["ngoai_cong"], an: "NG-BA-003", moc: [{ so: 2, tham_so: { attackSpeed: 30 } }, { so: 3, tham_so: { cooldownCut: 30 } }] },
  { id: "phap_nguyen", ten: "Pháp Nguyên", lo: ["noi_cong"], an: "NG-BA-004", moc: [{ so: 2, tham_so: { manaCostCut: 60 } }, { so: 3, tham_so: { innerDamage: 40 } }] },
  { id: "hap_hon", ten: "Hấp Hồn", lo: ["hap_thu"], an: "NG-BA-005", moc: [{ so: 2, tham_so: { lifesteal: 10 } }, { so: 3, tham_so: { manaDrain: 5 } }] },
  { id: "tran_thu", ten: "Trấn Thủ", lo: ["thu_ngoai", "thu_noi"], an: "NG-BA-006", moc: [{ so: 2, tham_so: { khienNhan: 50 } }, { so: 3, tham_so: { defOuter: 30, defInner: 30 } }] },
];
const BINH: BinhBoRow[] = S.binh_bo
  ? S.binh_bo.map((b) => ({ id: b.id, ten: b.ten, lo: list(b.lo), an: b.an, moc: [{ so: 2, tham_so: b.moc_2.tham_so }, { so: 3, tham_so: b.moc_3.tham_so }] }))
  : DU_PHONG_BINH;
const BINH_AN: Record<string, BinhBoRow> = {};
for (const b of BINH) BINH_AN[b.an] = b;
/** Ô nhận binh ấn: 3 ô công. */
export const BINH_AN_O = ["vu_khi", "bao_tay", "ngoc_boi"];
export const DONG_LO = S.luat?.binhBoDongLoHeSo ?? 1200;
/** Binh bộ của một binh ấn; không có thì báo. */
export function binhBoOf(ma: string): BinhBoRow {
  if (!has(BINH_AN, ma)) throw new Error(`Không có binh ấn ${ma}`);
  return BINH_AN[ma];
}

// ---- trang_bi.json: dòng rèn, dòng ẩn, điểm ----
interface TbData {
  dong_ren?: { so: number; nac: number }[];
  dong_an?: { ma: string; loai: "dieu_kien" | "hieu_ung"; nhom?: string; he_so?: number; tham_so: Record<string, number | string | boolean> }[];
  diem?: { stat: string; diem: number; moi: number }[];
  luat?: {
    dongAn?: { soDong: Record<string, number>; songAnHeSo: number; heSoNhom?: Record<string, number>; toiDaHieuLuc?: number };
    dongRen?: { heSoLoaiPhu: number };
  };
}
const TB = TRANG_BI as unknown as TbData;

/** Dòng rèn (phần 14.2.3): nấc mở từng dòng và phần giá trị của loại phụ. */
export const DONG_REN = {
  moc: TB.dong_ren ? TB.dong_ren.map((r) => r.nac) : [10, 20, 30, 40, 50],
  tyLe: TB.luat?.dongRen?.heSoLoaiPhu ?? 500,
};

// ---- Dòng ẩn (phần 14.3.5) ----
/** Số dòng ẩn theo độ hiếm (ngọc bội, đai). */
export const DONG_AN_SO: Record<string, number> = { luc: 0, ...(TB.luat?.dongAn?.soDong ?? { lam: 1, tim: 2, vang: 3, do: 3 }) };
export const DONG_AN_O = ["ngoc_boi", "dai"];
export const SONG_AN = TB.luat?.dongAn?.songAnHeSo ?? 1250;
/** Hệ số theo nhóm điều kiện: tĩnh (xét trước trận, gần như luôn đúng ở cuối game), theo loại trận, trong trận. */
const HE_SO_NHOM: Record<string, number> = { tinh: 200, loai_tran: 500, trong_tran: 1000, ...(TB.luat?.dongAn?.heSoNhom ?? {}) };
const DU_PHONG_NHOM: Record<string, string> = {
  "DN-DK-001": "tinh", "DN-DK-002": "tinh", "DN-DK-003": "tinh", "DN-DK-009": "tinh", "DN-DK-010": "tinh", "DN-DK-011": "tinh",
  "DN-DK-004": "loai_tran", "DN-DK-005": "loai_tran", "DN-DK-012": "loai_tran",
  "DN-DK-006": "trong_tran", "DN-DK-007": "trong_tran", "DN-DK-008": "trong_tran",
};
const NHOM: Record<string, string> = { ...DU_PHONG_NHOM };
const HE_SO_DK: Record<string, number> = {}; // hệ số ghi thẳng ở từng điều kiện (dong_an[].he_so) đứng trước hệ số nhóm
for (const r of TB.dong_an ?? []) {
  const n = r.nhom ?? (typeof r.tham_so.nhom === "string" ? r.tham_so.nhom : undefined);
  if (r.loai === "dieu_kien" && n) NHOM[r.ma] = n;
  if (r.loai === "dieu_kien" && typeof r.he_so === "number") HE_SO_DK[r.ma] = r.he_so;
}
/** Hệ số nhân hiệu ứng theo nhóm của điều kiện, phần nghìn. */
export function dongAnHeSo(dk: string): number {
  if (has(HE_SO_DK, dk)) return HE_SO_DK[dk];
  const n = NHOM[dk];
  if (!n || !has(HE_SO_NHOM, n)) throw new Error(`Điều kiện dòng ẩn ${dk} chưa có nhóm`);
  return HE_SO_NHOM[n];
}
/** Số dòng ẩn hiệu lực cùng lúc mỗi người (sim HIDDEN_RULES.maxActive phải khớp). */
export const DONG_AN_TOI_DA = TB.luat?.dongAn?.toiDaHieuLuc ?? 3;
/** Điều kiện tĩnh rules xét trước trận; điều kiện còn lại là HiddenCond sim xét trong trận. */
export type DongAnTinh = { loai: "bo"; mon: number } | { loai: "ngocSinh" } | { loai: "linhCanNgoc" } | { loai: "khiLinh"; cap: number };
export type DongAnDk = { loai: "tran"; cond: HiddenCond } | DongAnTinh;
const DU_PHONG_DK: Record<string, Record<string, number | string | boolean>> = {
  "DN-DK-001": { cungBoToiThieu: 4 }, "DN-DK-002": { haiNgocTuongSinh: true }, "DN-DK-003": { linhCanTrungNgoc: true },
  "DN-DK-004": { tran: "pve" }, "DN-DK-005": { tran: "chien_tranh" }, "DN-DK-006": { mauDuoi: 500 }, "DN-DK-007": { truocTicks: 200 },
  "DN-DK-008": { sauTicks: 600 }, "DN-DK-009": { hang: "truoc" }, "DN-DK-010": { hang: "sau" }, "DN-DK-011": { khiLinhCapToiThieu: 3 },
  "DN-DK-012": { dichKhacLinhCan: true },
};
const DU_PHONG_HU: Record<string, Record<string, number>> = {
  "DN-HU-001": { atk: 30 }, "DN-HU-002": { defOuter: 40 }, "DN-HU-003": { defInner: 40 }, "DN-HU-004": { critBonus: 20 },
  "DN-HU-005": { lifesteal: 10 }, "DN-HU-006": { manaCostCut: 50 }, "DN-HU-007": { hpRegen: 2 }, "DN-HU-008": { reflect: 30 },
  "DN-HU-009": { damageTakenCut: 20 }, "DN-HU-010": { attackSpeed: 20 }, "DN-HU-011": { cooldownCut: 20 }, "DN-HU-012": { khangHeKhacMinh: 30 },
};
const DK_ROWS: Record<string, Record<string, number | string | boolean>> = { ...DU_PHONG_DK };
const HU_ROWS: Record<string, Record<string, number | string | boolean>> = { ...DU_PHONG_HU };
for (const r of TB.dong_an ?? []) (r.loai === "dieu_kien" ? DK_ROWS : HU_ROWS)[r.ma] = r.tham_so;
/** Khóa hiệu ứng dòng ẩn trong dữ liệu → chỉ số trận của sim. */
const HU_STAT: Record<string, HiddenStat> = {
  atk: "atk", defOuter: "defOuter", defInner: "defInner", critBonus: "critBonus", lifesteal: "lifestealFlat", lifestealFlat: "lifestealFlat",
  manaCostCut: "manaCostCut", hpRegen: "hpRegen", reflect: "reflect", damageTakenCut: "damageTakenCut", attackSpeed: "attackSpeed",
  cooldownCut: "cooldownCut", khangHeKhacMinh: "counterResist",
};

/**
 * Điều kiện của một mã DN-DK. Ngưỡng máu, giây đầu, giây sau trong dữ liệu phải khớp HIDDEN_RULES của sim (kiểm ở test dữ liệu).
 */
export function dongAnDk(ma: string): DongAnDk {
  if (!has(DK_ROWS, ma)) throw new Error(`Không có điều kiện dòng ẩn ${ma}`);
  const t = DK_ROWS[ma];
  if (has(t, "cungBoToiThieu")) return { loai: "bo", mon: t.cungBoToiThieu as number };
  if (has(t, "haiNgocTuongSinh")) return { loai: "ngocSinh" };
  if (has(t, "linhCanTrungNgoc")) return { loai: "linhCanNgoc" };
  if (has(t, "khiLinhCapToiThieu")) return { loai: "khiLinh", cap: t.khiLinhCapToiThieu as number };
  if (t.tran === "pve") return { loai: "tran", cond: "pve" };
  if (t.tran === "chien_tranh") return { loai: "tran", cond: "war" };
  if (has(t, "mauDuoi")) return { loai: "tran", cond: "lowHp" };
  if (has(t, "truocTicks")) return { loai: "tran", cond: "opening" };
  if (has(t, "sauTicks")) return { loai: "tran", cond: "late" };
  if (t.hang === "truoc") return { loai: "tran", cond: "front" };
  if (t.hang === "sau") return { loai: "tran", cond: "back" };
  if (has(t, "dichKhacLinhCan")) return { loai: "tran", cond: "countered" };
  throw new Error(`Chưa biết đổi điều kiện dòng ẩn ${ma}`);
}
/** Ngưỡng trong dữ liệu của các điều kiện sim xét (để so với HIDDEN_RULES). */
export function dongAnNguong(): { mauDuoi?: number; truocTicks?: number; sauTicks?: number } {
  const out: { mauDuoi?: number; truocTicks?: number; sauTicks?: number } = {};
  for (const ma of Object.keys(DK_ROWS)) {
    const t = DK_ROWS[ma];
    for (const k of ["mauDuoi", "truocTicks", "sauTicks"] as const) if (typeof t[k] === "number") out[k] = t[k] as number;
  }
  return out;
}
/** Hiệu ứng của một mã DN-HU: chỉ số trận và giá trị phần nghìn. */
export function dongAnHu(ma: string): { stat: HiddenStat; giaTri: number } {
  if (!has(HU_ROWS, ma)) throw new Error(`Không có hiệu ứng dòng ẩn ${ma}`);
  const t = HU_ROWS[ma];
  const keys = Object.keys(t);
  if (keys.length !== 1 || !has(HU_STAT, keys[0]) || typeof t[keys[0]] !== "number") throw new Error(`Chưa biết đổi hiệu ứng dòng ẩn ${ma}`);
  return { stat: HU_STAT[keys[0]], giaTri: t[keys[0]] as number };
}
/** Hai ngọc tương sinh nhau (bảng tổ hợp mục 9). */
export const tuongSinh = (a: Element, b: Element): boolean => RELATION[a][b] === "tuong_sinh";

// ---- Điểm trang bị (phần 14.2.4) ----
const DIEM: Record<string, { diem: number; moi: number }> = {};
const DU_PHONG_DIEM: [string, number][] = [
  ["atk", 10], ["hp", 8], ["defOuter", 5], ["defInner", 5], ["critBonus", 12], ["critDamage", 3], ["attackSpeed", 10], ["cooldownCut", 12],
  ["armorPen", 6], ["resistPen", 6], ["elementDamage", 4], ["resist", 3], ["lifesteal", 15], ["manaDrain", 8], ["manaCostCut", 4],
  ["manaMax", 2], ["healTaken", 4], ["healPower", 4], ["shieldTaken", 3], ["damageTakenCut", 12], ["reflect", 6], ["controlTime", 3],
  ["innerDamage", 8], ["damageTakenCutOuter", 6], ["damageTakenCutInner", 6], ["controlTakenCut", 3], ["reflectTakenCut", 1],
];
for (const [stat, diem] of DU_PHONG_DIEM) DIEM[stat] = { diem, moi: 10 };
DIEM.hpRegen = { diem: 10, moi: 1 };
for (const r of TB.diem ?? []) DIEM[r.stat] = { diem: r.diem, moi: r.moi };

/** Điểm của một chỉ số trận (phần nghìn) theo bảng điểm; hút máu theo sát thương là khóa lifesteal, kháng hệ khắc mình là kháng. */
export function diemChiSo(stat: string, perMille: number): number {
  const key = stat === "lifestealFlat" ? "lifesteal" : stat === "counterResist" ? "resist" : stat;
  const w = DIEM[key];
  return w ? (perMille / w.moi) * w.diem : 0;
}

/** Phần chỉ số của bộ đồ cần để tính điểm (GearStats thỏa). */
export interface DiemInput {
  hp: number; atk: number; def: number; manaMax: number;
  bonuses: Partial<Record<BuffStat, number>>; resist: Partial<Record<Element, number>>; elementDamage: Partial<Record<Element, number>>;
}
/**
 * Điểm trang bị: mỗi chỉ số (phần nghìn; máu, công lực, phòng thủ, mana cộng thẳng đổi ra phần nghìn chỉ số chuẩn cùng cấp)
 * chia `moi` rồi nhân `diem`. Phòng thủ chung tính cho cả thủ ngoại và thủ nội; hút máu theo sát thương là khóa lifesteal của
 * bảng điểm. Sát thương hệ, kháng hệ lấy hệ cao nhất. Chỉ để hiển thị, so sánh, lọc chợ; không vào trận.
 */
export function diemTrangBi(g: DiemInput, level: number): number {
  const base = baseStats(level);
  const pct = (flat: number, chuan: number) => (chuan > 0 ? (flat * ONE) / chuan : 0);
  let d = 0;
  const add = (stat: string, perMille: number) => {
    const w = DIEM[stat];
    if (w) d += (perMille / w.moi) * w.diem;
  };
  add("hp", pct(g.hp, base.hp));
  add("atk", pct(g.atk, base.atk));
  add("defOuter", pct(g.def, base.def));
  add("defInner", pct(g.def, base.def));
  add("manaMax", pct(g.manaMax, BATTLE.manaMax));
  for (const k of Object.keys(g.bonuses) as BuffStat[]) add(k === "lifestealFlat" ? "lifesteal" : k, g.bonuses[k] ?? 0);
  const top = (r: Partial<Record<Element, number>>) => Object.keys(r).reduce((m, e) => Math.max(m, r[e as Element] ?? 0), 0);
  add("elementDamage", top(g.elementDamage));
  add("resist", top(g.resist));
  return Math.round(d);
}

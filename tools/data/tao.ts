// Dựng file số liệu data/he_thong/KhaiTongLapPhai_HeThong_v1.xlsx lần đầu, từ GDD (noi_dung.ts) và số đang chạy trong packages/sim.
// Từ đó file Excel là nguồn gốc: sửa trong Excel rồi chạy xuat.ts để ra JSON. Chạy lại tao.ts sẽ xóa mọi chỗ đã sửa tay,
// nên phải thêm --ghi-de.
//
// Chạy: node --experimental-strip-types --no-warnings tools/data/tao.ts [--ghi-de] [--thu <CSV 100 loài thú cưỡi>]
// CSV thú cưỡi mặc định: C:\Project\GDD\ThuCuoi_100_loai.csv (bảng tên ở GDD mục 6, kèm dáng, nơi gặp, mô tả).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  SKILL_TYPES, VARIANTS, TALENTS, SKILL_SPECS, ALLY_SKILLS, VARIANT_STATS, LINH_EFFECT_POWER, ELEMENT_STATS, ELEMENT_EFFECTS,
  ROOT_BUFFS, COMBO, BASE_CRIT_PER_MILLE, RESIST_CAP, SKILL_RULES, BATTLE, UNIT_CURVE, TALENT_RULES,
  elementMultiplier, comboRelation, parentOf, baseElement, isOpposite, generatesEither, beatsEither,
  type Element, type SkillType, type Variant,
} from "@ktlp/sim";
import { ELEMENT_NAMES, SKILL_TYPE_NAMES, VARIANT_NAMES, GRADE_NAMES, RULES } from "@ktlp/rules";
import { writeXlsx, colName, type Cell, type Fmt, type SheetOut } from "./xlsx.ts";
import * as B from "./bang.ts";
import * as N from "./noi_dung.ts";

const ROOT = new URL("../../", import.meta.url);
export const XLSX_URL = new URL("data/he_thong/KhaiTongLapPhai_HeThong_v1.xlsx", ROOT);

// ---------- quan hệ tổ hợp ----------

export type RelationId = (typeof N.RELATIONS)[number]["id"];
/** Quan hệ giữa hệ chủ và hệ phụ, cùng quy tắc với comboRelation ở technique.ts; cặp tương hợp lấy từ noi_dung.ts. */
export function relation(a: Element, b: Element): RelationId {
  if (a === b) return "thuan";
  if (isOpposite(a, b)) return "doi_cuc";
  if (N.HARMONY.some(([x, y]) => (x === a && y === b) || (x === b && y === a))) return "tuong_hop";
  if (parentOf(a) === b || parentOf(b) === a) return "tuong_sinh";
  const x = baseElement(a), y = baseElement(b);
  if (generatesEither(x, y)) return "tuong_sinh";
  if (beatsEither(x, y)) return "tuong_khac";
  return "trung_tinh";
}
const REL_T: Record<RelationId, number> = {
  thuan: COMBO.pure, tuong_sinh: COMBO.harmony, tuong_hop: COMBO.harmony, trung_tinh: COMBO.neutral, tuong_khac: COMBO.clash, doi_cuc: COMBO.polar,
};
const REL_MANA: Record<RelationId, number> = {
  thuan: 1000, tuong_sinh: 1000, tuong_hop: 1000, trung_tinh: 1000, tuong_khac: 1000, doi_cuc: COMBO.polarManaMul,
};
const relName = (r: RelationId) => N.RELATIONS.find((x) => x.id === r)!.name;

export function scrollName(e: Element, t: SkillType, v: Variant): string {
  return `${N.PREFIX[e][v]} ${suffix(e, t)}`;
}
function suffix(e: Element, t: SkillType): string {
  return N.SUFFIX_OVERRIDE[e]?.[t] ?? N.SUFFIX[t];
}

// ---------- công pháp mẫu (đề xuất) ----------

/** Biến thể chủ quyển và phụ quyển theo loại chiêu; Liên Hoàn, Châm lấy Linh + Bền như hai ví dụ trong GDD. */
const MAIN_VARIANT: Record<SkillType, Variant> = {
  can_don: "bao", can_quet: "linh", tam_xa: "linh", dien_rong: "bao", ho_the: "ben",
  bua_chu: "bao", tran_phap: "toc", hoi_phuc: "ben", khong_che: "linh", than_phap: "toc",
};
const SUB_VARIANT: Record<SkillType, Variant> = {
  can_don: "toc", can_quet: "ben", tam_xa: "ben", dien_rong: "ben", ho_the: "linh",
  bua_chu: "toc", tran_phap: "ben", hoi_phuc: "linh", khong_che: "toc", than_phap: "bao",
};
/** Công pháp 3 quyển (từ cấp tông môn 100): 5 loại chiêu mỗi hệ chủ, phụ quyển thứ hai là Linh. */
const TRIPLE_TYPES: SkillType[] = ["can_don", "tam_xa", "dien_rong", "tran_phap", "than_phap"];
/** Hai công pháp ví dụ ở GDD mục 9 nằm trong bộ mẫu, đúng nguyên công thức. */
const GDD_EXAMPLES: Partial<Record<Element, Partial<Record<SkillType, string>>>> = {
  loi: { can_quet: "quang.ho_the.ben", tam_xa: "am_lanh.tam_xa.ben" },
};

export interface Recipe { name: string; group: string; main: string; subs: string[]; grade: number }

export function recipes(): Recipe[] {
  const out: Recipe[] = [];
  const id = (e: Element, t: SkillType, v: Variant) => `${e}.${t}.${v}`;
  const short = (e: Element) => N.HE_INFO[e].short;
  for (const e of N.ELEMENT_ORDER) {
    // Bạn ghép: hệ tương sinh, tương hợp; hệ nào có ít hơn 2 (Quang, Âm lãnh) thì thêm hệ đối cực, rồi hệ trung tính.
    const others = N.ELEMENT_ORDER.filter((p) => p !== e);
    const partners = others.filter((p) => relation(e, p) === "tuong_sinh" || relation(e, p) === "tuong_hop");
    for (const r of ["doi_cuc", "trung_tinh"] as const) {
      for (const p of others) if (partners.length < 2 && relation(e, p) === r) partners.push(p);
    }
    SKILL_TYPES.forEach((t) => {
      out.push({
        name: `Thuần ${short(e)} ${suffix(e, t)} Quyết`, group: "2 quyển, thuần hệ",
        main: id(e, t, MAIN_VARIANT[t]), subs: [id(e, t, SUB_VARIANT[t])], grade: 1,
      });
    });
    SKILL_TYPES.forEach((t, i) => {
      const sub = GDD_EXAMPLES[e]?.[t] ?? id(partners[i % partners.length], t, SUB_VARIANT[t]);
      const p = sub.split(".")[0] as Element;
      out.push({ name: `${short(e)} ${short(p)} ${suffix(e, t)} Quyết`, group: "2 quyển, ghép hệ", main: id(e, t, MAIN_VARIANT[t]), subs: [sub], grade: 1 });
    });
    TRIPLE_TYPES.forEach((t, j) => {
      const p1 = partners[j % partners.length], p2 = partners[(j + 1) % partners.length];
      out.push({
        name: `${short(e)} ${short(p1)} ${short(p2)} ${suffix(e, t)} Quyết`, group: "3 quyển, cấp tông môn 100",
        main: id(e, t, MAIN_VARIANT[t]), subs: [id(p1, t, SUB_VARIANT[t]), id(p2, t, "linh")], grade: 1,
      });
    });
  }
  return out;
}

// ---------- dựng sheet ----------

type Box = { v?: string | number | null; f?: string; src?: B.Src; fmt?: Fmt };
type In = string | number | null | undefined | Box;

/** Số chữ số lẻ cần cho % (0–2). */
function pctFmt(v: number): Fmt {
  for (const [d, f] of [[0, "pct"], [1, "pct1"]] as const) {
    const x = v * 100 * 10 ** d;
    if (Math.abs(x - Math.round(x)) < 1e-9) return f;
  }
  return "pct2";
}
function fmtFor(kind: B.Kind, v: unknown): Fmt {
  if (kind === "pct" && typeof v === "number") return pctFmt(v);
  if (kind === "int" && typeof v === "number" && Math.abs(v) >= 1000) return "int";
  return "general";
}
const box = (x: In): Box => (x !== null && typeof x === "object" ? x : { v: x ?? null });

function table(def: B.TableDef, rows: Record<string, In>[], more: Partial<SheetOut> = {}): SheetOut {
  const out: (Cell | null)[][] = [def.cols.map((c) => ({ v: c.header, fill: "tieu_de", bold: true, wrap: true }))];
  for (const r of rows) {
    out.push(def.cols.map((c) => {
      const b = box(r[c.key]);
      const kind = c.kind === "qty" ? (box(r[c.unitCol!]).v === "%" ? "pct" : "num") : c.kind;
      const src = b.src ?? (b.f !== undefined ? "cong_thuc" : c.src);
      return { v: b.v ?? null, f: b.f, fill: B.SRC_FILL[src], fmt: b.fmt ?? fmtFor(kind, b.v) };
    }));
  }
  return { name: def.sheet, rows: out, widths: def.cols.map((c) => c.width ?? 12), freeze: { rows: 1, cols: 2 }, ...more };
}

function matrix(def: B.MatrixDef, cell: (a: Element, b: Element) => Box): SheetOut {
  const names = N.ELEMENT_ORDER.map((e) => ELEMENT_NAMES[e]);
  const rows: (Cell | null)[][] = [[{ v: def.corner, fill: "tieu_de", bold: true, wrap: true }, ...names.map((n) => ({ v: n, fill: "tieu_de" as const, bold: true }))]];
  for (const a of N.ELEMENT_ORDER) {
    rows.push([{ v: ELEMENT_NAMES[a], fill: "tieu_de", bold: true }, ...N.ELEMENT_ORDER.map((b) => {
      const x = cell(a, b);
      return { v: x.v ?? null, fill: B.SRC_FILL[x.src ?? "gdd"], fmt: x.fmt ?? "general" };
    })]);
  }
  return { name: def.sheet, rows, widths: [18, ...names.map(() => 10)], freeze: { rows: 1, cols: 1 } };
}

const L = (def: B.TableDef, key: string): string => {
  const i = def.cols.findIndex((c) => c.key === key);
  if (i < 0) throw new Error(`Không có cột ${key} trong ${def.sheet}`);
  return colName(i);
};
/** Cả cột của một sheet bảng, dùng trong INDEX/MATCH. */
const R = (def: B.TableDef, key: string) => `'${def.sheet}'!$${L(def, key)}:$${L(def, key)}`;
/** Tra tham số theo khóa, nên sắp xếp hay chèn dòng ở sheet Tham số không làm hỏng công thức. */
const P = (key: string) => `INDEX('${B.PARAMS.sheet}'!$D:$D,MATCH("${key}",'${B.PARAMS.sheet}'!$B:$B,0))`;
/** Tra cột `col` của dòng có cột `by` bằng `cell`. */
const LK = (def: B.TableDef, col: string, cell: string, by = "ten") => `INDEX(${R(def, col)},MATCH(${cell},${R(def, by)},0))`;

export function build(petCsv: string): SheetOut[] {
  const param: Record<string, number> = {};

  // Tham số
  const paramRows: (Cell | null)[][] = [B.PARAM_COLS.map((h) => ({ v: h, fill: "tieu_de" as const, bold: true }))];
  const srcLabel: Record<B.Src, string> = { gdd: "GDD", code: "code", de_xuat: "đề xuất", cong_thuc: "công thức" };
  const pushParam = (group: string, key: string, name: string, v: number | string, kieu: string, muc: string, src: B.Src) => {
    if (typeof v === "number") param[key] = v;
    const fmt: Fmt = kieu === "%" && typeof v === "number" ? pctFmt(v) : typeof v === "number" && Math.abs(v) >= 1000 && Number.isInteger(v) ? "int" : "general";
    paramRows.push([
      { v: group }, { v: key }, { v: name }, { v, fill: B.SRC_FILL[src], fmt }, { v: kieu },
      { v: muc ? `Mục ${muc}` : "" }, { v: srcLabel[src] },
    ]);
  };
  const extra = (g: string) => N.PARAMS_EXTRA.filter((p) => p[0] === g).forEach((p) => pushParam(...p));
  extra("kinh_te");
  extra("cong_phap");
  pushParam("cong_phap", "baseCrit", "Chí mạng gốc", BASE_CRIT_PER_MILLE / 1000, "%", "9", "gdd");
  pushParam("cong_phap", "resistCap", "Kháng hệ (từ ngọc) giảm tối đa", RESIST_CAP / 1000, "%", "", "code");
  extra("roi_do");
  extra("thu_cuoi");
  const codeObjs: Record<keyof typeof N.CODE_PARAMS, Record<string, number | boolean>> = { SKILL_RULES, BATTLE, UNIT_CURVE, TALENT_RULES };
  for (const g of Object.keys(N.CODE_PARAMS) as (keyof typeof N.CODE_PARAMS)[]) {
    const obj = codeObjs[g];
    const seen = new Set<string>();
    for (const [key, name, kieu, muc, src] of N.CODE_PARAMS[g]) {
      if (!(key in obj)) { console.warn(`Code không còn ${g}.${key}, bỏ qua`); continue; }
      seen.add(key);
      pushParam(g, key, name, B.paramFromCode(kieu, obj[key]), kieu, muc, src);
    }
    for (const key of Object.keys(obj)) {
      if (seen.has(key)) continue;
      console.warn(`${g}.${key} chưa có mô tả trong noi_dung.ts, ghi theo đơn vị code`);
      pushParam(g, key, key, obj[key] as number, "số", "", "code");
    }
  }
  const PARAM_SHEET: SheetOut = {
    name: B.PARAMS.sheet, rows: paramRows, widths: [12, 22, 58, 12, 9, 9, 9], freeze: { rows: 1, cols: 2 },
    lists: [{ ref: `E2:E${paramRows.length + 50}`, values: ["số", "%", "hệ số", "giây", "ô", "ô/giây", "có/không"] }],
  };

  // Hệ
  const effUnit = (e: Element, v: number) => (N.HE_INFO[e].effectUnit === "giây" ? v / 20 : v / 1000);
  const HE_ROWS = N.ELEMENT_ORDER.map((e) => {
    const eff = ELEMENT_EFFECTS[e], st = ELEMENT_STATS[e], buff = ROOT_BUFFS[e];
    const timeFromCode = e === "thuy" || e === "cuc_am"; // GDD chưa ghi thời gian
    return {
      ma: e, ten: ELEMENT_NAMES[e], chu: N.HE_INFO[e].short, nhom: N.HE_INFO[e].group, he_goc: parentOf(e) ?? null,
      ban_sac: N.HE_INFO[e].identity, hieu_ung: N.HE_INFO[e].effect, hieu_ung_gia_tri: effUnit(e, eff.value), hieu_ung_don_vi: N.HE_INFO[e].effectUnit,
      hieu_ung_thoi_gian: eff.ticks ? { v: eff.ticks / 20, src: timeFromCode ? "code" : "gdd" } : null,
      sat_thuong: st.dmg / 1000, chi_mang: st.crit / 1000, hoi_chieu: st.cd / 1000, mana: st.mana / 1000, tam: st.range / 1000,
      buff: N.HE_INFO[e].buff, buff_chi_so: buff.stat, buff_gia_tri: buff.value / 1000,
    } satisfies Record<string, In>;
  });

  // Loại chiêu, biến thể
  const LC_ROWS = SKILL_TYPES.map((t) => {
    const s = SKILL_SPECS[t];
    return {
      ma: t, ten: SKILL_TYPE_NAMES[t], k: s.k / 1000, muc_tieu: s.targets, hoi_chieu: s.cooldownTicks / 20, chi_mang: s.critPerMille / 1000,
      mana: s.mana, tam: s.range / 1000, ban_kinh: s.radius / 1000, dong_minh: ALLY_SKILLS.includes(t) ? "có" : "không",
      hau_to: N.SUFFIX[t], luat: N.SKILL_RULE_TEXT[t],
    };
  });
  const BT_ROWS = VARIANTS.map((v) => {
    const s = VARIANT_STATS[v];
    return {
      ma: v, ten: VARIANT_NAMES[v], sat_thuong: s.dmg / 1000, hoi_chieu: s.cd / 1000, chi_mang: s.crit / 1000, mana: s.mana / 1000,
      suc_hieu_ung: (v === "linh" ? LINH_EFFECT_POWER : 1000) / 1000, mo_ta: N.VARIANT_TEXT[v],
    };
  });

  // Phẩm
  const PH_ROWS = N.GRADE_INFO.map((g, i) => ({
    so: i + 1, ten: GRADE_NAMES[i], ten_cong_phap: `${GRADE_NAMES[i]} pháp`, vi_dien: g.plane,
    he_so: { f: `POWER(${P("gradeStep")},$A${i + 2}-1)`, v: param.gradeStep ** i },
    cap_hoc: g.learn ?? null, roi_ha: g.drop.ha ?? null, roi_trung: g.drop.trung ?? null, roi_than: g.drop.than ?? null, roi_thanh: g.drop.thanh ?? null,
    cong_hien: RULES.contributionPerScroll[i],
  }));

  // Tài năng
  const TN_ROWS = TALENTS.map((t) => {
    const [ten, chien_dau, kinh_te, dac_quyen] = N.TALENT_TEXT[t];
    return { ma: t, ten, ty_le: 1 / TALENTS.length, chien_dau, kinh_te, dac_quyen };
  });

  // Tàn quyển: chỉ số là công thức từ sheet Hệ và Biến thể
  const TQ = B.TAN_QUYEN, HE = B.HE, BT = B.BIEN_THE, LC = B.LOAI_CHIEU;
  const scrollF = (id: string) => {
    const [e, t, v] = id.split(".") as [Element, SkillType, Variant];
    const st = ELEMENT_STATS[e], vs = VARIANT_STATS[v];
    return { e, t, v, dmg: (st.dmg + vs.dmg) / 1000, crit: (st.crit + vs.crit) / 1000, cd: (st.cd + vs.cd) / 1000, mana: (st.mana + vs.mana) / 1000 };
  };
  const TQ_ROWS: Record<string, In>[] = [];
  for (const e of N.ELEMENT_ORDER) for (const t of SKILL_TYPES) for (const v of VARIANTS) {
    const n = TQ_ROWS.length + 2, id = `${e}.${t}.${v}`, s = scrollF(id);
    const A = `$A${n}`;
    const dot1 = `FIND(".",${A})`, dot2 = `FIND(".",${A},${dot1}+1)`;
    const sum = (col: string) => `${LK(HE, col, `$${L(TQ, "he")}${n}`)}+${LK(BT, col, `$${L(TQ, "bien_the")}${n}`)}`;
    TQ_ROWS.push({
      ma: id, ten: scrollName(e, t, v),
      he: { f: `INDEX(${R(HE, "ten")},MATCH(LEFT(${A},${dot1}-1),${R(HE, "ma")},0))`, v: ELEMENT_NAMES[e] },
      loai: { f: `INDEX(${R(LC, "ten")},MATCH(MID(${A},${dot1}+1,${dot2}-${dot1}-1),${R(LC, "ma")},0))`, v: SKILL_TYPE_NAMES[t] },
      bien_the: { f: `INDEX(${R(BT, "ten")},MATCH(MID(${A},${dot2}+1,20),${R(BT, "ma")},0))`, v: VARIANT_NAMES[v] },
      sat_thuong: { f: sum("sat_thuong"), v: s.dmg },
      chi_mang: { f: sum("chi_mang"), v: s.crit },
      hoi_chieu: { f: sum("hoi_chieu"), v: s.cd },
      mana: { f: sum("mana"), v: s.mana },
      tam: { f: LK(HE, "tam", `$${L(TQ, "he")}${n}`), v: ELEMENT_STATS[e].range / 1000 },
      suc_hieu_ung: { f: LK(BT, "suc_hieu_ung", `$${L(TQ, "bien_the")}${n}`), v: (v === "linh" ? LINH_EFFECT_POWER : 1000) / 1000 },
    });
  }

  // Công pháp mẫu
  const CP = B.CONG_PHAP, QH = B.QUAN_HE, PH = B.PHAM;
  const CP_ROWS = recipes().map((r, i) => {
    const n = i + 2, col = (k: string) => `$${L(CP, k)}${n}`;
    const [s1, s2] = r.subs;
    const main = scrollF(r.main), a = scrollF(s1), b = s2 ? scrollF(s2) : null;
    const rels = [relation(main.e, a.e), ...(b ? [relation(main.e, b.e)] : [])];
    const t = rels.reduce((x, y) => x + REL_T[y], 0) / rels.length / 1000;
    const manaMul = Math.max(...rels.map((y) => REL_MANA[y])) / 1000;
    const spec = SKILL_SPECS[main.t];
    const sub = (k: "dmg" | "crit" | "cd" | "mana") => a[k] + (b ? b[k] : 0);
    const tq = (k: string, cell: string) => LK(TQ, k, cell, "ma");
    const subs = (k: string) => `(${tq(k, col("phu_quyen_1"))}+IF(${col("phu_quyen_2")}="",0,${tq(k, col("phu_quyen_2"))}))`;
    const lc = (k: string) => LK(LC, k, col("loai"));
    const matrixAt = (row: string, c: string) => `INDEX('${B.TO_HOP.sheet}'!$A:$M,MATCH(${row},'${B.TO_HOP.sheet}'!$A:$A,0),MATCH(${c},'${B.TO_HOP.sheet}'!$1:$1,0))`;
    const T = (c: string) => LK(QH, "he_so", c);
    const MM = (c: string) => LK(QH, "mana", c);
    return {
      stt: i + 1, ten: r.name, nhom: r.group, chu_quyen: r.main, phu_quyen_1: s1, phu_quyen_2: s2 ?? null, pham: r.grade,
      loai: { f: tq("loai", col("chu_quyen")), v: SKILL_TYPE_NAMES[main.t] },
      he_chu: { f: tq("he", col("chu_quyen")), v: ELEMENT_NAMES[main.e] },
      he_phu_1: { f: tq("he", col("phu_quyen_1")), v: ELEMENT_NAMES[a.e] },
      he_phu_2: { f: `IF(${col("phu_quyen_2")}="","",${tq("he", col("phu_quyen_2"))})`, v: b ? ELEMENT_NAMES[b.e] : "" },
      quan_he_1: { f: matrixAt(col("he_chu"), col("he_phu_1")), v: relName(rels[0]) },
      quan_he_2: { f: `IF(${col("he_phu_2")}="","",${matrixAt(col("he_chu"), col("he_phu_2"))})`, v: rels[1] ? relName(rels[1]) : "" },
      t: { f: `IF(${col("quan_he_2")}="",${T(col("quan_he_1"))},(${T(col("quan_he_1"))}+${T(col("quan_he_2"))})/2)`, v: t },
      sat_thuong: {
        f: `100*${lc("k")}*${LK(PH, "he_so", col("pham"), "so")}*(1+${tq("sat_thuong", col("chu_quyen"))}+${P("subShare")}*${subs("sat_thuong")})*${col("t")}`,
        v: 100 * (spec.k / 1000) * param.gradeStep ** (r.grade - 1) * (1 + main.dmg + param.subShare * sub("dmg")) * t,
      },
      muc_tieu: { f: lc("muc_tieu"), v: spec.targets },
      chi_mang: {
        f: `${P("baseCrit")}+${lc("chi_mang")}+${tq("chi_mang", col("chu_quyen"))}+${P("subShare")}*${subs("chi_mang")}`,
        v: param.baseCrit + spec.critPerMille / 1000 + main.crit + param.subShare * sub("crit"), fmt: "pct",
      },
      hoi_chieu: {
        f: `${lc("hoi_chieu")}*(1+${tq("hoi_chieu", col("chu_quyen"))}+${P("subShare")}*${subs("hoi_chieu")})`,
        v: (spec.cooldownTicks / 20) * (1 + main.cd + param.subShare * sub("cd")),
      },
      mana: {
        f: `${lc("mana")}*(1+${tq("mana", col("chu_quyen"))}+${P("subShare")}*${subs("mana")})*MAX(${MM(col("quan_he_1"))},IF(${col("quan_he_2")}="",1,${MM(col("quan_he_2"))}))`,
        v: spec.mana * (1 + main.mana + param.subShare * sub("mana")) * manaMul,
      },
    } satisfies Record<string, In>;
  });
  const names = new Set(CP_ROWS.map((r) => r.ten));
  if (names.size !== CP_ROWS.length) throw new Error("Tên công pháp mẫu bị trùng");

  // Vị diện, vùng
  const VD = B.VI_DIEN;
  const VUNG_ROWS: Record<string, In>[] = [];
  const byName = Object.fromEntries(N.ELEMENT_ORDER.map((e) => [ELEMENT_NAMES[e], e])) as Record<string, Element>;
  for (const plane of ["ha", "trung", "than", "thanh"] as const) {
    const file = JSON.parse(readFileSync(new URL(`data/maps/${plane}_toa_do.json`, ROOT), "utf8")) as { centres: { name: string; x: number; y: number }[] };
    file.centres.forEach((c, i) => {
      let name: string, els: Element[], drops: Element[], main: number | null, src: B.Src;
      if (plane === "ha") {
        const m = /^(.*) \((.*)\)$/.exec(c.name);
        if (!m || !byName[m[2]]) throw new Error(`Không đọc được tên vùng ${c.name}`);
        name = m[1]; els = [byName[m[2]]]; drops = N.HA_DROPS[els[0]]; main = param.mainElementShare; src = "gdd";
      } else {
        [name, els] = N.UPPER_REGIONS[plane][i]; drops = els; main = null; src = "de_xuat";
      }
      const list = (xs: Element[]) => xs.map((e) => ELEMENT_NAMES[e]).join(", ");
      VUNG_ROWS.push({
        ma: { v: slug(name), src }, ten: { v: name, src }, vi_dien: plane, thu_tu: i + 1,
        he: { v: list(els), src }, he_roi: { v: list(drops), src }, ty_le_he_dau: main, x: c.x, y: c.y,
      });
    });
  }

  // Cấp tông môn: 200 dòng, các cột tính bằng công thức từ sheet Tham số
  const CT = B.CAP_TONG_MON;
  const CT_ROWS: Record<string, In>[] = [];
  let xpTotal = 0;
  const maxLevel = param.maxSectLevel;
  for (let lv = 1; lv <= maxLevel; lv++) {
    const n = lv + 1, A = `$A${n}`;
    const xp = lv >= maxLevel ? 0 : Math.round(param.xpCoef * lv ** param.xpExp);
    const members = Math.floor(param.membersBase + lv * param.membersPerLevel);
    const scale = N.SCALES.find((s) => lv <= s[0])!;
    const unlock = N.UNLOCKS.find((u) => u[0] === lv);
    const milestone = N.POINT_MILESTONES.some((m) => m[0] === lv);
    CT_ROWS.push({
      cap: lv,
      xp_len_cap: { f: `IF(${A}>=${P("maxSectLevel")},0,ROUND(${P("xpCoef")}*POWER(${A},${P("xpExp")}),0))`, v: xp },
      xp_tich_luy: lv === 1 ? { v: 0, src: "cong_thuc" } : { f: `$${L(CT, "xp_tich_luy")}${n - 1}+$${L(CT, "xp_len_cap")}${n - 1}`, v: xpTotal },
      ngay: { f: `$${L(CT, "xp_tich_luy")}${n}/${P("xpPerDay")}`, v: xpTotal / param.xpPerDay, fmt: "dec2" },
      thanh_vien: { f: `INT(${P("membersBase")}+${A}*${P("membersPerLevel")})`, v: members },
      diem_giu: { v: pointsAt(lv), src: milestone ? "gdd" : "de_xuat" },
      tam: { f: `MIN(${P("rangeMax")},1+INT(${A}/${P("rangeLevelStep")}))`, v: Math.min(param.rangeMax, 1 + Math.floor(lv / param.rangeLevelStep)) },
      suat_truyen_thu: {
        f: `MIN(${P("transmissionMax")},${P("transmissionBase")}+INT(${A}/${P("transmissionPerLevels")}))`,
        v: Math.min(param.transmissionMax, param.transmissionBase + Math.floor(lv / param.transmissionPerLevels)),
      },
      tieu_truyen_tong: { f: `INT(${A}/${P("miniPortalLevels")})`, v: Math.floor(lv / param.miniPortalLevels) },
      npc_chien: {
        f: `INT(${A}/${P("npcLevelDiv")})+INT($${L(CT, "thanh_vien")}${n}/${P("npcMemberDiv")})`,
        v: Math.floor(lv / param.npcLevelDiv) + Math.floor(members / param.npcMemberDiv),
      },
      moi_truong_lao: {
        f: `MIN(${P("elderInviteMax")},${P("elderInviteBase")}+${A}*${P("elderInvitePerLevel")})`,
        v: Math.min(param.elderInviteMax, param.elderInviteBase + lv * param.elderInvitePerLevel), fmt: "pct1",
      },
      quy_mo: scale[1], pho_tong_chu: scale[2], truong_lao: scale[3], duong_chu: scale[4],
      mo_khoa: unlock ? { v: unlock[1], src: unlock[2] } : null,
    });
    xpTotal += xp;
  }

  // Mỏ
  const MO_ROWS: Record<string, In>[] = [];
  const maxMine = Math.max(...N.PLANES.map((p) => box(p.cap_mo_toi_da).v as number));
  for (let lv = 1; lv <= maxMine; lv++) {
    const n = lv + 1, A = `$A${n}`;
    const perHour = Math.round(param.mineCoef * lv ** param.mineExp);
    MO_ROWS.push({
      cap: lv,
      san_luong_gio: { f: `ROUND(${P("mineCoef")}*POWER(${A},${P("mineExp")}),0)`, v: perHour },
      san_luong_ngay: { f: `$${L(B.MO, "san_luong_gio")}${n}*24`, v: perHour * 24 },
      chi_phi_nang: {
        f: `IF(${A}>=MAX(${R(VD, "cap_mo_toi_da")}),"",ROUND(${P("mineUpgradeCoef")}*POWER(${A},${P("mineUpgradeExp")}),0))`,
        v: lv >= maxMine ? "" : Math.round(param.mineUpgradeCoef * lv ** param.mineUpgradeExp),
      },
    });
  }

  // Bí cảnh: phần thần vật, thiên cấp, linh cấp nội suy theo tỷ lệ rơi gốc (rơi gốc càng thấp càng ở mức cao, GDD mục 11)
  const BC_ROWS = N.SECRET_REALMS.map(([name, rate, strength], i) => {
    const n = i + 2, r = `$${L(B.BI_CANH, "roi_goc")}${n}`;
    const pos = (param.dropRateMax - rate) / (param.dropRateMax - param.dropRateMin);
    const share = (lo: string, hi: string) => ({
      f: `${P(lo)}+(${P(hi)}-${P(lo)})*(${P("dropRateMax")}-${r})/(${P("dropRateMax")}-${P("dropRateMin")})`,
      v: param[lo] + (param[hi] - param[lo]) * pos, fmt: "pct1" as Fmt,
    });
    const god = share("godItemMin", "godItemMax"), heaven = share("heavenItemMin", "heavenItemMax"), spirit = share("spiritItemMin", "spiritItemMax");
    const c = (k: string) => `$${L(B.BI_CANH, k)}${n}`;
    return {
      ma: slug(name), ten: name, roi_goc: rate, the_manh: strength, than_vat: god, thien_cap: heaven, linh_cap: spirit,
      tan_quyen: { f: `1-${c("than_vat")}-${c("thien_cap")}-${c("linh_cap")}`, v: 1 - god.v - heaven.v - spirit.v, fmt: "pct1" as Fmt },
    };
  });

  // Thú cưỡi
  const TP = B.THU_PHAM;
  const pets = parseCsv(petCsv);
  const petHeader = pets.shift()!;
  const at = (row: string[], name: string) => row[petHeader.indexOf(name)];
  const THU_ROWS = pets.filter((r) => r.length > 1).map((r, i) => {
    const grade = at(r, "pham");
    return {
      stt: Number(at(r, "stt")), ma: at(r, "ma_hinh").split("/").pop()!, ten: at(r, "ten"), he: at(r, "he"), pham: grade,
      dang: at(r, "dang"), gap_o: at(r, "gap_o"), mvp: at(r, "mvp"), mo_ta: at(r, "mo_ta"), ma_hinh: at(r, "ma_hinh"),
      cong_chi_so: { f: LK(TP, "cong_chi_so", `$${L(B.THU, "pham")}${i + 2}`), v: N.PET_GRADES.find((g) => g[1] === grade)![4] },
    };
  });

  const bool = (def: B.TableDef, key: string, rows: number) => ({ ref: `${L(def, key)}2:${L(def, key)}${rows + 1}`, values: ["có", "không"] });
  return [
    noteSheet(),
    PARAM_SHEET,
    table(HE, HE_ROWS),
    matrix(B.KHAC_CHE, (a, b) => ({ v: elementMultiplier(a, b) / 1000 })),
    table(QH, N.RELATIONS.map((r) => ({ ma: r.id, ten: r.name, he_so: REL_T[r.id] / 1000, mana: REL_MANA[r.id] / 1000, vi_du: r.example, quy_tac: r.rule }))),
    {
      ...matrix(B.TO_HOP, (a, b) => {
        const r = relation(a, b);
        return { v: relName(r), src: REL_T[r] === comboRelation(a, b).t ? "code" : "de_xuat" };
      }),
      lists: [{ ref: "B2:M13", values: N.RELATIONS.map((r) => r.name) }],
    },
    table(LC, LC_ROWS, { lists: [bool(LC, "dong_minh", LC_ROWS.length)] }),
    table(BT, BT_ROWS),
    table(PH, PH_ROWS),
    table(B.TAI_NANG, TN_ROWS),
    table(TQ, TQ_ROWS),
    table(CP, CP_ROWS),
    table(VD, N.PLANES),
    table(B.VUNG, VUNG_ROWS),
    table(CT, CT_ROWS, { freeze: { rows: 1, cols: 1 } }),
    table(B.MO, MO_ROWS, { freeze: { rows: 1, cols: 1 } }),
    table(B.BI_CANH, BC_ROWS),
    table(B.THU, THU_ROWS, { lists: [bool(B.THU, "mvp", THU_ROWS.length)] }),
    table(TP, N.PET_GRADES.map(([ma, ten, so_loai, gap_o, cong_chi_so, ban_tren_cho, luyen_hoa_them]) => ({ ma, ten, so_loai, gap_o, cong_chi_so, ban_tren_cho, luyen_hoa_them }))),
    table(B.THU_CANH_GIOI, N.PET_REALMS),
    table(B.THU_KICH_PHAT, N.PET_SETS.map(([ma, ten, dieu_kien, hieu_ung]) => ({ ma, ten, dieu_kien, hieu_ung }))),
    table(B.LINH_DON, N.PET_PILLS.map(([ma, ten, cap, cong_dung, nguyen_lieu, cho]) => ({ ma, ten, cap, cong_dung, nguyen_lieu, cho }))),
  ];
}

/** Điểm giữ tối đa: nội suy giữa các mốc GDD mục 5, làm tròn xuống (đề xuất). */
function pointsAt(lv: number): number {
  const m = N.POINT_MILESTONES;
  for (let i = 1; i < m.length; i++) {
    const [a, va] = m[i - 1], [b, vb] = m[i];
    if (lv <= b) return Math.floor(va + ((vb - va) * (lv - a)) / (b - a));
  }
  return m[m.length - 1][1];
}

function noteSheet(): SheetOut {
  const t = (v: string, more: Partial<Cell> = {}): (Cell | null)[] => [{ v, ...more }];
  const legend = (fill: Cell["fill"], v: string): (Cell | null)[] => [{ v: "", fill }, { v }];
  const rows: (Cell | null)[][] = [
    t("Khai Tông Lập Phái — file số liệu hệ thống v1", { bold: true }),
    t("Dựng lại ngày 2026-11-02 từ GDD (Claude Docs rev 162) và code trong repo, vì file gốc không còn. Mọi số GDD nhắc là \"lấy từ file Excel\" nằm ở đây."),
    t("File này là nguồn gốc. Sửa trong Excel, lưu lại, rồi chạy lệnh dưới đây ở thư mục repo để xuất JSON cho code và chạy phép kiểm:"),
    t("node --experimental-strip-types --no-warnings tools/data/xuat.ts", { bold: true }),
    [],
    t("Màu ô", { bold: true }),
    legend("gdd", "Số hoặc chữ có trong GDD (kể cả chỗ GDD còn ghi \"đề xuất\")"),
    legend("code", "Lấy từ code đang chạy (packages/sim, packages/rules); GDD chưa có"),
    legend("de_xuat", "Đề xuất mới khi dựng file này, chờ duyệt"),
    legend("cong_thuc", "Công thức: đừng gõ đè, sửa ô nguồn hoặc sheet Tham số"),
    legend("tieu_de", "Tiêu đề: đừng đổi chữ, vì script tìm cột theo chữ tiêu đề"),
    [],
    t("Quy ước", { bold: true }),
    t("Tỷ lệ ghi dạng phần trăm (10%), hệ số ghi số thập phân (1,5), thời gian theo giây, khoảng cách theo ô. JSON đổi sang đơn vị của code: phần nghìn, tick (20 mỗi giây), milli-ô."),
    t("Sheet Tham số: cột Kiểu quyết định cách đổi sang JSON (số, %, hệ số, giây, ô, ô/giây, có/không). Công thức ở các sheet khác tra tham số theo cột Khóa."),
    t("Thêm dòng thì thêm ở cuối bảng; cột Mã không được trùng. Tên hệ, loại chiêu, biến thể, quan hệ tổ hợp dùng làm khóa tra cứu giữa các sheet."),
    t("Ma trận Khắc chế và Tổ hợp: dòng là hệ đánh (hệ chủ), cột là hệ bị đánh (hệ phụ). Ô Tổ hợp chọn từ danh sách 6 quan hệ; hệ số nằm ở sheet Quan hệ tổ hợp."),
    [],
    t("Các sheet", { bold: true }),
    ...[
      ["Tham số", "Hằng số chung: kinh tế, ghép công pháp, rơi đồ, thú cưỡi, và các nhóm trận đấu lấy từ code (SKILL_RULES, BATTLE, UNIT_CURVE, TALENT_RULES)"],
      ["Hệ", "12 hệ: hiệu ứng đặc trưng, chỉ số kèm, buff luyện đúng hệ (GDD mục 3, 9)"],
      ["Khắc chế", "Ma trận 12 × 12 hệ số sát thương (GDD mục 8)"],
      ["Quan hệ tổ hợp, Tổ hợp", "6 quan hệ với hệ số t và ma trận 12 × 12 quan hệ hệ chủ – hệ phụ (GDD mục 9)"],
      ["Loại chiêu, Biến thể, Phẩm", "10 loại chiêu, 4 biến thể, 10 phẩm và tỷ lệ phẩm rơi theo vị diện (GDD mục 6, 8, 9, 11)"],
      ["Tài năng", "8 tài năng (GDD mục 6); số trong trận nằm ở Tham số, nhóm TALENT_RULES"],
      ["Tàn quyển", "480 tàn quyển; tên đề xuất = tiền tố theo hệ và biến thể + hậu tố theo loại chiêu"],
      ["Công pháp mẫu", "300 công thức ghép mẫu (25 mỗi hệ chủ); chỉ số tính bằng công thức GDD mục 9. STT 137 và 138 là hai ví dụ trong GDD"],
      ["Vị diện, Vùng", "4 vị diện, 28 vùng; tên và hệ 16 vùng thượng vị là đề xuất (GDD mục 3, 11, 12)"],
      ["Cấp tông môn", "Cấp 1–200: XP, ngày ước tính, thành viên, điểm giữ, tầm, mở khóa (GDD mục 5, 6, 9, 10)"],
      ["Mỏ, Bí cảnh", "Sản lượng và chi phí nâng mỏ cấp 1–100; 20 loại bí cảnh và phần rơi (GDD mục 11, 12)"],
      ["Thú cưỡi, Thú phẩm, Thú cảnh giới, Thú kích phát, Linh đơn", "Phần thú cưỡi ở GDD mục 6; số trong đó GDD còn ghi là đề xuất"],
    ].map(([a, b]) => [{ v: a, bold: true }, { v: b }] as (Cell | null)[]),
  ];
  return { name: B.NOTE_SHEET, rows, widths: [28, 140] };
}

export function slug(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D")
    .toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false;
  text = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const csvAt = args.indexOf("--thu");
  const csv = csvAt >= 0 ? args[csvAt + 1] : "C:\\Project\\GDD\\ThuCuoi_100_loai.csv";
  const out = fileURLToPath(XLSX_URL);
  if (existsSync(out) && !args.includes("--ghi-de")) {
    console.error(`${out} đã có. File Excel là nguồn gốc nên tao.ts không ghi đè; thêm --ghi-de nếu thật sự muốn dựng lại từ đầu.`);
    process.exit(1);
  }
  const sheets = build(readFileSync(csv, "utf8"));
  mkdirSync(new URL(".", XLSX_URL), { recursive: true });
  writeFileSync(out, writeXlsx(sheets));
  console.log(`Đã ghi ${out}: ${sheets.length} sheet`);
  for (const s of sheets) console.log(`  ${s.name}: ${s.rows.length - 1} dòng`);
}

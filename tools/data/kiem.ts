// Phép kiểm file số liệu sau khi xuất JSON.
//   Lỗi: dữ liệu hỏng, thiếu, trùng; hai công pháp ví dụ ở GDD mục 9 không ra 105 và 95; ma trận khắc chế khác elements.ts.
//   Cần xem: chỗ dữ liệu khác code đang chạy (code chưa đọc JSON), khác mốc trong GDD, hoặc Excel chưa tính lại công thức.
import {
  ELEMENTS, SKILL_TYPES, VARIANTS, SKILL_SPECS, VARIANT_STATS, ELEMENT_STATS, ELEMENT_EFFECTS, ROOT_BUFFS, GRADE_POW, LINH_EFFECT_POWER,
  SKILL_RULES, BATTLE, UNIT_CURVE, TALENT_RULES, BASE_CRIT_PER_MILLE,
  elementMultiplier, comboRelation, composeTechnique, mul, ONE, type Element, type SkillType, type Variant,
} from "@ktlp/sim";
import { existsSync, readFileSync } from "node:fs";
import type { Raw } from "./xuat.ts";
import { TB_FILES } from "./trang_bi.ts";

const TRANG_BI_DIR = new URL("../../data/trang_bi/", import.meta.url);

/** Các đường dẫn khác nhau giữa hai giá trị JSON (bỏ qua thứ tự khóa), tối đa `limit` chỗ. */
function diffJson(a: unknown, b: unknown, path = "", out: string[] = [], limit = 5): string[] {
  if (out.length >= limit) return out;
  if (a !== null && b !== null && typeof a === "object" && typeof b === "object" && Array.isArray(a) === Array.isArray(b)) {
    const keys = new Set([...Object.keys(a as object), ...Object.keys(b as object)]);
    for (const k of keys) diffJson((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], Array.isArray(a) ? `${path}[${k}]` : `${path}.${k}`, out, limit);
  } else if (JSON.stringify(a) !== JSON.stringify(b)) out.push(`${path || "(gốc)"}: file ${JSON.stringify(a)?.slice(0, 60)}, data/trang_bi ${JSON.stringify(b)?.slice(0, 60)}`);
  return out;
}

type Any = any; // eslint-disable-line @typescript-eslint/no-explicit-any

export interface Report { errors: string[]; warnings: string[]; notes: string[] }

/** Ghép công pháp bằng số trong JSON, cùng phép tính số nguyên như composeTechnique của packages/sim. */
export function composeFromData(d: Any, mainId: string, subIds: string[], grade: number) {
  const sc = (id: string) => {
    const [e, t, v] = id.split(".") as [Element, SkillType, Variant];
    const es = d["he.json"][e].stats, vs = d["bien_the.json"][v];
    return { e, t, v, dmg: es.dmg + vs.dmg, crit: es.crit + vs.crit, cd: es.cd + vs.cd, mana: es.mana + vs.mana };
  };
  const m = sc(mainId), subs = subIds.map(sc);
  const spec = d["loai_chieu.json"][m.t];
  const sum = (k: "dmg" | "crit" | "cd" | "mana") => subs.reduce((a, s) => a + s[k], 0);
  const share = d["tham_so.json"].cong_phap.subShare;
  const rels = subs.map((s) => d["to_hop.json"].combo[m.e][s.e]);
  const t = Math.trunc(rels.reduce((a: number, r: Any) => a + r.t, 0) / rels.length);
  const manaMul = Math.max(...rels.map((r: Any) => r.manaMul));
  let damage = mul(100 * ONE, spec.k);
  damage = mul(damage, d["pham.json"][grade - 1].power);
  damage = mul(damage, ONE + m.dmg + mul(sum("dmg"), share));
  damage = mul(damage, t);
  let mana = mul(spec.mana, ONE + m.mana + mul(sum("mana"), share));
  if (manaMul !== ONE) mana = mul(mana, manaMul);
  return {
    damage, targets: spec.targets, mana, combo: t,
    critPerMille: d["tham_so.json"].cong_phap.baseCrit + spec.critPerMille + m.crit + mul(sum("crit"), share),
    cooldownTicks: Math.max(1, mul(spec.cooldownTicks, ONE + m.cd + mul(sum("cd"), share))),
  };
}

export function kiem(d: Any, raw: Raw): Report {
  const errors: string[] = [], warnings: string[] = [], notes: string[] = [];
  const he = d["he.json"], names = (e: string) => he[e]?.name ?? e;

  // 12 hệ đúng mã của code
  const ids = Object.keys(he);
  if (ids.length !== 12 || ELEMENTS.some((e) => !he[e])) errors.push(`Sheet Hệ phải có đúng 12 hệ với mã ${ELEMENTS.join(", ")}`);

  // Khắc chế khớp elements.ts
  const kc = d["khac_che.json"];
  const kcDiff: string[] = [];
  for (const a of ELEMENTS) for (const b of ELEMENTS) {
    const v = kc[a]?.[b], want = elementMultiplier(a, b);
    if (v !== want) kcDiff.push(`${names(a)} đánh ${names(b)}: file ${v / 1000}, code ${want / 1000}`);
  }
  if (kcDiff.length) errors.push(`Khắc chế khác packages/sim/src/elements.ts ở ${kcDiff.length} ô: ${kcDiff.slice(0, 6).join("; ")}`);
  else notes.push("Khắc chế: 144 ô khớp elementMultiplier ở packages/sim/src/elements.ts");

  // Tổ hợp: đủ ô, đường chéo thuần, đối xứng; chỗ khác quy tắc tạm của code
  const rel = d["to_hop.json"].relation;
  const comboDiff: string[] = [];
  for (const a of ELEMENTS) for (const b of ELEMENTS) {
    const r = rel[a]?.[b];
    if (!r) { errors.push(`Tổ hợp thiếu ô ${names(a)} × ${names(b)}`); continue; }
    if (a === b && r !== "thuan") errors.push(`Tổ hợp ${names(a)} × ${names(a)} phải là Thuần`);
    if (rel[b]?.[a] !== r) warnings.push(`Tổ hợp không đối xứng: ${names(a)} × ${names(b)} khác ${names(b)} × ${names(a)}`);
    const t = d["to_hop.json"].combo[a][b].t, code = comboRelation(a, b).t;
    if (t !== code && a < b) comboDiff.push(`${names(a)} + ${names(b)} ×${t / 1000} (code ×${code / 1000})`);
  }
  if (comboDiff.length) warnings.push(`Hệ số tổ hợp khác quy tắc tạm ở technique.ts (${comboDiff.length} cặp): ${comboDiff.join("; ")}`);
  else notes.push("Tổ hợp: 144 ô khớp comboRelation ở packages/sim/src/technique.ts");

  // Hai ví dụ GDD mục 9, tính bằng số trong file và bằng packages/sim. Lôi Quang ra 105 từ khi chốt hệ số tổ hợp mới
  // ngày 2026-11-02 (tương hợp ×1,05; GDD rev 150), trước đó là 110.
  const examples: [string, number, number, number, number][] = [
    ["Lôi Quang Liên Hoàn Quyết", 105_000, 5, 80, 40],
    ["Lôi Âm Châm Quyết", 95_000, 2, 120, 20],
  ];
  const recipes = d["cong_phap_mau.json"] as Any[];
  for (const [name, dmg, targets, crit, cd] of examples) {
    const r = recipes.find((x) => x.name === name);
    if (!r) { errors.push(`Không thấy công pháp ví dụ "${name}" trong sheet Công pháp mẫu`); continue; }
    const got = composeFromData(d, r.main, r.subs, r.grade);
    const ok = got.damage === dmg && got.targets === targets && got.critPerMille === crit && got.cooldownTicks === cd;
    const show = (x: Any) => `${x.damage / 1000} · ${x.targets} mục tiêu · ${x.critPerMille / 10}% · ${x.cooldownTicks / 20} s`;
    if (ok) notes.push(`${name}: ${show(got)}, khớp GDD mục 9`);
    else errors.push(`${name}: ra ${show(got)}, GDD mục 9 ghi ${show({ damage: dmg, targets, critPerMille: crit, cooldownTicks: cd })}`);
    const sim = composeTechnique(scroll(r.main, r.grade), r.subs.map((s: string) => scroll(s, r.grade)));
    if (sim.damage !== got.damage || sim.critPerMille !== got.critPerMille || sim.cooldownTicks !== got.cooldownTicks || sim.manaCost !== got.mana)
      warnings.push(`${name}: packages/sim ra ${show(sim)}, mana ${sim.manaCost}; file ra mana ${got.mana}`);
  }

  // Tàn quyển: đủ 480, mỗi tổ hợp một lần, tên không trùng
  const scrolls = d["tan_quyen.json"] as Any[];
  const sIds = new Set(scrolls.map((s) => s.id));
  const sNames = new Set(scrolls.map((s) => s.name));
  let missing = 0;
  for (const e of ELEMENTS) for (const t of SKILL_TYPES) for (const v of VARIANTS) if (!sIds.has(`${e}.${t}.${v}`)) missing++;
  if (scrolls.length !== 480 || missing || sIds.size !== scrolls.length) errors.push(`Tàn quyển: ${scrolls.length} dòng, ${sIds.size} mã khác nhau, thiếu ${missing} tổ hợp hệ × loại × biến thể`);
  else if (sNames.size !== scrolls.length) errors.push(`Tàn quyển: ${scrolls.length - sNames.size} tên bị trùng`);
  else notes.push("Tàn quyển: 480 mã đủ 12 hệ × 10 loại × 4 biến thể, 480 tên khác nhau");

  // Công pháp mẫu: mã tàn quyển có thật, tên không trùng, số trong Excel khớp phép tính
  const cpRaw = raw["Công pháp mẫu"];
  const cpNames = new Set(recipes.map((r) => r.name));
  if (cpNames.size !== recipes.length) errors.push(`Công pháp mẫu: ${recipes.length - cpNames.size} tên bị trùng`);
  let stale = 0;
  recipes.forEach((r, i) => {
    const bad = [r.main, ...r.subs].filter((s: string) => !sIds.has(s));
    if (bad.length) { errors.push(`Công pháp mẫu "${r.name}": không có tàn quyển ${bad.join(", ")}`); return; }
    if (r.subs.length < 1 || r.subs.length > 2) errors.push(`Công pháp mẫu "${r.name}": cần 1–2 phụ quyển`);
    if (!(r.grade >= 1 && r.grade <= 10)) errors.push(`Công pháp mẫu "${r.name}": phẩm ${r.grade} ngoài 1–10`);
    const got = composeFromData(d, r.main, r.subs, r.grade);
    const x = cpRaw[i];
    if (typeof x?.sat_thuong === "number" && Math.abs(x.sat_thuong - got.damage / 1000) > 0.05) stale++;
  });
  if (stale) warnings.push(`Công pháp mẫu: ${stale} dòng có sát thương trong Excel khác phép tính; mở file bằng Excel rồi lưu lại để tính lại công thức`);
  else notes.push(`Công pháp mẫu: ${recipes.length} công pháp, mã tàn quyển đều có, sát thương trong Excel khớp phép tính của sim`);
  if (recipes.length !== 300) warnings.push(`Công pháp mẫu: ${recipes.length} dòng, GDD mục 9 ghi 300`);

  // Phẩm
  const pham = d["pham.json"] as Any[];
  if (pham.length !== 10) errors.push(`Phẩm: ${pham.length} dòng, cần 10`);
  const powDiff = pham.filter((p, i) => p.power !== GRADE_POW[i]).map((p) => `phẩm ${p.grade}: ${p.power} (code ${GRADE_POW[p.grade - 1]})`);
  if (powDiff.length) warnings.push(`Hệ số phẩm khác GRADE_POW: ${powDiff.join("; ")}`);
  for (const plane of ["ha", "trung", "than", "thanh"]) {
    const sum = pham.reduce((a, p) => a + (p.drop?.[plane] ?? 0), 0);
    if (sum !== 1000) errors.push(`Phẩm rơi ở ${plane}: tổng ${sum / 10}%, cần 100%`);
  }

  // Vị diện, vùng
  const planes = d["vi_dien.json"], vung = Object.values(d["vung.json"]) as Any[];
  for (const [p, info] of Object.entries(planes) as [string, Any][]) {
    const n = vung.filter((v) => v.plane === p).length;
    if (n !== info.regions) errors.push(`Vùng: ${info.name} có ${n} vùng, sheet Vị diện ghi ${info.regions}`);
  }
  for (const v of vung) {
    const sum = Object.values(v.dropWeights as Record<string, number>).reduce((a, b) => a + b, 0);
    if (sum !== 1000) errors.push(`Vùng ${v.name}: trọng số rơi tổng ${sum}`);
    if (v.plane === "ha" && (v.dropElements.length !== 4 || v.dropElements[0] !== v.elements[0]))
      errors.push(`Vùng ${v.name}: Hạ vị cần 4 hệ rơi, hệ đầu là hệ của vùng`);
  }
  if (vung.length === 28) notes.push("Vùng: 28 vùng (12 Hạ vị, 9 Trung vị, 5 Thần vực, 2 Thánh vực), trọng số rơi mỗi vùng đủ 100%");

  // Cấp tông môn: mốc ngày ở GDD mục 5 (2,5 triệu XP mỗi ngày)
  const cap = d["cap_tong_mon.json"] as Any[];
  const kt = d["tham_so.json"].kinh_te;
  let total = 0, xpBad = 0;
  cap.forEach((row, i) => {
    if (row.level !== i + 1) errors.push(`Cấp tông môn: dòng ${i + 2} ghi cấp ${row.level}`);
    const xp = row.level >= kt.maxSectLevel ? 0 : Math.round(kt.xpCoef * row.level ** kt.xpExp);
    if (row.xpTotal !== total || row.xpToNext !== xp) xpBad++;
    total += xp;
  });
  if (xpBad) warnings.push(`Cấp tông môn: ${xpBad} dòng XP khác công thức ở Tham số; mở file bằng Excel rồi lưu lại để tính lại`);
  const milestones: [number, number, number][] = [[10, 0.1, 1], [30, 1, 0], [50, 4, 0], [100, 24, 0], [150, 69, 0], [200, 147, 0]];
  const dayDiff: string[] = [], dayShow: string[] = [];
  for (const [lv, want, digits] of milestones) {
    const row = cap[lv - 1];
    if (!row) continue;
    const days = row.xpTotal / kt.xpPerDay;
    const shown = Number(days.toFixed(digits));
    dayShow.push(`cấp ${lv}: ${days.toFixed(2)}`);
    if (shown !== want) dayDiff.push(`cấp ${lv} ra ${days.toFixed(2)} ngày, GDD ghi ${want}`);
  }
  if (dayDiff.length) warnings.push(`Mốc ngày khác GDD mục 5: ${dayDiff.join("; ")}`);
  else notes.push(`Cấp tông môn: mốc ngày khớp GDD mục 5 khi làm tròn (${dayShow.join(", ")})`);
  const gddRows: [number, number, number, number][] = [[1, 3, 1, 10], [10, 4, 1, 12], [30, 6, 1, 17], [50, 8, 2, 22], [100, 12, 3, 35], [150, 16, 4, 47], [200, 20, 5, 60]];
  const rowDiff = gddRows.filter(([lv, pts, range, mem]) => {
    const r = cap[lv - 1];
    return r && (r.maxPoints !== pts || r.range !== range || r.members !== mem);
  });
  if (rowDiff.length) warnings.push(`Cấp tông môn khác bảng GDD mục 5 ở cấp ${rowDiff.map((r) => r[0]).join(", ")} (điểm giữ, tầm, thành viên)`);
  else notes.push("Cấp tông môn: điểm giữ, tầm, thành viên khớp 7 mốc ở GDD mục 5");

  // Bí cảnh
  const bc = Object.values(d["bi_canh.json"]) as Any[];
  for (const b of bc) {
    const s = b.share, sum = s.thanVat + s.thienCap + s.linhCap + s.tanQuyen;
    if (Math.abs(sum - 1000) > 1) errors.push(`Bí cảnh ${b.name}: phần rơi tổng ${sum / 10}%`);
  }
  if (bc.length !== 20) warnings.push(`Bí cảnh: ${bc.length} loại, GDD mục 11 ghi 20`);

  // Thú cưỡi
  const pets = d["thu_cuoi.json"] as Any[], petGrades = d["thu_pham.json"];
  const petIds = new Set(pets.map((p) => p.id));
  if (petIds.size !== pets.length) errors.push("Thú cưỡi: mã bị trùng");
  for (const [g, info] of Object.entries(petGrades) as [string, Any][]) {
    const n = pets.filter((p) => p.grade === g).length;
    if (n !== info.species) warnings.push(`Thú cưỡi phẩm ${info.name}: ${n} loài, sheet Thú phẩm ghi ${info.species}`);
  }
  if (pets.length === 100) notes.push("Thú cưỡi: 100 loài, số loài mỗi phẩm khớp sheet Thú phẩm");

  // Trang bị: số món, mã không trùng, và so với data/trang_bi (nguồn cũ của phiên set đồ) khi thư mục đó còn
  if (d["trang_bi.json"]) {
    const tb = d["trang_bi.json"], ngoc = d["ngoc.json"], set = d["set.json"], pb = d["phap_bao.json"], pk = d["phap_khi.json"], vp = d["vat_pham.json"];
    const codes = [
      ...tb.kieu, ...ngoc.he, ...ngoc.y_chau, ...ngoc.an_bo, ...pb.mon, ...pb.tran_giao, ...pk.mon, ...vp.phu, ...vp.dan, ...vp.nguyen_lieu,
    ].map((x: Any) => x.ma_vp);
    const dup = codes.filter((x, i) => codes.indexOf(x) !== i);
    if (dup.length) errors.push(`Trang bị: mã vật phẩm trùng ${[...new Set(dup)].slice(0, 8).join(", ")}`);
    const ids = new Set(tb.do_hiem.map((x: Any) => x.id)), slots = new Set(tb.o.map((x: Any) => x.id));
    const badKieu = tb.kieu.filter((k: Any) => !ids.has(k.do_hiem) || !slots.has(k.o)).map((k: Any) => k.ma_vp);
    if (badKieu.length) errors.push(`Kiểu trang bị có độ hiếm hoặc ô lạ: ${badKieu.slice(0, 8).join(", ")}`);
    const an = new Set(ngoc.an_bo.map((x: Any) => x.ma_vp));
    const badSet = set.bo.filter((b: Any) => !an.has(b.an) || b.moc.length !== set.moc.length).map((b: Any) => b.id);
    if (badSet.length) errors.push(`Set: ấn bộ lạ hoặc thiếu mốc ở ${badSet.join(", ")}`);
    notes.push(`Trang bị: ${tb.kieu.length} kiểu, ${pb.mon.length} pháp bảo, ${pk.mon.length} pháp khí, ${set.bo.length} bộ set, ${codes.length} mã vật phẩm không trùng`);
    if (existsSync(new URL("trang_bi.json", TRANG_BI_DIR))) {
      const changed = TB_FILES.flatMap((f) => {
        const src = JSON.parse(readFileSync(new URL(f, TRANG_BI_DIR), "utf8"));
        return diffJson(d[f], src).map((x) => `${f}${x}`);
      });
      if (changed.length) warnings.push(`Trang bị khác data/trang_bi (nguồn cũ của phiên set đồ; file Excel là nguồn gốc): ${changed.join("; ")}`);
      else notes.push(`Trang bị: ${TB_FILES.length} file khớp từng phần tử với data/trang_bi`);
    }
  }

  // Chỗ khác code đang chạy (code chưa đọc JSON thì phải sửa tay theo file)
  const diff: string[] = [];
  const cmp = (label: string, file: number | boolean | undefined, code: number | boolean | undefined) => {
    if (file !== code) diff.push(`${label}: file ${file}, code ${code}`);
  };
  const lc = d["loai_chieu.json"];
  for (const t of SKILL_TYPES) for (const k of ["k", "targets", "cooldownTicks", "critPerMille", "mana", "range", "radius"] as const)
    cmp(`Loại chiêu ${t}.${k}`, lc[t]?.[k], SKILL_SPECS[t][k]);
  for (const v of VARIANTS) {
    for (const k of ["dmg", "crit", "cd", "mana"] as const) cmp(`Biến thể ${v}.${k}`, d["bien_the.json"][v]?.[k], VARIANT_STATS[v][k]);
    cmp(`Biến thể ${v}.effectPower`, d["bien_the.json"][v]?.effectPower, v === "linh" ? LINH_EFFECT_POWER : ONE);
  }
  for (const e of ELEMENTS) {
    for (const k of ["dmg", "crit", "cd", "mana", "range"] as const) cmp(`Hệ ${e}.stats.${k}`, he[e]?.stats?.[k], ELEMENT_STATS[e][k]);
    cmp(`Hệ ${e}.effect.value`, he[e]?.effect?.value, ELEMENT_EFFECTS[e].value);
    cmp(`Hệ ${e}.effect.ticks`, he[e]?.effect?.ticks, ELEMENT_EFFECTS[e].ticks);
    cmp(`Hệ ${e}.rootBuff.value`, he[e]?.rootBuff?.value, ROOT_BUFFS[e].value);
  }
  const ts = d["tham_so.json"];
  const groups = { SKILL_RULES, BATTLE, UNIT_CURVE, TALENT_RULES } as Record<string, Record<string, number | boolean>>;
  for (const [g, obj] of Object.entries(groups)) for (const [k, v] of Object.entries(obj)) cmp(`${g}.${k}`, ts[g]?.[k], v);
  cmp("cong_phap.baseCrit", ts.cong_phap?.baseCrit, BASE_CRIT_PER_MILLE);
  if (diff.length) warnings.push(`Khác số đang chạy trong packages/sim (${diff.length} chỗ): ${diff.join("; ")}`);
  else notes.push("Loại chiêu, biến thể, hệ, tham số trận đấu: khớp số đang chạy trong packages/sim");

  return { errors, warnings, notes };
}

function scroll(id: string, grade: number) {
  const [element, type, variant] = id.split(".") as [Element, SkillType, Variant];
  return { element, type, variant, grade };
}

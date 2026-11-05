// Phép kiểm file số liệu sau khi xuất JSON.
//   Lỗi: dữ liệu hỏng, thiếu, trùng; hai công pháp ví dụ ở GDD mục 9 không ra 105 và 95; ma trận khắc chế khác elements.ts.
//   Cần xem: chỗ dữ liệu khác code đang chạy (code chưa đọc JSON), khác mốc trong GDD, hoặc Excel chưa tính lại công thức.
import {
  ELEMENTS, SKILL_TYPES, VARIANTS, SKILL_SPECS, VARIANT_STATS, ELEMENT_STATS, ELEMENT_EFFECTS, ROOT_BUFFS, GRADE_POW, LINH_EFFECT_POWER,
  SKILL_RULES, CAST_FLOOR, BATTLE, UNIT_CURVE, TALENT_RULES, ARTIFACT_RULES, BASE_CRIT_PER_MILLE, RESIST_CAP, COUNTER_FLOOR, DAMAGE_KIND, HIDDEN_RULES,
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
      ...tb.kieu, ...ngoc.he, ...ngoc.y_chau, ...ngoc.an_bo, ...(ngoc.song_he ?? []), ...(ngoc.phach ?? []), ...(d["thu_phat_trien.json"]?.thien_phu ?? []), ...(ngoc.binh_an ?? []), ...(set.bo_tron ?? []), ...pb.mon, ...pb.tran_giao, ...pk.mon, ...vp.phu, ...vp.dan, ...vp.nguyen_lieu,
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

  // Trần mềm của ngọc: mức tính một nửa không vượt mức tối đa; tối đa kháng từ ngọc không vượt tổng kháng mọi nguồn
  const tran = d["ngoc.json"]?.tran;
  if (tran) {
    const bad: string[] = [];
    if (!(tran.satThuongMem <= tran.satThuongToiDa)) bad.push(`satThuongMem ${tran.satThuongMem} > satThuongToiDa ${tran.satThuongToiDa}`);
    if (!(tran.khangMem <= tran.khangToiDa)) bad.push(`khangMem ${tran.khangMem} > khangToiDa ${tran.khangToiDa}`);
    const cap = d["tham_so.json"].cong_phap?.resistCap;
    if (cap !== undefined && tran.khangToiDa > cap) bad.push(`khangToiDa ${tran.khangToiDa} > resistCap ${cap}`);
    if (bad.length) errors.push(`Ngọc, trần mềm: ${bad.join("; ")}`);
    else notes.push(`Ngọc: trần mềm sát thương ${tran.satThuongMem / 10}% → tối đa ${tran.satThuongToiDa / 10}%, kháng ${tran.khangMem / 10}% → ${tran.khangToiDa / 10}%; tổng kháng mọi nguồn ${cap / 10}%`);
  }

  // Đạo Cơ Bàn: lục giác 19 ô bán kính 2, ô tâm chỉ nhận ấn, mạch đủ 6 quan hệ tổ hợp, hệ ấn hợp lệ
  const dcb = d["dao_co_ban.json"];
  if (dcb) {
    const o = dcb.o as Any[];
    const dist = (x: Any) => Math.max(Math.abs(x.q), Math.abs(x.r), Math.abs(x.q + x.r));
    const ring: Record<string, number> = { tam: 0, trong: 1, canh: 2, goc: 2 };
    const near = (a: Any, b: Any) => [[1, 0], [-1, 0], [0, 1], [0, -1], [1, -1], [-1, 1]].some(([dq, dr]) => a.q + dq === b.q && a.r + dr === b.r);
    const bad: string[] = [];
    if (o.length !== 19) bad.push(`${o.length} ô, cần 19`);
    if (new Set(o.map((x) => x.ma)).size !== o.length) bad.push("mã ô trùng");
    if (new Set(o.map((x) => `${x.q},${x.r}`)).size !== o.length) bad.push("tọa độ trùng");
    for (const x of o) {
      if (ring[x.vong] === undefined || dist(x) !== ring[x.vong]) bad.push(`${x.ma}: vòng ${x.vong} không khớp tọa độ (${x.q}, ${x.r})`);
      const inner = o.filter((y) => y.vong === "trong" && near(x, y)).length;
      if (x.vong === "canh" && inner !== 2) bad.push(`${x.ma}: ô cạnh kề ${inner} ô vòng trong, cần 2`);
      if (x.vong === "goc" && inner !== 1) bad.push(`${x.ma}: ô góc kề ${inner} ô vòng trong, cần 1`);
      const accept = [...(x.chi_nhan ?? [])].sort().join(",");
      if (x.vong === "tam" ? accept !== "an" : accept !== "an,ngoc") bad.push(`${x.ma}: nhận "${accept}"`);
    }
    // Ô mở: vị diện có thật, cảnh giới 1–9, có cấp trừ Thần vực trở lên; số ô mở cộng dồn theo cảnh giới như đặc tả phần 1
    for (const x of o) {
      const m = x.mo ?? {};
      if (!d["vi_dien.json"][m.viDien]) bad.push(`${x.ma}: vị diện mở lạ ${m.viDien}`);
      if (!(m.canhGioi >= 1 && m.canhGioi <= 9)) bad.push(`${x.ma}: cảnh giới mở ${m.canhGioi} ngoài 1–9`);
      if ((m.viDien === "ha" || m.viDien === "trung") !== (m.cap !== undefined)) bad.push(`${x.ma}: cấp mở ${m.cap} không hợp vị diện ${m.viDien}`);
    }
    const open = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((g) => o.filter((x) => (x.mo?.canhGioi ?? 99) <= g).length).join("/");
    if (open !== "1/3/5/7/10/13/16/18/19") bad.push(`số ô mở theo cảnh giới ${open}, đặc tả ghi 1/3/5/7/10/13/16/18/19`);
    const rels = Object.keys(d["quan_he_to_hop.json"]);
    const mach = dcb.mach ?? {};
    const noMach = rels.filter((r) => !(r in mach));
    if (noMach.length) bad.push(`thiếu mạch cho quan hệ ${noMach.join(", ")}`);
    const machKinds = new Set(Object.values(mach));
    for (const c of dcb.cong_huong ?? []) if (!machKinds.has(c.mach)) bad.push(`cộng hưởng ${c.ten}: mạch lạ ${c.mach}`);
    for (const a of d["ngoc.json"].an_bo as Any[]) if (a.he !== undefined && a.he !== null && !he[a.he]) bad.push(`ấn ${a.ma_vp}: hệ lạ ${a.he}`);
    if (bad.length) errors.push(`Đạo Cơ Bàn: ${bad.join("; ")}`);
    else notes.push(`Đạo Cơ Bàn: 19 ô lục giác bán kính 2 (ô cạnh kề 2, ô góc kề 1 ô vòng trong), ${(dcb.cong_huong ?? []).length} cộng hưởng, mạch đủ ${rels.length} quan hệ tổ hợp`);
  }

  // Luyện khí sau cấp tối đa: tẩy luyện loại 1 là chỉ số phụ mặc định, khí linh cộng dồn đúng, Phách đủ 12 hệ, danh khí có kiểu đỏ
  const lk = d["luyen_khi.json"];
  if (lk && d["trang_bi.json"]) {
    const tb = d["trang_bi.json"], ngoc = d["ngoc.json"], bad: string[] = [];
    for (const o of tb.o as Any[]) {
      const rows = (lk.tay_luyen as Any[]).filter((x) => x.o === o.id);
      const l1 = rows.find((x) => x.loai === 1);
      if (rows.length !== 4 || new Set(rows.map((x) => x.stat)).size !== 4) bad.push(`tẩy luyện ${o.id}: cần 4 loại khác nhau, có ${rows.length}`);
      if (!l1 || l1.stat !== o.phu.stat || l1.gia_tri !== o.phu.gia_tri) bad.push(`tẩy luyện ${o.id}: loại 1 phải là chỉ số phụ mặc định ${o.phu.stat} ${o.phu.gia_tri}`);
    }
    let sum = 0;
    for (const k of lk.khi_linh as Any[]) {
      sum += k.kinh_nghiem;
      if (k.kinh_nghiem_tich_luy !== sum) bad.push(`khí linh cấp ${k.cap}: tích lũy ${k.kinh_nghiem_tich_luy}, cộng dồn ra ${sum}`);
    }
    const slotsOpen = (lk.khi_linh as Any[]).filter((k) => k.mo_o_khi_van).length;
    const khiVanMax = Math.max(...Object.values(lk.luat.khiVanToiDa as Record<string, number>));
    if (slotsOpen !== khiVanMax) bad.push(`khí linh mở ${slotsOpen} ô khí văn, luat.khiVanToiDa cao nhất ${khiVanMax}`);
    for (const g of ["cong", "thu"]) if ((lk.khi_van as Any[]).filter((v) => v.nhom === g).length < 3) bad.push(`khí văn nhóm ${g} dưới 3 lựa chọn`);
    if (new Set((lk.khi_van as Any[]).map((v) => v.ma)).size !== lk.khi_van.length) bad.push("mã khí văn trùng");
    const rarities = new Set(tb.do_hiem.map((x: Any) => x.id));
    for (const p of lk.phan_giai as Any[]) if (!rarities.has(p.do_hiem)) bad.push(`phân giải: độ hiếm lạ ${p.do_hiem}`);
    const phachHe = (ngoc.phach ?? []).map((p: Any) => p.he);
    if (ELEMENTS.some((e) => !phachHe.includes(e)) || phachHe.length !== ELEMENTS.length) bad.push(`Ngọc Phách: ${phachHe.length} viên, cần đúng 12 hệ`);
    for (const p of ngoc.phach ?? []) if (tran && !(p.tran_toi_da > tran.satThuongToiDa)) bad.push(`${p.ma_vp}: trần nâng ${p.tran_toi_da} không cao hơn trần ngọc ${tran.satThuongToiDa}`);
    const kieu = new Map((tb.kieu as Any[]).map((k) => [k.ma_vp, k]));
    const shapes = new Set(d["vu_khi.json"].khi_hinh.map((k: Any) => k.id));
    const nl = new Set(d["vat_pham.json"].nguyen_lieu.map((x: Any) => x.ma_vp));
    for (const dk of lk.danh_khi as Any[]) {
      const k = kieu.get(dk.ma_vp);
      if (!k || k.o !== "vu_khi" || k.do_hiem !== "do" || k.khi_hinh !== dk.khi_hinh || k.ten !== dk.ten) bad.push(`${dk.ma_vp}: cần kiểu vũ khí đỏ cùng tên, khí hình ở Kiểu trang bị`);
      if (!shapes.has(dk.khi_hinh)) bad.push(`${dk.ma_vp}: khí hình lạ ${dk.khi_hinh}`);
      if (!nl.has(dk.do_pho)) bad.push(`${dk.ma_vp}: đồ phổ ${dk.do_pho} không có ở Nguyên liệu rèn`);
      if (dk.tham_so !== undefined && !(dk.tham_so && Object.keys(dk.tham_so).length)) bad.push(`${dk.ma_vp}: thiếu tham số danh văn`);
    }
    for (const v of lk.khi_van as Any[]) {
      const m = v.tham_so?.nguongMau;
      if (m !== undefined && !(m > 0 && m < 1000)) bad.push(`${v.ma}: nguongMau ${m} ngoài 0–1000`);
    }
    if (new Set((lk.danh_khi as Any[]).map((x) => x.khi_hinh)).size !== lk.danh_khi.length) bad.push("danh khí: hai món cùng khí hình");
    for (const m of ["NL-KT-001", "NL-KT-002"]) if (!nl.has(m)) bad.push(`thiếu nguyên liệu ${m}`);
    const tang = lk.te_luyen_tang as Any[];
    if (tang.some((t, i) => i > 0 && !(t.linh_luc > tang[i - 1].linh_luc && t.hoi_chieu < tang[i - 1].hoi_chieu))) bad.push("tế luyện tầng: linh lực phải tăng, hồi chiêu phải giảm dần");
    // Tẩy luyện: giá linh thạch đủ mọi độ hiếm, tăng dần; song hệ: tỷ lệ đậu 0–100%, phù giữ có thật
    const gia = lk.luat?.tayLuyenLinhThach;
    if (gia) {
      const order = (tb.do_hiem as Any[]).map((x) => x.id);
      if (order.some((r) => typeof gia[r] !== "number") || order.some((r, i) => i > 0 && !(gia[r] > gia[order[i - 1]]))) bad.push(`tẩy luyện: luat.tayLuyenLinhThach cần đủ ${order.join(", ")} và tăng dần`);
    }
    const phu = new Set(d["vat_pham.json"].phu.map((x: Any) => x.ma_vp));
    for (const s of ngoc.song_he ?? []) {
      if (s.ty_le_dau !== undefined && !(s.ty_le_dau > 0 && s.ty_le_dau <= 1000)) bad.push(`${s.ma_vp}: tỷ lệ đậu ${s.ty_le_dau} ngoài 0–1000`);
      if (s.phu_giu !== undefined && !phu.has(s.phu_giu)) bad.push(`${s.ma_vp}: phù giữ ${s.phu_giu} không có ở sheet Phù`);
    }
    // Bảo Giám: loại thưởng theo thứ được đếm (GDD tab Trang bị phần 13 rev 47)
    const thuong: Record<string, string> = { phap_bao: "danh_hieu", phach: "danh_hieu", phap_khi: "o_kho", an_bo: "o_tui", y_chau: "khi_tinh", danh_khi: "anh_sang_vu_khi" };
    for (const p of lk.bao_giam as Any[]) {
      if (p.loai_thuong === undefined || p.dem?.loai === "an_van") continue; // Ẩn văn có thưởng riêng từng trang
      const want = p.dem?.loai === "trang_bi" ? (p.dem.o === "vu_khi" ? "anh_sang_vu_khi" : "khung_o") : thuong[p.dem?.loai];
      if (p.loai_thuong !== want) bad.push(`Bảo Giám ${p.ma}: loại thưởng ${p.loai_thuong}, cần ${want}`);
    }
    // Bảo Giám: số kiểu cần đủ của mỗi trang bằng số kiểu có thật
    const pool: Record<string, Any[]> = {
      trang_bi: tb.kieu, phap_bao: d["phap_bao.json"].mon, phap_khi: d["phap_khi.json"].mon, y_chau: ngoc.y_chau, an_bo: ngoc.an_bo,
      phach: ngoc.phach ?? [], danh_khi: lk.danh_khi,
    };
    for (const p of lk.bao_giam as Any[]) {
      const { loai, ...loc } = p.dem ?? {};
      if (loai === "an_van") {
        // Một cặp điều kiện × hiệu ứng của dòng ẩn; dieu_kien: các cặp của điều kiện đó; bat_ky: đủ so_luong cặp bất kỳ
        const da = (tb.dong_an ?? []) as Any[], dk = da.filter((x) => x.loai === "dieu_kien"), hu = da.filter((x) => x.loai === "hieu_ung");
        if (loc.dieu_kien && !dk.some((x) => x.ma === loc.dieu_kien)) { bad.push(`Bảo Giám ${p.ma}: điều kiện lạ ${loc.dieu_kien}`); continue; }
        const n = loc.dieu_kien ? hu.length : dk.length * hu.length;
        if (loc.bat_ky ? !(p.so_luong > 0 && p.so_luong < n) : p.so_luong !== n) bad.push(`Bảo Giám ${p.ma}: cần đủ ${p.so_luong}, có ${n} cặp ẩn văn`);
        continue;
      }
      const list = pool[loai];
      if (!list) { bad.push(`Bảo Giám ${p.ma}: loại đếm lạ ${loai}`); continue; }
      const n = list.filter((x) => Object.entries(loc).every(([k, v]) => x[k === "phap_bao" ? "loai" : k] === v)).length;
      if (n !== p.so_luong) bad.push(`Bảo Giám ${p.ma}: cần đủ ${p.so_luong}, có ${n} kiểu`);
    }
    if (bad.length) errors.push(`Luyện khí: ${bad.join("; ")}`);
    else notes.push(`Luyện khí: tẩy luyện ${lk.tay_luyen.length} dòng (loại 1 khớp chỉ số phụ mặc định), khí linh ${lk.khi_linh.length - 1} cấp, ${lk.khi_van.length} khí văn, ${phachHe.length} Phách, ${lk.danh_khi.length} danh khí, ${lk.bao_giam.length} trang Bảo Giám`);
  }

  // Set đồ 2.0: bậc ấn theo độ hiếm, hợp bộ đủ quan hệ, binh bộ có binh ấn, bộ trọn đủ bộ thường, dòng ẩn, dòng rèn, điểm
  const set2 = d["set.json"];
  if (set2?.bac_an) {
    const tb = d["trang_bi.json"], ngoc = d["ngoc.json"], bad: string[] = [];
    const LO = ["ngoai_cong", "noi_cong", "thu_ngoai", "thu_noi", "hap_thu", "phan_chan", "khong_toc", "kinh_te", "khac_che"];
    const bac = set2.bac_an as Any[];
    if (bac.map((b) => b.ma).join(",") !== (tb.do_hiem as Any[]).map((x) => x.id).join(",")) bad.push("bậc ấn phải theo đúng 5 độ hiếm");
    if (bac.some((b, i) => i > 0 && !(b.he_so > bac[i - 1].he_so))) bad.push("hệ số bậc ấn phải tăng dần");
    if (bac.find((b) => b.ma === "tim")?.he_so !== 1000) bad.push("bậc tím phải là ×1,0 (số mốc ghi ở bậc tím)");
    const rels = Object.keys(d["quan_he_to_hop.json"]), hop = (set2.hop_bo ?? []) as Any[];
    const noRel = rels.filter((r) => !hop.some((h) => h.quan_he === r));
    if (noRel.length || hop.length !== rels.length) bad.push(`hợp bộ thiếu quan hệ ${noRel.join(", ")}`);
    for (const b of set2.bo as Any[]) if (b.lo !== undefined && !LO.includes(b.lo)) bad.push(`bộ ${b.id}: lộ lạ ${b.lo}`);
    const binhAn = new Map(((ngoc.binh_an ?? []) as Any[]).map((x) => [x.ma_vp, x]));
    const congSlots = (tb.o as Any[]).filter((o) => o.ngoc === "cong").map((o) => o.id).sort().join(",");
    for (const b of (set2.binh_bo ?? []) as Any[]) {
      const a = binhAn.get(b.an);
      if (!a || a.binh_bo !== b.id) bad.push(`binh bộ ${b.id}: binh ấn ${b.an} không khớp`);
      if (a && [...a.chi_kham_vao].sort().join(",") !== congSlots) bad.push(`${b.an}: chỉ khảm vào phải là 3 ô công ${congSlots}`);
      for (const l of b.lo ?? []) if (!LO.includes(l)) bad.push(`binh bộ ${b.id}: lộ lạ ${l}`);
      if (!b.moc_2?.tham_so || !b.moc_3?.tham_so) bad.push(`binh bộ ${b.id}: thiếu tham số mốc 2 hoặc 3`);
    }
    const thuong = (set2.bo as Any[]).filter((b) => !b.than).map((b) => b.id);
    const tron = (set2.bo_tron ?? []) as Any[];
    if (tron.map((t) => t.bo).join(",") !== thuong.join(",")) bad.push(`bộ trọn cần đúng ${thuong.length} bộ thường, có ${tron.length}`);
    const an = (tb.dong_an ?? []) as Any[];
    const dk = an.filter((x) => x.loai === "dieu_kien").length, hu = an.filter((x) => x.loai === "hieu_ung").length;
    if (dk !== 12 || hu !== 12 || an.length !== 24) bad.push(`dòng ẩn: ${dk} điều kiện, ${hu} hiệu ứng, cần 12 và 12`);
    const NHOM = ["tinh", "loai_tran", "trong_tran"];
    for (const x of an) {
      if (x.loai === "dieu_kien" && x.nhom !== undefined && (!NHOM.includes(x.nhom) || !(x.he_so > 0 && x.he_so <= 1000))) bad.push(`${x.ma}: nhóm ${x.nhom} hoặc hệ số ${x.he_so} lạ`);
      if (x.loai === "hieu_ung" && x.nhom !== undefined) bad.push(`${x.ma}: hiệu ứng không có nhóm`);
    }
    const slotsAn = (tb.o as Any[]).filter((o) => o.co_dong_an).map((o) => o.id).sort().join(",");
    if (tb.o.some((o: Any) => o.co_dong_an !== undefined) && slotsAn !== "dai,ngoc_boi") bad.push(`ô có dòng ẩn: ${slotsAn}, cần đai và ngọc bội`);
    const ren = (tb.dong_ren ?? []) as Any[];
    if (ren.some((r, i) => i > 0 && !(r.nac > ren[i - 1].nac))) bad.push("dòng rèn: mốc cường hóa phải tăng dần");
    const viDien = Object.keys(d["vi_dien.json"]);
    for (const r of ren) for (const v of r.vi_dien) if (!viDien.includes(v)) bad.push(`dòng rèn ${r.so}: vị diện lạ ${v}`);
    const toiDa = tb.luat?.dongRen?.toiDa ?? {};
    for (const v of viDien) if (toiDa[v] !== undefined && toiDa[v] !== ren.filter((r) => r.vi_dien.includes(v)).length) bad.push(`dòng rèn: tối đa ở ${v} là ${toiDa[v]}, bảng mở ${ren.filter((r) => r.vi_dien.includes(v)).length}`);
    const diem = (tb.diem ?? []) as Any[];
    if (new Set(diem.map((x) => x.stat)).size !== diem.length) bad.push("điểm trang bị: chỉ số trùng");
    if (bad.length) errors.push(`Set đồ 2.0: ${bad.join("; ")}`);
    else notes.push(`Set đồ 2.0: ${bac.length} bậc ấn (×${bac[0].he_so / 1000}–×${bac[bac.length - 1].he_so / 1000}), ${hop.length} quan hệ hợp bộ, ${(set2.binh_bo ?? []).length} binh bộ, ${tron.length} bộ trọn, ${an.length} dòng ẩn, ${ren.length} dòng rèn, ${diem.length} trọng số điểm`);
  }

  // Thú: tư chất đủ 100%, tu vi cộng dồn đúng và đủ ngày nuôi, 12 hệ đủ thú kỹ, 3 huyết mạch cân nhau, thiên phú hợp lệ
  const tpt = d["thu_phat_trien.json"];
  if (tpt) {
    const tc = d["tham_so.json"].thu_cuoi ?? {}, bad: string[] = [], warn: string[] = [];
    const need = ["supportPets", "supportFirstTicks", "supportCooldownTicks", "pillTuVi", "ownerTuViPerDay", "growthDaysTarget", "dailyPillMax", "bloodlineRealm"];
    const miss = need.filter((k) => typeof tc[k] !== "number");
    if (miss.length) bad.push(`tham_so.json thu_cuoi thiếu ${miss.join(", ")}`);
    const chat = tpt.tu_chat as Any[];
    if (chat.map((x) => x.sao).join(",") !== "1,2,3,4,5") bad.push("tư chất cần đúng 5 sao 1–5");
    const sumTy = chat.reduce((a, x) => a + x.ty_le, 0);
    if (sumTy !== 1000) bad.push(`tỷ lệ tư chất tổng ${sumTy / 10}%, cần 100%`);
    if (chat.some((x, i) => i > 0 && !(x.tu_vi > chat[i - 1].tu_vi && x.o_thien_phu >= chat[i - 1].o_thien_phu))) bad.push("tư chất: hệ số tu vi phải tăng, số ô thiên phú không giảm");
    const tv = tpt.tu_vi as Any[], realms = d["thu_canh_gioi.json"] as Any[];
    let acc = 0;
    if (tv.length !== 80) bad.push(`tu vi: ${tv.length} tầng, cần 80`);
    for (const [i, x] of tv.entries()) {
      acc += x.tu_vi;
      if (x.tang !== i + 1 || x.tich_luy !== acc) bad.push(`tu vi tầng ${x.tang}: tích lũy ${x.tich_luy}, cộng dồn ra ${acc}`);
      const r = realms.find((c) => x.tang >= c.fromStage && x.tang <= c.toStage);
      if (!r || r.realm !== x.canh_gioi) bad.push(`tu vi tầng ${x.tang}: đại cảnh giới ${x.canh_gioi} khác thu_canh_gioi.json`);
      if (x.thu_kiep !== realms.some((c) => c.fromStage === x.tang && c.realm > 1)) bad.push(`tu vi tầng ${x.tang}: cột thú kiếp sai`);
    }
    const daily = tc.dailyPillMax * tc.pillTuVi + tc.ownerTuViPerDay;
    const toTop = tv.find((x) => x.tang === realms[realms.length - 1]?.fromStage)?.tich_luy ?? 0;
    const days = Math.round((toTop / daily) * 10) / 10;
    if (Math.abs(days - tc.growthDaysTarget) > tc.growthDaysTarget * 0.1) warn.push(`thú 3 sao vào Thông Thiên sau ${days} ngày, mục tiêu ${tc.growthDaysTarget}`);
    const ky = tpt.thu_ky as Any[];
    const targets = new Set(["chu", "dong_doi_it_mau", "dong_doi_bi_hieu_ung", "dich_gan_nhat"]);
    if (ELEMENTS.some((e) => ky.filter((k) => k.he === e).length !== 1) || ky.length !== ELEMENTS.length) bad.push("thú kỹ: cần đúng 1 dòng mỗi hệ, đủ 12 hệ");
    for (const k of ky) {
      if (!(k.cap_1 < k.cap_2 && k.cap_2 < k.cap_3 && k.cap_3 < k.cap_4)) bad.push(`thú kỹ ${k.he}: cấp 1–4 phải tăng dần`);
      if (!targets.has(k.muc_tieu)) bad.push(`thú kỹ ${k.he}: mục tiêu lạ ${k.muc_tieu}`);
    }
    const eff = (tpt.huyet_mach as Any[]).map((h) => [h.ma, (h.he_so / 1000) * (1 + h.them_muc_tieu) * (tc.supportCooldownTicks / (h.hoi_chieu ?? tc.supportCooldownTicks))] as const);
    const lo = Math.min(...eff.map((e) => e[1])), hi = Math.max(...eff.map((e) => e[1]));
    if (hi > lo * 1.15) warn.push(`huyết mạch lệch nhau quá 15%: ${eff.map(([m, v]) => `${m} ×${v.toFixed(2)}`).join(", ")}`);
    const tp = tpt.thien_phu as Any[];
    if (new Set(tp.map((x) => x.ma_vp)).size !== tp.length) bad.push("thiên phú: mã Thú Quyết trùng");
    for (const x of tp) {
      if (!(x.bac_2 > x.bac_1)) bad.push(`${x.ma_vp}: bậc 2 phải lớn hơn bậc 1`);
      if (!["thu_ky", "chi_so", "ngoai"].includes(x.nhom)) bad.push(`${x.ma_vp}: nhóm lạ ${x.nhom}`);
      if (!["ho_chu", "ca_5", "thu_cuoi", "cong_thanh", "luon", "luyen_hoa"].includes(x.tinh_khi)) bad.push(`${x.ma_vp}: tính khi lạ ${x.tinh_khi}`);
    }
    if (!d["linh_don.json"]?.tay_tuy) bad.push("linh_don.json thiếu Tẩy Tủy Đơn (tay_tuy)");
    if (bad.length) errors.push(`Thú tăng trưởng: ${bad.join("; ")}`);
    else notes.push(`Thú tăng trưởng: tư chất 5 sao đủ 100%, tu vi 80 tầng (thú 3 sao vào Thông Thiên sau ${days} ngày), ${ky.length} thú kỹ, ${eff.length} huyết mạch (×${lo.toFixed(2)}–×${hi.toFixed(2)}), ${tp.length} thiên phú`);
    for (const w of warn) warnings.push(`Thú tăng trưởng: ${w}`);
  }

  // Tầng công pháp: đủ số tầng, tầng 1 không cộng, mức cộng dồn không giảm, có điểm luyện mỗi cấp
  {
    const tg = (d["tang_cong_phap.json"] ?? []) as Any[], cp = d["tham_so.json"].cong_phap, bad: string[] = [];
    const keys = ["uyLuc", "hoiChieu", "mana", "diemLuyen", "congHien"], cumul = ["uyLuc", "hoiChieu", "mana"];
    if (tg.length !== cp.techniqueLayers) bad.push(`${tg.length} tầng, tham_so cong_phap.techniqueLayers = ${cp.techniqueLayers}`);
    for (const [i, x] of tg.entries()) {
      if (x.tang !== i + 1) bad.push(`dòng ${i + 1} ghi tầng ${x.tang}`);
      for (const k of keys) {
        if (!Number.isInteger(x[k]) || x[k] < 0) bad.push(`tầng ${x.tang}: ${k} phải là số nguyên không âm`);
        else if (i === 0 && x[k] !== 0) bad.push(`tầng 1: ${k} phải là 0`);
        else if (i > 0 && cumul.includes(k) && x[k] < tg[i - 1][k]) bad.push(`tầng ${x.tang}: ${k} cộng dồn không được giảm`);
      }
    }
    if (!(cp.diemLuyenMoiCap > 0)) bad.push("tham_so cong_phap.diemLuyenMoiCap phải lớn hơn 0");
    if (bad.length) errors.push(`Tầng công pháp: ${bad.join("; ")}`);
    else {
      const pham = d["pham.json"][0], top = tg[tg.length - 1];
      const diem = tg.reduce((a, x) => a + Math.round(x.diemLuyen * pham.power / 1000), 0), quyen = tg.reduce((a, x) => a + x.congHien, 0);
      notes.push(`Tầng công pháp: ${tg.length} tầng, tầng cuối uy lực +${top.uyLuc / 10}%; lên hết 1 công pháp ${pham.name} tốn ${diem} điểm luyện (${Math.ceil(diem / cp.diemLuyenMoiCap)} cấp) và ${quyen} tàn quyển (${quyen * pham.contribution} cống hiến)`);
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
  const groups = { SKILL_RULES, CAST_FLOOR, BATTLE, UNIT_CURVE, TALENT_RULES, ARTIFACT_RULES } as Record<string, Record<string, number | boolean>>;
  for (const [g, obj] of Object.entries(groups)) {
    for (const [k, v] of Object.entries(obj)) cmp(`${g}.${k}`, ts[g]?.[k], v);
    for (const k of Object.keys(ts[g] ?? {})) if (!(k in obj)) cmp(`${g}.${k}`, ts[g][k], undefined); // khóa mới chờ code thêm
  }
  cmp("cong_phap.baseCrit", ts.cong_phap?.baseCrit, BASE_CRIT_PER_MILLE);
  cmp("cong_phap.resistCap", ts.cong_phap?.resistCap, RESIST_CAP);
  cmp("cong_phap.counterFloor", ts.cong_phap?.counterFloor, COUNTER_FLOOR);
  // Set đồ 2.0: loại sát thương theo loại chiêu, ngưỡng dòng ẩn
  if (SKILL_TYPES.some((t) => lc[t] && "loai_sat_thuong" in lc[t])) for (const t of SKILL_TYPES) {
    const f = lc[t]?.loai_sat_thuong ?? null, c = DAMAGE_KIND[t] ?? null;
    if (f !== c) diff.push(`Loại chiêu ${t}.loai_sat_thuong: file ${f}, code ${c}`);
  }
  const dongAn = (d["trang_bi.json"]?.dong_an ?? []) as Any[];
  const nguong = (k: string) => dongAn.find((x) => x.tham_so && typeof x.tham_so[k] === "number")?.tham_so[k];
  if (dongAn.length) {
    cmp("Dòng ẩn mauDuoi (HIDDEN_RULES.lowHpBelow)", nguong("mauDuoi"), HIDDEN_RULES.lowHpBelow);
    cmp("Dòng ẩn truocTicks (HIDDEN_RULES.openingTicks)", nguong("truocTicks"), HIDDEN_RULES.openingTicks);
    cmp("Dòng ẩn sauTicks (HIDDEN_RULES.lateTicks)", nguong("sauTicks"), HIDDEN_RULES.lateTicks);
  }
  if (diff.length) warnings.push(`Khác số đang chạy trong packages/sim (${diff.length} chỗ): ${diff.join("; ")}`);
  else notes.push("Loại chiêu, biến thể, hệ, tham số trận đấu: khớp số đang chạy trong packages/sim");

  return { errors, warnings, notes };
}

function scroll(id: string, grade: number) {
  const [element, type, variant] = id.split(".") as [Element, SkillType, Variant];
  return { element, type, variant, grade };
}

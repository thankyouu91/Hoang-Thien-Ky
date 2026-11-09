// Tuyến nhiệm vụ chính sau chương 0 (cấp 1–250): chạy mọi nhiệm vụ kind "chinh" trong data/nhiem_vu/ha_nhiem_vu.json theo
// đúng chuỗi requires + minLevel (mốc cấp là phanh nhịp: chưa đủ cấp thì bế quan). Mỗi động từ một cách chạy prototype;
// động từ chưa nhận ra lùi về "đến điểm + xong" (luật chung tab Nhiệm vụ: không nhiệm vụ nào kẹt). File thuần, test bằng node.
// Kinh nghiệm theo bảng exp của tab Nhiệm vụ: q(L) = 10 + 2L, nguồn sourcesQ dạng [cấp 1–60, cấp 61+] nhân q.
import { apply, toScroll } from "@htk/rules";
import { composeTechnique, ELEMENTS, type Element, type SkillType, type UnitSpec } from "@htk/sim";
import NHIEM_VU from "../../../../data/nhiem_vu/ha_nhiem_vu.json" with { type: "json" };
import THU_CUOI from "../../../../data/he_thong/json/thu_cuoi.json" with { type: "json" };
import type { World } from "../mock/world.ts";
import { dongMon, donViNguoiChoi, ONE_MON, TEN_HE, themChienBao, tranThang, type KetQua } from "./ftue.ts";
import { heBiKhac, heKhacNhat, PLAYER, seeded, VUNG_DATA, type MoiState } from "./theGioiMoi.ts";

interface NvStep {
  do: string;
  trial?: string;
  count?: number;
  turns?: number;
  fromLevel?: number;
  level?: number;
  cost?: { or?: { item: string; count: number }[] };
  options?: { id: string; cost?: { item: string; count: number }[]; reward?: { danhVong?: Record<string, number> } }[];
  enemy?: { count: number; kind?: string; element?: string; skill?: string; statPermille: number };
  target?: { type?: string | string[] };
  beast?: { grade: string; element: string };
}
interface NvQuest {
  id: string;
  kind: string;
  chapter: number;
  name: string;
  minLevel: number;
  requires?: string[];
  steps: NvStep[];
  reward: { expQ?: string; exp?: number; linhThach?: number; items?: { item: string; grade?: string; element?: string; count?: number }[]; danhVong?: Record<string, number> };
}
interface Trial {
  id: string;
  lesson: string;
  rounds?: number;
  enemy: { count: number; kind: string; element: string; skill?: SkillType; statPermille?: number };
  loan?: { element: string; skill: SkillType }[] | string;
  expect?: string[];
  reward?: { items?: { item: string; grade: string; element: string }[] };
}

const NV = NHIEM_VU as unknown as {
  exp: { q: { base: number; perLevel: number }; questBandUntilLevel: number; sourcesQ: Record<string, [number, number]>; curve: { dailyQ: number; daysBasePermille: number; daysPerLevelPermille: number; earlyFloorPermille: number; earlyUntilLevel: number; roundTo: number } };
  chinhLinhThachTheoChuong: number[];
  tamDao: Trial[];
  quests: NvQuest[];
};

/** Mọi nhiệm vụ chính sau chương 0, theo thứ tự file (chuỗi requires cũng theo thứ tự này). */
export const NV_CHINH: NvQuest[] = NV.quests.filter((q) => q.kind === "chinh" && q.chapter >= 1);

export const qL = (level: number): number => NV.exp.q.base + NV.exp.q.perLevel * level;
/** E(L) như expToNext của mock/source.ts, tính lại từ cùng khoá exp.curve để file này test được bằng node. */
export function expLenCap(level: number): number {
  const c = NV.exp.curve;
  const days = (c.daysBasePermille + c.daysPerLevelPermille * level) / 1000;
  const p = level < c.earlyUntilLevel ? (c.earlyFloorPermille + ((1000 - c.earlyFloorPermille) * (level - 1)) / (c.earlyUntilLevel - 1)) / 1000 : 1;
  return Math.round((c.dailyQ * qL(level) * days * p) / c.roundTo) * c.roundTo;
}
/** Kinh nghiệm một nguồn ở cấp `level` (bảng sourcesQ nhân q; đổi dải ở questBandUntilLevel). */
export function expNguon(nguon: string, level: number): number {
  const row = NV.exp.sourcesQ[nguon];
  if (!row) return 0;
  return (level <= NV.exp.questBandUntilLevel ? row[0] : row[1]) * qL(level);
}

const GRADE_NUM: Record<string, number> = { pham: 1, hoang: 2, huyen: 3, dia: 4 };
/** Phẩm tàn quyển rơi từ trận nhiệm vụ theo chương (đề xuất: Phàm ch1, Hoàng ch2, Huyền ch3, Địa ch4–5). */
const dropGrade = (chapter: number): number => Math.max(1, Math.min(4, chapter));

const bamChuoi = (s: string): number => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

/** Nhiệm vụ chính đang làm: nhiệm vụ đầu tiên chưa xong mà mọi requires đã xong. */
export function nvHienTai(moi: MoiState): NvQuest | undefined {
  return NV_CHINH.find((q) => !moi.xong.includes(q.id) && (q.requires ?? []).every((r) => moi.xong.includes(r)));
}

export function nvBuocHienTai(moi: MoiState, q: NvQuest): NvStep {
  return q.steps[Math.min(moi.nvBuoc ?? 0, q.steps.length - 1)];
}

/** Hệ trong spec theo rules.placeholders: "$home" là hệ vùng; "$beatenByHome", biến "$..." lạ hay bỏ trống là hệ bị hệ vùng khắc (lối ra, không kẹt). "$roundDistinct"/"$counterOfRound" xử riêng ở nhánh ải nhiều hiệp. */
function heCuaSpec(spec: string | undefined, home: Element): Element {
  if (spec === "$home") return home;
  if (!spec || spec.startsWith("$")) return heBiKhac(home);
  return spec as Element;
}

/** Tàn quyển rơi sau trận nhiệm vụ thắng (GDD mục 9: tàn quyển rơi từ PvE): hệ theo dropWeights vùng, phẩm theo chương. */
function roiTanQuyen(w: World, moi: MoiState, q: NvQuest, now: number): string | undefined {
  const vung = VUNG_DATA[w.region.region.code];
  const rand = seeded(moi.seed + bamChuoi(q.id));
  const weights = Object.entries(vung?.dropWeights ?? { [w.region.region.element]: 1000 });
  let x = rand() * weights.reduce((s, [, v]) => s + Number(v), 0);
  let he: Element = w.region.region.element as Element;
  for (const [e, v] of weights) {
    x -= Number(v);
    if (x <= 0) { he = e as Element; break; }
  }
  const type: SkillType[] = ["can_don", "tam_xa", "can_quet", "ho_the", "dien_rong", "khong_che", "than_phap", "hoi_phuc", "bua_chu", "tran_phap"];
  const kind = `${he}.${type[Math.floor(rand() * type.length)]}.${["bao", "toc", "linh", "ben"][Math.floor(rand() * 4)]}`;
  const r = apply(w.rules, { type: "nhat_tan_quyen", actor: "system", memberId: PLAYER, kind, grade: dropGrade(q.chapter) }, now);
  return r.ok ? `rơi 1 tàn quyển hệ ${TEN_HE[he]}` : undefined;
}

/** Trận nhiệm vụ: người chơi + 2 đồng môn đấu đội theo spec; dò hạt giống và hạ sức địch tới khi thắng (không kẹt). */
function tranNv(w: World, moi: MoiState, q: NvQuest, spec: NonNullable<NvStep["enemy"]>, now: number, themKy?: UnitSpec[]): number {
  const home = w.region.region.element as Element;
  const foe = heCuaSpec(spec.element, home);
  const me = donViNguoiChoi(w);
  const lv = w.rules.members[PLAYER].level;
  const skill = (spec.skill ?? "can_don") as SkillType;
  const { input } = tranThang((p) => ({
    teamA: [me, ...(themKy ?? [dongMon(2, Math.max(1, lv - 2), home, "can_don", 0), dongMon(3, Math.max(1, lv - 2), home, "tam_xa", 1)])],
    teamB: Array.from({ length: spec.count }, (_, i) => ONE_MON(101 + i, lv, p, foe, i === spec.count - 1 ? "tam_xa" : skill, i === spec.count - 1 ? 1 : 0)),
  }), spec.statPermille ?? 1000, (moi.seed % 9_973) + bamChuoi(q.id) % 1000);
  return themChienBao(w, moi, input, `${q.name}: ${spec.count} ${spec.kind === "tu_si" ? "tu sĩ" : "dị thú"} hệ ${TEN_HE[foe]}`, `${w.region.region.code}/hang_di_thu`, now);
}

/** Ải Tầm Đạo theo số thứ tự (tamDao[n-1]); chưa có trong dữ liệu thì undefined (lùi về trận thường). */
export function aiTamDao(trial: string | undefined): Trial | undefined {
  const n = Number((trial ?? "").split(".")[1]);
  return Number.isInteger(n) ? NV.tamDao[n - 1] : undefined;
}

export const LOI_AI: Record<string, string> = {
  ngu_hanh_khac: "Ngũ Hành khắc: Kim khắc Mộc, Mộc khắc Thổ, Thổ khắc Thủy, Thủy khắc Hỏa, Hỏa khắc Kim.",
  bien_di_theo_goc: "Hệ biến dị khắc theo hệ gốc của nó: Lôi theo Kim, Phong theo Mộc, Cực hàn theo Thủy, Cực dương theo Hỏa, Cực âm theo Thổ.",
  he_so_ghep: "Ghép thuần hệ hoặc tương sinh thì công pháp mạnh hơn; tương khắc thì yếu đi.",
  khong_che_cat_van_cong: "Chiêu khống chế cắt vận công của địch: choáng đúng lúc địch gom lực.",
};

/** Quyển mượn của ải, hệ đã quy về hệ thật ($home → hệ vùng). */
export function quyenMuon(trial: Trial, home: Element): { element: Element; skill: SkillType }[] {
  // Ải 8: loan "all_elements" (mượn hệ bất kỳ); prototype cho chọn trong cả 12 hệ, một lượt thay cho 3 lượt.
  if (trial.loan === "all_elements") return ELEMENTS.map((e) => ({ element: e, skill: "can_don" as SkillType }));
  if (!Array.isArray(trial.loan)) return [];
  return trial.loan.map((l) => ({ element: heCuaSpec(l.element, home), skill: l.skill }));
}

/** Trận vượt ải: người chơi solo cộng quyển mượn đã chọn. */
function tranAi(w: World, moi: MoiState, q: NvQuest, trial: Trial, muon: { element: Element; skill: SkillType } | undefined, now: number, foeHiep?: Element): number {
  const me = donViNguoiChoi(w);
  const loaner = muon ? [composeTechnique(toScroll(`${muon.element}.${muon.skill}.linh`, 1), [toScroll(`${muon.element}.${muon.skill}.bao`, 1)])] : [];
  const lv = w.rules.members[PLAYER].level;
  const foe = foeHiep ?? heCuaSpec(trial.enemy.element, w.region.region.element as Element);
  const skillDich = trial.enemy.skill ?? "can_don";
  const { input } = tranThang((p) => ({
    teamA: [{ ...me, techniques: [...loaner, ...me.techniques].slice(0, 4) }],
    teamB: Array.from({ length: trial.enemy.count }, (_, i) => ONE_MON(101 + i, lv, p, foe, skillDich, i >= 3 ? 1 : 0)),
  }), trial.enemy.statPermille ?? 1000, (moi.seed % 9_973) + bamChuoi(trial.id) % 1000);
  return themChienBao(w, moi, input, `${q.name}: ${trial.enemy.count} địch hệ ${TEN_HE[foe]}`, `${w.region.region.code}/cua_bi_canh`, now);
}

/** Mốc giờ hôm nay theo giờ máy (như todayAt của mock/world.ts; chép lại để file này không kéo mock vào runtime node). */
function todayAt(now: number, hour: number): number {
  const d = new Date(now);
  d.setHours(hour, 0, 0, 0);
  return d.getTime();
}

/** Bí cảnh đang mở không (12:00 và 20:00, 30 phút)? */
export function biCanhDangMo(now: number): boolean {
  return [12, 20].some((h) => now >= todayAt(now, h) && now < todayAt(now, h) + 30 * 60_000);
}

export type KetQuaNv = KetQua & { battleId?: number; xongNhiemVu?: boolean };

/**
 * Chạy bước hiện tại của nhiệm vụ `q`. `arg.muon` cho ải Tầm Đạo, `arg.chon` cho bước lựa chọn.
 * Xong bước cuối: đánh dấu, phát thưởng vật phẩm; kinh nghiệm và linh thạch do NguonMoi cộng (trả qua thuongNv).
 */
export function lamNv(w: World, moi: MoiState, q: NvQuest, arg: Record<string, unknown>, now: number): KetQuaNv {
  const me = w.rules.members[PLAYER];
  if (me.level < q.minLevel) return { ok: false, error: "chua_du_cap_nv" };
  const step = nvBuocHienTai(moi, q);
  const xongBuoc = (r: KetQua & { battleId?: number }): KetQuaNv => {
    if (!r.ok) return r;
    moi.nvBuoc = (moi.nvBuoc ?? 0) + 1;
    if (moi.nvBuoc < q.steps.length) return r;
    // Xong nhiệm vụ: đánh dấu; danh vọng thưởng cộng luôn ($pheDaChon = phe đã chọn ở bước chon gần nhất).
    moi.xong.push(q.id);
    moi.nvBuoc = 0;
    for (const [phe, n] of Object.entries(q.reward.danhVong ?? {})) {
      const key = phe === "$pheDaChon" ? (moi.pheCuoi ?? "chinh_dao_minh") : phe;
      moi.danhVong = { ...moi.danhVong, [key]: (moi.danhVong?.[key] ?? 0) + n };
    }
    return { ...r, xongNhiemVu: true };
  };
  switch (step.do) {
    case "tam_dao": {
      const trial = aiTamDao(step.trial);
      if (trial) {
        // Ải không có quyển mượn (ví dụ ải 3, bài học hệ số ghép) thì đánh bằng công pháp của mình.
        const home = w.region.region.element as Element;
        const loan = quyenMuon(trial, home);
        const chonQuyen = loan.length ? loan[Math.min(Math.max(0, Number(arg.muon_i ?? 0)), loan.length - 1)] : undefined;
        const phatQua = () => {
          for (const it of trial.reward?.items ?? []) {
            if (it.item === "tan_quyen") apply(w.rules, { type: "nhat_tan_quyen", actor: "system", memberId: PLAYER, kind: `${heCuaSpec(it.element, home)}.can_don.linh`, grade: GRADE_NUM[it.grade] ?? 1 }, now);
          }
        };
        // Ải nhiều hiệp (tamDao.8, "$roundDistinct"): mỗi hiệp một hệ địch riêng rút theo hạt giống trong 12 hệ bỏ hệ nhà;
        // mượn lại mỗi hiệp, đúng là hệ khắc địch hiệp đó ("$counterOfRound").
        const rounds = trial.rounds ?? 1;
        if (rounds > 1) {
          const rand = seeded(moi.seed + bamChuoi(trial.id));
          const pool = ELEMENTS.filter((e) => e !== home);
          for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
          const hiep = moi.aiHiep ?? 0;
          const foe = pool[hiep % pool.length];
          const khac = heKhacNhat(foe);
          const battleId = tranAi(w, moi, q, trial, chonQuyen, now, foe);
          const msg = `Hiệp ${hiep + 1}/${rounds}: địch hệ ${TEN_HE[foe]}` + (chonQuyen?.element === khac ? `, mượn ${TEN_HE[khac]} khắc đúng` : `, quyển khắc đúng là ${TEN_HE[khac]}`);
          if (hiep + 1 < rounds) {
            moi.aiHiep = hiep + 1;
            return { ok: true, battleId, message: msg };
          }
          moi.aiHiep = undefined;
          phatQua();
          return xongBuoc({ ok: true, battleId, message: msg });
        }
        const battleId = tranAi(w, moi, q, trial, chonQuyen, now);
        const muon = chonQuyen?.element;
        phatQua();
        const dung = muon !== undefined && (trial.expect ?? []).map((e) => heCuaSpec(e, home)).includes(muon);
        return xongBuoc({ ok: true, battleId, message: dung ? `Mượn quyển ${TEN_HE[muon!]}: chọn đúng khắc chế` : muon && trial.expect?.length ? `Qua ải; quyển khắc đúng là ${trial.expect.map((e) => TEN_HE[heCuaSpec(e, home)]).join(", ")}` : "Qua ải" });
      }
      // Ải chưa có trong dữ liệu: trận thường thay thế.
      const battleId = tranNv(w, moi, q, { count: 3, statPermille: 1000 }, now);
      return xongBuoc({ ok: true, battleId, message: "Qua ải" });
    }
    case "thang":
    case "chiem":
    // Các bước có giao chiến của chương 2–5: prototype chạy như một trận thắng tại điểm (đề xuất).
    case "ha_ten_do":
    case "ho_tong":
    case "pha_nut":
    case "tham_chien":
    case "gop_thu_cong_thanh":
    case "luyen_bai": {
      const battleId = tranNv(w, moi, q, step.enemy ?? { count: 3, statPermille: 900 }, now);
      const roi = roiTanQuyen(w, moi, q, now);
      return xongBuoc({ ok: true, battleId, message: roi ? `Thắng trận: ${roi}` : "Thắng trận" });
    }
    case "thuan_phuc": {
      const he = heCuaSpec(step.beast?.element, w.region.region.element as Element);
      const battleId = tranNv(w, moi, q, { count: 1, kind: "di_thu", element: he, statPermille: 1000 }, now);
      const thu = (THU_CUOI as { id: string; name: string; element: string; grade: string }[]).find((t) => t.element === he && t.grade === "pham")
        ?? (THU_CUOI as { id: string; name: string; element: string; grade: string }[]).find((t) => t.grade === "pham");
      const o = w.player.mounts.indexOf(null);
      if (thu && o >= 0) w.player.mounts[o] = thu.id;
      return xongBuoc({ ok: true, battleId, message: thu && o >= 0 ? `Thuần phục ${thu.name}: thú cưỡi đầu tiên` : "Thuần phục xong" });
    }
    case "nop": {
      const can = step.count ?? 1;
      if (me.bag.length < can) return { ok: false, error: "thieu_tan_quyen" };
      for (const uid of me.bag.slice(0, can).map((s) => s.uid)) {
        const r = apply(w.rules, { type: "nop_tan_quyen", actor: PLAYER, scrollUid: uid }, now);
        if (!r.ok) return { ok: false, error: r.error };
      }
      return xongBuoc({ ok: true, message: `Nộp ${can} tàn quyển vào Tàng Kinh Các` });
    }
    case "vao_bi_canh": {
      if (!biCanhDangMo(now)) return { ok: false, error: "bi_canh_dong" };
      const battleId = tranNv(w, moi, q, step.enemy ?? { count: 3, statPermille: 1000 }, now);
      const roi = roiTanQuyen(w, moi, q, now);
      return xongBuoc({ ok: true, battleId, message: roi ? `Qua bí cảnh: ${roi}` : "Qua bí cảnh" });
    }
    case "ghep":
      // Ghép thử ở bia được tính (luật chung tab Nhiệm vụ): không tiêu quyển, không cần chức vị.
      return xongBuoc({ ok: true, message: "Ghép thử ở bia Tầm Đạo: được tính cho nhiệm vụ" });
    case "tu_luyen": {
      if (!moi.nvTuLuyenXong) return { ok: false, error: moi.beQuan || w.jobs.some((j) => j.kind === "be_quan" && j.endsAt > now) ? "dang_be_quan" : "can_be_quan" };
      moi.nvTuLuyenXong = undefined;
      return xongBuoc({ ok: true, message: "Tu luyện xong một lượt" });
    }
    case "chon": {
      const o = step.options?.find((x) => x.id === arg.chon) ?? step.options?.[0];
      if (!o) return xongBuoc({ ok: true });
      for (const c of o.cost ?? []) {
        if (c.item === "tan_quyen") {
          if (me.bag.length < c.count) return { ok: false, error: "thieu_tan_quyen" };
          me.bag.splice(0, c.count);
        }
      }
      const dv = Object.entries(o.reward?.danhVong ?? {});
      moi.danhVong ??= {};
      for (const [phe, n] of dv) moi.danhVong[phe] = (moi.danhVong[phe] ?? 0) + n;
      if (dv.length) moi.pheCuoi = dv[0][0]; // phe của lựa chọn gần nhất, cho "$pheDaChon"
      return xongBuoc({ ok: true, message: dv.length ? `Danh vọng ${dv.map(([p, n]) => `${p} +${n}`).join(", ")}` : undefined });
    }
    case "dot_pha": {
      if (me.level <= (step.fromLevel ?? me.level - 1)) return { ok: false, error: "chua_dot_pha" };
      return xongBuoc({ ok: true, message: "Đột phá thành, cảnh giới mới" });
    }
    case "dat_cap": {
      if (me.level < (step.level ?? q.minLevel)) return { ok: false, error: "chua_du_cap_nv" };
      return xongBuoc({ ok: true, message: `Đã đạt cấp ${step.level ?? q.minLevel}` });
    }
    case "nuoi_bi_canh": {
      // Luật rules.costOr: trừ lựa chọn đầu tiên đủ, thiếu hết thì miễn phí (chỗ tạm của prototype, không để kẹt).
      // Prototype chưa có kho dược liệu nên nhánh duoc_lieu coi như không đủ.
      for (const c of step.cost?.or ?? []) {
        if (c.item === "linh_thach" && w.player.linhThach >= c.count) {
          w.player.linhThach -= c.count;
          return xongBuoc({ ok: true, message: `Nạp ${c.count} linh thạch nuôi bí cảnh` });
        }
      }
      return xongBuoc({ ok: true, message: "Dựng trận tụ linh tạm cho bí cảnh" });
    }
    default:
      // den, di_qua và động từ chưa nhận ra: tới nơi là xong (prototype chưa có hành trình theo chặng).
      return xongBuoc({ ok: true, message: "Đã tới nơi" });
  }
}

/** Thưởng kinh nghiệm và linh thạch của nhiệm vụ vừa xong (NguonMoi cộng, vì gainExp ở lớp nguồn). */
export function thuongNv(q: NvQuest, level: number): { exp: number; linhThach: number } {
  const exp = q.reward.expQ ? expNguon(q.reward.expQ, level) : (q.reward.exp ?? 0);
  return { exp, linhThach: q.reward.linhThach ?? NV.chinhLinhThachTheoChuong[q.chapter] ?? 0 };
}

/** Phát vật phẩm thưởng nhiệm vụ (tàn quyển tự chọn, thú…); trả câu kể. */
export function phatThuongVatPham(w: World, q: NvQuest, now: number): string[] {
  const out: string[] = [];
  const home = w.region.region.element as Element;
  for (const it of q.reward.items ?? []) {
    if (it.item === "tan_quyen") {
      const he = (VUNG_DATA[w.region.region.code]?.dropElements?.[0] ?? home) as Element;
      const r = apply(w.rules, { type: "nhat_tan_quyen", actor: "system", memberId: PLAYER, kind: `${he}.can_don.linh`, grade: GRADE_NUM[it.grade ?? "pham"] ?? 1 }, now);
      if (r.ok) out.push(`1 tàn quyển ${TEN_HE[he]}`);
    }
    // Thú thưởng của 1.3 phát ngay ở bước thuần phục; danh hiệu, y phục chưa có trong prototype.
  }
  return out;
}

/** Nhãn và lời ngắn của bước cho thẻ nhiệm vụ (tối đa 2 câu, GDD mục 14). */
export function loiBuoc(_q: NvQuest, step: NvStep): { loi: string; nut: string } {
  switch (step.do) {
    case "tam_dao":
      return { loi: "Tới bia Tầm Đạo ở thành chủ, xem bài học rồi mượn một quyển để vượt ải.", nut: "Vượt ải" };
    case "thang":
    case "chiem":
    case "ha_ten_do":
    case "ho_tong":
    case "pha_nut":
    case "tham_chien":
    case "gop_thu_cong_thanh":
    case "luyen_bai":
      return { loi: "Thắng trận tại điểm nhiệm vụ. Thắng còn rơi tàn quyển.", nut: "Ra trận" };
    case "dat_cap":
      return { loi: `Đạt cấp ${step.level ?? ""} là xong; bế quan và nhiệm vụ cộng tu vi.`, nut: "Kiểm cấp" };
    case "nuoi_bi_canh":
      return { loi: "Nạp linh thạch nuôi bí cảnh; thiếu thì dựng trận tụ linh tạm.", nut: "Nạp nuôi" };
    case "thuan_phuc":
      return { loi: "Thắng dị thú rồi thu phục nó làm thú cưỡi.", nut: "Thuần phục" };
    case "nop":
      return { loi: `Nộp ${step.count ?? 1} tàn quyển vào Tàng Kinh Các. Thiếu thì đánh trận nhiệm vụ để rơi thêm.`, nut: "Nộp tàn quyển" };
    case "vao_bi_canh":
      return { loi: "Vào bí cảnh trong khung 12:00 hoặc 20:00, mỗi khung mở 30 phút.", nut: "Vào bí cảnh" };
    case "ghep":
      return { loi: "Ghép thử công pháp ở bia Tầm Đạo; ghép thử được tính, không tiêu tàn quyển.", nut: "Ghép thử" };
    case "tu_luyen":
      return { loi: "Xong một lượt bế quan thì bước này hoàn thành.", nut: "Tu luyện" };
    case "chon":
      return { loi: "Chọn một trong các lối xử; danh vọng đổi theo lựa chọn.", nut: "Lựa chọn" };
    case "dot_pha":
      return { loi: `Tu vi đầy ở cấp ${step.fromLevel ?? ""} rồi bấm Đột phá ở màn Nhân vật, sau đó quay lại đây.`, nut: "Đã đột phá" };
    default:
      return { loi: "Tới điểm nhiệm vụ trên bản đồ.", nut: "Đến nơi" };
  }
}

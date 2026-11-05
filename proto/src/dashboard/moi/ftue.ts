// Chuỗi nhập môn (FTUE, GDD mục 14; tab Nhiệm vụ chương 0 "Nhập Thế", data/nhiem_vu/ha_nhiem_vu.json chinh.0.1–0.7).
// File thuần: thứ tự bước, lời chỉ dẫn (tối đa 2 câu, GDD mục 14), phần thưởng lấy từ JSON, và dựng trận cho 0.5, 0.6 sao cho
// người mới luôn thắng được (không kẹt). Lệnh làm từng bước nằm ở nguonMoi.ts.
import { apply, loadoutTechniques, TAN_THU_SECT, techniqueName, techniqueOf, toScroll, type OwnedScroll } from "@ktlp/rules";
import { baseStats, composeTechnique, simulate, type BattleInput, type Element, type SkillType, type Technique, type UnitSpec } from "@ktlp/sim";
import type { World } from "../mock/world.ts";
import NHIEM_VU from "../../../../data/nhiem_vu/ha_nhiem_vu.json" with { type: "json" };
import { heBiKhac, PLAYER, type MoiState } from "./theGioiMoi.ts";

type QuestRow = {
  id: string; chapter?: number; name: string; minLevel: number;
  reward: { exp?: number; linhThach?: number; items?: { item: string; count: number }[] };
  steps: { do: string; enemy?: { count: number; statPermille: number } }[];
};
const QUESTS = NHIEM_VU.quests as unknown as QuestRow[];

/** Bảy nhiệm vụ chương 0 theo thứ tự trong JSON. */
export const CHUOI = QUESTS.filter((q) => q.chapter === 0);
/** Bước FTUE (1–8, docs/api.md BUOC_FTUE) ứng với từng nhiệm vụ: 0.1 là bước 2 (chọn vùng) … 0.7 là bước 8. */
export const BUOC_FTUE: Record<string, number> = Object.fromEntries(CHUOI.map((q, i) => [q.id, i + 2]));

/** Việc của một bước trên thẻ chỉ dẫn. */
export type ViecFtue = "chon_vung" | "gieo_que" | "gia_nhap" | "ghep" | "thu_chieu" | "chiem_mo" | "thu_mo" | "dat_nhac";

export interface BuocView {
  id: string;
  so: number; // 1–7
  ten: string;
  /** Tối đa 2 câu. */
  loi: string;
  nut: string;
  viec: ViecFtue;
}

const LOI: Record<string, { loi: string; nut: string; viec: ViecFtue }> = {
  "chinh.0.1": { loi: "Linh mạch vừa sống lại khắp Hạ vị. Chọn vùng bắt đầu, rồi tới thành chủ của vùng đó.", nut: "Chọn vùng", viec: "chon_vung" },
  "chinh.0.2": { loi: "Đặt tay lên bia Tầm Đạo ở thành chủ để gieo quẻ. Quẻ cho bạn linh căn và một tài năng.", nut: "Gieo quẻ", viec: "gieo_que" },
  "chinh.0.3": { loi: "Một mình khó tu. Gia nhập tông môn được gợi ý trong vùng rồi truyền tống về sơn môn.", nut: "Xem tông gợi ý", viec: "gia_nhap" },
  "chinh.0.4": { loi: "Bạn có 2 tàn quyển tặng sẵn trong túi. Ghép chúng ở Tàng Kinh Các thành công pháp đầu tiên.", nut: "Ghép công pháp", viec: "ghep" },
  "chinh.0.5": { loi: "Thử công pháp mới với dị thú gần sơn môn. Dị thú ở đây thuộc hệ bị hệ của vùng khắc, nên đòn trúng mạnh hơn.", nut: "Ra trận", viec: "thu_chieu" },
  "chinh.0.6": { loi: "Cùng đồng môn đánh chiếm mỏ linh thạch cấp 1 đang có dị thú canh. Chiếm xong thì thu mỏ lần đầu.", nut: "Đánh chiếm mỏ", viec: "chiem_mo" },
  "chinh.0.7": { loi: "Bí cảnh mở lúc 12:00 và 20:00, mỗi lần 30 phút. Đặt lời nhắc cho khung gần nhất.", nut: "Đặt nhắc", viec: "dat_nhac" },
};

/** Bước đang làm, hoặc undefined khi đã xong cả chương 0. */
export function buocHienTai(moi: MoiState): BuocView | undefined {
  const i = CHUOI.findIndex((q) => !moi.xong.includes(q.id));
  if (i < 0) return undefined;
  const q = CHUOI[i];
  const l = LOI[q.id];
  if (q.id === "chinh.0.6" && moi.daChiemMo) {
    return { id: q.id, so: i + 1, ten: q.name, loi: "Mỏ đã về tay tông môn. Thu mỏ lần đầu để linh thạch vào Bảo Khố.", nut: "Thu mỏ", viec: "thu_mo" };
  }
  return { id: q.id, so: i + 1, ten: q.name, ...l };
}

export function thuongCua(id: string): QuestRow["reward"] {
  return CHUOI.find((q) => q.id === id)?.reward ?? {};
}

/** Nhiệm vụ chính kế sau chương 0 (chương 1 mở theo cấp). */
export function nhiemVuKe(level: number): { ten: string; minLevel: number; mo: boolean } | undefined {
  const q = QUESTS.find((x) => x.chapter === 1 && x.id.startsWith("chinh."));
  return q && { ten: q.name, minLevel: q.minLevel, mo: level >= q.minLevel };
}

/** Món trong túi tân thủ (thưởng 0.7) theo mã vật phẩm của danh sách icon vẽ. */
export const MON_TAN_THU: Record<string, { name: string; kind: "dan" | "phu"; code: string; art: string; detail: string }> = {
  dan_hoi_mau: { name: "Bổ Huyết Đan", kind: "dan", code: "DA-DD-001", art: "dan/dan_duoc_hoi_mau", detail: "Hồi máu trong trận." },
  phu_don_tho: { name: "Phù độn thổ", kind: "phu", code: "PH-CH-006", art: "phu/don_tho", detail: "Đưa về thành chủ ngay khi đang trên đường." },
  phu_ho_than: { name: "Phù hộ thân", kind: "phu", code: "PH-CH-005", art: "phu/ho_than", detail: "Giảm xác suất gặp sự kiện trên đường." },
};

// ---- Trận nhập môn -------------------------------------------------------------------------------------------------

const ONE_MON = (id: number, level: number, permille: number, element: Element, type: SkillType, row: 0 | 1): UnitSpec => {
  const b = baseStats(level);
  return {
    id, level, element, row, monster: true,
    hp: Math.round((b.hp * permille) / 1000), atk: Math.round((b.atk * permille) / 1000), def: Math.round((b.def * permille) / 1000),
    techniques: [composeTechnique(toScroll(`${element}.${type}.ben`, 1), [toScroll(`${element}.${type}.bao`, 1)])],
  };
};

/** Đơn vị trận của người chơi: chỉ số gốc theo cấp cộng đồ đang mặc (như màn Nhân vật), công pháp đang mang. */
export function donViNguoiChoi(w: World): UnitSpec {
  const me = w.rules.members[PLAYER];
  const b = baseStats(me.level);
  const g = { hp: 0, atk: 0, def: 0 };
  for (const it of Object.values(w.player.gear)) {
    if (!it || it.durability <= 0) continue;
    const k = 1 + 0.03 * it.plus;
    g.hp += Math.round((it.stats.hp ?? 0) * k);
    g.atk += Math.round((it.stats.atk ?? 0) * k);
    g.def += Math.round((it.stats.def ?? 0) * k);
  }
  const [e1, e2] = w.player.roots;
  const techniques = loadoutTechniques(w.rules, PLAYER);
  const front = ["can_quet", "can_don", "than_phap", "ho_the"].includes(techniques[0]?.type ?? "can_don");
  return {
    id: 1, level: me.level, element: e1 ?? (w.region.region.element as Element), element2: e2, talents: [w.player.talent],
    hp: b.hp + g.hp, atk: b.atk + g.atk, def: b.def + g.def, row: front ? 0 : 1, techniques, sectId: me.sectId ?? undefined,
  };
}

/** Đồng môn NPC đi cùng (GDD tab Nhiệm vụ, luật chung: bước cần người khác thì đệ tử NPC đứng thay). */
function dongMon(id: number, level: number, element: Element, type: SkillType, row: 0 | 1): UnitSpec {
  const b = baseStats(level);
  return {
    id, level, element, row, talents: [row === 0 ? "tu_the" : "tu_phap"], hp: b.hp, atk: b.atk, def: b.def, sectId: "loi_tri_phong",
    techniques: [composeTechnique(toScroll(`${element}.${type}.ben`, 1), [toScroll(`kim.${type}.bao`, 1)])],
  };
}

/**
 * Trận có hạt giống mà người chơi thắng: thử lần lượt các hạt giống; vẫn thua thì giảm sức dị thú 10% mỗi vòng (luật chung tab
 * Nhiệm vụ: nhiệm vụ không thất bại, không bước nào kẹt).
 */
function tranThang(build: (permille: number) => Omit<BattleInput, "seed">, permille: number, seed0: number): { input: BattleInput; permille: number } {
  for (let p = permille; p >= 200; p -= 100) {
    const base = build(p);
    for (let s = 0; s < 24; s++) {
      const input = { ...base, seed: seed0 + s };
      if (simulate(input).winner === "A") return { input, permille: p };
    }
  }
  const input = { ...build(200), seed: seed0 };
  return { input, permille: 200 };
}

/** 0.5 Thử chiêu: người chơi và 2 đồng môn cấp 1 đánh 3 dị thú hệ bị hệ vùng khắc, chỉ số theo JSON (statPermille 800). */
export function tranThuChieu(w: World, seed: number): { input: BattleInput; foe: Element; permille: number } {
  const q = CHUOI.find((x) => x.id === "chinh.0.5")!;
  const enemy = q.steps[0].enemy ?? { count: 3, statPermille: 800 };
  const home = w.region.region.element as Element;
  const foe = heBiKhac(home);
  const me = donViNguoiChoi(w);
  const r = tranThang((p) => ({
    teamA: [me, dongMon(2, 1, home, "can_don", 0), dongMon(3, 1, home, "tam_xa", 1)],
    teamB: Array.from({ length: enemy.count }, (_, i) => ONE_MON(101 + i, 1, p, foe, i === enemy.count - 1 ? "tam_xa" : "can_don", i === enemy.count - 1 ? 1 : 0)),
  }), enemy.statPermille, seed);
  return { ...r, foe };
}

/** 0.6 Mỏ đầu tiên: người chơi và 3 đồng môn đánh 3 dị thú cấp 3 canh mỏ (statPermille 900, JSON fallback của 0.6). */
export function tranChiemMo(w: World, seed: number): { input: BattleInput; foe: Element; permille: number } {
  const home = w.region.region.element as Element;
  const foe = heBiKhac(home);
  const me = donViNguoiChoi(w);
  const r = tranThang((p) => ({
    teamA: [me, dongMon(2, 1, home, "can_don", 0), dongMon(3, 1, home, "tam_xa", 1), dongMon(4, 1, home, "ho_the", 0)],
    teamB: [0, 1, 2].map((i) => ONE_MON(101 + i, 3, p, foe, i === 2 ? "tam_xa" : "can_don", i === 2 ? 1 : 0)),
  }), 900, seed);
  return { ...r, foe };
}

// ---- Thao tác từng bước (chỉ sửa World và MoiState; nguonMoi.ts cộng thưởng, ghi sự kiện và lưu) ---------------------

export type KetQua = { ok: true; message?: string } | { ok: false; error: string };

/** Ghi xong một nhiệm vụ của chuỗi (đúng thứ tự); trả phần thưởng để nơi gọi cộng. */
export function danhDauXong(moi: MoiState, id: string): QuestRow["reward"] | undefined {
  const cur = buocHienTai(moi);
  if (!cur || cur.id !== id) return undefined;
  moi.xong.push(id);
  return thuongCua(id);
}

const dangLam = (moi: MoiState, id: string): boolean => buocHienTai(moi)?.id === id;

/** 0.1: chọn vùng bắt đầu (chỉ vùng đang mở) rồi tới thành chủ (người mới đã đứng sẵn ở đó). */
export function lamChonVung(moi: MoiState, code: string, mo: string[]): KetQua {
  if (!dangLam(moi, "chinh.0.1")) return { ok: false, error: "khong_dung_buoc" };
  if (!mo.includes(code)) return { ok: false, error: "vung_chua_mo" };
  moi.vung = code;
  moi.daChonVung = true;
  return { ok: true };
}

/** 0.2 phần 1: lộ linh căn và tài năng đã gieo sẵn. */
export function lamGieoQue(w: World, moi: MoiState): KetQua {
  if (!dangLam(moi, "chinh.0.2")) return { ok: false, error: "khong_dung_buoc" };
  moi.daGieo = true;
  w.player.roots = [...moi.que.roots];
  w.player.talent = moi.que.talent;
  return { ok: true };
}

/** 0.2 phần 2: tạo hình (thân, áo) và đạo hiệu; xong thì bước 0.2 hoàn thành. */
export function lamTaoHinh(w: World, moi: MoiState, look: MoiState["look"], name: string): KetQua {
  if (!dangLam(moi, "chinh.0.2") || !moi.daGieo) return { ok: false, error: "khong_dung_buoc" };
  const n = name.replace(/\s+/g, " ").trim();
  if (n.length < 2 || n.length > 16) return { ok: false, error: "ten_khong_hop_le" };
  moi.look = { ...look };
  w.player.name = n;
  w.names[PLAYER] = n;
  return { ok: true };
}

/** 0.3: vào tông gợi ý làm ngoại môn (GDD mục 6), truyền tống từ thành chủ về sơn môn qua Truyền Tống Trận cơ bản. */
export function lamGiaNhap(w: World, moi: MoiState, sectId: string, now: number): KetQua {
  if (!dangLam(moi, "chinh.0.3")) return { ok: false, error: "khong_dung_buoc" };
  const r = apply(w.rules, { type: "gia_nhap_tong", actor: PLAYER, sectId }, now);
  if (!r.ok) return { ok: false, error: r.error };
  // Truyền tống tức thì: chuyến đã xong, không hiện "Hành trình" ở Động phủ.
  // Bản đồ coi chuyến đã xong là đứng ở điểm đi (mapScene.hereId), nên cả hai đầu là sơn môn.
  w.travel = { from: w.sonMon, to: w.sonMon, startsAt: now - 62 * 60_000, endsAt: now - 61 * 60_000 };
  return { ok: true };
}

/** Mã tông ghi trên công pháp tân thủ (TAN_THU_SECT của @ktlp/rules): riêng chủ nhân, không đóng băng khi rời tông. */
export const TAN_THU = TAN_THU_SECT;

/** Xem trước công pháp ghép từ 2 tàn quyển tặng: tên và chỉ số trận. */
export function xemTruocTanThu(w: World, moi: MoiState): { main: OwnedScroll; sub: OwnedScroll; ten: string; tech: Technique } | undefined {
  const bag = w.rules.members[PLAYER].bag;
  const [main, sub] = moi.quaTanThu.map((uid) => bag.find((s) => s.uid === uid));
  if (!main || !sub) return undefined;
  return { main, sub, ten: techniqueName(main.kind, [sub.kind]), tech: techniqueOf({ main, subs: [sub] }) };
}

/**
 * 0.4: ghép 2 tàn quyển tặng thành công pháp tân thủ (lệnh ghep_tan_thu của @ktlp/rules: không cần nộp, không cần chức vị,
 * học luôn tầng 1), rồi mang vào trận ô đầu.
 */
export function lamGhepTanThu(w: World, moi: MoiState, now: number): KetQua {
  if (!dangLam(moi, "chinh.0.4")) return { ok: false, error: "khong_dung_buoc" };
  const xem = xemTruocTanThu(w, moi);
  if (!xem) return { ok: false, error: "khong_co_tan_quyen" };
  const g = apply(w.rules, { type: "ghep_tan_thu", actor: PLAYER, main: xem.main.uid, subs: [xem.sub.uid] }, now);
  if (!g.ok) return { ok: false, error: g.error };
  const ev = g.events[0];
  if (ev.type !== "ghep_tan_thu") return { ok: false, error: "lenh_khong_hop_le" };
  const me = w.rules.members[PLAYER];
  const r = apply(w.rules, { type: "mang_vao_tran", actor: PLAYER, techniqueIds: [ev.technique.techniqueId, ...me.loadout].slice(0, 4) }, now);
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, message: `Ghép được ${ev.technique.name}, đã mang vào trận` };
}

export const TEN_HE: Record<Element, string> = {
  kim: "Kim", moc: "Mộc", thuy: "Thủy", hoa: "Hỏa", tho: "Thổ", loi: "Lôi", phong: "Phong",
  cuc_duong: "Cực dương", cuc_am: "Cực âm", cuc_han: "Cực hàn", quang: "Quang", am_lanh: "Âm lãnh",
};

function themChienBao(w: World, moi: MoiState, input: BattleInput, title: string, arena: string, now: number): number {
  const id = Math.max(0, ...w.reports.map((r) => r.id)) + 1;
  moi.tran[id] = input;
  w.reports.unshift({ id, seed: input.seed, title, at: now, arena });
  return id;
}

/** 0.5: trận thử chiêu; trả id chiến báo để mở màn Trận. */
export function lamThuChieu(w: World, moi: MoiState, now: number): KetQua & { battleId?: number } {
  if (!dangLam(moi, "chinh.0.5")) return { ok: false, error: "khong_dung_buoc" };
  if (!w.rules.members[PLAYER].loadout.length) return { ok: false, error: "chua_co_cong_phap" };
  const { input, foe } = tranThuChieu(w, (moi.seed % 9_973) + 50);
  const home = w.region.region.element as Element;
  const battleId = themChienBao(w, moi, input, `Thử chiêu: 3 dị thú hệ ${TEN_HE[foe]}`, `${w.region.region.code}/hang_di_thu`, now);
  return { ok: true, battleId, message: `Ra trận: hệ ${TEN_HE[home]} khắc ${TEN_HE[foe]}, sát thương ×1,5` };
}

/** 0.6 phần 1: cùng đồng môn đánh dị thú canh mỏ; thắng thì mỏ về tông (đã tích sẵn 3 giờ sản lượng để thu lần đầu). */
export function lamChiemMo(w: World, moi: MoiState, now: number): KetQua & { battleId?: number } {
  if (!dangLam(moi, "chinh.0.6") || moi.daChiemMo) return { ok: false, error: "khong_dung_buoc" };
  const p = w.region.points[moi.moMucTieu];
  const { input } = tranChiemMo(w, (moi.seed % 9_973) + 500);
  const battleId = themChienBao(w, moi, input, `Chiếm mỏ linh thạch cấp 1 từ dị thú`, `${w.region.region.code}/mo_linh_thach`, now);
  moi.moNpc = moi.moNpc.filter((m) => m.pointId !== p.id);
  if (!w.held.some((h) => h.pointId === p.id)) w.held.push({ pointId: p.id, type: p.type, level: 1, uncollectedSince: now - 3 * 3600_000 });
  moi.daChiemMo = true;
  return { ok: true, battleId, message: "Đã chiếm mỏ linh thạch cấp 1" };
}

/** Mốc mở bí cảnh kế tiếp (12:00, 20:00 giờ máy; sheet Tham số opensPerDay), tính từ `now`. */
export function biCanhKe(now: number, gio = [12, 20]): number {
  for (let d = 0; d < 2; d++) {
    for (const h of gio) {
      const t = new Date(now);
      t.setDate(t.getDate() + d);
      t.setHours(h, 0, 0, 0);
      if (t.getTime() > now) return t.getTime();
    }
  }
  return now + 24 * 3600_000;
}

/** 0.7: đặt nhắc khung bí cảnh gần nhất; thưởng túi tân thủ vào túi (gộp chồng cùng mã). */
export function lamDatNhac(moi: MoiState, now: number): KetQua & { at?: number } {
  if (!dangLam(moi, "chinh.0.7")) return { ok: false, error: "khong_dung_buoc" };
  moi.nhacBiCanh = biCanhKe(now);
  return { ok: true, at: moi.nhacBiCanh };
}

/** Cộng món thưởng nhiệm vụ vào túi. */
export function themMon(w: World, items: { item: string; count: number }[]): string[] {
  const out: string[] = [];
  for (const { item, count } of items) {
    const m = MON_TAN_THU[item];
    if (!m) continue;
    const stack = w.player.bag.find((b) => b.code === m.code);
    if (stack) stack.count += count;
    else w.player.bag.push({ uid: w.player.nextUid++, kind: m.kind, name: m.name, grade: "ha", gradeLabel: m.kind === "dan" ? "Đan dược" : "Phù", count, detail: m.detail, art: m.art, code: m.code });
    out.push(`${count} ${m.name}`);
  }
  return out;
}

// Thế giới cho người chơi mới (GDD mục 3, 6, 14 FTUE; tab Nhiệm vụ chương 0 "Nhập Thế"): cấp 1, Luyện Khí, chưa vào tông,
// đứng ở thành chủ vùng gợi ý; linh căn và tài năng gieo sẵn theo hạt giống, chỉ lộ ở bia Tầm Đạo (nhiệm vụ 0.2); 2 tàn quyển
// tặng sẵn để ghép công pháp đầu (0.4); đồ và tài nguyên khởi đầu tối thiểu. Quanh người chơi vẫn có tông môn NPC gợi ý gia
// nhập (0.3), các tông khác, và mỏ do dị thú hoặc Huyết Sát Môn giữ để đánh chiếm ở 0.6.
// Tông môn, tàn quyển, công pháp dựng bằng lệnh của @ktlp/rules qua apply(), như mock/world.ts.
// File thuần (không DOM, không import.meta) để chạy được bằng node --test; JSON nạp kèm `with { type: "json" }`.
// Số tự đặt ghi "đề xuất".
import { addMember, addSect, apply, emptyState, type Command, type GameState, type Role } from "@ktlp/rules";
import { comboRelation, COMBO, elementMultiplier, ELEMENTS, TALENTS, type BattleInput, type Element, type SkillType, type Talent } from "@ktlp/sim";
import type { RegionMap } from "../../scenes/map/region.ts";
import type { HeldPoint, OtherSect, World } from "../mock/world.ts";
import type { BagItem, Building, GearSlot, LuyenKhiSlot, LuyenKhiView, PointType } from "../source.ts";
import VUNG from "../../../../data/he_thong/json/vung.json" with { type: "json" };
import CAP_TONG_MON from "../../../../data/he_thong/json/cap_tong_mon.json" with { type: "json" };

/** Phải trùng PLAYER, SECT, REGION của mock/world.ts (nguonMoi.ts kiểm lúc chạy). */
export const PLAYER = "p1";
export const SECT = "loi_tri_phong";
/** Prototype chỉ mở Lôi Đình Cốc (tab Nhiệm vụ, Phạm vi prototype); 11 vùng còn lại hiện ở màn chọn vùng nhưng khóa. */
export const VUNG_MO = ["loi_dinh_coc"];

/** Cấp tông NPC gợi ý gia nhập (đề xuất): đủ 4 điểm, tầm 1 chặng, còn chỗ cho mỏ chiếm ở 0.6. */
export const CAP_TONG_GOI_Y = 15;
/** Phần nghìn người có 2 linh căn (GDD mục 6: 1–2 hệ; tỷ lệ là đề xuất). */
export const PHAN_LINH_CAN_KEP = 300;
/** Tài nguyên khởi đầu (đề xuất). */
export const KHOI_DAU = { linhThach: 100, tienNgoc: 0, danHoiMau: 3 };
/** Cấp mở tự lập tông (GDD mục 6, đề xuất). */
export const CAP_LAP_TONG = 20;
/** Cấp nguy hiểm tối đa của chỗ sơn môn tông gợi ý cho người mới (đề xuất). */
export const NGUY_SON_MON = 40;

const H = 3600_000;

/** Loại chiêu của 2 tàn quyển tặng theo tài năng: luôn là chiêu gây sát thương để thắng được trận đầu (đề xuất). */
export const CHIEU_TAN_THU: Record<Talent, SkillType> = {
  tu_the: "can_quet", tu_phap: "tam_xa", tu_tran: "tran_phap", tu_dan: "tam_xa",
  sat_thu: "than_phap", tu_ren: "can_don", tu_duoc: "tam_xa", tu_kim_tien: "can_don",
};
const BIEN_THE = ["bao", "toc", "linh", "ben"] as const;

/** 4 thân và 2 áo có hình PixelLab (assets/pixellab/nhan_vat/<thân>/<áo>); GDD mục 6, Ngoại hình nhân vật. */
export const THAN = ["nam_khoe", "nam_manh", "nu_khoe", "nu_manh"] as const;
export const AO = ["dao_bao", "vo_phuc"] as const;
export type Than = (typeof THAN)[number];
export type Ao = (typeof AO)[number];

/** Kết quả gieo quẻ ở bia Tầm Đạo: gieo sẵn lúc tạo thế giới (theo hạt giống), lộ ra ở nhiệm vụ 0.2. */
export interface GieoQue {
  roots: Element[];
  talent: Talent;
  name: string;
  look: { body: Than; outfit: Ao };
}

/** Phần trạng thái riêng của người mới, lưu cùng World. */
export interface MoiState {
  seed: number;
  taoLuc: number;
  vung: string;
  /** Đã chọn vùng ở 0.1 chưa (vùng nhà là `vung`). */
  daChonVung: boolean;
  que: GieoQue;
  daGieo: boolean;
  look: { body: Than; outfit: Ao };
  /** Mã nhiệm vụ chương 0 đã xong, theo thứ tự (chinh.0.1 …). */
  xong: string[];
  /** 0.6: đã chiếm mỏ, chờ thu lần đầu. */
  daChiemMo: boolean;
  /** Uid 2 tàn quyển tặng sẵn. */
  quaTanThu: number[];
  /** Trận của người mới: id chiến báo → đầu vào trận, để màn Trận phát lại đúng trận đã đánh. */
  tran: Record<number, BattleInput>;
  /** Mỏ do NPC giữ (dị thú, Huyết Sát Môn); mỏ ở 0.6 là `moMucTieu`. */
  moNpc: { pointId: number; by: string; level: number }[];
  moMucTieu: number;
  /** Mốc mở bí cảnh đã đặt nhắc (0.7). */
  nhacBiCanh?: number;
  daNhacLuc?: number;
  /** Ẩn thẻ chỉ dẫn sau khi xong chương 0. */
  anThe?: boolean;
  thuGon?: boolean;
  /** Nhiệm vụ chính sau chương 0: bước đang làm; cờ đã xong một lượt bế quan (bước tu_luyen); danh vọng phe; giờ bế quan hôm nay. */
  nvBuoc?: number;
  /** Hiệp đang đánh của ải Tầm Đạo nhiều hiệp (tamDao.8). */
  aiHiep?: number;
  nvTuLuyenXong?: boolean;
  danhVong?: Record<string, number>;
  beQuanNgay?: { ngay: string; gio: number };
  /** Phe của lựa chọn gần nhất (bước chon), cho thưởng danh vọng "$pheDaChon". */
  pheCuoi?: string;
  /** Bế quan đang chạy (sau chương 0): mốc bắt đầu, kết thúc, tu vi mỗi giờ tính lúc bắt đầu. */
  beQuan?: { batDau: number; ketThuc: number; moiGio: number };
}

/** Số ngẫu nhiên có hạt giống (mulberry32), cùng thuật toán với mock/world.ts. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

const pick = <T>(rand: () => number, a: readonly T[]): T => a[Math.floor(rand() * a.length)];

/** Số chặng từ một điểm tới mọi điểm (BFS trên đường đi), như stagesFrom của region.ts. */
export function chang(m: RegionMap, start: number): Map<number, number> {
  const near = new Map<number, number[]>();
  for (const e of m.edges) {
    if (!near.has(e.a)) near.set(e.a, []);
    if (!near.has(e.b)) near.set(e.b, []);
    near.get(e.a)!.push(e.b);
    near.get(e.b)!.push(e.a);
  }
  const d = new Map<number, number>([[start, 0]]);
  let frontier = [start];
  for (let s = 1; frontier.length; s++) {
    const next: number[] = [];
    for (const id of frontier) for (const n of near.get(id) ?? []) if (!d.has(n)) (d.set(n, s), next.push(n));
    frontier = next;
  }
  return d;
}

const GIU_DUOC: PointType[] = ["mo_linh_thach", "mo_quang", "mo_duoc", "linh_tuyen", "cua_bi_canh", "deo", "ben_do"];

type VungRow = { name: string; elements: string[]; dropElements: string[]; dropWeights?: Record<string, number> };
export const VUNG_DATA = VUNG as unknown as Record<string, VungRow>;

/** Hệ bị hệ chủ đạo của vùng khắc mạnh nhất (nhiệm vụ 0.5, `$beatenByHome`): hệ số ×1,5 theo GDD mục 8. */
export function heBiKhac(home: Element): Element {
  let best: Element = ELEMENTS[0];
  for (const e of ELEMENTS) if (e !== home && elementMultiplier(home, e) > elementMultiplier(home, best)) best = e;
  return best;
}

/** Hệ khắc `foe` mạnh nhất (`$counterOfRound` của ải Tầm Đạo 8). */
export function heKhacNhat(foe: Element): Element {
  let best: Element = ELEMENTS[0];
  for (const e of ELEMENTS) if (e !== foe && elementMultiplier(e, foe) > elementMultiplier(best, foe)) best = e;
  return best;
}

const HO = ["Lăng", "Mộ Dung", "Hàn", "Tô", "Bạch", "Diệp", "Lâm", "Cố", "Phương", "Vân", "Thạch", "Lục", "Tần", "Liễu", "Thẩm", "Giang", "Tạ", "Đường"];
const TEN = ["Vân", "Phong", "Thanh", "Hạo", "Tuyết", "Linh", "Dao", "Khởi", "Mặc", "Nhạn", "Viễn", "Kha", "Uyên", "Trần", "Minh", "Sương"];

/** Đạo hiệu ngẫu nhiên: họ và tên Hán Việt (tự đặt cho prototype). */
export function tenNgauNhien(rand: () => number): string {
  return `${pick(rand, HO)} ${pick(rand, TEN)}`;
}

/** Gieo linh căn, tài năng, đạo hiệu và dáng mặc định. */
export function gieoQue(rand: () => number): GieoQue {
  const first = pick(rand, ELEMENTS);
  const roots: Element[] = [first];
  if (rand() * 1000 < PHAN_LINH_CAN_KEP) {
    let second = pick(rand, ELEMENTS);
    while (second === first) second = pick(rand, ELEMENTS);
    roots.push(second);
  }
  return {
    roots,
    talent: pick(rand, TALENTS),
    name: tenNgauNhien(rand),
    look: { body: pick(rand, THAN), outfit: pick(rand, AO) },
  };
}

/**
 * Hai tàn quyển tặng (nhiệm vụ 0.4): chủ quyển thuộc hệ chủ đạo của vùng nhà, để trận 0.5 thấy được khắc chế; phụ quyển ưu
 * tiên linh căn của người chơi khi không tương khắc với hệ vùng, không thì lấy hệ rơi của vùng hợp nhất. Cùng loại chiêu theo
 * tài năng, phẩm Phàm (đề xuất).
 */
export function quaTanThu(home: Element, que: GieoQue, rand: () => number, drops: Element[]): [string, string] {
  const type = CHIEU_TAN_THU[que.talent];
  const ok = (e: Element) => e !== home && comboRelation(home, e).t >= COMBO.neutral;
  const best = [...que.roots, ...drops].filter(ok).sort((a, b) => comboRelation(home, b).t - comboRelation(home, a).t);
  const sub = que.roots.find(ok) ?? best[0] ?? home;
  return [`${home}.${type}.${pick(rand, BIEN_THE)}`, `${sub}.${type}.${pick(rand, BIEN_THE)}`];
}

function must(state: GameState, cmd: Command, now: number) {
  const r = apply(state, cmd, now);
  if (!r.ok) throw new Error(`Thế giới mới: lệnh ${cmd.type} lỗi ${r.error}`);
  return r.events;
}

/** Tông NPC gợi ý: tông chủ, phó, 2 trưởng lão và đệ tử đều là NPC; có sẵn 4 công pháp truyền thụ cho người mới học. */
function dungLuat(now: number, rand: () => number, home: Element, que: GieoQue): { s: GameState; qua: number[] } {
  const s = emptyState();
  addSect(s, SECT, CAP_TONG_GOI_Y);
  const roster: [string, Role, number][] = [
    ["t1", "tong_chu", 62], ["t2", "pho_tong_chu", 48], ["t3", "truong_lao", 40], ["t4", "truong_lao", 36],
    ["d1", "noi_mon", 24], ["d2", "noi_mon", 19], ["d3", "noi_mon", 15], ["d4", "noi_mon", 11], ["d5", "ngoai_mon", 6], ["d6", "ngoai_mon", 3],
  ];
  for (const [id, role, level] of roster) addMember(s, id, SECT, role, level);
  addMember(s, PLAYER, null, null, 1);

  const give = (who: string, kind: string, grade: number): number => {
    const ev = must(s, { type: "nhat_tan_quyen", actor: "system", memberId: who, kind, grade }, now)[0];
    return ev.type === "nhat_tan_quyen" ? ev.scroll.uid : -1;
  };
  const compose = (main: [string, number], sub: [string, number]): number => {
    const a = give("t3", ...main);
    const b = give("t3", ...sub);
    must(s, { type: "nop_tan_quyen", actor: "t3", scrollUid: a }, now);
    must(s, { type: "nop_tan_quyen", actor: "t3", scrollUid: b }, now);
    const ev = must(s, { type: "ghep_cong_phap", actor: "t3", main: a, subs: [b] }, now)[0];
    return ev.type === "ghep_cong_phap" ? ev.technique.id : -1;
  };
  const e = home;
  const techs = [
    compose([`${e}.can_don.toc`, 1], ["kim.can_don.bao", 1]),
    compose([`${e}.tam_xa.linh`, 1], ["quang.tam_xa.bao", 1]),
    compose([`${e}.ho_the.ben`, 1], ["tho.ho_the.ben", 1]),
    compose([`${e}.dien_rong.bao`, 2], ["hoa.dien_rong.linh", 2]),
  ];
  must(s, { type: "dat_bo_truyen_thu", actor: "t1", techniqueIds: techs }, now);
  // Tàng Kinh Các còn vài quyển (để người chơi thấy kho của tông).
  for (const k of [`${e}.khong_che.linh`, `${e}.than_phap.toc`, "phong.tam_xa.toc"]) must(s, { type: "nop_tan_quyen", actor: "t4", scrollUid: give("t4", k, 1) }, now);

  const drops = (VUNG_DATA.loi_dinh_coc?.dropElements ?? [home]) as Element[];
  const [main, sub] = quaTanThu(home, que, rand, drops);
  const qua = [give(PLAYER, main, 1), give(PLAYER, sub, 1)];
  return { s, qua };
}

/** Chỗ sơn môn của tông gợi ý: trong 1 chặng có ít nhất 1 mỏ linh thạch và 2 điểm giữ được khác, cấp nguy hiểm thấp. */
function chonSonMon(m: RegionMap, rand: () => number): { sonMon: number; mo: number; giu: number[] } {
  const ok: { sonMon: number; mo: number; giu: number[]; danger: number }[] = [];
  for (const p of m.points) {
    if (p.type !== "son_mon") continue;
    const d = chang(m, p.id);
    const gan = m.points.filter((q) => GIU_DUOC.includes(q.type) && d.get(q.id) === 1).sort((a, b) => a.danger - b.danger || a.id - b.id);
    const mo = gan.find((q) => q.type === "mo_linh_thach");
    const khac = gan.filter((q) => q !== mo && q.type !== "mo_linh_thach");
    if (mo && khac.length >= 2) ok.push({ sonMon: p.id, mo: mo.id, giu: khac.slice(0, 2).map((q) => q.id), danger: p.danger });
  }
  if (!ok.length) throw new Error(`Thế giới mới: vùng ${m.region.code} không có chỗ sơn môn hợp`);
  ok.sort((a, b) => a.danger - b.danger || a.sonMon - b.sonMon);
  // Người mới cấp 1: chỉ bốc chỗ có cấp nguy hiểm thấp (sơn môn và mỏ quanh đó không quá xa thành chủ).
  const gan = ok.filter((c) => c.danger <= NGUY_SON_MON);
  return pick(rand, gan.length ? gan : ok.slice(0, 1));
}

function lkSlot(): LuyenKhiSlot {
  return { sub: 0, kl: { cap: 0, exp: 0 }, van: [] };
}

/** Túi khởi đầu: vài viên đan hồi máu (đề xuất). Uid từ 10.000 như mock/world.ts. */
function tuiKhoiDau(): BagItem[] {
  return [{ uid: 10_000, kind: "dan", name: "Bổ Huyết Đan", grade: "ha", gradeLabel: "Đan dược", count: KHOI_DAU.danHoiMau, detail: "Hồi máu trong trận.", art: "dan/dan_duoc_hoi_mau", code: "DA-DD-001" }];
}

/** Mã hạt giống ngẫu nhiên cho người mới (trình duyệt hoặc Node đều có crypto). */
export function hatGiongMoi(): number {
  const a = new Uint32Array(1);
  globalThis.crypto.getRandomValues(a);
  return a[0] || 1;
}

/**
 * Dựng thế giới cho người mới vào game. `region` là file điểm của vùng gợi ý (prototype: Lôi Đình Cốc). Cùng `seed` thì ra cùng
 * thế giới (để test và để agent chơi thử lặp lại được); trình duyệt gọi với hatGiongMoi().
 */
export function taoTheGioiMoi(seed: number, region: RegionMap, now: number): { world: World; moi: MoiState } {
  const rand = seeded(seed);
  const home = region.region.element as Element;
  const que = gieoQue(rand);
  const { s: rules, qua } = dungLuat(now, rand, home, que);
  const { sonMon, mo, giu } = chonSonMon(region, rand);
  const thanhChu = region.points.find((p) => p.type === "thanh_chu")!.id;

  // Bốn tông khác trong vùng (cùng tên với bản mẫu), sơn môn cách tông gợi ý ít nhất 3 chặng; chưa ai vào liên minh.
  const taken = new Set<number>([sonMon, mo, ...giu]);
  const dMine = chang(region, sonMon);
  const others: Omit<OtherSect, "points" | "sonMon">[] = [
    { id: "van_loi_cac", name: "Vạn Lôi Các", level: 41, faction: "Chính", ally: false, online: 6, color: "#5aa9e6" },
    { id: "thien_loi_dai", name: "Thiên Lôi Đài", level: 27, faction: "Chính", ally: false, online: 3, color: "#7bc96f" },
    { id: "thanh_phong_cac", name: "Thanh Phong Các", level: 38, faction: "Tà", ally: false, online: 9, color: "#c77dff" },
    { id: "tu_dien_mon", name: "Tử Điện Môn", level: 22, faction: "Tà", ally: false, online: 2, color: "#e9a23b" },
  ];
  const sects: OtherSect[] = others.map((o) => {
    const free = region.points.filter((p) => p.type === "son_mon" && !taken.has(p.id) && (dMine.get(p.id) ?? 99) >= 3).map((p) => p.id);
    const at = pick(rand, free);
    taken.add(at);
    const d = chang(region, at);
    const pts = region.points.filter((p) => GIU_DUOC.includes(p.type) && !taken.has(p.id) && d.get(p.id) === 1).slice(0, 4).map((p) => p.id);
    pts.forEach((id) => taken.add(id));
    return { ...o, sonMon: at, points: pts };
  });

  // Mỏ của NPC: mỏ mục tiêu (dị thú canh, trong tầm Truyền Tống Trận), và vài mỏ xa hơn do Huyết Sát Môn giữ.
  const moNpc: MoiState["moNpc"] = [{ pointId: mo, by: "Dị thú", level: 1 }];
  const xa = region.points
    .filter((p) => p.type === "mo_linh_thach" && !taken.has(p.id) && (dMine.get(p.id) ?? 99) >= 2 && (dMine.get(p.id) ?? 99) <= 4)
    .sort((a, b) => dMine.get(a.id)! - dMine.get(b.id)! || a.id - b.id)
    .slice(0, 2);
  for (const p of xa) {
    taken.add(p.id);
    moNpc.push({ pointId: p.id, by: "Huyết Sát Môn", level: 2 });
  }

  const held: HeldPoint[] = giu.map((id) => ({ pointId: id, type: region.points[id].type, level: region.points[id].type.startsWith("mo_") ? 1 : 0, uncollectedSince: now }));
  const names: Record<string, string> = {
    [PLAYER]: que.name, t1: "Lôi Trì Chân Nhân", t2: "Mộ Dung Tuyết", t3: "Hàn Thạch", t4: "Tô Linh",
    d1: "Bạch Khởi Phong", d2: "Diệp Thanh", d3: "Lâm Mặc", d4: "Cố Tiểu Vũ", d5: "Phương Hạo", d6: "Tiểu Bảo",
  };
  const npcIds = Object.keys(rules.members).filter((id) => id !== PLAYER);
  const gearCodes = ["TB-KI-001", "TB-AO-003"];
  const luyenKhi: LuyenKhiView = {
    khiTinh: 0, khiTinhKhoa: 0, linhVanThach: 0, vanThiet: 0,
    slots: { vu_khi: lkSlot(), ao: lkSlot() } as Partial<Record<GearSlot, LuyenKhiSlot>>,
    gems: [], phach: [], owned: gearCodes, doPho: [], anVanLo: [],
    week: { text: "Mặc 3 món khí hình Cầm khác nhau trong tuần", have: 0, need: 3, thuong: "Linh Văn Thạch", endsAt: now + 7 * 24 * H },
  };
  const buildings: Building[] = [
    { id: "chinh_dien", name: "Chính Điện", level: 3 },
    { id: "tang_kinh_cac", name: "Tàng Kinh Các", level: 2 },
    { id: "ho_son_dai_tran", name: "Hộ Sơn Đại Trận", level: 2 },
    { id: "dien_vo_truong", name: "Diễn Võ Trường", level: 1 },
    { id: "luyen_dan_phong", name: "Luyện Đan Phòng", level: 1 },
    { id: "luyen_khi_cac", name: "Luyện Khí Các", level: 1 },
    { id: "linh_duoc_vien", name: "Linh Dược Viên", level: 1 },
    { id: "bao_kho", name: "Bảo Khố", level: 1 },
    { id: "truyen_tong_tran", name: "Truyền Tống Trận", level: 1 },
    { id: "thuong_hoi", name: "Thương hội", level: 0, locked: "Cần người có tài năng Tu kim tiền" },
    { id: "phi_thang_dai", name: "Phi Thăng Đài", level: 0, locked: "Mở ở cấp tông môn 200" },
  ];
  const row = CAP_TONG_MON[CAP_TONG_GOI_Y - 1] as { xpToNext: number };

  const world: World = {
    rules,
    region,
    sonMon,
    names,
    online: Object.fromEntries([PLAYER, ...npcIds].map((id) => [id, true])),
    npc: Object.fromEntries(npcIds.map((id) => [id, true])),
    player: {
      name: que.name,
      // Chưa gieo quẻ: chưa có linh căn; tài năng giữ chỗ (nguonMoi.ts che tới khi gieo).
      roots: [],
      talent: "tu_the",
      exp: 0,
      linhThach: KHOI_DAU.linhThach,
      tienNgoc: KHOI_DAU.tienNgoc,
      satNghiep: 0,
      gear: {
        vu_khi: { slot: "vu_khi", name: "Kiếm Thanh Cương", plus: 0, durability: 100, durabilityMax: 100, sockets: 0, gems: [], stats: { atk: 20 }, icon: "do/vu_khi/kiem", art: "trang_bi/kiem/01", rarity: "luc", code: "TB-KI-001" },
        ao: { slot: "ao", name: "Đạo Bào Tro", plus: 0, durability: 100, durabilityMax: 100, sockets: 0, gems: [], stats: { hp: 150, def: 8 }, art: "trang_bi/ao/03", rarity: "luc", code: "TB-AO-003" },
      },
      mounts: [null, null, null, null, null],
      riding: 0,
      bag: tuiKhoiDau(),
      board: {},
      luyenKhi,
      nextUid: 10_100,
    },
    sect: {
      name: "Lôi Trì Phong", model: { id: "loi_loi_tri_phong", name: "Lôi Trì Phong", element: "loi" },
      xp: Math.round(row.xpToNext * 0.3), faction: "Chính", vault: { linhThach: 1_200, quang: 80, duoc: 40 },
    },
    held,
    sects,
    applicants: [],
    wars: [],
    tides: [],
    jobs: [],
    buildings,
    // Đứng ở thành chủ (chuyến cuối đã xong từ lâu nên không hiện "Hành trình" ở Động phủ).
    travel: { from: thanhChu, to: thanhChu, startsAt: now - 2 * H, endsAt: now - H },
    reports: [],
    mail: [{
      id: 1, from: "Thành chủ", title: "Chào đạo hữu",
      body: "Linh mạch vừa sống lại. Đạo hữu theo thẻ Nhiệm vụ ở cuối màn: chọn vùng, gieo quẻ ở bia Tầm Đạo, rồi tìm một tông môn để nương thân.",
      unread: true,
    }],
    alliance: { joined: false, name: "", leader: "" },
    chat: [],
    nextChat: 1,
  };
  const moi: MoiState = {
    seed, taoLuc: now, vung: region.region.code, daChonVung: false, que, daGieo: false, look: { ...que.look },
    xong: [], daChiemMo: false, quaTanThu: qua, tran: {}, moNpc, moMucTieu: mo,
  };
  return { world, moi };
}

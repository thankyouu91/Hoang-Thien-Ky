// Trạng thái mẫu cho dashboard khi chưa có server giả (Sprint 5).
// Phần tông môn, tàn quyển, công pháp dựng bằng chính lệnh của @ktlp/rules qua apply(); phần luật chưa có
// (mỏ, hành trình, trang bị, thú cưỡi, liên minh) là dữ liệu tạm ở đây, số lấy từ data/he_thong/json.
// Tên người, tên tông môn và số lượng là tự đặt cho bản mẫu.
import { addMember, addSect, apply, emptyState, type Command, type GameState, type Role } from "@ktlp/rules";
import type { Element } from "@ktlp/sim";
import type { SectModel } from "../art/sectScene.ts";
import type { BagItem, Building, GearItem, GearSlot, PointType, Rarity } from "../source.ts";
import { HOLDABLE, stagesFrom, type RegionMap } from "../../scenes/map/region.ts";

export const PLAYER = "p1";
export const SECT = "loi_tri_phong";
export const REGION = "loi_dinh_coc";
/** Vị trí sơn môn của tông mẫu: Cổ tích, cách thành chủ 2 chặng, 6 điểm giữ được trong 1 chặng. */
const SON_MON = 84;

const H = 3600_000;
const MIN = 60_000;

export interface HeldPoint {
  pointId: number;
  type: PointType;
  level: number;
  uncollectedSince: number;
  attacked?: { by: string; endsAt: number };
}

export interface OtherSect {
  id: string;
  name: string;
  level: number;
  faction: string;
  sonMon: number;
  points: number[];
  ally: boolean;
  online: number;
  color: string;
}

export interface Job {
  kind: "hanh_trinh" | "xay" | "ren" | "luyen_dan" | "be_quan";
  title: string;
  detail: string;
  startsAt: number;
  endsAt: number;
}

export interface World {
  rules: GameState;
  region: RegionMap;
  sonMon: number;
  names: Record<string, string>;
  online: Record<string, boolean>;
  npc: Record<string, boolean>;
  player: {
    name: string;
    roots: Element[];
    talent: "tu_the";
    exp: number;
    linhThach: number;
    tienNgoc: number;
    satNghiep: number;
    gear: Partial<Record<GearSlot, GearItem>>;
    mounts: (string | null)[];
    /** Ô của thú đang cưỡi. */
    riding: number;
    /** Món trong túi chưa có luật (đồ, ngọc, đan, nguyên liệu, phù, trứng thú); tàn quyển lấy từ @ktlp/rules. */
    bag: BagItem[];
    nextUid: number;
  };
  sect: { name: string; model: SectModel; xp: number; faction: string; vault: { linhThach: number; quang: number; duoc: number } };
  held: HeldPoint[];
  sects: OtherSect[];
  applicants: { id: string; name: string; level: number }[];
  wars: { id: number; with: string; direction: "di" | "den"; startsAt: number }[];
  /** Yêu Triều (GDD mục 17): yêu thú tràn vào vùng biên trong một khung giờ; maxRing chọn các điểm sát rìa ngoài. */
  tides: { title: string; startsAt: number; endsAt: number; maxRing: number }[];
  jobs: Job[];
  buildings: Building[];
  travel: { from: number; to: number; startsAt: number; endsAt: number };
  /** arena: nền sân PixelLab san_dau/<tên> của màn Trận; bỏ trống là võ trường. */
  reports: { id: number; seed: number; title: string; at: number; arena?: string }[];
  mail: { id: number; from: string; title: string; body: string; unread: boolean }[];
  alliance: { joined: boolean; name: string; leader: string };
  chat: { id: number; from: string; text: string; at: number; reported?: boolean }[];
  nextChat: number;
}

/** Phẩm lọc túi theo độ hiếm (đề xuất GDD rev 217): lục, lam là hạ; tím là trung; vàng, đỏ là cao. */
export const RARITY_GRADE: Record<Rarity, BagItem["grade"]> = { luc: "ha", lam: "ha", tim: "trung", vang: "cao", do: "cao" };
export const RARITY_LABEL: Record<Rarity, string> = { luc: "Lục", lam: "Lam", tim: "Tím", vang: "Vàng", do: "Đỏ" };

/** Túi mẫu: đồ dự phòng, ngọc, đan, nguyên liệu, phù và một trứng thú; uid từ 10.000 để khỏi trùng uid tàn quyển. */
function sampleBag(): BagItem[] {
  let uid = 10_000;
  const gear = (g: Omit<GearItem, "durability" | "durabilityMax" | "gems"> & { durability?: number }, detail: string): BagItem => ({
    uid: uid++, kind: "trang_bi", name: g.name, grade: RARITY_GRADE[g.rarity], gradeLabel: RARITY_LABEL[g.rarity],
    count: 1, icon: g.icon, art: g.art, rarity: g.rarity, code: g.code, detail, gear: { durability: 100, durabilityMax: 100, gems: [], ...g },
  });
  // art, code theo assets/icon_ve/danh_sach.json; ngọc giữ ký hiệu hệ PixelLab làm hình dự phòng.
  const item = (kind: BagItem["kind"], name: string, grade: BagItem["grade"], gradeLabel: string, count: number, detail: string, art: string, code: string, element?: Element): BagItem => ({
    uid: uid++, kind, name, grade, gradeLabel, count, detail, element, art, code, icon: kind === "ngoc" && element ? `he/${element}` : undefined,
  });
  return [
    gear({ slot: "vu_khi", name: "Đao Liệt Hỏa", tier: "linh", plus: 2, sockets: 1, stats: { atk: 90 }, icon: "do/vu_khi/dao", rarity: "lam" }, "Đao rèn ở lò thành chủ."),
    gear({ slot: "vu_khi", name: "Trượng Thanh Mộc", tier: "thien", plus: 0, sockets: 2, stats: { atk: 105, mana: 40 }, icon: "do/vu_khi/truong", rarity: "tim" }, "Rơi ở bí cảnh Mộc."),
    gear({ slot: "mu", name: "Nón Lá Tị Thủy", tier: "linh", plus: 1, sockets: 1, stats: { hp: 700, def: 25 }, icon: "do/mu/non_la", rarity: "luc", code: "TB-MU-010" }, "Nón lá đan bằng cỏ linh."),
    gear({ slot: "mu", name: "Ngọc Quan Tử Vân", tier: "thien", plus: 3, sockets: 2, stats: { hp: 1200, def: 40 }, icon: "do/mu/ngoc_quan", art: "trang_bi/mu/25", rarity: "lam", code: "TB-MU-025" }, "Mũ ngọc của chân truyền."),
    gear({ slot: "ao", name: "Giáp Huyền Thiết", tier: "thien", plus: 0, sockets: 2, stats: { hp: 2400, def: 90 }, art: "trang_bi/ao/26", rarity: "lam", code: "TB-AO-026" }, "Giáp nặng, thủ cao."),
    gear({ slot: "dai", name: "Đai Lôi Văn", tier: "linh", plus: 0, sockets: 1, stats: { hp: 500, def: 35 }, art: "trang_bi/dai/25", rarity: "lam", code: "TB-DA-025" }, "Đai thêu vân sấm."),
    gear({ slot: "giay", name: "Giày Đạp Vân", tier: "thien", plus: 1, sockets: 1, stats: { hp: 600, def: 30 }, art: "trang_bi/giay/25", rarity: "lam", code: "TB-GI-025" }, "Giày nhẹ của thân pháp sư."),
    gear({ slot: "vu_khi", name: "Kiếm Huyết Long", tier: "than", plus: 0, sockets: 3, stats: { atk: 160 }, art: "trang_bi/kiem/58", rarity: "do", code: "TB-KI-058" }, "Thần vật rơi ở bí cảnh cao."),
    item("ngoc", "Ngọc Lôi", "trung", "Cấp 2", 3, "Khảm vào dòng đã kích hoạt: tăng sát thương hoặc kháng Lôi.", "ngoc/loi", "NG-KH-006", "loi"),
    item("ngoc", "Ngọc Hỏa", "ha", "Cấp 1", 5, "Khảm vào dòng đã kích hoạt: tăng sát thương hoặc kháng Hỏa.", "ngoc/hoa", "NG-KH-004", "hoa"),
    item("ngoc", "Ngọc Kim", "cao", "Cấp 3", 1, "Khảm vào dòng đã kích hoạt: tăng sát thương hoặc kháng Kim.", "ngoc/kim", "NG-KH-001", "kim"),
    item("ngoc", "Ngọc Thủy", "ha", "Cấp 1", 2, "Ba viên cùng hệ cùng cấp nén thành một viên cấp trên.", "ngoc/thuy", "NG-KH-003", "thuy"),
    item("dan", "Hồi Khí Đan", "ha", "Đan dược", 10, "Hồi mana trong trận.", "dan/dan_duoc_hoi_mana", "DA-DD-002"),
    item("dan", "Bổ Huyết Đan", "ha", "Đan dược", 6, "Hồi máu trong trận.", "dan/dan_duoc_hoi_mau", "DA-DD-001"),
    item("dan", "Tụ Linh Đan", "trung", "Linh đan", 2, "Tăng tốc tu luyện khi bế quan.", "dan/linh_dan_tu_luyen", "DA-LD-003"),
    item("dan", "Phá Cảnh Đan", "cao", "Thần đan", 1, "Dùng khi đột phá cảnh giới, giảm lôi kiếp.", "dan/than_dan_pha_canh", "DA-TD-001"),
    item("nguyen_lieu", "Thiết tinh", "ha", "Quặng", 40, "Rèn và sửa đồ ở Hạ vị.", "quang/thiet_tinh", "QU-BA-001"),
    item("nguyen_lieu", "Huyền thiết", "trung", "Quặng", 12, "Rèn đồ thiên cấp.", "quang/huyen_thiet", "QU-BA-002"),
    item("nguyen_lieu", "Linh thảo", "ha", "Dược liệu", 25, "Luyện đan dược phẩm thấp.", "duoc/linh_thao", "DL-TH-001"),
    item("nguyen_lieu", "Tử Lôi Thảo", "trung", "Dược liệu", 4, "Dược liệu hệ Lôi.", "duoc/tu_loi_thao", "DL-HI-001", "loi"),
    item("phu", "Phù chống sét", "trung", "Phù", 3, "Đỡ một đợt lôi kiếp khi đột phá.", "phu/chong_set", "PH-CH-001"),
    item("phu", "Phù bảo ngọc", "cao", "Phù", 1, "Giữ lại ngọc khi nén thất bại.", "phu/bao_ngoc", "PH-CH-002"),
    item("phu", "Phù bảo hộ", "trung", "Phù", 2, "Giữ nguyên nấc khi rèn từ +21 thất bại.", "phu/bao_ho", "PH-CH-003"),
    item("trung_thu", "Trứng Lôi Tước", "trung", "Trứng thú", 1, "Nở ra Lôi Tước khi còn trống một ô thú.", "trung_thu/thuong", "TT-TH-001", "loi"),
  ];
}

/** Mốc giờ hôm nay theo giờ máy (server giả cùng múi giờ với người chơi). */
export function todayAt(now: number, hour: number, minute = 0): number {
  const d = new Date(now);
  d.setHours(hour, minute, 0, 0);
  return d.getTime();
}

function must(state: GameState, cmd: Command, now: number) {
  const r = apply(state, cmd, now);
  if (!r.ok) throw new Error(`Dữ liệu mẫu: lệnh ${cmd.type} lỗi ${r.error}`);
  return r.events;
}

/** Dựng tông môn mẫu bằng lệnh của @ktlp/rules: nhặt và nộp tàn quyển, ghép, chọn bộ truyền thụ, học, mang vào trận. */
function buildRules(now: number): GameState {
  const s = emptyState();
  addSect(s, SECT, 34);
  addMember(s, PLAYER, SECT, "tong_chu", 42);
  const roster: [string, Role, number][] = [
    ["m2", "pho_tong_chu", 40], ["m3", "truong_lao", 38], ["m4", "truong_lao", 35],
    ["m5", "noi_mon", 33], ["m6", "noi_mon", 31], ["m7", "noi_mon", 29], ["m8", "noi_mon", 27],
    ["m9", "noi_mon", 24], ["m10", "ngoai_mon", 12], ["n1", "noi_mon", 30], ["n2", "noi_mon", 30], ["n3", "noi_mon", 28],
  ];
  for (const [id, role, level] of roster) addMember(s, id, SECT, role, level);

  const give = (kind: string, grade: number): number => {
    const ev = must(s, { type: "nhat_tan_quyen", actor: "system", memberId: PLAYER, kind, grade }, now)[0];
    return ev.type === "nhat_tan_quyen" ? ev.scroll.uid : -1;
  };
  const deposit = (uid: number) => must(s, { type: "nop_tan_quyen", actor: PLAYER, scrollUid: uid }, now);
  const compose = (main: [string, number], sub: [string, number]): number => {
    const a = give(...main);
    const b = give(...sub);
    deposit(a);
    deposit(b);
    const ev = must(s, { type: "ghep_cong_phap", actor: PLAYER, main: a, subs: [b] }, now)[0];
    return ev.type === "ghep_cong_phap" ? ev.technique.id : -1;
  };

  // Sáu công pháp của tông; một công pháp phẩm Hoàng để thấy luật học theo cấp (cấp 42 chưa học được).
  const t1 = compose(["loi.can_quet.linh", 1], ["quang.can_quet.bao", 1]);
  const t2 = compose(["loi.tam_xa.toc", 1], ["am_lanh.tam_xa.bao", 1]);
  const t3 = compose(["kim.can_don.bao", 1], ["loi.can_don.toc", 1]);
  const t4 = compose(["loi.ho_the.ben", 1], ["tho.ho_the.ben", 1]);
  const t5 = compose(["loi.dien_rong.bao", 2], ["hoa.dien_rong.linh", 2]);
  const t6 = compose(["moc.hoi_phuc.linh", 1], ["thuy.hoi_phuc.ben", 1]);
  must(s, { type: "dat_bo_truyen_thu", actor: PLAYER, techniqueIds: [t1, t2, t3, t4, t5, t6] }, now);
  for (const t of [t1, t2, t3, t4]) must(s, { type: "hoc_cong_phap", actor: PLAYER, techniqueId: t }, now);
  // Ô thứ tư để trống: thẻ Việc nên làm "Ô công pháp còn trống"; công pháp hộ thể đã học nằm chờ trong túi để kéo vào.
  must(s, { type: "mang_vao_tran", actor: PLAYER, techniqueIds: [t1, t2, t3] }, now);

  // Tàng Kinh Các còn vài quyển để ghép thử; túi còn vài quyển chưa nộp.
  for (const [k, g] of [["loi.khong_che.linh", 1], ["kim.khong_che.toc", 1], ["phong.than_phap.toc", 1], ["loi.than_phap.bao", 1], ["quang.tran_phap.linh", 2]] as [string, number][]) {
    deposit(give(k, g));
  }
  for (const [k, g] of [["loi.bua_chu.linh", 1], ["cuc_han.tam_xa.toc", 2], ["moc.can_don.ben", 1]] as [string, number][]) give(k, g);
  return s;
}

/** Điểm giữ được trong `range` chặng quanh một sơn môn, gần nhất trước. */
function nearbyHoldable(m: RegionMap, sonMon: number, range: number, taken: Set<number>): number[] {
  const d = stagesFrom(m, sonMon);
  return m.points
    .filter((p) => HOLDABLE.includes(p.type) && !taken.has(p.id) && (d.get(p.id) ?? 99) <= range)
    .sort((a, b) => d.get(a.id)! - d.get(b.id)! || a.id - b.id)
    .map((p) => p.id);
}

export function createWorld(region: RegionMap, now: number): World {
  const rules = buildRules(now);
  const point = (id: number) => region.points[id];

  // Lãnh thổ: 6 điểm trong 1 chặng quanh sơn môn (cấp 34: tối đa 6 điểm, tầm 1 chặng).
  const taken = new Set<number>();
  const mine = nearbyHoldable(region, SON_MON, 1, taken).slice(0, 6);
  mine.forEach((id) => taken.add(id));
  const mineLevel: Partial<Record<PointType, number>> = { mo_linh_thach: 3, mo_quang: 2, mo_duoc: 2 };
  const held: HeldPoint[] = mine.map((id, i) => ({
    pointId: id,
    type: point(id).type,
    level: mineLevel[point(id).type] ?? 0,
    // Một mỏ chưa thu quá 8 giờ để thẻ Việc nên làm có việc.
    uncollectedSince: now - (i === 1 ? 9 * H + 20 * MIN : 3 * H + 10 * MIN),
  }));
  // Huyết Sát Môn đang đánh một mỏ linh thạch; trận phá trận kết thúc sau 38 phút.
  const target = held.find((h) => h.type === "mo_linh_thach" && h !== held[1]) ?? held[0];
  target.attacked = { by: "Huyết Sát Môn", endsAt: now + 38 * MIN };

  // Các tông khác trong vùng: hai đồng minh, hai đối thủ; mỗi tông giữ vài điểm quanh sơn môn của họ.
  const others: Omit<OtherSect, "points">[] = [
    { id: "van_loi_cac", name: "Vạn Lôi Các", level: 41, faction: "Chính", sonMon: 29, ally: true, online: 6, color: "#5aa9e6" },
    { id: "thien_loi_dai", name: "Thiên Lôi Đài", level: 27, faction: "Chính", sonMon: 39, ally: true, online: 3, color: "#7bc96f" },
    { id: "thanh_phong_cac", name: "Thanh Phong Các", level: 38, faction: "Tà", sonMon: 44, ally: false, online: 9, color: "#c77dff" },
    { id: "tu_dien_mon", name: "Tử Điện Môn", level: 22, faction: "Tà", sonMon: 53, ally: false, online: 2, color: "#e9a23b" },
  ];
  const sects: OtherSect[] = others.map((o) => {
    taken.add(o.sonMon);
    const pts = nearbyHoldable(region, o.sonMon, o.level >= 50 ? 2 : 1, taken).slice(0, 5);
    pts.forEach((id) => taken.add(id));
    return { ...o, points: pts };
  });

  const thanhChu = region.points.find((p) => p.type === "thanh_chu")!.id;
  const names: Record<string, string> = {
    p1: "Lăng Vân", m2: "Mộ Dung Tuyết", m3: "Hàn Thạch", m4: "Tô Linh", m5: "Bạch Khởi Phong", m6: "Diệp Thanh",
    m7: "Lâm Mặc", m8: "Cố Tiểu Vũ", m9: "Phương Hạo", m10: "Tiểu Bảo", n1: "Đệ tử NPC Giáp", n2: "Đệ tử NPC Ất", n3: "Đệ tử NPC Bính",
  };

  return {
    rules,
    region,
    sonMon: SON_MON,
    names,
    online: { p1: true, m2: true, m3: false, m4: true, m5: true, m6: false, m7: false, m8: true, m9: false, m10: true, n1: true, n2: true, n3: true },
    npc: { n1: true, n2: true, n3: true },
    player: {
      name: names.p1,
      roots: ["loi"],
      talent: "tu_the",
      exp: 8_960,
      linhThach: 3_280,
      tienNgoc: 120,
      satNghiep: 0,
      gear: {
        // Tên, hình vẽ, độ hiếm và mã lấy từ assets/icon_ve/danh_sach.json; đồ đang mặc có đủ lam, tím, vàng để thấy màu nền.
        // Kiếm Tử Điện và Ô Sa Lôi Văn chưa có hình vẽ nên giữ hình PixelLab.
        vu_khi: { slot: "vu_khi", name: "Kiếm Tử Điện", tier: "thien", plus: 8, durability: 76, durabilityMax: 100, sockets: 2, gems: [{ element: "loi", level: 3 }], stats: { atk: 120 }, icon: "do/vu_khi/kiem", rarity: "tim", code: "TB-KI-051" },
        mu: { slot: "mu", name: "Ô Sa Lôi Văn", tier: "linh", plus: 5, durability: 64, durabilityMax: 100, sockets: 1, gems: [], stats: { hp: 900, def: 30 }, icon: "do/mu/o_sa", rarity: "lam", code: "TB-MU-027" },
        ao: { slot: "ao", name: "Pháp Y Tinh Hà", tier: "linh", plus: 6, durability: 58, durabilityMax: 98, sockets: 2, gems: [{ element: "kim", level: 2 }], stats: { hp: 1800, def: 60 }, art: "trang_bi/ao/41", rarity: "tim", code: "TB-AO-041" },
        dai: { slot: "dai", name: "Đai Hoàng Long", tier: "linh", plus: 4, durability: 81, durabilityMax: 100, sockets: 1, gems: [], stats: { hp: 600, def: 40 }, art: "trang_bi/dai/53", rarity: "vang", code: "TB-DA-053" },
        bao_tay: { slot: "bao_tay", name: "Hộ Thủ Thiết Lân", tier: "linh", plus: 2, durability: 88, durabilityMax: 100, sockets: 1, gems: [], stats: { atk: 20, def: 35 }, art: "trang_bi/bao_tay/25", rarity: "lam", code: "TB-BT-025" },
        giay: { slot: "giay", name: "Ngoa Tinh Tú", tier: "linh", plus: 3, durability: 14, durabilityMax: 100, sockets: 0, gems: [], stats: { hp: 400, def: 25 }, art: "trang_bi/giay/42", rarity: "tim", code: "TB-GI-042" },
        ngoc_boi: { slot: "ngoc_boi", name: "Bội Long Phượng", tier: "thien", plus: 2, durability: 92, durabilityMax: 100, sockets: 3, gems: [{ element: "loi", level: 2 }, { element: "hoa", level: 1 }], stats: { atk: 40, mana: 30 }, art: "trang_bi/ngoc_boi/53", rarity: "vang", code: "TB-NB-053" },
      },
      mounts: ["thiem_dien_bao", "loi_am_lang", "loi_tuoc", "thiet_boi_nguu", null],
      riding: 0,
      bag: sampleBag(),
      nextUid: 10_100,
    },
    sect: { name: "Lôi Trì Phong", model: { id: "loi_loi_tri_phong", name: "Lôi Trì Phong", element: "loi" }, xp: 118_400, faction: "Chính", vault: { linhThach: 8_420, quang: 1_260, duoc: 540 } },
    held,
    sects,
    applicants: [
      { id: "a1", name: "Vân Khê", level: 18 },
      { id: "a2", name: "Thạch Đầu", level: 9 },
    ],
    wars: [{ id: 1, with: "Thanh Phong Các", direction: "den", startsAt: todayAt(now, 21) }],
    // Đang có một đợt Yêu Triều để thấy nhấp nháy đỏ trên bản đồ (bản mẫu; mùa Yêu Triều là đề xuất ở GDD mục 17).
    tides: [{ title: "Yêu Triều tràn vào rìa Lôi Đình Cốc", startsAt: now - 15 * MIN, endsAt: now + 45 * MIN, maxRing: 0.15 }],
    jobs: [
      { kind: "xay", title: "Tàng Kinh Các lên cấp 6", detail: "Hàng xây ở sơn môn", startsAt: now - 2 * H, endsAt: now + 1 * H + 25 * MIN },
      { kind: "ren", title: "Kiếm Tử Điện +8 → +9", detail: "Lò rèn thành chủ", startsAt: now - 20 * MIN, endsAt: now + 6 * MIN },
      { kind: "luyen_dan", title: "Hồi Khí Đan × 10", detail: "Luyện Đan Phòng", startsAt: now - 30 * MIN, endsAt: now + 42 * MIN },
      { kind: "be_quan", title: "Bế quan: Lôi Quang Liên Hoàn Quyết", detail: "Tầng 1 → 2", startsAt: now - 1 * H, endsAt: now + 3 * H },
    ],
    buildings: [
      { id: "chinh_dien", name: "Chính Điện", level: 7 },
      { id: "tang_kinh_cac", name: "Tàng Kinh Các", level: 5, upgradingUntil: now + 1 * H + 25 * MIN },
      { id: "ho_son_dai_tran", name: "Hộ Sơn Đại Trận", level: 4 },
      { id: "dien_vo_truong", name: "Diễn Võ Trường", level: 4 },
      { id: "luyen_dan_phong", name: "Luyện Đan Phòng", level: 3 },
      { id: "luyen_khi_cac", name: "Luyện Khí Các", level: 3 },
      { id: "linh_duoc_vien", name: "Linh Dược Viên", level: 2 },
      { id: "bao_kho", name: "Bảo Khố", level: 4 },
      { id: "truyen_tong_tran", name: "Truyền Tống Trận", level: 1 },
      { id: "thuong_hoi", name: "Thương hội", level: 0, locked: "Cần người có tài năng Tu kim tiền" },
      { id: "phi_thang_dai", name: "Phi Thăng Đài", level: 0, locked: "Mở ở cấp tông môn 200" },
    ],
    // Đang đi từ thành chủ về sơn môn, còn 14 phút.
    travel: { from: thanhChu, to: SON_MON, startsAt: now - 9 * MIN, endsAt: now + 14 * MIN },
    reports: [
      { id: 1, seed: 11, title: "Thủ mỏ linh thạch trước Huyết Sát Môn", at: now - 2 * H, arena: "mo_linh_thach" },
      { id: 2, seed: 2, title: "Hang dị thú cấp 58", at: now - 5 * H, arena: "cao_nguyen" },
      { id: 3, seed: 3, title: "Tranh cửa bí cảnh 12:00", at: now - 9 * H },
    ],
    mail: [
      { id: 1, from: "Hệ thống", title: "Thưởng bí cảnh hôm qua", body: "Tông môn nhận 2 tàn quyển phẩm Phàm vào Tàng Kinh Các.", unread: true },
      { id: 2, from: "Mộ Dung Tuyết", title: "Tối nay thủ mỏ", body: "Thanh Phong Các tuyên chiến 21:00. Ai rảnh thì vào Diễn Võ Trường xếp đội trước 20:45.", unread: false },
    ],
    alliance: { joined: true, name: "Lôi Minh", leader: "Vạn Lôi Các" },
    chat: [
      { id: 1, from: "Vạn Lôi Các · Tần Phong", text: "Thứ Năm này đánh Thanh Phong Các, các tông chuẩn bị trận pháp sư.", at: now - 50 * MIN },
      { id: 2, from: "Thiên Lôi Đài · Lục Y", text: "Bên mình xin hộ chiến mỏ quặng phía bắc.", at: now - 22 * MIN },
      { id: 3, from: "Lôi Trì Phong · Mộ Dung Tuyết", text: "Đã nhận, 20:45 tập trung.", at: now - 18 * MIN },
    ],
    nextChat: 4,
  };
}

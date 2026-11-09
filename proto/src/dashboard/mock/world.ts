// Trạng thái mẫu cho dashboard khi chưa có server giả (Sprint 5).
// Phần tông môn, tàn quyển, công pháp dựng bằng chính lệnh của @htk/rules qua apply(); phần luật chưa có
// (mỏ, hành trình, trang bị, thú cưỡi, liên minh) là dữ liệu tạm ở đây, số lấy từ data/he_thong/json.
// Tên người, tên tông môn và số lượng là tự đặt cho bản mẫu.
import { addMember, addSect, apply, emptyState, type Command, type GameState, type Role } from "@htk/rules";
import type { Element } from "@htk/sim";
import type { SectModel } from "../art/sectScene.ts";
import type { Building, GearItem, GearSlot, PointType } from "../source.ts";
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
  };
  sect: { name: string; model: SectModel; xp: number; faction: string; vault: { linhThach: number; quang: number; duoc: number } };
  held: HeldPoint[];
  sects: OtherSect[];
  applicants: { id: string; name: string; level: number }[];
  wars: { id: number; with: string; direction: "di" | "den"; startsAt: number }[];
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

/** Dựng tông môn mẫu bằng lệnh của @htk/rules: nhặt và nộp tàn quyển, ghép, chọn bộ truyền thụ, học, mang vào trận. */
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
  for (const t of [t1, t2, t3]) must(s, { type: "hoc_cong_phap", actor: PLAYER, techniqueId: t }, now);
  // Ô thứ tư để trống: thẻ Việc nên làm "Ô công pháp còn trống".
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
        vu_khi: { slot: "vu_khi", name: "Kiếm Tử Điện", tier: "thien", plus: 8, durability: 76, durabilityMax: 100, sockets: 2, gems: [{ element: "loi", level: 3 }], stats: { atk: 120 }, icon: "do/vu_khi/kiem" },
        mu: { slot: "mu", name: "Ô Sa Lôi Văn", tier: "linh", plus: 5, durability: 64, durabilityMax: 100, sockets: 1, gems: [], stats: { hp: 900, def: 30 }, icon: "do/mu/o_sa" },
        ao: { slot: "ao", name: "Đạo Bào Thanh Vân", tier: "linh", plus: 6, durability: 58, durabilityMax: 98, sockets: 2, gems: [{ element: "kim", level: 2 }], stats: { hp: 1800, def: 60 } },
        dai: { slot: "dai", name: "Đai Huyền Thiết", tier: "linh", plus: 4, durability: 81, durabilityMax: 100, sockets: 1, gems: [], stats: { hp: 600, def: 40 } },
        giay: { slot: "giay", name: "Giày Truy Phong", tier: "linh", plus: 3, durability: 14, durabilityMax: 100, sockets: 0, gems: [], stats: { hp: 400, def: 25 } },
        ngoc_boi: { slot: "ngoc_boi", name: "Ngọc Bội Chấn Lôi", tier: "thien", plus: 2, durability: 92, durabilityMax: 100, sockets: 3, gems: [{ element: "loi", level: 2 }, { element: "hoa", level: 1 }], stats: { atk: 40, mana: 30 } },
      },
      mounts: ["thiem_dien_bao", "loi_am_lang", "loi_tuoc", "thiet_boi_nguu", null],
    },
    sect: { name: "Lôi Trì Phong", model: { id: "loi_loi_tri_phong", name: "Lôi Trì Phong", element: "loi" }, xp: 118_400, faction: "Chính", vault: { linhThach: 8_420, quang: 1_260, duoc: 540 } },
    held,
    sects,
    applicants: [
      { id: "a1", name: "Vân Khê", level: 18 },
      { id: "a2", name: "Thạch Đầu", level: 9 },
    ],
    wars: [{ id: 1, with: "Thanh Phong Các", direction: "den", startsAt: todayAt(now, 21) }],
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

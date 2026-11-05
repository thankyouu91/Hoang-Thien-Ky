// Nguồn dữ liệu cho người chơi mới: kế thừa MockDashboardSource (cùng luật, cùng các màn), thêm chuỗi nhập môn (ftue.ts),
// che phần chưa có (chưa gieo quẻ, chưa vào tông), và lưu tiến độ theo tài khoản sau mỗi lệnh (luu.ts).
// NguonTheoTaiKhoan là nguồn index.ts đưa cho các màn: đổi tài khoản (đăng nhập, đăng xuất) thì nạp tiến độ của tài khoản đó.
import { simulate, type BattleInput, type Element } from "@ktlp/sim";
import type { AuthSource } from "../auth.ts";
import { minePerHour, MockDashboardSource, realmOf } from "../mock/source.ts";
import { PLAYER as MOCK_PLAYER, REGION as MOCK_REGION, SECT as MOCK_SECT, type World } from "../mock/world.ts";
import { loadRegion, loadWorld, type WorldRegion } from "../../scenes/map/region.ts";
import { ghi } from "../server.ts";
import type {
  BanDoView, CommandResult, DashboardCommand, DashboardSource, DongPhuView, Go, MiniMapView, NhanVatView,
  TodoCard, TongMonView, TopBarView,
} from "../source.ts";
import { ERROR_TEXT } from "../ui.ts";
import { tr } from "../i18n.ts";
import {
  biCanhKe, BUOC_FTUE, buocHienTai, chotBeQuan, danhDauXong, lamChiemMo, lamChonVung, lamDatNhac, lamGhepTanThu, lamGiaNhap, lamGieoQue, lamTaoHinh, lamThuChieu,
  nhiemVuKe, TEN_HE, themMon, thuongCua, xemTruocTanThu, type BuocView, type KetQua,
} from "./ftue.ts";
import { docTienDo, donBanCu, ghiTienDo, xoaTienDo } from "./luu.ts";
import { CAP_LAP_TONG, hatGiongMoi, heBiKhac, PLAYER, SECT, taoTheGioiMoi, VUNG_DATA, VUNG_MO, type MoiState } from "./theGioiMoi.ts";

/**
 * Nối các phần của một lời báo bằng " · ", dịch từng phần trước khi nối (bản tiếng Anh): bộ dịch áp mẫu cho cả câu trước
 * khi tách, nên một mẫu chung như "Ghép được {}" hay "{} cấp {}" sẽ nuốt cả các phần sau.
 */
const noi = (parts: (string | undefined)[]): string => parts.filter((p): p is string => !!p).map(tr).join(" · ");

if (PLAYER !== MOCK_PLAYER || SECT !== MOCK_SECT || !VUNG_MO.includes(MOCK_REGION)) throw new Error("moi/theGioiMoi.ts lệch mã với mock/world.ts");

Object.assign(ERROR_TEXT, {
  chua_vao_tong: "Cần vào tông môn trước. Làm theo thẻ Nhiệm vụ để gia nhập.",
  khong_dung_buoc: "Chưa tới bước này của nhiệm vụ.",
  vung_chua_mo: "Vùng này chưa mở ở bản chơi thử.",
  ten_khong_hop_le: "Đạo hiệu cần 2–16 ký tự.",
  da_co_tong: "Bạn đã ở trong một tông môn.",
  chi_ban_mau: "Nút thử này chỉ có ở bản mẫu trên máy dev.",
  chua_co_cong_phap: "Cần ghép công pháp đầu tiên trước.",
});

/** Lệnh thử chỉ dùng ở bản mẫu; người chơi thật không dùng được (nút cũng ẩn bằng moi.css). */
const laLenhThu = (type: string) => type.startsWith("dev_");
/** Lệnh cần đã vào tông (mock không tự chặn). */
const CAN_TONG = new Set(["thu_mo", "hien_te", "chat", "duyet_don", "xin_vao_lien_minh"]);

export interface FtueView {
  buoc?: BuocView;
  tong: number;
  xong: number;
  /** Sau chương 0: nhiệm vụ chính kế. */
  ke?: { ten: string; minLevel: number; mo: boolean };
  anThe: boolean;
  thuGon: boolean;
  level: number;
  /** Sau chương 0: tu vi bế quan mỗi giờ, và bế quan đang chạy (mốc kết thúc). */
  moiGio: number;
  beQuanXong?: number;
}

/** Thông tin cho các bảng của từng bước (FTUE UI). */
export interface FtueChiTiet {
  vung: { code: string; name: string; element: string; drops: string[]; capital: string; mo: boolean; goiY: boolean }[];
  que?: MoiState["que"] & { daGieo: boolean };
  look: MoiState["look"];
  name: string;
  tong: { name: string; level: number; members: number; tongChu: string; element: string; techniques: string[]; sonMon: string; danger: number; terrain?: string; capLapTong: number; level0: number };
  ghep?: { main: { kind: string; name: string; element: string }; sub: { kind: string; name: string; element: string }; ten: string; type: string; damage: number; targets: number; cd: number; mana: number; rootMatch: "du" | "nua" | "khong" };
  thuChieu: { home: string; foe: string };
  mo: { name: string; level: number; perHour: number; by: string; pointId: number };
  biCanhKe: number;
  nhac?: number;
}

export class NguonMoi extends MockDashboardSource {
  readonly moi: MoiState;
  private readonly luu: () => void;

  constructor(w: World, moi: MoiState, auth: AuthSource | undefined, luu: (s: NguonMoi) => void) {
    super(w, auth);
    this.moi = moi;
    this.luu = () => luu(this);
  }

  get world(): World {
    return this.w;
  }

  private get daVaoTong(): boolean {
    return this.me.sectId !== null;
  }

  private get thanhChu(): number {
    return this.w.region.points.find((p) => p.type === "thanh_chu")!.id;
  }

  // ---- Che và vá các màn -------------------------------------------------------------------------------------------

  protected override top(): TopBarView {
    const t = super.top();
    return { ...t, portrait: `nhan_vat/${this.moi.look.body}/${this.moi.look.outfit}` };
  }

  protected override currentQuest(): { id: string; name: string; step: string; go: Go } | undefined {
    const b = buocHienTai(this.moi);
    if (b) return { id: b.id, name: `Nhập Thế ${b.so}/7: ${b.ten}`, step: b.loi, go: { screen: "nhiem-vu", id: b.id } };
    // Sau chương 0: nhiệm vụ chính kế chưa có trong bản thử, nên chỉ việc lên cấp có thật là bế quan.
    const step = this.beQuanXong() ? "Đang bế quan" : `Bế quan: mỗi giờ +${this.retreatPerHour()} tu vi`;
    return { id: "be_quan", name: "Tu luyện tiếp", step, go: { screen: "nhiem-vu", id: "be_quan" } };
  }

  protected override todo(now: number): TodoCard[] {
    const all = super.todo(now);
    // Thẻ nhiệm vụ lên đầu; trước khi có công pháp đầu thì chưa nhắc "ô công pháp còn trống".
    const q = all.filter((c) => c.id === "nhiem_vu");
    const rest = all.filter((c) => c.id !== "nhiem_vu" && (c.id !== "o_trong" || this.me.learned.length > 0));
    return [...q, ...rest].slice(0, 3);
  }

  protected override miniMap(focus?: number[]): MiniMapView {
    const v = super.miniMap(focus);
    const npc = this.moi.moNpc.filter((m) => v.revealed.includes(m.pointId)).map((m) => ({ pointId: m.pointId, owner: "npc" as const }));
    if (this.daVaoTong) return { ...v, marks: [...v.marks, ...npc] };
    // Chưa vào tông: chỉ mở sương quanh thành chủ, chưa có điểm của mình; "nhà" là thành chủ.
    const w = this.w;
    const near = new Map<number, number[]>();
    for (const e of w.region.edges) {
      (near.get(e.a) ?? near.set(e.a, []).get(e.a)!).push(e.b);
      (near.get(e.b) ?? near.set(e.b, []).get(e.b)!).push(e.a);
    }
    const revealed = new Set([this.thanhChu]);
    let frontier = [this.thanhChu];
    for (let s = 0; s < 2; s++) {
      const next: number[] = [];
      for (const id of frontier) for (const n of near.get(id) ?? []) if (!revealed.has(n)) (revealed.add(n), next.push(n));
      frontier = next;
    }
    return {
      ...v, sonMon: this.thanhChu, marks: [], revealed: [...revealed], focus: focus && [this.thanhChu], alerts: [],
      openGates: v.openGates.filter((id) => revealed.has(id)),
    };
  }

  override async dongPhu(): Promise<DongPhuView> {
    const v = await super.dongPhu();
    // Kết quả chiến báo của người mới tính từ đúng trận đã đánh (mock tính từ trận mẫu theo seed).
    v.reports = v.reports.map((r) => {
      const input = this.moi.tran[r.id];
      if (!input) return r;
      const win = simulate(input).winner;
      return { ...r, result: win === "A" ? "thang" : win === "B" ? "thua" : "hoa", detail: `${input.teamA.length} đấu ${input.teamB.length}` };
    });
    if (this.moi.nhacBiCanh) {
      v.calendar = v.calendar.map((c) => (c.startsAt === this.moi.nhacBiCanh ? { ...c, title: `${c.title} · đã đặt nhắc` } : c));
    }
    if (!this.daVaoTong) v.city = { ...v.city, facilities: ["Bia Tầm Đạo", ...v.city.facilities] };
    return v;
  }

  override async battle(id: number): Promise<{ label: string; input: BattleInput; arena?: string } | undefined> {
    const input = this.moi.tran[id];
    const r = this.w.reports.find((x) => x.id === id);
    if (input && r) {
      // Người chơi là đội A: màn Trận hiện tên hai bên và Thắng/Thua (teams, viewer; tab Dashboard thêm vào DashboardSource).
      const out = { label: `Chiến báo · ${r.title}`, input, arena: r.arena, teams: [this.w.sect.name, "Dị thú"] as [string, string], viewer: 0 as const };
      return out;
    }
    return super.battle(id);
  }

  override async nhanVat(): Promise<NhanVatView> {
    const v = await super.nhanVat();
    const { body, outfit } = this.moi.look;
    v.look = { ...v.look, body, outfit, idle: `nhan_vat/${body}/${outfit}/dung` };
    if (!this.moi.daGieo) {
      v.roots = [];
      v.talent = { id: "", name: "Chưa gieo quẻ", combat: "Gieo quẻ ở bia Tầm Đạo, thành chủ." };
    }
    if (!this.daVaoTong) v.sect = { name: "Chưa vào tông môn", role: null, faction: "—" };
    return v;
  }

  override async tongMon(): Promise<TongMonView> {
    const v = await super.tongMon();
    if (!this.daVaoTong) {
      // Đang xem tông gợi ý từ bên ngoài: không có lãnh thổ "của mình" trên bản đồ mini, không nút nào dùng được.
      v.sect = { ...v.sect, name: `${v.sect.name} (tông gợi ý)` };
    }
    return v;
  }

  override async banDo(): Promise<BanDoView> {
    const v = await super.banDo();
    for (const m of this.moi.moNpc) v.owners[m.pointId] = { owner: "npc", name: m.by, level: m.level, perHour: minePerHour(m.level) };
    if (!this.daVaoTong) {
      for (const [id, o] of Object.entries(v.owners)) if (o.owner === "minh") v.owners[Number(id)] = { ...o, owner: "npc", attacked: undefined };
      v.inRange = [];
      v.held = 0;
      v.can = { chiem: false, tuyenChien: false };
    }
    return v;
  }

  override async send(cmd: DashboardCommand): Promise<CommandResult> {
    if (laLenhThu(cmd.type)) return { ok: false, error: "chi_ban_mau" };
    if (CAN_TONG.has(cmd.type) && !this.daVaoTong) return { ok: false, error: "chua_vao_tong" };
    const r = await super.send(cmd);
    if (r.ok) {
      let msg = r.message;
      // 0.6 phần 2: thu mỏ lần đầu sau khi chiếm.
      if (cmd.type === "thu_mo" && this.moi.daChiemMo) {
        const t = this.xong("chinh.0.6");
        if (t) msg = noi([msg, t]);
      }
      if (cmd.type === "ghep_cong_phap") ghi("ghep_cong_phap", { pham: this.sect.techniques[this.sect.techniques.length - 1]?.grade });
      this.luu();
      return { ok: true, message: msg };
    }
    return r;
  }

  // ---- Chuỗi nhập môn --------------------------------------------------------------------------------------------

  /** Hoàn thành một nhiệm vụ chương 0: cộng tu vi, linh thạch, món; ghi sự kiện ftue_buoc. Trả câu báo thưởng. */
  private xong(id: string): string | undefined {
    const r = danhDauXong(this.moi, id);
    if (!r) return undefined;
    const parts: string[] = [];
    if (r.exp) {
      // Lên cấp đã có hiệu ứng ở thanh trên (capDo.ts); câu thưởng không nhắc lại, để bộ dịch không gặp mẫu chung "{} cấp {}".
      this.gainExp(r.exp);
      parts.push(`+${r.exp} tu vi`);
    }
    if (r.linhThach) {
      this.w.player.linhThach += r.linhThach;
      parts.push(`+${r.linhThach} linh thạch`);
    }
    if (r.items) parts.push(...themMon(this.w, r.items));
    ghi("ftue_buoc", { buoc: BUOC_FTUE[id] });
    this.luu();
    // Nối bằng " · " để lớp dịch tiếng Anh dịch từng phần (i18nTra).
    return noi(parts);
  }

  ftue(): FtueView {
    const b = buocHienTai(this.moi);
    return {
      buoc: b, tong: 7, xong: this.moi.xong.length, ke: b ? undefined : nhiemVuKe(this.me.level),
      anThe: !!this.moi.anThe, thuGon: !!this.moi.thuGon, level: this.me.level,
      moiGio: this.retreatPerHour(), beQuanXong: this.beQuanXong(),
    };
  }

  /** Mốc xong của lượt bế quan đang chạy: việc be_quan của mock (lệnh be_quan, nút ở Nhân vật hay thẻ nhập môn), hoặc lượt dở của bản lưu cũ. */
  private beQuanXong(): number | undefined {
    const now = this.now();
    return this.w.jobs.find((j) => j.kind === "be_quan" && j.endsAt > now)?.endsAt ?? this.moi.beQuan?.ketThuc;
  }

  /**
   * Chốt bế quan đã hết giờ trước mỗi lệnh đọc (NguonTheoTaiKhoan) rồi lưu: việc be_quan của mock (settleRetreats; mock tự
   * chốt ở top(), nhưng sau khi đã dựng thẻ Đang chạy và không lưu), và lượt dở qua MoiState.beQuan của bản lưu cũ (4fe2fcb–1bf3db1).
   */
  chotBeQuan(): void {
    const now = this.now();
    const truoc = this.w.jobs.length;
    this.settleRetreats(now);
    const exp = chotBeQuan(this.w, this.moi, now);
    if (exp) {
      this.gainExp(exp);
      const id = Math.max(0, ...this.w.mail.map((m) => m.id)) + 1;
      this.w.mail.unshift({ id, from: "Động phủ", title: "Bế quan xong", body: `Bế quan xong, +${exp} tu vi`, unread: true });
    }
    if (exp || this.w.jobs.length !== truoc) this.luu();
  }

  async chiTiet(): Promise<FtueChiTiet> {
    const w = this.w;
    const plane = await loadWorld();
    const sect = this.sect;
    const sonMon = w.region.points[w.sonMon];
    const xem = xemTruocTanThu(w, this.moi);
    const roots = this.moi.daGieo ? this.moi.que.roots : [];
    const home = w.region.region.element as Element;
    const mo = w.region.points[this.moi.moMucTieu];
    const tc = sect.transmission.map((id) => sect.techniques.find((t) => t.id === id)?.name ?? "");
    return {
      vung: plane.regions.map((r: WorldRegion) => ({
        code: r.code, name: r.name, element: r.element, drops: VUNG_DATA[r.code]?.dropElements ?? [r.element], capital: r.capital.name,
        mo: VUNG_MO.includes(r.code), goiY: r.code === this.moi.vung,
      })).sort((a, b) => Number(b.goiY) - Number(a.goiY) || Number(b.mo) - Number(a.mo)),
      que: { ...this.moi.que, daGieo: this.moi.daGieo },
      look: this.moi.look,
      name: w.player.name,
      tong: {
        name: w.sect.name, level: sect.level, members: Object.values(w.rules.members).filter((m) => m.sectId === SECT).length,
        tongChu: w.names.t1 ?? "", element: w.sect.model.element, techniques: tc, sonMon: sonMon.name ?? "Sơn môn", danger: sonMon.danger,
        terrain: sonMon.terrain, capLapTong: CAP_LAP_TONG, level0: this.me.level,
      },
      ghep: xem && {
        main: { kind: xem.main.kind, name: xem.main.kind, element: xem.tech.element },
        sub: { kind: xem.sub.kind, name: xem.sub.kind, element: xem.tech.subElements[0] ?? xem.tech.element },
        ten: xem.ten, type: xem.tech.type, damage: Math.round(xem.tech.damage / 1000), targets: xem.tech.targets,
        cd: xem.tech.cooldownTicks / 20, mana: xem.tech.manaCost,
        rootMatch: roots.includes(xem.tech.element) ? "du" : xem.tech.subElements.some((e) => roots.includes(e)) ? "nua" : "khong",
      },
      thuChieu: { home: TEN_HE[home], foe: TEN_HE[heBiKhac(home)] },
      mo: { name: mo.name ?? "Mỏ linh thạch", level: 1, perHour: 20, by: "Dị thú", pointId: mo.id },
      biCanhKe: biCanhKe(this.now()),
      nhac: this.moi.nhacBiCanh,
    };
  }

  /** Làm một việc của thẻ chỉ dẫn; trả lời báo (kèm thưởng) và id trận nếu có trận để xem. */
  lam(viec: string, arg: Record<string, unknown> = {}): KetQua & { battleId?: number; at?: number } {
    const w = this.w;
    const moi = this.moi;
    const now = this.now();
    const done = (id: string, r: KetQua & { battleId?: number; at?: number }) => {
      if (!r.ok) return r;
      const t = this.xong(id);
      return { ...r, message: noi([r.message, t]) };
    };
    switch (viec) {
      case "chon_vung": {
        const r = lamChonVung(moi, String(arg.vung ?? ""), VUNG_MO);
        if (r.ok) ghi("vung_bat_dau", { vung: moi.vung });
        const tc = w.region.points[this.thanhChu].name ?? "thành chủ";
        return done("chinh.0.1", r.ok ? { ok: true, message: `Đã tới ${tc}` } : r);
      }
      case "gieo_que": {
        const r = lamGieoQue(w, moi);
        if (r.ok) {
          ghi("tai_nang", { tai_nang: moi.que.talent });
          this.luu();
        }
        return r;
      }
      case "tao_hinh": {
        const r = lamTaoHinh(w, moi, { body: arg.body as MoiState["look"]["body"], outfit: arg.outfit as MoiState["look"]["outfit"] }, String(arg.name ?? ""));
        return done("chinh.0.2", r);
      }
      case "gia_nhap": {
        const r = lamGiaNhap(w, moi, SECT, now);
        return done("chinh.0.3", r.ok ? { ok: true, message: `Đã vào ${w.sect.name}, làm ngoại môn đệ tử` } : r);
      }
      case "ghep": {
        const r = lamGhepTanThu(w, moi, now);
        if (r.ok) ghi("ghep_cong_phap", { to_hop: "tan_thu", pham: 1 });
        return done("chinh.0.4", r);
      }
      case "thu_chieu": {
        const r = lamThuChieu(w, moi, now);
        if (r.ok) ghi("tran_dau", { he: w.player.roots[0], loai_chieu: this.me.learned[0]?.main.kind.split(".")[1], ket_qua: "thang" });
        return done("chinh.0.5", r);
      }
      case "chiem_mo": {
        const r = lamChiemMo(w, moi, now);
        if (r.ok) {
          ghi("chiem_mo", { mo: moi.moMucTieu, loai_mo: "mo_linh_thach" });
          this.luu();
        }
        return r;
      }
      case "dat_nhac": {
        const r = lamDatNhac(moi, now);
        return done("chinh.0.7", r.ok ? { ...r, message: "Đã đặt nhắc. Nhận túi tân thủ" } : r);
      }
      case "an_the":
        moi.anThe = true;
        this.luu();
        return { ok: true };
      case "thu_gon":
        moi.thuGon = !!arg.on;
        this.luu();
        return { ok: true };
      case "da_nhac":
        moi.daNhacLuc = now;
        this.luu();
        return { ok: true };
    }
    return { ok: false, error: "lenh_khong_hop_le" };
  }

  /** Câu thưởng của một bước (hiện trên thẻ trước khi làm). */
  thuong(id: string): string {
    const r = thuongCua(id);
    return [r.exp && `${r.exp} tu vi`, r.linhThach && `${r.linhThach} linh thạch`].filter(Boolean).join(", ");
  }

  realm(): string {
    return realmOf(this.me.level);
  }
}

// ---- Nguồn theo tài khoản -----------------------------------------------------------------------------------------

function kho(): Storage | undefined {
  try {
    return localStorage;
  } catch {
    return undefined;
  }
}

async function napHoacTao(account: string, auth: AuthSource, luuDuoc: boolean): Promise<NguonMoi> {
  const store = kho();
  if (store) donBanCu(store);
  const ban = store && luuDuoc ? docTienDo(store, account) : null;
  const luu = (s: NguonMoi) => {
    if (store && luuDuoc) ghiTienDo(store, account, s.world, s.moi, Date.now());
  };
  if (ban) {
    try {
      const region = await loadRegion(ban.vung);
      return new NguonMoi({ ...ban.world, region } as World, ban.moi, auth, luu);
    } catch {
      // Bản lưu hỏng: bắt đầu lại như người mới.
    }
  }
  const region = await loadRegion(VUNG_MO[0]);
  const { world, moi } = taoTheGioiMoi(hatGiongMoi(), region, Date.now());
  const s = new NguonMoi(world, moi, auth, luu);
  luu(s);
  return s;
}

/** Nguồn cho các màn: mỗi tài khoản (Session.account) một tiến độ; chưa đăng nhập thì dùng thế giới tạm, không lưu. */
export class NguonTheoTaiKhoan implements DashboardSource {
  private cur?: { account: string; src: Promise<NguonMoi> };
  private readonly auth: AuthSource;

  constructor(auth: AuthSource) {
    this.auth = auth;
  }

  private account(): { id: string; luu: boolean } {
    const s = this.auth.session();
    if (!s) return { id: "_khach", luu: false };
    return { id: s.account ?? `so_${s.phoneMasked.replace(/\D/g, "")}`, luu: true };
  }

  get(): Promise<NguonMoi> {
    const a = this.account();
    if (!this.cur || this.cur.account !== a.id) this.cur = { account: a.id, src: napHoacTao(a.id, this.auth, a.luu) };
    return this.cur.src;
  }

  /** Chơi lại từ đầu: bỏ tiến độ của tài khoản đang chơi (nơi gọi tải lại trang). */
  choiLai(): void {
    const a = this.account();
    const store = kho();
    if (store && a.luu) xoaTienDo(store, a.id);
    this.cur = undefined;
  }

  /** Nguồn của tài khoản đang chơi, đã chốt bế quan nếu vừa hết giờ. */
  private async s(): Promise<NguonMoi> {
    const s = await this.get();
    s.chotBeQuan();
    return s;
  }

  dongPhu = async () => (await this.s()).dongPhu();
  nhanVat = async () => (await this.s()).nhanVat();
  tongMon = async () => (await this.s()).tongMon();
  congPhap = async () => (await this.s()).congPhap();
  lienMinh = async () => (await this.s()).lienMinh();
  banDo = async () => (await this.s()).banDo();
  mail = async (id: number) => (await this.s()).mail(id);
  battle = async (id: number) => (await this.s()).battle(id);
  send = async (cmd: DashboardCommand) => (await this.s()).send(cmd);
}

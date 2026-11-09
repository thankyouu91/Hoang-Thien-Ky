// Màn Nhân vật (GDD mục 14): mở bằng chân dung trên thanh trên. Một thẻ ba cột:
//  - Thông tin: các nhóm thu gọn được (thân phận, linh căn và tài năng, chỉ số chiến đấu, tu luyện, tài khoản), nhãn trái
//    giá trị phải; nút lớn Bế quan hoặc Đột phá ở đáy.
//  - Pháp tướng (theo mẫu người dùng gửi 2026-11-03): bóng lớn của chính nhân vật vẽ màu mực nâu mờ dần vào núi sương
//    (nướng bằng three), tu sĩ đứng trước, 7 ô trang bị hai bên (icon vẽ assets/icon_ve, nền màu theo độ hiếm), 4 ô công pháp mang vào trận, 5 ô thú (ô đang cưỡi có dấu
//    yên), chú giải một dòng ở đáy. Vòng 12 hệ (elementWheel.ts) chỉ hiện khi bấm "Vòng hệ".
//  - Cột giữa còn hai chế độ: Đạo Cơ Bàn (daoCoBan.ts) và Luyện khí (luyenKhiPanel.ts: phân giải, tẩy luyện, khí linh, ngọc,
//    Bảo Giám); thanh khí linh 0–9 hiện trên ô đồ.
//  - Túi: 50 ô, lọc theo loại và theo phẩm, khung chi tiết món đang chọn.
// Màn rộng (từ 1100 px) hiện đủ ba cột và kéo thả bằng chuột: kéo đồ hay công pháp từ túi vào ô để mặc, kéo ra túi để
// tháo. Điện thoại đổi thành năm thẻ Thông tin · Pháp tướng · Đạo cơ · Luyện khí · Túi và dùng chạm: chạm ô mở bảng chọn món, chạm món mở chi
// tiết; việc nào cũng trong 2 chạm.
import type { Element } from "@htk/sim";
import type { Sprites } from "../../assets/sprites.ts";
import { BINH_AN_O, type BoardPiece, type Progress } from "@htk/rules";
import { hasWebGL, loadSceneFactory, mountBakedScene, mountProgram, type LiveMount, type SceneHandle } from "../../three/index.ts";
import type { DaoCoBanProgram } from "../art/daoCoBanScene.ts";
import {
  axialToXY, bonusOf, CELLS, CENTER, cellOpen, cellOpensAt, drawOf, hexSize, LINK_NAMES, onOpenCells, pieceName, REALMS, RESONANCE, sealSet, setName, type BanDraw,
} from "../daoCoBan.ts";
import { dangFor, dangHeadroom, dangLift, drawDang } from "../../scenes/battle/dangDung.ts";
import { lookTheoTaiNang } from "../../scenes/battle/aoTaiNang.ts";
import type { Look, ReplayUnit } from "../../replay/types.ts";
import { drawPhapLuan, phapLuanExtent, trackLevel, type PhapLuanSpec } from "../../scenes/battle/phapLuan.ts";
import { ADULT_AGE, ageOn, GUARDIAN_AGE } from "../auth.ts";
import { daoDoHtml, daoDoManDotPha, daoDoReduced, daoDoSan, khiManDotPhaDong } from "../daoDoFx.ts";
import { lang, langSwitch, setLang, type Lang } from "../i18n.ts";
import { moGopY } from "../mayChuUi.ts";
import { BAC_TEN, bacBadge, GHEP_AN_SO, ghepLen, binhAnArt, binhBoBlock, binhBoSheet, dongAnHtml, dongRenHtml, gearSet2Rows, setRow, setSheet } from "../set2View.ts";
import { laBanMau } from "../moi/demo.ts";
import { tiemNangCmd, tiemNangHtml } from "./tiemNangUi.ts";
import { bacTrangPhuc, DANG_THEO_MA, hinhLonCands } from "../trangPhuc.ts";
import { elementWheel } from "../elementWheel.ts";
import { gemValue, hasKhiLinh } from "../luyenKhi.ts";
import { LuyenKhiPanel, type LkTab } from "./luyenKhiPanel.ts";
import { icon, type IconName } from "../icons.ts";
import { enableDrag, type DragControl, type DropAction } from "../keoTha.ts";
import { PageScene, type DashCtx } from "../shell.ts";
import { RETREAT_HOURS, type BagItem, type GearItem, type GearSlot, type ItemGrade, type ItemKind, type NhanVatView, type Rarity, type StatLine, type TechniqueCard } from "../source.ts";
import { REALM_TERM, term } from "../terms.ts";
import { artUrl, assetUrl, cd, closeSheet, cropIcons, elementChip, esc, fmt, heArt, openSheet, pctText, ROLE_NAMES, SAP_CO, sapCo, skillChip, techCover, toast } from "../ui.ts";
import { ELEMENT_STYLE } from "../../theme/elements.ts";

export type NhanVatTab = "thong-tin" | "phap-tuong" | "dao-co" | "luyen-khi" | "tui";
type Center = "phap-tuong" | "dao-co" | "luyen-khi";
const CENTERS: [Center, string][] = [["phap-tuong", "Pháp tướng"], ["dao-co", "Đạo Cơ Bàn"], ["luyen-khi", "Luyện khí"]];

const SLOT_NAMES: Record<GearSlot, string> = { vu_khi: "Vũ khí", mu: "Mũ", ao: "Áo", dai: "Đai", bao_tay: "Bao tay", giay: "Giày", ngoc_boi: "Ngọc bội" };
/** 7 ô (người dùng chốt 2026-11-03, thêm bao tay): bên trái theo thân từ đầu xuống chân, bên phải tay cầm và đeo. */
const LEFT: GearSlot[] = ["mu", "ao", "dai", "giay"];
const RIGHT: GearSlot[] = ["vu_khi", "bao_tay", "ngoc_boi"];
/** Độ hiếm hiện bằng màu nền ô (lục là đồ shop); khung chi tiết ghi chữ. */
const RARITY_NAMES: Record<Rarity, string> = { luc: "Lục", lam: "Lam", tim: "Tím", vang: "Vàng", do: "Đỏ" };
/** Lớp màu của ô món: độ hiếm nếu có, không thì phẩm. */
const tone = (it: { rarity?: Rarity; grade: ItemGrade }) => (it.rarity ? `r-${it.rarity}` : `g-${it.grade}`);
const STAT_KEYS: Record<string, string> = { hp: "Máu", atk: "Công lực", def: "Phòng thủ", mana: "Mana" };
/** Chỉ số hiện ở nhóm Chỉ số chiến đấu, đúng thứ tự (số từ @htk/sim qua nguồn đọc). */
const COMBAT = ["hp", "mana", "atk", "defOuter", "defInner", "crit", "critDamage", "attackSpeed"];
const KIND_NAMES: Record<ItemKind, string> = {
  trang_bi: "Trang bị", cong_phap: "Công pháp", tan_quyen: "Tàn quyển", ngoc: "Ngọc", dan: "Đan dược", nguyen_lieu: "Nguyên liệu", phu: "Phù chú", trung_thu: "Trứng thú",
};
const GRADE_NAMES: Record<ItemGrade, string> = { ha: "Hạ phẩm", trung: "Trung phẩm", cao: "Cao phẩm" };
/** Ký hiệu tạm cho món chưa có hình PixelLab. */
const KIND_GLYPH: Record<ItemKind, IconName> = {
  trang_bi: "sword", cong_phap: "scroll", tan_quyen: "scroll", ngoc: "gem", dan: "dan", nguyen_lieu: "quang", phu: "phu", trung_thu: "trung",
};
const SLOT_GLYPH: Record<GearSlot, IconName> = { vu_khi: "sword", mu: "shield", ao: "ao", dai: "dai", bao_tay: "bao_tay", giay: "giay", ngoc_boi: "ngoc_boi" };
/** Độ bền dưới mức này tô đỏ (cùng mức với thẻ Việc nên làm). */
const LOW = 20;
const WIDE = "(min-width: 1100px)";

/** Binh ấn trong túi (NG-BA-…): khảm vào ô công, không đặt lên Đạo Cơ Bàn. */
const isBinhAn = (it: BagItem) => !it.boardPiece && !!it.code?.startsWith("NG-BA-");

function statText(s: StatLine, v = s.value): string {
  return s.unit === "‰" ? pctText(v) : fmt(v);
}

/** Món kéo: "item:<uid>" món trong túi, "gear:<ô>" món đang mặc, "tech:<i>" ô công pháp, "cell:<mã ô>" viên trên Đạo Cơ Bàn. */
type DragRef = string;

/**
 * Hình nhân vật lớn vẽ bằng PixelLab (2026-11-05, người dùng chê hình ghép 64 px phóng to), dáng lơ lửng. Thử lần lượt các
 * khoá của hinhLonCands (trangPhuc.ts: dáng của áo đang mặc theo bậc cảnh giới, lùi bậc, rồi áo theo nghề); khoá thiếu hình
 * thì nhớ là không có và thử khoá sau. Chưa có khoá nào thì Pháp tướng vẽ hình ghép của trận như cũ.
 */
const bigArt = new Map<string, HTMLImageElement | null>();
function bigArtFirst(keys: string[], onload: () => void): HTMLImageElement | undefined {
  for (const key of keys) {
    const got = bigArt.get(key);
    if (got === null) continue;
    if (got) return got.complete && got.naturalWidth ? got : undefined;
    const img = new Image();
    img.onload = onload;
    img.onerror = () => {
      bigArt.set(key, null);
      onload();
    };
    img.src = assetUrl(key);
    bigArt.set(key, img);
    return undefined;
  }
  return undefined;
}

/** Bậc cảnh giới theo cấp (mốc đột phá 51, 101, 151, 201): 0 Luyện Khí, 1 Trúc Cơ, 2 Kết Đan, 3 Nguyên Anh, 4 Hóa Thần trở lên. */
const bacCanhGioi = (level: number) => Math.min(4, Math.max(0, Math.floor((level - 1) / 50)));
const LINH_KHI_TINH = matchMedia("(prefers-reduced-motion: reduce)");
const rgba = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a.toFixed(3)})`;
};

/**
 * Linh khí quanh hình lớn theo cảnh giới (2026-11-05, người dùng: lên cảnh giới cao thì thêm hiệu ứng xung quanh), màu theo
 * linh căn. Luyện Khí: không; Trúc Cơ: đốm linh khí bay lên; Kết Đan: thêm quầng sáng sau lưng; Nguyên Anh: thêm vòng sáng
 * xoay ngang eo; Hóa Thần trở lên: đốm dày hơn và tia lóe. Lớp "sau" vẽ trước hình (quầng, nửa sau của vòng), lớp "truoc"
 * vẽ sau hình (đốm, nửa trước của vòng). Giảm chuyển động thì đứng yên.
 */
function linhKhi(ctx: CanvasRenderingContext2D, level: number, he: string, cx: number, y0: number, dw: number, dh: number, t0: number, lop: "sau" | "truoc"): void {
  const bac = bacCanhGioi(level);
  if (bac < 1) return;
  const t = LINH_KHI_TINH.matches ? 1.7 : t0;
  ctx.save();
  if (lop === "sau" && bac >= 2) {
    const r = dw * (0.42 + 0.06 * bac) * (1 + 0.04 * Math.sin(t * 1.6));
    const g = ctx.createRadialGradient(cx, y0 + dh * 0.45, 0, cx, y0 + dh * 0.45, r);
    g.addColorStop(0, rgba(he, 0.1 + 0.05 * bac));
    g.addColorStop(1, rgba(he, 0));
    ctx.fillStyle = g;
    ctx.fillRect(cx - r, y0 + dh * 0.45 - r, r * 2, r * 2);
  }
  if (bac >= 3) {
    // Vòng sáng ngang eo: nửa sau (trên) vẽ sau hình, nửa trước (dưới) vẽ trước hình
    const ry = dh * 0.05;
    const rx = dw * 0.46;
    const yc = y0 + dh * 0.55;
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = rgba(he, 0.55);
    ctx.shadowColor = he;
    ctx.shadowBlur = 6;
    ctx.beginPath();
    if (lop === "sau") ctx.ellipse(cx, yc, rx, ry, 0, Math.PI, Math.PI * 2);
    else ctx.ellipse(cx, yc, rx, ry, 0, 0, Math.PI);
    ctx.stroke();
    // Đốm chạy trên vòng
    for (let i = 0; i < 3; i++) {
      const a = t * 1.2 + (i * Math.PI * 2) / 3;
      const truoc = Math.sin(a) > 0;
      if (truoc !== (lop === "truoc")) continue;
      ctx.fillStyle = rgba("#ffffff", 0.9);
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * rx, yc + Math.sin(a) * ry, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
  }
  if (lop === "truoc") {
    // Đốm linh khí bay lên quanh người
    const n = 6 + bac * 5;
    for (let i = 0; i < n; i++) {
      const seed = (i * 0.618034) % 1;
      const chu = 3.2 + seed * 2.4;
      const p = (t / chu + seed) % 1;
      const x = cx + (seed - 0.5) * dw * 1.05 + Math.sin(t * 1.3 + i) * 3;
      const y = y0 + dh * (0.98 - p * 0.95);
      const a = Math.sin(p * Math.PI) * (0.45 + 0.1 * bac);
      const s = 1 + ((i * 7) % 3) * 0.6 + (bac >= 4 ? 0.5 : 0);
      ctx.fillStyle = rgba(he, a);
      ctx.fillRect(Math.round(x), Math.round(y), s, s);
    }
    if (bac >= 4) {
      // Tia lóe ngắn, lúc ẩn lúc hiện
      for (let i = 0; i < 3; i++) {
        const k = Math.sin(t * 3.1 + i * 2.1);
        if (k < 0.85) continue;
        const a = i * 2.1 + Math.floor(t * 3.1 + i) * 1.7;
        const x = cx + Math.cos(a) * dw * 0.45;
        const y = y0 + dh * (0.35 + 0.25 * Math.sin(a));
        ctx.strokeStyle = rgba("#ffffff", (k - 0.85) * 6);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x - 4, y);
        ctx.lineTo(x + 4, y);
        ctx.moveTo(x, y - 4);
        ctx.lineTo(x, y + 4);
        ctx.stroke();
      }
    }
  }
  ctx.restore();
}

/**
 * Đạo đồ (Canva, 2026-11-05): tranh mực theo hệ chính của công pháp đang tu, mỗi cảnh giới Luyện Khí → Hóa Thần một bức,
 * hiện mờ sau hình nhân vật; từ Luyện Hư trở lên giữ bức Hóa Thần. Ảnh ở assets/icon_ve/dao_do/<hệ>/<cấp>.webp.
 */
const DAO_DO = new Set(Object.keys(import.meta.glob("../../../../assets/icon_ve/dao_do/*/*.webp")).map((k) => k.replace(/^.*dao_do\//, "").replace(/\.webp$/, "")));
function daoDoOf(v: NhanVatView): string | undefined {
  const e = v.loadout.find((x) => !!x)?.element ?? v.roots[0];
  const ma = `${e}/${Math.max(1, Math.min(5, v.board.progress.canhGioi))}`;
  return DAO_DO.has(ma) ? ma : undefined;
}

export class NhanVatScene extends PageScene<NhanVatView> {
  private tab: NhanVatTab = "phap-tuong";
  private kind: ItemKind | "all" = "all";
  /** Lọc thứ hai: độ hiếm khi đang xem trang bị, phẩm với các loại khác. */
  private grade: ItemGrade | Rarity | "all" = "all";
  private selected?: number;
  private sprites: Sprites;
  private doll?: HTMLCanvasElement;
  private anim = 0;
  private frame = 0;
  /** Kéo thả (keoTha.ts): chuột, bút và cảm ứng (giữ tay rồi kéo). */
  private dnd: DragControl;
  /** Bóng pháp tướng phía sau tu sĩ. */
  private ghost?: HTMLCanvasElement;
  /** Núi sương dưới đáy cột Pháp tướng: ảnh three nướng một lần, giữ qua các lần vẽ lại. */
  private mistEl: HTMLElement;
  private mist?: SceneHandle;
  private showWheel = false;
  /** Cột giữa: Pháp tướng (đồ quanh hình), Đạo Cơ Bàn (bàn ô đặt ấn bộ, ngọc hệ kích set) hay Luyện khí. */
  private center: Center = "phap-tuong";
  /** Mục Luyện khí: giữ phần đang mở và lựa chọn qua các lần vẽ lại. */
  private lk: LuyenKhiPanel;
  /** Công cụ xem thử: -1 là ô mở theo tiến độ thật (v.board.progress), số khác là chỉ số trong REALMS. */
  private realm = -1;
  /** Đạo đồ lần vẽ trước (để biết vừa đột phá) và lượt chuyển bức ở sân: chờ màn đột phá đóng (`san`), rồi chạy. */
  private ddSeen?: { ma?: string; canh: number };
  private ddChuyen?: { from?: string; to: string; san: boolean; chay: boolean; el?: HTMLElement };
  /** Lớp cảnh three của Đạo Cơ Bàn, giữ qua các lần vẽ lại. */
  private ltLayer: HTMLElement;
  private ltLive: LiveMount | null = null;
  private ltProg?: DaoCoBanProgram;
  private ltLoading = false;
  private ltRO = new ResizeObserver(() => this.layoutBan());

  constructor(ctx: DashCtx, sprites: Sprites) {
    super("nhan-vat", "Nhân vật", ctx);
    this.sprites = sprites;
    this.page.addEventListener("change", (e) => {
      const el = e.target as HTMLSelectElement;
      if (el.dataset.filter === "kind") {
        this.kind = el.value as ItemKind | "all";
        this.grade = "all";
      } else if (el.dataset.filter === "grade") this.grade = el.value as ItemGrade | Rarity | "all";
      else if (el.dataset.filter === "realm") this.realm = Number(el.value);
      else return;
      if (this.data) this.render(this.data);
    });
    this.dnd = enableDrag(this.page, { action: (d, t) => this.dropAction(d, t), drop: (d, t) => this.drop(d, t) });
    this.ltLayer = document.createElement("div");
    this.ltLayer.className = "lt-three";
    this.ltLayer.setAttribute("aria-hidden", "true");
    this.mistEl = document.createElement("div");
    this.mistEl.className = "pt-mist";
    this.mistEl.setAttribute("aria-hidden", "true");
    this.lk = new LuyenKhiPanel({
      data: () => this.data,
      send: (cmd) => this.send(cmd),
      redraw: () => this.data && this.render(this.data),
      forge: () => this.ctx.nav.go({ screen: "tong-mon", tab: "son-mon" }),
      gearIcon: (g, s) => this.gearIcon(g, s),
      itemIcon: (it) => this.itemIcon(it),
    });
  }

  setTab(t: NhanVatTab): void {
    this.tab = t;
    if (t === "phap-tuong" || t === "dao-co" || t === "luyen-khi") this.center = t;
    if (this.data) this.render(this.data);
  }

  protected read(): Promise<NhanVatView> {
    return this.ctx.source.nhanVat();
  }

  override enter(): void {
    super.enter();
    clearInterval(this.anim);
    // Dáng đứng của nhân vật ghép (dangDung.ts): khung người chọn theo giờ, hiệu ứng quanh người chạy liên tục nên vẽ 24 lần mỗi giây.
    this.anim = window.setInterval(() => {
      this.frame++;
      this.drawDoll();
    }, 1000 / 24);
  }

  override leave(): void {
    super.leave();
    clearInterval(this.anim);
  }

  protected render(v: NhanVatView): void {
    this.ddTrack(v);
    const tab = (id: NhanVatTab, label: string) => `<button type="button" role="tab" data-act="tab" data-tab="${id}" aria-selected="${this.tab === id}">${label}</button>`;
    this.page.innerHTML = `
      <section class="card nv">
        <header class="nv-head">
          <h1><b>${esc(v.name)}</b><span>${term(v.top.realm, REALM_TERM[v.top.realm] ?? "")} · Cấp ${v.level} · ${esc(v.sect.name)}</span></h1>
          <button type="button" class="nv-ic" data-act="help" aria-label="Cách dùng màn Nhân vật">${icon("help")}</button>
          <button type="button" class="nv-ic" data-act="back" aria-label="Đóng">${icon("close")}</button>
        </header>
        <div class="seg nv-tabs" role="tablist" aria-label="Phần của màn Nhân vật">${tab("thong-tin", "Thông tin")}${tab("phap-tuong", "Pháp tướng")}${tab("dao-co", "Đạo cơ")}${tab("luyen-khi", "Luyện khí")}${tab("tui", "Túi")}</div>
        <div class="nv-cols" data-tab="${this.tab}">
          <div class="nv-col nv-info">${this.info(v)}</div>
          <div class="nv-col nv-form">${this.form(v)}${this.center !== "luyen-khi" ? this.tray(v) : ""}</div>
          <div class="nv-col nv-bag">${this.bag(v)}</div>
        </div>
      </section>`;
    this.doll = this.page.querySelector<HTMLCanvasElement>(".doll") ?? undefined;
    this.ghost = this.page.querySelector<HTMLCanvasElement>(".pt-ghost") ?? undefined;
    this.page.querySelector(".nv-form")?.prepend(this.mistEl);
    // Máy không có WebGL2 thì mountBakedScene không gắn gì: cột giữa chỉ còn bóng pháp tướng trên giấy.
    this.mist ??= mountBakedScene(this.mistEl, "son_thuy", { tone: "giay", seed: 3, sky: false });
    const board = this.page.querySelector<HTMLElement>(".lt-board");
    this.ltRO.disconnect();
    if (board) {
      board.prepend(this.ltLayer);
      board.classList.toggle("live", !!this.ltLive);
      this.ltRO.observe(board);
      this.layoutBan();
      this.ltProg?.setDraw(this.banDraw());
      void this.mountBan();
    }
    cropIcons(this.page);
    this.drawDoll();
    this.ddTry();
  }

  // ---- Đạo đồ lúc đột phá (daoDoFx.ts) ----------------------------------------------------------------------------

  /** Cảnh giới tăng so với lần vẽ trước: chèn đạo đồ mới vào màn đột phá, hẹn chuyển bức ở sân khi màn đóng. */
  private ddTrack(v: NhanVatView): void {
    const canh = v.board.progress.canhGioi;
    const ma = daoDoOf(v);
    const prev = this.ddSeen;
    this.ddSeen = { ma, canh };
    if (!prev || canh <= prev.canh || !ma) return;
    daoDoManDotPha(ma);
    if (daoDoReduced() || !prev.ma || prev.ma === ma) return;
    const ch = { from: prev.ma, to: ma, san: false, chay: false };
    this.ddChuyen = ch;
    khiManDotPhaDong(() => {
      ch.san = true;
      this.ddTry();
    });
  }

  /**
   * Màn đột phá đã đóng và sân Pháp tướng đang hiện: chạy nhịp sân (đang ở tab khác thì đợi lần vẽ sau). Màn tự đọc lại
   * giữa chừng (đếm ngược xong…) thì lớp đang diễn được đặt lại vào chỗ lớp mới vẽ, để nhịp không bị cắt.
   */
  private ddTry(): void {
    const ch = this.ddChuyen;
    if (!ch || !ch.san) return;
    const fx = this.page.querySelector<HTMLElement>(".pt-dao-do");
    if (ch.chay) {
      if (fx && ch.el && fx !== ch.el) fx.replaceWith(ch.el);
      return;
    }
    if (!fx || !fx.getClientRects().length) return;
    ch.chay = true;
    ch.el = fx;
    void daoDoSan(fx).finally(() => {
      if (this.ddChuyen === ch) this.ddChuyen = undefined;
    });
  }

  // ---- Cột trái: thông tin ---------------------------------------------------------------------------------------

  private info(v: NhanVatView): string {
    const group = (title: string, body: string, open = true) => `<details class="nv-group"${open ? " open" : ""}><summary><span>${title}</span></summary>${body}</details>`;
    const row = (k: string, val: string) => `<div class="nv-row"><span>${k}</span><b>${val}</b></div>`;
    const c = v.cultivation;
    const exp = Math.min(1, v.exp / v.expToNext);
    const statRow = (s: StatLine) => `<button type="button" class="nv-row" data-act="stat" data-stat="${s.id}"><span>${esc(s.label)}</span><b>${statText(s)}</b></button>`;
    const combat = COMBAT.map((id) => v.stats.find((s) => s.id === id)).filter((s): s is StatLine => !!s);
    const s = this.ctx.auth.session();
    const age = s ? ageOn(s.birthDate) : ADULT_AGE;
    return `
      ${group("Thân phận", `
        ${row("Cảnh giới", `${esc(v.top.realm)} · cấp ${v.level}`)}
        ${row("Tông môn", esc(v.sect.name))}
        ${row("Chức vị", esc(v.sect.role ? ROLE_NAMES[v.sect.role] : "Chưa vào tông"))}
        ${row("Phe", esc(v.sect.faction))}
        ${row(term("Sát nghiệp", "sat_nghiep"), `<span class="${v.satNghiep > 0 ? "bad" : ""}">${fmt(v.satNghiep)}</span>`)}
        ${row("Cống hiến", fmt(v.contribution))}
        ${row("Linh thạch", `<span class="stone">${fmt(v.top.linhThach)}</span>`)}`)}
      ${group(`${term("Linh căn", "linh_can")} và tài năng`, `
        ${v.roots.map((e) => `<div class="nv-row"><span class="nv-el on"><img src="${heArt(e)}" alt="">${esc(ELEMENT_STYLE[e].name)}</span><b class="tag">Linh căn</b></div>`).join("")}
        <div class="nv-row"><span>${term("Tài năng", "tai_nang")}</span><b>${esc(v.talent.name)}</b></div>
        <p class="nv-note">${esc(v.talent.combat)}</p>`)}
      ${group("Chỉ số chiến đấu", `
        <div class="nv-row"><span>${term("Lực chiến", "luc_chien")}</span><b class="power">${fmt(v.power.total)}</b></div>
        <div class="nv-row"><span>Điểm trang bị</span><b>${fmt(v.score)}</b></div>
        ${combat.map(statRow).join("")}
        <p class="nv-note">Chạm một dòng để xem nguồn: gốc theo cấp, đồ, ngọc, thú, tài năng, linh căn.</p>`)}
      ${v.tiemNang ? group(`Điểm tiềm năng${v.tiemNang.chuaCong > 0 ? ` · còn ${fmt(v.tiemNang.chuaCong)}` : ""}`, tiemNangHtml(v.tiemNang), v.tiemNang.chuaCong > 0) : ""}
      ${group("Tu luyện", `
        <div class="nv-row"><span>Tu vi</span><b>${fmt(v.exp)} / ${fmt(v.expToNext)}</b></div>
        <div class="bar"><i style="width:${(exp * 100).toFixed(1)}%"></i></div>
        <button type="button" class="nv-row" data-act="cultivation"><span>Tốc độ bế quan</span><b>${fmt(c.perHour)}/giờ</b></button>
        ${row("Mốc đột phá", `cấp ${c.breakAt.level} → ${esc(c.breakAt.realm)}`)}
        <div class="nv-dev"><span>Thử hiệu ứng (prototype)</span><div class="nv-dev-btns"><button type="button" class="btn small" data-act="dev_cap">+1 cấp</button><button type="button" class="btn small" data-act="dev_dot_pha">Tới mốc đột phá</button></div></div>
        ${c.retreat ? row("Đang bế quan", `<span data-cd="${c.retreat.endsAt}">${cd(c.retreat.endsAt)}</span>`) : ""}`)}
      ${s ? group("Tài khoản", `
        ${row("Số điện thoại", esc(s.phoneMasked))}
        ${row("Nhóm tuổi", age < GUARDIAN_AGE ? "Dưới 16, có giám hộ" : age < ADULT_AGE ? "Dưới 18" : "Từ 18")}
        ${row("Ngôn ngữ", langSwitch())}
        <div class="nv-acc-btns"><button type="button" class="btn small can-may-chu" data-act="gop-y">Góp ý, báo lỗi</button><button type="button" class="btn small nv-choi-lai" data-act="choi-lai">Chơi lại từ đầu</button><button type="button" class="btn small nv-logout" data-act="logout">${icon("logout")} Đăng xuất</button></div>`, false) : ""}
      <button type="button" class="seal nv-main${c.canBreak ? " dot-pha" : c.retreat ? " be-quan" : ""}" data-act="main"${c.retreat && !c.canBreak ? " disabled" : ""}>${c.canBreak ? "Đột phá" : c.retreat ? `<span>Đang bế quan</span><small>còn ${cd(c.retreat.endsAt)}</small>` : "Bế quan"}</button>`;
  }

  // ---- Cột giữa: Pháp tướng -------------------------------------------------------------------------------------

  private form(v: NhanVatView): string {
    const riding = v.mounts[v.riding];
    const combos = v.combos.filter((k) => k.active);
    const wheelLegend = this.showWheel
      ? `<li><i class="lg-root"></i>Linh căn</li><li><i class="lg-sinh"></i>Tương sinh</li><li><i class="lg-khac"></i>Tương khắc</li><li><i class="lg-cuc"></i>Đối cực</li><li><i class="lg-bien"></i>Biến dị</li>`
      : "";
    const switcher = `<div class="seg nv-center" role="tablist" aria-label="Cột giữa">${CENTERS
      .map(([id, label]) => `<button type="button" role="tab" data-act="center" data-c="${id}" aria-selected="${this.center === id}">${label}</button>`)
      .join("")}</div>`;
    if (this.center === "dao-co") return this.banView(v, switcher);
    if (this.center === "luyen-khi") return this.lk.view(v, switcher);
    const daoDo = daoDoOf(v);
    return `
      <div class="nv-sub">${switcher}<span class="nv-roots">${esc(v.roots.map((e) => ELEMENT_STYLE[e].name).join(", "))} linh căn</span>
        <button type="button" class="nv-tog" data-act="wheel" aria-pressed="${this.showWheel}">Vòng hệ</button></div>
      <div class="pt-stage${this.showWheel ? " wheel-on" : ""}${daoDo ? " has-dao-do" : ""}">
        <canvas class="pt-ghost" aria-hidden="true"></canvas>
        ${daoDo ? daoDoHtml("pt-dao-do", daoDo, this.ddChuyen?.from, !!this.ddChuyen && !this.ddChuyen.chay) : ""}
        ${elementWheel(v.roots)}
        <canvas class="doll" aria-label="Hình nhân vật"></canvas>
        <div class="pt-gear left">${LEFT.map((s) => this.gearSlot(v, s)).join("")}</div>
        <div class="pt-gear right">${RIGHT.map((s) => this.gearSlot(v, s)).join("")}</div>
      </div>
      <h3 class="nv-h">Công pháp mang vào trận <span>${v.loadout.filter(Boolean).length} / ${v.loadout.length}</span></h3>
      <div class="pt-tech">${v.loadout.map((t, i) => this.techSlot(t, i)).join("")}</div>
      <h3 class="nv-h">Thú <span>${riding ? `đang cưỡi ${esc(riding.name)}` : "chưa cưỡi"}</span></h3>
      <div class="pt-pets">${v.mounts
        .map((m, i) =>
          m
            ? `<button type="button" class="pt-pet${i === v.riding ? " riding" : ""}" data-act="pet" data-i="${i}" aria-label="${esc(m.name)}${i === v.riding ? ", đang cưỡi" : ""}">
                <img src="${assetUrl(m.icon)}" alt=""><i class="el" style="background:${ELEMENT_STYLE[m.element].color}"></i>${i === v.riding ? `<span class="saddle">${icon("yen")}</span>` : ""}</button>`
            : `<button type="button" class="pt-pet empty" data-act="pet" data-i="${i}" aria-label="Ô thú trống">+</button>`,
        )
        .join("")}</div>
      ${combos.length ? `<p class="pt-combos">${combos.map((k) => `<span class="chip sk" title="${esc(k.effect)}">${esc(k.name)}</span>`).join("")}</p>` : ""}
      <ul class="pt-legend">${wheelLegend}
        <li><b class="lg-plus">+8</b>Nấc rèn</li>
        <li><b class="lg-gem">◆</b>Dòng khảm</li>
        <li><i class="lg-dur"></i>Độ bền</li>
        <li><span class="lg-yen">${icon("yen")}</span>Thú cưỡi</li>
      </ul>`;
  }

  // ---- Đạo Cơ Bàn ------------------------------------------------------------------------------------------------

  /** Tiến độ để vẽ ô mở: thật (nguồn đọc) hoặc cảnh giới đang xem thử. */
  private banProgress(v: NhanVatView): Progress {
    return this.realm < 0 ? v.board.progress : REALMS[this.realm].p;
  }

  private banDraw(): BanDraw {
    const v = this.data!;
    const p = this.banProgress(v);
    return drawOf(onOpenCells(v.board.cells, p), p);
  }

  /** Ô đặt được thật: mở ở tiến độ thật và nhận loại viên đó. */
  private canPlace(v: NhanVatView, ma: string, piece?: BoardPiece): boolean {
    const c = CELLS.find((x) => x.ma === ma);
    return !!c && cellOpen(ma, v.board.progress) && (!piece || c.chiNhan.includes(piece.loai));
  }

  /** Bàn lục giác 19 ô (GDD tab Trang bị phần 8): ô thông nối về tâm, mạch theo quan hệ hệ, cộng hưởng giữa hai bộ. */
  private banView(v: NhanVatView, switcher: string): string {
    const b = v.board;
    const p = this.banProgress(v);
    const draw = this.banDraw();
    const res = bonusOf(b.cells, p, b.gearSets);
    const cell = (c: (typeof CELLS)[number]) => {
      const piece = draw.pieces[c.ma];
      const open = draw.open.has(c.ma);
      const thong = draw.thong.has(c.ma);
      const label = piece ? `${pieceName(piece)}, ${thong ? "thông" : "chưa thông"}` : !open ? `Ô khóa, mở ở ${cellOpensAt(c.ma)}` : c.ma === CENTER ? "Ô tâm trống: đặt ấn chủ" : "Ô trống";
      const body = piece ? this.pieceIcon(piece) : c.ma === CENTER && open ? `<span class="lt-mark">Tâm</span>` : open ? `<span class="lt-mark">+</span>` : "";
      return `<button type="button" class="lt-cell${open ? "" : " locked"}${piece ? " full" : ""}${piece && !thong ? " off" : ""}${c.ma === CENTER ? " core" : ""}" data-act="lt-cell" data-cell="${c.ma}" data-drop="ban:${c.ma}"${piece && this.data?.board.cells[c.ma] ? ` data-drag="cell:${c.ma}"` : ""} aria-label="${esc(label)}">${body}</button>`;
    };
    const ordered: GearSlot[] = ["vu_khi", "mu", "ao", "dai", "bao_tay", "giay", "ngoc_boi"];
    const now = v.top.realm;
    return `
      <div class="nv-sub">${switcher}<span class="nv-roots">Nền ${esc(v.talent.name)}</span></div>
      <div class="lt-board" role="group" aria-label="Đạo Cơ Bàn: bàn ô đặt ấn bộ và ngọc hệ">
        <canvas class="pt-ghost" aria-hidden="true"></canvas>
        ${CELLS.map(cell).join("")}
      </div>
      <label class="lt-realm">Ô mở theo <select data-filter="realm"><option value="-1"${this.realm < 0 ? " selected" : ""}>Cảnh giới hiện tại (${esc(now)})</option>${REALMS.map((r, i) => `<option value="${i}"${i === this.realm ? " selected" : ""}>Xem thử: ${r.ten}</option>`).join("")}</select></label>
      ${this.realm >= 0 ? `<p class="nv-note lt-preview">Đang xem thử: ô sáng thêm chỉ để xem, đặt và gỡ viên chỉ ở ô đã mở thật.</p>` : ""}
      <h3 class="nv-h">Bộ đang kích <span>đồ + bàn, tối đa 3 bộ</span></h3>
      <ul class="lt-sets">${v.sets.length ? v.sets.map(setRow).join("") : `<li class="nv-note">Chưa kích bộ nào. Hai món cùng bộ (ấn trên đồ hoặc trên bàn) thì kích mốc 2.</li>`}${res.congHuong
        .map((r) => `<li class="lt-res"><b>${esc(r.ten)}</b> · ${esc(setName(r.a))} ↔ ${esc(setName(r.b))}<span class="muted block">${esc(RESONANCE.find((x) => x.mach === r.mach)?.mo_ta ?? "")}</span></li>`)
        .join("")}</ul>
      <h3 class="nv-h">Binh bộ <span>ô công: vũ khí, bao tay, ngọc bội</span></h3>
      ${binhBoBlock(v.binhBo)}
      <h3 class="nv-h">Trang bị <span>ấn trên đồ tính vào bộ</span></h3>
      <div class="lt-gear">${ordered.map((s) => this.gearSlot(v, s, true)).join("")}</div>
      <ul class="pt-legend">
        <li><i class="lg-m lg-m-thuan"></i>Thuần</li>
        <li><i class="lg-m lg-m-sinh"></i>Sinh</li>
        <li><i class="lg-m lg-m-cuc"></i>Cực</li>
        <li><i class="lg-m-trung"></i>Trung</li>
        <li><i class="lg-m-dut"></i>Tương khắc (đứt)</li>
        <li><i class="lg-lock"></i>Ô khóa</li>
      </ul>`;
  }

  /** Viên trên bàn: ngọc dùng icon vẽ, ấn là con dấu son ghi chữ đầu tên bộ (ấn chưa có hình). */
  private pieceIcon(p: BoardPiece): string {
    if (p.loai === "ngoc") return `<img class="ve" src="${artUrl(`ngoc/${p.he}`)}" alt="">`;
    return `<span class="lt-seal bac-${p.bac ?? "tim"}">${esc(setName(sealSet(p.ma)).split(" ")[0])}</span>`;
  }

  /** Đặt lớp nút ô đúng chỗ ô của cảnh three (cùng công thức hexSize, axialToXY). */
  private layoutBan(): void {
    const board = this.page.querySelector<HTMLElement>(".lt-board");
    if (!board) return;
    const w = board.clientWidth;
    const h = board.clientHeight;
    if (!w || !h) return;
    const size = hexSize(w, h);
    for (const el of board.querySelectorAll<HTMLElement>(".lt-cell")) {
      const c = CELLS.find((x) => x.ma === el.dataset.cell)!;
      const { x, y } = axialToXY(c.q, c.r, size);
      el.style.left = `${w / 2 + x - (size * Math.sqrt(3)) / 2}px`;
      el.style.top = `${h / 2 + y - size}px`;
      el.style.width = `${size * Math.sqrt(3)}px`;
      el.style.height = `${size * 2}px`;
    }
  }

  /** Cảnh three và nền theo tài năng, nạp động lần đầu; máy không có WebGL2 thì lớp nút tự vẽ ô bằng CSS. */
  private async mountBan(): Promise<void> {
    const v = this.data;
    if (this.ltLive || this.ltLoading || !hasWebGL() || !v) return;
    this.ltLoading = true;
    try {
      // Người mới chưa gieo quẻ (talent.id rỗng) thì bàn không có nền tài năng.
      const [{ daoCoBanScene }, bg] = await Promise.all([
        import("../art/daoCoBanScene.ts"),
        v.talent.id ? loadSceneFactory(`tai_nang:${v.talent.id}` as Parameters<typeof loadSceneFactory>[0]) : Promise.resolve(null),
      ]);
      this.ltLive = await mountProgram(this.ltLayer, (h) => (this.ltProg = daoCoBanScene(h, this.banDraw(), bg)));
      this.page.querySelector(".lt-board")?.classList.toggle("live", !!this.ltLive);
    } finally {
      this.ltLoading = false;
    }
  }

  /** Viên trong túi đặt được vào ô (ô tâm chỉ nhận ấn). */
  private placeable(v: NhanVatView, ma: string): BagItem[] {
    const c = CELLS.find((x) => x.ma === ma)!;
    return v.bag.items.filter((it) => it.boardPiece && c.chiNhan.includes(it.boardPiece.loai));
  }

  private pickList(v: NhanVatView, ma: string): string {
    const items = this.placeable(v, ma);
    if (!items.length) return `<p class="muted">Túi không có ${ma === CENTER ? "ấn bộ" : "ấn bộ hay ngọc hệ"} nào để đặt.</p>`;
    return `<ul class="list">${items
      .map((it) => `<li><button type="button" class="row" data-pick="${it.uid}"><span class="bag-cell lt-pick">${this.pieceIcon(it.boardPiece!)}</span><span class="grow"><b>${esc(pieceName(it.boardPiece!))}</b><span class="muted block">${it.boardPiece!.loai === "an" ? `Ấn bộ ${esc(setName(sealSet(it.boardPiece!.ma)))}` : "Ngọc hệ: chỉ dẫn mạch"}${it.count > 1 ? ` · còn ${it.count}` : ""}</span></span></button></li>`)
      .join("")}</ul>`;
  }

  private openBanCell(v: NhanVatView, ma: string): void {
    const b = v.board;
    const p = this.banProgress(v);
    const draw = this.banDraw();
    if (!draw.open.has(ma)) {
      toast(`Ô này mở ở cảnh giới ${cellOpensAt(ma)}.`);
      return;
    }
    const piece = draw.pieces[ma];
    if (!piece && !this.canPlace(v, ma)) {
      toast(`Đang xem thử: ô này mở thật ở cảnh giới ${cellOpensAt(ma)}.`);
      return;
    }
    let body: HTMLElement;
    if (piece) {
      const res = bonusOf(b.cells, p, b.gearSets);
      const thong = draw.thong.has(ma);
      let info: string;
      if (piece.loai === "an") {
        const bo = sealSet(piece.ma);
        const gear = b.gearSets[bo] ?? 0;
        info = !thong
          ? "Chưa thông: cần nối về ô tâm qua các ô có đồ, không qua cặp kề tương khắc."
          : gear < 2
            ? `Thông, nhưng bộ ${setName(bo)} cần ít nhất 2 món trên đồ mới nhận món thêm từ bàn.`
            : `Thông: bộ ${setName(bo)} có ${gear} món trên đồ, bàn tính thêm ${res.monThem[bo] ?? 0} (tối đa 2).`;
        const rs = res.congHuong.filter((r) => r.a === bo || r.b === bo).map((r) => `${r.ten} với ${setName(r.a === bo ? r.b : r.a)}`);
        if (rs.length) info += ` Cộng hưởng: ${rs.join(", ")}.`;
      } else info = thong ? "Ngọc trên bàn không cộng chỉ số; nó mang hệ để dẫn mạch." : "Ngọc chưa thông: nối về ô tâm để dẫn mạch.";
      const links = draw.links.filter((l) => l.a === ma || l.b === ma).map((l) => LINK_NAMES[l.kind]);
      const real = this.canPlace(v, ma);
      body = openSheet(
        pieceName(piece),
        `<p>${esc(info)}</p>${links.length ? `<p class="muted">Mạch với ô kề: ${esc(links.join(", "))}</p>` : ""}
         ${real ? `<div class="actions"><button type="button" data-a="off">Gỡ về túi</button></div><h3>Đổi bằng</h3>${this.pickList(v, ma)}` : ""}`,
      );
    } else body = openSheet(ma === CENTER ? "Ấn chủ (ô tâm chỉ nhận ấn)" : "Đặt ấn hoặc ngọc", this.pickList(v, ma));
    body.addEventListener("click", (e) => {
      const t = e.target as HTMLElement;
      const uid = t.closest<HTMLElement>("[data-pick]")?.dataset.pick;
      if (t.closest("[data-a=off]")) {
        closeSheet();
        void this.send({ type: "go_vien", cell: ma });
      } else if (uid !== undefined) {
        closeSheet();
        void this.send({ type: "dat_vien", cell: ma, uid: Number(uid) });
      }
    });
  }

  private openBanSet(v: NhanVatView, id: string): void {
    const set = v.sets.find((x) => x.id === id);
    if (!set) return;
    const sh = setSheet(set);
    openSheet(sh.title, sh.html);
  }

  private openBinhBo(v: NhanVatView): void {
    if (!v.binhBo) return;
    const sh = binhBoSheet(v.binhBo);
    openSheet(sh.title, sh.html);
  }


  private gearSlot(v: NhanVatView, s: GearSlot, seal = false): string {
    const g = v.gear[s];
    if (!g) return `<button type="button" class="pt-slot empty" data-act="slot" data-slot="${s}" data-drop="gear:${s}"><span class="lbl">${SLOT_NAMES[s]}</span></button>`;
    const dur = g.durability / g.durabilityMax;
    return `<button type="button" class="pt-slot r-${g.rarity}" data-act="slot" data-slot="${s}" data-drop="gear:${s}" data-drag="gear:${s}" aria-label="${esc(`${SLOT_NAMES[s]}: ${g.name} +${g.plus}${this.lk.slotLabel(v, s)}`)}">
      ${this.gearIcon(g, s)}${this.lk.slotBar(v, s)}${seal && g.seal ? `<span class="lt-seal mini bac-${g.sealTier ?? "tim"}" title="${esc(`Ấn ${setName(sealSet(g.seal))}`)}">${esc(setName(sealSet(g.seal)).split(" ")[0])}</span>` : ""}${g.binhAn ? this.binhMini(g) : ""}
      <span class="plus">+${g.plus}</span>
      ${g.sockets ? `<span class="gems">◆${g.gems.length}/${g.sockets}</span>` : ""}
      <span class="dur${g.durability < LOW ? " low" : ""}"><i style="width:${(dur * 100).toFixed(0)}%"></i></span>
    </button>`;
  }

  /** Binh ấn ở góc ô công: hình binh ấn trong vòng viền màu bậc. */
  private binhMini(g: GearItem): string {
    const src = g.binhAn ? binhAnArt(g.binhAn.ma) : undefined;
    return src ? `<span class="binh-mini bac-${g.binhAn!.tier}" aria-hidden="true"><img src="${src}" alt=""></span>` : "";
  }

  private gearIcon(g: GearItem, s: GearSlot): string {
    return g.art ? `<img class="ve" src="${artUrl(g.art)}" alt="">` : g.icon ? `<img src="${assetUrl(g.icon)}" alt="" data-crop>` : icon(SLOT_GLYPH[s], "glyph");
  }

  private techSlot(t: TechniqueCard | null, i: number): string {
    if (!t) return `<button type="button" class="pt-tslot empty" data-act="tech" data-i="${i}" data-drop="tech:${i}"><span class="lbl">Ô ${i + 1}</span></button>`;
    const st = ELEMENT_STYLE[t.element];
    return `<button type="button" class="pt-tslot" data-act="tech" data-i="${i}" data-drop="tech:${i}" data-drag="tech:${i}" style="--c:${st.color}" aria-label="${esc(t.name)}">
      <img class="type ve" src="${artUrl(`chieu/${t.type}`)}" alt="" title="${esc(st.name)}">
      ${techCover(t, "l")}
      <span class="name">${esc(t.name)}</span>
    </button>`;
  }

  // ---- Cột phải: túi ------------------------------------------------------------------------------------------

  private bag(v: NhanVatView): string {
    const real = v.bag.items.filter((it) => it.kind !== "cong_phap");
    const byRarity = this.kind === "trang_bi";
    const shown = v.bag.items.filter(
      (it) => (this.kind === "all" ? it.kind !== "cong_phap" : it.kind === this.kind) && (this.grade === "all" || (byRarity ? it.rarity === this.grade : it.grade === this.grade)),
    );
    const empty = this.kind === "all" && this.grade === "all" ? Math.max(0, v.bag.capacity - real.length) : 0;
    const opt = (val: string, label: string, cur: string) => `<option value="${val}"${val === cur ? " selected" : ""}>${label}</option>`;
    const sel = v.bag.items.find((it) => it.uid === this.selected);
    return `
      <div class="nv-sub"><b>Túi đồ</b><span class="muted"><b>${real.length}</b> / ${v.bag.capacity} ô</span></div>
      <div class="bag-filters">
        <select data-filter="kind" aria-label="Lọc theo loại">${opt("all", "Tất cả loại", this.kind)}${(Object.keys(KIND_NAMES) as ItemKind[]).map((k) => opt(k, KIND_NAMES[k], this.kind)).join("")}</select>
        ${byRarity
          ? `<select data-filter="grade" aria-label="Lọc theo độ hiếm">${opt("all", "Mọi độ hiếm", this.grade)}${(Object.keys(RARITY_NAMES) as Rarity[]).map((r) => opt(r, RARITY_NAMES[r], this.grade)).join("")}</select>`
          : `<select data-filter="grade" aria-label="Lọc theo phẩm">${opt("all", "Tất cả phẩm", this.grade)}${(Object.keys(GRADE_NAMES) as ItemGrade[]).map((g) => opt(g, GRADE_NAMES[g], this.grade)).join("")}</select>`}
      </div>
      <div class="bag-grid" data-drop="bag">
        ${shown.map((it) => this.cell(it)).join("")}${"<span class=\"bag-cell empty\"></span>".repeat(empty)}
        ${!shown.length && !empty ? `<p class="nv-note bag-none">Không có món nào khớp bộ lọc.</p>` : ""}
      </div>
      ${this.kind === "cong_phap" ? `<p class="nv-note">Công pháp đã học không chiếm ô túi; kéo vào ô công pháp để mang vào trận.</p>` : ""}
      <p class="drag-hint">${matchMedia(WIDE).matches ? `${matchMedia("(pointer: coarse)").matches ? "Giữ tay lên một món rồi kéo" : "Kéo một món"} sang Pháp tướng để mặc, mang vào trận hay khảm ngọc, ấn; sang Đạo Cơ Bàn để đặt viên; kéo về túi để tháo.` : "Ở Pháp tướng và Đạo cơ có khay Kéo từ túi: giữ tay lên món rồi kéo vào ô để mặc, khảm, đặt viên."}</p>
      <div class="bag-detail">${sel ? this.detail(sel, v) : `<p class="nv-note">Chọn một món để xem.</p>`}</div>`;
  }

  private cell(it: BagItem): string {
    return `<button type="button" class="bag-cell ${tone(it)}${it.uid === this.selected ? " sel" : ""}" data-act="item" data-uid="${it.uid}"${it.gear || it.technique || it.boardPiece || isBinhAn(it) ? ` data-drag="item:${it.uid}"` : ""} aria-label="${esc(`${it.name}${it.count > 1 ? ` × ${it.count}` : ""}`)}" title="${esc(it.name)}">
      ${this.itemIcon(it)}${it.count > 1 ? `<span class="n">${it.count}</span>` : ""}${it.kind === "cong_phap" ? `<span class="learned">Đã học</span>` : ""}
    </button>`;
  }

  private itemIcon(it: BagItem): string {
    // Ấn bộ chưa có hình vẽ: dùng dấu son như trên Đạo Cơ Bàn.
    if (!it.art && it.boardPiece?.loai === "an") return this.pieceIcon(it.boardPiece);
    if (it.art) return `<img class="ve" src="${artUrl(it.art)}" alt="">`;
    if (it.icon) return `<img src="${assetUrl(it.icon)}" alt=""${it.gear ? " data-crop" : ""}>`;
    const glyph = it.gear ? SLOT_GLYPH[it.gear.slot] : KIND_GLYPH[it.kind];
    return `<span class="glyph-wrap"${it.element ? ` style="color:${ELEMENT_STYLE[it.element as Element].color}"` : ""}>${icon(glyph, "glyph")}</span>`;
  }

  /** Khung chi tiết món: tên theo màu phẩm, loại và phẩm, công dụng, chỉ số, nút dùng. */
  private detail(it: BagItem, v: NhanVatView): string {
    const head = `<div class="bd-head"><span class="bag-cell ${tone(it)}">${this.itemIcon(it)}</span><span class="grow"><b class="${tone(it)}">${esc(it.name)}</b>
      <span class="block muted">${KIND_NAMES[it.kind]} · ${it.rarity ? `<span class="rar r-${it.rarity}">${RARITY_NAMES[it.rarity]}</span>` : esc(it.gradeLabel)}${it.count > 1 ? ` · × ${it.count}` : ""}</span></span>${it.element ? elementChip(it.element as Element) : ""}</div>`;
    let body = `<p class="nv-note">${esc(it.detail)}</p>`;
    let act = "";
    if (it.gear) {
      const g = it.gear;
      const k = 1 + 0.03 * g.plus;
      const cur = v.gear[g.slot];
      body += `<dl class="kv">
        <dt>Ô</dt><dd>${SLOT_NAMES[g.slot]}${cur ? ` <span class="muted">(đang mặc ${esc(cur.name)})</span>` : ""}</dd>
        <dt>Cường hóa</dt><dd>+${g.plus} / +30</dd>
        ${(Object.entries(g.stats) as [string, number][]).map(([key, val]) => `<dt>${STAT_KEYS[key]}</dt><dd>${fmt(val * k)}</dd>`).join("")}
        <dt>Dòng khảm</dt><dd>${g.sockets}</dd>
        ${gearSet2Rows(g)}</dl>${dongRenHtml(g.forgeLines)}${dongAnHtml(g.hiddenLines)}`;
      act = `<button type="button" class="seal" data-act="wear" data-uid="${it.uid}">Mặc</button>`;
    } else if (it.technique) {
      const t = it.technique;
      body += `<p>${elementChip(t.element)} ${t.subElements.map((e) => elementChip(e)).join(" ")} ${skillChip(t.type)}</p>`;
      act = `<button type="button" class="seal" data-act="carry" data-id="${t.id}"${v.loadout.every(Boolean) ? " disabled" : ""}>Mang vào trận</button>${v.loadout.every(Boolean) ? `<span class="muted">Đủ 4 ô; kéo vào một ô để thay.</span>` : ""}`;
    } else if (it.boardPiece?.loai === "an") {
      // Ấn bộ trong túi: bậc; đủ 3 viên cùng bộ cùng bậc (lục, lam) thì ghép lên bậc trên.
      const bac = it.boardPiece.bac ?? "tim";
      const len = ghepLen(bac);
      const du = it.count >= GHEP_AN_SO;
      body += `<dl class="kv"><dt>Bậc ấn</dt><dd>${bacBadge(bac)}</dd></dl>`;
      act = (len
        ? `<button type="button" class="seal" data-act="ghep-an" data-uid="${it.uid}"${du ? "" : " disabled"}>Ghép ${GHEP_AN_SO} ấn thành bậc ${BAC_TEN[len]}</button>${du ? "" : `<span class="muted">Cần ${GHEP_AN_SO} ấn cùng bộ cùng bậc.</span>`}`
        : `<span class="muted">Ấn bậc ${BAC_TEN[bac]} không ghép lên được.</span>`) + this.khamButtons(it, v);
    } else if (it.kind === "tan_quyen") act = `<button type="button" class="seal" data-act="deposit" data-uid="${it.uid}">Nộp Tàng Kinh Các</button>`;
    else if (it.kind === "ngoc") act = `${this.khamButtons(it, v)}${isBinhAn(it) ? "" : `<button type="button" class="btn small" data-act="goto-lk" data-lk="ngoc">Hợp, điểm hóa</button>`}`;
    else act = `<button type="button" class="btn small sap-co" data-act="use" data-uid="${it.uid}">Dùng ${SAP_CO}</button>`;
    return `${head}${body}<div class="actions">${act}</div>`;
  }

  // ---- Hình nhân vật ------------------------------------------------------------------------------------------

  /**
   * Ngoại hình như trong trận (gói 3, docs/DO_MAC.md): áo và vũ khí theo tài năng, màu áo theo linh căn chính (lookTheoTaiNang
   * chỉ đọc element và sprite "tu_si/<tài năng>"), vầng sáng theo độ hiếm và nấc rèn của vũ khí đang mặc. Lần đầu gặp một
   * bộ áo thì nạp ngay dải của nó (áo tài năng nạp dần lúc rảnh), để búp bê khỏi hiện đạo bào mấy giây đầu.
   */
  private dollLook(v: NhanVatView): Look {
    const base: Look = { body: v.look.body, outfit: v.look.outfit, hat: v.look.hat, weapon: v.look.weapon };
    const unit = { element: v.roots[0], sprite: v.talent.id ? `tu_si/${v.talent.id}` : undefined } as Pick<ReplayUnit, "element" | "sprite">;
    const look = lookTheoTaiNang(unit as ReplayUnit, base);
    const wpn = v.gear.vu_khi;
    if (wpn) {
      look.weaponRarity = wpn.rarity;
      look.weaponPlus = wpn.plus;
    }
    const key = `nhan_vat/${look.body}/${look.outfit}`;
    if (!this.dollNap.has(key)) {
      this.dollNap.add(key);
      this.sprites.ensure(`${key}/`);
      this.sprites.ensure(`${key}.png`);
    }
    return look;
  }
  private dollNap = new Set<string>();

  /** Khoá hình lớn theo áo đang mặc (dáng) và cảnh giới (bậc), lùi về áo theo nghề của `look` (trangPhuc.ts). */
  private hinhLon(v: NhanVatView, look: Look): string[] {
    const ao = v.gear.ao?.code;
    return hinhLonCands(look.body, look.outfit, ao ? DANG_THEO_MA[ao] : undefined, bacTrangPhuc(v.level));
  }

  /** Thân (đã gồm áo), mũ neo ở đầu, vũ khí neo ở tay; dùng đúng hàm vẽ của màn Trận. */
  private drawDoll(): void {
    this.drawGhost();
    const c = this.doll;
    const v = this.data;
    if (!c || !v || !c.isConnected) return;
    const w = c.clientWidth;
    const h = c.clientHeight;
    if (!w || !h) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
    }
    const ctx = c.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.imageSmoothingEnabled = false;
    const look = this.dollLook(v);
    // Dáng đứng theo tài năng (tông chủ ngự kiếm); dáng bay chừa chỗ phía trên, bóng nhỏ và nhạt đi theo độ nhấc.
    const dang = dangFor(v.talent.id, v.sect.role === "tong_chu");
    const t = performance.now() / 1000;
    // Hình lớn vẽ sẵn (đạo bào, võ phục) thì dùng hình lớn; áo tài năng khác vẽ bằng dải trận có màu hệ và vũ khí.
    const art = bigArtFirst(this.hinhLon(v, look), () => this.drawDoll());
    if (art) {
      this.drawBig(ctx, art, v, w, h, t);
      return;
    }
    // Pháp luân (phapLuan.ts) theo công pháp mang vào trận đầu tiên và cấp: từ Trúc Cơ; lên cấp thì vòng lớn dần, đột phá
    // thì diễn thiên kiếp. Người thu lại để vòng nằm gọn trong canvas (tâm vòng cao khoảng 43 px ảnh trên chân).
    const tech = v.loadout.find((x) => !!x);
    const spec: PhapLuanSpec | undefined = tech
      ? { element: tech.element, sub: tech.subElements[0], type: tech.type, grade: tech.grade, level: v.level, leader: v.sect.role === "tong_chu" }
      : undefined;
    const luan = spec ? { spec, beat: { clock: t, ...trackLevel(this, v.level, t) } } : undefined;
    const ext = spec ? phapLuanExtent(spec) : 0;
    // Thu người cho vừa vòng nhưng không nhỏ hơn 78% cỡ cũ; vòng Nguyên Anh, Hóa Thần (nhất là có lông vũ tông chủ) được
    // chạm mép canvas ở chóp lông vũ và quầng ngoài, người vẫn nằm gọn.
    // Màn rộng có sân Pháp tướng cao 350 px (dashboard.css) nên cho phóng tới 4,2; điện thoại giữ 2,6.
    const base = Math.min(matchMedia(WIDE).matches ? 4.2 : 2.6, (h - 14) / (72 + dangHeadroom(dang)));
    const fit = ext ? Math.min((w / 2 - 3) / ext, (h - 12) / (43 + ext)) : base;
    const scale = Math.min(base, Math.max(fit, base * 0.78));
    const k = 1 - Math.min(0.45, (dangLift(dang, "dung", t) * scale) / 60);
    ctx.fillStyle = `rgba(42, 29, 20, ${0.25 * k})`;
    ctx.beginPath();
    ctx.ellipse(w / 2, h - 10, w * 0.28 * k, 5 * k, 0, 0, Math.PI * 2);
    ctx.fill();
    const tint = ELEMENT_STYLE[v.roots[0]]?.color;
    if (!drawDang(ctx, this.sprites, look, dang, "dung", 0, t, w / 2, h - 10, scale, false, tint, 0, luan)) {
      // Chưa có dải hoạt ảnh: vẽ ảnh tĩnh của thân mặc áo.
      const img = this.sprites.get(`nhan_vat/${look.body}/${look.outfit}`);
      if (img) ctx.drawImage(img, w / 2 - 32 * scale, h - 10 - 56 * scale, 64 * scale, 64 * scale);
    }
  }

  /**
   * Bóng pháp tướng: chính nhân vật phóng to gần bằng cột, chân chìm dưới đáy; CSS nhuộm mực nâu, làm nhòe và mờ dần.
   * Vẽ ở 1 điểm ảnh CSS (đằng nào cũng nhòe) và cùng khung hoạt ảnh với tu sĩ, như cái bóng thở theo.
   */
  /**
   * Hình lớn lơ lửng: nhấp nhô chậm, bóng dưới đất nhỏ lại khi bay cao;
   * pháp luân (phapLuan.ts, từ Trúc Cơ) vẽ sau lưng ngang ngực như ở hình ghép.
   */
  private drawBig(ctx: CanvasRenderingContext2D, art: HTMLImageElement, v: NhanVatView, w: number, h: number, t: number): void {
    // Từ 1 lần trở lên phóng theo bậc nửa số nguyên cho điểm ảnh đều; nhỏ hơn thì theo đúng chỗ trống (điện thoại).
    const fit = Math.min((w - 4) / art.naturalWidth, (h - 12) / art.naturalHeight);
    const k = fit >= 1 ? Math.floor(fit * 2) / 2 : fit;
    const dw = art.naturalWidth * k;
    const dh = art.naturalHeight * k;
    const bob = Math.sin(t * 1.4) * 3;
    const x0 = Math.round((w - dw) / 2);
    const y0 = Math.round(h - dh - 10 + bob);
    const near = 0.75 + 0.25 * ((3 - bob) / 6);
    ctx.fillStyle = `rgba(42, 29, 20, ${0.18 * near})`;
    ctx.beginPath();
    ctx.ellipse(w / 2, h - 6, dw * 0.24 * near, 4 * near, 0, 0, Math.PI * 2);
    ctx.fill();
    const tech = v.loadout.find((x) => !!x);
    if (tech) {
      const spec: PhapLuanSpec = { element: tech.element, sub: tech.subElements[0], type: tech.type, grade: tech.grade, level: v.level, leader: v.sect.role === "tong_chu" };
      const unit = dh / 84;
      ctx.save();
      ctx.translate(w / 2, y0 + dh * 0.34);
      ctx.scale(unit, unit);
      drawPhapLuan(ctx, spec, { clock: t, ...trackLevel(this, v.level, t) }, 0, 0, 17);
      ctx.restore();
    }
    const he = ELEMENT_STYLE[v.roots[0]]?.color ?? "#f2c230";
    linhKhi(ctx, v.level, he, w / 2, y0, dw, dh, t, "sau");
    ctx.imageSmoothingEnabled = false;
    // Hình lớn giữ màu vẽ gốc (2026-11-05, người dùng chê áo nhuộm theo hệ); hệ thấy qua linh khí, pháp luân, vòng hệ.
    ctx.drawImage(art, x0, y0, dw, dh);
    linhKhi(ctx, v.level, he, w / 2, y0, dw, dh, t, "truoc");
  }

  private drawGhost(): void {
    const c = this.ghost;
    const v = this.data;
    if (!c || !v || !c.isConnected) return;
    const w = c.clientWidth;
    const h = c.clientHeight;
    if (!w || !h) return;
    if (c.width !== w || c.height !== h) {
      c.width = w;
      c.height = h;
    }
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, w, h);
    ctx.imageSmoothingEnabled = true;
    const look = this.dollLook(v);
    const art = bigArtFirst(this.hinhLon(v, look), () => this.drawDoll());
    if (art) {
      const dh = h * 1.15;
      const dw = (dh * art.naturalWidth) / art.naturalHeight;
      ctx.drawImage(art, (w - dw) / 2, h * 0.02, dw, dh);
      return;
    }
    const dang = dangFor(v.talent.id, v.sect.role === "tong_chu");
    const scale = (h * 1.18) / 72;
    const foot = h * 1.16;
    if (!drawDang(ctx, this.sprites, look, dang, "dung", 0, performance.now() / 1000, w / 2, foot, scale, false, ELEMENT_STYLE[v.roots[0]]?.color)) {
      const img = this.sprites.get(`nhan_vat/${look.body}/${look.outfit}`);
      if (img) ctx.drawImage(img, w / 2 - 32 * scale, foot - 56 * scale, 64 * scale, 64 * scale);
    }
  }

  // ---- Thao tác -----------------------------------------------------------------------------------------------

  protected override act(name: string, el: HTMLElement): void {
    const v = this.data;
    if (!v || this.dnd.justDropped()) return;
    if (this.lk.act(name, el, v)) return;
    const uid = Number(el.dataset.uid);
    if (name === "back") this.ctx.nav.back();
    else if (name === "help") this.openHelp();
    else if (name === "tab") this.setTab(el.dataset.tab as NhanVatTab);
    else if (name === "center") {
      this.center = el.dataset.c as Center;
      this.tab = this.center;
      this.render(v);
    } else if (name === "lt-cell") this.openBanCell(v, el.dataset.cell!);
    else if (name === "lt-set") this.openBanSet(v, el.dataset.set!);
    else if (name === "binh-bo") this.openBinhBo(v);
    else if (name === "ghep-an") void this.send({ type: "ghep_an", uid: Number(el.dataset.uid) });
    else if (name === "goto-lk") this.gotoLk(el.dataset.lk as LkTab);
    else if (name === "wheel") {
      this.showWheel = !this.showWheel;
      this.render(v);
    }
    else if (name === "logout") {
      this.ctx.auth.logout();
      location.reload();
    } else if (name === "gop-y") moGopY();
    else if (name === "lang") {
      if (el.dataset.lang !== lang()) setLang(el.dataset.lang as Lang);
    } else if (name === "tn-cong" || name === "tn-tay") {
      const cmd = v.tiemNang && tiemNangCmd(name, el, v.tiemNang);
      if (cmd) void this.send(cmd);
    } else if (name === "stat") this.openStat(v.stats.find((s) => s.id === el.dataset.stat)!);
    else if (name === "cultivation") this.openCultivation(v);
    else if (name === "main") {
      if (v.cultivation.canBreak) void this.send({ type: "dot_pha" });
      // Bản người mới: bế quan thật ở bảng "Tu luyện tiếp" (moi/, sau chương 0), trong chương 0 thì mở bước nhập môn đang
      // làm. Bản mẫu (?demo=1) không có thẻ nhập môn nên giữ bảng bế quan của mock.
      else if (!laBanMau()) this.ctx.nav.go({ screen: "nhiem-vu", id: "be_quan" });
      else this.openRetreat(v);
    } else if (name === "dev_cap") void this.send({ type: "dev_len_cap", levels: 1 });
    // Tới cấp cuối cảnh giới và đầy tu vi của cấp đó (thêm một cấp nữa; tu vi dừng ở mức đủ để Đột phá).
    else if (name === "dev_dot_pha") void this.send({ type: "dev_len_cap", levels: v.cultivation.breakAt.level - v.level + 1 });
    else if (name === "slot") this.openSlot(v, el.dataset.slot as GearSlot);
    else if (name === "tech") this.openTech(v, Number(el.dataset.i));
    else if (name === "pet") this.openPet(v, Number(el.dataset.i));
    else if (name === "item") {
      this.selected = uid;
      const it = v.bag.items.find((x) => x.uid === uid);
      // Màn rộng có khung chi tiết cạnh túi; điện thoại mở bảng trượt để khỏi phải cuộn xuống dưới 50 ô.
      if (it && !matchMedia(WIDE).matches) {
        const body = openSheet(it.name, this.detail(it, v));
        body.addEventListener("click", (e) => {
          const a = (e.target as HTMLElement).closest<HTMLElement>("[data-act]");
          if (a && !(a as HTMLButtonElement).disabled) {
            closeSheet();
            this.act(a.dataset.act!, a);
          }
        });
      } else this.render(v);
    } else if (name === "wear") void this.send({ type: "mac_do", uid });
    else if (name === "kham") void this.send({ type: "kham", uid, slot: el.dataset.slot as GearSlot });
    else if (name === "carry") void this.carry(v, Number(el.dataset.id), v.loadout.findIndex((t) => !t));
    else if (name === "deposit") void this.send({ type: "nop_tan_quyen", scrollUid: uid });
    else if (name === "use") sapCo("Dùng đan, phù và ấp trứng");
  }

  /** Bế quan (GDD mục 14: nút lớn ở Thông tin): chọn 1 hay 8 giờ, xong cộng tu vi theo tốc độ bế quan. */
  private openRetreat(v: NhanVatView): void {
    const c = v.cultivation;
    const body = openSheet(
      "Bế quan",
      `<p>Mỗi giờ bế quan được <b>${fmt(c.perHour)}</b> tu vi. Tới cấp cuối cảnh giới thì tu vi dừng ở mức đủ để Đột phá.</p>
       <div class="actions">${RETREAT_HOURS.map((g, i) => `<button type="button" class="${i === 0 ? "seal" : "btn"}" data-gio="${g}">Bế quan ${g} giờ · +${fmt(c.perHour * g)}</button>`).join("")}</div>`,
    );
    body.addEventListener("click", (e) => {
      const g = (e.target as HTMLElement).closest<HTMLElement>("[data-gio]")?.dataset.gio;
      if (!g) return;
      closeSheet();
      void this.send({ type: "be_quan", gio: Number(g) });
    });
  }

  /** Mở mục Luyện khí ở một phần (từ bảng ô trang bị, chi tiết ngọc). */
  private gotoLk(tab: LkTab, slot?: GearSlot): void {
    this.lk.goto(tab, slot);
    this.center = this.tab = "luyen-khi";
    if (this.data) this.render(this.data);
  }

  /** Đặt công pháp vào ô i (thay món đang ở đó); i = -1 hoặc ô sau cùng thì thêm vào cuối. */
  private carry(v: NhanVatView, id: number, i: number): Promise<unknown> {
    const ids = v.loadout.map((t) => t?.id ?? null).map((x) => (x === id ? null : x));
    if (i >= 0) ids[i] = id;
    else ids.push(id);
    return this.send({ type: "mang_vao_tran", techniqueIds: ids.filter((x): x is number => x !== null) });
  }

  private openHelp(): void {
    openSheet(
      "Màn Nhân vật",
      `<ul class="list nv-help">
        <li><b>Thông tin</b>: thân phận, linh căn, chỉ số chiến đấu, tu luyện. Chạm một chỉ số để xem nguồn.</li>
        <li><b>Pháp tướng</b>: 7 ô trang bị quanh hình (màu nền ô là độ hiếm: lục, lam, tím, vàng, đỏ), 4 ô công pháp mang vào trận, 5 ô thú. Bấm "Vòng hệ" để xem 12 hệ: hệ linh căn sáng, vạch xanh là tương sinh, vạch đỏ là tương khắc, nét đứt là đối cực.</li>
        <li><b>Đạo Cơ Bàn</b>: bàn 19 ô mở dần theo cảnh giới. Đặt ấn bộ, ngọc hệ nối về ô tâm để kích thêm tối đa 2 món cho một bộ; hai bộ kề nhau theo quan hệ hệ thì cộng hưởng.</li>
        <li><b>Luyện khí</b>: phân giải đồ ra Khí Tinh, tẩy luyện chỉ số phụ, nuôi khí linh (thanh vàng trên ô đồ; cấp 3, 6, 9 chọn khí văn), hợp ngọc song hệ, điểm hóa Phách, sổ Bảo Giám. Danh khí luyện ở Luyện Khí Các của tông môn.</li>
        <li><b>Túi</b>: 50 ô gốc, lọc theo loại và phẩm. Màn rộng kéo món sang ô để mặc, kéo về túi để tháo; điện thoại chạm ô hoặc chạm món rồi chọn.</li>
      </ul>`,
    );
  }

  private openStat(s: StatLine): void {
    openSheet(
      `${s.label}: ${statText(s)}`,
      `<dl class="kv">${s.sources.map((x) => `<dt>${esc(x.label)}</dt><dd>${x.value > 0 && x.label !== "Gốc theo cấp" ? "+" : ""}${statText(s, x.value)}</dd>`).join("")}</dl>
       <p class="muted">Số của đồ, ngọc và thú là dữ liệu mẫu.</p>`,
    );
  }

  private openCultivation(v: NhanVatView): void {
    const c = v.cultivation;
    openSheet(
      `Tốc độ bế quan: ${fmt(c.perHour)}/giờ`,
      `<dl class="kv">${c.sources.map((x) => `<dt>${esc(x.label)}</dt><dd>${x.value ? `+${fmt(x.value)}` : "—"}</dd>`).join("")}</dl>
       <p class="muted">Đề xuất: bế quan 8 giờ đủ một cấp ở Hạ vị; linh khí vị diện nhân thẳng vào tốc độ (GDD mục 7). Còn ${fmt(Math.max(0, v.expToNext - v.exp))} tu vi tới cấp kế; mốc đột phá cấp ${c.breakAt.level}.</p>`,
    );
  }

  /** Ô trang bị: món đang mặc, các món cùng ô trong túi để thay, nút Tháo. */
  private openSlot(v: NhanVatView, slot: GearSlot): void {
    const g = v.gear[slot];
    const spare = v.bag.items.filter((it) => it.gear?.slot === slot);
    const body = openSheet(
      g ? `${SLOT_NAMES[slot]}: ${g.name}` : SLOT_NAMES[slot],
      `${g ? this.gearDetail(g, this.kho(v)) : `<p class="muted">Chưa mặc món nào. Đồ rơi ở bí cảnh hoặc rèn ở lò rèn.</p>`}
       ${spare.length ? `<h3>Trong túi</h3><ul class="list">${spare
         .map((it) => `<li class="row"><span class="bag-cell ${tone(it)}">${this.itemIcon(it)}</span><span class="grow"><b>${esc(it.name)}</b><span class="muted block">${it.rarity ? RARITY_NAMES[it.rarity] : esc(it.gradeLabel)} · +${it.gear!.plus}</span></span><button type="button" class="btn small" data-a="wear" data-uid="${it.uid}">Mặc</button></li>`)
         .join("")}</ul>` : ""}
       ${g ? `<div class="actions"><button type="button" data-a="off">Tháo về túi</button><button type="button" class="sap-co" data-a="ren">Rèn ${SAP_CO}</button><button type="button" data-a="tay">Tẩy luyện</button>${hasKhiLinh(g.rarity) ? `<button type="button" data-a="kl">Khí linh</button>` : ""}</div>` : ""}`,
    );
    cropIcons(body);
    body.addEventListener("click", (e) => {
      const a = (e.target as HTMLElement).closest<HTMLElement>("[data-a]");
      if (!a) return;
      closeSheet();
      if (a.dataset.a === "giam") void this.send({ type: "giam_dinh", slot, i: Number(a.dataset.i) });
      else if (a.dataset.a === "tay-an") void this.send({ type: "tay_an", slot, i: Number(a.dataset.i) });
      else if (a.dataset.a === "wear") void this.send({ type: "mac_do", uid: Number(a.dataset.uid) });
      else if (a.dataset.a === "off") void this.send({ type: "thao_do", slot });
      else if (a.dataset.a === "tay") this.gotoLk("tay-luyen", slot);
      else if (a.dataset.a === "kl") this.gotoLk("khi-linh", slot);
      else sapCo("Rèn, sửa đồ");
    });
  }

  /** Số Giám Định Phù trong túi (PH-CH-011) và Linh Văn Thạch, cho nút dòng ẩn. */
  private kho(v: NhanVatView): { phu: number; linhVan: number } {
    const phu = v.bag.items.filter((it) => it.code === "PH-CH-011").reduce((n, it) => n + it.count, 0);
    return { phu, linhVan: v.luyenKhi.linhVanThach };
  }

  private gearDetail(g: GearItem, kho?: { phu: number; linhVan: number }): string {
    const k = 1 + 0.03 * g.plus;
    const stats = (Object.entries(g.stats) as [string, number][])
      .map(([key, val]) => `<dt>${STAT_KEYS[key]}</dt><dd>${fmt(val * k)} <span class="muted">(${fmt(val)} + ${g.plus * 3}%)</span></dd>`)
      .join("");
    const gems = g.gems.map((gem) => `<li class="row">${elementChip(gem.element)} <span class="grow">Ngọc cấp ${gem.level}</span><span class="muted">+${pctText(gemValue(gem.level))}</span></li>`).join("");
    return `<dl class="kv">
        <dt>Độ hiếm</dt><dd class="rar r-${g.rarity}">${RARITY_NAMES[g.rarity]}</dd>
        <dt>Cường hóa</dt><dd>+${g.plus} / +30</dd>
        <dt>Độ bền</dt><dd class="${g.durability < LOW ? "bad" : ""}">${g.durability} / ${g.durabilityMax}</dd>
        ${stats}
        <dt>Dòng khảm</dt><dd>${g.gems.length} / ${g.sockets}</dd>
        ${gearSet2Rows(g)}
      </dl>${gems ? `<ul class="list">${gems}</ul>` : ""}${dongRenHtml(g.forgeLines)}${dongAnHtml(g.hiddenLines, kho)}`;
  }

  /** Ô công pháp: công pháp đang mang, các công pháp đã học để thay, nút Bỏ ra. */
  private openTech(v: NhanVatView, i: number): void {
    const t = v.loadout[i];
    const free = v.learned.filter((x) => !v.loadout.some((y) => y?.id === x.id));
    const body = openSheet(
      t ? t.name : `Ô công pháp ${i + 1}`,
      `${t ? `<p>${elementChip(t.element)} ${t.subElements.map((e) => elementChip(e)).join(" ")} ${skillChip(t.type)}</p><p class="muted">${esc(t.gradeName)}${t.layer ? ` · tầng ${t.layer}` : ""} · ${esc(t.summary)}</p>` : `<p class="muted">Ô trống.</p>`}
       ${free.length ? `<h3>Đã học</h3><ul class="list">${free
         .map((x) => `<li class="row">${techCover(x, "s")}<span class="grow"><b>${esc(x.name)}</b><span class="muted block">${esc(x.gradeName)} · ${esc(x.summary)}</span></span><button type="button" class="btn small" data-a="carry" data-id="${x.id}">Mang</button></li>`)
         .join("")}</ul>` : ""}
       ${t ? `<div class="actions"><button type="button" data-a="off">Bỏ ra</button></div>` : ""}`,
    );
    body.addEventListener("click", (e) => {
      const a = (e.target as HTMLElement).closest<HTMLElement>("[data-a]");
      if (!a) return;
      closeSheet();
      if (a.dataset.a === "carry") void this.carry(v, Number(a.dataset.id), i);
      else if (a.dataset.a === "off") void this.send({ type: "mang_vao_tran", techniqueIds: v.loadout.filter((x, j) => x && j !== i).map((x) => x!.id) });
    });
  }

  private openPet(v: NhanVatView, i: number): void {
    const m = v.mounts[i];
    if (!m) {
      openSheet("Ô thú trống", `<p class="muted">Thuần phục ở hang dị thú hoặc ấp trứng thú trong túi. Mỗi người tối đa 5 thú (GDD mục 6).</p>`);
      return;
    }
    const body = openSheet(
      m.name,
      `<div class="pet-hero"><img src="${assetUrl(m.icon)}" alt=""></div>
       <p>${elementChip(m.element)} <span class="muted">${esc(m.grade)} · ${esc(m.realm)}</span></p>
       <p class="muted">Cả 5 thú cộng chỉ số cho chủ; chọn 1 con làm thú cưỡi, đổi ở thành chủ hoặc sơn môn.</p>
       <div class="actions">${i === v.riding ? `<button type="button" disabled>Đang cưỡi</button>` : `<button type="button" class="seal" data-a="ride">Cưỡi con này</button>`}</div>`,
    );
    body.addEventListener("click", (e) => {
      if ((e.target as HTMLElement).closest("[data-a='ride']")) {
        closeSheet();
        void this.send({ type: "cuoi_thu", index: i });
      }
    });
  }

  // ---- Kéo thả (keoTha.ts: chuột, bút, cảm ứng giữ tay rồi kéo) ----------------------------------------------------

  /**
   * Khay "Kéo từ túi" dưới Pháp tướng, Đạo cơ ở khung hẹp (màn rộng thấy túi bên cạnh nên CSS ẩn khay): túi là tab riêng nên
   * không kéo sang được, khay đưa sẵn món dùng được ở đây. Khay cũng là chỗ thả để tháo đồ, gỡ viên về túi.
   */
  private tray(v: NhanVatView): string {
    const board = this.center === "dao-co";
    const items = v.bag.items.filter((it) => (board ? !!it.boardPiece : !!(it.gear || it.technique || it.boardPiece || isBinhAn(it))));
    const coarse = matchMedia("(pointer: coarse)").matches;
    return `<div class="nv-tray" data-drop="bag">
      <div class="nv-tray-head"><b>Kéo từ túi</b><span class="muted">${coarse ? "Giữ tay lên món rồi kéo" : "Kéo món"} ${board ? "lên ô của bàn; kéo viên trên bàn xuống đây để gỡ" : "vào ô trang bị, công pháp; kéo đồ đang mặc xuống đây để tháo"}</span></div>
      <div class="nv-tray-row">${items.map((it) => this.cell(it)).join("") || `<span class="muted">Túi không có món dùng được ở đây.</span>`}</div>
    </div>`;
  }

  /** Nút "Khảm vào …" cho ngọc, ấn, binh ấn trong túi: mỗi ô đang mặc một nút (binh ấn chỉ ô công). */
  private khamButtons(it: BagItem, v: NhanVatView): string {
    const slots = (Object.keys(SLOT_NAMES) as GearSlot[]).filter((s) => v.gear[s] && (!isBinhAn(it) || BINH_AN_O.includes(s)));
    if (!slots.length) return `<span class="muted">Mặc đồ trước rồi khảm.</span>`;
    return `<span class="kham-to"><span class="muted">Khảm vào</span>${slots
      .map((s) => `<button type="button" class="btn small" data-act="kham" data-uid="${it.uid}" data-slot="${s}">${SLOT_NAMES[s]}</button>`)
      .join("")}</span>`;
  }

  /** Việc sẽ làm khi thả món `drag` vào chỗ `drop` (nhãn cạnh ngón tay); null là chỗ đó không nhận. */
  private dropAction(drag: DragRef, drop: string): DropAction {
    const v = this.data;
    if (!v) return null;
    const [k, id] = drag.split(":");
    const [dk, did] = drop.split(":");
    if (k === "item") {
      const it = v.bag.items.find((x) => x.uid === Number(id));
      if (!it) return null;
      if (it.gear) {
        if (drop !== `gear:${it.gear.slot}`) return null;
        const cur = v.gear[it.gear.slot];
        return cur ? `Mặc, ${cur.name} về túi` : `Mặc vào ô ${SLOT_NAMES[it.gear.slot]}`;
      }
      if (it.technique) {
        if (dk !== "tech") return null;
        const cur = v.loadout[Number(did)];
        return cur ? `Thay ${cur.name}` : `Mang vào ô ${Number(did) + 1}`;
      }
      if (dk === "gear" && (it.boardPiece || isBinhAn(it))) {
        const slot = did as GearSlot;
        const g = v.gear[slot];
        if (!g) return { no: `Chưa mặc ${SLOT_NAMES[slot].toLowerCase()}` };
        if (isBinhAn(it) && !BINH_AN_O.includes(slot)) return { no: "Binh ấn chỉ khảm vào vũ khí, bao tay, ngọc bội" };
        const swap = (it.boardPiece?.loai === "an" && g.seal) || (isBinhAn(it) && g.binhAn);
        const used = g.gems.length + (g.seal ? 1 : 0) + (g.binhAn ? 1 : 0);
        if (!swap && g.lines !== undefined && used >= g.lines) return { no: `${SLOT_NAMES[slot]} hết dòng khảm (${used}/${g.lines})` };
        return `Khảm vào ${SLOT_NAMES[slot]}${swap ? ", viên cũ về túi" : ""}`;
      }
      if (dk === "ban" && it.boardPiece) return this.canPlace(v, did, it.boardPiece) ? (v.board.cells[did] ? "Đặt lên bàn, viên cũ về túi" : "Đặt lên Đạo Cơ Bàn") : null;
      return null;
    }
    if (k === "gear") return drop === "bag" ? "Tháo về túi" : null;
    if (k === "tech") {
      if (drop === "bag") return "Bỏ khỏi ô";
      if (dk === "tech" && drop !== drag) return v.loadout[Number(did)] ? "Đổi chỗ hai ô" : `Chuyển sang ô ${Number(did) + 1}`;
      return null;
    }
    if (k === "cell") return drop === "bag" ? "Gỡ về túi" : null;
    return null;
  }

  private drop(drag: DragRef, drop: string): void {
    const v = this.data!;
    const [k, id] = drag.split(":");
    const [dk, did] = drop.split(":");
    if (k === "item") {
      const it = v.bag.items.find((x) => x.uid === Number(id))!;
      if (it.gear) void this.send({ type: "mac_do", uid: it.uid });
      else if (it.technique) void this.carry(v, it.technique.id, Number(did));
      else if (dk === "gear") void this.send({ type: "kham", uid: it.uid, slot: did as GearSlot });
      else if (dk === "ban" && it.boardPiece) void this.send({ type: "dat_vien", cell: did, uid: it.uid });
    } else if (k === "gear") void this.send({ type: "thao_do", slot: id as GearSlot });
    else if (k === "cell") void this.send({ type: "go_vien", cell: id });
    else if (k === "tech") {
      const ids = v.loadout.map((t) => t?.id ?? null);
      const i = Number(id);
      if (drop === "bag") ids[i] = null;
      else [ids[i], ids[Number(did)]] = [ids[Number(did)] ?? null, ids[i]];
      void this.send({ type: "mang_vao_tran", techniqueIds: ids.filter((x): x is number => x !== null) });
    }
  }

}

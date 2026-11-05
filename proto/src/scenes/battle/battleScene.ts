import type { Sprites } from "../../assets/sprites.ts";
import { createArenaBackdrop, type ArenaBackdrop, type ArenaKind } from "../../three/index.ts";
import { Camera, type Rect } from "../../app/camera.ts";
import type { Scene } from "../../app/scene.ts";
import type { View } from "../../app/view.ts";
import { ReplayPlayer } from "../../replay/player.ts";
import { FONT_DISPLAY, FONT_TEXT } from "../../theme/fonts.ts";
import { between, ReplayIndex, type UnitTimeline } from "../../replay/timeline.ts";
import type { Look, ReplaySource } from "../../replay/types.ts";
import { ELEMENT_STYLE } from "../../theme/elements.ts";
import { animInfo, assignLooks, drawCharacter, resolveLook, type Anim } from "./character.ts";
import { assignDang, dangLift, drawDang, drawSwingTrail, type DangId } from "./dangDung.ts";
import { drawDissolve, drawDust, impactFilter, ThanNguoi } from "./chuyenDong.ts";
import { buildPhapLuan, phapLuanBeat, type PhapLuanUnit } from "./phapLuan.ts";
import { ReplayControls } from "./controls.ts";
import { FxLayer, type Point } from "../../hieu_ung/fx2d.ts";
import { createSkillFx, type SkillFx } from "../../hieu_ung/index.ts";
import { drawMotif } from "../../hieu_ung/motifs.ts";
import { VfxLib } from "../../hieu_ung/vfx.ts";
import { tr } from "../../dashboard/i18n.ts";

const CELL = 64; // đơn vị thế giới mỗi ô sân
const LANE = 60; // khoảng cách ngang giữa hai người cùng hàng
const SIZE = 40; // cạnh khối nhân vật
const TEAM_RING = ["#f2e6c8", "#d6372a"]; // đội A giấy dó, đội B ấn son (sáng, vì áo theo hệ nên vòng chân là dấu đội chính)
const HP = "#7bc96f";
const MANA = "#5aa9e6";
const NUMBER_LIFE = 0.9; // giây thực một con số sát thương bay lên
const COUNTER_COLOR = "#ff8a3d"; // số sát thương của đòn khắc hệ
const COUNTER_TIPS = 4; // mấy đòn khắc đầu trận có nhãn "Khắc ×1,5" (GDD mục 14, FTUE: thấy khắc chế hoạt động)
const SCORE_SIDE = 104; // px CSS mỗi bên mép trên dành cho nút của thanh trên (Quay lại), dòng tỉ số nằm giữa
const HEAVY_HIT = 0.05; // đòn từ 5% máu tối đa trở lên mới diễn hoạt ảnh trúng đòn
const BADGE = 12; // cạnh dấu hệ đặt trước thanh máu, đơn vị thế giới
const DEFAULT_ARENA = "vo_truong"; // nền sân khi replay không nói trận đánh ở đâu

/**
 * Bản đồ chiến trường theo vùng (assets/pixellab/chien_truong/<vùng>/<bối cảnh>.png, replay.arena = "<vùng>/<bối cảnh>"):
 * ảnh lớn nên không nằm trong bộ nạp Sprites, nạp khi trận cần. undefined khi chưa nạp xong hoặc chưa có hình.
 */
const battlefields = new Map<string, HTMLImageElement>();
function battlefield(arena: string | undefined): HTMLImageElement | undefined {
  if (!arena?.includes("/")) return undefined;
  let img = battlefields.get(arena);
  if (!img) {
    img = new Image();
    img.src = `${import.meta.env.BASE_URL}pixellab/chien_truong/${arena}.png`;
    battlefields.set(arena, img);
  }
  return img.complete && img.naturalWidth > 0 ? img : undefined;
}
const THREE_ARENAS = new Set<string>(["vo_truong", "mo_linh_thach", "cao_nguyen"] satisfies ArenaKind[]); // sân có bản Three.js

/** Số tick từ mốc gần nhất không sau t trong `marks` (xếp tăng dần) tới t; undefined nếu chưa có mốc nào. */
function since(marks: number[] | undefined, t: number): number | undefined {
  if (!marks || marks.length === 0 || marks[0] > t) return undefined;
  let lo = 0;
  let hi = marks.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (marks[mid] <= t) lo = mid;
    else hi = mid - 1;
  }
  return t - marks[lo];
}

/** Màn xem trận: phát replay, vẽ nhân vật bằng hình PixelLab ghép (thiếu hình thì khối màu theo hệ). */
export class BattleScene implements Scene {
  readonly id = "tran";
  readonly label = "Trận";
  readonly camera = new Camera();
  readonly hud: HTMLElement;
  private controls: ReplayControls;
  private sources: ReplaySource[];
  private source: ReplaySource;
  private sprites: Sprites;
  private vfx: VfxLib;
  private fx = new FxLayer();
  /** Hiệu ứng chiêu Three.js phủ trên canvas (hieu_ung/); chưa sẵn sàng hay không có WebGL2 thì vẽ bản 2D của `fx` */
  private fx3d: SkillFx | null = null;
  private index: ReplayIndex | null = null;
  private player: ReplayPlayer | null = null;
  private error = "";
  /** Số lần đã nạp; kết quả của lần nạp cũ về muộn thì bỏ. */
  private loads = 0;
  /** Toạ độ ngang của từng người, theo id */
  private lateral = new Map<number, number>();
  /** Mốc ra chiêu và trúng đòn nặng theo id, xếp tăng dần */
  private marks = new Map<number, { casts: number[]; hits: number[] }>();
  /** Mấy đòn khắc hệ đầu trận, hiện kèm nhãn "Khắc ×1,5" */
  private counterTips = new Set<object>();
  /** Ngoại hình ghép theo id (tạm theo đội và hàng khi replay chưa có) */
  private looks = new Map<number, Look>();
  /** Dáng đứng theo id: theo tài năng (tu_si/<tài năng>), tông chủ ngự kiếm (dangDung.ts) */
  private dangs = new Map<number, DangId>();
  /** Pháp luân theo id (phapLuan.ts): công pháp chủ tu, cấp (ReplayUnit.level) và các lần ra chiêu */
  private luans = new Map<number, PhapLuanUnit>();
  /** Chuyển động thân người (chuyenDong.ts): khựng, khung va chạm, bị đẩy, nhún bước, bụi, bóng lướt, tan khi ngã */
  private than: ThanNguoi | null = null;
  /** Trục sân dọc khi màn hình đứng, ngang khi màn hình nằm */
  private vertical: boolean | null = null;
  /** Vùng nhìn và camera lúc căn sân lần cuối */
  private fitted: { w: number; h: number; x: number; y: number; zoom: number } | null = null;
  /** Nền sân Three.js của loại sân và chiều dài sân đang xem; layer null khi sân đó chưa có bản Three.js */
  private backdrop: { key: string; layer: ArenaBackdrop | null } | null = null;

  /** sources[0] mở mặc định; người xem đổi nguồn ở ô chọn trên thanh điều khiển. */
  constructor(sources: ReplaySource[], sprites: Sprites) {
    this.sources = [...sources];
    this.source = this.sources[0];
    this.sprites = sprites;
    this.vfx = new VfxLib(sprites);
    // Hết trận, nút "Tiếp tục" về màn đã mở trận (như nút Quay lại của thanh trên), không có thì về Động phủ.
    const back = () => {
      if (history.length > 1) history.back();
      else location.hash = "#dong-phu";
    };
    this.controls = new ReplayControls(this.sources.map((s) => s.label), (i) => this.load(this.sources[i]), back);
    this.hud = this.controls.el;
  }

  /**
   * Mở một trận cụ thể, ví dụ khi bấm vào chiến báo (GDD mục 14); nguồn chưa có trong ô chọn thì thêm lên đầu.
   * Gọi trước hay sau khi scene được mở đều được; chuyển sang màn Trận là việc của nơi gọi.
   */
  open(source: ReplaySource): void {
    if (!this.sources.includes(source)) this.sources.unshift(source);
    // Trận mở cho người chơi: ẩn ô chọn nguồn (công cụ thử trận), hết trận có nút Tiếp tục.
    this.controls.lock();
    this.controls.setSources(this.sources.map((s) => s.label), this.sources.indexOf(source));
    this.load(source);
  }

  enter(v: View): void {
    if (this.loads === 0) this.load(this.source);
    this.fitIfRotated(v);
    this.fx3d ??= createSkillFx(v.ctx.canvas);
    this.fx3d.show(true);
  }

  leave(): void {
    this.fx3d?.show(false);
  }

  private load(source: ReplaySource): void {
    const n = ++this.loads;
    const speed = this.player?.speed ?? 1;
    this.source = source;
    this.index = null;
    this.player = null;
    this.error = "";
    this.controls.loading();
    this.controls.ended(null);
    source.load().then(
      (replay) => {
        if (n !== this.loads) return;
        this.index = new ReplayIndex(replay);
        // Chừa 1 giây sau đòn cuối để số sát thương bay hết.
        this.player = new ReplayPlayer(replay.tps, replay.ticks + replay.tps);
        this.player.speed = speed;
        this.controls.bind(this.player);
        this.layoutLanes();
        this.buildMarks();
        this.counterTips = new Set(this.index.hits.filter((h) => h.kind === "hit" && h.counter).slice(0, COUNTER_TIPS));
        this.looks = assignLooks(replay.units);
        this.dangs = assignDang(replay.units);
        this.luans = buildPhapLuan(replay.units, replay.events);
        this.than = new ThanNguoi(this.index, this.sprites, (id) => this.looks.get(id));
        this.vertical = null;
      },
      (e: unknown) => {
        if (n === this.loads) this.error = String(e);
      },
    );
  }

  update(dt: number): void {
    this.player?.update(dt);
    this.controls.sync();
  }

  draw(v: View): void {
    const ctx = v.ctx;
    const index = this.index;
    const player = this.player;
    if (!index || !player) {
      ctx.fillStyle = "#a89c88";
      ctx.font = `15px ${FONT_TEXT}`;
      ctx.textAlign = "center";
      ctx.fillText(this.error || `Đang tải ${this.source.label}…`, v.w / 2, (v.h - v.bottom) / 2);
      return;
    }
    this.fitIfRotated(v);
    const t = player.t;
    const tps = index.replay.tps;

    const life = (s: number) => Math.min(2 * tps, s * tps * player.speed);
    const cam = this.camera;
    const at = (id: number, time = t) => {
      const ut = index.byId.get(id);
      return ut ? this.place(ut.pos.moving(time), this.lat(id)) : null;
    };
    const zone = (center: number, radius: number) => {
      const p = this.place(center, 0);
      const along = (radius / 1000) * CELL;
      const half = 3.5 * LANE;
      return this.vertical ? { ...p, rx: half, ry: along } : { ...p, rx: along, ry: half };
    };
    this.fx.prepare({
      ctx, index, t, life, size: SIZE, zoom: cam.zoom, dpr: v.dpr, at, zone,
      toScreen: (p) => cam.toScreen(p.x, p.y, v),
      image: (key) => this.sprites.get(key),
      vfx: this.vfx,
    });
    // Lớp Three.js vẽ cả bốn pha hiệu ứng; khung nào nó chưa vẽ được (chưa nạp, không có WebGL2) thì giữ bản 2D.
    const fx3d = !!this.fx3d?.active;

    cam.apply(v);
    // Rung màn hình khi có đòn lớn: dời cả sân theo px màn hình.
    const shake = this.fx.shake();
    if (shake.x || shake.y) ctx.translate(shake.x / cam.zoom, shake.y / cam.zoom);
    this.drawField(ctx, index.replay.fieldLength);
    if (!fx3d) this.fx.ground();

    // Ai vừa trúng đòn trong 3 tick gần nhất thì nháy trắng.
    const flashed = new Set(between(index.hits, t - 3, t).filter((h) => h.kind === "hit").map((h) => h.unit));
    const lunges = this.fx.lunges();
    for (const ut of index.units) this.drawUnit(ctx, ut, t, flashed.has(ut.unit.id), lunges.get(ut.unit.id), life, at);

    if (!fx3d) this.fx.air();
    this.fx3d?.frame(
      { index, t, speed: player.speed, life, at, zone, size: SIZE },
      { w: v.w, h: v.h, bottom: v.bottom, x: cam.x, y: cam.y, zoom: cam.zoom, shakeX: shake.x, shakeY: shake.y },
      0,
    );
    // Lớp trước của sân Three.js (cành, nhũ đá, mây, viền tối mép sân) phủ lên người và hiệu ứng, dưới số sát thương.
    ctx.imageSmoothingEnabled = true;
    this.arenaBackdrop()?.drawFront(ctx, performance.now() / 1000, !!this.vertical);
    this.drawNumbers(ctx, index, t, life(NUMBER_LIFE));
    this.fx.callouts();
    this.drawScore(v, index, t, player);
  }

  // ---- hoạt ảnh ----

  /** Mốc ra chiêu (lúc bắt đầu vận công nếu có) và mốc trúng đòn nặng của từng người, để chọn hoạt ảnh. */
  private buildMarks(): void {
    const index = this.index!;
    this.marks.clear();
    const of = (id: number) => {
      let m = this.marks.get(id);
      if (!m) this.marks.set(id, (m = { casts: [], hits: [] }));
      return m;
    };
    for (const c of index.casts) of(c.unit).casts.push(c.start ?? c.tick);
    for (const e of index.hits) {
      const ut = index.byId.get(e.unit);
      // Đòn nhỏ chỉ nháy trắng; từ 5% máu trở lên mới diễn trúng đòn, để người không giật liên tục.
      if (e.kind === "hit" && ut && e.amount >= ut.unit.hpMax * HEAVY_HIT) of(e.unit).hits.push(e.tick);
    }
    for (const m of this.marks.values()) m.casts.sort((a, b) => a - b);
  }

  /**
   * Hoạt ảnh và khung của một người tại t, ưu tiên: ngã, ra chiêu, trúng đòn nặng, chạy, đứng. `trail` là khung để vẽ
   * vệt vũ khí. null nếu chưa có hình.
   */
  private pose(ut: UnitTimeline, t: number, look: Look, life: (s: number) => number): { anim: Anim; frame: number; trail?: number } | null {
    const idle = animInfo(this.sprites, look, "dung");
    if (!idle) return null;
    const tps = this.index!.replay.tps;
    const play = (anim: Anim, since: number | undefined) => {
      const info = since === undefined ? undefined : animInfo(this.sprites, look, anim);
      if (!info || since === undefined) return null;
      return { anim, frame: Math.floor((since / tps) * info.fps), frames: info.frames };
    };
    if (t >= ut.death) {
      const p = play("nga", t - ut.death);
      if (p) return { anim: "nga", frame: Math.min(p.frame, p.frames - 1) };
    } else {
      const m = this.marks.get(ut.unit.id);
      // Ra chiêu theo loại chiêu (chuyenDong.ts): vung trước, khựng ở khung chạm; thân chưa có dải riêng thì ra_chieu chung.
      if (this.than) {
        const act = this.than.act(ut, t, life);
        if (act) return act;
      } else {
        const cast = play("ra_chieu", since(m?.casts, t));
        if (cast && cast.frame < cast.frames) return cast;
      }
      const hit = play("trung_don", since(m?.hits, t));
      if (hit && hit.frame < hit.frames) return hit;
      const run = this.than?.gait(ut, t);
      if (run) return run;
    }
    // Đứng thở lệch nhịp theo id để cả đội không nhấp nhô cùng lúc.
    return { anim: "dung", frame: (Math.floor((t / tps) * idle.fps) + ut.unit.id) % idle.frames };
  }

  // ---- bố cục ----

  /** Mỗi hàng của mỗi đội dàn ngang quanh trục; hàng sau lệch nửa làn để không che hàng trước. */
  private layoutLanes(): void {
    const index = this.index!;
    this.lateral.clear();
    for (const team of [0, 1]) {
      for (const row of [0, 1]) {
        const us = index.units.filter((u) => u.unit.team === team && u.unit.row === row).sort((a, b) => a.unit.id - b.unit.id);
        us.forEach((u, i) => this.lateral.set(u.unit.id, (i - (us.length - 1) / 2) * LANE + (row === 1 ? LANE / 2 : 0)));
      }
    }
  }

  /**
   * Toạ độ ngang của một người. Hình tu sĩ nhìn hướng đông nam và đội B lật ngang, nên khi sân dọc
   * đội A dời sang trái, đội B dời sang phải nửa làn để hai đội nhìn chéo vào nhau thay vì cùng nhìn xuống.
   */
  private lat(id: number): number {
    const base = this.lateral.get(id) ?? 0;
    if (!this.vertical) return base;
    return base + (this.index?.byId.get(id)?.unit.team === 1 ? LANE / 2 : -LANE / 2);
  }

  /** Vị trí trên trục (milli-ô) và toạ độ ngang ra toạ độ thế giới; đội A luôn ở dưới hoặc bên trái. */
  private place(pos: number, lateral: number): { x: number; y: number } {
    const along = (pos / 1000) * CELL;
    if (this.vertical) return { x: lateral, y: (this.index!.replay.fieldLength / 1000) * CELL - along };
    return { x: along, y: lateral };
  }

  private fieldRect(): Rect {
    const len = (this.index!.replay.fieldLength / 1000) * CELL;
    const half = 3.5 * LANE;
    return this.vertical ? { x: -half, y: 0, w: 2 * half, h: len } : { x: 0, y: -half, w: len, h: 2 * half };
  }

  /**
   * Căn sân vừa màn hình khi xoay màn hình, hoặc khi vùng nhìn đổi cỡ mà người xem chưa kéo hay zoom
   * (pane hiện ra, thanh bên của khung mới bật tắt). Bỏ qua lúc canvas chưa có kích thước.
   */
  private fitIfRotated(v: View): void {
    const h = v.h - v.bottom;
    if (!this.index || v.w <= 0 || h <= 0) return;
    const vertical = h >= v.w;
    const cam = this.camera;
    const f = this.fitted;
    const untouched = !!f && cam.zoom === f.zoom && cam.x === f.x && cam.y === f.y;
    const resized = !!f && (f.w !== v.w || f.h !== h);
    if (vertical === this.vertical && !(resized && untouched)) return;
    this.vertical = vertical;
    const r = this.fieldRect();
    cam.fit(r, v, 8);
    cam.bounds = r;
    this.fitted = { w: v.w, h, x: cam.x, y: cam.y, zoom: cam.zoom };
  }

  /**
   * Nền sân Three.js của trận đang xem: mỗi chiều trục nướng một lần (lần vẽ đầu thì bắt đầu nướng), rồi mỗi khung vẽ
   * theo toạ độ thế giới nên kéo, zoom, xoay màn vẫn khớp. Đổi sang trận ở sân khác thì bỏ bản cũ.
   * null khi sân chưa có bản Three.js; draw() trả false khi chưa nướng xong hay máy không có WebGL2.
   */
  private arenaBackdrop(): ArenaBackdrop | null {
    if (!this.index) return null;
    const kind = this.index.replay.arena ?? DEFAULT_ARENA;
    const length = (this.index.replay.fieldLength / 1000) * CELL;
    const key = `${kind}|${length}`;
    if (this.backdrop?.key !== key) {
      this.backdrop?.layer?.dispose();
      const layer = THREE_ARENAS.has(kind) ? createArenaBackdrop(kind as ArenaKind, { length, halfCross: 3.5 * LANE }) : null;
      this.backdrop = { key, layer };
    }
    return this.backdrop.layer;
  }

  /** Sân san_dau/<tên> khi không có bản đồ chiến trường: "<vùng>/<bối cảnh>" lùi về sân cùng bối cảnh nếu có, không thì võ trường. */
  private plainArena(): string {
    const arena = this.index?.replay.arena ?? DEFAULT_ARENA;
    if (!arena.includes("/")) return arena;
    const ctx = arena.split("/")[1];
    return this.sprites.get("san_dau/" + ctx) ? ctx : DEFAULT_ARENA;
  }

  /**
   * Bản đồ chiến trường theo vùng: dải sân giữa ảnh trùng sân, cảnh của vùng phủ ra ngoài sân (ảnh cao gấp đôi bề ngang sân,
   * rộng theo tỉ lệ ảnh) nên thu nhỏ hay màn rộng thì thấy cả khung cảnh. Ngoài sân phủ tối hơn để người nổi trên nền.
   */
  private drawBattlefield(ctx: CanvasRenderingContext2D, img: HTMLImageElement, r: Rect): void {
    const len = this.vertical ? r.h : r.w;
    const cross = this.vertical ? r.w : r.h;
    const h = cross * 2;
    const w = (h * img.naturalWidth) / img.naturalHeight;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.translate(r.x + r.w / 2, r.y + r.h / 2);
    if (this.vertical) ctx.rotate(-Math.PI / 2);
    ctx.drawImage(img, -w / 2, -h / 2, w, h);
    ctx.fillStyle = "rgba(20, 17, 15, 0.45)";
    ctx.fillRect(-w / 2, -h / 2, w, (h - cross) / 2);
    ctx.fillRect(-w / 2, cross / 2, w, (h - cross) / 2);
    ctx.fillRect(-w / 2, -cross / 2, (w - len) / 2, cross);
    ctx.fillRect(len / 2, -cross / 2, (w - len) / 2, cross);
    ctx.fillStyle = "rgba(20, 17, 15, 0.15)";
    ctx.fillRect(-len / 2, -cross / 2, len, cross);
    ctx.restore();
  }

  // ---- vẽ ----

  private drawField(ctx: CanvasRenderingContext2D, fieldLength: number): void {
    const r = this.fieldRect();
    const cells = fieldLength / 1000;
    // Nền sân Three.js nếu đã nướng (cả lề quanh sân, sương trôi, đèn nhịp sáng; không cần phủ tối); không thì nền
    // PixelLab (san_dau/<tên>, vẽ ngang theo chiều trục sân, màn đứng xoay 90 độ); chưa có hình nào thì nền tối.
    const backdrop = this.arenaBackdrop();
    const drawn = !!backdrop && backdrop.draw(ctx, performance.now() / 1000, !!this.vertical);
    const map = drawn ? undefined : battlefield(this.index?.replay.arena);
    const bg = drawn || map ? undefined : this.sprites.get("san_dau/" + this.plainArena());
    if (map) this.drawBattlefield(ctx, map, r);
    else if (bg) {
      ctx.imageSmoothingEnabled = false;
      if (this.vertical) {
        ctx.save();
        ctx.translate(r.x + r.w / 2, r.y + r.h / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.drawImage(bg, -r.h / 2, -r.w / 2, r.h, r.w);
        ctx.restore();
      } else {
        ctx.drawImage(bg, r.x, r.y, r.w, r.h);
      }
      // Phủ tối nhẹ để người và hiệu ứng nổi trên nền.
      ctx.fillStyle = "rgba(20, 17, 15, 0.25)";
      ctx.fillRect(r.x, r.y, r.w, r.h);
    } else if (!drawn) {
      ctx.fillStyle = "#1f1a15";
      ctx.fillRect(r.x, r.y, r.w, r.h);
    }
    // Nền đã có ô hay vân để ước khoảng cách: chỉ kẻ ô khi chưa có nền, vạch giữa sân thì luôn giữ (mờ hơn khi có nền).
    const plain = !drawn && !bg && !map;
    ctx.globalAlpha = plain ? 1 : 0.5;
    ctx.beginPath();
    for (let i = 0; i <= (plain ? cells : -1); i++) {
      const a = this.place(i * 1000, 0);
      if (this.vertical) {
        ctx.moveTo(r.x, a.y);
        ctx.lineTo(r.x + r.w, a.y);
      } else {
        ctx.moveTo(a.x, r.y);
        ctx.lineTo(a.x, r.y + r.h);
      }
    }
    ctx.strokeStyle = "#2f2820";
    ctx.lineWidth = 1 / this.camera.zoom;
    ctx.stroke();

    const mid = this.place(fieldLength / 2, 0);
    ctx.beginPath();
    if (this.vertical) {
      ctx.moveTo(r.x, mid.y);
      ctx.lineTo(r.x + r.w, mid.y);
    } else {
      ctx.moveTo(mid.x, r.y);
      ctx.lineTo(mid.x, r.y + r.h);
    }
    ctx.strokeStyle = "#5a4a38";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  private drawUnit(
    ctx: CanvasRenderingContext2D, ut: UnitTimeline, t: number, flash: boolean, lunge: Point | undefined,
    life: (s: number) => number, at: (id: number, time?: number) => Point | null,
  ): void {
    const u = ut.unit;
    const lat = this.lat(u.id);
    const p = this.place(ut.pos.moving(t), lat);
    // Thân người (chuyenDong.ts): khựng khi trúng đòn nặng (tPose), dời vì bị đẩy và nhún bước; vòng đội, thanh máu, dấu
    // hệ vẫn ở chỗ cũ (x, y) cho dễ đọc.
    const mo = this.than?.motion(ut, t, life, (id, tick) => at(id, tick), (pos) => this.place(pos, lat));
    const wanted = this.looks.get(u.id);
    const look = wanted && resolveLook(this.sprites, wanted);
    const pose = look ? this.pose(ut, mo?.tPose ?? t, look, life) : null;
    // Dải ra chiêu theo loại (gói 2) tự có bước nhún tới: bỏ cú nhích của hiệu ứng để không nhích đôi.
    const nudge = pose?.anim.startsWith("ra_chieu_") ? undefined : lunge;
    const x = p.x + (nudge?.x ?? 0);
    const y = p.y + (nudge?.y ?? 0);
    const bodyX = x + (mo?.dx ?? 0);
    const bodyY = y + (mo?.dy ?? 0);
    const dead = t >= ut.death;
    const style = ELEMENT_STYLE[u.element];
    const h = SIZE / 2;
    const sprite = pose ? undefined : this.sprites.get(u.sprite);
    const icon = this.sprites.get("he/" + u.element);
    const tps = this.index!.replay.tps;
    const dang = this.dangs.get(u.id) ?? "thuong";
    // Người bay (lơ lửng, ngự kiếm) nhấc khỏi mặt đất: bóng nhỏ và nhạt đi, thanh máu nhấc theo.
    const lift = pose && look ? (dangLift(dang, pose.anim, t / tps, u.id * 0.37) * SIZE * 1.4) / 64 : 0;
    const shrink = 1 - Math.min(0.45, lift / 30);

    ctx.globalAlpha = dead ? 0.25 : 1 - (1 - shrink) * 0.8;
    ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
    ctx.beginPath();
    ctx.ellipse(x, y + h, h * shrink, h * 0.35 * shrink, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = dead ? 0.25 : 1;
    ctx.beginPath();
    ctx.ellipse(x, y + h, h, h * 0.35, 0, 0, Math.PI * 2);
    ctx.imageSmoothingEnabled = false; // giữ nét pixel art khi phóng to

    const figure = !!(pose || sprite);
    if (figure) {
      // Có hình PixelLab: vòng đội dưới chân, người đứng trên vòng; dấu hệ đặt trước thanh máu (vẽ ở dưới).
      // Vòng dày kèm quầng mờ cùng màu (người dùng chọn 2026-11-05: áo theo hệ nên đội nhận bằng vòng chân và viền thanh máu).
      const alpha = ctx.globalAlpha;
      ctx.strokeStyle = TEAM_RING[u.team];
      ctx.globalAlpha = alpha * 0.35;
      ctx.lineWidth = 8.5;
      ctx.stroke();
      ctx.globalAlpha = alpha;
      ctx.lineWidth = 4.5;
      ctx.stroke();
      const s = SIZE * 1.4;
      if (pose && look) {
        // Pháp luân từ Trúc Cơ: nhịp tụ lực, bung, khung chạm theo các lần ra chiêu, chỉ tính từ t (không giữ trạng thái).
        const pl = this.luans.get(u.id);
        const luan = pl ? { spec: pl.spec, beat: phapLuanBeat(pl.casts, t, tps) } : undefined;
        const mirror = u.team === 1;
        // withLuan: bóng lướt và khung va chạm không vẽ pháp luân (khỏi thành vòng trắng, mực to và đỡ tốn).
        const paint = (px: number, py: number, withLuan: boolean) => {
          const ok = drawDang(ctx, this.sprites, look, dang, pose.anim, pose.frame, t / tps, px, py, s / 64, mirror, style.color, u.id * 0.37, withLuan ? luan : luan && { ...luan, hidden: true });
          if (!ok) drawCharacter(ctx, this.sprites, look, pose.anim, pose.frame, px, py, s / 64, mirror);
        };
        // Bụi dưới chân và bóng mờ khi lướt (đuôi lấy từ chính đường đã đi).
        if (mo) {
          drawDust(ctx, mo.dust, h);
          for (const g of mo.ghosts) {
            ctx.globalAlpha = g.alpha;
            paint(g.x, g.y + h, false);
          }
        }
        // Thân: bè ra hay nhún quanh chân; khung va chạm trắng rồi mực (thay nháy mờ); ngã thì tan dần còn 0,3.
        // Khung va chạm cần ctx.filter; máy không có (Safari, WebView cũ) và đòn nhẹ thì giữ nháy 0,7 như cũ.
        const filterOk = "filter" in ctx;
        const struck = !!mo && mo.impact >= 0 && filterOk;
        ctx.save();
        ctx.globalAlpha = dead ? mo?.alpha ?? Math.max(0.35, 1 - (t - ut.death) / (1.5 * tps)) : flash && !struck ? 0.7 : 1;
        if (mo && (mo.sx !== 1 || mo.sy !== 1)) {
          ctx.translate(bodyX, bodyY + h);
          ctx.scale(mo.sx, mo.sy);
          ctx.translate(-bodyX, -(bodyY + h));
        }
        if (struck) ctx.filter = impactFilter(mo!.impact);
        paint(bodyX, bodyY + h, !struck);
        if (struck) ctx.filter = "none";
        ctx.restore();
        // Vệt mũi vũ khí khi ra chiêu cận chiến; hạt hệ khi tan.
        if (pose.trail !== undefined) drawSwingTrail(ctx, this.sprites, look, pose.anim, pose.trail, bodyX, bodyY + h, s / 64, mirror, style.color);
        if (mo?.dissolve) drawDissolve(ctx, u.element, bodyX, bodyY - h * 0.2, mo.dissolve);
      } else if (u.team === 1) {
        if (flash && !dead) ctx.globalAlpha = 0.5;
        // Hình PixelLab nhìn hướng đông nam; đội B lật ngang để hai đội quay mặt vào nhau.
        ctx.save();
        ctx.translate(x, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(sprite!, -s / 2, y + h - s, s, s);
        ctx.restore();
      } else {
        if (flash && !dead) ctx.globalAlpha = 0.5;
        ctx.drawImage(sprite!, x - s / 2, y + h - s, s, s);
      }
    } else {
      ctx.beginPath();
      ctx.roundRect(x - h, y - h, SIZE, SIZE, 8);
      ctx.fillStyle = style.color;
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = TEAM_RING[u.team];
      ctx.stroke();
      if (flash && !dead) {
        ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
        ctx.fill();
      }
      if (icon) {
        ctx.drawImage(icon, x - 12, y - 12, 24, 24);
      } else {
        ctx.fillStyle = style.ink;
        ctx.font = `bold 12px ${FONT_TEXT}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(style.short, x, y + 1);
      }
    }
    ctx.globalAlpha = 1;
    if (dead) return;

    // Thanh máu và mana phía trên đầu; có hình người thì dấu hệ đứng ngay trước hai thanh, cả cụm canh giữa.
    const bw = SIZE + 4;
    const badge = figure ? BADGE + 2 : 0;
    const bx = x - (bw + badge) / 2 + badge;
    const by = (figure ? y + h - SIZE * 1.4 - lift : y - h) - 12;
    if (figure) {
      const cx = bx - 2 - BADGE / 2;
      const cy = by + 3.5;
      if (icon) {
        ctx.drawImage(icon, cx - BADGE / 2, cy - BADGE / 2, BADGE, BADGE);
      } else {
        // Chưa có icon hệ của PixelLab: họa tiết hệ trên nền tròn tối.
        ctx.fillStyle = "rgba(20, 17, 15, 0.8)";
        ctx.beginPath();
        ctx.arc(cx, cy, BADGE / 2 + 1, 0, Math.PI * 2);
        ctx.fill();
        drawMotif(ctx, u.element, cx, cy, BADGE / 2, 0, 1);
      }
    }
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.fillRect(bx - 1, by - 1, bw + 2, 9);
    // Viền thanh máu màu đội, cùng màu vòng chân.
    ctx.strokeStyle = TEAM_RING[u.team];
    ctx.lineWidth = 1;
    ctx.strokeRect(bx - 1.5, by - 1.5, bw + 3, 10);
    ctx.fillStyle = HP;
    ctx.fillRect(bx, by, (bw * ut.hp.step(t)) / u.hpMax, 4);
    ctx.fillStyle = MANA;
    ctx.fillRect(bx, by + 5, (bw * ut.mana.rising(t)) / u.manaMax, 2);
  }

  /** Số sát thương và hồi máu bay lên rồi mờ đi. */
  private drawNumbers(ctx: CanvasRenderingContext2D, index: ReplayIndex, t: number, life: number): void {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(0, 0, 0, 0.75)";
    for (const e of between(index.hits, t - life, t)) {
      const ut = index.byId.get(e.unit);
      if (!ut) continue;
      const age = (t - e.tick) / life;
      const p = this.place(ut.pos.step(e.tick), this.lat(e.unit));
      // Nhiều đòn cùng lúc vào một người thì lệch ngang theo người đánh để khỏi đè nhau.
      const x = p.x + (((e.src * 37) % 25) - 12);
      const y = p.y - SIZE / 2 - 18 - age * 34;
      let text = String(e.amount);
      let color = "#fbf6ec";
      let size = 13;
      let tip = "";
      if (e.kind === "heal") {
        text = "+" + e.amount;
        color = HP;
      } else if (e.crit) {
        text = e.amount + "!";
        color = "#ffd34d";
        size = 17;
      } else if (e.counter) {
        // Đòn khắc hệ: số cam, to hơn; vài đòn đầu trận kèm nhãn để người mới thấy khắc chế hoạt động.
        color = COUNTER_COLOR;
        size = 16;
        if (this.counterTips.has(e)) tip = tr("Khắc ×1,5");
      }
      ctx.globalAlpha = 1 - age * age;
      ctx.font = `bold ${size}px ${FONT_TEXT}`;
      ctx.strokeText(text, x, y);
      ctx.fillStyle = color;
      ctx.fillText(text, x, y);
      if (tip) {
        ctx.font = `bold 10px ${FONT_TEXT}`;
        ctx.strokeText(tip, x, y - size + 2);
        ctx.fillText(tip, x, y - size + 2);
      }
    }
    ctx.globalAlpha = 1;
  }

  /**
   * Số người còn đứng mỗi bên, và kết quả khi hết trận (kèm nút Tiếp tục khi trận mở cho người chơi). Vẽ theo toạ độ
   * màn hình. Tên hai bên lấy từ replay.teams, không có thì "Ta"/"Địch" theo replay.viewer, không có nữa thì "Đội A"/"Đội B".
   */
  private drawScore(v: View, index: ReplayIndex, t: number, player: ReplayPlayer): void {
    const ctx = v.ctx;
    const r = index.replay;
    const names = (r.teams ?? (r.viewer === undefined ? ["Đội A", "Đội B"] : r.viewer === 0 ? ["Ta", "Địch"] : ["Địch", "Ta"])).map(tr);
    ctx.setTransform(v.dpr, 0, 0, v.dpr, 0, 0);
    ctx.textBaseline = "top";
    ctx.textAlign = "center";
    ctx.font = `bold 14px ${FONT_TEXT}`;
    ctx.fillStyle = "#efe6d6";
    const score = `${names[0]} ${index.alive(0, t)}  ·  ${index.alive(1, t)} ${names[1]}`;
    // Tên tông môn dài không vừa khoảng giữa hai bên thanh trên (nút Quay lại ở góc phải): hạ xuống dưới thanh, vẫn dài thì thu chữ.
    let sy = 8;
    const sw = ctx.measureText(score).width;
    if (sw > v.w - 2 * SCORE_SIDE) {
      sy = 50;
      const room = v.w - 24;
      if (sw > room) ctx.font = `bold ${Math.max(10, Math.floor((14 * room) / sw))}px ${FONT_TEXT}`;
    }
    ctx.fillText(score, v.w / 2, sy);
    const mid = (v.h - v.bottom) / 2;
    const ended = t >= r.ticks && !player.playing;
    this.controls.ended(ended ? mid + 30 : null);
    if (!ended) return;
    const w = r.winner;
    const won = w !== "draw" && r.viewer !== undefined ? (w === "A") === (r.viewer === 0) : undefined;
    const text = w === "draw" ? tr("Hoà") : won !== undefined ? tr(won ? "Thắng" : "Thua") : tr(`${w === "A" ? names[0] : names[1]} thắng`);
    ctx.font = `bold 32px ${FONT_DISPLAY}`;
    ctx.textBaseline = "middle";
    ctx.lineWidth = 6;
    ctx.strokeStyle = "rgba(0, 0, 0, 0.7)";
    ctx.strokeText(text, v.w / 2, mid);
    ctx.fillStyle = won === false ? "#e8e0d2" : "#ffd34d";
    ctx.fillText(text, v.w / 2, mid);
  }
}

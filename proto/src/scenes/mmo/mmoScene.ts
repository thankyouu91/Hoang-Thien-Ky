// Bản MMORPG chơi được (index.html): thế giới là dải khu nối nhau, nhìn 3/4 từ trên, nền vẽ sẵn chien_truong/<vùng>/<khu>.
// Dùng lại trọn màn bãi quái (BaiScene: đi, đánh, chiêu, bot); thêm ở đây: qua khu ở hai mép, cấp và tu vi, linh thạch,
// bình máu, tiệm và truyền tống ở khu an toàn, nhiệm vụ nối tiếp, treo auto, phím tắt, lưu vào localStorage.
// Người chơi khác là bot trong trình duyệt (người dùng chốt 2026-11-09); người thật để tới MVP có máy chủ.
import type { Sprites } from "../../assets/sprites.ts";
import type { View } from "../../app/view.ts";
import { ATTRIBUTES, layerBonus, TECHNIQUE_LAYERS } from "@htk/rules";
import { BATTLE, type SkillType } from "@htk/sim";
import type { ElementId } from "../../replay/types.ts";
import { ELEMENT_STYLE, SKILL_NAME } from "../../theme/elements.ts";
import { FONT_DISPLAY, FONT_TEXT, loadCanvasFonts } from "../../theme/fonts.ts";
import { Bai } from "../bai/bai.ts";
import { BaiScene, LOOKS } from "../bai/baiScene.ts";
import { resolveLook } from "../battle/character.ts";
import { dangFor, drawDang } from "../battle/dangDung.ts";
import { phapLuanExtent, trackLevel, type PhapLuanSpec } from "../battle/phapLuan.ts";
import { BAI } from "../bai/thamSo.ts";
import { ACT_LABEL, bayTuDong, bossTuDong, choVao, macDinh, mapId, SCALE, type MapKhu } from "./mapKhu.ts";
import { camLop, O_DIR, veLop, type BoODat } from "./oDat.ts";
import {
  PASSIVE, PASSIVE_NAME, passiveOf, passives, type PassiveKey, AFK, afkHarvest, afkPending, eventIn, eventOn, EVENTS, title, TOWER, towerGold, towerKill, towerZone, type EventId, buySect, combine, donateOre, NGO, oreCount, scrollCount, SECT_SHOP, sectDone, sectLevel, sectLife, submitOre, buyPhu, mineHolder, phuItem, phuPrice, teleport, BAG_MAX, consume, equip, MANA_HEAL, pickUp, potItem, RARITY, rollDrop, sell, sellPrice, unequip, type ItemInstance, type ItemStats,
  addStat, atkOf, buyPot, checkIn, claimMail, clearSlot, donate, joinSect, kill, leaveSect, mails, RANKS, rankOf, realm, SECT, sectKill, sectKills, SECTS, SIT, learned, setSlot, SKILL_UNLOCK, slotsOf, layerOf, layerPrice, resetSkills, resetStats, skillPoints, statPoints, statResetCost, stats, upSkill, newSave, POT_HEAL, potPrice, questText, REGIONS, townOf, upgrade, wpnPrice, xpNeed, zone, ZONE_COUNT,
  type Save, type Zone,
} from "./tienTrinh.ts";

const SAVE_KEY = "htk.mmo.v1";
const POT_CD = 5;
const NAMES = ["Lạc Vân", "Tô Hàn", "Mạc Kỳ", "Diệp Thanh", "Hoa Ảnh", "Trần Phong", "Liễu Sương", "Minh Nguyệt", "Tử Sâm", "Hàn Liên", "Vô Song", "Cố Bắc"];
/** Hình trong assets/: icon_ve/ là icon vẽ (.webp); còn lại mặc định ở pixellab/, đường dẫn bắt đầu bằng freepixel/ thì ở assets/freepixel/. */
const ASSET = (p: string) => (p.startsWith("icon_ve/") ? `${import.meta.env.BASE_URL}${p}.webp` : `${import.meta.env.BASE_URL}${p.startsWith("freepixel/") ? "" : "pixellab/"}${p}.png`);

function load(): Save | null {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY) ?? "null") as Save | null;
    if (!s || s.v !== 1 || !(s.zone >= 0) || s.zone >= ZONE_COUNT) return null;
    // Bản lưu từ trước khi có túi đồ.
    s.bag ??= [];
    s.equips ??= {};
    return s;
  } catch {
    return null;
  }
}

export class MmoScene extends BaiScene {
  override readonly id: string = "choi";
  override readonly label: string = "Thế giới";
  private save: Save;
  private fresh: boolean;
  private entry: "left" | "right" | "mid" = "mid";
  /** Map của khu đang chơi */
  private map_: MapKhu | null = null;
  /** Bảng đang mở trong hộp thoại (tên hành động của act), "" khi đóng */
  private panel = "";
  /** Map tự thiết kế bằng app sửa map (sua_map.html), khóa theo tên file */
  private maps = new Map<string, MapKhu>();
  /** Bộ ô đất và tấm nền đã vẽ sẵn của từng map có lớp ô. */
  private bo: BoODat | null = null;
  private nenO = new WeakMap<MapKhu, HTMLCanvasElement>();
  private imgs = new Map<string, HTMLImageElement>();
  private keys = new Set<string>();
  private keyMove = false;
  private auto = false;
  private potAt = 0;
  private clock = 0;
  private notes: { text: string; at: number; big: boolean }[] = [];
  private dlg: HTMLDialogElement;
  private bar: HTMLElement;
  /** Khung trên màn hình (bản PC): nhân vật, nhiệm vụ, mục tiêu, menu, chú thích chiêu */
  private top: HTMLElement;
  private barKey = "";
  /** Sáu ô ra chiêu theo thứ tự ô (Q W E R T Y) */
  private slotBtns: HTMLButtonElement[] = [];
  /** Bảng Kỹ năng: ô ra chiêu và chiêu đang chọn */
  private selSlot = 0;
  /** Đang tọa thiền (hồi máu, mana); sitAt là mốc giờ trận lúc ngồi, bị đánh sau mốc này thì đứng dậy */
  private sit = false;
  private sitAt = 0;
  /** Nhật ký hệ thống góc dưới trái */
  private log: string[] = [];
  private selSkill: SkillType = BAI.skills[0];
  /** Đồ rơi trên đất của khu đang đứng: tọa độ thế giới, mốc giờ rơi, pull = đang bị hút về người chơi */
  private loot: { x: number; y: number; item: ItemInstance; at: number; pull: boolean }[] = [];
  /** Bảng Túi: thẻ đang xem và món đang chọn */
  private bagTab = "all";
  private selItem = "";
  private fullAt = -9;
  /** Mốc giờ được ra chiêu kế khi treo auto */
  private autoAt = 0;
  /** Bảng Tông môn: thẻ đang xem */
  private sectTab = "dai_dien";
  /** Bảng Bản đồ: vùng đang xem ở tầng 2, null là tầng 1 (cả thế giới) */
  private mapRegion: number | null = null;
  /** Khu đang tự chạy tới (bấm trên bản đồ), null khi không; routeX, routeAt để phát hiện kẹt */
  private route: number | null = null;
  private routeX = 0;
  private routeAt = 0;

  constructor(sprites: Sprites) {
    super(sprites);
    const s = load();
    this.fresh = !s;
    this.save = s ?? newSave("Vô Danh", "moc");
    // ?khu=<số>: vào thẳng một khu để chơi thử map vừa sửa.
    const khu = new URLSearchParams(location.search).get("khu");
    if (khu !== null && Number(khu) >= 0 && Number(khu) < ZONE_COUNT) {
      this.save.zone = Math.floor(Number(khu));
      this.fresh = false;
    }
    this.camera.minZoom = 0.2;
    this.camera.maxZoom = 2.2;
    this.bar = document.createElement("div");
    this.bar.className = "mmo-bar";
    const B = import.meta.env.BASE_URL;
    this.bar.innerHTML = `<div class="mmo-items"><button type="button" data-a="pot" title="Bình máu" style="background-image:url(${B}icon_ve/dan/dan_duoc_hoi_mau.webp)"><kbd>1</kbd><small></small></button><button type="button" data-a="mana" title="Hồi Linh Đan" style="background-image:url(${B}icon_ve/dan/dan_duoc_hoi_mana.webp)"><kbd>2</kbd><small></small></button>${[3, 4, 5, 6].map((n) => `<button type="button" disabled><kbd>${n}</kbd></button>`).join("")}</div>
      <div class="bai-bar xp"><i></i><span></span></div>`;
    this.hud.prepend(this.bar);
    this.hud.classList.add("mmo-hud");
    this.bar.classList.add("mmo-ui");
    const base = import.meta.env.BASE_URL;
    this.hud.querySelector<HTMLElement>("[data-ult]")!.style.backgroundImage = `url(${base}icon_ve/chieu/tran_phap.webp)`;
    this.hud.addEventListener("mouseover", (e) => this.tip((e.target as HTMLElement).closest<HTMLElement>(".bai-skills button")));
    this.hud.addEventListener("mouseleave", () => this.tip(null));
    // Bố cục theo mẫu người dùng gửi 2026-11-11: khung nhân vật trên trái, mục tiêu trên giữa, menu dọc dưới bản đồ nhỏ.
    this.top = document.createElement("div");
    this.top.className = "mmo-top mmo-ui";
    this.top.innerHTML = `<div class="mmo-me"><i class="mmo-face"><em class="mmo-lv"></em></i><div><span><b class="mmo-name"></b> <small class="mmo-realm"></small></span>
      <div class="bai-bar hp"><i></i><span></span></div><div class="bai-bar mp"><i></i><span></span></div><div class="bai-bar xp"><i></i><span></span></div><span class="mmo-coin"></span></div></div>
      <div class="mmo-quest"></div>
      <div class="mmo-map"><header><b></b><em></em></header><i></i><footer></footer></div>
      <nav class="mmo-quick">${QUICK.map(([a, k, t, img]) => `<button type="button" data-a="${a}" title="${t} (${k})"><i ${img.includes("/") ? `style="background-image:url(${B}icon_ve/${img}.webp)"` : ""}>${img.includes("/") ? "" : img}</i><span>${t}</span></button>`).join("")}</nav>
      <nav class="mmo-act">${ACTS.map(([a, k, t, g]) => `<button type="button" data-a="${a}" title="${t} (${k})"><i>${g}</i><span>${t}</span></button>`).join("")}</nav>
      <div class="mmo-log"></div>
      <div class="mmo-tgt" hidden><b></b><div class="bai-bar hp"><i></i><span></span></div></div>
      <nav class="mmo-menu" hidden>${MENU.map(([a, k, t]) => `<button type="button" data-a="${a}"><kbd>${k}</kbd>${t}</button>`).join("")}</nav>
      <div class="mmo-tip" hidden></div>`;
    document.body.append(this.top);
    this.top.addEventListener("click", (e) => {
      const a = (e.target as HTMLElement).closest<HTMLButtonElement>("button")?.dataset.a;
      if (!a) return;
      this.menu(false);
      this.act(a);
    });
    // Ô chiêu thứ sáu (phím Y) đứng trước ô chiêu cuối (U); nhãn phím theo thứ tự ô. Nút Menu gộp các bảng, đứng cạnh thanh chiêu.
    this.hud.querySelector("[data-ult]")!.insertAdjacentHTML("beforebegin", `<button type="button" disabled class="extra"><b></b><small></small></button>`);
    this.hud.querySelectorAll(".bai-skills button").forEach((btn, i) => btn.insertAdjacentHTML("afterbegin", `<kbd>${KEYS[i].toUpperCase()}</kbd>`));
    this.slotBtns = [...this.hud.querySelectorAll<HTMLButtonElement>(".bai-skills button:not([data-ult])")];
    this.hud.insertAdjacentHTML("beforeend", `<button type="button" class="mmo-more" data-more title="Menu"><i></i><small>Menu</small></button>`);
    this.hud.addEventListener("click", (e) => {
      if ((e.target as HTMLElement).closest("[data-more]")) this.menu();
    });
    document.addEventListener("pointerdown", (e) => {
      if (!(e.target as HTMLElement).closest(".mmo-menu, [data-more]")) this.menu(false);
    });
    this.bar.addEventListener("click", (e) => {
      const a = (e.target as HTMLElement).closest<HTMLButtonElement>("button")?.dataset.a;
      if (a) this.act(a);
    });
    this.dlg = document.createElement("dialog");
    this.dlg.className = "mmo-dlg";
    document.body.append(this.dlg);
    this.dlg.addEventListener("click", (e) => this.dlgClick(e));
    this.dlg.addEventListener("close", () => (this.panel = ""));
    window.addEventListener("keydown", (e) => this.key(e, true));
    window.addEventListener("keyup", (e) => this.key(e, false));
    window.addEventListener("blur", () => this.keys.clear());
    void loadCanvasFonts();
    void this.loadMaps();
  }

  override enter(v: View): void {
    super.enter(v);
    // Nền giữ độ nét của bãi mẫu (zoom bãi mẫu chia SCALE), nên người trên màn hình còn 40%; lăn chuột hay chụm tay để đổi.
    this.camera.zoom = Math.max(0.6, Math.min(1.3, v.w / 520)) / SCALE;
    this.follow(1);
    if (this.fresh) this.intro();
    else this.note(zone(this.save.zone).name, true);
  }

  // ---------- Khu ----------

  private mapOf(z: Zone): MapKhu {
    return this.maps.get(mapId(z.bg)) ?? macDinh(z);
  }

  /**
   * Nạp các map tự thiết kế (assets/map_khu/, danh sách ở index.json do app sửa map ghi) một lần lúc mở game;
   * khu đang đứng có map riêng thì dựng lại khu. Lỗi mạng hay file hỏng: bỏ qua, dùng map mặc định.
   */
  private async loadMaps(): Promise<void> {
    const get = (name: string) => fetch(`${import.meta.env.BASE_URL}map_khu/${name}.json`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    const ids = ((await get("index")) as string[] | null) ?? [];
    this.bo = (await fetch(`${import.meta.env.BASE_URL}pixellab/${O_DIR}bo.json`).then((r) => (r.ok ? r.json() : null)).catch(() => null)) as BoODat | null;
    const bo = this.bo;
    await Promise.all(ids.map(async (id) => {
      const m = (await get(id)) as MapKhu | null;
      if (!m || !(m.w > 0) || !(m.h > 0)) return;
      const o = bo && m.o ? m.o : undefined;
      // Nước trong lớp ô thành vùng cấm ngay lúc nạp, để mọi chỗ dùng m.cam (đi lại, rải bầy, cửa vào) đều thấy.
      this.maps.set(id, { ...m, nen: m.nen ?? [], vat: m.vat ?? [], bay: m.bay ?? [], cam: [...(m.cam ?? []), ...(o ? camLop(o, bo!) : [])], o });
    }));
    if (this.bai && this.maps.has(mapId(zone(this.save.zone).bg))) this.go(this.save.zone, this.entry);
  }

  protected override makeBai(): Bai {
    const s = this.save;
    const z = zone(s.zone);
    const m = this.mapOf(z);
    this.map_ = m;
    const b = new Bai(s.lv, s.element, s.zone + 1, {
      w: m.w, h: m.h, monsterLevel: z.level, hp: stats(s).hp, atk: stats(s).atk, boss: z.boss, blocked: m.cam,
      homes: z.safe ? [] : m.bay.length > 0 ? m.bay : z.boss ? undefined : bayTuDong(m),
      bosses: z.safe || z.boss ? [] : bossTuDong(m),
      entry: choVao(m, this.entry === "left" ? 70 : this.entry === "right" ? m.w - 70 : m.w / 2),
      // Mỗi khu một nhóm tên khác nhau.
      bots: Array.from({ length: z.boss ? 2 : 8 }, (_, i) => NAMES[(s.zone * 5 + i) % NAMES.length]),
      elements: [z.element],
    });
    b.player.name = s.name;
    this.applyStats(b, true);
    b.auto = this.auto && !z.safe;
    b.onKill = (m) => this.onKill(b, z, m);
    this.loot = [];
    for (const h of [...m.nen, ...m.vat]) this.img(h.file);
    if (m.o) for (const t of this.bo!.bo) this.img(O_DIR + t.f);
    return b;
  }

  private go(idx: number, entry: "left" | "right" | "mid"): void {
    const old = this.bai?.player;
    const ratio = old && old.alive ? old.hp / old.hpMax : 1;
    const s = this.save;
    s.zone = idx;
    s.maxZone = Math.max(s.maxZone, idx);
    this.entry = entry;
    this.bai = this.makeBai();
    const z = zone(idx);
    // Vào khu an toàn thì hồi đầy máu.
    this.bai.player.hp = Math.max(1, Math.round(this.bai.player.hpMax * (z.safe ? 1 : ratio)));
    this.follow(1);
    this.persist();
    this.note(z.safe ? `${z.name} (an toàn)` : `${z.name} · dị thú cấp ${z.level}`, true);
  }

  private persist(): void {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.save));
    } catch {
      // Hết chỗ lưu hay chế độ riêng tư: vẫn chơi được, chỉ không giữ tiến độ.
    }
  }

  private onKill(b: Bai, z: Zone, m: { x: number; y: number; boss?: boolean }): void {
    const s = this.save;
    const r = kill(s, z);
    // Đồ văng ra quanh xác quái; nhặt ở pull().
    const thap = m.boss ? towerKill(s, z) : 0;
    if (thap) this.note(`Qua tầng ${s.thap} tháp Tầm Đạo: +${thap} linh thạch, danh hiệu ${title(s)}`, true);
    for (const item of rollDrop(z, !!m.boss, Math.random, z.boss && eventOn("bi_canh", nowMin()))) {
      const a = Math.random() * Math.PI * 2;
      const d = (20 + 20 * Math.random()) * SCALE;
      this.loot.push({ x: m.x + Math.cos(a) * d, y: m.y + Math.sin(a) * d * 0.6, item, at: this.clock, pull: false });
    }
    const cong = sectKill(s, today(), !!m.boss);
    if (cong) this.note(`Xong nhiệm vụ tông môn: +${cong} cống hiến`, true);
    if (r.quest) this.note(`Xong nhiệm vụ: +${r.quest.xp} tu vi, +${r.quest.gold} linh thạch`, true);
    if (r.levels > 0) {
      this.note(`Lên cấp ${s.lv}!`, true);
      this.applyStats(b, true);
    }
    this.persist();
  }

  /** Hút đồ rơi về phía người chơi rồi nhặt: tự hút khi lại gần (PICK_R); treo auto hoặc phím Cách thì hút cả khu. */
  private pull(b: Bai, dt: number): void {
    const p = b.player;
    const s = this.save;
    let got = false;
    this.loot = this.loot.filter((l) => {
      const age = this.clock - l.at;
      if (age > LOOT_TTL) return false;
      const d = Math.hypot(p.x - l.x, p.y - l.y);
      // Nửa giây đầu nằm yên cho người chơi thấy đồ rơi.
      if (age < 0.5 || (!l.pull && !b.auto && d > PICK_R)) return true;
      if (d > 30) {
        const v = Math.min(d, LOOT_SPEED * dt);
        l.x += ((p.x - l.x) / d) * v;
        l.y += ((p.y - l.y) / d) * v;
        return true;
      }
      const it = l.item;
      if (!pickUp(s, it)) {
        l.pull = false;
        if (this.clock - this.fullAt > 5) {
          this.fullAt = this.clock;
          this.note("Túi đầy: bán bớt đồ trong túi (I)");
        }
        return true;
      }
      got = true;
      this.note(it.type === "linh_thach" ? `+${it.count} linh thạch` : `Nhặt: ${it.name}${it.count > 1 ? ` ×${it.count}` : ""}`, false, it.type !== "trang_bi" && it.type !== "tan_quyen");
      return false;
    });
    if (got) this.persist();
  }

  private applyStats(b: Bai, heal: boolean): void {
    const s = this.save;
    const p = b.player;
    const st = stats(s);
    b.level = s.lv;
    p.hpMax = st.hp;
    p.atk = st.atk;
    b.manaMax = Math.round((BATTLE.manaMax * st.manaMul) / 1000);
    b.mana = Math.min(b.mana, b.manaMax);
    b.mod = st;
    b.skillBonus = (k) => layerBonus(layerOf(this.save, k));
    p.hp = heal ? p.hpMax : Math.min(p.hp, p.hpMax);
    this.barKey = "";
    this.syncSlots();
  }

  /** Đưa chiêu đã xếp (slotsOf) lên sáu ô ra chiêu: BaiScene đọc chiêu của ô từ data-s. */
  private syncSlots(): void {
    const sl = slotsOf(this.save);
    this.slotBtns.forEach((btn, i) => {
      const sk = sl[i];
      if (sk) btn.dataset.s = sk;
      else delete btn.dataset.s;
      btn.style.backgroundImage = sk ? `url(${import.meta.env.BASE_URL}icon_ve/chieu/${sk}.webp)` : "none";
      btn.querySelector("b")!.textContent = sk ? SKILL_NAME[sk] : "";
      if (sk) return;
      btn.querySelector("small")!.textContent = "";
      btn.disabled = true;
    });
  }

  /** Mở hay đóng menu bật lên từ nút Menu cạnh thanh chiêu. */
  private menu(show?: boolean): void {
    const m = this.top.querySelector<HTMLElement>(".mmo-menu")!;
    m.hidden = !(show ?? m.hidden);
    if (m.hidden) return;
    const r = this.hud.querySelector(".mmo-more")!.getBoundingClientRect();
    m.style.right = `${Math.max(8, innerWidth - r.right)}px`;
    m.style.bottom = `${innerHeight - r.top + 8}px`;
  }

  // ---------- Vòng chơi ----------

  override update(dt: number): void {
    const b = this.bai;
    if (!b) return;
    this.clock += dt;
    if (!this.dlg.open) {
      const k = this.keys;
      // Chỉ phím mũi tên: Q W E R T là phím chiêu (người dùng chốt 2026-11-10), nên bỏ W A S D.
      const dx = (k.has("arrowright") ? 1 : 0) - (k.has("arrowleft") ? 1 : 0);
      const dy = (k.has("arrowdown") ? 1 : 0) - (k.has("arrowup") ? 1 : 0);
      const p0 = b.player;
      if (this.sit) {
        // Đi, đánh hay bị đánh thì đứng dậy; còn ngồi thì hồi máu và mana.
        if (dx || dy || p0.goal || p0.target !== null || !p0.alive || p0.hurtAt > this.sitAt) this.sit = false;
        else {
          p0.hp = Math.min(p0.hpMax, p0.hp + p0.hpMax * SIT.hp * dt);
          b.mana = Math.min(b.manaMax, b.mana + b.manaMax * SIT.mana * dt);
        }
      }
      if (dx || dy) {
        this.route = null;
        b.moveTo(b.player.x + dx * 90, b.player.y + dy * 90);
        this.keyMove = true;
      } else if (this.keyMove) {
        b.player.goal = null;
        this.keyMove = false;
      }
    }
    this.run(b);
    this.autoCast(b);
    // Tự uống khi gần cạn (người dùng chốt 2026-11-11), kể cả khi không treo auto: bình máu có hồi chiêu POT_CD, đan mana thì không.
    if (!this.dlg.open && b.player.alive) {
      if (b.player.hp < b.player.hpMax * AUTO_POT.hp) this.act("pot");
      if (b.mana < b.manaMax * AUTO_POT.mana) this.act("mana");
    }
    super.update(dt);
    const p = b.player;
    if (!p.alive) return;
    this.pull(b, dt);
    for (const btn of this.slotBtns) {
      const sk = btn.dataset.s as SkillType | undefined;
      if (sk) btn.style.setProperty("--cd", (b.cooldown(sk) / b.cooldownOf(sk)).toFixed(3));
    }
    if (p.x <= 6 && this.save.zone > 0) this.go(this.save.zone - 1, "right");
    else if (p.x >= b.w - 6 && this.save.zone < ZONE_COUNT - 1) this.go(this.save.zone + 1, "left");
    this.syncBar(b);
  }

  /**
   * Tự chạy tới khu this.route: thế giới là một dải khu nên chỉ cần đi tới mép trái hay phải, sang khu thì đi tiếp.
   * shortcut: đi thẳng tới cửa, không tìm đường vòng; đứng yên 4 giây (kẹt vùng cấm của map tự thiết kế) thì dừng. Thêm tìm đường khi map có mê cung.
   */
  private run(b: Bai): void {
    const to = this.route;
    if (to === null) return;
    const p = b.player;
    const zi = this.save.zone;
    if (zi === to || !p.alive) {
      if (zi === to) this.note(`Đã tới ${zone(to).name}`);
      this.route = null;
      p.goal = null;
      return;
    }
    if (Math.abs(p.x - this.routeX) > 20) {
      this.routeX = p.x;
      this.routeAt = this.clock;
    } else if (this.clock - this.routeAt > 4) {
      this.route = null;
      this.note("Bị chặn đường, dừng tự chạy");
      return;
    }
    const x = to > zi ? b.w : 0;
    p.target = null;
    b.moveTo(x, choVao(this.map_!, x + (to > zi ? -70 : 70)).y);
  }

  /**
   * Treo auto thì tự ra chiêu ngoài đánh thường (người dùng chốt 2026-11-11): mỗi AUTO_GAP giây thử một chiêu theo thứ tự ô.
   * Chiêu đánh chỉ ra khi đang có mục tiêu; hồi phục khi máu dưới 60%, hộ thể khi máu dưới 80% và chưa có khiên; chiêu cuối khi đầy. Chiêu đánh chừa AUTO_KEEP mana cho hai chiêu thủ.
   */
  private autoCast(b: Bai): void {
    const p = b.player;
    if (!b.auto || !p.alive || this.clock < this.autoAt) return;
    const hp = p.hp / p.hpMax;
    const fight = b.get(p.target)?.alive === true;
    const ok = (sk: SkillType) => (sk === "hoi_phuc" ? hp < 0.6 : sk === "ho_the" ? fight && hp < 0.8 && p.shield <= 0 : fight && b.mana - b.manaCost(sk) >= b.manaMax * AUTO_KEEP);
    if ((fight && b.castUlt()) || slotsOf(this.save).some((sk) => sk !== null && ok(sk) && b.cast(sk))) this.autoAt = this.clock + AUTO_GAP;
  }

  private key(e: KeyboardEvent, down: boolean): void {
    if ((e.target as HTMLElement).tagName === "INPUT" || e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.toLowerCase();
    // Phím bảng (I túi, P nhân vật, O kỹ năng): nhấn lại để đóng, nhấn phím khác để đổi bảng.
    const panel = PANELS[k];
    if (down && panel && !e.repeat && !this.fresh && this.bai) {
      if (this.dlg.open && this.panel === panel) this.dlg.close();
      else this.act(panel);
      return;
    }
    if (this.dlg.open) return;
    if (!down) {
      this.keys.delete(k);
      return;
    }
    this.keys.add(k);
    if (e.repeat) return;
    const b = this.bai;
    if (!b) return;
    // Chiêu theo hàng Q W E R T Y, chiêu cuối U; hàng số 1–6 là ô vật phẩm (1 bình máu, 2 Hồi Linh Đan). Người dùng chốt 2026-11-11.
    const i = k.length !== 1 ? -1 : KEYS.indexOf(k);
    const sk = i < 0 || i === ULT_KEY ? null : slotsOf(this.save)[i < ULT_KEY ? i : i - 1];
    if (sk) b.cast(sk);
    else if (i === ULT_KEY) b.castUlt();
    else if (k === "1") this.act("pot");
    else if (k === "2") this.act("mana");
    else if (k === "x") this.act("sit");
    else if (k === "f") this.act("auto");
    else if (k === "m") this.act("map");
    else if (k === "b") this.act("shop");
    else if (k === " ") {
      e.preventDefault();
      for (const l of this.loot) l.pull = true;
      const p = b.player;
      const near = b.actors
        .filter((a) => a.kind === "monster" && a.alive)
        .sort((x, y) => Math.hypot(x.x - p.x, x.y - p.y) - Math.hypot(y.x - p.x, y.y - p.y))[0];
      if (near && Math.hypot(near.x - p.x, near.y - p.y) < 420) b.attack(near.id);
    }
  }

  private act(a: string): void {
    const b = this.bai;
    if (!b) return;
    const s = this.save;
    const z = zone(s.zone);
    if (a === "pot") {
      const p = b.player;
      if (!p.alive || s.pots <= 0 || this.clock < this.potAt || p.hp >= p.hpMax) return;
      s.pots--;
      this.potAt = this.clock + POT_CD;
      const v = Math.round(Math.min(p.hpMax * POT_HEAL, p.hpMax - p.hp));
      p.hp += v;
      b.fx.push({ t: b.t, x: p.x, y: p.y, el: p.element, kind: "heal", amount: v });
      this.persist();
    } else if (a === "mana") {
      const it = s.bag.find((x) => x.code === "hoi_linh_dan");
      if (it && b.player.alive && b.mana < b.manaMax && consume(s, it.id)) {
        b.mana = Math.min(b.manaMax, b.mana + b.manaMax * MANA_HEAL);
        this.persist();
      }
    } else if (a === "auto") {
      this.auto = !this.auto;
      b.auto = this.auto && !z.safe;
      if (!this.auto) b.player.target = null;
      this.note(this.auto ? "Treo auto: bật" : "Treo auto: tắt");
    } else if (a === "shop") {
      if (z.safe) this.shop();
      else this.note("Tiệm chỉ mở ở sơn môn và bến đò");
    } else if (a === "map") {
      if (this.panel !== "map") this.mapRegion = null;
      this.map();
    }
    else if (a === "help") this.help();
    else if (a === "sit") {
      const p = b.player;
      if (this.sit) this.sit = false;
      else if (this.auto) this.note("Tắt treo auto (F) rồi mới tọa thiền được");
      else if (p.alive) {
        p.goal = null;
        p.target = null;
        this.sit = true;
        this.sitAt = b.t;
        this.note("Tọa thiền: hồi máu và mana. Đi hay bị đánh thì đứng dậy.");
      }
    } else if (a === "sect") this.sect();
    else if (a === "ally") this.ally();
    else if (a === "event") this.event();
    else if (a === "mail") this.mail();
    else if (a === "bag") this.bag();
    else if (a === "char") this.char();
    else if (a === "skills") this.skills();
    if (this.dlg.open) this.panel = a;
  }

  private syncBar(b: Bai): void {
    const s = this.save;
    const p = b.player;
    const need = xpNeed(s.lv);
    const cd = Math.ceil(this.potAt - this.clock);
    const t = b.get(p.target);
    const tgt = t?.alive && t.kind === "monster" ? t : null;
    const mw = Math.min(150, (this.view?.w ?? 1280) * 0.3);
    const mh = Math.round((mw * b.h) / b.w);
    const day = today();
    const newMail = mails(s).filter((m) => !m.claimed).length;
    const pills = s.bag.find((x) => x.code === "hoi_linh_dan")?.count ?? 0;
    const key = [pills, mw, mh, this.sit, newMail, s.sect?.id, sectKills(s, day), s.lv, s.xp, s.pots, cd, this.auto, s.zone, s.gold, s.quest.n, s.name, Math.round(p.hp), p.hpMax, Math.floor(b.mana), b.manaMax, p.alive, tgt?.id, tgt && Math.round(tgt.hp)].join("|");
    if (key === this.barKey) return;
    this.barKey = key;
    const all = (sel: string) => document.querySelectorAll<HTMLElement>(sel);
    const bar = (sel: string, a: number, n: number, text: string) =>
      all(sel).forEach((el) => {
        const w = `${Math.max(0, Math.min(100, (100 * a) / n))}%`;
        (el.firstElementChild as HTMLElement).style.width = w;
        el.style.setProperty("--w", w); // vệt máu vừa mất chạy theo sau (mmo.css)
        el.lastElementChild!.textContent = text;
      });
    bar(".mmo-ui .xp", s.xp, need, `Tu vi ${s.xp}/${need}`);
    bar(".mmo-me .hp", p.hp, p.hpMax, `${Math.round(p.hp)}/${p.hpMax}`);
    bar(".mmo-me .mp", b.mana, b.manaMax, `${Math.floor(b.mana)}/${b.manaMax}`);
    const q = (sel: string) => this.top.querySelector<HTMLElement>(sel)!;
    q(".mmo-name").textContent = s.name;
    q(".mmo-lv").textContent = String(s.lv);
    q(".mmo-face").style.backgroundImage = `url(${import.meta.env.BASE_URL}icon_ve/he/${s.element}.webp)`;
    q(".mmo-coin").textContent = `Linh thạch ${s.gold}`;
    q(".mmo-realm").textContent = realm(s.lv);
    const z = zone(s.zone);
    const state = this.sit ? "<em>Đang tọa thiền (X)</em>" : this.auto ? "<em>Đang treo auto (F)</em>" : "";
    const sectTask = s.sect ? `<span>Tông môn: diệt ${Math.min(sectKills(s, day), SECT.taskKills)}/${SECT.taskKills} dị thú hôm nay</span>` : "";
    q(".mmo-quest").innerHTML = `<b>Nhiệm vụ</b><span>${questText(s)}</span>${sectTask}${state}`;
    // Khung bản đồ nhỏ: canvas vẽ các chấm vào đúng khoảng trống giữa tiêu đề và chân khung (MAP_Y).
    const map = q(".mmo-map");
    map.style.width = `${mw + 6}px`;
    (map.children[1] as HTMLElement).style.height = `${mh + 4}px`;
    map.querySelector("b")!.textContent = z.name;
    const tag = map.querySelector("em")!;
    tag.textContent = z.safe ? "An toàn" : z.boss ? "Bí cảnh" : "Nguy hiểm";
    tag.className = z.safe ? "safe" : z.boss ? "boss" : "";
    map.querySelector("footer")!.textContent = z.safe ? `Khu ${(z.idx % 9) + 1}/9 · có tiệm và truyền tống` : `Khu ${(z.idx % 9) + 1}/9 · dị thú cấp ${z.level}`;
    q(".mmo-act").style.top = `${MAP_Y + mh + 30}px`;
    q('.mmo-quick [data-a="char"] i').style.backgroundImage = `url(${import.meta.env.BASE_URL}icon_ve/he/${s.element}.webp)`;
    all('.mmo-top [data-a="mail"]').forEach((el) => el.classList.toggle("dot", newMail > 0));
    all('.mmo-top [data-a="sit"]').forEach((el) => el.classList.toggle("on", this.sit));
    all('.mmo-top [data-a="auto"]').forEach((el) => el.classList.toggle("on", this.auto));
    all('.mmo-top [data-a="shop"]').forEach((el) => ((el as HTMLButtonElement).disabled = !z.safe));
    const tg = q(".mmo-tgt");
    tg.hidden = !tgt;
    if (tgt) {
      tg.firstElementChild!.textContent = `${tgt.name} · cấp ${b.mLevel}`;
      bar(".mmo-tgt .hp", tgt.hp, tgt.hpMax, "");
    }
    const pot = this.bar.querySelector<HTMLButtonElement>('[data-a="pot"]')!;
    pot.disabled = s.pots <= 0 || cd > 0 || !p.alive;
    pot.querySelector("small")!.textContent = cd > 0 ? `${cd}s` : `${s.pots}`;
    const pill = this.bar.querySelector<HTMLButtonElement>('[data-a="mana"]')!;
    pill.disabled = pills <= 0 || !p.alive;
    pill.querySelector("small")!.textContent = String(pills);
  }

  /** Bảng chú thích khi rê chuột lên một ô chiêu. */
  private tip(btn: HTMLElement | null): void {
    const t = this.top.querySelector<HTMLElement>(".mmo-tip")!;
    t.hidden = !btn || !this.bai;
    if (t.hidden) return;
    const sk = btn!.dataset.s as SkillType | undefined;
    t.innerHTML = sk ? this.skillInfo(sk) : btn!.dataset.ult === undefined ? `<b>Ô trống</b><span>Mở bảng Kỹ năng (O) để xếp chiêu vào ô này.</span>` : `<b>Chiêu cuối</b><span>Đánh mạnh mọi dị thú quanh mình khi thanh nội tại đầy.</span><span>Mở ở cấp ${BAI.ultLevel} · phím U</span>`;
    const r = btn!.getBoundingClientRect();
    t.style.left = `${r.left + r.width / 2}px`;
    t.style.bottom = `${innerHeight - r.top + 8}px`;
  }

  private skillInfo(sk: SkillType): string {
    const b = this.bai!;
    const l = layerOf(this.save, sk);
    const bo = layerBonus(l);
    return `<b>${SKILL_NAME[sk]}</b><em>Tầng ${l}/${TECHNIQUE_LAYERS}</em><span>${SKILL_DESC[sk] ?? ""}</span>
      <span>Mana ${b.manaCost(sk)} · Hồi chiêu ${b.cooldownOf(sk).toFixed(1)}s</span>
      <span>Uy lực +${bo.uyLuc / 10}% · Mana −${bo.mana / 10}% · Hồi chiêu −${bo.hoiChieu / 10}%</span>
      <span>Bị động: ${PASSIVE_NAME[PASSIVE[sk][0]]} +${passiveOf(sk, l) / 10}%</span>`;
  }

  protected override statusLine(): string {
    const s = this.save;
    return `${zone(s.zone).name} · Linh thạch ${s.gold} · Vũ khí +${s.wpn} · NV: ${questText(s)}`;
  }

  // ---------- Vẽ ----------

  private img(file: string): HTMLImageElement {
    let i = this.imgs.get(file);
    if (!i) {
      i = new Image();
      i.src = ASSET(file);
      this.imgs.set(file, i);
    }
    return i;
  }

  private ready(file: string): HTMLImageElement | null {
    const i = this.img(file);
    return i.complete && i.naturalWidth > 0 ? i : null;
  }

  protected override ground(ctx: CanvasRenderingContext2D, b: Bai): void {
    const z = zone(this.save.zone);
    const m = this.map_!;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#39422c";
    ctx.fillRect(0, 0, b.w, b.h);
    const hinh = (h: MapKhu["nen"][number]) => {
      const im = this.ready(h.file);
      if (!im) return;
      if (h.lat) {
        ctx.save();
        ctx.translate(h.x + h.w, h.y);
        ctx.scale(-1, 1);
        ctx.drawImage(im, 0, 0, h.w, h.h);
        ctx.restore();
      } else ctx.drawImage(im, h.x, h.y, h.w, h.h);
    };
    m.nen.forEach(hinh);
    if (m.o) {
      let cv = this.nenO.get(m) ?? null;
      if (!cv && (cv = veLop(m.o, this.bo!, (f) => this.ready(O_DIR + f)))) this.nenO.set(m, cv);
      if (cv) ctx.drawImage(cv, 0, 0, m.o.cot * m.o.co, m.o.hang * m.o.co);
    }
    m.vat.forEach(hinh);
    const pulse = 0.55 + 0.25 * Math.sin(this.clock * 3);
    const gate = (x: number, idx: number, dir: 1 | -1) => {
      if (idx < 0 || idx >= ZONE_COUNT) return;
      const mid = choVao(m, x - dir * 70).y;
      const g = ctx.createRadialGradient(x, mid, 4, x, mid, 150);
      g.addColorStop(0, `rgba(255, 236, 170, ${pulse})`);
      g.addColorStop(1, "rgba(255, 236, 170, 0)");
      ctx.fillStyle = g;
      ctx.fillRect(x - 150, 0, 300, b.h);
      const t = zone(idx);
      this.text(ctx, `${dir < 0 ? "◀ " : ""}${t.name}${t.safe ? "" : ` (cấp ${t.level})`}${dir > 0 ? " ▶" : ""}`, x - dir * 14, mid - 70, dir < 0 ? "left" : "right");
    };
    gate(0, z.idx - 1, -1);
    gate(b.w, z.idx + 1, 1);
    for (const h of m.vat) if (h.act) this.text(ctx, ACT_LABEL[h.act], h.x + h.w / 2, h.y + h.h + 24, "center");
    // Đồ rơi: cột sáng màu phẩm chất và icon nhỏ, cỡ giữ nguyên trên màn hình khi thu nhỏ.
    const k = 1 / Math.min(1, this.camera.zoom);
    ctx.imageSmoothingEnabled = true;
    for (const l of this.loot) {
      const c = RARITY[l.item.rarity][1];
      const g = ctx.createLinearGradient(0, l.y, 0, l.y - 110 * k);
      g.addColorStop(0, c);
      g.addColorStop(1, `${c}00`);
      ctx.fillStyle = g;
      ctx.globalAlpha = 0.3;
      ctx.fillRect(l.x - 9 * k, l.y - 110 * k, 18 * k, 110 * k);
      ctx.globalAlpha = 0.9;
      ctx.fillRect(l.x - 2.5 * k, l.y - 110 * k, 5 * k, 110 * k);
      ctx.globalAlpha = 1;
      const im = this.ready(`icon_ve/${l.item.icon}`) ?? this.ready(`icon_ve/${FIRST(l.item.icon)}`);
      const sz = 24 * k;
      const y = l.y - sz / 2 + Math.sin(this.clock * 4 + l.x) * 2 * k;
      if (im) ctx.drawImage(im, l.x - sz / 2, y, sz, sz);
      else {
        ctx.fillStyle = c;
        ctx.fillRect(l.x - sz / 4, y + sz / 4, sz / 2, sz / 2);
      }
    }
    ctx.imageSmoothingEnabled = false;
  }

  private text(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, align: CanvasTextAlign): void {
    ctx.font = `700 ${15 / Math.min(1, this.camera.zoom)}px ${FONT_TEXT}`;
    ctx.textAlign = align;
    ctx.lineWidth = 4;
    ctx.strokeStyle = "rgba(20, 14, 8, 0.85)";
    ctx.strokeText(text, x, y);
    ctx.fillStyle = "#ffe9a8";
    ctx.fillText(text, x, y);
  }

  protected override tap(sx: number, sy: number): void {
    this.route = null;
    const d = this.down;
    if (this.map_ && d && this.view && Math.hypot(sx - d.x, sy - d.y) <= 10) {
      const p = this.camera.toWorld(sx, sy, this.view);
      const hit = this.map_.vat.find((h) => h.act && p.x >= h.x && p.x <= h.x + h.w && p.y >= h.y && p.y <= h.y + h.h + 36);
      if (hit?.act) {
        this.down = null;
        this.act(hit.act);
        return;
      }
    }
    super.tap(sx, sy);
  }

  /**
   * Sân Pháp tướng trong bảng Nhân vật, lấy từ màn Nhân vật của bản cũ (dashboard/screens/nhanVat.ts): nhân vật đứng thở,
   * pháp luân sau lưng theo hệ, chiêu ở ô đầu và cấp (phapLuan.ts: có từ Trúc Cơ, lớn dần theo cấp). Đạo đồ là ảnh nền trong HTML.
   */
  private drawStage(): void {
    const c = this.dlg.querySelector<HTMLCanvasElement>(".mmo-stage canvas");
    const look = resolveLook(this.sprites, LOOKS[0]);
    if (!c || !look) return;
    const w = c.clientWidth;
    const h = c.clientHeight;
    if (!w || !h) return;
    const dpr = Math.min(2, devicePixelRatio || 1);
    if (c.width !== w * dpr) {
      c.width = w * dpr;
      c.height = h * dpr;
    }
    const ctx = c.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.imageSmoothingEnabled = false;
    const s = this.save;
    const t = performance.now() / 1000;
    const spec: PhapLuanSpec = { element: s.element, type: slotsOf(s).find((k) => k !== null) ?? BAI.skills[0], grade: 1, level: s.lv };
    // Thu người cho vòng nằm gọn trong sân, như bản cũ (tâm vòng cao khoảng 43 px ảnh trên chân).
    const ext = phapLuanExtent(spec);
    const base = (h - 14) / 80;
    const scale = Math.min(base, Math.max(ext ? Math.min((w / 2 - 3) / ext, (h - 12) / (43 + ext)) : base, base * 0.7));
    ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
    ctx.beginPath();
    ctx.ellipse(w / 2, h - 10, w * 0.24, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    drawDang(ctx, this.sprites, look, dangFor(undefined), "dung", 0, t, w / 2, h - 10, scale, false, ELEMENT_STYLE[s.element].color, 0, { spec, beat: { clock: t, ...trackLevel(this, s.lv, t) } });
  }

  override draw(v: View): void {
    if (this.dlg.open && this.panel === "char") this.drawStage();
    // Hiệu ứng nền theo hệ của vùng (lá rơi ở rừng Mộc, tàn lửa ở núi Hỏa, tuyết, sương): phủ vùng đang nhìn.
    this.vfx.nenTheo(this.bai ? zone(this.save.zone).element : null, this.nhin(v));
    super.draw(v);
    const b = this.bai;
    if (!b) return;
    const ctx = v.ctx;
    ctx.setTransform(v.dpr, 0, 0, v.dpr, 0, 0);
    // Bản đồ nhỏ góc phải: chấm quái đỏ, người khác xanh, mình vàng.
    const mw = Math.min(150, v.w * 0.3);
    const mh = (mw * b.h) / b.w;
    const mx = v.w - mw - 8;
    ctx.fillStyle = "rgba(20, 14, 8, 0.6)";
    ctx.fillRect(mx - 2, MAP_Y - 2, mw + 4, mh + 4);
    for (const a of b.actors) {
      if (!a.alive) continue;
      ctx.fillStyle = a.kind === "monster" ? "#e0553f" : a.kind === "bot" ? "#9cc7e6" : "#ffd34d";
      const r = a.kind === "player" ? 3 : a.boss ? 4 : 2;
      ctx.fillRect(mx + (a.x / b.w) * mw - r / 2, MAP_Y + (a.y / b.h) * mh - r / 2, r, r);
    }
    // Thông báo: tên khu, lên cấp, nhặt đồ.
    this.notes = this.notes.filter((n) => this.clock - n.at < 3);
    ctx.textAlign = "center";
    this.notes.slice(-4).forEach((n, i) => {
      const age = this.clock - n.at;
      ctx.globalAlpha = Math.min(1, 3 - age);
      ctx.font = n.big ? `700 24px ${FONT_DISPLAY}` : `600 14px ${FONT_TEXT}`;
      ctx.lineWidth = 4;
      ctx.strokeStyle = "rgba(20, 14, 8, 0.85)";
      const y = 70 + i * 28;
      ctx.strokeText(n.text, v.w / 2, y);
      ctx.fillStyle = n.big ? "#ffe9a8" : "#fffaf0";
      ctx.fillText(n.text, v.w / 2, y);
    });
    ctx.globalAlpha = 1;
    if (!b.player.alive) {
      ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
      ctx.fillRect(0, 0, v.w, v.h);
      ctx.font = `700 26px ${FONT_DISPLAY}`;
      ctx.fillStyle = "#fffaf0";
      ctx.fillText("Trọng thương… đang hồi sinh", v.w / 2, (v.h - v.bottom) / 2);
    }
  }

  /** quiet: chỉ ghi vào nhật ký góc dưới trái, không hiện chữ giữa màn hình. */
  private note(text: string, big = false, quiet = false): void {
    if (!quiet) this.notes.push({ text, at: this.clock, big });
    this.log = [...this.log.slice(-5), text];
    this.top.querySelector(".mmo-log")!.innerHTML = this.log.map((t) => `<span><b>[Hệ thống]</b> ${esc(t)}</span>`).join("");
  }

  // ---------- Hộp thoại ----------

  private open(html: string, wide = false): void {
    this.dlg.classList.toggle("wide", wide);
    this.dlg.innerHTML = html;
    // Mọi bảng có nút đóng trên thanh tiêu đề; bảng tạo nhân vật thì không đóng được.
    if (!this.fresh) this.dlg.querySelector("h2")?.insertAdjacentHTML("beforeend", `<button type="button" data-close class="x" aria-label="Đóng">×</button>`);
    this.keys.clear();
    if (!this.dlg.open) this.dlg.showModal();
  }

  private dlgClick(e: Event): void {
    const t = (e.target as HTMLElement).closest<HTMLButtonElement>("button");
    if (e.target === this.dlg && !this.fresh) this.dlg.close(); // chạm nền mờ
    if (!t) return;
    const s = this.save;
    const d = t.dataset;
    if (d.close !== undefined) this.dlg.close();
    else if (d.use === "pot") {
      this.act("pot");
      this.bag();
    } else if (d.afk !== undefined) {
      const r = afkHarvest(s, Date.now(), today());
      if (r.xp > 0) this.note(`Thu hoạch bế quan: +${r.xp} tu vi${r.levels ? ` · lên cấp ${s.lv}!` : ""}`, true);
      this.restat();
    } else if (d.openbag) {
      this.selItem = d.openbag;
      this.bagTab = "all";
      this.act("bag");
    } else if (d.openmap !== undefined) {
      this.dlg.close();
      this.act("map");
    } else if (d.item) {
      this.selItem = d.item;
      this.bag();
    } else if (d.tab) {
      this.bagTab = d.tab;
      this.bag();
    } else if (d.equip) {
      if (equip(s, d.equip)) this.restat();
    } else if (d.unequip) {
      if (unequip(s, d.unequip)) this.restat();
      else this.note("Túi đầy, không gỡ được");
    } else if (d.sell) {
      const it = s.bag.find((x) => x.id === d.sell);
      if (it && (["luc", "lam"].includes(it.rarity) || confirm(`Bán ${it.name} (phẩm ${RARITY[it.rarity][0]})?`)) && sell(s, it.id)) this.bag();
    } else if (d.useitem) {
      this.act("mana");
      this.bag();
    } else if (d.stat) {
      if (addStat(s, d.stat)) this.restat();
    } else if (d.statreset !== undefined) {
      if (resetStats(s)) this.restat();
    } else if (d.up) {
      if (upSkill(s, d.up)) this.restat();
    } else if (d.join) {
      if (joinSect(s, d.join)) this.restat();
    } else if (d.leave !== undefined) {
      if (confirm("Rời tông môn? Cống hiến sẽ mất hết.")) {
        leaveSect(s);
        this.restat();
      }
    } else if (d.checkin !== undefined) {
      if (checkIn(s, today())) this.restat();
    } else if (d.donate !== undefined) {
      if (d.donate === "ore" ? donateOre(s) : donate(s)) this.restat();
    } else if (d.stab) {
      this.sectTab = d.stab;
      this.sect();
    } else if (d.submitore !== undefined) {
      if (submitOre(s, today())) this.restat();
    } else if (d.combine) {
      if (combine(s, d.combine)) this.restat();
    } else if (d.sbuy) {
      if (buySect(s, d.sbuy)) this.restat();
      else this.note("Không đổi được: thiếu cống hiến, chưa đủ cấp bậc hoặc túi đầy");
    } else if (d.mail) {
      if (claimMail(s, d.mail)) this.mail();
    } else if (d.pick !== undefined) {
      this.selSlot = Number(d.pick);
      this.selSkill = slotsOf(s)[this.selSlot] ?? this.selSkill;
      this.skills();
    } else if (d.skill) {
      this.selSkill = d.skill as SkillType;
      this.skills();
    } else if (d.slot !== undefined) {
      const i = Number(d.slot);
      if (slotsOf(s)[i] === d.sk) clearSlot(s, i);
      else setSlot(s, i, d.sk!);
      this.restat();
    } else if (d.skreset !== undefined) {
      resetSkills(s);
      this.restat();
    }
    else if (d.buy === "pot") {
      if (buyPot(s, zone(s.zone))) this.shop();
    } else if (d.buy === "phu") {
      if (buyPhu(s, zone(s.zone))) this.shop();
    } else if (d.region !== undefined) {
      this.mapRegion = d.region === "" ? null : Number(d.region);
      this.map();
    } else if (d.route !== undefined) {
      this.route = Number(d.route);
      this.routeAt = this.clock;
      this.sit = false;
      this.dlg.close();
      this.note(`Tự chạy tới ${zone(this.route).name} · bấm phím mũi tên hoặc chạm đất để dừng`);
    } else if (d.buy === "wpn") {
      if (upgrade(s)) {
        if (this.bai) this.applyStats(this.bai, false);
        this.shop();
      }
    } else if (d.tp !== undefined) {
      // Nút "Vào ngay" của Bí Cảnh Tranh Đoạt tới thẳng Cửa bí cảnh (khu có quái), chỉ bấm được khi đang mở và đứng ở khu an toàn.
      if (teleport(s, Number(d.tp)) || (zone(Number(d.tp)).boss && Number(d.tp) <= s.maxZone && zone(s.zone).safe && eventOn("bi_canh", nowMin()))) {
        this.route = null;
        this.dlg.close();
        this.go(Number(d.tp), "mid");
      } else this.note("Cần Truyền Tống Phù (mua ở Thương hội)");
    } else if (d.start !== undefined) {
      const name = this.dlg.querySelector<HTMLInputElement>("input")!.value;
      const el = this.dlg.querySelector<HTMLSelectElement>("select")!.value as ElementId;
      this.save = newSave(name, el);
      this.fresh = false;
      this.dlg.close();
      this.go(0, "mid");
    } else if (d.reset !== undefined && confirm("Xóa nhân vật và chơi lại từ đầu?")) {
      localStorage.removeItem(SAVE_KEY);
      location.reload();
    }
    this.persist();
  }

  private shop(): void {
    const s = this.save;
    const pp = potPrice(zone(s.zone));
    const wp = wpnPrice(s);
    this.open(`<h2>Thương hội</h2><p>Linh thạch: <b>${s.gold}</b></p>
      <div class="mmo-list">
        <button type="button" data-buy="pot" ${s.gold < pp ? "disabled" : ""}><b>Bình máu</b> (đang có ${s.pots})<small>Hồi ${POT_HEAL * 100}% máu · ${pp} linh thạch</small></button>
        <button type="button" data-buy="phu" ${s.gold < phuPrice(zone(s.zone)) ? "disabled" : ""}><b>Truyền Tống Phù</b> (đang có ${s.phu ?? 0})<small>Truyền tống về sơn môn, bến đò khi đang ở ngoài · ${phuPrice(zone(s.zone))} linh thạch</small></button>
        <button type="button" data-buy="wpn" ${s.gold < wp ? "disabled" : ""}><b>Cường hóa vũ khí +${s.wpn} → +${s.wpn + 1}</b><small>Công ${atkOf(s.lv, s.wpn)} → ${atkOf(s.lv, s.wpn + 1)} · ${wp} linh thạch</small></button>
      </div><button type="button" data-close>Đóng</button>`);
  }

  /**
   * Bản đồ hai tầng. Tầng 1: cả thế giới dạng đĩa, 12 vùng vòng ngoài và Cấm Khu ở tâm, vùng chưa tới phủ sương.
   * Tầng 2: chín khu của một vùng nối thành đường; bấm một khu để tự chạy tới, nút Truyền tống về sơn môn hay bến đò.
   */
  private map(): void {
    const s = this.save;
    const B = import.meta.env.BASE_URL;
    const here = zone(s.zone);
    const r = this.mapRegion;
    if (r === null) {
      const n = REGIONS.length - 1;
      const nodes = REGIONS.map(([, name, el], i) => {
        const a = (i / n) * Math.PI * 2 - Math.PI / 2;
        const [x, y] = i === n ? [50, 50] : [50 + 41 * Math.cos(a), 50 + 41 * Math.sin(a)];
        const lv = zone(townOf(i) + 1).level;
        return `<button type="button" data-region="${i}" class="${s.maxZone >= townOf(i) ? "" : "fog"} ${i === here.region ? "on" : ""}" style="left:${x.toFixed(1)}%;top:${y.toFixed(1)}%" title="${name}">
          <i style="background-image:url(${B}icon_ve/he/${el}.webp)"></i><b>${name}</b><small>${ELEMENT_STYLE[el].name} · cấp ${lv}+</small></button>`;
      }).join("");
      this.open(`<h2>Bản đồ thế giới</h2><div class="mmo-world">${nodes}</div>
        <footer><span>Đang ở: ${here.name}</span><span>Bấm một vùng để xem chín khu của vùng</span></footer>`, true);
      return;
    }
    const [, name, el] = REGIONS[r];
    const nodes = Array.from({ length: 9 }, (_, k) => {
      const z = zone(townOf(r) + k);
      const hold = mineHolder(z.idx);
      return `<button type="button" data-route="${z.idx}" class="${z.safe ? "safe" : z.boss ? "boss" : ""} ${z.idx === s.zone ? "on" : ""} ${z.idx <= s.maxZone ? "" : "fog"}" ${z.idx <= s.maxZone + 1 && z.idx !== s.zone ? "" : "disabled"}
        title="${z.idx === s.zone ? "Đang ở đây" : z.idx <= s.maxZone + 1 ? "Bấm để tự chạy tới" : "Chưa tới được"}"><i>${k + 1}</i><b>${z.name.split(" · ")[1]}</b><small>${z.safe ? "An toàn" : z.boss ? `Thủ lĩnh ${z.level}` : `Cấp ${z.level}`}</small>
        ${hold ? `<em class="${hold[0] === s.sect?.id ? "mine" : ""}" title="${hold[1]} (tông môn NPC) đang giữ mỏ này">⚑ ${hold[1].split(" ").slice(0, 2).join(" ")}</em>` : ""}</button>`;
    }).join("");
    const free = here.safe;
    const tp = (idx: number, ten: string) => `<button type="button" data-tp="${idx}" ${idx <= s.maxZone && idx !== s.zone && (free || s.phu) ? "" : "disabled"}>Truyền tống: ${ten}</button>`;
    this.open(`<h2>${name}</h2><h3>Chín khu <em>hệ ${ELEMENT_STYLE[el].name} · bấm một khu để tự chạy tới</em></h3>
      <div class="mmo-path">${nodes}</div>
      <p class="mmo-note">${free ? "Đang ở khu an toàn: truyền tống miễn phí." : `Đang ở ngoài: mỗi lần truyền tống tốn 1 Truyền Tống Phù (đang có <b>${s.phu ?? 0}</b>).`}</p>
      <footer><button type="button" data-region="">◂ Thế giới</button><span>${tp(townOf(r), "Sơn môn")} ${tp(townOf(r) + 8, "Bến đò")}</span></footer>`, true);
  }

  /** Mọi món trong túi; bình máu và Truyền Tống Phù là bộ đếm (save.pots, save.phu) nên hiện thành ô ảo đứng đầu. */
  private bagItems(): ItemInstance[] {
    const s = this.save;
    return [...(s.pots > 0 ? [{ ...potItem(s.pots), id: "pot" }] : []), ...(s.phu ? [{ ...phuItem(s.phu), id: "phu" }] : []), ...s.bag];
  }

  /** Túi: thẻ lọc, lưới BAG_MAX ô, khung phải là món đang chọn (so chỉ số với món đang mặc, nút Trang bị, Sử dụng, Bán). */
  private bag(): void {
    const s = this.save;
    const all = this.bagItems();
    const virtual = (it: ItemInstance) => it.id === "pot" || it.id === "phu";
    const tab = this.bagTab;
    const list = all.filter((it) => tab === "all" || (tab === "nl" ? it.type === "khoang_thach" || it.type === "tan_quyen" : it.type === tab));
    const sel = list.find((it) => it.id === this.selItem) ?? list[0];
    const cells = list.map((it) => `<button type="button" class="mmo-slot q-${it.rarity} ${it === sel ? "on" : ""}" data-item="${it.id}" title="${esc(it.name)}" style="${url(it)}">${it.count > 1 ? `<small>${it.count}</small>` : ""}</button>`).join("");
    const empty = '<button type="button" class="mmo-slot" disabled></button>'.repeat(Math.max(0, BAG_MAX - list.length));
    let detail = `<span class="mute">${all.length ? "Thẻ này chưa có món nào." : "Túi trống. Diệt dị thú rồi lại gần để nhặt đồ rơi."}</span>`;
    if (sel) {
      const worn = sel.slot ? s.equips[sel.slot] : null;
      const lines = STAT_ROWS.filter(([k]) => sel.stats?.[k] || worn?.stats?.[k]).map(([k, ten, pm]) => {
        const v = sel.stats?.[k] ?? 0;
        const d = v - (worn?.stats?.[k] ?? 0);
        const fmt = (n: number) => (pm ? `${n / 10}%` : String(n));
        return `<dt>${ten}</dt><dd>+${fmt(v)}${worn && d ? ` <i class="${d > 0 ? "up" : "down"}">${d > 0 ? "▲" : "▼"}${fmt(Math.abs(d))}</i>` : ""}</dd>`;
      }).join("");
      const btns = [
        sel.slot ? `<button type="button" data-equip="${sel.id}">Trang bị</button>` : "",
        sel.id === "pot" ? `<button type="button" data-use="pot">Sử dụng</button>` : sel.id === "phu" ? `<button type="button" data-openmap>Mở bản đồ</button>` : sel.type === "dan_duoc" ? `<button type="button" data-useitem="${sel.id}">Sử dụng</button>` : "",
        virtual(sel) ? "" : `<button type="button" class="bad" data-sell="${sel.id}">Bán · ${sellPrice(sel)} linh thạch</button>`,
      ].join("");
      detail = `<header><i class="q-${sel.rarity}" style="${url(sel)}"></i><span><b style="color:${RARITY[sel.rarity][1]}">${esc(sel.name)}</b>
          <em>Phẩm ${RARITY[sel.rarity][0]}${sel.slot ? ` · ${SLOTS.find(([id]) => id === sel.slot)![1]} · cấp ${sel.lv}` : ""}</em></span></header>
        ${sel.desc ? `<span>${sel.desc}</span>` : ""}
        ${lines ? `<dl class="mmo-stats">${lines}</dl>` : ""}
        ${sel.slot ? `<span class="mute">${worn ? `Đang mặc: ${esc(worn.name)} (▲▼ so với món này)` : "Ô này đang trống"}</span>` : ""}
        <nav>${btns}</nav>`;
    }
    this.open(`<h2>Túi</h2><nav class="mmo-tabs">${BAG_TABS.map(([id, ten]) => `<button type="button" data-tab="${id}" class="${id === tab ? "on" : ""}">${ten}</button>`).join("")}</nav>
      <div class="mmo-skills"><div class="mmo-grid5">${cells}${empty}</div><div class="mmo-detail">${detail}</div></div>
      <footer><span>${s.bag.length}/${BAG_MAX} ô</span><span>Linh thạch <b>${s.gold}</b></span></footer>`, true);
  }

  /** Áp lại chỉ số sau khi cộng hay tẩy điểm, rồi vẽ lại bảng đang mở. */
  private restat(): void {
    if (this.bai) this.applyStats(this.bai, false);
    if (this.panel) this.act(this.panel);
  }

  /** Nhân vật: bảy ô trang bị quanh chân dung (chạm món đang mặc để gỡ), chỉ số đã cộng đồ, điểm tiềm năng. */
  private char(): void {
    const s = this.save;
    const b = this.bai!;
    const p = b.player;
    const st = stats(s);
    const pts = statPoints(s);
    const cost = statResetCost(s);
    const spent = Object.values(s.diem ?? {}).some((n) => n > 0);
    const B = import.meta.env.BASE_URL;
    const slot = ([id, ten]: string[]) => {
      const it = s.equips[id];
      return it
        ? `<button type="button" class="mmo-slot q-${it.rarity}" data-unequip="${id}" title="${esc(it.name)} (${ten}, phẩm ${RARITY[it.rarity][0]}, cấp ${it.lv}) · chạm để gỡ về túi" style="${url(it)}"></button>`
        : `<button type="button" class="mmo-slot" disabled title="${ten}: chưa có"><span class="nm">${ten}</span></button>`;
    };
    const rows: [string, string | number][] = [
      ["Máu", `${Math.round(p.hp)}/${p.hpMax}`], ["Mana", `${Math.floor(b.mana)}/${b.manaMax}`], ["Công", st.atk], ["Thủ", `+${st.def / 10}%`], ["Thủ ngoại (đồ)", `+${st.defExt / 10}%`], ["Thủ nội (đồ)", `+${st.defInt / 10}%`],
      ["Chí mạng", `${st.crit / 10}%`], ["Sát thương chí mạng", `${150 + st.critDmg / 10}%`], ["Tốc đánh", `+${st.speed / 10}%`],
      ["Giảm hồi chiêu", `${st.cd / 10}%`], ["Giảm mana", `${st.manaCut / 10}%`], ["Cường hóa vũ khí", `+${s.wpn}`],
    ];
    const attrs = ATTRIBUTES.map((a) => `<div><span><b>${a.ten}</b><small>${(a as { tomTat?: string }).tomTat ?? ""}</small></span><i>${s.diem?.[a.id] ?? 0}</i>
      <button type="button" data-stat="${a.id}" ${pts > 0 ? "" : "disabled"} title="Cộng 1 điểm">+</button></div>`).join("");
    this.open(`<h2>Nhân vật</h2><div class="mmo-char">
      <div class="mmo-doll"><div class="mmo-gear">${SLOTS.slice(0, 4).map(slot).join("")}</div>
        <div class="mmo-body"><div class="mmo-stage"><img src="${B}icon_ve/dao_do/${s.element}/${Math.min(5, Math.ceil(s.lv / 50))}.webp" alt=""><canvas aria-label="Pháp tướng"></canvas></div>
          <b>${esc(s.name)}</b>${title(s) ? `<small class="title">「${title(s)}」</small>` : ""}<small>Hệ ${ELEMENT_STYLE[s.element].name} · Cấp ${s.lv}</small><small>Tu vi ${s.xp}/${xpNeed(s.lv)}</small></div>
        <div class="mmo-gear">${SLOTS.slice(4).map(slot).join("")}</div></div>
      <div><h3>Chỉ số</h3><dl class="mmo-stats">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("")}</dl></div></div>
      <h3>Túi <em>${s.bag.length}/${BAG_MAX} ô · chạm trang bị để mặc ngay, chạm món khác để mở Túi</em></h3>
      <div class="mmo-grid10">${this.bagItems().map((it) => `<button type="button" class="mmo-slot q-${it.rarity}" ${it.slot ? `data-equip="${it.id}"` : `data-openbag="${it.id}"`} title="${esc(itemTip(it))}" style="${url(it)}">${it.count > 1 ? `<small>${it.count}</small>` : ""}</button>`).join("")}${'<button type="button" class="mmo-slot" disabled></button>'.repeat(Math.max(0, BAG_MAX - this.bagItems().length))}</div>
      <h3>Tiềm năng <em>còn <b>${pts}</b> điểm · mỗi cấp 1 điểm</em></h3><div class="mmo-attr">${attrs}</div>
      <footer><span>Linh thạch ${s.gold}</span>
      <button type="button" data-statreset class="bad" ${spent && s.gold >= cost ? "" : "disabled"}>Tẩy điểm (${cost ? `${cost} linh thạch` : "miễn phí"})</button></footer>`, true);
  }

  /**
   * Kỹ năng: hàng trên là thanh chiêu (chọn một ô), lưới dưới là mọi chiêu (chọn một chiêu), khung phải là chi tiết chiêu đang chọn
   * với nút xếp vào ô đang chọn và nút lên tầng. Chiêu học theo cấp (SKILL_UNLOCK), lên tầng bằng điểm luyện.
   */
  private skills(): void {
    const s = this.save;
    const b = this.bai!;
    const pts = skillPoints(s);
    const sl = slotsOf(s);
    const has = learned(s);
    const url = (f: string) => `background-image:url(${import.meta.env.BASE_URL}icon_ve/chieu/${f}.webp)`;
    const sel = this.selSkill;
    const bar = sl.map((sk, i) => `<button type="button" class="mmo-slot ${i === this.selSlot ? "on" : ""}" data-pick="${i}" title="Ô ${SLOT_KEYS[i]}${sk ? `: ${SKILL_NAME[sk]}` : " (trống)"}" style="${sk ? url(sk) : ""}"><kbd>${SLOT_KEYS[i]}</kbd></button>`).join("");
    const grid = SKILL_UNLOCK.map(([sk, lv]) => {
      const ok = has.includes(sk);
      return `<button type="button" class="mmo-slot ${sk === sel ? "on" : ""} ${ok ? "" : "lock"}" data-skill="${sk}" title="${SKILL_NAME[sk]}${ok ? "" : ` (học ở cấp ${lv})`}" style="${url(sk)}"><small>${ok ? `T${layerOf(s, sk)}` : `Cấp ${lv}`}</small></button>`;
    }).join("");
    const ok = has.includes(sel);
    const l = layerOf(s, sel);
    const c = layerPrice(s, sel);
    const bo = layerBonus(l);
    const key = SLOT_KEYS[this.selSlot];
    const inSlot = sl[this.selSlot] === sel;
    const at = sl.indexOf(sel);
    const detail = `<header><i style="${url(sel)}"></i><span><b>${SKILL_NAME[sel]}</b><em>${ok ? `Tầng ${l}/${TECHNIQUE_LAYERS}${at >= 0 ? ` · đang ở ô ${SLOT_KEYS[at]}` : ""}` : `Học ở cấp ${SKILL_UNLOCK.find(([k]) => k === sel)![1]}`}</em></span></header>
      <span>${SKILL_DESC[sel] ?? ""}</span>
      <dl class="mmo-stats"><dt>Mana</dt><dd>${b.manaCost(sel)}</dd><dt>Hồi chiêu</dt><dd>${b.cooldownOf(sel).toFixed(1)}s</dd>
        <dt>Sát thương chiêu</dt><dd>Uy lực +${bo.uyLuc / 10}% · Mana −${bo.mana / 10}%</dd>
        <dt>Bị động (luôn có khi đã học)</dt><dd>${PASSIVE_NAME[PASSIVE[sel][0]]} +${passiveOf(sel, l) / 10}%${l < TECHNIQUE_LAYERS ? ` <i class="up">tầng kế +${passiveOf(sel, l + 1) / 10}%</i>` : ""}</dd></dl>
      ${ok ? `<nav><button type="button" data-slot="${this.selSlot}" data-sk="${sel}">${inSlot ? `Gỡ khỏi ô ${key}` : `Xếp vào ô ${key}`}</button>
        <button type="button" data-up="${sel}" ${c !== null && c <= pts ? "" : "disabled"}>${c === null ? "Đã tối đa" : `Lên tầng · ${c} điểm`}</button></nav>` : ""}`;
    this.open(`<h2>Kỹ năng</h2>
      <h3>Thanh chiêu <em>chọn một ô, rồi chọn chiêu và bấm Xếp</em></h3>
      <div class="mmo-barrow">${bar}<button type="button" class="mmo-slot ult" disabled title="Chiêu cuối: mở ở cấp ${BAI.ultLevel}" style="${url("tran_phap")}"><kbd>${KEYS[ULT_KEY].toUpperCase()}</kbd></button></div>
      <h3>Chiêu thức <em>đã học <b>${has.length}</b>/${SKILL_UNLOCK.length}</em></h3>
      <div class="mmo-skills"><div class="mmo-grid5">${grid}</div><div class="mmo-detail">${detail}</div></div>
      <h3>Công pháp cộng thêm <em>tổng chỉ số bị động của ${has.length} chiêu đã học · lên tầng thì tăng</em></h3>
      <dl class="mmo-stats two">${(Object.entries(passives(s)) as [PassiveKey, number][]).map(([k, v]) => `<dt class="${v ? "" : "off"}">${PASSIVE_NAME[k]}</dt><dd class="${v ? "" : "off"}">+${v / 10}%</dd>`).join("")}</dl>
      <footer><span>Điểm luyện: <b>${pts}</b> · mỗi cấp 20 điểm</span>
      <button type="button" data-skreset class="bad" ${Object.keys(s.tang ?? {}).length ? "" : "disabled"}>Tẩy tầng (miễn phí)</button></footer>`, true);
  }

  /** Tông môn: gia nhập từ cấp SECT.level; điểm danh, nhiệm vụ diệt dị thú mỗi ngày, hiến linh thạch; cấp bậc theo cống hiến cho thêm công. */
  private sect(): void {
    const s = this.save;
    const t = s.sect;
    if (!t) {
      const can = s.lv >= SECT.level;
      this.open(`<h2>Tông môn</h2><p>Gia nhập một tông môn để điểm danh, làm nhiệm vụ mỗi ngày, tích cống hiến và lên cấp bậc. Cấp bậc càng cao, công càng tăng.</p>
        <h3>Chọn tông môn <em>${can ? "chọn một" : `mở ở cấp ${SECT.level}`}</em></h3>
        <div class="mmo-list">${SECTS.map(([id, ten, mo]) => `<button type="button" data-join="${id}" ${can ? "" : "disabled"}><b>${ten}</b><small>${mo}</small></button>`).join("")}</div>`);
      return;
    }
    const day = today();
    const B = import.meta.env.BASE_URL;
    const [, rank, buff] = rankOf(s)!;
    const life = sectLife(s);
    const next = RANKS.find(([n]) => n > life);
    const [, ten, , chu] = SECTS.find(([id]) => id === t.id)!;
    const tab = this.sectTab;
    let body = "";
    if (tab === "dai_dien") {
      const kills = Math.min(sectKills(s, day), SECT.taskKills);
      const killDone = t.taskDay === day && t.taskDone;
      const done = sectDone(s, day);
      const ores = oreCount(s);
      const task = (ok: boolean, text: string, cong: number, attr = "disabled") => `<button type="button" ${ok ? "disabled" : attr} class="${ok ? "done" : ""}"><b>${text}${ok ? " · đã xong" : ""}</b><small>+${cong} cống hiến</small></button>`;
      body = `<h3>Tông vụ hôm nay</h3><div class="mmo-list">
          <button type="button" data-checkin ${t.checkIn === day ? 'disabled class="done"' : ""}><b>Điểm danh${t.checkIn === day ? " · đã xong" : ""}</b><small>+${SECT.checkIn} cống hiến · +${20 * s.lv} linh thạch</small></button>
          ${task(killDone, `Diệt ${kills}/${SECT.taskKills} dị thú (khu nào cũng tính)`, SECT.taskCong)}
          ${task(done.ore, `Nộp ${SECT.oreNeed} nguyên liệu (đang có ${ores})`, SECT.oreCong, ores >= SECT.oreNeed ? "data-submitore" : "disabled")}
          ${task(done.boss, "Hạ một thủ lĩnh (cửa bí cảnh hoặc thủ lĩnh trong bãi)", SECT.bossCong)}
        </div>
        <h3>Quyên góp <em>nâng cấp tông môn</em></h3><div class="mmo-list two">
          <button type="button" data-donate ${s.gold >= SECT.donate ? "" : "disabled"}><b>Hiến ${SECT.donate} linh thạch</b><small>+${SECT.donateCong} cống hiến · đang có ${s.gold}</small></button>
          <button type="button" data-donate="ore" ${ores >= SECT.donateOre ? "" : "disabled"}><b>Hiến ${SECT.donateOre} nguyên liệu</b><small>+${SECT.donateOreCong} cống hiến · đang có ${ores}</small></button>
        </div>
        <h3>Cấp bậc</h3><dl class="mmo-stats">${RANKS.map(([n, r, k]) => `<dt>${r}${r === rank ? " ◂" : ""}</dt><dd>${n} cống hiến · công +${k / 10}%</dd>`).join("")}</dl>`;
    } else if (tab === "kinh_cac") {
      body = `<h3>Ghép tàn quyển <em>${NGO.need} tàn quyển cùng hệ lên một bậc lĩnh ngộ · mỗi bậc công +${NGO.atk / 10}% · tối đa bậc ${NGO.max}</em></h3>
        <div class="mmo-ngo">${(Object.keys(ELEMENT_STYLE) as ElementId[]).map((el) => {
          const n = scrollCount(s, el);
          const lv = s.ngo?.[el] ?? 0;
          return `<button type="button" data-combine="${el}" ${n >= NGO.need && lv < NGO.max ? "" : "disabled"} title="Hệ ${ELEMENT_STYLE[el].name}: bậc ${lv}, có ${n} tàn quyển">
            <i style="background-image:url(${B}icon_ve/tan_quyen/${el}.webp)"></i><b>${ELEMENT_STYLE[el].name} · bậc ${lv}</b><small>${lv >= NGO.max ? "Đã viên mãn" : `${n}/${NGO.need} tàn quyển`}</small></button>`;
        }).join("")}</div>
        <p class="mmo-note">Tàn quyển rơi từ dị thú (2%) và thủ lĩnh (40%) theo hệ của vùng, hoặc đổi ở Bảo Khố. Công pháp độc quyền của tông môn: chưa mở.</p>`;
    } else if (tab === "bao_kho") {
      const ri = RANKS.indexOf(rankOf(s)!);
      body = `<h3>Đổi bằng cống hiến <em>đang có <b>${t.cong}</b></em></h3><div class="mmo-list two">${SECT_SHOP.map(([id, name, price, need]) =>
        `<button type="button" data-sbuy="${id}" ${t.cong >= price && ri >= need ? "" : "disabled"}><b>${name}</b><small>${price} cống hiến${ri < need ? ` · cần bậc ${RANKS[need][1]}` : ""}</small></button>`).join("")}</div>
        <p class="mmo-note">Tiêu cống hiến không làm tụt cấp bậc. Ấn bộ set: chưa mở.</p>`;
    } else {
      body = `<h3>Đại Trận Hộ Môn</h3><div class="bai-bar hp mmo-ward"><i style="width:100%"></i><span>Độ bền 100%</span></div>
        <dl class="mmo-stats"><dt>Trạng thái</dt><dd>Vận hành, chưa bị công phá</dd><dt>Bảo vật chấn tông</dt><dd>Chưa có</dd><dt>Công Thành Chiến</dt><dd>Chưa mở (cần máy chủ)</dd></dl>
        <p class="mmo-note">Thẻ này mới hiện trạng thái; đánh và thủ sơn môn mở cùng Công Thành Chiến.</p>`;
    }
    this.open(`<h2>${ten}</h2>
      <div class="mmo-sect"><i style="background-image:url(${B}icon_ve/ui/tab/tong_mon.webp)"></i>
        <dl class="mmo-stats"><dt>Cấp tông môn</dt><dd>${sectLevel(s)} / ${SECT.maxLevel}</dd><dt>Tông chủ</dt><dd>${chu}</dd>
          <dt>Cấp bậc của mình</dt><dd>${rank} · công +${buff / 10}%</dd><dt>Cống hiến</dt><dd>${t.cong} (cả đời ${life}${next ? ` / ${next[0]}` : ""})</dd></dl></div>
      <nav class="mmo-tabs">${SECT_TABS.map(([id, name]) => `<button type="button" data-stab="${id}" class="${id === tab ? "on" : ""}">${name}</button>`).join("")}</nav>
      ${body}
      <footer><span></span><button type="button" data-leave class="bad">Rời tông môn</button></footer>`, true);
  }

  /**
   * Liên minh (phím L). Bản xem trước: chưa có máy chủ nên liên minh, địch thủ và đội hình đều là tông môn và tu sĩ NPC xếp cố định
   * (người dùng chốt 2026-11-11: dựng màn mẫu). Chỉ đồng hồ đếm tới giờ chiến 21:00 là thật. Không cộng tài nguyên, không đánh được.
   */
  private ally(): void {
    const s = this.save;
    const t = s.sect;
    if (!t) {
      this.open(`<h2>Liên minh</h2><p>Gia nhập một tông môn (phím G, từ cấp ${SECT.level}) rồi mới vào được liên minh.</p>`);
      return;
    }
    const me = SECTS.findIndex(([id]) => id === t.id);
    const name = (i: number) => SECTS[(me + i) % SECTS.length][1];
    const mines = Array.from({ length: ZONE_COUNT }, (_, i) => zone(i)).filter((z) => mineHolder(z.idx)?.[0] === t.id);
    const rate = (z: Zone) => (2 + z.level) * 10;
    const wait = eventIn("chien", nowMin());
    const half = Math.ceil(NAMES.length / 2);
    this.open(`<h2>Liên minh</h2><p class="mmo-note first">Bản xem trước: số liệu là tông môn NPC, chưa tranh đoạt được. Mở thật khi có máy chủ.</p>
      <h3>Cứ điểm đang giữ <em><b>${mines.length}</b> mỏ · tổng ${mines.reduce((n, z) => n + rate(z), 0)} linh thạch/giờ</em></h3>
      <dl class="mmo-stats mmo-scroll">${mines.map((z) => `<dt>${z.name}</dt><dd>cấp ${z.level} · ${rate(z)}/giờ</dd>`).join("")}</dl>
      <h3>Chiến tranh địa bàn <em>21:00 – 22:00 mỗi ngày</em></h3>
      <dl class="mmo-stats"><dt>Khai chiến</dt><dd>${wait ? `còn ${dur(wait)}` : "<b>đang diễn ra</b>"}</dd><dt>Địch thủ đã tuyên chiến</dt><dd class="foe">${name(2)}</dd>
        <dt>Đội Tiên phong</dt><dd>${NAMES.slice(0, half).join(", ")}</dd><dt>Đội Phòng thủ chính điện</dt><dd>${esc(s.name)}, ${NAMES.slice(half).join(", ")}</dd></dl>
      <h3>Ngoại giao</h3>
      <dl class="mmo-stats"><dt>Đồng minh</dt><dd class="ally">${name(0)} (tông môn mình)</dd><dt>Trung lập</dt><dd class="neutral">${name(1)}</dd><dt>Kẻ thù</dt><dd class="foe">${name(2)}</dd></dl>`, true);
  }

  /** Trung tâm hoạt động (phím V): lịch sự kiện theo giờ máy, tháp Tầm Đạo, bế quan. */
  private event(): void {
    const s = this.save;
    const min = nowMin();
    const day = today();
    if (!s.afk) afkHarvest(s, Date.now(), day); // lần đầu mở: bắt đầu tích
    const best = Math.max(-1, ...REGIONS.map((_, r) => (s.maxZone >= towerZone(r) ? r : -1)));
    const ev = (id: EventId, btn: string) => {
      const e = EVENTS[id];
      const w = eventIn(id, min);
      return `<div class="${w ? "" : "live"}"><span><b>${e.ten}</b><small>${e.gio.map(([a, b]) => `${hm(a)} – ${hm(b)}`).join(" · ")} · ${e.mo}</small></span><em>${w ? `còn ${dur(w)}` : "đang mở"}</em>${btn}</div>`;
    };
    const n = s.thap ?? 0;
    const floors = TOWER.map((ten, i) => {
      const z = zone(towerZone(i));
      const st = i < n ? "done" : i === n ? "on" : "lock";
      return `<button type="button" data-route="${z.idx}" class="${st}" ${i === n && z.idx <= s.maxZone + 1 && z.idx !== s.zone ? "" : "disabled"} title="${i === n ? "Bấm để tự chạy tới" : ""}">
        <b>Tầng ${i + 1} · ${ten}${i < n ? " · đã qua" : ""}</b><small>Hạ thủ lĩnh hệ ${ELEMENT_STYLE[z.element].name} cấp ${z.level} ở ${z.name} · thưởng ${towerGold(i)} linh thạch, 2 tàn quyển, danh hiệu</small></button>`;
    }).join("");
    const p = afkPending(s, Date.now(), day);
    this.open(`<h2>Hoạt động</h2>
      <h3>Lịch hôm nay <em>giờ theo máy của bạn · bây giờ ${hm(min)}</em></h3>
      <div class="mmo-events">
        ${ev("bi_canh", `<button type="button" data-tp="${best < 0 ? "" : towerZone(best)}" ${eventOn("bi_canh", min) && best >= 0 && zone(s.zone).safe ? "" : "disabled"} title="Vào Cửa bí cảnh xa nhất đã tới, từ khu an toàn">Vào ngay</button>`)}
        ${ev("the_gioi", `<button type="button" disabled title="Cần máy chủ">Chưa mở</button>`)}
      </div>
      <h3>Tháp Tầm Đạo <em>đã qua <b>${n}</b>/${TOWER.length} tầng${title(s) ? ` · danh hiệu ${title(s)}` : ""}</em></h3>
      <div class="mmo-list mmo-scroll">${floors}</div>
      <h3>Bế quan <em>tu vi tự tích kể cả khi tắt game · tối đa ${AFK.capSec / 3600} giờ mỗi ngày</em></h3>
      <dl class="mmo-stats"><dt>Đã tích</dt><dd>${dur(Math.floor(p.sec / 60))} · <b>${p.xp}</b> tu vi</dd><dt>Còn lại hôm nay</dt><dd>${dur(Math.floor(p.left / 60))}</dd>
        <dt>Linh Tuyền</dt><dd>${p.buff ? `+${AFK.spring / 10}% (tông môn giữ Mỏ linh thạch vùng này)` : "không (tông môn mình chưa giữ Mỏ linh thạch vùng này)"}</dd></dl>
      <footer><span>Mỗi giờ ${AFK.perHour * 100}% tu vi của một cấp</span><button type="button" data-afk ${p.xp > 0 ? "" : "disabled"}>Thu hoạch tu vi</button></footer>`, true);
  }

  /** Thư: quà theo mốc cấp, nhận một lần. */
  private mail(): void {
    const list = mails(this.save);
    this.open(`<h2>Thư</h2><div class="mmo-list">${list.map((m) => `<button type="button" data-mail="${m.id}" ${m.claimed ? "disabled" : ""}>
      <b>${m.ten}${m.claimed ? " · đã nhận" : ""}</b><small>${m.gold} linh thạch · ${m.pots} bình máu</small></button>`).join("")}</div>
      <footer><span>Thư mới tới khi đạt cấp 5, 10, 20, 30, 50</span></footer>`);
  }

  private help(): void {
    this.open(`<h2>Thiết lập và trợ giúp</h2>${HELP}
      <button type="button" data-close>Đóng</button> <button type="button" data-reset class="bad">Chơi lại từ đầu</button>`);
  }

  private intro(): void {
    const els = (Object.keys(ELEMENT_STYLE) as ElementId[]).map((e) => `<option value="${e}">${ELEMENT_STYLE[e].name}</option>`).join("");
    this.open(`<h2>Thiên Hoang Ký</h2><p>Nhập thế tu hành: đi khắp 13 vùng, diệt dị thú, lên cấp, hạ thủ lĩnh bí cảnh.</p>
      <label>Đạo hiệu <input maxlength="16" placeholder="Vô Danh" /></label>
      <label>Hệ công pháp <select>${els}</select></label>${HELP}
      <button type="button" data-start class="go">Nhập thế</button>`);
    this.dlg.addEventListener("cancel", (e) => this.fresh && e.preventDefault());
  }
}

const HELP = `<ul>
  <li><b>Đi:</b> chạm đất, hoặc phím mũi tên. Đi tới mép sáng hai bên để sang khu khác.</li>
  <li><b>Đánh:</b> chạm dị thú (hoặc phím Cách) để đánh thường; chiêu ở thanh dưới, phím Q W E R T Y; chiêu cuối phím U (mở ở cấp 150). Xếp chiêu vào ô trong bảng Kỹ năng.</li>
  <li><b>X</b> tọa thiền (hồi máu, mana) · <b>G</b> tông môn · <b>L</b> liên minh · <b>V</b> hoạt động (sự kiện, tháp, bế quan) · <b>H</b> thư.</li>
  <li><b>1</b> uống bình máu · <b>2</b> uống Hồi Linh Đan (hàng số 1–6 là ô vật phẩm); máu dưới 35% hay mana dưới 20% thì tự uống nếu trong túi còn · <b>F</b> treo auto (tự đánh, tự ra chiêu, tự nhặt đồ) · <b>M</b> bản đồ (bấm khu để tự chạy tới; truyền tống về sơn môn, bến đò) · <b>B</b> tiệm (ở sơn môn, bến đò).</li>
  <li><b>I</b> túi · <b>P</b> nhân vật (cộng điểm tiềm năng) · <b>O</b> kỹ năng (lên tầng chiêu); nhấn lại để đóng.</li>
  <li><b>Đồ rơi:</b> dị thú chết rơi linh thạch và đồ có cột sáng theo phẩm; lại gần là tự nhặt, phím Cách hút hết đồ trong khu. Mở túi (I) để mặc, dùng, bán.</li>
  <li>Tiến độ tự lưu trên máy này.</li></ul>`;

const PANELS: Record<string, string> = { i: "bag", p: "char", o: "skills", g: "sect", h: "mail", l: "ally", v: "event" };
/** Hàng nút trên cùng, cạnh bản đồ nhỏ: hành động, phím, tên, hình (đường dẫn trong icon_ve/) hoặc một ký hiệu. */
const QUICK = [["bag", "I", "Túi", "linh_thach/ha"], ["char", "P", "Nhân vật", "he/moc"], ["skills", "O", "Kỹ năng", "chieu/can_quet"], ["sect", "G", "Tông môn", "ui/tab/tong_mon"], ["map", "M", "Bản đồ", "✦"], ["event", "V", "Hoạt động", "✺"], ["auto", "F", "Treo máy", "↻"]];
/** Hàng nút tròn dưới bản đồ nhỏ. */
const ACTS = [["sit", "X", "Tọa thiền", "☯"], ["shop", "B", "Tiệm", "⚖"], ["ally", "L", "Liên minh", "⚑"], ["mail", "H", "Thư", "✉"], ["help", "?", "Thiết lập", "⚙"]];
/** Tung độ phần bản đồ nhỏ vẽ trên canvas, ngay dưới thanh tiêu đề của khung .mmo-map. */
const MAP_Y = 34;
/** Ngày theo máy người chơi, YYYY-MM-DD: mốc của điểm danh và nhiệm vụ tông môn. */
const today = () => new Date().toLocaleDateString("sv");
/** Phút từ 0 giờ theo máy người chơi: mốc của lịch sự kiện. */
const nowMin = () => new Date().getHours() * 60 + new Date().getMinutes();
const hm = (min: number) => `${Math.floor(min / 60)}:${String(min % 60).padStart(2, "0")}`;
const dur = (min: number) => (min >= 60 ? `${Math.floor(min / 60)} giờ ${min % 60} phút` : `${min} phút`);
const MENU = [["bag", "I", "Túi"], ["char", "P", "Nhân vật"], ["skills", "O", "Kỹ năng"], ["map", "M", "Bản đồ"], ["shop", "B", "Tiệm"], ["auto", "F", "Treo auto"], ["sit", "X", "Tọa thiền"], ["sect", "G", "Tông môn"], ["ally", "L", "Liên minh"], ["event", "V", "Hoạt động"], ["mail", "H", "Thư"], ["help", "?", "Thiết lập"]];
/** Bảy ô trang bị (SlotId của @htk/rules): bốn ô bên trái chân dung, ba ô bên phải. */
const SLOTS = [["mu", "Mũ"], ["ao", "Áo"], ["dai", "Đai"], ["giay", "Giày"], ["vu_khi", "Vũ khí"], ["bao_tay", "Bao tay"], ["ngoc_boi", "Ngọc bội"]];
const esc = (t: string) => t.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
/** shortcut: nhiều kiểu trang bị chưa có hình vẽ riêng (icon_ve/trang_bi/<ô>/ còn thiếu số), khi đó hiện hình 01 của ô; bỏ khi vẽ đủ 430 kiểu. */
const FIRST = (icon: string) => icon.replace(/\/\d+$/, "/01");
const url = (it: ItemInstance) => `background-image:url(${import.meta.env.BASE_URL}icon_ve/${it.icon}.webp),url(${import.meta.env.BASE_URL}icon_ve/${FIRST(it.icon)}.webp)`;
const SECT_TABS = [["dai_dien", "Đại Điện"], ["kinh_cac", "Tàng Kinh Các"], ["bao_kho", "Bảo Khố"], ["dai_tran", "Đại Trận Hộ Môn"]];
/** Chú thích một món khi rê chuột: tên, phẩm, cấp, chỉ số. */
const itemTip = (it: ItemInstance) =>
  [`${it.name} · phẩm ${RARITY[it.rarity][0]}${it.slot ? ` · cấp ${it.lv}` : ""}`, ...STAT_ROWS.filter(([k]) => it.stats?.[k]).map(([k, ten, pm]) => `${ten} +${pm ? `${it.stats![k]! / 10}%` : it.stats![k]}`), it.desc ?? ""].filter(Boolean).join("\n");
const BAG_TABS = [["all", "Tất cả"], ["trang_bi", "Trang bị"], ["dan_duoc", "Đan dược"], ["nl", "Nguyên liệu"]];
/** Dòng chỉ số của trang bị: khóa, tên, có phải phần nghìn (hiện thành %) không. */
const STAT_ROWS: [keyof ItemStats, string, boolean][] = [["atk", "Công", false], ["hp", "Máu", false], ["defExt", "Thủ ngoại", true], ["defInt", "Thủ nội", true], ["crit", "Chí mạng", true]];
/** Đồ rơi: tầm tự hút và tốc độ bay về người chơi (đơn vị thế giới), số giây nằm trên đất trước khi mất. */
const PICK_R = 50 * SCALE;
const LOOT_SPEED = 900;
const LOOT_TTL = 120;
/** Treo auto: số giây giữa hai lần tự ra chiêu. */
/** Tự uống: bình máu khi máu dưới hp, Hồi Linh Đan khi mana dưới mana (phần của tối đa). */
const AUTO_POT = { hp: 0.35, mana: 0.2 };
const AUTO_GAP = 0.6;
/** Treo auto: chiêu đánh chừa lại chừng này phần mana cho hồi phục và hộ thể. */
const AUTO_KEEP = 0.3;
const SKILL_DESC: Record<string, string> = {
  can_quet: "Quét các dị thú quanh mình",
  tam_xa: "Đánh một mục tiêu ở xa",
  dien_rong: "Sát thương cả một vùng",
  ho_the: `Khiên ${BAI.shieldPct * 100}% máu trong ${BAI.shieldSec} giây`,
  hoi_phuc: `Hồi ${BAI.healPct * 100}% máu`,
  can_don: "Một đòn mạnh vào một mục tiêu gần",
  khong_che: "Đòn nhanh, tốn ít mana, một mục tiêu",
  than_phap: "Đánh một mục tiêu ở rất xa",
  bua_chu: "Bùa nổ rất mạnh vào một mục tiêu",
  tran_phap: "Trận lớn đánh mạnh cả vùng, hồi chiêu dài",
};

/** Phím của hàng ô chiêu, theo thứ tự ô: sáu ô chiêu rồi chiêu cuối. */
const KEYS = "qwertyu";
/** Vị trí phím chiêu cuối (U) trong KEYS; sáu phím còn lại là sáu ô ra chiêu. */
const ULT_KEY = 6;
const SLOT_KEYS = [...KEYS].filter((_, i) => i !== ULT_KEY).map((k) => k.toUpperCase());


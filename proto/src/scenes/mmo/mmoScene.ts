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
import { BaiScene } from "../bai/baiScene.ts";
import { BAI } from "../bai/thamSo.ts";
import { ACT_LABEL, bayTuDong, bossTuDong, choVao, macDinh, mapId, SCALE, type MapKhu } from "./mapKhu.ts";
import { camLop, O_DIR, veLop, type BoODat } from "./oDat.ts";
import {
  addStat, atkOf, buyPot, kill, layerOf, layerPrice, resetSkills, resetStats, skillPoints, statPoints, statResetCost, stats, upSkill, newSave, POT_HEAL, potPrice, questText, REGIONS, townOf, upgrade, wpnPrice, xpNeed, zone, ZONE_COUNT,
  type Save, type Zone,
} from "./tienTrinh.ts";

const SAVE_KEY = "htk.mmo.v1";
const POT_CD = 5;
const NAMES = ["Lạc Vân", "Tô Hàn", "Mạc Kỳ", "Diệp Thanh", "Hoa Ảnh", "Trần Phong", "Liễu Sương", "Minh Nguyệt", "Tử Sâm", "Hàn Liên", "Vô Song", "Cố Bắc"];
/** Hình trong assets/: mặc định ở pixellab/, đường dẫn bắt đầu bằng freepixel/ thì ở assets/freepixel/. */
const ASSET = (p: string) => `${import.meta.env.BASE_URL}${p.startsWith("freepixel/") ? "" : "pixellab/"}${p}.png`;

function load(): Save | null {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY) ?? "null") as Save | null;
    return s && s.v === 1 && s.zone >= 0 && s.zone < ZONE_COUNT ? s : null;
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
    this.bar.innerHTML = `<div class="bai-bar xp"><i></i><span></span></div>
      <div class="mmo-btns"><button type="button" data-a="pot"></button><button type="button" data-a="auto"></button>
      <button type="button" data-a="shop">B · Tiệm</button><button type="button" data-a="map">M · Bản đồ</button><button type="button" data-a="bag">I · Túi</button><button type="button" data-a="char">P · Nhân vật</button><button type="button" data-a="skills">O · Kỹ năng</button><button type="button" data-a="help">?</button></div>`;
    this.hud.prepend(this.bar);
    this.hud.classList.add("mmo-hud");
    this.bar.classList.add("mmo-ui");
    const base = import.meta.env.BASE_URL;
    this.hud.querySelectorAll<HTMLElement>(".bai-skills button").forEach((btn, i) => (btn.style.backgroundImage = `url(${base}icon_ve/chieu/${BAI.skills[i] ?? "tran_phap"}.webp)`));
    this.hud.addEventListener("mouseover", (e) => this.tip((e.target as HTMLElement).closest<HTMLElement>(".bai-skills button")));
    this.hud.addEventListener("mouseleave", () => this.tip(null));
    // Bố cục theo mẫu người dùng gửi 2026-11-11: khung nhân vật trên trái, mục tiêu trên giữa, menu dọc dưới bản đồ nhỏ.
    this.top = document.createElement("div");
    this.top.className = "mmo-top mmo-ui";
    this.top.innerHTML = `<div class="mmo-me"><i class="mmo-face"></i><div><b class="mmo-name"></b>
      <div class="bai-bar hp"><i></i><span></span></div><div class="bai-bar mp"><i></i><span></span></div><div class="bai-bar xp"><i></i><span></span></div></div></div>
      <div class="mmo-quest"></div>
      <div class="mmo-tgt" hidden><b></b><div class="bai-bar hp"><i></i><span></span></div></div>
      <nav class="mmo-menu">${MENU.map(([a, k, t]) => `<button type="button" data-a="${a}"><kbd>${k}</kbd>${t}</button>`).join("")}</nav>
      <div class="mmo-tip" hidden></div>`;
    document.body.append(this.top);
    this.top.addEventListener("click", (e) => {
      const a = (e.target as HTMLElement).closest<HTMLButtonElement>("button")?.dataset.a;
      if (a) this.act(a);
    });
    // Nhãn phím trên từng ô chiêu: số 1–6, và Q W E R T cho năm chiêu đầu.
    this.hud.querySelectorAll(".bai-skills button").forEach((btn, i) => btn.insertAdjacentHTML("afterbegin", `<kbd>${i + 1}${KEYS[i] ? ` ${KEYS[i].toUpperCase()}` : ""}</kbd>`));
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
    addStyle();
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
    b.onKill = () => this.onKill(b, z);
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

  private onKill(b: Bai, z: Zone): void {
    const s = this.save;
    const r = kill(s, z, Math.random());
    if (r.pot) this.note("Nhặt được 1 bình máu");
    if (r.quest) this.note(`Xong nhiệm vụ: +${r.quest.xp} tu vi, +${r.quest.gold} linh thạch`, true);
    if (r.levels > 0) {
      this.note(`Lên cấp ${s.lv}!`, true);
      this.applyStats(b, true);
    }
    this.persist();
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
      if (dx || dy) {
        b.moveTo(b.player.x + dx * 90, b.player.y + dy * 90);
        this.keyMove = true;
      } else if (this.keyMove) {
        b.player.goal = null;
        this.keyMove = false;
      }
    }
    super.update(dt);
    const p = b.player;
    if (!p.alive) return;
    if (p.x <= 6 && this.save.zone > 0) this.go(this.save.zone - 1, "right");
    else if (p.x >= b.w - 6 && this.save.zone < ZONE_COUNT - 1) this.go(this.save.zone + 1, "left");
    this.syncBar(b);
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
    const i = k.length !== 1 ? -1 : k >= "1" && k <= "6" ? Number(k) - 1 : KEYS.indexOf(k);
    if (i >= 0 && i < BAI.skills.length) b.cast(BAI.skills[i]);
    else if (i === BAI.skills.length) b.castUlt();
    else if (k === "z") this.act("pot");
    else if (k === "f") this.act("auto");
    else if (k === "m") this.act("map");
    else if (k === "b") this.act("shop");
    else if (k === " ") {
      e.preventDefault();
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
    } else if (a === "auto") {
      this.auto = !this.auto;
      b.auto = this.auto && !z.safe;
      if (!this.auto) b.player.target = null;
      this.note(this.auto ? "Treo auto: bật" : "Treo auto: tắt");
    } else if (a === "shop") {
      if (z.safe) this.shop();
      else this.note("Tiệm chỉ mở ở sơn môn và bến đò");
    } else if (a === "map") this.map();
    else if (a === "help") this.help();
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
    const key = [s.lv, s.xp, s.pots, cd, this.auto, s.zone, s.gold, s.quest.n, s.name, Math.round(p.hp), p.hpMax, Math.floor(b.mana), b.manaMax, p.alive, tgt?.id, tgt && Math.round(tgt.hp)].join("|");
    if (key === this.barKey) return;
    this.barKey = key;
    const all = (sel: string) => document.querySelectorAll<HTMLElement>(sel);
    const bar = (sel: string, a: number, n: number, text: string) =>
      all(sel).forEach((el) => {
        (el.firstElementChild as HTMLElement).style.width = `${Math.max(0, Math.min(100, (100 * a) / n))}%`;
        el.lastElementChild!.textContent = text;
      });
    bar(".mmo-ui .xp", s.xp, need, `Cấp ${s.lv} · Tu vi ${s.xp}/${need}`);
    bar(".mmo-me .hp", p.hp, p.hpMax, `${Math.round(p.hp)}/${p.hpMax}`);
    bar(".mmo-me .mp", b.mana, b.manaMax, `${Math.floor(b.mana)}/${b.manaMax}`);
    const q = (sel: string) => this.top.querySelector<HTMLElement>(sel)!;
    q(".mmo-name").textContent = `${s.name} · Cấp ${s.lv}`;
    const face = q(".mmo-face");
    face.textContent = s.name.slice(0, 1).toUpperCase();
    face.style.background = ELEMENT_STYLE[s.element].color;
    q(".mmo-quest").innerHTML = `<b>${zone(s.zone).name}</b><span>Nhiệm vụ: ${questText(s)}</span><span>Linh thạch ${s.gold} · Bình máu ${s.pots}</span>`;
    const tg = q(".mmo-tgt");
    tg.hidden = !tgt;
    if (tgt) {
      tg.firstElementChild!.textContent = `${tgt.name} · cấp ${b.mLevel}`;
      bar(".mmo-tgt .hp", tgt.hp, tgt.hpMax, "");
    }
    const pot = this.bar.querySelector<HTMLButtonElement>('[data-a="pot"]')!;
    pot.textContent = cd > 0 ? `Z · Bình ×${s.pots} (${cd}s)` : `Z · Bình máu ×${s.pots}`;
    pot.disabled = s.pots <= 0 || cd > 0 || !p.alive;
    this.bar.querySelector('[data-a="auto"]')!.textContent = this.auto ? "F · Auto bật" : "F · Auto tắt";
    all('.mmo-ui [data-a="auto"]').forEach((el) => el.classList.toggle("on", this.auto));
    all('.mmo-ui [data-a="shop"]').forEach((el) => ((el as HTMLButtonElement).disabled = !zone(s.zone).safe));
  }

  /** Bảng chú thích khi rê chuột lên một ô chiêu. */
  private tip(btn: HTMLElement | null): void {
    const t = this.top.querySelector<HTMLElement>(".mmo-tip")!;
    t.hidden = !btn || !this.bai;
    if (t.hidden) return;
    const sk = btn!.dataset.s as SkillType | undefined;
    t.innerHTML = sk ? this.skillInfo(sk) : `<b>Chiêu cuối</b><span>Đánh mạnh mọi dị thú quanh mình khi thanh nội tại đầy.</span><span>Mở ở cấp ${BAI.ultLevel} · phím 6</span>`;
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
      <span>Uy lực +${bo.uyLuc / 10}% · Mana −${bo.mana / 10}% · Hồi chiêu −${bo.hoiChieu / 10}%</span>`;
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

  override draw(v: View): void {
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
    ctx.fillRect(mx - 2, 6, mw + 4, mh + 4);
    for (const a of b.actors) {
      if (!a.alive) continue;
      ctx.fillStyle = a.kind === "monster" ? "#e0553f" : a.kind === "bot" ? "#9cc7e6" : "#ffd34d";
      const r = a.kind === "player" ? 3 : a.boss ? 4 : 2;
      ctx.fillRect(mx + (a.x / b.w) * mw - r / 2, 8 + (a.y / b.h) * mh - r / 2, r, r);
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

  private note(text: string, big = false): void {
    this.notes.push({ text, at: this.clock, big });
  }

  // ---------- Hộp thoại ----------

  private open(html: string, wide = false): void {
    this.dlg.classList.toggle("wide", wide);
    this.dlg.innerHTML = html;
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
    } else if (d.stat) {
      if (addStat(s, d.stat)) this.restat();
    } else if (d.statreset !== undefined) {
      if (resetStats(s)) this.restat();
    } else if (d.up) {
      if (upSkill(s, d.up)) this.restat();
    } else if (d.skreset !== undefined) {
      resetSkills(s);
      this.restat();
    }
    else if (d.buy === "pot") {
      if (buyPot(s, zone(s.zone))) this.shop();
    } else if (d.buy === "wpn") {
      if (upgrade(s)) {
        if (this.bai) this.applyStats(this.bai, false);
        this.shop();
      }
    } else if (d.tp !== undefined) {
      this.dlg.close();
      this.go(Number(d.tp), "mid");
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
        <button type="button" data-buy="wpn" ${s.gold < wp ? "disabled" : ""}><b>Cường hóa vũ khí +${s.wpn} → +${s.wpn + 1}</b><small>Công ${atkOf(s.lv, s.wpn)} → ${atkOf(s.lv, s.wpn + 1)} · ${wp} linh thạch</small></button>
      </div><button type="button" data-close>Đóng</button>`);
  }

  private map(): void {
    const s = this.save;
    const here = zone(s.zone).region;
    const rows = REGIONS.map(([, name, el], r) => {
      const open = s.maxZone >= townOf(r);
      const lv = zone(townOf(r) + 1).level;
      return `<button type="button" data-tp="${townOf(r)}" ${open ? "" : "disabled"} class="${r === here ? "on" : ""}">
        <b>${name}</b><small>${ELEMENT_STYLE[el].name} · dị thú cấp ${lv}–${lv + 10}${open ? "" : " · chưa tới"}</small></button>`;
    }).join("");
    this.open(`<h2>Truyền tống trận</h2><p>Tới sơn môn của vùng đã đặt chân. Đang ở: ${zone(s.zone).name}</p>
      <div class="mmo-list">${rows}</div><button type="button" data-close>Đóng</button>`);
  }

  /** Túi: lưới ô, hiện những gì bản lưu đang có. Chưa có vật phẩm rơi nên mới có bình máu, linh thạch, vũ khí. */
  private bag(): void {
    const s = this.save;
    const items = [
      `<button type="button" data-use="pot" ${s.pots > 0 ? "" : "disabled"} title="Chạm để uống (phím Z)"><b>Bình máu</b><small>×${s.pots}</small></button>`,
      `<button type="button" disabled><b>Linh thạch</b><small>${s.gold}</small></button>`,
      `<button type="button" disabled><b>Vũ khí</b><small>+${s.wpn}</small></button>`,
    ];
    const empty = '<button type="button" disabled class="empty"></button>'.repeat(BAG_SLOTS - items.length);
    this.open(`<h2>Túi</h2><div class="mmo-bag">${items.join("")}${empty}</div>
      <p><small>Chạm bình máu để uống. Mua thêm và cường hóa vũ khí ở Thương hội (B).</small></p><button type="button" data-close>Đóng (I)</button>`);
  }

  /** Áp lại chỉ số sau khi cộng hay tẩy điểm, rồi vẽ lại bảng đang mở. */
  private restat(): void {
    if (this.bai) this.applyStats(this.bai, false);
    if (this.panel) this.act(this.panel);
  }

  /** Nhân vật: ô trang bị quanh chân dung (chưa có đồ rơi nên mới có vũ khí), chỉ số, điểm tiềm năng. */
  private char(): void {
    const s = this.save;
    const b = this.bai!;
    const p = b.player;
    const st = stats(s);
    const pts = statPoints(s);
    const cost = statResetCost(s);
    const spent = Object.values(s.diem ?? {}).some((n) => n > 0);
    const slot = ([id, ten]: string[]) =>
      id === "vu_khi"
        ? `<div class="has" style="background-image:url(${import.meta.env.BASE_URL}icon_ve/trang_bi/kiem/01.webp)"><small>Vũ khí +${s.wpn}</small></div>`
        : `<div><small>${ten}</small></div>`;
    const rows: [string, string | number][] = [
      ["Máu", `${Math.round(p.hp)}/${p.hpMax}`], ["Mana", `${Math.floor(b.mana)}/${b.manaMax}`], ["Công", st.atk], ["Thủ", `+${st.def / 10}%`],
      ["Chí mạng", `${st.crit / 10}%`], ["Sát thương chí mạng", `${150 + st.critDmg / 10}%`], ["Tốc đánh", `+${st.speed / 10}%`],
      ["Giảm hồi chiêu", `${st.cd / 10}%`], ["Giảm mana", `${st.manaCut / 10}%`], ["Linh thạch", s.gold],
    ];
    const attrs = ATTRIBUTES.map((a) => `<div><b>${a.ten}</b><small>${(a as { tomTat?: string }).tomTat ?? ""}</small><i>${s.diem?.[a.id] ?? 0}</i>
      <button type="button" data-stat="${a.id}" ${pts > 0 ? "" : "disabled"}>+</button></div>`).join("");
    this.open(`<h2>Nhân vật</h2><div class="mmo-char">
      <div class="mmo-doll"><div class="mmo-gear">${SLOTS.slice(0, 4).map(slot).join("")}</div>
        <div class="mmo-body"><i class="mmo-face" style="background:${ELEMENT_STYLE[s.element].color}">${esc(s.name.slice(0, 1).toUpperCase())}</i>
          <b>${esc(s.name)}</b><small>Hệ ${ELEMENT_STYLE[s.element].name} · Cấp ${s.lv}</small><small>Tu vi ${s.xp}/${xpNeed(s.lv)}</small></div>
        <div class="mmo-gear">${SLOTS.slice(4).map(slot).join("")}</div></div>
      <dl class="mmo-stats">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("")}</dl></div>
      <h3>Điểm tiềm năng: còn ${pts}</h3><div class="mmo-attr">${attrs}</div>
      <button type="button" data-close>Đóng (P)</button>
      <button type="button" data-statreset class="bad" ${spent && s.gold >= cost ? "" : "disabled"}>Tẩy điểm (${cost ? `${cost} linh thạch` : "miễn phí"})</button>`, true);
  }

  /** Kỹ năng: mỗi chiêu 10 tầng, lên tầng bằng điểm luyện (mỗi cấp 20 điểm), tẩy tầng để chia lại. */
  private skills(): void {
    const s = this.save;
    const b = this.bai!;
    const pts = skillPoints(s);
    const icon = (f: string, k: string) => `<i style="background-image:url(${import.meta.env.BASE_URL}icon_ve/chieu/${f}.webp)"><kbd>${k}</kbd></i>`;
    const rows = BAI.skills.map((sk, i) => {
      const l = layerOf(s, sk);
      const c = layerPrice(s, sk);
      const bo = layerBonus(l);
      return `<div>${icon(sk, `${i + 1} ${KEYS[i].toUpperCase()}`)}<span><b>${SKILL_NAME[sk]} <em>Tầng ${l}/${TECHNIQUE_LAYERS}</em></b>
        <small>${SKILL_DESC[sk] ?? ""} · Mana ${b.manaCost(sk)} · Hồi chiêu ${b.cooldownOf(sk).toFixed(1)}s</small>
        <small>Uy lực +${bo.uyLuc / 10}% · Mana −${bo.mana / 10}% · Hồi chiêu −${bo.hoiChieu / 10}%</small></span>
        <button type="button" data-up="${sk}" ${c !== null && c <= pts ? "" : "disabled"}>${c === null ? "Tối đa" : `Lên tầng (${c})`}</button></div>`;
    }).join("");
    this.open(`<h2>Kỹ năng</h2><h3>Điểm luyện: còn ${pts}</h3><div class="mmo-skl">${rows}
      <div>${icon("tran_phap", "6")}<span><b>Chiêu cuối</b><small>Đánh mạnh mọi dị thú quanh mình khi thanh nội tại đầy · mở ở cấp ${BAI.ultLevel}</small></span><span></span></div></div>
      <button type="button" data-close>Đóng (O)</button>
      <button type="button" data-skreset class="bad" ${Object.keys(s.tang ?? {}).length ? "" : "disabled"}>Tẩy tầng (miễn phí)</button>`, true);
  }

  private help(): void {
    this.open(`<h2>Cách chơi</h2>${HELP}
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
  <li><b>Đánh:</b> chạm dị thú (hoặc phím Cách) để đánh thường; chiêu ở thanh dưới, phím 1–5 hoặc Q W E R T; chiêu cuối phím 6 (mở ở cấp 150).</li>
  <li><b>Z</b> uống bình máu · <b>F</b> treo auto · <b>M</b> truyền tống · <b>B</b> tiệm (ở sơn môn, bến đò).</li>
  <li><b>I</b> túi · <b>P</b> nhân vật (cộng điểm tiềm năng) · <b>O</b> kỹ năng (lên tầng chiêu); nhấn lại để đóng.</li>
  <li>Tiến độ tự lưu trên máy này.</li></ul>`;

const PANELS: Record<string, string> = { i: "bag", p: "char", o: "skills" };
const MENU = [["bag", "I", "Túi"], ["char", "P", "Nhân vật"], ["skills", "O", "Kỹ năng"], ["map", "M", "Bản đồ"], ["shop", "B", "Tiệm"], ["auto", "F", "Treo auto"], ["help", "?", "Trợ giúp"]];
/** Bảy ô trang bị (SlotId của @htk/rules): bốn ô bên trái chân dung, ba ô bên phải. */
const SLOTS = [["mu", "Mũ"], ["ao", "Áo"], ["dai", "Đai"], ["giay", "Giày"], ["vu_khi", "Vũ khí"], ["bao_tay", "Bao tay"], ["ngoc_boi", "Ngọc bội"]];
const esc = (t: string) => t.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
const BAG_SLOTS = 20;
const SKILL_DESC: Record<string, string> = {
  can_quet: "Quét các dị thú quanh mình",
  tam_xa: "Đánh một mục tiêu ở xa",
  dien_rong: "Sát thương cả một vùng",
  ho_the: `Khiên ${BAI.shieldPct * 100}% máu trong ${BAI.shieldSec} giây`,
  hoi_phuc: `Hồi ${BAI.healPct * 100}% máu`,
};

/** Phím chữ của năm chiêu đầu, theo thứ tự ô. */
const KEYS = "qwert";

let styled = false;
function addStyle(): void {
  if (styled) return;
  styled = true;
  const st = document.createElement("style");
  st.textContent = `.mmo-bar{display:grid;gap:4px}
/* Bản PC, bố cục theo mẫu người dùng gửi 2026-11-11: đáy giữa chỉ còn ô chiêu có hình và ô bình máu; máu, mana, tu vi lên khung nhân vật trên trái. */
.mmo-hud kbd{position:absolute;top:1px;left:3px;font:700 10px/1.2 system-ui,sans-serif;color:#f6e3ad;text-shadow:0 1px 0 #000,0 0 3px #000}
.mmo-hud .bai-skills button{position:relative;background-size:cover;background-position:center}
.mmo-top{display:none}
@media (min-width:760px){
.mmo-top{display:block}
.mmo-hud{width:fit-content;margin:0 auto;padding:6px 8px;border:1px solid var(--line);border-bottom:0;border-radius:8px 8px 0 0;grid-template-columns:auto auto;gap:4px 8px;align-items:end}
.mmo-hud .bai-row,.mmo-hud>.hp,.mmo-hud>.mp,.mmo-hud .mmo-bar .xp,.mmo-hud .mmo-btns button:not([data-a="pot"]){display:none}
.mmo-hud .mmo-bar{grid-column:1;grid-row:1}
.mmo-hud .mmo-btns{display:block}
.mmo-hud .mmo-btns [data-a="pot"]{width:66px;height:56px;padding:2px;font-size:10px;line-height:1.25;white-space:normal}
.mmo-hud .bai-skills{grid-column:2;grid-row:1;grid-template-columns:repeat(6,56px)}
.mmo-hud .bai-skills button{height:56px;padding:0;align-content:end;overflow:hidden}
.mmo-hud .bai-skills button:disabled{opacity:1;filter:grayscale(.85) brightness(.55)}
.mmo-hud .bai-skills b{display:none}
.mmo-hud .bai-skills small{background:rgba(0,0,0,.72);font-size:10px;line-height:14px;color:#f6e3ad}
.mmo-hud .ul{grid-column:1/-1;grid-row:2;height:8px}.mmo-hud .ul span{line-height:8px;font-size:8px;text-align:center;padding:0}
.mmo-me,.mmo-quest,.mmo-tgt,.mmo-menu,.mmo-tip{position:fixed;z-index:5;color:#eadfc4;font:12px/1.35 "Lora Variable",Cambria,serif}
.mmo-me{top:8px;left:8px;display:grid;grid-template-columns:56px 200px;gap:8px;align-items:center;padding:6px 10px 6px 6px;background:rgba(15,12,9,.84);border:1px solid #6b4a1c;border-radius:34px 8px 8px 34px}
.mmo-face{display:grid;place-items:center;width:56px;height:56px;border-radius:50%;border:2px solid #d0a85a;font:700 24px "Cormorant Garamond",serif;color:#fff;text-shadow:0 1px 2px #000}
.mmo-me>div{display:grid;gap:3px}.mmo-me .bai-bar{height:13px}.mmo-me .bai-bar span{line-height:13px;font-size:10px}.mmo-me .xp{height:7px}.mmo-me .xp span{display:none}
.mmo-name{color:#f6e3ad;font-size:13px}
.mmo-quest{top:90px;left:8px;width:232px;display:grid;gap:2px;padding:6px 8px;background:rgba(15,12,9,.7);border:1px solid #6b4a1c;border-radius:6px;font-size:11px}
.mmo-quest b{color:#f6e3ad}
.mmo-tgt{top:8px;left:50%;transform:translateX(-50%);width:260px;padding:5px 8px;text-align:center;background:rgba(15,12,9,.84);border:1px solid #6b4a1c;border-radius:6px;color:#f6e3ad}
.mmo-tgt[hidden],.mmo-tip[hidden]{display:none}
.mmo-tgt .bai-bar{height:10px;margin-top:3px}
.mmo-menu{top:112px;right:8px;display:grid;gap:3px;width:122px}
.mmo-menu button{display:flex;gap:6px;align-items:center;height:26px;padding:0 8px;border:1px solid #6b4a1c;border-radius:4px;background:rgba(23,16,10,.88);color:inherit;font:inherit;cursor:pointer}
.mmo-menu button:hover{border-color:#d0a85a}.mmo-menu button.on{border-color:#f6e3ad;color:#f6e3ad}.mmo-menu button:disabled{opacity:.45;cursor:default}
.mmo-menu kbd{min-width:16px;text-align:center;font:700 10px system-ui,sans-serif;color:#d0a85a}
.mmo-tip{z-index:6;transform:translateX(-50%);width:240px;display:grid;gap:3px;padding:8px 10px;background:rgba(15,12,9,.96);border:1px solid #d0a85a;border-radius:4px;pointer-events:none}
.mmo-tip b{color:#f6e3ad;font-size:14px}.mmo-tip em{color:#7fb08c;font-style:normal}
}
.bai-bar.xp{height:12px}.bai-bar.xp i{background:#8e6bd1}.bai-bar.xp span{line-height:12px;font-size:10px}
.mmo-btns{display:grid;grid-template-columns:repeat(4,1fr);gap:4px}
.mmo-bag{display:grid;grid-template-columns:repeat(5,1fr);gap:5px;margin-bottom:10px}
.mmo-dlg .mmo-bag button{aspect-ratio:1;padding:2px;display:grid;align-content:center;font-size:11px;min-width:0}
.mmo-dlg .mmo-bag button:disabled{opacity:1;cursor:default}.mmo-dlg .mmo-bag .empty{opacity:.35}
.mmo-stats{display:grid;grid-template-columns:auto 1fr;gap:4px 14px;margin:0 0 12px}.mmo-stats dt{opacity:.7}.mmo-stats dd{margin:0;font-weight:600}
.mmo-dlg.wide{width:min(660px,94vw)}
.mmo-dlg h3{margin:12px 0 6px;font:700 15px "Lora Variable",Cambria,serif;color:#d0a85a}
.mmo-char{display:grid;grid-template-columns:auto 1fr;gap:18px;align-items:start}
@media (max-width:620px){.mmo-char{grid-template-columns:1fr}}
.mmo-doll{display:grid;grid-template-columns:60px 112px 60px;gap:8px;align-items:center}
.mmo-gear{display:grid;gap:6px}
.mmo-gear div{width:60px;height:60px;display:grid;align-content:end;border:1px solid #6b4a1c;border-radius:4px;background:#0c0a08 center/cover;text-align:center}
.mmo-gear small{font-size:9px;line-height:13px;opacity:.5}.mmo-gear .has{border-color:#d0a85a}.mmo-gear .has small{opacity:1;background:rgba(0,0,0,.72);color:#f6e3ad}
.mmo-body{display:grid;justify-items:center;gap:3px;text-align:center}
.mmo-dlg .mmo-face{display:grid;place-items:center;width:84px;height:84px;border-radius:50%;border:2px solid #d0a85a;font:700 38px "Cormorant Garamond",serif;color:#fff;text-shadow:0 1px 2px #000}
.mmo-attr{display:grid;grid-template-columns:1fr 1fr;gap:6px 16px;margin-bottom:12px}
.mmo-attr div{display:grid;grid-template-columns:1fr auto 30px;gap:0 8px;align-items:center}
.mmo-attr small{grid-column:1;grid-row:2;opacity:.7;font-size:11px}.mmo-attr i{grid-column:2;grid-row:1/3;font-style:normal;font-weight:700;color:#f6e3ad}
.mmo-dlg .mmo-attr button{grid-column:3;grid-row:1/3;padding:2px 0;width:30px}
.mmo-skl{display:grid;gap:8px;margin-bottom:12px}.mmo-skl>div{display:grid;grid-template-columns:52px 1fr auto;gap:0 10px;align-items:center}
.mmo-skl i{position:relative;width:52px;height:52px;border:1px solid #d0a85a;border-radius:4px;background:#0c0a08 center/cover}
.mmo-skl kbd{position:absolute;top:1px;left:3px;font:700 10px system-ui,sans-serif;color:#f6e3ad;text-shadow:0 1px 0 #000,0 0 3px #000}
.mmo-skl span{display:grid;gap:1px}.mmo-skl em{color:#7fb08c;font-style:normal;font-size:12px;font-weight:400}.mmo-skl small{opacity:.75}
.mmo-btns button{min-width:0;height:34px;border:1px solid var(--line);border-radius:6px;background:#241f1a;color:var(--ink);font:inherit;font-size:12px}
.mmo-btns button:disabled{opacity:.45}.mmo-btns button.on{border-color:#d9a12b;color:#ffd34d}
.mmo-dlg{width:min(440px,92vw);max-height:86vh;overflow:auto;padding:16px;border:1px solid #a33;border-radius:10px;background:#fbf3df;color:#2a1d14;font:14px/1.45 "Lora Variable",Cambria,serif}
.mmo-dlg::backdrop{background:rgba(10,8,6,.6)}
.mmo-dlg h2{margin:0 0 6px;font:700 24px "Cormorant Garamond",serif;color:#8c1f17}
.mmo-dlg p{margin:0 0 10px}.mmo-dlg ul{margin:8px 0 12px;padding-left:18px}.mmo-dlg li{margin-bottom:4px}
.mmo-dlg label{display:grid;gap:2px;margin-bottom:8px;font-weight:600}
.mmo-dlg input,.mmo-dlg select{font:inherit;padding:8px;border:1px solid #b9a37a;border-radius:6px;background:#fffaf0;color:inherit}
.mmo-dlg button{font:inherit;padding:8px 14px;border:1px solid #b9a37a;border-radius:6px;background:#fffaf0;color:inherit;cursor:pointer}
.mmo-dlg button:disabled{opacity:.45;cursor:default}
.mmo-dlg button.go{width:100%;background:#8c1f17;border-color:#8c1f17;color:#fffaf0;font-weight:700;font-size:16px}
.mmo-dlg button.bad{color:#8c1f17}.mmo-dlg button.on{border-color:#8c1f17;border-width:2px}
.mmo-list{display:grid;gap:6px;margin-bottom:12px}.mmo-list button{text-align:left;display:grid}.mmo-list small{color:#6b5a45}`;
  document.head.append(st);
}

// Bản MMORPG chơi được (index.html): thế giới là dải khu nối nhau, nhìn 3/4 từ trên, nền vẽ sẵn chien_truong/<vùng>/<khu>.
// Dùng lại trọn màn bãi quái (BaiScene: đi, đánh, chiêu, bot); thêm ở đây: qua khu ở hai mép, cấp và tu vi, linh thạch,
// bình máu, tiệm và truyền tống ở khu an toàn, nhiệm vụ nối tiếp, treo auto, phím tắt, lưu vào localStorage.
// Người chơi khác là bot trong trình duyệt (người dùng chốt 2026-11-09); người thật để tới MVP có máy chủ.
import type { Sprites } from "../../assets/sprites.ts";
import type { View } from "../../app/view.ts";
import type { ElementId } from "../../replay/types.ts";
import { ELEMENT_STYLE } from "../../theme/elements.ts";
import { FONT_DISPLAY, FONT_TEXT, loadCanvasFonts } from "../../theme/fonts.ts";
import { Bai } from "../bai/bai.ts";
import { BaiScene } from "../bai/baiScene.ts";
import { BAI } from "../bai/thamSo.ts";
import { ACT_LABEL, bayTuDong, bossTuDong, choVao, macDinh, mapId, SCALE, type MapKhu } from "./mapKhu.ts";
import { camLop, O_DIR, veLop, type BoODat } from "./oDat.ts";
import {
  atkOf, buyPot, hpOf, kill, newSave, POT_HEAL, potPrice, questText, REGIONS, townOf, upgrade, wpnPrice, xpNeed, zone, ZONE_COUNT,
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
      <button type="button" data-a="shop">B · Tiệm</button><button type="button" data-a="map">M · Bản đồ</button><button type="button" data-a="help">?</button></div>`;
    this.hud.prepend(this.bar);
    this.hud.classList.add("mmo-hud");
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
      w: m.w, h: m.h, monsterLevel: z.level, hp: hpOf(s.lv), atk: atkOf(s.lv, s.wpn), boss: z.boss, blocked: m.cam,
      homes: z.safe ? [] : m.bay.length > 0 ? m.bay : z.boss ? undefined : bayTuDong(m),
      bosses: z.safe || z.boss ? [] : bossTuDong(m),
      entry: choVao(m, this.entry === "left" ? 70 : this.entry === "right" ? m.w - 70 : m.w / 2),
      // Mỗi khu một nhóm tên khác nhau.
      bots: Array.from({ length: z.boss ? 2 : 8 }, (_, i) => NAMES[(s.zone * 5 + i) % NAMES.length]),
      elements: [z.element],
    });
    b.player.name = s.name;
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
    b.level = s.lv;
    p.hpMax = hpOf(s.lv);
    p.atk = atkOf(s.lv, s.wpn);
    if (heal) p.hp = p.hpMax;
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
    if (this.dlg.open || (e.target as HTMLElement).tagName === "INPUT" || e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.toLowerCase();
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
  }

  private syncBar(b: Bai): void {
    const s = this.save;
    const need = xpNeed(s.lv);
    const cd = Math.ceil(this.potAt - this.clock);
    const q = (sel: string) => this.bar.querySelector<HTMLElement>(sel)!;
    q(".xp i").style.width = `${(100 * s.xp) / need}%`;
    q(".xp span").textContent = `Cấp ${s.lv} · Tu vi ${s.xp}/${need}`;
    const pot = q('[data-a="pot"]') as HTMLButtonElement;
    pot.textContent = cd > 0 ? `Z · Bình ×${s.pots} (${cd}s)` : `Z · Bình máu ×${s.pots}`;
    pot.disabled = s.pots <= 0 || cd > 0 || !b.player.alive;
    const auto = q('[data-a="auto"]');
    auto.textContent = this.auto ? "F · Auto bật" : "F · Auto tắt";
    auto.classList.toggle("on", this.auto);
    (q('[data-a="shop"]') as HTMLButtonElement).disabled = !zone(s.zone).safe;
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

  private open(html: string): void {
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
  <li>Tiến độ tự lưu trên máy này.</li></ul>`;

/** Phím chữ của năm chiêu đầu, theo thứ tự ô. */
const KEYS = "qwert";

let styled = false;
function addStyle(): void {
  if (styled) return;
  styled = true;
  const st = document.createElement("style");
  st.textContent = `.mmo-bar{display:grid;gap:4px}
/* Thanh hành động kiểu MMORPG: một bảng gọn giữa đáy màn hình. Trái: máu, mana, nội tại; giữa: ô chiêu có nhãn phím; phải: nút phụ. */
.mmo-hud kbd{position:absolute;top:1px;left:3px;font:700 10px/1.2 system-ui,sans-serif;color:#f6e3ad;text-shadow:0 1px 0 #000}
.mmo-hud .bai-skills button{position:relative}
@media (min-width:760px){
.mmo-hud{width:fit-content;margin:0 auto;padding:6px 10px 6px;border:1px solid var(--line);border-bottom:0;border-radius:8px 8px 0 0;gap:3px 10px;align-items:center;
grid-template-columns:230px auto auto;grid-template-areas:"st st st" "hp sk bt" "mp sk bt" "ul sk bt" "xp xp xp"}
.mmo-hud .mmo-bar{display:contents}
.mmo-hud .bai-row{grid-area:st;font-size:11px;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:780px}
.mmo-hud .hp{grid-area:hp;height:18px}.mmo-hud .mp{grid-area:mp}.mmo-hud .ul{grid-area:ul;height:10px}.mmo-hud .ul span{line-height:10px;font-size:9px}
.mmo-hud .hp span{line-height:18px}
.mmo-hud .xp{grid-area:xp;height:8px}.mmo-hud .xp span{line-height:8px;font-size:8px;text-align:center;padding:0}
.mmo-hud .bai-skills{grid-area:sk;grid-template-columns:repeat(6,58px)}
.mmo-hud .bai-skills button{height:58px;padding:12px 1px 1px}
.mmo-hud .bai-skills b{font-size:10px}
.mmo-hud .mmo-btns{grid-area:bt;grid-template-columns:repeat(2,auto);gap:3px}
.mmo-hud .mmo-btns button{height:26px;padding:0 8px;font-size:11px;white-space:nowrap}
.mmo-hud .mmo-btns [data-a="help"]{grid-column:1/-1;height:20px}
}
.bai-bar.xp{height:12px}.bai-bar.xp i{background:#8e6bd1}.bai-bar.xp span{line-height:12px;font-size:10px}
.mmo-btns{display:grid;grid-template-columns:2fr 1.4fr 1fr 1.2fr .5fr;gap:4px}
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

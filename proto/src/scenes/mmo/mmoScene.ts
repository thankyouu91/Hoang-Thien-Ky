// Bản MMORPG chơi được (choi.html): thế giới là dải khu nối nhau, nhìn 3/4 từ trên, nền vẽ sẵn chien_truong/<vùng>/<khu>.
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
import {
  atkOf, buyPot, hpOf, kill, newSave, POT_HEAL, potPrice, questText, REGIONS, townOf, upgrade, wpnPrice, xpNeed, zone, ZONE_COUNT,
  type Save, type Zone,
} from "./tienTrinh.ts";

/** Nền 688×384 (cỡ lớn nhất PixelLab vẽ một lần) vẽ gấp đôi. */
const W = 1376;
/** Bãi quái rộng gấp chừng này lần nền: ghép nền nối tiếp, tấm lẻ lật gương nên mép khớp nhau không lộ đường nối. */
const WIDE = 3;
const H = 768;
/** Phần trên của nền là tường, gốc cây: không đi lên đó. */
const TOP_PCT = 0.37;
const SAVE_KEY = "htk.mmo.v1";
const POT_CD = 5;
const NAMES = ["Lạc Vân", "Tô Hàn", "Mạc Kỳ", "Diệp Thanh", "Hoa Ảnh", "Trần Phong", "Liễu Sương", "Minh Nguyệt", "Tử Sâm", "Hàn Liên", "Vô Song", "Cố Bắc"];
const ASSET = (p: string) => `${import.meta.env.BASE_URL}pixellab/${p}.png`;

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
    this.camera.minZoom = 0.6;
    this.camera.maxZoom = 2.2;
    this.bar = document.createElement("div");
    this.bar.className = "mmo-bar";
    this.bar.innerHTML = `<div class="bai-bar xp"><i></i><span></span></div>
      <div class="mmo-btns"><button type="button" data-a="pot"></button><button type="button" data-a="auto"></button>
      <button type="button" data-a="shop">Tiệm</button><button type="button" data-a="map">Bản đồ</button><button type="button" data-a="help">?</button></div>`;
    this.hud.prepend(this.bar);
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
  }

  override enter(v: View): void {
    super.enter(v);
    if (this.fresh) this.intro();
    else this.note(zone(this.save.zone).name, true);
  }

  // ---------- Khu ----------

  private size(z: Zone): { w: number; h: number; top: number; file: string; packs: number } {
    const n = z.safe || z.boss ? 1 : WIDE;
    return { w: W * n, h: H, top: H * TOP_PCT, file: `chien_truong/${z.bg}`, packs: z.safe ? 0 : 4 * n };
  }

  protected override makeBai(): Bai {
    const s = this.save;
    const z = zone(s.zone);
    const d = this.size(z);
    const mid = (d.top + d.h) / 2;
    const b = new Bai(s.lv, s.element, s.zone + 1, {
      w: d.w, h: d.h, top: d.top, monsterLevel: z.level, hp: hpOf(s.lv), atk: atkOf(s.lv, s.wpn), packs: d.packs, boss: z.boss,
      entry: { x: this.entry === "left" ? 70 : this.entry === "right" ? d.w - 70 : d.w / 2, y: mid },
      // Khu an toàn đông người hơn bãi quái; mỗi khu một nhóm tên khác nhau.
      bots: Array.from({ length: z.safe ? 6 : z.boss ? 2 : 5 }, (_, i) => NAMES[(s.zone * 5 + i) % NAMES.length]),
      elements: [z.element],
    });
    b.player.name = s.name;
    b.auto = this.auto && !z.safe;
    b.onKill = () => this.onKill(b, z);
    this.img(d.file);
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
      const dx = (k.has("d") || k.has("arrowright") ? 1 : 0) - (k.has("a") || k.has("arrowleft") ? 1 : 0);
      const dy = (k.has("s") || k.has("arrowdown") ? 1 : 0) - (k.has("w") || k.has("arrowup") ? 1 : 0);
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
    const n = Number(k);
    if (n >= 1 && n <= BAI.skills.length) b.cast(BAI.skills[n - 1]);
    else if (k === "6" || k === "r") b.castUlt();
    else if (k === "q") this.act("pot");
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
    pot.textContent = cd > 0 ? `Bình máu ×${s.pots} (${cd}s)` : `Bình máu ×${s.pots}`;
    pot.disabled = s.pots <= 0 || cd > 0 || !b.player.alive;
    const auto = q('[data-a="auto"]');
    auto.textContent = this.auto ? "Auto: bật" : "Auto: tắt";
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

  /** Chỗ đứng của tiệm và trận truyền tống ở khu an toàn. */
  private spots(b: Bai): { file: string; label: string; act: string; x: number; y: number }[] {
    return [
      { file: "cong_trinh/chung/thuong_hoi", label: "Thương hội", act: "shop", x: b.w * 0.36, y: b.top + 30 },
      { file: "cong_trinh/chung/truyen_tong_tran", label: "Truyền tống trận", act: "map", x: b.w * 0.66, y: b.top + 30 },
    ];
  }

  protected override ground(ctx: CanvasRenderingContext2D, b: Bai): void {
    const z = zone(this.save.zone);
    const bg = this.ready(this.size(z).file);
    ctx.imageSmoothingEnabled = false;
    if (bg) {
      for (let i = 0; i * W < b.w; i++) {
        ctx.save();
        ctx.translate(i * W + (i % 2 ? W : 0), 0);
        if (i % 2) ctx.scale(-1, 1);
        // Rộng thêm 1 đơn vị để hai tấm kề nhau không hở khe khi zoom lẻ.
        ctx.drawImage(bg, 0, 0, W + 1, b.h);
        ctx.restore();
      }
    } else {
      ctx.fillStyle = "#39422c";
      ctx.fillRect(0, 0, b.w, b.h);
    }
    const mid = (b.top + b.h) / 2;
    const pulse = 0.55 + 0.25 * Math.sin(this.clock * 3);
    const gate = (x: number, idx: number, dir: 1 | -1) => {
      if (idx < 0 || idx >= ZONE_COUNT) return;
      const g = ctx.createRadialGradient(x, mid, 4, x, mid, 150);
      g.addColorStop(0, `rgba(255, 236, 170, ${pulse})`);
      g.addColorStop(1, "rgba(255, 236, 170, 0)");
      ctx.fillStyle = g;
      ctx.fillRect(x - 150, b.top, 300, b.h - b.top);
      const t = zone(idx);
      this.text(ctx, `${dir < 0 ? "◀ " : ""}${t.name}${t.safe ? "" : ` (cấp ${t.level})`}${dir > 0 ? " ▶" : ""}`, x - dir * 14, mid - 70, dir < 0 ? "left" : "right");
    };
    gate(0, z.idx - 1, -1);
    gate(b.w, z.idx + 1, 1);
    if (!z.safe) return;
    for (const s of this.spots(b)) {
      const im = this.ready(s.file);
      if (im) ctx.drawImage(im, s.x - 110, s.y - 118, 220, 132);
      this.text(ctx, s.label, s.x, s.y + 30, "center");
    }
  }

  private text(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, align: CanvasTextAlign): void {
    ctx.font = `700 15px ${FONT_TEXT}`;
    ctx.textAlign = align;
    ctx.lineWidth = 4;
    ctx.strokeStyle = "rgba(20, 14, 8, 0.85)";
    ctx.strokeText(text, x, y);
    ctx.fillStyle = "#ffe9a8";
    ctx.fillText(text, x, y);
  }

  protected override tap(sx: number, sy: number): void {
    const b = this.bai;
    const d = this.down;
    if (b && d && this.view && zone(this.save.zone).safe && Math.hypot(sx - d.x, sy - d.y) <= 10) {
      const p = this.camera.toWorld(sx, sy, this.view);
      const hit = this.spots(b).find((s) => Math.abs(p.x - s.x) < 100 && p.y > s.y - 118 && p.y < s.y + 36);
      if (hit) {
        this.down = null;
        this.act(hit.act);
        return;
      }
    }
    super.tap(sx, sy);
  }

  override draw(v: View): void {
    super.draw(v);
    const b = this.bai;
    if (!b) return;
    const ctx = v.ctx;
    ctx.setTransform(v.dpr, 0, 0, v.dpr, 0, 0);
    // Bản đồ nhỏ góc phải: chấm quái đỏ, người khác xanh, mình vàng.
    const mw = Math.min(b.w > W ? 280 : 150, v.w * 0.4);
    const mh = (mw * (b.h - b.top)) / b.w;
    const mx = v.w - mw - 8;
    ctx.fillStyle = "rgba(20, 14, 8, 0.6)";
    ctx.fillRect(mx - 2, 6, mw + 4, mh + 4);
    for (const a of b.actors) {
      if (!a.alive) continue;
      ctx.fillStyle = a.kind === "monster" ? "#e0553f" : a.kind === "bot" ? "#9cc7e6" : "#ffd34d";
      const r = a.kind === "player" ? 3 : a.boss ? 4 : 2;
      ctx.fillRect(mx + (a.x / b.w) * mw - r / 2, 8 + ((a.y - b.top) / (b.h - b.top)) * mh - r / 2, r, r);
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
  <li><b>Đi:</b> chạm đất, hoặc phím W A S D / mũi tên. Đi tới mép sáng hai bên để sang khu khác.</li>
  <li><b>Đánh:</b> chạm dị thú (hoặc phím Cách) để đánh thường; chiêu ở thanh dưới, phím 1–5; chiêu cuối phím R (mở ở cấp 150).</li>
  <li><b>Q</b> uống bình máu · <b>F</b> treo auto · <b>M</b> truyền tống · <b>B</b> tiệm (ở sơn môn, bến đò).</li>
  <li>Tiến độ tự lưu trên máy này.</li></ul>`;

let styled = false;
function addStyle(): void {
  if (styled) return;
  styled = true;
  const st = document.createElement("style");
  st.textContent = `.mmo-bar{display:grid;gap:4px}
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

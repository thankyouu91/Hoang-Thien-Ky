// Màn bãi quái mẫu (#bai): vẽ bãi, người chơi, bot và quái; chạm đất để đi, chạm quái để đánh; thanh HP, Mana, nội tại chiêu
// cuối và thanh chiêu ở HUD. Logic ở bai.ts. Hình dùng lại: nhân vật ghép và dáng của màn Trận, thú cưỡi cho dị thú, nền sân
// Three.js cao nguyên, hạt họa tiết hệ cho chiêu.
import type { Sprites } from "../../assets/sprites.ts";
import { Camera } from "../../app/camera.ts";
import type { Scene } from "../../app/scene.ts";
import type { View } from "../../app/view.ts";
import { tr } from "../../dashboard/i18n.ts";
import { burst } from "../../hieu_ung/motifs.ts";
import { beastSprite } from "../../replay/simSource.ts";
import type { Look } from "../../replay/types.ts";
import { ELEMENT_STYLE, SKILL_NAME } from "../../theme/elements.ts";
import { FONT_TEXT } from "../../theme/fonts.ts";
import { createArenaBackdrop, type ArenaBackdrop } from "../../three/index.ts";
import { animInfo, drawCharacter, resolveLook, type Anim } from "../battle/character.ts";
import { Bai, type Actor } from "./bai.ts";
import { BAI, ultPoints } from "./thamSo.ts";
import { VfxSf, type Nhin } from "./vfxSf.ts";

const SIZE = 56; // cạnh hình người, đơn vị thế giới
const TAP_PICK = 40; // chạm cách quái chừng này thì tính là chạm quái
const RING = { player: "#f2e6c8", bot: "#9cc7e6", monster: "#d6372a" };
export const LOOKS: Look[] = [
  { body: "nam_khoe", outfit: "dao_bao", weapon: "kiem", hat: "ngoc_quan" },
  { body: "nu_manh", outfit: "tu_duoc", weapon: "truong" },
  { body: "nam_khoe", outfit: "tu_ren" },
  { body: "nu_khoe", outfit: "sat_thu" },
  { body: "nam_manh", outfit: "tu_tran", hat: "o_sa" },
  { body: "nu_manh", outfit: "vo_phuc", weapon: "dao", hat: "non_la" },
  { body: "nam_manh", outfit: "tu_kim_tien" },
  { body: "nu_khoe", outfit: "tu_dan", hat: "non_la" },
];

/** Cấp người chơi: bản thử chưa nối dữ liệu nhân vật nên mặc định cấp 1; thêm ?cap=160 trên URL để thử chiêu cuối. */
function playerLevel(): number {
  const n = Number(new URLSearchParams(location.search).get("cap"));
  return Number.isFinite(n) && n > 0 ? n : 1;
}

export class BaiScene implements Scene {
  readonly id: string = "bai";
  readonly label: string = "Bãi quái";
  readonly camera = new Camera();
  readonly hud: HTMLElement;
  protected sprites: Sprites;
  protected bai: Bai | null = null;
  /** Hình của người chơi trong LOOKS (scenes/mmo đổi theo giới tính) */
  protected playerLook = 0;
  private backdrop: ArenaBackdrop | null = null;
  private active = false;
  protected down: { x: number; y: number } | null = null;
  protected view: View | null = null;
  private shown = "";

  constructor(sprites: Sprites) {
    this.sprites = sprites;
    this.hud = document.createElement("div");
    this.hud.className = "bai-hud";
    this.hud.innerHTML = `
      <div class="bai-row"><span class="bai-tv"></span></div>
      <div class="bai-bar hp"><i></i><span></span></div>
      <div class="bai-bar mp"><i></i><span></span></div>
      <div class="bai-bar ul"><i></i><span></span></div>
      <div class="bai-skills">
        ${BAI.skills.map((s) => `<button type="button" data-s="${s}"><b>${SKILL_NAME[s]}</b><small></small></button>`).join("")}
        <button type="button" data-ult class="ult"><b>Chiêu cuối</b><small></small></button>
      </div>`;
    this.hud.addEventListener("click", (e) => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>("button");
      if (!b || !this.bai) return;
      if (b.dataset.ult !== undefined) this.bai.castUlt();
      else if (b.dataset.s) this.bai.cast(b.dataset.s as (typeof BAI.skills)[number]);
    });
    addStyle();
  }

  enter(v: View): void {
    this.active = true;
    this.view = v;
    this.bai ??= this.makeBai();
    this.camera.zoom = Math.max(0.6, Math.min(1.3, v.w / 520));
    this.follow(1);
    const canvas = v.ctx.canvas;
    if (!canvas.dataset.bai) {
      // Chạm (bấm thả, không kéo) trên canvas: đi tới hay đánh quái. Kéo và chụm hai ngón vẫn là của camera chung.
      canvas.dataset.bai = "1";
      canvas.addEventListener("pointerdown", (e) => (this.down = { x: e.offsetX, y: e.offsetY }));
      canvas.addEventListener("pointerup", (e) => this.tap(e.offsetX, e.offsetY));
    }
  }

  /** Khu đang chơi; scenes/mmo ghi đè để dựng từng khu của thế giới. */
  protected makeBai(): Bai {
    return new Bai(playerLevel());
  }

  /** Vẽ nền khu; mặc định là sân Three.js cao nguyên của bãi mẫu. */
  protected ground(ctx: CanvasRenderingContext2D, b: Bai): void {
    this.backdrop ??= createArenaBackdrop("cao_nguyen", { length: b.w, halfCross: b.h / 2 });
    ctx.save();
    ctx.translate(0, b.h / 2);
    const ok = this.backdrop.draw(ctx, performance.now() / 1000, false);
    ctx.restore();
    if (!ok) {
      ctx.fillStyle = "#5d6a43";
      ctx.fillRect(0, 0, b.w, b.h);
    }
  }

  /** Dòng trạng thái trên cùng của HUD. */
  protected statusLine(b: Bai): string {
    return `${tr("Tu vi")} +${b.tuVi} · ${b.kills} ${tr("dị thú")} · ${tr("Cấp")} ${b.level}`;
  }

  leave(): void {
    this.active = false;
  }

  protected tap(sx: number, sy: number): void {
    const d = this.down;
    this.down = null;
    if (!this.active || !this.bai || !this.view || !d || Math.hypot(sx - d.x, sy - d.y) > 10) return;
    const p = this.camera.toWorld(sx, sy, this.view);
    const hit = this.bai.actors.find((a) => a.kind === "monster" && a.alive && Math.hypot(a.x - p.x, a.y - SIZE / 3 - p.y) < TAP_PICK);
    if (hit) this.bai.attack(hit.id);
    else this.bai.moveTo(p.x, p.y);
  }

  /** Camera bám theo người chơi, không lộ phần ngoài bãi; k là phần quãng còn lại đi trong một khung. */
  protected follow(k: number): void {
    const b = this.bai!;
    const p = b.player;
    const c = this.camera;
    c.x += (p.x - c.x) * k;
    c.y += (p.y - c.y) * k;
    const v = this.view;
    if (!v) return;
    const clamp = (val: number, half: number, size: number) => (size <= 2 * half ? size / 2 : Math.max(half, Math.min(size - half, val)));
    c.x = clamp(c.x, v.w / 2 / c.zoom, b.w);
    c.y = clamp(c.y, (v.h - v.bottom) / 2 / c.zoom, b.h);
  }

  update(dt: number): void {
    if (!this.bai) return;
    this.vfx.update(dt);
    this.bai.step(Math.min(dt, 0.1));
    this.follow(Math.min(1, dt * 6));
    this.syncHud();
  }

  /** Hiệu ứng Sprite Fusion (src/vfx_sf); mỗi sự kiện fx của bãi chỉ sinh hiệu ứng một lần. */
  protected readonly vfx = new VfxSf();
  private daVe = new WeakSet<object>();

  /** Vùng thế giới đang hiện trên màn. */
  protected nhin(v: View): Nhin {
    const z = this.camera.zoom;
    return { x: this.camera.x - v.w / 2 / z, y: this.camera.y - (v.h - v.bottom) / 2 / z, w: v.w / z, h: v.h / z };
  }

  /** Sinh hiệu ứng cho các sự kiện mới của bãi. */
  private sinhVfx(b: Bai): void {
    for (const f of b.fx) {
      if (this.daVe.has(f)) continue;
      this.daVe.add(f);
      if (f.kind === "skill") {
        if (f.skill === "hoi_phuc") this.vfx.hoiPhuc(f.x, f.y);
        else if (f.skill === "ho_the") this.vfx.hoThe(f.x, f.y, BAI.shieldSec);
        else this.vfx.danh(f.el, f.skill, f.x, f.y, f.r ?? 60, f.dir ?? 1);
      } else if (f.kind === "ult") this.vfx.chieuCuoi(f.el, f.x, f.y, f.r ?? BAI.ultRadius);
      else if (f.kind === "hit" && f.me) this.vfx.trungDon(f.x, f.y, f.dir ?? 1);
    }
  }

  draw(v: View): void {
    const b = this.bai;
    if (!b) return;
    this.view = v;
    const ctx = v.ctx;
    this.camera.apply(v);
    this.ground(ctx, b);
    this.sinhVfx(b);
    const p = b.player;
    const tgt = b.get(p.target);
    if (p.goal) this.ring(ctx, p.goal.x, p.goal.y, 10, "rgba(255, 250, 240, 0.7)");
    if (tgt?.alive) this.ring(ctx, tgt.x, tgt.y, 26, "#ffd34d");
    for (const a of [...b.actors].filter((a) => a.alive).sort((x, y) => x.y - y.y)) this.drawActor(ctx, b, a);
    this.vfx.draw(ctx, this.nhin(v));
    this.drawFx(ctx, b);
  }

  private ring(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string): void {
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.38, 0, 0, Math.PI * 2);
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  private drawActor(ctx: CanvasRenderingContext2D, b: Bai, a: Actor): void {
    ctx.imageSmoothingEnabled = false;
    this.ring(ctx, a.x, a.y, 20, RING[a.kind]);
    const mirror = a.face < 0;
    let top = a.y - SIZE;
    if (a.kind === "monster") {
      const img = this.sprites.get(beastSprite(a.element, a.id));
      const s = SIZE * (a.boss ? 2.6 : 1.15);
      if (img) {
        ctx.save();
        ctx.translate(a.x, 0);
        if (mirror) ctx.scale(-1, 1);
        ctx.globalAlpha = b.t - a.hurtAt < 0.1 ? 0.6 : 1;
        ctx.drawImage(img, -s / 2, a.y - s + 6, s, s);
        ctx.restore();
      } else this.blob(ctx, a);
      top = a.y - s;
    } else {
      const want = LOOKS[(a.id === 1 ? this.playerLook : a.id - 99) % LOOKS.length];
      const look = resolveLook(this.sprites, want);
      const anim = this.anim(b, a, look);
      if (look && anim) drawCharacter(ctx, this.sprites, look, anim.anim, anim.frame, a.x, a.y, SIZE / 64, mirror);
      else this.blob(ctx, a);
      // Camera lùi xa (scenes/mmo) thì chữ vẫn giữ cỡ đọc được trên màn hình.
      ctx.font = `600 ${11 / Math.min(1, this.camera.zoom)}px ${FONT_TEXT}`;
      ctx.textAlign = "center";
      ctx.fillStyle = a.kind === "player" ? "#ffd34d" : "#fffaf0";
      ctx.fillText(a.kind === "player" ? tr(a.name) : a.name, a.x, top - 12);
    }
    if ((a.stunUntil ?? 0) > b.t) {
      ctx.font = `700 ${11 / Math.min(1, this.camera.zoom)}px ${FONT_TEXT}`;
      ctx.textAlign = "center";
      ctx.fillStyle = "#ffd34d";
      ctx.fillText("✦ Choáng", a.x, top - 24);
    }
    // Thanh máu trên đầu
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.fillRect(a.x - 21, top - 8, 42, 5);
    ctx.fillStyle = a.kind === "monster" ? "#e0553f" : "#7bc96f";
    ctx.fillRect(a.x - 20, top - 7, (40 * a.hp) / a.hpMax, 3);
  }

  /** Hoạt ảnh theo lúc ra đòn và lúc di chuyển; null khi chưa có hình. */
  private anim(b: Bai, a: Actor, look: Look | undefined): { anim: Anim; frame: number } | null {
    if (!look) return null;
    const pick = (anim: Anim, since: number, loop: boolean) => {
      const info = animInfo(this.sprites, look, anim);
      if (!info) return null;
      const f = Math.floor(since * info.fps);
      return loop || f < info.frames ? { anim, frame: loop ? f % info.frames : f } : null;
    };
    const moving = !!a.goal || (!!a.target && (b.get(a.target)?.alive ?? false) && b.t - a.actAt > 1);
    return (
      pick("ra_chieu_chem", b.t - a.actAt, false) ??
      pick("ra_chieu", b.t - a.actAt, false) ??
      (moving ? pick("chay", b.t, true) : null) ??
      pick("dung", b.t + a.id * 0.37, true)
    );
  }

  private blob(ctx: CanvasRenderingContext2D, a: Actor): void {
    ctx.beginPath();
    ctx.arc(a.x, a.y - 18, 16, 0, Math.PI * 2);
    ctx.fillStyle = ELEMENT_STYLE[a.element].color;
    ctx.fill();
  }

  /** Số sát thương bay lên, chiêu là chùm hạt họa tiết hệ, chiêu cuối là chùm lớn. */
  private drawFx(ctx: CanvasRenderingContext2D, b: Bai): void {
    ctx.textAlign = "center";
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(0, 0, 0, 0.75)";
    b.fx.forEach((f, i) => {
      const age = b.t - f.t;
      // Chiêu và chiêu cuối vẽ bằng vfx (sinhVfx); giữ vòng hạt cũ cho chiêu cuối để thấy rõ bán kính.
      if (f.kind === "ult") {
        burst(ctx, f.el, f.x, f.y - 20, age / 1.1, i * 7919 + Math.floor(f.t * 10), 28, f.r ?? 60, 9);
        return;
      }
      if (f.kind === "skill") return;
      if (age > 0.8 || !f.amount) return;
      ctx.globalAlpha = 1 - age / 0.8;
      ctx.font = `bold ${15 / Math.min(1, this.camera.zoom)}px ${FONT_TEXT}`;
      const text = (f.kind === "heal" ? "+" : "") + f.amount;
      const y = f.y - SIZE - 14 - age * 40;
      ctx.strokeText(text, f.x, y);
      ctx.fillStyle = f.kind === "heal" ? "#7bc96f" : "#fbf6ec";
      ctx.fillText(text, f.x, y);
      ctx.globalAlpha = 1;
    });
  }

  /** HUD: chỉ chạm DOM khi số hiển thị đổi. */
  private syncHud(): void {
    const b = this.bai!;
    const p = b.player;
    const pts = ultPoints(b.level);
    type Sk = (typeof BAI.skills)[number];
    const btns = [...this.hud.querySelectorAll<HTMLButtonElement>("[data-s]")];
    const cds = btns.map((x) => Math.ceil(b.cooldown(x.dataset.s as Sk)));
    const status = this.statusLine(b);
    const key = [Math.round(p.hp), p.hpMax, Math.round(p.shield), Math.floor(b.mana), Math.floor(b.ult * 100), status, cds.join(), btns.map((x) => x.dataset.s).join()].join("|");
    if (key === this.shown) return;
    this.shown = key;
    const q = (s: string) => this.hud.querySelector<HTMLElement>(s)!;
    q(".bai-tv").textContent = status;
    q(".hp i").style.width = `${(100 * p.hp) / p.hpMax}%`;
    q(".hp span").textContent = `HP ${Math.round(p.hp)}/${p.hpMax}${p.shield > 0 ? ` +${Math.round(p.shield)}` : ""}`;
    q(".mp i").style.width = `${(100 * b.mana) / b.manaMax}%`;
    q(".mp span").textContent = `Mana ${Math.floor(b.mana)}/${b.manaMax}`;
    q(".ul i").style.width = `${100 * b.ult}%`;
    q(".ul span").textContent = `${tr("Nội tại")} ${Math.floor(b.ult * 100)}%`;
    btns.forEach((btn, i) => {
      const cd = cds[i];
      const cost = b.manaCost(btn.dataset.s as Sk);
      btn.querySelector("small")!.textContent = cd > 0 ? `${cd}s` : `${cost} Mana`;
      btn.disabled = cd > 0 || b.mana < cost;
      btn.dataset.cd = cd > 0 ? String(cd) : ""; // cho CSS của scene con vẽ số hồi chiêu đè lên hình chiêu
    });
    const ult = q("[data-ult]") as HTMLButtonElement;
    ult.querySelector("small")!.textContent = pts === 0 ? tr("Mở ở cấp 150") : `${pts} ${tr("điểm")}`;
    ult.disabled = pts === 0 || b.ult < 1;
  }
}

let styled = false;
function addStyle(): void {
  if (styled) return;
  styled = true;
  const st = document.createElement("style");
  st.textContent = `.bai-hud{padding:6px 10px 8px;background:var(--panel);border-top:1px solid var(--line);display:grid;gap:4px}
.bai-row{font-size:13px;color:var(--muted)}
.bai-bar{position:relative;height:16px;border-radius:4px;background:#241f1a;overflow:hidden}
.bai-bar i{position:absolute;inset:0 auto 0 0;display:block}
.bai-bar.hp i{background:#5aa35a}.bai-bar.mp i{background:#3f86c4}.bai-bar.ul i{background:#d9a12b}
.bai-bar span{position:relative;display:block;padding-left:6px;font-size:11px;line-height:16px;color:#fffaf0}
.bai-skills{display:grid;grid-template-columns:repeat(6,1fr);gap:4px}
.bai-skills button{min-width:0;height:48px;padding:2px;border:1px solid var(--line);border-radius:6px;background:#241f1a;color:var(--ink);font:inherit;display:grid;align-content:center}
.bai-skills b{font-size:11px;line-height:1.15}.bai-skills small{font-size:10px;color:var(--muted)}
.bai-skills button:disabled{opacity:.45}.bai-skills .ult{border-color:var(--seal)}`;
  document.head.append(st);
}

// Cầu nối tới bộ hiệu ứng Sprite Fusion (src/vfx_sf, MIT): các hiệu ứng vẽ vào một khung điểm ảnh (Frame) rồi khung đó được
// dán lên canvas thế giới. Toạ độ truyền vào là đơn vị thế giới; một điểm ảnh khung = 2 đơn vị (PX của bộ hiệu ứng), nên
// hiệu ứng có hạt to cỡ hạt nhân vật (người cao 56 đơn vị = 28 điểm ảnh).
import type { ElementId } from "../../replay/types.ts";
import type { SkillType } from "@htk/sim";
import embers from "../../vfx_sf/embers.ts";
import energy from "../../vfx_sf/energy.ts";
import explosion from "../../vfx_sf/explosion.ts";
import fallingLeaves from "../../vfx_sf/falling-leaves.ts";
import fire from "../../vfx_sf/fire.ts";
import fireflies from "../../vfx_sf/fireflies.ts";
import fog from "../../vfx_sf/fog.ts";
import heal from "../../vfx_sf/heal.ts";
import holyLight from "../../vfx_sf/holy-light.ts";
import ice from "../../vfx_sf/ice.ts";
import impact from "../../vfx_sf/impact.ts";
import lightning from "../../vfx_sf/lightning.ts";
import poison from "../../vfx_sf/poison.ts";
import shield from "../../vfx_sf/shield.ts";
import slash from "../../vfx_sf/slash.ts";
import snow from "../../vfx_sf/snow.ts";

const PX = 2;

interface Frame {
  w: number;
  h: number;
  ox: number;
  oy: number;
  color: Uint32Array;
  light: Uint32Array;
}
interface Fx {
  update(dt: number): void;
  draw(f: Frame, layer: "back" | "front"): void;
}
/** Hiệu ứng của bộ không báo lúc xong, nên mỗi cái sống một quãng cố định rồi bị bỏ. */
const SONG = 3.2;
/** Vùng nhìn theo đơn vị thế giới. */
export interface Nhin {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Màu hệ cho các hiệu ứng nhận bảng màu: sáng → tối. */
const RAMP: Partial<Record<ElementId, string[]>> = {
  kim: ["#ffffff", "#f1f3f7", "#d9dde3", "#aeb6c2", "#7d8795", "#4e5765", "#2a303b"],
  moc: ["#ffffff", "#e6ffdc", "#acff92", "#62e26a", "#3f9b4b", "#20804c", "#175237"],
  tho: ["#ffffff", "#f3e2b8", "#d9b56b", "#b58a3c", "#8a6428", "#5c4219", "#33250e"],
  phong: ["#ffffff", "#eafff6", "#b8f5dd", "#7fdcb8", "#4fb391", "#2f7d66", "#1b4a3d"],
  quang: ["#ffffff", "#fff8d6", "#ffe99a", "#ffd34d", "#e0a82a", "#9c6f14", "#5a3f0a"],
  cuc_duong: ["#ffffff", "#fff3a6", "#ffc23d", "#ff8a2a", "#f2561d", "#c9281f", "#8a1f17"],
};

/**
 * Hiệu ứng riêng của hệ, bản gọn (một mục tiêu) và bản rộng. Tất cả là đề xuất; hệ chưa có kiểu riêng thì dùng năng lượng tô màu hệ.
 * Toạ độ (x, y) là chân mục tiêu; r là bán kính chiêu (đơn vị thế giới).
 */
function theoHe(el: ElementId, wide: boolean, x: number, y: number, r: number, seed: number, to: number): Fx {
  const size = Math.max(0.6, Math.min(2, r / 70));
  switch (el) {
    case "hoa":
    case "cuc_duong":
      return wide
        ? explosion({ x, y, ground: y, size: size * 0.8, seed })
        : fire({ box: [x - 14, y - 34, 28, 34], size: 0.9, duration: 0.9, seed });
    case "loi":
      return lightning({ kind: wide ? "strike" : "impact", x, y, ground: y, size: wide ? 0.7 : 0.6, clouds: false, top: y - 260, seed });
    case "thuy":
    case "cuc_han":
      return ice({ kind: wide ? "nova" : "spikes", x, ground: y, size: wide ? size : 0.6, count: wide ? undefined : 3, seed, end: "shatter" });
    case "am_lanh":
    case "cuc_am":
      return poison({ kind: wide ? "cloud" : "puddle", x, ground: y, size: wide ? size : 0.6, seed });
    case "quang":
      return holyLight({ x, y, ground: y, hold: wide ? 0.5 : 0.2, width: wide ? 13 : 7, seed });
    case "kim":
    case "phong":
      return slash({ x, y: y - 18, size: 0.9, facing: to, ground: y, ramp: RAMP[el]!.map(hex), seed });
    default:
      return energy({ kind: wide ? "orb" : "bolt", x, y: y - 20, to: [x, y - 20], ground: y, colors: RAMP[el]?.map(hex), hold: wide ? 0.6 : 0.2, radius: wide ? r / PX : undefined, seed });
  }
}

/**
 * Hiệu ứng của một chiêu: dáng theo loại chiêu (chém, đâm, nổ, vòng trận…), màu và chất theo hệ (theoHe).
 * Phân bổ lại 2026-11-11 theo yêu cầu người dùng; skill undefined là đòn không thuộc loại nào (dùng bản gọn của hệ).
 */
function chieu(el: ElementId, skill: SkillType | undefined, x: number, y: number, r: number, seed: number, to: number): Fx[] {
  const ramp = (RAMP[el] ?? RAMP.kim!).map(hex);
  const he = (wide: boolean) => theoHe(el, wide, x, y, r, seed, to);
  const chem = (size: number, facing: number, k = 0) => slash({ x, y: y - 18, size, facing, ground: y, ramp, seed: seed + k });
  const vong = (hold: number, radius: number) => energy({ kind: "orb", x, y: y - 20, to: [x, y - 20], ground: y, colors: ramp, hold, radius, seed });
  switch (skill) {
    case "can_quet": return [chem(1.2, to)]; // một nhát quét rộng màu hệ
    case "can_don": return [chem(1.5, to), impact({ x, y: y - 20, size: 0.9, angle: to > 0 ? 0 : Math.PI, ground: y, seed })]; // nhát nặng kèm tia chạm
    case "than_phap": return [chem(1, to), chem(1, -to, 7)]; // hai nhát chéo của cú lướt
    case "khong_che": return [vong(1.4, 20), he(false)]; // quả cầu trói giữ lâu
    case "bua_chu": return [explosion({ x, y, ground: y, size: 0.6, seed }), he(false)]; // bùa nổ rồi chất của hệ bám lại
    case "tran_phap": return [vong(1, r / PX), he(true)]; // vòng trận lớn rồi hệ bung rộng
    case "dien_rong": return [he(true)];
    default: return [he(false)]; // tầm xa
  }
}

function hex(h: string): number {
  const v = parseInt(h.slice(1), 16);
  return (255 << 24) | ((v & 255) << 16) | (((v >> 8) & 255) << 8) | ((v >> 16) & 255);
}

export class VfxSf {
  private list: { fx: Fx; het: number }[] = [];
  private t = 0;
  private nen: Fx | null = null;
  private nenKind = "";
  private cv = document.createElement("canvas");
  private cvSang = document.createElement("canvas");
  private frame: Frame = { w: 0, h: 0, ox: 0, oy: 0, color: new Uint32Array(0), light: new Uint32Array(0) };
  private seed = 1;

  /** Chiêu đánh (hoặc chiêu cuối với skill undefined, r lớn) nổ tại mục tiêu. */
  danh(el: ElementId, skill: SkillType | undefined, x: number, y: number, r: number, to: number): void {
    for (const fx of chieu(el, skill, x, y, r, this.seed++, to)) this.them(fx);
  }
  private them(fx: Fx, song = SONG): void {
    this.list.push({ fx, het: this.t + song });
  }
  /** Chiêu cuối: nổ lớn tô màu hệ. */
  chieuCuoi(el: ElementId, x: number, y: number, r: number): void {
    this.them(explosion({ x, y, ground: y, size: Math.min(2.5, r / 90), seed: this.seed++ }));
    this.them(theoHe(el, true, x, y, r, this.seed++, 1));
  }
  hoiPhuc(x: number, y: number): void {
    this.them(heal({ x, y, kind: "heal", seed: this.seed++ }));
  }
  hoThe(x: number, y: number, giay: number): void {
    this.them(shield({ x, y: y - 24, radius: 40, hold: giay, ground: y, seed: this.seed++ }), giay + 1.5);
  }
  /** Trúng đòn thường: tia lửa nhỏ. */
  trungDon(x: number, y: number, tu: number): void {
    this.them(impact({ x, y: y - 20, size: 0.5, angle: tu > 0 ? 0 : Math.PI, ground: y, seed: this.seed++ }), 1.2);
  }

  /**
   * Hiệu ứng nền theo hệ của vùng (lá rơi, đom đóm, tàn lửa, tuyết, sương), phủ vùng nhìn; đổi hệ thì thay.
   * shortcut: vùng phủ lấy theo vùng nhìn lúc gọi, camera đi xa hơn thì thưa; cập nhật lại mỗi khi vào khu.
   */
  nenTheo(el: ElementId | null, nhin: Nhin): void {
    const kind = el === null ? "" : ({ moc: "la", phong: "la", hoa: "lua", cuc_duong: "lua", cuc_han: "tuyet", am_lanh: "suong", cuc_am: "suong", quang: "dom" } as Partial<Record<ElementId, string>>)[el] ?? "";
    if (kind === this.nenKind) return;
    this.nenKind = kind;
    const area = { x: nhin.x - 200, y: nhin.y - 200, w: nhin.w + 400, h: nhin.h + 400 };
    const ground = nhin.y + nhin.h + 200;
    this.nen =
      kind === "la" ? fallingLeaves({ area, ground, leaves: 26, litter: false, seed: 3 })
      : kind === "lua" ? embers({ area, density: 0.6, seed: 3 })
      : kind === "tuyet" ? snow({ area, ground, density: 0.7, seed: 3 })
      : kind === "suong" ? fog({ area, density: 0.6, seed: 3 })
      : kind === "dom" ? fireflies({ area, ground, grass: false, seed: 3 })
      : null;
  }

  update(dt: number): void {
    const d = Math.min(dt, 0.05);
    this.t += d;
    for (const f of this.list) f.fx.update(d);
    this.list = this.list.filter((f) => f.het > this.t);
    this.nen?.update(d);
  }

  /** Vẽ cả hai lớp lên ctx đang ở phép biến đổi thế giới; `nhin` là vùng thế giới đang hiện. */
  draw(ctx: CanvasRenderingContext2D, nhin: Nhin): void {
    if (this.list.length === 0 && !this.nen) return;
    const f = this.frame;
    f.ox = Math.floor(nhin.x / PX) - 1;
    f.oy = Math.floor(nhin.y / PX) - 1;
    const w = Math.ceil(nhin.w / PX) + 3;
    const h = Math.ceil(nhin.h / PX) + 3;
    if (w !== f.w || h !== f.h) {
      f.w = w;
      f.h = h;
      f.color = new Uint32Array(w * h);
      f.light = new Uint32Array(w * h);
      this.cv.width = this.cvSang.width = w;
      this.cv.height = this.cvSang.height = h;
    } else {
      f.color.fill(0);
      f.light.fill(0);
    }
    const all = this.nen ? [this.nen, ...this.list.map((f) => f.fx)] : this.list.map((f) => f.fx);
    for (const x of all) x.draw(f, "back");
    for (const x of all) x.draw(f, "front");
    const c = this.cv.getContext("2d")!;
    c.putImageData(new ImageData(new Uint8ClampedArray(f.color.buffer as ArrayBuffer), w, h), 0, 0);
    const s = this.cvSang.getContext("2d")!;
    s.putImageData(new ImageData(new Uint8ClampedArray(f.light.buffer as ArrayBuffer), w, h), 0, 0);
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.cv, f.ox * PX, f.oy * PX, w * PX, h * PX);
    ctx.globalCompositeOperation = "lighter";
    ctx.drawImage(this.cvSang, f.ox * PX, f.oy * PX, w * PX, h * PX);
    ctx.restore();
  }
}

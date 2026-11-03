// Bản đồ mini (GDD mục 14): cảnh vùng thu nhỏ làm nền (data/maps/ha_mini/<vùng>.webp, rừng, đồng cỏ, sa mạc và viền vùng
// nét mực đã vẽ sẵn), sương mù giấy nhạt để vẫn thấy cảnh, và ít chấm có viền mực: vị trí của mình, sơn môn của mình,
// thành chủ, điểm có chủ, điểm đang bị đánh (nhấp nháy), cửa bí cảnh đang mở; khung đỏ mảnh là phần bản đồ tranh đang xem.
// Đang có chiến tranh hay Yêu Triều thì điểm của sự kiện nhấp nháy đỏ và viền khung mini nhấp nháy đỏ.
import { along, loadRegion, miniUrl, route, type RegionMap } from "../scenes/map/region.ts";
import type { MiniMapView, Owner } from "./source.ts";

// Bảng màu sáng (giấy kem, 2026-11-03): chấm có viền mực mảnh.
export const OWNER_COLOR: Record<Owner, string> = {
  minh: "#e0a020", // màu tông môn mình
  dong_minh: "#2f6fb0", // màu liên minh
  dich: "#a0523c",
  npc: "#8c7f6c",
};
const ATTACKED = "#d92d20";
const PAPER = "#efe5cf";
/** Sương là lớp giấy nửa trong, vẫn thấy cảnh bên dưới. */
const FOG = "rgba(239, 229, 207, 0.5)";
const INK = "#2a2018";
const DOT_EDGE = "rgba(42, 32, 24, 0.7)";
const FRAME = "rgba(138, 31, 22, 0.85)";

export interface Viewport {
  /** Phần bản đồ tranh đang xem, theo toạ độ điểm của vùng. */
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Ảnh nền mini dùng chung giữa các khung (mỗi vùng tải một lần). */
const images = new Map<string, Promise<HTMLImageElement | undefined>>();
function miniImage(code: string): Promise<HTMLImageElement | undefined> {
  let p = images.get(code);
  if (!p) {
    p = (miniUrl(code) ?? Promise.resolve(undefined)).then(async (url) => {
      if (!url) return undefined;
      const img = new Image();
      img.src = url;
      await img.decode();
      return img;
    }).catch(() => undefined);
    images.set(code, p);
  }
  return p;
}

/** Một khung bản đồ mini gắn vào phần tử chứa; chạm vào thì gọi `onTap` với toạ độ điểm của vùng. */
export class MiniMap {
  readonly el: HTMLCanvasElement;
  private data?: MiniMapView;
  private region?: RegionMap;
  private bg?: HTMLImageElement;
  private viewport?: Viewport;
  private blink = false;
  private timer = 0;
  // Biến đổi toạ độ vùng → px CSS của khung
  private scale = 1;
  private ox = 0;
  private oy = 0;

  constructor(onTap: (x: number, y: number) => void) {
    this.el = document.createElement("canvas");
    this.el.className = "minimap";
    this.el.setAttribute("role", "button");
    this.el.setAttribute("aria-label", "Bản đồ mini, chạm để mở bản đồ tranh tại chỗ đó");
    // offsetX/Y tính từ mép trong của canvas (không gồm viền CSS), cùng gốc với ox, oy.
    this.el.addEventListener("click", (e) => onTap((e.offsetX - this.ox) / this.scale, (e.offsetY - this.oy) / this.scale));
  }

  async set(data: MiniMapView, viewport?: Viewport): Promise<void> {
    this.data = data;
    this.viewport = viewport;
    if (this.region?.region.code !== data.region) {
      this.bg = undefined;
      this.region = await loadRegion(data.region);
      // Vẽ ngay trên nền giấy, ảnh cảnh về thì vẽ lại.
      void miniImage(data.region).then((img) => {
        if (this.region?.region.code !== data.region) return;
        this.bg = img;
        this.draw();
      });
    }
    this.draw();
  }

  /** Nhấp nháy điểm đang bị đánh khi khung đang hiện. */
  start(): void {
    this.stop();
    this.timer = window.setInterval(() => {
      this.blink = !this.blink;
      if (this.data?.marks.some((m) => m.attacked) || this.data?.alerts.length) this.draw();
    }, 500);
  }

  stop(): void {
    clearInterval(this.timer);
  }

  draw(): void {
    const m = this.region;
    const d = this.data;
    const c = this.el;
    const w = c.clientWidth;
    const h = c.clientHeight;
    if (!m || !d || w === 0 || h === 0) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
    }
    const ctx = c.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Khung nhìn: cả vùng, hoặc thu về lãnh thổ (tông môn, liên minh) có chừa lề.
    let [x0, y0, x1, y1] = m.map.bbox;
    if (d.focus?.length) {
      const ps = d.focus.map((id) => m.points[id]);
      x0 = Math.min(...ps.map((p) => p.x));
      x1 = Math.max(...ps.map((p) => p.x));
      y0 = Math.min(...ps.map((p) => p.y));
      y1 = Math.max(...ps.map((p) => p.y));
      const pad = Math.max(12, (x1 - x0) * 0.25, (y1 - y0) * 0.25);
      x0 -= pad;
      x1 += pad;
      y0 -= pad;
      y1 += pad;
    }
    this.scale = Math.min((w - 6) / (x1 - x0), (h - 6) / (y1 - y0));
    this.ox = (w - (x1 - x0) * this.scale) / 2 - x0 * this.scale;
    this.oy = (h - (y1 - y0) * this.scale) / 2 - y0 * this.scale;
    const X = (x: number) => this.ox + x * this.scale;
    const Y = (y: number) => this.oy + y * this.scale;

    // Nền: giấy, rồi ảnh cảnh vùng phủ đúng khung frame.
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, w, h);
    if (this.bg) {
      const [fx0, fy0, fx1, fy1] = m.map.frame;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(this.bg, X(fx0), Y(fy0), (fx1 - fx0) * this.scale, (fy1 - fy0) * this.scale);
    }

    // Sương mù: phủ giấy nhạt rồi khoét quanh các điểm đã mở.
    const fog = document.createElement("canvas");
    fog.width = c.width;
    fog.height = c.height;
    const f = fog.getContext("2d")!;
    f.setTransform(dpr, 0, 0, dpr, 0, 0);
    f.fillStyle = FOG;
    f.fillRect(0, 0, w, h);
    f.globalCompositeOperation = "destination-out";
    const hole = Math.max(5, 9 * this.scale);
    for (const id of d.revealed) {
      const p = m.points[id];
      const g = f.createRadialGradient(X(p.x), Y(p.y), hole * 0.4, X(p.x), Y(p.y), hole);
      g.addColorStop(0, "rgba(0,0,0,1)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      f.fillStyle = g;
      f.fillRect(X(p.x) - hole, Y(p.y) - hole, hole * 2, hole * 2);
    }
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(fog, 0, 0);
    ctx.restore();

    // Điểm có chủ; đang bị đánh thì nhấp nháy và có vòng đỏ.
    ctx.lineWidth = 1;
    ctx.strokeStyle = DOT_EDGE;
    for (const k of d.marks) {
      const p = m.points[k.pointId];
      ctx.beginPath();
      ctx.arc(X(p.x), Y(p.y), 2.4, 0, Math.PI * 2);
      ctx.fillStyle = k.attacked && this.blink ? ATTACKED : OWNER_COLOR[k.owner];
      ctx.fill();
      ctx.stroke();
      if (k.attacked) {
        ctx.beginPath();
        ctx.arc(X(p.x), Y(p.y), this.blink ? 6 : 4.5, 0, Math.PI * 2);
        ctx.strokeStyle = ATTACKED;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.lineWidth = 1;
        ctx.strokeStyle = DOT_EDGE;
      }
    }
    // Điểm của sự kiện đang diễn ra (chiến tranh, Yêu Triều): chấm đỏ nhấp nháy có vòng.
    for (const id of new Set(d.alerts.flatMap((a) => a.points))) {
      const p = m.points[id];
      ctx.beginPath();
      ctx.arc(X(p.x), Y(p.y), this.blink ? 3 : 2.2, 0, Math.PI * 2);
      ctx.fillStyle = this.blink ? ATTACKED : "rgba(217, 45, 32, 0.45)";
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = DOT_EDGE;
      ctx.stroke();
    }
    // Cửa bí cảnh đang mở
    for (const id of d.openGates) {
      const p = m.points[id];
      ctx.beginPath();
      ctx.arc(X(p.x), Y(p.y), 3.5, 0, Math.PI * 2);
      ctx.strokeStyle = "#1f6f62";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    // Thành chủ: hình thoi mực; sơn môn của mình: ô vuông màu tông.
    const city = m.points.find((p) => p.type === "thanh_chu")!;
    ctx.save();
    ctx.translate(X(city.x), Y(city.y));
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = INK;
    ctx.fillRect(-3, -3, 6, 6);
    ctx.restore();
    const home = m.points[d.sonMon];
    ctx.fillStyle = OWNER_COLOR.minh;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1;
    ctx.fillRect(X(home.x) - 3.5, Y(home.y) - 3.5, 7, 7);
    ctx.strokeRect(X(home.x) - 3.5, Y(home.y) - 3.5, 7, 7);

    // Vị trí của mình hoặc đoàn đang đi, bám đường theo chặng như trên bản đồ tranh.
    const at = along(route(m, d.self.from, d.self.to), d.self.progress);
    const sx = X(at.x);
    const sy = Y(at.y);
    ctx.beginPath();
    ctx.moveTo(sx, sy - 5);
    ctx.lineTo(sx + 4, sy + 2.5);
    ctx.lineTo(sx - 4, sy + 2.5);
    ctx.closePath();
    ctx.fillStyle = "#fffaf0";
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.stroke();

    // Có sự kiện: viền khung đỏ nhấp nháy để nhìn từ dashboard là biết.
    if (d.alerts.length && this.blink) {
      ctx.strokeStyle = ATTACKED;
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, w - 2, h - 2);
    }
    // Phần bản đồ tranh đang xem: nét đỏ mảnh.
    const v = this.viewport;
    if (v) {
      ctx.strokeStyle = FRAME;
      ctx.lineWidth = 1;
      ctx.strokeRect(X(v.x) + 0.5, Y(v.y) + 0.5, v.w * this.scale - 1, v.h * this.scale - 1);
    }
  }
}

// Bản đồ mini (GDD mục 14): hình vùng, sương mù, điểm có chủ, vị trí của mình, sơn môn, thành chủ, cửa bí cảnh
// đang mở và khung phần bản đồ tranh đang xem. Vẽ từ file điểm của vùng và bảng chủ điểm, không cần ảnh riêng;
// không vẽ hết mọi điểm: điểm chưa ai giữ chỉ hiện chấm mờ ở phần đã mở sương.
import { HOLDABLE, loadRegion, type RegionMap } from "../scenes/map/region.ts";
import type { MiniMapView, Owner } from "./source.ts";

export const OWNER_COLOR: Record<Owner, string> = {
  minh: "#f2c230", // màu tông môn mình
  dong_minh: "#5aa9e6", // màu liên minh
  dich: "#b07a6a",
  npc: "#7d7366",
};
const ATTACKED = "#ff5a4f";
const LAND = "#2b241c";
const EDGE = "#5d4f3e";
const FOG = "rgba(14, 12, 10, 0.78)";

export interface Viewport {
  /** Phần bản đồ tranh đang xem, theo toạ độ điểm của vùng. */
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Bao lồi của tập điểm (thuật toán chuỗi đơn điệu), dùng làm hình vùng. */
function hull(pts: { x: number; y: number }[]): { x: number; y: number }[] {
  const p = [...pts].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: typeof p = [];
  for (const q of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop();
    lower.push(q);
  }
  const upper: typeof p = [];
  for (let i = p.length - 1; i >= 0; i--) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p[i]) <= 0) upper.pop();
    upper.push(p[i]);
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

/** Một khung bản đồ mini gắn vào phần tử chứa; chạm vào thì gọi `onTap` với toạ độ điểm của vùng. */
export class MiniMap {
  readonly el: HTMLCanvasElement;
  private data?: MiniMapView;
  private region?: RegionMap;
  private outline: { x: number; y: number }[] = [];
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
    this.el.addEventListener("click", (e) => {
      const r = this.el.getBoundingClientRect();
      onTap((e.clientX - r.left - this.ox) / this.scale, (e.clientY - r.top - this.oy) / this.scale);
    });
  }

  async set(data: MiniMapView, viewport?: Viewport): Promise<void> {
    this.data = data;
    this.viewport = viewport;
    if (this.region?.region.code !== data.region) {
      this.region = await loadRegion(data.region);
      this.outline = hull(this.region.points);
    }
    this.draw();
  }

  /** Nhấp nháy điểm đang bị đánh khi khung đang hiện. */
  start(): void {
    this.stop();
    this.timer = window.setInterval(() => {
      this.blink = !this.blink;
      if (this.data?.marks.some((m) => m.attacked)) this.draw();
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
    ctx.clearRect(0, 0, w, h);

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
    this.scale = Math.min((w - 8) / (x1 - x0), (h - 8) / (y1 - y0));
    this.ox = (w - (x1 - x0) * this.scale) / 2 - x0 * this.scale;
    this.oy = (h - (y1 - y0) * this.scale) / 2 - y0 * this.scale;
    const X = (x: number) => this.ox + x * this.scale;
    const Y = (y: number) => this.oy + y * this.scale;
    const dot = (x: number, y: number, r: number, color: string) => {
      ctx.beginPath();
      ctx.arc(X(x), Y(y), r, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    };

    // Hình vùng
    const shape = () => {
      ctx.beginPath();
      this.outline.forEach((p, i) => (i ? ctx.lineTo(X(p.x), Y(p.y)) : ctx.moveTo(X(p.x), Y(p.y))));
      ctx.closePath();
    };
    shape();
    ctx.fillStyle = LAND;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = EDGE;
    ctx.stroke();

    // Chặng đường làm nét địa hình
    ctx.beginPath();
    for (const e of m.edges) {
      const a = m.points[e.a];
      const b = m.points[e.b];
      ctx.moveTo(X(a.x), Y(a.y));
      ctx.lineTo(X(b.x), Y(b.y));
    }
    ctx.strokeStyle = "rgba(168, 156, 136, 0.18)";
    ctx.stroke();

    // Sương mù: phủ cả hình vùng rồi khoét quanh các điểm đã mở.
    const revealed = new Set(d.revealed);
    const fog = document.createElement("canvas");
    fog.width = c.width;
    fog.height = c.height;
    const f = fog.getContext("2d")!;
    f.setTransform(dpr, 0, 0, dpr, 0, 0);
    f.beginPath();
    this.outline.forEach((p, i) => (i ? f.lineTo(X(p.x), Y(p.y)) : f.moveTo(X(p.x), Y(p.y))));
    f.closePath();
    f.fillStyle = FOG;
    f.fill();
    f.globalCompositeOperation = "destination-out";
    const hole = Math.max(5, 9 * this.scale);
    for (const id of revealed) {
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

    // Điểm chưa ai giữ: chấm mờ, chỉ ở phần đã mở sương.
    const owned = new Map(d.marks.map((k) => [k.pointId, k]));
    for (const id of revealed) {
      const p = m.points[id];
      if (!owned.has(id) && HOLDABLE.includes(p.type)) dot(p.x, p.y, 1.4, "rgba(239, 230, 214, 0.35)");
    }
    // Điểm có chủ
    for (const k of d.marks) {
      const p = m.points[k.pointId];
      dot(p.x, p.y, 2.8, k.attacked && this.blink ? ATTACKED : OWNER_COLOR[k.owner]);
      if (k.attacked) {
        ctx.beginPath();
        ctx.arc(X(p.x), Y(p.y), this.blink ? 7 : 5, 0, Math.PI * 2);
        ctx.strokeStyle = ATTACKED;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
    // Cửa bí cảnh đang mở
    for (const id of d.openGates) {
      const p = m.points[id];
      ctx.beginPath();
      ctx.arc(X(p.x), Y(p.y), 4, 0, Math.PI * 2);
      ctx.strokeStyle = "#86dcc8";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    // Thành chủ: hình thoi; sơn môn của mình: hình vuông.
    const city = m.points.find((p) => p.type === "thanh_chu")!;
    ctx.save();
    ctx.translate(X(city.x), Y(city.y));
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = "#efe6d6";
    ctx.fillRect(-3.5, -3.5, 7, 7);
    ctx.restore();
    const home = m.points[d.sonMon];
    ctx.fillStyle = OWNER_COLOR.minh;
    ctx.strokeStyle = "#14110f";
    ctx.lineWidth = 1;
    ctx.fillRect(X(home.x) - 4, Y(home.y) - 4, 8, 8);
    ctx.strokeRect(X(home.x) - 4, Y(home.y) - 4, 8, 8);

    // Vị trí của mình hoặc đoàn đang đi
    const a = m.points[d.self.from];
    const b = m.points[d.self.to];
    const sx = a.x + (b.x - a.x) * d.self.progress;
    const sy = a.y + (b.y - a.y) * d.self.progress;
    ctx.beginPath();
    ctx.moveTo(X(sx), Y(sy) - 6);
    ctx.lineTo(X(sx) + 4.5, Y(sy) + 3);
    ctx.lineTo(X(sx) - 4.5, Y(sy) + 3);
    ctx.closePath();
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.strokeStyle = "#14110f";
    ctx.stroke();

    // Phần bản đồ tranh đang xem
    const v = this.viewport;
    if (v) {
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = "rgba(239, 230, 214, 0.8)";
      ctx.lineWidth = 1;
      ctx.strokeRect(X(v.x), Y(v.y), v.w * this.scale, v.h * this.scale);
      ctx.setLineDash([]);
    }
    shape();
    ctx.strokeStyle = EDGE;
    ctx.stroke();
  }
}

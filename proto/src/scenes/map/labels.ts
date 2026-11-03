// Tên địa hình và tên sông kiểu bản đồ cổ (data/maps/ha_nhan.json): chữ nghiêng có chân, giãn chữ, viền giấy cho dễ đọc.
// Tên địa hình đặt ở chỗ đã tính sẵn (đã né điểm). Tên sông chạy dọc dòng, mỗi chữ xoay theo hướng sông; thử hộp từng
// chữ với Placer ở giữa, rồi một phần ba hai bên đoạn sông, chỗ nào hết chồng thì đặt. Gọi sau khi đã xếp chỗ các điểm,
// vẽ theo px CSS.
import type { Camera } from "../../app/camera.ts";
import type { View } from "../../app/view.ts";
import type { Placer } from "./nodes.ts";
import type { MapLabels } from "./region.ts";

const SERIF = '"Noto Serif", Cambria, "Times New Roman", serif';
const HALO = "rgba(246, 239, 223, 0.92)";
/** Màu chữ theo loại địa hình. */
const FEATURE_INK: Record<string, string> = {
  rung: "#2f5a2a", dong_co: "#55652a", sa_mac: "#7a5528", bang_nguyen: "#3d6a8a", dam_lay: "#3f5f4f", nui: "#5a3f2c",
};
const RIVER_INK = "#2f5f9e";
const FEATURE_PX = 12;
const RIVER_PX = 11;
/** Giãn thêm giữa hai chữ của tên sông, px CSS. */
const RIVER_SPACING = 1.5;

/** Bề rộng từng chữ theo phông, đo một lần. */
const widths = new Map<string, number>();
function charWidth(ctx: CanvasRenderingContext2D, ch: string): number {
  const k = `${ctx.font}|${ch}`;
  let w = widths.get(k);
  if (w === undefined) widths.set(k, (w = ctx.measureText(ch).width));
  return w;
}

function onScreen(x: number, y: number, v: View, pad: number): boolean {
  return x > -pad && y > -pad && x < v.w + pad && y < v.h + pad;
}

export function drawFeatureNames(ctx: CanvasRenderingContext2D, list: MapLabels["features"], cam: Camera, v: View, z: number, placer: Placer): void {
  ctx.font = `italic 600 ${FEATURE_PX}px ${SERIF}`;
  ctx.letterSpacing = "1.5px";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.lineWidth = 3;
  for (const f of list) {
    if (f.z === null || z < f.z) continue;
    const s = cam.toScreen(f.x, f.y, v);
    if (!onScreen(s.x, s.y, v, 80)) continue;
    const w = ctx.measureText(f.name).width;
    if (!placer.take(s.x - w / 2 - 2, s.y - 8, s.x + w / 2 + 2, s.y + 8)) continue;
    ctx.strokeStyle = HALO;
    ctx.strokeText(f.name, s.x, s.y);
    ctx.fillStyle = FEATURE_INK[f.kind] ?? FEATURE_INK.nui;
    ctx.fillText(f.name, s.x, s.y);
  }
  ctx.letterSpacing = "0px";
}

export function drawRiverNames(ctx: CanvasRenderingContext2D, list: MapLabels["rivers"], cam: Camera, v: View, z: number, placer: Placer): void {
  ctx.font = `italic 500 ${RIVER_PX}px ${SERIF}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.lineWidth = 3;
  for (const r of list) {
    if (r.z === null || z < r.z) continue;
    const pts = r.path.map(([x, y]) => cam.toScreen(x, y, v));
    if (!pts.some((p) => onScreen(p.x, p.y, v, 0))) continue;
    // Độ dài cộng dồn theo px màn hình.
    const acc = [0];
    for (let i = 1; i < pts.length; i++) acc.push(acc[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
    const total = acc[acc.length - 1];
    const chars = [...r.name];
    const cw = chars.map((ch) => charWidth(ctx, ch));
    const width = cw.reduce((a, b) => a + b, 0) + RIVER_SPACING * (chars.length - 1);
    if (total < width + 8) continue;
    const at = (d: number) => {
      let i = 1;
      while (i < acc.length - 1 && acc[i] < d) i++;
      const a = pts[i - 1];
      const b = pts[i];
      const k = (d - acc[i - 1]) / (acc[i] - acc[i - 1] || 1);
      return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, angle: Math.atan2(b.y - a.y, b.x - a.x) };
    };
    for (const anchor of [0.5, 0.3, 0.7]) {
      const start = total * anchor - width / 2;
      if (start < 0 || start + width > total) continue;
      const glyphs: { ch: string; x: number; y: number; angle: number }[] = [];
      let d = start;
      let ok = true;
      for (let i = 0; i < chars.length && ok; i++) {
        const g = at(d + cw[i] / 2);
        const h = Math.max(cw[i], RIVER_PX) / 2 + 1;
        ok = placer.fits(g.x - h, g.y - h, g.x + h, g.y + h);
        glyphs.push({ ch: chars[i], ...g });
        d += cw[i] + RIVER_SPACING;
      }
      if (!ok) continue;
      for (const g of glyphs) {
        const h = RIVER_PX / 2 + 1;
        placer.take(g.x - h, g.y - h, g.x + h, g.y + h);
        ctx.save();
        ctx.translate(g.x, g.y);
        ctx.rotate(g.angle);
        ctx.strokeStyle = HALO;
        ctx.strokeText(g.ch, 0, 0);
        ctx.fillStyle = RIVER_INK;
        ctx.fillText(g.ch, 0, 0);
        ctx.restore();
      }
      break;
    }
  }
}

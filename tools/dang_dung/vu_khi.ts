// Tách lớp vũ khí từ ảnh inpaint trên ảnh nghỉ thân nam khoẻ (nhan_vat/nam_khoe/tron.png), như cách đã làm kiếm, đao,
// trượng: giữ điểm khác ảnh nền trong vùng tô, cộng nắm tay quanh điểm cầm (pivot) để vũ khí kèm nắm tay che tay của
// thân khi ghép. Ghi assets/pixellab/do/vu_khi/<mã>.png và in dòng manifest (ghép bằng ghep.ts).
//
// Chạy: node tools/dang_dung/vu_khi.ts <viec.json> <thư mục ảnh inpaint> <ra.json>
// viec.json: [{ "ma": "song_chuy", "ten": "Song chủy thủ", "mask": [x, y, w, h], "moTa": "…", "seed": 0, "job": "…" }]
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { blank, decodePng, encodePng } from "./png.ts";
import { ASSETS } from "./pixellab.ts";

/** Cổ tay phía trước trên ảnh nghỉ nam khoẻ: điểm cầm của mọi vũ khí. */
const PIVOT: [number, number] = [44.7, 35.4];
/** Nắm tay: các điểm có màu trong bán kính này quanh điểm cầm được giữ dù không đổi. */
const FIST_R = 4.5;
/** Khác màu từ ngần này (tổng chênh lệch RGB) thì coi là điểm của vũ khí. */
const DIFF = 40;
/** Cụm điểm liền nhau nhỏ hơn ngần này mà không chạm nắm tay là lốm đốm, bỏ. */
const MIN_CUM = 12;
const isSkin = (r: number, g: number, b: number) => r > 120 && r > g && g > b && r - b > 40 && g > 70;

interface Viec {
  ma: string;
  ten: string;
  mask: [number, number, number, number];
  moTa: string;
  seed?: number;
  job?: string;
  /** Chỉ giữ điểm trong khung này [x, y, rộng, cao] (bỏ viền cẳng tay vẽ lại). */
  cat?: [number, number, number, number];
  /** Dời cả lớp [dx, dy] khi PixelLab vẽ nắm tay lệch khỏi cổ tay ảnh nền (tay co lên cầm đồ), để nắm tay về điểm cầm. */
  doi?: [number, number];
}

const [jobsPath, dir, outPath] = process.argv.slice(2);
if (!jobsPath || !dir || !outPath) throw new Error("node tools/dang_dung/vu_khi.ts <viec.json> <thư mục ảnh inpaint> <ra.json>");
const base = decodePng(readFileSync(join(ASSETS, "nhan_vat", "nam_khoe", "tron.png")));
const jobs: Viec[] = JSON.parse(readFileSync(jobsPath, "utf8"));
const out: unknown[] = [];
for (const v of jobs) {
  const img = decodePng(readFileSync(join(dir, `${v.ma}.png`)));
  if (img.w !== base.w || img.h !== base.h) throw new Error(`${v.ma}: ${img.w}×${img.h}, cần ${base.w}×${base.h}`);
  const layer = blank(img.w, img.h);
  const [mx, my, mw, mh] = v.mask;
  // Pro Flash vẽ lại nhẹ cả phần thân trong vùng tô, nên ngoài điểm khác ảnh nền còn phải bỏ: da ngoài nắm tay (cẳng tay
  // vẽ lại) và cụm điểm lẻ nhỏ (lốm đốm trên áo, quần).
  const keep = new Uint8Array(img.w * img.h);
  for (let y = my; y < Math.min(img.h, my + mh); y++) {
    for (let x = mx; x < Math.min(img.w, mx + mw); x++) {
      const o = (y * img.w + x) * 4;
      if (img.data[o + 3] < 128) continue;
      const [r, g, b] = [img.data[o], img.data[o + 1], img.data[o + 2]];
      const d = Math.abs(r - base.data[o]) + Math.abs(g - base.data[o + 1]) + Math.abs(b - base.data[o + 2]) + (base.data[o + 3] < 128 ? 255 : 0);
      const fist = Math.hypot(x + 0.5 - PIVOT[0], y + 0.5 - PIVOT[1]) <= FIST_R;
      // Da vẽ lại: ảnh nền là da và ảnh mới vẫn là da. Đồng, gỗ, hồ lô cũng có màu như da nhưng nằm đè lên áo, quần hay
      // nền trống nên vẫn giữ.
      const skin = isSkin(r, g, b) && base.data[o + 3] >= 128 && isSkin(base.data[o], base.data[o + 1], base.data[o + 2]);
      if (fist ? false : d < DIFF || skin) continue;
      keep[y * img.w + x] = 1;
    }
  }
  // Cụm liền nhau (8 hướng): bỏ cụm dưới MIN_CUM điểm, trừ cụm chạm nắm tay.
  const seen = new Uint8Array(img.w * img.h);
  let n = 0;
  for (let i = 0; i < keep.length; i++) {
    if (!keep[i] || seen[i]) continue;
    const cum: number[] = [];
    let nearFist = false;
    const stack = [i];
    seen[i] = 1;
    while (stack.length) {
      const p = stack.pop()!;
      cum.push(p);
      const px = p % img.w;
      const py = (p / img.w) | 0;
      if (Math.hypot(px + 0.5 - PIVOT[0], py + 0.5 - PIVOT[1]) <= FIST_R) nearFist = true;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const qx = px + dx;
          const qy = py + dy;
          if (qx < 0 || qy < 0 || qx >= img.w || qy >= img.h) continue;
          const q = qy * img.w + qx;
          if (keep[q] && !seen[q]) {
            seen[q] = 1;
            stack.push(q);
          }
        }
      }
    }
    if (cum.length < MIN_CUM && !nearFist) continue;
    const [cx, cy, cw, ch] = v.cat ?? [0, 0, img.w, img.h];
    const [dx, dy] = v.doi ?? [0, 0];
    for (const p of cum) {
      const px = p % img.w;
      const py = (p / img.w) | 0;
      if (px < cx || py < cy || px >= cx + cw || py >= cy + ch) continue;
      const tx = px + dx;
      const ty = py + dy;
      if (tx < 0 || ty < 0 || tx >= img.w || ty >= img.h) continue;
      layer.data.set(img.data.subarray(p * 4, p * 4 + 4), (ty * img.w + tx) * 4);
      n++;
    }
  }
  const file = `do/vu_khi/${v.ma}.png`;
  writeFileSync(join(ASSETS, file), encodePng(layer));
  out.push({
    file,
    description: `${v.ten} (kèm nắm tay): lớp đồ rời 64×64, tách từ ảnh inpaint trên ảnh nghỉ của thân nam khoẻ (gói 3). Vẽ ở (neo khung − pivot).`,
    tool: "inpaint_image_pro_flash",
    params: { description: v.moTa, mask: v.mask, seed: v.seed ?? 0, base: "nhan_vat/nam_khoe/tron.png", job: v.job },
    created: new Date().toISOString().slice(0, 10),
    slot: "vu_khi",
    neo: "tay",
    pivot: PIVOT,
  });
  console.log(`${file}: ${n} điểm`);
}
writeFileSync(outPath, JSON.stringify(out, null, 2) + "\n");
console.log(`${out.length} dòng → ${outPath}`);

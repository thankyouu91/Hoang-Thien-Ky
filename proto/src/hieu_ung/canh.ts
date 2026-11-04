// Ghép một khung hiệu ứng: lấy các lần ra chiêu quanh t (nhìn trước pha 1–2, nhìn lại pha 3) và các trạng thái còn hiệu
// lực, ghi tấm vào bộ đệm. Hàm thuần của (replay, t, tốc độ, camera không dính): tua tới lui hay chạy lại ra y hệt.
import { between } from "../replay/timeline.ts";
import { drawCast, LOOK_AHEAD, LOOK_BACK } from "./chieu.ts";
import { makeCtx } from "./ctx.ts";
import type { Emitter } from "./emit.ts";
import { statusFx } from "./he.ts";
import { recipeOf, setCrowd } from "./recipe.ts";
import { activeAt, statusTrack } from "./trang_thai.ts";
import type { FxInput } from "./types.ts";

export function emitFrame(e: Emitter, f: FxInput): void {
  e.reset();
  const x = makeCtx(e, f);
  const fadeIn = f.life(0.15);
  const fadeOut = f.life(0.3);
  const track = statusTrack(f.index, f.statuses);
  for (const s of activeAt(track, f.t, fadeOut)) statusFx(x, s, fadeIn, fadeOut);
  const casts = between(f.index.casts, f.t - LOOK_BACK, f.t + LOOK_AHEAD);
  // Đông chiêu thì giảm số hạt mỗi chiêu (hình dạng chính giữ nguyên): đếm chiêu có pha chạm trúng quanh t.
  const near = f.life(0.4);
  let busy = 0;
  for (const c of casts) if (Math.abs(c.tick - f.t) <= near) busy++;
  setCrowd(Math.min(1, Math.max(0.3, 24 / Math.max(1, busy))));
  for (const c of casts) drawCast(x, c, recipeOf(c));
  setCrowd(1);
}

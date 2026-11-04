// Ghép một khung hiệu ứng: lấy các lần ra chiêu quanh t (nhìn trước pha 1–2, nhìn lại pha 3) và các trạng thái còn hiệu
// lực, ghi tấm vào bộ đệm. Hàm thuần của (replay, t, tốc độ, camera không dính): tua tới lui hay chạy lại ra y hệt.
import { between, type ReplayIndex } from "../replay/timeline.ts";
import { assignLooks } from "../scenes/battle/character.ts";
import { drawCast, LOOK_AHEAD, LOOK_BACK } from "./chieu.ts";
import { makeCtx } from "./ctx.ts";
import type { Emitter } from "./emit.ts";
import { statusFx } from "./he.ts";
import { recipeOf, setCrowd } from "./recipe.ts";
import { activeAt, statusTrack } from "./trang_thai.ts";
import type { Persona } from "./dang_chon.ts";
import type { FxInput } from "./types.ts";

const personas = new WeakMap<ReplayIndex, Map<number, Persona>>();

/**
 * Vũ khí, tài năng của từng người (để chọn dáng chiêu): vũ khí theo ngoại hình màn Trận vẽ (assignLooks, cùng kết quả),
 * tài năng theo khoá hình tu_si/<tài năng> của replay. Dựng một lần mỗi replay.
 */
function personaOf(index: ReplayIndex): Map<number, Persona> {
  let m = personas.get(index);
  if (!m) {
    m = new Map();
    const looks = assignLooks(index.replay.units);
    for (const u of index.replay.units) {
      const talent = u.sprite?.startsWith("tu_si/") ? u.sprite.slice(6) : undefined;
      m.set(u.id, { weapon: looks.get(u.id)?.weapon, talent });
    }
    personas.set(index, m);
  }
  return m;
}

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
  // Vòng diện rộng, trận đồ đang hiện ở t (từ lúc vận, bày trận tới hết pha nổ): nhiều thì mỗi cái mờ đi.
  let zones = 0;
  for (const c of casts) {
    if (c.skill !== "dien_rong" && c.skill !== "tran_phap") continue;
    if (f.t >= (c.start ?? c.tick - f.life(1)) && f.t < c.tick + f.life(0.9)) zones++;
  }
  x.zoneK = 1 / Math.sqrt(Math.max(1, zones));
  const who = personaOf(f.index);
  for (const c of casts) drawCast(x, c, recipeOf(c, who.get(c.unit)));
  setCrowd(1);
}

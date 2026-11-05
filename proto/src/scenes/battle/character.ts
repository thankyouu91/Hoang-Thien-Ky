// Nhân vật ghép từ hình PixelLab: dải hoạt ảnh của thân (đã mặc áo), mũ neo ở đầu, vũ khí neo ở tay.
// Hoạt ảnh chọn theo trận tại thời điểm t, không giữ trạng thái: tua tới lui vẫn đúng khung.
import type { Sprites } from "../../assets/sprites.ts";
import type { Look, ReplayUnit } from "../../replay/types.ts";

/** `dung_<dáng>`: dải dáng đứng riêng (khoanh tay, lơ lửng…), chọn trong dangDung.ts; thiếu thì dùng `dung`. */
export type Anim = "dung" | "ra_chieu" | "trung_don" | "nga" | "chay" | `dung_${string}` | `ra_chieu_${string}`;

/** Người trong khung 96 px đứng ở vị trí như ảnh 64 px lệch (+16, +16): chân ở y = 80. */
const FOOT = 80;

/**
 * Ngoại hình tạm khi đội hình chưa có trường ngoại hình, để hai đội nhìn là phân biệt:
 * đội A mặc đạo bào xanh, đội B mặc võ phục đỏ sẫm; hàng trước thân khỏe cầm kiếm hoặc đao,
 * hàng sau thân mảnh cầm trượng hoặc tay không; mũ đổi theo người; tông chủ (id nhỏ nhất của đội) đội vương miện.
 * Người đã có `look` thì giữ nguyên.
 */
export function assignLooks(units: ReplayUnit[]): Map<number, Look> {
  const out = new Map<number, Look>();
  for (const team of [0, 1]) {
    const us = units.filter((u) => u.team === team).sort((a, b) => a.id - b.id);
    us.forEach((u, i) => {
      if (u.look) {
        out.set(u.id, u.look);
        return;
      }
      const sex = i % 2 === 0 ? "nam" : "nu";
      const outfit = team === 0 ? "dao_bao" : "vo_phuc";
      const leader = i === 0;
      if (u.row === 0) {
        out.set(u.id, {
          body: `${sex}_khoe`, outfit,
          weapon: i % 2 === 0 ? "kiem" : "dao",
          hat: leader ? "ngoc_quan" : i % 3 === 2 ? "non_la" : undefined,
        });
      } else {
        out.set(u.id, {
          body: `${sex}_manh`, outfit,
          weapon: i % 2 === 0 ? "truong" : undefined,
          hat: leader ? "ngoc_quan" : i % 2 === 0 ? "o_sa" : "non_la",
        });
      }
    });
  }
  return out;
}

/** Ngoại hình vẽ được với hình đang có: thiếu bộ áo thì thử đạo bào; vẫn thiếu thì undefined. */
export function resolveLook(sprites: Sprites, look: Look): Look | undefined {
  if (animInfo(sprites, look, "dung")) return look;
  const fallback = { ...look, outfit: "dao_bao" };
  return look.outfit !== "dao_bao" && animInfo(sprites, fallback, "dung") ? fallback : undefined;
}

/** Số khung và fps của một hoạt ảnh, để chọn khung theo thời gian; undefined nếu chưa có hình. */
export function animInfo(sprites: Sprites, look: Look, anim: Anim): { frames: number; fps: number } | undefined {
  const meta = sprites.asset(`nhan_vat/${look.body}/${look.outfit}/${anim}`)?.meta;
  if (!meta?.frames) return undefined;
  return { frames: meta.frames, fps: meta.fps ?? 8 };
}

/**
 * Vẽ một khung nhân vật ghép, chân đặt tại (x, footY), `scale` đơn vị thế giới mỗi px ảnh.
 * `mirror` lật ngang cả cụm (đội B). Trả về false nếu chưa có dải hoạt ảnh để nơi gọi vẽ hình thay thế.
 */
export function drawCharacter(
  ctx: CanvasRenderingContext2D, sprites: Sprites, look: Look, anim: Anim, frame: number,
  x: number, footY: number, scale: number, mirror: boolean,
): boolean {
  const strip = sprites.asset(`nhan_vat/${look.body}/${look.outfit}/${anim}`);
  const meta = strip?.meta;
  if (!strip || !meta?.frames || !meta.frame_w || !meta.frame_h) return false;
  const fw = meta.frame_w;
  const fh = meta.frame_h;
  const f = Math.max(0, Math.min(meta.frames - 1, frame));
  const neo = Array.isArray(meta.neo) ? meta.neo[f] : undefined;

  ctx.save();
  ctx.translate(x, footY);
  if (mirror) ctx.scale(-1, 1);
  ctx.scale(scale, scale);
  ctx.translate(-fw / 2, -FOOT);
  ctx.drawImage(strip.img, f * fw, 0, fw, fh, 0, 0, fw, fh);

  const hat = look.hat ? sprites.asset(`do/mu/${look.hat}`) : undefined;
  if (hat && neo) {
    const [px, py] = hat.meta.pivot ?? [0, 0];
    ctx.save();
    ctx.translate(neo.dau[0], neo.dau[1]);
    if (neo.dau[2]) ctx.rotate((neo.dau[2] * Math.PI) / 180);
    ctx.drawImage(hat.img, -px, -py);
    ctx.restore();
  }
  const weapon = look.weapon ? sprites.asset(`do/vu_khi/${look.weapon}`) : undefined;
  if (weapon && neo?.tay) {
    const [px, py] = weapon.meta.pivot ?? [0, 0];
    ctx.drawImage(weapon.img, neo.tay[0] - px, neo.tay[1] - py);
  }
  ctx.restore();
  return true;
}

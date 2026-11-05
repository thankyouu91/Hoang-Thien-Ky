// Dáng đứng (tư thế chờ) của nhân vật ghép, khác nhau theo tài năng và vai trò, dùng chung cho màn Trận và màn Nhân vật.
//
// Mỗi dáng gồm: dải hoạt ảnh PixelLab `nhan_vat/<thân>/<áo>/dung_<dáng>` (thiếu thì lùi về `dung`), cách mang vũ khí
// (cầm tay, đeo sau lưng, vác vai, cất đi), độ nhấc khỏi mặt đất và hiệu ứng vẽ bằng code (trận đồ, khí tức, đan hỏa, lá
// thuốc, đồng tiền, phi kiếm). Danh mục và cách chọn ghi ở docs/DANG_DUNG.md.
//
// Toạ độ vẽ là px ảnh gốc (người cao khoảng 60 px, chân ở gốc), nên một bộ số dùng được cho mọi cỡ hiển thị.
import type { Sprites } from "../../assets/sprites.ts";
import type { Look, ReplayUnit } from "../../replay/types.ts";
import { animInfo, drawCharacter, type Anim } from "./character.ts";
import { drawPhapLuan, growth, type PhapLuanBeat, type PhapLuanSpec } from "./phapLuan.ts";

export type DangId =
  | "thuong"
  | "the_thu"
  | "chuc_kiem"
  | "bat_an"
  | "lo_lung"
  | "tran_do"
  | "thien_toa"
  | "khoanh_tay"
  | "vac_vai"
  | "chap_tay"
  | "chong_nanh"
  | "ngu_kiem";

/** Hiệu ứng vẽ bằng code quanh người. */
type Fx =
  | "khi_lo_lung"
  | "tran_do"
  | "khi_tuc"
  | "dan_hoa"
  | "la_thuoc"
  | "dong_tien"
  | "phi_kiem"
  | "hao_quang"
  | "hao_quang_vang"
  | "bua_giay";

/**
 * Vũ khí trong dáng đứng: cầm tay theo neo, đeo chéo sau lưng, vác lên vai (neo tay đang giơ), cầm chúc mũi xuống đất
 * (neo tay buông), hay cất (không vẽ).
 */
type WeaponMode = "tay" | "lung" | "vai" | "chuc" | "cat";

export interface DangDef {
  ten: string;
  moTa: string;
  /** Đuôi dải hoạt ảnh PixelLab (dung_<x>); không có thì dùng dải dung thường. */
  strip?: string;
  weapon: WeaponMode;
  /** Nhấc người khỏi mặt đất, px ảnh; `bob` biên độ nhấp nhô thêm, px. */
  lift?: number;
  bob?: number;
  /** Bàn chân trong dải riêng cao hơn chân khung bao nhiêu px (dải lơ lửng tự nhấc người), để vẽ lửa khí đúng chỗ. */
  footUp?: number;
  /** Giữ độ nhấc cả khi ra chiêu và trúng đòn (người bay), trừ lúc ngã. */
  liftAll?: boolean;
  fx?: Fx[];
}

export const DANG: Record<DangId, DangDef> = {
  thuong: { ten: "Đứng thở", moTa: "Dáng đứng chung, hai tay buông.", weapon: "tay" },
  the_thu: {
    ten: "Thế thủ quyền",
    moTa: "Chân trụ rộng, hai nắm tay giơ trước ngực, nhún nhẹ; khí tức theo hệ bốc quanh người.",
    strip: "dung_the_thu",
    weapon: "tay",
    fx: ["khi_tuc"],
  },
  chuc_kiem: {
    ten: "Chúc kiếm",
    moTa: "Đứng thẳng, tay buông cầm vũ khí chúc mũi xuống đất bên hông, như hiệp sĩ chờ trận.",
    weapon: "chuc",
  },
  lo_lung: {
    ten: "Lơ lửng",
    moTa: "Bay lơ lửng giữa không, chân buông thõng, tay buông hơi dang, nắm hờ; nhấp nhô chậm, lửa khí theo hệ chảy dưới chân, bóng nhỏ lại.",
    strip: "dung_lo_lung",
    weapon: "tay",
    lift: 10,
    footUp: 6,
    bob: 2,
    liftAll: true,
    fx: ["khi_lo_lung"],
  },
  tran_do: {
    ten: "Trận đồ dưới chân",
    moTa: "Đứng giữa một vòng trận đồ xoay chậm trên mặt đất, vạch phù văn theo màu hệ.",
    weapon: "tay",
    fx: ["tran_do"],
  },
  bat_an: {
    ten: "Bắt ấn",
    moTa: "Một tay dựng trước mặt bắt ấn, tay kia buông; vòng pháp luân theo màu hệ xoay sau lưng, bùa giấy bay quanh.",
    strip: "dung_bat_an",
    weapon: "cat",
    fx: ["hao_quang", "bua_giay"],
  },
  thien_toa: {
    ten: "Ngồi thiền",
    moTa: "Ngồi xếp bằng, hai tay đặt trong lòng, hơi lơ lửng trên mặt đất; một ngọn đan hỏa lượn bên cạnh.",
    strip: "dung_thien_toa",
    weapon: "lung",
    lift: 3,
    bob: 1,
    fx: ["dan_hoa"],
  },
  khoanh_tay: {
    ten: "Khoanh tay, kiếm sau lưng",
    moTa: "Đứng khoanh tay trước ngực, ngẩng đầu, vũ khí đeo chéo sau lưng.",
    strip: "dung_khoanh_tay",
    weapon: "lung",
  },
  vac_vai: {
    ten: "Vác vũ khí",
    moTa: "Một tay giơ nắm cán vũ khí gác lên vai, tay kia chống hông.",
    strip: "dung_vac_vai",
    weapon: "vai",
  },
  chap_tay: {
    ten: "Chắp tay sau lưng",
    moTa: "Đứng thẳng, ưỡn ngực, hai tay chắp sau lưng; vài chiếc lá thuốc bay quanh.",
    strip: "dung_chap_tay",
    weapon: "lung",
    fx: ["la_thuoc"],
  },
  chong_nanh: {
    ten: "Chống nạnh",
    moTa: "Một tay chống hông, một tay cầm vật trước ngực (bàn tính về sau); đồng tiền xoay quanh người.",
    strip: "dung_chong_nanh",
    weapon: "tay",
    fx: ["dong_tien"],
  },
  ngu_kiem: {
    ten: "Ngự kiếm",
    moTa: "Tông chủ chắp tay sau lưng đứng trên phi kiếm bay lơ lửng, kiếm khí sáng dưới chân, vòng hào quang vàng sau lưng.",
    strip: "dung_chap_tay",
    weapon: "lung",
    lift: 12,
    bob: 2,
    liftAll: true,
    fx: ["phi_kiem", "hao_quang_vang"],
  },
};

/**
 * Dáng theo tài năng (mã như tu_si/<tài năng>, GDD mục 6): dáng đầu là dáng chính (màn Nhân vật), các dáng sau chia
 * cho người cùng tài năng trong trận để cả đội không đứng giống hệt nhau.
 */
export const DANG_THEO_TAI_NANG: Record<string, DangId[]> = {
  tu_the: ["the_thu", "chuc_kiem"],
  tu_phap: ["lo_lung", "bat_an"],
  tu_tran: ["tran_do", "bat_an"],
  tu_dan: ["thien_toa"],
  sat_thu: ["khoanh_tay"],
  tu_ren: ["vac_vai", "chuc_kiem"],
  tu_duoc: ["chap_tay", "thien_toa"],
  tu_kim_tien: ["chong_nanh"],
};

/** Tông chủ ngự kiếm, đè lên dáng theo tài năng. */
export const DANG_TONG_CHU: DangId = "ngu_kiem";

/**
 * Dáng của một người theo tài năng; `leader` (tông chủ) thì ngự kiếm. `pick` chọn trong các dáng của tài năng (0 là
 * dáng chính). Không rõ tài năng thì đứng thường.
 */
export function dangFor(talent: string | undefined, leader = false, pick = 0): DangId {
  if (leader) return DANG_TONG_CHU;
  const list = talent ? DANG_THEO_TAI_NANG[talent] : undefined;
  return list?.length ? list[pick % list.length] : "thuong";
}

/** Dáng cho cả trận: tài năng lấy từ khoá hình tu_si/<tài năng>, tông chủ là id nhỏ nhất mỗi đội (như assignLooks). */
export function assignDang(units: ReplayUnit[]): Map<number, DangId> {
  const out = new Map<number, DangId>();
  for (const team of [0, 1]) {
    const us = units.filter((u) => u.team === team).sort((a, b) => a.id - b.id);
    const seen = new Map<string, number>();
    us.forEach((u, i) => {
      const talent = u.sprite?.startsWith("tu_si/") ? u.sprite.slice(6) : undefined;
      // Người cùng tài năng trong đội lần lượt nhận các dáng của tài năng đó (tông chủ ngự kiếm, không tính lượt).
      const leader = i === 0;
      const n = talent && !leader ? seen.get(talent) ?? 0 : 0;
      if (talent && !leader) seen.set(talent, n + 1);
      out.set(u.id, dangFor(talent, leader, n));
    });
  }
  return out;
}

/** Độ nhấc khỏi mặt đất (px ảnh) tại thời điểm `time` (giây) khi đang diễn `anim`; 0 nếu đứng trên đất. */
export function dangLift(dang: DangId, anim: Anim, time: number, phase = 0): number {
  const d = DANG[dang];
  if (!d.lift || anim === "nga" || (anim !== "dung" && !d.liftAll)) return 0;
  return d.lift + (d.bob ?? 0) * Math.sin(time * 1.7 + phase);
}

/** Khoảng px ảnh mà dáng cần thêm phía trên người đứng thường (người bay), để khung chân dung chừa chỗ. */
export function dangHeadroom(dang: DangId): number {
  const d = DANG[dang];
  return (d.lift ?? 0) + (d.bob ?? 0) + (d.footUp ?? 0);
}

/** Dải đứng thật sự dùng: dải riêng của dáng nếu có hình cho thân và áo này, không thì dải dung thường. */
function idleStrip(sprites: Sprites, look: Look, d: DangDef): Anim {
  return d.strip && animInfo(sprites, look, d.strip as Anim) ? (d.strip as Anim) : "dung";
}

/**
 * Vẽ một người theo dáng: `anim` "dung" thì vẽ dáng đứng (khung chọn theo `time`, giây); hoạt ảnh khác thì vẽ khung
 * `frame` như drawCharacter, chỉ thêm độ nhấc và phi kiếm/khí dưới chân với dáng bay. Chân đặt tại (x, footY) trên mặt
 * đất (người bay tự nhấc lên), `scale` đơn vị mỗi px ảnh, `mirror` lật ngang (đội B), `tint` màu hệ cho hiệu ứng.
 * `luan`: pháp luân sau lưng (phapLuan.ts) theo công pháp chủ tu, cấp và nhịp ra chiêu / lên cấp / đột phá; từ Trúc Cơ
 * thì thay vòng hào quang của dáng (bắt ấn, ngự kiếm), tông chủ thêm lông vũ vàng. Không vẽ lúc ngã.
 * Trả về false nếu thân và áo này chưa có dải hoạt ảnh nào, để nơi gọi vẽ hình thay thế.
 */
export function drawDang(
  ctx: CanvasRenderingContext2D, sprites: Sprites, look: Look, dang: DangId, anim: Anim, frame: number, time: number,
  x: number, footY: number, scale: number, mirror: boolean, tint = "#9fd8ff", phase = 0,
  luan?: { spec: PhapLuanSpec; beat: PhapLuanBeat },
): boolean {
  const d = DANG[dang];
  const idle = anim === "dung";
  const body: Anim = idle ? idleStrip(sprites, look, d) : anim;
  const info = animInfo(sprites, look, body);
  if (!info) return false;
  const f = idle ? Math.floor(time * info.fps + phase * 7) % info.frames : frame;
  const lift = dangLift(dang, anim, time, phase);
  const fx = anim === "nga" ? [] : d.fx ?? [];
  // Hiệu ứng chỉ của lúc đứng (trận đồ, đồng tiền…) tắt khi ra chiêu; phi kiếm, khí nâng thì theo người bay.
  // Pháp luân từ Trúc Cơ (cuối Luyện Khí có khí tụ, lúc đột phá có thiên kiếp); có pháp luân thì bỏ vòng hào quang của dáng.
  const gr = luan ? growth(luan.spec.level) : undefined;
  const withLuan = !!luan && !!gr && anim !== "nga" && (gr.realm >= 1 || gr.progress >= 0.8 || !!luan.beat.breakthrough);
  const fullLuan = withLuan && gr!.realm >= 1;
  const shown = fx.filter((k) => (idle || k === "phi_kiem" || k === "khi_lo_lung") && !(fullLuan && (k === "hao_quang" || k === "hao_quang_vang")));
  const neo = sprites.asset(`nhan_vat/${look.body}/${look.outfit}/${body}`)?.meta.neo;
  const anchor = Array.isArray(neo) ? neo[Math.max(0, Math.min(neo.length - 1, f))] : undefined;
  const weapon = idle ? d.weapon : "tay";

  ctx.save();
  ctx.translate(x, footY);
  if (mirror) ctx.scale(-1, 1);
  ctx.scale(scale, scale);

  const feet = lift + (body === d.strip ? d.footUp ?? 0 : 0);
  for (const k of shown) drawFx(ctx, k, "ground", time, lift, feet, tint, phase);
  if (withLuan) {
    // Tâm pháp luân sau lưng, hơi dưới đầu và lệch về phía lưng; theo neo đầu nên ngồi thiền hay cúi vẫn đúng chỗ.
    const cx = anchor ? anchor.dau[0] - FRAME_X - 2 : 0;
    const cy = anchor ? anchor.dau[1] - FRAME_FOOT - lift + 10 : -38 - lift;
    drawPhapLuan(ctx, luan!.spec, luan!.beat, cx, cy, 17);
  }
  for (const k of shown) drawFx(ctx, k, "back", time, lift, feet, tint, phase);
  if (look.weapon && weapon === "lung" && anchor) drawWeapon(ctx, sprites, look.weapon, "lung", anchor, lift);

  const carry = weapon === "tay" ? look : { ...look, weapon: undefined };
  drawCharacter(ctx, sprites, carry, body, f, 0, -lift, 1, false);

  if (look.weapon && (weapon === "vai" || weapon === "chuc") && anchor?.tay) drawWeapon(ctx, sprites, look.weapon, weapon, anchor, lift);
  for (const k of shown) drawFx(ctx, k, "front", time, lift, feet, tint, phase);
  ctx.restore();
  return true;
}

// ---- vũ khí ----

/** Neo khung trong toạ độ khung 96 px: đổi sang toạ độ quanh chân (gốc ở chân, người nhấc `lift`). */
const FRAME_X = 48;
const FRAME_FOOT = 80;

/**
 * Góc xoay (độ, theo chiều kim đồng hồ) so với ảnh đồ gốc, và với đeo lưng thì thêm độ dời từ neo đầu (px), theo mã vũ
 * khí. Ảnh kiếm và đao gốc chĩa lưỡi chếch lên bên phải (khoảng −61°), trượng dựng đứng.
 */
const CARRY: Record<string, { lung: [number, number, number]; vai: number; chuc: number }> = {
  kiem: { lung: [160, -7, -4], vai: -74, chuc: 140 },
  dao: { lung: [160, -7, -4], vai: -74, chuc: 140 },
  truong: { lung: [30, 0, 16], vai: -50, chuc: 0 },
};
const CARRY_DEFAULT = CARRY.kiem;

/** Ảnh vũ khí đã xoá nắm tay (điểm màu da quanh chỗ cầm), để đeo lưng hay làm phi kiếm không có bàn tay lơ lửng. */
const bare = new Map<string, HTMLCanvasElement | null>();
function bareWeapon(sprites: Sprites, key: string): { img: CanvasImageSource; pivot: [number, number] } | null {
  const asset = sprites.asset(`do/vu_khi/${key}`);
  if (!asset) return null;
  const pivot = (asset.meta.pivot ?? [32, 32]) as [number, number];
  if (!bare.has(key)) {
    let canvas: HTMLCanvasElement | null = null;
    try {
      canvas = document.createElement("canvas");
      canvas.width = asset.img.naturalWidth;
      canvas.height = asset.img.naturalHeight;
      const c = canvas.getContext("2d", { willReadFrequently: true })!;
      c.drawImage(asset.img, 0, 0);
      const data = c.getImageData(0, 0, canvas.width, canvas.height);
      const px = data.data;
      for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
          const o = (y * canvas.width + x) * 4;
          const r = px[o], g = px[o + 1], b = px[o + 2];
          const near = Math.hypot(x + 0.5 - pivot[0], y + 0.5 - pivot[1]) < 8;
          const skin = r > 120 && r > g && g > b && r - b > 40 && g > 70;
          const outline = r + g + b < 150;
          if (near && (skin || outline)) px[o + 3] = 0;
        }
      }
      c.putImageData(data, 0, 0);
    } catch {
      canvas = null;
    }
    bare.set(key, canvas);
  }
  return { img: bare.get(key) ?? asset.img, pivot };
}

function drawWeapon(
  ctx: CanvasRenderingContext2D, sprites: Sprites, key: string, mode: "lung" | "vai" | "chuc",
  anchor: { dau: [number, number, number]; tay: [number, number] | null }, lift: number,
): void {
  // Đeo lưng và chúc kiếm dùng ảnh đã xoá nắm tay (tay của thân tự nắm chuôi); vác vai giữ nắm tay của ảnh đồ.
  const w = mode !== "vai" ? bareWeapon(sprites, key) : sprites.asset(`do/vu_khi/${key}`) && {
    img: sprites.asset(`do/vu_khi/${key}`)!.img,
    pivot: (sprites.asset(`do/vu_khi/${key}`)!.meta.pivot ?? [32, 32]) as [number, number],
  };
  if (!w) return;
  const c = CARRY[key] ?? CARRY_DEFAULT;
  let px: number;
  let py: number;
  let rot: number;
  if (mode === "lung") {
    px = anchor.dau[0] + c.lung[1];
    py = anchor.dau[1] + c.lung[2];
    rot = c.lung[0];
  } else {
    px = anchor.tay![0];
    py = anchor.tay![1];
    rot = mode === "vai" ? c.vai : c.chuc;
  }
  ctx.save();
  ctx.translate(px - FRAME_X, py - FRAME_FOOT - lift);
  ctx.rotate((rot * Math.PI) / 180);
  ctx.drawImage(w.img, -w.pivot[0], -w.pivot[1]);
  ctx.restore();
}

// ---- hiệu ứng ----

type Layer = "ground" | "back" | "front";

/** `lift`: người nhấc khỏi đất bao nhiêu px; `feet`: bàn chân cách đất bao nhiêu px (gồm phần dải tự nhấc). */
function drawFx(
  ctx: CanvasRenderingContext2D, k: Fx, layer: Layer, t: number, lift: number, feet: number, tint: string, phase: number,
): void {
  switch (k) {
    case "khi_lo_lung":
      if (layer === "front") drawFloatQi(ctx, t, feet, tint, phase);
      return;
    case "tran_do":
      if (layer === "ground") drawCircle(ctx, t, tint);
      return;
    case "khi_tuc":
      if (layer !== "ground") drawAura(ctx, t, tint, layer === "front", phase);
      return;
    case "dan_hoa":
      if (layer === "front") drawFlame(ctx, t, lift, phase);
      return;
    case "la_thuoc":
      if (layer !== "ground") drawOrbit(ctx, t, layer === "front", 3, 19, -28, 0.9, phase, drawLeaf);
      return;
    case "dong_tien":
      if (layer !== "ground") drawOrbit(ctx, t, layer === "front", 3, 17, -36, 1.3, phase, drawCoin);
      return;
    case "phi_kiem":
      if (layer === "back") drawFlyingSword(ctx, t, lift, tint);
      return;
    case "hao_quang":
    case "hao_quang_vang":
      if (layer === "back") drawHalo(ctx, t, lift, k === "hao_quang_vang" ? "#f2c230" : tint, k === "hao_quang_vang");
      return;
    case "bua_giay":
      if (layer !== "ground") drawOrbit(ctx, t, layer === "front", 4, 21, -34, 0.8, phase, drawTalisman);
      return;
  }
}

/**
 * Lửa khí dưới chân người bay: hai lưỡi lửa màu hệ chảy xuống từ bàn chân, lõi trắng, cháy chập chờn; dưới cùng là
 * vệt khí mờ toả ngang rơi dần xuống đất.
 */
function drawFloatQi(ctx: CanvasRenderingContext2D, t: number, feet: number, tint: string, phase: number): void {
  const foot = -feet;
  ctx.save();
  // quầng sáng mờ ôm hai bàn chân
  ctx.globalAlpha = 0.22 + 0.06 * Math.sin(t * 5 + phase);
  ctx.fillStyle = tint;
  ctx.beginPath();
  ctx.ellipse(0, foot + 2, 13, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  // mỗi bàn chân ba lưỡi lửa khí so le, cháy chập chờn, lõi sáng ngắn
  for (const [fx, k] of [[-6, 0], [6, 1.7]] as const) {
    for (let j = 0; j < 3; j++) {
      const flick = 0.7 + 0.3 * Math.sin(t * 9 + k + j * 2.1 + phase * 5);
      const len = (7 + j * 2.5) * flick;
      const ox = fx + (j - 1) * 2.2 + Math.sin(t * 4 + j + k) * 0.8;
      const w = 2.6 - j * 0.4;
      ctx.globalAlpha = 0.55 - j * 0.12;
      ctx.fillStyle = tint;
      ctx.beginPath();
      ctx.moveTo(ox - w, foot);
      ctx.bezierCurveTo(ox - w, foot + len * 0.5, ox - w * 0.3, foot + len * 0.8, ox + Math.sin(t * 7 + j) * 1.2, foot + len);
      ctx.bezierCurveTo(ox + w * 0.3, foot + len * 0.8, ox + w, foot + len * 0.5, ox + w, foot);
      ctx.fill();
    }
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.ellipse(fx, foot + 1.5, 1.6, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < 4; i++) {
    const a = (t * 0.8 + i / 4 + phase) % 1; // 0 vừa sinh dưới chân, 1 tan ở đất
    const y = foot + 6 + a * Math.max(0, feet - 8);
    ctx.globalAlpha = 0.4 * (1 - a);
    ctx.fillStyle = i % 2 ? "#ffffff" : tint;
    ctx.beginPath();
    ctx.ellipse(((i * 7) % 5) - 2, y, 5 + a * 11, 1.4 + a, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * Vòng hào quang sau lưng (kiểu pháp luân): vòng đôi đứng thẳng sau thân trên, các lông vũ / phù văn quanh vành xoay
 * chậm, ánh mờ ở giữa. `gold` là vòng tông chủ: dày hơn, có tia sáng.
 */
function drawHalo(ctx: CanvasRenderingContext2D, t: number, lift: number, color: string, gold: boolean): void {
  const cy = -38 - lift;
  const r = gold ? 21 : 18;
  const spin = t * (gold ? 0.35 : -0.5);
  ctx.save();
  ctx.translate(0, cy);
  ctx.globalAlpha = 0.18 + 0.06 * Math.sin(t * 2);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 0.9;
  ctx.strokeStyle = color;
  ctx.lineWidth = gold ? 2 : 1.3;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 0.8;
  ctx.globalAlpha = 0.7;
  ctx.beginPath();
  ctx.arc(0, 0, r - 4, 0, Math.PI * 2);
  ctx.stroke();
  const n = gold ? 12 : 8;
  for (let i = 0; i < n; i++) {
    const a = spin + (i * 2 * Math.PI) / n;
    ctx.save();
    ctx.rotate(a);
    ctx.globalAlpha = 0.95;
    ctx.fillStyle = gold ? (i % 2 ? "#fff1b8" : color) : color;
    if (gold) {
      // lông vũ vàng chĩa ra ngoài vành
      ctx.beginPath();
      ctx.moveTo(r - 2, -1.6);
      ctx.quadraticCurveTo(r + 5, -2.4, r + 8, 0);
      ctx.quadraticCurveTo(r + 5, 2.4, r - 2, 1.6);
      ctx.fill();
    } else {
      // phù văn: vạch ngắn trắng trên vành
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(r - 3.5, -0.8, 3, 1.6);
    }
    ctx.restore();
  }
  ctx.restore();
}

/** Bùa giấy vàng có vạch chu sa, lật nhẹ khi bay vòng. */
function drawTalisman(ctx: CanvasRenderingContext2D, x: number, y: number, a: number, t: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.sin(t * 3 + a) * 0.5);
  ctx.scale(Math.max(0.35, Math.abs(Math.cos(t * 2.5 + a))), 1);
  ctx.fillStyle = "#f3d873";
  ctx.strokeStyle = "#6b4a14";
  ctx.lineWidth = 0.6;
  ctx.fillRect(-2, -4, 4, 8);
  ctx.strokeRect(-2, -4, 4, 8);
  ctx.fillStyle = "#c0281e";
  ctx.fillRect(-0.6, -3, 1.2, 6);
  ctx.fillRect(-1.4, -1.5, 2.8, 0.8);
  ctx.restore();
}

/** Trận đồ trên mặt đất: hai vòng, sáu vạch nối thành lục mang tinh, tám phù văn xoay chậm (nhìn nghiêng 0,38). */
function drawCircle(ctx: CanvasRenderingContext2D, t: number, tint: string): void {
  const rx = 27;
  const ry = rx * 0.38;
  const spin = t * 0.5;
  const pt = (a: number, r: number) => [Math.cos(a) * r, Math.sin(a) * r * 0.38] as const;
  ctx.save();
  ctx.lineWidth = 1;
  ctx.strokeStyle = tint;
  ctx.globalAlpha = 0.25 + 0.1 * Math.sin(t * 2);
  ctx.fillStyle = tint;
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  ctx.moveTo(rx * 0.72, 0);
  ctx.ellipse(0, 0, rx * 0.72, ry * 0.72, 0, 0, Math.PI * 2);
  for (let k = 0; k < 2; k++) {
    for (let i = 0; i <= 3; i++) {
      const [x, y] = pt(spin + k * (Math.PI / 3) + (i * 2 * Math.PI) / 3, rx * 0.72);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
  }
  ctx.stroke();
  ctx.fillStyle = "#ffffff";
  for (let i = 0; i < 8; i++) {
    const [x, y] = pt(-spin * 1.4 + (i * Math.PI) / 4, rx * 0.86);
    ctx.globalAlpha = 0.6 + 0.4 * Math.sin(t * 3 + i);
    ctx.fillRect(x - 1, y - 1, 2, 2);
  }
  ctx.restore();
}

/** Khí tức bốc quanh người: các đốm lửa khí màu hệ bay lên từ chân rồi tan; nửa sau người vẽ trước thân, nửa trước vẽ sau. */
function drawAura(ctx: CanvasRenderingContext2D, t: number, tint: string, front: boolean, phase: number): void {
  ctx.save();
  for (let i = 0; i < 10; i++) {
    if ((i % 2 === 0) !== front) continue;
    const a = (t * 0.7 + i * 0.137 + phase) % 1;
    const side = ((i * 37) % 11) / 10 - 0.5; // -0.5…0.5
    const x = side * 30 + Math.sin(t * 3 + i) * 1.5;
    const y = -2 - a * 50;
    const s = 3 * (1 - a) + 1;
    ctx.globalAlpha = 0.65 * Math.sin(Math.PI * a);
    ctx.fillStyle = i % 3 === 0 ? "#ffffff" : tint;
    ctx.beginPath();
    ctx.moveTo(x, y - s * 1.8);
    ctx.quadraticCurveTo(x + s, y, x, y + s);
    ctx.quadraticCurveTo(x - s, y, x, y - s * 1.8);
    ctx.fill();
  }
  ctx.restore();
}

/** Đan hỏa: ngọn lửa nhỏ ba lớp lượn bên tay người ngồi thiền. */
function drawFlame(ctx: CanvasRenderingContext2D, t: number, lift: number, phase: number): void {
  const x = 17 + Math.sin(t * 1.3 + phase) * 2;
  const y = -lift - 20 + Math.sin(t * 2.1 + phase) * 2;
  const flick = 1 + 0.15 * Math.sin(t * 13 + phase * 5);
  const tongue = (r: number, h: number, color: string, alpha: number) => {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y - h * flick);
    ctx.quadraticCurveTo(x + r, y - r * 0.3, x, y + r);
    ctx.quadraticCurveTo(x - r, y - r * 0.3, x, y - h * flick);
    ctx.fill();
  };
  ctx.save();
  ctx.globalAlpha = 0.25;
  ctx.fillStyle = "#ff9a3c";
  ctx.beginPath();
  ctx.arc(x, y, 7, 0, Math.PI * 2);
  ctx.fill();
  tongue(4.5, 9, "#e8461e", 0.95);
  tongue(3, 6, "#ffa62b", 1);
  tongue(1.6, 3.5, "#fff3b0", 1);
  ctx.restore();
}

/** Vật bay vòng quanh người theo quỹ đạo dẹt; nửa vòng sau vẽ trước thân, nửa vòng trước vẽ sau thân. */
function drawOrbit(
  ctx: CanvasRenderingContext2D, t: number, front: boolean, n: number, r: number, y0: number, speed: number, phase: number,
  draw: (ctx: CanvasRenderingContext2D, x: number, y: number, a: number, t: number) => void,
): void {
  ctx.save();
  for (let i = 0; i < n; i++) {
    const a = t * speed + (i * 2 * Math.PI) / n + phase * 3;
    if (Math.sin(a) >= 0 !== front) continue;
    const x = Math.cos(a) * r;
    const y = y0 + Math.sin(a) * r * 0.3 + Math.sin(t * 2 + i) * 1.5;
    ctx.globalAlpha = front ? 1 : 0.75;
    draw(ctx, x, y, a, t);
  }
  ctx.restore();
}

function drawLeaf(ctx: CanvasRenderingContext2D, x: number, y: number, a: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a * 1.5);
  ctx.fillStyle = "#5fae3e";
  ctx.strokeStyle = "#24461c";
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(-3.5, 0);
  ctx.quadraticCurveTo(0, -2.6, 3.5, 0);
  ctx.quadraticCurveTo(0, 2.6, -3.5, 0);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#b6e08a";
  ctx.fillRect(-2, -0.4, 4, 0.8);
  ctx.restore();
}

function drawCoin(ctx: CanvasRenderingContext2D, x: number, y: number, _a: number, t: number): void {
  const squash = Math.max(0.25, Math.abs(Math.cos(t * 4 + x)));
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(squash, 1);
  ctx.fillStyle = "#e7b53a";
  ctx.strokeStyle = "#7a5212";
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.arc(0, 0, 3.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#7a5212";
  ctx.fillRect(-0.9, -0.9, 1.8, 1.8);
  ctx.fillStyle = "#fff1b8";
  ctx.fillRect(-2.4, -2.2, 1, 1);
  ctx.restore();
}

/** Phi kiếm dưới chân: thân kiếm nằm ngang dưới bàn chân, vệt kiếm khí phía sau và ánh sáng mờ. */
function drawFlyingSword(ctx: CanvasRenderingContext2D, t: number, lift: number, tint: string): void {
  const y = -lift + 1;
  ctx.save();
  // vệt kiếm khí kéo về phía sau (bên trái khi nhìn hướng đông nam)
  for (let i = 0; i < 3; i++) {
    ctx.globalAlpha = 0.28 - i * 0.08;
    ctx.fillStyle = i === 0 ? "#ffffff" : tint;
    ctx.beginPath();
    ctx.ellipse(-16 - i * 6, y + 1, 10 + i * 4, 1.4 + i * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 0.35 + 0.15 * Math.sin(t * 4);
  ctx.fillStyle = tint;
  ctx.beginPath();
  ctx.ellipse(1, y + 1, 21, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  // thân kiếm: lưỡi bạc viền tối, chuôi vàng ở phía sau
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#2a2622";
  ctx.fillRect(-15, y - 1.5, 34, 3);
  ctx.fillStyle = "#dfe6ee";
  ctx.fillRect(-14, y - 0.5, 31, 1.5);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(-10, y - 0.5, 20, 0.6);
  ctx.beginPath();
  ctx.moveTo(17, y - 1.5);
  ctx.lineTo(21, y);
  ctx.lineTo(17, y + 1.5);
  ctx.fillStyle = "#2a2622";
  ctx.fill();
  ctx.fillStyle = "#d9a630";
  ctx.fillRect(-16, y - 3, 2, 6);
  ctx.fillStyle = "#6b3f1f";
  ctx.fillRect(-21, y - 1, 5, 2);
  ctx.restore();
}

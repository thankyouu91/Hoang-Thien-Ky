// Nhịp hiệu ứng đạo đồ lúc đột phá cảnh giới, viết theo "công thức đạo diễn chuyển động" của người dùng:
//   khái niệm: đạo của tu sĩ vừa thành hình mới — mực tụ về một điểm ở tâm, chạm, rồi bức đạo đồ mới loang ra từ tâm;
//   nhịp theo khung (30 khung/giây): tụ → chạm (giữ khung) → nở → lắng;
//   luật: anticipation (chấm mực lớn lên rồi dẹt xuống trước khi bung), hit-stop (giữ nguyên 2 khung lúc chạm), overlap
//   (bức tranh còn phóng và còn nhòe sau khi đã lộ hết), squash & stretch (chấm dẹt khi tụ, vươn dọc khi bung), arcs
//   (mép lộ là vòng tròn loang, phóng có vượt rồi về);
//   tránh: tween tuyến tính (mọi đại lượng đi qua hàm easing rồi mới lấy mẫu từng khung), mờ dần lúc chạm (lúc chạm chấm
//   đậm nhất; bức mới hiện bằng mép loang chứ không tăng độ mờ; vòng mực chỉ nhạt khi đã chạy xa);
//   soát: `probe` trả mọi khung để test và để vẽ ảnh tĩnh từng nhịp trước khi chạy thật.
// File này không đụng DOM để chạy được bằng node --test; phần gắn vào màn ở daoDoFx.ts.

export const FPS = 30;

export interface DaoDoNhip {
  /** Số khung tụ (chấm mực lớn lên rồi dẹt; ở sân thì bức cũ thu vào tâm). */
  tu: number;
  /** Số khung giữ nguyên lúc chạm. */
  giu: number;
  /** Số khung nở: bức mới loang từ tâm ra hết. */
  no: number;
  /** Số khung lắng: phóng và nhòe về yên. */
  lang: number;
  /** Phóng và nhòe (px) lúc bắt đầu nở. */
  scale0: number;
  blur0: number;
  /** Có bức cũ thu vào trước không (sân Pháp tướng). */
  cu: boolean;
}

/** Màn đột phá cả màn (capDo.ts): khung chạm 7 (≈ 233 ms) trùng chớp thiên kiếp đầu (đỉnh ≈ 238 ms). */
export const NHIP_MAN: DaoDoNhip = { tu: 7, giu: 2, no: 24, lang: 15, scale0: 0.9, blur0: 6, cu: false };
/** Sân Pháp tướng lúc màn đột phá đóng: bức cũ thu về tâm, giữ, bức mới nở. */
export const NHIP_SAN: DaoDoNhip = { tu: 8, giu: 2, no: 18, lang: 12, scale0: 0.94, blur0: 3, cu: true };

export interface DaoDoKhung {
  /** Bán kính lộ của bức mới, 0–1 (1 là lộ hết). */
  r: number;
  scale: number;
  /** Nhòe mực, px CSS. */
  blur: number;
  /** Bức cũ: bán kính lộ 0–1 và phóng. */
  oldR: number;
  oldScale: number;
  /** Chấm mực ở tâm: cỡ (0 là ẩn) và hệ số dọc (dẹt < 1 < vươn; ngang lấy nghịch đảo để giữ diện tích). */
  dot: number;
  dotSy: number;
  /** Vòng mực chạy theo mép lộ: bán kính 0–1 và độ đậm. */
  ring: number;
  ringA: number;
  /** Quầng giấy sau chữ ở màn đột phá (0–1), hiện theo nhịp lắng để chữ nổi trên đạo đồ dày nét; sân không có. */
  halo: number;
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const easeInCubic = (x: number) => x * x * x;
const easeOutCubic = (x: number) => 1 - (1 - x) ** 3;
/** Ra có vượt: c lớn thì vượt nhiều; đạt đúng 1 ở x = 1. */
const easeOutBack = (x: number, c = 1.9) => 1 + (c + 1) * (x - 1) ** 3 + c * (x - 1) ** 2;

export function nhipLen(n: DaoDoNhip): number {
  return n.tu + n.giu + n.no + n.lang;
}

/** Khung chạm (đầu nhịp giữ). */
export function khungCham(n: DaoDoNhip): number {
  return n.tu;
}

/** Trạng thái ở khung `f` (số thực được, kẹp trong 0…nhipLen). */
export function khungAt(n: DaoDoNhip, f: number): DaoDoKhung {
  const len = nhipLen(n);
  f = Math.max(0, Math.min(len, f));
  const s = n.tu + n.giu;
  // Chấm dẹt lúc chạm: nhỏ lại 18 %, thấp xuống 20 %.
  const SQ = { dot: 0.82, sy: 0.8 };
  if (f < n.tu) {
    const k = f / n.tu;
    // Hai khung cuối của nhịp tụ là nén (anticipation), trước đó chấm lớn lên có vượt nhẹ.
    const grow = n.tu - 2;
    let dot: number;
    let dotSy = 1;
    // Ở sân chấm chỉ hiện khi bức cũ đã thu gần hết vào tâm.
    if (f < grow) dot = n.cu ? easeOutCubic(clamp01((f / grow - 0.4) / 0.6)) : easeOutBack(f / grow, 1.4);
    else {
      const q = easeInCubic((f - grow) / 2);
      dot = 1 + (SQ.dot - 1) * q;
      dotSy = 1 + (SQ.sy - 1) * q;
    }
    return {
      r: 0,
      scale: n.scale0,
      blur: n.blur0,
      oldR: n.cu ? 1 - easeInCubic(k) : 0,
      oldScale: n.cu ? 1 - 0.05 * easeInCubic(k) : 1,
      dot: Math.max(0, dot),
      dotSy,
      ring: 0,
      ringA: 0,
      halo: 0,
    };
  }
  if (f < s) return { r: 0, scale: n.scale0, blur: n.blur0, oldR: 0, oldScale: 0.95, dot: SQ.dot, dotSy: SQ.sy, ring: 0, ringA: 0, halo: 0 };
  const k = clamp01((f - s) / n.no);
  // Phóng và nhòe kéo qua cả nhịp lắng (overlap): bức đã lộ hết mà mực còn đang lắng.
  const kl = clamp01((f - s) / (n.no + n.lang));
  const r = easeOutCubic(k);
  // Chấm vươn dọc lúc bung, bị mép lộ nuốt khi r qua 0,12 thì cắt hẳn (không mờ dần).
  const dotOn = r < 0.12;
  return {
    r,
    scale: n.scale0 + (1 - n.scale0) * easeOutBack(kl, 2.2),
    blur: n.blur0 * (1 - easeOutCubic(kl)),
    oldR: 0,
    oldScale: 0.95,
    dot: dotOn ? 1 : 0,
    dotSy: dotOn ? 1.22 : 1,
    ring: f - s >= n.no ? 0 : r,
    // Vòng mực đậm nhất lúc vừa bung, nhạt dần khi chạy ra xa, tắt hẳn đúng lúc lộ hết.
    ringA: f - s >= n.no ? 0 : 0.75 * (1 - k) ** 1.6,
    halo: n.cu ? 0 : easeOutCubic(kl),
  };
}

/** Mọi khung 0…nhipLen (hàm dò khung): dùng cho test và để sinh keyframe Web Animations. */
export function probe(n: DaoDoNhip): DaoDoKhung[] {
  const out: DaoDoKhung[] = [];
  for (let f = 0; f <= nhipLen(n); f++) out.push(khungAt(n, f));
  return out;
}

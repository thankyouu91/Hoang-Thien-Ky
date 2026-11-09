// Hình nền từng công trình trong tông môn, vẽ bằng code (SVG kiểu thủy mặc lúc chạng vạng, hợp nền tối của dashboard).
// Mỗi hình suy ra từ ba thứ: mô hình tông môn (50 đảo tông môn trong assets/pixellab/tong_mon, mỗi mô hình một seed và
// một bộ họa tiết đọc từ tên), địa thế sơn môn (GDD mục 3) và công trình (GDD mục 5). Cùng đầu vào thì cùng hình.
// Không dùng PixelLab: 50 mô hình × 11 công trình là 550 hình, quá ngân sách; bản vẽ code thay được bằng hình họa sĩ sau.
import type { Element } from "@htk/sim";
import { ELEMENT_STYLE } from "../../theme/elements.ts";

export type LocationId =
  | "chinh_dien" | "tang_kinh_cac" | "ho_son_dai_tran" | "dien_vo_truong" | "luyen_dan_phong" | "luyen_khi_cac"
  | "linh_duoc_vien" | "bao_kho" | "truyen_tong_tran" | "thuong_hoi" | "phi_thang_dai";

/** 11 công trình của GDD mục 5, theo thứ tự trong bảng. */
export const LOCATIONS: { id: LocationId; name: string; role: string }[] = [
  { id: "chinh_dien", name: "Chính Điện", role: "Lõi tông môn; giới hạn cấp mọi công trình khác" },
  { id: "tang_kinh_cac", name: "Tàng Kinh Các", role: "Lưu tàn quyển, ghép công pháp, chọn bộ truyền thụ" },
  { id: "ho_son_dai_tran", name: "Hộ Sơn Đại Trận", role: "Phòng thủ Chính Điện bằng trận nhãn theo hệ" },
  { id: "dien_vo_truong", name: "Diễn Võ Trường", role: "Huấn luyện đệ tử, xếp đội hình chiến" },
  { id: "luyen_dan_phong", name: "Luyện Đan Phòng", role: "Đan dược; Tẩy Tủy Đan (cần Tu đan)" },
  { id: "luyen_khi_cac", name: "Luyện Khí Các", role: "Rèn pháp bảo từ quặng" },
  { id: "linh_duoc_vien", name: "Linh Dược Viên", role: "Trồng dược liệu, mạnh hơn cạnh linh tuyền" },
  { id: "bao_kho", name: "Bảo Khố", role: "Chứa tài nguyên; một phần không bị cướp khi thua" },
  { id: "truyen_tong_tran", name: "Truyền Tống Trận", role: "Nối thành chủ với sơn môn, tăng tầm chiếm điểm" },
  { id: "thuong_hoi", name: "Thương hội", role: "Gian hàng ở chợ, giảm thuế (cần Tu kim tiền)" },
  { id: "phi_thang_dai", name: "Phi Thăng Đài", role: "Mở ở cấp 200, kích hoạt thăng vị diện" },
];

export interface SectModel {
  /** Mã mô hình = tên file đảo tông môn, ví dụ "loi_loi_tri_phong". */
  id: string;
  name: string;
  element: Element;
}

export interface SceneInput {
  model: SectModel;
  /** Địa thế sơn môn: son_hiem, thuy_trach, hoa_mach, co_tich, thuong_lo, linh_mach. */
  terrain: string;
  location: LocationId;
}

const W = 400;
const H = 240;
const HORIZON = 150;

// ---- ngẫu nhiên có seed --------------------------------------------------------------------------------------------

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function rng(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- màu ---------------------------------------------------------------------------------------------------------

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Trộn hai màu hex, t = phần của màu b. */
function mix(a: string, b: string, t: number): string {
  const x = rgb(a);
  const y = rgb(b);
  return `#${x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, "0")).join("")}`;
}

const INK = "#0c0a08";
const NIGHT = "#15120f";

// ---- họa tiết đọc từ tên mô hình -----------------------------------------------------------------------------------

type Motif = "swords" | "lotus" | "bamboo" | "tower" | "moon" | "sun" | "snow" | "lightning" | "clouds" | "water" | "blossom" | "cave" | "bell" | "tree" | "skull";

const NAME_MOTIFS: [RegExp, Motif][] = [
  [/Kiếm/, "swords"], [/Liên Hoa|Sen/, "lotus"], [/Trúc/, "bamboo"], [/Tháp/, "tower"], [/Nguyệt|Âm Dương|U Tuyền/, "moon"],
  [/Dương|Nhật|Kim Ô/, "sun"], [/Băng|Tuyết|Sương|Hàn/, "snow"], [/Lôi|Điện Các|Tử Điện/, "lightning"], [/Vân|Hạc|Phong Lâu/, "clouds"],
  [/Thủy|Ba |Long Cung|Bích Ba/, "water"], [/Hoa|Đào/, "blossom"], [/Động|Quật|Cốc/, "cave"], [/Chung|Tự/, "bell"], [/Thụ|Mộc/, "tree"],
  [/Cốt|Huyết|Hồn/, "skull"],
];

/** Họa tiết theo hệ khi tên không gợi gì. */
const ELEMENT_MOTIF: Record<Element, Motif> = {
  kim: "swords", moc: "tree", thuy: "water", hoa: "sun", tho: "cave", loi: "lightning", phong: "clouds",
  quang: "sun", am_lanh: "skull", cuc_duong: "sun", cuc_am: "moon", cuc_han: "snow",
};

function motifsOf(m: SectModel): Motif[] {
  const out: Motif[] = [];
  for (const [re, motif] of NAME_MOTIFS) if (re.test(m.name) && !out.includes(motif)) out.push(motif);
  if (!out.includes(ELEMENT_MOTIF[m.element])) out.push(ELEMENT_MOTIF[m.element]);
  // Nước nằm dưới cùng của lớp trước để sen, kiếm vẽ đè lên.
  return out.slice(0, 3).sort((a, b) => (a === "water" ? -1 : b === "water" ? 1 : 0));
}

// ---- hình cơ bản ------------------------------------------------------------------------------------------------

const f = (n: number) => n.toFixed(1);

/** Dãy núi: chuỗi đỉnh theo seed; `sharp` cho núi hiểm, `amp` là độ cao. */
function ridge(r: () => number, base: number, amp: number, sharp: boolean, fill: string, opacity = 1): string {
  const phases = [r() * 6, r() * 6, r() * 6];
  const freq = [0.012 + r() * 0.01, 0.03 + r() * 0.02, 0.07 + r() * 0.03];
  let d = `M -10 ${H}`;
  for (let x = -10; x <= W + 10; x += 8) {
    let y = 0;
    for (let i = 0; i < 3; i++) {
      const s = Math.sin(x * freq[i] + phases[i]);
      y += (sharp ? 1 - Math.abs(s) : (s + 1) / 2) * [1, 0.45, 0.18][i];
    }
    d += ` L ${x} ${f(base - (y / 1.63) * amp)}`;
  }
  return `<path d="${d} L ${W + 10} ${H} Z" fill="${fill}" opacity="${opacity}"/>`;
}

/** Mái cong kiểu cổ: đáy rộng w ở độ cao y, nóc cao h, đầu đao vểnh c. */
function roof(x: number, y: number, w: number, h: number, c: number, fill: string): string {
  const l = x - w / 2;
  const rr = x + w / 2;
  return `<path d="M ${f(l - c)} ${f(y - c * 0.7)} Q ${f(l)} ${f(y + 1)} ${f(l + c)} ${f(y)} L ${f(rr - c)} ${f(y)} Q ${f(rr)} ${f(y + 1)} ${f(rr + c)} ${f(y - c * 0.7)} L ${f(x + w * 0.28)} ${f(y - h)} L ${f(x - w * 0.28)} ${f(y - h)} Z" fill="${fill}"/>`;
}

/** Một tầng nhà: thân và cửa sổ sáng màu hệ. */
function storey(x: number, y: number, w: number, h: number, fill: string, light: string, windows: number): string {
  let s = `<rect x="${f(x - w / 2)}" y="${f(y - h)}" width="${f(w)}" height="${f(h)}" fill="${fill}"/>`;
  const gap = w / (windows + 1);
  for (let i = 1; i <= windows; i++) s += `<rect x="${f(x - w / 2 + gap * i - 1.6)}" y="${f(y - h * 0.68)}" width="3.2" height="${f(h * 0.36)}" fill="${light}" opacity="0.85"/>`;
  return s;
}

/** Tháp nhiều tầng mái. */
function pagoda(x: number, ground: number, tiers: number, w0: number, fill: string, light: string): string {
  let s = "";
  let y = ground;
  let w = w0;
  for (let i = 0; i < tiers; i++) {
    const h = 12 - i;
    s += storey(x, y, w * 0.72, h, fill, light, Math.max(1, 3 - i));
    y -= h;
    s += roof(x, y, w, 7, 5, fill);
    y -= 6;
    w *= 0.8;
  }
  return s + `<rect x="${f(x - 0.8)}" y="${f(y - 8)}" width="1.6" height="8" fill="${fill}"/>`;
}

function glow(x: number, y: number, r: number, color: string, id: string, strength = 0.55): string {
  return `<radialGradient id="${id}"><stop offset="0" stop-color="${color}" stop-opacity="${strength}"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient>
    <circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="url(#${id})"/>`;
}

function mist(y: number, h: number, opacity: number): string {
  return `<rect x="0" y="${f(y)}" width="${W}" height="${f(h)}" fill="url(#mist)" opacity="${opacity}"/>`;
}

// ---- họa tiết ---------------------------------------------------------------------------------------------------

function motifLayer(m: Motif, r: () => number, accent: string, ground: number): { back: string; front: string } {
  let back = "";
  let front = "";
  switch (m) {
    case "moon":
      back += `<circle cx="${f(70 + r() * 260)}" cy="${f(38 + r() * 20)}" r="16" fill="${mix(accent, "#f3ead8", 0.6)}" opacity="0.85"/>`;
      break;
    case "sun":
      back += glow(200 + (r() - 0.5) * 220, 92, 70, accent, "sunGlow", 0.5);
      break;
    case "lightning": {
      const x = 60 + r() * 280;
      back += `<path d="M ${f(x)} 0 L ${f(x - 8)} 34 L ${f(x + 3)} 34 L ${f(x - 10)} 76" fill="none" stroke="${mix(accent, "#ffffff", 0.4)}" stroke-width="1.6" opacity="0.8"/>`;
      break;
    }
    case "clouds":
      for (let i = 0; i < 4; i++) {
        const cx = r() * W;
        const cy = 50 + r() * 50;
        back += `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(40 + r() * 40)}" ry="${f(6 + r() * 5)}" fill="#efe6d6" opacity="0.06"/>`;
      }
      break;
    case "snow":
      for (let i = 0; i < 40; i++) back += `<circle cx="${f(r() * W)}" cy="${f(r() * H)}" r="${f(0.6 + r() * 1.1)}" fill="#f3f6f8" opacity="${f(0.25 + r() * 0.45)}"/>`;
      break;
    case "water":
      front += `<rect x="0" y="${f(ground + 6)}" width="${W}" height="${f(H - ground)}" fill="${mix(accent, NIGHT, 0.82)}"/>`;
      for (let i = 0; i < 9; i++) {
        const y = ground + 12 + i * 7;
        front += `<path d="M ${f(r() * 320)} ${f(y)} h ${f(30 + r() * 80)}" stroke="${accent}" stroke-width="0.8" opacity="${f(0.12 + r() * 0.15)}"/>`;
      }
      break;
    case "lotus":
      for (let i = 0; i < 5; i++) {
        const x = 20 + r() * 360;
        const y = ground + 18 + r() * 40;
        front += `<ellipse cx="${f(x)}" cy="${f(y)}" rx="9" ry="2.4" fill="#203226"/><path d="M ${f(x - 4)} ${f(y - 1)} Q ${f(x)} ${f(y - 9)} ${f(x + 4)} ${f(y - 1)} Z" fill="${mix(accent, "#f0a6b8", 0.6)}" opacity="0.9"/>`;
      }
      break;
    case "bamboo":
      for (let i = 0; i < 14; i++) {
        const x = (i < 7 ? 6 + r() * 70 : 324 + r() * 70);
        const top = 40 + r() * 70;
        front += `<rect x="${f(x)}" y="${f(top)}" width="2.2" height="${f(ground - top + 30)}" fill="#14201a"/>`;
        for (let k = top + 12; k < ground; k += 14) front += `<path d="M ${f(x + 1)} ${f(k)} q 9 -4 14 -1" stroke="#1d2e24" stroke-width="2" fill="none"/>`;
      }
      break;
    case "swords":
      for (let i = 0; i < 9; i++) {
        const x = i < 5 ? 14 + r() * 100 : 286 + r() * 100;
        const h = 30 + r() * 38;
        const y = ground + 8 + r() * 10;
        front += `<path d="M ${f(x)} ${f(y - h)} l 2.4 5 l 0 ${f(h - 5)} l -4.8 0 l 0 ${f(-h + 5)} Z" fill="${mix(accent, "#2a2a2a", 0.55)}"/><rect x="${f(x - 6)}" y="${f(y - h * 0.18 - 2)}" width="12" height="2" fill="${INK}"/>`;
      }
      break;
    case "blossom":
      for (let i = 0; i < 26; i++) front += `<circle cx="${f(r() * W)}" cy="${f(r() * (ground - 20))}" r="${f(1 + r() * 1.6)}" fill="#f2a7bd" opacity="${f(0.3 + r() * 0.4)}"/>`;
      break;
    case "tree": {
      const x = r() < 0.5 ? 40 + r() * 40 : 320 + r() * 40;
      front += `<path d="M ${f(x - 4)} ${f(ground + 10)} Q ${f(x - 2)} ${f(ground - 40)} ${f(x + 2)} ${f(ground - 70)} L ${f(x + 6)} ${f(ground - 70)} Q ${f(x + 6)} ${f(ground - 30)} ${f(x + 8)} ${f(ground + 10)} Z" fill="${INK}"/>
        <ellipse cx="${f(x + 3)}" cy="${f(ground - 82)}" rx="44" ry="26" fill="#121a14"/><ellipse cx="${f(x - 16)}" cy="${f(ground - 64)}" rx="26" ry="15" fill="#101712"/>`;
      break;
    }
    case "cave":
      back += `<path d="M 0 ${H} L 0 40 Q 40 70 60 ${HORIZON} L 70 ${H} Z" fill="#100d0b"/><path d="M ${W} ${H} L ${W} 50 Q ${W - 40} 80 ${W - 55} ${HORIZON} L ${W - 70} ${H} Z" fill="#100d0b"/>`;
      break;
    case "bell": {
      const x = r() < 0.5 ? 60 : 340;
      front += `<rect x="${x - 12}" y="${f(ground - 46)}" width="2.4" height="46" fill="${INK}"/><rect x="${x + 10}" y="${f(ground - 46)}" width="2.4" height="46" fill="${INK}"/>${roof(x + 1, ground - 46, 32, 7, 4, INK)}
        <path d="M ${x - 6} ${f(ground - 20)} Q ${x - 6} ${f(ground - 38)} ${x + 1} ${f(ground - 38)} Q ${x + 8} ${f(ground - 38)} ${x + 8} ${f(ground - 20)} Z" fill="${mix(accent, "#b8893b", 0.5)}"/>`;
      break;
    }
    case "tower":
      back += pagoda(r() < 0.5 ? 70 : 330, HORIZON + 6, 5, 30, "#1b1713", mix(accent, "#000000", 0.3));
      break;
    case "skull":
      for (let i = 0; i < 6; i++) {
        const x = r() * W;
        const y = 60 + r() * 80;
        back += glow(x, y, 6 + r() * 6, mix(accent, "#7dffcf", 0.4), `wisp${i}`, 0.6);
      }
      break;
  }
  return { back, front };
}

// ---- công trình -------------------------------------------------------------------------------------------------

function building(loc: LocationId, r: () => number, accent: string, ground: number): { back: string; front: string } {
  const cx = 200 + (r() - 0.5) * 60;
  const light = mix(accent, "#ffe7b0", 0.35);
  const fill = INK;
  let back = "";
  let s = "";
  switch (loc) {
    case "chinh_dien": {
      const w = 150 + r() * 30;
      s += `<path d="M ${f(cx - w / 2 - 14)} ${f(ground)} L ${f(cx + w / 2 + 14)} ${f(ground)} L ${f(cx + w / 2 + 4)} ${f(ground - 10)} L ${f(cx - w / 2 - 4)} ${f(ground - 10)} Z" fill="${fill}"/>`;
      for (let i = 0; i < 4; i++) s += `<rect x="${f(cx - 16 + i * 2)}" y="${f(ground - 2 - i * 2.4)}" width="${f(32 - i * 4)}" height="1.4" fill="${mix(accent, "#3a3128", 0.6)}"/>`;
      s += storey(cx, ground - 10, w * 0.8, 26, fill, light, 6);
      s += roof(cx, ground - 36, w, 14, 10, fill);
      s += storey(cx, ground - 50, w * 0.48, 14, fill, light, 3);
      s += roof(cx, ground - 64, w * 0.64, 12, 8, fill);
      s += glow(cx, ground - 30, 70, accent, "hall", 0.18);
      break;
    }
    case "tang_kinh_cac":
      s += pagoda(cx, ground, 4 + Math.floor(r() * 2), 64, fill, light);
      for (let i = 0; i < 5; i++) s += `<rect x="${f(cx + 46 + i * 7)}" y="${f(ground - 12 - (i % 2) * 3)}" width="5" height="${f(12 + (i % 2) * 3)}" rx="1" fill="${mix(accent, "#c9b48a", 0.5)}" opacity="0.7"/>`;
      break;
    case "ho_son_dai_tran": {
      const R = 120 + r() * 30;
      back += `<path d="M ${f(cx - R)} ${f(ground)} A ${f(R)} ${f(R * 0.72)} 0 0 1 ${f(cx + R)} ${f(ground)}" fill="${accent}" opacity="0.08" stroke="${accent}" stroke-opacity="0.6" stroke-width="1.2"/>`;
      for (let a = 1; a < 6; a++) {
        const x = cx - R + (2 * R * a) / 6;
        back += `<path d="M ${f(x)} ${f(ground)} Q ${f(cx)} ${f(ground - R * 0.85)} ${f(2 * cx - x)} ${f(ground)}" fill="none" stroke="${accent}" stroke-opacity="0.18" stroke-width="0.8"/>`;
      }
      s += `<ellipse cx="${f(cx)}" cy="${f(ground + 6)}" rx="70" ry="9" fill="none" stroke="${accent}" stroke-width="1.4" opacity="0.8"/><ellipse cx="${f(cx)}" cy="${f(ground + 6)}" rx="52" ry="6.5" fill="none" stroke="${accent}" stroke-width="0.8" stroke-dasharray="3 3" opacity="0.7"/>`;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        s += `<circle cx="${f(cx + Math.cos(a) * 70)}" cy="${f(ground + 6 + Math.sin(a) * 9)}" r="2" fill="${light}"/>`;
      }
      s += pagoda(cx, ground - 2, 2, 46, fill, light);
      break;
    }
    case "dien_vo_truong":
      s += `<ellipse cx="${f(cx)}" cy="${f(ground + 4)}" rx="110" ry="12" fill="#1a1612"/><ellipse cx="${f(cx)}" cy="${f(ground + 4)}" rx="96" ry="9" fill="none" stroke="${mix(accent, "#3a3128", 0.7)}" stroke-width="1"/>`;
      for (let i = 0; i < 6; i++) {
        const x = cx - 80 + i * 32;
        s += `<rect x="${f(x)}" y="${f(ground - 22)}" width="3" height="24" fill="${fill}"/><rect x="${f(x - 5)}" y="${f(ground - 16)}" width="13" height="2.2" fill="${fill}"/>`;
      }
      for (const side of [-1, 1]) {
        const x = cx + side * 124;
        s += `<rect x="${f(x)}" y="${f(ground - 70)}" width="2" height="72" fill="${fill}"/><path d="M ${f(x + 2)} ${f(ground - 70)} l ${side * 22} 6 l ${side * -4} 10 l ${side * -18} -4 Z" fill="${accent}" opacity="0.85"/>`;
      }
      break;
    case "luyen_dan_phong":
      s += storey(cx + 50, ground, 70, 24, fill, light, 2) + roof(cx + 50, ground - 24, 90, 12, 8, fill);
      s += `<path d="M ${f(cx - 52)} ${f(ground - 30)} Q ${f(cx - 52)} ${f(ground - 4)} ${f(cx - 32)} ${f(ground - 4)} Q ${f(cx - 12)} ${f(ground - 4)} ${f(cx - 12)} ${f(ground - 30)} Z" fill="${mix(accent, "#5a4630", 0.4)}"/><rect x="${f(cx - 56)}" y="${f(ground - 33)}" width="48" height="4" rx="2" fill="${fill}"/>
        <path d="M ${f(cx - 44)} ${f(ground - 4)} l -4 8 M ${f(cx - 20)} ${f(ground - 4)} l 4 8" stroke="${fill}" stroke-width="3"/>`;
      s += glow(cx - 32, ground, 30, "#ff8a3d", "fire", 0.5);
      for (let i = 0; i < 4; i++) s += `<ellipse cx="${f(cx - 32 + Math.sin(i * 1.7) * 10)}" cy="${f(ground - 44 - i * 18)}" rx="${f(10 + i * 6)}" ry="${f(6 + i * 2)}" fill="#efe6d6" opacity="${f(0.12 - i * 0.02)}"/>`;
      break;
    case "luyen_khi_cac":
      s += storey(cx, ground, 96, 28, fill, "#ff9a4a", 3) + roof(cx, ground - 28, 120, 12, 8, fill);
      s += `<rect x="${f(cx + 30)}" y="${f(ground - 76)}" width="10" height="40" fill="${fill}"/>`;
      for (let i = 0; i < 3; i++) s += `<ellipse cx="${f(cx + 35 + i * 8)}" cy="${f(ground - 86 - i * 14)}" rx="${f(7 + i * 5)}" ry="${f(4 + i * 2)}" fill="#efe6d6" opacity="${f(0.1 - i * 0.025)}"/>`;
      s += `<path d="M ${f(cx - 90)} ${f(ground)} l 4 -10 h 22 l 4 10 Z M ${f(cx - 92)} ${f(ground - 12)} h 34 v -4 h -34 Z" fill="${fill}"/>`;
      s += glow(cx - 74, ground - 16, 24, "#ffb35c", "spark", 0.5);
      for (let i = 0; i < 10; i++) s += `<circle cx="${f(cx - 74 + (r() - 0.5) * 40)}" cy="${f(ground - 20 - r() * 30)}" r="0.9" fill="#ffd28a"/>`;
      break;
    case "linh_duoc_vien":
      for (let i = 0; i < 4; i++) {
        const y = ground - i * 9;
        const w = 300 - i * 60;
        s += `<path d="M ${f(cx - w / 2)} ${f(y)} h ${f(w)} l -6 -7 h ${f(-w + 12)} Z" fill="${mix("#1f2a1c", INK, i * 0.15)}"/>`;
        for (let k = 0; k < w / 14; k++) s += `<circle cx="${f(cx - w / 2 + 8 + k * 14)}" cy="${f(y - 8)}" r="2" fill="${mix(accent, "#7bc96f", 0.6)}" opacity="0.8"/>`;
      }
      s += `<ellipse cx="${f(cx + 130)}" cy="${f(ground + 10)}" rx="34" ry="7" fill="${mix(accent, "#5ad1c8", 0.5)}" opacity="0.5"/>` + glow(cx + 130, ground + 8, 34, "#86dcc8", "spring", 0.35);
      s += storey(cx - 120, ground, 34, 16, fill, light, 1) + roof(cx - 120, ground - 16, 46, 9, 6, fill);
      break;
    case "bao_kho":
      s += `<path d="M ${f(cx - 70)} ${f(ground)} v -46 l 70 -18 l 70 18 v 46 Z" fill="${fill}"/>`;
      s += `<circle cx="${f(cx)}" cy="${f(ground - 22)}" r="17" fill="${mix(accent, "#3a2f22", 0.55)}"/><circle cx="${f(cx)}" cy="${f(ground - 22)}" r="11" fill="none" stroke="${light}" stroke-width="1.4"/>`;
      for (let i = 0; i < 6; i++) s += `<circle cx="${f(cx + Math.cos(i) * 11)}" cy="${f(ground - 22 + Math.sin(i) * 11)}" r="1.3" fill="${light}"/>`;
      for (const x of [cx - 100, cx + 86]) s += `<rect x="${f(x)}" y="${f(ground - 12)}" width="16" height="12" fill="${mix(accent, "#6b4a1e", 0.6)}"/><rect x="${f(x)}" y="${f(ground - 14)}" width="16" height="3" fill="${fill}"/>`;
      break;
    case "truyen_tong_tran":
      back += `<rect x="${f(cx - 14)}" y="0" width="28" height="${f(ground)}" fill="url(#beam)"/>`;
      s += `<ellipse cx="${f(cx)}" cy="${f(ground)}" rx="62" ry="10" fill="#1a1612" stroke="${accent}" stroke-width="1.4"/>`;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + 0.3;
        const x = cx + Math.cos(a) * 58;
        const y = ground + Math.sin(a) * 9;
        s += `<rect x="${f(x - 2.5)}" y="${f(y - 36)}" width="5" height="36" fill="${fill}"/><circle cx="${f(x)}" cy="${f(y - 39)}" r="2.6" fill="${light}"/>`;
      }
      s += glow(cx, ground - 4, 50, accent, "portal", 0.45);
      break;
    case "thuong_hoi":
      for (let i = 0; i < 4; i++) {
        const x = cx - 120 + i * 80;
        s += `<rect x="${f(x - 26)}" y="${f(ground - 22)}" width="52" height="22" fill="${fill}"/><path d="M ${f(x - 32)} ${f(ground - 22)} h 64 l -6 -12 h -52 Z" fill="${i % 2 ? accent : mix(accent, "#b3261e", 0.6)}" opacity="0.75"/>`;
      }
      s += `<path d="M ${f(cx - 150)} ${f(ground - 50)} Q ${f(cx)} ${f(ground - 30)} ${f(cx + 150)} ${f(ground - 50)}" stroke="${fill}" fill="none"/>`;
      for (let i = 0; i < 9; i++) {
        const t = i / 8;
        const x = cx - 150 + 300 * t;
        const y = ground - 50 + 20 * 4 * t * (1 - t);
        s += `<ellipse cx="${f(x)}" cy="${f(y + 5)}" rx="3" ry="4" fill="#ff6b4a"/>` + (i % 3 === 0 ? glow(x, y + 5, 10, "#ff8a5a", `lan${i}`, 0.5) : "");
      }
      break;
    case "phi_thang_dai":
      back += `<rect x="${f(cx - 8)}" y="0" width="16" height="${f(ground - 60)}" fill="url(#beam)"/>`;
      for (let i = 0; i < 5; i++) {
        const w = 160 - i * 28;
        s += `<rect x="${f(cx - w / 2)}" y="${f(ground - (i + 1) * 12)}" width="${f(w)}" height="12" fill="${mix(INK, accent, i * 0.03)}"/>`;
      }
      s += `<ellipse cx="${f(cx)}" cy="${f(ground - 64)}" rx="26" ry="4" fill="none" stroke="${light}" stroke-width="1.4"/>`;
      s += glow(cx, ground - 64, 44, accent, "ascend", 0.55);
      for (let i = 0; i < 3; i++) back += `<ellipse cx="${f(cx)}" cy="${f(40 + i * 8)}" rx="${f(60 + i * 30)}" ry="${f(6 + i * 2)}" fill="none" stroke="${accent}" stroke-opacity="${f(0.25 - i * 0.07)}"/>`;
      break;
  }
  return { back, front: s };
}

// ---- địa thế -----------------------------------------------------------------------------------------------------

function terrainLayer(terrain: string, r: () => number, accent: string): { sharp: boolean; amp: number; extra: string } {
  switch (terrain) {
    case "son_hiem":
      return { sharp: true, amp: 1.5, extra: "" };
    case "thuy_trach":
      return { sharp: false, amp: 0.6, extra: "" };
    case "hoa_mach": {
      const x = 80 + r() * 240;
      return {
        sharp: false,
        amp: 0.8,
        extra: `<path d="M ${f(x - 70)} ${HORIZON} L ${f(x - 12)} 70 L ${f(x + 12)} 70 L ${f(x + 70)} ${HORIZON} Z" fill="#221a15"/>` + glow(x, 70, 34, "#ff6a3a", "lava", 0.6),
      };
    }
    case "co_tich": {
      let s = "";
      for (let i = 0; i < 5; i++) {
        const x = 20 + r() * 360;
        const h = 18 + r() * 30;
        s += `<rect x="${f(x)}" y="${f(HORIZON - h)}" width="${f(5 + r() * 4)}" height="${f(h)}" fill="#201b16"/>`;
      }
      return { sharp: false, amp: 0.9, extra: s };
    }
    case "thuong_lo":
      return { sharp: false, amp: 0.7, extra: `<path d="M -10 ${HORIZON + 14} Q 200 ${HORIZON - 4} 410 ${HORIZON + 10}" stroke="${mix(accent, "#4a4035", 0.7)}" stroke-width="2" fill="none" opacity="0.6"/>` };
    case "linh_mach": {
      let s = "";
      for (let i = 0; i < 3; i++) {
        const x = 40 + r() * 320;
        const y = 50 + r() * 50;
        s += `<path d="M ${f(x - 16)} ${f(y)} h 32 l -10 14 h -12 Z" fill="#1d1813"/>`;
      }
      return {
        sharp: false,
        amp: 1,
        extra: s + `<path d="M 30 ${HORIZON + 30} q 60 -20 110 -2 t 120 -6 t 120 4" stroke="${accent}" stroke-width="1" fill="none" opacity="0.5"/>`,
      };
    }
    default:
      return { sharp: r() < 0.5, amp: 1, extra: "" };
  }
}

// ---- ghép hình -----------------------------------------------------------------------------------------------------

const cache = new Map<string, string>();

/** SVG của một công trình trong một mô hình tông môn; cùng đầu vào thì cùng chuỗi. */
export function sectSceneSvg(input: SceneInput): string {
  const key = `${input.model.id}|${input.terrain}|${input.location}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const accent = ELEMENT_STYLE[input.model.element].color;
  // Hình chung của mô hình (núi, trời, họa tiết) dùng seed của mô hình; vị trí công trình dùng seed riêng.
  const rm = rng(hash(input.model.id));
  const rl = rng(hash(key));
  const t = terrainLayer(input.terrain, rm, accent);
  const ground = 186 + Math.round(rm() * 10);
  const motifs = motifsOf(input.model).map((m) => motifLayer(m, rm, accent, ground));
  const b = building(input.location, rl, accent, ground);
  const grow = (layer: string) => `<g transform="translate(200 ${ground}) scale(1.32) translate(-200 ${-ground})">${layer}</g>`;
  const skyTop = mix(NIGHT, accent, 0.06);
  const skyLow = mix("#2a231c", accent, 0.28);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${skyTop}"/><stop offset="0.62" stop-color="${skyLow}"/><stop offset="1" stop-color="${mix(skyLow, NIGHT, 0.5)}"/></linearGradient>
    <linearGradient id="mist" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#efe6d6" stop-opacity="0"/><stop offset="0.5" stop-color="#efe6d6" stop-opacity="1"/><stop offset="1" stop-color="#efe6d6" stop-opacity="0"/></linearGradient>
    <linearGradient id="beam" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${accent}" stop-opacity="0"/><stop offset="0.5" stop-color="${mix(accent, "#ffffff", 0.4)}" stop-opacity="0.45"/><stop offset="1" stop-color="${accent}" stop-opacity="0"/></linearGradient>
    <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1"><stop offset="0.55" stop-color="${NIGHT}" stop-opacity="0"/><stop offset="1" stop-color="${NIGHT}" stop-opacity="0.85"/></linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#sky)"/>
  ${glow(200, HORIZON - 10, 230, accent, "horizon", 0.16)}
  ${motifs.map((m) => m.back).join("")}
  ${ridge(rm, HORIZON - 34, 70 * t.amp, t.sharp, mix("#3b342c", accent, 0.12), 0.55)}
  ${mist(HORIZON - 70, 50, 0.07)}
  ${t.extra}
  ${ridge(rm, HORIZON - 4, 46 * t.amp, t.sharp, "#241e18")}
  ${mist(HORIZON - 20, 40, 0.06)}
  ${grow(b.back)}
  ${ridge(rm, ground + 4, 18, false, "#17130f")}
  <path d="M -10 ${ground} Q 200 ${ground - 10} 410 ${ground} L 410 ${H} L -10 ${H} Z" fill="#110e0b"/>
  ${grow(b.front)}
  ${motifs.map((m) => m.front).join("")}
  <rect width="${W}" height="${H}" fill="url(#fade)"/>
</svg>`;
  cache.set(key, svg);
  return svg;
}

/** URL dữ liệu để đặt làm `src` của ảnh hoặc nền CSS. */
export function sectSceneUrl(input: SceneInput): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(sectSceneSvg(input))}`;
}

type Manifest = { assets: { file: string; description?: string }[] };
let manifest: Promise<Manifest> | undefined;
const loadManifest = () =>
  (manifest ??= fetch(`${import.meta.env.BASE_URL}pixellab/manifest.json`)
    .then((r) => r.json() as Promise<Manifest>)
    .catch(() => ({ assets: [] })));

let models: Promise<SectModel[]> | undefined;

/** 50 mô hình tông môn, đọc từ các dòng tong_mon/ của manifest PixelLab (tên nằm đầu mô tả). */
export function sectModels(): Promise<SectModel[]> {
  return (models ??= loadManifest().then((m) =>
    m.assets
      .filter((a) => a.file.startsWith("tong_mon/"))
      .map((a) => {
        const id = a.file.slice("tong_mon/".length).replace(/\.png$/, "");
        const name = a.description?.match(/^([^()]+?) \(/)?.[1] ?? id;
        const element = (Object.keys(ELEMENT_STYLE) as Element[]).sort((x, y) => y.length - x.length).find((e) => id.startsWith(`${e}_`)) ?? "quang";
        return { id, name, element };
      }),
  ));
}

// ---- hình PixelLab khi có -----------------------------------------------------------------------------------------
// Hình vẽ tay bằng PixelLab nằm ở assets/pixellab/cong_trinh/<mô hình>/<công trình>.png (có dòng trong manifest).
// Công trình nào có thì dùng, không thì dùng bản vẽ code ở trên. Bộ hình đang vẽ lại bằng PixelLab Pro (create_image_pro, 320×192)
// theo thứ tự: Chính Điện của mọi mô hình, điểm bản đồ của mọi vùng, rồi các công trình còn lại; hình chưa tới lượt còn bản pixflux.

let pixelArt = new Set<string>();
let pointPixelArt = new Set<string>();
let pixelArtOn = true;

/** Đọc manifest một lần để biết công trình nào có hình PixelLab; gọi trước khi vẽ màn. */
export function loadLocationArt(): Promise<void> {
  return loadManifest().then((m) => {
    pixelArt = new Set(m.assets.filter((a) => a.file.startsWith("cong_trinh/")).map((a) => a.file.slice("cong_trinh/".length).replace(/\.png$/, "")));
    pointPixelArt = new Set(m.assets.filter((a) => a.file.startsWith("diem_nen/")).map((a) => a.file.slice("diem_nen/".length).replace(/\.png$/, "")));
  });
}

/** Công cụ thử: bật tắt hình PixelLab để so với bản vẽ code. */
export function setPixelArt(on: boolean): void {
  pixelArtOn = on;
}

export function pixelArtEnabled(): boolean {
  return pixelArtOn;
}

/** Hình nền của một loại điểm bản đồ trong vùng (assets/pixellab/diem_nen/<vùng>/<loại>.png), nếu đã có. */
export function pointArt(region: string, type: string): string | undefined {
  const key = `${region}/${type}`;
  return pixelArtOn && pointPixelArt.has(key) ? `${import.meta.env.BASE_URL}pixellab/diem_nen/${key}.png` : undefined;
}

/** Hình nền của một công trình: hình PixelLab nếu có, không thì SVG vẽ code. */
export function locationArt(input: SceneInput): { url: string; pixel: boolean } {
  const key = `${input.model.id}/${input.location}`;
  if (pixelArtOn && pixelArt.has(key)) return { url: `${import.meta.env.BASE_URL}pixellab/cong_trinh/${key}.png`, pixel: true };
  return { url: sectSceneUrl(input), pixel: false };
}

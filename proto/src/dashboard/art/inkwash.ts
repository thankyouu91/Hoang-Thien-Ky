// Nền thủy mặc nhạt cho màn đăng nhập: ba lớp núi mực loang vào sương, một vầng son mờ. SVG vẽ bằng code, không cần ảnh.
// Khi nền three.js (phiên "Three.js: hình nền và cảnh") có bản sáng hợp màu kem thì có thể thay bằng renderBackground.

const LAYERS: { d: string; color: string; top: number }[] = [
  {
    d: "M0 172C30 152 50 122 80 132C110 142 120 96 150 82C175 72 190 112 215 116C245 121 260 72 290 62C320 54 335 102 360 112C380 119 392 102 400 97V300H0Z",
    color: "#b9ab92",
    top: 0.55,
  },
  {
    d: "M0 206C25 191 45 161 70 166C95 171 105 141 130 136C160 129 175 176 205 171C230 167 240 141 265 146C290 151 305 181 335 173C360 166 380 151 400 156V300H0Z",
    color: "#8f8270",
    top: 0.5,
  },
  {
    d: "M0 242C40 226 70 206 100 216C130 226 150 201 185 206C220 211 240 236 280 229C310 223 330 206 360 211C380 215 392 226 400 229V300H0Z",
    color: "#5f5345",
    top: 0.42,
  },
];

export function inkwashSvg(bg: string): string {
  const grads = LAYERS.map(
    (l, i) => `<linearGradient id="iw${i}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${l.color}" stop-opacity="${l.top}"/><stop offset="0.75" stop-color="${l.color}" stop-opacity="0"/></linearGradient>`,
  ).join("");
  return `<svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
    <defs>${grads}<linearGradient id="iwfade" x1="0" y1="0" x2="0" y2="1"><stop offset="0.55" stop-color="${bg}" stop-opacity="0"/><stop offset="1" stop-color="${bg}"/></linearGradient></defs>
    <circle cx="298" cy="92" r="30" fill="#c8553f" opacity="0.16"/>
    ${LAYERS.map((l, i) => `<path d="${l.d}" fill="url(#iw${i})"/>`).join("")}
    <rect width="400" height="300" fill="url(#iwfade)"/>
  </svg>`;
}

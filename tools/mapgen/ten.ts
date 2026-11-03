// Tên Hán Việt cho điểm trên bản đồ: gốc hai chữ (chữ đầu thường theo hệ của vùng) cộng đuôi theo loại điểm, vd "Lôi Hạc
// Động", "Băng Nguyệt Tuyền". Tên không trùng trong một vùng; cùng seed thì ra cùng tên. Kho chữ là đề xuất, sửa thoải mái.

/** Chữ hợp với hệ của vùng (mã hệ như ELEMENTS của packages/sim) */
const BY_ELEMENT: Record<string, string[]> = {
  kim: ["Kim", "Kiếm", "Ngân", "Thiết", "Cương", "Duệ", "Bạch", "Phong"],
  moc: ["Mộc", "Lâm", "Tùng", "Trúc", "Diệp", "Liễu", "Hoa", "Thanh"],
  thuy: ["Thủy", "Ba", "Lam", "Giang", "Hồ", "Bích", "Lãng", "Triều"],
  hoa: ["Hỏa", "Viêm", "Xích", "Diễm", "Liệt", "Dung", "Đan", "Hồng"],
  tho: ["Thổ", "Sơn", "Hoàng", "Nham", "Khâu", "Hậu", "Địa", "Thạch"],
  loi: ["Lôi", "Điện", "Vân", "Chấn", "Đình", "Lăng", "Tử", "Minh"],
  phong: ["Phong", "Vân", "Toàn", "Phiêu", "Dương", "Thảo", "Khiếu", "Lam"],
  quang: ["Quang", "Diệu", "Huy", "Minh", "Nhật", "Thần", "Hoa", "Kim"],
  am_lanh: ["U", "Minh", "Âm", "Hàn", "Vụ", "Đầm", "Tịch", "Lãnh"],
  cuc_duong: ["Dương", "Liệt", "Sa", "Xích", "Diệu", "Nhật", "Hỏa", "Kim"],
  cuc_am: ["U", "Uyên", "Ám", "Huyền", "Cửu", "Âm", "Tịch", "Mặc"],
  cuc_han: ["Băng", "Tuyết", "Hàn", "Sương", "Ngân", "Bạch", "Lẫm", "Đông"],
};
const COMMON = [
  "Thanh", "Vân", "Nguyệt", "Hạc", "Long", "Hổ", "Ngọc", "Tùng", "Thạch", "Linh", "Tiên", "Phượng", "Lộc", "An", "Bình",
  "Trường", "Cổ", "Tử", "Lục", "Hà", "Khê", "Vụ", "Yên", "Lạc", "Tĩnh", "Nhạn", "Mai", "Lan", "Hương", "Châu", "Phù", "Đào",
  "Uyển", "Kỳ", "Thúy", "Ẩn", "Đạo", "Hư", "Huyền", "Tinh",
];
/** Đuôi tên theo loại điểm (mã như trường "type" của file điểm) */
const SUFFIX: Record<string, string[]> = {
  thanh_chu: ["Thành"],
  son_mon: ["Phong", "Sơn", "Nhai", "Cốc", "Đỉnh"],
  mo_linh_thach: ["Linh Khoáng", "Thạch Mạch"],
  mo_quang: ["Khoáng", "Thiết Sơn"],
  mo_duoc: ["Dược Cốc", "Linh Điền"],
  linh_tuyen: ["Tuyền"],
  cua_bi_canh: ["Bí Cảnh"],
  hang_di_thu: ["Động", "Quật", "Huyệt"],
  deo: ["Quan"],
  ben_do: ["Độ"],
};

/** Đuôi tên địa hình (mã như trường "kind" của nhan.ts) */
const FEATURE_SUFFIX: Record<string, string[]> = {
  khe: ["Khê"],
  song: ["Thủy", "Hà"],
  giang: ["Giang"],
  nui: ["Sơn", "Lĩnh", "Phong"],
  rung: ["Lâm"],
  dong_co: ["Dã", "Bình"],
  sa_mac: ["Sa", "Mạc"],
  dam_lay: ["Trạch", "Đàm"],
  bang_nguyen: ["Tuyết Nguyên", "Băng Nguyên"],
};

/** Đặt tên địa hình (sông, núi, rừng…) của một vùng như namePoints; `used` là các tên đã có trong vùng, để không trùng */
export function nameFeatures(features: { kind: string; name?: string }[], element: string, rnd: () => number, used = new Set<string>()): void {
  const pick = <T>(list: T[]) => list[Math.floor(rnd() * list.length)];
  const themed = BY_ELEMENT[element] ?? COMMON;
  for (const f of features) {
    for (let attempt = 0; ; attempt++) {
      const first = rnd() < 0.5 ? pick(themed) : pick(COMMON);
      let second = pick(COMMON);
      while (second === first) second = pick(COMMON);
      const name = `${first} ${second} ${pick(FEATURE_SUFFIX[f.kind] ?? ["Địa"])}`;
      if (!used.has(name) || attempt > 50) {
        used.add(name);
        f.name = name;
        break;
      }
    }
  }
}

/** Đặt tên cho mọi điểm của một vùng; `rnd` là bộ sinh số ngẫu nhiên có seed, trả số trong [0, 1) */
export function namePoints(points: { type: string; name?: string }[], element: string, rnd: () => number): void {
  const pick = <T>(list: T[]) => list[Math.floor(rnd() * list.length)];
  const themed = BY_ELEMENT[element] ?? COMMON;
  const used = new Set<string>();
  for (const p of points) {
    for (let attempt = 0; ; attempt++) {
      const first = rnd() < 0.6 ? pick(themed) : pick(COMMON);
      let second = pick(COMMON);
      while (second === first) second = pick(COMMON);
      const name = `${first} ${second} ${pick(SUFFIX[p.type] ?? ["Địa"])}`;
      if (!used.has(name) || attempt > 50) {
        used.add(name);
        p.name = name;
        break;
      }
    }
  }
}

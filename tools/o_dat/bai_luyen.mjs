// Sinh danh sách bãi luyện Hạ vị (docs/gdd/Hoang_Thien_Ky_BaiLuyen.md) từ khung ở Hoang_Thien_Ky_PhoMap.md:
// 12 vùng × (5 khu dã ngoại × 4 bãi + 5 tầng hang) = 300 bãi. Chạy: node tools/o_dat/bai_luyen.mjs (cwd = gốc repo).
// Tên 72 khu và hang được người dùng duyệt ngày 2026-11-10; dải cấp, đồ rơi, tính cách vẫn là đề xuất. Sửa ở đây rồi chạy lại, đừng sửa tay file .md.
import { writeFileSync } from "node:fs";

const LOAI = ["Đồng hoang", "Mỏ dược", "Mỏ quặng", "Mỏ linh thạch", "Đèo"];
const ROI = { "Đồng hoang": "Ngọc", "Mỏ dược": "Dược liệu", "Mỏ quặng": "Quặng", "Mỏ linh thạch": "Linh thạch", "Đèo": "Tàn quyển" };
const TINH = {
  "Đồng hoang": "quái thưa, hiền; treo auto một mình",
  "Mỏ dược": "quái vừa, hiền; một tinh anh đi tuần",
  "Mỏ quặng": "quái vừa, dữ; địa hình hẹp",
  "Mỏ linh thạch": "quái đông, hồi nhanh, dữ; dễ bị tranh bãi",
  "Đèo": "quái thưa, dữ, lẫn cướp Huyết Sát Môn; thông sang vùng kề, không truyền tống",
};
const CANH_GIOI = ["Luyện Khí", "Trúc Cơ", "Kết Đan", "Nguyên Anh", "Hóa Thần"];

/** [tên vùng, hệ, tên 5 khu dã ngoại theo thứ tự cảnh giới 1–5 (loại khu xoay theo PhoMap mục 4), tên hang dị thú] */
const VUNG = [
  ["Vạn Mộc Lâm", "Mộc", ["Thanh Thảo Nguyên", "Linh Chi Cốc", "Mộc Thiết Khe", "Bích Ngọc Lâm", "Vạn Diệp Quan"], "Cổ Mộc Huyệt"],
  ["Hậu Thổ Nguyên", "Thổ", ["Hoàng Thổ Pha", "Thiết Sa Cương", "Khôn Nguyên Mạch", "Trấn Thổ Quan", "Bia Lâm Nguyên"], "Địa Mạch Động"],
  ["Bích Ba Hải", "Thủy", ["Hàn Thiết Than", "Lan Châu Hồ", "Thương Lan Độ", "Khô Hải Bãi", "Thủy Liên Trạch"], "Hải Nhãn Động"],
  ["Thiên Kiếm Nguyên", "Kim", ["Kiếm Mạch Cốc", "Đoạn Kiếm Quan", "Vạn Kiếm Đồng", "Kim Tuyến Pha", "Bạch Thiết Sơn"], "Kiếm Trủng Huyệt"],
  ["Xích Viêm Sơn", "Hỏa", ["Viêm Môn Quan", "Hôi Tận Nguyên", "Hỏa Liên Cốc", "Xích Thiết Lô", "Dung Nham Mạch"], "Địa Hỏa Động"],
  ["Cuồng Phong Nguyên", "Phong", ["Phong Minh Nguyên", "Tốn Thảo Pha", "Phi Sa Cương", "Phong Nhãn Cốc", "Liệt Phong Quan"], "Phong Huyệt Động"],
  ["Lôi Đình Cốc", "Lôi", ["Lôi Trúc Lâm", "Chấn Thiết Nhai", "Lôi Trì Cốc", "Tích Lịch Quan", "Tiêu Mộc Nguyên"], "Lôi Minh Động"],
  ["Diệu Quang Đài", "Quang", ["Bạch Thạch Cương", "Kính Hồ Đài", "Thiên Chiếu Quan", "Minh Quang Nguyên", "Nhật Hoa Pha"], "Quang Ảnh Động"],
  ["Liệt Dương Mạc", "Cực dương", ["Kiêu Dương Mạch", "Hỏa Sa Quan", "Liệt Sa Nguyên", "Lục Châu Ốc Đảo", "Hồng Thiết Khâu"], "Sa Hải Động"],
  ["U Minh Đầm", "Âm lãnh", ["Mê Vụ Quan", "Hắc Thủy Trạch", "Âm Hoa Đầm", "Hủ Thiết Lung", "Nguyệt Ẩn Mạch"], "U Minh Huyệt"],
  ["Vạn Niên Băng Nguyên", "Cực hàn", ["Bạch Nguyên", "Tuyết Liên Pha", "Hàn Thiết Băng Nhai", "Băng Tâm Mạch", "Lẫm Sương Quan"], "Vạn Băng Quật"],
  ["Cửu U Uyên", "Cực âm", ["Minh Hoa Cốc", "Hắc Thạch Nhai", "Cửu U Mạch", "Quỷ Môn Quan", "Tử Hôi Nguyên"], "Cửu U Ngục"],
];

let md = `# Thiên Hoang Ký · Danh sách bãi luyện Hạ vị

Sinh bởi \`tools/o_dat/bai_luyen.mjs\` ngày 2026-11-10 theo khung ở [Hoang_Thien_Ky_PhoMap.md](Hoang_Thien_Ky_PhoMap.md). **Tên 72 khu và hang đã duyệt (2026-11-10); dải cấp, đồ rơi, tính cách vẫn là đề xuất.** Chưa gán loài dị thú cho từng bãi.

Mỗi vùng: 5 khu dã ngoại (mỗi khu 4 bãi × 10 cấp, quái đồng cấp bằng giữa bậc) và 1 hang dị thú 5 tầng (mỗi tầng 1 bãi 10 cấp cuối của cảnh giới, quái đông gấp đôi, từ tầng 2 có cửa hầm ngục). Hệ quái theo hệ vùng. Tổng ${VUNG.length} vùng × 25 = ${VUNG.length * 25} bãi.

Bãi cấp 1–10 của mọi vùng là bãi tân thủ: quái nhảy cấp 1–10, không tự tấn công, trong tầm NPC hộ đạo nên không bị đồ sát.

## Tổng hợp theo bậc cấp

Ở mỗi bậc 10 cấp có 12 bãi, mỗi vùng một bãi. Bảng dưới gộp theo cảnh giới; dò vùng → cột cảnh giới để biết khu nào.

| Vùng · hệ | Luyện Khí 1–40 | Hang 41–50 | Trúc Cơ 51–90 | Hang 91–100 | Kết Đan 101–140 | Hang 141–150 | Nguyên Anh 151–190 | Hang 191–200 | Hóa Thần 201–240 | Hang 241–250 |
|---|---|---|---|---|---|---|---|---|---|---|
`;
VUNG.forEach(([ten, he, khu, hang], i) => {
  const cells = [];
  for (let k = 0; k < 5; k++) cells.push(`${khu[k]} (${LOAI[(i + k) % 5]})`, `${hang} T${k + 1}`);
  md += `| ${ten} · ${he} | ${cells.join(" | ")} |\n`;
});

md += `\n## Chi tiết từng vùng\n`;
VUNG.forEach(([ten, he, khu, hang], i) => {
  md += `\n### ${ten} · ${he}\n\n| # | Bãi | Nơi | Loại | Cấp người | Cấp quái | Đồ rơi nghiêng | Tính cách |\n|---|---|---|---|---|---|---|---|\n`;
  let n = 0;
  for (let k = 0; k < 5; k++) {
    const goc = 50 * k;
    const loai = LOAI[(i + k) % 5];
    for (let b = 0; b < 4; b++) {
      n++;
      const lo = goc + 10 * b + 1, hi = goc + 10 * b + 10;
      const tanThu = k === 0 && b === 0;
      md += `| ${n} | ${khu[k]} · bãi ${b + 1} | Khu dã ngoại ${CANH_GIOI[k]} | ${loai} | ${lo}–${hi} | ${tanThu ? "1–10 ngẫu nhiên" : goc + 10 * b + 5} | ${ROI[loai]} | ${tanThu ? "bãi tân thủ: quái hiền, không bị đồ sát" : TINH[loai]} |\n`;
    }
    n++;
    md += `| ${n} | ${hang} · tầng ${k + 1} | Hang dị thú ${CANH_GIOI[k]} | Hang | ${goc + 41}–${goc + 50} | ${goc + 45} | Tàn quyển, ấn bộ | quái đông gấp đôi, hợp party${k >= 1 ? "; cửa hầm ngục 3 tầng" : ""} |\n`;
  }
});

md += `
## Việc còn mở

- Gán 2 loài dị thú cho mỗi bãi từ danh sách thú theo hệ trong \`data/\` (50 bãi mỗi hệ gốc… mỗi vùng 25 bãi × 2 loài, loài lặp ở bậc cao đổi màu và tên).
- Số cụ thể mỗi bãi (quái mỗi bầy, giây hồi sinh, tỉ lệ rơi) để ở cấu hình bãi khi làm \`tienTrinh.ts\` theo khung mới.
- Tên khu trùng hoặc không hợp truyện vùng thì sửa trong \`VUNG\` của script rồi chạy lại.
`;
writeFileSync("docs/gdd/Hoang_Thien_Ky_BaiLuyen.md", md);
console.log("ghi docs/gdd/Hoang_Thien_Ky_BaiLuyen.md:", VUNG.length * 25, "bãi");

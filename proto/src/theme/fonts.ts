// Chữ của cả hệ thống (người dùng yêu cầu 2026-11-04 "font chữ đẹp"): Lora cho chữ đọc, Cormorant Garamond cho tiêu đề,
// số cấp và tên vùng trên bản đồ. Cả hai OFL, đủ dấu tiếng Việt, nạp từ @fontsource ở dashboard/fonts.css (không gọi
// mạng ngoài). CSS dùng --font và --font-display (dashboard/tokens.css); canvas dùng các chuỗi dưới đây.

export const FONT_TEXT = '"Lora Variable", Cambria, "Times New Roman", serif';
export const FONT_DISPLAY = '"Cormorant Garamond", "Lora Variable", Cambria, serif';

/**
 * Canvas không tự chờ chữ web: nạp trước các kiểu chữ canvas dùng để khung đầu không vẽ bằng chữ dự phòng.
 * Màn vẽ lại mỗi khung nên chỉ cần gọi một lần lúc vào màn.
 */
export function loadCanvasFonts(): Promise<unknown> {
  if (typeof document === "undefined" || !document.fonts) return Promise.resolve();
  return Promise.all(
    [`600 12px ${FONT_TEXT}`, `700 12px ${FONT_TEXT}`, `italic 600 12px ${FONT_TEXT}`, `700 20px ${FONT_DISPLAY}`, `italic 700 20px ${FONT_DISPLAY}`].map((f) =>
      document.fonts.load(f, "Cấp Vạn Niên Băng Nguyên").catch(() => undefined),
    ),
  );
}

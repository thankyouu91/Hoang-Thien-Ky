// Danh sách trang tra cứu sinh từ JSON (scripts/sinh.ts ghi docs/tra-cuu/<duong>.md). Một nguồn cho cả thanh bên lẫn
// script sinh: thêm trang thì thêm ở đây, sinh.ts báo lỗi nếu có trang chưa có hàm sinh.

export interface TrangTraCuu {
  /** Đường dẫn sau /tra-cuu/, không đuôi. */
  duong: string;
  ten: string;
  /** Một câu cho mục lục tra cứu và kết quả tìm kiếm. */
  mo_ta: string;
}

export const TRANG_TRA_CUU: TrangTraCuu[] = [
  { duong: "tan-quyen", ten: "480 tàn quyển", mo_ta: "Mọi tàn quyển theo 12 hệ, 10 loại chiêu và 4 biến thể." },
  { duong: "cong-phap-mau", ten: "Công pháp ghép mẫu", mo_ta: "300 công pháp ghép sẵn làm ví dụ: chủ quyển, phụ quyển, phẩm." },
  { duong: "he", ten: "12 hệ và khắc chế", mo_ta: "Bản sắc từng hệ, hiệu ứng riêng và bảng khắc chế đầy đủ." },
  { duong: "chieu", ten: "Loại chiêu và biến thể", mo_ta: "10 loại chiêu, 4 biến thể và chỉ số của từng cái." },
  { duong: "trang-bi", ten: "Trang bị", mo_ta: "Mọi kiểu trang bị theo 7 ô, có hình, độ hiếm và nguồn." },
  { duong: "phap-bao", ten: "Pháp bảo", mo_ta: "Các loại pháp bảo và từng món." },
  { duong: "phap-khi", ten: "Pháp khí", mo_ta: "Pháp khí dùng cho khai khoáng, rèn, trận và việc tông môn." },
  { duong: "ngoc", ten: "Ngọc", mo_ta: "Ngọc hệ, Ý châu, ấn bộ, binh ấn và Ngọc Phách." },
  { duong: "set-do", ten: "Set đồ", mo_ta: "Các bộ set và hiệu ứng theo số món." },
  { duong: "dan-duoc", ten: "Đan dược và phù", mo_ta: "Đan dược, linh đan, phù chú và linh đơn cho thú." },
  { duong: "nguyen-lieu", ten: "Nguyên liệu", mo_ta: "Nguyên liệu rèn, luyện khí và luyện đan." },
  { duong: "thu-cuoi", ten: "100 thú cưỡi", mo_ta: "Mọi loài thú cưỡi có hình, hệ, phẩm và nơi sống." },
  { duong: "bi-canh", ten: "20 loại bí cảnh", mo_ta: "Tỷ lệ gặp, thế mạnh và phần thưởng của từng loại bí cảnh." },
  { duong: "mo", ten: "Mỏ theo cấp", mo_ta: "Sản lượng mỗi giờ, mỗi ngày và phí nâng cấp mỏ." },
  { duong: "cap-tong-mon", ten: "200 cấp tông môn", mo_ta: "Kinh nghiệm, số đệ tử, điểm chiếm và mở khóa theo từng cấp." },
  { duong: "vung", ten: "Vị diện và vùng", mo_ta: "4 vị diện và 12 vùng Hạ vị cùng hệ chủ đạo." },
];

export const SIDEBAR_TRA_CUU = [
  { text: "Mục lục tra cứu", link: "/tra-cuu/" },
  ...TRANG_TRA_CUU.map((t) => ({ text: t.ten, link: `/tra-cuu/${t.duong}` })),
];

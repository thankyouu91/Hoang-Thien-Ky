// Chú thích thuật ngữ Hán Việt (GDD mục 14: "Thuật ngữ Hán Việt có tooltip, ví dụ Trúc Cơ — cảnh giới thứ 2").
// Phần tử có data-term="<khoá>" thì chạm vào hiện một bóng chú thích; chạm chỗ khác thì tắt.
import { esc } from "./ui.ts";

export const TERMS: Record<string, [string, string]> = {
  luyen_khi: ["Luyện Khí", "cảnh giới thứ 1 ở Hạ vị, cấp 1–50."],
  truc_co: ["Trúc Cơ", "cảnh giới thứ 2, cấp 51–100."],
  ket_dan: ["Kết Đan", "cảnh giới thứ 3, cấp 101–150."],
  nguyen_anh: ["Nguyên Anh", "cảnh giới thứ 4, cấp 151–200."],
  hoa_than: ["Hóa Thần", "cảnh giới thứ 5, cấp 201–250."],
  linh_thach: ["Linh thạch", "tiền của vị diện, đào từ mỏ. Dùng để hiến tế, nâng mỏ, xây công trình và giao dịch."],
  tien_ngoc: ["Tiên ngọc", "tiền nạp, dùng ở Sàn Linh Ngọc."],
  sat_nghiep: ["Sát nghiệp", "tích lại khi hạ người chơi ngoài thành chủ; cao thì bị truy nã và có thể vào lao tù."],
  tang_kinh_cac: ["Tàng Kinh Các", "nơi tông môn lưu tàn quyển và ghép công pháp; trưởng lão trở lên mới ghép được."],
  bo_truyen_thu: ["Bộ truyền thụ", "các công pháp tông chủ chọn cho đệ tử học: 12 suất, thêm 1 mỗi 25 cấp tông môn."],
  tan_quyen: ["Tàn quyển", "mảnh bí kíp rơi ở bí cảnh. Ghép 1 chủ quyển với 1–2 phụ quyển thành công pháp."],
  cong_hien: ["Cống hiến", "điểm đóng góp cho tông môn, dùng để lên tầng công pháp và đổi vật phẩm trong kho tông."],
  bi_canh: ["Bí cảnh", "vùng đánh quái mở lúc 12:00 và 20:00, rơi tàn quyển và trang bị."],
  bao_kho: ["Bảo Khố", "kho tài nguyên của tông môn. Cạn linh thạch thì hộ trận chỉ còn 50% sức kháng."],
  truyen_tong_tran: ["Truyền Tống Trận", "nối thành chủ với sơn môn; tầm của trận quyết định tông môn chiếm được những điểm nào."],
  ho_son_dai_tran: ["Hộ Sơn Đại Trận", "khiên phòng thủ sơn môn, tốn linh thạch duy trì mỗi ngày."],
  linh_can: ["Linh căn", "hệ bẩm sinh của nhân vật. Luyện công pháp trùng hệ thì nhận thêm sức mạnh."],
  tai_nang: ["Tài năng", "vai trò của nhân vật (1 trong 8), quyết định thế mạnh chiến đấu và kinh tế."],
  luc_chien: ["Lực chiến", "ước lượng sức mạnh. Đồ góp tối đa 35%, thú cưỡi tối đa 15%: tu tiên bằng trí, không bằng ví."],
};

/** Khoá thuật ngữ của cảnh giới Hạ vị theo tên. */
export const REALM_TERM: Record<string, string> = {
  "Luyện Khí": "luyen_khi", "Trúc Cơ": "truc_co", "Kết Đan": "ket_dan", "Nguyên Anh": "nguyen_anh", "Hóa Thần": "hoa_than",
};

/** Bọc chữ thành thuật ngữ chạm được. Không đặt bên trong nút khác. */
export function term(label: string, key: string): string {
  return TERMS[key] ? `<span class="term" role="button" tabindex="0" data-term="${key}">${esc(label)}</span>` : esc(label);
}

/** Gắn một lần cho cả trang: chạm thuật ngữ hiện chú thích ngay dưới chữ. */
export function attachTerms(): void {
  const hide = () => document.getElementById("term-pop")?.remove();
  document.addEventListener(
    "click",
    (e) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>("[data-term]");
      hide();
      if (!el) return;
      const t = TERMS[el.dataset.term ?? ""];
      if (!t) return;
      // Chạm thuật ngữ không kích hoạt nút hay thẻ chứa nó.
      e.stopPropagation();
      e.preventDefault();
      const pop = document.createElement("div");
      pop.id = "term-pop";
      pop.setAttribute("role", "tooltip");
      pop.innerHTML = `<b>${esc(t[0])}</b>: ${esc(t[1])}`;
      document.body.append(pop);
      const r = el.getBoundingClientRect();
      const w = pop.offsetWidth;
      pop.style.left = `${Math.max(12, Math.min(window.innerWidth - w - 12, r.left + r.width / 2 - w / 2))}px`;
      const below = r.bottom + 8;
      pop.style.top = `${below + pop.offsetHeight > window.innerHeight - 12 ? r.top - pop.offsetHeight - 8 : below}px`;
    },
    true,
  );
  window.addEventListener("scroll", hide, true);
}

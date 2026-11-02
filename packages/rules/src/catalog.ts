// Danh mục 480 tàn quyển (GDD mục 9): 12 hệ × 10 loại chiêu × 4 biến thể, mỗi hệ 40 quyển.
// Phẩm (1–10) không thuộc danh mục mà được quay khi rơi. Tên là tên tạm ghép từ hệ và loại chiêu,
// thay bằng tên trong KhaiTongLapPhai_HeThong_v1.xlsx khi có file.
// Không dùng Map, Set để đóng gói được cho runtime của Nakama.
import { ELEMENTS, SKILL_TYPES, VARIANTS, type Element, type SkillType, type Variant, type Scroll } from "@ktlp/sim";

export interface ScrollKind {
  id: string; // "hệ.loại.biến thể", ví dụ "loi.can_quet.linh"
  element: Element;
  type: SkillType;
  variant: Variant;
  name: string; // không gồm biến thể; cùng hệ và loại chiêu thì cùng tên
  provisional: boolean; // tên tạm, chờ file Excel
}

export const ELEMENT_NAMES: Record<Element, string> = {
  kim: "Kim", moc: "Mộc", thuy: "Thủy", hoa: "Hỏa", tho: "Thổ",
  loi: "Lôi", phong: "Phong", cuc_duong: "Cực dương", cuc_am: "Cực âm", cuc_han: "Cực hàn",
  quang: "Quang", am_lanh: "Âm lãnh",
};
export const SKILL_TYPE_NAMES: Record<SkillType, string> = {
  can_don: "Cận chiến đơn", can_quet: "Cận chiến quét", tam_xa: "Tầm xa", dien_rong: "Diện rộng", ho_the: "Hộ thể",
  bua_chu: "Bùa chú", tran_phap: "Trận pháp", hoi_phuc: "Hồi phục", khong_che: "Khống chế", than_phap: "Thân pháp",
};
export const VARIANT_NAMES: Record<Variant, string> = { bao: "Bạo", toc: "Tốc", linh: "Linh", ben: "Bền" };
/** Phẩm 1–10 (GDD mục 9); Hạ vị rơi tới Địa (4). */
export const GRADE_NAMES = ["Phàm", "Hoàng", "Huyền", "Địa", "Thiên", "Vương", "Tôn", "Tiên", "Thần", "Thánh"];

// Tên tạm. Tử Điện (Lôi), Phá Hiểu (Quang), U Lãnh (Âm lãnh), Cửu Tiêu (Phong), Liên Hoàn, Châm, Cố Bản, Trảm, Cuồng Vũ lấy từ ví dụ trong GDD.
const ELEMENT_PREFIX: Record<Element, string> = {
  kim: "Canh Kim", moc: "Thanh Mộc", thuy: "Huyền Thủy", hoa: "Liệt Hỏa", tho: "Hậu Thổ",
  loi: "Tử Điện", phong: "Cửu Tiêu", cuc_duong: "Thuần Dương", cuc_am: "Cửu U", cuc_han: "Huyền Băng",
  quang: "Phá Hiểu", am_lanh: "U Lãnh",
};
const TYPE_SUFFIX: Record<SkillType, string> = {
  can_don: "Trảm", can_quet: "Liên Hoàn", tam_xa: "Châm", dien_rong: "Cuồng Vũ", ho_the: "Cố Bản",
  bua_chu: "Phù", tran_phap: "Trận", hoi_phuc: "Hồi Xuân", khong_che: "Tỏa", than_phap: "Bộ",
};

function buildCatalog(): ScrollKind[] {
  const list: ScrollKind[] = [];
  for (const element of ELEMENTS) {
    for (const type of SKILL_TYPES) {
      for (const variant of VARIANTS) {
        list.push({
          id: `${element}.${type}.${variant}`,
          element, type, variant,
          name: `${ELEMENT_PREFIX[element]} ${TYPE_SUFFIX[type]}`,
          provisional: true,
        });
      }
    }
  }
  return list;
}

/** 480 loại tàn quyển, thứ tự cố định theo hệ → loại chiêu → biến thể. */
export const SCROLL_KINDS: readonly ScrollKind[] = buildCatalog();

const BY_ID: Record<string, ScrollKind> = {};
for (const k of SCROLL_KINDS) BY_ID[k.id] = k;

export function scrollKind(id: string): ScrollKind {
  const k = BY_ID[id];
  if (!k) throw new Error(`Không có tàn quyển ${id}`);
  return k;
}

/** Tên hiển thị kèm biến thể, ví dụ "Tử Điện Liên Hoàn · Linh". */
export function scrollLabel(kind: ScrollKind): string {
  return `${kind.name} · ${VARIANT_NAMES[kind.variant]}`;
}

/** Một quyển cụ thể (loại + phẩm) ở dạng thư viện mô phỏng dùng để ghép công pháp. */
export function toScroll(kindId: string, grade: number): Scroll {
  const k = scrollKind(kindId);
  return { element: k.element, type: k.type, variant: k.variant, grade };
}

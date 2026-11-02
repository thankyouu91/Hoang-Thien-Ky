// Danh mục 480 tàn quyển (GDD mục 9): 12 hệ × 10 loại chiêu × 4 biến thể, mỗi hệ 40 quyển.
// Phẩm (1–10) không thuộc danh mục mà được quay khi rơi. Tên lấy từ sheet Tàn quyển của
// data/he_thong/KhaiTongLapPhai_HeThong_v1.xlsx, xuất ra tan_quyen.json bằng tools/data/xuat.ts.
// Không dùng Map, Set để đóng gói được cho runtime của Nakama.
import { ELEMENTS, SKILL_TYPES, VARIANTS, type Element, type SkillType, type Variant, type Scroll } from "@ktlp/sim";
import TAN_QUYEN from "../../../data/he_thong/json/tan_quyen.json" with { type: "json" };

export interface ScrollKind {
  id: string; // "hệ.loại.biến thể", ví dụ "loi.can_quet.linh"
  element: Element;
  type: SkillType;
  variant: Variant;
  name: string; // tên riêng của quyển, không gồm biến thể
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

/** Hậu tố loại chiêu trong tên công pháp ghép (techniqueName), theo ví dụ trong GDD. */
export const TYPE_SUFFIX: Record<SkillType, string> = {
  can_don: "Trảm", can_quet: "Liên Hoàn", tam_xa: "Châm", dien_rong: "Cuồng Vũ", ho_the: "Cố Bản",
  bua_chu: "Phù", tran_phap: "Trận", hoi_phuc: "Hồi Xuân", khong_che: "Tỏa", than_phap: "Bộ",
};

/** Dựng danh mục theo thứ tự cố định hệ → loại chiêu → biến thể; file số liệu thiếu, thừa hay sai mã thì báo lỗi ngay. */
function buildCatalog(rows: { id: string; name: string; element: string; type: string; variant: string }[]): ScrollKind[] {
  const byId: Record<string, { name: string; element: string; type: string; variant: string }> = {};
  for (const r of rows) {
    if (Object.prototype.hasOwnProperty.call(byId, r.id)) throw new Error(`tan_quyen.json: trùng mã ${r.id}`);
    byId[r.id] = r;
  }
  const list: ScrollKind[] = [];
  for (const element of ELEMENTS) {
    for (const type of SKILL_TYPES) {
      for (const variant of VARIANTS) {
        const id = `${element}.${type}.${variant}`;
        const r = byId[id];
        if (!r) throw new Error(`tan_quyen.json: thiếu ${id}`);
        if (r.element !== element || r.type !== type || r.variant !== variant || !r.name) throw new Error(`tan_quyen.json: dòng ${id} sai`);
        list.push({ id, element, type, variant, name: r.name });
      }
    }
  }
  if (rows.length !== list.length) throw new Error(`tan_quyen.json: có ${rows.length} dòng, cần ${list.length}`);
  return list;
}

/** 480 loại tàn quyển, thứ tự cố định theo hệ → loại chiêu → biến thể. */
export const SCROLL_KINDS: readonly ScrollKind[] = buildCatalog(TAN_QUYEN);

const BY_ID: Record<string, ScrollKind> = {};
for (const k of SCROLL_KINDS) BY_ID[k.id] = k;

export function findScrollKind(id: string): ScrollKind | undefined {
  return Object.prototype.hasOwnProperty.call(BY_ID, id) ? BY_ID[id] : undefined;
}

export function scrollKind(id: string): ScrollKind {
  const k = findScrollKind(id);
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

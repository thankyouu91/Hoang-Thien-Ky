// Ngoại hình theo tài năng và hệ (gói 3, 2026-11-05): bộ áo theo tài năng (bảng tai_nang trong mau_he.json), vũ khí
// hiện trên người theo tài năng (GDD mục 6, bảng nhóm vũ khí), áo trùm đầu thì bỏ mũ, màu áo theo hệ chủ (mauAo.ts).
// Thân, mũ, tông chủ đội ngọc quan do nơi gọi chọn (assignLooks trong character.ts).
import type { Look, ReplayUnit } from "../../replay/types.ts";
import { AO_THEO_TAI_NANG } from "./mauAo.ts";

/** Vũ khí hiện trên người theo tài năng (GDD mục 6): mã ảnh trong do/vu_khi/. */
export const VU_KHI_THEO_TAI_NANG: Record<string, string> = {
  tu_the: "quyen_giap",
  tu_phap: "truong",
  tu_tran: "tran_ban",
  tu_dan: "ho_lo",
  sat_thu: "song_chuy",
  tu_ren: "bua_ren",
  tu_duoc: "liem",
  tu_kim_tien: "ban_tinh",
};

/** Bộ áo có mũ trùm: không đội thêm mũ. */
const AO_TRUM_DAU = new Set(["sat_thu"]);

/** Tài năng của một người, lấy từ khoá hình tu_si/<tài năng> của replay. */
export function taiNangOf(u: ReplayUnit): string | undefined {
  return u.sprite?.startsWith("tu_si/") ? u.sprite.slice(6) : undefined;
}

/**
 * Ngoại hình theo tài năng và hệ, dựa trên `look` nơi gọi đã chọn (thân, mũ). Không rõ tài năng thì chỉ thêm màu áo
 * theo hệ. Thân chưa có bộ áo đó thì resolveLook lùi về đạo bào như cũ.
 */
export function lookTheoTaiNang(u: ReplayUnit, look: Look): Look {
  const out: Look = { ...look, tint: u.element };
  const talent = taiNangOf(u);
  if (!talent) return out;
  out.outfit = AO_THEO_TAI_NANG[talent] ?? look.outfit;
  out.weapon = VU_KHI_THEO_TAI_NANG[talent] ?? look.weapon;
  if (AO_TRUM_DAU.has(out.outfit)) out.hat = undefined;
  return out;
}

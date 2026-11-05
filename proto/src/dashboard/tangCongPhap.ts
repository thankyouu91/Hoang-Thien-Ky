// Tầng công pháp (GDD mục 6: "mỗi công pháp có 10 tầng; tầng tăng bằng tu luyện và cống hiến"). Luật và số ở @ktlp/rules
// layers.ts (layerBonus, layerCost, trainingPoints, applyLayer, lệnh len_tang_cong_phap), rules đọc thẳng
// data/he_thong/json/tang_cong_phap.json và tham_so.json › cong_phap.diemLuyenMoiCap (đề xuất 2026-11-05, ô vàng).
// File này không vẽ gì: mock/source.ts dựng bảng tầng cho thẻ công pháp, screens/congPhap.ts vẽ.
import { applyLayer, layerBonus, layerCost, TECHNIQUE_LAYERS } from "@ktlp/rules";
import type { Technique } from "@ktlp/sim";
import type { TangCongPhapRow } from "./source.ts";

/** Chỉ số trận ở một tầng, bằng chính hàm rules.loadoutTechniques dùng khi vào trận. */
export function statsAt(tech: Technique, layer: number): Technique {
  return applyLayer(tech, layer);
}

/** Bảng đủ tầng của một công pháp: mức cộng, chỉ số trận ở từng tầng, giá lên tới tầng đó theo phẩm. */
export function tangRows(tech: Technique, grade: number, ticksPerSecond: number): TangCongPhapRow[] {
  const rows: TangCongPhapRow[] = [];
  for (let tang = 1; tang <= TECHNIQUE_LAYERS; tang++) {
    const s = applyLayer(tech, tang);
    rows.push({
      tang,
      ...layerBonus(tang),
      damage: Math.round(s.damage / 1000),
      cooldownS: s.cooldownTicks / ticksPerSecond,
      manaCost: s.manaCost,
      ...(tang > 1 ? layerCost(tang, grade) : { diemLuyen: 0, congHien: 0 }),
    });
  }
  return rows;
}

// Thử tham số sim mà không sửa packages/sim: `--thu <file.json>` ghi đè các bảng trong packages/sim/src/config.ts ngay lúc chạy.
// File thử theo đúng tên bảng và tên trường, chỉ ghi phần đổi, ví dụ:
//   { "COMBO": { "pure": 1100 }, "ELEMENT_STATS": { "am_lanh": { "range": 500 } }, "SKILL_SPECS": { "can_quet": { "mana": 150 } } }
// Sim đọc các bảng này mỗi lần tính nên ghi đè có tác dụng, trừ số sim tính sẵn lúc nạp module (FIXED_AT_LOAD).
import { readFileSync } from "node:fs";
import {
  SKILL_SPECS, SKILL_RULES, BATTLE, UNIT_CURVE, ROOT_BUFFS, TALENT_RULES, VARIANT_STATS, ELEMENT_STATS, ELEMENT_EFFECTS, COMBO,
} from "@ktlp/sim";

const TABLES: Record<string, Record<string, unknown>> = {
  SKILL_SPECS, SKILL_RULES, BATTLE, UNIT_CURVE, ROOT_BUFFS, TALENT_RULES, VARIANT_STATS, ELEMENT_STATS, ELEMENT_EFFECTS, COMBO,
};
/** battle.ts tính MANA_REGEN_PER_TICK từ số này lúc nạp module. */
const FIXED_AT_LOAD = ["BATTLE.manaRegenPerSec"];

function merge(target: Record<string, unknown>, patch: Record<string, unknown>, path: string, changes: string[]): void {
  for (const [key, value] of Object.entries(patch)) {
    const p = `${path}.${key}`;
    if (!Object.prototype.hasOwnProperty.call(target, key)) throw new Error(`--thu: sim không có ${p}`);
    if (FIXED_AT_LOAD.includes(p)) throw new Error(`--thu: ${p} được sim đọc lúc nạp module, không ghi đè lúc chạy được`);
    const old = target[key];
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      if (old === null || typeof old !== "object") throw new Error(`--thu: ${p} không phải bảng`);
      // Chép trước khi sửa: config.ts dùng chung một object NONE cho nhiều hệ và biến thể.
      const copy = { ...(old as Record<string, unknown>) };
      target[key] = copy;
      merge(copy, value as Record<string, unknown>, p, changes);
    } else {
      if (typeof value !== typeof old) throw new Error(`--thu: ${p} cần kiểu ${typeof old}`);
      if (value !== old) changes.push(`${p}: ${old} → ${value}`);
      target[key] = value;
    }
  }
}

/** Ghi đè theo file thử; trả về danh sách thay đổi để ghi vào bản tóm tắt. */
export function applyTrial(file: string): string[] {
  const patch = JSON.parse(readFileSync(file, "utf8")) as Record<string, Record<string, unknown>>;
  const changes: string[] = [];
  for (const [name, part] of Object.entries(patch)) {
    if (!TABLES[name]) throw new Error(`--thu: không ghi đè được bảng ${name}; được: ${Object.keys(TABLES).join(", ")}`);
    merge(TABLES[name], part, name, changes);
  }
  return changes;
}

// Số trong rules/src/config.ts phải khớp file số liệu data/he_thong (Excel xuất ra json/ bằng tools/data/xuat.ts).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { RULES, GRADE_NAMES, ELEMENT_NAMES, SKILL_TYPE_NAMES, VARIANT_NAMES, TYPE_SUFFIX } from "../src/index.ts";

const data = (file: string): any => JSON.parse(readFileSync(new URL(`../../../data/he_thong/json/${file}`, import.meta.url), "utf8"));

test("luật Tàng Kinh Các và truyền thụ khớp tham_so.json, pham.json", () => {
  const p = data("tham_so.json");
  const grades = data("pham.json");
  assert.deepEqual(RULES.contributionPerScroll, grades.map((g: { contribution: number }) => g.contribution));
  assert.deepEqual(GRADE_NAMES, grades.map((g: { name: string }) => g.name));
  assert.equal(RULES.secondSubLevel, p.cong_phap.secondSubLevel);
  assert.equal(RULES.loadoutSize, p.cong_phap.loadoutSize);
  assert.equal(RULES.outerMaxLearned, p.cong_phap.outerMaxLearned);
  assert.equal(RULES.outerMaxGrade, p.cong_phap.outerMaxGrade);
  assert.equal(RULES.transmissionBase, p.kinh_te.transmissionBase);
  assert.equal(RULES.transmissionPerLevels, p.kinh_te.transmissionPerLevels);
  assert.equal(RULES.transmissionMax, p.kinh_te.transmissionMax);
});

test("tên hệ, loại chiêu, biến thể và hậu tố khớp file số liệu", () => {
  const he = data("he.json"), loai = data("loai_chieu.json"), bien = data("bien_the.json");
  for (const [e, name] of Object.entries(ELEMENT_NAMES)) assert.equal(name, he[e].name, e);
  for (const [t, name] of Object.entries(SKILL_TYPE_NAMES)) assert.equal(name, loai[t].name, t);
  for (const [t, suffix] of Object.entries(TYPE_SUFFIX)) assert.equal(suffix, loai[t].suffix, `${t}.suffix`);
  for (const [v, name] of Object.entries(VARIANT_NAMES)) assert.equal(name, bien[v].name, v);
});

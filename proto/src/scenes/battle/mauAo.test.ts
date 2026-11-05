// Test đổi màu áo theo hệ và ngoại hình theo tài năng (gói 3), không cần trình duyệt.
// Chạy: node --test src/scenes/battle/mauAo.test.ts (trong proto/)
import { test } from "node:test";
import assert from "node:assert/strict";
import MAU from "../../../../assets/pixellab/nhan_vat/mau_he.json" with { type: "json" };
import { ELEMENT_IDS, type ReplayUnit } from "../../replay/types.ts";
import { lookTheoTaiNang, VU_KHI_THEO_TAI_NANG } from "./aoTaiNang.ts";
import { AO_THEO_TAI_NANG, hsl, isCloth, lightRange, recolor, toneAt, type AoSpec, type Rgb } from "./mauAo.ts";

const DAO_BAO = MAU.ao.dao_bao as unknown as AoSpec;
const VO_PHUC = MAU.ao.vo_phuc as unknown as AoSpec;
const HOA = MAU.he.hoa as unknown as [Rgb, Rgb, Rgb];

test("bảng màu đủ 12 hệ, mỗi bộ áo theo tài năng có dải màu", () => {
  for (const el of ELEMENT_IDS) assert.equal((MAU.he as Record<string, unknown>)[el] !== undefined, true, el);
  for (const ao of Object.values(AO_THEO_TAI_NANG)) assert.ok((MAU.ao as Record<string, unknown>)[ao], ao);
});

test("hsl và dải hue vắt qua 0", () => {
  assert.deepEqual(hsl(255, 0, 0).map((v) => Math.round(v * 100) / 100), [0, 1, 0.5]);
  assert.equal(Math.round(hsl(40, 80, 160)[0]), 220);
  assert.equal(isCloth(150, 20, 40, 255, VO_PHUC), true, "đỏ sẫm hue ~350 nằm trong [318, 8]");
  assert.equal(isCloth(150, 35, 20, 255, VO_PHUC), true, "đỏ hue ~7 sát mép");
  assert.equal(isCloth(150, 40, 20, 255, VO_PHUC), false, "hue ~9 ra ngoài dải");
  assert.equal(isCloth(40, 80, 160, 255, VO_PHUC), false);
});

test("đổi màu: áo theo tông hệ, giữ da, viền đen, điểm trong suốt", () => {
  // 4 điểm: áo xanh đậm, áo xanh nhạt, da, viền đen, rồi một điểm trong suốt.
  const px = new Uint8ClampedArray([
    20, 40, 90, 255,
    90, 130, 210, 255,
    230, 180, 140, 255,
    10, 10, 12, 255,
    40, 80, 160, 0,
  ]);
  const before = px.slice();
  const range = lightRange(px, DAO_BAO)!;
  assert.ok(range[0] < range[1]);
  const n = recolor(px, DAO_BAO, HOA, range);
  assert.equal(n, 2);
  assert.deepEqual([...px.slice(0, 3)], HOA[0], "áo tối nhất ra tông đậm");
  assert.deepEqual([...px.slice(4, 7)], HOA[2], "áo sáng nhất ra tông nhạt (reach 1)");
  assert.deepEqual([...px.slice(8)], [...before.slice(8)], "da, viền, điểm trong suốt không đổi");
});

test("toneAt nội suy qua tông giữa", () => {
  assert.deepEqual(toneAt(HOA, 0.5), HOA[1]);
  assert.deepEqual(toneAt(HOA, -1), HOA[0]);
  assert.deepEqual(toneAt(HOA, 2), HOA[2]);
});

const unit = (id: number, sprite: string | undefined): ReplayUnit =>
  ({ id, team: 0, row: 0, name: "x", element: "hoa", hpMax: 1, manaMax: 1, pos: 0, sprite }) as ReplayUnit;

test("ngoại hình theo tài năng: áo, vũ khí, bỏ mũ khi trùm đầu, màu theo hệ", () => {
  const base = { body: "nu_manh", outfit: "dao_bao", hat: "non_la", weapon: "kiem" };
  const st = lookTheoTaiNang(unit(1, "tu_si/sat_thu"), base);
  assert.deepEqual(st, { body: "nu_manh", outfit: "sat_thu", hat: undefined, weapon: "song_chuy", tint: "hoa" });
  const tp = lookTheoTaiNang(unit(2, "tu_si/tu_phap"), base);
  assert.equal(tp.outfit, "dao_bao");
  assert.equal(tp.weapon, "truong");
  assert.equal(tp.hat, "non_la");
  const tt = lookTheoTaiNang(unit(3, "tu_si/tu_the"), base);
  assert.equal(tt.outfit, "vo_phuc");
  assert.equal(tt.weapon, "quyen_giap");
  assert.deepEqual(lookTheoTaiNang(unit(4, undefined), base), { ...base, tint: "hoa" }, "không rõ tài năng: chỉ đổi màu");
  assert.equal(Object.keys(VU_KHI_THEO_TAI_NANG).length, 8);
});

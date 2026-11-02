import { test } from "node:test";
import assert from "node:assert/strict";
import { simulate, elementMultiplier, levelGapMultiplier, Rng, ALLY_SKILLS, type BattleInput } from "../src/index.ts";
import { randomBattle } from "./fixtures.ts";

test("khắc chế 12 hệ đúng GDD mục 8", () => {
  assert.equal(elementMultiplier("kim", "moc"), 1500);
  assert.equal(elementMultiplier("moc", "kim"), 700);
  assert.equal(elementMultiplier("loi", "moc"), 1500); // Lôi thừa hưởng Kim
  assert.equal(elementMultiplier("loi", "kim"), 1200); // biến dị đánh gốc
  assert.equal(elementMultiplier("kim", "loi"), 900); // gốc đánh biến dị
  assert.equal(elementMultiplier("cuc_duong", "cuc_am"), 1500);
  assert.equal(elementMultiplier("cuc_am", "cuc_duong"), 1500);
  assert.equal(elementMultiplier("quang", "am_lanh"), 1500);
  assert.equal(elementMultiplier("am_lanh", "quang"), 1500);
  assert.equal(elementMultiplier("quang", "moc"), 1000);
});

test("thiên địa dị hệ có hệ khắc một chiều (đề xuất): Hỏa khắc Âm lãnh, Kim khắc Quang", () => {
  assert.equal(elementMultiplier("hoa", "am_lanh"), 1500);
  assert.equal(elementMultiplier("am_lanh", "hoa"), 700);
  assert.equal(elementMultiplier("cuc_duong", "am_lanh"), 1500); // Cực dương thừa hưởng Hỏa
  assert.equal(elementMultiplier("kim", "quang"), 1500);
  assert.equal(elementMultiplier("quang", "kim"), 700);
  assert.equal(elementMultiplier("loi", "quang"), 1500); // Lôi thừa hưởng Kim
  assert.equal(elementMultiplier("quang", "loi"), 700);
});

test("chênh lệch cấp: sàn 55%, cộng tối đa 30%", () => {
  assert.equal(levelGapMultiplier(90, 100), 850);
  assert.equal(levelGapMultiplier(80, 100), 700);
  assert.equal(levelGapMultiplier(10, 100), 550);
  assert.equal(levelGapMultiplier(100, 90), 1100);
  assert.equal(levelGapMultiplier(200, 100), 1300);
});

test("RNG có seed lặp lại được", () => {
  const a = new Rng(42), b = new Rng(42);
  for (let i = 0; i < 1000; i++) assert.equal(a.nextU32(), b.nextU32());
});

test("cùng đầu vào cho cùng mã băm (10.000 trận ngẫu nhiên)", () => {
  for (let s = 1; s <= 10000; s++) {
    const input = randomBattle(s);
    const r1 = simulate(input);
    const r2 = simulate(structuredClone(input));
    assert.equal(r1.hash, r2.hash, `lệch ở seed ${s}`);
    assert.equal(r1.winner, r2.winner);
  }
});

test("đổi seed hoặc nhật ký lệnh thì kết quả đổi", () => {
  // Chiêu cuối chỉ có tác dụng với người mang chiêu đánh, nên chọn trận có người như vậy ở đội A.
  const attacker = (i: BattleInput) => i.teamA.find((u) => u.techniques.some((t) => !ALLY_SKILLS.includes(t.type)));
  let seed = 7;
  let input = randomBattle(seed);
  while (!attacker(input)) input = randomBattle(++seed);
  const base = simulate(input).hash;
  assert.notEqual(simulate({ ...input, seed: seed + 1 }).hash, base);
  assert.notEqual(simulate({ ...input, commands: [{ tick: 0, unitId: attacker(input)!.id }] }).hash, base);
});

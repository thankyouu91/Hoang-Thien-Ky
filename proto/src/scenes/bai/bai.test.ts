import { test } from "node:test";
import assert from "node:assert/strict";
import { Bai } from "./bai.ts";
import { BAI, ultPoints } from "./thamSo.ts";

const monsters = (b: Bai) => b.actors.filter((a) => a.kind === "monster");

test("sinh quái theo bầy, có bot", () => {
  const b = new Bai();
  assert.equal(monsters(b).length, BAI.packs * BAI.perPack);
  assert.equal(b.actors.filter((a) => a.kind === "bot").length, BAI.bots.length);
  assert.ok(monsters(b).every((m) => m.alive && m.hp === m.hpMax));
});

test("người chơi giết quái được tu vi, quái hồi sinh ở tổ sau ít giây", () => {
  const b = new Bai();
  const m = monsters(b)[0];
  m.hp = 1;
  b.player.x = m.x - 10;
  b.player.y = m.y;
  b.attack(m.id);
  b.step(0.05);
  assert.equal(m.alive, false);
  assert.equal(b.kills, 1);
  assert.equal(b.tuVi, BAI.tuVi(BAI.level));
  for (let i = 0; i < (BAI.respawn + 0.5) / 0.05; i++) b.step(0.05);
  assert.equal(m.alive, true);
  assert.equal(m.hp, m.hpMax);
});

test("bị đánh thì cả bầy đuổi người đánh", () => {
  const b = new Bai();
  const pack = monsters(b).filter((m) => m.pack === 0);
  b.player.x = pack[0].x - 10;
  b.player.y = pack[0].y;
  b.attack(pack[0].id);
  b.step(0.05);
  assert.ok(pack.every((m) => m.target === b.player.id));
});

test("chiêu tốn Mana và có hồi chiêu", () => {
  const b = new Bai();
  const before = b.mana;
  assert.equal(b.cast("hoi_phuc"), true);
  assert.ok(b.mana < before);
  assert.equal(b.cast("hoi_phuc"), false);
  assert.ok(b.cooldown("hoi_phuc") > 0);
});

test("chiêu cuối mở ở cấp 150 với 1 điểm, mỗi 10 cấp thêm 1", () => {
  assert.deepEqual([1, 149, 150, 159, 160, 175].map(ultPoints), [0, 0, 1, 1, 2, 3]);
  const low = new Bai(1);
  low.ult = 1;
  assert.equal(low.castUlt(), false);
  const high = new Bai(160);
  assert.equal(high.castUlt(), false); // thanh nội tại chưa đầy
  high.ult = 1;
  assert.equal(high.castUlt(), true);
  assert.equal(high.ult, 0);
});

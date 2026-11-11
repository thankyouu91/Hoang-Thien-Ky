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

test("cơ chế chiêu: khống chế làm choáng, bùa chú thiêu đốt, trận pháp để lại trận, cận đơn hút máu, thân pháp lướt tới", () => {
  const setup = () => {
    const b = new Bai();
    b.mana = 1e6;
    b.manaMax = 1e6;
    const m = monsters(b)[0];
m.hpMax = m.hp = 1e7;
    // Chỉ để lại một con: quái bị đánh thì cả bầy cùng đuổi.
    for (const o of b.actors) if (o.kind === "monster" && o !== m) Object.assign(o, { alive: false, respawnAt: 1e9 });
    b.player.x = m.x - 30;
    b.player.y = m.y;
    b.player.target = m.id;
    return { b, m };
  };
  let { b, m } = setup();
  assert.ok(b.cast("khong_che"));
  m.target = b.player.id;
  const hp = b.player.hp;
  for (let i = 0; i < (BAI.stunSec - 0.2) / 0.05; i++) b.step(0.05);
  assert.equal(b.player.hp, hp); // đang choáng, không đánh
  ({ b, m } = setup());
  assert.ok(b.cast("bua_chu"));
  const after = m.hp;
  b.player.target = null;
  for (let i = 0; i < (BAI.burnSec + 1) / 0.05; i++) b.step(0.05);
  assert.ok(m.hp < after && !m.burn);
  ({ b, m } = setup());
  assert.ok(b.cast("tran_phap"));
  assert.equal(b.zones.length, 1);
  const z0 = m.hp;
  b.player.target = null;
  m.x = b.zones[0].x;
  m.y = b.zones[0].y;
  m.stunUntil = 1e9; // đứng yên trong trận
  for (let i = 0; i < (BAI.zoneSec + 1.5) / 0.05; i++) b.step(0.05);
  assert.ok(m.hp < z0 && b.zones.length === 0);
  ({ b, m } = setup());
  b.player.hp = 1;
  assert.ok(b.cast("can_don"));
  assert.ok(b.player.hp > 1);
  ({ b, m } = setup());
  b.player.x = m.x - 200;
  assert.ok(b.cast("than_phap"));
  assert.ok(Math.abs(b.player.x - m.x) < BAI.meleeRange);
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

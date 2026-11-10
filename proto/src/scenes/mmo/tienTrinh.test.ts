import assert from "node:assert/strict";
import { test } from "node:test";
import { Bai } from "../bai/bai.ts";
import { atkOf, buyPot, hpOf, kill, newSave, nextCombat, QUEST_N, upgrade, wpnPrice, xpNeed, zone, ZONE_COUNT } from "./tienTrinh.ts";

test("dải thế giới: sơn môn an toàn, cấp quái tăng dần, cửa bí cảnh có thủ lĩnh", () => {
  assert.equal(ZONE_COUNT, 117);
  assert.ok(zone(0).safe && zone(8).safe && zone(9).safe);
  assert.ok(zone(7).boss);
  let last = 0;
  for (let i = 0; i < ZONE_COUNT; i++) {
    const z = zone(i);
    if (z.safe) continue;
    assert.ok(z.level >= last, `khu ${i}`);
    last = z.level;
  }
  assert.equal(nextCombat(8), 10);
  assert.ok(!zone(nextCombat(ZONE_COUNT - 1)).safe);
});

test("giết quái: lên cấp, xong nhiệm vụ thì sang khu kế", () => {
  const s = newSave("  A  ", "hoa");
  assert.equal(s.name, "A");
  let levels = 0;
  for (let i = 0; i < QUEST_N; i++) levels += kill(s, zone(1), 0.5).levels;
  assert.equal(s.quest.zone, 2);
  assert.ok(levels >= 1 && s.lv === 1 + levels && s.xp < xpNeed(s.lv));
  assert.ok(s.gold > 0);
  const pots = s.pots;
  kill(s, zone(1), 0.01);
  assert.equal(s.pots, pots + 1);
});

test("tiệm: thiếu linh thạch thì không mua được", () => {
  const s = newSave("A", "moc");
  assert.equal(buyPot(s, zone(0)), false);
  s.gold = wpnPrice(s);
  assert.equal(upgrade(s), true);
  assert.equal(s.gold, 0);
  assert.ok(atkOf(1, 1) > atkOf(1, 0));
});

test("khu của thế giới: quái đứng trong dải đi được, thủ lĩnh một con, treo auto tự giết quái", () => {
  const z = zone(1);
  const b = new Bai(1, "moc", 2, { w: 1376, h: 768, top: 280, monsterLevel: z.level, hp: hpOf(1), atk: atkOf(1, 0), bots: [], elements: [z.element] });
  let kills = 0;
  b.onKill = () => kills++;
  b.auto = true;
  for (let i = 0; i < 60 * 60; i++) b.step(1 / 60);
  for (const a of b.actors) assert.ok(a.y >= 280 && a.y <= 768 && a.x >= 0 && a.x <= 1376);
  assert.ok(kills > 0, "treo auto phải giết được quái");
  const boss = new Bai(1, "moc", 2, { boss: true, bots: [] });
  assert.equal(boss.actors.filter((a) => a.kind === "monster").length, 1);
  assert.equal(new Bai(1, "moc", 2, { packs: 0, bots: [] }).actors.length, 1);
});

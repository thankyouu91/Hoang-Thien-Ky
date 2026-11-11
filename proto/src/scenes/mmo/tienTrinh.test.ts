import assert from "node:assert/strict";
import { test } from "node:test";
import { Bai } from "../bai/bai.ts";
import { bayTuDong, bossTuDong, choVao, macDinh, trongCam } from "./mapKhu.ts";
import { BAI } from "../bai/thamSo.ts";
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
  // Bãi rộng 5×4 tấm: 48 bầy rải khắp cả hai chiều, không dồn một dải.
  const big = new Bai(1, "moc", 2, { w: 6880, h: 3072, packs: 48, bots: [] });
  const homes = big.actors.filter((a) => a.kind === "monster").map((a) => a.home);
  assert.equal(homes.length, 48 * BAI.perPack);
  for (const hm of homes) assert.ok(hm.x > 0 && hm.x < 6880 && hm.y > 0 && hm.y < 3072);
  assert.ok(Math.min(...homes.map((hm) => hm.y)) < 600 && Math.max(...homes.map((hm) => hm.y)) > 2400);
  assert.ok(Math.min(...homes.map((hm) => hm.x)) < 800 && Math.max(...homes.map((hm) => hm.x)) > 6000);
});

test("map khu: mặc định có dải cấm, bầy tự rải và chỗ vào đều nằm ngoài vùng cấm; người không đi vào vùng cấm", () => {
  const m = macDinh(zone(1));
  assert.equal(macDinh(zone(0)).vat.length, 2);
  const homes = bayTuDong(m);
  assert.equal(homes.length, 24);
  for (const p of homes) assert.ok(!trongCam(m, p.x, p.y));
  const e = choVao(m, 70);
  assert.ok(!trongCam(m, e.x, e.y));
  // Boss tự đặt nằm ngoài vùng cấm, xa cửa trái; là một con riêng, máu gấp BAI.bossHp, hồi sinh chậm.
  const bo = bossTuDong(m);
  assert.equal(bo.length, 1);
  assert.ok(!trongCam(m, bo[0].x, bo[0].y) && bo[0].x > m.w / 2);
  assert.deepEqual(bossTuDong({ ...m, boss: [{ x: 5, y: 5, ten: "Lão Hổ" }] }), [{ x: 5, y: 5, ten: "Lão Hổ" }]);
  const b = new Bai(1, "moc", 2, { w: m.w, h: m.h, homes, blocked: m.cam, entry: e, bots: [], bosses: bo });
  assert.equal(b.actors.filter((a) => a.kind === "monster").length, 24 * BAI.perPack + 1);
  const boss = b.actors.find((a) => a.boss)!;
  assert.equal(boss.name, "Thủ lĩnh");
  assert.equal(boss.hpMax, BAI.monsterHp(b.mLevel) * BAI.bossHp);
  b.player.atk = boss.hpMax * 2;
  boss.x = b.player.x + 10;
  boss.y = b.player.y;
  b.attack(boss.id);
  for (let i = 0; i < 60 * 3 && boss.alive; i++) b.step(1 / 60);
  assert.equal(boss.alive, false);
  assert.ok(boss.respawnAt - b.t > BAI.respawn);
  assert.equal(b.tuVi, BAI.tuVi(b.mLevel) * BAI.bossTuVi);
  b.moveTo(e.x, 10);
  for (let i = 0; i < 60 * 30; i++) b.step(1 / 60);
  assert.ok(!trongCam(m, b.player.x, b.player.y) && b.player.y < e.y);
});

test("điểm tiềm năng và tầng chiêu theo luật bản cũ", async () => {
  const t = await import("./tienTrinh.ts");
  const s = t.newSave("A", "moc");
  assert.equal(t.statPoints(s), 0);
  assert.equal(t.addStat(s, "the_phach"), false);
  s.lv = 11;
  assert.equal(t.statPoints(s), 10);
  const hp0 = t.stats(s).hp;
  for (let i = 0; i < 10; i++) assert.equal(t.addStat(s, "the_phach"), true);
  assert.equal(t.addStat(s, "the_phach"), false);
  assert.equal(t.stats(s).hp, Math.round(hp0 * 1.01));
  assert.equal(t.resetStats(s), true);
  assert.equal(t.statPoints(s), 10);
  // 10 cấp × 20 điểm luyện = 200: tầng 2 (10) + 3 (20) + 4 (30) + 5 (40) + 6 (50) = 150, tầng 7 cần 60 thì thiếu.
  assert.equal(t.skillPoints(s), 200);
  for (let i = 0; i < 5; i++) assert.equal(t.upSkill(s, "can_quet"), true);
  assert.equal(t.layerOf(s, "can_quet"), 6);
  assert.equal(t.skillPoints(s), 50);
  assert.equal(t.upSkill(s, "can_quet"), false);
  assert.equal(t.upSkill(s, "khong_co"), false);
  t.resetSkills(s);
  assert.equal(t.skillPoints(s), 200);
});

test("chiêu đã học theo cấp và xếp ô", async () => {
  const t = await import("./tienTrinh.ts");
  const s = t.newSave("A", "moc");
  assert.deepEqual(t.slotsOf(s), ["can_quet", "tam_xa", "dien_rong", "ho_the", "hoi_phuc", null]);
  assert.equal(t.learned(s).length, 5);
  assert.equal(t.setSlot(s, 5, "can_don"), false); // chưa học
  s.lv = 5;
  assert.equal(t.setSlot(s, 5, "can_don"), true);
  assert.equal(t.setSlot(s, 0, "can_don"), true); // đổi chỗ với ô 0
  assert.deepEqual(t.slotsOf(s), ["can_don", "tam_xa", "dien_rong", "ho_the", "hoi_phuc", "can_quet"]);
  t.clearSlot(s, 1);
  assert.equal(t.slotsOf(s)[1], null);
  assert.equal(t.setSlot(s, 9, "can_don"), false);
});
